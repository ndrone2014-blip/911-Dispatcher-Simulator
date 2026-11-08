// Falling rain and snow around the camera when you're outdoors. One dynamic mesh of
// camera-facing streaks/flakes, wrapped inside a box that follows you, updated on the CPU
// (a few thousand floats per frame) and drawn as a single transparent draw call.
import { MeshBuilder } from '../engine/geometry.js';
import { mat4 } from '../engine/math.js';

const BOX = 22, HEIGHT = 14;

export class Weather3D {
  constructor(world) {
    this.world = world; const q = world.preset?.quality; this.n = q === 'low' ? 260 : q === 'medium' ? 520 : 900;
    const b = new MeshBuilder();
    for (let i = 0; i < this.n; i++) { const k = b.vcount; for (let j = 0; j < 4; j++) { b.p.push(0, 0, 0); b.n.push(0, 1, 0); b.uv.push(j & 1, j >> 1); b.c.push(1, 1, 1); } b.i.push(k, k + 1, k + 2, k, k + 2, k + 3); }
    this.mesh = world.renderer.createMesh(b.build(), { dynamic: true }); this.pos = new Float32Array(this.n * 12);
    this.drops = Array.from({ length: this.n }, () => [Math.random() * BOX - BOX / 2, Math.random() * HEIGHT, Math.random() * BOX - BOX / 2, 0.8 + Math.random() * 0.4]);
    this.item = { mesh: this.mesh, mat: null, model: mat4(), order: 20, castShadow: false };
    this.amount = 0;
  }

  update(dt, items, { out, wx, pos }) {
    const wet = wx === 'rain' ? 0.7 : wx === 'thunderstorm' || wx === 'severe' ? 1 : wx === 'snow' ? 1 : 0;
    this.amount += ((out ? wet : 0) - this.amount) * Math.min(1, dt * 1.5);
    if (this.amount < 0.03) return;
    const W = this.world; const snow = wx === 'snow'; const M = W.mats.rain;
    M.color = snow ? [0.95, 0.96, 1.0] : [0.72, 0.78, 0.86]; M.opacity = (snow ? 0.85 : 0.32) * Math.min(1, this.amount * 1.3);
    this.item.mat = M;
    const yaw = W.player.yaw; const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const fall = snow ? 1.3 : 13; const len = snow ? 0.05 : 0.55, wid = snow ? 0.05 : 0.012; const wind = snow ? Math.sin(W.time * 0.7) * 0.6 : 1.4;
    const cx = pos[0], cy = pos[1], cz = pos[2]; const active = Math.floor(this.n * Math.min(1, this.amount)); const P = this.pos;
    for (let i = 0; i < this.n; i++) {
      const d = this.drops[i]; const o = i * 12;
      if (i >= active) { P.fill(0, o, o + 12); continue; }
      d[1] -= fall * d[3] * dt; d[0] += wind * dt * (snow ? Math.sin(W.time + i) : 1);
      if (d[1] < 0) { d[1] += HEIGHT; d[0] = Math.random() * BOX - BOX / 2; d[2] = Math.random() * BOX - BOX / 2; }
      // wrap around the camera so the box always surrounds you
      let x = ((d[0] - cx) % BOX + BOX * 1.5) % BOX - BOX / 2 + cx, z = ((d[2] - cz) % BOX + BOX * 1.5) % BOX - BOX / 2 + cz;
      const y = cy - 3 + d[1] - HEIGHT * 0.3; const sl = snow ? 0 : 0.06;
      // quad: bottom-left, bottom-right, top-right, top-left (streak slants slightly with the wind)
      P[o] = x - rx * wid; P[o + 1] = y; P[o + 2] = z - rz * wid;
      P[o + 3] = x + rx * wid; P[o + 4] = y; P[o + 5] = z + rz * wid;
      P[o + 6] = x + rx * wid - sl; P[o + 7] = y + len; P[o + 8] = z + rz * wid;
      P[o + 9] = x - rx * wid - sl; P[o + 10] = y + len; P[o + 11] = z - rz * wid;
    }
    W.renderer.updatePositions(this.mesh, P);
    items.push(this.item);
  }
}
