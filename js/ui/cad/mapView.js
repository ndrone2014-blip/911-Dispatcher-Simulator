// Local, no-key city map renderer (Canvas 2D). Used by the CAD map screen and the
// 3D monitor/video-wall textures.
import { city, B, N, NS_STREETS, EW_STREETS, RIVER, BAY, HIGHWAYS, MAP_BOUNDS, DISTRICTS } from '../../data/city.js';
import { DEPT_BY_ID, TYPE_BY_ID } from '../../data/departments.js';
import { UNIT_STATUS_COLORS } from '../../data/incidentTypes.js';
import { EVENT_KINDS } from '../../sim/cityEvents.js';

const ZONE_FILL = { residential: '#13202f', commercial: '#18233a', downtown: '#1b2741', industrial: '#1d272b', park: '#10301f', forest: '#0d2918', institutional: '#1b2240', airport: '#182130', water: null };
const PRI_COLOR = { 1: '#ff4d4d', 2: '#ff9f43', 3: '#f2c94c', 4: '#6fa8dc' };
const FAC_STYLE = {
  police_hq: ['#4f8cff', 'PD'], precinct: ['#4f8cff', 'P'], sheriff: ['#d9a441', '★'], federal: ['#9aa5b1', 'F'], eoc: ['#b47cff', 'EOC'],
  fire: ['#ff5a4e', 'F'], fire_hq: ['#ff5a4e', 'FA'], ems: ['#2fd08a', '+'], hospital: ['#ffffff', 'H'], hospital_helipad: ['#ffffff', 'Ⓗ'],
  airport: ['#8b9bb4', '✈'], marina: ['#4fc3f7', '⚓'], coastguard: ['#ff7a59', 'CG'], sar: ['#ff9f43', 'SR'], public_works: ['#f2c94c', 'PW'],
  animal_control: ['#a3d977', 'AC'], dot: ['#ffb84d', 'DT'], utility: ['#7fd1d9', 'U'],
};
const DISTRICT_CENTERS = (() => {
  const acc = {};
  for (const b of city.blocks) { if (b.district === 'Halston River') continue; const a = acc[b.district] ||= { x: 0, y: 0, n: 0 }; a.x += (b.bx + 0.5) * B; a.y += (b.by + 0.5) * B; a.n++; }
  return Object.entries(acc).map(([name, a]) => ({ name, x: a.x / a.n, y: a.y / a.n }));
})();

export class MapRenderer {
  constructor() { this.time = 0; }

  fit(w, h) {
    const mw = MAP_BOUNDS.x1 - MAP_BOUNDS.x0, mh = MAP_BOUNDS.y1 - MAP_BOUNDS.y0;
    const scale = Math.min(w / mw, h / mh) * 0.98;
    return { cx: (MAP_BOUNDS.x0 + MAP_BOUNDS.x1) / 2, cy: (MAP_BOUNDS.y0 + MAP_BOUNDS.y1) / 2 - B * 0.2, scale };
  }

