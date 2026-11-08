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
      case 'exterior': return makeCanvas(1024, 460);
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
      case 'exterior': return this.paintExterior(g, w, h, game);
      case 'shiftboard': return this.paintShiftBoard(g, w, h, game);
      default: return null;
    }
  }

  paintMonitor(i, g, w, h, game) {
    const sim = game.sim;
    g.fillStyle = '#0b111b'; g.fillRect(0, 0, w, h);
    if (!sim) { g.fillStyle = '#3da5ff'; g.font = `bold ${w * 0.05}px system-ui`; g.textAlign = 'center'; g.fillText('WHITE COUNTY 911 CAD', w / 2, h / 2); return; }
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
    g.fillText('WHITE COUNTY 911 · CARMI, IL · OPERATIONS', w * 0.01, h * 0.05);
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
        g.fillStyle = body; g.fillRect(x, ground - it.h, w, it.h);
        g.fillStyle = light; g.fillRect(x - 1, ground - it.h - 3, w + 2, 3); // cornice
      } else if (it.kind === 'house') {
        g.fillStyle = body; g.fillRect(x, ground - it.h, w, it.h);
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

  paintExterior(g, w, h, game) {
    const sim = game.sim; const m = sim ? sim.clock() : 720; const hr = m / 60;
    const wx = sim ? sim.weather.current() : 'clear'; const t = performance.now() / 1000;
    // sky colors by hour
    const day = Math.max(0, Math.min(1, Math.sin(((hr - 6) / 12) * Math.PI) * 1.4));
    const dusk = Math.max(0, 1 - Math.abs(hr - 18.5) / 1.6) + Math.max(0, 1 - Math.abs(hr - 6.5) / 1.4);
    const overcast = { clear: 0, rain: 0.65, thunderstorm: 0.85, snow: 0.55, fog: 0.75, severe: 0.92 }[wx] ?? 0;
    const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    let top = mix([8, 12, 30], [70, 140, 220], day), bot = mix([20, 26, 48], [170, 205, 235], day);
    if (dusk > 0) { top = mix(top, [90, 70, 130], dusk * 0.6); bot = mix(bot, [250, 150, 90], dusk * 0.7); }
    top = mix(top, [70, 76, 86].map((v) => v * (0.35 + day * 0.65)), overcast); bot = mix(bot, [110, 115, 125].map((v) => v * (0.35 + day * 0.65)), overcast);
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, `rgb(${top})`); grad.addColorStop(0.75, `rgb(${bot})`); grad.addColorStop(1, `rgb(${bot})`);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // sun / moon
    if (overcast < 0.6) {
      if (day > 0.05) { const sx = w * ((hr - 6) / 12); g.fillStyle = `rgba(255,240,200,${0.7 * (1 - overcast)})`; g.beginPath(); g.arc(sx, h * (0.62 - day * 0.45), 26, 0, 6.283); g.fill(); }
      else { g.fillStyle = 'rgba(230,235,255,.85)'; g.beginPath(); g.arc(w * 0.75, h * 0.18, 16, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 60; i++) g.fillRect((i * 173) % w, (i * 97) % (h * 0.5), 1.5, 1.5); }
    }
    // clouds
    g.fillStyle = `rgba(${overcast > 0.5 ? '90,95,105' : '255,255,255'},${0.15 + overcast * 0.5})`;
    for (let i = 0; i < 9; i++) { const cx = ((i * 157 + t * 4) % (w + 300)) - 150; const cy = h * (0.12 + (i % 4) * 0.07); g.beginPath(); g.ellipse(cx, cy, 90 + (i % 3) * 30, 18 + (i % 2) * 8, 0, 0, 6.283); g.fill(); }
    // skyline
    const ground = h * 0.86; const night = 1 - day;
    this.drawSkyline(g, ground, day, night, overcast);
    g.fillStyle = `rgb(${12 + day * 25},${15 + day * 30},${20 + day * 30})`; g.fillRect(0, ground, w, h - ground);
    // street lights / car lights at night
    if (night > 0.4) for (let i = 0; i < 30; i++) { const x = ((i * 61 + t * (i % 2 ? 40 : -55)) % (w + 40) + w + 40) % (w + 40) - 20; g.fillStyle = i % 2 ? 'rgba(255,60,60,.8)' : 'rgba(255,255,220,.85)'; g.fillRect(x, ground + 10 + (i % 3) * 6, 3, 2); }
    // weather overlays
    if (wx === 'fog') { g.fillStyle = 'rgba(190,195,200,.55)'; g.fillRect(0, 0, w, h); }
    if (['rain', 'thunderstorm', 'severe'].includes(wx)) {
      g.strokeStyle = `rgba(200,215,235,${wx === 'rain' ? 0.35 : 0.5})`; g.lineWidth = 1.2; g.beginPath();
      const n = wx === 'rain' ? 140 : 240;
      for (let i = 0; i < n; i++) { const x = (i * 97 + t * 300) % w; const y = (i * 53 + t * 900) % h; g.moveTo(x, y); g.lineTo(x - 4, y + 16); }
      g.stroke();
    }
    if (wx === 'snow') { g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 200; i++) { const x = (i * 97 + Math.sin(t + i) * 20 + t * 15) % w; const y = (i * 53 + t * 40) % h; g.fillRect(x, y, 2.5, 2.5); } }
    if (game.world?.flash > 0) { g.fillStyle = `rgba(230,235,255,${game.world.flash * 0.8})`; g.fillRect(0, 0, w, h); }
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
