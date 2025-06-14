import express from 'express'
import dotenv from 'dotenv'
import userRoutes from './routes/userRoutes'
import { bot, initializeBot } from './telegram/bot'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Initialize Telegram bot
initializeBot()

// Middleware
app.use(express.json())

// Routes
app.use('/users', userRoutes)

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
