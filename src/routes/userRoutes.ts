import express from 'express'
import { userService } from '../services/userService'
import { User } from '../../generated/prisma/client'
import { adminOnly } from '../middleware/adminMiddleware'
import { generateAccessKey, generateWallet } from '../services/randomService'
import { sendUSDCFromTumbuh } from '../services/walletService'
import {
  executeTransactions,
  getWithdrawableUSDC,
  withdrawUSDC,
} from '../services/aaveService'
import { tumbuhWallet } from '../wallets'

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
    const checkUser = await userService.findUserByUsername(username)

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

    let user = await userService.createUser(
      accessKey,
      username,
      initialInvestmentAmount,
      address,
      privateKey
    )

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
    const user = await userService.findUserById(parseInt(id))
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

    const reminderMessage = `Hey ${user.username}! 🌱

*rustles leaves nervously* 

I'm getting a bit thirsty over here! 💧 
I've been growing and saved up ${formattedAvailableFunds} USDC - I'd love to pay you for some water! 

Can you help a thirsty plant out? 🌿💰

Let's grow together! 🌱`

    res.json({
      message: reminderMessage,
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

router.post('/:id/withdraw', async (req, res) => {
  try {
    const { id } = req.params
    const user = await userService.findUserById(parseInt(id))
    const withdrawTxHash = await withdrawUSDC(user?.walletPrivateKey!)
    await userService.resetUser(user?.id!)
    res.json({
      withdrawTxHash,
    })
  } catch (error) {
    res.status(400).json({ error: 'Failed to withdraw USDC' })
  }
})

router.post('/:id/reset', adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const user = await userService.resetUser(parseInt(id))
    res.json(user)
  } catch (error) {
    res.status(400).json({ error: 'Failed to reset user' })
  }
})

export default router
