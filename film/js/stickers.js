// FilmDoodle — 原創手繪風塗鴉貼圖
// 每個貼圖都是一組 SVG path（座標 0–100），用 Path2D 直接畫在 canvas 上，
// 放多大都不會糊。顏色 'M' 代表「主色」，使用者可以替換。

import { ART_FR_JP } from './art/fr_jp.js';
import { ART_Y2K_EMOJI } from './art/y2k_emoji.js';
import { ART_CRAYON } from './art/crayon.js';
import { drawCrayonDef } from './crayon.js';

export const PALETTE = [
  '#ff8fc0', // 粉紅
  '#ff5f6d', // 珊瑚紅
  '#ff9a3c', // 橘
  '#ffd23c', // 黃
  '#6fdc7f', // 綠
  '#46d2f0', // 青
  '#3f7bff', // 藍
  '#b48cff', // 紫
  '#ffffff', // 白
  '#2a2433', // 墨
];

const P = '#ff8fc0', R = '#ff5f6d', O = '#ff9a3c', Y = '#ffd23c', G = '#6fdc7f',
  C = '#46d2f0', B = '#3f7bff', L = '#b48cff', W = '#ffffff', K = '#2a2433', CH = '#ff9ec7';

const n = (v) => +v.toFixed(2);
const circ = (cx, cy, r) => `M${n(cx - r)} ${n(cy)}a${r} ${r} 0 1 0 ${n(r * 2)} 0a${r} ${r} 0 1 0 ${n(-r * 2)} 0Z`;
const ell = (cx, cy, rx, ry) => `M${n(cx - rx)} ${n(cy)}a${rx} ${ry} 0 1 0 ${n(rx * 2)} 0a${rx} ${ry} 0 1 0 ${n(-rx * 2)} 0Z`;

// part helpers: stroke / fill / fill+stroke
const s = (d, c = 'M', w = 4.5, a) => ({ d, s: c, w, a });
const f = (d, c = 'M', a) => ({ d, f: c, a });

function poly(pts, close = true) {
  return pts.map((p, i) => (i ? 'L' : 'M') + n(p[0]) + ' ' + n(p[1])).join('') + (close ? 'Z' : '');
}

function starPts(cx, cy, k, ro, ri, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < k * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / k;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts);
}

// 圓弧花瓣（scallop）外框
function scallop(cx, cy, k, rIn, rOut, rot = -Math.PI / 2, spread = 0.12) {
  const step = (Math.PI * 2) / k;
  let d = '';
  for (let i = 0; i < k; i++) {
    const a = rot + i * step, b = a + step;
    const p0 = [cx + rIn * Math.cos(a), cy + rIn * Math.sin(a)];
    const p1 = [cx + rIn * Math.cos(b), cy + rIn * Math.sin(b)];
    const c1 = [cx + rOut * Math.cos(a + step * spread), cy + rOut * Math.sin(a + step * spread)];
    const c2 = [cx + rOut * Math.cos(b - step * spread), cy + rOut * Math.sin(b - step * spread)];
    if (!i) d += `M${n(p0[0])} ${n(p0[1])}`;
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p1[0])} ${n(p1[1])}`;
  }
  return d + 'Z';
}

function sparkleD(cx, cy, r, pinch = 0.14) {
  const q = r * pinch;
  return `M${cx} ${cy - r}Q${n(cx + q)} ${n(cy - q)} ${cx + r} ${cy}Q${n(cx + q)} ${n(cy + q)} ${cx} ${cy + r}` +
    `Q${n(cx - q)} ${n(cy + q)} ${cx - r} ${cy}Q${n(cx - q)} ${n(cy - q)} ${cx} ${cy - r}Z`;
}

// 參數式愛心（可旋轉）
function heartD(cx, cy, size, rotDeg = 0) {
  const pts = [], rot = (rotDeg * Math.PI) / 180, k = size / 34;
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 2;
    pts.push([cx + k * (x * Math.cos(rot) - y * Math.sin(rot)), cy + k * (x * Math.sin(rot) + y * Math.cos(rot))]);
  }
  return poly(pts);
}

// 小圓（耳朵）在大圓（頭）外面那一段弧
function outsideArc(ex, ey, er, hx, hy, hr) {
  const dx = hx - ex, dy = hy - ey, d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const phi = Math.acos(Math.min(1, Math.max(-1, (d * d + er * er - hr * hr) / (2 * d * er))));
  const a1 = base + phi, a2 = base - phi + Math.PI * 2;
  const p1 = [ex + er * Math.cos(a1), ey + er * Math.sin(a1)];
  const p2 = [ex + er * Math.cos(a2), ey + er * Math.sin(a2)];
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M${n(p1[0])} ${n(p1[1])}A${er} ${er} 0 ${large} 1 ${n(p2[0])} ${n(p2[1])}`;
}

function spiralD(cx, cy, turns = 2.6, r0 = 2, r1 = 38) {
  const pts = [], steps = 90;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts, false);
}

function face(cx, cy, sz, c = 'M', { cheeks = true, mouth = 'smile', eye = 'dot' } = {}) {
  const e = sz * 0.075, dx = sz * 0.2, out = [];
  if (eye === 'dot') out.push(f(circ(cx - dx, cy, e), c), f(circ(cx + dx, cy, e), c));
  else out.push( // 閉眼 ^^
    s(`M${n(cx - dx - e * 1.4)} ${n(cy + e * 0.6)}q${n(e * 1.4)} ${n(-e * 2)} ${n(e * 2.8)} 0`, c, sz * 0.05),
    s(`M${n(cx + dx - e * 1.4)} ${n(cy + e * 0.6)}q${n(e * 1.4)} ${n(-e * 2)} ${n(e * 2.8)} 0`, c, sz * 0.05));
  if (mouth === 'smile') out.push(s(`M${n(cx - sz * 0.12)} ${n(cy + sz * 0.12)}Q${cx} ${n(cy + sz * 0.28)} ${n(cx + sz * 0.12)} ${n(cy + sz * 0.12)}`, c, sz * 0.05));
  if (mouth === 'open') out.push(f(`M${n(cx - sz * 0.11)} ${n(cy + sz * 0.1)}Q${cx} ${n(cy + sz * 0.36)} ${n(cx + sz * 0.11)} ${n(cy + sz * 0.1)}Z`, c));
  if (mouth === 'w') out.push(s(`M${n(cx - sz * 0.12)} ${n(cy + sz * 0.12)}q${n(sz * 0.06)} ${n(sz * 0.08)} ${n(sz * 0.12)} 0q${n(sz * 0.06)} ${n(sz * 0.08)} ${n(sz * 0.12)} 0`, c, sz * 0.045));
  if (cheeks) out.push(f(ell(cx - dx * 1.6, cy + sz * 0.11, sz * 0.075, sz * 0.045), CH, 0.9), f(ell(cx + dx * 1.6, cy + sz * 0.11, sz * 0.075, sz * 0.045), CH, 0.9));
  return out;
}

const rays = (cx, cy, r0, r1, k, c = 'M', w = 4.5, rot = 0) => {
  const out = [];
  for (let i = 0; i < k; i++) {
    const a = rot + (i * Math.PI * 2) / k;
    out.push(s(`M${n(cx + r0 * Math.cos(a))} ${n(cy + r0 * Math.sin(a))}L${n(cx + r1 * Math.cos(a))} ${n(cy + r1 * Math.sin(a))}`, c, w));
  }
  return out;
};

