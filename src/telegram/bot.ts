import TelegramBot from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import { getWithdrawableUSDC, withdrawUSDC } from '../services/aaveService'
import { prisma } from '../prisma'
import { generateAccessKey } from '../services/randomService'

dotenv.config()

// Constants
const DEATH_THRESHOLD = 2 // Number of missed reminders before deactivation
const INTERVAL_TIME = parseInt(process.env.TIME_INTERVAL_MINTUES!) * 60 * 1000

// Allow withdrawals only once every 24 hours
const WITHDRAWAL_INTERVAL = parseInt(process.env.WITHDRAWAL_INTERVAL_HOURS!) * 60 * 60 * 1000

const MESSAGE_TEMPLATES = {
  WELCOME:
    `Hey there! I'm Tumbuh 🌱\n\n` +
    `I'm a plant that pays you to water me! How cool is that? \n\n` +
    `Here's how to get started:\n` +
    `1. Grab your access key\n` +
    `2. Send me a message /hi YOUR-ACCESS-KEY\n\n` +
    `Like this: /hi XY-8765\n\n` +
    `Once you're in, I'll start paying you to water me!`,

  INVALID_ACCESS_KEY:
    "Oops! That access key doesn't look right 😅\n\n" +
    'Try sending it like this:\n' +
    '/hi AB-1234',

  SETUP_COMPLETE: (username: string) =>
    `Hey ${username}! 👋\n\n` +
    `Awesome! My wallet is all set up!\n` +
    `I'll be sending you requests to water me in exchange for some $$$ from now on.\n` +
    `Just keep your notifications on!\n\n` +
    `Let's grow together! 🌿`,

  ERROR_MESSAGE: 'Ah shoot, something went wrong 😅\nTry again in a bit!',

  PLANT_DEATH: `*wilts sadly* 🌱\n\nI haven't heard from you in a while... I guess we were just not meant to be. Goodbye! 👋`,

  REQUEST_EXPIRED: `Sorry! This request has expired. I'll send you a new one soon! 🌿`,

  REQUEST_ALREADY_RESPONDED: `Oops! This request has already been responded to or is no longer valid. 🌿`,

  THANKS_FOR_RESPONDING: (amount: string, totalBalance: string) =>
    `Thank you! \nI'll keep growing, see you soon! \n\n` +
    `I've added ${amount} USDC to your wallet. You have ${totalBalance} USDC in your plant wallet.`,

  WITHDRAW_SUCCESS: (amount: string, address: string, txHash: string) =>
    `Successfully withdrew ${amount} USDC to ${address}! 💰\n\n` +
    `Transaction hash: https://scrollscan.com/tx/${txHash}`,

  WITHDRAW_NO_PROFIT: `You don't have any committed profits to withdraw yet! Keep watering me to earn more! 💧`,

  WITHDRAW_ERROR: `Oops! Something went wrong while trying to withdraw. Please try again later!`,

  WITHDRAW_INVALID_ADDRESS: `That doesn't look like a valid Ethereum address! Please provide a valid address.`,

  WITHDRAW_INVALID_FORMAT: `Please use the withdraw command like this:\n/withdraw 0xYourEthereumAddress\n\nFor example: /withdraw 0x1234...`,

  WITHDRAW_TOO_SOON: `You can only withdraw once every 24 hours!`,
}

// Initialize Telegram bot
export const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, {
  polling: true,
})

/**
 * Sends a reminder message to a user about watering their plant
 */
const sendReminder = async (
  chatId: string,
  username: string,
  availableFunds: string,
  userId: number
): Promise<void> => {
  const reminderMessage = `
Hey ${username}!

I'm getting a bit thirsty over here!
I've been growing and saved up ${availableFunds} USDC - I'd love to pay you for some water! 

Can you help a thirsty plant out? 
Please reply "Done" to this message.

🌱🌱🌱
`

  try {
    const sentMessage = await bot.sendMessage(chatId, reminderMessage)

    // Create a new request and update last reminder timestamp
    await Promise.all([
      prisma.request.create({
        data: {
          userId,
          amount: availableFunds,
          messageId: sentMessage.message_id.toString(),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { lastReminderAt: new Date() },
      }),
    ])
  } catch (error) {
    console.error(`Failed to send reminder to ${chatId}:`, error)
  }
}

/**
 * Processes a single user in the reminder loop
 */
const processUser = async (user: any): Promise<void> => {
  if (!user.telegramId || !user.walletPrivateKey) return

  // Check death condition
  if (user.missedReminders >= DEATH_THRESHOLD) {
    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      }),
      bot.sendMessage(user.telegramId, MESSAGE_TEMPLATES.PLANT_DEATH),
    ])
    return
  }

  try {
    const withdrawableAmount = await getWithdrawableUSDC(user.walletPrivateKey)
    const interestGenerated =
      parseFloat(withdrawableAmount) -
      parseFloat(user.initialInvestmentAmount.toString())
    const availableFunds = (
      interestGenerated - parseFloat(user.profitCommitted)
    ).toFixed(8)

    await sendReminder(user.telegramId, user.username!, availableFunds, user.id)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        missedReminders: { increment: 1 },
      },
    })
  } catch (error) {
    console.error(`Error processing user ${user.id}:`, error)
  }
}

/**
 * Main reminder loop that checks all active users
 */
