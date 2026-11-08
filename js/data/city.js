// White County, Illinois — county road network centered on Carmi (county seat).
// Distances are compressed ~3.2x so drives take realistic game-minutes. Highway
// routes follow the real corridors (I-64, US-45, IL-1, IL-14, IL-141); town street
// grids use real Carmi street names, arranged approximately.
import { RNG, dist, clamp } from '../core/util.js';

export const CITY_NAME = 'Carmi';
export const COUNTY_NAME = 'White County';
export const STATE_NAME = 'Illinois';
export const SCALE = 3.2; // real meters per game meter
export const B = 115; // Carmi block size (kept for compatibility)
export const MAP_BOUNDS = { x0: -500, y0: -500, x1: 12450, y1: 11000 };
export const COUNTY_LINE = [[0, 0], [11320, 0], [11500, 1600], [11350, 3200], [11550, 4800], [11400, 6400], [11650, 8000], [11500, 9400], [11300, 10500], [0, 10500]];

export const RIVERS = [
  { name: 'Wabash River', width: 110, points: [[11320, -500], [11320, 0], [11500, 1600], [11350, 3200], [11550, 4800], [11400, 6400], [11650, 8000], [11500, 9400], [11300, 10500], [11200, 11000]] },
  { name: 'Little Wabash River', width: 46, points: [[3600, -500], [3700, 0], [4300, 1800], [5200, 3600], [6300, 4900], [6580, 5600], [6620, 6300], [6750, 7000], [7400, 8200], [8600, 9400], [9800, 10300], [11300, 10500]] },
  { name: 'Skillet Fork', width: 26, points: [[-500, 3550], [0, 3600], [1500, 3900], [3200, 4300], [4800, 4700], [6300, 4900]] },
];

// ---------------- Towns ----------------
export const TOWNS = [
  { id: 'carmi', name: 'Carmi', x: 6000, y: 6200, block: 115, blockY: 110, mainNS: 5, mainEW: 4, weight: 0.58,
    ns: ['Robinson St', 'Fair St', 'Oak St', 'Walnut St', 'Church St', 'Main Cross St', 'Jessup St', 'Slocumb St', 'Kerney St', 'Locust St'],
    ew: ['College Blvd', 'Maple St', 'Sycamore St', 'Smith St', 'Main St', 'Stewart St', 'Rice St', 'Fourth St', 'Tenth St'] },
  { id: 'norris', name: 'Norris City', x: 2600, y: 9300, block: 95, blockY: 95, mainNS: 2, mainEW: 2, weight: 0.08,
    ns: ['Division St', 'Mill St', 'Main St', 'Elm St', 'East St'], ew: ['Cherry St', 'Locust St', 'Market St', 'Walnut St', 'South St'] },
  { id: 'grayville', name: 'Grayville', x: 10800, y: 1200, block: 95, blockY: 95, mainNS: 2, mainEW: 2, weight: 0.08,
    ns: ['West St', 'Oak St', 'Court St', 'Main St', 'Water St'], ew: ['North St', 'Mill St', 'Middle St', 'Commerce St', 'South St'] },
  { id: 'crossville', name: 'Crossville', x: 9000, y: 4700, block: 95, blockY: 95, mainNS: 2, mainEW: 2, weight: 0.06,
    ns: ['West St', 'Elm St', 'Cross St', 'Pine St', 'East St'], ew: ['North St', 'Third St', 'Main St', 'Second St', 'South St'] },
  { id: 'enfield', name: 'Enfield', x: 2200, y: 5600, block: 95, blockY: 95, mainNS: 2, mainEW: 2, weight: 0.06,
    ns: ['West St', 'Ash St', 'Main St', 'Oak St', 'East St'], ew: ['North St', 'Maple St', 'Market St', 'Church St', 'South St'] },
  { id: 'millshoals', name: 'Mill Shoals', x: 1800, y: 1300, block: 95, blockY: 95, mainNS: 2, mainEW: 2, weight: 0.03,
    ns: ['West St', 'Spring St', 'Main St', 'Elm St', 'East St'], ew: ['North St', 'Oak St', 'Center St', 'School St', 'South St'] },
  { id: 'burntprairie', name: 'Burnt Prairie', x: 3900, y: 2050, block: 95, blockY: 95, mainNS: 2, mainEW: 2, weight: 0.03,
    ns: ['West St', 'Pine St', 'Prairie St', 'Elm St', 'East St'], ew: ['North St', 'Walnut St', 'Main St', 'Church St', 'South St'] },
  { id: 'springerton', name: 'Springerton', x: 2900, y: 3300, block: 90, blockY: 90, mainNS: 1, mainEW: 1, weight: 0.02, ns: ['West St', 'Main St', 'East St'], ew: ['North St', 'Center St', 'South St'] },
  { id: 'phillipstown', name: 'Phillipstown', x: 10600, y: 3200, block: 90, blockY: 90, mainNS: 1, mainEW: 1, weight: 0.02, ns: ['West St', 'Main St', 'Bluff St'], ew: ['North St', 'Center St', 'South St'] },
  { id: 'herald', name: 'Herald', x: 5600, y: 9500, block: 90, blockY: 90, mainNS: 1, mainEW: 1, weight: 0.015, ns: ['West St', 'Main St', 'East St'], ew: ['North St', 'Center St', 'South St'] },
  { id: 'emma', name: 'Emma', x: 8800, y: 8700, block: 90, blockY: 90, mainNS: 1, mainEW: 1, weight: 0.02, ns: ['West St', 'Main St', 'East St'], ew: ['North St', 'Center St', 'South St'] },
  { id: 'maunie', name: 'Maunie', x: 10900, y: 8500, block: 90, blockY: 90, mainNS: 1, mainEW: 1, weight: 0.02, ns: ['West St', 'Main St', 'River St'], ew: ['North St', 'Center St', 'South St'] },
];
export const TOWN_BY_ID = Object.fromEntries(TOWNS.map((t) => [t.id, t]));
for (const t of TOWNS) {
  t.xs = t.ns.map((_, i) => t.x + (i - t.mainNS) * t.block);
  t.ys = t.ew.map((_, j) => t.y + (j - t.mainEW) * t.blockY);
  t.x0 = t.xs[0]; t.x1 = t.xs[t.xs.length - 1]; t.y0 = t.ys[0]; t.y1 = t.ys[t.ys.length - 1];
}
export const RURAL = 'Rural White County';
export const DISTRICTS = [...TOWNS.map((t) => t.name), RURAL];

