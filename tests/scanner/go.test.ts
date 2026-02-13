import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'node:path'
import { GoParser } from '../../src/core/scanner/parsers/go.js'
import type { ScannedRoute } from '../../src/core/scanner/types.js'

const FIXTURE_PATH = resolve(__dirname, '../fixtures/go-project')

describe('Go Parser', () => {
  let parser: GoParser
  let routes: ScannedRoute[]

  beforeAll(async () => {
    parser = new GoParser()
    routes = await parser.scan(FIXTURE_PATH)
  })

  describe('detect', () => {
    it('should detect Go project (go.mod exists)', async () => {
      expect(await parser.detect(FIXTURE_PATH)).toBe(true)
    })

    it('should not detect non-Go project', async () => {
      expect(await parser.detect(resolve(__dirname, '../fixtures'))).toBe(false)
    })
  })

  describe('scan', () => {
    it('should find all endpoints', () => {
      // /health = 1
      // /users: list, get, create, update, delete = 5
      // /auth: login = 1
      // /profile: getProfile = 1
      // Total = 8
      expect(routes.length).toBe(8)
    })

    it('should set framework to go', () => {
      for (const route of routes) {
        expect(route.framework).toBe('go')
      }
    })

    it('should include source file for all routes', () => {
      for (const route of routes) {
        expect(route.sourceFile).toMatch(/\.go$/)
      }
    })

    it('should include source line for all routes', () => {
      for (const route of routes) {
        expect(route.sourceLine).toBeGreaterThan(0)
      }
    })
  })

  describe('health endpoint', () => {
    it('should find standalone GET /health', () => {
      const health = routes.find((r) => r.fullPath === '/health')
      expect(health).toBeDefined()
      expect(health!.method).toBe('GET')
      expect(health!.handlerName).toBe('HealthCheck')
      expect(health!.body).toBeUndefined()
    })
  })

  describe('users routes (chi r.Route group)', () => {
    let userRoutes: ScannedRoute[]

    beforeAll(() => {
      userRoutes = routes.filter((r) => r.fullPath.startsWith('/users'))
    })

    it('should find 5 user endpoints', () => {
      expect(userRoutes.length).toBe(5)
    })

    it('should extract correct HTTP methods and paths', () => {
      const endpoints = userRoutes.map((r) => `${r.method} ${r.fullPath}`).sort()
      expect(endpoints).toEqual([
        'DELETE /users/{id}',
        'GET /users',
        'GET /users/{id}',
        'POST /users',
        'PUT /users/{id}',
      ])
    })

    it('should extract path params from {id}', () => {
      const getUser = userRoutes.find((r) => r.fullPath === '/users/{id}' && r.method === 'GET')!
      expect(getUser.params).toHaveLength(1)
      expect(getUser.params[0].name).toBe('id')
    })

    it('should extract handler names', () => {
      const names = userRoutes.map((r) => r.handlerName).sort()
      expect(names).toContain('CreateUser')
      expect(names).toContain('ListUsers')
      expect(names).toContain('GetUser')
      expect(names).toContain('UpdateUser')
      expect(names).toContain('DeleteUser')
    })

    describe('CreateUser body (CreateUserRequest struct)', () => {
      let createUser: ScannedRoute

      beforeAll(() => {
        createUser = userRoutes.find((r) => r.handlerName === 'CreateUser')!
      })

      it('should have a body', () => {
        expect(createUser.body).toBeDefined()
      })

      it('should reference the struct as rawType', () => {
        expect(createUser.body!.rawType).toBe('CreateUserRequest')
      })

      it('should extract fields from struct with json tags', () => {
        const fieldNames = createUser.body!.fields.map((f) => f.name).sort()
        expect(fieldNames).toEqual(['address', 'age', 'email', 'name', 'role'])
      })

      it('should mark required/optional based on omitempty', () => {
        const fields = createUser.body!.fields
        const name = fields.find((f) => f.name === 'name')!
        const age = fields.find((f) => f.name === 'age')!
        expect(name.required).toBe(true)
        expect(age.required).toBe(false) // has omitempty
      })

      it('should extract validation tags', () => {
        const fields = createUser.body!.fields
        const email = fields.find((f) => f.name === 'email')!
        expect(email.validation).toBeDefined()
        expect(email.validation).toContain('required')
        expect(email.validation).toContain('email')
      })

      it('should resolve nested struct (Address)', () => {
        const address = createUser.body!.fields.find((f) => f.name === 'address')!
        expect(Array.isArray(address.type)).toBe(true)
        const nested = address.type as Array<{ name: string }>
        expect(nested.map((f) => f.name).sort()).toEqual(['city', 'street', 'zip_code'])
      })
    })

    describe('UpdateUser body (UpdateUserRequest struct)', () => {
      it('should have a body with all optional fields', () => {
        const updateUser = userRoutes.find((r) => r.handlerName === 'UpdateUser')!
        expect(updateUser.body).toBeDefined()
        for (const field of updateUser.body!.fields) {
          expect(field.required).toBe(false) // all have omitempty
        }
      })
    })

    it('should not have auth on user routes', () => {
      for (const route of userRoutes) {
        expect(route.auth).toBeUndefined()
      }
    })
  })

  describe('auth routes', () => {
    it('should find POST /auth/login', () => {
      const login = routes.find((r) => r.fullPath === '/auth/login')
      expect(login).toBeDefined()
      expect(login!.method).toBe('POST')
    })

    it('should extract LoginRequest body', () => {
      const login = routes.find((r) => r.fullPath === '/auth/login')!
      expect(login.body).toBeDefined()
      expect(login.body!.rawType).toBe('LoginRequest')
      const fieldNames = login.body!.fields.map((f) => f.name).sort()
      expect(fieldNames).toEqual(['email', 'password'])
    })
  })

  describe('profile routes (with auth middleware)', () => {
    it('should find GET /profile', () => {
      const profile = routes.find((r) => r.fullPath === '/profile')
      expect(profile).toBeDefined()
      expect(profile!.method).toBe('GET')
    })

    it('should detect auth from r.Use(middleware.RequireAuth)', () => {
      const profile = routes.find((r) => r.fullPath === '/profile')!
      expect(profile.auth).toBeDefined()
      expect(profile.auth!.type).toBe('bearer')
    })
  })
})
