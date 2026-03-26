/**
 * ErrorPanel.jsx — Real-time log & error trace panel.
 *
 * Features:
 * - Live WebSocket stream from backend
 * - Collapsible slide-up panel (hotkey: ` backtick or click)
 * - Error badge on the top bar showing live error count
 * - Tabs: All Logs | Errors | Requests | Traces
 * - Level filter + free-text search + module filter
 * - Click any entry → expand full traceback
 * - One-click copy entry or traceback
 * - Download log file button
 * - Clear buffer button
 * - Auto-scroll with pause on hover
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import useLogStore, { LEVEL_ORDER } from '../store/useLogStore';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';

// ── Level badge ───────────────────────────────────────────────────
const LEVEL_STYLE = {
  DEBUG:    { bg: '#1e3a5f', color: '#60a5fa', border: '#3b82f655' },
  INFO:     { bg: '#14532d', color: '#4ade80', border: '#22c55e55' },
  WARNING:  { bg: '#451a03', color: '#fbbf24', border: '#f59e0b55' },
  ERROR:    { bg: '#450a0a', color: '#f87171', border: '#ef444455' },
  CRITICAL: { bg: '#2e1065', color: '#e879f9', border: '#a855f755' },
};

function LevelBadge({ level }) {
  const s = LEVEL_STYLE[level] || LEVEL_STYLE.DEBUG;
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '1px 5px',
      borderRadius: 3, fontFamily: 'var(--font-mono)',
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      flexShrink: 0, letterSpacing: 0.5,
    }}>
      {level}
    </span>
  );
}

// ── Single log row ────────────────────────────────────────────────
function LogRow({ entry, index }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);

  const ts   = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('en-AU', { hour12: false, fractionalSecondDigits: 2 }) : '';
  const s    = LEVEL_STYLE[entry.level] || LEVEL_STYLE.DEBUG;
  const hasTrace = !!entry.traceback;

  const copy = (e, text) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={() => hasTrace && setExpanded(x => !x)}
      style={{
        padding: '3px 10px',
        borderBottom: '1px solid #1a2332',
        borderLeft: `3px solid ${s.color}44`,
        cursor: hasTrace ? 'pointer' : 'default',
        background: index % 2 === 0 ? 'transparent' : '#0a0e1740',
        transition: 'background 100ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = s.bg + '22'}
      onMouseLeave={e => e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : '#0a0e1740'}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minHeight: 20 }}>
        <span style={{ color: '#475569', fontFamily: 'var(--font-mono)', fontSize: 9, flexShrink: 0 }}>{ts}</span>
        <LevelBadge level={entry.level} />
        <span style={{ color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: 9, flexShrink: 0 }}>
          {entry.logger?.split('.').pop()}{entry.line ? `:${entry.line}` : ''}
        </span>
        <span style={{ flex: 1, fontSize: 11, color: ['ERROR', 'CRITICAL'].includes(entry.level) ? s.color : '#94a3b8', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
          {entry.emoji} {entry.message}
        </span>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={e => copy(e, JSON.stringify(entry, null, 2))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 10, padding: '0 4px' }}
            title="Copy entry JSON"
          >
            {copied ? '✓' : '⎘'}
          </button>
          {hasTrace && (
            <span style={{ color: '#475569', fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {/* Extra context fields */}
      {entry.extra && Object.keys(entry.extra).length > 0 && (
        <div style={{ marginLeft: 120, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(entry.extra).map(([k, v]) => (
            <span key={k} style={{ fontSize: 9, padding: '0 4px', borderRadius: 2, background: '#1e293b', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
              {k}={String(v)}
            </span>
          ))}
        </div>
      )}

      {/* Expanded traceback */}
      {expanded && entry.traceback && (
        <div style={{ margin: '6px 0 6px 40px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 6, right: 6 }}>
            <button
              onClick={e => copy(e, entry.traceback)}
              style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 3, color: '#94a3b8', fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}
            >
              Copy Traceback
            </button>
          </div>
          <pre style={{
            background: '#0d1117', borderRadius: 4, padding: '10px 12px',
            color: '#f87171', fontSize: 10, lineHeight: 1.6,
            fontFamily: 'var(--font-mono)', overflowX: 'auto',
            border: '1px solid #450a0a', maxHeight: 300, overflowY: 'auto',
          }}>
            {entry.traceback}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Error Badge (shown in top bar) ───────────────────────────────
export function ErrorBadge() {
  const { togglePanel, panelOpen, wsStatus } = useLogStore();
  const errorCount = useLogStore(s => s.getErrorCount());

  const statusColor = { connected: '#22c55e', connecting: '#f59e0b', disconnected: '#64748b', error: '#ef4444' }[wsStatus] || '#64748b';

  return (
    <button
      onClick={togglePanel}
      title="Toggle log panel (backtick)"
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 4,
        background: panelOpen ? '#1e293b' : 'none',
        border: `1px solid ${panelOpen ? '#334155' : 'transparent'}`,
        cursor: 'pointer', transition: 'all 150ms',
      }}
    >
      {/* WS connection dot */}
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0,
        boxShadow: wsStatus === 'connected' ? `0 0 4px ${statusColor}` : 'none' }} />
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#64748b' }}>LOGS</span>
      {errorCount > 0 && (
        <span style={{
          fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 10,
          background: '#450a0a', color: '#f87171',
          border: '1px solid #ef444444',
          animation: 'pulse 2s infinite',
        }}>
          {errorCount >= 99 ? '99+' : errorCount}
        </span>
      )}
    </button>
  );
}

// ── Main ErrorPanel ───────────────────────────────────────────────
export default function ErrorPanel() {
  const {
    panelOpen, setPanelOpen, activeTab, setActiveTab,
    filterLevel, setFilterLevel, filterText, setFilterText,
    filterModule, setFilterModule, autoScroll, setAutoScroll,
    clearLogs, wsStatus, connect,
    getFilteredLogs,
  } = useLogStore();

  const filteredLogs  = getFilteredLogs();
  const scrollRef     = useRef(null);
  const [panelHeight, setPanelHeight] = useState(340);
  const [isResizing, setIsResizing]   = useState(false);
  const [copiedAll, setCopiedAll]     = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Keyboard shortcut: backtick to toggle
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        setPanelOpen(!panelOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [panelOpen, setPanelOpen]);

  // Panel resize drag
  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startH = panelHeight;

    const onMove = (ev) => {
      const delta = startY - ev.clientY;
      setPanelHeight(Math.max(160, Math.min(window.innerHeight * 0.8, startH + delta)));
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const copyAll = () => {
    const text = filteredLogs.map(l => `[${l.timestamp}] [${l.level}] [${l.logger}:${l.line}] ${l.message}${l.traceback ? '\n' + l.traceback : ''}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const downloadLog = () => {
    window.open(`${BACKEND}/logs/download`, '_blank');
  };

  const errorCount   = useLogStore(s => s.getErrorCount());
  const totalLogs    = useLogStore(s => s.logs.length);

  const TABS = [
    { id: 'all',      label: 'All',      count: totalLogs },
    { id: 'errors',   label: 'Errors',   count: errorCount, alert: errorCount > 0 },
    { id: 'requests', label: 'Requests', count: null },
    { id: 'trace',    label: 'Traces',   count: null },
  ];

  const LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
  const LEVEL_COLORS = { DEBUG: '#60a5fa', INFO: '#4ade80', WARNING: '#fbbf24', ERROR: '#f87171', CRITICAL: '#e879f9' };

  if (!panelOpen) return null;

  return (
    <div
      className="error-panel"
      style={{ height: panelHeight }}
      onMouseEnter={() => setAutoScroll(false)}
      onMouseLeave={() => setAutoScroll(true)}
    >
      {/* Resize handle */}
      <div
        className="error-panel__resize-handle"
        onMouseDown={handleResizeMouseDown}
        style={{ cursor: isResizing ? 'ns-resize' : 'n-resize' }}
      />

      {/* Header */}
      <div className="error-panel__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* WS status */}
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 6px', borderRadius: 3,
            background: wsStatus === 'connected' ? '#14532d' : '#1e293b',
            color: wsStatus === 'connected' ? '#4ade80' : '#64748b',
          }}>
            {wsStatus === 'connected' ? '● LIVE' : wsStatus === 'connecting' ? '○ CONNECTING' : '○ OFFLINE'}
          </span>

          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>LOG CONSOLE</span>
          <span style={{ fontSize: 10, color: '#475569' }}>{filteredLogs.length}/{totalLogs} entries</span>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)',
                  background: activeTab === t.id ? '#1e293b' : 'none',
                  color: activeTab === t.id ? '#e2e8f0' : '#64748b',
                }}>
                {t.label}
                {t.count != null && (
                  <span style={{ marginLeft: 4, padding: '0 4px', borderRadius: 8, fontSize: 9,
                    background: t.alert ? '#450a0a' : '#1e293b', color: t.alert ? '#f87171' : '#475569' }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Level filter */}
          <select
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value)}
            style={{ fontSize: 10, padding: '2px 4px', background: '#1e293b', border: '1px solid #334155', borderRadius: 3, color: LEVEL_COLORS[filterLevel], fontFamily: 'var(--font-mono)' }}>
            {LEVELS.map(l => <option key={l} value={l} style={{ color: LEVEL_COLORS[l] }}>{l}+</option>)}
          </select>

          {/* Text search */}
          <input
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Search logs..."
            style={{ width: 150, fontSize: 10, padding: '2px 6px', background: '#1e293b', border: '1px solid #334155', borderRadius: 3, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}
          />

          {/* Module filter */}
          <input
            value={filterModule}
            onChange={e => setFilterModule(e.target.value)}
            placeholder="Module..."
            style={{ width: 90, fontSize: 10, padding: '2px 6px', background: '#1e293b', border: '1px solid #334155', borderRadius: 3, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}
          />

          {/* Auto-scroll indicator */}
          <button onClick={() => setAutoScroll(!autoScroll)} title="Toggle auto-scroll"
            style={{ fontSize: 10, padding: '2px 6px', background: autoScroll ? '#14532d' : '#1e293b', border: '1px solid #334155', borderRadius: 3, color: autoScroll ? '#4ade80' : '#64748b', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
            ⬇ {autoScroll ? 'Auto' : 'Paused'}
          </button>

          {/* Actions */}
          <button onClick={copyAll} style={{ fontSize: 10, padding: '2px 6px', background: '#1e293b', border: '1px solid #334155', borderRadius: 3, color: '#94a3b8', cursor: 'pointer' }} title="Copy all visible logs">
            {copiedAll ? '✓ Copied' : '⎘ Copy'}
          </button>
          <button onClick={downloadLog} style={{ fontSize: 10, padding: '2px 6px', background: '#1e293b', border: '1px solid #334155', borderRadius: 3, color: '#94a3b8', cursor: 'pointer' }} title="Download log file">
            ⬇ File
          </button>
          <button onClick={clearLogs} style={{ fontSize: 10, padding: '2px 6px', background: '#1e293b', border: '1px solid #334155', borderRadius: 3, color: '#f87171', cursor: 'pointer' }} title="Clear buffer">
            ✕ Clear
          </button>
          {wsStatus !== 'connected' && (
            <button onClick={connect} style={{ fontSize: 10, padding: '2px 6px', background: '#14532d', border: '1px solid #22c55e55', borderRadius: 3, color: '#4ade80', cursor: 'pointer' }}>
              Reconnect
            </button>
          )}
          <button onClick={() => setPanelOpen(false)} style={{ fontSize: 14, padding: '0 6px', background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }} title="Close (backtick)">
            ×
          </button>
        </div>
      </div>

      {/* Log rows */}
      <div ref={scrollRef} className="error-panel__body">
        {filteredLogs.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', fontSize: 12 }}>
            {wsStatus === 'connected' ? 'No log entries match the current filter.' : 'Connecting to log stream...'}
          </div>
        ) : (
          filteredLogs.map((entry, i) => (
            <LogRow key={entry.id || i} entry={entry} index={i} />
          ))
        )}
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '3px 10px', borderTop: '1px solid #1a2332', background: '#0a0e17', gap: 16 }}>
        <span style={{ fontSize: 9, color: '#475569', fontFamily: 'var(--font-mono)' }}>
          Press <kbd style={{ padding: '0 4px', background: '#1e293b', borderRadius: 2, border: '1px solid #334155' }}>`</kbd> to toggle · Hover to pause scroll · Click ERROR row to expand traceback
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#475569', fontFamily: 'var(--font-mono)' }}>
          {errorCount} error{errorCount !== 1 ? 's' : ''} · {totalLogs} total
        </span>
      </div>
    </div>
  );
}
