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

// ---------- 色鉛筆：細密的短筆觸＋紙張凹凸（填色），外框描兩三次 ----------
// 參考圖 14：顏色幾乎塗滿，但紙的凹處留下細細的淺色顆粒；筆觸方向很淡、看得出來但不刮。
// 紙紋用固定的雜訊（和筆觸方向無關），所以兩個方向的筆觸疊起來，白點仍留在同一個位置。
const pencilCache = new Map();
function valueNoise(S, cell, r) { // 可以無縫重複的平滑雜訊（S 要能被 cell 整除）
  const G = S / cell, g = Array.from({ length: G * G }, () => r());
  const at = (x, y) => g[(((y % G) + G) % G) * G + (((x % G) + G) % G)];
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
    return (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
  };
}
let toothField = null;
function paperTooth() { // 紙張凹凸（0 = 凹，塗不到）
  if (toothField) return toothField;
  const S = 160, r = rng(777), n1 = valueNoise(S, 2, r), n2 = valueNoise(S, 5, r), n3 = valueNoise(S, 32, r);
  toothField = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) toothField[y * S + x] = 0.55 * n1(x, y) + 0.3 * n2(x, y) + 0.15 * n3(x, y);
  return toothField;
}
function pencilCanvas(color, angle) {
  const key = color + angle;
  if (pencilCache.has(key)) return pencilCache.get(key);
  const S = 160, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const r = rng(Math.round(angle * 97) + 11);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  // 很多細短的鉛筆線（畫在 3×3 的位置上 → 可以無縫重複）
  for (let i = 0; i < 3400; i++) {
    const x = r() * S, y = r() * S, len = 5 + r() * 10, a = angle + (r() - 0.5) * 0.22;
    ctx.globalAlpha = 0.2 + r() * 0.26;
    ctx.lineWidth = 0.6 + r() * 0.9;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y + dy);
      ctx.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  // 紙紋：凹處淡、凸處實；再撒一點完全沒塗到的白點
  const id = ctx.getImageData(0, 0, S, S), px = id.data, tooth = paperTooth();
  for (let i = 0, k = 0; i < px.length; i += 4, k++) {
    const t = tooth[k], m = t < 0.3 ? 0.15 : t < 0.37 ? 0.5 : 0.88 + 0.3 * (t - 0.37);
    px[i + 3] = Math.round(Math.min(255, px[i + 3] * 1.35 * m * (r() < 0.04 ? 0.3 : 1)));
  }
  ctx.putImageData(id, 0, 0);
  pencilCache.set(key, c);
  return c;
}
function pencilStyle(ctx, color, angle, cell, seed) {
  const pat = ctx.createPattern(pencilCanvas(color, angle), 'repeat');
  if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().translate((seed * 31) % 160, (seed * 17) % 160).scale(cell));
  return pat;
}
// 外框顏色：同色系加深（不用黑線）
export const pencilInk = (fill) => mix(fill, '#655047', 0.32);

export function drawPencilDef(ctx, def, color, strokeScale = 1, seed = 1) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const ga = ctx.globalAlpha, cell = 0.25;
  def.parts.forEach((p, i) => {
    const fc = p.f === 'M' ? color : p.f, sc = p.s === 'M' ? color : p.s === 'D' ? pencilInk(fc || color) : p.s;
    const a = (p.a ?? 1) * ga, sd = seed + i * 13;
    if (fc && typeof fc === 'string') {
      const path = wobblePath(p.d, 0.6, sd, 0.07);
      // 同一個方向塗兩層（深淺不同），再斜斜補一層：色鉛筆來回塗，顏色疊到幾乎實心
      ctx.globalAlpha = a;
      ctx.fillStyle = pencilStyle(ctx, fc, -0.95, cell, sd);
      ctx.fill(path, 'evenodd');
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = pencilStyle(ctx, fc, -0.8, cell, sd + 5);
      ctx.fill(path, 'evenodd');
      ctx.globalAlpha = a * 0.45;
      ctx.fillStyle = pencilStyle(ctx, fc, 0.35, cell, sd + 9);
      ctx.fill(path, 'evenodd');
      // 邊緣：塗色到邊時會多描一下，邊比裡面實一點
      ctx.globalAlpha = a * 0.55;
      ctx.strokeStyle = pencilStyle(ctx, fc, -0.9, cell, sd + 3);
      ctx.lineWidth = 1.3 * strokeScale;
      ctx.stroke(path);
    }
    if (sc) {
      const w = (p.w || 2) * strokeScale;
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = a * (k ? 0.5 : 0.9);
        ctx.strokeStyle = pencilStyle(ctx, sc, -0.9 + k * 0.5, cell * 0.85, sd + k * 7);
        ctx.lineWidth = w * (k ? 0.5 : 0.7);
        ctx.stroke(wobblePath(p.d, 0.45 + k * 0.3, sd + k * 101, 0.08));
      }
    }
  });
  ctx.globalAlpha = ga;
}

