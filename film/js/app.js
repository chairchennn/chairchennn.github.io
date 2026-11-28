// FilmDoodle — 主程式（介面、手勢、匯出）
import {
  PRESETS, developBase, applyFx, previewThumb, makeCanvas, LEAK_STYLES, DATE_FORMATS, DATE_COLORS, DATE_SIZES,
  formatDate, dateStampBox, drawDateStamp,
} from './film.js';
import { DOODLE_PRESETS, LAYOUTS, PACKS, COUNT_MIN, COUNT_MAX, OVERLAY_COUNT, generateDoodles } from './doodles.js';
import { drawOverlay } from './overlay.js';
import {
  FRAMES, FRAME_COLORS, FREE_RATIO_FRAMES, cropAspect, computeCrop, layoutFrame, drawFrameBack, drawFrameFront, photoClip,
} from './frames.js';
import { TAPES, TAPE_RATIO, TAPE_COLORS, TAPE_MATERIALS, tapeOf, drawTape } from './tape.js';
import { STICKERS, CATEGORIES, HIDDEN_CATS, HIDDEN_IDS, PALETTE, drawStickerDef, stickerBox, isRecolorable } from './stickers.js';
import { FOUR_LAYOUTS, PAPERS, fourLayout, drawPaper, drawPaperFront, cellCrop } from './fourcut.js';
import { readPhotoDate } from './exif.js';
import { MARGINS, smoothLoop, polyArea, drawCutPhoto, makeCutSticker, drawCutPreview, hasTransparency, splineLoop, toCtrl } from './cutout.js';
import { XF0, normXf, xfCrop, xfPan, drawXf, ZOOM_MAX, ANGLE_MAX } from './photoxf.js';

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
const TABS = ['film', 'doodle', 'sticker', 'frame'];            // 主要編輯（左側／手機底部導覽）
const TOOLS = ['add', 'crop', 'tape', 'glue'];  // 文具工具列（快速創作）
const PANES = [...TABS, 'add', 'crop', 'tape'];
const TOOL_INFO = {
  add: { name: '新增', tip: '新增：換照片、匯入圖片剪成貼圖', icon: 'add' },
  crop: { name: '裁切', tip: '裁切：取景、縮放、角度、比例', icon: 'scissors' },
  tape: { name: '膠帶', tip: '紙膠帶：貼在照片邊上', icon: 'tape' },
  glue: { name: '膠水', tip: '膠水：把所有貼圖黏好，不會再被拖動', icon: 'glue' },
};
const PANE_INFO = {
  film: ['底片', '選一種底片色調，再調閃光燈與顆粒'],
  doodle: ['塗鴉框', '一鍵在照片邊緣加上手繪塗鴉'],
  sticker: ['貼圖', '點一下貼到照片上'],
  frame: ['相框', '相框樣式、相紙與相機日期'],
  add: ['新增', '照片，以及剪貼：匯入圖片或剪照片做成貼圖'],
  crop: ['裁切', '取景、縮放、角度與比例'],
  tape: ['紙膠帶', '點一下貼上；連續貼會換到別的邊角'],
};
const FIXED_RATIO = { film35: '3:2', film35neg: '3:2', slide: '3:2', film120: '1:1', polaroid: '1:1', square: '1:1', mini: '約 3:4', wide: '約 16:10' };
// 紙膠帶連續貼時輪流換位置：上、下、四個角（斜貼）
const TAPE_SPOTS = [[0.5, 0.02, 0, 0.42], [0.5, 0.98, 0, 0.42], [0.07, 0.05, -0.75, 0.3], [0.93, 0.05, 0.75, 0.3], [0.07, 0.95, 0.75, 0.3], [0.93, 0.95, -0.75, 0.3]];
// 剪刀的比例（長邊／短邊；0 = 原比例），方向跟著照片
const RATIOS = [[0, '原比例'], [1, '1:1'], [5 / 4, '4:5'], [3 / 2, '2:3'], [16 / 9, '9:16']];
// 貼圖分類（第六版精簡）：新風格在前，舊的可愛系列收成一類；「我的」是這次上傳或剪下的圖
const STICKER_GROUPS = [['all', '全部'], ['pencil', '色鉛筆'], ['print', '版畫'], ['crayon', '蠟筆'], ['cute', '可愛'], ['mine', '我的']];
const groupOf = (def) => (['pencil', 'print', 'crayon'].includes(def.cat) ? def.cat : 'cute');
const GROUP_ORDER = { pencil: 0, print: 1, crayon: 2, cute: 3 };
const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const xfHowTo = () => (finePointer() ? '拖曳移動・滾輪縮放・Shift＋滾輪轉動' : '拖曳移動・兩指縮放和轉動');

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
  doodle: { preset: 'pencil', pack: 'pencil', layout: 'edge', count: 12, countTouched: false, scale: 100, seed: 1, glow: null },
  frame: { id: 'none', color: FRAME_COLORS[0], slideColor: '#f4f1ea', archColor: '#a99bc5', caption: '', filmNo: 12, crop: XF0(), seed: 7, ratio: 0, paper: 'dots' },
  cropCell: 0,
  tools: { order: [...TOOLS], hidden: [] }, cropMode: 'frame', tapeMat: 'washi',
  date: { on: false, value: todayISO(), format: 'yy', color: 'orange', pos: 'br', size: 'md' },
  glow: true,
  stickers: [], stash: { single: [], four: [] }, selected: null,
  compare: false, dragging: false,
  tab: 'doodle', cat: 'all', mine: [],
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
      if (typeof p.frame.archColor === 'string') state.frame.archColor = p.frame.archColor;
      if (RATIOS.some(([r]) => r === p.frame.ratio)) state.frame.ratio = p.frame.ratio;
      if (PAPERS.some((x) => x.id === p.frame.paper)) state.frame.paper = p.frame.paper;
    }
    if (p.tools && Array.isArray(p.tools.order)) {
      const order = p.tools.order.filter((t) => TOOLS.includes(t));
      TOOLS.forEach((t, i) => { if (!order.includes(t)) order.splice(Math.min(i, order.length), 0, t); });
      const hidden = [...new Set((Array.isArray(p.tools.hidden) ? p.tools.hidden : []).filter((t) => TOOLS.includes(t) && t !== 'add'))];
      state.tools = { order: [...new Set(order)], hidden };
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
    if (TAPE_MATERIALS.some(([id]) => id === p.tapeMat)) state.tapeMat = p.tapeMat;
    if (p.ver !== 8 && state.doodle.preset === 'none') Object.assign(state.doodle, { preset: 'pencil', pack: 'pencil', layout: 'edge', count: 12 }); // 文具面板不記，下次打開回到主工具
  } catch { /* 無法讀取就用預設值 */ }
}
let saveTimer = 0, savePending = null;
addEventListener('pagehide', () => { if (savePending) { clearTimeout(saveTimer); savePending(); } });
function savePrefs() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(savePending = () => {
    savePending = null;
    try {
      const f = state.frame, d = state.date;
      localStorage.setItem(STORE_KEY, JSON.stringify({
        preset: state.preset, adj: state.adj, mode: state.mode,
        frame: { id: f.id, color: f.color, slideColor: f.slideColor, archColor: f.archColor, ratio: f.ratio, paper: f.paper },
        tools: state.tools, ver: 8, tapeMat: state.tapeMat,
        date: { on: d.on, format: d.format, color: d.color, pos: d.pos, size: d.size },
        glow: state.glow, tab: TABS.includes(state.tab) ? state.tab : 'film',
        doodle: { ...state.doodle, seed: 1 },
        four: { layout: state.four.layout, paper: state.four.paper },
      }));
    } catch { /* 私密模式等情況寫不進去也沒關係 */ }
  }, 300);
}

// ---------------------------------------------------------------- helpers
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
let toastTimer = 0;
function toast(msg, action) {
  const t = $('#toast');
  t.textContent = msg;
  if (action?.label) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast-act'; b.textContent = action.label;
    b.addEventListener('click', () => { t.hidden = true; action.run(); });
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action?.ms || (action?.label ? 5000 : 2400));
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
  } else if (st.kind === 'tape') {
    w = unit; h = unit * TAPE_RATIO;
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
  } else if (st.kind === 'tape') {
    drawTape(ctx, g.w, g.h, tapeOf(st.id), st.color, st.seed ?? st.uid ?? 1, st.material || 'washi');
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
const resetPhotoCache = () => { baseCache.key = ''; fxCache.key = ''; fourCache.key = ''; devCache.key = ''; wholeFxCache.key = ''; layerCache.key = ''; };
const hasFour = () => state.four.photos.some(Boolean);
const hasContent = () => (state.mode === 'four' ? hasFour() : !!state.preview);
// 四格的日期印在最後一張有照片的格子
const fourDateCell = () => state.four.photos.reduce((last, ph, i) => (ph ? i : last), -1);

// 塗鴉框用「原圖比例」產生，預覽和匯出才會一模一樣
function photoAspect() {
  if (state.mode === 'four') { const L = fourLayout(state.four.layout); return L.W / L.H; }
  const f = state.full;
  return cropAspect(state.frame.id, f.width, f.height, state.frame.ratio) || f.width / f.height;
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
const overlayKind = () => DOODLE_PRESETS.find((p) => p.id === state.doodle.preset)?.overlay || null;
function doodleOverlay() {
  const kind = overlayKind();
  if (kind && hasContent()) {
    const d = { ...state.doodle }, date = dateBoxNorm();
    return (ctx, w, h) => drawOverlay(kind, ctx, w, h, d, date);
  }
  const items = doodleItems();
  if (!items.length) return null;
  return (ctx, w, h) => {
    const L = { x: 0, y: 0, pw: w, ph: h, W: w, H: h };
    for (const it of items) drawSticker(ctx, it, L);
  };
}
let pendingDateClear = false;
const queueDateClear = () => { if (state.date.on && state.stickers.length) { pendingDateClear = true; requestRender(); } };
let raf = 0;
const requestRender = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); noteChange(); }); };

