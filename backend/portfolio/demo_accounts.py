"""Demo account manager.

Supports unlimited simultaneous demo accounts with variable capital,
independent algo assignment, and full P&L tracking.
Demo accounts persist to disk in ~/StockTerminal/accounts/.
"""

import json
import logging
import os
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger("terminal.demo")

ACCOUNTS_DIR = Path.home() / "StockTerminal" / "accounts"


@dataclass
class DemoAccount:
    """A simulated trading account with its own capital and history."""
    id: str = ""
    name: str = "Default Demo"
    initial_capital: float = 10000.0
    current_cash: float = 10000.0
    market: str = "stocks"           # stocks, crypto, forex, etf, multi
    mode: str = "demo"               # demo, paper, live
    risk_pct: float = 0.02
    fee_pct: float = 0.001
    positions: dict = field(default_factory=dict)    # {symbol: {qty, avg_price, ...}}
    trade_history: list = field(default_factory=list)
    equity_history: list = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid.uuid4())[:8]
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()
        self.updated_at = datetime.utcnow().isoformat()

    @property
    def equity(self) -> float:
        """Current total equity (cash + position values)."""
        position_value = sum(
            pos.get("quantity", 0) * pos.get("current_price", pos.get("avg_price", 0))
            for pos in self.positions.values()
        )
        return self.current_cash + position_value

    @property
    def total_return_pct(self) -> float:
        return ((self.equity - self.initial_capital) / self.initial_capital) * 100

    def record_equity(self):
        """Snapshot current equity for charting."""
        self.equity_history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "equity": round(self.equity, 2),
            "cash": round(self.current_cash, 2),
        })

    def execute_trade(self, symbol: str, side: str, quantity: float, price: float) -> dict:
        """Simulate a trade execution within this account."""
        fee = price * quantity * self.fee_pct

        if side.upper() == "BUY":
            cost = price * quantity + fee
            if cost > self.current_cash:
                return {"error": f"Insufficient funds. Need ${cost:.2f}, have ${self.current_cash:.2f}"}

            self.current_cash -= cost
            if symbol in self.positions:
                pos = self.positions[symbol]
                old_qty = pos["quantity"]
                old_avg = pos["avg_price"]
                new_qty = old_qty + quantity
                pos["avg_price"] = (old_avg * old_qty + price * quantity) / new_qty
                pos["quantity"] = new_qty
            else:
                self.positions[symbol] = {
                    "quantity": quantity,
                    "avg_price": price,
                    "current_price": price,
                }

        elif side.upper() == "SELL":
            if symbol not in self.positions or self.positions[symbol]["quantity"] < quantity:
                return {"error": f"Insufficient position in {symbol}"}

            revenue = price * quantity - fee
            self.current_cash += revenue

            pnl = (price - self.positions[symbol]["avg_price"]) * quantity - fee
            self.positions[symbol]["quantity"] -= quantity
            if self.positions[symbol]["quantity"] <= 0:
                del self.positions[symbol]

        trade = {
            "timestamp": datetime.utcnow().isoformat(),
            "symbol": symbol,
            "side": side.upper(),
            "quantity": quantity,
            "price": round(price, 4),
            "fee": round(fee, 4),
            "pnl": round(pnl, 2) if side.upper() == "SELL" else None,
        }
        self.trade_history.append(trade)
        self.record_equity()
        self.updated_at = datetime.utcnow().isoformat()

        return {"success": True, "trade": trade, "account_equity": round(self.equity, 2)}

    def to_dict(self) -> dict:
        return asdict(self)


class DemoAccountManager:
    """Manage unlimited demo accounts with persistence."""

    def __init__(self):
        self.accounts: dict[str, DemoAccount] = {}
        ACCOUNTS_DIR.mkdir(parents=True, exist_ok=True)
        self._load_all()

    def create(
        self,
        name: str = "Demo Account",
        initial_capital: float = 10000.0,
        market: str = "stocks",
        fee_pct: float = 0.001,
        risk_pct: float = 0.02,
    ) -> dict:
        """Create a new demo account."""
        account = DemoAccount(
            name=name,
            initial_capital=initial_capital,
            current_cash=initial_capital,
            market=market,
            fee_pct=fee_pct,
            risk_pct=risk_pct,
        )
        self.accounts[account.id] = account
        self._save(account)
        return account.to_dict()

    def list_accounts(self) -> list[dict]:
        """List all demo accounts with summary info."""
        return [
            {
                "id": acc.id,
                "name": acc.name,
                "market": acc.market,
                "mode": acc.mode,
                "initial_capital": acc.initial_capital,
                "current_equity": round(acc.equity, 2),
                "return_pct": round(acc.total_return_pct, 2),
                "open_positions": len(acc.positions),
                "total_trades": len(acc.trade_history),
                "created_at": acc.created_at,
            }
            for acc in self.accounts.values()
        ]

    def get(self, account_id: str) -> Optional[dict]:
        acc = self.accounts.get(account_id)
        return acc.to_dict() if acc else None

    def delete(self, account_id: str) -> bool:
        if account_id in self.accounts:
            del self.accounts[account_id]
            path = ACCOUNTS_DIR / f"{account_id}.json"
            if path.exists():
                path.unlink()
            return True
        return False

    def trade(self, account_id: str, symbol: str, side: str, quantity: float, price: float) -> dict:
        acc = self.accounts.get(account_id)
        if not acc:
            return {"error": f"Account {account_id} not found"}
        result = acc.execute_trade(symbol, side, quantity, price)
        self._save(acc)
        return result

    def _save(self, account: DemoAccount):
        path = ACCOUNTS_DIR / f"{account.id}.json"
        with open(path, "w") as f:
            json.dump(account.to_dict(), f, indent=2)

    def _load_all(self):
        for path in ACCOUNTS_DIR.glob("*.json"):
            try:
                with open(path) as f:
                    data = json.load(f)
                acc = DemoAccount(**{k: v for k, v in data.items() if k in DemoAccount.__dataclass_fields__})
                self.accounts[acc.id] = acc
            except Exception as exc:
                logger.warning("Failed to load account %s: %s", path, exc)
