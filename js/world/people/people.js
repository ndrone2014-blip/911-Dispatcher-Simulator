// CharacterSystem: appearance, meshes, level of detail and animation for every person.
//
// Performance model
//  * One draw call per person (GPU skinning; all materials share one atlas texture).
//  * Three detail levels picked by distance with hysteresis: close-up meshes (~8k vertices)
//    only for the few people near you, a simplified mesh at mid range (~3k), a ~1k-vertex
//    silhouette beyond that. Off-screen people aren't animated or drawn at all.
//  * Meshes are generated in a Web Worker (with a budgeted main-thread fallback) and kept
//    in a small LRU cache with a hard cap on close-up meshes (fewer on phones).
//  * Far people animate at half rate; shadow casting only on Ultra (dynamic shadows).
import { makeAppearance } from './appearance.js';
import { buildCharacter, rigFor } from './charGen.js';
import { makeAnimState, animate, speak as speakLine } from './anim.js';
import { skinPoint } from './rig.js';
import { makeCharacterAtlas } from './atlas.js';

const isTouch = () => typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && Math.min(window.screen?.width || 9999, window.screen?.height || 9999) < 900;

export class CharacterSystem {
  constructor(world) {
    this.world = world; this.renderer = world.renderer;
    this.cache = new Map(); this.pending = new Map(); this.queue = []; this.frame = 0; this.sigs = new Map();
    this.mobile = isTouch(); this.items = new Map();
    this.configure(world.presetName || 'medium');
    this.makeAtlas();
    this.worker = null; this.workerOk = typeof Worker !== 'undefined';
    if (this.workerOk) {
      try {
        this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this.onBuilt(e.data);
        this.worker.onerror = (e) => { console.warn('Character worker unavailable, building on the main thread:', e.message || e); e.preventDefault?.(); this.disableWorker(); };
      } catch (err) { this.disableWorker(); }
    }
    this.seq = 0;
  }

  disableWorker() {
    this.workerOk = false; try { this.worker?.terminate(); } catch { /* ignore */ } this.worker = null;
    for (const [, p] of this.pending) this.queue.push(p.job); this.pending.clear();
  }

  /** Detail and budgets per graphics preset. */
  configure(preset) {
    const low = preset === 'low', mob = this.mobile;
    this.preset = preset;
    this.dscale = low || mob ? 0.72 : preset === 'medium' ? 0.86 : 1;
    this.nearDist = low ? 3.6 : mob ? 4.2 : preset === 'medium' ? 5.2 : 6.5;
    this.midDist = low ? 10 : mob ? 11 : 15;
    this.capNear = low ? 3 : mob ? 4 : preset === 'medium' ? 6 : 9;
    this.capMid = mob || low ? 22 : 40;
    this.shadows = !!this.renderer.q?.dynamicShadows;
  }

  makeAtlas() {
    const size = this.renderer.q && this.world.preset && this.world.preset.texSize <= 256 ? 512 : 1024;
    this.atlasTex = this.renderer.createTexture(makeCharacterAtlas(size), { repeat: false });
    this.mat = { color: [1, 1, 1], map: this.atlasTex, specular: 1, shininess: 20, bump: 0.0016 };
  }

  // ------------------------------------------------------------ appearance & rig
  ensure(n) {
    if (n.look) return n.look;
    let app; let variant = 0;
    for (; variant < 12; variant++) { app = makeAppearance(n, variant); if (!this.sigs.has(app.signature)) break; }
    if (n.kind === 'civilian' && n.mood === 'pain') app.clothes.injured = true;
    const rig = rigFor(app);
    this.sigs.set(app.signature, (this.sigs.get(app.signature) || 0) + 1);
    const st = makeAnimState(app, rig.sk, app.seed);
    n.look = { app, rig, st, key: `${app.seed}`, lod: -1, meshes: [null, null, null], gear: null, anchors: null, acc: 0 };
    return n.look;
  }

