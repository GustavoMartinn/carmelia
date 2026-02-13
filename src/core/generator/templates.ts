import type { ScannedRoute, BodyField, RouteParam } from '../scanner/types.js'

/**
 * Generate the full .http file content for a route
 */
export function renderHttpFile(route: ScannedRoute, includeComments: boolean): string {
  const lines: string[] = []

  // Comments with source info
  if (includeComments) {
    lines.push(`# Auto-generated from ${route.groupName}.${route.handlerName}()`)
    lines.push(`# Source: ${route.sourceFile}:${route.sourceLine}`)
    if (route.body) {
      lines.push(`# Body: ${route.body.rawType}`)
    }
    if (route.description) {
      lines.push(`# ${route.description}`)
    }
    lines.push('')
  }

  // Request line: METHOD {{base_url}}/path
  const url = renderUrl(route)
  lines.push(`${route.method} ${url}`)

  // Headers
  if (route.method !== 'GET' && route.method !== 'DELETE' && route.body) {
    lines.push('Content-Type: application/json')
  }
  if (route.auth) {
    lines.push(renderAuthHeader(route.auth.type))
  }
  for (const header of route.headers) {
    lines.push(`${header.name}: ${header.value ?? `{{${header.name.toLowerCase().replace(/-/g, '_')}}}`}`)
  }

  // Body
  if (route.body && route.body.fields.length > 0) {
    lines.push('')
    lines.push(renderBody(route.body.fields, 0))
  }

  // Ensure trailing newline
  lines.push('')

  return lines.join('\n')
}

/**
 * Render the URL with {{base_url}} and path params as {{variables}}
 */
function renderUrl(route: ScannedRoute): string {
  let path = route.fullPath

  // Replace :param (Express/NestJS) or {param} (Go/chi) with {{param}}
  // Only one style will be present per path, but avoid double-processing
  if (path.includes(':')) {
    path = path.replace(/:(\w+)/g, '{{$1}}')
  } else {
    path = path.replace(/\{(\w+)\}/g, '{{$1}}')
  }

  // Add query params
  const queryString = renderQueryParams(route.queryParams)

  return `{{base_url}}${path}${queryString}`
}

/**
 * Render query params as ?key={{key}}&key2={{key2}}
 */
function renderQueryParams(params: RouteParam[]): string {
  if (params.length === 0) return ''

  const parts = params.map((p) => `${p.name}={{${p.name}}}`)
  return `?${parts.join('&')}`
}

/**
 * Render auth header based on type
 */
function renderAuthHeader(type: string): string {
  switch (type) {
    case 'bearer':
      return 'Authorization: Bearer {{token}}'
    case 'basic':
      return 'Authorization: Basic {{credentials}}'
    case 'api-key':
      return 'X-API-Key: {{api_key}}'
    default:
      return 'Authorization: {{auth}}'
  }
}

/**
 * Render the JSON body with typed placeholders
 */
function renderBody(fields: BodyField[], indent: number): string {
  const pad = '  '.repeat(indent)
  const innerPad = '  '.repeat(indent + 1)
  const lines: string[] = []

  lines.push(`${pad}{`)

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    const isLast = i === fields.length - 1
    const comma = isLast ? '' : ','
    const name = field.jsonName ?? field.name

    if (Array.isArray(field.type)) {
      // Nested object
      lines.push(`${innerPad}"${name}": ${renderBody(field.type, indent + 1).trimStart()}${comma}`)
    } else {
      const value = renderFieldValue(field)
      lines.push(`${innerPad}"${name}": ${value}${comma}`)
    }
  }

  lines.push(`${pad}}`)
  return lines.join('\n')
}

/**
 * Render a typed placeholder value for a field
 */
function renderFieldValue(field: BodyField): string {
  // If there's an enum, show the options
  if (field.enum && field.enum.length > 0) {
    return `"${field.enum.join(' | ')}"`
  }

  const type = typeof field.type === 'string' ? field.type : 'object'

  // Handle array types
  if (type.endsWith('[]')) {
    const innerType = type.slice(0, -2)
    const innerValue = renderPrimitiveValue(innerType)
    return `[${innerValue}]`
  }

  return renderPrimitiveValue(type)
}

/**
 * Render a placeholder value for a primitive type
 */
function renderPrimitiveValue(type: string): string {
  switch (type) {
    case 'string':
      return '"string"'
    case 'number':
    case 'integer':
      return '0'
    case 'boolean':
      return 'false'
    case 'any':
      return 'null'
    default:
      // Union types like "admin | user"
      if (type.includes(' | ')) {
        return `"${type}"`
      }
      return '"string"'
  }
}
