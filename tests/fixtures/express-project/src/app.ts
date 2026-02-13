import express from 'express'
import { usersRouter } from './routes/users'
import { authRouter } from './routes/auth'
import { healthRouter } from './routes/health'

const app = express()

app.use(express.json())
app.use('/api/users', usersRouter)
app.use('/api/auth', authRouter)
app.use('/health', healthRouter)

export default app
