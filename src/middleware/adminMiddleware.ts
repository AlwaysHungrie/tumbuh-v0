import express from 'express'

export const adminOnly = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const adminKey = req.headers['admin-key']
  if (adminKey !== process.env.ADMIN_KEY) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
