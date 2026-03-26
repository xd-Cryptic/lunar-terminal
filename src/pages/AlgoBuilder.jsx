/**
 * AlgoBuilder — Full Monaco Editor IDE for writing and deploying algos.
 * - Monaco Editor (VS Code engine) for in-app editing
 * - "Open in VS Code" button for Claude Code integration
 * - File watcher: auto hot-reload on save
 * - "Deploy to Terminal" → calls /algos/reload
 * - "Run in Backtest" → navigates to BacktestEnv with algo pre-selected
 */

import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import useStore from '../store/useStore';

const STARTER_ALGO = `"""
RSI-MACD Composite Strategy
Auto-generated starter template.

Available signals: BUY, SELL, HOLD
"""

import pandas as pd
import numpy as np


def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def run_strategy(df: pd.DataFrame, params: dict) -> list:
    """
    Entry point — must return a list of signal dicts.
    
    df: OHLCV DataFrame with columns [open, high, low, close, volume]
    params: dict from the config panel (RSI period, thresholds, etc.)
    
    Returns: [{ "timestamp": ..., "symbol": ..., "type": "BUY"|"SELL"|"HOLD",
                "price": ..., "reasons": [...] }]
    """
    rsi_period = params.get("rsi_period", 14)
    rsi_buy    = params.get("rsi_buy", 30)
    rsi_sell   = params.get("rsi_sell", 70)
    
    df = df.copy()
    df["rsi"]         = calculate_rsi(df["close"], rsi_period)
    df["macd"]        = df["close"].ewm(span=12).mean() - df["close"].ewm(span=26).mean()
    df["macd_signal"] = df["macd"].ewm(span=9).mean()
    
    signals = []
    for i in range(1, len(df)):
        row = df.iloc[i]
        prev = df.iloc[i - 1]
        
        reasons = []
        sig_type = "HOLD"
        
        # RSI oversold + MACD crossover = BUY
        if row["rsi"] < rsi_buy and row["macd"] > row["macd_signal"] and prev["macd"] <= prev["macd_signal"]:
            sig_type = "BUY"
            reasons = [f"RSI oversold ({row['rsi']:.1f})", "MACD bullish cross"]
        
        # RSI overbought + MACD death cross = SELL
        elif row["rsi"] > rsi_sell and row["macd"] < row["macd_signal"] and prev["macd"] >= prev["macd_signal"]:
            sig_type = "SELL"
            reasons = [f"RSI overbought ({row['rsi']:.1f})", "MACD bearish cross"]
        
        if sig_type != "HOLD":
            signals.append({
                "timestamp": str(row.name),
                "symbol":    params.get("symbol", "AAPL"),
                "type":      sig_type,
                "price":     float(row["close"]),
                "reasons":   reasons
            })
    
    return signals


# Default parameters (shown in config panel, editable without code changes)
DEFAULT_PARAMS = {
    "symbol":      "AAPL",
    "rsi_period":  14,
    "rsi_buy":     30,
    "rsi_sell":    70,
    "markets":     ["stocks", "crypto", "forex"],
    "allocation":  30
}
`;

const DEFAULT_PARAMS_TEMPLATE = `{
  "symbol": "AAPL",
  "rsi_period": 14,
  "rsi_buy": 30,
  "rsi_sell": 70,
  "markets": ["stocks", "crypto", "forex"],
  "allocation": 30
}`;

