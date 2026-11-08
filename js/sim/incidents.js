// Incident lifecycle, progress model, on-scene developments, patient transport,
// resource requests and (non-binding) unit recommendations.
import { TYPE, INCIDENT_STATUS_LABELS } from '../data/incidentTypes.js';
import { TYPE_BY_ID, CAPABILITY_PROVIDER } from '../data/departments.js';
import { city, addressFor, nearestFacility, blockText } from '../data/city.js';
import { bus } from '../core/events.js';
import { dist, clamp, deepClone, fill } from '../core/util.js';

const ACTIVE_UNIT_STATUSES = new Set(['assigned', 'responding', 'on_scene', 'transporting']);
const SEV_XP = { small: 20, medium: 45, major: 100 };

export class IncidentManager {
  constructor(sim) { this.sim = sim; }
  get list() { return this.sim.state.incidents; }
  byId(id) { return this.list.find((i) => i.id === id); }
  open() { return this.list.filter((i) => i.status !== 'closed'); }

  nextNumber() {
    const s = this.sim.state; s.seq.incident = (s.seq.incident || 0) + 1;
    const yy = String(new Date().getFullYear()).slice(2);
    return `${yy}-${String(s.seq.incident + 1000).padStart(5, '0')}`;
  }

  /**
   * Create an incident.
   * truth: optional scenario truth { needs, workload, patients, developments, sizeup, typeId, label }
   */
  create(spec) {
    const sim = this.sim;
    const type = TYPE[spec.typeId] || TYPE.OTHER;
    const truthSrc = spec.truth || {};
    const truth = {
      typeId: truthSrc.typeId || type.id,
      needs: deepClone(truthSrc.needs || type.needs),
      workload: truthSrc.workload || type.workload,
      patients: truthSrc.patients ?? 0,
      critical: !!truthSrc.critical,
      developments: deepClone(truthSrc.developments || []),
      sizeup: truthSrc.sizeup || null,
      clearText: truthSrc.clearText || null,
      progress: 0, devDone: [], requested: {}, firstArrival: null, patientsKnown: false, transported: 0,
      underControlSaid: false, noTransportSince: null, bolo: truthSrc.bolo || null,
    };
    const loc = spec.location || { x: 0, y: 0, full: 'Unknown location' };
    const inc = {
      id: `inc_${sim.state.seq.incident + 1}_${Math.floor(sim.t)}`,
      number: this.nextNumber(),
      type: type.id, typeLabel: type.label, category: type.category,
      priority: spec.priority || type.priority, severity: spec.severity || type.severity,
      status: spec.status || 'new',
      location: { ...loc }, locationVerified: !!spec.locationVerified,
      caller: spec.caller || null, description: spec.description || '', details: spec.details || [],
      transcript: spec.transcript || [], callIds: spec.callId ? [spec.callId] : [],
      created: sim.t, createdClock: sim.clock(), createdReal: Date.now(),
      units: [], unitHistory: [], notes: [], history: [], requests: [],
      source: spec.source || 'manual', sim: truth, completedAt: null, closedAt: null,
      dispatchedAt: null, answeredAt: spec.answeredAt ?? null, eval: null, instructions: spec.instructions || 0,
      callerCalmed: !!spec.callerCalmed, bolo: null,
    };
    this.addHistory(inc, `Incident created (${type.label}) – ${inc.location.full}`);
    if (spec.notes) this.addNote(inc, spec.notes, 'Call-taker');
    this.list.unshift(inc);
    sim.stats.incidentsCreated++;
    if (inc.severity === 'major') sim.stats.majorIncidents++;
    bus.emit('incident:created', { incident: inc });
    if (inc.priority === 1 && inc.source !== 'self') sim.notify(`New P1 incident ${inc.number}: ${inc.typeLabel} at ${inc.location.short || inc.location.full}`, 'alert', { incident: inc.id });
    return inc;
  }

  addHistory(inc, text) {
    inc.history.unshift({ t: this.sim.t, clock: this.sim.clock(), text });
    if (inc.history.length > 120) inc.history.length = 120;
  }

