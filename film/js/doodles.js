// FilmDoodle — 塗鴉框
// 一鍵在照片邊緣撒上手繪塗鴉，中間留給主角。
// 風格包（pack）決定「用哪些塗鴉、什麼顏色」，排列（layout）決定「放在哪裡」，
// 數量（count）就是實際要放幾個。產生的塗鴉跟一般貼圖同格式，可以「轉成貼圖」再個別調整。

import { rng } from './film.js';
import { STICKERS, stickerBox, isRecolorable } from './stickers.js';

// 排列：回傳 0~1，越大越適合放塗鴉。sx/sy = 寬/高 除以短邊（短邊 = 1）
export const LAYOUTS = [
  ['edge', '四周'], ['band', '上下'], ['sides', '左右'], ['corner', '四角'], ['top', '天空'],
];
const smooth = (a, b, v) => (v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a));
const LAYOUT_FN = {
  edge: (x, y, sx, sy) => 1 - smooth(0.12, 0.22, Math.min(Math.min(x, 1 - x) * sx, Math.min(y, 1 - y) * sy)),
  band: (x, y, sx, sy) => 1 - smooth(0.14, 0.24, Math.min(y, 1 - y) * sy),
  sides: (x, y, sx, sy) => Math.max(1 - smooth(0.15, 0.26, Math.min(x, 1 - x) * sx), 0.35 * (1 - smooth(0.08, 0.14, y * sy))),
  corner: (x, y, sx, sy) => {
    let m = 0;
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) m = Math.max(m, 1 - smooth(0.24, 0.4, Math.hypot((x - cx) * sx, (y - cy) * sy)));
    return m;
  },
  top: (x, y, sx, sy) => Math.max(1 - smooth(0.2, 0.32, y * sy), 0.3 * smooth(0.88, 0.94, y)),
};

const SIZES = { small: [0.035, 0.06], medium: [0.09, 0.13], large: [0.18, 0.26] };

