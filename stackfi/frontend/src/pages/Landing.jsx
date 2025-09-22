import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import './Landing.css'
import { CURRENT_NETWORK } from '../config/addresses'
import { useWallet } from '../hooks/useWallet'

function Landing() {
  const { account, isConnecting, connect, disconnect, connectDifferentWallet, isCorrectNetwork, switchToLocal, switchToBaseSepolia } = useWallet()

  const features = useMemo(() => ([
    { title: 'Automated DCA', desc: 'Invest on a schedule with non-custodial smart contracts.' },
    { title: 'On-Chain Execution', desc: 'Transparent, verifiable swaps at each interval.' },
    { title: 'Flexible Slippage', desc: 'Set your slippage tolerance with sensible defaults.' },
  ]), [])

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
        onNavigate={() => {}}
        currentPage={''}
        currentNetwork={CURRENT_NETWORK.name}
      />

      <header className="landing-hero">
        <div className="landing-container">
          <div className="hero-grid">
            <div className="hero-copy">
              <h1 className="landing-title">Automated Dollar Cost Averaging On-Chain</h1>
              <p className="landing-subtitle">Stack and grow your crypto portfolio automatically with transparent smart contracts.</p>
              <div className="landing-cta">
                <Link className="btn" to="/app">Launch App</Link>
                <Link className="btn outline" to="/about">How it works</Link>
              </div>
            </div>
            <div className="hero-visual">
              <div className="stack-visual" aria-hidden="true">
                <div className="stack-layer"></div>
                <div className="stack-layer"></div>
                <div className="stack-layer"></div>
                <div className="stack-layer"></div>
                <div className="stack-layer"></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* <main className="landing-main">
        


      </main> */}

      <footer className="landing-footer">
        <div className="landing-container">
          <span>© {new Date().getFullYear()} StackFi</span>
          <div className="footer-links">
            <Link to="/app">App</Link>
            <Link to="/about">How it works</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing

