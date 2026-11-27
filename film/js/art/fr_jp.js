// FilmDoodle — 法式手繪（cat: 'french'）與日式手繪（cat: 'japan'）原創貼圖
// 共用工具從 ./shapes.js 匯入。格式同 stickers.js：{ id, name, cat, color, vb?, parts: [...] }
// 法式：'M' = 墨線色（預設深藍或酒紅），淡色填色固定；線稿底下墊一層紙色，深色照片上也看得清楚。
// 日式：'M' = 主要填色（櫻粉、朱紅、靛藍、抹茶…），輪廓用柔和的墨色，部分線條用毛筆般的粗細變化。
import { s, f, circ, ell, poly, scallop, heartD, petalD, notchPetalD, n } from './shapes.js';

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

// 可頌：七段由外往內疊，重疊處自然留下分節線
const CROIS = [[82, 5.5, 7.5], [62, 8.5, 12], [31, 11, 15.5], [0, 13.5, 19]].flatMap(([a, rx, ry], i) => {
  const r = 34, t = (a * PI) / 180, cx = 50, cy = 80;
  const one = (sg) => rotEll(n(cx + sg * r * sin(t)), n(cy - r * cos(t) + (i === 0 ? 1.5 : 0)), rx, ry, sg * a);
  return a ? [one(-1), one(1)] : [one(1)];
});
// 長棍麵包：先畫成水平，再整個轉 -32°
const BAG_H = 'M18 41C40 37 62 37 84 41Q94 43 93 50Q92 58 82 59C60 62 40 62 18 59Q8 58 8 50Q8 42 18 41Z';
const BAG_CUTS = [24, 38, 52, 66].map((x) => `M${x} 53Q${x + 4} 46 ${x + 11} 44`).join('');
const BAG_WRAP = 'M10 36L36 33Q38 50 36 67L10 64Q6 50 10 36Z';
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
const SWASH = [[6, 30], [18, 22], [30, 30], [26, 38], [20, 32], [32, 22], [50, 26], [66, 32], [80, 24], [74, 16], [68, 22], [78, 30], [94, 28]];

