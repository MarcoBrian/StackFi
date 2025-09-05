// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

contract StackFiVault {
    using SafeERC20 for IERC20;

    struct DCAPlan {
        uint128 amountPerBuy;
        uint32 frequency;
        uint40 nextRunAt;
        uint16 slippageBps;
        bool active;
    }

    struct Fill {
        uint40 timestamp;
        uint128 usdcIn;
        uint128 wethOut;
    }

    IERC20 public immutable USDC;
    IERC20 public immutable WETH;

    mapping(address => uint256) public usdcBalances;
    mapping(address => DCAPlan) public plans;
    mapping(address => Fill[]) public fills;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event PlanCreated(address indexed user, uint256 amountPerBuy, uint256 frequency);
    event Executed(address indexed user, uint256 usdcIn, uint256 wethOut);

    constructor(address _usdc, address _weth) {
        USDC = IERC20(_usdc);
        WETH = IERC20(_weth);
    }

    function deposit(uint256 amount) external {
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        usdcBalances[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(usdcBalances[msg.sender] >= amount, "insufficient");
        usdcBalances[msg.sender] -= amount;
        USDC.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function createPlan(uint128 amountPerBuy, uint32 frequency, uint16 slippageBps) external {
        require(amountPerBuy > 0, "invalid amount");
        require(frequency >= 1 days, "too frequent");
        plans[msg.sender] = DCAPlan(amountPerBuy, frequency, uint40(block.timestamp + frequency), slippageBps, true);
        emit PlanCreated(msg.sender, amountPerBuy, frequency);
    }

    function isDue(address user) public view returns (bool) {
        DCAPlan storage p = plans[user];
        return p.active && block.timestamp >= p.nextRunAt;
    }

    function execute(address user) external {
        DCAPlan storage p = plans[user];
        require(isDue(user), "not due");
        require(usdcBalances[user] >= p.amountPerBuy, "insufficient funds");

        uint256 usdcIn = p.amountPerBuy;

        // TODO: integrate Chainlink price feeds
        // TODO: call Uniswap/1inch to swap USDC -> WETH
        uint256 wethOut = 0; // placeholder

        usdcBalances[user] -= usdcIn;
        fills[user].push(Fill(uint40(block.timestamp), uint128(usdcIn), uint128(wethOut)));
        p.nextRunAt = uint40(block.timestamp + p.frequency);

        emit Executed(user, usdcIn, wethOut);
    }
}
