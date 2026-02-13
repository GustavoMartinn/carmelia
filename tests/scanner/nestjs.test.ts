import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'node:path'
import { NestJSParser } from '../../src/core/scanner/parsers/nestjs.js'
import type { ScannedRoute } from '../../src/core/scanner/types.js'

const FIXTURE_PATH = resolve(__dirname, '../fixtures/nest-project')

describe('NestJS Parser', () => {
  let parser: NestJSParser
  let routes: ScannedRoute[]

  beforeAll(async () => {
    parser = new NestJSParser()
    routes = await parser.scan(FIXTURE_PATH)
  })

  describe('detect', () => {
    it('should detect NestJS project', async () => {
      const detected = await parser.detect(FIXTURE_PATH)
      expect(detected).toBe(true)
    })

    it('should not detect non-NestJS project', async () => {
      const detected = await parser.detect(resolve(__dirname, '../fixtures'))
      expect(detected).toBe(false)
    })
  })

  describe('scan', () => {
    it('should find all endpoints', () => {
      // UsersController: list, get, create, update, delete = 5
      // AuthController: login, register, getProfile = 3
      // HealthController: check = 1
      // Total = 9
      expect(routes.length).toBe(9)
    })

    it('should set framework to nestjs', () => {
      for (const route of routes) {
        expect(route.framework).toBe('nestjs')
      }
    })
  })

  describe('UsersController', () => {
    let userRoutes: ScannedRoute[]

    beforeAll(() => {
      userRoutes = routes.filter((r) => r.groupName === 'UsersController')
    })

    it('should find 5 user endpoints', () => {
      expect(userRoutes.length).toBe(5)
    })

    it('should extract correct HTTP methods', () => {
      const methods = userRoutes.map((r) => `${r.method} ${r.fullPath}`).sort()
      expect(methods).toEqual([
        'DELETE /users/:id',
        'GET /users',
        'GET /users/:id',
        'POST /users',
        'PUT /users/:id',
      ])
    })

    it('should extract path params', () => {
      const getUser = userRoutes.find((r) => r.handlerName === 'getUser')!
      expect(getUser.params).toHaveLength(1)
      expect(getUser.params[0].name).toBe('id')
      expect(getUser.params[0].type).toBe('string')
    })

    it('should extract query params', () => {
      const listUsers = userRoutes.find((r) => r.handlerName === 'listUsers')!
      expect(listUsers.queryParams).toHaveLength(2)
      expect(listUsers.queryParams.map((q) => q.name).sort()).toEqual(['limit', 'page'])
    })

    describe('createUser body (CreateUserDto)', () => {
      let createUser: ScannedRoute

      beforeAll(() => {
        createUser = userRoutes.find((r) => r.handlerName === 'createUser')!
      })

      it('should have a body', () => {
        expect(createUser.body).toBeDefined()
      })

      it('should have rawType CreateUserDto', () => {
        expect(createUser.body!.rawType).toBe('CreateUserDto')
      })

      it('should extract all fields', () => {
        const fieldNames = createUser.body!.fields.map((f) => f.name).sort()
        expect(fieldNames).toEqual(['address', 'age', 'email', 'name', 'role'])
      })

      it('should mark required fields correctly', () => {
        const fields = createUser.body!.fields
        const name = fields.find((f) => f.name === 'name')!
        const age = fields.find((f) => f.name === 'age')!
        expect(name.required).toBe(true)
        expect(age.required).toBe(false) // has @IsOptional() and ?
      })

      it('should extract validation hints', () => {
        const fields = createUser.body!.fields
        const name = fields.find((f) => f.name === 'name')!
        expect(name.validation).toBeDefined()
        expect(name.validation).toContain('string')
        expect(name.validation!.some((v) => v.startsWith('minLength'))).toBe(true)
      })

      it('should extract enum values for role', () => {
        const role = createUser.body!.fields.find((f) => f.name === 'role')!
        expect(role.enum).toBeDefined()
        expect(role.enum).toEqual(['ADMIN', 'USER', 'MODERATOR'])
      })

      it('should resolve nested object (address)', () => {
        const address = createUser.body!.fields.find((f) => f.name === 'address')!
        expect(Array.isArray(address.type)).toBe(true)
        const nestedFields = address.type as Array<{ name: string }>
        expect(nestedFields.map((f) => f.name).sort()).toEqual(['city', 'street', 'zipCode'])
      })
    })

    describe('updateUser body (UpdateUserDto)', () => {
      it('should have all fields as optional', () => {
        const updateUser = userRoutes.find((r) => r.handlerName === 'updateUser')!
        expect(updateUser.body).toBeDefined()
        for (const field of updateUser.body!.fields) {
          expect(field.required).toBe(false)
        }
      })
    })

    it('should not have auth on user endpoints', () => {
      for (const route of userRoutes) {
        expect(route.auth).toBeUndefined()
      }
    })
  })

  describe('AuthController', () => {
    let authRoutes: ScannedRoute[]

    beforeAll(() => {
      authRoutes = routes.filter((r) => r.groupName === 'AuthController')
    })

    it('should find 3 auth endpoints', () => {
      expect(authRoutes.length).toBe(3)
    })

    it('should extract login body (LoginDto)', () => {
      const login = authRoutes.find((r) => r.handlerName === 'login')!
      expect(login.body).toBeDefined()
      expect(login.body!.rawType).toBe('LoginDto')
      const fieldNames = login.body!.fields.map((f) => f.name).sort()
      expect(fieldNames).toEqual(['email', 'password'])
    })

    it('should detect auth on getProfile (method-level guard)', () => {
      const getProfile = authRoutes.find((r) => r.handlerName === 'getProfile')!
      expect(getProfile.auth).toBeDefined()
      expect(getProfile.auth!.type).toBe('bearer')
    })

    it('should not have auth on login', () => {
      const login = authRoutes.find((r) => r.handlerName === 'login')!
      expect(login.auth).toBeUndefined()
    })
  })

  describe('HealthController', () => {
    it('should find 1 health endpoint', () => {
      const healthRoutes = routes.filter((r) => r.groupName === 'HealthController')
      expect(healthRoutes.length).toBe(1)
    })

    it('should be a simple GET without body', () => {
      const health = routes.find((r) => r.groupName === 'HealthController')!
      expect(health.method).toBe('GET')
      expect(health.fullPath).toBe('/health')
      expect(health.body).toBeUndefined()
      expect(health.params).toHaveLength(0)
      expect(health.queryParams).toHaveLength(0)
    })
  })

  describe('source info', () => {
    it('should include source file path', () => {
      for (const route of routes) {
        expect(route.sourceFile).toMatch(/\.controller\.ts$/)
      }
    })

    it('should include source line number', () => {
      for (const route of routes) {
        expect(route.sourceLine).toBeGreaterThan(0)
      }
    })
  })
})
