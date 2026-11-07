// Radio communications: channels, context-aware unit traffic, dispatcher
// transmissions, and two-way player radio queries.
import { CHANNEL_BY_ID, TYPE_BY_ID, CAPABILITY_REQUEST_PHRASE } from '../data/departments.js';
import { bus } from '../core/events.js';
import { fill, oxford } from '../core/util.js';

// Each kind has templates for: fire, police, ems, other. {cs} callsign, plus context vars.
// Templates prefixed with an object {p:'terse'|'chatty'|'formal'|'casual'} can be personality-specific.
const L = {
  enroute: {
    fire: ['{cs}, responding.', '{cs} copies, en route.', '{cs} responding from quarters.', 'Dispatch, {cs}, show us en route, ETA {eta}.', '{cs}, copy that, we are rolling.'],
    police: ['{cs}, copy, en route.', '{cs} responding, ETA {eta}.', '{cs}, show me en route from {from}.', 'Copy, {cs} heading that way.', '{cs}, en route, {eta} out.'],
    ems: ['{cs} responding.', '{cs}, copy, en route, ETA {eta}.', '{cs} en route from {from}.', 'Dispatch, {cs} copies, responding.'],
    other: ['{cs} copies, en route.', '{cs} responding, ETA {eta}.', '{cs} on the way.'],
  },
  onscene_first: {
    fire: ['{cs} on scene. {sizeup}', '{cs} arriving on scene, {sizeup}', 'Dispatch, {cs} on location. {sizeup} {cs} will be command.', '{cs} is on scene. {sizeup}'],
    police: ['{cs} on scene. {sizeup}', '{cs}, I\'m out on scene. {sizeup}', '{cs} arrived. {sizeup}', 'Dispatch, {cs} on location. {sizeup}'],
    ems: ['{cs} on scene. {sizeup}', '{cs} arriving, {sizeup}', '{cs} on location, making patient contact. {sizeup}'],
    other: ['{cs} on scene. {sizeup}', '{cs} arriving. {sizeup}'],
  },
  onscene: {
    fire: ['{cs} on scene.', '{cs} on location, reporting to command.', '{cs} arriving.', '{cs} is on scene, staging.'],
    police: ['{cs} on scene.', '{cs}, arriving.', '{cs} out with the other unit.', '{cs} on location.'],
    ems: ['{cs} on scene.', '{cs} arriving on location.', '{cs} on scene, coming in with the stretcher.'],
    other: ['{cs} on scene.', '{cs} arriving.'],
  },
  request: {
    any: ['{cs} to dispatch, we\'re going to need {phrase} at this location.', 'Dispatch, {cs}, requesting {phrase} to the scene.',
      '{cs}, can you start me {phrase}?', '{cs}, be advised, I need {phrase} out here.', 'Dispatch from {cs}, go ahead and send {phrase}, {reason}',
      '{cs}, we could really use {phrase} on this one.'],
  },
  development: { any: ['{cs}, be advised: {text}', 'Dispatch, {cs}, update: {text}', '{cs} to dispatch – {text}', '{cs}, heads up: {text}'] },
  under_control: {
    fire: ['{cs}, fire is knocked down, we are under control.', 'Command to dispatch, we have the situation under control.', '{cs}, primary search negative, fire under control.', '{cs}, we\'re getting the upper hand, under control.'],
    police: ['{cs}, scene is secure.', '{cs}, situation is under control.', '{cs}, everything is code four for now.', '{cs}, we have it contained.'],
    ems: ['{cs}, patient is stable.', '{cs}, we have the patient stabilized.', '{cs}, things are under control here.'],
    other: ['{cs}, situation is under control.', '{cs}, we have it handled.'],
  },
  clear: {
    fire: ['{cs}, all companies are clearing {number}. {disp}', 'Dispatch, {cs}, we\'re wrapping up, {disp}', '{cs} clearing the scene, {disp}', '{cs}, terminate command, {disp}'],
    police: ['{cs}, clear, {disp}', '{cs}, all units clear of {number}, {disp}', '{cs} clearing, {disp}', 'Dispatch, {cs}, I\'m clear, {disp}'],
    ems: ['{cs}, clearing the scene, {disp}', '{cs}, clear, {disp}'],
    other: ['{cs}, all done here. {disp}', '{cs} clear, {disp}'],
  },
  clear_scene: { any: ['{cs} clear of the scene.', '{cs}, clear and returning.', '{cs} is clear.', '{cs}, clearing.'] },
  disregard: { any: ['{cs}, copy, disregarding.', '{cs}, copy, breaking off.', '{cs}, copy, cancelled.', 'Copy, {cs} returning.'] },
  transporting: { any: ['{cs} transporting {count} to {hospital}, {pri}.', '{cs}, we\'re en route to {hospital} with {count}, {pri}.', '{cs}, transporting {pri} to {hospital}.', 'Dispatch, {cs}, leaving the scene with {count} for {hospital}.'] },
  at_hospital: { any: ['{cs} at {hospital}.', '{cs} arriving at {hospital}.', '{cs}, out at the hospital.'] },
  available: {
    any: ['{cs} available.', '{cs}, back in service.', '{cs} clear and available.', '{cs}, available for calls.', '{cs} returning, available.'],
  },
  back_in_service: { any: ['{cs} back in service.', '{cs}, available.', '{cs}, I\'m clear, back in service.'] },
  busy: { any: ['{cs}, I\'ll be out on {reason}.', '{cs}, show me out on {reason}.', '{cs} will be tied up with {reason}.', '{cs} out of service for {reason}, I can break if needed.'] },
  self_initiated: { any: ['{cs}, show me out on a {what}, {location}, on a {veh}, plate {plate}.', '{cs}, I\'ll be {what}, {location}.', '{cs}, {what}, {location}. Will advise.'] },
  refusal: { any: ['{cs}, patient is refusing transport, getting a signature now.', '{cs}, family will transport, we\'re getting a refusal.', '{cs}, no transport needed, patient refused care.'] },
  status_reply: { any: ['{cs}, {status}.', 'Dispatch, {cs}, {status}.', '{cs}, go ahead – {status}.'] },
  eta_reply: { any: ['{cs}, ETA {eta}.', '{cs}, about {eta} out.', '{cs}, give us {eta}.'] },
  copy: { any: ['{cs}, copy.', '{cs}, ten-four.', 'Copy that, {cs}.', '{cs}, understood.'] },
  bolo_ack: { any: ['{cs}, copy the BOLO.', '{cs}, copy, we\'ll keep an eye out.', '{cs}, copy, checking the area.'] },
  bolo_found: { any: ['{cs}, I think I\'ve got eyes on the vehicle from that BOLO, {location}.', '{cs}, possible match on the BOLO, {location}, stopping it now.', '{cs}, located a subject matching the description, {location}.'] },
  wrong_address: { any: ['{cs}, nothing at this address. Caller is flagging us down from {location}, relocating.', '{cs}, negative contact here – we\'re being waved down at {location}, moving over.', 'Dispatch, {cs}, wrong address. Scene is actually at {location}, we\'re relocating.'] },
  unable: { any: ['{cs}, unable, we\'re committed.', '{cs}, negative, we\'re tied up right now.', '{cs}, can\'t do it, we\'re busy here.'] },
};

