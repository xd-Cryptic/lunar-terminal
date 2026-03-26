"""REST API routes for the Stock Terminal."""

from fastapi import APIRouter, Query, Body
from typing import Optional
import pandas as pd

from data.market_data import MarketDataService
from data.news_data import NewsService
from quant.indicators import IndicatorEngine
from quant.risk import RiskManager
from ai.sentiment import SentimentAnalyzer
from backtesting.engine import BacktestEngine
from portfolio.optimizer import PortfolioOptimizer
from portfolio.diversification import DiversificationManager
from portfolio.demo_accounts import DemoAccountManager

router = APIRouter()

market = MarketDataService()
news = NewsService()
indicators = IndicatorEngine()
risk_mgr = RiskManager()
sentiment = SentimentAnalyzer()
backtest = BacktestEngine()
optimizer = PortfolioOptimizer()
diversification = DiversificationManager()
demo_mgr = DemoAccountManager()


# ── Market Data ───────────────────────────────────────────────────────────────

@router.get("/market/quote/{symbol}")
async def get_quote(symbol: str):
    return await market.get_quote(symbol)


@router.get("/market/history/{symbol}")
async def get_history(
    symbol: str,
    period: str = Query("1y"),
    interval: str = Query("1d"),
):
    return await market.get_history(symbol, period, interval)


@router.get("/market/search")
async def search_symbols(q: str = Query(..., min_length=1)):
    return await market.search(q)


@router.get("/market/screener")
async def screen_stocks(
    market_type: str = Query("stocks"),
    min_volume: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
):
    return await market.screen(market_type, min_volume, min_price, max_price)


# ── Quant / Indicators ────────────────────────────────────────────────────────

@router.get("/quant/indicators/{symbol}")
async def get_indicators(
    symbol: str,
    period: str = "1y",
    interval: str = "1d",
    indicator_list: str = Query("sma,ema,rsi,macd,bbands,atr,adx,vwap"),
):
    history = await market.get_history(symbol, period, interval)
    selected = [i.strip() for i in indicator_list.split(",")]
    return indicators.calculate(history, selected)


@router.get("/quant/signals/{symbol}")
async def get_swing_signals(symbol: str, mode: str = Query("lft")):
    interval = "1m" if mode == "hft" else "1d"
    period = "5d" if mode == "hft" else "1y"
    history = await market.get_history(symbol, period, interval)
    return indicators.swing_signals(history, mode)


# ── Risk Management ──────────────────────────────────────────────────────────

@router.post("/risk/position-size")
async def calculate_position_size(
    account_value: float = Body(...),
    risk_pct: float = Body(0.02),
    entry_price: float = Body(...),
    stop_loss_price: float = Body(...),
    platform_fee_pct: float = Body(0.0),
):
    return risk_mgr.position_size(account_value, risk_pct, entry_price, stop_loss_price, platform_fee_pct)


@router.get("/risk/safety-status")
async def get_safety_status():
    return risk_mgr.get_safety_status()


@router.post("/risk/check-order")
async def check_order(order: dict = Body(...), market_type: str = Body("stocks")):
    return risk_mgr.check_order(order, market_type)


# ── News & AI Sentiment ──────────────────────────────────────────────────────

@router.get("/news/feed")
async def get_news_feed(
    tickers: Optional[str] = None,
    category: str = Query("general"),
    limit: int = 20,
):
    ticker_list = [t.strip() for t in tickers.split(",")] if tickers else None
    articles = await news.fetch_articles(category, ticker_list, limit)
    analysed = await sentiment.analyse_batch(articles)

    # Auto-ingest top articles into RAG
    try:
        from ai.rag import rag_engine
        for article in analysed[:5]:
            s = article.get("sentiment", {})
            if s.get("label"):
                await rag_engine.ingest_news_analysis(article, s)
    except Exception:
        pass

    return analysed


@router.get("/news/sentiment/{symbol}")
async def get_ticker_sentiment(symbol: str):
    articles = await news.fetch_articles("general", [symbol], limit=10)
    return await sentiment.ticker_summary(symbol, articles)


@router.get("/news/macro")
async def get_macro_data():
    return await news.fetch_macro_data()


# ── Backtesting ──────────────────────────────────────────────────────────────

@router.post("/backtest/run")
async def run_backtest(
    symbol: str = Body(...),
    strategy: str = Body("sma_cross"),
    period: str = Body("2y"),
    initial_capital: float = Body(10000.0),
    fee_pct: float = Body(0.001),
    params: Optional[dict] = Body(None),
):
    history = await market.get_history(symbol, period, "1d")
    return backtest.run(history, strategy, initial_capital, fee_pct, params)


@router.post("/backtest/batch")
async def run_backtest_batch(
    symbol: str = Body(...),
    strategy: str = Body("sma_cross"),
    capital_levels: list[float] = Body([1000, 5000, 10000, 25000, 50000, 100000]),
    fee_pct: float = Body(0.001),
):
    history = await market.get_history(symbol, "2y", "1d")
    return backtest.run_batch(history, strategy, capital_levels, fee_pct)


@router.get("/backtest/strategies")
async def list_strategies():
    return backtest.list_strategies()


# ── Portfolio ────────────────────────────────────────────────────────────────

@router.post("/portfolio/optimise")
async def optimise_portfolio(
    symbols: list[str] = Body(...),
    method: str = Body("max_sharpe"),
    risk_free_rate: float = Body(0.04),
):
    return await optimizer.optimise(symbols, method, risk_free_rate)


@router.post("/portfolio/diversification")
async def analyse_diversification(holdings: dict = Body(...)):
    return await diversification.analyse(holdings)


@router.post("/portfolio/rebalance")
async def suggest_rebalance(
    holdings: dict = Body(...),
    target_allocations: Optional[dict] = Body(None),
):
    return await diversification.rebalance(holdings, target_allocations)


