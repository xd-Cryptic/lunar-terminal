"""Periodic RAG ingestion scheduler.
Runs background tasks that automatically ingest market data, news, and indicators
into the RAG engine at configurable intervals.
"""

import asyncio
import logging
import time
from datetime import datetime

logger = logging.getLogger("terminal.rag_scheduler")


class RAGScheduler:
    """Manages periodic RAG ingestion tasks."""

    def __init__(self):
        self.tasks: dict[str, asyncio.Task] = {}
        self.intervals = {
            "news": 900,        # 15 minutes
            "market": 1800,     # 30 minutes
            "sectors": 3600,    # 1 hour
            "persist": 14400,   # 4 hours
        }
        self.last_run: dict[str, float] = {}
        self.entries_ingested: dict[str, int] = {}
        self.running = False
        self._watchlist = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]

    def set_watchlist(self, symbols: list[str]):
        self._watchlist = symbols

    def update_interval(self, task_name: str, seconds: int):
        self.intervals[task_name] = max(60, seconds)  # minimum 1 minute

    async def start(self):
        """Start all scheduled tasks."""
        if self.running:
            return
        self.running = True
        logger.info("RAG Scheduler starting...")
        self.tasks["news"] = asyncio.create_task(self._loop("news", self._ingest_news))
        self.tasks["market"] = asyncio.create_task(self._loop("market", self._ingest_market))
        self.tasks["persist"] = asyncio.create_task(self._loop("persist", self._persist_to_supabase))
        logger.info("RAG Scheduler started with %d tasks", len(self.tasks))

    async def stop(self):
        """Stop all scheduled tasks."""
        self.running = False
        for name, task in self.tasks.items():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        self.tasks.clear()
        logger.info("RAG Scheduler stopped")

    async def trigger(self, task_name: str) -> dict:
        """Manually trigger a specific task."""
        handlers = {
            "news": self._ingest_news,
            "market": self._ingest_market,
            "persist": self._persist_to_supabase,
        }
        handler = handlers.get(task_name)
        if not handler:
            return {"error": f"Unknown task: {task_name}"}
        count = await handler()
        return {"task": task_name, "entries_ingested": count, "timestamp": datetime.utcnow().isoformat()}

    def status(self) -> dict:
        return {
            "running": self.running,
            "tasks": {
                name: {
                    "interval_seconds": self.intervals.get(name, 0),
                    "last_run": self.last_run.get(name),
                    "entries_ingested": self.entries_ingested.get(name, 0),
                    "active": name in self.tasks and not self.tasks[name].done(),
                }
                for name in self.intervals
            },
            "watchlist": self._watchlist,
        }

    async def _loop(self, name: str, handler):
        """Run a task in a loop with its configured interval."""
        # Initial delay to stagger tasks
        await asyncio.sleep({"news": 10, "market": 20, "persist": 30}.get(name, 5))
        while self.running:
            try:
                count = await handler()
                self.last_run[name] = time.time()
                self.entries_ingested[name] = self.entries_ingested.get(name, 0) + count
                logger.info("RAG scheduled task '%s' completed: %d entries", name, count)
            except Exception as e:
                logger.warning("RAG scheduled task '%s' failed: %s", name, e)
            await asyncio.sleep(self.intervals.get(name, 900))

    async def _ingest_news(self) -> int:
        """Ingest latest news for watchlist symbols."""
        from data.news_data import NewsService
        from ai.sentiment import SentimentAnalyzer
        from ai.rag import rag_engine

        news_svc = NewsService()
        sentiment_svc = SentimentAnalyzer()
        count = 0
        try:
            articles = await news_svc.fetch_articles("general", self._watchlist, limit=10)
            analysed = await sentiment_svc.analyse_batch(articles)
            for article in analysed[:5]:
                s = article.get("sentiment", {})
                if s.get("label"):
                    await rag_engine.ingest_news_analysis(article, s)
                    count += 1
        except Exception as e:
            logger.warning("News ingestion error: %s", e)
        return count

    async def _ingest_market(self) -> int:
        """Ingest market summaries for watchlist symbols."""
        from data.market_data import MarketDataService
        from quant.indicators import IndicatorEngine
        from ai.rag import rag_engine

        market_svc = MarketDataService()
        ind_engine = IndicatorEngine()
        count = 0
        for symbol in self._watchlist[:5]:
            try:
                history = await market_svc.get_history(symbol, "1mo", "1d")
                ind_data = ind_engine.calculate(history, ["rsi", "macd", "sma"])
                rsi = ind_data.get("rsi", [])
                rsi_val = rsi[-1] if rsi else None
                summary = f"Price data for {symbol}. RSI: {rsi_val}"
                await rag_engine.ingest_market_summary(symbol, summary, {"rsi": rsi_val})
                count += 1
            except Exception as e:
                logger.warning("Market ingestion error for %s: %s", symbol, e)
        return count

    async def _persist_to_supabase(self) -> int:
        """Persist important live entries to Supabase for long-term storage."""
        from ai.rag import rag_engine

        count = 0
        if not rag_engine._supabase_url or not rag_engine._supabase_key:
            return 0
        # Persist entries with high relevance (those that have been queried recently)
        for entry_id, entry in list(rag_engine.live_store.entries.items()):
            try:
                result = await rag_engine.ingest_persistent(
                    entry.text,
                    doc_type=entry.metadata.get("type", "live_data"),
                    metadata=entry.metadata,
                )
                if result:
                    count += 1
            except Exception as e:
                logger.warning("Persist error: %s", e)
            if count >= 20:  # Batch limit
                break
        return count


# Singleton
rag_scheduler = RAGScheduler()