// Named non-grid roads. kind: interstate | us | state | county
const ROAD_DEFS = [
  { name: 'I-64', kind: 'interstate', pts: [[-400, 2380], [2000, 2370], [4500, 2350], [7600, 2150], [10500, 1750], [11500, 1620], [12400, 1550]] },
  { name: 'US-45', kind: 'us', pts: [[1700, -400], [1800, 1110]] },
  { name: 'US-45', kind: 'us', pts: [[1800, 1490], [1950, 3000], [2050, 4400], [2200, 5410]] },
  { name: 'US-45', kind: 'us', pts: [[2200, 5790], [2200, 5900], [2400, 7500], [2600, 9110]] },
  { name: 'US-45', kind: 'us', pts: [[2600, 9490], [2700, 10900]] },
  { name: 'IL-14', kind: 'state', pts: [[-400, 5900], [1200, 5850], [2200, 5900], [3500, 6000], [4800, 6150], [5425, 6200]] },
  { name: 'IL-14 / IL-1', kind: 'state', pts: [[6460, 6200], [6700, 6150], [7600, 5700], [8400, 5150], [8810, 4890]] },
  { name: 'IL-14', kind: 'state', pts: [[9190, 4700], [10200, 4750], [11450, 4800]] },
  { name: 'IL-1', kind: 'state', pts: [[9000, 4510], [9500, 3700], [9900, 2900], [10350, 2100], [10500, 1750], [10800, 1390]] },
  { name: 'IL-1', kind: 'state', pts: [[10800, 1010], [10950, -400]] },
  { name: 'IL-1', kind: 'state', pts: [[5655, 6640], [5500, 7200], [4500, 8000], [3400, 8800], [2790, 9110]] },
  { name: 'IL-1', kind: 'state', pts: [[2410, 9490], [2200, 10000], [2000, 10900]] },
  { name: 'IL-141', kind: 'state', pts: [[2790, 9490], [3300, 10100], [3700, 10900]] },
  { name: 'County Road 20', kind: 'county', pts: [[1990, 1300], [2800, 1700], [3710, 2050]] },
  { name: 'County Road 20', kind: 'county', pts: [[4090, 2050], [4500, 2350]] },
  { name: 'Burnt Prairie Rd', kind: 'county', pts: [[6000, 5760], [5700, 4500], [4900, 3200], [3900, 2240]] },
  { name: 'Springerton Rd', kind: 'county', pts: [[2390, 5410], [2600, 4300], [2900, 3390]] },
  { name: 'Springerton Rd', kind: 'county', pts: [[2900, 3210], [3300, 2700], [3710, 2240]] },
  { name: 'Seven Mile Rd', kind: 'county', pts: [[2990, 3300], [4000, 3250], [4900, 3200]] },
  { name: 'Maunie Rd', kind: 'county', pts: [[6000, 6640], [6200, 7300], [7200, 8100], [8800, 8610]] },
  { name: 'Maunie Rd', kind: 'county', pts: [[8890, 8700], [10000, 8600], [10810, 8500]] },
  { name: 'Herald Rd', kind: 'county', pts: [[2790, 9300], [4000, 9450], [5510, 9500]] },
  { name: 'Herald Rd', kind: 'county', pts: [[5690, 9500], [7200, 9200], [8710, 8700]] },
  { name: 'Phillipstown Rd', kind: 'county', pts: [[9190, 4510], [9800, 3900], [10510, 3290]] },
  { name: 'Sacramento Rd', kind: 'county', pts: [[6460, 5760], [7600, 4300], [8600, 3500], [10510, 3200]] },
  { name: 'Calvin Rd', kind: 'county', pts: [[8600, 3500], [9900, 2900]] },
  { name: 'County Road 1200 E', kind: 'county', pts: [[3500, 6000], [3700, 7800], [4000, 9450]] },
  { name: 'Wabash River Rd', kind: 'county', pts: [[10900, 8410], [11100, 7000], [11000, 5600], [10200, 4750]] },
  { name: 'Airport Rd', kind: 'county', pts: [[6200, 7300], [5900, 7350]] },
];
const SPEED = { interstate: 2.7, us: 2.25, state: 2.15, county: 1.7, street: 1.0 };
export const ROAD_KINDS = SPEED;

// ---------------- Build graph ----------------
function townAt(x, y, pad = 0) { return TOWNS.find((t) => x >= t.x0 - pad && x <= t.x1 + pad && y >= t.y0 - pad && y <= t.y1 + pad) || null; }
export { townAt };

