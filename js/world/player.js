// First-person player controller with PC and touch input.
// Walks on the ground, the Police Department's second floor and up/down its stairs
// (walkable surfaces come from the building), collides against height-ranged colliders,
// can sit in any chair (free look while seated) and can walk outside the building.
import { clamp, lerp } from '../core/util.js';

const EYE = 1.65;     // eye height above the feet
const STEP = 0.42;    // highest ledge you can step onto (stairs are ramps, so this is plenty)
const BODY = 1.75;    // body height for collisions

export class Player {
  constructor(world) {
    this.world = world; this.pos = [-2.8, EYE, 4.2]; this.yaw = 0; this.pitch = -0.05; this.feet = 0; this.vy = 0;
    this.vel = [0, 0]; this.seated = false; this.freeSeat = null; this.transition = null; this.eye = EYE; this.bobT = 0; this.stepAcc = 0;
    this.keys = new Set(); this.joy = { x: 0, y: 0 }; this.lookDelta = [0, 0]; this.enabled = false;
  }

  attach(canvas, settings) {
    this.canvas = canvas; this.settings = settings;
    window.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; this.keys.add(e.code);
      // start walking = get up from a chair you sat down in
      if (this.freeSeat && this.seated && !this.transition && ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'].includes(e.code)) this.world.game?.standFromSeat?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas || !this.enabled || (this.seated && !this.freeSeat)) return;
      const s = 0.0022 * (settings.data.controls.mouseSensitivity || 1);
      this.look(-e.movementX * s, -e.movementY * s * (settings.data.controls.invertY ? -1 : 1));
    });
  }

  look(dyaw, dpitch) {
    this.yaw += dyaw; this.pitch = clamp(this.pitch + dpitch, -1.45, 1.45);
    if (this.freeSeat && this.seated && !this.transition) { // seated: you can turn your head, not spin the chair round
      let d = ((this.yaw - this.freeSeat.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      d = clamp(d, -1.9, 1.9); this.yaw = this.freeSeat.yaw + d;
    }
  }

  setupTouch(joyEl, lookEl) {
    const knob = joyEl.querySelector('i'); let jid = null; let center = null;
    const R = 50;
    joyEl.addEventListener('pointerdown', (e) => { jid = e.pointerId; joyEl.setPointerCapture(jid); const r = joyEl.getBoundingClientRect(); center = [r.left + r.width / 2, r.top + r.height / 2]; move(e); });
    const move = (e) => {
      if (e.pointerId !== jid) return; let dx = e.clientX - center[0], dy = e.clientY - center[1]; const d = Math.hypot(dx, dy); if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      this.joy = { x: dx / R, y: dy / R }; knob.style.transform = `translate(${dx}px, ${dy}px)`;
      if (this.freeSeat && this.seated && !this.transition && d > R * 0.6) this.world.game?.standFromSeat?.();
    };
    const end = (e) => { if (e.pointerId !== jid) return; jid = null; this.joy = { x: 0, y: 0 }; knob.style.transform = ''; };
    joyEl.addEventListener('pointermove', move); joyEl.addEventListener('pointerup', end); joyEl.addEventListener('pointercancel', end);
    let lid = null; let last = null;
    lookEl.addEventListener('pointerdown', (e) => { lid = e.pointerId; last = [e.clientX, e.clientY]; lookEl.setPointerCapture(lid); this.tapStart = { t: performance.now(), x: e.clientX, y: e.clientY }; });
    lookEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid || (this.seated && !this.freeSeat)) return;
      const s = 0.0055 * (this.settings.data.controls.touchSensitivity || 1);
      this.look(-(e.clientX - last[0]) * s, -(e.clientY - last[1]) * s); last = [e.clientX, e.clientY];
    });
    const lend = (e) => {
      if (e.pointerId !== lid) return; lid = null;
      const ts = this.tapStart; if (ts && performance.now() - ts.t < 250 && Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 10) this.world.game.interact();
    };
    lookEl.addEventListener('pointerup', lend); lookEl.addEventListener('pointercancel', lend);
  }

  /** Sit at the dispatch console (CAD). */
  sitAt(pose) {
    this.seated = true; this.freeSeat = null;
    this.transition = { from: { pos: this.pos.slice(), yaw: this.yaw, pitch: this.pitch }, to: pose, t: 0 };
    this.standPose = { pos: [pose.pos[0], EYE, pose.pos[2] + 0.75], yaw: pose.yaw }; this.feet = 0;
  }

  /** Sit down in any chair / sofa / bench (free look; walk or press E to get up). */
  sitInSeat(seat, colliders) {
    const eyeY = seat.y + 0.68; const f = [-Math.sin(seat.yaw), -Math.cos(seat.yaw)];
    const pose = { pos: [seat.x - f[0] * 0.06, eyeY, seat.z - f[1] * 0.06], yaw: seat.yaw, pitch: -0.08 };
    this.seated = true; this.freeSeat = seat;
    this.transition = { from: { pos: this.pos.slice(), yaw: this.yaw, pitch: this.pitch }, to: pose, t: 0 };
    // where to stand up: behind the chair, in front of it, or to either side – the first spot that's clear
    const floorY = seat.y > 3 ? 4.0 : 0; // seats upstairs stand you up on the second floor
    const cands = [[-f[0] * 0.75, -f[1] * 0.75], [f[0] * 0.7, f[1] * 0.7], [f[1] * 0.7, -f[0] * 0.7], [-f[1] * 0.7, f[0] * 0.7], [-f[0] * 1.1, -f[1] * 1.1]];
    const ok = (x, z) => !this.blocked(x, z, colliders, floorY, 0.28);
    const pick = cands.find(([dx, dz]) => ok(seat.x + dx, seat.z + dz)) || cands[0];
    this.standPose = { pos: [seat.x + pick[0], floorY + EYE, seat.z + pick[1]], yaw: seat.yaw, feet: floorY };
  }

  standUp() {
    if (!this.seated) return;
    this.seated = false; this.freeSeat = null;
    const sp = this.standPose; const to = { pos: sp ? sp.pos.slice() : [this.pos[0], EYE, this.pos[2] + 0.7], yaw: this.yaw, pitch: -0.05 };
    this.feet = sp?.feet ?? 0;
    this.transition = { from: { pos: this.pos.slice(), yaw: this.yaw, pitch: this.pitch }, to, t: 0 };
  }

  update(dt, colliders, walk, bounds) {
    if (this.transition) {
      const tr = this.transition; tr.t = Math.min(1, tr.t + dt * 2.2); const k = tr.t * tr.t * (3 - 2 * tr.t);
      for (let i = 0; i < 3; i++) this.pos[i] = lerp(tr.from.pos[i], tr.to.pos[i], k);
      this.yaw = lerpAng(tr.from.yaw, tr.to.yaw, k); this.pitch = lerp(tr.from.pitch, tr.to.pitch, k);
      if (tr.t >= 1) { this.transition = null; if (!this.seated) this.feet = this.pos[1] - EYE; }
      return;
    }
    if (this.seated || !this.enabled) return;
    // keyboard turning for accessibility
    if (this.keys.has('ArrowLeft')) this.yaw += dt * 2; if (this.keys.has('ArrowRight')) this.yaw -= dt * 2;
    if (this.keys.has('ArrowUp')) this.pitch = clamp(this.pitch + dt * 1.5, -1.4, 1.4); if (this.keys.has('ArrowDown')) this.pitch = clamp(this.pitch - dt * 1.5, -1.4, 1.4);
    let f = 0, s = 0;
    if (this.keys.has('KeyW')) f += 1; if (this.keys.has('KeyS')) f -= 1; if (this.keys.has('KeyD')) s += 1; if (this.keys.has('KeyA')) s -= 1;
    f -= this.joy.y; s += this.joy.x;
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1.6 : 1;
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const speed = 2.6 * run;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const tx = (fx * f + rx * s) * speed, tz = (fz * f + rz * s) * speed;
    const acc = Math.min(1, dt * 10);
    this.vel[0] += (tx - this.vel[0]) * acc; this.vel[1] += (tz - this.vel[1]) * acc;
    this.moveWithCollision(this.vel[0] * dt, this.vel[1] * dt, colliders, bounds);
    // follow the floor: step up onto stairs/landings, fall (quickly) when walking off an edge
    const ground = this.groundAt(this.pos[0], this.pos[2], walk);
    if (ground >= this.feet - 0.02) { this.feet = ground > this.feet + 0.3 ? this.feet + Math.min(ground - this.feet, dt * 8) : ground; this.vy = 0; }
    else { this.vy += 18 * dt; this.feet = Math.max(ground, this.feet - this.vy * dt); if (this.feet - ground < 0.25 && this.vy < 4) { this.feet = ground; this.vy = 0; } }
    const moving = Math.hypot(this.vel[0], this.vel[1]);
    if (moving > 0.3) {
      this.bobT += dt * moving * 2.6;
      this.stepAcc += moving * dt;
      if (this.stepAcc > 0.75) { this.stepAcc = 0; this.world.game.audio?.footstep(); }
    }
    const bob = this.settings.data.controls.headBob ? Math.sin(this.bobT * 2) * 0.035 * Math.min(1, moving / 2) : 0;
    this.pos[1] = this.feet + this.eye + bob;
  }

  /** Highest walkable surface under (x, z) that you can reach from your current feet height. */
  groundAt(x, z, walk) {
    let best = 0; const reach = this.feet + STEP;
    if (!walk) return 0;
    for (const s of walk.slabs) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.y <= reach && s.y > best) best = s.y;
    for (const s of walk.stairs) {
      if (x < s.x0 - 0.05 || x > s.x1 + 0.05 || z < s.z0 - 0.02 || z > s.z1 + 0.02) continue;
      const t = clamp((z - s.at) / (s.to - s.at), 0, 1); const y = s.y0 + (s.y1 - s.y0) * t;
      if (y <= reach + 0.15 && y > best) best = y;
    }
    return best;
  }

  blocked(x, z, colliders, feet = this.feet, r = 0.3) {
    const lo = feet + STEP * 0.8, hi = feet + BODY;
    for (const c of colliders) {
      if (!(x > c[0] - r && x < c[2] + r && z > c[1] - r && z < c[3] + r)) continue;
      const y0 = c[4] ?? 0, y1 = c[5] ?? 3.6;
      if (y1 > lo && y0 < hi) return true;
    }
    return false;
  }

  moveWithCollision(dx, dz, colliders, bounds) {
    if (!this.blocked(this.pos[0] + dx, this.pos[2], colliders)) this.pos[0] += dx; else this.vel[0] = 0;
    if (!this.blocked(this.pos[0], this.pos[2] + dz, colliders)) this.pos[2] += dz; else this.vel[1] = 0;
    // stay inside the walkable world (the building plus the grounds around it)
    const B = bounds || [-41.6, -39.6, 11.6, 17.6];
    this.pos[0] = clamp(this.pos[0], B[0], B[2]); this.pos[2] = clamp(this.pos[2], B[1], B[3]);
  }
}

function lerpAng(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
