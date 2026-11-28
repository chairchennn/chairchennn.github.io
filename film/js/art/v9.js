// FilmDoodle — 第八版（網站 v10）素材：8-bit 像素、連連看星星、蠟筆貓咪、更多十字繡／點描圖案
// 風格依 film/STYLE.md：只學技法（像素格、淡藍色鉛筆＋編號點＋水鑽、稚拙蠟筆斜線塗色＋細線鬍鬚），
// 全部原創造型；不照搬參考圖的構圖（不做時鐘排列、不抄某一隻貓的姿勢、不做三顆星連成一串）。
// 像素圖案不放任何遊戲角色、遊戲道具或商標。
// 筆刷在 js/print.js：drawPixelDef / drawDotstarDef / drawScribbleDef / drawStitchDef / drawStippleDef。
import { n, poly } from './shapes.js';

const { PI, cos, sin, hypot, atan2, max, min, abs } = Math;
const RAD = PI / 180;
const pt = (p) => `${n(p[0])} ${n(p[1])}`;

// ---------- 小工具 ----------
function crSegs(pts, closed) {
  const N = pts.length, at = (i) => (closed ? pts[(i + N) % N] : pts[max(0, min(N - 1, i))]);
  const out = [];
  for (let i = 0; i < (closed ? N : N - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    out.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
  }
  return out;
}
const segD = (segs) => `M${pt(segs[0][0])}` + segs.map(([, a, b, c]) => `C${pt(a)} ${pt(b)} ${pt(c)}`).join('');
const blob = (pts) => segD(crSegs(pts, true)) + 'Z';
const curve = (pts) => segD(crSegs(pts, false));
function crSample(pts, k = 8) {
  const out = [];
  crSegs(pts, false).forEach(([p0, c1, c2, p3]) => {
    for (let j = 0; j < k; j++) {
      const t = j / k, u = 1 - t;
      out.push([0, 1].map((c) => u * u * u * p0[c] + 3 * u * u * t * c1[c] + 3 * u * t * t * c2[c] + t * t * t * p3[c]));
    }
  });
  out.push(pts[pts.length - 1]);
  return out;
}
function ellR(cx, cy, rx, ry, deg = 0) {
  const c = cos(deg * RAD), s = sin(deg * RAD);
  const p1 = [cx + rx * c, cy + rx * s], p2 = [cx - rx * c, cy - rx * s];
  return `M${pt(p1)}A${n(rx)} ${n(ry)} ${n(deg)} 1 1 ${pt(p2)}A${n(rx)} ${n(ry)} ${n(deg)} 1 1 ${pt(p1)}Z`;
}
const circle = (cx, cy, r) => ellR(cx, cy, r, r);
// 圓角多邊形：稚拙但不尖
function soft(pts, r = 3) {
  const N = pts.length, rr = (i) => (Array.isArray(r) ? r[i % r.length] : r);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const cut = (v, w, i) => { const L = hypot(w[0] - v[0], w[1] - v[1]) || 1; return lerp(v, w, min(rr(i) / L, 0.45)); };
  let d = '';
  for (let i = 0; i < N; i++) {
    const v = pts[i], a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
    d += (i ? 'L' : 'M') + pt(cut(v, a, i)) + 'Q' + pt(v) + ' ' + pt(cut(v, b, i));
  }
  return d + 'Z';
}
// 漸細的帶子（尾巴、腳）：沿著一條線，起點寬 w0、終點寬 w1，兩端圓頭
function ribbon(pts, w0, w1, k = 8, caps = true) {
  const S = crSample(pts, k), L = [0];
  for (let i = 1; i < S.length; i++) L.push(L[i - 1] + hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
  const tot = L[L.length - 1] || 1, left = [], right = [];
  S.forEach((p, i) => {
    const a = S[max(0, i - 1)], b = S[min(S.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = hypot(dx, dy) || 1;
    const hw = (w0 + (w1 - w0) * (L[i] / tot)) / 2, nx = -dy / m, ny = dx / m;
    left.push([p[0] + nx * hw, p[1] + ny * hw]);
    right.push([p[0] - nx * hw, p[1] - ny * hw]);
  });
  const e = S[S.length - 1], s0 = S[0];
  return poly([...left, ...right.reverse()]) + (caps ? circle(e[0], e[1], w1 / 2) + circle(s0[0], s0[1], w0 / 2) : '');
}
// 手畫的星（arms：每隻角長短；round：角的圓度）
function handStar(cx, cy, ro, ri, rot = -90, arms = [0], k = 5, round = 2.2) {
  const pts = Array.from({ length: k * 2 }, (_, i) => {
    const a = (rot + (i * 180) / k) * RAD, r = i % 2 ? ri * (1 + 0.6 * arms[((i - 1) / 2 + 2) % arms.length]) : ro * (1 + arms[(i / 2) % arms.length]);
    return [cx + r * cos(a), cy + r * sin(a)];
  });
  return soft(pts, pts.map((_, i) => (i % 2 ? round * 1.4 : round)));
}
const starTips = (cx, cy, ro, rot = -90, arms = [0], k = 5) => Array.from({ length: k }, (_, i) => {
  const a = (rot + (i * 360) / k) * RAD, r = ro * (1 + arms[i % arms.length]);
  return [cx + r * cos(a), cy + r * sin(a)];
});

// =====================================================================
// 8-bit 像素（原創小圖；低飽和色票；外框自動加一圈「主色加深」）
// 字母：M 主色、l 主色亮、d 主色深（也是自動外框），其他見 print.js 的 PIX_PAL
// =====================================================================
function outline(rows, ol = 'd') {
  const W = rows[0].length + 2, H = rows.length + 2;
  const g = Array.from({ length: H }, (_, j) => Array.from({ length: W }, (_, i) => (rows[j - 1]?.[i - 1]) || '.'));
  const filled = (i, j) => g[j]?.[i] && g[j][i] !== '.' && g[j][i] !== '_';
  const out = g.map((row, j) => row.map((ch, i) => {
    if (ch === '_') return '.'; // '_'：刻意留空、不加外框
    if (ch !== '.') return ch;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled(i + dx, j + dy)) ? ol : '.';
  }));
  // 去掉全空的外圈
  const strs = out.map((r) => r.join(''));
  while (strs.length && /^\.*$/.test(strs[0])) strs.shift();
  while (strs.length && /^\.*$/.test(strs[strs.length - 1])) strs.pop();
  let L = 0, R = 0;
  while (strs.every((s) => s[L] === '.')) L++;
  while (strs.every((s) => s[s.length - 1 - R] === '.')) R++;
  return strs.map((s) => s.slice(L, s.length - R));
}
// 用函式畫點陣：fn(x, y) → 字母或 null（x, y 是格子中心，以圖中心為 0）
function raster(w, h, fn) {
  return Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => fn(i + 0.5 - w / 2, j + 0.5 - h / 2) || '.').join(''));
}
const pixel = (id, name, color, rows, o = {}) => {
  const grid = o.raw ? rows : outline(rows, o.ol);
  // parts：給一般繪圖和「能不能換色」判斷用（每個顏色一組方塊）
  const chars = [...new Set(grid.join('').replace(/\./g, ''))];
  const parts = chars.map((ch) => ({
    f: ch === 'M' || ch === 'd' || ch === 'l' ? 'M' : ch,
    d: grid.flatMap((row, j) => [...row].map((c, i) => (c === ch ? `M${i} ${j}h1v1h-1Z` : ''))).join(''),
  }));
  return { id, name, cat: 'pixel', style: 'pixel', color, grid, vb: [grid[0].length, grid.length], parts };
};
const PB = '#9CB9D0', PL = '#A99BC5', PS = '#A6B58A', PT = '#CB8875', PC = '#E9D79A', PR = '#D9A3A0', PK = '#65645D', PI2 = '#F4EEDF';

export const ART_PIXEL = [
  pixel('px_heart', '像素愛心', PR, [
    '.MM...MM.',
    'MlMM.MMMM',
    'MlMMMMMMM',
    'MMMMMMMMM',
    '.MMMMMMM.',
    '..MMMMM..',
    '...MMM...',
    '....M....',
  ]),
  pixel('px_star', '像素星星', PC, [
    '....M....',
    '...MlM...',
    '...MMM...',
    'MMMMMMMMM',
    '.MMMMMMM.',
    '..MMMMM..',
    '..MMMMM..',
    '.MMM.MMM.',
    '.MM...MM.',
  ]),
  pixel('px_flower', '像素小花', PR, [
    '...MMM...',
    '..MlMMM..',
    '.MMMMMMM.',
    'MMMMyMMMM',
    'MlMyyyMMM',
    'MMMMyMMMM',
    '.MMMMMMM.',
    '..MMMMM..',
    '...MMM...',
    '....g....',
    '.gg.g....',
    '..ggg....',
    '....g....',
  ]),
  pixel('px_daisy', '像素雛菊', PI2, [
    '...M.M...',
    '.M.M.M.M.',
    '..MMMMM..',
    'MMMyyyMMM',
    '..MyyyM..',
    'MMMyyyMMM',
    '..MMMMM..',
    '.M.M.M.M.',
    '...M.M...',
  ], { ol: 's' }),
  pixel('px_cloud', '像素雲', PI2, raster(14, 8, (x, y) => {
    const inC = (cx, cy, r) => (x - cx) ** 2 + ((y - cy) * 1.1) ** 2 <= r * r;
    if (y > 3) return null;
    if (inC(-1, -0.5, 3.6) || inC(-4.2, 1.2, 2.6) || inC(3, 0.6, 3) || (y > 0 && y < 3.4 && abs(x) < 6)) return inC(-2, -2, 1.4) ? 'l' : 'M';
    return null;
  }), { ol: 'b' }),
  pixel('px_moon', '像素月亮', PC, raster(10, 11, (x, y) => {
    const a = x * x + y * y <= 25, b = (x - 2.4) ** 2 + (y + 1) ** 2 <= 17;
    return a && !b ? ((x + 3.2) ** 2 + (y + 0.5) ** 2 < 2 ? 'l' : 'M') : null;
  })),
  pixel('px_sun', '像素太陽', PC, [
    '.....M.....',
    '.M...M...M.',
    '..M.....M..',
    '....MMM....',
    '...MlMMM...',
    'MM.MMMMM.MM',
    '...MMMMM...',
    '....MMM....',
    '..M.....M..',
    '.M...M...M.',
    '.....M.....',
  ]),
  pixel('px_mushroom', '像素蘑菇', PT, [
    '...MMMM...',
    '.MMwwMMMM.',
    'MMMwwMMwMM',
    'MMMMMMMMMM',
    'MwMMMMwwMM',
    '..wwwwww..',
    '...wwww...',
    '...wwww...',
    '..wwwwww..',
  ]),
  pixel('px_gem', '像素寶石', PL, [
    '..ddddd..',
    '.dlMlMMd.',
    'dllMMMMMd',
    'dddddddd.',
    '.dlMMMMd.',
    '..dlMMd..',
    '...dMd...',
    '....d....',
  ].map((r) => r.padEnd(9, '.'))),
  pixel('px_note', '像素音符', PL, [
    '....MM..',
    '....MlM.',
    '....M.MM',
    '....M..M',
    '....M...',
    '.MMMM...',
    'MlMMM...',
    'MMMMM...',
    '.MMM....',
  ]),
  pixel('px_sparkle', '像素閃光', PI2, [
    '...M...',
    '...M...',
    '..MlM..',
    'MMMMMMM',
    '..MMM..',
    '...M...',
    '...M...',
  ], { ol: 'b' }),
  pixel('px_bird', '像素小鳥', PB, [
    '...MMM.....',
    '..MkMMM....',
    'yyMMMMM....',
    '..MMMMMMMM.',
    '..MwwMMlMMM',
    '...wwwMMM..',
    '....wwwM...',
    '.....y.y...',
  ]),
  pixel('px_tulip', '像素鬱金香', PT, [
    '.M.M.M.',
    '.MMMMM.',
    '.MlMMM.',
    '.MMMMM.',
    '..MMM..',
    '...g...',
    'g..g..g',
    'gg.g.gg',
    '.gggg..',
    '...g...',
  ]),
  pixel('px_leaf', '像素葉子', PS, [
    '......MM',
    '....MMMM',
    '..MMlMdM',
    '.MMlMdMM',
    '.MMdMMM.',
    'MMdMMM..',
    'MdMM....',
    'd.......',
  ]),
  pixel('px_cherry', '像素櫻桃', PT, [
    '.......gg..',
    '......gg...',
    '.....g.g...',
    '....g...g..',
    '...g....g..',
    '.MMM...MMM.',
    'MlMMM.MlMMM',
    'MMMMM.MMMMM',
    '.MMM...MMM.',
  ]),
  pixel('px_drop', '像素雨滴', PB, raster(7, 10, (x, y) => {
    const ok = y > -0.2 ? x * x + (y - 1.6) ** 2 <= 10 : abs(x) <= (y + 5) * 0.7;
    return ok ? ((x + 1) ** 2 + (y - 0.6) ** 2 < 1.2 ? 'l' : 'M') : null;
  })),
  pixel('px_butterfly', '像素蝴蝶', PL, [
    '.MM.....MM.',
    'MlMM...MMlM',
    'MMMMM.MMMMM',
    'MMyMMkMMyMM',
    '.MMMMkMMMM.',
    '..MMMkMMM..',
    '.MMM.k.MMM.',
    '.MM.....MM.',
  ]),
  pixel('px_cup', '像素茶杯', PB, [
    '..w..w...',
    '...w..w..',
    'MMMMMMM..',
    'MlwMMMMMM',
    'MlMMMMM.M',
    'MMMMMMMMM',
    '.MMMMM...',
    'ccccccc..',
  ].map((r) => r.padEnd(9, '.'))),
  pixel('px_apple', '像素蘋果', PS, [
    '....c....',
    '....cgg..',
    '.MMMcMMM.',
    'MlMMMMMMM',
    'MlMMMMMMM',
    'MMMMMMMMM',
    'MMMMMMMMM',
    '.MMMMMMM.',
    '..MM.MM..',
  ]),
  pixel('px_house', '像素小屋', PT, [
    '....M....',
    '...MMM.c.',
    '..MMMMMc.',
    '.MMMMMMM.',
    'MMMMMMMMM',
    '.wwwwwww.',
    '.wbbwyyw.',
    '.wbbwyyw.',
    '.wwwwyyw.',
  ]),
  pixel('px_tree', '像素小樹', PS, [
    '....M....',
    '...MlM...',
    '..MMMMM..',
    '...MMM...',
    '..MlMMM..',
    '.MMMMMMM.',
    '..MMMMM..',
    '.MlMMMMM.',
    'MMMMMMMMM',
    '....c....',
    '....c....',
  ]),
  pixel('px_letter', '像素信封', PI2, [
    'MMMMMMMMMMM',
    'MsMMMMMMMsM',
    'MMsMMMMMsMM',
    'MMMsMrMsMMM',
    'MMMMsrsMMMM',
    'MMMMMMMMMMM',
    'MMMMMMMMMMM',
  ], { ol: 's' }),
  pixel('px_rainbow', '像素彩虹', PT, raster(15, 8, (x, y) => {
    const d = hypot(x, y - 3.6);
    if (y > 3.6) return null;
    return d > 6.6 && d <= 7.6 ? 'M' : d > 5.5 && d <= 6.6 ? 'y' : d > 4.4 && d <= 5.5 ? 'g' : d > 3.4 && d <= 4.4 ? 'b' : null;
  }), { ol: 'k' }),
  pixel('px_clover', '像素幸運草', PS, [
    '.MM...MM.',
    'MlMM.MMlM',
    'MMMMdMMMM',
    '.MMddMMM.',
    '...ddd...',
    '.MMMdMMM.',
    'MMMMdMMMM',
    'MlMM.dMlM',
    '.MM...dM.',
    '.......d.',
  ]),
  pixel('px_bow', '像素蝴蝶結', PR, [
    'MM.......MM',
    'MlMM...MMlM',
    'MMMMMdMMMMM',
    'MMMMdMdMMMM',
    'MMMMMdMMMMM',
    'MMM.M.M.MMM',
    '...M...M...',
    '..MM...MM..',
  ]),
  pixel('px_snow', '像素雪花', PB, [
    '....M....',
    '..M.M.M..',
    '...MMM...',
    'M..MlM..M',
    '.MMMlMMM.',
    'M..MlM..M',
    '...MMM...',
    '..M.M.M..',
    '....M....',
  ], { ol: 'w' }),
  pixel('px_planet', '像素小星球', PL, raster(14, 10, (x, y) => {
    const ring = abs(((x * 0.95 + y * 0.35) ** 2) / 36 + ((y * 0.95 - x * 0.3) ** 2) / 2.6 - 1) < 0.28 && !(x * x + y * y <= 10.5 && y * 0.95 - x * 0.3 < 0);
    if (x * x + y * y <= 10.5) return (x + 1) ** 2 + (y + 1) ** 2 < 2 ? 'l' : 'M';
    return ring ? 'y' : null;
  })),
  // 第九版：補到 30
  pixel('px_pear', '像素西洋梨', PS, [
    '....c..',
    '...cgg.',
    '..MM...',
    '.MlMM..',
    '.MMMM..',
    'MlMMMM.',
    'MMMMMM.',
    'MMMMMM.',
    '.MMMM..',
  ]),
  pixel('px_candle', '像素蠟燭', PR, [
    '...y...',
    '..yYy..',
    '...Y...',
    '...c...',
    '..MMM..',
    '..MlM..',
    '..MlM..',
    '..MMM..',
    '..MMM..',
    '.kkkkk.',
  ]),
  pixel('px_umbrella', '像素雨傘', PR, [
    '....c....',
    '...MMM...',
    '.MMlMMMM.',
    'MMlMMMMMM',
    'MMMMMMMMM',
    'M..M.M..M',
    '....c....',
    '....c....',
    '....c....',
    '....c..c.',
    '.....cc..',
  ]),
];

// =====================================================================
// 連連看星星（參考圖 21 的技法）：淡藍色鉛筆星星（實心塗、斜線塗、空心描邊）、編號小圓點、流星線、水鑽點描
// 圖案原創；不做「三顆星連成一串」、不做 12 道放射＋散落編號的同一組合
// =====================================================================
// 手寫數字（高 1、寬約 0.62）：一筆一筆的折線／曲線
const DIG = {
  0: (X, Y) => blob([X(0.5, 0), X(0.95, 0.45), X(0.55, 1), X(0.05, 0.55)].map((p) => [p[0], p[1]])),
  1: (X) => `M${pt(X(0.2, 0.22))}L${pt(X(0.55, 0))}L${pt(X(0.52, 1))}`,
  2: (X) => curve([X(0.02, 0.25), X(0.48, 0), X(0.92, 0.28), X(0.5, 0.65), X(0, 1)]) + `L${pt(X(1, 0.98))}`,
  3: (X) => curve([X(0.05, 0.1), X(0.62, 0), X(0.8, 0.26), X(0.32, 0.48)]) + curve([X(0.32, 0.48), X(0.95, 0.68), X(0.55, 1), X(0, 0.9)]),
  4: (X) => `M${pt(X(0.75, 1))}L${pt(X(0.72, 0))}L${pt(X(0, 0.68))}L${pt(X(1, 0.66))}`,
  5: (X) => `M${pt(X(0.92, 0))}L${pt(X(0.18, 0.02))}L${pt(X(0.1, 0.45))}` + curve([X(0.1, 0.45), X(0.65, 0.4), X(0.95, 0.72), X(0.5, 1), X(0, 0.88)]),
  6: (X) => curve([X(0.82, 0.02), X(0.3, 0.22), X(0.05, 0.68), X(0.4, 1), X(0.88, 0.8), X(0.68, 0.52), X(0.25, 0.56), X(0.08, 0.72)]),
  7: (X) => `M${pt(X(0, 0.02))}L${pt(X(1, 0))}L${pt(X(0.38, 1))}`,
  8: (X) => blob([X(0.5, 0.47), X(0.85, 0.22), X(0.5, 0), X(0.15, 0.22)]) + blob([X(0.5, 0.47), X(0.95, 0.74), X(0.5, 1), X(0.05, 0.74)]),
  9: (X) => curve([X(0.88, 0.35), X(0.45, 0.55), X(0.08, 0.28), X(0.5, 0), X(0.9, 0.25), X(0.78, 1)]),
};
function numD(str, x, y, h, tilt = 0) {
  let d = '';
  [...String(str)].forEach((ch, i) => {
    const ox = x + i * h * 0.78, sk = tilt * RAD;
    const X = (u, v) => [ox + u * h * 0.62 + (1 - v) * h * sk, y + v * h];
    d += DIG[ch](X, X);
  });
  return d;
}
const DS = '#86ADD5', DS_DOT = '#AFC3DE';
const dsStar = (cx, cy, ro, rot, arms, ri = 0.55) => handStar(cx, cy, ro, ro * ri, rot, arms, 5, ro * 0.11);
// 連連看的點＋號碼（號碼放在點的外側）
function numbered(list, h = 4.6, dotR = 1.5, color = 'K') {
  return [
    { d: list.map(([x, y]) => circle(x, y, dotR)).join(''), dot: color },
    { d: list.map(([x, y, num, dx = 3, dy = -3]) => numD(num, x + dx, y + dy - h / 2, h, 8)).join(''), s: 'K', w: 0.55, ink: true },
  ];
}
const tipsAndInner = (cx, cy, ro, ri, rot, arms) => {
  const tips = starTips(cx, cy, ro, rot, arms), inner = Array.from({ length: 5 }, (_, i) => {
    const a = (rot + 36 + i * 72) * RAD, r = ri * (1 + 0.6 * arms[(i + 2) % arms.length]);
    return [cx + r * cos(a), cy + r * sin(a)];
  });
  return { tips, inner };
};
// 沿折線等距撒水鑽
function gemsAlong(pts, step, r) {
  const out = [];
  let acc = step;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = hypot(x1 - x0, y1 - y0);
    let t = 0;
    while (acc + (L - t) >= step) {
      t += step - acc; acc = 0;
      if (t > L) break;
      out.push([x0 + ((x1 - x0) * t) / L, y0 + ((y1 - y0) * t) / L, r]);
    }
    acc += L - t;
  }
  return out;
}
// 放射：每一道是兩排水鑽夾成的細長菱形（尖朝外）
function gemBurst(cx, cy, k, r0, r1, w, gr = 0.75, rot = -90, longShort = 0) {
  const out = [];
  for (let i = 0; i < k; i++) {
    const a = (rot + (i * 360) / k) * RAD, L = i % 2 && longShort ? r0 + (r1 - r0) * (1 - longShort) : r1;
    const ux = cos(a), uy = sin(a), px = -uy, py = ux, m = r0 + (L - r0) * 0.38;
    const A = [cx + ux * r0, cy + uy * r0], B = [cx + ux * m + px * w, cy + uy * m + py * w], C = [cx + ux * L, cy + uy * L], D = [cx + ux * m - px * w, cy + uy * m - py * w];
    out.push(...gemsAlong([A, B, C], gr * 2.7, gr), ...gemsAlong([A, D, C], gr * 2.7, gr).slice(0, -1));
  }
  return out;
}
function ringPts(cx, cy, rx, ry, N = 48, a0 = 0, a1 = 2 * PI) {
  return Array.from({ length: N + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / N; return [cx + rx * cos(a), cy + ry * sin(a)]; });
}
function crescentPts(cx, cy, r, ox, oy, r2, N = 60) {
  const phi = atan2(oy - cy, ox - cx), outer = [];
  for (let i = 0; i <= N; i++) { const t = phi + (i / N) * 2 * PI, p = [cx + r * cos(t), cy + r * sin(t)]; if (hypot(p[0] - ox, p[1] - oy) > r2) outer.push(p); }
  const S0 = outer[0], E = outer[outer.length - 1], u0 = atan2(E[1] - oy, E[0] - ox), u1 = atan2(S0[1] - oy, S0[0] - ox), psi = atan2(cy - oy, cx - ox);
  const md = (v) => ((v % (2 * PI)) + 2 * PI) % (2 * PI);
  let d = md(u1 - u0);
  if (md(psi - u0) > d) d -= 2 * PI;
  const inner = Array.from({ length: 24 }, (_, i) => { const u = u0 + (d * (i + 1)) / 25; return [ox + r2 * cos(u), oy + r2 * sin(u)]; });
  return [...outer, ...inner];
}
const closeLoop = (pts) => [...pts, pts[0]];
// 稍微不對稱的手繪愛心（點）
function heartPts(cx, cy, size, N = 64) {
  const k = size / 34;
  return Array.from({ length: N }, (_, i) => { const t = (i / N) * 2 * PI; return [cx + k * 16 * sin(t) ** 3 * (1 + 0.04 * sin(t * 3)), cy - k * (13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t) + 2)]; });
}
const dot = (id, name, parts, vb, color = DS) => ({ id, name, cat: 'dotstar', style: 'dotstar', color, ...(vb ? { vb } : {}), parts });