function buildCity() {
  const r = new RNG(618_1814);
  const nodes = []; const adj = []; const edges = []; const nodeMap = new Map();
  const node = (x, y) => {
    const k = `${Math.round(x)},${Math.round(y)}`;
    if (nodeMap.has(k)) return nodeMap.get(k);
    nodes.push({ id: nodes.length, x, y }); adj.push([]); nodeMap.set(k, nodes.length - 1); return nodes.length - 1;
  };
  const addEdge = (a, b, meta) => {
    if (a === b) return;
    const A = nodes[a], Bn = nodes[b]; const len = dist(A.x, A.y, Bn.x, Bn.y);
    const mx = (A.x + Bn.x) / 2, my = (A.y + Bn.y) / 2; const t = townAt(mx, my, 5);
    const e = { id: edges.length, a, b, len, district: t ? t.name : RURAL, town: t?.id || null, ...meta };
    edges.push(e); adj[a].push({ to: b, edge: e.id }); adj[b].push({ to: a, edge: e.id });
  };
  // town grids
  for (const t of TOWNS) {
    t.ns.forEach((name, i) => { for (let j = 0; j < t.ys.length - 1; j++) addEdge(node(t.xs[i], t.ys[j]), node(t.xs[i], t.ys[j + 1]), { name, kind: 'street', speed: i === t.mainNS ? 1.15 : 1.0, axis: 'ns', town: t.id, idx: i }); });
    t.ew.forEach((name, j) => { for (let i = 0; i < t.xs.length - 1; i++) addEdge(node(t.xs[i], t.ys[j]), node(t.xs[i + 1], t.ys[j]), { name, kind: 'street', speed: j === t.mainEW ? 1.15 : 1.0, axis: 'ew', town: t.id, idx: j }); });
  }
  // named roads with cumulative distances (for rural addressing)
  const roads = ROAD_DEFS.map((d, ri) => {
    let acc = 0; const rd = { ...d, id: ri, cum: [0] };
    for (let i = 1; i < d.pts.length; i++) { acc += dist(d.pts[i - 1][0], d.pts[i - 1][1], d.pts[i][0], d.pts[i][1]); rd.cum.push(acc); }
    for (let i = 0; i < d.pts.length - 1; i++) addEdge(node(...d.pts[i]), node(...d.pts[i + 1]), { name: d.name, kind: d.kind, speed: SPEED[d.kind], road: ri, seg: i });
    return rd;
  });
  // Carmi's Main St carries IL-14/IL-1 and Oak St carries IL-1 (display aliases)
  for (const e of edges) if (e.town === 'carmi' && e.kind === 'street') {
    if (e.name === 'Main St') e.alias = 'IL-14 / IL-1';
    if (e.name === 'Oak St' && nodes[e.a].y >= 6200) e.alias = 'IL-1';
  }

  // blocks (for map drawing and location generation)
  const blocks = [];
  for (const t of TOWNS) {
    for (let i = 0; i < t.xs.length - 1; i++) for (let j = 0; j < t.ys.length - 1; j++) {
      const cx = (t.xs[i] + t.xs[i + 1]) / 2, cy = (t.ys[j] + t.ys[j + 1]) / 2;
      let zone = 'residential';
      const di = i - (t.mainNS - 1), dj = j - (t.mainEW - 1);
      if (t.id === 'carmi') {
        if ((i === 4 || i === 5) && (j === 3 || j === 4)) zone = 'downtown';
        else if (j === 3 || j === 4 || ((i === 2 || i === 1) && j >= 4)) zone = 'commercial';
        else if (i === 8 && j <= 2) zone = 'industrial';
        else if (i === 0 && j === 6) zone = 'park';
        else if ((i === 1 || i === 2) && j === 0) zone = 'institutional';
      } else if (t.xs.length >= 5) {
        if ((di === 0 || di === 1) && (dj === 0 || dj === 1)) zone = 'commercial';
        else if (i === 0 && j === t.ys.length - 2) zone = 'park';
        else if (i === t.xs.length - 2 && j === 0) zone = 'industrial';
      } else if (i === 0 && j === 0) zone = 'commercial';
      const b = { town: t.id, district: t.name, i, j, x0: t.xs[i], y0: t.ys[j], x1: t.xs[i + 1], y1: t.ys[j + 1], cx, cy, zone, buildings: [] };
      const w = b.x1 - b.x0, h = b.y1 - b.y0; const m = 9;
      if (zone === 'downtown') { for (let k = 0; k < 5; k++) b.buildings.push([b.x0 + m + k * (w - 2 * m) / 5, b.y0 + m, (w - 2 * m) / 5 - 2, h * 0.38, r.float(0.5, 0.8)], [b.x0 + m + k * (w - 2 * m) / 5, b.y1 - m - h * 0.38, (w - 2 * m) / 5 - 2, h * 0.38, r.float(0.5, 0.8)]); }
      else if (zone === 'commercial' || zone === 'industrial' || zone === 'institutional') { const n = zone === 'commercial' ? 2 : 1; for (let k = 0; k < n; k++) b.buildings.push([b.x0 + m + k * (w / n), b.y0 + m + r.float(0, 12), w / n - 2 * m, h * r.float(0.35, 0.6), r.float(0.4, 0.65)]); }
      else if (zone === 'residential') { for (let k = 0; k < 4; k++) for (const yy of [b.y0 + m, b.y1 - m - 16]) { if (r.chance(0.18)) continue; b.buildings.push([b.x0 + m + k * (w - 2 * m) / 4 + 2, yy + r.float(0, 4), (w - 2 * m) / 4 - 8, 14, r.float(0.3, 0.55)]); } }
      blocks.push(b);
    }
  }

  // rural farmsteads & oil wells along county/state roads
  const farms = []; const wells = [];
  for (const rd of roads) {
    if (rd.kind === 'interstate') continue;
    const total = rd.cum[rd.cum.length - 1];
    for (let d = r.float(150, 500); d < total - 100; d += r.float(380, 820)) {
      const p = pointAlong(rd, d); const side = r.chance(0.5) ? 1 : -1;
      const x = p.x + p.nx * side * 75, y = p.y + p.ny * side * 75;
      if (townAt(x, y, 120) || nearRiver(x, y, 60)) continue;
      farms.push({ x, y, road: rd.id, along: d, side, barn: r.chance(0.7) });
      if (r.chance(0.28)) wells.push({ x: x + p.nx * side * 140 + r.float(-60, 60), y: y + p.ny * side * 140 + r.float(-60, 60), road: rd.id });
    }
  }
  // woods along the rivers
  const woods = [];
  for (const rv of RIVERS) for (let i = 0; i < rv.points.length - 1; i++) {
    const [ax, ay] = rv.points[i], [bx, by] = rv.points[i + 1]; const L = dist(ax, ay, bx, by);
    for (let d = 0; d < L; d += 260) { const k = d / L; const s = r.chance(0.5) ? 1 : -1; const nx = -(by - ay) / L, ny = (bx - ax) / L;
      const x = ax + (bx - ax) * k + nx * s * r.float(80, 260), y = ay + (by - ay) * k + ny * s * r.float(80, 260);
      if (!townAt(x, y, 80)) woods.push([x, y, r.float(90, 190)]); }
  }
  return { nodes, adj, edges, roads, blocks, farms, wells, woods };
}

