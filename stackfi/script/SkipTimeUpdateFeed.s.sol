// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {StackFiVault} from "../src/StackFiVault.sol";
import {MockV3Aggregator} from "@chainlink/local/src/data-feeds/MockV3Aggregator.sol";

contract SkipTimeUpdateFeed is Script {
    // --- Mainnet addresses used on the fork ---
    address constant UNIV3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564; // SwapRouter
    address constant USDC         = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant WETH         = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    // Chainlink USD feeds (8 decimals on mainnet)
    address MOCK_USDC_USD = vm.envAddress("MOCK_FEED_USDC"); 
    address MOCK_ETH_USD  = vm.envAddress("MOCK_FEED_ETH");


    function run() external {
        uint256 pk = vm.envUint("TEST_PRIVATE_KEY");
        vm.startBroadcast(pk);
        
        console.log("Before warp - block.timestamp:", block.timestamp);
        
        // Set timestamp to current time + 1 day
        vm.warp(block.timestamp + 1 days);
        
        console.log("After warp - block.timestamp:", block.timestamp);
        
        MockV3Aggregator(MOCK_USDC_USD).updateAnswer(1e8);
        MockV3Aggregator(MOCK_ETH_USD).updateAnswer(3100e8);
        
        vm.stopBroadcast();
    }
}
