// Decorative detail for the White County CAD map: crop fields, woodlots, farm ponds,
// farmsteads with grain bins, oil lease roads, the rail line, bridges, street trees,
// driveways, pools, parking lots, townships and detailed station sites.
//
// Pure presentation: generated once (lazily) with its own seeded RNG so it never changes
// the simulation, addresses or saves. Every layer is culled to the viewport and only
// drawn above a zoom threshold, and the CAD map caches its base layer, so the extra
// detail costs nothing while units move – only when you pan or zoom.
import { city, TOWNS, RIVERS, ROADS, townAt, nearRiver } from '../../data/city.js';

let cache = null;
export function mapDetail() { return (cache ||= build()); }

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function pointAlong(rd, d) {
  let i = 1; while (i < rd.cum.length - 1 && rd.cum[i] < d) i++;
  const [ax, ay] = rd.pts[i - 1], [bx, by] = rd.pts[i]; const L = rd.cum[i] - rd.cum[i - 1] || 1; const k = Math.max(0, Math.min(1, (d - rd.cum[i - 1]) / L));
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, nx: -(by - ay) / L, ny: (bx - ax) / L };
}

function segInter(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]]; const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a[0] + r[0] * t, y: a[1] + r[1] * t, ang: Math.atan2(r[1], r[0]) } : null;
}

// Roughly where White County's townships sit (labels only).
export const TOWNSHIPS = [
  ['MILL SHOALS TWP', 1900, 900], ['BURNT PRAIRIE TWP', 4300, 1500], ['GRAY TWP', 9900, 1000], ['INDIAN CREEK TWP', 1600, 3800],
  ['ENFIELD TWP', 2700, 5000], ['CARMI TWP', 6100, 4800], ['PHILLIPS TWP', 9600, 3500], ['HERALDS PRAIRIE TWP', 3700, 8300],
  ['HAWTHORNE TWP', 7600, 6700], ['EMMA TWP', 9300, 8000],
];

// Decorative rail line (east–west through the south side of Carmi, then north-east to the Wabash).
const RAIL = [[-500, 6900], [1400, 6870], [3000, 6820], [4600, 6760], [5600, 6720], [6900, 6700], [7700, 6250], [8300, 5600], [8900, 4900], [9600, 3700], [10300, 2600], [10900, 2000], [11320, 1650], [12450, 1300]];

