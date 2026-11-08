// Extra CAD detail derived from existing data: jurisdiction (beat / ESN / fire & EMS
// districts), map grid and coordinates, response plan with distances, premise
// information and prior-call history, and per-unit time stamps.
//
// Everything here is computed on demand and deterministic per address, so it never
// changes the simulation or save files and stays consistent across sessions.
import { city, SCALE, miles, nearestFacility, TOWNS } from '../../data/city.js';
import { TOWNSHIPS } from './mapDetail.js';

const PD_TOWNS = { carmi: 'Carmi PD', norris: 'Norris City PD', grayville: 'Grayville PD', crossville: 'Crossville PD', enfield: 'Enfield PD' };

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function townOf(x, y) { return TOWNS.find((t) => x >= t.x0 - 40 && x <= t.x1 + 40 && y >= t.y0 - 40 && y <= t.y1 + 40) || null; }
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

/** Sheriff patrol district (matches the briefing-room whiteboard). */
function sheriffDistrict(x, y) {
  if (x < 4600 && y > 6800) return 'D2 · Norris City / Herald';
  if (x > 8300 && y < 4200) return 'D3 · Grayville / Phillipstown';
  if (x > 7400 && y >= 4200) return 'D4 · Crossville / Emma / Maunie';
  return 'D1 · Carmi / Hawthorne';
}

export function jurisdiction(x, y) {
  const t = townOf(x, y);
  const law = t && PD_TOWNS[t.id] ? PD_TOWNS[t.id] : "White County Sheriff's Office";
  let beat;
  if (t?.id === 'carmi') beat = `Carmi PD Beat ${(x < t.x ? 1 : 2) + (y < t.y ? 0 : 2)}`;
  else if (t && PD_TOWNS[t.id]) beat = `${PD_TOWNS[t.id]} – Town`;
  else beat = `WCSO ${sheriffDistrict(x, y)}`;
  const fire = nearestFacility(x, y, ['fire']); const ems = nearestFacility(x, y, ['ems']); const hosp = nearestFacility(x, y, ['hospital']);
  const lawFac = nearestFacility(x, y, law.startsWith('White') ? ['sheriff'] : ['police_hq', 'precinct']);
  const fi = city.facilities.filter((f) => f.kind === 'fire').indexOf(fire);
  const esn = 100 + Math.max(0, fi) * 10 + (law.startsWith('White') ? 1 : 0) + (t ? 0 : 5);
  const grid = `${String.fromCharCode(65 + Math.max(0, Math.min(11, Math.floor(x / 1000))))}-${1 + Math.max(0, Math.min(10, Math.floor(y / 1000)))}`;
  // Carmi city center ≈ 38.0909 N, 88.1587 W; game meters × SCALE = real meters
  const lat = 38.0909 - ((y - 6200) * SCALE) / 111320, lon = -88.1587 + ((x - 6000) * SCALE) / 87660;
  let twp = TOWNSHIPS[0]; let bd = Infinity; for (const tw of TOWNSHIPS) { const d = dist(x, y, tw[1], tw[2]); if (d < bd) { bd = d; twp = tw; } }
  const d = (f) => (f ? `${miles(dist(x, y, f.x, f.y)).toFixed(1)} mi` : '—');
  return {
    law, beat, esn, grid, lat, lon, township: twp[0].replace(' TWP', ' Township').replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase()),
    municipality: t ? t.name : 'Unincorporated White County',
    fire: fire?.name || '—', fireDist: d(fire), fireShort: fire?.short || '—',
    ems: ems?.name || '—', emsDist: d(ems), emsShort: ems?.short || '—',
    lawStation: lawFac?.name || law, lawDist: d(lawFac),
    hospital: hosp?.name || '—', hospDist: d(hosp),
  };
}

const HAZ_TOWN = ['Dog on premises – friendly', 'Dog on premises – keep gate closed', 'Oxygen in use (home medical equipment)', 'Elderly resident lives alone', 'Knox box on main entrance', 'Hydrant at the corner', 'Basement apartment', 'Solar panels on roof – shut-off at meter', 'Gated driveway – code on file', 'Wheelchair user – ramp at rear door', 'Prior weapons call – officer caution', 'Security cameras – owner cooperative'];
const HAZ_RURAL = ['Long gravel lane – use north entrance', 'Grain bins on property', 'Livestock – keep gates closed', 'LP tank (500 gal) behind house', 'No hydrant – tanker response', 'Pond on property', 'Farm equipment in drive', 'Firearms in residence (hunter)', 'Dog on premises – large breed', 'Oil well tank battery nearby – H2S'];
const PRIOR_TYPES = [['Medical – sick person', 'Transported'], ['Alarm – residential', 'False alarm'], ['Welfare check', 'Checked OK'], ['Disturbance – verbal', 'Advised / settled'], ['Traffic complaint', 'Unable to locate'], ['Animal complaint', 'Referred to Animal Ctrl'], ['Medical – fall', 'Lift assist, no transport'], ['Suspicious person', 'Gone on arrival'], ['Smoke investigation', 'Controlled burn'], ['911 hang-up', 'Callback – misdial']];

