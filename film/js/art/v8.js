// FilmDoodle — 第六版（網站 v8）素材：色鉛筆小物、植物版畫、十字繡／點描圖案、文具工具列
// 風格依 film/STYLE.md：A 色鉛筆小物（沒有臉、外框同色系加深）、B 植物版畫（單色、正負形挖空）、
// D 實驗性多媒材（十字繡格、點描線稿）。全部原創造型；不照搬參考圖的構圖與圖案組合。
// 筆刷在 js/print.js（drawPencilDef / drawPrintDef / drawCrossStitch / drawStipple）。
import { n, poly } from './shapes.js';

const { PI, cos, sin, hypot, atan2, max, min, abs, pow } = Math;
const RAD = PI / 180;

// ---------- 色票（褪色顏料） ----------
const IVORY = '#F4EEDF', CREAM = '#E9D79A', LILAC = '#A99BC5', BLUE = '#9CB9D0', SAGE = '#A6B58A',
  TERRA = '#CB8875', CHOC = '#655047', CHAR = '#65645D', LIME = '#9DC044', STEEL = '#B4B1A8', PHOTO = '#FAF6EC';

// ---------- 小工具 ----------
const pt = (p) => `${n(p[0])} ${n(p[1])}`;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// 平移＋縮放＋旋轉（度）
const T = (pts, dx, dy, k = 1, deg = 0) => {
  const c = cos(deg * RAD), s = sin(deg * RAD);
  return pts.map(([x, y]) => [dx + k * (x * c - y * s), dy + k * (x * s + y * c)]);
};
// Catmull-Rom → 三次貝茲
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
const blob = (pts) => segD(crSegs(pts, true)) + 'Z'; // 穿過各點的平滑閉合形
const curve = (pts) => segD(crSegs(pts, false)); // 穿過各點的平滑線
// Catmull-Rom 取樣（給緞帶／葉脈用）
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
// 圓角多邊形（r：圓角大小，可以是陣列）——稚拙但不尖銳的輪廓
function soft(pts, r = 3) {
  const N = pts.length, rr = (i) => (Array.isArray(r) ? r[i % r.length] : r);
  const cut = (v, w, i) => { const L = hypot(w[0] - v[0], w[1] - v[1]); return lerp(v, w, min(rr(i) / L, 0.45)); };
  let d = '';
  for (let i = 0; i < N; i++) {
    const v = pts[i], a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
    const p1 = cut(v, a, i), p2 = cut(v, b, i);
    d += (i ? 'L' : 'M') + pt(p1) + 'Q' + pt(v) + ' ' + pt(p2);
  }
  return d + 'Z';
}
// 旋轉橢圓
function ellR(cx, cy, rx, ry, deg = 0) {
  const c = cos(deg * RAD), s = sin(deg * RAD);
  const p1 = [cx + rx * c, cy + rx * s], p2 = [cx - rx * c, cy - rx * s];
  return `M${pt(p1)}A${n(rx)} ${n(ry)} ${n(deg)} 1 1 ${pt(p2)}A${n(rx)} ${n(ry)} ${n(deg)} 1 1 ${pt(p1)}Z`;
}
const circle = (cx, cy, r) => ellR(cx, cy, r, r);
// 橢圓上取點（wob：每點半徑的微小變化 → 稚拙不正的圓）
const ring = (cx, cy, rx, ry, k = 12, wob = [0], rot = -PI / 2) => Array.from({ length: k }, (_, i) => {
  const a = rot + (i * 2 * PI) / k, r = 1 + wob[i % wob.length];
  return [cx + rx * r * cos(a), cy + ry * r * sin(a)];
});
// 沿著一條線的漸細緞帶（莖、枝、刻出來的葉脈）
function ribbon(pts, w0, w1, k = 8) {
  const S = crSample(pts, k), L = [0];
  for (let i = 1; i < S.length; i++) L.push(L[i - 1] + hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
  const tot = L[L.length - 1] || 1, left = [], right = [];
  S.forEach((p, i) => {
    const a = S[max(0, i - 1)], b = S[min(S.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = hypot(dx, dy) || 1;
    const hw = (w0 + (w1 - w0) * (L[i] / tot)) / 2, nx = -dy / m, ny = dx / m;
    left.push([p[0] + nx * hw, p[1] + ny * hw]);
    right.push([p[0] - nx * hw, p[1] - ny * hw]);
  });
  return poly([...left, ...right.reverse()]);
}
// 葉形：從 base 到 tip，寬 w；bend 讓中線彎、round 越大葉尖越圓；teeth：鋸齒（蒲公英葉）
function leafAxis(b, t, bend) {
  const dx = t[0] - b[0], dy = t[1] - b[1], L = hypot(dx, dy), nx = -dy / L, ny = dx / L;
  return (u) => [b[0] + dx * u + nx * bend * sin(PI * u), b[1] + dy * u + ny * bend * sin(PI * u), nx, ny];
}
function leafPts(b, t, w, { bend = 0, round = 0.75, N = 14, teeth = 0, tooth = 0.45, skew = 0.42 } = {}) {
  const ax = leafAxis(b, t, bend), L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, v = u < skew ? (u / skew) * 0.5 : 0.5 + ((u - skew) / (1 - skew)) * 0.5; // 最寬處在 skew
    let hw = (w / 2) * pow(sin(PI * v), round);
    if (teeth) hw *= 1 - tooth * abs(sin(PI * teeth * u)) * (u > 0.08 && u < 0.92 ? 1 : 0);
    const [x, y, nx, ny] = ax(u);
    L.push([x + nx * hw, y + ny * hw]);
    R.push([x - nx * hw, y - ny * hw]);
  }
  return [...L, ...R.reverse().slice(1, -1)];
}
const leaf = (b, t, w, o) => poly(leafPts(b, t, w, o));
const leafS = (b, t, w, o) => blob(leafPts(b, t, w, { N: 8, ...o }));
// 葉脈（版畫用：刻在葉子裡面的細縫）
function vein(b, t, { bend = 0, u0 = 0.12, u1 = 0.84, w0 = 1.6, w1 = 0.35 } = {}) {
  const ax = leafAxis(b, t, bend), pts = [];
  for (let i = 0; i <= 6; i++) { const [x, y] = ax(u0 + ((u1 - u0) * i) / 6); pts.push([x, y]); }
  return ribbon(pts, w0, w1, 4);
}
const along = (b, t, u, bend = 0) => leafAxis(b, t, bend)(u).slice(0, 2);
// 多角星（arms：每隻角長短不一 → 手畫的星）
const starRing = (cx, cy, ro, ri, k, rotDeg = -90, arms = [0]) => Array.from({ length: k * 2 }, (_, i) => {
  const a = (rotDeg + (i * 180) / k) * RAD, r = i % 2 ? ri : ro * (1 + arms[(i / 2) % arms.length]);
  return [cx + r * cos(a), cy + r * sin(a)];
});
// 部件
const F = (d, f = 'M', s = 'D', w = 2.2, a) => ({ d, f, s, w, ...(a != null ? { a } : {}) }); // 填色＋同色系外框
const S = (d, s = 'D', w = 1.6, a) => ({ d, s, w, ...(a != null ? { a } : {}) }); // 只有線
const P = (d) => ({ d, f: 'M' }); // 版畫：單色

// =====================================================================
// A 色鉛筆小物（沒有臉；填色有兩方向的筆觸，外框用填色加深）
// =====================================================================
const pencil = (id, name, color, parts, vb) => ({ id, name, cat: 'pencil', style: 'pencil', color, ...(vb ? { vb } : {}), parts });

// 花瓣外框：相鄰兩點之間畫往外鼓的大圓弧
function petalRing(cx, cy, r, k, rot = -90, bulge = 1.02, jit = [0]) {
  const p = Array.from({ length: k }, (_, i) => {
    const a = (rot + 180 / k + (i * 360) / k) * RAD, rr = r * (1 + jit[i % jit.length]);
    return [cx + rr * cos(a), cy + rr * sin(a)];
  });
  let d = `M${pt(p[0])}`;
  for (let i = 1; i <= k; i++) {
    const a = p[i - 1], b = p[i % k], ch = hypot(b[0] - a[0], b[1] - a[1]);
    d += `A${n(ch * 0.5 * bulge)} ${n(ch * 0.5 * bulge)} 0 1 1 ${pt(b)}`;
  }
  return d + 'Z';
}
// 新月：大圓扣掉小圓
function crescent(cx, cy, r, ox, oy, r2) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * PI, p = [cx + r * cos(a), cy + r * sin(a)];
    if (hypot(p[0] - ox, p[1] - oy) > r2) pts.push([a, p]);
  }
  // 從缺口一端繞外圈到另一端
  pts.sort((A, B) => A[0] - B[0]);
  let k = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i][0] - pts[i - 1][0] > 0.2) k = i;
  const outer = [...pts.slice(k), ...pts.slice(0, k)].map((q) => q[1]);
  const A = outer[0], B = outer[outer.length - 1];
  const a0 = atan2(B[1] - oy, B[0] - ox), a1 = atan2(A[1] - oy, A[0] - ox);
  let da = a1 - a0;
  while (da > 0) da -= 2 * PI; // 內圈逆向走回
  const inner = Array.from({ length: 24 }, (_, i) => { const a = a0 + (da * (i + 1)) / 25; return [ox + r2 * cos(a), oy + r2 * sin(a)]; });
  return poly([...outer, ...inner]);
}