export const ART_DOTSTAR = [
  // 實心塗的大星：每個角與凹處有連連看的點和號碼
  dot('ds_star_fill', '藍星連連看', (() => {
    const arms = [0, 0.16, -0.12, 0.2, -0.06], st = dsStar(50, 54, 40, -84, arms), { tips, inner } = tipsAndInner(50, 54, 40, 20, -84, arms);
    return [{ d: st, f: 'M', s: 'D', w: 1.1 }, ...numbered([[...tips[0], 1, 3, -2], [...inner[0], 2, 3, -4], [...tips[1], 3, 2, -3], [...tips[3], 5, -8, 4], [...inner[2], 4, 2, 7]])];
  })()),
  // 斜線塗的星
  dot('ds_star_hatch', '斜線星連連看', (() => {
    const arms = [0.08, -0.12, 0.18, 0, 0.12], st = dsStar(50, 53, 40, -98, arms), { tips, inner } = tipsAndInner(50, 53, 40, 20, -98, arms);
    return [{ d: st, hatch: 58, sp: 2.1, s: 'M', w: 1.2 }, ...numbered([[...tips[0], 1, 3, -3], [...inner[1], 2, 3, 2], [...tips[2], 3, 2, 6], [...inner[3], 4, -9, 5], [...tips[4], 5, -11, -2]])];
  })()),
  // 空心描邊＋裡面一顆顆鉛筆點點（像點點布）
  dot('ds_star_pattern', '點點星', (() => {
    const arms = [0, -0.12, 0.15, 0.08, -0.1], st = dsStar(50, 54, 40, -80, arms), { tips } = tipsAndInner(50, 54, 40, 20, -80, arms);
    const dots = [[42, 40], [56, 40], [36, 52], [50, 52], [64, 52], [43, 64], [57, 64], [50, 30], [76, 50], [26, 50], [50, 76]].filter(([x, y]) => hypot(x - 50, y - 54) < 24 || (y < 45 && abs(x - 50) < 8));
    return [{ d: st, s: 'M', w: 1.2 }, { d: dots.map(([x, y]) => circle(x, y, 2.6)).join(''), f: '#5F8CC4', s: '#5F8CC4', w: 0.4 },
      ...numbered([[...tips[0], 1, 3, -3], [...tips[1], 2, 2, -2], [...tips[4], 3, -10, -2]])];
  })()),
  dot('ds_fill_s', '藍色小星', [{ d: dsStar(50, 52, 34, -72, [0.05, -0.08, 0.06, 0, -0.05], 0.48), f: 'M', s: 'D', w: 1.3 }]),
  dot('ds_hatch_s', '斜線小星', [{ d: dsStar(50, 52, 34, -106, [0, 0.07, -0.04, 0.05, -0.06], 0.5), hatch: 64, sp: 2.4, s: 'M', w: 1.3 }]),
  dot('ds_line_s', '描邊小星', [{ d: dsStar(50, 52, 34, -90, [0.06, -0.04, 0.02, -0.06, 0.05], 0.46), s: 'D', w: 1.6 }]),
  dot('ds_twin', '大小兩顆星', [
    { d: dsStar(38, 58, 28, -96, [0, 0.06, -0.05, 0.08, 0]), hatch: 54, sp: 2.2, s: 'M', w: 1.2 },
    { d: dsStar(76, 30, 16, -70, [0.05, -0.05, 0.04, 0, 0.06]), f: 'M', s: 'D', w: 1 },
  ]),
  // 流星：實心藍星在上方，尾巴是三條往左下的鉛筆線
  dot('ds_shoot', '流星', [
    { d: curve([[14, 68], [52, 44], [92, 30]]) + curve([[22, 76], [60, 52], [96, 38]]) + curve([[34, 82], [66, 62], [99, 46]]), s: 'K', w: 1.3 },
    { d: dsStar(112, 30, 17, -84, [0, 0.08, -0.04, 0.06, 0]), f: 'M', s: 'D', w: 1.1 },
  ], [140, 90]),
  // 彗星：斜線星＋虛線尾巴＋幾個小點
  dot('ds_comet', '虛線彗星', [
    { d: [0, 1, 2, 3, 4, 5].map((i) => { const x = 16 + i * 14, y = 76 - i * 8.4 + sin(i) * 2; return `M${pt([x, y])}L${pt([x + 8, y - 4.8])}`; }).join(''), s: 'K', w: 1.2 },
    { d: circle(20, 56, 1.4) + circle(46, 82, 1.2) + circle(70, 40, 1.1), dot: DS_DOT },
    { d: dsStar(110, 32, 20, -100, [0.05, -0.05, 0.08, 0, -0.04]), hatch: 60, sp: 2.2, s: 'M', w: 1.2 },
  ], [140, 90]),
  // 水鑽：8 道放射
  dot('ds_gem_sun8', '水鑽太陽', [{ gem: gemBurst(50, 50, 8, 9, 46, 5.2, 0.8, -90) }]),
  // 水鑽：12 道，粗的長、細的短，交錯
  dot('ds_gem_sun16', '水鑽光芒', [{ gem: [...gemBurst(50, 50, 6, 12, 47, 5.6, 0.82, -90), ...gemBurst(50, 50, 6, 12, 34, 2.2, 0.62, -60), ...gemsAlong(ringPts(50, 50, 6, 6, 16), 2.4, 0.7)] }]),
  dot('ds_gem_ring', '水鑽圓圈', [{ gem: [...gemsAlong(ringPts(50, 50, 38, 38, 90), 2.6, 0.95), ...gemsAlong(ringPts(50, 50, 31, 31, 90), 5, 0.7)] }, ...numbered([[86, 22, 1, 3, -3]], 6, 1.8, DS_DOT)]),
  dot('ds_gem_star', '水鑽星', [{ gem: gemsAlong([...starRingPts(50, 54, 42, 19, 5)], 2.6, 0.9) }]),
  dot('ds_gem_moon', '水鑽月亮', [{ gem: gemsAlong(closeLoop(crescentPts(46, 52, 38, 64, 40, 32)), 2.6, 0.9) }, { d: dsStar(80, 74, 9, -90, [0]), f: 'M', s: 'D', w: 0.9 }]),
  dot('ds_gem_spark', '水鑽閃光', [{ gem: gemsAlong(closeLoop(sparkPts(50, 50, 44, 9)), 2.6, 0.9) }, { gem: gemsAlong(closeLoop(sparkPts(82, 20, 12, 3)), 2.4, 0.7) }]),
  dot('ds_gem_arc', '水鑽小徑', [{ gem: gemsAlong(crSample([[8, 82], [34, 58], [62, 54], [92, 30]], 10), 3.6, 1.05) }, { d: dsStar(108, 22, 13, -80, [0, 0.06, -0.05, 0.04, 0]), hatch: 56, sp: 2, s: 'M', w: 1 }], [124, 90]),
  // 連連看：五個編號點排成一個 M 字形，前兩段已經用淡鉛筆連起來
  dot('ds_connect', '連連看', (() => {
    const P = [[14, 78, 1], [34, 20, 2], [60, 58, 3], [86, 16, 4], [106, 76, 5]];
    return [{ d: `M${pt(P[0])}L${pt(P[1])}L${pt(P[2])}`, s: 'D', w: 0.9, a: 0.7 }, ...numbered(P.map(([x, y, k]) => [x, y, k, 3, -4]), 7, 2.2, DS_DOT)];
  })(), [120, 90]),
  dot('ds_connect2', '連連看圈圈', (() => {
    const P = ringPts(50, 50, 34, 30, 5, -PI / 2 + 0.3, 1.5 * PI + 0.3).slice(0, 5).map(([x, y], i) => [x, y, i + 1, 3, -4]);
    return numbered(P, 7, 2.2, DS_DOT);
  })()),
  dot('ds_dot7', '編號點 7', numbered([[40, 56, 7, 5, -10]], 14, 4.5, DS_DOT)),
  dot('ds_dot12', '編號點 2', numbered([[40, 60, 2, 6, -12]], 13, 4.5, DS_DOT)),
  dot('ds_dot3', '編號點 3', numbered([[42, 50, 3, -14, 10]], 14, 4.5, DS_DOT)),
  dot('ds_moon', '斜線月亮', [{ d: poly(crescentPts(50, 50, 38, 66, 38, 32)), hatch: 52, sp: 2.3, s: 'M', w: 1.3 }]),
  dot('ds_spark', '藍色閃光', [{ d: poly(sparkPts(50, 50, 42, 10)), f: 'M', s: 'D', w: 1.2 }, { d: poly(sparkPts(84, 18, 11, 3)), s: 'M', w: 1 }]),
  dot('ds_planet', '斜線星球', [
    { d: circle(50, 52, 24), hatch: 40, sp: 2.2, s: 'M', w: 1.2 },
    { d: curve([[30, 60], [8, 70], [20, 76], [50, 66], [84, 46], [92, 34], [72, 38]]), s: 'D', w: 1.3 },
  ]),
  // 第九版：補到 30（每一顆各自獨立，不排成一串）
  dot('ds_heart_hatch', '斜線愛心', [{ d: poly(heartPts(50, 52, 80)), hatch: 50, sp: 2.2, s: 'M', w: 1.3 }]),
  dot('ds_gem_heart', '水鑽愛心', [{ gem: gemsAlong(closeLoop(heartPts(50, 52, 80)), 2.6, 0.9) }]),
  dot('ds_star8', '八角星', [{ d: poly(starRingPts(50, 50, 42, 21, 8, -90).slice(0, -1)), f: 'M', s: 'D', w: 1.2 }]),
  dot('ds_gem_star8', '水鑽八角星', [{ gem: gemsAlong(starRingPts(50, 50, 42, 18, 8, -90), 2.6, 0.85) }]),
  dot('ds_double', '雙線星', [
    { d: dsStar(50, 54, 42, -92, [0, 0.05, -0.04, 0.06, 0]), s: 'D', w: 1.3 },
    { d: dsStar(50, 55, 30, -92, [0, 0.05, -0.04, 0.06, 0]), s: 'M', w: 1.1 },
  ]),
  dot('ds_cloud', '描邊雲', [
    { d: blob([[18, 64], [14, 50], [26, 40], [36, 30], [54, 28], [64, 38], [78, 36], [88, 50], [82, 64], [50, 68]]), s: 'D', w: 1.4 },
    { d: dsStar(80, 22, 10, -80, [0, 0.06, -0.04, 0.05, 0]), f: 'M', s: 'D', w: 0.9 },
  ], [100, 80]),
  dot('ds_moon_fill', '藍月亮', [{ d: poly(crescentPts(46, 50, 36, 62, 38, 30)), f: 'M', s: 'D', w: 1.2 }, ...numbered([[84, 74, 9, 3, -3]], 6, 1.8, DS_DOT)]),
];
function starRingPts(cx, cy, ro, ri, k, rot = -90) {
  const pts = Array.from({ length: k * 2 }, (_, i) => { const a = (rot + (i * 180) / k) * RAD, r = i % 2 ? ri : ro; return [cx + r * cos(a), cy + r * sin(a)]; });
  return [...pts, pts[0]];
}
function sparkPts(cx, cy, r, w) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * 90 - 90) * RAD, b = a + 45 * RAD;
    out.push([cx + r * cos(a), cy + r * sin(a)], [cx + w * 0.9 * cos(b), cy + w * 0.9 * sin(b)]);
  }
  return out;
}

