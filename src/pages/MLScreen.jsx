/**
 * MLScreen — ML + Algo combined screen.
 * Machine learning model training UI alongside algorithmic trading tools.
 * Monochrome tactical HUD aesthetic.
 */

import { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import * as api from '../utils/api';
import HudPanel from '../components/layout/HudPanel';

// ── Default algo code template ──────────────────────────────────────
const DEFAULT_ALGO_CODE = `"""
Custom Strategy Template
Available signals: BUY, SELL, HOLD
"""

import pandas as pd
import numpy as np


def run_strategy(df, params):
    """
    df: OHLCV DataFrame [open, high, low, close, volume]
    params: dict from config panel
    Returns: list of signal dicts
    """
    signals = []
    sma_fast = df["close"].rolling(params.get("fast", 10)).mean()
    sma_slow = df["close"].rolling(params.get("slow", 30)).mean()

    for i in range(1, len(df)):
        if sma_fast.iloc[i] > sma_slow.iloc[i] and sma_fast.iloc[i-1] <= sma_slow.iloc[i-1]:
            signals.append({
                "timestamp": str(df.index[i]),
                "symbol": params.get("symbol", "AAPL"),
                "type": "BUY",
                "price": float(df["close"].iloc[i]),
                "reasons": ["SMA crossover bullish"]
            })
        elif sma_fast.iloc[i] < sma_slow.iloc[i] and sma_fast.iloc[i-1] >= sma_slow.iloc[i-1]:
            signals.append({
                "timestamp": str(df.index[i]),
                "symbol": params.get("symbol", "AAPL"),
                "type": "SELL",
                "price": float(df["close"].iloc[i]),
                "reasons": ["SMA crossover bearish"]
            })
    return signals

DEFAULT_PARAMS = {
    "symbol": "AAPL",
    "fast": 10,
    "slow": 30,
}
`;

// ── Feature list for ML ─────────────────────────────────────────────
const ALL_FEATURES = [
  { id: 'rsi',    label: 'RSI (14)' },
  { id: 'macd',   label: 'MACD' },
  { id: 'sma',    label: 'SMA (20/50)' },
  { id: 'volume', label: 'Volume' },
  { id: 'atr',    label: 'ATR (14)' },
  { id: 'bb_pos', label: 'Bollinger Band Position' },
];

// ── Placeholder feature importance data ─────────────────────────────
const PLACEHOLDER_IMPORTANCE = [
  { feature: 'RSI',    importance: 0.23 },
  { feature: 'MACD',   importance: 0.19 },
  { feature: 'SMA',    importance: 0.18 },
  { feature: 'Volume', importance: 0.16 },
  { feature: 'ATR',    importance: 0.13 },
  { feature: 'BB_pos', importance: 0.11 },
];

// ── Placeholder feature matrix preview ──────────────────────────────
const PLACEHOLDER_MATRIX = [
  { date: '2024-12-16', rsi: 58.2, macd: 1.34, sma_20: 234.5, volume: 48200000, atr: 3.21 },
  { date: '2024-12-17', rsi: 62.1, macd: 1.56, sma_20: 235.1, volume: 51300000, atr: 3.18 },
  { date: '2024-12-18', rsi: 55.8, macd: 0.98, sma_20: 235.4, volume: 44100000, atr: 3.25 },
  { date: '2024-12-19', rsi: 48.3, macd: -0.12, sma_20: 234.9, volume: 52800000, atr: 3.42 },
  { date: '2024-12-20', rsi: 44.7, macd: -0.89, sma_20: 234.2, volume: 61500000, atr: 3.55 },
];

// ── Inline styles (HUD-consistent) ─────────────────────────────────
const s = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '220px 1fr 240px',
    gridTemplateRows: '1fr 1fr',
    gap: 2,
    padding: 2,
    height: '100%',
    minHeight: 0,
    background: 'radial-gradient(ellipse at 50% 45%, rgba(15,15,30,0.3) 0%, transparent 70%), var(--hud-bg)',
  },
  label: {
    fontFamily: 'var(--hud-font)',
    fontSize: 7,
    fontWeight: 700,
    color: 'var(--hud-text-dim)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '4px 8px',
    background: 'rgba(8,8,20,0.95)',
    border: '1px solid var(--hud-line-hover)',
    color: 'var(--hud-text)',
    fontFamily: 'var(--hud-font)',
    fontSize: 10,
    outline: 'none',
    letterSpacing: 0.5,
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '4px 8px',
    background: 'rgba(8,8,20,0.95)',
    border: '1px solid var(--hud-line-hover)',
    color: 'var(--hud-text-mid)',
    fontFamily: 'var(--hud-font)',
    fontSize: 9,
    cursor: 'pointer',
    letterSpacing: 0.5,
  },
  hudBtn: {
    padding: '5px 12px',
    fontFamily: 'var(--hud-font)',
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 2,
    textTransform: 'uppercase',
    cursor: 'pointer',
    border: '1px solid var(--hud-line-hover)',
    background: 'rgba(8,8,20,0.8)',
    color: 'var(--hud-text)',
    transition: 'all 120ms',
    width: '100%',
  },
  hudBtnPrimary: {
    padding: '5px 12px',
    fontFamily: 'var(--hud-font)',
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 2,
    textTransform: 'uppercase',
    cursor: 'pointer',
    border: '1px solid rgba(0,204,136,0.25)',
    background: 'rgba(0,204,136,0.06)',
    color: 'var(--hud-green)',
    transition: 'all 120ms',
    width: '100%',
  },
  scrollBody: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    padding: '8px 10px',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    cursor: 'pointer',
    fontFamily: 'var(--hud-font)',
    fontSize: 9,
    color: 'var(--hud-text-mid)',
  },
};