function frameOpts() {
  const f = state.frame, [Y, M] = (state.date.value || todayISO()).split('-');
  return {
    color: f.color, slideColor: f.slideColor, archColor: f.archColor, caption: '', filmNo: f.filmNo, seed: f.seed, paper: f.paper,
    cut: f.id === 'paper' ? f.cut : null,
    dateText: `${MONTHS[(+M || 1) - 1]} ${Y}`,
  };
}

// 拖照片時：整張照片先沖洗一次存起來，之後每次移動只重新裁切（不用每一格都重算色調）
let devCache = { key: '', canvas: null };
function developedWhole(src) {
  const key = JSON.stringify([state.srcVersion, state.preset, COLOR_ADJ.map((k) => state.adj[k]), state.compare]);
  if (devCache.key !== key) {
    if (devCache.canvas) devCache.canvas.width = 0;
    devCache = { key, canvas: developBase(src, { x: 0, y: 0, w: src.width, h: src.height }, src.width, src.height, { preset: state.preset, adj: state.adj, original: state.compare, lutN: 17 }) };
  }
  return devCache.canvas;
}
// 拖照片時更快：整張照片的顆粒、暗角等也先做好，塗鴉另外畫成一層，每次移動只要裁切再疊上去
let wholeFxCache = { key: '', canvas: null }, layerCache = { key: '', canvas: null };
function wholeFx(src) {
  const dev = developedWhole(src), key = JSON.stringify([devCache.key, state.adj]);
  if (wholeFxCache.key !== key) {
    if (wholeFxCache.canvas) wholeFxCache.canvas.width = 0;
    wholeFxCache = { key, canvas: applyFx(dev, { adj: state.adj, date: null, original: state.compare }, null) };
  }
  return wholeFxCache.canvas;
}
function doodleLayer(w, h) {
  const overlay = doodleOverlay();
  if (!overlay) return null;
  // 包含塗鴉框的全部設定與日期：整體畫面款式不會經過 doodleItems，只看 doodleCache 會拿到舊的一層
  const key = JSON.stringify([state.doodle, state.date, state.mode, w, h, state.glow, fontsVersion]);
  if (layerCache.key !== key) {
    if (layerCache.canvas) layerCache.canvas.width = 0;
    const c = makeCanvas(w, h);
    overlay(c.getContext('2d'), w, h);
    layerCache = { key, canvas: c };
  }
  return layerCache.canvas;
}
function fastPreview(src, crop) {
  const z = state.frame.crop.zoom || 1, ow = Math.round(crop.w * z), oh = Math.round(crop.h * z);
  const c = makeCanvas(ow, oh), cx = c.getContext('2d');
  cx.imageSmoothingQuality = 'high';
  const whole = wholeFx(src);
  if (crop.xf) drawXf(cx, whole, ow, oh, crop.xf); else cx.drawImage(whole, crop.x, crop.y, crop.w, crop.h, 0, 0, ow, oh);
  if (!state.compare) {
    const layer = doodleLayer(ow, oh);
    if (layer) cx.drawImage(layer, 0, 0);
    const d = state.date;
    if (d.on) drawDateStamp(cx, ow, oh, formatDate(d.value, d.format), d.color, d.pos, d.size);
  }
  return c;
}
function getPreviewPhoto() {
  const src = state.preview;
  const crop = xfCrop(src.width, src.height, cropAspect(state.frame.id, src.width, src.height, state.frame.ratio), state.frame.crop);
  // 只有手指／滑桿／滾輪真的還在動時才用快速預覽；不然就回到完整品質（避免卡在快速模式）
  if (state.dragging === 'photo' && !pointers.size && !sliderActive && !wheelTimer) state.dragging = false;
  const lutN = state.dragging ? 17 : 33, fast = state.dragging === 'photo';
  if (fast) {
    if (fxCache.canvas) fxCache.canvas.width = 0;
    fxCache = { key: 'fast', canvas: fastPreview(src, crop) };
    return fxCache.canvas;
  }
  const baseKey = JSON.stringify([state.srcVersion, state.preset, COLOR_ADJ.map((k) => state.adj[k]),
    Math.round(crop.x), Math.round(crop.y), Math.round(crop.w), Math.round(crop.h), crop.xf || 0, state.compare, lutN, fast]);
  if (baseCache.key !== baseKey) {
    if (baseCache.canvas) baseCache.canvas.width = 0;
    const z = state.frame.crop.zoom || 1, ow = Math.round(crop.w * z), oh = Math.round(crop.h * z);
    let canvas;
    if (fast) {
      const dev = developedWhole(src);
      canvas = makeCanvas(ow, oh);
      const cx = canvas.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      if (crop.xf) drawXf(cx, dev, ow, oh, crop.xf); else cx.drawImage(dev, crop.x, crop.y, crop.w, crop.h, 0, 0, ow, oh);
    } else {
      canvas = developBase(src, crop, ow, oh, { preset: state.preset, adj: state.adj, original: state.compare, lutN });
    }
    baseCache = { key: baseKey, canvas };
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
  const key = JSON.stringify([ph.ver, ph.t, scaleKey, w, h, state.preset, state.adj, withDate ? state.date : 0, state.compare, lutN]);
  if (scaleKey !== 'export') { const hit = cellCache.get(i); if (hit && hit.key === key) return hit.canvas; }
  const src = scaleKey === 'export' ? ph.full : ph.preview;
  const base = developBase(src, xfCrop(src.width, src.height, L.aspect, ph.t), w, h, { preset: state.preset, adj: state.adj, original: state.compare, lutN });
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
  const key = JSON.stringify([state.four.ver, state.four.photos.map((x) => x?.t), state.four.layout, state.four.paper, state.preset, state.adj, state.date,
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
    if (o?.cut) drawCutPhoto(ctx, photo, L.x, L.y, L.pw, L.ph, o.cut);
    else {
      ctx.save();
      photoClip(ctx, L, id);
      ctx.drawImage(photo, L.x, L.y, L.pw, L.ph);
      ctx.restore();
    }
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
  lastL = L;
  if (pendingDateClear) { pendingDateClear = false; clearDateArea(); }
  compose(vctx, photo, L, o);
  const sel = selectedSticker();
  if (sel) drawSelection(vctx, sel, L);
  if (state.mode === 'four' && (state.tab === 'crop' || gesture?.tgt)) drawCellOutline(vctx);
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
  syncGlueUI();
  requestRender();
}

function addSticker(obj) {
  if (!hasContent()) { toast('先選照片，再來貼貼圖'); return; }
  const st = {
    uid: uid++, seed: 1 + Math.floor(Math.random() * 99999), x: 0.5 + (Math.random() - 0.5) * 0.36, y: 0.5 + (Math.random() - 0.5) * 0.36,
    size: state.mode === 'four' ? (state.four.layout === 'strip' ? 0.5 : 0.32) : 0.26,
    rot: (Math.random() - 0.5) * 0.4, flip: false, ...obj,
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
  if (state.selected === st.uid) select(null); else { syncGlueUI(); requestRender(); }
}

function updateStickerBar() {
  const st = selectedSticker(), bar = $('#stickerBar');
  bar.hidden = !st;
  $('#app').dataset.selected = String(!!st);
  $('#stageTools').hidden = !!st || !hasContent();
  if (!st) { showColors = false; return; }
  const colorable = st.kind === 'text' || st.kind === 'tape' || (st.kind === 'svg' && isRecolorable(defOf(st)));
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
  if (st.kind === 'tape') return TAPE_COLORS;
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
let coarse = false; // 這次是手指（觸控）按的
function hitSticker(p, glued = false) {
  const pad = (coarse ? 12 : 6) * pxPerCss();
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const st = state.stickers[i];
    if (!!st.glued !== glued) continue;
    const { x, y, g } = toLocal(st, p);
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
  coarse = e.pointerType === 'touch' || e.pointerType === 'pen';
  const sel = selectedSticker();
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    if (sel) {
      gesture = { type: 'pinch', d0: dist(a, b) || 1, a0: ang(a, b), m0: mid(a, b), size0: sel.size, rot0: sel.rot, x0: sel.x, y0: sel.y };
    } else {
      cancelLongPress();
      const tgt = gesture?.type === 'photo' ? gesture.tgt : photoTargetAt(mid(a, b));
      if (tgt) gesture = { type: 'photoPinch', tgt, t0: { ...tgt.t }, d0: dist(a, b) || 1, a0: ang(a, b), m0: mid(a, b) };
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
    gesture = null;
    // 選中貼圖時沒按中：只取消選取，不要順便拖到底下的照片
    if (state.selected) { select(null); return; }
    const glued = hitSticker(p, true);
    if (glued) {
      // 黏住的貼圖：點一下提示，長按只撕下這一張
      toast('黏住了・長按可以撕下來');
      const id = e.pointerId, sx = e.clientX, sy = e.clientY;
      longPress = {
        id, sx, sy,
        timer: setTimeout(() => {
          longPress = null;
          glued.glued = false;
          select(glued.uid);
          syncGlueUI();
          const pp = pointers.get(id), g = stickerGeom(glued, lastL);
          if (pp) gesture = { type: 'move', ox: pp.x - g.cx, oy: pp.y - g.cy };
          toast('撕下來了，可以移動');
          navigator.vibrate?.(15);
        }, 550),
      };
    } else {
      const tgt = photoTargetAt(p);
      if (tgt) {
        if (tgt.cell != null && tgt.cell !== state.cropCell) { state.cropCell = tgt.cell; syncCropUI(); }
        gesture = { type: 'photo', tgt, t0: { ...tgt.t }, p0: p, moved: false };
      }
    }
  }
});
// 照片（或四格的某一格）在畫面上的位置與大小
function photoTargetAt(p) {
  if (state.mode === 'four') {
    const i = fourCellAt(p), ph = state.four.photos[i];
    if (i < 0 || !ph) return null;
    const L = fourLayout(state.four.layout), k = view.width / L.W, c = L.cells[i];
    return { cell: i, t: ph.t, w: c.w * k, h: c.h * k, iw: ph.preview.width, ih: ph.preview.height };
  }
  const L = lastL;
  if (state.frame.id === 'paper' && state.frame.cut && state.preview && L) {
    return { cut: state.frame.cut, t: state.frame.cut, w: L.pw, h: L.ph };
  }
  if (!state.preview || !L || p.x < L.x || p.y < L.y || p.x > L.x + L.pw || p.y > L.y + L.ph) return null;
  return { t: state.frame.crop, w: L.pw, h: L.ph, iw: state.preview.width, ih: state.preview.height };
}
const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(1, z));
const clampAngle = (a) => Math.min(ANGLE_MAX, Math.max(-ANGLE_MAX, a));
const xfHintShown = { single: false, four: false }; // 單張、四格各提示一次
let wheelTimer = 0;
let longPress = null;
const cancelLongPress = () => { if (longPress) { clearTimeout(longPress.timer); longPress = null; } };

view.addEventListener('pointermove', (e) => {
  if (!lastL) return;
  const p = toCanvas(e);
  if (!pointers.has(e.pointerId)) {
    if (e.pointerType === 'mouse') {
      const sel = selectedSticker(), h = sel && hitHandle(sel, p);
      view.style.cursor = h === 'rot' ? 'nwse-resize' : h === 'del' ? 'pointer' : hitSticker(p) ? 'move' : (!sel && photoTargetAt(p)) ? 'grab' : 'default';
    }
    return;
  }
  pointers.set(e.pointerId, p);
  if (longPress && Math.hypot(e.clientX - longPress.sx, e.clientY - longPress.sy) > 8) cancelLongPress();
  if (gesture?.type === 'photo' && pointers.size === 1) {
    const g = gesture, dx = p.x - g.p0.x, dy = p.y - g.p0.y;
    if (!g.moved && Math.hypot(dx, dy) < 4 * pxPerCss()) return;
    g.moved = true;
    if (g.tgt.cut) {
      g.tgt.cut.dx = (g.t0.dx || 0) + dx / g.tgt.w;
      g.tgt.cut.dy = (g.t0.dy || 0) + dy / g.tgt.h;
      requestRender();
      return;
    }
    state.dragging = 'photo';
    xfPan(g.tgt.t, g.t0, dx, dy, g.tgt.w, g.tgt.h, g.tgt.iw, g.tgt.ih);
    syncXfOutputs();
    requestRender();
    return;
  }
  if (gesture?.type === 'photoPinch' && pointers.size >= 2) {
    const g = gesture, [a, b] = [...pointers.values()], m = mid(a, b), t = g.tgt.t;
    if (g.tgt.cut) {
      t.s = Math.min(2.5, Math.max(0.4, ((g.t0.s || 1) * dist(a, b)) / g.d0));
      t.dx = (g.t0.dx || 0) + (m.x - g.m0.x) / g.tgt.w;
      t.dy = (g.t0.dy || 0) + (m.y - g.m0.y) / g.tgt.h;
      requestRender();
      return;
    }
    t.zoom = clampZoom((g.t0.zoom * dist(a, b)) / g.d0);
    t.angle = clampAngle(g.t0.angle + ((ang(a, b) - g.a0) * 180) / Math.PI);
    if (Math.abs(t.angle) < 1.5) t.angle = 0;
    xfPan(t, g.t0, m.x - g.m0.x, m.y - g.m0.y, g.tgt.w, g.tgt.h, g.tgt.iw, g.tgt.ih);
    state.dragging = 'photo';
    syncXfOutputs();
    requestRender();
    return;
  }
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
  cancelLongPress();
  if (gesture?.type === 'photo' || gesture?.type === 'photoPinch') {
    if (!pointers.size) { state.dragging = false; requestRender(); }
    else if (gesture.type === 'photoPinch') {
      const rest = [...pointers.values()][0];
      gesture = { type: 'photo', tgt: gesture.tgt, t0: { ...gesture.tgt.t }, p0: rest, moved: true };
    }
  }
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
  if (!sel) {
    const tgt = lastL && photoTargetAt(toCanvas(e));
    if (!tgt) return;
    e.preventDefault();
    if (tgt.cell != null && tgt.cell !== state.cropCell) { state.cropCell = tgt.cell; syncCropUI(); }
    if (tgt.cut) { tgt.cut.s = Math.min(2.5, Math.max(0.4, (tgt.cut.s || 1) * Math.exp(-e.deltaY * 0.0015))); requestRender(); return; }
    if (e.shiftKey) tgt.t.angle = clampAngle(tgt.t.angle + e.deltaY * 0.05);
    else tgt.t.zoom = clampZoom(tgt.t.zoom * Math.exp(-e.deltaY * 0.0015));
    state.dragging = 'photo';
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelTimer = 0; state.dragging = false; requestRender(); }, 250);
    syncXfOutputs();
    requestRender();
    return;
  }
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
    const first = !state.orig;
    if (state.full && state.full !== state.orig) state.full.width = 0;
    state.orig = c;
    state.full = null;
    state.rotation = 0;
    state.frame.crop = XF0();
    state.frame.cut = null;
    const d = (await readPhotoDate(file)) || (file.lastModified ? isoOf(new Date(file.lastModified)) : todayISO());
    state.photoDate = d;
    state.date.value = d;
    syncDateUI();
    buildSources();
    syncCropUI();
    refreshWorkspace();
    queueDateClear();
    if (first) resetHistory();
    if (first && !xfHintShown.single) { xfHintShown.single = true; setTimeout(() => toast(`照片可以放大、轉角度：按「裁切」，或直接${xfHowTo()}`, { ms: 5000 }), 600); }
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
  $('#btnSave').disabled = !has;
  updateStickerBar();
  if (has) { fitView(); requestRender(); } else { lastL = null; drawDeco(); }
}

const fileInput = $('#fileInput'), fourInput = $('#fourInput'), slotInput = $('#slotInput');
const pickPhoto = () => (state.mode === 'four' ? fourInput : fileInput).click();
$('#btnReplace').addEventListener('click', pickPhoto);
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
  const firstFour = !hasFour();
  // 一次換掉兩張以上（重選 4 張）：舊照片不留著復原，避免記憶體不夠
  const bulk = state.four.photos.filter((ph, i) => ph && ((i - startSlot + 4) % 4) < list.length).length > 1;
  if (bulk) {
    state.four.photos.forEach((ph, i) => { if (ph && ((i - startSlot + 4) % 4) < list.length) freePhoto(ph); });
  }
  for (const file of list) {
    try {
      const full = await decodeToCanvas(file, FOUR_SRC_SIDE);
      state.four.photos[slot] = { full, preview: downscale(full, 900), thumb: downscale(full, 240), ver: ++fourVer, t: XF0() };
      if (slot === startSlot) {
        const d = (await readPhotoDate(file)) || (file.lastModified ? isoOf(new Date(file.lastModified)) : todayISO());
        state.photoDate = d; state.date.value = d;
      }
    } catch (err) { console.error(err); failed++; if (bulk) state.four.photos[slot] = null; }
    slot = (slot + 1) % 4;
  }
  state.four.ver++;
  busy(false);
  syncDateUI();
  refreshFourSlots();
  refreshPresetThumbs(); refreshDoodleThumbs();
  refreshWorkspace();
  queueDateClear();
  syncCropUI();
  if (firstFour || bulk) resetHistory();
  if (!xfHintShown.four && !failed) { xfHintShown.four = true; setTimeout(() => toast(`每一格的照片都可以調整：${xfHowTo()}`, { ms: 5000 }), 300); }
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
  syncPaperUI();
}
function buildFourUI() {
  for (const [id, name] of FOUR_LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = name;
    b.addEventListener('click', () => { state.four.layout = id; cellCache.clear(); resetPhotoCache(); syncFourUI(); refreshWorkspace(); queueDateClear(); savePrefs(); });
    $('#fourLayouts').append(b);
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
  $$('[data-only]').forEach((el) => { el.hidden = el.dataset.only !== m; });
  doodleCache.key = '';
  resetPhotoCache();
  if (!initial) { refreshPresetThumbs(); refreshDoodleThumbs(); }
  refreshWorkspace();
  syncPaperUI();
  syncCropUI();
  if (!initial) syncCutUI();
  if (!initial) queueDateClear();
  history = histories[m];
  rebaseHistory();
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
  if (state.mode === 'four') {
    const t = xfTarget();
    if (t) { t.r90 = (t.r90 + 1) % 4; t.x = 0.5; t.y = 0.5; requestRender(); }
    return;
  }
  if (!state.orig) return;
  state.rotation = (state.rotation + 90) % 360;
  buildSources();
  requestRender();
  queueDateClear();
});

const cmp = $('#btnCompare');
const setCompare = (on) => { if (state.compare === on) return; state.compare = on; cmp.classList.toggle('on', on); requestRender(); };
cmp.addEventListener('pointerdown', (e) => { e.preventDefault(); try { cmp.setPointerCapture(e.pointerId); } catch { /* ignore */ } setCompare(true); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => cmp.addEventListener(t, () => setCompare(false)));
cmp.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------------------------------------------------------------- tabs
function setTab(t) {
  if (!PANES.includes(t)) t = 'film';
  if (t === 'crop') $('#xfHint').textContent = `直接在照片上${xfHowTo()}；也可以用下面的滑桿。`;
  state.tab = t;
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  $$('#stationery .tool[data-tool]').forEach((b) => { if (b.dataset.tool !== 'glue') b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
  $$('.pane').forEach((p) => { p.hidden = p.dataset.pane !== t; });
  const [title, hint] = PANE_INFO[t];
  $('#panelTitle').textContent = title;
  $('#panelHint').textContent = hint;
  $('#panel').dataset.pane = t;
  $('.tab-body').scrollTop = 0;
  if (t === 'crop') syncCropUI();
  requestRender();
  savePrefs();
}
const isPhone = () => matchMedia('(max-width: 899px)').matches;
// 電腦：面板是浮在畫布上的小視窗，點底部工具才出現；拖標題移動、拖右下角改大小，位置會記住
const WIN_KEY = 'filmdoodle:win';
function loadWin() {
  try { const w = JSON.parse(localStorage.getItem(WIN_KEY) || 'null'); if (w && [w.x, w.y, w.w, w.h].every(Number.isFinite)) return w; } catch { /* ignore */ }
  return null;
}
function placeWin() {
  const p = $('#panel'), ws = $('.workspace');
  if (isPhone()) { p.style.left = p.style.top = p.style.width = p.style.height = ''; return; }
  const W = ws.clientWidth, H = ws.clientHeight, saved = loadWin();
  let w = saved?.w ?? 380, h = saved?.h ?? Math.min(620, H - 150);
  w = Math.min(Math.max(300, w), W - 24); h = Math.min(Math.max(240, h), H - 24);
  let x = saved?.x ?? 24, y = saved?.y ?? 16;
  x = Math.min(Math.max(8, x), W - w - 8); y = Math.min(Math.max(8, y), H - h - 8);
  Object.assign(p.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
}
function saveWin() {
  const p = $('#panel');
  try { localStorage.setItem(WIN_KEY, JSON.stringify({ x: p.offsetLeft, y: p.offsetTop, w: p.offsetWidth, h: p.offsetHeight })); } catch { /* ignore */ }
}
(() => {
  const head = $('.panel-head');
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (isPhone() || e.target.closest('button')) return;
    const p = $('#panel');
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: p.offsetLeft, y: p.offsetTop };
    head.setPointerCapture(e.pointerId);
    head.classList.add('dragging');
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = $('#panel'), ws = $('.workspace');
    const x = Math.min(Math.max(0, drag.x + e.clientX - drag.sx), ws.clientWidth - 80);
    const y = Math.min(Math.max(0, drag.y + e.clientY - drag.sy), ws.clientHeight - 60);
    p.style.left = x + 'px'; p.style.top = y + 'px';
  });
  const end = () => { if (drag) { drag = null; head.classList.remove('dragging'); saveWin(); } };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
  // 拖右下角改大小（CSS resize）之後記住
  new ResizeObserver(() => { if (!isPhone() && $('#app').dataset.panel !== 'closed') saveWin(); }).observe($('#panel'));
  addEventListener('resize', () => { if ($('#app').dataset.panel !== 'closed') placeWin(); });
})();
function setPanel(open) {
  $('#app').dataset.panel = open ? 'open' : 'closed';
  // 收起時，分頁和文具都不顯示選中（看得出面板是關著的）
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(open && b.dataset.tab === state.tab)));
  $$('#stationery .tool[data-tool]').forEach((b) => { if (b.dataset.tool !== 'glue') b.setAttribute('aria-pressed', String(open && b.dataset.tool === state.tab)); });
  if (open) placeWin();
  fitView();
}
function togglePane(t, isTool = false) {
  const closed = $('#app').dataset.panel === 'closed';
  // 文具再點一次可以收起面板（主分頁不收，用面板上的「收起」）
  if (t === state.tab && !closed && (isTool || !isPhone())) { setPanel(false); return; }
  setTab(t);
  // 四格在手機上格子很小：打開裁切時先把面板收起來，照片大一點
  if (t === 'crop' && state.mode === 'four' && state.cropMode !== 'cut' && isPhone() && hasFour() && closed === false) {
    setPanel(false);
    toast('面板先收起來，照片比較大；再點一次「裁切」可以打開滑桿和「剪下形狀」', { ms: 4000 });
    return;
  }
  setPanel(true);
}
$('#btnPanelClose').addEventListener('click', () => setPanel(false));
$$('.tabs button').forEach((b) => b.addEventListener('click', () => togglePane(b.dataset.tab)));
$$('[data-goto]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.goto)));

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
  dice.type = 'button'; dice.className = 'chip'; dice.textContent = '換位置';
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
  const cr = computeCrop(src.width, src.height, cropAspect(id, src.width, src.height, state.frame.ratio), 0.5);
  const k = Math.min(1, 150 / Math.max(cr.w, cr.h));
  const pw = Math.max(1, Math.round(cr.w * k)), ph = Math.max(1, Math.round(cr.h * k));
  const photo = makeCanvas(pw, ph);
  photo.getContext('2d').drawImage(src, cr.x, cr.y, cr.w, cr.h, 0, 0, pw, ph);
  const o = { color: FRAME_COLORS[0], slideColor: '#f4f1ea', archColor: state.frame.archColor, caption: '', filmNo: 12, seed: 7, dateText: '', paper: state.frame.paper };
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
function selectFrame(id, inStep = false) {
  if (!inStep) commitHistory(); // 從「貼在手帳紙上」呼叫時已經存過，避免拆成兩步
  if (state.frame.cut && id !== 'paper') {
    state.frame.cut = null;
    setTimeout(() => toast('剪下的形狀只能用在手帳紙，已恢復方形照片', { label: '復原', run: undo }), 0);
  }
  state.frame.id = id;
  state.frame.crop.x = 0.5; state.frame.crop.y = 0.5;
  $$('#frameList .card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  updateFrameOpts();
  syncPaperUI();
  requestRender();
  queueDateClear();
  savePrefs();
}
function updateFrameOpts() {
  const f = FRAMES.find((x) => x.id === state.frame.id) || FRAMES[0];
  const src = state.preview;
  const axis = src ? computeCrop(src.width, src.height, cropAspect(f.id, src.width, src.height, state.frame.ratio), 0.5).axis : null;
  $('#optCropLink').hidden = !src;
  syncPaperUI();
  syncCropUI();
  $('#optColor').hidden = !f.colors;
  if (f.colors) {
    const slide = f.id === 'slide';
    const key = f.colorKey || (slide ? 'slideColor' : 'color');
    buildSwatches($('#frameColors'), Array.isArray(f.colors) ? f.colors : FRAME_COLORS, state.frame[key], (c) => {
      state.frame[key] = c;
      if (f.colorKey) refreshFrameThumbs();
      updateFrameOpts(); requestRender(); savePrefs();
    });
  }
}

// ---------------------------------------------------------------- 剪刀：比例、取景、旋轉；四格每一格的取景
function buildCropUI() {
  for (const [r, name] of RATIOS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.r = String(r); b.textContent = name;
    b.addEventListener('click', () => {
      if (!FREE_RATIO_FRAMES.has(state.frame.id)) return;
      state.frame.ratio = r; state.frame.crop.x = 0.5; state.frame.crop.y = 0.5;
      updateFrameOpts(); refreshFrameThumbs(); requestRender(); queueDateClear(); savePrefs();
    });
    $('#cropRatios').append(b);
  }
  $('#xfZoom').addEventListener('input', (e) => {
    const t = xfTarget();
    if (!t) return;
    t.zoom = +e.target.value / 100;
    state.dragging = 'photo'; syncXfOutputs(); requestRender();
  });
  $('#xfAngle').addEventListener('input', (e) => {
    const t = xfTarget();
    if (!t) return;
    t.angle = +e.target.value;
    state.dragging = 'photo'; syncXfOutputs(); requestRender();
  });
  ['#xfZoom', '#xfAngle'].forEach((id) => $(id).addEventListener('change', () => { state.dragging = false; requestRender(); }));
  $('#btnXfReset').addEventListener('click', () => {
    const t = xfTarget();
    if (!t) return;
    Object.assign(t, XF0(), state.mode === 'four' ? {} : { r90: 0 });
    syncCropUI(); requestRender();
  });
}
// 目前裁切的對象：單張＝整張照片，四格＝選中的那一格
function xfTarget() {
  if (state.mode === 'four') return state.four.photos[state.cropCell]?.t || null;
  return state.preview ? state.frame.crop : null;
}
function syncXfOutputs() {
  const t = xfTarget() || XF0();
  $('#xfZoom').value = Math.round(t.zoom * 100);
  $('#xfZoom').parentElement.querySelector('output').textContent = `${Math.round(t.zoom * 100)}%`;
  $('#xfAngle').value = Math.round(t.angle);
  $('#xfAngle').parentElement.querySelector('output').textContent = `${Math.round(t.angle)}°`;
}
function syncCropUI() {
  // 單張
  const f = state.frame, free = FREE_RATIO_FRAMES.has(f.id), src = state.preview;
  $$('#cropRatios .chip').forEach((b) => {
    b.setAttribute('aria-pressed', String(free && +b.dataset.r === f.ratio));
    b.disabled = !free;
  });
  const note = $('#ratioNote');
  note.hidden = free;
  if (!free) note.textContent = `「${(FRAMES.find((x) => x.id === f.id) || FRAMES[0]).name}」固定 ${FIXED_RATIO[f.id] || '比例'}；想自由裁切，先到「相框」選無邊框、白邊相紙、粗糙黑邊或手帳紙。`;
  // 四格：在照片上直接點／拖一格（選中的格子有外框）
  if (!state.four.photos[state.cropCell]) state.cropCell = Math.max(0, state.four.photos.findIndex(Boolean));
  $('#xfTarget').textContent = state.four.photos[state.cropCell] ? `正在調整：第 ${state.cropCell + 1} 格` : '先放照片';
  const has = !!xfTarget();
  ['#xfZoom', '#xfAngle', '#btnXfReset'].forEach((id) => { $(id).disabled = !has; });
  $('#btnRotate').disabled = !has;
  syncXfOutputs();
}
// 四格＋裁切：點到的是哪一格
function fourCellAt(p) {
  const L = fourLayout(state.four.layout), k = view.width / L.W;
  return L.cells.findIndex((c) => p.x >= c.x * k && p.x <= (c.x + c.w) * k && p.y >= c.y * k && p.y <= (c.y + c.h) * k);
}
function drawCellOutline(ctx) {
  const L = fourLayout(state.four.layout), k = view.width / L.W, c = L.cells[state.cropCell], px = pxPerCss();
  if (!c || !state.four.photos[state.cropCell]) return;
  ctx.save();
  ctx.lineWidth = 3 * px;
  ctx.strokeStyle = '#ff6f91';
  ctx.setLineDash([8 * px, 6 * px]);
  ctx.strokeRect(c.x * k + 2 * px, c.y * k + 2 * px, c.w * k - 4 * px, c.h * k - 4 * px);
  ctx.restore();
}

// ---------------------------------------------------------------- 相紙（四格）／手帳紙（單張）：都在「相框」
function buildPaperUI() {
  for (const pp of PAPERS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch paper'; b.dataset.id = pp.id;
    b.style.background = pp.swatch;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-label', pp.name); b.title = pp.name;
    b.addEventListener('click', () => {
      if (state.mode === 'four') state.four.paper = pp.id;
      else { state.frame.paper = pp.id; refreshFrameThumbs(); }
      syncPaperUI(); requestRender(); savePrefs();
    });
    $('#paperList').append(b);
  }
}
function syncPaperUI() {
  const four = state.mode === 'four';
  $('#optPaper').hidden = !four && state.frame.id !== 'paper';
  const cur = four ? state.four.paper : state.frame.paper;
  $$('#paperList .swatch').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === cur)));
  $('#paperLabel').textContent = four ? '相紙' : '紙張';
}

