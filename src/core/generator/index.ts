import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ScannedRoute } from '../scanner/types.js'
import type { HttxConfig } from '../config/types.js'
import { groupDirName, requestFileName } from './naming.js'
import { renderHttpFile } from './templates.js'
import { logger } from '../../utils/logger.js'

export interface GenerateResult {
  created: string[]
  skipped: string[]
  outputDir: string
}

/**
 * Generate .http files from scanned routes
 */
export async function generateHttpFiles(
  routes: ScannedRoute[],
  config: HttxConfig,
  projectPath: string,
): Promise<GenerateResult> {
  const outputDir = join(projectPath, config.output)
  const result: GenerateResult = { created: [], skipped: [], outputDir }

  // Group routes by groupName
  const groups = new Map<string, ScannedRoute[]>()
  for (const route of routes) {
    const groupRoutes = groups.get(route.groupName) ?? []
    groupRoutes.push(route)
    groups.set(route.groupName, groupRoutes)
  }

  // Generate files for each group
  for (const [groupName, groupRoutes] of groups) {
    const dirName = groupDirName(groupName)
    const groupDir = join(outputDir, dirName)

    // Create group directory
    if (!existsSync(groupDir)) {
      await mkdir(groupDir, { recursive: true })
    }

    for (const route of groupRoutes) {
      const fileName = requestFileName(route)
      const filePath = join(groupDir, fileName)
      const relativePath = `${dirName}/${fileName}`

      // Don't overwrite existing files (user may have customized them)
      if (existsSync(filePath)) {
        result.skipped.push(relativePath)
        continue
      }

      const content = renderHttpFile(route, config.generator.includeComments)
      await writeFile(filePath, content, 'utf-8')
      result.created.push(relativePath)
    }
  }

  return result
}

/**
 * Print the generation results
 */
export function printGenerateResult(result: GenerateResult): void {
  if (result.created.length > 0) {
    logger.heading('Generated')
    logger.list(result.created)
  }

  if (result.skipped.length > 0) {
    logger.dim(`\n  ${result.skipped.length} files already exist (skipped)`)
  }

  logger.success(`\n${result.created.length} files created in ${result.outputDir}`)
}
