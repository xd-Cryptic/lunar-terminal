"""WebSocket endpoints for real-time data streaming."""

import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from data.market_data import MarketDataService

router = APIRouter()
logger = logging.getLogger("terminal.ws")

market = MarketDataService()


class ConnectionManager:
    """Manages WebSocket connections and symbol subscriptions."""

    def __init__(self):
        self.connections: list[WebSocket] = []
        self.subscriptions: Dict[WebSocket, Set[str]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connections.append(websocket)
        self.subscriptions[websocket] = set()
        logger.info("WS client connected. Total: %d", len(self.connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.connections:
            self.connections.remove(websocket)
        self.subscriptions.pop(websocket, None)
        logger.info("WS client disconnected. Total: %d", len(self.connections))

    def subscribe(self, websocket: WebSocket, symbols: list[str]):
        if websocket in self.subscriptions:
            self.subscriptions[websocket].update(s.upper() for s in symbols)

    def unsubscribe(self, websocket: WebSocket, symbols: list[str]):
        if websocket in self.subscriptions:
            self.subscriptions[websocket] -= {s.upper() for s in symbols}

    async def broadcast(self, symbol: str, data: dict):
        symbol_upper = symbol.upper()
        for ws, subs in list(self.subscriptions.items()):
            if symbol_upper in subs:
                try:
                    await ws.send_json({"type": "quote", "symbol": symbol_upper, "data": data})
                except Exception:
                    self.disconnect(ws)


manager = ConnectionManager()


@router.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    """
    Real-time data stream.

    Client sends JSON:
      {"action": "subscribe",   "symbols": ["AAPL", "BTCUSD"]}
      {"action": "unsubscribe", "symbols": ["AAPL"]}
    """
    await manager.connect(websocket)
    try:
        push_task = asyncio.create_task(_price_pusher(websocket))

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
                continue

            action = msg.get("action")
            symbols = msg.get("symbols", [])

            if action == "subscribe":
                manager.subscribe(websocket, symbols)
                await websocket.send_json({
                    "type": "subscribed",
                    "symbols": sorted(manager.subscriptions.get(websocket, set())),
                })
            elif action == "unsubscribe":
                manager.unsubscribe(websocket, symbols)
                await websocket.send_json({
                    "type": "unsubscribed",
                    "symbols": sorted(manager.subscriptions.get(websocket, set())),
                })
            else:
                await websocket.send_json({"error": f"Unknown action: {action}"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        push_task.cancel()


async def _price_pusher(websocket: WebSocket):
    """Push live quotes for subscribed symbols every 2 seconds."""
    while True:
        subs = manager.subscriptions.get(websocket, set())
        for symbol in list(subs):
            try:
                quote = await market.get_quote(symbol)
                await websocket.send_json({"type": "quote", "symbol": symbol, "data": quote})
            except Exception as exc:
                logger.warning("Quote push error for %s: %s", symbol, exc)
        await asyncio.sleep(2)
