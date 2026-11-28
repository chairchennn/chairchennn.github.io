// FilmDoodle — 復古印刷與色鉛筆的筆刷（第六版）
// 參考使用者整理的風格：A 色鉛筆小物、B 植物版畫、D 實驗性多媒材（十字繡格、點描線稿）。
// 全部用程式畫：SVG path → 打散成點、手抖 → canvas，所以放多大都清楚，也不需要圖檔。

import { flattenPath, wobblePath, crayonStyle } from './crayon.js';

// ---------- 共用：小亂數 ----------
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
const hexRgb = (hex) => { const v = parseInt(hex.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(',')})`; };
const mixHex = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join(''); };

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
// 把一枝點描植物的點撒到 lx 上（toXY：圖案座標 → 畫布像素；dot：點的大小，像素）
function stippleDots(lx, def, toXY, dot, r, white = '#ffffff', yellow = '#e8f046') {
  const put = (X, Y, d, col, a) => {
    lx.fillStyle = col;
    lx.globalAlpha = a;
    if (r() < 0.2) { // 小十字
      lx.fillRect(X - d, Y - d * 0.22, d * 2, d * 0.44);
      lx.fillRect(X - d * 0.22, Y - d, d * 0.44, d * 2);
    } else lx.fillRect(X - d / 2, Y - d / 2, d, d);
  };
  def.parts.forEach((p) => {
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
          put(X + nx * off + (x1 - x0) / len * along, Y + ny * off + (y1 - y0) / len * along, d, accent && r() < 0.24 ? yellow : white, 0.8 + r() * 0.2);
          // 花頭：外面再散開一團（越外越稀、越小）
          if (accent) for (let m = 0; m < 3; m++) {
            const ang = r() * Math.PI * 2, rr = dot * (1.2 + 4.2 * r() * r());
            put(X + Math.cos(ang) * rr, Y + Math.sin(ang) * rr, dot * (0.4 + r() * 0.7), r() < 0.32 ? yellow : white, 0.55 + r() * 0.45);
          } else if (r() < 0.08) { // 莖旁邊偶爾跳出去一兩點
            const ang = r() * Math.PI * 2, rr = dot * (2 + 2.5 * r());
            put(X + Math.cos(ang) * rr, Y + Math.sin(ang) * rr, dot * (0.4 + r() * 0.5), white, 0.6 + r() * 0.4);
          }
        }
      }
    }
  });
}
export function drawStipple(ctx, W, H, o) {
  const S = Math.min(W, H), r = rng(o.seed || 1);
  const dot = S * (o.dot || 0.006);
  const L = document.createElement('canvas');
  L.width = W; L.height = H;
  const lx = L.getContext('2d');
  const yellow = o.accent || '#e8f046';
  for (const it of o.motifs || []) {
    const [vw, vh] = it.def.vb || [100, 100], k = (it.size * S) / Math.max(vw, vh);
    const ox = it.x * W, oy = it.y * H, c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0), fl = it.flip ? -1 : 1;
    const toXY = (x, y) => { const lx2 = (x - vw / 2) * k * fl, ly = (y - vh / 2) * k; return [ox + lx2 * c - ly * s, oy + lx2 * s + ly * c]; };
    stippleDots(lx, it.def, toXY, dot, r, '#ffffff', yellow);
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

// =====================================================================
// 第八版（網站 v10）：8-bit 像素、單張十字繡／點描貼圖、連連看星星、蠟筆貓咪
// =====================================================================

// 暫存畫布（裝置像素）：把 vb 座標的範圍換算到畫面上的像素框；同一個 slot 重複使用
const plates = [];
function plateOf(ctx, vw, vh, pad, slot) {
  const m = ctx.getTransform();
  const cs = [[-pad, -pad], [vw + pad, -pad], [-pad, vh + pad], [vw + pad, vh + pad]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  const x0 = Math.floor(Math.min(...cs.map((q) => q[0]))), y0 = Math.floor(Math.min(...cs.map((q) => q[1])));
  const W = Math.min(4096, Math.ceil(Math.max(...cs.map((q) => q[0]))) - x0), H = Math.min(4096, Math.ceil(Math.max(...cs.map((q) => q[1]))) - y0);
  if (W < 1 || H < 1) return null;
  const c = plates[slot] || (plates[slot] = document.createElement('canvas'));
  if (c.width < W || c.height < H) { c.width = Math.max(c.width, W); c.height = Math.max(c.height, H); }
  const g = c.getContext('2d');
  const reset = () => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.shadowBlur = 0; g.shadowColor = 'transparent';
    g.clearRect(0, 0, W, H);
    g.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
  };
  reset();
  const blit = (alpha = 1) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= alpha; ctx.drawImage(c, 0, 0, W, H, x0, y0, W, H); ctx.restore(); };
  return { c, g, x0, y0, W, H, m, k: Math.hypot(m.a, m.b), reset, blit };
}
const pathBox = (d) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const sp of flattenPath(d, 3)) for (const [x, y] of sp.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
};

// ---------- 8-bit 像素：一格一格的方塊，格與格之間留細縫（看得到像素格），每格顏色略有深淺 ----------
// def.grid：字串陣列；'M' 主色、'd' 主色加深（外框）、'l' 主色調亮，其他字母看 PIX_PAL；'.' 空白
export const PIX_PAL = {
  w: '#F4EEDF', y: '#E9D79A', p: '#A99BC5', b: '#9CB9D0', g: '#A6B58A', t: '#CB8875', c: '#655047', k: '#65645D',
  r: '#D9A3A0', G: '#7E8F66', B: '#6F8FAD', Y: '#D8BC6A', P: '#8A7BA8', T: '#A8695A', s: '#C9C3B6',
};
export function drawPixelDef(ctx, def, color, strokeScale = 1, seed = 1) {
  const G = def.grid, r = rng(seed * 13 + 5), ga = ctx.globalAlpha;
  const base = (ch) => (ch === 'M' ? color : ch === 'd' ? mixHex(color, '#3b2f2a', 0.45) : ch === 'l' ? mixHex(color, '#ffffff', 0.5) : PIX_PAL[ch] || def.pal?.[ch]);
  const shades = new Map(); // 每個顏色三種深淺（像印刷／螢幕的不均）
  const shade = (ch) => {
    if (!shades.has(ch)) { const c0 = base(ch); shades.set(ch, c0 ? [mixHex(c0, '#ffffff', 0.05), c0, mixHex(c0, '#2a2420', 0.06)] : null); }
    return shades.get(ch);
  };
  const gap = 0.07;
  G.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const sh = shade(row[i]);
      if (!sh) continue;
      ctx.globalAlpha = ga * (0.93 + r() * 0.07);
      ctx.fillStyle = sh[Math.floor(r() * 3)];
      ctx.fillRect(i + gap, j + gap, 1 - gap * 2, 1 - gap * 2);
      // 每格左上一點亮、右下一點暗：方塊有一點厚度，像素格更清楚
      ctx.globalAlpha = ga * 0.16;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(i + gap, j + gap, 1 - gap * 2, 0.14);
      ctx.fillStyle = '#2a2420';
      ctx.globalAlpha = ga * 0.1;
      ctx.fillRect(i + gap, j + 1 - gap - 0.12, 1 - gap * 2, 0.12);
    }
  });
  ctx.globalAlpha = ga;
}

// ---------- 單張十字繡貼圖：把點陣（'X'）一格一格繡成 X，線有一點陰影與光澤（參考圖 10 的線） ----------
export function drawStitchDef(ctx, def, color, strokeScale = 1, seed = 1) {
  const G = def.grid, r = rng(seed * 7 + 1), m = ctx.getTransform(), k = Math.hypot(m.a, m.b), ga = ctx.globalAlpha;
  const q = 0.31, top = mixHex(color, '#ffffff', 0.35), under = mixHex(color, '#55606e', 0.18);
  ctx.save();
  ctx.lineCap = 'round';
  // 底下一層淡淡的布格（只在有繡的格子周圍）
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.05; ctx.globalAlpha = ga * 0.6;
  ctx.beginPath();
  G.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'X') ctx.rect(i, j, 1, 1); });
  ctx.stroke();
  ctx.shadowColor = 'rgba(40,45,60,.35)'; ctx.shadowBlur = 0.25 * k; ctx.shadowOffsetY = 0.08 * k;
  G.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== 'X') continue;
      const cx = i + 0.5 + (r() - 0.5) * 0.05, cy = j + 0.5 + (r() - 0.5) * 0.05, tw = (r() - 0.5) * 0.06;
      ctx.globalAlpha = ga * (0.9 + r() * 0.1);
      ctx.lineWidth = 0.27;
      ctx.strokeStyle = under;
      ctx.beginPath(); ctx.moveTo(cx - q, cy + q + tw); ctx.lineTo(cx + q, cy - q); ctx.stroke();
      ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q - tw); ctx.stroke();
    }
  });
  // 上面那一針的光澤（細細一條亮線）
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = top; ctx.lineWidth = 0.07; ctx.globalAlpha = ga * 0.8;
  ctx.beginPath();
  G.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'X') { ctx.moveTo(i + 0.5 - q * 0.7, j + 0.5 - q * 0.8); ctx.lineTo(i + 0.5 + q * 0.5, j + 0.5 + q * 0.4); } });
  ctx.stroke();
  ctx.restore();
}

// ---------- 單張點描貼圖：點描植物（vb 100×140）畫成一張小點點貼圖，帶柔光 ----------
export function drawStippleDef(ctx, def, color, strokeScale = 1, seed = 1) {
  const [vw, vh] = def.vb || [100, 100], P = plateOf(ctx, vw, vh, 6, 0);
  if (!P) return;
  const { g, m, x0, y0, k } = P;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const toXY = (x, y) => [m.a * x + m.c * y + m.e - x0, m.b * x + m.d * y + m.f - y0];
  stippleDots(g, def, toXY, Math.max(1, 0.85 * k), rng(seed * 3 + 1), color, mixHex('#e8f046', color, 0.15));
  const dot = 0.85 * k;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = 'rgba(255,255,235,.95)'; ctx.shadowBlur = dot * 7; ctx.globalAlpha *= 0.5;
  ctx.drawImage(P.c, 0, 0, P.W, P.H, x0, y0, P.W, P.H);
  ctx.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = 'rgba(255,255,255,.8)'; ctx.shadowBlur = dot * 1.4;
  ctx.drawImage(P.c, 0, 0, P.W, P.H, x0, y0, P.W, P.H);
  ctx.restore();
}

// ---------- 連連看星星（參考圖 21）：淡藍色鉛筆，三種塗法；編號小圓點；一顆顆的水鑽 ----------
// parts 的旗標：
//   f：淡淡的色鉛筆實心塗（看得到筆觸方向、留紙白）；s：鉛筆描邊（w 粗細）
//   hatch：角度（度）→ 在形狀裡畫斜線塗色（間距 sp）；gem：[[x,y,r],…] 水鑽；ink：深灰細線（編號、點）
const DS_INK = '#5d5f66';
export function drawDotstarDef(ctx, def, color, strokeScale = 1, seed = 1) {
  const ga = ctx.globalAlpha, res = (c) => (c === 'M' ? color : c === 'D' ? mixHex(color, '#2e4a6e', 0.45) : c === 'K' ? DS_INK : c);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 先墊一層紙白（參考圖是畫在白紙上的；貼在照片上時像剪下來的紙片，淡藍鉛筆才看得清楚）
  if (def.paper !== false) {
    ctx.fillStyle = '#fbfaf6'; ctx.strokeStyle = '#fbfaf6';
    def.parts.forEach((p, i) => {
      if (p.gem) { ctx.globalAlpha = ga * 0.75; ctx.beginPath(); for (const [x, y, rr] of p.gem) { ctx.moveTo(x + rr * 1.7, y); ctx.arc(x, y, rr * 1.7, 0, Math.PI * 2); } ctx.fill(); return; }
      const path = wobblePath(p.d, 0.5, seed + i * 17, 0.08);
      if (p.f || p.hatch != null || p.dot) { ctx.globalAlpha = ga * 0.88; ctx.fill(path, 'evenodd'); ctx.lineWidth = 2.4; ctx.stroke(path); }
      else if (p.s) { ctx.globalAlpha = ga * 0.7; ctx.lineWidth = (p.w || 1.2) * strokeScale + (p.ink ? 1.6 : 2.2); ctx.stroke(path); }
    });
  }
  def.parts.forEach((p, i) => {
    const sd = seed + i * 17, a = (p.a ?? 1) * ga, r = rng(sd * 5 + 2);
    if (p.gem) {
      // 水鑽：淺灰圓＋深灰細邊＋右下暗面＋左上一點白光（參考圖的放射太陽是一顆顆點出來的）
      for (const [x, y, rr] of p.gem) {
        const j = 0.9 + r() * 0.2, R = rr * j;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#e4e6ea';
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8b9099'; ctx.globalAlpha = a * 0.85;
        ctx.beginPath(); ctx.arc(x + R * 0.18, y + R * 0.22, R * 0.62, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4f535b'; ctx.globalAlpha = a * 0.7;
        ctx.beginPath(); ctx.arc(x + R * 0.3, y + R * 0.35, R * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#6d727b'; ctx.lineWidth = R * 0.28; ctx.globalAlpha = a * 0.9;
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(x - R * 0.35, y - R * 0.38, R * 0.24, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    const fc = res(p.f), sc = res(p.s);
    const path = wobblePath(p.d, p.ink ? 0.25 : 0.5, sd, 0.08);
    if (p.hatch != null) {
      // 斜線塗色：一條條鉛筆線，長短、間距略不均，偶爾超出邊一點
      const [bx0, by0, bx1, by1] = pathBox(p.d), ang = (p.hatch * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, R = Math.hypot(bx1 - bx0, by1 - by0) / 2 + 2, sp = p.sp || 2.4;
      ctx.save();
      const clip = wobblePath(p.d, 0.5, sd, 0.08);
      ctx.clip(clip);
      ctx.strokeStyle = pencilStyle(ctx, res(p.hc || 'M'), ang, 0.18, sd);
      for (let t = -R; t <= R; t += sp * (0.8 + r() * 0.4)) {
        ctx.globalAlpha = a * (0.65 + r() * 0.35);
        ctx.lineWidth = (0.55 + r() * 0.45) * strokeScale;
        const ox = cx - sa * t, oy = cy + ca * t, L0 = R * (0.8 + r() * 0.2);
        ctx.beginPath(); ctx.moveTo(ox - ca * L0, oy - sa * L0); ctx.lineTo(ox + ca * L0 + r(), oy + sa * L0 + r()); ctx.stroke();
      }
      ctx.restore();
    }
    if (fc) {
      // 淡淡塗兩層（不像圖 14 那樣塗滿）：主要方向一層＋另一個方向很淡一層，紙白透得出來
      const cell = 0.2;
      ctx.globalAlpha = a * 0.78;
      ctx.fillStyle = pencilStyle(ctx, fc, -1.05, cell, sd);
      ctx.fill(path, 'evenodd');
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = pencilStyle(ctx, fc, -0.85, cell, sd + 5);
      ctx.fill(path, 'evenodd');
      ctx.globalAlpha = a * 0.25;
      ctx.fillStyle = pencilStyle(ctx, mixHex(fc, '#2e4a6e', 0.25), 0.5, cell, sd + 9);
      ctx.fill(path, 'evenodd');
    }
    if (sc) {
      const w = (p.w || 1.2) * strokeScale;
      if (p.ink) { // 深灰細線（編號）：像代針筆，幾乎不抖
        ctx.globalAlpha = a * 0.9; ctx.strokeStyle = sc; ctx.lineWidth = w; ctx.stroke(path);
      } else for (let k = 0; k < 2; k++) {
        ctx.globalAlpha = a * (k ? 0.5 : 0.95);
        ctx.strokeStyle = pencilStyle(ctx, sc, -0.9 + k * 0.6, 0.16, sd + k * 7);
        ctx.lineWidth = w * (k ? 0.6 : 1);
        ctx.stroke(k ? wobblePath(p.d, 0.7, sd + 101, 0.1) : path);
      }
    }
    if (p.dot) { // 實心小圓點（連連看的點）：平塗、邊緣稍深
      ctx.globalAlpha = a; ctx.fillStyle = res(p.dot); ctx.fill(path);
      ctx.globalAlpha = a * 0.5; ctx.strokeStyle = mixHex(res(p.dot), '#2e3440', 0.35); ctx.lineWidth = 0.35; ctx.stroke(path);
    }
  });
  ctx.restore();
  ctx.globalAlpha = ga;
}

// ---------- 蠟筆貓咪（參考圖 22）：稚拙的蠟筆塗色——幾乎塗滿、留下一道道斜斜的紙白；外框是深色細線、跟色塊對不太準 ----------
// parts：body:true 的部件（同一色）先合成一個剪影，再一次塗色 → 重疊處不會變深、接縫看不到
//        s 為 'K' 的細線 = 臉、鬍鬚（深灰細線）；under:true 的線畫在身體下面（曬衣繩、樹枝）
const CAT_INK = '#3b3535';
export function drawScribbleDef(ctx, def, color, strokeScale = 1, seed = 1) {
  const [vw, vh] = def.vb || [100, 100], ga = ctx.globalAlpha;
  const res = (c) => (c === 'M' ? color : c === 'D' ? mixHex(color, '#2a2020', 0.38) : c === 'L' ? mixHex(color, '#ffffff', 0.45) : c === 'K' ? CAT_INK : c);
  const line = (p, i) => {
    const a = (p.a ?? 1) * ga, fc = res(p.f), sc = res(p.s);
    if (fc) { ctx.globalAlpha = a * 0.9; ctx.fillStyle = p.f === 'K' ? fc : crayonStyle(ctx, fc, 0.45); ctx.fill(wobblePath(p.d, 0.2, seed + i * 7, 0.1)); }
    if (sc) {
      ctx.globalAlpha = a * 0.88;
      ctx.strokeStyle = p.s === 'K' ? sc : crayonStyle(ctx, sc, 0.45);
      ctx.lineWidth = (p.w || 0.6) * strokeScale;
      ctx.stroke(wobblePath(p.d, p.s === 'K' ? 0.25 : 0.6, seed + i * 7, 0.12));
    }
  };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  def.parts.forEach((p, i) => { if (p.under) line(p, i); });
  ctx.restore();
  const groups = [];
  def.parts.forEach((p, i) => {
    if (!p.body) return;
    const c = res(p.f || 'M');
    let gr = groups.find((q) => q.c === c);
    if (!gr) groups.push(gr = { c, parts: [] });
    gr.parts.push([p, i]);
  });
  const P = plateOf(ctx, vw, vh, 6, 1);
  if (!P) return;
  const { g } = P;
  groups.forEach((gr, gi) => {
    const sd = seed + gi * 31, r = rng(sd * 11 + 7);
    const paths = gr.parts.map(([p, i]) => wobblePath(p.d, 0.7, seed + i * 19, 0.07));
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    gr.parts.forEach(([p]) => { const b = pathBox(p.d); bx0 = Math.min(bx0, b[0]); by0 = Math.min(by0, b[1]); bx1 = Math.max(bx1, b[2]); by1 = Math.max(by1, b[3]); });
    const bw = bx1 - bx0, bh = by1 - by0;
    // ① 剪影 → 蠟筆色（顆粒本身就有深淺）
    P.reset();
    g.fillStyle = '#000';
    paths.forEach((path) => g.fill(path));
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = crayonStyle(g, gr.c, 0.4);
    g.fillRect(-6, -6, vw + 12, vh + 12);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.6;
    g.fillStyle = crayonStyle(g, gr.c, 0.55);
    g.fillRect(-6, -6, vw + 12, vh + 12);
    // ② 一道道斜斜的紙白（蠟筆來回塗時沒塗到的地方）：往右上斜，長短粗細不一
    const ang = -1.05 + (r() - 0.5) * 0.2, ca = Math.cos(ang), sa = Math.sin(ang);
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    const N = Math.round((bw * bh) / 60);
    for (let k = 0; k < N; k++) {
      // 一筆紙白：微彎、兩頭細（用兩三條細線疊出來）
      const x = bx0 + r() * bw, y = by0 + r() * bh, L = 5 + r() * 14, a2 = (r() - 0.5) * 0.25, c2 = Math.cos(ang + a2), s2 = Math.sin(ang + a2);
      const wd = (0.5 + r() * 1.1) * strokeScale, al = 0.3 + r() * 0.55;
      for (let m = 0; m < 3; m++) {
        const o = (m - 1) * wd * 0.35, sh = m === 1 ? 0 : L * 0.15;
        g.globalAlpha = al * (m === 1 ? 1 : 0.6);
        g.lineWidth = wd * (m === 1 ? 0.8 : 0.45);
        g.beginPath(); g.moveTo(x - s2 * o + c2 * sh, y + c2 * o + s2 * sh); g.lineTo(x - s2 * o + c2 * (L - sh), y + c2 * o + s2 * (L - sh)); g.stroke();
      }
    }
    // ③ 同方向幾筆深一點的筆觸（壓得比較用力）
    g.globalCompositeOperation = 'source-atop';
    g.strokeStyle = crayonStyle(g, mixHex(gr.c, '#2a2020', 0.18), 0.4);
    for (let k = 0; k < N * 0.35; k++) {
      const x = bx0 + r() * bw, y = by0 + r() * bh, L = 4 + r() * 12;
      g.globalAlpha = 0.25 + r() * 0.3;
      g.lineWidth = (0.6 + r() * 1.1) * strokeScale;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + ca * L, y + sa * L); g.stroke();
    }
    P.blit(ga);
    // ④ 外框：深色細線，畫在剪影外緣（線和色塊稍微錯開：用另一組手抖）
    P.reset();
    g.lineCap = 'round'; g.lineJoin = 'round';
    const outl = gr.parts.map(([p, i]) => wobblePath(p.d, 0.9, seed + i * 19 + 5, 0.09));
    g.strokeStyle = CAT_INK; g.globalAlpha = 0.85;
    g.lineWidth = 1.05 * strokeScale;
    outl.forEach((path) => g.stroke(path));
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    outl.forEach((path) => g.fill(path));
    P.blit(ga * 0.9);
  });
  // ⑤ 其他部件：臉、鬍鬚與小東西
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  def.parts.forEach((p, i) => { if (!p.body && !p.under) line(p, i); });
  ctx.restore();
  ctx.globalAlpha = ga;
}