  addNote(inc, text, author = 'Dispatcher') {
    text = String(text || '').trim(); if (!text) return;
    inc.notes.push({ t: this.sim.t, clock: this.sim.clock(), text, author });
    this.addHistory(inc, `Note added: ${text.slice(0, 80)}`);
    bus.emit('incident:updated', { incident: inc });
  }

  setStatus(inc, status, note) {
    if (inc.status === status) return;
    const prev = inc.status; inc.status = status;
    this.addHistory(inc, note || `Status changed to ${INCIDENT_STATUS_LABELS[status]}`);
    bus.emit('incident:updated', { incident: inc, prev });
  }

  setPriority(inc, p) {
    p = clamp(parseInt(p, 10) || 3, 1, 4); if (inc.priority === p) return;
    this.addHistory(inc, `Priority changed P${inc.priority} → P${p}`); inc.priority = p;
    bus.emit('incident:updated', { incident: inc });
  }

  setType(inc, typeId) {
    const t = TYPE[typeId]; if (!t || inc.type === typeId) return;
    this.addHistory(inc, `Type changed ${inc.typeLabel} → ${t.label}`);
    inc.type = t.id; inc.typeLabel = t.label; inc.category = t.category;
    // Manual incidents (no scenario) take on the new type's needs.
    if (inc.source === 'manual') { inc.sim.needs = deepClone(t.needs); inc.sim.workload = t.workload; }
    bus.emit('incident:updated', { incident: inc });
  }

  editLocation(inc, text) {
    text = String(text || '').trim(); if (!text) return;
    inc.location.full = text; inc.location.short = text;
    this.addHistory(inc, `Location updated: ${text}`);
    bus.emit('incident:updated', { incident: inc });
  }

  editDescription(inc, text) { inc.description = String(text || ''); this.addHistory(inc, 'Description updated'); bus.emit('incident:updated', { incident: inc }); }

  attachUnit(inc, u) {
    if (!inc.units.includes(u.id)) inc.units.push(u.id);
    inc.unitHistory.unshift({ t: this.sim.t, clock: this.sim.clock(), unit: u.callsign, action: 'Assigned' });
    if (!inc.dispatchedAt) inc.dispatchedAt = this.sim.t;
    if (['new', 'pending', 'awaiting', 'completed'].includes(inc.status)) this.setStatus(inc, inc.status === 'completed' ? 'active' : 'assigned', `Units assigned`);
    // a request is satisfied once someone with that capability is coming
    const caps = TYPE_BY_ID[u.type].caps;
    inc.requests = inc.requests.filter((r) => !(caps[r.cap] >= 0.5));
    bus.emit('incident:updated', { incident: inc });
  }

  detachUnit(inc, u, reason = 'Removed') {
    inc.units = inc.units.filter((id) => id !== u.id);
    inc.unitHistory.unshift({ t: this.sim.t, clock: this.sim.clock(), unit: u.callsign, action: reason });
    this.addHistory(inc, `${u.callsign}: ${reason}`);
    if (!inc.units.length && ['assigned', 'active', 'under_control'].includes(inc.status) && inc.sim.progress < 1) this.setStatus(inc, 'awaiting', 'No units assigned');
    bus.emit('incident:updated', { incident: inc });
  }

  unitsOf(inc, statuses) {
    return inc.units.map((id) => this.sim.units.byId(id)).filter((u) => u && (!statuses || statuses.includes(u.status)));
  }

  /** How well the units (on scene by default) cover what the incident really needs. */
  coverage(inc, { onScene = true, needs } = {}) {
    needs = needs || inc.sim.needs;
    const units = this.unitsOf(inc, onScene ? ['on_scene'] : ['assigned', 'responding', 'on_scene', 'transporting']);
    const have = {};
    for (const u of units) for (const [cap, v] of Object.entries(TYPE_BY_ID[u.type].caps)) have[cap] = (have[cap] || 0) + v;
    let wSum = 0, cSum = 0; const perNeed = [];
    for (const [cap, need] of Object.entries(needs)) {
      if (need <= 0) continue;
      const h = have[cap] || 0; const ratio = Math.min(1, h / need);
      wSum += need; cSum += need * ratio; perNeed.push({ cap, need, have: h, ratio });
    }
    const extra = units.length ? Math.max(0, Object.values(have).reduce((a, b) => a + b, 0) - wSum) : 0;
    return { coverage: wSum ? cSum / wSum : 1, perNeed, units: units.length, extra };
  }

