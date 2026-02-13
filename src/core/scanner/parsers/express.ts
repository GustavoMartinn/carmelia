import {
  Project,
  type SourceFile,
  type CallExpression,
  type Node,
  type Type,
  SyntaxKind,
} from 'ts-morph'
import { join, relative, dirname, basename } from 'node:path'
import { existsSync } from 'node:fs'
import type { FrameworkParser } from './base.js'
import type {
  ScannedRoute,
  ScanOptions,
  ScanDiff,
  HttpMethod,
  RequestBody,
  BodyField,
  RouteParam,
  AuthRequirement,
} from '../types.js'
import { hasDependency } from '../../../utils/file.js'
import { joinPaths } from '../../../utils/path.js'
import { logger } from '../../../utils/logger.js'

const ROUTE_FILE_PATTERNS = [
  'src/**/route*.ts',
  'src/**/router*.ts',
  'src/**/*.routes.ts',
  'src/**/*.router.ts',
  'src/**/app.ts',
  'src/**/server.ts',
  'src/**/index.ts',
]

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const
type ExpressHttpMethod = (typeof HTTP_METHODS)[number]

const METHOD_MAP: Record<ExpressHttpMethod, HttpMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  delete: 'DELETE',
  patch: 'PATCH',
}

interface RouterMount {
  prefix: string
  routerVariable: string
  sourceFile: string
}

interface RouteRegistration {
  method: HttpMethod
  path: string
  handlerName: string
  sourceLine: number
  sourceFile: string
  middlewares: string[]
  callExpression: CallExpression
}

export class ExpressParser implements FrameworkParser {
  name = 'express' as const
  language = 'typescript' as const

  async detect(projectPath: string): Promise<boolean> {
    return hasDependency(projectPath, 'express')
  }

  async scan(projectPath: string, options?: ScanOptions): Promise<ScannedRoute[]> {
    const includePatterns = options?.include ?? ROUTE_FILE_PATTERNS
    const excludePatterns = options?.exclude ?? [
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/node_modules/**',
    ]

    let routes = this.scanWithPatterns(projectPath, includePatterns, excludePatterns)

    // Fallback: if specific patterns found 0 routes and we used the defaults, try broad pattern
    if ((await routes).length === 0 && !options?.include) {
      logger.warn('No routes found with specific patterns, falling back to src/**/*.ts')
      routes = this.scanWithPatterns(projectPath, ['src/**/*.ts'], excludePatterns)
    }

    return routes
  }

