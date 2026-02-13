export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export type FrameworkType = 'nestjs' | 'express' | 'go' | 'openapi'

export interface ScannedRoute {
  method: HttpMethod
  path: string
  fullPath: string
  groupName: string
  handlerName: string
  sourceFile: string
  sourceLine: number
  framework: FrameworkType
  params: RouteParam[]
  queryParams: RouteParam[]
  body?: RequestBody
  headers: RequiredHeader[]
  auth?: AuthRequirement
  description?: string
}

export interface RouteParam {
  name: string
  type: string
  required: boolean
  description?: string
}

export interface RequestBody {
  fields: BodyField[]
  rawType: string
  source: string
}

export interface BodyField {
  name: string
  jsonName?: string
  type: string | BodyField[]
  required: boolean
  default?: unknown
  enum?: string[]
  example?: unknown
  validation?: string[]
}

export interface RequiredHeader {
  name: string
  value?: string
  description?: string
}

export interface AuthRequirement {
  type: 'bearer' | 'basic' | 'api-key' | 'custom'
  headerName?: string
  description?: string
}

export interface ScanOptions {
  include?: string[]
  exclude?: string[]
  followImports?: boolean
}

export interface ScanDiff {
  added: ScannedRoute[]
  removed: ScannedRoute[]
  modified: Array<{
    before: ScannedRoute
    after: ScannedRoute
  }>
  unchanged: ScannedRoute[]
}
