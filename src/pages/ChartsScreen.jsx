/**
 * ChartsScreen — Full-screen charting workspace for the Lunar Terminal.
 * Multi-chart layout with indicator sidebar, comparison mode, and AI trigger.
 * Monochrome tactical HUD aesthetic.
 */

import { useState, useCallback } from 'react';
import useStore from '../store/useStore';
import HudPanel from '../components/layout/HudPanel';
import ChartPanel from '../components/charts/ChartPanel';

// ── Indicator catalog organised by group ─────────────────────────────
const INDICATOR_GROUPS = {
  trend: {
    label: 'TREND',
    items: [
      { id: 'sma', label: 'SMA' },
      { id: 'ema', label: 'EMA' },
      { id: 'ichimoku', label: 'Ichimoku' },
      { id: 'parabolic_sar', label: 'Parabolic SAR' },
      { id: 'adx', label: 'ADX' },
    ],
  },
  momentum: {
    label: 'MOMENTUM',
    items: [
      { id: 'rsi', label: 'RSI' },
      { id: 'macd', label: 'MACD' },
      { id: 'stochastic', label: 'Stochastic' },
      { id: 'williams_r', label: 'Williams %R' },
      { id: 'cci', label: 'CCI' },
      { id: 'roc', label: 'ROC' },
      { id: 'mfi', label: 'MFI' },
    ],
  },
  volatility: {
    label: 'VOLATILITY',
    items: [
      { id: 'bbands', label: 'Bollinger' },
      { id: 'keltner', label: 'Keltner' },
      { id: 'donchian', label: 'Donchian' },
      { id: 'atr', label: 'ATR' },
    ],
  },
  volume: {
    label: 'VOLUME',
    items: [
      { id: 'obv', label: 'OBV' },
      { id: 'vwap', label: 'VWAP' },
    ],
  },
  levels: {
    label: 'LEVELS',
    items: [
      { id: 'fibonacci', label: 'Fibonacci' },
    ],
  },
};

// Inline styles (following QuantScreen pattern)
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

const checkboxRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 0',
  cursor: 'pointer',
  fontFamily: 'var(--hud-font)',
  fontSize: 9,
  color: 'var(--hud-text)',
  letterSpacing: 0.5,
  transition: 'color 80ms',
};

const groupHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 0 3px',
  cursor: 'pointer',
  fontFamily: 'var(--hud-font)',
  fontSize: 8,
  fontWeight: 700,
  color: 'var(--hud-text-mid)',
  letterSpacing: 2,
  textTransform: 'uppercase',
  userSelect: 'none',
  borderBottom: '1px solid var(--hud-line)',
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

const tabBtnStyle = (active) => ({
  padding: '3px 10px',
  background: active ? 'rgba(200,205,220,0.08)' : 'none',
  border: '1px solid',
  borderColor: active ? 'var(--hud-line-active)' : 'transparent',
  color: active ? 'var(--hud-text)' : 'var(--hud-text-dim)',
  fontFamily: 'var(--hud-font)',
  fontSize: 8,
  fontWeight: 600,
  letterSpacing: 1,
  cursor: 'pointer',
  transition: 'all 80ms',
  textTransform: 'uppercase',
});

const MAX_CHARTS = 4;


