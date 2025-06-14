import express from 'express'
import { userService } from '../services/userService'
import { adminOnly } from '../middleware/adminMiddleware'
import { generateAccessKey, generateWallet } from '../services/randomService'
import { sendUSDCFromTumbuh } from '../services/walletService'
import { executeTransactions, withdrawUSDC } from '../services/aaveService'

const router = express.Router()

router.post('/', adminOnly, async (req, res) => {
  try {
    const { username, initialInvestmentAmount } = req.body
    const accessKey = generateAccessKey()

    // check if user already exists
    const checkUser = await userService.findUserByUsername(username)
    let address = checkUser?.walletAddress
    let privateKey = checkUser?.walletPrivateKey

    if (!address || !privateKey) {
      const { address: newAddress, privateKey: newPrivateKey } =
        generateWallet()
      address = newAddress
      privateKey = newPrivateKey
    }

    // fund this wallet with initialInvestmentAmount USDC
    const initializeTxHash = await sendUSDCFromTumbuh(
      address,
      initialInvestmentAmount,
      privateKey
    )

    // Execute transactions
    const { approveTxHash, supplyTxHash } = await executeTransactions(
      privateKey
    )

    const user = await userService.createUser(
      accessKey,
      username,
      initialInvestmentAmount,
      address,
      privateKey
    )

    res.json({
      accessKey,
      username,
      initialInvestmentAmount,
      initializeTxHash,
      approveTxHash,
      supplyTxHash,
      userId: user.id,
    })
  } catch (error) {
    res.status(400).json({ error: 'Failed to create user' })
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
