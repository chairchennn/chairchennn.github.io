// FilmDoodle — Y2K（cat: 'y2k'）與日式表情臉（cat: 'emoji'）原創貼圖
// 共用工具從 ./shapes.js 匯入。格式同 stickers.js：{ id, name, cat, color, vb?, parts: [...] }
import { s, f, circ, ell, poly, starPts, scallop, sparkleD, heartD, petalD, face, n } from './shapes.js';

// ---------- 共用小工具 ----------
const g = (d, lg, a) => ({ d, f: { lg }, a }); // 線性漸層填色
const circR = (cx, cy, r) => `M${n(cx - r)} ${n(cy)}a${r} ${r} 0 1 1 ${n(r * 2)} 0a${r} ${r} 0 1 1 ${n(-r * 2)} 0Z`; // 反向圓（挖洞用）
const rr = (x, y, w, h, r) => `M${n(x + r)} ${n(y)}H${n(x + w - r)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}V${n(y + h - r)}` +
  `Q${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}H${n(x + r)}Q${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)}V${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Z`;
const mirror = (d) => d.replace(/([MLQCHVZ])([^MLQCHVZ]*)/g, (m, cmd, args) => {
  // 只處理絕對座標 M L Q C（x 座標每兩個取一個），用來畫左右對稱的翅膀
  if (cmd === 'Z') return 'Z';
  const v = args.trim().split(/[ ,]+/).map(Number);
  return cmd + v.map((x, i) => (i % 2 ? x : n(100 - x))).join(' ');
});
// 圓角多邊形（每個角用 Q 曲線磨圓）
function roundPoly(pts, r) {
  let d = '';
  pts.forEach((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]), k = Math.min(r, la / 2, lb / 2);
    const p1 = [p[0] + ((a[0] - p[0]) * k) / la, p[1] + ((a[1] - p[1]) * k) / la], p2 = [p[0] + ((b[0] - p[0]) * k) / lb, p[1] + ((b[1] - p[1]) * k) / lb];
    d += `${i ? 'L' : 'M'}${n(p1[0])} ${n(p1[1])}Q${n(p[0])} ${n(p[1])} ${n(p2[0])} ${n(p2[1])}`;
  });
  return d + 'Z';
}
// 環形扇區（光碟反光用）
function sector(cx, cy, r0, r1, a0, a1) {
  const P = (r, a) => `${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`;
  return `M${P(r0, a0)}L${P(r1, a0)}A${r1} ${r1} 0 0 1 ${P(r1, a1)}L${P(r0, a1)}A${r0} ${r0} 0 0 0 ${P(r0, a0)}Z`;
}
// 愛心的頂點（棋盤格裁切用）
function heartPts(cx, cy, size) {
  const k = size / 34, pts = [];
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    pts.push([cx + k * 16 * Math.sin(t) ** 3, cy + k * (-(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 2)]);
  }
  return pts;
}
// Sutherland–Hodgman：用矩形裁切多邊形
function clipRect(pts, x0, y0, x1, y1) {
  const edges = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]]];
  let out = pts;
  for (const [inside, cut] of edges) {
    const src = out; out = [];
    src.forEach((cur, i) => {
      const prev = src[(i + src.length - 1) % src.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cut(prev, cur));
    });
    if (!out.length) break;
  }
  return out;
}

// ---------- Y2K 配色 ----------
const HOT = '#ff4fb8', BABY = '#8fd8ff', LILAC = '#c9a7ff', LIME = '#c6f45a', INK = '#5b3fa8', WH = '#ffffff';
const CHROME = ['#f4f6ff', '#9aa3c7'];

