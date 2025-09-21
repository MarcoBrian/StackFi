import { ethers } from 'ethers';

// Network configurations
export const NETWORKS = {
  LOCAL: {
    chainId: '0x7a69', // 31337
    chainIdHex: '0x7a69',
    name: 'Local Hardhat',
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorerUrl: null,
  },
  BASE_SEPOLIA: {
    chainId: '0x14a34', // 84532
    chainIdHex: '0x14a34',
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorerUrl: 'https://sepolia.basescan.org',
  }
} as const;

// Get network from environment variable (Vite uses import.meta.env)
const networkEnv = import.meta.env.VITE_NETWORK || 'local';
export const CURRENT_NETWORK = networkEnv === 'base-sepolia' 
  ? NETWORKS.BASE_SEPOLIA 
  : NETWORKS.LOCAL;

export const CHAIN_ID_HEX = CURRENT_NETWORK.chainIdHex;

// Contract addresses based on current network
export const ADDRS = CURRENT_NETWORK === NETWORKS.BASE_SEPOLIA ? {
  // Base Sepolia addresses
  VAULT: '0xf9f4329c4fF4E25B772c672a56234E2cA551FbF4',
  USDC: '0x3A4EC72d624545e1F88a875DBCD8a160E16dF074',
  WETH: '0xBfeEF601f04510BBD92EdcfC7d6f7053906ED790',
  UNIV3_ROUTER: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4'
} : {
  // Local addresses (existing)
  VAULT: '0xf9f4329c4fF4E25B772c672a56234E2cA551FbF4',
  USDC: '0x3A4EC72d624545e1F88a875DBCD8a160E16dF074',
  WETH: '0xBfeEF601f04510BBD92EdcfC7d6f7053906ED790',
  UNIV3_ROUTER: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4'
} as const;

export const DECIMALS = {
  USDC: 6,
  WETH: 18,
} as const;

export const assertContract = async (addr) => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const code = await provider.getCode(addr);
  if (!code || code === '0x') {
    throw new Error(`No contract deployed at ${addr} on this network`);
  }
};