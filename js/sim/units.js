// Unit management: creation, status machine, road movement, assignment rules.
import { UNIT_TYPES, TYPE_BY_ID, DEPT_BY_ID } from '../data/departments.js';
import { city, addressFor, nearestFacility, blockText } from '../data/city.js';
import { UNIT_STATUS_LABELS } from '../data/incidentTypes.js';
import { bus } from '../core/events.js';
import { dist } from '../core/util.js';

export const BASE_SPEED = 19; // meters per sim-second before modifiers
const ASSIGNABLE = new Set(['available', 'returning']);
const PERSONALITIES = ['formal', 'casual', 'terse', 'chatty'];
const LAST_NAMES = ['Ramirez', 'Chen', 'Okafor', 'Novak', 'Brooks', 'Patel', 'Kowalski', 'Hayes', 'Delgado', 'Murphy', 'Nguyen', 'Larsen',
  'Fitzgerald', 'Abernathy', 'Castillo', 'Holloway', 'Iverson', 'Mendez', 'Sato', 'Whitaker', 'Duarte', 'Lindqvist', 'Osei', 'Petrov',
  'Quinn', 'Reyes', 'Sullivan', 'Thornton', 'Vance', 'Webb', 'Young', 'Zimmerman', 'Baptiste', 'Carver', 'Donovan', 'Ellison'];

const BUSY_REASONS = {
  police: ['report writing', 'a meal break', 'court paperwork', 'fueling up', 'a citizen contact'],
  sheriff: ['transporting a prisoner', 'a civil process service', 'a meal break', 'report writing'],
  federal: ['an interview', 'a briefing', 'evidence processing'],
  fire: ['training', 'a fire inspection', 'fueling', 'equipment checks', 'a public education event'],
  ems: ['restocking', 'decontaminating the unit', 'a meal break', 'fueling'],
  default: ['maintenance', 'a meal break', 'a briefing', 'fueling'],
};

export class UnitManager {
  constructor(sim) { this.sim = sim; }
  get list() { return this.sim.state.units; }
  byId(id) { return this.list.find((u) => u.id === id); }
  byCallsign(cs) { const k = String(cs).toLowerCase().replace(/\s+/g, ''); return this.list.find((u) => u.callsign.toLowerCase().replace(/\s+/g, '') === k); }

  /** Build the roster from the database and the player's configuration. */
  init() {
    const cfg = this.sim.config;
    const r = this.sim.rng;
    const units = [];
    const mult = { small: 0.6, standard: 1, large: 1.6 }[cfg.unitCount] ?? 1;
    const fireStations = city.facilities.filter((f) => f.kind === 'fire');
    for (const type of UNIT_TYPES) {
      if (cfg.departments && cfg.departments[type.dept] === false) continue;
      if (cfg.unitTypes && cfg.unitTypes[type.id] === false) continue;
      const stations = city.facilities.filter((f) => type.station.includes(f.kind));
      if (!stations.length) continue;
      let numbers = type.numbers.slice();
      const count = Math.max(1, Math.round(numbers.length * mult));
      if (count < numbers.length) numbers = numbers.slice(0, count);
      let extra = Math.max(...numbers);
      while (numbers.length < count) { extra += type.perStation ? 1 : Math.max(1, Math.round(extra * 0.05) || 1); numbers.push(extra); }
      numbers.forEach((num, i) => {
        let station;
        if ((type.perStation || type.stationNumbers) && type.station.includes('fire') && fireStations[num - 1]) station = fireStations[num - 1];
        else station = stations[i % stations.length];
        units.push(this.makeUnit(type, num, station, r));
      });
    }
    this.sim.state.units = units;
  }

  makeUnit(type, num, station, r, extra = {}) {
    const dept = DEPT_BY_ID[type.dept];
    return {
      id: `u_${type.id}_${num}${extra.mutualAid ? '_ma' : ''}`, callsign: `${type.prefix} ${num}`, number: num, type: type.id, dept: dept.id,
      channel: type.channel, station: station.id, homeX: station.x, homeY: station.y,
      x: station.x + r.float(-8, 8), y: station.y + r.float(-8, 8),
      status: 'available', incident: null, path: null, dest: null, statusSince: this.sim.t, eta: 0,
      ackAt: 0, clearUntil: 0, busyUntil: 0, busyReason: '', oosUntil: 0, onSceneSince: 0, patients: 0,
      personality: r.pick(PERSONALITIES), officer: r.pick(LAST_NAMES), history: [], ...extra,
    };
  }

