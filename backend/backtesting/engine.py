"""Backtesting engine.

Supports multiple strategies, variable capital, fee/slippage modelling,
and batch-runs across different capital levels.
Uses vectorised calculations for speed (GPU-accelerated via CuPy when available).

Note: migrated from pandas-ta to the `ta` library for Python 3.14 compatibility.
"""

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd
import ta as ta_lib

logger = logging.getLogger("terminal.backtest")


@dataclass
class BacktestResult:
    """Container for backtest output metrics."""
    strategy: str
    symbol: str
    initial_capital: float
    final_equity: float
    total_return_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    max_drawdown_pct: float
    win_rate: float
    total_trades: int
    profit_factor: float
    equity_curve: list
    trades: list


# ── Built-in Strategies ──────────────────────────────────────────

def _sma_cross_strategy(df: pd.DataFrame, params: dict) -> pd.Series:
    """SMA crossover: buy when fast > slow, sell when fast < slow."""
    fast = params.get("fast", 20)
    slow = params.get("slow", 50)
    sma_fast = df["close"].rolling(fast).mean()
    sma_slow = df["close"].rolling(slow).mean()
    signal = pd.Series(0, index=df.index)
    signal[sma_fast > sma_slow] = 1   # Long
    signal[sma_fast <= sma_slow] = -1  # Short/flat
    return signal


def _rsi_reversal_strategy(df: pd.DataFrame, params: dict) -> pd.Series:
    """RSI reversal: buy when RSI < 30, sell when RSI > 70."""
    length = params.get("length", 14)
    oversold = params.get("oversold", 30)
    overbought = params.get("overbought", 70)
    rsi = ta_lib.momentum.RSIIndicator(df["close"], window=length).rsi()
    signal = pd.Series(0, index=df.index)
    signal[rsi < oversold] = 1
    signal[rsi > overbought] = -1
    return signal


def _macd_strategy(df: pd.DataFrame, params: dict) -> pd.Series:
    """MACD crossover strategy."""
    fast = params.get("fast", 12)
    slow = params.get("slow", 26)
    sig = params.get("signal", 9)
    macd_obj = ta_lib.trend.MACD(df["close"], window_fast=fast, window_slow=slow, window_sign=sig)
    macd_line = macd_obj.macd()
    signal_line = macd_obj.macd_signal()
    if macd_line is None or signal_line is None:
        return pd.Series(0, index=df.index)
    signal = pd.Series(0, index=df.index)
    signal[macd_line > signal_line] = 1
    signal[macd_line <= signal_line] = -1
    return signal


def _bollinger_breakout_strategy(df: pd.DataFrame, params: dict) -> pd.Series:
    """Bollinger Band breakout: buy on lower band touch, sell on upper."""
    length = params.get("length", 20)
    std = params.get("std", 2.0)
    bb = ta_lib.volatility.BollingerBands(df["close"], window=length, window_dev=std)
    lower = bb.bollinger_lband()
    upper = bb.bollinger_hband()
    signal = pd.Series(0, index=df.index)
    signal[df["close"] <= lower] = 1  # Touch lower band → buy
    signal[df["close"] >= upper] = -1  # Touch upper band → sell
    return signal


def _mean_reversion_strategy(df: pd.DataFrame, params: dict) -> pd.Series:
    """Mean reversion: buy when price is N std below SMA, sell N std above."""
    window = params.get("window", 20)
    threshold = params.get("threshold", 2.0)
    sma = df["close"].rolling(window).mean()
    std = df["close"].rolling(window).std()
    z_score = (df["close"] - sma) / std
    signal = pd.Series(0, index=df.index)
    signal[z_score < -threshold] = 1
    signal[z_score > threshold] = -1
    return signal


STRATEGIES = {
    "sma_cross": {
        "fn": _sma_cross_strategy,
        "name": "SMA Crossover",
        "description": "Buy when fast SMA crosses above slow SMA",
        "default_params": {"fast": 20, "slow": 50},
    },
    "rsi_reversal": {
        "fn": _rsi_reversal_strategy,
        "name": "RSI Reversal",
        "description": "Buy on RSI oversold, sell on overbought",
        "default_params": {"length": 14, "oversold": 30, "overbought": 70},
    },
    "macd": {
        "fn": _macd_strategy,
        "name": "MACD Crossover",
        "description": "Buy on MACD bullish crossover",
        "default_params": {"fast": 12, "slow": 26, "signal": 9},
    },
    "bollinger_breakout": {
        "fn": _bollinger_breakout_strategy,
        "name": "Bollinger Breakout",
        "description": "Buy on lower band touch, sell on upper",
        "default_params": {"length": 20, "std": 2.0},
    },
    "mean_reversion": {
        "fn": _mean_reversion_strategy,
        "name": "Mean Reversion",
        "description": "Buy when price deviates N std from SMA",
        "default_params": {"window": 20, "threshold": 2.0},
    },
}


