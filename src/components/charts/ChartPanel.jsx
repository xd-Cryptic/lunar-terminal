/**
 * ChartPanel — Reusable enhanced chart component with full indicator support.
 * Renders candlestick charts via lightweight-charts with overlay indicators,
 * sub-pane oscillators, timeframe tabs, and comparison mode.
 * Monochrome tactical HUD aesthetic.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import * as api from '../../utils/api';

// ── Color palette (HUD-compatible monochrome tints) ──────────────────
const INDICATOR_COLORS = [
  'rgba(0, 212, 255, 0.8)',     // cyan
  'rgba(180, 185, 200, 0.7)',   // silver
  'rgba(0, 204, 136, 0.7)',     // green
  'rgba(204, 51, 85, 0.7)',     // red
  'rgba(187, 136, 51, 0.7)',    // amber
  'rgba(136, 51, 204, 0.7)',    // purple
  'rgba(51, 136, 204, 0.7)',    // blue
  'rgba(204, 136, 187, 0.7)',   // pink
];

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M'];

const BACKEND = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_BACKEND_URL || 'http://localhost:8787')
  : 'http://localhost:8787';

// Overlay indicators (drawn on main price chart)
const OVERLAY_IDS = new Set([
  'sma', 'ema', 'bbands', 'ichimoku', 'parabolic_sar',
  'keltner', 'donchian', 'vwap', 'fibonacci',
]);

// Sub-pane indicators (drawn in separate oscillator panes below)
const SUBPANE_IDS = new Set([
  'rsi', 'macd', 'stochastic', 'williams_r', 'cci', 'mfi',
  'adx', 'obv', 'roc', 'atr',
]);

/** Zip parallel dates[] and values[] arrays into {time, value} points. */
const zipPoints = (dates, values) => {
  if (!Array.isArray(dates) || !Array.isArray(values)) return [];
  return dates.map((d, i) => ({
    time: Math.floor(new Date(d).getTime() / 1000),
    value: values[i],
  })).filter(p => p.value != null && !isNaN(p.value) && !isNaN(p.time));
};

/** Zip dates + OHLC into histogram-style bars for MACD. */
const zipHistogram = (dates, values) => {
  if (!Array.isArray(dates) || !Array.isArray(values)) return [];
  return dates.map((d, i) => ({
    time: Math.floor(new Date(d).getTime() / 1000),
    value: values[i],
    color: values[i] >= 0 ? 'rgba(0,204,136,0.5)' : 'rgba(204,51,85,0.5)',
  })).filter(p => p.value != null && !isNaN(p.value) && !isNaN(p.time));
};

/** Shared chart options for HUD theme */
const makeChartOptions = (height) => ({
  layout: {
    background: { color: 'transparent' },
    textColor: '#505060',
    fontSize: 9,
    fontFamily: 'var(--hud-font)',
  },
  grid: {
    vertLines: { color: 'rgba(180,185,200,0.04)' },
    horzLines: { color: 'rgba(180,185,200,0.04)' },
  },
  crosshair: {
    mode: 1,
    vertLine: { color: 'rgba(180,185,200,0.15)' },
    horzLine: { color: 'rgba(180,185,200,0.15)' },
  },
  timeScale: { borderColor: 'rgba(180,185,200,0.08)', timeVisible: true },
  rightPriceScale: { borderColor: 'rgba(180,185,200,0.08)' },
  height,
});

