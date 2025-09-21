// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Uniswap v3 (Base Sepolia)
import {IUniswapV3Factory} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {IUniswapV3Pool}    from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

// 0.8-safe TickMath (from v4)
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

// Your local interfaces (thin wrappers)
import {INonfungiblePositionManagerV8 as INonfungiblePositionManager} from "src/interfaces/INonfungiblePositionManagerV8.sol";

// Your local mock
import {MockERC20} from "src/mocks/MockERC20.sol";

contract UniswapDeployPoolBaseSepolia is Script {
    // ---- Base Sepolia addresses (public infra) ----
    address constant V3_FACTORY  = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address constant NFPM        = 0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2;

    // Pool parameters
    uint24 constant FEE = 3000;     // 0.3%
    int24  constant SPACING = 60;   // tick spacing

    // Desired initial price ~ 3000 mUSDC per mWETH (depending on token sort)
    // We'll compute the tick and sqrtPrice at runtime.

    function run() external {
        // Read deployer key from env (see commands below)
        uint256 pk = vm.envUint("TEST_PRIVATE_KEY");

        vm.startBroadcast(pk);

        // 1) Deploy mock tokens & mint to deployer
        MockERC20 mockUSDC = new MockERC20("Mock USDC", "mUSDC", 6);
        MockERC20 mockWETH = new MockERC20("Mock WETH", "mWETH", 18);

        address liquidityProvider = vm.addr(pk);

        mockUSDC.mint(liquidityProvider, 5_000_000e6); // 5,000,000 mUSDC
        mockWETH.mint(liquidityProvider, 1_000 ether); // 1,000 mWETH

        mockWETH.mint(msg.sender, 1_000 ether); // 1,000 mWETH

        console.log("Deployer:", msg.sender);
        console.log("Liquidity Provider:", liquidityProvider);
        console.log("mUSDC  :", address(mockUSDC));
        console.log("mWETH  :", address(mockWETH));

        // 2) Sort tokens for v3 canonical ordering
        address token0 = address(mockUSDC) < address(mockWETH) ? address(mockUSDC) : address(mockWETH);
        address token1 = address(mockUSDC) < address(mockWETH) ? address(mockWETH) : address(mockUSDC);

        // 3) Target ~3000 USDC/WETH by selecting an approximate tick
        // price token1/token0 = 1.0001^tick
        // If token0 == mUSDC and token1 == mWETH, price (mWETH/mUSDC) ~ 1/3000
        // If token0 == mWETH and token1 == mUSDC, price (mUSDC/mWETH) ~ 3000
        int24 targetTick = (token0 == address(mockWETH)) ? int24(-196060) : int24(196060);
        targetTick = (targetTick / SPACING) * SPACING; // align to spacing
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(targetTick);

        // 4) Create + initialize pool if not exists
        address pool = IUniswapV3Factory(V3_FACTORY).getPool(token0, token1, FEE);
        if (pool == address(0)) {
            pool = INonfungiblePositionManager(NFPM).createAndInitializePoolIfNecessary(
                token0,
                token1,
                FEE,
                sqrtPriceX96
            );
            console.log("Created & initialized pool:", pool);
        } else {
            console.log("Pool already exists:", pool);
        }

        // 5) Read current tick and choose a tight range around it for liquidity
        (, int24 currentTick,,,,,) = IUniswapV3Pool(pool).slot0();
        int24 center = (currentTick / SPACING) * SPACING;
        int24 tickLower = center - 120; // two steps below
        int24 tickUpper = center + 120; // two steps above
        require(tickLower < tickUpper, "bad ticks");

        // 6) Provide balanced liquidity (~3000 ratio)
        uint256 wethAmt  = 1_000 ether;
        uint256 usdcAmt  = 3_000_000e6;

        console.log("wethAmt:", wethAmt);
        console.log("usdcAmt:", usdcAmt);

        uint256 amount0Desired = (token0 == address(mockWETH)) ? wethAmt : usdcAmt;
        uint256 amount1Desired = (token0 == address(mockWETH)) ? usdcAmt : wethAmt;

        console.log("amount0Desired:", amount0Desired);
        console.log("amount1Desired:", amount1Desired);

        IERC20(token0).approve(NFPM, amount0Desired);
        IERC20(token1).approve(NFPM, amount1Desired);

        INonfungiblePositionManager.MintParams memory mp =
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: FEE,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: msg.sender,
                deadline: block.timestamp + 3600
            });

        (uint256 tokenId, uint128 liquidity, uint256 amt0, uint256 amt1) =
            INonfungiblePositionManager(NFPM).mint(mp);

        console.log("Minted position tokenId:", tokenId);
        console.log("Liquidity:", liquidity);
        console.log("Supplied amount0:", amt0);
        console.log("Supplied amount1:", amt1);

        // (Optional) print slot0 to confirm
        (uint160 sqrtPrice,, , , , ,) = IUniswapV3Pool(pool).slot0();
        console.log("Pool sqrtPriceX96:", sqrtPrice);

        vm.stopBroadcast();
    }
}
