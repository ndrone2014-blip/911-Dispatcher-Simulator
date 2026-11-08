// Dynamic canvas textures for in-world screens (monitors, video wall, TVs,
// department boards, clock, exterior sky/skyline).
import { makeCanvas, textTexture } from '../engine/textures.js';
import { MapRenderer } from '../ui/cad/mapView.js';
import { DEPARTMENTS, CHANNEL_BY_ID } from '../data/departments.js';
import { WEATHER_TYPES } from '../sim/weather.js';
import { fmtClock } from '../core/util.js';
import { isThanksgivingSeason, thanksgivingOn } from '../core/season.js';

const PRI = { 1: '#ff4d4d', 2: '#ff9f43', 3: '#f2c94c', 4: '#6fa8dc' };

export class ScreenPainter {
  constructor(res = 512) {
    this.res = res; this.map = new MapRenderer(); this.t = 0; this.tickerX = 0;
    this.skyline = this.makeSkyline();
  }

  canvasFor(s) {
    const r = this.res;
    switch (s.kind) {
      case 'monitor': case 'coworker': return makeCanvas(r, Math.round(r * 0.6));
      case 'videowall': return makeCanvas(r * 2, Math.round(r * 2 * (2.5 / 8.6)));
      case 'tv': return makeCanvas(r, Math.round(r * 0.5625));
      case 'board': return makeCanvas(r, Math.round(r * 0.58));
      case 'clock': return makeCanvas(128, 128);
      case 'exterior': return makeCanvas(1024, 320);
      case 'rainfx': return makeCanvas(256, 128);
      case 'shiftboard': return makeCanvas(512, 256);
      case 'sign': return textTexture(s.text || '', { w: s.small ? 256 : 1024, h: s.small ? 64 : 64, bg: s.small ? '#10151d' : '#0b1626', fg: s.small ? '#64d2ff' : '#dfe8f5', font: s.small ? 'bold 26px system-ui' : 'bold 38px system-ui' });
      case 'banner': return this.bannerCanvas(s.text || '', s.w / s.h);
      default: return makeCanvas(64, 64);
    }
  }

