import { ethers } from 'ethers'
import { l1GasOracle, tumbuhWallet, USDC_ABI, USDC_ADDRESS } from '../wallets'
import { AaveServiceError, GasEstimationResult } from './aaveService'
import { serialize } from 'v8'

/**
 * Sends USDC from the Tumbuh wallet to a specified address
 * @param toAddress The recipient's address
 * @param amount The amount of USDC to send in dollars (e.g., 1.5 for $1.50)
 * @returns The transaction hash, or null if recipient already has sufficient funds
 */
export async function sendUSDCFromTumbuh(
  toAddress: string,
  amount: number,
  userPrivateKey: string
): Promise<string | null> {
  try {
    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), 6)
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      USDC_ABI,
      tumbuhWallet
    )
    const usdcContractUser = new ethers.Contract(
      USDC_ADDRESS,
      USDC_ABI,
      new ethers.Wallet(userPrivateKey, tumbuhWallet.provider)
    )

    // Check recipient's current balance
    const currentBalance = await usdcContractUser.balanceOf(toAddress)

    // If recipient already has sufficient funds, return null
    if (currentBalance >= amountInSmallestUnit) {
      console.log('Recipient already has sufficient USDC balance')
      return null
    }

    // Send the transaction
    const tx = await usdcContract.transfer(toAddress, amountInSmallestUnit)

    // Wait for the transaction to be mined
    await tx.wait()

    return tx.hash
  } catch (error) {
    console.error('Error sending USDC:', error)
    throw error
  }
}

export async function estimateGasAndPrepareTransaction(
  contract: ethers.Contract,
  functionName: string,
  args: unknown[]
): Promise<GasEstimationResult> {
  try {
    const populatedTransaction = await contract[
      functionName
    ].populateTransaction(...args)

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

export async function ensureWalletHasGas(
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