  type(u) { return TYPE_BY_ID[u.type]; }
  station(u) { return city.facilities.find((f) => f.id === u.station); }
  isAssignable(u) { return ASSIGNABLE.has(u.status); }
  statusLabel(u) {
    if (u.status === 'busy' && u.busyReason) return `Busy – ${u.busyReason}`;
    return UNIT_STATUS_LABELS[u.status] || u.status;
  }
  speed(u) {
    const t = this.type(u);
    const travel = this.sim.config.travelSpeed ?? 1;
    const wx = t.air ? (this.sim.weather?.airFactor() ?? 1) : (this.sim.router.weatherFactor || 1);
    return BASE_SPEED * (t.speed || 1) * travel * wx;
  }

  addHistory(u, text) {
    u.history.unshift({ t: this.sim.t, clock: this.sim.clock(), text });
    if (u.history.length > 60) u.history.length = 60;
  }

  setStatus(u, status, note) {
    if (u.status === status) return;
    const prev = u.status; u.status = status; u.statusSince = this.sim.t;
    this.addHistory(u, note || `Status: ${UNIT_STATUS_LABELS[status] || status}`);
    bus.emit('unit:status', { unit: u, prev, status });
  }

  routeTo(u, x, y) {
    const t = this.type(u);
    const water = t.id === 'marine' || t.id === 'coastguard';
    const route = this.sim.router.route(u.x, u.y, x, y, { air: !!t.air, water });
    u.path = { points: route.points, speeds: route.speeds || route.points.map(() => 1), i: 0, d: 0, length: route.length, travelled: 0 };
    u.eta = this.estimateTime(u, route);
    return route;
  }

  estimateTime(u, route) {
    if (!route) return 0;
    const sp = this.speed(u);
    if (!route.speeds) return route.length / sp;
    let tm = 0;
    for (let i = 1; i < route.points.length; i++) {
      const L = dist(route.points[i - 1][0], route.points[i - 1][1], route.points[i][0], route.points[i][1]);
      tm += L / (sp * (route.speeds[i - 1] || 1));
    }
    return tm;
  }

  /** ETA (sim seconds) from a unit's current position to a point, without moving it. */
  etaTo(u, x, y) {
    const t = this.type(u);
    const water = t.id === 'marine' || t.id === 'coastguard';
    const route = this.sim.router.route(u.x, u.y, x, y, { air: !!t.air, water });
    const base = this.estimateTime(u, route);
    const ack = u.status === 'available' ? 4 : u.status === 'returning' ? 3 : 8;
    return { seconds: base + ack, meters: route.length };
  }

  advance(u, dt) {
    const p = u.path; if (!p) return true;
    let move = this.speed(u) * dt;
    while (move > 0 && p.i < p.points.length - 1) {
      const [ax, ay] = p.points[p.i], [bx, by] = p.points[p.i + 1];
      const segL = dist(ax, ay, bx, by);
      const segSpeed = p.speeds[p.i] || 1;
      const remaining = segL - p.d;
      const can = move * segSpeed;
      if (can >= remaining) { move -= remaining / segSpeed; p.travelled += remaining; p.i++; p.d = 0; }
      else { p.d += can; p.travelled += can; move = 0; }
    }
    if (p.i >= p.points.length - 1) { const last = p.points[p.points.length - 1]; u.x = last[0]; u.y = last[1]; u.eta = 0; u.path = null; return true; }
    const [ax, ay] = p.points[p.i], [bx, by] = p.points[p.i + 1];
    const segL = dist(ax, ay, bx, by) || 1; const k = p.d / segL;
    u.x = ax + (bx - ax) * k; u.y = ay + (by - ay) * k;
    u.eta = Math.max(0, (p.length - p.travelled) / this.speed(u));
    return false;
  }

