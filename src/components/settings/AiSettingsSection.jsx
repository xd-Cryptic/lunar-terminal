/**
 * AiSettingsSection — AI model configuration for the Settings page.
 * Model settings, system prompts, and Ollama connection test.
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from '../../utils/api';

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

// ── Prompt types available in the system ─────────────────────────────────────
const PROMPT_TYPES = [
  { key: 'analysis',  label: 'Analysis',    desc: 'Comprehensive symbol analysis prompt' },
  { key: 'signal',    label: 'Signal',      desc: 'Buy/sell/hold signal generation' },
  { key: 'news',      label: 'News',        desc: 'News article sentiment analysis' },
  { key: 'sector',    label: 'Sector',      desc: 'Sector rotation and macro analysis' },
  { key: 'chart',     label: 'Chart',       desc: 'Technical chart pattern recognition' },
];

const inputStyle = {
  padding: '6px 10px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  width: '100%',
};

export default function AiSettingsSection() {
  // ── State ────────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState({
    model: '',
    temperature: 0.1,
    maxTokens: 2048,
    ollamaUrl: 'http://localhost:11434',
  });
  const [prompts, setPrompts] = useState({});
  const [expandedPrompt, setExpandedPrompt] = useState(null);
  const [connStatus, setConnStatus] = useState(null); // null | 'testing' | 'ok' | 'fail'
  const [saveStatus, setSaveStatus] = useState(null);  // null | 'saving' | 'saved' | 'error'
  const [promptSaveStatus, setPromptSaveStatus] = useState({});

  // ── Load config on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // Fetch AI config from backend
        const [deviceData, modelsData] = await Promise.allSettled([
          api.getDeviceInfo(),
          api.listAiModels(),
        ]);

        if (cancelled) return;

        if (deviceData.status === 'fulfilled') {
          setConfig(prev => ({
            ...prev,
            model: deviceData.value?.model || prev.model,
            ollamaUrl: deviceData.value?.ollama_url || prev.ollamaUrl,
            temperature: deviceData.value?.temperature ?? prev.temperature,
            maxTokens: deviceData.value?.max_tokens ?? prev.maxTokens,
          }));
        }

        // Initialize default prompts
        const defaultPrompts = {};
        PROMPT_TYPES.forEach(p => {
          defaultPrompts[p.key] = '';
        });
        setPrompts(defaultPrompts);
      } catch { /* backend unreachable */ }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const testConnection = useCallback(async () => {
    setConnStatus('testing');
    try {
      const result = await api.listAiModels();
      setConnStatus(result && !result.error ? 'ok' : 'fail');
    } catch {
      setConnStatus('fail');
    }
    setTimeout(() => setConnStatus(null), 4000);
  }, []);

  const saveConfig = useCallback(async () => {
    setSaveStatus('saving');
    try {
      // Save via analysis endpoint with updated config
      // The backend reads from settings; we persist preferences locally
      localStorage.setItem('lunar_ai_config', JSON.stringify(config));
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
    setTimeout(() => setSaveStatus(null), 2000);
  }, [config]);

  const savePrompt = useCallback(async (key) => {
    setPromptSaveStatus(s => ({ ...s, [key]: 'saving' }));
    try {
      localStorage.setItem(`lunar_prompt_${key}`, prompts[key] || '');
      setPromptSaveStatus(s => ({ ...s, [key]: 'saved' }));
    } catch {
      setPromptSaveStatus(s => ({ ...s, [key]: 'error' }));
    }
    setTimeout(() => setPromptSaveStatus(s => ({ ...s, [key]: null })), 2000);
  }, [prompts]);

  const resetPrompt = useCallback((key) => {
    setPrompts(p => ({ ...p, [key]: '' }));
    localStorage.removeItem(`lunar_prompt_${key}`);
  }, []);

  // ── Load persisted prompts from localStorage ────────────────────────────────
  useEffect(() => {
    const loaded = {};
    PROMPT_TYPES.forEach(p => {
      const saved = localStorage.getItem(`lunar_prompt_${p.key}`);
      if (saved) loaded[p.key] = saved;
    });
    if (Object.keys(loaded).length) {
      setPrompts(prev => ({ ...prev, ...loaded }));
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  const connColor = connStatus === 'ok' ? 'var(--green)' : connStatus === 'fail' ? 'var(--red)' : 'var(--amber)';
  const connLabel = connStatus === 'testing' ? 'Testing...' : connStatus === 'ok' ? 'Connected' : connStatus === 'fail' ? 'Failed' : 'Test Connection';

  return (
    <Section title="AI Settings">
      <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue)44', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
        AI analysis uses local Ollama models. Temperature and token limits affect all AI-powered features (analysis, signals, news sentiment, RAG generation).
      </div>

      {/* ── Model Settings ─────────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 12, marginTop: 8 }}>
        Model Configuration
      </div>

      <FieldRow label="Current Model" hint="Set via OLLAMA_MODEL in backend .env">
        <div style={{
          ...inputStyle,
          background: 'var(--bg-tertiary)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{config.model || 'qwen3:2b'}</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>via Ollama</span>
        </div>
      </FieldRow>

      <FieldRow label="Temperature" hint="0 = deterministic, 2 = creative. Default: 0.1">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={0} max={2} step={0.05}
            value={config.temperature}
            onChange={e => setConfig(c => ({ ...c, temperature: parseFloat(e.target.value) }))}
            style={{ flex: 1 }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, width: 40, textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
            {config.temperature.toFixed(2)}
          </span>
        </div>
      </FieldRow>

      <FieldRow label="Max Tokens" hint="Response length limit (256-8192)">
        <input
          type="number"
          min={256} max={8192} step={128}
          value={config.maxTokens}
          onChange={e => {
            const v = Math.max(256, Math.min(8192, parseInt(e.target.value) || 2048));
            setConfig(c => ({ ...c, maxTokens: v }));
          }}
          style={inputStyle}
        />
      </FieldRow>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 24 }}>
        <button
          className={`btn btn--sm ${saveStatus === 'saved' ? 'btn--success' : 'btn--primary'}`}
          onClick={saveConfig}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Save Model Settings'}
        </button>
      </div>

      {/* ── System Prompts ─────────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 12, marginTop: 8 }}>
        System Prompts
      </div>

      <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)44', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
        Custom system prompts override the defaults for each AI task. Leave blank to use built-in prompts.
      </div>

      {PROMPT_TYPES.map(pt => {
        const isExpanded = expandedPrompt === pt.key;
        const status = promptSaveStatus[pt.key];
        return (
          <div key={pt.key} style={{ marginBottom: 8, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedPrompt(isExpanded ? null : pt.key)}
              style={{
                width: '100%', padding: '10px 14px', background: isExpanded ? 'var(--blue-bg)' : 'var(--bg-tertiary)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                color: isExpanded ? 'var(--blue)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: 0.6, transition: 'transform 150ms', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>
                {'>'}
              </span>
              <span>{pt.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>{pt.desc}</span>
              {prompts[pt.key] && (
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>CUSTOM</span>
              )}
            </button>
            {isExpanded && (
              <div style={{ padding: 12, background: 'var(--bg-secondary)' }}>
                <textarea
                  value={prompts[pt.key] || ''}
                  onChange={e => setPrompts(p => ({ ...p, [pt.key]: e.target.value }))}
                  placeholder={`Enter custom ${pt.label.toLowerCase()} system prompt...`}
                  rows={6}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    minHeight: 80,
                    lineHeight: 1.5,
                    fontSize: 11,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    className={`btn btn--sm ${status === 'saved' ? 'btn--success' : 'btn--primary'}`}
                    onClick={() => savePrompt(pt.key)}
                    disabled={status === 'saving'}
                  >
                    {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : 'Save'}
                  </button>
                  <button
                    className="btn btn--sm"
                    onClick={() => resetPrompt(pt.key)}
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Connection ─────────────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 12, marginTop: 24 }}>
        Connection
      </div>

      <FieldRow label="Ollama URL" hint="Set via OLLAMA_BASE_URL in backend .env">
        <div style={{
          ...inputStyle,
          background: 'var(--bg-tertiary)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--text-primary)' }}>{config.ollamaUrl || 'http://localhost:11434'}</span>
        </div>
      </FieldRow>

      <div style={{ marginTop: 12 }}>
        <button
          className={`btn btn--sm ${connStatus === 'ok' ? 'btn--success' : connStatus === 'fail' ? '' : 'btn--primary'}`}
          onClick={testConnection}
          disabled={connStatus === 'testing'}
          style={connStatus === 'fail' ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined}
        >
          {connStatus === 'testing' && (
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: '1.5px solid var(--amber)', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite', marginRight: 6 }} />
          )}
          {connStatus === 'ok' && <span style={{ color: connColor, marginRight: 4 }}>&#x2713;</span>}
          {connStatus === 'fail' && <span style={{ color: connColor, marginRight: 4 }}>&#x2717;</span>}
          {connLabel}
        </button>
        {connStatus === 'fail' && (
          <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 6 }}>
            Could not reach Ollama. Ensure it is running: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>ollama serve</code>
          </div>
        )}
      </div>
    </Section>
  );
}
