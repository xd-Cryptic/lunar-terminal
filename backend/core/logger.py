"""
backend/core/logger.py
Structured logging for the Stock Terminal backend.

Features:
- Colour-coded console output
- Rotating JSON log files (logs/stock_terminal.log)
- In-memory log buffer for WebSocket streaming to frontend
- Wraps FastAPI request/response lifecycle (middleware)
- Captures uncaught exceptions with full tracebacks
"""

import logging
import logging.handlers
import json
import traceback
import time
import os
from datetime import datetime, timezone
from collections import deque
from typing import Optional

# ── Log buffer (broadcast to WebSocket clients) ───────────────────
MAX_BUFFER = 500
log_buffer: deque = deque(maxlen=MAX_BUFFER)
log_subscribers: list = []   # List of asyncio queues (one per WS client)

# ── ANSI colours ──────────────────────────────────────────────────
ANSI = {
    "DEBUG":    "\033[36m",   # cyan
    "INFO":     "\033[32m",   # green
    "WARNING":  "\033[33m",   # yellow
    "ERROR":    "\033[31m",   # red
    "CRITICAL": "\033[35m",   # magenta
    "RESET":    "\033[0m",
    "DIM":      "\033[2m",
    "BOLD":     "\033[1m",
}

LEVEL_EMOJI = {
    "DEBUG":    "🔍",
    "INFO":     "ℹ️",
    "WARNING":  "⚠️",
    "ERROR":    "❌",
    "CRITICAL": "🔥",
}


# ── Custom handler: push all log records to the in-memory buffer ──
class BufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord):
        entry = self._format_entry(record)
        log_buffer.append(entry)

        # Broadcast to all connected WebSocket clients
        for q in log_subscribers[:]:
            try:
                q.put_nowait(entry)
            except Exception:
                pass

    def _format_entry(self, record: logging.LogRecord) -> dict:
        exc_text = None
        if record.exc_info:
            exc_text = "".join(traceback.format_exception(*record.exc_info))

        return {
            "id":        f"{int(time.time() * 1000)}-{record.levelno}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level":     record.levelname,
            "emoji":     LEVEL_EMOJI.get(record.levelname, ""),
            "logger":    record.name,
            "message":   self.format(record) if not record.exc_info else record.getMessage(),
            "module":    record.module,
            "function":  record.funcName,
            "line":      record.lineno,
            "traceback": exc_text,
            "extra":     {k: v for k, v in record.__dict__.items()
                         if k.startswith("ctx_") or k in ("symbol", "strategy", "market")},
        }


# ── Coloured console formatter ─────────────────────────────────────
class ColouredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        colour = ANSI.get(record.levelname, ANSI["RESET"])
        ts     = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        reset  = ANSI["RESET"]
        dim    = ANSI["DIM"]
        bold   = ANSI["BOLD"]
        name   = record.name.split(".")[-1]
        emoji  = LEVEL_EMOJI.get(record.levelname, "")

        tb = ""
        if record.exc_info:
            tb = "\n" + "".join(traceback.format_exception(*record.exc_info))

        return (f"{dim}{ts}{reset} "
                f"{colour}{bold}{emoji} {record.levelname:<8}{reset} "
                f"{dim}[{name}:{record.lineno}]{reset} "
                f"{record.getMessage()}{colour}{tb}{reset}")


# ── JSON rotating file formatter ──────────────────────────────────
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        exc_text = None
        if record.exc_info:
            exc_text = "".join(traceback.format_exception(*record.exc_info))
        entry = {
            "ts":       datetime.now(timezone.utc).isoformat(),
            "level":    record.levelname,
            "logger":   record.name,
            "module":   record.module,
            "fn":       record.funcName,
            "line":     record.lineno,
            "msg":      record.getMessage(),
            "tb":       exc_text,
        }
        return json.dumps(entry, ensure_ascii=False)


def setup_logging(log_dir: str = "logs", level: str = "DEBUG") -> logging.Logger:
    """Initialise the root logger with console + file + buffer handlers."""
    os.makedirs(log_dir, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.DEBUG))

    # Remove any existing handlers
    root.handlers.clear()

    # 1. Coloured console
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)
    ch.setFormatter(ColouredFormatter())
    root.addHandler(ch)

    # 2. Rotating JSON file (10MB × 5 backups)
    log_path = os.path.join(log_dir, "stock_terminal.log")
    fh = logging.handlers.RotatingFileHandler(log_path, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(JsonFormatter())
    root.addHandler(fh)

    # 3. In-memory buffer → WebSocket broadcast
    bh = BufferHandler()
    bh.setLevel(logging.DEBUG)
    root.addHandler(bh)

    # Quieten noisy third-party libs
    for lib in ("uvicorn.access", "httpx", "httpcore", "hpack", "urllib3", "asyncio"):
        logging.getLogger(lib).setLevel(logging.WARNING)

    return root


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def get_log_buffer(last_n: Optional[int] = None) -> list:
    buf = list(log_buffer)
    if last_n:
        return buf[-last_n:]
    return buf