  onUnitArrive(u) {
    const sim = this.sim; const inc = this.byId(u.incident);
    if (!inc) { sim.units.sendHome(u); return; }
    // Dispatched to the wrong place? Units find nothing, report it, and relocate to the real scene.
    const tl = inc.sim.trueLoc;
    if (tl && dist(inc.location.x, inc.location.y, tl.x, tl.y) > 180) {
      sim.radio.unitSays(u, 'wrong_address', { inc, location: tl.short || tl.full });
      this.addHistory(inc, `${u.callsign} found nothing at ${inc.location.full}; actual location ${tl.full}`);
      sim.notify(`${inc.number}: units relocating – actual location is ${tl.full}`, 'warn', { incident: inc.id });
      inc.location = { ...inc.location, x: tl.x, y: tl.y, full: tl.full, short: tl.short || tl.full, street: tl.street, cross: tl.cross };
      for (const other of this.unitsOf(inc, ['responding', 'on_scene'])) {
        sim.units.routeTo(other, tl.x, tl.y);
        if (other.status !== 'responding') sim.units.setStatus(other, 'responding', `Relocating to ${tl.full}`);
      }
      bus.emit('incident:updated', { incident: inc });
      return;
    }
    u.onSceneSince = sim.t;
    sim.units.setStatus(u, 'on_scene', `On scene at ${inc.number}`);
    inc.unitHistory.unshift({ t: sim.t, clock: sim.clock(), unit: u.callsign, action: 'On scene' });
    const first = !inc.sim.firstArrival;
    if (first) {
      inc.sim.firstArrival = sim.t;
      sim.stats.responseTimes.push(sim.t - inc.created);
      if (['assigned', 'awaiting', 'new', 'pending'].includes(inc.status)) this.setStatus(inc, 'active', `${u.callsign} first on scene`);
      inc.sim.patientsKnown = true;
      sim.radio.unitSays(u, 'onscene_first', { inc });
      if (inc.sim.sizeup) this.addHistory(inc, `Size-up from ${u.callsign}: ${inc.sim.sizeup}`);
      // Suggest a type correction if the player's classification differs from reality.
      if (inc.sim.typeId && inc.sim.typeId !== inc.type && TYPE[inc.sim.typeId]) {
        inc.suggestedType = inc.sim.typeId;
        this.addHistory(inc, `On-scene units suggest reclassifying as ${TYPE[inc.sim.typeId].label}`);
      }
    } else {
      sim.radio.unitSays(u, 'onscene', { inc });
    }
    bus.emit('incident:updated', { incident: inc });
  }

  onPatientDelivered(u) {
    const inc = this.byId(u.incident);
    if (inc) {
      inc.sim.transported += u.patients || 1;
      this.addHistory(inc, `${u.callsign} delivered ${u.patients || 1} patient(s) to hospital`);
      inc.unitHistory.unshift({ t: this.sim.t, clock: this.sim.clock(), unit: u.callsign, action: 'At hospital' });
      inc.units = inc.units.filter((id) => id !== u.id);
      bus.emit('incident:updated', { incident: inc });
    }
    u.patients = 0;
  }

