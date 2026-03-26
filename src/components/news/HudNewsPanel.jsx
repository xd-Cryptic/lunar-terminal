/**
 * HudNewsPanel — News feed with category filters, sentiment dots,
 * search filtering, colored bearish/bullish tags, clickable sources,
 * and AI-generated analysis reasoning.
 * Monochrome tactical HUD aesthetic.
 */

import { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import * as api from '../../utils/api';
import HudPanel from '../layout/HudPanel';

const CATEGORIES = ['all', 'markets', 'crypto', 'forex', 'macro'];

const SENTIMENT_STYLES = {
  bullish:  { color: 'var(--hud-green)', bg: 'rgba(0,204,136,0.08)', border: 'rgba(0,204,136,0.25)' },
  bearish:  { color: 'var(--hud-red)',   bg: 'rgba(204,51,85,0.08)', border: 'rgba(204,51,85,0.25)' },
  neutral:  { color: 'var(--hud-text-mid)', bg: 'rgba(180,185,200,0.04)', border: 'rgba(180,185,200,0.10)' },
  positive: { color: 'var(--hud-green)', bg: 'rgba(0,204,136,0.08)', border: 'rgba(0,204,136,0.25)' },
  negative: { color: 'var(--hud-red)',   bg: 'rgba(204,51,85,0.08)', border: 'rgba(204,51,85,0.25)' },
};

function getSentimentStyle(label) {
  const key = (label || 'neutral').toLowerCase();
  return SENTIMENT_STYLES[key] || SENTIMENT_STYLES.neutral;
}

export default function HudNewsPanel() {
  const { articles, setArticles, activeSymbol } = useStore();
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSummaries, setAiSummaries] = useState({});
  const [loadingAi, setLoadingAi] = useState({});
  const [loading, setLoading] = useState(false);

  const BACKEND = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_BACKEND_URL || 'http://localhost:8787')
    : 'http://localhost:8787';

  useEffect(() => {
    let cancelled = false;
    const fetchNews = async () => {
      setLoading(true);
      try {
        const data = await api.getNewsFeed(activeSymbol, category === 'all' ? 'general' : category, 20);
        if (!cancelled) setArticles(Array.isArray(data) ? data : data.articles || []);
      } catch { /* keep previous */ }
      if (!cancelled) setLoading(false);
    };
    fetchNews();
    const id = setInterval(fetchNews, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [category, activeSymbol]);

  useEffect(() => {
    if (!articles.length) return;
    const toSummarize = articles.slice(0, 5);
    toSummarize.forEach((article, idx) => {
      if (aiSummaries[idx] !== undefined) return;
      setLoadingAi(prev => ({ ...prev, [idx]: true }));

      fetch(`${BACKEND}/ai/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: activeSymbol,
          timeframe: '1D',
          indicators: [],
          prompt: `Analyze this financial news headline for a trader. State if it's BULLISH or BEARISH and explain why in 1-2 sentences: "${article.title}"`,
        }),
      })
        .then(r => r.json())
        .then(data => {
          setAiSummaries(prev => ({ ...prev, [idx]: { text: data.response || null, error: false } }));
        })
        .catch(() => {
          setAiSummaries(prev => ({ ...prev, [idx]: { text: null, error: true } }));
        })
        .finally(() => {
          setLoadingAi(prev => ({ ...prev, [idx]: false }));
        });
    });
  }, [articles]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return articles;
    const q = searchQuery.toLowerCase();
    return articles.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.source || '').toLowerCase().includes(q)
    );
  }, [articles, searchQuery]);

  return (
    <HudPanel title="NEWS FEED" scanning={loading}>
      <div className="hud-filter-bar">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`filter-pill ${category === cat ? 'filter-pill--active' : ''}`}
            onClick={() => { setCategory(cat); setAiSummaries({}); }}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="news-search">
        <input
          className="hud-input"
          placeholder="FILTER HEADLINES..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ letterSpacing: 1, fontSize: 8 }}
        />
      </div>

      <div className="hud-panel-body">
        {filtered.length === 0 && !loading && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 8, color: 'var(--hud-text-dim)', fontFamily: 'var(--hud-font)', letterSpacing: 1 }}>
            {articles.length === 0 ? 'NEWS FEED UNAVAILABLE' : 'NO MATCHING HEADLINES'}
          </div>
        )}

        {filtered.map((article, i) => {
          const sentiment = article.sentiment || {};
          const label = sentiment.label || 'neutral';
          const sStyle = getSentimentStyle(label);
          const score = sentiment.score ? (sentiment.score * 100).toFixed(0) : null;
          const reasoning = sentiment.reasoning;
          const origIdx = articles.indexOf(article);
          const summary = aiSummaries[origIdx];
          const isLoadingAi = loadingAi[origIdx];

          return (
            <div
              key={i}
              className="news-card"
              style={{ cursor: article.url ? 'pointer' : 'default' }}
              onClick={() => article.url && window.open(article.url, '_blank')}
            >
              {/* Meta row: source + date + sentiment tag */}
              <div className="news-card__meta">
                <span
                  className="news-card__sentiment"
                  style={{ background: sStyle.color }}
                  title={`${label} ${score ? score + '%' : ''}`}
                />
                <span>{article.source || 'UNKNOWN'}</span>
                <span>{article.published?.split('T')[0] || ''}</span>

                {/* Colored sentiment tag */}
                {label !== 'neutral' && (
                  <span style={{
                    fontFamily: 'var(--hud-font)', fontWeight: 700, fontSize: 7,
                    padding: '1px 6px', letterSpacing: 1,
                    color: sStyle.color,
                    background: sStyle.bg,
                    border: `1px solid ${sStyle.border}`,
                  }}>
                    {label.toUpperCase()} {score ? `${score}%` : ''}
                  </span>
                )}
                {label === 'neutral' && score && (
                  <span style={{
                    fontFamily: 'var(--hud-font)', fontSize: 7,
                    color: 'var(--hud-text-dim)', letterSpacing: 1,
                  }}>
                    NEUTRAL {score}%
                  </span>
                )}
              </div>

              {/* Headline */}
              <div className="news-card__headline">{article.title}</div>

              {/* Sentiment reasoning from backend */}
              {reasoning && (
                <div style={{
                  marginTop: 3, padding: '4px 8px',
                  borderLeft: `2px solid ${sStyle.color}`,
                  fontSize: 8, color: sStyle.color,
                  fontFamily: 'var(--hud-font)', lineHeight: 1.4,
                  background: sStyle.bg,
                }}>
                  {reasoning}
                </div>
              )}

              {/* AI summary for top articles */}
              {origIdx < 5 && (
                <div className="news-card__ai-summary">
                  {isLoadingAi ? (
                    <span style={{ color: 'var(--hud-text-dim)', fontSize: 8, letterSpacing: 1 }}>ANALYZING...</span>
                  ) : summary?.text ? (
                    <span>{summary.text}</span>
                  ) : (
                    <span style={{ color: 'var(--hud-text-dim)', fontSize: 8, letterSpacing: 1 }}>
                      {summary?.error ? 'AI OFFLINE' : 'NO AI ANALYSIS'}
                    </span>
                  )}
                </div>
              )}

              {/* Source link */}
              {article.url && (
                <div style={{ marginTop: 3 }}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontSize: 7, fontFamily: 'var(--hud-font)',
                      color: 'var(--hud-text-dim)', letterSpacing: 1,
                      textDecoration: 'none',
                      borderBottom: '1px solid var(--hud-text-dim)',
                    }}
                  >
                    VIEW SOURCE →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </HudPanel>
  );
}
