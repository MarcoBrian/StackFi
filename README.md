# StackFi

StackFi is a non-custodial, oracle-secured, decentralized app that automates dollar-cost averaging (DCA) into crypto portfolios, safely and transparently on-chain.


## Overview

Most crypto investors want to accumulate ETH and BTC over time. 

Today, they either rely on:

- Centralized exchanges: custodial black boxes with hidden fees. 3rd Party Counterparty Risk 

StackFi addresses this by bringing DCA on-chain with security, transparency, and automation:

- Users deposit USDC and configure recurring buys.
- Smart contracts execute swaps via decentralized exchanges.
- Chainlink price feeds ensure fair pricing and protect against manipulation.
- An automation layer (Chainlink Automation or custom bot) executes on schedule.
- A frontend allows users to set their plan and track their portfolio.

---

## Features (Phase 1 MVP)

- Non-custodial USDC deposits and withdrawals
- Automated recurring buys (e.g. $100 into ETH every Monday)
- Oracle-protected execution with Chainlink price feeds
- Transparent logging of cost basis and execution history
- Permissionless execution with optional bounty reward
- Frontend dashboard for plan configuration and portfolio tracking

---

## Tech Stack

**Smart Contracts**
- Solidity (Foundry)
- StackFiVault.sol — vault logic for deposits, plans, and execution
- OracleLib.sol — Chainlink price feed helpers

**Oracles**
- Chainlink ETH/USD, USDC/USD price feeds
- Oracle price feeds used for price slippage checks

**DEX Integration**
- Uniswap v3 Router

**Automation**
- Chainlink Automation

**Frontend**
- React + TailwindCSS

---

# Start Developing and running locally 

**Start a local Anvil node**

`anvil --fork-url mainnet --chain-id 31337 --block-time 1`

**Deploy Vault Contract**

`forge script script/DeployVaultFork.s.sol:DeployVaultFork --rpc-url http://127.0.0.1:8545 --broadcast`

**Provide some test USDC to local wallet**

`forge script script/SeedBySwap.s.sol:SeedBySwap --rpc-url local --broadcast -vv`

**Check DCA Plan is Created** 

`forge script script/CheckPlan.s.sol:CheckPlan --rpc-url http://127.0.0.1:8545`

`forge script script/SkipTimeUpdateFeed.s.sol:SkipTimeUpdateFeed --rpc-url local --broadcast -vv`
