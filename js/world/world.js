// 3D world orchestrator: owns the renderer, materials, the dispatch-center geometry,
// NPCs, live screens and the graphics-quality / adaptive-performance logic.
import { Renderer } from '../engine/renderer.js';
import { MeshBuilder } from '../engine/geometry.js';
import { makeTextures, makeCanvas, makeEnvironment, makeBlob, makeFace } from '../engine/textures.js';
import { forwardOf, rayAABB, trs, mat4 } from '../engine/math.js';
import { buildCenter, consoleList, PLAYER_CONSOLE, BUILDING_BOUNDS } from './building.js';
import { makeSignAtlas } from './exterior.js';
import { ScreenPainter } from './screens.js';
import { NPCManager } from './npcs.js';
import { Player } from './player.js';
import { bus } from '../core/events.js';
import { thanksgivingOn } from '../core/season.js';
import { isTouchDevice } from '../core/util.js';
import { toast } from '../ui/dom.js';

// ratio: fraction of CSS pixels rendered (devicePixelRatio is only used from High up, capped).
export const PRESETS = {
  low: { quality: 'low', ratio: 0.7, dprCap: 1, lights: 4, screenRes: 256, npcs: 'low', tvHz: 1, extHz: 3, texSize: 256, detail: 1, rseg: 1, extDetail: 0 },
  medium: { quality: 'medium', ratio: 0.9, dprCap: 1, lights: 6, screenRes: 384, npcs: 'full', tvHz: 3, extHz: 8, texSize: 512, detail: 1, extDetail: 1 },
  high: { quality: 'high', ratio: 1, dprCap: 1.25, lights: 8, screenRes: 512, npcs: 'full', tvHz: 10, extHz: 15, texSize: 512, detail: 2 },
  ultra: { quality: 'ultra', ratio: 1, dprCap: 2, lights: 12, screenRes: 768, npcs: 'full', tvHz: 20, extHz: 24, texSize: 512, detail: 2 },
};
const ORDER = ['ultra', 'high', 'medium', 'low'];

export class World {
  constructor(canvas, game) {
    this.canvas = canvas; this.game = game; this.failed = false; this.lost = false; this.items = []; this.flash = 0; this.nextFlash = 10;
    this.player = new Player(this); this.target = null; this.time = 0; this.frame = 0;
    this.static = []; this.screens = {}; this.ownedTex = []; this.blobs = [];
    this.perf = { ema: 1 / 60, slow: 0, fast: 0, warmup: 4, frameMs: 0 };
    this.adaptiveNote = '';
  }

