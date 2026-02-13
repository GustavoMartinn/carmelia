import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { diffScan } from '../../src/core/syncer/differ.js'
import { mergeRoute, markDeprecated } from '../../src/core/syncer/merger.js'
import { syncRoutes } from '../../src/core/syncer/index.js'
import { DEFAULT_CONFIG } from '../../src/core/config/types.js'
import type { ScannedRoute } from '../../src/core/scanner/types.js'

function makeRoute(overrides: Partial<ScannedRoute> = {}): ScannedRoute {
  return {
    method: 'GET',
    path: '/',
    fullPath: '/users',
    groupName: 'UsersController',
    handlerName: 'listUsers',
    sourceFile: 'src/users.controller.ts',
    sourceLine: 10,
    framework: 'nestjs',
    params: [],
    queryParams: [],
    headers: [],
    ...overrides,
  }
}

const EXISTING_CREATE_USER = `# Auto-generated from UsersController.createUser()
# Source: src/users.controller.ts:20
# Body: CreateUserDto

POST {{base_url}}/users
Content-Type: application/json

{
  "name": "John",
  "email": "john@test.com",
  "age": 0
}
`

describe('Differ', () => {
  let tmpDir: string
  let outputDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'carmelia-sync-'))
    outputDir = join(tmpDir, '.carmelia/requests')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('should detect added routes (no existing files)', async () => {
    const routes = [makeRoute(), makeRoute({ handlerName: 'getUser', fullPath: '/users/:id' })]

    const diff = await diffScan(routes, outputDir)

    expect(diff.added).toHaveLength(2)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
  })

  it('should detect removed routes (files with no matching route)', async () => {
    // Create an existing file that has no corresponding route
    await mkdir(join(outputDir, 'users'), { recursive: true })
    await writeFile(
      join(outputDir, 'users/old-endpoint.http'),
      'GET {{base_url}}/users/old\n',
    )

    const routes = [makeRoute()] // only listUsers, not old-endpoint
    const diff = await diffScan(routes, outputDir)

    expect(diff.removed).toHaveLength(1)
    expect(diff.removed[0].relativePath).toBe('users/old-endpoint.http')
  })

  it('should detect unchanged routes', async () => {
    await mkdir(join(outputDir, 'users'), { recursive: true })
    await writeFile(
      join(outputDir, 'users/list-users.http'),
      'GET {{base_url}}/users\n',
    )

    const routes = [makeRoute()]
    const diff = await diffScan(routes, outputDir)

    expect(diff.unchanged).toHaveLength(1)
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
  })

  it('should detect modified route when path changes', async () => {
    await mkdir(join(outputDir, 'users'), { recursive: true })
    await writeFile(
      join(outputDir, 'users/list-users.http'),
      'GET {{base_url}}/api/v1/users\n',
    )

    // Route now has /users instead of /api/v1/users
    const routes = [makeRoute({ fullPath: '/users' })]
    const diff = await diffScan(routes, outputDir)

    expect(diff.modified).toHaveLength(1)
    expect(diff.modified[0].changes).toContain('path: /api/v1/users → /users')
  })

  it('should detect modified route when body fields change', async () => {
    await mkdir(join(outputDir, 'users'), { recursive: true })
    await writeFile(
      join(outputDir, 'users/create-user.http'),
      EXISTING_CREATE_USER,
    )

    // Route now has a new field "phone"
    const routes = [
      makeRoute({
        method: 'POST',
        handlerName: 'createUser',
        fullPath: '/users',
        body: {
          rawType: 'CreateUserDto',
          source: 'src/dto.ts',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'email', type: 'string', required: true },
            { name: 'age', type: 'number', required: false },
            { name: 'phone', type: 'string', required: false },
          ],
        },
      }),
    ]

    const diff = await diffScan(routes, outputDir)

    expect(diff.modified).toHaveLength(1)
    expect(diff.modified[0].changes.some((c) => c.includes('phone'))).toBe(true)
  })
})