// ---------------------------------------------------------------- doodle frames（塗鴉框）
function buildDoodlePane() {
  const box = $('#doodleList');
  let cuteLabel = false;
  for (const p of DOODLE_PRESETS) {
    if (p.group === 'cute' && !cuteLabel) {
      cuteLabel = true;
      const h = document.createElement('p');
      h.className = 'cards-divider';
      h.textContent = '可愛系列';
      box.append(h);
    }
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
  for (const [id, name] of [['few', '少'], ['mid', '中'], ['many', '多']]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = name;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => {
      state.doodle.count = amountOf(id);
      state.doodle.countTouched = true;
      syncDoodleUI(); requestRender(); savePrefs();
    });
    $('#doodleAmounts').append(b);
  }
  $('#doodleScale').addEventListener('input', (e) => { state.doodle.scale = +e.target.value; syncDoodleUI(); requestRender(); savePrefs(); });
  const stepCount = (d) => {
    const [mn, mx] = countRange();
    state.doodle.count = Math.min(mx, Math.max(mn, state.doodle.count + (overlayKind() ? Math.sign(d) : d)));
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

// 數量的範圍與「少／中／多」：一般塗鴉 4–30；整體畫面款式各自的範圍
function countRange() {
  const ov = overlayKind();
  return ov ? OVERLAY_COUNT[ov] : [COUNT_MIN, COUNT_MAX];
}
function amountOf(id) {
  const [mn, mx] = countRange();
  if (overlayKind()) return id === 'few' ? mn : id === 'many' ? mx : Math.round((mn + mx) / 2);
  return { few: 8, mid: 16, many: 26 }[id];
}
function selectDoodle(id) {
  const p = DOODLE_PRESETS.find((x) => x.id === id);
  state.doodle.preset = id;
  state.doodle.glow = null; // 換款式時光暈回到這一款的預設
  if (p.pack) {
    Object.assign(state.doodle, { pack: p.pack, layout: p.layout });
    // 使用者自己調過數量就保留那個數字，沒調過就用這一款的預設
    if (!state.doodle.countTouched) state.doodle.count = p.count;
  }
  // 整體畫面款式一律用自己的預設數量（主角才會留白）
  if (p.overlay) state.doodle.count = p.count;
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
  $$('#doodleList .card, #doodleCute .card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === d.preset)));
  $('#doodleOpts').hidden = d.preset === 'none';
  // 整體畫面款式：沒有排列、風格包、光暈、轉成貼圖；數量是圖案多少
  const ov = overlayKind();
  $('#doodleOpts').dataset.overlay = String(!!ov);
  $('#doodleLayoutRow').hidden = !!ov;
  $('#btnDoodleEdit').hidden = !!ov;
  if (ov) { const [mn, mx] = OVERLAY_COUNT[ov]; d.count = Math.min(mx, Math.max(mn, d.count)); }
  $('#doodleCountOut').textContent = `${d.count} 個`;
  $$('#doodleLayouts .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === d.layout)));
  $('#doodleCountOut').textContent = `${d.count} 個`;
  const [cmn, cmx] = countRange();
  $('#doodleLess').disabled = d.count <= cmn;
  $('#doodleMore').disabled = d.count >= cmx;
  $$('#doodleAmounts .chip').forEach((b) => b.setAttribute('aria-checked', String(amountOf(b.dataset.id) === d.count)));
  $('#doodleScale').value = d.scale;
  $('#doodleScale').parentElement.querySelector('output').textContent = `${d.scale}%`;
  $('#doodleGlow').closest('.slider').hidden = !!PACKS[d.pack]?.noGlow;
  const g = Math.round((d.glow ?? PACKS[d.pack]?.glow ?? 0) * 100);
  $('#doodleGlow').value = g;
  $('#doodleGlow').parentElement.querySelector('output').textContent = g;
}

let doodleThumbJob = 0;
function refreshDoodleThumbs() {
  const job = ++doodleThumbJob, src = thumbSrc() || SAMPLE;
  const cards = $$('#doodleList .card, #doodleCute .card');
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
    } else if (p.overlay) {
      drawOverlay(p.overlay, ctx, c.width, c.height, { count: p.count, scale: 100, seed: state.doodle.seed }, null);
    }
    setTimeout(step, 0);
  };
  step();
}

// ---------------------------------------------------------------- sticker panel
function buildStickerPanel() {
  const cats = $('#stickerCats');
  for (const [id, name] of STICKER_GROUPS) {
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
  if (state.cat === 'mine') { renderMine(grid); return; }
  const list = STICKERS.filter((def) => !HIDDEN_CATS.has(def.cat) && !HIDDEN_IDS.has(def.id) && (state.cat === 'all' || groupOf(def) === state.cat));
  list.sort((a, b) => GROUP_ORDER[groupOf(a)] - GROUP_ORDER[groupOf(b)]);
  for (const def of list) {
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
// 「我的」：這次上傳或剪下的圖（只存在這次打開的頁面，不會存到任何地方）
function renderMine(grid) {
  if (!state.mine.length) {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = '還沒有。按「新增 → 匯入圖片來剪」或「剪這張照片」，剪好的會出現在這裡（只保留在這次打開的頁面）。';
    grid.append(p);
    return;
  }
  state.mine.forEach((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `我的貼圖 ${i + 1}`);
    const c = makeCanvas(112, 112), ctx = c.getContext('2d'), k = 100 / Math.max(m.img.width, m.img.height);
    ctx.drawImage(m.img, 56 - (m.img.width * k) / 2, 56 - (m.img.height * k) / 2, m.img.width * k, m.img.height * k);
    b.append(c);
    b.addEventListener('click', () => addSticker({ kind: 'img', img: m.img, size: m.size || 0.32 }));
    grid.append(b);
  });
}
function addMine(img, size) {
  state.mine.unshift({ img, size });
  if (state.mine.length > 12) state.mine.length = 12;
  if (state.cat === 'mine') renderStickerGrid();
  renderCutHistory();
}
$('#glow').addEventListener('change', (e) => { state.glow = e.target.checked; requestRender(); savePrefs(); });
$('#btnClearStickers').addEventListener('click', () => {
  if (!state.stickers.length) { toast('照片上還沒有貼圖'); return; }
  state.stickers = []; select(null);
  toast('已清除全部貼圖', { label: '復原', run: undo });
});
const stickerInput = $('#stickerInput');
$('#btnUploadSticker').addEventListener('click', () => {
  if (!hasContent()) { toast('先選照片，再來剪貼'); return; }
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
    const up = downscale(c, 1200);
    if (hasTransparency(up)) { addMine(up, 0.32); addSticker({ kind: 'img', img: up, size: 0.32 }); }
    else openCut({ img: up });
  } catch {
    toast('這個貼圖檔打不開，請用 PNG');
  } finally {
    URL.revokeObjectURL(url);
  }
});

// ---------------------------------------------------------------- 剪下：剪紙台
// 一指沿著主體畫一圈 → 自動平滑、白紙邊、剪刀折線；兩指只放大檢視（不改照片取景）
const cut = { src: null, cell: -1, replaceUid: null, ctrl: [], closed: false, hist: [], mode: 'draw', dragPt: -1, drawing: null, view: { k: 1, x: 0, y: 0 }, margin: 'thin', seed: 1, pts: new Map(), pinch: null };
function cutSourceImage() {
  // 剪的是「已經套好色調」的照片，貼上去才和畫面一致
  if (cut.src) return cut.src;
  if (state.mode === 'four') {
    const ph = state.four.photos[cut.cell];
    if (!ph) return null;
    const L = fourLayout(state.four.layout), c = L.cells[cut.cell], k = 900 / Math.max(c.w, c.h);
    const w = Math.round(c.w * k), h = Math.round(c.h * k);
    return applyFx(developBase(ph.preview, xfCrop(ph.preview.width, ph.preview.height, L.aspect, ph.t), w, h, { preset: state.preset, adj: state.adj, lutN: 33 }), { adj: state.adj, date: null }, null, true);
  }
  // 複製一份：預覽的快取之後會被釋放
  const pv = getPreviewPhoto(), c = makeCanvas(pv.width, pv.height);
  c.getContext('2d').drawImage(pv, 0, 0);
  return c;
}
function openCut(opt = {}) {
  if (!opt.img && !hasContent()) { toast('先選照片'); return; }
  cut.src = opt.img || null;
  cut.replaceUid = opt.replaceUid ?? null;
  cut.cell = state.mode === 'four' ? (state.four.photos[state.cropCell] ? state.cropCell : state.four.photos.findIndex(Boolean)) : -1;
  cut.ctrl = []; cut.closed = false; cut.hist = [];
  cut.view = { k: 1, x: 0, y: 0 };
  cut.margin = state.frame.cut?.margin || 'thin';
  cut.seed = 1 + Math.floor(Math.random() * 9999);
  cut.image = cutSourceImage();
  const cells = $('#cutCells');
  cells.hidden = !(state.mode === 'four' && !cut.src);
  if (!cells.hidden) {
    cells.innerHTML = '';
    state.four.photos.forEach((ph, i) => {
      if (!ph) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = `第 ${i + 1} 格`;
      b.setAttribute('aria-pressed', String(i === cut.cell));
      b.addEventListener('click', () => { cut.cell = i; cut.ctrl = []; cut.closed = false; cut.hist = []; cut.image = cutSourceImage(); openCutSync(); $$('#cutCells .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
      cells.append(b);
    });
  }
  const pasteOk = state.mode === 'single' && !cut.src;
  $('#btnCutPaste').hidden = !pasteOk;
  $('#btnCutWhole').hidden = !cut.src;
  $('#btnCutSticker').className = pasteOk ? 'ghost-btn' : 'primary-btn';
  $('#cutTip').textContent = finePointer() ? '沿著要留的地方拖曳畫一圈・滾輪放大檢視' : '用手指沿著要留的地方畫一圈・兩指放大檢視';
  $('#cutDialog').showModal();
  requestAnimationFrame(() => { fitCutCanvas(); openCutSync(); });
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
function pushCutHist() { cut.hist.push({ ctrl: cut.ctrl.map((p) => p.slice()), closed: cut.closed }); if (cut.hist.length > 40) cut.hist.shift(); }
function openCutSync() {
  const has = cut.closed && cut.ctrl.length >= 3;
  $('#btnCutPaste').disabled = !has;
  $('#btnCutSticker').disabled = !has;
  $('#btnCutUndo').disabled = !cut.hist.length;
  $('#btnCutClose').hidden = !(cut.mode === 'points' && !cut.closed && cut.ctrl.length >= 3);
  $$('[data-cutmode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.cutmode === cut.mode)));
  $('#cutTip').hidden = cut.ctrl.length > 0;
  $('#cutTip').textContent = cut.mode === 'points'
    ? '沿著主角一點一點點下去，點回第一個點就連成形狀'
    : (finePointer() ? '沿著要留的地方拖曳畫一圈・滾輪放大檢視' : '用手指沿著要留的地方畫一圈・兩指放大檢視');
  $$('#cutMargins .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === cut.margin)));
  drawCut();
}
function fitCutCanvas() {
  const c = $('#cutCanvas'), st = $('#cutStage'), dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(st.clientWidth * dpr); c.height = Math.round(st.clientHeight * dpr);
  c.style.width = st.clientWidth + 'px'; c.style.height = st.clientHeight + 'px';
}
// 照片在剪紙台畫布上的位置（含放大檢視）
function cutRect() {
  const c = $('#cutCanvas'), img = cut.image, pad = 18 * Math.min(2, window.devicePixelRatio || 1);
  const k0 = Math.min((c.width - pad * 2) / img.width, (c.height - pad * 2) / img.height), k = k0 * cut.view.k;
  const w = img.width * k, h = img.height * k;
  return { x: (c.width - w) / 2 + cut.view.x, y: (c.height - h) / 2 + cut.view.y, w, h };
}
const curCut = () => (cut.closed && cut.ctrl.length >= 3 ? { pts: splineLoop(cut.ctrl), margin: cut.margin, seed: cut.seed } : null);
function drawCut() {
  const c = $('#cutCanvas'), ctx = c.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  if (!cut.image) return;
  const R = cutRect();
  ctx.drawImage(cut.image, R.x, R.y, R.w, R.h);
  const cc = curCut();
  if (cc) { ctx.save(); ctx.translate(R.x, R.y); drawCutPreview(ctx, R.w, R.h, cc); ctx.restore(); }
  // 控制點：可以拖來修（形狀還沒連起來時，顯示點和連線）
  if (cut.ctrl.length) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.save();
    if (!cut.closed) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * dpr; ctx.setLineDash([7, 5]);
      ctx.beginPath();
      cut.ctrl.forEach(([x, y], i) => { const X = R.x + x * R.w, Y = R.y + y * R.h; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    cut.ctrl.forEach(([x, y], i) => {
      const X = R.x + x * R.w, Y = R.y + y * R.h, r = (i === 0 && !cut.closed ? 9 : 6.5) * dpr;
      ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2);
      ctx.fillStyle = i === cut.dragPt ? '#cb8875' : '#fffdf6';
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0; ctx.lineWidth = 1.6 * dpr; ctx.strokeStyle = '#655047'; ctx.stroke();
    });
    ctx.restore();
  }
  if (cut.drawing && cut.drawing.length > 1) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 * Math.min(2, window.devicePixelRatio || 1);
    ctx.setLineDash([8, 6]);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 4;
    ctx.beginPath();
    cut.drawing.forEach(([x, y], i) => { const X = R.x + x * R.w, Y = R.y + y * R.h; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
    ctx.stroke();
    ctx.restore();
  }
}
function cutPoint(e) {
  const c = $('#cutCanvas'), r = c.getBoundingClientRect(), R = cutRect();
  const px = ((e.clientX - r.left) * c.width) / r.width, py = ((e.clientY - r.top) * c.height) / r.height;
  return { px, py, x: (px - R.x) / R.w, y: (py - R.y) / R.h };
}
function buildCutUI() {
  for (const [id, name] of MARGINS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = name;
    b.addEventListener('click', () => { cut.margin = id; openCutSync(); });
    $('#cutMargins').append(b);
  }
  const c = $('#cutCanvas');
  c.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = cutPoint(e);
    cut.pts.set(e.pointerId, p);
    if (cut.pts.size === 2) {
      cut.drawing = null; cut.dragPt = -1;
      const [a, b] = [...cut.pts.values()];
      cut.pinch = { d0: Math.hypot(a.px - b.px, a.py - b.py) || 1, k0: cut.view.k, x0: cut.view.x, y0: cut.view.y, m0: { x: (a.px + b.px) / 2, y: (a.py + b.py) / 2 } };
    } else if (cut.pts.size === 1) {
      const R = cutRect(), hitR = 22 * Math.min(2, window.devicePixelRatio || 1);
      const near = cut.ctrl.findIndex(([x, y]) => Math.hypot(R.x + x * R.w - p.px, R.y + y * R.h - p.py) < hitR);
      if (cut.mode === 'points' && !cut.closed && near === 0 && cut.ctrl.length >= 3) { pushCutHist(); cut.closed = true; openCutSync(); return; }
      if (near >= 0) { pushCutHist(); cut.dragPt = near; }
      else if (cut.mode === 'points') { if (!cut.closed) { pushCutHist(); cut.ctrl.push([clamp01(p.x), clamp01(p.y)]); openCutSync(); } }
      else cut.drawing = [[p.x, p.y]];
    }
    drawCut();
  });
  c.addEventListener('pointermove', (e) => {
    if (!cut.pts.has(e.pointerId)) return;
    const p = cutPoint(e);
    cut.pts.set(e.pointerId, p);
    if (cut.pinch && cut.pts.size >= 2) {
      const [a, b] = [...cut.pts.values()], m = { x: (a.px + b.px) / 2, y: (a.py + b.py) / 2 };
      cut.view.k = Math.min(5, Math.max(1, (cut.pinch.k0 * Math.hypot(a.px - b.px, a.py - b.py)) / cut.pinch.d0));
      cut.view.x = cut.pinch.x0 + m.x - cut.pinch.m0.x;
      cut.view.y = cut.pinch.y0 + m.y - cut.pinch.m0.y;
    } else if (cut.dragPt >= 0) cut.ctrl[cut.dragPt] = [clamp01(p.x), clamp01(p.y)];
    else if (cut.drawing) cut.drawing.push([p.x, p.y]);
    drawCut();
  });
  const end = (e) => {
    cut.pts.delete(e.pointerId);
    if (cut.pts.size) return;
    if (cut.pinch) { cut.pinch = null; drawCut(); return; }
    if (cut.dragPt >= 0) { cut.dragPt = -1; openCutSync(); return; }
    const raw = cut.drawing;
    cut.drawing = null;
    if (!raw) return;
    const clamped = raw.map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))]);
    // 容錯：沒有畫回起點也會自動連起來；太小才請使用者重畫
    const loop = smoothLoop(clamped);
    if (!loop || Math.abs(polyArea(loop)) < 0.004) { toast('再畫大一點，繞著主角畫一圈'); drawCut(); return; }
    pushCutHist();
    cut.ctrl = toCtrl(loop, 18); cut.closed = true;
    toast('可以拖白色的點來修形狀', { ms: 2600 });
    openCutSync();
  };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    cut.view.k = Math.min(5, Math.max(1, cut.view.k * Math.exp(-e.deltaY * 0.0015)));
    if (cut.view.k === 1) { cut.view.x = 0; cut.view.y = 0; }
    drawCut();
  }, { passive: false });
  $('#btnCutUndo').addEventListener('click', () => { const h = cut.hist.pop(); if (h) { cut.ctrl = h.ctrl; cut.closed = h.closed; } openCutSync(); });
  $('#btnCutRedo').addEventListener('click', () => { pushCutHist(); cut.ctrl = []; cut.closed = false; cut.view = { k: 1, x: 0, y: 0 }; openCutSync(); });
  $$('[data-cutmode]').forEach((b) => b.addEventListener('click', () => { cut.mode = b.dataset.cutmode; openCutSync(); }));
  $('#btnCutClose').addEventListener('click', () => { if (cut.ctrl.length >= 3) { pushCutHist(); cut.closed = true; openCutSync(); } });
  $('#btnCutWhole').addEventListener('click', () => {
    const img = cut.src;
    $('#cutDialog').close();
    if (!img) return;
    addMine(img, 0.32);
    addSticker({ kind: 'img', img, size: 0.32 });
  });
  $('#btnCutCancel').addEventListener('click', () => $('#cutDialog').close());
  $('#btnCutPaste').addEventListener('click', () => {
    const cc = curCut();
    if (!cc) return;
    commitHistory();
    const was = state.frame.id;
    state.frame.cut = cc;
    $('#cutDialog').close();
    if (was !== 'paper') { selectFrame('paper', true); state.frame.cut = cc; toast('已換成「手帳紙」相框', { label: '復原', run: undo }); }
    syncCutUI(); syncPaperUI(); requestRender(); savePrefs();
  });
  $('#btnCutSticker').addEventListener('click', () => {
    const cc = curCut();
    if (!cc) return;
    commitHistory();
    const img = makeCutSticker(cut.image, cc);
    $('#cutDialog').close();
    if (cut.replaceUid != null) state.stickers = state.stickers.filter((s) => s.uid !== cut.replaceUid);
    if (cut.src) state.mine = state.mine.filter((m) => m.img !== cut.src); // 剪好的取代方形原圖
    addMine(img, 0.4);
    addSticker({ kind: 'img', img, size: 0.4 });
    toast('剪好了；「貼圖 → 我的」裡也找得到');
  });
  window.addEventListener('resize', () => { if ($('#cutDialog').open) { fitCutCanvas(); drawCut(); } });
  // 裁切面板：取景／剪下形狀
  $('#btnCutStart').addEventListener('click', () => openCut());
  $('#btnCutCell').addEventListener('click', () => openCut());
  $('#btnCutClear').addEventListener('click', () => { commitHistory(); state.frame.cut = null; syncCutUI(); requestRender(); toast('已恢復方形照片', { label: '復原', run: undo }); });
}
function syncCutUI() {
  $('#btnCutClear').hidden = !(state.mode === 'single' && state.frame.cut);
  renderCutHistory();
}
// 剪過的紀錄（這次打開的頁面裡剪下或匯入的圖），點一下再貼一次
function renderCutHistory() {
  const box = $('#cutHistory');
  if (!box) return;
  box.innerHTML = '';
  renderMine(box);
}

// ---------------------------------------------------------------- 文具：紙膠帶
function buildTapeUI() {
  const grid = $('#tapeGrid');
  // 材質：選了會套到之後貼的膠帶；選中的膠帶也一起換
  const mats = $('#tapeMats');
  if (!mats.children.length) {
    for (const [id, name] of TAPE_MATERIALS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = name;
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => {
        state.tapeMat = id;
        const st = selectedSticker();
        if (st?.kind === 'tape') st.material = id;
        buildTapeUI(); requestRender(); savePrefs();
      });
      mats.append(b);
    }
  }
  $$('#tapeMats .chip').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === state.tapeMat)));
  grid.innerHTML = '';
  for (const t of TAPES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `${t.name}紙膠帶`);
    b.title = t.name;
    const c = makeCanvas(200, 80), ctx = c.getContext('2d');
    ctx.translate(100, 40);
    ctx.rotate(-0.06);
    drawTape(ctx, 180, 180 * TAPE_RATIO, t, t.color, 5, state.tapeMat);
    const n = document.createElement('span'); n.textContent = t.name;
    b.append(c, n);
    // 第一條貼在照片上緣中間（像把照片貼在手帳上），之後輪流換到下緣、四個角
    b.addEventListener('click', () => {
      const n = state.stickers.filter((x) => x.kind === 'tape').length, db = dateBoxNorm();
      const near = ([sx, sy]) => db && sx > db.x0 - 0.15 && sx < db.x1 + 0.15 && sy > db.y0 - 0.15 && sy < db.y1 + 0.15;
      let k = n;
      while (k < n + TAPE_SPOTS.length && near(TAPE_SPOTS[k % TAPE_SPOTS.length])) k++;
      const [x, y, rot, size] = TAPE_SPOTS[k % TAPE_SPOTS.length];
      addSticker({ kind: 'tape', id: t.id, color: t.color, material: state.tapeMat, size: state.mode === 'four' ? size * 1.15 : size, x, y, rot: rot + (Math.random() - 0.5) * 0.16 });
    });
    grid.append(b);
  }
}