export default function ChartsScreen() {
  const { activeSymbol, setActiveSymbol } = useStore();

  // Chart slots state
  const [charts, setCharts] = useState([
    { id: 1, symbol: activeSymbol, timeframe: '1D' },
  ]);
  const [activeChartId, setActiveChartId] = useState(1);

  // Indicators state (shared across all charts)
  const [activeIndicators, setActiveIndicators] = useState([]);

  // Collapsed groups in sidebar
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Comparison mode
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonInput, setComparisonInput] = useState('');
  const [comparisonSymbols, setComparisonSymbols] = useState([]);

  // AI Analyse period
  const [analysisPeriod, setAnalysisPeriod] = useState('swing');

  // Next chart id
  const [nextId, setNextId] = useState(2);

  // ── Chart management ────────────────────────────────────────────────
  const addChart = useCallback(() => {
    if (charts.length >= MAX_CHARTS) return;
    const id = nextId;
    setNextId(id + 1);
    setCharts(prev => [...prev, { id, symbol: activeSymbol, timeframe: '1D' }]);
    setActiveChartId(id);
  }, [charts.length, nextId, activeSymbol]);

  const removeChart = useCallback((id) => {
    setCharts(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) return prev; // never remove last
      return next;
    });
    setActiveChartId(prev => {
      const remaining = charts.filter(c => c.id !== id);
      if (remaining.length && !remaining.find(c => c.id === prev)) {
        return remaining[0].id;
      }
      return prev;
    });
  }, [charts]);

  const updateChart = useCallback((id, patch) => {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  // ── Indicator toggling ──────────────────────────────────────────────
  const toggleIndicator = useCallback((indId) => {
    setActiveIndicators(prev =>
      prev.includes(indId)
        ? prev.filter(i => i !== indId)
        : [...prev, indId]
    );
  }, []);

  // ── Comparison mode ─────────────────────────────────────────────────
  const toggleComparison = useCallback(() => {
    if (comparisonMode) {
      setComparisonMode(false);
      setComparisonSymbols([]);
    } else {
      setComparisonMode(true);
    }
  }, [comparisonMode]);

  const addComparisonSymbol = useCallback(() => {
    const sym = comparisonInput.trim().toUpperCase();
    if (sym && !comparisonSymbols.includes(sym)) {
      setComparisonSymbols(prev => [...prev, sym]);
    }
    setComparisonInput('');
  }, [comparisonInput, comparisonSymbols]);

  const removeComparisonSymbol = useCallback((sym) => {
    setComparisonSymbols(prev => prev.filter(s => s !== sym));
  }, []);

  // ── Group collapse toggle ───────────────────────────────────────────
  const toggleGroup = useCallback((groupId) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  // ── Symbol change from within a ChartPanel ──────────────────────────
  const handleSymbolChange = useCallback((chartId, newSymbol) => {
    updateChart(chartId, { symbol: newSymbol });
    setActiveSymbol(newSymbol);
  }, [updateChart, setActiveSymbol]);

  // ── AI Analyse trigger ──────────────────────────────────────────────
  const handleAiAnalyse = useCallback(() => {
    // Set analysis state and switch to analysis mode
    const store = useStore.getState();
    store.setAnalysisState({
      symbol: charts.find(c => c.id === activeChartId)?.symbol || activeSymbol,
      timeframe: charts.find(c => c.id === activeChartId)?.timeframe || '1D',
      indicators: activeIndicators.length > 0 ? activeIndicators : ['rsi', 'macd'],
    });
    store.setAppMode('analysis');
  }, [charts, activeChartId, activeSymbol, activeIndicators]);

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      minHeight: 0,
      background: 'radial-gradient(ellipse at 50% 45%, rgba(15,15,30,0.3) 0%, transparent 70%), var(--hud-bg)',
      position: 'relative',
      gap: 2,
      padding: 2,
    }}>

      {/* ── Charts Area (left, fills remaining space) ────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, gap: 2 }}>

        {/* Chart tab bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
          background: 'rgba(8,8,20,0.6)',
          borderBottom: '1px solid var(--hud-line)',
          flexShrink: 0,
        }}>
          {charts.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                style={tabBtnStyle(activeChartId === c.id)}
                onClick={() => setActiveChartId(c.id)}
              >
                {c.symbol} {c.timeframe}
              </button>
              {charts.length > 1 && (
                <button
                  style={{
                    background: 'none', border: 'none', color: 'var(--hud-text-dim)',
                    cursor: 'pointer', fontSize: 10, fontFamily: 'var(--hud-font)',
                    padding: '0 2px', lineHeight: 1,
                  }}
                  onClick={() => removeChart(c.id)}
                  title="Remove chart"
                >
                  x
                </button>
              )}
            </div>
          ))}

          {charts.length < MAX_CHARTS && (
            <button
              style={{
                ...tabBtnStyle(false),
                color: 'var(--hud-text-mid)',
                borderColor: 'var(--hud-line)',
              }}
              onClick={addChart}
              title="Add chart"
            >
              + ADD
            </button>
          )}

          <button
            style={{
              ...tabBtnStyle(comparisonMode),
              marginLeft: 'auto',
              color: comparisonMode ? 'var(--hud-green)' : 'var(--hud-text-dim)',
              borderColor: comparisonMode ? 'var(--hud-green)' : 'var(--hud-line)',
            }}
            onClick={toggleComparison}
          >
            COMPARE
          </button>
        </div>

        {/* Comparison symbols bar */}
        {comparisonMode && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
            background: 'rgba(0,204,136,0.03)',
            borderBottom: '1px solid rgba(0,204,136,0.15)',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--hud-font)', fontSize: 7, color: 'var(--hud-text-dim)', letterSpacing: 2 }}>
              COMPARE:
            </span>
            {comparisonSymbols.map(sym => (
              <span key={sym} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '1px 6px',
                background: 'rgba(0,204,136,0.08)',
                border: '1px solid rgba(0,204,136,0.2)',
                fontFamily: 'var(--hud-font)', fontSize: 8,
                color: 'var(--hud-text)', letterSpacing: 1,
              }}>
                {sym}
                <span
                  style={{ cursor: 'pointer', color: 'var(--hud-red)', fontSize: 10, lineHeight: 1 }}
                  onClick={() => removeComparisonSymbol(sym)}
                >
                  x
                </span>
              </span>
            ))}
            <input
              value={comparisonInput}
              onChange={e => setComparisonInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addComparisonSymbol(); }}
              placeholder="Add symbol..."
              style={{
                background: 'rgba(5,5,16,0.6)',
                border: '1px solid var(--hud-line)',
                color: 'var(--hud-text)',
                fontFamily: 'var(--hud-font)',
                fontSize: 9,
                padding: '2px 6px',
                width: 100,
                outline: 'none',
              }}
            />
            <button
              style={{
                background: 'none', border: '1px solid var(--hud-line)',
                color: 'var(--hud-text-mid)', fontFamily: 'var(--hud-font)',
                fontSize: 8, padding: '2px 8px', cursor: 'pointer',
                letterSpacing: 1,
              }}
              onClick={addComparisonSymbol}
            >
              ADD
            </button>
          </div>
        )}

        {/* Chart panels */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0,
          overflow: 'hidden',
        }}>
          {charts.map(c => (
            <div
              key={c.id}
              style={{
                flex: 1,
                minHeight: 0,
                display: activeChartId === c.id || charts.length <= 2 ? 'flex' : 'none',
                flexDirection: 'column',
                border: activeChartId === c.id ? '1px solid var(--hud-line-active)' : '1px solid var(--hud-line)',
                background: 'var(--hud-bg-panel)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <ChartPanel
                symbol={c.symbol}
                timeframe={c.timeframe}
                activeIndicators={activeIndicators}
                onSymbolChange={(sym) => handleSymbolChange(c.id, sym)}
                showControls={true}
                comparisonSymbols={comparisonMode ? comparisonSymbols : []}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Indicator Sidebar (right) ────────────────────────────── */}
      <div style={{ width: 195, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <HudPanel title="INDICATORS" style={{ flex: 1, minHeight: 0 }}>
          <div style={{
            flex: 1, overflowY: 'auto', padding: '4px 8px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--hud-text-dim) transparent',
          }}>
            {Object.entries(INDICATOR_GROUPS).map(([groupId, group]) => (
              <div key={groupId} style={{ marginBottom: 4 }}>
                {/* Group header */}
                <div
                  style={groupHeaderStyle}
                  onClick={() => toggleGroup(groupId)}
                >
                  <span style={{
                    display: 'inline-block', width: 8, textAlign: 'center',
                    color: 'var(--hud-text-dim)', fontSize: 8,
                    transform: collapsedGroups[groupId] ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform 150ms',
                  }}>
                    &#9656;
                  </span>
                  {group.label}
                  <span style={{
                    fontSize: 7, color: 'var(--hud-text-dim)', marginLeft: 'auto',
                    fontWeight: 400,
                  }}>
                    {group.items.filter(i => activeIndicators.includes(i.id)).length}/{group.items.length}
                  </span>
                </div>

                {/* Indicator items */}
                {!collapsedGroups[groupId] && (
                  <div style={{ paddingLeft: 6 }}>
                    {group.items.map(ind => {
                      const active = activeIndicators.includes(ind.id);
                      return (
                        <label
                          key={ind.id}
                          style={{
                            ...checkboxRowStyle,
                            color: active ? 'var(--hud-text-bright)' : 'var(--hud-text)',
                          }}
                        >
                          <span style={{
                            width: 10, height: 10,
                            border: '1px solid',
                            borderColor: active ? 'var(--hud-accent)' : 'var(--hud-line-hover)',
                            background: active ? 'rgba(200,205,220,0.12)' : 'none',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 7, color: active ? 'var(--hud-text-bright)' : 'transparent',
                            flexShrink: 0, transition: 'all 100ms',
                          }}
                            onClick={() => toggleIndicator(ind.id)}
                          >
                            {active ? '\u2713' : ''}
                          </span>
                          <span onClick={() => toggleIndicator(ind.id)}>
                            {ind.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bottom: AI Analyse + Period selector */}
          <div style={{
            padding: '6px 8px',
            borderTop: '1px solid var(--hud-line)',
            flexShrink: 0,
          }}>
            {/* Period selector */}
            <div style={{ marginBottom: 6 }}>
              <span style={labelStyle}>ANALYSIS PERIOD</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {['scalp', 'swing', 'position'].map(p => (
                  <button
                    key={p}
                    style={{
                      ...tabBtnStyle(analysisPeriod === p),
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 7,
                      padding: '2px 4px',
                    }}
                    onClick={() => setAnalysisPeriod(p)}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Active indicators summary */}
            {activeIndicators.length > 0 && (
              <div style={{
                marginBottom: 6, padding: '3px 0',
                fontFamily: 'var(--hud-font)', fontSize: 7,
                color: 'var(--hud-text-dim)', letterSpacing: 1,
              }}>
                ACTIVE: {activeIndicators.length} indicators
              </div>
            )}

            {/* AI Analyse button */}
            <button
              style={{
                ...btnStyle,
                background: 'rgba(0,212,255,0.06)',
                borderColor: 'rgba(0,212,255,0.25)',
                color: 'rgba(0,212,255,0.9)',
              }}
              onClick={handleAiAnalyse}
              onMouseEnter={e => { e.target.style.background = 'rgba(0,212,255,0.12)'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(0,212,255,0.06)'; }}
            >
              AI ANALYSE &#9654;
            </button>

            {/* Quick-clear button */}
            {activeIndicators.length > 0 && (
              <button
                style={{
                  ...btnStyle,
                  marginTop: 4,
                  background: 'none',
                  borderColor: 'var(--hud-line)',
                  color: 'var(--hud-text-dim)',
                  fontSize: 7,
                  padding: '4px 8px',
                  letterSpacing: 2,
                }}
                onClick={() => setActiveIndicators([])}
              >
                CLEAR ALL
              </button>
            )}
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
