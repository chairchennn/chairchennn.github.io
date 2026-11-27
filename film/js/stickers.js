// FilmDoodle — 原創手繪風塗鴉貼圖
// 每個貼圖都是一組 SVG path（座標 0–100），用 Path2D 直接畫在 canvas 上，
// 放多大都不會糊。顏色 'M' 代表「主色」，使用者可以替換。

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
  { id: 'sunny', name: '笑臉星芒', cat: 'face', color: Y, parts: [s(starPts(50, 50, 10, 45, 33)), ...face(50, 50, 48)] },
  { id: 'burst', name: '刺刺球', cat: 'face', color: C, parts: [s(starPts(50, 50, 14, 44, 36, -Math.PI / 2)), ...face(50, 48, 50, 'M', { mouth: 'open' })] },
  {
    id: 'heart', name: '笑臉愛心', cat: 'face', color: P, parts: [
      s('M46 88C20 70 6 54 8 38C10 22 30 14 46 32C62 14 84 20 84 38C84 56 70 72 46 88Z'),
      ...face(46, 48, 48),
      s('M82 14L88 6'), s('M90 24L98 21'), s('M72 10L72 2'),
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
    id: 'boxface', name: '方塊臉', cat: 'face', color: O, parts: [
      s('M20 26H66Q72 26 72 32V70Q72 76 66 76H20Q14 76 14 70V32Q14 26 20 26Z'),
      ...face(43, 47, 42),
      s('M82 38L96 34', 'M', 4), s('M82 51H97', 'M', 4), s('M82 64L96 68', 'M', 4),
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
    id: 'film', name: '底片', cat: 'travel', color: C, parts: [
      s('M14 20H86Q92 20 92 26V74Q92 80 86 80H14Q8 80 8 74V26Q8 20 14 20Z'),
      s('M22 33H78V67H22Z', 'M', 3.5),
      ...[16, 28, 40, 52, 64, 76].map((x) => f(`M${x} 24h6v5h-6z`)),
      ...[16, 28, 40, 52, 64, 76].map((x) => f(`M${x} 71h6v5h-6z`)),
      ...face(50, 47, 26, P),
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
const CREAM = '#fffaf2', CR_LINE = '#e59ba9', CR_PINK = '#f7a8bb';
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
function radialStar(cx, cy, radii, rot = -Math.PI / 2) {
  const k = radii.length;
  return poly(radii.map((r, i) => [cx + r * Math.cos(rot + (i * Math.PI * 2) / k), cy + r * Math.sin(rot + (i * Math.PI * 2) / k)]));
}
function ringOf(cx, cy, k, dist, r) {
  let d = '';
  for (let i = 0; i < k; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / k; d += circ(cx + dist * Math.cos(a), cy + dist * Math.sin(a), r); }
  return d;
}
const CAT_HEAD = 'M20 46Q16 30 21 15Q33 21 40 30Q50 27 60 30Q67 21 79 15Q84 30 80 46Q86 63 74 75Q62 85 50 85Q38 85 26 75Q14 63 20 46Z';
// 跳躍的小貓（閉合身體，可填色）
const CAT_JUMP = 'M26 26C40 16 58 16 70 22L71 12L78 18L86 12C92 18 95 26 93 33C91 40 86 43 80 43C86 45 92 47 96 49' +
  'C99 52 96 56 92 55C86 54 80 52 74 50C62 54 44 54 34 48C26 50 16 54 10 57C5 59 3 54 7 52C14 48 20 44 22 40C16 36 18 30 26 26Z';

const CUTE = [
  // ---------- cream 奶油白 ----------
  { id: 'cr_heart', name: '奶油愛心', cat: 'cream', color: CR_PINK, parts: [f(heartD(50, 53, 84), CREAM), s(heartD(50, 53, 84), CR_LINE, 3.5), f(heartD(50, 53, 40)), f(ell(42, 44, 4, 2.6), '#ffffff', 0.9)] },
  { id: 'cr_dotheart', name: '粉紅小心', cat: 'cream', color: CR_PINK, parts: [s(heartD(50, 53, 70), CREAM, 9), f(heartD(50, 53, 70)), f(ell(38, 42, 5, 3.2), '#ffffff', 0.85)] },
  { id: 'cr_flower4', name: '奶油四瓣', cat: 'cream', color: CR_PINK, parts: [f(scallop(50, 50, 4, 12, 58, -Math.PI / 2, 0.02), CREAM), s(scallop(50, 50, 4, 12, 58, -Math.PI / 2, 0.02), CR_LINE, 3.5), f(circ(50, 50, 6))] },
  { id: 'cr_flower5', name: '奶油小花', cat: 'cream', color: CR_PINK, parts: [f(scallop(50, 50, 5, 17, 52), CREAM), s(scallop(50, 50, 5, 17, 52), CR_LINE, 3.5), f(circ(50, 50, 9)), f(circ(47, 47, 2.5), '#ffffff', 0.9)] },
  { id: 'cr_cross', name: '奶油十字', cat: 'cream', color: CR_PINK, parts: [f('M40 12Q50 6 60 12L60 40L88 40Q94 50 88 60L60 60L60 88Q50 94 40 88L40 60L12 60Q6 50 12 40L40 40Z', CREAM), s('M40 12Q50 6 60 12L60 40L88 40Q94 50 88 60L60 60L60 88Q50 94 40 88L40 60L12 60Q6 50 12 40L40 40Z', CR_LINE, 3.5), f(circ(50, 50, 5))] },
  { id: 'cr_sparkle', name: '奶油閃閃', cat: 'cream', color: CR_PINK, parts: [f(sparkleD(50, 50, 44, 0.24), CREAM), s(sparkleD(50, 50, 44, 0.24), CR_LINE, 3.5), s('M44 34Q46 30 49 28', 'M', 3)] },
  { id: 'cr_bigstar', name: '大閃光', cat: 'cream', color: CR_PINK, parts: [f(radialStar(50, 50, [47, 13, 34, 12, 44, 13, 30, 12, 46, 13, 33, 12]), CREAM), s(radialStar(50, 50, [47, 13, 34, 12, 44, 13, 30, 12, 46, 13, 33, 12]), CR_LINE, 3)] },
  { id: 'cr_candy', name: '棉花糖', cat: 'cream', color: CR_PINK, parts: [f('M32 16H68Q84 16 84 32V68Q84 84 68 84H32Q16 84 16 68V32Q16 16 32 16Z', CREAM), s('M32 16H68Q84 16 84 32V68Q84 84 68 84H32Q16 84 16 68V32Q16 16 32 16Z', CR_LINE, 3.5), s('M28 36Q28 28 36 27', 'M', 4)] },
  { id: 'cr_swirl', name: '奶油漩渦', cat: 'cream', color: CR_PINK, parts: [f(circ(50, 50, 40), CREAM), s(circ(50, 50, 40), CR_LINE, 3.5), s(spiralD(50, 50, 2.2, 2, 28), 'M', 4)] },
  { id: 'cr_bow', name: '奶油蝴蝶結', cat: 'cream', color: CR_PINK, parts: [f('M50 48C36 24 10 28 12 46C14 64 36 62 50 48Z', CREAM), f('M50 48C64 24 90 28 88 46C86 64 64 62 50 48Z', CREAM), s('M50 48C36 24 10 28 12 46C14 64 36 62 50 48Z', CR_LINE, 3.5), s('M50 48C64 24 90 28 88 46C86 64 64 62 50 48Z', CR_LINE, 3.5), s('M45 52L36 80M55 52L64 80', CR_LINE, 3.5), f(circ(50, 48, 7))] },

  // ---------- kitty 貓咪小魚 ----------
  {
    id: 'kt_cat', name: '白臉小貓', cat: 'kitty', color: '#ffffff', parts: [
      f(CAT_HEAD), s(CAT_HEAD, KT_LINE, 3.5),
      f('M25 25Q30 27 34 31L27 36Z', CH, 0.9), f('M75 25Q70 27 66 31L73 36Z', CH, 0.9),
      f(ell(39, 54, 3.4, 4.4), KT_LINE), f(ell(61, 54, 3.4, 4.4), KT_LINE), f(circ(40, 52.5, 1.2), '#ffffff'), f(circ(62, 52.5, 1.2), '#ffffff'),
      f('M47 60.5H53L50 63.5Z', '#ff8fa3'), s('M44 65.5q3 3.5 6 0q3 3.5 6 0', KT_LINE, 2.6),
      f(ell(30, 64, 5, 3), CH, 0.9), f(ell(70, 64, 5, 3), CH, 0.9),
      s('M8 55L22 58M8 64L22 63', KT_LINE, 2.4), s('M92 55L78 58M92 64L78 63', KT_LINE, 2.4),
    ]
  },
  {
    id: 'kt_cat2', name: '瞇眼小貓', cat: 'kitty', color: '#ffe2bf', parts: [
      f(CAT_HEAD), s(CAT_HEAD, KT_LINE, 3.5),
      s('M45 33L46 39M50 32V39M55 33L54 39', KT_OR, 3),
      s('M34 55q5 -6 10 0M56 55q5 -6 10 0', KT_LINE, 3),
      f('M47 60.5H53L50 63.5Z', '#ff8fa3'), s('M44 65.5q3 3.5 6 0q3 3.5 6 0', KT_LINE, 2.6),
      f(ell(30, 63, 5, 3), CH, 0.95), f(ell(70, 63, 5, 3), CH, 0.95),
    ]
  },
  {
    id: 'kt_fish', name: '小魚', cat: 'kitty', color: KT_OR, vb: [100, 60], parts: [
      f('M10 30Q32 6 62 20L84 8Q78 30 84 52L62 40Q32 54 10 30Z'), s('M10 30Q32 6 62 20L84 8Q78 30 84 52L62 40Q32 54 10 30Z', '#ffffff', 3.5),
      f(circ(25, 27, 3.2), KT_LINE), s('M38 18Q33 30 38 42', '#ffffff', 3), s('M48 22L52 26M48 34L52 30', '#ffffff', 2.4, 0.8),
    ]
  },
  { id: 'kt_blossom', name: '小白花', cat: 'kitty', color: '#ffad55', parts: [f(scallop(50, 50, 5, 18, 54), '#ffffff'), s(scallop(50, 50, 5, 18, 54), '#f3d2b5', 2.5), f(circ(50, 50, 10))] },
  { id: 'kt_blossom2', name: '橘色小花', cat: 'kitty', color: '#ff9e5e', parts: [f(scallop(50, 50, 5, 18, 54)), f(circ(50, 50, 10), '#fff1d6')] },
  {
    id: 'kt_yarn', name: '毛線球', cat: 'kitty', color: '#ffb3c7', parts: [
      f(circ(46, 52, 34)), s(circ(46, 52, 34), KT_LINE, 3.2),
      s('M20 40Q44 34 66 52M18 58Q42 50 72 66M30 80Q46 60 52 20', KT_LINE, 2.4, 0.75),
      s('M76 70Q90 78 86 92Q82 98 92 98', KT_LINE, 3),
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
    id: 'fl_bunch', name: '粉紅花束', cat: 'flora', color: '#f7a9bd', parts: [
      s('M22 96Q24 60 30 30M22 96Q40 60 58 24M22 96Q52 74 80 44', '#f3b07a', 2.6),
      ...[[30, 30], [58, 24], [80, 44]].flatMap(([x, y]) => [[x, y - 6], [x - 6, y + 1], [x + 6, y + 1], [x - 3, y + 7], [x + 4, y - 1]].map(([bx, by]) => f(ell(bx, by, 5, 4)))),
      ...[[30, 30], [58, 24], [80, 44]].map(([x, y]) => f(circ(x, y, 2.2), '#ffffff', 0.9)),
      f(ell(27, 56, 4, 3)), f(ell(46, 52, 4, 3)), f(ell(62, 66, 4, 3)),
    ]
  },
  { id: 'fl_tulip', name: '鬱金香', cat: 'flora', color: '#f39552', parts: [s('M50 96Q47 74 50 52', '#9cc47a', 3.5), f(petalD(48, 86, 0, 24, 7, -2.4), '#9cc47a'), f('M32 30Q34 52 50 56Q66 52 68 30L59 38L50 24L41 38Z')] },
  { id: 'fl_fern', name: '扇形葉', cat: 'flora', color: '#94d3bd', parts: [f([-2.6, -2.1, -1.57, -1.04, -0.54].map((a, i) => petalD(50, 92, 3, [62, 74, 80, 74, 62][i], 8, a)).join('')), s([-2.6, -2.1, -1.57, -1.04, -0.54].map((a, i) => `M50 92L${n(50 + Math.cos(a) * [52, 64, 70, 64, 52][i])} ${n(92 + Math.sin(a) * [52, 64, 70, 64, 52][i])}`).join(''), '#ffffff', 1.6, 0.6)] },

  // ---------- pastel 粉彩線條 ----------
  {
    id: 'pl_catjump', name: '跳躍小貓', cat: 'pastel', color: '#ffffff', vb: [100, 64], parts: [
      f(CAT_JUMP, 'M', 0.22), s(CAT_JUMP, 'M', 3), s('M24 28C12 28 6 20 9 8', 'M', 3),
      s('M46 19L47 25M54 18L54 24M62 19L61 25', '#ffb36b', 2.6),
      f(ell(85, 29, 1.9, 2.4)), f(ell(89, 35, 2.6, 1.6), CH, 0.9),
    ]
  },
  {
    id: 'pl_gradcat', name: '漸層小貓', cat: 'pastel', color: '#ffffff', vb: [100, 64], parts: [
      { d: CAT_JUMP, f: { lg: [8, 50, 92, 20, '#9fd8f5', '#ffb7d0'] } }, s(CAT_JUMP, 'M', 2.6), s('M24 28C12 28 6 20 9 8', '#ffb7d0', 3.4),
      f(ell(85, 29, 1.9, 2.4), KT_LINE), f(ell(89, 35, 2.6, 1.6), '#ff8fb0', 0.9),
    ]
  },
  {
    id: 'pl_catsit', name: '坐著的貓', cat: 'pastel', color: '#ffd7e6', parts: [
      s('M44 24L42 8L54 16Q60 14 66 16L76 6L76 24Q82 34 74 42Q80 56 78 72Q76 84 70 90Q56 94 40 92Q24 88 24 72Q24 56 40 44Q38 34 44 24Z', 'M', 3),
      s('M26 84Q10 88 10 74Q10 62 22 64', 'M', 3),
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
];
STICKERS.push(...CUTE);

export const CATEGORIES = [
  ['all', '全部'], ['cream', '奶油'], ['kitty', '貓咪'], ['flora', '花草'], ['pastel', '粉彩'],
  ['face', '螢光表情'], ['animal', '動物'], ['travel', '旅行'], ['deco', '裝飾'], ['line', '線條'],
];

export const isRecolorable = (def) => def.parts.some((p) => p.f === 'M' || p.s === 'M');

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

// 在 (0,0)-(vbW,vbH) 座標系畫貼圖；pxPerUnit 用來把光暈換算成像素（shadowBlur 不吃 transform）
export function drawStickerDef(ctx, def, color, pxPerUnit = 1, glow = 0, strokeScale = 1) {
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
