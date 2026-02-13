import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { resolve, join } from 'node:path'
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { generateHttpFiles } from '../../src/core/generator/index.js'
import { renderHttpFile } from '../../src/core/generator/templates.js'
import { groupDirName, requestFileName } from '../../src/core/generator/naming.js'
import { DEFAULT_CONFIG } from '../../src/core/config/types.js'
import type { ScannedRoute } from '../../src/core/scanner/types.js'

// Sample routes that represent the same API from different frameworks
const sampleRoutes: ScannedRoute[] = [
  {
    method: 'GET',
    path: '/',
    fullPath: '/users',
    groupName: 'UsersController',
    handlerName: 'listUsers',
    sourceFile: 'src/users/users.controller.ts',
    sourceLine: 10,
    framework: 'nestjs',
    params: [],
    queryParams: [
      { name: 'page', type: 'number', required: false },
      { name: 'limit', type: 'number', required: false },
    ],
    headers: [],
  },
  {
    method: 'GET',
    path: '/:id',
    fullPath: '/users/:id',
    groupName: 'UsersController',
    handlerName: 'getUser',
    sourceFile: 'src/users/users.controller.ts',
    sourceLine: 15,
    framework: 'nestjs',
    params: [{ name: 'id', type: 'string', required: true }],
    queryParams: [],
    headers: [],
  },
  {
    method: 'POST',
    path: '/',
    fullPath: '/users',
    groupName: 'UsersController',
    handlerName: 'createUser',
    sourceFile: 'src/users/users.controller.ts',
    sourceLine: 20,
    framework: 'nestjs',
    params: [],
    queryParams: [],
    body: {
      rawType: 'CreateUserDto',
      source: 'src/users/dto/create-user.dto.ts',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'age', type: 'number', required: false },
        { name: 'role', type: 'string', required: true, enum: ['ADMIN', 'USER'] },
        {
          name: 'address',
          type: [
            { name: 'street', type: 'string', required: true },
            { name: 'city', type: 'string', required: true },
            { name: 'zipCode', type: 'string', required: true },
          ],
          required: true,
        },
      ],
    },
    headers: [],
  },
  {
    method: 'DELETE',
    path: '/:id',
    fullPath: '/users/:id',
    groupName: 'UsersController',
    handlerName: 'deleteUser',
    sourceFile: 'src/users/users.controller.ts',
    sourceLine: 30,
    framework: 'nestjs',
    params: [{ name: 'id', type: 'string', required: true }],
    queryParams: [],
    headers: [],
  },
  {
    method: 'POST',
    path: '/login',
    fullPath: '/auth/login',
    groupName: 'AuthController',
    handlerName: 'login',
    sourceFile: 'src/auth/auth.controller.ts',
    sourceLine: 8,
    framework: 'nestjs',
    params: [],
    queryParams: [],
    body: {
      rawType: 'LoginDto',
      source: 'src/auth/dto/login.dto.ts',
      fields: [
        { name: 'email', type: 'string', required: true },
        { name: 'password', type: 'string', required: true },
      ],
    },
    headers: [],
  },
  {
    method: 'GET',
    path: '/profile',
    fullPath: '/auth/profile',
    groupName: 'AuthController',
    handlerName: 'getProfile',
    sourceFile: 'src/auth/auth.controller.ts',
    sourceLine: 15,
    framework: 'nestjs',
    params: [],
    queryParams: [],
    headers: [],
    auth: { type: 'bearer' },
  },
  {
    method: 'GET',
    path: '/',
    fullPath: '/health',
    groupName: 'HealthController',
    handlerName: 'check',
    sourceFile: 'src/health/health.controller.ts',
    sourceLine: 5,
    framework: 'nestjs',
    params: [],
    queryParams: [],
    headers: [],
  },
]