  update(dt) {
    const sim = this.sim;
    const difficulty = { easy: 0.5, normal: 1, hard: 1.6 }[sim.config.difficulty] ?? 1;
    const relaxed = sim.config.relaxed !== false;
    for (const inc of this.list) {
      if (inc.status === 'closed') continue;
      const tr = inc.sim;
      if (inc.status === 'new' && !inc.units.length && sim.t - inc.created > 4) this.setStatus(inc, 'awaiting', 'Awaiting unit assignment');
      if (inc.status === 'completed') {
        if (sim.config.autoClose && inc.completedAt != null && sim.t - inc.completedAt > 25 && !this.unitsOf(inc, ['transporting']).length) this.close(inc, true);
        continue;
      }
      const onScene = this.unitsOf(inc, ['on_scene']);
      // time-based developments for unattended incidents (gentle in relaxed mode)
      for (let di = 0; di < tr.developments.length; di++) {
        const dev = tr.developments[di];
        if (tr.devDone.includes(di) || dev.after == null) continue;
        if (sim.t - inc.created >= dev.after && !onScene.length) {
          tr.devDone.push(di);
          if (sim.rng.chance((dev.chance ?? 0.5) * difficulty * (relaxed ? 0.5 : 1))) this.applyDevelopment(inc, dev, null);
        }
      }
      if (!onScene.length) continue;
      const cov = this.coverage(inc);
      let rate = (0.12 + 0.88 * cov.coverage) * (1 + Math.min(0.25, cov.extra * 0.05)) / Math.max(20, tr.workload);
      if (relaxed) rate = Math.max(rate, 0.3 / Math.max(20, tr.workload));
      const patientsLeft = Math.max(0, tr.patients - tr.transported - this.onBoard(inc));
      const cap = patientsLeft > 0 ? 0.92 : 1;
      tr.progress = Math.min(cap, tr.progress + rate * dt);
      // progress-based developments
      for (let di = 0; di < tr.developments.length; di++) {
        const dev = tr.developments[di];
        if (tr.devDone.includes(di) || dev.at == null) continue;
        if (tr.progress >= dev.at) {
          tr.devDone.push(di);
          const mult = difficulty * (cov.coverage < 0.5 ? 1.5 : 1) * (relaxed ? 0.75 : 1);
          if (sim.rng.chance(Math.min(0.95, (dev.chance ?? 0.5) * mult))) this.applyDevelopment(inc, dev, onScene[0]);
        }
      }
      this.handleTransport(inc, onScene, patientsLeft);
      this.handleRequests(inc, onScene, cov);
      if (tr.progress >= 0.7 && !tr.underControlSaid && inc.status === 'active') {
        tr.underControlSaid = true;
        this.setStatus(inc, 'under_control', 'Incident under control');
        if (inc.severity !== 'small') sim.radio.unitSays(this.leadUnit(onScene), 'under_control', { inc });
      }
      if (tr.progress >= 1) this.complete(inc);
    }
  }

  onBoard(inc) { return this.unitsOf(inc, ['transporting']).reduce((a, u) => a + (u.patients || 0), 0); }

  leadUnit(units) {
    const order = ['battalion', 'police_sup', 'ems_sup', 'fire_sup', 'engine', 'patrol'];
    return units.slice().sort((a, b) => {
      const ia = order.indexOf(a.type), ib = order.indexOf(b.type);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })[0];
  }

  handleTransport(inc, onScene, patientsLeft) {
    const sim = this.sim; const tr = inc.sim;
    if (patientsLeft <= 0) { tr.noTransportSince = null; return; }
    const transporters = onScene.filter((u) => TYPE_BY_ID[u.type].caps.transport);
    for (const u of transporters) {
      if (patientsLeft <= 0) break;
      if (sim.t - u.onSceneSince < (tr.critical ? 18 : 30)) continue;
      const kinds = ['hospital'];
      let hosp = nearestFacility(u.x, u.y, kinds);
      if (tr.critical) hosp = city.facilities.find((f) => f.kind === 'hospital' && f.trauma === 1) || hosp;
      const load = Math.min(patientsLeft, u.type === 'air_medical' || u.type === 'cct' ? 1 : (patientsLeft > 1 && sim.rng.chance(0.3) ? 2 : 1));
      u.patients = load; patientsLeft -= load;
      u.dest = { kind: 'hospital', id: hosp.id };
      sim.units.routeTo(u, hosp.x, hosp.y);
      sim.units.setStatus(u, 'transporting', `Transporting ${load} to ${hosp.name}`);
      inc.unitHistory.unshift({ t: sim.t, clock: sim.clock(), unit: u.callsign, action: `Transporting to ${hosp.short}` });
      this.addHistory(inc, `${u.callsign} transporting ${load} patient(s) to ${hosp.name}`);
      sim.radio.unitSays(u, 'transporting', { inc, hospital: hosp, count: load, critical: tr.critical });
      sim.stats.transports += load;
    }
    if (!transporters.length && patientsLeft > 0) {
      if (tr.noTransportSince == null) tr.noTransportSince = sim.t;
      // In relaxed mode, patients eventually get a ride with family or sign a refusal.
      if (sim.config.relaxed !== false && sim.t - tr.noTransportSince > 150) {
        tr.patients = tr.transported + this.onBoard(inc);
        this.addHistory(inc, 'Remaining patient(s) signed a refusal / transported by private vehicle');
        sim.radio.unitSays(onScene[0], 'refusal', { inc });
      }
    }
  }