# ── Demo Accounts ────────────────────────────────────────────────────────────

@router.post("/accounts/create")
async def create_demo_account(
    name: str = Body("Demo Account"),
    initial_capital: float = Body(10000.0),
    market: str = Body("stocks"),
    fee_pct: float = Body(0.001),
):
    return demo_mgr.create(name, initial_capital, market, fee_pct)


@router.get("/accounts")
async def list_demo_accounts():
    return demo_mgr.list_accounts()


@router.get("/accounts/{account_id}")
async def get_demo_account(account_id: str):
    result = demo_mgr.get(account_id)
    if not result:
        return {"error": "Account not found"}
    return result


@router.delete("/accounts/{account_id}")
async def delete_demo_account(account_id: str):
    if demo_mgr.delete(account_id):
        return {"success": True}
    return {"error": "Account not found"}


@router.post("/accounts/{account_id}/trade")
async def demo_trade(
    account_id: str,
    symbol: str = Body(...),
    side: str = Body(...),
    quantity: float = Body(...),
    price: float = Body(...),
):
    return demo_mgr.trade(account_id, symbol, side, quantity, price)


# ── Algos (Phase 2) ──────────────────────────────────────────────────────────

import os, importlib, sys, traceback
from pathlib import Path

ALGOS_DIR = Path(__file__).parent.parent / "algos"

def _load_algo_metadata():
    """Scan algos/ directory and return list of algo metadata."""
    ALGOS_DIR.mkdir(exist_ok=True)
    algos = []
    for f in sorted(ALGOS_DIR.glob("*.py")):
        if f.name.startswith("_"): continue
        algos.append({
            "name": f.name,
            "enabled": True,
            "markets": ["stocks", "crypto", "forex"],
            "last_modified": f.stat().st_mtime,
            "size_bytes": f.stat().st_size,
        })
    return algos


@router.get("/algos")
async def list_algos():
    return {"algos": _load_algo_metadata()}


@router.post("/algos/reload")
async def reload_algos():
    """Hot-reload all algo modules — triggered by file watcher or Deploy button."""
    reloaded = []
    for f in ALGOS_DIR.glob("*.py"):
        if f.name.startswith("_"): continue
        module_name = f"algos.{f.stem}"
        if module_name in sys.modules:
            try:
                importlib.reload(sys.modules[module_name])
                reloaded.append(f.name)
            except Exception:
                pass
    return {"status": "reloaded", "modules": reloaded, "total": len(reloaded)}


@router.post("/algos/test")
async def test_algo(
    code: str = Body(...),
    params: Optional[dict] = Body(None),
):
    """Execute algo code on recent market data and return generated signals."""
    symbol = (params or {}).get("symbol", "AAPL")
    try:
        history = await market.get_history(symbol, "6mo", "1d")
        df = history.get("data") if isinstance(history, dict) else history

        namespace = {}
        exec(compile(code, "<algo>", "exec"), namespace)
        run_fn = namespace.get("run_strategy")
        if not run_fn:
            return {"signals": [], "error": "No run_strategy(df, params) function found"}

        signals = run_fn(df, params or {})
        return {"signals": signals[:50], "total": len(signals)}
    except Exception as e:
        return {"signals": [], "error": str(e), "traceback": traceback.format_exc()}


# ── Chart Data (for AnalysisEnv Lightweight Charts) ──────────────────────────

@router.get("/chart-data")
async def get_chart_data(
    symbol: str = Query(...),
    interval: str = Query("1D"),
    bars: int = Query(200),
):
    """Return OHLCV bars in Lightweight Charts format (time as Unix timestamp)."""
    period_map = {
        "1m": "5d", "5m": "5d", "15m": "1mo", "30m": "1mo",
        "1H": "3mo", "4H": "6mo", "1D": "2y", "1W": "5y", "1M": "10y"
    }
    interval_map = {
        "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
        "1H": "60m", "4H": "1h", "1D": "1d", "1W": "1wk", "1M": "1mo"
    }
    period   = period_map.get(interval, "2y")
    yf_interval = interval_map.get(interval, "1d")
    history  = await market.get_history(symbol, period, yf_interval)
    data = history.get("data", []) if isinstance(history, dict) else history

    if not data:
        return {"bars": [], "symbol": symbol}

    bars_out = []
    for item in data[-bars:]:
        try:
            dt = item.get("date", "")
            if isinstance(dt, str) and dt:
                ts = int(pd.to_datetime(dt, utc=True).timestamp())
            else:
                ts = int(dt) if dt else 0
            bars_out.append({
                "time":  ts,
                "open":  round(float(item.get("open", 0)), 4),
                "high":  round(float(item.get("high", 0)), 4),
                "low":   round(float(item.get("low",  0)), 4),
                "close": round(float(item.get("close", 0)), 4),
                "volume":int(item.get("volume", 0)),
            })
        except Exception:
            continue

    return {"bars": bars_out, "symbol": symbol, "interval": interval}


# ── Portfolio Simple Summary (for SimpleView) ─────────────────────────────────

@router.get("/portfolio/simple-summary")
async def simple_portfolio_summary():
    """Lightweight summary for the Simple View dashboard."""
    return {
        "total_value":  24580.0,
        "day_pnl":       312.0,
        "day_pnl_pct":   1.29,
        "weekly_pnl":   1240.0,
        "weekly_pnl_pct": 5.32,
        "markets": {
            "stocks": {"value": 10200, "pnl": 145.0, "pnl_pct": 1.44},
            "crypto": {"value":  8800, "pnl": 122.0, "pnl_pct": 1.41},
            "forex":  {"value":  5580, "pnl":  45.0, "pnl_pct": 0.81},
        },
        "algos_running": 2,
        "algo_status": [
            {"name": "RSI-MACD", "enabled": True,  "market": "stocks"},
            {"name": "SMA Cross", "enabled": True,  "market": "stocks"},
            {"name": "Scalper",   "enabled": False, "market": "crypto"},
        ],
    }


