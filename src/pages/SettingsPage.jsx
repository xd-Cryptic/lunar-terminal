/**
 * SettingsPage — Full-screen settings overlay.
 * Sections: User Profiles | API Keys | Account Connections | Display | Risk & Algos
 */

import React, { useState, lazy, Suspense } from 'react';
import useStore from '../store/useStore';

const AiSettingsSection = lazy(() => import('../components/settings/AiSettingsSection'));
const RagSettingsSection = lazy(() => import('../components/settings/RagSettingsSection'));

const SECTIONS = ['Users', 'API Keys', 'Accounts', 'AI Settings', 'RAG Settings', 'Display', 'Risk & Algos'];

// ── Helpers ───────────────────────────────────────────────────────
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

// ── Section: Users ────────────────────────────────────────────────
function UsersSection() {
  const { users, updateUser, activeUser, setActiveUser } = useStore();
  const COLORS = ['#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

  return (
    <Section title="User Profiles">
      <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue)44', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
        Two profiles share the same app — same settings, same accounts. The active user badge is for context only.
      </div>
      {['A', 'B'].map(key => {
        const u = users[key];
        const isActive = activeUser === key;
        return (
          <div key={key} style={{
            padding: 16, borderRadius: 8, marginBottom: 12,
            border: `2px solid ${isActive ? u.color : 'var(--border)'}`,
            background: isActive ? `${u.color}0a` : 'var(--bg-tertiary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'white' }}>
                {u.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? u.color : 'var(--text-primary)' }}>
                  User {key} {isActive && <span style={{ fontSize: 10, color: u.color, marginLeft: 6 }}>● ACTIVE</span>}
                </div>
              </div>
              <button
                className={`btn btn--sm ${isActive ? '' : 'btn--primary'}`}
                onClick={() => setActiveUser(key)}
                disabled={isActive}
              >
                {isActive ? 'Current' : `Switch to ${key}`}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
              <input
                style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}
                value={u.name}
                placeholder={`User ${key} name...`}
                onChange={e => updateUser(key, { name: e.target.value, initials: e.target.value?.[0]?.toUpperCase() || key })}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => updateUser(key, { color: c })}
                    style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: u.color === c ? '2px solid white' : 'none', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </Section>
  );
}

// ── Section: API Keys ─────────────────────────────────────────────
function ApiKeysSection() {
  const { apiKeyStatus, setApiKeyStatus } = useStore();
  const [shown, setShown] = useState({});
  const [values, setValues] = useState({});
  const [saved, setSaved] = useState({});

  const services = [
    { id: 'alpaca',      label: 'Alpaca (Stocks — Paper)',    placeholder: 'PKXXXXXXXXXXXXXXXXXX',      hint: 'Paper: paper-api.alpaca.markets · Live: api.alpaca.markets' },
    { id: 'alpaca_live', label: 'Alpaca (Stocks — Live)',     placeholder: 'AKXXXXXXXXXXXXXXXXXX',      hint: 'Only after paper trading validated for 2+ weeks' },
    { id: 'binance',     label: 'Binance (Crypto)',           placeholder: '64-char key...',             hint: 'Enable Spot only · Disable Withdrawals · IP whitelist' },
    { id: 'oanda',       label: 'OANDA (Forex)',              placeholder: 'xxxxxxxx-xxxx-xxxx-...',    hint: 'Practice: api-fxpractice.oanda.com · Live: api-fxtrade.oanda.com' },
    { id: 'twelve_data', label: 'Twelve Data (Real-time)',    placeholder: '32-char key...',             hint: '800 calls/day free — enough for swing trading' },
    { id: 'finnhub',     label: 'Finnhub (News)',             placeholder: 'd6xxxxxxxxxxxx',            hint: '60 calls/min free' },
    { id: 'openai',      label: 'OpenAI (Optional backup)',   placeholder: 'sk-xxxxxxxxxx...',           hint: 'Optional — Ollama is used first (free, local)' },
  ];

  const save = (id) => {
    setSaved(s => ({ ...s, [id]: true }));
    setApiKeyStatus(id, !!values[id]);
    setTimeout(() => setSaved(s => ({ ...s, [id]: false })), 2000);
    // In Electron, this would call ipcRenderer.send('write-env', { key: ..., value: values[id] })
    if (window.electronAPI?.writeEnv) {
      window.electronAPI.writeEnv(id.toUpperCase() + '_API_KEY', values[id]);
    }
  };

  return (
    <Section title="API Keys">
      <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)44', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
        🔐 Keys are encrypted with your passphrase before sync to Supabase. They are never stored in plaintext in the cloud.
      </div>
      {services.map(svc => (
        <FieldRow key={svc.id} label={svc.label} hint={svc.hint}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={shown[svc.id] ? 'text' : 'password'}
              placeholder={svc.placeholder}
              value={values[svc.id] || ''}
              onChange={e => setValues(v => ({ ...v, [svc.id]: e.target.value }))}
              style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-secondary)', border: `1px solid ${apiKeyStatus[svc.id] ? 'var(--green)' : 'var(--border)'}`, borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
            />
            <button className="btn btn--sm btn--icon" onClick={() => setShown(s => ({ ...s, [svc.id]: !s[svc.id] }))} title="Show/hide">
              {shown[svc.id] ? '🙈' : '👁'}
            </button>
            <button className={`btn btn--sm ${saved[svc.id] ? 'btn--success' : 'btn--primary'}`} onClick={() => save(svc.id)}>
              {saved[svc.id] ? '✓ Saved' : 'Save'}
            </button>
            {apiKeyStatus[svc.id] && <span style={{ fontSize: 16, alignSelf: 'center' }}>✅</span>}
          </div>
        </FieldRow>
      ))}
    </Section>
  );
}

// ── Section: Accounts ─────────────────────────────────────────────
function AccountsSection() {
  const { accounts, activeAccountSlot, setActiveAccountSlot, updateAccount, tradingMode, setTradingMode } = useStore();
  const badgeColors = { DEMO: '#3b82f6', PAPER: '#f59e0b', LIVE: '#ef4444' };

  const modeDescriptions = {
    demo:  '🔵 DEMO — Internal simulation only. No broker connection. Zero risk.',
    paper: '🟡 PAPER — Connected to broker paper account. Real data, simulated fills. No real money.',
    live:  '🔴 LIVE — Real money. All 7 kill-switch layers active. Requires validation.',
  };

  return (
    <Section title="Account Connections">
      {/* Global trading mode */}
      <FieldRow label="Global Trading Mode" hint="Controls all markets simultaneously">
        <div style={{ display: 'flex', gap: 8 }}>
          {['demo', 'paper', 'live'].map(m => {
            const colors = { demo: 'var(--blue)', paper: 'var(--amber)', live: 'var(--red)' };
            const bgs    = { demo: 'var(--blue-bg)', paper: 'var(--amber-bg)', live: 'var(--red-bg)' };
            const isActive = tradingMode === m;
            return (
              <button key={m} onClick={() => {
                if (m === 'live') {
                  const code = prompt('⚠️ LIVE TRADING: Type CONFIRM-LIVE to enable real money trading:');
                  if (code !== 'CONFIRM-LIVE') return;
                }
                setTradingMode(m);
              }}
                style={{
                  padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 11,
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  background: isActive ? bgs[m] : 'var(--bg-tertiary)',
                  color: isActive ? colors[m] : 'var(--text-dim)',
                  border: `2px solid ${isActive ? colors[m] : 'var(--border)'}`,
                }}>
                {m}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>{modeDescriptions[tradingMode]}</div>
      </FieldRow>

      {/* Per-market account slots */}
      <div style={{ marginTop: 16 }}>
        {Object.entries(accounts).map(([market, slots]) => (
          <div key={market} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              {market}
              <span style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'none', fontWeight: 400 }}>— select which account is active</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {slots.map(acct => {
                const isActive = activeAccountSlot[market] === acct.slot;
                const badgeColor = badgeColors[acct.badge?.type] || '#64748b';
                return (
                  <div key={acct.id} style={{
                    padding: 14, borderRadius: 8,
                    border: `2px solid ${isActive ? badgeColor : 'var(--border)'}`,
                    background: isActive ? `${badgeColor}0f` : 'var(--bg-tertiary)',
                    position: 'relative',
                  }}>
                    {/* Mode badge */}
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <span style={{
                        fontSize: 9, padding: '2px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontWeight: 800,
                        background: `${badgeColor}22`, color: badgeColor,
                        border: `1px solid ${badgeColor}55`,
                      }}>
                        {acct.badge?.type}
                      </span>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <input
                        style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}
                        value={acct.name}
                        onChange={e => updateAccount(market, acct.slot, { name: e.target.value })}
                      />
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        Broker: <strong style={{ color: 'var(--text-secondary)' }}>{acct.broker}</strong>
                        {acct.balance && ` · Balance: $${acct.balance.toLocaleString()}`}
                      </div>
                    </div>

                    {/* DEMO/PAPER/LIVE descriptions */}
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.4 }}>
                      {acct.badge?.type === 'DEMO'  && '🔵 Internal simulation — no broker connection, fully safe'}
                      {acct.badge?.type === 'PAPER' && '🟡 Paper account — real market data, simulated fills, no real money'}
                      {acct.badge?.type === 'LIVE'  && '🔴 Live account — real money moves, 7-layer kill-switch active'}
                    </div>

                    <button
                      className={`btn btn--sm ${isActive ? 'btn--success' : 'btn--primary'}`}
                      style={{ width: '100%' }}
                      onClick={() => setActiveAccountSlot(market, acct.slot)}
                    >
                      {isActive ? '✓ Active Account' : 'Set as Active'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Section: Display ──────────────────────────────────────────────
function DisplaySection() {
  const { displayMode, setDisplayMode } = useStore();

  return (
    <Section title="Display & Layout">
      <FieldRow label="Monitor Mode" hint="Multi-monitor opens a second window for news/safety panels">
        <div style={{ display: 'flex', gap: 10 }}>
          {['single', 'multi'].map(m => (
            <button key={m} onClick={() => setDisplayMode(m)}
              style={{
                padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                background: displayMode === m ? 'var(--blue-bg)' : 'var(--bg-tertiary)',
                color: displayMode === m ? 'var(--blue)' : 'var(--text-secondary)',
                border: `2px solid ${displayMode === m ? 'var(--blue)' : 'var(--border)'}`,
              }}>
              {m === 'single' ? '🖥 Single Monitor' : '🖥🖥 Multi-Monitor'}
            </button>
          ))}
        </div>
        {displayMode === 'multi' && (
          <div style={{ marginTop: 10 }}>
            <button className="btn btn--primary btn--sm" onClick={() => window.electronAPI?.openSecondaryWindow?.()}>
              Open Secondary Window →
            </button>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>News, Sentiment, and Safety panels open in the second window</div>
          </div>
        )}
      </FieldRow>
    </Section>
  );
}

// ── Section: Risk & Algos ─────────────────────────────────────────
function RiskAlgosSection() {
  const { riskSettings, updateRiskSettings, fundAllocation, setFundAllocation } = useStore();

  const total = Object.values(fundAllocation).reduce((a, b) => a + b, 0);

  return (
    <Section title="Risk & Algorithm Settings">
      {Object.entries(riskSettings).map(([market, rs]) => (
        <div key={market} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>{market}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { key: 'riskPct',       label: 'Risk per trade (%)', max: 10 },
              { key: 'dailyLossLimit', label: 'Daily loss limit (%)', max: 20 },
              { key: 'maxDrawdown',   label: 'Max drawdown (%)', max: 30 },
            ].map(({ key, label, max }) => (
              <div key={key}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="range" min={0.1} max={max} step={0.1} value={rs[key]}
                    onChange={e => updateRiskSettings(market, { [key]: parseFloat(e.target.value) })}
                    style={{ flex: 1 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, width: 36, textAlign: 'right' }}>{rs[key]}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
          Fund Allocation
          <span style={{ marginLeft: 8, fontSize: 10, color: total !== 100 ? 'var(--red)' : 'var(--green)' }}>
            Total: {total}% {total !== 100 && '⚠ must equal 100%'}
          </span>
        </div>
        {Object.entries(fundAllocation).map(([k, v]) => {
          const colors = { stocks: '#3b82f6', crypto: '#a855f7', forex: '#22c55e', cash: '#64748b' };
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 60, fontSize: 11, textTransform: 'capitalize', color: colors[k] }}>{k}</span>
              <input type="range" min={0} max={100} value={v}
                onChange={e => setFundAllocation({ [k]: Number(e.target.value) })}
                style={{ flex: 1 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, width: 36 }}>{v}%</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── Main SettingsPage ─────────────────────────────────────────────
export default function SettingsPage() {
  const { setAppMode, prevMode } = useStore();
  const [activeSection, setActiveSection] = useState('Users');

  const sectionIcons = { 'Users': '👤', 'API Keys': '🔑', 'Accounts': '🏦', 'AI Settings': '◈', 'RAG Settings': '◉', 'Display': '🖥', 'Risk & Algos': '⚖️' };

  const renderSection = () => {
    switch (activeSection) {
      case 'Users':      return <UsersSection />;
      case 'API Keys':   return <ApiKeysSection />;
      case 'Accounts':   return <AccountsSection />;
      case 'AI Settings': return <Suspense fallback={<div style={{ padding: 20, color: 'var(--text-dim)' }}>Loading...</div>}><AiSettingsSection /></Suspense>;
      case 'RAG Settings': return <Suspense fallback={<div style={{ padding: 20, color: 'var(--text-dim)' }}>Loading...</div>}><RagSettingsSection /></Suspense>;
      case 'Display':    return <DisplaySection />;
      case 'Risk & Algos': return <RiskAlgosSection />;
      default: return null;
    }
  };

  return (
    <div className="settings-layout">
      {/* Left nav */}
      <div className="settings-nav">
        <div style={{ padding: '16px 16px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Settings
        </div>
        {SECTIONS.map(s => (
          <button key={s} className={`settings-nav-item ${activeSection === s ? 'settings-nav-item--active' : ''}`} onClick={() => setActiveSection(s)}>
            <span style={{ marginRight: 8 }}>{sectionIcons[s]}</span>{s}
          </button>
        ))}
        <div style={{ marginTop: 'auto', padding: 16 }}>
          <button className="btn btn--sm" style={{ width: '100%' }} onClick={() => setAppMode(prevMode || 'advanced')}>
            ← Back to {prevMode === 'simple' ? 'Simple View' : 'Terminal'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="settings-content">
        {renderSection()}
      </div>
    </div>
  );
}
