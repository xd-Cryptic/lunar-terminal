/**
 * API utility — communicates with the Python FastAPI backend.
 */

const API_BASE = '/api';

async function request(path, options = {}) {
  const { method = 'GET', body, params } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const fetchOpts = { method, headers: {} };
  if (body) {
    fetchOpts.headers['Content-Type'] = 'application/json';
    fetchOpts.body = JSON.stringify(body);
  }

  const resp = await fetch(url, fetchOpts);
  if (!resp.ok) throw new Error(`API error ${resp.status}: ${resp.statusText}`);
  return resp.json();
}

// ── Market Data ──
export const getQuote = (symbol) => request(`/market/quote/${symbol}`);
export const getHistory = (symbol, period = '1y', interval = '1d') =>
  request(`/market/history/${symbol}`, { params: { period, interval } });
export const searchSymbols = (q) => request('/market/search', { params: { q } });
export const screenMarket = (marketType) => request('/market/screener', { params: { market_type: marketType } });

// ── Quant ──
export const getIndicators = (symbol, indicators = 'sma,ema,rsi,macd,bbands') =>
  request(`/quant/indicators/${symbol}`, { params: { indicator_list: indicators } });
export const getSwingSignals = (symbol, mode = 'lft') =>
  request(`/quant/signals/${symbol}`, { params: { mode } });

// ── Risk ──
export const getSafetyStatus = () => request('/risk/safety-status');
export const checkOrder = (order, marketType) =>
  request('/risk/check-order', { method: 'POST', body: { order, market_type: marketType } });
export const calcPositionSize = (data) =>
  request('/risk/position-size', { method: 'POST', body: data });

// ── News ──
export const getNewsFeed = (tickers, category = 'general', limit = 20) =>
  request('/news/feed', { params: { tickers, category, limit } });
export const getTickerSentiment = (symbol) => request(`/news/sentiment/${symbol}`);
export const getMacroData = () => request('/news/macro');

// ── Backtesting ──
export const runBacktest = (data) => request('/backtest/run', { method: 'POST', body: data });
export const runBatchBacktest = (data) => request('/backtest/batch', { method: 'POST', body: data });
export const listStrategies = () => request('/backtest/strategies');

// ── Portfolio ──
export const optimisePortfolio = (data) => request('/portfolio/optimise', { method: 'POST', body: data });
export const analyseDiversification = (holdings) =>
  request('/portfolio/diversification', { method: 'POST', body: holdings });
export const suggestRebalance = (data) => request('/portfolio/rebalance', { method: 'POST', body: data });

// ── Demo Accounts ──
export const createAccount = (data) => request('/accounts/create', { method: 'POST', body: data });
export const listAccounts = () => request('/accounts');
export const getAccount = (id) => request(`/accounts/${id}`);
export const deleteAccount = (id) => request(`/accounts/${id}`, { method: 'DELETE' });
export const demoTrade = (id, data) => request(`/accounts/${id}/trade`, { method: 'POST', body: data });

// ── Health ──
export const healthCheck = () => fetch('/health').then(r => r.json());

// ── Phase 2: Charts ──
export const getChartData = (symbol, interval = '1D', bars = 200) =>
  request('/chart-data', { params: { symbol, interval, bars } });

// ── Phase 2: Algos ──
export const listAlgos = () => request('/algos');
export const reloadAlgos = () => request('/algos/reload', { method: 'POST' });
export const testAlgo = (code, params = {}) =>
  request('/algos/test', { method: 'POST', body: { code, params } });

// ── Phase 2: Portfolio Simple Summary ──
export const getSimpleSummary = () => request('/portfolio/simple-summary');

// ── Phase 2: AI Analysis (Ollama) ──
export const runAiAnalysis = (symbol, timeframe = '1D', indicators = ['RSI', 'MACD'], opts = {}) =>
  request('/ai/analyse', {
    method: 'POST',
    body: { symbol, timeframe, indicators, ...opts },
  });

// ── Phase 3: AI Tuning + News Sentiment ──
export const analyseNewsArticle = (title, summary = '', url = '') =>
  request('/ai/analyse-news', { method: 'POST', body: { title, summary, url } });
export const batchSentiment = (articles) =>
  request('/ai/batch-sentiment', { method: 'POST', body: articles });
export const listAiModels = () => request('/ai/models');
export const getDeviceInfo = () => request('/ai/device');

// ── Phase 3: ML Training ──
export const trainMLModel = (config) =>
  request('/ml/train', { method: 'POST', body: config });
export const getMLModels = () => request('/ml/models');
export const predictML = (modelId, data) =>
  request(`/ml/predict/${modelId}`, { method: 'POST', body: data });

// ── RAG (Retrieval Augmented Generation) ──
export const ragIngest = (text, docType = 'general', metadata = null, persist = false) =>
  request('/rag/ingest', { method: 'POST', body: { text, doc_type: docType, metadata, persist } });
export const ragQuery = (query, docType = null, topK = 5) =>
  request('/rag/query', { method: 'POST', body: { query, doc_type: docType, top_k: topK } });
export const ragGenerate = (query, docType = null, systemPrompt = '', temperature = 0.1) =>
  request('/rag/generate', { method: 'POST', body: { query, doc_type: docType, system_prompt: systemPrompt, temperature } });
export const ragStatus = () => request('/rag/status');

// ── Live AI Analysis ──
export const liveAnalyse = (symbol, analysisType = 'comprehensive', includeRag = true) =>
  request('/ai/live-analyse', { method: 'POST', body: { symbol, analysis_type: analysisType, include_rag: includeRag } });
export const aiSignal = (symbol) =>
  request('/ai/signal', { method: 'POST', body: { symbol } });

// ── Ticker Universe ──
export const getTickerUniverse = (marketType, offset = 0, limit = 50, q = '', sector = '') =>
  request(`/market/universe/${marketType}`, { params: { offset, limit, q, sector } });
export const getSectors = (marketType) =>
  request(`/market/universe/${marketType}/sectors`);
export const compareSymbols = (symbols, period = '6mo', interval = '1d') =>
  request('/market/compare', { method: 'POST', body: { symbols, period, interval } });

// ── Available Indicators ──
export const getAvailableIndicators = () => request('/indicators/available');

// ── AI Chart Analysis ──
export const chartAnalyse = (symbol, tradePeriod, indicators, includeNews, sector, systemPrompt) =>
  request('/ai/chart-analyse', {
    method: 'POST',
    body: { symbol, trade_period: tradePeriod, indicators, include_news: includeNews, sector, system_prompt: systemPrompt || '' },
  });
export const sectorRecommend = (sector, tradePeriod = 'swing', count = 5) =>
  request('/ai/sector-recommend', { method: 'POST', body: { sector, trade_period: tradePeriod, count } });

// ── Config ──
export const getAiConfig = () => request('/config/ai');
export const updateAiConfig = (config) => request('/config/ai', { method: 'POST', body: config });
export const getSystemPrompts = () => request('/config/system-prompts');
export const updateSystemPrompts = (prompts) => request('/config/system-prompts', { method: 'POST', body: prompts });

// ── RAG Schedule ──
export const ragScheduleStatus = () => request('/rag/schedule');
export const ragScheduleTrigger = (task) => request('/rag/schedule/trigger', { method: 'POST', body: { task } });
export const ragScheduleConfigure = (config) => request('/rag/schedule/configure', { method: 'POST', body: config });
export const ragScheduleWatchlist = (symbols) => request('/rag/schedule/watchlist', { method: 'POST', body: symbols });
