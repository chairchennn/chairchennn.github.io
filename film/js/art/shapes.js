// FilmDoodle — 畫貼圖用的共用形狀工具（從 stickers.js 複製出來，給 js/art/*.js 的新風格使用）
// 座標系：100×100（或貼圖自己指定的 vb），'M' = 可替換的主色。

export const P = '#ff8fc0', R = '#ff5f6d', O = '#ff9a3c', Y = '#ffd23c', G = '#6fdc7f',
  C = '#46d2f0', B = '#3f7bff', L = '#b48cff', W = '#ffffff', K = '#2a2433', CH = '#ff9ec7';

export const n = (v) => +v.toFixed(2);
export const circ = (cx, cy, r) => `M${n(cx - r)} ${n(cy)}a${r} ${r} 0 1 0 ${n(r * 2)} 0a${r} ${r} 0 1 0 ${n(-r * 2)} 0Z`;
export const ell = (cx, cy, rx, ry) => `M${n(cx - rx)} ${n(cy)}a${rx} ${ry} 0 1 0 ${n(rx * 2)} 0a${rx} ${ry} 0 1 0 ${n(-rx * 2)} 0Z`;

// part helpers: stroke / fill / fill+stroke
export const s = (d, c = 'M', w = 4.5, a) => ({ d, s: c, w, a });
export const f = (d, c = 'M', a) => ({ d, f: c, a });

export function poly(pts, close = true) {
  return pts.map((p, i) => (i ? 'L' : 'M') + n(p[0]) + ' ' + n(p[1])).join('') + (close ? 'Z' : '');
}

export function starPts(cx, cy, k, ro, ri, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < k * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / k;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts);
}

// 圓弧花瓣（scallop）外框
export function scallop(cx, cy, k, rIn, rOut, rot = -Math.PI / 2, spread = 0.12) {
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

export function sparkleD(cx, cy, r, pinch = 0.14) {
  const q = r * pinch;
  return `M${cx} ${cy - r}Q${n(cx + q)} ${n(cy - q)} ${cx + r} ${cy}Q${n(cx + q)} ${n(cy + q)} ${cx} ${cy + r}` +
    `Q${n(cx - q)} ${n(cy + q)} ${cx - r} ${cy}Q${n(cx - q)} ${n(cy - q)} ${cx} ${cy - r}Z`;
}

// 參數式愛心（可旋轉）
export function heartD(cx, cy, size, rotDeg = 0) {
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
export function outsideArc(ex, ey, er, hx, hy, hr) {
  const dx = hx - ex, dy = hy - ey, d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const phi = Math.acos(Math.min(1, Math.max(-1, (d * d + er * er - hr * hr) / (2 * d * er))));
  const a1 = base + phi, a2 = base - phi + Math.PI * 2;
  const p1 = [ex + er * Math.cos(a1), ey + er * Math.sin(a1)];
  const p2 = [ex + er * Math.cos(a2), ey + er * Math.sin(a2)];
  const large = a2 - a1 > Math.PI ? 1 : 0;
  return `M${n(p1[0])} ${n(p1[1])}A${er} ${er} 0 ${large} 1 ${n(p2[0])} ${n(p2[1])}`;
}

export function spiralD(cx, cy, turns = 2.6, r0 = 2, r1 = 38) {
  const pts = [], steps = 90;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts, false);
}

export function face(cx, cy, sz, c = 'M', { cheeks = true, mouth = 'smile', eye = 'dot' } = {}) {
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

export const rays = (cx, cy, r0, r1, k, c = 'M', w = 4.5, rot = 0) => {
  const out = [];
  for (let i = 0; i < k; i++) {
    const a = rot + (i * Math.PI * 2) / k;
    out.push(s(`M${n(cx + r0 * Math.cos(a))} ${n(cy + r0 * Math.sin(a))}L${n(cx + r1 * Math.cos(a))} ${n(cy + r1 * Math.sin(a))}`, c, w));
  }
  return out;
};

export function petalD(cx, cy, r0, L, w, ang) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const P = (x, y) => `${n(cx + x * c - y * sn)} ${n(cy + x * sn + y * c)}`;
  const m = r0 + (L - r0) * 0.3;
  return `M${P(r0, 0)}C${P(m, -w)} ${P(L, -w * 0.6)} ${P(L, 0)}C${P(L, w * 0.6)} ${P(m, w)} ${P(r0, 0)}Z`;
}
export function notchPetalD(cx, cy, r0, L, w, ang) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const P = (x, y) => `${n(cx + x * c - y * sn)} ${n(cy + x * sn + y * c)}`;
  return `M${P(r0, 0)}C${P(r0 + (L - r0) * 0.35, -w)} ${P(L * 0.97, -w)} ${P(L, -w * 0.38)}L${P(L * 0.9, 0)}L${P(L, w * 0.38)}` +
    `C${P(L * 0.97, w)} ${P(r0 + (L - r0) * 0.35, w)} ${P(r0, 0)}Z`;
}
// 軟角星：每隻角兩側用往外鼓的 Q 曲線，角長可不一（手撕閃光感）
export function softStar(cx, cy, radii, ri, rot = -Math.PI / 2) {
  const k = radii.length, h = Math.PI / k, at = (r, a) => `${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`;
  let d = '';
  radii.forEach((r, i) => {
    const a = rot + i * 2 * h;
    if (!i) d += `M${at(ri, a - h)}`;
    d += `Q${at(ri * 1.35, a - h * 0.45)} ${at(r, a)}Q${at(ri * 1.35, a + h * 0.45)} ${at(ri, a + h)}`;
  });
  return d + 'Z';
}
export function ringOf(cx, cy, k, dist, r) {
  let d = '';
  for (let i = 0; i < k; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / k; d += circ(cx + dist * Math.cos(a), cy + dist * Math.sin(a), r); }
  return d;
}

export const CREAM = '#fffaf2', CR_LINE = '#e6abb4', KT_LINE = '#3d3332';
