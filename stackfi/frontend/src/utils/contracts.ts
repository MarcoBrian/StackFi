import { ethers } from 'ethers';
import { STACKFI_VAULT_ABI } from '../config/abi/StackFiVault';
import { ERC20_ABI } from '../config/abi/ERC20';
import { ADDRS } from '../config/addresses';


export function getProvider() {
if (!window.ethereum) throw new Error('Wallet not found');
return new ethers.BrowserProvider(window.ethereum);
}


export async function getSigner() {
const provider = getProvider();
return await provider.getSigner();
}


export async function getVault() {
const signer = await getSigner();
return new ethers.Contract(ADDRS.VAULT, STACKFI_VAULT_ABI, signer);
}


export async function getErc20(addr: string) {
const signer = await getSigner();
return new ethers.Contract(addr, ERC20_ABI, signer);
}