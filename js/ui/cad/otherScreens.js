// Status board & notifications, history, reports, supervisor tools, dispatch settings.
import { Screen } from './cad.js';
import { bus } from '../../core/events.js';
import { bindActions, toast, modal } from '../dom.js';
import { esc, fmtDuration } from '../../core/util.js';
import { pri, incStatus, clock, gameAge, catColor } from '../fmt.js';
import { DEPARTMENTS, DEPT_BY_ID } from '../../data/departments.js';
import { UNIT_STATUS_COLORS, UNIT_STATUS_LABELS } from '../../data/incidentTypes.js';
import { WEATHER_TYPES } from '../../sim/weather.js';
import { EVENT_KINDS } from '../../sim/cityEvents.js';
import { FREQUENCY_LABELS } from '../../sim/calls.js';
import { delegate, STAFF } from '../../ai/staffDialogue.js';
import { reportHTML } from '../report.js';

// ---------------- Status board & notifications ----------------
export class BoardScreen extends Screen {
  constructor(cad) { super(cad, 'board', 'Status', '📋'); this.filter = 'all'; this.seen = 0; }
  badge() { if (!this.sim || this.visible) return 0; return this.sim.state.notifications.filter((n) => !n.read && ['alert', 'request', 'warn'].includes(n.level)).length; }
  build() {
    this.root.innerHTML = `<div class="pane-body scroll"><div data-r="top"></div><div class="pane-head" style="position:sticky;top:0;z-index:2">Notifications<span class="grow"></span>
      <span data-r="nf" class="row" style="gap:3px"></span><button class="btn sm" data-act="readall">Mark all read</button></div><div data-r="list"></div></div>`;
    bindActions(this.root, {
      nf: (t) => { this.filter = t.dataset.f; this.render(); },
      readall: () => { this.sim.state.notifications.forEach((n) => { n.read = true; }); this.render(); this.cad.renderTabs(); },
      n: (t) => { const n = this.sim.state.notifications.find((x) => x.id === t.dataset.id); if (!n) return; n.read = true; if (n.incident) this.cad.selectIncident(n.incident); else if (n.call) this.cad.showScreen('calls'); this.render(); },
      inc: (t) => this.cad.selectIncident(t.dataset.id),
    });
    bus.on('notify', () => this.invalidate()); bus.on('unit:status', () => this.invalidate()); bus.on('cityevent:started', () => this.invalidate()); bus.on('cityevent:ended', () => this.invalidate());
  }
  tick() { this.invalidate(); }
  render() {
    const sim = this.sim; const wx = WEATHER_TYPES[sim.weather.current()];
    const deptRows = DEPARTMENTS.map((d) => {
      const us = sim.units.list.filter((u) => u.dept === d.id); if (!us.length) return '';
      const a = us.filter((u) => sim.units.isAssignable(u)).length; const pct = (a / us.length) * 100;
      return `<div class="bar-row"><span style="width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="dot" style="background:${d.color}"></span> ${esc(d.short)}</span><div class="bar"><i style="width:${pct}%;background:${pct > 50 ? '#2fd08a' : pct > 20 ? '#f2c94c' : '#ff5a4e'}"></i></div><span class="mono" style="width:52px;text-align:right">${a}/${us.length}</span></div>`;
    }).join('');
    const p1 = sim.incidents.open().filter((i) => i.priority === 1 && i.status !== 'completed');
    this.root.querySelector('[data-r="top"]').innerHTML = `<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
      <div class="card"><h4>🌐 City conditions</h4><div>${wx.icon} <b>${wx.label}</b> · <span class="dim">travel ${Math.round(wx.travel * 100)}% speed, air ops ${Math.round(wx.air * 100)}%</span></div>
        ${sim.state.events.length ? sim.state.events.map((e) => `<div style="margin-top:5px">${EVENT_KINDS[e.kind].icon} <b>${esc(e.title)}</b><div class="dim" style="font-size:.85em">${esc(e.desc)}</div></div>`).join('') : '<div class="dim" style="margin-top:5px">No active city events.</div>'}</div>
      <div class="card"><h4>🚨 Priority 1 incidents</h4>${p1.length ? p1.map((i) => `<div class="row" style="margin:3px 0;cursor:pointer" data-act="inc" data-id="${i.id}">${pri(1)} <span class="mono">${esc(i.number)}</span><span class="grow">${esc(i.typeLabel)}</span>${incStatus(i.status)}</div>`).join('') : '<div class="dim">None right now.</div>'}</div>
      <div class="card"><h4>🚓 Unit availability</h4>${deptRows}</div></div>`;
    const names = { all: 'All', alert: 'Alerts', request: 'Requests', info: 'Info' };
    this.root.querySelector('[data-r="nf"]').innerHTML = Object.entries(names).map(([k, v]) => `<button class="chip ${this.filter === k ? 'active' : ''}" data-act="nf" data-f="${k}">${v}</button>`).join('');
    const list = sim.state.notifications.filter((n) => this.filter === 'all' || n.level === this.filter || (this.filter === 'alert' && n.level === 'warn'));
    this.root.querySelector('[data-r="list"]').innerHTML = list.length ? list.map((n) => `<div class="notif ${n.read ? '' : 'unread'}" data-act="n" data-id="${n.id}"><span class="tm">${clock(n.clock, this.game)}</span><span>${{ alert: '🔴', warn: '🟠', request: '⚑', info: '🔵', good: '🟢' }[n.level] || '•'}</span><span>${esc(n.text)}</span></div>`).join('') : '<div class="empty">No notifications.</div>';
    if (this.visible) for (const n of list.slice(0, 30)) if (n.level === 'info') n.read = true;
  }
}