// ---------------------------------------------------------------- 膠水：把貼圖黏好（點照片不會再選到、拖動）
function glueState() {
  const n = state.stickers.length, glued = state.stickers.filter((s) => s.glued).length;
  return { n, glued, all: n > 0 && glued === n };
}
function useGlue() {
  const g = glueState();
  if (!g.n) { toast('還沒有貼圖可以黏；先加一些貼圖或紙膠帶'); return; }
  if (g.all) {
    state.stickers.forEach((s) => { s.glued = false; });
    toast('撕開了，貼圖可以再移動');
  } else {
    state.stickers.forEach((s) => { s.glued = true; });
    select(null);
    toast(`${g.n} 個貼圖都黏好了，不會再被拖動`);
  }
  syncGlueUI();
  requestRender();
}
function syncGlueUI() {
  const b = $('#stationery .tool[data-tool="glue"]');
  if (!b) return;
  const g = glueState();
  b.setAttribute('aria-pressed', String(g.all));
  b.classList.toggle('glued', g.all);
  b.querySelector('.tool-name').textContent = g.all ? '已黏' : TOOL_INFO.glue.name;
  const label = g.all ? '膠水：全部已黏好，按一下全部撕開（長按單一貼圖可以只撕那一張）' : TOOL_INFO.glue.tip;
  b.setAttribute('aria-label', label);
  b.dataset.tip = label;
}