function build() {
  const r = rng(20261107);
  const D = { fields: [], woodlots: [], ponds: [], farmsteads: [], lease: [], streetTrees: [], driveways: [], pools: [], lots: [], bridges: [], rail: RAIL, townships: TOWNSHIPS, oxbows: [] };
  // ---- crop fields: 640 m sections split into quarter/half fields with crop + row direction
  const CROPS = ['corn', 'soy', 'stubble', 'wheat', 'pasture', 'soy', 'corn', 'stubble'];
  const F = 640;
  for (let fx = 0; fx < 11600; fx += F) for (let fy = 0; fy < 10600; fy += F) {
    const split = r() < 0.55 ? (r() < 0.5 ? 'h' : 'v') : r() < 0.4 ? 'q' : 'n';
    const parts = split === 'n' ? [[0, 0, 1, 1]] : split === 'h' ? [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] : split === 'v' ? [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] : [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
    for (const [px, py, pw, ph] of parts) {
      const x = fx + px * F + 8, y = fy + py * F + 8, w = pw * F - 16, h = ph * F - 16; const cx = x + w / 2, cy = y + h / 2;
      if (townAt(cx, cy, 60) || nearRiver(cx, cy, 120)) continue;
      D.fields.push({ x, y, w, h, crop: CROPS[Math.floor(r() * CROPS.length)], dir: r() < 0.5 ? 0 : 1, tone: r() });
      if (r() < 0.16) { const vert = r() < 0.5; D.woodlots.push({ hedge: true, trees: hedgerow(r, vert ? x + w : x, vert ? y : y + h, vert ? 0 : w, vert ? h : 0) }); }
    }
  }
  // ---- woodlots scattered through the countryside
  for (let i = 0; i < 260; i++) {
    const x = r() * 11200 + 100, y = r() * 10300 + 100; if (townAt(x, y, 140)) continue;
    const n = 4 + Math.floor(r() * 9); const trees = [];
    for (let k = 0; k < n; k++) trees.push([x + (r() - 0.5) * 180, y + (r() - 0.5) * 140, 24 + r() * 30]);
    D.woodlots.push({ trees, cx: x, cy: y, r: 95 });
  }
  // ---- oxbow lakes and sandbars along the big rivers
  for (const rv of RIVERS.slice(0, 2)) for (let i = 1; i < rv.points.length - 2; i += 2) {
    const [ax, ay] = rv.points[i], [bx, by] = rv.points[i + 1]; const L = Math.hypot(bx - ax, by - ay); const nx = -(by - ay) / L, ny = (bx - ax) / L; const sd = r() < 0.5 ? 1 : -1;
    const x = (ax + bx) / 2 + nx * sd * (rv.width + 140), y = (ay + by) / 2 + ny * sd * (rv.width + 140);
    if (!townAt(x, y, 100)) D.oxbows.push({ x, y, rx: 120 + r() * 80, ry: 26 + r() * 14, rot: Math.atan2(by - ay, bx - ax) + (r() - 0.5) * 0.6 });
  }
  // ---- farmsteads: house, barn, machine shed, grain bins, driveway, pond; lease roads to oil wells
  for (const f of city.farms) {
    const rd = ROADS[f.road]; const p = rd ? pointAlong(rd, f.along) : { x: f.x, y: f.y, nx: 0, ny: 1 };
    const ang = Math.atan2(p.ny, p.nx) * 1 + (r() - 0.5) * 0.2;
    const bins = []; const nb = r() < 0.75 ? 1 + Math.floor(r() * 4) : 0;
    for (let k = 0; k < nb; k++) bins.push([18 + k * 13, -26, 5.5 + r() * 2]);
    D.farmsteads.push({ x: f.x, y: f.y, road: [p.x, p.y], ang, barn: f.barn, bins, shed: r() < 0.6, houseTone: r() });
    if (r() < 0.3) { const a = r() * 6.283; const d = 70 + r() * 40; const px = f.x + Math.cos(a) * d, py = f.y + Math.sin(a) * d; if (!nearRiver(px, py, 40)) D.ponds.push({ x: px, y: py, rx: 16 + r() * 18, ry: 11 + r() * 12, rot: r() * 3 }); }
  }
  for (const w of city.wells) {
    let best = null, bd = 1e9; for (const f of city.farms) { const d = Math.hypot(f.x - w.x, f.y - w.y); if (d < bd) { bd = d; best = f; } }
    if (best && bd < 400) D.lease.push([w.x, w.y, best.x, best.y]);
  }
  // ---- town detail: street trees, driveways, pools, parking lots
  for (const b of city.blocks) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    if (b.zone === 'residential' || b.zone === 'park') {
      const step = b.zone === 'park' ? 12 : 16;
      for (let x = b.x0 + 14; x < b.x1 - 10; x += step) for (const y of [b.y0 + 9.5, b.y1 - 9.5]) if (r() < (b.zone === 'park' ? 0.9 : 0.55)) D.streetTrees.push([x + (r() - 0.5) * 4, y, 3.5 + r() * 2.5]);
      for (let y = b.y0 + 16; y < b.y1 - 12; y += step) for (const x of [b.x0 + 9.5, b.x1 - 9.5]) if (r() < (b.zone === 'park' ? 0.9 : 0.4)) D.streetTrees.push([x, y + (r() - 0.5) * 4, 3.5 + r() * 2.5]);
      if (b.zone === 'park') for (let k = 0; k < 18; k++) D.streetTrees.push([b.x0 + 14 + r() * (w - 28), b.y0 + 14 + r() * (h - 28), 4 + r() * 4]);
    }
    if (b.zone === 'residential') for (const [bx, by, bw, bh] of b.buildings) {
      const top = by - b.y0 < h / 2; const dx = bx + bw * (r() < 0.5 ? 0.15 : 0.7);
      D.driveways.push(top ? [dx, b.y0 + 5, 3.2, Math.max(1, by - b.y0 - 5)] : [dx, by + bh, 3.2, Math.max(1, b.y1 - 5 - (by + bh))]);
      if (r() < 0.12) D.pools.push([bx + bw * 0.3, top ? by + bh + 6 : by - 12, 7, 4.5]);
    }
    if (b.zone === 'commercial' || b.zone === 'industrial' || b.zone === 'institutional') {
      const used = b.buildings.reduce((m, [, by, , bh]) => Math.max(m, by + bh), b.y0);
      const ly = used + 5, lh = b.y1 - 8 - ly;
      if (lh > 16) D.lots.push({ x: b.x0 + 8, y: ly, w: w - 16, h: lh, industrial: b.zone === 'industrial' });
    }
  }
  // ---- bridges where roads cross rivers
  for (const e of city.edges) {
    const A = city.nodes[e.a], Bn = city.nodes[e.b];
    for (const rv of RIVERS) for (let i = 0; i < rv.points.length - 1; i++) {
      const hit = segInter([A.x, A.y], [Bn.x, Bn.y], rv.points[i], rv.points[i + 1]);
      if (hit) D.bridges.push({ ...hit, len: rv.width + 34, kind: e.kind, river: rv.name });
    }
  }
  // spatial buckets per town so in-town layers only touch towns on screen
  D.townSets = TOWNS.map((t) => {
    const inT = (x, y) => x >= t.x0 - 30 && x <= t.x1 + 30 && y >= t.y0 - 30 && y <= t.y1 + 30;
    return { x0: t.x0, y0: t.y0, x1: t.x1, y1: t.y1, trees: D.streetTrees.filter(([x, y]) => inT(x, y)), driveways: D.driveways.filter(([x, y]) => inT(x, y)), pools: D.pools.filter(([x, y]) => inT(x, y)), lots: D.lots.filter((l) => inT(l.x, l.y)) };
  });
  return D;
}

