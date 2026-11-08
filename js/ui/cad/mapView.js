// Local, no-key city map renderer (Canvas 2D). Used by the CAD map screen and the
// 3D monitor/video-wall textures.
import { city, TOWNS, RIVERS, ROADS, COUNTY_LINE, MAP_BOUNDS, DISTRICTS, REGION_BOUNDS, OUTER_TOWNS, OUTER_RIVERS, STATE_AREAS, NEIGHBOR_COUNTIES, NEIGHBOR_LINES, HAMLETS } from '../../data/city.js';
import { DEPT_BY_ID, TYPE_BY_ID } from '../../data/departments.js';
import { UNIT_STATUS_COLORS } from '../../data/incidentTypes.js';
import { EVENT_KINDS } from '../../sim/cityEvents.js';
import { SCALE } from '../../data/city.js';
import { drawGround, drawRail, drawSettlement, drawBridges, drawOverlays, drawSites, SITE_KINDS, setMapTheme } from './mapDetail.js';

const ZONE_FILL = { residential: '#13202f', commercial: '#18233a', downtown: '#1b2741', industrial: '#1d272b', park: '#10301f', forest: '#0d2918', institutional: '#1b2240', airport: '#182130', water: null };
const PRI_COLOR = { 1: '#ff4d4d', 2: '#ff9f43', 3: '#f2c94c', 4: '#6fa8dc' };
const FAC_STYLE = {
  police_hq: ['#4f8cff', 'PD'], precinct: ['#4f8cff', 'P'], sheriff: ['#d9a441', '★'], federal: ['#9aa5b1', 'F'], eoc: ['#b47cff', 'EOC'],
  fire: ['#ff5a4e', 'F'], fire_hq: ['#ff5a4e', 'FA'], ems: ['#2fd08a', '+'], hospital: ['#ffffff', 'H'], hospital_helipad: ['#ffffff', 'Ⓗ'],
  airport: ['#8b9bb4', '✈'], marina: ['#4fc3f7', '⚓'], coastguard: ['#ff7a59', 'CG'], sar: ['#ff9f43', 'SR'], public_works: ['#f2c94c', 'PW'],
  animal_control: ['#a3d977', 'AC'], dot: ['#ffb84d', 'DT'], utility: ['#7fd1d9', 'U'],
};
export class MapRenderer {
  constructor() {
    this.time = 0;
    // Edges grouped by road class with bounding boxes, so drawing culls cheaply to the viewport.
    this.byKind = {};
    for (const e of city.edges) {
      const A = city.nodes[e.a], Bn = city.nodes[e.b];
      const k = e.kind === 'street' && e.alias ? 'state' : e.kind;
      (this.byKind[k] ||= []).push([A.x, A.y, Bn.x, Bn.y, Math.min(A.x, Bn.x), Math.min(A.y, Bn.y), Math.max(A.x, Bn.x), Math.max(A.y, Bn.y), e]);
    }
  }

  fit(w, h) {
    const mw = MAP_BOUNDS.x1 - MAP_BOUNDS.x0, mh = MAP_BOUNDS.y1 - MAP_BOUNDS.y0;
    const scale = Math.min(w / mw, h / mh) * 0.98;
    return { cx: (MAP_BOUNDS.x0 + MAP_BOUNDS.x1) / 2, cy: (MAP_BOUNDS.y0 + MAP_BOUNDS.y1) / 2, scale };
  }

  /** Whole surrounding region (for the expanded map view). */
  fitRegion(w, h) {
    const B = REGION_BOUNDS; const mw = B.x1 - B.x0, mh = B.y1 - B.y0;
    return { cx: (B.x0 + B.x1) / 2, cy: (B.y0 + B.y1) / 2, scale: Math.min(w / mw, h / mh) * 0.98 };
  }
  minScale(w, h) { return this.fitRegion(w, h).scale * 0.9; }

  focusTown(id, w, h) {
    const t = TOWNS.find((x) => x.id === id) || TOWNS[0];
    const span = Math.max(t.x1 - t.x0, t.y1 - t.y0) * (t.xs.length < 5 ? 4 : 1.9);
    return { cx: t.x, cy: t.y, scale: Math.min(w, h) / span };
  }

