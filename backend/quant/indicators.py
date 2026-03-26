"""Technical indicators engine using the `ta` library.

Calculates SMA, EMA, VWAP, RSI, MACD, Bollinger Bands, ATR, ADX,
Ichimoku, Stochastic, Williams %R, Parabolic SAR, CCI, MFI, ROC,
Keltner Channel, Donchian Channel, OBV, Fibonacci Retracement and
generates swing trading signals.

Note: migrated from pandas-ta (requires numba, broken on Python >=3.14)
to the `ta` library which is pure-Python and supports all Python versions.
"""

import logging
from typing import Optional

import pandas as pd
import ta as ta_lib

logger = logging.getLogger("terminal.quant")


class IndicatorEngine:
    """Calculate technical indicators and generate trading signals."""

    # ── Every indicator this engine can compute ──────────────────────
    ALL_INDICATORS = [
        "sma", "sma_50", "sma_200",
        "ema", "ema_26",
        "rsi", "atr", "adx", "obv", "vwap",
        "macd", "bbands",
        "ichimoku", "stochastic", "williams_r", "parabolic_sar",
        "cci", "mfi", "roc",
        "keltner", "donchian",
        "fibonacci",
    ]

    # ── Categorised indicator groups ─────────────────────────────────
    INDICATOR_GROUPS = {
        "trend": ["sma", "ema", "ichimoku", "parabolic_sar", "adx"],
        "momentum": ["rsi", "macd", "stochastic", "williams_r", "cci", "roc", "mfi"],
        "volatility": ["bbands", "keltner", "donchian", "atr"],
        "volume": ["obv", "vwap"],
        "levels": ["fibonacci"],
    }

    # ── Simple (single-series) indicators resolved via lambda ────────
    INDICATOR_MAP = {
        "sma": lambda df, **kw: ta_lib.trend.SMAIndicator(df["close"], window=kw.get("length", 20)).sma_indicator(),
        "sma_50": lambda df, **kw: ta_lib.trend.SMAIndicator(df["close"], window=50).sma_indicator(),
        "sma_200": lambda df, **kw: ta_lib.trend.SMAIndicator(df["close"], window=200).sma_indicator(),
        "ema": lambda df, **kw: ta_lib.trend.EMAIndicator(df["close"], window=kw.get("length", 12)).ema_indicator(),
        "ema_26": lambda df, **kw: ta_lib.trend.EMAIndicator(df["close"], window=26).ema_indicator(),
        "rsi": lambda df, **kw: ta_lib.momentum.RSIIndicator(df["close"], window=kw.get("length", 14)).rsi(),
        "atr": lambda df, **kw: ta_lib.volatility.AverageTrueRange(df["high"], df["low"], df["close"], window=14).average_true_range(),
        "vwap": lambda df, **kw: ta_lib.volume.VolumeWeightedAveragePrice(df["high"], df["low"], df["close"], df["volume"]).volume_weighted_average_price(),
    }

    # ── Public API ───────────────────────────────────────────────────

    def calculate(self, history: dict, indicators: list[str]) -> dict:
        """Calculate requested indicators on OHLCV data.

        Args:
            history: Dict from MarketDataService.get_history() with 'data' key.
            indicators: List of indicator names to calculate.

        Returns:
            Dict mapping indicator names to arrays of values.
        """
        df = self._to_dataframe(history)
        if df.empty:
            return {"error": "No data to calculate indicators"}

        results = {"symbol": history.get("symbol", ""), "dates": df.index.strftime("%Y-%m-%d").tolist()}

        # OHLCV
        results["ohlcv"] = {
            "open": df["open"].round(4).tolist(),
            "high": df["high"].round(4).tolist(),
            "low": df["low"].round(4).tolist(),
            "close": df["close"].round(4).tolist(),
            "volume": df["volume"].tolist(),
        }

        # ── Dispatch map for multi-line / custom indicators ──────
        _custom_dispatch = {
            "macd": self._calc_macd,
            "bbands": self._calc_bbands,
            "ichimoku": self._calc_ichimoku,
            "stochastic": self._calc_stochastic,
            "stoch": self._calc_stochastic,          # alias
            "williams_r": self._calc_williams_r,
            "parabolic_sar": self._calc_parabolic_sar,
            "cci": self._calc_cci,
            "mfi": self._calc_mfi,
            "roc": self._calc_roc,
            "keltner": self._calc_keltner,
            "donchian": self._calc_donchian,
            "adx": self._calc_adx,
            "obv": self._calc_obv,
            "fibonacci": self._calc_fibonacci,
        }

        for ind_name in indicators:
            ind_name = ind_name.strip().lower()

            if ind_name in _custom_dispatch:
                results[ind_name] = _custom_dispatch[ind_name](df)
            elif ind_name in self.INDICATOR_MAP:
                series = self.INDICATOR_MAP[ind_name](df)
                if isinstance(series, pd.DataFrame):
                    results[ind_name] = {col: series[col].round(4).fillna(0).tolist() for col in series.columns}
                elif series is not None:
                    results[ind_name] = series.round(4).fillna(0).tolist()
            else:
                results[ind_name] = {"error": f"Unknown indicator: {ind_name}"}

        return results

    def swing_signals(self, history: dict, mode: str = "lft") -> dict:
        """Generate swing trading entry/exit signals.

        Uses multi-indicator composite scoring:
        - RSI oversold/overbought
        - MACD crossover
        - SMA crossover (20/50)
        - Bollinger Band squeeze/breakout
        """
        df = self._to_dataframe(history)
        if df.empty or len(df) < 50:
            return {"signals": [], "error": "Insufficient data for signals"}

        # Calculate all needed indicators
        df["rsi"] = ta_lib.momentum.RSIIndicator(df["close"], window=14).rsi()
        df["sma_20"] = ta_lib.trend.SMAIndicator(df["close"], window=20).sma_indicator()
        df["sma_50"] = ta_lib.trend.SMAIndicator(df["close"], window=50).sma_indicator()

        macd_obj = ta_lib.trend.MACD(df["close"], window_slow=26, window_fast=12, window_sign=9)
        df["macd"] = macd_obj.macd()
        df["macd_signal"] = macd_obj.macd_signal()
        df["macd_hist"] = macd_obj.macd_diff()

        bb_obj = ta_lib.volatility.BollingerBands(df["close"], window=20, window_dev=2)
        df["bb_upper"] = bb_obj.bollinger_hband()
        df["bb_lower"] = bb_obj.bollinger_lband()

        signals = []
        for i in range(2, len(df)):
            score = 0
            reasons = []

            # RSI signals
            rsi_val = df["rsi"].iloc[i]
            if pd.notna(rsi_val):
                if rsi_val < 30:
                    score += 2
                    reasons.append(f"RSI oversold ({rsi_val:.1f})")
                elif rsi_val > 70:
                    score -= 2
                    reasons.append(f"RSI overbought ({rsi_val:.1f})")

            # SMA crossover
            if pd.notna(df["sma_20"].iloc[i]) and pd.notna(df["sma_50"].iloc[i]):
                if df["sma_20"].iloc[i] > df["sma_50"].iloc[i] and df["sma_20"].iloc[i - 1] <= df["sma_50"].iloc[i - 1]:
                    score += 2
                    reasons.append("SMA 20/50 bullish crossover")
                elif df["sma_20"].iloc[i] < df["sma_50"].iloc[i] and df["sma_20"].iloc[i - 1] >= df["sma_50"].iloc[i - 1]:
                    score -= 2
                    reasons.append("SMA 20/50 bearish crossover")

            # MACD crossover
            if pd.notna(df["macd"].iloc[i]) and pd.notna(df["macd_signal"].iloc[i]):
                if df["macd"].iloc[i] > df["macd_signal"].iloc[i] and df["macd"].iloc[i - 1] <= df["macd_signal"].iloc[i - 1]:
                    score += 1
                    reasons.append("MACD bullish crossover")
                elif df["macd"].iloc[i] < df["macd_signal"].iloc[i] and df["macd"].iloc[i - 1] >= df["macd_signal"].iloc[i - 1]:
                    score -= 1
                    reasons.append("MACD bearish crossover")

            # Bollinger Band touch
            if pd.notna(df["bb_lower"].iloc[i]):
                if df["close"].iloc[i] <= df["bb_lower"].iloc[i]:
                    score += 1
                    reasons.append("Price at lower Bollinger Band")
                elif df["close"].iloc[i] >= df["bb_upper"].iloc[i]:
                    score -= 1
                    reasons.append("Price at upper Bollinger Band")

            # Only emit signal if score is significant
            if abs(score) >= 2:
                signals.append({
                    "date": df.index[i].isoformat() if hasattr(df.index[i], "isoformat") else str(df.index[i]),
                    "type": "BUY" if score > 0 else "SELL",
                    "strength": abs(score),
                    "score": score,
                    "price": round(df["close"].iloc[i], 4),
                    "reasons": reasons,
                })

        return {
            "symbol": history.get("symbol", ""),
            "mode": mode,
            "total_signals": len(signals),
            "signals": signals[-50:],  # Last 50 signals
        }

    # ── Private: multi-line / custom indicator calculators ────────────

    def _calc_macd(self, df: pd.DataFrame) -> dict:
        macd_obj = ta_lib.trend.MACD(df["close"], window_slow=26, window_fast=12, window_sign=9)
        return {
            "macd": macd_obj.macd().round(4).fillna(0).tolist(),
            "signal": macd_obj.macd_signal().round(4).fillna(0).tolist(),
            "histogram": macd_obj.macd_diff().round(4).fillna(0).tolist(),
        }

    def _calc_bbands(self, df: pd.DataFrame) -> dict:
        bb = ta_lib.volatility.BollingerBands(df["close"], window=20, window_dev=2)
        return {
            "lower": bb.bollinger_lband().round(4).fillna(0).tolist(),
            "mid": bb.bollinger_mavg().round(4).fillna(0).tolist(),
            "upper": bb.bollinger_hband().round(4).fillna(0).tolist(),
        }

    def _calc_ichimoku(self, df: pd.DataFrame) -> dict:
        """Ichimoku Cloud — tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b, chikou_span."""
        ichi = ta_lib.trend.IchimokuIndicator(df["high"], df["low"])
        # chikou_span = close shifted back 26 periods
        chikou = df["close"].shift(-26)
        return {
            "tenkan_sen": ichi.ichimoku_conversion_line().round(4).fillna(0).tolist(),
            "kijun_sen": ichi.ichimoku_base_line().round(4).fillna(0).tolist(),
            "senkou_span_a": ichi.ichimoku_a().round(4).fillna(0).tolist(),
            "senkou_span_b": ichi.ichimoku_b().round(4).fillna(0).tolist(),
            "chikou_span": chikou.round(4).fillna(0).tolist(),
        }

    def _calc_stochastic(self, df: pd.DataFrame) -> dict:
        """Stochastic Oscillator — stoch_k, stoch_d."""
        stoch = ta_lib.momentum.StochasticOscillator(df["high"], df["low"], df["close"])
        return {
            "stoch_k": stoch.stoch().round(4).fillna(0).tolist(),
            "stoch_d": stoch.stoch_signal().round(4).fillna(0).tolist(),
        }

    def _calc_williams_r(self, df: pd.DataFrame) -> list:
        """Williams %R — single series."""
        wr = ta_lib.momentum.WilliamsRIndicator(df["high"], df["low"], df["close"], lbp=14)
        return wr.williams_r().round(4).fillna(0).tolist()

    def _calc_parabolic_sar(self, df: pd.DataFrame) -> dict:
        """Parabolic SAR — sar value plus up/down indicator series."""
        psar = ta_lib.trend.PSARIndicator(df["high"], df["low"], df["close"])
        return {
            "sar": psar.psar().round(4).fillna(0).tolist(),
            "sar_up": psar.psar_up().round(4).fillna(0).tolist(),
            "sar_down": psar.psar_down().round(4).fillna(0).tolist(),
        }

    def _calc_cci(self, df: pd.DataFrame) -> list:
        """Commodity Channel Index — single series, default 20-period."""
        cci = ta_lib.trend.CCIIndicator(df["high"], df["low"], df["close"], window=20)
        return cci.cci().round(4).fillna(0).tolist()

    def _calc_mfi(self, df: pd.DataFrame) -> list:
        """Money Flow Index — single series, default 14-period."""
        mfi = ta_lib.volume.MFIIndicator(df["high"], df["low"], df["close"], df["volume"], window=14)
        return mfi.money_flow_index().round(4).fillna(0).tolist()

    def _calc_roc(self, df: pd.DataFrame) -> list:
        """Rate of Change — single series, default 12-period."""
        roc = ta_lib.momentum.ROCIndicator(df["close"], window=12)
        return roc.roc().round(4).fillna(0).tolist()

    def _calc_keltner(self, df: pd.DataFrame) -> dict:
        """Keltner Channel — upper, mid, lower."""
        kc = ta_lib.volatility.KeltnerChannel(df["high"], df["low"], df["close"], window=20, window_atr=10)
        return {
            "upper": kc.keltner_channel_hband().round(4).fillna(0).tolist(),
            "mid": kc.keltner_channel_mband().round(4).fillna(0).tolist(),
            "lower": kc.keltner_channel_lband().round(4).fillna(0).tolist(),
        }

    def _calc_donchian(self, df: pd.DataFrame) -> dict:
        """Donchian Channel — upper, mid, lower."""
        dc = ta_lib.volatility.DonchianChannel(df["high"], df["low"], df["close"], window=20)
        return {
            "upper": dc.donchian_channel_hband().round(4).fillna(0).tolist(),
            "mid": dc.donchian_channel_mband().round(4).fillna(0).tolist(),
            "lower": dc.donchian_channel_lband().round(4).fillna(0).tolist(),
        }

    def _calc_adx(self, df: pd.DataFrame) -> dict:
        """Average Directional Index — adx, +DI, -DI."""
        adx_obj = ta_lib.trend.ADXIndicator(df["high"], df["low"], df["close"], window=14)
        return {
            "adx": adx_obj.adx().round(4).fillna(0).tolist(),
            "plus_di": adx_obj.adx_pos().round(4).fillna(0).tolist(),
            "minus_di": adx_obj.adx_neg().round(4).fillna(0).tolist(),
        }

    def _calc_obv(self, df: pd.DataFrame) -> list:
        """On Balance Volume — single series."""
        obv = ta_lib.volume.OnBalanceVolumeIndicator(df["close"], df["volume"])
        return obv.on_balance_volume().round(4).fillna(0).tolist()

    def _calc_fibonacci(self, df: pd.DataFrame, period: int = 120) -> dict:
        """Fibonacci Retracement levels from period high/low.

        Returns the 7 standard retracement levels (0, 0.236, 0.382, 0.5,
        0.618, 0.786, 1.0) plus the high and low used.  Each level is a
        constant value broadcast to an array the same length as `dates` so
        it can be overlaid on a price chart.
        """
        window = df.tail(period)
        high = float(window["high"].max())
        low = float(window["low"].min())
        diff = high - low

        fib_ratios = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
        levels = {}
        for ratio in fib_ratios:
            # Retracement measured downward from the high
            level = round(high - diff * ratio, 4)
            levels[str(ratio)] = [level] * len(df)

        levels["high"] = round(high, 4)
        levels["low"] = round(low, 4)
        levels["period"] = period
        return levels

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _to_dataframe(history: dict) -> pd.DataFrame:
        """Convert history dict to pandas DataFrame."""
        data = history.get("data", [])
        if not data:
            return pd.DataFrame()
        df = pd.DataFrame(data)
        df["date"] = pd.to_datetime(df["date"], utc=True)
        df = df.set_index("date")
        df.columns = [c.lower() for c in df.columns]
        return df