// ---------------------------------------------------------------- 文具工具列（順序可以自己調）
// 文具：用色鉛筆筆刷畫在 canvas 上（和貼圖同一種質感），一根一根橫躺
function toolArt(id) {
  const def = STICKERS.find((d) => d.id === id), c = document.createElement('canvas');
  c.className = 'tool-art';
  c.setAttribute('aria-hidden', 'true');
  if (!def) return c;
  const [vw, vh] = stickerBox(def), dpr = Math.min(3, window.devicePixelRatio || 1), cssW = 76, cssH = (cssW * vh) / vw;
  c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
  const ctx = c.getContext('2d'), k = c.width / vw;
  ctx.scale(k, k);
  drawStickerDef(ctx, def, def.color, k, 0, 1, 5);
  return c;
}
function buildStationery() {
  const bar = $('#stationery');
  bar.innerHTML = '';
  for (const t of state.tools.order) {
    if (state.tools.hidden.includes(t)) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool';
    b.dataset.tool = t;
    b.dataset.tip = TOOL_INFO[t].tip;
    b.setAttribute('aria-label', TOOL_INFO[t].tip);
    if (t !== 'glue') b.setAttribute('aria-pressed', String(state.tab === t));
    const n = document.createElement('span'); n.className = 'tool-name'; n.textContent = TOOL_INFO[t].name;
    b.append(toolArt(`tl_${t}`), n);
    b.addEventListener('click', () => useTool(t));
    bar.append(b);
  }
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'tool tool-edit';
  edit.dataset.tip = '整理工具列：調整順序、收起不常用的';
  edit.setAttribute('aria-label', '整理文具工具列（收起來的工具也在這裡）');
  edit.append(toolArt('tl_more'));
  edit.insertAdjacentHTML('beforeend', '<span class="tool-name">整理</span>');
  edit.addEventListener('click', openToolsDialog);
  bar.append(edit);
  syncGlueUI();
}
function useTool(t) {
  if (t === 'glue') { useGlue(); return; }
  togglePane(t, true);
}
function openToolsDialog() {
  renderToolOrder();
  $('#toolsDialog').showModal();
}
function renderToolOrder() {
  const list = $('#toolOrder');
  list.innerHTML = '';
  const order = state.tools.order;
  order.forEach((t, i) => {
    const li = document.createElement('li');
    const shown = !state.tools.hidden.includes(t);
    li.className = shown ? '' : 'off';
    li.innerHTML = `<span class="t-art"></span><span class="t-name"></span>
      <button type="button" class="round-btn" data-move="-1" aria-label="往前移">↑</button>
      <button type="button" class="round-btn" data-move="1" aria-label="往後移">↓</button>
      <label class="toggle"><input type="checkbox" ${shown ? 'checked' : ''}><span>顯示</span></label>
      <button type="button" class="chip use-btn">用</button>`;
    li.querySelector('.t-name').textContent = TOOL_INFO[t].name;
    li.querySelector('.t-art').append(toolArt(`tl_${t}`));
    const use = li.querySelector('.use-btn');
    use.hidden = shown;
    use.setAttribute('aria-label', `使用${TOOL_INFO[t].name}`);
    use.addEventListener('click', () => { $('#toolsDialog').close(); useTool(t); });
    if (t === 'add') { const cb = li.querySelector('input'); cb.disabled = true; cb.title = '「新增」不能收起來'; }
    li.querySelector('[data-move="-1"]').disabled = i === 0;
    li.querySelector('[data-move="1"]').disabled = i === order.length - 1;
    li.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
      const j = i + +b.dataset.move;
      [order[i], order[j]] = [order[j], order[i]];
      buildStationery(); renderToolOrder(); savePrefs();
      $(`#toolOrder li:nth-child(${j + 1}) [data-move="${b.dataset.move}"]`)?.focus();
    }));
    li.querySelector('input').addEventListener('change', (e) => {
      const hidden = new Set(state.tools.hidden);
      if (e.target.checked) hidden.delete(t);
      else if (TOOLS.length - hidden.size > 1) hidden.add(t);
      else { e.target.checked = true; toast('至少留一個工具'); }
      state.tools.hidden = [...hidden];
      buildStationery(); renderToolOrder(); savePrefs();
    });
    list.append(li);
  });
}
$('#btnToolsReset').addEventListener('click', () => {
  state.tools = { order: [...TOOLS], hidden: [] };
  buildStationery(); renderToolOrder(); savePrefs();
});
$('#btnToolsDone').addEventListener('click', () => $('#toolsDialog').close());

