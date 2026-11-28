// FilmDoodle — 法式手繪（cat: 'french'）與日式手繪（cat: 'japan'）原創貼圖
// 共用工具從 ./shapes.js 匯入。格式同 stickers.js：{ id, name, cat, color, vb?, parts: [...] }
// 法式：'M' = 墨線色（預設深藍或酒紅），淡色填色固定；線稿底下墊一層紙色，深色照片上也看得清楚。
// 日式：'M' = 主要填色（櫻粉、朱紅、靛藍、抹茶…），輪廓用柔和的墨色，部分線條用毛筆般的粗細變化。
import { s, f, circ, ell, poly, sparkleD, heartD, petalD, notchPetalD, softStar, ringOf, n } from './shapes.js';

// ---------- 小工具 ----------
const { PI, cos, sin, hypot, atan2, abs, max, min } = Math;
// 只含絕對座標（M/L/Q/C）的 path：繞 (cx,cy) 旋轉 deg 度
const rot = (d, deg, cx = 50, cy = 50) => {
  const a = (deg * PI) / 180, c = cos(a), sn = sin(a);
  return d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (_, x, y) => {
    const dx = +x - cx, dy = +y - cy;
    return `${n(cx + dx * c - dy * sn)} ${n(cy + dx * sn + dy * c)}`;
  });
};
// 單一點繞 (cx,cy) 旋轉（圓、橢圓這種用相對弧線的 path 不能用 rot，改成旋轉圓心）
const rp = (x, y, deg, cx = 50, cy = 50) => { const a = (deg * PI) / 180; return [n(cx + (x - cx) * cos(a) - (y - cy) * sin(a)), n(cy + (x - cx) * sin(a) + (y - cy) * cos(a))]; };
// 平移＋縮放（絕對座標 path）
const fit = (d, k, dx, dy) => d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (_, x, y) => `${n(+x * k + dx)} ${n(+y * k + dy)}`);
// 左右對稱
const mirror = (fn, axis = 50) => fn((x) => n(x)) + fn((x) => n(2 * axis - x));
// 旋轉的橢圓
function rotEll(cx, cy, rx, ry, deg) {
  const a = (deg * PI) / 180, c = cos(a), sn = sin(a);
  const x1 = n(cx + rx * c), y1 = n(cy + rx * sn), x2 = n(cx - rx * c), y2 = n(cy - rx * sn);
  return `M${x1} ${y1}A${rx} ${ry} ${deg} 0 1 ${x2} ${y2}A${rx} ${ry} ${deg} 0 1 ${x1} ${y1}Z`;
}
// Catmull-Rom 取樣：穿過每個點的平滑曲線
function sampleCR(pts, closed = false, per = 10) {
  const N = pts.length, out = [];
  const at = (i) => closed ? pts[(i + N) % N] : pts[max(0, min(N - 1, i))];
  const segs = closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  if (!closed) out.push(pts[N - 1]);
  return out;
}
// 平滑曲線（給描邊用）
const curve = (pts, closed = false) => poly(sampleCR(pts, closed, 8), closed);
// 毛筆／沾水筆：沿著曲線填一條粗細會變的筆畫。
//   w = 最粗寬度；taper = 頭尾變細的比例；nib = 筆尖角度（度，設了就像書法筆：橫細直粗）
function brush(pts, w, { taper = [0.3, 0.4], nib = null, minW = 0.18, per = 10 } = {}) {
  const P = sampleCR(pts, false, per), L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const T = L[L.length - 1], left = [], right = [];
  P.forEach((p, i) => {
    const a = P[min(i + 1, P.length - 1)], b = P[max(i - 1, 0)], ang = atan2(a[1] - b[1], a[0] - b[0]);
    const t = L[i] / T;
    let k = 1;
    if (taper[0] && t < taper[0]) k = sin((t / taper[0]) * PI / 2);
    if (taper[1] && t > 1 - taper[1]) k = min(k, sin(((1 - t) / taper[1]) * PI / 2));
    if (nib !== null) k *= 0.35 + 0.65 * abs(sin(ang - (nib * PI) / 180));
    const hw = (w / 2) * max(minW, k);
    left.push([p[0] - hw * sin(ang), p[1] + hw * cos(ang)]);
    right.push([p[0] + hw * sin(ang), p[1] - hw * cos(ang)]);
  });
  return poly([...left, ...right.reverse()]);
}
// 多邊形裡的水平條紋（每條往內縮 pad）
function stripesIn(pts, ys, pad = 2.5) {
  let d = '';
  for (const y of ys) {
    const xs = [];
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) xs.push(p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
    });
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > pad * 2 + 2) d += `M${n(xs[i] + pad)} ${n(y)}L${n(xs[i + 1] - pad)} ${n(y)}`;
  }
  return d;
}
const ptsOf = (d) => [...d.matchAll(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g)].map((m) => [+m[1], +m[2]]);

// ===========================================================================
// 法式手繪：細墨線、優雅、留白多
// ===========================================================================
const NAVY = '#2b3a67', WINE = '#8c2f39', PAPER = '#fffaf0', BUTTER = '#f8e3a3', ROSE = '#f5c3c8',
  SKY = '#cfe1f3', CRUST = '#f2cd8a', SAGE = '#d8e5c6';
const FW = 2.6, FW2 = 1.9, HALO = 8; // 主線、細節線、紙色底邊

// 可頌：七段沿著弧線排，由兩端往中間疊，重疊處自然留下分節線
const CROIS = [[67, 6.5, 8.5], [47, 9.5, 12], [24, 12, 15], [0, 14, 16.5]].flatMap(([a, rx, ry]) => {
  const r = 40, t = (a * PI) / 180, cx = 50, cy = 84;
  const one = (sg) => rotEll(n(cx + sg * r * sin(t)), n(cy - r * cos(t)), rx, ry, sg * a);
  return a ? [one(-1), one(1)] : [one(1)];
});
// 長棍麵包：先畫成水平，再整個轉 -32°
const BAG_H = 'M18 41C40 37 62 37 84 41Q94 43 93 50Q92 58 82 59C60 62 40 62 18 59Q8 58 8 50Q8 42 18 41Z';
const BAG_CUTS = [24, 38, 52, 66].map((x) => `M${x} 53Q${x + 4} 46 ${x + 11} 44`).join('');
const BAG_WRAP = 'M5 35L40 32L36.5 37L41 42L36.5 47L41 52L36.5 57L41 62L37 66L5 65Q1 50 5 35Z';
// 紅酒杯
const GLASS = 'M31 16C29 38 36 54 50 56C64 54 71 38 69 16Z';
const WINE_IN = 'M31.6 32C33 46 40 54 50 55C60 54 67 46 68.4 32Q50 36 31.6 32Z';
// 玫瑰
const ROSE_HEAD = 'M29 30C27 18 38 11 50 12C62 11 73 18 71 30C72 44 62 53 50 53C38 53 28 44 29 30Z';
// 咖啡杯
const CUP = 'M28 44L72 44C72 62 64 74 50 74C36 74 28 62 28 44Z';
// 信封（先畫正的，再轉 -8°）
const ENV = 'M14 30L86 30L86 76L14 76Z', SEAL = ptsOf(rot('M50 57', -8))[0];
// 條紋愛心
const HEART_D = heartD(50, 54, 82);
const HEART_STRIPES = stripesIn(ptsOf(HEART_D), [30, 40, 50, 60, 70, 80], 3);
// 馬卡龍（側面）
const MAC_TOP = 'M22 50C22 30 78 30 78 50Z', MAC_BOT = 'M22 62L78 62C78 76 22 76 22 62Z';
const MAC_FILL = 'M21 50Q50 47 79 50Q81 56 79 62Q50 65 21 62Q19 56 21 50Z';
// 腳踏車（vb 100×72）
const BIKE_FRAME = 'M24 50L42 50L62 30L36 30L24 50M42 50L33 22M62 30L76 50M60 22L62 30';
const BIKE_BITS = 'M27 21L38 21M54 19Q60 17 66 21';
// 書寫風捲線（vb 100×50）
const SWASH = [[7, 31], [13, 25], [21, 25], [23, 31], [18, 34], [14, 29], [20, 22], [33, 21], [44, 27], [50, 33], [56, 27], [67, 21], [80, 22], [86, 29], [82, 34], [77, 31], [79, 25], [87, 25], [93, 31]];

