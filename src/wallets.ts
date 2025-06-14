import { ethers } from 'ethers'

export const SCROLL_MAINNET_RPC = 'https://rpc.scroll.io'
export const SCROLL_MAINNET_CHAIN_ID = 534352
export const L1_GAS_ORACLE_ADDRESS = '0x5300000000000000000000000000000000000002'

export const USDC_ADDRESS = '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4'
export const ATOKEN_ADDRESS = '0x1D738a3436A8C49CefFbaB7fbF04B660fb528CbD'
export const AAVE_POOL_ADDRESS = '0x11fCfe756c05AD438e312a7fd934381537D3cFfe'

export const USDC_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
]

// Aave Pool ABI
export const AAVE_POOL_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'admin', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'implementation',
        type: 'address',
      },
    ],
    name: 'Upgraded',
    type: 'event',
  },
  { stateMutability: 'payable', type: 'fallback' },
  {
    inputs: [],
    name: 'admin',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'implementation',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_logic', type: 'address' },
      { internalType: 'bytes', name: '_data', type: 'bytes' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'newImplementation', type: 'address' },
    ],
    name: 'upgradeTo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'newImplementation', type: 'address' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'upgradeToAndCall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  // Aave Pool implementation functions
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'onBehalfOf', type: 'address' },
      { internalType: 'uint16', name: 'referralCode', type: 'uint16' }
    ],
    name: 'supply',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'to', type: 'address' }
    ],
    name: 'withdraw',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' }
    ],
    name: 'getReserveData',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'liquidityIndex', type: 'uint256' },
          { internalType: 'uint256', name: 'currentLiquidityRate', type: 'uint256' },
          { internalType: 'uint256', name: 'variableBorrowIndex', type: 'uint256' },
          { internalType: 'uint256', name: 'currentVariableBorrowRate', type: 'uint256' },
          { internalType: 'uint256', name: 'currentStableBorrowRate', type: 'uint256' },
          { internalType: 'uint256', name: 'lastUpdateTimestamp', type: 'uint256' },
          { internalType: 'uint16', name: 'id', type: 'uint16' },
          { internalType: 'address', name: 'aTokenAddress', type: 'address' },
          { internalType: 'address', name: 'stableDebtTokenAddress', type: 'address' },
          { internalType: 'address', name: 'variableDebtTokenAddress', type: 'address' },
          { internalType: 'address', name: 'interestRateStrategyAddress', type: 'address' },
          { internalType: 'uint128', name: 'accruedToTreasury', type: 'uint128' },
          { internalType: 'uint128', name: 'unbacked', type: 'uint128' },
          { internalType: 'uint128', name: 'isolationModeTotalDebt', type: 'uint128' }
        ],
        internalType: 'struct DataTypes.ReserveData',
        name: '',
        type: 'tuple'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

const provider = new ethers.JsonRpcProvider(SCROLL_MAINNET_RPC, {
  chainId: SCROLL_MAINNET_CHAIN_ID,
  name: 'scroll',
})

export const tumbuhWallet = new ethers.Wallet(
  process.env.TUMBUH_PRIVATE_KEY!,
  provider
)

export const l1GasOracle = new ethers.Contract(
  L1_GAS_ORACLE_ADDRESS, // Scroll L1 Gas Oracle
  ['function getL1Fee(bytes memory _data) view returns (uint256)'],
  tumbuhWallet
)