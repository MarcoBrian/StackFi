import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { ethers } from 'ethers'
import NavBar from './components/NavBar'
import About from './pages/About'
import usdcLogo from './assets/crypto-logo/usd-coin-usdc-logo.svg'
import ethLogo from './assets/crypto-logo/ethereum-eth-logo.svg'
import repeatIcon from './assets/repeat.svg'

const CHAIN_ID_HEX = '0x7a69' // 31337

const TOKENS = {
  USDC: { symbol: 'USDC', decimals: 6, address: '0x0000000000000000000000000000000000000000', logo: usdcLogo },
  WETH: { symbol: 'WETH', decimals: 18, address: '0x0000000000000000000000000000000000000000', logo: ethLogo },
}

function App() {
  const [account, setAccount] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [sellToken, setSellToken] = useState(TOKENS.USDC)
  const [buyToken, setBuyToken] = useState(TOKENS.WETH)
  const [amountUSDC, setAmountUSDC] = useState('')
  const [schedule, setSchedule] = useState('daily')
  const [numExecutions, setNumExecutions] = useState(7)
  const [currentPage, setCurrentPage] = useState('home')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const isCorrectNetwork = chainId === CHAIN_ID_HEX

  const provider = useMemo(() => {
    if (!window.ethereum) return null
    return new ethers.BrowserProvider(window.ethereum)
  }, [])

  useEffect(() => {
    if (!window.ethereum) return
    const handleAccountsChanged = (accs) => setAccount(accs?.[0] ?? null)
    const handleChainChanged = (id) => setChainId(id)
    window.ethereum.request({ method: 'eth_accounts' }).then((accs) => handleAccountsChanged(accs))
    window.ethereum.request({ method: 'eth_chainId' }).then((id) => handleChainChanged(id))
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)
    return () => {
      try {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      } catch {}
    }
  }, [])

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

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      account,
      sellToken: sellToken.symbol,
      buyToken: buyToken.symbol,
      amountUSDC,
      schedule,
      numExecutions,
    }
    console.log('Create plan (UI only):', payload)
    alert('Plan prepared in console. On-chain integration to be added later.')
  }

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

                <section className="grid2">
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
                </section>

                <button type="submit" className="primary">
                  Prepare Recurring Investment
                </button>
              </form>
            </div>
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
