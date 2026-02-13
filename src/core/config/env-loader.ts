import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { EnvVariables } from './types.js'

const ENVS_DIR = '.carmelia/envs'

export function getEnvsDir(projectPath: string): string {
  return join(projectPath, ENVS_DIR)
}

function getEnvFilePath(projectPath: string, envName: string): string {
  return join(projectPath, ENVS_DIR, `${envName}.yaml`)
}

/**
 * Resolve ${ENV_VAR} references to system environment variables
 */
function resolveSystemEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
    const envValue = process.env[varName]
    if (envValue === undefined) {
      return `\${${varName}}`
    }
    return envValue
  })
}

export async function loadEnv(projectPath: string, envName: string): Promise<EnvVariables> {
  const envPath = getEnvFilePath(projectPath, envName)

  if (!existsSync(envPath)) {
    throw new Error(`Environment "${envName}" not found at ${envPath}`)
  }

  const content = await readFile(envPath, 'utf-8')
  const parsed = parseYaml(content) as Record<string, unknown>

  const variables: EnvVariables = {}
  for (const [key, value] of Object.entries(parsed)) {
    const strValue = String(value)
    variables[key] = resolveSystemEnvVars(strValue)
  }

  return variables
}

export async function listEnvs(projectPath: string): Promise<string[]> {
  const envsDir = getEnvsDir(projectPath)

  if (!existsSync(envsDir)) {
    return []
  }

  const files = await readdir(envsDir)
  return files
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map((f) => f.replace(/\.ya?ml$/, ''))
}

export async function createDefaultEnv(projectPath: string): Promise<void> {
  const envsDir = getEnvsDir(projectPath)

  if (!existsSync(envsDir)) {
    await mkdir(envsDir, { recursive: true })
  }

  const localEnvPath = getEnvFilePath(projectPath, 'local')
  if (!existsSync(localEnvPath)) {
    const defaultEnv: EnvVariables = {
      base_url: 'http://localhost:3000',
      token: 'your-token-here',
    }
    await writeFile(localEnvPath, stringifyYaml(defaultEnv), 'utf-8')
  }
}
