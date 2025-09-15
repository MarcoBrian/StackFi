// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import { ISwapRouter02Minimal as ISwapRouter02 } from "./interfaces/ISwapRouter02Minimal.sol";

contract SwapExamplesBaseSepolia {
    ISwapRouter02 public immutable swapRouter;

    address public constant USDC  = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address public constant WETH9 = 0x4200000000000000000000000000000000000006;
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    uint24 public constant poolFee = 3000; // 0.3%

    constructor(ISwapRouter02 _swapRouter) {
        // Base Sepolia SwapRouter02: 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4
        swapRouter = _swapRouter;
    }

    function swapExactInputSingle(uint256 amountIn) external returns (uint256 amountOut) {
        // USDC from caller to contract
        TransferHelper.safeTransferFrom(USDC, msg.sender, address(this), amountIn);


        // reset then approve PERMIT2 (USDC often requires the 0 -> N pattern)
        TransferHelper.safeApprove(USDC, PERMIT2, 0);
        TransferHelper.safeApprove(USDC, PERMIT2, amountIn);

        // (optional) also approve router – not required if Permit2 is used
        TransferHelper.safeApprove(USDC, address(swapRouter), 0);
        TransferHelper.safeApprove(USDC, address(swapRouter), amountIn);

        ISwapRouter02.ExactInputSingleParams memory params = ISwapRouter02.ExactInputSingleParams({
            tokenIn: USDC,
            tokenOut: WETH9,
            fee: poolFee,
            recipient: msg.sender,
            amountIn: amountIn,
            amountOutMinimum: 0, // ⚠️ set slippage in prod
            sqrtPriceLimitX96: 0
        });

        amountOut = swapRouter.exactInputSingle{value: 0}(params);
    }

    function swapExactOutputSingle(uint256 amountOut, uint256 amountInMaximum) external returns (uint256 amountIn) {
        TransferHelper.safeTransferFrom(USDC, msg.sender, address(this), amountInMaximum);
        
        // reset then approve PERMIT2 for max
        // TransferHelper.safeApprove(USDC, PERMIT2, 0);
        // TransferHelper.safeApprove(USDC, PERMIT2, amountInMaximum);

        TransferHelper.safeApprove(USDC, address(swapRouter), 0);
        TransferHelper.safeApprove(USDC, address(swapRouter), amountInMaximum);

        ISwapRouter02.ExactOutputSingleParams memory params = ISwapRouter02.ExactOutputSingleParams({
            tokenIn: USDC,
            tokenOut: WETH9,
            fee: poolFee,
            recipient: msg.sender,
            amountOut: amountOut,
            amountInMaximum: amountInMaximum,
            sqrtPriceLimitX96: 0
        });

        amountIn = swapRouter.exactOutputSingle{value: 0}(params);

        if (amountIn < amountInMaximum) {
            TransferHelper.safeApprove(USDC, address(swapRouter), 0);
            TransferHelper.safeTransfer(USDC, msg.sender, amountInMaximum - amountIn);
        }
    }
}