# ── AI Analysis (Ollama local model) ─────────────────────────────────────────

@router.post("/ai/analyse")
async def ai_analyse(
    symbol: str = Body("AAPL"),
    timeframe: str = Body("1D"),
    indicators: list[str] = Body(["RSI", "MACD"]),
    prompt: str = Body(""),
    system_prompt: str = Body(""),
    temperature: float = Body(0.3),
    max_tokens: int = Body(2048),
    model: str = Body(""),
):
    """Run local Ollama analysis (qwen3:2b) with tunable parameters. Auto-ingests into RAG."""
    import httpx, os
    from config import settings, DEVICE

    ollama_url = os.getenv("OLLAMA_BASE_URL", settings.ollama_base_url)
    chosen_model = model or os.getenv("OLLAMA_MODEL", settings.ollama_model)

    sys_prompt = system_prompt or (
        "You are a quantitative trading analyst at a hedge fund. "
        "Analyze market data with precision. Focus on technical patterns, "
        "risk/reward ratios, and actionable insights with specific levels."
    )

    user_prompt = prompt or f"""Analyse {symbol} on the {timeframe} timeframe.
Active indicators: {', '.join(indicators)}.
Provide:
1. Technical setup (2-3 sentences)
2. Key levels to watch (support / resistance)
3. Risk/reward assessment
4. One actionable insight
Keep it concise and data-driven."""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": chosen_model,
                    "system": sys_prompt,
                    "prompt": user_prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
            )
            data = resp.json()
            response_text = data.get("response", "No response")

            # Auto-ingest into RAG for future context
            try:
                from ai.rag import rag_engine
                await rag_engine.ingest_ai_analysis(symbol, response_text, "general")
            except Exception:
                pass

            return {
                "response": response_text,
                "model": chosen_model,
                "device": str(DEVICE),
                "done": data.get("done", False),
            }
    except Exception as e:
        return {
            "response": f"Ollama not running or unreachable.\n\nTo start: ollama serve\nModel: {chosen_model}\n\nError: {str(e)}",
            "model": chosen_model,
            "error": True,
        }


@router.post("/ai/analyse-news")
async def analyse_news_article(
    title: str = Body(...),
    summary: str = Body(""),
    url: str = Body(""),
):
    """Analyse a single news article for sentiment with reasoning."""
    article = {"title": title, "summary": summary, "url": url}
    result = await sentiment._analyse_single(article)
    return {"sentiment": result.get("sentiment", {}), "title": title}


@router.post("/ai/batch-sentiment")
async def batch_sentiment_endpoint(articles: list[dict] = Body(...)):
    """Analyse multiple articles for sentiment."""
    results = await sentiment.analyse_batch(articles)
    return {"articles": results}


@router.get("/ai/models")
async def list_ai_models():
    """List available Ollama models."""
    import httpx
    from config import settings
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            data = resp.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"models": models, "current": settings.ollama_model}
    except Exception as exc:
        return {"models": [], "current": settings.ollama_model, "error": str(exc)}


@router.get("/ai/device")
async def get_ai_device_info():
    """Get compute device information."""
    from config import DEVICE, settings
    info = {"device": str(DEVICE), "ollama_url": settings.ollama_base_url, "ollama_model": settings.ollama_model}
    try:
        import torch
        if torch.cuda.is_available():
            info["gpu_name"] = torch.cuda.get_device_name(0)
            info["gpu_memory_gb"] = round(torch.cuda.get_device_properties(0).total_mem / 1e9, 1)
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            info["gpu_name"] = "Apple Silicon (MPS)"
    except ImportError:
        pass
    return info


# ── Vault / Env Sync ─────────────────────────────────────────────────────────

@router.post("/vault/sync-env")
async def sync_env_to_vault():
    """Push current backend .env API keys to Supabase Vault.
    Uses the service role key for direct access.
    """
    import httpx, os
    from config import settings

    if not settings.supabase_url or not settings.supabase_secret:
        return {"error": "Supabase not configured — set SUPABASE_URL and SUPABASE_SECRET in backend/.env"}

    headers = {
        "apikey": settings.supabase_secret,
        "Authorization": f"Bearer {settings.supabase_secret}",
        "Content-Type": "application/json",
    }

    # Map of vault service names → current values
    keys_to_sync = {
        "alpaca_api_key": settings.alpaca_api_key,
        "alpaca_secret_key": settings.alpaca_secret_key,
        "alpaca_base_url": settings.alpaca_base_url,
        "alpaca_live_key": settings.alpaca_live_key,
        "alpaca_live_secret": settings.alpaca_live_secret,
        "alpaca_live_base_url": settings.alpaca_live_base_url,
        "binance_api_key": settings.binance_api_key,
        "binance_secret_key": settings.binance_secret_key,
        "oanda_api_key": settings.oanda_api_key,
        "oanda_account_id": settings.oanda_account_id,
        "twelve_data_api_key": settings.twelve_data_api_key,
        "finnhub_api_key": settings.finnhub_api_key,
        "finnhub_secret_key": settings.finnhub_secret_key,
        "fred_api_key": settings.fred_api_key,
        "openai_api_key": settings.openai_api_key,
        "ollama_base_url": settings.ollama_base_url,
        "ollama_model": settings.ollama_model,
    }

    synced = []
    skipped = []
    failed = []

    async with httpx.AsyncClient(timeout=15) as client:
        for service, value in keys_to_sync.items():
            if not value or value.startswith("your_"):
                skipped.append(service)
                continue

            try:
                resp = await client.post(
                    f"{settings.supabase_url}/rest/v1/rpc/vault_store_secret",
                    json={
                        "p_service": service,
                        "p_secret": value,
                        "p_description": f"{service} (synced from backend/.env)",
                    },
                    headers=headers,
                )
                if resp.status_code in (200, 201):
                    synced.append(service)
                else:
                    failed.append({"service": service, "status": resp.status_code, "detail": resp.text[:200]})
            except Exception as e:
                failed.append({"service": service, "error": str(e)})

    return {
        "synced": synced,
        "skipped": skipped,
        "failed": failed,
        "total": len(keys_to_sync),
    }


