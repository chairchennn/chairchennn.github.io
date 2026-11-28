// FilmDoodle — 紙膠帶（第九版／網站 v11：全部程式畫，不用圖檔）
// 參考圖 24、25（真實紙膠帶照片）、31、32（手繪格紋、布紋拼貼）：
// 先選「貼法與形狀」（TAPE_SHAPES），再選「花紋」（TAPE_PATTERNS）與「配色」（TAPE_COLORWAYS），最後選「材質」（TAPE_MATERIALS）。
// 質感：皺褶用高度場算光影（亮面／暗面／局部光澤）、和紙纖維與半透明、撕邊毛邊、布料織紋、布膠帶金屬皺紋、紙張顆粒。
// 每一條膠帶先畫在離屏畫布（可以在那裡擦、挖洞），最後只用 source-over 貼到照片上，不會擦掉底下的照片。

import { rng } from './film.js';

const { PI, sin, cos, abs, min, max, hypot, floor, round, ceil, exp, pow, sqrt } = Math;
const clamp = (v, a, b) => max(a, min(b, v));

// ---------- 顏色 ----------
const hexRgb = (hex) => {
  let h = String(hex || '#ffffff').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const v = parseInt(h, 16) || 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const toHex = (a) => '#' + a.map((x) => clamp(round(x), 0, 255).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return toHex(A.map((x, i) => x + (B[i] - x) * t)); };
const lum = (c) => { const [r, g, b] = hexRgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const saturate = (c, k) => { const A = hexRgb(c), l = 0.299 * A[0] + 0.587 * A[1] + 0.114 * A[2]; return toHex(A.map((x) => l + (x - l) * k)); };
const rgba = (c, a) => { const [r, g, b] = hexRgb(c); return `rgba(${r},${g},${b},${a})`; };

// =====================================================================
// 1. 貼法與形狀
// =====================================================================
export const TAPE_SHAPES = [
  { id: 'strip', name: '長條直撕', ratio: 0.27 },
  { id: 'short', name: '短截撕邊', ratio: 0.42 },
  { id: 'slant', name: '斜剪兩端', ratio: 0.3 },
  { id: 'pinch', name: '中間皺一折', ratio: 0.4 },
  { id: 'crumple', name: '整條揉皺', ratio: 0.36 },
  { id: 'double', name: '兩張疊貼', ratio: 0.46 },
  { id: 'thin', name: '細長條', ratio: 0.13 },
  { id: 'block', name: '寬短方塊', ratio: 0.62 },
  { id: 'curl', name: '捲起一角', ratio: 0.32 },
];
export const tapeAspect = (shape) => (TAPE_SHAPES.find((s) => s.id === shape) || TAPE_SHAPES[0]).ratio;
export const TAPE_RATIO = 0.27; // 舊介面：長條的高／寬

// =====================================================================
// 2. 材質
// =====================================================================
// alpha：不透明度；kd：皺褶明暗強度；ks／sh：光澤；noise：細皺紋（相對高度）；end：兩端（torn 撕、cut 剪、fray 鬚邊、pinked 鋸齒）
const MAT = {
  washi: { alpha: 0.86, kd: 1.15, ks: 0.22, sh: 16, noise: 0.010, ns: 0.3, end: 'torn', fringe: 'fiber', tex: 'washi', shadow: 0.16, cloud: 0.12 },
  paper: { alpha: 1, kd: 1.25, ks: 0.06, sh: 8, noise: 0.008, ns: 0.35, end: 'torn', fringe: 'paper', tex: 'paper', shadow: 0.26 },
  silk: { alpha: 0.93, kd: 0.9, ks: 0.25, sh: 9, calm: true, noise: 0.004, ns: 0.4, end: 'fray', tex: 'silk', shadow: 0.2 },
  satin: { alpha: 0.98, kd: 0.85, ks: 0.35, sh: 30, calm: true, noise: 0.003, ns: 0.5, end: 'cut', tex: 'satin', shadow: 0.24 },
  plastic: { alpha: 0.9, kd: 0.55, ks: 0.8, sh: 70, calm: true, long: true, hl: 0.85, sat: 1.25, noise: 0.003, ns: 0.5, end: 'cut', tex: null, shadow: 0.1 },
  velvet: { alpha: 1, kd: 0.55, ks: 0, sh: 1, noise: 0.006, ns: 0.35, end: 'fray', tex: 'velvet', shadow: 0.3, sheen: 0.75, fuzz: true },
  linen: { alpha: 0.98, kd: 1.0, ks: 0.04, sh: 6, noise: 0.006, ns: 0.4, end: 'fray', tex: 'linen', shadow: 0.24 },
  cotton: { alpha: 0.98, kd: 0.9, ks: 0.03, sh: 6, noise: 0.005, ns: 0.4, end: 'fray', tex: 'cotton', shadow: 0.2, fuzz: true },
  cloth: { alpha: 1, kd: 0.85, ks: 0.25, sh: 10, metal: 0.1, noise: 0.012, ns: 0.3, end: 'pinked', tex: 'scrim', shadow: 0.28 },
};
export const TAPE_MATERIALS = [
  ['washi', '和紙'], ['paper', '紙'], ['silk', '絲綢'], ['satin', '緞面'], ['plastic', '塑膠'],
  ['velvet', '絨布'], ['linen', '亞麻'], ['cotton', '棉布'], ['cloth', '布膠帶'],
];

// =====================================================================
// 3. 花紋（colors：[底色, 花紋色, 輔色]；colorways：可換的配色；多出來的顏色是調色盤）
// kind 是舊版的 pattern 名稱，舊存檔用得到
// =====================================================================
const pat = (id, name, kind, colorways, extra = {}) => ({
  id, name, kind, pattern: kind, colors: colorways[0], colorways, color: colorways[0][0], ink: colorways[0][1] || colorways[0][0], ...extra,
});
export const TAPE_PATTERNS = [
  pat('tp_plain', '素色', 'plain', [['#efe3cb', '#f2c230'], ['#f2c230', '#efe3cb'], ['#6fa6c9', '#efe3cb'], ['#b8322f', '#f2c4c0'], ['#93bf4b', '#efe3cb'], ['#3fa9d5', '#f2c230'], ['#ef69a8', '#f6d9e6'], ['#a8bf7e', '#efe3cb'], ['#cfe0ea', '#f2c4c0'], ['#f3c6c4', '#cfe0ea'], ['#d877c4', '#f2c230'], ['#4a4b50', '#f3d77a']]),
  pat('tp_clear', '霧面透明', 'plain', [['#ffffff', '#f2c230'], ['#e9f3f7', '#ffffff'], ['#fff4e0', '#ffffff'], ['#f7e6ee', '#ffffff']], { alpha: 0.55 }),
  pat('tp_dots', '大圓點', 'dots', [['#ef7b6d', '#fbf6ee'], ['#f2c94c', '#fbf6ee'], ['#f4a742', '#fbe7a4'], ['#9cb9d0', '#fbf6ee'], ['#a8bf7e', '#fbf6ee'], ['#f4b6c2', '#fbf6ee']]),
  pat('tp_dots_s', '小圓點', 'dots_s', [['#f4eee0', '#2b2622'], ['#f4a9bd', '#fbf6ee'], ['#efe3cb', '#b8322f'], ['#cfe0ea', '#5b7fa6'], ['#2b2622', '#f4eee0']]),
  pat('tp_speckle', '亂點點', 'speckle', [['#fbf6dc', '#5b5752'], ['#f6dc8c', '#c9d4e0'], ['#f6e2e2', '#d4524a'], ['#e3ead3', '#6f7f56']]),
  pat('tp_diamond', '彩色鑽石點', 'diamond', [['#f4eee0', '#CB8875', '#9CB9D0', '#A6B58A', '#E9D79A'], ['#f8f6f1', '#ef8fae', '#f2c94c', '#9cc5e0', '#a8cf8e', '#c7a6e0'], ['#f4eee0', '#b8322f', '#2f5f9e']]),
  pat('tp_plaid', '格紋', 'plaid', [['#e6dcc4', '#7fb3ae', '#7a5a48'], ['#ecdcd0', '#d98c8c', '#6d4c3d'], ['#f1e6cf', '#9cb9d0', '#c0503f'], ['#e4ddc8', '#a6b58a', '#5f4a3a'], ['#f2e4c6', '#e0b25c', '#7b4a33']]),
  pat('tp_gingham', '千鳥格', 'gingham', [['#f6f1e4', '#93ad6e'], ['#fbf3ee', '#e58f9b'], ['#f6f1e4', '#6f9cc4'], ['#f6f1e4', '#d4a24a'], ['#f6f1e4', '#2e2a26'], ['#fbf3ee', '#d6433a']]),
  pat('tp_finecheck', '細格布', 'finecheck', [['#fbeee9', '#ef9fa6'], ['#f6e0a0', '#a07a52'], ['#eef3f6', '#8fb3d3'], ['#f3f4ea', '#93ad6e'], ['#fbeee9', '#c9356a']]),
  pat('tp_checker', '棋盤格', 'checker', [['#f6f3ea', '#1f6e3a'], ['#f6f3ea', '#2a55b8'], ['#f7e9e4', '#e06a6a'], ['#f6f3ea', '#2b2622'], ['#f8eecf', '#b9b236']]),
  pat('tp_grid', '方格紙', 'grid', [['#f7f4ea', '#7cae3e'], ['#f7f4ea', '#3a3530'], ['#fbeee9', '#e98f8a'], ['#d9b88f', '#7a5636'], ['#f8e3a0', '#2f8a4a', '#a9b4cf'], ['#fff6e3', '#f0a39a']]),
  pat('tp_madras', '粉紅格紋', 'madras', [['#f2a18f', '#d4524a', '#fbe6dc'], ['#c9dde7', '#5b84a8', '#f4efe6'], ['#e9e2c6', '#8aa25c', '#fff8e8']]),
  pat('tp_crosshatch', '交叉網紋', 'crosshatch', [['#f3ead8', '#6b4a3a'], ['#fbeee9', '#d9547a'], ['#eef0e4', '#5f7a52'], ['#f6dc8c', '#9a6a2a']]),
  pat('tp_stripe', '斜條紋', 'stripes', [['#f5f2ea', '#6ea6cf'], ['#fbf5dc', '#f2d64b'], ['#f7ecea', '#e58f9b'], ['#f5f2ea', '#a8bf7e'], ['#e8f1ec', '#4f9a82']]),
  pat('tp_vstripe', '直條紋', 'vstripe', [['#f7f1e6', '#d6433a'], ['#fbeef0', '#ec9bb0'], ['#f4efe2', '#2a55b8'], ['#f4efe2', '#93ad6e']]),
  pat('tp_hearts', '小愛心', 'hearts', [['#e7a3b3', '#c2334f'], ['#f7d7de', '#e8657f'], ['#f4eee0', '#d6433a'], ['#cfe0ea', '#f6f1e8']]),
  pat('tp_heartline', '線條愛心', 'heartline', [['#8d9a6a', '#2f3326'], ['#f3c6c4', '#e2574c'], ['#ecebe2', '#3a3530']]),
  pat('tp_berry', '草莓', 'berry', [['#f8eed6', '#cf2f37'], ['#f6d7dc', '#cf2f37'], ['#e9f0dc', '#d6433a'], ['#fbf3e2', '#e26a8d']]),
  pat('tp_stars', '星星', 'stars', [['#cbbfe6', '#fff1a8'], ['#2f3b5c', '#f2d46b'], ['#f4eee0', '#e0a02c'], ['#cfe0ea', '#ffffff']]),
  pat('tp_argyle', '菱格', 'argyle', [['#f2b928', '#df6f9b'], ['#a8c7e6', '#f6f1e4'], ['#a8bf7e', '#f4e2a1'], ['#f3c6c4', '#b8322f']]),
  pat('tp_stitch', '縫線', 'stitch', [['#fbf6dc', '#d6433a'], ['#f6e39a', '#5b7fa6'], ['#a8bf7e', '#fbf6ee'], ['#4a4b50', '#f3d77a']]),
  pat('tp_flower', '小碎花', 'flowers', [['#6d8189', '#efe6cf', '#a9b78a'], ['#fff0a6', '#ff9fb8', '#9cc07a'], ['#f4eee0', '#d97a8a', '#8fae6e'], ['#3c4a3a', '#f2d9a8', '#c8705a']]),
  pat('tp_kraft', '牛皮紙', 'kraft', [['#d6b48a', '#9c7650'], ['#c9a275', '#6d4f33'], ['#e6cfa8', '#a98458']]),
  pat('tp_duct', '銀色布膠帶', 'plain', [['#9a9c9e', '#6e7175'], ['#7e8184', '#55585c'], ['#c7c2b4', '#8f8a7c'], ['#3c3d40', '#222']], { material: 'cloth' }),
  pat('tp_lace', '蕾絲', 'lace', [['#fbf8f1', '#fbf8f1'], ['#f6e3e6', '#f6e3e6'], ['#efe6d2', '#efe6d2']], { material: 'paper' }),
  pat('tp_rainbow', '彩虹', 'rainbow', [['#CB8875', '#E9D79A', '#A6B58A', '#9CB9D0', '#A99BC5', '#e0ab92'], ['#e7a3b3', '#f2d58c', '#bcd3a0', '#a9c7dc', '#c9b8de']]),
];
export const TAPES = TAPE_PATTERNS; // 舊介面
export const TAPE_COLORWAYS = Object.fromEntries(TAPE_PATTERNS.map((p) => [p.id, p.colorways]));
export const TAPE_COLORS = ['#efe3cb', '#f2c230', '#6fa6c9', '#b8322f', '#93bf4b', '#3fa9d5', '#ef69a8', '#a8bf7e', '#cfe0ea', '#f3c6c4', '#ef7b6d', '#d6b48a', '#9a9c9e', '#4a4b50', '#ffffff'];
const KIND_ID = { dots: 'tp_dots', hearts: 'tp_hearts', stripes: 'tp_stripe', gingham: 'tp_gingham', grid: 'tp_grid', stars: 'tp_stars', flowers: 'tp_flower', lace: 'tp_lace', plain: 'tp_plain', rainbow: 'tp_rainbow', kraft: 'tp_kraft' };
export const tapeOf = (id) => TAPE_PATTERNS.find((t) => t.id === id) || TAPE_PATTERNS.find((t) => t.id === KIND_ID[id]) || TAPE_PATTERNS[0];

// =====================================================================
// 雜訊與材質貼圖（快取）
// =====================================================================
function lattice(seed, G = 64) {
  const r = rng(seed), a = new Float32Array(G * G);
  for (let i = 0; i < a.length; i++) a[i] = r();
  return (x, y) => {
    const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % G) + G) % G, y0 = ((yi % G) + G) % G, x1 = (x0 + 1) % G, y1 = (y0 + 1) % G;
    const a0 = a[y0 * G + x0] + (a[y0 * G + x1] - a[y0 * G + x0]) * sx, a1 = a[y1 * G + x0] + (a[y1 * G + x1] - a[y1 * G + x0]) * sx;
    return a0 + (a1 - a0) * sy;
  };
}
const fbm = (nz) => (x, y) => nz(x, y) * 0.55 + nz(x * 2.1 + 17, y * 2.1 + 5) * 0.28 + nz(x * 4.3 + 3, y * 4.3 + 31) * 0.17;

