/**
 * QuantScreen — Unified quantitative analysis + backtesting workspace.
 * 6-panel tactical HUD grid: Strategy Builder, Backtest Results,
 * Equity Curve, Portfolio Optimizer, Risk Dashboard, Trade Log.
 */

import { useState } from 'react';
import useStore from '../store/useStore';
import * as api from '../utils/api';
import HudPanel from '../components/layout/HudPanel';

// ── Strategy definitions with default parameters ──────────────────
const STRATEGIES = {
  sma_crossover: {
    label: 'SMA Crossover',
    params: { fast_period: 10, slow_period: 50 },
  },
  rsi_reversal: {
    label: 'RSI Reversal',
    params: { rsi_period: 14, oversold: 30, overbought: 70 },
  },
  macd_crossover: {
    label: 'MACD Crossover',
    params: { fast: 12, slow: 26, signal: 9 },
  },
  bollinger_breakout: {
    label: 'Bollinger Breakout',
    params: { period: 20, std_dev: 2.0 },
  },
  mean_reversion: {
    label: 'Mean Reversion',
    params: { lookback: 20, z_entry: -2.0, z_exit: 0 },
  },
};

const OPTIMIZE_MODES = [
  { value: 'max_sharpe', label: 'Max Sharpe' },
  { value: 'min_vol', label: 'Min Volatility' },
  { value: 'hrp', label: 'HRP' },
  { value: 'equal_weight', label: 'Equal Weight' },
];

// ── Shared inline styles ──────────────────────────────────────────
const labelStyle = {
  fontFamily: 'var(--hud-font)',
  fontSize: 7,
  fontWeight: 700,
  color: 'var(--hud-text-dim)',
  letterSpacing: 2,
  textTransform: 'uppercase',
  marginBottom: 2,
  display: 'block',
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  marginBottom: 6,
};

const btnStyle = {
  width: '100%',
  padding: '6px 10px',
  background: 'rgba(200,205,220,0.08)',
  border: '1px solid var(--hud-line-active)',
  color: 'var(--hud-text-bright)',
  fontFamily: 'var(--hud-font)',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 3,
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background 120ms',
};

const sectionGap = { marginBottom: 8 };

