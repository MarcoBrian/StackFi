// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/examples/SwapExamplesBaseSepolia.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v4-core/src/libraries/FullMath.sol";


contract SwapExamplesBaseSepoliaTest is Test {
    // --- Addresses on Base Sepolia ---
    address constant ROUTER = 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4;
    address constant USDC   = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WETH   = 0x4200000000000000000000000000000000000006;

    SwapExamplesBaseSepolia swapper;

    // Test wallet
    address user = address(0xABCD);

    function setUp() public {
        // Fork Base Sepolia
        // string memory rpc = vm.envString("BASE_SEPOLIA_RPC");
        // vm.createSelectFork(rpc);

        // Deploy swapper
        swapper = new SwapExamplesBaseSepolia(ISwapRouter02(ROUTER));

        // Label for clarity
        vm.label(user, "TestUser");

        // Give user some USDC (you’ll need to impersonate a faucet/whale on fork)
        deal(USDC, user, 1_000e6); // 1000 USDC (6 decimals)
    }
    function testCheckPoolExists() public view {
        IUniswapV3Factory factory = IUniswapV3Factory(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);

        address pool = factory.getPool(USDC, WETH, 3000);

        console.log("USDC/WETH 0.3% pool:", pool);
        require(pool != address(0), "Pool does not exist!");
    }

    function testPoolInfoGeneric_USDC_WETH_3000() public view {
        IUniswapV3Factory factory = IUniswapV3Factory(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);
        address pool = factory.getPool(USDC, WETH, 3000);
        require(pool != address(0), "pool missing");
        _printPoolInfoGeneric(pool); // <-- works for any pair/decimals/symbols
}




    function testSwapExactInputSingle() public {
        vm.startPrank(user);

        uint256 usdcBefore = IERC20(USDC).balanceOf(user);
        uint256 wethBefore = IERC20(WETH).balanceOf(user);

        console.log("== ExactInputSingle ==");
        console.log("USDC before:", usdcBefore);
        console.log("WETH before:", wethBefore);

        IERC20(USDC).approve(address(swapper), 1000e6); // approve 100 USDC
        uint256 wethOut = swapper.swapExactInputSingle(1000e6); // 100 USDC in

        uint256 usdcAfter = IERC20(USDC).balanceOf(user);
        uint256 wethAfter = IERC20(WETH).balanceOf(user);

        console.log("USDC after:", usdcAfter);
        console.log("WETH after:", wethAfter);
        console.log("WETH received:", wethOut);

        vm.stopPrank();
    }

    function testSwapExactOutputSingle() public {
        vm.startPrank(user);

        uint256 usdcBefore = IERC20(USDC).balanceOf(user);
        uint256 wethBefore = IERC20(WETH).balanceOf(user);

        console.log("== ExactOutputSingle ==");
        console.log("USDC before:", usdcBefore);
        console.log("WETH before:", wethBefore);

        IERC20(USDC).approve(address(swapper), 200e6); // approve 200 USDC
        uint256 usdcSpent = swapper.swapExactOutputSingle(0.0001 ether, 200e6); // want 0.01 WETH

        uint256 usdcAfter = IERC20(USDC).balanceOf(user);
        uint256 wethAfter = IERC20(WETH).balanceOf(user);

        console.log("USDC after:", usdcAfter);
        console.log("WETH after:", wethAfter);
        console.log("USDC spent:", usdcSpent);

        vm.stopPrank();
    }

// === Generic helpers: works for ANY v3 pool/token pair ===

function _printPoolInfoGeneric(address pool) internal view {
    require(pool != address(0), "pool == 0");

    IUniswapV3Pool p = IUniswapV3Pool(pool);

    // Core pool state
    uint128 L = p.liquidity();
    (
        uint160 sqrtPriceX96,
        int24 tick,
        ,
        ,
        ,
        ,
        
    ) = p.slot0();

    address token0 = p.token0();
    address token1 = p.token1();
    uint24 fee = p.fee();
    int24 tickSpacing = p.tickSpacing();

    uint8 dec0 = IERC20Metadata(token0).decimals();
    uint8 dec1 = IERC20Metadata(token1).decimals();

    // Try to fetch symbols (safe-guard if tokens don't implement)
    string memory sym0;
    string memory sym1;
    try IERC20Metadata(token0).symbol() returns (string memory s0) { sym0 = s0; } catch { sym0 = "token0"; }
    try IERC20Metadata(token1).symbol() returns (string memory s1) { sym1 = s1; } catch { sym1 = "token1"; }

    console.log("Pool        :", pool);
    console.log("fee         :", fee);
    console.log("tickSpacing :", tickSpacing);
    console.log("token0      :", token0);
    console.log("token1      :", token1);
    console.log("symbol0     :", sym0);
    console.log("symbol1     :", sym1);
    console.log("decimals0   :", dec0);
    console.log("decimals1   :", dec1);
    console.log("liquidity L :", uint256(L));
    console.log("tick        :", tick);
    console.log("sqrtPriceX96:", uint256(sqrtPriceX96));

    // --- Price math (generic) ---
    // price1Per0_raw = (sqrtP^2) / 2^192   (token1 per token0, raw units)
    uint256 priceRaw = FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), 1 << 192);

    // Normalize to 1e18, adjusting for token decimals:
    // price1Per0_1e18 = priceRaw * 10^(18 + dec0 - dec1)   if exponent >= 0
    //                 = priceRaw / 10^(      dec1 - dec0 - 18) otherwise
    int256 exp = int256(uint256(18)) + int8(dec0) - int8(dec1);
    uint256 price1Per0_1e18;
    if (exp >= 0) {
        price1Per0_1e18 = FullMath.mulDiv(priceRaw, _pow10(uint256(exp)), 1);
    } else {
        price1Per0_1e18 = FullMath.mulDiv(priceRaw, 1, _pow10(uint256(-exp)));
    }

    // Inverse (token0 per 1 token1) also at 1e18:
    // price0Per1_1e18 = 1e36 / price1Per0_1e18  (since both are 1e18 fixed)
    uint256 price0Per1_1e18 = FullMath.mulDiv(1e36, 1, price1Per0_1e18);
    console.log(string(abi.encodePacked(sym1, " per 1 ", sym0)), priceRaw); 
    _logPrice(string(abi.encodePacked(sym1, " per 1 ", sym0)), price1Per0_1e18);
    _logPrice(string(abi.encodePacked(sym0, " per 1 ", sym1)), price0Per1_1e18);
}

// Pretty-print a 1e18 fixed-point number as X.YYYYYY (6 decimals shown)
function _logPrice(string memory label, uint256 x1e18) internal pure {
    uint256 intPart = x1e18 / 1e18;
    uint256 fracPart = x1e18 % 1e18;
    uint256 frac6 = fracPart / 1e12; // 6 decimals
    console.log(label, intPart, ".", frac6);
}

// Safe 10^n (n is small in practice: <= 36 for ERC20 decimals scaling)
function _pow10(uint256 n) internal pure returns (uint256) {
    uint256 x = 1;
    while (n > 0) {
        x *= 10;
        n--;
    }
    return x;
}


}


