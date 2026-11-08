// Local, no-key city map renderer (Canvas 2D). Used by the CAD map screen and the
// 3D monitor/video-wall textures.
import { city, TOWNS, RIVERS, ROADS, COUNTY_LINE, MAP_BOUNDS, DISTRICTS } from '../../data/city.js';
import { DEPT_BY_ID, TYPE_BY_ID } from '../../data/departments.js';
import { UNIT_STATUS_COLORS } from '../../data/incidentTypes.js';
import { EVENT_KINDS } from '../../sim/cityEvents.js';
import { SCALE } from '../../data/city.js';
import { drawGround, drawRail, drawSettlement, drawBridges, drawOverlays, drawSites, SITE_KINDS } from './mapDetail.js';

const ZONE_FILL = { residential: '#13202f', commercial: '#18233a', downtown: '#1b2741', industrial: '#1d272b', park: '#10301f', forest: '#0d2918', institutional: '#1b2240', airport: '#182130', water: null };
const PRI_COLOR = { 1: '#ff4d4d', 2: '#ff9f43', 3: '#f2c94c', 4: '#6fa8dc' };
const FAC_STYLE = {
  police_hq: ['#4f8cff', 'PD'], precinct: ['#4f8cff', 'P'], sheriff: ['#d9a441', '★'], federal: ['#9aa5b1', 'F'], eoc: ['#b47cff', 'EOC'],
  fire: ['#ff5a4e', 'F'], fire_hq: ['#ff5a4e', 'FA'], ems: ['#2fd08a', '+'], hospital: ['#ffffff', 'H'], hospital_helipad: ['#ffffff', 'Ⓗ'],
  airport: ['#8b9bb4', '✈'], marina: ['#4fc3f7', '⚓'], coastguard: ['#ff7a59', 'CG'], sar: ['#ff9f43', 'SR'], public_works: ['#f2c94c', 'PW'],
  animal_control: ['#a3d977', 'AC'], dot: ['#ffb84d', 'DT'], utility: ['#7fd1d9', 'U'],
};
export class MapRenderer {
  constructor() { this.time = 0; }

  fit(w, h) {
    const mw = MAP_BOUNDS.x1 - MAP_BOUNDS.x0, mh = MAP_BOUNDS.y1 - MAP_BOUNDS.y0;
    const scale = Math.min(w / mw, h / mh) * 0.98;
    return { cx: (MAP_BOUNDS.x0 + MAP_BOUNDS.x1) / 2, cy: (MAP_BOUNDS.y0 + MAP_BOUNDS.y1) / 2, scale };
  }

  focusTown(id, w, h) {
    const t = TOWNS.find((x) => x.id === id) || TOWNS[0];
    const span = Math.max(t.x1 - t.x0, t.y1 - t.y0) * 1.9;
    return { cx: t.x, cy: t.y, scale: Math.min(w, h) / span };
  }