# ── ML Training (Phase 3) ────────────────────────────────────────────────────

@router.post("/ml/train")
async def train_ml_model(config: dict = Body(...)):
    """Train a ML model for price prediction. Uses scikit-learn on available device."""
    from config import DEVICE
    model_type = config.get("model_type", "random_forest")
    symbol = config.get("symbol", "AAPL")
    features = config.get("features", ["rsi", "macd", "sma", "volume"])
    lookback = config.get("lookback", 60)
    split = config.get("train_test_split", 0.8)

    try:
        # Fetch historical data
        history = market.get_history(symbol, period="2y", interval="1d")
        data = history.get("data", []) if isinstance(history, dict) else history
        if len(data) < lookback + 50:
            return {"error": f"Not enough data for {symbol} (got {len(data)} bars, need {lookback + 50})"}

        import numpy as np
        df = pd.DataFrame(data)
        df["date"] = pd.to_datetime(df["date"], utc=True)
        df = df.sort_values("date").reset_index(drop=True)

        # Build feature matrix
        X_cols = []
        if "rsi" in features:
            import ta as ta_lib
            df["feat_rsi"] = ta_lib.momentum.RSIIndicator(df["close"], window=14).rsi()
            X_cols.append("feat_rsi")
        if "sma" in features:
            df["feat_sma20"] = df["close"].rolling(20).mean()
            df["feat_sma_ratio"] = df["close"] / df["feat_sma20"]
            X_cols.append("feat_sma_ratio")
        if "volume" in features:
            df["feat_vol_ratio"] = df["volume"] / df["volume"].rolling(20).mean()
            X_cols.append("feat_vol_ratio")
        if "macd" in features:
            import ta as ta_lib
            macd = ta_lib.trend.MACD(df["close"])
            df["feat_macd"] = macd.macd_diff()
            X_cols.append("feat_macd")

        # Target: next day return direction (1 = up, 0 = down)
        df["target"] = (df["close"].shift(-1) > df["close"]).astype(int)
        df = df.dropna().reset_index(drop=True)

        X = df[X_cols].values
        y = df["target"].values

        split_idx = int(len(X) * split)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]

        from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
        if model_type == "gradient_boost":
            clf = GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42)
        else:
            clf = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)

        clf.fit(X_train, y_train)
        train_acc = round(clf.score(X_train, y_train), 4)
        test_acc = round(clf.score(X_test, y_test), 4)

        from sklearn.metrics import precision_score, recall_score
        y_pred = clf.predict(X_test)
        precision = round(precision_score(y_test, y_pred, zero_division=0), 4)
        recall = round(recall_score(y_test, y_pred, zero_division=0), 4)

        # Feature importance
        importances = {X_cols[i]: round(float(clf.feature_importances_[i]), 4) for i in range(len(X_cols))}

        return {
            "status": "complete",
            "model_type": model_type,
            "symbol": symbol,
            "device": str(DEVICE),
            "samples": {"train": len(X_train), "test": len(X_test)},
            "metrics": {
                "train_accuracy": train_acc,
                "test_accuracy": test_acc,
                "precision": precision,
                "recall": recall,
            },
            "feature_importance": importances,
            "features_used": X_cols,
        }
    except ImportError as e:
        return {"error": f"ML dependency missing: {e}. Install: pip install scikit-learn"}
    except Exception as e:
        return {"error": f"Training failed: {str(e)}"}


@router.get("/ml/models")
async def list_ml_models():
    """List available ML model types."""
    return {
        "models": [
            {"id": "random_forest", "name": "Random Forest", "status": "available"},
            {"id": "gradient_boost", "name": "Gradient Boosting", "status": "available"},
            {"id": "lstm", "name": "LSTM Neural Network", "status": "requires_torch"},
            {"id": "xgboost", "name": "XGBoost", "status": "requires_xgboost"},
        ]
    }


# ── RAG (Retrieval Augmented Generation) ──────────────────────────────────────

@router.post("/rag/ingest")
async def rag_ingest(
    text: str = Body(...),
    doc_type: str = Body("general"),
    metadata: Optional[dict] = Body(None),
    persist: bool = Body(False),
):
    """Ingest text into RAG store (live and optionally persistent)."""
    from ai.rag import rag_engine
    live_id = await rag_engine.ingest_live(text, metadata)
    persistent_id = None
    if persist:
        persistent_id = await rag_engine.ingest_persistent(text, doc_type, metadata)
    return {"live_id": live_id, "persistent_id": persistent_id}


@router.post("/rag/query")
async def rag_query(
    query: str = Body(...),
    doc_type: Optional[str] = Body(None),
    top_k: int = Body(5),
):
    """Search RAG stores for relevant context."""
    from ai.rag import rag_engine
    results = await rag_engine.query(query, doc_type=doc_type, top_k=top_k)
    return {"results": results, "count": len(results)}


@router.post("/rag/generate")
async def rag_generate(
    query: str = Body(...),
    doc_type: Optional[str] = Body(None),
    system_prompt: str = Body(""),
    temperature: float = Body(0.1),
):
    """Full RAG pipeline: retrieve context → augment → generate with qwen3:2b."""
    from ai.rag import rag_engine
    result = await rag_engine.generate(
        query, doc_type=doc_type, system_prompt=system_prompt, temperature=temperature
    )
    return result


