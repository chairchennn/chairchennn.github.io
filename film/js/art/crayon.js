// FilmDoodle — 蠟筆塗鴉（cat: 'crayon', style: 'crayon'）原創貼圖
// 畫在照片上的療癒童趣塗鴉：線條由 js/crayon.js 的蠟筆筆刷自動加上手抖與顆粒，
// 所以這裡只要畫「線稿」：以線條為主、少量填色，不要太多細節。
import { s, f, circ, ell, poly, starPts, scallop, sparkleD, heartD, petalD, face, n } from './shapes.js';

// ---------- 粉彩色 ----------
const CRM = '#fff3df', BUT = '#ffe38a', PCH = '#ffb98a', PNK = '#ff9fc1', MNT = '#9fe3c0', AQU = '#8fe0e0';
const BL = '#ff9fc1'; // 腮紅

// ---------- 小工具（手畫感：線穿過手點的點、收筆略超出、刻意不對稱） ----------
const { PI, cos, sin, hypot, max, min } = Math;
const pt = (p) => `${n(p[0])} ${n(p[1])}`;
// 平移＋縮放＋旋轉（度）一組點
const T = (pts, dx, dy, k = 1, deg = 0) => {
  const a = (deg * PI) / 180, c = cos(a), sn = sin(a);
  return pts.map(([x, y]) => [dx + k * (x * c - y * sn), dy + k * (x * sn + y * c)]);
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
// 穿過各點的平滑線（不閉合）
const line = (pts) => segD(crSegs(pts, false));
// 閉合，但收筆多畫一小段，像手畫的頭尾重疊
function loop(pts, over = 0.3) {
  const segs = crSegs(pts, true), [a, b, c, d] = segs[0];
  const L = (p, q) => [p[0] + (q[0] - p[0]) * over, p[1] + (q[1] - p[1]) * over];
  const ab = L(a, b), bc = L(b, c), cd = L(c, d), abc = L(ab, bc), bcd = L(bc, cd);
  segs.push([a, ab, abc, L(abc, bcd)]);
  return segD(segs);
}
// 一筆畫：每段是一組點（平滑），開頭是 'L' 的那段畫直線；每段接著上一段
function pen(...parts) {
  let d = '';
  parts.forEach((p) => {
    const straight = p[0] === 'L', pts = straight ? p.slice(1) : p;
    const body = straight ? poly(pts, false) : line(pts);
    d += d ? body.replace(/^M[-\d. ]+/, '') : body;
  });
  return d;
}
// 橢圓上取點（wob：每點半徑的微小變化，讓圓不完美）
const ring = (cx, cy, rx, ry, k = 10, rot = -PI / 2, wob = [0]) => Array.from({ length: k }, (_, i) => {
  const a = rot + (i * 2 * PI) / k, r = 1 + wob[i % wob.length];
  return [cx + rx * r * cos(a), cy + ry * r * sin(a)];
});
// 圓角五角星的點（arms：每隻角長短不一）
const starRing = (cx, cy, ro, ri, rotDeg = -90, arms = [0]) => Array.from({ length: 10 }, (_, i) => {
  const a = ((rotDeg + i * 36) * PI) / 180, r = i % 2 ? ri : ro * (1 + arms[(i / 2) % arms.length]);
  return [cx + r * cos(a), cy + r * sin(a)];
});
// 雲：點依順時針排列，相鄰兩點之間畫往外鼓的圓弧（第三個值＝鼓的程度，0＝略彎的底線）
function cloudD(pts, close = true) {
  let d = `M${pt(pts[0])}`;
  const N = close ? pts.length : pts.length - 1;
  for (let i = 1; i <= N; i++) {
    const a = pts[i - 1], b = pts[i % pts.length], bul = b[2] ?? 0.58;
    const ch = hypot(b[0] - a[0], b[1] - a[1]);
    if (!bul) d += `Q${n((a[0] + b[0]) / 2)} ${n((a[1] + b[1]) / 2 + ch * 0.05)} ${pt(b)}`;
    else d += `A${n(ch * bul)} ${n(ch * bul)} 0 0 1 ${pt(b)}`;
  }
  return d;
}
// 蠟筆圓點（圓頭的極短線，比填色更實）
const dot = (x, y, c = 'M', w = 4.6) => s(`M${n(x)} ${n(y)}l0.01 0`, c, w);
// 閃光（四芒星）
const spark = (cx, cy, r, c = 'M', w = 3.6) => s(sparkleD(n(cx), n(cy), r, 0.2), c, w);
// Z（睡覺）
const zD = (x, y, w) => `M${n(x)} ${n(y)}L${n(x + w)} ${n(y + w * 0.05)}L${n(x + w * 0.05)} ${n(y + w)}L${n(x + w * 1.05)} ${n(y + w * 0.95)}`;
// 愛心：淡淡塗色＋描邊
const heart = (cx, cy, size, deg = 0, c = PNK, w = 3.6) => [f(heartD(cx, cy, size, deg), c), s(heartD(cx, cy, size, deg), c, w)];
// 愛心的點（同 shapes.js 的 heartD）
function heartPts(cx, cy, size, rotDeg = 0) {
  const pts = [], rot = (rotDeg * PI) / 180, k = size / 34;
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * PI * 2, x = 16 * sin(t) ** 3;
    const y = -(13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t)) - 2;
    pts.push([cx + k * (x * cos(rot) - y * sin(rot)), cy + k * (x * sin(rot) + y * cos(rot))]);
  }
  return pts;
}
// 蠟筆來回塗色：在形狀裡畫斜斜的來回線（像用蠟筆塗滿，不是平塗）
function scribble(pts, gap = 4.5, deg = -35, inset = 1.8) {
  const a = (deg * PI) / 180, ux = cos(a), uy = sin(a), vx = -uy, vy = ux;
  const pv = pts.map(([x, y]) => x * vx + y * vy), lo = min(...pv), hi = max(...pv), rows = [];
  for (let t = lo + gap * 0.6; t < hi - gap * 0.3; t += gap) {
    const xs = [];
    pts.forEach((p, i) => {
      const j = (i + 1) % pts.length, q = pts[j];
      if ((pv[i] - t) * (pv[j] - t) < 0) {
        const r = (t - pv[i]) / (pv[j] - pv[i]);
        xs.push((p[0] + (q[0] - p[0]) * r) * ux + (p[1] + (q[1] - p[1]) * r) * uy);
      }
    });
    if (xs.length > 1) { xs.sort((m, k) => m - k); const s0 = xs[0] + inset, s1 = xs[xs.length - 1] - inset; if (s1 > s0) rows.push([t, s0, s1]); }
  }
  const P = (t, u) => [u * ux + t * vx, u * uy + t * vy], out = [];
  rows.forEach(([t, s0, s1], i) => (i % 2 ? out.push(P(t, s1), P(t, s0)) : out.push(P(t, s0), P(t, s1))));
  return poly(out, false);
}
// 蠟筆小臉：eye 'dot' | 'sleep'（‿ 睡著）| 'happy'（∩ 笑瞇）；mouth 'smile' | 'w' | 'o' | 'none'
function cface(cx, cy, k = 1, { c = 'M', eye = 'dot', mouth = 'smile', cheek = BL, gap = 7 } = {}) {
  const out = [], dx = gap * k;
  [[cx - dx, cy], [cx + dx, cy]].forEach(([x, y]) => {
    if (eye === 'dot') out.push(dot(x, y, c, 4.8 * k));
    else if (eye === 'sleep') out.push(s(`M${n(x - 3 * k)} ${n(y - 0.8 * k)}Q${n(x)} ${n(y + 2.8 * k)} ${n(x + 3 * k)} ${n(y - 0.8 * k)}`, c, 3.2 * k));
    else out.push(s(`M${n(x - 3 * k)} ${n(y + 1.2 * k)}Q${n(x)} ${n(y - 3 * k)} ${n(x + 3 * k)} ${n(y + 1.2 * k)}`, c, 3.2 * k));
  });
  const my = cy + 4.8 * k;
  if (mouth === 'smile') out.push(s(`M${n(cx - 3 * k)} ${n(my)}Q${n(cx)} ${n(my + 3.4 * k)} ${n(cx + 3 * k)} ${n(my)}`, c, 3.2 * k));
  if (mouth === 'w') out.push(s(`M${n(cx - 3.8 * k)} ${n(my)}q${n(1.9 * k)} ${n(3 * k)} ${n(3.8 * k)} 0q${n(1.9 * k)} ${n(3 * k)} ${n(3.8 * k)} 0`, c, 3 * k));
  if (mouth === 'o') out.push(s(circ(cx, my + 1.2 * k, 1.5 * k), c, 3 * k));
  if (cheek) {
    const cx1 = cx - dx - 4.6 * k, cx2 = cx + dx + 4.6 * k, cy1 = cy + 4.4 * k;
    out.push(s(`M${n(cx1 - 2.2 * k)} ${n(cy1)}L${n(cx1 + 2.2 * k)} ${n(cy1 - 0.3 * k)}`, cheek, 4.4 * k, 0.8),
      s(`M${n(cx2 - 2.2 * k)} ${n(cy1 - 0.3 * k)}L${n(cx2 + 2.2 * k)} ${n(cy1)}`, cheek, 4.4 * k, 0.8));
  }
  return out;
}
// 背影小貓（頭可以歪，身體不轉）：中心＝頭，k＝大小
function catBack(cx, cy, k = 1, tilt = 0, flip = 1) {
  const hd = (pts) => T(T(pts.map(([x, y]) => [x * flip, y - 12]), 0, 0, 1, tilt).map(([x, y]) => [x, y + 12]), cx, cy, k);
  const bd = (pts) => T(pts.map(([x, y]) => [x * flip, y]), cx, cy, k);
  return pen(
    [...bd([[-8, 13]]), ...hd([[-12.5, 6], [-13.5, -2], [-11, -9]])],
    ['L', ...hd([[-11, -9], [-11.5, -22], [-3.5, -12.5]])],
    hd([[-3.5, -12.5], [0, -13.4], [3.5, -12.5]]),
    ['L', ...hd([[3.5, -12.5], [10.5, -21.5], [11.5, -8]])],
    [...hd([[11.5, -8], [13.5, -1], [12, 6.5]]), ...bd([[8.5, 13], [16, 21], [20, 31], [18.5, 40]])],
    ['L', ...bd([[18.5, 40], [-18.5, 40]])],
    bd([[-18.5, 40], [-20, 31], [-16, 21], [-8.5, 13], [-11, 9]]),
  );
}