const STAR4 = sparkleD(50, 50, 46, 0.26);
const HEART = heartD(50, 53, 86);
const HEART_IN = heartD(50, 50, 60);
const CHECK_PTS = heartPts(50, 53, 86);
const CHECK = (() => {
  let d = '';
  const c = 12;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    if ((i + j) % 2) continue;
    const x0 = -4 + i * c, y0 = 4 + j * c, q = clipRect(CHECK_PTS, x0, y0, x0 + c, y0 + c);
    if (q.length > 2) d += poly(q);
  }
  return d;
})();
const WING_U = 'M51 46C55 24 76 8 89 16C99 23 94 44 76 50C68 53 60 54 52 52Z';
const WING_L = 'M52 56C64 54 80 58 83 70C86 82 72 88 62 80C56 75 53 66 52 56Z';
const BOLT = roundPoly([[56, 4], [20, 54], [45, 54], [34, 96], [82, 40], [58, 40], [74, 4]], 5);
const PLANET_RING = (front) => {
  // 傾斜的橢圓環；front=true 取前半圈（壓在星球上）
  const pts = [], rot = -0.36, cx = 50, cy = 54;
  for (let i = 0; i <= 40; i++) {
    const t = (front ? 0 : Math.PI) + (i / 40) * Math.PI, x = 47 * Math.cos(t), y = 13 * Math.sin(t);
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return poly(pts, false);
};

const Y2K = [
  {
    id: 'y2k_chromestar', name: '鉻銀四角星', cat: 'y2k', color: '#b28cff', parts: [
      f(sparkleD(84, 18, 11, 0.22)), f(sparkleD(17, 82, 7, 0.22), BABY),
      g(STAR4, [22, 14, 80, 88, ...CHROME]),
      g(sparkleD(50, 50, 26, 0.3), [62, 62, 38, 38, '#ffffff', '#c3c9e6'], 0.95),
      s(STAR4, 'M', 3.6),
      s('M47 14Q45 34 31 46', WH, 3.2, 0.95), f(sparkleD(40, 40, 7, 0.2), WH),
    ]
  },
  {
    id: 'y2k_glitter', name: '亮晶晶閃光', cat: 'y2k', color: HOT, parts: [
      f(sparkleD(38, 60, 32, 0.2)), f(sparkleD(74, 26, 19, 0.2), BABY), f(sparkleD(80, 76, 11, 0.2), LILAC),
      f(sparkleD(38, 60, 12, 0.2), WH, 0.95), f(sparkleD(74, 26, 7, 0.2), WH, 0.95), f(sparkleD(80, 76, 4, 0.2), WH, 0.95),
      f(circ(18, 22, 4.5), LIME), f(circ(60, 86, 3), BABY),
    ]
  },
  {
    id: 'y2k_butterfly', name: '漸層蝴蝶', cat: 'y2k', color: INK, parts: [
      g(WING_U, [52, 50, 92, 14, HOT, LILAC]), g(mirror(WING_U), [48, 50, 8, 14, HOT, LILAC]),
      g(WING_L, [52, 56, 82, 82, BABY, LILAC]), g(mirror(WING_L), [48, 56, 18, 82, BABY, LILAC]),
      s(WING_U + mirror(WING_U) + WING_L + mirror(WING_L), 'M', 3),
      f(ell(73, 28, 6, 4) + ell(27, 28, 6, 4), WH, 0.85), f(circ(82, 39, 2.6) + circ(18, 39, 2.6) + circ(70, 72, 3) + circ(30, 72, 3), WH, 0.85),
      f(ell(50, 57, 4.6, 17)), f(circ(50, 37, 5.4)),
      s('M48 34Q44 20 35 15M52 34Q56 20 65 15', 'M', 2.6), f(circ(35, 14, 3.4) + circ(65, 14, 3.4)),
    ]
  },
  {
    id: 'y2k_chromeheart', name: '鉻銀愛心', cat: 'y2k', color: HOT, parts: [
      g(HEART, [20, 16, 80, 92, ...CHROME]),
      g(HEART_IN, [70, 74, 34, 30, '#ffffff', '#c2c8e8'], 0.9),
      s(HEART, 'M', 3.6),
      s('M22 36Q24 24 36 22', WH, 3.6), f(circ(22, 44, 2.6), WH),
      f(sparkleD(86, 14, 10, 0.22)), f(sparkleD(70, 76, 5, 0.22), WH, 0.9),
    ]
  },
  {
    id: 'y2k_flip', name: '掀蓋手機', cat: 'y2k', color: HOT, parts: [
      s('M66 13V5', INK, 4), f(circ(66, 4.5, 3.4), LILAC), s(circ(66, 4.5, 3.4), INK, 2),
      f(rr(30, 10, 40, 40, 11)), f(rr(30, 52, 40, 42, 11)),
      g(rr(36, 16, 28, 26, 6), [40, 16, 60, 42, '#effaff', BABY]),
      f(heartD(50, 30, 14), HOT), f(sparkleD(58, 22, 3.4, 0.22), WH),
      f(ell(50, 64, 7, 3.4), WH, 0.9),
      f([0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => circ(40 + c * 10, 73 + r * 7, 2.4))).join(''), WH, 0.9),
      s(rr(30, 10, 40, 40, 11) + rr(30, 52, 40, 42, 11), INK, 3),
      f(rr(34, 45.5, 32, 11, 5.5), LILAC), s(rr(34, 45.5, 32, 11, 5.5), INK, 2.6), s('M39 48.5H61', WH, 2, 0.8),
      s('M35 22Q35 15 41 14', WH, 2.4, 0.9), s('M35 64Q35 57 41 56', WH, 2.4, 0.9),
      s('M68 90Q78 92 80 82', INK, 1.8), f(starPts(82, 80, 5, 6.5, 3), LIME), s(starPts(82, 80, 5, 6.5, 3), INK, 1.8),
    ]
  },
  {
    id: 'y2k_cd', name: '彩虹光碟', cat: 'y2k', color: '#9c86ff', parts: [
      g(circ(50, 50, 44) + circR(50, 50, 7), [14, 14, 86, 86, '#f8f9ff', '#b8bfe2']),
      ...[HOT, LILAC, BABY, LIME].map((c, i) => f(sector(50, 50, 17, 43, -2.5 + i * 0.26, -2.24 + i * 0.26), c, 0.55)),
      ...[HOT, LILAC, BABY, LIME].map((c, i) => f(sector(50, 50, 17, 43, 0.64 + i * 0.26, 0.9 + i * 0.26), c, 0.55)),
      f(circ(50, 50, 15) + circR(50, 50, 7), WH, 0.75),
      s(circ(50, 50, 44), 'M', 3.4), s(circ(50, 50, 15), 'M', 2), s(circ(50, 50, 7), 'M', 2.6),
      f(sparkleD(74, 24, 9, 0.2), WH),
    ]
  },
  {
    id: 'y2k_cherry', name: '亮亮櫻桃', cat: 'y2k', color: HOT, parts: [
      s('M33 62Q38 34 60 14M68 66Q66 36 60 14', '#5aa83a', 3.6),
      f('M60 14C70 4 86 6 92 14C82 22 68 22 60 14Z', LIME), s('M60 14C70 4 86 6 92 14C82 22 68 22 60 14Z', '#5aa83a', 2.4),
      f(circ(32, 72, 19) + circ(70, 74, 19)), s(circ(32, 72, 19) + circ(70, 74, 19), INK, 2.8),
      s('M20 68Q21 59 29 57M58 70Q59 61 67 59', WH, 3.4, 0.95), f(circ(20, 76, 2.4) + circ(58, 78, 2.4), WH, 0.9),
      f(sparkleD(16, 34, 8, 0.22), LILAC),
    ]
  },
  {
    id: 'y2k_planet', name: '圈圈星球', cat: 'y2k', color: HOT, parts: [
      s(PLANET_RING(false), 'M', 7), s(PLANET_RING(false), WH, 2, 0.7),
      g(circ(50, 54, 27), [32, 32, 70, 80, LILAC, BABY]), s(circ(50, 54, 27), INK, 2.8),
      s(PLANET_RING(true), 'M', 7), s(PLANET_RING(true), WH, 2, 0.7),
      s('M33 46Q36 36 46 33', WH, 3.4, 0.9),
      f(sparkleD(84, 18, 9, 0.22), LIME), f(sparkleD(14, 86, 6, 0.22), BABY), f(circ(20, 24, 3), WH),
    ]
  },
  {
    id: 'y2k_checkheart', name: '棋盤格愛心', cat: 'y2k', color: HOT, parts: [
      f(HEART, WH), f(CHECK), s(HEART, INK, 3.4),
      s('M22 36Q24 24 36 22', WH, 4.2),
      f(sparkleD(86, 16, 10, 0.22), LIME),
    ]
  },
  {
    id: 'y2k_bolt', name: '螢光閃電', cat: 'y2k', color: LIME, parts: [
      f(BOLT), s(BOLT, INK, 3.6),
      s('M57 12L32 46', WH, 3.6, 0.95), f(circ(44, 72, 2.4), WH, 0.9),
      f(sparkleD(84, 78, 9, 0.22), HOT), f(sparkleD(20, 18, 6, 0.22), BABY),
    ]
  },
];

