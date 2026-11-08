// Shared formatting for CAD views.
import { esc, fmtClock } from '../core/util.js';
import { UNIT_STATUS_COLORS, UNIT_STATUS_LABELS, INCIDENT_STATUS_LABELS, INCIDENT_CATEGORIES, PRIORITY_LABELS } from '../data/incidentTypes.js';
import { DEPT_BY_ID, TYPE_BY_ID, CHANNEL_BY_ID } from '../data/departments.js';

export const INC_STATUS_COLORS = {
  new: '#64d2ff', pending: '#b0b8c4', awaiting: '#ff9f43', assigned: '#f2c94c', active: '#ff5a4e', under_control: '#2fd08a', completed: '#4fc3f7', closed: '#6f819b',
};

export function pri(p) { return `<span class="pri pri-${p}" title="${PRIORITY_LABELS[p] || ''}">P${p}</span>`; }
export function incStatus(s) { return `<span class="status-pill"><span class="dot" style="background:${INC_STATUS_COLORS[s] || '#888'}"></span>${INCIDENT_STATUS_LABELS[s] || s}</span>`; }
export function unitStatus(u, sim) {
  const label = sim ? sim.units.statusLabel(u) : UNIT_STATUS_LABELS[u.status];
  return `<span class="status-pill"><span class="dot" style="background:${UNIT_STATUS_COLORS[u.status] || '#888'}"></span>${esc(label)}</span>`;
}
export function deptDot(deptId) { const d = DEPT_BY_ID[deptId]; return `<span class="dot" style="background:${d?.color || '#888'}" title="${esc(d?.name || '')}"></span>`; }
export function callsign(u) { return `<span class="callsign" style="color:${DEPT_BY_ID[u.dept]?.color || '#fff'}">${esc(u.callsign)}</span>`; }
export function catColor(cat) { return INCIDENT_CATEGORIES[cat]?.color || '#9fb3c8'; }
export function chanTag(id) { const c = CHANNEL_BY_ID[id]; return `<span class="ch" style="background:${c?.color || '#888'}">${esc(c?.short || id)}</span>`; }
export function typeName(u) { return TYPE_BY_ID[u.type]?.name || u.type; }

/** Elapsed sim seconds → game-time string ("12m", "1h 05m"). */
export function gameAge(sim, sinceT) {
  const min = Math.max(0, ((sim.t - sinceT) * (sim.state.time.clockRate || 6)) / 60);
  if (min < 1) return '<1m';
  if (min < 60) return `${Math.floor(min)}m`;
  return `${Math.floor(min / 60)}h ${String(Math.floor(min % 60)).padStart(2, '0')}m`;
}
export function clock(m, game) { const c = fmtClock(m); if (game?.settings?.data.ui.clock24 === false) { const [h, mm] = c.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; } return c; }
export function etaText(sim, seconds) { const m = Math.max(1, Math.round((seconds * (sim.state.time.clockRate || 6)) / 60)); return `${m} min`; }
export { esc };