// ---------------------------------------------------------------------------
// 貼圖清單  cat: face 表情 / animal 動物 / travel 旅行 / deco 裝飾 / line 線條
// ---------------------------------------------------------------------------
export const STICKERS = [
  // 星芒、刺刺球：中間放小閃點（不放臉），避免空心像價格標籤
  { id: 'sunny', name: '星芒', cat: 'face', color: Y, parts: [s(starPts(50, 50, 10, 45, 33)), f(sparkleD(50, 50, 15, 0.2))] },
  { id: 'burst', name: '刺刺球', cat: 'face', color: C, parts: [s(starPts(50, 50, 14, 44, 36, -Math.PI / 2)), f(sparkleD(46, 54, 14, 0.2)), f(sparkleD(63, 36, 6.5, 0.2))] },
  {
    id: 'heart', name: '笑臉愛心', cat: 'face', color: P, parts: [
      s('M50 88C24 70 10 54 12 38C14 22 34 14 50 32C66 14 88 20 88 38C88 56 74 72 50 88Z'),
      ...face(50, 48, 48),
    ]
  },
  { id: 'smiley', name: '笑臉', cat: 'face', color: '#ffb020', parts: [s(circ(50, 50, 40)), ...face(50, 45, 64, 'M', { cheeks: true })] },
  { id: 'star5', name: '胖星星', cat: 'face', color: O, parts: [s(starPts(50, 54, 5, 46, 23)), ...face(50, 55, 38, 'M', { cheeks: false })] },
  {
    id: 'flower', name: '小花', cat: 'face', color: P, parts: [
      s('M50 70Q47 82 51 96', G), f('M50 84Q38 74 30 80Q38 90 50 84Z', G),
      s(scallop(50, 42, 6, 20, 46)), f(circ(50, 42, 14), Y), ...face(50, 41, 26, K, { cheeks: false }),
    ]
  },
  {
    id: 'sun', name: '太陽', cat: 'face', color: O, parts: [
      s(circ(50, 50, 23)), ...face(50, 47, 38), ...rays(50, 50, 32, 44, 10, 'M', 4.5, -Math.PI / 2),
    ]
  },
  {
    id: 'moon', name: '月亮', cat: 'face', color: Y, parts: [
      s('M46 14A38 38 0 1 0 82.84 61.34A30 30 0 1 1 46 14Z'),
      ...face(27, 50, 34, 'M', { eye: 'closed', cheeks: false }),
      s(sparkleD(82, 22, 9), 'M', 3.5),
    ]
  },
  {
    id: 'ghost', name: '小幽靈', cat: 'face', color: W, parts: [
      s('M24 88V44C24 22 36 12 50 12C64 12 76 22 76 44V88L67 80L59 88L50 80L41 88L33 80Z'),
      ...face(50, 44, 36),
    ]
  },
  {
    id: 'cloudface', name: '雲朵', cat: 'face', color: C, parts: [
      s('M24 74C8 74 6 52 22 50C20 32 40 26 48 38C54 22 78 24 78 42C94 40 96 70 78 74Z'),
      ...face(50, 55, 40, 'M'),
    ]
  },

  {
    id: 'heartbuddy', name: '愛心人', cat: 'face', color: R, parts: [
      s('M50 78C28 64 16 52 18 38C20 24 36 18 50 34C64 18 80 24 82 38C84 52 72 64 50 78Z'),
      ...face(50, 46, 40),
      s('M20 50Q10 50 6 40', 'M', 4), s('M80 50Q90 50 94 40', 'M', 4),
      s('M42 75L38 94', 'M', 4), s('M58 75L62 94', 'M', 4),
    ]
  },

  // 動物
  {
    id: 'puppy', name: '小狗', cat: 'animal', color: '#ffc27a', parts: [
      s(circ(50, 56, 28)),
      s('M27 40C14 30 6 46 10 62C12 70 21 68 24 60'), s('M73 40C86 30 94 46 90 62C88 70 79 68 76 60'),
      f(circ(40, 52, 3.4)), f(circ(60, 52, 3.4)), f(ell(50, 60, 5, 3.8), K),
      s('M44 66q3 4 6 0q3 4 6 0', 'M', 3), f(ell(32, 64, 4.5, 2.8), CH, 0.9), f(ell(68, 64, 4.5, 2.8), CH, 0.9),
    ]
  },
  {
    id: 'bear', name: '小熊', cat: 'animal', color: W, parts: [
      s(circ(50, 57, 30)),
      s(outsideArc(25, 31, 12, 50, 57, 30)), s(outsideArc(75, 31, 12, 50, 57, 30)),
      f(circ(24, 30, 5), P), f(circ(76, 30, 5), P),
      f(circ(39, 52, 3.2)), f(circ(61, 52, 3.2)),
      s(ell(50, 66, 11, 8), 'M', 3.5), f(ell(50, 62.5, 4.2, 3), P),
      s('M50 65.5V69', 'M', 3), f(ell(30, 63, 4.5, 2.8), CH, 0.9), f(ell(70, 63, 4.5, 2.8), CH, 0.9),
    ]
  },
  {
    id: 'bunny', name: '兔兔', cat: 'animal', color: W, parts: [
      s(circ(50, 64, 26)),
      s('M39.5 40.5C30 24 30 6 38 6C46 6 47 22 45.5 38.6'),
      s('M54.5 38.6C53 22 54 6 62 6C70 6 70 24 60.5 40.5'),
      s('M38.5 32C35 22 36 14 38.5 12', P, 3.5), s('M61.5 32C65 22 64 14 61.5 12', P, 3.5),
      ...face(50, 62, 32),
    ]
  },
  {
    id: 'cat', name: '貓咪', cat: 'animal', color: O, parts: [
      s('M20 36L22 12L40 26Q50 22 60 26L78 12L80 36Q90 52 84 68Q76 88 50 88Q24 88 16 68Q10 52 20 36Z'),
      f(circ(38, 52, 3.4)), f(circ(62, 52, 3.4)),
      f('M46.5 59H53.5L50 63Z', P),
      s('M43 65q3.5 4 7 0q3.5 4 7 0', 'M', 3),
      s('M30 60L14 57', 'M', 2.8), s('M30 65L15 67', 'M', 2.8), s('M70 60L86 57', 'M', 2.8), s('M70 65L85 67', 'M', 2.8),
    ]
  },
  {
    id: 'paw', name: '腳印', cat: 'animal', color: P, parts: [
      f('M50 50C64 50 74 64 72 74C70 84 60 84 50 80C40 84 30 84 28 74C26 64 36 50 50 50Z'),
      f(ell(24, 44, 8, 10)), f(ell(40, 28, 8, 10.5)), f(ell(60, 28, 8, 10.5)), f(ell(76, 44, 8, 10)),
    ]
  },
  {
    id: 'snail', name: '蝸牛', cat: 'animal', color: P, parts: [
      f('M10 84Q6 62 18 54Q30 50 32 66L34 76H84Q94 76 92 84Q90 90 82 90H18Q11 90 10 84Z'),
      s('M16 56L10 40', K, 3), s('M24 54L26 38', K, 3), f(circ(10, 39, 3.5), K), f(circ(26, 37, 3.5), K),
      f(circ(16, 66, 2.4), K), f(circ(25, 66, 2.4), K), s('M17 72q4 4 8 0', K, 2.5),
      f(circ(62, 52, 25), '#ffd7a8'), s(circ(62, 52, 25), O, 4.5),
      s(spiralD(62, 52, 2.2, 1, 17), O, 4),
    ]
  },
  {
    id: 'butterfly', name: '蝴蝶', cat: 'animal', color: L, parts: [
      s('M48 46C40 18 10 12 10 32C10 48 32 52 48 48Z'), s('M52 46C60 18 90 12 90 32C90 48 68 52 52 48Z'),
      s('M48 54C32 56 16 70 24 82C32 92 46 74 48 54Z'), s('M52 54C68 56 84 70 76 82C68 92 54 74 52 54Z'),
      s('M50 36V76', 'M', 6), s('M49 36Q44 22 36 18', 'M', 3), s('M51 36Q56 22 64 18', 'M', 3),
      f(circ(36, 18, 3)), f(circ(64, 18, 3)),
    ]
  },

  // 旅行
  {
    id: 'camera', name: '相機', cat: 'travel', color: B, parts: [
      s('M30 34L36 24H56L62 34'), s('M74 34V29H84V34'),
      s('M12 34H88Q94 34 94 40V78Q94 84 88 84H12Q6 84 6 78V40Q6 34 12 34Z'),
      s(circ(50, 59, 17), C), f(circ(50, 59, 9)), f(circ(46.5, 55.5, 3), W),
      s('M14 44H24', 'M', 4),
    ]
  },
  {
    // 底片罐＋拉出來的片頭（無臉）
    id: 'film', name: '底片罐', cat: 'travel', color: O, parts: [
      s('M36 22V13H48V22', 'M', 4),
      s('M22 22H62V30H22Z', 'M', 4),
      s('M24 30H60V80Q60 86 54 86H30Q24 86 24 80Z'),
      s('M24 46H60M24 70H60', 'M', 3),
      s('M60 40H86L94 48V72H60', 'M', 4),
      ...[66, 77].map((x) => f(`M${x} 44h6v5h-6z`)),
      ...[66, 77].map((x) => f(`M${x} 63h6v5h-6z`)),
    ]
  },
  {
    id: 'plane', name: '紙飛機', cat: 'travel', color: W, parts: [
      s('M12 48L90 16L64 82L50 58Z'), s('M90 16L50 58L48 74L58 66'),
      s('M38 66l-7 4', 'M', 4), s('M25 74l-7 3', 'M', 4), s('M12 80l-6 1', 'M', 4),
    ]
  },
  {
    id: 'pin', name: '地標', cat: 'travel', color: R, parts: [
      s('M50 92C50 92 20 62 20 40C20 22 34 10 50 10C66 10 80 22 80 40C80 62 50 92 50 92Z'),
      ...face(50, 38, 44),
    ]
  },
  {
    id: 'coffee', name: '咖啡', cat: 'travel', color: O, parts: [
      s('M20 40H74V62Q74 84 52 84H42Q20 84 20 62Z'), s('M74 48Q90 46 88 60Q86 70 74 68'),
      s('M38 30q-6 -7 0 -13q6 -6 0 -12', 'M', 3.5), s('M54 30q-6 -7 0 -13q6 -6 0 -12', 'M', 3.5),
      ...face(47, 56, 38),
    ]
  },
  {
    id: 'palm', name: '椰子樹', cat: 'travel', color: G, parts: [
      s('M50 94Q46 72 52 44', '#d79a62', 6.5),
      s('M52 44Q38 28 14 36'), s('M52 44Q42 20 26 14'), s('M52 44Q60 20 78 16'), s('M52 44Q70 30 90 40'), s('M52 44Q54 24 50 8'),
      f(circ(46, 50, 5), '#b9773f'), f(circ(57, 51, 5), '#b9773f'),
    ]
  },
  {
    id: 'icecream', name: '冰淇淋', cat: 'travel', color: P, parts: [
      f('M32 52L50 94L68 52Z', '#ffcf87'), s('M32 52L50 94L68 52Z', O, 3.5),
      s('M38 60L60 72', O, 2.5), s('M62 60L42 78', O, 2.5),
      f('M28 54C20 30 38 14 50 16C62 14 80 30 72 54Q61 60 50 54Q39 60 28 54Z'),
      f(circ(50, 12, 5.5), R), s('M50 7Q52 2 56 1', G, 2.5),
      ...face(50, 38, 26, K, { cheeks: false }),
    ]
  },
  {
    id: 'cherry', name: '櫻桃', cat: 'travel', color: R, parts: [
      s('M33 60Q40 34 62 16', G, 4), s('M67 62Q64 40 62 16', G, 4), f('M62 16Q76 4 88 16Q74 26 62 16Z', G),
      f(circ(31, 72, 15)), f(circ(68, 74, 15)), f(ell(25, 66, 4, 3), W, 0.85), f(ell(62, 68, 4, 3), W, 0.85),
    ]
  },

  // 裝飾
  { id: 'sparkle', name: '閃閃', cat: 'deco', color: Y, parts: [s(sparkleD(50, 50, 42))] },
  { id: 'sparkles', name: '閃閃群', cat: 'deco', color: Y, parts: [s(sparkleD(40, 58, 32)), s(sparkleD(80, 20, 13), 'M', 4), f(circ(78, 70, 4))] },
  { id: 'crown', name: '皇冠', cat: 'deco', color: Y, parts: [s('M16 78L10 32L32 52L50 24L68 52L90 32L84 78Z'), s('M18 66H82', 'M', 4), f(circ(10, 28, 4.5), P), f(circ(50, 19, 4.5), P), f(circ(90, 28, 4.5), P)] },
  { id: 'bolt', name: '閃電', cat: 'deco', color: Y, parts: [s('M58 6L22 54H46L40 94L78 42H54Z')] },
  { id: 'bow', name: '蝴蝶結', cat: 'deco', color: P, parts: [s('M50 48C36 26 12 28 12 44C12 62 36 62 50 48Z'), s('M50 48C64 26 88 28 88 44C88 62 64 62 50 48Z'), f(circ(50, 48, 7)), s('M46 54L34 82'), s('M54 54L66 82')] },
  { id: 'note', name: '音符', cat: 'deco', color: B, parts: [s('M36 74V26L76 16V66', 'M', 5), s('M36 36L76 26', 'M', 5), f(ell(28, 74, 10, 7.5)), f(ell(68, 66, 10, 7.5))] },
  { id: 'hearts', name: '小愛心', cat: 'deco', color: P, parts: [f(heartD(38, 58, 46, -14)), f(heartD(76, 28, 24, 16), R), f(heartD(80, 76, 16, 10))] },
  { id: 'heartline', name: '愛心框', cat: 'deco', color: R, parts: [s(heartD(50, 52, 78)), s(heartD(50, 52, 56), 'M', 3)] },
  { id: 'clover', name: '幸運草', cat: 'deco', color: G, parts: [...[0, 90, 180, 270].map((r) => s(heartD(50 + 17 * Math.sin((r * Math.PI) / 180), 44 - 17 * Math.cos((r * Math.PI) / 180), 32, r))), s('M50 46Q58 74 52 96')] },
  {
    id: 'rainbow', name: '彩虹', cat: 'deco', color: R, parts: [
      s('M12 76A38 38 0 0 1 88 76', 'M', 6.5), s('M23 76A27 27 0 0 1 77 76', Y, 6.5), s('M34 76A16 16 0 0 1 66 76', C, 6.5),
      f('M4 84q0 -10 10 -9q4 -8 13 -3q9 -1 8 9q0 5 -6 5h-20q-5 0 -5 -2z', W), f('M65 84q0 -10 10 -9q4 -8 13 -3q9 -1 8 9q0 5 -6 5h-20q-5 0 -5 -2z', W),
    ]
  },
  { id: 'fstar', name: '小星星', cat: 'deco', color: Y, parts: [f(starPts(50, 53, 5, 44, 21)), s(starPts(50, 53, 5, 44, 21), 'M', 5)] },
  { id: 'hearto', name: '愛心', cat: 'deco', color: P, parts: [s(heartD(50, 52, 76), 'M', 5)] },
  { id: 'pennant', name: '小旗子', cat: 'deco', color: C, parts: [f('M14 30L86 48L18 72Z', 'M', 0.9), s('M14 30L86 48L18 72Z', 'M', 5), s('M28 44L58 48', W, 3.5, 0.8)] },
  {
    id: 'stripes', name: '彩色膠帶', cat: 'deco', color: P, vb: [100, 40], parts: [
      ...[['M', 6], [O, 20.7], [Y, 35.4], [G, 50.1], [C, 64.8], [L, 79.5]].map(([c, x]) => f(`M${x} 8h14.7v24h-14.7z`, c, 0.88)),
      s('M6 8H94V32H6Z', W, 1.6, 0.6),
    ]
  },
  {
    id: 'tape', name: '紙膠帶', cat: 'deco', color: '#ffb3d1', vb: [100, 40], parts: [
      f('M3 6L9 10L3 14L9 18L3 22L9 26L3 30L9 34H97L91 30L97 26L91 22L97 18L91 14L97 10L91 6Z', 'M', 0.88),
      ...[18, 34, 50, 66, 82].map((x) => f(circ(x, 14, 3), W, 0.7)), ...[26, 42, 58, 74].map((x) => f(circ(x, 26, 3), W, 0.7)),
    ]
  },
  {
    id: 'tape2', name: '格子膠帶', cat: 'deco', color: '#8fe3c8', vb: [100, 40], parts: [
      f('M4 6L9 10L4 14L9 18L4 22L9 26L4 30L9 34H96L91 30L96 26L91 22L96 18L91 14L96 10L91 6Z', 'M', 0.85),
      s('M9 14H91M9 26H91', W, 1.6, 0.75), s('M22 6V34M38 6V34M54 6V34M70 6V34M84 6V34', W, 1.6, 0.75),
    ]
  },

  // 線條
  { id: 'zigzag', name: '鋸齒', cat: 'line', color: C, vb: [100, 50], parts: [s('M6 37L20 13L34 37L48 13L62 37L76 13L90 37', 'M', 5)] },
  { id: 'wave', name: '波浪', cat: 'line', color: P, vb: [100, 50], parts: [s('M6 25q11 -18 22 0t22 0t22 0t22 0', 'M', 5)] },
  { id: 'swirl', name: '漩渦', cat: 'line', color: P, parts: [s(spiralD(50, 50, 2.6, 2, 40), 'M', 4.5)] },
  { id: 'loop', name: '圈起來', cat: 'line', color: R, parts: [s('M20 52C18 26 80 20 86 44C92 70 30 84 16 62C10 52 28 32 62 28', 'M', 4)] },
  { id: 'arrow', name: '箭頭', cat: 'line', color: W, parts: [s('M8 72C28 76 34 42 52 46C66 50 56 68 46 60C36 52 54 30 88 34'), s('M76 24L89 34L78 46')] },
  { id: 'exclaim', name: '驚嘆號', cat: 'line', color: Y, parts: [s('M34 12L39 62', 'M', 8), f(circ(40, 82, 6)), s('M66 12L61 62', 'M', 8), f(circ(60, 82, 6))] },
  { id: 'underline', name: '底線', cat: 'line', color: Y, vb: [100, 40], parts: [s('M6 16Q50 8 94 14', 'M', 5), s('M14 28Q52 22 86 27', 'M', 4)] },
  { id: 'dots', name: '點點', cat: 'line', color: C, vb: [100, 40], parts: [f(circ(16, 20, 7)), f(circ(40, 20, 7), P), f(circ(64, 20, 7), Y), f(circ(88, 20, 7), G)] },
  { id: 'ring', name: '小圈圈', cat: 'line', color: P, parts: [s(circ(50, 50, 32), 'M', 7)] },
  { id: 'cross', name: '叉叉', cat: 'line', color: P, parts: [s('M28 28L72 72M72 28L28 72', 'M', 7)] },
  { id: 'lines', name: '速度線', cat: 'line', color: C, vb: [100, 60], parts: [s('M20 14H80', 'M', 6), s('M10 30H90', 'M', 6), s('M24 46H76', 'M', 6)] },
];