// 風格包：每一包參考一種使用者提供的範例「風格」，圖案全部是原創
export const PACKS = {
  cream: {
    name: '奶油貼紙', glow: 0, lw: 0.0034, label: '#f7a8bb',
    colors: ['#f7a8bb', '#f49ab0', '#ffb5c5', '#f6b38f', '#f4b6a6'],
    small: { cr_dotheart: 2, cr_sparkle: 1.5, cr_cross: 1.5, cr_flower4: 2, cr_candy: 1 },
    medium: { cr_heart: 2, cr_flower5: 2, cr_bigstar: 1.5, cr_swirl: 1, cr_bow: 1 },
    large: { cr_bigstar: 1, cr_heart: 1, cr_flower5: 1 },
  },
  kitty: {
    name: '貓咪小魚', glow: 0, lw: 0.0034, label: '#ff9b5e',
    sizes: { small: [0.035, 0.05], medium: [0.08, 0.1], large: [0.14, 0.17] },
    small: { kt_blossom: 3, kt_blossom2: 2, kt_fish: 1.5 },
    medium: { kt_cat: 2.5, kt_cat2: 1.5, kt_fish: 1.5, kt_yarn: 0.8, kt_paw: 0.8 },
    large: { kt_cat: 1, kt_cat2: 1 },
  },
  flora: {
    name: '花花世界', glow: 0, lw: 0.0034, label: '#f39552', largeExtra: 1, bleed: 0.2,
    sizes: { small: [0.06, 0.09], medium: [0.11, 0.16], large: [0.22, 0.3] },
    colors: ['#f39552', '#f4a2b8', '#f8b48a', '#6f9ed9', '#94d3bd'], recolor: 0.3,
    small: { fl_star: 2, fl_blue: 2, kt_blossom2: 1, fl_round: 1 },
    medium: { fl_daisy: 2, fl_cosmos: 2, fl_round: 1.5, fl_tulip: 1 },
    large: { fl_sprig: 2, fl_bunch: 1.5, fl_fern: 1.2, fl_daisy: 1 },
  },
  pastel: {
    name: '夢幻粉彩', glow: 0.5, lw: 0.0032, label: '#ffb7d0',
    sizes: { small: [0.035, 0.06], medium: [0.09, 0.13], large: [0.22, 0.3] },
    colors: ['#ffffff', '#ffb7d0', '#9fd8f5', '#c8b6ff', '#ffe08a', '#9ff0d0'],
    small: { pl_twinkle: 2.5, pl_star: 1.5, pl_daisy: 1, pl_dotarc: 1 },
    medium: { pl_flower: 2, pl_daisy: 1.5, pl_streak: 1.5, pl_dotarc: 1 },
    large: { pl_catjump: 2, pl_gradcat: 1.2, pl_catsit: 1.5, pl_flower: 1 },
  },
  neoncat: {
    name: '螢光貓咪', glow: 1, lw: 0.007, label: '#46d2f0',
    sizes: { small: [0.035, 0.06], medium: [0.09, 0.13], large: [0.22, 0.3] },
    colors: ['#ff8fc0', '#46d2f0', '#ffd23c', '#ff9a3c', '#ffffff', '#b48cff'], recolor: 0.8,
    small: { sparkle: 2, pl_twinkle: 1.5, pl_streak: 1.2, kt_blossom2: 1.4, zigzag: 0.6 },
    medium: { pl_catsit: 1.5, cat: 1.2, pl_flower: 1.5, pl_daisy: 1, kt_blossom2: 0.8, pl_streak: 0.8 },
    large: { pl_catjump: 2, pl_catsit: 1 },
  },
  neon: {
    name: '螢光塗鴉', glow: 1, lw: 0.0045, label: '#46d2f0',
    colors: ['#ff8fc0', '#ff5f6d', '#ff9a3c', '#ffd23c', '#6fdc7f', '#46d2f0', '#3f7bff', '#b48cff', '#ffffff'], recolor: 0.55,
    small: { sparkle: 3, sparkles: 1.5, fstar: 2, ring: 1.5, wave: 2, zigzag: 2, cross: 1.4, lines: 0.4, hearto: 1.6 },
    medium: {
      sunny: 1.5, burst: 1.5, heart: 2, smiley: 1.4, star5: 1.5, flower: 2, cloudface: 1.5, heartbuddy: 1.5,
      camera: 1.5, film: 1.2, crown: 0.5, rainbow: 0.8, pennant: 0.4, stripes: 0.4, cat: 1, sun: 1,
    },
    large: { bear: 1, bunny: 1, puppy: 1, heartbuddy: 1, cloudface: 1 },
  },
};

// 一鍵套用（卡片）
export const DOODLE_PRESETS = [
  { id: 'none', name: '無' },
  { id: 'cream', name: '奶油貼紙', pack: 'cream', layout: 'band', count: 20 },
  { id: 'kitty', name: '貓咪小魚', pack: 'kitty', layout: 'band', count: 22 },
  { id: 'flora', name: '花花世界', pack: 'flora', layout: 'corner', count: 16 },
  { id: 'pastel', name: '夢幻粉彩', pack: 'pastel', layout: 'sides', count: 22 },
  { id: 'neoncat', name: '螢光貓咪', pack: 'neoncat', layout: 'edge', count: 16 },
  { id: 'neon', name: '螢光塗鴉', pack: 'neon', layout: 'band', count: 24 },
];
export const COUNT_MIN = 4, COUNT_MAX = 30;

const byId = new Map(STICKERS.map((d) => [d.id, d]));

function pick(r, weights, used) {
  let total = 0;
  const entries = Object.entries(weights).filter(([id]) => byId.has(id)).map(([id, w]) => {
    const ww = w / (1 + (used.get(id) || 0) * 1.6);
    total += ww;
    return [id, ww];
  });
  let t = r() * total;
  for (const [id, w] of entries) { if ((t -= w) <= 0) return id; }
  return entries[entries.length - 1][0];
}

