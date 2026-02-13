import type { ScannedRoute } from '../scanner/types.js'

/**
 * Convert a string to kebab-case
 * e.g., "CreateUser" -> "create-user", "listUsers" -> "list-users"
 */
export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * Generate a directory name from a group name
 * e.g., "UsersController" -> "users", "auth" -> "auth"
 */
export function groupDirName(groupName: string): string {
  return toKebabCase(
    groupName
      .replace(/Controller$/i, '')
      .replace(/Handler$/i, '')
      .replace(/Router$/i, '')
      .replace(/Routes$/i, ''),
  )
}

/**
 * Generate a file name for a request
 * e.g., { method: "POST", handlerName: "createUser" } -> "create-user.http"
 */
export function requestFileName(route: ScannedRoute): string {
  return `${toKebabCase(route.handlerName)}.http`
}
