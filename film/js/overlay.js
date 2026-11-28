// FilmDoodle — 覆蓋整張照片的效果（第六版，風格 B、D）
// 規則：主角留白——只放在照片邊緣；避開相機日期；同一組亂數種子，預覽和匯出一模一樣。

import { drawCrossStitch, drawStipple, drawPrintDef, PAPER } from './print.js';
import { MOTIF_STITCH, MOTIF_STIPPLE, ART_PRINTTILE } from './art/v8.js';
import { MOTIF_STITCH2, MOTIF_STIPPLE2 } from './art/v9.js';

const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 3; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; };
const pick = (r, list) => list[Math.floor(r() * list.length)];
// 十字繡全部圖案（舊的 7 種補上擺放位置）；點描全部圖案
const ST_AT = { st_tulip: 'ground', st_daisy: 'ground', st_branch: 'top', st_tuft: 'ground', st_tuft2: 'ground', st_spark: 'any', st_bird: 'any' };
const ALL_STITCH = [...MOTIF_STITCH.map((m) => ({ ...m, at: ST_AT[m.id] || 'any' })), ...MOTIF_STITCH2];
const ALL_STIPPLE = [...MOTIF_STIPPLE, ...MOTIF_STIPPLE2];
const M = (id) => ALL_STITCH.find((m) => m.id === id);
// 洗牌後一張一張抽：全部抽過一輪才會重複
function deck(r, list) {
  let pile = [];
  return (ok = () => true) => {
    for (let round = 0; round < 2; round++) {
      if (!pile.length) pile = list.slice().sort(() => r() - 0.5);
      const i = pile.findIndex(ok);
      if (i >= 0) return pile.splice(i, 1)[0];
      pile = [];
    }
    return null;
  };
}
const INKS = ['#a6c75a', '#8fb0c9', '#cb8875', '#a99bc5'];
// 紙纖維：很淡的深淺小點與短纖維（奶油紙的質感）
let fiber = null;
function paperFiber() {
  if (fiber) return fiber;
  const c = document.createElement('canvas'), r = rng(31);
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(120,95,60,.07)' : 'rgba(255,255,255,.35)';
    const x = r() * 128, y = r() * 128;
    if (r() < 0.15) { g.save(); g.translate(x, y); g.rotate(r() * 6.3); g.fillRect(0, 0, 3 + r() * 5, 0.6); g.restore(); } else g.fillRect(x, y, 1, 1);
  }
  fiber = c;
  return c;
}

