// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import {StackFiVault} from "../src/StackFiVault.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {MockV3Aggregator} from "@chainlink/local/src/data-feeds/MockV3Aggregator.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol"; 


contract StackFiVaultMockTest is Test {
    StackFiVault internal vault;

    MockERC20 internal usdc; // 6 decimals
    MockERC20 internal weth; // 18 decimals

    MockV3Aggregator internal usdcUsdFeed; // 8 decimals
    MockV3Aggregator internal ethUsdFeed;  // 8 decimals

    address internal alice = address(0xA11CE);

    function setUp() public {
        // Deploy vault (Ownable set to deployer)
        vault = new StackFiVault();

        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);

        // Deploy mock price feeds with 8 decimals (Chainlink standard)
        // constructor(uint8 _decimals, int256 _initialAnswer)
        usdcUsdFeed = new MockV3Aggregator(8, 1e8);       // 1.00 USD
        ethUsdFeed  = new MockV3Aggregator(8, 3000e8);    // 3,000 USD/ETH

        // Configure assets on the vault
        // setAsset(address token, address feed, uint8 tokenDecimals, uint32 heartbeat, bool enabled)
        vm.prank(vault.owner());
        vault.setAsset(address(usdc), address(usdcUsdFeed), usdc.decimals(), 1 days, true);
        vm.prank(vault.owner());
        vault.setAsset(address(weth), address(ethUsdFeed), weth.decimals(), 1 days, true);

        // Fund Alice with USDC and approve vault
        usdc.mint(alice, 1_000_000 * 10 ** usdc.decimals());
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }

    function test_DepositAndWithdraw() public {
        uint256 amount = 500 * 10 ** usdc.decimals();
        
        console.log("=== Starting Deposit and Withdraw Test ===");
        console.log("Initial USDC amount:", amount);
        console.log("Alice address:", alice);

        vm.startPrank(alice);
        vault.deposit(address(usdc), amount);
        vm.stopPrank();

        uint256 balanceAfterDeposit = vault.balances(alice, address(usdc));
        console.log("Balance after deposit:", balanceAfterDeposit);
        assertEq(balanceAfterDeposit, amount, "balance after deposit");

        uint256 withdrawAmount = 200 * 10 ** usdc.decimals();
        console.log("Withdrawing amount:", withdrawAmount);
        
        vm.startPrank(alice);
        vault.withdraw(address(usdc), withdrawAmount);
        vm.stopPrank();

        uint256 finalBalance = vault.balances(alice, address(usdc));
        console.log("Final balance after withdraw:", finalBalance);
        assertEq(finalBalance, 300 * 10 ** usdc.decimals(), "balance after withdraw");
        
        console.log("=== Test Completed Successfully ===");
    }

    function test_CreatePlanAndExecute_UsesOracleMinOut() public {
        // 1) Deploy router + set on vault
        MockSwapRouter router = new MockSwapRouter();
        vm.prank(vault.owner());
        vault.setRouter(address(router));

        // 2) Fund router with tokenOut so it can pay minOut
        weth.mint(address(router), 1_000 ether);

        // Alice deposits 1,000 USDC
        uint256 depositAmount = 1_000 * 10 ** usdc.decimals();
        vm.startPrank(alice);
        vault.deposit(address(usdc), depositAmount);

        // Create plan: buy 100 USDC worth of WETH every week, 1% slippage
        uint128 amountPerBuy = 100 * uint128(10 ** usdc.decimals());
        uint32  frequency    = 7 days;
        uint16  slippageBps  = 100; // 1%
        vault.createPlan(address(usdc), address(weth), amountPerBuy, frequency, slippageBps);
        vm.stopPrank();

        // Initially not due
        assertFalse(vault.isDue(alice), "plan should not be due initially");

        // Warp forward to make it due
        vm.warp(block.timestamp + frequency);
        usdcUsdFeed.updateAnswer(1e8);
        ethUsdFeed.updateAnswer(4000e8);

        assertTrue(vault.isDue(alice), "plan should be due after frequency");

        // Execute by anyone (permissionless)
        // Compute expectedOut as per contract math to check balances after execute
        uint256 expectedOut = _expectedOutFromOraclesView(amountPerBuy, 1e8, 4000e8, 6, 18, 8, 8);
        uint256 minOut = _applySlippage(expectedOut, slippageBps);

        vault.execute(alice);

        // Post-conditions: USDC decreased by amountPerBuy, WETH increased by minOut
        assertEq(vault.balances(alice, address(usdc)), depositAmount - amountPerBuy, "USDC should decrease by buy amount");
        assertEq(vault.balances(alice, address(weth)), minOut, "WETH should increase by minOut");

        // Next run scheduled
        assertFalse(vault.isDue(alice), "plan should not be immediately due after execute");
    }

    function test_CancelPlan() public {
        vm.startPrank(alice);
        vault.deposit(address(usdc), 1_000 * 10 ** usdc.decimals());
        vault.createPlan(address(usdc), address(weth), 100 * uint128(10 ** usdc.decimals()), 7 days, 50);
        vm.stopPrank();

        vm.prank(alice);
        vault.cancelPlan();
        assertFalse(vault.isDue(alice), "cancelled plan should not be due");

        // Move time forward and ensure execute reverts
        vm.warp(block.timestamp + 8 days);
        vm.expectRevert(bytes("not due"));
        vault.execute(alice);
    }

    function test_CheckPriceFeedView() view public {
        (uint256 priceUsdc,, uint8 decUsdc) = vault.checkPriceFeed(address(usdc));
        (uint256 priceEth,, uint8 decEth)    = vault.checkPriceFeed(address(weth));

        assertEq(priceUsdc, 1e8, "USDC/USD price");
        assertEq(decUsdc, 8, "USDC feed decimals");
        assertEq(priceEth, 3000e8, "ETH/USD price");
        assertEq(decEth, 8, "ETH feed decimals");
    }

    function test_Execute_WithMockRouter_PaysMinOut() public {
        // 1) Deploy router + set on vault
        MockSwapRouter router = new MockSwapRouter();
        vault.setRouter(address(router));

        // 2) Fund router with tokenOut so it can pay minOut
        //    e.g., user DCA USDC -> WETH, so router must hold WETH
        weth.mint(address(router), 1_000 ether);

        // 3) User deposit & create plan
        vm.startPrank(alice);
        vault.deposit(address(usdc), 100e6); // 100 USDC
        vault.createPlan(address(usdc), address(weth), uint128(100e6), 1 days, 50); // 0.5% slippage
        vm.stopPrank();

        // 4) Make due and execute
        vm.warp(block.timestamp + 1 days + 1);
        usdcUsdFeed.updateAnswer(1e8);
        ethUsdFeed.updateAnswer(2000e8);

        uint256 preUsdc = vault.balances(alice, address(usdc));
        uint256 preWeth = vault.balances(alice, address(weth));

        vault.execute(alice);

        uint256 postUsdc = vault.balances(alice, address(usdc));
        uint256 postWeth = vault.balances(alice, address(weth));

        // USDC spent
        assertEq(preUsdc - postUsdc, 100e6);

        // Oracle expectedOut at $2,000 ETH is 0.05 WETH; with 0.5% slippage → 0.04975 WETH
        uint256 minOut = (0.05e18 * (10_000 - 50)) / 10_000;
        assertEq(postWeth - preWeth, minOut, "mock pays amountOutMinimum exactly");
    }

    // --- helpers (pure) to mirror on-chain math ---
    function _applySlippage(uint256 amount, uint16 bps) internal pure returns (uint256) {
        return amount * (10000 - bps) / 10000;
    }

    function _expectedOutFromOraclesView(
        uint256 amountIn,
        uint256 inPx,
        uint256 outPx,
        uint8 inTokDec,
        uint8 outTokDec,
        uint8 inFeedDec,
        uint8 outFeedDec
    ) internal pure returns (uint256 expectedOut) {
        // Convert tokenIn -> USD (scale to 1e18)
        uint256 inUsd1e18 = amountIn
            * inPx
            * (10 ** (18 - inTokDec))
            / (10 ** inFeedDec);

        // USD_1e18 -> tokenOut
        expectedOut = (inUsd1e18 * (10 ** outTokDec)) / (outPx * (10 ** (18 - outFeedDec)));
    }
}