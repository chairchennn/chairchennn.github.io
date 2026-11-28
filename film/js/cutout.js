// FilmDoodle — 剪下（像真的用剪刀把照片沿著主體剪下來）
// 手指描的一圈 → 平滑 → 往外留白紙邊 → 白邊的外緣是剪刀剪的「短直線＋折角」。
// 形狀用照片的 0~1 座標存，預覽和匯出用同一組點，所以一模一樣。

const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 7; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; };

export const MARGINS = [['none', '無'], ['thin', '細'], ['wide', '寬']];
const MARGIN_K = { none: 0, thin: 0.018, wide: 0.04 }; // 白邊寬度（照片短邊的比例）

// 多邊形面積（正負表示方向）
export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return a / 2;
}

// 手描的點 → 閉合、平滑（Chaikin 兩次）、平均間距重新取點
export function smoothLoop(raw, step = 0.012) {
  let pts = raw.filter((p, i) => !i || Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]) > 0.002);
  if (pts.length < 6) return null;
  for (let it = 0; it < 2; it++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    pts = out;
  }
  // 重新取點
  let per = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const n = Math.max(24, Math.min(240, Math.round(per / step)));
  const res = [];
  let seg = 0, acc = 0, d = per / n;
  for (let k = 0, target = 0; k < n; k++, target += d) {
    while (seg < pts.length) {
      const a = pts[seg], b = pts[(seg + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc + l >= target) { const t = l ? (target - acc) / l : 0; res.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); break; }
      acc += l; seg++;
    }
  }
  if (polyArea(res) < 0) res.reverse(); // 統一方向（螢幕座標順時針）
  return res;
}

// 往外推 dist（照片像素座標），再做成剪刀剪的邊：每隔一段一刀直線，刀與刀之間有小折角、寬窄不一
function offsetPoly(pts, dist) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(i - 1 + n) % n], q = pts[(i + 1) % n];
    let nx = q[1] - p[1], ny = -(q[0] - p[0]);
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    out.push([pts[i][0] + nx * dist, pts[i][1] + ny * dist]);
  }
  return out;
}
function scissorEdge(pts, cutLen, wobble, seed) {
  const r = rng(seed), out = [];
  let acc = cutLen * r();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc >= cutLen * (0.6 + r() * 0.8)) { acc = 0; out.push([a[0] + (r() - 0.5) * wobble, a[1] + (r() - 0.5) * wobble]); }
  }
  return out.length >= 8 ? out : pts;
}

// 依照片大小（w×h 像素）算出兩條路徑：照片的剪形 inner、白紙邊外緣 outer
export function cutPaths(cut, w, h) {
  const S = Math.min(w, h);
  const inner = cut.pts.map(([x, y]) => [x * w, y * h]);
  const m = (MARGIN_K[cut.margin] ?? 0) * S;
  const base = m ? offsetPoly(inner, m * (0.8 + rng(cut.seed + 3)() * 0.4)) : inner;
  const outer = scissorEdge(base, S * 0.035, S * (m ? 0.006 : 0.004), cut.seed || 1);
  return { inner: m ? inner : outer, outer, margin: m };
}
const toPath = (pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };

// 把剪好的照片畫在 (x, y)：白紙邊＋紙的影子＋照片
export function drawCutPhoto(ctx, photo, x, y, w, h, cut) {
  const { inner, outer, margin } = cutPaths(cut, w, h), S = Math.min(w, h);
  ctx.save();
  ctx.translate(x, y);
  const op = toPath(outer);
  ctx.shadowColor = 'rgba(60,40,30,.28)';
  ctx.shadowBlur = S * 0.02;
  ctx.shadowOffsetY = S * 0.007;
  ctx.fillStyle = margin ? '#fffdf6' : '#000';
  ctx.fill(op);
  ctx.shadowColor = 'transparent';
  ctx.save();
  ctx.clip(toPath(inner));
  ctx.drawImage(photo, 0, 0, w, h);
  ctx.restore();
  ctx.restore();
}

// 做成貼圖：只留剪下來的部分（含白邊），四周透明
export function makeCutSticker(photo, cut, maxSide = 1200) {
  const w = photo.width, h = photo.height, { outer } = cutPaths(cut, w, h);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of outer) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pad = Math.min(w, h) * 0.03;
  x0 = Math.max(-pad, x0 - pad); y0 = Math.max(-pad, y0 - pad);
  const bw = x1 + pad - x0, bh = y1 + pad - y0, k = Math.min(1, maxSide / Math.max(bw, bh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bw * k)); c.height = Math.max(1, Math.round(bh * k));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(k, k);
  drawCutPhoto(ctx, photo, -x0, -y0, w, h, cut);
  return c;
}

// 預覽用：把形狀外面壓暗，畫出白邊
export function drawCutPreview(ctx, w, h, cut) {
  const { inner, outer, margin } = cutPaths(cut, w, h);
  ctx.save();
  const dim = new Path2D();
  dim.rect(0, 0, w, h);
  dim.addPath(toPath(outer));
  ctx.fillStyle = 'rgba(40,30,25,.55)';
  ctx.fill(dim, 'evenodd');
  if (margin) {
    const ring = toPath(outer);
    ring.addPath(toPath(inner));
    ctx.fillStyle = '#fffdf6';
    ctx.fill(ring, 'evenodd');
  }
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.5;
  ctx.stroke(toPath(outer));
  ctx.restore();
}

// 透明背景的圖（去背 PNG）就不用剪
export function hasTransparency(c) {
  const t = document.createElement('canvas'), s = 64;
  t.width = s; t.height = s;
  const x = t.getContext('2d');
  x.drawImage(c, 0, 0, s, s);
  const d = x.getImageData(0, 0, s, s).data;
  let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 200) clear++;
  return clear > s * s * 0.03;
}
