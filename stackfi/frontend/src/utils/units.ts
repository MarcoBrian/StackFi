import { parseUnits, formatUnits } from 'ethers';

export function toUnits(amount: string | number, decimals: number) {
return parseUnits(String(amount), decimals);
}
export function fromUnits(v: bigint, decimals: number) {
return formatUnits(v, decimals);
}