// FilmDoodle — 主程式（介面、手勢、匯出）
import {
  PRESETS, developBase, applyFx, previewThumb, makeCanvas, LEAK_STYLES, DATE_FORMATS, DATE_COLORS, DATE_SIZES,
  formatDate, dateStampBox,
} from './film.js';
import { DOODLE_PRESETS, LAYOUTS, PACKS, COUNT_MIN, COUNT_MAX, generateDoodles } from './doodles.js';
import {
  FRAMES, FRAME_COLORS, cropAspect, computeCrop, layoutFrame, drawFrameBack, drawFrameFront, photoClip,
} from './frames.js';
import { STICKERS, CATEGORIES, HIDDEN_CATS, PALETTE, drawStickerDef, stickerBox, isRecolorable } from './stickers.js';
import { FOUR_LAYOUTS, PAPERS, fourLayout, drawPaper, drawPaperFront, cellCrop } from './fourcut.js';
import { readPhotoDate } from './exif.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const MAX_SRC_SIDE = 4096, MAX_SRC_AREA = 12.5e6, PREVIEW_SIDE = 1280;
const MAX_OUT_AREA = 15e6, MAX_OUT_SIDE = 5600;
const FOUR_SRC_SIDE = 2400, FOUR_PREVIEW_H = 1300, FOUR_EXPORT_K = 2;

// 濾鏡分頁：常用的直接顯示，其他收進「更多調整」
const MAIN_SLIDERS = [['flash', '閃光燈', 0, 100], ['grain', '顆粒', 0, 100], ['vignette', '暗角', 0, 100], ['leak', '漏光', 0, 100]];
const MORE_SLIDERS = [
  ['exposure', '曝光', -100, 100], ['contrast', '對比', -100, 100], ['saturation', '飽和度', -100, 100],
  ['temp', '色溫', -100, 100], ['tint', '色調', -100, 100], ['fade', '褪色', 0, 100],
  ['halation', '光暈', 0, 100], ['soften', '柔焦', 0, 100], ['dust', '灰塵刮痕', 0, 100],
];
const SLIDERS = [...MAIN_SLIDERS, ...MORE_SLIDERS];
const COLOR_KEYS = new Set(['intensity', 'exposure', 'contrast', 'saturation', 'temp', 'tint', 'fade', 'flash']);
const ROUND_FONT = '"Fredoka", "Chiron GoRound TC", sans-serif';
const HAND_FONT = '"Fredoka", "Chiron GoRound TC", cursive';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const TABS = ['film', 'doodle', 'frame', 'sticker'];

const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => isoOf(new Date());

function presetFx(id) {
  const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
  return {
    grain: Math.round((p.fx?.grain || 0) * 100),
    vignette: Math.round((p.fx?.vignette || 0) * 100),
    halation: Math.round((p.fx?.halation || 0) * 100),
    flash: Math.round((p.fx?.flash || 0) * 100),
    soften: Math.round((p.fx?.soften || 0) * 100),
  };
}
const defaultAdj = (id) => ({
  intensity: 100, exposure: 0, contrast: 0, saturation: 0, temp: 0, tint: 0, fade: 0,
  ...presetFx(id), leak: 0, leakStyle: 'warm', leakSeed: 1, dust: 0, dustSeed: 1,
});

const state = {
  mode: 'single',
  orig: null, full: null, preview: null, thumb: null, srcVersion: 0, rotation: 0, photoDate: null,
  four: { layout: 'strip', paper: 'white', photos: [null, null, null, null], ver: 0 },
  preset: 'flash',
  adj: defaultAdj('flash'),
  doodle: { preset: 'none', pack: 'cream', layout: 'band', count: 20, countTouched: false, scale: 100, seed: 1, glow: null },
  frame: { id: 'none', color: FRAME_COLORS[0], slideColor: '#f4f1ea', caption: '', filmNo: 12, cropPos: 0.5, seed: 7 },
  date: { on: false, value: todayISO(), format: 'yy', color: 'orange', pos: 'br', size: 'md' },
  glow: true,
  stickers: [], stash: { single: [], four: [] }, selected: null,
  compare: false, dragging: false,
  tab: 'doodle', cat: 'all',
};

// ---------------------------------------------------------------- prefs
const STORE_KEY = 'filmdoodle:v4';
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) || localStorage.getItem('filmdoodle:v3') || 'null');
    if (!p) return;
    if (PRESETS.some((x) => x.id === p.preset)) state.preset = p.preset;
    if (p.adj) for (const k of Object.keys(state.adj)) if (typeof p.adj[k] === typeof state.adj[k]) state.adj[k] = p.adj[k];
    for (const [k, , min, max] of [['intensity', '', 0, 100], ...SLIDERS]) {
      if (typeof state.adj[k] === 'number') state.adj[k] = Math.min(max, Math.max(min, Number.isFinite(state.adj[k]) ? state.adj[k] : 0));
    }
    if (p.frame && FRAMES.some((f) => f.id === p.frame.id)) {
      state.frame.id = p.frame.id;
      if (typeof p.frame.color === 'string') state.frame.color = p.frame.color;
      if (typeof p.frame.slideColor === 'string') state.frame.slideColor = p.frame.slideColor;
    }
    if (p.date) for (const k of ['on', 'format', 'color', 'pos', 'size']) if (typeof p.date[k] === typeof state.date[k]) state.date[k] = p.date[k];
    if (!DATE_SIZES.some(([id]) => id === state.date.size)) state.date.size = 'md';
    if (typeof p.glow === 'boolean') state.glow = p.glow;
    if (p.doodle && DOODLE_PRESETS.some((d) => d.id === p.doodle.preset)) {
      for (const k of ['preset', 'pack', 'layout', 'count', 'scale', 'countTouched']) if (typeof p.doodle[k] === typeof state.doodle[k]) state.doodle[k] = p.doodle[k];
      if (typeof p.doodle.glow === 'number' && Number.isFinite(p.doodle.glow)) state.doodle.glow = Math.min(1, Math.max(0, p.doodle.glow));
      if (!PACKS[state.doodle.pack]) state.doodle.pack = 'cream';
      state.doodle.count = Math.min(COUNT_MAX, Math.max(COUNT_MIN, state.doodle.count || 20));
      state.doodle.scale = Math.min(150, Math.max(60, state.doodle.scale || 100));
    }
    if (p.four) {
      if (FOUR_LAYOUTS.some(([id]) => id === p.four.layout)) state.four.layout = p.four.layout;
      if (PAPERS.some((x) => x.id === p.four.paper)) state.four.paper = p.four.paper;
    }
    if (p.mode === 'single' || p.mode === 'four') state.mode = p.mode;
    if (TABS.includes(p.tab)) state.tab = p.tab;
  } catch { /* 無法讀取就用預設值 */ }
}
let saveTimer = 0;
function savePrefs() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const f = state.frame, d = state.date;
      localStorage.setItem(STORE_KEY, JSON.stringify({
        preset: state.preset, adj: state.adj, mode: state.mode,
        frame: { id: f.id, color: f.color, slideColor: f.slideColor },
        date: { on: d.on, format: d.format, color: d.color, pos: d.pos, size: d.size },
        glow: state.glow, tab: state.tab,
        doodle: { ...state.doodle, seed: 1 },
        four: { layout: state.four.layout, paper: state.four.paper },
      }));
    } catch { /* 私密模式等情況寫不進去也沒關係 */ }
  }, 300);
}

// ---------------------------------------------------------------- helpers
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}
function busy(on, text = '沖洗中…') {
  $('#busyText').textContent = text;
  $('#busy').hidden = !on;
}

function downscale(src, maxSide) {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height));
  if (k === 1) return src;
  const tw = Math.max(1, Math.round(src.width * k)), th = Math.max(1, Math.round(src.height * k));
  let cur = src, cw = src.width, ch = src.height;
  while (cw / 2 >= tw && ch / 2 >= th) {
    cw = Math.round(cw / 2); ch = Math.round(ch / 2);
    const c = makeCanvas(cw, ch);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, cw, ch);
    cur = c;
  }
  const out = makeCanvas(tw, th), x = out.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(cur, 0, 0, tw, th);
  return out;
}