/** Premise notes and prior-call history for an address (deterministic). */
export function premise(loc) {
  const key = String(loc?.full || `${Math.round(loc?.x)},${Math.round(loc?.y)}`);
  const h = hash(key); const rural = !townOf(loc?.x ?? 0, loc?.y ?? 0);
  const pool = rural ? HAZ_RURAL : HAZ_TOWN; const n = h % 4;
  const notes = []; for (let i = 0; i < n; i++) { const p = pool[(h >>> (i * 5)) % pool.length]; if (!notes.includes(p)) notes.push(p); }
  const priors = []; const pc = (h >>> 7) % 5;
  for (let i = 0; i < pc; i++) { const [type, disp] = PRIOR_TYPES[(h >>> (i * 3 + 2)) % PRIOR_TYPES.length]; priors.push({ daysAgo: 6 + ((h >>> (i * 4)) % 340), type, disp }); }
  priors.sort((a, b) => a.daysAgo - b.daysAgo);
  const kind = loc?.poi ? loc.poiKind || 'business' : loc?.zone === 'downtown' || loc?.zone === 'commercial' ? 'Commercial' : rural ? 'Rural residence / farm' : 'Residential';
  return { notes, priors, kind: typeof kind === 'string' ? kind.charAt(0).toUpperCase() + kind.slice(1) : kind };
}

const clockDiff = (a, b) => (((b - a) % 1440) + 1440) % 1440; // minutes, handles midnight
export function fmtMin(m) { if (m == null) return '—'; const s = Math.round(m * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/** Per-unit time stamps from the incident's assignment history. */
export function unitTimes(inc) {
  const rows = new Map();
  for (const h of [...inc.unitHistory].reverse()) {
    const r = rows.get(h.unit) || { unit: h.unit, assigned: null, onScene: null, hospital: null, cleared: null };
    if (h.action === 'Assigned') { if (r.assigned == null) r.assigned = h.clock; r.cleared = null; }
    else if (h.action === 'On scene') { if (r.onScene == null) r.onScene = h.clock; }
    else if (h.action === 'At hospital') r.hospital = h.clock;
    else r.cleared = h.clock;
    rows.set(h.unit, r);
  }
  return [...rows.values()].map((r) => ({ ...r, response: r.assigned != null && r.onScene != null ? clockDiff(r.assigned, r.onScene) : null }));
}

/** Key incident intervals in game minutes. */
export function incidentTimers(inc, nowClock) {
  const ut = unitTimes(inc);
  const firstAssign = ut.reduce((m, r) => (r.assigned != null && (m == null || clockDiff(inc.createdClock, r.assigned) < clockDiff(inc.createdClock, m)) ? r.assigned : m), null);
  const firstScene = ut.reduce((m, r) => (r.onScene != null && (m == null || clockDiff(inc.createdClock, r.onScene) < clockDiff(inc.createdClock, m)) ? r.onScene : m), null);
  return {
    age: clockDiff(inc.createdClock, nowClock),
    toDispatch: firstAssign != null ? clockDiff(inc.createdClock, firstAssign) : null,
    toScene: firstScene != null ? clockDiff(inc.createdClock, firstScene) : null,
  };
}

const CARRIERS_W = ['AT&T Mobility', 'Verizon Wireless', 'T-Mobile USA', 'UScellular'];
const CARRIERS_L = ['Frontier Communications', 'Wabash Telephone Co-op', 'Spectrum (Charter)'];
/** Extra ANI/ALI fields shown on the call-taking screen. */
export function aniDetail(ani) {
  const h = hash(String(ani.phone));
  const cos = ani.kind === 'wireless' ? 'WPH2' : ani.kind === 'voip' ? 'VOIP' : (h % 5 === 0 ? 'BUSN' : 'RESD');
  const carrier = ani.kind === 'wireless' ? CARRIERS_W[h % CARRIERS_W.length] : ani.kind === 'voip' ? ['Ooma', 'Vonage', 'Spectrum Voice'][h % 3] : CARRIERS_L[h % CARRIERS_L.length];
  const j = ani.x != null ? jurisdiction(ani.x, ani.y) : null;
  return {
    cos, carrier, j,
    confidence: ani.kind === 'wireless' ? `${90}% within ±${ani.radius}m` : 'Registered address',
    psap: 'White Co 911 · PSAP 1193',
    callback: ani.phone,
    tower: ani.sector || null,
  };
}

export function latLon(j) { return `${j.lat.toFixed(5)}° N, ${Math.abs(j.lon).toFixed(5)}° W`; }
