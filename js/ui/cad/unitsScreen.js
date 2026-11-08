// Units roster + unit detail, and department management.
import { Screen } from './cad.js';
import { bus } from '../../core/events.js';
import { bindActions, modal, toast } from '../dom.js';
import { esc } from '../../core/util.js';
import { pri, unitStatus, callsign, clock, etaText, deptDot } from '../fmt.js';
import { DEPARTMENTS, TYPE_BY_ID, UNIT_TYPES, CHANNEL_BY_ID, DEPT_BY_ID } from '../../data/departments.js';
import { UNIT_STATUS_LABELS, UNIT_STATUS_COLORS } from '../../data/incidentTypes.js';
import { city } from '../../data/city.js';

export class UnitsScreen extends Screen {
  constructor(cad) { super(cad, 'units', 'Units', '🚓'); this.dept = 'all'; this.status = 'all'; this.search = ''; }

  build() {
    this.root.innerHTML = `<div class="toolbar"><select class="input" data-r="dept" style="width:auto"></select><select class="input" data-r="status" style="width:auto"></select>
      <input class="input grow" data-r="search" placeholder="Search callsign or type…" style="min-width:120px"></div><div class="pane-body scroll" data-r="table"></div>`;
    const q = (k) => this.root.querySelector(`[data-r="${k}"]`);
    q('dept').innerHTML = `<option value="all">All departments</option>${DEPARTMENTS.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}`;
    q('status').innerHTML = `<option value="all">All statuses</option><option value="assignable">Assignable</option>${Object.entries(UNIT_STATUS_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}`;
    q('dept').addEventListener('change', (e) => { this.dept = e.target.value; this.render(); });
    q('status').addEventListener('change', (e) => { this.status = e.target.value; this.render(); });
    q('search').addEventListener('input', (e) => { this.search = e.target.value.toLowerCase(); this.render(); });
    bindActions(this.root, { unit: (t) => this.openUnit(t.dataset.u) });
    bus.on('unit:status', () => this.invalidate());
  }
  tick() { this.invalidate(); }

