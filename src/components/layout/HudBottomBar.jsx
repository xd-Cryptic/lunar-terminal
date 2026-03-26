/**
 * HudBottomBar — Full-width bottom bar with portfolio metrics,
 * open positions table, QuantViz3D widget, and macro indicators.
 * Monochrome tactical HUD aesthetic.
 */

import useStore from '../../store/useStore';
import * as api from '../../utils/api';
import usePolling from '../../hooks/usePolling';
import HudPanel from './HudPanel';
import QuantViz3D from '../QuantViz3D';

export default function HudBottomBar() {
  const { fundAllocation, tradingMode, backendStatus, demoAccounts } = useStore();

  const { data: portfolio } = usePolling(
    () => api.getSimpleSummary().catch(() => null),
    30000, []
  );

  const { data: macro } = usePolling(
    () => api.getMacroData().catch(() => null),
    300000, []
  );

  const totalValue = portfolio?.total_value || demoAccounts.reduce((s, a) => s + (a.equity || a.capital || 0), 0) || 24580;
  const dayPnl = portfolio?.day_pnl || demoAccounts.reduce((s, a) => s + (a.pnl || 0), 0) || 0;

  const positions = demoAccounts.slice(0, 4).map(a => ({
    symbol: a.name,
    qty: '\u2014',
    entry: `$${(a.capital || 0).toLocaleString()}`,
    pnl: a.pnl || 0,
  }));

  const macroItems = [];
  if (macro) {
    if (macro.fed_rate != null) macroItems.push({ label: 'FED RATE', value: `${macro.fed_rate}%` });
    if (macro.cpi != null) macroItems.push({ label: 'CPI', value: `${macro.cpi}%` });
    if (macro.unemployment != null) macroItems.push({ label: 'UNEMP', value: `${macro.unemployment}%` });
    if (macro.gdp != null) macroItems.push({ label: 'GDP', value: `${macro.gdp}%` });
  }
  if (macroItems.length === 0) {
    macroItems.push(
      { label: 'FED RATE', value: '5.25%' },
      { label: 'CPI', value: '3.2%' },
      { label: 'UNEMP', value: '3.8%' },
      { label: 'GDP', value: '2.1%' },
    );
  }

  return (
    <div className="adv-bottom">
      {/* Portfolio Metrics */}
      <HudPanel title="PORTFOLIO" style={{ minWidth: 0 }}>
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 6, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)', letterSpacing: 2, textTransform: 'uppercase' }}>TOTAL VALUE</div>
            <div className="hud-value" style={{ fontSize: 16 }}>
              ${totalValue.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 6, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)', letterSpacing: 2, textTransform: 'uppercase' }}>DAY P&L</div>
            <div className={`hud-value ${dayPnl >= 0 ? 'hud-value--green' : 'hud-value--red'}`} style={{ fontSize: 14 }}>
              {dayPnl >= 0 ? '+' : ''}${dayPnl.toLocaleString()}
            </div>
          </div>
          {/* Fund allocation bar */}
          <div>
            <div style={{ display: 'flex', gap: 0, overflow: 'hidden', height: 2 }}>
              {Object.entries(fundAllocation).map(([k, v]) => {
                const shades = { stocks: '#808090', crypto: '#606070', forex: '#a0a0a8', cash: '#383848' };
                return <div key={k} style={{ width: `${v}%`, background: shades[k] || '#383848' }} title={`${k}: ${v}%`} />;
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
              {Object.entries(fundAllocation).map(([k, v]) => (
                <span key={k} style={{ fontSize: 6, color: 'var(--hud-text-dim)', fontFamily: 'var(--hud-font)', letterSpacing: 1, textTransform: 'uppercase' }}>
                  {k} {v}%
                </span>
              ))}
            </div>
          </div>
        </div>
      </HudPanel>

      {/* Open Positions */}
      <HudPanel title="POSITIONS" style={{ minWidth: 0 }}>
        <div className="pos-mini-table">
          <div className="pos-mini-header">
            <span>SYM</span>
            <span>QTY</span>
            <span>ENTRY</span>
            <span>P&L</span>
          </div>
          <div className="hud-panel-body">
            {positions.length === 0 ? (
              <div style={{ padding: 8, fontSize: 8, color: 'var(--hud-text-dim)', textAlign: 'center', fontFamily: 'var(--hud-font)', letterSpacing: 1 }}>
                NO OPEN POSITIONS
              </div>
            ) : (
              positions.map((p, i) => (
                <div key={i} className="pos-row">
                  <span style={{ color: 'var(--hud-text)', fontWeight: 600, letterSpacing: 1 }}>{p.symbol}</span>
                  <span>{p.qty}</span>
                  <span>{p.entry}</span>
                  <span className={p.pnl >= 0 ? 'positive' : 'negative'}>
                    {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(0)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </HudPanel>

      {/* QuantViz3D + Macro */}
      <HudPanel title="QUANT / MACRO">
        <div style={{ display: 'flex', gap: 3, height: '100%', minHeight: 0 }}>
          <div style={{ width: 220, flexShrink: 0, position: 'relative' }}>
            <QuantViz3D width={220} height={145} title="VOL SURFACE" cols={12} rows={12} />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, padding: '4px 10px' }}>
            {macroItems.map(item => (
              <div key={item.label} className="macro-item">
                <span className="macro-item__label">{item.label}</span>
                <span className="macro-item__value">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Status bar */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '2px 10px',
            borderTop: '1px solid var(--hud-line)',
            fontSize: 6, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)',
            letterSpacing: 1.5, textTransform: 'uppercase',
          }}>
            <span style={{ color: backendStatus === 'connected' ? 'var(--hud-green)' : 'var(--hud-amber)' }}>
              {backendStatus === 'connected' ? 'ONLINE' : 'CONNECTING'}
            </span>
            <span>MODE: <span style={{ color: tradingMode === 'live' ? 'var(--hud-red)' : 'var(--hud-text-mid)' }}>{tradingMode.toUpperCase()}</span></span>
            <span style={{ marginLeft: 'auto' }}>LAST: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </HudPanel>
    </div>
  );
}