  update(dt) {
    const sim = this.sim; const t = sim.t;
    const bgRate = { off: 0, low: 0.0006, normal: 0.0013, high: 0.0024 }[sim.config.backgroundActivity] ?? 0.0013;
    for (const u of this.list) {
      switch (u.status) {
        case 'assigned':
          if (t >= u.ackAt) {
            const inc = sim.incidents.byId(u.incident);
            if (!inc) { this.sendHome(u); break; }
            this.routeTo(u, inc.location.x, inc.location.y);
            this.setStatus(u, 'responding', `Responding to ${inc.number}`);
            sim.radio.unitSays(u, 'enroute', { inc });
          }
          break;
        case 'responding':
          if (this.advance(u, dt)) sim.incidents.onUnitArrive(u);
          break;
        case 'transporting':
          if (this.advance(u, dt)) {
            const hosp = city.facilities.find((f) => f.id === u.dest?.id);
            this.setStatus(u, 'clearing', `Arrived at ${hosp?.name || 'hospital'}`);
            u.clearUntil = t + sim.rng.float(18, 34);
            sim.radio.unitSays(u, 'at_hospital', { hospital: hosp });
            sim.incidents.onPatientDelivered(u);
          }
          break;
        case 'clearing':
          if (t >= u.clearUntil) this.sendHome(u, true);
          break;
        case 'returning':
          if (this.advance(u, dt)) {
            this.setStatus(u, 'available', 'In quarters');
            if (u.mutualAid) this.releaseMutualAid(u);
          }
          break;
        case 'busy':
          if (t >= u.busyUntil) {
            this.setStatus(u, 'available', 'Back in service');
            if (sim.rng.chance(0.35)) sim.radio.unitSays(u, 'back_in_service', {});
          }
          break;
        case 'out_of_service':
          if (u.oosUntil && t >= u.oosUntil) { u.oosUntil = 0; this.setStatus(u, 'available', 'Returned to service'); sim.radio.unitSays(u, 'back_in_service', {}); }
          break;
        case 'available':
          if (bgRate && !u.mutualAid && sim.rng.chance(bgRate * dt)) this.backgroundActivity(u);
          break;
        default: break;
      }
    }
  }

  backgroundActivity(u) {
    const sim = this.sim;
    if (sim.paused || sim.state.mode === 'training') return;
    // Patrol units sometimes self-initiate a small incident (traffic stop, flagged down).
    if ((u.type === 'patrol' || u.type === 'traffic' || u.type === 'deputy') && sim.config.selfInitiated !== false && sim.rng.chance(0.45)) {
      sim.incidents.createSelfInitiated(u);
      return;
    }
    const reasons = BUSY_REASONS[u.dept] || BUSY_REASONS.default;
    u.busyReason = sim.rng.pick(reasons);
    u.busyUntil = sim.t + sim.rng.float(45, 160);
    this.setStatus(u, 'busy', `Busy – ${u.busyReason}`);
    if (sim.rng.chance(0.5)) sim.radio.unitSays(u, 'busy', { reason: u.busyReason });
  }

  sendHome(u, announce = false) {
    if (u.mutualAid) {
      u.incident = null; u.patients = 0; u.dest = { kind: 'station', id: u.station };
      this.routeTo(u, u.homeX, u.homeY); this.setStatus(u, 'returning', 'Released – returning to home county');
      return;
    }
    const st = this.station(u) || nearestFacility(u.x, u.y);
    u.incident = null; u.patients = 0; u.dest = { kind: 'station', id: st.id };
    if (dist(u.x, u.y, st.x, st.y) < 15) { this.setStatus(u, 'available', 'In quarters'); return; }
    this.routeTo(u, st.x, st.y);
    this.setStatus(u, 'returning', `Returning to ${st.short || st.name}`);
    if (announce) this.sim.radio.unitSays(u, 'available', {});
  }

  /**
   * Assign units to an incident. Player freedom: any unit, any incident.
   * Returns a report so the UI can explain anything that was not assigned.
   */
  assign(unitIds, incidentId, { override = false, silent = false } = {}) {
    const sim = this.sim;
    const inc = sim.incidents.byId(incidentId);
    const report = { assigned: [], reassigned: [], skipped: [] };
    if (!inc) { report.error = 'Incident not found.'; return report; }
    if (inc.status === 'closed') { report.error = `${inc.number} is closed. Reopen it to assign units.`; return report; }
    const allowBusy = override || sim.config.availabilityOverride;
    for (const id of unitIds) {
      const u = this.byId(id);
      if (!u) { report.skipped.push({ id, callsign: id, reason: 'Unit not found' }); continue; }
      if (u.incident === inc.id && ['assigned', 'responding', 'on_scene'].includes(u.status)) {
        report.skipped.push({ id, callsign: u.callsign, reason: 'Already assigned to this incident' }); continue;
      }
      if (!this.isAssignable(u) && !allowBusy) {
        report.skipped.push({ id, callsign: u.callsign, reason: `${this.statusLabel(u)} – enable the availability override to pull this unit` }); continue;
      }
      if (u.status === 'transporting' && !override) {
        report.skipped.push({ id, callsign: u.callsign, reason: 'Transporting a patient – will be available after the hospital' }); continue;
      }
      if (u.incident && u.incident !== inc.id) {
        const prevInc = sim.incidents.byId(u.incident);
        if (prevInc) sim.incidents.detachUnit(prevInc, u, `Reassigned to ${inc.number}`);
        report.reassigned.push({ id, callsign: u.callsign, from: prevInc?.number });
      }
      u.incident = inc.id; u.dest = { kind: 'incident', id: inc.id }; u.path = null; u.patients = 0;
      u.busyReason = ''; u.oosUntil = 0;
      u.ackAt = sim.t + sim.rng.float(1.5, 5.5);
      this.setStatus(u, 'assigned', `Assigned to ${inc.number} (${inc.typeLabel})`);
      sim.incidents.attachUnit(inc, u);
      report.assigned.push({ id, callsign: u.callsign });
    }
    if (report.assigned.length) {
      if (!silent) sim.radio.dispatchTone(inc, report.assigned.map((a) => this.byId(a.id)));
      sim.stats.unitsDispatched += report.assigned.length;
      for (const a of report.assigned) sim.stats.deptCounts[this.byId(a.id).dept] = (sim.stats.deptCounts[this.byId(a.id).dept] || 0) + 1;
      bus.emit('unit:assigned', { incident: inc, report });
    }
    return report;
  }