// ── Sub-pane chart configs ────────────────────────────────────────────
const SUBPANE_CONFIGS = {
  rsi: {
    label: 'RSI',
    height: 100,
    refLines: [
      { value: 70, color: 'rgba(204,51,85,0.3)', label: '70' },
      { value: 30, color: 'rgba(0,204,136,0.3)', label: '30' },
    ],
  },
  macd: { label: 'MACD', height: 110, refLines: [] },
  stochastic: {
    label: 'STOCH',
    height: 100,
    refLines: [
      { value: 80, color: 'rgba(204,51,85,0.3)', label: '80' },
      { value: 20, color: 'rgba(0,204,136,0.3)', label: '20' },
    ],
  },
  williams_r: {
    label: 'WILL%R',
    height: 90,
    refLines: [
      { value: -20, color: 'rgba(204,51,85,0.3)', label: '-20' },
      { value: -80, color: 'rgba(0,204,136,0.3)', label: '-80' },
    ],
  },
  cci: {
    label: 'CCI',
    height: 90,
    refLines: [
      { value: 100, color: 'rgba(204,51,85,0.3)', label: '+100' },
      { value: -100, color: 'rgba(0,204,136,0.3)', label: '-100' },
    ],
  },
  mfi: {
    label: 'MFI',
    height: 90,
    refLines: [
      { value: 80, color: 'rgba(204,51,85,0.3)', label: '80' },
      { value: 20, color: 'rgba(0,204,136,0.3)', label: '20' },
    ],
  },
  adx: {
    label: 'ADX',
    height: 100,
    refLines: [
      { value: 25, color: 'rgba(180,185,200,0.3)', label: '25' },
    ],
  },
  obv: { label: 'OBV', height: 90, refLines: [] },
  roc: {
    label: 'ROC',
    height: 90,
    refLines: [
      { value: 0, color: 'rgba(180,185,200,0.3)', label: '0' },
    ],
  },
  atr: { label: 'ATR', height: 90, refLines: [] },
};


