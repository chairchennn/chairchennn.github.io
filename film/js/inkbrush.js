// FilmDoodle — 墨線＋套色筆刷（第九版，style: 'ink'）
// 風格：沾水筆／毛筆的黑色線條（粗細不一、略抖、收筆變細、圓圈偶爾沒接起來），
// 底下是朱紅、粉藍的平塗色塊，每一版都「套色不準」地偏出線外一點，像便宜的兩色印刷。
// 只學畫法，不照搬任何一張圖的構圖或圖案。
//
// parts：{ d, f }＝色塊（'M' 主色、'R' 朱紅、'B' 粉藍、'K' 黑、'W' 紙白，或任何 #hex）
//        { d, s, w }＝墨線（'K' 黑、其他同上），w 是 100 格座標裡的粗細
//        { d, s, w, even: true }＝細而均勻的線（手寫字、格線），不做粗細變化
// 色塊先畫（各版偏移），墨線最後畫（不偏移，是對準的那一版）。

import { flattenPath } from './crayon.js';

export const INK_RED = '#E8553A', INK_BLUE = '#86B4E3', INK_BLACK = '#232123', INK_WHITE = '#FBF8F1';

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
// 1D 平滑雜訊（-1~1）
function noise1(seed) {
  const r = rng(seed), g = Array.from({ length: 64 }, () => r() * 2 - 1);
  return (t) => {
    const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
    const a = g[((i % 64) + 64) % 64], b = g[(((i + 1) % 64) + 64) % 64];
    return a + (b - a) * u;
  };
}

// 紙白顆粒：平塗的顏料不會完全均勻，有一點淡淡的深淺與小白點
const grainCache = new Map();
function grainCanvas(color) {
  if (grainCache.has(color)) return grainCache.get(color);
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  const id = ctx.getImageData(0, 0, S, S), px = id.data, r = rng(9191);
  const G = 16, g = Array.from({ length: G * G }, () => r());
  const at = (x, y) => g[((y + G) % G) * G + ((x + G) % G)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const fx = x / 8, fy = y / 8, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const v = (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
    const n = r(), i = (y * S + x) * 4;
    let a = 0.9 + 0.1 * v - (n > 0.985 ? 0.45 : 0);
    const k = 1 - 0.06 * (v - 0.5);
    px[i] *= k; px[i + 1] *= k; px[i + 2] *= k;
    px[i + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
  }
  ctx.putImageData(id, 0, 0);
  grainCache.set(color, c);
  return c;
}

const resolve = (c, color) => (c === 'M' ? color : c === 'R' ? INK_RED : c === 'B' ? INK_BLUE : c === 'K' ? INK_BLACK : c === 'W' ? INK_WHITE : c);

// 色塊：整版偏移＋邊緣微微起伏
function fillPlate(ctx, d, fill, off, nz, seed) {
  const subs = flattenPath(d, 1.4);
  ctx.beginPath();
  for (const sp of subs) {
    sp.pts.forEach(([x, y], i) => {
      const t = (x + y) * 0.11 + i * 0.05;
      const X = x + off[0] + nz(t + seed) * 0.7, Y = y + off[1] + nz(t + seed + 17) * 0.7;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    });
    ctx.closePath();
  }
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
}

// 墨線：沿著線算法線，寬度隨雜訊與頭尾收筆變化，畫成實心的帶子
function inkStroke(ctx, d, w, col, r, nz, even) {
  for (const sp of flattenPath(d, 1)) {
    let P = sp.pts;
    if (P.length < 2) continue;
    // 閉合的線：有時候故意不接起來（留 1~3 格的缺口），有時候多畫一點點
    if (sp.closed) {
      // 先把收尾那一段（Z）補成點，再依長度決定留缺口（1~3 格）或多畫一點點
      const a = P[P.length - 1], b = P[0], k = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      P = [...P, ...Array.from({ length: k }, (_, i) => [a[0] + ((b[0] - a[0]) * (i + 1)) / k, a[1] + ((b[1] - a[1]) * (i + 1)) / k])];
      const gap = r() < 0.45 ? 1 + r() * 2.5 : 0;
      if (gap) { let g = 0; while (P.length > 3 && g < gap) { const q = P.pop(), e = P[P.length - 1]; g += Math.hypot(q[0] - e[0], q[1] - e[1]); } } else P = [...P, ...P.slice(1, 3)];
    }
    const L = [0];
    for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const tot = L[L.length - 1] || 1, ph = r() * 50, press = 0.85 + r() * 0.3;
    const left = [], right = [];
    P.forEach((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, nx = -dy / m, ny = dx / m;
      const s = L[i];
      // 手抖：很慢的偏移
      const j = even ? 0.25 : 0.45;
      const x = p[0] + nz(s * 0.05 + ph) * j, y = p[1] + nz(s * 0.05 + ph + 31) * j;
      // 粗細：毛筆的按壓起伏＋頭尾收筆
      const head = Math.min(1, (s + 0.6) / Math.min(6, tot * 0.3)), tail = Math.min(1, (tot - s + 0.6) / Math.min(8, tot * 0.35));
      const vary = even ? 1 : press * (0.82 + 0.3 * nz(s * 0.09 + ph + 7));
      const hw = (w / 2) * vary * (even ? 1 : 0.45 + 0.55 * Math.min(head, tail));
      left.push([x + nx * hw, y + ny * hw]);
      right.push([x - nx * hw, y - ny * hw]);
    });
    ctx.beginPath();
    left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill('nonzero');
    // 圓頭，避免急轉彎處出現缺角
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.min(w * 0.35, 0.8);
    ctx.strokeStyle = col;
    ctx.stroke();
  }
}

// 剪紙底（參考圖 29 的剪下來貼上去）：外圍凸包往外擴，再用剪刀剪成不規則的直邊多角形
const paperCache = new WeakMap();
function paperOutline(def, seed) {
  const key = paperCache.get(def);
  if (key && key.seed === seed) return key.pts;
  const pts = [];
  for (const p of def.parts) for (const sp of flattenPath(p.d, 3)) pts.push(...sp.pts);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = [...lo.slice(0, -1), ...up.slice(0, -1)];
  let cx = 0, cy = 0;
  hull.forEach(([x, y]) => { cx += x; cy += y; });
  cx /= hull.length; cy /= hull.length;
  // 每隔一段取一個角（剪刀一刀一刀剪），往外擴 4~7 格
  const r = rng(seed * 31 + 11), out = [];
  const step = 12;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(L / step));
    for (let j = 0; j < k; j++) {
      if (r() < 0.35 && j) continue;
      const x = a[0] + ((b[0] - a[0]) * j) / k, y = a[1] + ((b[1] - a[1]) * j) / k, m = Math.hypot(x - cx, y - cy) || 1, e = 4 + r() * 3.5;
      out.push([x + ((x - cx) / m) * e, y + ((y - cy) / m) * e]);
    }
  }
  paperCache.set(def, { seed, pts: out });
  return out;
}

