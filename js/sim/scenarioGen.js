// Turns scenario templates into concrete, fully-filled call scenarios.
import { SCENARIOS, SCENARIO_BY_ID } from '../data/scenarios/index.js';
import { TYPE } from '../data/incidentTypes.js';
import { randomLocation, addressFor, B } from '../data/city.js';
import { FIRST_NAMES, LAST_NAMES, makePhone } from '../ai/dialogue.js';
import { fill, clamp } from '../core/util.js';
import { EVENT_SCENARIO_BOOST } from './cityEvents.js';

const PERSONA_BY_SEVERITY = {
  small: [['calm', 3], ['upset', 2.5], ['talkative', 2], ['helpful', 2], ['unsure', 1.5], ['elderly', 1.2], ['quiet', 1], ['confused', 0.8]],
  medium: [['worried', 3], ['calm', 2], ['helpful', 2], ['confused', 1.2], ['talkative', 1.2], ['upset', 1.2], ['panicked', 1.5], ['elderly', 0.8], ['quiet', 0.6]],
  major: [['panicked', 4], ['worried', 3], ['calm', 0.8], ['helpful', 1], ['confused', 0.6]],
};

const SEVERITY_MIX = {
  rare: { small: 0.68, medium: 0.28, major: 0.04 },
  occasional: { small: 0.58, medium: 0.32, major: 0.1 },
  frequent: { small: 0.45, medium: 0.35, major: 0.2 },
};

