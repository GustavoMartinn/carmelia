import { Router } from 'express'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.post('/login', login)
router.post('/register', register)
router.get('/profile', requireAuth, getProfile)

function login(req: any, res: any) {
  res.json({ accessToken: 'token' })
}

function register(req: any, res: any) {
  res.status(201).json({})
}

function getProfile(req: any, res: any) {
  res.json({ user: {} })
}

export { router as authRouter }
