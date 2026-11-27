// FilmDoodle — 蠟筆／粉筆筆刷
// 讓貼圖不像向量插畫：①把 SVG path 打散成點，沿著線加上平滑的手抖；
// ②用帶顆粒的透明度花紋當顏色，再疊 2～3 筆略有偏移的筆觸，像蠟筆、粉彩筆畫在照片上。

const n = (v) => +v;

// ---------- SVG path → 折線（支援 M L H V C S Q T A Z，大小寫） ----------
const flatCache = new Map();
export function flattenPath(d, step = 1.6) {
  const key = d + '|' + step;
  if (flatCache.has(key)) return flatCache.get(key);
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const subs = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, qx = 0, qy = 0, cur = null;
  const num = () => n(tokens[i++]);
  const isNum = () => i < tokens.length && !/[A-Za-z]/.test(tokens[i]);
  const start = (px, py) => { cur = { pts: [[px, py]], closed: false }; subs.push(cur); };
  const add = (px, py) => { if (!cur) start(x, y); cur.pts.push([px, py]); };
  const curve = (pts, fn) => {
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const segs = Math.max(2, Math.ceil(len / step));
    for (let k = 1; k <= segs; k++) { const [px, py] = fn(k / segs); add(px, py); }
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === 'Z') { if (cur) { cur.closed = true; x = sx; y = sy; } cur = null; if (!isNum()) continue; }
    switch (C) {
      case 'M': {
        let nx = num(), ny = num();
        if (rel) { nx += x; ny += y; }
        x = sx = nx; y = sy = ny; start(x, y);
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': { let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } curve([[x, y], [nx, ny]], (t) => [x + (nx - x) * t, y + (ny - y) * t]); x = nx; y = ny; break; }
      case 'H': { let nx = num(); if (rel) nx += x; curve([[x, y], [nx, y]], (t) => [x + (nx - x) * t, y]); x = nx; break; }
      case 'V': { let ny = num(); if (rel) ny += y; curve([[x, y], [x, ny]], (t) => [x, y + (ny - y) * t]); y = ny; break; }
      case 'C': case 'S': {
        let x1, y1;
        if (C === 'C') { x1 = num(); y1 = num(); if (rel) { x1 += x; y1 += y; } } else { x1 = 2 * x - cx; y1 = 2 * y - cy; }
        let x2 = num(), y2 = num(), ex = num(), ey = num();
        if (rel) { x2 += x; y2 += y; ex += x; ey += y; }
        const x0 = x, y0 = y;
        curve([[x0, y0], [x1, y1], [x2, y2], [ex, ey]], (t) => {
          const u = 1 - t;
          return [u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey];
        });
        cx = x2; cy = y2; x = ex; y = ey;
        break;
      }
      case 'Q': case 'T': {
        let x1, y1;
        if (C === 'Q') { x1 = num(); y1 = num(); if (rel) { x1 += x; y1 += y; } } else { x1 = 2 * x - qx; y1 = 2 * y - qy; }
        let ex = num(), ey = num();
        if (rel) { ex += x; ey += y; }
        const x0 = x, y0 = y;
        curve([[x0, y0], [x1, y1], [ex, ey]], (t) => { const u = 1 - t; return [u * u * x0 + 2 * u * t * x1 + t * t * ex, u * u * y0 + 2 * u * t * y1 + t * t * ey]; });
        qx = x1; qy = y1; x = ex; y = ey;
        break;
      }
      case 'A': {
        const rx0 = Math.abs(num()), ry0 = Math.abs(num()), phi = (num() * Math.PI) / 180, large = num(), sweep = num();
        let ex = num(), ey = num();
        if (rel) { ex += x; ey += y; }
        arcPoints(x, y, rx0, ry0, phi, large, sweep, ex, ey, step).forEach(([px, py]) => add(px, py));
        x = ex; y = ey;
        break;
      }
      default: i++;
    }
    if (C !== 'C' && C !== 'S') { cx = x; cy = y; }
    if (C !== 'Q' && C !== 'T') { qx = x; qy = y; }
  }
  flatCache.set(key, subs);
  return subs;
}

// SVG 弧（端點參數）→ 中心參數 → 取點
function arcPoints(x1, y1, rx, ry, phi, fa, fs, x2, y2, step) {
  if (!rx || !ry) return [[x2, y2]];
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sign = fa === fs ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= Math.PI * 2;
  if (fs && dt < 0) dt += Math.PI * 2;
  const segs = Math.max(4, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / step));
  const out = [];
  for (let k = 1; k <= segs; k++) {
    const t = t1 + (dt * k) / segs, px = rx * Math.cos(t), py = ry * Math.sin(t);
    out.push([cos * px - sin * py + cx, sin * px + cos * py + cy]);
  }
  return out;
}

