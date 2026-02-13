import type { Command } from 'commander'
import { resolve } from 'node:path'
import { loadConfig } from '../../core/config/index.js'
import { scanProject } from '../../core/scanner/index.js'
import { syncRoutes, printSyncResult } from '../../core/syncer/index.js'
import { logger } from '../../utils/logger.js'

export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Re-scan the project and update .http files (smart merge)')
    .argument('[path]', 'Project path', '.')
    .option('--dry-run', 'Show what would change without modifying files')
    .action(async (path: string, opts: { dryRun?: boolean }) => {
      const projectPath = resolve(path)

      if (opts.dryRun) {
        logger.info('Dry run mode — no files will be modified')
      }

      const config = await loadConfig(projectPath)

      logger.heading('Re-scanning project')
      const routes = await scanProject(projectPath, config)

      if (routes.length === 0) {
        logger.warn('No endpoints found.')
        return
      }

      logger.info(`Found ${routes.length} endpoints, syncing...`)

      const result = await syncRoutes(routes, config, projectPath, opts.dryRun)
      printSyncResult(result)
    })
}
