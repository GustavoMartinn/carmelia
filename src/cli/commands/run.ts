import type { Command } from 'commander'
import { resolve } from 'node:path'
import { runRequest, parseSets } from '../../core/runner/index.js'
import { logger } from '../../utils/logger.js'

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Execute an HTTP request file')
    .argument('<request>', 'Request path (e.g., users/create-user)')
    .argument('[path]', 'Project path', '.')
    .option('-e, --env <name>', 'Environment to use', 'local')
    .option('--set <pairs...>', 'Override fields (e.g., --set name="John" email="j@t.com")')
    .option('-v, --verbose', 'Show full request and response details')
    .option('--timeout <ms>', 'Request timeout in milliseconds')
    .option('--no-follow-redirects', 'Do not follow HTTP redirects')
    .option('--save', 'Save response to .carmelia/responses/')
    .action(async (request: string, path: string, opts: {
      env: string
      set?: string[]
      verbose?: boolean
      timeout?: string
      followRedirects?: boolean
      save?: boolean
    }) => {
      const projectPath = resolve(path)

      try {
        await runRequest(projectPath, request, {
          env: opts.env,
          sets: parseSets(opts.set),
          verbose: opts.verbose ?? false,
          timeout: opts.timeout ? parseInt(opts.timeout, 10) : undefined,
          followRedirects: opts.followRedirects,
          save: opts.save ?? false,
        })
      } catch (error) {
        if (error instanceof Error) {
          logger.error(error.message)
        } else {
          logger.error(String(error))
        }
        process.exit(1)
      }
    })
}