  /** Draw static city layers. */
  drawBase(ctx, view, w, h, { labels = true, buildings = true, detail = 1 } = {}) {
    const s = view.scale; const ox = w / 2 - view.cx * s, oy = h / 2 - view.cy * s;
    const X = (x) => ox + x * s, Y = (y) => oy + y * s;
    ctx.fillStyle = '#0b1320'; ctx.fillRect(0, 0, w, h);
    // land
    ctx.fillStyle = '#0f1826'; ctx.fillRect(X(-1.1 * B), Y(-1.1 * B), 16.2 * B * s, (BAY.y0 + 1.1 * B) * s);
    // water
    ctx.fillStyle = '#0c2a46';
    ctx.fillRect(X(RIVER.x0), Y(-1.2 * B), (RIVER.x1 - RIVER.x0) * s, (BAY.y0 + 1.2 * B) * s);
    ctx.fillRect(X(-1.2 * B), Y(BAY.y0), 16.6 * B * s, 2 * B * s);
    // blocks
    for (const b of city.blocks) {
      const fill = ZONE_FILL[b.zone]; if (!fill) continue;
      const x = X(b.bx * B + 10), y = Y(b.by * B + 10), sz = (B - 20) * s;
      if (x > w || y > h || x + sz < 0 || y + sz < 0) continue;
      ctx.fillStyle = fill; ctx.fillRect(x, y, sz, sz);
      if (buildings && s > 0.12 && detail > 0) {
        for (const [bx, by, bw, bh, shade] of b.buildings) {
          const l = Math.round(30 + shade * 40);
          ctx.fillStyle = b.zone === 'industrial' ? `rgb(${l},${l + 6},${l + 4})` : `rgb(${l - 6},${l + 4},${l + 22})`;
          ctx.fillRect(X(bx), Y(by), Math.max(1, bw * s), Math.max(1, bh * s));
        }
      }
      if ((b.zone === 'park' || b.zone === 'forest') && s > 0.1 && detail > 0) {
        ctx.fillStyle = b.zone === 'forest' ? '#14402a' : '#185a35';
        for (let i = 0; i < 9; i++) { const tx = X(b.bx * B + 30 + ((i * 53) % 160)), ty = Y(b.by * B + 30 + ((i * 97) % 160)); ctx.beginPath(); ctx.arc(tx, ty, Math.max(1.5, 9 * s), 0, 6.283); ctx.fill(); }
      }
    }
    // streets
    const sw = Math.max(1, 12 * s);
    for (const e of city.edges) {
      if (e.kind === 'highway' || e.kind === 'ramp') continue;
      const a = city.nodes[e.a], b2 = city.nodes[e.b];
      ctx.strokeStyle = e.kind === 'bridge' ? '#53627a' : e.speed > 1.05 ? '#3a4f72' : '#283a56';
      ctx.lineWidth = e.speed > 1.05 ? sw * 1.4 : sw;
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b2.x), Y(b2.y)); ctx.stroke();
    }
    // highways
    ctx.lineCap = 'round';
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? '#c98b2b' : '#3b2a10'; ctx.lineWidth = Math.max(2, (pass ? 14 : 22) * s);
      ctx.beginPath(); ctx.moveTo(X(HIGHWAYS.i47.x), Y(HIGHWAYS.i47.y0)); ctx.lineTo(X(HIGHWAYS.i47.x), Y(HIGHWAYS.i47.y1));
      ctx.moveTo(X(HIGHWAYS.rt9.x0), Y(HIGHWAYS.rt9.y)); ctx.lineTo(X(HIGHWAYS.rt9.x1), Y(HIGHWAYS.rt9.y)); ctx.stroke();
    }
    ctx.strokeStyle = '#8a6420'; ctx.lineWidth = Math.max(1, 6 * s);
    for (const e of city.edges) if (e.kind === 'ramp') { const a = city.nodes[e.a], b2 = city.nodes[e.b]; ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b2.x), Y(b2.y)); ctx.stroke(); }
    ctx.lineCap = 'butt';
    if (!labels) return;
    // labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (s > 0.28) {
      ctx.font = `${Math.min(13, 10 + s * 3)}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(160,180,210,.75)';
      for (let c = 0; c < N; c++) { const x = X(c * B); for (let r = 1; r < N; r += s > 0.6 ? 2 : 4) { ctx.save(); ctx.translate(x, Y((r - 0.5) * B)); ctx.rotate(-Math.PI / 2); ctx.fillText(NS_STREETS[c], 0, 0); ctx.restore(); } }
      for (let r = 0; r < N; r++) { const y = Y(r * B); for (let c = 1; c < N; c += s > 0.6 ? 2 : 4) ctx.fillText(EW_STREETS[r], X((c - 0.5) * B), y); }
    }
    if (s > 0.1 && s < 0.7) {
      ctx.font = `700 ${Math.round(11 + s * 10)}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(120,150,190,.42)';
      for (const d of DISTRICT_CENTERS) ctx.fillText(d.name.toUpperCase(), X(d.x), Y(d.y));
    }
    ctx.font = `italic ${Math.max(10, Math.min(15, 12 * s + 6))}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(100,170,230,.7)';
    ctx.save(); ctx.translate(X((RIVER.x0 + RIVER.x1) / 2), Y(4 * B)); ctx.rotate(-Math.PI / 2); ctx.fillText(RIVER.name, 0, 0); ctx.restore();
    ctx.fillText(BAY.name, X(7 * B), Y(BAY.y0 + B * 0.6));
    ctx.fillStyle = '#e8b45a'; ctx.font = `700 ${Math.max(9, 11 * Math.min(1.4, s * 2))}px system-ui, sans-serif`;
    ctx.fillText('I-47', X(HIGHWAYS.i47.x) + 16, Y(-0.4 * B)); ctx.fillText('RT 9', X(-0.4 * B), Y(HIGHWAYS.rt9.y) - 12);
    if (s > 0.55) {
      ctx.font = '10px system-ui, sans-serif'; ctx.fillStyle = 'rgba(200,210,230,.65)';
      for (const p of city.pois) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 2.5, 0, 6.283); ctx.fill(); ctx.fillText(p.name, X(p.x), Y(p.y) + 10); }
    }
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
      const [col, glyph] = FAC_STYLE[f.kind] || ['#888', '?']; const x = X(f.x), y = Y(f.y);
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      const r = Math.max(5, Math.min(10, 14 * s));
      ctx.fillStyle = '#0b1220'; ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      roundRect(ctx, x - r, y - r, r * 2, r * 2, 3); ctx.fill(); ctx.stroke();
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
    if (!best) for (const f of city.facilities) consider('facility', f, f.x, f.y, 12);
    return best || { kind: 'point', x: wx, y: wy };
  }
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

export { DISTRICTS };
