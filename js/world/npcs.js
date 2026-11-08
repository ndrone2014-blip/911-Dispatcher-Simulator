// Dispatch-center NPCs: procedural articulated bodies, animation and schedules.
import { trs, mat4 } from '../engine/math.js';
import { STAFF } from '../ai/staffDialogue.js';
import { buildNavGraph, findPath, consoleList } from './building.js';
import { rng } from '../core/util.js';

const SKIN = [[0.94, 0.78, 0.66], [0.82, 0.62, 0.46], [0.6, 0.42, 0.3], [0.42, 0.28, 0.2], [0.88, 0.7, 0.55]];
const HAIR = [[0.08, 0.06, 0.05], [0.25, 0.16, 0.09], [0.55, 0.42, 0.25], [0.7, 0.7, 0.68], [0.15, 0.1, 0.08]];
const OUTFIT = {
  dispatcher: { shirt: [0.13, 0.2, 0.36], pants: [0.12, 0.12, 0.14] }, supervisor: { shirt: [0.72, 0.8, 0.9], pants: [0.16, 0.17, 0.2] },
  trainer: { shirt: [0.4, 0.42, 0.45], pants: [0.2, 0.18, 0.15] }, director: { shirt: [0.2, 0.2, 0.23], pants: [0.18, 0.18, 0.2] },
  police: { shirt: [0.07, 0.1, 0.2], pants: [0.07, 0.1, 0.2] }, fire: { shirt: [0.9, 0.9, 0.88], pants: [0.1, 0.12, 0.2] }, ems: { shirt: [0.1, 0.18, 0.3], pants: [0.1, 0.12, 0.16] },
};
const SEAT_OF = { maria: 0, tyler: 2, denise: 3, ray: 5, priya: 6 };
const BREAK_SPOTS = ['coffee', 'fridge', 'vending', 'br_chat1', 'br_chat2', 'br_table', 'couch', 'seatT1', 'seatT2'];

export class NPCManager {
  constructor(world, { count = 'full', extraStaff = true } = {}) {
    this.world = world; this.nodes = buildNavGraph(); this.npcs = []; this.talkingTo = null;
    this.consoles = consoleList();
    const roster = STAFF.filter((s) => s.kind !== 'visitor' && (extraStaff || !s.extra));
    const limited = count === 'low' ? roster.filter((s) => ['maria', 'tyler', 'karen', 'helen'].includes(s.id)) : roster;
    for (const s of limited) this.spawn(s);
    this.visitorPool = STAFF.filter((s) => s.kind === 'visitor');
    this.allowVisitors = count !== 'low';
    this.nextVisitor = 20 + Math.random() * 40;
  }

  node(id) { return this.nodes.find((n) => n.id === id); }

