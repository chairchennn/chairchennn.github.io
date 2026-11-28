// FilmDoodle — 覆蓋整張照片的效果（第六版，風格 B、D）
// 規則：主角留白——只放在照片邊緣；避開相機日期；同一組亂數種子，預覽和匯出一模一樣。

import { drawCrossStitch, drawStipple, drawPrintDef } from './print.js';
import { MOTIF_STITCH, MOTIF_STIPPLE, ART_PRINT } from './art/v8.js';

const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 3; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; };
const pick = (r, list) => list[Math.floor(r() * list.length)];
const M = (id) => MOTIF_STITCH.find((m) => m.id === id);
const INKS = ['#9dc044', '#8fb0c9', '#cb8875', '#a99bc5', '#a6b58a'];

// date：日期戳記範圍（0~1）或 null；o：{ count, scale, seed }
export function drawOverlay(kind, ctx, W, H, o, date) {
  const r = rng(o.seed || 1), S = Math.min(W, H), sc = (o.scale || 100) / 100;
  const dateRect = date && [date.x0 * W - S * 0.02, date.y0 * H - S * 0.02, (date.x1 - date.x0) * W + S * 0.04, (date.y1 - date.y0) * H + S * 0.04];
  const rightDate = date && date.x0 > 0.5;
  ctx.save();
  if (kind === 'stitch') {
    // 十字繡：只在照片邊緣的一圈格子裡繡，中間留給主角
    const cols = Math.round(46 / sc), cell = W / cols, rows = Math.round(H / cell);
    const band = Math.max(3, Math.round(Math.min(cols, rows) * 0.17));
    const clip = new Path2D();
    clip.rect(0, 0, W, H);
    clip.rect(band * cell, band * cell, W - band * 2 * cell, H - band * 2 * cell);
    if (dateRect) clip.rect(...dateRect);
    ctx.clip(clip, 'evenodd');
    const fx = (c) => (c + 0.5) / cols, fy = (c) => (c + 0.5) / rows, mid = band / 2;
    const spots = [
      { def: M('st_vine'), x: 0.5, y: fy(rows - mid), len: cols },                     // 底邊藤蔓
      { def: M('st_vine'), x: fx(rightDate ? mid : cols - mid), y: 0.55, len: Math.round(rows * 0.7), rot: Math.PI / 2 }, // 一側往上爬
      { def: M('st_sprig'), x: fx(rightDate ? cols - mid : mid), y: fy(mid + 1), flip: rightDate },
      { def: M('st_daisy'), x: 0.32 + r() * 0.1, y: fy(mid) },
      { def: M('st_bird'), x: 0.66 + r() * 0.1, y: fy(mid), flip: r() < 0.5 },
      { def: M('st_clover'), x: fx(rightDate ? cols - mid : mid), y: 0.5 + r() * 0.12 },
      { def: M('st_wheat'), x: fx(rightDate ? mid : cols - mid), y: fy(mid + 2) },
      { def: M('st_daisy'), x: 0.12 + r() * 0.06, y: fy(rows - mid - 1) },
      { def: M('st_clover'), x: 0.86 - r() * 0.06, y: fy(mid) },
      { def: M('st_sprig'), x: fx(rightDate ? mid : cols - mid), y: fy(rows - mid - 2), flip: !rightDate },
    ].filter((m) => m.def);
    const n = Math.max(2, Math.min(spots.length, o.count || 6));
    drawCrossStitch(ctx, W, H, { seed: o.seed, cols, panelW: 1, panelH: 1, panelAlpha: 0.12, motifs: spots.slice(0, n) });
  } else if (kind === 'stipple') {
    // 點描：一枝植物從照片側邊長上來（避開日期那一側），其他較小的放另一個角
    if (dateRect) { const c = new Path2D(); c.rect(0, 0, W, H); c.rect(...dateRect); ctx.clip(c, 'evenodd'); }
    const side = rightDate ? 0 : 1, n = Math.max(1, Math.min(3, o.count || 2));
    const main = MOTIF_STIPPLE[Math.floor(r() * MOTIF_STIPPLE.length)];
    const others = MOTIF_STIPPLE.filter((m) => m !== main);
    const aspectFix = H / S;
    const motifs = [{ def: main, x: side ? 0.8 : 0.2, y: 1 - 0.36 * aspectFix * sc * (S / H), size: 0.78 * sc, flip: !side }];
    if (n > 1) motifs.push({ def: others[0], x: side ? 0.1 : 0.9, y: 1 - 0.2 * sc * (S / H), size: 0.42 * sc, flip: side });
    if (n > 2) motifs.push({ def: others[1] || others[0], x: side ? 0.62 : 0.38, y: 1 - 0.14 * sc * (S / H), size: 0.3 * sc, rot: (r() - 0.5) * 0.3 });
    drawStipple(ctx, W, H, { seed: o.seed, motifs });
  } else if (kind === 'printgrid') {
    // 版畫方格：照片一側（避開日期）一排兩色方格，墨色格挖出紙色植物、紙色格印上墨色植物
    const n = Math.max(2, Math.min(7, o.count || 4)), ink = INKS[Math.floor((o.seed || 1) % INKS.length)];
    const vertical = W <= H * 1.15;
    const tile = S * 0.2 * sc, gap = S * 0.012;
    const plants = ART_PRINT.slice().sort(() => r() - 0.5);
    const startEdge = rightDate ? 'left' : 'right';
    for (let i = 0; i < n; i++) {
      let x, y;
      if (vertical) { x = startEdge === 'left' ? gap : W - tile - gap; y = gap + i * (tile + gap); if (y + tile > H * 0.78) break; }
      else { y = gap; x = (startEdge === 'left' ? gap : W - tile - gap) + (startEdge === 'left' ? 1 : -1) * i * (tile + gap); if (x < 0 || x + tile > W) break; }
      const inkTile = i % 2 === 0, def = plants[i % plants.length], k = tile / 100;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, k);
      drawPrintDef(ctx, { parts: [{ d: 'M0 0H100V100H0Z', f: inkTile ? 'M' : 'P' }] }, ink, 1, i + 7);
      const [vw, vh] = def.vb || [100, 100], kk = 84 / Math.max(vw, vh);
      ctx.translate(50 - (vw * kk) / 2, 50 - (vh * kk) / 2);
      ctx.scale(kk, kk);
      drawPrintDef(ctx, { ...def, parts: def.parts.map((p) => ({ ...p, f: p.f ? (inkTile ? 'P' : 'M') : null, s: p.s ? (inkTile ? 'P' : 'M') : null })) }, ink, 1, i + 11);
      ctx.restore();
    }
  }
  ctx.restore();
}
