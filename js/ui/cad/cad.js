// CAD controller: top status bar, adaptive multi-monitor layout, screen routing.
import { bus } from '../../core/events.js';
import { el, bindActions, anyModalOpen, closeTopModal, toast } from '../dom.js';
import { esc, throttleRAF } from '../../core/util.js';
import { clock } from '../fmt.js';
import { WEATHER_TYPES } from '../../sim/weather.js';
import { FREQUENCY_LABELS } from '../../sim/calls.js';

export class Screen {
  constructor(cad, id, title, icon) { this.cad = cad; this.game = cad.game; this.id = id; this.title = title; this.icon = icon; this.root = el(`<div class="screen-root" data-screen="${id}"></div>`); this.built = false; this.visible = false; this.dirty = true; }
  get sim() { return this.game.sim; }
  mount(container) { container.appendChild(this.root); if (!this.built) { this.build(); this.built = true; } this.visible = true; this.dirty = true; this.cad.scheduleRender(); this.onShow?.(); }
  unmount() { this.root.remove(); this.visible = false; }
  invalidate() { this.dirty = true; this.cad.scheduleRender(); }
  build() {}
  render() {}
  badge() { return 0; }
  tick() {}
}

const LAYOUTS = {
  3: [['calls', 'incidents', 'history', 'reports'], ['map', 'units', 'departments', 'supervisor'], ['radio', 'board', 'settings']],
  2: [['calls', 'incidents', 'history', 'reports', 'settings'], ['map', 'radio', 'units', 'departments', 'board', 'supervisor']],
  1: [['calls', 'incidents', 'map', 'radio', 'units', 'departments', 'board', 'history', 'reports', 'supervisor', 'settings']],
};
const MOBILE_TABS = ['calls', 'incidents', 'map', 'radio', 'units', 'more'];

export class CAD {
  constructor(game) {
    this.game = game; this.screens = {}; this.monitors = []; this.open = false; this.selectedIncident = null;
    this.root = document.getElementById('cad');
    this.scheduleRender = throttleRAF(() => this.renderAll());
  }

  register(screen) { this.screens[screen.id] = screen; }

  build() {
    this.root.innerHTML = '';
    this.top = el(`<div class="cad-top"></div>`);
    this.monRow = el(`<div class="cad-monitors"></div>`);
    this.bottom = el(`<div class="cad-bottom-tabs"></div>`);
    this.root.append(this.top, this.monRow, this.bottom);
    bindActions(this.top, {
      stand: () => this.game.closeCAD(),
      pause: () => this.game.togglePause(),
      answer: () => this.answerNext(),
      speed: (t) => { this.game.sim.setConfig({ timeScale: parseFloat(t.dataset.v) }); this.renderTop(); },
    });
    this.top.addEventListener('change', (e) => {
      if (e.target.dataset.act === 'freq') { this.game.sim.setConfig({ callFrequency: e.target.value }); toast(`Call frequency: ${FREQUENCY_LABELS[e.target.value]}`, { level: 'info' }); }
    });
    bindActions(this.bottom, { tab: (t) => this.showScreen(t.dataset.id === 'more' ? (this.moreScreen || 'board') : t.dataset.id, { fromTabs: true, more: t.dataset.id === 'more' }) });
    for (const ev of ['call:incoming', 'call:answered', 'call:ended', 'call:updated', 'incident:created', 'incident:updated', 'incident:closed', 'unit:status', 'game:paused', 'game:break', 'weather:changed', 'radio:message', 'notify', 'config:changed']) {
      bus.on(ev, () => { this.renderTopSoon(); });
    }
    this.renderTopSoon = throttleRAF(() => this.renderTop());
    window.addEventListener('resize', () => { if (this.open) this.layout(); });
    this.layout();
    setInterval(() => { if (this.open && this.game.sim) { this.renderTop(); for (const s of Object.values(this.screens)) if (s.visible) s.tick?.(); } }, 1000);
  }

  monitorCount() {
    const w = window.innerWidth;
    if (w < 900) return 1;
    const third = this.game.career.has('third_monitor', this.game.sim?.state.mode);
    if (w >= 1450 && third) return 3;
    return 2;
  }