// ---------------- History ----------------
export class HistoryScreen extends Screen {
  constructor(cad) { super(cad, 'history', 'History', '🗂'); this.tab = 'incidents'; this.search = ''; }
  build() {
    this.root.innerHTML = `<div class="toolbar"><span data-r="tabs" class="row" style="gap:3px"></span><span class="grow"></span><input class="input" data-r="s" placeholder="Search…" style="width:170px"></div><div class="pane-body scroll" data-r="body"></div>`;
    this.root.querySelector('[data-r="s"]').addEventListener('input', (e) => { this.search = e.target.value.toLowerCase(); this.render(); });
    bindActions(this.root, { tab: (t) => { this.tab = t.dataset.t; this.render(); }, inc: (t) => this.cad.selectIncident(t.dataset.id), call: (t) => this.showCall(t.dataset.id) });
    for (const ev of ['incident:closed', 'call:ended']) bus.on(ev, () => this.invalidate());
  }
  render() {
    const sim = this.sim; const s = this.search;
    const tabs = { incidents: 'Closed incidents', calls: 'Call log', career: 'All-time log' };
    this.root.querySelector('[data-r="tabs"]').innerHTML = Object.entries(tabs).map(([k, v]) => `<button class="chip ${this.tab === k ? 'active' : ''}" data-act="tab" data-t="${k}">${v}</button>`).join('');
    const body = this.root.querySelector('[data-r="body"]');
    if (this.tab === 'incidents') {
      const list = sim.incidents.list.filter((i) => ['closed', 'completed'].includes(i.status) && (!s || `${i.number} ${i.typeLabel} ${i.location.full}`.toLowerCase().includes(s)));
      body.innerHTML = list.length ? `<table class="table"><thead><tr><th>P</th><th>Incident</th><th>Type</th><th class="hide-narrow">Location</th><th>Units</th><th>XP</th></tr></thead><tbody>${list.map((i) => `<tr class="click p${i.priority}" data-act="inc" data-id="${i.id}"><td>${pri(i.priority)}</td><td class="mono">${esc(i.number)}</td><td><span class="dot" style="background:${catColor(i.category)}"></span> ${esc(i.typeLabel)}</td><td class="hide-narrow dim">${esc(i.location.full)}</td><td class="mono">${new Set(i.unitHistory.filter((h) => h.action === 'Assigned').map((h) => h.unit)).size}</td><td class="mono good">${i.eval ? `+${i.eval.total}` : '–'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No completed incidents this shift yet.</div>';
    } else if (this.tab === 'calls') {
      const list = sim.calls.list.filter((c) => ['ended', 'abandoned'].includes(c.status) && (!s || `${c.info.nature} ${c.sc.ani.phone} ${c.info.name}`.toLowerCase().includes(s)));
      body.innerHTML = list.length ? `<table class="table"><thead><tr><th>Time</th><th>Line</th><th>Caller</th><th>Nature</th><th>Outcome</th></tr></thead><tbody>${list.map((c) => `<tr class="click" data-act="call" data-id="${c.id}"><td class="mono">${clock(c.receivedClock, this.game)}</td><td>${c.line}</td><td>${esc(c.info.name || c.sc.ani.phone)}</td><td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.info.nature || '—')}</td><td>${c.status === 'abandoned' ? '<span class="warn">Abandoned</span>' : c.incidentId ? `<span class="good">${esc(sim.incidents.byId(c.incidentId)?.number || 'Incident')}</span>` : `<span class="dim">${esc(c.endReason || 'Ended')}</span>`}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No completed calls yet.</div>';
    } else {
      const list = this.game.save.profile.completedIncidents.filter((i) => !s || `${i.number} ${i.type} ${i.location}`.toLowerCase().includes(s));
      body.innerHTML = list.length ? `<table class="table"><thead><tr><th>Date</th><th>Incident</th><th>Type</th><th class="hide-narrow">Location</th><th>Units</th></tr></thead><tbody>${list.map((i) => `<tr><td class="mono dim">${esc(i.date.slice(0, 10))}</td><td class="mono">${esc(i.number)}</td><td>${esc(i.type)}</td><td class="hide-narrow dim">${esc(i.location)}</td><td class="dim" style="font-size:.85em">${esc(i.units.join(', '))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Your all-time incident log fills as you close incidents.</div>';
    }
  }
  showCall(id) {
    const c = this.sim.calls.byId(id); if (!c) return;
    modal({ title: `Call – line ${c.line} · ${esc(c.sc.ani.phone)}`, wide: true, body: `<dl class="kv" style="margin-bottom:10px"><dt>Received</dt><dd class="mono">${clock(c.receivedClock, this.game)}</dd><dt>ALI</dt><dd>${esc(c.sc.ani.address)}</dd><dt>Nature</dt><dd>${esc(c.info.nature || '—')}</dd><dt>Outcome</dt><dd>${esc(c.endReason || c.status)}</dd></dl>
      <div class="transcript">${c.transcript.map((l) => `<div class="tl ${l.who}">${l.who === 'system' ? '' : `<span class="tl-who">${l.who === 'caller' ? 'CALLER' : 'DISPATCHER'}</span>`}${esc(l.text)}</div>`).join('')}</div>` });
  }
}