function colorFor(r, def, pack) {
  if (!pack.colors || !isRecolorable(def)) return def.color;
  return r() < (pack.recolor ?? 0.4) ? pack.colors[Math.floor(r() * pack.colors.length)] : def.color;
}

// aspect = 照片寬 / 高
export function generateDoodles(o, aspect) {
  if (!o || o.preset === 'none') return [];
  const pack = PACKS[o.pack] || PACKS.cream;
  const fn = LAYOUT_FN[o.layout] || LAYOUT_FN.edge;
  const r = rng((o.seed || 1) * 7907 + 3);
  const sx = aspect >= 1 ? aspect : 1, sy = aspect >= 1 ? 1 : 1 / aspect;
  const scale = (o.scale || 100) / 100;
  const sizes = pack.sizes || SIZES;
  const count = Math.max(1, Math.round(o.count ?? 16));
  const placed = [], items = [], used = new Map();

  // 「最佳候選」取樣：找幾個合格位置，挑離其他塗鴉最遠的 → 平均、留白
  const bleed = pack.bleed ?? 0.45;
  const tryPlace = (size, region) => {
    const rad = (size / 2) * 0.82;
    const mx = Math.min(0.45, (size * bleed) / sx), my = Math.min(0.45, (size * bleed) / sy);
    let best = null, bestGap = -Infinity, found = 0;
    for (let k = 0; k < 160 && found < 12; k++) {
      const x = region ? region.x0 + r() * (region.x1 - region.x0) : mx + r() * (1 - 2 * mx);
      const y = region ? region.y0 + r() * (region.y1 - region.y0) : my + r() * (1 - 2 * my);
      if (!region && r() > fn(x, y, sx, sy)) continue;
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

  // 文字（例如地名）
  const label = (o.label || '').trim();
  if (label) {
    const h = 0.075 * scale;
    const region = o.layout === 'top' ? { x0: 0.3, x1: 0.7, y0: 0.08, y1: 0.16 } : { x0: 0.55, x1: 0.78, y0: 0.82, y1: 0.9 };
    const pos = tryPlace(h * 3, region);
    if (pos) items.push({ kind: 'text', text: label, style: o.labelStyle || 'bubble', color: pack.label, x: pos.x, y: pos.y, size: h / 0.42, rot: (r() - 0.5) * 0.12, flip: false, glow: pack.glow });
  }

  // 大：1~3 個；中：約 40%；小：其餘
  const nLarge = Math.min(count, Math.max(1, Math.min(5, Math.round(count * 0.18))) + (pack.largeExtra || 0));
  const nMedium = Math.round((count - nLarge) * 0.35);
  const plan = [...Array(nLarge).fill('large'), ...Array(nMedium).fill('medium'), ...Array(count - nLarge - nMedium).fill('small')];
  for (const kind of plan) {
    const id = pick(r, pack[kind], used);
    const def = byId.get(id);
    const [lo, hi] = sizes[kind];
    const size = (lo + r() * (hi - lo)) * scale;
    const pos = tryPlace(size);
    if (!pos) continue;
    used.set(id, (used.get(id) || 0) + 1);
    const [vw, vh] = stickerBox(def);
    const loose = def.cat === 'flora' || vh / vw < 0.7;
    items.push({
      kind: 'svg', id, color: colorFor(r, def, pack), x: pos.x, y: pos.y, size,
      rot: (r() - 0.5) * (loose ? 1.1 : 0.55), flip: r() < 0.35, lw: pack.lw, glow: pack.glow,
    });
  }
  // 畫的順序：大的在下、小的在上、文字最上面
  return items.sort((p, q) => (p.kind === 'text') - (q.kind === 'text') || q.size - p.size);
}
