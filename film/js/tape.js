// FilmDoodle — 紙膠帶（程式畫的，不用圖檔）
// 一條膠帶 = 半透明底色＋花紋＋兩端撕開的鋸齒邊。寬高比約 4:1，大小以「寬」計算。

import { rng } from './film.js';

// color 是底色（使用者可以換），ink 是花紋色
export const TAPES = [
  { id: 'tp_dots', name: '粉紅點點', color: '#ffb3c9', pattern: 'dots', ink: '#ffffff' },
  { id: 'tp_hearts', name: '小愛心', color: '#ffd6df', pattern: 'hearts', ink: '#ff7f9f' },
  { id: 'tp_stripe', name: '斜條紋', color: '#bfe1ff', pattern: 'stripes', ink: '#ffffff' },
  { id: 'tp_gingham', name: '格紋', color: '#bfe8d2', pattern: 'gingham', ink: '#ffffff' },
  { id: 'tp_grid', name: '方格紙', color: '#fff6e3', pattern: 'grid', ink: '#f0a39a' },
  { id: 'tp_stars', name: '星星', color: '#d8cbff', pattern: 'stars', ink: '#fff6b0' },
  { id: 'tp_flower', name: '小花', color: '#fff0a6', pattern: 'flowers', ink: '#ff9fb8' },
  { id: 'tp_lace', name: '蕾絲', color: '#ffffff', pattern: 'lace', ink: '#ffffff' },
  { id: 'tp_plain', name: '素色', color: '#ffcfae', pattern: 'plain' },
  { id: 'tp_clear', name: '霧面透明', color: '#ffffff', pattern: 'plain', alpha: 0.55 },
  { id: 'tp_rainbow', name: '彩虹', color: '#ffd1e3', pattern: 'rainbow' },
  { id: 'tp_kraft', name: '牛皮紙', color: '#e6c9a0', pattern: 'kraft', ink: '#b88d5e' },
];
export const TAPE_RATIO = 0.27; // 高 / 寬
// 材質：和紙（半透明、撕邊）、紙（不透明霧面、纖維）、絲綢（柔光、細織紋、須邊）、緞面（亮面反光帶）、塑膠（透明、直切、亮光）
export const TAPE_MATERIALS = [['washi', '和紙'], ['paper', '紙'], ['silk', '絲綢'], ['satin', '緞面'], ['plastic', '塑膠']];
export const TAPE_COLORS = ['#ffb3c9', '#ffd6df', '#ffcfae', '#fff0a6', '#bfe8d2', '#bfe1ff', '#d8cbff', '#ffffff', '#e6c9a0', '#9fd8ff', '#ff9aa8', '#c9e7a0'];
export const tapeOf = (id) => TAPES.find((t) => t.id === id) || TAPES[0];

// 撕開的兩端：沿著左右邊做不規則鋸齒
function tapePath(ctx, w, h, r) {
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  const teeth = Math.max(4, Math.round(h / (h * 0.11)));
  const jag = () => h * (0.03 + r() * 0.05);
  ctx.beginPath();
  ctx.moveTo(x0 + jag(), y0);
  ctx.lineTo(x1 - jag(), y0);
  for (let i = 1; i <= teeth; i++) ctx.lineTo(x1 - (i % 2 ? 0 : jag() * 1.6), y0 + (h * i) / teeth);
  ctx.lineTo(x0 + jag(), y1);
  for (let i = teeth - 1; i >= 0; i--) ctx.lineTo(x0 + (i % 2 ? 0 : jag() * 1.6), y0 + (h * i) / teeth);
  ctx.closePath();
}

// 蕾絲：上下是扇形邊（直接畫在照片上，所以不能用「擦掉」的方式挖洞）
function lacePath(ctx, w, h) {
  const sp = h * 0.24, rr = sp * 0.5, top = -h / 2 + rr * 0.6, bot = h / 2 - rr * 0.6;
  ctx.beginPath();
  ctx.moveTo(-w / 2, top);
  for (let x = -w / 2; x < w / 2; x += sp) ctx.arc(x + sp / 2, top, Math.min(rr, (w / 2 - x)), Math.PI, 0);
  ctx.lineTo(w / 2, bot);
  for (let x = w / 2; x > -w / 2; x -= sp) ctx.arc(x - sp / 2, bot, Math.min(rr, (x + w / 2)), 0, Math.PI);
  ctx.closePath();
}

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.35, y - s * 0.85, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 0.85, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  ctx.fill();
}
function star(ctx, x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.42 : s;
    ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}
