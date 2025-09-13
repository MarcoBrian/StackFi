import './About.css'

function About() {
  return (
    <div className="about-page">
      <div className="about-container">
        <div className="about-header">
          <div className="about-title-container">
            <img src="/logo.png" alt="StackFi Logo" className="about-logo" />
            <h1>About StackFi</h1>
          </div>
          <p className="about-subtitle">
            StackFi is a non-custodial, oracle-secured decentralized application that automates dollar-cost averaging (DCA) 
            into crypto portfolios, safely and transparently on-chain.
          </p>
        </div>

        <div className="about-content">
          <section className="about-section">
            <h2>The Problem</h2>
            <p>
              Most crypto investors want to accumulate crypto assets over time. 
Today, they still rely on centralized exchanges to do so and do not have self-custody of their assets.
            </p>
          </section>

          <section className="about-section">
            <h2>Our Solution</h2>
            <p>
              StackFi addresses this by bringing DCA on-chain with security, transparency, and automation. Users can connect their wallet and start investing.
            </p>
            <div className="solution-grid">
              <div className="solution-item">
                <div className="solution-icon">
                  <img src="/src/assets/custodial.svg" alt="Custodial icon" style={{width: '48px', height: '48px'}} />
                </div>
                <h3>Non-Custodial</h3>
                <p>Users deposit USDC and configure recurring buys while maintaining full control of their assets</p>
              </div>
              <div className="solution-item">
                <div className="solution-icon">
                  <img src="/src/assets/repeat.svg" alt="Repeat icon" style={{width: '48px', height: '48px'}} />
                </div>
                <h3>Automated Execution</h3>
                <p>Smart contracts execute swaps via decentralized exchanges on your schedule</p>
              </div>
              <div className="solution-item">
                <div className="solution-icon">
                  <img src="/src/assets/nodes.svg" alt="Nodes icon" style={{width: '48px', height: '48px'}} />
                </div>
                <h3>Oracle Protection</h3>
                <p>Chainlink price feeds ensure fair pricing and protect against manipulation</p>
              </div>
              <div className="solution-item">
                <div className="solution-icon">
                  <img src="/src/assets/chart.svg" alt="Chart icon" style={{width: '48px', height: '48px'}} />
                </div>
                <h3>Transparent Tracking</h3>
                <p>Complete logging of cost basis and execution history on-chain</p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Features</h2>
            <div className="features-list">
              <div className="feature-item">
                <span className="feature-check">✓</span>
                <span>Non-custodial USDC deposits and withdrawals</span>
              </div>
              <div className="feature-item">
                <span className="feature-check">✓</span>
                <span>Automated recurring buys</span>
              </div>
              <div className="feature-item">
                <span className="feature-check">✓</span>
                <span>Oracle-protected execution with Chainlink price feeds</span>
              </div>
              <div className="feature-item">
                <span className="feature-check">✓</span>
                <span>Transparent logging of cost basis and execution history</span>
              </div>
              
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

export default About