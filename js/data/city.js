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
  // Brownsville: unincorporated, 38.0414 N 88.2447 W (about 5 miles WSW of Carmi). Street names are game placeholders.
  { id: 'brownsville', name: 'Brownsville', x: 3570, y: 7930, block: 90, blockY: 90, mainNS: 1, mainEW: 1, weight: 0.015, ns: ['West St', 'Main St', 'East St'], ew: ['North St', 'Church St', 'South St'] },
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
  { name: 'Brownsville Rd', kind: 'county', pts: [[3660, 7930], [4200, 7930], [4700, 7930]] },
  { name: 'Brownsville Rd', kind: 'county', pts: [[3480, 7930], [2950, 7930]] },
];
const SPEED = { interstate: 2.7, us: 2.25, state: 2.15, county: 1.7, township: 1.45, street: 1.0 };

// ---------------- Projection & surrounding region ----------------
// Game coordinates are a plain projection of real latitude/longitude at SCALE (x = east from
// the west county line, y = south from the north county line). These helpers place real
// places on the map; they're also handy when adding more locations.
export const GEO = { lon0: -88.375, lat0: 38.270, xPerDeg: 27400, yPerDeg: 34690 };
export function geoToGame(lat, lon) { return [Math.round((lon - GEO.lon0) * GEO.xPerDeg), Math.round((GEO.lat0 - lat) * GEO.yPerDeg)]; }
export function gameToGeo(x, y) { return { lat: GEO.lat0 - y / GEO.yPerDeg, lon: GEO.lon0 + x / GEO.xPerDeg }; }

