// FilmDoodle — 復古印刷與色鉛筆的筆刷（第六版）
// 參考使用者整理的風格：A 色鉛筆小物、B 植物版畫、D 實驗性多媒材（十字繡格、點描線稿）。
// 全部用程式畫：SVG path → 打散成點、手抖 → canvas，所以放多大都清楚，也不需要圖檔。

import { flattenPath, wobblePath } from './crayon.js';

// ---------- 共用：小亂數 ----------
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
const hexRgb = (hex) => { const v = parseInt(hex.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(',')})`; };

// ---------- 色鉛筆：細細的斜向筆觸＋顆粒（填色），外框描兩三次 ----------
const pencilCache = new Map();
function pencilCanvas(color, angle) {
  const key = color + angle;
  if (pencilCache.has(key)) return pencilCache.get(key);
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const r = rng(angle * 97 + 11);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  // 一條一條短短的鉛筆線（可以無縫重複：畫在 3×3 的位置上）
  for (let i = 0; i < 950; i++) {
    const x = r() * S, y = r() * S, len = 6 + r() * 14, a = angle + (r() - 0.5) * 0.3;
    ctx.globalAlpha = 0.3 + r() * 0.55;
    ctx.lineWidth = 0.7 + r() * 1.1;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y + dy);
      ctx.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  // 紙紋：零星沒塗到的小白點
  const id = ctx.getImageData(0, 0, S, S), px = id.data;
  for (let i = 0; i < px.length; i += 4) if (r() < 0.06) px[i + 3] = Math.round(px[i + 3] * 0.2);
  ctx.putImageData(id, 0, 0);
  pencilCache.set(key, c);
  return c;
}
function pencilStyle(ctx, color, angle, cell, seed) {
  const pat = ctx.createPattern(pencilCanvas(color, angle), 'repeat');
  if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().translate((seed * 31) % 128, (seed * 17) % 128).scale(cell));
  return pat;
}
// 外框顏色：同色系加深（不用黑線）
export const pencilInk = (fill) => mix(fill, '#655047', 0.45);

export function drawPencilDef(ctx, def, color, strokeScale = 1, seed = 1) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const cell = 0.32;
  def.parts.forEach((p, i) => {
    const fc = p.f === 'M' ? color : p.f, sc = p.s === 'M' ? color : p.s === 'D' ? pencilInk(fc || color) : p.s;
    const a = p.a ?? 1, sd = seed + i * 13;
    if (fc && typeof fc === 'string') {
      const path = wobblePath(p.d, 0.7, sd, 0.07);
      // 兩個方向的筆觸疊起來，像色鉛筆來回塗
      ctx.globalAlpha = a;
      ctx.fillStyle = pencilStyle(ctx, fc, -0.75, cell, sd);
      ctx.fill(path, 'evenodd');
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = pencilStyle(ctx, fc, -0.35, cell, sd + 5);
      ctx.fill(path, 'evenodd');
    }
    if (sc) {
      const w = (p.w || 2) * strokeScale;
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = a * (k ? 0.55 : 0.95);
        ctx.strokeStyle = pencilStyle(ctx, sc, -0.6 + k * 0.4, cell * 0.8, sd + k * 7);
        ctx.lineWidth = w * (k ? 0.55 : 0.75);
        ctx.stroke(wobblePath(p.d, 0.55 + k * 0.35, sd + k * 101, 0.08));
      }
    }
  });
  ctx.globalAlpha = 1;
}

// ---------- 版畫：單色實心＋顆粒＋邊緣粗糙＋少許漏墨；挖空用 evenodd ----------
const inkCache = new Map();
function inkCanvas(color) {
  if (inkCache.has(color)) return inkCache.get(color);
  const S = 160, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  const id = ctx.getImageData(0, 0, S, S), px = id.data;
  const r = rng(4242);
  // 大塊的印壓不均（4×4 平滑雜訊，可以無縫重複）＋細顆粒＋零星白點
  const g = Array.from({ length: 16 }, () => r());
  const at = (x, y) => g[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const fx = (x / S) * 4, fy = (y / S) * 4, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
    const big = (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
    const n = r();
    let a = 0.8 + 0.2 * big - 0.22 * n * n;
    if (n > 0.975 || (big < 0.2 && n > 0.75)) a = 0.18;
    px[(y * S + x) * 4 + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
  }
  ctx.putImageData(id, 0, 0);
  inkCache.set(color, c);
  return c;
}
function inkStyle(ctx, color, cell, seed) {
  const pat = ctx.createPattern(inkCanvas(color), 'repeat');
  if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().translate((seed * 37) % 160, (seed * 61) % 160).scale(cell));
  return pat;
}
export const PAPER = '#f4eedf';
// parts 的 f：'M' = 墨色（使用者可換）、'P' = 紙色（版畫方格的底）、其他 = 固定色
export function drawPrintDef(ctx, def, color, strokeScale = 1, seed = 1) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  def.parts.forEach((p, i) => {
    const fc = p.f === 'M' ? color : p.f === 'P' ? PAPER : p.f, sc = p.s === 'M' ? color : p.s === 'P' ? PAPER : p.s;
    const sd = seed + i * 19, a = p.a ?? 1;
    // 刻版的邊緣：抖動比色鉛筆大一點、頻率高一點
    const path = wobblePath(p.d, 0.9, sd, 0.16);
    ctx.globalAlpha = a * 0.92;
    if (fc) { ctx.fillStyle = inkStyle(ctx, fc, 0.4, sd); ctx.fill(path, 'evenodd'); }
    if (sc) { ctx.strokeStyle = inkStyle(ctx, sc, 0.4, sd); ctx.lineWidth = (p.w || 2) * strokeScale; ctx.stroke(path); }
  });
  ctx.globalAlpha = 1;
}

// ---------- 十字繡格：在照片上疊一塊半透明格線，圖案用白色 X 繡出來 ----------
// motifs：[{ def, x, y, size, rot }]（x,y,size 是面板內 0~1 的位置與大小）
export function drawCrossStitch(ctx, W, H, o) {
  const S = Math.min(W, H), r = rng(o.seed || 1);
  const cols = Math.round(o.cols || 34), cell = (W * (o.panelW || 0.74)) / cols;
  const rows = Math.round((H * (o.panelH || 0.78)) / cell);
  const pw = cols * cell, ph = rows * cell, px = (W - pw) / 2 + (o.dx || 0) * W, py = (H - ph) / 2 + (o.dy || 0) * H;
  // 半透明面板＋格線
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${o.panelAlpha ?? 0.1})`;
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = 'rgba(255,255,255,.34)';
  ctx.lineWidth = Math.max(0.6, S * 0.0012);
  ctx.beginPath();
  for (let i = 0; i <= cols; i++) { ctx.moveTo(px + i * cell, py); ctx.lineTo(px + i * cell, py + ph); }
  for (let j = 0; j <= rows; j++) { ctx.moveTo(px, py + j * cell); ctx.lineTo(px + pw, py + j * cell); }
  ctx.stroke();
  // 圖案先畫在「一格一像素」的小畫布上，看哪些格子要繡
  const m = document.createElement('canvas');
  m.width = cols; m.height = rows;
  const mx = m.getContext('2d');
  mx.fillStyle = '#000'; mx.strokeStyle = '#000';
  mx.lineCap = 'round'; mx.lineJoin = 'round';
  for (const it of o.motifs || []) {
    const [vw, vh] = it.def.vb || [100, 100], k = (it.size * cols) / Math.max(vw, vh);
    mx.save();
    mx.translate(it.x * cols, it.y * rows);
    mx.rotate(it.rot || 0);
    if (it.flip) mx.scale(-1, 1);
    mx.scale(k, k);
    mx.translate(-vw / 2, -vh / 2);
    for (const p of it.def.parts) {
      const path = new Path2D(p.d);
      if (p.f) mx.fill(path, 'evenodd');
      if (p.s) { mx.lineWidth = Math.max(p.w || 2, 1.15 / k); mx.stroke(path); }
    }
    mx.restore();
  }
  const data = mx.getImageData(0, 0, cols, rows).data;
  ctx.strokeStyle = o.thread || '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineWidth = cell * 0.2;
  ctx.shadowColor = 'rgba(40,40,70,.35)';
  ctx.shadowBlur = cell * 0.25;
  const q = cell * 0.24;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (data[(j * cols + i) * 4 + 3] < 110) continue;
    const cx = px + (i + 0.5) * cell + (r() - 0.5) * cell * 0.06, cy = py + (j + 0.5) * cell + (r() - 0.5) * cell * 0.06;
    ctx.globalAlpha = 0.86 + r() * 0.14;
    ctx.beginPath();
    ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q);
    ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- 點描線稿：沿著線條灑白點與小十字，花心帶一點奶油黃 ----------