  render() {
    const sim = this.sim;
    let list = sim.units.list;
    if (this.dept !== 'all') list = list.filter((u) => u.dept === this.dept);
    if (this.status === 'assignable') list = list.filter((u) => sim.units.isAssignable(u)); else if (this.status !== 'all') list = list.filter((u) => u.status === this.status);
    if (this.search) list = list.filter((u) => `${u.callsign} ${TYPE_BY_ID[u.type].name}`.toLowerCase().includes(this.search));
    const box = this.root.querySelector('[data-r="table"]');
    box.innerHTML = list.length ? `<table class="table"><thead><tr><th>Unit</th><th class="hide-narrow">Type</th><th>Status</th><th>Incident</th><th class="hide-narrow">Location</th></tr></thead><tbody>
      ${list.map((u) => { const inc = u.incident ? sim.incidents.byId(u.incident) : null; return `<tr class="click" data-act="unit" data-u="${u.id}"><td>${callsign(u)}</td><td class="hide-narrow dim">${esc(TYPE_BY_ID[u.type].name)}</td><td>${unitStatus(u, sim)}</td>
        <td class="mono">${inc ? `${pri(inc.priority)} ${esc(inc.number)}` : '<span class="dim">–</span>'}</td><td class="hide-narrow dim" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sim.units.locationText(u))}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">No units match.</div>';
  }

  openUnit(id) {
    const sim = this.sim; const game = this.game; const self = this;
    const body = document.createElement('div');
    const m = modal({ title: 'Unit details', body, wide: true, onAction: (a, t) => act(a, t), onClose: () => off() });
    const off = bus.on('unit:status', ({ unit }) => { if (!unit || unit.id === id) draw(); });
    function act(a, t) {
      const u = sim.units.byId(id); if (!u) return;
      if (a === 'assign') { const incId = body.querySelector('[data-r="inc"]').value; if (!incId) return; const rep = sim.units.assign([id], incId, { override: sim.config.availabilityOverride }); game.reportAssignment(rep, sim.incidents.byId(incId)); }
      else if (a === 'unassign') { const r = sim.units.unassign(id); if (!r.ok) toast(r.reason, { level: 'warn' }); }
      else if (a === 'recall') { const r = sim.units.recall(id); if (r && !r.ok) toast(r.reason, { level: 'warn' }); }
      else if (a === 'oos') sim.units.setOutOfService(id, u.status !== 'out_of_service');
      else if (a === 'status') { sim.radio.playerTransmit({ unitId: id, intent: 'status' }); toast(`Status check sent to ${u.callsign}`, { level: 'radio' }); }
      else if (a === 'eta') sim.radio.playerTransmit({ unitId: id, intent: 'eta' });
      else if (a === 'map') { m.close(); self.cad.screens.map.sel = { kind: 'unit', id }; self.cad.screens.map.focusOn(u.x, u.y); self.cad.showScreen('map'); }
      else if (a === 'inc') { m.close(); self.cad.selectIncident(t.dataset.id); }
      draw();
    }
    function draw() {
      const u = sim.units.byId(id); if (!u) { m.close(); return; }
      const ty = TYPE_BY_ID[u.type]; const st = city.facilities.find((f) => f.id === u.station);
      const inc = u.incident ? sim.incidents.byId(u.incident) : null;
      const openIncs = sim.incidents.open().filter((i) => i.status !== 'completed' && i.id !== u.incident);
      m.setTitle(`${esc(u.callsign)} – ${esc(ty.name)}`);
      body.innerHTML = `<div class="row wrap" style="gap:16px;align-items:flex-start">
        <dl class="kv grow" style="min-width:240px">
          <dt>Identifier</dt><dd>${callsign(u)}${u.mutualAid ? ' (mutual aid)' : ''}</dd>
          <dt>Department</dt><dd>${deptDot(u.dept)} ${esc(DEPT_BY_ID[u.dept].name)}</dd>
          <dt>Unit type</dt><dd>${esc(ty.name)}</dd>
          <dt>Radio channel</dt><dd>${esc(CHANNEL_BY_ID[u.channel].name)}</dd>
          <dt>Status</dt><dd>${unitStatus(u, sim)}${u.status === 'responding' || u.status === 'transporting' || u.status === 'returning' ? ` · ETA ${etaText(sim, u.eta)}` : ''}</dd>
          <dt>Assignment</dt><dd>${inc ? `<a href="#" data-act="inc" data-id="${inc.id}">${esc(inc.number)}</a> ${esc(inc.typeLabel)}` : 'None'}</dd>
          <dt>Station</dt><dd>${esc(st?.name || 'Neighboring county')}</dd>
          <dt>Location</dt><dd>${esc(sim.units.locationText(u))}</dd>
          <dt>Crew</dt><dd>${u.type === 'patrol' || u.type === 'deputy' ? 'Ofc.' : 'Lt.'} ${esc(u.officer)} · radio style: ${esc(u.personality)}</dd>
        </dl>
        <div class="col" style="min-width:220px">
          <div class="row"><select class="input grow" data-r="inc"><option value="">Assign to incident…</option>${openIncs.map((i) => `<option value="${i.id}" ${i.id === self.cad.selectedIncident ? 'selected' : ''}>${esc(i.number)} – ${esc(i.typeLabel)}</option>`).join('')}</select><button class="btn sm primary" data-act="assign">Assign</button></div>
          <div class="row wrap"><button class="btn sm" data-act="status">📻 Status</button><button class="btn sm" data-act="eta">📻 ETA</button><button class="btn sm" data-act="map">🗺 Map</button>
          ${u.incident ? '<button class="btn sm danger" data-act="unassign">Remove from incident</button>' : ''}<button class="btn sm" data-act="recall">Return to station</button>
          <button class="btn sm ${u.status === 'out_of_service' ? 'good' : 'warn'}" data-act="oos">${u.status === 'out_of_service' ? 'Return to service' : 'Out of service'}</button></div>
          <div class="dim" style="font-size:.82em">Capabilities: ${Object.entries(ty.caps).map(([k, v]) => `${k.replace(/_/g, ' ')}${v < 1 ? ` (${Math.round(v * 100)}%)` : ''}`).join(', ')}</div>
        </div></div>
        <div class="section-title">Assignment & status history</div>
        <div class="timeline">${u.history.map((h) => `<div><span class="tm">${clock(h.clock, game)}</span><span>${esc(h.text)}</span></div>`).join('') || '<div class="dim">No activity yet.</div>'}</div>`;
    }
    draw();
  }
}