const TEN_CODES = [
  [/\bcopy\b(?:,)? en route\b/i, '10-4, en route'], [/\bon scene\b/i, '10-97'], [/\bavailable\b/i, '10-8'], [/\bback in service\b/i, '10-8'],
  [/\bcopy\b/i, '10-4'], [/\bclear\b(?= and| of|,|\.)/i, '10-98'],
];

function deptGroup(u) {
  if (!u) return 'other';
  if (u.dept === 'fire') return 'fire';
  if (u.dept === 'ems') return 'ems';
  if (['police', 'sheriff', 'federal'].includes(u.dept)) return 'police';
  return 'other';
}

const DISPOSITIONS = {
  police: ['report taken.', 'parties advised.', 'one in custody.', 'gone on arrival.', 'unfounded, all quiet.', 'warning issued.', 'citation issued.', 'handled, no further action.', 'referred to detectives.'],
  traffic: ['tow is on scene, roadway is open.', 'drivers exchanged info, report taken.', 'roadway cleared.', 'citation issued.'],
  fire: ['investigation complete, turning it over to the owner.', 'all hazards mitigated.', 'scene turned over to the property manager.', 'returning to quarters.'],
  medical: ['patient care transferred.', 'all patients accounted for.', 'returning to service.'],
  rescue: ['all parties accounted for.', 'rescue complete.'],
  hazard: ['hazard mitigated.', 'utility has it from here.', 'area is safe.'],
  service: ['all set here.', 'issue resolved.', 'handled.'],
  federal: ['scene turned over to federal investigators.', 'evidence collected, clearing.'],
  weather: ['area is stabilized.', 'crews will continue cleanup in the morning.'],
};

