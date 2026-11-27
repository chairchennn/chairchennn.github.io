// FilmDoodle — 底片色調引擎
// 每個底片預設 = 一組色彩參數 → 烘焙成 3D LUT（33³）→ 每個像素用四面體內插查表。
// 色調為一般底片風格的模擬，非任何廠商官方數值。

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const toLin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const toSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const softClip = (x) => (x <= 0.92 ? x : 0.92 + 0.08 * Math.tanh((x - 0.92) / 0.08));

// ---------- 底片預設 ----------
// wb: {temp, tint} 白平衡；hue: 各色相調整 c=中心角度 w=範圍 h=色相偏移 s=飽和倍率 l=亮度
// curves: 單調三次曲線控制點；split: 暗部/亮部加色；fade: 黑位提升；fx: 預設顆粒/暗角/光暈
export const PRESETS = [
  { id: 'none', name: '原色', sub: 'Original', fx: { grain: 0, vignette: 0, halation: 0 } },
  {
    id: 'flash', name: '閃光底片', sub: '開閃光燈',
    exp: 0.05, wb: { temp: 0.02, tint: -0.03 }, contrast: 0.26, sat: 1.08, vib: 0.05,
    hue: [{ c: 120, w: 55, h: 8, s: 0.92 }, { c: 25, w: 30, s: 1.05, l: 0.02 }, { c: 210, w: 45, h: -6, s: 0.9 }],
    curves: { all: [[0, 0.05], [0.25, 0.24], [0.75, 0.8], [1, 0.97]], g: [[0, 0.015], [0.5, 0.51], [1, 1]] },
    split: { sh: [-0.015, 0.02, 0.012], hi: [0.02, 0.012, -0.015] },
    fx: { grain: 0.32, vignette: 0.3, halation: 0.22, flash: 0.85, soften: 0.25 },
  },
  {
    id: 'gr-pos', name: '正片風', sub: '濃郁飽和',
    wb: { temp: 0.02, tint: 0.015 }, contrast: 0.24, sat: 1.2, vib: 0.08,
    hue: [{ c: 0, w: 40, h: -3, s: 1.12 }, { c: 30, w: 32, h: -3, s: 1.1 }, { c: 58, w: 36, h: -6, s: 1.05 },
      { c: 120, w: 60, h: -6, s: 0.92 }, { c: 210, w: 50, h: 5, s: 1.08, l: -0.02 }],
    curves: { b: [[0, 0.02], [0.5, 0.5], [1, 0.97]] },
    split: { sh: [-0.01, 0, 0.022], hi: [0.02, 0.01, -0.02] },
    fx: { grain: 0.14, vignette: 0.16, halation: 0, soften: 0.25 },
  },
  {
    id: 'gr-neg', name: '負片風', sub: '低反差・淡青',
    wb: { temp: -0.02, tint: -0.035 }, contrast: -0.14, sat: 0.74,
    hue: [{ c: 0, w: 40, h: 6, s: 0.86 }, { c: 58, w: 36, s: 0.8 }, { c: 120, w: 60, h: 12, s: 0.7 }, { c: 215, w: 50, h: -8, s: 0.82 }],
    curves: { all: [[0, 0.06], [0.25, 0.28], [0.75, 0.76], [1, 0.95]], g: [[0, 0.01], [0.5, 0.52], [1, 1]], b: [[0, 0.04], [0.5, 0.5], [1, 0.96]] },
    split: { sh: [-0.02, 0.01, 0.02], hi: [0.015, 0.01, -0.01] },
    fx: { grain: 0.2, vignette: 0.1, halation: 0, soften: 0.25 },
  },
  {
    id: 'gr-bleach', name: '漂白風', sub: 'Bleach Bypass',
    wb: { temp: -0.03 }, contrast: 0.42, sat: 0.45,
    curves: { all: [[0, 0], [0.2, 0.14], [0.8, 0.88], [1, 1]] },
    fx: { grain: 0.22, vignette: 0.25, halation: 0, soften: 0.25 },
  },
  {
    id: 'fuji-cc', name: '紀實灰調', sub: '低飽和・硬陰影',
    contrast: 0.18, sat: 0.8,
    hue: [{ c: 0, w: 35, h: 6, s: 0.8, l: -0.03 }, { c: 30, w: 30, s: 0.92 }, { c: 60, w: 35, h: -6, s: 0.75 },
      { c: 110, w: 50, h: -14, s: 0.62 }, { c: 180, w: 40, h: 8, s: 0.82 }, { c: 222, w: 45, h: -12, s: 0.78, l: -0.02 }],
    curves: { all: [[0, 0.02], [0.2, 0.17], [0.5, 0.5], [0.85, 0.85], [1, 0.96]] },
    split: { sh: [0, 0.005, 0.015], hi: [0.01, 0.005, -0.01] },
    fx: { grain: 0.12, vignette: 0.12, halation: 0, soften: 0.25 },
  },
  {
    id: 'fuji-cn', name: '懷舊負片', sub: '青綠暗部・相簿感',
    contrast: 0.2, sat: 0.92,
    hue: [{ c: 355, w: 35, h: -6, s: 0.96 }, { c: 58, w: 36, h: -8, s: 0.8 }, { c: 120, w: 55, h: 18, s: 0.62 },
      { c: 185, w: 40, s: 0.92 }, { c: 215, w: 45, h: -10, s: 0.86 }],
    curves: {
      r: [[0, 0], [0.25, 0.22], [0.7, 0.74], [1, 1]], g: [[0, 0.02], [0.5, 0.52], [1, 0.98]],
      b: [[0, 0.06], [0.3, 0.3], [0.75, 0.7], [1, 0.9]],
    },
    split: { sh: [-0.03, 0.01, 0.02], hi: [0.02, 0.01, -0.02] }, fade: 0.02,
    fx: { grain: 0.18, vignette: 0.15, halation: 0, soften: 0.25 },
  },
  {
    id: 'fuji-velvia', name: '鮮豔風景', sub: '高飽和反轉片',
    wb: { temp: -0.02, tint: 0.03 }, contrast: 0.3, sat: 1.36, vib: 0.1,
    hue: [{ c: 0, w: 40, s: 1.12 }, { c: 120, w: 55, h: -4, s: 1.1 }, { c: 205, w: 50, h: 4, s: 0.95, l: -0.05 }],
    curves: { all: [[0, 0], [0.2, 0.15], [0.8, 0.86], [1, 1]] },
    fx: { grain: 0.08, vignette: 0.2, halation: 0, soften: 0.25 },
  },
  {
    id: 'fuji-400h', name: '粉嫩空氣', sub: '淡粉・薄荷綠',
    exp: 0.15, wb: { temp: -0.03, tint: -0.02 }, contrast: -0.18, sat: 0.86,
    hue: [{ c: 0, w: 35, h: -4, s: 0.9 }, { c: 58, w: 36, s: 0.8 }, { c: 120, w: 55, h: 16, s: 0.75 }, { c: 210, w: 45, h: -6, s: 0.82 }],
    curves: { all: [[0, 0.05], [0.5, 0.53], [1, 0.98]], g: [[0, 0.01], [0.5, 0.52], [1, 1]] },
    split: { sh: [-0.02, 0.01, 0.03], hi: [0.02, 0, 0.006] },
    fx: { grain: 0.14, vignette: 0.06, halation: 0, soften: 0.25 },
  },
  {
    id: 'fuji-superia', name: '日常負片', sub: '偏綠・街頭感',
    wb: { temp: -0.02, tint: -0.05 }, contrast: 0.15, sat: 1.08,
    hue: [{ c: 0, w: 35, h: -4, s: 1.08 }, { c: 120, w: 55, h: 6, s: 1.04 }],
    curves: { g: [[0, 0.01], [0.45, 0.48], [1, 1]], b: [[0, 0.03], [0.5, 0.5], [1, 0.95]] },
    split: { sh: [-0.02, 0.02, 0.02] },
    fx: { grain: 0.24, vignette: 0.15, halation: 0.08, flash: 0.3, soften: 0.25 },
  },
  {
    id: 'kodak-portra', name: '溫柔膚色', sub: '人像負片',
    exp: 0.05, wb: { temp: 0.07 }, contrast: -0.06, sat: 0.93,
    hue: [{ c: 0, w: 30, s: 0.95 }, { c: 25, w: 35, h: 2, s: 1.05, l: 0.02 }, { c: 55, w: 35, h: -6, s: 0.85 },
      { c: 110, w: 50, h: -10, s: 0.72 }, { c: 215, w: 45, h: -8, s: 0.8 }],
    curves: { all: [[0, 0.03], [0.25, 0.26], [0.75, 0.77], [1, 0.97]], r: [[0, 0], [0.5, 0.51], [1, 1]] },
    split: { sh: [0, 0, 0.01], hi: [0.02, 0.01, -0.01] },
    fx: { grain: 0.16, vignette: 0.08, halation: 0, soften: 0.25 },
  },
  {
    id: 'kodak-gold', name: '金黃懷舊', sub: '暖黃・夏日',
    wb: { temp: 0.14 }, contrast: 0.1, sat: 1.12,
    hue: [{ c: 30, w: 30, s: 1.1 }, { c: 55, w: 35, h: -4, s: 1.2 }, { c: 110, w: 50, h: -10, s: 0.85 }, { c: 215, w: 45, s: 0.9 }],
    curves: { r: [[0, 0], [0.5, 0.53], [1, 1]], b: [[0, 0], [0.5, 0.47], [1, 0.94]] },
    split: { hi: [0.03, 0.02, -0.03] }, fade: 0.02,
    fx: { grain: 0.22, vignette: 0.15, halation: 0.08, flash: 0.3, soften: 0.25 },
  },
  {
    id: 'cine-800t', name: '電影夜景', sub: '鎢絲燈・暖燈青影',
    wb: { temp: -0.22, tint: 0.02 }, contrast: 0.12, sat: 1.0,
    hue: [{ c: 0, w: 35, s: 1.2, l: 0.02 }, { c: 30, w: 30, h: -6 }, { c: 120, w: 55, h: 14, s: 0.7 }, { c: 190, w: 40, s: 1.1 }],
    curves: { b: [[0, 0.04], [0.5, 0.52], [1, 0.98]] },
    split: { sh: [-0.02, 0.01, 0.04], hi: [0.02, 0, 0] },
    fx: { grain: 0.25, vignette: 0.18, halation: 0.45, soften: 0.25 },
  },
  {
    id: 'disposable', name: '拋棄式相機', sub: '暖色日常',
    exp: 0.1, wb: { temp: 0.08, tint: -0.04 }, contrast: 0.32, sat: 1.15,
    hue: [{ c: 120, w: 55, h: -6, s: 1.05 }],
    curves: { g: [[0, 0.02], [0.5, 0.52], [1, 1]] },
    split: { sh: [-0.01, 0.025, 0] }, fade: 0.03,
    fx: { grain: 0.32, vignette: 0.28, halation: 0.12, flash: 0.35, soften: 0.3 },
  },
  {
    id: 'bw-acros', name: '細緻黑白', sub: '柔和灰階',
    bw: [0.3, 0.6, 0.1], contrast: 0.2,
    curves: { all: [[0, 0.02], [0.25, 0.2], [0.75, 0.8], [1, 0.98]] },
    fx: { grain: 0.18, vignette: 0.15, halation: 0, soften: 0.25 },
  },
  {
    id: 'bw-trix', name: '顆粒黑白', sub: '高反差・粗顆粒',
    bw: [0.4, 0.45, 0.15], contrast: 0.45,
    curves: { all: [[0, 0], [0.15, 0.08], [0.85, 0.93], [1, 1]] },
    fx: { grain: 0.45, vignette: 0.22, halation: 0, soften: 0.25 },
  },
];

