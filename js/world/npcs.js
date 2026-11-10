// People of the public-safety building: dispatchers, the City Police Department, the
// Sheriff's Office and visitors. Every NPC has a role, a home position (desk/console),
// and a weighted list of things that role actually does during a shift – desk work,
// paperwork at the copier or the files, coffee and snacks, the restroom (real stalls with
// doors), visiting a supervisor, talking with a coworker, the range, investigations,
// going out on patrol and coming back. Plans are made of small steps (walk to a node, sit,
// stand facing something, open a door, talk) so behaviour is varied but believable.
//
// Drawing: realistic GPU-skinned characters (see people/): unique sculpted faces, real
// uniforms and police equipment, natural animation, expressions and lip sync, with three
// levels of detail, view/floor culling and a capped mesh cache. Devices that can't run the
// character shader fall back to the simple articulated bodies (drawNPC).
import { trs, mat4 } from '../engine/math.js';
import { STAFF } from '../ai/staffDialogue.js';
import { buildNavGraph, findPath, consoleList } from './building.js';
import { rng } from '../core/util.js';
import { bus } from '../core/events.js';

const SKIN = [[0.94, 0.78, 0.66], [0.82, 0.62, 0.46], [0.6, 0.42, 0.3], [0.42, 0.28, 0.2], [0.88, 0.7, 0.55], [0.72, 0.52, 0.38]];
const HAIR = [[0.08, 0.06, 0.05], [0.25, 0.16, 0.09], [0.55, 0.42, 0.25], [0.7, 0.7, 0.68], [0.15, 0.1, 0.08], [0.42, 0.24, 0.12]];
const OUTFIT = {
  dispatcher: { shirt: [0.13, 0.2, 0.36], pants: [0.12, 0.12, 0.14] }, supervisor: { shirt: [0.72, 0.8, 0.9], pants: [0.16, 0.17, 0.2] },
  trainer: { shirt: [0.4, 0.42, 0.45], pants: [0.2, 0.18, 0.15] }, director: { shirt: [0.2, 0.2, 0.23], pants: [0.18, 0.18, 0.2], tie: [0.45, 0.08, 0.1] },
  officer: { shirt: [0.1, 0.13, 0.22], pants: [0.08, 0.09, 0.14], duty: true }, sergeant: { shirt: [0.1, 0.13, 0.22], pants: [0.08, 0.09, 0.14], duty: true, stripes: true },
  command: { shirt: [0.82, 0.83, 0.86], pants: [0.08, 0.09, 0.14], duty: true, tie: [0.06, 0.07, 0.12] }, pdcommand: { shirt: [0.85, 0.86, 0.88], pants: [0.08, 0.09, 0.14], tie: [0.06, 0.07, 0.12], badge: true },
  detective: { shirt: [0.62, 0.66, 0.72], pants: [0.22, 0.22, 0.24], tie: [0.25, 0.12, 0.08], badge: true, jacket: [0.24, 0.24, 0.26] }, pdstaff: { shirt: [0.42, 0.5, 0.58], pants: [0.2, 0.2, 0.22] },
  deputy: { shirt: [0.52, 0.45, 0.32], pants: [0.2, 0.17, 0.12], duty: true }, sheriff: { shirt: [0.52, 0.45, 0.32], pants: [0.2, 0.17, 0.12], duty: true, tie: [0.2, 0.16, 0.1] },
  police: { shirt: [0.1, 0.13, 0.22], pants: [0.08, 0.09, 0.14], duty: true }, fire: { shirt: [0.9, 0.9, 0.88], pants: [0.1, 0.12, 0.2] }, ems: { shirt: [0.1, 0.18, 0.3], pants: [0.1, 0.12, 0.16] },
  civilian: { shirt: [0.5, 0.3, 0.25], pants: [0.25, 0.28, 0.35] },
};
const SEAT_OF = { maria: 0, tyler: 2, denise: 3, ray: 5, priya: 6 };
const CIVILIANS = [
  { name: 'Walk-in visitor', sex: 'm' }, { name: 'Walk-in visitor', sex: 'f' }, { name: 'Resident', sex: 'f' }, { name: 'Resident', sex: 'm' },
];

// Overheard chatter (shown as captions when you're close).
const CHAT = {
  _: ['Did you see the board this morning?', 'Coffee\'s fresh, by the way.', 'Long shift. Halfway there.', 'Are you going to the potluck?', 'The radio\'s been busy today.', 'My kid has a game tonight, hoping to get out on time.', 'Ha – that\'s exactly what I said.', 'Can you believe this weather?'],
  officer: ['Two more catalytic converters overnight. Same pickup again, I bet.', 'That crash on IL-14 yesterday – dispatch had fire rolling before I even got there.', 'I\'ve got a stack of reports to finish before end of shift.', 'You taking Beat 2 today? I had it all week.', 'Range qual is Friday, right?', 'Somebody keeps parking in the sergeant\'s spot.', 'Did you hear about the bull on IL-1 again?'],
  detective: ['The pawn shop finally sent over their records.', 'I need the search warrant signed before noon.', 'Same MO as the burglary in Norris City last month.', 'Lab says two weeks on the prints.', 'Let\'s re-interview the neighbor – her timeline doesn\'t add up.'],
  command: ['Staffing\'s thin on nights next week. We need to fix that.', 'The council wants the quarterly numbers Friday.', 'Good work on that pursuit – by the book.', 'Let\'s get everybody through de-escalation training this month.'],
  dispatcher: ['Line three was a pocket dial again.', 'Can you cover my console for five?', 'That caller was so calm, it was amazing.', 'Grayville\'s busy tonight.'],
  pdstaff: ['The copier is jammed again.', 'Records request from the insurance company – third one today.', 'Somebody left a lost wallet at the front desk.', 'Payroll closes Thursday, don\'t forget your timesheet.'],
  deputy: ['Civil process run out to Crossville after lunch.', 'Jail transport at two.', 'Deer everywhere on the river-bottom roads last night.', 'Court security\'s light today, the judge is out.'],
};

export class NPCManager {
  constructor(world, { count = 'full', extraStaff = true, nav = null } = {}) {
    this.world = world; this.nodes = buildNavGraph(nav); this.byId = new Map(this.nodes.map((n) => [n.id, n])); this.npcs = []; this.talkingTo = null;
    this.consoles = consoleList(); this.nav = nav || { stalls: [] }; this.reserved = new Map(); this.time = 0; this.captionCd = 0;
    this.addStallNodes();
    const resident = STAFF.filter((s) => s.kind !== 'visitor' && (extraStaff || !s.extra));
    const LOW = ['maria', 'tyler', 'karen', 'helen', 'watch', 'captain', 'jake', 'ramsey', 'danny', 'calloway', 'vaughn', 'pdchief'];
    const roster = count === 'low' ? resident.filter((s) => LOW.includes(s.id)) : resident;
    for (const s of roster) this.spawn(s);
    // a couple of officers and deputies start out on patrol
    for (const id of ['tate', 'hensley']) { const n = this.npc(id); if (n) this.sendAway(n, 60 + Math.random() * 120); }
    this.visitorPool = STAFF.filter((s) => s.kind === 'visitor');
    this.allowVisitors = count !== 'low';
    this.nextVisitor = 20 + Math.random() * 40; this.nextCivilian = 25 + Math.random() * 40;
    this.people = world.people || null; this.pendingDt = 0;
    // lip sync: whenever the game speaks a line for someone in the building, their mouth moves with it
    this.offSpeech = bus.on('speech:start', (item) => { const key = item?.opts?.key; const n = key && this.npc(key); if (n) this.say(key, item.text, item.opts.rate || 1); });
  }

