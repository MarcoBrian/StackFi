import { useEffect, useState } from 'react'
import './App.css'
import NavBar from './components/NavBar'
import About from './pages/About'
import ActivePlan from './components/ActivePlan'
import usdcLogo from './assets/crypto-logo/usd-coin-usdc-logo.svg'
import ethLogo from './assets/crypto-logo/ethereum-eth-logo.svg'
import uniLogo from './assets/crypto-logo/uniswap-uni-logo.svg'
import repeatIcon from './assets/repeat.svg'

import { ADDRS, DECIMALS, CHAIN_ID_HEX, NETWORKS, CURRENT_NETWORK, assertContract } from './config/addresses';
import { getVault, getErc20 } from './utils/contracts';
import { toUnits, fromUnits } from './utils/units';
import { useWallet } from './hooks/useWallet';
import { useToast } from './contexts/ToastContext';


const TOKENS = {
    USDC: { symbol: 'USDC', decimals: DECIMALS.USDC, address: ADDRS.USDC, logo: usdcLogo },
    WETH: { symbol: 'WETH', decimals: DECIMALS.WETH, address: ADDRS.WETH, logo: ethLogo },
    // UNI: { symbol: 'UNI', decimals: DECIMALS.UNI, address: ADDRS.UNI, logo: uniLogo },
};

const FREQ = {
  daily: 60 * 60 * 24,    // 24 hours in seconds
  weekly: 60 * 60 * 24 * 7,  // 7 days in seconds
};


