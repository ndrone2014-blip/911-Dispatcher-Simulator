// 911 call handling: generation, ringing queue, answering, conversation turns,
// duplicates, abandoned calls and callbacks, incident creation from calls.
import { chooseTemplate, buildScenario, SCENARIO_BY_ID, timeOfDay } from './scenarioGen.js';
import { newConvo, openingLine, respond, spontaneous } from '../ai/conversation.js';
import { TYPE } from '../data/incidentTypes.js';
import { addressFor } from '../data/city.js';
import { bus } from '../core/events.js';
import { dist, fill, clamp } from '../core/util.js';

export const FREQUENCY = {
  off: null, very_quiet: 240, relaxed: 135, normal: 80, busy: 48, very_busy: 27,
};
export const FREQUENCY_LABELS = { very_quiet: 'Very Quiet', relaxed: 'Relaxed', normal: 'Normal', busy: 'Busy', very_busy: 'Very Busy', off: 'Off (no new calls)' };
const MAX_RINGING = 5;

export class CallManager {
  constructor(sim) { this.sim = sim; }
  // Recently used scenarios, remembered across shifts (browser storage) so a new shift doesn't open with yesterday's calls.
  get recentTemplates() {
    const st = this.sim.state;
    if (!st.recentTemplates) { let prev = []; try { prev = JSON.parse(globalThis.localStorage?.getItem('wc911_recent_calls') || '[]'); } catch { prev = []; } st.recentTemplates = Array.isArray(prev) ? prev.slice(-40) : []; }
    return st.recentTemplates;
  }
  rememberTemplate(id) { const list = this.recentTemplates; list.push(id); if (list.length > 40) list.shift(); try { globalThis.localStorage?.setItem('wc911_recent_calls', JSON.stringify(list)); } catch { /* storage unavailable */ } }
  get list() { return this.sim.state.calls; }
  byId(id) { return this.list.find((c) => c.id === id); }
  ringing() { return this.list.filter((c) => c.status === 'ringing'); }
  active() { return this.list.find((c) => c.status === 'active'); }
  held() { return this.list.filter((c) => c.status === 'hold'); }

  scheduleNext(first = false) {
    const sim = this.sim; const mean = FREQUENCY[sim.config.callFrequency];
    if (!mean) { sim.state.nextCallAt = Infinity; return; }
    const wxBoost = sim.weather ? sim.weather.callBoost() : 1;
    sim.state.nextCallAt = sim.t + (first ? sim.rng.float(6, 14) : (mean / wxBoost) * sim.rng.float(0.55, 1.45));
  }

  update(dt) {
    const sim = this.sim;
    if (!isFinite(sim.state.nextCallAt) && FREQUENCY[sim.config.callFrequency]) this.scheduleNext();
    if (sim.t >= sim.state.nextCallAt && !sim.onBreak && sim.state.mode !== 'training') {
      if (this.ringing().length < MAX_RINGING) this.spawnCall();
      this.scheduleNext();
    }
    for (const call of this.list) {
      if (call.status === 'ringing' && sim.config.callerHangups && sim.t - call.receivedAt > call.patience) {
        call.status = 'abandoned'; call.endedAt = sim.t;
        this.addLine(call, 'system', 'Caller disconnected before answer (abandoned call). Callback available.');
        sim.stats.callsAbandoned++;
        sim.notify(`Abandoned 911 call from ${call.sc.ani.phone} – callback available`, 'warn', { call: call.id });
        bus.emit('call:updated', { call });
      }
      if (call.status === 'active' || call.status === 'hold') this.tickActive(call);
    }
    // bound the ended list
    const ended = this.list.filter((c) => ['ended', 'abandoned'].includes(c.status));
    if (ended.length > 80) this.list.splice(this.list.indexOf(ended[ended.length - 1]), 1);
  }

  tickActive(call) {
    const sim = this.sim;
    if (call.status !== 'active') return;
    const since = sim.t - call.answeredAt;
    if (sim.t - (call.lastTick || 0) < 1.5) return;
    call.lastTick = sim.t;
    if (call.pendingReply) return;
    // units arriving at the caller's incident
    const inc = call.incidentId ? sim.incidents.byId(call.incidentId) : null;
    if (inc && inc.sim.firstArrival && !call.convo.unitsArrivedSaid && sim.t - inc.sim.firstArrival > 2) {
      call.convo.unitsArrivedSaid = true;
      this.callerSays(call, fill(['Oh, I see them! They\'re here!', 'They\'re pulling up now, thank you!', 'Okay, they just got here.', 'I can see the lights, they\'re here!'], {}, sim.rng));
      call.autoEndAt = sim.t + 9;
      return;
    }
    if (call.autoEndAt && sim.t >= call.autoEndAt) { this.end(call.id, 'Caller disconnected – responders on scene'); return; }
    const line = spontaneous(call, since, sim.rng);
    if (line) this.callerSays(call, line);
    if (call.sc.endsAfter && since > call.sc.endsAfter) this.end(call.id, 'Caller hung up');
  }

