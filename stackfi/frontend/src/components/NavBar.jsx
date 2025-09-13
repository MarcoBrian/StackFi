import { useState } from 'react'
import './NavBar.css'

function NavBar({ account, onConnect, onSwitchNetwork, isCorrectNetwork }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <img src="/logo.png" alt="StackFi Logo" className="navbar-logo" />
          <h2>StackFi</h2>
        </div>
        
        <div className="navbar-menu">
          <div className="navbar-links">
            <a href="#home" className="navbar-link">Home</a>
            <a href="#about" className="navbar-link">About</a>
          </div>
          
          <div className="navbar-actions">
            {account ? (
              <div className="wallet-info">
                <button 
                  className="btn outline small" 
                  onClick={onSwitchNetwork}
                  disabled={!account}
                >
                  {isCorrectNetwork ? 'Foundry Local' : 'Switch Network'}
                </button>
                <div className="account-display">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </div>
              </div>
            ) : (
              <button className="btn" onClick={onConnect}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
        
        <button 
          className="navbar-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      
      {isMenuOpen && (
        <div className="navbar-mobile">
          <a href="#home" className="navbar-link">Home</a>
          <a href="#invest" className="navbar-link">Invest</a>
          <a href="#portfolio" className="navbar-link">Portfolio</a>
          <a href="#about" className="navbar-link">About</a>
          {!account && (
            <button className="btn" onClick={onConnect}>
              Connect Wallet
            </button>
          )}
        </div>
      )}
    </nav>
  )
}

export default NavBar