// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {StackFiVaultBaseSepolia} from "../src/StackFiVaultBaseSepolia.sol";

contract DebugExecute is Script {
    address constant VAULT = 0x935b78D1862de1FF6504F338752A32E1c0211920;
    address constant USER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    function run() external {
        StackFiVaultBaseSepolia vault = StackFiVaultBaseSepolia(VAULT);

        console.log("=== DEBUGGING EXECUTE FUNCTION ===");
        console.log("User:", USER);
        console.log("Vault:", VAULT);

        // Get plan details
        (address tokenIn, address tokenOut, uint128 amountPerBuy, uint32 frequency, uint40 nextRunAt, uint16 slippageBps, uint16 executedCount, uint16 totalExecutions, bool active) = vault.plans(USER);
        
        checkPlanStatus(tokenIn, tokenOut, amountPerBuy, frequency, nextRunAt, slippageBps, executedCount, totalExecutions, active);
        checkExecutionStatus(vault);
        checkUserBalances(vault, tokenIn, tokenOut, amountPerBuy);
        checkAssetConfig(vault, tokenIn, "TOKEN IN");
        checkAssetConfig(vault, tokenOut, "TOKEN OUT");
        checkPriceFeed(vault, tokenIn, "TOKEN IN");
        checkPriceFeed(vault, tokenOut, "TOKEN OUT");
    }

    function checkPlanStatus(address tokenIn, address tokenOut, uint128 amountPerBuy, uint32 frequency, uint40 nextRunAt, uint16 slippageBps, uint16 executedCount, uint16 totalExecutions, bool active) internal view {
        console.log("\n=== PLAN STATUS ===");
        console.log("Token In:", tokenIn);
        console.log("Token Out:", tokenOut);
        console.log("Amount Per Buy:", amountPerBuy);
        console.log("Frequency:", frequency);
        console.log("Next Run At:", nextRunAt);
        console.log("Slippage Bps:", slippageBps);
        console.log("Executed Count:", executedCount);
        console.log("Total Executions:", totalExecutions);
        console.log("Active:", active);
    }

    function checkExecutionStatus(StackFiVaultBaseSepolia vault) internal view {
        bool isDue = vault.isDue(USER);
        console.log("\n=== EXECUTION STATUS ===");
        console.log("Is Due:", isDue);
    }

    function checkUserBalances(StackFiVaultBaseSepolia vault, address tokenIn, address tokenOut, uint128 amountPerBuy) internal view {
        uint256 balanceIn = vault.balances(USER, tokenIn);
        uint256 balanceOut = vault.balances(USER, tokenOut);
        console.log("\n=== USER BALANCES ===");
        console.log("Balance Token In:", balanceIn);
        console.log("Balance Token Out:", balanceOut);
        console.log("Sufficient funds:", balanceIn >= amountPerBuy);
    }

    function checkAssetConfig(StackFiVaultBaseSepolia vault, address token, string memory label) internal view {
        (address tokenAddr, address priceFeedUsd, uint8 decimals, uint32 heartbeat, bool enabled) = vault.assets(token);
        console.log("\n=== ", label, " CONFIG ===");
        console.log("Token:", tokenAddr);
        console.log("Price Feed:", priceFeedUsd);
        console.log("Decimals:", decimals);
        console.log("Heartbeat:", heartbeat);
        console.log("Enabled:", enabled);
    }

    function checkPriceFeed(StackFiVaultBaseSepolia vault, address token, string memory label) internal view {
        try vault.checkPriceFeed(token) returns (uint256 price, uint256 updatedAt, uint8 feedDecimals) {
            console.log("\n=== ", label, " PRICE FEED ===");
            console.log("Price:", price);
            console.log("Updated At:", updatedAt);
            console.log("Feed Decimals:", feedDecimals);
            console.log("Time Since Update:", block.timestamp - updatedAt);
        } catch Error(string memory reason) {
            console.log(label, "Price Feed Error:", reason);
        }
    }

  
}