/**
 * AiTuningPanel -- AI analysis parameter tuning panel.
 * Used inside settings page and as a sidebar in various screens.
 * Monochrome tactical HUD aesthetic.
 */

import { useState, useEffect } from 'react';
import HudPanel from '../layout/HudPanel';

const STORAGE_KEY = 'lunar_ai_config';

const DEFAULT_SYSTEM_PROMPT =
  'You are a quantitative financial analyst at a hedge fund. Analyze the provided market data with precision.\n' +
  'Focus on: technical patterns, risk/reward ratios, market microstructure, and cross-asset correlations.\n' +
  'Provide actionable insights with specific entry/exit levels and position sizing recommendations.\n' +
  'Rate confidence on a 1-10 scale for each recommendation.';

const DEFAULT_CONFIG = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  weights: {
    technical: 40,
    fundamental: 20,
    sentiment: 25,
    macro: 15,
  },
  risk: {
    maxPositionPct: 5,
    stopLossPct: 2,
    takeProfitPct: 6,
    maxDailyLoss: 500,
    maxDrawdownPct: 10,
  },
  model: {
    ollamaModel: 'gemma3:12b',
    temperature: 0.3,
    maxTokens: 2048,
  },
  sentiment: {
    finbertThreshold: 0.6,
    ollamaFallback: true,
    batchSize: 5,
  },
};

const OLLAMA_MODELS = [
  'gemma3:12b',
  'llama3:8b',
  'mistral:7b',
  'codellama:13b',
  'phi3:14b',
  'deepseek-r1:14b',
];

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        weights: { ...DEFAULT_CONFIG.weights, ...parsed.weights },
        risk: { ...DEFAULT_CONFIG.risk, ...parsed.risk },
        model: { ...DEFAULT_CONFIG.model, ...parsed.model },
        sentiment: { ...DEFAULT_CONFIG.sentiment, ...parsed.sentiment },
      };
    }
  } catch {
    /* corrupt data -- fall through */
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* quota exceeded -- silent */
  }
}

/** Return current AI config from localStorage (usable outside React). */
export function getAiConfig() {
  return loadConfig();
}

/* ── Shared inline styles ────────────────────────────────────────── */
const labelStyle = {
  fontSize: 6,
  fontFamily: 'var(--hud-font)',
  color: 'var(--hud-text-dim)',
  letterSpacing: 2,
  textTransform: 'uppercase',
  marginBottom: 3,
};

const sectionTitleStyle = {
  fontSize: 7,
  fontFamily: 'var(--hud-font)',
  color: 'var(--hud-text-mid)',
  letterSpacing: 2,
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--hud-line)',
  paddingBottom: 4,
  marginBottom: 6,
};

const sliderTrack = {
  width: '100%',
  height: 3,
  appearance: 'none',
  WebkitAppearance: 'none',
  background: 'var(--hud-line)',
  outline: 'none',
  borderRadius: 0,
  cursor: 'pointer',
};

const valueReadout = {
  fontSize: 10,
  fontFamily: 'var(--hud-font)',
  color: 'var(--hud-text-bright)',
  letterSpacing: 1,
  minWidth: 28,
  textAlign: 'right',
};

