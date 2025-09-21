import { ethers } from 'ethers';

export const CHAIN_ID_HEX = '0x7a69'; // foundry local (31337)


export const ADDRS = {
VAULT: '0xD9DcFF30dDc709877794bFBe6D18F57E68DFbdbf',
USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
// Optional: Uniswap v3 router if you want to show it in UI
UNIV3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564'
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