export class RadioSystem {
  constructor(sim) { this.sim = sim; this.recent = {}; }
  get log() { return this.sim.state.radio; }

  push(msg) {
    const s = this.sim.state;
    s.seq.radio = (s.seq.radio || 0) + 1;
    const full = { id: s.seq.radio, t: this.sim.t, clock: this.sim.clock(), ...msg };
    s.radio.push(full);
    if (s.radio.length > 400) s.radio.splice(0, s.radio.length - 400);
    this.sim.stats.radioMessages++;
    bus.emit('radio:message', full);
    return full;
  }

  pickTemplate(kind, group, personality) {
    const set = L[kind]; if (!set) return '{cs}.';
    const list = set[group] || set.any || set.other || Object.values(set)[0];
    const key = `${kind}:${group}`;
    const recent = this.recent[key] || (this.recent[key] = []);
    let options = list.map((_, i) => i).filter((i) => !recent.includes(i));
    if (!options.length) options = list.map((_, i) => i);
    // terse personalities prefer the shortest lines, chatty the longest
    let idx;
    if (personality === 'terse' && this.sim.rng.chance(0.6)) idx = options.sort((a, b) => list[a].length - list[b].length)[0];
    else if (personality === 'chatty' && this.sim.rng.chance(0.5)) idx = options.sort((a, b) => list[b].length - list[a].length)[0];
    else idx = this.sim.rng.pick(options);
    recent.push(idx); if (recent.length > Math.min(3, list.length - 1)) recent.shift();
    return list[idx];
  }

  etaText(seconds) {
    const gameMin = Math.max(1, Math.round((seconds * (this.sim.state.time.clockRate || 6)) / 60));
    return gameMin === 1 ? 'one minute' : `${gameMin} minutes`;
  }

