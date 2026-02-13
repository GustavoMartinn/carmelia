import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
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
import { joinPaths } from '../../../utils/path.js'
import { logger } from '../../../utils/logger.js'

type GoRouter = 'chi' | 'gin' | 'fiber' | 'echo' | 'net/http'

interface GoStruct {
  name: string
  fields: GoStructField[]
  sourceFile: string
}

interface GoStructField {
  name: string
  goType: string
  jsonTag?: string
  validateTag?: string
  omitempty: boolean
}

interface GoRouteGroup {
  prefix: string
  routes: GoRouteRegistration[]
  middleware: string[]
}

interface GoRouteRegistration {
  method: HttpMethod
  path: string
  handlerName: string
  line: number
  sourceFile: string
}

// Route registration patterns per router
const CHI_ROUTE_RE = /\.\s*(Get|Post|Put|Delete|Patch)\s*\(\s*"([^"]*)"(?:\s*,\s*(\w[\w.]*))/g
const CHI_GROUP_RE = /\.Route\s*\(\s*"([^"]*)"(?:\s*,\s*func\s*\(\s*(\w+)\s+chi\.Router\s*\))/g
const CHI_USE_RE = /\.Use\s*\(\s*(\w[\w.]*)/g

const GIN_ROUTE_RE = /\.\s*(GET|POST|PUT|DELETE|PATCH)\s*\(\s*"([^"]*)"(?:\s*,\s*(\w[\w.]*))/g
const GIN_GROUP_RE = /\.Group\s*\(\s*"([^"]*)"\s*\)/g

const FIBER_ROUTE_RE = /\.\s*(Get|Post|Put|Delete|Patch)\s*\(\s*"([^"]*)"(?:\s*,\s*(\w[\w.]*))/g

const NET_HTTP_ROUTE_RE = /(?:HandleFunc|Handle)\s*\(\s*"(?:(GET|POST|PUT|DELETE|PATCH)\s+)?([^"]*)"(?:\s*,\s*(\w[\w.]*))/g

