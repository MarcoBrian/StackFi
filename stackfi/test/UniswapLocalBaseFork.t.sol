// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// This code forks base sepolia to run locally and creates a custom liquidity pool pair of mock USDC and WETH tokens for testing

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Uniswap v3 interfaces (Base Sepolia infra)
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoterV2.sol";

// 0.8-safe TickMath from v4
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

// Your local interfaces
import {INonfungiblePositionManagerV8 as INonfungiblePositionManager} from "src/interfaces/INonfungiblePositionManagerV8.sol";
import {ISwapRouter02Minimal as ISwapRouter02} from "src/interfaces/ISwapRouter02Minimal.sol";

// Your local mock
import "src/mocks/MockERC20.sol";

/**
 * Run:
 * forge test --match-path "test/UniswapLocalPair_Mocks.t.sol" --fork-url $BASE_SEPOLIA_RPC -vvvv
 */
contract UniswapLocalPair_Mocks is Test {
    // ---- Base Sepolia addresses (public infra) ----
    address constant V3_FACTORY  = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address constant NFPM        = 0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2;
    address constant QUOTER      = 0xC5290058841028F1614F3A6F0F5816cAd0df5E27;
    address constant SWAPROUTER2 = 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4;

    uint24 constant FEE = 3000;
    int24  constant SPACING = 60;

    MockERC20 mockUSDC; // 6 dp
    MockERC20 mockWETH; // 18 dp
    address   pool;

    // Test wallet 
    address user = address(0xABCD);


    function setUp() public {

        // 1) Deploy two mocks & mint balances
        mockUSDC = new MockERC20("Mock USDC", "mUSDC", 6);
        mockWETH = new MockERC20("Mock WETH", "mWETH", 18);

        mockUSDC.mint(address(this), 5_000_000 * 1e6); // +5m USDC
        mockWETH.mint(address(this), 1_000 ether);      // +1000 WETH
        mockUSDC.mint(user, 6000e6); 

        // 2) Sort tokens for v3
        address token0 = address(mockUSDC) < address(mockWETH) ? address(mockUSDC) : address(mockWETH);
        address token1 = address(mockUSDC) < address(mockWETH) ? address(mockWETH) : address(mockUSDC);

        // 3) Target ~3000 USDC/WETH:
        // price token1/token0 = 1.0001^tick
        int24 targetTick = (token0 == address(mockWETH)) ? int24(-196060) : int24(196060);
        targetTick = (targetTick / SPACING) * SPACING; // align to spacing
        uint160 sqrtPrice = TickMath.getSqrtPriceAtTick(targetTick);

        // 4) Create + initialize pool
        pool = IUniswapV3Factory(V3_FACTORY).getPool(token0, token1, FEE);
        if (pool == address(0)) {
            pool = INonfungiblePositionManager(NFPM).createAndInitializePoolIfNecessary(
                token0, token1, FEE, sqrtPrice
            );
        }

        // 5) Choose a tight range around current tick and add balanced liquidity
        (, int24 currentTick,,,,,) = IUniswapV3Pool(pool).slot0();
        int24 center = (currentTick / SPACING) * SPACING;
        int24 lo = center - 120; // two steps below
        int24 hi = center + 120; // two steps above
        require(lo < hi, "bad ticks");

        // Roughly match 3000 ratio: 10 WETH ↔ 30,000 USDC
        uint256 wethAmt = 100 ether;
        uint256 usdcAmt = 300_000 * 1e6;

        uint256 amount0Desired = (token0 == address(mockWETH)) ? wethAmt : usdcAmt;
        uint256 amount1Desired = (token0 == address(mockWETH)) ? usdcAmt : wethAmt;

        IERC20(token0).approve(NFPM, amount0Desired);
        IERC20(token1).approve(NFPM, amount1Desired);

        INonfungiblePositionManager.MintParams memory mp =
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: FEE,
                tickLower: lo,
                tickUpper: hi,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp + 3600
            });

        INonfungiblePositionManager(NFPM).mint(mp);
    }


    function test_Swap_USDC_to_WETH_exactInput() public {
        // Swap a fixed USDC amount to get some WETH out (no Quoter)
        uint256 amountIn = 3000e6; // 3000 USDC
        mockUSDC.approve(SWAPROUTER2, amountIn);

        uint256 beforeWeth = mockWETH.balanceOf(address(this));

        uint256 amountOut = ISwapRouter02(SWAPROUTER2).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn:  address(mockUSDC),
                tokenOut: address(mockWETH),
                fee:      FEE,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: 0,     // test: no slippage protection
                sqrtPriceLimitX96: 0     // no price limit
            })
        );

        uint256 afterWeth = mockWETH.balanceOf(address(this));
        console.log("beforeWeth:", beforeWeth); 
        console.log("AfterWeth:", afterWeth); 
        console.log("amountOut :" , amountOut);

        assertGt(amountOut, 0, "router returned zero");
        assertEq(afterWeth - beforeWeth, amountOut, "balance did not increase by amountOut");
    }

     function testSwapExactInputSingle() public {
        vm.startPrank(user);

        uint256 usdcBefore = IERC20(mockUSDC).balanceOf(user);
        uint256 wethBefore = IERC20(mockWETH).balanceOf(user);

        console.log("== ExactInputSingle ==");
        console.log("USDC before:", usdcBefore);
        console.log("WETH before:", wethBefore);
        uint256 amountIn = 3000e6; // 3000 USDC

        IERC20(mockUSDC).approve(address(SWAPROUTER2), amountIn); // approve 3000 USDC
         uint256 amountOut = ISwapRouter02(SWAPROUTER2).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn:  address(mockUSDC),
                tokenOut: address(mockWETH),
                fee:      FEE,
                recipient: user,
                amountIn: amountIn,
                amountOutMinimum: 0,     // test: no slippage protection
                sqrtPriceLimitX96: 0     // no price limit
            })
        );

        uint256 usdcAfter = IERC20(mockUSDC).balanceOf(user);
        uint256 wethAfter = IERC20(mockWETH).balanceOf(user);

        console.log("USDC after:", usdcAfter);
        console.log("WETH after:", wethAfter);
        console.log("WETH received:", amountOut);

        vm.stopPrank();
    }

}
