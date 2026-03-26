/**
 * SimpleView — Clean, minimal dashboard for everyday use.
 * Designed for quick portfolio health check: no jargon, just trends.
 */

import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';

// Simple SVG sparkline
function Sparkline({ data = [], color = '#22c55e', height = 48, width = '100%' }) {
  if (data.length < 2) {
    const stub = Array.from({ length: 20 }, (_, i) => 100 + i * 2 + Math.random() * 5);
    data = stub;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 300;
  const h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const areaPath = `M ${pts.split(' ').join(' L ')} L ${w},${h} L 0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width, height, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sg)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// Market card
function MarketCard({ market, label, pnl, pnlPct, capital, color, account }) {
  const badgeColors = { DEMO: '#3b82f6', PAPER: '#f59e0b', LIVE: '#ef4444' };
  const badgeColor = badgeColors[account?.badge?.type] || '#64748b';
  const up = pnlPct >= 0;

  return (
    <div style={{
      padding: 20, borderRadius: 12,
      background: 'var(--bg-panel)',
      border: `1px solid ${color}33`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.15 }}>
        <Sparkline color={color} height={60} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
          {account && (
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontWeight: 700,
              background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}44`,
            }}>
              {account.badge?.type} · {account.name}
            </span>
          )}
        </div>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: 4 }}>
        ${capital?.toLocaleString() || '—'}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: up ? '#22c55e' : '#ef4444', fontFamily: 'var(--font-mono)' }}>
        {up ? '▲' : '▼'} {up ? '+' : ''}{pnlPct?.toFixed(2)}% <span style={{ fontSize: 12 }}>({up ? '+' : ''}${pnl?.toFixed(0)})</span>
      </div>
    </div>
  );
}

export default function SimpleView() {
  const {
    setAppMode, activeUser, users,
    accounts, activeAccountSlot, getActiveAccount,
    demoAccounts, fundAllocation, quotes, tradingMode,
  } = useStore();

  const user = users[activeUser];
  const totalValue = 68420;
  const totalPnl = +2341;
  const totalPnlPct = +3.54;

  const marketData = [
    { market: 'stocks', label: 'Stocks',  capital: 28500, pnl: +1200, pnlPct: +4.40, color: '#3b82f6' },
    { market: 'crypto', label: 'Crypto',  capital: 20500, pnl:  +890, pnlPct: +4.54, color: '#a855f7' },
    { market: 'forex',  label: 'Forex',   capital: 13800, pnl:  +251, pnlPct: +1.85, color: '#22c55e' },
  ];

  const activeAlgos = [
    { name: 'RSI-MACD', running: true,  markets: 'stocks, crypto' },
    { name: 'SMA Cross', running: true,  markets: 'stocks' },
    { name: 'Scalper',   running: false, markets: 'crypto' },
  ];

  return (
    <div className="simple-view">
      {/* Hero */}
      <div className="simple-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: 'white',
          }}>
            {user.initials}
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Welcome back, {user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Total Portfolio Value</div>
            <div style={{ fontSize: 48, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>
              ${totalValue.toLocaleString()}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: totalPnl >= 0 ? '#22c55e' : '#ef4444', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
              {totalPnl >= 0 ? '▲' : '▼'} +${totalPnl.toLocaleString()} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%) today
            </div>
          </div>
          <div style={{ height: 90, opacity: 0.9 }}>
            <Sparkline color="#22c55e" height={90} />
          </div>
        </div>

        {/* Mode badge */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {tradingMode === 'demo' && (
            <span style={{ padding: '3px 10px', borderRadius: 4, background: 'var(--blue-bg)', color: 'var(--blue)', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              🔵 DEMO MODE — No real money
            </span>
          )}
          {tradingMode === 'paper' && (
            <span style={{ padding: '3px 10px', borderRadius: 4, background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              🟡 PAPER TRADING — Real data, simulated fills
            </span>
          )}
          {tradingMode === 'live' && (
            <span style={{ padding: '3px 10px', borderRadius: 4, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              🔴 LIVE TRADING — Real money active
            </span>
          )}
        </div>
      </div>

      {/* Market cards */}
      <div className="simple-market-grid">
        {marketData.map(m => (
          <MarketCard key={m.market} {...m} account={getActiveAccount(m.market)} />
        ))}
      </div>

      {/* Bottom row: Algos + Allocation + Demo accounts */}
      <div className="simple-bottom">
        {/* Algo status */}
        <div className="simple-card">
          <div className="simple-card__title">Running Algorithms</div>
          {activeAlgos.map(a => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: a.running ? '#22c55e' : '#475569',
                  boxShadow: a.running ? '0 0 6px #22c55e' : 'none',
                  animation: a.running ? 'pulse 2s infinite' : 'none',
                }} />
                <span style={{ fontWeight: 600, fontSize: 12 }}>{a.name}</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{a.markets}</span>
            </div>
          ))}
          <button className="btn btn--sm" style={{ marginTop: 10, width: '100%' }} onClick={() => setAppMode('algo-builder')}>
            Manage Algorithms →
          </button>
        </div>

        {/* Fund allocation */}
        <div className="simple-card">
          <div className="simple-card__title">Fund Allocation</div>
          {Object.entries(fundAllocation).map(([k, v]) => {
            const colors = { stocks: '#3b82f6', crypto: '#a855f7', forex: '#22c55e', cash: '#64748b' };
            return (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: colors[k] }}>{v}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${v}%`, background: colors[k], borderRadius: 3,
                    boxShadow: `0 0 6px ${colors[k]}66`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Demo accounts */}
        <div className="simple-card">
          <div className="simple-card__title">Demo Accounts <span style={{ color: 'var(--blue)', fontSize: 9 }}>● SIMULATED</span></div>
          {demoAccounts.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>No demo accounts running.</div>
          )}
          {demoAccounts.slice(0, 3).map(d => (
            <div key={d.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                ${d.capital?.toLocaleString()} · P&L: <span style={{ color: '#22c55e' }}>+$0</span>
              </div>
            </div>
          ))}
          <button className="btn btn--sm btn--primary" style={{ marginTop: 10, width: '100%' }} onClick={() => setAppMode('advanced')}>
            ⬆ Open Advanced Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
