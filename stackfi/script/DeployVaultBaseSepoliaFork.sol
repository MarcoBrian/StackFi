// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";  // Add this import
import {StackFiVaultBaseSepolia} from "../src/StackFiVaultBaseSepolia.sol";
import {MockV3Aggregator} from "@chainlink/local/src/data-feeds/MockV3Aggregator.sol";

/// @notice Deploys StackFiVaultBaseSepolia on a local base sepolia fork (Anvil),
///         then wires Uniswap V3 router + Chainlink price feeds for USDC/WETH.
contract DeployVaultBaseSepoliaFork is Script {
    // --- Mainnet addresses used on the fork ---
    address constant UNIV3_ROUTER = 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4; // SwapRouter02
    address constant MOCK_USDC         = 0x3A4EC72d624545e1F88a875DBCD8a160E16dF074;
    address constant MOCK_WETH         = 0xBfeEF601f04510BBD92EdcfC7d6f7053906ED790;

    // Chainlink USD feeds (8 decimals on base sepolia)
    address constant FEED_USDC_USD = 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165; // USDC / USD (8)
    address constant FEED_ETH_USD  = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1; // ETH  / USD (8)



    // Vault heartbeat seconds (tune as you like)
    uint32 constant HEARTBEAT = 3600; // 1 hour

    function run() external {
        // Use PRIVATE_KEY from env to broadcast
        uint256 pk = vm.envUint("TEST_PRIVATE_KEY");
        vm.startBroadcast(pk);

        // 1) Deploy
        StackFiVaultBaseSepolia vault = new StackFiVaultBaseSepolia();
        
        // Mock Chainlink feeds
        MockV3Aggregator MOCK_USDC_FEED = new MockV3Aggregator(8,1e8); 
        MockV3Aggregator MOCK_ETH_FEED = new MockV3Aggregator(8,4500e8); 

        // 2) Wire Uniswap router
        vault.setRouter(UNIV3_ROUTER);

        // 3) Register assets (token addr, price feed, token decimals, heartbeat, enabled)
        vault.setAsset(MOCK_USDC, address(MOCK_USDC_FEED), 6, HEARTBEAT, true);
        vault.setAsset(MOCK_WETH, address(MOCK_ETH_FEED), 18, HEARTBEAT, true);

        vm.stopBroadcast();

        console.log("Vault deployed at:", address(vault));
        console.log("Router:", UNIV3_ROUTER);
        console.log("USDC  :", MOCK_USDC);
        console.log("USDC feed:", address(MOCK_USDC_FEED));
        console.log("WETH  :", MOCK_WETH);
        console.log("WETH feed:", address(MOCK_ETH_FEED));
    }
}