// ---------- 日式表情臉（粉彩扁平臉＋細描邊＋顏文字五官） ----------
const EM = '#5a3f36', BLUSH = '#ff8fab', TEAR = '#8ccfff';
// 麻糬臉：比圓稍寬、下巴略平
const mochi = (cx = 50, cy = 51, k = 1) =>
  `M${n(cx)} ${n(cy - 38 * k)}C${n(cx + 24 * k)} ${n(cy - 38 * k)} ${n(cx + 42 * k)} ${n(cy - 22 * k)} ${n(cx + 42 * k)} ${n(cy + 2 * k)}` +
  `C${n(cx + 42 * k)} ${n(cy + 22 * k)} ${n(cx + 24 * k)} ${n(cy + 34 * k)} ${n(cx)} ${n(cy + 34 * k)}` +
  `C${n(cx - 24 * k)} ${n(cy + 34 * k)} ${n(cx - 42 * k)} ${n(cy + 22 * k)} ${n(cx - 42 * k)} ${n(cy + 2 * k)}` +
  `C${n(cx - 42 * k)} ${n(cy - 22 * k)} ${n(cx - 24 * k)} ${n(cy - 38 * k)} ${n(cx)} ${n(cy - 38 * k)}Z`;
const FACE = mochi();
const base = (d = FACE) => [f(d), s(d, EM, 2.8)];
const cheeks = (y = 64, dx = 27, c = BLUSH) => f(ell(50 - dx, y, 6.5, 3.8) + ell(50 + dx, y, 6.5, 3.8), c, 0.7);
const caret = (x, y) => `M${n(x - 6)} ${n(y + 2.5)}L${x} ${n(y - 3.5)}L${n(x + 6)} ${n(y + 2.5)}`; // ^
const gtEye = (x, y, dir = 1) => `M${n(x - 5 * dir)} ${n(y - 5)}L${n(x + 4 * dir)} ${y}L${n(x - 5 * dir)} ${n(y + 5)}`; // > 或 <
const dot = (x, y, r = 3.4) => ell(x, y, r, r * 1.15);
const drop = (x, y, r) => `M${x} ${n(y - r * 1.9)}C${n(x + r * 0.5)} ${n(y - r * 0.9)} ${n(x + r)} ${n(y - r * 0.4)} ${n(x + r)} ${y}` +
  `A${r} ${r} 0 1 1 ${n(x - r)} ${y}C${n(x - r)} ${n(y - r * 0.4)} ${n(x - r * 0.5)} ${n(y - r * 0.9)} ${x} ${n(y - r * 1.9)}Z`;