// Body decoding patterns — what struct is decoded into
const JSON_DECODE_RE = /json\.NewDecoder\s*\([^)]*\)\.Decode\s*\(\s*&(\w+)/g
const BIND_JSON_RE = /\.(?:ShouldBindJSON|BindJSON|ShouldBind)\s*\(\s*&(\w+)/g
const BODY_PARSER_RE = /\.BodyParser\s*\(\s*&(\w+)/g
const ECHO_BIND_RE = /\.Bind\s*\(\s*&(\w+)/g

// Struct definition
const STRUCT_RE = /type\s+(\w+)\s+struct\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g

// Struct field: Name Type `tags`
const STRUCT_FIELD_RE = /^\s*(\w+)\s+([\w.*\[\]]+)\s*(?:`([^`]*)`)?/gm

export class GoParser implements FrameworkParser {
  name = 'go' as const
  language = 'go' as const

  async detect(projectPath: string): Promise<boolean> {
    return existsSync(join(projectPath, 'go.mod'))
  }

  async scan(projectPath: string, options?: ScanOptions): Promise<ScannedRoute[]> {
    const router = await this.detectRouter(projectPath)
    const goFiles = await this.findGoFiles(projectPath, options)

    logger.info(`Found ${goFiles.length} .go files to scan`)

    // Read all files once into cache
    const fileCache = new Map<string, string>()
    for (const file of goFiles) {
      const content = await readFile(file, 'utf-8')
      fileCache.set(file, content)
    }

    // Phase 1: Parse all structs across all files
    const structs = new Map<string, GoStruct>()
    for (const file of goFiles) {
      const content = fileCache.get(file)!
      const relPath = relative(projectPath, file)
      for (const s of this.parseStructs(content, relPath)) {
        structs.set(s.name, s)
      }
    }
    logger.info(`Phase 1 complete: found ${structs.size} structs`)

    // Build handler→struct map once from all files
    const handlerStructMap = new Map<string, string>()
    for (const file of goFiles) {
      const content = fileCache.get(file)!
      this.mapHandlersToStructs(content, handlerStructMap)
    }
    logger.info(`Handler→struct mapping complete: ${handlerStructMap.size} mappings`)

    // Phase 2: Find route registrations
    const routes: ScannedRoute[] = []

    for (const file of goFiles) {
      const content = fileCache.get(file)!
      const relPath = relative(projectPath, file)

      // Find route groups (chi r.Route, gin r.Group)
      const groups = this.parseRouteGroups(content, router)

      // Find standalone routes
      const registrations = this.parseRouteRegistrations(content, router, relPath)

      // Build routes from standalone registrations
      for (const reg of registrations) {
        const route = this.buildRoute(reg, '', groups, handlerStructMap, structs, content, relPath)
        routes.push(route)
      }

      // Build routes from groups
      for (const group of groups) {
        for (const reg of group.routes) {
          const hasAuth = this.groupHasAuth(group)
          const route = this.buildRoute(reg, group.prefix, groups, handlerStructMap, structs, content, relPath)
          if (hasAuth && !route.auth) {
            route.auth = { type: 'bearer' }
          }
          routes.push(route)
        }
      }
    }

    logger.info(`Phase 2 complete: found ${routes.length} routes`)
    return routes
  }

  async diff(_projectPath: string, _previousScan: ScannedRoute[]): Promise<ScanDiff> {
    return { added: [], removed: [], modified: [], unchanged: [] }
  }

  private async detectRouter(projectPath: string): Promise<GoRouter> {
    const goModPath = join(projectPath, 'go.mod')
    if (!existsSync(goModPath)) return 'net/http'

    const content = await readFile(goModPath, 'utf-8')

    if (content.includes('github.com/go-chi/chi')) return 'chi'
    if (content.includes('github.com/gin-gonic/gin')) return 'gin'
    if (content.includes('github.com/gofiber/fiber')) return 'fiber'
    if (content.includes('github.com/labstack/echo')) return 'echo'

    return 'net/http'
  }

  private async findGoFiles(projectPath: string, options?: ScanOptions): Promise<string[]> {
    const excludePatterns = options?.exclude ?? ['*_test.go', 'vendor']
    const files: string[] = []

    const walk = async (dir: string): Promise<void> => {
      if (!existsSync(dir)) return
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
          if (entry.name === 'vendor' || entry.name === 'node_modules' || entry.name === '.git') continue
          if (excludePatterns.some((p) => entry.name === p)) continue
          await walk(fullPath)
        } else if (entry.name.endsWith('.go')) {
          const isExcluded = excludePatterns.some((p) => {
            if (p.startsWith('*')) return entry.name.endsWith(p.slice(1))
            return entry.name === p
          })
          if (!isExcluded) files.push(fullPath)
        }
      }
    }

    await walk(projectPath)
    return files
  }

  private parseStructs(content: string, sourceFile: string): GoStruct[] {
    const structs: GoStruct[] = []

    let match: RegExpExecArray | null
    const re = new RegExp(STRUCT_RE.source, STRUCT_RE.flags)

    while ((match = re.exec(content)) !== null) {
      const name = match[1]
      const body = match[2]
      const fields = this.parseStructFields(body)

      structs.push({ name, fields, sourceFile })
    }

    return structs
  }

  private parseStructFields(body: string): GoStructField[] {
    const fields: GoStructField[] = []
    const re = new RegExp(STRUCT_FIELD_RE.source, STRUCT_FIELD_RE.flags)

    let match: RegExpExecArray | null
    while ((match = re.exec(body)) !== null) {
      const name = match[1]
      const goType = match[2]
      const tags = match[3] || ''

      // Skip embedded structs (capitalized single word without type)
      if (!goType) continue

      const jsonTag = this.extractTag(tags, 'json')
      const validateTag = this.extractTag(tags, 'validate')

      // Parse json tag: "name,omitempty" or "name" or "-"
      let jsonName: string | undefined
      let omitempty = false
      if (jsonTag) {
        const parts = jsonTag.split(',')
        jsonName = parts[0] === '-' ? undefined : parts[0]
        omitempty = parts.includes('omitempty')
      }

      if (jsonTag === '-') continue // skip fields with json:"-"

      fields.push({
        name,
        goType,
        jsonTag: jsonName || name.charAt(0).toLowerCase() + name.slice(1),
        validateTag: validateTag || undefined,
        omitempty,
      })
    }

    return fields
  }

  private extractTag(tags: string, tagName: string): string | undefined {
    const re = new RegExp(`${tagName}:"([^"]*)"`)
    const match = tags.match(re)
    return match?.[1]
  }

  private parseRouteGroups(content: string, router: GoRouter): GoRouteGroup[] {
    const groups: GoRouteGroup[] = []

    if (router === 'chi') {
      // Find r.Route("/prefix", func(r chi.Router) { ... })
      // We need to match the entire block, so use a different approach
      const groupBlockRe = /\.Route\s*\(\s*"([^"]*)"(?:\s*,\s*func\s*\(\s*(\w+)\s+chi\.Router\s*\)\s*\{)([\s\S]*?)\n\s*\}\s*\)/g
      let match: RegExpExecArray | null

      while ((match = groupBlockRe.exec(content)) !== null) {
        const prefix = match[1]
        const routerVar = match[2]
        const body = match[3]

        const routes: GoRouteRegistration[] = []
        const middleware: string[] = []

        // Find routes inside the group body
        const routeRe = new RegExp(`${routerVar}\\s*\\.\\s*(Get|Post|Put|Delete|Patch)\\s*\\(\\s*"([^"]*)"(?:\\s*,\\s*(\\w[\\w.]*))`, 'g')
        let routeMatch: RegExpExecArray | null

        while ((routeMatch = routeRe.exec(body)) !== null) {
          const method = routeMatch[1].toUpperCase() as HttpMethod
          routes.push({
            method,
            path: routeMatch[2],
            handlerName: routeMatch[3],
            line: this.getLineNumber(content, match.index + match[0].indexOf(routeMatch[0])),
            sourceFile: '',
          })
        }

        // Find middleware: r.Use(middleware)
        const useRe = new RegExp(`${routerVar}\\s*\\.Use\\s*\\(\\s*(\\w[\\w.]*)`, 'g')
        let useMatch: RegExpExecArray | null
        while ((useMatch = useRe.exec(body)) !== null) {
          middleware.push(useMatch[1])
        }

        groups.push({ prefix, routes, middleware })
      }
    }

    if (router === 'gin') {
      // gin: g := r.Group("/prefix") followed by g.GET/POST etc.
      const groupRe = /(\w+)\s*:?=\s*\w+\.Group\s*\(\s*"([^"]*)"\s*\)/g
      let match: RegExpExecArray | null

      while ((match = groupRe.exec(content)) !== null) {
        const groupVar = match[1]
        const prefix = match[2]

        const routes: GoRouteRegistration[] = []
        const routeRe = new RegExp(`${groupVar}\\s*\\.\\s*(GET|POST|PUT|DELETE|PATCH)\\s*\\(\\s*"([^"]*)"(?:\\s*,\\s*(\\w[\\w.]*))`, 'g')

        let routeMatch: RegExpExecArray | null
        while ((routeMatch = routeRe.exec(content)) !== null) {
          routes.push({
            method: routeMatch[1] as HttpMethod,
            path: routeMatch[2],
            handlerName: routeMatch[3],
            line: this.getLineNumber(content, routeMatch.index),
            sourceFile: '',
          })
        }

        groups.push({ prefix, routes, middleware: [] })
      }
    }

    return groups
  }

  private parseRouteRegistrations(content: string, router: GoRouter, sourceFile: string): GoRouteRegistration[] {
    const registrations: GoRouteRegistration[] = []

    let re: RegExp
    switch (router) {
      case 'chi':
        re = new RegExp(CHI_ROUTE_RE.source, CHI_ROUTE_RE.flags)
        break
      case 'gin':
        re = new RegExp(GIN_ROUTE_RE.source, GIN_ROUTE_RE.flags)
        break
      case 'fiber':
        re = new RegExp(FIBER_ROUTE_RE.source, FIBER_ROUTE_RE.flags)
        break
      case 'echo':
        re = new RegExp(FIBER_ROUTE_RE.source, FIBER_ROUTE_RE.flags) // echo uses same pattern as fiber
        break
      default:
        re = new RegExp(NET_HTTP_ROUTE_RE.source, NET_HTTP_ROUTE_RE.flags)
        break
    }

    let match: RegExpExecArray | null
    while ((match = re.exec(content)) !== null) {
      let method: string
      let path: string
      let handler: string

      if (router === 'net/http') {
        // net/http: HandleFunc("GET /path", handler) or HandleFunc("/path", handler)
        method = match[1] || 'GET'
        path = match[2]
        handler = match[3]
      } else {
        method = match[1].toUpperCase()
        path = match[2]
        handler = match[3]
      }

      if (!handler) continue

      registrations.push({
        method: method as HttpMethod,
        path,
        handlerName: handler,
        line: this.getLineNumber(content, match.index),
        sourceFile,
      })
    }

    // Filter out routes that are already inside a group
    // (they would have been caught by parseRouteGroups)
    // Simple heuristic: check if the route is inside a Route() or Group() block
    return this.filterStandaloneRoutes(registrations, content, router)
  }

  private filterStandaloneRoutes(
    registrations: GoRouteRegistration[],
    content: string,
    router: GoRouter,
  ): GoRouteRegistration[] {
    if (router === 'chi') {
      // Find the ranges of Route() blocks
      const blockRanges: Array<[number, number]> = []
      const groupBlockRe = /\.Route\s*\(\s*"[^"]*"(?:\s*,\s*func\s*\(\s*\w+\s+chi\.Router\s*\)\s*\{)([\s\S]*?)\n\s*\}\s*\)/g
      let match: RegExpExecArray | null

      while ((match = groupBlockRe.exec(content)) !== null) {
        blockRanges.push([match.index, match.index + match[0].length])
      }

      if (blockRanges.length === 0) return registrations

      // Filter out routes whose line falls inside a group block
      return registrations.filter((reg) => {
        const lineOffset = this.getOffset(content, reg.line)
        return !blockRanges.some(([start, end]) => lineOffset >= start && lineOffset <= end)
      })
    }

    return registrations
  }

  private mapHandlersToStructs(content: string, map: Map<string, string>): void {
    // Find function definitions: func HandlerName(...) { ... json.Decode(&req) ... }
    // We look for func declarations and the struct they decode into

    const funcRe = /func\s+(?:\(\s*\w+\s+[^)]*\)\s+)?(\w+)\s*\([^)]*\)\s*(?:[^{]*)?\{([\s\S]*?)^\}/gm
    let funcMatch: RegExpExecArray | null

    while ((funcMatch = funcRe.exec(content)) !== null) {
      const funcName = funcMatch[1]
      const funcBody = funcMatch[2]

      // Look for struct decoding patterns in the function body
      const structName = this.findDecodedStruct(funcBody)
      if (structName) {
        map.set(funcName, structName)
      }
    }
  }

  private findDecodedStruct(funcBody: string): string | null {
    // Pattern: var req StructName / var req pkg.StructName / req := StructName{} / req := &pkg.StructName{}
    // Then Decode(&req)

    // Find variable declarations with struct type (supports package-qualified names like models.CreateUserRequest)
    const varDeclRe = /(?:var\s+(\w+)\s+([\w.]+)|(\w+)\s*:=\s*(?:&?([\w.]+)\s*\{|new\s*\(\s*([\w.]+)\s*\)))/g
    const varTypes = new Map<string, string>()

    let match: RegExpExecArray | null
    while ((match = varDeclRe.exec(funcBody)) !== null) {
      if (match[1] && match[2]) {
        // var req models.CreateUserRequest → extract just the type name (last part)
        const fullType = match[2]
        const typeName = fullType.includes('.') ? fullType.split('.').pop()! : fullType
        varTypes.set(match[1], typeName)
      } else if (match[3] && (match[4] || match[5])) {
        const fullType = match[4] || match[5]
        const typeName = fullType.includes('.') ? fullType.split('.').pop()! : fullType
        varTypes.set(match[3], typeName)
      }
    }

    // Find Decode/Bind calls
    for (const re of [JSON_DECODE_RE, BIND_JSON_RE, BODY_PARSER_RE, ECHO_BIND_RE]) {
      const regex = new RegExp(re.source, re.flags)
      let decodeMatch: RegExpExecArray | null
      while ((decodeMatch = regex.exec(funcBody)) !== null) {
        const varName = decodeMatch[1]
        const structType = varTypes.get(varName)
        if (structType) return structType
      }
    }

    return null
  }

  private buildRoute(
    reg: GoRouteRegistration,
    groupPrefix: string,
    _groups: GoRouteGroup[],
    handlerStructMap: Map<string, string>,
    structs: Map<string, GoStruct>,
    _content: string,
    sourceFile: string,
  ): ScannedRoute {
    const fullPath = joinPaths(groupPrefix, reg.path)
    const params = this.extractPathParams(reg.path)

    // Resolve handler name — could be "pkg.Handler" or just "Handler"
    const handlerSimpleName = reg.handlerName.includes('.')
      ? reg.handlerName.split('.').pop()!
      : reg.handlerName

    // Find body struct
    let body: RequestBody | undefined
    const structName = handlerStructMap.get(handlerSimpleName)
    if (structName && (reg.method === 'POST' || reg.method === 'PUT' || reg.method === 'PATCH')) {
      const goStruct = structs.get(structName)
      if (goStruct) {
        body = this.structToRequestBody(goStruct, structs)
      }
    }

    // Derive group name from handler or source file
    const groupName = this.deriveGroupName(handlerSimpleName, sourceFile)

    return {
      method: reg.method,
      path: reg.path || '/',
      fullPath,
      groupName,
      handlerName: handlerSimpleName,
      sourceFile: reg.sourceFile || sourceFile,
      sourceLine: reg.line,
      framework: 'go',
      params,
      queryParams: [],
      body,
      headers: [],
      auth: undefined,
    }
  }

  private structToRequestBody(goStruct: GoStruct, allStructs: Map<string, GoStruct>): RequestBody {
    const fields: BodyField[] = []

    for (const f of goStruct.fields) {
      const fieldType = this.goTypeToJsonType(f.goType)
      const validation = f.validateTag ? this.parseValidateTag(f.validateTag) : undefined

      // Check for nested struct
      let resolvedType: string | BodyField[] = fieldType
      const cleanType = f.goType.replace(/^\*/, '').replace(/^\[\]/, '')
      const nestedStruct = allStructs.get(cleanType)
      if (nestedStruct && !this.isGoPrimitive(cleanType)) {
        const nestedBody = this.structToRequestBody(nestedStruct, allStructs)
        resolvedType = nestedBody.fields
      }

      fields.push({
        name: f.jsonTag || f.name,
        type: resolvedType,
        required: !f.omitempty && (!validation || !validation.includes('optional')),
        validation,
      })
    }

    return {
      fields,
      rawType: goStruct.name,
      source: goStruct.sourceFile,
    }
  }

  private parseValidateTag(tag: string): string[] {
    // validate:"required,email,min=2"
    return tag.split(',').map((v) => v.trim()).filter(Boolean)
  }

  private goTypeToJsonType(goType: string): string {
    const clean = goType.replace(/^\*/, '') // remove pointer

    if (clean.startsWith('[]')) {
      const inner = clean.slice(2)
      return `${this.goTypeToJsonType(inner)}[]`
    }

    switch (clean) {
      case 'string': return 'string'
      case 'int': case 'int8': case 'int16': case 'int32': case 'int64':
      case 'uint': case 'uint8': case 'uint16': case 'uint32': case 'uint64':
      case 'float32': case 'float64':
        return 'number'
      case 'bool': return 'boolean'
      case 'time.Time': return 'string'
      case 'interface{}': case 'any': return 'any'
      default: return 'object'
    }
  }

  private isGoPrimitive(typeName: string): boolean {
    return [
      'string', 'int', 'int8', 'int16', 'int32', 'int64',
      'uint', 'uint8', 'uint16', 'uint32', 'uint64',
      'float32', 'float64', 'bool', 'byte', 'rune',
      'interface{}', 'any', 'time.Time',
    ].includes(typeName)
  }

  private extractPathParams(path: string): RouteParam[] {
    const params: RouteParam[] = []

    // chi/gin/fiber: /users/{id} or /users/:id
    const braceRe = /\{(\w+)\}/g
    const colonRe = /:(\w+)/g

    let match: RegExpExecArray | null
    while ((match = braceRe.exec(path)) !== null) {
      params.push({ name: match[1], type: 'string', required: true })
    }
    while ((match = colonRe.exec(path)) !== null) {
      params.push({ name: match[1], type: 'string', required: true })
    }

    return params
  }

  private deriveGroupName(handlerName: string, sourceFile: string): string {
    // Try to derive from handler name: CreateUser -> user, ListOrders -> orders
    const prefixes = ['Create', 'Get', 'List', 'Update', 'Delete', 'Handle', 'Do']
    for (const prefix of prefixes) {
      if (handlerName.startsWith(prefix)) {
        const rest = handlerName.slice(prefix.length)
        if (rest) return rest.toLowerCase()
      }
    }

    // Fallback: derive from file name
    const fileName = sourceFile.split('/').pop()?.replace('.go', '') ?? 'handlers'
    return fileName
  }

  private groupHasAuth(group: GoRouteGroup): boolean {
    const authPatterns = ['auth', 'jwt', 'token', 'protect', 'require']
    return group.middleware.some((mw) =>
      authPatterns.some((p) => mw.toLowerCase().includes(p)),
    )
  }

  private getLineNumber(content: string, offset: number): number {
    return content.slice(0, offset).split('\n').length
  }

  private getOffset(content: string, line: number): number {
    const lines = content.split('\n')
    let offset = 0
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1
    }
    return offset
  }
}