function hedgerow(r, x, y, dx, dy) {
  const L = Math.hypot(dx, dy); const n = Math.floor(L / 26); const out = [];
  for (let i = 0; i <= n; i++) if (r() < 0.8) out.push([x + (dx * i) / Math.max(1, n) + (r() - 0.5) * 8, y + (dy * i) / Math.max(1, n) + (r() - 0.5) * 8, 10 + r() * 9]);
  return out;
}

const patterns = new Map();
function rowPattern(ctx, col, dir, gap) {
  const key = `${col}|${dir}|${gap}`; let p = patterns.get(key); if (p) return p;
  const c = document.createElement('canvas'); c.width = dir ? gap : 4; c.height = dir ? 4 : gap; const g = c.getContext('2d');
  g.fillStyle = col; if (dir) g.fillRect(0, 0, Math.max(1, Math.round(gap * 0.3)), 4); else g.fillRect(0, 0, 4, Math.max(1, Math.round(gap * 0.3)));
  p = ctx.createPattern(c, 'repeat'); patterns.set(key, p); return p;
}

const CROP_COL = {
  corn: ['#1d2a17', '#22301a', 'rgba(140,170,90,.06)'], soy: ['#1a2a1c', '#1d2f1f', 'rgba(120,180,110,.06)'], wheat: ['#28281a', '#2c2b1b', 'rgba(210,190,120,.06)'],
  stubble: ['#262418', '#2a2719', 'rgba(200,170,110,.07)'], pasture: ['#17271a', '#1a2b1c', null],
};

/** Layers drawn inside the county clip, under rivers and roads. */
export function drawGround(ctx, X, Y, s, w, h) {
  const D = mapDetail(); const vis = (x, y, pad) => { const px = X(x), py = Y(y); return px > -pad && py > -pad && px < w + pad && py < h + pad; };
  const rows = s > 0.06; const gap = Math.max(4, Math.round(24 * s));
  for (const f of D.fields) {
    const px = X(f.x), py = Y(f.y), pw = f.w * s, ph = f.h * s;
    if (px > w || py > h || px + pw < 0 || py + ph < 0) continue;
    const c = CROP_COL[f.crop]; ctx.fillStyle = f.tone > 0.5 ? c[1] : c[0]; ctx.fillRect(px, py, pw, ph);
    if (c[2] && rows) { ctx.fillStyle = rowPattern(ctx, c[2], f.dir, gap); ctx.fillRect(px, py, pw, ph); }
  }
  if (s > 0.04) {
    ctx.beginPath();
    for (const p of D.ponds) { if (!vis(p.x, p.y, 200 * s + 10)) continue; const px = X(p.x), py = Y(p.y); ctx.moveTo(px + Math.max(1.5, p.rx * s) * Math.cos(p.rot), py + Math.max(1.5, p.rx * s) * Math.sin(p.rot)); ctx.ellipse(px, py, Math.max(1.5, p.rx * s), Math.max(1, p.ry * s), p.rot, 0, 6.283); }
    for (const p of D.oxbows) { if (!vis(p.x, p.y, 200 * s + 10)) continue; const px = X(p.x), py = Y(p.y); ctx.moveTo(px + Math.max(1.5, p.rx * s) * Math.cos(p.rot), py + Math.max(1.5, p.rx * s) * Math.sin(p.rot)); ctx.ellipse(px, py, Math.max(1.5, p.rx * s), Math.max(1, p.ry * s), p.rot, 0, 6.283); }
    ctx.fillStyle = '#163d5c'; ctx.fill();
    if (s > 0.15) { ctx.strokeStyle = 'rgba(70,110,80,.6)'; ctx.lineWidth = 1; ctx.stroke(); }
  }
  if (s > 0.035) {
    const trees = []; const far = s < 0.12;
    if (far) { // zoomed out: one soft blob per woodlot, no hedgerows
      ctx.beginPath(); for (const lot of D.woodlots) { if (lot.hedge || !vis(lot.cx, lot.cy, 20)) continue; const cx = X(lot.cx), cy = Y(lot.cy), r2 = Math.max(1.2, lot.r * s); ctx.moveTo(cx + r2, cy); ctx.arc(cx, cy, r2, 0, 6.283); }
      ctx.fillStyle = '#163720'; ctx.fill(); return;
    }
    for (const lot of D.woodlots) { const t0 = lot.trees[0]; if (t0 && vis(t0[0], t0[1], 300 * s + 20)) for (const t of lot.trees) trees.push(t); }
    const circles = (dx, dy, k, col) => { ctx.beginPath(); for (const [x, y, rr] of trees) { const r2 = Math.max(1, rr * s * k), cx = X(x) + rr * s * dx, cy = Y(y) + rr * s * dy; ctx.moveTo(cx + r2, cy); ctx.arc(cx, cy, r2, 0, 6.283); } ctx.fillStyle = col; ctx.fill(); };
    if (s > 0.22) circles(0.3, 0.35, 1, 'rgba(0,0,0,.35)');
    circles(0, 0, 1, '#163720');
    if (s > 0.3) circles(-0.25, -0.25, 0.5, 'rgba(120,170,100,.12)');
  }
}