  init() {
    const name = this.game.settings.graphicsPreset();
    this.presetName = PRESETS[name] ? name : 'medium';
    this.preset = this.tunePreset(PRESETS[this.presetName]);
    try { this.setupGPU(); }
    catch (e) { console.warn('3D disabled:', e.message); this.failed = true; return false; }
    this.player.attach(this.canvas, this.game.settings);
    bus.on('settings:changed', ({ path }) => {
      if (path === 'graphics.preset') { this.adaptiveNote = ''; this.setPreset(this.game.settings.graphicsPreset()); }
      else if (path === 'graphics.adaptive' && this.renderer && !this.game.settings.data.graphics.adaptive) { this.renderer.renderScale = 1; this.applyPreset(); }
      else if (path === 'ui.seasonal') this.build();
    });
    // Survive GPU resets (driver crash, tab backgrounded on mobile, etc.)
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; console.warn('WebGL context lost – waiting for restore'); });
    this.canvas.addEventListener('webglcontextrestored', () => {
      try { this.ownedTex = []; this.static = []; this.screens = {}; this.setupGPU(); this.lost = false; }
      catch (e) { console.warn('3D could not be restored:', e.message); this.failed = true; }
    });
    return true;
  }

  /** Small per-device adjustments that keep a preset smooth on phones. */
  tunePreset(p) {
    const q = { ...p };
    q.shadowCap = isTouchDevice() ? 1024 : 4096;
    if (isTouchDevice()) { q.texSize = Math.min(q.texSize, 256); q.dprCap = Math.min(q.dprCap, 1.5); q.screenRes = Math.min(q.screenRes, 512); }
    return q;
  }

  /** Create everything that lives on the GPU. Called on start and after a context restore. */
  setupGPU() {
    this.renderer = new Renderer(this.canvas);
    this.renderer.setQuality(this.preset.quality, this.qOverrides());
    this.applyPreset();
    this.makeTextureSet(this.preset.texSize);
    this.unit = {
      box: this.renderer.createMesh(new MeshBuilder().rbox(0, 0, 0, 1, 1, 1, { r: 0.22, seg: 2, uv: 0 }).build()),
      sphere: this.renderer.createMesh(new MeshBuilder().sphere(0, 0, 0, 1, 14, 10).build()),
      disc: this.renderer.createMesh(new MeshBuilder().disc(0, 0, 0, 1, 20).build()),
      torso: this.renderer.createMesh(taperedTorso()),
    };
    this.renderer.setEnvironment(makeEnvironment(256), 1.0);
    this.renderer.configureShadow(BUILDING_BOUNDS, [0.06, -1, 0.04]);
    this.build();
  }

  qOverrides() { const base = { low: 0, medium: 2048, high: 2048, ultra: 4096 }[this.preset.quality] ?? 0; return { shadows: Math.min(base, this.preset.shadowCap || 4096) }; }

  makeTextureSet(size) {
    for (const t of this.ownedTex) this.renderer.deleteTexture(t);
    this.ownedTex = [];
    const T = makeTextures(size);
    const tex = (c, o) => { const t = this.renderer.createTexture(c, o); this.ownedTex.push(t); return t; };
    this.tex = Object.fromEntries(Object.entries(T).map(([k, c]) => [k, tex(c)]));
    this.tex.blob = tex(makeBlob(64), { repeat: false }); this.tex.face = tex(makeFace(), { repeat: false });
    this.tex.extSigns = tex(makeSignAtlas(), { repeat: false });
    this.tex.vend = tex(this.vendCanvas()); this.tex.rack = tex(this.rackCanvas()); this.tex.books = tex(this.booksCanvas());
    this.texSize = size;
    this.mats = this.makeMaterials();
  }

  applyPreset() {
    const dpr = window.devicePixelRatio || 1;
    this.renderer.maxLights = this.preset.lights;
    const ratio = this.preset.dprCap > 1 ? Math.max(this.preset.ratio, Math.min(dpr, this.preset.dprCap)) : this.preset.ratio;
    this.renderer.resize(ratio);
  }

  /** Switch graphics preset at runtime. adaptive=true means the game lowered it itself (the saved setting is untouched). */
  setPreset(p, { adaptive = false } = {}) {
    if (this.failed) return;
    this.presetName = PRESETS[p] ? p : 'medium';
    this.preset = this.tunePreset(PRESETS[this.presetName]);
    if (!adaptive) { this.renderer.renderScale = 1; this.perf.warmup = 3; }
    this.renderer.setQuality(this.preset.quality, this.qOverrides());
    this.applyPreset();
    if (this.texSize !== this.preset.texSize) this.makeTextureSet(this.preset.texSize);
    this.build();
  }

  makeMaterials() {
    const t = this.tex;
    const m = (o) => ({ color: [1, 1, 1], specular: 0.12, shininess: 20, ...o });
    const glow = (rgb, o = {}) => m({ color: [0, 0, 0], emissive: rgb, unlit: true, noCast: true, ...o });
    return {
      carpet: m({ map: t.carpet, specular: 0.015, shininess: 8 }), carpetDark: m({ map: t.carpet, color: [0.82, 0.8, 0.78], specular: 0.015, shininess: 8 }),
      ceiling: m({ map: t.ceiling, specular: 0, noCast: true }), wall: m({ map: t.wall, specular: 0.05, shininess: 14 }), accent: m({ map: t.accent, specular: 0.03 }),
      wood: m({ map: t.wood, specular: 0.3, shininess: 40, reflect: 0.05 }), woodDark: m({ map: t.wood, color: [0.58, 0.5, 0.45], specular: 0.28, shininess: 36, reflect: 0.04 }), laminate: m({ map: t.laminate, specular: 0.28, shininess: 46, reflect: 0.05 }),
      fabric: m({ map: t.fabric, specular: 0.02 }), mesh: m({ map: t.mesh, specular: 0.08, shininess: 18 }),
      fabricBlue: m({ map: t.fabric, color: [0.55, 0.75, 1.3], specular: 0.02 }), fabricWarm: m({ map: t.fabric, color: [1.6, 1.15, 0.8], specular: 0.02 }),
      metal: m({ map: t.metal, specular: 0.6, shininess: 50, reflect: 0.2 }), chrome: m({ color: [0.75, 0.77, 0.8], specular: 1.0, shininess: 110, reflect: 0.55 }),
      tile: m({ map: t.tile, specular: 0.4, shininess: 60, reflect: 0.1 }), concrete: m({ map: t.concrete, specular: 0.05 }),
      counter: m({ map: t.laminate, color: [0.95, 0.94, 0.92], specular: 0.3, shininess: 50, reflect: 0.06 }), counterTop: m({ map: t.tile, color: [0.45, 0.43, 0.42], specular: 0.5, shininess: 70, reflect: 0.12 }),
      cabinet: m({ map: t.cabinet, specular: 0.2, shininess: 30, reflect: 0.03 }),
      // shared solid-colour batches (colour comes from the vertices)
      satin: m({ specular: 0.25, shininess: 32, reflect: 0.03 }), matte: m({ specular: 0.04, shininess: 8 }),
      gloss: m({ specular: 0.75, shininess: 90, reflect: 0.16 }), ceilParts: m({ specular: 0.2, shininess: 20, noCast: true }), foliage: m({ specular: 0.12, shininess: 16, doubleSided: true }),
      // legacy solid colours (low-detail fallback, decorations)
      dark: m({ color: [0.075, 0.08, 0.09], specular: 0.25, shininess: 30 }), blackgloss: m({ color: [0.02, 0.02, 0.025], specular: 0.7, shininess: 80, reflect: 0.16 }),
      red: m({ color: [0.7, 0.07, 0.07], specular: 0.4 }), fridge: m({ color: [0.9, 0.9, 0.9], specular: 0.5, shininess: 50, reflect: 0.1 }),
      pot: m({ color: [0.85, 0.85, 0.82], specular: 0.3 }), plant: m({ color: [0.16, 0.42, 0.16], specular: 0.1 }),
      glass: m({ color: [0.55, 0.7, 0.8], opacity: 0.14, specular: 1.0, shininess: 120, transparent: true, doubleSided: true, reflect: 0.25 }),
      glassFrost: m({ color: [0.7, 0.8, 0.88], opacity: 0.16, specular: 0.6, shininess: 60, transparent: true, doubleSided: true, reflect: 0.04 }),
      waterjug: m({ color: [0.5, 0.75, 1], opacity: 0.5, transparent: true, specular: 0.9, shininess: 90, reflect: 0.2 }),
      lightpanel: glow([1.6, 1.55, 1.45]), troffer: m({ color: [0, 0, 0], emissiveMap: t.troffer, emissive: [1.55, 1.52, 1.45], unlit: true, noCast: true }),
      coveCool: glow([0.75, 0.95, 1.35]), led: glow([0.3, 1.6, 0.6]), beaconGreen: glow([0.25, 1.4, 0.45]), beaconAmber: glow([1.5, 0.75, 0.1]),
      exit: m({ color: [0, 0, 0], emissiveMap: t.exit, emissive: [1.6, 1.6, 1.6], unlit: true, noCast: true }),
      vent: m({ map: t.vent, specular: 0.15, noCast: true }), blinds: m({ map: t.blinds, specular: 0.2, noCast: true, doubleSided: true }),
      paper: m({ map: t.paper, specular: 0.02 }), phone: m({ map: t.phone, emissiveMap: t.phone, emissive: [0.18, 0.18, 0.18], specular: 0.3 }),
      keyboard: m({ map: t.keyboard, specular: 0.3, shininess: 40 }), radiopanel: m({ map: t.radioPanel, emissiveMap: t.radioPanel, emissive: [0.55, 0.55, 0.55], reflect: 0.08, shininess: 90 }),
      vendfront: m({ color: [0.2, 0.2, 0.2], emissiveMap: t.vend, emissive: [0.9, 0.9, 0.9] }),
      rack: m({ color: [0.1, 0.1, 0.1], emissiveMap: t.rack, emissive: [1, 1, 1] }),
      books: m({ map: t.books }),
      flagUS: m({ map: t.flagUS, specular: 0.05, doubleSided: true }), flagIL: m({ map: t.flagIL, specular: 0.05, doubleSided: true }),
      seal: m({ map: t.seal, specular: 0.45, shininess: 50, reflect: 0.05 }), lockers: m({ map: t.lockers, specular: 0.45, shininess: 40, reflect: 0.08 }), cork: m({ map: t.cork, specular: 0.03 }),
      gold: m({ color: [0.85, 0.66, 0.22], specular: 0.9, shininess: 70, reflect: 0.3 }),
      sheriffDoor: m({ map: t.sheriffDoor, specular: 0.6, shininess: 80, reflect: 0.12 }), rollup: m({ map: t.rollup, specular: 0.3, shininess: 30 }),
      whiteboard: m({ map: t.whiteboard, specular: 0.6, shininess: 90, reflect: 0.1 }), briefing: m({ color: [0.02, 0.02, 0.02], emissiveMap: t.briefing, emissive: [1, 1, 1], reflect: 0.06, shininess: 90 }),
      mirror: m({ color: [0.25, 0.27, 0.3], specular: 1.0, shininess: 140, reflect: 0.85 }), glassDark: m({ color: [0.04, 0.05, 0.06], specular: 1.0, shininess: 120, reflect: 0.35 }),
      lightRed: glow([2.2, 0.15, 0.12]), lightBlue: glow([0.15, 0.4, 2.4]), headlight: glow([1.6, 1.6, 1.5]), taillight: glow([1.0, 0.05, 0.04]),
      pumpkin: m({ color: [0.95, 0.42, 0.07], specular: 0.35, shininess: 30 }), stem: m({ color: [0.3, 0.26, 0.1], specular: 0.05 }),
      hay: m({ color: [0.78, 0.6, 0.28], specular: 0.03 }), gourd: m({ color: [0.95, 0.8, 0.25], specular: 0.3 }),
      leafRed: m({ color: [0.72, 0.12, 0.05], specular: 0.1, doubleSided: true }), leafOrange: m({ color: [0.92, 0.42, 0.06], specular: 0.1, doubleSided: true }), leafGold: m({ color: [0.88, 0.64, 0.1], specular: 0.1, doubleSided: true }),
      turkey: m({ color: [0.62, 0.32, 0.11], specular: 0.6, shininess: 60 }), pie: m({ color: [0.86, 0.62, 0.32], specular: 0.15 }), pieFill: m({ color: [0.72, 0.33, 0.07], specular: 0.3 }),
      tablecloth: m({ color: [0.5, 0.2, 0.07], specular: 0.05 }), plate: m({ color: [0.95, 0.94, 0.9], specular: 0.5, shininess: 60, reflect: 0.08 }),
      blob: { color: [0, 0, 0], map: t.blob, unlit: true, opacity: 0.42, transparent: true, noCast: true },
      // outdoors: unlit (lighting baked in the vertices), tinted per frame for time of day + weather, with outdoor haze
      ext: { color: [1, 1, 1], unlit: true, noCast: true, receive: false, fogMode: 2 },
      extGlow: { color: [0.2, 0.25, 0.3], unlit: true, noCast: true, receive: false, fogMode: 2 },
      extSigns: { color: [1, 1, 1], map: t.extSigns, unlit: true, noCast: true, receive: false, fogMode: 2 },
      extFlagUS: { color: [1, 1, 1], map: t.flagUS, unlit: true, noCast: true, receive: false, fogMode: 2, doubleSided: true },
      extFlagIL: { color: [1, 1, 1], map: t.flagIL, unlit: true, noCast: true, receive: false, fogMode: 2, doubleSided: true },
    };
  }

  vendCanvas() { const c = makeCanvas(128, 256); const g = c.getContext('2d'); g.fillStyle = '#1a1a22'; g.fillRect(0, 0, 128, 256); const cols = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8ecae6', '#ffb703']; for (let r = 0; r < 6; r++) { g.fillStyle = '#2a2a33'; g.fillRect(4, 38 + r * 38, 120, 3); for (let k = 0; k < 4; k++) { g.fillStyle = cols[(r + k) % 6]; g.fillRect(8 + k * 29, 10 + r * 38, 22, 28); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(10 + k * 29, 12 + r * 38, 5, 24); } } return c; }
  rackCanvas() { const c = makeCanvas(128, 256); const g = c.getContext('2d'); g.fillStyle = '#0c0d10'; g.fillRect(0, 0, 128, 256); for (let r = 0; r < 14; r++) { g.fillStyle = '#1d2027'; g.fillRect(6, 6 + r * 18, 116, 14); g.fillStyle = '#2a2e37'; g.fillRect(6, 6 + r * 18, 116, 2); for (let k = 0; k < 6; k++) { g.fillStyle = (r * 7 + k * 3) % 5 === 0 ? '#ff9f43' : (r + k) % 3 ? '#2fd08a' : '#3da5ff'; g.fillRect(10 + k * 6, 10 + r * 18, 3, 3); } g.fillStyle = '#3a3f4a'; for (let k = 0; k < 12; k++) g.fillRect(60 + k * 5, 10 + r * 18, 3, 6); } return c; }
  booksCanvas() { const c = makeCanvas(256, 64); const g = c.getContext('2d'); let x = 0; let s = 3; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; const cols = ['#7a1f1f', '#1f3d7a', '#2f6b3a', '#6b4d2f', '#444', '#8a6d1a']; while (x < 256) { const w = 6 + r() * 10; g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, r() * 10, w - 1, 64); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 1, 20, w - 3, 2); x += w; } return c; }

  disposeScene() {
    const r = this.renderer;
    for (const s of this.static) r.deleteMesh(s.mesh);
    for (const s of Object.values(this.screens)) r.deleteTexture(s.texture);
    this.static = []; this.screens = {};
  }

  /** (Re)build static geometry; called on start, preset changes and when unlocks change. */
  build() {
    if (this.failed || !this.renderer) return;
    const g = this.game; const mode = g.sim?.state.mode || 'free';
    const opts = { thirdMonitor: g.career.has('third_monitor', mode), espresso: g.career.has('espresso', mode), ergoChair: g.career.has('ergo_chair', mode), thanksgiving: thanksgivingOn(g.settings), detail: this.preset.detail, rseg: this.preset.rseg, extDetail: this.preset.extDetail ?? this.preset.detail };
    this.disposeScene(); // free the previous GPU buffers/textures – rebuilding used to leak them
    const center = buildCenter(opts);
    this.center = center; this.colliders = center.colliders; this.interactablesStatic = center.interactables; this.lightDefs = center.lights;
    this.painter = new ScreenPainter(this.preset.screenRes);
    for (const s of center.screens) {
      const canvas = this.painter.canvasFor(s);
      this.painter.paint(s, canvas, g);
      const texture = this.renderer.createTexture(canvas, { repeat: false, mipmap: s.kind === 'sign' || s.kind === 'board' });
      const mat = s.unlit ? { color: [1, 1, 1], map: texture, unlit: true, noCast: true, fogMode: s.sky ? 1 : 0, transparent: !!s.transparent, receive: false } : { color: [0.01, 0.01, 0.012], emissiveMap: texture, emissive: [1, 1, 1], specular: 0.12, shininess: 90, reflect: 0.06 };
      this.screens[s.key] = { def: s, canvas, texture, mat, last: -99 };
    }
    for (const [key, b] of Object.entries(center.batches)) {
      const mesh = this.renderer.createMesh(b.build());
      const [base, zone] = key.split('@');
      const mat = this.mats[base] || this.screens[base]?.mat || this.mats.satin;
      this.static.push({ mesh, mat, key, zone: zone || null });
    }
    // contact shadows under chairs on Low (Medium+ get real shadow maps)
    if (this.preset.quality === 'low') {
      const bl = new MeshBuilder();
      for (const c of consoleList()) { bl.disc(c.x, 0.006, c.z + 0.78, 0.42, 16); bl.disc(c.x, 0.006, c.z - 0.05, 1.05, 20); }
      this.static.push({ mesh: this.renderer.createMesh(bl.build()), mat: this.mats.blob, key: 'blobs', order: -10 });
    }
    const extra = g.career.has('extra_staff', mode);
    const prevTalk = this.npcs?.talkingTo;
    this.npcs = new NPCManager(this, { count: this.preset.npcs, extraStaff: extra });
    this.npcs.talkingTo = prevTalk;
    this.points = center.lights.map((l) => ({ pos: l.pos, color: [1, 1, 1], range: l.room === 'floor' ? 7.5 : 6.5, room: l.room }));
    this.renderer.shadowDirty = true;
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
    // overcast eases toward the new weather over ~half a minute instead of snapping
    const targetOC = { clear: 0, rain: 0.6, thunderstorm: 0.8, snow: 0.5, fog: 0.7, severe: 0.9 }[wx] ?? 0;
    const nowMs = performance.now(); const dtE = Math.min(0.5, ((nowMs - (this._envT || nowMs)) / 1000)); this._envT = nowMs;
    this._oc = this._oc == null ? targetOC : this._oc + (targetOC - this._oc) * Math.min(1, dtE * 0.12);
    const overcast = this._oc;
    const day = Math.max(0, Math.min(1, Math.sin(((hr - 6) / 12) * Math.PI) * 1.3));
    const sunAmt = day * (1 - overcast * 0.85);
    const warm = hr < 9 || hr > 16.5 ? [1.0, 0.72, 0.45] : [1.0, 0.95, 0.85];
    const sunDir = hr < 12.5 ? [-0.9, -0.42, 0.2] : [-0.35, -0.8, 0.3];
    const l = Math.hypot(...sunDir);
    const night = 1 - day;
    const lightI = 1.25 - night * 0.18;
    const tint = { floor: [1.0, 0.97, 0.92], corridor: [1.0, 0.95, 0.88], break: [1.0, 0.9, 0.78], super: [1.0, 0.94, 0.86], radio: [0.92, 0.96, 1.0], director: [1.0, 0.92, 0.82] };
    for (const p of this.points) {
      const base = p.room === 'floor' ? 1 : 0.9; const c = tint[p.room] || tint.floor;
      p.color = [lightI * base * c[0], lightI * base * c[1], lightI * base * c[2]];
    }
    this.mats.lightpanel.emissive = [1.5 - night * 0.2, 1.45 - night * 0.2, 1.35 - night * 0.2];
    // outdoor scene: daylight tint (warm at dawn/dusk, blue-dark at night, grey when overcast) + street/window lights
    const dusk = Math.max(0, 1 - Math.abs(hr - 18.4) / 1.5) + Math.max(0, 1 - Math.abs(hr - 6.6) / 1.3);
    const bright = 0.07 + 0.74 * day * (1 - overcast * 0.45);
    let tintO = [bright, bright * (0.99 + day * 0.01), bright * (1.02 + night * 0.25)];
    if (dusk > 0) tintO = [tintO[0] * (1 + dusk * 0.25), tintO[1] * (1 + dusk * 0.02), tintO[2] * (1 - dusk * 0.18)];
    const grey = overcast * 0.5; const avg = (tintO[0] + tintO[1] + tintO[2]) / 3; tintO = tintO.map((c) => c + (avg - c) * grey);
    const fl = this.flash * 0.9; this.mats.ext.color = tintO.map((c) => c + fl); this.mats.extSigns.color = tintO.map((c) => Math.max(c, night * 0.35) + fl);
    this.mats.extFlagUS.color = this.mats.ext.color; this.mats.extFlagIL.color = this.mats.ext.color;
    const lights = Math.min(1, night * 1.4 + overcast * 0.3);
    this.mats.extGlow.color = [0.2 + (1.15 - 0.2) * lights, 0.26 + (1.15 - 0.26) * lights, 0.42 + (1.15 - 0.42) * lights].map((c, i) => c * (lights > 0.3 ? 1 : 0.8 + day * 0.2));
    const hz = [0.66 + day * 0.14, 0.72 + day * 0.14, 0.84 + day * 0.12].map((c) => c * bright);
    const fogW = wx === 'fog' ? [6, 75] : wx === 'snow' ? [14, 150] : ['rain', 'thunderstorm', 'severe'].includes(wx) ? [22, 240] : [70, 520];
    this.outFog = { color: hz.map((c, i) => (wx === 'fog' ? c * 1.1 + 0.05 * bright : c)), near: fogW[0], far: fogW[1] };
    this.mats.troffer.emissive = [1.5 - night * 0.15, 1.47 - night * 0.15, 1.4 - night * 0.15];
    return {
      sky: [0.24 + day * 0.08, 0.25 + day * 0.09, 0.29 + day * 0.1], ground: [0.13, 0.12, 0.11], dirDir: sunDir.map((v) => v / l),
      dirColor: warm.map((c) => c * sunAmt * 0.5 + this.flash * 0.8), fogColor: [0.02, 0.025, 0.035], fogNear: 60, fogFar: 140,
      exposure: 1.03 + night * 0.05, flash: this.flash * 0.6,
      outFogColor: this.outFog.color, outFogNear: this.outFog.near, outFogFar: this.outFog.far,
    };
  }

  updateScreens(dt) {
    const g = this.game; const now = this.time; const refresh = g.settings.data.graphics.monitorRefresh || 1;
    const hz = { monitor: refresh, coworker: 1.5, videowall: 0.5, tv: this.preset.tvHz, board: 0.33, clock: 1, exterior: this.preset.extHz, rainfx: this.preset.extHz * 1.5, shiftboard: 0.05, sign: 0 };
    let budget = this.perf.ema > 1 / 30 ? 1 : 3; // limit texture uploads per frame (fewer when the device is struggling)
    for (const s of Object.values(this.screens)) {
      const rate = hz[s.def.kind] ?? 0; if (!rate) continue;
      if (s.def.kind === 'exterior' && this.flash <= 0 && now - s.last < 2) continue; // sky changes slowly
      if (s.def.kind === 'rainfx') { const wx = g.sim?.weather.current(); const wet = ['rain', 'thunderstorm', 'severe', 'snow'].includes(wx); if (!wet && s.dry) continue; s.dry = !wet; }
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

  // ---------------- adaptive performance ----------------
  /** Watches frame time and quietly trades resolution, then effects, then the preset for smoothness. */
  adapt(dt) {
    const p = this.perf; const r = this.renderer;
    p.ema = p.ema * 0.9 + dt * 0.1; p.frameMs = p.ema * 1000;
    if (!this.game.settings.data.graphics.adaptive) return;
    if (p.warmup > 0) { p.warmup -= dt; return; }
    if (p.ema > 1 / 34) { p.slow += dt; p.fast = 0; }
    else if (p.ema < 1 / 55) { p.fast += dt; p.slow = Math.max(0, p.slow - dt); }
    else { p.slow = Math.max(0, p.slow - dt * 0.5); p.fast = 0; }
    if (p.slow > 2.2) { p.slow = 0; p.warmup = 1.5; this.degrade(); }
    else if (p.fast > 10 && r.renderScale < 1) { p.fast = 0; p.warmup = 1; r.renderScale = Math.min(1, Math.round((r.renderScale + 0.1) * 100) / 100); this.updateAdaptiveNote(); }
  }

  degrade() {
    const r = this.renderer;
    if (r.renderScale > 0.62) { r.renderScale = Math.max(0.55, Math.round((r.renderScale - 0.15) * 100) / 100); this.updateAdaptiveNote(); return; }
    if (r.q.bloom || r.q.dynamicShadows || r.q.msaa) { r.setQuality(this.preset.quality, { ...this.qOverrides(), bloom: false, dynamicShadows: false, msaa: 0, fxaa: true }); this.updateAdaptiveNote(); return; }
    const i = ORDER.indexOf(this.presetName);
    if (i >= 0 && i < ORDER.length - 1) {
      const from = this.presetName; const to = ORDER[i + 1];
      this.setPreset(to, { adaptive: true }); r.renderScale = 0.85;
      this.adaptiveNote = `Lowered from ${cap(from)} to ${cap(to)} to keep the game smooth`;
      if (!this.notifiedAdaptive) { this.notifiedAdaptive = true; toast(`Graphics lowered to ${cap(to)} to keep the game smooth. You can change this in Settings → Graphics.`, { level: 'info', title: 'Performance' }); }
    }
  }

  updateAdaptiveNote() {
    const r = this.renderer; const parts = [];
    if (r.renderScale < 1) parts.push(`${Math.round(r.renderScale * 100)}% resolution`);
    if (!r.q.bloom && PRESETS[this.presetName] && ['high', 'ultra'].includes(this.presetName)) parts.push('effects reduced');
    this.adaptiveNote = parts.length ? `Running at ${parts.join(', ')}` : '';
  }

  status() {
    const r = this.renderer; if (!r) return { preset: 'off' };
    return { preset: this.presetName, quality: r.qualityName, scale: r.renderScale, width: r.stats.width, height: r.stats.height, draws: r.stats.draws, tris: Math.round(r.stats.tris), fps: Math.round(1 / Math.max(0.001, this.perf.ema)), frameMs: Math.round(this.perf.frameMs * 10) / 10, shadows: !!r.shadow, post: !!r.q.post, msaa: r.q.msaa, bloom: !!r.q.bloom, note: this.adaptiveNote };
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
    if (this.lost) return;
    // render (throttle while the CAD covers the screen)
    if (this.game.cad?.open && this.frame % 3 !== 0) return;
    if (document.hidden) return;
    if (!this.game.cad?.open) this.adapt(dt);
    this.updateScreens(dt);
    const items = []; const all = [];
    // Zone culling: the Sheriff's wing is only visible from the corridor or from inside it
    const p = this.player.pos; const wingVisible = p[2] > 7.3 || p[0] < -11.4;
    const outVisible = !(p[0] < -12.2 && p[2] < 8); // deep inside the Sheriff's wing no window looks outside
    for (const s of this.static) { if (s.zone !== 'out') all.push(s); if ((s.zone !== 'wing' || wingVisible) && (s.zone !== 'out' || outVisible)) items.push(s); }
    const before = items.length;
    this.npcs.draw(items, this.unit, (color, spec = 0.12) => ({ color, specular: spec, shininess: 20 }));
    for (let i = before; i < items.length; i++) all.push(items[i]);
    // soft contact shadow under every person
    this.npcs.npcs.forEach((n, i) => {
      const b = (this.blobs[i] ||= { model: mat4(), mesh: this.unit.disc, mat: this.mats.blob, order: -5 });
      b.mesh = this.unit.disc; b.mat = this.mats.blob;
      trs(b.model, n.x, 0.009, n.z, 0, 0, n.sitting ? 0.42 : 0.32, 1, n.sitting ? 0.42 : 0.32); items.push(b);
    });
    const cam = { pos: this.player.pos, yaw: this.player.yaw, pitch: this.player.pitch, fov: this.game.settings.data.graphics.fov || 72, near: 0.04, far: 320 };
    this.renderer.render({ items, shadowItems: all, env: this.env(), points: this.points }, cam);
  }
}

/** Unit torso: rounded box that widens toward the shoulders and slims at the waist. */
function taperedTorso() {
  const b = new MeshBuilder().rbox(0, 0, 0, 1, 1, 1, { r: 0.24, seg: 3, uv: 0 });
  for (let i = 0; i < b.p.length; i += 3) { const y = b.p[i + 1] + 0.5; const sx = 0.8 + 0.22 * Math.min(1, y * 1.3), sz = 0.86 + 0.14 * y; b.p[i] *= sx; b.p[i + 2] *= sz; }
  return b.build();
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
