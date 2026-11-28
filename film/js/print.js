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
  // 很多細短的鉛筆線（畫在 3×3 的位置上 → 可以無縫重複）。參考圖 14：筆觸短而密，看得出方向但不成一條條長線
  for (let i = 0; i < 6200; i++) {
    const x = r() * S, y = r() * S, len = 3 + r() * 6, a = angle + (r() - 0.5) * 0.3;
    ctx.globalAlpha = 0.3 + r() * 0.3;
    ctx.lineWidth = 0.5 + r() * 0.7;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y + dy);
      ctx.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  // 紙紋：凹處淡、凸處實（細細的淺色顆粒）；再撒一點完全沒塗到的白點
  const id = ctx.getImageData(0, 0, S, S), px = id.data, tooth = paperTooth();
  for (let i = 0, k = 0; i < px.length; i += 4, k++) {
    const t = tooth[k], m = t < 0.3 ? 0.3 : t < 0.36 ? 0.62 : 0.95 + 0.3 * (t - 0.36);
    px[i + 3] = Math.round(Math.min(255, px[i + 3] * 1.6 * m * (r() < 0.03 ? 0.35 : 1)));
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
  const ga = ctx.globalAlpha, cell = 0.2;
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
    let a = 0.82 + 0.2 * big(x, y) + 0.1 * mid(x, y) + 0.14 * fine(x, y) - 0.2 * Math.max(0, st - 0.55) * 2.5 - 0.14 * n * n;
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
    ctx.globalAlpha = ga * gr.a;
    ctx.drawImage(plate, 0, 0, W, H, x0, y0, W, H);
    ctx.restore();
  });
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  ctx.globalAlpha = ga;
}

// ---------- 十字繡格：在照片上疊一層淡淡的白格線，圖案用白色 X 一格一格繡出來 ----------
// 參考圖 10：格線細、淡，照片透得過去；X 幾乎塞滿一格、線粗而清楚，有一點陰影，像真的線。
// o.cell：一格幾像素；o.items：[{ grid, gx, gy, flip }]（gx, gy = 圖案左上角在第幾格）
// o.avoid：[x, y, w, h] 不繡、不畫格線的範圍（相機日期）
// 格線與薄白霧只在照片邊緣，往中間慢慢淡掉（沒有硬邊），中間留給主角。
export function drawCrossStitch(ctx, W, H, o) {
  const r = rng(o.seed || 1), cell = o.cell, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
  const offX = (W - cols * cell) / 2, offY = (H - rows * cell) / 2;
  // 1. 格線＋薄白霧，畫在另一張畫布，再用「邊緣實、中間空」的遮罩淡出
  const g = document.createElement('canvas');
  g.width = W; g.height = H;
  const gx = g.getContext('2d');
  gx.fillStyle = 'rgba(255,255,255,.13)';
  gx.fillRect(0, 0, W, H);
  gx.strokeStyle = 'rgba(255,255,255,.36)';
  gx.lineWidth = Math.max(0.7, cell * 0.06);
  gx.beginPath();
  for (let i = 0; i <= cols; i++) { const x = Math.round(offX + i * cell) + 0.5; gx.moveTo(x, 0); gx.lineTo(x, H); }
  for (let j = 0; j <= rows; j++) { const y = Math.round(offY + j * cell) + 0.5; gx.moveTo(0, y); gx.lineTo(W, y); }
  gx.stroke();
  gx.globalCompositeOperation = 'destination-in';
  const R = Math.hypot(W, H) / 2, k = W / H;
  gx.save();
  gx.translate(W / 2, H / 2); gx.scale(Math.sqrt(k), 1 / Math.sqrt(k));
  const grad = gx.createRadialGradient(0, 0, 0, 0, 0, R);
  const inner = o.clear ?? 0.42;
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(inner, 'rgba(0,0,0,0)');
  grad.addColorStop(inner + 0.2, 'rgba(0,0,0,.55)'); grad.addColorStop(0.78, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,1)');
  gx.fillStyle = grad;
  gx.fillRect(-W, -H, W * 2, H * 2);
  gx.restore();
  if (o.avoid) { gx.globalCompositeOperation = 'destination-out'; gx.fillStyle = '#000'; gx.fillRect(...o.avoid); }
  ctx.save();
  ctx.drawImage(g, 0, 0);
  // 2. 要繡的格子
  const on = new Set();
  for (const it of o.items || []) {
    const G = it.grid, gw = G[0].length;
    G.forEach((row, j) => { for (let i = 0; i < gw; i++) if (row[it.flip ? gw - 1 - i : i] === 'X') on.add((it.gy + j) * 4096 + it.gx + i); });
  }
  const av = o.avoid, inAvoid = (x, y) => av && x > av[0] - cell * 0.5 && x < av[0] + av[2] + cell * 0.5 && y > av[1] - cell * 0.5 && y < av[1] + av[3] + cell * 0.5;
  // 3. X：先繡「/」再繡「\」（上面那一針略亮），外面一圈淡淡的白暈，像參考圖那樣微微發亮
  const q = cell * 0.31, lw = cell * 0.27;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(235,240,255,.75)';
  ctx.shadowBlur = cell * 0.4;
  for (const key of on) {
    const i = key % 4096, j = Math.floor(key / 4096);
    if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
    const cx = offX + (i + 0.5) * cell + (r() - 0.5) * cell * 0.05, cy = offY + (j + 0.5) * cell + (r() - 0.5) * cell * 0.05;
    if (inAvoid(cx, cy)) continue;
    const a = 0.9 + r() * 0.1, tw = (r() - 0.5) * cell * 0.06;
    ctx.lineWidth = lw;
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#eef1f8';
    ctx.beginPath(); ctx.moveTo(cx - q, cy + q + tw); ctx.lineTo(cx + q, cy - q); ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q - tw); ctx.stroke();
  }
  ctx.restore();
}

