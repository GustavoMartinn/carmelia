import type { Command } from 'commander'
import { resolve, join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { configExists, saveConfig, getConfigDir } from '../../core/config/index.js'
import { createDefaultEnv } from '../../core/config/env-loader.js'
import { detectFrameworks } from '../../core/scanner/index.js'
import { DEFAULT_CONFIG, type FrameworkSource } from '../../core/config/types.js'
import { logger } from '../../utils/logger.js'

const GITIGNORE_CONTENT = `# carmelia — ignore responses and secrets, keep requests
responses/
envs/staging.yaml
envs/production.yaml
`

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize carmelia in the current project')
    .argument('[path]', 'Project path', '.')
    .option('-f, --force', 'Overwrite existing config')
    .action(async (path: string, opts: { force?: boolean }) => {
      const projectPath = resolve(path)

      if (await configExists(projectPath) && !opts.force) {
        logger.warn('carmelia is already initialized in this project.')
        logger.dim('  Use --force to overwrite, or run `carmelia scan` to update requests.')
        return
      }

      logger.heading('Initializing carmelia')

      // Auto-detect frameworks
      logger.info('Detecting frameworks...')
      const detected = await detectFrameworks(projectPath)
      const config = { ...DEFAULT_CONFIG }

      if (detected.length > 0) {
        const frameworks: FrameworkSource[] = []

        for (const parser of detected) {
          const source = inferSourceDir(projectPath, parser.name)
          frameworks.push({
            type: parser.name as FrameworkSource['type'],
            source,
          })
          logger.success(`${parser.name} detected (source: ${source})`)
        }

        config.frameworks = frameworks
      } else {
        logger.dim('  No frameworks auto-detected.')
        logger.dim('  You can configure them manually in .carmelia/config.yaml')
        logger.dim('  Supported: nestjs, express, go')
      }

      // Save config
      await saveConfig(projectPath, config)
      logger.success(`Created ${getConfigDir(projectPath)}/config.yaml`)

      // Create default env
      await createDefaultEnv(projectPath)
      logger.success('Created .carmelia/envs/local.yaml')

      // Create .gitignore inside .carmelia/
      const gitignorePath = join(getConfigDir(projectPath), '.gitignore')
      if (!existsSync(gitignorePath)) {
        await writeFile(gitignorePath, GITIGNORE_CONTENT, 'utf-8')
        logger.success('Created .carmelia/.gitignore')
      }

      // Summary
      logger.heading('Next steps')
      logger.list([
        'Run `carmelia scan` to discover endpoints and generate .http files',
        'Edit .carmelia/envs/local.yaml with your local environment variables',
        'Run `carmelia run <request> --env=local` to execute a request',
        'Commit .carmelia/ to version control (responses are gitignored)',
      ])
    })
}

/**
 * Infer the source directory based on common project layouts
 */
function inferSourceDir(projectPath: string, framework: string): string {
  if (framework === 'go') {
    // Go projects: check for cmd/ or main.go
    if (existsSync(join(projectPath, 'cmd'))) return './cmd'
    if (existsSync(join(projectPath, 'main.go'))) return '.'
    return '.'
  }

  // TypeScript/JavaScript projects
  if (existsSync(join(projectPath, 'src'))) return './src'
  if (existsSync(join(projectPath, 'lib'))) return './lib'
  return '.'
}
