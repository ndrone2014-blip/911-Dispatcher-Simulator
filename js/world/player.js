// First-person player controller with PC and touch input.
import { clamp, lerp } from '../core/util.js';

export class Player {
  constructor(world) {
    this.world = world; this.pos = [-2.8, 1.65, 4.2]; this.yaw = 0; this.pitch = -0.05;
    this.vel = [0, 0]; this.seated = false; this.transition = null; this.eye = 1.65; this.bobT = 0; this.stepAcc = 0;
    this.keys = new Set(); this.joy = { x: 0, y: 0 }; this.lookDelta = [0, 0]; this.enabled = false;
  }

  attach(canvas, settings) {
    this.canvas = canvas; this.settings = settings;
    window.addEventListener('keydown', (e) => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas || !this.enabled || this.seated) return;
      const s = 0.0022 * (settings.data.controls.mouseSensitivity || 1);
      this.yaw -= e.movementX * s; this.pitch -= e.movementY * s * (settings.data.controls.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.45, 1.45);
    });
  }

  setupTouch(joyEl, lookEl) {
    const knob = joyEl.querySelector('i'); let jid = null; let center = null;
    const R = 50;
    joyEl.addEventListener('pointerdown', (e) => { jid = e.pointerId; joyEl.setPointerCapture(jid); const r = joyEl.getBoundingClientRect(); center = [r.left + r.width / 2, r.top + r.height / 2]; move(e); });
    const move = (e) => { if (e.pointerId !== jid) return; let dx = e.clientX - center[0], dy = e.clientY - center[1]; const d = Math.hypot(dx, dy); if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; } this.joy = { x: dx / R, y: dy / R }; knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    const end = (e) => { if (e.pointerId !== jid) return; jid = null; this.joy = { x: 0, y: 0 }; knob.style.transform = ''; };
    joyEl.addEventListener('pointermove', move); joyEl.addEventListener('pointerup', end); joyEl.addEventListener('pointercancel', end);
    let lid = null; let last = null;
    lookEl.addEventListener('pointerdown', (e) => { lid = e.pointerId; last = [e.clientX, e.clientY]; lookEl.setPointerCapture(lid); this.tapStart = { t: performance.now(), x: e.clientX, y: e.clientY }; });
    lookEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid || this.seated) return;
      const s = 0.0055 * (this.settings.data.controls.touchSensitivity || 1);
      this.yaw -= (e.clientX - last[0]) * s; this.pitch = clamp(this.pitch - (e.clientY - last[1]) * s, -1.4, 1.4); last = [e.clientX, e.clientY];
    });
    const lend = (e) => {
      if (e.pointerId !== lid) return; lid = null;
      const ts = this.tapStart; if (ts && performance.now() - ts.t < 250 && Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 10) this.world.game.interact();
    };
    lookEl.addEventListener('pointerup', lend); lookEl.addEventListener('pointercancel', lend);
  }

  sitAt(pose) {
    this.seated = true;
    this.transition = { from: { pos: this.pos.slice(), yaw: this.yaw, pitch: this.pitch }, to: pose, t: 0 };
    this.standPose = { pos: [pose.pos[0], 1.65, pose.pos[2] + 0.75], yaw: pose.yaw };
  }

  standUp() {
    if (!this.seated) return;
    this.seated = false;
    const to = { pos: this.standPose ? this.standPose.pos.slice() : [this.pos[0], 1.65, this.pos[2] + 0.7], yaw: this.yaw, pitch: -0.05 };
    this.transition = { from: { pos: this.pos.slice(), yaw: this.yaw, pitch: this.pitch }, to, t: 0 };
  }

  update(dt, colliders) {
    if (this.transition) {
      const tr = this.transition; tr.t = Math.min(1, tr.t + dt * 2.2); const k = tr.t * tr.t * (3 - 2 * tr.t);
      for (let i = 0; i < 3; i++) this.pos[i] = lerp(tr.from.pos[i], tr.to.pos[i], k);
      this.yaw = lerpAng(tr.from.yaw, tr.to.yaw, k); this.pitch = lerp(tr.from.pitch, tr.to.pitch, k);
      if (tr.t >= 1) this.transition = null;
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
    this.moveWithCollision(this.vel[0] * dt, this.vel[1] * dt, colliders);
    const moving = Math.hypot(this.vel[0], this.vel[1]);
    if (moving > 0.3) {
      this.bobT += dt * moving * 2.6;
      this.stepAcc += moving * dt;
      if (this.stepAcc > 0.75) { this.stepAcc = 0; this.world.game.audio?.footstep(); }
    }
    const bob = this.settings.data.controls.headBob ? Math.sin(this.bobT * 2) * 0.035 * Math.min(1, moving / 2) : 0;
    this.pos[1] = this.eye + bob;
  }

  moveWithCollision(dx, dz, colliders) {
    const r = 0.3;
    const blocked = (x, z) => colliders.some(([x0, z0, x1, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r);
    if (!blocked(this.pos[0] + dx, this.pos[2])) this.pos[0] += dx; else this.vel[0] = 0;
    if (!blocked(this.pos[0], this.pos[2] + dz)) this.pos[2] += dz; else this.vel[1] = 0;
    // stay inside the building envelope
    this.pos[0] = clamp(this.pos[0], -41.6, 11.6); this.pos[2] = clamp(this.pos[2], -25.6, 17.6);
  }
}

function lerpAng(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
