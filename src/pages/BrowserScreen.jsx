/**
 * BrowserScreen — AI Browser with embedded ChatGPT, Claude, and Gemini.
 * Data capture panel builds context-rich prompts from live terminal data.
 * Monochrome tactical HUD aesthetic.
 */

import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import * as api from '../utils/api';
import HudPanel from '../components/layout/HudPanel';

// ── Browser tab definitions ─────────────────────────────────────────
const BROWSER_TABS = [
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chat.openai.com' },
  { id: 'claude',  label: 'Claude',  url: 'https://claude.ai' },
  { id: 'gemini',  label: 'Gemini',  url: 'https://gemini.google.com' },
];

// ── Default prompt template ─────────────────────────────────────────
const DEFAULT_TEMPLATE = `You are a financial analyst. Analyze the following market data:

{watchlist_data}

{indicators_data}

{news_data}

Based on this data, provide:
1. Overall market sentiment
2. Key opportunities
3. Risk factors
4. Recommended actions`;

// ── Data capture sources ────────────────────────────────────────────
const CAPTURE_SOURCES = [
  { id: 'watchlist',   label: 'Watchlist quotes' },
  { id: 'indicators',  label: 'Technical indicators' },
  { id: 'news',        label: 'News headlines' },
  { id: 'backtest',    label: 'Backtest results' },
  { id: 'risk',        label: 'Risk status' },
];

