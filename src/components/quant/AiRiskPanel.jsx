/**
 * AiRiskPanel — Live AI Analysis (qwen3:2b + RAG) + Risk Dashboard
 * Auto-analyses on symbol change. AI is always at the forefront.
 */

import { useState, useEffect, useRef } from 'react';
import useStore from '../../store/useStore';
import * as api from '../../utils/api';
import usePolling from '../../hooks/usePolling';
import HudPanel from '../layout/HudPanel';

const KILL_SWITCH_LAYERS = [
  { key: 'layer_1_paper_lock', label: 'PAPER' },
  { key: 'layer_2_risk_cap',   label: 'RISK' },
  { key: 'layer_3_daily_loss', label: 'D-LOSS' },
  { key: 'layer_4_drawdown',   label: 'DD' },
  { key: 'layer_5_positions',  label: 'POS' },
  { key: 'layer_6_heartbeat',  label: 'HB' },
  { key: 'layer_7_network',    label: 'NET' },
];

const SIGNAL_COLORS = { BUY: 'var(--hud-green)', SELL: 'var(--hud-red)', HOLD: 'var(--hud-amber)' };

export default function AiRiskPanel() {
  const {
    activeSymbol, quotes, safetyStatus, setSafetyStatus,
    riskSettings, updateRiskSettings, marketType, tradingMode,
  } = useStore();

  const [tab, setTab] = useState('ai');
  const [liveAnalysis, setLiveAnalysis] = useState(null);
  const [liveSignal, setLiveSignal] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [ragStatus, setRagStatus] = useState(null);
  const [localRisk, setLocalRisk] = useState(riskSettings[marketType]?.riskPct || 2);
  const lastSymbol = useRef('');

  const q = quotes[activeSymbol] || {};

  // Auto-fetch AI signal on symbol change
  useEffect(() => {
    if (!activeSymbol || activeSymbol === lastSymbol.current) return;
    lastSymbol.current = activeSymbol;
    let cancelled = false;

    const fetchSignal = async () => {
      try {
        const sig = await api.aiSignal(activeSymbol);
        if (!cancelled) setLiveSignal(sig);
      } catch { /* ollama not running */ }
    };
    fetchSignal();
    return () => { cancelled = true; };
  }, [activeSymbol]);

  // Poll RAG status
  usePolling(
    async () => {
      try {
        const [safety, rag] = await Promise.allSettled([
          api.getSafetyStatus(),
          api.ragStatus(),
        ]);
        if (safety.status === 'fulfilled') setSafetyStatus(safety.value);
        if (rag.status === 'fulfilled') setRagStatus(rag.value);
      } catch { /* ignore */ }
    },
    15000,
    []
  );

  const runLiveAnalysis = async () => {
    setAiLoading(true);
    setLiveAnalysis(null);
    try {
      const data = await api.liveAnalyse(activeSymbol, 'comprehensive', true);
      setLiveAnalysis(data);
    } catch (err) {
      const msg = err?.message || String(err);
      const isConn = /fetch|network|ECONNREFUSED|timeout/i.test(msg);
      setLiveAnalysis({
        analysis: {
          summary: isConn
            ? `BACKEND UNREACHABLE — ensure backend + Ollama are running.\n${msg}`
            : `ANALYSIS FAILED: ${msg}`,
        },
        error: true,
      });
    }
    setAiLoading(false);
  };

  const handleRiskSave = (val) => {
    setLocalRisk(val);
    updateRiskSettings(marketType, { riskPct: val });
  };

  const analysis = liveAnalysis?.analysis || {};

  return (
    <HudPanel title="AI / RISK" scanning={aiLoading}>
      <div className="ai-tabs">
        <button className={`filter-pill ${tab === 'ai' ? 'filter-pill--active' : ''}`} onClick={() => setTab('ai')}>
          AI LIVE
        </button>
        <button className={`filter-pill ${tab === 'risk' ? 'filter-pill--active' : ''}`} onClick={() => setTab('risk')}>
          RISK
        </button>
        <button className={`filter-pill ${tab === 'rag' ? 'filter-pill--active' : ''}`} onClick={() => setTab('rag')}>
          RAG
        </button>
      </div>

      <div className="hud-panel-body" style={{ padding: 8 }}>
        {tab === 'ai' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%' }}>
            {/* Live Signal Badge */}
            {liveSignal && !liveSignal.error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                background: 'rgba(180,185,200,0.03)', border: '1px solid var(--hud-line)',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: 2,
                  color: SIGNAL_COLORS[liveSignal.signal] || 'var(--hud-text)',
                  fontFamily: 'var(--hud-font)',
                }}>
                  {liveSignal.signal}
                </span>
                <span style={{ fontSize: 8, color: 'var(--hud-text-mid)', fontFamily: 'var(--hud-font)' }}>
                  {liveSignal.confidence}% conf
                </span>
                <span style={{ fontSize: 7, color: 'var(--hud-text-dim)', fontFamily: 'var(--hud-font)', flex: 1 }}>
                  {liveSignal.reason}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="trade-btn trade-btn--buy"
                onClick={runLiveAnalysis}
                disabled={aiLoading}
                style={{ padding: '5px 8px', fontSize: 7, letterSpacing: 2, flex: 1 }}
              >
                {aiLoading ? 'ANALYSING...' : 'DEEP ANALYSIS (RAG)'}
              </button>
              <button
                className="filter-pill"
                onClick={async () => {
                  try { const s = await api.aiSignal(activeSymbol); setLiveSignal(s); } catch {}
                }}
                style={{ fontSize: 7, padding: '4px 8px' }}
              >
                SIGNAL
              </button>
            </div>

            <div className="ai-panel-body" style={{ flex: 1, fontSize: 9, padding: 6 }}>
              {analysis.summary ? (
                <div>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{
                    typeof analysis === 'string' ? analysis : (analysis.summary || JSON.stringify(analysis, null, 2))
                  }</pre>
                  {analysis.key_levels && (
                    <div style={{ marginTop: 6, fontSize: 8, color: 'var(--hud-text-mid)' }}>
                      <div style={{ fontSize: 6, letterSpacing: 2, color: 'var(--hud-text-dim)', marginBottom: 2 }}>KEY LEVELS</div>
                      <pre>{typeof analysis.key_levels === 'string' ? analysis.key_levels : JSON.stringify(analysis.key_levels, null, 2)}</pre>
                    </div>
                  )}
                  {liveAnalysis?.rag_context_used && (
                    <div style={{ marginTop: 4, fontSize: 6, color: 'var(--hud-green)', letterSpacing: 1 }}>
                      RAG CONTEXT AUGMENTED
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--hud-text-dim)', letterSpacing: 1, fontSize: 8, textAlign: 'center', paddingTop: 12 }}>
                  <div>{ragStatus?.model || 'OLLAMA'} LIVE ANALYSIS</div>
                  <div style={{ fontSize: 7, marginTop: 4 }}>{activeSymbol} — CLICK DEEP ANALYSIS OR WAIT FOR AUTO-SIGNAL</div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 6, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)', letterSpacing: 1, display: 'flex', justifyContent: 'space-between' }}>
              <span>MODEL: {liveAnalysis?.model || ragStatus?.model || '...'}</span>
              <span>DEVICE: {liveAnalysis?.device || '...'}</span>
            </div>
          </div>
        ) : tab === 'rag' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 8, fontFamily: 'var(--hud-font)' }}>
            <div style={{ fontSize: 6, letterSpacing: 2, color: 'var(--hud-text-dim)' }}>RAG ENGINE STATUS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <div style={{ fontSize: 6, color: 'var(--hud-text-dim)', letterSpacing: 1 }}>LIVE ENTRIES</div>
                <span className="hud-value" style={{ fontSize: 14 }}>{ragStatus?.live_entries ?? '—'}</span>
              </div>
              <div>
                <div style={{ fontSize: 6, color: 'var(--hud-text-dim)', letterSpacing: 1 }}>GEN MODEL</div>
                <span style={{ fontSize: 10, color: 'var(--hud-text)' }}>{ragStatus?.model || '...'}</span>
              </div>
              <div>
                <div style={{ fontSize: 6, color: 'var(--hud-text-dim)', letterSpacing: 1 }}>EMBED MODEL</div>
                <span style={{ fontSize: 10, color: 'var(--hud-text)' }}>{ragStatus?.embed_model || '...'}</span>
              </div>
              <div>
                <div style={{ fontSize: 6, color: 'var(--hud-text-dim)', letterSpacing: 1 }}>SUPABASE</div>
                <span style={{ fontSize: 10, color: ragStatus?.supabase_configured ? 'var(--hud-green)' : 'var(--hud-amber)' }}>
                  {ragStatus?.supabase_configured ? 'CONNECTED' : 'LOCAL ONLY'}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 7, color: 'var(--hud-text-dim)', lineHeight: 1.5 }}>
              Live store: in-memory vectors (4h TTL) — real-time market + news context.
              Persistent: Supabase pgvector — historical analysis for long-term RAG retrieval.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 6, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)', marginBottom: 4, letterSpacing: 2 }}>
                KILL-SWITCH STATUS
              </div>
              <div className="kill-switch-grid">
                {KILL_SWITCH_LAYERS.map(l => {
                  const s = safetyStatus?.[l.key] || {};
                  const dotCls = !safetyStatus ? 'kill-switch-dot--dim'
                    : s.status === 'red' ? 'kill-switch-dot--fail'
                    : s.status === 'amber' ? 'kill-switch-dot--warn'
                    : 'kill-switch-dot--ok';
                  return (
                    <div key={l.key} className="kill-switch-item">
                      <span className={`kill-switch-dot ${dotCls}`} />
                      <span>{l.label}</span>
                    </div>
                  );
                })}
              </div>
              {safetyStatus?.halted && (
                <div style={{
                  marginTop: 6, padding: '4px 6px', background: 'rgba(204,51,85,0.08)',
                  fontSize: 7, color: 'var(--hud-red)', fontFamily: 'var(--hud-font)', letterSpacing: 1,
                  border: '1px solid rgba(204,51,85,0.2)',
                }}>
                  HALTED: {safetyStatus.halt_reason}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 6, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)', letterSpacing: 2 }}>
                  RISK PER TRADE ({marketType.toUpperCase()})
                </span>
                <span className={`hud-value ${localRisk > 3 ? 'hud-value--red' : ''}`} style={{ fontSize: 14 }}>
                  {localRisk}%
                </span>
              </div>
              <input
                type="range" className="risk-slider"
                min={0.5} max={5} step={0.5}
                value={localRisk}
                onChange={e => handleRiskSave(Number(e.target.value))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <div style={{ fontSize: 6, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)', marginBottom: 2, letterSpacing: 2 }}>DAILY LOSS LIMIT</div>
                <span className="hud-value hud-value--amber" style={{ fontSize: 12 }}>
                  {riskSettings[marketType]?.dailyLossLimit || 5}%
                </span>
              </div>
              <div>
                <div style={{ fontSize: 6, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)', marginBottom: 2, letterSpacing: 2 }}>MAX DRAWDOWN</div>
                <span className="hud-value hud-value--red" style={{ fontSize: 12 }}>
                  {riskSettings[marketType]?.maxDrawdown || 10}%
                </span>
              </div>
            </div>

            <div style={{ fontSize: 7, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)', textAlign: 'center', padding: '4px 0', letterSpacing: 2 }}>
              MODE: <span style={{ color: tradingMode === 'live' ? 'var(--hud-red)' : tradingMode === 'paper' ? 'var(--hud-amber)' : 'var(--hud-text)', fontWeight: 700 }}>
                {tradingMode.toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>
    </HudPanel>
  );
}