describe('Generator', () => {
  describe('naming', () => {
    it('should convert group names to kebab-case dirs', () => {
      expect(groupDirName('UsersController')).toBe('users')
      expect(groupDirName('AuthController')).toBe('auth')
      expect(groupDirName('HealthController')).toBe('health')
      expect(groupDirName('UserOrdersHandler')).toBe('user-orders')
      expect(groupDirName('auth')).toBe('auth')
    })

    it('should convert handler names to kebab-case filenames', () => {
      expect(requestFileName({ handlerName: 'createUser' } as ScannedRoute)).toBe('create-user.http')
      expect(requestFileName({ handlerName: 'listUsers' } as ScannedRoute)).toBe('list-users.http')
      expect(requestFileName({ handlerName: 'getUser' } as ScannedRoute)).toBe('get-user.http')
      expect(requestFileName({ handlerName: 'HealthCheck' } as ScannedRoute)).toBe('health-check.http')
    })
  })

  describe('renderHttpFile', () => {
    it('should render a simple GET request', () => {
      const route = sampleRoutes.find((r) => r.handlerName === 'check')!
      const output = renderHttpFile(route, true)

      expect(output).toContain('GET {{base_url}}/health')
      expect(output).toContain('# Auto-generated from HealthController.check()')
      expect(output).toContain('# Source: src/health/health.controller.ts:5')
      expect(output).not.toContain('Content-Type')
      // Should not contain a JSON body (only {{ template vars are ok)
      expect(output).not.toContain('"name"')
    })

    it('should render a GET request with query params', () => {
      const route = sampleRoutes.find((r) => r.handlerName === 'listUsers')!
      const output = renderHttpFile(route, true)

      expect(output).toContain('GET {{base_url}}/users?page={{page}}&limit={{limit}}')
    })

    it('should render a GET request with path params', () => {
      const route = sampleRoutes.find((r) => r.handlerName === 'getUser')!
      const output = renderHttpFile(route, true)

      expect(output).toContain('GET {{base_url}}/users/{{id}}')
    })

    it('should render a POST request with body', () => {
      const route = sampleRoutes.find((r) => r.handlerName === 'createUser')!
      const output = renderHttpFile(route, true)

      expect(output).toContain('POST {{base_url}}/users')
      expect(output).toContain('Content-Type: application/json')
      expect(output).toContain('# Body: CreateUserDto')
      expect(output).toContain('"name": "string"')
      expect(output).toContain('"email": "string"')
      expect(output).toContain('"age": 0')
      expect(output).toContain('"role": "ADMIN | USER"')
    })

    it('should render nested objects in body', () => {
      const route = sampleRoutes.find((r) => r.handlerName === 'createUser')!
      const output = renderHttpFile(route, true)

      expect(output).toContain('"address": {')
      expect(output).toContain('"street": "string"')
      expect(output).toContain('"city": "string"')
      expect(output).toContain('"zipCode": "string"')
    })

    it('should render auth header for authenticated routes', () => {
      const route = sampleRoutes.find((r) => r.handlerName === 'getProfile')!
      const output = renderHttpFile(route, true)

      expect(output).toContain('Authorization: Bearer {{token}}')
    })

    it('should not render auth header for non-authenticated routes', () => {
      const route = sampleRoutes.find((r) => r.handlerName === 'listUsers')!
      const output = renderHttpFile(route, true)

      expect(output).not.toContain('Authorization')
    })

    it('should not include comments when disabled', () => {
      const route = sampleRoutes.find((r) => r.handlerName === 'check')!
      const output = renderHttpFile(route, false)

      expect(output).not.toContain('#')
      expect(output).toContain('GET {{base_url}}/health')
    })

    it('should not add Content-Type for DELETE without body', () => {
      const route = sampleRoutes.find((r) => r.handlerName === 'deleteUser')!
      const output = renderHttpFile(route, true)

      expect(output).toContain('DELETE {{base_url}}/users/{{id}}')
      expect(output).not.toContain('Content-Type')
    })
  })

  describe('generateHttpFiles', () => {
    let tmpDir: string

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'carmelia-test-'))
    })

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true })
    })

    it('should create output directory and group folders', async () => {
      const result = await generateHttpFiles(sampleRoutes, DEFAULT_CONFIG, tmpDir)
      const outputDir = join(tmpDir, '.carmelia/requests')

      expect(existsSync(outputDir)).toBe(true)
      expect(existsSync(join(outputDir, 'users'))).toBe(true)
      expect(existsSync(join(outputDir, 'auth'))).toBe(true)
      expect(existsSync(join(outputDir, 'health'))).toBe(true)
    })

    it('should create all .http files', async () => {
      const result = await generateHttpFiles(sampleRoutes, DEFAULT_CONFIG, tmpDir)

      expect(result.created.length).toBe(7)
      expect(result.created).toContain('users/list-users.http')
      expect(result.created).toContain('users/get-user.http')
      expect(result.created).toContain('users/create-user.http')
      expect(result.created).toContain('users/delete-user.http')
      expect(result.created).toContain('auth/login.http')
      expect(result.created).toContain('auth/get-profile.http')
      expect(result.created).toContain('health/check.http')
    })

    it('should write valid .http content', async () => {
      await generateHttpFiles(sampleRoutes, DEFAULT_CONFIG, tmpDir)

      const content = await readFile(
        join(tmpDir, '.carmelia/requests/users/create-user.http'),
        'utf-8',
      )

      expect(content).toContain('POST {{base_url}}/users')
      expect(content).toContain('Content-Type: application/json')
      expect(content).toContain('"name": "string"')
    })

    it('should not overwrite existing files', async () => {
      // Generate once
      await generateHttpFiles(sampleRoutes, DEFAULT_CONFIG, tmpDir)

      // Generate again — should skip existing
      const result = await generateHttpFiles(sampleRoutes, DEFAULT_CONFIG, tmpDir)

      expect(result.created.length).toBe(0)
      expect(result.skipped.length).toBe(7)
    })

    it('should produce same output regardless of framework field', async () => {
      // Same route but tagged as "express" instead of "nestjs"
      const expressRoute: ScannedRoute = {
        ...sampleRoutes.find((r) => r.handlerName === 'createUser')!,
        framework: 'express',
      }
      const nestRoute = sampleRoutes.find((r) => r.handlerName === 'createUser')!

      const nestOutput = renderHttpFile(nestRoute, false)
      const expressOutput = renderHttpFile(expressRoute, false)

      // The generated .http content should be identical (framework-agnostic)
      expect(nestOutput).toBe(expressOutput)
    })
  })
})
