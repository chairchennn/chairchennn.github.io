// FilmDoodle — 四格拍貼
// 版面以「單位」計算（直條寬 600、方格寬 1000），畫的時候乘上倍率 k。
// 每一格放一張照片（各自套底片色調），外面是可以換樣式的相紙。

import { rng, makeCanvas } from './film.js';

export const FOUR_LAYOUTS = [['strip', '直條'], ['grid', '2×2']];

export const PAPERS = [
  { id: 'white', name: '白色', swatch: '#ffffff' },
  { id: 'black', name: '黑色', swatch: '#1c1b22' },
  { id: 'pink', name: '粉紅', swatch: '#ffc9de' },
  { id: 'lilac', name: '丁香紫', swatch: '#dccbff' },
  { id: 'mint', name: '薄荷', swatch: '#c6f1df' },
  { id: 'sky', name: '天空藍', swatch: '#cbe6ff' },
  { id: 'holo', name: '彩虹光', swatch: 'linear-gradient(135deg,#ffc9e6,#d9c8ff,#bfe9ff,#c9f7e1)' },
  { id: 'check', name: '格子', swatch: 'repeating-conic-gradient(#ff9cc8 0 25%,#fff 0 50%) 0 0/12px 12px' },
  { id: 'dots', name: '點點', swatch: 'radial-gradient(#fff 28%,transparent 30%) 0 0/9px 9px,#ffb3d1' },
  { id: 'stars', name: '星星', swatch: '#b9a2ff' },
  { id: 'grid', name: '方格紙', swatch: 'linear-gradient(#9cc9ff 1px,transparent 1px) 0 0/8px 8px,linear-gradient(90deg,#9cc9ff 1px,#fff 1px) 0 0/8px 8px' },
  { id: 'film', name: '底片', swatch: '#121115' },
];

// 版面（單位）：cells = 4 個照片格，foot = 底部留白
export function fourLayout(layout) {
  if (layout === 'grid') {
    const W = 1000, m = 44, gap = 22, cw = (W - m * 2 - gap) / 2, ch = (cw * 4) / 3, foot = 150;
    const cells = [0, 1, 2, 3].map((i) => ({ x: m + (i % 2) * (cw + gap), y: m + Math.floor(i / 2) * (ch + gap), w: cw, h: ch }));
    return { W, H: m + ch * 2 + gap + foot, cells, foot: { x: 0, y: m + ch * 2 + gap, w: W, h: foot }, aspect: 3 / 4 };
  }
  const W = 600, m = 36, gap = 20, cw = W - m * 2, ch = (cw * 3) / 4, foot = 140;
  const cells = [0, 1, 2, 3].map((i) => ({ x: m, y: m + i * (ch + gap), w: cw, h: ch }));
  return { W, H: m + ch * 4 + gap * 3 + foot, cells, foot: { x: 0, y: m + ch * 4 + gap * 3, w: W, h: foot }, aspect: 4 / 3 };
}

const isDark = (id) => id === 'black' || id === 'film';

function sparkle(ctx, x, y, r) {
  const q = r * 0.18;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + q, y - q, x + r, y);
  ctx.quadraticCurveTo(x + q, y + q, x, y + r);
  ctx.quadraticCurveTo(x - q, y + q, x - r, y);
  ctx.quadraticCurveTo(x - q, y - q, x, y - r);
  ctx.fill();
}

// 相紙底色與花樣（畫在照片下面）
export function drawPaper(ctx, L, paper, k) {
  const W = L.W * k, H = L.H * k, p = PAPERS.find((x) => x.id === paper) || PAPERS[0];
  ctx.save();
  switch (paper) {
    case 'holo': {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#ffc9e6'); g.addColorStop(0.35, '#d9c8ff'); g.addColorStop(0.65, '#bfe9ff'); g.addColorStop(1, '#c9f7e1');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const r1 = ctx.createRadialGradient(W * 0.2, H * 0.15, 0, W * 0.2, H * 0.15, W * 0.7);
      r1.addColorStop(0, 'rgba(255,255,255,.55)'); r1.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'check': {
      const sz = 30 * k;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff9cc8';
      for (let y = 0; y < H; y += sz) for (let x = ((y / sz) % 2) * sz; x < W; x += sz * 2) ctx.fillRect(x, y, sz, sz);
      break;
    }
    case 'dots': {
      ctx.fillStyle = '#ffb3d1'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      const sp = 26 * k;
      for (let y = sp / 2, row = 0; y < H; y += sp, row++) for (let x = sp / 2 + (row % 2) * (sp / 2); x < W; x += sp) { ctx.beginPath(); ctx.arc(x, y, 6 * k, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'stars': {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#b9a2ff'); g.addColorStop(1, '#ffb3dc');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const r = rng(77);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = r() < 0.7 ? 'rgba(255,255,255,.9)' : '#fff3a6';
        sparkle(ctx, r() * W, r() * H, (4 + r() * 9) * k);
      }
      break;
    }
    case 'grid': {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(120,170,255,.45)'; ctx.lineWidth = Math.max(1, k);
      const sp = 22 * k;
      ctx.beginPath();
      for (let x = 0; x <= W; x += sp) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += sp) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      break;
    }
    default:
      ctx.fillStyle = paper === 'film' ? '#121115' : p.swatch;
      ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// 相紙上面的裝飾：照片細邊、底片齒孔、底部小星星
export function drawPaperFront(ctx, L, paper, k) {
  const dark = isDark(paper);
  ctx.save();
  ctx.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)';
  ctx.lineWidth = Math.max(1, 1.5 * k);
  for (const c of L.cells) ctx.strokeRect(c.x * k, c.y * k, c.w * k, c.h * k);
  if (paper === 'film') {
    ctx.fillStyle = '#f2ede3';
    const hw = 10 * k, hh = 14 * k, pitch = 30 * k, inset = (L.cells[0].x * k - hw) / 2;
    for (let y = 12 * k; y < L.H * k - hh; y += pitch) {
      for (const x of [inset, L.W * k - inset - hw]) {
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, hw, hh, 2.5 * k) : ctx.rect(x, y, hw, hh);
        ctx.fill();
      }
    }
  }
  // 底部三顆小星星（不放文字）
  const f = L.foot, cx = (f.x + f.w / 2) * k, cy = (f.y + f.h * 0.46) * k;
  ctx.fillStyle = dark ? '#ffd6ec' : paper === 'holo' || paper === 'stars' ? '#ffffff' : '#ff7fb6';
  sparkle(ctx, cx, cy, 13 * k);
  sparkle(ctx, cx - 30 * k, cy + 6 * k, 7 * k);
  sparkle(ctx, cx + 30 * k, cy + 6 * k, 7 * k);
  ctx.restore();
}

// 把一張照片裁成格子的比例（置中），回傳裁切框
export function cellCrop(src, aspect) {
  const sa = src.width / src.height;
  if (sa > aspect) { const w = src.height * aspect; return { x: (src.width - w) / 2, y: 0, w, h: src.height }; }
  const h = src.width / aspect;
  return { x: 0, y: (src.height - h) / 2, w: src.width, h };
}

export { makeCanvas };