// ---------- 曲線 ----------
function buildCurve(pts, size = 1024) {
  const m = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [], t = new Array(m);
  for (let i = 0; i < m - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  t[0] = d[0]; t[m - 1] = d[m - 2];
  for (let i = 1; i < m - 1; i++) t[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < m - 1; i++) {
    if (d[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / d[i], b = t[i + 1] / d[i], q = a * a + b * b;
    if (q > 9) { const k = 3 / Math.sqrt(q); t[i] = k * a * d[i]; t[i + 1] = k * b * d[i]; }
  }
  const out = new Float32Array(size);
  let seg = 0;
  for (let k = 0; k < size; k++) {
    const x = k / (size - 1);
    if (x <= xs[0]) { out[k] = ys[0]; continue; }
    if (x >= xs[m - 1]) { out[k] = ys[m - 1]; continue; }
    while (seg < m - 2 && x > xs[seg + 1]) seg++;
    const h = xs[seg + 1] - xs[seg], u = (x - xs[seg]) / h, u2 = u * u, u3 = u2 * u;
    out[k] = (2 * u3 - 3 * u2 + 1) * ys[seg] + (u3 - 2 * u2 + u) * h * t[seg] + (-2 * u3 + 3 * u2) * ys[seg + 1] + (u3 - u2) * h * t[seg + 1];
  }
  return out;
}
function sampleCurve(c, v) {
  const fi = clamp01(v) * (c.length - 1), i = fi | 0;
  if (i >= c.length - 1) return c[c.length - 1];
  return c[i] + (c[i + 1] - c[i]) * (fi - i);
}

function contrastF(x, a) {
  if (a >= 0) { const s = x * x * (3 - 2 * x); return clamp01(x + a * 1.6 * (s - x)); }
  return 0.5 + (x - 0.5) * (1 + a);
}

function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 1e-5) return -1;
  let h;
  if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

const prepared = new Map();
function prepare(p) {
  if (prepared.has(p.id)) return prepared.get(p.id);
  const q = { ...p, c: {} };
  if (p.curves) for (const k of Object.keys(p.curves)) q.c[k] = buildCurve(p.curves[k]);
  prepared.set(p.id, q);
  return q;
}

const K3 = 1 / Math.sqrt(3);
function applyPresetPixel(q, r, g, b) {
  // 1. 白平衡 / 曝光（線性空間）
  if (q.wb || q.exp) {
    const t = q.wb?.temp || 0, ti = q.wb?.tint || 0, e = Math.pow(2, q.exp || 0);
    r = softClip(toSrgb(toLin(r) * e * (1 + 0.2 * t)));
    g = softClip(toSrgb(toLin(g) * e * (1 - 0.12 * ti)));
    b = softClip(toSrgb(toLin(b) * e * (1 - 0.2 * t)));
  }
  // 2. 黑白
  if (q.bw) { const y = r * q.bw[0] + g * q.bw[1] + b * q.bw[2]; r = g = b = y; }
  // 3. 各色相調整
  if (q.hue && !q.bw) {
    const h = hueOf(r, g, b);
    if (h >= 0) {
      let rot = 0, sm = 0, lm = 0;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      for (const band of q.hue) {
        let dd = Math.abs(h - band.c); if (dd > 180) dd = 360 - dd;
        if (dd >= band.w) continue;
        const w = 0.5 * (1 + Math.cos((Math.PI * dd) / band.w));
        rot += w * (band.h || 0); sm += w * ((band.s ?? 1) - 1); lm += w * (band.l || 0);
      }
      if (rot) {
        const th = (rot * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th);
        const kv = (r + g + b) / 3 * (1 - cs);
        const nr = r * cs + K3 * (b - g) * sn + kv;
        const ng = g * cs + K3 * (r - b) * sn + kv;
        const nb = b * cs + K3 * (g - r) * sn + kv;
        r = nr; g = ng; b = nb;
      }
      if (sm) { const y = luma(r, g, b), k = 1 + sm; r = y + (r - y) * k; g = y + (g - y) * k; b = y + (b - y) * k; }
      if (lm) { const k = lm * Math.min(1, chroma * 2); r += k; g += k; b += k; }
    }
  }
  // 4. 飽和 / 自然飽和
  if ((q.sat ?? 1) !== 1 || q.vib) {
    const y = luma(r, g, b);
    const ch = Math.max(r, g, b) - Math.min(r, g, b);
    const k = (q.sat ?? 1) * (1 + (q.vib || 0) * (1 - Math.min(1, ch * 1.5)));
    r = y + (r - y) * k; g = y + (g - y) * k; b = y + (b - y) * k;
  }
  // 5. 對比
  if (q.contrast) { r = contrastF(clamp01(r), q.contrast); g = contrastF(clamp01(g), q.contrast); b = contrastF(clamp01(b), q.contrast); }
  // 6. 曲線
  if (q.c.all) { r = sampleCurve(q.c.all, r); g = sampleCurve(q.c.all, g); b = sampleCurve(q.c.all, b); }
  if (q.c.r) r = sampleCurve(q.c.r, r);
  if (q.c.g) g = sampleCurve(q.c.g, g);
  if (q.c.b) b = sampleCurve(q.c.b, b);
  // 7. 分離色調
  if (q.split) {
    const y = clamp01(luma(r, g, b)), ws = (1 - y) * (1 - y), wh = y * y;
    if (q.split.sh) { r += q.split.sh[0] * ws * 2; g += q.split.sh[1] * ws * 2; b += q.split.sh[2] * ws * 2; }
    if (q.split.hi) { r += q.split.hi[0] * wh * 2; g += q.split.hi[1] * wh * 2; b += q.split.hi[2] * wh * 2; }
  }
  // 8. 褪色
  if (q.fade) { const f = q.fade; r = f + r * (1 - f); g = f + g * (1 - f); b = f + b * (1 - f); }
  return [clamp01(r), clamp01(g), clamp01(b)];
}

// 使用者調整（滑桿 -100..100）
function makeColorFn(preset, adj) {
  const q = prepare(preset);
  const isNone = preset.id === 'none';
  const k = (adj.intensity ?? 100) / 100;
  const ex = Math.pow(2, (adj.exposure || 0) / 100);
  const t = (adj.temp || 0) / 100 * 0.6;
  const ti = (adj.tint || 0) / 100 * 0.4;
  const con = (adj.contrast || 0) / 100 * 0.5;
  const sat = 1 + (adj.saturation || 0) / 100;
  const fade = (adj.fade || 0) / 100 * 0.18;
  const userWB = ex !== 1 || t || ti;
  return (r, g, b) => {
    if (userWB) {
      r = softClip(toSrgb(toLin(r) * ex * (1 + 0.2 * t)));
      g = softClip(toSrgb(toLin(g) * ex * (1 - 0.12 * ti)));
      b = softClip(toSrgb(toLin(b) * ex * (1 - 0.2 * t)));
    }
    if (!isNone && k > 0) {
      const o = applyPresetPixel(q, r, g, b);
      r += (o[0] - r) * k; g += (o[1] - g) * k; b += (o[2] - b) * k;
    }
    if (sat !== 1) { const y = luma(r, g, b); r = y + (r - y) * sat; g = y + (g - y) * sat; b = y + (b - y) * sat; }
    if (con) { r = contrastF(clamp01(r), con); g = contrastF(clamp01(g), con); b = contrastF(clamp01(b), con); }
    if (fade) { r = fade + r * (1 - fade); g = fade + g * (1 - fade); b = fade + b * (1 - fade); }
    return [clamp01(r), clamp01(g), clamp01(b)];
  };
}

// ---------- LUT ----------
const lutCache = new Map();
export function getLUT(preset, adj, N = 33) {
  const key = [preset.id, N, adj.intensity, adj.exposure, adj.temp, adj.tint, adj.contrast, adj.saturation, adj.fade].join('|');
  if (lutCache.has(key)) return lutCache.get(key);
  const fn = makeColorFn(preset, adj);
  const data = new Float32Array(N * N * N * 3);
  let i = 0;
  for (let bi = 0; bi < N; bi++) for (let gi = 0; gi < N; gi++) for (let ri = 0; ri < N; ri++) {
    const o = fn(ri / (N - 1), gi / (N - 1), bi / (N - 1));
    data[i++] = o[0] * 255; data[i++] = o[1] * 255; data[i++] = o[2] * 255;
  }
  const lut = { N, data };
  if (lutCache.size > 40) lutCache.delete(lutCache.keys().next().value);
  lutCache.set(key, lut);
  return lut;
}

export function applyLUT(px, lut) {
  const { N, data } = lut, s = (N - 1) / 255, N3 = N * 3, NN3 = N * N * 3, max = N - 2;
  for (let p = 0, len = px.length; p < len; p += 4) {
    const rf = px[p] * s, gf = px[p + 1] * s, bf = px[p + 2] * s;
    let r0 = rf | 0, g0 = gf | 0, b0 = bf | 0;
    if (r0 > max) r0 = max; if (g0 > max) g0 = max; if (b0 > max) b0 = max;
    const dr = rf - r0, dg = gf - g0, db = bf - b0;
    const c000 = b0 * NN3 + g0 * N3 + r0 * 3, c111 = c000 + NN3 + N3 + 3;
    let w0, w1, w2, w3, i1, i2;
    if (dr > dg) {
      if (dg > db) { w0 = 1 - dr; w1 = dr - dg; w2 = dg - db; w3 = db; i1 = c000 + 3; i2 = c000 + N3 + 3; }
      else if (dr > db) { w0 = 1 - dr; w1 = dr - db; w2 = db - dg; w3 = dg; i1 = c000 + 3; i2 = c000 + NN3 + 3; }
      else { w0 = 1 - db; w1 = db - dr; w2 = dr - dg; w3 = dg; i1 = c000 + NN3; i2 = c000 + NN3 + 3; }
    } else {
      if (db > dg) { w0 = 1 - db; w1 = db - dg; w2 = dg - dr; w3 = dr; i1 = c000 + NN3; i2 = c000 + NN3 + N3; }
      else if (db > dr) { w0 = 1 - dg; w1 = dg - db; w2 = db - dr; w3 = dr; i1 = c000 + N3; i2 = c000 + NN3 + N3; }
      else { w0 = 1 - dg; w1 = dg - dr; w2 = dr - db; w3 = db; i1 = c000 + N3; i2 = c000 + N3 + 3; }
    }
    px[p] = w0 * data[c000] + w1 * data[i1] + w2 * data[i2] + w3 * data[c111] + 0.5;
    px[p + 1] = w0 * data[c000 + 1] + w1 * data[i1 + 1] + w2 * data[i2 + 1] + w3 * data[c111 + 1] + 0.5;
    px[p + 2] = w0 * data[c000 + 2] + w1 * data[i1 + 2] + w2 * data[i2 + 2] + w3 * data[c111 + 2] + 0.5;
  }
}

// ---------- 隨機（可重現，預覽和匯出一致） ----------
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
};

let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d');
  const id = ctx.createImageData(S, S), d = id.data, rnd = rng(9173);
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + ((rnd() + rnd() + rnd() - 1.5) * 150);
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  grainTile = c;
  return c;
}

