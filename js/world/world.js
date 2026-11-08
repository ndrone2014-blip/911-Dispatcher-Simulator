// 3D world orchestrator.
import { Renderer } from '../engine/renderer.js';
import { MeshBuilder } from '../engine/geometry.js';
import { makeTextures, makeCanvas } from '../engine/textures.js';
import { forwardOf, rayAABB } from '../engine/math.js';
import { buildCenter, consoleList, PLAYER_CONSOLE } from './building.js';
import { ScreenPainter } from './screens.js';
import { NPCManager } from './npcs.js';
import { Player } from './player.js';
import { bus } from '../core/events.js';

const PRESETS = {
  low: { ratio: 0.6, lights: 3, aa: false, screenRes: 256, npcs: 'low', tvHz: 1, extHz: 3 },
  medium: { ratio: 0.85, lights: 5, aa: false, screenRes: 384, npcs: 'full', tvHz: 3, extHz: 8 },
  high: { ratio: 1, lights: 8, aa: true, screenRes: 512, npcs: 'full', tvHz: 10, extHz: 15 },
  ultra: { ratio: 2, lights: 8, aa: true, screenRes: 768, npcs: 'full', tvHz: 20, extHz: 24 },
};

export class World {
  constructor(canvas, game) {
    this.canvas = canvas; this.game = game; this.failed = false; this.items = []; this.flash = 0; this.nextFlash = 10;
    this.player = new Player(this); this.target = null; this.time = 0; this.frame = 0;
  }

  init() {
    const preset = this.game.settings.graphicsPreset();
    this.preset = PRESETS[preset] || PRESETS.medium;
    try { this.renderer = new Renderer(this.canvas, { antialias: this.preset.aa }); }
    catch (e) { console.warn('3D disabled:', e.message); this.failed = true; return false; }
    this.applyPreset();
    const T = makeTextures(preset === 'low' ? 128 : 256);
    const tex = (c, o) => this.renderer.createTexture(c, o);
    this.tex = Object.fromEntries(Object.entries(T).map(([k, c]) => [k, tex(c)]));
    this.mats = this.makeMaterials();
    // shared unit meshes for NPC parts
    this.unit = { box: this.renderer.createMesh(new MeshBuilder().box(0, 0, 0, 1, 1, 1, { uv: 0 }).build()), sphere: this.renderer.createMesh(new MeshBuilder().sphere(0, 0, 0, 1, 12, 9).build()) };
    this.build();
    this.player.attach(this.canvas, this.game.settings);
    bus.on('settings:changed', ({ path }) => { if (path === 'graphics.preset') this.setPreset(this.game.settings.graphicsPreset()); });
    return true;
  }

  applyPreset() {
    const dpr = window.devicePixelRatio || 1;
    this.renderer.maxLights = this.preset.lights;
    // ultra renders at device resolution (max 2x); other presets at a fraction of CSS pixels
    const ratio = this.preset.ratio >= 2 ? Math.min(dpr, 2) : this.preset.ratio;
    this.renderer.resize(ratio);
  }

  setPreset(p) { this.preset = PRESETS[p] || PRESETS.medium; this.applyPreset(); this.build(); }

  makeMaterials() {
    const t = this.tex;
    const m = (o) => ({ color: [1, 1, 1], specular: 0.12, shininess: 20, ...o });
    return {
      carpet: m({ map: t.carpet, specular: 0.02 }), ceiling: m({ map: t.ceiling, specular: 0 }), wall: m({ map: t.wall, specular: 0.04 }), accent: m({ map: t.accent, specular: 0.08 }),
      wood: m({ map: t.wood, specular: 0.25, shininess: 30 }), laminate: m({ map: t.laminate, specular: 0.3, shininess: 40 }), fabric: m({ map: t.fabric, specular: 0.02 }),
      fabricBlue: m({ map: t.fabric, color: [0.55, 0.75, 1.3], specular: 0.02 }), fabricWarm: m({ map: t.fabric, color: [1.6, 1.15, 0.8], specular: 0.02 }),
      metal: m({ map: t.metal, specular: 0.6, shininess: 50 }), tile: m({ map: t.tile, specular: 0.35, shininess: 45 }),
      dark: m({ color: [0.075, 0.08, 0.09], specular: 0.25, shininess: 30 }), blackgloss: m({ color: [0.02, 0.02, 0.025], specular: 0.7, shininess: 80 }),
      glass: m({ color: [0.55, 0.7, 0.8], opacity: 0.16, specular: 1.0, shininess: 120, transparent: true, doubleSided: true }),
      lightpanel: m({ color: [0, 0, 0], emissive: [1.6, 1.55, 1.45], unlit: true }), pot: m({ color: [0.85, 0.85, 0.82], specular: 0.3 }),
      plant: m({ color: [0.16, 0.42, 0.16], specular: 0.1 }), red: m({ color: [0.7, 0.07, 0.07], specular: 0.4 }), fridge: m({ color: [0.9, 0.9, 0.9], specular: 0.5, shininess: 50 }),
      keyboard: m({ map: t.keyboard, specular: 0.3 }), radiopanel: m({ map: t.radioPanel, emissiveMap: t.radioPanel, emissive: [0.35, 0.35, 0.35] }),
      vendfront: m({ color: [0.2, 0.2, 0.2], emissiveMap: this.renderer.createTexture(this.vendCanvas()), emissive: [0.9, 0.9, 0.9] }),
      rack: m({ color: [0.1, 0.1, 0.1], emissiveMap: this.renderer.createTexture(this.rackCanvas()), emissive: [1, 1, 1] }),
      books: m({ map: this.renderer.createTexture(this.booksCanvas()) }), waterjug: m({ color: [0.5, 0.75, 1], opacity: 0.5, transparent: true, specular: 0.9, shininess: 90 }),
    };
  }

