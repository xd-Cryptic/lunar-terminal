"""Simple file-backed config override system for the Lunar Terminal.

Stores runtime overrides (AI settings, system prompts, etc.) in a JSON file
that persists across server restarts.  Designed to be imported lazily inside
route handlers so the backend starts even if the file doesn't exist yet.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger("terminal.config_overrides")

OVERRIDES_FILE = Path(__file__).parent.parent / "config_overrides.json"

DEFAULT_SYSTEM_PROMPTS: dict[str, str] = {
    "analysis": (
        "You are a Senior Quantitative Analyst at a top-tier hedge fund. "
        "Provide precise, risk-adjusted analysis based on all available data. "
        "Structure your response as JSON with keys: summary, signal (BUY/SELL/HOLD), "
        "confidence (0-100), key_levels (support/resistance), risk_assessment, "
        "reasoning (2-3 sentences). Be concise and data-driven."
    ),
    "signal": (
        "You are a trading signal generator. Respond with ONLY valid JSON: "
        '{"signal": "BUY"|"SELL"|"HOLD", "confidence": 0-100, "reason": "one sentence"}. '
        "No explanation outside JSON."
    ),
    "news": (
        "Analyze this financial news headline for a trader. Determine the likely "
        "impact on the stock price (positive, negative, neutral), the magnitude "
        "(low, medium, high), and the timeframe of impact (immediate, short-term, "
        "long-term). Respond as concise JSON."
    ),
    "sector": (
        "You are a sector analyst at a research firm. Recommend the top stocks "
        "from the given sector based on technical momentum, relative strength, "
        "and risk/reward ratio. Rank by overall attractiveness for the specified "
        "trading style. Respond as JSON with a ranked list."
    ),
    "chart": (
        "You are a technical chart analyst. Analyze the chart patterns, key "
        "support and resistance levels, trend direction, and momentum indicators. "
        "Identify specific buy and sell zones with risk/reward ratios. "
        "Provide your analysis as structured JSON."
    ),
}


def load_overrides() -> dict:
    """Load the entire overrides dict from disk. Returns empty dict if missing."""
    try:
        if OVERRIDES_FILE.exists():
            return json.loads(OVERRIDES_FILE.read_text())
    except Exception as exc:
        logger.warning("Failed to load config overrides: %s", exc)
    return {}


def save_overrides(data: dict) -> None:
    """Persist overrides dict to disk."""
    try:
        OVERRIDES_FILE.write_text(json.dumps(data, indent=2))
    except Exception as exc:
        logger.error("Failed to save config overrides: %s", exc)


def get_override(section: str, key: str, default=None):
    """Read a single value from the override file."""
    overrides = load_overrides()
    return overrides.get(section, {}).get(key, default)


def set_override(section: str, key: str, value) -> None:
    """Write a single value into the override file."""
    overrides = load_overrides()
    overrides.setdefault(section, {})[key] = value
    save_overrides(overrides)


def get_system_prompt(prompt_type: str) -> str:
    """Return the active system prompt — override if present, else default."""
    return get_override(
        "system_prompts",
        prompt_type,
        DEFAULT_SYSTEM_PROMPTS.get(prompt_type, ""),
    )


def set_system_prompt(prompt_type: str, prompt: str) -> None:
    """Persist a custom system prompt."""
    set_override("system_prompts", prompt_type, prompt)