const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = max(1, w); c.height = max(1, h); return c; };
const texCache = new Map();
// 貼圖都是「淺色／深色＋透明度」，疊在膠帶上（source-atop），所以和顏色無關、可以共用
function tex(name) {
  if (texCache.has(name)) return texCache.get(name);
  const S = name === 'scrim' ? 96 : 256, c = newCanvas(S, S), g = c.getContext('2d'), r = rng(name.length * 977 + name.charCodeAt(0));
  const id = g.createImageData(S, S), px = id.data;
  const put = (x, y, light, a) => {
    const i = ((y % S) * S + (x % S)) * 4;
    const v = light ? 255 : 30;
    px[i] = v; px[i + 1] = light ? 252 : 22; px[i + 2] = light ? 245 : 15; px[i + 3] = clamp(round(a * 255), 0, 255);
  };
  const nz = lattice(name.length * 31 + 7, 32), nzS = (x, y, s) => nz((x / S) * s, (y / S) * s); // 可重複：s 要能整除 32
  if (name === 'grain' || name === 'paper' || name === 'washi' || name === 'kraft') {
    const k = name === 'paper' ? 0.3 : name === 'kraft' ? 0.38 : 0.2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const cl = nzS(x, y, 8) - 0.5, v = r() - 0.5 + cl * 0.5;
      put(x, y, v > 0, abs(v) * k);
    }
    g.putImageData(id, 0, 0);
    if (name !== 'grain') {
      // 纖維：細長、微彎；和紙多而長（淺色），紙張短而少，牛皮紙偏深
      const n = name === 'washi' ? 700 : name === 'kraft' ? 260 : 120;
      for (let i = 0; i < n; i++) {
        const light = name === 'kraft' ? r() < 0.4 : r() < 0.78;
        g.strokeStyle = light ? `rgba(255,253,246,${0.1 + r() * 0.2})` : `rgba(60,40,25,${0.05 + r() * 0.1})`;
        g.lineWidth = 0.3 + r() * (name === 'washi' ? 0.5 : 0.6);
        const L = (name === 'washi' ? 5 : 4) + r() * (name === 'washi' ? 22 : 12), a = r() * PI * 2, x = r() * S, y = r() * S;
        for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
          g.beginPath(); g.moveTo(x + ox, y + oy);
          g.quadraticCurveTo(x + ox + cos(a) * L * 0.5 + (r() - 0.5) * 8, y + oy + sin(a) * L * 0.5 + (r() - 0.5) * 8, x + ox + cos(a + 0.3) * L, y + oy + sin(a + 0.3) * L);
          g.stroke();
        }
      }
      // 紙裡的小雜點（參考圖 24 米色和紙）
      for (let i = 0; i < (name === 'washi' ? 60 : 110); i++) { g.fillStyle = `rgba(80,60,40,${0.1 + r() * 0.2})`; g.fillRect(r() * S, r() * S, 0.8 + r(), 0.8 + r()); }
    }
  } else if (name === 'cloud') { // 和紙的厚薄不均（用來擦掉一點透明度）
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = nzS(x, y, 4) * 0.6 + nzS(x, y, 16) * 0.4; put(x, y, true, clamp((v - 0.35) * 1.3, 0, 1)); }
    g.putImageData(id, 0, 0);
  } else if (name === 'silk') { // 很細的橫向絲線
    for (let y = 0; y < S; y++) {
      const row = (r() - 0.5) * 0.07 + (y % 2 ? 0.04 : -0.03);
      for (let x = 0; x < S; x++) { const v = row + (nzS(x, y, 32) - 0.5) * 0.12; put(x, y, v > 0, abs(v)); }
    }
    g.putImageData(id, 0, 0);
  } else if (name === 'satin') {
    for (let y = 0; y < S; y++) { const row = (r() - 0.5) * 0.08; for (let x = 0; x < S; x++) put(x, y, row > 0, abs(row)); }
    g.putImageData(id, 0, 0);
  } else if (name === 'linen' || name === 'cotton') {
    // 平織：每格輪流是經線或緯線在上面；亞麻的線粗細不均（竹節），棉布細而平均
    const P = name === 'linen' ? 4 : 3, rowK = [], colK = [];
    for (let i = 0; i < S / P; i++) { rowK.push((name === 'linen' ? 0.55 : 0.85) + r() * (name === 'linen' ? 0.9 : 0.3)); colK.push((name === 'linen' ? 0.6 : 0.85) + r() * (name === 'linen' ? 0.8 : 0.3)); }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const cx = floor(x / P), cy = floor(y / P), fx = (x % P + 0.5) / P, fy = (y % P + 0.5) / P;
      const horiz = (cx + cy) % 2 === 0;
      const prof = horiz ? sin(PI * fy) : sin(PI * fx), k = horiz ? rowK[cy] : colK[cx];
      const slub = name === 'linen' ? (nzS(x, y * (horiz ? 0.25 : 1), 16) - 0.5) * 0.5 : 0;
      const v = (prof - 0.62) * 0.55 * k + slub * 0.4 + (r() - 0.5) * 0.08;
      put(x, y, v > 0, min(0.6, abs(v) * (name === 'linen' ? 1.1 : 0.8)));
    }
    g.putImageData(id, 0, 0);
  } else if (name === 'velvet') { // 絨毛：細碎的深淺＋壓痕的大片明暗
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = (nzS(x, y, 4) - 0.5) * 0.14 + (nzS(x, y, 32) - 0.5) * 0.2 + (r() - 0.5) * 0.2;
      put(x, y, v > 0, abs(v) * 0.9);
    }
    g.putImageData(id, 0, 0);
  } else if (name === 'scrim') { // 布膠帶裡的布紋：細細的經緯線壓紋
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const a = y % 4 === 0 ? 0.26 : y % 4 === 1 ? -0.18 : 0, b = x % 3 === 0 ? 0.17 : x % 3 === 1 ? -0.12 : 0;
      const v = a + b + (r() - 0.5) * 0.12;
      put(x, y, v > 0, abs(v));
    }
    g.putImageData(id, 0, 0);
  }
  texCache.set(name, c);
  return c;
}
// 在離屏畫布上（像素座標）把貼圖鋪滿
function overlayTex(t, name, CW, CH, scale, alpha = 1, op = 'source-atop') {
  const p = t.createPattern(tex(name), 'repeat');
  if (p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(scale));
  t.save(); t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = op; t.globalAlpha = alpha; t.fillStyle = p; t.fillRect(0, 0, CW, CH);
  t.restore();
}