  /** Detach from the event bus and free per-person data (the manager is rebuilt on preset changes). */
  dispose() { this.offSpeech?.(); if (this.people) for (const n of this.npcs) this.people.release(n); }

  /** Make an NPC's mouth (and gestures) follow a spoken line. */
  say(id, text, rate = 1) {
    const n = this.npc(id); if (!n || !this.people) return;
    const st = n.look?.st; if (st?.speech && st.speech.text === String(text)) return; // already saying it
    this.people.say(n, text, rate);
  }

  npc(id) { return this.npcs.find((n) => n.id === id); }
  node(id) { return this.byId.get(id); }

  /** Sheriff's restroom stalls get nav nodes at runtime (the PD's are built with the PD). */
  addStallNodes() {
    for (const st of this.nav.stalls || []) {
      if (!st.id.startsWith('so_')) continue;
      const g = st.gender; const out = `n_${st.id}_out`, inn = `n_${st.id}`;
      if (this.byId.has(inn)) continue;
      const a = { id: out, x: st.door[0], z: st.door[1], y: 0, links: [] }, b = { id: inn, x: st.x, z: st.z, y: 0, links: [], face: Math.PI, stall: st.id };
      this.nodes.push(a, b); this.byId.set(out, a); this.byId.set(inn, b);
      const hub = this.byId.get(g === 'm' ? 'rest_m' : 'rest_w'); a.links.push(inn, hub.id); b.links.push(out); hub.links.push(out);
    }
    this.nodes._byId = this.byId;
  }