/** Is a point inside White County (the department's jurisdiction)? */
export function insideCounty(x, y) {
  let inside = false; const P = COUNTY_LINE;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// The map can be zoomed out past the county line to show the surrounding area. Everything
// below is outside the jurisdiction: drawn on the map (and routable for hospital transfers),
// but calls, incidents and city events are only ever generated inside White County.
export const REGION_BOUNDS = { x0: -9500, y0: -7500, x1: 24500, y1: 21500 };
export const OUTER_TOWNS = [
  { name: 'McLeansboro', county: 'Hamilton Co.', size: 3, at: [38.0934, -88.5356] },
  { name: 'Fairfield', county: 'Wayne Co.', size: 3, at: [38.3789, -88.3598] },
  { name: 'Albion', county: 'Edwards Co.', size: 2, at: [38.3770, -88.0562] },
  { name: 'Mount Carmel', county: 'Wabash Co.', size: 3, at: [38.4109, -87.7614] },
  { name: 'Eldorado', county: 'Saline Co.', size: 3, at: [37.8137, -88.4381] },
  { name: 'Ridgway', county: 'Gallatin Co.', size: 1, at: [37.7992, -88.2606] },
  { name: 'Shawneetown', county: 'Gallatin Co.', size: 1, at: [37.7131, -88.1867] },
  { name: 'Omaha', county: 'Gallatin Co.', size: 1, at: [37.8903, -88.3034] },
  { name: 'New Haven', county: 'Gallatin Co.', size: 1, at: [37.9067, -88.1286] },
  { name: 'New Harmony', county: 'Posey Co., IN', size: 1, at: [38.1298, -87.9353] },
  { name: 'Mount Vernon', county: 'Posey Co., IN', size: 2, at: [37.9323, -87.8950] },
  { name: 'Evansville', county: 'Vanderburgh Co., IN', size: 5, at: [37.9716, -87.5711] },
  { name: 'Wayne City', county: 'Wayne Co.', size: 1, at: [38.3456, -88.5878] },
  { name: 'Keensburg', county: 'Wabash Co.', size: 1, at: [38.3517, -87.8673] },
].map((t) => { const [x, y] = geoToGame(...t.at); return { ...t, x, y }; });
export const NEIGHBOR_COUNTIES = [
  ['HAMILTON COUNTY', -5200, 3600], ['WAYNE COUNTY', 1500, -4800], ['EDWARDS COUNTY', 8200, -5200], ['WABASH COUNTY', 14200, -6600],
  ['SALINE COUNTY', -5200, 14500], ['GALLATIN COUNTY', 3200, 14800], ['GIBSON COUNTY, IN', 18500, -2400], ['POSEY COUNTY, IN', 15800, 6500],
  ['VANDERBURGH CO., IN', 22300, 4400], ['KENTUCKY', 9200, 20500],
];
// Approximate neighbouring county lines (drawn only).
export const NEIGHBOR_LINES = [
  [[0, 0], [-9500, 0]], [[0, 10500], [-9500, 10500]], [[0, 10500], [0, 21500]], [[0, 0], [0, -7500]],
  [[6160, 0], [6160, -7500]], [[11320, 0], [10850, -2600], [10900, -7500]],
  [[12900, 1900], [24500, 1900]], [[19900, 1900], [19900, 11300]],
];
// Display-only rivers outside the county (the Wabash north of Grayville and south of the county, and the Ohio).
export const OUTER_RIVERS = [
  { name: 'Wabash River', width: 110, points: [[11320, 0], [11320, -500], [12100, -1900], [13600, -2900], [15400, -3700], [16900, -4800], [17500, -6200], [17800, -7500]] },
  { name: 'Wabash River', width: 120, points: [[11300, 10500], [11200, 11000], [10900, 12600], [10400, 14200], [9800, 15600], [9450, 16300]] },
  { name: 'Ohio River', width: 260, points: [[24500, 11300], [22400, 10900], [20100, 11900], [17600, 12700], [15200, 12300], [13150, 12100], [11400, 13900], [10200, 15400], [9450, 16300], [8100, 17400], [6900, 18500], [5600, 19500], [4300, 20600], [3200, 21500]] },
];
// Indiana / Kentucky (east of the Wabash, south of the Ohio) — filled darker on the map.
export const STATE_AREAS = [
  { name: 'Indiana', pts: [[11320, -500], [12100, -1900], [13600, -2900], [15400, -3700], [16900, -4800], [17500, -6200], [17800, -7500], [24500, -7500], [24500, 11300], [22400, 10900], [20100, 11900], [17600, 12700], [15200, 12300], [13150, 12100], [11400, 13900], [10200, 15400], [9450, 16300], [9800, 15600], [10400, 14200], [10900, 12600], [11200, 11000], [11300, 10500], [11500, 9400], [11650, 8000], [11400, 6400], [11550, 4800], [11350, 3200], [11500, 1600], [11320, 0]] },
  { name: 'Kentucky', pts: [[24500, 11300], [24500, 21500], [3200, 21500], [4300, 20600], [5600, 19500], [6900, 18500], [8100, 17400], [9450, 16300], [10200, 15400], [11400, 13900], [13150, 12100], [15200, 12300], [17600, 12700], [20100, 11900], [22400, 10900]] },
];
// Highways leaving the county toward the nearby towns and hospitals (routable, outside the jurisdiction).
const OUTER_ROAD_DEFS = [
  { name: 'US-45', kind: 'us', pts: [[1700, -400], [1200, -1800], [700, -3000], [420, -3700], [300, -7500]] },
  { name: 'US-45', kind: 'us', pts: [[2700, 10900], [1600, 12600], [300, 14200], [-1700, 15800], [-3800, 17800], [-6000, 20000]] },
  { name: 'IL-1', kind: 'state', pts: [[10950, -400], [11050, -1200], [11900, -3300], [13500, -4400], [16600, -4900], [17200, -7500]] },
  { name: 'IL-1', kind: 'state', pts: [[2000, 10900], [2050, 13150], [2600, 14800], [3100, 16300], [4300, 17800], [5150, 19300]] },
  { name: 'IL-141', kind: 'state', pts: [[3700, 10900], [4900, 11900], [6750, 12600], [8300, 14000]] },
  { name: 'IL-14', kind: 'state', pts: [[-400, 5900], [-2400, 6000], [-4400, 6140], [-9500, 6300]] },
  { name: 'IL-15', kind: 'state', pts: [[420, -3700], [3400, -3720], [6200, -3720], [8740, -3710], [10400, -3800], [11900, -3300]] },
  { name: 'IL-242', kind: 'state', pts: [[-4400, 6140], [-4200, 9000], [-3600, 12000], [-1700, 15800]] },
  { name: 'I-64', kind: 'interstate', pts: [[-400, 2380], [-3500, 2600], [-6800, 2700], [-9500, 2900]] },
  { name: 'I-64', kind: 'interstate', pts: [[12400, 1550], [14500, 1800], [17000, 2300], [19300, 2900], [21300, 3100], [24500, 3000]] },
  { name: 'I-69', kind: 'interstate', pts: [[21300, 3100], [22000, 5800], [22300, 8300], [22600, 10200]] },
  { name: 'IN-69', kind: 'state', pts: [[12060, 4860], [13000, 7000], [13150, 11700]] },
  { name: 'IN-66', kind: 'state', pts: [[13150, 11700], [16500, 11300], [19500, 10800], [22400, 10300]] },
];
// Real smaller communities (no street grid in the game, shown as named places).
export const HAMLETS = [
  ['Stokes', 3120, 8380], ['Roland', 3500, 10250], ['Epworth', 7900, 6950], ['Calvin', 9900, 2930],
];
export const ROAD_KINDS = SPEED;

// ---------------- Build graph ----------------
function townAt(x, y, pad = 0) { return TOWNS.find((t) => x >= t.x0 - pad && x <= t.x1 + pad && y >= t.y0 - pad && y <= t.y1 + pad) || null; }
export { townAt };

function buildCity(defs) {
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
  const roads = defs.map((d, ri) => {
    let acc = 0; const rd = { ...d, id: ri, cum: [0] };
    for (let i = 1; i < d.pts.length; i++) { acc += dist(d.pts[i - 1][0], d.pts[i - 1][1], d.pts[i][0], d.pts[i][1]); rd.cum.push(acc); }
    for (let i = 0; i < d.pts.length - 1; i++) addEdge(node(...d.pts[i]), node(...d.pts[i + 1]), { name: d.name, kind: d.kind, speed: SPEED[d.kind], road: ri, seg: i, outside: !!d.outside, grid: !!d.grid });
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
    if (rd.kind === 'interstate' || rd.outside) continue;
    const total = rd.cum[rd.cum.length - 1];
    for (let d = r.float(150, 500); d < total - 100; d += r.float(380, 820)) {
      const p = pointAlong(rd, d); const side = r.chance(0.5) ? 1 : -1;
      const x = p.x + p.nx * side * 75, y = p.y + p.ny * side * 75;
      if (townAt(x, y, 120) || nearRiver(x, y, 60) || !insideCounty(x, y)) continue;
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
      if (!townAt(x, y, 80) && insideCounty(x, y)) woods.push([x, y, r.float(90, 190)]); }
  }
  return { nodes, adj, edges, roads, blocks, farms, wells, woods };
}

// ---------------- Section-line county roads ----------------
// Illinois' rural roads follow the one-mile survey grid. This lays a road on every section
// line inside the county, leaving gaps the way the real network has them (river bottoms,
// fields, the interstate), only bridging the Little Wabash and Skillet Fork in a few places,
// and never crossing the Wabash. Names follow the county grid ("County Road 1200 E").
// It's a faithful *pattern* of White County's road network, not a survey of every real road.
export const MILE = 1609 / SCALE;
function segHits(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy; const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den, u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  return t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 ? { t, u, x: ax + rx * t, y: ay + ry * t } : null;
}
function gridRoadDefs(named) {
  const r = new RNG(1816_0618);
  const out = [];
  const namedSegs = [];
  for (const d of named) for (let i = 0; i < d.pts.length - 1; i++) namedSegs.push([...d.pts[i], ...d.pts[i + 1], d.kind]);
  const nearTown = (x, y, pad) => TOWNS.some((t) => x >= t.x0 - pad && x <= t.x1 + pad && y >= t.y0 - pad && y <= t.y1 + pad);
  const ok = (ax, ay, bx, by) => {
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    if (!insideCounty(ax + (mx - ax) * 0.02, ay + (my - ay) * 0.02) || !insideCounty(bx + (mx - bx) * 0.02, by + (my - by) * 0.02)) return false;
    if (nearTown(ax, ay, 25) || nearTown(bx, by, 25) || nearTown(mx, my, 25)) return false;
    // rivers: never along a river, never across the Wabash, only a few bridges elsewhere
    for (const rv of RIVERS) for (let i = 0; i < rv.points.length - 1; i++) {
      const [px, py] = rv.points[i], [qx, qy] = rv.points[i + 1];
      if (segHits(ax, ay, bx, by, px, py, qx, qy)) { if (rv.name === 'Wabash River' || r.chance(0.72)) return false; }
    }
    if (nearRiver(mx, my, 30)) return false;
    const bottoms = nearRiver(mx, my, 420);
    if (r.chance(bottoms ? 0.5 : 0.13)) return false;
    // don't double up on a named road running the same way, and only some roads cross I-64
    const L = Math.hypot(bx - ax, by - ay);
    for (const [px, py, qx, qy, kind] of namedSegs) {
      if (kind === 'interstate') { if (segHits(ax, ay, bx, by, px, py, qx, qy) && r.chance(0.45)) return false; continue; }
      const sL = Math.hypot(qx - px, qy - py) || 1; const cos = Math.abs(((bx - ax) * (qx - px) + (by - ay) * (qy - py)) / (L * sL));
      if (cos > 0.88 && segDist(mx, my, px, py, qx, qy).d < 170) return false;
    }
    return true;
  };
  const nx = Math.floor(11700 / MILE), ny = Math.floor(10500 / MILE);
  const run = (name, pts) => { if (pts.length > 1) out.push({ name, kind: 'township', grid: true, pts: pts.map(([x, y]) => [Math.round(x), Math.round(y)]) }); };
  for (let i = 1; i <= nx; i++) { // north–south roads ("E" numbers)
    const x = i * MILE; const name = `County Road ${i * 100 + 500} E`; let cur = [];
    for (let j = 0; j < ny + 1; j++) {
      const y0 = j * MILE, y1 = Math.min(10500, (j + 1) * MILE); if (y1 - y0 < 50) continue;
      if (ok(x, y0, x, y1)) { if (!cur.length) cur.push([x, y0]); cur.push([x, y1]); } else { run(name, cur); cur = []; }
    }
    run(name, cur);
  }
  for (let j = 1; j <= ny; j++) { // east–west roads ("N" numbers)
    const y = j * MILE; const name = `County Road ${Math.round((10500 - y) / MILE) * 100 + 300} N`; let cur = [];
    for (let i = 0; i < nx + 2; i++) {
      const x0 = i * MILE, x1 = (i + 1) * MILE;
      if (ok(x0, y, x1, y)) { if (!cur.length) cur.push([x0, y]); cur.push([x1, y]); } else { run(name, cur); cur = []; }
    }
    run(name, cur);
  }
  return out;
}

/** Split road polylines wherever two of them cross, so the routing graph connects them. Interstates are grade-separated. */
function nodeRoads(defs) {
  const C = 600; const cells = new Map(); const segs = [];
  defs.forEach((d, di) => { if (d.kind === 'interstate') return; for (let i = 0; i < d.pts.length - 1; i++) {
    const [ax, ay] = d.pts[i], [bx, by] = d.pts[i + 1]; const sg = { di, i, ax, ay, bx, by, id: segs.length }; segs.push(sg);
    for (let cx = Math.floor(Math.min(ax, bx) / C); cx <= Math.floor(Math.max(ax, bx) / C); cx++) for (let cy = Math.floor(Math.min(ay, by) / C); cy <= Math.floor(Math.max(ay, by) / C); cy++) {
      const k = `${cx},${cy}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(sg);
    } } });
  const ins = defs.map((d) => d.pts.map(() => []));
  const seen = new Set(); const E = 0.002;
  for (const list of cells.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const s1 = list[a], s2 = list[b]; if (s1.di === s2.di) continue;
    const key = s1.id < s2.id ? `${s1.id}|${s2.id}` : `${s2.id}|${s1.id}`; if (seen.has(key)) continue; seen.add(key);
    const h = segHits(s1.ax, s1.ay, s1.bx, s1.by, s2.ax, s2.ay, s2.bx, s2.by); if (!h) continue;
    const end1 = h.t < E ? [s1.ax, s1.ay] : h.t > 1 - E ? [s1.bx, s1.by] : null;
    const end2 = h.u < E ? [s2.ax, s2.ay] : h.u > 1 - E ? [s2.bx, s2.by] : null;
    const p = end1 || end2 || [Math.round(h.x), Math.round(h.y)];
    if (!end1) ins[s1.di][s1.i].push([h.t, p]);
    if (!end2) ins[s2.di][s2.i].push([h.u, p]);
  }
  return defs.map((d, di) => {
    if (d.kind === 'interstate') return d;
    const pts = [];
    for (let i = 0; i < d.pts.length; i++) { pts.push(d.pts[i]); if (i < d.pts.length - 1) for (const [, p] of ins[di][i].sort((x, y) => x[0] - y[0])) pts.push(p); }
    return { ...d, pts: pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]) };
  });
}

function buildNetwork() {
  const named = [...ROAD_DEFS, ...OUTER_ROAD_DEFS.map((d) => ({ ...d, outside: true }))];
  let defs = nodeRoads([...named, ...gridRoadDefs(ROAD_DEFS)]);
  let c = buildCity(defs);
  // drop section-road runs that ended up cut off from the network (islands between rivers)
  const start = c.nodes.reduce((b, n) => (Math.hypot(n.x - 6000, n.y - 6200) < Math.hypot(b.x - 6000, b.y - 6200) ? n : b), c.nodes[0]).id;
  const seen = new Uint8Array(c.nodes.length); const stack = [start]; seen[start] = 1;
  while (stack.length) { const u = stack.pop(); for (const { to } of c.adj[u]) if (!seen[to]) { seen[to] = 1; stack.push(to); } }
  const bad = new Set(c.edges.filter((e) => e.grid && !seen[e.a]).map((e) => e.road));
  if (bad.size) { defs = defs.filter((d, i) => !bad.has(i)); c = buildCity(defs); }
  return c;
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

export const city = buildNetwork();
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
  ['police_hq', 'City Police – Carmi', ...T('carmi', 5, 4, 40, 35), 'Police – Carmi'],
  ['precinct', 'Town Police – Norris City', ...T('norris', 2, 2, 40, 30), 'Police – Norris City'],
  ['precinct', 'Town Police – Grayville', ...T('grayville', 2, 2, 40, -30), 'Police – Grayville'],
  ['precinct', 'Town Police – Crossville', ...T('crossville', 2, 2, -35, 30), 'Police – Crossville'],
  ['precinct', 'Town Police – Enfield', ...T('enfield', 2, 2, 35, -30), 'Police – Enfield'],
  ['sheriff', "County Sheriff's Office", ...T('carmi', 6, 4, 45, -35), 'Sheriff'],
  ['federal', 'Federal Field Office – I-64 staging', 12320, 1480, 'Federal'],
  ['eoc', 'Regional 911 Center (your center)', ...T('carmi', 4, 3, 40, 40), '911 / EMA'],
  ['fire', 'Fire Station 1 – Carmi', ...T('carmi', 4, 4, -40, 35), 'Fire 1 – Carmi'],
  ['fire', 'Fire Station 2 – Carmi', ...T('carmi', 8, 6, 40, 30), 'Fire 2 – Carmi'],
  ['fire', 'Fire Station – Norris City', ...T('norris', 3, 2, 35, -30), 'Fire – Norris City'],
  ['fire', 'Fire Station – Enfield', ...T('enfield', 2, 3, -35, 30), 'Fire – Enfield'],
  ['fire', 'Fire Station – Crossville', ...T('crossville', 3, 2, 35, 30), 'Fire – Crossville'],
  ['fire', 'Fire Station – Grayville', ...T('grayville', 3, 2, 35, 30), 'Fire – Grayville'],
  ['fire', 'Fire Station – Mill Shoals', ...T('millshoals', 2, 2, 35, 30), 'Fire – Mill Shoals'],
  ['fire', 'Fire Station – Burnt Prairie', ...T('burntprairie', 2, 2, 35, 30), 'Fire – Burnt Prairie'],
  ['fire', 'Fire Station – Maunie', ...T('maunie', 1, 1, 30, 30), 'Fire – Maunie'],
  ['fire', 'Fire Station – Springerton', ...T('springerton', 1, 1, 30, 30), 'Fire – Springerton'],
  ['fire_hq', 'Fire Administration – Carmi', ...T('carmi', 4, 4, -60, 60), 'Fire Admin'],
  ['ems', 'County EMS – Carmi', ...T('carmi', 3, 5, 40, 35), 'EMS – Carmi'],
  ['ems', 'County EMS – Norris City', ...T('norris', 1, 2, 35, 30), 'EMS – Norris'],
  ['ems', 'County EMS – Grayville', ...T('grayville', 1, 2, 35, 30), 'EMS – Grayville'],
  ['ems', 'County EMS – Crossville', ...T('crossville', 1, 2, 35, -30), 'EMS – Crossville'],
  ['hospital', 'Riverbend Medical Center', ...T('carmi', 2, 6, 55, 40), 'Riverbend Medical', { trauma: 3 }],
  ['hospital', 'Tri-State Regional Trauma Center (Evansville, IN)', 22520, 10050, 'Tri-State Trauma', { trauma: 1, outside: true }],
  ['hospital', 'Saline Valley Hospital (Eldorado)', -1620, 15700, 'Saline Valley Hosp.', { trauma: 3, outside: true }],
  ['hospital', 'Prairie View Hospital (Fairfield)', 520, -3640, 'Prairie View Hosp.', { trauma: 3, outside: true }],
  ['hospital_helipad', 'Riverbend Medical Center Helipad', ...T('carmi', 2, 6, 25, 75), 'Helipad'],
  ['airport', 'Carmi Municipal Airport', 5880, 7360, 'Carmi Airport'],
  ['marina', 'Grayville Wabash River Boat Ramp', ...T('grayville', 4, 2, 60, 0), 'Boat Ramp'],
  ['coastguard', 'Wabash River Station (IL-14 landing)', 11380, 4820, 'River Station'],
  ['sar', 'County Search & Rescue', ...T('carmi', 7, 6, 40, 30), 'SAR'],
  ['public_works', 'Carmi Public Works / County Highway Dept', ...T('carmi', 8, 1, 40, 30), 'Public Works'],
  ['animal_control', 'County Animal Control', ...T('carmi', 6, 7, 40, 30), 'Animal Ctrl'],
  ['dot', 'State Highway Maintenance Yard (Carmi)', 5180, 6230, 'State DOT'],
  ['utility', 'Electric Co-op Operations Center', ...T('carmi', 7, 0, 40, 30), 'Electric Co-op'],
];

const POI_DEFS = [
  ['White County Courthouse', ...T('carmi', 5, 4, -45, -40), 'downtown', 'government'],
  ['Carmi City Hall', ...T('carmi', 5, 4, 45, -40), 'downtown', 'government'],
  ['Carmi Area High School', ...T('carmi', 2, 0, 55, 45), 'institutional', 'school'],
  ['Carmi Area Junior High', ...T('carmi', 1, 1, 55, 45), 'residential', 'school'],
  ['Carmi Elementary School', ...T('carmi', 7, 2, 55, 45), 'residential', 'school'],
  ['White County Fairgrounds', ...T('carmi', 9, 0, 120, -160), 'commercial', 'arena'],
  ['The Old Courthouse Inn', ...T('carmi', 4, 4, 55, -38), 'downtown', 'hotel'],
  ['Carmi Supercenter', ...T('carmi', 2, 7, -45, 40), 'commercial', 'mall'],
  ['Main Street Grocery', ...T('carmi', 1, 5, 55, 35), 'commercial', 'grocery'],
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
  ['Southern Prairie High School', ...T('norris', 0, 1, 50, 45), 'residential', 'school'],
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
  ['Brownsville Church', ...T('brownsville', 1, 0, 45, 40), 'residential', 'church'],
  ['Brownsville Cemetery', ...T('brownsville', 0, 1, -60, 30), 'park', 'park'],
  ['Stokes', 3120, 8380, 'residential', 'village'],
  ['Roland', 3500, 10250, 'residential', 'village'],
  ['Epworth', 7900, 6950, 'residential', 'village'],
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
function relTown(x, y) {
  if (!insideCounty(x, y)) { let best = null, bd = Infinity; for (const t of OUTER_TOWNS) { const d = dist(x, y, t.x, t.y); if (d < bd) { bd = d; best = t; } } const m = miles(bd); return `${m < 0.35 ? 'near' : `${milesText(m)} ${compass(x - best.x, y - best.y)} of`} ${best.name} (outside White County)`; }
  const { town, d } = nearestTown(x, y); const m = miles(d); return m < 0.35 ? `near ${town.name}` : `${milesText(m)} ${compass(x - town.x, y - town.y)} of ${town.name}`; }

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
  const label = e.kind === 'county' || e.kind === 'township' ? rd.name : rd.name.replace('IL-', 'IL Route ').replace('US-', 'US Hwy ');
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
    const hw = city.edges.filter((e) => ['interstate', 'us', 'state'].includes(e.kind) && !e.town && !e.outside && e.len > 150 && insideCounty((city.nodes[e.a].x + city.nodes[e.b].x) / 2, (city.nodes[e.a].y + city.nodes[e.b].y) / 2));
    let e, A, Bn, k;
    for (let tries = 0; tries < 12; tries++) { e = r.weighted(hw, (x) => x.len * (x.kind === 'interstate' ? 1.4 : 1)); A = city.nodes[e.a]; Bn = city.nodes[e.b]; k = r.float(0.1, 0.9); if (insideCounty(A.x + (Bn.x - A.x) * k, A.y + (Bn.y - A.y) * k)) break; }
    const dir = e.kind === 'interstate' ? r.pick(['eastbound', 'westbound']) : Math.abs(Bn.x - A.x) > Math.abs(Bn.y - A.y) ? r.pick(['eastbound', 'westbound']) : r.pick(['northbound', 'southbound']);
    return finalizeLocation(A.x + (Bn.x - A.x) * k, A.y + (Bn.y - A.y) * k, r, { dir, highway: true });
  }
  if (zones.includes('water')) {
    const rv = r.weighted(RIVERS, (x) => (x.name === 'Wabash River' ? 1.2 : x.name === 'Little Wabash River' ? 1.5 : 0.6));
    let x = 0, y = 0;
    for (let tries = 0; tries < 12; tries++) {
      const i = r.int(1, rv.points.length - 3); const [ax, ay] = rv.points[i], [bx, by] = rv.points[i + 1]; const k = r.float(0.1, 0.9);
      x = ax + (bx - ax) * k; y = ay + (by - ay) * k;
      if (rv.name === 'Wabash River') x -= rv.width * 0.3; // the Wabash is the state line – stay on the Illinois half
      if (insideCounty(x, y)) break;
    }
    return finalizeLocation(x, y, r, { water: true });
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
export const ALL_STREETS = [...new Set([...TOWNS.flatMap((t) => [...t.ns, ...t.ew]), ...ROAD_DEFS.map((d) => d.name), ...city.roads.filter((d) => d.grid).map((d) => d.name)])];
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
  const rds = city.roads.filter((r) => r.name === street && !r.outside);
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
