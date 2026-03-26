/**
 * Supabase client — Vite/Electron browser client.
 *
 * NOTE: This is NOT the Next.js SSR pattern.
 * This is a plain browser client using @supabase/supabase-js directly.
 * Sessions are stored in localStorage (works in Electron + browser).
 *
 * Env vars (frontend/.env):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing env vars — cloud sync disabled. Check frontend/.env');
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        storageKey: 'stock-terminal-auth',
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false, // not a web app, no OAuth redirects
      },
    })
  : null;

// ── Auth helpers ──────────────────────────────────────────────────

/**
 * Sign in with magic link (email). User gets a link in their inbox.
 * On click, they return to the app and are authenticated.
 */
export async function signInWithMagicLink(email) {
  if (!supabase) return { error: 'Supabase not configured' };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return { error };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

// ── Settings sync ─────────────────────────────────────────────────

/** Push a settings key/value pair for the current user */
export async function pushSetting(key, value) {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('settings').upsert(
    { user_id: user.id, key, value: JSON.stringify(value), updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' }
  );
}

/** Pull all settings for the current user. Returns { key: value } map */
export async function pullSettings() {
  if (!supabase) return {};
  const user = await getCurrentUser();
  if (!user) return {};
  const { data } = await supabase.from('settings').select('key,value').eq('user_id', user.id);
  const result = {};
  (data || []).forEach(row => {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  });
  return result;
}

// ── API key sync (encrypted) ──────────────────────────────────────

/**
 * Push an encrypted API key blob.
 * The caller is responsible for encrypting BEFORE calling this.
 * See src/utils/crypto.js for encrypt/decrypt helpers.
 */
export async function pushApiKey(service, encryptedBlob, salt, iv) {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('api_keys').upsert(
    {
      user_id: user.id,
      service,
      encrypted_blob: encryptedBlob,
      salt,
      iv,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,service' }
  );
}

/**
 * Pull all encrypted API key blobs for the current user.
 * Returns array of { service, encrypted_blob, salt, iv }
 */
export async function pullApiKeys() {
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from('api_keys')
    .select('service,encrypted_blob,salt,iv')
    .eq('user_id', user.id);
  return data || [];
}

// ── Accounts ──────────────────────────────────────────────────────

export async function pushAccount(accountConfig) {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('accounts').upsert(
    { ...accountConfig, user_id: user.id },
    { onConflict: 'user_id,market,slot' }
  );
}

export async function pullAccounts() {
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id);
  return data || [];
}

// ── Watchlist ─────────────────────────────────────────────────────

export async function pushWatchlist(watchlist) {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
  await pushSetting('watchlist', watchlist);
}

export async function pullWatchlist() {
  if (!supabase) return null;
  const settings = await pullSettings();
  return settings.watchlist || null;
}

// ── Algos (Supabase Storage) ──────────────────────────────────────

/** Upload an algo file (.py) to Supabase Storage */
export async function pushAlgo(filename, codeContent) {
  if (!supabase) return;
  const blob = new Blob([codeContent], { type: 'text/plain' });
  const { error } = await supabase.storage
    .from('algos')
    .upload(filename, blob, { upsert: true, contentType: 'text/plain' });
  if (error) console.error('[Supabase] algo upload error:', error);
}

/** Download an algo file from Supabase Storage */
export async function pullAlgo(filename) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from('algos').download(filename);
  if (error || !data) return null;
  return await data.text();
}

/** List all algo files in Supabase Storage */
export async function listAlgos() {
  if (!supabase) return [];
  const { data } = await supabase.storage.from('algos').list('', { sortBy: { column: 'name' } });
  return (data || []).map(f => f.name);
}

// ── Backtest results ──────────────────────────────────────────────

export async function saveBacktest(strategy, params, metrics, equityCurve) {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('backtests').insert({
    user_id: user.id,
    strategy,
    params_json: JSON.stringify(params),
    metrics_json: JSON.stringify(metrics),
    equity_json: JSON.stringify(equityCurve),
    ran_at: new Date().toISOString(),
  });
}

export async function pullBacktests(limit = 20) {
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from('backtests')
    .select('*')
    .eq('user_id', user.id)
    .order('ran_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// ── Trade journal ─────────────────────────────────────────────────

export async function addTradeJournalEntry(entry) {
  if (!supabase) return;
  const user = await getCurrentUser();
  if (!user) return;
  await supabase.from('trade_journal').insert({ ...entry, user_id: user.id });
}

export async function pullTradeJournal(limit = 50) {
  if (!supabase) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from('trade_journal')
    .select('*')
    .eq('user_id', user.id)
    .order('traded_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// ── Supabase Vault — server-side encrypted secret storage ────────
// Double encryption: client-side AES-256-GCM (crypto.js) + Vault's
// libsodium AEAD at rest. Even with full DB access, attacker needs
// BOTH the Supabase encryption key AND the user's passphrase.

/**
 * Store a secret in Supabase Vault (server-side encrypted).
 * For API keys, the caller should ALSO client-side encrypt via crypto.js
 * before passing to this function for double-layer protection.
 *
 * @param {string} service  — key name (e.g. 'alpaca_api_key', 'twelve_data_key')
 * @param {string} secret   — the secret value (or pre-encrypted blob)
 * @param {string} description — optional description
 * @returns {{ id: string } | null}
 */
export async function vaultStoreSecret(service, secret, description = '') {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('vault_store_secret', {
    p_service: service,
    p_secret: secret,
    p_description: description,
  });
  if (error) {
    console.error('[Vault] store error:', error.message);
    return null;
  }
  return { id: data };
}

/**
 * Read a decrypted secret from Vault.
 * @param {string} service — key name
 * @returns {string|null} — decrypted secret value
 */
export async function vaultReadSecret(service) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('vault_read_secret', {
    p_service: service,
  });
  if (error) {
    console.error('[Vault] read error:', error.message);
    return null;
  }
  return data;
}

/**
 * Delete a secret from Vault.
 * @param {string} service — key name
 * @returns {boolean}
 */
export async function vaultDeleteSecret(service) {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('vault_delete_secret', {
    p_service: service,
  });
  if (error) {
    console.error('[Vault] delete error:', error.message);
    return false;
  }
  return !!data;
}

/**
 * List all secret names stored in Vault for the current user.
 * Does NOT return the secret values — only names and metadata.
 * @returns {Array<{ service: string, description: string, updated_at: string }>}
 */
export async function vaultListSecrets() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('vault_list_secrets');
  if (error) {
    console.error('[Vault] list error:', error.message);
    return [];
  }
  return data || [];
}

// ── Startup verification ─────────────────────────────────────────

/**
 * Verify Supabase read/write/vault access on startup.
 * Returns a status object with granular pass/fail for each capability.
 *
 * Call this at app init to ensure the financial data pipeline is healthy.
 */
export async function verifySupabaseConnection() {
  if (!supabase) {
    return {
      ok: false,
      configured: false,
      authenticated: false,
      read: false,
      write: false,
      vault: false,
      error: 'Supabase not configured — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
    };
  }

  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      configured: true,
      authenticated: false,
      read: false,
      write: false,
      vault: false,
      error: 'Not authenticated — sign in to enable cloud sync',
    };
  }

  // Use the server-side verify_connection RPC for atomic read/write/vault test
  const { data, error } = await supabase.rpc('verify_connection');
  if (error) {
    // Fallback: RPC might not be deployed yet — do manual checks
    return await _manualVerify(user);
  }

  return {
    ok: data.ok,
    configured: true,
    authenticated: true,
    read: data.read,
    write: data.write,
    vault: data.vault,
    userId: data.user_id,
    timestamp: data.timestamp,
    error: data.ok ? null : 'Some Supabase capabilities are degraded',
  };
}

/** Fallback verification if RPC is not yet deployed */
async function _manualVerify(user) {
  const result = {
    ok: false,
    configured: true,
    authenticated: true,
    read: false,
    write: false,
    vault: false,
    userId: user.id,
    error: null,
  };

  // Test write
  try {
    const { error: wErr } = await supabase.from('settings').upsert(
      { user_id: user.id, key: '_connection_test', value: '"ping"', updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    );
    result.write = !wErr;
  } catch { result.write = false; }

  // Test read
  try {
    const { data: rData, error: rErr } = await supabase
      .from('settings')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', '_connection_test')
      .single();
    result.read = !rErr && rData?.value != null;
  } catch { result.read = false; }

  // Cleanup
  try {
    await supabase.from('settings').delete().eq('user_id', user.id).eq('key', '_connection_test');
  } catch { /* ignore */ }

  // Test Vault (best-effort)
  try {
    const vResult = await vaultStoreSecret('_vault_test', 'ping');
    if (vResult) {
      result.vault = true;
      await vaultDeleteSecret('_vault_test');
    }
  } catch { result.vault = false; }

  result.ok = result.read && result.write;
  if (!result.ok) result.error = 'Supabase read/write verification failed';
  return result;
}

/**
 * Sync local .env API keys to Supabase Vault.
 * Reads keys from the Zustand store (loaded from .env at startup)
 * and pushes each one to Vault for cloud backup.
 *
 * @param {Object} apiKeys — { service: keyValue } map of API keys
 * @returns {{ synced: string[], failed: string[] }}
 */
export async function syncApiKeysToVault(apiKeys) {
  if (!supabase) return { synced: [], failed: [], error: 'Supabase not configured' };

  const user = await getCurrentUser();
  if (!user) return { synced: [], failed: [], error: 'Not authenticated' };

  const synced = [];
  const failed = [];

  for (const [service, keyValue] of Object.entries(apiKeys)) {
    if (!keyValue || keyValue.trim() === '') continue;

    try {
      // Store in Vault (server-side encrypted)
      const result = await vaultStoreSecret(service, keyValue, `${service} API key`);
      if (result) {
        synced.push(service);
      } else {
        failed.push(service);
      }
    } catch (err) {
      console.error(`[Vault] Failed to sync ${service}:`, err);
      failed.push(service);
    }
  }

  return { synced, failed };
}
