/**
 * Wallet Connection and Transaction Debugging Script
 * 
 * This script helps diagnose wallet connection and transaction issues.
 * Open your browser console and paste this script to run diagnostics.
 */

async function debugWallet() {
  console.log('🔍 Starting Wallet Diagnostics...\n');
  
  // 1. Check if MetaMask is installed
  console.log('1️⃣ Checking MetaMask Installation:');
  if (!window.ethereum) {
    console.error('❌ MetaMask not found! Please install MetaMask.');
    return;
  }
  console.log('✅ MetaMask detected');
  console.log('   - isMetaMask:', window.ethereum.isMetaMask);
  console.log('   - chainId:', window.ethereum.chainId);
  console.log('   - networkVersion:', window.ethereum.networkVersion);
  
  // 2. Check current network
  console.log('\n2️⃣ Checking Network:');
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log('✅ Current Chain ID:', chainId);
    
    const expectedChainId = '0x7a69'; // 31337 in hex
    if (chainId === expectedChainId) {
      console.log('✅ Connected to correct local network (31337)');
    } else {
      console.warn('⚠️ Wrong network! Expected:', expectedChainId, 'Got:', chainId);
      console.log('   Try switching to local network manually in MetaMask');
    }
  } catch (error) {
    console.error('❌ Failed to get chain ID:', error);
  }
  
  // 3. Check accounts
  console.log('\n3️⃣ Checking Accounts:');
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    console.log('✅ Connected accounts:', accounts);
    
    if (accounts.length === 0) {
      console.warn('⚠️ No accounts connected. Try connecting manually.');
    }
  } catch (error) {
    console.error('❌ Failed to get accounts:', error);
  }
  
  // 4. Test RPC connection
  console.log('\n4️⃣ Testing RPC Connection:');
  try {
    const blockNumber = await window.ethereum.request({ 
      method: 'eth_blockNumber' 
    });
    console.log('✅ Latest block:', parseInt(blockNumber, 16));
    
    // Test balance of first Anvil account
    const balance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'latest']
    });
    console.log('✅ Test account balance:', parseInt(balance, 16) / 1e18, 'ETH');
  } catch (error) {
    console.error('❌ RPC connection failed:', error);
    console.log('   Make sure your local blockchain is running on http://127.0.0.1:8545');
  }
  
  // 5. Test transaction capability
  console.log('\n5️⃣ Testing Transaction Capability:');
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      // Test a simple transaction request (will show popup but we'll cancel)
      console.log('   Testing transaction popup...');
      
      try {
        await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: accounts[0],
            to: accounts[0], // Send to self
            value: '0x0', // 0 ETH
            data: '0x' // No data
          }]
        });
        console.log('✅ Transaction popup works (you should have seen MetaMask popup)');
      } catch (error) {
        if (error.code === 4001) {
          console.log('✅ Transaction popup works (you cancelled it, which is expected)');
        } else {
          console.error('❌ Transaction failed:', error);
        }
      }
    } else {
      console.warn('⚠️ Cannot test transactions - no accounts connected');
    }
  } catch (error) {
    console.error('❌ Transaction test failed:', error);
  }
  
  // 6. Check localStorage flags
  console.log('\n6️⃣ Checking localStorage Flags:');
  const forceFresh = localStorage.getItem('stackfi_force_fresh_connect');
  const lastDisconnect = localStorage.getItem('stackfi_last_disconnect');
  
  console.log('   - stackfi_force_fresh_connect:', forceFresh);
  console.log('   - stackfi_last_disconnect:', lastDisconnect);
  
  if (forceFresh === 'true') {
    const timeSince = lastDisconnect ? Date.now() - parseInt(lastDisconnect) : 'N/A';
    console.log('   - Time since disconnect:', timeSince, 'ms');
    
    if (timeSince < 2000 && timeSince !== 'N/A') {
      console.warn('⚠️ Recent disconnect detected. This might prevent auto-connection.');
      console.log('   Wait 2+ seconds or clear these flags:');
      console.log('   localStorage.removeItem("stackfi_force_fresh_connect")');
      console.log('   localStorage.removeItem("stackfi_last_disconnect")');
    }
  }
  
  // 7. Network switching test
  console.log('\n7️⃣ Testing Network Switching:');
  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (currentChainId !== '0x7a69') {
    console.log('   Attempting to switch to local network...');
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7a69' }]
      });
      console.log('✅ Successfully switched to local network');
    } catch (error) {
      if (error.code === 4902) {
        console.log('   Local network not added to MetaMask. Attempting to add...');
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x7a69',
              chainName: 'Local Hardhat',
              nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['http://127.0.0.1:8545'],
              blockExplorerUrls: null,
            }]
          });
          console.log('✅ Successfully added local network to MetaMask');
        } catch (addError) {
          console.error('❌ Failed to add network:', addError);
        }
      } else {
        console.error('❌ Failed to switch network:', error);
      }
    }
  }
  
  console.log('\n🎉 Diagnostics Complete!\n');
  
  // Recommendations
  console.log('📋 RECOMMENDATIONS:');
  console.log('1. If MetaMask popups aren\'t appearing:');
  console.log('   - Check if MetaMask is locked');
  console.log('   - Check browser popup blockers');
  console.log('   - Try refreshing the page');
  console.log('   - Clear localStorage flags if needed');
  
  console.log('\n2. If connection is unstable:');
  console.log('   - Restart your local blockchain');
  console.log('   - Reset MetaMask account (Settings > Advanced > Reset Account)');
  console.log('   - Clear browser cache');
  
  console.log('\n3. If transactions fail:');
  console.log('   - Check account has sufficient ETH for gas');
  console.log('   - Verify contract addresses are correct');
  console.log('   - Check if contracts are deployed on local network');
}

// Auto-run diagnostics
debugWallet().catch(console.error);