// ---------- 手抖：沿著線的平滑雜訊 ----------
const hash = (i, s) => { let h = (i * 374761393 + s * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function noise(t, s) {
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  return (hash(i, s) * (1 - u) + hash(i + 1, s) * u) * 2 - 1;
}
export function wobblePath(d, amp, seed, freq = 0.09) {
  const p = new Path2D();
  for (const sp of flattenPath(d)) {
    let len = 0;
    sp.pts.forEach(([x, y], k) => {
      if (k) len += Math.hypot(x - sp.pts[k - 1][0], y - sp.pts[k - 1][1]);
      // 線越長抖越多；起筆收筆稍微超出一點，像真的手畫
      const ox = amp * noise(len * freq, seed * 13 + 1), oy = amp * noise(len * freq, seed * 29 + 7);
      if (k) p.lineTo(x + ox, y + oy); else p.moveTo(x + ox, y + oy);
    });
    if (sp.closed) p.closePath();
  }
  return p;
}

// ---------- 蠟筆顆粒：顏色＋顆粒透明度的花紋 ----------
const grainCache = new Map();
function grainCanvas(color) {
  if (grainCache.has(color)) return grainCache.get(color);
  const S = 96, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  const id = ctx.getImageData(0, 0, S, S), px = id.data;
  let seed = 12345;
  const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < px.length; i += 4) {
    const v = r();
    // 大部分是半透明到不透明，少數是「沒塗到」的白點
    px[i + 3] = v < 0.08 ? 40 : Math.round(255 * (0.62 + 0.38 * Math.pow(r(), 0.6)));
  }
  ctx.putImageData(id, 0, 0);
  grainCache.set(color, c);
  return c;
}
export function crayonStyle(ctx, color, cell) {
  const pat = ctx.createPattern(grainCanvas(color), 'repeat');
  if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().scale(cell));
  return pat;
}

// 用蠟筆畫一個貼圖：每一部分各自手抖，線條畫兩筆（一粗一細、略有偏移）
export function drawCrayonDef(ctx, def, color, strokeScale = 1, seed = 1) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const cell = 0.55; // 顆粒大小（貼圖座標）
  def.parts.forEach((p, i) => {
    const fc = p.f === 'M' ? color : p.f, sc = p.s === 'M' ? color : p.s;
    const a = p.a ?? 1;
    if (fc && typeof fc === 'string') {
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = crayonStyle(ctx, fc, cell);
      ctx.fill(wobblePath(p.d, 1.1, seed + i * 17));
    }
    if (sc) {
      const w = p.w * strokeScale;
      ctx.globalAlpha = a * 0.95;
      ctx.strokeStyle = crayonStyle(ctx, sc, cell);
      ctx.lineWidth = w;
      ctx.stroke(wobblePath(p.d, 1.5, seed + i * 17));
      ctx.globalAlpha = a * 0.55;
      ctx.lineWidth = w * 0.6;
      ctx.stroke(wobblePath(p.d, 1.9, seed + i * 17 + 101));
    }
  });
  ctx.globalAlpha = 1;
}

// ---------- 印章：單一墨色、帶顆粒與少許缺墨，像橡皮章蓋在照片上 ----------
const inkCache = new Map();
function inkCanvas(color) {
  if (inkCache.has(color)) return inkCache.get(color);
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  const id = ctx.getImageData(0, 0, S, S), px = id.data;
  // 大塊的深淺（印泥沾得不均）＋細顆粒＋零星沒印到的白點；邊界要能無縫重複
  const big = (x, y, s) => {
    const fx = (x / S) * 4, fy = (y / S) * 4;
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const h = (a, b) => hash(((a % 4) + 4) % 4 + (((b % 4) + 4) % 4) * 7, s);
    const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
    return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - v) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * v;
  };
  let seed = 98765;
  const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, b = big(x, y, 5), g = r();
    let a = 0.78 + 0.22 * b - 0.18 * g * g;
    if (g > 0.965 || (b < 0.18 && g > 0.6)) a = 0.12; // 沒沾到墨的小點
    px[i + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
  }
  ctx.putImageData(id, 0, 0);
  inkCache.set(color, c);
  return c;
}
export function drawStampDef(ctx, def, color, strokeScale = 1, seed = 1) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pat = ctx.createPattern(inkCanvas(color), 'repeat');
  if (pat.setTransform && typeof DOMMatrix !== 'undefined') {
    // 每個印章的顆粒位置不同
    pat.setTransform(new DOMMatrix().translate((seed * 37) % 128, (seed * 61) % 128).scale(0.45));
  }
  ctx.globalAlpha = 0.9;
  def.parts.forEach((p, i) => {
    const path = wobblePath(p.d, 0.35, seed + i * 11, 0.05);
    if (p.f) { ctx.fillStyle = pat; ctx.fill(path, 'evenodd'); }
    if (p.s) { ctx.strokeStyle = pat; ctx.lineWidth = p.w * strokeScale; ctx.stroke(path); }
  });
  ctx.globalAlpha = 1;
}