  release(n) {
    const L = n.look; if (!L) return;
    const c = (this.sigs.get(L.app.signature) || 1) - 1; if (c <= 0) this.sigs.delete(L.app.signature); else this.sigs.set(L.app.signature, c);
    if (n.kind === 'civilian' || n.temp) for (let q = 0; q < 3; q++) this.drop(this.keyOf(L, q));
  }

  keyOf(L, q) { return `${L.key}:${q}:${q === 2 ? this.dscale : 1}`; }

  /** The mesh for a detail level if ready; otherwise request it and return the best available one. */
  mesh(n, q) {
    const L = n.look; const want = this.keyOf(L, q); const c = this.cache.get(want);
    if (c) { c.used = this.frame; return { mesh: c.mesh, q }; }
    this.request(L, q);
    for (let k = q - 1; k >= 0; k--) { const m = this.cache.get(this.keyOf(L, k)); if (m) { m.used = this.frame; return { mesh: m.mesh, q: k }; } }
    for (let k = q + 1; k < 3; k++) { const m = this.cache.get(this.keyOf(L, k)); if (m) { m.used = this.frame; return { mesh: m.mesh, q: k }; } }
    return null;
  }

  request(L, q) {
    const key = this.keyOf(L, q); if (this.pending.has(key) || this.queue.some((j) => j.key === key)) return;
    this.queue.push({ key, L, q, dscale: q === 2 ? this.dscale : 1, pri: q === 0 ? 0 : q === 1 ? 1 : 2 });
  }

  pump() {
    if (!this.queue.length) return;
    this.queue.sort((a, b) => a.pri - b.pri);
    if (this.worker && this.workerOk) {
      while (this.queue.length && this.pending.size < 3) {
        const job = this.queue.shift(); const id = ++this.seq; this.pending.set(id, { job });
        this.worker.postMessage({ id, app: job.L.app, q: job.q, dscale: job.dscale });
      }
      return;
    }
    // main-thread fallback: far meshes are cheap; close-ups at most every third frame
    const job = this.queue[0]; if (job.q === 2 && this.frame % 3) return;
    this.queue.shift();
    const r = buildCharacter(job.L.app, job.q, job.dscale);
    this.install(job, r.geo, r.anchors, r.gear);
  }

  onBuilt(msg) {
    const p = this.pending.get(msg.id); if (!p) return; this.pending.delete(msg.id);
    if (!msg.ok) { console.warn('Character build failed:', msg.error); const r = buildCharacter(p.job.L.app, p.job.q, p.job.dscale); this.install(p.job, r.geo, r.anchors, r.gear); return; }
    this.install(p.job, msg.geo, msg.anchors, msg.gear);
  }

  install(job, geo, anchors, gear) {
    if (this.disposed || this.renderer.gl.isContextLost()) return;
    const mesh = this.renderer.createSkinnedMesh(geo);
    this.cache.set(job.key, { mesh, q: job.q, used: this.frame, bytes: mesh.bytes });
    if (job.q >= 1 || !job.L.gear) { job.L.gear = gear; job.L.anchors = anchors; job.L.anchorQ = job.q; }
    if (job.q === 2) { job.L.anchors2 = anchors; job.L.gear = gear; }
    this.evict();
  }

  evict() {
    for (const [q, cap] of [[2, this.capNear], [1, this.capMid]]) {
      const list = [...this.cache.entries()].filter(([, v]) => v.q === q);
      if (list.length <= cap) continue;
      list.sort((a, b) => a[1].used - b[1].used);
      for (const [k, v] of list.slice(0, list.length - cap)) { if (v.used >= this.frame - 1) continue; this.drop(k); }
    }
  }

  drop(key) { const c = this.cache.get(key); if (!c) return; this.renderer.deleteMesh(c.mesh); this.cache.delete(key); }

