import { useState } from 'react'
import './NavBar.css'

function NavBar({ account, onConnect, onSwitchNetwork, isCorrectNetwork, onNavigate, currentPage }) {
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
            <button 
              className={`navbar-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => onNavigate('home')}
            >
              App
            </button>
            <button 
              className={`navbar-link ${currentPage === 'about' ? 'active' : ''}`}
              onClick={() => onNavigate('about')}
            >
              About
            </button>
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
          <button 
            className={`navbar-link ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => {
              onNavigate('home')
              setIsMenuOpen(false)
            }}
          >
            App
          </button>
          <button 
            className={`navbar-link ${currentPage === 'about' ? 'active' : ''}`}
            onClick={() => {
              onNavigate('about')
              setIsMenuOpen(false)
            }}
          >
            About
          </button>
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