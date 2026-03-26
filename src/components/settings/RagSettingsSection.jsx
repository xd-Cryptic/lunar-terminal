/**
 * RagSettingsSection — RAG engine configuration for the Settings page.
 * Status display, scheduler controls, watchlist management, manual triggers.
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from '../../utils/api';
import useAutoRefresh from '../../hooks/useAutoRefresh';

// ── Inline helpers (same pattern as SettingsPage) ────────────────────────────
function Section({ title, children }) {
  return (
    <div className="settings-section">
      <h3 className="settings-section__title">{title}</h3>
      {children}
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const inputStyle = {
  padding: '6px 10px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
};

// ── Task definitions ─────────────────────────────────────────────────────────
const TASKS = [
  { key: 'news',    label: 'News Ingest',       desc: 'Ingest latest news into RAG store' },
  { key: 'market',  label: 'Market Data',        desc: 'Ingest real-time market context' },
  { key: 'persist', label: 'Persist to Supabase', desc: 'Flush live entries to persistent store' },
];

export default function RagSettingsSection() {
  // ── State ────────────────────────────────────────────────────────────────────
  const [ragInfo, setRagInfo] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [intervals, setIntervals] = useState({});
  const [watchlistInput, setWatchlistInput] = useState('');
  const [triggerStatus, setTriggerStatus] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const [watchlistSaveStatus, setWatchlistSaveStatus] = useState(null);

  // ── Fetch RAG status (auto-refresh every 15s) ──────────────────────────────
  useAutoRefresh(async () => {
    try {
      const [statusResult, scheduleResult] = await Promise.allSettled([
        api.ragStatus(),
        api.ragScheduleStatus(),
      ]);

      if (statusResult.status === 'fulfilled') {
        setRagInfo(statusResult.value);
      }
      if (scheduleResult.status === 'fulfilled') {
        const sched = scheduleResult.value;
        setSchedule(sched);
        // Initialize intervals from schedule data (only on first load)
        if (sched?.tasks && !Object.keys(intervals).length) {
          const initial = {};
          Object.entries(sched.tasks).forEach(([key, task]) => {
            initial[key] = Math.round((task.interval_seconds || 300) / 60);
          });
          setIntervals(initial);
        }
        // Initialize watchlist
        if (sched?.watchlist && !watchlistInput) {
          setWatchlistInput(sched.watchlist.join(', '));
        }
      }
    } catch { /* backend offline */ }
  }, 15000);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const triggerTask = useCallback(async (taskKey) => {
    setTriggerStatus(s => ({ ...s, [taskKey]: 'running' }));
    try {
      await api.ragScheduleTrigger(taskKey);
      setTriggerStatus(s => ({ ...s, [taskKey]: 'done' }));
    } catch {
      setTriggerStatus(s => ({ ...s, [taskKey]: 'error' }));
    }
    setTimeout(() => setTriggerStatus(s => ({ ...s, [taskKey]: null })), 3000);
  }, []);

  const triggerAll = useCallback(async () => {
    for (const t of TASKS) {
      await triggerTask(t.key);
    }
  }, [triggerTask]);

  const saveSchedule = useCallback(async () => {
    setSaveStatus('saving');
    try {
      // Convert minutes to seconds for the API
      const configPayload = {};
      Object.entries(intervals).forEach(([key, mins]) => {
        configPayload[key] = Math.max(60, mins * 60);
      });
      await api.ragScheduleConfigure(configPayload);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
    setTimeout(() => setSaveStatus(null), 2000);
  }, [intervals]);

  const saveWatchlist = useCallback(async () => {
    setWatchlistSaveStatus('saving');
    try {
      const symbols = watchlistInput
        .split(/[,\s]+/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
      await api.ragScheduleWatchlist(symbols);
      setWatchlistSaveStatus('saved');
    } catch {
      setWatchlistSaveStatus('error');
    }
    setTimeout(() => setWatchlistSaveStatus(null), 2000);
  }, [watchlistInput]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const supabaseOk = ragInfo?.supabase_configured;

  return (
    <Section title="RAG Settings">
      <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue)44', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
        RAG (Retrieval Augmented Generation) enriches AI analysis with live market data, news, and historical context.
        The scheduler automatically ingests data at configurable intervals.
      </div>

      {/* ── Status ─────────────────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 12, marginTop: 8 }}>
        Status
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20, padding: 16, background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Live Entries</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {ragInfo?.live_entries ?? '--'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Embed Model</div>
          <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {ragInfo?.embed_model || '--'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gen Model</div>
          <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {ragInfo?.model || '--'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Supabase</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: supabaseOk ? 'var(--green)' : 'var(--amber)',
              display: 'inline-block',
              boxShadow: `0 0 6px ${supabaseOk ? 'var(--green)' : 'var(--amber)'}`,
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: supabaseOk ? 'var(--green)' : 'var(--amber)' }}>
              {supabaseOk ? 'CONNECTED' : 'LOCAL ONLY'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Schedule ───────────────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 12, marginTop: 8 }}>
        Scheduler
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {TASKS.map(task => {
          const taskData = schedule?.tasks?.[task.key] || {};
          const isActive = taskData.active !== false;
          const tStatus = triggerStatus[task.key];
          const lastRun = taskData.last_run
            ? new Date(taskData.last_run).toLocaleString()
            : 'Never';

          return (
            <div key={task.key} style={{
              padding: 14, borderRadius: 8,
              border: `1px solid ${isActive ? 'var(--border)' : 'var(--border)'}`,
              background: 'var(--bg-tertiary)',
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: isActive ? 'var(--green)' : 'var(--text-dim)',
                    display: 'inline-block',
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{task.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{task.desc}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 10 }}>
                  <div>
                    <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>Interval (min)</div>
                    <input
                      type="number"
                      min={1}
                      value={intervals[task.key] || ''}
                      onChange={e => setIntervals(i => ({ ...i, [task.key]: parseInt(e.target.value) || 1 }))}
                      style={{ ...inputStyle, width: 80, fontSize: 11, padding: '4px 8px' }}
                    />
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>Last Run</div>
                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: 10 }}>
                      {lastRun}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>Entries Ingested</div>
                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {taskData.entries_ingested ?? '--'}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <button
                  className={`btn btn--sm ${tStatus === 'done' ? 'btn--success' : tStatus === 'error' ? '' : 'btn--primary'}`}
                  onClick={() => triggerTask(task.key)}
                  disabled={tStatus === 'running'}
                  style={tStatus === 'error' ? { borderColor: 'var(--red)', color: 'var(--red)' } : { minWidth: 80 }}
                >
                  {tStatus === 'running' ? 'Running...' : tStatus === 'done' ? 'Done' : tStatus === 'error' ? 'Failed' : 'Trigger'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          className={`btn btn--sm ${saveStatus === 'saved' ? 'btn--success' : 'btn--primary'}`}
          onClick={saveSchedule}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Schedule Saved' : saveStatus === 'error' ? 'Save Failed' : 'Save Schedule'}
        </button>
        <button
          className="btn btn--sm btn--primary"
          onClick={triggerAll}
        >
          Trigger All
        </button>
      </div>

      {/* ── Watchlist ──────────────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 12, marginTop: 8 }}>
        RAG Watchlist
      </div>

      <FieldRow label="Symbols" hint="Comma-separated list of symbols the RAG scheduler monitors">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={watchlistInput}
            onChange={e => setWatchlistInput(e.target.value)}
            placeholder="AAPL, MSFT, NVDA, GOOGL, TSLA, BTC-USD, ETH-USD"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            className={`btn btn--sm ${watchlistSaveStatus === 'saved' ? 'btn--success' : 'btn--primary'}`}
            onClick={saveWatchlist}
            disabled={watchlistSaveStatus === 'saving'}
          >
            {watchlistSaveStatus === 'saving' ? 'Saving...' : watchlistSaveStatus === 'saved' ? 'Saved' : 'Update'}
          </button>
        </div>
      </FieldRow>

      {schedule?.watchlist?.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {schedule.watchlist.map(sym => (
            <span key={sym} style={{
              padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
              fontFamily: 'var(--font-mono)', background: 'var(--blue-bg)',
              color: 'var(--blue)', border: '1px solid var(--blue)33',
            }}>
              {sym}
            </span>
          ))}
        </div>
      )}
    </Section>
  );
}