// ---------------- Reports ----------------
export class ReportsScreen extends Screen {
  constructor(cad) { super(cad, 'reports', 'Reports', '📊'); }
  build() { this.root.innerHTML = '<div class="pane-body scroll" style="padding:10px" data-r="body"></div>'; bindActions(this.root, { past: (t) => this.showPast(+t.dataset.i), endshift: () => this.game.endShift() }); }
  tick() { this.invalidate(); }
  render() {
    const rep = this.sim.report(); const past = this.game.save.profile.shiftReports;
    this.root.querySelector('[data-r="body"]').innerHTML = `<div class="row"><h3 style="margin:0" class="grow">Current shift</h3><button class="btn sm" data-act="endshift">End shift & file report</button></div>
      <div style="margin-top:10px">${reportHTML(rep)}</div>
      <div class="section-title" style="margin-top:18px">Previous shifts</div>
      ${past.length ? `<table class="table"><thead><tr><th>Date</th><th>Mode</th><th>Calls</th><th>Incidents</th><th>Units</th><th>XP</th></tr></thead><tbody>${past.map((r, i) => `<tr class="click" data-act="past" data-i="${i}"><td class="mono">${esc(r.date.slice(0, 16).replace('T', ' '))}</td><td>${esc(r.mode)}</td><td class="mono">${r.callsReceived}</td><td class="mono">${r.incidentsCompleted}</td><td class="mono">${r.unitsDispatched}</td><td class="mono good">+${r.xpEarned}</td></tr>`).join('')}</tbody></table>` : '<div class="dim">No filed shift reports yet.</div>'}`;
  }
  showPast(i) { const r = this.game.save.profile.shiftReports[i]; if (r) modal({ title: `Shift report – ${esc(r.date.slice(0, 10))}`, wide: true, body: reportHTML(r) }); }
}