// ===========================================================================
// 可愛系列（2026-11 第二版）：參考使用者提供的五種「風格」原創繪製，不複製任何現有角色
//   cream  奶油白貼紙：白色填色＋細粉色描邊＋粉紅小細節
//   kitty  貓咪小魚：白臉小貓（原創）、橘色小魚、小白花
//   flora  扁平花草：無描邊的扁平花朵、枝葉
//   pastel 粉彩線條：細線條小貓、長莖小花、閃光、點點弧線
// ===========================================================================
const CREAM = '#fffaf2', CR_LINE = '#e6abb4', CR_PINK = '#f7a8bb';
const KT_LINE = '#3d3332', KT_OR = '#ff9b5e';

function petalD(cx, cy, r0, L, w, ang) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const P = (x, y) => `${n(cx + x * c - y * sn)} ${n(cy + x * sn + y * c)}`;
  const m = r0 + (L - r0) * 0.3;
  return `M${P(r0, 0)}C${P(m, -w)} ${P(L, -w * 0.6)} ${P(L, 0)}C${P(L, w * 0.6)} ${P(m, w)} ${P(r0, 0)}Z`;
}
function notchPetalD(cx, cy, r0, L, w, ang) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const P = (x, y) => `${n(cx + x * c - y * sn)} ${n(cy + x * sn + y * c)}`;
  return `M${P(r0, 0)}C${P(r0 + (L - r0) * 0.35, -w)} ${P(L * 0.97, -w)} ${P(L, -w * 0.38)}L${P(L * 0.9, 0)}L${P(L, w * 0.38)}` +
    `C${P(L * 0.97, w)} ${P(r0 + (L - r0) * 0.35, w)} ${P(r0, 0)}Z`;
}
// 軟角星：每隻角兩側用往外鼓的 Q 曲線，角長可不一（手撕閃光感）
function softStar(cx, cy, radii, ri, rot = -Math.PI / 2) {
  const k = radii.length, h = Math.PI / k, at = (r, a) => `${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`;
  let d = '';
  radii.forEach((r, i) => {
    const a = rot + i * 2 * h;
    if (!i) d += `M${at(ri, a - h)}`;
    d += `Q${at(ri * 1.35, a - h * 0.45)} ${at(r, a)}Q${at(ri * 1.35, a + h * 0.45)} ${at(ri, a + h)}`;
  });
  return d + 'Z';
}
function ringOf(cx, cy, k, dist, r) {
  let d = '';
  for (let i = 0; i < k; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / k; d += circ(cx + dist * Math.cos(a), cy + dist * Math.sin(a), r); }
  return d;
}
// 白臉小貓（第五版去寫實）：下寬上窄的麻糬臉＋短耳，臉的中心約在 (50,62)
const CAT_HEAD = 'M50 30C56.44 30 61.96 31 66.56 33Q70.24 23 73.92 19Q77.6 16 78.98 21Q80.36 29 79.44 38C84.04 47 85.88 58 84.04 67C81.28 80 68.4 86 50 86C31.6 86 18.72 80 15.96 67C14.12 58 15.96 47 20.56 38Q19.64 29 21.02 21Q22.4 16 26.08 19Q29.76 23 33.44 33C38.04 31 43.56 30 50 30Z';
// 跳躍的小貓（閉合身體，可填色）：大頭（約佔身長 1/3）＋兩個三角耳，臉朝正面
const CAT_JUMP = 'M30 22C42 17 54 17 62 20L65 7Q70 9 74 14Q80 12 86 14L87 6Q93 12 93 22C94 30 90 36 84 39' +
  'C88 42 94 44 96 47C98 51 94 53 90 52C84 51 76 48 70 45C58 48 44 49 34 45C26 48 18 52 12 54C6 56 4 51 8 49C14 46 20 42 22 38C18 32 22 25 30 22Z';