function hexLum(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
function rrect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function ensureFonts(text, families) {
  if (!document.fonts?.load) return;
  try { await Promise.all(families.map((f) => document.fonts.load(`700 48px ${f}`, text || 'Aa'))); } catch { /* 沒字型就用備用字型 */ }
}
const textFamilies = (style) => (style === 'hand' ? ['"Caveat"', '"LXGW WenKai TC"'] : ['"Fredoka"', '"Chiron GoRound TC"']);

// 預設的範例圖（還沒選照片時，縮圖用它示範色調）
function makeSample() {
  const S = 240, c = makeCanvas(S, S), x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, S * 0.66);
  sky.addColorStop(0, '#3f86d8'); sky.addColorStop(0.7, '#9cc3e6'); sky.addColorStop(1, '#f4c9a1');
  x.fillStyle = sky; x.fillRect(0, 0, S, S);
  x.fillStyle = '#fff3c9'; x.beginPath(); x.arc(S * 0.72, S * 0.36, S * 0.1, 0, 7); x.fill();
  x.fillStyle = '#5e9a4c'; x.beginPath(); x.moveTo(0, S * 0.7); x.quadraticCurveTo(S * 0.3, S * 0.5, S * 0.6, S * 0.68); x.quadraticCurveTo(S * 0.85, S * 0.6, S, S * 0.66); x.lineTo(S, S); x.lineTo(0, S); x.fill();
  x.fillStyle = '#2f5d3a'; x.fillRect(0, S * 0.8, S, S * 0.2);
  x.fillStyle = '#e2493b'; x.fillRect(S * 0.1, S * 0.6, S * 0.34, S * 0.18);
  x.fillStyle = '#f7efe2'; x.fillRect(S * 0.14, S * 0.63, S * 0.1, S * 0.07); x.fillRect(S * 0.28, S * 0.63, S * 0.1, S * 0.07);
  x.fillStyle = '#f2c29c'; x.beginPath(); x.arc(S * 0.66, S * 0.72, S * 0.07, 0, 7); x.fill();
  x.fillStyle = '#ffd23c'; x.fillRect(S * 0.6, S * 0.8, S * 0.13, S * 0.2);
  return c;
}
const SAMPLE = makeSample();

// ---------------------------------------------------------------- stickers: geometry + draw
const FALLBACK_DEF = STICKERS.find((d) => d.id === 'sparkle') || STICKERS[0];
const defOf = (st) => STICKERS.find((d) => d.id === st.id) || FALLBACK_DEF;
const measureCtx = makeCanvas(4, 4).getContext('2d');

function textLayout(st, h) {
  const fs = st.style === 'bubble' ? h * 0.58 : h * 0.82;
  if (st.style === 'kao') {
    const font = `700 ${fs}px ${ROUND_FONT}`;
    measureCtx.font = font;
    return { font, w: Math.max(h * 0.4, measureCtx.measureText(st.text || ' ').width) + h * 0.3 };
  }
  const font = `700 ${fs}px ${st.style === 'hand' ? HAND_FONT : ROUND_FONT}`;
  measureCtx.font = font;
  const tw = Math.max(h * 0.4, measureCtx.measureText(st.text || ' ').width);
  const pad = st.style === 'bubble' ? h * 0.42 : h * 0.18;
  return { font, w: tw + pad * 2 };
}

function stickerGeom(st, L) {
  const S = Math.min(L.pw, L.ph), unit = st.size * S;
  let w, h;
  if (st.kind === 'svg') {
    const [vw, vh] = stickerBox(defOf(st));
    const k = unit / Math.max(vw, vh);
    w = vw * k; h = vh * k;
  } else if (st.kind === 'img') {
    const a = st.img.width / st.img.height;
    if (a >= 1) { w = unit; h = unit / a; } else { h = unit; w = unit * a; }
  } else {
    h = unit * 0.42;
    w = textLayout(st, h).w;
  }
  return { cx: L.x + st.x * L.pw, cy: L.y + st.y * L.ph, w, h, rot: st.rot, flip: st.flip };
}

function bubbleColors(c) {
  const l = hexLum(c);
  if (l > 0.85) return { fill: c, ink: '#2a2433' };
  if (l < 0.25) return { fill: c, ink: '#ffffff' };
  return { fill: mixHex(c, '#ffffff', 0.5), ink: mixHex(c, '#000000', 0.38) };
}

function drawTextSticker(ctx, st, w, h, glow) {
  const { font } = textLayout(st, h);
  const c = st.color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const ty = st.style === 'hand' ? h * 0.04 : h * 0.03;
  const setGlow = (col, k) => { if (glow) { ctx.shadowColor = col; ctx.shadowBlur = h * k; } };
  const clearGlow = () => { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; };
  switch (st.style) {
    case 'bubble': {
      const { fill, ink } = bubbleColors(c);
      ctx.beginPath(); rrect(ctx, -w / 2, -h / 2, w, h, h * 0.34);
      ctx.fillStyle = fill; ctx.fill();
      ctx.fillStyle = ink; ctx.fillText(st.text, 0, ty);
      break;
    }
    case 'neon':
      setGlow(c, 0.3);
      ctx.strokeStyle = c; ctx.lineWidth = h * 0.13; ctx.strokeText(st.text, 0, ty);
      clearGlow();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = h * 0.035; ctx.strokeText(st.text, 0, ty);
      break;
    case 'outline': {
      const light = hexLum(c) > 0.85;
      setGlow(c, 0.22);
      ctx.strokeStyle = light ? '#2a2433' : c; ctx.lineWidth = h * 0.17; ctx.strokeText(st.text, 0, ty);
      clearGlow();
      ctx.fillStyle = '#ffffff'; ctx.fillText(st.text, 0, ty);
      break;
    }
    case 'kao':
      // 顏文字：白色細邊讓它在照片上看得清楚
      ctx.strokeStyle = hexLum(c) > 0.85 ? 'rgba(42,36,51,.75)' : 'rgba(255,255,255,.95)';
      ctx.lineWidth = h * 0.16; ctx.strokeText(st.text, 0, ty);
      setGlow(c, 0.25);
      ctx.fillStyle = c; ctx.fillText(st.text, 0, ty);
      clearGlow();
      break;
    default:
      setGlow(c, 0.18);
      ctx.fillStyle = c; ctx.fillText(st.text, 0, ty);
      clearGlow();
  }
}