// ---------- 版畫：一次印上去的單色＋印壓不均＋拖痕＋粗糙邊＋少許漏墨；挖空用 evenodd ----------
// 參考圖 11、13：色塊裡有紙纖維顆粒、大片的深淺不均、斜斜的拖痕；邊緣不規則、略深一點；挖空的地方乾淨。
// 同一個顏色的部件先合成一張「版」，再一次上墨 → 重疊的地方不會變深。
const inkCache = new Map();
function inkCanvas(color) {
  if (inkCache.has(color)) return inkCache.get(color);
  const S = 192, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  const id = ctx.getImageData(0, 0, S, S), px = id.data;
  const r = rng(4242), big = valueNoise(S, 48, r), mid = valueNoise(S, 12, r), fine = valueNoise(S, 3, r);
  // 拖痕：沿著斜線方向拉長的雜訊（把座標轉一下、壓扁）
  const streakN = valueNoise(S, 4, r), ang = -0.35, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x * ca + y * sa, v = -x * sa + y * ca;
    const st = streakN(((u / 6) % S + S) % S, ((v * 1.6) % S + S) % S);
    const n = r();
    let a = 0.74 + 0.22 * big(x, y) + 0.1 * mid(x, y) + 0.14 * fine(x, y) - 0.2 * Math.max(0, st - 0.55) * 2.5 - 0.14 * n * n;
    if (n > 0.972) a *= 0.3; // 紙纖維的小白點
    const i = (y * S + x) * 4;
    px[i + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
    // 顏色也有一點深淺（墨多的地方偏深）
    const k = 1 - 0.07 * (big(x, y) - 0.5) - 0.05 * (mid(x, y) - 0.5);
    px[i] *= k; px[i + 1] *= k; px[i + 2] *= k;
  }
  ctx.putImageData(id, 0, 0);
  inkCache.set(color, c);
  return c;
}
let speckCanvas = null;
function speckles() { // 邊緣被紙吃掉的小缺口（透明度花紋）
  if (speckCanvas) return speckCanvas;
  const S = 96, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d'), r = rng(99);
  ctx.fillStyle = '#000';
  for (let i = 0; i < 520; i++) { ctx.globalAlpha = 0.5 + r() * 0.5; ctx.beginPath(); ctx.arc(r() * S, r() * S, 0.4 + r() * 1.1, 0, Math.PI * 2); ctx.fill(); }
  speckCanvas = c;
  return c;
}
function inkStyle(ctx, color, cell, seed) {
  const pat = ctx.createPattern(inkCanvas(color), 'repeat');
  if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().translate((seed * 37) % 192, (seed * 61) % 192).scale(cell));
  return pat;
}
export const PAPER = '#f4eedf';
let plate = null;
// parts 的 f：'M' = 墨色（使用者可換）、'P' = 紙色（版畫方格的底）、其他 = 固定色
export function drawPrintDef(ctx, def, color, strokeScale = 1, seed = 1) {
  const res = (c) => (c === 'M' ? color : c === 'P' ? PAPER : c);
  const [vw, vh] = def.vb || [100, 100], m = ctx.getTransform(), ga = ctx.globalAlpha;
  // 版的大小：貼圖範圍（含一點邊）在畫面上的像素框
  const pad = 4, cs = [[-pad, -pad], [vw + pad, -pad], [-pad, vh + pad], [vw + pad, vh + pad]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  const x0 = Math.floor(Math.min(...cs.map((q) => q[0]))), y0 = Math.floor(Math.min(...cs.map((q) => q[1])));
  const W = Math.min(4096, Math.ceil(Math.max(...cs.map((q) => q[0]))) - x0), H = Math.min(4096, Math.ceil(Math.max(...cs.map((q) => q[1]))) - y0);
  if (W < 1 || H < 1) return;
  if (!plate) plate = document.createElement('canvas');
  if (plate.width < W || plate.height < H) { plate.width = Math.max(plate.width, W); plate.height = Math.max(plate.height, H); }
  const g = plate.getContext('2d');
  // 依顏色分組（連續、同色的部件一起印）
  const groups = [];
  def.parts.forEach((p, i) => {
    const c = res(p.f) || res(p.s);
    if (!c) return;
    const last = groups[groups.length - 1];
    if (last && last.c === c && (p.a ?? 1) === last.a) last.parts.push([p, i]); else groups.push({ c, a: p.a ?? 1, parts: [[p, i]] });
  });
  groups.forEach((gr, gi) => {
    const sd = seed + gi * 19, r = rng(sd * 7 + 3);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
    g.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
    g.fillStyle = '#000'; g.strokeStyle = '#000';
    g.lineCap = 'round'; g.lineJoin = 'round';
    const paths = [];
    for (const [p, i] of gr.parts) {
      // 刻版的邊緣：抖動比色鉛筆大一點、頻率高一點
      const path = wobblePath(p.d, 0.75, seed + i * 19, 0.17);
      paths.push(path);
      if (p.f) g.fill(path, 'evenodd');
      if (p.s) { g.lineWidth = (p.w || 2) * strokeScale; g.stroke(path); }
      // 漏墨：邊緣外偶爾一兩點
      for (const sp of flattenPath(p.d, 2.2)) for (const [x, y] of sp.pts) {
        if (r() > 0.035) continue;
        const ang = r() * Math.PI * 2, d = 0.8 + r() * 1.6;
        g.beginPath(); g.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, 0.18 + r() * 0.4, 0, Math.PI * 2); g.fill();
      }
    }
    // 邊緣被紙吃掉一點：沿邊挖小缺口
    g.globalCompositeOperation = 'destination-out';
    const sp = g.createPattern(speckles(), 'repeat');
    if (sp.setTransform) sp.setTransform(new DOMMatrix().translate(sd * 13 % 96, sd * 29 % 96).scale(0.35));
    g.strokeStyle = sp; g.lineWidth = 1.1;
    paths.forEach((path) => g.stroke(path));
    // 上墨
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = inkStyle(g, gr.c, 0.38, sd);
    g.fillRect(-pad, -pad, vw + pad * 2, vh + pad * 2);
    // 邊緣墨多一點（略深的一圈，只畫在版上）
    g.globalCompositeOperation = 'source-atop';
    g.strokeStyle = mix(gr.c, '#2f3a1a', 0.18); g.globalAlpha = 0.35; g.lineWidth = 0.9;
    paths.forEach((path) => g.stroke(path));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = ga * gr.a * 0.95;
    ctx.drawImage(plate, 0, 0, W, H, x0, y0, W, H);
    ctx.restore();
  });
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  ctx.globalAlpha = ga;
}