function App() {
  // Toast notifications
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  // App-specific state
  const [sellToken, setSellToken] = useState(TOKENS.USDC);
  const [buyToken, setBuyToken] = useState(TOKENS.WETH);
  const [amountUSDC, setAmountUSDC] = useState('');
  const [schedule, setSchedule] = useState('daily');
  const [numExecutions, setNumExecutions] = useState(7);
  const [currentPage, setCurrentPage] = useState('home');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [vaultUsdc, setVaultUsdc] = useState('0');
  const [vaultWeth, setVaultWeth] = useState('0');
  const [planInfo, setPlanInfo] = useState(null);
  const [slippagePct, setSlippagePct] = useState('0.50');
  const [isSlippageAuto, setIsSlippageAuto] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Withdraw component state
  const [withdrawToken, setWithdrawToken] = useState(TOKENS.USDC);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawDropdownOpen, setIsWithdrawDropdownOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  // Progress modal state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressSteps, setProgressSteps] = useState([
    { id: 'approve', name: 'Approve USDC Spending', status: 'pending' },
    { id: 'deposit', name: 'Deposit USDC to Vault', status: 'pending' },
    { id: 'createPlan', name: 'Create DCA Plan', status: 'pending' }
  ]);
  const [isProcessComplete, setIsProcessComplete] = useState(false);

  // Function to clear app-specific state when wallet disconnects
  const clearAppState = () => {
    setPlanInfo(null)
    setVaultUsdc('0')
    setVaultWeth('0')
  }

  // Progress modal helper functions
  const updateStepStatus = (stepId, status) => {
    setProgressSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const resetProgressModal = () => {
    setProgressSteps([
      { id: 'approve', name: 'Approve USDC Spending', status: 'pending' },
      { id: 'deposit', name: 'Deposit USDC to Vault', status: 'pending' },
      { id: 'createPlan', name: 'Create DCA Plan', status: 'pending' }
    ]);
    setIsProcessComplete(false);
  };

  // Use the wallet hook for all wallet-related functionality
  const {
    account,
    chainId,
    isCorrectNetwork,
    isConnecting,
    connect,
    connectDifferentWallet,
    disconnect,
    switchToNetwork,
    switchToLocal,
    switchToBaseSepolia,
  } = useWallet(clearAppState);


  const normalizePlan = (p) => ({
    tokenIn: p.tokenIn,
    tokenOut: p.tokenOut,
    amountPerBuy: p.amountPerBuy,               // bigint, keep as bigint
    frequency: Number(p.frequency),             // fits u32 → number OK
    nextRunAt: Number(p.nextRunAt),             // fits u40 → number OK
    slippageBps: Number(p.slippageBps),         // u16 → number
    totalExecutions: Number(p.totalExecutions), // u16 → number
    executedCount: Number(p.executedCount),     // u16 → number
    active: Boolean(p.active),
  });

  const refreshState = async () => {
  if (!account) return;
  try {
  const vault = await getVault();
  const usdcBal = await vault.balances(account, ADDRS.USDC);
  const wethBal = await vault.balances(account, ADDRS.WETH);
  const plan = await vault.plans(account);

  setVaultUsdc(fromUnits(usdcBal, DECIMALS.USDC));
  setVaultWeth(fromUnits(wethBal, DECIMALS.WETH));
  setPlanInfo(normalizePlan(plan));
  } catch (e) { console.error(e); }
  };



  const ensureWallet = async () => {
    if (!window.ethereum) {
      const error = 'Wallet not found. Please install MetaMask or another Web3 wallet.';
      console.error('ensureWallet:error', error);
      throw new Error(error);
    }
    
    console.log('ensureWallet:start', { account, chainId, isCorrectNetwork });

    if (!account) {
      console.log('ensureWallet:connecting wallet...');
      const ok = await connect();
      console.log('ensureWallet:connect result', ok);
      if (!ok) {
        const error = 'Wallet connection was cancelled or failed. Please try again.';
        console.error('ensureWallet:connection failed');
        throw new Error(error);
      }
    }

    // Re-check chainId after potential connection
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log('ensureWallet:checking network', { 
      currentChainId, 
      expectedChainId: CHAIN_ID_HEX, 
      match: currentChainId === CHAIN_ID_HEX 
    });
    
    if (currentChainId !== CHAIN_ID_HEX) {
      console.log('ensureWallet:switching to correct network...');
      // Try to switch to the current network based on configuration
      const networkEnv = import.meta.env.VITE_NETWORK || 'local';
      const targetNetwork = networkEnv === 'base-sepolia' 
        ? NETWORKS.BASE_SEPOLIA 
        : NETWORKS.LOCAL;
      
      const switched = await switchToNetwork(targetNetwork);
      console.log('ensureWallet:switch result', switched);
      if (!switched) {
        const networkName = targetNetwork.name;
        const error = `Please switch to ${networkName} (Chain ID: ${targetNetwork.chainId}) in MetaMask`;
        console.error('ensureWallet:network switch failed');
        throw new Error(error);
      }
    }

    console.log('ensureWallet:success - wallet and network ready');
  };
    
    
    const approveIfNeeded = async (tokenAddr, spender, amount) => {
    const erc20 = await getErc20(tokenAddr);
    const owner = account;
    const current = await erc20.allowance(owner, spender);
    if (current < amount) {
    const tx = await erc20.approve(spender, amount);
    await tx.wait();
    }
    };
    
    
  const depositUSDC = async (rawAmount, numExecutions) => {
    try {
      console.log('depositUSDC:start', { rawAmount });
      const totalDeposit = rawAmount * numExecutions;
      const amount = toUnits(totalDeposit, DECIMALS.USDC); // bigint
      
      console.log('depositUSDC:amount converted', { amount: amount.toString() });
      
      console.log('depositUSDC:ensuring wallet...');
      await ensureWallet();
      
      console.log('depositUSDC:checking contracts...');
      await assertContract(ADDRS.USDC);
      await assertContract(ADDRS.VAULT);

      console.log('depositUSDC:checking approval...');
      await approveIfNeeded(ADDRS.USDC, ADDRS.VAULT, amount);
      
      console.log('depositUSDC:getting vault contract...');
      const vault = await getVault();
      await assertContract(vault.target);
      
      console.log('depositUSDC:submitting deposit transaction...');
      const tx = await vault.deposit(ADDRS.USDC, amount);
      console.log('depositUSDC:transaction submitted', { hash: tx.hash });
      
      console.log('depositUSDC:waiting for confirmation...');
      const receipt = await tx.wait();
      console.log('depositUSDC:transaction confirmed', { blockNumber: receipt.blockNumber });
      
      await refreshState(); 
      showSuccess(`Successfully deposited ${totalDeposit} USDC to vault!`);
      console.log('depositUSDC:success');
      return amount;
    } catch (err) {
      console.error('depositUSDC:error', err);
      
      // More specific error messages
      if (err.code === "ACTION_REJECTED") {
        showError('Transaction was cancelled by user');
      } else if (err.message?.includes('insufficient funds')) {
        showError('Insufficient funds for transaction');
      } else if (err.message?.includes('No contract deployed')) {
        showError('Contract not found on this network. Make sure your local blockchain is running.');
      } else {
        console.log(err)
        showError('Failed to deposit USDC');
      }
      throw err; // Re-throw so calling code can handle it
    }
  };
    
    
    const createDcaPlan = async (tokenIn, tokenOut, amountPerBuyUSDC, scheduleKey, slippageBps = 100, totalExecutions = 10) => {
    await ensureWallet();
    const vault = await getVault();
    const amountPerBuy = toUnits(amountPerBuyUSDC, DECIMALS.USDC);
    const frequency = FREQ[scheduleKey];
    if (!frequency) throw new Error('Invalid schedule');
    if (tokenIn === tokenOut) throw new Error('tokenIn == tokenOut');
    const tx = await vault.createPlan(tokenIn, tokenOut, amountPerBuy, frequency, slippageBps, totalExecutions);
    await tx.wait();
    await refreshState(); 
    };
    
    
    const executeSelf = async () => {
    try {
      await ensureWallet();
      const vault = await getVault();
      const tx = await vault.execute(account);
      await tx.wait();
      await refreshState(); 
      showSuccess('DCA plan executed successfully!');
    } catch (err) {
      console.error(err);
      showError('Failed to execute DCA plan');
    }
    };
    
    
    const cancelPlan = async () => {
    try {
      await ensureWallet();
      const vault = await getVault();
      const tx = await vault.cancelPlan();
      await tx.wait();
      await refreshState(); 
      showSuccess('DCA plan cancelled successfully!');
    } catch (err) {
      console.error(err);
      showError(err?.message ?? 'Failed to cancel DCA plan');
    }
    };

    const withdrawFromVault = async (tokenAddress, amount) => {
    try {
      console.log('withdrawFromVault:start', { tokenAddress, amount });
      
      await ensureWallet();
      
      const vault = await getVault();
      await assertContract(vault.target);
      
      const amountBigInt = toUnits(amount, withdrawToken.decimals);
      console.log('withdrawFromVault:amount converted', { amount: amountBigInt.toString() });
      
      console.log('withdrawFromVault:submitting withdraw transaction...');
      const tx = await vault.withdraw(tokenAddress, amountBigInt);
      console.log('withdrawFromVault:transaction submitted', { hash: tx.hash });
      
      console.log('withdrawFromVault:waiting for confirmation...');
      const receipt = await tx.wait();
      console.log('withdrawFromVault:transaction confirmed', { blockNumber: receipt.blockNumber });
      
      await refreshState();
      showSuccess(`Successfully withdrew ${amount} ${withdrawToken.symbol} from vault!`);
      console.log('withdrawFromVault:success');
      
      // Clear withdraw form
      setWithdrawAmount('');
      
    } catch (err) {
      console.error('withdrawFromVault:error', err);
      
      if (err.code === "ACTION_REJECTED") {
        showError('Transaction was cancelled by user');
      } else if (err.message?.includes('insufficient')) {
        showError('Insufficient balance in vault');
      } else if (err.message?.includes('No contract deployed')) {
        showError('Contract not found on this network. Make sure your local blockchain is running.');
      } else {
        showError('Failed to withdraw from vault');
      }
      throw err;
    }
    };


    // Refresh when account / chain changes
    useEffect(() => {
      if (account && chainId) {
        refreshState().catch(console.error);
      }
    }, [account, chainId]);



  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && !event.target.closest('.custom-dropdown')) {
        setIsDropdownOpen(false)
      }
      if (isWithdrawDropdownOpen && !event.target.closest('.withdraw-dropdown')) {
        setIsWithdrawDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen, isWithdrawDropdownOpen])

  // Auto-switch buy token if it becomes the same as sell token
  useEffect(() => {
    if (buyToken.symbol === sellToken.symbol) {
      const otherToken = Object.values(TOKENS).find(token => token.symbol !== sellToken.symbol)
      if (otherToken) {
        setBuyToken(otherToken)
      }
    }
  }, [sellToken, buyToken])


  const handleTokenSelect = (tokenSymbol) => {
    setBuyToken(TOKENS[tokenSymbol])
    setIsDropdownOpen(false)
  }

  const handleWithdrawTokenSelect = (tokenSymbol) => {
    setWithdrawToken(TOKENS[tokenSymbol])
    setIsWithdrawDropdownOpen(false)
  }

  const switchTokens = () => {
    const tempSellToken = sellToken
    setSellToken(buyToken)
    setBuyToken(tempSellToken)
  }

  // Get available tokens for the receive dropdown (exclude the sell token)
  const availableTokens = Object.values(TOKENS).filter(token => token.symbol !== sellToken.symbol)
  
  // Get all tokens for withdraw dropdown
  const withdrawableTokens = Object.values(TOKENS)
  
  // Get current balance for selected withdraw token
  const getCurrentWithdrawBalance = () => {
    if (withdrawToken.symbol === 'USDC') return vaultUsdc
    if (withdrawToken.symbol === 'WETH') return vaultWeth
    return '0'
  }

  // Helper function to get the appropriate step value for a token's decimals
  const getStepValue = (decimals) => {
    return `0.${'0'.repeat(decimals - 1)}1`
  }

  // Helper function to get the appropriate placeholder for a token's decimals
  const getPlaceholderValue = (decimals) => {
    return `0.${'0'.repeat(decimals)}`
  }
  
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    if (isWithdrawing) return;
    
    try {
      if (!account) throw new Error('Connect wallet first');
      if (!withdrawAmount || Number(withdrawAmount) <= 0) throw new Error('Enter withdraw amount');
      
      const currentBalance = Number(getCurrentWithdrawBalance());
      if (Number(withdrawAmount) > currentBalance) {
        throw new Error(`Insufficient balance. Available: ${currentBalance} ${withdrawToken.symbol}`);
      }
      
      setIsWithdrawing(true);
      await withdrawFromVault(withdrawToken.address, withdrawAmount);
      
    } catch (err) {
      console.error('Withdraw submit error:', err);
      if (err?.code === "ACTION_REJECTED") {
        showInfo('Transaction cancelled by user');
      } else {
        console.log(err)
        showError('Withdraw failed');
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    // Show progress modal immediately
    setShowProgressModal(true);
    resetProgressModal();
    setIsSubmitting(true);
    
    try {
      console.log('Starting submit flow...');
      
      if (!account) throw new Error('Connect wallet first');
      console.log('Account connected:', account);

      const tokenIn = sellToken.address;
      const tokenOut = buyToken.address;
      console.log('Tokens:', { tokenIn, tokenOut });

      if (!amountUSDC || Number(amountUSDC) <= 0) throw new Error('Enter amount');
      console.log('Amount valid:', amountUSDC);

      const amount = toUnits(amountUSDC * numExecutions, DECIMALS.USDC);

      // Step 1: Approve USDC
      updateStepStatus('approve', 'processing');
      console.log('Checking USDC approval...');
      await ensureWallet();
      await assertContract(ADDRS.USDC);
      await assertContract(ADDRS.VAULT);
      await approveIfNeeded(ADDRS.USDC, ADDRS.VAULT, amount);
      console.log('Approval complete');
      updateStepStatus('approve', 'completed');

      // Step 2: Deposit USDC
      updateStepStatus('deposit', 'processing');
      console.log('Depositing USDC...');
      const vault = await getVault();
      await assertContract(vault.target);
      const tx = await vault.deposit(ADDRS.USDC, amount);
      await tx.wait();
      await refreshState();
      console.log('Deposit successful');
      updateStepStatus('deposit', 'completed');

      // Step 3: Create DCA Plan
      updateStepStatus('createPlan', 'processing');
      const parsedPct = Number.parseFloat(slippagePct);
      const safePct = Number.isFinite(parsedPct) ? Math.max(0, Math.min(20, parsedPct)) : 0.5;
      const slippageBps = Math.round(safePct * 100);
      console.log('Slippage bps:', slippageBps);

      console.log('Calling createDcaPlan...');
      await createDcaPlan(tokenIn, tokenOut, amountUSDC, schedule, slippageBps, numExecutions);
      console.log('Plan created successfully');
      updateStepStatus('createPlan', 'completed');

      // All steps completed
      setIsProcessComplete(true);
      showSuccess('DCA plan created successfully! Vault will execute when due.');
    } catch (err) {
      console.error('Submit error:', err);
      
      // Close modal and show error via toast
      setShowProgressModal(false);
      
      if (err.code === "ACTION_REJECTED") {
        showInfo('Transaction cancelled by user');
      } else {
        console.log(err);
        showError('Transaction failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'about':
        return <About />
      case 'home':
      default:
        return (
          <>
            <h1 className="title">DCA Strategy On-Chain</h1>
            <p className="subtitle">Stack and grow your crypto portfolio automatically</p>

            <div className="card">
              <form onSubmit={handleSubmit} className="form">
                <section className="swapBox">
                  <div className="tokenCol">
                    <label>You sell</label>
                    <div className="pill">
                      {sellToken.logo && <img src={sellToken.logo} alt={sellToken.symbol} className="token-logo" onError={(e) => console.log('Image load error:', e)} onLoad={() => console.log('Image loaded successfully')} />}
                      {sellToken.symbol}
                    </div>
                  </div>
                  
                  <div className="switch-button-container">
                    <button 
                      type="button" 
                      className="switch-button"
                      onClick={switchTokens}
                      title="Switch tokens"
                    >
                      <img src={repeatIcon} alt="Switch tokens" className="switch-icon" />
                    </button>
                  </div>

                  <div className="tokenCol">
                    <label>You receive</label>
                    <div className="custom-dropdown">
                      <div 
                        className="dropdown-trigger" 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      >
                        {buyToken.logo && <img src={buyToken.logo} alt={buyToken.symbol} className="token-logo" />}
                        <span>{buyToken.symbol}</span>
                        <svg 
                          className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`} 
                          width="12" 
                          height="8" 
                          viewBox="0 0 12 8" 
                          fill="none"
                        >
                          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      {isDropdownOpen && (
                        <div className="dropdown-menu">
                          {availableTokens.map((token) => (
                            <div
                              key={token.symbol}
                              className={`dropdown-item ${buyToken.symbol === token.symbol ? 'selected' : ''}`}
                              onClick={() => handleTokenSelect(token.symbol)}
                            >
                              {token.logo && <img src={token.logo} alt={token.symbol} className="token-logo" />}
                              <span>{token.symbol}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <label>How much are you planning to invest per buy?</label>
                  <div className="inputRow">
                    <input
                      type="number"
                      step={getStepValue(sellToken.decimals)}
                      min=""
                      placeholder={getPlaceholderValue(sellToken.decimals)}
                      inputMode="decimal"
                      pattern="^[0-9]*\\.?[0-9]*$"
                      value={amountUSDC}
                      onKeyDown={(e) => {
                        if (['e','E','+','-'].includes(e.key)) e.preventDefault()
                      }}
                      onChange={(e) => {
                        const v = e.target.value
                          .replace(/[^\d.]/g, '')        // keep digits and dot
                          .replace(/(\..*)\./g, '$1')    // only one dot
                        setAmountUSDC(v)
                      }}
                      required
                    />
                    <span className="unit">{sellToken.symbol}</span>
                  </div>
                </section>

                <section className="grid3">
                  <div>
                    <label>Number of executions</label>
                    <input
                      type="number"
                      min="1"
                      value={numExecutions}
                      onChange={(e) => setNumExecutions(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label>Executes</label>
                    <div className="segmented">
                      <button type="button" className={schedule === 'daily' ? 'active' : ''} onClick={() => setSchedule('daily')}>
                        Daily
                      </button>
                      <button type="button" className={schedule === 'weekly' ? 'active' : ''} onClick={() => setSchedule('weekly')}>
                        Weekly
                      </button>
                    </div>
                  </div>
                  <div className="slippageCol">
                    <label>Max slippage</label>
                    <div className="slippageRow">
                      <button
                        type="button"
                        className={`auto-pill ${isSlippageAuto ? 'active' : 'custom'}`}
                        onClick={() => { setSlippagePct('0.50'); setIsSlippageAuto(true); }}
                      >
                        Auto
                      </button>
                      <div className={`slippageInput ${isSlippageAuto ? 'auto' : ''}`}>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          max="50"
                          value={slippagePct}
                          onChange={(e) => { 
                            const value = e.target.value;
                            // Allow only 2 decimal places and max 10%
                            if (value === '' || (/^\d*\.?\d{0,2}$/.test(value) && parseFloat(value) <= 20)) {
                              setSlippagePct(value);
                              setIsSlippageAuto(false);
                            }
                          }}
                          aria-label="Max slippage percent"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <button type="submit" className="primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing…' : 'Start Plan'}
                </button>
              </form>
            </div>

            {account && (
            <div className="card">
            <h3>Your Vault Balances</h3>
            <div className="balance-list">
              <div className="balance-item">
                <div className="balance-token-info">
                  <img src={usdcLogo} alt="USDC" className="balance-token-logo" />
                  <span className="balance-token-name">USDC</span>
                </div>
                <span className="balance-amount">{vaultUsdc} USDC</span>
              </div>
              <div className="balance-item">
                <div className="balance-token-info">
                  <img src={ethLogo} alt="WETH" className="balance-token-logo" />
                  <span className="balance-token-name">WETH</span>
                </div>
                <span className="balance-amount">{vaultWeth} WETH</span>
              </div>
            </div>

            <ActivePlan 
              planInfo={planInfo}
              sellToken={sellToken}
              buyToken={buyToken}
              onExecute={executeSelf}
              onCancel={cancelPlan}
            />

            <div className="withdraw-section">
              <h4>Withdraw from Vault</h4>
              <form onSubmit={handleWithdrawSubmit} className="withdraw-form">
                <div className="withdraw-controls">
                  <div className="withdraw-token-select">
                    <label>Token</label>
                    <div className="custom-dropdown withdraw-dropdown">
                      <div 
                        className="dropdown-trigger" 
                        onClick={() => setIsWithdrawDropdownOpen(!isWithdrawDropdownOpen)}
                      >
                        {withdrawToken.logo && <img src={withdrawToken.logo} alt={withdrawToken.symbol} className="token-logo" />}
                        <span>{withdrawToken.symbol}</span>
                        <svg 
                          className={`dropdown-arrow ${isWithdrawDropdownOpen ? 'open' : ''}`} 
                          width="12" 
                          height="8" 
                          viewBox="0 0 12 8" 
                          fill="none"
                        >
                          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      {isWithdrawDropdownOpen && (
                        <div className="dropdown-menu">
                          {withdrawableTokens.map((token) => (
                            <div
                              key={token.symbol}
                              className={`dropdown-item ${withdrawToken.symbol === token.symbol ? 'selected' : ''}`}
                              onClick={() => handleWithdrawTokenSelect(token.symbol)}
                            >
                              {token.logo && <img src={token.logo} alt={token.symbol} className="token-logo" />}
                              <span>{token.symbol}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="withdraw-amount">
                    <label>Amount</label>
                    <div className="inputRow">
                      <input
                        type="number"
                        step={getStepValue(withdrawToken.decimals)}
                        min="0"
                        max={getCurrentWithdrawBalance()}
                        placeholder={getPlaceholderValue(withdrawToken.decimals)}
                        inputMode="decimal"
                        pattern="^[0-9]*\.?[0-9]*$"
                        value={withdrawAmount}
                        onKeyDown={(e) => {
                          if (['e','E','+','-'].includes(e.key)) e.preventDefault()
                        }}
                        onChange={(e) => {
                          const v = e.target.value
                            .replace(/[^\d.]/g, '')        // keep digits and dot
                            .replace(/(\..*)\./g, '$1')    // only one dot
                          setWithdrawAmount(v)
                        }}
                        required
                      />
                      <span className="unit">{withdrawToken.symbol}</span>
                    </div>
                    <small className="balance-info">
                      Available: {getCurrentWithdrawBalance()} {withdrawToken.symbol}
                    </small>
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  className="withdraw-button" 
                  disabled={isWithdrawing || !withdrawAmount || Number(withdrawAmount) <= 0}
                >
                  {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                </button>
              </form>
            </div>

            </div>
            )}
          </>
        )
    }
  }

  return (
    <div className="app">
      <NavBar 
        account={account}
        onConnect={connect}
        onDisconnect={disconnect}
        onConnectDifferent={connectDifferentWallet}
        onSwitchNetwork={switchToLocal}
        switchToBaseSepolia={switchToBaseSepolia}
        isCorrectNetwork={isCorrectNetwork}
        isConnecting={isConnecting}
        onNavigate={setCurrentPage}
        currentPage={currentPage}
        currentNetwork={CURRENT_NETWORK.name}
      />
      
      <div className="container">
        {renderPage()}
      </div>
      
      {/* Progress Modal */}
      {showProgressModal && (
        <div className="progress-modal-overlay">
          <div className="progress-modal">
            <h3>Creating DCA Plan</h3>
            
            {/* Plan Preview */}
            <div className="plan-preview">
              <h4>Plan Preview</h4>
              <div className="plan-details">
                <p>
                  This plan will invest <strong>{amountUSDC} {sellToken.symbol}</strong> into <strong>{buyToken.symbol}</strong> every {schedule === 'daily' ? 'day' : 'Monday'}, for <strong>{numExecutions} executions</strong>.
                </p>
                <div className="plan-summary">
                  <div className="summary-item">
                    <span className="label">Total Investment:</span>
                    <span className="value">{(Number(amountUSDC) * numExecutions).toFixed(6)} {sellToken.symbol}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Max Slippage:</span>
                    <span className="value">{slippagePct}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="progress-steps">
              {progressSteps.map((step, index) => (
                <div key={step.id} className={`progress-step ${step.status}`}>
                  <div className="step-indicator">
                    {step.status === 'completed' && (
                      <svg className="checkmark" width="20" height="20" viewBox="0 0 20 20">
                        <path d="M7 10L9 12L13 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {step.status === 'processing' && (
                      <div className="spinner"></div>
                    )}
                    {step.status === 'pending' && (
                      <div className="step-number">{index + 1}</div>
                    )}
                  </div>
                  <span className="step-name">{step.name}</span>
                </div>
              ))}
            </div>
            
            {isProcessComplete && (
              <div className="progress-complete">
                <div className="success-message">
                  <svg className="success-icon" width="24" height="24" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="#28a745"/>
                    <path d="M8 12L11 15L16 9" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>DCA Plan Created Successfully!</span>
                </div>
                <button 
                  className="done-button" 
                  onClick={() => setShowProgressModal(false)}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