function drawSticker(ctx, st, L) {
  const g = stickerGeom(st, L);
  ctx.save();
  ctx.translate(g.cx, g.cy);
  ctx.rotate(g.rot);
  if (g.flip) ctx.scale(-1, 1);
  if (st.kind === 'svg') {
    const def = defOf(st), [vw] = stickerBox(def), k = g.w / vw;
    // 塗鴉框的線條粗細跟著照片大小，不跟著貼圖大小（跟參考圖一樣，大小塗鴉的線一樣細）
    const ss = st.lw ? Math.min(2.5, Math.max(0.5, (st.lw * Math.min(L.pw, L.ph)) / (4.5 * k))) : 1;
    ctx.translate(-g.w / 2, -g.h / 2);
    ctx.scale(k, k);
    drawStickerDef(ctx, def, st.color, k, st.glow ?? (state.glow ? 1 : 0), ss, st.seed ?? st.uid ?? 1);
  } else if (st.kind === 'img') {
    ctx.drawImage(st.img, -g.w / 2, -g.h / 2, g.w, g.h);
  } else {
    drawTextSticker(ctx, st, g.w, g.h, st.glow ?? state.glow);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- rendering
const view = $('#view');
const vctx = view.getContext('2d');
let baseCache = { key: '', canvas: null };
let fxCache = { key: '', canvas: null };
let fourCache = { key: '', canvas: null };
const cellCache = new Map();
let doodleCache = { key: '', items: [] };
let fontsVersion = 0;
let lastL = null;
const COLOR_ADJ = ['intensity', 'exposure', 'contrast', 'saturation', 'temp', 'tint', 'fade', 'flash'];
const resetPhotoCache = () => { baseCache.key = ''; fxCache.key = ''; fourCache.key = ''; };
const hasFour = () => state.four.photos.some(Boolean);
const hasContent = () => (state.mode === 'four' ? hasFour() : !!state.preview);
// 四格的日期印在最後一張有照片的格子
const fourDateCell = () => state.four.photos.reduce((last, ph, i) => (ph ? i : last), -1);

// 塗鴉框用「原圖比例」產生，預覽和匯出才會一模一樣
function photoAspect() {
  if (state.mode === 'four') { const L = fourLayout(state.four.layout); return L.W / L.H; }
  const f = state.full;
  return cropAspect(state.frame.id, f.width, f.height) || f.width / f.height;
}
// 日期戳記實際範圍（照片座標 0~1），給塗鴉和貼圖避開
function dateBoxNorm() {
  if (!state.date.on) return null;
  const text = formatDate(state.date.value, state.date.format), d = state.date;
  if (state.mode === 'four') {
    const i = fourDateCell();
    if (i < 0) return null;
    const L = fourLayout(state.four.layout), c = L.cells[i], b = dateStampBox(c.w, c.h, text, d.pos, d.size);
    return b && { x0: (c.x + b.x0) / L.W, x1: (c.x + b.x1) / L.W, y0: (c.y + b.y0) / L.H, y1: (c.y + b.y1) / L.H };
  }
  if (!state.full) return null;
  const a = photoAspect(), w = a >= 1 ? 1000 * a : 1000, h = a >= 1 ? 1000 : 1000 / a, b = dateStampBox(w, h, text, d.pos, d.size);
  return b && { x0: b.x0 / w, x1: b.x1 / w, y0: b.y0 / h, y1: b.y1 / h };
}
function doodleItems() {
  const d = state.doodle;
  if (d.preset === 'none' || !hasContent()) return [];
  const aspect = photoAspect(), avoid = dateBoxNorm();
  const key = JSON.stringify([d, aspect, avoid]);
  if (doodleCache.key !== key) doodleCache = { key, items: generateDoodles(d, aspect, avoid) };
  return doodleCache.items;
}
function doodleOverlay() {
  const items = doodleItems();
  if (!items.length) return null;
  return (ctx, w, h) => {
    const L = { x: 0, y: 0, pw: w, ph: h, W: w, H: h };
    for (const it of items) drawSticker(ctx, it, L);
  };
}
let raf = 0;
const requestRender = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

function frameOpts() {
  const f = state.frame, [Y, M] = (state.date.value || todayISO()).split('-');
  return {
    color: f.color, slideColor: f.slideColor, caption: '', filmNo: f.filmNo, seed: f.seed,
    dateText: `${MONTHS[(+M || 1) - 1]} ${Y}`,
  };
}

function getPreviewPhoto() {
  const src = state.preview;
  const crop = computeCrop(src.width, src.height, cropAspect(state.frame.id, src.width, src.height), state.frame.cropPos);
  const lutN = state.dragging ? 17 : 33;
  const baseKey = JSON.stringify([state.srcVersion, state.preset, COLOR_ADJ.map((k) => state.adj[k]),
    Math.round(crop.x), Math.round(crop.y), Math.round(crop.w), Math.round(crop.h), state.compare, lutN]);
  if (baseCache.key !== baseKey) {
    if (baseCache.canvas) baseCache.canvas.width = 0;
    baseCache = {
      key: baseKey,
      canvas: developBase(src, crop, Math.round(crop.w), Math.round(crop.h),
        { preset: state.preset, adj: state.adj, original: state.compare, lutN }),
    };
  }
  const fxKey = JSON.stringify([baseKey, state.adj, state.date, state.doodle, state.glow, fontsVersion]);
  if (fxCache.key !== fxKey) {
    if (fxCache.canvas) fxCache.canvas.width = 0;
    fxCache = {
      key: fxKey,
      canvas: applyFx(baseCache.canvas, { adj: state.adj, date: state.date, original: state.compare }, doodleOverlay()),
    };
  }
  return fxCache.canvas;
}

// ---- 四格：每一格各自沖洗（色調、閃光、顆粒），再放到相紙上；塗鴉框畫在整張上面
function developCell(i, k, scaleKey, lutN) {
  const ph = state.four.photos[i];
  if (!ph) return null;
  const L = fourLayout(state.four.layout), c = L.cells[i];
  const w = Math.round(c.w * k), h = Math.round(c.h * k);
  const withDate = state.date.on && i === fourDateCell();
  const key = JSON.stringify([ph.ver, scaleKey, w, h, state.preset, state.adj, withDate ? state.date : 0, state.compare, lutN]);
  if (scaleKey !== 'export') { const hit = cellCache.get(i); if (hit && hit.key === key) return hit.canvas; }
  const src = scaleKey === 'export' ? ph.full : ph.preview;
  const base = developBase(src, cellCrop(src, L.aspect), w, h, { preset: state.preset, adj: state.adj, original: state.compare, lutN });
  const out = applyFx(base, { adj: state.adj, date: withDate ? state.date : null, original: state.compare }, null, true);
  if (scaleKey !== 'export') {
    const old = cellCache.get(i);
    if (old?.canvas && old.canvas !== out) old.canvas.width = 0;
    cellCache.set(i, { key, canvas: out });
  }
  return out;
}
function buildFour(k, scaleKey) {
  const L = fourLayout(state.four.layout), lutN = scaleKey === 'export' ? 33 : state.dragging ? 17 : 33;
  const c = makeCanvas(L.W * k, L.H * k), ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  drawPaper(ctx, L, state.four.paper, k);
  L.cells.forEach((cell, i) => {
    const img = developCell(i, k, scaleKey, lutN);
    if (img) { ctx.drawImage(img, cell.x * k, cell.y * k, cell.w * k, cell.h * k); if (scaleKey === 'export') img.width = 0; return; }
    // 還沒放照片的格子
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(cell.x * k, cell.y * k, cell.w * k, cell.h * k);
    ctx.fillStyle = 'rgba(120,110,140,.55)';
    ctx.font = `700 ${40 * k}px ${ROUND_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('＋', (cell.x + cell.w / 2) * k, (cell.y + cell.h / 2) * k);
  });
  drawPaperFront(ctx, L, state.four.paper, k);
  const overlay = doodleOverlay();
  if (overlay) { ctx.save(); overlay(ctx, c.width, c.height); ctx.restore(); }
  return c;
}
function getFourPreview() {
  const L = fourLayout(state.four.layout), k = FOUR_PREVIEW_H / L.H;
  const key = JSON.stringify([state.four.ver, state.four.layout, state.four.paper, state.preset, state.adj, state.date,
    state.doodle, state.glow, fontsVersion, state.compare, state.dragging]);
  if (fourCache.key !== key) {
    if (fourCache.canvas) fourCache.canvas.width = 0;
    fourCache = { key, canvas: buildFour(k, 'preview') };
  }
  return fourCache.canvas;
}

function compose(ctx, photo, L, o) {
  if (state.mode === 'four') {
    ctx.drawImage(photo, 0, 0);
  } else {
    const id = state.frame.id;
    drawFrameBack(ctx, L, id, o);
    ctx.save();
    photoClip(ctx, L, id);
    ctx.drawImage(photo, L.x, L.y, L.pw, L.ph);
    ctx.restore();
    drawFrameFront(ctx, L, id, o);
  }
  for (const st of state.stickers) drawSticker(ctx, st, L);
}

function render() {
  if (!hasContent()) return;
  let photo, L, o;
  if (state.mode === 'four') {
    photo = getFourPreview();
    L = { x: 0, y: 0, pw: photo.width, ph: photo.height, W: photo.width, H: photo.height };
  } else {
    photo = getPreviewPhoto();
    o = frameOpts();
    L = layoutFrame(state.frame.id, photo.width, photo.height, o);
  }
  const W = Math.round(L.W), H = Math.round(L.H);
  if (view.width !== W || view.height !== H) { view.width = W; view.height = H; fitView(); }
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.clearRect(0, 0, W, H);
  compose(vctx, photo, L, o);
  lastL = L;
  const sel = selectedSticker();
  if (sel) drawSelection(vctx, sel, L);
}

function fitView() {
  if (view.hidden) return;
  const st = $('#stage'), cs = getComputedStyle(st);
  const aw = Math.max(50, st.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  const ah = Math.max(50, st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
  const k = Math.min(aw / view.width, ah / view.height);
  view.style.width = Math.floor(view.width * k) + 'px';
  view.style.height = Math.floor(view.height * k) + 'px';
}

const pxPerCss = () => {
  const r = view.getBoundingClientRect();
  return r.width ? view.width / r.width : 1;
};

function drawSelection(ctx, st, L) {
  const g = stickerGeom(st, L), k = pxPerCss(), pad = 6 * k;
  const x0 = -g.w / 2 - pad, y0 = -g.h / 2 - pad, x1 = g.w / 2 + pad, y1 = g.h / 2 + pad;
  ctx.save();
  ctx.translate(g.cx, g.cy);
  ctx.rotate(g.rot);
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 4 * k;
  ctx.setLineDash([6 * k, 5 * k]);
  ctx.lineWidth = 1.8 * k;
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([]);
  const r = 13 * k;
  // 刪除
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath(); ctx.arc(x0, y0, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4 * k; ctx.lineCap = 'round';
  const q = r * 0.4;
  ctx.beginPath(); ctx.moveTo(x0 - q, y0 - q); ctx.lineTo(x0 + q, y0 + q); ctx.moveTo(x0 + q, y0 - q); ctx.lineTo(x0 - q, y0 + q); ctx.stroke();
  // 旋轉 / 縮放
  ctx.shadowBlur = 4 * k;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x1, y1, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#1f1a15'; ctx.lineWidth = 2.2 * k;
  ctx.beginPath(); ctx.arc(x1, y1, r * 0.5, -Math.PI * 0.1, Math.PI * 1.25); ctx.stroke();
  const ax = x1 + r * 0.5 * Math.cos(-Math.PI * 0.1), ay = y1 + r * 0.5 * Math.sin(-Math.PI * 0.1);
  ctx.beginPath(); ctx.moveTo(ax - r * 0.32, ay - r * 0.08); ctx.lineTo(ax + r * 0.02, ay + r * 0.02); ctx.lineTo(ax + r * 0.12, ay - r * 0.34); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- sticker selection / editing
let uid = 1;
const selectedSticker = () => state.stickers.find((s) => s.uid === state.selected) || null;

function select(id) {
  state.selected = id;
  updateStickerBar();
  requestRender();
}

function addSticker(obj) {
  if (!hasContent()) { toast('先選照片，再來貼貼圖'); return; }
  const st = {
    uid: uid++, seed: 1 + Math.floor(Math.random() * 99999), x: 0.5 + (Math.random() - 0.5) * 0.36, y: 0.5 + (Math.random() - 0.5) * 0.36,
    size: 0.26, rot: (Math.random() - 0.5) * 0.4, flip: false, ...obj,
  };
  state.stickers.push(st);
  select(st.uid);
  if (!hintShown) {
    hintShown = true;
    toast(window.innerWidth < 900 ? '拖曳移動・兩指縮放旋轉' : '拖曳移動・拖右下角圓鈕縮放旋轉');
  }
}
let hintShown = false;
let showColors = false;

function removeSticker(st) {
  state.stickers = state.stickers.filter((s) => s !== st);
  if (state.selected === st.uid) select(null); else requestRender();
}

function updateStickerBar() {
  const st = selectedSticker(), bar = $('#stickerBar');
  bar.hidden = !st;
  $('#stageTools').hidden = !!st || !hasContent();
  if (!st) { showColors = false; return; }
  const colorable = st.kind === 'text' || (st.kind === 'svg' && isRecolorable(defOf(st)));
  const sw = $('#stickerColors');
  $('#actColor').hidden = !colorable;
  $('#actColorDot').style.background = st.color || '#fff';
  sw.hidden = !colorable || !showColors;
  if (colorable && showColors) {
    buildSwatches(sw, paletteFor(st), st.color, (c) => { st.color = c; updateStickerBar(); requestRender(); });
  }
}

// 有些貼圖換成某些顏色會看不清楚：表情臉不給深色、棋盤格愛心不給白色
function paletteFor(st) {
  if (st.kind !== 'svg') return PALETTE;
  const def = defOf(st);
  if (def.cat === 'emoji') return PALETTE.filter((c) => hexLum(c) > 0.55);
  if (def.id === 'y2k_checkheart') return PALETTE.filter((c) => hexLum(c) < 0.92);
  return PALETTE;
}

function buildSwatches(box, colors, current, onPick) {
  box.innerHTML = '';
  for (const c of colors) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = c;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(c.toLowerCase() === (current || '').toLowerCase()));
    b.setAttribute('aria-label', c);
    b.addEventListener('click', () => onPick(c));
    box.append(b);
  }
}

$('#stickerBar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  const st = selectedSticker();
  if (!btn || !st) return;
  switch (btn.dataset.act) {
    case 'color': showColors = !showColors; updateStickerBar(); break;
    case 'flip': st.flip = !st.flip; requestRender(); break;
    case 'dup': {
      const copy = { ...st, uid: uid++, x: st.x + 0.05, y: st.y + 0.05 };
      state.stickers.push(copy); select(copy.uid); break;
    }
    case 'front':
      state.stickers = state.stickers.filter((s) => s !== st).concat(st); requestRender(); break;
    case 'del': removeSticker(st); break;
    case 'done': select(null); break;
  }
});

// ---------------------------------------------------------------- gestures on the canvas
const pointers = new Map();
let gesture = null;

function toCanvas(e) {
  const r = view.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * view.width) / r.width, y: ((e.clientY - r.top) * view.height) / r.height };
}
function toLocal(st, p) {
  const g = stickerGeom(st, lastL), dx = p.x - g.cx, dy = p.y - g.cy, c = Math.cos(-g.rot), s = Math.sin(-g.rot);
  return { x: dx * c - dy * s, y: dx * s + dy * c, g };
}
function hitSticker(p) {
  const pad = 6 * pxPerCss();
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const st = state.stickers[i], { x, y, g } = toLocal(st, p);
    if (Math.abs(x) <= g.w / 2 + pad && Math.abs(y) <= g.h / 2 + pad) return st;
  }
  return null;
}
function hitHandle(st, p) {
  const { x, y, g } = toLocal(st, p), k = pxPerCss(), pad = 6 * k, r = 20 * k;
  if (Math.hypot(x + g.w / 2 + pad, y + g.h / 2 + pad) <= r) return 'del';
  if (Math.hypot(x - g.w / 2 - pad, y - g.h / 2 - pad) <= r) return 'rot';
  return null;
}
const clampSize = (s) => Math.min(3, Math.max(0.04, s));
function snapRot(a) {
  const q = Math.PI / 2, n = Math.round(a / q);
  return Math.abs(a - n * q) < 0.05 ? n * q : a;
}
function clampPos(st) {
  const L = lastL;
  st.x = Math.min((L.W - L.x) / L.pw, Math.max(-L.x / L.pw, st.x));
  st.y = Math.min((L.H - L.y) / L.ph, Math.max(-L.y / L.ph, st.y));
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

view.addEventListener('pointerdown', (e) => {
  if (!lastL) return;
  e.preventDefault();
  try { view.setPointerCapture(e.pointerId); } catch { /* 不支援就算了 */ }
  const p = toCanvas(e);
  pointers.set(e.pointerId, p);
  const sel = selectedSticker();
  if (pointers.size === 2) {
    if (sel) {
      const [a, b] = [...pointers.values()];
      gesture = { type: 'pinch', d0: dist(a, b) || 1, a0: ang(a, b), m0: mid(a, b), size0: sel.size, rot0: sel.rot, x0: sel.x, y0: sel.y };
    }
    return;
  }
  if (pointers.size > 2) return;
  if (sel) {
    const h = hitHandle(sel, p);
    if (h === 'del') { removeSticker(sel); gesture = null; return; }
    if (h === 'rot') {
      const g = stickerGeom(sel, lastL);
      gesture = { type: 'rot', cx: g.cx, cy: g.cy, d0: Math.hypot(p.x - g.cx, p.y - g.cy) || 1, a0: Math.atan2(p.y - g.cy, p.x - g.cx), size0: sel.size, rot0: sel.rot };
      return;
    }
  }
  const hit = hitSticker(p);
  if (hit) {
    if (state.selected !== hit.uid) select(hit.uid);
    const g = stickerGeom(hit, lastL);
    gesture = { type: 'move', ox: p.x - g.cx, oy: p.y - g.cy };
  } else {
    if (state.selected) select(null);
    gesture = null;
  }
});

view.addEventListener('pointermove', (e) => {
  if (!lastL) return;
  const p = toCanvas(e);
  if (!pointers.has(e.pointerId)) {
    if (e.pointerType === 'mouse') {
      const sel = selectedSticker(), h = sel && hitHandle(sel, p);
      view.style.cursor = h === 'rot' ? 'nwse-resize' : h === 'del' ? 'pointer' : hitSticker(p) ? 'move' : 'default';
    }
    return;
  }
  pointers.set(e.pointerId, p);
  const sel = selectedSticker();
  if (!sel || !gesture) return;
  if (gesture.type === 'move' && pointers.size === 1) {
    sel.x = (p.x - gesture.ox - lastL.x) / lastL.pw;
    sel.y = (p.y - gesture.oy - lastL.y) / lastL.ph;
    clampPos(sel);
  } else if (gesture.type === 'rot') {
    sel.size = clampSize((gesture.size0 * Math.hypot(p.x - gesture.cx, p.y - gesture.cy)) / gesture.d0);
    sel.rot = snapRot(gesture.rot0 + Math.atan2(p.y - gesture.cy, p.x - gesture.cx) - gesture.a0);
  } else if (gesture.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()], m = mid(a, b);
    sel.size = clampSize((gesture.size0 * dist(a, b)) / gesture.d0);
    sel.rot = snapRot(gesture.rot0 + ang(a, b) - gesture.a0);
    sel.x = gesture.x0 + (m.x - gesture.m0.x) / lastL.pw;
    sel.y = gesture.y0 + (m.y - gesture.m0.y) / lastL.ph;
    clampPos(sel);
  }
  requestRender();
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (gesture?.type === 'pinch' && pointers.size < 2) {
    // 放開一指後，剩下那隻手指可以繼續拖曳
    const sel = selectedSticker(), rest = [...pointers.values()][0];
    if (sel && rest) {
      const g = stickerGeom(sel, lastL);
      gesture = { type: 'move', ox: rest.x - g.cx, oy: rest.y - g.cy };
    } else gesture = null;
  }
  if (!pointers.size) gesture = null;
}
view.addEventListener('pointerup', endPointer);
view.addEventListener('pointercancel', endPointer);
view.addEventListener('wheel', (e) => {
  const sel = selectedSticker();
  if (!sel) return;
  e.preventDefault();
  if (e.shiftKey) sel.rot = snapRot(sel.rot + e.deltaY * 0.004);
  else sel.size = clampSize(sel.size * Math.exp(-e.deltaY * 0.0015));
  requestRender();
}, { passive: false });

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, dialog')) return;
  const sel = selectedSticker();
  if (!sel) return;
  const step = e.shiftKey ? 0.05 : 0.01;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSticker(sel); }
  else if (e.key === 'Escape') select(null);
  else if (e.key === 'ArrowLeft') { sel.x -= step; requestRender(); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { sel.x += step; requestRender(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { sel.y -= step; requestRender(); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { sel.y += step; requestRender(); e.preventDefault(); }
});

// ---------------------------------------------------------------- loading photos
async function loadFile(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) { toast('請選擇圖片檔'); return; }
  busy(true, '讀取照片…');
  await nextFrame();
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) throw new Error('empty image');
    const k = Math.min(1, MAX_SRC_SIDE / Math.max(w, h), Math.sqrt(MAX_SRC_AREA / (w * h)));
    const c = makeCanvas(w * k, h * k), ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    if (state.full && state.full !== state.orig) state.full.width = 0;
    state.orig = c;
    state.full = null;
    state.rotation = 0;
    state.frame.cropPos = 0.5;
    $('#cropPos').value = 50;
    const d = (await readPhotoDate(file)) || (file.lastModified ? isoOf(new Date(file.lastModified)) : todayISO());
    state.photoDate = d;
    state.date.value = d;
    syncDateUI();
    buildSources();
    refreshWorkspace();
  } catch (err) {
    console.error(err);
    toast('這張照片打不開，換成 JPG 或 PNG 試試看');
  } finally {
    URL.revokeObjectURL(url);
    busy(false);
  }
}

function buildSources() {
  const o = state.orig, r = state.rotation;
  let full = o;
  if (r) {
    const sw = r % 180 ? o.height : o.width, sh = r % 180 ? o.width : o.height;
    full = makeCanvas(sw, sh);
    const x = full.getContext('2d');
    x.translate(sw / 2, sh / 2);
    x.rotate((r * Math.PI) / 180);
    x.drawImage(o, -o.width / 2, -o.height / 2);
  }
  if (state.full && state.full !== o && state.full !== full) state.full.width = 0;
  state.full = full;
  state.preview = downscale(full, PREVIEW_SIDE);
  state.thumb = downscale(state.preview, 240);
  state.srcVersion++;
  resetPhotoCache();
  refreshPresetThumbs();
  refreshFrameThumbs();
  refreshDoodleThumbs();
  updateFrameOpts();
}

// 有沒有照片、在哪個模式 → 顯示空白頁或預覽
function refreshWorkspace() {
  const has = hasContent();
  $('#app').dataset.hasPhoto = String(has);
  $('#empty').hidden = has;
  view.hidden = !has;
  $('#btnRotate').hidden = state.mode === 'four';
  $('#btnSave').disabled = !has;
  updateStickerBar();
  if (has) { fitView(); requestRender(); } else { lastL = null; drawDeco(); }
}

const fileInput = $('#fileInput'), fourInput = $('#fourInput'), slotInput = $('#slotInput');
const pickPhoto = () => (state.mode === 'four' ? fourInput : fileInput).click();
$('#btnNew').addEventListener('click', pickPhoto);
$('#btnPick').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { loadFile(fileInput.files[0]); fileInput.value = ''; });

// ---------------------------------------------------------------- four-cut（四格拍貼）
async function decodeToCanvas(file, maxSide) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) throw new Error('empty image');
    const k = Math.min(1, maxSide / Math.max(w, h));
    const c = makeCanvas(w * k, h * k), ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}
let fourVer = 0, pendingSlot = 0;
async function loadFourFiles(files, startSlot = 0) {
  const list = [...files].filter((f) => !f.type || f.type.startsWith('image/')).slice(0, 4);
  if (!list.length) return;
  busy(true, '讀取照片…');
  await nextFrame();
  let slot = startSlot, failed = 0;
  for (const file of list) {
    try {
      const full = await decodeToCanvas(file, FOUR_SRC_SIDE);
      const old = state.four.photos[slot];
      if (old) old.full.width = 0;
      state.four.photos[slot] = { full, preview: downscale(full, 900), thumb: downscale(full, 240), ver: ++fourVer };
      if (slot === startSlot) {
        const d = (await readPhotoDate(file)) || (file.lastModified ? isoOf(new Date(file.lastModified)) : todayISO());
        state.photoDate = d; state.date.value = d;
      }
    } catch (err) { console.error(err); failed++; }
    slot = (slot + 1) % 4;
  }
  state.four.ver++;
  busy(false);
  syncDateUI();
  refreshFourSlots();
  refreshPresetThumbs(); refreshDoodleThumbs();
  refreshWorkspace();
  if (failed) toast(`有 ${failed} 張照片打不開，換成 JPG 或 PNG 試試看`);
}
function refreshFourSlots() {
  const box = $('#fourSlots');
  box.innerHTML = '';
  state.four.photos.forEach((ph, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'slot';
    b.setAttribute('aria-label', ph ? `換第 ${i + 1} 格的照片` : `放第 ${i + 1} 格的照片`);
    if (ph) { const c = makeCanvas(ph.thumb.width, ph.thumb.height); c.getContext('2d').drawImage(ph.thumb, 0, 0); b.append(c); }
    else { const plus = document.createElement('span'); plus.className = 'slot-plus'; plus.textContent = '＋'; b.append(plus); }
    const n = document.createElement('span'); n.className = 'slot-no'; n.textContent = String(i + 1); b.append(n);
    b.addEventListener('click', () => { pendingSlot = i; slotInput.click(); });
    box.append(b);
  });
}
function syncFourUI() {
  $$('#fourLayouts .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.four.layout)));
  $$('#fourPapers .swatch').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === state.four.paper)));
}
function buildFourUI() {
  for (const [id, name] of FOUR_LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = name;
    b.addEventListener('click', () => { state.four.layout = id; cellCache.clear(); resetPhotoCache(); syncFourUI(); refreshWorkspace(); savePrefs(); });
    $('#fourLayouts').append(b);
  }
  for (const pp of PAPERS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch paper'; b.dataset.id = pp.id;
    b.style.background = pp.swatch;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-label', pp.name); b.title = pp.name;
    b.addEventListener('click', () => { state.four.paper = pp.id; syncFourUI(); requestRender(); savePrefs(); });
    $('#fourPapers').append(b);
  }
  $('#btnFourAll').addEventListener('click', () => fourInput.click());
  $('#btnPickFour').addEventListener('click', () => fourInput.click());
  fourInput.addEventListener('change', () => { loadFourFiles(fourInput.files, 0); fourInput.value = ''; });
  slotInput.addEventListener('change', () => { loadFourFiles(slotInput.files, pendingSlot); slotInput.value = ''; });
  refreshFourSlots();
  syncFourUI();
}

// ---------------------------------------------------------------- 模式：單張／四格
function setMode(m, initial = false) {
  if (!initial && m === state.mode) return;
  if (!initial) {
    state.stash[state.mode] = state.stickers;
    state.stickers = state.stash[m] || [];
    state.selected = null;
  }
  state.mode = m;
  $('#app').dataset.mode = m;
  $$('.mode-switch button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  $('#frameSingle').hidden = m !== 'single';
  $('#frameFour').hidden = m !== 'four';
  doodleCache.key = '';
  resetPhotoCache();
  if (!initial) { refreshPresetThumbs(); refreshDoodleThumbs(); }
  refreshWorkspace();
  savePrefs();
}
$$('.mode-switch button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
const thumbSrc = () => (state.mode === 'four' ? state.four.photos.find(Boolean)?.thumb : state.thumb);

// 拖放 / 貼上
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { dragDepth++; $('#empty').classList.add('drag'); } });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#empty').classList.remove('drag'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('#empty').classList.remove('drag');
  const files = [...(e.dataTransfer?.files || [])].filter((x) => x.type.startsWith('image/'));
  if (!files.length) return;
  if (state.mode === 'four') loadFourFiles(files, 0); else loadFile(files[0]);
});
window.addEventListener('paste', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (!item) return;
  if (state.mode === 'four') loadFourFiles([item.getAsFile()], Math.max(0, state.four.photos.findIndex((x) => !x)));
  else loadFile(item.getAsFile());
});

$('#btnRotate').addEventListener('click', () => {
  if (state.mode === 'four' || !state.orig) return;
  state.rotation = (state.rotation + 90) % 360;
  buildSources();
  requestRender();
});

const cmp = $('#btnCompare');
const setCompare = (on) => { if (state.compare === on) return; state.compare = on; cmp.classList.toggle('on', on); requestRender(); };
cmp.addEventListener('pointerdown', (e) => { e.preventDefault(); try { cmp.setPointerCapture(e.pointerId); } catch { /* ignore */ } setCompare(true); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => cmp.addEventListener(t, () => setCompare(false)));
cmp.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------------------------------------------------------------- tabs
function setTab(t) {
  state.tab = t;
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  $$('.pane').forEach((p) => { p.hidden = p.dataset.pane !== t; });
  $('.tab-body').scrollTop = 0;
  savePrefs();
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

// ---------------------------------------------------------------- film presets
function buildPresetCards() {
  const box = $('#presetList');
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    b.dataset.id = p.id;
    b.setAttribute('aria-pressed', String(p.id === state.preset));
    const c = makeCanvas(160, 160);
    const n = document.createElement('span'); n.className = 'c-name'; n.textContent = p.name;
    const s = document.createElement('span'); s.className = 'c-sub'; s.textContent = p.sub;
    b.append(c, n, s);
    b.addEventListener('click', () => selectPreset(p.id));
    box.append(b);
  }
}
let thumbJob = 0;
function refreshPresetThumbs() {
  const job = ++thumbJob, src = thumbSrc() || SAMPLE;
  const cards = $$('#presetList .card');
  let i = 0;
  const step = () => {
    if (job !== thumbJob || i >= cards.length) return;
    const b = cards[i++], p = PRESETS.find((x) => x.id === b.dataset.id);
    const t = previewThumb(src, p, {}, 160);
    b.querySelector('canvas').getContext('2d').drawImage(t, 0, 0);
    setTimeout(step, 0);
  };
  step();
}
function selectPreset(id) {
  state.preset = id;
  Object.assign(state.adj, presetFx(id));
  $$('#presetList .card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  syncSliders();
  requestRender();
  savePrefs();
}

// ---------------------------------------------------------------- adjust sliders
function buildSliders() {
  for (const [list, box] of [[MAIN_SLIDERS, $('#sliderMain')], [MORE_SLIDERS, $('#sliderMore')]]) {
    for (const [key, label, min, max] of list) {
      const l = document.createElement('label');
      l.className = 'slider';
      l.innerHTML = `<span class="s-label"></span><input type="range" min="${min}" max="${max}" step="1"><output></output>`;
      l.querySelector('.s-label').textContent = label;
      l.querySelector('input').dataset.adj = key;
      box.append(l);
    }
  }
  $$('input[data-adj]').forEach((input) => {
    const key = input.dataset.adj, out = input.parentElement.querySelector('output');
    input.addEventListener('input', () => {
      state.adj[key] = +input.value;
      out.textContent = input.value;
      state.dragging = COLOR_KEYS.has(key);
      requestRender();
      savePrefs();
    });
    input.addEventListener('change', () => { state.dragging = false; requestRender(); });
    input.parentElement.querySelector('.s-label').addEventListener('dblclick', () => {
      const def = defaultAdj(state.preset)[key];
      state.adj[key] = def; syncSliders(); requestRender(); savePrefs();
    });
  });
  // 漏光樣式 + 隨機
  const ls = $('#leakStyles');
  for (const [id, name] of LEAK_STYLES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = name;
    b.addEventListener('click', () => {
      state.adj.leakStyle = id;
      if (!state.adj.leak) state.adj.leak = 60;
      syncSliders(); requestRender(); savePrefs();
    });
    ls.append(b);
  }
  const dice = document.createElement('button');
  dice.type = 'button'; dice.className = 'chip'; dice.textContent = '🎲 換位置';
  dice.addEventListener('click', () => {
    state.adj.leakSeed = 1 + Math.floor(Math.random() * 9999);
    state.adj.dustSeed = 1 + Math.floor(Math.random() * 9999);
    requestRender(); savePrefs();
  });
  ls.append(dice);
}
function syncSliders() {
  $$('input[data-adj]').forEach((i) => {
    i.value = state.adj[i.dataset.adj];
    i.parentElement.querySelector('output').textContent = i.value;
  });
  $$('#leakStyles .chip[data-id]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.adj.leakStyle)));
}
$('#btnResetAdj').addEventListener('click', () => {
  state.adj = defaultAdj(state.preset);
  syncSliders(); requestRender(); savePrefs();
});

// ---------------------------------------------------------------- frames
function buildFrameCards() {
  const box = $('#frameList');
  for (const f of FRAMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    b.dataset.id = f.id;
    b.setAttribute('aria-pressed', String(f.id === state.frame.id));
    const c = makeCanvas(208, 184);
    const n = document.createElement('span'); n.className = 'c-name'; n.textContent = f.name;
    b.append(c, n);
    b.addEventListener('click', () => selectFrame(f.id));
    box.append(b);
  }
}
function renderFrameThumb(c, id, src) {
  const cr = computeCrop(src.width, src.height, cropAspect(id, src.width, src.height), 0.5);
  const k = Math.min(1, 150 / Math.max(cr.w, cr.h));
  const pw = Math.max(1, Math.round(cr.w * k)), ph = Math.max(1, Math.round(cr.h * k));
  const photo = makeCanvas(pw, ph);
  photo.getContext('2d').drawImage(src, cr.x, cr.y, cr.w, cr.h, 0, 0, pw, ph);
  const o = { color: FRAME_COLORS[0], slideColor: '#f4f1ea', caption: '', filmNo: 12, seed: 7, dateText: '' };
  const L = layoutFrame(id, pw, ph, o);
  const tmp = makeCanvas(L.W, L.H), t = tmp.getContext('2d');
  drawFrameBack(t, L, id, o);
  t.save(); photoClip(t, L, id); t.drawImage(photo, L.x, L.y, L.pw, L.ph); t.restore();
  drawFrameFront(t, L, id, o);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const s = Math.min((c.width - 16) / tmp.width, (c.height - 16) / tmp.height);
  const dw = tmp.width * s, dh = tmp.height * s;
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.drawImage(tmp, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
}
function refreshFrameThumbs() {
  const src = state.thumb || SAMPLE;
  $$('#frameList .card').forEach((b) => renderFrameThumb(b.querySelector('canvas'), b.dataset.id, src));
}
function selectFrame(id) {
  state.frame.id = id;
  state.frame.cropPos = 0.5;
  $('#cropPos').value = 50;
  $('#cropPos').parentElement.querySelector('output').textContent = '50';
  $$('#frameList .card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  updateFrameOpts();
  requestRender();
  savePrefs();
}
function updateFrameOpts() {
  const f = FRAMES.find((x) => x.id === state.frame.id) || FRAMES[0];
  const src = state.preview;
  const axis = src ? computeCrop(src.width, src.height, cropAspect(f.id, src.width, src.height), 0.5).axis : null;
  $('#optCrop').hidden = !axis;
  $('#optCropLabel').textContent = axis === 'x' ? '左右取景' : '上下取景';
  $('#optColor').hidden = !f.colors;
  if (f.colors) {
    const slide = f.id === 'slide';
    buildSwatches($('#frameColors'), Array.isArray(f.colors) ? f.colors : FRAME_COLORS, slide ? state.frame.slideColor : state.frame.color, (c) => {
      if (slide) state.frame.slideColor = c; else state.frame.color = c;
      updateFrameOpts(); requestRender(); savePrefs();
    });
  }
}
$('#cropPos').addEventListener('input', (e) => {
  state.frame.cropPos = +e.target.value / 100;
  e.target.parentElement.querySelector('output').textContent = e.target.value;
  requestRender();
});

// ---------------------------------------------------------------- doodle frames（塗鴉框）
function buildDoodlePane() {
  const box = $('#doodleList');
  for (const p of DOODLE_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    b.dataset.id = p.id;
    const c = makeCanvas(160, 160);
    const n = document.createElement('span'); n.className = 'c-name'; n.textContent = p.name;
    b.append(c, n);
    b.addEventListener('click', () => selectDoodle(p.id));
    box.append(b);
  }
  const chipRow = (el, list, key) => {
    for (const item of list) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'chip'; btn.dataset.id = item[0]; btn.textContent = item[1];
      btn.addEventListener('click', () => { state.doodle[key] = item[0]; syncDoodleUI(); requestRender(); savePrefs(); });
      el.append(btn);
    }
  };
  chipRow($('#doodleLayouts'), LAYOUTS, 'layout');
  chipRow($('#doodlePacks'), Object.entries(PACKS).map(([id, pk]) => [id, pk.name]), 'pack');
  $('#doodleScale').addEventListener('input', (e) => { state.doodle.scale = +e.target.value; syncDoodleUI(); requestRender(); savePrefs(); });
  const stepCount = (d) => {
    state.doodle.count = Math.min(COUNT_MAX, Math.max(COUNT_MIN, state.doodle.count + d));
    state.doodle.countTouched = true;
    syncDoodleUI(); requestRender(); savePrefs();
  };
  $('#doodleLess').addEventListener('click', () => stepCount(-2));
  $('#doodleMore').addEventListener('click', () => stepCount(2));
  $('#doodleGlow').addEventListener('input', (e) => { state.doodle.glow = +e.target.value / 100; syncDoodleUI(); requestRender(); savePrefs(); });
  $('#btnDoodleShuffle').addEventListener('click', () => {
    state.doodle.seed = 1 + Math.floor(Math.random() * 99999);
    requestRender();
    refreshDoodleThumbs();
  });
  $('#btnDoodleEdit').addEventListener('click', () => {
    if (!hasContent()) { toast('先選照片'); return; }
    const items = doodleItems();
    if (!items.length) return;
    const converted = items.map((it) => ({ ...it, uid: uid++ }));
    state.stickers = converted.concat(state.stickers);
    state.doodle.preset = 'none';
    syncDoodleUI();
    select(null);
    toast('已轉成貼圖：點一下塗鴉就能移動、縮放或刪除');
  });
}

function selectDoodle(id) {
  const p = DOODLE_PRESETS.find((x) => x.id === id);
  state.doodle.preset = id;
  state.doodle.glow = null; // 換款式時光暈回到這一款的預設
  if (p.pack) {
    Object.assign(state.doodle, { pack: p.pack, layout: p.layout });
    // 使用者自己調過數量就保留她的數字，沒調過就用這一款的預設
    if (!state.doodle.countTouched) state.doodle.count = p.count;
  }
  syncDoodleUI();
  requestRender();
  savePrefs();
  if (id !== 'none' && !hasContent()) toast('先選照片，就能看到塗鴉框');
  if (PACKS[state.doodle.pack]?.kao) ensureKao();
}
// 顏文字用到的字要先載入，不然第一次會用備用字型
async function ensureKao() {
  const pk = PACKS.kao, all = [...Object.keys(pk.small), ...Object.keys(pk.medium), ...Object.keys(pk.large)].join('');
  await ensureFonts(all, ['"Fredoka"', '"Chiron GoRound TC"']);
  fontsVersion++;
  requestRender();
}

function syncDoodleUI() {
  const d = state.doodle;
  $$('#doodleList .card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === d.preset)));
  $('#doodleOpts').hidden = d.preset === 'none';
  $$('#doodleLayouts .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === d.layout)));
  $$('#doodlePacks .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === d.pack)));
  $('#doodleCountOut').textContent = `${d.count} 個`;
  $('#doodleLess').disabled = d.count <= COUNT_MIN;
  $('#doodleMore').disabled = d.count >= COUNT_MAX;
  $('#doodleScale').value = d.scale;
  $('#doodleScale').parentElement.querySelector('output').textContent = `${d.scale}%`;
  const g = Math.round((d.glow ?? PACKS[d.pack]?.glow ?? 0) * 100);
  $('#doodleGlow').value = g;
  $('#doodleGlow').parentElement.querySelector('output').textContent = g;
}

let doodleThumbJob = 0;
function refreshDoodleThumbs() {
  const job = ++doodleThumbJob, src = thumbSrc() || SAMPLE;
  const cards = $$('#doodleList .card');
  let i = 0;
  const step = () => {
    if (job !== doodleThumbJob || i >= cards.length) return;
    const b = cards[i++], p = DOODLE_PRESETS.find((x) => x.id === b.dataset.id);
    const c = b.querySelector('canvas'), ctx = c.getContext('2d');
    const S = Math.min(src.width, src.height);
    ctx.drawImage(src, (src.width - S) / 2, (src.height - S) / 2, S, S, 0, 0, c.width, c.height);
    if (p.pack) {
      const items = generateDoodles({ ...p, preset: p.id, seed: state.doodle.seed, scale: 115 }, 1);
      const L = { x: 0, y: 0, pw: c.width, ph: c.height, W: c.width, H: c.height };
      for (const it of items) drawSticker(ctx, { ...it, lw: it.lw * 2.2 }, L);
    }
    setTimeout(step, 0);
  };
  step();
}

// ---------------------------------------------------------------- sticker panel
function buildStickerPanel() {
  const cats = $('#stickerCats');
  for (const [id, name] of CATEGORIES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = name;
    b.setAttribute('aria-pressed', String(id === state.cat));
    b.addEventListener('click', () => {
      state.cat = id;
      $$('#stickerCats .chip').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.id === id)));
      renderStickerGrid();
    });
    cats.append(b);
  }
  renderStickerGrid();
}
function renderStickerGrid() {
  const grid = $('#stickerGrid');
  grid.innerHTML = '';
  for (const def of STICKERS) {
    if (HIDDEN_CATS.has(def.cat) || (state.cat !== 'all' && def.cat !== state.cat)) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', def.name);
    b.title = def.name;
    const c = makeCanvas(112, 112), ctx = c.getContext('2d');
    const [vw, vh] = stickerBox(def), k = 100 / Math.max(vw, vh);
    ctx.translate(56 - (vw * k) / 2, 56 - (vh * k) / 2);
    ctx.scale(k, k);
    drawStickerDef(ctx, def, def.color, k, 0.5);
    b.append(c);
    b.addEventListener('click', () => addSticker({ kind: 'svg', id: def.id, color: def.color }));
    grid.append(b);
  }
}
$('#glow').addEventListener('change', (e) => { state.glow = e.target.checked; requestRender(); savePrefs(); });
$('#btnClearStickers').addEventListener('click', () => {
  if (!state.stickers.length) return;
  if (window.confirm('要清除照片上所有的貼圖嗎？')) { state.stickers = []; select(null); }
});
const stickerInput = $('#stickerInput');
$('#btnUploadSticker').addEventListener('click', () => {
  if (!hasContent()) { toast('先選照片，再來貼貼圖'); return; }
  stickerInput.click();
});
stickerInput.addEventListener('change', async () => {
  const f = stickerInput.files[0];
  stickerInput.value = '';
  if (!f) return;
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = makeCanvas(img.naturalWidth, img.naturalHeight);
    c.getContext('2d').drawImage(img, 0, 0);
    addSticker({ kind: 'img', img: downscale(c, 1200), size: 0.32 });
  } catch {
    toast('這個貼圖檔打不開，請用 PNG');
  } finally {
    URL.revokeObjectURL(url);
  }
});

// ---------------------------------------------------------------- date stamp
function buildDateUI() {
  for (const [id, name] of DATE_SIZES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = name;
    b.addEventListener('click', () => { const was = state.date.on; state.date.size = id; state.date.on = true; if (!was) clearDateArea(); syncDateUI(); requestRender(); savePrefs(); });
    $('#dateSizes').append(b);
  }
  const fm = $('#dateFormats');
  for (const [id] of DATE_FORMATS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip date-chip'; b.dataset.id = id;
    b.addEventListener('click', () => { const was = state.date.on; state.date.format = id; state.date.on = true; if (!was) clearDateArea(); syncDateUI(); requestRender(); savePrefs(); });
    fm.append(b);
  }
  const names = { orange: '橘', red: '紅', yellow: '黃', white: '白' };
  const cl = $('#dateColors');
  for (const [id, col] of DATE_COLORS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = id;
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = col; dot.style.color = col;
    b.append(dot, document.createTextNode(names[id]));
    b.addEventListener('click', () => { const was = state.date.on; state.date.color = id; state.date.on = true; if (!was) clearDateArea(); syncDateUI(); requestRender(); savePrefs(); });
    cl.append(b);
  }
  const ps = $('#datePos');
  for (const [id, name] of [['br', '右下'], ['bl', '左下']]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = name;
    b.addEventListener('click', () => { const changed = !state.date.on || state.date.pos !== id; state.date.pos = id; state.date.on = true; if (changed) clearDateArea(); syncDateUI(); requestRender(); savePrefs(); });
    ps.append(b);
  }
  $('#dateOn').addEventListener('change', (e) => { state.date.on = e.target.checked; if (state.date.on) clearDateArea(); requestRender(); savePrefs(); });
  $('#dateValue').addEventListener('change', (e) => {
    if (!e.target.value) return;
    state.date.value = e.target.value; state.date.on = true; syncDateUI(); requestRender();
  });
  $('#btnDatePhoto').addEventListener('click', () => {
    state.date.value = state.photoDate || todayISO(); state.date.on = true; syncDateUI(); requestRender();
  });
}
// 開日期或換角落時，把蓋住日期戳記的貼圖移開（只看日期實際的範圍）
function clearDateArea() {
  const b = dateBoxNorm();
  if (!b || !lastL || !state.stickers.length) return;
  const L = lastL, pad = Math.min(L.pw, L.ph) * 0.015;
  const R = { x0: L.x + b.x0 * L.pw, x1: L.x + b.x1 * L.pw, y0: L.y + b.y0 * L.ph, y1: L.y + b.y1 * L.ph };
  const left = (R.x0 + R.x1) / 2 < L.x + L.pw / 2;
  let moved = 0;
  for (const st of state.stickers) {
    const g = stickerGeom(st, L), rad = (Math.max(g.w, g.h) / 2) * 0.8;
    const nx = Math.max(R.x0, Math.min(g.cx, R.x1)), ny = Math.max(R.y0, Math.min(g.cy, R.y1));
    if (Math.hypot(g.cx - nx, g.cy - ny) >= rad) continue;
    // 往上移或往旁邊移，選移動距離比較短的那個
    const upY = R.y0 - rad - pad, sideX = left ? R.x1 + rad + pad : R.x0 - rad - pad;
    if (Math.abs(g.cy - upY) <= Math.abs(g.cx - sideX)) st.y = (upY - L.y) / L.ph;
    else st.x = (sideX - L.x) / L.pw;
    moved++;
  }
  if (moved) toast(`已把 ${moved} 個蓋住日期的貼圖移開`);
}

function syncDateUI() {
  $('#dateOn').checked = state.date.on;
  $('#dateValue').value = state.date.value;
  $$('#dateFormats .chip').forEach((b) => {
    b.textContent = formatDate(state.date.value, b.dataset.id);
    b.setAttribute('aria-pressed', String(b.dataset.id === state.date.format));
  });
  $$('#dateColors .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.date.color)));
  $$('#datePos .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.date.pos)));
  $$('#dateSizes .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.date.size)));
}

// ---------------------------------------------------------------- export
let resultURL = null, resultFile = null;
const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
};

async function exportImage() {
  if (!hasContent()) return;
  select(null);
  busy(true, '沖洗中…');
  await nextFrame(); await nextFrame();
  let photo = null, out = null;
  try {
    const texts = state.stickers.filter((s) => s.kind === 'text').concat(doodleItems().filter((s) => s.kind === 'text'));
    await Promise.all(texts.map((s) => ensureFonts(s.text, ['"Fredoka"', '"Chiron GoRound TC"'])));
    if (state.mode === 'four') {
      photo = buildFour(FOUR_EXPORT_K, 'export');
      const L = { x: 0, y: 0, pw: photo.width, ph: photo.height, W: photo.width, H: photo.height };
      out = makeCanvas(L.W, L.H);
      compose(out.getContext('2d'), photo, L);
      const blob4 = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.92));
      if (!blob4) throw new Error('toBlob failed');
      if (!state.four.photos.every(Boolean)) toast('還有空的格子，可以到「相框」補照片');
      showResult(blob4, out.width, out.height);
      return;
    }
    const src = state.full, id = state.frame.id, o = frameOpts();
    const crop = computeCrop(src.width, src.height, cropAspect(id, src.width, src.height), state.frame.cropPos);
    let L = layoutFrame(id, crop.w, crop.h, o);
    const f = Math.min(1, Math.sqrt(MAX_OUT_AREA / (L.W * L.H)), MAX_OUT_SIDE / Math.max(L.W, L.H));
    const pw = Math.round(crop.w * f), ph = Math.round(crop.h * f);
    photo = applyFx(developBase(src, crop, pw, ph, { preset: state.preset, adj: state.adj, lutN: 33 }),
      { adj: state.adj, date: state.date }, doodleOverlay(), true);
    L = layoutFrame(id, pw, ph, o);
    out = makeCanvas(L.W, L.H);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    compose(ctx, photo, L, o);
    const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) throw new Error('toBlob failed');
    showResult(blob, out.width, out.height);
  } catch (err) {
    console.error(err);
    toast('匯出失敗了，請再試一次');
  } finally {
    if (photo) photo.width = 0;
    if (out) out.width = 0;
    busy(false);
  }
}

function showResult(blob, w, h) {
  if (resultURL) URL.revokeObjectURL(resultURL);
  resultURL = URL.createObjectURL(blob);
  const name = `filmdoodle-${stamp()}.jpg`;
  resultFile = new File([blob], name, { type: 'image/jpeg' });
  $('#resultImg').src = resultURL;
  const dl = $('#btnDownload');
  dl.href = resultURL;
  dl.download = name;
  $('#resultInfo').textContent = `${w} × ${h} px · ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
  let canShare = false;
  try { canShare = !!(navigator.canShare && navigator.canShare({ files: [resultFile] })); } catch { canShare = false; }
  $('#btnShare').hidden = !canShare;
  $('#resultDialog').showModal();
}
$('#btnSave').addEventListener('click', exportImage);
$('#btnShare').addEventListener('click', async () => {
  try { await navigator.share({ files: [resultFile], title: 'FilmDoodle' }); } catch { /* 使用者取消 */ }
});
$('#btnCloseResult').addEventListener('click', () => $('#resultDialog').close());
$('#btnInfo').addEventListener('click', () => $('#infoDialog').showModal());
$('#btnCloseInfo').addEventListener('click', () => $('#infoDialog').close());
// 點對話框外面的背景就關閉
$$('dialog.sheet').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close('cancel'); }));

// ---------------------------------------------------------------- empty-state decoration
function drawDeco() {
  const c = $('#decoCanvas');
  if ($('#empty').hidden) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = c.getBoundingClientRect();
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = r.width, H = r.height, S = Math.min(W, H);
  const items = [
    ['y2k_chromeheart', 0.1, 0.12, 0.17, -0.2], ['pl_catsit', 0.88, 0.13, 0.17, 0.15], ['fl_cosmos', 0.87, 0.86, 0.16, -0.15],
    ['y2k_glitter', 0.13, 0.85, 0.15, 0.1], ['jp_sakura', 0.5, 0.06, 0.11, 0.05], ['y2k_cd', 0.33, 0.93, 0.13, -0.1],
    ['fr_heart', 0.08, 0.5, 0.13, -0.2], ['y2k_chromestar', 0.94, 0.5, 0.13, 0.25], ['pl_twinkle', 0.67, 0.95, 0.12, 0],
  ];
  for (const [id, x, y, s, rot] of items) {
    const def = STICKERS.find((d) => d.id === id);
    if (!def) continue;
    const [vw, vh] = stickerBox(def), size = Math.max(54, S * s), k = size / Math.max(vw, vh);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.translate(x * W, y * H);
    ctx.rotate(rot);
    ctx.translate((-vw * k) / 2, (-vh * k) / 2);
    ctx.scale(k, k);
    drawStickerDef(ctx, def, def.color, k * dpr, 0.6);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- init
function init() {
  loadPrefs();
  buildPresetCards();
  buildSliders();
  buildFrameCards();
  buildDoodlePane();
  buildStickerPanel();
  buildFourUI();
  buildDateUI();
  syncSliders();
  syncDateUI();
  updateFrameOpts();
  $('#glow').checked = state.glow;
  syncDoodleUI();
  setTab(state.tab);
  setMode(state.mode, true);
  refreshPresetThumbs();
  refreshFrameThumbs();
  refreshDoodleThumbs();
  drawDeco();
  const ro = new ResizeObserver(() => { fitView(); drawDeco(); });
  ro.observe($('#stage'));
  document.fonts?.addEventListener?.('loadingdone', () => { fontsVersion++; requestRender(); });
  // 讓已選中的卡片捲到看得到的位置
  requestAnimationFrame(() => {
    $('#presetList .card[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    $('#frameList .card[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 離線功能不是必要的 */ });
  }
}
init();