export default function AlgoBuilder() {
  const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';
  const { algoBuilderState, setAlgoBuilderState, setAppMode, setBacktestState, accounts } = useStore();

  const [code, setCode]               = useState(algoBuilderState.algoCode || STARTER_ALGO);
  const [selectedAlgo, setSelectedAlgo] = useState(algoBuilderState.selectedAlgo || 'rsi_macd.py');
  const [algoList, setAlgoList]       = useState(algoBuilderState.algoList || []);
  const [paramsJson, setParamsJson]   = useState(DEFAULT_PARAMS_TEMPLATE);
  const [activePanel, setActivePanel] = useState('params'); // 'params' | 'test'
  const [testResults, setTestResults] = useState(null);
  const [isTesting, setIsTesting]     = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState(null); // 'deployed' | null
  const [activeMarkets, setActiveMarkets] = useState(['stocks', 'crypto', 'forex']);
  const editorRef = useRef(null);

  useEffect(() => {
    fetch(`${BACKEND}/algos`)
      .then(r => r.json())
      .then(d => setAlgoList(d.algos || []))
      .catch(() => setAlgoList([
        { name: 'rsi_macd.py', enabled: true,  markets: ['stocks', 'crypto', 'forex'] },
        { name: 'sma_cross.py', enabled: true, markets: ['stocks'] },
      ]));
  }, []);

  const handleNewAlgo = () => {
    const name = prompt('Algo filename (e.g. my_strategy.py):');
    if (!name || !name.endsWith('.py')) return;
    setSelectedAlgo(name);
    setCode(STARTER_ALGO);
    setAlgoList(l => [...l, { name, enabled: false, markets: [] }]);
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeployStatus(null);
    try {
      await fetch(`${BACKEND}/algos/reload`, { method: 'POST' });
      setDeployStatus('deployed');
      setTimeout(() => setDeployStatus(null), 3000);
    } catch { setDeployStatus('error'); }
    setIsDeploying(false);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setActivePanel('test');
    try {
      let params = {};
      try { params = JSON.parse(paramsJson); } catch { params = { symbol: 'AAPL' }; }
      const res = await fetch(`${BACKEND}/algos/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, params }),
      });
      const data = await res.json();
      setTestResults(data.signals || []);
      setAlgoBuilderState({ testResults: data.signals });
    } catch (e) {
      setTestResults([]);
    }
    setIsTesting(false);
  };

  const handleRunInBacktest = () => {
    let params = {};
    try { params = JSON.parse(paramsJson); } catch { /* ok */ }
    setBacktestState({ strategy: selectedAlgo, symbol: params.symbol || 'AAPL' });
    setAppMode('backtest');
  };

  const handleOpenVSCode = () => {
    if (window.electronAPI?.openInVSCode) {
      window.electronAPI.openInVSCode(selectedAlgo);
    } else {
      alert('VS Code integration available in packaged Electron app.\nFor dev: open the algos/ folder in VS Code manually.');
    }
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  return (
    <div className="algo-builder">
      {/* Left: File browser */}
      <div className="algo-sidebar">
        <div style={{ padding: '12px 12px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Algos</span>
          <button className="btn btn--sm btn--primary" onClick={handleNewAlgo}>+ New</button>
        </div>
        {algoList.map(a => (
          <div key={a.name}
            className={`algo-file-item ${selectedAlgo === a.name ? 'algo-file-item--active' : ''}`}
            onClick={() => { setSelectedAlgo(a.name); setAlgoBuilderState({ selectedAlgo: a.name }); }}
          >
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>📄 {a.name}</span>
            <span style={{ fontSize: 9, color: a.enabled ? 'var(--green)' : 'var(--text-dim)' }}>
              {a.enabled ? '●' : '○'}
            </span>
          </div>
        ))}
        <div style={{ padding: 12, borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>Claude Code integration:</div>
          <button className="btn btn--sm" style={{ width: '100%' }} onClick={handleOpenVSCode}>
            ⌨ Open in VS Code
          </button>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>Uses your existing Claude Code subscription</div>
        </div>
      </div>

      {/* Center: Monaco Editor */}
      <div className="algo-editor">
        {/* Editor top bar */}
        <div className="algo-editor-bar">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{selectedAlgo}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {deployStatus === 'deployed' && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓ Deployed to Terminal</span>}
            <button className="btn btn--sm" onClick={handleTest} disabled={isTesting}>
              {isTesting ? '⏳ Testing...' : '▶ Test Algo'}
            </button>
            <button className="btn btn--sm btn--primary" onClick={handleDeploy} disabled={isDeploying}>
              {isDeploying ? '⏳ Deploying...' : '🚀 Deploy to Terminal'}
            </button>
            <button className="btn btn--sm" onClick={handleRunInBacktest} style={{ background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple)44' }}>
              ⏱ Run in Backtest
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Editor
            height="100%"
            defaultLanguage="python"
            value={code}
            onChange={val => { setCode(val || ''); setAlgoBuilderState({ algoCode: val || '' }); }}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              tabSize: 4,
              insertSpaces: true,
              wordWrap: 'on',
              formatOnPaste: true,
              formatOnType: true,
              autoIndent: 'full',
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 12 },
            }}
          />
        </div>
      </div>

      {/* Right: Config + Test Results */}
      <div className="algo-right-panel">
        <div className="tabs">
          <button className={`tab ${activePanel === 'params' ? 'tab--active' : ''}`} onClick={() => setActivePanel('params')}>Config</button>
          <button className={`tab ${activePanel === 'test' ? 'tab--active' : ''}`} onClick={() => setActivePanel('test')}>Test Results</button>
        </div>

        {activePanel === 'params' && (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>Edit algo parameters (JSON — no code changes needed):</div>
            <textarea
              value={paramsJson}
              onChange={e => setParamsJson(e.target.value)}
              style={{
                width: '100%', minHeight: 180, padding: 10,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text-primary)', fontSize: 11,
                fontFamily: 'var(--font-mono)', resize: 'vertical', boxSizing: 'border-box',
              }}
            />

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deploy to Markets</div>
              {['stocks', 'crypto', 'forex', 'revolut'].map(m => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 12 }}>
                  <input type="checkbox" checked={activeMarkets.includes(m)}
                    onChange={e => setActiveMarkets(prev => e.target.checked ? [...prev, m] : prev.filter(x => x !== m))}
                  />
                  <span style={{ textTransform: 'capitalize' }}>{m}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {activePanel === 'test' && (
          <div style={{ padding: 12 }}>
            {isTesting && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>⏳ Running on last 100 candles...</div>}
            {!isTesting && !testResults && (
              <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>Click "▶ Test Algo" to see signals on recent data.</div>
            )}
            {testResults && (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {testResults.length} signals on last 100 candles
                </div>
                {testResults.slice(-20).map((s, i) => (
                  <div key={i} style={{
                    padding: '6px 8px', marginBottom: 4, borderRadius: 4,
                    background: s.type === 'BUY' ? 'var(--green-bg)' : 'var(--red-bg)',
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                  }}>
                    <span className={s.type === 'BUY' ? 'positive' : 'negative'}>{s.type}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>${s.price?.toFixed(2)}</span>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 6, fontSize: 10 }}>{s.reasons?.join(' · ')}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
