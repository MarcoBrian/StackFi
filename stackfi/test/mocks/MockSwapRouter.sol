// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    // The only one you actually use in your vault
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        amountOut = params.amountOutMinimum; // keep test deterministic
        IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);
    }

    // Stubs for the other functions (just to satisfy the interface)
    function uniswapV3SwapCallback(
        int256, /* amount0Delta */
        int256, /* amount1Delta */
        bytes calldata /* data */
    ) external pure override {
        revert("not implemented");

    }

    function exactInput(ExactInputParams calldata)
        external
        payable
        override
        returns (uint256)
    {
        revert("not implemented");
    }

    function exactOutputSingle(ExactOutputSingleParams calldata)
        external
        payable
        override
        returns (uint256)
    {
        revert("not implemented");
    }

    function exactOutput(ExactOutputParams calldata)
        external
        payable
        override
        returns (uint256)
    {
        revert("not implemented");
    }
}
