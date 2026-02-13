import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Read and parse a JSON file, returning null if it doesn't exist
 */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) {
    return null
  }
  const content = await readFile(filePath, 'utf-8')
  return JSON.parse(content) as T
}

/**
 * Check if a file exists at the given path
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath)
}

/**
 * Read package.json from a project directory
 */
export async function readPackageJson(projectPath: string): Promise<Record<string, unknown> | null> {
  return readJsonFile(join(projectPath, 'package.json'))
}

/**
 * Check if a dependency exists in package.json
 */
export async function hasDependency(projectPath: string, depName: string): Promise<boolean> {
  const pkg = await readPackageJson(projectPath)
  if (!pkg) return false

  const deps = (pkg.dependencies ?? {}) as Record<string, string>
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>

  return depName in deps || depName in devDeps
}