// =====================================================================
// 蠟筆貓咪（參考圖 22 的技法）：各種顏色、稚拙、比例誇張（長身體、細長腳）；蠟筆斜線塗色＋深色細外框＋細線鬍鬚
// 姿勢全部自己設計（不排成時鐘、不抄參考圖任何一隻）。臉只用小點眼睛、小鼻子、鬍鬚。
// =====================================================================
const CB = (d) => ({ d, f: 'M', body: true });
const body = (pts) => CB(blob(pts));
// 帶子＋兩端圓頭分成三個部件（同一個 path 裡繞的方向相反會挖出洞）
const capped = (pts, w0, w1) => [CB(ribbon(pts, w0, w1, 8, false)), CB(circle(...pts[0], w0 / 2)), CB(circle(...pts[pts.length - 1], w1 / 2))];
const limb = (pts, w = 5.5, w1 = w * 0.85) => capped(pts, w, w1);
const tail = (pts, w0 = 6, w1 = 4.2) => capped(pts, w0, w1);
const ink = (d, w = 0.55) => ({ d, s: 'K', w });
// 頭：寬 w、高 h、轉 tilt 度；ear：耳朵高（相對 h）；look：臉往左右偏（側臉）；eyes：'dot' | 'closed' | 'round' | 'none'
function head(cx, cy, w, h, tilt = 0, o = {}) {
  const { ear = 0.34, look = 0, eyes = 'dot', mouth = false, whisk = 3, earSpread = 0.34 } = o;
  const c = cos(tilt * RAD), s = sin(tilt * RAD), L = (x, y) => [cx + x * c - y * s, cy + x * s + y * c];
  const loc = [[0, h * 0.5], [w * 0.5, h * 0.1], [w * 0.45, -h * 0.28], [w * earSpread + w * 0.06, -h * 0.5 - ear * h], [w * 0.12, -h * 0.4], [-w * 0.12, -h * 0.4], [-w * earSpread - w * 0.06, -h * 0.5 - ear * h], [-w * 0.45, -h * 0.28], [-w * 0.5, h * 0.1]];
  const radii = [w * 0.28, w * 0.24, 1.6, 0.8, 1.8, 1.8, 0.8, 1.6, w * 0.24];
  const parts = [CB(soft(loc.map(([x, y]) => L(x, y)), radii))];
  const lx = look * w, ex = w * 0.19, ey = -h * 0.02;
  if (eyes === 'dot') parts.push({ d: [-1, 1].map((k) => ellR(...L(lx + k * ex, ey), w * 0.038, w * 0.05, tilt)).join(''), f: 'K' });
  if (eyes === 'round') parts.push({ d: [-1, 1].map((k) => ellR(...L(lx + k * ex, ey), w * 0.075, w * 0.075, tilt)).join(''), s: 'K', w: 0.5 }, { d: [-1, 1].map((k) => ellR(...L(lx + k * ex + w * 0.015, ey + w * 0.015), w * 0.035, w * 0.04, tilt)).join(''), f: 'K' });
  if (eyes === 'closed') parts.push(ink([-1, 1].map((k) => `M${pt(L(lx + k * ex - w * 0.07, ey))}Q${pt(L(lx + k * ex, ey + w * 0.06))} ${pt(L(lx + k * ex + w * 0.07, ey))}`).join(''), 0.6));
  if (eyes !== 'none') {
    // 小鼻子＋（可選）小嘴
    const ny = h * 0.15;
    parts.push(ink(`M${pt(L(lx - w * 0.035, ny))}L${pt(L(lx + w * 0.035, ny))}L${pt(L(lx, ny + w * 0.04))}Z`, 0.5));
    if (mouth) parts.push(ink(`M${pt(L(lx - w * 0.07, ny + w * 0.08))}Q${pt(L(lx - w * 0.035, ny + w * 0.12))} ${pt(L(lx, ny + w * 0.05))}Q${pt(L(lx + w * 0.035, ny + w * 0.12))} ${pt(L(lx + w * 0.07, ny + w * 0.08))}`, 0.45));
    // 鬍鬚：細細的、伸出臉外
    let wd = '';
    for (const k of [-1, 1]) for (let j = 0; j < whisk; j++) {
      const a0 = L(lx + k * w * 0.2, h * 0.2 + j * h * 0.02), ang = (j - (whisk - 1) / 2) * 11, len = w * (0.42 + 0.06 * (j % 2));
      wd += `M${pt(a0)}L${pt(L(lx + k * (w * 0.2 + len * cos(ang * RAD)), h * 0.2 + j * h * 0.02 + len * sin(ang * RAD) * 0.9 - h * 0.03))}`;
    }
    parts.push(ink(wd, 0.4));
  }
  return parts;
}
// 臉以外的部件先放、頭最後放（臉的細線要畫在身體上面；筆刷會把同色剪影合在一起）
const cat = (id, name, color, parts0, vb) => {
  const parts = parts0.flat();
  const bodyParts = parts.filter((p) => p.body), rest = parts.filter((p) => !p.body);
  return { id, name, cat: 'cats', style: 'scribble', color, ...(vb ? { vb } : {}), parts: [...bodyParts, ...rest] };
};
const C_SAND = '#C9AE7C', C_ROSE = '#D98F8C', C_SLATE = '#7D8EA3', C_MAUVE = '#C48DB6', C_TEAL = '#7CBFCC', C_BRICK = '#B4594F', C_YEL = '#EBC350', C_GRN = '#8FCB8A', C_ORG = '#E28C45', C_GRAY = '#5A5A62',
  C_PINK = '#E6A6B5', C_PURP = '#9A78C2', C_LIME = '#B7D35A', C_BRN = '#8B5B3F', C_BLUE = '#6191C4';