const FRENCH = [
  {
    id: 'fr_croissant', name: '可頌', cat: 'french', color: NAVY, parts: [
      ...CROIS.flatMap((d) => [f(d, CRUST), s(d, 'M', FW)]),
      f(rotEll(44, 36, 4.5, 1.8, -28), '#ffffff', 0.85), f(rotEll(29, 46, 3, 1.4, -50), '#ffffff', 0.7),
    ]
  },
  {
    id: 'fr_baguette', name: '長棍麵包', cat: 'french', color: NAVY, parts: [
      f(rot(BAG_H, -32), CRUST), s(rot(BAG_H, -32), 'M', FW),
      s(rot(BAG_CUTS, -32), 'M', FW2),
      f(rot(BAG_WRAP, -32), PAPER), s(rot(BAG_WRAP, -32), 'M', FW),
      s(rot('M7 43L33 41.5M6 50.5L34 50.5M7 58L33 59', -32), SKY, 2.8),
    ]
  },
  {
    id: 'fr_wine', name: '紅酒杯', cat: 'french', color: WINE, parts: [
      f(GLASS, PAPER, 0.92), f(WINE_IN, '#e48e9b'),
      s(GLASS, 'M', FW), s('M50 56L50 84', 'M', FW), f(ell(50, 85, 15, 3.6), PAPER), s(ell(50, 85, 15, 3.6), 'M', FW),
      s('M37 21Q36 30 38 36', '#ffffff', 2.6, 0.9),
      f(sparkleD(80, 16, 8, 0.22), BUTTER), s(sparkleD(80, 16, 8, 0.22), 'M', 1.6),
    ]
  },
  {
    id: 'fr_rose', name: '玫瑰', cat: 'french', color: WINE, parts: [
      s('M50 52C48 64 52 76 49 94', 'M', FW),
      f(petalD(50, 70, 0, 22, 7, PI + 0.55), SAGE), s(petalD(50, 70, 0, 22, 7, PI + 0.55), 'M', FW2),
      f(petalD(50, 80, 0, 20, 6.5, -0.45), SAGE), s(petalD(50, 80, 0, 20, 6.5, -0.45), 'M', FW2),
      f(fit(ROSE_HEAD, 1, 2.5, 2.5), ROSE, 0.95), f(ROSE_HEAD, PAPER, 0.55), s(ROSE_HEAD, 'M', FW),
      s('M50 23C45 23 45 30 51 30C57 30 58 22 52 19C44 16 38 24 41 31', 'M', FW2),
      s('M29 29C33 38 41 40 50 39C59 40 67 38 71 29M35 46C41 48 47 45 50 39M65 46C59 48 53 45 50 39', 'M', FW2),
    ]
  },
  {
    id: 'fr_coffee', name: '咖啡杯', cat: 'french', color: NAVY, parts: [
      s('M43 36C39 30 47 26 43 18M56 36C52 30 60 26 56 18', PAPER, HALO), s('M43 36C39 30 47 26 43 18M56 36C52 30 60 26 56 18', 'M', FW2),
      f(ell(50, 77, 31, 6), PAPER), s(ell(50, 77, 31, 6), 'M', FW),
      s('M71 50C82 47 84 63 70 64', PAPER, HALO), s('M71 50C82 47 84 63 70 64', 'M', FW),
      f(CUP, PAPER), s(CUP, 'M', FW),
      f(ell(50, 44, 22, 4.2), '#d6b08c'), s(ell(50, 44, 22, 4.2), 'M', FW),
      f(heartD(50, 60, 13), ROSE), s('M31 53Q50 57 69 53', SKY, 2.4),
    ]
  },
  {
    id: 'fr_bike', name: '小腳踏車', cat: 'french', color: NAVY, vb: [100, 72], parts: [
      s(circ(24, 50, 16) + circ(76, 50, 16) + BIKE_FRAME + BIKE_BITS, PAPER, HALO),
      s(circ(24, 50, 16), 'M', FW), s(circ(76, 50, 16), 'M', FW), f(circ(24, 50, 2.2)), f(circ(76, 50, 2.2)),
      s(BIKE_FRAME, 'M', FW), s(BIKE_BITS, 'M', FW),
      f('M64 21L84 21L81 32L67 32Z', PAPER), s('M64 21L84 21L81 32L67 32Z', 'M', FW2),
      f(circ(69, 18, 4), ROSE), f(circ(76, 16, 4.2), BUTTER), f(circ(82, 19, 3.6), ROSE),
      s(circ(69, 18, 4) + circ(76, 16, 4.2) + circ(82, 19, 3.6), 'M', 1.5),
    ]
  },
  {
    id: 'fr_letter', name: '情書', cat: 'french', color: WINE, parts: [
      f(rot(ENV, -8), PAPER), s(rot(ENV, -8), 'M', FW),
      s(rot('M14 30L50 56L86 30M14 76L40 52M86 76L60 52', -8), 'M', FW2),
      f(heartD(...SEAL, 17, -8), '#b44a5a'),
      f(heartD(78, 14, 12, 12), ROSE), s(heartD(78, 14, 12, 12), 'M', FW2),
    ]
  },
  {
    id: 'fr_heart', name: '條紋愛心', cat: 'french', color: NAVY, parts: [
      f(HEART_D, PAPER), s(HEART_STRIPES, 'M', 3.6), s(HEART_D, 'M', FW),
    ]
  },
  {
    id: 'fr_macaron', name: '馬卡龍', cat: 'french', color: WINE, parts: [
      ...[[0.74, 32, -14, SKY], [1, -8, 10, ROSE]].flatMap(([k, dx, dy, c]) => [
        f(fit(MAC_FILL, k, dx, dy), BUTTER), s(fit(MAC_FILL, k, dx, dy), 'M', FW2),
        f(fit(MAC_TOP, k, dx, dy), c), s(fit(MAC_TOP, k, dx, dy), 'M', FW), f(fit(MAC_BOT, k, dx, dy), c), s(fit(MAC_BOT, k, dx, dy), 'M', FW),
        s(fit('M30 41Q36 36 44 35', k, dx, dy), '#ffffff', 2.6, 0.85),
      ]),
    ]
  },
  {
    id: 'fr_swash', name: '裝飾捲線', cat: 'french', color: NAVY, vb: [100, 50], parts: [
      s(curve(SWASH), PAPER, HALO),
      f(brush(SWASH, 3.6, { nib: 35, taper: [0.06, 0.06], minW: 0.3, per: 12 })),
      s(heartD(50, 17, 11), PAPER, 6), f(heartD(50, 17, 11), ROSE), s(heartD(50, 17, 11), 'M', 1.6),
    ]
  },
];

// ===========================================================================
// 日式手繪：柔和、和紙色系
// ===========================================================================
const SHU = '#e2554a', AI = '#2f4b7c', MATCHA = '#8fb573', SAKURA = '#f4a7b9', KINARI = '#fbf5e6',
  SUMI = '#3e3836', JCH = '#f6a0a6';
const JW = 3.2, JW2 = 2.4;

const ONI = 'M50 14C58 14 64 22 72 36C80 50 88 62 84 74C80 84 66 86 50 86C34 86 20 84 16 74C12 62 20 50 28 36C36 22 42 14 50 14Z';
const NORI = 'M34 62L66 62L67 86L33 86Z';
const FUJI = 'M6 66C20 56 30 42 38 24Q42 19 50 19Q58 19 62 24C70 42 80 56 94 66Z';
const SNOW = 'M38 24Q42 19 50 19Q58 19 62 24C64 29 66 33 68 37Q64 40 60 36Q56 41 52 36Q48 41 44 36Q40 40 33 37C35 33 36 29 38 24Z';
const KOI = 'M50 12C60 12 64 24 62 38C60 52 54 62 52 72C52 76 50 78 48 76C46 68 40 58 38 46C35 28 40 12 50 12Z';
const KOI_TAIL = 'M50 74C44 80 36 84 34 92C42 92 47 88 50 82C53 88 58 92 66 92C64 84 56 80 50 74Z';
const CLOUD = 'M14 46C8 46 6 36 14 34C14 24 28 20 34 28C38 16 58 14 64 26C72 20 86 26 82 36C92 36 94 46 86 48Z';
const FAN = circ(50, 40, 30);
const MANEKI = 'M50 14C66 14 76 22 76 36C76 42 74 46 72 49C80 56 82 70 76 80C70 88 30 88 24 80C18 70 20 56 28 49C26 46 24 42 24 36C24 22 34 14 50 14Z';

