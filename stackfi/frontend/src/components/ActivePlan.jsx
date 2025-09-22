import { fromUnits } from '../lib/units';
import { DECIMALS } from '../config/addresses';

const FREQ = {
  daily: 24 * 60 * 60,
  weekly: 7 * 24 * 60 * 60,
};

const formatFrequency = (freq) => {
  if (freq == FREQ.daily) return 'Daily'
  if (freq == FREQ.weekly) return 'Weekly'
  return `${freq} sec`
}

const ActivePlan = ({ planInfo, sellToken, buyToken, onExecute, onCancel }) => {
  if (!planInfo?.active) {
    return (
      <div className="card plan-card">
        <h3 className="plan-title">No Active Plan</h3>
        <p className="muted">You haven't created a plan yet.</p>
      </div>
    );
  }

  return (
    <div className="card plan-card">
      <h3 className="plan-title">Your Active Plan</h3>
      <div className="plan-details">
        <div className="plan-row">
          <span className="label">Pair</span>
          <span className="value">{sellToken.symbol} → {buyToken.symbol}</span>
        </div>
        <div className="plan-row">
          <span className="label">Amount / Buy</span>
          <span className="value">{fromUnits(planInfo.amountPerBuy, DECIMALS.USDC)} USDC</span>
        </div>
        <div className="plan-row">
          <span className="label">Frequency</span>
          <span className="value">{formatFrequency(planInfo.frequency)}</span>
        </div>
        <div className="plan-row">
          <span className="label">Next Run</span>
          <span className="value">{new Date(planInfo.nextRunAt * 1000).toLocaleString()}</span>
        </div>
        <div className="plan-row">
          <span className="label">Slippage</span>
          <span className="value">{planInfo.slippageBps} bps</span>
        </div>
        <div className="plan-row">
          <span className="label">Progress</span>
          <span className="value">{planInfo.executedCount} / {planInfo.totalExecutions} executions</span>
        </div>
      </div>

      {planInfo.totalExecutions > 0 && (
        <div className="progress-bar-container">
          <div 
            className="progress-bar" 
            style={{ 
              width: `${(planInfo.executedCount / planInfo.totalExecutions) * 100}%` 
            }}
          ></div>
          {/* <div className="progress-text">
            {Math.round((planInfo.executedCount / planInfo.totalExecutions) * 100)}% Complete
          </div> */}
        </div>
      )}

      <div className="plan-actions">
        {/* <button onClick={onExecute} className="btn">Execute Now (Dev)</button> */}
        <button onClick={onCancel} className="btn outline">Cancel Plan</button>
      </div>
    </div>
  );
};

export default ActivePlan;