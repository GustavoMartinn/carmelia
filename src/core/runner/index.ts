import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseHttpFile } from './http-parser.js'
import { resolveRequest, type ResolveOptions } from './variable-resolver.js'
import { executeRequest, type HttpResponse } from './http-engine.js'
import { formatResponse, formatRequest } from './response-formatter.js'
import { saveResponse } from './response-store.js'
import { loadConfig } from '../config/index.js'
import { loadEnv } from '../config/env-loader.js'
import { logger } from '../../utils/logger.js'

export interface RunOptions {
  env: string
  sets: Record<string, string>
  verbose: boolean
  timeout?: number
  followRedirects?: boolean
  save: boolean
}

export interface RunResult {
  response: HttpResponse
  savedTo?: string
}

/**
 * Find the .http file for a given request path
 * e.g., "users/create-user" → ".carmelia/requests/users/create-user.http"
 */
function findRequestFile(projectPath: string, requestPath: string, outputDir: string): string {
  // Add .http extension if not present
  const withExt = requestPath.endsWith('.http') ? requestPath : `${requestPath}.http`
  const filePath = join(resolve(projectPath), outputDir, withExt)

  if (!existsSync(filePath)) {
    throw new Error(`Request file not found: ${filePath}\nRun \`carmelia list\` to see available requests.`)
  }

  return filePath
}

/**
 * Parse --set pairs from CLI
 * Input: ["name=John", "age=30", "email=j@t.com"]
 * Output: { name: "John", age: "30", email: "j@t.com" }
 */
export function parseSets(setPairs: string[] | undefined): Record<string, string> {
  if (!setPairs) return {}

  const sets: Record<string, string> = {}
  for (const pair of setPairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) continue
    const key = pair.slice(0, eqIdx).trim()
    const value = pair.slice(eqIdx + 1).trim()
    // Remove surrounding quotes
    sets[key] = value.replace(/^["']|["']$/g, '')
  }
  return sets
}

/**
 * Run a request end-to-end
 */
export async function runRequest(
  projectPath: string,
  requestPath: string,
  options: RunOptions,
): Promise<RunResult> {
  const config = await loadConfig(projectPath)
  const env = await loadEnv(projectPath, options.env)

  // Find and parse the .http file
  const filePath = findRequestFile(projectPath, requestPath, config.output)
  const content = await readFile(filePath, 'utf-8')
  const parsed = parseHttpFile(content)

  if (!parsed.method || !parsed.url) {
    throw new Error(`Invalid .http file: could not parse method and URL from ${filePath}`)
  }

  // Resolve variables
  const resolveOpts: ResolveOptions = { env, sets: options.sets }
  const resolved = resolveRequest(parsed.method, parsed.url, parsed.headers, parsed.body, resolveOpts)

  // Verbose: show request
  if (options.verbose) {
    console.log(formatRequest(resolved.method, resolved.url, resolved.headers, resolved.body))
    console.log('')
  }

  // Execute
  const timeout = options.timeout ?? config.runner.timeout
  const followRedirects = options.followRedirects ?? config.runner.followRedirects

  const response = await executeRequest({
    method: resolved.method,
    url: resolved.url,
    headers: resolved.headers,
    body: resolved.body,
    timeout,
    followRedirects,
  })

  // Print response
  console.log(formatResponse(response, options.verbose))

  // Save response
  let savedTo: string | undefined
  if (options.save || config.runner.saveResponses) {
    const responsesDir = resolve(projectPath, config.runner.responsesDir)
    savedTo = await saveResponse(responsesDir, requestPath, resolved, response)
    logger.dim(`\nResponse saved to ${savedTo}`)
  }

  return { response, savedTo }
}