const JAPAN = [
  {
    id: 'jp_onigiri', name: '飯糰', cat: 'japan', color: KINARI, parts: [
      f(ONI), s(ONI, SUMI, JW),
      f(NORI, '#3a4a42'), s(NORI, SUMI, JW2),
      f(circ(41, 50, 2.6), SUMI), f(circ(59, 50, 2.6), SUMI), s('M46 55Q50 59 54 55', SUMI, 2.2),
      f(ell(34, 56, 4.5, 2.8), JCH, 0.9), f(ell(66, 56, 4.5, 2.8), JCH, 0.9),
      ...[[44, 30, -0.4], [56, 32, 0.5], [50, 24, 0.1]].map(([x, y, r]) => f(rotEll(x, y, 1.8, 0.9, r * 57), '#d9cdb4')),
    ]
  },
  {
    id: 'jp_sakura', name: '櫻花', cat: 'japan', color: SAKURA, parts: [
      f([...Array(5)].map((_, i) => notchPetalD(50, 52, 4, 44, 15, (i * 2 * PI) / 5 - PI / 2)).join('')),
      s([...Array(5)].map((_, i) => notchPetalD(50, 52, 4, 44, 15, (i * 2 * PI) / 5 - PI / 2)).join(''), '#d9768f', 2.2, 0.8),
      s([...Array(5)].map((_, i) => { const a = (i * 2 * PI) / 5 - PI / 2 + PI / 5; return `M50 52L${n(50 + 13 * cos(a))} ${n(52 + 13 * sin(a))}`; }).join(''), '#e06c8c', 2),
      f([...Array(5)].map((_, i) => { const a = (i * 2 * PI) / 5 - PI / 2 + PI / 5; return circ(50 + 14 * cos(a), 52 + 14 * sin(a), 2.2); }).join(''), '#e06c8c'),
      f(circ(50, 52, 5), '#fff0f3'),
    ]
  },
  {
    id: 'jp_fuji', name: '富士山', cat: 'japan', color: AI, vb: [100, 72], parts: [
      f(circ(76, 22, 12), SHU, 0.95),
      s(FUJI, KINARI, 7), f(FUJI), s(FUJI, SUMI, JW),
      f(SNOW, '#ffffff'), s(SNOW, SUMI, JW2),
      f(brush([[8, 70], [30, 68], [50, 70], [70, 68], [92, 70]], 3.2, { taper: [0.15, 0.15] }), SUMI),
    ]
  },
  {
    id: 'jp_wave', name: '青海波', cat: 'japan', color: AI, vb: [100, 70], parts: [
      ...[[50, 48], [30, 66], [70, 66]].flatMap(([x, y]) => {
        const half = (r) => `M${n(x - r)} ${y}A${r} ${r} 0 0 1 ${n(x + r)} ${y}`;
        return [f(half(22) + 'Z', KINARI), s([22, 15.5, 9].map(half).join(''), 'M', 3), f(half(4) + 'Z')];
      }),
    ]
  },
  {
    id: 'jp_cloud', name: '祥雲', cat: 'japan', color: SHU, vb: [100, 60], parts: [
      f(CLOUD, KINARI), s(CLOUD, 'M', JW),
      s('M30 46C24 46 22 38 28 36C32 35 34 40 31 41M58 48C52 46 54 36 61 37C66 38 65 44 61 44', 'M', JW2),
      f(brush([[20, 54], [44, 52], [70, 54], [90, 52]], 3.4, { taper: [0.2, 0.3] })),
    ]
  },
  {
    id: 'jp_fan', name: '團扇', cat: 'japan', color: AI, parts: [
      s('M50 70L50 94', '#c9a26a', 6), s('M50 70L50 94', SUMI, 1.6, 0.5),
      f(FAN, KINARI), s(FAN, 'M', JW),
      ...[[50, 52], [36, 52], [64, 52], [43, 42], [57, 42]].flatMap(([x, y]) => {
        const half = (r) => `M${n(x - r)} ${y}A${r} ${r} 0 0 1 ${n(x + r)} ${y}`;
        return [f(half(9) + 'Z', KINARI), s(half(9) + half(5), 'M', 1.8, 0.85)];
      }),
      f(circ(60, 26, 7), SHU), // 第八版：原本的小金魚改成紅色太陽（不要小魚）
    ]
  },
  {
    id: 'jp_koi', name: '鯉魚', cat: 'japan', color: SHU, parts: [
      f(rot(KOI_TAIL, 20), '#ffffff'), s(rot(KOI_TAIL, 20), SUMI, JW2),
      f(rot(petalD(41, 34, 0, 12, 5, PI * 0.8), 20), '#ffffff'), s(rot(petalD(41, 34, 0, 12, 5, PI * 0.8), 20), SUMI, JW2),
      f(rot(petalD(59, 34, 0, 12, 5, PI * 0.2), 20), '#ffffff'), s(rot(petalD(59, 34, 0, 12, 5, PI * 0.2), 20), SUMI, JW2),
      f(rot(KOI, 20), '#ffffff'),
      f(rot('M44 30C48 24 58 26 60 36C58 44 50 48 44 42C42 38 42 34 44 30Z', 20)),
      f(rot('M44 54C48 50 56 52 55 58C52 62 46 62 44 54Z', 20)),
      s(rot(KOI, 20), SUMI, JW),
      f(circ(...rp(45.5, 19, 20), 2.2), SUMI), f(circ(...rp(54.5, 19, 20), 2.2), SUMI),
    ]
  },
  {
    id: 'jp_dango', name: '糰子', cat: 'japan', color: SAKURA, parts: [
      s(rot('M50 6L50 95', 18), '#c9a26a', 4.5), s(rot('M50 6L50 95', 18), SUMI, 1.4, 0.4),
      ...[[26, 'M'], [52, '#ffffff'], [78, MATCHA]].flatMap(([y, c]) => [
        f(circ(...rp(50, y, 18), 15), c), s(circ(...rp(50, y, 18), 15), SUMI, JW2),
        f(rotEll(...rp(44, y - 6, 18), 3.6, 2.2, -20), '#ffffff', 0.75),
      ]),
    ]
  },
  {
    id: 'jp_maneki', name: '招財貓', cat: 'japan', color: SHU, parts: [
      f(MANEKI, '#ffffff'), s(MANEKI, SUMI, JW),
      f('M34 22Q30 14 28 8Q36 10 42 16Z', '#ffffff'), s('M34 22Q30 14 28 8Q36 10 42 16', SUMI, JW2),
      f('M66 22Q70 14 72 8Q64 10 58 16Z', '#ffffff'), s('M66 22Q70 14 72 8Q64 10 58 16', SUMI, JW2),
      f('M58 20Q64 16 70 20Q70 28 62 28Q57 26 58 20Z', '#f2a35e', 0.95),
      f('M69 55C74 49 75 42 74 36C73 28 77 23 82 23C87 23 90 28 89 35C88 43 84 50 77 58Z', '#ffffff'), s('M69 55C74 49 75 42 74 36C73 28 77 23 82 23C87 23 90 28 89 35C88 43 84 50 77 58', SUMI, JW2), s('M79 26.5V30M84.5 26.5V30', SUMI, 1.8),
      s('M37 36q4 -4.5 8 0M55 36q4 -4.5 8 0', SUMI, 2.4), s('M46 42q2 2.4 4 0q2 2.4 4 0', SUMI, 2.2),
      f(ell(34, 42, 4.5, 2.6), JCH, 0.9), f(ell(66, 42, 4.5, 2.6), JCH, 0.9),
      s('M30 52Q50 60 70 52', 'M', 5), f(circ(50, 60, 5), '#f6c64f'), s(circ(50, 60, 5), SUMI, 1.8), s('M46 61L54 61', SUMI, 1.4),
      f(ell(42, 80, 7, 4.5), '#ffffff'), s('M35 80Q42 74 49 80', SUMI, JW2),
    ]
  },
  {
    id: 'jp_bamboo', name: '竹葉', cat: 'japan', color: MATCHA, parts: [
      f(brush([[30, 96], [34, 60], [38, 26], [40, 4]], 6.5, { taper: [0, 0.25] }), '#9cbf7e'),
      s('M29.6 72.5L37.6 73.3M33.4 42.6L40.6 43.2', '#6f8f55', 2.2),
      f(brush([[36, 43], [52, 44], [66, 52], [80, 64]], 14, { taper: [0.12, 0.7], per: 12 })),
      f(brush([[36, 46], [46, 56], [52, 70], [54, 86]], 12, { taper: [0.12, 0.7], per: 12 })),
      f(brush([[38, 30], [54, 22], [70, 22], [86, 28]], 12, { taper: [0.12, 0.7], per: 12 })),
      s('M38 44Q56 46 72 56M38 30Q56 22 78 25', '#6f8f55', 1.4, 0.55),
    ]
  },
];

