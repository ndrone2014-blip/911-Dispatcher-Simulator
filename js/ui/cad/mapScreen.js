// Interactive city map screen.
import { Screen } from './cad.js';
import { bus } from '../../core/events.js';
import { bindActions, toast } from '../dom.js';
import { esc, clamp } from '../../core/util.js';
import { pri, incStatus, unitStatus, callsign, etaText } from '../fmt.js';
import { MapRenderer } from './mapView.js';
import { TYPE_BY_ID } from '../../data/departments.js';
import { EVENT_KINDS } from '../../sim/cityEvents.js';
import { city, TOWNS, HAMLETS, insideCounty } from '../../data/city.js';

export class MapScreen extends Screen {
  constructor(cad) {
    super(cad, 'map', 'Map', '🗺');
    this.renderer = new MapRenderer(); this.view = null; this.sel = null; this.follow = false;
    this.layers = { units: true, idle: true, incidents: true, facilities: true, events: true, routes: true };
    this.baseDirty = true; this.running = false;
  }

  build() {
    this.root.innerHTML = `<div class="map-wrap" data-r="wrap"><canvas data-r="cv"></canvas>
      <div class="map-layers" data-r="layers"></div>
      <div class="map-ctrl"><button class="btn" data-act="zin" title="Zoom in">＋</button><button class="btn" data-act="zout" title="Zoom out">－</button><button class="btn" data-act="fit" title="Whole county">⤢</button><button class="btn" data-act="region" title="Surrounding area (outside the jurisdiction)">🌐</button><button class="btn" data-act="theme" data-r="themebtn" title="Map style"></button>
        <div class="map-goto-wrap"><select class="map-goto" data-r="goto" title="Go to a place" aria-label="Go to a place"><option value="">Go to…</option>${TOWNS.map((t) => `<option value="t:${t.id}">${esc(t.name)}</option>`).join('')}${HAMLETS.map(([n]) => `<option value="h:${esc(n)}">${esc(n)}</option>`).join('')}</select></div></div>
      <div class="map-juris" data-r="juris" hidden>Outside White County – not your jurisdiction (mutual aid only)</div>
      <div class="map-info" data-r="info" hidden></div>
      <div class="map-legend hide-narrow"><span>▲</span><span>Incident (color = priority)</span><span>●</span><span>Unit (ring = status)</span><span>◆</span><span>Aircraft</span><span>▢</span><span>Facility</span></div></div>`;
    this.wrap = this.root.querySelector('[data-r="wrap"]'); this.cv = this.root.querySelector('[data-r="cv"]'); this.ctx = this.cv.getContext('2d');
    this.base = document.createElement('canvas'); this.bctx = this.base.getContext('2d');
    bindActions(this.root, {
      zin: () => this.zoom(1.4), zout: () => this.zoom(1 / 1.4), fit: () => { const { w, h } = this.size(); this.view = this.renderer.fit(w, h); this.baseDirty = true; },
      region: () => { const { w, h } = this.size(); this.view = this.renderer.fitRegion(w, h); this.baseDirty = true; },
      theme: () => { this.game.settings.set('map.theme', this.theme() === 'day' ? 'night' : 'day'); this.baseDirty = true; this.renderThemeBtn(); },
      carmi: () => { const { w, h } = this.size(); this.view = this.renderer.focusTown('carmi', w, h); this.baseDirty = true; },
      layer: (t) => { this.layers[t.dataset.l] = !this.layers[t.dataset.l]; this.renderLayers(); },
      openinc: (t) => this.cad.selectIncident(t.dataset.id),
      assigninc: (t) => this.cad.screens.incidents.openAssign(t.dataset.id),
      assignto: (t) => { const rep = this.sim.units.assign([t.dataset.u], this.cad.selectedIncident, { override: this.sim.config.availabilityOverride }); this.game.reportAssignment(rep, this.sim.incidents.byId(this.cad.selectedIncident)); },
      unitdetail: (t) => this.cad.screens.units.openUnit(t.dataset.u),
      radiocheck: (t) => { this.sim.radio.playerTransmit({ unitId: t.dataset.u, intent: 'status' }); toast('Status check sent', { level: 'radio' }); },
      recall: (t) => { const r = this.sim.units.recall(t.dataset.u); if (r && !r.ok) toast(r.reason, { level: 'warn' }); },
      follow: () => { this.follow = !this.follow; this.renderInfo(); },
      closeinfo: () => { this.sel = null; this.renderInfo(); },
    });
    this.setupInput();
    this.root.querySelector('[data-r="goto"]').addEventListener('change', (e) => {
      const v = e.target.value; e.target.value = ''; if (!v) return; const { w, h } = this.size();
      if (v.startsWith('t:')) this.view = this.renderer.focusTown(v.slice(2), w, h);
      else { const hm = HAMLETS.find(([n]) => n === v.slice(2)); if (hm) this.view = { cx: hm[1], cy: hm[2], scale: 0.5 }; }
      this.baseDirty = true;
    });
    this.renderThemeBtn();
    bus.on('cad:selectIncident', ({ id }) => { if (this.visible) { const inc = this.sim.incidents.byId(id); if (inc) { this.sel = { kind: 'incident', id }; this.renderInfo(); } } });
    for (const ev of ['unit:status', 'incident:updated', 'incident:created']) bus.on(ev, () => { if (this.visible) this.renderInfo(); });
    new ResizeObserver(() => { this.baseDirty = true; }).observe(this.wrap);
    this.renderLayers();
  }

