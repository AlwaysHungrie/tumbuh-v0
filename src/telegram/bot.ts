import TelegramBot from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import { userService } from '../services/userService'
import { executeTransactions } from '../services/aaveService'
import { getWithdrawableUSDC } from '../services/aaveService'
import { prisma } from '../prisma'

dotenv.config()

// Initialize Telegram bot
export const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, {
  polling: true,
})

const DEATH_THRESHOLD = 2 // Number of missed reminders before deactivation
const INTERVAL_TIME = 20 * 1000 // 1 minute

const sendReminder = async (
  chatId: string,
  username: string,
  availableFunds: string,
  userId: number
) => {
  const reminderMessage = `
  
Hey ${username}! 🌱 *rustles leaves nervously* 

I'm getting a bit thirsty over here!
I've been growing and saved up ${availableFunds} USDC - I'd love to pay you for some water! 

Can you help a thirsty plant out? Please reply to this message.
`

  try {
    const sentMessage = await bot.sendMessage(chatId, reminderMessage)
    // Create a new request
    await prisma.request.create({
      data: {
        userId,
        amount: availableFunds,
        messageId: sentMessage.message_id.toString(),
      },
    })
    // Update last reminder timestamp
    await userService.updateLastReminder(userId)
  } catch (error) {
    console.error(`Failed to send reminder to ${chatId}:`, error)
  }
}

const startReminderLoop = async () => {
  try {
    const users = await userService.getAllActiveUsers()

    for (const user of users) {
      if (!user.telegramId || !user.walletPrivateKey) continue

      // Check death condition first
      if (user.missedReminders >= DEATH_THRESHOLD) {
        await userService.deactivateUser(user.id)
        await bot.sendMessage(
          user.telegramId,
          `*wilts sadly* 🌱\n\nI haven't heard from you in a while... I guess we were just not meant to be. Goodbye! 👋`
        )
        continue // Skip sending reminder to dead users
      }

      const withdrawableAmount = await getWithdrawableUSDC(
        user.walletPrivateKey
      )
      const interestGenerated =
        parseFloat(withdrawableAmount) -
        parseFloat(user.initialInvestmentAmount.toString())
      const availableFunds = (
        interestGenerated - parseFloat(user.profitCommitted)
      ).toFixed(8)

      await sendReminder(
        user.telegramId,
        user.username!,
        availableFunds,
        user.id
      )
      await userService.incrementMissedReminders(user.id)
    }
  } catch (error) {
    console.error('Error in reminder loop:', error)
  }
}

export const initializeBot = () => {
  // Handle /hi command
  bot.onText(/\/hi (.+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const accessKey = match![1]

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
      await userService.resetMissedReminders(user.id)

      bot.sendMessage(
        chatId,
        `Hey ${user.username}! 👋\n\n` +
          `Awesome! Your plant wallet is all set up!\n` +
          `I\'ll be sending you requests to water me in exchange for some $$$.\n` +
          `Just keep your notifications on!\n\n` +
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

  // Handle message replies
  bot.on('message', async (msg) => {
    // Only process replies to bot messages
    if (!msg.reply_to_message?.from?.is_bot) return

    const chatId = msg.chat.id
    try {
      const user = await userService.findUserByTelegramId(chatId.toString())
      if (!user) return

      // Find the request for this message
      const request = await prisma.request.findFirst({
        where: {
          userId: user.id,
          messageId: msg.reply_to_message.message_id.toString(),
          isResponded: false,
        },
      })

      if (!request) {
        await bot.sendMessage(
          chatId,
          `Oops! This request has already been responded to or is no longer valid. 🌿`
        )
        return
      }

      // Check if request is still valid (within 60 seconds)
      const requestAge = Date.now() - request.createdAt.getTime()
      if (requestAge > INTERVAL_TIME) {
        await bot.sendMessage(
          chatId,
          `Sorry! This request has expired. I'll send you a new one soon! 🌿`
        )
        return
      }

      // Mark request as responded
      await prisma.request.update({
        where: { id: request.id },
        data: { isResponded: true },
      })

      // Reset missed reminders when user responds
      await userService.resetUser(user.id)
      await userService.addProfitCommitted(user.id, request.amount)

      // Send confirmation message
      await bot.sendMessage(
        chatId,
        `Thanks for responding! 🌿\nI'll keep growing and let you know when I need water again! 💧`
      )
    } catch (error) {
      console.error('Error handling message reply:', error)
    }
  })

  // Start reminder loop
  // setInterval(startReminderLoop, 30 * 60 * 1000) // Run every 30 minutes
  // Run every 60 seconds
  setInterval(startReminderLoop, INTERVAL_TIME)
  startReminderLoop() // Run immediately on startup

  console.log('Telegram bot initialized successfully')
}