class BacktestEngine:
    """Run backtests with customisable strategies, capital, and fees."""

    def run(
        self,
        history: dict,
        strategy_name: str = "sma_cross",
        initial_capital: float = 10000.0,
        fee_pct: float = 0.001,
        params: Optional[dict] = None,
    ) -> dict:
        """Execute a backtest on historical data."""
        if strategy_name not in STRATEGIES:
            return {"error": f"Unknown strategy: {strategy_name}. Use /backtest/strategies for list."}

        strat = STRATEGIES[strategy_name]
        merged_params = {**strat["default_params"], **(params or {})}

        df = self._to_dataframe(history)
        if df.empty or len(df) < 50:
            return {"error": "Insufficient data for backtesting (need 50+ bars)"}

        # Generate signals
        signals = strat["fn"](df, merged_params)

        # Simulate trades
        result = self._simulate(df, signals, initial_capital, fee_pct)
        result["strategy"] = strat["name"]
        result["symbol"] = history.get("symbol", "")
        result["params"] = merged_params

        return result

    def run_batch(
        self,
        history: dict,
        strategy_name: str = "sma_cross",
        capital_levels: list[float] = None,
        fee_pct: float = 0.001,
        params: Optional[dict] = None,
    ) -> list[dict]:
        """Run same backtest across multiple capital levels."""
        if capital_levels is None:
            capital_levels = [1000, 5000, 10000, 25000, 50000, 100000]

        results = []
        for cap in capital_levels:
            r = self.run(history, strategy_name, cap, fee_pct, params)
            results.append(r)
        return results

    def list_strategies(self) -> list[dict]:
        """Return all available strategies with descriptions."""
        return [
            {
                "key": key,
                "name": strat["name"],
                "description": strat["description"],
                "default_params": strat["default_params"],
            }
            for key, strat in STRATEGIES.items()
        ]

    def _simulate(
        self,
        df: pd.DataFrame,
        signals: pd.Series,
        initial_capital: float,
        fee_pct: float,
    ) -> dict:
        """Vectorised trade simulation with fee modelling."""
        cash = initial_capital
        position = 0
        equity_curve = []
        trades = []
        entry_price = 0

        for i in range(len(df)):
            price = df["close"].iloc[i]
            sig = signals.iloc[i]

            # Calculate current equity
            equity = cash + position * price
            equity_curve.append({
                "date": df.index[i].isoformat() if hasattr(df.index[i], "isoformat") else str(df.index[i]),
                "equity": round(equity, 2),
                "price": round(price, 4),
            })

            # Enter long
            if sig == 1 and position == 0:
                shares = int(cash * 0.95 / price)  # Use 95% of cash
                if shares > 0:
                    cost = shares * price
                    fee = cost * fee_pct
                    cash -= (cost + fee)
                    position = shares
                    entry_price = price
                    trades.append({
                        "date": equity_curve[-1]["date"],
                        "type": "BUY",
                        "price": round(price, 4),
                        "shares": shares,
                        "fee": round(fee, 2),
                    })

            # Exit long
            elif sig == -1 and position > 0:
                revenue = position * price
                fee = revenue * fee_pct
                pnl = (price - entry_price) * position - fee
                cash += (revenue - fee)
                trades.append({
                    "date": equity_curve[-1]["date"],
                    "type": "SELL",
                    "price": round(price, 4),
                    "shares": position,
                    "fee": round(fee, 2),
                    "pnl": round(pnl, 2),
                })
                position = 0

        # Force close at end
        if position > 0:
            final_price = df["close"].iloc[-1]
            revenue = position * final_price
            fee = revenue * fee_pct
            cash += (revenue - fee)
            position = 0

        final_equity = cash
        total_return = ((final_equity - initial_capital) / initial_capital) * 100

        # Calculate metrics
        eq_values = [e["equity"] for e in equity_curve]
        returns = pd.Series(eq_values).pct_change().dropna()

        sharpe = float(returns.mean() / returns.std() * np.sqrt(252)) if returns.std() > 0 else 0
        downside = returns[returns < 0]
        sortino = float(returns.mean() / downside.std() * np.sqrt(252)) if len(downside) > 0 and downside.std() > 0 else 0

        # Max drawdown
        eq_series = pd.Series(eq_values)
        peak = eq_series.cummax()
        drawdown = (eq_series - peak) / peak
        max_dd = float(drawdown.min()) * 100

        calmar = total_return / abs(max_dd) if max_dd != 0 else 0

        # Win rate
        winning = [t for t in trades if t.get("type") == "SELL" and t.get("pnl", 0) > 0]
        sell_trades = [t for t in trades if t.get("type") == "SELL"]
        win_rate = len(winning) / len(sell_trades) * 100 if sell_trades else 0

        gross_profit = sum(t["pnl"] for t in winning) if winning else 0
        losing = [t for t in sell_trades if t.get("pnl", 0) <= 0]
        gross_loss = abs(sum(t["pnl"] for t in losing)) if losing else 1
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else gross_profit

        return {
            "initial_capital": initial_capital,
            "final_equity": round(final_equity, 2),
            "total_return_pct": round(total_return, 2),
            "sharpe_ratio": round(sharpe, 3),
            "sortino_ratio": round(sortino, 3),
            "calmar_ratio": round(calmar, 3),
            "max_drawdown_pct": round(max_dd, 2),
            "win_rate": round(win_rate, 1),
            "total_trades": len(sell_trades),
            "profit_factor": round(profit_factor, 2),
            "fee_pct": fee_pct,
            "equity_curve": equity_curve,
            "trades": trades,
        }

    @staticmethod
    def _to_dataframe(history: dict) -> pd.DataFrame:
        data = history.get("data", [])
        if not data:
            return pd.DataFrame()
        df = pd.DataFrame(data)
        df["date"] = pd.to_datetime(df["date"], utc=True)
        df = df.set_index("date")
        df.columns = [c.lower() for c in df.columns]
        return df