// ===========================================================================
// 第八版（網站 v10）新增：每包約 25 種。法式＝色鉛筆線稿＋淡色（在 stickers.js 換成 pencil）；
// 日式＝木版畫色塊＋柔和的墨色輪廓（在 stickers.js 換成 print）。全部原創、沒有臉。
// ===========================================================================
const fr = (id, name, color, parts, vb) => ({ id, name, cat: 'french', color, ...(vb ? { vb } : {}), parts });
const FR_LINE = (d, w = FW) => s(d, 'M', w);
const FRENCH_V10 = [
  fr('fr_eiffel', '鐵塔', NAVY, [
    f('M30 94L44 52L46 30L49 8L51 8L54 30L56 52L70 94Z', PAPER),
    FR_LINE('M30 94L44 52L46 30L49 8L51 8L54 30L56 52L70 94'), FR_LINE('M38 94Q50 74 62 94'),
    FR_LINE('M36 72H64M42 52H58M45.5 30H54.5', FW2), s('M40 62L60 72M60 62L40 72M45 40L55 50M55 40L45 50', 'M', 1.4, 0.7),
    f(sparkleD(78, 20, 7, 0.22), BUTTER), s(sparkleD(78, 20, 7, 0.22), 'M', 1.4),
  ]),
  fr('fr_beret', '貝雷帽', WINE, [
    f('M12 58C12 38 32 28 54 28C78 28 92 40 89 54C87 64 70 67 50 67C30 67 12 66 12 58Z', '#b96a6a'),
    FR_LINE('M12 58C12 38 32 28 54 28C78 28 92 40 89 54C87 64 70 67 50 67C30 67 12 66 12 58Z'),
    FR_LINE('M52 28L54 19', 3.4), s('M18 60Q50 70 86 58', 'M', FW2), s('M30 40Q44 34 60 36', PAPER, 2.2, 0.6),
  ]),
  fr('fr_cheese', '起司', NAVY, [
    f('M12 64L88 44V78H12Z', BUTTER), f('M12 64L68 32L88 44Z', '#f6ecc6'),
    f(ell(30, 70, 5, 3.6) + ell(52, 64, 4, 3) + ell(72, 68, 5.5, 4) + ell(60, 40, 4, 2.4), CRUST),
    FR_LINE('M12 64L68 32L88 44V78H12Z'), s('M12 64L88 44', 'M', FW2),
  ]),
  fr('fr_perfume', '香水瓶', WINE, [
    f('M28 52Q28 42 38 42H62Q72 42 72 52V82Q72 90 62 90H38Q28 90 28 82Z', ROSE), FR_LINE('M28 52Q28 42 38 42H62Q72 42 72 52V82Q72 90 62 90H38Q28 90 28 82Z'),
    f('M44 30H56V42H44Z', PAPER), FR_LINE('M44 30H56V42H44Z', FW2),
    f(rotEll(28, 24, 8, 6, -10), SKY), s(rotEll(28, 24, 8, 6, -10), 'M', FW2), s('M35 25Q46 24 46 30', 'M', FW2),
    f('M38 60H62V74H38Z', PAPER), s('M38 60H62V74H38Z', 'M', 1.4), s('M43 66H57', 'M', 1.4, 0.7),
  ]),
  fr('fr_umbrella', '雨傘', NAVY, [
    f('M10 52Q12 18 50 14Q88 18 90 52Q80 45 70 52Q60 45 50 52Q40 45 30 52Q20 45 10 52Z', SKY),
    FR_LINE('M10 52Q12 18 50 14Q88 18 90 52Q80 45 70 52Q60 45 50 52Q40 45 30 52Q20 45 10 52Z'),
    s('M50 14Q38 30 30 52M50 14Q62 30 70 52M50 14V52', 'M', FW2), FR_LINE('M50 52V84Q50 92 43 92Q37 92 37 86'), FR_LINE('M50 14V8', 3.2),
  ]),
  fr('fr_mariniere', '條紋衫', NAVY, [
    f('M30 18L41 13Q50 22 59 13L70 18L88 34L78 46L70 40V90H30V40L22 46L12 34Z', PAPER),
    s('M31 33H69M30 45H70M30 57H70M30 69H70M30 81H70M17 39L24 33M83 39L76 33', 'M', 3.2),
    FR_LINE('M30 18L41 13Q50 22 59 13L70 18L88 34L78 46L70 40V90H30V40L22 46L12 34Z'),
  ]),
  fr('fr_chair', '小圓椅', NAVY, [
    FR_LINE('M34 50Q26 10 50 10Q74 10 66 50'), s('M40 48Q36 18 50 18Q64 18 60 48', 'M', FW2),
    f(ell(50, 54, 22, 5.5), CRUST), s(ell(50, 54, 22, 5.5), 'M', FW),
    FR_LINE('M30 57L25 94M70 57L75 94M40 59L38 92M60 59L62 92'), s('M28 78Q50 84 72 78', 'M', FW2),
  ]),
  fr('fr_lamp', '街燈', NAVY, [
    FR_LINE('M50 94V36'), f('M40 94H60L56 85H44Z', PAPER), FR_LINE('M40 94H60L56 85H44Z', FW2),
    FR_LINE('M50 42Q38 30 28 36M50 42Q62 30 72 36', FW2),
    ...[28, 72].flatMap((x) => [f(`M${x - 7} 40H${x + 7}L${x + 5} 56H${x - 5}Z`, BUTTER), s(`M${x - 7} 40H${x + 7}L${x + 5} 56H${x - 5}ZM${x - 8} 40L${x} 34L${x + 8} 40`, 'M', FW2)]),
    s(circ(50, 32, 3.4), 'M', FW2),
  ]),
  fr('fr_book', '打開的書', WINE, [
    f('M50 30Q34 21 12 25V80Q34 76 50 84Q66 76 88 80V25Q66 21 50 30Z', PAPER),
    FR_LINE('M50 30Q34 21 12 25V80Q34 76 50 84Q66 76 88 80V25Q66 21 50 30ZM50 30V84'),
    s('M20 38Q31 35 42 38M20 47Q31 44 42 47M20 56Q31 53 42 56M58 38Q69 35 80 38M58 47Q69 44 80 47M58 56Q69 53 76 55', 'M', 1.4, 0.75),
    f(heartD(68, 68, 10), ROSE),
  ]),
  fr('fr_strawhat', '草帽', NAVY, [
    f(ell(50, 62, 42, 12), CRUST), s(ell(50, 62, 42, 12), 'M', FW),
    f('M28 60Q27 34 50 34Q73 34 72 60Q50 66 28 60Z', CRUST), FR_LINE('M28 60Q27 34 50 34Q73 34 72 60'),
    f('M28 52Q50 58 72 52L72 59Q50 65 28 59Z', SKY), s('M28 52Q50 58 72 52M28 59Q50 65 72 59', 'M', FW2),
    s('M70 58Q80 66 84 76M70 58Q74 70 72 80', 'M', FW2),
  ]),
  fr('fr_madeleine', '瑪德蓮', NAVY, [
    f('M14 60Q16 26 50 22Q84 26 86 60Q50 72 14 60Z', CRUST), FR_LINE('M14 60Q16 26 50 22Q84 26 86 60Q50 72 14 60Z'),
    s('M50 64L26 36M50 64L38 27M50 64L50 24M50 64L62 27M50 64L74 36', 'M', FW2, 0.85),
  ]),
  fr('fr_tart', '草莓塔', WINE, [
    f('M14 58Q50 66 86 58L80 78Q50 86 20 78Z', CRUST), FR_LINE('M14 58Q50 66 86 58L80 78Q50 86 20 78Z'),
    s('M26 64L27 79M38 66V82M50 66V83M62 66V82M74 64L73 79', 'M', 1.4, 0.7),
    f('M18 58Q50 46 82 58Q50 64 18 58Z', PAPER), s('M18 58Q50 46 82 58', 'M', FW2),
    ...[[34, 48, -14], [50, 42, 0], [66, 48, 14]].flatMap(([x, y, r]) => [f(heartD(x, y, 22, 180 + r), '#d98a8a'), s(heartD(x, y, 22, 180 + r), 'M', FW2)]),
  ]),
  fr('fr_key', '古董鑰匙', NAVY, [
    f(circ(26, 50, 15) + circ(26, 50, 7), BUTTER), s(circ(26, 50, 15) + circ(26, 50, 7), 'M', FW),
    FR_LINE('M41 50H88'), FR_LINE('M76 50V62H82V56M88 50V60'), s('M48 46V54M54 46V54', 'M', FW2),
  ], [100, 72]),
  fr('fr_vase', '花瓶', NAVY, [
    s('M44 42Q40 26 28 18M50 42V14M56 42Q62 28 74 22', SAGE, 2.6), s('M44 42Q40 26 28 18M50 42V14M56 42Q62 28 74 22', 'M', 1.2, 0.6),
    ...[[28, 17], [50, 12], [74, 21]].flatMap(([x, y]) => [f([...Array(5)].map((_, i) => circ(x + 5 * cos(i * 1.2566), y + 5 * sin(i * 1.2566), 4)).join(''), ROSE), f(circ(x, y, 2.4), BUTTER)]),
    f('M38 50Q28 62 33 80Q38 92 50 92Q62 92 67 80Q72 62 62 50V42H38Z', SKY), FR_LINE('M38 50Q28 62 33 80Q38 92 50 92Q62 92 67 80Q72 62 62 50V42H38Z'),
    s('M36 66Q50 72 64 66', 'M', FW2),
  ]),
  fr('fr_candle', '燭台', WINE, [
    f('M50 10Q59 21 50 28Q41 21 50 10Z', BUTTER), s('M50 10Q59 21 50 28Q41 21 50 10Z', 'M', FW2),
    f('M42 32H58V72H42Z', PAPER), FR_LINE('M42 32H58V72H42Z'), s('M50 28V32M46 32Q45 40 47 42', 'M', FW2),
    f('M26 76Q50 70 74 76Q68 86 50 86Q32 86 26 76Z', CRUST), FR_LINE('M26 76Q50 70 74 76Q68 86 50 86Q32 86 26 76Z'), FR_LINE(circ(80, 78, 5), FW2),
  ]),
];