// 茶杯杯身
const cupBody = 'M20 44C20.5 66 30 78 48 78C66 78 75.5 66 76 44A28 6 0 0 0 20 44Z';

export const ART_PENCIL = [
  pencil('pc_sweater', '毛衣', TERRA, [
    F(soft([[39, 17], [25, 21], [14, 29], [6, 57], [7.5, 66], [19.5, 65.5], [25.5, 39], [27, 84], [73.5, 84.5], [74.5, 38.5], [80.5, 65], [92.5, 64.5], [94, 56], [86.5, 28.5], [75, 21], [61, 16.5], [55.5, 22.5], [50, 24.5], [44, 22.5]], [3, 3, 4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 4, 3, 3, 4, 4, 4])),
    F(poly([[27, 46.5], [73.8, 46], [74, 54], [27.2, 54.6]]), CREAM, 'D', 1.6),
    S(curve([[41.5, 19.2], [45, 25.5], [50, 28], [55, 25.5], [58.6, 18.8]]), 'D', 1.6),
    S(curve([[28, 77.5], [50, 78.3], [73, 77.3]]), 'D', 1.4),
    S(Array.from({ length: 8 }, (_, i) => { const x = 32 + i * 5.6; return `M${n(x)} 79.5L${n(x + 0.3)} 83`; }).join(''), 'D', 1.2, 0.8),
    S('M8 59.5L20.5 59.8M80 59.5L93.3 58.6', 'D', 1.4),
    S([38, 50, 62].map((x) => `M${x - 2} 50.3L${x + 2} 50.3`).join(''), TERRA, 1.6, 0.9),
  ]),
  pencil('pc_cherry', '櫻桃', TERRA, [
    S(curve([[37, 55], [41, 38], [50, 25], [56, 17]]), SAGE, 2.6),
    S(curve([[65, 59], [62, 42], [59, 27], [56, 17]]), SAGE, 2.6),
    F(leafS([56, 17], [83, 11], 13, { bend: -4 }), SAGE, 'D', 1.8),
    S(curve([[59, 16.2], [70, 13.6], [79, 11.8]]), 'D', 1.2, 0.8),
    F(blob(ring(36, 68, 15.5, 14.5, 10, [0, 0.03, -0.02, 0.02, 0, -0.03, 0.02, 0, 0.01, -0.02]))),
    F(blob(ring(65, 72, 13.5, 12.8, 10, [0.02, 0, -0.03, 0.01, 0.02, 0, -0.02, 0.02, 0, -0.01]))),
    F(ellR(30, 61.5, 4.2, 2.4, -38), PHOTO, null),
    F(ellR(59.5, 66.5, 3.4, 2, -38), PHOTO, null),
  ]),
  pencil('pc_cutlery', '叉子湯匙', BLUE, [
    F(soft([[32.5, 88], [33.6, 47], [29.4, 40], [28.4, 32], [28.6, 12.5], [31, 12], [31.3, 30.5], [33.7, 30.5], [33.9, 11], [36.3, 11], [36.4, 30.5], [38.7, 30.5], [39, 12], [41.3, 12.5], [41.5, 32], [40.5, 40], [36.6, 47], [38.5, 88], [35.6, 91]], [1.2, 2, 3, 2, 1, 1, 0.6, 0.6, 1, 1, 0.6, 0.6, 1, 1, 2, 3, 2, 1.5, 2])),
    F((() => {
      const cx = 64, cy = 27, rx = 10, ry = 14.5, bowl = [];
      for (let a = 100; a <= 440; a += 20) bowl.push([cx + rx * cos(a * RAD), cy + ry * sin(a * RAD)]);
      return soft([...bowl, [cx + 1.8, cy + ry + 3], [cx + 3.8, 86], [cx + 1.5, 90.5], [cx - 2.4, 89.5], [cx - 1.6, cy + ry + 3]], [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1.5, 2, 2, 3]);
    })()),
    S(curve([[58.5, 22], [60, 16.5], [64, 14]]), IVORY, 2.2, 0.9),
    S('M35.2 54L35.4 82', 'D', 1.1, 0.5),
  ]),
  pencil('pc_bow', '蝴蝶結', LILAC, [
    F(soft([[46, 49], [37, 71], [32.5, 84.5], [39.5, 80.5], [44.5, 84.5], [51, 52]], [2, 3, 1.5, 1.5, 1.5, 2])),
    F(soft([[54, 50], [61.5, 73], [69.5, 86], [71, 77], [77.5, 78.5], [58.5, 48]], [2, 3, 1.5, 1.5, 1.5, 2])),
    F(blob([[47, 42], [37, 30], [22, 25.5], [12.5, 33], [13.5, 49], [24, 58.5], [38, 54], [47, 47.5]])),
    F(blob([[53, 42], [63, 28.5], [79.5, 23.5], [89, 33], [87, 49.5], [76, 57.5], [62, 53], [53, 47.5]])),
    S(curve([[44, 44.5], [33, 40.5], [21, 41]]), 'D', 1.4, 0.85),
    S(curve([[56, 44.5], [67, 40], [79, 40.5]]), 'D', 1.4, 0.85),
    F(blob(ring(50, 45.5, 6.4, 7.8, 8, [0, 0.04, -0.03, 0.02]))),
  ]),
  pencil('pc_star8', '八角星', CREAM, [
    F(soft(starRing(50, 51, 43, 17.5, 8, -88, [0, -0.12, 0.04, -0.16, 0.02, -0.1, 0.05, -0.14]), 1.4)),
  ]),
  pencil('pc_flower', '小花', LILAC, [
    F(ribbon([[50, 50], [51.5, 66], [48.5, 80], [49.5, 93]], 3.4, 2.8), SAGE, 'D', 1.4),
    F(leafS([50, 76], [70, 63], 11, { bend: -3 }), SAGE, 'D', 1.6),
    F(leafS([49.5, 84], [33, 76], 8.5, { bend: 2 }), SAGE, 'D', 1.6),
    F(petalRing(50, 36, 11, 5, -94, 1.02, [0, 0.06, -0.04, 0.05, -0.02])),
    F(blob(ring(50, 36, 6.2, 5.8, 8, [0, 0.05, -0.04, 0.03])), CREAM, 'D', 1.6),
  ]),
  pencil('pc_teacup', '茶杯', BLUE, [
    F(blob(ring(48, 80, 38, 8.2, 14, [0, 0.01, -0.01, 0.02]))),
    F(ellR(48, 80, 15, 3, 0), CHAR, null, 0, 0.22),
    F(`${ellR(79, 56, 11.5, 10.5, -8)}${ellR(79, 56, 6.3, 5.4, -8)}`),
    F(cupBody),
    F(poly([[21, 52.5], [34, 56.2], [48, 57.4], [62, 56.2], [75, 52.5], [74.4, 58.2], [62, 62], [48, 63.2], [34, 62], [21.8, 58.2]]), CREAM, 'D', 1.4),
    F(ellR(48, 44.6, 24.5, 4.2, 0), CHOC, 'D', 1.2, 0.9),
  ]),
  pencil('pc_bread', '麵包', TERRA, [
    F(soft([[18.5, 83], [17.5, 55], [11.5, 50.5], [9.5, 40], [15.5, 28.5], [31, 21], [50, 18.5], [69, 20.5], [84.5, 28], [90.5, 40], [88.5, 50.5], [82.5, 55], [81.5, 83]], [3, 4, 5, 8, 8, 8, 8, 8, 8, 8, 5, 4, 3])),
    F(soft([[20, 57], [80, 57], [80, 81.5], [20, 81.5]], 3), CREAM, 'D', 1.6),
    ...[[30, 40, 18, 7, -58], [50, 36, 19, 7, -58], [70, 38, 17, 6.5, -58]].map(([x, y, L, w, d]) =>
      F(leafS(T([[-L / 2, 0]], x, y, 1, d)[0], T([[L / 2, 0]], x, y, 1, d)[0], w, { round: 0.9 }), CREAM, 'D', 1.4)),
  ]),
  pencil('pc_cake', '蛋糕切片', CREAM, [
    F(poly([[12, 53], [91, 45], [91, 79], [12, 85]])),
    F(poly([[12.5, 66.5], [90.5, 59.5], [90.5, 65.5], [12.5, 72.5]]), TERRA, 'D', 1.2),
    F(poly([[12, 53], [62, 35], [91, 45]]), IVORY, 'D', 1.8),
    F(blob([[12, 53], [50, 49], [91, 45], [91, 50], [83, 51.5], [79, 55.5], [75, 52.5], [60, 54], [56, 58.5], [52, 55], [37, 56.5], [33, 60], [29, 57.5], [12, 59.5]].map((p) => p)), IVORY, 'D', 1.6),
    S(curve([[59, 32], [61, 25], [66, 20]]), SAGE, 2),
    F(blob(ring(58, 37, 6, 5.6, 8, [0, 0.04, -0.03, 0.02])), TERRA, 'D', 1.6),
  ]),
  pencil('pc_mitten', '手套', SAGE, [
    F(blob([[35, 75], [33.5, 64], [22, 61], [14, 51], [14, 41], [20, 36.5], [27, 40.5], [32.5, 48], [33.5, 30], [38.5, 16.5], [54, 10.5], [68.5, 16], [74.5, 32], [74.5, 60], [72.5, 76]])),
    F(soft([[30.5, 71.5], [76.5, 70.5], [77.5, 90], [29.5, 91]], 3), CREAM, 'D', 2),
    S(Array.from({ length: 7 }, (_, i) => { const x = 36 + i * 6; return `M${x} 75L${x + 0.4} 86.5`; }).join(''), 'D', 1.2, 0.8),
    ...[[54, 32], [47.5, 41], [60.5, 41], [54, 50]].map(([x, y]) => F(circle(x, y, 2), TERRA, null)),
  ]),
  pencil('pc_moon', '月亮', CREAM, [
    F(crescent(48, 52, 36, 66, 40, 30)),
  ]),
  pencil('pc_button', '鈕扣', BLUE, [
    F(blob(ring(50, 50, 36, 35, 14, [0, 0.01, -0.015, 0.01, 0.02, -0.01, 0, 0.015, -0.01, 0.01, 0, -0.02, 0.01, 0])) +
      [[43, 43], [57, 43], [43, 57], [57, 57]].map(([x, y]) => circle(x, y, 4)).join('')),
    S(blob(ring(50, 50, 27.5, 27, 12, [0, 0.01, -0.01])), 'D', 1.6, 0.8),
    S('M43 43L57 57M57 43L43 57', TERRA, 2.6),
  ]),
];

