// The fictional City of Ridgeview: street grid, neighborhoods, river, highways,
// facilities, points of interest, address system and road-graph routing.
// Everything is generated deterministically from a fixed seed so the city is the
// same every time you play.
import { RNG, dist, clamp } from '../core/util.js';

export const B = 220; // block size in meters
export const N = 15; // streets per direction (0..14)
export const CITY_NAME = 'Ridgeview';
export const COUNTY_NAME = 'Halston County';

export const NS_STREETS = ['Westgate Rd', 'Aspen Ave', 'Birch Ave', 'Cedar Ave', 'Dogwood Ave', 'Elm St', 'Franklin Ave', 'Main St',
  'Grant Ave', 'Hawthorne Ave', 'Irving Ave', 'Juniper Ave', 'Kingston Ave', 'Lakeshore Dr', 'Riverside Dr'];
export const EW_STREETS = ['Northgate Pkwy', 'Ridge Rd', '2nd St', '3rd St', '4th St', '5th St', '6th St', 'Washington St',
  '8th St', '9th St', '10th St', '11th St', '12th St', 'Harbor St', 'Port Rd'];

export const RIVER = { name: 'Halston River', x0: 12.22 * B, x1: 12.78 * B };
export const BRIDGE_ROWS = [2, 7, 11];
export const BAY = { name: 'Ridgeview Bay', y0: 14.35 * B };
export const HIGHWAYS = {
  i47: { name: 'I-47', x: 3.5 * B, rampRows: [1, 4, 7, 10, 13], y0: -0.6 * B, y1: 14.3 * B },
  rt9: { name: 'Route 9 Expressway', y: 10.5 * B, rampCols: [1, 4, 7, 10, 14], x0: -0.6 * B, x1: 14.6 * B },
};
export const MAP_BOUNDS = { x0: -1.2 * B, y0: -1.2 * B, x1: 15.2 * B, y1: 15.6 * B };

// ---------- Zones & districts ----------
function zoneFor(bx, by) {
  if (bx === 12) return 'water';
  if ((bx <= 1 && by === 0)) return 'airport';
  if (bx >= 5 && bx <= 6 && by >= 2 && by <= 3) return 'park';
  if (bx === 9 && by === 12) return 'park';
  if ((bx <= 1 && by >= 11) || (bx === 2 && by === 13)) return 'forest';
  if (bx >= 9 && bx <= 11 && by <= 4) return 'industrial';
  if (by === 13 && bx >= 7 && bx <= 11) return 'industrial';
  if (bx >= 1 && bx <= 2 && by === 5) return 'institutional';
  if (bx >= 5 && bx <= 8 && by >= 5 && by <= 8) return 'downtown';
  if (bx === 6 || bx === 7 || by === 6 || by === 7) return 'commercial';
  if (bx === 13 && (by === 2 || by === 7 || by === 11)) return 'commercial';
  return 'residential';
}
function districtFor(bx, by) {
  if (bx === 12) return 'Halston River';
  if (bx === 13) return 'Riverside';
  if (bx >= 9 && bx <= 11 && by <= 5) return 'Ironworks';
  if (bx <= 1 && by <= 5) return 'Maple Heights';
  if (by <= 3) return 'Northgate';
  if (bx >= 5 && bx <= 8 && by >= 4 && by <= 9) return 'Downtown';
  if (bx <= 4 && by >= 4 && by <= 9) return 'Cedar Hill';
  if (bx <= 4 && by >= 10) return 'Westbrook';
  if (bx >= 9 && bx <= 11 && by >= 6 && by <= 10) return 'Oak Grove';
  if (by >= 10) return 'Southport';
  return 'Downtown';
}
export const DISTRICTS = ['Downtown', 'Northgate', 'Maple Heights', 'Cedar Hill', 'Westbrook', 'Southport', 'Oak Grove', 'Ironworks', 'Riverside'];