  handleRequests(inc, onScene, cov) {
    const sim = this.sim; const tr = inc.sim;
    if (!tr.firstArrival || sim.t - tr.firstArrival < 14) return;
    if (tr.lastRequestAt && sim.t - tr.lastRequestAt < 35) return;
    const enRoute = this.coverage(inc, { onScene: false });
    // patients but nobody who can transport, on scene or coming
    const patientsLeft = tr.patients - tr.transported - this.onBoard(inc);
    const missing = enRoute.perNeed.filter((n) => n.ratio < 0.45 && n.need >= 0.5).sort((a, b) => b.need - a.need);
    if (patientsLeft > 0 && !enRoute.perNeed.some((n) => n.cap === 'transport' && n.have >= 1)) {
      const unitsComing = this.unitsOf(inc).some((u) => TYPE_BY_ID[u.type].caps.transport);
      if (!unitsComing) missing.unshift({ cap: 'transport', need: 1, have: 0 });
    }
    for (const m of missing) {
      const last = tr.requested[m.cap];
      if (last && sim.t - last < 140) continue;
      tr.requested[m.cap] = sim.t; tr.lastRequestAt = sim.t;
      if (!inc.requests.some((r) => r.cap === m.cap)) inc.requests.push({ cap: m.cap, t: sim.t, clock: sim.clock() });
      const lead = this.leadUnit(onScene);
      sim.radio.unitSays(lead, 'request', { inc, cap: m.cap, count: Math.max(1, Math.ceil(m.need - m.have)) });
      this.addHistory(inc, `${lead.callsign} requested ${m.cap.replace(/_/g, ' ')}`);
      sim.notify(`${lead.callsign} is requesting additional resources at ${inc.number}`, 'request', { incident: inc.id });
      bus.emit('incident:updated', { incident: inc });
      break;
    }
  }

  applyDevelopment(inc, dev, unit) {
    const sim = this.sim; const tr = inc.sim;
    if (dev.addNeeds) for (const [k, v] of Object.entries(dev.addNeeds)) tr.needs[k] = (tr.needs[k] || 0) + v;
    if (dev.workload) tr.workload += dev.workload;
    if (dev.patients) { tr.patients += dev.patients; }
    if (dev.critical) tr.critical = true;
    if (dev.priority && dev.priority < inc.priority) { this.setPriority(inc, dev.priority); }
    if (dev.severity) inc.severity = dev.severity;
    if (dev.progressBack) tr.progress = Math.max(0, tr.progress - dev.progressBack);
    const ctx = { ...inc.location, unit: unit?.callsign, address: inc.location.short || inc.location.full };
    const text = fill(dev.text || 'Situation has changed on scene.', ctx, sim.rng);
    this.addHistory(inc, `Development: ${text}`);
    if (unit) sim.radio.unitSays(unit, 'development', { inc, text });
    else sim.notify(`${inc.number}: ${text}`, 'alert', { incident: inc.id });
    if (dev.callerLine) sim.calls.pushCallerUpdate(inc, dev.callerLine);
    if (dev.spawn) sim.calls.spawnFollowUp(inc, dev.spawn);
    bus.emit('incident:updated', { incident: inc });
  }

  complete(inc, manual = false) {
    const sim = this.sim; if (['completed', 'closed'].includes(inc.status)) return;
    inc.sim.progress = 1; inc.completedAt = sim.t;
    const cov = this.coverage(inc, { onScene: false });
    inc.sim.finalCoverage = cov.coverage;
    this.setStatus(inc, 'completed', manual ? 'Marked completed by dispatcher' : 'Incident resolved');
    sim.stats.incidentsCompleted++;
    const onScene = this.unitsOf(inc, ['on_scene']);
    if (onScene.length && !manual) sim.radio.unitSays(this.leadUnit(onScene), 'clear', { inc });
    if (sim.config.autoClearUnits !== false || manual) {
      for (const u of onScene) {
        inc.unitHistory.unshift({ t: sim.t, clock: sim.clock(), unit: u.callsign, action: 'Cleared' });
        u.clearUntil = sim.t + sim.rng.float(3, 9);
        sim.units.setStatus(u, 'clearing', `Clearing ${inc.number}`);
      }
      for (const u of this.unitsOf(inc, ['assigned', 'responding'])) sim.units.unassign(u.id, { reason: 'Cancelled – incident resolved' });
    }
    bus.emit('incident:completed', { incident: inc });
  }

