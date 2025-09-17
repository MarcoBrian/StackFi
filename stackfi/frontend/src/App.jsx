import { useEffect, useState } from 'react'
import './App.css'
import { ethers } from 'ethers'
import NavBar from './components/NavBar'
import About from './pages/About'
import ActivePlan from './components/ActivePlan'
import usdcLogo from './assets/crypto-logo/usd-coin-usdc-logo.svg'
import ethLogo from './assets/crypto-logo/ethereum-eth-logo.svg'
import repeatIcon from './assets/repeat.svg'



import { ADDRS, DECIMALS, CHAIN_ID_HEX } from './config/addresses';
import { getVault, getErc20 } from './lib/contracts';
import { toUnits, fromUnits } from './lib/units';


const TOKENS = {
    USDC: { symbol: 'USDC', decimals: DECIMALS.USDC, address: ADDRS.USDC, logo: usdcLogo },
    WETH: { symbol: 'WETH', decimals: DECIMALS.WETH, address: ADDRS.WETH, logo: ethLogo },
};


function App() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
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
  const isCorrectNetwork = chainId === CHAIN_ID_HEX


  const normalizePlan = (p) => ({
    tokenIn: p.tokenIn,
    tokenOut: p.tokenOut,
    amountPerBuy: p.amountPerBuy,               // bigint, keep as bigint
    frequency: Number(p.frequency),             // fits u32 → number OK
    nextRunAt: Number(p.nextRunAt),             // fits u40 → number OK
    slippageBps: Number(p.slippageBps),         // u16 → number
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
    if (!window.ethereum) throw new Error('Wallet not found');
    if (!account) {
    const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setAccount(accs[0]);
    }
    const id = await window.ethereum.request({ method: 'eth_chainId' });
    setChainId(id);
    if (id !== CHAIN_ID_HEX) throw new Error('Wrong network');
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
    
    
    const depositUSDC = async (rawAmount) => {
    const amount = toUnits(rawAmount, DECIMALS.USDC); // bigint
    await ensureWallet();
    await approveIfNeeded(ADDRS.USDC, ADDRS.VAULT, amount);
    const vault = await getVault();
    const tx = await vault.deposit(ADDRS.USDC, amount);
    await tx.wait();
    await refreshState(); 
    return amount;
    };
    
    
    const createDcaPlan = async (tokenIn, tokenOut, amountPerBuyUSDC, scheduleKey, slippageBps = 100) => {
    await ensureWallet();
    const vault = await getVault();
    const amountPerBuy = toUnits(amountPerBuyUSDC, DECIMALS.USDC);
    const frequency = FREQ[scheduleKey];
    if (!frequency) throw new Error('Invalid schedule');
    if (tokenIn === tokenOut) throw new Error('tokenIn == tokenOut');
    const tx = await vault.createPlan(tokenIn, tokenOut, amountPerBuy, frequency, slippageBps);
    await tx.wait();
    await refreshState(); 
    };
    
    
    const executeSelf = async () => {
    await ensureWallet();
    const vault = await getVault();
    const tx = await vault.execute(account);
    await tx.wait();
    await refreshState(); 
    };
    
    
    const cancelPlan = async () => {
    await ensureWallet();
    const vault = await getVault();
    const tx = await vault.cancelPlan();
    await tx.wait();
    await refreshState(); 
    };


    // Refresh when account / chain changes
    useEffect(() => {
      if (account && chainId) {
        refreshState().catch(console.error);
      }
    }, [account, chainId]);


  // Setting up wallet listeners and events
  useEffect(() => {
    if (!window.ethereum) return;
    let isMounted = true;


    const handleAccountsChanged = (accs) => {
    if (!isMounted) return;
    setAccount(accs?.[0] ?? null);
    // Optional: refreshState(); // re-read vault balances/plan
    };


    const handleChainChanged = (id) => {
    if (!isMounted) return;
    setChainId(id);
    // Optional: if (id !== CHAIN_ID_HEX) prompt to switch or show banner
    // Optional: refreshState();
    };


    const handleConnect = (info) => {
    // info?.chainId may be provided (hex string)
    // You can re-run reconcile here if desired
    };


    const handleDisconnect = (error) => {
    if (!isMounted) return;
    setAccount(null);
    };


    // Initial reconcile (silent, no popup)
    (async () => {
    try {
    const accs = await window.ethereum.request({ method: 'eth_accounts' });
    handleAccountsChanged(accs);
    const id = await window.ethereum.request({ method: 'eth_chainId' });
    handleChainChanged(id);
    } catch (e) {
    console.error('wallet reconcile failed', e);
    }
    })();


    // Subscribe wallet events
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('connect', handleConnect);
    window.ethereum.on('disconnect', handleDisconnect);


    // Cleanup
    return () => {
    isMounted = false;
    try {
    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    window.ethereum.removeListener('chainChanged', handleChainChanged);
    window.ethereum.removeListener('connect', handleConnect);
    window.ethereum.removeListener('disconnect', handleDisconnect);
    } catch {}
    };
}, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && !event.target.closest('.custom-dropdown')) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  // Auto-switch buy token if it becomes the same as sell token
  useEffect(() => {
    if (buyToken.symbol === sellToken.symbol) {
      const otherToken = Object.values(TOKENS).find(token => token.symbol !== sellToken.symbol)
      if (otherToken) {
        setBuyToken(otherToken)
      }
    }
  }, [sellToken, buyToken])

  const connect = async () => {
    if (!window.ethereum) {
      alert('Wallet not found')
      return
    }
    const accs = await window.ethereum.request({ method: 'eth_requestAccounts' })
    setAccount(accs[0])
    const id = await window.ethereum.request({ method: 'eth_chainId' })
    setChainId(id)
  }

  const switchToLocal = async () => {
    if (!window.ethereum) return
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] })
    } catch (err) {
      if (err?.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: CHAIN_ID_HEX,
              chainName: 'Foundry Local',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['http://127.0.0.1:8545'],
            },
          ],
        })
      }
    }
  }

  const handleTokenSelect = (tokenSymbol) => {
    setBuyToken(TOKENS[tokenSymbol])
    setIsDropdownOpen(false)
  }

  const switchTokens = () => {
    const tempSellToken = sellToken
    setSellToken(buyToken)
    setBuyToken(tempSellToken)
  }

  // Get available tokens for the receive dropdown (exclude the sell token)
  const availableTokens = Object.values(TOKENS).filter(token => token.symbol !== sellToken.symbol)

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
    if (!account) throw new Error('Connect wallet first');
    
    // UI only supports USDC → WETH for now; extend as needed
    const tokenIn = sellToken.address; // typically USDC
    const tokenOut = buyToken.address; // typically WETH
    
    
    if (!amountUSDC || Number(amountUSDC) <= 0) throw new Error('Enter amount');
    
    
    // 1) approve & deposit to vault
    await depositUSDC(amountUSDC);
    
    
    // 2) create the plan with chosen slippage (percent → bps)
    const parsedPct = Number.parseFloat(slippagePct);
    const safePct = Number.isFinite(parsedPct) ? Math.max(0, Math.min(20, parsedPct)) : 0.5; // clamp 0–20%
    const slippageBps = Math.round(safePct * 100);
    await createDcaPlan(tokenIn, tokenOut, amountUSDC, schedule, slippageBps);
    
    alert('Plan created! Vault will execute when due.');
    } catch (err) {
    console.error(err);
    alert(err?.message ?? 'Tx failed');
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
            <p className="subtitle">Stack and grow your portfolio automatically</p>

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
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amountUSDC}
                      onChange={(e) => setAmountUSDC(e.target.value)}
                      required
                    />
                    <span className="unit">USD</span>
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

                <button type="submit" className="primary">
                  Prepare Recurring Investment
                </button>
              </form>
            </div>

            {account && (
            <div className="card">
            <h3>Your Vault Balances</h3>
            <div>USDC: {vaultUsdc}</div>
            <div>WETH: {vaultWeth}</div>

            <ActivePlan 
              planInfo={planInfo}
              sellToken={sellToken}
              buyToken={buyToken}
              onExecute={executeSelf}
              onCancel={cancelPlan}
            />

            

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
        onSwitchNetwork={switchToLocal}
        isCorrectNetwork={isCorrectNetwork}
        onNavigate={setCurrentPage}
        currentPage={currentPage}
      />
      
      <div className="container">
        {renderPage()}
      </div>
    </div>
  )
}

export default App
