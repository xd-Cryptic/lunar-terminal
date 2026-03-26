/**
 * NewsAIScreen -- News + AI Analysis full-screen layout.
 * Left 40%: news feed with sentiment tags, category filters, search.
 * Right 60%: AI analysis panel + sentiment summary.
 * Bottom strip: macro dashboard (SPY, VIX, DXY, US10Y, GOLD, OIL, BTC).
 */

import { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import * as api from '../utils/api';
import HudPanel from '../components/layout/HudPanel';

// ── Constants ──────────────────────────────────────────────────────
const CATEGORIES = ['general', 'technology', 'finance', 'crypto', 'energy', 'healthcare'];
const ANALYSIS_TYPES = [
  { value: 'technical',    label: 'Technical Analysis' },
  { value: 'fundamental',  label: 'Fundamental Analysis' },
  { value: 'sentiment',    label: 'Sentiment Analysis' },
  { value: 'macro',        label: 'Macro Overview' },
  { value: 'risk',         label: 'Risk Assessment' },
];
const MACRO_SYMBOLS = ['SPY', 'VIX', 'DXY', 'US10Y', 'GOLD', 'OIL', 'BTC'];

// ── Helpers ────────────────────────────────────────────────────────
function sentimentColor(label) {
  if (!label) return 'var(--hud-text-dim)';
  const l = label.toLowerCase();
  if (l === 'bullish' || l === 'positive') return 'var(--hud-green)';
  if (l === 'bearish' || l === 'negative') return 'var(--hud-red)';
  return 'var(--hud-text-dim)';
}

function sentimentFromArticle(article) {
  if (article.sentiment) return article.sentiment;
  return { label: 'neutral', score: 0, reasoning: '' };
}

// ── Article Card ───────────────────────────────────────────────────
function NewsCard({ article }) {
  const sentiment = sentimentFromArticle(article);
  const color = sentimentColor(sentiment.label);
  const score = typeof sentiment.score === 'number' ? sentiment.score : 0;

  return (
    <div className="news-card" onClick={() => article.url && window.open(article.url, '_blank')}>
      <div className="news-card__meta">
        <span className="news-card__sentiment" style={{ background: color }} />
        <span>{article.source || 'Unknown'}</span>
        <span>{article.published?.split('T')[0] || ''}</span>
        <span
          className="news-ai-screen__sentiment-tag"
          style={{
            background: `${color}18`,
            color: color,
            border: `1px solid ${color}44`,
          }}
        >
          {(sentiment.label || 'NEUTRAL').toUpperCase()} {(score * 100).toFixed(0)}%
        </span>
      </div>

      <div className="news-card__headline">{article.title}</div>

      {sentiment.reasoning && (
        <div className="news-card__ai-summary">
          <span style={{ color }}>{sentiment.reasoning}</span>
        </div>
      )}

      {/* Confidence bar */}
      <div className="news-ai-screen__confidence">
        <div className="news-ai-screen__confidence-track">
          <div
            className="news-ai-screen__confidence-fill"
            style={{ width: `${score * 100}%`, background: color }}
          />
        </div>
        <span className="news-ai-screen__confidence-label">
          {(score * 100).toFixed(0)}%
        </span>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="news-ai-screen__source-link"
        onClick={(e) => e.stopPropagation()}
      >
        VIEW SOURCE &rarr;
      </a>
    </div>
  );
}

// ── Sentiment Summary ──────────────────────────────────────────────
function SentimentSummary({ articles }) {
  const counts = { bullish: 0, bearish: 0, neutral: 0 };
  let totalScore = 0;

  articles.forEach((a) => {
    const s = sentimentFromArticle(a);
    const l = (s.label || 'neutral').toLowerCase();
    if (l === 'bullish' || l === 'positive') counts.bullish++;
    else if (l === 'bearish' || l === 'negative') counts.bearish++;
    else counts.neutral++;
    totalScore += typeof s.score === 'number' ? s.score : 0;
  });

  const total = articles.length || 1;
  const avgScore = totalScore / total;
  const overall = avgScore > 0.55 ? 'BULLISH' : avgScore < 0.45 ? 'BEARISH' : 'NEUTRAL';
  const overallColor = sentimentColor(overall);

  return (
    <div className="news-ai-screen__summary">
      <div className="news-ai-screen__summary-row">
        <span className="hud-readout__label">OVERALL</span>
        <span style={{ color: overallColor, fontWeight: 700, fontSize: 12, letterSpacing: 2 }}>
          {overall} {(avgScore * 100).toFixed(0)}%
        </span>
      </div>
      <div className="news-ai-screen__summary-counts">
        <div className="news-ai-screen__summary-count">
          <span style={{ color: 'var(--hud-green)' }}>BULLISH</span>
          <span>{counts.bullish}</span>
        </div>
        <div className="news-ai-screen__summary-count">
          <span style={{ color: 'var(--hud-red)' }}>BEARISH</span>
          <span>{counts.bearish}</span>
        </div>
        <div className="news-ai-screen__summary-count">
          <span style={{ color: 'var(--hud-text-dim)' }}>NEUTRAL</span>
          <span>{counts.neutral}</span>
        </div>
      </div>
    </div>
  );
}

// ── Macro Dashboard ────────────────────────────────────────────────
function MacroDashboard({ macroData }) {
  return (
    <div className="macro-strip">
      {MACRO_SYMBOLS.map((sym) => {
        const item = macroData[sym] || macroData[sym.toLowerCase()] || {};
        const price = item.price ?? item.value ?? '--';
        const change = item.change_pct ?? item.changePct ?? null;
        const changeColor = change > 0 ? 'var(--hud-green)' : change < 0 ? 'var(--hud-red)' : 'var(--hud-text-mid)';

        return (
          <div className="macro-item" key={sym}>
            <span className="macro-item__label">{sym}</span>
            <span className="macro-item__value">
              {typeof price === 'number' ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : price}
              {change !== null && (
                <span style={{ color: changeColor, fontSize: 8, marginLeft: 4 }}>
                  {change > 0 ? '+' : ''}{typeof change === 'number' ? change.toFixed(2) : change}%
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function NewsAIScreen() {
  const { activeSymbol, articles: storeArticles, setArticles } = useStore();

  // News state
  const [category, setCategory] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);
  const [localArticles, setLocalArticles] = useState([]);

  // AI analysis state
  const [aiSymbol, setAiSymbol] = useState(activeSymbol || 'AAPL');
  const [analysisType, setAnalysisType] = useState('technical');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Macro state
  const [macroData, setMacroData] = useState({});

  // ── Fetch news ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchNews() {
      setNewsLoading(true);
      setNewsError(null);
      try {
        const data = await api.getNewsFeed(activeSymbol || '', category, 30);
        if (cancelled) return;
        const items = data.articles || data.feed || data || [];
        setLocalArticles(items);
        setArticles(items);
      } catch (err) {
        if (!cancelled) setNewsError(err.message);
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    }
    fetchNews();
    return () => { cancelled = true; };
  }, [activeSymbol, category, setArticles]);

  // ── Fetch macro ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchMacro() {
      try {
        const data = await api.getMacroData();
        if (!cancelled) setMacroData(data || {});
      } catch {
        // Non-critical
      }
    }
    fetchMacro();
    return () => { cancelled = true; };
  }, []);

  // ── Run AI analysis ──────────────────────────────────────────────
  const runAnalysis = async () => {
    if (!aiSymbol.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiResponse('');
    try {
      const indicatorsByType = {
        technical:   ['RSI', 'MACD', 'BBANDS', 'SMA', 'EMA'],
        fundamental: ['PE', 'EPS', 'REVENUE'],
        sentiment:   ['NEWS_SENTIMENT', 'SOCIAL'],
        macro:       ['DXY', 'VIX', 'YIELD'],
        risk:        ['ATR', 'BETA', 'VAR'],
      };
      const data = await api.runAiAnalysis(
        aiSymbol.trim().toUpperCase(),
        '1D',
        indicatorsByType[analysisType] || ['RSI', 'MACD']
      );
      setAiResponse(data.response || data.analysis || JSON.stringify(data, null, 2));
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Filter articles ──────────────────────────────────────────────
  const articles = (localArticles.length ? localArticles : storeArticles) || [];
  const filteredArticles = articles.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (a.title || '').toLowerCase().includes(q) ||
      (a.source || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="news-ai-screen">
      {/* ── Left: News Feed (40%) ── */}
      <div className="news-ai-screen__left">
        <HudPanel title="NEWS FEED" scanning={newsLoading}>
          {/* Category filters */}
          <div className="hud-filter-bar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`filter-pill ${category === cat ? 'filter-pill--active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="news-search">
            <input
              className="hud-input"
              type="text"
              placeholder="Search headlines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Article list */}
          <div className="hud-panel-body">
            {newsLoading && (
              <div className="news-ai-screen__status">SCANNING FEEDS...</div>
            )}
            {newsError && (
              <div className="news-ai-screen__status" style={{ color: 'var(--hud-red)' }}>
                ERROR: {newsError}
              </div>
            )}
            {!newsLoading && filteredArticles.length === 0 && (
              <div className="news-ai-screen__status">NO ARTICLES FOUND</div>
            )}
            {filteredArticles.map((article, i) => (
              <NewsCard key={article.url || i} article={article} />
            ))}
          </div>
        </HudPanel>
      </div>

      {/* ── Right: AI Analysis (60%) ── */}
      <div className="news-ai-screen__right">
        {/* AI Analysis Panel */}
        <HudPanel title="AI ANALYSIS" className="news-ai-screen__analysis-panel">
          <div className="news-ai-screen__controls">
            {/* Symbol input */}
            <div className="news-ai-screen__control-row">
              <label className="hud-readout__label">SYMBOL</label>
              <input
                className="hud-input"
                type="text"
                value={aiSymbol}
                onChange={(e) => setAiSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                placeholder="AAPL"
              />
            </div>

            {/* Analysis type selector */}
            <div className="news-ai-screen__control-row">
              <label className="hud-readout__label">ANALYSIS TYPE</label>
              <select
                className="hud-select"
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
                style={{ width: '100%' }}
              >
                {ANALYSIS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Run button */}
            <button
              className="news-ai-screen__run-btn"
              onClick={runAnalysis}
              disabled={aiLoading}
            >
              {aiLoading ? 'ANALYSING...' : 'RUN ANALYSIS'}
            </button>
          </div>

          {/* AI Response */}
          <div className="ai-panel-body">
            {aiError && (
              <div style={{ color: 'var(--hud-red)', marginBottom: 8 }}>
                ERROR: {aiError}
              </div>
            )}
            {aiResponse ? (
              <pre>{aiResponse}</pre>
            ) : (
              !aiLoading && (
                <div className="news-ai-screen__status">
                  SELECT SYMBOL AND RUN ANALYSIS
                </div>
              )
            )}
          </div>
        </HudPanel>

        {/* Sentiment Summary */}
        <HudPanel title="SENTIMENT SUMMARY" className="news-ai-screen__sentiment-panel">
          <div style={{ padding: 10 }}>
            <SentimentSummary articles={filteredArticles} />
          </div>
        </HudPanel>
      </div>

      {/* ── Bottom: Macro Dashboard ── */}
      <div className="news-ai-screen__bottom">
        <HudPanel title="MACRO DASHBOARD">
          <MacroDashboard macroData={macroData} />
        </HudPanel>
      </div>

      {/* ── Inline styles scoped to this screen ── */}
      <style>{`
        .news-ai-screen {
          display: grid;
          grid-template-columns: 40% 60%;
          grid-template-rows: 1fr auto;
          gap: 2px;
          height: 100%;
          min-height: 0;
          background: var(--hud-bg);
          padding: 2px;
        }

        .news-ai-screen__left {
          grid-row: 1;
          grid-column: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .news-ai-screen__left > .hud-panel {
          flex: 1;
          min-height: 0;
        }

        .news-ai-screen__right {
          grid-row: 1;
          grid-column: 2;
          display: grid;
          grid-template-rows: 1fr auto;
          gap: 2px;
          min-height: 0;
        }

        .news-ai-screen__analysis-panel {
          min-height: 0;
        }

        .news-ai-screen__sentiment-panel {
          max-height: 140px;
        }

        .news-ai-screen__bottom {
          grid-row: 2;
          grid-column: 1 / -1;
        }

        .news-ai-screen__controls {
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-bottom: 1px solid var(--hud-line);
          flex-shrink: 0;
        }

        .news-ai-screen__control-row {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .news-ai-screen__run-btn {
          width: 100%;
          padding: 8px 12px;
          font-family: var(--hud-font);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 3px;
          text-transform: uppercase;
          cursor: pointer;
          border: 1px solid var(--hud-green);
          background: rgba(0, 204, 136, 0.06);
          color: var(--hud-green);
          transition: all 120ms;
        }

        .news-ai-screen__run-btn:hover:not(:disabled) {
          background: rgba(0, 204, 136, 0.15);
          box-shadow: 0 0 12px rgba(0, 204, 136, 0.12);
        }

        .news-ai-screen__run-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .news-ai-screen__sentiment-tag {
          font-family: var(--hud-font);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 1px;
          padding: 1px 6px;
          text-transform: uppercase;
        }

        .news-ai-screen__confidence {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          padding: 0 2px;
        }

        .news-ai-screen__confidence-track {
          flex: 1;
          height: 2px;
          background: var(--hud-text-dim);
          overflow: hidden;
        }

        .news-ai-screen__confidence-fill {
          height: 100%;
          transition: width 300ms ease;
        }

        .news-ai-screen__confidence-label {
          font-family: var(--hud-font);
          font-size: 7px;
          color: var(--hud-text-mid);
          letter-spacing: 0.5px;
          min-width: 24px;
          text-align: right;
        }

        .news-ai-screen__source-link {
          display: inline-block;
          margin-top: 5px;
          font-family: var(--hud-font);
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 2px;
          color: var(--hud-text-mid);
          text-decoration: none;
          text-transform: uppercase;
          transition: color 80ms;
        }

        .news-ai-screen__source-link:hover {
          color: var(--hud-text-bright);
        }

        .news-ai-screen__status {
          padding: 20px;
          text-align: center;
          font-family: var(--hud-font);
          font-size: 9px;
          color: var(--hud-text-dim);
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .news-ai-screen__summary {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .news-ai-screen__summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .news-ai-screen__summary-counts {
          display: flex;
          gap: 16px;
        }

        .news-ai-screen__summary-count {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-family: var(--hud-font);
          font-size: 8px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .news-ai-screen__summary-count span:last-child {
          font-size: 14px;
          font-weight: 700;
          color: var(--hud-text-bright);
        }
      `}</style>
    </div>
  );
}
