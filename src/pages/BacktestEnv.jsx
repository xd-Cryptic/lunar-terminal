/**
 * BacktestEnv — Strategy backtesting workspace.
 * Runs algos on historical data, shows metrics + equity curve.
 * Compare mode: 2 strategies side by side.
 */

import React, { useState, useRef, useEffect } from 'react';
import { createChart } from 'lightweight-charts';
import useStore from '../store/useStore';

// ── Equity Curve Chart ────────────────────────────────────────────
function EquityCurveChart({ data, compareData, label, compareLabel }) {
  const chartRef = useRef(null);
  useEffect(() => {
    if (!chartRef.current || !data?.length) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { color: '#0d1117' }, textColor: '#94a3b8' },
      grid:   { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      rightPriceScale: { borderColor: '#1e293b' },
      timeScale: { borderColor: '#1e293b', timeVisible: true },
    });
    const series1 = chart.addAreaSeries({ topColor: '#3b82f620', bottomColor: '#3b82f600', lineColor: '#3b82f6', lineWidth: 2, title: label });
    series1.setData(data);
    if (compareData?.length) {
      const series2 = chart.addAreaSeries({ topColor: '#a855f720', bottomColor: '#a855f700', lineColor: '#a855f7', lineWidth: 2, title: compareLabel });
      series2.setData(compareData);
    }
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.applyOptions({ width: chartRef.current?.clientWidth, height: chartRef.current?.clientHeight }));
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [data, compareData]);
  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}