// ---------- 十字繡格：在照片上疊一塊半透明格線，圖案用白色 X 繡出來 ----------
// motifs：[{ def, x, y, size, rot }]（x,y,size 是面板內 0~1 的位置與大小）
// def.grid（點陣，見 art/v8.js 的 MOTIF_STITCH）：size 不用，一個 X 一格；可加 len（邊條重複長度）、rot（90° 倍數）、flip
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
    // 點陣圖案（def.grid：'X' = 繡一格）：一格對一格蓋上去，最清楚；rot 取 90° 的倍數，len = 沿長邊重複到幾格長（邊條）
    if (it.def.grid) {
      const G = it.def.grid, gh = G.length, gw = G[0].length, len = Math.max(gw, Math.round(it.len || gw));
      const qt = (((Math.round((it.rot || 0) / (Math.PI / 2))) % 4) + 4) % 4, sw = qt % 2 ? gh : len, sh = qt % 2 ? len : gh;
      const ox = Math.round(it.x * cols - sw / 2), oy = Math.round(it.y * rows - sh / 2);
      for (let j = 0; j < gh; j++) for (let i = 0; i < len; i++) {
        if (G[j][(it.flip ? len - 1 - i : i) % gw] !== 'X') continue;
        const [a, b] = qt === 0 ? [i, j] : qt === 1 ? [gh - 1 - j, i] : qt === 2 ? [len - 1 - i, gh - 1 - j] : [j, len - 1 - i];
        mx.fillRect(ox + a, oy + b, 1, 1);
      }
      continue;
    }
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
  ctx.lineWidth = cell * 0.17;
  ctx.shadowColor = 'rgba(30,35,70,.4)';
  ctx.shadowBlur = cell * 0.22;
  ctx.shadowOffsetY = cell * 0.04;
  const q = cell * 0.27;
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
          const step = dot * (accent ? 1.1 : 1.45);
          while (acc > step) {
            acc -= step;
            const t = r(), [X, Y] = toXY(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
            const spread = dot * (accent ? 3.6 : 2.3);
            const jx = (r() - 0.5) * spread, jy = (r() - 0.5) * spread;
            ctx.fillStyle = accent && r() < 0.45 ? (o.accent || '#f3e66b') : '#ffffff';
            ctx.globalAlpha = 0.75 + r() * 0.25;
            const d = dot * (0.5 + r() * r() * 1.3);
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
