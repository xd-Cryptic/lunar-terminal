"""AI sentiment analysis engine.

Uses FinBERT (local GPU) for fast sentiment scoring,
with Ollama (local LLM) fallback for deep analysis.
Token reduction pipeline minimises processing cost.
"""

import asyncio
import hashlib
import json
import logging
from typing import Optional

import httpx
from cachetools import TTLCache

from config import settings, DEVICE

logger = logging.getLogger("terminal.ai")

# 24-hour cache for sentiment results (per article URL)
_sentiment_cache: TTLCache = TTLCache(maxsize=1000, ttl=86400)

# Lazy-loaded FinBERT model
_finbert_pipeline = None


def _get_finbert():
    """Lazy-load FinBERT pipeline on first use (runs on GPU)."""
    global _finbert_pipeline
    if _finbert_pipeline is None:
        logger.info("Loading FinBERT model on %s ...", DEVICE)
        from transformers import pipeline
        device_num = 0 if str(DEVICE) == "cuda" else (-1 if str(DEVICE) == "cpu" else 0)
        _finbert_pipeline = pipeline(
            "sentiment-analysis",
            model="ProsusAI/finbert",
            device=device_num,
            truncation=True,
            max_length=512,
        )
        logger.info("FinBERT loaded successfully.")
    return _finbert_pipeline


class TokenReducer:
    """Reduce article text to minimal tokens before LLM processing.

    Pipeline:
        1. Extract headline + first 2 paragraphs (~300 tokens)
        2. KeyBERT keyword extraction (~50 tokens)
        3. Ticker-specific filter
        4. FinBERT sentiment (local GPU)
        5. Only ambiguous → Ollama for deep analysis
    """

    @staticmethod
    def compress(article: dict) -> str:
        """Compress article to minimal text for sentiment analysis."""
        title = article.get("title", "")
        summary = article.get("summary", "")

        # Step 1: Take headline + first ~300 chars of summary
        compressed = f"{title}. {summary[:500]}"
        return compressed.strip()

    @staticmethod
    def extract_keywords(text: str, top_n: int = 10) -> list[str]:
        """Extract keywords using simple TF approach (KeyBERT loaded lazily)."""
        # Simple keyword extraction without loading KeyBERT for speed
        import re
        words = re.findall(r'\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b', text)
        # Also find ticker-like patterns
        tickers = re.findall(r'\b[A-Z]{2,5}\b', text)
        return list(set(words[:top_n] + tickers[:5]))


class SentimentAnalyzer:
    """Analyse financial news sentiment using FinBERT + Ollama."""

    def __init__(self):
        self._http = httpx.AsyncClient(timeout=30)
        self.reducer = TokenReducer()

    async def analyse_batch(self, articles: list[dict]) -> list[dict]:
        """Analyse sentiment of multiple articles. Returns articles with sentiment scores."""
        results = []
        for article in articles:
            analysed = await self._analyse_single(article)
            results.append(analysed)
        return results

    async def _analyse_single(self, article: dict) -> dict:
        """Analyse a single article's sentiment."""
        # Check cache (keyed by URL hash)
        url = article.get("url", "")
        cache_key = hashlib.md5(url.encode()).hexdigest()
        if cache_key in _sentiment_cache:
            cached = _sentiment_cache[cache_key]
            article["sentiment"] = cached
            return article

        # Step 1: Compress text
        text = self.reducer.compress(article)
        if not text:
            article["sentiment"] = {"label": "neutral", "score": 0.5, "method": "no_text"}
            return article

        # Step 2: Run FinBERT (local GPU)
        try:
            sentiment = await self._finbert_analyse(text)
        except Exception as exc:
            logger.warning("FinBERT failed, falling back to Ollama: %s", exc)
            sentiment = await self._ollama_analyse(text)

        # Step 3: If ambiguous (score < 0.6), use Ollama for deeper analysis
        if sentiment.get("score", 0) < 0.6 and sentiment.get("method") == "finbert":
            try:
                deep = await self._ollama_analyse(text)
                if deep.get("score", 0) > sentiment.get("score", 0):
                    sentiment = deep
            except Exception:
                pass  # Keep FinBERT result

        _sentiment_cache[cache_key] = sentiment
        article["sentiment"] = sentiment
        return article

    async def _finbert_analyse(self, text: str) -> dict:
        """Run FinBERT sentiment analysis (local GPU)."""
        loop = asyncio.get_event_loop()
        pipe = _get_finbert()
        result = await loop.run_in_executor(None, pipe, text[:512])

        if result:
            r = result[0]
            label = r["label"].lower()
            # Normalise FinBERT labels
            if label == "positive":
                label = "bullish"
            elif label == "negative":
                label = "bearish"
            else:
                label = "neutral"
            return {
                "label": label,
                "score": round(r["score"], 3),
                "method": "finbert",
            }
        return {"label": "neutral", "score": 0.5, "method": "finbert"}

    async def _ollama_analyse(self, text: str) -> dict:
        """Run sentiment analysis via local Ollama LLM (qwen3:2b)."""
        prompt = (
            f"/no_think\n"
            f"Analyse the following financial news text and return a JSON object with:\n"
            f"- label: 'bullish', 'bearish', or 'neutral'\n"
            f"- score: confidence from 0.0 to 1.0\n"
            f"- reasoning: one sentence explaining why\n\n"
            f"Text: {text[:800]}\n\n"
            f"Return ONLY valid JSON, nothing else."
        )

        try:
            resp = await self._http.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": settings.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 512},
                },
            )
            raw = resp.json().get("response", "")
            # Parse JSON from response
            parsed = json.loads(raw)
            return {
                "label": parsed.get("label", "neutral"),
                "score": float(parsed.get("score", 0.5)),
                "reasoning": parsed.get("reasoning", ""),
                "method": "ollama",
            }
        except Exception as exc:
            logger.warning("Ollama sentiment failed: %s", exc)
            return {"label": "neutral", "score": 0.5, "method": "fallback"}

    async def ticker_summary(self, symbol: str, articles: list[dict]) -> dict:
        """Generate an overall sentiment summary for a specific ticker."""
        analysed = await self.analyse_batch(articles)

        sentiments = [a.get("sentiment", {}) for a in analysed]
        bullish = sum(1 for s in sentiments if s.get("label") == "bullish")
        bearish = sum(1 for s in sentiments if s.get("label") == "bearish")
        neutral = sum(1 for s in sentiments if s.get("label") == "neutral")
        total = len(sentiments) or 1

        avg_score = sum(
            (s.get("score", 0.5) if s.get("label") == "bullish" else -s.get("score", 0.5) if s.get("label") == "bearish" else 0)
            for s in sentiments
        ) / total

        overall = "bullish" if avg_score > 0.1 else "bearish" if avg_score < -0.1 else "neutral"

        return {
            "symbol": symbol,
            "overall_sentiment": overall,
            "confidence": round(abs(avg_score), 3),
            "breakdown": {"bullish": bullish, "bearish": bearish, "neutral": neutral},
            "article_count": total,
            "articles": analysed[:5],  # Top 5 articles
        }
