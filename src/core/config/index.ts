import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { type HttxConfig, DEFAULT_CONFIG } from './types.js'

const CONFIG_DIR = '.carmelia'
const CONFIG_FILE = 'config.yaml'

export function getConfigDir(projectPath: string): string {
  return join(projectPath, CONFIG_DIR)
}

export function getConfigPath(projectPath: string): string {
  return join(projectPath, CONFIG_DIR, CONFIG_FILE)
}

export async function loadConfig(projectPath: string): Promise<HttxConfig> {
  const configPath = getConfigPath(projectPath)

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG }
  }

  const content = await readFile(configPath, 'utf-8')
  const parsed = parseYaml(content) as Partial<HttxConfig>

  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    generator: { ...DEFAULT_CONFIG.generator, ...parsed.generator },
    runner: { ...DEFAULT_CONFIG.runner, ...parsed.runner },
    defaults: { ...DEFAULT_CONFIG.defaults, ...parsed.defaults },
  }
}

export async function saveConfig(projectPath: string, config: HttxConfig): Promise<void> {
  const configPath = getConfigPath(projectPath)
  const dir = dirname(configPath)

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const content = stringifyYaml(config, { lineWidth: 0 })
  await writeFile(configPath, content, 'utf-8')
}

export async function configExists(projectPath: string): Promise<boolean> {
  return existsSync(getConfigPath(projectPath))
}