@router.get("/rag/status")
async def rag_status():
    """Get RAG engine status."""
    from ai.rag import rag_engine, RAG_MODEL, EMBED_MODEL, RAG_TEMPERATURE, RAG_MAX_TOKENS
    from config import settings
    return {
        "live_entries": rag_engine.live_store.count,
        "model": RAG_MODEL,
        "embed_model": EMBED_MODEL,
        "temperature": RAG_TEMPERATURE,
        "max_tokens": RAG_MAX_TOKENS,
        "supabase_configured": bool(settings.supabase_url and settings.supabase_secret),
    }


# ── RAG Scheduler ─────────────────────────────────────────────────────────────

@router.get("/rag/schedule")
async def rag_schedule_status():
    """Get RAG scheduler status and task info."""
    from ai.rag_scheduler import rag_scheduler
    return rag_scheduler.status()


@router.post("/rag/schedule/trigger")
async def rag_schedule_trigger(task: str = Body(..., embed=True)):
    """Manually trigger a specific RAG scheduled task."""
    from ai.rag_scheduler import rag_scheduler
    return await rag_scheduler.trigger(task)


@router.post("/rag/schedule/configure")
async def rag_schedule_configure(config: dict = Body(...)):
    """Update RAG scheduler intervals (minimum 60 seconds)."""
    from ai.rag_scheduler import rag_scheduler
    for task_name, interval in config.items():
        if isinstance(interval, (int, float)) and interval >= 60:
            rag_scheduler.update_interval(task_name, int(interval))
    return rag_scheduler.status()


@router.post("/rag/schedule/watchlist")
async def rag_schedule_watchlist(symbols: list[str] = Body(...)):
    """Update the RAG scheduler watchlist symbols."""
    from ai.rag_scheduler import rag_scheduler
    rag_scheduler.set_watchlist(symbols)
    return {"watchlist": symbols}


# ── Live AI Analysis ──────────────────────────────────────────────────────────

@router.post("/ai/live-analyse")
async def live_ai_analyse(
    symbol: str = Body("AAPL"),
    analysis_type: str = Body("comprehensive"),
    include_rag: bool = Body(True),
):
    """Run live AI analysis with RAG context. Auto-ingests results for future queries."""
    import httpx as _httpx
    from ai.rag import rag_engine
    from config import settings, DEVICE

    # 1. Gather live market data
    try:
        history = await market.get_history(symbol, "3mo", "1d")
        data = history.get("data", []) if isinstance(history, dict) else history
        recent = data[-5:] if data else []
        price_context = ", ".join(
            [f"{d.get('date','')}: O={d.get('open'):.2f} H={d.get('high'):.2f} L={d.get('low'):.2f} C={d.get('close'):.2f}" for d in recent]
        ) if recent else "No recent data available"
    except Exception:
        price_context = "Market data unavailable"

    # 2. Get indicator data
    try:
        ind_data = indicators.calculate(
            await market.get_history(symbol, "3mo", "1d"),
            ["rsi", "macd", "bbands", "atr", "sma", "ema"]
        )
        ind_summary = []
        for key in ["rsi", "macd", "atr"]:
            val = ind_data.get(key)
            if isinstance(val, dict):
                # Nested (macd has macd/signal/histogram)
                for sub_key, sub_val in val.items():
                    if isinstance(sub_val, list) and sub_val:
                        ind_summary.append(f"{key}.{sub_key}: {sub_val[-1]:.4f}" if sub_val[-1] is not None else "")
            elif isinstance(val, list) and val:
                ind_summary.append(f"{key}: {val[-1]:.4f}" if val[-1] is not None else "")
        indicator_context = "; ".join([s for s in ind_summary if s])
    except Exception:
        indicator_context = "Indicators unavailable"

    # 3. Get news sentiment
    try:
        articles = await news.fetch_articles("general", [symbol], limit=5)
        sentiments = await sentiment.analyse_batch(articles)
        news_context = "; ".join([
            f"{a.get('title', '')[:60]} [{a.get('sentiment', {}).get('label', 'unknown')}]"
            for a in sentiments[:3]
        ])
    except Exception:
        news_context = "News unavailable"

    # 4. RAG context retrieval
    rag_context = ""
    if include_rag:
        try:
            rag_results = await rag_engine.query(f"{symbol} {analysis_type} analysis", top_k=3)
            if rag_results:
                rag_context = "\n".join([f"- {r.get('text', r.get('content', ''))[:200]}" for r in rag_results])
        except Exception:
            pass

    # 5. Build comprehensive prompt
    system_prompt = (
        "You are a Senior Quantitative Analyst AI inside a live trading terminal. "
        "Provide precise, risk-adjusted analysis based on all available data. "
        "Structure your response as JSON with keys: summary, signal (BUY/SELL/HOLD), "
        "confidence (0-100), key_levels (support/resistance), risk_assessment, "
        "reasoning (2-3 sentences). Be concise and data-driven."
    )

    user_prompt = f"""/no_think
Analyse {symbol} — Live Terminal Analysis

## Recent Price Action
{price_context}

## Technical Indicators
{indicator_context}

## News Sentiment
{news_context}

{"## Historical Context (RAG)" + chr(10) + rag_context if rag_context else ""}

Provide a comprehensive {analysis_type} analysis. Output ONLY valid JSON."""

    # 6. Generate with qwen3:2b
    try:
        async with _httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": settings.ollama_model,
                    "system": system_prompt,
                    "prompt": user_prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 2048},
                },
            )
            ai_response = resp.json().get("response", "")
    except Exception as e:
        ai_response = f"AI analysis failed: {e}"

    # 7. Auto-ingest result into RAG for future context
    try:
        await rag_engine.ingest_ai_analysis(symbol, ai_response, analysis_type)
    except Exception:
        pass

    # 8. Parse JSON response if possible
    analysis = {"raw": ai_response}
    try:
        import json as _json
        # Try to extract JSON from the response
        raw = ai_response.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        analysis = _json.loads(raw)
    except Exception:
        analysis = {"summary": ai_response, "signal": "HOLD", "confidence": 50}

    return {
        "symbol": symbol,
        "analysis_type": analysis_type,
        "analysis": analysis,
        "model": settings.ollama_model,
        "device": str(DEVICE),
        "rag_context_used": bool(rag_context),
    }