// =====================================================================
// 花紋（畫在「攤平」的膠帶上：x 從左到右、y 從 -u/2 到 u/2，u = 膠帶高）
// 手畫感（參考圖 31、32）：格線、條紋的邊會微微抖動，不是尺畫的直線
// =====================================================================
function heartPath(t, x, y, s) {
  t.moveTo(x, y + s * 0.42);
  t.bezierCurveTo(x - s * 0.95, y - s * 0.18, x - s * 0.42, y - s * 0.9, x, y - s * 0.32);
  t.bezierCurveTo(x + s * 0.42, y - s * 0.9, x + s * 0.95, y - s * 0.18, x, y + s * 0.42);
  t.closePath();
}
function starPath(t, x, y, s, rot = 0) {
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + rot + (i * PI) / 5, rr = i % 2 ? s * 0.45 : s;
    t.lineTo(x + rr * cos(a), y + rr * sin(a));
  }
  t.closePath();
}
// 手畫的帶子：沿著 axis 方向的長條，兩邊微抖
function wobBand(t, vertical, pos, wd, a0, a1, r, amp) {
  const N = max(4, ceil((a1 - a0) / (amp * 30 || 1))), ph1 = r() * 9, ph2 = r() * 9, f = (2 * PI) / (amp * 160 || 1);
  const e1 = [], e2 = [];
  for (let i = 0; i <= N; i++) {
    const s = a0 + ((a1 - a0) * i) / N;
    e1.push([s, pos + amp * sin(s * f + ph1)]);
    e2.push([s, pos + wd + amp * sin(s * f * 1.3 + ph2)]);
  }
  const P = [...e1, ...e2.reverse()];
  t.beginPath();
  P.forEach(([s, q], i) => (vertical ? (i ? t.lineTo(q, s) : t.moveTo(q, s)) : i ? t.lineTo(s, q) : t.moveTo(s, q)));
  t.closePath(); t.fill();
}
function drawPattern(t, kind, x0, y0, W, u, cols, r, k = 4) {
  const [base, ink = base, acc] = cols, x1 = x0 + W, y1 = y0 + u, H = u;
  const wob = u * 0.006;
  t.fillStyle = base; t.fillRect(x0, y0, W, H);
  t.fillStyle = ink; t.strokeStyle = ink;
  switch (kind) {
    case 'dots': { // 參考圖 24 紅底白點：兩排大點交錯，邊緣切掉
      const sp = u * 0.47, R = u * 0.165;
      for (let j = -1, y = y0 + u * 0.18; y < y1 + sp; y += sp * 0.86, j++) for (let x = x0 + (j % 2 ? sp / 2 : 0); x < x1 + sp; x += sp) {
        t.beginPath(); t.ellipse(x + (r() - 0.5) * u * 0.01, y, R * (1 + (r() - 0.5) * 0.04), R * (1 + (r() - 0.5) * 0.04), r(), 0, PI * 2); t.fill();
      }
      break;
    }
    case 'dots_s': {
      const sp = u * 0.17;
      for (let j = 0, y = y0 + sp * 0.4; y < y1 + sp; y += sp * 0.87, j++) for (let x = x0 + (j % 2 ? sp / 2 : 0); x < x1 + sp; x += sp) {
        t.beginPath(); t.arc(x + (r() - 0.5) * u * 0.012, y + (r() - 0.5) * u * 0.012, u * (0.034 + r() * 0.008), 0, PI * 2); t.fill();
      }
      break;
    }
    case 'speckle': { // 參考圖 32：不規則的小點
      const n = (W / u) * 70;
      for (let i = 0; i < n; i++) { t.beginPath(); t.ellipse(x0 + r() * W, y0 + r() * H, u * (0.012 + r() * 0.012), u * (0.01 + r() * 0.01), r() * 3, 0, PI * 2); t.fill(); }
      break;
    }
    case 'diamond': { // 參考圖 24：白圓點之間露出彩色四角星
      const sp = u * 0.34, pal = cols.slice(1).filter(Boolean);
      // 顏色沿斜線輪替；圓點小一點 → 四角星比較胖、凹得比較淺（和參考圖的商品花紋不同）
      for (let j = 0, y = y0 - sp; y < y1 + sp; y += sp, j++) for (let i = 0, x = x0 - sp; x < x1 + sp; x += sp, i++) {
        t.fillStyle = pal[(i + 2 * j) % pal.length];
        const s = sp * 0.8; t.fillRect(x + sp / 2 - s / 2, y + sp / 2 - s / 2, s, s);
      }
      t.fillStyle = base;
      for (let y = y0; y < y1 + sp; y += sp) for (let x = x0; x < x1 + sp; x += sp) { t.beginPath(); t.arc(x, y, sp * 0.405, 0, PI * 2); t.fill(); }
      break;
    }
    case 'plaid': { // 參考圖 24：米底＋霧綠寬帶＋咖啡色雙細線
      if (u * k < 24) { // 太細（細長條、縮圖）：細線會疊成摩爾紋 → 改用千鳥格的畫法，線距至少 3px
        const P = max(u * 0.3, 6 / k);
        t.globalAlpha = 0.6;
        for (let x = x0; x < x1 + P; x += P) wobBand(t, true, x, P / 2, y0, y1, r, 0);
        for (let y = y0; y < y1 + P; y += P) wobBand(t, false, y, P / 2, x0, x1, r, 0);
        t.globalAlpha = 0.7; t.fillStyle = acc || mix(ink, '#000', 0.4);
        for (let x = x0 + P * 0.75; x < x1 + P; x += P * 2) wobBand(t, true, x, 1 / k, y0, y1, r, 0);
        t.globalAlpha = 1;
        break;
      }
      const P = u * 0.44;
      t.globalAlpha = 0.72;
      for (let x = x0; x < x1 + P; x += P) wobBand(t, true, x, P * 0.42, y0, y1, r, wob);
      for (let y = y0 + P * 0.2; y < y1 + P; y += P) wobBand(t, false, y, P * 0.42, x0, x1, r, wob);
      t.globalAlpha = 0.85; t.fillStyle = acc || mix(ink, '#000', 0.4);
      const lw = u * 0.016;
      for (let x = x0 + P * 0.62; x < x1 + P; x += P) { wobBand(t, true, x, lw, y0, y1, r, wob); wobBand(t, true, x + lw * 3, lw, y0, y1, r, wob); }
      for (let y = y0 + P * 0.82; y < y1 + P; y += P) { wobBand(t, false, y - P, lw, x0, x1, r, wob); wobBand(t, false, y - P + lw * 3, lw, x0, x1, r, wob); }
      t.globalAlpha = 1;
      break;
    }
    case 'gingham': case 'finecheck': { // 兩個方向的半透明帶子，交會處比較深
      const P = kind === 'gingham' ? u * 0.25 : u * 0.085;
      t.globalAlpha = kind === 'gingham' ? 0.5 : 0.55;
      for (let x = x0; x < x1 + P; x += P) wobBand(t, true, x, P / 2, y0, y1, r, wob);
      for (let y = y0; y < y1 + P; y += P) wobBand(t, false, y, P / 2, x0, x1, r, wob);
      t.globalAlpha = 1;
      break;
    }
    case 'checker': {
      const P = u * 0.2;
      for (let j = 0, y = y0; y < y1; y += P, j++) for (let i = 0, x = x0; x < x1 + P; x += P, i++) if ((i + j) % 2 === 0) {
        t.beginPath();
        const q = () => (r() - 0.5) * wob * 2;
        t.moveTo(x + q(), y + q()); t.lineTo(x + P + q(), y + q()); t.lineTo(x + P + q(), y + P + q()); t.lineTo(x + q(), y + P + q()); t.closePath(); t.fill();
      }
      break;
    }
    case 'grid': { // 方格紙；參考圖 32 奶油黃方格紙：直線是花紋色、橫線是輔色
      const P = u * 0.155, lw = max(u * 0.02, 0.4);
      for (let x = x0 + P * 0.5; x < x1; x += P) wobBand(t, true, x, lw, y0, y1, r, wob * 0.6);
      t.fillStyle = acc || ink;
      for (let y = y0 + P * 0.35; y < y1; y += P) wobBand(t, false, y, lw, x0, x1, r, wob * 0.6);
      break;
    }
    case 'madras': { // 參考圖 25 粉紅格紋：粗細不同的線
      const P = u * 0.5;
      for (const [o, w, a, c] of [[0, 0.1, 0.45, ink], [0.16, 0.025, 0.8, ink], [0.22, 0.025, 0.8, ink], [0.5, 0.02, 0.9, acc || '#fff'], [0.7, 0.05, 0.35, ink]]) {
        t.globalAlpha = a; t.fillStyle = c;
        for (let x = x0 + o * P; x < x1 + P; x += P) wobBand(t, true, x, w * P, y0, y1, r, wob);
        for (let y = y0 + o * P; y < y1 + P; y += P) wobBand(t, false, y - P * 0.3, w * P, x0, x1, r, wob);
      }
      t.globalAlpha = 1;
      break;
    }
    case 'crosshatch': { // 參考圖 32 咖啡色交叉網紋（細線斜織）
      const P = u * 0.075, lw = max(u * 0.016, 0.4);
      t.lineWidth = lw; t.globalAlpha = 0.85;
      for (const s of [1, -1]) {
        t.beginPath();
        for (let x = x0 - H; x < x1 + H; x += P) { t.moveTo(x + (r() - 0.5) * wob, y0); t.lineTo(x + s * H + (r() - 0.5) * wob * 2, y1); }
        t.stroke();
      }
      t.globalAlpha = 1;
      break;
    }
    case 'stripes': { // 斜條紋
      const P = u * 0.26;
      for (let x = x0 - H; x < x1 + H; x += P) {
        t.beginPath();
        t.moveTo(x, y0); t.lineTo(x + P * 0.48, y0); t.lineTo(x + P * 0.48 + H * 0.9, y1); t.lineTo(x + H * 0.9, y1); t.closePath(); t.fill();
      }
      break;
    }
    case 'vstripe': {
      const P = u * 0.3;
      for (let x = x0; x < x1 + P; x += P) wobBand(t, true, x, P * 0.48, y0, y1, r, wob * 1.5);
      break;
    }
    case 'hearts': {
      const sp = u * 0.2;
      for (let j = 0, y = y0 + sp * 0.5; y < y1 + sp; y += sp * 0.9, j++) for (let x = x0 + (j % 2 ? sp / 2 : 0); x < x1 + sp; x += sp) {
        t.save(); t.translate(x, y); t.rotate((r() - 0.5) * 0.4); t.beginPath(); heartPath(t, 0, 0, u * 0.065); t.fill(); t.restore();
      }
      break;
    }
    case 'heartline': { // 一排線條愛心（參考圖 25 鼠尾草綠）
      const sp = u * 0.6;
      t.lineWidth = u * 0.035; t.lineJoin = 'round';
      for (let x = x0 + sp * 0.5; x < x1 + sp; x += sp) { t.beginPath(); heartPath(t, x + (r() - 0.5) * u * 0.03, 0.02 * u, u * 0.32); t.stroke(); }
      break;
    }
    case 'berry': { // 草莓（單色剪影＋奶油色籽）
      const sp = u * 0.3;
      for (let j = 0, y = y0 + sp * 0.35; y < y1 + sp; y += sp * 0.8, j++) for (let x = x0 + (j % 2 ? sp / 2 : 0); x < x1 + sp; x += sp) {
        const s = u * (0.11 + r() * 0.02);
        t.save(); t.translate(x + (r() - 0.5) * sp * 0.25, y + (r() - 0.5) * sp * 0.2); t.rotate((r() - 0.5) * 1.6);
        t.fillStyle = ink; t.beginPath();
        t.moveTo(0, s * 1.05); t.bezierCurveTo(-s * 1.05, s * 0.2, -s * 0.95, -s * 0.75, 0, -s * 0.62); t.bezierCurveTo(s * 0.95, -s * 0.75, s * 1.05, s * 0.2, 0, s * 1.05); t.fill();
        t.beginPath(); for (let i = 0; i < 5; i++) { const a = -PI / 2 + (i - 2) * 0.55; t.ellipse(cos(a) * s * 0.35, -s * 0.72 + sin(a) * s * 0.18, s * 0.28, s * 0.1, a, 0, PI * 2); } t.fill();
        t.fillStyle = base;
        for (const [a, b] of [[-0.35, -0.2], [0.3, -0.25], [0, 0.1], [-0.4, 0.25], [0.38, 0.22], [0, 0.55], [-0.05, -0.38]]) { t.beginPath(); t.ellipse(a * s, b * s, s * 0.07, s * 0.1, 0, 0, PI * 2); t.fill(); }
        t.restore();
      }
      break;
    }
    case 'stars': {
      const n = (W / u) * 6;
      for (let i = 0; i < n; i++) { t.beginPath(); starPath(t, x0 + r() * W, y0 + r() * H, u * (0.05 + r() * 0.05), r()); t.fill(); }
      break;
    }
    case 'argyle': { // 菱格（參考圖 25 黃粉菱格）
      const P = u * 0.25; // 菱形的寬；黑白交錯（像轉 45 度的棋盤）
      for (let j = 0, y = y0; y < y1 + P; y += P / 2, j++) for (let i = 0, x = x0 + (j % 2 ? P / 2 : 0); x < x1 + P; x += P, i++) {
        if (j % 2) continue; // 隔一排上色，整片就是兩色交錯的菱格
        const q = () => (r() - 0.5) * wob * 2;
        t.beginPath(); t.moveTo(x + q(), y - P / 2 + q()); t.lineTo(x + P / 2 + q(), y + q()); t.lineTo(x + q(), y + P / 2 + q()); t.lineTo(x - P / 2 + q(), y + q()); t.closePath(); t.fill();
      }
      break;
    }
    case 'stitch': { // 素色布上一條起伏的虛線縫線
      if (acc) { t.fillStyle = acc; t.globalAlpha = 0.5; const P = u * 0.09; for (let x = x0; x < x1 + P; x += P) wobBand(t, true, x, P * 0.35, y0, y1, r, wob); for (let y = y0; y < y1 + P; y += P) wobBand(t, false, y, P * 0.35, x0, x1, r, wob); t.globalAlpha = 1; }
      t.strokeStyle = ink; t.lineWidth = u * 0.045; t.lineCap = 'round'; t.setLineDash([u * 0.09, u * 0.07]);
      t.beginPath();
      const a = u * 0.11, b = u * 0.06; // 擺線：b < a 是平緩波浪，不打圈
      for (let th = 0, first = true; x0 + a * th - b < x1 + u; th += 0.08, first = false) {
        const xx = x0 + a * th - b * sin(th), yy = u * 0.04 - b * cos(th) * 0.55 + u * 0.05 * sin(th * 0.21);
        first ? t.moveTo(xx, yy) : t.lineTo(xx, yy);
      }
      t.stroke(); t.setLineDash([]);
      break;
    }
    case 'flowers': { // 小碎花
      const n = (W / u) * 22;
      for (let i = 0; i < n; i++) {
        const x = x0 + r() * W, y = y0 + r() * H, s = u * (0.035 + r() * 0.03);
        if (acc && r() < 0.5) { t.fillStyle = acc; t.beginPath(); t.ellipse(x + s * 1.4, y + s * 0.6, s * 0.7, s * 0.3, r() * 3, 0, PI * 2); t.fill(); }
        t.fillStyle = ink;
        for (let k = 0; k < 5; k++) { const a = (k * 2 * PI) / 5 + r(); t.beginPath(); t.arc(x + cos(a) * s * 0.55, y + sin(a) * s * 0.55, s * 0.45, 0, PI * 2); t.fill(); }
        t.fillStyle = mix(base, ink, 0.3); t.beginPath(); t.arc(x, y, s * 0.28, 0, PI * 2); t.fill();
      }
      break;
    }
    case 'kraft': {
      for (let i = 0; i < (W / u) * 90; i++) {
        t.globalAlpha = 0.15 + r() * 0.3; t.lineWidth = u * (0.004 + r() * 0.006);
        const x = x0 + r() * W, y = y0 + r() * H, l = u * (0.03 + r() * 0.12), a = (r() - 0.5) * 2;
        t.beginPath(); t.moveTo(x, y); t.lineTo(x + cos(a) * l, y + sin(a) * l); t.stroke();
      }
      t.globalAlpha = 1;
      break;
    }
    case 'rainbow': { // 手畫的直色帶，色帶之間留細細的紙色縫，帶一點顆粒
      const pal = cols, bw = u * 0.3, gp = u * 0.035;
      t.fillStyle = '#f4eee0'; t.fillRect(x0, y0, W, H);
      for (let i = 0, x = x0; x < x1 + bw; x += bw + gp, i++) { t.fillStyle = pal[i % pal.length]; wobBand(t, true, x + (r() - 0.5) * gp * 0.5, bw * (0.94 + r() * 0.1), y0 - 1, y1 + 1, r, wob * 2.5); }
      for (let i = 0; i < (W / u) * 160; i++) { t.fillStyle = r() < 0.5 ? 'rgba(60,40,25,.13)' : 'rgba(255,252,240,.22)'; t.fillRect(x0 + r() * W, y0 + r() * H, u * 0.012, u * 0.012); }
      break;
    }
    default: break;
  }
}