// =====================================================================
// B 植物版畫（單色；葉脈、花心都用 evenodd 挖空）
// =====================================================================
const print = (id, name, parts, vb, color = LIME) => ({ id, name, cat: 'print', style: 'print', color, ...(vb ? { vb } : {}), parts });

// 三葉草的一片心形小葉（尖端朝中心）
function cloverLeaf(cx, cy, deg, k = 1.25) {
  const shape = T([[0, -1], [7, -8], [11.5, -16], [9.5, -23.5], [3.5, -25.5], [0, -21], [-3.5, -25.5], [-9.5, -23.5], [-11.5, -16], [-7, -8]], cx, cy, k, deg);
  const vee = T([[-6.5, -15.5], [-3, -12.8], [0, -11.4], [3, -12.8], [6.5, -15.5]], cx, cy, k, deg);
  return P(blob(shape) + ribbon(vee, 1.7, 1.5));
}
// 松針：一束扇形，針與針之間刻到靠近根部
function needleFan(x, y, dir, r = 17, k = 9, spread = 110) {
  const pts = [[x, y]];
  for (let i = 0; i < k; i++) {
    const a0 = (dir - spread / 2 + (spread * i) / (k - 1)) * RAD, rr = r * (0.85 + 0.15 * sin(i * 2.1));
    const aL = a0 - 0.035, aR = a0 + 0.035;
    pts.push([x + 4.5 * cos(a0 - 0.13), y + 4.5 * sin(a0 - 0.13)], [x + rr * cos(aL), y + rr * sin(aL)], [x + rr * 1.02 * cos(a0), y + rr * 1.02 * sin(a0)], [x + rr * cos(aR), y + rr * sin(aR)], [x + 4.5 * cos(a0 + 0.13), y + 4.5 * sin(a0 + 0.13)]);
  }
  return P(poly(pts));
}
// 橡樹葉：裂片外框
function oakPts(b, t, W, lobes = 4.5) {
  const ax = leafAxis(b, t, 2), L = [], R = [], N = 64;
  for (let i = 0; i <= N; i++) {
    const u = i / N, env = pow(sin(PI * pow(u, 0.85)), 0.8);
    const lob = (ph) => 0.5 + 0.5 * pow(abs(cos(PI * lobes * u + ph)), 0.7);
    const [x, y, nx, ny] = ax(u);
    L.push([x + nx * (W / 2) * env * lob(0), y + ny * (W / 2) * env * lob(0)]);
    R.push([x - nx * (W / 2) * env * lob(0.5), y - ny * (W / 2) * env * lob(0.5)]);
  }
  return [...L, ...R.reverse().slice(1, -1)];
}

