// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract SeedBaseAccount is Script {
    // Mock token addresses (from your deployment)
    address constant MOCK_WETH   = 0x056e4a859558a3975761abD7385506BC4D8a8E60;
    address constant MOCK_USDC   = 0x56186c1e64ca8043DEF78d06Aff222212ea5df71;

    function run() external {
        // Inputs via env:
        // PRIVATE_KEY : an Anvil key you also imported into MetaMask
        // WETH_AMOUNT : e.g. 1000000000000000000 for 1 WETH (18 decimals)
        // USDC_AMOUNT : e.g. 3000000000 for 3000 USDC (6 decimals)
        uint256 pk = vm.envUint("TEST_PRIVATE_KEY");
        uint256 wethAmount = vm.envUint("WETH_AMOUNT");
        uint256 usdcAmount = vm.envUint("USDC_AMOUNT");

        address me = vm.addr(pk);
        vm.startBroadcast(pk);

        // 1) Mint WETH directly to the user
        MockERC20(MOCK_WETH).mint(me, wethAmount);

        // 2) Mint USDC directly to the user
        MockERC20(MOCK_USDC).mint(me, usdcAmount);

        vm.stopBroadcast();

        console.log("Minted WETH amount:", wethAmount);
        console.log("Minted USDC amount:", usdcAmount);
        console.log("Recipient:", me);
        
        // Show human-readable amounts
        console.log("WETH (18 decimals):", wethAmount / 1e18, "tokens");
        console.log("USDC (6 decimals):", usdcAmount / 1e6, "tokens");
    }
}
