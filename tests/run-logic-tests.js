// Headless logic tests: run with `node tests/run-logic-tests.js`
import { Sim } from '../js/sim/sim.js';
import { SCENARIOS } from '../js/data/scenarios/index.js';
import { buildScenario } from '../js/sim/scenarioGen.js';
import { understand, extractAddress } from '../js/ai/nlu.js';
import { RNG } from '../js/core/util.js';
import { TYPE } from '../js/data/incidentTypes.js';
import { bus } from '../js/core/events.js';

let pass = 0, fail = 0; const failures = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; failures.push(msg); console.log('  ✗', msg); } }
function section(name) { console.log(`\n▶ ${name}`); }
function run(sim, seconds, step = 0.25) { for (let t = 0; t < seconds; t += step) sim.update(step); }

// ---------- NLU ----------
section('NLU intent recognition');
const nluCases = [
  ['Where are you?', 'ask_location'], ["What's your location?", 'ask_location'], ['Can you tell me where this happened?', 'ask_location'],
  ['What address are you at?', 'ask_location'], ['is anyone hurt', 'ask_injuries'], ['is he breathing', 'ask_breathing'], ['help is on the way', 'reassure'],
  ['start cpr', 'instr_cpr'], ['which way did they go', 'ask_direction'], ['what kind of car', 'ask_vehicle'], ['what is your name', 'ask_name'],
  ['get out of the house now', 'instr_evac'], ['tell me what happened', 'ask_what'], ['is the guy awake', 'ask_conscious'], ['whats ur adress', 'ask_location'],
];
for (const [text, want] of nluCases) { const got = understand(text)[0]?.intent; ok(got === want, `"${text}" → ${want} (got ${got})`); }
ok(understand('where are you and is anyone hurt').map((i) => i.intent).join() === 'ask_location,ask_injuries', 'compound question splits into two intents');
ok(extractAddress('four hundred twelve elm').number === 412, 'spoken number "four hundred twelve" → 412');
ok(extractAddress('fourteen twenty three fifth street').number === 1423, 'spoken "fourteen twenty three" → 1423');

// ---------- Scenario generation ----------
section('Scenario library');
const r = new RNG(42); let built = 0; const typesSeen = new Set();
for (const t of SCENARIOS) {
  for (let i = 0; i < 4; i++) {
    try {
      const sc = buildScenario(r, t); built++; typesSeen.add(sc.typeId);
      ok(typeof sc.nature === 'string' && sc.nature.length > 5 && !sc.nature.includes('{'), `${t.id}: nature filled (${sc.nature.slice(0, 40)})`);
      ok(TYPE[sc.typeId], `${t.id}: valid incident type ${sc.typeId}`);
      for (const [k, v] of Object.entries(sc.facts)) { const s = typeof v === 'string' ? v : v.say; ok(!String(s).includes('{'), `${t.id}: fact ${k} filled`); }
      ok(sc.ani && sc.ani.phone, `${t.id}: ANI present`);
    } catch (e) { ok(false, `${t.id} threw ${e.message}`); }
  }
}
console.log(`  built ${built} scenarios from ${SCENARIOS.length} templates, ${typesSeen.size} incident types`);
ok(SCENARIOS.length >= 80, `library has 80+ templates (${SCENARIOS.length})`);

