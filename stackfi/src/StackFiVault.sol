// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol"; 
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";



contract StackFiVault is Ownable , ReentrancyGuard{

  event PlanCancelled(address indexed user);
  event Deposited(address indexed user, address indexed token, uint256 amount); 
  event Withdrawn(address indexed user, address indexed token, uint256 amount);
  event PlanCreated(address indexed user, address tokenIn, address tokenOut, uint256 amountPerBuy, uint256 frequency, uint256 slippageBps);
  event Executed(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);

  using SafeERC20 for IERC20;

  struct AssetConfig {
    address token;
    address priceFeedUsd;
    uint8   decimals;
    uint32  heartbeat;
    bool    enabled;
  }

  struct DCAPlan {
    address tokenIn;
    address tokenOut;
    uint128 amountPerBuy;
    uint32  frequency;
    uint40  nextRunAt;
    uint16  slippageBps;
    bool    active;
  }

  mapping(address => AssetConfig) public assets;    // token => config
  mapping(address => mapping(address => uint256)) public balances; // user => token => amount
  mapping(address => DCAPlan) public plans;

  constructor() Ownable(msg.sender) { 

  }
  
  function _readUsdPrice(address token)
    internal
    view
    returns (uint256 price, uint256 updatedAt, uint8 feedDecimals)
{
    AssetConfig storage a = assets[token];
    require(a.enabled, "asset not allowed");
    AggregatorV3Interface feed = AggregatorV3Interface(a.priceFeedUsd);

    (, int256 answer,, uint256 _updatedAt,) = feed.latestRoundData();
    require(answer > 0, "invalid price");
    require(block.timestamp - _updatedAt <= a.heartbeat, "stale price");

    return (uint256(answer), _updatedAt, feed.decimals());
}

  function checkPriceFeed(address tokenAddress) external view returns (uint256 price, uint8 feedDecimals, uint256 updatedAt) {
    (price, updatedAt, feedDecimals) = _readUsdPrice(tokenAddress);
  }

  // --- admin: register assets ---
  function setAsset(address token, address feed, uint8 decimal, uint32 heartbeat, bool enabled) external onlyOwner {
    assets[token] = AssetConfig(token, feed, decimal, heartbeat, enabled);
  }

  // --- user: funding ---
  function deposit(address token, uint256 amount) external nonReentrant {
    require(assets[token].enabled, "Asset not allowed");
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    balances[msg.sender][token] += amount;
    emit Deposited(msg.sender, token, amount);
  }

  function withdraw(address token, uint256 amount) external nonReentrant {
    require(balances[msg.sender][token] >= amount, "insufficient");
    balances[msg.sender][token] -= amount;
    IERC20(token).safeTransfer(msg.sender, amount);
    emit Withdrawn(msg.sender, token, amount);
  }

  // --- user: plan ---
  function createPlan(address tokenIn, address tokenOut, uint128 amountPerBuy, uint32 frequency, uint16 slippageBps) external {
    require(assets[tokenIn].enabled && assets[tokenOut].enabled, "asset not allowed");
    require(amountPerBuy > 0, "invalid amount");
    require(frequency >= 1 days, "too frequent");
    plans[msg.sender] = DCAPlan(tokenIn, tokenOut, amountPerBuy, frequency, uint40(block.timestamp + frequency), slippageBps, true);
    emit PlanCreated(msg.sender, tokenIn, tokenOut, amountPerBuy, frequency, slippageBps);

  }


    function cancelPlan() external {
        DCAPlan storage p = plans[msg.sender];
        require(p.active, "no active plan");
        p.active = false;
        p.nextRunAt = 0; // clear schedule so isDue() is false
        emit PlanCancelled(msg.sender);
    }

  function isDue(address user) public view returns (bool) {
    DCAPlan storage p = plans[user];
    return p.active && block.timestamp >= p.nextRunAt;
  }

  // --- execution (stub) ---
  function execute(address user) external {
    DCAPlan storage p = plans[user];
    require(isDue(user), "not due");
    require(balances[user][p.tokenIn] >= p.amountPerBuy, "insufficient funds");

    uint256 inAmount = p.amountPerBuy;

    // TODO: read Chainlink: tokenIn/USD and tokenOut/USD
    // TODO: compute expectedOut and minOut using slippageBps
    // TODO: swap tokenIn -> tokenOut via router, honor minOut
    uint256 outAmount = 0; // placeholder

    balances[user][p.tokenIn] -= inAmount;
    balances[user][p.tokenOut] += outAmount;

    p.nextRunAt = uint40(block.timestamp + p.frequency);
  }
}
