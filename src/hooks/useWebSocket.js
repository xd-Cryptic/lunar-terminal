/**
 * useWebSocket — Persistent WebSocket connection for live quote updates.
 * Connects to backend /ws/stream, subscribes to symbols, and pushes
 * incoming quotes into the Zustand store. Reconnects with exponential backoff.
 */

import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore';

export default function useWebSocket(symbols) {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const attemptsRef = useRef(0);

  const connect = useCallback(() => {
    const WS_URL = `ws://localhost:8787/ws/stream`;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
        // Subscribe to symbols
        if (symbols?.length) {
          ws.send(JSON.stringify({ action: 'subscribe', symbols }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'quote' && msg.symbol && msg.data) {
            useStore.getState().setQuote(msg.symbol, msg.data);
          }
        } catch { /* malformed message — skip */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Exponential backoff reconnect: 1s, 2s, 4s, 8s... max 30s
        const delay = Math.min(1000 * Math.pow(2, attemptsRef.current), 30000);
        attemptsRef.current++;
        reconnectRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    } catch {
      const delay = Math.min(1000 * Math.pow(2, attemptsRef.current), 30000);
      attemptsRef.current++;
      reconnectRef.current = setTimeout(connect, delay);
    }
  }, []); // symbols handled via ref update in the effect below

  // Update subscriptions when symbols change
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && symbols?.length) {
      wsRef.current.send(JSON.stringify({ action: 'subscribe', symbols }));
    }
  }, [symbols]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { connected: wsRef.current?.readyState === WebSocket.OPEN };
}