/** Rail line, drawn after rivers and before roads. */
export function drawRail(ctx, X, Y, s) {
  const D = mapDetail();
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  ctx.beginPath(); D.rail.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
  ctx.strokeStyle = 'rgba(10,10,12,.8)'; ctx.lineWidth = Math.max(2.4, 7 * s); ctx.stroke();
  ctx.strokeStyle = '#6b6f78'; ctx.lineWidth = Math.max(1, 2.2 * s); ctx.setLineDash([Math.max(2, 9 * s), Math.max(2, 6 * s)]); ctx.stroke(); ctx.setLineDash([]);
  if (s > 0.25) { ctx.strokeStyle = 'rgba(140,145,155,.7)'; ctx.lineWidth = Math.max(4, 9 * s); ctx.setLineDash([1.2, Math.max(3, 6 * s)]); ctx.stroke(); ctx.setLineDash([]); }
}

/** Farmsteads, oil lease roads and in-town detail. Drawn after town blocks and buildings. */
export function drawSettlement(ctx, X, Y, s, w, h) {
  const D = mapDetail(); const vis = (x, y, pad) => { const px = X(x), py = Y(y); return px > -pad && py > -pad && px < w + pad && py < h + pad; };
  if (s > 0.09) {
    ctx.strokeStyle = 'rgba(150,130,90,.55)'; ctx.lineWidth = Math.max(1, 5 * s); ctx.beginPath();
    for (const [ax, ay, bx, by] of D.lease) { if (!vis(ax, ay, 500 * s)) continue; ctx.moveTo(X(ax), Y(ay)); ctx.lineTo(X(bx), Y(by)); }
    ctx.stroke();
    for (const f of D.farmsteads) {
      if (!vis(f.x, f.y, 140 * s + 10)) continue;
      ctx.strokeStyle = 'rgba(150,140,110,.6)'; ctx.lineWidth = Math.max(1, 4 * s); ctx.beginPath(); ctx.moveTo(X(f.road[0]), Y(f.road[1])); ctx.lineTo(X(f.x), Y(f.y)); ctx.stroke();
      ctx.save(); ctx.translate(X(f.x), Y(f.y)); ctx.rotate(f.ang + Math.PI / 2); ctx.scale(s, s);
      const sh = (x, y, ww, hh, col) => { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x + 1.5, y + 2, ww, hh); ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); };
      ctx.fillStyle = '#1e2a1c'; ctx.fillRect(-34, -40, 78, 64); // yard
      sh(-10, -2, 16, 12, f.houseTone > 0.5 ? '#6c7686' : '#7d7466'); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-10, -2, 16, 5); // house + ridge light
      if (f.barn) { sh(-30, -36, 18, 26, '#7a2f25'); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(-21.5, -36, 1, 26); }
      if (f.shed) sh(10, 2, 24, 14, '#6d737b');
      for (const [bx, by, br] of f.bins) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(bx + 1.5, by + 2, br, 0, 6.283); ctx.fill(); ctx.fillStyle = '#a9b0b8'; ctx.beginPath(); ctx.arc(bx, by, br, 0, 6.283); ctx.fill(); if (s > 0.4) { ctx.fillStyle = '#d6dbe0'; ctx.beginPath(); ctx.arc(bx, by, br * 0.25, 0, 6.283); ctx.fill(); } }
      ctx.restore();
    }
  }
  const towns = D.townSets.filter((t) => X(t.x1) > -40 && X(t.x0) < w + 40 && Y(t.y1) > -40 && Y(t.y0) < h + 40);
  const pick = (k) => towns.length === 1 ? towns[0][k] : towns.flatMap((t) => t[k]);
  if (!towns.length) return;
  if (s > 0.28) {
    for (const l of pick('lots')) {
      if (!vis(l.x, l.y, 200)) continue;
      const px = X(l.x), py = Y(l.y), pw = l.w * s, ph = l.h * s;
      ctx.fillStyle = l.industrial ? '#2a2d2f' : '#23272e'; ctx.fillRect(px, py, pw, ph);
      if (s > 0.5) { ctx.strokeStyle = 'rgba(230,230,230,.28)'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = px + 6 * s; x < px + pw - 2; x += 6 * s) { ctx.moveTo(x, py + 1); ctx.lineTo(x, py + Math.min(ph * 0.4, 12 * s)); ctx.moveTo(x, py + ph - 1); ctx.lineTo(x, py + ph - Math.min(ph * 0.4, 12 * s)); } ctx.stroke(); }
    }
  }
  if (s > 0.45) {
    ctx.fillStyle = '#3a3f46';
    for (const [x, y, dw, dh] of pick('driveways')) { if (!vis(x, y, 40)) continue; ctx.fillRect(X(x), Y(y), Math.max(1, dw * s), Math.max(1, dh * s)); }
  }
  if (s > 0.6) {
    for (const [x, y, pw, ph] of pick('pools')) { if (!vis(x, y, 40)) continue; ctx.fillStyle = '#d7dde3'; ctx.fillRect(X(x) - 1, Y(y) - 1, pw * s + 2, ph * s + 2); ctx.fillStyle = '#3fa7d6'; ctx.fillRect(X(x), Y(y), pw * s, ph * s); }
  }
  if (s > 0.32) {
    const vt = pick('trees').filter(([x, y]) => vis(x, y, 20));
    for (const [dx, dy, col] of [[1, 1.4, 'rgba(0,0,0,.35)'], [0, 0, '#1b4426']]) { ctx.beginPath(); for (const [x, y, rr] of vt) { const r2 = Math.max(1, rr * s), cx = X(x) + dx, cy = Y(y) + dy; ctx.moveTo(cx + r2, cy); ctx.arc(cx, cy, r2, 0, 6.283); } ctx.fillStyle = col; ctx.fill(); }
  }
}