  spawn(s, atNode) {
    const r = Math.abs([...s.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const outfit = OUTFIT[s.kind === 'visitor' ? s.dept : s.kind] || OUTFIT.dispatcher;
    const npc = { ...s, skin: SKIN[r % SKIN.length], hair: HAIR[(r >> 3) % HAIR.length], shirt: outfit.shirt, pants: outfit.pants,
      x: 0, z: 0, yaw: 0, state: 'idle', path: [], timer: 2 + Math.random() * 10, phase: Math.random() * 6, speed: 1.15 + Math.random() * 0.25,
      home: null, homeYaw: 0, sitting: false, sitY: 0, typing: 0, hairLong: s.sex === 'f' && r % 3 !== 0 };
    if (SEAT_OF[s.id] != null) { npc.home = `seat_${SEAT_OF[s.id]}`; npc.consoleIndex = SEAT_OF[s.id]; }
    else if (s.kind === 'supervisor') npc.home = 'sup_desk';
    else if (s.kind === 'director') npc.home = 'dir_desk';
    else if (s.kind === 'trainer') npc.home = 'front_0';
    else npc.home = 'br_chat1';
    const start = this.node(atNode || npc.home) || this.nodes[0];
    npc.x = start.x; npc.z = start.z; npc.at = start.id;
    if (!atNode) this.sitAtHome(npc);
    this.npcs.push(npc);
    return npc;
  }

  sitAtHome(npc) {
    if (npc.consoleIndex != null) { const c = this.consoles[npc.consoleIndex]; npc.x = c.x; npc.z = c.z + 0.78; npc.yaw = 0; npc.sitting = true; npc.state = 'sit'; return; }
    if (npc.home === 'sup_desk') { npc.x = 0; npc.z = 14.75; npc.yaw = Math.PI; npc.sitting = true; npc.state = 'sit'; return; }
    if (npc.home === 'dir_desk') { npc.x = 9.3; npc.z = 14.85; npc.yaw = Math.PI; npc.sitting = true; npc.state = 'sit'; return; }
    npc.state = 'idle'; npc.sitting = false;
  }

  goTo(npc, target) {
    const from = this.nearestNode(npc.x, npc.z, npc.sitting ? npc.home : null);
    const path = findPath(this.nodes, from.id, target);
    if (!path) return false;
    npc.path = path; npc.sitting = false; npc.state = 'walk'; npc.dest = target;
    return true;
  }

  nearestNode(x, z, prefer) {
    if (prefer && this.node(prefer)) return this.node(prefer);
    let best = this.nodes[0], bd = Infinity;
    for (const n of this.nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
    return best;
  }

  update(dt, player) {
    // visitors come and go
    if (this.allowVisitors) {
      this.nextVisitor -= dt;
      const present = this.npcs.filter((n) => n.kind === 'visitor');
      if (this.nextVisitor <= 0) {
        this.nextVisitor = 60 + Math.random() * 90;
        const avail = this.visitorPool.filter((v) => !present.some((p) => p.id === v.id));
        if (avail.length && present.length < 2) { const v = this.spawn(avail[Math.floor(Math.random() * avail.length)], 'dE_out'); v.leaveAt = 90 + Math.random() * 120; v.timer = 0; this.goTo(v, 'coffee'); }
      }
    }
    for (const npc of this.npcs.slice()) this.updateNPC(npc, dt, player);
  }

  updateNPC(npc, dt, player) {
    npc.phase += dt;
    const talking = this.talkingTo === npc.id;
    if (talking) {
      // face the player
      const want = Math.atan2(-(player.pos[0] - npc.x), -(player.pos[2] - npc.z));
      if (!npc.sitting) npc.yaw = lerpAngle(npc.yaw, want, Math.min(1, dt * 5));
      else npc.headYaw = clampAngle(want - npc.yaw, 1.0);
      npc.state = npc.sitting ? 'sit' : 'talk';
      return;
    }
    npc.headYaw = (npc.headYaw || 0) * 0.92;
    if (npc.kind === 'visitor' && npc.leaveAt != null) {
      npc.leaveAt -= dt;
      if (npc.leaveAt <= 0 && npc.state !== 'walk' && npc.dest !== 'dE_out') { this.goTo(npc, 'dE_out'); npc.leaving = true; }
    }
    if (npc.state === 'walk') {
      const next = npc.path[0];
      if (!next) { this.arrive(npc); return; }
      const dx = next.x - npc.x, dz = next.z - npc.z; const d = Math.hypot(dx, dz);
      const step = npc.speed * dt;
      if (d <= step) { npc.x = next.x; npc.z = next.z; npc.path.shift(); }
      else { npc.x += (dx / d) * step; npc.z += (dz / d) * step; }
      const want = Math.atan2(-dx, -dz);
      if (d > 0.01) npc.yaw = lerpAngle(npc.yaw, want, Math.min(1, dt * 8));
      return;
    }
    npc.timer -= dt;
    if (npc.timer > 0) { if (npc.sitting) npc.typing = Math.max(0, Math.min(1, npc.typing + (Math.sin(npc.phase * 0.3) > -0.3 ? dt : -dt))); return; }
    // decide next activity
    const roll = Math.random();
    if (npc.kind === 'dispatcher') {
      if (npc.sitting) { npc.timer = 25 + Math.random() * 60; if (roll < 0.25) { this.goTo(npc, rng.pick(BREAK_SPOTS)); } }
      else { this.goTo(npc, npc.home); }
    } else if (npc.kind === 'supervisor') {
      if (npc.sitting) { npc.timer = 20 + Math.random() * 40; if (roll < 0.6) this.goTo(npc, rng.pick(['front_-5.6', 'mid_0', 'back_5.6', 'front_5.6', 'mid_-11', 'back_-5.6'])); }
      else if (roll < 0.5) { this.goTo(npc, rng.pick(['front_0', 'mid_5.6', 'back_0', 'mid_-5.6'])); npc.timer = 6; }
      else this.goTo(npc, npc.home);
    } else if (npc.kind === 'director') {
      if (npc.sitting) { npc.timer = 40 + Math.random() * 60; if (roll < 0.25) this.goTo(npc, rng.pick(['front_0', 'coffee', 'mid_0'])); }
      else this.goTo(npc, npc.home);
    } else if (npc.kind === 'trainer') {
      npc.timer = 8 + Math.random() * 14;
      this.goTo(npc, rng.pick(['front_-11', 'front_0', 'mid_5.6', 'back_-5.6', 'br_chat2', 'coffee', 'front_5.6', 'back_11']));
    } else if (npc.kind === 'visitor') {
      npc.timer = 10 + Math.random() * 20;
      if (!npc.leaving) this.goTo(npc, rng.pick(['br_chat1', 'br_chat2', 'coffee', 'seatT1', 'br_table']));
    }
  }

  arrive(npc) {
    npc.state = 'idle'; npc.timer = 6 + Math.random() * 14;
    if (npc.leaving && npc.dest === 'dE_out') { this.npcs.splice(this.npcs.indexOf(npc), 1); return; }
    if (npc.dest === npc.home) { this.sitAtHome(npc); npc.timer = 30 + Math.random() * 60; }
    if (npc.dest === 'coffee') npc.yaw = Math.PI / 2;
    if (npc.dest === 'couch' || npc.dest === 'seatT1' || npc.dest === 'seatT2') { npc.sitting = true; npc.state = 'sit'; npc.yaw = npc.dest === 'couch' ? Math.PI : 0; if (npc.dest === 'couch') npc.z = 17.35; else npc.z = 14.55; }
  }

  /** Interaction volumes for the player's look ray. */
  interactables() {
    return this.npcs.map((n) => ({ id: `npc_${n.id}`, kind: 'npc', npc: n.id, label: `Talk to ${n.name} (${n.role})`, min: [n.x - 0.35, 0, n.z - 0.35], max: [n.x + 0.35, n.sitting ? 1.45 : 1.85, n.z + 0.35], pri: 3 }));
  }

  /** Emit draw items (parts) for all NPCs. */
  draw(items, meshes, makeMat) {
    for (const n of this.npcs) this.drawNPC(n, items, meshes, makeMat);
  }

  drawNPC(n, items, meshes, makeMat) {
    n.mats ||= { skin: makeMat(n.skin), hair: makeMat(n.hair, 0.05), shirt: makeMat(n.shirt), pants: makeMat(n.pants), shoe: makeMat([0.06, 0.06, 0.07], 0.3), dark: makeMat([0.05, 0.05, 0.06], 0.4), badge: makeMat([0.85, 0.7, 0.2], 0.6) };
    n.parts ||= Array.from({ length: 18 }, () => ({ model: mat4(), mesh: null, mat: null }));
    const M = n.mats; let pi = 0;
    const cy = Math.cos(n.yaw), sy = Math.sin(n.yaw);
    const W = (lx, ly, lz) => [n.x + lx * cy + lz * sy, ly, n.z - lx * sy + lz * cy];
    const put = (mesh, mat, lx, ly, lz, rx, sx, syy, sz, extraYaw = 0) => {
      const p = n.parts[pi++]; const [wx, wy, wz] = W(lx, ly, lz);
      trs(p.model, wx, wy, wz, n.yaw + extraYaw, rx, sx, syy, sz); p.mesh = mesh; p.mat = mat; items.push(p);
    };
    // limb segment from pivot with angle (rotation about local X)
    const limb = (mesh, mat, px, py, pz, ang, len, w, d) => {
      const cx = px, cyy = py - Math.cos(ang) * len / 2, cz = pz - Math.sin(ang) * len / 2;
      put(mesh, mat, cx, cyy, cz, ang, w, len, d);
      return [px, py - Math.cos(ang) * len, pz - Math.sin(ang) * len];
    };
    const walking = n.state === 'walk';
    const t = n.phase;
    const sw = walking ? Math.sin(t * n.speed * 5.2) * 0.55 : 0;
    const bob = walking ? Math.abs(Math.cos(t * n.speed * 5.2)) * 0.035 : Math.sin(t * 1.3) * 0.004;
    const box = meshes.box, sph = meshes.sphere;
    if (n.sitting) {
      const hipY = 0.58, hipZ = 0.02;
      for (const s of [-1, 1]) {
        const knee = limb(box, M.pants, s * 0.1, hipY, hipZ, Math.PI / 2 - 0.05, 0.44, 0.15, 0.17);
        const foot = limb(box, M.pants, knee[0], knee[1], knee[2], 0.05, 0.46, 0.13, 0.14);
        put(box, M.shoe, foot[0], 0.05, foot[2] - 0.05, 0, 0.12, 0.08, 0.24);
      }
      const typing = n.typing * Math.sin(t * 13 + (n.id.length)) * 0.05;
      put(box, M.shirt, 0, hipY + 0.32 + bob, 0.04, -0.08, 0.42, 0.6, 0.24);
      for (const s of [-1, 1]) limb(box, M.shirt, s * 0.27, hipY + 0.58, 0.02, 0.85 + (s > 0 ? typing : -typing), 0.58, 0.11, 0.12);
      this.head(n, put, box, sph, M, 0, hipY + 0.79 + bob, -0.02);
    } else {
      const hipY = 0.92 + bob;
      for (const s of [-1, 1]) {
        const a = s * sw;
        const knee = limb(box, M.pants, s * 0.1, hipY, 0, a, 0.45, 0.15, 0.17);
        const bend = walking ? Math.max(0, Math.sin(t * n.speed * 5.2 * s + 0.6)) * 0.7 : 0;
        const foot = limb(box, M.pants, knee[0], knee[1], knee[2], a - bend, 0.45, 0.13, 0.14);
        put(box, M.shoe, foot[0], Math.max(0.04, foot[1]), foot[2] - 0.05, 0, 0.12, 0.08, 0.24);
      }
      put(box, M.shirt, 0, hipY + 0.3, 0, 0, 0.42, 0.62, 0.24);
      const talk = n.state === 'talk' ? Math.sin(t * 3) * 0.2 + 0.25 : 0;
      for (const s of [-1, 1]) limb(box, M.shirt, s * 0.27, hipY + 0.57, 0, -s * sw * 0.8 + (s > 0 ? talk : 0) + 0.04, 0.6, 0.11, 0.12);
      if (n.kind === 'visitor' && n.dept === 'police') put(box, M.badge, -0.12, hipY + 0.45, -0.125, 0, 0.06, 0.07, 0.01);
      this.head(n, put, box, sph, M, 0, hipY + 0.74, 0);
    }
  }

  head(n, put, box, sph, M, x, y, z) {
    const hy = n.headYaw || 0;
    put(box, M.skin, x, y - 0.05, z, 0, 0.1, 0.1, 0.1);
    put(sph, M.skin, x, y + 0.1, z, 0, 0.115, 0.135, 0.12, hy);
    put(sph, M.hair, x, y + 0.155, z + 0.015, 0, 0.125, 0.095, 0.13, hy);
    if (n.hairLong) put(box, M.hair, x, y + 0.04, z + 0.07, 0, 0.22, 0.24, 0.06, hy);
    if (n.kind === 'dispatcher' || n.kind === 'supervisor') { put(box, M.dark, x, y + 0.24, z, 0, 0.26, 0.025, 0.03, hy); put(box, M.dark, x + 0.13, y + 0.1, z, 0, 0.03, 0.07, 0.06, hy); }
  }
}

function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
function clampAngle(a, lim) { let d = ((a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return Math.max(-lim, Math.min(lim, d)); }
