import { Project, type SourceFile, type ClassDeclaration, type MethodDeclaration, type Decorator, type Type, SyntaxKind } from 'ts-morph'
import { join } from 'node:path'
import type { FrameworkParser } from './base.js'
import type { ScannedRoute, ScanOptions, ScanDiff, HttpMethod, RequestBody, BodyField, RouteParam, AuthRequirement } from '../types.js'
import { hasDependency } from '../../../utils/file.js'
import { joinPaths } from '../../../utils/path.js'

const HTTP_DECORATORS = ['Get', 'Post', 'Put', 'Delete', 'Patch'] as const
type HttpDecoratorName = typeof HTTP_DECORATORS[number]

const HTTP_METHOD_MAP: Record<HttpDecoratorName, HttpMethod> = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Delete: 'DELETE',
  Patch: 'PATCH',
}

const VALIDATION_DECORATORS: Record<string, string> = {
  IsString: 'string',
  IsNumber: 'number',
  IsInt: 'integer',
  IsBoolean: 'boolean',
  IsEmail: 'email',
  IsUrl: 'url',
  IsUUID: 'uuid',
  IsDate: 'date',
  IsEnum: 'enum',
  IsArray: 'array',
  IsNotEmpty: 'not empty',
  MinLength: 'minLength',
  MaxLength: 'maxLength',
  Min: 'min',
  Max: 'max',
  IsOptional: 'optional',
  IsPositive: 'positive',
  IsNegative: 'negative',
  Matches: 'pattern',
}

export class NestJSParser implements FrameworkParser {
  name = 'nestjs' as const
  language = 'typescript' as const

  async detect(projectPath: string): Promise<boolean> {
    return hasDependency(projectPath, '@nestjs/core')
  }