// ---------- Facilities ----------
// kind is matched by unit types' `station` lists.
const FACILITY_DEFS = [
  ['police_hq', 'Ridgeview Police Headquarters', 7.5, 6.18, 'PD HQ'],
  ['precinct', '1st Precinct (Northgate)', 6.5, 1.2, '1st Pct'],
  ['precinct', '2nd Precinct (Cedar Hill)', 1.2, 7.5, '2nd Pct'],
  ['precinct', '3rd Precinct (Southport)', 8.5, 11.8, '3rd Pct'],
  ['precinct', '4th Precinct (Riverside)', 13.8, 5.5, '4th Pct'],
  ['sheriff', "Halston County Sheriff's Office", 2.5, 3.2, 'Sheriff'],
  ['federal', 'Federal Building (FBI / DEA)', 8.2, 5.2, 'Federal'],
  ['eoc', 'Emergency Operations Center & 911 Center', 4.8, 4.5, 'EOC / 911'],
  ['fire', 'Fire Station 1 (Headquarters)', 6.2, 8.5, 'Sta 1'],
  ['fire', 'Fire Station 2', 3.2, 1.5, 'Sta 2'],
  ['fire', 'Fire Station 3', 0.8, 9.2, 'Sta 3'],
  ['fire', 'Fire Station 4', 10.5, 2.8, 'Sta 4'],
  ['fire', 'Fire Station 5', 10.2, 8.2, 'Sta 5'],
  ['fire', 'Fire Station 6', 5.5, 12.2, 'Sta 6'],
  ['fire', 'Fire Station 7', 13.5, 9.5, 'Sta 7'],
  ['fire', 'Fire Station 8', 2.8, 11.5, 'Sta 8'],
  ['fire', 'Fire Station 9', 13.4, 1.4, 'Sta 9'],
  ['fire', 'Fire Station 10', 8.8, 3.6, 'Sta 10'],
  ['ems', 'EMS Station 1', 5.2, 6.8, 'EMS 1'],
  ['ems', 'EMS Station 2', 2.2, 10.2, 'EMS 2'],
  ['ems', 'EMS Station 3', 11.2, 11.5, 'EMS 3'],
  ['ems', 'EMS Station 4', 9.6, 1.6, 'EMS 4'],
  ['hospital', 'Ridgeview General Hospital', 4.5, 6.5, 'Ridgeview General', { trauma: 1 }],
  ['hospital', 'St. Catherine Medical Center', 10.5, 9.5, 'St. Catherine', { trauma: 2 }],
  ['hospital', 'Northside Regional Hospital', 7.5, 2.5, 'Northside Regional', { trauma: 3 }],
  ['hospital_helipad', 'Ridgeview General Helipad', 4.3, 6.2, 'Helipad'],
  ['airport', 'Ridgeview Municipal Airport (Air Ops)', 0.9, 0.5, 'Airport'],
  ['marina', 'Harbor Point Marina (Marine Patrol)', 10.5, 14.15, 'Marina'],
  ['coastguard', 'Coast Guard Station Ridgeview', 13.6, 14.15, 'USCG'],
  ['sar', 'Westbrook Search & Rescue Base', 1.8, 11.3, 'SAR Base'],
  ['public_works', 'Public Works Yard', 11.5, 3.5, 'PW Yard'],
  ['animal_control', 'Animal Control Center', 3.5, 12.5, 'Animal Ctrl'],
  ['dot', 'DOT Maintenance Garage', 2.4, 8.6, 'DOT'],
  ['utility', 'Halston Power & Light Ops', 11.4, 0.6, 'Utility'],
];
FACILITY_DEFS.push(['fire_hq', 'Fire Administration', 6.4, 8.8, 'Fire Admin']);