// =====================================================================
// 形狀與皺褶（高度場）
// =====================================================================
// 一條「層」的幾何：outline（多邊形）、mapTop/mapBot（花紋跟著外形擠壓）、creases（皺褶）、ends（兩端，畫毛邊用）、flap（捲角）
function buildGeom(shape, lw, lh, mat, r, lace) {
  const X = lw / 2, Y = lh / 2, cr = [];
  // a：高度（相對 lh，正＝凸、負＝凹）；w1/w2：兩側寬度；pw：1＝尖折、2＝圓鼓
  const C = (x0, y0, x1, y1, a, w1, w2 = w1, pw = 1, tp = 1, hl = false) => cr.push({ x0, y0, x1, y1, a: a * lh, w1: w1 * lh, w2: w2 * lh, pw, tp, hl });
  let band = null, pinchT = () => 0, pinchB = () => 0, waveT = () => 0, waveB = () => 0, step = null, rough = 1, flap = null;
  let endType = mat.end, chunk = 0.035, tiltL = (r() - 0.5) * 0.28, tiltR = (r() - 0.5) * 0.28;
  // sharp：尖折（窄、pw=1、旁邊一條 1px 亮線），用在揉皺、疊貼上層
  const randCrease = (n, amp, spread = 0.5, sharp = false) => {
    for (let i = 0; i < n; i++) {
      const cx = (r() - 0.5) * lw * 0.9, cy = (r() - 0.5) * lh * 0.6, ang = PI / 2 + (r() - 0.5) * PI * spread, L = lh * (0.7 + r() * 0.9);
      const s = r() < 0.6 ? 1 : -1, p0 = [cx - (cos(ang) * L) / 2, cy - (sin(ang) * L) / 2], p1 = [cx + (cos(ang) * L) / 2, cy + (sin(ang) * L) / 2];
      if (sharp) { const e = 1.5; C(cx + (p0[0] - cx) * e, cy + (p0[1] - cy) * e, cx + (p1[0] - cx) * e, cy + (p1[1] - cy) * e, s * amp * (0.3 + r() * 0.3), 0.03 + r() * 0.03, 0.14 + r() * 0.12, 1, 0.6, true); }
      else C(p0[0], p0[1], p1[0], p1[1], s * amp * (0.5 + r() * 0.7), 0.08 + r() * 0.1, 0.14 + r() * 0.2, 1.25, 1);
    }
  };
  switch (shape) {
    case 'short':
      chunk = 0.07;
      if (r() < 0.65) step = { x: (r() - 0.5) * lw * 0.5, jog: lh * (0.06 + r() * 0.05), top: r() < 0.6 };
      randCrease(3, 0.03, 0.9);
      break;
    case 'slant': {
      endType = 'cut';
      const s = r() < 0.5 ? 1 : -1; tiltL = tiltR = s * (0.45 + r() * 0.2);
      randCrease(1, 0.025);
      break;
    }
    case 'pinch': { // 參考圖 24 紅色：上緣捏得深、下緣淺（不對稱），一條斜斜的折帶，兩側短而尖的放射皺
      const px = (r() - 0.5) * lw * 0.24, g = lw * 0.06 + lh * 0.28, dT = lh * 0.16, dB = lh * 0.05;
      pinchT = (x) => dT * exp(-(((x - px) / g) ** 2));
      pinchB = (x) => dB * exp(-(((x - px) / (g * 1.3)) ** 2));
      waveT = (x) => lh * 0.02 * sin(x / lw * 9 + 1.3);
      waveB = (x) => lh * 0.015 * sin(x / lw * 7 + 4.1);
      band = { x0: px - lh * 0.2, y0: -Y - lh * 0.05, x1: px + lh * 0.3, y1: Y + lh * 0.05, w: lh * 0.08 };
      C(band.x0 - band.w / 2, band.y0, band.x1 - band.w / 2, band.y1, 0.05, 0.02, 0.06, 1, 0.5, true);
      C(band.x0 + band.w / 2, band.y0, band.x1 + band.w / 2, band.y1, -0.04, 0.05, 0.02, 1, 0.5);
      for (const sd of [-1, 1]) for (let j = 0; j < 4; j++) {
        const fromTop = j % 2 === 0, sy = fromTop ? -Y + dT * 0.8 : Y - dB * 0.8;
        const sx = px + sd * lh * (0.05 + r() * 0.08), L = lh * (0.3 + r() * 0.3), ang = (fromTop ? 1 : -1) * (PI / 2 - sd * (0.5 + r() * 0.6));
        C(sx, sy, sx + cos(ang) * L, sy + sin(ang) * L, (j % 2 ? -1 : 1) * (0.022 + r() * 0.012), 0.02 + r() * 0.02, 0.05 + r() * 0.04, 1, 0.8, true);
      }
      randCrease(1, 0.02);
      rough = 1.4;
      break;
    }
    case 'crumple': { // 參考圖 24 藍色、布膠帶：整條都是細細的揉痕
      const p1 = r() * 6, p2 = r() * 6;
      waveT = (x) => lh * 0.035 * sin((x / lw) * 2 * PI * 1.4 + p1);
      waveB = (x) => lh * 0.03 * sin((x / lw) * 2 * PI * 1.7 + p2);
      randCrease(Math.round(6 + (lw / lh) * 2), 0.035, 1.2, true);
      C(-lw * 0.1, -Y * 1.1, lw * 0.15, Y * 1.1, 0.06, 0.04, 0.12, 1, 0.4, true);
      rough = 2;
      break;
    }
    case 'thin':
      if (r() < 0.6) randCrease(1, 0.03);
      break;
    case 'block':
      chunk = 0.05;
      C(-X * 0.8, -Y * 1.05, X * 0.5, Y * 1.05, 0.05, 0.06, 0.1, 1, 0.45);
      randCrease(3, 0.03, 1);
      break;
    case 'twist': { // 疊貼的上層：一道斜斜的大折痕（參考圖 24 黃色）
      const px = (r() - 0.3) * lw * 0.2, g = lw * 0.18;
      pinchT = (x) => lh * 0.12 * exp(-(((x - px) / g) ** 2));
      pinchB = (x) => lh * 0.03 * exp(-(((x - px - lw * 0.05) / g) ** 2));
      waveT = (x) => lh * 0.03 * sin(x / lw * 8 + 2);
      C(px - lh * 0.45, -Y, px + lh * 0.25, Y, 0.1, 0.04, 0.16, 1, 0.3, true);
      C(px + lh * 0.1, -Y, px + lh * 0.55, Y, -0.06, 0.08, 0.04, 1, 0.4);
      randCrease(2, 0.03, 1, true);
      chunk = 0.05; rough = 1.3;
      break;
    }
    case 'curl': {
      randCrease(1, 0.025);
      flap = true;
      break;
    }
    default: // strip
      randCrease(r() < 0.5 ? 1 : 2, 0.028);
      break;
  }
  if (mat.metal && shape !== 'crumple' && shape !== 'pinch') randCrease(1, 0.04, 1.2); // 布膠帶：一道折痕就好（霧面布，不是鋁箔）
  if (mat.long) for (let i = 0; i < 1 + (r() < 0.5 ? 1 : 0); i++) { const ya = (r() - 0.5) * lh * 0.6, yb = (r() - 0.5) * lh * 0.6; C(-X * (0.5 + r() * 0.4), ya, X * (0.4 + r() * 0.5), yb, 0.012, 0.015, 0.05, 1, 1, true); } // 塑膠：沿長邊的細亮折
  if (lace) { endType = 'cut'; tiltL = tiltR = 0; }
  const scal = lace ? lh * 0.12 : 0, sp = lh * 0.24;
  const scallop = (x) => { if (!lace) return 0; const m = (((x + X) % sp) + sp) % sp - sp / 2, rr = sp / 2; return scal * (1 - sqrt(max(0, 1 - (m / rr) ** 2))); };
  const mapTop = (x) => -Y + pinchT(x) + waveT(x), mapBot = (x) => Y - pinchB(x) + waveB(x);
  const stepOff = (x, top) => (step && step.top === top && x > step.x ? step.jog : 0);
  const topE = (x) => mapTop(x) + stepOff(x, true) + scallop(x), botE = (x) => mapBot(x) - stepOff(x, false) - scallop(x);

  // 兩端
  const endPts = (side) => {
    const xc = side * (X - lh * 0.05), tilt = side < 0 ? tiltL : tiltR, yT = topE(xc), yB = botE(xc), pts = [];
    if (endType === 'cut') {
      pts.push([xc + tilt * yT, yT], [xc + tilt * yB, yB]);
      return pts;
    }
    if (endType === 'pinked') {
      const n = max(4, round((yB - yT) / (lh * 0.07)));
      for (let i = 0; i <= n; i++) { const y = yT + ((yB - yT) * i) / n; pts.push([xc + tilt * y + side * (i % 2 ? lh * 0.03 : -lh * 0.01), y]); }
      return pts;
    }
    const n = max(10, round((yB - yT) / (lh * 0.016))), ph = r() * 6, ph2 = r() * 6, amp = endType === 'fray' ? 0.25 : 1;
    let walk = 0;
    for (let i = 0; i <= n; i++) {
      const y = yT + ((yB - yT) * i) / n, s = i / n;
      walk += (r() - 0.5) * lh * 0.012 * amp;
      walk *= 0.85;
      const lf = lh * chunk * amp * (sin(s * 4.2 + ph) * 0.7 + sin(s * 9.1 + ph2) * 0.3);
      const hf = (r() - 0.5) * lh * 0.022 * amp + (r() < 0.06 * amp ? side * lh * 0.025 : 0);
      pts.push([xc + tilt * y + lf + walk + hf, y]);
    }
    return pts;
  };
  const L = endPts(-1), R = endPts(1);
  const outline = [];
  const M = 64, xa = L[0][0], xb = R[0][0];
  const xsT = [];
  for (let i = 0; i <= M; i++) xsT.push(xa + ((xb - xa) * i) / M);
  if (step && step.x > xa && step.x < xb) xsT.push(step.x - 0.001, step.x + 0.001);
  xsT.sort((a, b) => a - b).forEach((x) => outline.push([x, topE(x)]));
  // 撕邊的點要貼著上下緣（在擠壓的地方也是）
  R.forEach((p, i) => outline.push([p[0], i === 0 ? topE(p[0]) : i === R.length - 1 ? botE(p[0]) : p[1]]));
  const xc2 = R[R.length - 1][0], xd = L[L.length - 1][0], xsB = [];
  for (let i = 0; i <= M; i++) xsB.push(xc2 + ((xd - xc2) * i) / M);
  if (step && step.x > xd && step.x < xc2) xsB.push(step.x + 0.001, step.x - 0.001);
  xsB.sort((a, b) => b - a).forEach((x) => outline.push([x, botE(x)]));
  L.slice().reverse().forEach((p, i, A) => outline.push([p[0], i === 0 ? botE(p[0]) : i === A.length - 1 ? topE(p[0]) : p[1]]));

  if (flap) { // 四個角隨機挑一個捲起來
    const f = lh * (0.55 + r() * 0.15), sx = r() < 0.5 ? 1 : -1, sy = r() < 0.5 ? -1 : 1, Xc = X - lh * 0.05;
    const ax = sx * (Xc - f * 1.05), A = [ax, sy < 0 ? topE(ax) : botE(ax)], B = [sx * (Xc + lh * 0.02), sy * (Y - f * 0.95)];
    flap = { A, B, Cc: [sx * Xc, sy * Y], sx, sy };
    // 捲起來的地方是一道圓鼓（往膠帶內側偏一點）
    const ix = -sx * lh * 0.04, iy = -sy * lh * 0.02;
    C(A[0] + ix, A[1] + iy, B[0] + ix, B[1] + iy, 0.06, 0.12, 0.12, 2, 0.3);
  }
  return { band, outline, mapTop, mapBot, creases: cr, ends: [L, R], endType, rough, flap, X, Y };
}

