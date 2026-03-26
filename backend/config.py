"""Centralised configuration loaded from .env file."""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",          # ← silently ignore any extra .env keys
    )

    # ── Alpaca ────────────────────────────────────────────────────
    alpaca_api_key: str = ""
    alpaca_secret_key: str = ""
    alpaca_base_url: str = "https://paper-api.alpaca.markets"

    # Alpaca Live (second account slot)
    alpaca_live_key: str = ""
    alpaca_live_secret: str = ""
    alpaca_live_base_url: str = "https://api.alpaca.markets"

    # ── Binance ───────────────────────────────────────────────────
    binance_api_key: str = ""
    binance_secret_key: str = ""

    # ── OANDA ─────────────────────────────────────────────────────
    oanda_api_key: str = ""
    oanda_account_id: str = ""
    oanda_mt4_server: str = ""

    # ── Market Data ───────────────────────────────────────────────
    twelve_data_api_key: str = ""

    # ── News & Macro ──────────────────────────────────────────────
    finnhub_api_key: str = ""
    finnhub_secret_key: str = ""
    ft_api_key: str = ""
    fred_api_key: str = ""

    # ── AI ────────────────────────────────────────────────────────
    openai_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:2b"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_temperature: float = 0.1
    ollama_max_tokens: int = 2048

    # ── Supabase ──────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_secret: str = ""
    supabase_direct_connection_string: str = ""

    # ── App ───────────────────────────────────────────────────────
    backend_port: int = 8787
    log_level: str = "info"
    trading_mode: str = "demo"  # demo | paper | live


settings = Settings()


def get_device():
    """Return the best available compute device (CUDA > MPS > CPU).
    Lazy-imports torch so the backend starts even if torch isn't installed yet.
    """
    try:
        import torch
        if torch.cuda.is_available():
            return torch.device("cuda")
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")
    except ImportError:
        return "cpu"  # torch not installed — fine for non-ML routes


DEVICE = get_device()
