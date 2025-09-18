import { useState, useEffect, useRef } from 'react'
import './NavBar.css'

function NavBar({ account, onConnect, onDisconnect, onConnectDifferent, onSwitchNetwork, isCorrectNetwork, isConnecting, onNavigate, currentPage }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsWalletDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
                <div className="wallet-dropdown" ref={dropdownRef}>
                  <button 
                    className="account-display"
                    onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
                  >
                    {account.slice(0, 6)}...{account.slice(-4)}
                    <span className={`dropdown-arrow ${isWalletDropdownOpen ? 'open' : ''}`}>▼</span>
                  </button>
                  {isWalletDropdownOpen && (
                    <div className="wallet-dropdown-menu">
                      <button 
                        className="wallet-dropdown-item"
                        onClick={() => {
                          onConnectDifferent()
                          setIsWalletDropdownOpen(false)
                        }}
                      >
                        Switch Account
                      </button>
                      <button 
                        className="wallet-dropdown-item"
                        onClick={() => {
                          onDisconnect()
                          setIsWalletDropdownOpen(false)
                        }}
                      >
                        Full Disconnect
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button 
                className="btn" 
                onClick={onConnect}
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
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
          {account ? (
            <div className="mobile-wallet-info">
              <div className="mobile-account">
                {account.slice(0, 6)}...{account.slice(-4)}
              </div>
              <button 
                className="btn outline small mobile-network"
                onClick={onSwitchNetwork}
              >
                {isCorrectNetwork ? 'Foundry Local' : 'Switch Network'}
              </button>
              <button 
                className="btn outline small mobile-switch"
                onClick={() => {
                  onConnectDifferent()
                  setIsMenuOpen(false)
                }}
              >
                Switch Account
              </button>
              <button 
                className="btn outline small mobile-disconnect"
                onClick={() => {
                  onDisconnect()
                  setIsMenuOpen(false)
                }}
              >
                Full Disconnect
              </button>
            </div>
          ) : (
            <button 
              className="btn" 
              onClick={onConnect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      )}
    </nav>
  )
}

export default NavBar