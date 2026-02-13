import type { FrameworkParser } from './parsers/base.js'
import type { ScannedRoute, ScanOptions, FrameworkType } from './types.js'
import type { HttxConfig } from '../config/types.js'
import { logger } from '../../utils/logger.js'

// Parser registry — parsers register themselves here
const parsers: FrameworkParser[] = []

export function registerParser(parser: FrameworkParser): void {
  parsers.push(parser)
}

export function getRegisteredParsers(): FrameworkParser[] {
  return [...parsers]
}

/**
 * Auto-detect which frameworks are used in the project
 */
export async function detectFrameworks(projectPath: string): Promise<FrameworkParser[]> {
  const detected: FrameworkParser[] = []

  for (const parser of parsers) {
    if (await parser.detect(projectPath)) {
      detected.push(parser)
    }
  }

  return detected
}

/**
 * Scan a project using the configured or auto-detected frameworks
 */
export async function scanProject(
  projectPath: string,
  config: HttxConfig,
): Promise<ScannedRoute[]> {
  const allRoutes: ScannedRoute[] = []

  if (config.frameworks.length > 0) {
    // Use configured frameworks
    for (const fw of config.frameworks) {
      const parser = parsers.find((p) => p.name === fw.type)
      if (!parser) {
        logger.warn(`No parser found for framework "${fw.type}", skipping`)
        continue
      }

      const options: ScanOptions = {
        include: fw.include,
        exclude: fw.exclude,
      }

      logger.info(`Scanning ${fw.type} project at ${fw.source}...`)
      const startTime = Date.now()
      const routes = await parser.scan(projectPath, options)
      const elapsed = Date.now() - startTime
      allRoutes.push(...routes)
      logger.success(`Found ${routes.length} endpoints in ${fw.type} (${elapsed}ms)`)
    }
  } else {
    // Auto-detect frameworks
    const detected = await detectFrameworks(projectPath)

    if (detected.length === 0) {
      logger.warn('No supported frameworks detected')
      return []
    }

    for (const parser of detected) {
      logger.info(`Detected ${parser.name}, scanning...`)
      const startTime = Date.now()
      const routes = await parser.scan(projectPath)
      const elapsed = Date.now() - startTime
      allRoutes.push(...routes)
      logger.success(`Found ${routes.length} endpoints in ${parser.name} (${elapsed}ms)`)
    }
  }

  if (allRoutes.length > 500) {
    logger.warn(`Large project detected (${allRoutes.length} routes). Consider narrowing scan scope with include/exclude patterns.`)
  }

  return allRoutes
}

export type { FrameworkType }
