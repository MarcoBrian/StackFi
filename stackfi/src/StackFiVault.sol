// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol"; 
import {AggregatorV3Interface} from "@chainlink/local/src/data-feeds/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";



contract StackFiVault is Ownable , ReentrancyGuard{

  event PlanCancelled(address indexed user);
  event Deposited(address indexed user, address indexed token, uint256 amount); 
  event Withdrawn(address indexed user, address indexed token, uint256 amount);
  event PlanCreated(address indexed user, address tokenIn, address tokenOut, uint256 amountPerBuy, uint256 frequency, uint256 slippageBps, uint256 totalExecutions);
  event PlanCompleted(address indexed user, address tokenIn, address tokenOut, uint256 totalExecuted);
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
    uint16  totalExecutions;
    uint16  executedCount;
    bool    active;
  }

  ISwapRouter public uniV3Router;
  
  // Uniswap V3 fee tier (500 = 0.05%) default fee tier
  uint24 public constant defaultFee = 500;

  mapping(address => AssetConfig) public assets;    // token => config
  mapping(address => mapping(address => uint256)) public balances; // user => token => amount
  mapping(address => DCAPlan) public plans;

  constructor() { 

  }


function setRouter(address router) external onlyOwner {
    uniV3Router = ISwapRouter(router);
}



function _swapUniV3(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut)
    internal
    returns (uint256 amountOut)
{
    // OZ v5 has forceApprove; on OZ v4 use safeApprove(0) then safeApprove(amountIn)
    IERC20(tokenIn).forceApprove(address(uniV3Router), amountIn);

    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: defaultFee,
        recipient: address(this),
        deadline: block.timestamp,
        amountIn: amountIn,
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: 0
    });

    amountOut = uniV3Router.exactInputSingle(params);
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

  function checkPriceFeed(address tokenAddress) external view returns (uint256 price, uint256 updatedAt, uint8 feedDecimals ) {
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
  function createPlan(address tokenIn, address tokenOut, uint128 amountPerBuy, uint32 frequency, uint16 slippageBps, uint16 totalExecutions) external {
    require(assets[tokenIn].enabled && assets[tokenOut].enabled, "asset not allowed");
    require(amountPerBuy > 0, "invalid amount");
    require(frequency >= 1 days, "too frequent");
    require(tokenIn != tokenOut, "tokenIn == tokenOut");
    require(totalExecutions > 0, "totalExecutions must be > 0");

    plans[msg.sender] = DCAPlan(tokenIn, tokenOut, amountPerBuy, frequency, uint40(block.timestamp + frequency), slippageBps, totalExecutions, 0, true);
    emit PlanCreated(msg.sender, tokenIn, tokenOut, amountPerBuy, frequency, slippageBps, totalExecutions);

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
    return p.active && block.timestamp >= p.nextRunAt && p.executedCount < p.totalExecutions;
  }


function _applySlippage(uint256 amount, uint16 bps) internal pure returns (uint256) {
    // 10000 bps = 100%
    // 1 bps = 0.01% 
    return amount * (10000 - bps) / 10000;
}

function _expectedOutFromOracles(address tokenIn, address tokenOut, uint256 amountIn)
    internal
    view
    returns (uint256 expectedOut)
{
    (uint256 inPx,, uint8 inFeedDec)   = _readUsdPrice(tokenIn);   // e.g. USDC/USD 1e8
    (uint256 outPx,, uint8 outFeedDec) = _readUsdPrice(tokenOut);  // e.g. ETH/USD 1e8

    uint8 inTokDec  = assets[tokenIn].decimals;   // ERC20 decimals you stored
    uint8 outTokDec = assets[tokenOut].decimals;

    // Convert tokenIn -> USD (scale to 1e18 to preserve precision)
    // USD_1e18 = amountIn * (inPx / 10^inFeedDec) * 10^(18 - inTokDec)
    // AmountIn is always in token Native units (e.g., 100 USDC = 100_000000 with 6 decimals)
    uint256 inUsd1e18 = amountIn
        * inPx
        * (10 ** (18 - inTokDec))
        / (10 ** inFeedDec);

    // Convert USD_1e18 -> tokenOut units
    // expectedOut = USD_1e18 * 10^outTokDec / (outPx / 10^outFeedDec)
    expectedOut = (inUsd1e18 * (10 ** outTokDec)) / (outPx * (10 ** (18 - outFeedDec)));
}


  // --- execution (stub) ---
  function execute(address user) external nonReentrant {
    DCAPlan storage p = plans[user];
    require(isDue(user), "not due");
    require(balances[user][p.tokenIn] >= p.amountPerBuy, "insufficient funds");

    uint256 amountIn    = p.amountPerBuy;
    uint256 expectedOut = _expectedOutFromOracles(p.tokenIn, p.tokenOut, amountIn);
    uint256 minOut      = _applySlippage(expectedOut, p.slippageBps);

    // Perform the swap: Vault holds user funds, so the contract is the sender/recipient.
    uint256 amountOut = _swapUniV3(p.tokenIn, p.tokenOut, amountIn, minOut);
    // uint256 amountOut = minOut;

    balances[user][p.tokenIn]  -= amountIn;
    balances[user][p.tokenOut] += amountOut;

    // Increment execution count
    p.executedCount += 1;

    // Check if plan is completed
    if (p.executedCount >= p.totalExecutions) {
      p.active = false;
      p.nextRunAt = 0;
      emit PlanCompleted(user, p.tokenIn, p.tokenOut, p.executedCount);
    } else {
      p.nextRunAt = uint40(block.timestamp + p.frequency);
    }

    emit Executed(user, p.tokenIn, p.tokenOut, amountIn, amountOut) ;

  }
}