export const ART_PRINT = [
  print('pr_clover', '三葉草', [
    P(ribbon([[50, 44], [49, 60], [45, 78], [47, 94]], 3.4, 2.4)),
    cloverLeaf(50, 40, 0), cloverLeaf(51.5, 42.5, 118), cloverLeaf(48.5, 42.5, -118),
  ]),
  print('pr_wheat', '麥穗', [
    P(ribbon([[54, 96], [52, 70], [50, 44], [49.5, 18]], 2.8, 1.4)),
    P(leaf([53, 82], [80, 52], 9, { bend: 4 }) + vein([53, 82], [80, 52], { bend: 4, w0: 1.2 })),
    ...Array.from({ length: 9 }, (_, i) => {
      const side = i % 2 ? 1 : -1, y = 62 - i * 4.8, x = 50.6 - i * 0.12, L = 13 - i * 0.45;
      const tip = [x + side * L * 0.52, y - L * 0.86];
      return P(leafS([x + side * 0.6, y], tip, 6.4, { round: 0.85 }) + vein([x + side * 0.6, y], tip, { u0: 0.3, u1: 0.78, w0: 1, w1: 0.4 }));
    }),
    P(leafS([49.6, 20], [49.4, 7], 5.6, { round: 0.85 })),
    P(Array.from({ length: 9 }, (_, i) => {
      const side = i % 2 ? 1 : -1, y = 62 - i * 4.8, x = 50.6 - i * 0.12, L = 13 - i * 0.45;
      const a = [x + side * L * 0.55, y - L * 0.9];
      return ribbon([a, [a[0] + side * 4, a[1] - 9], [a[0] + side * 7.5, a[1] - 15]], 0.9, 0.3, 3);
    }).join('')),
  ]),
  print('pr_daisy', '雛菊', [
    P(ribbon([[50, 46], [53, 62], [49, 80], [51, 95]], 3, 2.6)),
    P(leaf([51.5, 77], [76, 63], 10, { bend: -3 }) + vein([51.5, 77], [76, 63], { bend: -3, w0: 1.2 })),
    P(Array.from({ length: 13 }, (_, i) => {
      const a = (-90 + (i * 360) / 13 + (i % 3) * 3) * RAD, r0 = 11.5, r1 = 27 + (i % 4) * 1.6 - (i % 3);
      return leafS([50 + r0 * cos(a), 34 + r0 * sin(a)], [50 + r1 * cos(a), 34 + r1 * sin(a)], 6.6, { round: 0.6, skew: 0.6 });
    }).join('')),
    P(blob(ring(50, 34, 9.5, 9, 10, [0, 0.04, -0.03, 0.03, -0.02])) + [[47, 31], [52.5, 30.5], [55, 35], [50, 37.5], [45.5, 36], [49.6, 33.8]].map(([x, y]) => circle(x, y, 1.15)).join('')),
  ]),
  print('pr_fern', '蕨葉', (() => {
    const rach = [[38, 96], [44, 74], [51, 48], [56, 26], [60, 8]], S2 = crSample(rach, 10), parts = [P(ribbon(rach, 3.4, 0.6))];
    const K = 13;
    for (let i = 0; i < K; i++) {
      const idx = Math.round(6 + i * ((S2.length - 10) / K)), p = S2[idx], q = S2[idx + 1];
      const dir = atan2(q[1] - p[1], q[0] - p[0]), side = i % 2 ? 1 : -1, L = 25 - i * 1.55, ang = dir + side * 62 * RAD;
      const tip = [p[0] + L * cos(ang), p[1] + L * sin(ang)];
      const w = max(4, 8.5 - i * 0.3);
      parts.push(P(leafS(p, tip, w, { round: 0.55, skew: 0.5, bend: -side * 2.5 }) + (L > 13 ? vein(p, tip, { bend: -side * 2.5, u0: 0.18, u1: 0.8, w0: 1, w1: 0.3 }) : '')));
    }
    return parts;
  })()),
  print('pr_olive', '橄欖枝', (() => {
    const br = [[12, 88], [32, 70], [55, 46], [74, 28], [88, 14]], S2 = crSample(br, 10), parts = [P(ribbon(br, 3, 1))];
    [[6, -1], [9, 1], [15, -1], [19, 1], [25, -1], [29, 1], [34, -1], [37, 1]].forEach(([idx, side], i) => {
      const p = S2[idx], q = S2[idx + 1], dir = atan2(q[1] - p[1], q[0] - p[0]), ang = dir + side * 42 * RAD, L = 21 - i * 0.6;
      const tip = [p[0] + L * cos(ang), p[1] + L * sin(ang)];
      parts.push(P(leaf(p, tip, 6.6, { bend: side * 1.5, round: 0.7 }) + vein(p, tip, { bend: side * 1.5, u0: 0.16, u1: 0.8, w0: 1, w1: 0.3 })));
    });
    parts.push(P(ribbon([S2[13], [S2[13][0] + 2, S2[13][1] + 6]], 1.2, 1) + ''), P(ellR(S2[13][0] + 3, S2[13][1] + 12, 4.6, 6.2, -14) + ellR(S2[13][0] + 1.6, S2[13][1] + 10, 1, 2.1, -20)));
    parts.push(P(ribbon([S2[28], [S2[28][0] + 3, S2[28][1] + 5]], 1.2, 1)), P(ellR(S2[28][0] + 5, S2[28][1] + 11, 4.2, 5.8, -20) + ellR(S2[28][0] + 3.6, S2[28][1] + 9, 0.9, 2, -24)));
    return parts;
  })()),
  print('pr_dandelion', '蒲公英', [
    P(ribbon([[51, 50], [48, 70], [50, 96]], 2.8, 2.4)),
    P(leaf([49.5, 95], [24, 70], 12, { bend: 3, teeth: 4, tooth: 0.7, N: 40 })),
    P(leaf([51, 95], [74, 78], 9, { bend: -2, teeth: 3, tooth: 0.7, N: 32 })),
    P(blob(Array.from({ length: 36 }, (_, i) => { const a = (i * 10) * RAD, r = i % 2 ? 23.5 : 26 + (i % 5) * 0.4; return [50 + r * cos(a), 32 + r * sin(a)]; })) +
      Array.from({ length: 18 }, (_, i) => {
        const a = (i * 20 + 6) * RAD, c = cos(a), s = sin(a), e = [50 + 19 * c, 32 + 19 * s];
        return ribbon([[50 + 5.5 * c, 32 + 5.5 * s], e], 0.5, 1.2, 2) + circle(e[0] + 1.8 * c, e[1] + 1.8 * s, 1.15);
      }).join('') + circle(50, 32, 2.6)),
  ]),
  print('pr_pine', '松枝', (() => {
    const br = [[8, 78], [30, 64], [52, 50], [74, 38], [92, 30]], S2 = crSample(br, 10), parts = [P(ribbon(br, 3.4, 1.4))];
    [[6, -70], [12, 75], [18, -65], [24, 80], [29, -60], [35, 40]].forEach(([idx, rel], i) => {
      const p = S2[idx], q = S2[idx + 1], dir = atan2(q[1] - p[1], q[0] - p[0]) / RAD;
      parts.push(needleFan(p[0], p[1], dir + rel, 19 - i * 0.8, 9, 95));
    });
    // 松果：橢圓＋刻出來的鱗片
    const c = [47, 70];
    parts.push(P(ribbon([[46, 52], [47, 58]], 1.6, 1.4)));
    parts.push(P(blob(ring(c[0], c[1], 8.5, 12, 12, [0, 0.03, -0.02, 0.02])) +
      [[-4, -6], [3.5, -6.5], [-5, 0], [0, -1], [5, 0], [-3, 6], [3.5, 6], [0, 11]].map(([dx, dy]) => {
        const x = c[0] + dx, y = c[1] + dy;
        return poly([[x - 2.6, y - 0.6], [x, y + 1.6], [x + 2.6, y - 0.6], [x, y + 0.5]]);
      }).join('')));
    return parts;
  })()),
  print('pr_oak', '橡樹葉', (() => {
    const b = [50, 88], t = [50, 10], ax = leafAxis(b, t, 2);
    let carve = vein(b, t, { bend: 2, u0: 0.05, u1: 0.9, w0: 2, w1: 0.4 });
    [0.22, 0.44, 0.66].forEach((u, i) => {
      [-1, 1].forEach((side) => {
        const uu = u + (side > 0 ? 0.11 : 0), [x, y] = ax(uu), env = pow(sin(PI * pow(uu, 0.85)), 0.8) * 22;
        const e = [x + side * env * 0.62, y - env * 0.4];
        carve += ribbon([[x + side * 2.2, y - 0.6], lerp([x, y], e, 0.5), e], 1.1, 0.3, 3);
      });
    });
    const rot = (d) => d; // 葉子整片略斜
    return [P(ribbon([[50, 98], [50, 92], [50.5, 84]], 3, 2.6)), P(rot(poly(oakPts(b, t, 50)) + carve))];
  })()),
];

