import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { HttpResponse } from './http-engine.js'

export interface StoredResponse {
  timestamp: string
  request: {
    method: string
    url: string
    headers: Record<string, string>
    body?: string
  }
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: unknown
    time: number
    size: number
  }
}

/**
 * Save a response to the responses directory
 */
export async function saveResponse(
  responsesDir: string,
  requestPath: string,
  request: { method: string; url: string; headers: Record<string, string>; body?: string },
  response: HttpResponse,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `${requestPath.replace(/\//g, '_')}_${timestamp}.json`
  const filePath = join(responsesDir, fileName)

  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  // Try to parse response body as JSON
  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(response.body)
  } catch {
    parsedBody = response.body
  }

  const stored: StoredResponse = {
    timestamp: new Date().toISOString(),
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: parsedBody,
      time: response.time,
      size: response.size,
    },
  }

  await writeFile(filePath, JSON.stringify(stored, null, 2), 'utf-8')
  return filePath
}