  makeCall(sc, extra = {}) {
    const sim = this.sim; const s = sim.state;
    s.seq.call = (s.seq.call || 0) + 1;
    const lineNo = this.freeLine();
    const call = {
      id: `call_${s.seq.call}`, number: s.seq.call, line: lineNo, status: 'ringing', receivedAt: sim.t, receivedClock: sim.clock(),
      answeredAt: null, endedAt: null, sc, convo: newConvo(sc), transcript: [], incidentId: null, linkedIncidents: [],
      info: { location: '', cross: '', apt: '', name: '', phone: '', nature: '', notes: [] }, patience: sim.rng.float(60, 130),
      duplicateOf: null, verified: false, ...extra,
    };
    this.list.unshift(call);
    sim.stats.callsReceived++;
    bus.emit('call:incoming', { call });
    return call;
  }

  freeLine() {
    const used = new Set(this.list.filter((c) => ['ringing', 'active', 'hold'].includes(c.status)).map((c) => c.line));
    for (let i = 1; i <= 8; i++) if (!used.has(i)) return i;
    return 9;
  }

  /** Generate a new call (random, by template id, or as a duplicate). */
  spawnCall({ templateId, duplicateOf } = {}) {
    const sim = this.sim; const r = sim.rng;
    // duplicate callers for fresh major incidents
    if (!templateId && !duplicateOf) {
      const fresh = sim.incidents.open().filter((i) => i.severity === 'major' && sim.t - i.created < 240 && (i.dupes || 0) < 2 && i.dupLines);
      if (fresh.length && r.chance(0.3)) return this.spawnDuplicate(r.pick(fresh));
    }
    if (duplicateOf) { const inc = sim.incidents.byId(duplicateOf); if (inc) return this.spawnDuplicate(inc); }
    const template = templateId ? SCENARIO_BY_ID[templateId] : chooseTemplate(r, {
      config: sim.config, weather: sim.weather?.current() || 'clear', clock: sim.clock(), recent: this.recentTemplates, events: sim.state.events,
    });
    if (!this.sim.menuDemo) this.rememberTemplate(template.id);
    const sc = buildScenario(r, template);
    return this.makeCall(sc);
  }

  spawnDuplicate(inc) {
    const sim = this.sim; const r = sim.rng;
    const template = SCENARIO_BY_ID[inc.templateId] || SCENARIO_BY_ID.mva_injury;
    const loc = inc.sim.trueLoc || inc.location;
    const sc = buildScenario(r, template, { forcedLoc: { ...loc } });
    sc.opening = fill(r.pick(inc.dupLines), { ...loc, address: loc.full }, r);
    sc.kind = 'duplicate'; sc.truth = null; sc.callerAtScene = false;
    sc.extra = ['I think other people are calling about it too.'];
    inc.dupes = (inc.dupes || 0) + 1;
    return this.makeCall(sc, { duplicateOf: inc.id });
  }

  addLine(call, who, text) {
    const entry = { who, text, t: this.sim.t, clock: this.sim.clock() };
    call.transcript.push(entry);
    bus.emit('call:message', { call, entry });
    return entry;
  }

  callerSays(call, text) {
    call.convo.lastCaller = text;
    this.addLine(call, 'caller', text);
    // keep an attached incident's transcript in sync
    if (call.incidentId) { const inc = this.sim.incidents.byId(call.incidentId); if (inc) inc.transcript = call.transcript; }
  }

  answer(id) {
    const sim = this.sim; const call = this.byId(id);
    if (!call || !['ringing', 'hold'].includes(call.status)) return null;
    const cur = this.active(); if (cur && cur.id !== id) this.hold(cur.id);
    if (call.status === 'hold') { call.status = 'active'; this.addLine(call, 'system', 'Call resumed from hold.'); bus.emit('call:updated', { call }); return call; }
    call.status = 'active'; call.answeredAt = sim.t; call.answeredClock = sim.clock();
    sim.stats.callsAnswered++;
    if (call.sc.kind !== 'emergency' && call.sc.kind !== 'duplicate') sim.stats.nonEmergency++;
    sim.stats.ringTimes.push(sim.t - call.receivedAt);
    this.addLine(call, 'system', `Line ${call.line} answered. ANI: ${call.sc.ani.phone} (${call.sc.ani.kind}). ALI: ${call.sc.ani.address}`);
    this.addLine(call, 'dispatcher', call.isCallback ? 'Hello, this is Regional 911 calling you back, we received a call from this number.' : '911, what is the address of your emergency?');
    call.pendingReply = true;
    sim.later(sim.rng.float(0.6, 1.3), () => {
      call.pendingReply = false;
      if (call.status !== 'active' && call.status !== 'hold') return;
      const opening = call.isCallback && call.sc.kind === 'misdial' ? 'Oh! Sorry, that was an accident, everything is fine.' : openingLine(call, sim.rng);
      call.info.nature = call.sc.natureNote || call.sc.nature;
      if (call.sc.revealOnOpen?.includes('location')) call.info.location = call.sc.loc.full;
      this.callerSays(call, opening);
    });
    bus.emit('call:answered', { call });
    return call;
  }