  // ------------------------------------------------------------ per frame
  beginFrame() { this.frame++; this.syncBuilds = 0; this.pump(); }

  /** Animate and emit the draw item for one visible NPC. */
  draw(n, items, dist, dt, ctx) {
    const L = this.ensure(n);
    const prev = L.lod; let q = dist < this.nearDist ? 2 : dist < this.midDist ? 1 : 0;
    if (prev === 2 && q === 1 && dist < this.nearDist + 0.8) q = 2; if (prev === 1 && q === 0 && dist < this.midDist + 1.2) q = 1;
    if (prev === 1 && q === 2 && dist > this.nearDist - 0.4) q = 1;
    L.lod = q;
    let m = this.mesh(n, q);
    if (!m && this.syncBuilds++ < 4) { // never show a placeholder: the far mesh is cheap enough to make right now
      const job = { key: this.keyOf(L, 0), L, q: 0, dscale: 1 }; const r = buildCharacter(L.app, 0, 1); this.install(job, r.geo, r.anchors, r.gear); m = this.mesh(n, q);
    }
    if (!m) return false;
    // far people animate at half rate
    L.acc += dt; if (m.q === 0 && (this.frame + (n.id.length & 1)) % 2 && L.st.lx != null) return this.emit(n, L, m.mesh, items);
    animate(L.st, n, L.acc, ctx, m.q); L.acc = 0;
    return this.emit(n, L, m.mesh, items);
  }

  emit(n, L, mesh, items) {
    let it = this.items.get(n.id); if (!it) { it = { mesh, mat: this.mat, skin: L.st.skin, model: null, castShadow: false }; this.items.set(n.id, it); }
    it.mesh = mesh; it.mat = this.mat; it.skin = L.st.skin; it.castShadow = this.shadows; items.push(it); return true;
  }

  say(n, text, rate = 1) { const L = this.ensure(n); speakLine(L.st, text, rate * (n.rate || 1)); }

  // ------------------------------------------------------------ inspection (tests, debugging)
  describe(n) { const L = this.ensure(n); if (!L.gear) { const r = buildCharacter(L.app, 1, 1); L.gear = r.gear; L.anchors = r.anchors; } return { gear: [...new Set(L.gear)], signature: L.app.signature, outfit: L.app.outfit, age: L.app.age, hair: L.app.hairStyle, lod: L.lod }; }

  /** Largest change (metres) in the gap between each piece of gear and the cloth it sits on, after animating. */
  attachmentError(n) {
    const L = this.ensure(n); if (!L.anchors2) { const r = buildCharacter(L.app, 2, 1); L.anchors2 = r.anchors; }
    animate(L.st, n, 0.137, { target: null }, 2);
    let worst = 0;
    for (const a of L.anchors2) {
      const g0 = a.p, s0 = a.surf; const rest = Math.hypot(g0[0] - s0[0], g0[1] - s0[1], g0[2] - s0[2]);
      const g1 = skinPoint(L.st.skin, g0, a.bw.b0, a.bw.b1, a.bw.w), s1 = skinPoint(L.st.skin, s0, a.sbw.b0, a.sbw.b1, a.sbw.w);
      worst = Math.max(worst, Math.abs(Math.hypot(g1[0] - s1[0], g1[1] - s1[1], g1[2] - s1[2]) - rest));
    }
    return worst;
  }

  gpuStats() { let bytes = 0, near = 0; for (const v of this.cache.values()) { bytes += v.bytes || 0; if (v.q === 2) near++; } return { meshes: this.cache.size, near, bytes, cap: this.capNear + this.capMid + 60, queued: this.queue.length, pending: this.pending.size, worker: !!this.worker }; }

  dispose() {
    this.disposed = true;
    for (const k of [...this.cache.keys()]) this.drop(k);
    try { this.worker?.terminate(); } catch { /* ignore */ }
    if (this.atlasTex) this.renderer.deleteTexture(this.atlasTex);
  }
}
