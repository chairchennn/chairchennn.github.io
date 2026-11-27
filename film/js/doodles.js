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
    small: { cr_dotheart: 2, cr_sparkle: 1.5, cr_cross: 1.5, cr_flower4: 2, cr_candy: 1, cr_twinstar: 1 },
    medium: { cr_heart: 2, cr_flower5: 2, cr_bigstar: 1.5, cr_swirl: 0.4, cr_bow: 1, cr_butterfly: 1.5, cr_twinstar: 1.2 },
    large: { cr_bigstar: 1, cr_heart: 1, cr_flower5: 1 },
  },
  kitty: {
    name: '貓咪小魚', glow: 0, lw: 0.0034, label: '#ff9b5e',
    sizes: { small: [0.035, 0.05], medium: [0.08, 0.1], large: [0.14, 0.17] },
    small: { kt_blossom: 3, kt_blossom2: 2 },
    medium: { kt_cat: 2.5, kt_cat2: 1.5, kt_fish: 1.5, kt_yarn: 0.8, kt_paw: 0.8, kt_catsit: 1 },
    large: { kt_cat: 1, kt_cat2: 1, kt_catsit: 1, kt_peek: 0.8 },
    anchors: { kt_peek: 'bottom' }, // 探頭貓：不旋轉、貼齊照片底邊
    max: { kt_peek: 1 }, // 每張最多一隻
  },
  flora: {
    name: '花花世界', glow: 0, lw: 0.0034, label: '#f39552', largeExtra: 1, bleed: 0.3,
    sizes: { small: [0.06, 0.09], medium: [0.11, 0.16], large: [0.22, 0.3] },
    colors: ['#f39552', '#f4a2b8', '#f8b48a', '#6f9ed9', '#94d3bd'], recolor: 0.3, keepColor: ['fl_ginkgo'],
    small: { fl_star: 2, fl_blue: 2, kt_blossom2: 1, fl_round: 1 },
    medium: { fl_daisy: 2, fl_cosmos: 2, fl_round: 1.5, fl_tulip: 1, fl_ginkgo: 1.5 },
    large: { fl_sprig: 2, fl_bunch: 1.5, fl_fern: 1.2, fl_daisy: 1, fl_starbranch: 1.5 },
  },
  pastel: {
    name: '夢幻粉彩', glow: 0.5, lw: 0.0032, label: '#ffb7d0',
    sizes: { small: [0.035, 0.06], medium: [0.09, 0.13], large: [0.22, 0.3] },
    colors: ['#ffffff', '#ffb7d0', '#9fd8f5', '#c8b6ff', '#ffe08a', '#9ff0d0'],
    small: { pl_twinkle: 2.5, pl_star: 1.5, pl_daisy: 1, pl_dotarc: 1, pl_crosses: 2 },
    medium: { pl_flower: 2, pl_daisy: 1.5, pl_streak: 1.5, pl_dotarc: 1 },
    large: { pl_catjump: 2, pl_gradcat: 1.2, pl_catsit: 1.5, pl_flower: 1, pl_stripecat: 1.2 },
  },
  neoncat: {
    name: '螢光貓咪', glow: 1, lw: 0.007, label: '#46d2f0',
    fixed: { pl_catjump: ['#ffffff', '#ffd23c'] }, // 實心跳躍貓只用白／黃，配橘色條紋
    sizes: { small: [0.035, 0.06], medium: [0.09, 0.13], large: [0.22, 0.3] },
    colors: ['#ff8fc0', '#46d2f0', '#ffd23c', '#ff9a3c', '#ffffff', '#b48cff'], recolor: 0.8,
    small: { sparkle: 2, pl_twinkle: 1.5, pl_streak: 1.2, kt_blossom2: 1.4, zigzag: 0.6 },
    medium: { pl_catsit: 1.5, cat: 1.2, pl_flower: 1.5, pl_daisy: 1, kt_blossom2: 0.8, pl_streak: 0.8, nc_cathead: 1.5, nc_scratch: 1 },
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

// skip(id) = true 的圖案不選（例如已達每張上限、或這個排列不適合）
function pick(r, weights, used, skip = () => false) {
  let total = 0;
  const entries = Object.entries(weights).filter(([id]) => byId.has(id) && !skip(id)).map(([id, w]) => {
    const ww = w / (1 + (used.get(id) || 0) * 1.6);
    total += ww;
    return [id, ww];
  });
  if (!entries.length) return null;
  let t = r() * total;
  for (const [id, w] of entries) { if ((t -= w) <= 0) return id; }
  return entries[entries.length - 1][0];
}

function colorFor(r, def, pack) {
  if (pack.keepColor?.includes(def.id)) return def.color;
  const fixed = pack.fixed?.[def.id];
  if (fixed) return fixed[Math.floor(r() * fixed.length)];
  if (!pack.colors || !isRecolorable(def)) return def.color;
  return r() < (pack.recolor ?? 0.4) ? pack.colors[Math.floor(r() * pack.colors.length)] : def.color;
}

// aspect = 照片寬 / 高；datePos = 日期戳記的位置（'br' 右下 / 'bl' 左下 / null）
// 分兩步：①先當作沒有日期排好（所以開關日期時，大部分塗鴉位置不變）；
//         ②再把壓到日期那一角的塗鴉移到別處。
export function generateDoodles(o, aspect, datePos = null) {
  if (!o || o.preset === 'none') return [];
  const pack = PACKS[o.pack] || PACKS.cream;
  const fn = LAYOUT_FN[o.layout] || LAYOUT_FN.edge;
  const r = rng((o.seed || 1) * 7907 + 3);
  const sx = aspect >= 1 ? aspect : 1, sy = aspect >= 1 ? 1 : 1 / aspect;
  const scale = (o.scale || 100) / 100;
  const sizes = pack.sizes || SIZES;
  const count = Math.max(1, Math.round(o.count ?? 16));
  const placed = [], slots = [], used = new Map();
  let avoid = [];
  const hitsAvoid = (X, Y, rad) => avoid.some((q) => Math.hypot(X - Math.max(q.X0, Math.min(X, q.X1)), Y - Math.max(q.Y0, Math.min(Y, q.Y1))) < rad);

  // 「最佳候選」取樣：找幾個合格位置，挑離其他塗鴉最遠的 → 平均、留白
  const bleed = pack.bleed ?? 0.45;
  // tol：允許和別的塗鴉稍微重疊的比例（只在重新安置時用）
  const tryPlace = (size, region, rand = r, tol = 0, tries = 160) => {
    const rad = (size / 2) * 0.82;
    const mx = Math.min(0.45, (size * bleed) / sx), my = Math.min(0.45, (size * bleed) / sy);
    let best = null, bestGap = -Infinity, found = 0;
    for (let k = 0; k < tries && found < 12; k++) {
      const x = region ? region.x0 + rand() * (region.x1 - region.x0) : mx + rand() * (1 - 2 * mx);
      const y = region ? region.y0 + rand() * (region.y1 - region.y0) : my + rand() * (1 - 2 * my);
      if (!region && rand() > fn(x, y, sx, sy)) continue;
      const X = x * sx, Y = y * sy;
      if (hitsAvoid(X, Y, rad)) continue;
      let gap = Infinity;
      for (const q of placed) gap = Math.min(gap, Math.hypot(q.X - X, q.Y - Y) - q.rad - rad);
      if (gap < -tol * rad) continue;
      found++;
      if (gap > bestGap) { bestGap = gap; best = { x, y, X, Y }; }
    }
    if (!best) return null;
    const spot = { X: best.X, Y: best.Y, rad };
    placed.push(spot);
    return { x: best.x, y: best.y, spot };
  };
  // 探頭貓：只放左右兩側（0.02–0.32 或 0.68–0.98），一側放不下就試另一側
  const placeBottom = (size, vh, vw, rand = r, tol = 0) => {
    const yb = 1 - (size * (vh / vw)) / 2 / sy, half = size / 2 / sx;
    for (const left of rand() < 0.5 ? [true, false] : [false, true]) {
      const x0 = left ? 0.02 + half : 0.68 + half, x1 = left ? 0.32 - half : 0.98 - half;
      const pos = x1 >= x0 ? tryPlace(size, { x0, x1, y0: yb, y1: yb }, rand, tol) : null;
      if (pos) return pos;
    }
    return null;
  };

  // 文字（例如地名）
  const label = (o.label || '').trim();
  const LABEL_TOP = { x0: 0.3, x1: 0.7, y0: 0.08, y1: 0.16 };
  const LABEL_R = { x0: 0.55, x1: 0.78, y0: 0.8, y1: 0.88 }, LABEL_L = { x0: 0.22, x1: 0.45, y0: 0.8, y1: 0.88 };
  if (label) {
    const h = 0.075 * scale;
    const region = o.layout === 'top' ? LABEL_TOP : LABEL_R;
    const pos = tryPlace(h * 3, region);
    if (pos) {
      slots.push({ spot: pos.spot, size: h * 3, label: true,
        item: { kind: 'text', text: label, style: o.labelStyle || 'bubble', color: pack.label, x: pos.x, y: pos.y, size: h / 0.42, rot: (r() - 0.5) * 0.12, flip: false, glow: pack.glow } });
    }
  }

  // 大：1~5 個；中：約 35%；小：其餘
  const nLarge = Math.min(count, Math.max(1, Math.min(5, Math.round(count * 0.18))) + (pack.largeExtra || 0));
  const nMedium = Math.round((count - nLarge) * 0.35);
  const plan = [...Array(nLarge).fill('large'), ...Array(nMedium).fill('medium'), ...Array(count - nLarge - nMedium).fill('small')];
  for (const kind of plan) {
    // 放不下就換一個圖案再試（最多 3 次），不讓整格空掉
    const tried = new Set();
    for (let attempt = 0; attempt < 3; attempt++) {
      // 試過的、達到每張上限的不再選；「天空」排列不放貼齊底邊的探頭貓
      const skip = (cid) => tried.has(cid) || (pack.max?.[cid] && (used.get(cid) || 0) >= pack.max[cid]) ||
        (o.layout === 'top' && pack.anchors?.[cid] === 'bottom');
      const id = pick(r, pack[kind], used, skip);
      if (!id) break;
      const def = byId.get(id);
      const [lo, hi] = sizes[kind];
      const size = (lo + r() * (hi - lo)) * scale;
      const [vw, vh] = stickerBox(def);
      const anchor = pack.anchors?.[id];
      const pos = anchor === 'bottom' ? placeBottom(size, vh, vw) : tryPlace(size);
      if (!pos) { tried.add(id); continue; }
      used.set(id, (used.get(id) || 0) + 1);
      const loose = def.cat === 'flora' || vh / vw < 0.7;
      slots.push({ spot: pos.spot, size, anchor, vh, vw,
        item: {
          kind: 'svg', id, color: colorFor(r, def, pack), x: pos.x, y: pos.y, size,
          rot: anchor ? 0 : (r() - 0.5) * (loose ? 1.1 : 0.55), flip: r() < 0.35, lw: pack.lw, glow: pack.glow,
        } });
      break;
    }
  }

  // ② 日期那一角（以短邊為單位：約 0.42 寬、0.15 高）：壓到的塗鴉移到別處，其他不動
  if (datePos) {
    avoid = [{ X0: datePos === 'bl' ? 0 : sx - 0.42, X1: datePos === 'bl' ? 0.42 : sx, Y0: sy - 0.15, Y1: sy }];
    const r2 = rng((o.seed || 1) * 7907 + (datePos === 'bl' ? 29 : 17));
    for (const sl of slots) {
      if (!hitsAvoid(sl.spot.X, sl.spot.Y, sl.spot.rad)) continue;
      placed.splice(placed.indexOf(sl.spot), 1);
      // 依序放寬：原尺寸 → 縮小 15% → 允許稍微重疊（25%）
      let pos = null, k = 1;
      for (const [shrink, tol] of [[1, 0], [0.85, 0], [0.85, 0.25], [0.75, 0.4], [0.7, 0.6]]) {
        const size = sl.size * shrink;
        pos = sl.label ? tryPlace(size, o.layout === 'top' ? LABEL_TOP : datePos === 'br' ? LABEL_L : LABEL_R, r2, tol, 400)
          : sl.anchor === 'bottom' ? placeBottom(size, sl.vh, sl.vw, r2, tol) : tryPlace(size, undefined, r2, tol, 400);
        if (pos) { k = shrink; break; }
      }
      if (pos) {
        sl.spot = pos.spot; sl.item.x = pos.x; sl.item.y = pos.y;
        if (k !== 1) sl.item.size *= k;
      } else sl.drop = true;
    }
  }
  const items = slots.filter((sl) => !sl.drop).map((sl) => sl.item);
  // 畫的順序：大的在下、小的在上、文字最上面
  return items.sort((p, q) => (p.kind === 'text') - (q.kind === 'text') || q.size - p.size);
}