  hold(id) {
    const call = this.byId(id); if (!call || call.status !== 'active') return;
    call.status = 'hold'; this.addLine(call, 'system', 'Call placed on hold.');
    bus.emit('call:updated', { call });
  }

  /** Dispatcher speaks to the active caller. Returns the intents understood. */
  say(id, text) {
    const sim = this.sim; const call = this.byId(id);
    text = String(text || '').trim();
    if (!call || call.status !== 'active' || !text) return null;
    this.addLine(call, 'dispatcher', text);
    sim.audio?.typing?.();
    const res = respond(call, text, sim.rng);
    if (res.effects.verified) call.verified = true;
    if (res.effects.instructions.length) { sim.stats.instructionsGiven += res.effects.instructions.length; call.instructionsGiven = (call.instructionsGiven || 0) + res.effects.instructions.length; }
    if (res.effects.calmed) call.calmed = true;
    // keep incident in sync with new info
    if (call.incidentId) {
      const inc = sim.incidents.byId(call.incidentId);
      if (inc) {
        if (res.effects.verified) inc.locationVerified = true;
        inc.instructions = call.instructionsGiven || 0; inc.callerCalmed = !!call.calmed;
      }
    }
    const reply = res.lines.join(' ');
    call.pendingReply = true;
    const delay = clamp(0.5 + reply.length / 120, 0.7, 2.2) * sim.rng.float(0.8, 1.2);
    // optional local LLM rephrasing (falls back to the rule-based line)
    const deliver = (txt) => {
      call.pendingReply = false;
      if (call.status !== 'active') return;
      this.callerSays(call, txt);
      if (res.effects.end) sim.later(1.5, () => this.end(call.id, 'Call completed'));
    };
    if (sim.llm?.enabled) {
      sim.llm.rephrase(call, text, reply).then((txt) => sim.later(0.2, () => deliver(txt || reply))).catch(() => sim.later(delay, () => deliver(reply)));
    } else sim.later(delay, () => deliver(reply));
    bus.emit('call:updated', { call, understood: res.intents, effects: res.effects });
    return res;
  }

  end(id, reason = 'Disconnected by dispatcher') {
    const sim = this.sim; const call = this.byId(id);
    if (!call || ['ended', 'abandoned'].includes(call.status)) return;
    const wasAnswered = call.answeredAt != null;
    call.status = 'ended'; call.endedAt = sim.t; call.convo.ended = true; call.endReason = reason;
    this.addLine(call, 'system', reason);
    if (wasAnswered) { sim.stats.callsCompleted++; sim.stats.callDurations.push(sim.t - call.answeredAt); }
    if (call.sc.kind === 'misdial' || call.sc.kind === 'prank') sim.stats.misdials++;
    bus.emit('call:ended', { call });
  }

  /** Call back an abandoned or ended caller. */
  callback(id) {
    const sim = this.sim; const old = this.byId(id); if (!old) return null;
    const sc = JSON.parse(JSON.stringify(old.sc));
    const call = this.makeCall(sc, { isCallback: true, line: this.freeLine(), linkedIncidents: old.linkedIncidents.slice(), incidentId: old.incidentId });
    call.convo = old.status === 'abandoned' ? newConvo(sc) : old.convo; call.info = { ...old.info };
    sim.stats.callsReceived--; // a callback is not a new incoming call
    this.addLine(call, 'system', `Calling back ${sc.ani.phone}...`);
    old.calledBack = true;
    return this.answer(call.id);
  }

  /** Resolve the best coordinates for what the call-taker knows. */
  resolveLocation(call, form) {
    const sc = call.sc; const c = call.convo;
    const typed = (form.location || '').trim();
    if (form.useALI) {
      const a = addressFor(sc.ani.x, sc.ani.y);
      return { x: sc.ani.x, y: sc.ani.y, ...a, full: typed || sc.ani.address, short: typed || a.short, fromALI: true };
    }
    if (c.revealed.location || c.revealed.location_partial || sc.revealOnOpen?.includes('location')) {
      const l = sc.loc;
      return { ...l, full: typed || l.full, short: l.short || l.full };
    }
    // typed address – geocode it
    const geo = this.sim.geocode(typed);
    if (geo) return { ...geo, full: typed };
    // fall back to the caller's phone location
    const a = addressFor(sc.ani.x, sc.ani.y);
    return { x: sc.ani.x, y: sc.ani.y, ...a, full: typed || `${sc.ani.address} (approx.)`, short: typed || a.short, approximate: true };
  }