// =====================================================================
// 十字繡圖案：點陣（'X' = 繡一格），一格對一格最清楚；繡在照片邊緣（沿底邊、兩側往上爬、角落一小株）
// drawCrossStitch 看到 grid 會直接蓋格子（可加 len 重複成邊條、rot 轉 90°、flip）；parts 是同樣的方格，給一般縮放用。
// =====================================================================
const stitch = (id, name, grid) => ({
  id, name, grid, vb: [grid[0].length, grid.length],
  parts: [{ f: 'M', d: grid.flatMap((row, j) => [...row].map((ch, i) => (ch === 'X' ? `M${i} ${j}h1v1h-1Z` : ''))).join('') }],
});
export const MOTIF_STITCH = [
  stitch('st_clover', '三葉草', [
    '...XX.XX...',
    '..XXXXXXX..',
    '..XXXXXXX..',
    '.X..XXX..X.',
    'XXX..X..XXX',
    'XXXX.X.XXXX',
    '.XXXXXXXXX.',
    'XXXX.X.XXXX',
    'XXX..X..XXX',
    '.X...X...X.',
    '.....X.....',
    '......X....',
    '......X....',
  ]),
  stitch('st_wheat', '麥穗', [
    '...X...',
    '..XXX..',
    'X..X..X',
    'XX.X.XX',
    '.XXXXX.',
    'X..X..X',
    'XX.X.XX',
    '.XXXXX.',
    'X..X..X',
    'XX.X.XX',
    '.XXXXX.',
    '...X...',
    '...X...',
    '..X....',
  ]),
  stitch('st_daisy', '雛菊', [
    '....XXX....',
    '.XX.XXX.XX.',
    '.XXX.X.XXX.',
    '..XX...XX..',
    'XXX..X..XXX',
    'XXX.XXX.XXX',
    'XXX..X..XXX',
    '..XX...XX..',
    '.XXX.X.XXX.',
    '.XX.XXX.XX.',
    '....XXX....',
    '.....X.....',
    '..XX.X.....',
    '...XXX.....',
    '.....X.....',
  ]),
  stitch('st_bird', '小鳥', [
    '........XX..',
    '.......X.XXX',
    'XX....XXX...',
    '.XXXXXXXXX..',
    '..XXXXXXXX..',
    '...XXXXXX...',
    '.....X.X....',
    '....XX.XX...',
  ]),
  // 藤蔓邊條：16 格一個循環，用 len 拉長；rot: -90° 就是沿側邊往上爬
  stitch('st_vine', '藤蔓邊條', [
    '.XX.........X...',
    'XXX........XXX..',
    '..X.........X...',
    'XXXXXXXXXXXXXXXX',
    '......X.....X...',
    '.....XXX.....XX.',
    '.....XX.....XXX.',
  ]),
  stitch('st_sprig', '角落小株', [
    '....X....',
    '...XXX...',
    '....X....',
    'XX..X..XX',
    '.XX.X.XX.',
    '..XXXXX..',
    '....X....',
    'XX..X..XX',
    '.XX.X.XX.',
    '..XXXXX..',
    '....X....',
    '....X....',
    '...X.....',
]),
];

