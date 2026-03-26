/**
 * TickerExplorer — Full-featured ticker browser with market type tabs,
 * search, sector filtering, sortable columns, pagination.
 * Monochrome tactical HUD aesthetic.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../../utils/api';
import HudPanel from '../layout/HudPanel';

const MARKET_TYPES = [
  { key: 'stocks', label: 'STOCKS' },
  { key: 'crypto', label: 'CRYPTO' },
  { key: 'forex', label: 'FOREX' },
];

const PAGE_SIZE = 50;

export default function TickerExplorer({ onSelect, onAddToWatchlist }) {
  const [marketType, setMarketType] = useState('stocks');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sector, setSector] = useState('');
  const [sectors, setSectors] = useState([]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('symbol');
  const [sortDir, setSortDir] = useState('asc');

  const debounceRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Reset on market type change
  useEffect(() => {
    setPage(0);
    setSector('');
    setSectors([]);
    setData([]);
    setTotal(0);
    setError(null);

    let cancelled = false;
    const fetchSectors = async () => {
      try {
        const result = await api.getSectors(marketType);
        if (!cancelled) setSectors(result.sectors || result || []);
      } catch {
        /* sectors optional */
      }
    };
    fetchSectors();
    return () => { cancelled = true; };
  }, [marketType]);

  // Fetch data on state change
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getTickerUniverse(
          marketType,
          page * PAGE_SIZE,
          PAGE_SIZE,
          debouncedSearch,
          sector
        );
        if (!cancelled) {
          const items = result.items || result.data || result.tickers || [];
          setData(items);
          setTotal(result.total ?? items.length);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err?.message || String(err);
          const isConn = /fetch|network|ECONNREFUSED|timeout/i.test(msg);
          setError(
            isConn
              ? 'BACKEND UNREACHABLE'
              : `LOAD FAILED: ${msg}`
          );
        }
      }
      if (!cancelled) setLoading(false);
    };
    fetchData();
    return () => { cancelled = true; };
  }, [marketType, page, debouncedSearch, sector]);

  // Client-side sort (on current page)
  const sortedData = [...data].sort((a, b) => {
    const aVal = (a[sortBy] || '').toString().toLowerCase();
    const bVal = (b[sortBy] || '').toString().toLowerCase();
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = useCallback((col) => {
    setSortBy((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return col;
    });
  }, []);

  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const SortArrow = ({ col }) => {
    if (sortBy !== col) return null;
    return (
      <span style={{ marginLeft: 2, fontSize: 6 }}>
        {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
      </span>
    );
  };

  return (
    <HudPanel title="TICKER UNIVERSE" scanning={loading}>
      {/* Market type tabs */}
      <div className="hud-filter-bar">
        {MARKET_TYPES.map((m) => (
          <button
            key={m.key}
            className={`filter-pill ${marketType === m.key ? 'filter-pill--active' : ''}`}
            onClick={() => setMarketType(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Search + sector filter */}
      <div style={{ padding: '6px 8px', display: 'flex', gap: 6, flexShrink: 0 }}>
        <input
          className="hud-input"
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: '4px 8px' }}
        />
        {sectors.length > 0 && (
          <select
            className="hud-select"
            value={sector}
            onChange={(e) => { setSector(e.target.value); setPage(0); }}
          >
            <option value="">All Sectors</option>
            {sectors.map((s) => {
              const label = typeof s === 'string' ? s : s.name || s.label;
              const value = typeof s === 'string' ? s : s.id || s.name || s.label;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="hud-panel-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Column headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr 80px 28px',
            gap: 4,
            padding: '4px 8px',
            borderBottom: '1px solid var(--hud-line)',
            flexShrink: 0,
          }}
        >
          <div
            style={colHeaderStyle}
            onClick={() => handleSort('symbol')}
          >
            SYM <SortArrow col="symbol" />
          </div>
          <div
            style={colHeaderStyle}
            onClick={() => handleSort('name')}
          >
            NAME <SortArrow col="name" />
          </div>
          <div
            style={colHeaderStyle}
            onClick={() => handleSort('sector')}
          >
            SECTOR <SortArrow col="sector" />
          </div>
          <div style={{ ...colHeaderStyle, cursor: 'default' }} />
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {error && (
            <div
              style={{
                padding: '16px 12px',
                fontSize: 8,
                color: 'var(--hud-red)',
                textAlign: 'center',
                fontFamily: 'var(--hud-font)',
                letterSpacing: 1,
              }}
            >
              {error}
            </div>
          )}

          {!error && sortedData.length === 0 && !loading && (
            <div
              style={{
                padding: '20px 12px',
                fontSize: 8,
                color: 'var(--hud-text-dim)',
                textAlign: 'center',
                fontFamily: 'var(--hud-font)',
                letterSpacing: 1,
              }}
            >
              {debouncedSearch ? 'NO RESULTS' : 'NO DATA AVAILABLE'}
            </div>
          )}

          {!error &&
            sortedData.map((item) => (
              <div
                key={item.symbol}
                onClick={() => onSelect && onSelect(item.symbol)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 80px 28px',
                  gap: 4,
                  padding: '5px 8px',
                  borderBottom: '1px solid var(--hud-line)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--hud-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--hud-text-bright)',
                    fontFamily: 'var(--hud-font)',
                    letterSpacing: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.symbol}
                </span>
                <span
                  style={{
                    fontSize: 8,
                    color: 'var(--hud-text)',
                    fontFamily: 'var(--hud-font)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.name || '--'}
                </span>
                <span
                  style={{
                    fontSize: 7,
                    color: 'var(--hud-text-dim)',
                    fontFamily: 'var(--hud-font)',
                    letterSpacing: 0.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.sector
                    ? item.sector.length > 8
                      ? item.sector.slice(0, 8)
                      : item.sector
                    : '--'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToWatchlist && onAddToWatchlist({
                      symbol: item.symbol,
                      name: item.name,
                      sector: item.sector,
                    });
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid var(--hud-line)',
                    color: 'var(--hud-text-mid)',
                    cursor: 'pointer',
                    fontSize: 10,
                    fontFamily: 'var(--hud-font)',
                    padding: '1px 4px',
                    lineHeight: 1,
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--hud-green)';
                    e.currentTarget.style.borderColor = 'rgba(0,204,136,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--hud-text-mid)';
                    e.currentTarget.style.borderColor = 'var(--hud-line)';
                  }}
                  title="Add to watchlist"
                >
                  +
                </button>
              </div>
            ))}

          {loading && sortedData.length === 0 && (
            <div
              style={{
                padding: '20px 12px',
                fontSize: 8,
                color: 'var(--hud-text-mid)',
                textAlign: 'center',
                fontFamily: 'var(--hud-font)',
                letterSpacing: 2,
                animation: 'hud-pulse 1.5s ease infinite',
              }}
            >
              LOADING...
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 8px',
              borderTop: '1px solid var(--hud-line)',
              flexShrink: 0,
              fontSize: 7,
              fontFamily: 'var(--hud-font)',
              color: 'var(--hud-text-dim)',
              letterSpacing: 1,
            }}
          >
            <span>
              {rangeStart}-{rangeEnd} OF {total}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="filter-pill"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                style={{
                  opacity: page === 0 ? 0.3 : 1,
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 7,
                }}
              >
                &#9664; PREV
              </button>
              <button
                className="filter-pill"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  opacity: page >= totalPages - 1 ? 0.3 : 1,
                  cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  fontSize: 7,
                }}
              >
                NEXT &#9654;
              </button>
            </div>
          </div>
        )}
      </div>
    </HudPanel>
  );
}

/* ── Shared inline styles ── */
const colHeaderStyle = {
  fontSize: 6,
  letterSpacing: 2,
  color: 'var(--hud-text-dim)',
  fontFamily: 'var(--hud-font)',
  cursor: 'pointer',
  userSelect: 'none',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
};
