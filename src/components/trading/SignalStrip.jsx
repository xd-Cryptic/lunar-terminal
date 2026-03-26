/**
 * SignalStrip — Active signals display + BUY/SELL trade buttons +
 * risk slider + position sizer. Monochrome tactical HUD.
 */

import { useState, useCallback } from 'react';
import useStore from '../../store/useStore';
import * as api from '../../utils/api';
import HudPanel from '../layout/HudPanel';

export default function SignalStrip() {
  const {
    signals, activeSymbol, quotes, riskSettings, marketType,
    tradingMode, demoAccounts,
  } = useStore();

  const [qty, setQty] = useState(1);
  const [riskPct, setRiskPct] = useState(riskSettings[marketType]?.riskPct || 2);
  const [tradeStatus, setTradeStatus] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const q = quotes[activeSymbol] || {};

  const calcSize = useCallback(async (risk) => {
    try {
      const data = await api.calcPositionSize({
        account_value: 10000,
        risk_pct: risk,
        entry_price: q.price || 100,
        stop_loss: (q.price || 100) * 0.97,
      });
      if (data.shares) setQty(Math.max(1, data.shares));
    } catch { /* keep current qty */ }
  }, [q.price]);

  const handleRiskChange = (e) => {
    const val = Number(e.target.value);
    setRiskPct(val);
    calcSize(val);
  };

  const executeTrade = async (side) => {
    setTradeStatus('checking');
    setStatusMsg('CHECKING RISK LIMITS...');

    try {
      const check = await api.checkOrder(
        { symbol: activeSymbol, side, qty, price: q.price },
        marketType
      );

      if (check.blocked) {
        setTradeStatus('blocked');
        setStatusMsg(check.reason || 'ORDER BLOCKED BY RISK MANAGER');
        return;
      }

      const demoAcct = demoAccounts[0];
      if (demoAcct) {
        await api.demoTrade(demoAcct.id, {
          symbol: activeSymbol, side, qty, price: q.price,
        });
        setTradeStatus('success');
        setStatusMsg(`${side} ${qty} ${activeSymbol} @ $${q.price}`);
      } else {
        setTradeStatus('success');
        setStatusMsg(`SIGNAL: ${side} ${qty} ${activeSymbol}`);
      }
    } catch (err) {
      setTradeStatus('error');
      setStatusMsg(err.message || 'TRADE FAILED');
    }

    setTimeout(() => { setTradeStatus(null); setStatusMsg(''); }, 4000);
  };

  const recentSignals = signals.slice(-5);

  return (
    <HudPanel title="SIGNALS / TRADE" variant={tradeStatus === 'blocked' ? 'red' : tradeStatus === 'success' ? 'green' : 'default'}>
      <div className="signal-strip">
        {/* Signals area */}
        <div className="signal-strip__signals">
          {recentSignals.length === 0 ? (
            <div style={{ fontSize: 8, color: 'var(--hud-text-dim)', fontFamily: 'var(--hud-font)', letterSpacing: 2 }}>
              AWAITING SIGNALS...
            </div>
          ) : (
            recentSignals.map((s, i) => (
              <div key={i} className="signal-card">
                <span className={`signal-card__type signal-card__type--${(s.type || 'hold').toLowerCase()}`}>
                  {s.type}
                </span>
                <div style={{ fontSize: 9, fontFamily: 'var(--hud-font)' }}>
                  <div style={{ color: 'var(--hud-text)' }}>@ ${s.price?.toFixed(2) || '\u2014'}</div>
                  <div style={{ color: 'var(--hud-text-dim)', fontSize: 6, marginTop: 1, letterSpacing: 0.5 }}>
                    {(s.reasons || []).slice(0, 2).join(' \u00B7 ')}
                  </div>
                </div>
                <div className="signal-strength">
                  {[...Array(5)].map((_, j) => (
                    <span key={j} className={`signal-dot ${j < (s.strength || 3) ? `signal-dot--${s.type === 'BUY' ? 'buy' : s.type === 'SELL' ? 'sell' : 'fill'}` : ''}`} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Trade area */}
        <div className="signal-strip__trade">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 7, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)', letterSpacing: 1 }}>
            <span>RISK</span>
            <input
              type="range"
              className="risk-slider"
              min={0.5} max={5} step={0.5}
              value={riskPct}
              onChange={handleRiskChange}
            />
            <span style={{ color: riskPct > 3 ? 'var(--hud-red)' : 'var(--hud-text)', fontWeight: 700 }}>
              {riskPct}%
            </span>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 7, color: 'var(--hud-text-dim)', fontFamily: 'var(--hud-font)', letterSpacing: 1 }}>QTY</span>
            <input
              type="number"
              className="hud-input"
              value={qty}
              min={1}
              onChange={e => setQty(Math.max(1, Number(e.target.value)))}
              style={{ flex: 1, padding: '2px 6px', fontSize: 10 }}
            />
          </div>

          <div className="signal-strip__trade-btns">
            <button className="trade-btn trade-btn--buy" onClick={() => executeTrade('BUY')} disabled={tradeStatus === 'checking'}>
              BUY
            </button>
            <button className="trade-btn trade-btn--sell" onClick={() => executeTrade('SELL')} disabled={tradeStatus === 'checking'}>
              SELL
            </button>
          </div>

          {statusMsg && (
            <div style={{
              fontSize: 7, fontFamily: 'var(--hud-font)', textAlign: 'center', padding: '2px 4px',
              letterSpacing: 1,
              color: tradeStatus === 'error' || tradeStatus === 'blocked' ? 'var(--hud-red)' : tradeStatus === 'success' ? 'var(--hud-green)' : 'var(--hud-text-mid)',
            }}>
              {statusMsg}
            </div>
          )}
        </div>
      </div>
    </HudPanel>
  );
}