describe('Merger', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'carmelia-merge-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('should preserve user-customized values when merging', async () => {
    // Existing file has custom values "John" and "john@test.com"
    const existingPath = join(tmpDir, 'create-user.http')
    await writeFile(existingPath, EXISTING_CREATE_USER)

    // Route now has a new field "phone"
    const route = makeRoute({
      method: 'POST',
      handlerName: 'createUser',
      fullPath: '/users',
      body: {
        rawType: 'CreateUserDto',
        source: 'src/dto.ts',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'email', type: 'string', required: true },
          { name: 'age', type: 'number', required: false },
          { name: 'phone', type: 'string', required: false },
        ],
      },
    })

    const merged = await mergeRoute(route, existingPath, DEFAULT_CONFIG)

    // Should have the new field
    expect(merged).toContain('"phone"')
    // Should preserve user-customized values
    expect(merged).toContain('"John"')
    expect(merged).toContain('"john@test.com"')
    // "age": 0 is a placeholder, should NOT be preserved
    expect(merged).toContain('"age": 0')
  })

  it('should mark file as deprecated', async () => {
    const filePath = join(tmpDir, 'old.http')
    await writeFile(filePath, 'GET {{base_url}}/old\n')

    const result = await markDeprecated(filePath)

    expect(result).toContain('# DEPRECATED')
    expect(result).toContain('GET {{base_url}}/old')
  })

  it('should not add duplicate deprecation markers', async () => {
    const filePath = join(tmpDir, 'old.http')
    await writeFile(filePath, '# DEPRECATED — This route was removed\n\nGET {{base_url}}/old\n')

    const result = await markDeprecated(filePath)

    const count = (result.match(/# DEPRECATED/g) || []).length
    expect(count).toBe(1)
  })
})

describe('syncRoutes', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'carmelia-syncroutes-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('should create new files for added routes', async () => {
    const routes = [
      makeRoute(),
      makeRoute({ handlerName: 'getUser', fullPath: '/users/:id', path: '/:id' }),
    ]

    const result = await syncRoutes(routes, DEFAULT_CONFIG, tmpDir)

    expect(result.created).toHaveLength(2)
    expect(existsSync(join(tmpDir, '.carmelia/requests/users/list-users.http'))).toBe(true)
    expect(existsSync(join(tmpDir, '.carmelia/requests/users/get-user.http'))).toBe(true)
  })

  it('should update modified files', async () => {
    const outputDir = join(tmpDir, '.carmelia/requests')
    await mkdir(join(outputDir, 'users'), { recursive: true })
    await writeFile(join(outputDir, 'users/create-user.http'), EXISTING_CREATE_USER)

    const routes = [
      makeRoute({
        method: 'POST',
        handlerName: 'createUser',
        fullPath: '/users',
        body: {
          rawType: 'CreateUserDto',
          source: 'src/dto.ts',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'email', type: 'string', required: true },
            { name: 'age', type: 'number', required: false },
            { name: 'phone', type: 'string', required: false },
          ],
        },
      }),
    ]

    const result = await syncRoutes(routes, DEFAULT_CONFIG, tmpDir)

    expect(result.updated).toHaveLength(1)
    expect(result.updated[0]).toBe('users/create-user.http')

    // Verify the file was updated
    const content = await readFile(join(outputDir, 'users/create-user.http'), 'utf-8')
    expect(content).toContain('"phone"')
    expect(content).toContain('"John"') // preserved custom value
  })

  it('should mark deprecated files', async () => {
    const outputDir = join(tmpDir, '.carmelia/requests')
    await mkdir(join(outputDir, 'users'), { recursive: true })
    await writeFile(join(outputDir, 'users/old-endpoint.http'), 'GET {{base_url}}/old\n')

    const routes: ScannedRoute[] = [] // no routes — everything is deprecated
    const result = await syncRoutes(routes, DEFAULT_CONFIG, tmpDir)

    expect(result.deprecated).toHaveLength(1)

    const content = await readFile(join(outputDir, 'users/old-endpoint.http'), 'utf-8')
    expect(content).toContain('# DEPRECATED')
  })

  it('should not modify files in dry-run mode', async () => {
    const routes = [makeRoute()]

    const result = await syncRoutes(routes, DEFAULT_CONFIG, tmpDir, true)

    expect(result.created).toHaveLength(1)
    // File should NOT have been created
    expect(existsSync(join(tmpDir, '.carmelia/requests/users/list-users.http'))).toBe(false)
  })
})
