"""RAG Engine for Lunar Terminal.
Dual-layer: RAM for live session data, Supabase for persistent knowledge base.
Uses Ollama for embeddings and generation.
Model is configurable via settings.ollama_model (defaults to qwen3:2b).
Works across platforms and model sizes — qwen3:2b, qwen3:4b, qwen3:8b, etc.
"""

import asyncio
import hashlib
import json
import logging
import time

import httpx
import numpy as np
from config import settings

logger = logging.getLogger("terminal.rag")

# All model references pull from settings so switching models is a single .env change
OLLAMA_URL = settings.ollama_base_url
RAG_MODEL = settings.ollama_model              # e.g. qwen3:2b, qwen3:4b, qwen3:8b
EMBED_MODEL = settings.ollama_embed_model      # e.g. nomic-embed-text
RAG_TEMPERATURE = settings.ollama_temperature  # 0.1 default for quant stability
RAG_MAX_TOKENS = settings.ollama_max_tokens    # 2048 default


class VectorEntry:
    """Single entry in the vector store."""
    def __init__(self, text: str, embedding: list[float], metadata: dict = None, timestamp: float = None):
        self.text = text
        self.embedding = np.array(embedding, dtype=np.float32)
        self.metadata = metadata or {}
        self.timestamp = timestamp or time.time()
        self.id = hashlib.md5(text.encode()).hexdigest()


class LiveVectorStore:
    """In-memory vector store for live session data. Auto-expires old entries."""

    def __init__(self, max_entries: int = 500, ttl_seconds: int = 14400):
        self.entries: dict[str, VectorEntry] = {}
        self.max_entries = max_entries
        self.ttl = ttl_seconds

    def add(self, entry: VectorEntry):
        self._evict_expired()
        if len(self.entries) >= self.max_entries:
            # Remove oldest
            oldest_key = min(self.entries, key=lambda k: self.entries[k].timestamp)
            del self.entries[oldest_key]
        self.entries[entry.id] = entry

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> list[tuple[VectorEntry, float]]:
        self._evict_expired()
        if not self.entries:
            return []

        results = []
        for entry in self.entries.values():
            sim = self._cosine_similarity(query_embedding, entry.embedding)
            results.append((entry, sim))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        dot = np.dot(a, b)
        norm = np.linalg.norm(a) * np.linalg.norm(b)
        return float(dot / norm) if norm > 0 else 0.0

    def _evict_expired(self):
        now = time.time()
        expired = [k for k, v in self.entries.items() if now - v.timestamp > self.ttl]
        for k in expired:
            del self.entries[k]

    def clear(self):
        self.entries.clear()

    @property
    def count(self):
        return len(self.entries)