// ---------------- Supervisor tools ----------------
export class SupervisorScreen extends Screen {
  constructor(cad) { super(cad, 'supervisor', 'Supervisor', '🛡'); }
  build() {
    this.root.innerHTML = '<div class="pane-body scroll" data-r="body"></div>';
    bindActions(this.root, {
      closedone: () => { const d = this.sim.incidents.list.filter((i) => i.status === 'completed'); d.forEach((i) => this.game.closeIncident(i)); toast(`${d.length} closed`, { level: 'good' }); },
      recallclearing: () => { let n = 0; for (const u of this.sim.units.list) if (u.status === 'clearing') { this.sim.units.sendHome(u); n++; } toast(`${n} units returning`, { level: 'info' }); },
      delegateall: () => { let n = 0; const npcs = STAFF.filter((s) => s.kind === 'dispatcher'); for (const i of this.sim.incidents.open().filter((x) => !x.units.length && x.priority >= 3 && x.status !== 'completed')) { if (delegate(this.sim, npcs[n % npcs.length])) n++; } toast(n ? `${n} low-priority incident(s) delegated` : 'Nothing to delegate', { level: n ? 'good' : 'info' }); },
      inc: (t) => this.cad.selectIncident(t.dataset.id),
      event: () => { const e = this.sim.cityEvents.start(); toast(`Started: ${e.title}`, { level: 'info' }); },
      wx: (t) => this.sim.weather.set(t.dataset.w),
      major: () => { this.sim.calls.spawnCall({ templateId: this.sim.rng.pick(['fire_house', 'mva_pileup', 'shots_fired', 'fire_apartment', 'hazmat_spill', 'explosion']) }); toast('A major incident call is ringing.', { level: 'alert' }); },
    });
    for (const ev of ['incident:updated', 'unit:status', 'incident:created']) bus.on(ev, () => this.invalidate());
  }
  tick() { this.invalidate(); }
  render() {
    const sim = this.sim; const box = this.root.querySelector('[data-r="body"]');
    if (!this.game.career.has('supervisor_tools', sim.state.mode)) { box.innerHTML = '<div class="empty">🔒 Supervisor Tools unlock at the <b>Dispatch Supervisor</b> rank in Career mode.<br>They are always available in Free Play and Custom Shifts.</div>'; return; }
    const open = sim.incidents.open();
    const byStatus = {}; for (const u of sim.units.list) byStatus[u.status] = (byStatus[u.status] || 0) + 1;
    const stale = open.filter((i) => !i.units.length && i.status !== 'completed' && sim.t - i.created > 90);
    const reqs = open.filter((i) => i.requests.length);
    box.innerHTML = `<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">
      <div class="card"><h4>Operations</h4><div class="col">
        <button class="btn sm" data-act="closedone">Close all completed incidents</button>
        <button class="btn sm" data-act="recallclearing">Send all clearing units home</button>
        <button class="btn sm" data-act="delegateall">Delegate pending P3/P4 to coworkers</button></div></div>
      <div class="card"><h4>Unit status overview</h4>${Object.entries(byStatus).map(([s, n]) => `<div class="row"><span class="dot" style="background:${UNIT_STATUS_COLORS[s]}"></span><span class="grow">${UNIT_STATUS_LABELS[s]}</span><span class="mono">${n}</span></div>`).join('')}</div>
      <div class="card"><h4>Needs attention</h4>${stale.length || reqs.length ? [...stale.map((i) => `<div class="row" style="cursor:pointer;margin:3px 0" data-act="inc" data-id="${i.id}">${pri(i.priority)} <span class="mono">${esc(i.number)}</span><span class="grow">unassigned ${gameAge(sim, i.created)}</span></div>`), ...reqs.map((i) => `<div class="row" style="cursor:pointer;margin:3px 0" data-act="inc" data-id="${i.id}">⚑ <span class="mono">${esc(i.number)}</span><span class="grow">resource request</span></div>`)].join('') : '<div class="dim">Everything is covered. Nice.</div>'}</div>
      <div class="card"><h4>Scenario control (sandbox)</h4><div class="col"><button class="btn sm" data-act="major">Trigger a major incident call</button><button class="btn sm" data-act="event">Start a random city event</button>
        <div class="row wrap" style="gap:3px">${Object.entries(WEATHER_TYPES).map(([k, w]) => `<button class="btn sm ${sim.weather.current() === k ? 'active' : ''}" data-act="wx" data-w="${k}" title="${w.label}">${w.icon}</button>`).join('')}</div></div></div>
    </div>
    <div class="section-title" style="margin-left:10px">Incident review</div>
    <table class="table"><thead><tr><th>P</th><th>Incident</th><th>Type</th><th>Status</th><th>Units</th><th>Progress</th><th>Age</th></tr></thead><tbody>
    ${open.map((i) => `<tr class="click p${i.priority}" data-act="inc" data-id="${i.id}"><td>${pri(i.priority)}</td><td class="mono">${esc(i.number)}</td><td>${esc(i.typeLabel)}</td><td>${incStatus(i.status)}</td><td class="mono">${i.units.length}</td><td style="width:110px"><div class="progress" style="margin:0"><i style="width:${Math.round(i.sim.progress * 100)}%"></i></div></td><td class="mono">${gameAge(sim, i.created)}</td></tr>`).join('') || '<tr><td colspan="7" class="dim">No open incidents.</td></tr>'}</tbody></table>`;
  }
}

