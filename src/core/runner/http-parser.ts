/**
 * Parse .http files into structured request definitions
 *
 * Format:
 *   # comments
 *   METHOD url
 *   Header: value
 *   Header2: value
 *
 *   { json body }
 */

export interface ParsedHttpRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  comments: string[]
}

export function parseHttpFile(content: string): ParsedHttpRequest {
  const lines = content.split('\n')
  const comments: string[] = []
  let method = ''
  let url = ''
  const headers: Record<string, string> = {}
  let bodyLines: string[] = []
  let phase: 'comments' | 'request-line' | 'headers' | 'body' = 'comments'

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines in comments/request-line phase
    if (phase === 'comments') {
      if (trimmed === '') continue
      if (trimmed.startsWith('#')) {
        comments.push(trimmed.slice(1).trim())
        continue
      }
      // First non-comment, non-empty line is the request line
      phase = 'request-line'
    }

    if (phase === 'request-line') {
      const match = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.+)$/i)
      if (match) {
        method = match[1].toUpperCase()
        url = match[2].trim()
        phase = 'headers'
        continue
      }
      // If we don't match a request line, skip
      continue
    }

    if (phase === 'headers') {
      // Empty line separates headers from body
      if (trimmed === '') {
        phase = 'body'
        continue
      }

      // Header: value
      const headerMatch = trimmed.match(/^([\w-]+)\s*:\s*(.+)$/)
      if (headerMatch) {
        headers[headerMatch[1]] = headerMatch[2].trim()
        continue
      }

      // If it doesn't look like a header, it's probably the body start
      phase = 'body'
      bodyLines.push(line)
      continue
    }

    if (phase === 'body') {
      bodyLines.push(line)
    }
  }

  // Trim trailing empty lines from body
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
    bodyLines.pop()
  }

  const body = bodyLines.length > 0 ? bodyLines.join('\n') : undefined

  return { method, url, headers, body, comments }
}
