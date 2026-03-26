/**
 * AnimatedBackground -- Full-screen canvas animation for the Lunar Terminal.
 * Renders behind all panels (z-index: 0) and shows through semi-transparent panels.
 *
 * Layers:
 *   1. Faint grid (40px spacing)
 *   2. Node anchor points with pulsing glow
 *   3. Curved bezier flow-lines between nearby nodes with travelling particles
 *   4. Slow-rotating central reticle circle
 *   5. Occasional "data burst" flashes on random nodes
 */

import { useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_SPACING = 40;
const GRID_COLOR = 'rgba(180,185,200,0.03)';

const LINE_COLOR_BASE = [180, 185, 200];       // monochrome cool-grey
const ACCENT_COLOR = [0, 212, 255];             // cyan

const NODE_COUNT = 10;
const PARTICLE_COUNT = 70;                      // ~60-80 range
const MAX_LINK_DIST = 0.38;                     // fraction of diagonal

const RETICLE_RADIUS_FRAC = 0.18;              // fraction of min(w,h)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Quadratic bezier point at t */
function quadBezier(x0, y0, cx, cy, x1, y1, t) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}

/** Generate deterministic-ish node positions spread across viewport */
function generateNodes(w, h) {
  // Place nodes at positions that feel like panel anchor points.
  // Use fractional coords so they rescale with the viewport.
  const anchors = [
    [0.08, 0.12],
    [0.30, 0.08],
    [0.65, 0.10],
    [0.90, 0.14],
    [0.12, 0.50],
    [0.50, 0.50],
    [0.88, 0.48],
    [0.15, 0.88],
    [0.55, 0.85],
    [0.85, 0.90],
  ];
  return anchors.slice(0, NODE_COUNT).map(([fx, fy], i) => ({
    x: fx * w,
    y: fy * h,
    phase: (i / NODE_COUNT) * Math.PI * 2,      // stagger pulse phases
    burstTime: 0,                                 // countdown for data-burst
    burstCooldown: 3000 + Math.random() * 8000,  // ms between bursts
    burstTimer: Math.random() * 6000,             // initial offset
  }));
}

/** Build edge list: connect nodes that are within MAX_LINK_DIST */
function buildEdges(nodes, w, h) {
  const maxD = MAX_LINK_DIST * Math.sqrt(w * w + h * h);
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = dist(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
      if (d < maxD) {
        // Control point: midpoint offset perpendicular to the line
        const mx = (nodes[i].x + nodes[j].x) / 2;
        const my = (nodes[i].y + nodes[j].y) / 2;
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        // perpendicular offset (alternate direction per pair for variety)
        const sign = (i + j) % 2 === 0 ? 1 : -1;
        const off = len * 0.15 * sign;
        edges.push({
          a: i,
          b: j,
          cx: mx + (-dy / len) * off,
          cy: my + (dx / len) * off,
          len: d,
        });
      }
    }
  }
  return edges;
}