  /** Clear one on-scene unit manually. */
  clearUnit(inc, u) {
    if (!u || u.incident !== inc.id) return;
    if (u.status === 'on_scene') {
      inc.unitHistory.unshift({ t: this.sim.t, clock: this.sim.clock(), unit: u.callsign, action: 'Cleared' });
      inc.units = inc.units.filter((id) => id !== u.id);
      this.sim.radio.unitSays(u, 'clear_scene', { inc });
      this.sim.units.sendHome(u);
      if (!inc.units.length && inc.status !== 'completed') this.setStatus(inc, 'awaiting', 'All units cleared');
      bus.emit('incident:updated', { incident: inc });
    } else this.sim.units.unassign(u.id);
  }

  evaluate(inc) {
    const sim = this.sim;
    const ev = { base: SEV_XP[inc.severity] || 20, bonuses: [] };
    if (inc.source === 'self') { ev.base = 8; }
    if (inc.locationVerified) ev.bonuses.push(['Location verified with caller', 10]);
    const cov = inc.sim.finalCoverage ?? this.coverage(inc, { onScene: false }).coverage;
    if (cov >= 0.8 && inc.source !== 'self') ev.bonuses.push(['Strong resource match', 15]);
    else if (cov >= 0.55 && inc.source !== 'self') ev.bonuses.push(['Good resource match', 8]);
    if (inc.instructions > 0) ev.bonuses.push(['Gave caller instructions', Math.min(15, inc.instructions * 5)]);
    if (inc.callerCalmed) ev.bonuses.push(['Kept the caller calm', 8]);
    if (inc.notes.length) ev.bonuses.push(['Documented notes', 5]);
    if (inc.answeredAt != null && inc.dispatchedAt != null && inc.dispatchedAt - inc.answeredAt < 75) ev.bonuses.push(['Prompt dispatch', 8]);
    if (inc.bolo) ev.bonuses.push(['BOLO broadcast', 5]);
    ev.total = ev.base + ev.bonuses.reduce((a, b) => a + b[1], 0);
    ev.coverage = cov;
    return ev;
  }

  close(inc, auto = false) {
    const sim = this.sim; if (inc.status === 'closed') return;
    if (inc.status !== 'completed') this.complete(inc, true);
    inc.closedAt = sim.t;
    inc.eval = this.evaluate(inc);
    this.setStatus(inc, 'closed', auto ? 'Auto-closed' : 'Closed by dispatcher');
    sim.stats.incidentsClosed++;
    sim.stats.xpEarned += inc.eval.total;
    sim.career?.onIncidentClosed(inc, sim.state.mode);
    bus.emit('incident:closed', { incident: inc });
    // keep the live list bounded
    const closed = this.list.filter((i) => i.status === 'closed');
    if (closed.length > 120) { const drop = closed[closed.length - 1]; this.list.splice(this.list.indexOf(drop), 1); }
  }

  reopen(inc) {
    if (inc.status !== 'closed' && inc.status !== 'completed') return;
    inc.closedAt = null; inc.completedAt = null; inc.sim.progress = Math.min(inc.sim.progress, 0.6); inc.sim.underControlSaid = false;
    this.setStatus(inc, inc.units.length ? 'active' : 'awaiting', 'Incident reopened');
  }

