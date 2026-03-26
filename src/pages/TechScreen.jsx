/**
 * TechScreen -- Detailed Technical Analysis screen with multi-indicator dashboard.
 * Top: symbol selector, timeframe tabs, indicator toggles.
 * Center: main chart area (placeholder for Lightweight Charts).
 * Bottom row: indicator dashboard, pattern recognition, correlation matrix.
 */

import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import * as api from '../utils/api';
import HudPanel from '../components/layout/HudPanel';

// ── Constants ──────────────────────────────────────────────────────
const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];
const INDICATORS = [
  'SMA', 'EMA', 'RSI', 'MACD', 'BBANDS', 'VWAP', 'ATR', 'ICHIMOKU', 'STOCH', 'ADX', 'OBV',
];
const CORRELATION_HEADERS = ['SPY', 'QQQ', 'BTC', 'GOLD', 'DXY'];
const CANDLESTICK_PATTERNS = [
  { name: 'Doji',              desc: 'Indecision - open equals close' },
  { name: 'Hammer',            desc: 'Bullish reversal at support' },
  { name: 'Engulfing Bull',    desc: 'Strong bullish reversal' },
  { name: 'Engulfing Bear',    desc: 'Strong bearish reversal' },
  { name: 'Morning Star',      desc: 'Three-candle bullish reversal' },
  { name: 'Evening Star',      desc: 'Three-candle bearish reversal' },
  { name: 'Shooting Star',     desc: 'Bearish reversal at resistance' },
  { name: 'Three White Soldiers', desc: 'Strong bullish continuation' },
  { name: 'Three Black Crows', desc: 'Strong bearish continuation' },
  { name: 'Spinning Top',      desc: 'Indecision with small body' },
];

// Static placeholder correlation data
const PLACEHOLDER_CORRELATIONS = {
  SPY:  [1.00,  0.92,  0.35,  0.12, -0.18],
  QQQ:  [0.92,  1.00,  0.42,  0.08, -0.22],
  BTC:  [0.35,  0.42,  1.00, -0.10, -0.38],
  GOLD: [0.12,  0.08, -0.10,  1.00, -0.55],
  DXY:  [-0.18, -0.22, -0.38, -0.55,  1.00],
};

// ── Helpers ────────────────────────────────────────────────────────
function rsiLabel(value) {
  if (value >= 70) return { text: 'OVERBOUGHT', color: 'var(--hud-red)' };
  if (value <= 30) return { text: 'OVERSOLD',   color: 'var(--hud-green)' };
  return { text: 'NEUTRAL', color: 'var(--hud-text-mid)' };
}

function adxLabel(value) {
  if (value >= 50) return 'VERY STRONG';
  if (value >= 25) return 'STRONG';
  if (value >= 20) return 'MODERATE';
  return 'WEAK';
}

function correlationColor(value) {
  if (value >= 0.5)  return 'var(--hud-green)';
  if (value >= 0.2)  return 'rgba(0, 204, 136, 0.5)';
  if (value > -0.2)  return 'var(--hud-text-dim)';
  if (value > -0.5)  return 'rgba(204, 51, 85, 0.5)';
  return 'var(--hud-red)';
}

