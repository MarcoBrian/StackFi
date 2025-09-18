// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/StackFiVault.sol";

contract CheckPlan is Script {
    function run() external view {
        address vaultAddr = vm.envAddress("VAULT_ADDR");
        address user = vm.envAddress("USER_WALLET1");

        StackFiVault vault = StackFiVault(vaultAddr);
        (address tokenIn,
    address tokenOut,
    uint128 amountPerBuy,
    uint32  frequency,
    uint40  nextRunAt,
    uint16  slippageBps,
    uint16  totalExecutions,
    uint16  executedCount,
    bool    active) =
        vault.plans(user);

        console.log("Plan active:", active);
        console.log("TokenIn:", tokenIn);
        console.log("TokenOut:", tokenOut);
        console.log("AmountPerBuy:", amountPerBuy);
        console.log("Frequency:", frequency);
        console.log("SlippageBps:", slippageBps);
        console.log("TotalExecutions:", totalExecutions);
        console.log("ExecutedCount:", executedCount);
        console.log("NextRunAt:", nextRunAt);
    }
}