// ---------- Full call → incident → dispatch → completion ----------
section('End-to-end call workflow');
const sim = new Sim({ seed: 7, callFrequency: 'off', cityEvents: false, dynamicWeather: false, backgroundActivity: 'off' });
ok(sim.units.list.length > 100, `roster created (${sim.units.list.length} units)`);
const call = sim.calls.spawnCall({ templateId: 'fire_house' });
ok(call.status === 'ringing', 'call rings');
sim.calls.answer(call.id); run(sim, 2);
ok(call.status === 'active', 'call answered');
ok(call.transcript.some((l) => l.who === 'caller'), 'caller spoke opening line');
sim.calls.say(call.id, 'What is the address of your emergency?'); run(sim, 3);
ok(call.convo.revealed.location || call.convo.revealed.location_partial, 'caller gave location');
if (!call.convo.revealed.location) { sim.calls.say(call.id, 'What is the address?'); run(sim, 3); }
ok(call.info.location, `info panel has location (${call.info.location})`);
sim.calls.say(call.id, `So that is ${call.sc.loc.number} ${call.sc.loc.street}?`); run(sim, 3);
ok(call.verified, 'address verified by read-back');
sim.calls.say(call.id, 'Is anyone still inside the house?'); run(sim, 3);
ok(call.convo.asked.inside, 'asked about persons inside');
const before = call.transcript.length;
sim.calls.say(call.id, 'Is anyone still inside the house?'); run(sim, 3);
ok(call.transcript.length > before, 'repeated question answered (with memory)');
sim.calls.say(call.id, 'Help is on the way, stay away from the house'); run(sim, 3);
ok(call.convo.instructions.includes('reassure') && call.convo.instructions.includes('away'), 'reassure + instruction recognized');
const inc = sim.calls.createIncident(call.id, { typeId: 'FIRE_STR', priority: 1 });
ok(inc && inc.number, `incident created ${inc?.number}`);
ok(inc.locationVerified, 'incident marked location verified');
ok(['new', 'awaiting'].includes(inc.status), 'incident awaiting assignment');
const recs = sim.incidents.recommendations(inc);
ok(recs.length >= 3, `recommendations offered (${recs.map((x) => sim.units.byId(x.unit).callsign).join(', ')})`);
ok(inc.units.length === 0, 'recommendations NOT auto-applied');
// Player freedom: assign a police unit, SWAT and DEA to a fire too.
const swat = sim.units.list.find((u) => u.type === 'swat'); const dea = sim.units.list.find((u) => u.type === 'dea');
const rep = sim.units.assign([...recs.map((x) => x.unit), swat.id, dea.id], inc.id);
ok(rep.assigned.length === recs.length + 2, `all chosen units assigned incl. SWAT & DEA to a fire (${rep.assigned.length})`);
ok(inc.units.includes(swat.id) && swat.status === 'assigned', 'SWAT assigned to structure fire');
ok(sim.radio.log.some((m) => m.kind === 'dispatch' && m.incident === inc.id), 'dispatcher tone-out on radio');
run(sim, 8);
ok(sim.units.byId(recs[0].unit).status === 'responding', 'unit transitions assigned → responding');
ok(sim.radio.log.some((m) => m.unit === recs[0].unit && m.kind === 'enroute'), 'unit acknowledged on radio');
// availability rules
const rep2 = sim.units.assign([recs[0].unit], inc.id);
ok(rep2.skipped.length === 1 && /Already/.test(rep2.skipped[0].reason), 'duplicate assignment explained, not silently ignored');
const busyUnit = sim.units.list.find((u) => u.status === 'responding');
const inc2 = sim.incidents.create({ typeId: 'NOISE', location: { ...call.sc.loc } });
const rep3 = sim.units.assign([busyUnit.id], inc2.id);
ok(rep3.skipped.length === 1 && /override/.test(rep3.skipped[0].reason), 'realism blocks busy unit with a clear reason');
const rep4 = sim.units.assign([busyUnit.id], inc2.id, { override: true });
ok(rep4.assigned.length === 1 && rep4.reassigned.length === 1, 'override reassigns a busy unit');
sim.units.assign([busyUnit.id], inc.id, { override: true });
// let it play out
let arrived = false;
for (let i = 0; i < 2400 && !['completed', 'closed'].includes(inc.status); i++) { sim.update(0.5); if (inc.sim.firstArrival) arrived = true; }
ok(arrived, 'units arrived on scene');
ok(sim.radio.log.some((m) => m.incident === inc.id && m.kind === 'onscene_first'), 'first-arrival size-up on radio');
ok(inc.status === 'completed', `incident completed (status ${inc.status}, progress ${inc.sim.progress.toFixed(2)})`);
ok(call.convo.unitsArrivedSaid, 'caller noticed units arriving');
sim.incidents.close(inc);
ok(inc.status === 'closed' && inc.eval && inc.eval.total > 0, `closed with evaluation (+${inc.eval?.total} XP)`);
run(sim, 120);
ok(sim.units.byId(recs[0].unit).status !== 'on_scene', 'units cleared after completion');

// ---------- Medical with transport ----------
section('Medical call with transport to hospital');
const mcall = sim.calls.spawnCall({ templateId: 'cardiac_arrest' });
sim.calls.answer(mcall.id); run(sim, 2);
sim.calls.say(mcall.id, 'Is he breathing?'); run(sim, 3);
sim.calls.say(mcall.id, 'I am going to help you do CPR, push hard in the center of the chest'); run(sim, 3);
ok(mcall.convo.cpr, 'CPR instructions accepted');
const minc = sim.calls.createIncident(mcall.id, {});
const medics = sim.units.list.filter((u) => ['als', 'medic'].includes(u.type) && sim.units.isAssignable(u)).slice(0, 2).map((u) => u.id);
sim.units.assign(medics, minc.id);
let transported = false;
for (let i = 0; i < 2400 && minc.status !== 'completed'; i++) { sim.update(0.5); if (sim.units.list.some((u) => u.status === 'transporting')) transported = true; }
ok(transported, 'patient transported to hospital');
ok(minc.status === 'completed', `medical incident completed (${minc.status})`);
ok(minc.sim.transported >= 1, 'patient delivered');