  async scan(projectPath: string, options?: ScanOptions): Promise<ScannedRoute[]> {
    const project = new Project({
      tsConfigFilePath: join(projectPath, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    })

    // Add source files based on options or default patterns
    const includePatterns = options?.include ?? ['**/*.controller.ts']
    const excludePatterns = options?.exclude ?? ['**/*.spec.ts', '**/*.test.ts', '**/node_modules/**']

    for (const pattern of includePatterns) {
      project.addSourceFilesAtPaths(join(projectPath, pattern))
    }

    const routes: ScannedRoute[] = []

    for (const sourceFile of project.getSourceFiles()) {
      const filePath = sourceFile.getFilePath()
      const isExcluded = excludePatterns.some((p) => filePath.includes(p.replace(/\*/g, '')))
      if (isExcluded) continue

      routes.push(...this.scanSourceFile(sourceFile, projectPath))
    }

    return routes
  }

  async diff(_projectPath: string, _previousScan: ScannedRoute[]): Promise<ScanDiff> {
    // TODO: implement diff
    return { added: [], removed: [], modified: [], unchanged: [] }
  }

  private scanSourceFile(sourceFile: SourceFile, projectPath: string): ScannedRoute[] {
    const routes: ScannedRoute[] = []
    const relativePath = sourceFile.getFilePath().replace(projectPath, '').replace(/^\//, '')

    for (const cls of sourceFile.getClasses()) {
      const controllerDec = cls.getDecorator('Controller')
      if (!controllerDec) continue

      const prefix = this.extractDecoratorStringArg(controllerDec)
      const classAuth = this.detectAuth(cls)

      for (const method of cls.getMethods()) {
        const httpDec = this.findHttpDecorator(method)
        if (!httpDec) continue

        const { decorator, httpMethod } = httpDec
        const path = this.extractDecoratorStringArg(decorator)
        const fullPath = joinPaths(prefix, path)

        const params = this.extractParams(method)
        const queryParams = this.extractQueryParams(method)
        const body = this.extractBody(method, projectPath)
        const methodAuth = this.detectMethodAuth(method)
        const auth = methodAuth ?? classAuth

        routes.push({
          method: httpMethod,
          path: path || '/',
          fullPath,
          groupName: cls.getName() ?? 'UnknownController',
          handlerName: method.getName(),
          sourceFile: relativePath,
          sourceLine: method.getStartLineNumber(),
          framework: 'nestjs',
          params,
          queryParams,
          body: body ?? undefined,
          headers: [],
          auth,
          description: this.extractDescription(method),
        })
      }
    }

    return routes
  }

  private findHttpDecorator(method: MethodDeclaration): { decorator: Decorator; httpMethod: HttpMethod } | null {
    for (const name of HTTP_DECORATORS) {
      const dec = method.getDecorator(name)
      if (dec) {
        return { decorator: dec, httpMethod: HTTP_METHOD_MAP[name] }
      }
    }
    return null
  }

  private extractDecoratorStringArg(decorator: Decorator): string {
    const args = decorator.getArguments()
    if (args.length === 0) return ''

    const firstArg = args[0]
    const text = firstArg.getText()
    // Remove quotes: 'path' or "path" -> path
    return text.replace(/^['"`]|['"`]$/g, '')
  }

  private extractParams(method: MethodDeclaration): RouteParam[] {
    const params: RouteParam[] = []

    for (const param of method.getParameters()) {
      const paramDec = param.getDecorator('Param')
      if (!paramDec) continue

      const paramName = this.extractDecoratorStringArg(paramDec) || param.getName()
      const paramType = param.getType()

      params.push({
        name: paramName,
        type: this.simplifyType(paramType),
        required: true,
      })
    }

    return params
  }

  private extractQueryParams(method: MethodDeclaration): RouteParam[] {
    const params: RouteParam[] = []

    for (const param of method.getParameters()) {
      const queryDec = param.getDecorator('Query')
      if (!queryDec) continue

      const queryName = this.extractDecoratorStringArg(queryDec) || param.getName()
      const queryType = param.getType()

      params.push({
        name: queryName,
        type: this.simplifyType(queryType),
        required: !param.hasQuestionToken() && !param.hasInitializer(),
      })
    }

    return params
  }

  private extractBody(method: MethodDeclaration, projectPath: string): RequestBody | null {
    for (const param of method.getParameters()) {
      const bodyDec = param.getDecorator('Body')
      if (!bodyDec) continue

      const bodyType = param.getType()
      const typeText = bodyType.getText()

      // Skip if it's a primitive type (e.g., @Body('field') field: string)
      if (this.isPrimitive(typeText)) return null

      const fields = this.resolveTypeFields(bodyType, projectPath, 0, new Set())
      const sourceFile = this.findTypeSourceFile(bodyType, projectPath)

      return {
        fields,
        rawType: this.cleanTypeName(typeText),
        source: sourceFile,
      }
    }

    return null
  }

  private resolveTypeFields(type: Type, projectPath: string, depth = 0, visited = new Set<string>()): BodyField[] {
    const MAX_DEPTH = 5

    if (depth >= MAX_DEPTH) return []

    const typeKey = type.getText()
    if (visited.has(typeKey)) return []
    visited.add(typeKey)

    const fields: BodyField[] = []
    const properties = type.getProperties()

    for (const prop of properties) {
      const declarations = prop.getDeclarations()
      if (declarations.length === 0) continue

      const declaration = declarations[0]
      const propType = prop.getTypeAtLocation(declaration)
      const propName = prop.getName()

      // Check for decorators (class-validator) on the property
      const validation: string[] = []
      let enumValues: string[] | undefined
      let isOptional = false

      if (declaration.getKind() === SyntaxKind.PropertyDeclaration) {
        const propDecl = declaration.asKind(SyntaxKind.PropertyDeclaration)
        if (propDecl) {
          for (const dec of propDecl.getDecorators()) {
            const decName = dec.getName()
            if (decName === 'IsOptional') {
              isOptional = true
            }
            if (decName === 'IsEnum') {
              const enumArg = dec.getArguments()[0]
              if (enumArg) {
                enumValues = this.resolveEnum(enumArg.getType())
              }
            }
            const validationHint = VALIDATION_DECORATORS[decName]
            if (validationHint) {
              const args = dec.getArguments()
              if (args.length > 0 && !['IsEnum', 'IsOptional'].includes(decName)) {
                validation.push(`${validationHint}(${args.map((a) => a.getText()).join(', ')})`)
              } else if (!['IsEnum', 'IsOptional'].includes(decName)) {
                validation.push(validationHint)
              }
            }
          }

          // Check if property has ? modifier
          if (propDecl.hasQuestionToken()) {
            isOptional = true
          }
        }
      }

      const typeText = this.simplifyType(propType)

      // Check if it's a nested object type
      let fieldType: string | BodyField[]
      if (this.isObjectType(propType) && !this.isPrimitive(typeText) && !propType.isEnum()) {
        fieldType = this.resolveTypeFields(propType, projectPath, depth + 1, visited)
      } else {
        fieldType = typeText
      }

      fields.push({
        name: propName,
        type: fieldType,
        required: !isOptional,
        enum: enumValues,
        validation: validation.length > 0 ? validation : undefined,
      })
    }

    return fields
  }

  private resolveEnum(type: Type): string[] {
    if (type.isEnum()) {
      const enumDecl = type.getSymbol()?.getDeclarations()[0]
      if (enumDecl && enumDecl.getKind() === SyntaxKind.EnumDeclaration) {
        const enumDeclNode = enumDecl.asKind(SyntaxKind.EnumDeclaration)
        if (enumDeclNode) {
          return enumDeclNode.getMembers().map((m) => m.getName())
        }
      }
    }

    // Union type: 'admin' | 'user'
    if (type.isUnion()) {
      return type.getUnionTypes()
        .map((t) => t.getLiteralValue())
        .filter((v): v is string | number => v !== undefined)
        .map(String)
    }

    return []
  }

  private detectAuth(cls: ClassDeclaration): AuthRequirement | undefined {
    const guardsDecorator = cls.getDecorator('UseGuards')
    if (!guardsDecorator) return undefined

    return this.parseGuardDecorator(guardsDecorator)
  }

  private detectMethodAuth(method: MethodDeclaration): AuthRequirement | undefined {
    const guardsDecorator = method.getDecorator('UseGuards')
    if (!guardsDecorator) return undefined

    return this.parseGuardDecorator(guardsDecorator)
  }

  private parseGuardDecorator(decorator: Decorator): AuthRequirement {
    const args = decorator.getArguments()
    const guardName = args.length > 0 ? args[0].getText() : ''

    if (guardName.toLowerCase().includes('jwt') || guardName.toLowerCase().includes('bearer')) {
      return { type: 'bearer', description: guardName }
    }
    if (guardName.toLowerCase().includes('basic')) {
      return { type: 'basic', description: guardName }
    }
    if (guardName.toLowerCase().includes('apikey') || guardName.toLowerCase().includes('api-key')) {
      return { type: 'api-key', description: guardName }
    }

    return { type: 'bearer', description: guardName }
  }

  private extractDescription(method: MethodDeclaration): string | undefined {
    // Try @ApiOperation decorator
    const apiOpDec = method.getDecorator('ApiOperation')
    if (apiOpDec) {
      const args = apiOpDec.getArguments()
      if (args.length > 0) {
        // Extract summary from { summary: '...' }
        const text = args[0].getText()
        const match = text.match(/summary:\s*['"`]([^'"`]+)['"`]/)
        if (match) return match[1]
      }
    }

    // Try JSDoc
    const jsDocs = method.getJsDocs()
    if (jsDocs.length > 0) {
      return jsDocs[0].getDescription().trim()
    }

    return undefined
  }

  private simplifyType(type: Type): string {
    const text = type.getText()

    // Handle common TypeScript types
    if (type.isString() || text === 'string') return 'string'
    if (type.isNumber() || text === 'number') return 'number'
    if (type.isBoolean() || text === 'boolean') return 'boolean'
    if (text === 'Date' || text === 'Date') return 'string' // dates serialize to string in JSON

    // Handle arrays
    if (type.isArray()) {
      const elementType = type.getArrayElementType()
      if (elementType) {
        return `${this.simplifyType(elementType)}[]`
      }
      return 'array'
    }

    // Handle union types (e.g., 'admin' | 'user')
    if (type.isUnion()) {
      const types = type.getUnionTypes()
      // Filter out undefined/null for optional types
      const filtered = types.filter((t) => !t.isUndefined() && !t.isNull())
      if (filtered.length === 1) return this.simplifyType(filtered[0])
      if (filtered.every((t) => t.isStringLiteral())) {
        return filtered.map((t) => String(t.getLiteralValue())).join(' | ')
      }
      return filtered.map((t) => this.simplifyType(t)).join(' | ')
    }

    // Handle enum
    if (type.isEnum()) {
      return 'string'
    }

    // Clean up module paths from type text
    return this.cleanTypeName(text)
  }

  private cleanTypeName(text: string): string {
    // Remove import(...) paths: import("/path/to/file").TypeName -> TypeName
    return text.replace(/import\([^)]+\)\./g, '')
  }

  private isPrimitive(type: string): boolean {
    return ['string', 'number', 'boolean', 'any', 'unknown', 'void', 'never', 'undefined', 'null'].includes(type)
  }

  private isObjectType(type: Type): boolean {
    return type.isObject() && !type.isArray() && !type.isString() && !type.isNumber() && !type.isBoolean()
  }

  private findTypeSourceFile(type: Type, projectPath: string): string {
    const symbol = type.getSymbol() ?? type.getAliasSymbol()
    if (!symbol) return ''

    const declarations = symbol.getDeclarations()
    if (declarations.length === 0) return ''

    const filePath = declarations[0].getSourceFile().getFilePath()
    return filePath.replace(projectPath, '').replace(/^\//, '')
  }
}
