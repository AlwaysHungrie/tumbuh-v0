import { ethers } from "ethers"

export const generateAccessKey = () => {
  // 2 letters + 4 numbers
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const letter1 = letters[Math.floor(Math.random() * letters.length)]
  const letter2 = letters[Math.floor(Math.random() * letters.length)]
  const number1 = numbers[Math.floor(Math.random() * numbers.length)]
  const number2 = numbers[Math.floor(Math.random() * numbers.length)]
  const number3 = numbers[Math.floor(Math.random() * numbers.length)]
  const number4 = numbers[Math.floor(Math.random() * numbers.length)]
  return `${letter1}${letter2}-${number1}${number2}${number3}${number4}`
}

export const generateWallet = () => {
  const wallet = ethers.Wallet.createRandom()
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  }
}