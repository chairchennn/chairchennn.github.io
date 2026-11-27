// FilmDoodle — 文具系列原創貼圖（第五版，手帳拼貼風）
//   ART_STAMPS：印章（cat: 'stamp', style: 'stamp'）。只畫「印面」的線稿，所有 f / s 都是 'M'（墨色），
//               由墨水筆刷加上顆粒與缺墨，像橡皮章蓋在照片上。線條偏粗、一致。
//   ART_NOTES ：便條紙、迴紋針、長尾夾（cat: 'note'）。'M' = 紙張／金屬線的主色，線條、格子、陰影用固定色。
// 格式同 stickers.js：{ id, name, cat, color, vb?, parts: [...] }；全部原創繪製，英文字母用線條畫（不用字型）。
import { s, f, circ, ell, poly, starPts, scallop, heartD, n } from './shapes.js';

const { PI, cos, sin, min } = Math;
const g = (d, lg, a) => ({ d, f: { lg }, a }); // 線性漸層填色
// 圓角矩形
const rr = (x, y, w, h, r) => `M${n(x + r)} ${n(y)}H${n(x + w - r)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}V${n(y + h - r)}` +
  `Q${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}H${n(x + r)}Q${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)}V${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Z`;
// 平移（只適用絕對座標命令 M L H V Q C S T A Z 的 path）
const mv = (d, dx, dy) => d.replace(/([MLHVQCSTAZ])([^MLHVQCSTAZ]*)/g, (_, c, args) => {
  const v = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
  const out = v.map((x, i) => {
    if (c === 'H') return n(x + dx);
    if (c === 'V') return n(x + dy);
    if (c === 'A') return i % 7 === 5 ? n(x + dx) : i % 7 === 6 ? n(x + dy) : x;
    return n(x + (i % 2 ? dy : dx));
  });
  return c + out.join(' ');
});
// 一組點繞 (cx,cy) 旋轉
const rotPts = (pts, deg, cx, cy) => {
  const a = (deg * PI) / 180, c = cos(a), sn = sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * c]);
};
// 圓弧取點（a0→a1，弧度）
const arcPts = (cx, cy, r, a0, a1, k = 14) => [...Array(k + 1)].map((_, i) => { const a = a0 + ((a1 - a0) * i) / k; return [cx + r * cos(a), cy + r * sin(a)]; });
// 短線段組成的虛線（沿折線）
function dashes(pts, dash = 4, gap = 3.5) {
  let d = '', on = true, left = dash;
  for (let i = 1; i < pts.length; i++) {
    let [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    let L = Math.hypot(x1 - x0, y1 - y0);
    while (L > 0.001) {
      const step = min(left, L), t = step / L, nx = x0 + (x1 - x0) * t, ny = y0 + (y1 - y0) * t;
      if (on) d += `M${n(x0)} ${n(y0)}L${n(nx)} ${n(ny)}`;
      x0 = nx; y0 = ny; L -= step; left -= step;
      if (left <= 0.001) { on = !on; left = on ? dash : gap; }
    }
  }
  return d;
}

// ===========================================================================
// 線條英文字母（高度 1 的單位座標；寬度另外給）
// ===========================================================================
const GLYPH = {
  L: [0.56, (p) => `M${p(0, 0)}L${p(0, 1)}L${p(0.56, 1)}`],
  O: [0.8, (p) => `M${p(0.4, 0)}C${p(0.64, 0)} ${p(0.8, 0.22)} ${p(0.8, 0.5)}C${p(0.8, 0.78)} ${p(0.64, 1)} ${p(0.4, 1)}` +
    `C${p(0.16, 1)} ${p(0, 0.78)} ${p(0, 0.5)}C${p(0, 0.22)} ${p(0.16, 0)} ${p(0.4, 0)}Z`],
  V: [0.74, (p) => `M${p(0, 0)}L${p(0.37, 1)}L${p(0.74, 0)}`],
  E: [0.56, (p) => `M${p(0.56, 0)}L${p(0, 0)}L${p(0, 1)}L${p(0.56, 1)}M${p(0, 0.5)}L${p(0.46, 0.5)}`],
  F: [0.56, (p) => `M${p(0.56, 0)}L${p(0, 0)}L${p(0, 1)}M${p(0, 0.5)}L${p(0.46, 0.5)}`],
  I: [0, (p) => `M${p(0, 0)}L${p(0, 1)}`],
  M: [0.86, (p) => `M${p(0, 1)}L${p(0, 0)}L${p(0.43, 0.6)}L${p(0.86, 0)}L${p(0.86, 1)}`],
  H: [0.64, (p) => `M${p(0, 0)}L${p(0, 1)}M${p(0.64, 0)}L${p(0.64, 1)}M${p(0, 0.5)}L${p(0.64, 0.5)}`],
  A: [0.76, (p) => `M${p(0, 1)}L${p(0.38, 0)}L${p(0.76, 1)}M${p(0.15, 0.64)}L${p(0.61, 0.64)}`],
  P: [0.58, (p) => `M${p(0, 1)}L${p(0, 0)}L${p(0.28, 0)}C${p(0.66, 0)} ${p(0.66, 0.54)} ${p(0.28, 0.54)}L${p(0, 0.54)}`],
  Y: [0.74, (p) => `M${p(0, 0)}L${p(0.37, 0.5)}L${p(0.74, 0)}M${p(0.37, 0.5)}L${p(0.37, 1)}`],
};
// 置中排一個英文字：cx, cy 為中心，h 為字高，track 為字距（字高的倍數）
function word(str, cx, cy, h, track = 0.34) {
  const ws = [...str].map((c) => GLYPH[c][0] * h), total = ws.reduce((a, b) => a + b, 0) + track * h * (str.length - 1);
  let x = cx - total / 2, d = '';
  [...str].forEach((c, i) => {
    const x0 = x, y0 = cy - h / 2;
    d += GLYPH[c][1]((u, v) => `${n(x0 + u * h)} ${n(y0 + v * h)}`);
    x += ws[i] + track * h;
  });
  return d;
}

// ===========================================================================
// 印章（墨色：朱紅、藍、綠、莓紅）
// ===========================================================================
const INK_R = '#e0574f', INK_B = '#4a6fb5', INK_G = '#3e8a6e', INK_P = '#b0477a';
const SW = 5.5, SW2 = 3.4; // 外框／內線
const st = (d, w = SW) => s(d, 'M', w);
const sf = (d) => f(d, 'M');

// 郵票齒孔框：沿矩形邊緣每隔 step 咬一個半圓
function perfRect(x0, y0, x1, y1, r, k) {
  let d = `M${n(x0)} ${n(y0)}`;
  const edge = (ax, ay, bx, by, cnt) => {
    const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = uy, ny = -ux; // 內側法向量
    const step = L / cnt;
    for (let i = 0; i < cnt; i++) {
      const mx = ax + ux * step * (i + 0.5), my = ay + uy * step * (i + 0.5);
      d += `L${n(mx - ux * r)} ${n(my - uy * r)}`;
      d += `A${r} ${r} 0 0 0 ${n(mx + ux * r)} ${n(my + uy * r)}`;
    }
    d += `L${n(bx)} ${n(by)}`;
    return [nx, ny];
  };
  edge(x0, y0, x1, y0, k[0]); edge(x1, y0, x1, y1, k[1]); edge(x1, y1, x0, y1, k[0]); edge(x0, y1, x0, y0, k[1]);
  return d + 'Z';
}

const POST_WAVES = [20, 32, 44].map((y) => `M64 ${y}q5 -5.5 10 0t10 0t10 0`).join('');
const BUBBLE = 'M50 12C74 12 90 24 90 42C90 60 74 71 52 71L36 86L38 69C21 66 10 56 10 42C10 24 26 12 50 12Z';
const CLOUD = 'M24 66C12 66 8 52 18 47C14 34 30 26 39 33C43 20 64 18 70 32C82 28 93 40 86 50C94 56 88 68 78 66Z';
const RIBBON_MAIN = 'M14 10H86V36H14Z';
const RIBBON_TAIL_L = 'M14 18H3L9 31L3 44H22L14 36M22 44V36'; // 左尾巴（只畫露出來的部分）＋折角
const RIBBON_TAIL_R = 'M86 18H97L91 31L97 44H78L86 36M78 44V36';
const CAMERA = rr(12, 32, 76, 50, 10);
const CAM_TOP = 'M34 32L38 22Q39 20 41.5 20H58.5Q61 20 62 22L66 32';
const TICKET = (() => { // 兩側半圓缺口的票根
  const x0 = 6, y0 = 8, x1 = 94, y1 = 56, r = 7, cy = 32;
  return `M${x0 + 4} ${y0}H${x1 - 4}Q${x1} ${y0} ${x1} ${y0 + 4}V${cy - r}A${r} ${r} 0 0 0 ${x1} ${cy + r}V${y1 - 4}Q${x1} ${y1} ${x1 - 4} ${y1}` +
    `H${x0 + 4}Q${x0} ${y1} ${x0} ${y1 - 4}V${cy + r}A${r} ${r} 0 0 0 ${x0} ${cy - r}V${y0 + 4}Q${x0} ${y0} ${x0 + 4} ${y0}Z`;
})();
const FILM_HOLES = (y) => [...Array(7)].map((_, i) => rr(13 + i * 11.5, y, 5.2, 4.6, 1.4)).join('');
const raindrop = (x, y, k) => `M${x} ${y - 7 * k}C${n(x + 1.5 * k)} ${n(y - 3 * k)} ${n(x + 4.5 * k)} ${n(y - 1 * k)} ${n(x + 4.5 * k)} ${n(y + 2 * k)}` +
  `C${n(x + 4.5 * k)} ${n(y + 5 * k)} ${n(x + 2.4 * k)} ${n(y + 6.6 * k)} ${x} ${n(y + 6.6 * k)}C${n(x - 2.4 * k)} ${n(y + 6.6 * k)} ${n(x - 4.5 * k)} ${n(y + 5 * k)} ${n(x - 4.5 * k)} ${n(y + 2 * k)}` +
  `C${n(x - 4.5 * k)} ${n(y - 1 * k)} ${n(x - 1.5 * k)} ${n(y - 3 * k)} ${x} ${n(y - 7 * k)}Z`;

const STAMP_DEFS = [
  {
    id: 'st_postmark', name: '圓形郵戳', color: INK_B, vb: [100, 64], parts: [
      st(circ(32, 32, 27)), st(circ(32, 32, 19.5), SW2 * 0.8),
      sf([...Array(16)].map((_, i) => { const a = (i / 16) * PI * 2; return circ(32 + 23.2 * cos(a), 32 + 23.2 * sin(a), 1.25); }).join('')),
      sf(starPts(32, 30, 5, 9, 4.2)), st(starPts(32, 30, 5, 9, 4.2), 2.6),
      st('M24 41.5H40', SW2),
      st(POST_WAVES, SW2 + 0.6),
    ]
  },
  {
    id: 'st_perf', name: '郵票框', color: INK_G, vb: [84, 100], parts: [
      st(perfRect(8, 8, 76, 92, 3, [7, 9]), 3.6),
      st(rr(16, 16, 52, 68, 3), SW2),
      sf(circ(54, 33, 7)),
      st('M22 72L36 44L44 56L50 48L62 72', SW2 + 0.6),
      st('M31.5 53L34.5 55.5L37.5 52L40.5 54.5', 2.6),
      st('M22 78H62', SW2),
      st('M24 32q3.5 -3.5 7 0t7 0', 2.8),
    ]
  },
  {
    id: 'st_love', name: 'LOVE 愛心章', color: INK_R, parts: [
      st(heartD(50, 55, 90)), st(heartD(50, 55, 74), 2.4),
      st(word('LOVE', 50, 51, 12.5, 0.3), 3.6),
      sf(heartD(50, 69, 8)),
    ]
  },
  {
    id: 'st_star', name: '星星章', color: INK_P, parts: [
      st(scallop(50, 50, 16, 40, 45.5, -PI / 2, 0.1), 4.6),
      st(circ(50, 50, 32), 2.6),
      sf(starPts(50, 52, 5, 22, 10.5)), st(starPts(50, 52, 5, 22, 10.5), 4.5),
    ]
  },
  {
    id: 'st_camera', name: '相機章', color: INK_B, parts: [
      st(CAMERA), st(CAM_TOP),
      st(circ(50, 57, 16.5)), sf(circ(50, 57, 7.5)),
      sf(rr(20, 39, 10, 6, 2)), sf(circ(77, 42, 3.4)),
      st('M12 49H33.5M66.5 49H88', SW2 * 0.8),
    ]
  },
  {
    id: 'st_flower', name: '小花章', color: INK_P, parts: [
      st(scallop(50, 38, 5, 11, 33, -PI / 2, 0.08)),
      sf(circ(50, 38, 7.5)),
      st('M50 58C50 70 48 80 50 94', SW),
      sf('M49 80C40 80 30 76 26 66C36 64 45 70 49 80Z'),
      sf('M51 74C58 72 68 66 72 58C62 56 54 64 51 74Z'),
    ]
  },
  {
    id: 'st_film', name: '底片章', color: INK_R, vb: [100, 64], parts: [
      st(rr(6, 6, 88, 52, 4)),
      sf(FILM_HOLES(11)), sf(FILM_HOLES(48.4)),
      st(rr(11, 20, 22, 24, 2), SW2), st(rr(39, 20, 22, 24, 2), SW2), st(rr(67, 20, 22, 24, 2), SW2),
      sf(heartD(22, 32.5, 13)), sf(starPts(50, 33, 5, 8, 3.6)), st(starPts(50, 33, 5, 8, 3.6), 2.2), sf(circ(78, 32, 5.6)),
    ]
  },
  {
    id: 'st_bubble', name: '對話框愛心', color: INK_R, parts: [
      st(BUBBLE), sf(heartD(50, 43, 34)),
      st('M84 8L88 3M92 16L98 14M90 9L96 5', 3.6),
    ]
  },
  {
    id: 'st_check', name: '勾勾章', color: INK_G, parts: [
      st(circ(50, 50, 41)), st(circ(50, 50, 34), 2.4),
      s('M30 51L44 64L71 35', 'M', 9.5),
    ]
  },
  {
    id: 'st_cloud', name: '雲朵雨滴', color: INK_B, parts: [
      st(CLOUD),
      sf(raindrop(34, 82, 1)), sf(raindrop(54, 88, 1)), sf(raindrop(73, 81, 1)),
      st('M24 52Q21 44 29 41', SW2 * 0.8),
    ]
  },
  {
    id: 'st_ticket', name: 'FILM 票根章', color: INK_G, vb: [100, 64], parts: [
      st(TICKET, 4.6),
      st(dashes([[67, 13], [67, 51]], 4, 3.6), 3),
      st(word('FILM', 37.5, 32, 13.5, 0.3), 3.8),
      sf(starPts(77, 32.5, 5, 5.6, 2.5)), st(starPts(77, 32.5, 5, 5.6, 2.5), 2.2),
    ]
  },
  {
    id: 'st_happy', name: 'HAPPY 緞帶章', color: INK_R, vb: [100, 54], parts: [
      st(RIBBON_TAIL_L, 4.2), st(RIBBON_TAIL_R, 4.2),
      st(RIBBON_MAIN, 4.6),
      st(word('HAPPY', 50, 23, 11.5, 0.28), 3.4),
    ]
  },
];
export const ART_STAMPS = STAMP_DEFS.map((d) => ({ ...d, cat: 'stamp', style: 'stamp' }));

// ===========================================================================
// 便條紙、迴紋針（'M' = 紙或金屬線的主色）
// ===========================================================================
const SHADOW = '#6b4a3f', EDGE = '#b8a08f', BLUE_LN = '#a9c8e6', PINK_LN = '#f0a3b6', PINK = '#f28fa9';
const shade = (d, dx = 2, dy = 3) => [f(mv(d, dx * 1.6, dy * 1.6), SHADOW, 0.06), f(mv(d, dx, dy), SHADOW, 0.12)];
const sheen = (d, y0, y1) => g(d, [0, y0, 0, y1, 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']);
const edge = (d) => s(d, EDGE, 1.2, 0.55);
const paper = (d, y0, y1) => [...shade(d), f(d), sheen(d, y0, y1), edge(d)];

// --- 便利貼（右下角翹起） ---
const STICKY = 'M14 12H86V66Q80 78 66 86H14Z';
const STICKY_FLAP = 'M86 66Q78 68 72 72Q68 78 66 86Q74 84 79 79Q84 74 86 66Z';
// --- 方格紙片（上緣撕邊） ---
const TORN_TOP = [[10, 18], [15, 15.5], [19, 18.5], [24, 15], [29, 17.5], [33, 14.5], [38, 17.8], [43, 15.2], [48, 18.2], [53, 15], [58, 17], [63, 14.6],
  [68, 18], [73, 15.4], [78, 17.6], [83, 15], [90, 17.2]];
const GRID_PAPER = poly([...TORN_TOP, [90, 88], [10, 88]]);
const tornY = (x) => { // 撕邊在 x 的高度
  for (let i = 1; i < TORN_TOP.length; i++) {
    const [x0, y0] = TORN_TOP[i - 1], [x1, y1] = TORN_TOP[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return TORN_TOP[TORN_TOP.length - 1][1];
};
const GRID_LINES = (() => {
  let d = '';
  for (let x = 18; x <= 82; x += 8) d += `M${x} ${n(tornY(x) + 1.2)}V88`;
  for (let y = 24; y <= 84; y += 8) d += `M10 ${y}H90`;
  return d;
})();
// --- 橫線便條 ---
const LINED = rr(13, 10, 74, 82, 4);
const LINED_TAPE = poly(rotPts([[36, 3], [64, 3], [64, 15], [36, 15]], -4, 50, 9));
// --- 線圈筆記本撕下的紙 ---
const SPIRAL_HOLES = [...Array(8)].map((_, i) => 18.5 + i * 9);
const SPIRAL = (() => {
  let d = 'M12 12';
  SPIRAL_HOLES.forEach((x) => { d += `L${n(x - 3)} 12C${n(x - 3)} 19 ${n(x + 3)} 19 ${n(x + 3)} 12`; });
  return d + 'L88 12V92H12Z';
})();
// --- 牛皮紙吊牌 ---
const TAG = 'M16 36L30 18Q32 16 35 16H49Q52 16 54 18L68 36V88Q68 92 64 92H20Q16 92 16 88Z';
// --- 索引卡 ---
const INDEX = rr(6, 8, 88, 56, 3);
// --- 信封 ---
const ENV = rr(8, 12, 84, 54, 4);
const ENV_FLAP = 'M10 14L50 44L90 14';
// --- 迴紋針 ---
const clipPath = (() => {
  const pts = [
    [30, 30], [30, 70], ...arcPts(37, 70, 7, PI, 0).slice(1), [44, 22], ...arcPts(33, 22, 11, 0, -PI).slice(1),
    [22, 76], ...arcPts(36, 76, 14, PI, 0).slice(1), [50, 32],
  ];
  return poly(rotPts(pts, 24, 36, 50).map(([x, y]) => [x + 14, y]), false);
})();
// --- 愛心迴紋針：外圈一顆愛心，裡面一顆開口的小愛心 ---
const heartPts = (cx, cy, k, t0 = 0, t1 = 2 * PI, N = 64) => [...Array(N + 1)].map((_, i) => {
  const t = t0 + ((t1 - t0) * i) / N;
  return [cx + k * 16 * sin(t) ** 3, cy - k * (13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t))];
});
const HEART_CLIP = (() => {
  const outer = heartPts(50, 45, 2.25, PI, 3 * PI), tip = outer[0];
  const inner = heartPts(50, 45.5, 1.42, PI + 0.42, 3 * PI - 0.42, 48);
  return poly(outer, true) + poly([tip, ...inner, tip], false);
})();
// --- 長尾夾 ---
// 長尾夾：握把往前折下來，夾著一小張橫線紙（這樣小尺寸也看得出是夾子）
const BINDER = 'M17 12L63 12L69 40Q70 44 66 44L14 44Q10 44 11 40Z', BINDER_LIP = rr(13, 7, 54, 9, 4.5);
const BINDER_WIRE = 'M14.5 11.5L17 60Q17.5 66 23 66L57 66Q62.5 66 63 60L65.5 11.5';
const BINDER_PAPER = 'M20 30L60 30L62 78L18 78Z';

export const ART_NOTES = [
  {
    id: 'nt_sticky', name: '便利貼', color: '#fff1a8', parts: [
      ...shade(STICKY), f('M86 66Q80 78 66 86L76 88Q86 82 88 70Z', SHADOW, 0.1),
      f(STICKY), f(rr(14, 12, 72, 12, 0), SHADOW, 0.05), sheen(STICKY, 12, 70), edge(STICKY),
      f(STICKY_FLAP), g(STICKY_FLAP, [70, 72, 84, 84, 'rgba(255,255,255,0.75)', 'rgba(107,74,63,0.12)']), edge(STICKY_FLAP),
    ]
  },
  {
    id: 'nt_grid', name: '方格紙片', color: '#fffdf6', parts: [
      ...shade(GRID_PAPER), f(GRID_PAPER), s(GRID_LINES, BLUE_LN, 1, 0.75), sheen(GRID_PAPER, 14, 70), edge(GRID_PAPER),
    ]
  },
  {
    id: 'nt_lined', name: '橫線便條', color: '#fff7f3', parts: [
      ...paper(LINED, 10, 80),
      s([30, 42, 54, 66, 78].map((y) => `M31 ${y}H79`).join(''), PINK_LN, 1.5, 0.8),
      ...[30, 42, 54, 66, 78].map((y) => f(heartD(23, y - 1.2, 7.5), PINK)),
      f(LINED_TAPE, '#bcd9ef', 0.75), s(LINED_TAPE, '#ffffff', 1, 0.5),
    ]
  },
  {
    id: 'nt_spiral', name: '筆記本撕頁', color: '#fffefa', parts: [
      ...paper(SPIRAL, 12, 80),
      s([36, 46, 56, 66, 76, 86].map((y) => `M14 ${y}H86`).join(''), BLUE_LN, 1.1, 0.8),
      s('M24 28V90', PINK_LN, 1.2, 0.8),
    ]
  },
  {
    id: 'nt_tag', name: '牛皮紙吊牌', color: '#ddb98f', vb: [84, 100], parts: [
      ...paper(TAG, 16, 80),
      s(dashes([[22, 40], [34, 24], [50, 24], [62, 40], [62, 85], [22, 85], [22, 40]], 3, 2.6), '#ffffff', 1.4, 0.6),
      f(circ(42, 30, 6.5), '#f4e7d4'), s(circ(42, 30, 6.5), EDGE, 1, 0.6), f(circ(42, 30, 3.2), '#8a6a58', 0.55),
      s('M42 30C34 22 30 10 38 5C46 1 56 6 50 16Q47 21 43 27', '#e08a95', 2.4),
      f(heartD(42, 66, 13), '#e9798f', 0.85),
    ]
  },
  {
    id: 'nt_index', name: '索引卡', color: '#ffffff', vb: [100, 72], parts: [
      ...paper(INDEX, 8, 60),
      s('M6 20H94', PINK, 1.8, 0.9),
      s([30, 39, 48, 57].map((y) => `M6 ${y}H94`).join(''), BLUE_LN, 1.1, 0.85),
    ]
  },
  {
    id: 'nt_envelope', name: '信封', color: '#fbe4e2', vb: [100, 78], parts: [
      ...paper(ENV, 12, 66),
      s('M10 64L40 38M90 64L60 38', EDGE, 1.2, 0.5),
      f('M10 14L50 44L90 14Z', SHADOW, 0.05), s(ENV_FLAP, EDGE, 1.4, 0.7),
      f(heartD(50, 44, 15), '#e9798f'), f(ell(46.5, 40.5, 1.8, 1.2), '#ffffff', 0.7),
    ]
  },
  {
    id: 'nt_heartclip', name: '愛心迴紋針', color: '#f4a3b6', parts: [
      s(HEART_CLIP, SHADOW, 6.4, 0.28), s(HEART_CLIP, 'M', 4.2),
      s(poly(heartPts(50, 45, 2.25, PI * 1.55, PI * 1.85, 10), false), '#ffffff', 1.4, 0.75),
    ]
  },
  {
    id: 'nt_clip', name: '迴紋針', color: '#8dbbe3', parts: [
      s(clipPath, SHADOW, 6, 0.28), s(clipPath, 'M', 4),
    ]
  },
  {
    id: 'nt_binder', name: '長尾夾', color: '#f6a9ba', vb: [80, 84], parts: [
      ...shade(BINDER_PAPER), f(BINDER_PAPER, '#fffdf6'), edge(BINDER_PAPER),
      s('M24 52H56M24 60H56M24 68H50', BLUE_LN, 1.1, 0.8),
      s(mv(BINDER_WIRE, 2, 3), SHADOW, 3.6, 0.12),
      ...shade(BINDER), f(BINDER), g(BINDER, [0, 12, 0, 44, 'rgba(255,255,255,0.35)', 'rgba(107,74,63,0.14)']), edge(BINDER),
      s('M14 39.5H66', SHADOW, 1.4, 0.25),
      f(BINDER_LIP), g(BINDER_LIP, [0, 7, 0, 16, 'rgba(255,255,255,0.6)', 'rgba(107,74,63,0.14)']), edge(BINDER_LIP),
      f(heartD(40, 27, 11), '#ffffff', 0.8),
      s(BINDER_WIRE, SHADOW, 5.2, 0.25), s(BINDER_WIRE, '#d8d4de', 3.2), s('M17.6 20L18.8 44', '#ffffff', 1.1, 0.7),
      ...[14.5, 65.5].flatMap((x) => [f(circ(x, 11.5, 3.2), '#d8d4de'), s(circ(x, 11.5, 3.2), SHADOW, 1, 0.3)]),
    ]
  },
].map((d) => ({ ...d, cat: 'note' }));