const jp = (id, name, color, parts, vb) => ({ id, name, cat: 'japan', color, ...(vb ? { vb } : {}), parts });
const JAPAN_V10 = [
  jp('jp_torii', '鳥居', SHU, [
    f('M28 32H37V94H28ZM63 32H72V94H63ZM16 42H84V49H16Z'), f('M10 22Q50 30 90 22L88 31Q50 37 12 31Z'),
    f('M7 17Q50 25 93 17L91 22Q50 30 9 22Z', SUMI), f('M46 31H54V42H46Z', SUMI),
  ]),
  jp('jp_lantern', '燈籠', SHU, [
    s('M50 4V18', SUMI, JW2), f(ell(50, 52, 26, 32)), s('M26 40H74M24 52H76M26 64H74', KINARI, 1.6, 0.8),
    f('M37 16H63V24H37ZM37 80H63V88H37Z', SUMI), s('M50 88V96', SUMI, JW2),
  ]),
  jp('jp_maple', '楓葉', SHU, [
    s('M50 60L54 96', '#c9a26a', 3), f(softStar(50, 50, [42, 36, 22, 10, 10, 22, 36], 13)),
    s('M50 56L50 14M50 56L18 34M50 56L82 34M50 56L28 66M50 56L72 66', KINARI, 1.4, 0.7),
  ]),
  jp('jp_ume', '梅花', '#e0a0a6', [
    f(ringOf(50, 50, 5, 19, 16)), s([...Array(10)].map((_, i) => `M50 50L${n(50 + 13 * cos((i * PI) / 5))} ${n(50 + 13 * sin((i * PI) / 5))}`).join(''), SHU, 1.4), f([...Array(10)].map((_, i) => circ(50 + 13 * cos((i * PI) / 5), 50 + 13 * sin((i * PI) / 5), 1.6)).join(''), BUTTER),
    f(circ(50, 50, 4), SHU),
  ]),
  jp('jp_wagasa', '和傘', SHU, [
    s('M50 50V94', '#c9a26a', 4.5), f('M10 54Q50 4 90 54Q80 50 70 54Q60 50 50 54Q40 50 30 54Q20 50 10 54Z'),
    s('M50 10L30 53M50 10L70 53M50 10L50 53M50 10L14 52M50 10L86 52', KINARI, 1.4, 0.7), f(circ(50, 30, 6), KINARI),
  ]),
  jp('jp_yunomi', '茶杯', AI, [
    f('M28 34H72L68 82Q66 88 60 88H40Q34 88 32 82Z'), f(ell(50, 34, 22, 5), MATCHA), s(ell(50, 34, 22, 5), SUMI, JW2),
    s('M31 58Q40 52 50 58T69 58', KINARI, 3), s('M42 24Q38 16 44 8M56 24Q52 16 58 8', '#b9a99a', 2.2),
  ]),
  jp('jp_matcha', '抹茶碗', '#b98f6e', [
    f('M12 44H88Q86 80 50 84Q14 80 12 44Z'), f(ell(50, 44, 38, 8), MATCHA), f(circ(40, 44, 2) + circ(56, 42, 1.6) + circ(62, 46, 1.4), '#c7dbb0'),
    f('M40 84H60V90H40Z', '#9a7558'),
  ]),
  jp('jp_furin', '風鈴', '#9cb9d0', [
    s('M50 4V22', SUMI, JW2), f('M28 52Q28 22 50 22Q72 22 72 52Z'), f(circ(38, 40, 3) + circ(52, 32, 3) + circ(62, 44, 3), SHU),
    s('M50 52V66', SUMI, 1.6), f('M43 66H57V96H43Z', KINARI), s('M43 66H57V96H43Z', SUMI, 1.2),
  ]),
  jp('jp_crane', '紙鶴', SHU, [
    f('M26 62L74 62L50 46Z'), f('M28 62L12 30L36 56Z'), f('M12 30L4 37L14 34Z'), f('M72 62L90 30L66 56Z'),
    f('M42 52L32 10L58 48Z', '#e8a39a'), s('M26 62L50 46L74 62M42 52L32 10L58 48', SUMI, 1.2, 0.7),
  ]),
  jp('jp_geta', '木屐', '#c9a26a', [
    f('M10 54Q10 50 14 50H86Q90 50 90 54V62H10Z'), f('M20 62H32V80H20ZM68 62H80V80H68Z', '#a98458'),
    s('M28 50Q32 30 50 28Q68 30 72 50M50 28V38', SHU, 4.2),
  ], [100, 86]),
  jp('jp_sensu', '摺扇', AI, [
    f('M50 88L8 44A60 60 0 0 1 92 44Z'), f('M50 88L36 72A20 20 0 0 1 64 72Z', '#c9a26a'),
    s([...Array(9)].map((_, i) => { const a = PI * (1.25 + i * 0.0625); return `M50 88L${n(50 + 60 * cos(a) * 1.0)} ${n(88 + 60 * sin(a) * 1.0)}`; }).join(''), KINARI, 1.2, 0.6),
    f(circ(62, 42, 9), SHU),
  ]),
  jp('jp_pine', '松', MATCHA, [
    f(brush([[46, 96], [48, 70], [40, 50], [50, 30]], 7, { taper: [0, 0.3] }), '#9a7558'),
    f('M12 52Q28 34 46 42Q60 34 72 48Z'), f('M34 30Q50 12 70 22Q82 18 90 32Z'), f('M50 70Q64 56 80 62Q88 60 94 70Z'),
    s('M18 50Q30 42 44 46M40 28Q54 20 68 26M56 68Q70 62 86 66', KINARI, 1.2, 0.6),
  ]),
  jp('jp_tsukimi', '賞月', '#e9d79a', [
    f(circ(60, 36, 24)), s('M30 98Q26 60 14 30M36 98Q40 64 52 44M42 98Q48 72 72 60', '#a99b7a', 2.4),
    f(rotEll(14, 30, 2.6, 8, -20) + rotEll(52, 44, 2.6, 8, 30) + rotEll(72, 60, 2.6, 8, 60), '#c9b88a'),
  ]),
  jp('jp_chopsticks', '筷子', SHU, [
    f('M14 82L86 18L88 21L18 86Z'), f('M24 88L90 32L92 35L28 92Z'), f(ell(26, 84, 9, 4), AI),
  ]),
  jp('jp_kiku', '菊花', '#e9d79a', [
    f([...Array(16)].map((_, i) => petalD(50, 50, 8, 44, 5, (i * PI) / 8)).join('')),
    f([...Array(12)].map((_, i) => petalD(50, 50, 4, 26, 4.4, (i * PI) / 6 + 0.2)).join(''), '#d9b45e'), f(circ(50, 50, 6), '#b98f6e'),
  ]),
  jp('jp_wisteria', '紫藤', '#a99bc5', [
    s('M6 12Q50 4 94 14', '#9a7558', 3.2), s('M30 10L30 18M56 8L56 16M80 12L80 20', MATCHA, 2),
    f([[30, 18, 7], [56, 16, 8], [80, 20, 6]].flatMap(([x, y, k]) => [...Array(k)].map((_, i) => { const r = 6 - i * 0.6; return circ(x + (i % 2 ? 3 : -3), y + 4 + i * 8.5, r); })).join('')),
  ]),
  jp('jp_suzu', '鈴鐺', '#e9d79a', [
    s('M40 30Q50 14 60 30', SHU, 3.4), f(circ(50, 58, 28)), f('M24 58H76V62H24Z', '#b99a58'), f(circ(50, 72, 4) + 'M49 72H51V86H49Z', SUMI),
    f(heartD(36, 24, 12, -90) + heartD(64, 24, 12, 90), SHU),
  ]),
  jp('jp_kite', '風箏', KINARI, [
    f('M48 6L84 44L48 82L12 44Z'), f(circ(48, 44, 14), SHU), s('M48 6V82M12 44H84', SUMI, 1.2, 0.6),
    s('M48 82Q40 90 50 96Q62 92 72 98', SUMI, 1.4), f(heartD(52, 94, 8, 90) + heartD(66, 96, 8, 90), AI),
  ]),
  // 第九版：補到 30
  jp('jp_ginkgo', '銀杏葉', '#d9b45e', [
    s('M50 60L52 96', '#c9a26a', 3), f('M50 62L16 30Q22 12 40 10Q48 18 50 24Q52 18 60 10Q78 12 84 30Z'),
    s('M50 60L30 22M50 60L42 16M50 60L58 16M50 60L70 22', KINARI, 1.2, 0.6),
  ]),
  jp('jp_kakigori', '刨冰', SAKURA, [
    f('M22 56Q22 22 50 20Q78 22 78 56Z'), f('M36 30Q50 24 64 30Q62 40 50 42Q38 40 36 30Z', SHU),
    f('M18 56H82L72 74H28Z', AI), f('M44 74H56V86H44ZM32 86H68V92H32Z', AI), s('M60 18L80 4', SUMI, 2),
  ]),
  jp('jp_koma', '陀螺', SHU, [
    f('M14 46Q50 30 86 46Q74 70 50 84Q26 70 14 46Z'), f('M18 50Q50 38 82 50L78 56Q50 46 22 56Z', AI), f('M28 64Q50 56 72 64L66 70Q50 64 34 70Z', BUTTER),
    f('M47 14H53V40H47ZM48 84H52V96H48Z', SUMI),
  ]),
  jp('jp_asagao', '牽牛花', AI, [
    s('M14 94Q30 60 24 40Q20 24 34 16', '#8fb573', 2.4), f(petalD(24, 62, 0, 18, 8, 2.6) + petalD(28, 82, 0, 16, 7, -0.4), MATCHA),
    f(circ(60, 46, 28)), f(circ(60, 46, 10), KINARI), s([0, 72, 144, 216, 288].map((a) => `M60 46L${n(60 + 27 * cos(((a - 90) * PI) / 180))} ${n(46 + 27 * sin(((a - 90) * PI) / 180))}`).join(''), KINARI, 1.4, 0.8),
  ]),
  jp('jp_hyotan', '葫蘆', BUTTER, [
    f(circ(50, 34, 16) + circ(50, 66, 25)), f('M44 38Q50 46 56 38Q54 52 50 52Q46 52 44 38Z', BUTTER),
    f('M46 12H54V20H46Z', SUMI), s('M54 16Q70 14 72 24Q74 34 64 36', SHU, 2.4), f(circ(64, 38, 3), SHU),
  ]),
];