// ---------- 第八版新圖案用的形狀 ----------
// 新月：大圓扣掉偏右上的小圓（點依外圈→內圈排）
const MOON_D = (() => {
  const cx = 46, cy = 54, r = 36, ox = 64, oy = 40, r2 = 30, out = [];
  for (let i = 0; i < 48; i++) { const a = (i / 48) * 2 * PI, p = [cx + r * cos(a), cy + r * sin(a)]; if (hypot(p[0] - ox, p[1] - oy) > r2) out.push([a, p]); }
  let k = 0;
  for (let i = 1; i < out.length; i++) if (out[i][0] - out[i - 1][0] > 0.2) k = i;
  const outer = [...out.slice(k), ...out.slice(0, k)].map((q) => q[1]), A = outer[0], B = outer[outer.length - 1];
  const a0 = Math.atan2(B[1] - oy, B[0] - ox), a1 = Math.atan2(A[1] - oy, A[0] - ox);
  let da = a1 - a0;
  while (da > 0) da -= 2 * PI;
  const inner = Array.from({ length: 15 }, (_, i) => { const a = a0 + (da * (i + 1)) / 16; return [ox + r2 * cos(a), oy + r2 * sin(a)]; });
  return poly([...outer, ...inner]);
})();
const TULIP_P = [[50, 60], [36, 55], [30, 34], [40, 40], [44, 20], [50, 32], [56, 20], [60, 40], [70, 34], [64, 55]];
const CAP_P = [[12, 60], [16, 40], [30, 24], [50, 18], [70, 24], [84, 40], [88, 60], [50, 64]];
const SNAIL_SPIRAL = line(Array.from({ length: 22 }, (_, i) => { const t = i / 21, a = t * 2.3 * 2 * PI + PI / 2, r = 3 + 24 * t; return [46 + r * cos(a), 44 + r * sin(a)]; }));