// =====================================================================
// 點描圖案（線條為主；accent: true 的花頭會帶黃點）
// =====================================================================
export const MOTIF_STIPPLE = [
  { id: 'sp_lace', name: '蕾絲花', vb: [100, 140], parts: (() => {
    const c = [50, 46], ends = Array.from({ length: 9 }, (_, i) => { const a = (-160 + i * 17.5) * RAD; return [c[0] + 30 * cos(a) * (1 + (i % 2) * 0.05), c[1] + 24 * sin(a) - 4]; });
    const c2 = [72, 84], ends2 = Array.from({ length: 5 }, (_, i) => { const a = (-150 + i * 30) * RAD; return [c2[0] + 13 * cos(a), c2[1] + 11 * sin(a) - 2]; });
    const bunch = (e, r) => [-r * 1.6, 0, r * 1.6].map((dx, j) => circle(e[0] + dx, e[1] - (j === 1 ? r * 1.4 : 0), r)).join('');
    return [
      { d: curve([[46, 138], [49, 110], [50, 80], [50, 46]]) + curve([[49.6, 104], [60, 96], [72, 84]]) },
      { d: ends.map((e) => `M${pt(c)}L${pt(e)}`).join('') + ends2.map((e) => `M${pt(c2)}L${pt(e)}`).join('') },
      { d: ends.map((e) => bunch(e, 2.4)).join('') + ends2.map((e) => bunch(e, 1.8)).join(''), accent: true },
      { d: curve([[48.5, 120], [38, 114], [30, 116]]) + curve([[38, 114], [34, 108]]) + curve([[34, 115.5], [28, 110]]) + curve([[44, 117], [40, 122]]) },
    ];
  })() },
  { id: 'sp_dandelion', name: '蒲公英', vb: [100, 140], parts: (() => {
    const c = [48, 40], rays = Array.from({ length: 22 }, (_, i) => { const a = (i * 360) / 22 * RAD + 0.1; return [c[0] + 24 * cos(a), c[1] + 24 * sin(a), a]; });
    return [
      { d: curve([[52, 138], [50, 104], [46, 70], [48, 46]]) },
      { d: rays.map(([x, y]) => `M${pt([c[0] + (x - c[0]) * 0.22, c[1] + (y - c[1]) * 0.22])}L${pt([x, y])}`).join('') },
      { d: rays.map(([x, y, a]) => `M${pt([x + 4 * cos(a - 0.55), y + 4 * sin(a - 0.55)])}L${pt([x, y])}L${pt([x + 4 * cos(a + 0.55), y + 4 * sin(a + 0.55)])}`).join(''), accent: true },
      { d: circle(c[0], c[1], 4.5), accent: true },
      { d: curve([[51, 136], [40, 128], [30, 126], [22, 118]]) + 'M40 128L37 121M31 126L27 119M46 132L44 125' },
      { d: curve([[52, 136], [62, 130], [74, 124]]) + 'M62 130L64 123M69 127L72 121' },
    ];
  })() },
  { id: 'sp_foxtail', name: '狗尾草', vb: [100, 140], parts: (() => {
    const heads = [[[38, 138], [36, 90], [30, 50], [40, 22]], [[50, 138], [54, 100], [64, 66], [80, 48]], [[44, 138], [44, 112], [40, 92]]];
    const out = [{ d: heads.map((h) => curve(h)).join('') }];
    heads.forEach((h, k) => {
      const S2 = crSample(h, 10), m = S2.length, from = k === 2 ? m - 7 : m - 12;
      let d = '';
      for (let i = from; i < m - 1; i++) {
        const p = S2[i], q = S2[i + 1], a = atan2(q[1] - p[1], q[0] - p[0]), L = 5.5 * sin(PI * ((i - from + 0.5) / (m - from)));
        d += `M${pt(p)}L${pt([p[0] + L * cos(a - 0.9), p[1] + L * sin(a - 0.9)])}M${pt(p)}L${pt([p[0] + L * cos(a + 0.9), p[1] + L * sin(a + 0.9)])}`;
      }
      out.push({ d, accent: true });
    });
    out.push({ d: curve([[40, 136], [28, 120], [22, 102]]) + curve([[48, 132], [60, 122], [66, 110]]) });
    return out;
  })() },
];