// ── Inline styles (HUD-consistent) ─────────────────────────────────
const s = {
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
    gap: 2,
    padding: 2,
    height: '100%',
    minHeight: 0,
    background: 'radial-gradient(ellipse at 50% 45%, rgba(15,15,30,0.3) 0%, transparent 70%), var(--hud-bg)',
  },
  browserContainer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    background: 'var(--hud-bg-panel)',
    border: '1px solid var(--hud-line)',
    position: 'relative',
  },
  tabBar: {
    display: 'flex',
    gap: 0,
    background: 'rgba(5,5,16,0.9)',
    borderBottom: '1px solid var(--hud-line)',
    flexShrink: 0,
    padding: '4px 8px',
  },
  tab: (active) => ({
    padding: '5px 14px',
    fontFamily: 'var(--hud-font)',
    fontSize: 9,
    fontWeight: active ? 700 : 500,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    cursor: 'pointer',
    border: 'none',
    borderBottom: active ? '1px solid var(--hud-text)' : '1px solid transparent',
    background: 'none',
    color: active ? 'var(--hud-text-bright)' : 'var(--hud-text-dim)',
    transition: 'all 80ms',
  }),
  frame: {
    flex: 1,
    border: 'none',
    width: '100%',
    height: '100%',
    background: 'var(--hud-bg)',
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
  textarea: {
    width: '100%',
    padding: '8px 10px',
    background: 'rgba(5,5,16,0.9)',
    border: '1px solid var(--hud-line-hover)',
    color: 'var(--hud-text)',
    fontFamily: 'var(--hud-font)',
    fontSize: 9,
    lineHeight: 1.6,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    letterSpacing: 0.3,
  },
  readonlyTextarea: {
    width: '100%',
    padding: '8px 10px',
    background: 'rgba(8,8,20,0.6)',
    border: '1px solid var(--hud-line)',
    color: 'var(--hud-text-mid)',
    fontFamily: 'var(--hud-font)',
    fontSize: 8,
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    letterSpacing: 0.3,
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
  loginNote: {
    fontFamily: 'var(--hud-font)',
    fontSize: 8,
    color: 'var(--hud-text-dim)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    padding: '4px 10px',
    borderBottom: '1px solid var(--hud-line)',
    flexShrink: 0,
    background: 'rgba(180,185,200,0.02)',
  },
};

// =====================================================================
// Data formatting functions
// =====================================================================

function formatWatchlistData(quotes, watchlist) {
  if (!quotes || Object.keys(quotes).length === 0) {
    return 'No watchlist data available.';
  }
  const lines = ['Symbol    | Price     | Change   | Change %'];
  lines.push('----------|-----------|----------|----------');
  watchlist.forEach((item) => {
    const q = quotes[item.symbol];
    if (q) {
      const price = q.price?.toFixed(2) || q.regularMarketPrice?.toFixed(2) || '--';
      const change = q.change?.toFixed(2) || q.regularMarketChange?.toFixed(2) || '--';
      const changePct = q.changePct?.toFixed(2) || q.regularMarketChangePercent?.toFixed(2) || '--';
      lines.push(
        `${item.symbol.padEnd(10)}| $${String(price).padEnd(8)}| ${String(change).padEnd(9)}| ${changePct}%`
      );
    }
  });
  return lines.join('\n');
}

function formatIndicatorsData(indicators) {
  if (!indicators || Object.keys(indicators).length === 0) {
    return 'No indicator data available.';
  }
  const lines = [];
  Object.entries(indicators).forEach(([key, val]) => {
    if (typeof val === 'object' && val !== null) {
      // Nested indicator (e.g., MACD with signal/histogram)
      const subVals = Object.entries(val)
        .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`)
        .join(', ');
      lines.push(`${key.toUpperCase()}: ${subVals}`);
    } else {
      lines.push(`${key.toUpperCase()}: ${typeof val === 'number' ? val.toFixed(4) : val}`);
    }
  });
  return lines.join('\n');
}

function formatNewsData(articles) {
  if (!articles || articles.length === 0) {
    return 'No recent news available.';
  }
  return articles.slice(0, 10).map((a, i) => {
    const sentiment = a.sentiment || a.overall_sentiment || 'N/A';
    const source = a.source || a.source_name || 'Unknown';
    return `${i + 1}. [${source}] ${a.title || a.headline || 'Untitled'} (Sentiment: ${sentiment})`;
  }).join('\n');
}

function formatBacktestData(backtestState) {
  if (!backtestState?.results?.metrics) {
    return 'No backtest results available.';
  }
  const m = backtestState.results.metrics;
  return [
    `Strategy: ${backtestState.strategy || 'N/A'}`,
    `Symbol: ${backtestState.symbol || 'N/A'}`,
    `Total Return: ${m.total_return?.toFixed(2) || '--'}%`,
    `Sharpe Ratio: ${m.sharpe_ratio?.toFixed(2) || '--'}`,
    `Max Drawdown: ${m.max_drawdown?.toFixed(2) || '--'}%`,
    `Win Rate: ${m.win_rate?.toFixed(1) || '--'}%`,
    `Total Trades: ${m.total_trades || '--'}`,
  ].join('\n');
}

function formatRiskData(safetyData) {
  if (!safetyData) {
    return 'No risk status data available.';
  }
  const lines = [];
  if (typeof safetyData === 'object') {
    Object.entries(safetyData).forEach(([key, val]) => {
      if (typeof val === 'object' && val !== null) {
        lines.push(`${key}: ${val.status || val.value || JSON.stringify(val)}`);
      } else {
        lines.push(`${key}: ${val}`);
      }
    });
  }
  return lines.length > 0 ? lines.join('\n') : 'Risk status: OK';
}

// =====================================================================
// BrowserScreen Component
// =====================================================================
export default function BrowserScreen() {
  // ── Store ──
  const { quotes, watchlist, articles, activeSymbol, backtestState } = useStore();

  // ── Browser State ──
  const [activeTab, setActiveTab] = useState('chatgpt');
  const isElectron = typeof window !== 'undefined' && !!window.electron;

  // ── Data Capture State ──
  const [captureFlags, setCaptureFlags] = useState({
    watchlist: true,
    indicators: true,
    news: true,
    backtest: false,
    risk: false,
  });
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_TEMPLATE);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  // ── Cached indicator/risk data ──
  const [indicatorData, setIndicatorData] = useState(null);
  const [riskData, setRiskData] = useState(null);

  // ── Toggle capture flag ──
  const toggleCapture = (id) => {
    setCaptureFlags((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Generate prompt ──
  const handleGeneratePrompt = async () => {
    setIsGenerating(true);
    let prompt = promptTemplate;

    // Fetch indicators if needed
    let indicators = indicatorData;
    if (captureFlags.indicators && !indicators) {
      try {
        indicators = await api.getIndicators(activeSymbol);
        setIndicatorData(indicators);
      } catch {
        indicators = null;
      }
    }

    // Fetch risk data if needed
    let risk = riskData;
    if (captureFlags.risk && !risk) {
      try {
        risk = await api.getSafetyStatus();
        setRiskData(risk);
      } catch {
        risk = null;
      }
    }

    // Build data sections
    const watchlistSection = captureFlags.watchlist
      ? `=== WATCHLIST DATA ===\n${formatWatchlistData(quotes, watchlist)}`
      : '';
    const indicatorsSection = captureFlags.indicators
      ? `=== TECHNICAL INDICATORS (${activeSymbol}) ===\n${formatIndicatorsData(indicators)}`
      : '';
    const newsSection = captureFlags.news
      ? `=== NEWS HEADLINES ===\n${formatNewsData(articles)}`
      : '';
    const backtestSection = captureFlags.backtest
      ? `=== BACKTEST RESULTS ===\n${formatBacktestData(backtestState)}`
      : '';
    const riskSection = captureFlags.risk
      ? `=== RISK STATUS ===\n${formatRiskData(risk)}`
      : '';

    // Replace template placeholders
    prompt = prompt
      .replace('{watchlist_data}', watchlistSection)
      .replace('{indicators_data}', indicatorsSection)
      .replace('{news_data}', newsSection);

    // Append extra sections not in default template
    const extras = [backtestSection, riskSection].filter(Boolean);
    if (extras.length > 0) {
      prompt += '\n\n' + extras.join('\n\n');
    }

    setGeneratedPrompt(prompt.trim());
    setIsGenerating(false);
  };

  // ── Copy to clipboard ──
  const handleCopyToClipboard = async () => {
    if (!generatedPrompt) return;
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopyStatus('COPIED');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = generatedPrompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopyStatus('COPIED');
      setTimeout(() => setCopyStatus(''), 2000);
    }
  };

  // ── Get active tab info ──
  const activeTabInfo = BROWSER_TABS.find((t) => t.id === activeTab);

  // =====================================================================
  // Render
  // =====================================================================
  return (
    <div style={s.layout}>
      {/* ────────────────────────────────────────────────────────────── */}
      {/* LEFT: Browser Panel */}
      {/* ────────────────────────────────────────────────────────────── */}
      <div style={s.browserContainer} className="browser-panel">
        {/* Tab bar */}
        <div style={s.tabBar} className="browser-tabs">
          {BROWSER_TABS.map((tab) => (
            <button
              key={tab.id}
              style={s.tab(activeTab === tab.id)}
              className={`browser-tab ${activeTab === tab.id ? 'browser-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Login note */}
        <div style={s.loginNote}>
          Login to your AI account in the browser panel
        </div>

        {/* Webview / iframe */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {isElectron ? (
            // Electron: use webview tag
            <webview
              src={activeTabInfo?.url}
              style={s.frame}
              className="browser-frame"
              allowpopups="true"
            />
          ) : (
            // Web mode: use iframe with fallback message
            <>
              <iframe
                src={activeTabInfo?.url}
                style={s.frame}
                className="browser-frame"
                title={activeTabInfo?.label}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
              />
              {/* Overlay note for iframe restrictions */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '6px 10px',
                background: 'rgba(5,5,16,0.95)',
                borderTop: '1px solid var(--hud-line)',
                fontFamily: 'var(--hud-font)',
                fontSize: 7,
                color: 'var(--hud-text-dim)',
                letterSpacing: 1,
                textTransform: 'uppercase',
                textAlign: 'center',
              }}>
                Some AI sites may block iframe embedding. Use the Electron app for full webview support.
              </div>
            </>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* RIGHT: Data Capture Panel */}
      {/* ────────────────────────────────────────────────────────────── */}
      <HudPanel title="Data Capture">
        <div style={s.scrollBody}>
          {/* Capture source checkboxes */}
          <label style={s.label}>Capture From</label>
          <div style={{ marginBottom: 12 }}>
            {CAPTURE_SOURCES.map((src) => (
              <label key={src.id} style={s.checkbox}>
                <input
                  type="checkbox"
                  checked={captureFlags[src.id]}
                  onChange={() => toggleCapture(src.id)}
                />
                {src.label}
              </label>
            ))}
          </div>

          {/* Prompt template */}
          <label style={s.label}>Prompt Template</label>
          <textarea
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            style={{ ...s.textarea, minHeight: 140, marginBottom: 8 }}
            spellCheck={false}
          />

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            <button
              style={s.hudBtnPrimary}
              onClick={handleGeneratePrompt}
              disabled={isGenerating}
            >
              {isGenerating ? 'GENERATING...' : 'GENERATE PROMPT'}
            </button>
            <button
              style={s.hudBtn}
              onClick={handleCopyToClipboard}
              disabled={!generatedPrompt}
            >
              {copyStatus ? copyStatus : 'COPY TO CLIPBOARD'}
            </button>
          </div>

          {/* Generated prompt output */}
          <label style={s.label}>Generated Prompt</label>
          <textarea
            value={generatedPrompt}
            readOnly
            style={{ ...s.readonlyTextarea, minHeight: 180 }}
            placeholder="Click GENERATE PROMPT to build context from selected data sources..."
          />

          {/* Data source status indicators */}
          <div style={{ marginTop: 10 }}>
            <label style={s.label}>Data Status</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[
                { label: 'WATCHLIST', ok: quotes && Object.keys(quotes).length > 0 },
                { label: 'NEWS', ok: articles && articles.length > 0 },
                { label: 'INDICATORS', ok: !!indicatorData },
                { label: 'BACKTEST', ok: !!backtestState?.results },
                { label: 'RISK', ok: !!riskData },
              ].map((item) => (
                <div key={item.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--hud-font)',
                  fontSize: 7,
                  color: 'var(--hud-text-dim)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}>
                  <span style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: item.ok ? 'var(--hud-green)' : 'var(--hud-text-dim)',
                    flexShrink: 0,
                  }} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </HudPanel>
    </div>
  );
}