// ---------- 點描線稿：沿著線條密密灑白色小方點與小十字，花頭一團一團、帶檸檬黃，整片微微發亮 ----------
// 參考圖 12：線是兩三排錯開的小點串成的；花頭是很密的一團（白＋黃），外圍散開；點本身有一圈柔光。
// 先把所有點畫在另一張畫布，再「光暈一次＋清楚一次」貼回去（shadowBlur，各瀏覽器都支援）。
export function drawStipple(ctx, W, H, o) {
  const S = Math.min(W, H), r = rng(o.seed || 1);
  const dot = S * (o.dot || 0.006);
  const L = document.createElement('canvas');
  L.width = W; L.height = H;
  const lx = L.getContext('2d');
  const put = (X, Y, d, col, a) => {
    lx.fillStyle = col;
    lx.globalAlpha = a;
    if (r() < 0.2) { // 小十字
      lx.fillRect(X - d, Y - d * 0.22, d * 2, d * 0.44);
      lx.fillRect(X - d * 0.22, Y - d, d * 0.44, d * 2);
    } else lx.fillRect(X - d / 2, Y - d / 2, d, d);
  };
  const yellow = o.accent || '#e8f046';
  for (const it of o.motifs || []) {
    const [vw, vh] = it.def.vb || [100, 100], k = (it.size * S) / Math.max(vw, vh);
    const ox = it.x * W, oy = it.y * H, c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0), fl = it.flip ? -1 : 1;
    const toXY = (x, y) => { const lx2 = (x - vw / 2) * k * fl, ly = (y - vh / 2) * k; return [ox + lx2 * c - ly * s, oy + lx2 * s + ly * c]; };
    it.def.parts.forEach((p) => {
      const accent = p.accent;
      for (const sp of flattenPath(p.d, 1)) {
        const pts = sp.pts.map(([x, y]) => toXY(x, y));
        let acc = 0;
        for (let n = 1; n < pts.length; n++) {
          const [x0, y0] = pts[n - 1], [x1, y1] = pts[n], len = Math.hypot(x1 - x0, y1 - y0);
          if (!len) continue;
          const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
          acc += len;
          const step = dot * (accent ? 0.4 : 0.55);
          while (acc > step) {
            acc -= step;
            const t = 1 - acc / len, X = x0 + (x1 - x0) * t, Y = y0 + (y1 - y0) * t;
            // 線：兩排平行、錯開的點（參考圖的莖是雙線點串）；花頭在法線方向散得更開
            const off = accent ? (r() - 0.5) * dot * 2.6 : (r() < 0.5 ? -1 : 1) * dot * (0.75 + r() * 0.3), along = (r() - 0.5) * dot * 0.8;
            const d = dot * (0.55 + r() * r() * 1.1);
            put(X + nx * off + (x1 - x0) / len * along, Y + ny * off + (y1 - y0) / len * along, d, accent && r() < 0.24 ? yellow : '#ffffff', 0.8 + r() * 0.2);
            // 花頭：外面再散開一團（越外越稀、越小）
            if (accent) for (let m = 0; m < 3; m++) {
              const ang = r() * Math.PI * 2, rr = dot * (1.2 + 4.2 * r() * r());
              put(X + Math.cos(ang) * rr, Y + Math.sin(ang) * rr, dot * (0.4 + r() * 0.7), r() < 0.32 ? yellow : '#ffffff', 0.55 + r() * 0.45);
            } else if (r() < 0.08) { // 莖旁邊偶爾跳出去一兩點
              const ang = r() * Math.PI * 2, rr = dot * (2 + 2.5 * r());
              put(X + Math.cos(ang) * rr, Y + Math.sin(ang) * rr, dot * (0.4 + r() * 0.5), '#ffffff', 0.6 + r() * 0.4);
            }
          }
        }
      }
    });
  }
  ctx.save();
  // 光暈：白中帶一點暖，像參考圖點描在照片上微微發亮
  ctx.shadowColor = 'rgba(255,255,235,.95)';
  ctx.shadowBlur = dot * 7;
  ctx.globalAlpha = 0.5;
  ctx.drawImage(L, 0, 0);
  ctx.shadowColor = 'rgba(255,255,255,.8)';
  ctx.shadowBlur = dot * 1.4;
  ctx.globalAlpha = 1;
  ctx.drawImage(L, 0, 0);
  ctx.restore();
}