const CAT_JUMP_FACE = (eye, blush) => [
  f(circ(76, 27, 2.1), eye), f(circ(86, 27, 2.1), eye), s('M79.5 31.5q1.5 2 3 0', eye, 1.6),
  f(ell(72.5, 32, 2.6, 1.6), blush, 0.9), f(ell(89, 32, 2.2, 1.5), blush, 0.9),
];
const X4 = [45, 135, 225, 315].map((a) => petalD(50, 50, 2, 44, 24, (a * Math.PI) / 180)).join('');
const STAR8 = softStar(50, 50, [46, 30, 42, 28, 46, 32, 40, 28], 17, -Math.PI / 2 + 0.12);
const CANDY = 'M36 22H64Q80 22 80 38V62Q80 78 64 78H36Q20 78 20 62V38Q20 22 36 22Z';
const CANDY_IN = 'M38 31H62Q71 31 71 40V60Q71 69 62 69H38Q29 69 29 60V40Q29 31 38 31Z';
const FISH = 'M8 30C8 18 22 12 36 12C50 12 60 20 64 28L80 16Q88 14 88 22L84 30L88 38Q88 46 80 44L64 32C60 40 50 48 36 48C22 48 8 42 8 30Z';
const TULIP = 'M30 30Q28 56 50 60Q72 56 70 30Q62 32 58 40Q58 26 50 20Q42 26 42 40Q38 32 30 30Z';
// 繖形花：細莖從一點放射，末端圓珠
const UMBEL = [-2.5, -2.1, -1.8, -1.5, -1.2, -0.85].map((a, i) => [a, [52, 62, 68, 70, 64, 54][i]]);