class RAGEngine:
    """Main RAG engine with dual-layer storage."""

    def __init__(self):
        self.live_store = LiveVectorStore(max_entries=500, ttl_seconds=14400)  # 4 hours
        self._http = httpx.AsyncClient(timeout=60)
        self._supabase_url = settings.supabase_url
        self._supabase_key = settings.supabase_secret

    async def get_embedding(self, text: str) -> list[float]:
        """Get embedding from Ollama embedding model."""
        try:
            resp = await self._http.post(
                f"{OLLAMA_URL}/api/embeddings",
                json={"model": EMBED_MODEL, "prompt": text},
            )
            data = resp.json()
            return data.get("embedding", [])
        except Exception as exc:
            logger.warning("Embedding failed, using hash fallback: %s", exc)
            # Fallback: create a simple hash-based pseudo-embedding
            return self._hash_embedding(text)

    def _hash_embedding(self, text: str, dim: int = 384) -> list[float]:
        """Deterministic pseudo-embedding from text hash (fallback when Ollama unavailable)."""
        h = hashlib.sha256(text.encode()).digest()
        np.random.seed(int.from_bytes(h[:4], 'big'))
        return np.random.randn(dim).tolist()

    # ── Live layer (RAM) ──────────────────────────────────────

    async def ingest_live(self, text: str, metadata: dict = None):
        """Add text to the live in-memory store."""
        embedding = await self.get_embedding(text)
        entry = VectorEntry(text=text, embedding=embedding, metadata=metadata)
        self.live_store.add(entry)
        logger.debug("Ingested live entry: %s chars, store size=%d", len(text), self.live_store.count)
        return entry.id

    async def query_live(self, query: str, top_k: int = 5) -> list[dict]:
        """Search live store for relevant context."""
        embedding = await self.get_embedding(query)
        query_vec = np.array(embedding, dtype=np.float32)
        results = self.live_store.search(query_vec, top_k=top_k)
        return [
            {"text": entry.text, "score": round(score, 4), "metadata": entry.metadata, "age_seconds": round(time.time() - entry.timestamp)}
            for entry, score in results
        ]

    # ── Persistent layer (Supabase) ───────────────────────────

    async def ingest_persistent(self, text: str, doc_type: str, metadata: dict = None):
        """Store text chunk with embedding in Supabase for long-term retrieval."""
        if not self._supabase_url or not self._supabase_key:
            logger.warning("Supabase not configured, skipping persistent ingest")
            return None

        embedding = await self.get_embedding(text)
        chunk_id = hashlib.md5(text.encode()).hexdigest()

        payload = {
            "id": chunk_id,
            "content": text,
            "doc_type": doc_type,
            "embedding": embedding,
            "metadata": json.dumps(metadata or {}),
        }

        try:
            headers = {
                "apikey": self._supabase_key,
                "Authorization": f"Bearer {self._supabase_key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            }
            resp = await self._http.post(
                f"{self._supabase_url}/rest/v1/rag_chunks",
                json=payload,
                headers=headers,
            )
            if resp.status_code in (200, 201):
                logger.info("Persisted RAG chunk: %s (%s)", chunk_id, doc_type)
                return chunk_id
            else:
                logger.warning("Supabase ingest failed: %s %s", resp.status_code, resp.text[:200])
                return None
        except Exception as exc:
            logger.warning("Supabase ingest error: %s", exc)
            return None

    async def query_persistent(self, query: str, doc_type: str = None, top_k: int = 5) -> list[dict]:
        """Search Supabase for relevant persistent context using RPC vector similarity."""
        if not self._supabase_url or not self._supabase_key:
            return []

        embedding = await self.get_embedding(query)

        try:
            headers = {
                "apikey": self._supabase_key,
                "Authorization": f"Bearer {self._supabase_key}",
                "Content-Type": "application/json",
            }
            body = {
                "query_embedding": embedding,
                "match_threshold": 0.5,
                "match_count": top_k,
            }
            if doc_type:
                body["filter_doc_type"] = doc_type

            resp = await self._http.post(
                f"{self._supabase_url}/rest/v1/rpc/match_rag_chunks",
                json=body,
                headers=headers,
            )
            if resp.status_code == 200:
                return resp.json()
            return []
        except Exception as exc:
            logger.warning("Supabase query error: %s", exc)
            return []

    # ── Combined query (live + persistent) ────────────────────

    async def query(self, query: str, doc_type: str = None, top_k: int = 5) -> list[dict]:
        """Search both live and persistent stores, merge and rank results."""
        live_results, persistent_results = await asyncio.gather(
            self.query_live(query, top_k=top_k),
            self.query_persistent(query, doc_type=doc_type, top_k=top_k),
            return_exceptions=True,
        )

        if isinstance(live_results, Exception):
            live_results = []
        if isinstance(persistent_results, Exception):
            persistent_results = []

        # Tag sources
        for r in live_results:
            r["source"] = "live"
        for r in persistent_results:
            r["source"] = "persistent"

        # Merge, sort by score, return top_k
        combined = live_results + persistent_results
        combined.sort(key=lambda x: x.get("score", 0), reverse=True)
        return combined[:top_k]

    # ── RAG-augmented generation ──────────────────────────────

    async def generate(self, query: str, doc_type: str = None, system_prompt: str = "", temperature: float = 0.1) -> dict:
        """Full RAG pipeline: retrieve context -> augment prompt -> generate with Ollama."""
        # 1. Retrieve relevant context
        context_results = await self.query(query, doc_type=doc_type, top_k=5)

        context_text = ""
        if context_results:
            context_text = "\n\n".join([
                f"[{r.get('source', 'unknown')}] {r.get('text', r.get('content', ''))}"
                for r in context_results
            ])

        # 2. Build augmented prompt
        sys = system_prompt or (
            "You are a quantitative trading analyst AI inside a live trading terminal. "
            "Use the provided context to give precise, data-driven analysis. "
            "Output structured JSON when possible. Be concise and actionable."
        )

        augmented_prompt = query
        if context_text:
            augmented_prompt = (
                f"## Relevant Context\n{context_text}\n\n"
                f"## Query\n{query}"
            )

        # 3. Generate with Ollama
        try:
            resp = await self._http.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": RAG_MODEL,
                    "system": sys,
                    "prompt": augmented_prompt,
                    "stream": False,
                    "options": {"temperature": temperature, "num_predict": RAG_MAX_TOKENS},
                },
            )
            data = resp.json()
            return {
                "response": data.get("response", ""),
                "model": RAG_MODEL,
                "context_used": len(context_results),
                "sources": [{"source": r.get("source"), "score": r.get("score")} for r in context_results],
                "done": data.get("done", False),
            }
        except Exception as exc:
            return {"response": f"RAG generation failed: {exc}", "error": True}

    # ── Auto-ingest helpers ───────────────────────────────────

    async def ingest_market_summary(self, symbol: str, summary: str, indicators: dict = None):
        """Auto-ingest a market data summary into the live store."""
        metadata = {"type": "market_summary", "symbol": symbol, "indicators": indicators or {}}
        return await self.ingest_live(f"Market summary for {symbol}: {summary}", metadata)

    async def ingest_news_analysis(self, article: dict, sentiment: dict):
        """Auto-ingest news + sentiment into both live and persistent stores."""
        text = f"News: {article.get('title', '')}. Sentiment: {sentiment.get('label', 'unknown')} ({sentiment.get('score', 0)}). {sentiment.get('reasoning', '')}"
        metadata = {"type": "news_sentiment", "url": article.get("url", ""), "sentiment": sentiment}

        # Live (fast retrieval)
        await self.ingest_live(text, metadata)
        # Persistent (long-term)
        await self.ingest_persistent(text, doc_type="news_analysis", metadata=metadata)

    async def ingest_ai_analysis(self, symbol: str, analysis: str, analysis_type: str = "technical"):
        """Auto-ingest AI analysis results for future RAG context."""
        text = f"AI {analysis_type} analysis for {symbol}: {analysis}"
        metadata = {"type": f"ai_{analysis_type}", "symbol": symbol}
        await self.ingest_live(text, metadata)
        await self.ingest_persistent(text, doc_type=f"ai_{analysis_type}", metadata=metadata)


# Singleton instance
rag_engine = RAGEngine()