export const ART_CATS = [
  // 低頭聞地上的貓：尾巴平平往後、頭低低的（沙色）
  cat('cat_walk', '低頭聞聞的貓', C_SAND, [
    body([[26, 34], [52, 30], [80, 34], [88, 46], [80, 54], [52, 54], [28, 52], [20, 43]]),
    limb([[80, 50], [84, 61], [90, 71]]), limb([[73, 51], [72, 62], [70, 72]]), limb([[32, 48], [30, 60], [26, 72]]), limb([[42, 50], [44, 61], [42, 72]]),
    tail([[22, 40], [10, 42], [2, 38]], 5.5, 4),
    ...head(97, 52, 21, 17, 28, { look: 0.12 }),
  ], [118, 78]),
  cat('cat_loaf', '吐司貓', C_YEL, [
    body([[16, 52], [22, 36], [50, 31], [80, 36], [86, 54], [80, 67], [50, 69], [20, 67]]),
    tail([[84, 62], [92, 68], [76, 73], [54, 72]], 5, 4),
    ...head(48, 33, 34, 25, -4, { mouth: true }),
  ], [100, 80]),
  cat('cat_sitfront', '端坐的貓', C_GRAY, [
    body([[24, 42], [56, 42], [62, 66], [64, 90], [16, 90], [18, 66]]),
    tail([[60, 86], [74, 84], [78, 70], [70, 60]], 5.5, 4),
    ink('M35 62L34 89M45 62L46 89', 0.6),
    ...head(40, 31, 34, 26, 0),
  ], [80, 100]),
  cat('cat_stretch', '伸懶腰的貓', C_TEAL, [
    body([[30, 54], [48, 42], [72, 30], [90, 33], [95, 45], [86, 53], [64, 52], [44, 64], [30, 65]]),
    limb([[36, 60], [22, 68], [8, 72]], 5.5, 4.8), limb([[42, 62], [30, 70], [17, 74]], 5.5, 4.8),
    limb([[84, 46], [86, 60], [86, 75]]), limb([[91, 45], [95, 60], [97, 75]]),
    tail([[92, 38], [104, 26], [106, 12], [100, 6]]),
    ...head(25, 53, 22, 18, -12, { eyes: 'closed', mouth: true }),
  ], [120, 80]),
  cat('cat_jump', '跳起來的貓', C_PINK, [
    body([[30, 60], [44, 46], [66, 34], [82, 30], [86, 40], [72, 50], [48, 62], [34, 68]]),
    limb([[80, 34], [94, 24], [106, 18]], 5, 4.5), limb([[78, 40], [94, 34], [107, 30]], 5, 4.5),
    limb([[36, 62], [22, 70], [8, 74]]), limb([[40, 66], [28, 77], [14, 85]]),
    tail([[30, 60], [16, 56], [4, 44]], 5.5, 4),
    ...head(90, 24, 22, 18, -22, { eyes: 'round' }),
  ], [120, 90]),
  cat('cat_crouch', '準備撲的貓', C_BRN, [
    body([[28, 42], [56, 35], [84, 38], [92, 50], [70, 56], [36, 55]]),
    limb([[84, 50], [92, 58], [100, 60]], 5, 4.5), limb([[78, 52], [84, 60], [92, 62]], 5, 4.5), limb([[34, 50], [40, 60], [48, 61]], 6, 5),
    tail([[28, 46], [14, 52], [3, 55]], 5, 4),
    ...head(100, 42, 20, 17, 6, { eyes: 'round', look: 0.12 }),
  ], [120, 70]),
  cat('cat_roll', '翻肚的貓', C_PURP, [
    body([[22, 50], [50, 44], [80, 46], [90, 58], [56, 66], [24, 64]]),
    limb([[40, 48], [38, 34], [44, 23]], 5, 4.5), limb([[50, 46], [54, 32], [61, 25]], 5, 4.5), limb([[74, 48], [72, 34], [78, 25]]), limb([[82, 50], [87, 38], [94, 32]]),
    tail([[88, 58], [100, 66], [106, 58]], 5, 4),
    ...head(16, 56, 22, 18, 100, { mouth: true }),
  ], [110, 80]),
  cat('cat_sleep', '睡成一圈的貓', C_BLUE, [
    body([[18, 54], [30, 34], [56, 30], [80, 40], [84, 60], [66, 74], [36, 74]]),
    tail([[80, 62], [70, 76], [44, 80], [22, 72]], 6, 4.5),
    ...head(30, 50, 24, 19, -28, { eyes: 'closed' }),
  ], [100, 86]),
  cat('cat_peek', '探頭的貓', C_LIME, [
    body([[18, 73], [22, 58], [50, 50], [78, 58], [82, 73]]),
    CB(ellR(30, 62, 8, 6, -10)), CB(ellR(70, 62, 8, 6, 10)),
    ink('M27 64L27 68M31 64L31 68M67 64L67 68M71 64L71 68', 0.45),
    ...head(50, 38, 48, 36, 0, { eyes: 'round', whisk: 3 }),
  ], [100, 72]),
  // 好長的貓：身體像波浪一樣彎著躺、頭在右邊抬起來（玫瑰色）
  cat('cat_long', '波浪長貓', C_ROSE, [
    capped([[24, 46], [50, 34], [80, 46], [112, 36]], 17, 16),
    limb([[28, 52], [22, 58]], 4.5, 4), limb([[40, 46], [38, 56]], 4.5, 4), limb([[100, 42], [104, 52]], 4.5, 4), limb([[112, 40], [118, 50]], 4.5, 4),
    tail([[20, 46], [8, 40], [6, 28], [14, 24]], 5, 4),
    ...head(126, 28, 22, 18, 10, { eyes: 'round', look: 0.1 }),
  ], [144, 62]),
  // 站著捧一朵小花的貓：身體矮胖、兩手在胸前（藕紫色）
  cat('cat_stand', '捧著花的貓', C_MAUVE, [
    body([[24, 40], [50, 40], [56, 62], [52, 80], [22, 80], [18, 62]]),
    limb([[24, 48], [28, 58], [36, 58]], 5, 4.5), limb([[50, 48], [46, 58], [40, 59]], 5, 4.5),
    limb([[28, 76], [24, 96]], 6.5, 6), limb([[46, 76], [50, 96]], 6.5, 6),
    tail([[52, 74], [64, 70], [66, 58]], 5, 4),
    { d: circle(40, 47, 6.5), f: '#EBC350', body: true }, // 花在身體上面（另一色的剪影，後畫）
    { d: 'M39 53L39 58M41 53L42 58', s: 'K', w: 0.5 },
    { d: circle(40, 47, 2.2), f: '#CB8875' },
    ...head(37, 28, 30, 24, -6, { eyes: 'closed', mouth: true }),
  ], [74, 100]),
  cat('cat_back', '背影的貓', C_BRICK, [
    body([[28, 48], [54, 48], [64, 74], [60, 93], [22, 93], [18, 74]]),
    tail([[56, 90], [72, 92], [82, 82], [76, 72]], 5.5, 4),
    ...head(41, 37, 30, 24, -6, { eyes: 'none' }),
  ], [90, 100]),
  cat('cat_arch', '弓背的貓', C_GRAY, [
    capped([[26, 54], [40, 32], [62, 24], [80, 30], [90, 50]], 17, 15),
    limb([[28, 58], [27, 84]], 4.5, 4), limb([[35, 56], [38, 84]], 4.5, 4), limb([[84, 54], [83, 84]], 4.5, 4), limb([[90, 52], [95, 84]], 4.5, 4),
    tail([[27, 52], [16, 34], [22, 14], [36, 10]], 6, 4.5),
    ...head(98, 48, 22, 18, 8, { eyes: 'round', look: 0.1 }),
  ], [112, 88]),
  cat('cat_run', '縮腳快跑的貓', C_ORG, [
    body([[40, 32], [70, 25], [96, 30], [101, 42], [72, 49], [42, 47]]),
    limb([[92, 42], [84, 55], [70, 60]], 5, 4.5), limb([[88, 44], [80, 58], [66, 65]], 5, 4.5),
    limb([[44, 42], [56, 55], [68, 57]]), limb([[48, 45], [60, 60], [75, 62]]),
    tail([[40, 35], [24, 26], [8, 28]], 5.5, 4),
    ...head(108, 29, 21, 18, -4, { look: 0.12 }),
  ], [124, 70]),
  cat('cat_sunbathe', '曬太陽的貓', C_YEL, [
    body([[22, 30], [60, 26], [96, 30], [100, 40], [60, 45], [24, 43]]),
    limb([[40, 42], [43, 56]], 5, 4.5), limb([[50, 42], [56, 56]], 5, 4.5), limb([[82, 41], [86, 55]]), limb([[90, 40], [98, 52]]),
    tail([[99, 34], [111, 30], [118, 37]], 5, 4),
    ...head(15, 32, 22, 19, -78, { eyes: 'closed', mouth: true }),
  ], [120, 60]),
  cat('cat_star', '抱星星的貓', C_BLUE, [
    { d: handStar(72, 40, 24, 12, -80, [0, 0.06, -0.05, 0.04, 0], 5, 2), f: '#EBC350', body: true },
    body([[12, 58], [40, 51], [62, 54], [70, 68], [40, 72], [12, 70]]),
    limb([[46, 56], [58, 47], [66, 40]], 5, 4.5), limb([[18, 66], [8, 74]], 5, 4.5),
    tail([[14, 64], [4, 58], [4, 46]], 5, 4),
    ...head(26, 48, 24, 19, -10, { eyes: 'closed', mouth: true }),
  ], [100, 80]),
  cat('cat_face', '大臉貓', C_BRICK, [
    ...head(50, 44, 70, 50, 0, { ear: 0.28, earSpread: 0.36, mouth: true }),
  ], [100, 80]),
  cat('cat_dance', '單腳站的貓', C_PINK, [
    body([[28, 36], [50, 36], [54, 60], [48, 76], [30, 76], [24, 60]]),
    limb([[28, 42], [15, 41], [4, 34]], 5, 4.5), limb([[50, 42], [64, 46], [76, 41]], 5, 4.5),
    limb([[34, 72], [34, 104]], 6, 5.5), limb([[46, 70], [60, 82], [73, 80]], 6, 5.5),
    tail([[30, 72], [17, 80], [13, 93]], 5, 4),
    ...head(39, 25, 29, 23, -8, { eyes: 'round' }),
  ], [80, 108]),
  cat('cat_box', '紙箱裡的貓', C_TEAL, [
    { d: soft([[20, 54], [80, 54], [82, 94], [18, 94]], 1.5), f: '#C9A27A', body: true },
    CB(ellR(38, 55, 7, 5, -8)), CB(ellR(62, 55, 7, 5, 8)),
    ink('M20 54L8 46M80 54L92 47M50 62L50 92', 0.6),
    ...head(50, 42, 34, 27, 0, { eyes: 'round' }),
  ], [100, 100]),
  cat('cat_kitten', '小小貓', C_LIME, [
    body([[18, 46], [34, 30], [52, 32], [60, 52], [52, 66], [22, 66]]),
    tail([[56, 60], [66, 58], [66, 48]], 4.5, 3.5),
    ...head(37, 28, 28, 22, 6, { eyes: 'round', mouth: true }),
  ], [72, 70]),
  cat('cat_flop', '掛在繩上的貓', C_GRN, [
    { d: 'M2 30Q55 36 108 28', s: 'K', w: 0.8, under: true },
    capped([[22, 66], [34, 40], [54, 30], [74, 40], [84, 66]], 17, 15),
    limb([[26, 70], [24, 88]], 4.5, 4), limb([[32, 68], [34, 86]], 4.5, 4), limb([[82, 70], [81, 88]], 4.5, 4), limb([[88, 66], [92, 84]], 4.5, 4),
    tail([[86, 60], [99, 70], [102, 86]], 5, 4),
    ...head(20, 72, 22, 18, 18, { eyes: 'closed' }),
  ], [110, 92]),
  // 用後腳倒掛在繩上的貓：頭朝下、兩手垂著、尾巴勾回繩子（灰藍色）
  cat('cat_hang', '倒掛的貓', C_SLATE, [
    { d: 'M4 6Q40 9 76 5', s: 'K', w: 0.8, under: true },
    limb([[34, 7], [36, 26]], 5, 5), limb([[48, 7], [46, 26]], 5, 5),
    body([[32, 24], [50, 24], [52, 46], [48, 64], [34, 64], [30, 46]]),
    limb([[34, 58], [27, 72], [24, 86]], 4.5, 4), limb([[48, 58], [55, 72], [58, 86]], 4.5, 4),
    tail([[50, 30], [62, 24], [64, 12], [58, 7]], 4.5, 3.8),
    ...head(41, 74, 24, 19, 180, { eyes: 'round' }),
  ], [80, 92]),
  cat('cat_sitside', '仰頭坐著的貓', C_PURP, [
    body([[30, 42], [46, 38], [60, 56], [64, 84], [56, 92], [26, 92], [24, 70]]),
    tail([[60, 88], [74, 91], [82, 82]], 5, 4),
    ink('M36 66L34 91', 0.6),
    ...head(35, 30, 26, 22, -20, { look: -0.12 }),
  ], [90, 100]),
  cat('cat_tiptoe', '長腳的貓', C_BLUE, [
    body([[34, 31], [64, 28], [74, 39], [62, 47], [36, 45]]),
    limb([[40, 42], [36, 70], [34, 96]], 4.2, 3.8), limb([[46, 44], [48, 70], [50, 96]], 4.2, 3.8),
    limb([[62, 42], [64, 70], [62, 96]], 4.2, 3.8), limb([[68, 40], [74, 70], [78, 96]], 4.2, 3.8),
    tail([[35, 35], [23, 23], [25, 9], [37, 8]], 5, 4),
    ...head(80, 25, 20, 17, 6, { look: 0.12 }),
  ], [100, 100]),
  cat('cat_yarn', '玩毛線的貓', C_ORG, [
    { d: circle(76, 66, 12), f: '#A99BC5', body: true },
    body([[8, 52], [36, 46], [56, 50], [58, 62], [12, 64]]),
    limb([[50, 54], [60, 58], [66, 60]], 5, 4.5), limb([[14, 60], [6, 66]], 5, 4.5),
    tail([[10, 56], [2, 48], [6, 38]], 5, 4),
    ink(curve([[68, 58], [80, 60], [84, 70]]) + curve([[66, 66], [76, 72], [86, 66]]) + curve([[72, 56], [70, 68], [78, 77]]) + curve([[88, 70], [94, 80], [86, 86]]), 0.5),
    ...head(44, 44, 22, 18, 10, { eyes: 'round', look: 0.12 }),
  ], [100, 88]),
  // 第九版：補到 30
  cat('cat_tailup', '翹尾巴散步的貓', C_ORG, [
    body([[28, 44], [56, 40], [82, 42], [90, 52], [80, 60], [52, 60], [30, 58], [22, 50]]),
    limb([[82, 56], [84, 70], [86, 82]]), limb([[74, 58], [73, 70], [72, 82]]), limb([[34, 56], [30, 70], [28, 82]]), limb([[44, 58], [46, 70], [46, 82]]),
    tail([[26, 46], [14, 34], [12, 18], [20, 8]], 5.5, 4),
    ...head(96, 36, 22, 18, -6, { look: 0.1 }),
  ], [120, 90]),
  cat('cat_peer', '趴著看的貓', C_SLATE, [
    body([[20, 48], [50, 40], [84, 42], [96, 54], [84, 62], [40, 62], [18, 58]]),
    limb([[84, 58], [98, 62], [108, 62]], 5.5, 5), limb([[78, 60], [92, 65], [102, 66]], 5.5, 5),
    tail([[20, 54], [8, 60], [4, 50]], 5, 4),
    ...head(96, 42, 24, 19, 0, { eyes: 'round' }),
  ], [120, 72]),
  cat('cat_lick', '舔腳的貓', C_ROSE, [
    body([[28, 44], [54, 40], [64, 66], [62, 92], [20, 92], [16, 66]]),
    limb([[50, 82], [62, 62], [70, 42]], 6.5, 5.5),
    tail([[22, 90], [8, 92], [4, 82]], 5, 4),
    ...head(56, 30, 26, 21, 22, { eyes: 'closed' }),
  ], [90, 100]),
  cat('cat_chase', '追尾巴的貓', C_LIME, [
    body([[32, 42], [50, 32], [72, 38], [80, 58], [68, 74], [46, 76], [32, 64]]),
    limb([[62, 72], [66, 86]]), limb([[48, 74], [46, 88]]), limb([[74, 62], [88, 68]]),
    tail([[42, 74], [26, 82], [14, 70], [18, 56]], 5.5, 4),
    ...head(30, 40, 24, 19, -36, { eyes: 'round' }),
  ], [100, 100]),
  cat('cat_turn', '回頭看的貓', C_MAUVE, [
    body([[30, 46], [60, 44], [72, 70], [68, 92], [26, 92], [22, 70]]),
    tail([[66, 90], [84, 90], [90, 78]], 5.5, 4),
    ink('M36 70L35 91M46 70L47 91', 0.6),
    ...head(36, 33, 30, 24, -10, { look: -0.15 }),
  ], [100, 100]),
];

