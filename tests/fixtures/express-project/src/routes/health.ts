import { Router } from 'express'

const router = Router()

router.get('/', healthCheck)

function healthCheck(req: any, res: any) {
  res.json({ status: 'ok' })
}

export { router as healthRouter }