// ---------- Wrong address ----------
section('Wrong address relocation');
const wcall = sim.calls.spawnCall({ templateId: 'mva_injury' });
sim.calls.answer(wcall.id); run(sim, 2);
const winc = sim.calls.createIncident(wcall.id, { location: '205 S Locust St' });
const wtrue = wcall.sc.loc;
const wunit = sim.units.list.find((u) => u.type === 'patrol' && sim.units.isAssignable(u));
sim.units.assign([wunit.id], winc.id);
for (let i = 0; i < 1200 && !winc.sim.firstArrival; i++) sim.update(0.5);
const far = Math.hypot(winc.location.x - wtrue.x, winc.location.y - wtrue.y);
ok(winc.sim.firstArrival && far < 5, 'unit relocated to the true scene after wrong address');

// ---------- Radio two-way ----------
section('Radio');
const someUnit = sim.units.list.find((u) => u.status === 'available');
const n0 = sim.radio.log.length;
sim.radio.playerTransmit({ unitId: someUnit.id, text: 'what is your status' }); run(sim, 6);
ok(sim.radio.log.length >= n0 + 2, 'unit replied to a status check');
const texts = new Set(sim.radio.log.filter((m) => m.kind === 'enroute').map((m) => m.text.replace(/[A-Za-z-]+ \d+/g, 'X')));
ok(texts.size >= 3, `radio phrasing varies (${texts.size} distinct en-route forms)`);

// ---------- Random busy shift ----------
section('Busy random shift (stress)');
const busy = new Sim({ seed: 99, callFrequency: 'very_busy', majorFrequency: 'frequent' });
let errors = 0; const origErr = console.error; console.error = (...a) => { errors++; origErr(...a); };
for (let i = 0; i < 3600; i++) {
  busy.update(0.5);
  const ring = busy.calls.ringing()[0];
  if (ring && !busy.calls.active()) { busy.calls.answer(ring.id); }
  const act = busy.calls.active();
  if (act && busy.t - act.answeredAt > 6 && !act.incidentId) {
    busy.calls.say(act.id, 'Where are you and what happened?');
    if (act.sc.kind === 'emergency') {
      const ii = busy.calls.createIncident(act.id, {});
      const rr = busy.incidents.recommendations(ii).map((x) => x.unit);
      busy.units.assign(rr, ii.id);
    }
    busy.calls.end(act.id);
  }
  for (const done of busy.incidents.list.filter((x) => x.status === 'completed')) busy.incidents.close(done);
}
console.error = origErr;
const rp = busy.report();
console.log(`  30 sim-min: ${rp.callsReceived} calls, ${rp.incidentsCreated} incidents, ${rp.incidentsCompleted} completed, ${rp.unitsDispatched} dispatches, ${busy.radio.log.length} radio msgs`);
ok(errors === 0, 'no runtime errors during busy shift');
ok(rp.callsReceived > 30, 'calls generated at the busy rate');
ok(rp.incidentsCompleted > 10, 'incidents resolve over the shift');
const sizes = { small: 0, medium: 0, major: 0 };
for (const c of busy.calls.list) sizes[c.sc.severity]++;
console.log('  severity mix:', JSON.stringify(sizes));

// ---------- Save / load round trip ----------
section('Save / load');
const snap = JSON.stringify(busy.serialize());
const loaded = new Sim({}, JSON.parse(snap));
ok(loaded.units.list.length === busy.units.list.length && loaded.incidents.list.length === busy.incidents.list.length, 'state restored');
let lerr = 0; console.error = () => { lerr++; };
for (let i = 0; i < 400; i++) loaded.update(0.5);
console.error = origErr;
ok(lerr === 0, 'restored sim keeps running without errors');
console.log(`  snapshot size ${(snap.length / 1024).toFixed(0)} KB`);


// ---------- Update: county map, conversations, weather, schedule, stories ----------
section('County road network & region');
{
  const C = await import('../js/data/city.js');
  const R = new C.Router();
  const grid = C.city.roads.filter((r) => r.grid).length;
  ok(grid > 100, `section-line county roads generated (${grid} runs)`);
  const bv = C.TOWNS.find((t) => t.id === 'brownsville');
  ok(bv && Math.abs(C.gameToGeo(bv.x, bv.y).lat - 38.041) < 0.01 && Math.abs(C.gameToGeo(bv.x, bv.y).lon + 88.245) < 0.01, 'Brownsville placed at its real coordinates');
  for (const t of C.TOWNS) { const rt = R.route(6000, 6200, t.x, t.y); ok(rt.points.length > 3 || t.id === 'carmi', `${t.name} reachable by road`); }
  const rr = new RNG(9); let outside = 0;
  for (let i = 0; i < 400; i++) { const l = C.randomLocation(rr, rr.pick([['residential'], ['highway'], ['rural'], ['water'], ['forest'], ['commercial']])); if (!C.insideCounty(l.x, l.y)) outside++; }
  ok(outside === 0, `generated call locations stay inside White County (${outside} outside)`);
  ok(C.OUTER_TOWNS.length >= 10 && !C.insideCounty(C.OUTER_TOWNS[0].x, C.OUTER_TOWNS[0].y), 'surrounding towns exist outside the jurisdiction');
}

