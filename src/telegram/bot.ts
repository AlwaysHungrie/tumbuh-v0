import TelegramBot from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import { userService } from '../services/userService'
import { executeTransactions } from '../services/aaveService'

dotenv.config()

// Initialize Telegram bot
export const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, {
  polling: true,
})

export const initializeBot = () => {
  // Handle /hi command
  bot.onText(/\/hi (.+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const accessKey = match![1]
    const username = msg.from?.username || msg.from?.first_name

    try {
      // Find user by access key
      const user = await userService.findUserByAccessKey(accessKey)

      if (!user || !user.walletPrivateKey) {
        bot.sendMessage(
          chatId,
          "Oops! That access key doesn't look right 😅\n\n" +
            'Try sending it like this:\n' +
            '/hi AB-1234'
        )
        return
      }

      // Update user's telegram ID and ensure they're active
      await userService.addTelegramId(accessKey, chatId.toString())
      await userService.resetUser(user.id)

      bot.sendMessage(
        chatId,
        `Hey ${username}! 👋\n\n` +
          `Awesome! Your plant wallet is all set up! 🎉\n\n` +
          `I\'ll be sending you requests to water me in exchange for some $$$` +
          `Just keep your notifications on! 💰\n\n` +
          `Let\'s grow together! 🌿`
      )
    } catch (error) {
      console.error('Error handling /hi command:', error)
      bot.sendMessage(
        chatId,
        'Ah shoot, something went wrong 😅\nTry again in a bit!'
      )
    }
  })

  // Handle start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(
      chatId,
      `Hey there! I\'m Tumbuh 🌱\n\n` +
        `I\'m a plant that pays you to water me! How cool is that? \n\n` +
        `Here\'s how to get started:\n` +
        `1. Grab your access key\n` +
        `2. Send me a message /hi YOUR-ACCESS-KEY\n\n` +
        `Like this: /hi XY-8765\n\n` +
        `Once you\'re in, I\'ll start paying you to water me!`
    )
  })

  console.log('Telegram bot initialized successfully')
}
