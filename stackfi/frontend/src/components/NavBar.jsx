import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './NavBar.css'

function NavBar({ 
  account, 
  onConnect, 
  onDisconnect, 
  onConnectDifferent, 
  onSwitchNetwork, 
  switchToBaseSepolia, 
  isCorrectNetwork, 
  isConnecting, 
  onNavigate, 
  currentPage,
  currentNetwork = 'Local Hardhat' // New prop with default
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false)
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false)
  const walletDropdownRef = useRef(null)
  const networkDropdownRef = useRef(null)
  const showLocalNetworkOption = import.meta.env.VITE_SHOW_LOCAL === 'true'
  const location = useLocation()
  const isAppRoute = location.pathname === '/app' || location.pathname === '/'
  const isAboutRoute = location.pathname === '/about'

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target)) {
        setIsWalletDropdownOpen(false)
      }
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(event.target)) {
        setIsNetworkDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNetworkSwitch = async (networkType) => {
    setIsNetworkDropdownOpen(false)
    if (networkType === 'local') {
      await onSwitchNetwork()
    } else if (networkType === 'base-sepolia') {
      await switchToBaseSepolia()
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
          <img src="/logo.png" alt="StackFi Logo" className="navbar-logo" />
          <h2>StackFi</h2>
          <span className="beta-badge" > Testnet Beta </span>
        </Link>
        
        <div className="navbar-menu">
          <div className="navbar-links">
            <Link 
              to="/app"
              className={`navbar-link ${isAppRoute ? 'active' : ''}`}
            >App</Link>
            <Link 
              to="/about"
              className={`navbar-link ${isAboutRoute ? 'active' : ''}`}
            >About</Link>
          </div>
          
          <div className="navbar-actions">
            {account ? (
              <div className="wallet-info">
                {/* Network Selector Dropdown */}
                <div className="network-dropdown" ref={networkDropdownRef}>
                  <button 
                    className="network-selector"
                    onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
                    disabled={!account}
                  >
                    <div className="network-info">
                      <div className="network-status">
                        <div className={`network-indicator ${isCorrectNetwork ? 'connected' : 'disconnected'}`}></div>
                        <span className="network-name">{currentNetwork}</span>
                      </div>
                    </div>
                    <span className={`dropdown-arrow ${isNetworkDropdownOpen ? 'open' : ''}`}>▼</span>
                  </button>
                  {isNetworkDropdownOpen && (
                    <div className="network-dropdown-menu">
                      {showLocalNetworkOption && (
                        <button 
                          className="network-dropdown-item"
                          onClick={() => handleNetworkSwitch('local')}
                        >
                          <div className="network-option">
                            <div className="network-option-indicator local"></div>
                            <div className="network-option-info">
                              <span className="network-option-name">Local Hardhat</span>
                              <span className="network-option-chain">Chain ID: 31337</span>
                            </div>
                          </div>
                        </button>
                      )}
                      <button 
                        className="network-dropdown-item"
                        onClick={() => handleNetworkSwitch('base-sepolia')}
                      >
                        <div className="network-option">
                          <div className="network-option-indicator base-sepolia"></div>
                          <div className="network-option-info">
                            <span className="network-option-name">Base Sepolia</span>
                            <span className="network-option-chain">Chain ID: 84532</span>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Wallet Dropdown */}
                <div className="wallet-dropdown" ref={walletDropdownRef}>
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
          <Link 
            to="/app"
            className={`navbar-link ${isAppRoute ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >App</Link>
          <Link 
            to="/about"
            className={`navbar-link ${isAboutRoute ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >About</Link>
          {account ? (
            <div className="mobile-wallet-info">
              <div className="mobile-account">
                {account.slice(0, 6)}...{account.slice(-4)}
              </div>
              <div className="mobile-network-status">
                <div className={`network-indicator ${isCorrectNetwork ? 'connected' : 'disconnected'}`}></div>
                <span>Current: {currentNetwork}</span>
              </div>
              {showLocalNetworkOption && (
                <button 
                  className="btn outline small mobile-network"
                  onClick={() => {
                    handleNetworkSwitch('local')
                    setIsMenuOpen(false)
                  }}
                >
                  Switch to Local Hardhat
                </button>
              )}
              <button 
                className="btn outline small mobile-network"
                onClick={() => {
                  handleNetworkSwitch('base-sepolia')
                  setIsMenuOpen(false)
                }}
              >
                Switch to Base Sepolia
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