export function drawStipple(ctx, W, H, o) {
  const S = Math.min(W, H), r = rng(o.seed || 1);
  const dot = S * (o.dot || 0.0042);
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,.55)';
  ctx.shadowBlur = dot * 1.6;
  for (const it of o.motifs || []) {
    const [vw, vh] = it.def.vb || [100, 100], k = (it.size * S) / Math.max(vw, vh);
    const ox = it.x * W, oy = it.y * H, c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0), fl = it.flip ? -1 : 1;
    const toXY = (x, y) => { const lx = (x - vw / 2) * k * fl, ly = (y - vh / 2) * k; return [ox + lx * c - ly * s, oy + lx * s + ly * c]; };
    it.def.parts.forEach((p) => {
      const accent = p.accent; // 花心：白點＋黃點、比較密
      for (const sp of flattenPath(p.d, 1.2)) {
        let acc = 0;
        for (let n = 1; n < sp.pts.length; n++) {
          const [x0, y0] = sp.pts[n - 1], [x1, y1] = sp.pts[n];
          acc += Math.hypot(x1 - x0, y1 - y0) * k;
          const step = dot * (accent ? 1.3 : 2.1);
          while (acc > step) {
            acc -= step;
            const t = r(), [X, Y] = toXY(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
            const spread = dot * (accent ? 3.2 : 1.4);
            const jx = (r() - 0.5) * spread, jy = (r() - 0.5) * spread;
            ctx.fillStyle = accent && r() < 0.45 ? (o.accent || '#f3e66b') : '#ffffff';
            ctx.globalAlpha = 0.75 + r() * 0.25;
            const d = dot * (0.6 + r() * 0.8);
            if (r() < 0.22) { // 小十字
              ctx.fillRect(X + jx - d, Y + jy - d * 0.25, d * 2, d * 0.5);
              ctx.fillRect(X + jx - d * 0.25, Y + jy - d, d * 0.5, d * 2);
            } else ctx.fillRect(X + jx - d / 2, Y + jy - d / 2, d, d);
          }
        }
      }
    });
  }
  ctx.restore();
}