  /** Draw static layers (terrain, water, towns, roads, labels). */
  drawBase(ctx, view, w, h, { labels = true, buildings = true, detail = 1, theme = 'night', fast = false } = {}) {
    const P = setMapTheme(theme);
    const s = view.scale; const ox = w / 2 - view.cx * s, oy = h / 2 - view.cy * s;
    const X = (x) => ox + x * s, Y = (y) => oy + y * s;
    const path = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); };
    // world-space viewport for culling
    const vx0 = -ox / s, vy0 = -oy / s, vx1 = (w - ox) / s, vy1 = (h - oy) / s;
    const inView = (x0, y0, x1, y1, pad = 0) => x1 >= vx0 - pad && x0 <= vx1 + pad && y1 >= vy0 - pad && y0 <= vy1 + pad;
    const showsOutside = vx0 < -60 || vy0 < -60 || vx1 > 11300 || vy1 > 10560;
    const fine = detail > 0 && !fast;

    ctx.fillStyle = P.outside; ctx.fillRect(0, 0, w, h);
    // ---- surrounding region (outside the jurisdiction) ----
    if (showsOutside) {
      if (detail > 0 && s > 0.018) this.outerFields(ctx, X, Y, s, P, vx0, vy0, vx1, vy1);
      for (const a of STATE_AREAS) { path(a.pts); ctx.closePath(); ctx.fillStyle = P.otherState; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1; }
    }
    // ---- county farmland with field patchwork ----
    ctx.save(); path(COUNTY_LINE); ctx.closePath(); ctx.fillStyle = P.county; ctx.fill(); ctx.clip();
    if (detail > 0) drawGround(ctx, X, Y, s, w, h);
    ctx.restore();
    // woods in the river bottoms
    if (detail > 0 || s > 0.05) {
      ctx.fillStyle = P.wood; ctx.beginPath();
      for (const [x, y, r] of city.woods) { const px = X(x), py = Y(y); if (px < -50 || py < -50 || px > w + 50 || py > h + 50) continue; const rr = Math.max(1.5, r * s); ctx.moveTo(px + rr, py); ctx.arc(px, py, rr, 0, 6.283); }
      ctx.fill();
    }
    // ---- rivers ----
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const rivers = showsOutside ? [...OUTER_RIVERS, ...RIVERS] : RIVERS;
    for (const rv of rivers) {
      const wd = Math.max(rv.width > 200 ? 4 : rv.width > 80 ? 3 : 1.6, rv.width * s);
      if (detail > 0) { path(rv.points); ctx.strokeStyle = P.bank; ctx.lineWidth = wd + Math.max(3, 60 * s); ctx.stroke(); }
      path(rv.points); ctx.strokeStyle = P.water; ctx.lineWidth = wd; ctx.stroke();
      if (detail > 0 && wd > 3) { path(rv.points); ctx.strokeStyle = P.waterHi; ctx.lineWidth = wd * 0.35; ctx.stroke(); }
    }
    if (detail > 0) drawRail(ctx, X, Y, s);
    // ---- towns outside the county (simple street grids) ----
    if (showsOutside && s > 0.02) for (const t of OUTER_TOWNS) {
      const half = (t.size + 1) * 120; if (!inView(t.x - half, t.y - half, t.x + half, t.y + half)) continue;
      const n = t.size * 2 + 2; const bs = (half * 2) / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const dc = Math.hypot(i - n / 2 + 0.5, j - n / 2 + 0.5); if (dc > n * 0.55) continue;
        ctx.fillStyle = dc < n * 0.18 ? P.block.downtown : P.block.residential;
        ctx.fillRect(X(t.x - half + i * bs + 6), Y(t.y - half + j * bs + 6), Math.max(1, (bs - 12) * s), Math.max(1, (bs - 12) * s));
      }
    }
    // ---- town blocks & buildings ----
    for (const b of city.blocks) {
      const x = X(b.x0 + 5), y = Y(b.y0 + 5), bw = (b.x1 - b.x0 - 10) * s, bh = (b.y1 - b.y0 - 10) * s;
      if (x > w || y > h || x + bw < 0 || y + bh < 0) continue;
      ctx.fillStyle = P.block[b.zone] || P.block.residential; ctx.fillRect(x, y, Math.max(1, bw), Math.max(1, bh));
      if (buildings && s > 0.14 && detail > 0) this.buildings(ctx, X, Y, s, b, P, fine);
    }
    // farmsteads, oil wells, station sites
    if (detail > 0) { drawSettlement(ctx, X, Y, s, w, h); if (!fast) drawSites(ctx, X, Y, s, w, h); }
    if (s > 0.07 && detail > 0) {
      ctx.fillStyle = '#c9a227';
      for (const wl of city.wells) { const px = X(wl.x), py = Y(wl.y); if (px < -10 || py < -10 || px > w + 10 || py > h + 10) continue; const z = Math.max(2.5, 10 * s); ctx.beginPath(); ctx.moveTo(px, py - z); ctx.lineTo(px + z * 0.8, py + z * 0.6); ctx.lineTo(px - z * 0.8, py + z * 0.6); ctx.closePath(); ctx.fill(); }
    }
    // ---- roads ----
    this.roads(ctx, X, Y, s, P, detail, fine, inView);
    ctx.lineCap = 'butt';
    if (detail > 0) drawBridges(ctx, X, Y, s, w, h);
    // ---- jurisdiction: veil everything outside White County, highlight the county line ----
    if (showsOutside) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); COUNTY_LINE.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.closePath();
      ctx.fillStyle = P.veil; ctx.fill('evenodd');
      if (detail > 0) {
        ctx.clip('evenodd'); ctx.strokeStyle = P.hatch; ctx.lineWidth = 1; ctx.beginPath();
        for (let k = -h; k < w; k += 14) { ctx.moveTo(k, h); ctx.lineTo(k + h, 0); } ctx.stroke();
      }
      ctx.restore();
      ctx.lineCap = 'round'; ctx.strokeStyle = P.neighborLine; ctx.lineWidth = 1.2; ctx.setLineDash([8, 6]);
      for (const ln of NEIGHBOR_LINES) { path(ln); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    path(COUNTY_LINE); ctx.closePath();
    if (detail > 0) { ctx.strokeStyle = P.countyGlow; ctx.lineWidth = showsOutside ? 9 : 5; ctx.stroke(); }
    ctx.setLineDash([12, 6]); ctx.strokeStyle = P.countyLine; ctx.lineWidth = showsOutside ? 2.2 : 1.6; ctx.stroke(); ctx.setLineDash([]);
    if (!labels) return;
    this.labels(ctx, X, Y, s, w, h, P, showsOutside, inView);
    if (detail > 0) drawOverlays(ctx, X, Y, s, w, h, SCALE);
  }

  /** Coarse patchwork of farm fields for the area around the county. */
  outerFields(ctx, X, Y, s, P, vx0, vy0, vx1, vy1) {
    const F = 1006; // two-mile cells
    const gx0 = Math.max(REGION_BOUNDS.x0, Math.floor(vx0 / F) * F), gy0 = Math.max(REGION_BOUNDS.y0, Math.floor(vy0 / F) * F);
    const gx1 = Math.min(REGION_BOUNDS.x1, vx1), gy1 = Math.min(REGION_BOUNDS.y1, vy1);
    for (let fx = gx0; fx < gx1; fx += F) for (let fy = gy0; fy < gy1; fy += F) {
      if (fx >= -10 && fy >= -10 && fx + F <= 11300 && fy + F <= 10500) continue;
      for (let q = 0; q < 4; q++) {
        const qx = fx + (q % 2) * F / 2, qy = fy + Math.floor(q / 2) * F / 2;
        const hsh = ((qx * 73856093) ^ (qy * 19349663)) >>> 0;
        ctx.fillStyle = P.outFields[hsh % P.outFields.length];
        ctx.fillRect(X(qx + 10), Y(qy + 10), Math.max(1, (F / 2 - 20) * s), Math.max(1, (F / 2 - 20) * s));
      }
    }
  }

  /** Buildings in one town block: shadows, gabled roofs, flat commercial roofs with rooftop units. */
  buildings(ctx, X, Y, s, b, P, fine) {
    const flat = b.zone !== 'residential';
    for (const [bx, by, bw2, bh2, shade] of b.buildings) {
      const px = X(bx), py = Y(by), pw = Math.max(1, bw2 * s), ph = Math.max(1, bh2 * s);
      const hsh = Math.floor((bx * 7.31 + by * 3.17) % 997);
      if (pw > 3 && fine) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(px + Math.max(1, 3 * s), py + Math.max(1, 3.5 * s), pw, ph); }
      const roof = b.zone === 'industrial' ? P.roofInd : flat ? P.roofCom : P.roofs[hsh % P.roofs.length];
      ctx.fillStyle = roof; ctx.fillRect(px, py, pw, ph);
      if (!fine || pw < 5) continue;
      if (flat) {
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
        if (pw > 14) { ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k < Math.min(4, Math.floor(pw / 14)); k++) ctx.fillRect(px + 4 + k * 12 * Math.max(0.6, s), py + ph * 0.3, Math.max(2, 3 * s), Math.max(2, 2.4 * s)); }
      } else {
        // gable: lit half and shaded half split along the ridge (long axis)
        const along = pw >= ph;
        ctx.fillStyle = 'rgba(255,255,255,.12)'; along ? ctx.fillRect(px, py, pw, ph / 2) : ctx.fillRect(px, py, pw / 2, ph);
        ctx.fillStyle = 'rgba(0,0,0,.14)'; along ? ctx.fillRect(px, py + ph / 2, pw, ph / 2) : ctx.fillRect(px + pw / 2, py, pw / 2, ph);
        ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.beginPath();
        if (along) { ctx.moveTo(px + ph * 0.3, py + ph / 2); ctx.lineTo(px + pw - ph * 0.3, py + ph / 2); } else { ctx.moveTo(px + pw / 2, py + pw * 0.3); ctx.lineTo(px + pw / 2, py + ph - pw * 0.3); }
        ctx.stroke();
      }
    }
  }

  /** Road network with casings, real-width surfaces and lane markings when zoomed in. */
  roads(ctx, X, Y, s, P, detail, fine, inView) {
    const W = { street: 9, township: 6, county: 8, state: 11, us: 12, interstate: 8.5 };
    const MIN = { street: 1, township: 0.7, county: 1.1, state: 1.7, us: 2, interstate: 2.6 };
    const order = ['township', 'street', 'county', 'state', 'us', 'interstate'];
    const pad = 40;
    const stroke = (kind, width, color, dash, offset = 0) => {
      const list = this.byKind[kind]; if (!list) return;
      ctx.strokeStyle = color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      for (const [ax, ay, bx, by, x0, y0, x1, y1] of list) {
        if (!inView(x0, y0, x1, y1, pad)) continue;
        if (offset) { const L = Math.hypot(bx - ax, by - ay) || 1; const nx = -(by - ay) / L * offset, ny = (bx - ax) / L * offset; ctx.moveTo(X(ax + nx), Y(ay + ny)); ctx.lineTo(X(bx + nx), Y(by + ny)); }
        else { ctx.moveTo(X(ax), Y(ay)); ctx.lineTo(X(bx), Y(by)); }
      }
      ctx.stroke(); if (dash) ctx.setLineDash([]);
    };
    if (s < 0.02) order.shift(); // gravel section roads vanish at the widest zoom
    const twin = s > 0.14 && fine; // divided interstate when zoomed in
    const px = (k) => Math.max(MIN[k], W[k] * s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // casings (and sidewalks for town streets)
    for (const k of order) {
      if (k === 'street' && s > 0.5 && fine) stroke(k, px(k) + Math.max(2, 7 * s), P.sidewalk);
      if (k === 'interstate' && twin) { const off = 9; stroke(k, (W[k] + 16) * s * 1 + 2, P.median); stroke(k, px(k) + 2, P.casing, null, off); stroke(k, px(k) + 2, P.casing, null, -off); continue; }
      if (detail > 0 || k === 'interstate') stroke(k, px(k) + (k === 'township' ? 1 : 2), P.casing);
    }
    // surfaces
    for (const k of order) {
      if (k === 'interstate' && twin) { stroke(k, px(k), P.road[k], null, 9); stroke(k, px(k), P.road[k], null, -9); continue; }
      stroke(k, px(k), P.road[k]);
    }
    if (!fine) return;
    // markings
    if (s > 0.22) {
      stroke('county', Math.max(0.8, 0.5 * s), P.center, [Math.max(3, 9 * s), Math.max(3, 12 * s)]);
      for (const k of ['state', 'us']) {
        if (s > 0.55) { stroke(k, Math.max(0.8, 0.45 * s), P.center, null, 0.7); stroke(k, Math.max(0.8, 0.45 * s), P.center, null, -0.7); }
        else stroke(k, Math.max(0.8, 0.5 * s), P.center, [Math.max(3, 9 * s), Math.max(3, 9 * s)]);
        if (s > 0.6) { stroke(k, Math.max(0.6, 0.3 * s), P.edgeLine, null, W[k] / 2 - 1); stroke(k, Math.max(0.6, 0.3 * s), P.edgeLine, null, -(W[k] / 2 - 1)); }
      }
      if (twin) { stroke('interstate', Math.max(0.7, 0.4 * s), P.lane, [Math.max(3, 8 * s), Math.max(4, 12 * s)], 9); stroke('interstate', Math.max(0.7, 0.4 * s), P.lane, [Math.max(3, 8 * s), Math.max(4, 12 * s)], -9); }
      else stroke('interstate', Math.max(0.8, 0.6 * s), P.lane, [6, 7]);
      if (s > 0.6) { stroke('township', Math.max(0.6, 1.2 * s), 'rgba(255,255,255,.08)'); stroke('street', Math.max(0.6, 0.35 * s), P.center, [Math.max(2, 5 * s), Math.max(2, 7 * s)]); }
    } else if (s > 0.08) {
      stroke('interstate', 1, P.lane, [6, 7]);
    }
  }

  labels(ctx, X, Y, s, w, h, P, showsOutside, inView) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const halo = (text, x, y, font, color, lw = 3) => { ctx.font = font; ctx.lineWidth = lw; ctx.strokeStyle = P.labelHalo; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y); };
    const along = (text, ax, ay, bx, by, off, font, color) => {
      let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      ctx.save(); ctx.translate(X((ax + bx) / 2), Y((ay + by) / 2)); ctx.rotate(ang); halo(text, 0, off, font, color, 2.6); ctx.restore();
    };
    // neighbouring counties & states
    if (showsOutside) {
      ctx.save(); if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
      for (const [name, x, y] of NEIGHBOR_COUNTIES) { if (!inView(x - 2000, y - 400, x + 2000, y + 400)) continue; ctx.font = `700 ${Math.max(10, Math.min(15, 9 + s * 60))}px system-ui, sans-serif`; ctx.fillStyle = P.neighborLabel; ctx.fillText(name, X(x), Y(y)); }
      ctx.restore();
      if (s < 0.11) { ctx.save(); if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '2px'; halo('WHITE COUNTY · JURISDICTION', X(5650), Y(-260), '800 11px system-ui, sans-serif', P.countyLine, 3); ctx.restore(); }
    }
    // street names in towns
    if (s > 0.42) {
      const font = `${Math.min(12, 9 + s * 2)}px system-ui, sans-serif`;
      for (const t of TOWNS) {
        if (X(t.x1) < 0 || X(t.x0) > w || Y(t.y1) < 0 || Y(t.y0) > h) continue;
        t.ns.forEach((name, i) => { for (let j = 0; j < t.ys.length - 1; j += s > 0.9 ? 1 : 2) { ctx.save(); ctx.translate(X(t.xs[i]), Y((t.ys[j] + t.ys[j + 1]) / 2)); ctx.rotate(-Math.PI / 2); halo(name, 0, -1, font, P.label, 2.4); ctx.restore(); } });
        t.ew.forEach((name, j) => { for (let i = 0; i < t.xs.length - 1; i += s > 0.9 ? 1 : 2) halo(name, X((t.xs[i] + t.xs[i + 1]) / 2), Y(t.ys[j]) - 1, font, P.label, 2.4); });
      }
    }
    // county road names (named roads at mid zoom; section-line roads once zoomed in)
    if (s > 0.09) {
      const font = 'italic 600 10px system-ui, sans-serif';
      for (const rd of ROADS) {
        if (rd.kind !== 'county' && !(rd.kind === 'township' && s > 0.2)) continue;
        const total = rd.cum[rd.cum.length - 1]; if (total < 300) continue;
        const step = rd.kind === 'township' ? Math.max(1600, 260 / s) : total;
        for (let d = Math.min(total / 2, step / 2); d < total; d += step) {
          let i = 1; while (i < rd.cum.length - 1 && rd.cum[i] < d) i++;
          const [ax, ay] = rd.pts[i - 1], [bx, by] = rd.pts[i]; if (!inView(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by))) continue;
          if (Math.hypot(bx - ax, by - ay) * s < 70) continue;
          along(rd.name.replace('County Road ', 'CR '), ax, ay, bx, by, -Math.max(7, 6 * s), font, P.roadLabel);
        }
      }
    }
    // highway shields
    const shielded = new Set();
    for (const rd of ROADS) {
      if (rd.kind === 'county' || rd.kind === 'township') continue;
      if (rd.outside && !showsOutside) continue;
      for (const name of rd.name.split(' / ')) {
        const key = `${name}:${rd.id}`; if (shielded.has(key)) continue; shielded.add(key);
        const m = Math.floor((rd.pts.length - 1) / 2); const [ax, ay] = rd.pts[m], [bx, by] = rd.pts[m + 1];
        const off = rd.name.includes(' / ') && name === 'IL-1' ? 26 : 0;
        const sx = X((ax + bx) / 2) + off, sy = Y((ay + by) / 2); if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
        this.shield(ctx, name, sx, sy);
      }
    }
    // river names
    for (const rv of showsOutside ? [...RIVERS, OUTER_RIVERS[2]] : RIVERS) { const m = Math.floor(rv.points.length * 0.3); const [ax, ay] = rv.points[m], [bx, by] = rv.points[m + 1]; along(rv.name, ax, ay, bx, by, -10, 'italic 600 12px system-ui, sans-serif', P.river); }
    halo('INDIANA', X(12350), Y(6000), '700 13px system-ui', P.neighborLabel, 2);
    // nearby towns outside the county
    if (showsOutside) for (const t of OUTER_TOWNS) {
      if (!inView(t.x - 600, t.y - 600, t.x + 600, t.y + 600)) continue;
      const sz = t.size >= 3 ? 13 : 11;
      halo(t.name.toUpperCase(), X(t.x), Y(t.y) - (t.size + 1) * 120 * s - 9, `800 ${sz}px system-ui, sans-serif`, P.townSmall, 3);
    }
    // White County towns
    for (const t of TOWNS) {
      const big = t.id === 'carmi'; const small = t.xs.length < 5;
      if (small && s < 0.035) continue;
      const sz = big ? Math.max(13, Math.min(22, 14 + s * 6)) : Math.max(small ? 9 : 10, Math.min(16, (small ? 9 : 10) + s * 5));
      if (s > 0.5 && big) continue;
      halo(t.name.toUpperCase(), X(t.x), Y(t.y0) - 10, `800 ${sz}px system-ui, sans-serif`, big ? P.town : P.townSmall, 3);
    }
    // smaller communities
    if (s > 0.05) for (const [name, x, y] of HAMLETS) {
      if (!inView(x - 300, y - 100, x + 300, y + 100)) continue;
      ctx.fillStyle = P.townSmall; ctx.beginPath(); ctx.arc(X(x), Y(y), 2.6, 0, 6.283); ctx.fill();
      halo(name, X(x), Y(y) - 10, '700 10px system-ui, sans-serif', P.townSmall, 2.6);
    }
    if (s > 0.6) {
      for (const p of city.pois) { if (p.kind === 'village') continue; ctx.fillStyle = P.label; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 2.5, 0, 6.283); ctx.fill(); halo(p.name, X(p.x), Y(p.y) + 10, '10px system-ui, sans-serif', P.label, 2.4); }
    }
  }

  shield(ctx, name, x, y) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (name.startsWith('I-')) {
      ctx.fillStyle = '#1d4ea8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 12, y - 10); ctx.lineTo(x + 12, y - 10); ctx.lineTo(x + 12, y + 2); ctx.quadraticCurveTo(x + 12, y + 10, x, y + 13); ctx.quadraticCurveTo(x - 12, y + 10, x - 12, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c4161c'; ctx.fillRect(x - 11, y - 9, 22, 5);
      ctx.fillStyle = '#fff'; ctx.font = '800 10px system-ui'; ctx.fillText(name.slice(2), x, y + 2.5);
    } else if (name.startsWith('US-')) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x - 11, y - 10); ctx.lineTo(x + 11, y - 10); ctx.lineTo(x + 11, y + 1); ctx.quadraticCurveTo(x + 10, y + 10, x, y + 12); ctx.quadraticCurveTo(x - 10, y + 10, x - 11, y + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = '800 10px system-ui'; ctx.fillText(name.slice(3), x, y);
    } else {
      const label = name.replace('IL-', ''); const wd = label.length > 2 ? 26 : 20;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2; ctx.fillRect(x - wd / 2, y - 9, wd, 18); ctx.strokeRect(x - wd / 2, y - 9, wd, 18);
      ctx.fillStyle = '#111'; ctx.font = '800 10px system-ui'; ctx.fillText(label, x, y + 0.5);
    }
    ctx.restore();
  }

  /** Draw dynamic layers: events, facilities, incidents, units. */
  drawDynamic(ctx, view, w, h, sim, opts = {}) {
    const s = view.scale; const ox = w / 2 - view.cx * s, oy = h / 2 - view.cy * s;
    const X = (x) => ox + x * s, Y = (y) => oy + y * s;
    const layers = opts.layers || { units: true, incidents: true, facilities: true, events: true, routes: true };
    const t = (this.time += 0.016);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // events
    if (layers.events && sim) for (const e of sim.state.events) {
      const st = EVENT_KINDS[e.kind];
      if (e.edges?.length) {
        ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = Math.max(3, 14 * s); ctx.setLineDash([6, 4]);
        for (const id of e.edges) { const ed = city.edges[id]; const a = city.nodes[ed.a], b2 = city.nodes[ed.b]; ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b2.x), Y(b2.y)); ctx.stroke(); }
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = `${st.color}22`; ctx.strokeStyle = `${st.color}88`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), e.radius * s, 0, 6.283); ctx.fill(); ctx.stroke();
      }
      if (opts.labels !== false) { ctx.font = '13px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText(st.icon, X(e.x), Y(e.y)); }
    }
    // active wireless call location estimate
    if (opts.call && opts.call.sc.ani.radius) {
      const a = opts.call.sc.ani; ctx.fillStyle = 'rgba(100,210,255,.12)'; ctx.strokeStyle = 'rgba(100,210,255,.7)'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), Math.max(8, a.radius * s), 0, 6.283); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
    // facilities
    if (layers.facilities) for (const f of city.facilities) {
      if (s < 0.13 && !['hospital', 'eoc', 'sheriff', 'fire', 'police_hq', 'precinct'].includes(f.kind)) continue;
      if (s < 0.06 && f.kind !== 'hospital' && f.kind !== 'eoc') continue;
      const [col, glyph] = FAC_STYLE[f.kind] || ['#888', '?']; const x = X(f.x), y = Y(f.y) - (s > 0.45 && SITE_KINDS.has(f.kind) ? Math.min(60, 34 * s) : 0);
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      const r = Math.max(5, Math.min(10, 14 * s));
      ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(ctx, x - r + 1.5, y - r + 2, r * 2, r * 2, 4); ctx.fill();
      ctx.fillStyle = '#0b1220'; ctx.strokeStyle = col; ctx.lineWidth = 1.8;
      roundRect(ctx, x - r, y - r, r * 2, r * 2, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `${col}22`; roundRect(ctx, x - r + 2, y - r + 2, r * 2 - 4, r - 2, 2); ctx.fill();
      if (r >= 7) { ctx.fillStyle = f.kind === 'hospital' ? '#ff5a4e' : col; ctx.font = `800 ${Math.round(r * (glyph.length > 2 ? 0.75 : 1.05))}px system-ui`; ctx.fillText(glyph, x, y + 0.5); }
      if (s > 0.42 && opts.labels !== false) { ctx.font = '10px system-ui'; ctx.fillStyle = 'rgba(220,230,245,.8)'; ctx.fillText(f.short, x, y + r + 8); }
    }
    if (!sim) return;
    // unit routes
    if (layers.routes) for (const u of sim.units.list) {
      if (!u.path || !(opts.allRoutes || u.id === opts.selectedUnit || (opts.incidentRoutes && u.incident === opts.selectedIncident))) continue;
      ctx.strokeStyle = `${DEPT_BY_ID[u.dept]?.color || '#fff'}aa`; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(X(u.x), Y(u.y));
      for (let i = u.path.i + 1; i < u.path.points.length; i++) ctx.lineTo(X(u.path.points[i][0]), Y(u.path.points[i][1]));
      ctx.stroke(); ctx.setLineDash([]);
    }
    // incidents
    if (layers.incidents) for (const inc of sim.incidents.list) {
      if (inc.status === 'closed') continue;
      const x = X(inc.location.x), y = Y(inc.location.y); const col = PRI_COLOR[inc.priority];
      const sel = inc.id === opts.selectedIncident;
      const pulse = inc.status === 'completed' ? 0 : (Math.sin(t * 4 + inc.created) + 1) / 2;
      ctx.fillStyle = `${col}${inc.status === 'completed' ? '22' : '33'}`;
      ctx.beginPath(); ctx.arc(x, y, 12 + pulse * 8 + (inc.severity === 'major' ? 6 : 0), 0, 6.283); ctx.fill();
      ctx.fillStyle = inc.status === 'completed' ? '#4a5568' : col; ctx.strokeStyle = sel ? '#fff' : '#0b1220'; ctx.lineWidth = sel ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 10, y + 7); ctx.lineTo(x - 10, y + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0b1220'; ctx.font = '800 10px system-ui'; ctx.fillText('!', x, y + 2);
      if ((s > 0.22 || sel) && opts.labels !== false) {
        ctx.font = '700 11px ui-monospace, monospace'; const label = inc.number; const tw = ctx.measureText(label).width + 8;
        ctx.fillStyle = 'rgba(8,12,20,.85)'; roundRect(ctx, x - tw / 2, y + 10, tw, 15, 3); ctx.fill();
        ctx.fillStyle = col; ctx.fillText(label, x, y + 18);
      }
    }
    // units
    if (layers.units) for (const u of sim.units.list) {
      if (u.status === 'available' && !opts.showIdle && s < 0.35 && u.id !== opts.selectedUnit) continue;
      const x = X(u.x), y = Y(u.y); if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      const dept = DEPT_BY_ID[u.dept]; const ty = TYPE_BY_ID[u.type];
      const r = u.id === opts.selectedUnit ? 9 : 7;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(x + 1.2, y + 1.8, r + 1, 0, 6.283); ctx.fill();
      ctx.fillStyle = dept?.color || '#ccc'; ctx.strokeStyle = UNIT_STATUS_COLORS[u.status] || '#fff'; ctx.lineWidth = 2.2;
      if (ty.air) { ctx.beginPath(); ctx.moveTo(x, y - r - 2); ctx.lineTo(x + r + 2, y); ctx.lineTo(x, y + r + 2); ctx.lineTo(x - r - 2, y); ctx.closePath(); }
      else { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); }
      ctx.fill(); ctx.stroke();
      if (u.id === opts.selectedUnit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 6.283); ctx.stroke(); }
      if (s > 0.3 || u.id === opts.selectedUnit) {
        ctx.fillStyle = '#081018'; ctx.font = `800 ${ty.glyph.length > 2 ? 6 : 7.5}px system-ui`; ctx.fillText(ty.glyph, x, y + 0.5);
      }
      if ((s > 0.62 || u.id === opts.selectedUnit) && opts.labels !== false) {
        ctx.font = '700 10px ui-monospace, monospace'; ctx.fillStyle = 'rgba(8,12,20,.8)'; const tw = ctx.measureText(u.callsign).width + 6;
        roundRect(ctx, x - tw / 2, y - r - 16, tw, 13, 3); ctx.fill(); ctx.fillStyle = dept?.color || '#fff'; ctx.fillText(u.callsign, x, y - r - 9.5);
        if (opts.etaLabels && u.status === 'responding' && u.eta) { ctx.fillStyle = '#ffd54a'; ctx.fillText(`${Math.max(1, Math.round(u.eta * (sim.state.time.clockRate || 6) / 60))}m`, x, y + r + 9); }
      }
    }
  }

  /** Screen → world hit test. */
  hit(view, w, h, px, py, sim) {
    const s = view.scale; const wx = (px - w / 2) / s + view.cx, wy = (py - h / 2) / s + view.cy;
    const R = (pxRadius) => pxRadius / s;
    let best = null, bd = Infinity;
    const consider = (kind, obj, x, y, rad) => { const d = Math.hypot(wx - x, wy - y); if (d < R(rad) && d < bd) { bd = d; best = { kind, obj }; } };
    if (sim) {
      for (const inc of sim.incidents.list) if (inc.status !== 'closed') consider('incident', inc, inc.location.x, inc.location.y, 16);
      for (const u of sim.units.list) consider('unit', u, u.x, u.y, 11);
    }
    if (!best) for (const f of city.facilities) consider('facility', f, f.x, f.y, Math.max(12, (SITE_KINDS.has(f.kind) ? 34 : 12) * s));
    return best || { kind: 'point', x: wx, y: wy };
  }
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

export { DISTRICTS };