// ---- 第三版新增用的小工具 ----
// 只含絕對座標（M/L/Q/C）的 path：縮放 k 後平移
const fit = (d, k, dx, dy) => d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (_, x, y) => `${n(+x * k + dx)} ${n(+y * k + dy)}`);
// 左右對稱：fn(X) 用 X(x) 產生一側的 path，回傳左右兩側
const mirror = (fn) => fn((x) => n(x)) + fn((x) => n(100 - x));
// 白臉小貓系列的臉（第五版）：點點眼＋小 ω 嘴＋腮紅，不畫鼻子、內耳、條紋。
// 以 kt_cat 為準（臉中心 50,60），搬到 (cx,cy)、比例 k；eyes: 'dot' 點點眼 / 'shut' 瞇眼
function ktFace(cx, cy, k, { eyes = 'dot', whisk = false, blush = true } = {}) {
  const X = (x) => n(cx + (x - 50) * k), Y = (y) => n(cy + (y - 60) * k), q = (v) => n(v * k);
  const out = [];
  if (blush) out.push(f(ell(X(27), Y(67), q(6), q(3.6)), CH, 0.9), f(ell(X(73), Y(67), q(6), q(3.6)), CH, 0.9));
  if (eyes === 'dot') out.push(f(circ(X(37), Y(59), q(3.6)), KT_LINE), f(circ(X(63), Y(59), q(3.6)), KT_LINE));
  else out.push(s(`M${X(32)} ${Y(60)}q${q(5)} ${q(-5.5)} ${q(10)} 0M${X(58)} ${Y(60)}q${q(5)} ${q(-5.5)} ${q(10)} 0`, KT_LINE, 2.8));
  out.push(s(`M${X(45)} ${Y(64)}q${q(2.5)} ${q(3.2)} ${q(5)} 0q${q(2.5)} ${q(3.2)} ${q(5)} 0`, KT_LINE, 2.5));
  // 鬍鬚：左右各一條短線
  if (whisk) out.push(s(`M${X(4)} ${Y(61)}L${X(17)} ${Y(63)}M${X(96)} ${Y(61)}L${X(83)} ${Y(63)}`, KT_LINE, 2.4));
  return out;
}
// ✢ 圓頭十字：四片「中心尖、末端圓」的水滴
function crossD(cx, cy, L, re, rot = 0) {
  const d0 = L - re, th = Math.asin(re / d0), t = Math.sqrt(d0 * d0 - re * re);
  let d = '';
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2;
    const p1 = [cx + t * Math.cos(a - th), cy + t * Math.sin(a - th)], p2 = [cx + t * Math.cos(a + th), cy + t * Math.sin(a + th)];
    d += `M${n(cx)} ${n(cy)}L${n(p1[0])} ${n(p1[1])}A${re} ${re} 0 1 1 ${n(p2[0])} ${n(p2[1])}Z`;
  }
  return d;
}
// 圓 (bx,by,br) 裡、以 (cx,cy) 為圓心半徑 R 的那段弧（兩端各縮 pad 弧度）
function arcInside(cx, cy, R, bx, by, br, pad = 0.06) {
  const dx = bx - cx, dy = by - cy, d = Math.hypot(dx, dy), base = Math.atan2(dy, dx);
  const phi = Math.acos(Math.min(1, Math.max(-1, (d * d + R * R - br * br) / (2 * d * R))));
  const a1 = base - phi + pad, a2 = base + phi - pad;
  return `M${n(cx + R * Math.cos(a1))} ${n(cy + R * Math.sin(a1))}A${R} ${R} 0 0 1 ${n(cx + R * Math.cos(a2))} ${n(cy + R * Math.sin(a2))}`;
}
const BFLY_UP = mirror((X) => `M${X(48)} 48C${X(42)} 26 ${X(14)} 18 ${X(10)} 33C${X(7)} 46 ${X(24)} 56 ${X(48)} 54Z`);
const BFLY_LO = mirror((X) => `M${X(48)} 58C${X(32)} 58 ${X(18)} 68 ${X(22)} 80C${X(26)} 91 ${X(44)} 84 ${X(48)} 62Z`);
const BFLY_IN = mirror((X) => `M${X(34)} 33C${X(27)} 29 ${X(19)} 29 ${X(17.5)} 35C${X(16.5)} 40 ${X(20)} 44 ${X(25)} 46M${X(39)} 66C${X(33)} 67 ${X(29)} 71 ${X(30.5)} 76`);
const TWIN_BIG = sparkleD(46, 54, 38, 0.24), TWIN_SM = sparkleD(70, 28, 18, 0.24);
const BOW_TAIL = mirror((X) => `M${X(47)} 50L${X(31)} 82L${X(37.5)} 79L${X(41)} 86L${X(55)} 54Z`);
const BOW_LOOP = mirror((X) => `M${X(50)} 48C${X(36)} 24 ${X(10)} 28 ${X(12)} 46C${X(14)} 64 ${X(36)} 62 ${X(50)} 48Z`);
// 坐著的白臉小貓：大頭（沿用 kt_cat 輪廓縮小）＋短短的豆子身體
const SIT_K = 0.7, SIT_DX = 47 - 50 * SIT_K, SIT_DY = 9 - 16 * SIT_K;
const SIT_HEAD = fit(CAT_HEAD, SIT_K, SIT_DX, SIT_DY);
const SIT_BODY = 'M31 53C22 64 20 79 25 86Q29 91 40 91H54Q65 91 69 86C74 79 72 64 63 53Z';
const SIT_TAIL = 'M67 84C80 88 89 79 85 68';
// 趴在照片下緣探頭的小貓：底邊是平的（不描邊），只露出頭和兩隻前爪
const PEEK_HEAD = 'M16.8 64Q16.2 61 15.96 58C14.12 49 15.96 38 20.56 29Q19.64 20 21.02 12Q22.4 7 26.08 10Q29.76 14 33.44 24C38.04 22 43.56 21 50 21C56.44 21 61.96 22 66.56 24Q70.24 14 73.92 10Q77.6 7 78.98 12Q80.36 20 79.44 29C84.04 38 85.88 49 84.04 58Q83.8 61 83.2 64';
const PEEK_PAW = mirror((X) => `M${X(13)} 64Q${X(13)} 56.5 ${X(21.5)} 56.5Q${X(30)} 56.5 ${X(30)} 64`);
// 趴著的線條貓（一筆外框）：頭在左、前爪收在下巴下、尾巴繞到前面
const LOAF = 'M10 40Q8 30 12.5 23L11 10L21.5 17Q27 15 33 17L43 9.5L43.5 24C52 22 62 21 72 22C86 23 94 32 93 45' +
  'C92.5 53 88 58 80 58H41Q41 61.5 36 61.5H22Q15.5 61.5 16 57Q10 51 10 40Z';
// 線條貓頭（螢光貓咪包）：圓耳、麻糬臉，線條平順對稱
const NC_HEAD = 'M15 56C13 43 16 31 20 22Q23 14 30 18L40 25.5Q50 22.5 60 25.5L70 18Q77 14 80 22C84 31 87 43 85 56C83 72 70 81 50 81C30 81 17 72 15 56Z';
// 銀杏葉：扇形、上緣微波浪、中間一道缺口
const GINKGO = (() => {
  const cx = 50, cy = 72, R = 48, A = 1.02, pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = -A + (2 * A * i) / 40, wob = 1.6 * Math.sin(i * Math.PI / 5), notch = Math.max(0, 1 - Math.abs(t) / 0.12) * 11;
    pts.push([cx + (R + wob - notch) * Math.sin(t), cy - (R + wob - notch) * Math.cos(t)]);
  }
  const L = pts[0], Rt = pts[pts.length - 1];
  return `M${cx} ${cy}Q${n(cx - 16)} ${cy - 6} ${n(L[0])} ${n(L[1])}` + pts.slice(1).map((p) => `L${n(p[0])} ${n(p[1])}`).join('') +
    `Q${n(cx + 16)} ${cy - 6} ${cx} ${cy}Z`;
})();

