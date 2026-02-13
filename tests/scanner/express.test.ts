import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'node:path'
import { ExpressParser } from '../../src/core/scanner/parsers/express.js'
import type { ScannedRoute } from '../../src/core/scanner/types.js'

const FIXTURE_PATH = resolve(__dirname, '../fixtures/express-project')

describe('Express Parser', () => {
  let parser: ExpressParser
  let routes: ScannedRoute[]

  beforeAll(async () => {
    parser = new ExpressParser()
    routes = await parser.scan(FIXTURE_PATH)
  })

  describe('detect', () => {
    it('should detect Express project', async () => {
      expect(await parser.detect(FIXTURE_PATH)).toBe(true)
    })

    it('should not detect non-Express project', async () => {
      expect(await parser.detect(resolve(__dirname, '../fixtures'))).toBe(false)
    })
  })

  describe('scan', () => {
    it('should find all endpoints', () => {
      // users: list, get, create, update, delete = 5
      // auth: login, register, getProfile = 3
      // health: healthCheck = 1
      // Total = 9
      expect(routes.length).toBe(9)
    })

    it('should set framework to express', () => {
      for (const route of routes) {
        expect(route.framework).toBe('express')
      }
    })

    it('should include source file for all routes', () => {
      for (const route of routes) {
        expect(route.sourceFile).toMatch(/\.ts$/)
      }
    })

    it('should include source line for all routes', () => {
      for (const route of routes) {
        expect(route.sourceLine).toBeGreaterThan(0)
      }
    })
  })

  describe('users routes', () => {
    let userRoutes: ScannedRoute[]

    beforeAll(() => {
      userRoutes = routes.filter((r) => r.groupName === 'users')
    })

    it('should find 5 user endpoints', () => {
      expect(userRoutes.length).toBe(5)
    })

    it('should extract correct HTTP methods and paths', () => {
      const endpoints = userRoutes.map((r) => `${r.method} ${r.fullPath}`).sort()
      expect(endpoints).toEqual([
        'DELETE /api/users/:id',
        'GET /api/users',
        'GET /api/users/:id',
        'POST /api/users',
        'PUT /api/users/:id',
      ])
    })

    it('should resolve prefix from app.use mount', () => {
      for (const route of userRoutes) {
        expect(route.fullPath).toMatch(/^\/api\/users/)
      }
    })

    it('should extract path params', () => {
      const getUser = userRoutes.find((r) => r.handlerName === 'getUser')!
      expect(getUser.params).toHaveLength(1)
      expect(getUser.params[0].name).toBe('id')
    })

    it('should extract handler names', () => {
      const names = userRoutes.map((r) => r.handlerName).sort()
      expect(names).toEqual(['createUser', 'deleteUser', 'getUser', 'listUsers', 'updateUser'])
    })

    describe('createUser body (zod schema)', () => {
      let createUser: ScannedRoute

      beforeAll(() => {
        createUser = userRoutes.find((r) => r.handlerName === 'createUser')!
      })

      it('should have a body', () => {
        expect(createUser.body).toBeDefined()
      })

      it('should reference the zod schema as rawType', () => {
        expect(createUser.body!.rawType).toBe('createUserSchema')
      })

      it('should extract fields from zod schema', () => {
        const fieldNames = createUser.body!.fields.map((f) => f.name).sort()
        expect(fieldNames).toEqual(['age', 'email', 'name', 'password'])
      })

      it('should mark required fields', () => {
        const fields = createUser.body!.fields
        const name = fields.find((f) => f.name === 'name')!
        const age = fields.find((f) => f.name === 'age')!
        expect(name.required).toBe(true)
        expect(age.required).toBe(false)
      })

      it('should resolve field types', () => {
        const fields = createUser.body!.fields
        expect(fields.find((f) => f.name === 'name')!.type).toBe('string')
        expect(fields.find((f) => f.name === 'email')!.type).toBe('string')
        expect(fields.find((f) => f.name === 'age')!.type).toContain('number')
      })
    })

    describe('updateUser body (zod schema)', () => {
      it('should have a body with optional fields', () => {
        const updateUser = userRoutes.find((r) => r.handlerName === 'updateUser')!
        expect(updateUser.body).toBeDefined()
        expect(updateUser.body!.rawType).toBe('updateUserSchema')
      })
    })

    it('should not have auth on user endpoints', () => {
      for (const route of userRoutes) {
        expect(route.auth).toBeUndefined()
      }
    })
  })

  describe('auth routes', () => {
    let authRoutes: ScannedRoute[]

    beforeAll(() => {
      authRoutes = routes.filter((r) => r.groupName === 'auth')
    })

    it('should find 3 auth endpoints', () => {
      expect(authRoutes.length).toBe(3)
    })

    it('should resolve prefix /api/auth', () => {
      for (const route of authRoutes) {
        expect(route.fullPath).toMatch(/^\/api\/auth/)
      }
    })

    it('should detect auth middleware on getProfile', () => {
      const getProfile = authRoutes.find((r) => r.handlerName === 'getProfile')!
      expect(getProfile.auth).toBeDefined()
      expect(getProfile.auth!.type).toBe('bearer')
    })

    it('should not have auth on login', () => {
      const login = authRoutes.find((r) => r.handlerName === 'login')!
      expect(login.auth).toBeUndefined()
    })

    it('should not have body on GET /profile', () => {
      const getProfile = authRoutes.find((r) => r.handlerName === 'getProfile')!
      expect(getProfile.body).toBeUndefined()
    })
  })

  describe('health routes', () => {
    let healthRoutes: ScannedRoute[]

    beforeAll(() => {
      healthRoutes = routes.filter((r) => r.groupName === 'health')
    })

    it('should find 1 health endpoint', () => {
      expect(healthRoutes.length).toBe(1)
    })

    it('should be GET with correct prefix', () => {
      const health = healthRoutes[0]
      expect(health.method).toBe('GET')
      expect(health.fullPath).toBe('/health')
    })

    it('should have no body', () => {
      expect(healthRoutes[0].body).toBeUndefined()
    })
  })
})
