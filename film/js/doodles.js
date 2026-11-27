// FilmDoodle — 塗鴉邊框
// 一鍵在照片四周撒滿手繪塗鴉，中間留給主角。
// 產生的每個塗鴉都跟一般貼圖同一種格式（x, y 是相對照片的位置，size 是相對短邊的大小），
// 所以可以「轉成貼圖」之後再個別移動、刪除。

import { rng } from './film.js';
import { STICKERS, stickerBox, isRecolorable } from './stickers.js';

// 排列方式：回傳 0~1 的「這裡適不適合放塗鴉」權重
export const LAYOUTS = [
  ['band', '上下'],
  ['edge', '四周'],
  ['top', '天空'],
  ['corner', '四角'],
  ['scatter', '散落'],
];
const smooth = (a, b, v) => (v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a));
const LAYOUT_FN = {
  band: (x, y) => Math.max(1 - smooth(0.24, 0.34, y), smooth(0.68, 0.78, y)),
  edge: (x, y, a) => {
    const d = Math.min(Math.min(x, 1 - x) * a, Math.min(y, 1 - y));
    return 1 - smooth(0.16, 0.26, d);
  },
  top: (x, y) => Math.max(1 - smooth(0.3, 0.42, y), 0.45 * smooth(0.84, 0.92, y)),
  corner: (x, y, a) => {
    let m = 0;
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) m = Math.max(m, 1 - smooth(0.26, 0.4, Math.hypot((x - cx) * a, y - cy)));
    return m;
  },
  scatter: (x, y, a) => 0.3 + 0.7 * Math.min(1, (Math.hypot((x - 0.5) * a, y - 0.5) / Math.hypot(a / 2, 0.5)) * 1.5),
};

