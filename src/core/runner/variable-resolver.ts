import type { EnvVariables } from '../config/types.js'

export interface ResolveOptions {
  env: EnvVariables
  sets: Record<string, string>
}

/**
 * Resolve all variables in a string:
 * - {{var}} → value from env file
 * - ${ENV_VAR} → system environment variable
 * - --set overrides take priority over env file
 */
export function resolveVariables(text: string, options: ResolveOptions): string {
  let result = text

  // 1. Resolve {{var}} — check --set overrides first, then env file
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    if (varName in options.sets) return options.sets[varName]
    if (varName in options.env) return options.env[varName]
    return `{{${varName}}}`
  })

  // 2. Resolve ${ENV_VAR} — system environment variables
  result = result.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
    return process.env[varName] ?? `\${${varName}}`
  })

  return result
}

/**
 * Resolve variables in all parts of a parsed request
 */
export function resolveRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string | undefined,
  options: ResolveOptions,
): { method: string; url: string; headers: Record<string, string>; body?: string } {
  const resolvedUrl = resolveVariables(url, options)

  const resolvedHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    resolvedHeaders[key] = resolveVariables(value, options)
  }

  let resolvedBody: string | undefined
  if (body) {
    resolvedBody = resolveVariables(body, options)

    // Apply --set overrides to JSON body fields
    if (Object.keys(options.sets).length > 0 && resolvedBody.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(resolvedBody) as Record<string, unknown>
        for (const [key, value] of Object.entries(options.sets)) {
          if (key in parsed) {
            // Try to parse as number or boolean, otherwise use string
            parsed[key] = parseValue(value)
          }
        }
        resolvedBody = JSON.stringify(parsed, null, 2)
      } catch {
        // Body isn't valid JSON, leave it as-is
      }
    }
  }

  return { method, url: resolvedUrl, headers: resolvedHeaders, body: resolvedBody }
}

/**
 * Parse a CLI value to its appropriate type
 */
function parseValue(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  const num = Number(value)
  if (!isNaN(num) && value.trim() !== '') return num
  return value
}