// =====================================================================
// 十字繡圖案（擴充）：點陣（'X' = 繡一格）。at：'ground' 從底邊長上來、'top' 掛在頂邊、'any' 哪裡都可以
// 和 v8.js 的 MOTIF_STITCH 合起來約 27 種；擺法在 overlay.js（只繡在邊緣，中間留白）
// =====================================================================
const stitch2 = (id, name, at, rows) => {
  const W = max(...rows.map((r) => r.length)), grid = rows.map((r) => r.padEnd(W, '.'));
  return { id, name, at, grid, vb: [W, grid.length], parts: [{ f: 'M', d: grid.flatMap((row, j) => [...row].map((ch, i) => (ch === 'X' ? `M${i} ${j}h1v1h-1Z` : ''))).join('') }] };
};
export const MOTIF_STITCH2 = [
  stitch2('st_heart', '愛心', 'any', ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']),
  stitch2('st_star', '星星', 'any', ['...X...', '...X...', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', '.X...X.']),
  stitch2('st_flower4', '四瓣小花', 'any', ['.X.X.', 'XX.XX', '..X..', 'XX.XX', '.X.X.']),
  stitch2('st_bell', '風鈴草', 'ground', [
    '...XX...', '..X..X..', '.X....X.', '.X....XX', '.XX..X..', 'XXXX.X..', '.XX..X..', '.....X..', '..XXX.X.', '.XXXXX..',
    '.XXXXX..', '..X.X.X.', '......X.', '..XX..X.', '.XXXX.X.', '...XXXX.', '......X.',
  ]),
  stitch2('st_leaf', '葉子', 'any', ['....XXX', '..XXXXX', '.XXXX.X', 'XXX.XXX', 'XX.XXX.', 'X.XX...', 'X......']),
  stitch2('st_berry', '莓果枝', 'any', [
    '.XX......', 'XXXX.....', 'XXXX..XX.', '.XX..XXXX', '..X..XXXX', '...X..XX.', '...X.X...', '....X....', '.XX.X....', 'XXXXX....', 'XXXXX....', '.XX.X....', '....X....',
  ]),
  stitch2('st_mushroom', '小蘑菇', 'ground', ['..XXX..', '.XXXXX.', 'XX.XXXX', 'XXXXX.X', '...X...', '..XXX..', '..XXX..']),
  stitch2('st_fern', '蕨葉', 'ground', [
    '...X...', '..XXX..', '.X.X.X.', '..XXX..', 'X..X..X', '.X.X.X.', '..XXX..', 'X..X..X', '.X.X.X.', '..XXX..',
    'X..X..X', '.XXX.X.', '...XX..', '...X...', '...X...', '..X....',
  ]),
  stitch2('st_rose', '圓圓的花', 'ground', [
    '..XXXXX..', '.XX...XX.', 'XX.XXX.XX', 'X.X...X.X', 'X.X.X.X.X', 'XX.XX.XXX', '.XX...XX.', '..XXXXX..', '....X....',
    '....X.XX.', '....XXXXX', '.XX.X.XX.', 'XXXXX....', '.XX.X....', '....X....', '....X....',
  ]),
  stitch2('st_butterfly', '蝴蝶', 'any', ['XX.....XX', 'XXX.X.XXX', 'XXXX.XXXX', '.XXX.XXX.', '..XX.XX..', '.XXX.XXX.', '.XX...XX.']),
  stitch2('st_moon', '月亮', 'any', ['..XXX.', '.XX...', 'XX....', 'XX....', 'XX....', '.XX...', '..XXX.']),
  stitch2('st_snow', '雪花', 'any', ['X..X..X', '.X.X.X.', '..XXX..', 'XXX.XXX', '..XXX..', '.X.X.X.', 'X..X..X']),
  stitch2('st_cloud', '小雲', 'any', ['...XXX....', '..XXXXX.X.', '.XXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.']),
  stitch2('st_wheat', '麥穗', 'ground', [
    '..X..', '.XXX.', 'X.X.X', '.XXX.', 'X.X.X', '.XXX.', 'X.X.X', '.XXX.', '..X..', '..X..', '..X..', '...X.', '...X.', '..X..', '..X..', '..X..',
  ]),
  stitch2('st_sprout', '小芽', 'ground', ['XX...XX', 'XXX.XXX', '.XX.XX.', '...X...', '...X...', '..X....']),
  stitch2('st_vine', '藤蔓', 'top', [
    'XXXXXXXXXXXXXXXXXXXX', '..X.....X.....X.....', '.XXX...XXX...XXX..X.', '.XXX...X.X...XXX.XXX', '..X.....X.....X...X.', '........X..........', '.......XXX.........', '........X..........',
  ]),
  stitch2('st_sparks', '三點亮光', 'any', ['X.....', '......', '...X..', '..XXX.', '...X..', '......', 'X....X']),
  stitch2('st_lavender', '薰衣草', 'ground', [
    '..X..', '.XXX.', '..X..', '.XXX.', 'XX.XX', '.XXX.', 'XX.XX', '.XXX.', '..X..', '..X..', '..X..', 'X.X..', 'XXX..', '..X..', '..X..',
  ]),
  stitch2('st_cherry', '櫻桃', 'any', ['.....XX', '....X..', '...X.X.', '..X...X', '.X....X', 'XXX..XXX', 'XXX..XXX', '.X....X.']),
  stitch2('st_cosmos', '波斯菊', 'ground', [
    '.X..X..X.', '..X.X.X..', 'X..XXX..X', '.XXX.XXX.', 'X..XXX..X', '..X.X.X..', '.X..X..X.', '....X....', '....X....', '.....X...', '.....X.XX', '.XX..XXX.', 'XXXX.X...', '.....X...', '....X....',
  ]),
  // 第九版：補到 30
  stitch2('st_acorn', '橡實', 'any', ['...X...', '..XXX..', '.XXXXX.', 'XX.X.XX', '.XXXXX.', '.X...X.', '.X...X.', '..X.X..', '...X...']),
  stitch2('st_pear', '西洋梨', 'any', ['...X.XX', '...XX..', '..XXX..', '.XX.XX.', '.X...X.', 'XX...XX', 'X.....X', 'X.....X', 'XX...XX', '.XXXXX.']),
  stitch2('st_sun', '小太陽', 'any', ['X...X...X', '.X..X..X.', '...XXX...', '..XX.XX..', 'XXX...XXX', '..XX.XX..', '...XXX...', '.X..X..X.', 'X...X...X']),
];

// =====================================================================
// 點描圖案（擴充，線條為主；accent: true 的花頭會帶黃點）vb 100×140：植物從底邊長上來
// 和 v8.js 的 MOTIF_STIPPLE 合起來 25 種。不做「三朵細瓣花＋S 形長莖」（參考圖 12 的構圖）
// =====================================================================
function leafLine(b, t, w, bend = 0) {
  const dx = t[0] - b[0], dy = t[1] - b[1], L = hypot(dx, dy), nx = -dy / L, ny = dx / L, Lp = [], Rp = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10, hw = (w / 2) * Math.pow(sin(PI * u), 0.8), x = b[0] + dx * u + nx * bend * sin(PI * u), y = b[1] + dy * u + ny * bend * sin(PI * u);
    Lp.push([x + nx * hw, y + ny * hw]); Rp.push([x - nx * hw, y - ny * hw]);
  }
  return poly([...Lp, ...Rp.reverse().slice(1, -1)]);
}
// 沿莖取點與方向
const onStem = (pts, u) => { const S = crSample(pts, 12), i = min(S.length - 2, Math.floor(u * (S.length - 1))); return [S[i], atan2(S[i + 1][1] - S[i][1], S[i + 1][0] - S[i][0])]; };
const at = (p, a, d) => [p[0] + d * cos(a), p[1] + d * sin(a)];
function petals(cx, cy, k, r0, r1, w, rot = 0) {
  let d = '';
  for (let i = 0; i < k; i++) { const a = rot * RAD + (i * 2 * PI) / k; d += leafLine(at([cx, cy], a, r0), at([cx, cy], a, r1), w); }
  return d;
}
const sp2 = (id, name, parts) => ({ id, name, vb: [100, 140], parts });
export const MOTIF_STIPPLE2 = [
  sp2('sp_lavender', '薰衣草', (() => {
    const stems = [[[46, 140], [46, 100], [42, 60], [38, 26]], [[52, 140], [56, 104], [62, 70], [70, 40]], [[44, 140], [36, 112], [26, 88]]];
    const heads = stems.map((s0, k) => { let d = ''; for (let i = 0; i < 8 - k * 2; i++) { const [p, a] = onStem(s0, 0.62 + i * 0.05); d += leafLine(at(p, a - 0.9, 1), at(p, a - 0.5, 6), 3) + leafLine(at(p, a + 0.9, 1), at(p, a + 0.5, 6), 3); } return d; }).join('');
    return [{ d: stems.map(curve).join('') }, { d: heads, accent: true }];
  })()),
  sp2('sp_fern', '蕨', (() => {
    const st = [[50, 140], [48, 100], [52, 60], [64, 22]];
    let d = '';
    for (let i = 1; i < 14; i++) { const [p, a] = onStem(st, i / 14), L = 20 * (1 - i / 16); d += leafLine(p, at(p, a - 1.4, L), L * 0.32, 1) + leafLine(p, at(p, a + 1.4, L), L * 0.32, -1); }
    return [{ d: curve(st) }, { d }];
  })()),
  sp2('sp_tulip', '鬱金香', [
    { d: curve([[50, 140], [50, 100], [48, 64], [50, 46]]) + leafLine([50, 138], [26, 70], 14, 4) + leafLine([50, 136], [70, 86], 11, -3) },
    { d: `M36 30C34 44 40 52 50 52C60 52 66 44 64 30L58 38L54 24L50 36L46 24L42 38Z`, accent: true },
  ]),
  sp2('sp_wheat', '麥穗', (() => {
    const st = [[48, 140], [50, 100], [54, 64], [62, 22]];
    let d = '';
    for (let i = 0; i < 7; i++) { const [p, a] = onStem(st, 0.6 + i * 0.055); d += leafLine(p, at(p, a - 0.55, 9), 4) + leafLine(p, at(p, a + 0.55, 9), 4) + `M${pt(at(p, a - 0.55, 9))}L${pt(at(p, a - 0.6, 15))}`; }
    return [{ d: curve(st) + leafLine([49, 120], [30, 90], 6, 3) }, { d, accent: true }];
  })()),
  sp2('sp_eucalyptus', '尤加利', (() => {
    const st = [[50, 140], [46, 100], [54, 60], [50, 18]];
    let d = '';
    for (let i = 1; i < 9; i++) { const [p, a] = onStem(st, i / 9), side = i % 2 ? -1 : 1, r = 9 - i * 0.5; d += circle(...at(p, a + side * 1.57, r + 1), r); }
    return [{ d: curve(st) }, { d }];
  })()),
  sp2('sp_cosmos', '一朵波斯菊', [
    { d: curve([[50, 140], [52, 100], [50, 70], [46, 42]]) + curve([[51, 96], [64, 84], [70, 72]]) + curve([[51, 118], [38, 108], [30, 100]]) + 'M38 108L32 104M44 112L38 114' },
    { d: petals(46, 34, 8, 4, 16, 6, 10), accent: true },
    { d: leafLine([70, 72], [72, 60], 6), accent: true },
  ]),
  sp2('sp_poppy', '罌粟', [
    { d: curve([[44, 140], [42, 104], [34, 70], [36, 44]]) + curve([[46, 140], [56, 110], [70, 92], [74, 80]]) + leafLine([44, 130], [24, 112], 10, 3) },
    { d: 'M24 44C20 30 30 22 36 28C40 18 52 22 50 32C58 34 56 46 48 46C44 50 30 50 24 44Z', accent: true },
    { d: ellR(74, 72, 5, 8, 160), accent: true },
  ]),
  sp2('sp_clover', '幸運草', (() => {
    const heads = [[34, 96, 0], [62, 80, 20], [50, 112, -10]];
    let d = '', st = '';
    heads.forEach(([x, y, rot]) => { for (let i = 0; i < 3; i++) { const a = (rot - 90 + i * 120) * RAD; d += blob([[x, y], at([x, y], a - 0.5, 13), at([x, y], a, 12), at([x, y], a + 0.5, 13)]); } st += curve([[x, y], [x + 4, (y + 140) / 2], [50, 140]]); });
    return [{ d: st }, { d }, { d: circle(70, 52, 4) + circle(74, 46, 3), accent: true }];
  })()),
  sp2('sp_bluebell', '吊鐘花', (() => {
    const st = [[40, 140], [40, 90], [48, 40], [72, 30], [82, 44]];
    let d = '';
    [0.5, 0.62, 0.74, 0.86, 0.97].forEach((u, i) => { const [p] = onStem(st, u), q = [p[0] + 2, p[1] + 6]; d += `M${pt(p)}L${pt(q)}` + `M${pt([q[0] - 5, q[1] + 1])}C${pt([q[0] - 5, q[1] + 12])} ${pt([q[0] + 5, q[1] + 12])} ${pt([q[0] + 5, q[1] + 1])}Z`; });
    return [{ d: curve(st) + leafLine([40, 138], [28, 80], 9, 2) + leafLine([41, 138], [56, 96], 8, -2) }, { d, accent: true }];
  })()),
  sp2('sp_thistle', '薊', [
    { d: curve([[50, 140], [48, 100], [50, 60], [50, 46]]) + 'M49 110L34 98L40 96L30 86M49 110L36 92M50 90L66 80L60 78L70 68M50 90L64 74' },
    { d: 'M40 46C40 56 60 56 60 46L58 40L42 40Z' + Array.from({ length: 9 }, (_, i) => { const a = (-160 + i * 17.5) * RAD; return `M${pt(at([50, 40], a, 2))}L${pt(at([50, 40], a, 14))}`; }).join(''), accent: true },
  ]),
  sp2('sp_allium', '蔥花球', [
    { d: curve([[50, 140], [52, 100], [50, 60], [48, 38]]) + leafLine([50, 138], [30, 100], 6, 2) },
    { d: Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * 2 * PI, r = 13 + (i % 3) * 2; return `M48 26L${pt(at([48, 26], a, r))}` + circle(...at([48, 26], a, r + 1.6), 1.4); }).join(''), accent: true },
  ]),
  sp2('sp_sunflower', '向日葵', [
    { d: curve([[50, 140], [50, 100], [48, 70], [50, 54]]) + leafLine([50, 110], [24, 96], 16, 4) + leafLine([50, 92], [76, 82], 14, -4) },
    { d: circle(50, 38, 9) + petals(50, 38, 12, 10, 22, 6, 0), accent: true },
  ]),
  sp2('sp_berry', '莓果枝', (() => {
    const st = [[42, 140], [44, 100], [56, 64], [72, 34]];
    let d = '';
    [[0.35, -1], [0.55, 1], [0.75, -1], [0.92, 1]].forEach(([u, sd]) => { const [p, a] = onStem(st, u), c = at(p, a + sd * 1.2, 8); d += `M${pt(p)}L${pt(c)}` + circle(c[0], c[1] + 3, 3.4) + circle(c[0] + 4, c[1] + 6, 3) + circle(c[0] - 3, c[1] + 7, 2.8); });
    return [{ d: curve(st) + leafLine([44, 110], [24, 100], 10, 2) + leafLine([50, 84], [70, 84], 9, -2) }, { d, accent: true }];
  })()),
  sp2('sp_ginkgo', '銀杏枝', (() => {
    const st = [[52, 140], [50, 100], [44, 60], [40, 26]];
    const fan = (p, a, s) => { const q = at(p, a, s * 0.35), l = at(q, a - 0.75, s), r = at(q, a + 0.75, s); return `M${pt(p)}L${pt(q)}L${pt(l)}Q${pt(at(q, a, s * 1.35))} ${pt(r)}Z`; };
    let d = '';
    [[0.3, -0.9, 18], [0.45, 0.9, 16], [0.62, -0.8, 15], [0.78, 0.8, 13], [1, 0, 12]].forEach(([u, off, s]) => { const [p, a] = onStem(st, min(0.99, u)); d += fan(p, a + off, s); });
    return [{ d: curve(st) }, { d }];
  })()),
  sp2('sp_grass', '草葉', [
    { d: curve([[40, 140], [38, 100], [26, 64], [12, 40]]) + curve([[48, 140], [50, 96], [46, 50], [52, 14]]) + curve([[54, 140], [62, 108], [78, 84], [92, 76]]) + curve([[44, 140], [36, 116], [28, 108]]) },
    { d: Array.from({ length: 6 }, (_, i) => ellR(...onStem([[48, 140], [50, 96], [46, 50], [52, 14]], 0.78 + i * 0.04)[0], 1.6, 3.4, 20 + (i % 2) * 40)).join(''), accent: true },
  ]),
  sp2('sp_olive', '橄欖枝', (() => {
    const st = [[60, 140], [52, 104], [44, 64], [46, 20]];
    let d = '';
    for (let i = 1; i < 10; i++) { const [p, a] = onStem(st, i / 10), sd = i % 2 ? -1 : 1; d += leafLine(p, at(p, a + sd * 0.7, 16 - i * 0.6), 5, sd); }
    return [{ d: curve(st) + d }, { d: ellR(32, 80, 3.5, 4.5, 20) + ellR(62, 58, 3, 4, -20), accent: true }];
  })()),
  sp2('sp_chamomile', '洋甘菊', (() => {
    const heads = [[34, 46], [58, 34], [70, 62], [44, 74]];
    let st = '', d = '';
    heads.forEach(([x, y], i) => { st += curve([[50, 140], [50 + (x - 50) * 0.3, 104], [x, y + 8]]); d += circle(x, y, 3.4) + petals(x, y, 9, 4, 10 - i * 0.6, 3.5, i * 9); });
    return [{ d: st }, { d, accent: true }];
  })()),
  sp2('sp_cattail', '香蒲', [
    { d: curve([[44, 140], [42, 90], [38, 50], [36, 16]]) + curve([[54, 140], [58, 96], [62, 60], [66, 36]]) + curve([[48, 140], [30, 112], [16, 74], [14, 50]]) + curve([[50, 140], [68, 110], [84, 88]]) },
    { d: ellR(38, 56, 4.5, 15, 3) + ellR(63, 74, 4, 12, -8), accent: true },
  ]),
  sp2('sp_rosebud', '玫瑰花苞', [
    { d: curve([[50, 140], [46, 100], [52, 70], [50, 52]]) + 'M48 120L44 117M50 96L54 93M48 80L44 78' + leafLine([49, 106], [30, 96], 12, 3) + leafLine([51, 86], [68, 78], 10, -3) },
    { d: 'M50 52C38 50 36 34 44 26C48 22 54 22 58 28C64 36 60 50 50 52ZM46 30C50 30 54 34 50 40C47 42 44 38 47 36', accent: true },
    { d: 'M42 48L36 54M58 48L64 54' },
  ]),
  sp2('sp_maple', '楓葉枝', (() => {
    const leafM = (cx, cy, s, rot) => { const pts = []; for (let i = 0; i < 10; i++) { const a = (rot - 90 + i * 36) * RAD, r = i % 2 ? s * 0.42 : s * [1, 0.8, 0.6, 0.6, 0.8][(i / 2) % 5]; pts.push([cx + r * cos(a), cy + r * sin(a)]); } return poly(pts); };
    return [
      { d: curve([[52, 140], [50, 100], [44, 70], [40, 46]]) + curve([[49, 92], [62, 80], [70, 70]]) },
      { d: leafM(38, 30, 21, -10) + leafM(74, 58, 15, 25) },
      { d: circle(30, 70, 2) + circle(26, 76, 1.6), accent: true },
    ];
  })()),
  sp2('sp_bigleaf', '大葉子', [
    { d: curve([[56, 140], [54, 116], [50, 98]]) + leafLine([50, 100], [42, 22], 46, 3) },
    { d: curve([[50, 100], [44, 60], [42, 26]]) + [0.25, 0.4, 0.55, 0.7].map((u) => { const [p, a] = onStem([[50, 100], [44, 60], [42, 26]], u); return `M${pt(p)}L${pt(at(p, a - 0.9, 16))}M${pt(p)}L${pt(at(p, a + 0.9, 16))}`; }).join('') },
  ]),
  sp2('sp_mimosa', '含羞草球', (() => {
    const st = [[40, 140], [44, 100], [58, 64], [80, 42]];
    let d = '', st2 = '';
    [0.42, 0.56, 0.7, 0.84, 0.98].forEach((u, i) => { const [p, a] = onStem(st, u), c = at(p, a + (i % 2 ? 1 : -1) * 1.1, 9); st2 += `M${pt(p)}L${pt(c)}`; d += circle(c[0], c[1], 4.5 - i * 0.3); });
    return [{ d: curve(st) + st2 + curve([[42, 118], [28, 104], [22, 86]]) }, { d, accent: true }];
  })()),
  // 第九版：補到 30
  sp2('sp_iris', '鳶尾', [
    { d: curve([[50, 140], [50, 100], [48, 62]]) + leafLine([50, 138], [30, 56], 10, 2) + leafLine([50, 138], [68, 66], 9, -2) },
    { d: leafLine([48, 58], [40, 28], 10, 2) + leafLine([48, 58], [58, 30], 10, -2) + leafLine([48, 60], [28, 70], 10, -3) + leafLine([48, 60], [68, 72], 10, 3), accent: true },
  ]),
  sp2('sp_hydrangea', '繡球', (() => {
    let d = '';
    for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) {
      const x = 50 + i * 7 + (j % 2) * 3.5, y = 44 + j * 7;
      if (hypot(x - 50, (y - 44) * 1.3) > 23) continue;
      d += [0, 1, 2, 3].map((k) => circle(...at([x, y], k * PI / 2 + 0.4, 2.2), 1.7)).join('');
    }
    return [{ d: curve([[50, 140], [52, 100], [50, 66]]) + leafLine([51, 112], [24, 96], 16, 4) + leafLine([51, 100], [78, 88], 14, -4) }, { d, accent: true }];
  })()),
  sp2('sp_pine', '松枝', (() => {
    const st = [[38, 140], [44, 100], [56, 62], [72, 24]];
    let d = '';
    for (let i = 2; i < 12; i++) { const [p, a] = onStem(st, i / 12); for (const o of [-1.0, -0.6, 0.6, 1.0]) d += `M${pt(p)}L${pt(at(p, a + o, 12 - i * 0.4))}`; }
    return [{ d: curve(st) + d }, { d: ellR(34, 96, 5, 8, -20) + ellR(78, 60, 4, 7, 20), accent: true }];
  })()),
  sp2('sp_oat', '燕麥', (() => {
    const st = [[50, 140], [50, 90], [46, 44], [40, 16]];
    let d = '', h = '';
    [0.5, 0.6, 0.68, 0.76, 0.84, 0.92].forEach((u, i) => { const [p, a] = onStem(st, u), sd = i % 2 ? 1 : -1, q = at(p, a + sd * 1.3, 8); d += `M${pt(p)}L${pt(q)}`; h += leafLine(q, [q[0] + sd * 2, q[1] + 12], 5); });
    return [{ d: curve(st) + d + leafLine([50, 128], [30, 96], 6, 2) }, { d: h, accent: true }];
  })()),
  sp2('sp_rosemary', '迷迭香', (() => {
    const st = [[52, 140], [50, 100], [46, 60], [44, 18]];
    let d = '';
    for (let i = 2; i < 16; i++) { const [p, a] = onStem(st, i / 16); d += leafLine(p, at(p, a - 1.1, 9), 2.6) + leafLine(p, at(p, a + 1.1, 9), 2.6); }
    return [{ d: curve(st) + d }, { d: circle(40, 40, 2) + circle(54, 56, 2) + circle(38, 70, 1.8), accent: true }];
  })()),
];