export class DepartmentsScreen extends Screen {
  constructor(cad) { super(cad, 'departments', 'Departments', '🏢'); }
  build() {
    this.root.innerHTML = '<div class="pane-body scroll" data-r="body"></div>';
    bindActions(this.root, {
      units: (t) => { const s = this.cad.screens.units; s.dept = t.dataset.d; s.status = 'all'; this.cad.showScreen('units'); s.root.querySelector('[data-r="dept"]').value = t.dataset.d; s.invalidate(); },
      recallall: (t) => { let n = 0; for (const u of this.sim.units.list) if (u.dept === t.dataset.d && ['clearing', 'busy'].includes(u.status)) { this.sim.units.sendHome(u); n++; } toast(`${n} unit(s) told to return to quarters`, { level: 'info' }); },
      mutual: (t) => this.mutualAid(t.dataset.d),
    });
    bus.on('unit:status', () => this.invalidate());
  }
  tick() { this.invalidate(); }
  render() {
    const sim = this.sim;
    const canMA = this.game.career.has('mutual_aid', sim.state.mode);
    this.root.querySelector('[data-r="body"]').innerHTML = `<div class="cards">${DEPARTMENTS.map((d) => {
      const units = sim.units.list.filter((u) => u.dept === d.id); if (!units.length) return '';
      const byStatus = {}; for (const u of units) byStatus[u.status] = (byStatus[u.status] || 0) + 1;
      const avail = units.filter((u) => sim.units.isAssignable(u)).length;
      const types = UNIT_TYPES.filter((t) => t.dept === d.id).map((t) => { const us = units.filter((u) => u.type === t.id); return us.length ? `<div class="row" style="font-size:.9em"><span class="grow dim">${esc(t.name)}</span><span class="mono">${us.filter((u) => sim.units.isAssignable(u)).length}/${us.length}</span></div>` : ''; }).join('');
      return `<div class="card"><h4><span class="dot" style="background:${d.color}"></span>${esc(d.name)}<span class="grow"></span><span class="mono ${avail ? 'good' : 'bad'}">${avail}/${units.length}</span></h4>
        <div class="bar-row"><div class="bar">${Object.entries(byStatus).map(([s, n]) => `<i style="width:${(n / units.length) * 100}%;background:${UNIT_STATUS_COLORS[s]};display:inline-block;border-radius:0"></i>`).join('')}</div></div>
        <div class="dim" style="font-size:.8em;margin:4px 0 6px">Channel: ${esc(CHANNEL_BY_ID[d.channel].name)}</div>${types}
        <div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="units" data-d="${d.id}">View units</button><button class="btn sm" data-act="recallall" data-d="${d.id}">Recall clearing/busy</button>
        ${canMA && ['police', 'fire', 'ems', 'sheriff'].includes(d.id) ? `<button class="btn sm" data-act="mutual" data-d="${d.id}">Mutual aid</button>` : ''}</div></div>`;
    }).join('')}</div>`;
  }
  mutualAid(dept) {
    const typeId = { police: 'patrol', fire: 'engine', ems: 'ambulance', sheriff: 'deputy' }[dept];
    const units = this.sim.units.requestMutualAid(typeId, 2);
    for (const u of units) { this.sim.radio.push({ channel: u.channel, from: u.callsign, text: `${u.callsign}, mutual aid from Westfield County, staged at the county line and available.`, kind: 'available' }); }
    toast(`Mutual aid: ${units.map((u) => u.callsign).join(', ')} available`, { level: 'good' });
  }
}

export { UNIT_TYPES };