function pointAlong(rd, d) {
  let i = 1; while (i < rd.cum.length - 1 && rd.cum[i] < d) i++;
  const [ax, ay] = rd.pts[i - 1], [bx, by] = rd.pts[i]; const L = rd.cum[i] - rd.cum[i - 1] || 1; const k = clamp((d - rd.cum[i - 1]) / L, 0, 1);
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, nx: -(by - ay) / L, ny: (bx - ax) / L };
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
  const qx = ax + dx * t, qy = ay + dy * t; return { d: dist(px, py, qx, qy), t, qx, qy };
}
export function nearRiver(x, y, pad = 0) {
  for (const rv of RIVERS) for (let i = 0; i < rv.points.length - 1; i++) {
    const s = segDist(x, y, ...rv.points[i], ...rv.points[i + 1]); if (s.d < rv.width / 2 + pad) return { river: rv, ...s };
  }
  return null;
}

export const city = buildCity();
export const ROADS = city.roads;

// ---------------- Spatial index over edges ----------------
const CELL = 400; const grid = new Map();
const ck = (cx, cy) => `${cx},${cy}`;
for (const e of city.edges) {
  const A = city.nodes[e.a], Bn = city.nodes[e.b];
  for (let cx = Math.floor((Math.min(A.x, Bn.x) - 50) / CELL); cx <= Math.floor((Math.max(A.x, Bn.x) + 50) / CELL); cx++)
    for (let cy = Math.floor((Math.min(A.y, Bn.y) - 50) / CELL); cy <= Math.floor((Math.max(A.y, Bn.y) + 50) / CELL); cy++) {
      const k = ck(cx, cy); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(e);
    }
}
/** Nearest edge to a point (expanding search). Returns {edge, d, t, qx, qy} */
export function nearestEdge(x, y, filter) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  for (let rad = 1; rad <= 12; rad++) {
    let best = null; const seen = new Set();
    for (let i = cx - rad; i <= cx + rad; i++) for (let j = cy - rad; j <= cy + rad; j++) {
      for (const e of grid.get(ck(i, j)) || []) {
        if (seen.has(e.id) || (filter && !filter(e))) continue; seen.add(e.id);
        const A = city.nodes[e.a], Bn = city.nodes[e.b]; const s = segDist(x, y, A.x, A.y, Bn.x, Bn.y);
        if (!best || s.d < best.d) best = { edge: e, ...s };
      }
    }
    if (best && best.d < rad * CELL) return best;
  }
  return null;
}

// ---------------- Facilities & points of interest ----------------
const C = TOWN_BY_ID.carmi;
const T = (id, i, j, dx = 0, dy = 0) => { const t = TOWN_BY_ID[id]; return [t.xs[i] + dx, t.ys[j] + dy]; };
const FACILITY_DEFS = [
  ['police_hq', 'Carmi Police Department', ...T('carmi', 5, 4, 40, 35), 'Carmi PD'],
  ['precinct', 'Norris City Police Department', ...T('norris', 2, 2, 40, 30), 'Norris City PD'],
  ['precinct', 'Grayville Police Department', ...T('grayville', 2, 2, 40, -30), 'Grayville PD'],
  ['precinct', 'Crossville Police Department', ...T('crossville', 2, 2, -35, 30), 'Crossville PD'],
  ['precinct', 'Enfield Police Department', ...T('enfield', 2, 2, 35, -30), 'Enfield PD'],
  ['sheriff', "White County Sheriff's Office", ...T('carmi', 6, 4, 45, -35), 'Sheriff'],
  ['federal', 'Federal Field Office (Evansville) – staging', 12320, 1480, 'Federal'],
  ['eoc', 'White County 911 & EMA (your center)', ...T('carmi', 4, 3, 40, 40), '911 / EMA'],
  ['fire', 'Carmi Fire Department – Station 1', ...T('carmi', 4, 4, -40, 35), 'Carmi FD 1'],
  ['fire', 'Carmi Fire Department – Station 2', ...T('carmi', 8, 6, 40, 30), 'Carmi FD 2'],
  ['fire', 'Norris City Fire Department', ...T('norris', 3, 2, 35, -30), 'Norris City FD'],
  ['fire', 'Enfield Fire Department', ...T('enfield', 2, 3, -35, 30), 'Enfield FD'],
  ['fire', 'Crossville Fire Department', ...T('crossville', 3, 2, 35, 30), 'Crossville FD'],
  ['fire', 'Grayville Fire Department', ...T('grayville', 3, 2, 35, 30), 'Grayville FD'],
  ['fire', 'Mill Shoals Fire Department', ...T('millshoals', 2, 2, 35, 30), 'Mill Shoals FD'],
  ['fire', 'Burnt Prairie Fire Department', ...T('burntprairie', 2, 2, 35, 30), 'Burnt Prairie FD'],
  ['fire', 'Southeastern White County Fire (Maunie)', ...T('maunie', 1, 1, 30, 30), 'SE White FD'],
  ['fire', 'Springerton Fire Department', ...T('springerton', 1, 1, 30, 30), 'Springerton FD'],
  ['fire_hq', 'Carmi Fire Administration', ...T('carmi', 4, 4, -60, 60), 'Fire Admin'],
  ['ems', 'White County Ambulance Service (Carmi)', ...T('carmi', 3, 5, 40, 35), 'WCAS Carmi'],
  ['ems', 'White County Ambulance – Norris City', ...T('norris', 1, 2, 35, 30), 'WCAS Norris'],
  ['ems', 'White County Ambulance – Grayville', ...T('grayville', 1, 2, 35, 30), 'WCAS Grayville'],
  ['ems', 'White County Ambulance – Crossville', ...T('crossville', 1, 2, 35, -30), 'WCAS Crossville'],
  ['hospital', 'Carmi Township Hospital', ...T('carmi', 2, 6, 55, 40), 'Carmi Twp Hospital', { trauma: 3 }],
  ['hospital', 'Deaconess Midtown (Evansville, IN)', 12380, 1640, 'Deaconess', { trauma: 1 }],
  ['hospital', 'Ferrell Hospital (Eldorado)', 2050, 10860, 'Ferrell Hosp.', { trauma: 3 }],
  ['hospital', 'Fairfield Memorial Hospital', 1650, -360, 'Fairfield Mem.', { trauma: 3 }],
  ['hospital_helipad', 'Carmi Township Hospital Helipad', ...T('carmi', 2, 6, 25, 75), 'Helipad'],
  ['airport', 'Carmi Municipal Airport', 5880, 7360, 'Carmi Airport'],
  ['marina', 'Grayville Wabash River Boat Ramp', ...T('grayville', 4, 2, 60, 0), 'Boat Ramp'],
  ['coastguard', 'Wabash River Station (IL-14 landing)', 11380, 4820, 'River Station'],
  ['sar', 'White County Search & Rescue', ...T('carmi', 7, 6, 40, 30), 'SAR'],
  ['public_works', 'Carmi Public Works / County Highway Dept', ...T('carmi', 8, 1, 40, 30), 'Public Works'],
  ['animal_control', 'White County Animal Control', ...T('carmi', 6, 7, 40, 30), 'Animal Ctrl'],
  ['dot', 'IDOT Maintenance Yard (Carmi)', 5180, 6230, 'IDOT'],
  ['utility', 'Electric Co-op Operations Center', ...T('carmi', 7, 0, 40, 30), 'Electric Co-op'],
];

