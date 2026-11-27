// FilmDoodle — 照片在框裡的位置、縮放與角度
// t = { x, y: 0~1 取景位置；zoom ≥ 1；angle 度（-45~45）；r90 轉了幾次 90° }
// 規則：照片永遠蓋滿整個框（不會露出空白），轉角度時自動放大到剛好蓋滿。

export const XF0 = () => ({ x: 0.5, y: 0.5, zoom: 1, angle: 0, r90: 0 });
export const ZOOM_MAX = 4, ANGLE_MAX = 45;
const needsXf = (t) => !!(t && ((t.angle || 0) !== 0 || (t.r90 || 0) % 4));
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function normXf(t) {
  const o = { ...XF0(), ...(t || {}) };
  o.x = clamp01(+o.x || 0); o.y = clamp01(Number.isFinite(+o.y) ? +o.y : 0.5);
  o.zoom = Math.min(ZOOM_MAX, Math.max(1, +o.zoom || 1));
  o.angle = Math.min(ANGLE_MAX, Math.max(-ANGLE_MAX, +o.angle || 0));
  o.r90 = (((Math.round(+o.r90 || 0)) % 4) + 4) % 4;
  return o;
}

// 依比例 aspect（寬／高；null = 照片原比例）在照片上取框。
// 沒有角度時回傳一般的裁切框；有角度或轉 90° 時回傳 xf，交給 drawXf 畫。
export function xfCrop(iw, ih, aspect, t) {
  t = t || XF0();
  const odd = (t.r90 || 0) % 2 === 1;
  const ew = odd ? ih : iw, eh = odd ? iw : ih;
  const a = aspect || ew / eh;
  let w, h;
  if (ew / eh > a) { h = eh; w = eh * a; } else { w = ew; h = ew / a; }
  const z = Math.max(1, t.zoom || 1);
  w /= z; h /= z;
  if (!needsXf(t)) {
    const x = (iw - w) * clamp01(t.x ?? 0.5), y = (ih - h) * clamp01(t.y ?? 0.5);
    return { x, y, w, h, axis: iw - w > 1 ? 'x' : ih - h > 1 ? 'y' : null };
  }
  return { x: 0, y: 0, w, h, xf: t };
}

function frameOf(t, w, h, iw, ih) {
  const r90 = (((t.r90 || 0) % 4) + 4) % 4;
  const ew = r90 % 2 ? ih : iw, eh = r90 % 2 ? iw : ih;
  const th = ((t.angle || 0) * Math.PI) / 180, c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
  const bw = w * c + h * s, bh = w * s + h * c;
  const S = Math.max(bw / ew, bh / eh) * Math.max(1, t.zoom || 1);
  return { r90, th, S, slackX: Math.max(0, ew * S - bw), slackY: Math.max(0, eh * S - bh) };
}

// 把照片 img 依 t 畫滿 w×h
export function drawXf(ctx, img, w, h, t) {
  const iw = img.width, ih = img.height, f = frameOf(t, w, h, iw, ih);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(f.th);
  ctx.translate((0.5 - (t.x ?? 0.5)) * f.slackX, (0.5 - (t.y ?? 0.5)) * f.slackY);
  ctx.scale(f.S, f.S);
  ctx.rotate((f.r90 * Math.PI) / 2);
  ctx.drawImage(img, -iw / 2, -ih / 2);
  ctx.restore();
}

// 手指在畫面上移動 (dx, dy)（和 w×h 同一個座標）→ 照片跟著手指走
export function xfPan(t, t0, dx, dy, w, h, iw, ih) {
  const f = frameOf(t, w, h, iw, ih), c = Math.cos(f.th), s = Math.sin(f.th);
  const ux = dx * c + dy * s, uy = -dx * s + dy * c;
  if (f.slackX > 0.5) t.x = clamp01(t0.x - ux / f.slackX);
  if (f.slackY > 0.5) t.y = clamp01(t0.y - uy / f.slackY);
}