  /** Units the game would suggest. Never applied automatically. */
  recommendations(inc, max = 12) {
    const sim = this.sim;
    const type = TYPE[inc.type] || TYPE.OTHER;
    const needs = deepClone(type.needs);
    for (const r of inc.requests) needs[r.cap] = Math.max(needs[r.cap] || 0, 1);
    if (inc.sim.patientsKnown && inc.sim.patients > 0) needs.transport = Math.max(needs.transport || 0, Math.min(3, inc.sim.patients - inc.sim.transported));
    const have = {};
    for (const u of this.unitsOf(inc, ['assigned', 'responding', 'on_scene'])) for (const [c, v] of Object.entries(TYPE_BY_ID[u.type].caps)) have[c] = (have[c] || 0) + v;
    const picks = []; const picked = new Set();
    const avail = sim.units.list.filter((u) => sim.units.isAssignable(u) && !u.incident);
    const entries = Object.entries(needs).sort((a, b) => b[1] - a[1]);
    for (const [cap, need] of entries) {
      let missing = need - (have[cap] || 0);
      if (missing < 0.3) continue;
      const preferType = CAPABILITY_PROVIDER[cap];
      const candidates = avail.filter((u) => !picked.has(u.id) && (TYPE_BY_ID[u.type].caps[cap] || 0) >= 0.5)
        .map((u) => ({ u, d: dist(u.x, u.y, inc.location.x, inc.location.y) * (TYPE_BY_ID[u.type].air ? 0.4 : 1) * (u.type === preferType ? 0.85 : 1) }))
        .sort((a, b) => a.d - b.d);
      for (const c of candidates) {
        if (missing < 0.3 || picks.length >= max) break;
        picks.push({ unit: c.u.id, cap, reason: `${c.u.callsign} – ${cap.replace(/_/g, ' ')}` }); picked.add(c.u.id);
        for (const [k, v] of Object.entries(TYPE_BY_ID[c.u.type].caps)) have[k] = (have[k] || 0) + v;
        missing = need - (have[cap] || 0);
      }
    }
    return picks;
  }

  // ---- special creators ----
  createSelfInitiated(u) {
    const sim = this.sim; const r = sim.rng;
    const kinds = [
      { typeId: 'TRAFFIC_STOP', what: 'traffic stop', w: 5 },
      { typeId: 'ASSIST', what: 'flagged down by a citizen', w: 2 },
      { typeId: 'SUSP', what: 'checking a suspicious person', w: 1.5 },
      { typeId: 'DISABLED', what: 'assisting a disabled motorist', w: 1.5 },
    ];
    const k = r.weighted(kinds, (x) => x.w);
    const a = addressFor(u.x, u.y);
    const veh = `${r.pick(['red', 'black', 'silver', 'white', 'blue', 'gray', 'green'])} ${r.pick(['Honda Civic', 'Ford F-150', 'Toyota Camry', 'Chevy Malibu', 'Nissan Altima', 'Jeep Cherokee', 'Dodge Charger', 'Hyundai Elantra'])}`;
    const plate = `${r.pick(['K', 'R', 'D', 'H', 'L', 'B'])}${r.pick(['A', 'X', 'T', 'M', 'Z'])}${r.pick(['C', 'J', 'P', 'W'])}-${r.int(1000, 9999)}`;
    const location = { x: u.x, y: u.y, ...a, full: blockText(a) };
    location.short = location.full;
    const inc = this.create({ typeId: k.typeId, priority: 4, location, source: 'self', locationVerified: true,
      description: `${u.callsign} self-initiated: ${k.what}${k.typeId === 'TRAFFIC_STOP' ? ` – ${veh}, plate ${plate}` : ''}`,
      truth: { workload: r.float(35, 80), needs: TYPE[k.typeId].needs, developments: k.typeId === 'TRAFFIC_STOP' ? [
        { at: 0.4, chance: 0.12, text: 'Driver has a suspended license and an outstanding warrant – requesting a backup unit.', addNeeds: { patrol: 1 }, workload: 40, priority: 3 },
      ] : [] } });
    u.incident = inc.id; u.dest = { kind: 'incident', id: inc.id }; u.onSceneSince = sim.t;
    this.attachUnit(inc, u);
    sim.units.setStatus(u, 'on_scene', `Self-initiated ${k.what}`);
    inc.sim.firstArrival = sim.t; this.setStatus(inc, 'active', `${u.callsign} on scene`);
    sim.radio.unitSays(u, 'self_initiated', { inc, what: k.what, veh, plate, location: location.full });
    return inc;
  }
}
