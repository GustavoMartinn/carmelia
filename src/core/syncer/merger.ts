import { readFile, writeFile } from 'node:fs/promises'
import type { ScannedRoute, BodyField } from '../scanner/types.js'
import type { HttxConfig } from '../config/types.js'
import { renderHttpFile } from '../generator/templates.js'
import { parseHttpFile } from '../runner/http-parser.js'

/**
 * Merge a modified route into an existing .http file,
 * preserving user-customized values
 */
export async function mergeRoute(
  route: ScannedRoute,
  existingFilePath: string,
  config: HttxConfig,
): Promise<string> {
  const existingContent = await readFile(existingFilePath, 'utf-8')
  const parsed = parseHttpFile(existingContent)

  // Extract user-customized body values from the existing file
  const customValues = extractCustomValues(parsed.body)

  // Generate new content
  let newContent = renderHttpFile(route, config.generator.includeComments)

  // Restore user-customized values in the new body
  if (customValues.size > 0 && route.body) {
    newContent = restoreCustomValues(newContent, customValues)
  }

  return newContent
}

/**
 * Mark an .http file as deprecated (route no longer exists in source)
 */
export async function markDeprecated(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8')

  // Don't add duplicate deprecation markers
  if (content.includes('# DEPRECATED')) {
    return content
  }

  const deprecatedHeader = `# DEPRECATED — This route was removed from the source code\n# You can safely delete this file if it's no longer needed\n\n`
  const newContent = deprecatedHeader + content

  return newContent
}

/**
 * Extract user-customized values from an existing JSON body.
 * A value is "customized" if it differs from the typed placeholder.
 */
function extractCustomValues(body: string | undefined): Map<string, string> {
  const values = new Map<string, string>()
  if (!body) return values

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    for (const [key, value] of Object.entries(parsed)) {
      const strValue = JSON.stringify(value)
      // Skip typed placeholders — these are defaults, not user values
      if (isPlaceholder(value)) continue
      values.set(key, strValue)
    }
  } catch {
    // Not valid JSON, nothing to extract
  }

  return values
}

/**
 * Check if a value is a typed placeholder (not a user-customized value)
 */
function isPlaceholder(value: unknown): boolean {
  if (value === 'string') return true
  if (value === 0) return true
  if (value === false) return true
  if (value === null) return true
  if (typeof value === 'string') {
    // Enum placeholders like "ADMIN | USER"
    if (value.includes(' | ')) return true
    // Template variables
    if (value.startsWith('{{') && value.endsWith('}}')) return true
  }
  return false
}

/**
 * Restore user-customized values into a freshly generated .http file body
 */
function restoreCustomValues(content: string, customValues: Map<string, string>): string {
  for (const [key, value] of customValues) {
    // Replace the placeholder value for this key
    // Match: "key": <placeholder>
    const re = new RegExp(`("${escapeRegex(key)}"\\s*:\\s*)(?:"[^"]*"|\\d+|true|false|null)`, 'g')
    content = content.replace(re, `$1${value}`)
  }
  return content
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
