import { ethers } from 'ethers'
import { tumbuhWallet, USDC_ABI, USDC_ADDRESS } from '../wallets'

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