  layout() {
    const n = this.monitorCount();
    if (this.layoutN === n && this.monitors.length) return;
    this.layoutN = n;
    for (const s of Object.values(this.screens)) s.unmount();
    this.monRow.innerHTML = '';
    this.monitors = LAYOUTS[n].map((ids, i) => {
      const m = { index: i, ids: ids.filter((id) => this.screens[id]), current: null };
      m.el = el(`<div class="monitor ${n === 3 && i === 0 ? 'wide' : ''}"><div class="screen"><div class="mon-tabs"></div><div class="mon-body"></div></div><div class="mon-label">MONITOR ${i + 1}</div></div>`);
      m.tabs = m.el.querySelector('.mon-tabs'); m.body = m.el.querySelector('.mon-body');
      bindActions(m.tabs, { tab: (t) => this.showScreen(t.dataset.id) });
      this.monRow.appendChild(m.el);
      return m;
    });
    this.monitors.forEach((m) => this.setMonitorScreen(m, m.ids[0]));
    this.renderTabs();
  }

  setMonitorScreen(m, id) {
    if (m.current === id) return;
    if (m.current) this.screens[m.current]?.unmount();
    m.current = id; this.screens[id]?.mount(m.body);
    this.renderTabs();
  }

  monitorFor(id) { return this.monitors.find((m) => m.ids.includes(id)) || this.monitors[0]; }

  /** Show a screen on the monitor that owns it. */
  showScreen(id, opts = {}) {
    if (!this.screens[id]) return;
    const m = this.monitorFor(id);
    if (opts.more) this.moreScreen = id;
    this.setMonitorScreen(m, id);
    if (this.layoutN === 1 && !MOBILE_TABS.includes(id)) this.moreScreen = id;
    if (opts.fromTabs && id === this.moreScreen && this.layoutN === 1 && opts.more) this.openMoreMenu();
    this.renderTabs();
  }

  openMoreMenu() {
    const items = ['departments', 'board', 'history', 'reports', 'supervisor', 'settings'].filter((id) => this.screens[id]);
    const m = this.monitors[0];
    const menu = el(`<div class="col" style="padding:8px">${items.map((id) => `<button class="btn" data-act="go" data-id="${id}" style="justify-content:flex-start">${this.screens[id].icon} ${this.screens[id].title}</button>`).join('')}</div>`);
    import('../dom.js').then(({ modal }) => {
      const md = modal({ title: 'More', body: menu, onAction: (a, t) => { md.close(); this.showScreen(t.dataset.id); } });
    });
    return m;
  }

  renderTabs() {
    for (const m of this.monitors) {
      m.tabs.innerHTML = m.ids.map((id) => {
        const s = this.screens[id]; const b = s.badge();
        return `<button class="mon-tab ${m.current === id ? 'active' : ''}" data-act="tab" data-id="${id}">${s.icon} ${s.title}${b ? ` <span class="badge">${b}</span>` : ''}</button>`;
      }).join('');
    }
    if (this.layoutN === 1) {
      const cur = this.monitors[0]?.current;
      this.bottom.innerHTML = MOBILE_TABS.map((id) => {
        const s = id === 'more' ? { icon: '☰', title: 'More', badge: () => this.screens.board?.badge() || 0 } : this.screens[id];
        const active = id === cur || (id === 'more' && !MOBILE_TABS.includes(cur));
        const b = s.badge();
        return `<button data-act="tab" data-id="${id}" class="${active ? 'active' : ''}"><span class="ic">${s.icon}</span>${s.title}${b ? `<span class="badge">${b}</span>` : ''}</button>`;
      }).join('');
    } else this.bottom.innerHTML = '';
  }