// ---------- Points of interest (used by callers & map) ----------
const POI_DEFS = [
  ['Ridgeview Mall', 9.5, 7.5, 'commercial', 'mall'], ['Ridgeview Arena', 10.5, 6.5, 'commercial', 'arena'],
  ['Lincoln High School', 3.5, 2.5, 'residential', 'school'], ['Maplewood Elementary', 0.5, 3.5, 'residential', 'school'],
  ['Ridgeview State University', 1.8, 5.5, 'institutional', 'university'], ['City Hall', 7.3, 7.3, 'downtown', 'government'],
  ['Central Station', 8.5, 8.6, 'downtown', 'transit'], ['Ridgeview Public Library', 5.6, 7.5, 'downtown', 'library'],
  ['Grand Ridgeview Hotel', 6.6, 5.6, 'downtown', 'hotel'], ['Sunrise Senior Living', 3.4, 9.4, 'residential', 'nursing'],
  ['Parkside Apartments', 4.5, 2.6, 'residential', 'apartments'], ['Riverbend Apartments', 13.5, 7.6, 'commercial', 'apartments'],
  ['Halcyon Chemical Plant', 10.5, 1.5, 'industrial', 'chemical'], ['Ironworks Steel Mill', 9.5, 0.5, 'industrial', 'factory'],
  ['Ridgeview Rail Yard', 11.5, 4.5, 'industrial', 'railyard'], ['Port of Ridgeview Terminal', 9.5, 13.6, 'industrial', 'port'],
  ['FreshMart Grocery', 2.5, 6.6, 'commercial', 'grocery'], ['QuickStop Gas', 7.6, 10.4, 'commercial', 'gas'],
  ['QuickStop Gas', 3.6, 7.6, 'commercial', 'gas'], ['Fuel Stop Truck Plaza', 4.4, 10.4, 'residential', 'gas'],
  ["Murphy's Pub", 6.4, 9.4, 'commercial', 'bar'], ['The Blue Note Lounge', 7.6, 5.4, 'downtown', 'bar'],
  ['Grace Community Church', 1.5, 8.5, 'residential', 'church'], ['Cedar Hill Park & Pool', 3.5, 5.5, 'residential', 'pool'],
  ['Westbrook Forest Preserve', 0.8, 12.4, 'forest', 'forest'], ['Ridgeview Central Park', 6.0, 3.0, 'park', 'park'],
  ['Lakeview Park', 9.5, 12.5, 'park', 'park'], ['Riverside Plaza', 13.5, 2.5, 'commercial', 'shopping'],
  ['Oak Grove Shopping Center', 10.5, 7.6, 'commercial', 'shopping'], ['Halston Community College', 13.5, 11.5, 'commercial', 'college'],
  ['Southport Marina Boardwalk', 11.5, 13.9, 'industrial', 'boardwalk'], ['Northgate Business Park', 4.5, 0.5, 'residential', 'office'],
  ['Kingston Tower', 8.5, 6.5, 'downtown', 'office'], ['Ridgeview Medical Plaza', 5.5, 6.4, 'downtown', 'clinic'],
  ['Ace Hardware & Lumber', 11.5, 10.5, 'residential', 'store'], ['Dragon Palace Restaurant', 7.4, 9.6, 'commercial', 'restaurant'],
  ["Rosie's Diner", 13.4, 9.4, 'residential', 'restaurant'], ['SuperSaver Warehouse Club', 0.6, 6.6, 'commercial', 'store'],
];

