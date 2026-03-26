/**
 * App.jsx — Mode Router
 * Routes to: SimpleView | AdvancedView | QuantScreen | NewsAIScreen |
 *            MLScreen | TechScreen | BrowserScreen | AlgoBuilder |
 *            AnalysisEnv | BacktestEnv | SettingsPage
 */

import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import useStore from './store/useStore';
import useLogStore from './store/useLogStore';
import SyncStatus from './components/SyncStatus';
import ErrorPanel, { ErrorBadge } from './components/ErrorPanel';
import AnimatedBackground from './components/layout/AnimatedBackground';
import SimpleView from './pages/SimpleView';
import AdvancedView from './pages/AdvancedView';
import AlgoBuilder from './pages/AlgoBuilder';
import AnalysisEnv from './pages/AnalysisEnv';
import BacktestEnv from './pages/BacktestEnv';
import SettingsPage from './pages/SettingsPage';
import * as api from './utils/api';

// Lazy-load new heavy screens
const QuantScreen = lazy(() => import('./pages/QuantScreen'));
const NewsAIScreen = lazy(() => import('./pages/NewsAIScreen'));
const MLScreen = lazy(() => import('./pages/MLScreen'));
const TechScreen = lazy(() => import('./pages/TechScreen'));
const BrowserScreen = lazy(() => import('./pages/BrowserScreen'));
const ChartsScreen = lazy(() => import('./pages/ChartsScreen'));

// Loading fallback for lazy screens
function ScreenLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: 'var(--hud-bg, #050510)',
      fontFamily: 'var(--hud-font, monospace)', fontSize: 10,
      color: 'var(--hud-text-mid, #707080)', letterSpacing: 3,
    }}>
      INITIALIZING MODULE...
    </div>
  );
}

// ── Text Scale Control ────────────────────────────────────────────
const TEXT_SCALES = [
  { label: 'XS', value: 0.8 },
  { label: 'S',  value: 0.9 },
  { label: 'M',  value: 1.0 },
  { label: 'L',  value: 1.15 },
  { label: 'XL', value: 1.3 },
];

function TextScaleControl() {
  const [scale, setScale] = useState(() => {
    const saved = localStorage.getItem('lunar_text_scale');
    return saved ? parseFloat(saved) : 1.0;
  });

  const applyScale = useCallback((v) => {
    setScale(v);
    document.documentElement.style.setProperty('--hud-text-scale', v);
    localStorage.setItem('lunar_text_scale', String(v));
  }, []);

  // Apply on mount
  useEffect(() => {
    document.documentElement.style.setProperty('--hud-text-scale', scale);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} title="Text size">
      <span style={{ fontSize: 8, color: 'var(--hud-text-dim)', letterSpacing: 1, fontFamily: 'var(--hud-font)' }}>Aa</span>
      {TEXT_SCALES.map(s => (
        <button
          key={s.label}
          onClick={() => applyScale(s.value)}
          style={{
            fontSize: 7, padding: '1px 4px', border: '1px solid',
            borderColor: scale === s.value ? 'var(--hud-text-mid)' : 'transparent',
            background: scale === s.value ? 'rgba(180,185,200,0.08)' : 'none',
            color: scale === s.value ? 'var(--hud-text)' : 'var(--hud-text-dim)',
            cursor: 'pointer', fontFamily: 'var(--hud-font)', letterSpacing: 0.5,
          }}
        >{s.label}</button>
      ))}
    </div>
  );
}

// ── Account Mode Badge ────────────────────────────────────────────
function AccountBadge({ account }) {
  if (!account) return null;
  const colors = { DEMO: '#3b82f6', PAPER: '#f59e0b', LIVE: '#ef4444' };
  const color = colors[account.badge?.type] || '#64748b';
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
      padding: '1px 5px', borderRadius: 3,
      background: `${color}22`, color,
      border: `1px solid ${color}44`,
      letterSpacing: 0.5,
    }}>
      {account.badge?.label || account.mode?.toUpperCase()}
    </span>
  );
}

