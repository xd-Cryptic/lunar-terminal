/**
 * QuantViz3D.jsx — Isometric 3D bar chart (volatility surface / heatmap)
 * Renders a LightningChart-style coloured 3D bar grid on a canvas element.
 * Zero dependencies — pure canvas API.
 */

import React, { useRef, useEffect, useCallback } from 'react';

function lerp(a, b, t) { return a + (b - a) * t; }

function valueToColor(v, min, max) {
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
  // Blue → Cyan → Green → Yellow → Orange → Red (LightningChart palette)
  const stops = [
    [0,   [0,   80,  200]],
    [0.2, [0,   180, 220]],
    [0.4, [0,   220, 130]],
    [0.6, [180, 220,  30]],
    [0.8, [255, 160,   0]],
    [1.0, [220,  30,  20]],
  ];
  let c0 = stops[0][1], c1 = stops[1][1], local = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i+1][0]) {
      local = (t - stops[i][0]) / (stops[i+1][0] - stops[i][0]);
      c0 = stops[i][1]; c1 = stops[i+1][1];
      break;
    }
  }
  const r = Math.round(lerp(c0[0], c1[0], local));
  const g = Math.round(lerp(c0[1], c1[1], local));
  const b = Math.round(lerp(c0[2], c1[2], local));
  return [r, g, b];
}

function iso(x, y, z, tileW, tileH, originX, originY) {
  // Isometric projection
  const px = originX + (x - y) * (tileW / 2);
  const py = originY + (x + y) * (tileH / 2) - z * tileH * 1.5;
  return [px, py];
}

