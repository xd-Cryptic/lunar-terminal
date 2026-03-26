"""News data service — aggregates financial news from multiple sources.

Sources:
    - Financial Times (user's subscription via API/RSS)
    - Finnhub (free tier, 60 calls/min)
    - SEC EDGAR (free, filings)
    - FRED (free, macro data)
    - Reddit PRAW / Stocktwits (free, sentiment)
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

import feedparser
import httpx
from cachetools import TTLCache

from config import settings

logger = logging.getLogger("terminal.news")

# 10-minute cache for news articles
_news_cache: TTLCache = TTLCache(maxsize=100, ttl=600)

# RSS feeds by source
RSS_FEEDS = {
    "ft": {
        "home": "https://www.ft.com/?format=rss",
        "markets": "https://www.ft.com/markets?format=rss",
        "companies": "https://www.ft.com/companies?format=rss",
        "world": "https://www.ft.com/world?format=rss",
        "technology": "https://www.ft.com/technology?format=rss",
    },
    "cnbc": {
        "home": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
        "markets": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
        "technology": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910",
        "world": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362",
    },
    "marketwatch": {
        "home": "https://feeds.marketwatch.com/marketwatch/topstories",
        "markets": "https://feeds.marketwatch.com/marketwatch/marketpulse",
    },
    "yahoo": {
        "home": "https://finance.yahoo.com/news/rssindex",
    },
    "investing": {
        "home": "https://www.investing.com/rss/news.rss",
        "crypto": "https://www.investing.com/rss/news_14.rss",
        "forex": "https://www.investing.com/rss/news_1.rss",
    },
}

SOURCE_NAMES = {
    "ft": "Financial Times",
    "cnbc": "CNBC",
    "marketwatch": "MarketWatch",
    "yahoo": "Yahoo Finance",
    "investing": "Investing.com",
}

# Category mapping: frontend category → best RSS feed key per source
CATEGORY_MAP = {
    "general": "home",
    "markets": "markets",
    "companies": "companies",
    "world": "world",
    "technology": "technology",
    "crypto": "crypto",
    "forex": "forex",
    "macro": "world",
}


class NewsService:
    """Aggregates news from FT, Finnhub, and other sources."""

    def __init__(self):
        self._http = httpx.AsyncClient(timeout=15)

    async def fetch_articles(
        self,
        category: str = "general",
        tickers: Optional[list[str]] = None,
        limit: int = 20,
    ) -> list[dict]:
        """Fetch and merge articles from all sources."""
        cache_key = f"{category}:{','.join(tickers or [])}:{limit}"
        if cache_key in _news_cache:
            return _news_cache[cache_key]

        # Fetch from all RSS sources + Finnhub concurrently
        tasks = []
        for source_id in RSS_FEEDS:
            tasks.append(self._fetch_rss(source_id, category))
        tasks.append(self._fetch_finnhub(tickers))
        results = await asyncio.gather(*tasks, return_exceptions=True)

        articles = []
        for result in results:
            if isinstance(result, Exception):
                logger.warning("News fetch error: %s", result)
                continue
            articles.extend(result)

        # Deduplicate by title similarity
        seen_titles = set()
        unique = []
        for a in articles:
            key = a.get("title", "").lower().strip()[:60]
            if key and key not in seen_titles:
                seen_titles.add(key)
                unique.append(a)
        articles = unique

        # Sort by date, newest first
        articles.sort(key=lambda a: a.get("published", ""), reverse=True)

        # Filter by tickers if specified
        if tickers:
            ticker_set = {t.upper() for t in tickers}
            filtered = []
            for article in articles:
                text = (article.get("title", "") + " " + article.get("summary", "")).upper()
                if any(t in text for t in ticker_set):
                    filtered.append(article)
            articles = filtered if filtered else articles

        articles = articles[:limit]
        _news_cache[cache_key] = articles
        return articles

    async def _fetch_rss(self, source_id: str, category: str = "general") -> list[dict]:
        """Fetch articles from an RSS source."""
        feeds = RSS_FEEDS.get(source_id, {})
        feed_key = CATEGORY_MAP.get(category, "home")
        feed_url = feeds.get(feed_key) or feeds.get("home")
        if not feed_url:
            return []

        source_name = SOURCE_NAMES.get(source_id, source_id)
        loop = asyncio.get_event_loop()
        try:
            feed = await loop.run_in_executor(None, feedparser.parse, feed_url)
            articles = []
            for entry in feed.entries[:10]:
                articles.append({
                    "title": entry.get("title", ""),
                    "summary": entry.get("summary", ""),
                    "url": entry.get("link", ""),
                    "published": entry.get("published", ""),
                    "source": source_name,
                    "category": category,
                })
            return articles
        except Exception as exc:
            logger.error("%s RSS error: %s", source_name, exc)
            return []

    async def _fetch_finnhub(self, tickers: Optional[list[str]] = None) -> list[dict]:
        """Fetch company news from Finnhub."""
        if not settings.finnhub_api_key:
            return []

        articles = []
        symbols = tickers or ["AAPL", "MSFT", "GOOGL"]

        for symbol in symbols[:5]:  # Limit to avoid rate limits
            try:
                today = datetime.utcnow().strftime("%Y-%m-%d")
                week_ago = (datetime.utcnow() - __import__("datetime").timedelta(days=7)).strftime("%Y-%m-%d")

                resp = await self._http.get(
                    "https://finnhub.io/api/v1/company-news",
                    params={
                        "symbol": symbol,
                        "from": week_ago,
                        "to": today,
                        "token": settings.finnhub_api_key,
                    },
                )
                data = resp.json()
                for item in data[:10]:
                    articles.append({
                        "title": item.get("headline", ""),
                        "summary": item.get("summary", ""),
                        "url": item.get("url", ""),
                        "published": datetime.fromtimestamp(item.get("datetime", 0)).isoformat(),
                        "source": item.get("source", "Finnhub"),
                        "category": "company",
                        "ticker": symbol,
                        "image": item.get("image", ""),
                    })
            except Exception as exc:
                logger.warning("Finnhub error for %s: %s", symbol, exc)

        return articles

    async def fetch_macro_data(self) -> list[dict]:
        """Fetch key macro indicators from FRED."""
        series = {
            "GDP": "GDP",
            "CPI": "CPIAUCSL",
            "Unemployment": "UNRATE",
            "Fed Funds Rate": "FEDFUNDS",
            "10Y Treasury": "DGS10",
        }
        results = []
        for name, series_id in series.items():
            try:
                resp = await self._http.get(
                    f"https://api.stlouisfed.org/fred/series/observations",
                    params={
                        "series_id": series_id,
                        "api_key": "DEMO_KEY",  # FRED demo key works for basic access
                        "file_type": "json",
                        "sort_order": "desc",
                        "limit": 1,
                    },
                )
                data = resp.json()
                obs = data.get("observations", [{}])[0]
                results.append({
                    "name": name,
                    "value": obs.get("value", "N/A"),
                    "date": obs.get("date", ""),
                })
            except Exception as exc:
                logger.warning("FRED error for %s: %s", name, exc)
        return results
