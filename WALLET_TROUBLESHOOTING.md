# Wallet Connection & Transaction Troubleshooting Guide

This guide helps you resolve common wallet connection and transaction issues with your StackFi DApp.

## Quick Diagnostics

1. **Run the Debug Script**
   - Open your browser's Developer Console (F12)
   - Navigate to your StackFi app
   - Copy and paste the contents of `debug-wallet.js` into the console
   - Press Enter to run diagnostics

## Common Issues & Solutions

### 🔌 Wallet Connection Issues

#### Issue: "MetaMask cannot connect to local network"

**Symptoms:**
- Connection works sometimes but fails other times
- "Wrong network" errors
- Connection drops unexpectedly

**Solutions:**

1. **Check Local Blockchain Status**
   ```bash
   # Verify Anvil/Hardhat is running
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
     http://127.0.0.1:8545
   
   # Should return: {"jsonrpc":"2.0","id":1,"result":"0x7a69"}
   ```

2. **Add/Switch to Local Network in MetaMask**
   - Open MetaMask
   - Click network dropdown (top of MetaMask)
   - Click "Add Network" or "Add a network manually"
   - Enter these details:
     - **Network Name:** Local Hardhat
     - **New RPC URL:** http://127.0.0.1:8545
     - **Chain ID:** 31337
     - **Currency Symbol:** ETH

3. **Clear Connection Cache**
   ```javascript
   // Run in browser console
   localStorage.removeItem('stackfi_force_fresh_connect')
   localStorage.removeItem('stackfi_last_disconnect')
   // Then refresh the page
   ```

4. **Reset MetaMask Account**
   - MetaMask → Settings → Advanced → Reset Account
   - This clears transaction history and cached data
   - **Note:** This won't delete your wallet or funds

### 🚫 MetaMask Popup Not Appearing

#### Issue: "Transaction doesn't show MetaMask popup"

**Symptoms:**
- Click "Prepare Recurring Investment" but no MetaMask popup
- Transactions seem to hang or fail silently
- Console shows transaction attempts but no user interaction

**Solutions:**

1. **Check Browser Popup Blockers**
   - Disable popup blockers for localhost
   - Check browser extensions that might block popups
   - Try in incognito/private browsing mode

2. **Unlock MetaMask**
   - Make sure MetaMask is unlocked
   - Click the MetaMask extension icon
   - Enter your password if prompted

3. **Clear Browser Cache**
   - Clear browser cache and cookies for localhost
   - Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)

4. **Check MetaMask Connection**
   ```javascript
   // Run in browser console to test connection
   window.ethereum.request({ method: 'eth_accounts' })
     .then(accounts => console.log('Connected accounts:', accounts))
     .catch(error => console.error('Connection error:', error))
   ```

5. **Force Fresh Connection**
   ```javascript
   // Run in browser console
   window.ethereum.request({
     method: 'wallet_requestPermissions',
     params: [{ eth_accounts: {} }]
   })
   ```

### 💸 Transaction Failures

#### Issue: Transactions fail or get rejected

**Common Error Messages & Solutions:**

1. **"insufficient funds for intrinsic transaction cost"**
   - **Cause:** Not enough ETH for gas fees
   - **Solution:** Get test ETH from your local network
   ```bash
   # If using Anvil, accounts come pre-funded
   # Import this private key in MetaMask for testing:
   # 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```

2. **"No contract deployed at [address]"**
   - **Cause:** Contracts not deployed to local network
   - **Solution:** Deploy contracts to your local network
   ```bash
   # In your project root
   npm run deploy:local
   # or
   yarn deploy:local
   ```

3. **"execution reverted"**
   - **Cause:** Contract logic rejected the transaction
   - **Solution:** Check contract state and parameters
   - Ensure you have sufficient token balance
   - Verify contract is not paused

4. **"User rejected the request" (Error 4001)**
   - **Cause:** User cancelled transaction in MetaMask
   - **Solution:** Try again, this is normal user behavior

### 🔄 Network Switching Issues

#### Issue: App can't switch to local network automatically

**Solutions:**

1. **Manual Network Switch**
   - Open MetaMask
   - Click network dropdown
   - Select "Local Hardhat" or your local network

2. **Re-add Local Network**
   - Sometimes MetaMask forgets custom networks
   - Re-add using the network details above

3. **Check RPC URL**
   - Ensure local blockchain is running on correct port
   - Default: http://127.0.0.1:8545
   - Verify with: `netstat -an | grep 8545`

### 🔧 Advanced Troubleshooting

#### Complete Reset Procedure

If all else fails, try this complete reset:

1. **Stop Local Blockchain**
   ```bash
   # Kill any running blockchain processes
   pkill -f anvil
   pkill -f hardhat
   ```

2. **Clear All Cache**
   ```javascript
   // In browser console
   localStorage.clear()
   sessionStorage.clear()
   ```

3. **Reset MetaMask**
   - MetaMask → Settings → Advanced → Reset Account

4. **Restart Everything**
   ```bash
   # Start fresh blockchain
   anvil --fork-url mainnet --chain-id 31337
   
   # In another terminal, redeploy contracts
   npm run deploy:local
   
   # Start frontend
   npm run dev
   ```

5. **Reconnect Wallet**
   - Refresh browser page
   - Connect wallet manually
   - Add local network if needed

#### Debug Console Commands

Use these commands in your browser console for debugging:

```javascript
// Check wallet connection
console.log('Ethereum object:', window.ethereum)
console.log('Is MetaMask:', window.ethereum?.isMetaMask)

// Check current network
window.ethereum.request({ method: 'eth_chainId' })
  .then(chainId => console.log('Current chain:', chainId))

// Check accounts
window.ethereum.request({ method: 'eth_accounts' })
  .then(accounts => console.log('Accounts:', accounts))

// Test simple transaction
window.ethereum.request({
  method: 'eth_sendTransaction',
  params: [{
    from: 'YOUR_ACCOUNT_ADDRESS',
    to: 'YOUR_ACCOUNT_ADDRESS',
    value: '0x0'
  }]
}).catch(error => console.log('Transaction test result:', error))
```

## Getting Help

If you're still experiencing issues:

1. **Check Console Logs**
   - Open Developer Tools (F12)
   - Look for error messages in Console tab
   - Note any red error messages

2. **Run Full Diagnostics**
   - Use the `debug-wallet.js` script
   - Copy the full output

3. **Verify Environment**
   - Local blockchain running? ✅
   - Contracts deployed? ✅  
   - MetaMask unlocked? ✅
   - Correct network selected? ✅

4. **Common Quick Fixes**
   - Refresh the page
   - Reconnect wallet
   - Switch networks back and forth
   - Clear browser cache
   - Restart local blockchain

## Prevention Tips

- Always check MetaMask is unlocked before using the app
- Keep your local blockchain running while testing
- Use the browser console to monitor for errors
- Test with small amounts first
- Keep MetaMask updated to the latest version