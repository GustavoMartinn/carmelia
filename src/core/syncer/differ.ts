import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ScannedRoute } from '../scanner/types.js'
import { groupDirName, requestFileName } from '../generator/naming.js'
import { parseHttpFile } from '../runner/http-parser.js'

export interface SyncDiffResult {
  /** New routes not yet in .http files */
  added: ScannedRoute[]
  /** Routes that exist in .http files but no longer in source code */
  removed: RemovedRoute[]
  /** Routes where the definition changed (path, body, auth, etc.) */
  modified: ModifiedRoute[]
  /** Routes unchanged */
  unchanged: string[]
}

export interface RemovedRoute {
  filePath: string
  relativePath: string
}

export interface ModifiedRoute {
  route: ScannedRoute
  filePath: string
  relativePath: string
  changes: string[]
}

/**
 * Build a map of relative path → ScannedRoute for the current scan
 */
function buildRouteMap(routes: ScannedRoute[]): Map<string, ScannedRoute> {
  const map = new Map<string, ScannedRoute>()
  for (const route of routes) {
    const dir = groupDirName(route.groupName)
    const file = requestFileName(route)
    const key = `${dir}/${file}`
    map.set(key, route)
  }
  return map
}

/**
 * Find all existing .http files in the output directory
 */
async function findExistingFiles(outputDir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>()
  if (!existsSync(outputDir)) return files

  const groups = await readdir(outputDir, { withFileTypes: true })
  for (const group of groups) {
    if (!group.isDirectory()) continue
    const groupDir = join(outputDir, group.name)
    const entries = await readdir(groupDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.http')) {
        const relativePath = `${group.name}/${entry.name}`
        const fullPath = join(groupDir, entry.name)
        files.set(relativePath, fullPath)
      }
    }
  }

  return files
}

/**
 * Detect what changed between the current scan and existing .http files
 */
export async function diffScan(
  routes: ScannedRoute[],
  outputDir: string,
): Promise<SyncDiffResult> {
  const routeMap = buildRouteMap(routes)
  const existingFiles = await findExistingFiles(outputDir)

  const added: ScannedRoute[] = []
  const removed: RemovedRoute[] = []
  const modified: ModifiedRoute[] = []
  const unchanged: string[] = []

  // Check each scanned route against existing files
  for (const [relativePath, route] of routeMap) {
    const existingPath = existingFiles.get(relativePath)

    if (!existingPath) {
      // New route — no .http file yet
      added.push(route)
    } else {
      // File exists — check if anything changed
      const existingContent = await readFile(existingPath, 'utf-8')
      const changes = detectChanges(route, existingContent)

      if (changes.length > 0) {
        modified.push({ route, filePath: existingPath, relativePath, changes })
      } else {
        unchanged.push(relativePath)
      }
    }
  }

  // Check for files that no longer have a corresponding route
  for (const [relativePath, fullPath] of existingFiles) {
    if (!routeMap.has(relativePath)) {
      removed.push({ filePath: fullPath, relativePath })
    }
  }

  return { added, removed, modified, unchanged }
}

/**
 * Detect what changed between a scanned route and the existing .http file
 */
function detectChanges(route: ScannedRoute, existingContent: string): string[] {
  const changes: string[] = []
  const parsed = parseHttpFile(existingContent)

  // Check method changed
  if (parsed.method !== route.method) {
    changes.push(`method: ${parsed.method} → ${route.method}`)
  }

  // Check path changed (compare the path portion after {{base_url}})
  const existingPath = extractPathFromUrl(parsed.url)
  const newPath = renderRoutePath(route)
  if (existingPath !== newPath) {
    changes.push(`path: ${existingPath} → ${newPath}`)
  }

  // Check body fields changed
  if (route.body) {
    const existingFields = extractBodyFieldNames(parsed.body)
    const newFields = route.body.fields.map((f) => f.jsonName ?? f.name)

    const addedFields = newFields.filter((f) => !existingFields.includes(f))
    const removedFields = existingFields.filter((f) => !newFields.includes(f))

    if (addedFields.length > 0) {
      changes.push(`new fields: ${addedFields.join(', ')}`)
    }
    if (removedFields.length > 0) {
      changes.push(`removed fields: ${removedFields.join(', ')}`)
    }
  } else if (parsed.body) {
    changes.push('body removed')
  }

  // Check auth changed
  const existingHasAuth = 'Authorization' in parsed.headers
  const newHasAuth = !!route.auth
  if (existingHasAuth !== newHasAuth) {
    changes.push(newHasAuth ? 'auth added' : 'auth removed')
  }

  return changes
}

/**
 * Extract the path portion from a URL like {{base_url}}/users/:id
 */
function extractPathFromUrl(url: string): string {
  return url.replace(/\{\{base_url\}\}/, '').replace(/\?.*$/, '')
}

/**
 * Render a route's full path with template variables
 */
function renderRoutePath(route: ScannedRoute): string {
  let path = route.fullPath
  if (path.includes(':')) {
    path = path.replace(/:(\w+)/g, '{{$1}}')
  } else {
    path = path.replace(/\{(\w+)\}/g, '{{$1}}')
  }
  return path
}

/**
 * Extract field names from a JSON body string
 */
function extractBodyFieldNames(body: string | undefined): string[] {
  if (!body) return []

  const fields: string[] = []
  // Match top-level "fieldName": patterns in JSON
  const re = /^\s*"(\w+)"\s*:/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    fields.push(match[1])
  }
  return fields
}