section('Caller understanding (plain language)');
{
  const s2 = new Sim({ mode: 'free', seed: 11, callFrequency: 'off' });
  const call = s2.calls.spawnCall({ templateId: 'mva_rollover_ditch' }); s2.calls.answer(call.id); run(s2, 2);
  const ask = (q) => { const n = call.transcript.length; s2.calls.say(call.id, q); run(s2, 5); return call.transcript.slice(n).filter((e) => e.who === 'caller').map((e) => e.text).join(' '); };
  const bad = /what\?|what do you mean|don.t understand|didn.t get that|different way/i;
  for (const q of ['was the driver hurt?', 'is the car smoking?', 'what kind of vehicle is it', 'whos calling', 'lock your doors and wait for us', 'how is he doing now?']) ok(!bad.test(ask(q)), `natural question answered: "${q}"`);
  ok(/bleed|head|crawled/i.test(ask('is the guy bleeding')), 'keyword fallback finds the injury fact');
}

section('Weather spells');
{
  const W = await import('../js/sim/weather.js');
  ok(W.DURATIONS.rain[1] < W.DURATIONS.clear[0], 'rain spells are shorter than clear spells');
  const ws = new Sim({ mode: 'free', seed: 5, callFrequency: 'off', dynamicWeather: true, weather: 'rain' });
  let maxWet = 0, wetStart = null;
  for (let i = 0; i < 20000; i++) { ws.update(0.5); const wet = ['rain', 'thunderstorm', 'severe', 'snow'].includes(ws.weather.current()); if (wet && wetStart == null) wetStart = ws.t; if (!wet && wetStart != null) { maxWet = Math.max(maxWet, ws.t - wetStart); wetStart = null; } }
  ok(maxWet < 1500, `longest wet spell ${Math.round(maxWet)} sim-s (≈${Math.round(maxWet * 6 / 60)} game min)`);
}

section('Department schedule & leadership');
{
  const D = await import('../js/sim/department.js');
  ok(D.LEADERS.captain.name === 'Captain Nolan Drone' && D.LEADERS.watch.name === 'Watch Commander John Nolan' && D.LEADERS.fireChief.name === 'Fire Chief Bentley Allen', 'leadership names');
  const fake = { sim: busy, state: 'playing', onDepartmentEvent: (ev) => fired.push(ev) }; const fired = [];
  const sch = new D.DepartmentSchedule(fake);
  for (const k of ['rollcall', 'shift', 'training', 'meeting', 'supervisor', 'announcement', 'briefing']) { const L = sch.script(k, { id: `${k}_am`, title: k }); ok(L.length >= 1 && L.every((l) => l.text && !l.text.includes('undefined')), `${k} script (${L.length} lines)`); }
  const rc = sch.script('rollcall', { id: 'rollcall_am' });
  ok(rc.some((l) => l.who === 'captain') && rc.some((l) => l.who === 'watch'), 'roll call has the Captain and the Watch Commander speaking');
  busy.state.time.clockStart = 6 * 60 + 40 - (busy.state.time.sim * busy.state.time.clockRate) / 60; busy.paused = false;
  sch.update(); for (let i = 0; i < 200 && !fired.length; i++) { busy.update(0.5); sch.update(); }
  ok(fired.some((e) => e.kind === 'rollcall'), 'roll call fires at its scheduled time');
}

section('Stories');
{
  const { StoryTeller, STORIES } = await import('../js/ai/stories.js');
  const st = new StoryTeller(); const told = [];
  for (let i = 0; i < 12; i++) told.push(st.next('ray'));
  ok(told.every((t, i) => i === 0 || t !== told[i - 1]), 'no story repeats back-to-back');
  ok(new Set(told.slice(0, 8)).size === 8, 'eight stories in a row are all different');
  ok(Object.values(STORIES).flat().length >= 80, `story library size ${Object.values(STORIES).flat().length}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('Failures:\n - ' + failures.slice(0, 40).join('\n - ')); process.exit(1); }
bus.clear();
