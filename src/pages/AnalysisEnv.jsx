/**
 * AnalysisEnv — Deep research workspace with TradingView-style charts,
 * AI analysis, and multi-timeframe signal comparison.
 * 
 * AI Chat Priority: ChatGPT → Claude → Gemini (existing subscriptions)
 * Local AI: Ollama (runs locally, free — see local_ai_ml_setup.md)
 */

import React, { useState, useRef, useEffect } from 'react';
import { createChart } from 'lightweight-charts';
import useStore from '../store/useStore';

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];
const INSTRUMENTS = {
  stocks: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'TSLA', 'META', 'AMZN', 'SPY', 'QQQ'],
  crypto: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD'],
  forex:  ['EUR=X', 'GBP=X', 'JPY=X', 'AUD=X'],
};
const INDICATORS = ['SMA', 'EMA', 'RSI', 'MACD', 'Bollinger Bands', 'VWAP', 'ATR', 'Stochastic', 'OBV'];
const AI_PROVIDERS = [
  { id: 'chatgpt', label: 'ChatGPT',     url: 'https://chat.openai.com', emoji: '🤖', badge: 'Your subscription' },
  { id: 'claude',  label: 'Claude',      url: 'https://claude.ai',       emoji: '🔮', badge: 'Your subscription' },
  { id: 'gemini',  label: 'Gemini',      url: 'https://gemini.google.com', emoji: '✨', badge: 'Your subscription' },
  { id: 'ollama',  label: 'Ollama',      url: null,                      emoji: '🦙', badge: 'Local (free)' },
];

// ── Lightweight Chart ─────────────────────────────────────────────
function LightweightChart({ symbol, timeframe }) {
  const chartRef = useRef(null);
  const chartObj = useRef(null);
  const seriesObj = useRef(null);
  const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';

  useEffect(() => {
    if (!chartRef.current) return;
    chartObj.current = createChart(chartRef.current, {
      layout: { background: { color: '#0d1117' }, textColor: '#94a3b8' },
      grid:   { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      crosshair: { mode: 1 },
      timeScale: { borderColor: '#1e293b', timeVisible: true },
      rightPriceScale: { borderColor: '#1e293b' },
    });

    seriesObj.current = chartObj.current.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    });

    const ro = new ResizeObserver(() => {
      if (chartRef.current && chartObj.current) {
        chartObj.current.applyOptions({ width: chartRef.current.clientWidth, height: chartRef.current.clientHeight });
      }
    });
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chartObj.current?.remove(); };
  }, []);

  useEffect(() => {
    if (!seriesObj.current) return;
    fetch(`${BACKEND}/chart-data?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}&bars=200`)
      .then(r => r.json())
      .then(data => {
        if (!data.bars) return;
        const bars = data.bars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }));
        seriesObj.current.setData(bars);
        chartObj.current.timeScale().fitContent();
      })
      .catch(() => {
        // Stub data for dev
        const now = Math.floor(Date.now() / 1000);
        const stub = Array.from({ length: 100 }, (_, i) => {
          const base = 150 + Math.sin(i * 0.2) * 20 + i * 0.5;
          return { time: now - (100 - i) * 86400, open: base, high: base + 3, low: base - 3, close: base + Math.random() * 4 - 2 };
        });
        seriesObj.current.setData(stub);
        chartObj.current.timeScale().fitContent();
      });
  }, [symbol, timeframe]);

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}