  spawn(s, atNode) {
    const r = Math.abs([...(s.id || s.name)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const kind = s.kind === 'visitor' ? s.dept : s.kind;
    const outfit = OUTFIT[kind] || OUTFIT.dispatcher;
    const npc = { ...s, skin: SKIN[r % SKIN.length], hair: HAIR[(r >> 3) % HAIR.length], outfit, shirt: outfit.shirt, pants: outfit.pants,
      x: 0, z: 0, y: 0, yaw: 0, state: 'idle', path: [], queue: [], timer: 2 + Math.random() * 6, phase: Math.random() * 6, speed: 1.1 + Math.random() * 0.25,
      home: null, sitting: false, typing: 0, anim: 'idle', hairLong: s.sex === 'f' && r % 3 !== 0, hairStyle: s.sex === 'f' ? ['bun', 'long', 'bob'][r % 3] : ['short', 'short', 'buzz', 'bald'][(r >> 2) % 4], glasses: r % 5 === 0, height: s.sex === 'f' ? 0.95 + (r % 7) * 0.008 : 1.0 + (r % 9) * 0.008, bulk: 0.95 + (r % 5) * 0.03 };
    if (SEAT_OF[s.id] != null) { npc.home = `seat_${SEAT_OF[s.id]}`; npc.consoleIndex = SEAT_OF[s.id]; }
    else if (s.kind === 'supervisor') npc.home = 'sup_desk';
    else if (s.kind === 'director') npc.home = 'dir_desk';
    else if (s.kind === 'trainer') npc.home = 'front_0';
    else npc.home = s.home && this.byId.has(s.home) ? s.home : null;
    if (!npc.home) npc.home = { officer: 'p_br_mid', deputy: 'brief_room', sergeant: 'p_sgt_d1' }[s.kind] || 'br_chat1';
    const start = this.node(atNode || npc.home) || this.nodes[0];
    npc.x = start.x; npc.z = start.z; npc.y = start.y || 0; npc.at = start.id;
    if (!atNode) this.settleAt(npc, start);
    this.npcs.push(npc);
    return npc;
  }

  // ---------------------------------------------------------------- positions & poses
  /** Put the NPC into the pose a node asks for (sit at a chair, face a counter…). */
  settleAt(npc, n) {
    npc.at = n.id;
    if (npc.consoleIndex != null && n.id === npc.home) { const c = this.consoles[npc.consoleIndex]; npc.x = c.x; npc.z = c.z + 0.78; npc.yaw = 0; npc.sitting = true; npc.state = 'sit'; npc.anim = 'type'; this.reserve(n.id, npc); return; }
    if (n.id === 'sup_desk') { npc.x = 0; npc.z = 14.75; npc.yaw = 0; npc.sitting = true; npc.state = 'sit'; npc.anim = 'type'; return; }
    if (n.id === 'dir_desk') { npc.x = 9.3; npc.z = 14.85; npc.yaw = 0; npc.sitting = true; npc.state = 'sit'; npc.anim = 'type'; return; }
    if (n.id === 'sheriff_desk') { npc.x = -26; npc.z = 3.6; npc.yaw = Math.PI; npc.sitting = true; npc.state = 'sit'; npc.anim = 'type'; return; }
    if (n.id.startsWith('brief_seat')) { npc.sitting = true; npc.state = 'sit'; npc.yaw = Math.PI / 2; npc.x = n.x; npc.z = n.z; return; }
    if (n.id === 'couch' || n.id === 'seatT1' || n.id === 'seatT2') { npc.sitting = true; npc.state = 'sit'; npc.yaw = 0; npc.x = n.x; npc.z = n.id === 'couch' ? 17.35 : 14.55; return; }
    if (n.sit != null) { npc.sitting = true; npc.state = 'sit'; npc.yaw = n.sit; npc.x = n.x; npc.z = n.z; npc.y = n.y || 0; this.reserve(n.id, npc); return; }
    npc.sitting = false; npc.state = 'idle';
    if (n.face != null) npc.yaw = n.face;
    else if (n.id === 'coffee') npc.yaw = Math.PI / 2;
    else if (n.id === 'brief_podium') npc.yaw = -Math.PI / 2;
    else if (n.id.startsWith('range_')) npc.yaw = 0;
  }

  reserve(id, npc) { for (const [k, v] of this.reserved) if (v === npc.id) this.reserved.delete(k); if (id) this.reserved.set(id, npc.id); }
  free(id) { const who = this.reserved.get(id); return !who || !this.npcs.some((n) => n.id === who && !n.away); }
  playerNear(n) { const p = this.world.player; return p.seated && Math.hypot(p.pos[0] - n.x, p.pos[2] - n.z) < 0.6; }

  nearestNode(x, z, y = 0, prefer) {
    if (prefer && this.byId.has(prefer)) return this.byId.get(prefer);
    let best = this.nodes[0], bd = Infinity;
    for (const n of this.nodes) { if (n.outside) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2 + ((n.y || 0) - y) ** 2 * 4; if (d < bd) { bd = d; best = n; } }
    return best;
  }

  goTo(npc, target) {
    const from = npc.at && this.byId.has(npc.at) ? this.byId.get(npc.at) : this.nearestNode(npc.x, npc.z, npc.y);
    const path = findPath(this.nodes, from.id, target);
    if (!path) return false;
    if (path.length && path[0].id === from.id && (Math.hypot(path[0].x - npc.x, path[0].z - npc.z) < 0.05)) path.shift();
    npc.path = path; npc.sitting = false; npc.state = 'walk'; npc.dest = target; npc.anim = 'walk'; npc.at = null;
    this.reserve(null, npc);
    return true;
  }

  // ---------------------------------------------------------------- plans
  /** Queue a plan: steps are {go}, {wait,dur,anim}, {door,id,open}, {fn}. */
  plan(npc, steps) { npc.queue = steps.filter(Boolean); npc.timer = 0; }

  sendAway(npc, secs) { npc.away = true; npc.awayFor = secs; npc.state = 'away'; npc.sitting = false; npc.queue = []; npc.path = []; this.reserve(null, npc); }

  restroomPlan(npc) {
    const lv = (npc.y || 0) > 2 ? 1 : 0; const inPD = npc.z < -7.6 && npc.x > -12.2;
    const g = npc.sex === 'f' ? 'w' : 'm';
    if (inPD && lv === 1) return [{ go: 'p2_ws_door' }, { go: 'p2_ws_in' }, { wait: 25 + Math.random() * 20, anim: 'idle' }, { go: 'p2_ws_door' }];
    const pool = (this.nav.stalls || []).filter((s) => s.gender === g && (inPD ? s.id.startsWith('pd_') : s.id.startsWith('so_')));
    // men sometimes use a urinal
    if (g === 'm' && inPD && Math.random() < 0.55) { const u = ['p_rrm_uri0', 'p_rrm_uri1'].find((id) => this.free(id)); if (u) return [{ go: u, reserve: u }, { wait: 14 + Math.random() * 8, anim: 'idle' }, { go: 'p_rrm_sink' }, { wait: 6, anim: 'wash' }]; }
    const st = pool.find((s) => this.free(this.stallNode(s)) && !this.world.doors?.byId[s.id]?.users.size);
    if (!st) return [{ go: inPD ? `p_rr${g}_sink` : g === 'm' ? 'rest_m' : 'rest_w' }, { wait: 8, anim: 'wash' }];
    const inn = this.stallNode(st), out = `${inn}_out`;
    const sink = inPD ? `p_rr${g}_sink` : g === 'm' ? 'rest_m' : 'rest_w';
    return [{ go: out }, { door: st.id, open: true }, { wait: 0.6 }, { go: inn, reserve: inn, stallIn: st.id }, { door: st.id, open: false }, { wait: 30 + Math.random() * 30, anim: 'idle' }, { door: st.id, open: true }, { wait: 0.6 }, { go: out, stallOut: st.id }, { door: st.id, open: false }, { go: sink }, { wait: 7, anim: 'wash' }];
  }
  stallNode(st) { return st.id.startsWith('pd_stall_') ? `p_st${st.id.slice(9)}` : `n_${st.id}`; }

  breakPlan(npc) {
    const inPD = npc.z < -7.6 && npc.x > -12.2;
    if (inPD || npc.dept === 'police') {
      const opts = [
        () => [{ go: 'p_br_coffee' }, { wait: 9, anim: 'pour' }, ...this.sitSomewhere(['p_br_t0', 'p_br_t1', 'p_br_t2', 'p_br_t3', 'p_br_t4', 'p_br_t5', 'p_br_r0', 'p_br_r1', 'p_br_r2', 'p_br_r3', 'p_br_sofa'], 25 + Math.random() * 40, 'drink')],
        () => [{ go: 'p_br_fridge' }, { door: 'pd_fridge', open: true }, { wait: 4, anim: 'reach' }, { door: 'pd_fridge', open: false }, { go: 'p_br_micro' }, { wait: 10, anim: 'idle' }, ...this.sitSomewhere(['p_br_t0', 'p_br_t1', 'p_br_t2', 'p_br_t3', 'p_br_r0', 'p_br_r1'], 40 + Math.random() * 40, 'eat')],
        () => [{ go: Math.random() < 0.5 ? 'p_br_vend' : 'p_br_vend2' }, { wait: 6, anim: 'reach' }, { go: 'p_br_chat' }, { wait: 12, anim: 'drink' }],
        () => [{ go: 'p_br_sofa', reserve: 'p_br_sofa' }, { wait: 40 + Math.random() * 30, anim: 'idle' }],
      ];
      return rng.pick(opts)();
    }
    return [{ go: rng.pick(['coffee', 'coffee', 'fridge', 'vending']) }, { wait: 8, anim: 'pour' }, ...this.sitSomewhere(['br_table', 'seatT1', 'seatT2', 'couch', 'br_chat1', 'br_chat2'], 20 + Math.random() * 40, 'drink')];
  }

  sitSomewhere(ids, dur, anim = 'idle') {
    const free = ids.filter((id) => this.byId.has(id) && this.free(id));
    if (!free.length) return [{ wait: dur * 0.4, anim }];
    const id = rng.pick(free); return [{ go: id, reserve: id }, { wait: dur, anim }];
  }

  /** Walk over to another NPC and talk for a bit (they stop and talk back). */
  chatPlan(npc) {
    const sameArea = this.npcs.filter((o) => o !== npc && !o.away && !o.event && o.state !== 'walk' && !o.chatting && Math.abs((o.y || 0) - (npc.y || 0)) < 1.5 && Math.hypot(o.x - npc.x, o.z - npc.z) < 26 && o.kind !== 'civilian');
    if (!sameArea.length) return null;
    const o = rng.pick(sameArea); const at = this.nearestNode(o.x, o.z, o.y || 0);
    const near = at.links.map((id) => this.byId.get(id)).filter((n) => n && !n.sit && !n.stall && Math.abs((n.y || 0) - (o.y || 0)) < 0.5).sort((a, b) => Math.hypot(a.x - o.x, a.z - o.z) - Math.hypot(b.x - o.x, b.z - o.z))[0] || at;
    const dur = 14 + Math.random() * 16;
    return [{ go: near.id }, { chat: o.id, dur }];
  }

  workPlan(npc, dur = 50 + Math.random() * 90) { return [{ go: npc.home }, { wait: dur, anim: npc.consoleIndex != null || /desk|_d\d|seat_/.test(npc.home) ? 'type' : 'idle' }]; }

  /** Pick the next thing to do from the role's weighted menu. */
  decide(npc) {
    const r = npc.kind; const hr = (this.world.game.sim?.clock?.() ?? 600) / 60; const lunch = hr > 11.3 && hr < 13.2 ? 2 : 1;
    const W = (list) => { const tot = list.reduce((a, b) => a + b[0], 0); let x = Math.random() * tot; for (const [w, f] of list) { x -= w; if (x <= 0) return f(); } return list[0][1](); };
    let steps = null;
    const visitSup = (ids) => { const id = rng.pick(ids.filter((i) => this.byId.has(i))); return id ? [{ go: id }, { wait: 12 + Math.random() * 12, anim: 'talk' }] : null; };
    const look = (ids, anim = 'point', d = 18) => { const id = rng.pick(ids.filter((i) => this.byId.has(i) && this.free(i))); return id ? [{ go: id, reserve: id }, { wait: d + Math.random() * 14, anim }] : null; };
    switch (r) {
      case 'dispatcher': steps = W([[70, () => this.workPlan(npc, 60 + Math.random() * 120)], [10 * lunch, () => this.breakPlan(npc)], [6, () => this.restroomPlan(npc)], [6, () => this.chatPlan(npc)], [3, () => look(['front_5.6', 'front_-5.6', 'mid_0'], 'idle', 6)]]); break;
      case 'supervisor': steps = W([[45, () => this.workPlan(npc)], [30, () => look(['ap_0', 'ap_1', 'ap_2', 'ap_3', 'ap_4', 'ap_5', 'ap_6', 'ap_7', 'front_0'], 'talk', 8)], [8, () => this.breakPlan(npc)], [4, () => this.restroomPlan(npc)], [6, () => visitSup(['p_wc_visit'])], [6, () => this.chatPlan(npc)]]); break;
      case 'director': steps = W([[60, () => this.workPlan(npc)], [12, () => look(['front_0', 'mid_0'], 'idle', 8)], [8, () => this.breakPlan(npc)], [6, () => visitSup(['p2_chief_g0', 'p2_ac_g'])], [4, () => this.restroomPlan(npc)]]); break;
      case 'trainer': steps = W([[40, () => look(['ap_0', 'ap_2', 'ap_3', 'ap_5', 'ap_6', 'front_-11', 'back_11'], 'talk', 8)], [15, () => this.breakPlan(npc)], [10, () => look(['p2_tr_front'], 'point', 20)], [10, () => this.chatPlan(npc)], [5, () => this.restroomPlan(npc)]]); break;
      case 'pdcommand': steps = W([[55, () => this.workPlan(npc)], [10, () => visitSup(npc.id === 'pdchief' ? ['p2_cap_g', 'p2_ac_g', 'p2_ea_desk'] : ['p2_chief_g1', 'p2_cap_g'])], [8, () => this.sitSomewhere(['p2_conf_s0', 'p2_conf_s1', 'p2_conf_s2', 'p2_conf_s3', 'p2_conf_s5'], 40, 'talk')], [5, () => this.breakPlan(npc)], [5, () => this.restroomPlan(npc)], [4, () => look(['p_wc_visit', 'front_0', 'p_lob_mid'], 'talk', 10)], [5, () => this.chatPlan(npc)]]); break;
      case 'command': steps = npc.id === 'watch'
        ? W([[40, () => this.workPlan(npc)], [12, () => visitSup(['p_sgt_mid', 'sup_desk', 'p_lob_desk'])], [10, () => look(['p_rc_podium', 'p_gun_rack', 'p_c3'], 'idle', 10)], [8, () => this.breakPlan(npc)], [8, () => this.chatPlan(npc)], [5, () => this.restroomPlan(npc)], [6, () => look(['front_0', 'mid_0'], 'talk', 10)]])
        : W([[50, () => this.workPlan(npc)], [12, () => visitSup(['p_wc_visit', 'p2_chief_g0', 'p2_ds_visit'])], [8, () => this.sitSomewhere(['p2_conf_s0', 'p2_conf_s4'], 30, 'talk')], [8, () => this.breakPlan(npc)], [6, () => this.chatPlan(npc)], [5, () => this.restroomPlan(npc)]]); break;
      case 'sergeant': steps = W([[35, () => this.workPlan(npc)], [12, () => visitSup(['p_wc_visit'])], [10, () => look(['p_gun_rack', 'p_gun_bench'], 'reach', 10)], [10, () => this.sitSomewhere(['p_rc_seat0', 'p_rc_seat4', 'p_rc_seat10'], 30, 'write')], [8, () => this.breakPlan(npc)], [8, () => this.chatPlan(npc)], [5, () => this.restroomPlan(npc)], [7, () => this.patrolPlan(npc, 120)]]); break;
      case 'officer': steps = W([[30, () => this.patrolPlan(npc)], [16, () => this.sitSomewhere(['p_rc_seat0', 'p_rc_seat1', 'p_rc_seat2', 'p_rc_seat3', 'p_rc_seat5', 'p_rc_seat6', 'p_rc_seat7', 'p_rc_seat8'], 50 + Math.random() * 50, 'write')], [14 * lunch, () => this.breakPlan(npc)], [8, () => look(['p_gun_rack', 'p_gun_bench'], 'reach', 8)], [6, () => look([`p_rr${npc.sex === 'f' ? 'w' : 'm'}_lock`], 'reach', 12)], [10, () => this.chatPlan(npc)], [5, () => this.restroomPlan(npc)], [5, () => visitSup(['p_sgt_mid', 'p_wc_visit'])], [4, () => look(['p_ev_counter'], 'write', 12)], [4, () => this.rangePlan(npc)]]); break;
      case 'detective': steps = W([[40, () => this.workPlan(npc)], [14, () => look(['p2_cid_board', 'p2_ir1_board', 'p2_mc_wall', 'p_inv_board'], 'point', 22)], [8, () => this.sitSomewhere(['p_iv1_seat', 'p_iv2_seat', 'p_obs_seat'], 40, 'talk')], [6, () => look(['p_ev_counter', 'p_ev_rows'], 'write', 14)], [6, () => look(['p_rec_files', 'p_rec_copier'], 'write', 10)], [6, () => this.sitSomewhere(['p2_mc_s0', 'p2_mc_s1', 'p2_mc_s2', 'p2_mc_s3'], 40, 'write')], [8, () => this.breakPlan(npc)], [6, () => this.chatPlan(npc)], [5, () => this.restroomPlan(npc)]]); break;
      case 'pdstaff': steps = npc.id === 'danny'
        ? W([[70, () => this.workPlan(npc)], [6, () => look(['p_lob_desk', 'p_lob_kiosk'], 'talk', 10)], [8, () => this.breakPlan(npc)], [5, () => this.restroomPlan(npc)], [6, () => look(['p_rec_copier', 'p_rec_files'], 'write', 8)]])
        : npc.id === 'garrity'
          ? W([[40, () => look(['p_ev_counter'], 'write', 40)], [20, () => look(['p_ev_rows', 'p_ev_rows2'], 'reach', 24)], [10, () => look(['p_inv'], 'write', 30)], [10, () => this.breakPlan(npc)], [5, () => this.restroomPlan(npc)], [8, () => this.chatPlan(npc)]])
          : W([[55, () => this.workPlan(npc)], [14, () => look(['p_rec_files', 'p_rec_copier', 'p2_adm_copier'], 'write', 12)], [10, () => this.breakPlan(npc)], [6, () => this.restroomPlan(npc)], [8, () => this.chatPlan(npc)]]); break;
      case 'sheriff': steps = W([[50, () => this.workPlan(npc)], [12, () => look(['brief_podium', 'armory_mid', 'locker_rm'], 'talk', 12)], [8, () => look(['front_0', 'sup_desk'], 'talk', 10)], [8, () => this.breakPlan(npc)], [5, () => this.restroomPlan(npc)], [6, () => this.chatPlan(npc)]]); break;
      case 'deputy': steps = npc.id === 'hale'
        ? W([[40, () => look(['armory_mid', 'armory_n'], 'reach', 30)], [25, () => look(['range_line'], 'idle', 30)], [10, () => this.breakPlan(npc)], [8, () => this.chatPlan(npc)], [5, () => this.restroomPlan(npc)]])
        : W([[30, () => this.patrolPlan(npc)], [14, () => this.sitSomewhere(['brief_seat1', 'brief_seat2', 'brief_seat3', 'brief_seat4'], 50, 'write')], [10, () => look(['armory_mid', 'locker_rm'], 'reach', 12)], [12, () => this.breakPlan(npc)], [10, () => this.chatPlan(npc)], [5, () => this.restroomPlan(npc)], [6, () => this.rangePlan(npc)]]); break;
      default: steps = this.workPlan(npc);
    }
    return steps || this.workPlan(npc, 20);
  }

  /** Out to a patrol car through the lobby (or the sally port for deputies), away for a while, then back. */
  patrolPlan(npc, minAway = 150) {
    const sheriff = npc.kind === 'deputy';
    const out = sheriff ? ['garage'] : ['p_lob_out', 'p_lot1'];
    return [{ go: sheriff ? 'locker_rm' : `p_rr${npc.sex === 'f' ? 'w' : 'm'}_lock` }, { wait: 6, anim: 'reach' }, ...out.map((id) => ({ go: id })), { fn: () => this.sendAway(npc, minAway + Math.random() * 240) }];
  }

  rangePlan(npc) {
    const lanes = [0, 1, 2, 3, 4, 5].map((i) => `range_l${i}`).filter((id) => this.free(id));
    if (!lanes.length) return null;
    const lane = rng.pick(lanes); const via = npc.dept === 'police' && npc.kind !== 'deputy' ? ['p_gun_rack', 'p_range_in'] : ['armory_mid'];
    return [...via.map((id) => ({ go: id })), { wait: 4, anim: 'reach' }, { go: lane, reserve: lane }, { wait: 40 + Math.random() * 30, anim: 'aim' }];
  }

  // ---------------------------------------------------------------- update
  update(dt, player) {
    this.time += dt; this.pendingDt += dt;
    if (this.allowVisitors) {
      this.nextVisitor -= dt;
      const present = this.npcs.filter((n) => n.kind === 'visitor');
      if (this.nextVisitor <= 0) {
        this.nextVisitor = 60 + Math.random() * 90;
        const avail = this.visitorPool.filter((v) => !present.some((p) => p.id === v.id));
        if (avail.length && present.length < 2) { const v = this.spawn(avail[Math.floor(Math.random() * avail.length)], 'dE_out'); v.leaveAt = 90 + Math.random() * 120; this.plan(v, [{ go: 'coffee' }, { wait: 12, anim: 'drink' }, ...this.sitSomewhere(['br_table', 'seatT1', 'couch'], 40, 'drink'), { go: 'dE_out' }, { fn: () => this.remove(v) }]); }
      }
      // walk-in members of the public come to the front desk, then wait in the lobby
      this.nextCivilian -= dt;
      if (this.nextCivilian <= 0) {
        this.nextCivilian = 70 + Math.random() * 110;
        if (this.npcs.filter((n) => n.kind === 'civilian').length < 2) {
          const c = rng.pick(CIVILIANS); const id = `civ_${Math.floor(this.time)}`; const shirt = [[0.5, 0.3, 0.25], [0.2, 0.35, 0.3], [0.6, 0.55, 0.4], [0.3, 0.3, 0.45]][Math.floor(Math.random() * 4)];
          const mood = rng.pick(['worried', 'worried', 'upset', 'confused', 'calm', 'calm', 'sad', 'frightened', 'pain']);
          const v = this.spawn({ id, name: c.name, role: 'Member of the public', sex: c.sex, kind: 'civilian', pitch: 1, rate: 1, mood }, 'p_lot1'); v.shirt = shirt;
          this.plan(v, [{ go: 'p_lob_in' }, { go: 'p_lob_desk' }, { wait: 18 + Math.random() * 14, anim: 'talk' }, ...(Math.random() < 0.6 ? this.sitSomewhere(['p_wait0', 'p_wait1', 'p_wait2', 'p_wait3'], 30 + Math.random() * 40, 'idle') : [{ go: 'p_lob_kiosk' }, { wait: 20, anim: 'type' }]), { go: 'p_lob_out' }, { go: 'p_lot1' }, { fn: () => this.remove(v) }]);
        }
      }
    }
    for (const npc of this.npcs.slice()) this.updateNPC(npc, dt, player);
    // overheard conversation captions
    this.captionCd -= dt;
    if (this.captionCd <= 0) { this.captionCd = 3.5; this.overhear(player); }
  }

  remove(npc) { const i = this.npcs.indexOf(npc); if (i >= 0) this.npcs.splice(i, 1); this.reserve(null, npc); this.people?.release(npc); }

  updateNPC(npc, dt, player) {
    npc.phase += dt;
    if (npc.away) { npc.awayFor -= dt; if (npc.awayFor <= 0 && !npc.event) this.returnFromAway(npc); return; }
    const talking = this.talkingTo === npc.id;
    if (talking) {
      const want = Math.atan2(-(player.pos[0] - npc.x), -(player.pos[2] - npc.z));
      if (!npc.sitting) npc.yaw = lerpAngle(npc.yaw, want, Math.min(1, dt * 5)); else npc.headYaw = clampAngle(want - npc.yaw, 1.0);
      npc.state = npc.sitting ? 'sit' : 'talk'; npc.anim = 'talk';
      return;
    }
    npc.headYaw = (npc.headYaw || 0) * 0.92;
    if (npc.chatWith) { // being talked to by another NPC: face them
      const o = this.npc(npc.chatWith); npc.chatT -= dt;
      if (!o || npc.chatT <= 0) { npc.chatWith = null; npc.chatting = false; npc.anim = npc.sitting ? 'type' : 'idle'; }
      else { const want = Math.atan2(-(o.x - npc.x), -(o.z - npc.z)); if (!npc.sitting) npc.yaw = lerpAngle(npc.yaw, want, Math.min(1, dt * 4)); else npc.headYaw = clampAngle(want - npc.yaw, 1.1); npc.anim = 'talk'; return; }
    }
    if (npc.state === 'walk') { this.walk(npc, dt); return; }
    // working through the plan
    npc.timer -= dt;
    if (npc.timer > 0) return;
    if (!npc.queue.length) { if (npc.event && !npc.eventDone) { npc.timer = 2; return; } npc.queue = this.decide(npc); }
    const st = npc.queue.shift(); if (!st) { npc.timer = 3; return; }
    if (st.go) {
      if (st.reserve && !this.free(st.reserve) && this.reserved.get(st.reserve) !== npc.id) { npc.queue = []; npc.timer = 1; return; } // someone took the seat
      if (st.reserve) this.reserved.set(st.reserve, npc.id);
      if (st.stallIn) { const d = this.world.doors?.byId[st.stallIn]; d?.users.add(npc.id); }
      if (st.stallOut) { const d = this.world.doors?.byId[st.stallOut]; d?.users.delete(npc.id); }
      if (npc.at === st.go) { this.settleAt(npc, this.byId.get(st.go)); npc.timer = 0.1; return; }
      if (!this.goTo(npc, st.go)) { npc.queue = []; npc.timer = 2; }
      if (st.reserve) this.reserved.set(st.reserve, npc.id);
      return;
    }
    if (st.wait != null) { npc.timer = st.wait; npc.anim = st.anim || (npc.sitting ? 'type' : 'idle'); return; }
    if (st.door) { if (st.open) this.world.doors?.set(st.door, true); else this.world.doors?.set(st.door, false); npc.timer = 0.4; return; }
    if (st.chat) {
      const o = this.npc(st.chat);
      if (o && !o.away && !o.chatWith && !o.event && this.talkingTo !== o.id) { o.chatWith = npc.id; o.chatT = st.dur; o.chatting = true; npc.chatting = true; npc.chatWith = o.id; npc.chatT = st.dur; npc.anim = 'talk'; npc.timer = st.dur; setTimeout(() => { npc.chatting = false; }, st.dur * 1000); }
      else npc.timer = 1;
      return;
    }
    if (st.fn) { st.fn(); npc.timer = 0.2; }
  }

  walk(npc, dt) {
    const next = npc.path[0];
    if (!next) { this.arrive(npc); return; }
    const dx = next.x - npc.x, dz = next.z - npc.z, dy = (next.y || 0) - (npc.y || 0); const d = Math.hypot(dx, dz);
    const step = npc.speed * dt * (Math.abs(dy) > 0.05 ? 0.75 : 1);
    if (d <= step) { npc.x = next.x; npc.z = next.z; npc.y = next.y || 0; npc.path.shift(); }
    else { const k = step / d; npc.x += dx * k; npc.z += dz * k; npc.y = (npc.y || 0) + dy * k; }
    const want = Math.atan2(-dx, -dz);
    if (d > 0.01) npc.yaw = lerpAngle(npc.yaw, want, Math.min(1, dt * 8));
  }

  arrive(npc) {
    npc.state = 'idle'; npc.anim = 'idle';
    const n = this.byId.get(npc.dest);
    if (n) this.settleAt(npc, n);
    npc.timer = 0.15;
  }

  returnFromAway(npc) {
    npc.away = false; const sheriff = npc.kind === 'deputy';
    const start = this.byId.get(sheriff ? 'garage' : 'p_lot1'); npc.x = start.x; npc.z = start.z; npc.y = 0; npc.at = start.id; npc.state = 'idle';
    this.plan(npc, sheriff ? [{ go: 'locker_rm' }, { wait: 8, anim: 'reach' }] : [{ go: 'p_lob_in' }, { go: `p_rr${npc.sex === 'f' ? 'w' : 'm'}_lock` }, { wait: 8, anim: 'reach' }, ...this.sitSomewhere(['p_rc_seat2', 'p_rc_seat6', 'p_rc_seat9', 'p_rc_seat12'], 50, 'write')]);
  }

  overhear(player) {
    const hud = this.world.game.hud; if (!hud?.caption || this.world.game.cad?.open) return;
    const p = player.pos; const feet = player.feet;
    const chatter = this.npcs.filter((n) => n.chatWith && !n.away && Math.abs((n.y || 0) - feet) < 1.6 && Math.hypot(n.x - p[0], n.z - p[2]) < 6.5);
    if (!chatter.length) return;
    const n = rng.pick(chatter); const pool = CHAT[n.kind === 'sergeant' ? 'officer' : n.kind === 'pdcommand' ? 'command' : n.kind] || CHAT._;
    const line = rng.pick(Math.random() < 0.3 ? CHAT._ : pool);
    hud.caption(n.name, line); this.say(n.id, line);
    if (/^Ha|exactly/.test(line)) { const o = this.npc(n.chatWith); if (o) o.laugh = true; n.laugh = true; }
  }

  /** Department events pull people together. */
  gather(kind) {
    const until = 1e9; const brought = [];
    const bring = (id, dest, from = 'p_lot1') => {
      let n = this.npc(id);
      if (!n) { const s = STAFF.find((x) => x.id === id); if (!s) return null; n = this.spawn(s, this.byId.has(from) ? from : 'dE_out'); n.temp = true; }
      if (n.away) { n.away = false; const st = this.byId.get(n.kind === 'deputy' ? 'garage' : 'p_lot1'); n.x = st.x; n.z = st.z; n.y = 0; n.at = st.id; }
      if (n.state === 'walk') { n.at = this.nearestNode(n.x, n.z, n.y).id; n.path = []; }
      n.event = kind; n.eventDest = dest; n.eventDone = false; n.chatWith = null; n.queue = [{ go: dest, reserve: dest }]; n.timer = Math.random() * 2; n.state = 'idle'; void until; brought.push(n); return n;
    };
    if (kind === 'rollcall' || kind === 'briefing') {
      bring('watch', 'p_rc_podium'); if (kind === 'rollcall') bring('captain', 'p_rc_front');
      const seats = this.nav.rollcall?.seats || [];
      ['vaughn', 'jake', 'ramsey', 'tate', 'lin', 'okafor_sgt'].filter((id) => STAFF.some((s) => s.id === id)).forEach((id, i) => bring(id, seats[[1, 2, 3, 6, 7, 8][i] ?? i] || 'p_rc_front'));
    } else if (kind === 'training') {
      bring('hale', 'range_line', 'armory_mid'); ['ruiz', 'hensley', 'jake', 'tate'].forEach((id, i) => bring(id, `range_l${i + 1}`));
    } else if (kind === 'meeting') {
      bring('chief', 'p2_conf_s1', 'p_lot1'); bring('captain', 'p2_conf_s2'); bring('watch', 'p2_conf_s3'); bring('pdchief', 'p2_conf_s0'); bring('karen', 'p2_conf_s4');
    }
    return brought;
  }

  /** End an event: everyone goes back to normal duties (optionally with an assignment). */
  release(kind, assignments = {}) {
    for (const n of this.npcs) {
      if (n.event !== kind) continue;
      n.event = null; n.eventDone = true; n.anim = 'idle';
      const a = assignments[n.id];
      if (a === 'patrol') n.queue = this.patrolPlan(n, 100);
      else if (a === 'reports') n.queue = this.sitSomewhere(['p_rc_seat0', 'p_rc_seat4', 'p_rc_seat9'], 60, 'write');
      else if (a === 'range') n.queue = this.rangePlan(n) || [];
      else if (n.temp) n.queue = [{ go: 'p_lob_out' }, { go: 'p_lot1' }, { fn: () => this.remove(n) }];
      else n.queue = this.workPlan(n, 40 + Math.random() * 60);
      n.timer = Math.random() * 3;
    }
  }

  /** Interaction volumes for the player's look ray. */
  interactables() {
    const out = [];
    for (const n of this.npcs) { if (n.away || !n.drawnRecently) continue; const y = n.y || 0; out.push({ id: `npc_${n.id}`, kind: 'npc', npc: n.id, civilian: n.kind === 'civilian', label: n.kind === 'civilian' ? 'A member of the public' : `Talk to ${n.name} (${n.role})`, min: [n.x - 0.35, y, n.z - 0.35], max: [n.x + 0.35, y + (n.sitting ? 1.45 : 1.85), n.z + 0.35], pri: 3 }); }
    return out;
  }

  // ---------------------------------------------------------------- drawing
  draw(items, meshes, makeMat, view = {}) {
    const p = view.pos || this.world.player.pos; const yaw = view.yaw ?? 0; const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const feet = this.world.player.feet; const out = view.out;
    // horizontal view cone (people outside it are neither animated nor drawn)
    const fov = ((view.fov || 72) * Math.PI) / 180; const halfH = Math.atan(Math.tan(fov / 2) * (view.aspect || 1.6)) + 0.12;
    const P = this.people; const dt = Math.min(0.1, this.pendingDt); this.pendingDt = 0;
    if (P) { P.beginFrame(); this._busy = !!this.world.game.sim?.calls?.active?.(); }
    for (const n of this.npcs) {
      n.drawn = false;
      if (n.away) continue;
      const dx = n.x - p[0], dz = n.z - p[2]; const d = Math.hypot(dx, dz); const sameFloor = Math.abs((n.y || 0) - feet) < 2.2;
      n.drawnRecently = sameFloor && d < 12;
      if (!out && !sameFloor) continue;
      const nOut = this.world.outside([n.x, 0, n.z]);
      if (out && !nOut && d > 16) continue;   // people inside are only glimpsed through nearby windows
      if (!out && nOut && d > 24) continue;
      if (d > (out ? 45 : 30)) continue;
      if (d > 1.2) { const c = (dx * fx + dz * fz) / d; const ang = Math.acos(Math.max(-1, Math.min(1, c))); if (ang > halfH + Math.atan(0.7 / d)) continue; }
      n.drawn = true;
      if (P) { if (!P.draw(n, items, d, dt, this.lookCtx(n, p, d))) this.drawNPC(n, items, meshes, makeMat, 0); }
      else this.drawNPC(n, items, meshes, makeMat, d < 6.5 ? 2 : d < 14 ? 1 : 0);
    }
  }

  /** Where a character looks: you (when you talk to them, or now and then when you're close), their conversation partner, else around. */
  lookCtx(n, p, d) {
    const ctx = this._ctx || (this._ctx = { target: null, busy: false, talkingToPlayer: false, tp: [0, 0, 0] }); ctx.busy = this._busy; ctx.target = null;
    ctx.talkingToPlayer = this.talkingTo === n.id;
    if (ctx.talkingToPlayer || (d < 3.4 && Math.sin(this.time * 0.37 + n.id.length * 1.7) > -0.35)) { ctx.tp[0] = p[0]; ctx.tp[1] = p[1]; ctx.tp[2] = p[2]; ctx.target = ctx.tp; }
    else if (n.chatWith) { const o = this.npc(n.chatWith); if (o) { ctx.tp[0] = o.x; ctx.tp[1] = (o.y || 0) + (o.sitting ? 1.2 : 1.62); ctx.tp[2] = o.z; ctx.target = ctx.tp; } }
    return ctx;
  }

  drawNPC(n, items, meshes, makeMat, lod) {
    const o = n.outfit || {};
    n.mats ||= { skin: makeMat(n.skin), hair: makeMat(n.hair, 0.05), shirt: makeMat(n.shirt), pants: makeMat(n.pants), shoe: makeMat([0.04, 0.04, 0.045], 0.5), dark: makeMat([0.05, 0.05, 0.06], 0.4), badge: makeMat([0.85, 0.7, 0.2], 0.7), belt: makeMat([0.06, 0.05, 0.04], 0.45), silver: makeMat([0.7, 0.72, 0.75], 0.8), white: makeMat([0.92, 0.92, 0.9], 0.2), tie: makeMat(o.tie || [0.2, 0.2, 0.2], 0.3), jacket: makeMat(o.jacket || n.shirt, 0.1), lens: makeMat([0.05, 0.06, 0.08], 0.9), stripe: makeMat([0.85, 0.8, 0.55], 0.3) };
    if (n.mats._shirt !== n.shirt) { n.mats.shirt = makeMat(n.shirt); n.mats._shirt = n.shirt; }
    n.mats.face ||= { ...makeMat(n.skin, 0.1), map: this.world?.tex?.face };
    n.parts ||= Array.from({ length: 56 }, () => ({ model: mat4(), mesh: null, mat: null }));
    const M = n.mats; let pi = 0; const Y = n.y || 0; const hs = n.height || 1;
    const cy = Math.cos(n.yaw), sy = Math.sin(n.yaw);
    const W = (lx, ly, lz) => [n.x + lx * cy + lz * sy, Y + ly * hs, n.z - lx * sy + lz * cy];
    const put = (mesh, mat, lx, ly, lz, rx, sx, syy, sz, extraYaw = 0) => {
      if (pi >= n.parts.length) return; const p = n.parts[pi++]; const [wx, wy, wz] = W(lx, ly, lz);
      trs(p.model, wx, wy, wz, n.yaw + extraYaw, rx, sx, syy * hs, sz); p.mesh = mesh; p.mat = mat; items.push(p);
    };
    const limbMesh = lod >= 1 ? meshes.limb || meshes.box : meshes.box;
    const limb = (mesh, mat, px, py, pz, ang, len, w, d) => {
      const cx = px, cyy = py - Math.cos(ang) * len / 2, cz = pz - Math.sin(ang) * len / 2;
      put(mesh, mat, cx, cyy, cz, ang, w, len, d);
      return [px, py - Math.cos(ang) * len, pz - Math.sin(ang) * len];
    };
    const walking = n.state === 'walk'; const t = n.phase; const a = n.anim;
    const sw = walking ? Math.sin(t * n.speed * 5.2) * 0.55 : 0;
    const bob = walking ? Math.abs(Math.cos(t * n.speed * 5.2)) * 0.035 : Math.sin(t * 1.3) * 0.004;
    const box = meshes.box, sph = meshes.sphere, torso = meshes.torso || meshes.box, shoe = meshes.shoe || meshes.box; const B = n.bulk || 1;
    const sleeveMat = o.jacket ? M.jacket : M.shirt;
    // two-segment arm with shoulder, elbow and hand
    const arm = (s, sx, syy, sz, upper, fore) => {
      if (lod === 0) { limb(box, sleeveMat, sx, syy, sz, upper * 0.6, 0.58, 0.1, 0.11); return; }
      put(sph, sleeveMat, sx * 0.97, syy - 0.02, sz, 0, 0.07 * B, 0.065, 0.075); // shoulder
      const el = limb(limbMesh, sleeveMat, sx, syy, sz, upper, 0.3, 0.1 * B, 0.11 * B);
      const wr = limb(limbMesh, n.sleeves ? M.skin : sleeveMat, el[0], el[1], el[2], fore, 0.27, 0.088, 0.095);
      put(sph, M.skin, wr[0], wr[1] - 0.045, wr[2], 0, 0.045, 0.065, 0.05);
    };
    const gear = (hipY, lz = 0) => {
      put(box, o.duty ? M.dark : M.belt, 0, hipY + 0.02, lz, 0, 0.44 * B, 0.065, 0.27 * B);
      if (o.duty && lod >= 1) {
        put(box, M.dark, 0.23 * B, hipY - 0.04, lz + 0.02, 0, 0.065, 0.17, 0.12); // holster
        put(box, M.dark, -0.21 * B, hipY + 0.0, lz - 0.06, 0, 0.07, 0.08, 0.06); // radio
        if (lod >= 2) { put(box, M.dark, -0.09, hipY + 0.0, lz - 0.135, 0, 0.08, 0.06, 0.03); put(box, M.silver, 0.08, hipY + 0.01, lz - 0.137, 0, 0.06, 0.04, 0.01); } // cuff case, buckle
      }
    };
    const chest = (y, lz) => { // uniform / office details on the chest
      if (lod < 2) return;
      if (o.duty || o.badge) put(box, M.badge, -0.11, y + 0.13, lz - 0.123, 0, 0.055, 0.065, 0.012);
      if (o.duty) { put(box, M.silver, 0.11, y + 0.14, lz - 0.123, 0, 0.07, 0.016, 0.01); put(box, M.dark, 0.13, y + 0.25, lz - 0.115, 0, 0.04, 0.07, 0.03); } // name bar, shoulder mic
      if (o.tie) put(box, M.tie, 0, y + 0.02, lz - 0.123, 0, 0.055, 0.32, 0.012);
      if (o.duty || o.tie) put(box, M.white, 0, y + 0.24, lz - 0.1, 0, 0.16, 0.04, 0.05); // collar
      if (o.stripes) for (const s of [-1, 1]) put(box, M.stripe, s * 0.27, y + 0.12, lz, 0, 0.012, 0.08, 0.07);
      if (o.jacket) for (const s of [-1, 1]) put(box, M.jacket, s * 0.13, y + 0.0, lz - 0.115, 0, 0.13, 0.5, 0.02); // open jacket fronts
    };
    if (n.sitting) {
      const hipY = 0.58, hipZ = 0.02;
      for (const s of [-1, 1]) {
        const knee = limb(limbMesh, M.pants, s * 0.1, hipY, hipZ, Math.PI / 2 - 0.05, 0.44, 0.15 * B, 0.17 * B);
        const foot = limb(limbMesh, M.pants, knee[0], knee[1], knee[2], 0.05, 0.46, 0.13, 0.14);
        put(shoe, M.shoe, foot[0], 0.05, foot[2] - 0.05, 0, 0.12, 0.09, 0.26);
      }
      const k = (a === 'type' ? n.typing = Math.min(1, (n.typing || 0) + 0.02) : (n.typing = Math.max(0, (n.typing || 0) - 0.02))) * Math.sin(t * 13 + (n.id.length)) * 0.05;
      put(torso, sleeveMat, 0, hipY + 0.32 + bob, 0.04, -0.08, 0.42 * B, 0.6, 0.24 * B);
      chest(hipY + 0.32 + bob, 0.04); gear(hipY + bob, 0.02);
      const talkA = a === 'talk' ? Math.sin(t * 3) * 0.25 + 0.3 : 0; const drink = a === 'drink' || a === 'eat' ? 0.9 + Math.sin(t * 0.8) * 0.3 : 0; const write = a === 'write' ? Math.sin(t * 6) * 0.04 : 0;
      for (const s of [-1, 1]) arm(s, s * 0.25 * B, hipY + 0.56 + bob, 0.02, 0.35 + (s > 0 ? talkA * 0.5 + drink * 0.3 : 0), 1.45 + (s > 0 ? k + write + drink : -k) + (s > 0 ? talkA : 0));
      this.head(n, put, box, sph, M, 0, hipY + 0.79 + bob, -0.02, lod);
    } else {
      const hipY = 0.92 + bob;
      for (const s of [-1, 1]) {
        const ang = s * sw;
        const knee = limb(limbMesh, M.pants, s * 0.1, hipY, 0, ang, 0.45, 0.15 * B, 0.17 * B);
        const bend = walking ? Math.max(0, Math.sin(t * n.speed * 5.2 * s + 0.6)) * 0.7 : 0;
        const foot = limb(limbMesh, M.pants, knee[0], knee[1], knee[2], ang - bend, 0.45, 0.13, 0.14);
        put(shoe, M.shoe, foot[0], Math.max(0.045, foot[1]), foot[2] - 0.05, 0, 0.12, 0.09, 0.26);
      }
      put(torso, sleeveMat, 0, hipY + 0.3, 0, 0, 0.42 * B, 0.62, 0.24 * B);
      chest(hipY + 0.3, 0); gear(hipY);
      const talk = a === 'talk' ? Math.sin(t * 3) * 0.2 + 0.25 : 0;
      const point = a === 'point' ? 1.3 + Math.sin(t * 0.7) * 0.15 : 0; const reach = a === 'reach' || a === 'wash' || a === 'pour' ? 0.9 + Math.sin(t * 2) * 0.1 : 0;
      const drink = a === 'drink' ? 0.6 + Math.max(0, Math.sin(t * 0.6)) * 1.0 : 0; const aim = a === 'aim' ? 1.5 : 0; const type = a === 'type' ? 0.9 : 0;
      for (const s of [-1, 1]) {
        let up = -s * sw * 0.8 + 0.04, fore = up + 0.25 + (walking ? 0.15 : 0.05);
        if (s > 0) { up += talk + point + reach * 0.7 + drink * 0.6 + aim + type * 0.5; fore += talk * 2.2 + point * 0.2 + reach * 0.6 + drink * 1.2 + aim * 0.1 + type * 0.8; }
        else if (aim || reach > 0.5 || type) { up += aim * 0.95 + reach * 0.5 + type * 0.5; fore += aim * 0.25 + reach * 0.5 + type * 0.8; }
        arm(s, s * 0.25 * B, hipY + 0.55, 0, up, fore);
      }
      this.head(n, put, box, sph, M, 0, hipY + 0.74, 0, lod);
    }
  }

  head(n, put, box, sph, M, x, y, z, lod) {
    const hy = n.headYaw || 0;
    put(box, M.skin, x, y - 0.05, z, 0, 0.1, 0.1, 0.1); // neck
    put(sph, M.face.map ? M.face : M.skin, x, y + 0.1, z, 0, 0.115, 0.135, 0.12, hy);
    if (lod >= 1) {
      const st = n.hairStyle;
      if (st !== 'bald') put(sph, M.hair, x, y + 0.155 + (st === 'buzz' ? -0.01 : 0), z + 0.015, 0, 0.124, st === 'buzz' ? 0.085 : 0.095, 0.13, hy);
      if (st === 'long' || (n.hairLong && st !== 'bun' && st !== 'bob')) put(box, M.hair, x, y + 0.03, z + 0.075, 0, 0.22, 0.26, 0.06, hy);
      if (st === 'bun') put(sph, M.hair, x, y + 0.17, z + 0.12, 0, 0.06, 0.06, 0.06, hy);
      if (st === 'bob') put(sph, M.hair, x, y + 0.08, z + 0.02, 0, 0.13, 0.09, 0.135, hy);
      if (lod >= 2) {
        for (const s of [-1, 1]) put(sph, M.skin, x + s * 0.112, y + 0.095, z + 0.005, 0, 0.018, 0.034, 0.022, hy); // ears
        put(box, M.skin, x, y + 0.085, z - 0.122, 0, 0.026, 0.045, 0.03, hy); // nose
        if (n.glasses) { put(box, M.lens, x, y + 0.13, z - 0.118, 0, 0.17, 0.035, 0.008, hy); }
      }
    }
    if (n.kind === 'dispatcher' || n.kind === 'supervisor') { put(box, M.dark, x, y + 0.24, z, 0, 0.26, 0.025, 0.03, hy); put(box, M.dark, x + 0.13, y + 0.1, z, 0, 0.03, 0.07, 0.06, hy); }
    if ((n.kind === 'officer' || n.kind === 'deputy' || n.kind === 'sergeant') && n.state === 'walk' && n.hatOn) put(box, M.dark, x, y + 0.22, z, 0, 0.26, 0.06, 0.28, hy);
  }
}

function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
function clampAngle(a, lim) { let d = ((a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return Math.max(-lim, Math.min(lim, d)); }