export function timeOfDay(minutes) {
  const h = (minutes / 60) % 24;
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function categoryOf(t) { return TYPE[t.typeId]?.category || t.category || 'service'; }

export function chooseTemplate(r, { config = {}, weather = 'clear', clock = 720, recent = [], events = [] } = {}) {
  const tod = timeOfDay(clock);
  const mix = SEVERITY_MIX[config.majorFrequency || 'occasional'];
  const cats = config.categories || {};
  const sev = config.severities || {};
  const pool = SCENARIOS.filter((t) => !t.trainingOnly && cats[categoryOf(t)] !== false && sev[t.severity] !== false && !(t.kind && t.kind !== 'emergency' && config.nonEmergency === false));
  if (!pool.length) return SCENARIOS[0];
  return r.weighted(pool, (t) => {
    let w = t.weight * (mix[t.severity] ?? 0.3) * 10;
    if (t.time) w *= t.time[tod] ?? 1;
    if (t.weather) w *= t.weather[weather] ?? (t.weatherOnly ? 0 : 1);
    if (t.event) w *= events.some((e) => e.kind === t.event) ? 6 : 0.05;
    else if (events.some((e) => EVENT_SCENARIO_BOOST[e.kind]?.includes(t.id))) w *= 3;
    if (recent.includes(t.id)) w *= 0.15; // avoid repeats
    return w;
  });
}

function evalField(v, r, vars, loc, ctx) {
  if (v == null) return v;
  if (typeof v === 'function') v = v(r, vars, loc);
  if (v == null) return v;
  if (Array.isArray(v)) return fill(v, ctx, r);
  if (typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = typeof x === 'string' || Array.isArray(x) ? fill(x, ctx, r) : x;
    return o;
  }
  if (typeof v === 'string') return v === 'unknown' ? v : fill(v, ctx, r);
  return v;
}

/** Build a concrete scenario instance (plain JSON). */
export function buildScenario(r, template, { forcedLoc } = {}) {
  const t = template;
  const loc = forcedLoc || randomLocation(r, t.zones || ['residential'], { poiKinds: t.poiKinds });
  const sex = t.callerSex || r.pick(['m', 'f']);
  const first = r.pick(FIRST_NAMES[sex]); const last = r.pick(LAST_NAMES);
  const personaPool = t.personas ? t.personas.map((p) => [p, 1]) : PERSONA_BY_SEVERITY[t.severity] || PERSONA_BY_SEVERITY.small;
  const persona = r.weighted(personaPool, (p) => p[1])[0];
  const caller = { first, last, name: `${first} ${last}`, sex, phone: makePhone(r), persona, age: persona === 'elderly' ? r.int(68, 88) : r.int(19, 64) };
  const vars = t.vars ? t.vars(r, { loc, caller }) : {};
  const ctx = { ...loc, address: loc.full, ...vars, name: caller.name, first: caller.first };
  const E = (v) => evalField(v, r, vars, loc, ctx);
  const facts = {};
  for (const [k, v] of Object.entries(t.facts || {})) { const val = E(v); if (val != null) facts[k] = val; }
  const type = TYPE[t.typeId] || TYPE.OTHER;
  const truth = t.kind && t.kind !== 'emergency' ? null : {
    typeId: t.typeId,
    needs: t.needs ? (typeof t.needs === 'function' ? t.needs(r, vars) : t.needs) : type.needs,
    workload: Math.round((t.workload || type.workload) * r.float(0.85, 1.2)),
    patients: typeof t.patients === 'function' ? t.patients(r, vars) : (t.patients || 0),
    critical: typeof t.critical === 'function' ? t.critical(r, vars) : !!t.critical,
    developments: (t.developments || []).map((d) => ({ ...d, text: E(d.text), callerLine: d.callerLine ? E(d.callerLine) : undefined })),
    sizeup: t.sizeup ? E(t.sizeup) : null,
    clearText: t.clear ? E(t.clear) : null,
  };
  const sc = {
    templateId: t.id, typeId: t.typeId, kind: t.kind || 'emergency', severity: t.severity, priority: t.priority || type.priority,
    loc, caller, vars, facts,
    nature: E(t.nature), natureShort: t.natureShort ? E(t.natureShort) : null, natureNote: t.note ? E(t.note) : null,
    opening: t.opening ? E(t.opening) : null,
    extra: r.shuffle((t.extra || []).map(E)).slice(0, 3),
    updates: (t.updates || []).map((u) => ({ ...u, line: E(u.line), note: u.note ? E(u.note) : undefined })),
    instructions: t.instructions || {}, relevant: t.relevant || null, cpr: !!t.cpr,
    revealOnOpen: t.revealOnOpen || null, endsAfter: t.endsAfter || null,
    truth, callerAtScene: t.callerAtScene !== false,
    locVague: !!t.locVague || (loc.kind === 'street' && ['confused', 'elderly'].includes(persona) && r.chance(0.2)),
    duplicateLines: t.duplicate ? t.duplicate.map(E) : null,
  };
  sc.ani = makeANI(r, sc);
  return sc;
}

export function makeANI(r, sc) {
  const kindRoll = r.next();
  const kind = kindRoll < 0.72 ? 'wireless' : kindRoll < 0.9 ? 'landline' : 'voip';
  const ani = { phone: sc.caller.phone, kind, name: kind === 'wireless' ? 'WIRELESS CALLER' : `${sc.caller.last.toUpperCase()}, ${sc.caller.first.toUpperCase()}` };
  if (kind === 'wireless') {
    const err = r.float(40, 260); const ang = r.float(0, Math.PI * 2);
    ani.x = sc.loc.x + Math.cos(ang) * err * 0.6; ani.y = sc.loc.y + Math.sin(ang) * err * 0.6; ani.radius = Math.round(err);
    const a = addressFor(ani.x, ani.y);
    ani.address = `Phase II – near ${a.kind === 'street' ? `${Math.floor(a.number / 100) * 100} blk ${a.street}` : a.full}`;
    ani.sector = `${a.district || 'Ridgeview'} sector ${r.int(1, 6)}`;
  } else {
    // landline/VoIP: registered address – matches the scene only if the caller is home
    const atHome = sc.callerAtScene && sc.loc.kind === 'street' && r.chance(0.85);
    if (atHome) { ani.x = sc.loc.x; ani.y = sc.loc.y; ani.address = sc.loc.full; }
    else {
      const x = clamp(sc.loc.x + r.float(-4, 4) * B, 0.2 * B, 13.8 * B), y = clamp(sc.loc.y + r.float(-4, 4) * B, 0.2 * B, 13.8 * B);
      const a = addressFor(x, y); ani.x = x; ani.y = y; ani.address = a.full;
    }
    ani.radius = 0;
  }
  return ani;
}

export { SCENARIOS, SCENARIO_BY_ID };
