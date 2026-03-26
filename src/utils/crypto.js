/**
 * Client-side AES-256-GCM encryption for API keys.
 *
 * API keys are encrypted in the browser using a passphrase before
 * being uploaded to Supabase. The passphrase never leaves the device.
 *
 * If someone gets access to your Supabase DB, they get encrypted
 * blobs — useless without your passphrase.
 */

const PBKDF2_ITERATIONS = 310_000; // OWASP recommended minimum

/**
 * Derive an AES-256-GCM CryptoKey from a passphrase + salt.
 * @param {string} passphrase
 * @param {Uint8Array} salt
 */
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Convert Uint8Array → base64 string for storage */
function toBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/** Convert base64 string → Uint8Array */
function fromBase64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/**
 * Encrypt an API key string with the given passphrase.
 * Returns { encryptedBlob, salt, iv } — all base64 strings safe to store.
 *
 * @param {string} plaintext  — the raw API key
 * @param {string} passphrase — user's encryption passphrase
 */
export async function encryptApiKey(plaintext, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(passphrase, salt);

  const enc       = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  return {
    encryptedBlob: toBase64(encrypted),
    salt: toBase64(salt),
    iv:   toBase64(iv),
  };
}

/**
 * Decrypt an API key encrypted by encryptApiKey.
 *
 * @param {string} encryptedBlob — base64 ciphertext
 * @param {string} salt          — base64 salt
 * @param {string} iv            — base64 IV
 * @param {string} passphrase    — user's passphrase
 * @returns {string|null}        — plaintext API key, or null if wrong passphrase
 */
export async function decryptApiKey(encryptedBlob, salt, iv, passphrase) {
  try {
    const saltBytes      = fromBase64(salt);
    const ivBytes        = fromBase64(iv);
    const ciphertextBytes = fromBase64(encryptedBlob);
    const key            = await deriveKey(passphrase, saltBytes);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      ciphertextBytes
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null; // Wrong passphrase or corrupted data
  }
}
