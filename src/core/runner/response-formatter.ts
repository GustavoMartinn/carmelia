import pc from 'picocolors'
import type { HttpResponse } from './http-engine.js'

/**
 * Format and print the HTTP response to the terminal
 */
export function formatResponse(response: HttpResponse, verbose: boolean): string {
  const lines: string[] = []

  // Status line
  const statusColor = getStatusColor(response.status)
  lines.push(`${statusColor(`${response.status}`)} ${response.statusText}  ${pc.dim(`${response.time}ms  ${formatSize(response.size)}`)}`)

  // Headers (verbose mode)
  if (verbose) {
    lines.push('')
    lines.push(pc.dim('Response Headers:'))
    for (const [key, value] of Object.entries(response.headers)) {
      lines.push(`  ${pc.cyan(key)}: ${value}`)
    }
  }

  // Body
  if (response.body) {
    lines.push('')

    // Try to pretty-print JSON
    const contentType = response.headers['content-type'] ?? ''
    if (contentType.includes('json') || isLikelyJson(response.body)) {
      try {
        const parsed = JSON.parse(response.body)
        lines.push(syntaxHighlightJson(JSON.stringify(parsed, null, 2)))
      } catch {
        lines.push(response.body)
      }
    } else {
      lines.push(response.body)
    }
  }

  return lines.join('\n')
}

/**
 * Format request details for verbose output
 */
export function formatRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
): string {
  const lines: string[] = []

  lines.push(pc.dim('Request:'))
  lines.push(`  ${pc.bold(method)} ${pc.underline(url)}`)

  if (Object.keys(headers).length > 0) {
    for (const [key, value] of Object.entries(headers)) {
      lines.push(`  ${pc.cyan(key)}: ${value}`)
    }
  }

  if (body) {
    lines.push('')
    lines.push(pc.dim('Request Body:'))
    try {
      const parsed = JSON.parse(body)
      lines.push(syntaxHighlightJson(JSON.stringify(parsed, null, 2)))
    } catch {
      lines.push(body)
    }
  }

  return lines.join('\n')
}

function getStatusColor(status: number): (text: string) => string {
  if (status >= 200 && status < 300) return pc.green
  if (status >= 300 && status < 400) return pc.yellow
  if (status >= 400 && status < 500) return pc.red
  return pc.magenta
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function isLikelyJson(text: string): boolean {
  const trimmed = text.trim()
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

/**
 * Basic JSON syntax highlighting for terminal
 */
function syntaxHighlightJson(json: string): string {
  return json
    .replace(/"([^"]+)"(?=\s*:)/g, `${pc.cyan('"$1"')}`)         // keys
    .replace(/:\s*"([^"]*)"(?=[,\n\r}])/g, `: ${pc.green('"$1"')}`)  // string values
    .replace(/:\s*(true|false)/g, `: ${pc.yellow('$1')}`)          // booleans
    .replace(/:\s*(null)/g, `: ${pc.dim('$1')}`)                   // null
    .replace(/:\s*(-?\d+\.?\d*)/g, `: ${pc.yellow('$1')}`)         // numbers
}
