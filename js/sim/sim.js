// The simulation core. Owns all serializable game state and composes every
// subsystem. It runs headless (no DOM) so it can be unit-tested in Node.
import { RNG, clamp, deepMerge, deepClone } from '../core/util.js';
import { bus } from '../core/events.js';
import { Router, addressFor, geocodeAddress, blockText } from '../data/city.js';
import { matchStreet, extractAddress } from '../ai/nlu.js';
import { UnitManager } from './units.js';
import { IncidentManager } from './incidents.js';
import { RadioSystem } from './radio.js';
import { CallManager } from './calls.js';
import { WeatherSystem } from './weather.js';
import { CityEvents } from './cityEvents.js';

export const SHIFT_STARTS = { morning: 7 * 60, afternoon: 13 * 60, evening: 17 * 60 + 30, night: 22 * 60 };

export const DEFAULT_CONFIG = {
  mode: 'free',
  callFrequency: 'relaxed', majorFrequency: 'occasional', nonEmergency: true,
  categories: { police: true, traffic: true, fire: true, medical: true, rescue: true, hazard: true, service: true, federal: true, weather: true },
  severities: { small: true, medium: true, major: true },
  departments: {}, unitTypes: {}, unitCount: 'standard',
  availabilityOverride: false, backgroundActivity: 'normal', selfInitiated: true, callerHangups: false,
  relaxed: true, difficulty: 'normal', travelSpeed: 1, autoClearUnits: true, autoClose: false, tenCodes: false, cityEvents: true,
  weather: 'clear', dynamicWeather: true, startTime: 'morning', shiftLength: 0, timeScale: 1,
};

export function newStats() {
  return { callsReceived: 0, callsAnswered: 0, callsCompleted: 0, callsAbandoned: 0, nonEmergency: 0, misdials: 0, incidentsCreated: 0,
    incidentsCompleted: 0, incidentsClosed: 0, majorIncidents: 0, unitsDispatched: 0, deptCounts: {}, handlingTimes: [], responseTimes: [],
    ringTimes: [], callDurations: [], radioMessages: 0, transports: 0, xpEarned: 0, instructionsGiven: 0, duplicatesLinked: 0 };
}

export class Sim {
  constructor(config = {}, saved = null) {
    this.config = deepMerge(deepClone(DEFAULT_CONFIG), saved?.config || config);
    this.router = new Router();
    this.units = new UnitManager(this);
    this.incidents = new IncidentManager(this);
    this.radio = new RadioSystem(this);
    this.calls = new CallManager(this);
    this.weather = new WeatherSystem(this);
    this.cityEvents = new CityEvents(this);
    this.timers = []; // transient (not saved) callbacks
    this.paused = false; this.onBreak = false;
    this.career = null; this.llm = null; this.audio = null;
    if (saved?.state) {
      this.state = saved.state;
      this.rng = new RNG(this.state.rngState);
      this.weather.apply(); this.cityEvents.restore();
      // pending transient replies are lost on load – clear the flags
      for (const c of this.state.calls) c.pendingReply = false;
    } else {
      const seed = (config.seed ?? Math.random() * 2 ** 32) >>> 0;
      this.rng = new RNG(seed);
      const startMin = typeof this.config.startTime === 'number' ? this.config.startTime : SHIFT_STARTS[this.config.startTime] ?? SHIFT_STARTS.morning;
      const clockRate = this.config.shiftLength ? (8 * 3600) / (this.config.shiftLength * 60) : 6;
      this.state = {
        version: 1, seed, rngState: seed, mode: this.config.mode,
        time: { sim: 0, clockStart: startMin, clockRate, day: new Date().toISOString().slice(0, 10) },
        seq: { incident: 0, call: 0, radio: 0 }, units: [], incidents: [], calls: [], radio: [], radioQueue: [], timers: [],
        notifications: [], events: [], weather: null, stats: newStats(), nextCallAt: 0, nextEventAt: 200, shiftEnded: false,
      };
      this.units.init();
      this.weather.init();
      this.calls.scheduleNext(true);
    }
  }

  get t() { return this.state.time.sim; }
  get stats() { return this.state.stats; }
  /** Current game clock in minutes since midnight. */
  clock() { const tm = this.state.time; return (tm.clockStart + (tm.sim * tm.clockRate) / 60) % 1440; }
  shiftProgress() { return this.config.shiftLength ? clamp(this.t / (this.config.shiftLength * 60), 0, 1) : 0; }

  later(delay, fn) { this.timers.push({ at: this.t + delay, fn }); }

  notify(text, level = 'info', ref = {}) {
    const n = { id: `n_${this.state.notifications.length}_${Math.floor(this.t)}`, t: this.t, clock: this.clock(), text, level, ...ref, read: false };
    this.state.notifications.unshift(n);
    if (this.state.notifications.length > 150) this.state.notifications.length = 150;
    bus.emit('notify', n);
    return n;
  }