// 光影：高度場 → 法線 → 漫射＋光澤（＋金屬的環境反射、絨布的掠角柔光）
const LV = (() => { const v = [-0.45, -0.68, 0.58], m = hypot(...v); return v.map((x) => x / m); })();
const HV = (() => { const v = [LV[0], LV[1], LV[2] + 1], m = hypot(...v); return v.map((x) => x / m); })();
function lightCanvas(geom, mat, lh, CW, CH, k, seed, rough) {
  const ds = min(1, 800 / CW, 380 / CH), GW = max(2, round(CW * ds)), GH = max(2, round(CH * ds));
  const Hf = new Float32Array(GW * GH), HL = new Float32Array(GW * GH), nz = fbm(lattice(seed * 13 + 5)), ns = mat.ns * lh, na = mat.noise * lh * rough;
  const wx = lattice(seed * 5 + 1, 32), wy = lattice(seed * 5 + 2, 32), ww = lh * (mat.calm ? 0.03 : 0.07), wsc = lh * 0.5, ua = lh * 0.022 * rough; // 皺褶彎彎的、整條有大片的起伏
  const cr = geom.creases.map((c) => {
    const vx = c.x1 - c.x0, vy = c.y1 - c.y0, L2 = vx * vx + vy * vy || 1, L = sqrt(L2);
    return { ...c, a: c.a * (mat.metal ? 1 : 0.7), vx, vy, L2, nx: -vy / L, ny: vx / L };
  });
  const toL = 1 / (ds * k), ox = CW / (2 * k), oy = CH / (2 * k);
  for (let gy = 0; gy < GH; gy++) {
    const y = (gy + 0.5) * toL - oy;
    for (let gx = 0; gx < GW; gx++) {
      const x = (gx + 0.5) * toL - ox;
      let h = (na ? na * (nz(x / ns, y / ns) - 0.5) * 2 : 0) + ua * (wx(x / (wsc * 1.6) + 7, y / (wsc * 1.6)) - 0.5) * 2;
      const X = x + ww * (wx(x / wsc, y / wsc) - 0.5), Y = y + ww * (wy(x / wsc, y / wsc) - 0.5);
      for (const c of cr) {
        const t = ((X - c.x0) * c.vx + (Y - c.y0) * c.vy) / c.L2;
        if (t <= 0 || t >= 1) continue;
        const env = sin(PI * t), d = (X - c.x0) * c.nx + (Y - c.y0) * c.ny, w = (d < 0 ? c.w1 : c.w2) * (0.35 + 0.65 * env), u = abs(d) / w;
        if (u >= 1) continue;
        h += c.a * pow(env, c.tp) * pow(1 - u, c.pw);
        // 尖折旁邊一條約 1px 的亮線（在凸起那側的折線上）
        if (c.hl) { const dp = d / toL + (c.a > 0 ? 0.8 : -0.8), q = env * max(0, 1 - abs(dp)); if (q > HL[gy * GW + gx]) HL[gy * GW + gx] = q; }
      }
      Hf[gy * GW + gx] = h;
    }
  }
  const c = newCanvas(GW, GH), g = c.getContext('2d'), id = g.createImageData(GW, GH), px = id.data;
  const spec0 = pow(HV[2], mat.sh);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const i = gy * GW + gx;
    const dx = (Hf[gy * GW + min(GW - 1, gx + 1)] - Hf[gy * GW + max(0, gx - 1)]) / (2 * toL);
    const dy = (Hf[min(GH - 1, gy + 1) * GW + gx] - Hf[max(0, gy - 1) * GW + gx]) / (2 * toL);
    const m = hypot(dx, dy, 1), nx = -dx / m, ny = -dy / m, nzv = 1 / m;
    const nl = nx * LV[0] + ny * LV[1] + nzv * LV[2];
    let v = (nl - LV[2]) * mat.kd;
    if (mat.ks) v += max(0, pow(max(0, nx * HV[0] + ny * HV[1] + nzv * HV[2]), mat.sh) - spec0) * mat.ks * 3;
    if (mat.metal) v += sin(nx * 9 + ny * 6 + seed) * min(1, (1 - nzv) * 8) * mat.metal;
    if (mat.sheen) v += pow(1 - nzv, 0.7) * mat.sheen * 0.6 - 0.04;
    if (HL[i]) v += HL[i] * (mat.hl || 0.2);
    const o = i * 4;
    if (v > 0) { px[o] = 255; px[o + 1] = 253; px[o + 2] = 246; px[o + 3] = min(235, v * 255); } else { px[o] = 28; px[o + 1] = 20; px[o + 2] = 14; px[o + 3] = min(170, -v * 170); }
  }
  g.putImageData(id, 0, 0);
  return c;
}