/** Bridge decks over rivers (after roads). */
export function drawBridges(ctx, X, Y, s, w, h) {
  if (s < 0.06) return;
  const D = mapDetail();
  for (const b of D.bridges) {
    const px = X(b.x), py = Y(b.y); if (px < -40 || py < -40 || px > w + 40 || py > h + 40) continue;
    const L = Math.max(8, b.len * s), W = Math.max(4, (b.kind === 'interstate' ? 26 : b.kind === 'street' ? 12 : 16) * s);
    ctx.save(); ctx.translate(px, py); ctx.rotate(b.ang);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-L / 2 + 2, -W / 2 + 3, L, W);
    ctx.fillStyle = '#8a8f98'; ctx.fillRect(-L / 2, -W / 2, L, W);
    ctx.fillStyle = '#4a4e55'; ctx.fillRect(-L / 2 + 2, -W / 2 + 2, L - 4, W - 4);
    ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 1; ctx.strokeRect(-L / 2, -W / 2, L, W);
    ctx.restore();
  }
}

/** Township names (county-wide view) plus a scale bar and north arrow. */
export function drawOverlays(ctx, X, Y, s, w, h, SCALE_M) {
  const D = mapDetail();
  if (s < 0.13) {
    ctx.save(); ctx.font = `700 ${Math.max(9, Math.min(13, 9 + s * 40))}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(190,200,175,.22)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
    for (const [name, x, y] of D.townships) ctx.fillText(name, X(x), Y(y));
    ctx.restore();
  }
  // scale bar: pick a round distance in miles
  const pxPerMile = (1609 / SCALE_M) * s; const opts = [0.1, 0.25, 0.5, 1, 2, 5, 10];
  const miles = opts.find((m) => m * pxPerMile > 60) || 10; const len = miles * pxPerMile;
  const x0 = 12, y0 = h - 14;
  ctx.save(); ctx.fillStyle = 'rgba(8,12,20,.7)'; ctx.fillRect(x0 - 6, y0 - 18, len + 58, 26);
  ctx.fillStyle = '#dfe8f5'; ctx.fillRect(x0, y0, len, 3); ctx.fillRect(x0, y0 - 5, 2, 8); ctx.fillRect(x0 + len - 2, y0 - 5, 2, 8); ctx.fillRect(x0 + len / 2 - 1, y0 - 3, 2, 6);
  ctx.font = '700 10px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`${miles} mi`, x0 + len + 8, y0 - 3);
  // north arrow
  const nx = w - 26, ny = h - 34;
  ctx.fillStyle = 'rgba(8,12,20,.7)'; ctx.beginPath(); ctx.arc(nx, ny, 15, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#ff5a4e'; ctx.beginPath(); ctx.moveTo(nx, ny - 11); ctx.lineTo(nx + 5, ny + 2); ctx.lineTo(nx - 5, ny + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9fb2cc'; ctx.beginPath(); ctx.moveTo(nx, ny + 11); ctx.lineTo(nx + 5, ny + 2); ctx.lineTo(nx - 5, ny + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '800 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText('N', nx, ny - 20);
  ctx.restore();
}

// ---------------- detailed station sites ----------------
const CAR = {
  police: ['#101418', '#f2f4f6'], sheriff: ['#e9e4d6', '#5b4a2a'], fire: ['#c4161c', '#e8e8e8'], ems: ['#f4f4f4', '#d0352b'], civ: ['#5c6470', '#8d96a3'], federal: ['#20262e', '#20262e'],
};
function car(ctx, x, y, rot, kind, lit) {
  const [body, accent] = CAR[kind] || CAR.civ;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-1.6, -3.4, 3.6, 7.2);
  ctx.fillStyle = body; ctx.fillRect(-1.8, -3.7, 3.6, 7.4);
  if (kind === 'police') { ctx.fillStyle = accent; ctx.fillRect(-1.8, -1.2, 3.6, 2.4); }
  else if (kind === 'sheriff') { ctx.fillStyle = accent; ctx.fillRect(-1.8, -0.6, 3.6, 1.2); }
  else if (kind === 'ems') { ctx.fillStyle = accent; ctx.fillRect(-1.8, 0.2, 3.6, 0.8); }
  ctx.fillStyle = 'rgba(120,170,220,.75)'; ctx.fillRect(-1.4, -2.6, 2.8, 1.1); ctx.fillRect(-1.4, 2.0, 2.8, 0.8);
  if (kind === 'police' || kind === 'sheriff' || kind === 'fire' || kind === 'ems') { ctx.fillStyle = lit ? '#ff2a2a' : '#7a1515'; ctx.fillRect(-1.4, -1.0, 1.4, 0.6); ctx.fillStyle = lit ? '#2a6bff' : '#152a7a'; ctx.fillRect(0, -1.0, 1.4, 0.6); }
  ctx.restore();
}
function truck(ctx, x, y, rot, kind) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-2.2, -5.4, 4.8, 11.4);
  ctx.fillStyle = kind === 'ems' ? '#f4f4f4' : '#c4161c'; ctx.fillRect(-2.4, -5.8, 4.8, 11.6);
  ctx.fillStyle = kind === 'ems' ? '#d0352b' : '#e9e9e9'; ctx.fillRect(-2.4, -1, 4.8, 0.8);
  ctx.fillStyle = 'rgba(120,170,220,.8)'; ctx.fillRect(-1.9, -5.3, 3.8, 1.1);
  if (kind !== 'ems') { ctx.fillStyle = '#9aa0a8'; ctx.fillRect(-0.5, -3, 1, 7.5); }
  ctx.restore();
}
function shadowRect(ctx, x, y, w, h, col, roof = true) {
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x + 2.2, y + 2.8, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  if (roof) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x, y, w, h * 0.45); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.6; ctx.strokeRect(x, y, w, h); }
}
function hvac(ctx, x, y) { ctx.fillStyle = '#8b929b'; ctx.fillRect(x, y, 3.2, 2.4); ctx.fillStyle = '#5d636b'; ctx.beginPath(); ctx.arc(x + 1.6, y + 1.2, 0.8, 0, 6.283); ctx.fill(); }
function stalls(ctx, x, y, n, dir = 1) { ctx.strokeStyle = 'rgba(240,240,240,.55)'; ctx.lineWidth = 0.35; ctx.beginPath(); for (let i = 0; i <= n; i++) { ctx.moveTo(x + i * 3.2, y); ctx.lineTo(x + i * 3.2, y + 6 * dir); } ctx.stroke(); }
function tower(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y + 11); ctx.lineTo(x + 13, y + 12.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 0.5; ctx.strokeRect(x - 2, y - 2, 4, 4); ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 2, y + 2); ctx.moveTo(x + 2, y - 2); ctx.lineTo(x - 2, y + 2); ctx.stroke();
  ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(x, y, 0.8, 0, 6.283); ctx.fill();
}
function flag(ctx, x, y) { ctx.fillStyle = '#d9dde3'; ctx.beginPath(); ctx.arc(x, y, 0.6, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x, y, 6, 0.5); }

/** Draw one facility's site in local meters (call with the context translated to the facility and scaled by s). */
function drawSite(ctx, f, s, t) {
  const lit = Math.floor(t * 2) % 2 === 0;
  const k = f.kind;
  if (k === 'police_hq' || k === 'precinct' || k === 'sheriff') {
    const big = k !== 'precinct'; const fleet = k === 'sheriff' ? 'sheriff' : 'police';
    const W = big ? 64 : 44, Hh = big ? 46 : 34;
    ctx.fillStyle = '#1f2a1e'; ctx.fillRect(-W / 2 - 4, -Hh / 2 - 4, W + 8, Hh + 8);           // lawn / landscaping
    ctx.fillStyle = '#25292f'; ctx.fillRect(-W / 2, -Hh / 2 + Hh * 0.46, W, Hh * 0.54);         // parking lot
    ctx.fillStyle = '#3a3f46'; ctx.fillRect(-W / 2, Hh / 2 - 4, 6, 4);                            // drive entrance
    const bw = big ? 36 : 24, bh = big ? 18 : 14; const bx = -W / 2 + 4, by = -Hh / 2 + 3;
    shadowRect(ctx, bx, by, bw, bh, k === 'sheriff' ? '#6d6455' : '#5a6475');                  // main building
    shadowRect(ctx, bx + bw, by + 3, big ? 14 : 10, bh - 6, '#4c5462');                          // sally port / garage wing
    ctx.fillStyle = '#9aa3b0'; for (let i = 0; i < (big ? 3 : 2); i++) ctx.fillRect(bx + bw + 1.5 + i * 4.2, by + bh - 3.4, 3.2, 0.6); // garage doors
    hvac(ctx, bx + 4, by + 3); hvac(ctx, bx + 10, by + 3); if (big) hvac(ctx, bx + 26, by + 4);
    ctx.fillStyle = '#c9ced6'; ctx.fillRect(bx + bw * 0.4, by + bh, 6, 2.4);                    // front canopy
    flag(ctx, bx + bw * 0.4 - 3, by + bh + 4);
    if (big) tower(ctx, W / 2 - 6, -Hh / 2 + 6);
    // marked fleet + staff cars
    const rowY = Hh / 2 - 9; const n = big ? 7 : 4;
    stalls(ctx, -W / 2 + 8, rowY, n + 2, 1);
    for (let i = 0; i < n; i++) car(ctx, -W / 2 + 9.6 + i * 3.2, rowY + 3.2, 0, i < n - 2 ? fleet : 'civ', lit && i === 0);
    stalls(ctx, -W / 2 + 8, -Hh / 2 + Hh * 0.46 + 6.5, n, -1);
    for (let i = 0; i < Math.max(2, n - 3); i++) car(ctx, -W / 2 + 9.6 + i * 3.2, -Hh / 2 + Hh * 0.46 + 3.6, Math.PI, i % 2 ? 'civ' : fleet, false);
    return;
  }
  if (k === 'fire' || k === 'fire_hq') {
    const W = 46, Hh = 36;
    ctx.fillStyle = '#1f2a1e'; ctx.fillRect(-W / 2 - 3, -Hh / 2 - 3, W + 6, Hh + 6);
    ctx.fillStyle = '#5b5f66'; ctx.fillRect(-W / 2 + 2, -Hh / 2 + 18, 26, 18);                  // concrete apron
    shadowRect(ctx, -W / 2 + 2, -Hh / 2 + 2, 26, 16, '#7b3a2c');                                // apparatus bays (brick)
    shadowRect(ctx, -W / 2 + 28, -Hh / 2 + 4, 14, 12, '#6b6f78');                               // quarters
    ctx.fillStyle = '#c4161c'; for (let i = 0; i < 3; i++) ctx.fillRect(-W / 2 + 3.5 + i * 8.4, -Hh / 2 + 17, 6.8, 1);
    hvac(ctx, -W / 2 + 31, -Hh / 2 + 6);
    if (k === 'fire') { truck(ctx, -W / 2 + 7, -Hh / 2 + 26, 0, 'fire'); truck(ctx, -W / 2 + 15.4, -Hh / 2 + 27, 0, 'fire'); }
    ctx.fillStyle = '#25292f'; ctx.fillRect(-W / 2 + 30, -Hh / 2 + 20, 14, 14); stalls(ctx, -W / 2 + 30.5, -Hh / 2 + 21, 4, 1);
    car(ctx, -W / 2 + 32, -Hh / 2 + 24.5, 0, 'civ'); car(ctx, -W / 2 + 38.5, -Hh / 2 + 24.5, 0, 'civ');
    flag(ctx, -W / 2 + 30, -Hh / 2 + 18);
    return;
  }
  if (k === 'ems') {
    ctx.fillStyle = '#1f2a1e'; ctx.fillRect(-20, -15, 40, 30);
    ctx.fillStyle = '#5b5f66'; ctx.fillRect(-18, 1, 22, 13);
    shadowRect(ctx, -18, -13, 22, 13, '#6a7280'); shadowRect(ctx, 4, -11, 13, 10, '#59606c');
    ctx.fillStyle = '#e8edf2'; for (let i = 0; i < 2; i++) ctx.fillRect(-16.5 + i * 10, 0, 8.5, 0.9);
    truck(ctx, -12, 7.5, 0, 'ems'); truck(ctx, -2.5, 8, 0, 'ems');
    hvac(ctx, 6, -9);
    return;
  }
  if (k === 'hospital') {
    ctx.fillStyle = '#1f2a1e'; ctx.fillRect(-46, -36, 92, 72);
    ctx.fillStyle = '#25292f'; ctx.fillRect(-44, 8, 52, 26); stalls(ctx, -42, 10, 15, 1); stalls(ctx, -42, 32, 15, -1);
    for (let i = 0; i < 10; i++) car(ctx, -40.4 + i * 3.2 * 1.5, 13.5, 0, 'civ'); for (let i = 0; i < 8; i++) car(ctx, -40.4 + i * 3.2 * 1.8, 28.5, Math.PI, 'civ');
    shadowRect(ctx, -40, -32, 54, 34, '#7d8796'); shadowRect(ctx, 14, -28, 24, 22, '#6f7987');
    ctx.fillStyle = '#c9ced6'; ctx.fillRect(14, -6, 14, 4); truck(ctx, 22, 2, Math.PI / 2, 'ems');            // ER canopy + ambulance
    ctx.fillStyle = '#ff3b30'; ctx.fillRect(-16, -21, 8, 2.4); ctx.fillRect(-13.2, -24, 2.4, 8);                 // roof cross
    hvac(ctx, -36, -28); hvac(ctx, -30, -28); hvac(ctx, 4, -10);
    return;
  }
  if (k === 'hospital_helipad') {
    ctx.fillStyle = '#5b5f66'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-3.4, -4, 1.4, 8); ctx.fillRect(2, -4, 1.4, 8); ctx.fillRect(-2, -0.7, 4, 1.4);
    return;
  }
  if (k === 'eoc') {
    ctx.fillStyle = '#1f2a1e'; ctx.fillRect(-26, -20, 52, 40);
    ctx.fillStyle = '#25292f'; ctx.fillRect(-24, 4, 48, 14); stalls(ctx, -22, 5, 12, 1);
    for (let i = 0; i < 9; i++) car(ctx, -20.4 + i * 3.2 * 1.3, 9.5, 0, i === 2 ? 'police' : 'civ', false);
    shadowRect(ctx, -22, -17, 34, 18, '#5d6b7d'); hvac(ctx, -18, -14); hvac(ctx, -12, -14);
    ctx.fillStyle = '#7b8088'; ctx.fillRect(14, -14, 7, 5);                                        // backup generator
    tower(ctx, 18, -2);
    return;
  }
  // generic facility (public works, SAR, utility, animal control, …)
  ctx.fillStyle = '#1f2a1e'; ctx.fillRect(-20, -15, 40, 30);
  ctx.fillStyle = '#2a2d2f'; ctx.fillRect(-18, 1, 36, 12);
  shadowRect(ctx, -18, -13, 26, 13, '#5f6772'); hvac(ctx, -14, -10);
  for (let i = 0; i < 3; i++) car(ctx, -14 + i * 4.5, 7, 0, 'civ');
}

const SITE_KINDS = new Set(['police_hq', 'precinct', 'sheriff', 'fire', 'fire_hq', 'ems', 'hospital', 'hospital_helipad', 'eoc', 'sar', 'public_works', 'animal_control', 'utility', 'dot']);

/** Detailed station sites, drawn in the base layer when zoomed into a town. */
export { SITE_KINDS };
export function drawSites(ctx, X, Y, s, w, h) {
  if (s < 0.3) return;
  const t = performance.now() / 1000;
  for (const f of city.facilities) {
    if (!SITE_KINDS.has(f.kind)) continue;
    const px = X(f.x), py = Y(f.y); const pad = 70 * s;
    if (px < -pad || py < -pad || px > w + pad || py > h + pad) continue;
    ctx.save(); ctx.translate(px, py); ctx.scale(s, s); drawSite(ctx, f, s, t); ctx.restore();
  }
}