@router.post("/ai/signal")
async def ai_signal(
    symbol: str = Body("AAPL", embed=True),
):
    """Quick AI signal generation — fast path for live dashboard display."""
    import httpx as _httpx
    from config import settings

    try:
        # Get latest price + RSI + MACD
        history = await market.get_history(symbol, "3mo", "1d")
        ind_data = indicators.calculate(history, ["rsi", "macd", "sma"])

        rsi_val = ind_data.get("rsi", [None])[-1] if isinstance(ind_data.get("rsi"), list) else None
        macd_data = ind_data.get("macd", {})
        macd_hist = macd_data.get("histogram", [None])[-1] if isinstance(macd_data.get("histogram"), list) else None

        prompt = (
            f"/no_think\n"
            f"Quick signal for {symbol}. RSI: {rsi_val}, MACD histogram: {macd_hist}. "
            f"Reply with ONLY one JSON object: "
            f'{{"signal": "BUY"|"SELL"|"HOLD", "confidence": 0-100, "reason": "one sentence"}}'
        )

        async with _httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": settings.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.05, "num_predict": 256},
                },
            )
            raw = resp.json().get("response", "").strip()
            import json as _json
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            signal = _json.loads(raw)
            signal["symbol"] = symbol
            signal["model"] = settings.ollama_model
            return signal
    except Exception as e:
        return {"symbol": symbol, "signal": "HOLD", "confidence": 0, "reason": f"Error: {e}", "error": True}


# ── Ticker Universe ──────────────────────────────────────────────────────────

@router.get("/market/universe/{market_type}")
async def get_ticker_universe(
    market_type: str,
    q: str = "",
    sector: str = "",
    offset: int = 0,
    limit: int = 100,
):
    """Return paginated ticker list with optional search and sector filter."""
    from data.ticker_universe import TickerUniverse
    universe = TickerUniverse()

    if q:
        items = universe.search(q, market_type)
    elif sector:
        items = [
            t for t in universe.get_universe(market_type)
            if t["sector"].lower() == sector.lower()
        ]
    else:
        items = universe.get_universe(market_type)

    total = len(items)
    page = items[offset : offset + limit]
    return {"items": page, "total": total, "offset": offset, "limit": limit}


@router.get("/market/universe/{market_type}/sectors")
async def get_market_sectors(market_type: str):
    """Return available sectors for a market type."""
    from data.ticker_universe import TickerUniverse
    universe = TickerUniverse()
    return {"market_type": market_type, "sectors": universe.get_sectors(market_type)}


@router.post("/market/compare")
async def compare_symbols(
    symbols: list[str] = Body(...),
    period: str = Body("6mo"),
    interval: str = Body("1d"),
):
    """Return normalised (rebased to 100) price series for symbol comparison."""
    series_map: dict[str, list] = {}
    dates: list[str] = []

    for sym in symbols[:10]:  # cap at 10 symbols
        try:
            history = await market.get_history(sym, period, interval)
            data = history.get("data", []) if isinstance(history, dict) else history
            if not data:
                continue
            closes = [float(d["close"]) for d in data]
            if not closes or closes[0] == 0:
                continue
            base = closes[0]
            series_map[sym] = [round(c / base * 100, 4) for c in closes]
            if not dates:
                dates = [d["date"] for d in data]
        except Exception:
            continue

    return {"dates": dates, "series": series_map, "period": period, "interval": interval}


@router.get("/indicators/available")
async def get_available_indicators():
    """Return available indicator groups and names from IndicatorEngine."""
    return {
        "trend": [
            {"id": "sma", "name": "Simple Moving Average (20)", "type": "overlay"},
            {"id": "sma_50", "name": "SMA 50", "type": "overlay"},
            {"id": "sma_200", "name": "SMA 200", "type": "overlay"},
            {"id": "ema", "name": "Exponential Moving Average (12)", "type": "overlay"},
            {"id": "ema_26", "name": "EMA 26", "type": "overlay"},
            {"id": "macd", "name": "MACD (12/26/9)", "type": "oscillator"},
            {"id": "adx", "name": "Average Directional Index", "type": "oscillator"},
            {"id": "ichimoku", "name": "Ichimoku Cloud", "type": "overlay"},
            {"id": "parabolic_sar", "name": "Parabolic SAR", "type": "overlay"},
        ],
        "momentum": [
            {"id": "rsi", "name": "Relative Strength Index (14)", "type": "oscillator"},
            {"id": "stoch", "name": "Stochastic Oscillator", "type": "oscillator"},
            {"id": "williams_r", "name": "Williams %R", "type": "oscillator"},
            {"id": "cci", "name": "Commodity Channel Index", "type": "oscillator"},
            {"id": "roc", "name": "Rate of Change", "type": "oscillator"},
            {"id": "mfi", "name": "Money Flow Index", "type": "oscillator"},
        ],
        "volatility": [
            {"id": "bbands", "name": "Bollinger Bands (20, 2)", "type": "overlay"},
            {"id": "atr", "name": "Average True Range (14)", "type": "oscillator"},
            {"id": "keltner", "name": "Keltner Channel", "type": "overlay"},
            {"id": "donchian", "name": "Donchian Channel", "type": "overlay"},
        ],
        "volume": [
            {"id": "obv", "name": "On Balance Volume", "type": "oscillator"},
            {"id": "vwap", "name": "Volume Weighted Average Price", "type": "overlay"},
        ],
        "support_resistance": [
            {"id": "fibonacci", "name": "Fibonacci Retracement", "type": "overlay"},
        ],
    }