export function drawInkDef(ctx, def, color = INK_RED, strokeScale = 1, seed = 1) {
  const r = rng(seed * 13 + 5), nz = noise1(seed * 7 + 3);
  if (def.paper !== false) {
    const P = paperOutline(def, seed), ga0 = ctx.globalAlpha;
    ctx.save();
    ctx.shadowColor = 'rgba(40,30,20,0.22)';
    const m0 = ctx.getTransform(), u0 = Math.hypot(m0.a, m0.b) || 1;
    ctx.shadowBlur = 3 * u0; ctx.shadowOffsetY = 1.2 * u0;
    ctx.beginPath();
    P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = '#F6F1E6';
    ctx.globalAlpha = ga0;
    ctx.fill();
    ctx.restore();
  }
  // 每一版（顏色）偏移的方向固定，同一張貼圖裡的紅版都往同一邊偏
  const plates = new Map();
  const offOf = (col) => {
    if (!plates.has(col)) {
      const a = r() * Math.PI * 2, m = 2.6 + r() * 2.4;
      plates.set(col, [Math.cos(a) * m, Math.sin(a) * m]);
    }
    return plates.get(col);
  };
  const ga = ctx.globalAlpha;
  const m = ctx.getTransform(), unit = Math.hypot(m.a, m.b) || 1;
  // 色塊
  def.parts.forEach((p, i) => {
    if (!p.f) return;
    const col = resolve(p.f, color);
    const off = p.f === 'K' || p.f === 'W' || p.noOff ? [0, 0] : offOf(col);
    let style = col;
    if (unit > 0.6 && p.f !== 'K' && typeof document !== 'undefined') {
      const pat = ctx.createPattern(grainCanvas(col), 'repeat');
      if (pat?.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().translate((seed * 29) % 128, (seed * 53) % 128).scale(0.35));
      if (pat) style = pat;
    }
    ctx.globalAlpha = ga * (p.a ?? 1);
    fillPlate(ctx, p.d, style, off, nz, i * 3.1);
  });
  // 墨線
  def.parts.forEach((p) => {
    if (!p.s) return;
    ctx.globalAlpha = ga * (p.a ?? 1);
    inkStroke(ctx, p.d, (p.w || 2) * strokeScale, resolve(p.s, color), r, nz, !!p.even);
  });
  ctx.globalAlpha = ga;
}
