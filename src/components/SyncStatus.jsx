/**
 * SyncStatus — cloud sync indicator with startup verification.
 * On mount: verifies Supabase read/write/vault access.
 * Shows: synced (cloud) / syncing (spinner) / degraded (partial) / offline / not-auth (lock)
 */

import React, { useEffect, useState } from 'react';
import { supabase, getCurrentUser, verifySupabaseConnection } from '../utils/supabase';

export default function SyncStatus() {
  const [status, setStatus] = useState('checking'); // checking | synced | degraded | syncing | offline | unauth
  const [verification, setVerification] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!supabase) { setStatus('offline'); return; }

    const runVerification = async () => {
      const user = await getCurrentUser();
      if (!user) {
        setStatus('unauth');
        return;
      }

      // Run full read/write/vault verification
      const result = await verifySupabaseConnection();
      setVerification(result);

      if (result.ok && result.vault) {
        setStatus('synced');
      } else if (result.ok) {
        setStatus('degraded'); // read/write OK but vault not available
      } else if (result.configured) {
        setStatus('degraded');
      } else {
        setStatus('offline');
      }

      console.log('[Supabase] Startup verification:', result);
    };

    runVerification();

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') runVerification();
      if (event === 'SIGNED_OUT') { setStatus('unauth'); setVerification(null); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const icons = {
    checking:  '\u27F3',
    synced:    '\u2601',
    degraded:  '\u26A0',
    syncing:   '\u2191',
    offline:   '\u2715',
    unauth:    '\uD83D\uDD12',
  };

  const colors = {
    checking:  'var(--text-dim)',
    synced:    'var(--green)',
    degraded:  'var(--amber)',
    syncing:   'var(--amber)',
    offline:   'var(--text-dim)',
    unauth:    'var(--amber)',
  };

  const getLabel = () => {
    if (status === 'checking') return 'Verifying Supabase connection...';
    if (status === 'unauth') return 'Not signed in \u2014 sync disabled';
    if (status === 'offline') return 'Supabase offline';
    if (status === 'syncing') return 'Syncing...';

    if (!verification) return 'Unknown';

    const parts = [];
    parts.push(`Read: ${verification.read ? '\u2713' : '\u2717'}`);
    parts.push(`Write: ${verification.write ? '\u2713' : '\u2717'}`);
    parts.push(`Vault: ${verification.vault ? '\u2713' : '\u2717'}`);
    return parts.join('  \u00B7  ');
  };

  return (
    <div
      className="sync-status"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: 'default' }}
    >
      <span
        style={{
          fontSize: 14,
          color: colors[status],
          opacity: status === 'checking' ? 0.5 : 1,
          animation: status === 'syncing' ? 'pulse 1s infinite' : 'none',
        }}
      >
        {icons[status]}
      </span>

      {showTooltip && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '6px 12px',
          fontSize: 11,
          whiteSpace: 'nowrap',
          color: 'var(--text-secondary)',
          zIndex: 1000,
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2, color: colors[status] }}>
            {status === 'synced' ? 'SUPABASE CONNECTED' :
             status === 'degraded' ? 'SUPABASE DEGRADED' :
             status === 'offline' ? 'SUPABASE OFFLINE' :
             status === 'unauth' ? 'NOT AUTHENTICATED' : 'CHECKING...'}
          </div>
          <div>{getLabel()}</div>
          {verification?.error && (
            <div style={{ color: 'var(--red)', fontSize: 10, marginTop: 2 }}>{verification.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