// ── Top Bar ───────────────────────────────────────────────────────
function TopBar() {
  const {
    appMode, setAppMode, prevMode, setPrevMode,
    activeUser, setActiveUser, users,
    backendStatus, tradingMode,
    getActiveAccount,
  } = useStore();

  const [search, setSearch] = useState('');
  const { setActiveSymbol } = useStore();

  const handleSearch = (e) => {
    if (e.key === 'Enter' && search.trim()) {
      setActiveSymbol(search.trim().toUpperCase());
      setSearch('');
      if (appMode !== 'advanced') setAppMode('advanced');
    }
  };

  const envs = [
    { id: 'advanced',      label: 'Terminal',    icon: '▦' },
    { id: 'charts',        label: 'Charts',      icon: '▤' },
    { id: 'quant',         label: 'Quant',       icon: '∑' },
    { id: 'news-ai',       label: 'News+AI',     icon: '⊛' },
    { id: 'ml',            label: 'ML/Algo',     icon: '⧫' },
    { id: 'tech',          label: 'Tech',        icon: '◎' },
    { id: 'browser',       label: 'AI Chat',     icon: '◈' },
    { id: 'settings',      label: 'Config',      icon: '⚙' },
  ];

  const user = users[activeUser];
  const markets = ['stocks', 'crypto', 'forex'];

  const openSettings = () => {
    setPrevMode(appMode);
    setAppMode('settings');
  };

  const toggleUser = () => setActiveUser(activeUser === 'A' ? 'B' : 'A');

  const modeColor = { demo: 'var(--blue)', paper: 'var(--amber)', live: 'var(--red)' };

  return (
    <div className="top-bar">
      {/* Logo + simple/advanced toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' }}>
        <div className="top-bar__logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            style={{ filter: 'drop-shadow(0 0 5px rgba(0,212,255,0.7))', flexShrink: 0 }}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
              fill="#00d4ff" fillOpacity="0.9" stroke="#00d4ff" strokeWidth="0.5"/>
            <circle cx="18.5" cy="5"   r="0.7" fill="#00d4ff" fillOpacity="0.5"/>
            <circle cx="20"   cy="8.5" r="0.5" fill="#9d7ff0" fillOpacity="0.6"/>
            <circle cx="15"   cy="3"   r="0.6" fill="#00d4ff" fillOpacity="0.4"/>
          </svg>
          <span style={{
            background: 'linear-gradient(90deg, #00d4ff 0%, #7dd3fc 55%, #9d7ff0 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', letterSpacing: '2.5px', fontSize: '13px', fontWeight: 700,
          }}>LUNAR</span>
          <span style={{ color: '#2d4060', fontSize: '10px', letterSpacing: '1.5px', fontWeight: 500, marginLeft: '-1px' }}>
            TERMINAL
          </span>
        </div>
        <button
          className="btn btn--sm"
          style={{ fontSize: 10, padding: '2px 8px', opacity: 0.8 }}
          onClick={() => setAppMode(appMode === 'simple' ? 'advanced' : 'simple')}
        >
          {appMode === 'simple' ? '⬆ Advanced' : '⬇ Simple'}
        </button>
      </div>

      {/* Environment Tabs */}
      {appMode !== 'simple' && (
        <div className="env-tabs" style={{ WebkitAppRegion: 'no-drag', display: 'flex', gap: 0, flexWrap: 'wrap' }}>
          {envs.map(e => (
            <button
              key={e.id}
              className={`env-tab ${appMode === e.id ? 'env-tab--active' : ''}`}
              onClick={() => setAppMode(e.id)}
              style={{ whiteSpace: 'nowrap' }}
            >
              <span style={{ marginRight: 3 }}>{e.icon}</span>{e.label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {appMode !== 'simple' && appMode !== 'settings' && (
        <div className="top-bar__search" style={{ WebkitAppRegion: 'no-drag' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Search symbol..."
          />
        </div>
      )}

      {/* Right: Account indicators + user + sync + settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, WebkitAppRegion: 'no-drag' }}>
        {markets.map(m => {
          const acct = getActiveAccount(m);
          return acct ? (
            <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, cursor: 'pointer' }}
                 onClick={() => { setPrevMode(appMode); setAppMode('settings'); }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{m}</span>
              <AccountBadge account={acct} />
            </div>
          ) : null;
        })}

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase',
          background: `${modeColor[tradingMode]}22`, color: modeColor[tradingMode],
        }}>
          {tradingMode}
        </span>

        <span style={{ fontSize: 10, color: backendStatus === 'connected' ? 'var(--green)' : 'var(--amber)' }}>
          ● {backendStatus === 'connected' ? 'Live' : 'Connecting'}
        </span>

        <TextScaleControl />
        <SyncStatus />
        <ErrorBadge />

        <button
          onClick={toggleUser}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: user.color, color: 'white',
            border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title={`${user.name} — click to switch`}
        >
          {user.initials}
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const { appMode, setBackendStatus, watchlist, setArticles, setSignals, setSafetyStatus, setQuote } = useStore();
  const connectLogs = useLogStore(s => s.connect);

  useEffect(() => {
    connectLogs();

    let interval;
    const init = async () => {
      try {
        await api.healthCheck();
        setBackendStatus('connected');
        const [newsData, signalData, safetyData] = await Promise.allSettled([
          api.getNewsFeed(null, 'markets', 15),
          api.getSwingSignals('AAPL'),
          api.getSafetyStatus(),
        ]);
        if (newsData.status === 'fulfilled') setArticles(newsData.value);
        if (signalData.status === 'fulfilled') setSignals(signalData.value.signals || []);
        if (safetyData.status === 'fulfilled') setSafetyStatus(safetyData.value);

        interval = setInterval(async () => {
          for (const item of watchlist.slice(0, 5)) {
            try { const q = await api.getQuote(item.symbol); setQuote(item.symbol, q); }
            catch { /* skip */ }
          }
        }, 5000);
      } catch {
        setBackendStatus('connecting');
        setTimeout(init, 3000);
      }
    };
    init();
    return () => clearInterval(interval);
  }, []);

  const renderPage = () => {
    switch (appMode) {
      case 'simple':       return <SimpleView />;
      case 'algo-builder': return <AlgoBuilder />;
      case 'analysis':     return <AnalysisEnv />;
      case 'backtest':     return <BacktestEnv />;
      case 'settings':     return <SettingsPage />;
      case 'quant':        return <Suspense fallback={<ScreenLoader />}><QuantScreen /></Suspense>;
      case 'news-ai':      return <Suspense fallback={<ScreenLoader />}><NewsAIScreen /></Suspense>;
      case 'ml':           return <Suspense fallback={<ScreenLoader />}><MLScreen /></Suspense>;
      case 'tech':         return <Suspense fallback={<ScreenLoader />}><TechScreen /></Suspense>;
      case 'browser':      return <Suspense fallback={<ScreenLoader />}><BrowserScreen /></Suspense>;
      case 'charts':       return <Suspense fallback={<ScreenLoader />}><ChartsScreen /></Suspense>;
      default:             return <AdvancedView />;
    }
  };

  return (
    <div className="app">
      <AnimatedBackground />
      <TopBar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        {renderPage()}
      </div>
      <ErrorPanel />
    </div>
  );
}
