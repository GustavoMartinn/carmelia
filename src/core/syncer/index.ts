import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import type { ScannedRoute } from '../scanner/types.js'
import type { HttxConfig } from '../config/types.js'
import { diffScan, type SyncDiffResult } from './differ.js'
import { mergeRoute, markDeprecated } from './merger.js'
import { generateHttpFiles } from '../generator/index.js'
import { groupDirName, requestFileName } from '../generator/naming.js'
import { logger } from '../../utils/logger.js'

export interface SyncResult {
  created: string[]
  updated: string[]
  deprecated: string[]
  unchanged: string[]
}

/**
 * Sync scanned routes with existing .http files
 */
export async function syncRoutes(
  routes: ScannedRoute[],
  config: HttxConfig,
  projectPath: string,
  dryRun: boolean = false,
): Promise<SyncResult> {
  const outputDir = resolve(projectPath, config.output)
  const diff = await diffScan(routes, outputDir)

  const result: SyncResult = {
    created: [],
    updated: [],
    deprecated: [],
    unchanged: diff.unchanged,
  }

  // 1. Create new .http files for added routes
  if (diff.added.length > 0) {
    if (!dryRun) {
      const genResult = await generateHttpFiles(diff.added, config, projectPath)
      result.created = genResult.created
    } else {
      result.created = diff.added.map((r) => `${groupDirName(r.groupName)}/${requestFileName(r)}`)
    }
  }

  // 2. Merge modified routes
  for (const mod of diff.modified) {
    if (!dryRun) {
      const newContent = await mergeRoute(mod.route, mod.filePath, config)
      await writeFile(mod.filePath, newContent, 'utf-8')
    }
    result.updated.push(mod.relativePath)
  }

  // 3. Mark deprecated routes
  for (const rem of diff.removed) {
    if (!dryRun) {
      const newContent = await markDeprecated(rem.filePath)
      await writeFile(rem.filePath, newContent, 'utf-8')
    }
    result.deprecated.push(rem.relativePath)
  }

  return result
}

/**
 * Print the sync results
 */
export function printSyncResult(result: SyncResult, diff?: SyncDiffResult): void {
  const total = result.created.length + result.updated.length + result.deprecated.length

  if (total === 0) {
    logger.success('Everything is up to date')
    return
  }

  if (result.created.length > 0) {
    logger.heading('New')
    logger.list(result.created)
  }

  if (result.updated.length > 0) {
    logger.heading('Updated')
    logger.list(result.updated)
  }

  if (result.deprecated.length > 0) {
    logger.heading('Deprecated')
    logger.list(result.deprecated)
  }

  logger.dim(`\n  ${result.unchanged.length} unchanged`)
  logger.success(`\n${total} files affected`)
}