// ── Strategy Builder Panel ────────────────────────────────────────
function StrategyBuilder({ onResults, isRunning, setIsRunning }) {
  const [strategy, setStrategy] = useState('sma_crossover');
  const [params, setParams] = useState({ ...STRATEGIES.sma_crossover.params });
  const [symbol, setSymbol] = useState('AAPL');
  const [dateFrom, setDateFrom] = useState('2023-01-01');
  const [dateTo, setDateTo] = useState('2024-12-31');
  const [capital, setCapital] = useState(10000);
  const [feePct, setFeePct] = useState(0.1);

  const handleStrategyChange = (key) => {
    setStrategy(key);
    setParams({ ...STRATEGIES[key].params });
  };

  const updateParam = (key, val) => {
    setParams((prev) => ({ ...prev, [key]: isNaN(Number(val)) ? val : Number(val) }));
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const result = await api.runBacktest({
        strategy,
        symbol,
        date_from: dateFrom,
        date_to: dateTo,
        capital,
        fee: feePct / 100,
        params,
      });
      onResults(result);
    } catch (err) {
      console.error('Backtest failed:', err);
      onResults(null);
    }
    setIsRunning(false);
  };

  return (
    <HudPanel title="STRATEGY BUILDER">
      <div className="hud-panel-body" style={{ padding: '6px 10px' }}>
        {/* Strategy selector */}
        <label style={labelStyle}>Strategy</label>
        <select
          className="hud-select"
          style={inputStyle}
          value={strategy}
          onChange={(e) => handleStrategyChange(e.target.value)}
        >
          {Object.entries(STRATEGIES).map(([key, s]) => (
            <option key={key} value={key}>{s.label}</option>
          ))}
        </select>

        {/* Dynamic parameters */}
        {Object.entries(params).map(([key, val]) => (
          <div key={key} style={sectionGap}>
            <label style={labelStyle}>{key.replace(/_/g, ' ')}</label>
            <input
              className="hud-input"
              style={inputStyle}
              type="number"
              step="any"
              value={val}
              onChange={(e) => updateParam(key, e.target.value)}
            />
          </div>
        ))}

        {/* Symbol */}
        <label style={labelStyle}>Symbol</label>
        <input
          className="hud-input"
          style={inputStyle}
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        />

        {/* Date range */}
        <div style={{ display: 'flex', gap: 4, ...sectionGap }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>From</label>
            <input
              className="hud-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>To</label>
            <input
              className="hud-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>
        </div>

        {/* Capital & Fee */}
        <div style={{ display: 'flex', gap: 4, ...sectionGap }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Capital ($)</label>
            <input
              className="hud-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Fee %</label>
            <input
              className="hud-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              type="number"
              step="0.01"
              value={feePct}
              onChange={(e) => setFeePct(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Run button */}
        <button
          style={{ ...btnStyle, marginTop: 4, opacity: isRunning ? 0.5 : 1 }}
          onClick={handleRun}
          disabled={isRunning}
        >
          {isRunning ? 'RUNNING...' : 'RUN BACKTEST'}
        </button>
      </div>
    </HudPanel>
  );
}

// ── Backtest Results Panel (metrics) ──────────────────────────────
function BacktestResults({ results }) {
  const metrics = results?.metrics || {};

  const items = [
    { key: 'sharpe_ratio',  label: 'SHARPE',        fmt: (v) => v?.toFixed(2) ?? '--' },
    { key: 'sortino',       label: 'SORTINO',       fmt: (v) => v?.toFixed(2) ?? '--' },
    { key: 'calmar',        label: 'CALMAR',         fmt: (v) => v?.toFixed(2) ?? '--' },
    { key: 'max_drawdown',  label: 'MAX DRAWDOWN',  fmt: (v) => v != null ? `${v.toFixed(2)}%` : '--' },
    { key: 'win_rate',      label: 'WIN RATE',      fmt: (v) => v != null ? `${v.toFixed(1)}%` : '--' },
    { key: 'profit_factor', label: 'PROFIT FACTOR', fmt: (v) => v?.toFixed(2) ?? '--' },
    { key: 'total_return',  label: 'TOTAL RETURN',  fmt: (v) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '--' },
    { key: 'total_trades',  label: 'TRADES',        fmt: (v) => v ?? '--' },
    { key: 'avg_win',       label: 'AVG WIN',       fmt: (v) => v != null ? `$${v.toFixed(2)}` : '--' },
    { key: 'avg_loss',      label: 'AVG LOSS',      fmt: (v) => v != null ? `$${Math.abs(v).toFixed(2)}` : '--' },
  ];

  const colorFor = (key, val) => {
    if (val == null) return '';
    if (key === 'total_return' || key === 'sharpe_ratio' || key === 'sortino' || key === 'calmar' || key === 'profit_factor') {
      return val >= 0 ? 'hud-value--green' : 'hud-value--red';
    }
    if (key === 'win_rate') return val >= 50 ? 'hud-value--green' : 'hud-value--red';
    if (key === 'max_drawdown') return 'hud-value--red';
    if (key === 'avg_loss') return 'hud-value--red';
    if (key === 'avg_win') return 'hud-value--green';
    return '';
  };

  return (
    <HudPanel title="BACKTEST RESULTS">
      <div className="hud-panel-body" style={{ padding: '6px 10px' }}>
        {!results ? (
          <div style={{ padding: 16, textAlign: 'center', fontFamily: 'var(--hud-font)', fontSize: 8, color: 'var(--hud-text-dim)', letterSpacing: 2 }}>
            AWAITING BACKTEST DATA
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {items.map(({ key, label, fmt }) => (
              <div className="hud-readout" key={key} style={{ minWidth: 70 }}>
                <span className="hud-readout__label">{label}</span>
                <span className={`hud-readout__value ${colorFor(key, metrics[key])}`}>
                  {fmt(metrics[key])}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </HudPanel>
  );
}

// ── Equity Curve Panel ────────────────────────────────────────────
function EquityCurve({ results }) {
  const equityCurve = results?.equity_curve || [];
  const finalEquity = equityCurve.length > 0
    ? equityCurve[equityCurve.length - 1]?.value ?? equityCurve[equityCurve.length - 1]?.equity ?? null
    : null;

  return (
    <HudPanel title="EQUITY CURVE">
      <div className="hud-panel-body" style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Final equity readout */}
        {finalEquity != null && (
          <div className="hud-readout" style={{ marginBottom: 6, alignSelf: 'flex-start' }}>
            <span className="hud-readout__label">FINAL EQUITY</span>
            <span className="hud-readout__value hud-value--green">
              ${Number(finalEquity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Chart placeholder */}
        <div
          style={{
            flex: 1,
            minHeight: 80,
            border: '1px solid var(--hud-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--hud-font)',
            fontSize: 8,
            color: 'var(--hud-text-dim)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            background: 'rgba(8,8,20,0.4)',
          }}
        >
          {equityCurve.length > 0
            ? `EQUITY CURVE -- ${equityCurve.length} DATA POINTS -- CHART RENDERS HERE`
            : 'EQUITY CURVE -- NO DATA'}
        </div>
      </div>
    </HudPanel>
  );
}

// ── Portfolio Optimizer Panel ─────────────────────────────────────
function PortfolioOptimizer() {
  const [mode, setMode] = useState('max_sharpe');
  const [symbols, setSymbols] = useState('AAPL,MSFT,GOOGL,NVDA,TSLA');
  const [weights, setWeights] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState(null);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setError(null);
    try {
      const symbolList = symbols.split(',').map((s) => s.trim()).filter(Boolean);
      const result = await api.optimisePortfolio({
        symbols: symbolList,
        mode,
      });
      setWeights(result?.weights || result?.allocation || null);
    } catch (err) {
      console.error('Optimization failed:', err);
      setError('Optimization failed');
      setWeights(null);
    }
    setIsOptimizing(false);
  };

  return (
    <HudPanel title="PORTFOLIO OPTIMIZER">
      <div className="hud-panel-body" style={{ padding: '6px 10px' }}>
        {/* Mode selector */}
        <label style={labelStyle}>Optimization Mode</label>
        <select
          className="hud-select"
          style={inputStyle}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          {OPTIMIZE_MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        {/* Symbols */}
        <label style={labelStyle}>Symbols (comma-separated)</label>
        <input
          className="hud-input"
          style={inputStyle}
          value={symbols}
          onChange={(e) => setSymbols(e.target.value.toUpperCase())}
          placeholder="AAPL,MSFT,GOOGL"
        />

        {/* Optimize button */}
        <button
          style={{ ...btnStyle, marginBottom: 8, opacity: isOptimizing ? 0.5 : 1 }}
          onClick={handleOptimize}
          disabled={isOptimizing}
        >
          {isOptimizing ? 'OPTIMIZING...' : 'OPTIMIZE'}
        </button>

        {/* Error */}
        {error && (
          <div style={{ fontFamily: 'var(--hud-font)', fontSize: 8, color: 'var(--hud-red)', letterSpacing: 1, marginBottom: 4 }}>
            {error}
          </div>
        )}

        {/* Allocation weight bars */}
        {weights && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Object.entries(weights).map(([sym, weight]) => {
              const pct = (weight * 100).toFixed(1);
              return (
                <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontFamily: 'var(--hud-font)',
                    fontSize: 8,
                    color: 'var(--hud-text)',
                    letterSpacing: 1,
                    width: 50,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}>
                    {sym}
                  </span>
                  <div style={{
                    flex: 1,
                    height: 6,
                    background: 'var(--hud-line)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.min(Number(pct), 100)}%`,
                      height: '100%',
                      background: 'var(--hud-text-mid)',
                      transition: 'width 300ms ease',
                    }} />
                  </div>
                  <span style={{
                    fontFamily: 'var(--hud-font)',
                    fontSize: 8,
                    color: 'var(--hud-text)',
                    letterSpacing: 0.5,
                    width: 36,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </HudPanel>
  );
}

// ── Risk Dashboard Panel ──────────────────────────────────────────
function RiskDashboard() {
  const [riskPct, setRiskPct] = useState(2);
  const [stopDist, setStopDist] = useState(5);
  const [accountSize, setAccountSize] = useState(10000);
  const [positionSize, setPositionSize] = useState(null);
  const [safetyStatus, setSafetyStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const calcPosition = async () => {
    setIsLoading(true);
    try {
      const result = await api.calcPositionSize({
        risk_pct: riskPct,
        stop_distance: stopDist,
        account_size: accountSize,
      });
      setPositionSize(result);
    } catch {
      setPositionSize(null);
    }
    setIsLoading(false);
  };

  const fetchSafety = async () => {
    try {
      const status = await api.getSafetyStatus();
      setSafetyStatus(status);
    } catch {
      setSafetyStatus(null);
    }
  };

  // Fetch safety status on mount
  useState(() => { fetchSafety(); });

  const killSwitchLayers = safetyStatus?.layers || safetyStatus?.kill_switch_layers || [];
  // Ensure 7 dots, fill missing with unknown state
  const layerDots = Array.from({ length: 7 }, (_, i) => {
    const layer = killSwitchLayers[i];
    if (!layer) return { status: 'unknown', label: `L${i + 1}` };
    return {
      status: layer.active || layer.status === 'ok' || layer.status === 'active' ? 'active' : 'inactive',
      label: layer.name || layer.label || `L${i + 1}`,
    };
  });

  return (
    <HudPanel title="RISK DASHBOARD">
      <div className="hud-panel-body" style={{ padding: '6px 10px' }}>
        {/* Position sizing calculator */}
        <label style={labelStyle}>Position Sizing</label>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Risk %</label>
            <input
              className="hud-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              type="number"
              step="0.1"
              value={riskPct}
              onChange={(e) => setRiskPct(Number(e.target.value))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Stop Dist ($)</label>
            <input
              className="hud-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              type="number"
              step="0.5"
              value={stopDist}
              onChange={(e) => setStopDist(Number(e.target.value))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Account ($)</label>
            <input
              className="hud-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              type="number"
              value={accountSize}
              onChange={(e) => setAccountSize(Number(e.target.value))}
            />
          </div>
        </div>

        <button
          style={{ ...btnStyle, marginBottom: 8, opacity: isLoading ? 0.5 : 1 }}
          onClick={calcPosition}
          disabled={isLoading}
        >
          CALCULATE
        </button>

        {/* Position size result */}
        {positionSize && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div className="hud-readout">
              <span className="hud-readout__label">SHARES</span>
              <span className="hud-readout__value hud-value--green">
                {positionSize.shares ?? positionSize.position_size ?? '--'}
              </span>
            </div>
            <div className="hud-readout">
              <span className="hud-readout__label">RISK $</span>
              <span className="hud-readout__value hud-value--amber">
                ${positionSize.risk_amount?.toFixed(2) ?? '--'}
              </span>
            </div>
            {positionSize.var_95 != null && (
              <div className="hud-readout">
                <span className="hud-readout__label">VaR 95%</span>
                <span className="hud-readout__value hud-value--red">
                  ${Math.abs(positionSize.var_95).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* VaR from safety status */}
        {safetyStatus?.var_95 != null && !positionSize?.var_95 && (
          <div className="hud-readout" style={{ marginBottom: 8 }}>
            <span className="hud-readout__label">VaR 95%</span>
            <span className="hud-readout__value hud-value--red">
              ${Math.abs(safetyStatus.var_95).toFixed(2)}
            </span>
          </div>
        )}

        {/* 7-layer kill-switch status */}
        <label style={{ ...labelStyle, marginBottom: 4 }}>Kill-Switch Layers</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {layerDots.map((dot, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dot.status === 'active'
                  ? 'var(--hud-green)'
                  : dot.status === 'inactive'
                    ? 'var(--hud-red)'
                    : 'var(--hud-text-dim)',
                boxShadow: dot.status === 'active'
                  ? '0 0 6px var(--hud-green)'
                  : dot.status === 'inactive'
                    ? '0 0 6px var(--hud-red)'
                    : 'none',
                transition: 'background 200ms',
              }} />
              <span style={{
                fontFamily: 'var(--hud-font)',
                fontSize: 5,
                color: 'var(--hud-text-dim)',
                letterSpacing: 0.5,
              }}>
                {dot.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </HudPanel>
  );
}

// ── Trade Log Panel ───────────────────────────────────────────────
function TradeLog({ results }) {
  const trades = results?.trades || [];

  return (
    <HudPanel title="TRADE LOG">
      <div className="hud-panel-body" style={{ padding: 0 }}>
        {trades.length === 0 ? (
          <div style={{
            padding: 16,
            textAlign: 'center',
            fontFamily: 'var(--hud-font)',
            fontSize: 8,
            color: 'var(--hud-text-dim)',
            letterSpacing: 2,
          }}>
            NO TRADES RECORDED
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--hud-font)',
              fontSize: 8,
            }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: 'rgba(8,8,20,0.95)', zIndex: 2 }}>
                  {['DATE', 'TYPE', 'PRICE', 'P&L'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '4px 6px',
                        textAlign: 'left',
                        color: 'var(--hud-text-dim)',
                        fontSize: 6,
                        fontWeight: 700,
                        letterSpacing: 2,
                        borderBottom: '1px solid var(--hud-line)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, i) => {
                  const side = trade.side || trade.type || '--';
                  const isBuy = side.toUpperCase() === 'BUY';
                  const price = trade.price ?? trade.entry ?? '--';
                  const pnl = trade.pnl ?? trade.profit ?? null;

                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid rgba(180,185,200,0.04)',
                      }}
                    >
                      <td style={{ padding: '3px 6px', color: 'var(--hud-text-mid)' }}>
                        {trade.date || trade.timestamp || '--'}
                      </td>
                      <td style={{
                        padding: '3px 6px',
                        color: isBuy ? 'var(--hud-green)' : 'var(--hud-red)',
                        fontWeight: 700,
                        letterSpacing: 1,
                      }}>
                        {side.toUpperCase()}
                      </td>
                      <td style={{ padding: '3px 6px', color: 'var(--hud-text)' }}>
                        {typeof price === 'number' ? `$${price.toFixed(2)}` : price}
                      </td>
                      <td style={{
                        padding: '3px 6px',
                        color: pnl != null
                          ? pnl >= 0 ? 'var(--hud-green)' : 'var(--hud-red)'
                          : 'var(--hud-text-dim)',
                        fontWeight: 700,
                      }}>
                        {pnl != null
                          ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`
                          : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HudPanel>
  );
}

// ── Main QuantScreen ──────────────────────────────────────────────
export default function QuantScreen() {
  const [backtestResults, setBacktestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  return (
    <div
      className="quant-screen"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 2,
        height: '100%',
      }}
    >
      {/* Row 1 */}
      <StrategyBuilder
        onResults={setBacktestResults}
        isRunning={isRunning}
        setIsRunning={setIsRunning}
      />
      <BacktestResults results={backtestResults} />
      <EquityCurve results={backtestResults} />

      {/* Row 2 */}
      <PortfolioOptimizer />
      <RiskDashboard />
      <TradeLog results={backtestResults} />
    </div>
  );
}
