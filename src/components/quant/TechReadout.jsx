/**
 * TechReadout — Compact technical indicator readouts for the HUD.
 * Shows RSI, MACD, SMA, EMA, VWAP, ATR, Bollinger positions.
 */

import useStore from '../../store/useStore';
import * as api from '../../utils/api';
import usePolling from '../../hooks/usePolling';
import HudPanel from '../layout/HudPanel';

/** Extract last numeric value from an array (backend returns parallel arrays). */
const lastNum = (arr) => {
  if (!Array.isArray(arr)) return null;
  const vals = arr.filter(v => v != null && !isNaN(v));
  return vals.length ? Number(vals[vals.length - 1]) : null;
};

export default function TechReadout() {
  const { activeSymbol, quotes } = useStore();
  const q = quotes[activeSymbol] || {};

  const { data: ind } = usePolling(
    () => api.getIndicators(activeSymbol, 'sma,ema,rsi,macd,bbands,vwap,atr,adx').catch(() => null),
    15000,
    [activeSymbol]
  );

  const { data: sigData } = usePolling(
    () => api.getSwingSignals(activeSymbol).catch(() => null),
    15000,
    [activeSymbol]
  );

  if (!ind) {
    return (
      <HudPanel title="TECH ANALYSIS" style={{ minHeight: 0 }}>
        <div style={{ padding: 8, fontSize: 8, color: 'var(--hud-text-dim)', fontFamily: 'var(--hud-font)', letterSpacing: 2, textAlign: 'center' }}>
          LOADING INDICATORS...
        </div>
      </HudPanel>
    );
  }

  // Simple arrays — lastNum works directly
  const rsi = lastNum(ind.rsi);
  const sma = lastNum(ind.sma);
  const ema = lastNum(ind.ema);
  const vwap = lastNum(ind.vwap);
  const atr = lastNum(ind.atr);
  const adx = lastNum(ind.adx);
  const price = q.price;

  // MACD is nested: { macd: [...], signal: [...], histogram: [...] }
  const macdVal = lastNum(ind.macd?.macd);
  const macdSignal = lastNum(ind.macd?.signal);

  // BBands is nested: { upper: [...], mid: [...], lower: [...] }
  const bbUpper = lastNum(ind.bbands?.upper);
  const bbLower = lastNum(ind.bbands?.lower);

  const rsiColor = rsi > 70 ? 'var(--hud-red)' : rsi < 30 ? 'var(--hud-green)' : 'var(--hud-text)';
  const rsiLabel = rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL';

  const macdBullish = macdVal != null && macdSignal != null && macdVal > macdSignal;

  const bbPosition = price && bbUpper && bbLower && bbUpper !== bbLower
    ? ((price - bbLower) / (bbUpper - bbLower) * 100).toFixed(0)
    : null;

  const signals = sigData?.signals || [];
  const buys = signals.filter(s => s.type === 'BUY').length;
  const sells = signals.filter(s => s.type === 'SELL').length;

  return (
    <HudPanel title="TECH ANALYSIS" style={{ minHeight: 0 }}>
      <div style={{ padding: '4px 8px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* RSI */}
        {rsi != null && (
          <div className="hud-readout">
            <span className="hud-readout__label">RSI</span>
            <span className="hud-readout__value" style={{ color: rsiColor }}>{rsi.toFixed(1)}</span>
            <span style={{ fontSize: 5, color: rsiColor, letterSpacing: 1 }}>{rsiLabel}</span>
          </div>
        )}

        {/* MACD */}
        {macdVal != null && (
          <div className="hud-readout">
            <span className="hud-readout__label">MACD</span>
            <span className="hud-readout__value" style={{ color: macdBullish ? 'var(--hud-green)' : 'var(--hud-red)' }}>
              {macdVal.toFixed(2)}
            </span>
            <span style={{ fontSize: 5, color: 'var(--hud-text-dim)', letterSpacing: 1 }}>
              SIG {macdSignal?.toFixed(2) ?? '—'}
            </span>
          </div>
        )}

        {/* SMA */}
        {sma != null && (
          <div className="hud-readout">
            <span className="hud-readout__label">SMA 20</span>
            <span className="hud-readout__value">{sma.toFixed(2)}</span>
          </div>
        )}

        {/* EMA */}
        {ema != null && (
          <div className="hud-readout">
            <span className="hud-readout__label">EMA</span>
            <span className="hud-readout__value">{ema.toFixed(2)}</span>
          </div>
        )}

        {/* VWAP */}
        {vwap != null && (
          <div className="hud-readout">
            <span className="hud-readout__label">VWAP</span>
            <span className="hud-readout__value" style={{
              color: price && price > vwap ? 'var(--hud-green)' : 'var(--hud-red)',
            }}>{vwap.toFixed(2)}</span>
          </div>
        )}

        {/* ATR */}
        {atr != null && (
          <div className="hud-readout">
            <span className="hud-readout__label">ATR</span>
            <span className="hud-readout__value">{atr.toFixed(2)}</span>
          </div>
        )}

        {/* ADX */}
        {adx != null && (
          <div className="hud-readout">
            <span className="hud-readout__label">ADX</span>
            <span className="hud-readout__value" style={{
              color: adx > 25 ? 'var(--hud-text)' : 'var(--hud-text-dim)',
            }}>{adx.toFixed(1)}</span>
            <span style={{ fontSize: 5, color: 'var(--hud-text-dim)', letterSpacing: 1 }}>
              {adx > 50 ? 'STRONG' : adx > 25 ? 'TREND' : 'WEAK'}
            </span>
          </div>
        )}

        {/* Bollinger Position */}
        {bbPosition != null && (
          <div className="hud-readout">
            <span className="hud-readout__label">BB POS</span>
            <span className="hud-readout__value" style={{
              color: bbPosition > 80 ? 'var(--hud-red)' : bbPosition < 20 ? 'var(--hud-green)' : 'var(--hud-text)',
            }}>{bbPosition}%</span>
          </div>
        )}

        {/* Support / Resistance from BB */}
        {bbUpper != null && bbLower != null && (
          <div className="hud-readout">
            <span className="hud-readout__label">S/R</span>
            <span style={{ fontSize: 8, fontFamily: 'var(--hud-font)', color: 'var(--hud-green)', letterSpacing: 0.5 }}>
              S {bbLower.toFixed(2)}
            </span>
            <span style={{ fontSize: 8, fontFamily: 'var(--hud-font)', color: 'var(--hud-red)', letterSpacing: 0.5 }}>
              R {bbUpper.toFixed(2)}
            </span>
          </div>
        )}

        {/* Signal Summary */}
        {signals.length > 0 && (
          <div className="hud-readout">
            <span className="hud-readout__label">SIGNALS</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 8, fontFamily: 'var(--hud-font)', color: 'var(--hud-green)' }}>{buys} BUY</span>
              <span style={{ fontSize: 8, fontFamily: 'var(--hud-font)', color: 'var(--hud-red)' }}>{sells} SELL</span>
            </div>
          </div>
        )}
      </div>
    </HudPanel>
  );
}
