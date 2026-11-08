// Incident list + incident detail.
import { Screen } from './cad.js';
import { bus } from '../../core/events.js';
import { el, bindActions, toast, modal, confirmBox } from '../dom.js';
import { esc } from '../../core/util.js';
import { pri, incStatus, unitStatus, callsign, gameAge, clock, etaText, catColor } from '../fmt.js';
import { INCIDENT_TYPES, INCIDENT_CATEGORIES, TYPE, INCIDENT_STATUS_LABELS, INCIDENT_STATUSES } from '../../data/incidentTypes.js';
import { CAPABILITY_LABELS, TYPE_BY_ID } from '../../data/departments.js';
import { openAssignModal } from './assignModal.js';
import { delegate, STAFF } from '../../ai/staffDialogue.js';
import { jurisdiction, premise, unitTimes, incidentTimers, fmtMin, latLon } from './cadDetail.js';

const FILTERS = { open: 'Open', unassigned: 'Unassigned', active: 'Active', completed: 'Completed', closed: 'Closed', all: 'All' };

function typeOptions(selected) {
  const groups = {};
  for (const t of INCIDENT_TYPES) (groups[t.category] ||= []).push(t);
  return Object.entries(groups).map(([cat, list]) => `<optgroup label="${INCIDENT_CATEGORIES[cat]?.label || cat}">${list.map((t) => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${t.label}</option>`).join('')}</optgroup>`).join('');
}

export class IncidentsScreen extends Screen {
  constructor(cad) { super(cad, 'incidents', 'Incidents', '🚨'); this.filter = 'open'; this.search = ''; this.detailId = null; this.subtab = 'timeline'; }

  badge() { return this.sim ? this.sim.incidents.open().filter((i) => !i.units.length && i.status !== 'completed').length : 0; }

  build() {
    this.root.innerHTML = `<div class="pane" style="height:100%" data-r="list"></div><div class="pane" style="height:100%" data-r="detail" hidden></div>`;
    this.listEl = this.root.querySelector('[data-r="list"]'); this.detailEl = this.root.querySelector('[data-r="detail"]');
    this.listEl.innerHTML = `<div class="toolbar"><span data-r="filters" class="row wrap" style="gap:4px"></span><span class="grow"></span>
      <input class="input" style="width:150px" data-r="search" placeholder="Search…">
      <button class="btn sm" data-act="closeall" title="Close all completed incidents">Close completed</button>
      <button class="btn sm primary" data-act="newinc">➕ New</button></div>
      <div class="pane-body scroll" data-r="table"></div>`;
    this.listEl.querySelector('[data-r="search"]').addEventListener('input', (e) => { this.search = e.target.value.toLowerCase(); this.renderList(); });
    bindActions(this.root, {
      filter: (t) => { this.filter = t.dataset.f; this.renderList(); },
      row: (t) => this.openDetail(t.dataset.id),
      back: () => this.closeDetail(),
      newinc: () => this.newIncidentModal(),
      closeall: () => { const done = this.sim.incidents.list.filter((i) => i.status === 'completed'); done.forEach((i) => this.game.closeIncident(i)); toast(`${done.length} incident(s) closed`, { level: 'good' }); },
      assign: () => this.openAssign(this.detailId),
      assignrec: () => this.assignRecommended(),
      pickrec: () => this.openAssign(this.detailId, { preselectRecommended: true }),
      unassign: (t) => { const r = this.sim.units.unassign(t.dataset.u); if (!r.ok) toast(r.reason, { level: 'warn' }); },
      clearunit: (t) => this.sim.incidents.clearUnit(this.inc(), this.sim.units.byId(t.dataset.u)),
      reassign: (t) => this.reassignModal(t.dataset.u),
      complete: () => { this.sim.incidents.complete(this.inc(), true); toast('Incident marked completed. Units are clearing.', { level: 'good' }); },
      close: () => this.closeIncident(),
      reopen: () => this.sim.incidents.reopen(this.inc()),
      pending: () => { const i = this.inc(); this.sim.incidents.setStatus(i, i.status === 'pending' ? (i.units.length ? 'assigned' : 'awaiting') : 'pending', i.status === 'pending' ? 'Released from hold' : 'Held as pending by dispatcher'); },
      addnote: () => this.addNote(),
      sub: (t) => { this.subtab = t.dataset.t; this.renderDetail(); },
      bolo: () => this.boloModal(),
      delegate: () => this.doDelegate(),
      applytype: () => { const i = this.inc(); if (i.suggestedType) { this.sim.incidents.setType(i, i.suggestedType); i.suggestedType = null; } },
      editloc: () => this.editLocation(),
      mapfocus: () => { this.cad.screens.map?.focusOn(this.inc().location.x, this.inc().location.y); this.cad.showScreen('map'); },
      unit: (t) => this.cad.screens.units.openUnit(t.dataset.u),
    });
    this.root.addEventListener('change', (e) => {
      const i = this.inc(); if (!i) return;
      const a = e.target.dataset.act;
      if (a === 'settype') this.sim.incidents.setType(i, e.target.value);
      else if (a === 'setpri') this.sim.incidents.setPriority(i, e.target.value);
      else if (a === 'setstatus') this.setStatus(i, e.target.value);
    });
    this.root.addEventListener('keydown', (e) => { if (e.target.dataset.r === 'note' && e.key === 'Enter') { e.preventDefault(); this.addNote(); } });
    for (const ev of ['incident:created', 'incident:updated', 'incident:closed', 'unit:status', 'unit:assigned']) bus.on(ev, () => this.invalidate());
    if (this.detailId) { this.listEl.hidden = true; this.detailEl.hidden = false; }
  }

  inc() { return this.detailId ? this.sim.incidents.byId(this.detailId) : null; }
  openDetail(id) {
    this.detailId = id; this.cad.selectedIncident = id; this.detailBuiltFor = null;
    if (!this.built) return; // applied when the screen is first built/rendered
    this.listEl.hidden = true; this.detailEl.hidden = false; this.detailBuiltFor = null; this.invalidate(); bus.emit('cad:selectIncident', { id }); }
  closeDetail() { this.detailId = null; this.listEl.hidden = false; this.detailEl.hidden = true; this.invalidate(); }
  tick() { this.invalidate(); }

  render() {
    if (this.detailId && this.inc()) this.renderDetail(); else { if (this.detailId) this.closeDetail(); this.renderList(); }
  }

  filtered() {
    const all = this.sim.incidents.list; const s = this.search;
    let list = all.filter((i) => {
      switch (this.filter) {
        case 'open': return i.status !== 'closed';
        case 'unassigned': return i.status !== 'closed' && i.status !== 'completed' && !i.units.length;
        case 'active': return ['assigned', 'active', 'under_control'].includes(i.status);
        case 'completed': return i.status === 'completed';
        case 'closed': return i.status === 'closed';
        default: return true;
      }
    });
    if (s) list = list.filter((i) => `${i.number} ${i.typeLabel} ${i.location.full} ${i.description}`.toLowerCase().includes(s));
    const statusOrder = { new: 0, awaiting: 1, pending: 2, assigned: 3, active: 4, under_control: 5, completed: 6, closed: 7 };
    return list.sort((a, b) => (statusOrder[a.status] - statusOrder[b.status]) || (a.priority - b.priority) || (b.created - a.created));
  }

  renderList() {
    const sim = this.sim;
    const counts = { open: 0, unassigned: 0 };
    for (const i of sim.incidents.list) { if (i.status !== 'closed') counts.open++; if (i.status !== 'closed' && i.status !== 'completed' && !i.units.length) counts.unassigned++; }
    this.listEl.querySelector('[data-r="filters"]').innerHTML = Object.entries(FILTERS).map(([k, v]) => `<button class="chip ${this.filter === k ? 'active' : ''}" data-act="filter" data-f="${k}">${v}${counts[k] ? ` (${counts[k]})` : ''}</button>`).join('');
    const list = this.filtered();
    const box = this.listEl.querySelector('[data-r="table"]');
    if (!list.length) { box.innerHTML = `<div class="empty">${this.filter === 'open' ? 'No open incidents. Answer calls to create incidents, or press ➕ New.' : 'Nothing here.'}</div>`; return; }
    box.innerHTML = `<table class="table"><thead><tr><th>P</th><th>Incident</th><th>Type</th><th class="hide-narrow">Location</th><th class="hide-narrow">Beat</th><th>Status</th><th>Units</th><th class="hide-narrow">Assigned</th><th class="hide-narrow">Age</th></tr></thead><tbody>
      ${list.map((i) => `<tr class="click p${i.priority} ${i.id === this.cad.selectedIncident ? 'sel' : ''}" data-act="row" data-id="${i.id}">
        <td>${pri(i.priority)}</td><td class="mono">${esc(i.number)}${i.requests.length ? ' <span title="Resource request" class="warn">⚑</span>' : ''}${i.severity === 'major' ? ' <span title="Major incident" class="bad">★</span>' : ''}</td>
        <td><span class="dot" style="background:${catColor(i.category)}"></span> ${esc(i.typeLabel)}</td>
        <td class="hide-narrow" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.location.short || i.location.full)}</td>
        <td class="hide-narrow dim" style="white-space:nowrap;font-size:.92em">${esc((i._beat ||= jurisdiction(i.location.x, i.location.y).beat).replace('WCSO ', '').replace(/ · .*/, ''))}</td>
        <td>${incStatus(i.status)}</td><td class="mono">${i.units.length || '<span class="warn">–</span>'}</td>
        <td class="hide-narrow mono" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.88em">${i.units.slice(0, 4).map((id) => sim.units.byId(id)).filter(Boolean).map((u) => callsign(u)).join(' ')}${i.units.length > 4 ? ` +${i.units.length - 4}` : ''}</td>
        <td class="hide-narrow mono">${gameAge(sim, i.created)}</td></tr>`).join('')}
      </tbody></table>`;
  }

  renderDetail() {
    const sim = this.sim; const i = this.inc(); if (!i) return;
    if (this.detailBuiltFor !== i.id) {
      this.detailBuiltFor = i.id;
      this.detailEl.innerHTML = `<div class="toolbar"><button class="btn sm" data-act="back">← Incidents</button><span class="grow"></span><span data-r="dactions" class="row wrap" style="gap:4px"></span></div>
        <div class="inc-layout pane-body"><div class="pane"><div class="pane-body scroll" data-r="dleft"></div></div>
        <div class="pane"><div class="subtabs" data-r="subtabs"></div><div class="pane-body scroll" data-r="dright"></div>
          <div class="say-row" data-r="noterow"><input class="input grow" data-r="note" placeholder="Add a note…"><button class="btn sm" data-act="addnote">Add note</button></div></div></div>`;
    }
    const q = (k) => this.detailEl.querySelector(`[data-r="${k}"]`);
    const closed = i.status === 'closed'; const done = i.status === 'completed';
    q('dactions').innerHTML = `
      ${!closed && !done ? `<button class="btn sm primary" data-act="assign" title="U">🚓 Assign units</button>` : ''}
      ${!closed && !done && (i.location && (i.details.join(' ').match(/suspect|vehicle/i) || ['ROBBERY', 'HIT_RUN', 'BURGLARY', 'BURG_PROG', 'ASSAULT', 'MISSING', 'MISSING_CHILD', 'SUSP', 'SUSP_VEH', 'DUI', 'SHOTS', 'ARMED', 'THEFT'].includes(i.type))) ? '<button class="btn sm" data-act="bolo">📢 BOLO</button>' : ''}
      ${!closed && !done && !i.units.length && this.game.career.has('delegation', sim.state.mode) ? '<button class="btn sm" data-act="delegate">👥 Delegate</button>' : ''}
      ${!closed && !done ? `<button class="btn sm" data-act="pending">${i.status === 'pending' ? 'Release hold' : 'Hold (pending)'}</button><button class="btn sm good" data-act="complete">✔ Complete</button>` : ''}
      ${done ? '<button class="btn sm good" data-act="close">Close incident</button><button class="btn sm" data-act="reopen">Reopen</button>' : ''}
      ${closed ? '<button class="btn sm" data-act="reopen">Reopen</button>' : ''}`;
    const tr = i.sim;
    const units = i.units.map((id) => sim.units.byId(id)).filter(Boolean);
    const recs = !closed && !done ? sim.incidents.recommendations(i) : [];
    const cov = sim.incidents.coverage(i, { onScene: false, needs: TYPE[i.type]?.needs });
    const patientsLeft = tr.patientsKnown ? Math.max(0, tr.patients - tr.transported) : null;
    q('dleft').innerHTML = `
      <div class="inc-head"><h3>${pri(i.priority)} <span class="mono">${esc(i.number)}</span> ${esc(i.typeLabel)} ${incStatus(i.status)} ${i.severity === 'major' ? '<span class="pill" style="background:#ff5a4e;color:#fff">MAJOR</span>' : ''}</h3>
        <div class="loc">📍 ${esc(i.location.full)}${i.location.cross ? ` <span class="dim">(near ${esc(i.location.cross)})</span>` : ''} ${i.locationVerified ? '<span class="verified">✔ verified</span>' : '<span class="unverified">unverified</span>'}
          <button class="btn ghost sm" data-act="editloc">✎</button><button class="btn ghost sm" data-act="mapfocus">🗺 Map</button></div>
        ${i.delegatedTo ? `<div class="dim" style="font-size:.82em;margin-top:3px">Handled by ${esc(i.delegatedTo)}</div>` : ''}
        <div class="timers">${(() => { const tm = incidentTimers(i, sim.clock()); return `<span title="Time since the incident was created">⏱ Elapsed <b>${fmtMin(tm.age)}</b></span><span title="Call creation to first unit assigned">📟 To dispatch <b>${fmtMin(tm.toDispatch)}</b></span><span title="Call creation to first unit on scene">🚨 To scene <b>${fmtMin(tm.toScene)}</b></span><span>Progress <b>${Math.round(tr.progress * 100)}%</b></span>`; })()}</div>
        <div class="progress" title="Incident progress"><i style="width:${Math.round(tr.progress * 100)}%"></i></div></div>
      ${i.suggestedType && i.suggestedType !== i.type ? `<div class="request-banner">On-scene units suggest this is a <b>${esc(TYPE[i.suggestedType].label)}</b>. <button class="btn sm" data-act="applytype">Reclassify</button></div>` : ''}
      ${i.requests.length ? `<div class="request-banner">⚑ <b>Units requesting:</b> ${i.requests.map((r) => esc(CAPABILITY_LABELS[r.cap] || r.cap)).join(', ')}<div class="dim" style="margin-top:3px">Open the assignment window – matching units are recommended.</div></div>` : ''}
      <div style="padding:8px 10px" class="row wrap">
        <label class="field grow" style="min-width:160px">Type<select class="input" data-act="settype" ${closed ? 'disabled' : ''}>${typeOptions(i.type)}</select></label>
        <label class="field" style="width:84px">Priority<select class="input" data-act="setpri" ${closed ? 'disabled' : ''}>${[1, 2, 3, 4].map((p) => `<option value="${p}" ${p === i.priority ? 'selected' : ''}>P${p}</option>`).join('')}</select></label>
        <label class="field" style="width:150px">Status<select class="input" data-act="setstatus">${INCIDENT_STATUSES.map((s) => `<option value="${s}" ${s === i.status ? 'selected' : ''}>${INCIDENT_STATUS_LABELS[s]}</option>`).join('')}</select></label>
      </div>
      <div style="padding:0 10px 8px"><dl class="kv">
        <dt>Description</dt><dd>${esc(i.description || '—')}</dd>
        <dt>Caller</dt><dd>${i.caller ? `${esc(i.caller.name)} · ${esc(i.caller.phone)}` : '—'}</dd>
        <dt>Created</dt><dd class="mono">${clock(i.createdClock, this.game)} (${gameAge(sim, i.created)} ago)</dd>
        ${patientsLeft != null && tr.patients ? `<dt>Patients</dt><dd>${tr.patients} total · ${tr.transported} transported${patientsLeft ? ` · <span class="warn">${patientsLeft} on scene</span>` : ''}</dd>` : ''}
        ${i.bolo ? `<dt>BOLO</dt><dd>${esc(i.bolo.text)}</dd>` : ''}
        ${i.details.length ? `<dt>Details</dt><dd>${i.details.map((d) => `• ${esc(d)}`).join('<br>')}</dd>` : ''}
      </dl></div>
      ${(() => { const j = jurisdiction(i.location.x, i.location.y); const pr = premise(i.location); return `
      <div class="section-title" style="margin-left:10px">Location &amp; jurisdiction</div>
      <div class="cad-grid">
        <div><b>Municipality</b>${esc(j.municipality)}</div><div><b>Township</b>${esc(j.township)}</div>
        <div><b>Law agency</b>${esc(j.law)}</div><div><b>Beat / district</b>${esc(j.beat)}</div>
        <div><b>Fire district</b>${esc(j.fireShort)}</div><div><b>EMS zone</b>${esc(j.emsShort)}</div>
        <div><b>ESN</b><span class="mono">${j.esn}</span></div><div><b>Map grid</b><span class="mono">${esc(j.grid)}</span></div>
        <div class="wide"><b>Coordinates</b><span class="mono">${latLon(j)}</span></div>
        ${i.location.poi ? `<div class="wide"><b>Common place</b>${esc(i.location.poi)}</div>` : ''}
        <div class="wide"><b>Premise type</b>${esc(pr.kind)}${pr.priors.length ? ` · <span class="warn">${pr.priors.length} prior call${pr.priors.length > 1 ? 's' : ''} (12 mo)</span>` : ''}</div>
      </div>
      <div class="section-title" style="margin-left:10px">Response plan</div>
      <table class="table compact"><tbody>
        <tr><td class="dim">Law</td><td>${esc(j.lawStation)}</td><td class="mono dim">${j.lawDist}</td></tr>
        <tr><td class="dim">Fire (1st due)</td><td>${esc(j.fire)}</td><td class="mono dim">${j.fireDist}</td></tr>
        <tr><td class="dim">EMS</td><td>${esc(j.ems)}</td><td class="mono dim">${j.emsDist}</td></tr>
        <tr><td class="dim">Hospital</td><td>${esc(j.hospital)}</td><td class="mono dim">${j.hospDist}</td></tr>
      </tbody></table>
      ${pr.notes.length ? `<div class="section-title" style="margin-left:10px">⚠ Premise &amp; hazard notes</div><div class="hazards">${pr.notes.map((n) => `<span class="haz ${/caution|weapon|firearm|H2S/i.test(n) ? 'bad' : ''}">${esc(n)}</span>`).join('')}</div>` : ''}`; })()}
      ${(() => { const ut = unitTimes(i); return ut.length ? `<div class="section-title" style="margin-left:10px">Unit times</div>
      <table class="table compact"><thead><tr><th>Unit</th><th>Disp</th><th>On scene</th><th>Resp</th><th class="hide-narrow">Hosp</th><th>Clear</th></tr></thead><tbody>
        ${ut.map((r) => `<tr><td class="callsign">${esc(r.unit)}</td><td class="mono">${r.assigned != null ? clock(r.assigned, this.game) : '—'}</td><td class="mono">${r.onScene != null ? clock(r.onScene, this.game) : '—'}</td><td class="mono ${r.response != null && r.response > 12 ? 'warn' : ''}">${fmtMin(r.response)}</td><td class="mono hide-narrow">${r.hospital != null ? clock(r.hospital, this.game) : '—'}</td><td class="mono">${r.cleared != null ? clock(r.cleared, this.game) : '—'}</td></tr>`).join('')}
      </tbody></table>` : ''; })()}
      <div class="section-title" style="margin-left:10px">Assigned units (${units.length})</div>
      ${units.length ? units.map((u) => `<div class="unit-row"><span data-act="unit" data-u="${u.id}" style="cursor:pointer">${callsign(u)}</span><span class="grow dim">${esc(TYPE_BY_ID[u.type].name)}</span>
          ${unitStatus(u, sim)}${u.status === 'responding' ? ` <span class="mono dim">${etaText(sim, u.eta)}</span>` : ''}
          ${u.status === 'on_scene' ? `<button class="btn sm" data-act="clearunit" data-u="${u.id}" title="Clear this unit">Clear</button>` : ''}
          ${u.status !== 'transporting' ? `<button class="btn sm" data-act="reassign" data-u="${u.id}" title="Reassign to another incident">⇄</button><button class="btn sm danger" data-act="unassign" data-u="${u.id}" title="Remove assignment">✕</button>` : ''}</div>`).join('')
        : '<div class="empty" style="padding:12px">No units assigned yet.</div>'}
      ${recs.length ? `<div class="rec-box"><div class="row"><b class="grow">Recommended (optional)</b><button class="btn sm" data-act="pickrec">Review</button><button class="btn sm primary" data-act="assignrec">Assign these</button></div>
          <div class="row wrap" style="margin-top:6px;gap:4px">${recs.map((r) => { const u = sim.units.byId(r.unit); return `<span class="chip" title="${esc(CAPABILITY_LABELS[r.cap] || r.cap)}">${callsign(u)}</span>`; }).join('')}</div>
          <div class="dim" style="margin-top:5px;font-size:.82em">Suggestions only – you can assign any unit to any incident.</div></div>`
        : (!closed && !done ? `<div class="dim" style="padding:8px 10px;font-size:.82em">Recommended coverage for a ${esc(i.typeLabel.toLowerCase())}: ${Math.round(cov.coverage * 100)}%</div>` : '')}
      ${i.eval ? `<div class="rec-box"><b>Evaluation</b> · +${i.eval.total} XP<div class="dim" style="font-size:.85em;margin-top:4px">Base ${i.eval.base}${i.eval.bonuses.map((b) => ` · ${esc(b[0])} +${b[1]}`).join('')}</div></div>` : ''}`;
    const pr = premise(i.location); const tabs = { timeline: 'Timeline', notes: `Notes (${i.notes.length})`, transcript: 'Transcript', assignments: 'Assignments', premise: `Premise (${pr.priors.length})` };
    q('subtabs').innerHTML = Object.entries(tabs).map(([k, v]) => `<button class="subtab ${this.subtab === k ? 'active' : ''}" data-act="sub" data-t="${k}">${v}</button>`).join('');
    const right = q('dright');
    if (this.subtab === 'timeline') right.innerHTML = `<div class="timeline">${i.history.map((h) => `<div><span class="tm">${clock(h.clock, this.game)}</span><span>${esc(h.text)}</span></div>`).join('')}</div>`;
    else if (this.subtab === 'notes') right.innerHTML = i.notes.length ? i.notes.map((n) => `<div class="note"><div class="dim" style="font-size:.78em">${clock(n.clock, this.game)} · ${esc(n.author)}</div>${esc(n.text)}</div>`).join('') : '<div class="empty">No notes yet.</div>';
    else if (this.subtab === 'transcript') right.innerHTML = i.transcript.length ? `<div class="transcript">${i.transcript.map((l) => `<div class="tl ${l.who}">${l.who === 'system' ? '' : `<span class="tl-who">${l.who === 'caller' ? 'CALLER' : 'DISPATCHER'}</span>`}${esc(l.text)}</div>`).join('')}</div>` : '<div class="empty">No call transcript (unit-initiated or manually created incident).</div>';
    else if (this.subtab === 'premise') right.innerHTML = `<div style="padding:8px 10px"><div class="section-title" style="margin-top:2px">Prior calls at this address (12 months)</div>${pr.priors.length ? `<div class="timeline">${pr.priors.map((p) => `<div><span class="tm">${p.daysAgo}d ago</span><span><b>${esc(p.type)}</b> – <span class="dim">${esc(p.disp)}</span></span></div>`).join('')}</div>` : '<div class="dim">No prior calls on record.</div>'}
      <div class="section-title">Premise notes</div>${pr.notes.length ? pr.notes.map((n) => `<div class="note">${esc(n)}</div>`).join('') : '<div class="dim">No premise notes on file.</div>'}</div>`;
    else right.innerHTML = i.unitHistory.length ? `<div class="timeline">${i.unitHistory.map((h) => `<div><span class="tm">${clock(h.clock, this.game)}</span><span class="callsign">${esc(h.unit)}</span><span>${esc(h.action)}</span></div>`).join('')}</div>` : '<div class="empty">No assignments yet.</div>';
    q('noterow').style.display = closed ? 'none' : '';
  }

  setStatus(i, status) {
    const im = this.sim.incidents;
    if (status === 'completed') im.complete(i, true);
    else if (status === 'closed') this.game.closeIncident(i);
    else if (i.status === 'closed' || i.status === 'completed') { im.reopen(i); im.setStatus(i, status); }
    else im.setStatus(i, status, `Status set to ${INCIDENT_STATUS_LABELS[status]} by dispatcher`);
  }

  async closeIncident() {
    const i = this.inc(); if (!i) return;
    this.game.closeIncident(i);
    toast(`${i.number} closed${i.eval ? ` · +${i.eval.total} XP` : ''}`, { level: 'good' });
  }

  addNote() {
    const inp = this.detailEl.querySelector('[data-r="note"]'); const t = inp?.value.trim(); if (!t) return;
    this.sim.incidents.addNote(this.inc(), t); inp.value = '';
    this.game.audio?.typing(5);
  }

  openAssign(id, opts = {}) {
    const inc = this.sim.incidents.byId(id); if (!inc) return;
    openAssignModal(this.game, inc, opts);
  }

  assignRecommended() {
    const i = this.inc(); const recs = this.sim.incidents.recommendations(i).map((r) => r.unit);
    const rep = this.sim.units.assign(recs, i.id);
    this.game.reportAssignment(rep, i);
  }

  reassignModal(unitId) {
    const sim = this.sim; const u = sim.units.byId(unitId);
    const others = sim.incidents.open().filter((x) => x.id !== u.incident && x.status !== 'completed');
    if (!others.length) { toast('No other open incidents to reassign to.', { level: 'info' }); return; }
    const m = modal({ title: `Reassign ${esc(u.callsign)}`, body: `<div class="col">${others.map((x) => `<button class="btn" style="justify-content:flex-start" data-act="to" data-id="${x.id}">${pri(x.priority)} <span class="mono">${esc(x.number)}</span> ${esc(x.typeLabel)} – ${esc(x.location.short || x.location.full)}</button>`).join('')}</div>`,
      onAction: (a, t) => { if (a !== 'to') return; const rep = sim.units.assign([unitId], t.dataset.id, { override: true }); this.game.reportAssignment(rep, sim.incidents.byId(t.dataset.id)); m.close(); } });
  }

  editLocation() {
    const i = this.inc();
    const m = modal({ title: 'Edit location', body: `<label class="field">Address / location<input class="input" data-r="loc" value="${esc(i.location.full)}" autofocus></label><div class="dim" style="margin-top:8px;font-size:.85em">Typing a White County address moves the incident on the map and re-routes units.</div>`,
      foot: [{ label: 'Cancel', act: 'cancel' }, { label: 'Save', act: 'save', cls: 'primary' }],
      onAction: (a) => {
        if (a === 'save') {
          const text = m.body.querySelector('[data-r="loc"]').value.trim();
          const geo = this.sim.geocode(text);
          if (geo) { i.location = { ...i.location, ...geo, full: text, short: text }; for (const u of this.sim.incidents.unitsOf(i, ['responding'])) this.sim.units.routeTo(u, geo.x, geo.y); }
          this.sim.incidents.editLocation(i, text);
        }
        m.close();
      } });
  }

  boloModal() {
    const i = this.inc();
    const guess = i.details.filter((d) => /suspect|vehicle/i.test(d)).join('; ') || i.description;
    const m = modal({ title: `BOLO – ${esc(i.number)}`, body: `<label class="field">Broadcast to all police units<textarea class="input" rows="3" data-r="bolo">${esc(guess)}</textarea></label>`,
      foot: [{ label: 'Cancel', act: 'cancel' }, { label: '📢 Broadcast', act: 'send', cls: 'primary' }],
      onAction: (a) => { if (a === 'send') { const t = m.body.querySelector('[data-r="bolo"]').value.trim(); if (t) { this.sim.radio.broadcastBOLO(i, t); toast('BOLO broadcast on Police Dispatch', { level: 'good' }); } } m.close(); } });
  }

  doDelegate() {
    const i = this.inc(); const npc = STAFF.find((s) => s.id === 'maria');
    const units = this.sim.incidents.recommendations(i).map((r) => r.unit);
    if (!units.length) { toast('No suitable units available to delegate with.', { level: 'warn' }); return; }
    this.sim.units.assign(units, i.id); i.delegatedTo = npc.name; this.sim.incidents.addHistory(i, `Dispatched by ${npc.name} (delegated)`);
    toast(`${npc.name} is handling ${i.number}.`, { level: 'good' });
  }

  newIncidentModal() {
    const m = modal({ title: 'New incident', body: `<div class="col">
      <label class="field">Type<select class="input" data-r="t">${typeOptions('ASSIST')}</select></label>
      <label class="field">Location (White County address)<input class="input" data-r="l" placeholder="e.g. 412 W Main St, or 2145 Burnt Prairie Rd" autofocus></label>
      <label class="field">Priority<select class="input" data-r="p">${[1, 2, 3, 4].map((p) => `<option value="${p}" ${p === 3 ? 'selected' : ''}>P${p}</option>`).join('')}</select></label>
      <label class="field">Description<textarea class="input" rows="2" data-r="d"></textarea></label></div>`,
      foot: [{ label: 'Cancel', act: 'cancel' }, { label: 'Create', act: 'create', cls: 'primary' }],
      onAction: (a) => {
        if (a !== 'create') { m.close(); return; }
        const v = (k) => m.body.querySelector(`[data-r="${k}"]`).value.trim();
        const geo = this.sim.geocode(v('l'));
        if (!geo) { toast('Could not find that address. Use a White County street, e.g. "412 W Main St" or "205 Court St, Grayville".', { level: 'warn' }); return; }
        const inc = this.sim.incidents.create({ typeId: v('t'), priority: parseInt(v('p'), 10), location: { ...geo, full: v('l'), short: v('l') }, description: v('d'), source: 'manual', locationVerified: true });
        m.close(); this.openDetail(inc.id);
      } });
  }
}