export const ART_CRAYON = [
  // ---------- 大幅場景 ----------
  {
    id: 'cr2_mooncat', name: '月亮上的貓', cat: 'crayon', style: 'crayon', color: BUT,
    parts: [
      // 像吊床的彎月（兩端往上翹，左高右低一點）
      s(pen([[7, 33], [9, 51], [20, 67], [40, 78], [62, 79], [80, 70], [91, 55], [94, 43]], [[94, 43], [84, 56], [66, 64.5], [46, 66.5], [28, 60.5], [15, 48], [7, 33], [6, 29]]), 'M', 4.6),
      // 睡在月亮裡的小貓：頭在左、背拱起來
      s(pen([[27, 60], [21, 53], [21, 44], [25, 37.5]], ['L', [25, 37.5], [24, 25], [32.5, 32]], [[32.5, 32], [37, 31.2], [41.5, 32]], ['L', [41.5, 32], [49, 24], [49.5, 36]],
        [[49.5, 36], [58, 33], [68, 35], [76, 42], [78, 51], [74, 61]]), CRM, 4.6),
      // 尾巴往上捲
      s(line([[77, 53], [85, 51], [89, 43], [85, 37], [80, 39], [81, 44]]), CRM, 4.2),
      ...cface(35.5, 45, 0.85, { c: CRM, eye: 'sleep', mouth: 'w', gap: 6.2 }),
      spark(84, 15, 8.5), spark(15, 13, 5.5), dot(64, 16, 'M', 4.4), dot(96, 28, 'M', 3.6),
    ],
  },
  {
    id: 'cr2_whale', name: '噴水鯨魚', cat: 'crayon', style: 'crayon', color: AQU,
    parts: [
      // 胖胖的身體（頭在右），尾巴往上翹
      s(pen([[25, 48], [40, 40], [58, 36], [74, 39], [86, 48], [90, 59], [85, 69], [72, 76], [55, 79], [38, 77], [22, 70], [13, 60], [11, 50], [13, 40], [14, 33]]), 'M', 4.6),
      s(line([[25, 48], [21, 41], [20, 34]]), 'M', 4.4),
      // 尾鰭（兩片、不對稱）
      s(pen([[14, 33], [8, 30], [3, 22], [10, 22], [17, 28]], [[17, 28], [22, 22], [31, 19], [27, 27], [20, 34]]), 'M', 4.4),
      // 小鰭、肚子線
      s(line([[50, 68], [55, 76], [62, 71]]), 'M', 3.8),
      s(line([[30, 72], [48, 75.5], [66, 74], [80, 68]]), 'M', 3.4, 0.75),
      dot(76, 52, 'M', 5),
      s(line([[73, 61], [79, 64], [85, 61]]), 'M', 3.4),
      f(ell(68, 60, 4, 2.6), BL),
      // 噴水
      s(line([[64, 35], [63, 28], [64, 20]]), CRM, 3.8),
      s(line([[64, 20], [58, 13], [50, 14], [47, 19]]), CRM, 3.6),
      s(line([[64, 20], [70, 13], [78, 14], [81, 19]]), CRM, 3.6),
      dot(46, 27, CRM, 4), dot(82, 27, CRM, 4), dot(64, 8, CRM, 4),
    ],
  },
  {
    id: 'cr2_fuji', name: '富士山與太陽', cat: 'crayon', style: 'crayon', color: PNK,
    parts: [
      s(line([[3, 88], [15, 77], [27, 61], [35, 48], [41, 40], [50, 38.5], [58, 40.5], [65, 48], [75, 62], [86, 76], [97, 86]]), 'M', 4.8),
      // 山頂的雪（波浪線）
      s(line([[33, 51], [37, 56], [42, 51], [47, 57], [52, 51], [57, 56], [62, 50], [64, 47]]), 'M', 4),
      // 笑瞇瞇的太陽
      s(loop(ring(76, 23, 11, 10.5, 9, -PI / 2, [0, 0.04, -0.03, 0.05, 0, -0.04, 0.03, 0.02, -0.02])), BUT, 4.2),
      ...[-90, -45, 0, 45, 90, 180, -135].map((deg, i) => {
        const a = (deg * PI) / 180, r0 = 15, r1 = 20 + (i % 2) * 2;
        return s(`M${n(76 + r0 * cos(a))} ${n(23 + r0 * sin(a))}L${n(76 + r1 * cos(a))} ${n(23 + r1 * sin(a))}`, BUT, 3.8);
      }),
      // 小雲
      s(cloudD([[6, 42], [9, 35, 0.6], [17, 31, 0.6], [25, 34, 0.6], [28, 42, 0.62], [6, 42, 0]], false), CRM, 3.8),
    ],
  },
  {
    id: 'cr2_cloudbunny', name: '雲上兔子', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      // 雲（中間兩個小凸起是兔子的手）
      s(cloudD([[10, 84], [10, 72, 0.6], [24, 63, 0.6], [37, 63, 0.6], [45, 63, 0.62], [55, 63, 0.62], [63, 63, 0.6], [77, 61, 0.6], [89, 70, 0.6], [90, 84, 0.6], [10, 84, 0]]), 'M', 4.6),
      // 頭從雲後面探出來
      s(line([[36, 63], [33, 53], [36, 43], [44, 37.5], [56, 37.5], [64, 43], [67, 53], [64, 63]]), 'M', 4.6),
      // 長耳朵（左直、右邊折下來）
      s(line([[41, 40], [35, 26], [34, 12], [39, 8], [44, 16], [47, 37]]), 'M', 4.4),
      s(line([[54, 37], [58, 23], [64, 15], [73, 15], [72, 22], [61, 35]]), 'M', 4.4),
      s(line([[39.5, 31], [38, 19], [39.5, 14]]), BL, 3.4),
      s(line([[58, 30], [63, 21], [68, 19]]), BL, 3.4),
      ...cface(50, 50, 0.9, { eye: 'dot', mouth: 'w', gap: 7 }),
      spark(85, 26, 7, BUT), spark(15, 34, 5, BUT), dot(24, 48, BUT, 4),
    ],
  },
  {
    id: 'cr2_twocats', name: '貓咪背影', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      s(catBack(29, 44, 1.05, 11), 'M', 4.5),
      s(catBack(71.5, 50, 0.9, -12, -1), 'M', 4.5),
      // 尾巴各自往外捲
      s(line([[11, 84], [5, 84], [2.5, 76], [5.5, 70], [9.5, 72]]), 'M', 4.2),
      s(line([[87.5, 84], [93.5, 84], [97, 77], [94, 71], [90.5, 73]]), 'M', 4.2),
      s(line([[2, 88], [30, 87], [60, 88.5], [98, 87]]), 'M', 3.6, 0.8),
      ...heart(51, 13, 15, 6),
      dot(41, 5, PNK, 3.6), spark(84, 16, 5, BUT),
    ],
  },
  {
    id: 'cr2_balloon', name: '熱氣球', cat: 'crayon', style: 'crayon', color: PNK,
    parts: [
      s(loop(T([[50, 6], [66, 8.5], [79, 20], [82, 36], [76, 52], [64, 64], [58, 70], [42, 70], [36, 64], [24, 52], [18, 36], [21, 20], [34, 8]], 0, 0, 1, 0), 0.25), 'M', 4.6),
      // 直條紋
      s(line([[46, 7], [35, 22], [33, 42], [44, 69]]), BUT, 3.8),
      s(line([[54, 7], [65, 22], [67, 42], [56, 69]]), BUT, 3.8),
      s(line([[20, 40], [35, 44], [50, 45], [65, 44], [80, 40]]), AQU, 3.6),
      // 繩子與籃子
      s(line([[43, 70], [42, 81]]), CRM, 3.4), s(line([[57, 70], [58, 81]]), CRM, 3.4),
      s(pen(['L', [39, 81], [61, 81], [58.5, 94], [41.5, 94], [39, 81]]), PCH, 4.2),
      s(line([[40.5, 87.5], [59.5, 87.5]]), PCH, 3.4),
      spark(13, 64, 6, BUT), dot(89, 66, BUT, 4),
    ],
  },
  {
    id: 'cr2_castle', name: '雲上城堡', cat: 'crayon', style: 'crayon', color: BUT,
    parts: [
      // 胖圓塔（屋頂有點歪）
      s(line([[21, 67], [20, 54], [21, 39]]), 'M', 4.4),
      s(line([[40, 39], [41, 54], [40, 67]]), 'M', 4.4),
      s(line([[17, 39], [30, 40.5], [44, 39]]), 'M', 4.4),
      s(pen([[17, 39], [25, 25], [33, 11]], [[33, 11], [37, 25], [44, 39]]), 'M', 4.4),
      s(line([[33, 11], [33, 3]]), 'M', 3.4),
      ...[f(poly([[33, 3], [42, 5.5], [33, 9]]), PNK), s(poly([[33, 3], [42, 5.5], [33, 9]]), PNK, 3)],
      s(pen(['L', [27, 60], [27, 52]], [[27, 52], [30.5, 47.5], [34, 52]], ['L', [34, 52], [34, 60]]), 'M', 3.6),
      // 矮矮的城牆（三個城垛）＋拱門
      s(pen(['L', [41, 49], [41, 43], [48, 43], [48, 49], [55, 49], [55, 43], [62, 43], [62, 49], [69, 49], [69, 43], [77, 43], [77, 67]]), 'M', 4.2),
      s(pen(['L', [52, 68], [52, 61]], [[52, 61], [58.5, 54], [65, 61]], ['L', [65, 61], [65, 68]]), 'M', 3.8),
      // 雲
      s(cloudD([[6, 86], [8, 76, 0.6], [20, 69, 0.6], [35, 71, 0.6], [50, 67, 0.6], [65, 71, 0.6], [80, 68, 0.6], [92, 75, 0.6], [94, 86, 0.6], [6, 86, 0]]), CRM, 4.4),
      spark(86, 22, 7), dot(70, 12, 'M', 4), dot(8, 22, 'M', 3.6),
    ],
  },
  {
    id: 'cr2_camp', name: '帳篷營火', cat: 'crayon', style: 'crayon', color: BUT,
    parts: [
      // 帳篷：兩根支架在頂端交叉
      s(line([[4, 83], [21, 55], [39.5, 21]]), 'M', 4.6),
      s(line([[69, 83], [52, 55], [32.5, 21]]), 'M', 4.6),
      // 門（倒 V，從半腰開始）
      s(pen([[28, 83], [31, 66], [36.5, 50]], [[36.5, 50], [41, 66], [45, 83]]), 'M', 4),
      s(line([[3, 85], [40, 85.5], [97, 84.5]]), MNT, 3.6, 0.85),
      // 營火
      s(line([[69, 84], [91, 78]]), PCH, 4), s(line([[69, 78], [91, 84]]), PCH, 4),
      f(loop([[80, 79], [71, 73], [72, 63], [77, 55], [80, 46], [84, 56], [89, 63], [88, 73]]), PCH),
      s(loop([[80, 79], [71, 73], [72, 63], [77, 55], [80, 46], [84, 56], [89, 63], [88, 73]], 0.2), PCH, 4),
      f(loop([[80, 77], [76, 72], [78, 65], [80, 60], [83, 66], [84, 72]]), BUT),
      dot(74, 40, BUT, 3.8), dot(87, 35, BUT, 3.4),
      spark(84, 14, 6), spark(14, 20, 4.5),
    ],
  },
  {
    id: 'cr2_wave', name: '海浪', cat: 'crayon', style: 'crayon', color: AQU,
    parts: [
      // 圓滾滾的浪頭，捲成一個漩渦
      s(line([[5, 80], [18, 72], [30, 58], [41, 43], [53, 31], [65, 25], [77, 27], [85, 35], [87, 45], [82, 53], [74, 54], [69, 49], [70, 42], [76, 40], [79, 44]]), 'M', 4.8),
      s(line([[73, 57], [72, 66], [80, 76], [95, 80]]), 'M', 4.4),
      s(line([[30, 80], [38, 69], [47, 57], [57, 47], [66, 42]]), 'M', 3.8, 0.8),
      s(line([[3, 89], [12, 86], [21, 89], [30, 86], [39, 89], [48, 86], [57, 89], [66, 86], [75, 89], [84, 86], [93, 89], [97, 87]]), 'M', 3.8),
      dot(91, 26, CRM, 4.4), dot(95, 36, CRM, 3.6), dot(58, 16, CRM, 4),
    ],
  },
  {
    id: 'cr2_sleepcat', name: '睡覺貓', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      // 蜷成一團的貓：頭在左、背圓圓的
      s(pen([[23, 52], [18, 60], [19, 69], [26, 76], [40, 79], [60, 79], [76, 75], [83, 64], [79, 52], [68, 44], [55, 42], [45, 47]],
        ['L', [45, 47], [42, 37], [36, 45]], [[36, 45], [31, 44.5], [27, 46]], ['L', [27, 46], [21, 39], [23, 52]]), 'M', 4.6),
      // 尾巴繞到前面
      s(line([[81, 68], [74, 73], [60, 74], [50, 71], [48, 67]]), 'M', 4),
      // 前腳
      s(line([[30, 76], [34, 72], [39, 76]]), 'M', 3.6),
      ...cface(31, 59, 0.85, { eye: 'sleep', mouth: 'w', gap: 6 }),
      s(zD(64, 22, 10), BUT, 3.8), s(zD(79, 10, 7), BUT, 3.4), dot(58, 34, BUT, 3.6),
    ],
  },
  {
    id: 'cr2_teacup', name: '貓咪茶杯', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      // 杯口＋從杯口冒出來的貓耳
      s(loop(ring(50, 47, 28, 6.5, 10, PI, [0, 0.02, -0.02, 0.03, 0, 0.02, -0.03, 0, 0.02, -0.02]), 0.25), 'M', 4.2),
      s(pen(['L', [27, 44], [29, 33], [37, 41.5]]), 'M', 4),
      s(pen(['L', [63, 41.5], [71, 33], [73, 44]]), 'M', 4),
      s(line([[22, 48], [24, 61], [32, 74], [42, 79], [58, 79], [68, 74], [76, 61], [78, 48]]), 'M', 4.6),
      s(line([[77, 55], [86, 53], [90, 59], [86, 67], [73, 70]]), 'M', 4.2),
      s(line([[19, 76], [14, 80], [26, 86.5], [50, 89], [74, 86.5], [86, 80], [81, 76]]), 'M', 4.2),
      ...cface(50, 61, 0.9, { eye: 'dot', mouth: 'w', gap: 7.5 }),
      // 蒸氣變成愛心
      s(line([[41, 37], [37, 31], [41, 25], [38, 19]]), 'M', 3.6, 0.85),
      s(line([[60, 37], [64, 31], [60, 26]]), 'M', 3.6, 0.85),
      ...heart(51, 17, 14, -8),
    ],
  },
  {
    id: 'cr2_jelly', name: '水母', cat: 'crayon', style: 'crayon', color: PNK,
    parts: [
      // 圓頂＋往下鼓的裙邊
      s(cloudD([[22, 52], [22, 40, 0], [50, 16, 0.72], [78, 40, 0.72], [78, 52, 0], [64.5, 52, 0.62], [50, 52, 0.62], [35.5, 52, 0.62], [22, 52, 0.62]], false), 'M', 4.6),
      ...[[32, 30, -1], [43.5, 38, 1], [56.5, 36, -1], [68, 28, 1]].map(([x0, L, sg], i) =>
        s(line([[x0, 57], [x0 + 3.5 * sg, 57 + L * 0.3], [x0 - 3 * sg, 57 + L * 0.6], [x0 + 2.5 * sg, 57 + L * 0.85], [x0 + sg, 57 + L]]), 'M', i % 3 ? 4 : 3.6)),
      s(loop(ring(86, 20, 4.6, 4.6, 6)), AQU, 3.4), s(loop(ring(91, 33, 3, 3, 5)), AQU, 3), s(loop(ring(12, 64, 3.6, 3.6, 5)), AQU, 3.2),
    ],
  },
  {
    id: 'cr2_firework', name: '煙火', cat: 'crayon', style: 'crayon', color: PCH,
    parts: [
      // 內圈短線
      ...Array.from({ length: 10 }, (_, i) => {
        const a = (i * 36 + 8) * PI / 180, r0 = 8, r1 = 18 + (i % 3) * 2;
        return s(`M${n(50 + r0 * cos(a))} ${n(48 + r0 * sin(a))}L${n(50 + r1 * cos(a))} ${n(48 + r1 * sin(a))}`, PNK, 3.8);
      }),
      // 外圈：往下垂一點的長線
      ...Array.from({ length: 14 }, (_, i) => {
        const a = (i * (360 / 14) - 4) * PI / 180, r0 = 25 + (i % 2) * 2, r1 = 37 + ((i * 7) % 4) * 1.5;
        const x0 = 50 + r0 * cos(a), y0 = 48 + r0 * sin(a), x1 = 50 + r1 * cos(a), y1 = 48 + r1 * sin(a) + 2.5;
        return s(`M${n(x0)} ${n(y0)}Q${n((x0 + x1) / 2)} ${n((y0 + y1) / 2 - 1)} ${n(x1)} ${n(y1)}`, 'M', 4);
      }),
      ...Array.from({ length: 7 }, (_, i) => {
        const a = (i * (360 / 7) + 20) * PI / 180;
        return dot(50 + 45 * cos(a), 50 + 45 * sin(a), BUT, 4);
      }),
      dot(50, 48, BUT, 5),
    ],
  },
  // ---------- 中小型 ----------
  {
    id: 'cr2_teru', name: '晴天娃娃', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      s(line([[50, 3], [50.5, 12], [50, 19]]), 'M', 3.4),
      s(loop(ring(50, 36, 17, 16, 10, -PI / 2, [0, 0.03, -0.02, 0.04, 0, -0.03, 0.02, 0.03, -0.02, 0])), 'M', 4.6),
      s(line([[35, 50.5], [50, 55], [65, 50.5]]), 'M', 4),
      s(line([[53, 54], [57, 60], [54, 66]]), PNK, 3.4),
      s(line([[37, 52], [31, 64], [24, 79]]), 'M', 4.4),
      s(line([[63, 52], [69, 64], [76, 79]]), 'M', 4.4),
      s(line([[24, 79], [31, 83], [38, 79], [45, 84], [52, 79], [59, 84], [66, 79], [72, 82.5], [76, 79]]), 'M', 4.2),
    ],
  },
  {
    id: 'cr2_planet', name: '星球', cat: 'crayon', style: 'crayon', color: PCH,
    parts: [
      s(loop(ring(50, 50, 24, 23.5, 10, -PI / 2, [0, 0.02, -0.02, 0.03, 0, -0.02, 0.02, 0.01, -0.03, 0.01])), 'M', 4.6),
      // 星環：後半圈被星球擋住
      ...(() => {
        const out = [], a = (-16 * PI) / 180, runs = [];
        let cur = null;
        for (let i = 0; i <= 72; i++) {
          const t = (i / 72) * 2 * PI, lx = 45 * cos(t), ly = 12 * sin(t);
          const x = 50 + lx * cos(a) - ly * sin(a), y = 50 + lx * sin(a) + ly * cos(a);
          const hidden = ly < 0 && hypot(x - 50, y - 50) < 27;
          if (hidden) { cur = null; continue; }
          if (!cur) { cur = []; runs.push(cur); }
          cur.push([x, y]);
        }
        if (runs.length > 1 && hypot(runs[0][0][0] - runs[runs.length - 1].at(-1)[0], runs[0][0][1] - runs[runs.length - 1].at(-1)[1]) < 0.01) {
          runs[0] = [...runs.pop(), ...runs[0].slice(1)];
        }
        runs.forEach((r) => out.push(s(poly(r, false), BUT, 4.2)));
        return out;
      })(),
      spark(86, 16, 6.5, BUT), dot(14, 20, BUT, 4), dot(86, 84, BUT, 3.6),
    ],
  },
  {
    id: 'cr2_shoot', name: '流星', cat: 'crayon', style: 'crayon', color: BUT,
    parts: [
      s(line([[45, 52], [60, 37], [76, 23], [93, 11]]), 'M', 4.2),
      s(line([[49, 62], [64, 51], [80, 41]]), PNK, 3.8),
      s(line([[39, 46], [49, 34], [60, 25]]), AQU, 3.8),
      s(loop(starRing(30, 68, 21, 10.5, -102, [0, 0.06, -0.04, 0.03, 0.08]), 0.2), 'M', 4.6),
      dot(88, 30, 'M', 3.6), dot(70, 10, 'M', 3.4),
    ],
  },
  {
    id: 'cr2_stars', name: '星星群', cat: 'crayon', style: 'crayon', color: BUT,
    parts: [
      s(loop(starRing(34, 42, 21, 10, -96, [0, 0.08, -0.05, 0.04, 0.1]), 0.2), 'M', 4.6),
      spark(73, 66, 15, 'M', 4.2), spark(77, 22, 8.5, 'M', 3.8), spark(26, 80, 6, 'M', 3.6),
      dot(52, 88, 'M', 4), dot(92, 44, 'M', 3.6), dot(56, 16, 'M', 3.4),
    ],
  },
  {
    id: 'cr2_flower', name: '長莖小花', cat: 'crayon', style: 'crayon', color: PNK,
    parts: [
      s(line([[50, 45], [47, 60], [52, 76], [49, 97]]), MNT, 4.2),
      s(petalD(48.5, 66, 1, 22, 7.5, (-150 * PI) / 180), MNT, 3.8),
      s(petalD(51, 80, 1, 20, 7, (-28 * PI) / 180), MNT, 3.8),
      s(line([[46, 64.5], [33, 57]]), MNT, 3, 0.8),
      s(scallop(50, 27, 5, 8.5, 29, -PI / 2 + 0.2, 0.08), 'M', 4.4),
      dot(50, 27, BUT, 11),
    ],
  },
  {
    id: 'cr2_starfish', name: '海星', cat: 'crayon', style: 'crayon', color: PCH,
    parts: [
      s(loop(starRing(50, 53, 40, 18, -98, [0, 0.06, -0.05, 0.02, 0.07]), 0.2), 'M', 4.6),
      ...[-98, -26, 46, 118, 190].map((deg, i) => {
        const a = (deg * PI) / 180, r = i ? 28 : 29;
        return dot(50 + r * cos(a), 53 + r * sin(a), 'M', 3.6);
      }),
    ],
  },
  {
    id: 'cr2_shell', name: '貝殼', cat: 'crayon', style: 'crayon', color: PNK,
    parts: (() => {
      const H = [50, 80], R = 46, ang = [-146, -123, -101, -79, -57, -34].map((d) => (d * PI) / 180);
      const V = ang.map((a) => [H[0] + R * cos(a), H[1] + R * sin(a)]);
      const edge = cloudD([[42, 79], ...V.map((v, i) => [v[0], v[1], i ? 0.62 : 0]), [58, 79, 0]], false);
      return [
        s(edge, 'M', 4.6),
        ...ang.slice(1, -1).map((a) => s(line([[H[0] + 9 * cos(a), H[1] + 9 * sin(a)], [H[0] + 38 * cos(a), H[1] + 38 * sin(a)]]), 'M', 3.6)),
        s(pen(['L', [39, 80], [61, 80], [58, 87.5], [42, 87.5], [39, 80]]), 'M', 4),
        spark(86, 20, 6, BUT),
      ];
    })(),
  },
  {
    id: 'cr2_cloud', name: '蠟筆雲朵', cat: 'crayon', style: 'crayon', color: CRM, vb: [100, 72],
    parts: [
      s(cloudD([[12, 60], [9, 47, 0.6], [21, 35, 0.6], [37, 27, 0.58], [56, 25, 0.58], [73, 31, 0.6], [86, 41, 0.6], [90, 56, 0.62], [12, 60, 0]]), 'M', 4.8),
      s(line([[93, 25], [97, 22]]), 'M', 3.4, 0.8), s(line([[90, 17], [92, 12]]), 'M', 3.4, 0.8),
    ],
  },
  {
    id: 'cr2_birds', name: '飛鳥', cat: 'crayon', style: 'crayon', color: CRM, vb: [100, 70],
    parts: [[28, 38, 17, -8], [66, 20, 12, 6], [78, 52, 9, -4]].map(([cx, cy, k, deg]) =>
      s(pen(T([[-1, -0.05], [-0.55, -0.5], [-0.12, -0.12], [0, 0.12]], cx, cy, k, deg), T([[0, 0.12], [0.12, -0.12], [0.55, -0.5], [1, -0.05]], cx, cy, k, deg)), 'M', k > 12 ? 4.4 : 3.8)),
  },
  {
    id: 'cr2_grass', name: '小草', cat: 'crayon', style: 'crayon', color: MNT, vb: [100, 70],
    parts: [
      ...[[[20, 66], [17, 54], [9, 44]], [[26, 66], [26, 50], [30, 38]], [[32, 66], [36, 54], [44, 47]],
        [[64, 66], [61, 55], [55, 49]], [[70, 66], [71, 50], [68, 36]], [[76, 66], [80, 55], [88, 49]]].map((p) => s(line(p), 'M', 4.2)),
      s(line([[48, 66], [48, 46], [50, 30]]), 'M', 3.8),
      s(loop(ring(50, 24, 5, 5, 6)), PNK, 3.8), dot(50, 24, BUT, 3.6),
    ],
  },
  {
    id: 'cr2_hearts', name: '塗鴉愛心', cat: 'crayon', style: 'crayon', color: PNK,
    parts: [
      s(scribble(heartPts(44, 58, 48, -12), 4.6, -38), 'M', 3, 0.8),
      s(heartD(44, 58, 48, -12), 'M', 4.6),
      ...heart(80, 24, 20, 14, 'M', 3.8),
      s(line([[13, 26], [19, 33]]), 'M', 3.6), s(line([[23, 18], [26, 27]]), 'M', 3.6), s(line([[8, 39], [16, 41]]), 'M', 3.6),
    ],
  },

  // =====================================================================
  // 第八版（網站 v10）新增：蠟筆分成兩包——「蠟筆天空」（月亮雲星星氣球，排在上方）
  // 與「蠟筆花園」（花草、海邊、小動物，排在四周）。新圖案都沒有臉。
  // =====================================================================
  // ---------- 天空 ----------
  {
    id: 'cr3_moon', name: '蠟筆彎月', cat: 'crayon', style: 'crayon', color: BUT,
    parts: [
      f(MOON_D), s(MOON_D, 'M', 4.6),
      spark(80, 22, 8), dot(88, 46, 'M', 4), dot(70, 10, 'M', 3.4),
    ],
  },
  {
    id: 'cr3_sun', name: '蠟筆太陽', cat: 'crayon', style: 'crayon', color: PCH,
    parts: [
      f(loop(ring(50, 50, 21, 20, 9, -PI / 2, [0, 0.04, -0.03, 0.02]))), s(loop(ring(50, 50, 21, 20, 9, -PI / 2, [0, 0.04, -0.03, 0.02])), 'M', 4.8),
      s(Array.from({ length: 10 }, (_, i) => { const a = (i * 36 - 80) * PI / 180, r0 = 29, r1 = i % 2 ? 38 : 44; return `M${n(50 + r0 * cos(a))} ${n(50 + r0 * sin(a))}L${n(50 + r1 * cos(a))} ${n(50 + r1 * sin(a))}`; }).join(''), BUT, 4.2),
    ],
  },
  {
    id: 'cr3_rainbow', name: '蠟筆彩虹', cat: 'crayon', style: 'crayon', color: PNK, vb: [100, 66],
    parts: [
      s(line([[10, 56], [16, 30], [34, 14], [50, 11], [66, 14], [84, 30], [90, 56]]), 'M', 5),
      s(line([[20, 56], [25, 36], [38, 23], [50, 21], [62, 23], [75, 36], [80, 56]]), BUT, 5),
      s(line([[30, 56], [34, 41], [43, 32], [50, 31], [57, 32], [66, 41], [70, 56]]), AQU, 5),
      s(cloudD([[4, 62], [6, 53, 0.6], [16, 50, 0.6], [26, 55, 0.6], [28, 62, 0.6], [4, 62, 0]]), CRM, 4),
      s(cloudD([[72, 62], [74, 53, 0.6], [84, 50, 0.6], [94, 55, 0.6], [96, 62, 0.6], [72, 62, 0]]), CRM, 4),
    ],
  },
  {
    id: 'cr3_kite', name: '蠟筆風箏', cat: 'crayon', style: 'crayon', color: AQU,
    parts: [
      f(poly([[50, 6], [76, 34], [50, 66], [26, 34]])), s(pen(['L', [50, 6], [76, 34], [50, 66], [26, 34], [50, 6], [52, 8]]), 'M', 4.6),
      s('M50 8L50 64M28 34L74 34', 'M', 3, 0.8),
      s(line([[50, 66], [44, 76], [54, 84], [46, 94]]), CRM, 3.4),
      ...[[46, 76], [52, 86]].map(([x, y]) => s(`M${x - 5} ${y - 3}L${x + 5} ${y + 3}M${x - 5} ${y + 3}L${x + 5} ${y - 3}`, PNK, 3.6)),
    ],
  },
  {
    id: 'cr3_plane', name: '紙飛機', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      s(pen(['L', [86, 18], [14, 46], [40, 54], [86, 18], [48, 70], [40, 54]]), 'M', 4.4),
      s('M40 54L46 62', 'M', 3.4),
      ...[[30, 74], [20, 80], [10, 84]].map(([x, y]) => dot(x, y, AQU, 4)),
    ],
  },
  {
    id: 'cr3_rocket', name: '小火箭', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      s(loop([[50, 8], [62, 24], [64, 50], [60, 70], [40, 70], [36, 50], [38, 24]], 0.15), 'M', 4.6),
      s(loop(ring(50, 40, 7, 7, 8)), AQU, 4), f(loop(ring(50, 40, 7, 7, 8)), AQU),
      s(pen(['L', [38, 56], [26, 72], [40, 68]]), PNK, 4.2), s(pen(['L', [62, 56], [74, 72], [60, 68]]), PNK, 4.2),
      s(line([[44, 74], [46, 84], [50, 92], [54, 84], [56, 74]]), PCH, 4.4), s(line([[50, 76], [50, 84]]), BUT, 3.6),
    ],
  },
  {
    id: 'cr3_raincloud', name: '下雨雲', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      s(cloudD([[14, 52], [12, 40, 0.6], [24, 30, 0.6], [40, 22, 0.58], [58, 22, 0.58], [74, 28, 0.6], [86, 38, 0.6], [86, 52, 0.62], [14, 52, 0]]), 'M', 4.8),
      ...[[28, 64], [46, 70], [64, 64], [36, 84], [56, 88], [74, 80]].map(([x, y]) => s(`M${x + 2} ${y - 5}L${x - 2} ${y + 5}`, AQU, 4)),
    ],
  },
  {
    id: 'cr3_constellation', name: '星座點點', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      s(pen(['L', [12, 70], [30, 52], [52, 58], [66, 34], [88, 22]]), 'M', 2.2, 0.7), s(pen(['L', [52, 58], [74, 76]]), 'M', 2.2, 0.7),
      ...[[12, 70, 6], [30, 52, 7], [52, 58, 6], [66, 34, 8], [88, 22, 6], [74, 76, 6.5]].map(([x, y, w]) => dot(x, y, 'M', w)),
      spark(66, 34, 11, BUT, 3.4),
    ],
  },
  {
    id: 'cr3_bigstar', name: '塗滿的星星', cat: 'crayon', style: 'crayon', color: BUT,
    parts: [
      s(scribble(starRing(50, 54, 44, 20, -92, [0, 0.06, -0.04, 0.05, -0.02]), 4.4, -30), 'M', 3, 0.85),
      s(loop(starRing(50, 54, 44, 20, -92, [0, 0.06, -0.04, 0.05, -0.02]), 0.2), 'M', 4.6),
    ],
  },
  {
    id: 'cr3_snowflake', name: '雪花', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      s([0, 60, 120].map((d) => { const a = d * PI / 180; return `M${n(50 - 40 * cos(a))} ${n(50 - 40 * sin(a))}L${n(50 + 40 * cos(a))} ${n(50 + 40 * sin(a))}`; }).join(''), 'M', 4.2),
      s([0, 60, 120, 180, 240, 300].map((d) => {
        const a = d * PI / 180, bx = 50 + 26 * cos(a), by = 50 + 26 * sin(a);
        return [-1, 1].map((k) => { const b = a + k * 0.7 + PI; return `M${n(bx)} ${n(by)}L${n(bx - 10 * cos(b - PI))} ${n(by - 10 * sin(b - PI))}`; }).join('');
      }).join(''), 'M', 3.4),
    ],
  },
  {
    id: 'cr3_pinwheel', name: '風車', cat: 'crayon', style: 'crayon', color: PNK,
    parts: [
      s(line([[50, 44], [51, 70], [49, 96]]), CRM, 4),
      ...[0, 90, 180, 270].map((d, i) => {
        const P = (x, y) => { const a = d * PI / 180; return [50 + x * cos(a) - y * sin(a), 40 + x * sin(a) + y * cos(a)]; };
        return s(loop([P(0, 0), P(4, -14), P(18, -26), P(22, -6)], 0.1), [PNK, AQU, BUT, MNT][i], 4.2);
      }),
      dot(50, 40, CRM, 6),
    ],
  },
  {
    id: 'cr3_umbrella', name: '雨傘', cat: 'crayon', style: 'crayon', color: AQU,
    parts: [
      s(cloudD([[10, 52], [22, 26, 0], [50, 14, 0], [78, 26, 0], [90, 52, 0], [70, 52, 0.55], [50, 52, 0.55], [30, 52, 0.55], [10, 52, 0.55]], false), 'M', 4.6),
      s(pen(['L', [50, 14], [50, 84]], [[50, 84], [48, 92], [40, 92], [38, 86]]), CRM, 4.2),
      s(line([[50, 16], [38, 34], [30, 52]]), 'M', 3, 0.7), s(line([[50, 16], [62, 34], [70, 52]]), 'M', 3, 0.7),
    ],
  },
  {
    id: 'cr3_ufo', name: '飛碟', cat: 'crayon', style: 'crayon', color: MNT,
    parts: [
      s(loop(ring(50, 30, 15, 13, 9, PI, [0]).filter(([, y]) => y <= 31).concat([[35, 31]]), 0.1), AQU, 4.2),
      s(loop(ring(50, 38, 38, 10, 14)), 'M', 4.6),
      ...[[30, 39], [50, 41], [70, 39]].map(([x, y]) => dot(x, y, BUT, 5)),
      s('M36 52L28 70M50 54V74M64 52L72 70', BUT, 3.2, 0.7),
    ],
  },
  {
    id: 'cr3_sparkles', name: '閃閃一把', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      spark(40, 58, 22, 'M', 4.4), spark(74, 28, 12, BUT, 4), spark(78, 74, 8, PNK, 3.6), spark(20, 22, 7, AQU, 3.6),
      dot(56, 18, 'M', 4), dot(16, 84, 'M', 3.6), dot(92, 52, BUT, 3.4),
    ],
  },
  // ---------- 花園／自然 ----------
  {
    id: 'cr3_tulip', name: '蠟筆鬱金香', cat: 'crayon', style: 'crayon', color: PNK,
    parts: [
      s(line([[50, 56], [48, 76], [50, 96]]), MNT, 4.2), s(petalD(49, 90, 1, 26, 8, -2.3), MNT, 3.8),
      s(scribble(TULIP_P, 4.2, -40), 'M', 3, 0.8), s(loop(TULIP_P, 0.12), 'M', 4.6),
    ],
  },
  {
    id: 'cr3_mushroom', name: '蠟筆香菇', cat: 'crayon', style: 'crayon', color: PCH,
    parts: [
      s(loop([[38, 58], [36, 76], [40, 90], [60, 90], [64, 76], [62, 58]], 0.1), CRM, 4.4),
      s(scribble(CAP_P, 4.6, -30), 'M', 3, 0.75), s(loop(CAP_P, 0.12), 'M', 4.8),
      ...[[34, 42], [52, 30], [68, 44]].map(([x, y]) => dot(x, y, CRM, 7)),
    ],
  },
  {
    id: 'cr3_leaf', name: '蠟筆葉子', cat: 'crayon', style: 'crayon', color: MNT,
    parts: [
      f(loop([[50, 8], [72, 28], [76, 54], [62, 78], [50, 88], [36, 76], [24, 52], [30, 26]])),
      s(loop([[50, 8], [72, 28], [76, 54], [62, 78], [50, 88], [36, 76], [24, 52], [30, 26]], 0.15), 'M', 4.6),
      s(line([[50, 16], [51, 50], [50, 96]]), 'M', 3.6), s('M51 40L63 30M51 56L38 46M51 70L63 60', 'M', 3),
    ],
  },
  {
    id: 'cr3_tree', name: '圓圓樹', cat: 'crayon', style: 'crayon', color: MNT,
    parts: [
      s(pen(['L', [46, 94], [47, 60]], ['L', [53, 60], [54, 94]]), PCH, 4.4), s(line([[50, 72], [62, 62]]), PCH, 3.4),
      f(cloudD([[24, 62], [14, 46, 0.6], [24, 26, 0.6], [44, 14, 0.6], [66, 16, 0.6], [84, 32, 0.6], [84, 54, 0.6], [70, 64, 0.6], [24, 62, 0.6]])),
      s(cloudD([[24, 62], [14, 46, 0.6], [24, 26, 0.6], [44, 14, 0.6], [66, 16, 0.6], [84, 32, 0.6], [84, 54, 0.6], [70, 64, 0.6], [24, 62, 0.6]]), 'M', 4.6),
      ...[[38, 36], [60, 30], [56, 50], [34, 52]].map(([x, y]) => dot(x, y, PNK, 6)),
    ],
  },
  {
    id: 'cr3_snail', name: '蝸牛散步', cat: 'crayon', style: 'crayon', color: PCH, vb: [100, 76],
    parts: [
      s(line([[8, 68], [30, 70], [60, 70], [84, 68], [92, 62], [88, 50], [84, 36], [80, 30]]), CRM, 4.4),
      s(line([[84, 36], [92, 22]]), CRM, 3.4), s(line([[80, 32], [80, 18]]), CRM, 3.4), dot(92, 20, CRM, 5), dot(80, 16, CRM, 5),
      s(SNAIL_SPIRAL, 'M', 4.6),
    ],
  },
  {
    id: 'cr3_ladybug', name: '瓢蟲', cat: 'crayon', style: 'crayon', color: PNK,
    parts: [
      f(loop(ring(50, 56, 28, 30, 12))), s(loop(ring(50, 56, 28, 30, 12)), 'M', 4.6),
      s(line([[50, 28], [50, 86]]), CRM, 3.4),
      s(line([[34, 26], [50, 22], [66, 26]]), CRM, 4.2), s(line([[42, 24], [36, 12], [30, 8]]), CRM, 3.2), s(line([[58, 24], [64, 12], [70, 8]]), CRM, 3.2),
      ...[[37, 50, 8], [64, 42, 6], [62, 66, 9], [38, 72, 6]].map(([x, y, w]) => dot(x, y, CRM, w)), // 點點刻意不對稱，看起來不像臉
    ],
  },
  {
    id: 'cr3_butterfly', name: '蠟筆蝴蝶', cat: 'crayon', style: 'crayon', color: AQU,
    parts: [
      s(loop([[48, 46], [36, 24], [18, 18], [10, 32], [18, 46], [46, 50]], 0.12), 'M', 4.4),
      s(loop([[52, 46], [64, 24], [82, 18], [90, 32], [82, 46], [54, 50]], 0.12), 'M', 4.4),
      s(loop([[48, 54], [30, 58], [24, 74], [34, 80], [48, 62]], 0.12), PNK, 4.2),
      s(loop([[52, 54], [70, 58], [76, 74], [66, 80], [52, 62]], 0.12), PNK, 4.2),
      s(line([[50, 40], [50, 70]]), CRM, 5), s(line([[49, 40], [44, 28], [40, 24]]), CRM, 3), s(line([[51, 40], [56, 28], [60, 24]]), CRM, 3),
    ],
  },
  {
    id: 'cr3_daisy', name: '蠟筆雛菊', cat: 'crayon', style: 'crayon', color: CRM,
    parts: [
      s([...Array(9)].map((_, i) => petalD(50, 50, 9, 42, 9, (i * 2 * PI) / 9 + 0.1)).join(''), 'M', 4.2),
      f(loop(ring(50, 50, 9, 9, 8)), BUT), s(loop(ring(50, 50, 9, 9, 8)), BUT, 4.4),
    ],
  },
  {
    id: 'cr3_clover', name: '三葉草', cat: 'crayon', style: 'crayon', color: MNT,
    parts: [
      s(line([[50, 50], [54, 72], [50, 96]]), 'M', 4),
      ...[-90, 30, 150].map((d) => { const a = d * PI / 180; return s(heartD(50 + 17 * cos(a), 46 + 17 * sin(a), 34, d + 90), 'M', 4.4); }),
      ...[-90, 30, 150].map((d) => { const a = d * PI / 180; return f(heartD(50 + 17 * cos(a), 46 + 17 * sin(a), 34, d + 90), 'M'); }),
    ],
  },
  {
    id: 'cr3_strawberry', name: '蠟筆草莓', cat: 'crayon', style: 'crayon', color: PNK,
    parts: [
      f(loop([[50, 92], [32, 76], [22, 52], [32, 34], [50, 32], [68, 34], [78, 52], [68, 76]])),
      s(loop([[50, 92], [32, 76], [22, 52], [32, 34], [50, 32], [68, 34], [78, 52], [68, 76]], 0.12), 'M', 4.6),
      ...[[38, 48], [52, 46], [64, 52], [44, 62], [58, 64], [50, 78]].map(([x, y]) => dot(x, y, BUT, 4)),
      s(pen(['L', [32, 30], [42, 34], [50, 24], [58, 34], [68, 30]]), MNT, 4.2), s(line([[50, 24], [52, 12]]), MNT, 3.6),
    ],
  },
  {
    id: 'cr3_seaweed', name: '海草', cat: 'crayon', style: 'crayon', color: MNT, vb: [100, 76],
    parts: [
      s(line([[30, 74], [24, 60], [34, 46], [26, 32], [34, 16]]), 'M', 4.6),
      s(line([[46, 74], [52, 58], [44, 44], [50, 30]]), AQU, 4.4),
      s(line([[64, 74], [58, 62], [68, 50], [62, 38], [70, 24], [66, 12]]), 'M', 4.6),
      dot(80, 40, AQU, 5), dot(84, 26, AQU, 4), dot(78, 14, AQU, 3.4),
    ],
  },
  {
    id: 'cr3_bee', name: '小蜜蜂', cat: 'crayon', style: 'crayon', color: BUT,
    parts: [
      s(loop(ring(32, 22, 10, 13, 8, -PI / 2), 0.1), CRM, 3.6), s(loop(ring(52, 20, 10, 13, 8, -PI / 2), 0.1), CRM, 3.6),
      f(loop(ring(44, 46, 26, 17, 12))), s(loop(ring(44, 46, 26, 17, 12)), 'M', 4.6),
      s('M36 31Q32 46 36 62M50 30Q46 46 50 63', PCH, 4.2), s(line([[70, 46], [76, 46]]), 'M', 3.6),
      s(line([[18, 60], [12, 72], [24, 76], [30, 86], [44, 84], [52, 94]]), CRM, 2.6, 0.7),
    ],
  },
];
