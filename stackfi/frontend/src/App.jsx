import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { ethers } from 'ethers'
import NavBar from './components/NavBar'
import About from './pages/About'

const CHAIN_ID_HEX = '0x7a69' // 31337

const TOKENS = {
  USDC: { symbol: 'USDC', decimals: 6, address: '0x0000000000000000000000000000000000000000' },
  WETH: { symbol: 'WETH', decimals: 18, address: '0x0000000000000000000000000000000000000000' },
}

function App() {
  const [account, setAccount] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [sellToken] = useState(TOKENS.USDC)
  const [buyToken, setBuyToken] = useState(TOKENS.WETH)
  const [amountUSDC, setAmountUSDC] = useState('')
  const [schedule, setSchedule] = useState('daily')
  const [numExecutions, setNumExecutions] = useState(7)
  const [currentPage, setCurrentPage] = useState('home')

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
                    <div className="pill">{sellToken.symbol}</div>
                  </div>
                  <div className="tokenCol">
                    <label>You receive</label>
                    <select value={buyToken.symbol} onChange={(e) => setBuyToken(TOKENS[e.target.value])}>
                      <option value="WETH">WETH</option>
                    </select>
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
                    <span className="unit">USDC</span>
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
