// FilmDoodle — 覆蓋整張照片的效果（第六版，風格 B、D）
// 規則：主角留白——只放在照片邊緣；避開相機日期；同一組亂數種子，預覽和匯出一模一樣。

import { drawCrossStitch, drawStipple, drawPrintDef, PAPER } from './print.js';
import { MOTIF_STITCH, MOTIF_STIPPLE, ART_PRINT } from './art/v8.js';

const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 3; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; };
const pick = (r, list) => list[Math.floor(r() * list.length)];
const M = (id) => MOTIF_STITCH.find((m) => m.id === id);
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
    // 十字繡：淡格線只在邊緣（往中間淡掉）；一株從底邊一側長上來、對角一枝小花、底邊幾叢草；中間留白、不對稱
    const cell = S / (44 / sc), cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    const left = date ? date.x0 > 0.5 : r() < 0.5; // 主株放在沒有日期的那一側
    const G = (id) => M(id).grid, gw = (id) => G(id)[0].length, gh = (id) => G(id).length;
    const atL = (id, x) => x, atR = (id, x) => cols - x - gw(id);
    const side = (L, id, x) => (L ? atL(id, x) : atR(id, x));
    const bottom = (id, lift = 1) => rows - lift - gh(id);
    const main = r() < 0.75 ? 'st_tulip' : 'st_daisy', other = main === 'st_tulip' ? 'st_daisy' : 'st_tulip';
    const mx = side(left, main, 2), tx = left ? mx + gw(main) + 1 : mx - gw('st_tuft') - 1;
    const plan = [
      { id: main, gx: mx, gy: bottom(main), flip: !left },
      { id: 'st_branch', gx: side(!left, 'st_branch', 1), gy: 1, flip: left },
      { id: 'st_tuft', gx: tx, gy: bottom('st_tuft') },
      { id: 'st_spark', gx: side(left, 'st_spark', 3), gy: 3 },
      { id: 'st_tuft2', gx: left ? tx + 11 + Math.floor(r() * 4) : tx - 7 - Math.floor(r() * 4), gy: bottom('st_tuft2') },
      { id: 'st_bird', gx: side(!left, 'st_bird', 1 + Math.floor(r() * 2)), gy: 12 + Math.floor(r() * 2), flip: left },
      { id: other === 'st_tulip' ? 'st_daisy' : other, gx: side(!left, 'st_daisy', 2), gy: bottom('st_daisy') },
      { id: 'st_spark', gx: Math.round(cols * (left ? 0.56 : 0.4)), gy: 2 },
      { id: 'st_tuft2', gx: side(!left, 'st_tuft2', 15), gy: bottom('st_tuft2') },
      { id: 'st_spark', gx: side(!left, 'st_spark', 2), gy: Math.round(rows * 0.55) },
    ];
    // 跟日期重疊的圖案整個不要（不留半個）
    const hit = (p) => dateRect && (p.gx + gw(p.id)) * cell > dateRect[0] && p.gx * cell < dateRect[0] + dateRect[2] && (p.gy + gh(p.id)) * cell > dateRect[1] && p.gy * cell < dateRect[1] + dateRect[3];
    const n = Math.max(2, Math.min(plan.length, o.count || 6));
    const items = plan.slice(0, n).filter((p) => !hit(p)).map((p) => ({ grid: G(p.id), gx: p.gx, gy: p.gy, flip: p.flip }));
    drawCrossStitch(ctx, W, H, { seed: o.seed, cell, items, avoid: dateRect });
  } else if (kind === 'stipple') {
    // 點描：一大枝植物從照片底邊、靠一側長上來（避開日期那一側），另一角再一小枝；中間留白
    if (dateRect) { const c = new Path2D(); c.rect(0, 0, W, H); c.rect(...dateRect); ctx.clip(c, 'evenodd'); }
    const left = date ? date.x0 > 0.5 : r() < 0.5, n = Math.max(1, Math.min(3, o.count || 2));
    const main = MOTIF_STIPPLE[Math.floor(r() * MOTIF_STIPPLE.length)];
    const others = MOTIF_STIPPLE.filter((m) => m !== main);
    // vb 是 100×140：size 是高度。主株約 0.95 張照片高（直式照片最多 1.3 個短邊），底部稍微超出照片
    const hMain = Math.min(0.97 * H, 1.3 * S) * sc, size = hMain / S;
    const wMain = hMain * 100 / 140;
    const motifs = [{ def: main, x: left ? (wMain * 0.42) / W : 1 - (wMain * 0.42) / W, y: 1 - (hMain * 0.47) / H, size, flip: !left }];
    const dateLow = date && date.y0 > 0.5;
    if (n > 1) {
      const h2 = hMain * 0.5, x2 = left ? 1 - (h2 * 0.36) / W : (h2 * 0.36) / W;
      // 日期在另一側下方時，第二枝改成靠在主株旁邊（不放到日期上）
      if (dateLow) motifs.push({ def: others[0], x: left ? (wMain * 0.88) / W : 1 - (wMain * 0.88) / W, y: 1 - (h2 * 0.45) / H, size: size * 0.5, rot: (left ? 1 : -1) * 0.12, flip: !left });
      else motifs.push({ def: others[0], x: x2, y: 1 - (h2 * 0.45) / H, size: size * 0.5, flip: left });
    }
    if (n > 2 && !dateLow) {
      const h3 = hMain * 0.36;
      motifs.push({ def: others[1] || others[0], x: left ? (wMain * 0.95) / W : 1 - (wMain * 0.95) / W, y: 1 - (h3 * 0.42) / H, size: size * 0.36, rot: (left ? 1 : -1) * 0.18, flip: !left });
    }
    drawStipple(ctx, W, H, { seed: o.seed, motifs });
  } else if (kind === 'printgrid') {
    // 版畫方格：一條奶油色的紙條貼在照片一側（避開日期），上面一格一格交錯印——
    // 墨色格挖出植物（露出紙色）、紙色格印上墨色植物；格與格之間留一條細細的紙縫（參考圖 11、13 的印法）
    const n = Math.max(2, Math.min(7, o.count || 4)), ink = INKS[Math.floor((o.seed || 1) % INKS.length)];
    const vertical = W <= H * 1.15;
    const tile = S * 0.2 * sc, gap = S * 0.008, pad = S * 0.012, margin = S * 0.03;
    const plants = ART_PRINT.slice().sort(() => r() - 0.5);
    const startLeft = date ? date.x0 > 0.5 : (o.seed || 1) % 2 === 0;
    const startTop = !(date && !vertical && date.y1 < 0.5);
    // 放得下幾格（不蓋到日期、不超出照片）
    const pos = [];
    for (let i = 0; i < n; i++) {
      let x, y;
      if (vertical) { x = startLeft ? margin + pad : W - margin - pad - tile; y = margin + pad + i * (tile + gap); }
      else { y = startTop ? margin + pad : H - margin - pad - tile; x = startLeft ? margin + pad + i * (tile + gap) : W - margin - pad - tile - i * (tile + gap); }
      if (x < 0 || y < 0 || x + tile > W - margin * 0.5 || y + tile > H - margin * 0.5) break;
      if (dateRect && x < dateRect[0] + dateRect[2] + pad && x + tile > dateRect[0] - pad && y < dateRect[1] + dateRect[3] + pad && y + tile > dateRect[1] - pad) break;
      pos.push([x, y]);
    }
    if (pos.length) {
      // 紙條：奶油紙＋一點紙纖維＋淡淡的投影（像一張印好的小紙條貼在照片上）
      const xs = pos.map((p) => p[0]), ys = pos.map((p) => p[1]);
      const sx = Math.min(...xs) - pad, sy = Math.min(...ys) - pad, sw = Math.max(...xs) + tile + pad - sx, sh = Math.max(...ys) + tile + pad - sy;
      ctx.save();
      ctx.shadowColor = 'rgba(60,45,30,.28)'; ctx.shadowBlur = S * 0.012; ctx.shadowOffsetY = S * 0.004;
      ctx.fillStyle = PAPER;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
      ctx.fillStyle = ctx.createPattern(paperFiber(), 'repeat');
      ctx.fillRect(sx, sy, sw, sh);
      ctx.restore();
      const T = document.createElement('canvas'), Tw = Math.ceil(tile);
      T.width = T.height = Tw;
      pos.forEach(([x, y], i) => {
        const inkTile = i % 2 === 0, def = plants[i % plants.length], k = Tw / 100;
        const [vw, vh] = def.vb || [100, 100], kk = 118 / Math.max(vw, vh); // 植物比格子大一點、超出去的切掉（像參考圖那樣滿版）
        const plant = (g, color, sd) => {
          g.save(); g.translate(50 - (vw * kk) / 2, 50 - (vh * kk) / 2 + 6); g.scale(kk, kk);
          drawPrintDef(g, { ...def, parts: def.parts.map((p) => ({ ...p, f: p.f ? 'M' : null, s: p.s ? 'M' : null })) }, color, 1, sd);
          g.restore();
        };
        const tx = T.getContext('2d');
        tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, Tw, Tw);
        tx.scale(k, k);
        if (inkTile) {
          // 整格上墨，再把植物「刻掉」（刻兩次，挖得乾淨）
          drawPrintDef(tx, { parts: [{ d: 'M1 1H99V99H1Z', f: 'M' }] }, ink, 1, i + 7);
          tx.globalCompositeOperation = 'destination-out';
          plant(tx, '#000', i + 11); plant(tx, '#000', i + 11);
          tx.globalCompositeOperation = 'source-over';
        } else plant(tx, ink, i + 11);
        ctx.drawImage(T, Math.round(x), Math.round(y), Tw, Tw);
      });
    }
  }
  ctx.restore();
}