// ---------- 底片效果：光暈 / 漏光 / 暗角 / 顆粒 / 灰塵 ----------
export function applyHalation(ctx, w, h, amount) {
  if (amount <= 0) return;
  const sw = Math.max(8, Math.round(w / 14)), sh = Math.max(8, Math.round(h / 14));
  const small = makeCanvas(sw, sh), sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const id = sctx.getImageData(0, 0, sw, sh), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    const k = Math.max(0, (y - 0.62) / 0.38);
    const v = k * k * 255;
    d[i] = v; d[i + 1] = v * 0.32; d[i + 2] = v * 0.12; d[i + 3] = 255;
  }
  sctx.putImageData(id, 0, 0);
  const mid = makeCanvas(sw * 3, sh * 3), mctx = mid.getContext('2d');
  mctx.imageSmoothingQuality = 'high';
  mctx.drawImage(small, 0, 0, mid.width, mid.height);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, amount * 1.3);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mid, 0, 0, w, h);
  ctx.restore();
}

export const LEAK_STYLES = [
  ['warm', '暖橘'], ['red', '紅色'], ['corner', '角落'], ['burn', '燒片'], ['rainbow', '彩虹'],
];

export function applyLightLeak(ctx, w, h, amount, style, seed) {
  if (amount <= 0) return;
  const rnd = rng(seed * 7919 + 13), S = Math.max(w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(1, amount);
  const blob = (x, y, r, stops) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };
  const side = rnd() < 0.5;
  if (style === 'warm') {
    const x = side ? -S * 0.05 : w + S * 0.05, y = h * (0.2 + rnd() * 0.6);
    blob(x, y, S * (0.45 + rnd() * 0.2), [[0, 'rgba(255,190,90,0.95)'], [0.35, 'rgba(255,110,30,0.65)'], [1, 'rgba(255,60,0,0)']]);
    blob(x, h * rnd(), S * 0.3, [[0, 'rgba(255,220,140,0.5)'], [1, 'rgba(255,120,40,0)']]);
  } else if (style === 'red') {
    const x = side ? -S * 0.04 : w + S * 0.04, y = h * (0.3 + rnd() * 0.4);
    blob(x, y, S * (0.5 + rnd() * 0.2), [[0, 'rgba(255,80,60,0.95)'], [0.4, 'rgba(230,20,60,0.55)'], [1, 'rgba(160,0,60,0)']]);
  } else if (style === 'corner') {
    const x = side ? w * 1.02 : -w * 0.02, y = -h * 0.02;
    blob(x, y, S * 0.55, [[0, 'rgba(255,240,180,0.95)'], [0.3, 'rgba(255,160,60,0.6)'], [1, 'rgba(255,90,0,0)']]);
  } else if (style === 'burn') {
    const g = side ? ctx.createLinearGradient(0, 0, w * 0.45, 0) : ctx.createLinearGradient(w, 0, w * 0.55, 0);
    g.addColorStop(0, 'rgba(255,245,210,1)'); g.addColorStop(0.18, 'rgba(255,170,60,0.9)');
    g.addColorStop(0.45, 'rgba(240,60,20,0.45)'); g.addColorStop(1, 'rgba(200,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  } else if (style === 'rainbow') {
    ctx.save();
    ctx.translate(w * (0.2 + rnd() * 0.6), h * (0.2 + rnd() * 0.6));
    ctx.rotate(-0.6 + rnd() * 1.2);
    const bw = S * 0.16, g = ctx.createLinearGradient(-bw, 0, bw, 0);
    [['rgba(255,0,80,0)', 0], ['rgba(255,60,60,0.55)', 0.2], ['rgba(255,200,60,0.55)', 0.38], ['rgba(80,255,140,0.45)', 0.55],
      ['rgba(60,160,255,0.5)', 0.72], ['rgba(170,80,255,0.45)', 0.86], ['rgba(170,80,255,0)', 1]].forEach(([c, o]) => g.addColorStop(o, c));
    ctx.fillStyle = g; ctx.fillRect(-bw, -S * 2, bw * 2, S * 4);
    ctx.restore();
  }
  ctx.restore();
}

export function applyVignette(ctx, w, h, amount) {
  if (amount <= 0) return;
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r * 1.02);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.6, `rgba(0,0,0,${0.35 * amount})`);
  g.addColorStop(1, `rgba(0,0,0,${0.85 * amount})`);
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
}

