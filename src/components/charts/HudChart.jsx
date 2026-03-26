/**
 * HudChart — Main candlestick chart with indicator overlays,
 * interval tabs, and indicator toggle badges.
 * Monochrome tactical HUD aesthetic.
 */

import { useState, useRef, useEffect } from 'react';
import { createChart } from 'lightweight-charts';
import useStore from '../../store/useStore';
import * as api from '../../utils/api';
import HudPanel from '../layout/HudPanel';

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];
const INDICATORS = [
  { id: 'SMA',    label: 'SMA',    color: '#808090' },
  { id: 'EMA',    label: 'EMA',    color: '#a0a0a8' },
  { id: 'RSI',    label: 'RSI',    color: '#707080' },
  { id: 'MACD',   label: 'MACD',   color: '#909098' },
  { id: 'BBANDS', label: 'BB',     color: '#606070' },
  { id: 'VWAP',   label: 'VWAP',   color: '#b0b0b8' },
  { id: 'ATR',    label: 'ATR',    color: '#686878' },
  { id: 'ICHIMOKU', label: 'ICHI', color: '#585868' },
];

const BACKEND = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_BACKEND_URL || 'http://localhost:8787')
  : 'http://localhost:8787';

/** Zip parallel dates[] and values[] arrays into {time, value} points for lightweight-charts. */
const zipPoints = (dates, values) => {
  if (!Array.isArray(dates) || !Array.isArray(values)) return [];
  return dates.map((d, i) => ({
    time: Math.floor(new Date(d).getTime() / 1000),
    value: values[i],
  })).filter(p => p.value != null && !isNaN(p.value) && !isNaN(p.time));
};

/** Get last numeric value from an array. */
const lastNum = (arr) => {
  if (!Array.isArray(arr)) return null;
  const vals = arr.filter(v => v != null && !isNaN(v));
  return vals.length ? Number(vals[vals.length - 1]) : null;
};

