import type { ParsedHttpRequest } from '../store/appStore'

export interface RebuildParts {
  comments: string[]
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

export function rebuildHttpContent(parts: RebuildParts): string {
  const lines: string[] = []

  // Comments
  for (const comment of parts.comments) {
    lines.push(`# ${comment}`)
  }

  // Blank line after comments
  if (parts.comments.length > 0) {
    lines.push('')
  }

  // Request line
  lines.push(`${parts.method} ${parts.url}`)

  // Headers
  for (const [key, value] of Object.entries(parts.headers)) {
    lines.push(`${key}: ${value}`)
  }

  // Body
  if (parts.body) {
    lines.push('')
    lines.push(parts.body)
  }

  return lines.join('\n')
}

export function rebuildFromParsed(parsed: ParsedHttpRequest, overrides?: Partial<RebuildParts>): string {
  return rebuildHttpContent({
    comments: overrides?.comments ?? parsed.comments,
    method: overrides?.method ?? parsed.method,
    url: overrides?.url ?? parsed.url,
    headers: overrides?.headers ?? parsed.headers,
    body: overrides?.body ?? parsed.body,
  })
}
