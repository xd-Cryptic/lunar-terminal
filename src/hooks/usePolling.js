/**
 * usePolling — Custom hook for interval-based API polling with cleanup.
 * Calls fetchFn immediately on mount, then every intervalMs.
 * Returns { data, loading, error, refresh }.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export default function usePolling(fetchFn, intervalMs, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message || 'Fetch failed');
      // Keep previous data visible
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!intervalMs || intervalMs <= 0) return;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, refresh, ...deps]);

  return { data, loading, error, refresh };
}
