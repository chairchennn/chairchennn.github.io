// FilmDoodle — 底片邊框
// 尺寸參考實體規格：35mm 底片寬 35mm、畫面 36×24、齒孔間距 4.75mm；
// 拍立得相紙 88×107、畫面 79×79；迷你相紙 54×86 / 畫面 46×62；
// 方形相紙 72×86 / 62×62；寬幅相紙 108×86 / 99×62；幻燈片框 50×50 / 開窗 36×24。

import { rng, makeCanvas } from './film.js';
import { drawPaper } from './fourcut.js';
import { pencilPaper, pencilFill } from './paperfx.js';

export const FRAMES = [
  { id: 'none', name: '無邊框' },
  { id: 'white', name: '白邊相紙', colors: true, caption: true },
  { id: 'film35', name: '35mm 黑邊', filmNo: true },
  { id: 'film35neg', name: '35mm 負片', filmNo: true },
  { id: 'filed', name: '粗糙黑邊' },
  { id: 'film120', name: '120 中片幅', filmNo: true },
  { id: 'slide', name: '幻燈片框', colors: ['#f4f1ea', '#e3d4b4', '#2a2826', '#f7c9d6', '#bfe3f0'], caption: true },
  { id: 'polaroid', name: '拍立得', colors: true, caption: true },
  { id: 'mini', name: '迷你相紙', colors: true, caption: true },
  { id: 'square', name: '方形相紙', colors: true, caption: true },
  { id: 'wide', name: '寬幅相紙', colors: true, caption: true },
  { id: 'paper', name: '手帳紙', paper: true },
  // 復古繪本風：彩色鉛筆塗的紙、拱形窗、上方是夜空（星星集中在天空，不繞一圈）
  { id: 'archnight', name: '夜空拱窗', colors: ['#a99bc5', '#a6b58a', '#9cb9d0', '#655047', '#cb8875'], colorKey: 'archColor' },
];

export const FRAME_COLORS = ['#fbfaf6', '#f3ead8', '#1e1d1c', '#f9cdd9', '#c7e6f5', '#cdeedd', '#fde59a', '#d9ccf5'];

const BRAND = 'FILMDOODLE';
const EDGE_FONT = '"Helvetica Neue", Arial, sans-serif';
const HAND_FONT = '"Caveat", "LXGW WenKai TC", cursive';

// 需要的畫面比例（寬/高），null = 保留原比例
// ratio：使用者用剪刀選的比例（長邊／短邊，0 = 原比例），只用在沒有固定比例的相框
export const FREE_RATIO_FRAMES = new Set(['none', 'white', 'filed', 'paper', 'archnight']);
export function cropAspect(id, w, h, ratio = 0) {
  const land = w >= h;
  switch (id) {
    case 'film35': case 'film35neg': case 'slide': return land ? 3 / 2 : 2 / 3;
    case 'film120': case 'polaroid': case 'square': return 1;
    case 'mini': return 46 / 62;
    case 'wide': return 99 / 62;
    default: return ratio ? (land ? ratio : 1 / ratio) : null;
  }
}

export function computeCrop(srcW, srcH, aspect, pos = 0.5) {
  if (!aspect) return { x: 0, y: 0, w: srcW, h: srcH, axis: null };
  const srcA = srcW / srcH;
  if (Math.abs(srcA - aspect) < 0.005) return { x: 0, y: 0, w: srcW, h: srcH, axis: null };
  if (srcA > aspect) {
    const w = srcH * aspect;
    return { x: (srcW - w) * pos, y: 0, w, h: srcH, axis: 'x' };
  }
  const h = srcW / aspect;
  return { x: 0, y: (srcH - h) * pos, w: srcW, h, axis: 'y' };
}

const hasCaption = (o) => !!(o.caption && o.caption.trim());

