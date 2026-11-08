// Unit assignment window: any unit, any incident. Recommendations are optional.
import { modal, toast } from '../dom.js';
import { esc } from '../../core/util.js';
import { pri, unitStatus, callsign, etaText } from '../fmt.js';
import { DEPARTMENTS, TYPE_BY_ID, UNIT_TYPES, CAPABILITY_LABELS } from '../../data/departments.js';
import { bus } from '../../core/events.js';

export function openAssignModal(game, inc, { preselectRecommended = false } = {}) {
  const sim = game.sim;
  const state = { dept: 'all', type: 'all', search: '', availableOnly: false, selected: new Set(), etaCache: new Map(), sort: 'eta' };
  const recs = sim.incidents.recommendations(inc);
  const recIds = new Set(recs.map((r) => r.unit));
  if (preselectRecommended) recs.forEach((r) => state.selected.add(r.unit));

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="row wrap" style="margin-bottom:8px;gap:6px">
      <div class="grow" style="min-width:200px">${pri(inc.priority)} <b class="mono">${esc(inc.number)}</b> ${esc(inc.typeLabel)}<div class="dim" style="font-size:.85em">📍 ${esc(inc.location.full)}</div></div>
      <input class="input" data-r="search" placeholder="Search units (e.g. Engine 4, SWAT, medic)…" style="max-width:280px" autofocus>
    </div>
    <div class="row wrap" style="gap:6px;margin-bottom:8px">
      <label class="toggle"><input type="checkbox" data-r="avail"> Available only</label>
      <label class="toggle" title="Sandbox: pull busy or unavailable units"><input type="checkbox" data-r="override" ${sim.config.availabilityOverride ? 'checked' : ''}> Availability override</label>
      <span class="grow"></span>
      <select class="input" data-r="type" style="width:auto;max-width:220px"><option value="all">All unit types</option></select>
      <select class="input" data-r="sort" style="width:auto"><option value="eta">Sort: ETA</option><option value="name">Sort: Name</option><option value="status">Sort: Status</option></select>
    </div>
    ${recs.length ? `<div class="rec-box" style="margin:0 0 8px"><div class="row wrap"><span class="grow"><span class="rec-star">★</span> <b>Recommended:</b> ${recs.map((r) => esc(sim.units.byId(r.unit).callsign)).join(', ')}</span><button class="btn sm" data-act="selrec">Select recommended</button></div>
      <div class="dim" style="font-size:.8em;margin-top:3px">Suggestions only. You decide – any unit can go to any incident.</div></div>` : ''}
    ${inc.requests.length ? `<div class="request-banner" style="margin:0 0 8px">⚑ On scene requesting: ${inc.requests.map((r) => esc(CAPABILITY_LABELS[r.cap] || r.cap)).join(', ')}</div>` : ''}
    <div class="assign-layout"><div class="filters scroll" data-r="depts"></div><div class="scroll" data-r="list"></div></div>`;

  const m = modal({ title: 'Assign units', body, xwide: true,
    foot: [{ label: 'Clear selection', act: 'clear' }, { label: 'Cancel', act: 'cancel' }, { label: 'Assign selected (0)', act: 'assign', cls: 'primary' }],
    onAction: (a, t) => {
      if (a === 'cancel') m.close();
      else if (a === 'clear') { state.selected.clear(); render(); }
      else if (a === 'selrec') { recs.forEach((r) => state.selected.add(r.unit)); render(); }
      else if (a === 'dept') { state.dept = t.dataset.d; state.type = 'all'; renderTypes(); render(); }
      else if (a === 'assign') doAssign();
      else if (a === 'selall') { visibleUnits().forEach((u) => { if (canPick(u)) state.selected.add(u.id); }); render(); }
    },
    onClose: () => off() });
  const q = (k) => body.querySelector(`[data-r="${k}"]`);
  const override = () => q('override').checked;
  const canPick = (u) => sim.units.isAssignable(u) || override();
  q('search').addEventListener('input', (e) => { state.search = e.target.value.toLowerCase().trim(); render(); });
  q('avail').addEventListener('change', (e) => { state.availableOnly = e.target.checked; render(); });
  q('override').addEventListener('change', () => render());
  q('type').addEventListener('change', (e) => { state.type = e.target.value; render(); });
  q('sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  q('list').addEventListener('change', (e) => {
    const id = e.target.dataset.u; if (!id) return;
    if (e.target.checked) state.selected.add(id); else state.selected.delete(id);
    updateFoot(); e.target.closest('tr')?.classList.toggle('picked', e.target.checked);
  });
  q('list').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-row]'); if (!tr || e.target.tagName === 'INPUT') return;
    const cb = tr.querySelector('input[type=checkbox]'); if (!cb || cb.disabled) return;
    cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true }));
  });

  function eta(u) {
    if (!state.etaCache.has(u.id)) state.etaCache.set(u.id, sim.units.etaTo(u, inc.location.x, inc.location.y).seconds);
    return state.etaCache.get(u.id);
  }

  function visibleUnits() {
    let list = sim.units.list;
    if (state.dept !== 'all') list = list.filter((u) => u.dept === state.dept);
    if (state.type !== 'all') list = list.filter((u) => u.type === state.type);
    if (state.availableOnly) list = list.filter((u) => sim.units.isAssignable(u));
    if (state.search) {
      const s = state.search;
      list = list.filter((u) => `${u.callsign} ${TYPE_BY_ID[u.type].name} ${u.dept} ${sim.units.statusLabel(u)}`.toLowerCase().includes(s));
    }
    const statusRank = (u) => (sim.units.isAssignable(u) ? 0 : u.status === 'busy' ? 1 : u.status === 'out_of_service' ? 3 : 2);
    if (state.sort === 'eta') list = list.slice().sort((a, b) => (recIds.has(b.id) - recIds.has(a.id)) || (statusRank(a) - statusRank(b)) || (eta(a) - eta(b)));
    else if (state.sort === 'status') list = list.slice().sort((a, b) => statusRank(a) - statusRank(b) || a.callsign.localeCompare(b.callsign));
    else list = list.slice().sort((a, b) => a.callsign.localeCompare(b.callsign, undefined, { numeric: true }));
    return list;
  }

  function renderTypes() {
    const types = UNIT_TYPES.filter((t) => (state.dept === 'all' || t.dept === state.dept) && sim.units.list.some((u) => u.type === t.id));
    q('type').innerHTML = `<option value="all">All unit types</option>${types.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}`;
  }

  function renderDepts() {
    const counts = {};
    for (const u of sim.units.list) { const c = counts[u.dept] ||= { a: 0, t: 0 }; c.t++; if (sim.units.isAssignable(u)) c.a++; }
    const all = sim.units.counts();
    q('depts').innerHTML = `<button class="dept-filter ${state.dept === 'all' ? 'active' : ''}" data-act="dept" data-d="all">All departments<span class="n">${all.available}/${all.total}</span></button>` +
      DEPARTMENTS.filter((d) => counts[d.id]).map((d) => `<button class="dept-filter ${state.dept === d.id ? 'active' : ''}" data-act="dept" data-d="${d.id}"><span class="dot" style="background:${d.color}"></span>${esc(d.name)}<span class="n">${counts[d.id].a}/${counts[d.id].t}</span></button>`).join('');
  }

  function render() {
    renderDepts();
    const list = visibleUnits();
    const ov = override();
    q('list').innerHTML = list.length ? `<table class="table"><thead><tr><th></th><th>Unit</th><th class="hide-narrow">Type</th><th>Status</th><th class="hide-narrow">Location / assignment</th><th>ETA</th></tr></thead><tbody>
      ${list.map((u) => {
        const avail = sim.units.isAssignable(u); const pickable = avail || ov; const sel = state.selected.has(u.id);
        const here = u.incident === inc.id;
        const assignment = u.incident ? (sim.incidents.byId(u.incident)?.number || '') : '';
        return `<tr class="assign-row click ${avail ? '' : 'unavail'} ${sel ? 'picked' : ''}" data-row="1">
          <td><input type="checkbox" data-u="${u.id}" ${sel ? 'checked' : ''} ${pickable && !here ? '' : 'disabled'}></td>
          <td>${recIds.has(u.id) ? '<span class="rec-star" title="Recommended">★</span> ' : ''}${callsign(u)}${u.mutualAid ? ' <span class="dim">(MA)</span>' : ''}</td>
          <td class="hide-narrow dim">${esc(TYPE_BY_ID[u.type].name)}</td>
          <td>${unitStatus(u, sim)}${here ? ' <span class="good" style="font-size:.8em">on this incident</span>' : ''}</td>
          <td class="hide-narrow dim" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${assignment ? `On ${esc(assignment)} · ` : ''}${esc(sim.units.locationText(u))}</td>
          <td class="mono">${etaText(sim, eta(u))}</td></tr>`;
      }).join('')}</tbody></table>
      <div class="row" style="padding:8px"><button class="btn sm" data-act="selall">Select all ${ov ? 'shown' : 'available shown'}</button><span class="dim" style="font-size:.82em">${list.length} units shown</span></div>`
      : '<div class="empty">No units match.</div>';
    updateFoot();
  }

  function updateFoot() {
    const b = m.el.querySelector('[data-act="assign"]');
    b.textContent = `Assign selected (${state.selected.size})`; b.disabled = !state.selected.size;
  }

  function doAssign() {
    if (!state.selected.size) return;
    const rep = sim.units.assign([...state.selected], inc.id, { override: override() });
    game.reportAssignment(rep, inc);
    game.tutorial?.event('unitsAssigned', { inc, rep });
    if (rep.assigned.length) m.close(); else render();
  }

  const off = bus.on('unit:status', () => { if (m.el.isConnected) { state.etaCache.clear(); renderSoon(); } });
  let pending = false;
  function renderSoon() { if (pending) return; pending = true; setTimeout(() => { pending = false; if (m.el.isConnected) { const scroll = q('list').scrollTop; render(); q('list').scrollTop = scroll; } }, 600); }
  renderTypes(); render();
  return m;
}

export function assignReportText(rep) {
  const parts = [];
  if (rep.assigned.length) parts.push(`Assigned: ${rep.assigned.map((a) => a.callsign).join(', ')}`);
  if (rep.reassigned.length) parts.push(`Reassigned from other incidents: ${rep.reassigned.map((a) => `${a.callsign}${a.from ? ` (${a.from})` : ''}`).join(', ')}`);
  if (rep.skipped.length) parts.push(`Not assigned: ${rep.skipped.map((s) => `${s.callsign} – ${s.reason}`).join('; ')}`);
  if (rep.error) parts.push(rep.error);
  return parts.join('. ');
}

export { toast };