export default function HudChart() {
  const { activeSymbol, quotes } = useStore();
  const [timeframe, setTimeframe] = useState('1D');
  const [activeInds, setActiveInds] = useState(['SMA']);
  const [loading, setLoading] = useState(true);
  const [indData, setIndData] = useState(null);
  const [indError, setIndError] = useState(false);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const overlaySeriesRef = useRef({});

  const q = quotes[activeSymbol] || {};
  const change = q.change_pct || 0;

  const toggleInd = (id) => {
    setActiveInds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Create chart on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartRef.current = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#505060', fontSize: 9, fontFamily: 'var(--hud-font)' },
      grid: { vertLines: { color: 'rgba(180,185,200,0.04)' }, horzLines: { color: 'rgba(180,185,200,0.04)' } },
      crosshair: { mode: 1, vertLine: { color: 'rgba(180,185,200,0.15)' }, horzLine: { color: 'rgba(180,185,200,0.15)' } },
      timeScale: { borderColor: 'rgba(180,185,200,0.08)', timeVisible: true },
      rightPriceScale: { borderColor: 'rgba(180,185,200,0.08)' },
    });

    candleSeriesRef.current = chartRef.current.addCandlestickSeries({
      upColor: '#00cc88', downColor: '#cc3355',
      borderUpColor: '#00cc88', borderDownColor: '#cc3355',
      wickUpColor: '#00cc8866', wickDownColor: '#cc335566',
    });

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  // Fetch chart data with AbortController for cleanup
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    setLoading(true);

    const controller = new AbortController();

    fetch(`${BACKEND}/chart-data?symbol=${encodeURIComponent(activeSymbol)}&interval=${timeframe}&bars=200`, {
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        if (!data.bars || !chartRef.current || !candleSeriesRef.current) return;
        const bars = data.bars.map(b => ({
          time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        }));
        candleSeriesRef.current.setData(bars);
        chartRef.current?.timeScale().fitContent();
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (!chartRef.current || !candleSeriesRef.current) return;
        const now = Math.floor(Date.now() / 1000);
        const stub = Array.from({ length: 150 }, (_, i) => {
          const base = 150 + Math.sin(i * 0.15) * 25 + i * 0.4;
          return {
            time: now - (150 - i) * 86400,
            open: base, high: base + Math.random() * 5,
            low: base - Math.random() * 5,
            close: base + Math.random() * 6 - 3,
          };
        });
        candleSeriesRef.current?.setData(stub);
        chartRef.current?.timeScale().fitContent();
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [activeSymbol, timeframe]);

  // Fetch indicator data
  useEffect(() => {
    let cancelled = false;
    const fetchInds = async () => {
      try {
        const data = await api.getIndicators(activeSymbol, 'sma,ema,rsi,macd,bbands,vwap,atr');
        if (!cancelled) { setIndData(data); setIndError(false); }
      } catch {
        if (!cancelled) setIndError(true);
      }
    };
    fetchInds();
    return () => { cancelled = true; };
  }, [activeSymbol]);

  // Apply/remove indicator overlays — using parallel dates[] + values[] arrays
  useEffect(() => {
    if (!chartRef.current || !indData?.dates) return;

    const dates = indData.dates;

    // Remove deactivated overlays
    Object.keys(overlaySeriesRef.current).forEach(key => {
      if (!activeInds.includes(key)) {
        const s = overlaySeriesRef.current[key];
        if (s._composite) {
          try { chartRef.current.removeSeries(s.upper); } catch { /* ok */ }
          try { chartRef.current.removeSeries(s.lower); } catch { /* ok */ }
        } else {
          try { chartRef.current.removeSeries(s); } catch { /* ok */ }
        }
        delete overlaySeriesRef.current[key];
      }
    });

    activeInds.forEach(indId => {
      if (overlaySeriesRef.current[indId]) return;
      if (!chartRef.current) return;
      const cfg = INDICATORS.find(i => i.id === indId);
      if (!cfg) return;

      // SMA, EMA, VWAP — simple arrays zipped with dates
      if (indId === 'SMA' && indData.sma) {
        const series = chartRef.current.addLineSeries({ color: cfg.color, lineWidth: 1, priceLineVisible: false });
        const points = zipPoints(dates, indData.sma);
        if (points.length) series.setData(points);
        overlaySeriesRef.current[indId] = series;
      }

      if (indId === 'EMA' && indData.ema) {
        const series = chartRef.current.addLineSeries({ color: cfg.color, lineWidth: 1, priceLineVisible: false });
        const points = zipPoints(dates, indData.ema);
        if (points.length) series.setData(points);
        overlaySeriesRef.current[indId] = series;
      }

      if (indId === 'VWAP' && indData.vwap) {
        const series = chartRef.current.addLineSeries({ color: cfg.color, lineWidth: 1, priceLineVisible: false, lineStyle: 2 });
        const points = zipPoints(dates, indData.vwap);
        if (points.length) series.setData(points);
        overlaySeriesRef.current[indId] = series;
      }

      // BBANDS — nested: { upper: [...], mid: [...], lower: [...] }
      if (indId === 'BBANDS' && indData.bbands?.upper && indData.bbands?.lower) {
        const upper = chartRef.current.addLineSeries({ color: '#60607066', lineWidth: 1, priceLineVisible: false, lineStyle: 2 });
        const lower = chartRef.current.addLineSeries({ color: '#60607066', lineWidth: 1, priceLineVisible: false, lineStyle: 2 });
        const uPoints = zipPoints(dates, indData.bbands.upper);
        const lPoints = zipPoints(dates, indData.bbands.lower);
        if (uPoints.length) upper.setData(uPoints);
        if (lPoints.length) lower.setData(lPoints);
        overlaySeriesRef.current[indId] = { upper, lower, _composite: true };
      }
    });
  }, [activeInds, indData]);

  // Extract last values for header readouts (from parallel arrays)
  const rsiVal = lastNum(indData?.rsi);
  const atrVal = lastNum(indData?.atr);

  return (
    <HudPanel
      title={activeSymbol}
      scanning={loading}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`chart-header__price ${change >= 0 ? 'hud-value--green' : 'hud-value--red'}`}>
            {q.price ? `$${q.price.toLocaleString()}` : '\u2014'}
          </span>
          <span style={{ fontSize: 9, fontFamily: 'var(--hud-font)', letterSpacing: 1 }} className={change >= 0 ? 'positive' : 'negative'}>
            {change >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(change).toFixed(2)}%
          </span>

          {rsiVal != null && (
            <span style={{ fontSize: 7, fontFamily: 'var(--hud-font)', color: rsiVal > 70 ? 'var(--hud-red)' : rsiVal < 30 ? 'var(--hud-green)' : 'var(--hud-text-mid)', letterSpacing: 1 }}>
              RSI {rsiVal.toFixed(0)}
            </span>
          )}
          {atrVal != null && (
            <span style={{ fontSize: 7, fontFamily: 'var(--hud-font)', color: 'var(--hud-text-dim)', letterSpacing: 1 }}>
              ATR {atrVal.toFixed(2)}
            </span>
          )}
        </div>
      }
    >
      <div className="chart-header">
        <div style={{ display: 'flex', gap: 2 }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              className={`interval-tab ${timeframe === tf ? 'interval-tab--active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="chart-header__indicators">
          {INDICATORS.map(ind => (
            <button
              key={ind.id}
              className={`ind-badge ${activeInds.includes(ind.id) ? 'ind-badge--active' : ''}`}
              onClick={() => toggleInd(ind.id)}
              title={ind.id}
            >
              {ind.label}
            </button>
          ))}
          {indError && (
            <span style={{ fontSize: 6, color: 'var(--hud-red)', fontFamily: 'var(--hud-font)', letterSpacing: 1 }}>IND OFFLINE</span>
          )}
        </div>
      </div>

      <div ref={chartContainerRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(5,5,16,0.8)', zIndex: 2, fontSize: 9, color: 'var(--hud-text-mid)',
            fontFamily: 'var(--hud-font)', letterSpacing: 3,
          }}>
            LOADING...
          </div>
        )}
      </div>
    </HudPanel>
  );
}