# ── AI Chart Analysis (Enhanced) ─────────────────────────────────────────────

@router.post("/ai/chart-analyse")
async def chart_analyse(
    symbol: str = Body("AAPL"),
    trade_period: str = Body("swing"),
    indicators_list: list[str] = Body(["rsi", "macd", "bbands"]),
    include_news: bool = Body(True),
    sector: str = Body(""),
    system_prompt: str = Body(""),
):
    """Enhanced chart analysis with trade-period-specific timeframe selection,
    full indicator context, optional news sentiment, and sector comparison.

    trade_period mapping:
        scalp    -> interval=5m,  period=5d
        day      -> interval=15m, period=5d
        swing    -> interval=1d,  period=6mo
        position -> interval=1wk, period=2y
    """
    import httpx as _httpx
    import json as _json
    from config import settings, DEVICE
    from core.config_overrides import get_system_prompt

    # Map trade periods to yfinance params
    _period_cfg = {
        "scalp":    {"interval": "5m",  "period": "5d",  "label": "5-min / 5-day"},
        "day":      {"interval": "15m", "period": "5d",  "label": "15-min / 5-day"},
        "swing":    {"interval": "1d",  "period": "6mo", "label": "Daily / 6-month"},
        "position": {"interval": "1wk", "period": "2y",  "label": "Weekly / 2-year"},
    }
    cfg = _period_cfg.get(trade_period, _period_cfg["swing"])

    # 1. Fetch price data
    try:
        history = await market.get_history(symbol, cfg["period"], cfg["interval"])
        data = history.get("data", []) if isinstance(history, dict) else history
        recent = data[-10:] if data else []
        price_lines = [
            f"{d.get('date','')}: O={d.get('open',0):.2f} H={d.get('high',0):.2f} "
            f"L={d.get('low',0):.2f} C={d.get('close',0):.2f} V={d.get('volume',0)}"
            for d in recent
        ]
        price_context = "\n".join(price_lines) if price_lines else "No data"
    except Exception:
        price_context = "Market data unavailable"

    # 2. Calculate requested indicators
    indicator_context = "Indicators unavailable"
    try:
        ind_data = indicators.calculate(
            await market.get_history(symbol, cfg["period"], cfg["interval"]),
            indicators_list,
        )
        ind_parts: list[str] = []
        for key in indicators_list:
            val = ind_data.get(key)
            if isinstance(val, dict):
                for sub_k, sub_v in val.items():
                    if isinstance(sub_v, list) and sub_v:
                        last = sub_v[-1]
                        if last is not None:
                            ind_parts.append(f"{key}.{sub_k}: {last:.4f}")
            elif isinstance(val, list) and val:
                last = val[-1]
                if last is not None:
                    ind_parts.append(f"{key}: {last:.4f}")
        indicator_context = "; ".join(ind_parts) if ind_parts else "No indicator data"
    except Exception:
        pass

    # 3. Optional news
    news_context = ""
    if include_news:
        try:
            articles = await news.fetch_articles("general", [symbol], limit=5)
            sentiments = await sentiment.analyse_batch(articles)
            news_context = "; ".join([
                f"{a.get('title','')[:60]} [{a.get('sentiment',{}).get('label','?')}]"
                for a in sentiments[:3]
            ])
        except Exception:
            news_context = "News unavailable"

    # 4. Optional sector comparison
    sector_context = ""
    if sector:
        try:
            from data.ticker_universe import TickerUniverse
            peers = TickerUniverse().get_by_sector(sector)[:5]
            peer_syms = [p["symbol"] for p in peers if p["symbol"] != symbol][:3]
            peer_lines = []
            for ps in peer_syms:
                try:
                    q = await market.get_quote(ps)
                    peer_lines.append(f"{ps}: ${q.get('price',0):.2f} ({q.get('change_pct',0):+.2f}%)")
                except Exception:
                    continue
            sector_context = f"Sector peers ({sector}): " + ", ".join(peer_lines) if peer_lines else ""
        except Exception:
            pass

    # 5. Build prompt
    sys_prompt = system_prompt or get_system_prompt("chart")
    user_prompt = f"""/no_think
Chart Analysis: {symbol} — {trade_period.upper()} ({cfg['label']})

## Recent Price Action
{price_context}

## Technical Indicators
{indicator_context}
{"## News Sentiment" + chr(10) + news_context if news_context else ""}
{sector_context if sector_context else ""}

Provide a {trade_period} trading analysis as JSON with keys:
signal (BUY/SELL/HOLD), confidence (0-100), buy_zone (price range),
sell_zone (price range), support (list), resistance (list),
risk_reward_ratio (float), reasoning (2-3 sentences).
Output ONLY valid JSON."""

    # 6. Call Ollama
    try:
        async with _httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": settings.ollama_model,
                    "system": sys_prompt,
                    "prompt": user_prompt,
                    "stream": False,
                    "options": {
                        "temperature": settings.ollama_temperature,
                        "num_predict": settings.ollama_max_tokens,
                    },
                },
            )
            raw_text = resp.json().get("response", "")
    except Exception as e:
        return {
            "symbol": symbol,
            "error": True,
            "response": f"Ollama unreachable: {e}",
            "model": settings.ollama_model,
        }

    # 7. Parse JSON
    analysis: dict = {"raw": raw_text}
    try:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        analysis = _json.loads(cleaned)
    except Exception:
        analysis = {"summary": raw_text, "signal": "HOLD", "confidence": 50}

    # Auto-ingest into RAG
    try:
        from ai.rag import rag_engine
        await rag_engine.ingest_ai_analysis(symbol, raw_text, "chart")
    except Exception:
        pass

    return {
        "symbol": symbol,
        "trade_period": trade_period,
        "timeframe": cfg["label"],
        "analysis": analysis,
        "model": settings.ollama_model,
        "device": str(DEVICE),
    }


