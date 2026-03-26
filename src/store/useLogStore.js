/**
 * useLogStore.js — Zustand store for backend log streaming.
 * Connects to /ws/logs WebSocket and accumulates entries.
 */

import { create } from 'zustand';

const MAX_LOGS = 1000;
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';
const WS_URL  = BACKEND.replace(/^http/, 'ws') + '/ws/logs';

const LEVEL_ORDER = { DEBUG: 0, INFO: 1, WARNING: 2, ERROR: 3, CRITICAL: 4 };

const useLogStore = create((set, get) => ({
  // ── State ─────────────────────────────────────────────────────
  logs:            [],      // all log entries from buffer + stream
  wsStatus:        'disconnected',  // 'disconnected' | 'connecting' | 'connected' | 'error'
  filterLevel:     'DEBUG', // minimum level to show
  filterText:      '',      // free-text search
  filterModule:    '',      // module name filter
  autoScroll:      true,
  panelOpen:       false,
  activeTab:       'all',   // 'all' | 'errors' | 'requests' | 'trace'
  ws:              null,

  // ── Selectors ─────────────────────────────────────────────────
  getFilteredLogs: () => {
    const { logs, filterLevel, filterText, filterModule, activeTab } = get();
    const minOrder = LEVEL_ORDER[filterLevel] ?? 0;

    return logs.filter(entry => {
      if ((LEVEL_ORDER[entry.level] ?? 0) < minOrder) return false;
      if (filterText && !JSON.stringify(entry).toLowerCase().includes(filterText.toLowerCase())) return false;
      if (filterModule && !entry.logger?.toLowerCase().includes(filterModule.toLowerCase())) return false;
      if (activeTab === 'errors' && !['ERROR', 'CRITICAL'].includes(entry.level)) return false;
      if (activeTab === 'requests' && entry.logger !== 'middleware') return false;
      if (activeTab === 'trace' && !entry.traceback) return false;
      return true;
    });
  },

  getErrorCount: () => get().logs.filter(l => ['ERROR', 'CRITICAL'].includes(l.level)).length,

  // ── Actions ───────────────────────────────────────────────────
  setFilterLevel:  (level)  => set({ filterLevel: level }),
  setFilterText:   (text)   => set({ filterText: text }),
  setFilterModule: (mod)    => set({ filterModule: mod }),
  setAutoScroll:   (v)      => set({ autoScroll: v }),
  setPanelOpen:    (open)   => set({ panelOpen: open }),
  togglePanel:     ()       => set(s => ({ panelOpen: !s.panelOpen })),
  setActiveTab:    (tab)    => set({ activeTab: tab }),

  clearLogs: async () => {
    set({ logs: [] });
    fetch(`${BACKEND}/logs`, { method: 'DELETE' }).catch(() => {});
  },

  addLog: (entry) => set(s => ({
    logs: [...s.logs.slice(-(MAX_LOGS - 1)), entry],
  })),

  // ── WebSocket Connection ──────────────────────────────────────
  connect: async () => {
    const { ws } = get();
    if (ws) { ws.close(); }

    set({ wsStatus: 'connecting' });

    // Wait for backend to be reachable before opening WebSocket
    // This prevents the browser-level "closed before established" error
    const BACKEND_HTTP = WS_URL.replace(/^ws/, 'http').replace(/\/ws\/logs$/, '/health');
    try {
      const resp = await fetch(BACKEND_HTTP, { signal: AbortSignal.timeout(3000) });
      if (!resp.ok) throw new Error('not ready');
    } catch {
      set({ wsStatus: 'disconnected' });
      // Retry after 3s — backend not up yet
      setTimeout(() => {
        if (get().wsStatus !== 'connected') get().connect();
      }, 3000);
      return;
    }

    let socket;
    try {
      socket = new WebSocket(WS_URL);
    } catch {
      set({ wsStatus: 'error' });
      return;
    }

    socket.onopen = () => {
      set({ wsStatus: 'connected', ws: socket });
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ping') return;
        if (msg.data) {
          get().addLog(msg.data);
        }
      } catch { /* ignore parse errors */ }
    };

    socket.onerror = () => {
      set({ wsStatus: 'error' });
    };

    socket.onclose = () => {
      set({ wsStatus: 'disconnected', ws: null });
      setTimeout(() => {
        if (get().wsStatus !== 'connected') get().connect();
      }, 5000);
    };

    set({ ws: socket });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) { ws.close(); }
    set({ ws: null, wsStatus: 'disconnected' });
  },
}));

export default useLogStore;
export { LEVEL_ORDER };
