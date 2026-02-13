import { Router } from 'express'
import { validate } from '../middleware/validate'
import { createUserSchema, updateUserSchema } from '../schemas/user.schema'

const router = Router()

router.get('/', listUsers)
router.get('/:id', getUser)
router.post('/', validate(createUserSchema), createUser)
router.put('/:id', validate(updateUserSchema), updateUser)
router.delete('/:id', deleteUser)

function listUsers(req: any, res: any) {
  res.json([])
}

function getUser(req: any, res: any) {
  res.json({})
}

function createUser(req: any, res: any) {
  res.status(201).json(req.body)
}

function updateUser(req: any, res: any) {
  res.json(req.body)
}

function deleteUser(req: any, res: any) {
  res.status(204).send()
}

export { router as usersRouter }