const POI_DEFS = [
  ['White County Courthouse', ...T('carmi', 5, 4, -45, -40), 'downtown', 'government'],
  ['Carmi City Hall', ...T('carmi', 5, 4, 45, -40), 'downtown', 'government'],
  ['Carmi-White County High School', ...T('carmi', 2, 0, 55, 45), 'institutional', 'school'],
  ['Carmi-White County Junior High', ...T('carmi', 1, 1, 55, 45), 'residential', 'school'],
  ['Carmi Elementary School', ...T('carmi', 7, 2, 55, 45), 'residential', 'school'],
  ['White County Fairgrounds', ...T('carmi', 9, 0, 120, -160), 'commercial', 'arena'],
  ['The Ratcliff Inn', ...T('carmi', 4, 4, 55, -38), 'downtown', 'hotel'],
  ['Carmi Supercenter', ...T('carmi', 2, 7, -45, 40), 'commercial', 'mall'],
  ['County Market Grocery', ...T('carmi', 1, 5, 55, 35), 'commercial', 'grocery'],
  ['QuickStop Gas – West Main', ...T('carmi', 1, 4, 55, 35), 'commercial', 'gas'],
  ['QuickStop Gas – East Main', ...T('carmi', 8, 4, 55, -35), 'commercial', 'gas'],
  ['Main Street Diner', ...T('carmi', 5, 4, 55, 38), 'downtown', 'restaurant'],
  ['Little Egypt Tavern', ...T('carmi', 6, 4, 55, 38), 'downtown', 'bar'],
  ['Carmi Public Library', ...T('carmi', 4, 3, -45, 40), 'downtown', 'library'],
  ['Bicentennial Park', ...T('carmi', 0, 6, 57, 55), 'park', 'park'],
  ['Carmi Community Pool', ...T('carmi', 0, 6, 57, 25), 'park', 'pool'],
  ['White County Senior Living', ...T('carmi', 7, 5, 55, 40), 'residential', 'nursing'],
  ['Oak Street Apartments', ...T('carmi', 2, 5, 40, 55), 'commercial', 'apartments'],
  ['Carmi Medical Clinic', ...T('carmi', 3, 6, 55, 40), 'residential', 'clinic'],
  ['First Baptist Church', ...T('carmi', 4, 2, 55, 40), 'residential', 'church'],
  ['Carmi Grain Elevator', ...T('carmi', 8, 0, 55, 40), 'industrial', 'factory'],
  ['Oil Field Supply & Service', ...T('carmi', 8, 2, 55, 40), 'industrial', 'chemical'],
  ['Carmi Rail Spur', ...T('carmi', 8, 1, 60, 60), 'industrial', 'railyard'],
  ['Little Wabash River Boat Access', 6520, 6240, 'commercial', 'boardwalk'],
  ['Carmi Office Plaza', ...T('carmi', 6, 3, 55, 45), 'downtown', 'office'],
  ['Norris City-Omaha-Enfield High School', ...T('norris', 0, 1, 50, 45), 'residential', 'school'],
  ['Norris City Dollar Store', ...T('norris', 2, 2, -45, -40), 'commercial', 'store'],
  ['Grayville Truck Stop (I-64 Exit 130)', 10560, 1700, 'commercial', 'gas'],
  ['Grayville Riverfront Park', ...T('grayville', 4, 1, 60, 40), 'park', 'park'],
  ['Grayville Grocery', ...T('grayville', 2, 2, -45, 40), 'commercial', 'grocery'],
  ['Crossville Community Park', ...T('crossville', 0, 3, 45, 45), 'park', 'park'],
  ['Crossville Market', ...T('crossville', 2, 2, 45, -40), 'commercial', 'shopping'],
  ['Enfield Grocery', ...T('enfield', 2, 2, 45, 40), 'commercial', 'grocery'],
  ['Enfield Grain Co-op', ...T('enfield', 3, 0, 45, 45), 'industrial', 'factory'],
  ['Mill Shoals Grain Elevator', ...T('millshoals', 3, 0, 45, 45), 'industrial', 'factory'],
  ['Burnt Prairie Church', ...T('burntprairie', 1, 1, 45, 45), 'residential', 'church'],
  ['Maunie Boat Ramp', 11300, 8480, 'park', 'boardwalk'],
  ['Emma General Store', ...T('emma', 0, 0, 45, 45), 'commercial', 'store'],
  ['Little Wabash River Bottoms', 7050, 7600, 'forest', 'forest'],
  ['Skillet Fork Bottoms', 3300, 4500, 'forest', 'forest'],
  ['Wabash River Bottoms (Phillipstown)', 11050, 3600, 'forest', 'forest'],
  ['Calvin', 9900, 2930, 'residential', 'village'],
];