const CUTE = [
  // ---------- cream 奶油白 ----------
  { id: 'cr_heart', name: '奶油愛心', cat: 'cream', color: CR_PINK, parts: [f(heartD(50, 53, 84), CREAM), s(heartD(50, 53, 84), CR_LINE, 3.5), f(heartD(50, 53, 40)), f(ell(42, 44, 4, 2.6), '#ffffff', 0.9)] },
  { id: 'cr_dotheart', name: '粉紅小心', cat: 'cream', color: CR_PINK, parts: [s(heartD(50, 53, 70), CREAM, 9), f(heartD(50, 53, 70)), f(ell(38, 42, 5, 3.2), '#ffffff', 0.85)] },
  { id: 'cr_flower4', name: '奶油四瓣', cat: 'cream', color: CR_PINK, parts: [f(scallop(50, 50, 4, 12, 58, -Math.PI / 2, 0.02), CREAM), s(scallop(50, 50, 4, 12, 58, -Math.PI / 2, 0.02), CR_LINE, 3.5), f(circ(50, 50, 6))] },
  { id: 'cr_flower5', name: '奶油小花', cat: 'cream', color: CR_PINK, parts: [f(scallop(50, 50, 5, 17, 52), CREAM), s(scallop(50, 50, 5, 17, 52), CR_LINE, 3.5), f(circ(50, 50, 9)), f(circ(47, 47, 2.5), '#ffffff', 0.9)] },
  { id: 'cr_cross', name: '奶油叉叉花', cat: 'cream', color: CR_PINK, parts: [f(X4, CREAM), s(X4, CR_LINE, 3.5), f(circ(50, 50, 5))] },
  { id: 'cr_sparkle', name: '奶油閃閃', cat: 'cream', color: CR_PINK, parts: [f(sparkleD(50, 50, 44, 0.24), CREAM), s(sparkleD(50, 50, 44, 0.24), CR_LINE, 3.5), s('M44 34Q46 30 49 28', 'M', 3)] },
  { id: 'cr_bigstar', name: '大閃光', cat: 'cream', color: CR_PINK, parts: [f(STAR8, CREAM), s(STAR8, CR_LINE, 3.2)] },
  { id: 'cr_candy', name: '棉花糖', cat: 'cream', color: CR_PINK, parts: [f(CANDY, CREAM), s(CANDY, CR_LINE, 3.5), s(CANDY_IN, CR_LINE, 2.2, 0.55), s('M33 40Q33 35 38 34', 'M', 3.5)] },
  { id: 'cr_swirl', name: '奶油漩渦', cat: 'cream', color: CR_PINK, parts: [f(circ(50, 50, 40), CREAM), s(circ(50, 50, 40), CR_LINE, 3.5), s(spiralD(50, 50, 2.2, 2, 28), 'M', 4)] },
  // 尾巴改成有填色的緞帶（剪成燕尾），小尺寸也看得出來
  { id: 'cr_bow', name: '奶油蝴蝶結', cat: 'cream', color: CR_PINK, parts: [f(BOW_TAIL), s(BOW_TAIL, CR_LINE, 3.2), f(BOW_LOOP, CREAM), s(BOW_LOOP, CR_LINE, 3.5), s(mirror((X) => `M${X(42)} 44C${X(34)} 36 ${X(24)} 36 ${X(22)} 44`), 'M', 3), f(ell(50, 48, 7.5, 8.5)), s(ell(50, 48, 7.5, 8.5), CR_LINE, 3)] },
  {
    id: 'cr_butterfly', name: '奶油蝴蝶', cat: 'cream', color: CR_PINK, parts: [
      s('M48 44Q46 24 39 13M52 44Q54 24 61 13', CR_LINE, 3), f(circ(38.5, 12, 3.6)), f(circ(61.5, 12, 3.6)),
      f(BFLY_LO, CREAM), s(BFLY_LO, CR_LINE, 3.5), f(BFLY_UP, CREAM), s(BFLY_UP, CR_LINE, 3.5),
      s(BFLY_IN, 'M', 3),
      f(ell(50, 58, 5, 15)), s(ell(50, 58, 5, 15), CR_LINE, 3),
    ]
  },
  {
    id: 'cr_twinstar', name: '奶油雙星', cat: 'cream', color: CR_PINK, parts: [
      f(TWIN_BIG, CREAM), s(TWIN_BIG, CR_LINE, 3.5), s('M40 40Q42 35.5 45 33', 'M', 3),
      s(TWIN_SM, CREAM, 9), f(TWIN_SM), s(TWIN_SM, CR_LINE, 2.6), f(ell(66, 24, 2.4, 1.5), '#ffffff', 0.9),
    ]
  },

  // ---------- kitty 貓咪小魚 ----------
  // 第五版去寫實：扁圓麻糬臉、點點眼、小 ω 嘴、腮紅；拿掉內耳、條紋、鼻子；一定有嘴、不放蝴蝶結
  {
    id: 'kt_cat', name: '白臉小貓', cat: 'kitty', color: '#ffffff', parts: [
      f(CAT_HEAD), s(CAT_HEAD, KT_LINE, 3.4),
      ...ktFace(50, 62, 1, { whisk: true }),
    ]
  },
  {
    id: 'kt_cat2', name: '瞇眼小貓', cat: 'kitty', color: '#ffe2bf', parts: [
      f(CAT_HEAD), s(CAT_HEAD, KT_LINE, 3.4),
      ...ktFace(50, 62, 1, { eyes: 'shut' }),
    ]
  },
  {
    id: 'kt_fish', name: '小魚', cat: 'kitty', color: KT_OR, vb: [100, 60], parts: [
      f(FISH), s(FISH, KT_LINE, 2.6),
      f(circ(22, 28, 3.2), KT_LINE), s('M44 20Q39 30 44 40', '#ffffff', 3, 0.5), f(ell(28, 36, 3.5, 2), CH, 0.85),
    ]
  },
  { id: 'kt_blossom', name: '小白花', cat: 'kitty', color: '#ffad55', parts: [f(scallop(50, 50, 5, 18, 54), '#ffffff'), s(scallop(50, 50, 5, 18, 54), KT_LINE, 2.4), f(circ(50, 50, 7))] },
  { id: 'kt_blossom2', name: '橘色小花', cat: 'kitty', color: '#ff9e5e', parts: [f(scallop(50, 50, 5, 18, 54)), f(circ(50, 50, 10), '#fff1d6')] },
  {
    id: 'kt_yarn', name: '毛線球', cat: 'kitty', color: '#ffb3c7', parts: [
      f(circ(46, 52, 34)), s(circ(46, 52, 34), KT_LINE, 3.2),
      // 毛線：同方向的平行弧線（不交叉，避免像籃球）
      s([-22, -11, 0, 11, 22].map((o) => arcInside(-34, 112, 100 + o, 46, 52, 34, 0.04)).join(''), KT_LINE, 2.4, 0.75),
      s('M76 70Q90 78 86 92Q82 98 92 98', KT_LINE, 3),
    ]
  },
  {
    id: 'kt_catsit', name: '坐著的白臉貓', cat: 'kitty', color: '#ffffff', parts: [
      s(SIT_TAIL, KT_LINE, 12), s(SIT_TAIL, 'M', 5.4),
      f(SIT_BODY), s(SIT_BODY, KT_LINE, 3.4),
      s('M47 84V90', KT_LINE, 2.6),
      f(SIT_HEAD), s(SIT_HEAD, KT_LINE, 3.4),
      ...ktFace(47, 9 + 46 * SIT_K, SIT_K * 1.08),
    ]
  },
  {
    id: 'kt_peek', name: '探頭小貓', cat: 'kitty', color: '#ffffff', vb: [100, 64], parts: [
      f(PEEK_HEAD), s(PEEK_HEAD, KT_LINE, 3.4),
      ...ktFace(50, 46.5, 0.95),
      f(PEEK_PAW), s(PEEK_PAW, KT_LINE, 3.2),
    ]
  },
  { id: 'kt_paw', name: '小肉球', cat: 'kitty', color: '#ffb3c7', parts: [f('M50 52C63 52 72 64 70 73C68 82 59 82 50 78C41 82 32 82 30 73C28 64 37 52 50 52Z', '#ffffff'), s('M50 52C63 52 72 64 70 73C68 82 59 82 50 78C41 82 32 82 30 73C28 64 37 52 50 52Z', KT_LINE, 3), f(ell(50, 68, 9, 6)), ...[[26, 44], [41, 31], [59, 31], [74, 44]].map(([x, y]) => f(ell(x, y, 7, 8.5), '#ffffff')), ...[[26, 44], [41, 31], [59, 31], [74, 44]].map(([x, y]) => s(ell(x, y, 7, 8.5), KT_LINE, 3)), ...[[26, 45], [41, 32], [59, 32], [74, 45]].map(([x, y]) => f(ell(x, y, 3.2, 3.6)))] },

  // ---------- flora 扁平花草（無描邊） ----------
  { id: 'fl_daisy', name: '橘色雛菊', cat: 'flora', color: '#f39552', parts: [f([...Array(10)].map((_, i) => petalD(50, 50, 6, 47, 9, (i * Math.PI) / 5)).join('')), f(circ(50, 50, 11), '#ffd8a3'), ...[[46, 47], [54, 47], [50, 54]].map(([x, y]) => f(circ(x, y, 2), '#e9783a'))] },
  { id: 'fl_cosmos', name: '粉色波斯菊', cat: 'flora', color: '#f4a2b8', parts: [f([...Array(8)].map((_, i) => notchPetalD(50, 50, 5, 46, 12, (i * Math.PI) / 4 + 0.2)).join('')), f(circ(50, 50, 10), '#ffd66b'), f(circ(50, 50, 4.5), '#f39552')] },
  { id: 'fl_round', name: '圓圓花', cat: 'flora', color: '#f8b48a', parts: [f(ringOf(50, 50, 5, 20, 17)), f(circ(50, 50, 13), '#fff1dd'), ...[0, 1, 2, 3, 4].map((i) => f(circ(50 + 6 * Math.cos(i * 1.257), 50 + 6 * Math.sin(i * 1.257), 2), '#f08a5d'))] },
  { id: 'fl_blue', name: '藍色小花', cat: 'flora', color: '#6f9ed9', parts: [f(petalD(50, 56, 0, 30, 7, 2.2), '#9cc47a'), f(ringOf(50, 44, 5, 15, 12)), f(circ(50, 44, 7), '#ffffff'), f(circ(50, 44, 3), '#ffd66b')] },
  { id: 'fl_star', name: '星星花', cat: 'flora', color: '#f4a2b8', parts: [f([...Array(6)].map((_, i) => petalD(50, 50, 4, 44, 6, (i * Math.PI) / 3 - Math.PI / 2)).join('')), f(circ(50, 50, 6), '#ffffff')] },
  (() => {
    const P0 = [12, 92], C = [28, 30], P2 = [92, 14], parts = [];
    const B = (t) => [(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * C[0] + t * t * P2[0], (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * C[1] + t * t * P2[1]];
    const T = (t) => Math.atan2(2 * (1 - t) * (C[1] - P0[1]) + 2 * t * (P2[1] - C[1]), 2 * (1 - t) * (C[0] - P0[0]) + 2 * t * (P2[0] - C[0]));
    parts.push(s(`M${P0[0]} ${P0[1]}Q${C[0]} ${C[1]} ${P2[0]} ${P2[1]}`, 'M', 3.5));
    let leaves = '';
    for (let i = 0; i < 8; i++) {
      const t = 0.14 + i * 0.105, [x, y] = B(t), side = i % 2 ? 1 : -1;
      leaves += petalD(x, y, 0, 17 - i * 0.6, 6.5, T(t) + side * 0.95);
    }
    const [ex, ey] = B(1);
    leaves += petalD(ex, ey, 0, 14, 6, T(1));
    parts.push(f(leaves));
    return { id: 'fl_sprig', name: '小枝葉', cat: 'flora', color: '#f2a55a', parts };
  })(),
  {
    // 花改成較大的 5 瓣、莖改淡黃綠
    id: 'fl_bunch', name: '粉紅花束', cat: 'flora', color: '#f7a9bd', parts: [
      s('M22 96Q24 62 28 32M22 96Q40 60 58 24M22 96Q52 76 80 48', '#e3d27a', 3),
      f(petalD(24, 70, 0, 15, 5, -2.5) + petalD(41, 66, 0, 14, 5, -0.5) + petalD(56, 78, 0, 13, 4.5, -0.15), '#e3d27a'),
      f([[28, 30, 0], [58, 22, 0.35], [80, 48, -0.3]].map(([x, y, r]) => [...Array(5)].map((_, i) => circ(x + 7.5 * Math.cos(r + i * 1.2566 - 1.5708), y + 7.5 * Math.sin(r + i * 1.2566 - 1.5708), 6.8)).join('')).join('')),
      ...[[28, 30], [58, 22], [80, 48]].map(([x, y]) => f(circ(x, y, 3.6), '#fff3d6')),
    ]
  },
  {
    id: 'fl_starbranch', name: '星花小枝', cat: 'flora', color: '#f39552', parts: [
      s('M34 96Q40 64 58 22M38 72Q30 58 22 46M42 60Q56 54 74 54', '#9cc47a', 3.2),
      f(petalD(36, 82, 0, 15, 5.5, -2.7) + petalD(39, 70, 0, 13, 5, -0.3), '#9cc47a'),
      ...[[58, 20, 15, -1.45], [21, 43, 12.5, -1.75], [76, 54, 11.5, -1.2]].flatMap(([x, y, r, rot]) => {
        const d = softStar(x, y, [r, r, r, r, r], r * 0.5, rot);
        return [f(d), s(d, 'M', 3), f(circ(x, y, r * 0.24), '#ffd8a3')];
      }),
    ]
  },
  {
    id: 'fl_ginkgo', name: '銀杏葉', cat: 'flora', color: '#f2bd4f', parts: [
      s('M50 70Q51 84 46 96', 'M', 4),
      f(GINKGO), s(GINKGO, 'M', 2),
      s(['M50 70L', 'M50 70L', 'M50 70L', 'M50 70L'].map((m, i) => { const t = [-0.62, -0.25, 0.25, 0.62][i]; return m + n(50 + 34 * Math.sin(t)) + ' ' + n(72 - 34 * Math.cos(t)); }).join(''), '#ffffff', 1.6, 0.35),
    ]
  },
  { id: 'fl_tulip', name: '鬱金香', cat: 'flora', color: '#f39552', parts: [s('M50 96Q47 76 50 58', '#9cc47a', 3.5), f(petalD(48, 86, 0, 24, 7, -2.4), '#9cc47a'), f(TULIP)] },
  {
    id: 'fl_fern', name: '薄荷繖花', cat: 'flora', color: '#94d3bd', parts: [
      s(UMBEL.map(([a, L]) => `M50 94L${n(50 + L * Math.cos(a))} ${n(94 + L * Math.sin(a))}`).join(''), '#c9e3a0', 2.2),
      f(UMBEL.map(([a, L]) => circ(50 + (L + 5) * Math.cos(a), 94 + (L + 5) * Math.sin(a), 6)).join('')),
      f(UMBEL.map(([a, L]) => circ(48.5 + (L + 6) * Math.cos(a), 92.5 + (L + 6) * Math.sin(a), 2)).join(''), '#ffffff', 0.8),
    ]
  },

  // ---------- pastel 粉彩線條 ----------
  {
    id: 'pl_catjump', name: '跳躍小貓', cat: 'pastel', color: '#ffffff', vb: [100, 64], parts: [
      f(CAT_JUMP, 'M', 0.9), s(CAT_JUMP, 'M', 3), s('M21 31C10 30 5 22 9 10', 'M', 3),
      s('M40 19L41 25M47 18L47 24M54 18.5L53 24.5', '#ffb36b', 2.6),
      ...CAT_JUMP_FACE(KT_LINE, CH),
    ]
  },
  {
    id: 'pl_gradcat', name: '漸層小貓', cat: 'pastel', color: '#ffffff', vb: [100, 64], parts: [
      { d: CAT_JUMP, f: { lg: [8, 50, 92, 20, '#a8ecd2', '#ffc79e'] }, a: 0.9 }, s(CAT_JUMP, 'M', 2.6), s('M21 31C10 30 5 22 9 10', '#ffc79e', 3.4),
      ...CAT_JUMP_FACE(KT_LINE, '#ff8fb0'),
    ]
  },
  {
    id: 'pl_catsit', name: '坐著的貓', cat: 'pastel', color: '#ffd7e6', parts: [
      s('M44 24L42 8L54 16Q60 14 66 16L76 6L76 24Q82 34 74 42Q80 56 78 72Q76 84 70 90Q56 94 40 92Q24 88 24 72Q24 56 40 44Q38 34 44 24Z', 'M', 3),
      s('M73 88Q94 89 95 74Q95 64 89 63', 'M', 3),
      f(circ(53, 28, 2)), f(circ(67, 28, 2)), s('M57 33q3 3 6 0', 'M', 2.2), f(ell(48, 33, 3, 2), CH, 0.9), f(ell(72, 33, 3, 2), CH, 0.9),
    ]
  },
  {
    id: 'pl_flower', name: '長莖小花', cat: 'pastel', color: '#ffb7d0', parts: [
      s('M50 36C44 54 58 68 48 96', '#9ff0d0', 3), s('M51 66C62 54 76 56 80 60C72 70 60 70 51 66Z', '#9ff0d0', 3),
      s(scallop(50, 22, 5, 7, 22), 'M', 3), f(circ(50, 22, 5), '#ffe08a'),
    ]
  },
  { id: 'pl_daisy', name: '線條雛菊', cat: 'pastel', color: '#ffffff', parts: [s(scallop(50, 50, 8, 16, 50, -Math.PI / 2, 0.08), 'M', 3), f(circ(50, 50, 10), '#ffe08a')] },
  { id: 'pl_twinkle', name: '小閃光', cat: 'pastel', color: '#ffffff', parts: [f(sparkleD(32, 62, 22, 0.16)), f(sparkleD(70, 30, 14, 0.16)), f(sparkleD(74, 74, 8, 0.16))] },
  { id: 'pl_dotarc', name: '點點弧線', cat: 'pastel', color: '#ffffff', vb: [100, 50], parts: [s([...Array(9)].map((_, i) => { const a = Math.PI * (1.12 + i * 0.095); return `M${n(50 + 46 * Math.cos(a))} ${n(52 + 46 * Math.sin(a))}L${n(50 + 46 * Math.cos(a + 0.03))} ${n(52 + 46 * Math.sin(a + 0.03))}`; }).join(''), 'M', 5)] },
  { id: 'pl_streak', name: '流星線', cat: 'pastel', color: '#ffe08a', parts: [s('M16 86L52 50M30 92L60 62M10 70L38 42', 'M', 3.5), f(sparkleD(70, 30, 14, 0.18))] },
  { id: 'pl_star', name: '黃色小星', cat: 'pastel', color: '#ffd86b', parts: [f(starPts(50, 53, 5, 44, 20)), s(starPts(50, 53, 5, 44, 20), 'M', 4)] },
  {
    // 趴著的條紋貓：和跳躍貓、坐姿貓不同姿勢
    id: 'pl_stripecat', name: '趴趴條紋貓', cat: 'pastel', color: '#9fd8f5', vb: [100, 64], parts: [
      s(LOAF, 'M', 3), s('M80 58C68 59 58 59 52 56C48 54 49 50 53 50', 'M', 3), s('M29 55.5V61.5', 'M', 2.4),
      s('M58 22.5L55 30M66 22.2L63 29.8M74 22.6L71.5 30', '#ffc79e', 3),
      f(circ(20.5, 35, 2)), f(circ(32.5, 35, 2)), s('M24.5 39.5q2 2 4 0', 'M', 2.2),
      f(ell(16, 40, 2.8, 1.7), CH, 0.9), f(ell(37, 40, 2.8, 1.7), CH, 0.9),
    ]
  },
  { id: 'pl_crosses', name: '圓頭小十字', cat: 'pastel', color: '#c8b6ff', parts: [f(crossD(36, 60, 28, 5.6)), f(crossD(74, 26, 16, 3.8, 0.3)), f(crossD(78, 76, 10.5, 2.8, -0.25)), f(circ(20, 24, 3.6))] },

  // ---------- 螢光貓咪包用（線條風，主色可換螢光色） ----------
  {
    id: 'nc_cathead', name: '線條貓頭', cat: 'pastel', color: '#ffffff', parts: [
      s(NC_HEAD, 'M', 4.5),
      f(circ(37, 54, 3.8)), f(circ(63, 54, 3.8)), f(ell(50, 60.5, 2.6, 1.8)),
      s('M43.5 64q3.25 3.5 6.5 0q3.25 3.5 6.5 0', 'M', 3),
      f(ell(27, 64, 5.5, 3.2), CH, 0.9), f(ell(73, 64, 5.5, 3.2), CH, 0.9),
      s('M2 55L11 57M3 64L11 63M98 55L89 57M97 64L89 63', 'M', 3),
    ]
  },
  {
    id: 'nc_scratch', name: '貓爪抓痕', cat: 'line', color: '#ff8fc0', parts: [
      s([0, 1, 2, 3].map((i) => {
        const o = (i - 1.5) * 17, L = [28, 37, 37, 29][i], ux = -0.36, uy = 0.93, px = 0.93, py = 0.36;
        const cx = 50 + o * px, cy = 50 + o * py + [3, 0, -2, 1][i];
        return `M${n(cx - ux * L)} ${n(cy - uy * L)}Q${n(cx - px * 6)} ${n(cy - py * 6)} ${n(cx + ux * L)} ${n(cy + uy * L)}`;
      }).join(''), 'M', 4.5),
    ]
  },
];
STICKERS.push(...CUTE, ...ART_FR_JP, ...ART_Y2K_EMOJI, ...ART_CRAYON);

// 使用者不想再看到的風格：定義留著（舊的貼圖不會壞），但不出現在貼圖面板和塗鴉框
export const HIDDEN_CATS = new Set(['kitty', 'emoji']);
export const CATEGORIES = [
  ['all', '全部'], ['crayon', '蠟筆'], ['cream', '奶油'], ['flora', '花草'], ['pastel', '粉彩'],
  ['french', '法式'], ['japan', '日式'], ['y2k', 'Y2K'],
  ['face', '螢光表情'], ['animal', '動物'], ['travel', '旅行'], ['deco', '裝飾'], ['line', '線條'],
];

export const isRecolorable = (def) => def.parts.some((p) => p.f === 'M' || p.s === 'M');

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

// 在 (0,0)-(vbW,vbH) 座標系畫貼圖；pxPerUnit 用來把光暈換算成像素（shadowBlur 不吃 transform）
export function drawStickerDef(ctx, def, color, pxPerUnit = 1, glow = 0, strokeScale = 1, seed = 1) {
  // 蠟筆風：手抖＋顆粒（不加霓虹光暈，保持粉彩筆的質感）
  if (def.style === 'crayon') { drawCrayonDef(ctx, def, color, strokeScale, seed); return; }
  if (!def._paths) def._paths = def.parts.map((p) => new Path2D(p.d));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  def.parts.forEach((p, i) => {
    const path = def._paths[i];
    ctx.globalAlpha = p.a ?? 1;
    const fc = p.f === 'M' ? color : p.f;
    const sc = p.s === 'M' ? color : p.s;
    if (glow > 0) {
      ctx.shadowColor = hexToRgba(sc || (typeof fc === 'string' ? fc : '#ffffff'), 0.55);
      ctx.shadowBlur = Math.max(0, glow * 6 * pxPerUnit);
    }
    if (fc) {
      if (typeof fc === 'object' && fc.lg) {
        const [x0, y0, x1, y1, c0, c1] = fc.lg, g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, c0); g.addColorStop(1, c1);
        ctx.fillStyle = g;
      } else ctx.fillStyle = fc;
      ctx.fill(path);
    }
    if (sc) { ctx.strokeStyle = sc; ctx.lineWidth = p.w * strokeScale; ctx.stroke(path); }
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

export const stickerBox = (def) => def.vb || [100, 100];
