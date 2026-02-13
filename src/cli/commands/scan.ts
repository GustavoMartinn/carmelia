import type { Command } from 'commander'
import { resolve } from 'node:path'
import { loadConfig, saveConfig, configExists } from '../../core/config/index.js'
import { createDefaultEnv } from '../../core/config/env-loader.js'
import { scanProject } from '../../core/scanner/index.js'
import { generateHttpFiles, printGenerateResult } from '../../core/generator/index.js'
import { logger } from '../../utils/logger.js'

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan your API source code and generate .http request files')
    .argument('[path]', 'Project path', '.')
    .option('--framework <type>', 'Force a specific framework (nestjs, express, go)')
    .option('--include <patterns...>', 'Glob patterns to include')
    .option('--exclude <patterns...>', 'Glob patterns to exclude')
    .option('--dry-run', 'Show what would be generated without creating files')
    .action(async (path: string, opts: { framework?: string; include?: string[]; exclude?: string[]; dryRun?: boolean }) => {
      const projectPath = resolve(path)

      // Auto-init if not initialized
      if (!(await configExists(projectPath))) {
        logger.dim('No .carmelia config found, initializing...')
        const { DEFAULT_CONFIG } = await import('../../core/config/types.js')
        await saveConfig(projectPath, DEFAULT_CONFIG)
        await createDefaultEnv(projectPath)
      }

      const config = await loadConfig(projectPath)

      logger.heading('Scanning project')
      const routes = await scanProject(projectPath, config)

      if (routes.length === 0) {
        logger.warn('No endpoints found. Make sure you pointed to the right directory.')
        return
      }

      // Summary
      logger.heading('Endpoints found')
      const groups = new Map<string, number>()
      for (const route of routes) {
        groups.set(route.groupName, (groups.get(route.groupName) ?? 0) + 1)
      }
      logger.table(
        Array.from(groups.entries()).map(([name, count]) => [name, `${count} endpoints`]),
      )
      logger.success(`\n${routes.length} endpoints total`)

      if (opts.dryRun) {
        logger.dim('\nDry run — no files generated')
        return
      }

      // Generate .http files
      logger.heading('Generating .http files')
      const result = await generateHttpFiles(routes, config, projectPath)
      printGenerateResult(result)
    })
}