export const FACILITIES = FACILITY_DEFS.map(([kind, name, x, y, short, extra], i) => ({ id: `fac_${i}`, kind, name, short, x, y, ...(extra || {}), address: null }));
city.facilities = FACILITIES;
city.pois = POI_DEFS.map(([name, x, y, zone, kind], i) => ({ id: `poi_${i}`, name, x, y, zone, kind }));
for (const [i, w] of city.wells.entries()) w.name = `Oil well tank battery #${i + 1}`;

// ---------------- Addresses ----------------
export function nearestTown(x, y) {
  let best = null, bd = Infinity;
  for (const t of TOWNS) { const d = dist(x, y, t.x, t.y); if (d < bd) { bd = d; best = t; } }
  return { town: best, d: bd };
}
function compass(dx, dy) { const a = Math.atan2(dx, -dy) * 180 / Math.PI; return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(((a + 360) % 360) / 45) % 8]; }
export function miles(gameMeters) { return (gameMeters * SCALE) / 1609; }
function milesText(m) { return m < 0.35 ? 'just outside' : `${m.toFixed(1)} miles`; }
function relTown(x, y) { const { town, d } = nearestTown(x, y); const m = miles(d); return m < 0.35 ? `near ${town.name}` : `${milesText(m)} ${compass(x - town.x, y - town.y)} of ${town.name}`; }

/** Address for any point. kind: street | road | highway | water */
export function addressFor(x, y) {
  const near = nearestEdge(x, y);
  const river = nearRiver(x, y, 5);
  if (river && (!near || near.d > 45)) {
    return { kind: 'water', street: river.river.name, number: null, cross: relTown(x, y), district: townAt(x, y, 150)?.name || RURAL, full: `${river.river.name}, ${relTown(x, y)}`, short: river.river.name };
  }
  if (!near) return { kind: 'road', street: 'Unknown road', number: null, cross: '', district: RURAL, full: relTown(x, y), short: relTown(x, y) };
  const e = near.edge;
  if (e.kind === 'street') {
    const t = TOWN_BY_ID[e.town];
    let number, prefix, cross;
    if (e.axis === 'ns') {
      const d = near.qy - t.y; prefix = Math.abs(d) < 8 ? '' : d < 0 ? 'N ' : 'S ';
      number = Math.max(1, Math.floor((Math.abs(d) / t.blockY) * 100));
      if ((x > t.xs[e.idx]) !== (number % 2 === 0)) number += 1;
      cross = t.ew[clamp(Math.round((near.qy - t.y0) / t.blockY), 0, t.ew.length - 1)];
    } else {
      const d = near.qx - t.x; prefix = Math.abs(d) < 8 ? '' : d < 0 ? 'W ' : 'E ';
      number = Math.max(1, Math.floor((Math.abs(d) / t.block) * 100));
      if ((y > t.ys[e.idx]) !== (number % 2 === 0)) number += 1;
      cross = t.ns[clamp(Math.round((near.qx - t.x0) / t.block), 0, t.ns.length - 1)];
    }
    const street = `${prefix}${e.name}`;
    return { kind: 'street', street: e.name, prefix: prefix.trim(), number, cross, district: t.name, town: t.id, full: `${number} ${street}${t.id === 'carmi' ? '' : `, ${t.name}`}`, short: `${number} ${street}`, alias: e.alias || null };
  }
  // rural roads and highways
  const rd = city.roads[e.road];
  const along = rd.cum[e.seg] + near.t * e.len;
  const side = (near.qx - x) * (city.nodes[e.b].y - city.nodes[e.a].y) - (near.qy - y) * (city.nodes[e.b].x - city.nodes[e.a].x) > 0;
  let number = Math.round((miles(along) * 1000) / 5) * 5 + 1000; if (side !== (number % 2 === 0)) number += 1;
  const rel = relTown(x, y);
  const district = townAt(x, y, 100)?.name || RURAL;
  if (e.kind === 'interstate') {
    const mm = Math.round(117 + ((near.qx - 4500) / 6000) * 13);
    return { kind: 'highway', street: 'I-64', number: null, cross: `mile marker ${mm}`, district, full: `I-64 near mile marker ${mm} (${rel})`, short: `I-64 MM ${mm}`, rel, mm };
  }
  const label = e.kind === 'county' ? rd.name : rd.name.replace('IL-', 'IL Route ').replace('US-', 'US Hwy ');
  return { kind: 'road', street: rd.name, number, cross: rel, district, full: `${number} ${label}`, short: `${number} ${label}`, rel, highway: e.kind !== 'county' };
}

