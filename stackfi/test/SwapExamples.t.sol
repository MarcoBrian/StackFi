// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import {SwapExamples} from "../src/SwapExamples.sol";

contract SwapExamplesTest is Test {
    // Mainnet token addresses
    address constant DAI  = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    // Uniswap v3 SwapRouter on mainnet
    ISwapRouter constant ROUTER =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    uint256 fork;
    address user = address(0xBEEF);
    SwapExamples example;

    function setUp() public {
        // fork = vm.createFork(vm.envString("MAINNET_RPC_URL"));
        // vm.selectFork(fork);

        vm.deal(user, 10 ether); // give user ETH
        example = new SwapExamples(ROUTER);

        // give user 1000 DAI
        deal(DAI, user, 1_000e18);
    }

    function test_swapExactInputSingle() public {
        uint256 amountIn = 100e18; // 100 DAI

        uint256 daiBefore  = IERC20(DAI).balanceOf(user);
        uint256 wethBefore = IERC20(WETH).balanceOf(user);

        console.log("=== Before Swap ===");
        console.log("DAI (user): %s", daiBefore / 1e18);
        console.log("WETH (user): %s", wethBefore );

        vm.startPrank(user);
        IERC20(DAI).approve(address(example), amountIn);
        uint256 amountOut = example.swapExactInputSingle(amountIn);
        vm.stopPrank();

        uint256 daiAfter  = IERC20(DAI).balanceOf(user);
        uint256 wethAfter = IERC20(WETH).balanceOf(user);

        console.log("=== After Swap ===");
        console.log("DAI (user): %s", daiAfter / 1e18);
        console.log("WETH (user): %s", wethAfter );
        console.log("DAI spent: %s", (daiBefore - daiAfter) / 1e18);
        console.log("WETH received: %s", (wethAfter - wethBefore) );
        console.log("amountOut returned by contract: %s", amountOut );

        assertEq(daiBefore - daiAfter, amountIn, "DAI spent mismatch");
        assertGt(amountOut, 0, "No WETH received");
        assertEq(wethAfter - wethBefore, amountOut, "WETH delta mismatch");
    }
}