/** Seed particles along edges */
function spawnParticles(edges) {
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const edgeIdx = Math.floor(Math.random() * edges.length);
    particles.push({
      edge: edgeIdx,
      t: Math.random(),                         // position along bezier 0..1
      speed: 0.0003 + Math.random() * 0.0005,   // per-ms advance
      size: 1 + Math.random() * 1.2,
      opacity: 0.25 + Math.random() * 0.35,
    });
  }
  return particles;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w, h;
    let nodes, edges, particles;
    let animId;
    let lastTime = performance.now();

    // -- Resize handler --
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      nodes = generateNodes(w, h);
      edges = buildEdges(nodes, w, h);
      particles = spawnParticles(edges);
    }

    resize();
    window.addEventListener('resize', resize);

    // -- Draw helpers --

    function drawGrid() {
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x <= w; x += GRID_SPACING) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y <= h; y += GRID_SPACING) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    }

    function drawEdges(time) {
      for (const edge of edges) {
        const na = nodes[edge.a];
        const nb = nodes[edge.b];
        // Slightly animate opacity with time
        const wave = 0.4 + 0.15 * Math.sin(time * 0.0004 + edge.a + edge.b);
        const [r, g, b] = LINE_COLOR_BASE;
        ctx.strokeStyle = `rgba(${r},${g},${b},${(0.04 * wave).toFixed(4)})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.quadraticCurveTo(edge.cx, edge.cy, nb.x, nb.y);
        ctx.stroke();
      }
    }

    function drawNodes(time) {
      for (const node of nodes) {
        // Pulse radius
        const pulse = Math.sin(time * 0.001 + node.phase);
        const baseR = 3;
        const r = baseR + pulse * 1.2;

        // Data-burst logic
        let burstAlpha = 0;
        if (node.burstTime > 0) {
          burstAlpha = node.burstTime / 600; // fade over 600ms
        }

        // Outer glow
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 6);
        const [cr, cg, cb] = ACCENT_COLOR;
        const glowAlpha = 0.06 + 0.03 * pulse + burstAlpha * 0.25;
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${glowAlpha.toFixed(4)})`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 6, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        const coreAlpha = 0.35 + 0.15 * pulse + burstAlpha * 0.5;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${coreAlpha.toFixed(4)})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Burst ring
        if (burstAlpha > 0.01) {
          const ringR = (1 - burstAlpha) * 30 + r;
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(burstAlpha * 0.5).toFixed(4)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    function drawParticles(time) {
      const [cr, cg, cb] = ACCENT_COLOR;
      const [lr, lg, lb] = LINE_COLOR_BASE;
      for (const p of particles) {
        const edge = edges[p.edge];
        if (!edge) continue;
        const na = nodes[edge.a];
        const nb = nodes[edge.b];
        const pt = quadBezier(na.x, na.y, edge.cx, edge.cy, nb.x, nb.y, p.t);

        // Blend between line color and accent
        const blend = 0.3 + 0.3 * Math.sin(time * 0.002 + p.t * 6);
        const pr = lerp(lr, cr, blend);
        const pg = lerp(lg, cg, blend);
        const pb = lerp(lb, cb, blend);

        ctx.fillStyle = `rgba(${pr | 0},${pg | 0},${pb | 0},${p.opacity.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawReticle(time) {
      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * RETICLE_RADIUS_FRAC;
      const angle = time * 0.0001; // slow rotation
      const [cr, cg, cb] = ACCENT_COLOR;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // Main ring
      const ringAlpha = 0.04 + 0.015 * Math.sin(time * 0.0006);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${ringAlpha.toFixed(4)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, baseR, 0, Math.PI * 2);
      ctx.stroke();

      // Tick marks on the ring (every 30 degrees)
      const tickLen = 6;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const innerR = baseR - tickLen;
        const tickAlpha = (i % 3 === 0) ? ringAlpha * 2 : ringAlpha;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${tickAlpha.toFixed(4)})`;
        ctx.lineWidth = (i % 3 === 0) ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
        ctx.lineTo(Math.cos(a) * baseR, Math.sin(a) * baseR);
        ctx.stroke();
      }

      // Second ring (counter-rotate by drawing at negative angle offset)
      const r2 = baseR * 0.72;
      ctx.rotate(-angle * 0.6); // partial counter-rotate
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(ringAlpha * 0.6).toFixed(4)})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, r2, 0, Math.PI * 2);
      ctx.stroke();

      // Short arcs on the inner ring
      for (let i = 0; i < 4; i++) {
        const startA = (i / 4) * Math.PI * 2 + time * 0.0003;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(ringAlpha * 1.5).toFixed(4)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r2, startA, startA + 0.3);
        ctx.stroke();
      }

      ctx.restore();

      // Crosshair (very faint, non-rotating)
      const chLen = baseR * 0.35;
      const chGap = 6;
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(ringAlpha * 0.8).toFixed(4)})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - chLen, cy);
      ctx.lineTo(cx - chGap, cy);
      ctx.moveTo(cx + chGap, cy);
      ctx.lineTo(cx + chLen, cy);
      ctx.moveTo(cx, cy - chLen);
      ctx.lineTo(cx, cy - chGap);
      ctx.moveTo(cx, cy + chGap);
      ctx.lineTo(cx, cy + chLen);
      ctx.stroke();
    }

    // -- Update logic --

    function updateParticles(dt) {
      for (const p of particles) {
        p.t += p.speed * dt;
        if (p.t > 1) {
          // Reassign to a random edge going forward
          p.t = 0;
          p.edge = Math.floor(Math.random() * edges.length);
        }
      }
    }

    function updateNodeBursts(dt) {
      for (const node of nodes) {
        // Decrease active burst
        if (node.burstTime > 0) {
          node.burstTime = Math.max(0, node.burstTime - dt);
        }
        // Count toward next burst
        node.burstTimer += dt;
        if (node.burstTimer >= node.burstCooldown) {
          node.burstTimer = 0;
          node.burstTime = 600; // 600ms burst
          node.burstCooldown = 3000 + Math.random() * 8000;
        }
      }
    }

    // -- Main loop --

    function frame(now) {
      const dt = Math.min(now - lastTime, 50); // cap at 50ms to avoid huge jumps
      lastTime = now;

      ctx.clearRect(0, 0, w, h);

      // 1. Grid
      drawGrid();

      // 2. Edges (flow paths)
      drawEdges(now);

      // 3. Reticle
      drawReticle(now);

      // 4. Particles
      updateParticles(dt);
      drawParticles(now);

      // 5. Nodes (on top of particles so glow is visible)
      updateNodeBursts(dt);
      drawNodes(now);

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    // -- Cleanup --
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