// ── Readout Box ────────────────────────────────────────────────────
function ReadoutBox({ label, value, sub, color, bars }) {
  return (
    <div className="hud-readout">
      <span className="hud-readout__label">{label}</span>
      <span className="hud-readout__value" style={color ? { color } : undefined}>
        {value}
      </span>
      {sub && (
        <span style={{
          fontFamily: 'var(--hud-font)',
          fontSize: 7,
          color: color || 'var(--hud-text-dim)',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          {sub}
        </span>
      )}
      {bars != null && (
        <div className="hud-readout__bars">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`hud-readout__bar ${i < Math.round(bars / 20) ? 'hud-readout__bar--fill' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Indicator Dashboard Panel ──────────────────────────────────────
function IndicatorDashboard({ symbol, activeIndicators }) {
  const [indicators, setIndicators] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      try {
        const data = await api.getIndicators(symbol, 'sma,ema,rsi,macd,bbands,vwap,atr,adx');
        if (!cancelled) setIndicators(data);
      } catch {
        if (!cancelled) setIndicators(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="tech-screen__placeholder">LOADING INDICATORS...</div>
    );
  }

  if (!indicators) {
    return (
      <div className="tech-screen__placeholder">NO INDICATOR DATA</div>
    );
  }

  // Extract values (API may return nested objects or flat values)
  const rsi = indicators.rsi?.value ?? indicators.rsi ?? null;
  const macdVal = indicators.macd?.macd ?? indicators.macd?.value ?? null;
  const macdSignal = indicators.macd?.signal ?? null;
  const macdHist = indicators.macd?.histogram ?? indicators.macd?.hist ?? null;
  const bbUpper = indicators.bbands?.upper ?? indicators.bbands?.upperBand ?? null;
  const bbLower = indicators.bbands?.lower ?? indicators.bbands?.lowerBand ?? null;
  const bbMiddle = indicators.bbands?.middle ?? indicators.bbands?.middleBand ?? null;
  const adx = indicators.adx?.value ?? indicators.adx ?? null;
  const atr = indicators.atr?.value ?? indicators.atr ?? null;
  const sma = indicators.sma?.value ?? indicators.sma ?? null;
  const ema = indicators.ema?.value ?? indicators.ema ?? null;
  const vwap = indicators.vwap?.value ?? indicators.vwap ?? null;

  // BB position percentage
  let bbPosition = null;
  if (bbUpper != null && bbLower != null && bbMiddle != null && bbUpper !== bbLower) {
    bbPosition = ((bbMiddle - bbLower) / (bbUpper - bbLower) * 100).toFixed(0);
  }

  const rsiInfo = rsi != null ? rsiLabel(rsi) : { text: '--', color: 'var(--hud-text-dim)' };
  const macdDirection = macdHist != null ? (macdHist > 0 ? 'EXPANDING' : 'CONTRACTING') : '--';

  return (
    <div className="tech-screen__indicator-grid">
      {rsi != null && (
        <ReadoutBox
          label="RSI"
          value={typeof rsi === 'number' ? rsi.toFixed(1) : rsi}
          sub={rsiInfo.text}
          color={rsiInfo.color}
          bars={typeof rsi === 'number' ? rsi : 50}
        />
      )}
      {macdVal != null && (
        <ReadoutBox
          label="MACD"
          value={typeof macdVal === 'number' ? macdVal.toFixed(3) : macdVal}
          sub={`SIG ${macdSignal != null ? (typeof macdSignal === 'number' ? macdSignal.toFixed(3) : macdSignal) : '--'} ${macdDirection}`}
          color={macdHist > 0 ? 'var(--hud-green)' : 'var(--hud-red)'}
        />
      )}
      {bbUpper != null && (
        <ReadoutBox
          label="BBANDS"
          value={bbPosition != null ? `${bbPosition}%` : '--'}
          sub={`U:${typeof bbUpper === 'number' ? bbUpper.toFixed(1) : bbUpper} L:${typeof bbLower === 'number' ? bbLower.toFixed(1) : bbLower}`}
          bars={bbPosition != null ? Number(bbPosition) : 50}
        />
      )}
      {adx != null && (
        <ReadoutBox
          label="ADX"
          value={typeof adx === 'number' ? adx.toFixed(1) : adx}
          sub={adxLabel(typeof adx === 'number' ? adx : 0)}
          color={adx >= 25 ? 'var(--hud-green)' : 'var(--hud-text-mid)'}
        />
      )}
      {atr != null && (
        <ReadoutBox
          label="ATR"
          value={typeof atr === 'number' ? atr.toFixed(3) : atr}
          sub="VOLATILITY"
        />
      )}
      {sma != null && (
        <ReadoutBox
          label="SMA"
          value={typeof sma === 'number' ? sma.toFixed(2) : sma}
        />
      )}
      {ema != null && (
        <ReadoutBox
          label="EMA"
          value={typeof ema === 'number' ? ema.toFixed(2) : ema}
        />
      )}
      {vwap != null && (
        <ReadoutBox
          label="VWAP"
          value={typeof vwap === 'number' ? vwap.toFixed(2) : vwap}
          sub="VOL WEIGHTED"
        />
      )}
    </div>
  );
}

// ── Pattern Recognition Panel ──────────────────────────────────────
function PatternRecognition() {
  return (
    <div className="tech-screen__patterns">
      <div className="tech-screen__pattern-notice">
        Pattern recognition requires ML model -- see ML Screen
      </div>
      {CANDLESTICK_PATTERNS.map((p) => (
        <div className="tech-screen__pattern-item" key={p.name}>
          <span className="tech-screen__pattern-name">{p.name}</span>
          <span className="tech-screen__pattern-desc">{p.desc}</span>
        </div>
      ))}
    </div>
  );
}

// ── Correlation Matrix Panel ───────────────────────────────────────
function CorrelationMatrix() {
  return (
    <div className="tech-screen__correlation">
      {/* Header row */}
      <div className="tech-screen__corr-row tech-screen__corr-header">
        <span className="tech-screen__corr-cell tech-screen__corr-label" />
        {CORRELATION_HEADERS.map((h) => (
          <span className="tech-screen__corr-cell tech-screen__corr-header-cell" key={h}>{h}</span>
        ))}
      </div>
      {/* Data rows */}
      {CORRELATION_HEADERS.map((row, ri) => (
        <div className="tech-screen__corr-row" key={row}>
          <span className="tech-screen__corr-cell tech-screen__corr-label">{row}</span>
          {PLACEHOLDER_CORRELATIONS[row].map((val, ci) => (
            <span
              className="tech-screen__corr-cell"
              key={ci}
              style={{
                color: correlationColor(val),
                fontWeight: ri === ci ? 800 : 600,
                opacity: ri === ci ? 0.5 : 1,
              }}
            >
              {val.toFixed(2)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function TechScreen() {
  const { activeSymbol } = useStore();

  const [symbol, setSymbol] = useState(activeSymbol || 'AAPL');
  const [symbolInput, setSymbolInput] = useState(activeSymbol || 'AAPL');
  const [timeframe, setTimeframe] = useState('1D');
  const [activeIndicators, setActiveIndicators] = useState(['SMA', 'EMA', 'RSI', 'MACD', 'BBANDS']);
  const chartRef = useRef(null);

  const toggleIndicator = (ind) => {
    setActiveIndicators((prev) =>
      prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]
    );
  };

  const handleSymbolSubmit = () => {
    const s = symbolInput.trim().toUpperCase();
    if (s) setSymbol(s);
  };

  return (
    <div className="tech-screen">
      {/* ── Top Control Bar ── */}
      <div className="tech-screen__controls">
        <HudPanel title="TECHNICAL ANALYSIS">
          <div className="tech-screen__control-bar">
            {/* Symbol input */}
            <div className="tech-screen__symbol-input">
              <input
                className="hud-input"
                type="text"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSymbolSubmit()}
                placeholder="SYMBOL"
                style={{ width: 90 }}
              />
              <button className="tech-screen__go-btn" onClick={handleSymbolSubmit}>
                GO
              </button>
            </div>

            {/* Timeframe tabs */}
            <div className="tech-screen__timeframes">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  className={`interval-tab ${timeframe === tf ? 'interval-tab--active' : ''}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Indicator toggles */}
            <div className="tech-screen__indicators">
              {INDICATORS.map((ind) => (
                <button
                  key={ind}
                  className={`ind-badge ${activeIndicators.includes(ind) ? 'ind-badge--active' : ''}`}
                  onClick={() => toggleIndicator(ind)}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>
        </HudPanel>
      </div>

      {/* ── Main Chart Area ── */}
      <div className="tech-screen__chart">
        <HudPanel title={`${symbol} -- ${timeframe}`} scanning>
          <div className="tech-screen__chart-area" ref={chartRef}>
            <div className="tech-screen__chart-placeholder">
              <div className="tech-screen__chart-placeholder-icon">
                {/* Crosshair reticle */}
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="24" cy="24" r="18" stroke="rgba(180,185,200,0.15)" strokeWidth="1" />
                  <circle cx="24" cy="24" r="8" stroke="rgba(180,185,200,0.1)" strokeWidth="1" />
                  <line x1="24" y1="2" x2="24" y2="14" stroke="rgba(180,185,200,0.12)" strokeWidth="1" />
                  <line x1="24" y1="34" x2="24" y2="46" stroke="rgba(180,185,200,0.12)" strokeWidth="1" />
                  <line x1="2" y1="24" x2="14" y2="24" stroke="rgba(180,185,200,0.12)" strokeWidth="1" />
                  <line x1="34" y1="24" x2="46" y2="24" stroke="rgba(180,185,200,0.12)" strokeWidth="1" />
                </svg>
              </div>
              <span>CHART AREA -- Lightweight Charts renders here</span>
              <span className="tech-screen__chart-sub">
                {symbol} | {timeframe} | {activeIndicators.join(', ')}
              </span>
            </div>
          </div>
        </HudPanel>
      </div>

      {/* ── Bottom Row ── */}
      <div className="tech-screen__bottom">
        {/* Indicator Dashboard */}
        <div className="tech-screen__bottom-left">
          <HudPanel title="INDICATOR DASHBOARD">
            <div className="hud-panel-body" style={{ padding: 8 }}>
              <IndicatorDashboard symbol={symbol} activeIndicators={activeIndicators} />
            </div>
          </HudPanel>
        </div>

        {/* Pattern Recognition */}
        <div className="tech-screen__bottom-center">
          <HudPanel title="PATTERN RECOGNITION">
            <div className="hud-panel-body" style={{ padding: 8 }}>
              <PatternRecognition />
            </div>
          </HudPanel>
        </div>

        {/* Correlation Matrix */}
        <div className="tech-screen__bottom-right">
          <HudPanel title="CORRELATION MATRIX">
            <div className="hud-panel-body" style={{ padding: 8 }}>
              <CorrelationMatrix />
            </div>
          </HudPanel>
        </div>
      </div>

      {/* ── Inline styles scoped to this screen ── */}
      <style>{`
        .tech-screen {
          display: grid;
          grid-template-rows: auto 1fr 220px;
          gap: 2px;
          height: 100%;
          min-height: 0;
          background: var(--hud-bg);
          padding: 2px;
        }

        .tech-screen__controls {
          flex-shrink: 0;
        }

        .tech-screen__control-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 10px;
          flex-wrap: wrap;
        }

        .tech-screen__symbol-input {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .tech-screen__go-btn {
          padding: 4px 10px;
          font-family: var(--hud-font);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          border: 1px solid var(--hud-line-active);
          background: rgba(180, 185, 200, 0.04);
          color: var(--hud-text);
          transition: all 80ms;
        }

        .tech-screen__go-btn:hover {
          background: rgba(180, 185, 200, 0.1);
          border-color: var(--hud-text-mid);
        }

        .tech-screen__timeframes {
          display: flex;
          gap: 2px;
        }

        .tech-screen__indicators {
          display: flex;
          gap: 2px;
          flex-wrap: wrap;
          margin-left: auto;
        }

        .tech-screen__chart {
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .tech-screen__chart > .hud-panel {
          flex: 1;
          min-height: 0;
        }

        .tech-screen__chart-area {
          flex: 1;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .tech-screen__chart-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          font-family: var(--hud-font);
          font-size: 10px;
          color: var(--hud-text-dim);
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .tech-screen__chart-placeholder-icon {
          opacity: 0.6;
          margin-bottom: 4px;
        }

        .tech-screen__chart-sub {
          font-size: 8px;
          color: var(--hud-text-dim);
          letter-spacing: 1px;
          opacity: 0.6;
        }

        .tech-screen__bottom {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 2px;
          min-height: 0;
        }

        .tech-screen__bottom-left,
        .tech-screen__bottom-center,
        .tech-screen__bottom-right {
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .tech-screen__bottom-left > .hud-panel,
        .tech-screen__bottom-center > .hud-panel,
        .tech-screen__bottom-right > .hud-panel {
          flex: 1;
          min-height: 0;
        }

        /* Indicator grid */
        .tech-screen__indicator-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 6px;
        }

        /* Pattern recognition */
        .tech-screen__patterns {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .tech-screen__pattern-notice {
          font-family: var(--hud-font);
          font-size: 8px;
          color: var(--hud-amber);
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 4px 0;
          border-bottom: 1px solid var(--hud-line);
          margin-bottom: 4px;
        }

        .tech-screen__pattern-item {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 2px 0;
          opacity: 0.4;
        }

        .tech-screen__pattern-name {
          font-family: var(--hud-font);
          font-size: 9px;
          font-weight: 700;
          color: var(--hud-text-mid);
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .tech-screen__pattern-desc {
          font-family: var(--hud-font);
          font-size: 7px;
          color: var(--hud-text-dim);
          letter-spacing: 0.5px;
        }

        /* Correlation matrix */
        .tech-screen__correlation {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .tech-screen__corr-row {
          display: grid;
          grid-template-columns: 36px repeat(5, 1fr);
          gap: 2px;
        }

        .tech-screen__corr-header {
          border-bottom: 1px solid var(--hud-line);
          padding-bottom: 3px;
          margin-bottom: 2px;
        }

        .tech-screen__corr-cell {
          font-family: var(--hud-font);
          font-size: 9px;
          font-weight: 600;
          text-align: center;
          padding: 2px 0;
          color: var(--hud-text-mid);
        }

        .tech-screen__corr-label {
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--hud-text-dim);
          text-align: left;
        }

        .tech-screen__corr-header-cell {
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 1px;
          color: var(--hud-text-dim);
          text-transform: uppercase;
        }

        .tech-screen__placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          font-family: var(--hud-font);
          font-size: 9px;
          color: var(--hud-text-dim);
          letter-spacing: 2px;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}
