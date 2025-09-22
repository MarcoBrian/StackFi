import NavBar from '../components/NavBar'
import About from './About'
import { useWallet } from '../hooks/useWallet'
import { CURRENT_NETWORK } from '../config/addresses'

function AboutPage() {
  const { account, isConnecting, connect, disconnect, connectDifferentWallet, isCorrectNetwork, switchToLocal, switchToBaseSepolia } = useWallet()

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
      <div className="container">
        <About />
      </div>
    </div>
  )
}

export default AboutPage

