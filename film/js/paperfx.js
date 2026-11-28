// FilmDoodle — 色鉛筆塗滿的紙（相框底色、星星月亮用）
// 和 print.js 的色鉛筆筆刷同一種做法：很多短短的斜向筆觸＋零星沒塗到的紙紋。

const mix = (a, b, t) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((A >> s) & 255) + (((B >> s) & 255) - ((A >> s) & 255)) * t));
  return `rgb(${c.join(',')})`;
};
const cache = new Map();
function hatch(color, angle) {
  const key = color + angle;
  if (cache.has(key)) return cache.get(key);
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  let s = Math.round(angle * 1000) + 99;
  const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < 1100; i++) {
    const x = r() * S, y = r() * S, len = 6 + r() * 16, a = angle + (r() - 0.5) * 0.3;
    ctx.globalAlpha = 0.3 + r() * 0.55;
    ctx.lineWidth = 0.7 + r() * 1.2;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len); ctx.stroke();
    }
  }
  cache.set(key, c);
  return c;
}
function style(ctx, color, angle, cell, seed) {
  const p = ctx.createPattern(hatch(color, angle), 'repeat');
  if (p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().translate((seed * 29) % 128, (seed * 13) % 128).scale(cell));
  return p;
}
export function pencilPaper(ctx, W, H, color, seed = 1) {
  const cell = Math.max(0.6, Math.min(W, H) / 700);
  ctx.save();
  ctx.fillStyle = mix(color, '#f4eedf', 0.25);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = style(ctx, color, -0.7, cell, seed);
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = style(ctx, mix(color, '#2b2320', 0.15), -0.3, cell * 1.1, seed + 9);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
export function pencilFill(ctx, path, color, cell, seed = 1) {
  ctx.save();
  ctx.fillStyle = style(ctx, color, -0.7, cell, seed);
  ctx.fill(path);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = style(ctx, color, -0.25, cell, seed + 3);
  ctx.fill(path);
  ctx.restore();
}