// 版面：photo 在輸出畫布中的位置（x,y,pw,ph）與畫布大小（W,H）
export function layoutFrame(id, pw, ph, o = {}) {
  const S = Math.min(pw, ph);
  switch (id) {
    case 'white': {
      const b = S * 0.055, bb = hasCaption(o) ? b * 2.8 : b;
      return { W: pw + 2 * b, H: ph + b + bb, x: b, y: b, pw, ph, b, bb };
    }
    case 'film35': case 'film35neg': {
      const portrait = ph > pw;
      const lw = portrait ? ph : pw, lh = portrait ? pw : ph; // 橫向座標
      const u = lh / 24, side = 6 * u, rebate = 5.5 * u;
      const LW = lw + side * 2, LH = lh + rebate * 2;
      return portrait
        ? { W: LH, H: LW, x: rebate, y: side, pw, ph, u, portrait, LW, LH, side, rebate }
        : { W: LW, H: LH, x: side, y: rebate, pw, ph, u, portrait, LW, LH, side, rebate };
    }
    case 'filed': {
      const b = S * 0.07;
      return { W: pw + 2 * b, H: ph + 2 * b, x: b, y: b, pw, ph, b };
    }
    case 'film120': {
      const u = pw / 56, sx = 3.2 * u, sy = 3.6 * u;
      return { W: pw + 2 * sx, H: ph + 2 * sy, x: sx, y: sy, pw, ph, u };
    }
    case 'slide': {
      const land = pw >= ph, u = (land ? pw : ph) / 35;
      const M = 50 * u;
      return { W: M, H: M, x: (M - pw) / 2, y: (M - ph) / 2, pw, ph, u };
    }
    case 'polaroid': {
      const u = pw / 79;
      return { W: 88 * u, H: 107 * u, x: 4.5 * u, y: 5.5 * u, pw, ph, u };
    }
    case 'mini': {
      const u = pw / 46;
      return { W: 54 * u, H: 86 * u, x: 4 * u, y: 7 * u, pw, ph, u };
    }
    case 'square': {
      const u = pw / 62;
      return { W: 72 * u, H: 86 * u, x: 5 * u, y: 7 * u, pw, ph, u };
    }
    case 'wide': {
      const u = pw / 99;
      return { W: 108 * u, H: 86 * u, x: 4.5 * u, y: 7 * u, pw, ph, u };
    }
    case 'archnight': {
      const m = S * 0.1;
      return { W: pw + 2 * m, H: ph + m * 3.2, x: m, y: m * 2.1, pw, ph, m, ar: Math.min(pw / 2, ph * 0.42) };
    }
    case 'paper': {
      // 手帳紙：照片像印出來貼在紙上（白色細邊），下方留多一點
      const m = S * 0.09, mat = S * 0.018;
      return { W: pw + 2 * m, H: ph + m * 2.3, x: m, y: m, pw, ph, mat };
    }
    default:
      return { W: pw, H: ph, x: 0, y: 0, pw, ph };
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

let paperTile = null;
function paperTexture() {
  if (paperTile) return paperTile;
  const S = 160, c = makeCanvas(S, S), ctx = c.getContext('2d');
  const id = ctx.createImageData(S, S), d = id.data, r = rng(4242);
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (r() - 0.5) * 60;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  paperTile = c;
  return c;
}

function fillPaper(ctx, W, H, color, scale) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.35;
  const k = Math.max(0.5, scale);
  ctx.scale(k, k);
  ctx.fillStyle = ctx.createPattern(paperTexture(), 'repeat');
  ctx.fillRect(0, 0, W / k + 1, H / k + 1);
  ctx.restore();
}

const isDark = (hex) => {
  const v = parseInt(hex.replace('#', ''), 16);
  return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255) < 110;
};