function flower(ctx, x, y, s, ink) {
  ctx.fillStyle = ink;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath(); ctx.arc(x, y, s * 0.35, 0, Math.PI * 2); ctx.fill();
}

// 在 (0,0) 為中心、寬 w 高 h 的範圍畫一條紙膠帶
// 直切的兩端（塑膠、緞面）：微微斜一刀
function cutPath(ctx, w, h, r) {
  const s1 = (r() - 0.5) * h * 0.25, s2 = (r() - 0.5) * h * 0.25;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + s1, -h / 2); ctx.lineTo(w / 2 + s2, -h / 2);
  ctx.lineTo(w / 2 - s2, h / 2); ctx.lineTo(-w / 2 - s1, h / 2);
  ctx.closePath();
}
const MAT_ALPHA = { washi: 0.88, paper: 1, silk: 0.86, satin: 0.97, plastic: 0.5 };
export function drawTape(ctx, w, h, tape, color, seed = 1, material = 'washi') {
  const r = rng(seed * 7 + 3), mat = MAT_ALPHA[material] ? material : 'washi';
  const base = color || tape.color, ink = tape.ink || '#ffffff';
  ctx.save();
  if (mat === 'paper') { ctx.shadowColor = 'rgba(60,40,30,.22)'; ctx.shadowBlur = h * 0.12; ctx.shadowOffsetY = h * 0.04; }
  if (tape.pattern === 'lace') lacePath(ctx, w, h);
  else if (mat === 'plastic' || mat === 'satin' || mat === 'silk') cutPath(ctx, w, h, r);
  else tapePath(ctx, w, h, r);
  const alpha = (tape.alpha ?? 0.88) * (MAT_ALPHA[mat] / 0.88);
  ctx.globalAlpha = Math.min(1, mat === 'plastic' ? Math.min(alpha, 0.55) : alpha);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  ctx.globalAlpha = Math.min(1, alpha) * 0.95;
  const x0 = -w / 2, y0 = -h / 2;
  switch (tape.pattern) {
    case 'dots': {
      ctx.fillStyle = ink;
      const sp = h * 0.3;
      for (let y = y0 + sp / 2, row = 0; y < h / 2 + sp; y += sp * 0.85, row++) {
        for (let x = x0 + (row % 2) * (sp / 2); x < w / 2 + sp; x += sp) { ctx.beginPath(); ctx.arc(x, y, h * 0.065, 0, Math.PI * 2); ctx.fill(); }
      }
      break;
    }
    case 'hearts': {
      ctx.fillStyle = ink;
      const sp = h * 0.42;
      for (let y = y0 + sp * 0.45, row = 0; y < h / 2 + sp; y += sp * 0.8, row++) {
        for (let x = x0 + (row % 2) * (sp / 2) + sp * 0.2; x < w / 2 + sp; x += sp) heart(ctx, x, y, h * 0.12);
      }
      break;
    }
    case 'stripes': {
      ctx.fillStyle = ink;
      ctx.globalAlpha *= 0.8;
      const sp = h * 0.36;
      for (let x = x0 - h; x < w / 2 + h; x += sp) {
        ctx.beginPath();
        ctx.moveTo(x, y0); ctx.lineTo(x + sp * 0.45, y0); ctx.lineTo(x + sp * 0.45 + h, h / 2); ctx.lineTo(x + h, h / 2);
        ctx.fill();
      }
      break;
    }
    case 'gingham': {
      ctx.fillStyle = ink;
      const sp = h * 0.34, bw = sp * 0.5;
      ctx.globalAlpha *= 0.45;
      for (let x = x0; x < w / 2; x += sp) ctx.fillRect(x, y0, bw, h);
      for (let y = y0; y < h / 2; y += sp) ctx.fillRect(x0, y, w, bw);
      break;
    }
    case 'grid': {
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(0.6, h * 0.018);
      ctx.globalAlpha *= 0.7;
      const sp = h * 0.2;
      ctx.beginPath();
      for (let x = x0; x < w / 2; x += sp) { ctx.moveTo(x, y0); ctx.lineTo(x, h / 2); }
      for (let y = y0 + sp / 2; y < h / 2; y += sp) { ctx.moveTo(x0, y); ctx.lineTo(w / 2, y); }
      ctx.stroke();
      break;
    }
    case 'stars': {
      ctx.fillStyle = ink;
      const n = Math.round((w / h) * 4);
      for (let i = 0; i < n; i++) star(ctx, x0 + r() * w, y0 + r() * h, h * (0.06 + r() * 0.07));
      break;
    }
    case 'flowers': {
      const sp = h * 0.55;
      for (let x = x0 + sp * 0.3, i = 0; x < w / 2 + sp; x += sp, i++) flower(ctx, x, y0 + h * (i % 2 ? 0.32 : 0.68), h * 0.11, ink);
      break;
    }
    case 'lace': {
      // 蕾絲：中間一排小花洞的淡淡紋路
      ctx.fillStyle = 'rgba(0,0,0,.07)';
      const sp = h * 0.24;
      for (let x = x0 + sp / 2; x < w / 2; x += sp) {
        ctx.beginPath(); ctx.arc(x, 0, h * 0.05, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, -h * 0.2, h * 0.028, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, h * 0.2, h * 0.028, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'rainbow': {
      const cols = ['#ffb3c9', '#ffd2a8', '#fff0a6', '#c6efc9', '#bfe1ff', '#d8cbff'];
      cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x0, y0 + (h * i) / cols.length, w, h / cols.length + 0.5); });
      break;
    }
    case 'kraft': {
      ctx.strokeStyle = ink;
      ctx.globalAlpha *= 0.35;
      ctx.lineWidth = Math.max(0.5, h * 0.01);
      for (let i = 0; i < w / h * 10; i++) {
        const x = x0 + r() * w, y = y0 + r() * h, l = h * (0.1 + r() * 0.3), a = (r() - 0.5) * 0.6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
      break;
    }
    default: break;
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  drawMaterial(ctx, x0, y0, w, h, mat, r);
  ctx.restore();
}

// 材質的光澤與紋理（畫在花紋上面，已經 clip 在膠帶形狀裡）
function drawMaterial(ctx, x0, y0, w, h, mat, r) {
  if (mat === 'washi') {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.06)');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    // 和紙的長纖維
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(0.5, h * 0.012);
    for (let i = 0; i < (w / h) * 6; i++) { const x = x0 + r() * w, y = y0 + r() * h, l = h * (0.2 + r() * 0.5), a = (r() - 0.5) * 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + h * 0.03, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  } else if (mat === 'paper') {
    // 霧面紙：細細的纖維斑點，沒有光澤
    for (let i = 0; i < (w / h) * 60; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.22)' : 'rgba(70,50,40,.08)';
      ctx.fillRect(x0 + r() * w, y0 + r() * h, h * 0.025, h * 0.025);
    }
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, 'rgba(255,255,255,.1)'); g.addColorStop(1, 'rgba(0,0,0,.07)');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  } else if (mat === 'silk') {
    // 絲綢：細細的橫向織紋＋斜向柔光，兩端有須邊
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = Math.max(0.4, h * 0.01);
    ctx.beginPath(); for (let y = y0; y < y0 + h; y += h * 0.05) { ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); } ctx.stroke();
    const g = ctx.createLinearGradient(x0, y0, x0 + w * 0.6, y0 + h);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,.32)'); g.addColorStop(0.6, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(0.5, h * 0.015);
    ctx.beginPath(); for (let y = y0; y < y0 + h; y += h * 0.07) { ctx.moveTo(x0 + h * 0.02, y); ctx.lineTo(x0 + h * 0.1, y + h * 0.02); ctx.moveTo(x0 + w - h * 0.02, y); ctx.lineTo(x0 + w - h * 0.1, y + h * 0.02); } ctx.stroke();
  } else if (mat === 'satin') {
    // 緞面：一條亮亮的反光帶，下面比較暗
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, 'rgba(255,255,255,.15)'); g.addColorStop(0.28, 'rgba(255,255,255,.62)'); g.addColorStop(0.42, 'rgba(255,255,255,.12)');
    g.addColorStop(0.75, 'rgba(0,0,0,.06)'); g.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  } else if (mat === 'plastic') {
    // 塑膠：透明、幾道斜斜的高光、清楚的邊
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    for (let i = 0; i < 3; i++) {
      const x = x0 + w * (0.15 + i * 0.3 + r() * 0.08), bw = h * (0.12 + r() * 0.12);
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + bw, y0); ctx.lineTo(x + bw - h * 0.5, y0 + h); ctx.lineTo(x - h * 0.5, y0 + h); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(0.8, h * 0.03);
    ctx.strokeRect(x0 - 2, y0 + h * 0.03, w + 4, h * 0.94);
  }
}