// 配色
export const THEMES = [
  ['neon', '繽紛', ['#ff8fc0', '#ff5f6d', '#ff9a3c', '#ffd23c', '#6fdc7f', '#46d2f0', '#3f7bff', '#b48cff', '#ffffff']],
  ['pastel', '粉嫩', ['#ffb3d1', '#ff9ec7', '#c9b5ff', '#a8e6f5', '#fff1a8', '#ffd1b0', '#ffffff']],
  ['white', '白線', ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ff8fc0', '#ffd23c']],
  ['warm', '暖色', ['#ff9a3c', '#ffd23c', '#ff8fc0', '#ff5f6d', '#ffe7a3', '#ffffff']],
  ['cool', '冷色', ['#46d2f0', '#3f7bff', '#b48cff', '#a8e6f5', '#ffffff', '#8fe3c8']],
];

// 一鍵套用的組合
export const DOODLE_PRESETS = [
  { id: 'none', name: '無' },
  { id: 'pop', name: '繽紛上下', layout: 'band', theme: 'neon', density: 60 },
  { id: 'around', name: '四周圍繞', layout: 'edge', theme: 'neon', density: 60 },
  { id: 'sky', name: '天空塗鴉', layout: 'top', theme: 'neon', density: 55 },
  { id: 'sweet', name: '粉嫩圍繞', layout: 'edge', theme: 'pastel', density: 55 },
  { id: 'chalk', name: '白色線條', layout: 'band', theme: 'white', density: 55 },
  { id: 'sunny', name: '暖暖橘黃', layout: 'edge', theme: 'warm', density: 50 },
  { id: 'fresh', name: '藍色清爽', layout: 'band', theme: 'cool', density: 55 },
  { id: 'corner', name: '四角點綴', layout: 'corner', theme: 'neon', density: 55 },
  { id: 'confetti', name: '滿版散落', layout: 'scatter', theme: 'neon', density: 45 },
];

// 每種塗鴉的出場機率與大小（相對照片短邊）
const HERO = ['bear', 'bunny', 'puppy', 'heartbuddy', 'cloudface', 'cat', 'ghost'];
const POOLS = {
  filler: {
    size: [0.042, 0.072],
    items: { sparkle: 3, sparkles: 1.5, fstar: 2, ring: 1.5, wave: 2, zigzag: 2, cross: 1.4, lines: 1, hearto: 1.6, swirl: 1, exclaim: 0.5, dots: 0.5 },
  },
  character: {
    size: [0.1, 0.15],
    items: {
      sunny: 2, burst: 2, heart: 2, smiley: 1.4, star5: 1.5, flower: 2, cloudface: 1.5, boxface: 1.5, heartbuddy: 1.5,
      camera: 1.5, film: 1.5, ghost: 1, cat: 1, bear: 1, bunny: 1, puppy: 1, moon: 1, sun: 1, pin: 0.8, coffee: 0.6,
    },
  },
  accent: {
    size: [0.08, 0.12],
    items: {
      crown: 1, bolt: 1, note: 0.8, hearts: 1, heartline: 0.8, clover: 0.8, rainbow: 0.8, stripes: 1, pennant: 1.2,
      butterfly: 0.8, bow: 0.8, plane: 0.8, snail: 0.7, cherry: 0.6,
    },
  },
};
const byId = new Map(STICKERS.map((d) => [d.id, d]));

function pick(r, weights, used) {
  let total = 0;
  const entries = Object.entries(weights).map(([id, w]) => {
    const ww = w / (1 + (used.get(id) || 0) * 1.6);
    total += ww;
    return [id, ww];
  });
  let t = r() * total;
  for (const [id, w] of entries) { if ((t -= w) <= 0) return id; }
  return entries[entries.length - 1][0];
}

function colorFor(r, def, theme) {
  const t = THEMES.find((x) => x[0] === theme) || THEMES[0];
  if (!isRecolorable(def)) return def.color;
  if (theme === 'neon' && r() < 0.45) return def.color;
  return t[2][Math.floor(r() * t[2].length)];
}

// aspect = 照片寬 / 高
export function generateDoodles(o, aspect) {
  if (!o || !o.layout || o.preset === 'none') return [];
  const r = rng((o.seed || 1) * 7907 + 3);
  const fn = LAYOUT_FN[o.layout] || LAYOUT_FN.band;
  const a = aspect;
  // 以「短邊 = 1」為單位
  const sx = a >= 1 ? a : 1, sy = a >= 1 ? 1 : 1 / a;
  const scale = (o.scale || 100) / 100;
  // 可以放的面積比例
  let cover = 0;
  for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) cover += fn((i + 0.5) / 20, (j + 0.5) / 20, a);
  cover /= 400;
  const area = sx * sy * cover;
  const density = (o.density ?? 60) / 100;
  const n = Math.round((10 + density * 70) * area / (scale * scale) * 1.1);

  const placed = [], items = [], used = new Map();
  // 「最佳候選」取樣：每次找幾個合格位置，挑離別人最遠的，分布會比較平均
  const tryPlace = (size, weightPow = 1, region) => {
    const rad = (size / 2) * 0.8;
    let best = null, bestGap = -Infinity, found = 0;
    for (let k = 0; k < 120 && found < 10; k++) {
      const x = region ? region.x0 + r() * (region.x1 - region.x0) : -0.03 + r() * 1.06;
      const y = region ? region.y0 + r() * (region.y1 - region.y0) : -0.03 + r() * 1.06;
      const w = fn(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)), a);
      if (!region && r() > Math.pow(w, weightPow)) continue;
      const X = x * sx, Y = y * sy;
      let gap = Infinity;
      for (const p of placed) gap = Math.min(gap, Math.hypot(p.X - X, p.Y - Y) - p.rad - rad);
      if (gap < 0) continue;
      found++;
      if (gap > bestGap) { bestGap = gap; best = { x, y, X, Y }; }
    }
    if (!best) return null;
    placed.push({ X: best.X, Y: best.Y, rad });
    return { x: best.x, y: best.y };
  };

  // 文字（例如地名）先放，放在下方或上方
  const label = (o.label || '').trim();
  if (label) {
    const h = 0.085 * scale;
    const top = o.layout === 'top';
    const pos = tryPlace(h * 3.2, 1, top ? { x0: 0.25, x1: 0.75, y0: 0.08, y1: 0.18 } : { x0: 0.55, x1: 0.8, y0: 0.8, y1: 0.88 });
    if (pos) {
      const t = THEMES.find((x) => x[0] === o.theme) || THEMES[0];
      const col = o.theme === 'neon' ? '#46d2f0' : o.theme === 'white' ? '#ffffff' : t[2][0];
      items.push({ kind: 'text', text: label, style: o.labelStyle || 'bubble', color: col, x: pos.x, y: pos.y, size: h / 0.42, rot: (r() - 0.5) * 0.12, flip: false });
    }
  }

  // 1~2 個比較大的主角
  const heroes = density > 0.4 ? 2 : 1;
  for (let i = 0; i < heroes; i++) {
    const id = HERO[Math.floor(r() * HERO.length)];
    if (used.has(id)) continue;
    const size = (0.2 + r() * 0.06) * scale;
    const pos = tryPlace(size, 2);
    if (!pos) continue;
    used.set(id, 1);
    const def = byId.get(id);
    items.push({ kind: 'svg', id, color: colorFor(r, def, o.theme), x: pos.x, y: pos.y, size, rot: (r() - 0.5) * 0.5, flip: r() < 0.5, lw: 0.005 });
  }

  // 其他：角色 35%、點綴 20%、小填充 45%（先放大的，再用小的補空隙）
  const plan = [];
  for (let i = 0; i < n; i++) {
    const t = r();
    plan.push(t < 0.35 ? 'character' : t < 0.55 ? 'accent' : 'filler');
  }
  plan.sort((p, q) => POOLS[q].size[1] - POOLS[p].size[1]);
  for (const kind of plan) {
    const pool = POOLS[kind];
    const id = pick(r, pool.items, used);
    const def = byId.get(id);
    if (!def) continue;
    const size = (pool.size[0] + r() * (pool.size[1] - pool.size[0])) * scale;
    const pos = tryPlace(size, 1);
    if (!pos) continue;
    used.set(id, (used.get(id) || 0) + 1);
    const [vw, vh] = stickerBox(def);
    const flat = vh / vw < 0.7; // 線條類可以多轉一點
    items.push({
      kind: 'svg', id, color: colorFor(r, def, o.theme), x: pos.x, y: pos.y, size,
      rot: (r() - 0.5) * (flat ? 1.2 : 0.6), flip: r() < 0.3, lw: 0.005,
    });
  }
  // 畫的順序：大的先畫（在下面），小的後畫，文字最上面
  return items.sort((p, q) => (p.kind === 'text') - (q.kind === 'text') || q.size - p.size);
}