// ---------- Build ----------
function buildCity() {
  const r = new RNG(911_2026);
  const blocks = [];
  for (let by = 0; by < N - 1; by++) for (let bx = 0; bx < N - 1; bx++) {
    const zone = zoneFor(bx, by);
    const block = { bx, by, zone, district: districtFor(bx, by), buildings: [] };
    // footprints for the map
    const x0 = bx * B + 14, y0 = by * B + 14, size = B - 28;
    if (zone === 'downtown') {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) block.buildings.push([x0 + i * size / 2 + 6, y0 + j * size / 2 + 6, size / 2 - 12, size / 2 - 12, r.float(0.55, 0.85)]);
    } else if (zone === 'commercial' || zone === 'industrial' || zone === 'institutional') {
      const n = zone === 'industrial' ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const w = r.float(40, size / n), h = r.float(50, size * 0.8);
        block.buildings.push([x0 + i * (size / n) + 4, y0 + r.float(0, size - h), w - 8, h, r.float(0.4, 0.7)]);
      }
    } else if (zone === 'residential') {
      const cols = 5;
      for (let i = 0; i < cols; i++) for (const yy of [0, size - 34]) {
        if (r.chance(0.12)) continue;
        block.buildings.push([x0 + i * (size / cols) + 5, y0 + yy + r.float(0, 6), size / cols - 12, r.float(20, 28), r.float(0.3, 0.55)]);
      }
    }
    blocks.push(block);
  }
  const blockAt = (bx, by) => (bx >= 0 && by >= 0 && bx < N - 1 && by < N - 1 ? blocks[by * (N - 1) + bx] : null);

  // Road graph
  const nodes = []; const adj = [];
  const addNode = (x, y, meta = {}) => { nodes.push({ id: nodes.length, x, y, ...meta }); adj.push([]); return nodes.length - 1; };
  const edges = [];
  const addEdge = (a, b, speed, name, kind = 'street') => {
    const len = dist(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y);
    const id = edges.length; edges.push({ id, a, b, len, speed, name, kind });
    adj[a].push({ to: b, edge: id }); adj[b].push({ to: a, edge: id });
  };
  for (let rr = 0; rr < N; rr++) for (let c = 0; c < N; c++) addNode(c * B, rr * B, { c, r: rr });
  const gid = (c, rr) => rr * N + c;
  for (let rr = 0; rr < N; rr++) for (let c = 0; c < N - 1; c++) {
    if (c === 12 && !BRIDGE_ROWS.includes(rr)) continue; // river
    const isMain = rr === 7 || rr === 0 || rr === 14;
    addEdge(gid(c, rr), gid(c + 1, rr), isMain ? 1.15 : 1.0, EW_STREETS[rr], c === 12 ? 'bridge' : 'street');
  }
  for (let c = 0; c < N; c++) for (let rr = 0; rr < N - 1; rr++) {
    const isMain = c === 7 || c === 0 || c === 13;
    addEdge(gid(c, rr), gid(c, rr + 1), isMain ? 1.15 : 1.0, NS_STREETS[c]);
  }
  // I-47
  const i47 = HIGHWAYS.i47; const i47Nodes = [];
  for (const rr of i47.rampRows) {
    const n = addNode(i47.x, rr * B, { hw: 'i47', label: `${EW_STREETS[rr]} exit` }); i47Nodes.push(n);
    addEdge(n, gid(3, rr), 0.8, `${i47.name} ramp`, 'ramp'); addEdge(n, gid(4, rr), 0.8, `${i47.name} ramp`, 'ramp');
  }
  // Route 9
  const rt9 = HIGHWAYS.rt9; const rt9Nodes = [];
  for (const c of rt9.rampCols) {
    const n = addNode(c * B, rt9.y, { hw: 'rt9', label: `${NS_STREETS[c]} exit` }); rt9Nodes.push(n);
    addEdge(n, gid(c, 10), 0.8, `${rt9.name} ramp`, 'ramp'); addEdge(n, gid(c, 11), 0.8, `${rt9.name} ramp`, 'ramp');
  }
  const interchange = addNode(i47.x, rt9.y, { hw: 'both', label: 'I-47 / Route 9 interchange' });
  const chain = (list, name) => { for (let i = 0; i < list.length - 1; i++) addEdge(list[i], list[i + 1], 1.8, name, 'highway'); };
  // insert interchange into both chains in sorted order
  const i47Chain = [...i47Nodes, interchange].sort((a, b) => nodes[a].y - nodes[b].y);
  const rt9Chain = [...rt9Nodes, interchange].sort((a, b) => nodes[a].x - nodes[b].x);
  chain(i47Chain, i47.name); chain(rt9Chain, rt9.name);

  const facilities = FACILITY_DEFS.map(([kind, name, fx, fy, short, extra], i) => {
    const x = fx * B, y = fy * B;
    return { id: `fac_${i}`, kind, name, short, x, y, ...(extra || {}), address: null };
  });
  const pois = POI_DEFS.map(([name, px, py, zone, kind], i) => ({ id: `poi_${i}`, name, x: px * B, y: py * B, zone, kind }));

  return { blocks, blockAt, nodes, adj, edges, gid, facilities, pois };
}

export const city = buildCity();
for (const f of city.facilities) f.address = addressFor(f.x, f.y).full;

// ---------- Address system ----------
export function blockOf(x, y) {
  const bx = clamp(Math.floor(x / B), 0, N - 2), by = clamp(Math.floor(y / B), 0, N - 2);
  return city.blockAt(bx, by);
}