// ---------------- Dispatch settings ----------------
export class SettingsScreen extends Screen {
  constructor(cad) { super(cad, 'settings', 'Settings', '⚙'); }
  build() {
    this.root.innerHTML = '<div class="pane-body scroll" data-r="body"></div>';
    this.root.addEventListener('change', (e) => {
      const k = e.target.dataset.cfg; const s = e.target.dataset.set;
      const v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? parseFloat(e.target.value) : e.target.value;
      if (k) { this.sim.setConfig({ [k]: k === 'travelSpeed' ? parseFloat(v) : v }); toast('Setting updated', { level: 'good', duration: 1500 }); }
      if (s) this.game.settings.set(s, v);
    });
    bindActions(this.root, { full: () => this.game.openSettings(), brk: () => this.game.toggleBreak(), save: () => this.game.manualSave() });
  }
  render() {
    const c = this.sim.config; const st = this.game.settings.data;
    const tog = (key, label, sub, src = 'cfg') => `<div class="set"><div>${label}<small>${sub}</small></div><label class="toggle"><input type="checkbox" data-${src}="${key}" ${(src === 'cfg' ? c[key] : key.split('.').reduce((o, x) => o[x], st)) ? 'checked' : ''}></label></div>`;
    const sel = (key, label, sub, opts) => `<div class="set"><div>${label}<small>${sub}</small></div><select class="input" style="width:auto" data-cfg="${key}">${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${String(c[key]) === String(k) ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
    this.root.querySelector('[data-r="body"]').innerHTML = `<div class="settings-list">
      <div class="row wrap"><button class="btn" data-act="brk">${this.sim.onBreak ? '☕ End break' : '☕ Take a break'}</button><button class="btn" data-act="save">💾 Save now</button><button class="btn" data-act="full">All settings…</button></div>
      ${sel('callFrequency', 'Call frequency', 'How often new 911 calls come in.', FREQUENCY_LABELS)}
      ${sel('majorFrequency', 'Major incidents', 'How often big emergencies happen.', { rare: 'Rare', occasional: 'Occasional', frequent: 'Frequent' })}
      ${tog('availabilityOverride', 'Availability override (sandbox)', 'Allow assigning busy / out-of-service units.')}
      ${tog('relaxed', 'Relaxed incidents', 'Incidents always make progress, gentler escalation. No pressure.')}
      ${tog('autoClearUnits', 'Auto-clear units', 'Units clear automatically when an incident resolves.')}
      ${tog('autoClose', 'Auto-close completed incidents', 'Otherwise you close them yourself to save history.')}
      ${tog('callerHangups', 'Callers may hang up', 'Realism: unanswered callers eventually disconnect (callback available).')}
      ${sel('backgroundActivity', 'Background unit activity', 'Units go busy on their own (traffic stops, meals, training).', { off: 'Off', low: 'Low', normal: 'Normal', high: 'High' })}
      ${tog('selfInitiated', 'Unit self-initiated activity', 'Patrol units start their own traffic stops.')}
      ${sel('travelSpeed', 'Unit travel speed', 'How fast units drive across the city.', { 0.6: 'Realistic', 1: 'Normal', 1.8: 'Fast' })}
      ${sel('difficulty', 'Difficulty', 'Affects escalation chances.', { easy: 'Easy', normal: 'Normal', hard: 'Hard' })}
      ${tog('tenCodes', 'Police 10-codes', 'Police units use 10-codes on the radio.')}
      ${tog('dynamicWeather', 'Dynamic weather', 'Weather changes during the shift.')}
      ${tog('cityEvents', 'City events', 'Road closures, outages, public events.')}
      ${tog('speech.tts', 'Caller voices (text-to-speech)', 'Callers speak out loud.', 'set')}
      ${tog('speech.radioTTS', 'Radio voices', 'Radio traffic is spoken aloud.', 'set')}
      ${tog('speech.autoSend', 'Auto-send speech', 'Send what you say as soon as you stop talking.', 'set')}
      ${tog('ui.toasts', 'Pop-up notifications', 'Show notification toasts.', 'set')}
    </div>`;
  }
}

export { fmtDuration, DEPT_BY_ID };
