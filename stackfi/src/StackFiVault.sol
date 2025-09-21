// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol"; 
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract StackFiVault is Ownable , ReentrancyGuard, AutomationCompatibleInterface {

  event PlanCancelled(address indexed user);
  event Deposited(address indexed user, address indexed token, uint256 amount); 
  event Withdrawn(address indexed user, address indexed token, uint256 amount);
  event PlanCreated(address indexed user, address tokenIn, address tokenOut, uint256 amountPerBuy, uint256 frequency, uint256 slippageBps, uint256 totalExecutions);
  event PlanCompleted(address indexed user, address tokenIn, address tokenOut, uint256 totalExecuted);
  event Executed(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);

  using SafeERC20 for IERC20;

  // indexing for automation 
  address[] public users; 
  mapping(address => bool) public isIndexed; 
  uint256 public lastCheckedIdx; 
  uint256 public scanSize = 25 ; 

  function setScanSize(uint256 _newScanSize) external onlyOwner {
    require(_newScanSize > 0 && _newScanSize <=100, "invalid scan size"); 
    scanSize = _newScanSize; 
  }

  address public chainlinkForwarder; 

  function setChainlinkForwarder(address _chainlinkForwarder) external onlyOwner {
    chainlinkForwarder = _chainlinkForwarder;
  }

  modifier onlyChainlinkForwarder() {
    require(msg.sender == chainlinkForwarder, "not chainlink forwarder");
    _;
  }

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



// Uniswap V3 Router 
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


// Price Feed functions 
  
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
    require(slippageBps <= 10000, "Cannot be more than 100%");
    require(assets[tokenIn].enabled && assets[tokenOut].enabled, "asset not allowed");
    require(amountPerBuy > 0, "invalid amount");
    require(frequency >= 1 days, "too frequent");
    require(tokenIn != tokenOut, "tokenIn == tokenOut");
    require(totalExecutions > 0, "totalExecutions must be > 0");

    if (!isIndexed[msg.sender]) {
        isIndexed[msg.sender] = true;
        users.push(msg.sender);
    }

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

    // Safety checks
    require(amountIn > 0, "amountIn must be > 0");
    require(inPx > 0, "invalid input price");
    require(outPx > 0, "invalid output price");
    require(inFeedDec <= 18, "input feed decimals too high");
    require(outFeedDec <= 18, "output feed decimals too high");
    require(inTokDec <= 18, "input token decimals too high");
    require(outTokDec <= 18, "output token decimals too high");

    // Convert tokenIn -> USD (scale to 1e18 to preserve precision)
    // USD_1e18 = amountIn * (inPx / 10^inFeedDec) * 10^(18 - inTokDec)
    // AmountIn is always in token Native units (e.g., 100 USDC = 100_000000 with 6 decimals)
    
    // Calculate intermediate values with overflow protection
    uint256 inPxScaled = inPx * (10 ** (18 - inTokDec));
    uint256 inUsd1e18 = Math.mulDiv(amountIn, inPxScaled, 10 ** inFeedDec);

    // Convert USD_1e18 -> tokenOut units
    // expectedOut = USD_1e18 * 10^outTokDec / (outPx / 10^outFeedDec)
    uint256 outPxScaled = outPx * (10 ** (18 - outFeedDec));
    expectedOut = Math.mulDiv(inUsd1e18, 10 ** outTokDec, outPxScaled);

    // Additional safety check to prevent extremely small or large results
    require(expectedOut > 0, "expected output too small");
}


  // --- execution (stub) ---
  function execute(address user) public nonReentrant {
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

// MVP: Full-scan in checkUpkeep (O(n) off-chain simulation), single execution per performUpkeep.
// - Returns false when no one is due → no on-chain tx when idle.
// - Deterministic fairness: scan order starts at lastCheckedIdx and wraps.
// - After execution (or miss), advance lastCheckedIdx to the next index so we rotate fairly.
// - No randomness, no batching

uint256 private constant MODE_EXECUTE = 1; // we only use execute mode in full-scan MVP

function _isCandidate(address u) internal view returns (bool) {
    DCAPlan storage p = plans[u];
    if (!p.active) return false;
    if (p.executedCount >= p.totalExecutions) return false;
    if (block.timestamp < p.nextRunAt) return false;
    if (balances[u][p.tokenIn] < p.amountPerBuy) return false;
    return true;
}

function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
    uint256 n = users.length;
    if (n == 0) return (false, "");

    // Start at lastCheckedIdx for fairness, but still scan the entire ring (wrap-around)
    uint256 start = lastCheckedIdx % n;

    for (uint256 i = 0; i < n; i++) {
        uint256 idx = (start + i) % n;
        address u = users[idx];
        if (_isCandidate(u)) {
            // Return the absolute index and the user address
            // performUpkeep will revalidate and advance lastCheckedIdx = idx + 1
            return (true, abi.encode(idx, MODE_EXECUTE, u));
        }
    }

    // No due user anywhere → no tx
    return (false, "");
}

function performUpkeep(bytes calldata performData) external override onlyChainlinkForwarder {
    (uint256 idx, uint256 mode, address u) = abi.decode(performData, (uint256, uint256, address));
    require(mode == MODE_EXECUTE, "Invalid mode");

    // Advance the pointer deterministically to avoid re-checking the same slot next time
    // (safe even if we early-return). Read side will modulo by users.length.
    lastCheckedIdx = idx + 1;

    // Strict revalidation to protect against false positives between simulation and execution
    if (!isDue(u)) {
        return; // nothing to do; pointer already advanced
    }

    // Execute exactly one user per upkeep (bounded gas)
    execute(u);
}

// Notes:
// - For very large `users`, full-scan O(n) in simulation may approach node limits.
//   For MVP/small n it's fine. Later, switch to windowed/time-wheel/heap if needed.
// - If you want to include a safety cap, you can early-abort after scanning a maximum
//   number of entries and fall back to windowed logic.
// - De-index (prune) inactive users to keep `n` small and scans cheap.

  
  function getPlan(address user) external view returns (DCAPlan memory) {
    return plans[user];
}

  function usersLength() external view returns (uint256) {
    return users.length;
  }
}
