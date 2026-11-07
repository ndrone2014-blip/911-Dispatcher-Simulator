// Career progression: ranks, XP, shift completion and unlockable upgrades.
import { bus } from '../core/events.js';

export const RANKS = [
  { id: 'trainee', name: 'Dispatcher Trainee', xp: 0, shifts: 0, freq: 'relaxed' },
  { id: 'junior', name: 'Junior Dispatcher', xp: 600, shifts: 2, freq: 'relaxed' },
  { id: 'senior', name: 'Senior Dispatcher', xp: 1800, shifts: 5, freq: 'normal' },
  { id: 'supervisor', name: 'Dispatch Supervisor', xp: 4000, shifts: 9, freq: 'normal' },
  { id: 'director', name: 'Communications Director', xp: 8000, shifts: 14, freq: 'busy' },
];

export const UPGRADES = [
  { id: 'avl_overlay', rank: 1, name: 'AVL Route Overlay', desc: 'Shows each responding unit\'s route and live ETA on the city map.' },
  { id: 'third_monitor', rank: 1, name: 'Third Monitor', desc: 'Adds a third monitor to your workstation in the dispatch center.' },
  { id: 'ergo_chair', rank: 1, name: 'Ergonomic Chair', desc: 'A proper high-back dispatcher chair at your desk.' },
  { id: 'delegation', rank: 2, name: 'Call Delegation', desc: 'Hand pending low-priority incidents to a coworker to dispatch for you.' },
  { id: 'espresso', rank: 2, name: 'Break Room Espresso Machine', desc: 'The good coffee. Finally.' },
  { id: 'extra_staff', rank: 2, name: 'Extra Workstations Staffed', desc: 'More coworkers on the floor during your shifts.' },
  { id: 'supervisor_tools', rank: 3, name: 'Supervisor Tools', desc: 'Operations dashboard: bulk recall, out-of-service management, incident review.' },
  { id: 'supervisor_office', rank: 3, name: 'Supervisor Office Workstation', desc: 'Dispatch from the supervisor office as an alternate workstation.' },
  { id: 'mutual_aid', rank: 4, name: 'Mutual Aid Requests', desc: 'Request extra units from neighboring counties when you run low.' },
  { id: 'video_wall', rank: 4, name: '4K Video Wall', desc: 'Upgrades the front status wall with live map and incident boards.' },
];

export function rankIndexFor(xp, shifts) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (xp >= r.xp && shifts >= r.shifts) idx = i; });
  return idx;
}

export class Career {
  constructor(profile) { this.profile = profile; }
  get data() { return this.profile.career; }
  rankIndex() { return rankIndexFor(this.data.xp, this.data.shifts); }
  rank() { return RANKS[this.rankIndex()]; }
  nextRank() { return RANKS[this.rankIndex() + 1] || null; }

  /** In free play / custom everything is unlocked; in career it depends on rank. */
  has(id, mode) {
    if (mode !== 'career') return true;
    const u = UPGRADES.find((x) => x.id === id);
    return !u || this.rankIndex() >= u.rank;
  }

  onIncidentClosed(inc, mode) {
    if (mode !== 'career' || !inc.eval) return;
    this.data.pendingXP = (this.data.pendingXP || 0) + inc.eval.total;
  }

  /** Bank shift XP, count the shift and check for promotion. Returns {xp, promoted, rank}. */
  finishShift(report) {
    const before = this.rankIndex();
    const xp = (this.data.pendingXP || 0) + (report.completedShift ? 100 : 0);
    this.data.xp += xp; this.data.pendingXP = 0;
    if (report.completedShift) this.data.shifts += 1;
    const after = this.rankIndex();
    const promoted = after > before;
    if (promoted) bus.emit('career:rankup', { rank: RANKS[after], unlocks: UPGRADES.filter((u) => u.rank > before && u.rank <= after) });
    return { xp, promoted, rank: RANKS[after], unlocks: UPGRADES.filter((u) => u.rank > before && u.rank <= after) };
  }
}