export function nearestFacility(x, y, kinds) {
  let best = null, bd = Infinity;
  for (const f of city.facilities) { if (kinds && !kinds.includes(f.kind)) continue; const d = dist(x, y, f.x, f.y); if (d < bd) { bd = d; best = f; } }
  return best;
}
export function nearbyPOI(x, y, maxDist = 90) {
  let best = null, bd = maxDist;
  for (const p of city.pois) { const d = dist(x, y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
  return best;
}
export function blockOf(x, y) { return city.blocks.find((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) || null; }

for (const f of city.facilities) f.address = addressFor(f.x, f.y).full;

// ---------------- Location generation ----------------
const ZONE_ALIASES = { street: ['residential', 'commercial', 'downtown'], any: ['residential', 'commercial', 'downtown', 'industrial', 'institutional'] };

function pickTown(r, zones) {
  const towns = TOWNS.filter((t) => city.blocks.some((b) => b.town === t.id && zones.includes(b.zone)));
  return r.weighted(towns.length ? towns : TOWNS, (t) => t.weight);
}

export function randomLocation(r, zones = ['residential'], opts = {}) {
  zones = zones.flatMap((z) => ZONE_ALIASES[z] || [z]);
  if (opts.poiKinds) {
    const choices = [...city.pois, ...city.wells.map((w) => ({ ...w, kind: 'oilwell' }))].filter((p) => opts.poiKinds.includes(p.kind));
    if (choices.length) { const p = r.pick(choices); return finalizeLocation(p.x + r.float(-15, 15), p.y + r.float(-15, 15), r, { poi: p }); }
  }
  if (zones.includes('highway')) {
    const hw = city.edges.filter((e) => ['interstate', 'us', 'state'].includes(e.kind) && !e.town && e.len > 150);
    const e = r.weighted(hw, (x) => x.len * (x.kind === 'interstate' ? 1.4 : 1)); const A = city.nodes[e.a], Bn = city.nodes[e.b]; const k = r.float(0.1, 0.9);
    const dir = e.kind === 'interstate' ? r.pick(['eastbound', 'westbound']) : Math.abs(Bn.x - A.x) > Math.abs(Bn.y - A.y) ? r.pick(['eastbound', 'westbound']) : r.pick(['northbound', 'southbound']);
    return finalizeLocation(A.x + (Bn.x - A.x) * k, A.y + (Bn.y - A.y) * k, r, { dir, highway: true });
  }
  if (zones.includes('water')) {
    const rv = r.weighted(RIVERS, (x) => (x.name === 'Wabash River' ? 1.2 : x.name === 'Little Wabash River' ? 1.5 : 0.6));
    const i = r.int(1, rv.points.length - 3); const [ax, ay] = rv.points[i], [bx, by] = rv.points[i + 1]; const k = r.float(0.1, 0.9);
    return finalizeLocation(ax + (bx - ax) * k, ay + (by - ay) * k, r, { water: true });
  }
  if (zones.includes('forest')) {
    const w = r.pick(city.woods); return finalizeLocation(w[0], w[1], r, { zone: 'forest' });
  }
  if (zones.includes('rural') || (opts.ruralChance && r.chance(opts.ruralChance))) {
    const f = r.pick(city.farms); return finalizeLocation(f.x, f.y, r, { zone: 'rural', farm: f });
  }
  const town = pickTown(r, zones);
  const cands = city.blocks.filter((b) => b.town === town.id && zones.includes(b.zone));
  const block = r.pick(cands.length ? cands : city.blocks.filter((b) => b.town === town.id));
  const side = r.int(0, 3); const t = r.float(0.15, 0.85); const w = block.x1 - block.x0, h = block.y1 - block.y0; const inset = r.float(16, 26);
  let x = block.x0, y = block.y0;
  if (side === 0) { x += inset; y += t * h; } else if (side === 1) { x += w - inset; y += t * h; } else if (side === 2) { x += t * w; y += inset; } else { x += t * w; y += h - inset; }
  return finalizeLocation(x, y, r, { zone: block.zone });
}

function finalizeLocation(x, y, r, extra = {}) {
  const a = addressFor(x, y);
  const poi = extra.poi || nearbyPOI(x, y, 60);
  const loc = { x, y, ...a, poi: poi ? poi.name : null, poiKind: poi ? poi.kind : null, zone: extra.zone || blockOf(x, y)?.zone || 'rural', dir: extra.dir || null };
  if (extra.highway && a.kind !== 'highway') {
    loc.kind = 'highway'; loc.full = `${a.street}${extra.dir ? ` ${extra.dir}` : ''}, ${a.rel}`; loc.short = `${a.street} ${extra.dir ? extra.dir.slice(0, 2).toUpperCase() : ''}`.trim();
  }
  if (a.kind === 'highway' && extra.dir) loc.full = `I-64 ${extra.dir} near mile marker ${a.mm}`;
  if (a.kind === 'street' && (loc.zone === 'downtown' || (loc.zone === 'commercial' && r.chance(0.3)) || (loc.poiKind === 'apartments'))) {
    if (r.chance(0.45) || loc.poiKind === 'apartments') loc.apt = `${r.pick(['Apt', 'Unit'])} ${r.int(1, 4)}${r.pick(['A', 'B', 'C', '0', '2'])}`;
  }
  loc.full = loc.full + (loc.apt ? `, ${loc.apt}` : '');
  if (!loc.short) loc.short = loc.full;
  return loc;
}

// ---------------- Geocoding (typed address → point) ----------------
export const ALL_STREETS = [...new Set([...TOWNS.flatMap((t) => [...t.ns, ...t.ew]), ...ROAD_DEFS.map((d) => d.name)])];
export const STREET_WORDS = [...new Set(ALL_STREETS.flatMap((s) => s.toLowerCase().split(/[\s/-]+/)))];
// legacy exports used by the NLU
export const NS_STREETS = C.ns; export const EW_STREETS = C.ew;

export function geocodeAddress(number, street, text = '') {
  if (!street) return null;
  const low = ` ${String(text).toLowerCase()} `;
  const townHint = TOWNS.find((t) => low.includes(` ${t.name.toLowerCase()} `));
  const prefix = (low.match(/\b(\d+)\s+(n|s|e|w|north|south|east|west)\b/) || [])[2];
  // town street
  const towns = TOWNS.filter((t) => t.ns.includes(street) || t.ew.includes(street));
  if (towns.length) {
    const t = (townHint && towns.includes(townHint)) ? townHint : towns.find((x) => x.id === 'carmi') || towns[0];
    const n = number || 0; const along = (n / 100);
    if (t.ns.includes(street)) {
      const i = t.ns.indexOf(street); const sign = prefix && /^(n|north)/.test(prefix) ? -1 : 1;
      const y = clamp(t.y + sign * along * t.blockY, t.y0, t.y1); const x = t.xs[i] + (n % 2 === 0 ? 8 : -8);
      return { x, y, ...addressFor(x, y), street, town: t.id, district: t.name };
    }
    const j = t.ew.indexOf(street); const sign = prefix && /^(w|west)/.test(prefix) ? -1 : 1;
    const x = clamp(t.x + sign * along * t.block, t.x0, t.x1); const y = t.ys[j] + (n % 2 === 0 ? 8 : -8);
    return { x, y, ...addressFor(x, y), street, town: t.id, district: t.name };
  }
  // county road / highway: number is ~1000 per mile from the road's start
  const rds = city.roads.filter((r) => r.name === street);
  if (!rds.length) return null;
  const targetMi = number ? Math.max(0, (number - 1000) / 1000) : null;
  let best = null;
  for (const rd of rds) {
    const total = rd.cum[rd.cum.length - 1];
    const d = targetMi == null ? total / 2 : (targetMi * 1609) / SCALE;
    if (!best || (d <= total && (!best.fits))) best = { rd, d: Math.min(d, total), fits: d <= total };
  }
  const p = pointAlong(best.rd, best.d);
  const x = p.x + p.nx * 40, y = p.y + p.ny * 40;
  return { x, y, ...addressFor(x, y) };
}

// ---------------- Routing ----------------
class Heap {
  constructor() { this.a = []; }
  push(id, k) { const a = this.a; a.push([k, id]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

export class Router {
  constructor() { this.closed = new Set(); this.slow = new Map(); this.weatherFactor = 1; }

  edgeCost(e) {
    if (this.closed.has(e.id)) return Infinity;
    let speed = e.speed;
    const slow = this.slow.get(e.district);
    if (slow && e.kind !== 'interstate') speed *= slow;
    return e.len / (speed * this.weatherFactor);
  }

  entry(x, y) {
    const n = nearestEdge(x, y); if (!n) return null;
    return { d: n.d, px: n.qx, py: n.qy, a: n.edge.a, b: n.edge.b, edge: n.edge };
  }

  route(x0, y0, x1, y1, { air = false, water = false } = {}) {
    if (air || water) { const L = dist(x0, y0, x1, y1); return { points: [[x0, y0], [x1, y1]], speeds: [water ? 1.4 : 1], length: L, cost: L }; }
    const s = this.entry(x0, y0), t = this.entry(x1, y1);
    if (!s || !t) { const L = dist(x0, y0, x1, y1); return { points: [[x0, y0], [x1, y1]], speeds: [1], length: L, cost: L }; }
    const sameSeg = s.edge.id === t.edge.id;
    if (sameSeg) { const pts = [[x0, y0], [s.px, s.py], [t.px, t.py], [x1, y1]]; return this.finish(pts, [0.6, s.edge.speed, 0.6]); }
    const n = city.nodes.length; const D = new Float64Array(n).fill(Infinity); const prev = new Int32Array(n).fill(-1); const done = new Uint8Array(n);
    const h = new Heap(); const sp = s.edge.speed * this.weatherFactor;
    const startCost = (id) => dist(s.px, s.py, city.nodes[id].x, city.nodes[id].y) / sp;
    for (const id of [s.a, s.b]) { const c = startCost(id); if (c < D[id]) { D[id] = c; h.push(id, c); } }
    const targets = new Set([t.a, t.b]); let found = 0;
    while (h.size) {
      const [d, u] = h.pop(); if (done[u]) continue; done[u] = 1;
      if (targets.has(u) && ++found === 2) break;
      for (const { to, edge } of city.adj[u]) {
        if (done[to]) continue; const c = this.edgeCost(city.edges[edge]); if (!isFinite(c)) continue;
        if (d + c < D[to]) { D[to] = d + c; prev[to] = u; h.push(to, d + c); }
      }
    }
    const tp = t.edge.speed * this.weatherFactor;
    const endCost = (id) => D[id] + dist(t.px, t.py, city.nodes[id].x, city.nodes[id].y) / tp;
    const end = endCost(t.a) <= endCost(t.b) ? t.a : t.b;
    if (!isFinite(D[end])) { const L = dist(x0, y0, x1, y1); return { points: [[x0, y0], [x1, y1]], speeds: [1], length: L, cost: L * 2 }; }
    const chain = []; for (let v = end; v !== -1; v = prev[v]) chain.push(v); chain.reverse();
    const pts = [[x0, y0], [s.px, s.py], ...chain.map((id) => [city.nodes[id].x, city.nodes[id].y]), [t.px, t.py], [x1, y1]];
    const speeds = [0.6, s.edge.speed];
    for (let i = 1; i < chain.length; i++) { const link = city.adj[chain[i - 1]].find((l) => l.to === chain[i]); speeds.push(link ? city.edges[link.edge].speed : 1); }
    speeds.push(t.edge.speed, 0.6);
    return this.finish(pts, speeds);
  }

  finish(points, speeds) {
    let length = 0, cost = 0;
    for (let i = 1; i < points.length; i++) { const L = dist(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]); length += L; cost += L / (speeds[i - 1] || 1); }
    return { points, speeds, length, cost };
  }

  /** Non-interstate edges near a point (road-closure events). */
  edgesNear(x, y, radius = 150) {
    return city.edges.filter((e) => {
      if (e.kind === 'interstate') return false;
      const A = city.nodes[e.a], Bn = city.nodes[e.b]; return segDist(x, y, A.x, A.y, Bn.x, Bn.y).d < radius;
    });
  }
}

/** Radio-style location ("400 block of W Main St", "IL-14, 2.1 miles east of Enfield"). */
export function blockText(a) {
  if (a.kind === 'street') return `${Math.floor(a.number / 100) * 100 || 'unit'} block of ${a.prefix ? `${a.prefix} ` : ''}${a.street}${a.district && a.district !== 'Carmi' ? `, ${a.district}` : ''}`;
  if (a.kind === 'road') return `${a.street}, ${a.rel}`;
  return a.full;
}
