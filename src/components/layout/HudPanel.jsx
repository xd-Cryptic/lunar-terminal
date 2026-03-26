/**
 * HudPanel — Tactical HUD panel wrapper.
 * Monochrome angular bracket corners with tick marks,
 * thin-line header, scan-line animation.
 */

const PANEL_VARIANTS = {
  default: '',
  amber: 'hud-panel--amber',
  green: 'hud-panel--green',
  red: 'hud-panel--red',
};

export default function HudPanel({
  title,
  variant = 'default',
  scanning = false,
  actions,
  className = '',
  style,
  children,
}) {
  return (
    <div
      className={`hud-panel hud-scan ${PANEL_VARIANTS[variant] || ''} ${scanning ? 'hud-scan--active' : ''} ${className}`}
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', ...style }}
    >
      {/* Inner element for extra 2 corner brackets */}
      <div className="hud-panel-inner" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }} />

      {/* Holographic overlay: scan-lines + shimmer on hover/loading */}
      <div className="hud-holo-overlay" />

      {/* Header with tick marks */}
      <div className="hud-header">
        <span className="hud-header__dot" />
        <span className="hud-header__title">{title}</span>
        {/* Decorative tick marks */}
        <div className="hud-header__ticks">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="hud-header__tick" />
          ))}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{actions}</div>}
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
