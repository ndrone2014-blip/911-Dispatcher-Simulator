// Doors that actually move: toilet-stall doors (swing in, latch, block you when shut),
// the break-room fridge door, and the automatic sliding doors at the lobby entrance.
// Each door is a few draw items (leaf + hardware) with its own model matrix; closed doors
// add colliders for the player, and NPCs open the doors they walk through.
import { mat4, trs } from '../engine/math.js';

export class DynamicDoors {
  constructor(world, defs, prev) {
    this.world = world; this.list = []; this.byId = {};
    for (const def of defs || []) {
      const old = prev?.byId?.[def.id];
      const d = { def, open: old ? old.open : 0, target: old ? old.target : 0, holdUntil: 0, items: [], users: new Set() };
      this.list.push(d); this.byId[def.id] = d;
    }
  }

  /** Swing angle → leaf direction in the x/z plane. */
  static dir(def, open) { const a = (def.base || 0) + (def.openSign || 1) * open * (def.max || 1.5); return [Math.cos(a), -Math.sin(a), a]; }

  toggle(id, who = 'player') {
    const d = this.byId[id]; if (!d) return false;
    d.target = d.target > 0.5 ? 0 : 1; d.by = who;
    if (d.def.kind !== 'slide') this.world.game?.audio?.door?.();
    return d.target > 0.5;
  }
  set(id, open) { const d = this.byId[id]; if (d) d.target = open ? 1 : 0; }
  isOpen(id) { const d = this.byId[id]; return !!d && d.open > 0.6; }