  vendCanvas() { const c = makeCanvas(128, 256); const g = c.getContext('2d'); g.fillStyle = '#1a1a22'; g.fillRect(0, 0, 128, 256); const cols = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8ecae6', '#ffb703']; for (let r = 0; r < 6; r++) for (let k = 0; k < 4; k++) { g.fillStyle = cols[(r + k) % 6]; g.fillRect(8 + k * 29, 10 + r * 38, 22, 28); } return c; }
  rackCanvas() { const c = makeCanvas(128, 256); const g = c.getContext('2d'); g.fillStyle = '#0c0d10'; g.fillRect(0, 0, 128, 256); for (let r = 0; r < 14; r++) { g.fillStyle = '#1d2027'; g.fillRect(6, 6 + r * 18, 116, 14); for (let k = 0; k < 6; k++) { g.fillStyle = (r * 7 + k * 3) % 5 === 0 ? '#ff9f43' : (r + k) % 3 ? '#2fd08a' : '#3da5ff'; g.fillRect(10 + k * 6, 10 + r * 18, 3, 3); } } return c; }
  booksCanvas() { const c = makeCanvas(256, 64); const g = c.getContext('2d'); let x = 0; const cols = ['#7a1f1f', '#1f3d7a', '#2f6b3a', '#6b4d2f', '#444', '#8a6d1a']; while (x < 256) { const w = 6 + Math.random() * 10; g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.fillRect(x, Math.random() * 10, w - 1, 64); x += w; } return c; }

  /** (Re)build static geometry; called on start and when unlocks change. */
  build() {
    if (this.failed) return;
    const g = this.game; const mode = g.sim?.state.mode || 'free';
    const opts = { thirdMonitor: g.career.has('third_monitor', mode), espresso: g.career.has('espresso', mode), ergoChair: g.career.has('ergo_chair', mode) };
    const center = buildCenter(opts);
    this.center = center; this.colliders = center.colliders; this.interactablesStatic = center.interactables; this.lightDefs = center.lights;
    this.painter = new ScreenPainter(this.preset.screenRes);
    this.screens = {};
    for (const s of center.screens) {
      const canvas = this.painter.canvasFor(s);
      this.painter.paint(s, canvas, g);
      const texture = this.renderer.createTexture(canvas, { repeat: false, mipmap: s.kind === 'sign' || s.kind === 'board' });
      const mat = s.unlit ? { color: [1, 1, 1], map: texture, unlit: true } : { color: [0.01, 0.01, 0.012], emissiveMap: texture, emissive: [1, 1, 1], specular: 0.12, shininess: 90 };
      this.screens[s.key] = { def: s, canvas, texture, mat, last: -99 };
    }
    this.static = [];
    for (const [key, b] of Object.entries(center.batches)) {
      const mesh = this.renderer.createMesh(b.build());
      const mat = this.mats[key] || this.screens[key]?.mat || this.mats.dark;
      this.static.push({ mesh, mat, key });
    }
    const extra = g.career.has('extra_staff', mode);
    const prevTalk = this.npcs?.talkingTo;
    this.npcs = new NPCManager(this, { count: this.preset.npcs, extraStaff: extra });
    this.npcs.talkingTo = prevTalk;
    this.points = center.lights.map((l) => ({ pos: l.pos, color: [1, 1, 1], range: l.room === 'floor' ? 7.5 : 6.5, room: l.room }));
  }

  seatPose() {
    const c = consoleList()[PLAYER_CONSOLE];
    return { pos: [c.x, 1.2, c.z + 0.92], yaw: 0, pitch: -0.18 };
  }
  teleportNearDesk() { const c = consoleList()[PLAYER_CONSOLE]; this.player.pos = [c.x, 1.65, c.z + 1.9]; this.player.yaw = 0; this.player.pitch = -0.1; }

  setTalking(id) { if (this.npcs) this.npcs.talkingTo = id; }
  npc(id) { return this.npcs?.npcs.find((n) => n.id === id); }

  env() {
    const sim = this.game.sim; const m = sim ? sim.clock() : 10 * 60; const hr = m / 60;
    const wx = sim ? sim.weather.current() : 'clear';
    const overcast = { clear: 0, rain: 0.6, thunderstorm: 0.8, snow: 0.5, fog: 0.7, severe: 0.9 }[wx] ?? 0;
    const day = Math.max(0, Math.min(1, Math.sin(((hr - 6) / 12) * Math.PI) * 1.3));
    const sunAmt = day * (1 - overcast * 0.85);
    const warm = hr < 9 || hr > 16.5 ? [1.0, 0.72, 0.45] : [1.0, 0.95, 0.85];
    const sunDir = hr < 12.5 ? [-0.9, -0.42, 0.2] : [-0.35, -0.8, 0.3];
    const l = Math.hypot(...sunDir);
    const night = 1 - day;
    const lightI = 1.25 - night * 0.18;
    for (const p of this.points) {
      const base = p.room === 'floor' ? 1 : 0.9;
      p.color = [lightI * base * 1.0, lightI * base * 0.96, lightI * base * 0.88];
    }
    this.mats.lightpanel.emissive = [1.5 - night * 0.2, 1.45 - night * 0.2, 1.35 - night * 0.2];
    return {
      sky: [0.24 + day * 0.08, 0.25 + day * 0.09, 0.29 + day * 0.1], ground: [0.13, 0.12, 0.11], dirDir: sunDir.map((v) => v / l),
      dirColor: warm.map((c) => c * sunAmt * 0.55 + this.flash * 0.8), fogColor: [0.02, 0.025, 0.035], fogNear: 60, fogFar: 140,
      exposure: 1.0 + night * 0.05, flash: this.flash * 0.6,
    };
  }

  updateScreens(dt) {
    const g = this.game; const now = this.time; const refresh = g.settings.data.graphics.monitorRefresh || 1;
    const hz = { monitor: refresh, coworker: 1.5, videowall: 0.5, tv: this.preset.tvHz, board: 0.33, clock: 1, exterior: this.preset.extHz, shiftboard: 0.05, sign: 0 };
    let budget = 3; // limit texture uploads per frame
    for (const s of Object.values(this.screens)) {
      const rate = hz[s.def.kind] ?? 0; if (!rate) continue;
      if (s.def.kind === 'exterior') { const wx = g.sim?.weather.current(); if (!['rain', 'thunderstorm', 'severe', 'snow'].includes(wx) && this.flash <= 0 && now - s.last < 2) continue; }
      if (now - s.last < 1 / rate) continue;
      if (budget-- <= 0) break;
      s.last = now;
      this.painter.paint(s.def, s.canvas, g);
      this.renderer.updateTexture(s.texture, s.canvas);
    }
  }

  updateInteraction() {
    this.target = null;
    if (this.player.seated || this.player.transition) return;
    const o = this.player.pos, d = forwardOf(this.player.yaw, this.player.pitch);
    let best = null, bd = 2.6;
    for (const it of [...this.interactablesStatic, ...this.npcs.interactables()]) {
      const t = rayAABB(o, d, it.min, it.max);
      if (t >= 0 && (t < bd - 0.15 || (best && Math.abs(t - bd) < 0.15 && (it.pri || 0) > (best.pri || 0)))) { bd = t; best = it; }
    }
    if (best?.kind === 'console') {
      const occupant = this.npcs.npcs.find((n) => n.consoleIndex === best.consoleIndex && n.sitting);
      if (occupant) best = { ...best, kind: 'npc', npc: occupant.id, label: `Talk to ${occupant.name} (${occupant.role})` };
      else best = { ...best, label: `Console ${best.consoleIndex + 1} (unstaffed)` };
    }
    this.target = best;
  }

  update(dt) {
    if (this.failed) return;
    this.time += dt; this.frame++;
    const sim = this.game.sim;
    // lightning
    const wx = sim?.weather.current();
    if ((wx === 'thunderstorm' || wx === 'severe') && !sim.paused) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) { this.flash = 1; this.nextFlash = 7 + Math.random() * 18; this.game.audio?.thunder(0.6 + Math.random() * 2.5); }
    }
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.player.update(dt, this.colliders);
    this.npcs.update(dt * (sim && !sim.paused ? 1 : 0.0), this.player);
    this.updateInteraction();
    this.updateScreens(dt);
    // render (throttle while the CAD covers the screen)
    if (this.game.cad?.open && this.frame % 3 !== 0) return;
    if (document.hidden) return;
    const items = [];
    for (const s of this.static) items.push(s);
    this.npcs.draw(items, this.unit, (color, spec = 0.12) => ({ color, specular: spec, shininess: 20 }));
    const cam = { pos: this.player.pos, yaw: this.player.yaw, pitch: this.player.pitch, fov: this.game.settings.data.graphics.fov || 72, near: 0.04, far: 150 };
    this.renderer.render({ items, env: this.env(), points: this.points }, cam);
  }
}