export default function ChartPanel({
  symbol = 'AAPL',
  timeframe: initialTimeframe = '1D',
  activeIndicators = [],
  onSymbolChange,
  height = 400,
  showControls = true,
  comparisonSymbols = [],
}) {
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [loading, setLoading] = useState(true);
  const [indData, setIndData] = useState(null);
  const [indError, setIndError] = useState(false);
  const [compData, setCompData] = useState({});

  // Main chart refs
  const mainContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const overlaySeriesRef = useRef({});

  // Sub-pane chart refs: { [indId]: { container, chart, series } }
  const subPanesRef = useRef({});
  const subContainerRefs = useRef({});

  // Comparison mode refs
  const compSeriesRef = useRef({});

  const isComparisonMode = comparisonSymbols.length > 0;

  // Determine which sub-panes to show
  const activeSubPanes = useMemo(
    () => activeIndicators.filter(id => SUBPANE_IDS.has(id)),
    [activeIndicators]
  );

  const activeOverlays = useMemo(
    () => activeIndicators.filter(id => OVERLAY_IDS.has(id)),
    [activeIndicators]
  );

  // Determine refresh interval
  const refreshMs = useMemo(() => {
    const intraday = ['1m', '5m', '15m', '1H', '4H'];
    return intraday.includes(timeframe) ? 30000 : 60000;
  }, [timeframe]);

  // Assign colors to indicators in order
  const getColor = useCallback((idx) => INDICATOR_COLORS[idx % INDICATOR_COLORS.length], []);

  // ── Create main chart on mount ──────────────────────────────────────
  useEffect(() => {
    if (!mainContainerRef.current) return;

    const chart = createChart(mainContainerRef.current, {
      ...makeChartOptions(height),
      width: mainContainerRef.current.clientWidth,
    });
    chartRef.current = chart;

    if (!isComparisonMode) {
      candleSeriesRef.current = chart.addCandlestickSeries({
        upColor: '#00cc88', downColor: '#cc3355',
        borderUpColor: '#00cc88', borderDownColor: '#cc3355',
        wickUpColor: '#00cc8866', wickDownColor: '#cc335566',
      });
    }

    const ro = new ResizeObserver(() => {
      if (mainContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: mainContainerRef.current.clientWidth,
        });
      }
    });
    ro.observe(mainContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      overlaySeriesRef.current = {};
      compSeriesRef.current = {};
    };
  }, [isComparisonMode]);

  // ── Fetch OHLCV chart data ──────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    if (isComparisonMode) return; // comparison mode fetches differently
    setLoading(true);

    const controller = new AbortController();
    fetch(`${BACKEND}/chart-data?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}&bars=200`, {
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
        // Stub data on failure
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
  }, [symbol, timeframe, isComparisonMode]);

  // ── Auto-refresh timer ──────────────────────────────────────────────
  useEffect(() => {
    if (isComparisonMode) return;
    const timer = setInterval(() => {
      if (!chartRef.current || !candleSeriesRef.current) return;
      fetch(`${BACKEND}/chart-data?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}&bars=200`)
        .then(r => r.json())
        .then(data => {
          if (!data.bars || !candleSeriesRef.current) return;
          const bars = data.bars.map(b => ({
            time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
          }));
          candleSeriesRef.current.setData(bars);
        })
        .catch(() => {});
    }, refreshMs);
    return () => clearInterval(timer);
  }, [symbol, timeframe, refreshMs, isComparisonMode]);

  // ── Fetch indicator data ────────────────────────────────────────────
  useEffect(() => {
    if (activeIndicators.length === 0) { setIndData(null); return; }
    let cancelled = false;
    const indList = activeIndicators.join(',');
    const fetchInds = async () => {
      try {
        const data = await api.getIndicators(symbol, indList);
        if (!cancelled) { setIndData(data); setIndError(false); }
      } catch {
        if (!cancelled) setIndError(true);
      }
    };
    fetchInds();

    // Refresh indicator data at same interval
    const timer = setInterval(fetchInds, refreshMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [symbol, activeIndicators.join(','), refreshMs]);

  // ── Comparison mode: fetch + render normalised series ───────────────
  useEffect(() => {
    if (!isComparisonMode || !chartRef.current) return;
    setLoading(true);

    const allSymbols = [symbol, ...comparisonSymbols];
    const fetches = allSymbols.map(sym =>
      fetch(`${BACKEND}/chart-data?symbol=${encodeURIComponent(sym)}&interval=${timeframe}&bars=200`)
        .then(r => r.json())
        .then(data => ({ symbol: sym, bars: data.bars || [] }))
        .catch(() => ({ symbol: sym, bars: [] }))
    );

    Promise.all(fetches).then(results => {
      if (!chartRef.current) return;

      // Remove old comparison series
      Object.values(compSeriesRef.current).forEach(s => {
        try { chartRef.current.removeSeries(s); } catch { /* ok */ }
      });
      compSeriesRef.current = {};

      results.forEach((r, idx) => {
        if (!r.bars.length) return;
        const firstClose = r.bars[0].close;
        if (!firstClose) return;

        // Normalise to 100-base
        const points = r.bars.map(b => ({
          time: b.time,
          value: (b.close / firstClose) * 100,
        })).filter(p => !isNaN(p.value) && !isNaN(p.time));

        const series = chartRef.current.addLineSeries({
          color: getColor(idx),
          lineWidth: 2,
          priceLineVisible: false,
          title: r.symbol,
        });
        series.setData(points);
        compSeriesRef.current[r.symbol] = series;
      });

      chartRef.current?.timeScale().fitContent();
      setLoading(false);
    });
  }, [isComparisonMode, symbol, comparisonSymbols.join(','), timeframe]);

  // ── Apply overlay indicators on main chart ──────────────────────────
  useEffect(() => {
    if (!chartRef.current || !indData?.dates || isComparisonMode) return;
    const dates = indData.dates;

    // Remove deactivated overlays
    Object.keys(overlaySeriesRef.current).forEach(key => {
      if (!activeOverlays.includes(key)) {
        const s = overlaySeriesRef.current[key];
        if (s._composite) {
          Object.values(s).forEach(sub => {
            if (sub === true) return; // skip _composite flag
            try { chartRef.current.removeSeries(sub); } catch { /* ok */ }
          });
        } else {
          try { chartRef.current.removeSeries(s); } catch { /* ok */ }
        }
        delete overlaySeriesRef.current[key];
      }
    });

    let colorIdx = 0;
    activeOverlays.forEach(indId => {
      if (overlaySeriesRef.current[indId]) { colorIdx++; return; }
      if (!chartRef.current) return;
      const color = getColor(colorIdx++);

      // SMA
      if (indId === 'sma' && indData.sma) {
        const series = chartRef.current.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, title: 'SMA' });
        series.setData(zipPoints(dates, indData.sma));
        overlaySeriesRef.current[indId] = series;
      }

      // EMA
      if (indId === 'ema' && indData.ema) {
        const series = chartRef.current.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, title: 'EMA' });
        series.setData(zipPoints(dates, indData.ema));
        overlaySeriesRef.current[indId] = series;
      }

      // VWAP
      if (indId === 'vwap' && indData.vwap) {
        const series = chartRef.current.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lineStyle: 2, title: 'VWAP' });
        series.setData(zipPoints(dates, indData.vwap));
        overlaySeriesRef.current[indId] = series;
      }

      // Bollinger Bands
      if (indId === 'bbands' && indData.bbands?.upper && indData.bbands?.lower) {
        const upper = chartRef.current.addLineSeries({ color: 'rgba(96,96,112,0.4)', lineWidth: 1, priceLineVisible: false, lineStyle: 2, title: 'BB+' });
        const lower = chartRef.current.addLineSeries({ color: 'rgba(96,96,112,0.4)', lineWidth: 1, priceLineVisible: false, lineStyle: 2, title: 'BB-' });
        upper.setData(zipPoints(dates, indData.bbands.upper));
        lower.setData(zipPoints(dates, indData.bbands.lower));
        overlaySeriesRef.current[indId] = { upper, lower, _composite: true };
      }

      // Keltner Channel
      if (indId === 'keltner' && indData.keltner?.upper && indData.keltner?.lower) {
        const upper = chartRef.current.addLineSeries({ color: 'rgba(136,51,204,0.4)', lineWidth: 1, priceLineVisible: false, lineStyle: 2, title: 'KC+' });
        const lower = chartRef.current.addLineSeries({ color: 'rgba(136,51,204,0.4)', lineWidth: 1, priceLineVisible: false, lineStyle: 2, title: 'KC-' });
        upper.setData(zipPoints(dates, indData.keltner.upper));
        lower.setData(zipPoints(dates, indData.keltner.lower));
        overlaySeriesRef.current[indId] = { upper, lower, _composite: true };
      }

      // Donchian Channel
      if (indId === 'donchian' && indData.donchian?.upper && indData.donchian?.lower) {
        const upper = chartRef.current.addLineSeries({ color: 'rgba(51,136,204,0.4)', lineWidth: 1, priceLineVisible: false, lineStyle: 2, title: 'DC+' });
        const lower = chartRef.current.addLineSeries({ color: 'rgba(51,136,204,0.4)', lineWidth: 1, priceLineVisible: false, lineStyle: 2, title: 'DC-' });
        upper.setData(zipPoints(dates, indData.donchian.upper));
        lower.setData(zipPoints(dates, indData.donchian.lower));
        overlaySeriesRef.current[indId] = { upper, lower, _composite: true };
      }

      // Ichimoku Cloud
      if (indId === 'ichimoku' && indData.ichimoku) {
        const ichi = indData.ichimoku;
        const tenkan = chartRef.current.addLineSeries({ color: 'rgba(0,212,255,0.6)', lineWidth: 1, priceLineVisible: false, title: 'Tenkan' });
        const kijun = chartRef.current.addLineSeries({ color: 'rgba(180,185,200,0.6)', lineWidth: 1, priceLineVisible: false, title: 'Kijun' });
        const spanA = chartRef.current.addLineSeries({ color: 'rgba(0,204,136,0.4)', lineWidth: 1, priceLineVisible: false, lineStyle: 2, title: 'SpanA' });
        const spanB = chartRef.current.addLineSeries({ color: 'rgba(204,51,85,0.4)', lineWidth: 1, priceLineVisible: false, lineStyle: 2, title: 'SpanB' });
        const chikou = chartRef.current.addLineSeries({ color: 'rgba(187,136,51,0.4)', lineWidth: 1, priceLineVisible: false, lineStyle: 3, title: 'Chikou' });

        if (ichi.tenkan_sen) tenkan.setData(zipPoints(dates, ichi.tenkan_sen));
        if (ichi.kijun_sen) kijun.setData(zipPoints(dates, ichi.kijun_sen));
        if (ichi.senkou_span_a) spanA.setData(zipPoints(dates, ichi.senkou_span_a));
        if (ichi.senkou_span_b) spanB.setData(zipPoints(dates, ichi.senkou_span_b));
        if (ichi.chikou_span) chikou.setData(zipPoints(dates, ichi.chikou_span));

        overlaySeriesRef.current[indId] = { tenkan, kijun, spanA, spanB, chikou, _composite: true };
      }

      // Parabolic SAR (markers on chart)
      if (indId === 'parabolic_sar' && indData.parabolic_sar?.sar) {
        const sarData = indData.parabolic_sar;
        const series = chartRef.current.addLineSeries({
          color: 'rgba(187,136,51,0.7)',
          lineWidth: 0,
          priceLineVisible: false,
          pointMarkersVisible: true,
          pointMarkersRadius: 2,
          title: 'SAR',
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        series.setData(zipPoints(dates, sarData.sar));
        overlaySeriesRef.current[indId] = series;
      }

      // Fibonacci (horizontal price lines)
      if (indId === 'fibonacci' && indData.fibonacci) {
        const fib = indData.fibonacci;
        const fibRatios = ['0.0', '0.236', '0.382', '0.5', '0.618', '0.786', '1.0'];
        const fibColors = [
          'rgba(0,204,136,0.5)', 'rgba(0,204,136,0.3)',
          'rgba(0,212,255,0.3)', 'rgba(180,185,200,0.4)',
          'rgba(0,212,255,0.3)', 'rgba(204,51,85,0.3)',
          'rgba(204,51,85,0.5)',
        ];
        const seriesMap = {};
        fibRatios.forEach((ratio, rIdx) => {
          if (!fib[ratio]) return;
          const level = fib[ratio][0]; // constant value
          const s = chartRef.current.addLineSeries({
            color: fibColors[rIdx] || 'rgba(180,185,200,0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            title: `Fib ${ratio}`,
            lastValueVisible: true,
          });
          s.setData(zipPoints(dates, fib[ratio]));
          seriesMap[ratio] = s;
        });
        seriesMap._composite = true;
        overlaySeriesRef.current[indId] = seriesMap;
      }
    });
  }, [activeOverlays.join(','), indData, isComparisonMode]);

  // ── Render sub-pane indicators ──────────────────────────────────────
  useEffect(() => {
    if (!indData?.dates) return;
    const dates = indData.dates;

    // Destroy sub-panes that are no longer active
    Object.keys(subPanesRef.current).forEach(key => {
      if (!activeSubPanes.includes(key)) {
        try { subPanesRef.current[key].chart.remove(); } catch { /* ok */ }
        delete subPanesRef.current[key];
      }
    });

    activeSubPanes.forEach((indId, idx) => {
      const containerEl = subContainerRefs.current[indId];
      if (!containerEl) return;
      const cfg = SUBPANE_CONFIGS[indId];
      if (!cfg) return;

      // If already created, just update data
      if (subPanesRef.current[indId]) {
        updateSubPaneData(indId, subPanesRef.current[indId], dates);
        return;
      }

      // Create sub-pane chart
      const subChart = createChart(containerEl, {
        ...makeChartOptions(cfg.height),
        width: containerEl.clientWidth,
        rightPriceScale: { borderColor: 'rgba(180,185,200,0.08)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      });

      const subPaneEntry = { chart: subChart, series: {} };

      // Add reference lines
      cfg.refLines.forEach(ref => {
        const refSeries = subChart.addLineSeries({
          color: ref.color, lineWidth: 1, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        // Create constant-value line across all dates
        const refPoints = dates.map(d => ({
          time: Math.floor(new Date(d).getTime() / 1000),
          value: ref.value,
        })).filter(p => !isNaN(p.time));
        if (refPoints.length) refSeries.setData(refPoints);
      });

      // Add data series
      addSubPaneSeries(indId, subChart, subPaneEntry, dates);
      subChart.timeScale().fitContent();

      // ResizeObserver
      const ro = new ResizeObserver(() => {
        if (containerEl && subChart) {
          subChart.applyOptions({ width: containerEl.clientWidth });
        }
      });
      ro.observe(containerEl);
      subPaneEntry._ro = ro;

      subPanesRef.current[indId] = subPaneEntry;
    });

    // Sync time scales of sub-panes with main chart
    if (chartRef.current) {
      const mainTs = chartRef.current.timeScale();
      Object.values(subPanesRef.current).forEach(pane => {
        try {
          const range = mainTs.getVisibleLogicalRange();
          if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
        } catch { /* ok */ }
      });
    }
  }, [activeSubPanes.join(','), indData]);

  // Cleanup sub-panes on unmount
  useEffect(() => {
    return () => {
      Object.values(subPanesRef.current).forEach(pane => {
        try { pane._ro?.disconnect(); } catch { /* ok */ }
        try { pane.chart.remove(); } catch { /* ok */ }
      });
      subPanesRef.current = {};
    };
  }, []);

  function addSubPaneSeries(indId, chart, entry, dates) {
    const color = getColor(0);

    if (indId === 'rsi' && Array.isArray(indData.rsi)) {
      const s = chart.addLineSeries({ color: 'rgba(0,212,255,0.8)', lineWidth: 1.5, priceLineVisible: false, title: 'RSI' });
      s.setData(zipPoints(dates, indData.rsi));
      entry.series.rsi = s;
    }

    if (indId === 'macd' && indData.macd) {
      const macd = indData.macd;
      if (macd.macd) {
        const s = chart.addLineSeries({ color: 'rgba(0,212,255,0.8)', lineWidth: 1.5, priceLineVisible: false, title: 'MACD' });
        s.setData(zipPoints(dates, macd.macd));
        entry.series.macd = s;
      }
      if (macd.signal) {
        const s = chart.addLineSeries({ color: 'rgba(204,51,85,0.7)', lineWidth: 1, priceLineVisible: false, title: 'Signal' });
        s.setData(zipPoints(dates, macd.signal));
        entry.series.signal = s;
      }
      if (macd.histogram) {
        const s = chart.addHistogramSeries({
          priceLineVisible: false,
          title: 'Hist',
          priceFormat: { type: 'price', precision: 4 },
        });
        s.setData(zipHistogram(dates, macd.histogram));
        entry.series.histogram = s;
      }
    }

    if (indId === 'stochastic' && indData.stochastic) {
      const stoch = indData.stochastic;
      if (stoch.stoch_k) {
        const s = chart.addLineSeries({ color: 'rgba(0,212,255,0.8)', lineWidth: 1.5, priceLineVisible: false, title: '%K' });
        s.setData(zipPoints(dates, stoch.stoch_k));
        entry.series.k = s;
      }
      if (stoch.stoch_d) {
        const s = chart.addLineSeries({ color: 'rgba(204,51,85,0.7)', lineWidth: 1, priceLineVisible: false, title: '%D' });
        s.setData(zipPoints(dates, stoch.stoch_d));
        entry.series.d = s;
      }
    }

    if (indId === 'williams_r' && (Array.isArray(indData.williams_r))) {
      const s = chart.addLineSeries({ color: 'rgba(136,51,204,0.8)', lineWidth: 1.5, priceLineVisible: false, title: 'W%R' });
      s.setData(zipPoints(dates, indData.williams_r));
      entry.series.wr = s;
    }

    if (indId === 'cci' && (Array.isArray(indData.cci))) {
      const s = chart.addLineSeries({ color: 'rgba(187,136,51,0.8)', lineWidth: 1.5, priceLineVisible: false, title: 'CCI' });
      s.setData(zipPoints(dates, indData.cci));
      entry.series.cci = s;
    }

    if (indId === 'mfi' && (Array.isArray(indData.mfi))) {
      const s = chart.addLineSeries({ color: 'rgba(0,204,136,0.8)', lineWidth: 1.5, priceLineVisible: false, title: 'MFI' });
      s.setData(zipPoints(dates, indData.mfi));
      entry.series.mfi = s;
    }

    if (indId === 'adx' && indData.adx) {
      const adx = indData.adx;
      if (adx.adx) {
        const s = chart.addLineSeries({ color: 'rgba(0,212,255,0.8)', lineWidth: 1.5, priceLineVisible: false, title: 'ADX' });
        s.setData(zipPoints(dates, adx.adx));
        entry.series.adx = s;
      }
      if (adx.plus_di) {
        const s = chart.addLineSeries({ color: 'rgba(0,204,136,0.6)', lineWidth: 1, priceLineVisible: false, title: '+DI' });
        s.setData(zipPoints(dates, adx.plus_di));
        entry.series.pdi = s;
      }
      if (adx.minus_di) {
        const s = chart.addLineSeries({ color: 'rgba(204,51,85,0.6)', lineWidth: 1, priceLineVisible: false, title: '-DI' });
        s.setData(zipPoints(dates, adx.minus_di));
        entry.series.mdi = s;
      }
    }

    if (indId === 'obv' && (Array.isArray(indData.obv))) {
      const s = chart.addAreaSeries({
        topColor: 'rgba(0,212,255,0.2)', bottomColor: 'rgba(0,212,255,0.02)',
        lineColor: 'rgba(0,212,255,0.6)', lineWidth: 1,
        priceLineVisible: false, title: 'OBV',
      });
      s.setData(zipPoints(dates, indData.obv));
      entry.series.obv = s;
    }

    if (indId === 'roc' && (Array.isArray(indData.roc))) {
      const s = chart.addLineSeries({ color: 'rgba(204,136,187,0.8)', lineWidth: 1.5, priceLineVisible: false, title: 'ROC' });
      s.setData(zipPoints(dates, indData.roc));
      entry.series.roc = s;
    }

    if (indId === 'atr' && (Array.isArray(indData.atr))) {
      const s = chart.addLineSeries({ color: 'rgba(187,136,51,0.8)', lineWidth: 1.5, priceLineVisible: false, title: 'ATR' });
      s.setData(zipPoints(dates, indData.atr));
      entry.series.atr = s;
    }
  }

  function updateSubPaneData(indId, paneEntry, dates) {
    // For a full refresh, destroy and recreate - simpler than incremental update
    // This only runs when indData changes
    const { chart, series } = paneEntry;
    Object.values(series).forEach(s => {
      try { chart.removeSeries(s); } catch { /* ok */ }
    });
    paneEntry.series = {};
    addSubPaneSeries(indId, chart, paneEntry, dates);
    chart.timeScale().fitContent();
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
      {/* Timeframe tabs */}
      {showControls && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
          borderBottom: '1px solid var(--hud-line)',
          background: 'linear-gradient(90deg, rgba(180,185,200,0.02) 0%, transparent 60%)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--hud-font)', fontSize: 8, fontWeight: 700,
            color: 'var(--hud-text-mid)', letterSpacing: 2, marginRight: 6,
          }}>
            {symbol}
          </span>
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
          {indError && (
            <span style={{ fontSize: 6, color: 'var(--hud-red)', fontFamily: 'var(--hud-font)', letterSpacing: 1, marginLeft: 'auto' }}>
              IND OFFLINE
            </span>
          )}
          {isComparisonMode && (
            <span style={{ fontSize: 7, color: 'var(--hud-accent)', fontFamily: 'var(--hud-font)', letterSpacing: 1, marginLeft: 'auto' }}>
              COMPARE MODE
            </span>
          )}
        </div>
      )}

      {/* Main chart area */}
      <div ref={mainContainerRef} style={{ flex: 1, minHeight: 120, position: 'relative' }}>
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

      {/* Sub-pane oscillators */}
      {activeSubPanes.map(indId => {
        const cfg = SUBPANE_CONFIGS[indId];
        if (!cfg) return null;
        return (
          <div key={indId} style={{ flexShrink: 0, borderTop: '1px solid var(--hud-line)' }}>
            <div style={{
              padding: '2px 8px',
              fontFamily: 'var(--hud-font)', fontSize: 7, fontWeight: 700,
              color: 'var(--hud-text-dim)', letterSpacing: 2,
              background: 'rgba(180,185,200,0.02)',
            }}>
              {cfg.label}
            </div>
            <div
              ref={el => { subContainerRefs.current[indId] = el; }}
              style={{ height: cfg.height, position: 'relative' }}
            />
          </div>
        );
      })}
    </div>
  );
}
