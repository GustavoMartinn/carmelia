import type { Request, Response, NextFunction } from 'express'
import type { ZodType } from 'zod'

export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ errors: result.error })
    }
    next()
  }
}
