/**
 * useAutoRefresh — Runs a callback at a configurable interval.
 * Fires immediately on mount, then every `interval` ms.
 * Pauses automatically when the browser tab is hidden (Page Visibility API).
 */

import { useRef, useEffect } from 'react';

export default function useAutoRefresh(callback, interval = 30000, deps = []) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!active) return;
      try { await cbRef.current(); } catch { /* caller handles errors */ }
    };

    // Run immediately
    run();

    // Set interval
    timerRef.current = setInterval(run, interval);

    // Pause when tab hidden, resume when visible
    const onVisChange = () => {
      if (document.hidden) {
        clearInterval(timerRef.current);
      } else {
        run();
        timerRef.current = setInterval(run, interval);
      }
    };
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      active = false;
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [interval, ...deps]);
}