  /** A unit transmits. kind: see L. ctx: { inc, hospital, cap, text, ... } */
  unitSays(u, kind, ctx = {}) {
    if (!u) return null;
    const sim = this.sim; const group = deptGroup(u);
    const inc = ctx.inc;
    const vars = {
      cs: u.callsign, number: inc?.number || '', eta: this.etaText(u.eta || 60), from: sim.units.locationText(u),
      sizeup: ctx.sizeup || (inc ? this.sizeupFor(inc, u) : ''), hospital: ctx.hospital?.short || ctx.hospital?.name || 'the hospital',
      count: ctx.count === 1 || !ctx.count ? 'one patient' : `${ctx.count} patients`, pri: ctx.critical ? 'priority one, emergent' : this.sim.rng.pick(['priority two', 'non-emergent', 'priority three']),
      phrase: ctx.cap ? (CAPABILITY_REQUEST_PHRASE[ctx.cap] || ctx.cap) : 'additional units', reason: ctx.cap ? this.requestReason(ctx.cap, inc) : '',
      text: ctx.text || '', disp: inc ? this.disposition(inc) : '', reason2: ctx.reason, what: ctx.what, veh: ctx.veh, plate: ctx.plate,
      location: ctx.location || '', status: ctx.status || '',
    };
    if (kind === 'busy') vars.reason = ctx.reason;
    let text = fill(this.pickTemplate(kind, group, u.personality), vars, sim.rng);
    if (sim.config.tenCodes && group === 'police') for (const [re, rep] of TEN_CODES) text = text.replace(re, rep);
    const urgent = ['request', 'development'].includes(kind) || (kind === 'onscene_first' && inc?.priority === 1);
    return this.push({ channel: u.channel, from: u.callsign, unit: u.id, incident: inc?.id || u.incident || null, text, kind, urgent });
  }

  sizeupFor(inc, u) {
    if (inc.sim.sizeup) return fill(inc.sim.sizeup, { unit: u.callsign, ...inc.location }, this.sim.rng);
    const g = deptGroup(u); const r = this.sim.rng;
    const by = {
      fire: ['Nothing showing, we\'ll be investigating.', 'Light smoke showing, investigating.', 'Checking it out, will advise.'],
      police: ['Will advise.', 'Making contact now.', 'Checking the area.', 'Speaking with the reporting party.'],
      ems: ['Making patient contact.', 'Will advise on patient status.'],
      other: ['Will advise.', 'Assessing now.'],
    };
    return r.pick(by[g]);
  }

  requestReason(cap, inc) {
    const r = this.sim.rng;
    const reasons = {
      suppression: ['fire is spreading.', 'we need more water on this.'], ladder: ['we need roof access.', 'we need ventilation.'],
      bls: ['we have an injured party.', 'we have someone hurt here.'], als: ['patient is in bad shape.', 'we need a paramedic.'],
      transport: ['we have a patient who needs transport.', 'patient needs to go to the hospital.'], patrol: ['we need traffic and crowd control.', 'need scene security.'],
      tactical: ['subject is armed and refusing to come out.', 'this is a tactical situation.'], k9: ['suspect fled on foot.', 'need a track.'],
      traffic: ['traffic is backing up badly.', 'need the intersection shut down.'], rescue: ['we have someone pinned.', 'we need extrication tools.'],
      fire_command: ['this is getting big.', 'need command on scene.'], hazmat: ['unknown substance leaking.', 'possible chemical hazard.'],
      investigation: ['this needs a detective.', 'need follow-up investigation.'], forensics: ['need the scene processed.', 'there is evidence to collect.'],
    };
    return reasons[cap] ? r.pick(reasons[cap]) : 'it\'s needed here.';
  }

  disposition(inc) {
    const list = DISPOSITIONS[inc.category] || DISPOSITIONS.service;
    if (inc.sim.clearText) return fill(inc.sim.clearText, inc.location, this.sim.rng);
    return this.sim.rng.pick(list);
  }

  /** Dispatcher announces an assignment, grouped by radio channel. */
  dispatchTone(inc, units) {
    const byChannel = {};
    for (const u of units) (byChannel[u.channel] ||= []).push(u);
    const cross = inc.location.cross ? `, cross street ${inc.location.cross}` : '';
    for (const [ch, list] of Object.entries(byChannel)) {
      const names = oxford(list.map((u) => u.callsign));
      const desc = inc.description ? ` ${inc.description.split(/[.!?]/)[0].slice(0, 90)}.` : '';
      const text = `${names}, respond ${inc.priority === 1 ? 'priority one ' : ''}to a ${inc.typeLabel.toLowerCase()}, ${inc.location.short || inc.location.full}${cross}.${desc} Incident ${inc.number}.`;
      this.push({ channel: ch, from: 'Dispatch', text, incident: inc.id, kind: 'dispatch', dispatcher: true });
    }
    bus.emit('radio:tone', { priority: inc.priority });
  }