/** Returns the frontage street, house number, cross street and district for any point. */
export function addressFor(x, y) {
  // Highways
  if (Math.abs(x - HIGHWAYS.i47.x) < 18 && y > -B && y < 14.4 * B) {
    const rr = clamp(Math.round(y / B), 0, 14);
    return { kind: 'highway', street: 'I-47', number: null, cross: EW_STREETS[rr], district: districtFor(3, clamp(Math.floor(y / B), 0, 13)),
      full: `I-47 near the ${EW_STREETS[rr]} exit`, short: `I-47 @ ${EW_STREETS[rr]}` };
  }
  if (Math.abs(y - HIGHWAYS.rt9.y) < 18) {
    const c = clamp(Math.round(x / B), 0, 14);
    return { kind: 'highway', street: 'Route 9', number: null, cross: NS_STREETS[c], district: districtFor(clamp(Math.floor(x / B), 0, 13), 10),
      full: `Route 9 Expressway near ${NS_STREETS[c]}`, short: `Rt 9 @ ${NS_STREETS[c]}` };
  }
  if (y > BAY.y0) return { kind: 'water', street: BAY.name, cross: 'Port Rd', district: 'Southport', full: `${BAY.name} off Port Rd`, short: BAY.name, number: null };
  if (x > RIVER.x0 && x < RIVER.x1) {
    const rr = clamp(Math.round(y / B), 0, 14);
    return { kind: 'water', street: RIVER.name, cross: EW_STREETS[rr], district: 'Halston River', full: `${RIVER.name} near ${EW_STREETS[rr]}`, short: `${RIVER.name}`, number: null };
  }
  const bx = clamp(Math.floor(x / B), 0, N - 2), by = clamp(Math.floor(y / B), 0, N - 2);
  const lx = x - bx * B, ly = y - by * B;
  const d = [lx, B - lx, ly, B - ly];
  const side = d.indexOf(Math.min(...d));
  let street, number, cross;
  if (side <= 1) { // N-S street
    const c = side === 0 ? bx : bx + 1;
    street = NS_STREETS[clamp(c, 0, 14)];
    number = by * 100 + 100 + Math.max(1, Math.floor((ly / B) * 96));
    if ((x > c * B) !== (number % 2 === 0)) number += 1;
    cross = EW_STREETS[clamp(Math.round(y / B), 0, 14)];
  } else {
    const rr = side === 2 ? by : by + 1;
    street = EW_STREETS[clamp(rr, 0, 14)];
    number = bx * 100 + 100 + Math.max(1, Math.floor((lx / B) * 96));
    if ((y > rr * B) !== (number % 2 === 0)) number += 1;
    cross = NS_STREETS[clamp(Math.round(x / B), 0, 14)];
  }
  const district = districtFor(bx, by);
  return { kind: 'street', street, number, cross, district, full: `${number} ${street}`, short: `${number} ${street}` };
}