const startReminderLoop = async (): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        telegramId: { not: null },
      },
    })
    await Promise.all(users.map(processUser))
  } catch (error) {
    console.error('Error in reminder loop:', error)
  }
}

/**
 * Handles the /hi command for user setup
 */
const handleHiCommand = async (
  chatId: number,
  accessKey: string
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { accessKey },
    })

    if (!user || !user.walletPrivateKey) {
      await bot.sendMessage(chatId, MESSAGE_TEMPLATES.INVALID_ACCESS_KEY)
      return
    }

    const newAccessKey = generateAccessKey()
    await prisma.user.update({
      where: { accessKey },
      data: {
        telegramId: chatId.toString(),
        accessKey: newAccessKey,
        isActive: true,
        lastReminderAt: new Date(),
        missedReminders: 0,
      },
    })

    await bot.sendMessage(
      chatId,
      MESSAGE_TEMPLATES.SETUP_COMPLETE(user.username!)
    )
  } catch (error) {
    console.error('Error handling /hi command:', error)
    await bot.sendMessage(chatId, MESSAGE_TEMPLATES.ERROR_MESSAGE)
  }
}

/**
 * Handles user responses to reminder messages
 */
const handleMessageReply = async (msg: TelegramBot.Message): Promise<void> => {
  if (!msg.reply_to_message?.from?.is_bot) return

  const chatId = msg.chat.id
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: chatId.toString() },
    })
    if (!user) return

    const request = await prisma.request.findFirst({
      where: {
        userId: user.id,
        messageId: msg.reply_to_message.message_id.toString(),
        isResponded: false,
      },
    })

    if (!request) {
      await bot.sendMessage(chatId, MESSAGE_TEMPLATES.REQUEST_ALREADY_RESPONDED)
      return
    }

    const requestAge = Date.now() - request.createdAt.getTime()
    if (requestAge > INTERVAL_TIME) {
      await bot.sendMessage(chatId, MESSAGE_TEMPLATES.REQUEST_EXPIRED)
      return
    }

    const newProfitCommitted = (
      parseFloat(user.profitCommitted) + parseFloat(request.amount)
    ).toString()

    await Promise.all([
      prisma.request.update({
        where: { id: request.id },
        data: { isResponded: true },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          profitCommitted: newProfitCommitted,
          lastReminderAt: new Date(),
          missedReminders: 0,
        },
      }),
    ])

    await bot.sendMessage(
      chatId,
      MESSAGE_TEMPLATES.THANKS_FOR_RESPONDING(
        request.amount,
        newProfitCommitted
      )
    )
  } catch (error) {
    console.error('Error handling message reply:', error)
  }
}

/**
 * Handles the /withdraw command for withdrawing committed profits
 */
const handleWithdrawCommand = async (
  chatId: number,
  address: string
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: chatId.toString() },
    })
    if (!user || !user.walletPrivateKey) {
      await bot.sendMessage(chatId, MESSAGE_TEMPLATES.ERROR_MESSAGE)
      return
    }

    if (user.lastWithdrawalAt && Date.now() - user.lastWithdrawalAt.getTime() < WITHDRAWAL_INTERVAL) {
      await bot.sendMessage(chatId, MESSAGE_TEMPLATES.WITHDRAW_TOO_SOON)
      return
    }

    if (!user.profitCommitted || user.profitCommitted === '0') {
      await bot.sendMessage(chatId, MESSAGE_TEMPLATES.WITHDRAW_NO_PROFIT)
      return
    }

    // Basic Ethereum address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      await bot.sendMessage(chatId, MESSAGE_TEMPLATES.WITHDRAW_INVALID_ADDRESS)
      return
    }

    const withdrawTxHash = await withdrawUSDC(
      user.walletPrivateKey,
      user.profitCommitted,
      address
    )

    const newAccessKey = generateAccessKey()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        accessKey: newAccessKey,
        isActive: true,
        lastReminderAt: new Date(),
        profitCommitted: '0',
        missedReminders: 0,
        lastWithdrawalAt: new Date(),
      },
    })

    await bot.sendMessage(
      chatId,
      MESSAGE_TEMPLATES.WITHDRAW_SUCCESS(
        user.profitCommitted,
        address,
        withdrawTxHash
      )
    )
  } catch (error) {
    console.error('Error handling withdraw command:', error)
    await bot.sendMessage(chatId, MESSAGE_TEMPLATES.WITHDRAW_ERROR)
  }
}

export const initializeBot = (): void => {
  // Handle /hi command
  bot.onText(/\/hi (.+)/, (msg, match) => {
    if (!match) return
    handleHiCommand(msg.chat.id, match[1])
  })

  // Handle start command
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, MESSAGE_TEMPLATES.WELCOME)
  })

  // Handle withdraw command
  bot.onText(/\/withdraw (.+)/, (msg, match) => {
    if (!match) return
    handleWithdrawCommand(msg.chat.id, match[1])
  })

  // Handle withdraw command without address
  bot.onText(/^\/withdraw$/, (msg) => {
    bot.sendMessage(msg.chat.id, MESSAGE_TEMPLATES.WITHDRAW_INVALID_FORMAT)
  })

  // Handle message replies
  bot.on('message', handleMessageReply)

  // Start reminder loop
  setInterval(startReminderLoop, INTERVAL_TIME)
  startReminderLoop() // Run immediately on startup

  console.log('Telegram bot initialized successfully')
}