  update(dt) {
    const p = this.world.player.pos; const feet = this.world.player.feet;
    const npcs = this.world.npcs?.npcs || [];
    for (const d of this.list) {
      const def = d.def;
      if (def.kind === 'slide') { // automatic doors: open for anyone within 2.4 m in front of or behind them
        const cz = (def.z0 + def.z1) / 2; const near = (x, z, y) => Math.abs(x - def.x) < 2.6 && Math.abs(z - cz) < 1.9 && Math.abs((y || 0) - def.y) < 1.5;
        d.target = near(p[0], p[2], feet) || npcs.some((n) => near(n.x, n.z, n.y)) ? 1 : 0;
      }
      const speed = def.kind === 'slide' ? 1.8 : def.kind === 'fridge' ? 2.4 : 3.0;
      d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * speed);
    }
  }

  /** Colliders for doors that are (mostly) closed. */
  colliders() {
    const out = [];
    for (const d of this.list) {
      const def = d.def; const y0 = def.y || 0;
      if (def.kind === 'slide') { if (d.open < 0.85) out.push([def.x - 0.1, def.z0, def.x + 0.1, def.z1, y0, y0 + 2.4]); continue; }
      if (def.kind === 'fridge') continue; // the fridge body already blocks; the open door is thin
      const [dx, dz] = DynamicDoors.dir(def, d.open); const [hx, , hz] = def.hinge;
      const ex = hx + dx * def.w, ez = hz + dz * def.w; const t = 0.05;
      out.push([Math.min(hx, ex) - t, Math.min(hz, ez) - t, Math.max(hx, ex) + t, Math.max(hz, ez) + t, y0 + 0.2, y0 + 2.0]);
    }
    return out;
  }

  /** Look-at boxes for doors you can operate by hand (stall doors). */
  interactables() {
    const out = [];
    for (const d of this.list) {
      const def = d.def; if (def.kind !== 'stall') continue;
      const [dx, dz] = DynamicDoors.dir(def, d.open); const [hx, hy, hz] = def.hinge; const mx = hx + dx * def.w / 2, mz = hz + dz * def.w / 2;
      const r = def.w / 2 + 0.06;
      out.push({ id: def.id, kind: 'door', door: def.id, label: d.target > 0.5 ? 'Close the stall door' : 'Open the stall door', min: [mx - r, hy, mz - r], max: [mx + r, hy + def.h, mz + r], pri: 2 });
    }
    return out;
  }

  /** Emit draw items. */
  draw(items) {
    const W = this.world; const M = W.mats; const U = W.unit;
    const lv = W.level(); const out = W.outside();
    for (const d of this.list) {
      const def = d.def; const y0 = def.y || 0;
      if (!out && Math.abs(y0 - (lv ? 4 : 0)) > 1.5) continue;
      const pd = def.hinge || [def.x, y0, (def.z0 + def.z1) / 2];
      if (Math.hypot(pd[0] - W.player.pos[0], pd[2] - W.player.pos[2]) > (def.kind === 'slide' ? 60 : 24)) continue;
      let k = 0; const put = (mesh, mat, x, y, z, ry, sx, sy, sz) => { const it = (d.items[k++] ||= { model: mat4(), mesh: null, mat: null }); trs(it.model, x, y, z, ry, 0, sx, sy, sz); it.mesh = mesh; it.mat = mat; items.push(it); };
      if (def.kind === 'slide') {
        const L = (def.z1 - def.z0) / 2; const slide = d.open * (L - 0.06);
        for (const s of [-1, 1]) {
          const zc = (def.z0 + def.z1) / 2 + s * (L / 2 + slide); // each leaf slides outward along the wall
          put(U.cube, M.glassDoor, def.x, y0 + def.h / 2, zc, 0, 0.03, def.h, L - 0.02);
          put(U.cube, M.chrome, def.x, y0 + def.h - 0.03, zc, 0, 0.05, 0.06, L);
          put(U.cube, M.chrome, def.x, y0 + 0.05, zc, 0, 0.05, 0.1, L);
          put(U.cube, M.chrome, def.x, y0 + def.h / 2, zc - s * (L / 2 - 0.02), 0, 0.05, def.h, 0.04);
        }
        continue;
      }
      const [dx, dz, ang] = DynamicDoors.dir(def, d.open); const [hx, hy, hz] = def.hinge;
      const cx = hx + dx * def.w / 2, cz = hz + dz * def.w / 2;
      const mat = M[def.mat] || M.stallDoor;
      put(U.cube, mat, cx, hy + def.h / 2, cz, ang, def.w, def.h, def.t || 0.03);
      if (def.kind === 'stall') { // latch + coat hook on the inside, hinge pins
        const lx = hx + dx * (def.w - 0.06), lz = hz + dz * (def.w - 0.06);
        put(U.cube, M.chrome, lx, hy + 0.95, lz, ang, 0.03, 0.08, 0.06);
        for (const yy of [0.25, def.h - 0.25]) put(U.cube, M.chrome, hx, hy + yy, hz, ang, 0.03, 0.12, 0.05);
        // occupied indicator on the latch (red when shut by someone inside)
        put(U.cube, d.open < 0.1 && d.users.size ? M.lightRed : M.led, lx, hy + 1.05, lz, ang, 0.02, 0.025, 0.065);
      } else if (def.kind === 'fridge') { // handle, door shelves with bottles, gasket
        const nx = Math.sin(ang), nz = Math.cos(ang); const s = def.openSign || 1;
        const tx = hx + dx * (def.w - 0.07), tz = hz + dz * (def.w - 0.07);
        put(U.cube, M.chrome, tx - nx * 0.05 * s, hy + 1.05, tz - nz * 0.05 * s, ang, 0.03, 0.55, 0.03);
        for (const yy of [0.45, 0.9, 1.35]) put(U.cube, M.fridge, cx + nx * 0.07 * s, hy + yy, cz + nz * 0.07 * s, ang, def.w - 0.12, 0.02, 0.08);
        for (const [o, yy] of [[0.2, 0.55], [0.32, 0.55], [0.5, 1.0]]) put(U.cube, o > 0.4 ? M.red : M.waterjug, hx + dx * o + nx * 0.08 * s, hy + yy, hz + dz * o + nz * 0.08 * s, ang, 0.06, 0.2, 0.06);
      }
    }
  }
}