// =====================================================================
// 畫一層膠帶（回傳離屏畫布）
// =====================================================================
function polyPath(t, pts) { t.beginPath(); pts.forEach(([x, y], i) => (i ? t.lineTo(x, y) : t.moveTo(x, y))); t.closePath(); }
function renderLayer(L, k) {
  const { lw, lh, shape, matId, cols, kind, seed } = L, mat = MAT[matId] || MAT.washi, r = rng(seed * 7 + 3);
  const lace = kind === 'lace';
  const mg = lh * 0.12 + 3 / k, CW = ceil((lw + 2 * mg) * k), CH = ceil((lh + 2 * mg) * k);
  const geom = buildGeom(shape, lw, lh, mat, r, lace);
  const c = newCanvas(CW, CH), t = c.getContext('2d');
  const toPx = () => t.setTransform(k, 0, 0, k, CW / 2, CH / 2);
  // 1. 花紋畫在攤平的膠帶上，再一欄一欄擠進外形（捏起來的地方花紋跟著擠）
  const P = newCanvas(CW, CH), pt = P.getContext('2d');
  pt.setTransform(k, 0, 0, k, CW / 2, CH / 2);
  drawPattern(pt, kind, -lw / 2 - mg, -lh / 2, lw + 2 * mg, lh, cols, rng(seed * 11 + 1), k);
  const warp = geom.creases && (geom.mapTop(0) !== -lh / 2 || geom.mapTop(lw * 0.3) !== -lh / 2 || geom.mapBot(-lw * 0.2) !== lh / 2);
  if (warp) {
    const sy = CH / 2 - (lh / 2) * k, sh = lh * k;
    for (let cx = 0; cx < CW; cx += 2) {
      const x = (cx + 1) / k - CW / (2 * k), tp = geom.mapTop(x), bt = geom.mapBot(x);
      t.drawImage(P, cx, sy, 2, sh, cx, CH / 2 + tp * k, 2, (bt - tp) * k);
    }
  } else t.drawImage(P, 0, 0);
  // 2. 剪成膠帶的外形
  toPx();
  t.globalCompositeOperation = 'destination-in';
  polyPath(t, geom.outline); t.fill();
  // 蕾絲：挖出小花洞（只在離屏畫布上挖）
  if (lace) {
    t.globalCompositeOperation = 'destination-out';
    const sp = lh * 0.24;
    for (let x = -lw / 2 + sp / 2; x < lw / 2; x += sp) {
      t.beginPath(); t.arc(x, -lh * 0.28, lh * 0.035, 0, PI * 2); t.arc(x, lh * 0.28, lh * 0.035, 0, PI * 2); t.fill();
      t.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * PI) / 3; t.moveTo(x + cos(a) * lh * 0.09 + lh * 0.03, sin(a) * lh * 0.09); t.arc(x + cos(a) * lh * 0.09, sin(a) * lh * 0.09, lh * 0.03, 0, PI * 2); } t.fill();
    }
    t.globalCompositeOperation = 'source-atop';
    t.strokeStyle = 'rgba(120,100,90,.18)'; t.lineWidth = lh * 0.012;
    for (let x = -lw / 2 + sp / 2; x < lw / 2; x += sp) { t.beginPath(); t.arc(x, 0, lh * 0.13, 0, PI * 2); t.stroke(); }
  }
  // 3. 材質紋理
  const ts = clamp((lh * k) / 110, 0.45, 2.2);
  if (mat.tex === 'washi') { overlayTex(t, 'washi', CW, CH, ts, 0.9); overlayTex(t, 'grain', CW, CH, ts * 0.6, 0.5); }
  else if (mat.tex === 'paper') { overlayTex(t, kind === 'kraft' ? 'kraft' : 'paper', CW, CH, ts * 0.8, 1); }
  else if (mat.tex) overlayTex(t, mat.tex, CW, CH, mat.tex === 'scrim' ? max(0.9, ts * 0.8) : mat.tex === 'linen' || mat.tex === 'cotton' ? ts * 0.75 : ts, mat.tex === 'satin' ? 0.6 : mat.tex === 'scrim' ? 1 : 1);
  if (kind === 'kraft' && mat.tex !== 'paper') overlayTex(t, 'kraft', CW, CH, ts * 0.8, 0.7);
  if (matId === 'velvet') { // 絨布：顏色比較深沉、飽和
    t.save(); t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-atop'; t.fillStyle = 'rgba(30,10,20,.16)'; t.fillRect(0, 0, CW, CH); t.restore();
  }
  // 4. 皺褶光影
  const lc = lightCanvas(geom, mat, lh, CW, CH, k, seed, geom.rough);
  t.save(); t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-atop'; t.imageSmoothingEnabled = true; t.drawImage(lc, 0, 0, CW, CH); t.restore();
  // 捏起來的斜折帶：比旁邊暗 15%
  if (geom.band) {
    const { x0, y0, x1, y1, w } = geom.band;
    toPx(); t.globalCompositeOperation = 'source-atop'; t.fillStyle = 'rgba(25,15,10,.15)'; // 折帶
    t.beginPath(); t.moveTo(x0 - w / 2, y0); t.lineTo(x0 + w / 2, y0); t.lineTo(x1 + w / 2, y1); t.lineTo(x1 - w / 2, y1); t.closePath(); t.fill();
  }
  // 5. 邊：長邊有一點厚度、撕邊的纖維、布的鬚邊
  toPx();
  const base = cols[0], light = mix(base, '#ffffff', 0.55);
  t.globalCompositeOperation = 'source-atop';
  t.lineJoin = 'round';
  if (matId === 'plastic') { t.strokeStyle = 'rgba(255,255,255,.75)'; t.lineWidth = max(lh * 0.02, 1 / k); polyPath(t, geom.outline); t.stroke(); }
  else { t.strokeStyle = rgba(mix(base, '#2a1d14', 0.5), matId === 'washi' ? 0.12 : 0.22); t.lineWidth = max(lh * 0.014, 0.8 / k); polyPath(t, geom.outline); t.stroke(); }
  const ends = geom.endType === 'torn' || geom.endType === 'fray' ? geom.ends : [];
  ends.forEach((E, si) => {
    const side = si ? 1 : -1;
    if (geom.endType === 'torn') {
      // 撕開的地方：紙變薄、顏色淺（和紙半透明，紙張露出白色紙芯）
      t.globalCompositeOperation = 'source-atop';
      t.strokeStyle = mat.fringe === 'paper' ? 'rgba(255,253,247,.85)' : rgba(light, 0.55);
      t.lineWidth = lh * (mat.fringe === 'paper' ? 0.025 : 0.03);
      t.beginPath(); E.forEach(([x, y], i) => (i ? t.lineTo(x, y) : t.moveTo(x, y))); t.stroke();
      // 往外岔出的細纖維
      t.globalCompositeOperation = 'source-over';
      t.strokeStyle = mat.fringe === 'paper' ? 'rgba(255,253,247,.8)' : rgba(light, 0.6);
      t.lineWidth = max(lh * 0.005, 0.5 / k);
      t.beginPath();
      E.forEach(([x, y]) => {
        if (r() > (mat.fringe === 'paper' ? 0.35 : 0.7)) return;
        const l = lh * (0.008 + r() * (mat.fringe === 'paper' ? 0.015 : 0.03)), a = (r() - 0.5) * 1.6;
        t.moveTo(x - side * l * 0.3, y); t.quadraticCurveTo(x + side * l * 0.5, y + a * l * 0.3, x + side * cos(a) * l, y + sin(a) * l);
      });
      t.stroke();
    } else { // 鬚邊：一根根線頭
      t.globalCompositeOperation = 'source-over';
      const thread = mix(base, '#ffffff', matId === 'velvet' ? 0.05 : 0.12);
      t.strokeStyle = rgba(thread, 0.85); t.lineWidth = max(lh * 0.008, 0.6 / k); t.lineCap = 'round';
      t.beginPath();
      for (let i = 0; i < E.length; i++) {
        const [x, y] = E[i];
        for (let j = 0; j < 2; j++) {
          const yy = y + (r() - 0.5) * lh * 0.02, l = lh * (0.012 + r() * (r() < 0.12 ? 0.08 : 0.03));
          t.moveTo(x - side * lh * 0.01, yy); t.quadraticCurveTo(x + side * l * 0.6, yy + (r() - 0.5) * l * 0.4, x + side * l, yy + (r() - 0.5) * l * 0.6);
        }
      }
      t.stroke();
    }
  });
  if (mat.fuzz) { // 絨布、棉布：整圈邊緣毛毛的（參考圖 32 邊緣微毛）
    t.globalCompositeOperation = 'source-over';
    t.strokeStyle = rgba(mix(base, '#000', matId === 'velvet' ? 0.25 : 0.06), matId === 'velvet' ? 0.6 : 0.45); t.lineWidth = max(lh * 0.005, 0.5 / k);
    t.beginPath();
    const O = geom.outline;
    for (let i = 0; i < O.length; i++) {
      const a = O[i], b = O[(i + 1) % O.length], seg = hypot(b[0] - a[0], b[1] - a[1]), nn = ceil(seg / (lh * 0.012));
      const nx = (b[1] - a[1]) / (seg || 1), ny = -(b[0] - a[0]) / (seg || 1);
      for (let j = 0; j < nn; j++) {
        const s = j / nn, x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s, l = lh * (0.006 + r() * 0.014) * (matId === 'velvet' ? 0.7 : 1);
        t.moveTo(x - nx * l * 0.5, y - ny * l * 0.5); t.lineTo(x + nx * l + (r() - 0.5) * l, y + ny * l + (r() - 0.5) * l);
      }
    }
    t.stroke();
  }
  // 6. 和紙的厚薄不均：有的地方比較透
  if (mat.cloud) overlayTex(t, 'cloud', CW, CH, ts * 1.4, mat.cloud, 'destination-out');
  // 7. 捲起一角：把角擦掉，畫翻起來的背面
  if (geom.flap) {
    const { A, B, Cc, sx, sy } = geom.flap, big = lh * 2;
    toPx();
    t.globalCompositeOperation = 'destination-out';
    t.beginPath(); t.moveTo(A[0], A[1]); t.lineTo(A[0], sy * big); t.lineTo(sx * big, sy * big); t.lineTo(sx * big, B[1]); t.lineTo(B[0], B[1]); t.closePath(); t.fill();
    const vx = B[0] - A[0], vy = B[1] - A[1], L2 = vx * vx + vy * vy, tt = ((Cc[0] - A[0]) * vx + (Cc[1] - A[1]) * vy) / L2;
    const Mp = [A[0] + vx * tt, A[1] + vy * tt], Cr = [2 * Mp[0] - Cc[0], 2 * Mp[1] - Cc[1]], Cs = [Mp[0] + (Cr[0] - Mp[0]) * 0.72, Mp[1] + (Cr[1] - Mp[1]) * 0.72];
    const under = matId === 'cloth' ? '#d9d4c9' : matId === 'velvet' || matId === 'linen' || matId === 'cotton' ? mix(base, '#cfc8bb', 0.4) : matId === 'plastic' ? base : mix(base, '#ffffff', 0.15);
    const G = [(A[0] + B[0] + Cs[0]) / 3, (A[1] + B[1] + Cs[1]) / 3], bulge = (p, q) => { const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; return [m[0] + (m[0] - G[0]) * 0.18, m[1] + (m[1] - G[1]) * 0.18]; };
    const c1 = bulge(A, Cs), c2 = bulge(Cs, B);
    t.globalCompositeOperation = 'source-over';
    t.save();
    t.shadowColor = 'rgba(40,28,20,.35)'; t.shadowBlur = lh * 0.08 * k; t.shadowOffsetX = -lh * 0.02 * k; t.shadowOffsetY = lh * 0.03 * k;
    t.globalAlpha = matId === 'plastic' ? 0.6 : 1;
    t.beginPath(); t.moveTo(A[0], A[1]); t.quadraticCurveTo(c1[0], c1[1], Cs[0], Cs[1]);
    t.quadraticCurveTo(c2[0], c2[1], B[0], B[1]); t.closePath();
    t.fillStyle = under; t.fill();
    t.restore();
    t.save(); t.clip();
    // 背面透出鏡像的花紋（35%）：以折線 AB 為軸翻過去
    if (kind !== 'plain') {
      const L = sqrt(L2), ux = vx / L, uy = vy / L, a = ux * ux - uy * uy, b = 2 * ux * uy, d = -a;
      t.save(); t.globalAlpha = 0.35; t.transform(a, b, b, d, A[0] - (a * A[0] + b * A[1]), A[1] - (b * A[0] + d * A[1]));
      t.drawImage(P, -CW / (2 * k), -CH / (2 * k), CW / k, CH / k); t.restore();
    }
    const g = t.createLinearGradient(Mp[0], Mp[1], Cs[0], Cs[1]);
    g.addColorStop(0, 'rgba(30,20,12,.32)'); g.addColorStop(0.25, 'rgba(255,255,255,.35)'); g.addColorStop(0.6, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(30,20,12,.12)');
    t.fillStyle = g; t.fillRect(-big, -big, big * 2, big * 2);
    t.restore();
    overlayTex(t, matId === 'cloth' ? 'scrim' : 'grain', CW, CH, ts * 0.7, 0.6);
  }
  return { c, W: CW / k, H: CH / k };
}

