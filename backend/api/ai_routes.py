"""AI analysis routes with tunable parameters."""

import json
import logging
from typing import Optional
from fastapi import APIRouter, Body
from pydantic import BaseModel

from config import settings, DEVICE
from ai.sentiment import SentimentAnalyzer

logger = logging.getLogger("terminal.ai")
router = APIRouter(prefix="/ai", tags=["AI"])
analyzer = SentimentAnalyzer()


class AnalysisRequest(BaseModel):
    symbol: str
    timeframe: str = "1D"
    indicators: list[str] = []
    prompt: str = ""
    system_prompt: str = ""
    temperature: float = 0.3
    max_tokens: int = 2048
    model: str = ""  # Override ollama model


class NewsAnalysisRequest(BaseModel):
    title: str
    summary: str = ""
    url: str = ""


@router.post("/analyse")
async def run_analysis(req: AnalysisRequest):
    """Run AI analysis with tunable parameters."""
    import httpx

    model = req.model or settings.ollama_model
    system_prompt = req.system_prompt or (
        "You are a quantitative financial analyst. Analyze market data with precision. "
        "Focus on technical patterns, risk/reward ratios, and actionable insights."
    )

    # Build context from indicators if available
    context = ""
    if req.indicators:
        context = f"Active indicators: {', '.join(req.indicators)}. "

    user_prompt = req.prompt or f"Analyze {req.symbol} on {req.timeframe} timeframe. {context}"

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": model,
                    "system": system_prompt,
                    "prompt": user_prompt,
                    "stream": False,
                    "options": {
                        "temperature": req.temperature,
                        "num_predict": req.max_tokens,
                    },
                },
            )
            data = resp.json()
            return {
                "response": data.get("response", ""),
                "model": model,
                "device": str(DEVICE),
                "done": data.get("done", False),
            }
    except Exception as exc:
        logger.error("AI analysis failed: %s", exc)
        return {"response": f"AI analysis unavailable: {exc}", "error": True}


@router.post("/analyse-news")
async def analyse_news_article(req: NewsAnalysisRequest):
    """Analyse a single news article for sentiment with reasoning."""
    article = {"title": req.title, "summary": req.summary, "url": req.url}
    result = await analyzer._analyse_single(article)
    return {
        "sentiment": result.get("sentiment", {}),
        "title": req.title,
    }


@router.post("/batch-sentiment")
async def batch_sentiment(articles: list[dict] = Body(...)):
    """Analyse multiple articles for sentiment."""
    results = await analyzer.analyse_batch(articles)
    return {"articles": results}


@router.get("/models")
async def list_models():
    """List available Ollama models."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            data = resp.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"models": models, "current": settings.ollama_model}
    except Exception as exc:
        return {"models": [], "current": settings.ollama_model, "error": str(exc)}


@router.get("/device")
async def get_device_info():
    """Get compute device information."""
    info = {"device": str(DEVICE), "ollama_url": settings.ollama_base_url}
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
