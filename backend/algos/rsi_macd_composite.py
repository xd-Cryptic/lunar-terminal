"""Example built-in algorithm: RSI + MACD Composite for swing trading.

This serves as a reference for how to create plugin algorithms.
Drop any .py file in the backend/algos/ directory following this pattern.

Note: migrated from pandas-ta to the `ta` library for Python 3.14 compatibility.
"""

import pandas as pd
import ta as ta_lib

from algos.base import Algorithm, Signal


class RSIMACDComposite(Algorithm):
    """Composite RSI + MACD swing trading algorithm.

    Generates buy signals when:
    - RSI < oversold AND MACD crosses bullish
    - Or RSI recovering from oversold with momentum

    Generates sell signals when:
    - RSI > overbought AND MACD crosses bearish
    """

    name = "RSI-MACD Composite"
    description = "Swing trading signals combining RSI oversold/overbought with MACD crossovers"
    markets = ["stocks", "crypto", "forex", "etf"]
    frequency = "lft"
    version = "1.0.0"
    parameters = {
        "rsi_length": 14,
        "rsi_oversold": 30,
        "rsi_overbought": 70,
        "macd_fast": 12,
        "macd_slow": 26,
        "macd_signal": 9,
    }

    def generate_signals(self, df: pd.DataFrame, params: dict = None) -> list[Signal]:
        p = {**self.parameters, **(params or {})}

        rsi = ta_lib.momentum.RSIIndicator(df["close"], window=p["rsi_length"]).rsi()
        macd_obj = ta_lib.trend.MACD(
            df["close"],
            window_fast=p["macd_fast"],
            window_slow=p["macd_slow"],
            window_sign=p["macd_signal"],
        )
        macd_line = macd_obj.macd()
        signal_line = macd_obj.macd_signal()

        if macd_line is None or rsi is None:
            return []

        signals = []
        for i in range(2, len(df)):
            reasons = []
            score = 0

            # RSI check
            r = rsi.iloc[i]
            if pd.notna(r):
                if r < p["rsi_oversold"]:
                    score += 1
                    reasons.append(f"RSI oversold ({r:.1f})")
                elif r > p["rsi_overbought"]:
                    score -= 1
                    reasons.append(f"RSI overbought ({r:.1f})")

            # MACD crossover
            if pd.notna(macd_line.iloc[i]) and pd.notna(signal_line.iloc[i]):
                if macd_line.iloc[i] > signal_line.iloc[i] and macd_line.iloc[i - 1] <= signal_line.iloc[i - 1]:
                    score += 1
                    reasons.append("MACD bullish crossover")
                elif macd_line.iloc[i] < signal_line.iloc[i] and macd_line.iloc[i - 1] >= signal_line.iloc[i - 1]:
                    score -= 1
                    reasons.append("MACD bearish crossover")

            if abs(score) >= 2:
                price = float(df["close"].iloc[i])
                atr_series = ta_lib.volatility.AverageTrueRange(
                    df["high"], df["low"], df["close"], window=14
                ).average_true_range()
                atr_val = float(atr_series.iloc[i]) if atr_series is not None and len(atr_series) > i and pd.notna(atr_series.iloc[i]) else price * 0.02

                signals.append(Signal(
                    symbol=df.index[i].isoformat() if hasattr(df.index[i], "isoformat") else "",
                    side="BUY" if score > 0 else "SELL",
                    strength=min(abs(score) / 3.0, 1.0),
                    price=price,
                    stop_loss=round(price - atr_val * 1.5, 4) if score > 0 else round(price + atr_val * 1.5, 4),
                    take_profit=round(price + atr_val * 3, 4) if score > 0 else round(price - atr_val * 3, 4),
                    reasons=reasons,
                ))

        return signals