  renderTop() {
    const g = this.game; const sim = g.sim; if (!sim || !this.open) return;
    if (document.activeElement?.tagName === 'SELECT' && this.top.contains(document.activeElement)) return; // don't close an open dropdown
    const ringing = sim.calls.ringing().length;
    const open = sim.incidents.open().filter((i) => i.status !== 'completed').length;
    const awaiting = sim.incidents.open().filter((i) => !i.units.length && i.status !== 'completed').length;
    const c = sim.units.counts();
    const wx = WEATHER_TYPES[sim.weather.current()];
    const rank = g.career.rank();
    const shift = sim.config.shiftLength ? `<span class="ti hide-sm" title="Shift progress">⏱ ${Math.round(sim.shiftProgress() * 100)}%</span>` : '';
    const ts = sim.config.timeScale || 1;
    this.top.innerHTML = `
      <span class="brand">WHITE CO. <span>911</span> CAD</span>
      <span class="ti mono" title="Game clock">🕒 ${clock(sim.clock(), g)}</span>
      <span class="ti hide-sm" title="Weather">${wx.icon} ${wx.label}</span>
      ${shift}
      <span class="ti ${ringing ? 'ring' : ''}" data-act="answer" title="Ringing lines – press A to answer">📞 ${ringing} ringing</span>
      <span class="ti" title="Open incidents">🚨 ${open}${awaiting ? ` <span class="warn">(${awaiting} unassigned)</span>` : ''}</span>
      <span class="ti hide-sm" title="Available units">🚓 ${c.available}/${c.total}</span>
      ${sim.onBreak ? '<span class="ti good">☕ On break</span>' : ''}
      <span class="spacer"></span>
      <span class="ti hide-sm" title="Rank">${esc(rank.name)}</span>
      <select class="input hide-sm" data-act="freq" title="Call frequency">${Object.entries(FREQUENCY_LABELS).map(([k, v]) => `<option value="${k}" ${sim.config.callFrequency === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <span class="row hide-sm" style="gap:2px" title="Time speed">${[1, 2, 4].map((v) => `<button class="btn sm ${ts === v ? 'active' : ''}" data-act="speed" data-v="${v}">${v}×</button>`).join('')}</span>
      <button class="btn sm ${sim.paused ? 'warn' : ''}" data-act="pause" title="Pause (P)">${sim.paused ? '▶ Resume' : '⏸ Pause'}</button>
      <button class="btn sm" data-act="stand" title="Stand up (Esc)">🚶 Stand up</button>`;
    this.renderTabs();
  }

  renderAll() {
    if (!this.open || !this.game.sim) return;
    for (const s of Object.values(this.screens)) if (s.visible && s.dirty) { s.dirty = false; try { s.render(); } catch (e) { console.error(`[cad] render ${s.id}`, e); } }
  }

  invalidateAll() { for (const s of Object.values(this.screens)) s.dirty = true; this.scheduleRender(); }

  show() {
    this.open = true; this.root.hidden = false; document.getElementById('app').classList.add('cad-open'); document.body.classList.add('cad-open');
    this.layoutN = null; this.layout(); this.renderTop(); this.invalidateAll();
  }
  hide() { this.open = false; this.root.hidden = true; document.getElementById('app').classList.remove('cad-open'); document.body.classList.remove('cad-open'); }

  answerNext() {
    const sim = this.game.sim; const next = sim.calls.ringing().sort((a, b) => a.receivedAt - b.receivedAt)[0];
    if (!next) { toast('No calls ringing.', { level: 'info' }); return; }
    sim.calls.answer(next.id); this.showScreen('calls');
  }

  selectIncident(id, { show = true } = {}) {
    this.selectedIncident = id;
    bus.emit('cad:selectIncident', { id });
    if (show) { this.showScreen('incidents'); this.screens.incidents.openDetail(id); }
  }

  /** Keyboard shortcuts while seated. Returns true if handled. */
  handleKey(e) {
    if (!this.open) return false;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    if (e.key === 'Escape') { if (closeTopModal()) return true; if (typing) { document.activeElement.blur(); return true; } this.game.closeCAD(); return true; }
    if (e.key === 'F2') { e.preventDefault(); this.screens.calls.toggleMic(); return true; }
    if (e.key === 'Enter' && e.ctrlKey) { this.screens.calls.createIncident(); return true; }
    if (e.key === 'F4') { e.preventDefault(); this.screens.calls.endCall(); return true; }
    if (typing || anyModalOpen()) return false;
    const k = e.key.toLowerCase();
    const map = { c: 'calls', i: 'incidents', m: 'map', r: 'radio', n: 'units', d: 'departments', h: 'history', b: 'board' };
    if (k === 'a') { this.answerNext(); return true; }
    if (k === 'p') { this.game.togglePause(); return true; }
    if (k === 'u' && this.selectedIncident) { this.screens.incidents.openAssign(this.selectedIncident); return true; }
    if (k === 't') { this.screens.calls.focusInput(); e.preventDefault(); return true; }
    if (map[k]) { this.showScreen(map[k]); return true; }
    return false;
  }
}
