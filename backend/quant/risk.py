"""Risk management engine.

Handles position sizing, portfolio risk metrics, kill-switch logic,
and fee-aware calculations for Revolut, OANDA, and Binance.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("terminal.risk")


@dataclass
class RiskProfile:
    """Per-market risk configuration."""
    max_risk_pct: float = 0.02          # 2% per trade
    daily_loss_limit_pct: float = 0.05  # 5% daily
    max_drawdown_pct: float = 0.10      # 10% from peak
    max_positions: int = 5
    platform_fee_pct: float = 0.001     # 0.1% default


@dataclass
class KillSwitchState:
    """Tracks the state of all 7 kill-switch layers."""
    live_mode_unlocked: bool = False
    daily_pnl: float = 0.0
    daily_pnl_limit: float = -500.0     # Will be set based on account
    peak_equity: float = 0.0
    current_equity: float = 0.0
    open_positions: int = 0
    max_positions: int = 5
    last_heartbeat: Optional[datetime] = None
    network_connected: bool = True
    halted: bool = False
    halt_reason: str = ""
    audit_log: list = field(default_factory=list)

    def log_event(self, event: str, details: dict = None):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": event,
            "details": details or {},
        }
        self.audit_log.append(entry)
        logger.info("AUDIT: %s — %s", event, details)


# Default risk profiles per market
MARKET_PROFILES = {
    "stocks": RiskProfile(max_risk_pct=0.02, platform_fee_pct=0.0, max_positions=10),
    "crypto": RiskProfile(max_risk_pct=0.015, platform_fee_pct=0.00075, max_positions=5),
    "forex": RiskProfile(max_risk_pct=0.01, platform_fee_pct=0.0, max_positions=5),
    "etf": RiskProfile(max_risk_pct=0.02, platform_fee_pct=0.0, max_positions=10),
}


class RiskManager:
    """Risk management and kill-switch engine."""

    def __init__(self):
        self.kill_switch = KillSwitchState()
        self.profiles = MARKET_PROFILES.copy()

    # ── Position Sizing ───────────────────────────────────────────

    def position_size(
        self,
        account_value: float,
        risk_pct: float = 0.02,
        entry_price: float = 0.0,
        stop_loss_price: float = 0.0,
        platform_fee_pct: float = 0.0,
    ) -> dict:
        """Calculate position size based on risk parameters.

        Uses ATR-based or fixed stop-loss to determine how many
        shares/units to buy while risking only risk_pct of account.
        """
        if entry_price <= 0 or stop_loss_price <= 0:
            return {"error": "Entry and stop-loss prices must be > 0"}

        risk_per_share = abs(entry_price - stop_loss_price)
        if risk_per_share == 0:
            return {"error": "Entry and stop-loss cannot be the same"}

        max_risk_dollars = account_value * risk_pct
        # Account for fees on entry + exit
        fee_cost_per_share = entry_price * platform_fee_pct * 2  # buy + sell

        effective_risk = risk_per_share + fee_cost_per_share
        position_size = int(max_risk_dollars / effective_risk)
        total_cost = position_size * entry_price
        total_fees = total_cost * platform_fee_pct * 2

        return {
            "position_size": position_size,
            "entry_price": entry_price,
            "stop_loss": stop_loss_price,
            "risk_per_share": round(risk_per_share, 4),
            "max_risk_dollars": round(max_risk_dollars, 2),
            "total_cost": round(total_cost, 2),
            "total_fees": round(total_fees, 2),
            "risk_reward_info": {
                "risk_pct": risk_pct,
                "account_value": account_value,
                "pct_of_account": round((total_cost / account_value) * 100, 2),
            },
        }

    # ── Portfolio Risk Metrics ────────────────────────────────────

    async def portfolio_metrics(self, holdings: dict) -> dict:
        """Calculate VaR, beta, correlation for current portfolio.

        Args:
            holdings: Dict of {symbol: {"quantity": n, "avg_price": p}}
        """
        import yfinance as yf

        symbols = list(holdings.keys())
        if not symbols:
            return {"error": "No holdings provided"}

        # Download price data for all holdings + SPY benchmark
        data = yf.download(symbols + ["SPY"], period="1y", interval="1d", progress=False)
        if data.empty:
            return {"error": "Could not fetch price data"}

        close = data["Close"].dropna()
        returns = close.pct_change().dropna()

        # Portfolio weights
        total_value = sum(
            h.get("quantity", 0) * close[sym].iloc[-1]
            for sym, h in holdings.items()
            if sym in close.columns
        )

        weights = {}
        for sym, h in holdings.items():
            if sym in close.columns:
                val = h.get("quantity", 0) * close[sym].iloc[-1]
                weights[sym] = val / total_value if total_value > 0 else 0

        # Portfolio return series
        portfolio_returns = sum(
            returns[sym] * weights.get(sym, 0)
            for sym in symbols
            if sym in returns.columns
        )

        # VaR (95% confidence)
        var_95 = float(np.percentile(portfolio_returns, 5))

        # Beta vs SPY
        if "SPY" in returns.columns:
            cov = np.cov(portfolio_returns, returns["SPY"])
            beta = cov[0][1] / cov[1][1] if cov[1][1] != 0 else 0
        else:
            beta = 0

        # Max drawdown
        cumulative = (1 + portfolio_returns).cumprod()
        peak = cumulative.cummax()
        drawdown = (cumulative - peak) / peak
        max_dd = float(drawdown.min())

        # Sharpe ratio (assume 4% risk-free)
        excess = portfolio_returns.mean() - (0.04 / 252)
        sharpe = float(excess / portfolio_returns.std() * np.sqrt(252)) if portfolio_returns.std() > 0 else 0

        # Correlation matrix
        corr_matrix = {}
        for sym in symbols:
            if sym in returns.columns:
                corr_matrix[sym] = {
                    s: round(float(returns[sym].corr(returns[s])), 3)
                    for s in symbols if s in returns.columns
                }

        return {
            "total_value": round(total_value, 2),
            "weights": {k: round(v, 4) for k, v in weights.items()},
            "var_95_daily": round(var_95 * 100, 2),
            "beta": round(beta, 3),
            "max_drawdown": round(max_dd * 100, 2),
            "sharpe_ratio": round(sharpe, 3),
            "correlation_matrix": corr_matrix,
        }

    # ── Kill-Switch Checks ────────────────────────────────────────

    def check_order(self, order: dict, market: str = "stocks") -> dict:
        """Run all 7 kill-switch layers against a proposed order.

        Returns {"approved": True/False, "rejections": [...]}
        """
        rejections = []
        ks = self.kill_switch
        profile = self.profiles.get(market, MARKET_PROFILES["stocks"])

        # Layer 1: Paper mode lock
        if not ks.live_mode_unlocked:
            rejections.append({
                "layer": 1,
                "name": "Paper Mode Lock",
                "message": "Live trading is not unlocked. Order will be simulated.",
            })

        # Layer 2: Per-trade risk cap
        order_risk = order.get("risk_amount", 0)
        max_risk = ks.current_equity * profile.max_risk_pct
        if order_risk > max_risk and max_risk > 0:
            rejections.append({
                "layer": 2,
                "name": "Per-Trade Risk Cap",
                "message": f"Order risk ${order_risk:.2f} exceeds {profile.max_risk_pct*100}% cap (${max_risk:.2f})",
            })

        # Layer 3: Daily loss limit
        if ks.daily_pnl <= ks.daily_pnl_limit:
            rejections.append({
                "layer": 3,
                "name": "Daily Loss Limit",
                "message": f"Daily P&L ${ks.daily_pnl:.2f} exceeds limit ${ks.daily_pnl_limit:.2f}. Trading halted.",
            })
            ks.halted = True
            ks.halt_reason = "Daily loss limit exceeded"

        # Layer 4: Max drawdown
        if ks.peak_equity > 0:
            drawdown = (ks.peak_equity - ks.current_equity) / ks.peak_equity
            if drawdown >= profile.max_drawdown_pct:
                rejections.append({
                    "layer": 4,
                    "name": "Max Drawdown Breaker",
                    "message": f"Drawdown {drawdown*100:.1f}% exceeds {profile.max_drawdown_pct*100}% threshold. CLOSE ALL.",
                })
                ks.halted = True
                ks.halt_reason = "Max drawdown breaker triggered"

        # Layer 5: Position limit
        if ks.open_positions >= profile.max_positions:
            rejections.append({
                "layer": 5,
                "name": "Position Limit",
                "message": f"Already at max positions ({profile.max_positions}). Cannot open new trade.",
            })

        # Layer 6 & 7 are checked asynchronously (heartbeat + network)
        if ks.halted:
            rejections.append({
                "layer": 0,
                "name": "System Halted",
                "message": f"Trading halted: {ks.halt_reason}",
            })

        approved = len([r for r in rejections if r["layer"] != 1]) == 0
        ks.log_event("order_check", {"order": order, "approved": approved, "rejections": rejections})

        return {
            "approved": approved,
            "simulated": not ks.live_mode_unlocked,
            "rejections": rejections,
        }

    def get_safety_status(self) -> dict:
        """Return status of all 7 kill-switch layers for the dashboard widget."""
        ks = self.kill_switch
        drawdown = 0
        if ks.peak_equity > 0:
            drawdown = (ks.peak_equity - ks.current_equity) / ks.peak_equity

        return {
            "layer_1_paper_lock": {"status": "green" if not ks.live_mode_unlocked else "amber", "live": ks.live_mode_unlocked},
            "layer_2_risk_cap": {"status": "green"},
            "layer_3_daily_loss": {"status": "red" if ks.daily_pnl <= ks.daily_pnl_limit else "green", "pnl": ks.daily_pnl},
            "layer_4_drawdown": {"status": "red" if drawdown >= 0.10 else "amber" if drawdown >= 0.05 else "green", "drawdown_pct": round(drawdown * 100, 2)},
            "layer_5_positions": {"status": "amber" if ks.open_positions >= 4 else "green", "open": ks.open_positions},
            "layer_6_heartbeat": {"status": "green" if ks.last_heartbeat else "red"},
            "layer_7_network": {"status": "green" if ks.network_connected else "red"},
            "halted": ks.halted,
            "halt_reason": ks.halt_reason,
        }