// date：日期戳記範圍（0~1）或 null；o：{ count, scale, seed }
export function drawOverlay(kind, ctx, W, H, o, date) {
  const r = rng(o.seed || 1), S = Math.min(W, H), sc = (o.scale || 100) / 100;
  const dateRect = date && [date.x0 * W - S * 0.02, date.y0 * H - S * 0.02, (date.x1 - date.x0) * W + S * 0.04, (date.y1 - date.y0) * H + S * 0.04];
  const rightDate = date && date.x0 > 0.5;
  ctx.save();
  if (kind === 'stitch') {
    // 十字繡：淡格線只在邊緣（往中間淡掉）。第一株從底邊一側長上來（沒有日期的那一側），
    // 其他圖案一張一張抽（全部用過才重複）：長在底邊的放底邊、掛的放頂邊、小的散在四邊；中間留白、彼此不重疊
    const cell = S / (44 / sc), cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    const left = date ? date.x0 > 0.5 : r() < 0.5;
    const n = Math.max(2, Math.min(40, o.count || 6));
    const occ = new Uint8Array(cols * rows), items = [];
    const band = Math.max(4, Math.round(Math.min(cols, rows) * 0.24));
    const hit = (gx, gy, gw, gh) => dateRect && (gx + gw) * cell > dateRect[0] && gx * cell < dateRect[0] + dateRect[2] && (gy + gh) * cell > dateRect[1] && gy * cell < dateRect[1] + dateRect[3];
    const free = (gx, gy, gw, gh, pad = 1) => {
      if (gx < 0 || gy < 0 || gx + gw > cols || gy + gh > rows) return false;
      for (let j = Math.max(0, gy - pad); j < Math.min(rows, gy + gh + pad); j++) for (let i = Math.max(0, gx - pad); i < Math.min(cols, gx + gw + pad); i++) if (occ[j * cols + i]) return false;
      return true;
    };
    const center = (gx, gy, gw, gh) => { const cx = (gx + gw / 2) / cols - 0.5, cy = (gy + gh / 2) / rows - 0.5; return (cx / 0.3) ** 2 + (cy / 0.28) ** 2 < 1; };
    const inBand = (gx, gy, gw, gh) => gx <= band || gx + gw >= cols - band || gy <= band || gy + gh >= rows - band;
    const put = (m, gx, gy, flip) => {
      G(m).forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'X') occ[(gy + j) * cols + gx + i] = 1; });
      // 圖案外框也算佔位（圖案之間留一點空）
      for (let j = gy; j < gy + G(m).length; j++) for (let i = gx; i < gx + G(m)[0].length; i++) occ[j * cols + i] = 1;
      items.push({ grid: G(m), gx, gy, flip });
    };
    const G = (m) => m.grid;
    const tryPlace = (m, first) => {
      const gw = m.grid[0].length, gh = m.grid.length;
      if (gh > rows * 0.7 || gw > cols * 0.6) return false;
      for (let k = 0; k < 70; k++) {
        let gx, gy;
        if (first) { gx = left ? 1 + Math.floor(r() * 3) : cols - gw - 1 - Math.floor(r() * 3); gy = rows - 1 - gh; }
        else if (m.at === 'ground') { gx = Math.floor(r() * (cols - gw)); gy = rows - 1 - gh; }
        else if (m.at === 'top') { gx = Math.floor(r() * (cols - gw)); gy = 1 + Math.floor(r() * 2); }
        else {
          // 小圖案：四邊的帶子裡隨機一點
          const e = Math.floor(r() * 4);
          gx = e === 0 ? 1 + Math.floor(r() * band) : e === 1 ? cols - gw - 1 - Math.floor(r() * band) : Math.floor(r() * (cols - gw));
          gy = e === 2 ? 1 + Math.floor(r() * band) : e === 3 ? rows - gh - 1 - Math.floor(r() * band) : Math.floor(r() * (rows - gh));
        }
        if (!free(gx, gy, gw, gh) || hit(gx, gy, gw, gh) || center(gx, gy, gw, gh) || !inBand(gx, gy, gw, gh)) continue;
        put(m, gx, gy, first ? !left : r() < 0.4);
        return true;
      }
      return false;
    };
    const draw = deck(r, ALL_STITCH);
    // 第一株：比較高的植物
    const tall = ALL_STITCH.filter((m) => m.at === 'ground' && m.grid.length >= 14 && m.grid.length <= rows * 0.7);
    if (tall.length) tryPlace(pick(r, tall), true);
    let tries = 0;
    while (items.length < n && tries++ < n * 4) {
      const m = draw((q) => q.grid.length <= rows * 0.7);
      if (!m) break;
      tryPlace(m, false);
    }
    drawCrossStitch(ctx, W, H, { seed: o.seed, cell, items, avoid: dateRect });
  } else if (kind === 'stipple') {
    // 點描：一大枝植物從照片底邊、靠一側長上來（避開日期那一側），另一角再一小枝；
    // 數量多時：主株旁邊再長幾枝、頂邊兩角垂下小枝、底邊中間偶爾一小株——中間留白。圖案全部用過才重複。
    if (dateRect) { const c = new Path2D(); c.rect(0, 0, W, H); c.rect(...dateRect); ctx.clip(c, 'evenodd'); }
    const left = date ? date.x0 > 0.5 : r() < 0.5, n = Math.max(1, Math.min(9, o.count || 2));
    const draw = deck(r, ALL_STIPPLE);
    const main = draw();
    // vb 是 100×140：size 是高度。主株約 0.95 張照片高（直式照片最多 1.3 個短邊），底部稍微超出照片
    const hMain = Math.min(0.97 * H, 1.3 * S) * sc, size = hMain / S;
    const wMain = hMain * 100 / 140;
    const motifs = [{ def: main, x: left ? (wMain * 0.42) / W : 1 - (wMain * 0.42) / W, y: 1 - (hMain * 0.47) / H, size, flip: !left }];
    const dateLow = date && date.y0 > 0.5, dateTop = date && date.y1 < 0.5;
    const sx = (fromLeft, w) => (fromLeft ? w / W : 1 - w / W);
    const slots = [];
    // 2：另一個底角（日期在那裡時改靠在主株旁）
    slots.push(dateLow ? { h: 0.5, x: sx(left, wMain * 0.88), rot: (left ? 1 : -1) * 0.12, flip: !left } : { h: 0.5, x: sx(!left, hMain * 0.5 * 0.36), flip: left });
    // 3：主株旁邊一小枝
    if (!dateLow) slots.push({ h: 0.36, x: sx(left, wMain * 0.95), rot: (left ? 1 : -1) * 0.18, flip: !left });
    // 4–5：頂邊兩角垂下來（倒掛）
    const hang = (fromLeft, h) => ({ h, x: sx(fromLeft, hMain * h * 0.3), top: true, rot: Math.PI + (fromLeft ? -1 : 1) * 0.15, flip: fromLeft });
    if (!(dateTop && !left)) slots.push(hang(!left, 0.34));
    if (!(dateTop && left)) slots.push(hang(left, 0.28));
    // 6+：另一側再一枝、底邊靠內的小株、頂邊靠內再一枝
    slots.push({ h: 0.3, x: sx(!left, hMain * 0.5 * 0.36 + hMain * 0.24), rot: (left ? -1 : 1) * 0.1, flip: left });
    slots.push({ h: 0.24, x: sx(left, wMain * 1.25), rot: (left ? 1 : -1) * 0.22, flip: !left });
    slots.push(hang(!left, 0.22), hang(left, 0.2));
    slots.slice(0, n - 1).forEach((sl, i) => {
      const def = draw(), h = hMain * sl.h;
      // 頂邊的小枝：位置換算到頂邊（右側時往內收一點）
      const x = sl.top && i >= 4 ? (sl.x < 0.5 ? sl.x + (hMain * 0.22) / W : sl.x - (hMain * 0.22) / W) : sl.x;
      motifs.push({ def, x, y: sl.top ? (h * 0.45) / H : 1 - (h * 0.45) / H, size: size * sl.h, rot: sl.rot || 0, flip: sl.flip });
    });
    drawStipple(ctx, W, H, { seed: o.seed, motifs });
  } else if (kind === 'printgrid') {
    // 版畫方格（第九版）：奶油紙上一格一格交錯印——墨色格挖出植物、紙色格印上植物，格與格之間留細紙縫（參考圖 11、13、32）。
    // 排成「方格牆」：直式照片貼在一側（最多 2 欄），橫式照片排在上或下（最多 2 列）；放不下才開另一側的第二面牆。
    // 方格總面積不超過畫面 30%（超過就只用一面牆，不開第二面）。避開相機日期：碰到日期的那一排整排不放、牆就停在那裡（不會在一排中間留洞）。
    const n = Math.max(1, Math.min(16, o.count || 4)), ink = INKS[Math.floor((o.seed || 1) % INKS.length)];
    const vertical = W <= H * 1.15;
    const margin = S * 0.03;
    const dateRight = date ? date.x0 > 0.5 : (o.seed || 1) % 2 === 1, dateBottom = date ? date.y0 > 0.5 : true;
    // 方向：along＝沿著邊排的方向，depth＝往照片中間長的方向
    const lenAlong = vertical ? H : W, lenDepth = vertical ? W : H;
    const tile = S * 0.17 * sc, gap = tile * 0.06;
    const F = {
      along: Math.max(1, Math.floor((lenAlong - 2 * margin + gap) / (tile + gap))),
      depth: Math.max(1, Math.min(2, Math.floor((lenDepth * 0.42 - margin + gap) / (tile + gap)))),
    };
    F.cap = F.along * F.depth;
    const areaCap = Math.max(1, Math.floor((0.3 * W * H) / ((tile + gap) * (tile + gap))));
    const walls = n <= F.cap ? [Math.min(n, areaCap)]
      : n <= areaCap ? [Math.ceil(n / 2), Math.floor(n / 2)].map((m) => Math.min(m, F.cap))
        : [Math.min(F.cap, areaCap)];
    const hitDate = (x, y) => dateRect && x < dateRect[0] + dateRect[2] + gap && x + tile > dateRect[0] - gap && y < dateRect[1] + dateRect[3] + gap && y + tile > dateRect[1] - gap;
    const cells = [];
    walls.forEach((m, wi) => {
      // 這面牆的深度：4 格以上就兩排
      const d = Math.min(F.depth, Math.max(m >= 4 ? 2 : 1, Math.ceil(m / F.along)));
      const sideA = wi === 0; // 第一面牆在沒有日期的那側
      const farSide = vertical ? (sideA ? dateRight : !dateRight) : (sideA ? dateBottom : !dateBottom); // true＝靠左／靠上
      const fromStart = vertical ? (sideA ? dateBottom : !dateBottom) : (sideA ? dateRight : !dateRight); // 沿邊從上（左）開始排
      let k = 0;
      for (let a = 0; a < F.along && k < m; a++) {
        const row = [];
        for (let j = 0; j < d && k + row.length < m; j++) {
          const alongPos = margin + a * (tile + gap), depthPos = margin + j * (tile + gap);
          const ap = fromStart ? alongPos : lenAlong - alongPos - tile, dp = farSide ? depthPos : lenDepth - depthPos - tile;
          row.push({ x: vertical ? dp : ap, y: vertical ? ap : dp, par: (a + j + wi) % 2 });
        }
        if (row.some((c) => hitDate(c.x, c.y))) break; // 碰到日期：這面牆到此為止
        cells.push(...row);
        k += row.length;
      }
    });
    if (cells.length) {
      // 紙：每格外擴一點，連起來變成一整張奶油紙（只畫一次投影）
      const pad = gap * 1.4;
      ctx.save();
      ctx.shadowColor = 'rgba(60,45,30,.26)'; ctx.shadowBlur = S * 0.012; ctx.shadowOffsetY = S * 0.004;
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      cells.forEach((c) => ctx.rect(c.x - pad, c.y - pad, tile + pad * 2, tile + pad * 2));
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      cells.forEach((c) => ctx.rect(c.x - pad, c.y - pad, tile + pad * 2, tile + pad * 2));
      ctx.clip();
      ctx.fillStyle = ctx.createPattern(paperFiber(), 'repeat');
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const inkDeck = deck(r, ART_PRINTTILE.filter((d) => d.tile === 'ink')), paperDeck = deck(r, ART_PRINTTILE.filter((d) => d.tile === 'paper'));
      cells.forEach((c, i) => {
        const def = (c.par === 0 ? inkDeck : paperDeck)();
        if (!def) return;
        ctx.save();
        ctx.translate(Math.round(c.x), Math.round(c.y));
        ctx.scale(tile / 100, tile / 100);
        drawPrintDef(ctx, def, ink, 1, (o.seed || 1) * 7 + i);
        ctx.restore();
      });
    }
  }
  ctx.restore();
}