// ── Metrics Cards ─────────────────────────────────────────────────
function MetricsGrid({ metrics, compareMetrics }) {
  const items = [
    { key: 'total_return',  label: 'Total Return', format: v => `${v >= 0 ? '+' : ''}${v?.toFixed(2)}%`, cls: v => v >= 0 ? 'positive' : 'negative' },
    { key: 'sharpe_ratio',  label: 'Sharpe Ratio', format: v => v?.toFixed(2), cls: v => v >= 1 ? 'positive' : v >= 0 ? '' : 'negative' },
    { key: 'sortino',       label: 'Sortino',      format: v => v?.toFixed(2), cls: () => '' },
    { key: 'max_drawdown',  label: 'Max Drawdown', format: v => `${v?.toFixed(2)}%`, cls: v => 'negative' },
    { key: 'win_rate',      label: 'Win Rate',     format: v => `${v?.toFixed(1)}%`, cls: v => v >= 50 ? 'positive' : 'negative' },
    { key: 'total_trades',  label: 'Trades',       format: v => v, cls: () => '' },
    { key: 'profit_factor', label: 'Profit Factor', format: v => v?.toFixed(2), cls: v => v >= 1.5 ? 'positive' : '' },
    { key: 'avg_holding',   label: 'Avg Holding',  format: v => `${v} days`, cls: () => '' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
      {items.map(({ key, label, format, cls }) => (
        <div key={key} className="metric" style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 6 }}>
          <div className="metric__label" style={{ marginBottom: 4 }}>{label}</div>
          <div className={`metric__value ${cls(metrics?.[key] || 0)}`} style={{ fontSize: 16, fontFamily: 'var(--font-mono)' }}>
            {metrics ? format(metrics[key]) : '—'}
          </div>
          {compareMetrics && (
            <div className={`${cls(compareMetrics?.[key] || 0)}`} style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>
              vs {format(compareMetrics[key])}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Trade List ────────────────────────────────────────────────────
function TradeList({ trades }) {
  if (!trades?.length) return <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>No trades to display.</div>;
  return (
    <div style={{ overflowY: 'auto', maxHeight: 200 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        <thead>
          <tr style={{ color: 'var(--text-dim)', textAlign: 'left' }}>
            {['Date', 'Type', 'Entry', 'Exit', 'P&L', 'P&L %', 'Duration'].map(h => (
              <th key={h} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)22' }}>
              <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{t.date}</td>
              <td style={{ padding: '4px 8px', color: t.side === 'BUY' ? 'var(--green)' : 'var(--red)' }}>{t.side}</td>
              <td style={{ padding: '4px 8px' }}>${t.entry?.toFixed(2)}</td>
              <td style={{ padding: '4px 8px' }}>${t.exit?.toFixed(2)}</td>
              <td className={t.pnl >= 0 ? 'positive' : 'negative'} style={{ padding: '4px 8px' }}>{t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}</td>
              <td className={t.pnl_pct >= 0 ? 'positive' : 'negative'} style={{ padding: '4px 8px' }}>{t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct?.toFixed(2)}%</td>
              <td style={{ padding: '4px 8px', color: 'var(--text-dim)' }}>{t.duration}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main BacktestEnv ──────────────────────────────────────────────
export default function BacktestEnv() {
  const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';
  const { backtestState, setBacktestState, setAppMode } = useStore();

  const [strategy, setStrategy]     = useState(backtestState.strategy || 'rsi_macd.py');
  const [strategy2, setStrategy2]   = useState(backtestState.compareStrategy || '');
  const [symbol, setSymbol]         = useState(backtestState.symbol || 'AAPL');
  const [dateFrom, setDateFrom]     = useState(backtestState.dateFrom || '2022-01-01');
  const [dateTo, setDateTo]         = useState(backtestState.dateTo || '2024-12-31');
  const [capital, setCapital]       = useState(backtestState.capital || 10000);
  const [feeStructure, setFeeStructure] = useState(backtestState.feeStructure || 'alpaca');
  const [compareMode, setCompareMode] = useState(false);
  const [results, setResults]       = useState(backtestState.results || null);
  const [results2, setResults2]     = useState(null);
  const [isRunning, setIsRunning]   = useState(false);
  const [algoList, setAlgoList]     = useState([]);
  const [activeTab, setActiveTab]   = useState('metrics');

  const feeStructures = {
    alpaca:  { label: 'Alpaca (0% US stocks)',   value: 0 },
    binance: { label: 'Binance (0.1% maker)',     value: 0.001 },
    oanda:   { label: 'OANDA (spread + 0.5pip)', value: 0.0005 },
    realistic: { label: 'Realistic (0.05%)',      value: 0.0005 },
  };

  useEffect(() => {
    fetch(`${BACKEND}/algos`).then(r => r.json()).then(d => setAlgoList(d.algos || [])).catch(() => setAlgoList([
      { name: 'rsi_macd.py' }, { name: 'sma_cross.py' },
    ]));
  }, []);

  const runBacktest = async (strat, setRes) => {
    const res = await fetch(`${BACKEND}/backtest/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: strat, symbol, date_from: dateFrom, date_to: dateTo, capital, fee: feeStructures[feeStructure]?.value || 0 }),
    });
    return res.json();
  };

  const handleRun = async () => {
    setIsRunning(true);
    setResults(null);
    setResults2(null);
    try {
      const r1 = await runBacktest(strategy, setResults);
      setResults(r1);
      setBacktestState({ results: r1, strategy, symbol });
      if (compareMode && strategy2) {
        const r2 = await runBacktest(strategy2, setResults2);
        setResults2(r2);
        setBacktestState({ compareResults: r2, compareStrategy: strategy2 });
      }
    } catch { setResults(null); }
    setIsRunning(false);
  };

  const exportCSV = () => {
    if (!results?.trades) return;
    const header = 'Date,Type,Entry,Exit,P&L,P&L%,Duration\n';
    const rows = results.trades.map(t => `${t.date},${t.side},${t.entry},${t.exit},${t.pnl},${t.pnl_pct},${t.duration}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backtest_${strategy}_${symbol}.csv`; a.click();
  };

  return (
    <div className="backtest-layout">
      {/* Left: Parameters */}
      <div className="backtest-params">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Backtest Parameters</div>

        <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Strategy</label>
        <select value={strategy} onChange={e => setStrategy(e.target.value)} style={{ width: '100%', padding: '6px 8px', marginBottom: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}>
          {algoList.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
          <option value="rsi_macd.py">rsi_macd.py</option>
          <option value="sma_cross.py">sma_cross.py</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)} />
          Compare mode
        </label>
        {compareMode && (
          <>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Strategy 2</label>
            <select value={strategy2} onChange={e => setStrategy2(e.target.value)} style={{ width: '100%', padding: '6px 8px', marginBottom: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--a855f7)' || 'var(--text-primary)', fontSize: 12 }}>
              {algoList.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
              <option value="sma_cross.py">sma_cross.py</option>
            </select>
          </>
        )}

        {[['Symbol', symbol, setSymbol], ['From', dateFrom, setDateFrom, 'date'], ['To', dateTo, setDateTo, 'date'], ['Capital ($)', capital, setCapital, 'number']].map(([l, v, set, type = 'text']) => (
          <div key={l}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>{l}</label>
            <input type={type} value={v} onChange={e => set(type === 'number' ? Number(e.target.value) : e.target.value)}
              style={{ width: '100%', padding: '6px 8px', marginBottom: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        ))}

        <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2, display: 'block' }}>Fee Structure</label>
        <select value={feeStructure} onChange={e => setFeeStructure(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', marginBottom: 16, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}>
          {Object.entries(feeStructures).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <button className="btn btn--primary" style={{ width: '100%', marginBottom: 8 }} onClick={handleRun} disabled={isRunning}>
          {isRunning ? '⏳ Running Backtest...' : '▶ Run Backtest'}
        </button>
        <button className="btn btn--sm" style={{ width: '100%', marginBottom: 8 }} onClick={() => setAppMode('algo-builder')}>
          ← Edit Algos in IDE
        </button>
        {results && <button className="btn btn--sm" style={{ width: '100%' }} onClick={exportCSV}>⬇ Export CSV</button>}
      </div>

      {/* Right: Results */}
      <div className="backtest-results">
        {!results && !isRunning && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏱</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Configure parameters and click Run Backtest</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Results include: equity curve, Sharpe, Sortino, max drawdown, full trade list</div>
          </div>
        )}
        {isRunning && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <div>Running {strategy} on {symbol}...</div>
          </div>
        )}
        {results && (
          <>
            {/* Tabs */}
            <div className="tabs" style={{ flexShrink: 0 }}>
              {['metrics', 'chart', 'trades'].map(t => (
                <button key={t} className={`tab ${activeTab === t ? 'tab--active' : ''}`} onClick={() => setActiveTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', padding: '0 12px', fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center' }}>
                {strategy} {compareMode && results2 ? `vs ${strategy2}` : ''} · {symbol} · {dateFrom}→{dateTo}
              </span>
            </div>

            <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
              {activeTab === 'metrics' && <MetricsGrid metrics={results.metrics} compareMetrics={compareMode ? results2?.metrics : null} />}
              {activeTab === 'chart'   && (
                <div style={{ height: 400 }}>
                  <EquityCurveChart
                    data={results.equity_curve}
                    compareData={compareMode ? results2?.equity_curve : null}
                    label={strategy}
                    compareLabel={strategy2}
                  />
                </div>
              )}
              {activeTab === 'trades' && <TradeList trades={results.trades} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