export const ART_FR_JP = [...FRENCH, ...FRENCH_V10, ...JAPAN, ...JAPAN_V10];

// ===========================================================================
// 第九版：法式手繪改成「墨線＋套色」（style: 'ink'，筆刷在 js/inkbrush.js）
// 只用三色：黑墨線、朱紅 'R'、粉藍 'B'（'M' = 主色，預設朱紅或粉藍，可換）；色塊故意偏出線外。
// 全部原創造型；不畫真實人物、肖像、名畫，也不畫國旗（用三色緞帶代替）。
const fi = (id, name, color, parts, vb) => ({ id, name, cat: 'french', style: 'ink', color, ...(vb ? { vb } : {}), parts });
// 審查後：沾水筆的細線（參考圖 27）：預設 1.3，最粗 1.8；舊的數字一起按比例縮細
const IK = (d, w = 2.2) => ({ d, s: 'K', w: Math.min(1.8, w * 0.6) }); // 墨線
const IT = (d, w = 1.4) => ({ d, s: 'K', w: w * 0.8, even: true }); // 細而均勻（字、格線）
const IF = (d, c = 'M') => ({ d, f: c }); // 色塊
const IR = '#E8553A', IB = '#86B4E3';
// 旋轉木馬的頂棚：從尖端放射的紅白條紋
const CANOPY = [14, 26, 38, 50, 62, 74].filter((_, i) => i % 2 === 0).map((x) => `M50 14L${x} 40L${x + 12} 40Z`).join('');
const SCALLOP = (x0, x1, y, k, h) => { let d = `M${x0} ${y}`; const step = (x1 - x0) / k; for (let i = 0; i < k; i++) d += `Q${n(x0 + step * (i + 0.5))} ${y + h} ${n(x0 + step * (i + 1))} ${y}`; return d; };
const horse = (x, y, fl = 1) => `M${x - 8 * fl} ${y}Q${x - 8 * fl} ${y - 5} ${x} ${y - 5}Q${x + 5 * fl} ${y - 5} ${x + 6 * fl} ${y - 11}Q${x + 9 * fl} ${y - 13} ${x + 10 * fl} ${y - 9}L${x + 8 * fl} ${y - 6}Q${x + 8 * fl} ${y + 3} ${x} ${y + 3}Q${x - 8 * fl} ${y + 3} ${x - 8 * fl} ${y}Z`;
const bars = (x0, x1, y0, y1, step) => { let d = ''; for (let x = x0; x <= x1 + 0.01; x += step) d += `M${n(x)} ${y0}L${n(x)} ${y1}`; return d; };