  setPaused(p) { this.paused = !!p; bus.emit('game:paused', { paused: this.paused }); }
  setBreak(b) { this.onBreak = !!b; bus.emit('game:break', { onBreak: this.onBreak }); }

  setConfig(patch) {
    const prevFreq = this.config.callFrequency;
    deepMerge(this.config, patch);
    if (patch.callFrequency && patch.callFrequency !== prevFreq) this.calls.scheduleNext();
    if (patch.weather && patch.weather !== this.weather.current()) this.weather.set(patch.weather);
    bus.emit('config:changed', { config: this.config, patch });
  }

  /** Advance the simulation by real seconds. */
  update(realDt) {
    if (this.paused) return;
    let dt = clamp(realDt, 0, 0.5) * (this.config.timeScale || 1);
    while (dt > 0) {
      const step = Math.min(dt, 0.25); dt -= step;
      this.state.time.sim += step;
      this.units.update(step);
      this.incidents.update(step);
      this.calls.update(step);
      this.radio.update(step);
      this.weather.update(step);
      this.cityEvents.update(step);
      this.runTimers();
    }
    this.state.rngState = this.rng.state;
    if (this.config.shiftLength && !this.state.shiftEnded && this.t >= this.config.shiftLength * 60) {
      this.state.shiftEnded = true; bus.emit('shift:ended', { sim: this });
    }
    bus.emit('sim:tick', { t: this.t });
  }

  runTimers() {
    const now = this.t;
    if (this.timers.length) {
      const due = this.timers.filter((tm) => tm.at <= now);
      if (due.length) { this.timers = this.timers.filter((tm) => tm.at > now); for (const tm of due) { try { tm.fn(); } catch (e) { console.error(e); } } }
    }
    // serializable timers
    const st = this.state.timers;
    for (let i = st.length - 1; i >= 0; i--) if (st[i].at <= now) this.runStateTimer(st.splice(i, 1)[0]);
  }

  runStateTimer(tm) {
    if (tm.action === 'boloFound') {
      const inc = this.incidents.byId(tm.incId);
      if (!inc || inc.status === 'closed') return;
      const u = this.units.list.find((x) => ['patrol', 'traffic', 'deputy'].includes(x.type) && this.units.isAssignable(x));
      if (!u) return;
      const a = addressFor(u.x, u.y);
      this.radio.unitSays(u, 'bolo_found', { inc, location: blockText(a) });
      this.units.assign([u.id], inc.id, { silent: true });
      this.incidents.addHistory(inc, `${u.callsign} located a subject/vehicle matching the BOLO`);
      inc.sim.workload = Math.max(30, inc.sim.workload * 0.8);
    }
  }

  /** Turn a typed address ("412 W Main St", "2145 Burnt Prairie Rd, Grayville") into map coordinates. */
  geocode(text) {
    if (!text) return null;
    const { number, street } = extractAddress(text);
    const s = street || matchStreet(text);
    if (!s) return null;
    return geocodeAddress(/^(I-|IL-|US-)/.test(s) ? null : number, s, text);
  }

  serialize() {
    this.state.rngState = this.rng.state;
    return { config: deepClone(this.config), state: deepClone(this.state) };
  }

  /** Shift report (informative, never punishing). */
  report() {
    const s = this.stats; const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const open = this.incidents.open().length;
    const rate = this.state.time.clockRate;
    return {
      callsReceived: s.callsReceived, callsAnswered: s.callsAnswered, callsCompleted: s.callsCompleted, callsAbandoned: s.callsAbandoned,
      nonEmergency: s.nonEmergency, incidentsCreated: s.incidentsCreated, incidentsCompleted: s.incidentsCompleted, activeIncidents: open,
      unitsDispatched: s.unitsDispatched, departmentsUsed: Object.keys(s.deptCounts).length, deptCounts: { ...s.deptCounts },
      majorIncidents: s.majorIncidents, avgHandlingSec: avg(s.handlingTimes), avgHandlingGameMin: (avg(s.handlingTimes) * rate) / 60,
      avgResponseGameMin: (avg(s.responseTimes) * rate) / 60, avgAnswerSec: avg(s.ringTimes), transports: s.transports,
      instructionsGiven: s.instructionsGiven, duplicatesLinked: s.duplicatesLinked, radioMessages: s.radioMessages,
      shiftDurationSec: this.t, shiftDurationGameMin: (this.t * rate) / 60, xpEarned: s.xpEarned, mode: this.state.mode,
      completedShift: !!this.config.shiftLength && this.state.shiftEnded, date: new Date().toISOString(), weather: this.weather.current(),
    };
  }
}
