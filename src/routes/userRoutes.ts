import express from 'express'
import { User } from '../../generated/prisma/client'
import { adminOnly } from '../middleware/adminMiddleware'
import { generateAccessKey, generateWallet } from '../services/randomService'
import { sendUSDCFromTumbuh } from '../services/walletService'
import { prisma } from '../prisma'
import {
  executeTransactions,
  getWithdrawableUSDC,
  withdrawUSDC,
} from '../services/aaveService'

const router = express.Router()

export type UserResponse = Omit<User, 'walletPrivateKey'>

const transformToUserResponse = (user: User): UserResponse => {
  const { walletPrivateKey, ...userResponse } = user
  return userResponse
}

router.post('/', adminOnly, async (req, res) => {
  try {
    const { username, initialInvestmentAmount } = req.body
    const accessKey = generateAccessKey()

    // check if user already exists
    const checkUser = await prisma.user.findFirst({
      where: { username },
    })

    if (checkUser) {
      res.status(200).json({
        message: 'User already exists',
        user: transformToUserResponse(checkUser),
      })

      return
    }

    const { address, privateKey } = generateWallet()

    // fund this wallet with initialInvestmentAmount USDC
    const initializeTxHash = await sendUSDCFromTumbuh(
      address!,
      initialInvestmentAmount,
      privateKey
    )

    // Execute transactions
    const { approveTxHash, supplyTxHash } = await executeTransactions(
      privateKey
    )

    let user = await prisma.user.create({
      data: {
        accessKey,
        username,
        initialInvestmentAmount,
        walletAddress: address,
        walletPrivateKey: privateKey,
        isActive: false,
      },
    })

    res.json({
      user: transformToUserResponse(user),
      initializeTxHash,
      approveTxHash,
      supplyTxHash,
    })
  } catch (error) {
    console.log('error:', error)
    res.status(400).json({ error: 'Failed to create user' })
  }
})

router.post('/:id/reminder', async (req, res) => {
  try {
    const { id } = req.params
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
    })
    if (!user || !user.walletPrivateKey) {
      res.status(400).json({ error: 'User not found' })
      return
    }

    // get current price
    const withdrawableAmount = await getWithdrawableUSDC(user.walletPrivateKey)
    console.log('withdrawableAmount:', withdrawableAmount)

    const interestGenerated =
      parseFloat(withdrawableAmount) -
      parseFloat(user.initialInvestmentAmount.toString())

    const availableFunds = interestGenerated - parseFloat(user.profitCommitted)

    // to 8 significant digits
    const formattedAvailableFunds = availableFunds.toFixed(8)

    res.json({
      walletBalance: withdrawableAmount,
      committedFunds: user.profitCommitted,
      availableFunds: formattedAvailableFunds,
    })
    return
  } catch (error) {
    console.log('error:', error)
    res.status(400).json({ error: 'Failed to send reminder' })
  }
})

router.post('/:id/liquidate', async (req, res) => {
  try {
    const { id } = req.params
    const { withdrawAddress = '' } = req.body

    if (!withdrawAddress) {
      res.status(400).json({ error: 'Withdraw address is required' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
    })
    if (!user || !user.walletPrivateKey) {
      res.status(400).json({ error: 'User not found' })
      return
    }

    // liquidate user profit and initial investment amount
    const withdrawTxHash = await withdrawUSDC(
      user?.walletPrivateKey!,
      (
        parseFloat(user?.profitCommitted.toString()) +
        user?.initialInvestmentAmount
      ).toFixed(8),
      withdrawAddress
    )

    const accessKey = generateAccessKey()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        accessKey,
        isActive: true,
        lastReminderAt: new Date(),
        profitCommitted: '0',
        missedReminders: 0,
        telegramId: null,
      },
    })

    // delete all requests for this user
    await prisma.request.deleteMany({
      where: { userId: user.id },
    })

    res.json({
      withdrawTxHash,
    })
  } catch (error) {
    console.log('error:', error)
    res.status(400).json({ error: 'Failed to withdraw USDC' })
  }
})

export default router
