import { useState, useEffect, useCallback } from 'react'
import { CHAIN_ID_HEX, NETWORKS } from '../config/addresses'
import { useToast } from '../contexts/ToastContext'

export const useWallet = (onDisconnectCallback) => {
  const { showSuccess, showError, showWarning, showInfo } = useToast()
  const [account, setAccount] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const isCorrectNetwork = chainId === CHAIN_ID_HEX

  // Connect wallet function
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      showError('Wallet not found. Please install MetaMask or another Web3 wallet.')
      return false
    }
    
    setIsConnecting(true)
    try {
      // Check if we should force a fresh connection
      const forceFresh = localStorage.getItem('stackfi_force_fresh_connect') === 'true'
      const lastDisconnect = localStorage.getItem('stackfi_last_disconnect')
      
      if (forceFresh) {
        console.log('Forcing fresh wallet connection...')
        
        // Clear the flags
        localStorage.removeItem('stackfi_force_fresh_connect')
        localStorage.removeItem('stackfi_last_disconnect')
        
        // Multiple attempts to ensure fresh connection
        try {
          // Method 1: Request fresh permissions (most reliable for newer wallets)
          console.log('Attempting wallet_requestPermissions...')
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }]
          })
          console.log('Fresh permissions granted')
        } catch (permError) {
          if (permError.code === 4001) {
            console.log('User rejected fresh wallet connection')
            return false
          }
          console.log('wallet_requestPermissions failed:', permError.message)
          
          // Method 2: Try to get accounts with explicit fresh request
          try {
            // Some wallets respond to this pattern
            await window.ethereum.request({ method: 'eth_accounts' })
            await new Promise(resolve => setTimeout(resolve, 100)) // Small delay
          } catch (accountsError) {
            console.log('Fresh accounts request failed:', accountsError.message)
          }
        }
        
        // Add a small delay to ensure wallet state is updated
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      // Get accounts (this should now prompt if permissions were properly revoked)
      console.log('Requesting account access...')
      const accs = await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      if (!accs || accs.length === 0) {
        throw new Error('No accounts returned from wallet')
      }
      
      setAccount(accs[0])
      const id = await window.ethereum.request({ method: 'eth_chainId' })
      setChainId(id)
      
      console.log('Successfully connected to wallet:', accs[0])
      return true
      
    } catch (error) {
      if (error.code === 4001) {
        // User rejected the request
        console.log('User rejected wallet connection')
      } else {
        console.error('Error connecting wallet:', error)
        showError('Failed to connect wallet: ' + (error.message || 'Unknown error'))
      }
      return false
    } finally {
      setIsConnecting(false)
    }
  }, [showError])

  // Connect different wallet function
  const connectDifferentWallet = useCallback(async () => {
    if (!window.ethereum) {
      showError('Wallet not found. Please install MetaMask or another Web3 wallet.')
      return false
    }
    
    setIsConnecting(true)
    try {
      // First disconnect current account
      setAccount(null)
      setChainId(null)
      
      // Call the app-specific disconnect callback if provided
      if (onDisconnectCallback) {
        onDisconnectCallback()
      }
      
      // For MetaMask, we can try to request account selection
      if (window.ethereum.isMetaMask) {
        // This will open MetaMask and potentially allow user to switch accounts
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        })
      }
      
      // Then connect to the (potentially new) account
      const accs = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(accs[0])
      const id = await window.ethereum.request({ method: 'eth_chainId' })
      setChainId(id)
      return true
    } catch (error) {
      if (error.code === 4001) {
        console.log('User rejected wallet connection')
      } else {
        console.error('Error connecting different wallet:', error)
        showError('Failed to switch wallet account')
      }
      return false
    } finally {
      setIsConnecting(false)
    }
  }, [onDisconnectCallback, showError])

  // Disconnect wallet function
  const disconnect = useCallback(async () => {
    try {
      // Method 1: Try to revoke permissions if supported (newer MetaMask versions)
      if (window.ethereum?.request) {
        try {
          await window.ethereum.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }]
          })
          console.log('Successfully revoked wallet permissions')
        } catch (revokeError) {
          console.log('wallet_revokePermissions not supported or failed:', revokeError.message)
          
          // Method 2: For older wallets, try to trigger a permission reset
          try {
            // Request permissions and then immediately clear state
            // This sometimes helps reset the connection state
            await window.ethereum.request({
              method: 'wallet_requestPermissions',
              params: [{ eth_accounts: {} }]
            })
            console.log('Triggered permission request for reset')
          } catch (permError) {
            console.log('Permission reset method failed:', permError.message)
          }
        }
      }
      
    } catch (error) {
      console.log('Error during advanced disconnect methods:', error)
    }
    
    // Clear all app state
    setAccount(null)
    setChainId(null)
    
    // Call the app-specific disconnect callback if provided
    if (onDisconnectCallback) {
      onDisconnectCallback()
    }
    
    // Store flags to force fresh connection next time
    localStorage.setItem('stackfi_force_fresh_connect', 'true')
    localStorage.setItem('stackfi_last_disconnect', Date.now().toString())
    
    console.log('Disconnect completed - flags set:', {
      forceFresh: localStorage.getItem('stackfi_force_fresh_connect'),
      lastDisconnect: localStorage.getItem('stackfi_last_disconnect')
    })
    
    // Clear any cached connection data
    if (typeof window !== 'undefined') {
      // Clear any potential cached wallet data
      sessionStorage.removeItem('walletconnect')
      sessionStorage.removeItem('WEB3_CONNECT_CACHED_PROVIDER')
      localStorage.removeItem('WEB3_CONNECT_CACHED_PROVIDER')
    }
    
    // Show success message
    showSuccess('Wallet disconnected successfully!')
    
    // Show info about fresh authorization
    setTimeout(() => {
      showInfo('Next connection will require fresh authorization.', 4000)
    }, 1000) // Small delay to show success message first
  }, [onDisconnectCallback, showSuccess, showInfo])

  // Enhanced network switching function
  const switchToNetwork = useCallback(async (targetNetwork) => {
    if (!window.ethereum) return false
    
    try {
      await window.ethereum.request({ 
        method: 'wallet_switchEthereumChain', 
        params: [{ chainId: targetNetwork.chainIdHex }] 
      })
      return true
    } catch (err) {
      if (err?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: targetNetwork.chainIdHex,
                chainName: targetNetwork.name,
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [targetNetwork.rpcUrl],
                blockExplorerUrls: targetNetwork.blockExplorerUrl ? [targetNetwork.blockExplorerUrl] : null,
              },
            ],
          })
          return true
        } catch (addError) {
          console.error('Failed to add network:', addError)
          return false
        }
      } else {
        console.error('Failed to switch network:', err)
        return false
      }
    }
  }, [])

  // Keep the old function for backward compatibility
  const switchToLocal = useCallback(async () => {
    return await switchToNetwork(NETWORKS.LOCAL)
  }, [switchToNetwork])

  // New function to switch to Base Sepolia
  const switchToBaseSepolia = useCallback(async () => {
    return await switchToNetwork(NETWORKS.BASE_SEPOLIA)
  }, [switchToNetwork])

  // Setup wallet event listeners
  useEffect(() => {
    if (!window.ethereum) return

    let isMounted = true

    const handleAccountsChanged = (accs) => {
      if (!isMounted) return
      
      // Don't auto-reconnect if user recently disconnected manually
      const forceFresh = localStorage.getItem('stackfi_force_fresh_connect')
      const lastDisconnect = localStorage.getItem('stackfi_last_disconnect')
      
      // Add time-based protection - ignore events for 2 seconds after disconnect
      if (forceFresh === 'true' || (lastDisconnect && Date.now() - parseInt(lastDisconnect) < 2000)) {
        if (accs && accs.length > 0) {
          console.log('Ignoring account change due to recent manual disconnect', {
            forceFresh,
            timeSinceDisconnect: lastDisconnect ? Date.now() - parseInt(lastDisconnect) : 'N/A'
          })
          return
        }
      }
      
      setAccount(accs?.[0] ?? null)
    }

    const handleChainChanged = (newChainId) => {
      if (!isMounted) return
      setChainId(newChainId)
    }

    const handleConnect = (connectInfo) => {
      if (!isMounted) return
      
      // Don't auto-reconnect if user recently disconnected manually
      const forceFresh = localStorage.getItem('stackfi_force_fresh_connect')
      const lastDisconnect = localStorage.getItem('stackfi_last_disconnect')
      
      // Add time-based protection - ignore connect events for 2 seconds after disconnect
      if (forceFresh === 'true' || (lastDisconnect && Date.now() - parseInt(lastDisconnect) < 2000)) {
        console.log('Ignoring wallet connect event due to recent manual disconnect', {
          forceFresh,
          timeSinceDisconnect: lastDisconnect ? Date.now() - parseInt(lastDisconnect) : 'N/A'
        })
        return
      }
      
      console.log('Wallet connected:', connectInfo)
      setChainId(connectInfo.chainId)
    }

    const handleDisconnect = (error) => {
      if (!isMounted) return
      console.log('Wallet disconnected:', error)
      setAccount(null)
      setChainId(null)
    }

    // Add event listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)
    window.ethereum.on('connect', handleConnect)
    window.ethereum.on('disconnect', handleDisconnect)

    // Auto-connect if already connected (but respect manual disconnect)
    const autoConnect = async () => {
      try {
        // Don't auto-connect if user recently disconnected
        const lastDisconnect = localStorage.getItem('stackfi_last_disconnect')
        const forceFresh = localStorage.getItem('stackfi_force_fresh_connect')
        
        // Add time-based protection - don't auto-connect for 2 seconds after disconnect
        if (forceFresh === 'true' || (lastDisconnect && Date.now() - parseInt(lastDisconnect) < 2000)) {
          console.log('Skipping auto-connect due to recent manual disconnect', {
            forceFresh,
            timeSinceDisconnect: lastDisconnect ? Date.now() - parseInt(lastDisconnect) : 'N/A'
          })
          return
        }
        
        const accs = await window.ethereum.request({ method: 'eth_accounts' })
        if (accs.length > 0) {
          setAccount(accs[0])
          const id = await window.ethereum.request({ method: 'eth_chainId' })
          setChainId(id)
        }
      } catch (error) {
        console.error('Auto-connect failed:', error)
      }
    }

    // Don't auto-connect immediately - let user manually connect
    // autoConnect()

    // Cleanup function
    return () => {
      isMounted = false
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
        window.ethereum.removeListener('connect', handleConnect)
        window.ethereum.removeListener('disconnect', handleDisconnect)
      }
    }
  }, [])

  return {
    account,
    chainId,
    isCorrectNetwork,
    isConnecting,
    connect,
    connectDifferentWallet,
    disconnect,
    switchToLocal,
    switchToBaseSepolia, // New function
    switchToNetwork, // Generic function
  }
}