export default function AiTuningPanel() {
  const [config, setConfig] = useState(loadConfig);
  const [promptDirty, setPromptDirty] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

  // Persist non-prompt changes immediately
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const update = (section, key, value) => {
    setConfig((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const handlePromptChange = (e) => {
    setConfig((prev) => ({ ...prev, systemPrompt: e.target.value }));
    setPromptDirty(true);
  };

  const handlePromptSave = () => {
    saveConfig(config);
    setPromptDirty(false);
  };

  const handlePromptReset = () => {
    setConfig((prev) => ({ ...prev, systemPrompt: DEFAULT_SYSTEM_PROMPT }));
    setPromptDirty(true);
  };

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json();
        const count = data.models?.length || 0;
        setTestStatus(`ok:${count}`);
      } else {
        setTestStatus('fail');
      }
    } catch {
      setTestStatus('fail');
    }
  };

  /* ── Render helpers ──────────────────────────────────────────── */

  const Slider = ({ label, value, min, max, step = 1, unit = '', onChange }) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="hud-readout__label">{label}</span>
        <span style={valueReadout}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={sliderTrack}
      />
    </div>
  );

  return (
    <HudPanel title="AI TUNING" style={{ overflow: 'auto' }}>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>

        {/* ── System Prompt ──────────────────────────────────────── */}
        <section>
          <div style={sectionTitleStyle}>SYSTEM PROMPT</div>
          <textarea
            className="hud-input"
            value={config.systemPrompt}
            onChange={handlePromptChange}
            rows={6}
            style={{
              width: '100%',
              resize: 'vertical',
              fontSize: 8,
              fontFamily: 'var(--hud-font)',
              lineHeight: 1.5,
              letterSpacing: 0.3,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button
              className="filter-pill"
              onClick={handlePromptReset}
              style={{ fontSize: 6, letterSpacing: 1 }}
            >
              RESET TO DEFAULT
            </button>
            <button
              className={`filter-pill ${promptDirty ? 'filter-pill--active' : ''}`}
              onClick={handlePromptSave}
              disabled={!promptDirty}
              style={{ fontSize: 6, letterSpacing: 1, opacity: promptDirty ? 1 : 0.4 }}
            >
              SAVE
            </button>
          </div>
        </section>

        {/* ── Analysis Weights ───────────────────────────────────── */}
        <section>
          <div style={sectionTitleStyle}>ANALYSIS WEIGHTS</div>
          <Slider
            label="TECHNICAL ANALYSIS"
            value={config.weights.technical}
            min={0} max={100}
            onChange={(v) => update('weights', 'technical', v)}
          />
          <Slider
            label="FUNDAMENTAL ANALYSIS"
            value={config.weights.fundamental}
            min={0} max={100}
            onChange={(v) => update('weights', 'fundamental', v)}
          />
          <Slider
            label="SENTIMENT ANALYSIS"
            value={config.weights.sentiment}
            min={0} max={100}
            onChange={(v) => update('weights', 'sentiment', v)}
          />
          <Slider
            label="MACRO ENVIRONMENT"
            value={config.weights.macro}
            min={0} max={100}
            onChange={(v) => update('weights', 'macro', v)}
          />
          <div style={{
            fontSize: 7,
            fontFamily: 'var(--hud-font)',
            color: config.weights.technical + config.weights.fundamental + config.weights.sentiment + config.weights.macro === 100
              ? 'var(--hud-green)' : 'var(--hud-amber)',
            letterSpacing: 1,
            textAlign: 'right',
            marginTop: 2,
          }}>
            TOTAL: {config.weights.technical + config.weights.fundamental + config.weights.sentiment + config.weights.macro}%
          </div>
        </section>

        {/* ── Risk Parameters ────────────────────────────────────── */}
        <section>
          <div style={sectionTitleStyle}>RISK PARAMETERS</div>
          <Slider
            label="MAX POSITION SIZE"
            value={config.risk.maxPositionPct}
            min={1} max={25} unit="%"
            onChange={(v) => update('risk', 'maxPositionPct', v)}
          />
          <Slider
            label="STOP LOSS"
            value={config.risk.stopLossPct}
            min={0.5} max={10} step={0.5} unit="%"
            onChange={(v) => update('risk', 'stopLossPct', v)}
          />
          <Slider
            label="TAKE PROFIT"
            value={config.risk.takeProfitPct}
            min={1} max={30} unit="%"
            onChange={(v) => update('risk', 'takeProfitPct', v)}
          />
          <Slider
            label="MAX DAILY LOSS"
            value={config.risk.maxDailyLoss}
            min={100} max={10000} step={100} unit="$"
            onChange={(v) => update('risk', 'maxDailyLoss', v)}
          />
          <Slider
            label="MAX DRAWDOWN"
            value={config.risk.maxDrawdownPct}
            min={5} max={30} unit="%"
            onChange={(v) => update('risk', 'maxDrawdownPct', v)}
          />
        </section>

        {/* ── Model Selection ────────────────────────────────────── */}
        <section>
          <div style={sectionTitleStyle}>MODEL SELECTION</div>

          <div style={{ marginBottom: 6 }}>
            <div style={labelStyle}>OLLAMA MODEL</div>
            <select
              className="hud-input"
              value={config.model.ollamaModel}
              onChange={(e) => update('model', 'ollamaModel', e.target.value)}
              style={{ width: '100%', fontSize: 8, boxSizing: 'border-box' }}
            >
              {OLLAMA_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <Slider
            label="TEMPERATURE"
            value={config.model.temperature}
            min={0} max={2} step={0.1}
            onChange={(v) => update('model', 'temperature', v)}
          />

          <div style={{ marginBottom: 6 }}>
            <div style={labelStyle}>MAX TOKENS</div>
            <input
              className="hud-input"
              type="number"
              min={256}
              max={8192}
              step={256}
              value={config.model.maxTokens}
              onChange={(e) => update('model', 'maxTokens', Number(e.target.value))}
              style={{ width: '100%', fontSize: 8, boxSizing: 'border-box' }}
            />
          </div>

          <button
            className={`filter-pill ${testStatus === 'testing' ? '' : testStatus?.startsWith('ok') ? 'filter-pill--active' : ''}`}
            onClick={testConnection}
            disabled={testStatus === 'testing'}
            style={{
              fontSize: 6,
              letterSpacing: 1,
              width: '100%',
              textAlign: 'center',
              color: testStatus === 'fail' ? 'var(--hud-red)' : testStatus?.startsWith('ok') ? 'var(--hud-green)' : undefined,
            }}
          >
            {testStatus === 'testing'
              ? 'TESTING...'
              : testStatus === 'fail'
                ? 'CONNECTION FAILED'
                : testStatus?.startsWith('ok')
                  ? `CONNECTED (${testStatus.split(':')[1]} MODELS)`
                  : 'TEST CONNECTION'}
          </button>
        </section>

        {/* ── Sentiment Analysis Config ──────────────────────────── */}
        <section>
          <div style={sectionTitleStyle}>SENTIMENT ANALYSIS</div>

          <Slider
            label="FINBERT CONFIDENCE THRESHOLD"
            value={config.sentiment.finbertThreshold}
            min={0} max={1} step={0.05}
            onChange={(v) => update('sentiment', 'finbertThreshold', v)}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={config.sentiment.ollamaFallback}
              onChange={(e) => update('sentiment', 'ollamaFallback', e.target.checked)}
              style={{ accentColor: 'var(--hud-text-mid)', width: 10, height: 10 }}
            />
            <span className="hud-readout__label" style={{ marginBottom: 0 }}>ENABLE OLLAMA FALLBACK</span>
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={labelStyle}>BATCH SIZE</div>
            <input
              className="hud-input"
              type="number"
              min={1}
              max={50}
              value={config.sentiment.batchSize}
              onChange={(e) => update('sentiment', 'batchSize', Number(e.target.value))}
              style={{ width: '100%', fontSize: 8, boxSizing: 'border-box' }}
            />
          </div>
        </section>

      </div>
    </HudPanel>
  );
}