const zz = (x, y, h) => `M${x} ${y}H${n(x + h)}L${x} ${n(y + h)}H${n(x + h)}`;

const EMOJI = [
  {
    id: 'em_smile', name: '笑瞇瞇', cat: 'emoji', color: '#ffd3b5', parts: [
      ...base(), cheeks(),
      s(caret(35, 53) + caret(65, 53), EM, 3.4),
      s('M42 61q4 5 8 0q4 5 8 0', EM, 3),
    ]
  },
  {
    id: 'em_cry', name: '哭哭', cat: 'emoji', color: '#cfe6ff', parts: [
      ...base(),
      f(rr(31.5, 54, 7, 26, 3.5) + rr(61.5, 54, 7, 26, 3.5), TEAR, 0.9),
      f(ell(35, 60, 1.4, 3) + ell(65, 60, 1.4, 3), WH, 0.9),
      s('M28 53H42M58 53H72', EM, 3.4), s('M29 43L40 40M71 43L60 40', EM, 2.6),
      s('M44 68Q50 62 56 68', EM, 3),
    ]
  },
  {
    id: 'em_wow', name: '嚇一跳', cat: 'emoji', color: '#fff1a8', parts: [
      ...base(), cheeks(65, 28),
      f(dot(35, 53, 4.2) + dot(65, 53, 4.2), EM), f(circ(36.4, 51.4, 1.3) + circ(66.4, 51.4, 1.3), WH),
      s('M29 41Q35 36 41 40M59 40Q65 36 71 41', EM, 2.6),
      f(ell(50, 67, 4.6, 5.6), EM), f(ell(50, 69.5, 2.8, 2.4), '#ff8fa3'),
      s('M89 3.5L87.4 13', '#ff5a7a', 3.6), f(circ(86.6, 19, 2.2), '#ff5a7a'),
    ]
  },
  {
    id: 'em_love', name: '愛心眼', cat: 'emoji', color: '#ffc4d6', parts: [
      ...base(), cheeks(65, 28, '#ff7fa0'),
      f(heartD(34, 53, 17) + heartD(66, 53, 17), '#ff4f8b'), s(heartD(34, 53, 17) + heartD(66, 53, 17), EM, 1.8),
      f(circ(30, 49.5, 1.6) + circ(62, 49.5, 1.6), WH),
      f('M43.5 61C44 71.5 56 71.5 56.5 61Q50 62.5 43.5 61Z', EM), f('M46 67.2Q50 63.6 54 67.2Q50 69.6 46 67.2Z', '#ff8fa3'),
      f(heartD(86, 14, 15), '#ff4f8b'), s(heartD(86, 14, 15), EM, 1.8),
    ]
  },
  (() => {
    const F = mochi(44, 56, 0.88);
    return {
      id: 'em_sleepy', name: '想睡覺', cat: 'emoji', color: '#e4d6ff', parts: [
        ...base(F), f(ell(20, 66, 5.8, 3.4) + ell(68, 66, 5.8, 3.4), BLUSH, 0.7),
        s('M24 56Q30 61 36 56M52 56Q58 61 64 56', EM, 3.2),
        f(ell(44, 68, 2.8, 2.2), EM),
        f(circ(55, 69, 6.5), WH, 0.75), s(circ(55, 69, 6.5), TEAR, 2), f(circ(52.5, 66.5, 1.5), WH),
        s(zz(72, 18, 9) + zz(84, 6, 6.5), '#8b6fd6', 3), s(zz(64, 32, 5), '#8b6fd6', 2.6),
      ]
    };
  })(),
  (() => {
    // 鼓臉：兩頰往外鼓
    const F = 'M50 15C72 15 87 27 88 46C97 51 97 74 84 79C76 86 62 88 50 88C38 88 24 86 16 79C3 74 3 51 12 46C13 27 28 15 50 15Z';
    return {
      id: 'em_angry', name: '鼓臉生氣', cat: 'emoji', color: '#ffc4c4', parts: [
        ...base(F), f(ell(19, 65, 8, 5) + ell(81, 65, 8, 5), '#ff7f8f', 0.6),
        s('M28 43L40 48M72 43L60 48', EM, 3), f(dot(36, 55, 3.4) + dot(64, 55, 3.4), EM),
        s('M45 68q2.5 -4.5 5 0q2.5 4.5 5 0', EM, 2.8),
        s('M80 7Q81 14 87 14M95 9Q88 10 88 16M80 25Q81 19 87 19M95 23Q88 22 88 18', '#ff4f6a', 2.8),
      ]
    };
  })(),
  {
    id: 'em_wink', name: '眨眼吐舌', cat: 'emoji', color: '#c9f0dc', parts: [
      ...base(), cheeks(),
      f(dot(35, 53), EM), s(gtEye(65, 53, -1), EM, 3.4),
      f('M53 63Q60 63 59 70Q58 76 53 75Q48 74 49 68Z', '#ff8fa3'), s('M53 63Q60 63 59 70Q58 76 53 75Q48 74 49 68', EM, 2.2),
      s('M41 62Q49 67 59 61', EM, 3),
      f(starPts(85, 22, 5, 9, 4.2), '#ffd66b'), s(starPts(85, 22, 5, 9, 4.2), EM, 1.8),
    ]
  },
  {
    id: 'em_sparkle', name: '閃亮眼', cat: 'emoji', color: '#ffe0ec', parts: [
      ...base(), cheeks(66, 28),
      f(ell(35, 53, 6, 7.6) + ell(65, 53, 6, 7.6), EM),
      f(circ(33, 49.5, 2.5) + circ(63, 49.5, 2.5), WH), f(circ(37.5, 56.5, 1.3) + circ(67.5, 56.5, 1.3), WH),
      f('M44.5 62C45 70 55 70 55.5 62Q50 63.2 44.5 62Z', EM),
      f(sparkleD(14, 16, 10, 0.2), '#ffd66b'), f(sparkleD(88, 12, 7, 0.2), '#ff9ec7'), f(sparkleD(90, 30, 4, 0.2), '#ffd66b'),
    ]
  },
  {
    id: 'em_sweat', name: '冒冷汗', cat: 'emoji', color: '#ffe6bf', parts: [
      ...base(), cheeks(),
      s('M29 44L40 41M71 44L60 41', EM, 2.6), f(dot(35, 53) + dot(65, 53), EM),
      s('M44 65L56 63', EM, 3),
      f(drop(84, 34, 7), TEAR), s(drop(84, 34, 7), EM, 1.8), f(ell(82, 34, 1.6, 2.6), WH),
    ]
  },
  {
    id: 'em_squint', name: '閉緊眼', cat: 'emoji', color: '#ffc4d6', parts: [
      ...base(), cheeks(65, 25, '#ff7fa0'),
      s(gtEye(35, 53, 1) + gtEye(65, 53, -1), EM, 3.4),
      s('M42 66q2.7 -3 5.3 0q2.7 3 5.3 0q2.7 -3 5.3 0', EM, 2.8),
      s('M18 68L21.5 61.5M23 68L26.5 61.5M28 68L31.5 61.5M68.5 68L72 61.5M73.5 68L77 61.5M78.5 68L82 61.5', '#ff5f8a', 2),
    ]
  },
];