// =====================================================================
// 風格包與一鍵套用（主開發併進 doodles.js 的 PACKS / DOODLE_PRESETS）
// 每包約 25 種圖案、權重平均；max 讓同一張照片裡少重複（編號點、貓每隻最多一次）
// 沒有 lw：線條粗細跟著圖案大小（像真的用筆畫在一張張小圖上）
// =====================================================================
const each = (ids, w = 1) => Object.fromEntries(ids.map((id) => [id, w]));
const once = (list) => Object.fromEntries(list.map((d) => [d.id, 1]));
export const PACKS_V9 = {
  // 8-bit 像素：色票的低飽和色；像素格看得到
  pixel: {
    name: '8-bit 像素', glow: 0, noGlow: true,
    sizes: { small: [0.06, 0.08], medium: [0.09, 0.12], large: [0.14, 0.18] },
    colors: ['#D9A3A0', '#E9D79A', '#A99BC5', '#9CB9D0', '#A6B58A', '#CB8875'], recolor: 0.35,
    small: each(['px_sparkle', 'px_heart', 'px_star', 'px_note', 'px_drop', 'px_clover', 'px_cherry', 'px_snow', 'px_gem', 'px_leaf', 'px_pear']),
    medium: each(['px_flower', 'px_daisy', 'px_moon', 'px_mushroom', 'px_bird', 'px_tulip', 'px_butterfly', 'px_cup', 'px_apple', 'px_bow', 'px_letter', 'px_cloud', 'px_pear', 'px_candle', 'px_umbrella']),
    large: each(['px_sun', 'px_rainbow', 'px_house', 'px_tree', 'px_planet', 'px_cloud', 'px_flower']),
    max: each(['px_sun', 'px_rainbow', 'px_house', 'px_tree', 'px_planet', 'px_letter', 'px_cup'], 1),
  },
  // 連連看星星：淡藍色鉛筆、編號點、水鑽
  dotstar: {
    name: '連連看星星', glow: 0, noGlow: true,
    sizes: { small: [0.07, 0.1], medium: [0.13, 0.18], large: [0.22, 0.3] },
    colors: ['#86ADD5', '#9CB9D0', '#7FA3CC'], recolor: 0.3,
    small: each(['ds_dot7', 'ds_dot12', 'ds_dot3', 'ds_fill_s', 'ds_hatch_s', 'ds_line_s', 'ds_spark', 'ds_star8', 'ds_heart_hatch']),
    medium: each(['ds_twin', 'ds_comet', 'ds_gem_star', 'ds_gem_spark', 'ds_gem_ring', 'ds_moon', 'ds_planet', 'ds_connect2', 'ds_gem_arc', 'ds_gem_moon', 'ds_fill_s', 'ds_hatch_s',
      'ds_heart_hatch', 'ds_gem_heart', 'ds_star8', 'ds_gem_star8', 'ds_double', 'ds_cloud', 'ds_moon_fill']),
    large: each(['ds_star_fill', 'ds_star_hatch', 'ds_star_pattern', 'ds_gem_sun8', 'ds_gem_sun16', 'ds_connect', 'ds_double', 'ds_gem_star8']),
    // ds_shoot（流星）只當單張貼圖、不進塗鴉框：避免和編號點排在一起（侵權審查）
    max: { ...once(ART_DOTSTAR), ds_fill_s: 3, ds_hatch_s: 3, ds_line_s: 3, ds_spark: 2 },
  },
  // 蠟筆貓咪：每隻顏色不同、姿勢不同（同一張照片每隻最多一次）
  cats: {
    name: '蠟筆貓咪', glow: 0, noGlow: true,
    sizes: { small: [0.12, 0.15], medium: [0.17, 0.22], large: [0.26, 0.34] },
    colors: [C_TEAL, C_BRICK, C_YEL, C_GRN, C_ORG, C_GRAY, C_PINK, C_PURP, C_LIME, C_BRN, C_BLUE, C_SAND, C_ROSE, C_SLATE, C_MAUVE], recolor: 0.6,
    keepColor: ['cat_walk', 'cat_long', 'cat_hang', 'cat_stand'], // 這幾隻固定顏色（換色可能撞到參考圖的配色）
    anchors: { cat_peek: 'bottom' },
    small: each(['cat_kitten', 'cat_face', 'cat_loaf', 'cat_sleep', 'cat_back', 'cat_lick']),
    medium: each(['cat_walk', 'cat_sitfront', 'cat_jump', 'cat_crouch', 'cat_roll', 'cat_peek', 'cat_stand', 'cat_arch', 'cat_run', 'cat_sitside', 'cat_box', 'cat_yarn', 'cat_star', 'cat_dance', 'cat_tiptoe',
      'cat_tailup', 'cat_peer', 'cat_lick', 'cat_chase', 'cat_turn']),
    large: each(['cat_long', 'cat_stretch', 'cat_sunbathe', 'cat_flop', 'cat_hang', 'cat_jump', 'cat_walk']),
    max: once(ART_CATS),
  },
};
export const PRESETS_V9 = [
  { id: 'pixel', name: '8-bit 像素', pack: 'pixel', layout: 'edge', count: 16 },
  { id: 'dotstar', name: '連連看星星', pack: 'dotstar', layout: 'top', count: 12 },
  { id: 'cats', name: '蠟筆貓咪', pack: 'cats', layout: 'edge', count: 9 },
];
