/**
 * HudWatchlist — Left column watchlist with signal strength dots,
 * market filter pills. Monochrome tactical HUD aesthetic.
 */

import { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import * as api from '../../utils/api';
import HudPanel from '../layout/HudPanel';

const MARKETS = ['stocks', 'crypto', 'forex', 'etf'];

export default function HudWatchlist() {
  const { watchlist, activeSymbol, setActiveSymbol, quotes, marketType, setMarketType } = useStore();
  const [signalCache, setSignalCache] = useState({});

  useEffect(() => {
    let cancelled = false;
    const fetchSignals = async () => {
      try {
        const data = await api.getSwingSignals(activeSymbol);
        if (!cancelled) {
          setSignalCache(prev => ({
            ...prev,
            [activeSymbol]: data.signals || [],
          }));
        }
      } catch { /* silent */ }
    };
    fetchSignals();
    const id = setInterval(fetchSignals, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [activeSymbol]);

  const filtered = watchlist.filter(i =>
    i.market === marketType || (marketType === 'etf' && i.market === 'etf') ||
    (marketType === 'stocks' && !i.market)
  );

  const getSignalDots = (symbol) => {
    const sigs = signalCache[symbol] || [];
    const buys = sigs.filter(s => s.type === 'BUY').length;
    const sells = sigs.filter(s => s.type === 'SELL').length;
    const total = Math.min(buys + sells, 5);
    const dots = [];
    for (let i = 0; i < 5; i++) {
      let cls = 'signal-dot';
      if (i < buys) cls += ' signal-dot--buy';
      else if (i < buys + sells) cls += ' signal-dot--sell';
      else if (i < total) cls += ' signal-dot--fill';
      dots.push(<span key={i} className={cls} />);
    }
    return dots;
  };

  return (
    <HudPanel title="WATCHLIST" className="adv-watchlist">
      <div className="hud-filter-bar">
        {MARKETS.map(m => (
          <button
            key={m}
            className={`filter-pill ${marketType === m ? 'filter-pill--active' : ''}`}
            onClick={() => setMarketType(m)}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="hud-panel-body" style={{ padding: '2px 0' }}>
        {filtered.map(item => {
          const q = quotes[item.symbol] || {};
          const change = q.change_pct || 0;
          const isActive = activeSymbol === item.symbol;

          return (
            <div
              key={item.symbol}
              className={`watchlist__item ${isActive ? 'watchlist__item--active' : ''}`}
              onClick={() => setActiveSymbol(item.symbol)}
            >
              <div>
                <div className="watchlist__symbol">{item.symbol}</div>
                <div className="watchlist__name">{item.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="watchlist__price">
                  {q.price ? `$${q.price.toLocaleString()}` : '\u2014'}
                </div>
                <div className={`watchlist__chg ${change >= 0 ? 'positive' : 'negative'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </div>
              </div>
              {isActive && signalCache[item.symbol] && (
                <div className="signal-strength" style={{ gridColumn: '1 / -1', paddingTop: 2 }}>
                  {getSignalDots(item.symbol)}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 12, fontSize: 8, color: 'var(--hud-text-dim)', textAlign: 'center', fontFamily: 'var(--hud-font)', letterSpacing: 1 }}>
            NO SYMBOLS IN {marketType.toUpperCase()}
          </div>
        )}
      </div>
    </HudPanel>
  );
}