const blobLeaf = (x, y) => `M${x} ${y + 8}Q${x - 12} ${y + 6} ${x - 10} ${y - 4}Q${x - 6} ${y - 12} ${x} ${y - 8}Q${x + 6} ${y - 12} ${x + 10} ${y - 4}Q${x + 12} ${y + 6} ${x} ${y + 8}Z`;
export const FRENCH_INK = [
  fi('fi_car', '老爺車', IR, [
    IF('M10 50Q10 40 20 38L30 38Q34 22 48 20L64 20Q72 22 76 36L88 40Q94 42 94 50L94 54H10Z'),
    IF('M36 36Q38 26 48 25H52V36Z', 'W'), IF('M56 36V25H62Q68 26 70 36Z', 'W'),
    IF(circ(28, 54, 9) + circ(76, 54, 9), 'K'), IF(circ(28, 54, 3.4) + circ(76, 54, 3.4), 'W'),
    IK('M10 50Q10 40 20 38L30 38Q34 22 48 20L64 20Q72 22 76 36L88 40Q94 42 94 50V54H86M66 54H38M18 54H10'),
    IK('M36 36Q38 26 48 25H52V36ZM56 36V25H62Q68 26 70 36ZM54 38V52M46 42H50M14 45Q20 42 24 46', 1.6),
    IF(circ(91, 44, 3), 'B'), IK(circ(91, 44, 3), 1.4),
  ], [100, 66]),
  // 第九版審查後：生活小物（取代地標、街牌、帽徽、緞帶，不和參考圖 27 的題材重疊）
  fi('fi_breadbasket', '麵包籃', IR, [
    IF('M14 40H86L78 76H22Z'), IF(ell(38, 36, 17, 9), 'W'),
    IK('M22 40Q50 2 78 40', 1.6), IK('M54 40L82 14Q88 12 87 19L62 42'), IT('M64 33L69 26M70 28L75 21M76 23L80 18', 1),
    IK(ell(38, 36, 17, 9)), IT('M30 32L34 38M38 30L42 36M46 31L48 36', 1),
    IK('M14 40H86L78 76H22Z'), IT('M17 52H83M20 64H80M30 40L32 76M42 40V76M54 40V76M66 40L64 76', 0.9),
  ], [100, 80]),
  fi('fi_cheese', '起司', IB, [
    IF(ell(50, 80, 42, 8)),
    IF('M12 62L66 34L88 46V74L12 78Z', 'W'), IF('M12 62L66 34L88 46Z', 'R'),
    IK('M12 62L66 34L88 46V74L12 78ZM12 62L88 46'),
    IK(ell(30, 70, 4, 3) + ell(52, 64, 5, 3.6) + ell(74, 64, 3.5, 2.6) + ell(62, 72, 3, 2.2), 1.1),
    IK(ell(50, 80, 42, 8), 1.4),
  ], [100, 92]),
  fi('fi_newspaper', '報紙', IB, [
    IF('M18 14L82 20L78 88L14 82Z', 'W'), IF('M24 38L50 40L49 60L23 58Z'), IF('M20 21L77 26L76.5 31L19.5 26Z', 'K'),
    IK('M18 14L82 20L78 88L14 82Z'), IK('M24 38L50 40L49 60L23 58Z', 1.2),
    IT('M56 41L74 43M56 47L74 49M56 53L73 55M56 59L74 61M22 66L72 70M22 72L60 75M21 78L70 82M23 34L40 35.5', 0.9),
    { d: 'M60 30L76 31.5', s: 'R', w: 1.6 },
  ]),
  fi('fi_stamp', '郵票', IR, [
    IF((() => { let d = 'M20 14'; for (let x = 20; x < 80; x += 6) d += `Q${x + 3} 18 ${x + 6} 14`; for (let y = 14; y < 86; y += 6) d += `Q76 ${y + 3} 80 ${y + 6}`; for (let x = 80; x > 20; x -= 6) d += `Q${x - 3} 82 ${x - 6} 86`; for (let y = 86; y > 14; y -= 6) d += `Q24 ${y - 3} 20 ${y - 6}`; return d + 'Z'; })(), 'W'),
    IF('M28 22H72V70H28Z', 'B'), IF(circ(50, 42, 6) + circ(42, 48, 5) + circ(58, 48, 5) + circ(46, 56, 5) + circ(55, 56, 5)),
    IK((() => { let d = 'M20 14'; for (let x = 20; x < 80; x += 6) d += `Q${x + 3} 18 ${x + 6} 14`; for (let y = 14; y < 86; y += 6) d += `Q76 ${y + 3} 80 ${y + 6}`; for (let x = 80; x > 20; x -= 6) d += `Q${x - 3} 82 ${x - 6} 86`; for (let y = 86; y > 14; y -= 6) d += `Q24 ${y - 3} 20 ${y - 6}`; return d + 'Z'; })(), 1.2),
    IK('M28 22H72V70H28Z', 1.2), IK('M50 58V68M50 62Q56 60 58 64', 1),
    IT('M56 72Q64 68 72 72Q80 76 88 72M56 78Q64 74 72 78Q80 82 88 78', 1),
  ]),
  fi('fi_flowerbucket', '花店水桶', IB, [
    IF('M28 56H72L66 92H34Z'),
    IF(circ(34, 22, 6) + circ(48, 14, 6) + circ(62, 20, 6) + circ(72, 32, 5), 'R'), IF(circ(26, 36, 5) + circ(56, 30, 5), 'W'),
    IK('M34 26L40 56M48 20L48 56M62 26L56 56M72 36L62 56M26 40L36 56M56 34L52 56', 1.2),
    IK(circ(34, 22, 6) + circ(48, 14, 6) + circ(62, 20, 6) + circ(72, 32, 5) + circ(26, 36, 5) + circ(56, 30, 5), 1.1),
    IK('M28 56H72L66 92H34ZM26 56H74M30 70H70', 1.6), IK('M40 64Q50 60 60 64', 1),
  ]),
  fi('fi_windowpot', '窗台盆栽', IR, [
    IF('M32 62H68L62 90H38Z'), IF(circ(38, 30, 5) + circ(44, 24, 5) + circ(58, 22, 5) + circ(64, 30, 5) + circ(51, 18, 4.4), 'R'),
    IF(blobLeaf(30, 48) + blobLeaf(70, 46) + blobLeaf(50, 40), 'B'),
    IK(blobLeaf(30, 48) + blobLeaf(70, 46) + blobLeaf(50, 40), 1.1), IK('M42 32L48 58M58 30L54 58M51 22V58', 1),
    IK('M30 62H70V67H30ZM33 67L38 90H62L67 67', 1.6), IK('M8 92H92M8 96H92', 1.4),
  ]),
  fi('fi_key', '舊鑰匙', IR, [
    IF('M66 28L88 22L92 38L70 44Z'),
    IK(circ(22, 30, 14) + circ(22, 30, 6)), IK('M36 30H66M56 30V40H60V34M64 30V38', 1.5),
    IK('M66 28L88 22L92 38L70 44ZM62 30Q64 33 68 34', 1.3), IF(circ(70, 32, 1.6), 'K'),
  ], [100, 60]),
  fi('fi_baguette', '紙袋麵包', IR, [
    IF('M33 48H41L40 94H34ZM49 48H57V94H49ZM65 48H73L72 94H66Z'),
    IK(`${'M40 50Q30 30 34 10Q40 6 44 12Q50 30 46 50'}M36 20L42 16M36 30L44 26M38 40L45 36`),
    IK('M54 50Q56 26 64 8Q70 6 70 12Q66 30 62 50M62 18L68 16M60 28L67 26M58 38L65 36'),
    IK('M26 46H80L76 94H30Z'),
  ]),
  fi('fi_croissant', '可頌', IR, [
    IF('M10 62Q16 40 34 34Q50 28 66 34Q84 40 90 62Q80 56 70 60Q60 50 50 52Q40 50 30 60Q20 56 10 62Z'),
    IK('M10 62Q16 40 34 34Q50 28 66 34Q84 40 90 62Q80 56 70 60Q60 50 50 52Q40 50 30 60Q20 56 10 62Z'),
    IK('M34 35Q40 46 30 60M50 30Q55 42 50 52M66 35Q60 46 70 60M22 44Q26 52 20 58M78 44Q74 52 80 58', 1.5),
  ], [100, 80]),
  fi('fi_coffee', '咖啡杯', IR, [
    IF('M48 82m-34 0a34 6 0 1 0 68 0a34 6 0 1 0 -68 0Z', 'B'),
    IF('M27 50H69L68 58H28ZM29 64H67L65 70H31Z'),
    IF(ell(48, 40, 21, 4), 'K'),
    IK('M26 40H70Q70 76 48 78Q26 76 26 40ZM70 48Q84 46 82 58Q80 66 66 64'), IK(ell(48, 82, 34, 6), 1.8),
    IK('M40 30Q36 24 40 18Q44 12 40 6M54 30Q50 24 54 18Q58 12 54 8', 1.5),
  ]),
  fi('fi_wine', '紅酒', IR, [
    IF('M30 92V50Q30 40 36 36V14H44V36Q50 40 50 50V92Z', 'K'), IF('M32 58H48V76H32Z', 'W'),
    IF('M61 58Q62 70 72 71Q82 70 83 58Z'),
    IK('M30 92V50Q30 40 36 36V14H44V36Q50 40 50 50V92ZM35 18H45'), IT('M35 64H45M35 69H43', 1.1),
    IK('M60 48Q60 70 72 72Q84 70 84 48ZM72 72V88M63 90Q72 86 81 90'),
  ]),
  fi('fi_beret', '貝雷帽', IB, [
    IF('M14 58Q12 36 46 30Q80 26 88 46Q90 58 70 60Q40 64 14 58Z', 'K'),
    IK('M14 58Q12 36 46 30Q80 26 88 46Q90 58 70 60Q40 64 14 58ZM52 30L55 21'),
    { d: 'M20 55Q50 60 82 52', s: 'W', w: 1.2, even: true },
    IF(circ(26, 50, 3.4), 'R'),
  ], [100, 80]),
  fi('fi_mariniere', '條紋衫', IB, [
    IF('M30 26H70V31H30ZM30 38H70V43H30ZM30 50H70V55H30ZM30 62H70V67H30ZM30 74H70V79H30ZM16 36L22 30L26 34L20 40ZM84 36L78 30L74 34L80 40Z'),
    IK('M32 16L42 12Q50 20 58 12L68 16L88 32L80 44L70 38V90H30V38L20 44L12 32Z'),
    IK('M42 12Q50 26 58 12M50 12V6Q50 3 53 3Q56 3 56 6', 1.4),
  ]),
  fi('fi_bike', '腳踏車', IB, [
    IF('M66 22H84L82 34H68Z', 'M'), IF(circ(70, 18, 3.4) + circ(77, 16, 3.4) + circ(83, 19, 3), 'R'),
    IK(circ(22, 48, 16) + circ(78, 48, 16)),
    IK('M22 48L40 48L62 28L34 28L22 48M40 48L32 20M62 28L78 48M60 18L62 28M27 20H37M56 17Q60 15 66 18M66 22H84L82 34H68Z', 1.8),
    IT('M22 48L22 34M22 48L34 52M22 48L12 58M78 48L78 34M78 48L90 52M78 48L66 58', 0.8),
  ], [100, 66]),
  fi('fi_lamp', '街燈', IB, [
    IF('M22 30H38L35 14H25Z'), IF('M22 96H38L35 86H25Z', 'K'),
    IK('M30 86V30', 2.8), IK('M22 30H38L35 14H25ZM22 14L30 6L38 14M30 6V2M30 14V30', 1.8),
    IK('M30 44Q20 42 20 50M30 44Q40 42 40 50M26 62H34M26 72H34', 1.5), IK('M22 96H38L35 86H25Z', 1.6),
  ], [60, 100]),
  fi('fi_balcony', '陽台花窗', IR, [
    IF('M30 66V25Q30 14 50 14Q70 14 70 25V66Z', 'B'),
    IF(circ(26, 66, 4.6) + circ(35, 62, 4.6) + circ(65, 63, 4.6) + circ(74, 66, 4.6) + circ(44, 66, 3.6)),
    IK('M26 70V24Q26 10 50 10Q74 10 74 24V70M50 12V66M30 40H70', 2),
    IK('M14 70H86M16 94H84M16 70V94M84 70V94'), IT(bars(22, 78, 70, 94, 6), 1),
    IK('M40 82Q44 76 50 82Q56 88 60 82M30 60L33 66M36 58L40 64M62 58L60 64M70 60L68 66', 1.4),
  ]),
  fi('fi_carousel', '旋轉木馬', IR, [
    IF(CANOPY), IF(`${SCALLOP(14, 86, 40, 6, 9)}L86 40L14 40Z`, 'B'), IF('M10 84H90V92H10Z', 'B'),
    IF(horse(24, 64) + horse(76, 62, -1), 'W'),
    IK('M50 14L14 40H86ZM50 14V4L58 7L50 10'), IK(SCALLOP(14, 86, 40, 6, 9), 1.6),
    IK('M24 46V84M50 46V84M76 46V84M10 84H90V92H10Z', 1.8),
    IK(horse(24, 64) + horse(76, 62, -1), 1.5), IT('M20 67L18 74M28 67L30 74M80 65L82 72M72 65L70 72', 1),
  ]),
  fi('fi_boat', '遊河小船', IB, [
    IF('M6 34H94L86 48H14Z'), IF('M86 34V18L94 21L86 24Z', 'R'),
    IK('M6 34H94L86 48H14ZM20 34V22H76Q80 22 80 26V34M18 22H78M86 34V18L94 21L86 24'),
    IT('M30 22V34M40 22V34M50 22V34M60 22V34M70 22V34', 1.1),
    IK('M4 56Q12 52 20 56Q28 60 36 56M52 58Q60 54 68 58Q76 62 84 58', 1.4),
  ], [100, 64]),
  fi('fi_macaron', '馬卡龍', IB, [
    ...[[34, 'B'], [56, 'R'], [78, 'B']].flatMap(([y, c]) => [
      IF(`M26 ${y}Q26 ${y - 12} 50 ${y - 12}Q74 ${y - 12} 74 ${y}ZM26 ${y + 6}H74Q74 ${y + 13} 50 ${y + 13}Q26 ${y + 13} 26 ${y + 6}Z`, c),
      IK(`M26 ${y}Q26 ${y - 12} 50 ${y - 12}Q74 ${y - 12} 74 ${y}ZM26 ${y + 6}H74Q74 ${y + 13} 50 ${y + 13}Q26 ${y + 13} 26 ${y + 6}Z`, 1.8),
      IT(`M28 ${y + 3}Q32 ${y + 1} 36 ${y + 3}Q40 ${y + 5} 44 ${y + 3}Q48 ${y + 1} 52 ${y + 3}Q56 ${y + 5} 60 ${y + 3}Q64 ${y + 1} 68 ${y + 3}Q71 ${y + 5} 73 ${y + 3}`, 1),
    ]),
  ]),
  fi('fi_awning', '咖啡店雨棚', IR, [
    IF('M6 12H20L22 40H10ZM34 12H48L46 40H34ZM62 12H76L76 40H64ZM90 12H94L90 40H88Z'),
    IF(`${SCALLOP(10, 90, 40, 8, 8)}L90 40L10 40Z`, 'R'),
    IF('M20 52H44V78H20ZM56 52H80V78H56Z', 'B'),
    IK('M6 12H94L90 40H10Z'), IK(SCALLOP(10, 90, 40, 8, 8), 1.6), IT('M20 12L22 40M34 12V40M48 12L46 40M62 12L64 40M76 12V40', 1),
    IK('M14 46V90M86 46V90M8 90H92M20 52H44V78H20ZM56 52H80V78H56ZM32 52V78M68 52V78', 1.6),
  ], [100, 96]),
  fi('fi_perfume', '香水瓶', IR, [
    IF('M30 50Q30 40 40 40H60Q70 40 70 50V84Q70 92 60 92H40Q30 92 30 84Z', 'B'), IF('M44 30H56V40H44Z', 'K'),
    IF(ell(24, 24, 8, 10)), IF(heartD(50, 66, 16), 'W'),
    IK('M30 50Q30 40 40 40H60Q70 40 70 50V84Q70 92 60 92H40Q30 92 30 84ZM44 30H56V40H44Z'),
    IK(`${ell(24, 24, 8, 10)}M44 33Q32 32 30 28`, 1.6), IK(heartD(50, 66, 16), 1.4),
  ]),
  fi('fi_umbrella', '雨傘', IR, [
    IF('M10 52Q12 18 50 14L30 52Q20 45 10 52ZM50 14L50 52Q60 45 70 52Z'),
    IF('M50 14L30 52Q40 45 50 52ZM50 14Q88 18 90 52Q80 45 70 52Z', 'W'),
    IK('M10 52Q12 18 50 14Q88 18 90 52Q80 45 70 52Q60 45 50 52Q40 45 30 52Q20 45 10 52Z'),
    IK('M50 14L30 52M50 14L70 52M50 14V8', 1.5), IK('M50 52V84Q50 92 43 92Q37 92 37 86', 2.4),
  ]),
  fi('fi_chair', '小圓椅', IR, [
    IF(ell(50, 54, 22, 6)),
    IK('M34 50Q26 10 50 10Q74 10 66 50M40 48Q36 18 50 18Q64 18 60 48'), IK(ell(50, 54, 22, 6), 1.8),
    IK('M30 57L25 94M70 57L75 94M40 59L38 92M60 59L62 92M28 78Q50 84 72 78', 1.8),
    IT('M44 18V48M50 18V48M56 18V48', 0.9),
  ]),
  fi('fi_column', '廣告圓柱', IB, [
    IF('M30 32H70V88H30Z'), IF('M28 32Q30 14 50 12Q70 14 72 32Z', 'K'),
    IF('M35 44H48V64H35ZM53 50H66V72H53Z', 'W'), IF('M37 68H47V82H37Z', 'R'),
    IK('M30 32V88M70 32V88M26 32H74M26 88H74V94H26Z'), IK('M28 32Q30 14 50 12Q70 14 72 32M50 12V6M48 6H52', 1.6),
    IK('M35 44H48V64H35ZM53 50H66V72H53ZM37 68H47V82H37Z', 1.3), IT('M38 49H45M38 53H44M56 56H63M56 60H62', 0.9),
  ]),
  fi('fi_books', '一疊舊書', IR, [
    IF('M16 80H80V92H16Z', 'B'), IF('M22 66L84 64L84 76L22 78Z'), IF('M20 52H74V62H20Z', 'W'), IF('M28 36L72 34L74 46L30 48Z', 'B'),
    IK('M16 80H80V92H16ZM22 66L84 64L84 76L22 78ZM20 52H74V62H20ZM28 36L72 34L74 46L30 48Z', 1.8),
    IT('M24 80V92M76 66V76M26 52V62M66 35L67 46', 1),
    IK('M58 34Q60 22 70 18M62 30Q66 26 72 26', 1.4),
  ]),
  fi('fi_bouquet', '紙包花束', IR, [
    IF('M30 50L50 96L70 50Z', 'B'),
    IF(['M28 30Q28 18 34 16L37 22L40 16Q46 18 46 30Q40 36 28 30Z', 'M48 22Q48 10 54 8L57 14L60 8Q66 10 66 22Q60 28 48 22Z', 'M64 34Q64 22 70 20L73 26L76 20Q82 22 82 34Q76 40 64 34Z'].join('')),
    IK('M37 32L46 62M57 24L52 62M73 36L56 62', 1.5), IK('M44 46Q36 40 34 46M58 42Q66 36 68 44', 1.3),
    IK('M28 30Q28 18 34 16L37 22L40 16Q46 18 46 30Q40 36 28 30ZM48 22Q48 10 54 8L57 14L60 8Q66 10 66 22Q60 28 48 22ZM64 34Q64 22 70 20L73 26L76 20Q82 22 82 34Q76 40 64 34Z', 1.6),
    IK('M28 50H72L50 96Z'), IK('M40 62L46 70L54 62L60 72', 1.4),
  ]),
  fi('fi_letter', '寄出的信', IB, [
    IF('M12 28H88V78H12Z', 'W'), IF('M68 32H82V48H68Z', 'B'), IF(circ(50, 54, 6)),
    IK('M12 28H88V78H12ZM12 28L50 54L88 28'), IK('M68 32H82V48H68Z', 1.3),
    IT('M60 40Q64 36 68 40M58 46Q62 42 66 46M16 70L36 54M84 70L64 54', 1),
  ]),
  fi('fi_paris', '手寫 Paris', IR, [ // noFlip（見下方）
    IK('M10 50L13 12Q32 9 31 22Q30 33 14 31M47 31Q36 27 34 37Q32 47 39 46Q46 44 47 31L48 47M56 47L56 31M56 38Q59 30 67 31M72 32L72 47M90 32Q82 28 80 34Q79 39 85 39.5Q91 41 89 45Q86 49 78 46', 2.4),
    IF(heartD(72, 22, 9), 'M'), { d: 'M8 56Q50 51 94 56', s: 'M', w: 1.2 },
  ], [100, 62]),
  fi('fi_cafe', '手寫 café', IB, [
    IK('M26 30Q16 25 12 34Q9 45 17 47Q23 48 27 43M46 31Q35 27 32 37Q30 47 37 46Q44 44 46 31L47 47M66 12Q57 9 57 20L55 56M50 30L64 29M72 38L88 37Q88 27 80 27Q71 28 71 37Q71 47 80 47Q86 47 89 42M78 21L84 13', 2.4),
    IF('M8 52Q30 48 50 52L50 58Q30 54 8 58Z', 'M'),
  ], [100, 64]),
  fi('fi_pigeon', '鴿子', IB, [
    IF('M20 60Q22 40 40 40Q46 28 56 30Q64 32 64 40L72 42L64 46Q70 56 88 58Q70 74 46 72Q26 72 20 60Z'),
    IK('M20 60Q22 40 40 40Q46 28 56 30Q64 32 64 40L72 42L64 46Q70 56 88 58Q70 74 46 72Q26 72 20 60Z'),
    IK('M34 52Q46 46 60 56Q52 62 40 60', 1.5), IF(circ(57, 37, 1.8), 'K'),
    { d: 'M44 72L42 84L38 86M42 84L46 86M52 72L54 84L50 86M54 84L58 86', s: 'R', w: 1.1 },
  ]),
  fi('fi_bridge', '石橋', IB, [
    IF('M0 64Q10 60 20 64Q30 68 40 64Q50 60 60 64Q70 68 80 64Q90 60 100 64V74H0Z'),
    IK('M2 40H98M2 46H98M6 46V70M94 46V70M6 70Q6 52 28 52Q50 52 50 70Q50 52 72 52Q94 52 94 70'),
    IK('M14 40V26M86 40V26M50 40V26', 1.6), IF(circ(14, 24, 3) + circ(86, 24, 3) + circ(50, 24, 3), 'R'),
    IT(bars(10, 90, 34, 40, 4), 0.8),
  ], [100, 76]),
];
// 侵權審查：地標不要連成一排（避免看起來像參考圖的物件清單），和生活小物交錯排
{
  const order = ['fi_croissant', 'fi_carousel', 'fi_coffee', 'fi_bike', 'fi_beret', 'fi_balcony', 'fi_macaron', 'fi_lamp', 'fi_bouquet', 'fi_awning',
    'fi_umbrella', 'fi_stamp', 'fi_breadbasket', 'fi_letter', 'fi_baguette', 'fi_column', 'fi_chair', 'fi_mariniere', 'fi_cheese', 'fi_windowpot',
    'fi_wine', 'fi_boat', 'fi_car', 'fi_key', 'fi_newspaper', 'fi_perfume', 'fi_flowerbucket', 'fi_books', 'fi_paris', 'fi_cafe', 'fi_pigeon', 'fi_bridge'];
  // 有字的貼圖不能左右翻
  for (const d of FRENCH_INK) if (d.id === 'fi_paris' || d.id === 'fi_cafe') d.noFlip = true;
  const rank = (d) => { const i = order.indexOf(d.id); return i < 0 ? 999 : i; };
  FRENCH_INK.sort((a, b) => rank(a) - rank(b));
}