  /**
   * The player transmits to a unit or a whole channel.
   * intent: 'status' | 'eta' | 'update' | 'need' | 'cancel' | 'return' | 'copy' | 'expedite' | 'free'
   */
  playerTransmit({ unitId, channel, intent, text }) {
    const sim = this.sim; const u = unitId ? sim.units.byId(unitId) : null;
    const ch = channel || u?.channel || 'police';
    if (intent === 'free' || !intent) intent = this.classify(text || '');
    const lines = {
      status: `${u ? u.callsign : 'All units'}, dispatch, what's your status?`,
      eta: `${u ? u.callsign : 'Units'}, dispatch, advise your ETA.`,
      update: `${u ? u.callsign : 'Units on scene'}, dispatch, can I get an update?`,
      need: `${u ? u.callsign : 'Units on scene'}, do you need anything else?`,
      cancel: `${u ? u.callsign : 'Units'}, disregard, you can cancel.`,
      return: `${u ? u.callsign : 'Units'}, you're clear to return to quarters.`,
      copy: `${u ? u.callsign : ''} copy.`.trim(),
      expedite: `${u ? u.callsign : 'Units'}, step it up, upgrade to priority one.`,
    };
    const said = (text && text.trim()) ? text.trim() : (lines[intent] || lines.status);
    this.push({ channel: ch, from: 'Dispatch', text: said, kind: 'player', dispatcher: true, unit: u?.id || null, incident: u?.incident || null });
    const targets = u ? [u] : sim.units.list.filter((x) => x.channel === ch && x.incident).slice(0, 2);
    targets.forEach((t, i) => {
      sim.state.radioQueue.push({ at: sim.t + 1.6 + i * 1.8 + sim.rng.float(0, 1.5), unitId: t.id, intent });
    });
    return intent;
  }

  classify(text) {
    const t = text.toLowerCase();
    if (/\b(eta|how far|how long|time of arrival)\b/.test(t)) return 'eta';
    if (/\b(disregard|cancel|stand down|break off|never ?mind)\b/.test(t)) return 'cancel';
    if (/\b(return|quarters|go home|back to (the )?station)\b/.test(t)) return 'return';
    if (/\b(need anything|need any|additional|more units|resources)\b/.test(t)) return 'need';
    if (/\b(update|situation|what do you have|what('| i)s going on|progress)\b/.test(t)) return 'update';
    if (/\b(expedite|step it up|hurry|priority one|code 3|lights and sirens)\b/.test(t)) return 'expedite';
    if (/\b(status|where are you|location|you okay|are you ok)\b/.test(t)) return 'status';
    if (/\b(copy|10-4|ten four|roger|understood)\b/.test(t)) return 'copy';
    return 'status';
  }

  update() {
    const sim = this.sim; const q = sim.state.radioQueue;
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].at > sim.t) continue;
      const item = q.splice(i, 1)[0];
      const u = sim.units.byId(item.unitId); if (!u) continue;
      this.replyTo(u, item.intent);
    }
  }

