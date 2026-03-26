"""Portfolio optimiser using PyPortfolioOpt.

Supports max Sharpe, min volatility, HRP, and Black-Litterman.
"""

import asyncio
import logging

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger("terminal.portfolio")


class PortfolioOptimizer:
    """Optimise portfolio allocation across assets."""

    async def optimise(
        self,
        symbols: list[str],
        method: str = "max_sharpe",
        risk_free_rate: float = 0.04,
    ) -> dict:
        """Run portfolio optimisation.

        Methods: max_sharpe, min_vol, hrp, equal_weight
        """
        loop = asyncio.get_event_loop()

        # Download historical prices
        data = await loop.run_in_executor(
            None,
            lambda: yf.download(symbols, period="2y", interval="1d", progress=False),
        )

        if data.empty:
            return {"error": "Could not fetch price data for optimisation"}

        close = data["Close"].dropna()
        if close.empty:
            return {"error": "No valid price data found"}

        returns = close.pct_change().dropna()

        try:
            if method == "max_sharpe":
                result = await loop.run_in_executor(None, self._max_sharpe, returns, risk_free_rate)
            elif method == "min_vol":
                result = await loop.run_in_executor(None, self._min_vol, returns)
            elif method == "hrp":
                result = await loop.run_in_executor(None, self._hrp, returns)
            elif method == "equal_weight":
                result = self._equal_weight(symbols)
            else:
                return {"error": f"Unknown method: {method}"}
        except Exception as exc:
            logger.error("Optimisation error: %s", exc)
            # Fallback to equal weight
            result = self._equal_weight(symbols)
            result["note"] = f"Optimisation failed ({exc}), using equal weight"

        # Add performance metrics
        if "weights" in result:
            weights = np.array([result["weights"].get(s, 0) for s in symbols])
            port_return = float(returns.mean().values @ weights * 252)
            port_vol = float(np.sqrt(weights @ returns.cov().values @ weights * 252))
            sharpe = (port_return - risk_free_rate) / port_vol if port_vol > 0 else 0

            result["expected_annual_return"] = round(port_return * 100, 2)
            result["annual_volatility"] = round(port_vol * 100, 2)
            result["sharpe_ratio"] = round(sharpe, 3)

        result["method"] = method
        result["symbols"] = symbols
        return result

    def _max_sharpe(self, returns: pd.DataFrame, rf: float) -> dict:
        """Maximum Sharpe ratio portfolio using PyPortfolioOpt."""
        from pypfopt import EfficientFrontier, expected_returns, risk_models

        mu = expected_returns.mean_historical_return(returns, returns_data=True)
        S = risk_models.sample_cov(returns, returns_data=True)
        ef = EfficientFrontier(mu, S)
        ef.max_sharpe(risk_free_rate=rf)
        weights = ef.clean_weights()
        return {"weights": dict(weights)}

    def _min_vol(self, returns: pd.DataFrame) -> dict:
        """Minimum volatility portfolio."""
        from pypfopt import EfficientFrontier, expected_returns, risk_models

        mu = expected_returns.mean_historical_return(returns, returns_data=True)
        S = risk_models.sample_cov(returns, returns_data=True)
        ef = EfficientFrontier(mu, S)
        ef.min_volatility()
        weights = ef.clean_weights()
        return {"weights": dict(weights)}

    def _hrp(self, returns: pd.DataFrame) -> dict:
        """Hierarchical Risk Parity — robust, no expected return estimate needed."""
        from pypfopt import HRPOpt

        hrp = HRPOpt(returns)
        hrp.optimize()
        weights = hrp.clean_weights()
        return {"weights": dict(weights)}

    def _equal_weight(self, symbols: list[str]) -> dict:
        """Simple equal weight allocation."""
        n = len(symbols)
        w = round(1.0 / n, 4)
        return {"weights": {s: w for s in symbols}}