export function applyGrain(ctx, w, h, amount) {
  if (amount <= 0) return;
  const tile = getGrainTile(), k = Math.max(0.5, Math.min(w, h) / 900);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.min(1, amount * 0.9);
  ctx.imageSmoothingEnabled = true;
  ctx.scale(k, k);
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, w / k + 1, h / k + 1);
  ctx.restore();
}

export function applyDust(ctx, w, h, amount, seed) {
  if (amount <= 0) return;
  const rnd = rng(seed * 104729 + 7), S = Math.min(w, h), u = S / 1000;
  ctx.save();
  const specks = Math.round(amount * 160);
  for (let i = 0; i < specks; i++) {
    const x = rnd() * w, y = rnd() * h, r = (0.6 + rnd() * rnd() * 3.2) * u;
    ctx.fillStyle = rnd() < 0.82 ? `rgba(255,255,255,${0.5 + rnd() * 0.45})` : `rgba(20,20,20,${0.4 + rnd() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const hairs = Math.round(amount * 6);
  ctx.lineCap = 'round';
  for (let i = 0; i < hairs; i++) {
    const x = rnd() * w, y = rnd() * h, L = (30 + rnd() * 90) * u, a = rnd() * Math.PI * 2;
    ctx.strokeStyle = `rgba(255,255,255,${0.45 + rnd() * 0.4})`;
    ctx.lineWidth = (0.7 + rnd() * 0.8) * u;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + Math.cos(a) * L * 0.4 + (rnd() - 0.5) * L * 0.6, y + Math.sin(a) * L * 0.4 + (rnd() - 0.5) * L * 0.6,
      x + Math.cos(a) * L * 0.7 + (rnd() - 0.5) * L * 0.6, y + Math.sin(a) * L * 0.7 + (rnd() - 0.5) * L * 0.6,
      x + Math.cos(a) * L, y + Math.sin(a) * L);
    ctx.stroke();
  }
  // 一兩道長刮痕
  if (amount > 0.35) {
    const lines = 1 + Math.round(rnd() * amount * 2);
    for (let i = 0; i < lines; i++) {
      const x = rnd() * w;
      ctx.strokeStyle = `rgba(255,255,255,${0.18 + rnd() * 0.2})`;
      ctx.lineWidth = (0.6 + rnd()) * u;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (rnd() - 0.5) * 20 * u, h); ctx.stroke();
    }
  }
  ctx.restore();
}


// ---------- 閃光燈：中間（主體）亮、四周快速變暗，像真的開閃光燈拍 ----------
const LIN8 = new Float32Array(256).map((_, i) => toLin(i / 255));
// 線性亮度 0~3 → sRGB 0~255，超過 0.75 之後柔和壓縮，不會一下子死白
const SHOULDER = new Uint8ClampedArray(3072).map((_, i) => {
  const v = i / 1024, sv = v < 0.75 ? v : 0.75 + 0.25 * (1 - Math.exp(-(v - 0.75) / 0.25));
  return Math.round(toSrgb(sv) * 255);
});
export function applyFlash(px, w, h, amount) {
  if (amount <= 0) return;
  const cx = w * 0.5, cy = h * 0.44, R2 = (w * w + h * h) / 4, G = new Float32Array(1025);
  for (let i = 0; i <= 1024; i++) {
    const r = Math.sqrt((i / 1024) * 1.6);
    G[i] = Math.pow(2, Math.max(-2 * amount, amount * (0.6 - 2 * Math.pow(r, 1.4)))) * 1024;
  }
  const cool = 0.06 * amount;
  for (let y = 0; y < h; y++) {
    const dy = (y - cy) * (y - cy);
    let p = y * w * 4;
    for (let x = 0; x < w; x++, p += 4) {
      const g = G[Math.min(1024, ((((x - cx) * (x - cx) + dy) / R2) * 640) | 0)];
      const c = g > 1024 ? 1 + cool * (g / 1024 - 1) : 1;
      px[p] = SHOULDER[Math.min(3071, ((LIN8[px[p]] * g) / c) | 0)];
      px[p + 1] = SHOULDER[Math.min(3071, (LIN8[px[p + 1]] * g) | 0)];
      px[p + 2] = SHOULDER[Math.min(3071, LIN8[px[p + 2]] * g * c | 0)];
    }
  }
}

// ---------- 柔焦：底片＋便宜鏡頭沒有手機那麼銳利 ----------
export function applySoften(ctx, w, h, amount) {
  if (amount <= 0) return;
  const sw = Math.max(2, Math.round(w / 2.6)), sh = Math.max(2, Math.round(h / 2.6));
  const small = makeCanvas(sw, sh), sc = small.getContext('2d');
  sc.imageSmoothingQuality = 'high';
  sc.drawImage(ctx.canvas, 0, 0, sw, sh);
  ctx.save();
  ctx.globalAlpha = Math.min(0.85, amount * 0.7);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, w, h);
  ctx.restore();
}

// ---------- 日期戳記（七段顯示器） ----------
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };

function segPath(ctx, x, y, w, h, t, seg) {
  const g = t * 0.18, hw = t / 2;
  const H = (cx1, cx2, cy) => { ctx.moveTo(cx1, cy); ctx.lineTo(cx1 + hw, cy - hw); ctx.lineTo(cx2 - hw, cy - hw); ctx.lineTo(cx2, cy); ctx.lineTo(cx2 - hw, cy + hw); ctx.lineTo(cx1 + hw, cy + hw); ctx.closePath(); };
  const V = (cx, cy1, cy2) => { ctx.moveTo(cx, cy1); ctx.lineTo(cx + hw, cy1 + hw); ctx.lineTo(cx + hw, cy2 - hw); ctx.lineTo(cx, cy2); ctx.lineTo(cx - hw, cy2 - hw); ctx.lineTo(cx - hw, cy1 + hw); ctx.closePath(); };
  const l = x + hw, r = x + w - hw, top = y + hw, mid = y + h / 2, bot = y + h - hw;
  switch (seg) {
    case 'a': H(l + g, r - g, top); break;
    case 'g': H(l + g, r - g, mid); break;
    case 'd': H(l + g, r - g, bot); break;
    case 'f': V(l, top + g, mid - g); break;
    case 'b': V(r, top + g, mid - g); break;
    case 'e': V(l, mid + g, bot - g); break;
    case 'c': V(r, mid + g, bot - g); break;
  }
}

export const DATE_FORMATS = [
  ['yy', "'24 11 27"], ['yyyy', '2024 11 27'], ['mdy', "11 27 '24"], ['dmy', "27 11 '24"],
];
export const DATE_COLORS = [
  ['orange', '#ffad42', '#ff4a00'], ['red', '#ff5a3c', '#ff0a00'], ['yellow', '#ffe066', '#ff9a00'], ['white', '#fff6e8', '#ffb070'],
];

export function formatDate(iso, fmt) {
  const [Y, M, D] = (iso || '').split('-');
  if (!Y) return '';
  const yy = "'" + Y.slice(2);
  switch (fmt) {
    case 'yyyy': return `${Y} ${M} ${D}`;
    case 'mdy': return `${M} ${D} ${yy}`;
    case 'dmy': return `${D} ${M} ${yy}`;
    default: return `${yy} ${M} ${D}`;
  }
}

export function drawDateStamp(ctx, w, h, text, colorId, pos = 'br') {
  if (!text) return;
  const col = DATE_COLORS.find((c) => c[0] === colorId) || DATE_COLORS[0];
  const S = Math.min(w, h), dh = S * 0.042, dw = dh * 0.56, t = dh * 0.15, gap = dh * 0.24;
  const adv = (ch) => (ch === ' ' ? dh * 0.42 : ch === "'" ? dh * 0.26 : dw + gap);
  const total = [...text].reduce((a, ch) => a + adv(ch), 0) - gap;
  const margin = S * 0.055;
  let x = pos === 'bl' ? margin : w - margin - total;
  const y = h - margin - dh;
  ctx.save();
  ctx.translate(x, y + dh);
  ctx.transform(1, 0, -0.1, 1, 0, 0);
  ctx.translate(0, -dh);
  const path = () => {
    ctx.beginPath();
    let cx = 0;
    for (const ch of text) {
      if (SEG[ch]) for (const sg of SEG[ch]) segPath(ctx, cx, 0, dw, dh, t, sg);
      else if (ch === "'") { ctx.rect(cx, 0, t * 0.85, dh * 0.3); }
      cx += adv(ch);
    }
  };
  ctx.globalCompositeOperation = 'screen';
  path();
  ctx.shadowColor = col[2]; ctx.shadowBlur = dh * 0.55;
  ctx.fillStyle = col[2]; ctx.globalAlpha = 0.85; ctx.fill();
  ctx.shadowBlur = dh * 0.18; ctx.shadowColor = col[1];
  ctx.fillStyle = col[1]; ctx.globalAlpha = 0.95; ctx.fill();
  ctx.restore();
}

// ---------- 沖洗：裁切 + 調色（developBase），再加效果與塗鴉（applyFx） ----------
export function developBase(src, crop, outW, outH, s) {
  const c = makeCanvas(outW, outH);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height);
  if (s.original) return c;
  const preset = PRESETS.find((p) => p.id === s.preset) || PRESETS[0];
  const id = ctx.getImageData(0, 0, c.width, c.height);
  applyFlash(id.data, c.width, c.height, (s.adj.flash || 0) / 100);
  applyLUT(id.data, getLUT(preset, s.adj, s.lutN || 33));
  ctx.putImageData(id, 0, 0);
  return c;
}

// overlay(ctx, w, h)：把塗鴉畫進底片裡（在顆粒之前，看起來像印在照片上）
export function applyFx(base, s, overlay, inPlace = false) {
  let c = base;
  if (!inPlace) {
    c = makeCanvas(base.width, base.height);
    c.getContext('2d').drawImage(base, 0, 0);
  }
  if (s.original) return c;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const w = c.width, h = c.height, a = s.adj;
  applySoften(ctx, w, h, (a.soften || 0) / 100);
  applyHalation(ctx, w, h, (a.halation || 0) / 100);
  applyLightLeak(ctx, w, h, (a.leak || 0) / 100, a.leakStyle || 'warm', a.leakSeed || 1);
  if (overlay) { ctx.save(); overlay(ctx, w, h); ctx.restore(); }
  if (s.date?.on) drawDateStamp(ctx, w, h, formatDate(s.date.value, s.date.format), s.date.color, s.date.pos);
  applyVignette(ctx, w, h, (a.vignette || 0) / 100);
  applyGrain(ctx, w, h, (a.grain || 0) / 100);
  applyDust(ctx, w, h, (a.dust || 0) / 100, a.dustSeed || 1);
  return c;
}

export function developPhoto(src, crop, outW, outH, s, overlay) {
  return applyFx(developBase(src, crop, outW, outH, s), s, overlay, true);
}

export function previewThumb(src, preset, adj, size) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d', { willReadFrequently: true });
  const S = Math.min(src.width, src.height);
  ctx.drawImage(src, (src.width - S) / 2, (src.height - S) / 2, S, S, 0, 0, size, size);
  if (preset.id === 'none') return c;
  const id = ctx.getImageData(0, 0, size, size);
  applyFlash(id.data, size, size, preset.fx?.flash || 0);
  applyLUT(id.data, getLUT(preset, { ...adj, intensity: 100 }, 17));
  ctx.putImageData(id, 0, 0);
  return c;
}
