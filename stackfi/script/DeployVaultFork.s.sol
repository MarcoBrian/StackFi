// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";  // Add this import
import {StackFiVault} from "../src/StackFiVault.sol";
import {MockV3Aggregator} from "@chainlink/local/src/data-feeds/MockV3Aggregator.sol";

/// @notice Deploys StackFiVault on a local mainnet fork (Anvil),
///         then wires Uniswap V3 router + Chainlink price feeds for USDC/WETH.
contract DeployVaultFork is Script {
    // --- Mainnet addresses used on the fork ---
    address constant UNIV3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564; // SwapRouter
    address constant USDC         = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant WETH         = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    // Chainlink USD feeds (8 decimals on mainnet)
    address constant FEED_USDC_USD = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6; // USDC / USD (8)
    address constant FEED_ETH_USD  = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419; // ETH  / USD (8)



    // Vault heartbeat seconds (tune as you like)
    uint32 constant HEARTBEAT = 3600; // 1 hour

    function run() external {
        // Use PRIVATE_KEY from env to broadcast
        uint256 pk = vm.envUint("TEST_PRIVATE_KEY");
        vm.startBroadcast(pk);

        // 1) Deploy
        StackFiVault vault = new StackFiVault();
        
        // Mock Chainlink feeds
        MockV3Aggregator MOCK_USDC_FEED = new MockV3Aggregator(8,1e8); 
        MockV3Aggregator MOCK_ETH_FEED = new MockV3Aggregator(8,4500e8); 

        // 2) Wire Uniswap router
        vault.setRouter(UNIV3_ROUTER);

        // 3) Register assets (token addr, price feed, token decimals, heartbeat, enabled)
        vault.setAsset(USDC, address(MOCK_USDC_FEED), 6, HEARTBEAT, true);
        vault.setAsset(WETH, address(MOCK_ETH_FEED), 18, HEARTBEAT, true);

        vm.stopBroadcast();

        console.log("Vault deployed at:", address(vault));
        console.log("Router:", UNIV3_ROUTER);
        console.log("USDC  :", USDC);
        console.log("USDC feed:", address(MOCK_USDC_FEED));
        console.log("WETH  :", WETH);
        console.log("WETH feed:", address(MOCK_ETH_FEED));
    }
}
