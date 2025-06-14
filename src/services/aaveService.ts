import { ethers } from 'ethers'
import {
  AAVE_POOL_ADDRESS,
  USDC_ABI,
  USDC_ADDRESS,
  SCROLL_MAINNET_RPC,
  SCROLL_MAINNET_CHAIN_ID,
  AAVE_POOL_ABI,
  ATOKEN_ADDRESS,
} from '../wallets'
import {
  ensureWalletHasGas,
  estimateGasAndPrepareTransaction,
} from './walletService'

export interface GasEstimationResult {
  requiredEthers: bigint
  l1Fees: bigint
  l1FeesWithBuffer: bigint
  l2GasEstimate: bigint
  l2GasEstimateWithBuffer: bigint
}

export class AaveServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AaveServiceError'
  }
}

async function approveUSDC(
  provider: ethers.JsonRpcProvider,
  userWallet: ethers.Wallet
) {
  try {
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, userWallet)
    const usdcBalance = await usdcContract.balanceOf(userWallet.address)

    const gasEstimation = await estimateGasAndPrepareTransaction(
      usdcContract,
      'approve',
      [AAVE_POOL_ADDRESS, usdcBalance]
    )

    await ensureWalletHasGas(provider, userWallet, gasEstimation.requiredEthers)

    const approveTx = await usdcContract.approve(AAVE_POOL_ADDRESS, usdcBalance)

    return approveTx
  } catch (error) {
    throw new AaveServiceError('Failed to approve USDC', error)
  }
}

async function supplyUSDC(
  provider: ethers.JsonRpcProvider,
  userWallet: ethers.Wallet
) {
  try {
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, userWallet)
    const usdcBalance = await usdcContract.balanceOf(userWallet.address)

    const aavePool = new ethers.Contract(
      AAVE_POOL_ADDRESS,
      AAVE_POOL_ABI,
      userWallet
    )

    // Estimate gas and ensure wallet has enough balance
    const gasEstimation = await estimateGasAndPrepareTransaction(
      aavePool,
      'supply',
      [USDC_ADDRESS, usdcBalance, userWallet.address, 0]
    )
    await ensureWalletHasGas(provider, userWallet, gasEstimation.requiredEthers)

    // Supply USDC to Aave Pool
    const supplyTx = await aavePool.supply(
      USDC_ADDRESS,
      usdcBalance,
      userWallet.address,
      0 // referral code
    )

    console.log('USDC Supply transaction hash:', supplyTx.hash)
    return supplyTx
  } catch (error) {
    console.error('Error supplying USDC:', error)
    throw error
  }
}

export async function withdrawUSDC(
  userPrivateKey: string,
  amount: string,
  withdrawAddress: string
) {
  // check if withdraw address is a valid address
  if (!ethers.isAddress(withdrawAddress)) {
    throw new AaveServiceError('Invalid withdraw address')
  }

  try {
    const provider = new ethers.JsonRpcProvider(SCROLL_MAINNET_RPC, {
      chainId: SCROLL_MAINNET_CHAIN_ID,
      name: 'scroll',
    })
    const userWallet = new ethers.Wallet(userPrivateKey, provider)

    const aavePool = new ethers.Contract(
      AAVE_POOL_ADDRESS,
      AAVE_POOL_ABI,
      userWallet
    )

    // Get the user's aToken balance (supplied USDC)
    const aTokenContract = new ethers.Contract(
      ATOKEN_ADDRESS,
      USDC_ABI,
      userWallet
    )
    const aTokenBalance = await aTokenContract.balanceOf(userWallet.address)
    console.log('Raw aTokenBalance:', aTokenBalance.toString())
    console.log(
      'Formatted aTokenBalance:',
      ethers.formatUnits(aTokenBalance, 6)
    )

    const amountInSmallestUnit = ethers.parseUnits(amount, 6)

    if (aTokenBalance < amountInSmallestUnit) {
      throw new AaveServiceError('Insufficient balance')
    }

    // Estimate gas and ensure wallet has enough balance
    const gasEstimation = await estimateGasAndPrepareTransaction(
      aavePool,
      'withdraw',
      [USDC_ADDRESS, amountInSmallestUnit, userWallet.address]
    )
    await ensureWalletHasGas(provider, userWallet, gasEstimation.requiredEthers)

    // Withdraw USDC from Aave Pool
    const withdrawTx = await aavePool.withdraw(
      USDC_ADDRESS,
      amountInSmallestUnit,
      withdrawAddress
    )

    console.log('USDC Withdraw transaction hash:', withdrawTx.hash)
    return withdrawTx.hash
  } catch (error) {
    console.error('Error withdrawing USDC:', error)
    throw error
  }
}

export async function getWithdrawableUSDC(userPrivateKey: string) {
  try {
    const provider = new ethers.JsonRpcProvider(SCROLL_MAINNET_RPC, {
      chainId: SCROLL_MAINNET_CHAIN_ID,
      name: 'scroll',
    })
    const userWallet = new ethers.Wallet(userPrivateKey, provider)

    // Get the user's aToken balance (supplied USDC)
    const aTokenContract = new ethers.Contract(
      ATOKEN_ADDRESS,
      USDC_ABI,
      userWallet
    )
    const aTokenBalance = await aTokenContract.balanceOf(userWallet.address)
    return ethers.formatUnits(aTokenBalance, 6)
  } catch (error) {
    throw new AaveServiceError('Failed to get withdrawable USDC amount', error)
  }
}

export async function executeTransactions(userPrivateKey: string) {
  try {
    const provider = new ethers.JsonRpcProvider(SCROLL_MAINNET_RPC, {
      chainId: SCROLL_MAINNET_CHAIN_ID,
      name: 'scroll',
    })
    const userWallet = new ethers.Wallet(userPrivateKey, provider)

    const approveTx = await approveUSDC(provider, userWallet)
    await approveTx.wait()
    console.log('USDC Approval confirmed')

    const supplyTx = await supplyUSDC(provider, userWallet)
    await supplyTx.wait()
    console.log('USDC Supply confirmed')

    return {
      approveTxHash: approveTx.hash,
      supplyTxHash: supplyTx.hash,
    }
  } catch (error) {
    throw new AaveServiceError('Failed to execute transactions', error)
  }
}
