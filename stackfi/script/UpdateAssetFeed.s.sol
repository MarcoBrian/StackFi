// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {StackFiVaultBaseSepolia} from "../src/StackFiVaultBaseSepolia.sol";

contract UpdateAssetFeed is Script {
    function run() external {
        // Env vars:
        // - TEST_PRIVATE_KEY: owner key of the vault
        // - VAULT: address of deployed StackFiVaultBaseSepolia
        // - TOKEN: token address whose feed you want to update
        // - NEW_FEED: new Chainlink feed address
        uint256 pk = vm.envUint("TEST_PRIVATE_KEY");
        address vaultAddr = vm.envAddress("VAULT");
        address token = vm.envAddress("TOKEN");
        address newFeed = vm.envAddress("NEW_FEED");

        vm.startBroadcast(pk);

        StackFiVaultBaseSepolia vault = StackFiVaultBaseSepolia(vaultAddr);

        // Read current asset config
        (
            address tokenStored,
            address oldFeed,
            uint8 decimals_,
            uint32 heartbeat_,
            bool enabled_
        ) = vault.assets(token);

        console.log("Updating feed for token:", token);
        console.log("Current feed:", oldFeed);
        console.log("New feed    :", newFeed);
        console.log("decimals    :", decimals_);
        console.log("heartbeat   :", heartbeat_);
        console.log("enabled     :", enabled_);

        // Re-set asset with preserved fields and new feed
        vault.setAsset(token, newFeed, decimals_, 86400, enabled_);

        // Sanity read-back
        (, address feedAfter,,,) = vault.assets(token);
        console.log("Feed updated. New feed is:", feedAfter);

        vm.stopBroadcast();
    }
}