@router.post("/ai/sector-recommend")
async def sector_recommend(
    sector: str = Body("Technology"),
    trade_period: str = Body("swing"),
    count: int = Body(5),
):
    """Get AI-ranked top N stocks from a sector based on technical momentum."""
    import httpx as _httpx
    import json as _json
    from config import settings
    from data.ticker_universe import TickerUniverse
    from core.config_overrides import get_system_prompt

    universe = TickerUniverse()
    sector_stocks = universe.get_by_sector(sector)

    if not sector_stocks:
        return {"error": f"No stocks found for sector: {sector}", "sector": sector}

    # Fetch basic indicators for each stock (cap at 20 to avoid timeout)
    stock_summaries: list[str] = []
    for entry in sector_stocks[:20]:
        sym = entry["symbol"]
        try:
            history = await market.get_history(sym, "3mo", "1d")
            ind_data = indicators.calculate(history, ["rsi", "macd", "atr"])
            rsi_val = None
            if isinstance(ind_data.get("rsi"), list) and ind_data["rsi"]:
                rsi_val = ind_data["rsi"][-1]
            macd_hist = None
            macd_d = ind_data.get("macd", {})
            if isinstance(macd_d.get("histogram"), list) and macd_d["histogram"]:
                macd_hist = macd_d["histogram"][-1]
            data = history.get("data", [])
            price = data[-1]["close"] if data else 0
            stock_summaries.append(
                f"{sym} ({entry['name']}): price=${price:.2f}, RSI={rsi_val}, MACD_hist={macd_hist}"
            )
        except Exception:
            stock_summaries.append(f"{sym} ({entry['name']}): data unavailable")

    sys_prompt = get_system_prompt("sector")
    user_prompt = f"""/no_think
Sector: {sector} — Recommend top {count} stocks for {trade_period} trading.

## Stock Data
{chr(10).join(stock_summaries)}

Rank the top {count} stocks by attractiveness for {trade_period} trading.
Respond as JSON: {{"recommendations": [{{"rank": 1, "symbol": "...", "name": "...", "signal": "BUY/HOLD", "confidence": 0-100, "reason": "..."}}]}}
Output ONLY valid JSON."""

    try:
        async with _httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": settings.ollama_model,
                    "system": sys_prompt,
                    "prompt": user_prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 2048},
                },
            )
            raw_text = resp.json().get("response", "")
    except Exception as e:
        return {"error": f"Ollama unreachable: {e}", "sector": sector}

    result: dict = {"raw": raw_text}
    try:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        result = _json.loads(cleaned)
    except Exception:
        result = {"recommendations": [], "raw": raw_text}

    return {
        "sector": sector,
        "trade_period": trade_period,
        "model": settings.ollama_model,
        **result,
    }


# ── Configuration Routes ─────────────────────────────────────────────────────

@router.get("/config/ai")
async def get_ai_config():
    """Return current AI configuration."""
    from config import settings
    from core.config_overrides import get_override
    return {
        "model": get_override("ai", "model", settings.ollama_model),
        "embed_model": get_override("ai", "embed_model", settings.ollama_embed_model),
        "temperature": get_override("ai", "temperature", settings.ollama_temperature),
        "max_tokens": get_override("ai", "max_tokens", settings.ollama_max_tokens),
        "base_url": get_override("ai", "base_url", settings.ollama_base_url),
    }


@router.post("/config/ai")
async def update_ai_config(config: dict = Body(...)):
    """Write AI config overrides to config_overrides.json and apply to running settings."""
    from config import settings
    from core.config_overrides import set_override

    allowed_keys = {"model", "embed_model", "temperature", "max_tokens", "base_url"}
    updated = {}

    for key, value in config.items():
        if key not in allowed_keys:
            continue
        set_override("ai", key, value)
        updated[key] = value

    # Apply to running settings object
    if "model" in updated:
        settings.ollama_model = updated["model"]
    if "embed_model" in updated:
        settings.ollama_embed_model = updated["embed_model"]
    if "temperature" in updated:
        settings.ollama_temperature = float(updated["temperature"])
    if "max_tokens" in updated:
        settings.ollama_max_tokens = int(updated["max_tokens"])
    if "base_url" in updated:
        settings.ollama_base_url = updated["base_url"]

    return {"status": "updated", "applied": updated}


@router.get("/config/system-prompts")
async def get_system_prompts():
    """Return all system prompts — overrides merged with defaults."""
    from core.config_overrides import DEFAULT_SYSTEM_PROMPTS, load_overrides
    overrides = load_overrides()
    custom = overrides.get("system_prompts", {})
    merged = {**DEFAULT_SYSTEM_PROMPTS, **custom}
    return {"prompts": merged, "defaults": list(DEFAULT_SYSTEM_PROMPTS.keys())}


@router.post("/config/system-prompts")
async def update_system_prompts(prompts: dict = Body(...)):
    """Save custom system prompts to config_overrides.json."""
    from core.config_overrides import set_system_prompt
    saved = []
    for prompt_type, prompt_text in prompts.items():
        if isinstance(prompt_text, str) and prompt_text.strip():
            set_system_prompt(prompt_type, prompt_text.strip())
            saved.append(prompt_type)
    return {"status": "updated", "saved": saved}
