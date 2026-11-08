// Shift report rendering – informative, never punishing.
import { esc, fmtDuration } from '../core/util.js';
import { DEPT_BY_ID } from '../data/departments.js';
import { WEATHER_TYPES } from '../sim/weather.js';

export function reportHTML(r) {
  const stat = (label, val) => `<div class="stat"><span>${label}</span><b>${val}</b></div>`;
  const depts = Object.entries(r.deptCounts || {}).sort((a, b) => b[1] - a[1]);
  const max = depts.length ? depts[0][1] : 1;
  const gm = (m) => (m ? `${Math.round(m)} min` : '—');
  return `<div class="stat-grid">
      ${stat('Calls received', r.callsReceived)}${stat('Calls answered', r.callsAnswered)}${stat('Calls completed', r.callsCompleted)}
      ${stat('Incidents created', r.incidentsCreated)}${stat('Incidents completed', r.incidentsCompleted)}${stat('Still active', r.activeIncidents)}
      ${stat('Units dispatched', r.unitsDispatched)}${stat('Departments used', r.departmentsUsed)}${stat('Major incidents', r.majorIncidents)}
      ${stat('Avg. call handling', r.avgHandlingSec ? `${fmtDuration(r.avgHandlingSec)}` : '—')}${stat('Avg. response (game)', gm(r.avgResponseGameMin))}
      ${stat('Shift duration', `${fmtDuration(r.shiftDurationSec)}`)}${stat('Patients transported', r.transports)}${stat('Instructions given', r.instructionsGiven)}
      ${stat('Experience earned', `+${r.xpEarned}`)}
    </div>
    ${depts.length ? `<div class="section-title">Dispatches by department</div>${depts.map(([d, n]) => `<div class="bar-row"><span style="width:170px">${esc(DEPT_BY_ID[d]?.name || d)}</span><div class="bar"><i style="width:${(n / max) * 100}%;background:${DEPT_BY_ID[d]?.color || '#888'}"></i></div><span class="mono" style="width:30px;text-align:right">${n}</span></div>`).join('')}` : ''}
    <div class="dim" style="margin-top:12px;font-size:.85em">Weather: ${esc(WEATHER_TYPES[r.weather]?.label || r.weather || '—')} · Non-emergency calls: ${r.nonEmergency || 0} · Duplicate calls linked: ${r.duplicatesLinked || 0} · Radio transmissions: ${r.radioMessages || 0}.
    Statistics are just for fun – there are no penalties for taking your time.</div>`;
}
