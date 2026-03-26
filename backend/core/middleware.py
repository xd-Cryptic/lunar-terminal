"""
backend/core/middleware.py
FastAPI middleware for request/response lifecycle logging + error capture.
"""

import time
import traceback
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

logger = logging.getLogger("middleware")


class LoggingMiddleware(BaseHTTPMiddleware):
    """Log every request with timing, and catch unhandled exceptions."""

    SKIP_PATHS = {"/health", "/ws/logs"}   # Don't log heartbeat spam

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        if path in self.SKIP_PATHS:
            return await call_next(request)

        start   = time.perf_counter()
        method  = request.method
        qs      = str(request.query_params) if request.query_params else ""

        logger.info(f"→ {method} {path} {qs}")

        try:
            response = await call_next(request)
            elapsed  = (time.perf_counter() - start) * 1000
            lvl      = logging.WARNING if response.status_code >= 400 else logging.INFO
            logger.log(lvl, f"← {method} {path} {response.status_code} [{elapsed:.1f}ms]")
            return response

        except Exception as exc:
            elapsed = (time.perf_counter() - start) * 1000
            logger.error(
                f"💥 UNHANDLED: {method} {path} [{elapsed:.1f}ms] — {type(exc).__name__}: {exc}",
                exc_info=True,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal server error",
                    "type": type(exc).__name__,
                    "detail": str(exc),
                    "traceback": traceback.format_exc(),
                },
            )