// =====================================================================
// 文具工具列（色鉛筆插畫、橫躺、低飽和；不畫臉、不寫字、不畫品牌外觀）
// =====================================================================
const tool = (id, name, color, parts) => ({ id, name, cat: 'tool', style: 'pencil', color, vb: [160, 56], parts });

export const ART_TOOLS = [
  // 迴紋針夾著一張小照片
  tool('tl_add', '加入照片', SAGE, (() => {
    const c = [92, 29], R4 = (pts) => T(pts, c[0], c[1], 1, -3);
    const frame = R4([[-56, -21], [56, -21], [56, 21], [-56, 21]]);
    const inner = R4([[-51, -16.5], [51, -16.5], [51, 16.5], [-51, 16.5]]);
    const hill = R4([[-51, 16.5], [-51, 5], [-34, -2], [-14, 3], [4, -5], [26, 0], [51, -4], [51, 16.5]]);
    const sun = R4([[30, -7]])[0];
    return [
      F(soft(frame, 1.5), PHOTO, 'D', 1.6),
      F(poly(inner), BLUE, null),
      F(soft(hill, [0, 0, 6, 6, 6, 6, 0, 0]), 'M', null),
      F(circle(sun[0], sun[1], 4.2), CREAM, null),
      S('M44 24L18 24A7 7 0 0 0 18 38L54 38A5.5 5.5 0 0 0 54 27L24 27A3.5 3.5 0 0 0 24 34L44 34', CHAR, 2.6),
    ];
  })()),
  // 剪刀（刀尖朝右）
  tool('tl_crop', '裁切', SAGE, [
    F(soft([[52, 31.5], [80, 24], [116, 20.5], [153, 20.5], [118, 27.2], [80, 31.6], [50, 40]], [2, 2, 3, 1, 3, 2, 2]), STEEL, 'D', 1.6),
    F(soft([[50, 17.5], [80, 24.4], [118, 28.4], [153, 34.6], [116, 34.2], [80, 31.6], [52, 26.5]], [2, 2, 3, 1, 3, 2, 2]), STEEL, 'D', 1.6),
    F(ellR(35, 17.5, 16, 9.5, -8) + ellR(35, 17.5, 10, 4.8, -8)),
    F(ellR(34, 40.5, 18, 10, 7) + ellR(34, 40.5, 11.5, 5.2, 7)),
    F(circle(80, 28, 2.6), CHOC, null),
    S('M88 26.6L148 22.4', IVORY, 1.2, 0.8),
  ]),
  // 紙膠帶：一捲＋拉出一長段（撕邊）
  tool('tl_tape', '紙膠帶', LILAC, [
    F(poly([[32, 37.5], [148, 36], [151.5, 38.6], [148.4, 41], [152, 43.6], [148.6, 46.2], [151.6, 48.6], [148.5, 50.5], [32, 50.5]]), 'M', 'D', 1.6, 0.92),
    F([58, 74, 90, 106, 122, 138].map((x, i) => circle(x, i % 2 ? 40.6 : 46.2, 1.7)).join(''), IVORY, null),
    F(circle(30, 28, 22.5) + circle(30, 28, 14.5)),
    F(circle(30, 28, 14.5) + circle(30, 28, 11.5), CREAM, 'D', 1.2),
    S(circle(30, 28, 18.5), 'D', 1, 0.5),
  ]),
  // 口紅膠（蓋子在右）
  tool('tl_glue', '口紅膠', LILAC, [
    F(soft([[8, 21], [16, 20], [16, 36], [8, 35]], 2), CHAR, 'D', 1.4),
    F(soft([[15, 15], [112, 15], [112, 41], [15, 41]], [4, 1, 1, 4])),
    F(poly([[44, 15.6], [84, 15.6], [84, 40.4], [44, 40.4]]), IVORY, 'D', 1.2),
    S('M50 22L78 22M50 34L70 34', 'D', 1, 0.45),
    F(soft([[110, 13], [146, 13], [152, 21], [152, 35], [146, 43], [110, 43]], [2, 6, 4, 4, 6, 2]), BLUE, 'D', 2),
    S('M115 15.5L115 40.5M119 15.5L119 40.5', 'D', 1.2, 0.7),
  ]),
  // 短色鉛筆（整理）
  tool('tl_more', '整理', TERRA, [
    F(poly([[116, 18], [146, 26.5], [146, 29.5], [116, 38]]), CREAM, 'D', 1.4),
    F(poly([[137, 24], [153, 28], [137, 32]])),
    F(soft([[30, 18.5], [116, 18], [121.5, 21.3], [118.4, 24.6], [122, 28], [118.4, 31.4], [121.5, 34.7], [116, 38], [30, 37.5]], [2, 1, 1.5, 1.5, 1.5, 1.5, 1.5, 1, 2])),
    S('M31 24.6L117 24.6M31 31.4L117 31.4', 'D', 1.2, 0.7),
    F(ellR(30, 28, 2.6, 9.6, 0), CREAM, 'D', 1.2),
  ]),
];
