"""
Stock Terminal — FastAPI Backend Entry Point.
Phase 2: structured logging + middleware + log WebSocket stream.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings, DEVICE
from core.logger import setup_logging
from core.middleware import LoggingMiddleware

# ── Initialise structured logging first (before any imports that log) ─
setup_logging(log_dir="logs", level=settings.log_level)
logger = logging.getLogger("terminal")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Lunar Terminal backend starting on port %s", settings.backend_port)
    logger.info("🖥️  Compute device: %s", DEVICE)
    logger.info("📊 Trading mode: %s", settings.trading_mode.upper())
    logger.info("📁 Log file: logs/stock_terminal.log")
    logger.info("🔌 Log WebSocket: ws://localhost:%s/ws/logs", settings.backend_port)

    # ── Start RAG Scheduler ──────────────────────────────────────
    from ai.rag_scheduler import rag_scheduler
    try:
        await rag_scheduler.start()
        logger.info("RAG Scheduler started successfully")
    except Exception as exc:
        logger.warning("RAG Scheduler failed to start: %s", exc)

    yield

    # ── Stop RAG Scheduler ───────────────────────────────────────
    try:
        await rag_scheduler.stop()
        logger.info("RAG Scheduler stopped successfully")
    except Exception as exc:
        logger.warning("RAG Scheduler failed to stop cleanly: %s", exc)

    logger.info("Lunar Terminal backend shutting down")


app = FastAPI(
    title="Lunar Terminal API",
    version="0.2.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request/response logging middleware ───────────────────────────
app.add_middleware(LoggingMiddleware)

# ── Import & register routes ──────────────────────────────────────
from api.routes    import router as api_router    # noqa: E402
from api.websocket import router as ws_router     # noqa: E402
from api.log_routes import router as log_router   # noqa: E402

app.include_router(api_router, prefix="/api")   # api.js calls: /api/market/quote/...
app.include_router(api_router)                  # direct calls: /chart-data, /algos, ...
app.include_router(ws_router,  prefix="/ws")
app.include_router(log_router)                  # /logs, /ws/logs at root


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "0.2.0",
        "device": str(DEVICE),
        "trading_mode": settings.trading_mode,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=True,
        log_level=settings.log_level,
    )