  onShow() { if (!this.running) { this.running = true; this.loop(); } }
  theme() { return this.game.settings?.get('map.theme') || 'day'; }
  renderThemeBtn() { const b = this.root?.querySelector('[data-r="themebtn"]'); if (b) { b.textContent = this.theme() === 'day' ? '☾' : '☀'; b.title = this.theme() === 'day' ? 'Night (CAD) map style' : 'Day (aerial) map style'; } }
  /** Pan/zoom draws a lighter frame; full detail returns as soon as the map is still. */
  interact() { this.interactUntil = performance.now() + 160; this.baseDirty = true; }

  loop() {
    if (!this.visible || !this.cad.open) { this.running = false; return; }
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  size() {
    const dpr = Math.min(2, window.devicePixelRatio || 1); const w = this.wrap.clientWidth, h = this.wrap.clientHeight;
    if (this.cv.width !== Math.round(w * dpr) || this.cv.height !== Math.round(h * dpr)) {
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); this.base.width = this.cv.width; this.base.height = this.cv.height; this.baseDirty = true;
    }
    return { w, h, dpr };
  }

  draw() {
    const { w, h, dpr } = this.size(); if (!w || !h) return;
    if (!this.view) { this.view = this.firstView ? this.renderer.fit(w, h) : this.renderer.focusTown('carmi', w, h); this.firstView = true; this.baseDirty = true; }
    if (this.follow && this.sel?.kind === 'unit') { const u = this.sim.units.byId(this.sel.id); if (u) { this.view.cx = u.x; this.view.cy = u.y; this.interact(); } }
    const fast = performance.now() < (this.interactUntil || 0);
    if (!fast && this.wasFast) this.baseDirty = true;
    if (this.baseDirty) {
      this.baseDirty = false; this.wasFast = fast; this.bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.renderer.drawBase(this.bctx, this.view, w, h, { labels: true, theme: this.theme(), fast });
      const juris = this.root.querySelector('[data-r="juris"]'); if (juris) juris.hidden = insideCounty(this.view.cx, this.view.cy);
    }
    const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(this.base, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const avl = this.game.career.has('avl_overlay', this.sim.state.mode);
    this.renderer.drawDynamic(c, this.view, w, h, this.sim, {
      layers: { ...this.layers, routes: this.layers.routes }, selectedIncident: this.cad.selectedIncident, selectedUnit: this.sel?.kind === 'unit' ? this.sel.id : null,
      allRoutes: this.layers.routes && avl, incidentRoutes: true, etaLabels: avl, showIdle: this.layers.idle, call: this.sim.calls.active(),
    });
  }

  zoom(f, px, py) {
    if (!this.view) return;
    const { w, h } = this.size();
    px ??= w / 2; py ??= h / 2;
    const wx = (px - w / 2) / this.view.scale + this.view.cx, wy = (py - h / 2) / this.view.scale + this.view.cy;
    this.view.scale = clamp(this.view.scale * f, this.renderer.minScale(w, h), 3);
    this.view.cx = wx - (px - w / 2) / this.view.scale; this.view.cy = wy - (py - h / 2) / this.view.scale;
    this.interact();
  }

  focusOn(x, y, scale = 0.45) { const { w, h } = this.size(); if (!this.view) this.view = this.renderer.fit(w || 600, h || 400); this.view.cx = x; this.view.cy = y; this.view.scale = Math.max(this.view.scale, scale); this.baseDirty = true; }

  setupInput() {
    const cv = this.cv; const pointers = new Map(); let drag = null; let pinch = null; let moved = false;
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); moved = false;
      if (pointers.size === 1) drag = { x: e.offsetX, y: e.offsetY };
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; drag = null; } });
    cv.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId) || !this.view) return;
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this.zoom(d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch.d = d; moved = true; return; }
      if (drag) { const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; this.view.cx -= dx / this.view.scale; this.view.cy -= dy / this.view.scale; drag = { x: e.offsetX, y: e.offsetY }; this.interact(); if (moved) this.follow = false; }
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!moved && drag && this.view) this.click(e.offsetX, e.offsetY);
      if (!pointers.size) drag = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.offsetX, e.offsetY); }, { passive: false });
  }

  click(px, py) {
    const { w, h } = this.size();
    const hit = this.renderer.hit(this.view, w, h, px, py, this.sim);
    if (hit.kind === 'incident') { this.sel = { kind: 'incident', id: hit.obj.id }; this.cad.selectedIncident = hit.obj.id; bus.emit('cad:selectIncident', { id: hit.obj.id }); }
    else if (hit.kind === 'unit') this.sel = { kind: 'unit', id: hit.obj.id };
    else if (hit.kind === 'facility') this.sel = { kind: 'facility', id: hit.obj.id };
    else this.sel = null;
    this.game.audio?.click();
    this.renderInfo();
  }

  renderLayers() {
    const names = { units: 'Units', idle: 'Idle units', incidents: 'Incidents', facilities: 'Facilities', events: 'Events', routes: 'Routes' };
    this.root.querySelector('[data-r="layers"]').innerHTML = Object.entries(names).map(([k, v]) => `<button class="chip ${this.layers[k] ? 'active' : ''}" data-act="layer" data-l="${k}">${v}</button>`).join('');
  }

  render() { this.renderInfo(); }
  tick() { if (this.sel?.kind === 'unit') this.renderInfo(); }

  renderInfo() {
    const box = this.root?.querySelector('[data-r="info"]'); if (!box || !this.sim) return;
    const sim = this.sim; const sel = this.sel;
    if (!sel) { box.hidden = true; return; }
    box.hidden = false;
    const close = '<button class="btn ghost sm" data-act="closeinfo" style="float:right">✕</button>';
    if (sel.kind === 'incident') {
      const i = sim.incidents.byId(sel.id); if (!i) { box.hidden = true; return; }
      box.innerHTML = `${close}<div>${pri(i.priority)} <b class="mono">${esc(i.number)}</b></div><div style="margin:4px 0"><b>${esc(i.typeLabel)}</b> ${incStatus(i.status)}</div>
        <div class="dim">📍 ${esc(i.location.full)}</div><div class="dim" style="margin-top:3px">${i.units.length} unit(s) assigned</div>
        <div class="row wrap" style="margin-top:8px"><button class="btn sm primary" data-act="assigninc" data-id="${i.id}">Assign units</button><button class="btn sm" data-act="openinc" data-id="${i.id}">Open</button></div>`;
    } else if (sel.kind === 'unit') {
      const u = sim.units.byId(sel.id); if (!u) { box.hidden = true; return; }
      const inc = u.incident ? sim.incidents.byId(u.incident) : null;
      const target = this.cad.selectedIncident ? sim.incidents.byId(this.cad.selectedIncident) : null;
      box.innerHTML = `${close}<div>${callsign(u)} <span class="dim">${esc(TYPE_BY_ID[u.type].name)}</span></div><div style="margin:4px 0">${unitStatus(u, sim)}${u.status === 'responding' || u.status === 'transporting' ? ` <span class="mono">ETA ${etaText(sim, u.eta)}</span>` : ''}</div>
        <div class="dim">${esc(sim.units.locationText(u))}</div>${inc ? `<div style="margin-top:3px">On <b class="mono">${esc(inc.number)}</b> ${esc(inc.typeLabel)}</div>` : ''}
        <div class="row wrap" style="margin-top:8px">
          ${target && target.status !== 'closed' && u.incident !== target.id ? `<button class="btn sm primary" data-act="assignto" data-u="${u.id}">Assign to ${esc(target.number)}</button>` : ''}
          <button class="btn sm" data-act="radiocheck" data-u="${u.id}">📻 Status check</button>
          <button class="btn sm" data-act="follow">${this.follow ? 'Unfollow' : 'Follow'}</button>
          <button class="btn sm" data-act="unitdetail" data-u="${u.id}">Details</button>
          ${u.status !== 'available' ? `<button class="btn sm" data-act="recall" data-u="${u.id}">Recall</button>` : ''}</div>`;
    } else if (sel.kind === 'facility') {
      const facObj = city.facilities.find((x) => x.id === sel.id);
      const here = sim.units.list.filter((u) => u.station === sel.id);
      box.innerHTML = `${close}<b>${esc(facObj?.name || 'Facility')}</b><div class="dim" style="margin:3px 0">${esc(facObj?.address || '')}</div>
        ${here.length ? `<div class="section-title">Home units (${here.length})</div>${here.map((u) => `<div class="row" style="margin:2px 0">${callsign(u)}<span class="grow"></span>${unitStatus(u, sim)}</div>`).join('')}` : '<div class="dim">No units stationed here.</div>'}`;
    }
  }
}

export { EVENT_KINDS };
