"""
backend/api/log_routes.py
REST + WebSocket endpoints for the frontend error/trace panel.

  GET  /logs           — recent log entries (last N)
  GET  /logs/download  — download JSON log file
  DELETE /logs         — clear the in-memory buffer
  WS   /ws/logs        — real-time log stream
"""

import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import FileResponse
import os
from pathlib import Path

from core.logger import log_buffer, log_subscribers, get_log_buffer

router = APIRouter()
logger = logging.getLogger("log_routes")


@router.get("/logs")
async def get_logs(last: int = Query(200, description="Number of recent entries to return")):
    """Return recent log entries from the in-memory buffer."""
    return {"logs": get_log_buffer(last), "total": len(log_buffer)}


@router.delete("/logs")
async def clear_logs():
    """Clear the in-memory log buffer (does not affect the file)."""
    log_buffer.clear()
    logger.info("Log buffer cleared by user")
    return {"status": "cleared"}


@router.get("/logs/download")
async def download_log_file():
    """Stream the current rotating log file as a download."""
    log_path = Path("logs/stock_terminal.log")
    if not log_path.exists():
        return {"error": "Log file not found. Logs will appear after the backend starts."}
    return FileResponse(
        path=str(log_path),
        filename="stock_terminal.log",
        media_type="application/json",
    )


@router.websocket("/ws/logs")
async def websocket_log_stream(websocket: WebSocket):
    """
    Real-time log stream via WebSocket.
    - On connect: sends the last 100 buffered entries immediately (catch-up)
    - Then pushes new entries as they arrive
    """
    await websocket.accept()
    logger.debug(f"Log WebSocket client connected: {websocket.client}")

    queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
    log_subscribers.append(queue)

    try:
        # Send catch-up buffer
        catch_up = get_log_buffer(100)
        for entry in catch_up:
            await websocket.send_text(json.dumps({"type": "catchup", "data": entry}))

        # Stream new entries
        while True:
            try:
                entry = await asyncio.wait_for(queue.get(), timeout=30)
                await websocket.send_text(json.dumps({"type": "log", "data": entry}))
            except asyncio.TimeoutError:
                # Heartbeat to keep connection alive
                await websocket.send_text(json.dumps({"type": "ping"}))

    except WebSocketDisconnect:
        logger.debug("Log WebSocket client disconnected")
    except Exception as e:
        logger.warning(f"Log WebSocket error: {e}")
    finally:
        if queue in log_subscribers:
            log_subscribers.remove(queue)