// ---------------------------------------------------------------- 復原／重做
// 每次畫面更新後（手指放開、滑桿停下）比對一次設定，有變就記一筆。換照片、換模式時清空。
const newHistory = () => ({ undo: [], redo: [], cur: null });
const histories = { single: newHistory(), four: newHistory() };
let history = histories.single, historyTimer = 0, restoring = false, sliderActive = false;
const HISTORY_MAX = 60;
// 每一步只記「這一步改了哪幾項」：復原時只退回那幾項，單張和四格互不影響。
// 單張記：相框（含縮放角度）、方向、照片；四格記：排法、相紙、每一格的照片與縮放角度；兩邊都記：色調、塗鴉、日期、貼圖。
const SHARED_KEYS = ['preset', 'adj', 'doodle', 'date', 'glow', 'stickers'];
const MODE_KEYS = { single: ['frame', 'rotation', 'photoDate'], four: ['four'] };
function snapshot() {
  const imgs = [];
  const ref = (img) => { if (!img) return -1; let i = imgs.indexOf(img); if (i < 0) { imgs.push(img); i = imgs.length - 1; } return i; };
  const f = state.frame, single = state.mode === 'single';
  const all = {
    preset: state.preset, adj: state.adj, doodle: state.doodle, date: state.date, glow: state.glow,
    stickers: state.stickers.map((st) => (st.img ? { ...st, img: ref(st.img) } : st)),
    frame: { id: f.id, color: f.color, slideColor: f.slideColor, archColor: f.archColor, crop: f.crop, ratio: f.ratio, paper: f.paper, cut: f.cut || null },
    rotation: state.rotation, photoDate: state.photoDate,
    four: { layout: state.four.layout, paper: state.four.paper, xf: state.four.photos.map((x) => x?.t || null) },
  };
  const parts = {};
  for (const k of [...SHARED_KEYS, ...MODE_KEYS[state.mode]]) parts[k] = JSON.stringify(all[k]);
  return { mode: state.mode, parts, json: JSON.stringify(parts), photos: single ? [state.orig] : state.four.photos.slice(), imgs };
}
const samePhotos = (a, b) => a.photos.length === b.photos.length && a.photos.every((ph, i) => ph === b.photos[i]);
function changedKeys(a, b) {
  const keys = Object.keys(b.parts).filter((k) => a.parts[k] !== b.parts[k]);
  if (!samePhotos(a, b)) keys.push('photos');
  return keys;
}
function noteChange() {
  if (restoring) return;
  clearTimeout(historyTimer);
  historyTimer = setTimeout(commitHistory, 300);
}
function commitHistory() {
  if (restoring) return;
  if (pointers.size || state.dragging || sliderActive || longPress) { noteChange(); return; }
  const snap = snapshot();
  if (!history.cur || history.cur.mode !== snap.mode) { history.cur = snap; return; }
  const keys = changedKeys(history.cur, snap);
  if (!keys.length) return;
  history.undo.push({ before: history.cur, after: snap, keys });
  if (history.undo.length > HISTORY_MAX) history.undo.shift();
  history.redo = [];
  history.cur = snap;
  // 照片很佔記憶體：最多只留「上一次換照片之前」的照片可以復原
  const prev = [...history.undo].reverse().find((h) => h.keys.includes('photos'))?.before;
  const keep = new Set([...snap.photos, ...(prev?.photos || [])]);
  const gone = new Set();
  const ok = (h) => [...h.before.photos, ...h.after.photos].every((ph) => !ph || keep.has(ph));
  history.undo = history.undo.filter((h) => {
    if (ok(h)) return true;
    [...h.before.photos, ...h.after.photos].forEach((ph) => { if (ph && !keep.has(ph)) gone.add(ph); });
    return false;
  });
  gone.forEach(freePhoto);
  syncHistoryUI();
}
// 不會再用到的照片：立刻釋放畫布記憶體（iPhone Safari 記憶體很少）
function freePhoto(ph) {
  if (!ph) return;
  if (ph.full) { ph.full.width = 0; return; }
  if (ph !== state.orig) ph.width = 0;
}
function resetHistory() {
  clearTimeout(historyTimer);
  history.undo = []; history.redo = [];
  history.cur = snapshot();
  syncHistoryUI();
}
// 換模式：這個模式的紀錄還在，只把「現在」更新成眼前的狀態
function rebaseHistory() {
  clearTimeout(historyTimer);
  history.cur = snapshot();
  syncHistoryUI();
}
function syncHistoryUI() {
  $('#btnUndo').disabled = !history.undo.length;
  $('#btnRedo').disabled = !history.redo.length;
}
// 把 snap 裡的 keys 這幾項套回目前的狀態（其他項目不動）
function applySnapshot(snap, keys) {
  restoring = true;
  clearTimeout(historyTimer);
  const get = (k) => JSON.parse(snap.parts[k]);
  const has = (k) => keys.includes(k) && k in snap.parts;
  if (has('preset')) state.preset = get('preset');
  if (has('adj')) state.adj = get('adj');
  if (has('doodle')) state.doodle = get('doodle');
  if (has('date')) state.date = get('date');
  if (has('glow')) state.glow = get('glow');
  if (has('stickers')) state.stickers = get('stickers').map((st) => (typeof st.img === 'number' ? { ...st, img: snap.imgs[st.img] } : st));
  if (has('frame')) { Object.assign(state.frame, get('frame')); state.frame.crop = normXf(state.frame.crop); }
  if (snap.mode === 'four') {
    if (keys.includes('photos')) { state.four.photos = snap.photos.slice(); state.four.ver++; refreshFourSlots(); }
    if (has('four') || keys.includes('photos')) {
      const fo = get('four');
      state.four.layout = fo.layout; state.four.paper = fo.paper;
      state.four.photos.forEach((ph, i) => { if (ph) ph.t = normXf(fo.xf[i]); });
    }
  } else if (keys.includes('photos') || has('rotation')) {
    const photo = snap.photos[0], rot = get('rotation');
    if (photo && (photo !== state.orig || rot !== state.rotation)) {
      if (state.full && state.full !== state.orig) state.full.width = 0;
      state.orig = photo; state.full = null; state.rotation = rot;
      if ('photoDate' in snap.parts) state.photoDate = get('photoDate');
      buildSources();
    }
  }
  state.selected = null;
  doodleCache.key = ''; cellCache.clear(); resetPhotoCache();
  $$('#presetList .card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.preset)));
  $$('#frameList .card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.frame.id)));
  $('#glow').checked = state.glow;
  syncSliders(); syncDoodleUI(); updateFrameOpts(); syncDateUI(); syncFourUI(); syncCropUI(); syncGlueUI(); syncCutUI();
  refreshFrameThumbs();
  refreshWorkspace();
  savePrefs();
  history.cur = snapshot();
  syncHistoryUI();
  requestAnimationFrame(() => requestAnimationFrame(() => { restoring = false; }));
}
function undo() {
  commitHistory();
  const h = history.undo.pop();
  if (!h) return;
  history.redo.push(h);
  applySnapshot(h.before, h.keys);
}
function redo() {
  const h = history.redo.pop();
  if (!h) return;
  history.undo.push(h);
  applySnapshot(h.after, h.keys);
}
// 拖滑桿的過程不算，放開才算一步
document.addEventListener('pointerdown', (e) => { if (e.target.matches?.('input[type="range"]')) sliderActive = true; }, true);
['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => { if (sliderActive) { sliderActive = false; noteChange(); } }, true));
$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.target.closest('input[type="date"], textarea, dialog')) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
});