  private async scanWithPatterns(
    projectPath: string,
    includePatterns: string[],
    excludePatterns: string[],
  ): Promise<ScannedRoute[]> {
    const project = new Project({
      tsConfigFilePath: join(projectPath, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    })

    for (const pattern of includePatterns) {
      project.addSourceFilesAtPaths(join(projectPath, pattern))
    }

    logger.info(`Express scanner loaded ${project.getSourceFiles().length} source files`)

    // Phase 1: Find all router mounts (app.use('/prefix', router))
    const mounts = this.findRouterMounts(project, projectPath)

    // Phase 2: Find all route registrations across all files
    const routes: ScannedRoute[] = []

    for (const sourceFile of project.getSourceFiles()) {
      const filePath = sourceFile.getFilePath()
      const isExcluded = excludePatterns.some((p) =>
        filePath.includes(p.replace(/\*\*/g, '').replace(/\*/g, '')),
      )
      if (isExcluded) continue

      const registrations = this.findRouteRegistrations(sourceFile, projectPath)
      const prefix = this.resolvePrefix(sourceFile, mounts, projectPath)

      for (const reg of registrations) {
        const fullPath = joinPaths(prefix, reg.path)
        const hasAuth = this.detectAuthMiddleware(reg.middlewares)
        const body = this.resolveBody(reg, sourceFile, project, projectPath)
        const params = this.extractPathParams(reg.path)

        const groupName = this.resolveGroupName(sourceFile, projectPath)

        routes.push({
          method: reg.method,
          path: reg.path || '/',
          fullPath,
          groupName,
          handlerName: reg.handlerName,
          sourceFile: relative(projectPath, sourceFile.getFilePath()),
          sourceLine: reg.sourceLine,
          framework: 'express',
          params,
          queryParams: [],
          body: body ?? undefined,
          headers: [],
          auth: hasAuth ? { type: 'bearer' } : undefined,
        })
      }
    }

    return routes
  }

  async diff(_projectPath: string, _previousScan: ScannedRoute[]): Promise<ScanDiff> {
    return { added: [], removed: [], modified: [], unchanged: [] }
  }

  /**
   * Find app.use('/prefix', routerVariable) patterns
   */
  private findRouterMounts(project: Project, projectPath: string): RouterMount[] {
    const mounts: RouterMount[] = []

    for (const sourceFile of project.getSourceFiles()) {
      for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const expr = callExpr.getExpression()

        // Match: app.use('/prefix', something) or app.use('/prefix', authMiddleware, something)
        if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) continue
        const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression)!
        if (propAccess.getName() !== 'use') continue

        const args = callExpr.getArguments()
        if (args.length < 2) continue

        const firstArg = args[0]
        if (firstArg.getKind() !== SyntaxKind.StringLiteral) continue

        const prefix = firstArg.asKind(SyntaxKind.StringLiteral)!.getLiteralValue()

        // Last argument is the router — could be variable or import
        const lastArg = args[args.length - 1]
        const routerVar = lastArg.getText()

        // Try to resolve where this router is defined
        const resolvedFile = this.resolveImportedRouter(routerVar, sourceFile, projectPath)

        mounts.push({
          prefix,
          routerVariable: routerVar,
          sourceFile: resolvedFile || relative(projectPath, sourceFile.getFilePath()),
        })
      }
    }

    return mounts
  }

  /**
   * Resolve imported router variable to its source file
   */
  private resolveImportedRouter(
    varName: string,
    sourceFile: SourceFile,
    projectPath: string,
  ): string | null {
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const namedImports = importDecl.getNamedImports()
      const defaultImport = importDecl.getDefaultImport()

      const matchesNamed = namedImports.some((n) => n.getName() === varName)
      const matchesDefault = defaultImport?.getText() === varName

      if (matchesNamed || matchesDefault) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue()
        // Resolve relative import to file path
        const sourceDir = dirname(sourceFile.getFilePath())
        const resolvedPath = join(sourceDir, moduleSpecifier)

        // Try .ts extension
        for (const ext of ['.ts', '.js', '/index.ts', '/index.js']) {
          const fullPath = resolvedPath + ext
          if (existsSync(fullPath)) {
            return relative(projectPath, fullPath)
          }
        }

        return relative(projectPath, resolvedPath)
      }
    }
    return null
  }

  /**
   * Find route registrations: router.get('/path', handler), app.post('/path', handler), etc.
   */
  private findRouteRegistrations(
    sourceFile: SourceFile,
    _projectPath: string,
  ): RouteRegistration[] {
    const registrations: RouteRegistration[] = []

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = callExpr.getExpression()
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) continue

      const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression)!
      const methodName = propAccess.getName().toLowerCase()

      if (!HTTP_METHODS.includes(methodName as ExpressHttpMethod)) continue

      const args = callExpr.getArguments()
      if (args.length < 2) continue

      const firstArg = args[0]
      if (firstArg.getKind() !== SyntaxKind.StringLiteral) continue

      const path = firstArg.asKind(SyntaxKind.StringLiteral)!.getLiteralValue()

      // Collect middleware names (everything between path and last handler)
      const middlewares: string[] = []
      const lastArg = args[args.length - 1]

      for (let i = 1; i < args.length - 1; i++) {
        middlewares.push(args[i].getText())
      }

      // Handler name from last argument
      const handlerName = this.extractHandlerName(lastArg)

      registrations.push({
        method: METHOD_MAP[methodName as ExpressHttpMethod],
        path,
        handlerName,
        sourceLine: callExpr.getStartLineNumber(),
        sourceFile: sourceFile.getFilePath(),
        middlewares,
        callExpression: callExpr,
      })
    }

    return registrations
  }

  /**
   * Extract handler name from the last argument of a route registration
   */
  private extractHandlerName(node: Node): string {
    // Direct identifier: router.get('/path', listUsers)
    if (node.getKind() === SyntaxKind.Identifier) {
      return node.getText()
    }

    // Property access: router.get('/path', controller.listUsers)
    if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = node.asKind(SyntaxKind.PropertyAccessExpression)!
      return propAccess.getName()
    }

    // Arrow function or function expression — try to derive name from path
    if (
      node.getKind() === SyntaxKind.ArrowFunction ||
      node.getKind() === SyntaxKind.FunctionExpression
    ) {
      return 'handler'
    }

    // Call expression: router.get('/path', validate(schema), handler)
    if (node.getKind() === SyntaxKind.CallExpression) {
      const callExpr = node.asKind(SyntaxKind.CallExpression)!
      return callExpr.getExpression().getText()
    }

    return node.getText()
  }

  /**
   * Resolve the mount prefix for a given source file
   */
  private resolvePrefix(
    sourceFile: SourceFile,
    mounts: RouterMount[],
    projectPath: string,
  ): string {
    const relPath = relative(projectPath, sourceFile.getFilePath())

    for (const mount of mounts) {
      if (mount.sourceFile === relPath) {
        return mount.prefix
      }
    }

    return ''
  }

  /**
   * Try to resolve body type for a route — strategy: zod > typescript type > nothing
   */
  private resolveBody(
    reg: RouteRegistration,
    sourceFile: SourceFile,
    project: Project,
    projectPath: string,
  ): RequestBody | null {
    // GET and DELETE typically don't have bodies
    if (reg.method === 'GET' || reg.method === 'DELETE') return null

    // Strategy 1: Zod schema in middleware — validate(schema)
    for (const mw of reg.middlewares) {
      const zodBody = this.resolveZodFromMiddleware(mw, sourceFile, project, projectPath)
      if (zodBody) return zodBody
    }

    // Strategy 2: TypeScript type annotation on req.body
    const typedBody = this.resolveTypedBody(reg, sourceFile, project, projectPath)
    if (typedBody) return typedBody

    return null
  }

  /**
   * Try to resolve body from a validation middleware referencing a zod schema
   * Pattern: validate(createUserSchema) → find createUserSchema → extract shape
   */
  private resolveZodFromMiddleware(
    middlewareText: string,
    sourceFile: SourceFile,
    project: Project,
    projectPath: string,
  ): RequestBody | null {
    // Match: validate(schemaName) or validateBody(schemaName)
    const match = middlewareText.match(/(?:validate|validateBody)\((\w+)\)/)
    if (!match) return null

    const schemaName = match[1]

    // Find the schema definition — could be in this file or imported
    const schemaType = this.resolveSchemaVariable(schemaName, sourceFile, project)
    if (!schemaType) return null

    const fields = this.extractZodFields(schemaType, sourceFile, project, projectPath)
    if (fields.length === 0) return null

    const schemaSource = this.findSchemaSource(schemaName, sourceFile, projectPath)

    return {
      fields,
      rawType: schemaName,
      source: schemaSource,
    }
  }

  /**
   * Resolve a schema variable to its type — either local or imported
   */
  private resolveSchemaVariable(
    name: string,
    sourceFile: SourceFile,
    project: Project,
  ): Type | null {
    // Check local variable
    const localVar = sourceFile.getVariableDeclaration(name)
    if (localVar) {
      return localVar.getType()
    }

    // Check imports
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const namedImport = importDecl.getNamedImports().find((n) => n.getName() === name)
      if (!namedImport) continue

      const moduleSpecifier = importDecl.getModuleSpecifierValue()
      const sourceDir = dirname(sourceFile.getFilePath())

      // Resolve to actual file
      for (const ext of ['.ts', '.js']) {
        const fullPath = join(sourceDir, moduleSpecifier + ext)
        const targetFile = project.getSourceFile(fullPath)
        if (targetFile) {
          const varDecl = targetFile.getVariableDeclaration(name)
          if (varDecl) return varDecl.getType()
        }
      }
    }

    return null
  }

  /**
   * Extract fields from a Zod schema type
   * Zod objects have a .shape property with individual ZodType fields
   */
  private extractZodFields(
    schemaType: Type,
    _sourceFile: SourceFile,
    _project: Project,
    _projectPath: string,
  ): BodyField[] {
    const fields: BodyField[] = []

    // Try to get the inferred output type of the zod schema
    // Zod schemas have _output type which represents the parsed type
    const outputProp = schemaType.getProperty('_output')
    if (!outputProp) return fields

    const declarations = outputProp.getDeclarations()
    if (declarations.length === 0) return fields

    const outputType = outputProp.getTypeAtLocation(declarations[0])
    return this.extractFieldsFromObjectType(outputType)
  }

  /**
   * Extract fields from a TypeScript object type
   */
  private extractFieldsFromObjectType(type: Type): BodyField[] {
    const fields: BodyField[] = []

    for (const prop of type.getProperties()) {
      const declarations = prop.getDeclarations()
      if (declarations.length === 0) continue

      const propType = prop.getTypeAtLocation(declarations[0])
      // A field is optional if it has ? modifier OR its type includes undefined (zod .optional())
      const isOptional = prop.isOptional() || propType.isUnion() && propType.getUnionTypes().some((t) => t.isUndefined())

      // Get the simplified type, filtering out undefined from unions
      const cleanType = this.simplifyType(propType)

      fields.push({
        name: prop.getName(),
        type: cleanType,
        required: !isOptional,
      })
    }

    return fields
  }

  /**
   * Try to resolve body type from TypeScript type annotations
   * Pattern: (req: Request<P, ResBody, ReqBody>, res) => ...
   * Or: req.body as CreateUserBody
   */
  private resolveTypedBody(
    reg: RouteRegistration,
    sourceFile: SourceFile,
    _project: Project,
    _projectPath: string,
  ): RequestBody | null {
    const lastArg = reg.callExpression.getArguments().at(-1)
    if (!lastArg) return null

    // Check if handler is an arrow function or function expression with typed req param
    if (
      lastArg.getKind() === SyntaxKind.ArrowFunction ||
      lastArg.getKind() === SyntaxKind.FunctionExpression
    ) {
      const fn =
        lastArg.asKind(SyntaxKind.ArrowFunction) ?? lastArg.asKind(SyntaxKind.FunctionExpression)
      if (!fn) return null

      const params = fn.getParameters()
      if (params.length === 0) return null

      const reqParam = params[0]
      const reqType = reqParam.getType()

      // Check for Request<Params, ResBody, ReqBody> generic
      const typeArgs = reqType.getTypeArguments()
      if (typeArgs.length >= 3) {
        const bodyType = typeArgs[2]
        if (bodyType.isObject() && !this.isPrimitive(bodyType.getText())) {
          const fields = this.extractFieldsFromObjectType(bodyType)
          if (fields.length > 0) {
            return {
              fields,
              rawType: this.cleanTypeName(bodyType.getText()),
              source: relative(
                dirname(sourceFile.getFilePath()),
                sourceFile.getFilePath(),
              ),
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Find the source file of a schema variable
   */
  private findSchemaSource(
    name: string,
    sourceFile: SourceFile,
    projectPath: string,
  ): string {
    // Check if it's defined locally
    if (sourceFile.getVariableDeclaration(name)) {
      return relative(projectPath, sourceFile.getFilePath())
    }

    // Check imports
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const namedImport = importDecl.getNamedImports().find((n) => n.getName() === name)
      if (namedImport) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue()
        const sourceDir = dirname(sourceFile.getFilePath())
        const resolvedPath = join(sourceDir, moduleSpecifier)

        for (const ext of ['.ts', '.js']) {
          const fullPath = resolvedPath + ext
          if (existsSync(fullPath)) {
            return relative(projectPath, fullPath)
          }
        }

        return relative(projectPath, resolvedPath)
      }
    }

    return ''
  }

  /**
   * Detect auth middleware in the middleware chain
   */
  private detectAuthMiddleware(middlewares: string[]): boolean {
    const authPatterns = [
      'auth',
      'authenticate',
      'requireAuth',
      'protect',
      'passport',
      'jwt',
      'verifyToken',
      'isAuthenticated',
      'ensureAuthenticated',
      'requireLogin',
    ]

    for (const mw of middlewares) {
      const mwLower = mw.toLowerCase()
      if (authPatterns.some((p) => mwLower.includes(p.toLowerCase()))) {
        return true
      }
    }

    return false
  }

  /**
   * Extract path params from Express route path
   * e.g., '/users/:id/posts/:postId' -> [{name: 'id'}, {name: 'postId'}]
   */
  private extractPathParams(path: string): RouteParam[] {
    const params: RouteParam[] = []
    const regex = /:(\w+)/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(path)) !== null) {
      params.push({
        name: match[1],
        type: 'string',
        required: true,
      })
    }

    return params
  }

  /**
   * Derive a group name from the source file
   * e.g., 'src/routes/users.ts' -> 'users'
   */
  private resolveGroupName(sourceFile: SourceFile, projectPath: string): string {
    const relPath = relative(projectPath, sourceFile.getFilePath())
    const fileName = basename(relPath, '.ts')

    // Check if there's a class in the file
    const classes = sourceFile.getClasses()
    if (classes.length > 0) {
      return classes[0].getName() ?? fileName
    }

    return fileName
  }

  private simplifyType(type: Type): string {
    if (type.isString() || type.getText() === 'string') return 'string'
    if (type.isNumber() || type.getText() === 'number') return 'number'
    if (type.isBoolean() || type.getText() === 'boolean') return 'boolean'

    if (type.isArray()) {
      const el = type.getArrayElementType()
      if (el) return `${this.simplifyType(el)}[]`
      return 'array'
    }

    if (type.isUnion()) {
      const types = type.getUnionTypes().filter((t) => !t.isUndefined() && !t.isNull())
      if (types.length === 1) return this.simplifyType(types[0])
      return types.map((t) => this.simplifyType(t)).join(' | ')
    }

    return this.cleanTypeName(type.getText())
  }

  private cleanTypeName(text: string): string {
    return text.replace(/import\([^)]+\)\./g, '')
  }

  private isPrimitive(type: string): boolean {
    return ['string', 'number', 'boolean', 'any', 'unknown', 'void', 'never'].includes(type)
  }
}