function drawCaption(ctx, text, cx, cy, size, color, maxW) {
  if (!text) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fs = size;
  ctx.font = `700 ${fs}px ${HAND_FONT}`;
  while (ctx.measureText(text).width > maxW && fs > size * 0.4) { fs *= 0.92; ctx.font = `700 ${fs}px ${HAND_FONT}`; }
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

// 底片邊緣文字的 DX 條碼
function dxCode(ctx, x, y, w, h, seed) {
  const r = rng(seed), n = 22, bw = w / n;
  for (let i = 0; i < n; i++) if (i === 0 || i === n - 1 || r() > 0.45) ctx.fillRect(x + i * bw, y + (i % 2 ? h * 0.5 : 0), bw * 0.72, i % 2 ? h * 0.5 : h);
}

// ---------- 畫在照片「下面」的部分 ----------
export function drawFrameBack(ctx, L, id, o = {}) {
  const { W, H } = L;
  const color = o.color || FRAME_COLORS[0];
  switch (id) {
    case 'white': case 'polaroid': case 'mini': case 'square': case 'wide':
      fillPaper(ctx, W, H, color, Math.min(W, H) / 900);
      break;
    case 'slide':
      fillPaper(ctx, W, H, o.slideColor || '#f4f1ea', Math.min(W, H) / 900);
      break;
    case 'film35': case 'film35neg': case 'filed': case 'film120':
      ctx.fillStyle = id === 'film35neg' ? '#c4692f' : '#0e0d0c';
      ctx.fillRect(0, 0, W, H);
      break;
    case 'archnight':
      pencilPaper(ctx, W, H, o.archColor || '#a99bc5', o.seed || 7);
      break;
    case 'paper': {
      drawPaper(ctx, { W, H }, o.paper || 'dots', Math.min(W, H) / 640);
      if (o.cut) break; // 剪成形狀的照片自己畫白邊（見 cutout.js）
      const { x, y, pw, ph, mat } = L;
      ctx.save();
      ctx.shadowColor = 'rgba(60,40,30,.22)';
      ctx.shadowBlur = mat * 1.6;
      ctx.shadowOffsetY = mat * 0.45;
      ctx.fillStyle = '#fffdf8';
      ctx.fillRect(x - mat, y - mat, pw + mat * 2, ph + mat * 2);
      ctx.restore();
      break;
    }
  }
}

// 照片要不要裁成圓角（幻燈片、120）
function archPath(x, y, w, h, r) {
  const p = new Path2D();
  p.moveTo(x, y + h);
  p.lineTo(x, y + r);
  p.ellipse(x + w / 2, y + r, w / 2, r, 0, Math.PI, Math.PI * 2);
  p.lineTo(x + w, y + h);
  p.closePath();
  return p;
}
export function photoClip(ctx, L, id) {
  if (id === 'archnight') { ctx.clip(archPath(L.x, L.y, L.pw, L.ph, L.ar)); return true; }
  if (id === 'slide' || id === 'film120') {
    const r = (id === 'slide' ? 1.1 : 0.9) * L.u;
    ctx.beginPath();
    roundRect(ctx, L.x, L.y, L.pw, L.ph, r);
    ctx.clip();
    return true;
  }
  return false;
}

// ---------- 畫在照片「上面」的部分 ----------
// 四角閃光星（不是一圈平均分布：集中在上方的天空）
function sparkPath(cx, cy, r) {
  const p = new Path2D(), q = r * 0.2;
  p.moveTo(cx, cy - r);
  p.quadraticCurveTo(cx + q, cy - q, cx + r, cy);
  p.quadraticCurveTo(cx + q, cy + q, cx, cy + r);
  p.quadraticCurveTo(cx - q, cy + q, cx - r, cy);
  p.quadraticCurveTo(cx - q, cy - q, cx, cy - r);
  return p;
}
// 八角星（參考圖的技法：奶油色、稚拙、大小不一）
function star8Path(cx, cy, r) {
  const p = new Path2D();
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 8, rr = i % 2 ? r * 0.45 : r * (0.9 + ((i * 37) % 7) * 0.03);
    i ? p.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : p.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  p.closePath();
  return p;
}
function drawArchNight(ctx, L, o) {
  const { W, x, y, pw, ph, ar, m } = L, S = Math.min(pw, ph), cell = Math.max(0.6, S / 700);
  const dark = (o.archColor || '#a99bc5') === '#655047';
  const cream = '#f4eedf', butter = '#e9d79a';
  // 窗框：一圈奶油色的鉛筆線
  ctx.save();
  ctx.strokeStyle = cream;
  ctx.globalAlpha = dark ? 0.85 : 0.75;
  ctx.lineWidth = Math.max(1, S * 0.006);
  const g = S * 0.018;
  ctx.stroke(archPath(x - g, y - g, pw + g * 2, ph + g * 2, ar + g));
  ctx.restore();
  // 天空：星星、小點、一彎月亮，集中在窗頂上方與上半部兩側
  const r = rng((o.seed || 7) * 31 + 5), sky = [];
  const n = 11;
  for (let i = 0; i < n * 6 && sky.length < n; i++) {
    const sx = r() * W, sy = r() * (y + ph * 0.45);
    const inWin = sx > x - g * 2 && sx < x + pw + g * 2 && sy > y + ar * 0.15 - g * 2;
    const nearArch = sy < y + ar && sx > x && sx < x + pw && Math.hypot((sx - x - pw / 2) / (pw / 2), (sy - y - ar) / ar) < 1.12;
    if (inWin || nearArch) continue;
    if (sky.some((s) => Math.hypot(s[0] - sx, s[1] - sy) < m * 0.75)) continue;
    sky.push([sx, sy, r()]);
  }
  sky.forEach(([sx, sy, t], i) => {
    if (i === 0) { // 月亮
      const R = m * 0.55, p = new Path2D();
      p.arc(sx, sy, R, 0, Math.PI * 2);
      p.arc(sx + R * 0.45, sy - R * 0.2, R * 0.85, 0, Math.PI * 2, true);
      pencilFill(ctx, p, butter, cell, 3);
    } else if (t < 0.55) {
      pencilFill(ctx, star8Path(sx, sy, m * (0.3 + t * 0.45)), t < 0.25 ? butter : cream, cell, i);
    } else if (t < 0.8) {
      pencilFill(ctx, sparkPath(sx, sy, m * (0.22 + (t - 0.55) * 0.8)), cream, cell, i);
    } else {
      const p = new Path2D(); p.arc(sx, sy, m * 0.06, 0, Math.PI * 2);
      pencilFill(ctx, p, cream, cell, i);
    }
  });
}
export function drawFrameFront(ctx, L, id, o = {}) {
  const { W, H, x, y, pw, ph } = L;
  const no = o.filmNo || 12, seed = o.seed || 7;
  if (id === 'archnight') { drawArchNight(ctx, L, o); return; }
  switch (id) {
    case 'white': case 'polaroid': case 'mini': case 'square': case 'wide': {
      // 相紙邊緣一點點陰影，讓照片像是嵌在裡面
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = Math.max(1, Math.min(pw, ph) * 0.003);
      ctx.strokeRect(x, y, pw, ph);
      ctx.restore();
      const color = o.color || FRAME_COLORS[0];
      const ink = isDark(color) ? '#f5f1ea' : '#2b2622';
      if (id === 'white') {
        if (hasCaption(o)) drawCaption(ctx, o.caption, W / 2, y + ph + (H - y - ph) / 2, L.b * 1.25, ink, W * 0.86);
      } else {
        const bottom = H - y - ph;
        drawCaption(ctx, o.caption, W / 2, y + ph + bottom * 0.48, L.u * (id === 'polaroid' ? 7.5 : 6.2), ink, W * 0.84);
      }
      break;
    }
    case 'film35': case 'film35neg':
      draw35(ctx, L, id === 'film35neg', no, seed);
      break;
    case 'filed':
      drawFiled(ctx, L, seed);
      break;
    case 'film120':
      draw120(ctx, L, no, seed);
      break;
    case 'slide':
      drawSlide(ctx, L, o);
      break;
  }
}

function draw35(ctx, L, neg, no, seed) {
  const { u, LW, LH, side, rebate, portrait } = L;
  const base = neg ? '#c4692f' : '#0e0d0c';
  const neighbor = neg ? '#a9561f' : '#1b1917';
  const hole = '#f2ede3';
  const ink = neg ? 'rgba(60,22,4,0.92)' : '#f39a3a';
  ctx.save();
  if (portrait) { ctx.translate(L.W, 0); ctx.rotate(Math.PI / 2); }
  // 相鄰的前後格
  const gap = 2 * u;
  ctx.fillStyle = neighbor;
  ctx.fillRect(0, rebate, side - gap, LH - rebate * 2);
  ctx.fillRect(LW - side + gap, rebate, side - gap, LH - rebate * 2);
  // 齒孔
  const pitch = 4.75 * u, hw = 2.8 * u, hh = 1.98 * u, r = 0.5 * u, cx = LW / 2;
  ctx.fillStyle = hole;
  ctx.beginPath();
  for (let k = -Math.ceil(LW / pitch); k <= Math.ceil(LW / pitch); k++) {
    const hx = cx + (k + 0.5) * pitch - hw / 2;
    if (hx + hw < 0 || hx > LW) continue;
    roundRect(ctx, hx, 2.0 * u, hw, hh, r);
    roundRect(ctx, hx, LH - 2.0 * u - hh, hw, hh, r);
  }
  ctx.fill();
  // 邊緣文字
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  const fs = 0.98 * u, ty = 1.0 * u, by = LH - 1.0 * u;
  ctx.font = `600 ${fs}px ${EDGE_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${BRAND} 400`, side + 2 * u, ty);
  ctx.fillText(`${BRAND} 400`, side + LW * 0.55, ty);
  ctx.textAlign = 'center';
  ctx.fillText(`${no}`, side * 0.5, ty);
  ctx.fillText(`${no + 1}`, LW - side * 0.5, ty);
  ctx.fillText(`▶ ${no}A`, LW * 0.32, by);
  ctx.fillText(`${no}`, LW * 0.72, by);
  ctx.fillText(`▶ ${no + 1}`, LW - side * 0.4, by);
  dxCode(ctx, LW * 0.44, by - 0.55 * u, 9 * u, 1.1 * u, seed + no);
  ctx.restore();
}