// ---------------------------------------------------------------- date stamp
function buildDateUI() {
  for (const [id, name] of DATE_SIZES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = name;
    b.addEventListener('click', () => { state.date.size = id; state.date.on = true; syncDateUI(); queueDateClear(); savePrefs(); });
    $('#dateSizes').append(b);
  }
  const fm = $('#dateFormats');
  for (const [id] of DATE_FORMATS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip date-chip'; b.dataset.id = id;
    b.addEventListener('click', () => { state.date.format = id; state.date.on = true; syncDateUI(); queueDateClear(); savePrefs(); });
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
    if (st.glued) continue; // 使用者用膠水黏好的不動
    const g = stickerGeom(st, L), rad = Math.hypot(g.w, g.h) / 2; // 用完整對角線，轉過的貼圖角落也不會壓到
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
    const crop = xfCrop(src.width, src.height, cropAspect(id, src.width, src.height, state.frame.ratio), state.frame.crop);
    // 放大取景時，輸出尺寸維持和沒放大一樣（不會因為放大而變小張）
    const z = state.frame.crop.zoom || 1;
    let L = layoutFrame(id, crop.w * z, crop.h * z, o);
    const f = Math.min(1, Math.sqrt(MAX_OUT_AREA / (L.W * L.H)), MAX_OUT_SIDE / Math.max(L.W, L.H));
    const pw = Math.round(crop.w * z * f), ph = Math.round(crop.h * z * f);
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
['#btnInfo', '#btnAbout', '#btnAbout2'].forEach((id) => $(id).addEventListener('click', () => $('#infoDialog').showModal()));
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
  // 只放在小視窗上下兩條帶子的正中間（手機上中間是小視窗，放中間會被擋住）
  const card = $('.empty-card').getBoundingClientRect();
  const topBand = Math.max(0, card.top - r.top), botBand = Math.max(0, r.bottom - card.bottom - 7);
  const bands = { t: { y: topBand / 2, h: topBand }, b: { y: H - botBand / 2, h: botBand } };
  const items = [
    ['pc_star8', 0.1, 't', 0.1, -0.1], ['pc_cherry', 0.37, 't', 0.11, 0.05], ['pc_teacup', 0.63, 't', 0.13, 0.05],
    ['pc_moon', 0.9, 't', 0.1, 0.2], ['pr_clover', 0.1, 'b', 0.12, 0.1], ['pc_bow', 0.37, 'b', 0.11, -0.1],
    ['pc_flower', 0.63, 'b', 0.12, -0.1], ['pr_wheat', 0.9, 'b', 0.13, 0],
  ];
  for (const [id, x, band, s, rot] of items) {
    const def = STICKERS.find((d) => d.id === id), bd = bands[band];
    if (!def || bd.h < 30) continue;
    const [vw, vh] = stickerBox(def), size = Math.min(Math.max(44, S * s), bd.h - 12), k = size / Math.max(vw, vh);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.translate(x * W, bd.y);
    ctx.rotate(rot);
    ctx.translate((-vw * k) / 2, (-vh * k) / 2);
    ctx.scale(k, k);
    drawStickerDef(ctx, def, def.color, k * dpr, 0.6);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- init
// 電腦：主要編輯（底片、塗鴉框、貼圖、相框）放進底部的文具托盤，和文具在同一條；手機維持底部導覽
const deskMQ = matchMedia('(min-width: 900px)');
function placeRail() {
  const rail = $('.rail');
  if (deskMQ.matches) { if (rail.parentElement !== $('.stationery-dock')) $('.stationery-dock').prepend(rail); }
  else if (rail.parentElement !== $('.workspace')) $('.workspace').prepend(rail);
  fitView();
}
deskMQ.addEventListener?.('change', placeRail);
function init() {
  loadPrefs();
  buildPresetCards();
  buildSliders();
  buildFrameCards();
  buildDoodlePane();
  buildStickerPanel();
  buildFourUI();
  buildPaperUI();
  buildCropUI();
  buildTapeUI();
  buildCutUI();
  syncCutUI();
  buildStationery();
  placeRail();
  if (!isPhone()) setPanel(false);
  buildDateUI();
  syncSliders();
  syncDateUI();
  updateFrameOpts();
  $('#glow').checked = state.glow;
  syncDoodleUI();
  setTab(state.tab);
  setMode(state.mode, true);
  resetHistory();
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
