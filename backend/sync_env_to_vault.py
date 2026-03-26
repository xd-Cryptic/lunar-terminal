"""
Sync backend/.env API keys to Supabase Vault.

One-time or on-demand script to push all API keys from the local .env
into Supabase Vault for server-side encrypted storage.

Usage:
    cd backend
    python sync_env_to_vault.py

Requires: SUPABASE_URL and SUPABASE_SECRET in .env
The SUPABASE_SECRET (service role key) bypasses RLS to store secrets
directly into Vault via PostgREST RPC.
"""

import os
import sys
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SECRET = os.getenv("SUPABASE_SECRET", "")

if not SUPABASE_URL or not SUPABASE_SECRET:
    print("ERROR: SUPABASE_URL and SUPABASE_SECRET must be set in .env")
    sys.exit(1)

# Keys to sync — map from .env var name to vault service name
ENV_KEYS_TO_SYNC = {
    "ALPACA_API_KEY": "alpaca_api_key",
    "ALPACA_SECRET_KEY": "alpaca_secret_key",
    "ALPACA_BASE_URL": "alpaca_base_url",
    "ALPACA_LIVE_KEY": "alpaca_live_key",
    "ALPACA_LIVE_SECRET": "alpaca_live_secret",
    "ALPACA_LIVE_BASE_URL": "alpaca_live_base_url",
    "BINANCE_API_KEY": "binance_api_key",
    "BINANCE_SECRET_KEY": "binance_secret_key",
    "OANDA_API_KEY": "oanda_api_key",
    "OANDA_ACCOUNT_ID": "oanda_account_id",
    "TWELVE_DATA_API_KEY": "twelve_data_api_key",
    "FINNHUB_API_KEY": "finnhub_api_key",
    "FINNHUB_SECRET_KEY": "finnhub_secret_key",
    "FRED_API_KEY": "fred_api_key",
    "OPENAI_API_KEY": "openai_api_key",
    "OLLAMA_BASE_URL": "ollama_base_url",
    "OLLAMA_MODEL": "ollama_model",
}

HEADERS = {
    "apikey": SUPABASE_SECRET,
    "Authorization": f"Bearer {SUPABASE_SECRET}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def store_vault_secret(service: str, secret: str, description: str = "") -> bool:
    """Store a secret in Vault via the RPC function."""
    url = f"{SUPABASE_URL}/rest/v1/rpc/vault_store_secret"
    payload = {
        "p_service": service,
        "p_secret": secret,
        "p_description": description or f"{service} (synced from .env)",
    }
    try:
        resp = httpx.post(url, json=payload, headers=HEADERS, timeout=15)
        if resp.status_code in (200, 201):
            return True
        print(f"  WARN: {service} — HTTP {resp.status_code}: {resp.text[:200]}")
        return False
    except Exception as e:
        print(f"  ERROR: {service} — {e}")
        return False


def store_vault_secret_direct(service: str, secret: str, description: str = "") -> bool:
    """Fallback: store directly into vault.secrets table via PostgREST.
    Used when the RPC functions haven't been deployed yet.
    """
    url = f"{SUPABASE_URL}/rest/v1/rpc/vault_store_secret"
    # If RPC fails, try direct SQL via the Supabase SQL endpoint
    # This requires the service role key
    sql_url = f"{SUPABASE_URL}/rest/v1/rpc/vault_store_secret"
    payload = {
        "p_service": service,
        "p_secret": secret,
        "p_description": description or f"{service} (synced from .env)",
    }
    try:
        resp = httpx.post(sql_url, json=payload, headers=HEADERS, timeout=15)
        return resp.status_code in (200, 201)
    except:
        return False


def main():
    print("=" * 60)
    print("  Lunar Terminal — Sync .env Keys to Supabase Vault")
    print("=" * 60)
    print(f"\n  Supabase URL: {SUPABASE_URL}")
    print(f"  Keys to sync: {len(ENV_KEYS_TO_SYNC)}")
    print()

    synced = []
    skipped = []
    failed = []

    for env_var, vault_service in ENV_KEYS_TO_SYNC.items():
        value = os.getenv(env_var, "")
        if not value or value.startswith("your_") or value == "":
            skipped.append(env_var)
            print(f"  SKIP  {env_var} (empty or placeholder)")
            continue

        ok = store_vault_secret(vault_service, value, f"{env_var} from backend/.env")
        if ok:
            synced.append(env_var)
            # Mask the value for display
            masked = value[:4] + "..." + value[-4:] if len(value) > 12 else "****"
            print(f"  OK    {env_var} → vault:{vault_service} [{masked}]")
        else:
            failed.append(env_var)
            print(f"  FAIL  {env_var}")

    print()
    print("-" * 60)
    print(f"  Synced:  {len(synced)}")
    print(f"  Skipped: {len(skipped)} (empty/placeholder)")
    print(f"  Failed:  {len(failed)}")

    if failed:
        print(f"\n  Failed keys: {', '.join(failed)}")
        print("  Make sure you've run the Vault SQL schema in Supabase Dashboard:")
        print("  → SQL Editor → paste supabase_schema.sql → Run")
    else:
        print("\n  All keys synced successfully!")

    print("=" * 60)


if __name__ == "__main__":
    main()