  /** Create an incident from the call-taker form. */
  createIncident(id, form = {}) {
    const sim = this.sim; const call = this.byId(id); if (!call) return null;
    const sc = call.sc;
    const typeId = form.typeId || sc.typeId || 'OTHER';
    const location = this.resolveLocation(call, form);
    const truth = sc.truth ? { ...sc.truth } : null;
    if (truth) truth.trueLoc = { x: sc.loc.x, y: sc.loc.y, full: sc.loc.full, short: sc.loc.short || sc.loc.full, street: sc.loc.street, cross: sc.loc.cross };
    const notesParts = [];
    for (const [k, v] of Object.entries(call.info)) if (v && !['location', 'nature', 'notes', 'name', 'phone'].includes(k)) notesParts.push(`${k}: ${v}`);
    const inc = sim.incidents.create({
      typeId, priority: parseInt(form.priority, 10) || TYPE[typeId]?.priority || sc.priority,
      severity: sc.kind === 'emergency' ? sc.severity : undefined,
      location, locationVerified: call.verified || !!sc.revealOnOpen?.includes('location'),
      caller: { name: call.info.name || 'Unknown', phone: call.info.phone || sc.ani.phone, persona: sc.caller.persona },
      description: form.description || call.info.nature || sc.natureNote || '',
      details: [...notesParts, ...(call.info.notes || [])], transcript: call.transcript, callId: call.id, source: 'call',
      answeredAt: call.answeredAt, instructions: call.instructionsGiven || 0, callerCalmed: !!call.calmed,
      truth, notes: form.notes,
    });
    inc.templateId = sc.templateId; inc.dupLines = sc.duplicateLines;
    if (truth) inc.sim.trueLoc = truth.trueLoc;
    call.incidentId = inc.id; call.linkedIncidents.push(inc.id);
    if (call.answeredAt != null) sim.stats.handlingTimes.push(sim.t - call.answeredAt);
    this.addLine(call, 'system', `Incident ${inc.number} created (${inc.typeLabel}).`);
    bus.emit('call:updated', { call });
    return inc;
  }

  linkToIncident(callId, incId) {
    const call = this.byId(callId); const inc = this.sim.incidents.byId(incId);
    if (!call || !inc) return false;
    if (!call.linkedIncidents.includes(inc.id)) call.linkedIncidents.push(inc.id);
    call.incidentId = inc.id;
    if (!inc.callIds.includes(call.id)) inc.callIds.push(call.id);
    this.sim.incidents.addHistory(inc, `Additional call linked (line ${call.line}, ${call.sc.ani.phone})`);
    for (const n of call.info.notes || []) inc.details.push(n);
    this.addLine(call, 'system', `Linked to incident ${inc.number}.`);
    if (call.duplicateOf === inc.id) this.sim.stats.duplicatesLinked++;
    bus.emit('incident:updated', { incident: inc }); bus.emit('call:updated', { call });
    return true;
  }

  /** Find open incidents near what the caller has told us (duplicate detection). */
  possibleDuplicates(call) {
    const sim = this.sim; const sc = call.sc;
    const known = call.convo.revealed.location ? { x: sc.loc.x, y: sc.loc.y } : { x: sc.ani.x, y: sc.ani.y };
    const r = call.convo.revealed.location ? 180 : Math.max(250, sc.ani.radius * 1.5);
    return sim.incidents.open().filter((i) => i.status !== 'completed' && !call.linkedIncidents.includes(i.id) && dist(known.x, known.y, i.location.x, i.location.y) < r);
  }

  /** A development sends a new line from a caller still on the line. */
  pushCallerUpdate(inc, line) {
    const call = this.list.find((c) => c.incidentId === inc.id && ['active', 'hold'].includes(c.status));
    if (call) this.callerSays(call, line);
  }

  /** A development spawns a related incident (e.g. evacuation from a wildfire). */
  spawnFollowUp(inc, typeId) {
    const sim = this.sim; const t = TYPE[typeId]; if (!t) return null;
    const loc = { ...inc.location, x: inc.location.x + sim.rng.float(-1, 1) * 120, y: inc.location.y + sim.rng.float(-1, 1) * 120 };
    const a = addressFor(loc.x, loc.y); Object.assign(loc, a);
    const child = sim.incidents.create({ typeId, location: loc, source: 'event', description: `Related to ${inc.number}: ${t.label}`, locationVerified: true });
    sim.incidents.addHistory(inc, `Related incident ${child.number} created (${t.label})`);
    return child;
  }
}

export { timeOfDay };