// =====================================================================
// 對外：drawTape
// =====================================================================
const cache = new Map();
function resolve(o) {
  const p = typeof o.pattern === 'object' && o.pattern ? tapeOf(o.pattern.id) : tapeOf(o.pattern || 'tp_plain');
  const color = o.color || p.colors[0];
  // 配色：找到和底色、花紋色一樣的那組，拿它的輔色／調色盤
  const cw = p.colorways.find((c) => c[0] === color && (!o.color2 || c[1] === o.color2)) || p.colorways.find((c) => c[0] === color) || p.colors;
  const ink = o.color2 || (cw[0] === color ? cw[1] : p.colors[1]) || color;
  const cols = [color, ink, ...cw.slice(2)];
  if (p.kind === 'rainbow') cols.splice(0, cols.length, ...(cw[0] === color ? cw : p.colors));
  const material = MAT[o.material] ? o.material : 'washi';
  if (MAT[material].sat) cols[0] = saturate(cols[0], MAT[material].sat); // 塑膠：顏色飽和、不要灰霧
  return { p, cols, material };
}
function render(o, w, h, k) {
  const { p, cols, material } = resolve(o);
  const shape = TAPE_SHAPES.some((s) => s.id === o.shape) ? o.shape : 'strip', seed = (o.seed ?? 1) | 0;
  const layers = [];
  if (shape === 'double') { // 下層：選的花紋；上層：一小段素色（顏色 = 第二色，像參考圖 24 黃疊米色）
    const top = o.top || (p.kind === 'plain' ? cols[1] : cols[1] && lum(cols[1]) < 0.85 ? cols[1] : '#f2c230');
    layers.push({ lw: w * 0.97, lh: h * 0.64, cx: 0, cy: h * 0.17, rot: 0.012, shape: 'strip', kind: p.kind, cols, seed });
    layers.push({ lw: w * 0.52, lh: h * 0.42, cx: -w * 0.14, cy: -h * 0.26, rot: -0.035, shape: 'twist', kind: o.pattern2 ? tapeOf(o.pattern2).kind : 'plain', cols: [top, cols[0]], seed: seed + 101, matId: o.material2 });
  } else layers.push({ lw: w, lh: h, cx: 0, cy: 0, rot: 0, shape, kind: p.kind, cols, seed });
  const mg = h * 0.25, CW = ceil((w + 2 * mg) * k), CH = ceil((h + 2 * mg) * k);
  const out = newCanvas(CW, CH), g = out.getContext('2d');
  for (const L of layers) {
    L.matId = MAT[L.matId] ? L.matId : material;
    const mat = MAT[L.matId], R = renderLayer(L, k);
    const lift = shape === 'crumple' || shape === 'pinch' || L.shape === 'twist' ? 1.35 : 1;
    g.save();
    g.setTransform(k, 0, 0, k, CW / 2, CH / 2);
    g.translate(L.cx, L.cy); g.rotate(L.rot);
    g.shadowColor = `rgba(45,32,22,${(mat.shadow * lift).toFixed(3)})`;
    g.shadowBlur = L.lh * 0.07 * k * lift; g.shadowOffsetY = L.lh * 0.025 * k * lift; g.shadowOffsetX = L.lh * 0.008 * k;
    g.globalAlpha = mat.alpha * (p.alpha || 1);
    g.drawImage(R.c, -R.W / 2, -R.H / 2, R.W, R.H);
    g.restore();
  }
  return { c: out, W: CW / k, H: CH / k };
}
// drawTape(ctx, w, h, { shape, pattern, color, color2, material, seed })
//   以 (0,0) 為中心、寬 w 高 h。pattern：TAPE_PATTERNS 的 id（或物件）；color：底色；color2：花紋色（兩張疊貼時也是上層的顏色）
//   另外可選：pattern2（疊貼上層的花紋）、top（疊貼上層顏色）、material2（疊貼上層材質）
// 舊用法：drawTape(ctx, w, h, tapeDef, color, seed, material)
export function drawTape(ctx, w, h, a, color, seed, material) {
  let o;
  if (a && typeof a === 'object' && (a.id || a.kind) && !a.shape && !('color2' in a)) o = { shape: 'strip', pattern: a.id || a.kind, color: color || a.color, seed: seed ?? 1, material: material || 'washi' };
  else o = a || {};
  if (!(w > 0 && h > 0)) return;
  const m = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0 };
  let k = hypot(m.a, m.b) || 1;
  k = pow(2, round(Math.log2(k) * 4) / 4); // 分段，拖曳縮放時不會一直重畫
  k = min(k, 2400 / w, 1400 / h); k = max(k, 0.25);
  const key = [o.shape, typeof o.pattern === 'object' ? o.pattern?.id : o.pattern, o.color, o.color2, o.material, o.seed, o.pattern2, o.top, o.material2, round(w * 10), round(h * 10), k].join('|');
  let R = cache.get(key);
  if (R) { cache.delete(key); cache.set(key, R); } else {
    R = render(o, w, h, k);
    cache.set(key, R);
    if (cache.size > 48) cache.delete(cache.keys().next().value);
  }
  ctx.drawImage(R.c, -R.W / 2, -R.H / 2, R.W, R.H);
}
