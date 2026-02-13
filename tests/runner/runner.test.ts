import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { parseHttpFile } from '../../src/core/runner/http-parser.js'
import { resolveVariables, resolveRequest } from '../../src/core/runner/variable-resolver.js'
import { parseSets } from '../../src/core/runner/index.js'
import { formatResponse } from '../../src/core/runner/response-formatter.js'
import { saveResponse } from '../../src/core/runner/response-store.js'
import type { HttpResponse } from '../../src/core/runner/http-engine.js'

describe('HTTP Parser', () => {
  it('should parse a simple GET request', () => {
    const content = `
# Auto-generated from HealthController.check()
# Source: src/health/health.controller.ts:5

GET {{base_url}}/health
`
    const result = parseHttpFile(content)

    expect(result.method).toBe('GET')
    expect(result.url).toBe('{{base_url}}/health')
    expect(result.body).toBeUndefined()
    expect(result.comments).toHaveLength(2)
    expect(Object.keys(result.headers)).toHaveLength(0)
  })

  it('should parse a POST request with headers and body', () => {
    const content = `
# Create user

POST {{base_url}}/users
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "name": "string",
  "email": "string",
  "age": 0
}
`
    const result = parseHttpFile(content)

    expect(result.method).toBe('POST')
    expect(result.url).toBe('{{base_url}}/users')
    expect(result.headers['Content-Type']).toBe('application/json')
    expect(result.headers['Authorization']).toBe('Bearer {{token}}')
    expect(result.body).toContain('"name": "string"')
    expect(result.body).toContain('"email": "string"')
    expect(result.body).toContain('"age": 0')
  })

  it('should parse a GET with query params in URL', () => {
    const content = `GET {{base_url}}/users?page={{page}}&limit={{limit}}`

    const result = parseHttpFile(content)

    expect(result.method).toBe('GET')
    expect(result.url).toBe('{{base_url}}/users?page={{page}}&limit={{limit}}')
    expect(result.body).toBeUndefined()
  })

  it('should handle DELETE without body', () => {
    const content = `
DELETE {{base_url}}/users/{{id}}
Authorization: Bearer {{token}}
`
    const result = parseHttpFile(content)

    expect(result.method).toBe('DELETE')
    expect(result.url).toBe('{{base_url}}/users/{{id}}')
    expect(result.headers['Authorization']).toBe('Bearer {{token}}')
    expect(result.body).toBeUndefined()
  })

  it('should handle PUT with body', () => {
    const content = `
PUT {{base_url}}/users/{{id}}
Content-Type: application/json

{
  "name": "John"
}
`
    const result = parseHttpFile(content)

    expect(result.method).toBe('PUT')
    expect(result.body).toContain('"name": "John"')
  })
})

describe('Variable Resolver', () => {
  it('should resolve {{var}} from env', () => {
    const result = resolveVariables('{{base_url}}/users', {
      env: { base_url: 'http://localhost:3000' },
      sets: {},
    })
    expect(result).toBe('http://localhost:3000/users')
  })

  it('should resolve multiple variables', () => {
    const result = resolveVariables('{{base_url}}/users/{{id}}', {
      env: { base_url: 'http://localhost:3000', id: '123' },
      sets: {},
    })
    expect(result).toBe('http://localhost:3000/users/123')
  })

  it('should resolve ${ENV_VAR} from system env', () => {
    process.env.TEST_HTTX_VAR = 'hello'
    const result = resolveVariables('${TEST_HTTX_VAR}/path', {
      env: {},
      sets: {},
    })
    expect(result).toBe('hello/path')
    delete process.env.TEST_HTTX_VAR
  })

  it('should preserve unresolved variables', () => {
    const result = resolveVariables('{{unknown_var}}', {
      env: {},
      sets: {},
    })
    expect(result).toBe('{{unknown_var}}')
  })

  it('should give --set priority over env', () => {
    const result = resolveVariables('{{token}}', {
      env: { token: 'env-token' },
      sets: { token: 'override-token' },
    })
    expect(result).toBe('override-token')
  })

  it('should resolve variables in all request parts', () => {
    const { url, headers, body } = resolveRequest(
      'POST',
      '{{base_url}}/users',
      { Authorization: 'Bearer {{token}}' },
      '{"name": "{{name}}"}',
      {
        env: { base_url: 'http://localhost:3000', token: 'abc', name: 'default' },
        sets: { name: 'John' },
      },
    )

    expect(url).toBe('http://localhost:3000/users')
    expect(headers['Authorization']).toBe('Bearer abc')
    // --set should override the body field too
    expect(body).toContain('John')
  })

  it('should apply --set overrides to JSON body fields', () => {
    const { body } = resolveRequest(
      'POST',
      'http://localhost/users',
      {},
      '{"name": "string", "age": 0, "active": false}',
      {
        env: {},
        sets: { name: 'Alice', age: '25', active: 'true' },
      },
    )

    const parsed = JSON.parse(body!)
    expect(parsed.name).toBe('Alice')
    expect(parsed.age).toBe(25)
    expect(parsed.active).toBe(true)
  })
})

