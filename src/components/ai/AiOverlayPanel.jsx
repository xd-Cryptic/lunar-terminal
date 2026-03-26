/**
 * AiOverlayPanel — Slide-out overlay for AI-powered chart analysis.
 * Tactical HUD aesthetic: trade period selection, sector filtering,
 * indicator toggles, AI signal + reasoning display, sector picks.
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from '../../utils/api';

const SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
  'Consumer Staples', 'Communication Services', 'Industrials',
  'Energy', 'Utilities', 'Materials', 'Real Estate',
];

const TRADE_PERIODS = [
  { key: 'scalp', label: 'SCALP' },
  { key: 'day', label: 'DAY' },
  { key: 'swing', label: 'SWING' },
  { key: 'position', label: 'POS' },
];

const INDICATOR_OPTIONS = [
  { id: 'rsi', label: 'RSI' },
  { id: 'macd', label: 'MACD' },
  { id: 'bbands', label: 'BBANDS' },
  { id: 'ichimoku', label: 'ICHIM' },
  { id: 'atr', label: 'ATR' },
  { id: 'obv', label: 'OBV' },
  { id: 'stoch', label: 'STOCH' },
  { id: 'adx', label: 'ADX' },
];

const SIGNAL_COLORS = {
  BUY: 'var(--hud-green)',
  SELL: 'var(--hud-red)',
  HOLD: 'var(--hud-amber)',
};

const SIGNAL_BG = {
  BUY: 'rgba(0,204,136,0.08)',
  SELL: 'rgba(204,51,85,0.08)',
  HOLD: 'rgba(187,136,51,0.08)',
};

const SIGNAL_BORDER = {
  BUY: 'rgba(0,204,136,0.25)',
  SELL: 'rgba(204,51,85,0.25)',
  HOLD: 'rgba(187,136,51,0.25)',
};

export default function AiOverlayPanel({
  symbol,
  visible,
  onClose,
  onToggleIndicator,
  activeIndicators = [],
}) {
  const [tradePeriod, setTradePeriod] = useState('swing');
  const [sector, setSector] = useState('');
  const [includeNews, setIncludeNews] = useState(true);
  const [includeIndicators, setIncludeIndicators] = useState(true);
  const [includeRag, setIncludeRag] = useState(true);
  const [selectedIndicators, setSelectedIndicators] = useState(['rsi', 'macd', 'bbands']);
  const [results, setResults] = useState(null);
  const [sectorPicks, setSectorPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset results when symbol changes
  useEffect(() => {
    setResults(null);
    setSectorPicks([]);
    setError(null);
  }, [symbol]);

  const toggleIndicator = useCallback((id) => {
    setSelectedIndicators((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const runAnalysis = async () => {
    if (!symbol || loading) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setSectorPicks([]);

    try {
      const analysisPromise = api.chartAnalyse(
        symbol,
        tradePeriod,
        includeIndicators ? selectedIndicators : [],
        includeNews,
        sector
      );

      const sectorPromise = sector
        ? api.sectorRecommend(sector, tradePeriod, 5)
        : Promise.resolve(null);

      const [analysisData, sectorData] = await Promise.allSettled([
        analysisPromise,
        sectorPromise,
      ]);

      if (analysisData.status === 'fulfilled') {
        setResults(analysisData.value);
      } else {
        const msg = analysisData.reason?.message || String(analysisData.reason);
        const isConn = /fetch|network|ECONNREFUSED|timeout/i.test(msg);
        setError(
          isConn
            ? 'BACKEND UNREACHABLE -- ensure backend + Ollama are running.'
            : `ANALYSIS FAILED: ${msg}`
        );
      }

      if (sectorData.status === 'fulfilled' && sectorData.value) {
        setSectorPicks(sectorData.value.picks || sectorData.value.recommendations || []);
      }
    } catch (err) {
      setError(err?.message || String(err));
    }

    setLoading(false);
  };

  const signal = results?.signal || results?.action;
  const confidence = results?.confidence ?? results?.confidence_pct;
  const buyZone = results?.buy_zone;
  const sellZone = results?.sell_zone;
  const support = results?.support;
  const resistance = results?.resistance;
  const riskReward = results?.risk_reward;
  const reasoning = results?.reasoning || results?.analysis || results?.summary;
  const suggestedIndicators = results?.suggested_indicators || [];

  return (
    <div
      className="ai-overlay"
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: 400,
        zIndex: 20,
        background: 'rgba(8,8,20,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderLeft: '1px solid var(--hud-line)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--hud-font)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--hud-line)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 8,
            letterSpacing: 3,
            color: 'var(--hud-text-mid)',
            fontWeight: 700,
          }}
        >
          AI CHART ANALYSIS
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid var(--hud-line)',
            color: 'var(--hud-text-mid)',
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 6px',
            fontFamily: 'var(--hud-font)',
            lineHeight: 1,
          }}
        >
          &#10005;
        </button>
      </div>

      {/* Scrollable body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Symbol */}
        <div>
          <div style={labelStyle}>SYMBOL</div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--hud-text-bright)',
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            {symbol || '--'}
          </div>
        </div>

        {/* Trade Period */}
        <div>
          <div style={labelStyle}>TRADE PERIOD</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {TRADE_PERIODS.map((tp) => (
              <button
                key={tp.key}
                className={`filter-pill ${tradePeriod === tp.key ? 'filter-pill--active' : ''}`}
                onClick={() => setTradePeriod(tp.key)}
              >
                {tp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sector */}
        <div>
          <div style={labelStyle}>SECTOR</div>
          <select
            className="hud-select"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">-- None --</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Include toggles */}
        <div>
          <div style={labelStyle}>INCLUDE</div>
          <div style={{ display: 'flex', gap: 10, fontSize: 8, color: 'var(--hud-text)' }}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={includeNews}
                onChange={() => setIncludeNews(!includeNews)}
                style={checkboxStyle}
              />
              NEWS
            </label>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={includeIndicators}
                onChange={() => setIncludeIndicators(!includeIndicators)}
                style={checkboxStyle}
              />
              INDICATORS
            </label>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={includeRag}
                onChange={() => setIncludeRag(!includeRag)}
                style={checkboxStyle}
              />
              RAG
            </label>
          </div>
        </div>

        {/* Indicator selection */}
        {includeIndicators && (
          <div>
            <div style={labelStyle}>INDICATORS FOR ANALYSIS</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {INDICATOR_OPTIONS.map((ind) => (
                <button
                  key={ind.id}
                  className={`filter-pill ${selectedIndicators.includes(ind.id) ? 'filter-pill--active' : ''}`}
                  onClick={() => toggleIndicator(ind.id)}
                >
                  {ind.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Analyse button */}
        <button
          className="trade-btn trade-btn--buy"
          onClick={runAnalysis}
          disabled={loading || !symbol}
          style={{
            padding: '8px 12px',
            fontSize: 8,
            letterSpacing: 3,
            width: '100%',
            opacity: loading || !symbol ? 0.5 : 1,
            cursor: loading || !symbol ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'ANALYSING...' : '\u25B6 ANALYSE'}
        </button>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '8px 10px',
              fontSize: 8,
              color: 'var(--hud-red)',
              background: 'rgba(204,51,85,0.06)',
              border: '1px solid rgba(204,51,85,0.2)',
              letterSpacing: 0.5,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {results && !error && (
          <>
            {/* Section divider */}
            <div style={dividerStyle}>RESULTS</div>

            {/* Signal badge */}
            {signal && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  background: SIGNAL_BG[signal] || 'rgba(180,185,200,0.03)',
                  border: `1px solid ${SIGNAL_BORDER[signal] || 'var(--hud-line)'}`,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 3,
                    color: SIGNAL_COLORS[signal] || 'var(--hud-text)',
                  }}
                >
                  {signal}
                </span>
                {confidence != null && (
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--hud-text-mid)',
                    }}
                  >
                    {confidence}% conf
                  </span>
                )}
              </div>
            )}

            {/* Price zones */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {buyZone && (
                <div>
                  <div style={labelStyle}>BUY ZONE</div>
                  <div style={{ fontSize: 10, color: 'var(--hud-green)' }}>
                    {typeof buyZone === 'string'
                      ? buyZone
                      : `$${buyZone.low || buyZone[0]} - $${buyZone.high || buyZone[1]}`}
                  </div>
                </div>
              )}
              {sellZone && (
                <div>
                  <div style={labelStyle}>SELL ZONE</div>
                  <div style={{ fontSize: 10, color: 'var(--hud-red)' }}>
                    {typeof sellZone === 'string'
                      ? sellZone
                      : `$${sellZone.low || sellZone[0]} - $${sellZone.high || sellZone[1]}`}
                  </div>
                </div>
              )}
            </div>

            {/* Support / Resistance */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {support != null && (
                <div>
                  <div style={labelStyle}>SUPPORT</div>
                  <div style={{ fontSize: 10, color: 'var(--hud-text-bright)' }}>
                    {typeof support === 'number' ? `$${support.toFixed(2)}` : String(support)}
                  </div>
                </div>
              )}
              {resistance != null && (
                <div>
                  <div style={labelStyle}>RESISTANCE</div>
                  <div style={{ fontSize: 10, color: 'var(--hud-text-bright)' }}>
                    {typeof resistance === 'number' ? `$${resistance.toFixed(2)}` : String(resistance)}
                  </div>
                </div>
              )}
            </div>

            {/* Risk/Reward */}
            {riskReward != null && (
              <div>
                <div style={labelStyle}>RISK / REWARD</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--hud-text-bright)',
                    }}
                  >
                    {typeof riskReward === 'number'
                      ? `1:${riskReward.toFixed(1)}`
                      : String(riskReward)}
                  </span>
                  {typeof riskReward === 'number' && (
                    <div
                      style={{
                        flex: 1,
                        height: 4,
                        background: 'var(--hud-line)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(riskReward / 5 * 100, 100)}%`,
                          height: '100%',
                          background:
                            riskReward >= 2
                              ? 'var(--hud-green)'
                              : riskReward >= 1
                              ? 'var(--hud-amber)'
                              : 'var(--hud-red)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reasoning */}
            {reasoning && (
              <div>
                <div style={labelStyle}>REASONING</div>
                <div
                  style={{
                    fontSize: 8,
                    color: 'var(--hud-text)',
                    lineHeight: 1.6,
                    padding: '6px 8px',
                    background: 'rgba(180,185,200,0.02)',
                    border: '1px solid var(--hud-line)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 160,
                    overflowY: 'auto',
                  }}
                >
                  {typeof reasoning === 'string'
                    ? reasoning
                    : JSON.stringify(reasoning, null, 2)}
                </div>
              </div>
            )}

            {/* Suggested indicators */}
            {suggestedIndicators.length > 0 && (
              <div>
                <div style={labelStyle}>SUGGESTED INDICATORS</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {suggestedIndicators.map((ind) => {
                    const id = typeof ind === 'string' ? ind : ind.id || ind.name;
                    const label = typeof ind === 'string' ? ind : ind.label || ind.name || ind.id;
                    const isActive = activeIndicators.includes(id);
                    return (
                      <button
                        key={id}
                        className={`filter-pill ${isActive ? 'filter-pill--active' : ''}`}
                        onClick={() => onToggleIndicator && onToggleIndicator(id)}
                        style={{
                          fontSize: 7,
                          color: isActive ? 'var(--hud-green)' : 'var(--hud-text-mid)',
                          borderColor: isActive
                            ? 'rgba(0,204,136,0.3)'
                            : 'var(--hud-line)',
                        }}
                      >
                        {isActive ? '' : '+ '}{label.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sector picks */}
            {sectorPicks.length > 0 && (
              <>
                <div style={dividerStyle}>SECTOR PICKS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sectorPicks.map((pick, idx) => {
                    const pickSignal = pick.signal || pick.action || 'HOLD';
                    const pickConf = pick.confidence ?? pick.confidence_pct ?? '--';
                    return (
                      <div
                        key={pick.symbol || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 8px',
                          background: 'rgba(180,185,200,0.02)',
                          border: '1px solid var(--hud-line)',
                          fontSize: 9,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 8,
                            color: 'var(--hud-text-dim)',
                            width: 14,
                          }}
                        >
                          {idx + 1}.
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: 'var(--hud-text-bright)',
                            letterSpacing: 1,
                            width: 50,
                          }}
                        >
                          {pick.symbol || '--'}
                        </span>
                        <span
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            letterSpacing: 1,
                            color: SIGNAL_COLORS[pickSignal] || 'var(--hud-text)',
                          }}
                        >
                          {pickSignal}
                        </span>
                        <span
                          style={{
                            fontSize: 8,
                            color: 'var(--hud-text-mid)',
                            marginLeft: 'auto',
                          }}
                        >
                          {pickConf}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* Empty state */}
        {!results && !error && !loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 0',
              color: 'var(--hud-text-dim)',
              fontSize: 8,
              letterSpacing: 1,
              lineHeight: 2,
            }}
          >
            <div>SELECT PARAMETERS AND CLICK ANALYSE</div>
            <div style={{ fontSize: 7, marginTop: 4 }}>
              AI WILL EVALUATE {symbol || '--'} WITH SELECTED INDICATORS
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 0',
              color: 'var(--hud-text-mid)',
              fontSize: 8,
              letterSpacing: 2,
            }}
          >
            <div style={{ animation: 'hud-pulse 1.5s ease infinite' }}>
              PROCESSING ANALYSIS...
            </div>
            <div
              style={{
                fontSize: 7,
                color: 'var(--hud-text-dim)',
                marginTop: 6,
              }}
            >
              {symbol} / {tradePeriod.toUpperCase()} / {selectedIndicators.length} INDICATORS
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared inline styles ── */
const labelStyle = {
  fontSize: 6,
  letterSpacing: 2,
  color: 'var(--hud-text-dim)',
  fontFamily: 'var(--hud-font)',
  marginBottom: 4,
  fontWeight: 600,
};

const dividerStyle = {
  fontSize: 7,
  letterSpacing: 3,
  color: 'var(--hud-text-dim)',
  fontFamily: 'var(--hud-font)',
  padding: '6px 0',
  borderTop: '1px solid var(--hud-line)',
  borderBottom: '1px solid var(--hud-line)',
  textAlign: 'center',
  fontWeight: 600,
};

const checkboxLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
  fontFamily: 'var(--hud-font)',
  letterSpacing: 1,
  fontSize: 7,
};

const checkboxStyle = {
  accentColor: 'var(--hud-green)',
  width: 10,
  height: 10,
  cursor: 'pointer',
};