  /** Remove a unit from its incident and send it home. */
  unassign(unitId, { reason = 'Released by dispatch', silent = false } = {}) {
    const u = this.byId(unitId); if (!u) return { ok: false, reason: 'Unit not found' };
    if (!u.incident) return { ok: false, reason: `${u.callsign} is not assigned to an incident` };
    if (u.status === 'transporting') return { ok: false, reason: `${u.callsign} is transporting a patient` };
    const inc = this.sim.incidents.byId(u.incident);
    const wasOnScene = u.status === 'on_scene';
    if (inc) this.sim.incidents.detachUnit(inc, u, reason);
    if (!silent) this.sim.radio.unitSays(u, wasOnScene ? 'clear_scene' : 'disregard', { inc });
    this.sendHome(u);
    return { ok: true };
  }

  recall(unitId) {
    const u = this.byId(unitId); if (!u) return;
    if (u.incident) return this.unassign(unitId, { reason: 'Recalled to station' });
    if (['busy', 'available', 'clearing'].includes(u.status)) { this.sendHome(u); return { ok: true }; }
    return { ok: false, reason: 'Unit cannot be recalled right now' };
  }

  setOutOfService(unitId, on, reason = 'Out of service by dispatch') {
    const u = this.byId(unitId); if (!u) return;
    if (on) {
      if (u.incident) this.unassign(unitId, { reason: 'Placed out of service', silent: true });
      u.path = null; u.oosUntil = 0; u.busyReason = reason;
      this.setStatus(u, 'out_of_service', reason);
    } else {
      u.busyReason = '';
      const st = this.station(u);
      if (st && dist(u.x, u.y, st.x, st.y) > 15) this.sendHome(u); else this.setStatus(u, 'available', 'Returned to service');
    }
    bus.emit('unit:status', { unit: u });
  }

  /** Request mutual aid units from a neighboring county (Director unlock). */
  requestMutualAid(typeId, count = 2) {
    const type = TYPE_BY_ID[typeId]; if (!type) return [];
    const edge = this.sim.rng.pick([{ x: -380, y: 5900, from: 'Hamilton County' }, { x: 1700, y: -380, from: 'Wayne County' }, { x: 2650, y: 10880, from: 'Gallatin County' }, { x: 10950, y: -380, from: 'Edwards County' }]);
    const fakeStation = { id: `ma_${typeId}`, x: edge.x, y: edge.y, name: edge.from, short: 'Mutual Aid' };
    const created = [];
    for (let i = 0; i < count; i++) {
      const num = 900 + this.list.filter((u) => u.mutualAid).length + i + 1;
      const u = this.makeUnit(type, num, fakeStation, this.sim.rng, { mutualAid: true, callsign: `MA ${type.prefix} ${num}` });
      u.callsign = `MA ${type.prefix} ${num}`; u.station = fakeStation.id; u.stationName = edge.from;
      this.list.push(u); created.push(u);
      this.addHistory(u, 'Mutual aid unit staged at county line');
    }
    bus.emit('unit:status', {});
    return created;
  }

  releaseMutualAid(u) {
    const i = this.list.indexOf(u); if (i >= 0) this.list.splice(i, 1);
    bus.emit('unit:status', {});
  }

  locationText(u) {
    if (u.status === 'available' || (u.status === 'busy' && !u.path)) {
      const st = this.station(u); if (st && dist(u.x, u.y, st.x, st.y) < 25) return `At ${st.short || st.name}`;
    }
    const a = addressFor(u.x, u.y);
    return blockText(a);
  }

  counts() {
    const c = { total: 0, available: 0, committed: 0, oos: 0 };
    for (const u of this.list) {
      c.total++;
      if (this.isAssignable(u)) c.available++; else if (u.status === 'out_of_service') c.oos++; else c.committed++;
    }
    return c;
  }
}