// ── AI Analysis Panel ─────────────────────────────────────────────
function AiPanel({ symbol, timeframe, indicators }) {
  const [activeProvider, setActiveProvider] = useState('chatgpt');
  const [ollamaResponse, setOllamaResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { quotes } = useStore();
  const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';

  const q = quotes[symbol] || {};
  const contextPayload = `[QUANT TERMINAL — ANALYSIS CONTEXT]
Symbol: ${symbol}
Timeframe: ${timeframe}
Price: ${q.price ? `$${q.price}` : 'N/A'}
Change: ${q.change_pct?.toFixed(2) || 'N/A'}%
Active Indicators: ${indicators.join(', ')}
Date: ${new Date().toLocaleDateString('en-AU')}

Analyse this stock/asset from a quantitative trading perspective:
1. Technical setup based on the indicators above
2. Key support/resistance levels to watch
3. Risk/reward if entering now
4. Any macro factors to consider
`.trim();

  const runOllama = async () => {
    setIsLoading(true);
    setOllamaResponse('');
    try {
      const res = await fetch(`${BACKEND}/ai/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, timeframe, indicators }),
      });
      const data = await res.json();
      setOllamaResponse(data.response || 'No response from local model.');
    } catch {
      setOllamaResponse('⚠️ Ollama not running. Start it with: ollama serve\nSee local_ai_ml_setup.md for setup instructions.');
    }
    setIsLoading(false);
  };

  const copyContext = () => navigator.clipboard.writeText(contextPayload);

  const provider = AI_PROVIDERS.find(p => p.id === activeProvider);

  return (
    <div className="analysis-ai-panel">
      <div style={{ marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        AI Analysis — {symbol}
      </div>

      {/* Provider tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {AI_PROVIDERS.map(p => (
          <button key={p.id} onClick={() => setActiveProvider(p.id)}
            style={{
              padding: '4px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
              background: activeProvider === p.id ? 'var(--blue)22' : 'var(--bg-tertiary)',
              color: activeProvider === p.id ? 'var(--blue)' : 'var(--text-dim)',
              border: `1px solid ${activeProvider === p.id ? 'var(--blue)44' : 'var(--border)'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            }}>
            <span style={{ fontSize: 14 }}>{p.emoji}</span>
            <span>{p.label}</span>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>{p.badge}</span>
          </button>
        ))}
      </div>

      {/* Context payload */}
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, padding: 8, marginBottom: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
        {contextPayload}
      </div>

      {activeProvider === 'ollama' ? (
        <div>
          <button className="btn btn--primary btn--sm" style={{ width: '100%', marginBottom: 8 }} onClick={runOllama} disabled={isLoading}>
            {isLoading ? '⏳ Analysing with Ollama...' : '🦙 Run Local AI Analysis'}
          </button>
          {ollamaResponse && (
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, padding: 10, fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
              {ollamaResponse}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-dim)' }}>
            Uses Ollama locally (free, private). See <code>local_ai_ml_setup.md</code> for setup.
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button className="btn btn--sm btn--primary" style={{ flex: 1 }} onClick={copyContext}>
              📋 Copy Context
            </button>
            {provider?.url && (
              <button className="btn btn--sm" style={{ flex: 1 }} onClick={() => window.open(provider.url, '_blank')}>
                ↗ Open {provider.label}
              </button>
            )}
          </div>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 12, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{provider?.emoji}</div>
            <strong>{provider?.label}</strong> — uses your existing subscription<br />
            <span style={{ fontSize: 10 }}>Copy the context above → paste into {provider?.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main AnalysisEnv ──────────────────────────────────────────────
export default function AnalysisEnv() {
  const { analysisState, setAnalysisState, setAppMode } = useStore();

  const [symbol, setSymbol]     = useState(analysisState.symbol || 'AAPL');
  const [timeframe, setTimeframe] = useState(analysisState.timeframe || '1D');
  const [marketCat, setMarketCat] = useState('stocks');
  const [indicators, setIndicators] = useState(analysisState.indicators || ['SMA', 'RSI']);
  const [customSym, setCustomSym] = useState('');

  const toggleIndicator = (ind) => setIndicators(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]);
  const handleSearchSym = (e) => { if (e.key === 'Enter' && customSym.trim()) { setSymbol(customSym.trim().toUpperCase()); setCustomSym(''); } };

  return (
    <div className="analysis-layout">
      {/* Left: Controls */}
      <div className="analysis-left">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Instrument</div>

        {/* Market type */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {Object.keys(INSTRUMENTS).map(m => (
            <button key={m} className={`btn btn--sm ${marketCat === m ? 'btn--primary' : ''}`} onClick={() => setMarketCat(m)} style={{ flex: 1, textTransform: 'capitalize', fontSize: 10 }}>
              {m}
            </button>
          ))}
        </div>

        {/* Custom search */}
        <input
          value={customSym} onChange={e => setCustomSym(e.target.value)} onKeyDown={handleSearchSym}
          placeholder="Type symbol + Enter..."
          style={{ width: '100%', padding: '5px 8px', marginBottom: 8, boxSizing: 'border-box', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11 }}
        />

        {/* Instrument list */}
        {(INSTRUMENTS[marketCat] || []).map(s => (
          <button key={s} onClick={() => { setSymbol(s); setAnalysisState({ symbol: s }); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px',
              background: symbol === s ? 'var(--blue-bg)' : 'transparent',
              color: symbol === s ? 'var(--blue)' : 'var(--text-secondary)',
              border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12,
              fontFamily: 'var(--font-mono)',
            }}>
            {s}
          </button>
        ))}

        <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Indicators</div>
        {INDICATORS.map(ind => (
          <label key={ind} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, cursor: 'pointer', fontSize: 11 }}>
            <input type="checkbox" checked={indicators.includes(ind)} onChange={() => toggleIndicator(ind)} />
            {ind}
          </label>
        ))}
      </div>

      {/* Center: Chart */}
      <div className="analysis-center">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>{symbol}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {TIMEFRAMES.map(tf => (
              <button key={tf} className={`btn btn--sm ${timeframe === tf ? 'btn--primary' : ''}`} onClick={() => { setTimeframe(tf); setAnalysisState({ timeframe: tf }); }}>
                {tf}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button className="btn btn--sm" onClick={() => setAppMode('backtest')}>⏱ Backtest This →</button>
            <button className="btn btn--sm" onClick={() => setAppMode('algo-builder')}>⌨ Build Algo →</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <LightweightChart symbol={symbol} timeframe={timeframe} />
        </div>
      </div>

      {/* Right: AI Analysis */}
      <div className="analysis-right" style={{ overflowY: 'auto' }}>
        <AiPanel symbol={symbol} timeframe={timeframe} indicators={indicators} />
      </div>
    </div>
  );
}
