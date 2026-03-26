/**
 * AdvancedView — Tactical HUD Command Center with resizable panels.
 * Monochrome targeting-system aesthetic with geometric overlays.
 *
 * Layout Grid:
 * ┌──────────┬────────────────────┬───────────┐
 * │          │   HudChart         │ NewsPanel │
 * │ Watchlist│   (candlestick)    │ (filtered)│
 * │ (market  ├────────────────────┤───────────┤
 * │  quotes) │ TechReadout+Signal │ AI / Risk │
 * │          │   (BUY/SELL)       │ (tabbed)  │
 * ├──────────┴────────────────────┴───────────┤
 * │  Portfolio │ Positions │ QuantViz3D+Macro  │
 * └───────────────────────────────────────────┘
 */

import { useState, useCallback, useRef } from 'react';
import HudWatchlist from '../components/trading/HudWatchlist';
import HudChart from '../components/charts/HudChart';
import SignalStrip from '../components/trading/SignalStrip';
import TechReadout from '../components/quant/TechReadout';
import HudNewsPanel from '../components/news/HudNewsPanel';
import AiRiskPanel from '../components/quant/AiRiskPanel';
import HudBottomBar from '../components/layout/HudBottomBar';

function HudReticle() {
  return (
    <>
      <div className="hud-reticle">
        <div className="hud-reticle__ring hud-reticle__ring--outer" />
        <div className="hud-reticle__ring hud-reticle__ring--mid" />
        <div className="hud-reticle__ring hud-reticle__ring--inner" />
        <div className="hud-reticle__arc" />
        <div className="hud-reticle__arc hud-reticle__arc--reverse" />
      </div>
      <div className="hud-crosshair">
        <div className="hud-crosshair__h" />
        <div className="hud-crosshair__v" />
      </div>
      <div className="hud-corner-deco hud-corner-deco--tl">
        <div className="hud-corner-deco__bracket" />
        <div className="hud-corner-deco__ticks">
          <span /><span /><span /><span /><span />
        </div>
      </div>
      <div className="hud-corner-deco hud-corner-deco--tr">
        <div className="hud-corner-deco__bracket" />
        <div className="hud-corner-deco__ticks">
          <span /><span /><span /><span /><span />
        </div>
      </div>
      <div className="hud-corner-deco hud-corner-deco--bl">
        <div className="hud-corner-deco__bracket" />
      </div>
      <div className="hud-corner-deco hud-corner-deco--br">
        <div className="hud-corner-deco__bracket" />
      </div>
    </>
  );
}

function useResizeHandle(axis, initial, min, max) {
  const [size, setSize] = useState(initial);
  const sizeRef = useRef(initial);
  const startPos = useRef(0);

  // Keep ref in sync with state so mousedown always captures the latest value
  sizeRef.current = size;

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    startPos.current = axis === 'x' ? e.clientX : e.clientY;
    const capturedStart = sizeRef.current;

    const onMouseMove = (ev) => {
      const delta = (axis === 'x' ? ev.clientX : ev.clientY) - startPos.current;
      const next = Math.min(max, Math.max(min, capturedStart + delta));
      sizeRef.current = next;
      setSize(next);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [axis, min, max]);

  return [size, onMouseDown];
}

export default function AdvancedView() {
  const [leftW, onLeftDrag] = useResizeHandle('x', 165, 120, 280);
  const [rightW, onRightDrag] = useResizeHandle('x', 295, 180, 420);
  const [bottomH, onBottomDrag] = useResizeHandle('y', 175, 100, 320);

  return (
    <div
      className="advanced-view"
      style={{
        gridTemplateColumns: `${leftW}px 1fr ${rightW}px`,
        gridTemplateRows: `1fr ${bottomH}px`,
      }}
    >
      <HudReticle />

      {/* Left column + resize handle */}
      <div style={{ position: 'relative', minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <HudWatchlist />
        <div className="resize-handle resize-handle--col" onMouseDown={onLeftDrag}
             style={{ right: -3 }} />
      </div>

      {/* Center column — chart + analysis + signals */}
      <div className="adv-center">
        <HudChart />
        <TechReadout />
        <SignalStrip />
      </div>

      {/* Right column + resize handle */}
      <div style={{ position: 'relative', minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <div className="resize-handle resize-handle--col" onMouseDown={onRightDrag}
             style={{ left: -3 }} />
        <div className="adv-right">
          <HudNewsPanel />
          <AiRiskPanel />
        </div>
      </div>

      {/* Bottom bar + resize handle */}
      <div style={{ gridColumn: '1 / -1', position: 'relative', minHeight: 0 }}>
        <div className="resize-handle resize-handle--row" onMouseDown={onBottomDrag}
             style={{ top: -3 }} />
        <HudBottomBar />
      </div>
    </div>
  );
}
