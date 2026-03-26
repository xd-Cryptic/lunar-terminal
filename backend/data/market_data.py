"""Market data service — fetches quotes, history, and screening data.

Data Sources:
    - yfinance:    Historical OHLCV (free, all markets)
    - Twelve Data: Real-time streaming (free tier 800/day)
    - Binance:     Crypto real-time + execution
    - OANDA:       Forex real-time + execution
    - Alpaca:      US stocks real-time + paper trading
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
import pandas as pd
import yfinance as yf
from cachetools import TTLCache

from config import settings

logger = logging.getLogger("terminal.market")

# Cache quotes for 5 seconds to avoid hammering APIs
_quote_cache: TTLCache = TTLCache(maxsize=500, ttl=5)
_history_cache: TTLCache = TTLCache(maxsize=200, ttl=300)


class MarketDataService:
    """Unified market data abstraction across multiple providers."""

    def __init__(self):
        self._http = httpx.AsyncClient(timeout=15)

    # ── Quotes ────────────────────────────────────────────────────

    async def get_quote(self, symbol: str) -> dict:
        """Get current quote for any symbol. Uses cache to minimise API calls."""
        key = symbol.upper()
        if key in _quote_cache:
            return _quote_cache[key]

        # Route to the right provider
        if self._is_crypto(key):
            quote = await self._binance_quote(key)
        elif self._is_forex(key):
            quote = await self._oanda_quote(key)
        else:
            quote = await self._yf_quote(key)

        _quote_cache[key] = quote
        return quote

    async def _yf_quote(self, symbol: str) -> dict:
        """Fetch quote via yfinance (stocks, ETFs)."""
        loop = asyncio.get_event_loop()
        ticker = yf.Ticker(symbol)
        info = await loop.run_in_executor(None, lambda: ticker.info)
        return {
            "symbol": symbol,
            "price": info.get("currentPrice") or info.get("regularMarketPrice", 0),
            "change": info.get("regularMarketChange", 0),
            "change_pct": info.get("regularMarketChangePercent", 0),
            "volume": info.get("regularMarketVolume", 0),
            "high": info.get("dayHigh", 0),
            "low": info.get("dayLow", 0),
            "open": info.get("regularMarketOpen", 0),
            "prev_close": info.get("previousClose", 0),
            "market_cap": info.get("marketCap", 0),
            "name": info.get("shortName", symbol),
            "source": "yfinance",
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def _binance_quote(self, symbol: str) -> dict:
        """Fetch crypto quote from Binance."""
        pair = symbol.replace("/", "").replace("-", "").upper()
        if not pair.endswith("USDT"):
            pair = pair + "USDT"
        try:
            resp = await self._http.get(
                f"https://api.binance.com/api/v3/ticker/24hr",
                params={"symbol": pair},
            )
            data = resp.json()
            return {
                "symbol": symbol,
                "price": float(data.get("lastPrice", 0)),
                "change": float(data.get("priceChange", 0)),
                "change_pct": float(data.get("priceChangePercent", 0)),
                "volume": float(data.get("volume", 0)),
                "high": float(data.get("highPrice", 0)),
                "low": float(data.get("lowPrice", 0)),
                "open": float(data.get("openPrice", 0)),
                "prev_close": float(data.get("prevClosePrice", 0)),
                "market_cap": 0,
                "name": pair,
                "source": "binance",
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as exc:
            logger.error("Binance quote error for %s: %s", symbol, exc)
            return {"symbol": symbol, "price": 0, "error": str(exc)}

    async def _oanda_quote(self, symbol: str) -> dict:
        """Fetch forex quote from OANDA."""
        instrument = symbol.replace("/", "_").upper()
        if not settings.oanda_api_key:
            return {"symbol": symbol, "price": 0, "error": "OANDA API key not set"}
        try:
            resp = await self._http.get(
                f"https://api-fxpractice.oanda.com/v3/instruments/{instrument}/candles",
                params={"count": 1, "granularity": "S5"},
                headers={"Authorization": f"Bearer {settings.oanda_api_key}"},
            )
            data = resp.json()
            candle = data["candles"][-1]["mid"]
            return {
                "symbol": symbol,
                "price": float(candle["c"]),
                "high": float(candle["h"]),
                "low": float(candle["l"]),
                "open": float(candle["o"]),
                "source": "oanda",
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as exc:
            logger.error("OANDA quote error for %s: %s", symbol, exc)
            return {"symbol": symbol, "price": 0, "error": str(exc)}

    # ── Historical Data ───────────────────────────────────────────

    async def get_history(self, symbol: str, period: str = "1y", interval: str = "1d") -> dict:
        """Fetch historical OHLCV data. Returns dict with dates, ohlcv arrays."""
        cache_key = f"{symbol}:{period}:{interval}"
        if cache_key in _history_cache:
            return _history_cache[cache_key]

        loop = asyncio.get_event_loop()
        ticker = yf.Ticker(symbol)
        df: pd.DataFrame = await loop.run_in_executor(
            None, lambda: ticker.history(period=period, interval=interval)
        )

        if df.empty:
            return {"symbol": symbol, "data": [], "error": "No data found"}

        result = {
            "symbol": symbol,
            "period": period,
            "interval": interval,
            "data": [
                {
                    "date": idx.isoformat(),
                    "open": round(row["Open"], 4),
                    "high": round(row["High"], 4),
                    "low": round(row["Low"], 4),
                    "close": round(row["Close"], 4),
                    "volume": int(row["Volume"]),
                }
                for idx, row in df.iterrows()
            ],
        }
        _history_cache[cache_key] = result
        return result

    # ── Search ────────────────────────────────────────────────────

    async def search(self, query: str) -> list[dict]:
        """Search for ticker symbols using yfinance."""
        loop = asyncio.get_event_loop()
        try:
            results = await loop.run_in_executor(None, lambda: yf.Tickers(query))
            return [{"symbol": query.upper(), "name": query}]
        except Exception:
            return []

    # ── Screener ──────────────────────────────────────────────────

    async def screen(
        self,
        market_type: str = "stocks",
        min_volume: Optional[int] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
    ) -> list[dict]:
        """Basic screener — returns top instruments by volume."""
        # Default popular tickers per market
        defaults = {
            "stocks": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "WMT"],
            "crypto": ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "DOT", "MATIC", "LINK"],
            "forex": ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "EUR/GBP"],
            "etf": ["SPY", "QQQ", "IWM", "VTI", "VOO", "ARKK", "XLF", "XLE", "GLD", "TLT"],
        }
        symbols = defaults.get(market_type, defaults["stocks"])
        results = []
        for sym in symbols:
            q = await self.get_quote(sym)
            if min_volume and q.get("volume", 0) < min_volume:
                continue
            price = q.get("price", 0)
            if min_price and price < min_price:
                continue
            if max_price and price > max_price:
                continue
            results.append(q)
        return results

    # ── Helpers ────────────────────────────────────────────────────

    @staticmethod
    def _is_crypto(symbol: str) -> bool:
        cryptos = {"BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "DOT", "MATIC", "LINK",
                   "BNB", "SHIB", "UNI", "AAVE", "LTC", "ATOM"}
        base = symbol.split("/")[0].split("-")[0].upper().replace("USDT", "")
        return base in cryptos

    @staticmethod
    def _is_forex(symbol: str) -> bool:
        return "/" in symbol and any(
            c in symbol.upper()
            for c in ["EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"]
        )
