// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

interface IWETH9 {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

contract SeedBySwap is Script {
    // Mainnet addrs (work on a mainnet fork):
    address constant WETH   = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC   = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564; // Uniswap V3 SwapRouter

    function run() external {
        // Inputs via env:
        // PRIVATE_KEY : an Anvil key you also imported into MetaMask
        // ETH_IN_WEI  : e.g. 1000000000000000000 for 1 ETH
        // FEE_TIER    : optional; 500 (0.05%) default; try 3000 if needed
        uint256 pk      = vm.envUint("TEST_PRIVATE_KEY");
        uint256 ethIn   = vm.envUint("ETH_IN_WEI");
        uint24  feeTier = uint24(vm.envOr("FEE_TIER", uint256(500)));

        address me = vm.addr(pk);
        vm.startBroadcast(pk);

        // 1) Wrap ETH → WETH
        IWETH9(WETH).deposit{value: ethIn}();

        // 2) Approve the router to spend WETH
        IWETH9(WETH).approve(ROUTER, ethIn);

        // 3) Swap WETH → USDC
        uint256 amountOut = ISwapRouter(ROUTER).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: feeTier,                  // 500 is most efficient; 3000 also exists
                recipient: me,
                deadline: block.timestamp + 600,
                amountIn: ethIn,
                amountOutMinimum: 0,           // dev-only; set slippage for prod
                sqrtPriceLimitX96: 0
            })
        );

        vm.stopBroadcast();

        console.log("Swapped wei WETH ->", ethIn);
        console.log( "raw USDC (6 decimals)", amountOut);
        console.log("Recipient:", me);
        console.log("Fee tier :", feeTier);
    }
}
