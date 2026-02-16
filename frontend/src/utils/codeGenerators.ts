import type { ParsedHttpRequest } from '../store/appStore'

export function generateCurl(req: ParsedHttpRequest): string {
  const parts = ['curl']

  if (req.method !== 'GET') {
    parts.push(`-X ${req.method}`)
  }

  parts.push(`'${req.url}'`)

  for (const [key, value] of Object.entries(req.headers)) {
    parts.push(`-H '${key}: ${value}'`)
  }

  if (req.body) {
    parts.push(`-d '${req.body.replace(/'/g, "'\\''")}'`)
  }

  return parts.join(' \\\n  ')
}

export function generatePython(req: ParsedHttpRequest): string {
  const lines = ['import requests', '']

  const headers = Object.entries(req.headers)
  if (headers.length > 0) {
    lines.push('headers = {')
    for (const [key, value] of headers) {
      lines.push(`    "${key}": "${value}",`)
    }
    lines.push('}')
    lines.push('')
  }

  if (req.body) {
    lines.push(`payload = '''${req.body}'''`)
    lines.push('')
  }

  const method = req.method.toLowerCase()
  const args = [`"${req.url}"`]
  if (headers.length > 0) args.push('headers=headers')
  if (req.body) args.push(method === 'get' ? 'params=payload' : 'data=payload')

  lines.push(`response = requests.${method}(${args.join(', ')})`)
  lines.push('print(response.status_code)')
  lines.push('print(response.text)')

  return lines.join('\n')
}

export function generateNodeFetch(req: ParsedHttpRequest): string {
  const lines: string[] = []
  const options: string[] = []

  options.push(`  method: "${req.method}"`)

  const headers = Object.entries(req.headers)
  if (headers.length > 0) {
    const headerLines = headers.map(([k, v]) => `    "${k}": "${v}"`).join(',\n')
    options.push(`  headers: {\n${headerLines}\n  }`)
  }

  if (req.body) {
    options.push(`  body: JSON.stringify(${req.body})`)
  }

  lines.push(`const response = await fetch("${req.url}", {`)
  lines.push(options.join(',\n'))
  lines.push('});')
  lines.push('')
  lines.push('const data = await response.json();')
  lines.push('console.log(data);')

  return lines.join('\n')
}

export function generateGo(req: ParsedHttpRequest): string {
  const lines: string[] = []
  lines.push('package main')
  lines.push('')
  lines.push('import (')
  lines.push('\t"fmt"')
  lines.push('\t"io"')
  lines.push('\t"net/http"')
  if (req.body) lines.push('\t"strings"')
  lines.push(')')
  lines.push('')
  lines.push('func main() {')

  if (req.body) {
    lines.push(`\tbody := strings.NewReader(\`${req.body}\`)`)
    lines.push(`\treq, err := http.NewRequest("${req.method}", "${req.url}", body)`)
  } else {
    lines.push(`\treq, err := http.NewRequest("${req.method}", "${req.url}", nil)`)
  }

  lines.push('\tif err != nil {')
  lines.push('\t\tpanic(err)')
  lines.push('\t}')

  for (const [key, value] of Object.entries(req.headers)) {
    lines.push(`\treq.Header.Set("${key}", "${value}")`)
  }

  lines.push('')
  lines.push('\tclient := &http.Client{}')
  lines.push('\tresp, err := client.Do(req)')
  lines.push('\tif err != nil {')
  lines.push('\t\tpanic(err)')
  lines.push('\t}')
  lines.push('\tdefer resp.Body.Close()')
  lines.push('')
  lines.push('\tdata, _ := io.ReadAll(resp.Body)')
  lines.push('\tfmt.Println(string(data))')
  lines.push('}')

  return lines.join('\n')
}