  /** Festive autumn banner: bunting flags, leaves and cream lettering on a harvest gradient. */
  bannerCanvas(text, aspect = 6) {
    const h = 128; const w = Math.min(2048, Math.round(h * aspect)); const c = makeCanvas(w, h); const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#8a3b12'); grad.addColorStop(1, '#5a2108');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const flags = ['#c0392b', '#e67e22', '#f1c40f', '#7a4b1f'];
    const n = Math.max(6, Math.round(w / 46)); const fw = w / n;
    for (let i = 0; i < n; i++) { g.fillStyle = flags[i % 4]; g.beginPath(); g.moveTo(i * fw, 0); g.lineTo((i + 1) * fw, 0); g.lineTo((i + 0.5) * fw, 26); g.closePath(); g.fill(); }
    g.strokeStyle = '#3a1a06'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 2); g.lineTo(w, 2); g.stroke();
    const leaf = (x, y, r, rot, col) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col; g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(r * 0.9, -r * 0.2, 0, r); g.quadraticCurveTo(-r * 0.9, -r * 0.2, 0, -r); g.fill(); g.strokeStyle = 'rgba(60,20,0,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -r); g.lineTo(0, r * 1.25); g.stroke(); g.restore(); };
    let size = 64; g.font = `900 ${size}px system-ui, sans-serif`;
    while (g.measureText(text).width > w - 150 && size > 20) { size -= 2; g.font = `900 ${size}px system-ui, sans-serif`; }
    const tw = g.measureText(text).width;
    leaf(w / 2 - tw / 2 - 40, 76, 22, -0.6, '#e67e22'); leaf(w / 2 - tw / 2 - 18, 88, 16, 0.4, '#f1c40f');
    leaf(w / 2 + tw / 2 + 40, 76, 22, 0.6, '#c0392b'); leaf(w / 2 + tw / 2 + 18, 90, 16, -0.4, '#e67e22');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(text, w / 2 + 3, 80 + 3);
    g.fillStyle = '#fff3d6'; g.fillText(text, w / 2, 80);
    g.strokeStyle = '#f1c40f'; g.lineWidth = 4; g.strokeRect(4, 30, w - 8, h - 34);
    return c;
  }

  // ------------- helpers -------------
  header(g, w, title, color = '#3da5ff') {
    g.fillStyle = '#0a1220'; g.fillRect(0, 0, w, w * 0.07);
    g.fillStyle = color; g.font = `bold ${Math.round(w * 0.035)}px system-ui`; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText(title, w * 0.02, w * 0.036);
  }

  paint(s, canvas, game) {
    const g = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; const sim = game?.sim;
    this.t += 0.0;
    switch (s.kind) {
      case 'monitor': return this.paintMonitor(s.monitorIndex, g, w, h, game);
      case 'coworker': return this.paintCoworker(s.key, g, w, h, game);
      case 'videowall': return this.paintVideoWall(g, w, h, game);
      case 'tv': return this.paintTV(g, w, h, game);
      case 'board': return this.paintBoard(s.boardIndex, g, w, h, sim);
      case 'clock': return this.paintClock(g, w, h, sim);
      case 'exterior': return s.sky ? this.paintSky(g, w, h, game) : this.paintExterior(g, w, h, game);
      case 'rainfx': return this.paintRain(g, w, h, game);
      case 'shiftboard': return this.paintShiftBoard(g, w, h, game);
      default: return null;
    }
  }

  paintMonitor(i, g, w, h, game) {
    const sim = game.sim;
    g.fillStyle = '#0b111b'; g.fillRect(0, 0, w, h);
    if (!sim) { g.fillStyle = '#3da5ff'; g.font = `bold ${w * 0.05}px system-ui`; g.textAlign = 'center'; g.fillText('REGIONAL 911 CAD', w / 2, h / 2); return; }
    const fs = Math.round(w * 0.03); g.textBaseline = 'top'; g.textAlign = 'left';
    if (i === 0) {
      this.header(g, w, 'CAD · CALLS & INCIDENTS');
      let y = w * 0.085;
      const ring = sim.calls.ringing();
      g.font = `bold ${fs}px system-ui`;
      if (ring.length) { g.fillStyle = (Math.floor(performance.now() / 500) % 2) ? '#b31f1f' : '#5c1010'; g.fillRect(w * 0.02, y, w * 0.96, fs * 1.8); g.fillStyle = '#fff'; g.fillText(`☎ ${ring.length} CALL${ring.length > 1 ? 'S' : ''} RINGING`, w * 0.04, y + fs * 0.4); y += fs * 2.3; }
      const act = sim.calls.active();
      if (act) {
        g.fillStyle = '#10233d'; g.fillRect(w * 0.02, y, w * 0.96, fs * 5.4);
        g.fillStyle = '#2fd08a'; g.fillText(`● LINE ${act.line} CONNECTED`, w * 0.04, y + fs * 0.3);
        g.font = `${fs * 0.9}px system-ui`; g.fillStyle = '#c9d6e8';
        act.transcript.filter((l) => l.who !== 'system').slice(-3).forEach((l, k) => g.fillText(`${l.who === 'caller' ? 'C' : 'D'}: ${l.text}`.slice(0, 64), w * 0.04, y + fs * (1.5 + k * 1.25)));
        y += fs * 6;
      }
      g.font = `bold ${fs * 0.85}px system-ui`; g.fillStyle = '#6f819b'; g.fillText('ACTIVE INCIDENTS', w * 0.03, y); y += fs * 1.3;
      g.font = `${fs * 0.9}px ui-monospace, monospace`;
      for (const inc of sim.incidents.open().slice(0, 8)) {
        g.fillStyle = PRI[inc.priority]; g.fillRect(w * 0.03, y + 2, w * 0.012, fs * 0.9);
        g.fillStyle = '#dfe8f5'; g.fillText(`${inc.number}  ${inc.typeLabel.slice(0, 22).padEnd(22)}  ${inc.units.length}u`, w * 0.055, y); y += fs * 1.2;
        if (y > h - fs) break;
      }
    } else if (i === 1) {
      this.header(g, w, 'MAP · UNIT TRACKING', '#2fd08a');
      const top = w * 0.07; const mh = h - top; g.save(); g.translate(0, top);
      const view = this.map.fit(w, mh); view.scale *= 1.05;
      this.map.drawBase(g, view, w, mh, { labels: false, buildings: true, detail: 0 });
      this.map.drawDynamic(g, view, w, mh, sim, { labels: false, layers: { units: true, incidents: true, facilities: false, events: true, routes: false }, showIdle: false });
      g.restore();
    } else {
      this.header(g, w, 'RADIO · ALL CHANNELS', '#b47cff');
      let y = w * 0.085; g.font = `${fs * 0.88}px system-ui`;
      const msgs = sim.radio.log.slice(-11);
      for (const m of msgs) {
        const c = CHANNEL_BY_ID[m.channel];
        g.fillStyle = c?.color || '#888'; g.fillRect(w * 0.02, y + 2, w * 0.07, fs * 0.9);
        g.fillStyle = '#081018'; g.font = `bold ${fs * 0.6}px system-ui`; g.fillText(c?.short || '', w * 0.025, y + fs * 0.18);
        g.font = `${fs * 0.88}px system-ui`; g.fillStyle = m.dispatcher ? '#64d2ff' : '#dfe8f5';
        g.fillText(`${m.from}: ${m.text}`.slice(0, 62), w * 0.11, y); y += fs * 1.25;
      }
    }
  }

  paintCoworker(key, g, w, h, game) {
    const t = performance.now() / 1000; const variant = parseInt(key.slice(-1), 10) || 0;
    g.fillStyle = '#0b111b'; g.fillRect(0, 0, w, h);
    if (variant === 1 && game.sim) {
      const view = this.map.fit(w, h);
      this.map.drawBase(g, view, w, h, { labels: false, buildings: false, detail: 0 });
      this.map.drawDynamic(g, view, w, h, game.sim, { labels: false, layers: { units: true, incidents: true }, showIdle: false });
      return;
    }
    this.header(g, w, variant === 0 ? 'CAD · CALL TAKING' : 'RADIO CONSOLE', variant === 0 ? '#3da5ff' : '#b47cff');
    const fs = Math.round(w * 0.028); g.font = `${fs}px ui-monospace, monospace`; g.textBaseline = 'top';
    const rows = 12; const off = Math.floor(t * (variant === 0 ? 0.7 : 1.3));
    for (let r = 0; r < rows; r++) {
      const n = (r + off) % 23;
      g.fillStyle = n % 7 === 0 ? '#ff9f43' : n % 5 === 0 ? '#2fd08a' : '#7f93b0';
      g.fillRect(w * 0.03, w * 0.09 + r * fs * 1.3, w * (0.2 + ((n * 37) % 50) / 100), fs * 0.7);
      g.fillStyle = '#2a3b57'; g.fillRect(w * 0.6, w * 0.09 + r * fs * 1.3, w * (0.1 + ((n * 13) % 25) / 100), fs * 0.7);
    }
  }

  paintVideoWall(g, w, h, game) {
    const sim = game.sim; const fs = Math.round(h * 0.055);
    g.fillStyle = '#060b14'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0d1a2e'; g.fillRect(0, 0, w, h * 0.1);
    g.fillStyle = '#dfe8f5'; g.font = `bold ${fs}px system-ui`; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText('REGIONAL 911 · CARMI · OPERATIONS', w * 0.01, h * 0.05);
    if (!sim) return;
    const wx = WEATHER_TYPES[sim.weather.current()];
    g.textAlign = 'right'; g.fillText(`${wx.icon} ${wx.label}   ${fmtClock(sim.clock())}`, w * 0.99, h * 0.05);
    // stat tiles
    const c = sim.units.counts(); const open = sim.incidents.open().filter((i) => i.status !== 'completed');
    const tiles = [['CALLS WAITING', sim.calls.ringing().length, '#ff5a4e'], ['OPEN INCIDENTS', open.length, '#ff9f43'], ['PRIORITY 1', open.filter((i) => i.priority === 1).length, '#ff4d4d'],
      ['UNITS AVAILABLE', `${c.available}/${c.total}`, '#2fd08a'], ['CALLS THIS SHIFT', sim.stats.callsReceived, '#64d2ff'], ['UNITS DISPATCHED', sim.stats.unitsDispatched, '#b47cff']];
    const tw = w * 0.22, th = (h * 0.86) / 3 - h * 0.02;
    tiles.forEach(([label, val, col], i) => {
      const x = w * 0.01 + (i % 2) * (tw / 2 + w * 0.005), y = h * 0.12 + Math.floor(i / 2) * (th + h * 0.02);
      g.fillStyle = '#0e1828'; g.fillRect(x, y, tw / 2, th);
      g.fillStyle = col; g.fillRect(x, y, tw / 2, h * 0.012);
      g.textAlign = 'left'; g.fillStyle = '#8da0bb'; g.font = `bold ${fs * 0.55}px system-ui`; g.fillText(label, x + w * 0.006, y + th * 0.25);
      g.fillStyle = '#fff'; g.font = `bold ${fs * 1.4}px ui-monospace, monospace`; g.fillText(String(val), x + w * 0.006, y + th * 0.65);
    });
    // map
    const mx = w * 0.245, mw = w * 0.42, my = h * 0.12, mh = h * 0.86;
    g.save(); g.beginPath(); g.rect(mx, my, mw, mh); g.clip(); g.translate(mx, my);
    const view = this.map.fit(mw, mh);
    this.map.drawBase(g, view, mw, mh, { labels: false, buildings: game.career?.has('video_wall', sim.state.mode) });
    this.map.drawDynamic(g, view, mw, mh, sim, { labels: false, layers: { units: true, incidents: true, facilities: false, events: true }, showIdle: false });
    g.restore();
    // incident list
    const lx = w * 0.675; let y = h * 0.14;
    g.fillStyle = '#8da0bb'; g.font = `bold ${fs * 0.6}px system-ui`; g.textAlign = 'left'; g.fillText('ACTIVE INCIDENTS', lx, y); y += fs * 0.9;
    g.font = `${fs * 0.62}px ui-monospace, monospace`;
    for (const inc of open.slice(0, 13)) {
      g.fillStyle = PRI[inc.priority]; g.fillRect(lx, y - fs * 0.3, w * 0.006, fs * 0.6);
      g.fillStyle = '#dfe8f5'; g.fillText(`${inc.number} ${inc.typeLabel.slice(0, 20).padEnd(20)} ${String(inc.units.length).padStart(2)}u`, lx + w * 0.01, y);
      y += fs * 0.78;
    }
    if (!open.length) { g.fillStyle = '#4e5d74'; g.fillText('No open incidents', lx, y); }
  }

  paintTV(g, w, h, game) {
    const sim = game.sim; const t = performance.now() / 1000;
    const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, '#13213d'); grad.addColorStop(1, '#0a1020');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // anchor silhouette + desk
    g.fillStyle = '#26365a'; g.fillRect(w * 0.55, h * 0.18, w * 0.4, h * 0.42);
    g.fillStyle = '#d8b48f'; g.beginPath(); g.arc(w * 0.3, h * 0.32, h * 0.09, 0, 6.283); g.fill();
    g.fillStyle = '#1a2233'; g.fillRect(w * 0.2, h * 0.41, w * 0.2, h * 0.25);
    g.fillStyle = '#5a2a1a'; g.fillRect(w * 0.29, h * 0.43, w * 0.02, h * 0.12);
    g.fillStyle = '#0d1424'; g.fillRect(w * 0.1, h * 0.58, w * 0.42, h * 0.08);
    // headline from the sim
    const headline = this.headline(sim);
    g.fillStyle = '#c4161c'; g.fillRect(0, h * 0.68, w * 0.24, h * 0.1);
    g.fillStyle = '#fff'; g.font = `bold ${h * 0.06}px system-ui`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText('BREAKING', w * 0.12, h * 0.73);
    g.fillStyle = 'rgba(8,14,28,.92)'; g.fillRect(w * 0.24, h * 0.68, w * 0.76, h * 0.1);
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = `bold ${h * 0.055}px system-ui`; g.fillText(headline.slice(0, 48), w * 0.26, h * 0.73);
    // ticker
    g.fillStyle = '#f2c94c'; g.fillRect(0, h * 0.8, w, h * 0.1);
    const tick = this.tickerText(sim);
    g.fillStyle = '#111'; g.font = `bold ${h * 0.05}px system-ui`;
    const tw = g.measureText(tick).width; const x = w - ((t * 60) % (tw + w));
    g.fillText(tick, x, h * 0.85);
    g.fillStyle = '#c4161c'; g.fillRect(0, h * 0.9, w, h * 0.1);
    g.fillStyle = '#fff'; g.font = `bold ${h * 0.05}px system-ui`; g.fillText(`CHANNEL 8 · TRI-STATE NEWS · CARMI · ${sim ? fmtClock(sim.clock()) : ''}`, w * 0.02, h * 0.95);
  }

  headline(sim) {
    if (!sim) return 'White County Weather: Mild week ahead';
    const major = sim.incidents.open().find((i) => i.severity === 'major');
    if (major) return `${major.typeLabel} reported near ${major.location.street || major.location.district || 'White County'}`;
    const ev = sim.state.events[0]; if (ev) return ev.title;
    const wx = WEATHER_TYPES[sim.weather.current()];
    return wx.label === 'Clear' ? 'Quiet day across White County' : `${wx.label} across White County`;
  }

  tickerText(sim) {
    const parts = ['Carmi City Council approves new fire truck funding', 'Bulldogs advance in the playoffs', 'Harvest wraps up early across White County', 'Little Wabash River cleanup this weekend', 'Thanksgiving community dinner Thursday at the fairgrounds'];
    if (sim) {
      for (const e of sim.state.events) parts.unshift(e.desc);
      for (const i of sim.incidents.open().slice(0, 3)) parts.unshift(`Emergency crews respond to ${i.typeLabel.toLowerCase()} in ${i.location.district || 'White County'}`);
    }
    return parts.join('   •   ');
  }

  paintBoard(i, g, w, h, sim) {
    g.fillStyle = '#081019'; g.fillRect(0, 0, w, h);
    const groups = [['police', 'sheriff', 'federal', 'coastguard'], ['fire', 'ems'], ['em', 'sar', 'publicworks', 'animal', 'dot', 'utility', 'disaster', 'comms']][i];
    const title = ['LAW ENFORCEMENT', 'FIRE & EMS', 'SUPPORT SERVICES'][i];
    this.header(g, w, `${title} · AVAILABILITY`, ['#4f8cff', '#ff5a4e', '#b47cff'][i]);
    if (!sim) return;
    const fs = Math.round(w * 0.034); let y = w * 0.1; g.textBaseline = 'middle';
    for (const id of groups) {
      const d = DEPARTMENTS.find((x) => x.id === id); const us = sim.units.list.filter((u) => u.dept === id); if (!us.length) continue;
      const a = us.filter((u) => sim.units.isAssignable(u)).length;
      g.fillStyle = d.color; g.fillRect(w * 0.03, y - fs * 0.45, w * 0.015, fs * 0.9);
      g.fillStyle = '#dfe8f5'; g.font = `bold ${fs}px system-ui`; g.textAlign = 'left'; g.fillText(d.short, w * 0.06, y);
      g.fillStyle = '#16233a'; g.fillRect(w * 0.27, y - fs * 0.35, w * 0.5, fs * 0.7);
      g.fillStyle = a / us.length > 0.5 ? '#2fd08a' : a / us.length > 0.2 ? '#f2c94c' : '#ff5a4e'; g.fillRect(w * 0.27, y - fs * 0.35, (w * 0.5 * a) / us.length, fs * 0.7);
      g.fillStyle = '#fff'; g.textAlign = 'right'; g.font = `bold ${fs}px ui-monospace, monospace`; g.fillText(`${a}/${us.length}`, w * 0.97, y);
      y += fs * (groups.length > 4 ? 1.35 : 2.0);
      if (y > h - fs) break;
    }
  }

  paintClock(g, w, h, sim) {
    const m = sim ? sim.clock() : 0; const r = w * 0.46;
    g.clearRect(0, 0, w, h); g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(w / 2, h / 2, r, 0, 6.283); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = w * 0.04; g.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; g.beginPath(); g.moveTo(w / 2 + Math.sin(a) * r * 0.78, h / 2 - Math.cos(a) * r * 0.78); g.lineTo(w / 2 + Math.sin(a) * r * 0.9, h / 2 - Math.cos(a) * r * 0.9); g.lineWidth = w * 0.025; g.stroke(); }
    const hand = (a, len, wd, col) => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.sin(a) * len, h / 2 - Math.cos(a) * len); g.stroke(); };
    hand(((m / 60) % 12) / 12 * 6.283, r * 0.5, w * 0.05, '#111'); hand(((m % 60) / 60) * 6.283, r * 0.75, w * 0.03, '#111'); hand(((m * 60) % 60) / 60 * 6.283, r * 0.82, w * 0.012, '#c4161c');
  }

  /** Small-town Carmi skyline: low storefronts, houses, trees, the water tower, a grain elevator and a steeple. */
  makeSkyline() {
    const items = []; let x = 0; let seed = 11;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const landmarks = [[150, 'elevator'], [430, 'steeple'], [640, 'tower'], [860, 'elevator2']];
    while (x < 1024) {
      const lm = landmarks.find(([lx]) => Math.abs(lx - x) < 30 && !items.some((i) => i.kind === landmarks.find((l) => l[0] === lx)[1]));
      if (lm) { const kind = lm[1]; const w = kind === 'tower' ? 70 : kind === 'steeple' ? 60 : kind === 'elevator2' ? 70 : 110; items.push({ kind, x, w }); x += w + 8; continue; }
      const r = rnd();
      if (r < 0.34) { const w = 26 + rnd() * 34; items.push({ kind: 'tree', x, w, h: 34 + rnd() * 40, tone: Math.floor(rnd() * 4) }); x += w * 0.7; }
      else if (r < 0.62) { const w = 40 + rnd() * 30; items.push({ kind: 'house', x, w, h: 22 + rnd() * 14, lit: rnd(), win: Math.floor(rnd() * 1000) }); x += w + 4 + rnd() * 10; }
      else { const w = 34 + rnd() * 60; const downtown = x > 330 && x < 760; items.push({ kind: 'bldg', x, w, h: (downtown ? 38 : 26) + rnd() * (downtown ? 40 : 20), lit: rnd(), win: Math.floor(rnd() * 1000) }); x += w + rnd() * 4; }
    }
    // draw trees after buildings so they sit in front
    return [...items.filter((i) => i.kind !== 'tree'), ...items.filter((i) => i.kind === 'tree')];
  }

  drawSkyline(g, ground, day, night, overcast) {
    const shade = 18 + day * 40; const body = `rgb(${shade},${shade + 6},${shade + 16})`;
    const light = `rgb(${shade + 22},${shade + 26},${shade + 32})`;
    const autumn = isThanksgivingSeason();
    const treeCols = autumn ? ['#9c3d12', '#b8661a', '#7d5a1a', '#4f5a22'] : ['#2f5a2a', '#3c6b2f', '#28492a', '#4a6a2a'];
    const winLit = (it) => night > 0.3 || overcast > 0.6;
    for (const it of this.skyline) {
      const { x, w } = it;
      if (it.kind === 'bldg') {
        const brick = (it.win % 3 === 0) && day > 0.2; const bk = Math.round(shade * 1.3);
        g.fillStyle = brick ? `rgb(${bk + 40},${bk + 10},${bk})` : body; g.fillRect(x, ground - it.h, w, it.h);
        g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + w * 0.78, ground - it.h, w * 0.22, it.h); // shaded side
        g.fillStyle = light; g.fillRect(x - 1, ground - it.h - 3, w + 2, 3); // cornice
        if (day > 0.3 && !winLit()) { g.fillStyle = `rgba(160,190,215,${0.18 + day * 0.15})`; for (let wy = ground - it.h + 7; wy < ground - 8; wy += 11) for (let wxp = x + 5; wxp < x + w * 0.75; wxp += 10) g.fillRect(wxp, wy, 4, 5); }
        if (it.h > 50) { g.fillStyle = body; g.fillRect(x + w * 0.3, ground - it.h - 8, 8, 5); } // rooftop unit
      } else if (it.kind === 'house') {
        g.fillStyle = body; g.fillRect(x, ground - it.h, w, it.h);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + w * 0.75, ground - it.h, w * 0.25, it.h);
        g.beginPath(); g.moveTo(x - 4, ground - it.h); g.lineTo(x + w / 2, ground - it.h - w * 0.32); g.lineTo(x + w + 4, ground - it.h); g.closePath(); g.fillStyle = light; g.fill();
      } else if (it.kind === 'tree') {
        g.fillStyle = `rgba(30,22,14,${0.6 + day * 0.4})`; g.fillRect(x + it.w / 2 - 2, ground - it.h * 0.45, 4, it.h * 0.45);
        g.fillStyle = treeCols[it.tone]; g.globalAlpha = 0.45 + day * 0.55;
        g.beginPath(); g.ellipse(x + it.w / 2, ground - it.h * 0.62, it.w / 2, it.h * 0.42, 0, 0, 6.283); g.fill(); g.globalAlpha = 1;
      } else if (it.kind === 'tower') {
        const cx = x + w / 2; const top = ground - 190;
        g.strokeStyle = body; g.lineWidth = 4; g.beginPath();
        for (const dx of [-22, -8, 8, 22]) { g.moveTo(cx + dx * 0.55, ground); g.lineTo(cx + dx, top + 40); }
        g.stroke();
        g.fillStyle = light; g.beginPath(); g.ellipse(cx, top + 22, 34, 24, 0, 0, 6.283); g.fill();
        g.beginPath(); g.moveTo(cx - 30, top + 6); g.lineTo(cx, top - 14); g.lineTo(cx + 30, top + 6); g.closePath(); g.fill();
        g.fillStyle = day > 0.3 ? '#1d3a66' : '#8fb4dd'; g.font = 'bold 15px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CARMI', cx, top + 24);
        if (night > 0.3) { g.fillStyle = (Math.floor(performance.now() / 900) % 2) ? '#ff3b30' : '#661510'; g.beginPath(); g.arc(cx, top - 16, 3, 0, 6.283); g.fill(); }
      } else if (it.kind === 'elevator' || it.kind === 'elevator2') {
        const n = it.kind === 'elevator' ? 4 : 3; const sw = (w - 20) / n; const th = it.kind === 'elevator' ? 150 : 115;
        g.fillStyle = light; for (let i = 0; i < n; i++) { g.fillRect(x + i * sw, ground - th, sw - 2, th); g.beginPath(); g.ellipse(x + i * sw + sw / 2 - 1, ground - th, sw / 2 - 1, 5, 0, 0, 6.283); g.fill(); }
        g.fillStyle = body; g.fillRect(x + w - 26, ground - th - 45, 24, th + 45); // headhouse
        g.fillRect(x + w - 30, ground - th - 50, 32, 6);
        g.strokeStyle = body; g.lineWidth = 2; g.beginPath(); g.moveTo(x + w - 26, ground - th - 30); g.lineTo(x + sw / 2, ground - th - 4); g.stroke(); // leg / spout
        if (night > 0.3) { g.fillStyle = 'rgba(255,200,120,.9)'; g.fillRect(x + w - 16, ground - th - 38, 3, 3); g.fillRect(x + w - 16, ground - 30, 4, 5); }
      } else if (it.kind === 'steeple') {
        const cx = x + w / 2; g.fillStyle = body; g.fillRect(x, ground - 50, w, 50);
        g.beginPath(); g.moveTo(x - 4, ground - 50); g.lineTo(cx, ground - 76); g.lineTo(x + w + 4, ground - 50); g.closePath(); g.fill();
        g.fillRect(cx - 9, ground - 112, 18, 50);
        g.beginPath(); g.moveTo(cx - 11, ground - 112); g.lineTo(cx, ground - 160); g.lineTo(cx + 11, ground - 112); g.closePath(); g.fill();
        g.fillRect(cx - 1, ground - 172, 2, 14); g.fillRect(cx - 5, ground - 167, 10, 2);
        if (winLit()) { g.fillStyle = 'rgba(255,214,140,.75)'; g.fillRect(cx - 3, ground - 100, 6, 12); g.fillRect(x + 8, ground - 40, 6, 14); g.fillRect(x + w - 14, ground - 40, 6, 14); }
      }
      if ((it.kind === 'bldg' || it.kind === 'house') && winLit()) {
        for (let wy = ground - it.h + 7; wy < ground - 5; wy += 11) for (let wxp = x + 5; wxp < x + w - 6; wxp += 10) {
          if (((wxp * 7 + wy * 13 + it.win) % 10) / 10 < it.lit * 0.6) { g.fillStyle = `rgba(255,214,140,${0.5 + night * 0.4})`; g.fillRect(wxp, wy, 4, 5); }
        }
      }
    }
  }

  /** Static far layers (haze, tree line, skyline, street) cached per lighting state – the per-frame cost is one drawImage. */
  exteriorLayer(w, h, day, night, overcast) {
    const autumn = isThanksgivingSeason();
    const key = `${w}x${h}:${Math.round(day * 12)}:${Math.round(overcast * 6)}:${autumn}`;
    if (this.extCache?.key === key) return this.extCache.canvas;
    const c = (this.extCache?.canvas?.width === w && this.extCache.canvas.height === h) ? this.extCache.canvas : makeCanvas(w, h);
    const g = c.getContext('2d'); g.clearRect(0, 0, w, h);
    const ground = h * 0.86; const lum = 0.35 + day * 0.65;
    // distant haze band + low rolling tree line on the horizon
    const hz = g.createLinearGradient(0, ground - 120, 0, ground);
    hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, `rgba(${170 * lum | 0},${180 * lum | 0},${195 * lum | 0},${0.25 + overcast * 0.2})`);
    g.fillStyle = hz; g.fillRect(0, ground - 120, w, 120);
    g.fillStyle = autumn ? `rgb(${60 * lum + 10 | 0},${48 * lum + 8 | 0},${36 * lum + 10 | 0})` : `rgb(${34 * lum + 8 | 0},${52 * lum + 10 | 0},${40 * lum + 12 | 0})`;
    g.beginPath(); g.moveTo(0, ground);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, ground - 28 - Math.sin(x * 0.013) * 7 - Math.sin(x * 0.051 + 1.3) * 4 - Math.sin(x * 0.17) * 1.5);
    g.lineTo(w, ground); g.closePath(); g.globalAlpha = 0.75; g.fill(); g.globalAlpha = 1;
    this.drawSkyline(g, ground, day, night, overcast);
    // street: grass verge, sidewalk, asphalt with lane dashes
    g.fillStyle = autumn ? `rgb(${70 * lum + 6 | 0},${66 * lum + 6 | 0},${38 * lum + 6 | 0})` : `rgb(${40 * lum + 6 | 0},${70 * lum + 8 | 0},${40 * lum + 8 | 0})`; g.fillRect(0, ground, w, h - ground);
    g.fillStyle = `rgb(${120 * lum + 10 | 0},${120 * lum + 10 | 0},${116 * lum + 10 | 0})`; g.fillRect(0, ground + 6, w, 5);
    g.fillStyle = `rgb(${38 * lum + 8 | 0},${40 * lum + 9 | 0},${44 * lum + 10 | 0})`; g.fillRect(0, ground + 11, w, h - ground - 11);
    g.fillStyle = `rgba(240,210,90,${0.5 + day * 0.3})`; for (let x = 0; x < w; x += 46) g.fillRect(x, ground + 27, 24, 2);
    // street lights
    for (let x = 60; x < w; x += 190) {
      g.fillStyle = `rgb(${40 + day * 40 | 0},${42 + day * 40 | 0},${46 + day * 40 | 0})`; g.fillRect(x, ground - 52, 3, 58); g.fillRect(x, ground - 52, 18, 3);
      if (night > 0.3) { const gl = g.createRadialGradient(x + 16, ground - 48, 0, x + 16, ground - 48, 34); gl.addColorStop(0, 'rgba(255,214,150,.9)'); gl.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = gl; g.fillRect(x - 20, ground - 82, 72, 72); }
    }
    // parked cars
    const carCols = ['#7a1f1f', '#d8d8d8', '#1f3d7a', '#2b2b2b', '#6b6f75'];
    for (let i = 0; i < 9; i++) {
      const x = (i * 131 + 40) % w; const col = carCols[i % carCols.length];
      g.globalAlpha = 0.55 + day * 0.45; g.fillStyle = col; g.fillRect(x, ground + 12, 34, 8); g.fillRect(x + 7, ground + 6, 18, 7);
      g.fillStyle = `rgba(150,190,220,${0.4 + day * 0.4})`; g.fillRect(x + 9, ground + 7, 6, 5); g.fillRect(x + 17, ground + 7, 6, 5);
      g.fillStyle = '#111'; g.fillRect(x + 4, ground + 19, 6, 3); g.fillRect(x + 24, ground + 19, 6, 3); g.globalAlpha = 1;
    }
    this.extCache = { key, canvas: c };
    return c;
  }

  paintExterior(g, w, h, game) {
    const sim = game.sim; const m = sim ? sim.clock() : 720; const hr = m / 60;
    const wx = sim ? sim.weather.current() : 'clear'; const t = performance.now() / 1000;
    // sky colors by hour
    const day = Math.max(0, Math.min(1, Math.sin(((hr - 6) / 12) * Math.PI) * 1.4));
    const dusk = Math.max(0, 1 - Math.abs(hr - 18.5) / 1.6) + Math.max(0, 1 - Math.abs(hr - 6.5) / 1.4);
    const overcast = { clear: 0, rain: 0.65, thunderstorm: 0.85, snow: 0.55, fog: 0.75, severe: 0.92 }[wx] ?? 0;
    const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    let top = mix([8, 12, 30], [52, 118, 205], day), mid = mix([16, 22, 44], [120, 170, 225], day), bot = mix([24, 30, 54], [190, 214, 236], day);
    if (dusk > 0) { top = mix(top, [70, 60, 120], dusk * 0.6); mid = mix(mid, [200, 120, 120], dusk * 0.55); bot = mix(bot, [255, 160, 95], dusk * 0.7); }
    const grey = (v) => v.map((x) => x * (0.35 + day * 0.65));
    top = mix(top, grey([70, 76, 86]), overcast); mid = mix(mid, grey([95, 100, 110]), overcast); bot = mix(bot, grey([115, 120, 130]), overcast);
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, `rgb(${top})`); grad.addColorStop(0.5, `rgb(${mid})`); grad.addColorStop(0.86, `rgb(${bot})`); grad.addColorStop(1, `rgb(${bot})`);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // sun with halo / moon with stars
    if (overcast < 0.6) {
      if (day > 0.05) {
        const sx = w * ((hr - 6) / 12), sy = h * (0.62 - day * 0.45);
        const halo = g.createRadialGradient(sx, sy, 0, sx, sy, 140); halo.addColorStop(0, `rgba(255,236,190,${0.55 * (1 - overcast)})`); halo.addColorStop(1, 'rgba(255,236,190,0)');
        g.fillStyle = halo; g.fillRect(sx - 140, sy - 140, 280, 280);
        g.fillStyle = `rgba(255,246,220,${0.9 * (1 - overcast)})`; g.beginPath(); g.arc(sx, sy, 22, 0, 6.283); g.fill();
      } else {
        g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 90; i++) { const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i)); g.globalAlpha = tw; g.fillRect((i * 173) % w, (i * 97) % (h * 0.55), i % 7 === 0 ? 2 : 1.3, i % 7 === 0 ? 2 : 1.3); } g.globalAlpha = 1;
        const mg = g.createRadialGradient(w * 0.75, h * 0.18, 0, w * 0.75, h * 0.18, 60); mg.addColorStop(0, 'rgba(220,230,255,.35)'); mg.addColorStop(1, 'rgba(220,230,255,0)'); g.fillStyle = mg; g.fillRect(w * 0.75 - 60, h * 0.18 - 60, 120, 120);
        g.fillStyle = 'rgba(235,238,255,.92)'; g.beginPath(); g.arc(w * 0.75, h * 0.18, 15, 0, 6.283); g.fill();
      }
    }
    // layered soft clouds
    const cl = overcast > 0.5 ? [92, 97, 108] : [255, 255, 255];
    for (let i = 0; i < 11; i++) {
      const cx = ((i * 157 + t * (3 + (i % 3))) % (w + 320)) - 160; const cy = h * (0.1 + (i % 5) * 0.06);
      g.fillStyle = `rgba(${cl},${(0.1 + overcast * 0.45) * (0.6 + (i % 3) * 0.2)})`;
      for (const [dx, dy, rx, ry] of [[0, 0, 80, 16], [-50, 6, 50, 11], [55, 5, 60, 12], [10, -8, 45, 12]]) { g.beginPath(); g.ellipse(cx + dx * (1 + (i % 2) * 0.4), cy + dy, rx * (1 + (i % 3) * 0.3), ry, 0, 0, 6.283); g.fill(); }
    }
    // cached static layers
    const night = 1 - day; const ground = h * 0.86;
    g.drawImage(this.exteriorLayer(w, h, day, night, overcast), 0, 0);
    // traffic: headlights / tail lights at night, moving cars by day
    for (let i = 0; i < 8; i++) {
      const dir = i % 2 ? 1 : -1; const x = ((i * 173 + t * (38 + (i % 3) * 9) * dir) % (w + 60) + w + 60) % (w + 60) - 30; const y = ground + (dir > 0 ? 30 : 36);
      if (night > 0.4) { g.fillStyle = dir > 0 ? 'rgba(255,60,60,.85)' : 'rgba(255,255,225,.9)'; g.fillRect(x, y, 4, 2); g.fillRect(x + 12, y, 4, 2); }
      else { g.fillStyle = ['#8a1d1d', '#d0d0d0', '#20457f', '#2b2b2b'][i % 4]; g.fillRect(x, y - 4, 26, 6); g.fillRect(x + 6, y - 9, 14, 6); }
    }
    // weather overlays
    if (wx === 'fog') { const fg = g.createLinearGradient(0, h * 0.3, 0, h); fg.addColorStop(0, 'rgba(190,195,200,.35)'); fg.addColorStop(1, 'rgba(190,195,200,.75)'); g.fillStyle = fg; g.fillRect(0, 0, w, h); }
    if (['rain', 'thunderstorm', 'severe'].includes(wx)) {
      g.fillStyle = 'rgba(40,48,60,.18)'; g.fillRect(0, 0, w, h);
      g.strokeStyle = `rgba(200,215,235,${wx === 'rain' ? 0.35 : 0.5})`; g.lineWidth = 1.2; g.beginPath();
      const n = wx === 'rain' ? 140 : 240;
      for (let i = 0; i < n; i++) { const x = (i * 97 + t * 300) % w; const y = (i * 53 + t * 900) % h; g.moveTo(x, y); g.lineTo(x - 4, y + 16); }
      g.stroke();
    }
    if (wx === 'snow') { g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 200; i++) { const x = (i * 97 + Math.sin(t + i) * 20 + t * 15) % w; const y = (i * 53 + t * 40) % h; g.fillRect(x, y, 2.5, 2.5); } g.fillStyle = 'rgba(245,248,255,.6)'; g.fillRect(0, ground, w, 6); }
    if (game.world?.flash > 0) { g.fillStyle = `rgba(230,235,255,${game.world.flash * 0.8})`; g.fillRect(0, 0, w, h); }
  }

  /** Sky backdrop for the 3D outdoor scene: gradient, sun/moon, stars, clouds, horizon haze, lightning. */
  paintSky(g, w, h, game) {
    const sim = game.sim; const m = sim ? sim.clock() : 720; const hr = m / 60;
    const wx = sim ? sim.weather.current() : 'clear'; const t = performance.now() / 1000;
    const day = Math.max(0, Math.min(1, Math.sin(((hr - 6) / 12) * Math.PI) * 1.4));
    const dusk = Math.max(0, 1 - Math.abs(hr - 18.5) / 1.6) + Math.max(0, 1 - Math.abs(hr - 6.5) / 1.4);
    const overcast = { clear: 0, rain: 0.7, thunderstorm: 0.88, snow: 0.6, fog: 0.85, severe: 0.94 }[wx] ?? 0;
    const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    let top = mix([6, 9, 24], [48, 112, 200], day), mid = mix([14, 20, 40], [118, 168, 224], day), bot = mix([28, 34, 56], [200, 220, 238], day);
    if (dusk > 0) { top = mix(top, [70, 60, 120], dusk * 0.6); mid = mix(mid, [205, 125, 120], dusk * 0.55); bot = mix(bot, [255, 168, 100], dusk * 0.75); }
    const grey = (v) => v.map((x) => x * (0.3 + day * 0.7));
    top = mix(top, grey([84, 90, 100]), overcast); mid = mix(mid, grey([110, 115, 124]), overcast); bot = mix(bot, grey([140, 145, 152]), overcast);
    const horizon = h * 0.83; // the plane spans y −38…142 m, so the eye-level horizon sits ~83% down
    const grad = g.createLinearGradient(0, 0, 0, horizon); grad.addColorStop(0, `rgb(${top})`); grad.addColorStop(0.55, `rgb(${mid})`); grad.addColorStop(1, `rgb(${bot})`);
    g.fillStyle = grad; g.fillRect(0, 0, w, horizon); g.fillStyle = `rgb(${bot})`; g.fillRect(0, horizon, w, h - horizon);
    if (overcast < 0.65) {
      if (day > 0.05) {
        const sx = w * (0.15 + 0.7 * ((hr - 6) / 12)), sy = horizon - day * horizon * 0.62;
        const halo = g.createRadialGradient(sx, sy, 0, sx, sy, 150); halo.addColorStop(0, `rgba(255,236,190,${0.6 * (1 - overcast)})`); halo.addColorStop(1, 'rgba(255,236,190,0)');
        g.fillStyle = halo; g.fillRect(sx - 150, sy - 150, 300, 300);
        g.fillStyle = `rgba(255,248,226,${0.95 * (1 - overcast)})`; g.beginPath(); g.arc(sx, sy, 16, 0, 6.283); g.fill();
      } else {
        for (let i = 0; i < 140; i++) { g.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(t * 0.6 + i))) * (1 - overcast); g.fillStyle = '#fff'; const z = i % 9 === 0 ? 2 : 1.2; g.fillRect((i * 173.3) % w, (i * 97.7) % (horizon * 0.8), z, z); }
        g.globalAlpha = 1;
        const mx = w * 0.7, my = horizon * 0.25; const mg = g.createRadialGradient(mx, my, 0, mx, my, 70); mg.addColorStop(0, 'rgba(220,230,255,.35)'); mg.addColorStop(1, 'rgba(220,230,255,0)'); g.fillStyle = mg; g.fillRect(mx - 70, my - 70, 140, 140);
        g.fillStyle = 'rgba(236,240,255,.95)'; g.beginPath(); g.arc(mx, my, 11, 0, 6.283); g.fill();
      }
    }
    const cl = overcast > 0.5 ? grey([120, 124, 132]) : [255, 255, 255];
    for (let i = 0; i < 14; i++) {
      const cx = ((i * 157 + t * (2 + (i % 3))) % (w + 320)) - 160; const cy = horizon * (0.12 + (i % 6) * 0.11);
      g.fillStyle = `rgba(${cl},${(0.12 + overcast * 0.5) * (0.6 + (i % 3) * 0.2) * (0.5 + day * 0.5)})`;
      for (const [dx, dy, rx, ry] of [[0, 0, 80, 14], [-50, 5, 50, 10], [55, 4, 60, 11], [10, -7, 45, 11]]) { g.beginPath(); g.ellipse(cx + dx * (1 + (i % 2) * 0.4), cy + dy, rx * (1 + (i % 3) * 0.3), ry, 0, 0, 6.283); g.fill(); }
    }
    const hzg = g.createLinearGradient(0, horizon - 60, 0, horizon); hzg.addColorStop(0, 'rgba(255,255,255,0)'); hzg.addColorStop(1, `rgba(${bot},0.85)`); g.fillStyle = hzg; g.fillRect(0, horizon - 60, w, 60);
    if (game.world?.flash > 0) { g.fillStyle = `rgba(230,235,255,${game.world.flash * 0.85})`; g.fillRect(0, 0, w, h); }
  }

  /** Rain/snow on the window glass (transparent overlay just outside the windows). */
  paintRain(g, w, h, game) {
    const wx = game.sim ? game.sim.weather.current() : 'clear'; const t = performance.now() / 1000;
    g.clearRect(0, 0, w, h);
    if (['rain', 'thunderstorm', 'severe'].includes(wx)) {
      const heavy = wx !== 'rain';
      g.strokeStyle = `rgba(210,222,240,${heavy ? 0.42 : 0.3})`; g.lineWidth = 1; g.beginPath();
      const n = heavy ? 120 : 70;
      for (let i = 0; i < n; i++) { const x = (i * 37.7 + t * 40) % w; const y = (i * 23.3 + t * (heavy ? 260 : 190)) % (h + 20) - 20; g.moveTo(x, y); g.lineTo(x - 2, y + (heavy ? 14 : 10)); }
      g.stroke();
      g.fillStyle = 'rgba(220,230,245,.35)'; // droplets beading on the glass
      for (let i = 0; i < 40; i++) { const x = (i * 61.3) % w, y = (i * 29.1 + t * (i % 5) * 3) % h; g.beginPath(); g.arc(x, y, 0.8 + (i % 3) * 0.6, 0, 6.283); g.fill(); }
    } else if (wx === 'snow') {
      g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 70; i++) { const x = (i * 37 + Math.sin(t + i) * 8 + t * 6) % w; const y = (i * 23 + t * 22) % h; g.fillRect(x, y, 1.8, 1.8); }
    }
  }

  paintShiftBoard(g, w, h, game) {
    g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c4161c'; g.fillRect(0, 0, w, 40); g.fillStyle = '#fff'; g.font = 'bold 24px system-ui'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('SHIFT BOARD', 14, 20);
    if (thanksgivingOn(game.settings)) { g.textAlign = 'right'; g.font = 'bold 18px system-ui'; g.fillText('🦃 HAPPY THANKSGIVING 🍂', w - 12, 20); g.textAlign = 'left'; }
    g.fillStyle = '#222'; g.font = '17px system-ui'; g.textBaseline = 'top';
    const r = game.career?.rank()?.name || 'Dispatcher';
    const tg = thanksgivingOn(game.settings);
    const lines = [`On duty: ${r} (you), M. Delgado, T. Brooks, D. Okafor`, 'Supervisor: K. Whitfield  ·  Training: M. Reyes', 'Verify every address – Carmi, Norris City, Grayville & rural roads!', 'Harvest season: watch for farm equipment on IL-14 & IL-1', tg ? 'Thanksgiving potluck Thursday – Priya has the sign-up sheet' : 'Break room coffee machine is fixed (again)', tg ? 'Holiday staffing: thank you for working the holiday shift!' : 'Potluck Friday – sign up with Priya'];
    lines.forEach((l, i) => g.fillText(`• ${l}`, 16, 52 + i * 31));
  }
}