// ---------- 第八版（網站 v10）新增 Y2K：在 stickers.js 換成褪色的版畫／孔版印刷（不用鉻銀漸層） ----------
const rotE = (cx, cy, rx, ry, deg) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  const x1 = n(cx + rx * c), y1 = n(cy + rx * sn), x2 = n(cx - rx * c), y2 = n(cy - rx * sn);
  return `M${x1} ${y1}A${rx} ${ry} ${deg} 1 1 ${x2} ${y2}A${rx} ${ry} ${deg} 1 1 ${x1} ${y1}Z`;
};
const SILVER = '#c9c7c0';
const y2 = (id, name, color, parts, vb) => ({ id, name, cat: 'y2k', color, ...(vb ? { vb } : {}), parts });
const Y2K_V10 = [
  y2('y2k_mp3', '隨身聽', LILAC, [
    f(rr(28, 10, 44, 80, 11)), f(rr(35, 18, 30, 24, 4), BABY), f(circ(50, 66, 15) + circR(50, 66, 5.5), WH),
    s(rr(28, 10, 44, 80, 11), INK, 2.4), s('M60 10Q60 0 74 2Q84 4 86 14', INK, 2),
  ]),
  y2('y2k_headphones', '耳機', HOT, [
    s('M18 62Q16 16 50 16Q84 16 82 62', 'M', 6), f(rr(8, 52, 20, 32, 9)), f(rr(72, 52, 20, 32, 9)),
    f(rr(14, 58, 8, 20, 4) + rr(78, 58, 8, 20, 4), LILAC), f(sparkleD(50, 34, 7, 0.22), LIME),
  ]),
  y2('y2k_digicam', '數位相機', BABY, [
    f(rr(10, 28, 80, 50, 11), SILVER), f(circ(58, 53, 17), INK), f(circ(58, 53, 10)), f(rr(18, 35, 14, 8, 2.5), WH),
    f(rr(68, 20, 14, 9, 3), HOT), s(rr(10, 28, 80, 50, 11), INK, 2.2),
  ]),
  y2('y2k_gamepad', '手把', LILAC, [
    f(roundPoly([[16, 36], [84, 36], [95, 72], [80, 82], [66, 64], [34, 64], [20, 82], [5, 72]], 11)),
    f('M24 46H30V40H36V46H42V52H36V58H30V52H24Z', INK), f(circ(64, 48, 4.5), HOT), f(circ(74, 42, 4.5), BABY), f(circ(74, 54, 4.5), LIME), f(circ(84, 48, 4.5), WH),
  ]),
  y2('y2k_pager', '呼叫器', BABY, [
    f(rr(14, 28, 72, 44, 11)), f(rr(22, 36, 44, 18, 3), LIME), s('M28 45H34M38 45H44M48 45H54', INK, 3),
    f(circ(30, 63, 3.4) + circ(42, 63, 3.4) + circ(54, 63, 3.4), INK), f(rr(72, 36, 6, 28, 3), HOT), f(sparkleD(84, 18, 8, 0.22), HOT),
  ]),
  y2('y2k_lipgloss', '唇蜜', HOT, [
    f(rr(38, 36, 24, 56, 9)), f(rr(42, 52, 16, 34, 6), WH, 0.6), f(rr(40, 8, 20, 30, 6), SILVER), s(rr(40, 8, 20, 30, 6), INK, 1.6),
    f(sparkleD(74, 30, 9, 0.22), LIME), f(sparkleD(24, 62, 6, 0.22), BABY),
  ]),
  y2('y2k_hairclip', '彈簧髮夾', LIME, [
    f('M8 50Q8 38 22 38L86 45Q94 50 86 55L22 62Q8 62 8 50Z'), f(rotE(30, 50, 12, 4.5, 3), WH),
    f(heartD(58, 50, 12) + heartD(74, 50, 9), HOT),
  ], [100, 70]),
  y2('y2k_disco', '迪斯可球', LILAC, [
    s('M50 4V20', INK, 2), f(circ(50, 56, 36), SILVER),
    f([...Array(5)].flatMap((_, i) => [...Array(5)].map((_, j) => ((i + j) % 2 ? '' : rr(26 + i * 10, 32 + j * 10, 8, 8, 1.2)))).join('')),
    s(circ(50, 56, 36), INK, 2.2), f(sparkleD(80, 28, 9, 0.22), HOT), f(sparkleD(18, 84, 6, 0.22), BABY),
  ]),
  y2('y2k_globe', '線框地球', BABY, [
    s(circ(50, 50, 38), 'M', 3.4), s(ell(50, 50, 18, 38) + ell(50, 50, 4, 38), 'M', 2.4),
    s('M15 34H85M12 50H88M15 66H85', 'M', 2.4), f(sparkleD(86, 14, 8, 0.22), HOT),
  ]),
  y2('y2k_cursor', '游標', WH, [
    f(poly([[30, 10], [30, 76], [46, 62], [58, 88], [68, 84], [56, 58], [76, 58]])), s(poly([[30, 10], [30, 76], [46, 62], [58, 88], [68, 84], [56, 58], [76, 58]]), INK, 2.6),
    f(sparkleD(80, 22, 8, 0.22), HOT), f(sparkleD(16, 86, 6, 0.22), BABY),
  ]),
  y2('y2k_window', '小視窗', BABY, [
    f(rr(10, 18, 80, 64, 6), WH), f('M10 24Q10 18 16 18H84Q90 18 90 24V32H10Z'), f(rr(68, 22, 6, 6, 1) + rr(78, 22, 6, 6, 1), WH),
    s(rr(10, 18, 80, 64, 6), INK, 2.2), f(heartD(50, 58, 30), HOT), f(rr(20, 72, 26, 4, 2), LILAC),
  ]),
  y2('y2k_daisy', '小雛菊', WH, [
    f([...Array(8)].map((_, i) => circ(50 + 22 * Math.cos(i * Math.PI / 4), 50 + 22 * Math.sin(i * Math.PI / 4), 13)).join('')),
    f(circ(50, 50, 14), '#e9d79a'), s([...Array(8)].map((_, i) => circ(50 + 22 * Math.cos(i * Math.PI / 4), 50 + 22 * Math.sin(i * Math.PI / 4), 13)).join(''), INK, 1.6, 0.6),
  ]),
  y2('y2k_dice', '絨毛骰子', HOT, [
    f('M50 12L86 30L50 48L14 30Z', LILAC), f('M14 30L50 48V90L14 72Z'), f('M86 30L50 48V90L86 72Z', BABY),
    f(rotE(50, 30, 5, 3, 0) + circ(26, 52, 3.4) + circ(38, 68, 3.4) + circ(62, 56, 3.4) + circ(74, 74, 3.4) + circ(68, 64, 3.4), WH),
  ]),
  y2('y2k_heartlock', '愛心鎖', HOT, [
    s('M34 50V32Q34 16 50 16Q66 16 66 32V50', SILVER, 7), f(heartD(50, 64, 64)), f(circ(50, 58, 5.5) + 'M47 60H53L55 76H45Z', INK),
    f(sparkleD(84, 22, 8, 0.22), LIME),
  ]),
  y2('y2k_orbit', '原子星', BABY, [
    s(rotE(50, 50, 42, 13, 30) + rotE(50, 50, 42, 13, -30) + rotE(50, 50, 42, 13, 90), 'M', 2.6),
    f(sparkleD(50, 50, 15, 0.22), HOT), f(circ(86, 72, 3.4) + circ(14, 28, 3.4), LIME),
  ]),
  // 第九版：補到 30
  y2('y2k_cassette', '錄音帶', BABY, [
    f(rr(8, 24, 84, 54, 6)), f(rr(18, 32, 64, 26, 4), WH), f(circ(36, 45, 7) + circ(64, 45, 7), INK),
    f(rr(30, 64, 40, 14, 3), LILAC), s(rr(8, 24, 84, 54, 6), INK, 2.2),
  ]),
  y2('y2k_heartglasses', '愛心墨鏡', HOT, [
    f(heartD(30, 50, 40) + heartD(70, 50, 40)), s('M40 44Q50 38 60 44', INK, 2.6), s('M12 42L4 36M88 42L96 36', INK, 2.6),
    f(sparkleD(22, 44, 5, 0.22) + sparkleD(62, 44, 5, 0.22), WH),
  ], [100, 80]),
  y2('y2k_lavalamp', '熔岩燈', LILAC, [
    f('M38 14H62L72 72H28Z'), f(ell(48, 34, 6, 8) + ell(56, 56, 8, 9) + ell(44, 62, 5, 4), HOT),
    f('M30 72H70L76 92H24Z', SILVER), f('M40 6H60L62 14H38Z', SILVER), s('M38 14H62L72 72H28Z', INK, 2),
  ]),
  y2('y2k_flowerpower', '復古大花', LIME, [
    f([0, 1, 2, 3, 4, 5].map((i) => { const a = (i * 60 * Math.PI) / 180; return circ(50 + 24 * Math.cos(a), 50 + 24 * Math.sin(a), 18); }).join('')),
    f(circ(50, 50, 16), HOT), f(circ(50, 50, 6), BABY),
  ]),
  y2('y2k_charm', '手機吊飾', HOT, [
    s('M50 4Q30 10 34 30Q38 40 50 40', INK, 1.6),
    f([[46, 12], [40, 20], [37, 28], [42, 36]].map(([x, y]) => circ(x, y, 3.4)).join(''), BABY), f(heartD(52, 58, 40)), f(sparkleD(64, 84, 9, 0.22), LIME),
    f(sparkleD(46, 52, 6, 0.22), WH),
  ]),
];

export const ART_Y2K_EMOJI = [...Y2K, ...Y2K_V10, ...EMOJI];