  replyTo(u, intent) {
    const sim = this.sim; const inc = u.incident ? sim.incidents.byId(u.incident) : null;
    switch (intent) {
      case 'eta':
        if (u.status === 'responding' || u.status === 'transporting' || u.status === 'returning') return this.unitSays(u, 'eta_reply', { inc });
        if (u.status === 'on_scene') return this.unitSays(u, 'status_reply', { inc, status: 'we\'re already on scene' });
        return this.unitSays(u, 'status_reply', { inc, status: sim.units.statusLabel(u).toLowerCase() });
      case 'cancel':
        if (u.incident && u.status !== 'transporting') { sim.units.unassign(u.id, { reason: 'Cancelled over the radio', silent: false }); return null; }
        return this.unitSays(u, 'copy', {});
      case 'return':
        if (u.incident && u.status !== 'transporting') { sim.units.unassign(u.id, { reason: 'Released over the radio' }); return null; }
        if (u.status !== 'returning' && u.status !== 'available') sim.units.sendHome(u);
        return this.unitSays(u, 'copy', {});
      case 'need': {
        if (!inc) return this.unitSays(u, 'status_reply', { status: 'we\'re good, nothing needed' });
        const cov = sim.incidents.coverage(inc, { onScene: false });
        const miss = cov.perNeed.filter((n) => n.ratio < 0.6).sort((a, b) => b.need - a.need)[0];
        if (miss) { sim.incidents.addHistory(inc, `${u.callsign} advises they could use ${miss.cap.replace(/_/g, ' ')}`); if (!inc.requests.some((r) => r.cap === miss.cap)) inc.requests.push({ cap: miss.cap, t: sim.t, clock: sim.clock() }); bus.emit('incident:updated', { incident: inc }); return this.unitSays(u, 'request', { inc, cap: miss.cap }); }
        return this.unitSays(u, 'status_reply', { inc, status: sim.rng.pick(['we\'re good, thanks', 'we have enough resources', 'nothing further needed right now']) });
      }
      case 'expedite':
        if (inc) sim.incidents.setPriority(inc, 1);
        return this.unitSays(u, 'copy', { inc });
      case 'copy':
        return null;
      case 'update':
      case 'status':
      default: {
        let status;
        if (u.status === 'responding') status = `still en route, about ${this.etaText(u.eta)} out`;
        else if (u.status === 'on_scene' && inc) {
          const p = inc.sim.progress;
          status = p < 0.25 ? sim.rng.pick(['just getting started here', 'still assessing the situation', 'we\'re working on it'])
            : p < 0.6 ? sim.rng.pick(['making progress', 'working the scene, things are going okay', 'about halfway through'])
              : p < 0.9 ? sim.rng.pick(['we\'re wrapping things up', 'it\'s under control, finishing up', 'should be clear shortly'])
                : 'about to clear';
          const patients = inc.sim.patients - inc.sim.transported;
          if (patients > 0) status += `, ${patients} patient${patients > 1 ? 's' : ''} on scene`;
        } else status = sim.units.statusLabel(u).toLowerCase() + (u.status === 'available' ? ', ready for a call' : '');
        return this.unitSays(u, 'status_reply', { inc, status });
      }
    }
  }

  /** Broadcast a Be-On-the-Look-Out to police units for an incident. */
  broadcastBOLO(inc, text) {
    const sim = this.sim;
    inc.bolo = { text, t: sim.t };
    sim.incidents.addHistory(inc, `BOLO broadcast: ${text}`);
    this.push({ channel: 'police', from: 'Dispatch', text: `All units, BOLO in reference to incident ${inc.number}: ${text}`, kind: 'bolo', dispatcher: true, incident: inc.id });
    const patrols = sim.units.list.filter((u) => ['patrol', 'traffic', 'deputy'].includes(u.type) && sim.units.isAssignable(u));
    const acks = sim.rng.pickN(patrols, Math.min(2, patrols.length));
    acks.forEach((u, i) => setTimeoutSim(sim, 2.5 + i * 2.2, () => this.unitSays(u, 'bolo_ack', { inc })));
    // chance a patrol finds the subject later
    if (inc.sim.bolo !== false && patrols.length && sim.rng.chance(0.45)) {
      sim.state.timers.push({ at: sim.t + sim.rng.float(40, 120), action: 'boloFound', incId: inc.id });
    }
    bus.emit('incident:updated', { incident: inc });
  }
}

function setTimeoutSim(sim, delay, fn) { sim.later(delay, fn); }

export { L as RADIO_TEMPLATES, CHANNEL_BY_ID };
