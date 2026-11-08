// Save system: browser localStorage profile with autosave, manual save,
// and export/import for moving progress between devices (no cloud sync).
import { bus } from './events.js';
import { deepMerge, deepClone } from './util.js';

const KEY = 'dispatchsim.profile.v1';
const SHIFT_KEY = 'dispatchsim.shift.v1';

export function newProfile() {
  return {
    version: 1, created: new Date().toISOString(), updated: null, settings: {},
    career: { xp: 0, shifts: 0, pendingXP: 0 },
    lifetime: { calls: 0, incidents: 0, unitsDispatched: 0, majorIncidents: 0, shifts: 0, playSeconds: 0 },
    shiftReports: [], completedIncidents: [], preferredDepartments: [], tutorialDone: false,
    freeplayConfig: null, customConfig: null, achievements: [],
  };
}

function storage() {
  try { if (typeof localStorage !== 'undefined') { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } } catch { /* blocked */ }
  const mem = new Map();
  return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
}

export class SaveSystem {
  constructor() { this.store = storage(); this.profile = this.load(); this.lastSaved = 0; }

  load() {
    try {
      const raw = this.store.getItem(KEY);
      if (raw) return deepMerge(newProfile(), JSON.parse(raw));
    } catch (e) { console.warn('Profile load failed, starting fresh', e); }
    return newProfile();
  }

  save() {
    this.profile.updated = new Date().toISOString();
    try { this.store.setItem(KEY, JSON.stringify(this.profile)); this.lastSaved = Date.now(); bus.emit('save:done', {}); return true; }
    catch (e) { console.warn('Save failed', e); bus.emit('save:failed', { error: e }); return false; }
  }

  /** Save the in-progress shift so it can be resumed. */
  saveShift(sim) {
    if (!sim || sim.state.mode === 'training') return false;
    try {
      const data = sim.serialize();
      // trim bulky history to stay well under storage limits
      data.state.radio = data.state.radio.slice(-150);
      data.state.calls = data.state.calls.filter((c) => !['ended', 'abandoned'].includes(c.status) || data.state.calls.indexOf(c) < 25);
      this.store.setItem(SHIFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), mode: sim.state.mode, simT: sim.t, data }));
      this.save();
      return true;
    } catch (e) { console.warn('Shift save failed', e); return false; }
  }

  loadShift() {
    try { const raw = this.store.getItem(SHIFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  hasShift() { return !!this.store.getItem(SHIFT_KEY); }
  clearShift() { this.store.removeItem(SHIFT_KEY); }

  recordIncident(inc) {
    const summary = { number: inc.number, type: inc.typeLabel, category: inc.category, priority: inc.priority, severity: inc.severity,
      location: inc.location.full, created: inc.createdClock, units: inc.unitHistory.filter((u) => u.action === 'Assigned').map((u) => u.unit),
      xp: inc.eval?.total || 0, date: new Date().toISOString() };
    this.profile.completedIncidents.unshift(summary);
    if (this.profile.completedIncidents.length > 300) this.profile.completedIncidents.length = 300;
    this.profile.lifetime.incidents++;
    if (inc.severity === 'major') this.profile.lifetime.majorIncidents++;
  }

  recordShift(report) {
    this.profile.shiftReports.unshift(report);
    if (this.profile.shiftReports.length > 50) this.profile.shiftReports.length = 50;
    this.profile.lifetime.shifts++;
    this.profile.lifetime.calls += report.callsReceived;
    this.profile.lifetime.unitsDispatched += report.unitsDispatched;
    this.profile.lifetime.playSeconds += report.shiftDurationSec;
    this.save();
  }

  exportString() {
    const shift = this.loadShift();
    return JSON.stringify({ app: '911-dispatch-simulator', version: 1, exported: new Date().toISOString(), profile: this.profile, shift }, null, 0);
  }

  importString(text) {
    let obj;
    try { obj = JSON.parse(text); } catch { throw new Error('That file is not valid save data (could not parse JSON).'); }
    if (!obj || obj.app !== '911-dispatch-simulator' || !obj.profile) throw new Error('That file is not a 911 Dispatch Simulator save.');
    this.profile = deepMerge(newProfile(), obj.profile);
    if (obj.shift) this.store.setItem(SHIFT_KEY, JSON.stringify(obj.shift)); else this.clearShift();
    this.save();
    bus.emit('save:imported', {});
    return true;
  }

  reset() { this.profile = newProfile(); this.clearShift(); this.save(); }
  snapshotSettings(settings) { this.profile.settings = deepClone(settings.data); }
}
