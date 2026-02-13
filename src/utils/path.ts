import { resolve } from 'node:path'

/**
 * Join URL path segments, handling slashes correctly
 */
export function joinPaths(...segments: (string | undefined)[]): string {
  const parts = segments
    .filter((s): s is string => s !== undefined && s !== '')
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .filter((s) => s !== '')

  return '/' + parts.join('/')
}

/**
 * Resolve a project path to an absolute path
 */
export function resolveProjectPath(projectPath: string): string {
  return resolve(projectPath)
}

/**
 * Convert a handler name to a kebab-case filename
 * e.g., "createUser" -> "create-user", "GetUserByID" -> "get-user-by-id"
 */
export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * Generate a filename for a request file
 * e.g., "createUser" -> "create-user.http"
 */
export function requestFileName(handlerName: string): string {
  return `${toKebabCase(handlerName)}.http`
}
