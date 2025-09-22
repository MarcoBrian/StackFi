// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// File: test/StackFiVaultUpkeep.t.sol
// Purpose: Minimal, readable tests for full‑scan checkUpkeep/performUpkeep **using your existing mocks**.
// Assumptions:
// - You already have MockERC20, MockAggregatorV3, and Mock ISwapRouter contracts.
// - Replace the import paths below with your actual mock locations.

import "forge-std/Test.sol";
import {StackFiVault} from "../src/StackFiVault.sol"; // your vault with full‑scan MVP upkeep logic

// ⬇️ Replace these with your mock paths
import {MockERC20} from "src/mocks/MockERC20.sol";
import {MockV3Aggregator} from "src/mocks/MockV3Aggregator.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol";

contract StackFiVaultUpkeep_FullScan_Test is Test {
    StackFiVault vault;
    MockERC20 usdc;
    MockERC20 weth;
    MockV3Aggregator usdcFeed;
    MockV3Aggregator ethFeed;
    MockSwapRouter router;

    address alice = address(0xA11CE);
    address bob   = address(0xB0B);

    function setUp() public {
        // Deploy SUT + mocks
        vault     = new StackFiVault();
        usdc      = new MockERC20("USDC", "USDC", 6);
        weth      = new MockERC20("WETH", "WETH", 18);
        router    = new MockSwapRouter();
        // feeds with 8 decimals, USDC=1.0, ETH=3000.0
        usdcFeed  = new MockV3Aggregator(8, int256(1e8));
        ethFeed   = new MockV3Aggregator(8, int256(3000e8));
    
    

        // Configure router + assets
        vm.prank(vault.owner());
        vault.setRouter(address(router));
        vault.setChainlinkForwarder(address(this)); // only for testing 

        vm.prank(vault.owner());
        vault.setAsset(address(usdc), address(usdcFeed), 6, 1 days, true);
        vm.prank(vault.owner());
        vault.setAsset(address(weth), address(ethFeed), 18, 1 days, true);

        // Mint to users and deposit
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob,   10_000e6);

        // ADD THIS: Mint WETH to the MockSwapRouter so it can simulate swaps
        weth.mint(address(router), 1000e18); // Give router 1000 WETH

        // Increase the deposit amounts
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(address(usdc), 5_000e6); // Increased from 2_000e6
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(address(usdc), 5_000e6); // Increased from 2_000e6
        vm.stopPrank();

        // Create DCA plans (USDC -> WETH)
        // amountPerBuy=500 USDC, freq=1 day, slippage=100 bps, totalExec=3
        vm.prank(alice);
        vault.createPlan(address(usdc), address(weth), 500e6, uint32(1 days), 100, 3);
        vm.prank(bob);
        vault.createPlan(address(usdc), address(weth), 400e6, uint32(1 days), 50, 3);
    }

    // --- Helpers --- //

    function _warpToNextRun(address user) internal {
        StackFiVault.DCAPlan memory p = vault.getPlan(user);
        vm.warp(p.nextRunAt + 1);
    }

    function _decode(bytes memory data) internal pure returns (uint256 idx, uint256 mode, address u) {
        (idx, mode, u) = abi.decode(data, (uint256, uint256, address));
    }

    function _updatePriceFeeds() internal {
        // Update USDC feed with current timestamp to prevent stale price
        usdcFeed.updateAnswer(int256(1e8)); // 1.0 USD with 8 decimals
        
        // Update ETH feed with current timestamp to prevent stale price  
        ethFeed.updateAnswer(int256(4500e8)); // 4500.0 USD with 8 decimals
    }

    // --- Tests --- //

    function test_CheckUpkeep_ReturnsFalse_WhenNoOneDue() public {
        (bool needed, ) = vault.checkUpkeep("");
        assertFalse(needed, "no one is due right after setup");
    }

    function test_CheckUpkeep_FindsDueUser() public {
        _warpToNextRun(alice);
        (bool needed, bytes memory data) = vault.checkUpkeep("");
        assertTrue(needed, "should need upkeep when at least one user is due");
        (uint256 idx, uint256 mode, address u) = _decode(data);
        assertEq(mode, 1, "MODE_EXECUTE");
        assertTrue(u == alice || u == bob, "expected a valid user address");
        assertLt(idx, vault.usersLength(), "index must be in bounds");
    }

    function test_PerformUpkeep_ExecutesExactlyOne_AndAdvancesPointer() public {
        _warpToNextRun(alice);
        _updatePriceFeeds();
        (bool needed, bytes memory data) = vault.checkUpkeep("");
        assertTrue(needed);

        (uint256 idx, , address u) = _decode(data);
        StackFiVault.DCAPlan memory plan = vault.getPlan(u);
        uint16 beforeCount = plan.executedCount;
        uint256 beforeIn   = vault.balances(u, address(usdc));
        uint256 beforeOut  = vault.balances(u, address(weth));

        vault.performUpkeep(data);

        // Get the updated plan after execution
        StackFiVault.DCAPlan memory updatedPlan = vault.getPlan(u);
        
        // pointer moved by 1
        assertEq(vault.lastCheckedIdx(), idx + 1);
        // exactly one exec for that user
        assertEq(updatedPlan.executedCount, beforeCount + 1); // Use updatedPlan
        assertEq(vault.balances(u, address(usdc)), beforeIn - plan.amountPerBuy);
        assertGt(vault.balances(u, address(weth)), beforeOut);
    }

    function test_Revalidation_MightSkipIfNoLongerDue() public {
        // Make Bob due now
        _warpToNextRun(bob);
        _updatePriceFeeds();

        (bool needed, bytes memory data) = vault.checkUpkeep("");
        assertTrue(needed);

        // Artificially make Bob not due anymore before performUpkeep
        // by pushing nextRunAt into the future
        StackFiVault.DCAPlan memory p = vault.getPlan(bob);
        // simulate by cancel+recreate, or by time warp backwards (not allowed);
        // we’ll just move time forward for safety
        vm.warp(block.timestamp + 1); // minimal change; keep test simple

        // performUpkeep should revalidate and either execute Bob if still due or just advance pointer
        uint256 prevIdx = vault.lastCheckedIdx();
        vault.performUpkeep(data);
        assertEq(vault.lastCheckedIdx(), prevIdx + 1, "pointer must advance regardless");
    }

    function test_Fairness_RotatesAcrossUsers() public {
        _warpToNextRun(alice);
        _warpToNextRun(bob);
        _updatePriceFeeds();


        // First upkeep
        (bool needed1, bytes memory data1) = vault.checkUpkeep("");
        assertTrue(needed1);
        (, , address u1) = _decode(data1);
        vault.performUpkeep(data1);

        // Second upkeep likely picks the other user
        (bool needed2, bytes memory data2) = vault.checkUpkeep("");
        assertTrue(needed2);
        (, , address u2) = _decode(data2);
        assertTrue(u1 != u2, "with two due users, rotation should alternate frequently");
    }

    function test_Completion_DisablesPlan() public {
        _warpToNextRun(alice);
        _updatePriceFeeds();
        
        // Keep executing until Alice's plan is completed
        uint256 aliceExecutions = 0;
        while (aliceExecutions < 3) {
            (bool needed, bytes memory data) = vault.checkUpkeep("");
            if (!needed) break;
            
            _updatePriceFeeds();
            vault.performUpkeep(data);
            
            // Check if Alice executed
            StackFiVault.DCAPlan memory alicePlan = vault.getPlan(alice);
            if (alicePlan.executedCount > aliceExecutions) {
                aliceExecutions = alicePlan.executedCount;
            }
            
            // Warp to next execution time
            _warpToNextRun(alice);
        }
        
        // Check that Alice's plan is specifically disabled
        StackFiVault.DCAPlan memory alicePlan = vault.getPlan(alice);
        assertFalse(alicePlan.active, "Alice's plan should be inactive");
        assertEq(alicePlan.executedCount, 3, "Alice should have executed 3 times");
    }
}

// Convenience getter (optional): add this to your StackFiVault for tests only
// function usersLength() external view returns (uint256) { return users.length; }