// =====================================================================
// MLScreen Component
// =====================================================================
export default function MLScreen() {
  // ── Store ──
  const { algoBuilderState, setAlgoBuilderState, activeSymbol } = useStore();

  // ── Algo List State ──
  const [algoList, setAlgoList] = useState(algoBuilderState.algoList || []);
  const [selectedAlgo, setSelectedAlgo] = useState(algoBuilderState.selectedAlgo || null);
  const [algoCode, setAlgoCode] = useState(algoBuilderState.algoCode || DEFAULT_ALGO_CODE);

  // ── Test/Run State ──
  const [testSymbol, setTestSymbol] = useState(activeSymbol || 'AAPL');
  const [testResults, setTestResults] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // ── ML Model Config State ──
  const [modelType, setModelType] = useState('random_forest');
  const [lookback, setLookback] = useState(60);
  const [trainSplit, setTrainSplit] = useState(80);
  const [selectedFeatures, setSelectedFeatures] = useState(['rsi', 'macd', 'sma', 'volume']);
  const [mlStatus, setMlStatus] = useState('Ready');
  const [mlMetrics, setMlMetrics] = useState(null);

  // ── Algo Backtest State ──
  const [btSymbol, setBtSymbol] = useState(activeSymbol || 'AAPL');
  const [btCapital, setBtCapital] = useState(10000);
  const [btDateFrom, setBtDateFrom] = useState('2023-01-01');
  const [btDateTo, setBtDateTo] = useState('2024-12-31');
  const [btResults, setBtResults] = useState(null);
  const [isBtRunning, setIsBtRunning] = useState(false);

  // ── Feature Engineering State ──
  const [feFeatures, setFeFeatures] = useState(['rsi', 'macd', 'sma']);

  // ── Fetch algo list on mount ──
  useEffect(() => {
    api.listAlgos()
      .then((d) => {
        const list = d.algos || [];
        setAlgoList(list);
        setAlgoBuilderState({ algoList: list });
      })
      .catch(() => {
        setAlgoList([
          { name: 'my_sma_algo.py', enabled: true },
          { name: 'rsi_reversal.py', enabled: true },
        ]);
      });
  }, []);

  // ── Handlers ──
  const handleSelectAlgo = (name) => {
    setSelectedAlgo(name);
    setAlgoBuilderState({ selectedAlgo: name });
  };

  const handleNewAlgo = () => {
    const name = prompt('Algo filename (e.g. my_strategy.py):');
    if (!name || !name.endsWith('.py')) return;
    setSelectedAlgo(name);
    setAlgoCode(DEFAULT_ALGO_CODE);
    setAlgoList((prev) => [...prev, { name, enabled: false }]);
    setAlgoBuilderState({ selectedAlgo: name, algoCode: DEFAULT_ALGO_CODE });
  };

  const handleOpenVSCode = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('open-in-vscode', selectedAlgo || '');
    } else if (window.electronAPI?.openInVSCode) {
      window.electronAPI.openInVSCode(selectedAlgo || '');
    } else {
      alert('VS Code integration available in Electron app.');
    }
  };

  const handleReload = () => {
    api.reloadAlgos()
      .then(() => api.listAlgos())
      .then((d) => {
        const list = d.algos || [];
        setAlgoList(list);
        setAlgoBuilderState({ algoList: list });
      })
      .catch(() => {});
  };

  const handleTestAlgo = async () => {
    setIsTesting(true);
    setTestResults(null);
    try {
      const data = await api.testAlgo(algoCode, { symbol: testSymbol });
      setTestResults(data.signals || []);
      setAlgoBuilderState({ testResults: data.signals });
    } catch {
      setTestResults([]);
    }
    setIsTesting(false);
  };

  const handleTrainModel = async () => {
    setMlStatus('Training...');
    setMlMetrics(null);
    // Placeholder: simulate training since endpoint does not exist yet
    try {
      // Future: await api.trainMLModel({ model_type: modelType, lookback, train_split: trainSplit, features: selectedFeatures, symbol: testSymbol });
      await new Promise((r) => setTimeout(r, 2000));
      setMlMetrics({
        accuracy: (0.72 + Math.random() * 0.15).toFixed(3),
        precision: (0.68 + Math.random() * 0.18).toFixed(3),
        recall: (0.65 + Math.random() * 0.2).toFixed(3),
      });
      setMlStatus('Complete');
    } catch {
      setMlStatus('Error');
    }
  };

  const handleAlgoBacktest = async () => {
    setIsBtRunning(true);
    setBtResults(null);
    try {
      const data = await api.runBacktest({
        strategy: selectedAlgo || 'custom',
        symbol: btSymbol,
        date_from: btDateFrom,
        date_to: btDateTo,
        capital: btCapital,
        code: algoCode,
      });
      setBtResults(data);
    } catch {
      setBtResults(null);
    }
    setIsBtRunning(false);
  };

  const toggleFeature = (id, list, setter) => {
    setter((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]);
  };

  // =====================================================================
  // Render
  // =====================================================================
  return (
    <div style={s.grid}>
      {/* ────────────────────────────────────────────────────────────── */}
      {/* TOP-LEFT: Algo List */}
      {/* ────────────────────────────────────────────────────────────── */}
      <HudPanel title="Algo List" style={{ gridColumn: 1, gridRow: 1 }}>
        <div style={s.scrollBody}>
          {algoList.map((a) => (
            <div
              key={a.name}
              onClick={() => handleSelectAlgo(a.name)}
              style={{
                padding: '5px 8px',
                borderLeft: selectedAlgo === a.name ? '1px solid var(--hud-text-mid)' : '1px solid transparent',
                background: selectedAlgo === a.name ? 'rgba(180,185,200,0.05)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 80ms',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 1,
              }}
            >
              <span style={{ fontFamily: 'var(--hud-font)', fontSize: 10, color: 'var(--hud-text)' }}>
                {a.name}
              </span>
              <span style={{ fontSize: 8, color: a.enabled ? 'var(--hud-green)' : 'var(--hud-text-dim)' }}>
                {a.enabled ? '\u25CF' : '\u25CB'}
              </span>
            </div>
          ))}

          {algoList.length === 0 && (
            <div style={{ fontFamily: 'var(--hud-font)', fontSize: 8, color: 'var(--hud-text-dim)', padding: '8px 0' }}>
              No algos loaded.
            </div>
          )}

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button style={s.hudBtn} onClick={handleNewAlgo}>+ NEW ALGO</button>
            <button style={s.hudBtn} onClick={handleOpenVSCode}>OPEN IN VSCODE</button>
            <button style={s.hudBtn} onClick={handleReload}>RELOAD</button>
          </div>
        </div>
      </HudPanel>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* TOP-CENTER: Code Editor */}
      {/* ────────────────────────────────────────────────────────────── */}
      <HudPanel
        title={selectedAlgo || 'Code Editor'}
        style={{ gridColumn: 2, gridRow: 1 }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <textarea
            value={algoCode}
            onChange={(e) => {
              setAlgoCode(e.target.value);
              setAlgoBuilderState({ algoCode: e.target.value });
            }}
            spellCheck={false}
            style={{
              flex: 1,
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(5,5,16,0.9)',
              border: 'none',
              borderTop: '1px solid var(--hud-line)',
              color: 'var(--hud-text)',
              fontFamily: 'var(--hud-font)',
              fontSize: 11,
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              letterSpacing: 0.3,
              tabSize: 4,
            }}
          />
        </div>
      </HudPanel>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* TOP-RIGHT: Test / Run */}
      {/* ────────────────────────────────────────────────────────────── */}
      <HudPanel title="Test / Run" style={{ gridColumn: 3, gridRow: 1 }}>
        <div style={s.scrollBody}>
          <label style={s.label}>Symbol</label>
          <input
            style={{ ...s.input, marginBottom: 8 }}
            value={testSymbol}
            onChange={(e) => setTestSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
          />

          <button
            style={s.hudBtnPrimary}
            onClick={handleTestAlgo}
            disabled={isTesting}
          >
            {isTesting ? 'TESTING...' : 'TEST ALGO'}
          </button>

          {/* Results */}
          <div style={{ marginTop: 12 }}>
            {isTesting && (
              <div style={{ fontFamily: 'var(--hud-font)', fontSize: 8, color: 'var(--hud-text-dim)', letterSpacing: 1 }}>
                RUNNING ON RECENT CANDLES...
              </div>
            )}

            {testResults && !isTesting && (
              <>
                <div style={{ fontFamily: 'var(--hud-font)', fontSize: 8, color: 'var(--hud-text-mid)', letterSpacing: 1, marginBottom: 6 }}>
                  {testResults.length} SIGNALS GENERATED
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {testResults.slice(-20).map((sig, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '4px 6px',
                        background: sig.type === 'BUY' ? 'rgba(0,204,136,0.06)' : 'rgba(204,51,85,0.06)',
                        border: `1px solid ${sig.type === 'BUY' ? 'rgba(0,204,136,0.15)' : 'rgba(204,51,85,0.15)'}`,
                        fontFamily: 'var(--hud-font)',
                        fontSize: 9,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ color: sig.type === 'BUY' ? 'var(--hud-green)' : 'var(--hud-red)', fontWeight: 800, letterSpacing: 1, fontSize: 8 }}>
                        {sig.type}
                      </span>
                      <span style={{ color: 'var(--hud-text-mid)' }}>
                        ${sig.price?.toFixed(2)}
                      </span>
                      <span style={{ color: 'var(--hud-text-dim)', fontSize: 7 }}>
                        {sig.reasons?.join(' \u00B7 ')}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {testResults && testResults.length === 0 && !isTesting && (
              <div style={{ fontFamily: 'var(--hud-font)', fontSize: 8, color: 'var(--hud-text-dim)', letterSpacing: 1 }}>
                NO SIGNALS GENERATED
              </div>
            )}
          </div>
        </div>
      </HudPanel>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* BOTTOM-LEFT: ML Model Config */}
      {/* ────────────────────────────────────────────────────────────── */}
      <HudPanel title="ML Model Config" style={{ gridColumn: 1, gridRow: 2 }}>
        <div style={s.scrollBody}>
          <label style={s.label}>Model Type</label>
          <select
            style={{ ...s.select, marginBottom: 8 }}
            value={modelType}
            onChange={(e) => setModelType(e.target.value)}
          >
            <option value="random_forest">Random Forest</option>
            <option value="gradient_boost">Gradient Boost</option>
            <option value="lstm">LSTM (placeholder)</option>
            <option value="xgboost">XGBoost (placeholder)</option>
          </select>

          <label style={s.label}>Lookback Period</label>
          <input
            type="number"
            style={{ ...s.input, marginBottom: 8 }}
            value={lookback}
            onChange={(e) => setLookback(Number(e.target.value))}
            min={10}
            max={500}
          />

          <label style={s.label}>Train / Test Split (%)</label>
          <input
            type="number"
            style={{ ...s.input, marginBottom: 8 }}
            value={trainSplit}
            onChange={(e) => setTrainSplit(Number(e.target.value))}
            min={50}
            max={95}
          />

          <label style={s.label}>Features</label>
          <div style={{ marginBottom: 10 }}>
            {ALL_FEATURES.map((f) => (
              <label key={f.id} style={s.checkbox}>
                <input
                  type="checkbox"
                  checked={selectedFeatures.includes(f.id)}
                  onChange={() => toggleFeature(f.id, selectedFeatures, setSelectedFeatures)}
                />
                {f.label}
              </label>
            ))}
          </div>

          <button style={s.hudBtnPrimary} onClick={handleTrainModel} disabled={mlStatus === 'Training...'}>
            {mlStatus === 'Training...' ? 'TRAINING...' : 'TRAIN MODEL'}
          </button>

          {/* Status */}
          <div style={{
            marginTop: 8,
            fontFamily: 'var(--hud-font)',
            fontSize: 8,
            letterSpacing: 1,
            color: mlStatus === 'Complete' ? 'var(--hud-green)' : mlStatus === 'Error' ? 'var(--hud-red)' : 'var(--hud-text-dim)',
          }}>
            STATUS: {mlStatus.toUpperCase()}
          </div>

          {/* Model Metrics */}
          {mlMetrics && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: 'ACCURACY', value: mlMetrics.accuracy },
                { label: 'PRECISION', value: mlMetrics.precision },
                { label: 'RECALL', value: mlMetrics.recall },
              ].map((m) => (
                <div key={m.label} className="hud-readout" style={{ padding: '3px 6px', minWidth: 'auto' }}>
                  <span className="hud-readout__label" style={{ fontSize: 6 }}>{m.label}</span>
                  <span className="hud-readout__value" style={{ fontSize: 11 }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </HudPanel>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* BOTTOM-CENTER: Algo Backtest */}
      {/* ────────────────────────────────────────────────────────────── */}
      <HudPanel title="Algo Backtest" style={{ gridColumn: 2, gridRow: 2 }}>
        <div style={s.scrollBody}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <label style={s.label}>Symbol</label>
              <input style={s.input} value={btSymbol} onChange={(e) => setBtSymbol(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label style={s.label}>Capital ($)</label>
              <input style={s.input} type="number" value={btCapital} onChange={(e) => setBtCapital(Number(e.target.value))} />
            </div>
            <div>
              <label style={s.label}>From</label>
              <input style={s.input} type="date" value={btDateFrom} onChange={(e) => setBtDateFrom(e.target.value)} />
            </div>
            <div>
              <label style={s.label}>To</label>
              <input style={s.input} type="date" value={btDateTo} onChange={(e) => setBtDateTo(e.target.value)} />
            </div>
          </div>

          <button
            style={s.hudBtnPrimary}
            onClick={handleAlgoBacktest}
            disabled={isBtRunning}
          >
            {isBtRunning ? 'RUNNING...' : 'BACKTEST ALGO'}
          </button>

          {/* Backtest Metrics */}
          {btResults && btResults.metrics && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {[
                { label: 'RETURN', value: `${btResults.metrics.total_return >= 0 ? '+' : ''}${btResults.metrics.total_return?.toFixed(2)}%`, cls: btResults.metrics.total_return >= 0 ? 'var(--hud-green)' : 'var(--hud-red)' },
                { label: 'SHARPE', value: btResults.metrics.sharpe_ratio?.toFixed(2) || '--', cls: 'var(--hud-text)' },
                { label: 'MAX DD', value: `${btResults.metrics.max_drawdown?.toFixed(2)}%`, cls: 'var(--hud-red)' },
                { label: 'WIN RATE', value: `${btResults.metrics.win_rate?.toFixed(1)}%`, cls: btResults.metrics.win_rate >= 50 ? 'var(--hud-green)' : 'var(--hud-red)' },
                { label: 'TRADES', value: btResults.metrics.total_trades || '--', cls: 'var(--hud-text)' },
                { label: 'P.FACTOR', value: btResults.metrics.profit_factor?.toFixed(2) || '--', cls: 'var(--hud-text)' },
              ].map((m) => (
                <div key={m.label} className="hud-readout" style={{ padding: '3px 6px', minWidth: 'auto' }}>
                  <span className="hud-readout__label" style={{ fontSize: 6 }}>{m.label}</span>
                  <span className="hud-readout__value" style={{ fontSize: 11, color: m.cls }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {isBtRunning && (
            <div style={{ marginTop: 10, fontFamily: 'var(--hud-font)', fontSize: 8, color: 'var(--hud-text-dim)', letterSpacing: 1 }}>
              BACKTESTING {btSymbol}...
            </div>
          )}

          {!btResults && !isBtRunning && (
            <div style={{ marginTop: 10, fontFamily: 'var(--hud-font)', fontSize: 8, color: 'var(--hud-text-dim)', letterSpacing: 1 }}>
              CONFIGURE PARAMS AND RUN BACKTEST
            </div>
          )}
        </div>
      </HudPanel>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* BOTTOM-RIGHT: Feature Engineering */}
      {/* ────────────────────────────────────────────────────────────── */}
      <HudPanel title="Feature Engineering" style={{ gridColumn: 3, gridRow: 2 }}>
        <div style={s.scrollBody}>
          <label style={s.label}>Select Features</label>
          <div style={{ marginBottom: 8 }}>
            {ALL_FEATURES.map((f) => (
              <label key={f.id} style={s.checkbox}>
                <input
                  type="checkbox"
                  checked={feFeatures.includes(f.id)}
                  onChange={() => toggleFeature(f.id, feFeatures, setFeFeatures)}
                />
                {f.label}
              </label>
            ))}
          </div>

          {/* Feature Importance Bars */}
          <label style={s.label}>Feature Importance</label>
          <div style={{ marginBottom: 10 }}>
            {PLACEHOLDER_IMPORTANCE.map((f) => (
              <div key={f.feature} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontFamily: 'var(--hud-font)', fontSize: 7, color: 'var(--hud-text-dim)', width: 40, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {f.feature}
                </span>
                <div style={{ flex: 1, height: 3, background: 'var(--hud-text-dim)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${f.importance * 100}%`,
                    height: '100%',
                    background: 'var(--hud-text-mid)',
                    transition: 'width 300ms',
                  }} />
                </div>
                <span style={{ fontFamily: 'var(--hud-font)', fontSize: 7, color: 'var(--hud-text-mid)', width: 28, textAlign: 'right' }}>
                  {(f.importance * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>

          {/* Data Preview Mini Table */}
          <label style={s.label}>Data Preview (Last 5 Rows)</label>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--hud-font)', fontSize: 7 }}>
              <thead>
                <tr>
                  {['Date', 'RSI', 'MACD', 'SMA20', 'Vol', 'ATR'].map((h) => (
                    <th key={h} style={{
                      padding: '2px 4px',
                      borderBottom: '1px solid var(--hud-line)',
                      color: 'var(--hud-text-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      fontWeight: 700,
                      textAlign: 'left',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLACEHOLDER_MATRIX.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '2px 4px', color: 'var(--hud-text-dim)' }}>{row.date.slice(5)}</td>
                    <td style={{ padding: '2px 4px', color: 'var(--hud-text-mid)' }}>{row.rsi.toFixed(1)}</td>
                    <td style={{ padding: '2px 4px', color: row.macd >= 0 ? 'var(--hud-green)' : 'var(--hud-red)' }}>{row.macd.toFixed(2)}</td>
                    <td style={{ padding: '2px 4px', color: 'var(--hud-text-mid)' }}>{row.sma_20.toFixed(1)}</td>
                    <td style={{ padding: '2px 4px', color: 'var(--hud-text-mid)' }}>{(row.volume / 1e6).toFixed(1)}M</td>
                    <td style={{ padding: '2px 4px', color: 'var(--hud-text-mid)' }}>{row.atr.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </HudPanel>
    </div>
  );
}
