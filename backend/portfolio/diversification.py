"""Diversification analysis and rebalancing engine.

Tracks correlation, concentration, sector/asset allocation,
and generates rebalancing suggestions.
"""

import asyncio
import logging
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger("terminal.diversification")

# Sector classifications for major tickers
SECTOR_MAP = {
    "AAPL": "Technology", "MSFT": "Technology", "GOOGL": "Technology",
    "AMZN": "Consumer Cyclical", "META": "Technology", "NVDA": "Technology",
    "TSLA": "Consumer Cyclical", "JPM": "Financial Services", "V": "Financial Services",
    "WMT": "Consumer Defensive", "JNJ": "Healthcare", "PG": "Consumer Defensive",
    "XOM": "Energy", "CVX": "Energy", "BAC": "Financial Services",
    "BTC": "Crypto", "ETH": "Crypto", "SOL": "Crypto", "XRP": "Crypto",
    "SPY": "ETF-Broad", "QQQ": "ETF-Tech", "IWM": "ETF-SmallCap",
    "VTI": "ETF-Total", "GLD": "Commodity", "TLT": "Bond",
}

ASSET_CLASS_MAP = {
    "Crypto": "Cryptocurrency",
    "ETF-Broad": "ETF", "ETF-Tech": "ETF", "ETF-SmallCap": "ETF", "ETF-Total": "ETF",
    "Commodity": "Commodity", "Bond": "Fixed Income",
}


class DiversificationManager:
    """Analyse and manage portfolio diversification."""

    async def analyse(self, holdings: dict) -> dict:
        """Full diversification analysis.

        Args:
            holdings: {symbol: {"quantity": n, "avg_price": p, "market": "stocks|crypto|forex"}}
        """
        symbols = list(holdings.keys())
        if not symbols:
            return {"error": "No holdings to analyse"}

        loop = asyncio.get_event_loop()

        # Fetch price data
        equity_symbols = [s for s in symbols if not self._is_manual(s)]
        prices = {}
        if equity_symbols:
            data = await loop.run_in_executor(
                None,
                lambda: yf.download(equity_symbols, period="1y", interval="1d", progress=False),
            )
            if not data.empty:
                prices = data["Close"].dropna()

        # Current values
        total_value = 0
        position_values = {}
        for sym, h in holdings.items():
            qty = h.get("quantity", 0)
            if sym in prices.columns and len(prices[sym]) > 0:
                current_price = float(prices[sym].iloc[-1])
            else:
                current_price = h.get("avg_price", 0)
            val = qty * current_price
            position_values[sym] = val
            total_value += val

        # Weights
        weights = {s: round(v / total_value, 4) if total_value > 0 else 0 for s, v in position_values.items()}

        # Correlation matrix
        corr_matrix = {}
        if isinstance(prices, pd.DataFrame) and len(prices.columns) >= 2:
            returns = prices.pct_change().dropna()
            corr = returns.corr()
            for sym in corr.columns:
                corr_matrix[sym] = {s: round(float(corr.loc[sym, s]), 3) for s in corr.columns}

        # Sector allocation
        sector_alloc = {}
        asset_alloc = {}
        for sym, w in weights.items():
            sector = SECTOR_MAP.get(sym, holdings[sym].get("market", "Other"))
            sector_alloc[sector] = round(sector_alloc.get(sector, 0) + w, 4)

            asset_class = ASSET_CLASS_MAP.get(sector, "Equity")
            asset_alloc[asset_class] = round(asset_alloc.get(asset_class, 0) + w, 4)

        # Concentration alerts
        alerts = []
        for sym, w in weights.items():
            if w > 0.15:
                alerts.append({
                    "type": "concentration",
                    "severity": "high" if w > 0.25 else "medium",
                    "message": f"{sym} is {w*100:.1f}% of portfolio (recommended max: 15%)",
                })
        for sector, w in sector_alloc.items():
            if w > 0.35:
                alerts.append({
                    "type": "sector_concentration",
                    "severity": "high" if w > 0.5 else "medium",
                    "message": f"{sector} sector is {w*100:.1f}% of portfolio (recommended max: 35%)",
                })

        # Beta (vs SPY)
        portfolio_beta = 0
        if isinstance(prices, pd.DataFrame) and "SPY" not in prices.columns:
            try:
                spy = await loop.run_in_executor(
                    None, lambda: yf.download("SPY", period="1y", interval="1d", progress=False)
                )
                spy_returns = spy["Close"].pct_change().dropna()
                returns = prices.pct_change().dropna()
                for sym in returns.columns:
                    if sym in weights:
                        cov = np.cov(returns[sym].values[-len(spy_returns):], spy_returns.values[-len(returns[sym]):])
                        beta = cov[0][1] / cov[1][1] if cov[1][1] != 0 else 0
                        portfolio_beta += beta * weights.get(sym, 0)
            except Exception:
                pass

        return {
            "total_value": round(total_value, 2),
            "weights": weights,
            "position_values": {k: round(v, 2) for k, v in position_values.items()},
            "correlation_matrix": corr_matrix,
            "sector_allocation": sector_alloc,
            "asset_allocation": asset_alloc,
            "concentration_alerts": alerts,
            "portfolio_beta": round(portfolio_beta, 3),
        }

    async def rebalance(self, holdings: dict, target_allocations: Optional[dict] = None) -> dict:
        """Suggest trades to rebalance portfolio.

        Args:
            holdings: Current holdings.
            target_allocations: {symbol: target_weight} — if None, uses equal weight.
        """
        analysis = await self.analyse(holdings)
        current_weights = analysis.get("weights", {})
        total_value = analysis.get("total_value", 0)

        if target_allocations is None:
            n = len(holdings)
            target_allocations = {s: round(1.0 / n, 4) for s in holdings}

        suggestions = []
        for sym in set(list(current_weights.keys()) + list(target_allocations.keys())):
            current = current_weights.get(sym, 0)
            target = target_allocations.get(sym, 0)
            diff = target - current
            if abs(diff) > 0.01:  # Only suggest if > 1% difference
                dollar_change = diff * total_value
                suggestions.append({
                    "symbol": sym,
                    "current_weight": round(current * 100, 2),
                    "target_weight": round(target * 100, 2),
                    "action": "BUY" if diff > 0 else "SELL",
                    "dollar_amount": round(abs(dollar_change), 2),
                })

        suggestions.sort(key=lambda x: abs(x["dollar_amount"]), reverse=True)

        return {
            "current_weights": {k: round(v * 100, 2) for k, v in current_weights.items()},
            "target_weights": {k: round(v * 100, 2) for k, v in target_allocations.items()},
            "suggestions": suggestions,
            "total_value": total_value,
        }

    @staticmethod
    def _is_manual(symbol: str) -> bool:
        """Check if this is a manually-tracked position (e.g. Revolut)."""
        return symbol.startswith("MANUAL:")