export function nearestFacility(x, y, kinds) {
  let best = null, bd = Infinity;
  for (const f of city.facilities) {
    if (kinds && !kinds.includes(f.kind)) continue;
    const d = dist(x, y, f.x, f.y);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

export function nearbyPOI(x, y, maxDist = 260) {
  let best = null, bd = maxDist;
  for (const p of city.pois) { const d = dist(x, y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
  return best;
}

// ---------- Location generation for scenarios ----------
const ZONE_ALIASES = { street: ['residential', 'commercial', 'downtown'], any: ['residential', 'commercial', 'downtown', 'industrial', 'institutional'] };

export function randomLocation(r, zones = ['residential'], opts = {}) {
  zones = zones.flatMap((z) => ZONE_ALIASES[z] || [z]);
  if (zones.includes('highway')) {
    if (r.chance(0.6)) {
      const y = r.float(0.3, 13.7) * B; const x = HIGHWAYS.i47.x + r.float(-6, 6);
      return finalizeLocation(x, y, r, { dir: r.pick(['northbound', 'southbound']) });
    }
    const x = r.float(0.3, 13.7) * B; const y = HIGHWAYS.rt9.y + r.float(-6, 6);
    return finalizeLocation(x, y, r, { dir: r.pick(['eastbound', 'westbound']) });
  }
  if (zones.includes('water')) {
    if (r.chance(0.5)) return finalizeLocation(r.float(RIVER.x0 + 20, RIVER.x1 - 20), r.float(0.5, 13.5) * B, r);
    return finalizeLocation(r.float(6, 14) * B, BAY.y0 + r.float(30, 140), r);
  }
  if (opts.poiKinds) {
    const choices = city.pois.filter((p) => opts.poiKinds.includes(p.kind));
    if (choices.length) {
      const p = r.pick(choices);
      return finalizeLocation(p.x + r.float(-20, 20), p.y + r.float(-20, 20), r, { poi: p });
    }
  }
  const candidates = city.blocks.filter((b) => zones.includes(b.zone));
  const block = r.pick(candidates.length ? candidates : city.blocks.filter((b) => b.zone === 'residential'));
  // place near a frontage
  const side = r.int(0, 3); const t = r.float(0.12, 0.88); const inset = r.float(22, 42);
  let x = block.bx * B, y = block.by * B;
  if (side === 0) { x += inset; y += t * B; } else if (side === 1) { x += B - inset; y += t * B; } else if (side === 2) { x += t * B; y += inset; } else { x += t * B; y += B - inset; }
  return finalizeLocation(x, y, r, { zone: block.zone });
}

function finalizeLocation(x, y, r, extra = {}) {
  const a = addressFor(x, y);
  const poi = extra.poi || nearbyPOI(x, y, 120);
  const loc = { x, y, ...a, poi: poi ? poi.name : null, poiKind: poi ? poi.kind : null, zone: extra.zone || blockOf(x, y)?.zone, dir: extra.dir || null };
  if (a.kind === 'street' && (loc.zone === 'downtown' || (loc.zone === 'residential' && r.chance(0.25)))) {
    if (r.chance(0.45)) loc.apt = `${r.pick(['Apt', 'Unit', 'Suite'])} ${r.int(1, 9)}${r.pick(['A', 'B', 'C', '0', '2', '4'])}`;
  }
  loc.full = a.full + (loc.apt ? `, ${loc.apt}` : '');
  return loc;
}

// ---------- Routing ----------
export class Router {
  constructor() { this.closed = new Set(); this.slow = new Map(); /* district -> multiplier */ this.weatherFactor = 1; }

  edgeCost(e) {
    if (this.closed.has(e.id)) return Infinity;
    let speed = e.speed;
    const mid = city.nodes[e.a];
    const blk = blockOf(mid.x + 1, mid.y + 1);
    const slow = blk && this.slow.get(blk.district);
    if (slow && e.kind !== 'highway') speed *= slow;
    return e.len / (speed * this.weatherFactor);
  }

  /** Projection of a point onto its frontage street: returns {px,py,a,b} with endpoint node ids. */
  entry(x, y) {
    const c = clamp(Math.round(x / B), 0, N - 1), rr = clamp(Math.round(y / B), 0, N - 1);
    let best = null;
    const consider = (a, b) => {
      if (a == null || b == null) return;
      const A = city.nodes[a], Bn = city.nodes[b];
      const dx = Bn.x - A.x, dy = Bn.y - A.y; const L2 = dx * dx + dy * dy || 1;
      const t = clamp(((x - A.x) * dx + (y - A.y) * dy) / L2, 0, 1);
      const px = A.x + dx * t, py = A.y + dy * t;
      const d = dist(x, y, px, py);
      // don't let a point snap across the river
      if ((x < RIVER.x0) !== (px < RIVER.x0 + 1) && Math.abs(x - px) > 10) return;
      if (!best || d < best.d) best = { d, px, py, a, b };
    };
    for (const e of [...city.adj[city.gid(c, rr)].map((n) => city.edges[n.edge])]) consider(e.a, e.b);
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const cc = c + dc, r2 = rr + dr; if (cc < 0 || r2 < 0 || cc >= N || r2 >= N) continue;
      for (const n of city.adj[city.gid(cc, r2)]) { const e = city.edges[n.edge]; if (e.kind === 'street' || e.kind === 'bridge') consider(e.a, e.b); }
    }
    // highway points snap to highway chain
    for (const e of city.edges) if (e.kind === 'highway') {
      const A = city.nodes[e.a], Bn = city.nodes[e.b];
      const dx = Bn.x - A.x, dy = Bn.y - A.y; const L2 = dx * dx + dy * dy || 1;
      const t = clamp(((x - A.x) * dx + (y - A.y) * dy) / L2, 0, 1);
      const px = A.x + dx * t, py = A.y + dy * t; const d = dist(x, y, px, py);
      if (d < 25 && (!best || d < best.d)) best = { d, px, py, a: e.a, b: e.b };
    }
    return best;
  }

  /** Path from point to point following roads. Returns { points:[[x,y],...], length, time } */
  route(x0, y0, x1, y1, { air = false, water = false } = {}) {
    if (air || water) {
      const L = dist(x0, y0, x1, y1);
      return { points: [[x0, y0], [x1, y1]], speeds: [1], length: L, cost: L };
    }
    const s = this.entry(x0, y0), t = this.entry(x1, y1);
    if (!s || !t) { const L = dist(x0, y0, x1, y1); return { points: [[x0, y0], [x1, y1]], speeds: [1], length: L, cost: L }; }
    const n = city.nodes.length; const D = new Float64Array(n).fill(Infinity); const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    const sd = (id) => dist(s.px, s.py, city.nodes[id].x, city.nodes[id].y);
    D[s.a] = sd(s.a); D[s.b] = Math.min(D[s.b], sd(s.b));
    // simple O(n^2) Dijkstra is fine for ~240 nodes
    for (;;) {
      let u = -1, bd = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && D[i] < bd) { bd = D[i]; u = i; }
      if (u < 0) break; done[u] = 1;
      for (const { to, edge } of city.adj[u]) {
        const c = this.edgeCost(city.edges[edge]); if (!isFinite(c)) continue;
        if (D[u] + c < D[to]) { D[to] = D[u] + c; prev[to] = u; }
      }
    }
    const td = (id) => dist(t.px, t.py, city.nodes[id].x, city.nodes[id].y);
    const endA = D[t.a] + td(t.a), endB = D[t.b] + td(t.b);
    const sameSeg = (s.a === t.a && s.b === t.b) || (s.a === t.b && s.b === t.a);
    let points; let speeds;
    if (sameSeg) { points = [[x0, y0], [s.px, s.py], [t.px, t.py], [x1, y1]]; speeds = [0.5, 1, 0.5]; }
    else {
      let end = endA <= endB ? t.a : t.b;
      if (!isFinite(D[end])) { const L = dist(x0, y0, x1, y1); return { points: [[x0, y0], [x1, y1]], speeds: [1], length: L, cost: L * 1.5 }; }
      const chainIds = []; for (let v = end; v !== -1; v = prev[v]) chainIds.push(v);
      chainIds.reverse();
      points = [[x0, y0], [s.px, s.py], ...chainIds.map((id) => [city.nodes[id].x, city.nodes[id].y]), [t.px, t.py], [x1, y1]];
      speeds = [0.5, 1];
      for (let i = 1; i < chainIds.length; i++) {
        const a = chainIds[i - 1], b = chainIds[i];
        const link = city.adj[a].find((n) => n.to === b);
        speeds.push(link ? city.edges[link.edge].speed : 1);
      }
      speeds.push(1, 0.5);
    }
    let length = 0; for (let i = 1; i < points.length; i++) length += dist(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    const cost = sameSeg ? length : Math.min(endA, endB) + s.d + t.d;
    return { points, speeds, length, cost };
  }

  /** Edges near a point, used by road-closure events. */
  edgesNear(x, y, radius = B * 0.6) {
    return city.edges.filter((e) => {
      const A = city.nodes[e.a], Bn = city.nodes[e.b];
      return dist(x, y, (A.x + Bn.x) / 2, (A.y + Bn.y) / 2) < radius && e.kind !== 'highway';
    });
  }
}

export const STREET_WORDS = [...new Set([...NS_STREETS, ...EW_STREETS].flatMap((s) => s.toLowerCase().split(' ')))];