const FRENCH = [
  {
    id: 'fr_croissant', name: '可頌', cat: 'french', color: NAVY, parts: [
      ...CROIS.flatMap((d) => [f(d, CRUST), s(d, 'M', FW)]),
      s('M45 38Q50 35 55 38M43 47Q50 44 57 47', 'M', FW2, 0.8),
      f(rotEll(44, 32, 4, 1.6, -30), '#ffffff', 0.8),
    ]
  },
  {
    id: 'fr_baguette', name: '長棍麵包', cat: 'french', color: NAVY, parts: [
      f(rot(BAG_H, -32), CRUST), s(rot(BAG_H, -32), 'M', FW),
      s(rot(BAG_CUTS, -32), 'M', FW2),
      f(rot(BAG_WRAP, -32), PAPER), s(rot(BAG_WRAP, -32), 'M', FW),
      s(rot('M12 44L37 42M11 52L38 51M12 60L37 60', -32), SKY, 2.6),
    ]
  },
  {
    id: 'fr_wine', name: '紅酒杯', cat: 'french', color: WINE, parts: [
      f(GLASS, PAPER, 0.92), f(WINE_IN, '#e48e9b'),
      s(GLASS, 'M', FW), s('M50 56L50 84', 'M', FW), f(ell(50, 85, 15, 3.6), PAPER), s(ell(50, 85, 15, 3.6), 'M', FW),
      s('M37 21Q36 30 38 36', '#ffffff', 2.6, 0.9),
      s('M78 14L78 24M73 19L83 19', 'M', FW2),
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
      f(circ(24, 50, 16), PAPER, 0.5), f(circ(76, 50, 16), PAPER, 0.5),
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
      f(MAC_FILL, BUTTER), s(MAC_FILL, 'M', FW2),
      f(MAC_TOP, ROSE), s(MAC_TOP, 'M', FW), f(MAC_BOT, ROSE), s(MAC_BOT, 'M', FW),
      s('M30 41Q36 36 44 35', '#ffffff', 2.6, 0.85),
    ]
  },
  {
    id: 'fr_swash', name: '裝飾捲線', cat: 'french', color: NAVY, vb: [100, 50], parts: [
      s(curve(SWASH), PAPER, HALO),
      f(brush(SWASH, 4.4, { nib: 40, taper: [0.08, 0.1], minW: 0.25, per: 12 })),
      f(heartD(50, 40, 9), ROSE), s(heartD(50, 40, 9), 'M', 1.5),
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
      f(FUJI), s(FUJI, SUMI, JW),
      f(SNOW, '#ffffff'), s(SNOW, SUMI, JW2),
      f(brush([[8, 70], [30, 68], [50, 70], [70, 68], [92, 70]], 3.2, { taper: [0.15, 0.15] }), SUMI),
    ]
  },
  {
    id: 'jp_wave', name: '青海波', cat: 'japan', color: AI, vb: [100, 70], parts: [
      ...[[30, 66], [70, 66], [50, 48]].flatMap(([x, y]) => {
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
      f(rot('M44 26C48 22 56 22 58 27C56 31 48 31 44 27L38 23L39 30Z', 0), SHU), f(circ(54, 26, 1), '#ffffff'),
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
      f(rot(circ(45.5, 19, 2), 20), SUMI), f(rot(circ(54.5, 19, 2), 20), SUMI),
    ]
  },
  {
    id: 'jp_dango', name: '糰子', cat: 'japan', color: SAKURA, parts: [
      s(rot('M50 8L50 94', 18), '#c9a26a', 4.5), s(rot('M50 8L50 94', 18), SUMI, 1.4, 0.4),
      f(rot(circ(50, 26, 15), 18)), s(rot(circ(50, 26, 15), 18), SUMI, JW2),
      f(rot(circ(50, 52, 15), 18), '#ffffff'), s(rot(circ(50, 52, 15), 18), SUMI, JW2),
      f(rot(circ(50, 78, 15), 18), MATCHA), s(rot(circ(50, 78, 15), 18), SUMI, JW2),
      ...[[45, 21], [45, 47], [45, 73]].map(([x, y]) => f(rot(rotEll(x, y, 3.2, 2, -30), 18), '#ffffff', 0.7)),
    ]
  },
  {
    id: 'jp_maneki', name: '招財貓', cat: 'japan', color: SHU, parts: [
      f(MANEKI, '#ffffff'), s(MANEKI, SUMI, JW),
      f('M34 22Q30 14 28 8Q36 10 42 16Z', '#ffffff'), s('M34 22Q30 14 28 8Q36 10 42 16', SUMI, JW2),
      f('M66 22Q70 14 72 8Q64 10 58 16Z', '#ffffff'), s('M66 22Q70 14 72 8Q64 10 58 16', SUMI, JW2),
      f('M58 20Q64 16 70 20Q70 28 62 28Q57 26 58 20Z', '#f2a35e', 0.95),
      f('M72 50C78 44 80 36 78 28Q84 24 88 30C88 40 84 48 78 54Z', '#ffffff'), s('M72 50C78 44 80 36 78 28Q84 24 88 30C88 40 84 48 78 54', SUMI, JW2),
      s('M37 36q4 -4.5 8 0M55 36q4 -4.5 8 0', SUMI, 2.4), s('M46 42q2 2.4 4 0q2 2.4 4 0', SUMI, 2.2),
      f(ell(34, 42, 4.5, 2.6), JCH, 0.9), f(ell(66, 42, 4.5, 2.6), JCH, 0.9),
      s('M30 52Q50 60 70 52', 'M', 5), f(circ(50, 60, 5), '#f6c64f'), s(circ(50, 60, 5), SUMI, 1.8), s('M46 61L54 61', SUMI, 1.4),
      f(ell(42, 80, 7, 4.5), '#ffffff'), s('M35 80Q42 74 49 80', SUMI, JW2),
    ]
  },
  {
    id: 'jp_bamboo', name: '竹葉', cat: 'japan', color: MATCHA, parts: [
      f(brush([[30, 88], [42, 64], [50, 46]], 3.6, { taper: [0, 0.3] }), '#7a9a5e'),
      f(brush([[48, 50], [38, 34], [22, 22]], 15, { taper: [0.15, 0.75], per: 12 })),
      f(brush([[50, 48], [62, 28], [70, 10]], 15, { taper: [0.15, 0.75], per: 12 })),
      f(brush([[48, 52], [66, 50], [88, 40]], 14, { taper: [0.15, 0.75], per: 12 })),
    ]
  },
];

export const ART_FR_JP = [...FRENCH, ...JAPAN];