function draw120(ctx, L, no, seed) {
  const { W, H, u, x, y, pw, ph } = L;
  ctx.save();
  // 圓角片門的內陰影
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 0.35 * u;
  ctx.beginPath(); roundRect(ctx, x, y, pw, ph, 0.9 * u); ctx.stroke();
  ctx.fillStyle = '#f39a3a';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${1.5 * u}px ${EDGE_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${BRAND} 160`, x + 2 * u, y / 2);
  ctx.textAlign = 'right';
  ctx.fillText(`${no}`, x + pw - 2 * u, y / 2);
  ctx.textAlign = 'center';
  ctx.fillText(`◀ ${no}`, W * 0.3, H - y / 2);
  ctx.fillText(`${BRAND}`, W * 0.7, H - y / 2);
  ctx.restore();
}

function drawFiled(ctx, L, seed) {
  const { W, H, x, y, pw, ph } = L, S = Math.min(pw, ph), r = rng(seed * 31 + 5);
  const jag = S * 0.012, pts = [];
  const edge = (x0, y0, x1, y1, nx, ny) => {
    const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(12, Math.round(len / (S * 0.012)));
    let drift = 0;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      drift = drift * 0.7 + (r() - 0.35) * 0.6;
      const bump = r() < 0.04 ? r() * 2.2 : 0;
      const d = jag * (0.4 + Math.max(0, drift) + bump);
      pts.push([x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d]);
    }
  };
  edge(x, y, x + pw, y, 0, 1);
  edge(x + pw, y, x + pw, y + ph, -1, 0);
  edge(x + pw, y + ph, x, y + ph, 0, -1);
  edge(x, y + ph, x, y, 1, 0);
  ctx.save();
  ctx.fillStyle = '#0e0d0c';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fill('evenodd');
  // 邊緣一點點漏光的柔邊
  ctx.strokeStyle = 'rgba(14,13,12,0.5)';
  ctx.lineWidth = jag * 0.8;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#f39a3a';
  ctx.font = `700 ${L.b * 0.32}px ${EDGE_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(`${BRAND} 400   ▶ 24A`, x + S * 0.02, y / 2);
  ctx.restore();
}

function drawSlide(ctx, L, o) {
  const { W, H, u, x, y, pw, ph } = L;
  const mount = o.slideColor || '#f4f1ea';
  const ink = isDark(mount) ? 'rgba(255,255,255,0.7)' : 'rgba(70,62,52,0.78)';
  ctx.save();
  // 外框的壓紋
  ctx.strokeStyle = isDark(mount) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 0.4 * u;
  ctx.strokeRect(1.6 * u, 1.6 * u, W - 3.2 * u, H - 3.2 * u);
  // 開窗內陰影
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.5 * u;
  ctx.beginPath(); roundRect(ctx, x, y, pw, ph, 1.1 * u); ctx.stroke();
  ctx.strokeStyle = isDark(mount) ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.3 * u;
  ctx.beginPath(); roundRect(ctx, x - 0.6 * u, y - 0.6 * u, pw + 1.2 * u, ph + 1.2 * u, 1.6 * u); ctx.stroke();
  // 文字
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${2.3 * u}px ${EDGE_FONT}`;
  ctx.fillText(BRAND.split('').join(' '), W / 2, y / 2);
  const cap = (o.caption || '').trim();
  if (cap) drawCaption(ctx, cap, W / 2, y + ph + (H - y - ph) / 2, 4.2 * u, ink, W * 0.84);
  else {
    ctx.font = `600 ${1.9 * u}px ${EDGE_FONT}`;
    ctx.fillText(o.dateText || '', W / 2, y + ph + (H - y - ph) / 2);
  }
  ctx.font = `700 ${2 * u}px ${EDGE_FONT}`;
  ctx.fillText(String(o.filmNo || 12), x / 2, H / 2);
  ctx.restore();
}