function drawBar(ctx, gx, gy, h, tileW, tileH, ox, oy, rgb) {
  const [r, g, b] = rgb;
  const top    = iso(gx, gy, h, tileW, tileH, ox, oy);
  const topR   = iso(gx+1, gy, h, tileW, tileH, ox, oy);
  const topB   = iso(gx, gy+1, h, tileW, tileH, ox, oy);
  const topBR  = iso(gx+1, gy+1, h, tileW, tileH, ox, oy);
  const bot    = iso(gx, gy, 0, tileW, tileH, ox, oy);
  const botR   = iso(gx+1, gy, 0, tileW, tileH, ox, oy);
  const botB   = iso(gx, gy+1, 0, tileW, tileH, ox, oy);

  if (h <= 0) return;

  // Top face (brightest)
  ctx.beginPath();
  ctx.moveTo(...top); ctx.lineTo(...topR); ctx.lineTo(...topBR); ctx.lineTo(...topB);
  ctx.closePath();
  ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${Math.min(r+40,255)},${Math.min(g+40,255)},${Math.min(b+40,255)},0.6)`;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Left face (medium)
  ctx.beginPath();
  ctx.moveTo(...top); ctx.lineTo(...topB); ctx.lineTo(...botB); ctx.lineTo(...bot);
  ctx.closePath();
  ctx.fillStyle = `rgba(${Math.round(r*0.55)},${Math.round(g*0.55)},${Math.round(b*0.55)},0.95)`;
  ctx.fill();

  // Right face (darkest)
  ctx.beginPath();
  ctx.moveTo(...topR); ctx.lineTo(...topBR); ctx.lineTo(...botB); /* wrong — fix */ 
  ctx.moveTo(...top); ctx.lineTo(...topR); ctx.lineTo(...botR); ctx.lineTo(...bot);
  ctx.closePath();
  ctx.fillStyle = `rgba(${Math.round(r*0.35)},${Math.round(g*0.35)},${Math.round(b*0.35)},0.95)`;
  ctx.fill();
}

function generateSurface(cols, rows) {
  const data = [];
  for (let y = 0; y < rows; y++) {
    data[y] = [];
    for (let x = 0; x < cols; x++) {
      // Simulated volatility surface: two humps + noise
      const nx = x / cols, ny = y / rows;
      const v1 = Math.exp(-((nx-0.3)**2 + (ny-0.3)**2) / 0.04) * 85;
      const v2 = Math.exp(-((nx-0.7)**2 + (ny-0.6)**2) / 0.06) * 70;
      const v3 = Math.exp(-((nx-0.5)**2 + (ny-0.8)**2) / 0.03) * 60;
      const noise = (Math.sin(nx*20) * Math.cos(ny*15)) * 5;
      data[y][x] = Math.max(2, v1 + v2 + v3 + noise + 8);
    }
  }
  return data;
}

export default function QuantViz3D({ width = 280, height = 160, title = 'VOL SURFACE', cols = 14, rows = 14 }) {
  const canvasRef = useRef(null);
  const dataRef   = useRef(generateSurface(cols, rows));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#020810';
    ctx.fillRect(0, 0, W, H);

    const data  = dataRef.current;
    const tileW = 14, tileH = 6;
    const ox = W * 0.5, oy = H * 0.78;
    const allVals = data.flat();
    const minV = Math.min(...allVals), maxV = Math.max(...allVals);

    // Draw grid floor
    ctx.strokeStyle = 'rgba(0,212,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= cols; x++) {
      const [ax, ay] = iso(x, 0, 0, tileW, tileH, ox, oy);
      const [bx, by] = iso(x, rows, 0, tileW, tileH, ox, oy);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      const [ax, ay] = iso(0, y, 0, tileW, tileH, ox, oy);
      const [bx, by] = iso(cols, y, 0, tileW, tileH, ox, oy);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }

    // Draw bars back-to-front (painter's algorithm)
    for (let y = rows - 1; y >= 0; y--) {
      for (let x = 0; x < cols; x++) {
        const v = data[y][x];
        const h = (v / maxV) * 6;
        const rgb = valueToColor(v, minV, maxV);
        drawBar(ctx, x, y, h, tileW, tileH, ox, oy, rgb);
      }
    }

    // Legend bar (right side)
    const lx = W - 22, ly = H * 0.12, lh = H * 0.65, lw = 8;
    const grad = ctx.createLinearGradient(0, ly, 0, ly + lh);
    grad.addColorStop(0,   'rgb(220,30,20)');
    grad.addColorStop(0.25,'rgb(255,160,0)');
    grad.addColorStop(0.5, 'rgb(0,220,130)');
    grad.addColorStop(0.75,'rgb(0,180,220)');
    grad.addColorStop(1,   'rgb(0,80,200)');
    ctx.fillStyle = grad;
    ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = 'rgba(0,212,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(lx, ly, lw, lh);

    // Legend labels
    ctx.fillStyle = '#4e6a90';
    ctx.font = '7px JetBrains Mono, monospace';
    ctx.fillText(Math.round(maxV), lx + lw + 2, ly + 6);
    ctx.fillText(Math.round(minV), lx + lw + 2, ly + lh);

    // Axis labels
    ctx.fillStyle = 'rgba(0,212,255,0.4)';
    ctx.font = '7px JetBrains Mono, monospace';
    const [ax0, ay0] = iso(cols/2, rows, 0, tileW, tileH, ox, oy);
    ctx.fillText('STRIKE', ax0 - 14, ay0 + 12);
    const [ax1, ay1] = iso(0, rows/2, 0, tileW, tileH, ox, oy);
    ctx.fillText('EXPIRY', ax1 - 28, ay1 + 6);
  }, [cols, rows]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Slowly rotate/animate by updating data
  useEffect(() => {
    let frame;
    let t = 0;
    const animate = () => {
      t += 0.004;
      const d = dataRef.current;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const nx = x / cols, ny = y / rows;
          const v1 = Math.exp(-((nx-0.3)**2 + (ny-0.3)**2) / 0.04) * 85;
          const v2 = Math.exp(-((nx-0.7)**2 + (ny-0.6)**2) / 0.06) * 70;
          const wave = Math.sin(nx*8 + t) * Math.cos(ny*6 + t) * 8;
          d[y][x] = Math.max(2, v1 + v2 + wave + 8);
        }
      }
      draw();
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [draw, rows, cols]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
