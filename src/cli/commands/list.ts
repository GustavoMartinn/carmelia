import type { Command } from 'commander'
import { resolve, join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import pc from 'picocolors'
import { loadConfig } from '../../core/config/index.js'
import { parseHttpFile } from '../../core/runner/http-parser.js'
import { logger } from '../../utils/logger.js'

interface RequestEntry {
  relativePath: string
  method: string
  url: string
}

const METHOD_COLORS: Record<string, (s: string) => string> = {
  GET: pc.green,
  POST: pc.yellow,
  PUT: pc.blue,
  PATCH: pc.cyan,
  DELETE: pc.red,
}

async function findHttpFiles(dir: string, prefix = ''): Promise<RequestEntry[]> {
  if (!existsSync(dir)) return []

  const entries = await readdir(dir, { withFileTypes: true })
  const files: RequestEntry[] = []

  for (const entry of entries) {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await findHttpFiles(join(dir, entry.name), entryPath)))
    } else if (entry.name.endsWith('.http')) {
      const fullPath = join(dir, entry.name)
      const content = await readFile(fullPath, 'utf-8')
      const parsed = parseHttpFile(content)

      files.push({
        relativePath: entryPath.replace(/\.http$/, ''),
        method: parsed.method || '???',
        url: parsed.url.replace(/\{\{base_url\}\}/, '').replace(/\?.*$/, '') || '/',
      })
    }
  }

  return files
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List all available HTTP requests')
    .argument('[path]', 'Project path', '.')
    .action(async (path: string) => {
      const projectPath = resolve(path)
      const config = await loadConfig(projectPath)
      const requestsDir = resolve(projectPath, config.output)

      const files = await findHttpFiles(requestsDir)

      if (files.length === 0) {
        logger.warn('No requests found.')
        logger.dim('  Run `carmelia scan` first to generate .http files from your API code.')
        return
      }

      // Group by directory
      const groups = new Map<string, RequestEntry[]>()
      for (const file of files) {
        const parts = file.relativePath.split('/')
        const group = parts.length > 1 ? parts[0] : '(root)'
        if (!groups.has(group)) groups.set(group, [])
        groups.get(group)!.push(file)
      }

      logger.heading('Available requests')

      const maxMethod = 6 // "DELETE".length
      for (const [group, entries] of groups) {
        console.log(`\n  ${pc.bold(group)}/`)
        for (const entry of entries) {
          const name = entry.relativePath.split('/').slice(1).join('/') || entry.relativePath
          const colorFn = METHOD_COLORS[entry.method] ?? pc.white
          const method = colorFn(entry.method.padEnd(maxMethod))
          const path = pc.dim(entry.url)
          console.log(`    ${method} ${name}  ${path}`)
        }
      }

      console.log(`\n  ${pc.dim(`${files.length} requests total`)}`)
      logger.dim('  Run with: carmelia run <group>/<name> --env=local')
    })
}