describe('parseSets', () => {
  it('should parse key=value pairs', () => {
    const result = parseSets(['name=John', 'age=30', 'email=j@t.com'])
    expect(result).toEqual({ name: 'John', age: '30', email: 'j@t.com' })
  })

  it('should handle quoted values', () => {
    const result = parseSets(['"name"="John Doe"', "role='admin'"])
    // keys aren't quoted in real usage, but values can be
    expect(result['"name"']).toBe('John Doe')
  })

  it('should handle values with = in them', () => {
    const result = parseSets(['query=name=john&age=30'])
    expect(result.query).toBe('name=john&age=30')
  })

  it('should return empty object for undefined', () => {
    expect(parseSets(undefined)).toEqual({})
  })
})

describe('Response Formatter', () => {
  const mockResponse: HttpResponse = {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"id": 1, "name": "John"}',
    time: 42,
    size: 25,
  }

  it('should include status code', () => {
    const output = formatResponse(mockResponse, false)
    expect(output).toContain('200')
    expect(output).toContain('OK')
  })

  it('should include timing', () => {
    const output = formatResponse(mockResponse, false)
    expect(output).toContain('42ms')
  })

  it('should include pretty-printed JSON body', () => {
    const output = formatResponse(mockResponse, false)
    expect(output).toContain('"id"')
    expect(output).toContain('"name"')
  })

  it('should include headers in verbose mode', () => {
    const output = formatResponse(mockResponse, true)
    expect(output).toContain('content-type')
    expect(output).toContain('application/json')
  })

  it('should handle error status codes', () => {
    const errorResponse: HttpResponse = {
      ...mockResponse,
      status: 404,
      statusText: 'Not Found',
      body: '{"error": "not found"}',
    }
    const output = formatResponse(errorResponse, false)
    expect(output).toContain('404')
  })

  it('should handle non-JSON body', () => {
    const htmlResponse: HttpResponse = {
      ...mockResponse,
      headers: { 'content-type': 'text/html' },
      body: '<html>hello</html>',
    }
    const output = formatResponse(htmlResponse, false)
    expect(output).toContain('<html>hello</html>')
  })
})

describe('Response Store', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'carmelia-store-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('should save response to file', async () => {
    const responsesDir = join(tmpDir, 'responses')
    const request = {
      method: 'GET',
      url: 'http://localhost:3000/users',
      headers: {},
    }
    const response: HttpResponse = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"users": []}',
      time: 50,
      size: 14,
    }

    const savedPath = await saveResponse(responsesDir, 'users/list-users', request, response)

    expect(existsSync(savedPath)).toBe(true)
    const content = await import('node:fs/promises').then(fs => fs.readFile(savedPath, 'utf-8'))
    const parsed = JSON.parse(content)

    expect(parsed.response.status).toBe(200)
    expect(parsed.response.body).toEqual({ users: [] })
    expect(parsed.request.method).toBe('GET')
    expect(parsed.timestamp).toBeDefined()
  })
})
