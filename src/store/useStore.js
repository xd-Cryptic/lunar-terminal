/**
 * Global state store — Zustand.
 * Phase 2: full app mode routing, dual-user profiles, accounts, algo/backtest/analysis state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEMO_BADGE = { type: 'DEMO', color: '#3b82f6', label: 'DEMO' };
const PAPER_BADGE = { type: 'PAPER', color: '#f59e0b', label: 'PAPER' };
const LIVE_BADGE  = { type: 'LIVE',  color: '#ef4444', label: 'LIVE'  };

const DEFAULT_ACCOUNTS = {
  stocks: [
    { id: 'stocks-1', slot: 1, broker: 'Alpaca', name: 'Alpaca Paper', mode: 'paper', badge: PAPER_BADGE, connected: false, balance: null },
    { id: 'stocks-2', slot: 2, broker: 'Alpaca', name: 'Alpaca Live',  mode: 'live',  badge: LIVE_BADGE,  connected: false, balance: null },
  ],
  crypto: [
    { id: 'crypto-1', slot: 1, broker: 'Binance', name: 'Binance Testnet', mode: 'paper', badge: PAPER_BADGE, connected: false, balance: null },
    { id: 'crypto-2', slot: 2, broker: 'Binance', name: 'Binance Live',    mode: 'live',  badge: LIVE_BADGE,  connected: false, balance: null },
  ],
  forex: [
    { id: 'forex-1', slot: 1, broker: 'OANDA', name: 'OANDA Practice', mode: 'paper', badge: PAPER_BADGE, connected: false, balance: null },
    { id: 'forex-2', slot: 2, broker: 'OANDA', name: 'OANDA Live',     mode: 'live',  badge: LIVE_BADGE,  connected: false, balance: null },
  ],
  revolut: [
    { id: 'revolut-1', slot: 1, broker: 'Revolut', name: 'Revolut (Signals Only)', mode: 'signals', badge: DEMO_BADGE, connected: false, balance: null },
    { id: 'revolut-2', slot: 2, broker: 'Revolut', name: 'Revolut Account 2',       mode: 'signals', badge: DEMO_BADGE, connected: false, balance: null },
  ],
};

const useStore = create(
  persist(
    (set, get) => ({

      // ── App Mode ──────────────────────────────────────────────────
      // 'simple' | 'advanced' | 'algo-builder' | 'analysis' | 'backtest' | 'settings'
      appMode: 'advanced',
      setAppMode: (mode) => set({ appMode: mode }),
      prevMode: 'advanced',
      setPrevMode: (mode) => set({ prevMode: mode }),

      // ── User Profiles ─────────────────────────────────────────────
      users: {
        A: { name: 'User A', color: '#3b82f6', initials: 'A' },
        B: { name: 'User B', color: '#a855f7', initials: 'B' },
      },
      activeUser: 'A',
      setActiveUser: (user) => set({ activeUser: user }),
      updateUser: (key, patch) =>
        set((s) => ({ users: { ...s.users, [key]: { ...s.users[key], ...patch } } })),

      // ── Display Mode ──────────────────────────────────────────────
      displayMode: 'single', // 'single' | 'multi'
      setDisplayMode: (mode) => set({ displayMode: mode }),

      // ── Accounts ─────────────────────────────────────────────────
      // 2 slots per market, each with a mode badge: DEMO | PAPER | LIVE
      accounts: DEFAULT_ACCOUNTS,
      activeAccountSlot: { stocks: 1, crypto: 1, forex: 1, revolut: 1 },

      setActiveAccountSlot: (market, slot) =>
        set((s) => ({ activeAccountSlot: { ...s.activeAccountSlot, [market]: slot } })),

      updateAccount: (market, slot, patch) =>
        set((s) => ({
          accounts: {
            ...s.accounts,
            [market]: s.accounts[market].map((a) =>
              a.slot === slot ? { ...a, ...patch } : a
            ),
          },
        })),

      getActiveAccount: (market) => {
        const { accounts, activeAccountSlot } = get();
        const slot = activeAccountSlot[market];
        return accounts[market]?.find((a) => a.slot === slot) || accounts[market]?.[0];
      },

      // Demo accounts (internal simulations — no broker connection)
      demoAccounts: [],
      addDemoAccount: (account) =>
        set((s) => ({
          demoAccounts: [...s.demoAccounts, {
            ...account,
            id: Date.now().toString(),
            badge: DEMO_BADGE,
            mode: 'demo',
            createdAt: new Date().toISOString(),
            equity: account.capital,
            pnl: 0,
            pnlPct: 0,
          }],
        })),
      removeDemoAccount: (id) =>
        set((s) => ({ demoAccounts: s.demoAccounts.filter((a) => a.id !== id) })),

      // ── Active Symbol ─────────────────────────────────────────────
      activeSymbol: 'AAPL',
      setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),

      // ── Market Type ───────────────────────────────────────────────
      marketType: 'stocks',
      setMarketType: (type) => set({ marketType: type }),

      // ── Trading Mode ──────────────────────────────────────────────
      tradingMode: 'demo', // demo, paper, live
      setTradingMode: (mode) => set({ tradingMode: mode }),

      // ── Tab State ─────────────────────────────────────────────────
      activeBottomTab: 'signals',
      setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),

      activeRightTab: 'news',
      setActiveRightTab: (tab) => set({ activeRightTab: tab }),

      // ── Watchlist ─────────────────────────────────────────────────
      watchlist: [
        { symbol: 'AAPL',    name: 'Apple Inc.',    market: 'stocks' },
        { symbol: 'MSFT',    name: 'Microsoft',     market: 'stocks' },
        { symbol: 'NVDA',    name: 'NVIDIA',        market: 'stocks' },
        { symbol: 'GOOGL',   name: 'Alphabet',      market: 'stocks' },
        { symbol: 'TSLA',    name: 'Tesla',         market: 'stocks' },
        { symbol: 'BTC-USD', name: 'Bitcoin',       market: 'crypto' },
        { symbol: 'ETH-USD', name: 'Ethereum',      market: 'crypto' },
        { symbol: 'EUR=X',   name: 'EUR/USD',       market: 'forex'  },
        { symbol: 'SPY',     name: 'S&P 500 ETF',   market: 'etf'    },
      ],
      setWatchlist: (watchlist) => set({ watchlist }),

      addToWatchlist: (item) => set((s) => {
        if (s.watchlist.some((w) => w.symbol === item.symbol)) return s;
        return { watchlist: [...s.watchlist, item] };
      }),
      removeFromWatchlist: (symbol) => set((s) => ({
        watchlist: s.watchlist.filter((w) => w.symbol !== symbol),
      })),

      // ── Quotes Cache ──────────────────────────────────────────────
      quotes: {},
      setQuote: (symbol, data) =>
        set((s) => ({ quotes: { ...s.quotes, [symbol]: data } })),

      // ── News / Signals / Safety ───────────────────────────────────
      articles: [],
      setArticles: (articles) => set({ articles }),

      signals: [],
      setSignals: (signals) => set({ signals }),

      safetyStatus: null,
      setSafetyStatus: (status) => set({ safetyStatus: status }),

      // ── Backend Status ────────────────────────────────────────────
      backendStatus: 'connecting',
      setBackendStatus: (status) => set({ backendStatus: status }),

      // ── Frequency Mode ────────────────────────────────────────────
      frequencyMode: 'lft',
      setFrequencyMode: (mode) => set({ frequencyMode: mode }),

      // ── Risk Settings ─────────────────────────────────────────────
      riskSettings: {
        stocks: { riskPct: 2, dailyLossLimit: 5, maxDrawdown: 10 },
        crypto: { riskPct: 1, dailyLossLimit: 3, maxDrawdown: 8  },
        forex:  { riskPct: 1, dailyLossLimit: 3, maxDrawdown: 8  },
      },
      updateRiskSettings: (market, patch) =>
        set((s) => ({
          riskSettings: { ...s.riskSettings, [market]: { ...s.riskSettings[market], ...patch } },
        })),

      // ── Algo Builder State ────────────────────────────────────────
      algoBuilderState: {
        selectedAlgo: null,
        algoCode: '',
        algoList: [],
        testResults: null,
        isTesting: false,
      },
      setAlgoBuilderState: (patch) =>
        set((s) => ({ algoBuilderState: { ...s.algoBuilderState, ...patch } })),

      // ── Backtest State ────────────────────────────────────────────
      backtestState: {
        strategy: '',
        symbol: 'AAPL',
        dateFrom: '2023-01-01',
        dateTo: '2024-12-31',
        capital: 10000,
        feeStructure: 'alpaca',
        results: null,
        isRunning: false,
        compareMode: false,
        compareStrategy: '',
        compareResults: null,
      },
      setBacktestState: (patch) =>
        set((s) => ({ backtestState: { ...s.backtestState, ...patch } })),

      // ── Analysis State ────────────────────────────────────────────
      analysisState: {
        symbol: 'AAPL',
        timeframe: '1D',
        indicators: ['SMA', 'RSI'],
        aiResponse: '',
        isAnalysing: false,
      },
      setAnalysisState: (patch) =>
        set((s) => ({ analysisState: { ...s.analysisState, ...patch } })),

      // ── API Keys (local masked cache — raw keys never in store) ───
      apiKeyStatus: {
        alpaca: false, binance: false, oanda: false,
        twelve_data: false, finnhub: false, openai: false,
      },
      setApiKeyStatus: (service, connected) =>
        set((s) => ({ apiKeyStatus: { ...s.apiKeyStatus, [service]: connected } })),

      // ── Fund Allocation ───────────────────────────────────────────
      fundAllocation: { stocks: 40, crypto: 30, forex: 20, cash: 10 },
      setFundAllocation: (patch) =>
        set((s) => ({ fundAllocation: { ...s.fundAllocation, ...patch } })),

      // ── AI Overlay State (not persisted) ─────────────────────────
      aiOverlay: { visible: false, symbol: '', tradePeriod: 'swing', sector: '', results: null, loading: false },
      setAiOverlay: (patch) => set((s) => ({ aiOverlay: { ...s.aiOverlay, ...patch } })),

    }),
    {
      name: 'stock-terminal-storage',
      partialize: (state) => ({
        // Persist UI preferences but NOT sensitive data
        appMode: state.appMode,
        activeUser: state.activeUser,
        users: state.users,
        displayMode: state.displayMode,
        activeAccountSlot: state.activeAccountSlot,
        accounts: state.accounts,
        demoAccounts: state.demoAccounts,
        watchlist: state.watchlist,
        frequencyMode: state.frequencyMode,
        riskSettings: state.riskSettings,
        fundAllocation: state.fundAllocation,
        tradingMode: state.tradingMode,
      }),
    }
  )
);

export default useStore;
export { DEMO_BADGE, PAPER_BADGE, LIVE_BADGE };