  /** Draw static county layers. */
  drawBase(ctx, view, w, h, { labels = true, buildings = true, detail = 1 } = {}) {
    const s = view.scale; const ox = w / 2 - view.cx * s, oy = h / 2 - view.cy * s;
    const X = (x) => ox + x * s, Y = (y) => oy + y * s;
    const path = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); };
    ctx.fillStyle = '#0c120f'; ctx.fillRect(0, 0, w, h);
    // Indiana (east of the Wabash)
    ctx.fillStyle = '#0e1412'; ctx.fillRect(X(11300), Y(-600), 1400 * s, 11800 * s);
    // county farmland with field patchwork
    ctx.save(); path(COUNTY_LINE); ctx.closePath(); ctx.fillStyle = '#141d16'; ctx.fill(); ctx.clip();
    if (detail > 0) drawGround(ctx, X, Y, s, w, h);
    else if (detail > 0 && s > 0.02) {
      const F = 640;
      for (let fx = 0; fx < 11600; fx += F) for (let fy = 0; fy < 10600; fy += F) {
        const k = ((fx * 7 + fy * 13) / F) % 5;
        ctx.fillStyle = ['#152018', '#18221a', '#1c2318', '#161f19', '#1e2519'][Math.floor(k)];
        ctx.fillRect(X(fx + 8), Y(fy + 8), (F - 16) * s, (F - 16) * s);
        if (s > 0.12 && detail > 0) { ctx.fillStyle = 'rgba(255,255,255,.018)'; const rows = Math.floor(k) % 2; for (let r = 30; r < F - 30; r += 60) rows ? ctx.fillRect(X(fx + r), Y(fy + 12), 2, (F - 24) * s) : ctx.fillRect(X(fx + 12), Y(fy + r), (F - 24) * s, 2); }
      }
    }
    ctx.restore();
    // woods in the river bottoms
    ctx.fillStyle = '#0f2a18';
    for (const [x, y, r] of city.woods) { const px = X(x), py = Y(y); if (px < -50 || py < -50 || px > w + 50 || py > h + 50) continue; ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, r * s), 0, 6.283); ctx.fill(); }
    // rivers
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const rv of RIVERS) {
      const wd = Math.max(rv.width > 80 ? 3 : 1.6, rv.width * s);
      if (detail > 0) { path(rv.points); ctx.strokeStyle = 'rgba(30,70,60,.55)'; ctx.lineWidth = wd + Math.max(3, 60 * s); ctx.stroke(); }
      path(rv.points); ctx.strokeStyle = '#1b4a72'; ctx.lineWidth = wd; ctx.stroke();
      if (detail > 0 && wd > 3) { path(rv.points); ctx.strokeStyle = 'rgba(120,180,230,.18)'; ctx.lineWidth = wd * 0.35; ctx.stroke(); }
    }
    if (detail > 0) drawRail(ctx, X, Y, s);
    // county line
    path(COUNTY_LINE); ctx.closePath(); ctx.setLineDash([10, 6]); ctx.strokeStyle = 'rgba(160,175,140,.45)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
    // town blocks & buildings
    const ZF = { residential: '#1a2333', commercial: '#1e2740', downtown: '#222c48', industrial: '#22292b', park: '#133a22', institutional: '#1d2342' };
    for (const b of city.blocks) {
      const x = X(b.x0 + 5), y = Y(b.y0 + 5), bw = (b.x1 - b.x0 - 10) * s, bh = (b.y1 - b.y0 - 10) * s;
      if (x > w || y > h || x + bw < 0 || y + bh < 0) continue;
      ctx.fillStyle = ZF[b.zone] || '#1a2333'; ctx.fillRect(x, y, Math.max(1, bw), Math.max(1, bh));
      if (detail > 0 && s > 0.25) { ctx.strokeStyle = 'rgba(150,170,200,.12)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, bw - 1), Math.max(1, bh - 1)); }
      if (buildings && s > 0.14 && detail > 0) for (const [bx, by, bw2, bh2, shade] of b.buildings) {
        const l = Math.round(32 + shade * 40); const px = X(bx), py = Y(by), pw = Math.max(1, bw2 * s), ph = Math.max(1, bh2 * s);
        if (pw > 3) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(px + 1.5, py + 1.5, pw, ph); }
        ctx.fillStyle = b.zone === 'industrial' ? `rgb(${l},${l + 4},${l + 2})` : `rgb(${l - 6},${l + 4},${l + 22})`;
        ctx.fillRect(px, py, pw, ph);
        if (pw > 6) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(px, py, pw, Math.max(1, ph * 0.3)); }
      }
    }
    // farmsteads & oil wells
    if (detail > 0) { drawSettlement(ctx, X, Y, s, w, h); drawSites(ctx, X, Y, s, w, h); }
    if (s > 0.07 && detail > 0) {
      if (false) for (const f of city.farms) { const px = X(f.x), py = Y(f.y); if (px < -10 || py < -10 || px > w + 10 || py > h + 10) continue; ctx.fillStyle = '#5d6b7d'; const z = Math.max(2, 14 * s); ctx.fillRect(px - z / 2, py - z / 2, z, z); if (f.barn) { ctx.fillStyle = '#7a2f25'; ctx.fillRect(px + z * 0.8, py - z * 0.6, z * 1.3, z * 1.1); } }
      ctx.fillStyle = '#c9a227';
      for (const wl of city.wells) { const px = X(wl.x), py = Y(wl.y); const z = Math.max(2.5, 10 * s); ctx.beginPath(); ctx.moveTo(px, py - z); ctx.lineTo(px + z * 0.8, py + z * 0.6); ctx.lineTo(px - z * 0.8, py + z * 0.6); ctx.closePath(); ctx.fill(); }
    }
    // roads (low priority first)
    const style = { street: ['#2b3a55', 9, 1], county: ['#5a5440', 9, 1.2], state: ['#9a8540', 13, 1.6], us: ['#b8963c', 15, 2], interstate: ['#d08a2a', 20, 2.6] };
    for (const kind of ['street', 'county', 'state', 'us', 'interstate']) {
      const [col, wd, min] = style[kind];
      if (kind === 'interstate' || (detail > 0 && kind !== 'street')) {
        ctx.strokeStyle = kind === 'interstate' ? '#3b2a10' : 'rgba(8,10,12,.75)'; ctx.lineWidth = Math.max(min + (kind === 'interstate' ? 2.5 : 1.6), wd * (kind === 'interstate' ? 1.6 : 1.45) * s);
        ctx.beginPath(); for (const e of city.edges) if (e.kind === kind) { const A = city.nodes[e.a], Bn = city.nodes[e.b]; ctx.moveTo(X(A.x), Y(A.y)); ctx.lineTo(X(Bn.x), Y(Bn.y)); } ctx.stroke();
      }
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(min, wd * s);
      ctx.beginPath();
      for (const e of city.edges) {
        if (e.kind !== kind) continue;
        const A = city.nodes[e.a], Bn = city.nodes[e.b];
        if (kind === 'street' && e.alias) continue;
        ctx.moveTo(X(A.x), Y(A.y)); ctx.lineTo(X(Bn.x), Y(Bn.y));
      }
      ctx.stroke();
      if (detail > 0 && s > 0.3 && (kind === 'interstate' || kind === 'us' || kind === 'state')) {
        ctx.strokeStyle = kind === 'interstate' ? 'rgba(255,240,200,.55)' : 'rgba(255,240,200,.35)'; ctx.lineWidth = 1; ctx.setLineDash([6, 7]); ctx.beginPath();
        for (const e of city.edges) if (e.kind === kind) { const A = city.nodes[e.a], Bn = city.nodes[e.b]; ctx.moveTo(X(A.x), Y(A.y)); ctx.lineTo(X(Bn.x), Y(Bn.y)); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      if (kind === 'street') { ctx.strokeStyle = '#9a8540'; ctx.lineWidth = Math.max(1.6, 11 * s); ctx.beginPath(); for (const e of city.edges) if (e.alias) { const A = city.nodes[e.a], Bn = city.nodes[e.b]; ctx.moveTo(X(A.x), Y(A.y)); ctx.lineTo(X(Bn.x), Y(Bn.y)); } ctx.stroke(); }
    }
    ctx.lineCap = 'butt';
    if (detail > 0) drawBridges(ctx, X, Y, s, w, h);
    if (!labels) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // street names in towns
    if (s > 0.42) {
      ctx.font = `${Math.min(12, 9 + s * 2)}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(170,190,215,.78)';
      for (const t of TOWNS) {
        if (X(t.x1) < 0 || X(t.x0) > w || Y(t.y1) < 0 || Y(t.y0) > h) continue;
        t.ns.forEach((name, i) => { for (let j = 0; j < t.ys.length - 1; j += s > 0.9 ? 1 : 2) { ctx.save(); ctx.translate(X(t.xs[i]), Y((t.ys[j] + t.ys[j + 1]) / 2)); ctx.rotate(-Math.PI / 2); ctx.fillText(name, 0, -1); ctx.restore(); } });
        t.ew.forEach((name, j) => { for (let i = 0; i < t.xs.length - 1; i += s > 0.9 ? 1 : 2) ctx.fillText(name, X((t.xs[i] + t.xs[i + 1]) / 2), Y(t.ys[j]) - 1); });
      }
    }
    // county road names
    if (s > 0.09) {
      ctx.font = 'italic 10px system-ui, sans-serif'; ctx.fillStyle = 'rgba(200,190,150,.7)';
      for (const rd of ROADS) if (rd.kind === 'county' && rd.pts.length > 1) {
        const m = Math.floor((rd.pts.length - 1) / 2); const [ax, ay] = rd.pts[m], [bx, by] = rd.pts[m + 1];
        let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
        ctx.save(); ctx.translate(X((ax + bx) / 2), Y((ay + by) / 2)); ctx.rotate(ang); ctx.fillText(rd.name, 0, -7); ctx.restore();
      }
    }
    // highway shields
    const shielded = new Set();
    for (const rd of ROADS) {
      if (rd.kind === 'county') continue;
      for (const name of rd.name.split(' / ')) {
        const key = `${name}:${rd.id}`; if (shielded.has(key)) continue; shielded.add(key);
        const m = Math.floor((rd.pts.length - 1) / 2); const [ax, ay] = rd.pts[m], [bx, by] = rd.pts[m + 1];
        const off = rd.name.includes(' / ') && name === 'IL-1' ? 26 : 0;
        this.shield(ctx, name, X((ax + bx) / 2) + off, Y((ay + by) / 2));
      }
    }
    // river names
    ctx.font = 'italic 12px system-ui, sans-serif'; ctx.fillStyle = 'rgba(110,170,225,.8)';
    for (const rv of RIVERS) { const m = Math.floor(rv.points.length * 0.3); const [ax, ay] = rv.points[m], [bx, by] = rv.points[m + 1]; let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI; ctx.save(); ctx.translate(X((ax + bx) / 2), Y((ay + by) / 2)); ctx.rotate(ang); ctx.fillText(rv.name, 0, -10); ctx.restore(); }
    ctx.fillStyle = 'rgba(140,150,140,.5)'; ctx.font = '700 13px system-ui'; ctx.fillText('INDIANA', X(11950), Y(6000));
    // town names
    for (const t of TOWNS) {
      const big = t.id === 'carmi'; const sz = big ? Math.max(13, Math.min(22, 14 + s * 6)) : Math.max(10, Math.min(16, 10 + s * 5));
      if (s > 0.5 && big) continue;
      ctx.font = `800 ${sz}px system-ui, sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,12,18,.85)';
      const ty = Y(t.y0) - 10; ctx.strokeText(t.name.toUpperCase(), X(t.x), ty); ctx.fillStyle = big ? '#f2f5fa' : '#c9d3e2'; ctx.fillText(t.name.toUpperCase(), X(t.x), ty);
    }
    if (s > 0.6) {
      ctx.font = '10px system-ui, sans-serif'; ctx.fillStyle = 'rgba(210,220,235,.7)';
      for (const p of city.pois) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 2.5, 0, 6.283); ctx.fill(); ctx.fillText(p.name, X(p.x), Y(p.y) + 10); }
    }
    if (detail > 0) drawOverlays(ctx, X, Y, s, w, h, SCALE);
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
