import { ethers } from 'ethers'
import { serialize } from '@ethersproject/transactions'
import {
  AAVE_POOL_ADDRESS,
  USDC_ABI,
  USDC_ADDRESS,
  tumbuhWallet,
  SCROLL_MAINNET_RPC,
  SCROLL_MAINNET_CHAIN_ID,
  AAVE_POOL_ABI,
  l1GasOracle,
  ATOKEN_ADDRESS,
} from '../wallets'

interface GasEstimationResult {
  requiredEthers: bigint
  l1Fees: bigint
  l1FeesWithBuffer: bigint
  l2GasEstimate: bigint
  l2GasEstimateWithBuffer: bigint
}

class AaveServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AaveServiceError'
  }
}

async function estimateGasAndPrepareTransaction(
  contract: ethers.Contract,
  functionName: string,
  args: unknown[]
): Promise<GasEstimationResult> {
  try {
    const populatedTransaction = await contract[functionName].populateTransaction(
      ...args
    )

    const unsignedTransaction = {
      data: populatedTransaction.data,
      to: populatedTransaction.to,
      value: populatedTransaction.value,
      gasLimit: populatedTransaction.gasLimit,
      gasPrice: populatedTransaction.gasPrice,
      nonce: populatedTransaction.nonce,
    }
    const serializedTransaction = serialize(unsignedTransaction)

    const l1Fees = await l1GasOracle.getL1Fee(serializedTransaction)
    const l1FeesWithBuffer = (l1Fees * BigInt(1005)) / BigInt(1000)

    const l2GasEstimate = await contract[functionName].estimateGas(...args)
    const l2GasEstimateWithBuffer = (l2GasEstimate * BigInt(120)) / BigInt(100)

    const gasPrice = await contract.runner?.provider?.getFeeData()
    if (!gasPrice?.maxFeePerGas) {
      throw new AaveServiceError('Gas price not found')
    }

    const requiredEthers =
      l1FeesWithBuffer +
      l2GasEstimateWithBuffer *
        (gasPrice.maxFeePerGas ?? gasPrice.gasPrice ?? BigInt(0))

    return {
      requiredEthers,
      l1Fees,
      l1FeesWithBuffer,
      l2GasEstimate,
      l2GasEstimateWithBuffer,
    }
  } catch (error) {
    throw new AaveServiceError('Failed to estimate gas', error)
  }
}

async function ensureWalletHasGas(
  provider: ethers.JsonRpcProvider,
  userWallet: ethers.Wallet,
  requiredEthers: bigint
): Promise<void> {
  const balance = await provider.getBalance(userWallet.address)
  console.log('Current balance:', ethers.formatEther(balance))

  const requiredBalance = requiredEthers - balance
  console.log('Required balance:', ethers.formatEther(requiredBalance))

  if (requiredBalance > 0) {
    const tx = await tumbuhWallet.sendTransaction({
      to: userWallet.address,
      value: requiredBalance,
    })
    await tx.wait()
    console.log('Sent gas funds to wallet')
  }

  const updatedBalance = await provider.getBalance(userWallet.address)
  console.log(
    'Updated balance:',
    ethers.formatEther(updatedBalance ?? BigInt(0))
  )
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
  userPrivateKey: string
) {
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
    console.log('aTokenBalance:', aTokenBalance)

    // Estimate gas and ensure wallet has enough balance
    const gasEstimation = await estimateGasAndPrepareTransaction(
      aavePool,
      'withdraw',
      [USDC_ADDRESS, aTokenBalance, userWallet.address]
    )
    await ensureWalletHasGas(provider, userWallet, gasEstimation.requiredEthers)

    // Withdraw USDC from Aave Pool
    const withdrawTx = await aavePool.withdraw(
      USDC_ADDRESS,
      aTokenBalance,
      userWallet.address
    )

    console.log('USDC Withdraw transaction hash:', withdrawTx.hash)
    return withdrawTx
  } catch (error) {
    console.error('Error withdrawing USDC:', error)
    throw error
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
      approveTxHash: null,
      supplyTxHash: supplyTx.hash,
    }
  } catch (error) {
    throw new AaveServiceError('Failed to execute transactions', error)
  }
}
