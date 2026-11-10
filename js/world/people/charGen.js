// Procedural character meshes. Every person gets their own mesh, built from their
// appearance: a sculpted head (brow ridge, eye sockets, cheekbones, nose, jaw, chin) with
// real eyeballs, eyelids, eyebrows, lips, teeth and ears; hair as a scalp shell plus
// curtains, buns or ponytails; a continuous skinned body (no gaps at elbows, knees or
// shoulders) whose surface *is* the clothing, so nothing can clip through it; and gear
// that is laid on that surface and skinned with the same bone weights as the cloth under
// it, so badges, belts, body cameras and patches can never float or detach.
//
// Three detail levels: 2 = close-up (full face, fingers, every piece of equipment),
// 1 = mid-range (simplified), 0 = far (silhouette, uniform colours, belt and hat).
import { MeshBuilder } from '../../engine/geometry.js';
import { B, makeSkeleton } from './rig.js';
import { regionUV } from './atlas.js';

// surface response: [specular 0..4, shininess 2..128, reflectivity 0..1, skin light-wrap 0..1]
const SURF = {
  skin: [0.2, 14, 0, 0.32], lips: [0.55, 26, 0, 0.4], eye: [2.8, 110, 0.15, 0], hair: [0.5, 20, 0, 0.2], brow: [0.2, 10, 0, 0.2], teeth: [0.6, 30, 0, 0.3], mouth: [0.05, 6, 0, 0],
  cotton: [0.05, 7, 0, 0.12], poly: [0.16, 14, 0, 0.08], denim: [0.05, 6, 0, 0.1], felt: [0.04, 5, 0, 0.1], leather: [0.75, 36, 0.06, 0], boot: [1.2, 50, 0.14, 0],
  metal: [2.6, 64, 0.65, 0], plastic: [0.55, 30, 0.05, 0], rubber: [0.12, 8, 0, 0], lens: [3.4, 120, 0.55, 0], patch: [0.08, 8, 0, 0.05], visor: [1.4, 70, 0.06, 0],
};
const METAL = { gold: [0.86, 0.66, 0.26], silver: [0.78, 0.79, 0.81] };
const BLACKISH = [0.03, 0.03, 0.035];

const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const G = (x, s) => Math.exp(-(x * x) / (s * s));
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const W1 = (b) => ({ b0: b, b1: b, w: 1 });
let CUR_Q = 2;
/** Rounded box close up; plain box when small or at lower detail. */
function RB(x, y, z, w, h, d, opts = {}) { const mb = new MeshBuilder(); return CUR_Q >= 2 && Math.min(w, h, d) > 0.018 ? mb.rbox(x, y, z, w, h, d, { ...opts, seg: 1 }) : mb.box(x, y, z, w, h, d, { uv: 0 }); }
const W2 = (b0, b1, w) => (w >= 0.999 ? W1(b0) : w <= 0.001 ? W1(b1) : { b0, b1, w });

// ---------------------------------------------------------------- geometry accumulator
class Geo {
  constructor(cap = 4096) { this.cap = cap; this.alloc(cap); this.count = 0; this.I = []; }
  alloc(cap) {
    const grow = (old, n) => { const a = new Float32Array(cap * n); if (old) a.set(old.subarray(0, Math.min(old.length, cap * n))); return a; };
    this.P = grow(this.P, 3); this.N = grow(this.N, 3); this.T = grow(this.T, 2); this.C = grow(this.C, 3); this.K = grow(this.K, 3); this.S = grow(this.S, 4); this.cap = cap;
  }
  get n() { return this.count; }
  v(p, n, uv, c, bw, s) {
    if (this.count >= this.cap) this.alloc(this.cap * 2);
    const k = this.count++; const k3 = k * 3;
    this.P[k3] = p[0]; this.P[k3 + 1] = p[1]; this.P[k3 + 2] = p[2]; this.N[k3] = n[0]; this.N[k3 + 1] = n[1]; this.N[k3 + 2] = n[2];
    this.T[k * 2] = uv[0]; this.T[k * 2 + 1] = uv[1]; this.C[k3] = c[0]; this.C[k3 + 1] = c[1]; this.C[k3 + 2] = c[2];
    this.K[k3] = bw.b0; this.K[k3 + 1] = bw.b1; this.K[k3 + 2] = bw.w; this.S[k * 4] = s[0]; this.S[k * 4 + 1] = s[1]; this.S[k * 4 + 2] = s[2]; this.S[k * 4 + 3] = s[3];
    return k;
  }
  /** Triangle, automatically wound so its face agrees with the vertex normals (CCW = front). */
  tri(a, b, c) {
    const P = this.P, N = this.N;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    if (fx * nx + fy * ny + fz * nz < 0) this.I.push(a, c, b); else this.I.push(a, b, c);
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  /** Grid of vertices from fn(i, j) → {p, n, uv, c, bw, s}; wrapU joins the last column to the first. */
  grid(nu, nv, fn, { wrapU = false, skip } = {}) {
    const base = this.n; const cols = nu;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const o = fn(i, j); this.v(o.p, o.n, o.uv, o.c, o.bw, o.s); }
    const id = (i, j) => base + j * cols + (wrapU ? i % nu : i);
    const cu = wrapU ? nu : nu - 1;
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < cu; i++) { if (skip && skip(i, j)) continue; this.quad(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)); }
    return base;
  }
  /** Masked grid: only vertices used by quads whose four corners pass `on` are emitted. */
  maskedGrid(nu, nv, on, make) {
    const used = new Int32Array(nu * nv).fill(-1);
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) if (on(i, j) && on(i + 1, j) && on(i + 1, j + 1) && on(i, j + 1)) for (const [a, b] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]) used[b * nu + a] = 0;
    for (let k = 0; k < used.length; k++) if (used[k] === 0) { const o = make(k % nu, Math.floor(k / nu)); used[k] = this.v(o.p, o.n, o.uv, o.c, o.bw, o.s); }
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = used[j * nu + i], b = used[j * nu + i + 1], c = used[(j + 1) * nu + i + 1], d = used[(j + 1) * nu + i]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0 && on(i, j) && on(i + 1, j) && on(i + 1, j + 1) && on(i, j + 1)) this.quad(a, b, c, d); }
  }
  /** Append a MeshBuilder result through a basis (columns X, Y, Z) and origin. */
  addMB(mb, o, X, Y, Z, { color = [1, 1, 1], region = 'white', uvRect, bw = W1(0), s = SURF.plastic, colorFn } = {}) {
    const g = mb.build ? mb.build() : mb; const base = this.n; const n = g.positions.length / 3;
    for (let k = 0; k < n; k++) {
      const x = g.positions[k * 3], y = g.positions[k * 3 + 1], z = g.positions[k * 3 + 2];
      const nx = g.normals[k * 3], ny = g.normals[k * 3 + 1], nz = g.normals[k * 3 + 2];
      const p = [o[0] + X[0] * x + Y[0] * y + Z[0] * z, o[1] + X[1] * x + Y[1] * y + Z[1] * z, o[2] + X[2] * x + Y[2] * y + Z[2] * z];
      const nn = norm([X[0] * nx + Y[0] * ny + Z[0] * nz, X[1] * nx + Y[1] * ny + Z[1] * nz, X[2] * nx + Y[2] * ny + Z[2] * nz]);
      let u = g.uvs[k * 2], v = g.uvs[k * 2 + 1]; u = Math.min(1, Math.max(0, u)); v = Math.min(1, Math.max(0, v));
      const uv = uvRect ? [lerp(uvRect[0], uvRect[2], u), lerp(uvRect[1], uvRect[3], v)] : regionUV(region, 0.2 + u * 0.6, 0.2 + v * 0.6);
      const vc = [g.colors[k * 3] * color[0], g.colors[k * 3 + 1] * color[1], g.colors[k * 3 + 2] * color[2]];
      this.v(p, nn, uv, colorFn ? colorFn(p, vc) : vc, typeof bw === 'function' ? bw(p) : bw, s);
    }
    for (let k = 0; k < g.indices.length; k += 3) this.tri(base + g.indices[k], base + g.indices[k + 1], base + g.indices[k + 2]);
  }
  pack() {
    const n = this.n; const buf = new ArrayBuffer(n * 36); const dv = new DataView(buf);
    const f32 = new Float32Array(buf); const i8 = new Int8Array(buf); const u16 = new Uint16Array(buf); const u8 = new Uint8Array(buf);
    const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
    for (let k = 0; k < n; k++) {
      const o = k * 36;
      f32[o / 4] = this.P[k * 3]; f32[o / 4 + 1] = this.P[k * 3 + 1]; f32[o / 4 + 2] = this.P[k * 3 + 2];
      i8[o + 12] = Math.round(this.N[k * 3] * 127); i8[o + 13] = Math.round(this.N[k * 3 + 1] * 127); i8[o + 14] = Math.round(this.N[k * 3 + 2] * 127); i8[o + 15] = 0;
      u16[(o + 16) / 2] = Math.round(cl(this.T[k * 2]) * 65535); u16[(o + 18) / 2] = Math.round(cl(this.T[k * 2 + 1]) * 65535);
      u16[(o + 20) / 2] = Math.round(cl(this.C[k * 3]) * 65535); u16[(o + 22) / 2] = Math.round(cl(this.C[k * 3 + 1]) * 65535); u16[(o + 24) / 2] = Math.round(cl(this.C[k * 3 + 2]) * 65535); u16[(o + 26) / 2] = 0;
      u8[o + 28] = this.K[k * 3]; u8[o + 29] = this.K[k * 3 + 1]; u8[o + 30] = Math.round(cl(this.K[k * 3 + 2]) * 255); u8[o + 31] = 0;
      const s = this.S; u8[o + 32] = Math.round(cl(s[k * 4] / 4) * 255); u8[o + 33] = Math.round(cl((s[k * 4 + 1] - 2) / 126) * 255); u8[o + 34] = Math.round(cl(s[k * 4 + 2]) * 255); u8[o + 35] = Math.round(cl(s[k * 4 + 3]) * 255);
    }
    void dv;
    return { data: buf, indices: n > 65535 ? new Uint32Array(this.I) : new Uint16Array(this.I), vcount: n, tris: this.I.length / 3 };
  }
}

// ---------------------------------------------------------------- the head
/** Sculpted head surface in head-centre space as a function of azimuth th (0 = front, + = right) and elevation ph. */
function makeHead(app) {
  const { hw, hh, hd } = app.body.head; const f = app.body.face; const fem = app.sex === 'f';
  const eX = 0.0312 * f.eyeSpace * hw / 0.075;
  const noseTop = 0.022, noseLen = 0.056 * f.noseLen, tipY = noseTop - noseLen * 0.86, baseY = noseTop - noseLen;
  const mY = f.mouthY;
  function pt(th, ph) {
    const cp = Math.cos(ph);
    let x = hw * Math.sin(th) * cp, y = hh * Math.sin(ph), z = -hd * Math.cos(th) * cp;
    if (y < 0) y *= f.faceLen;
    const front = sm((-z / hd - 0.25) / 0.6);                 // 0 at the sides/back, 1 on the face
    // fuller back of the skull, broader forehead/temples
    if (z > 0) z *= 1.04 + 0.03 * sm(y / hh);
    // squarer face (superellipse in plan view) across the face band
    { const band = sm((y + 0.1) / 0.05) * sm((0.075 - y) / 0.04); if (band > 0) { const r2 = x * x + z * z || 1e-9; const s2 = 4 * x * x * z * z / (r2 * r2); const k = 1 + 0.04 * s2 * band * (z < 0 ? 1 : 0.3); x *= k; z *= k; } }
    // jaw narrows toward the chin
    const low = sm(-y / (hh * 0.95));
    x *= 1 - low * (1.08 - f.jawW) * 0.42 - low * low * 0.13 + f.fat * 0.04 * G(y + 0.06, 0.03);
    // tuck the back of the skull base into the neck and flatten under the jaw
    if (y < -0.035) { const t = sm((-y - 0.035) / 0.06); if (z > -0.02) { z *= 1 - 0.45 * t; x *= 1 - 0.18 * t; } }
    if (y < -0.088 && front > 0.2) y = -0.088 + (y + 0.088) * lerp(1, 0.5, front);
    if (front > 0) {
      const F = front;
      // eye sockets, brow ridge, cheekbones, temples
      for (const s of [-1, 1]) {
        z += F * 0.009 * G(x - s * eX, 0.016) * G(y - 0.012, 0.011);
        z -= F * f.cheek * 0.006 * G(x - s * (eX + 0.016), 0.016) * G(y + 0.012, 0.014);
        x += s * f.cheek * 0.003 * G(y + 0.012, 0.016) * F;
        x -= s * 0.0025 * G(y - 0.045, 0.022) * G(z + 0.03, 0.03);
        z -= F * f.fat * 0.005 * G(x - s * 0.035, 0.02) * G(y + 0.03, 0.02);
      }
      z -= F * (0.002 + f.brow * 0.004) * G(x, 0.05) * G(y - 0.032, 0.009);
      z -= F * 0.002 * G(y - 0.055, 0.03); // forehead
      // nose: bridge → tip, nostril wings, columella
      if (y < noseTop + 0.01 && y > baseY - 0.012) {
        const t = Math.min(1, Math.max(0, (noseTop - y) / noseLen));
        const w = (0.0075 + 0.0085 * t) * f.noseW;
        let proj = f.noseProj * (0.004 + 0.025 * Math.pow(t, 1.2)) + f.noseBump * 0.003 * G(t - 0.35, 0.18);
        proj *= sm((y - (baseY - 0.004)) / 0.009);
        z -= F * proj * G(x, w);
        z -= F * 0.0055 * f.noseProj * G(x, 0.0085 * f.noseW) * G(y - tipY, 0.0075);
        for (const s of [-1, 1]) { const g = G(x - s * 0.0125 * f.noseW, 0.0055) * G(y - (baseY + 0.003), 0.0055); z -= F * 0.0042 * g; x += s * 0.0018 * g; }
      }
      // muzzle and mouth seam, chin
      z -= F * 0.0055 * G(x, 0.03) * G(y - mY, 0.02);
      z += F * 0.0015 * G(x, f.mouthW * 0.9) * G(y - mY, 0.0025);
      z -= F * (0.003 + f.chin * 0.006) * G(x, 0.02) * G(y + 0.104 * f.faceLen, 0.016);
      z += F * 0.0025 * G(x, 0.022) * G(y - (mY - 0.016), 0.006); // dimple under the lower lip
    }
    return [x, y, z];
  }
  function ptN(th, ph) {
    const e = 0.004; const p = pt(th, ph);
    let a = sub(pt(th + e, ph), pt(th - e, ph)); let b = sub(pt(th, Math.min(1.5707, ph + e)), pt(th, Math.max(-1.5707, ph - e)));
    if (Math.abs(ph) > 1.55) a = [Math.cos(th), 0, Math.sin(th)];
    let n = norm(cross(a, b)); if (dot(n, p) < 0) n = mul3(n, -1);
    return { p, n };
  }
  /** Find the surface point at a given (x, y) on the front of the face. */
  function at(x, y) {
    let th = Math.asin(Math.max(-0.99, Math.min(0.99, x / hw))) * 0.9, ph = Math.asin(Math.max(-0.99, Math.min(0.99, y / hh)));
    for (let k = 0; k < 7; k++) {
      const p = pt(th, ph); const e = 1e-4;
      const px = pt(th + e, ph), py = pt(th, ph + e);
      const j11 = (px[0] - p[0]) / e, j12 = (py[0] - p[0]) / e, j21 = (px[1] - p[1]) / e, j22 = (py[1] - p[1]) / e;
      const det = j11 * j22 - j12 * j21 || 1e-9; const ex = x - p[0], ey = y - p[1];
      th += (j22 * ex - j12 * ey) / det; ph += (-j21 * ex + j11 * ey) / det;
      ph = Math.max(-1.5, Math.min(1.5, ph));
    }
    const r = ptN(th, ph); return { ...r, th, ph };
  }
  /** Point at a given height y along azimuth th (for hats and hair). */
  function atY(th, y) { let lo = -1.5, hi = 1.5; for (let k = 0; k < 15; k++) { const m = (lo + hi) / 2; if (pt(th, m)[1] < y) lo = m; else hi = m; } return { ...ptN(th, (lo + hi) / 2), ph: (lo + hi) / 2 }; }
  return { pt, ptN, at, atY, hw, hh, hd, eX, tipY, baseY, noseTop };
}

// ---------------------------------------------------------------- body surfaces
// Torso cross-sections [y/H, half-width, front depth, back depth, centre z] for a 1.78 m, average-build man.
const TORSO = [
  [0.452, 0.118, 0.068, 0.078, 0], [0.475, 0.150, 0.085, 0.100, 0], [0.50, 0.167, 0.090, 0.112, 0.004], [0.53, 0.169, 0.092, 0.107, 0.005],
  [0.56, 0.161, 0.094, 0.098, 0.005], [0.59, 0.150, 0.095, 0.089, 0.006], [0.62, 0.146, 0.096, 0.085, 0.006], [0.66, 0.152, 0.102, 0.088, 0.006],
  [0.70, 0.160, 0.110, 0.092, 0.004], [0.735, 0.168, 0.113, 0.096, 0.002], [0.77, 0.172, 0.106, 0.100, 0.004], [0.795, 0.174, 0.093, 0.100, 0.008],
  [0.815, 0.164, 0.078, 0.092, 0.012], [0.83, 0.138, 0.066, 0.080, 0.014], [0.843, 0.098, 0.056, 0.066, 0.014], [0.853, 0.066, 0.050, 0.056, 0.014],
  [0.875, 0.051, 0.046, 0.050, 0.012], [0.90, 0.049, 0.044, 0.048, 0.010], [0.918, 0.045, 0.039, 0.043, 0.008],
];
const ARM = [[-0.016, 0.030, 0.034], [-0.006, 0.047, 0.050], [0.018, 0.056, 0.057], [0.06, 0.052, 0.053], [0.10, 0.047, 0.049], [0.15, 0.043, 0.044],
  [0.186, 0.038, 0.040], [0.205, 0.040, 0.040], [0.24, 0.039, 0.037], [0.29, 0.031, 0.028], [0.325, 0.025, 0.020], [0.334, 0.024, 0.019]];
const LEG = [[-0.06, 0.085, 0.088, 0.095], [-0.02, 0.090, 0.090, 0.098], [0.03, 0.088, 0.088, 0.092], [0.10, 0.080, 0.082, 0.084], [0.17, 0.068, 0.070, 0.072],
  [0.225, 0.058, 0.058, 0.060], [0.245, 0.052, 0.056, 0.052], [0.265, 0.053, 0.054, 0.056], [0.31, 0.056, 0.050, 0.066], [0.36, 0.048, 0.044, 0.052],
  [0.42, 0.038, 0.036, 0.040], [0.47, 0.033, 0.032, 0.034], [0.492, 0.032, 0.033, 0.034]];

function interp(table, y, col) { // Catmull-Rom through the table rows (column col), clamped
  const n = table.length; if (y <= table[0][0]) return table[0][col]; if (y >= table[n - 1][0]) return table[n - 1][col];
  let i = 0; while (i < n - 2 && table[i + 1][0] < y) i++;
  const p0 = table[Math.max(0, i - 1)][col], p1 = table[i][col], p2 = table[i + 1][col], p3 = table[Math.min(n - 1, i + 2)][col];
  const t = (y - table[i][0]) / (table[i + 1][0] - table[i][0]);
  const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  return Math.min(Math.max(p1, p2) * 1.04, Math.max(Math.min(p1, p2) * 0.96, v));
}
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

function makeBody(app, sk) {
  const bd = app.body; const H = bd.H, k = H / 1.78, fem = bd.sex === 'f'; const wS = Math.pow(bd.build, 0.9), dS = bd.build;
  const T = TORSO.map(([y, rx, rf, rb, zc]) => {
    let x = rx, f = rf, b = rb;
    if (fem) {
      x += bd.hips * 0.016 * G(y - 0.505, 0.03) - 0.016 * G(y - 0.625, 0.04) - 0.012 * sm((y - 0.7) / 0.05) * sm((0.86 - y) / 0.01);
      f -= 0.004 * G(y - 0.62, 0.05); b += 0.01 * G(y - 0.5, 0.03); if (y > 0.85) { x -= 0.006; f -= 0.004; b -= 0.004; }
    }
    return [y * H, x * k * wS, f * k * dS, b * k * dS, zc * k];
  });
  const stoop = app.motion.stoop || 0;
  function torso(a, y) {
    const rx = interp(T, y, 1), rf = interp(T, y, 2), rb = interp(T, y, 3); let zc = interp(T, y, 4);
    zc -= stoop * 0.03 * sm((y / H - 0.7) / 0.15);
    const s = Math.sin(a), c = Math.cos(a); const N = 2.3;
    let x = rx * spow(s, 2 / N), z = zc - (c >= 0 ? rf : rb) * spow(c, 2 / N);
    const yh = y / H; let e = 0;
    if (bd.bust) e += bd.bust * 0.03 * k * G(yh - 0.73, 0.03) * Math.pow(Math.max(0, c), 1.3) * (0.6 + 0.4 * G(Math.abs(a) - 0.5, 0.35));
    if (bd.belly) e += bd.belly * 0.055 * k * G(yh - 0.625, 0.06) * Math.pow(Math.max(0, c), 1.5);
    e += 0.012 * k * G(yh - 0.505, 0.03) * Math.pow(Math.max(0, -c), 1.5);
    e += 0.006 * k * G(yh - 0.77, 0.03) * Math.pow(Math.max(0, -c), 2);
    if (e) { const dx = x, dz = z - zc; const l = Math.hypot(dx, dz) || 1; x += dx / l * e; z += dz / l * e; }
    return [x, y, z];
  }
  function torsoN(a, y, off = 0) {
    const e = 0.01, ey = 0.004; const p = torso(a, y);
    const da = sub(torso(a + e, y), torso(a - e, y)), dy = sub(torso(a, y + ey), torso(a, y - ey));
    let n = norm(cross(da, dy)); const zc = interp(T, y, 4);
    if (n[0] * p[0] + n[2] * (p[2] - zc) < 0) n = mul3(n, -1);
    return { p: off ? add(p, mul3(n, off)) : p, n };
  }
  const wT = (y) => {
    const t = y / H;
    if (t < 0.56) return W1(B.pelvis);
    if (t < 0.65) return W2(B.pelvis, B.spine, 1 - sm((t - 0.56) / 0.09));
    if (t < 0.745) return W2(B.spine, B.chest, 1 - sm((t - 0.65) / 0.095));
    if (t < 0.845) return W1(B.chest);
    if (t < 0.885) return W2(B.chest, B.neck, 1 - sm((t - 0.845) / 0.04));
    if (t < 0.905) return W1(B.neck);
    return W2(B.neck, B.head, 1 - sm((t - 0.905) / 0.015));
  };
  // limbs: rings around a bone hanging straight down from its pivot
  const armS = k * wS * (fem ? 0.88 : 1), legS = k * Math.pow(bd.build, 0.8) * (fem ? 0.97 : 1);
  function arm(side, a, t) { // t = metres below the shoulder joint
    const th = t / H; const rx = interp(ARM, th, 1) * armS, rz = interp(ARM, th, 2) * armS; const piv = sk.P[side < 0 ? B.armL : B.armR];
    return [piv[0] + side * rx * spow(Math.sin(a), 0.85), piv[1] - t, piv[2] - rz * spow(Math.cos(a), 0.85)];
  }
  function leg(side, a, t) {
    const th = t / H; const rx = interp(LEG, th, 1) * legS, rf = interp(LEG, th, 2) * legS, rb = interp(LEG, th, 3) * legS; const piv = sk.P[side < 0 ? B.thighL : B.thighR];
    const c = Math.cos(a); return [piv[0] + side * rx * spow(Math.sin(a), 0.9), piv[1] - t, piv[2] - (c >= 0 ? rf : rb) * spow(c, 0.9)];
  }
  const limbN = (fn, side, a, t, off = 0) => {
    const p = fn(side, a, t); const da = sub(fn(side, a + 0.01, t), fn(side, a - 0.01, t)), dt = sub(fn(side, a, t + 0.004), fn(side, a, t - 0.004));
    let n = norm(cross(da, dt)); const piv = sk.P[fn === arm ? (side < 0 ? B.armL : B.armR) : (side < 0 ? B.thighL : B.thighR)];
    if (n[0] * (p[0] - piv[0]) + n[2] * (p[2] - piv[2]) < 0) n = mul3(n, -1);
    return { p: off ? add(p, mul3(n, off)) : p, n };
  };
  const wArm = (side, t) => {
    const th = t / H; const a = side < 0 ? B.armL : B.armR, f = side < 0 ? B.foreL : B.foreR, h = side < 0 ? B.handL : B.handR;
    if (th < 0.025) return W2(B.chest, a, 0.45 * (1 - sm((th + 0.016) / 0.041)));
    if (th < 0.17) return W1(a);
    if (th < 0.205) return W2(a, f, 1 - sm((th - 0.17) / 0.035));
    if (th < 0.31) return W1(f);
    return W2(f, h, 1 - 0.35 * sm((th - 0.31) / 0.025));
  };
  const wLeg = (side, t) => {
    const th = t / H; const a = side < 0 ? B.thighL : B.thighR, s = side < 0 ? B.shinL : B.shinR;
    if (th < 0.02) return W2(B.pelvis, a, 0.6 * (1 - sm((th + 0.06) / 0.08)));
    if (th < 0.228) return W1(a);
    if (th < 0.262) return W2(a, s, 1 - sm((th - 0.228) / 0.034));
    return W1(s);
  };
  return { torso, torsoN, wT, arm, leg, limbN, wArm, wLeg, H, k, armS, legS, beltY: H * 0.578, neckY: H * 0.853 };
}

// ---------------------------------------------------------------- main entry
/**
 * Build a character mesh. q = detail level (0, 1, 2); dscale scales tessellation (phones).
 * Returns { geo (packed), sk (skeleton), anchors (gear anchors for attachment checks), gear }.
 */
/** Skeleton and body measurements for an appearance (no geometry): used by the animator. */
export function rigFor(app) {
  const f = app.body.face; const head = makeHead(app);
  // facial landmarks on the sculpted surface → rig pivots
  if (f.eyeZ == null) { const eyeS = head.at(f.eyeX, f.eyeY); f.eyeZ = eyeS.p[2] + f.eyeR * 0.42; f.browZ = head.at(f.browX, f.browY).p[2]; f.mouthZ = head.at(f.mouthW, f.mouthY).p[2]; }
  const sk = makeSkeleton(app.body); const body = makeBody(app, sk); const H = sk.H;
  const front = (y) => body.torso(0, y)[2]; const side = (y) => body.torso(Math.PI / 2, y)[0];
  sk.meas = { beltY: body.beltY, beltFrontZ: front(body.beltY), chestY: H * 0.73, chestFrontZ: front(H * 0.73), hipSideX: side(H * 0.5), waistSideX: side(body.beltY),
    mouth: [0, sk.C[1] + f.mouthY, sk.C[2] + f.mouthZ], eyeY: sk.C[1] + f.eyeY };
  return { head, sk, body };
}

export function buildCharacter(app, q = 2, dscale = 1) {
  const { head, sk, body } = rigFor(app); const C = sk.C;
  const g = new Geo(); const anchors = []; const gear = [];
  const R = (n) => Math.max(3, Math.round(n * (q === 2 ? dscale : 1))); CUR_Q = q;
  const cl = app.clothes; const skin = app.skin;
  const H = app.body.H;
  const hairThick = hairModel(app, head);

  const prof = globalThis.__CG_PROFILE; const step = (name, fn) => { if (!prof) return fn(); const t = performance.now(), v = g.n; fn(); (prof[name] ||= [0, 0]); prof[name][0] += performance.now() - t; prof[name][1] += g.n - v; };
  step('head', () => buildHead(g, app, head, C, q, R, hairThick));
  step('torso', () => buildTorso(g, app, body, q, R, anchors));
  for (const s of [-1, 1]) { step('arm', () => buildArm(g, app, body, sk, s, q, R)); step('hand', () => buildHand(g, app, sk, s, q, R)); step('leg', () => buildLeg(g, app, body, sk, s, q, R)); step('shoe', () => buildShoe(g, app, sk, s, q, R)); }
  step('details', () => buildClothingDetails(g, app, body, sk, q, R, anchors, gear));
  if (cl.dutyBelt || cl.belt !== 'none' || cl.radioOnBelt) step('belt', () => buildBelt(g, app, body, q, R, anchors, gear));
  if (cl.hat) step('hat', () => buildHat(g, app, head, C, q, R, hairThick, gear));
  if (q >= 1 && cl.headset) step('headset', () => buildHeadset(g, app, head, C, q, hairThick));
  if (q >= 1 && app.glasses) step('glasses', () => buildGlasses(g, app, head, C, q, hairThick));
  void skin; void H;
  return { geo: g.pack(), sk, anchors, gear };
}

// ---------------------------------------------------------------- hair model
function hairModel(app, head) {
  const st = app.hairStyle; const fem = app.sex === 'f'; const age = app.age; const hh = head.hh;
  const recede = !fem && (st === 'receding' || st === 'balding' || age > 52) ? (st === 'receding' || st === 'balding' ? 1 : (age - 52) / 20) : 0;
  // hairline height (head-local y) by azimuth
  const hairline = (th) => {
    const a = Math.abs(th);
    const pts = fem ? [[0, 0.056], [0.5, 0.054], [0.95, 0.04], [1.25, 0.0], [1.42, -0.02], [1.62, 0.018], [1.95, -0.005], [2.5, -0.06], [Math.PI, -0.078]]
      : [[0, 0.06 + recede * 0.012], [0.42, 0.058 + recede * 0.026], [0.85, 0.047 + recede * 0.012], [1.22, 0.008], [1.38, -0.022], [1.6, 0.02], [1.95, 0.0], [2.5, -0.05], [Math.PI, -0.07]];
    for (let i = 0; i < pts.length - 1; i++) if (a <= pts[i + 1][0]) { const t = (a - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return lerp(pts[i][1], pts[i + 1][1], sm(t)); }
    return pts[pts.length - 1][1];
  };
  const noise = (th, ph) => Math.sin(th * 9.1 + ph * 3.7) * Math.sin(ph * 11.3 - th * 4.1) * 0.5 + Math.sin(th * 23 + ph * 17) * 0.25;
  const top = (y) => Math.max(0, y / hh);
  const thick = (th, ph, p) => {
    const y = p[1]; const d = y - hairline(th); if (d < 0) return -1;
    if (st === 'bald') return -1;
    if (st === 'balding' && (y > 0.07 || (Math.abs(th) < 0.9 && y > 0.045))) return -1;
    const edge = sm(d / 0.012); let t;
    switch (st) {
      case 'buzz': t = 0.0024; break;
      case 'crew': case 'receding': t = 0.004 + 0.008 * Math.pow(top(y), 1.2) + 0.004 * sm((0.6 - Math.abs(th)) / 0.4) * top(y); break;
      case 'short': t = 0.006 + 0.01 * top(y); break;
      case 'side': t = 0.007 + 0.012 * top(y) + 0.005 * sm(-th / 0.8) * top(y) + 0.006 * sm((0.7 - Math.abs(th)) / 0.5) * top(y); break;
      case 'messy': t = 0.008 + 0.016 * top(y) + 0.005 * noise(th, ph); break;
      case 'curlyShort': t = 0.015 + 0.007 * top(y) + 0.004 * noise(th * 1.7, ph * 1.7); break;
      case 'balding': t = 0.005; break;
      case 'bun': case 'ponytail': t = 0.005 + 0.004 * top(y); break;
      case 'bob': t = 0.01 + 0.006 * top(y); break;
      case 'curlyShoulder': t = 0.02 + 0.008 * top(y) + 0.005 * noise(th * 1.5, ph * 1.5); break;
      default: t = 0.008 + 0.009 * top(y) + 0.004 * sm(th / 0.9) * top(y); // long / shoulder
    }
    return Math.max(0.0012, t * (0.25 + 0.75 * edge));
  };
  const hatTop = app.clothes.hat && app.clothes.hat !== 'seedcap' ? 0.6 : 1;
  return { hairline, thick, recede, hatTop, noise };
}

function buildHead(g, app, head, C, q, R, hm) {
  const f = app.body.face; const skin = app.skin; const hair = app.hair; const fem = app.sex === 'f';
  const nu = q === 2 ? R(44) : q === 1 ? 22 : 12, nv = q === 2 ? R(32) : q === 1 ? 16 : 9;
  const ths = [], phs = [];
  for (let i = 0; i <= nu; i++) { const s = (i / nu) * 2 - 1; ths.push(Math.PI * (0.45 * s + 0.55 * s * s * s)); }
  for (let j = 0; j <= nv; j++) { const t = 1 - (j / nv) * 2; phs.push((Math.PI / 2) * (0.62 * t + 0.38 * t * t * t)); }
  const old = app.age > 48; const stubble = app.facialHair === 'stubble' ? 0.2 : app.facialHair ? 0.1 : app.sex === 'm' && app.age > 22 ? 0.04 : 0;
  const jawW = (p) => sm((f.mouthY - 0.002 - p[1]) / 0.016) * sm((0.03 - p[2]) / 0.05);
  const skinAt = (p, th) => {
    let c = skin.slice();
    const front = sm((-p[2] / head.hd - 0.2) / 0.6);
    for (const s of [-1, 1]) { const ch = G(p[0] - s * 0.04, 0.018) * G(p[1] + 0.012, 0.016) * front; c = mix3(c, [c[0] * 1.02, c[1] * 0.9, c[2] * 0.88], ch * 0.55); }
    c = mix3(c, [c[0] * 1.02, c[1] * 0.9, c[2] * 0.88], G(p[0], 0.012) * G(p[1] - head.tipY, 0.01) * front * 0.4); // nose tip warmth
    for (const s of [-1, 1]) {
      c = mix3(c, mul3(c, 0.86), G(p[0] - s * f.eyeX, 0.016) * G(p[1] - 0.0, 0.006) * front * 0.6); // under-eye
      c = mul3(c, 1 - 0.2 * G(p[0] - s * f.eyeX, 0.019) * G(p[1] - (f.eyeY + 0.013), 0.007) * front);  // upper lid crease / socket
      c = mul3(c, 1 - 0.22 * G(p[0] - s * 0.017, 0.007) * G(p[1] - f.eyeY, 0.008) * front);             // inner eye corners
      c = mul3(c, 1 - 0.16 * G(p[0] - s * 0.013 * f.noseW, 0.0055) * G(p[1] - (head.tipY + 0.012), 0.014) * front); // sides of the nose
    }
    c = mul3(c, 1 - 0.24 * G(p[0], 0.011) * G(p[1] - (head.baseY - 0.003), 0.004) * front);   // under the nose
    c = mul3(c, 1 - 0.16 * G(p[0], 0.018) * G(p[1] - (f.mouthY - 0.013), 0.0045) * front);    // under the lower lip
    c = mul3(c, 1 - 0.28 * sm((-0.088 - p[1]) / 0.025) * sm((0.02 - p[2]) / 0.04));         // under the jaw
    c = mul3(c, 1 + 0.05 * G(p[0], 0.01) * G(p[1] - 0.0, 0.03) * front);                       // nose bridge highlight
    c = mul3(c, 0.9 + 0.1 * front);                                                             // soft falloff toward the sides
    for (const s of [-1, 1]) c = mul3(c, 1 - 0.3 * G(p[0] - s * 0.016 * f.noseW, 0.004) * G(p[1] - (head.baseY + 0.002), 0.004) * front); // alar crease / nostrils
    if (stubble) { const beard = sm((-0.02 - p[1] - Math.abs(p[0]) * 0.3) / 0.025) * sm((0.03 - p[2]) / 0.03) * (1 - G(p[0], f.mouthW * 1.1) * G(p[1] - f.mouthY, 0.008)); c = mix3(c, mul3(mix3(hair, [0.05, 0.04, 0.03], 0.4), 1), beard * stubble); }
    const hl = hm.hairline(th); const scalp = app.hairStyle === 'bald' ? 0 : sm((p[1] - hl + 0.006) / 0.012); // soft hairline: scalp tinted toward the hair
    if (scalp > 0 && app.hairStyle !== 'balding') c = mix3(c, mix3(hair, c, 0.35), scalp * 0.85);
    return c;
  };
  // ---- skin
  const base = g.n; const verts = [];
  // positions first, then normals from the grid neighbours (one surface evaluation per vertex)
  const PP = []; for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) PP.push(head.pt(ths[i], phs[j]));
  const at = (i, j) => PP[Math.max(0, Math.min(nv, j)) * (nu + 1) + ((i + nu) % nu)];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const th = ths[i], ph = phs[j]; const p = PP[j * (nu + 1) + i];
    let n;
    if (j === 0 || j === nv) n = [0, j === 0 ? 1 : -1, 0];
    else { const du = sub(at(i + 1, j), at(i - 1, j)), dv = sub(at(i, j + 1), at(i, j - 1)); n = norm(cross(dv, du)); if (dot(n, p) < 0) n = mul3(n, -1); }
    const uv = regionUV(old ? 'faceOld' : 'face', Math.min(1, Math.max(0, 0.5 + th / Math.PI)), Math.min(1, Math.max(0, 0.5 - ph / Math.PI)));
    const jw = jawW(p);
    g.v(add(C, p), n, uv, skinAt(p, th), W2(B.jaw, B.head, jw), SURF.skin); verts.push({ p, n, th, ph, jw });
  }
  const id = (i, j) => base + j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) g.quad(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1));
  // ---- hair cap (shell over the same parametrisation, feathered at the hairline)
  if (q >= 0) {
    const W = nu + 1; const tk = verts.map((V) => hm.thick(V.th, V.ph, V.p));
    g.maskedGrid(W, nv + 1, (i, j) => tk[j * W + i] > 0, (i, j) => {
      const V = verts[j * W + i]; let t = tk[j * W + i]; if (V.p[1] > 0.06) t *= hm.hatTop;
      const p = add(V.p, mul3(V.n, t + 0.0006));
      const shade = 0.82 + 0.18 * sm(V.p[1] / head.hh) + 0.05 * hm.noise(V.th * 2, V.ph * 2);
      const col = mix3(hair, mul3(hair, 1.25), app.gray > 0.2 && app.gray < 0.9 ? (hm.noise(V.th * 5, V.ph * 7) > 0.2 ? 0.6 : 0) : 0);
      return { p: add(C, p), n: V.n, uv: regionUV('hair', (V.th / (2 * Math.PI) + 0.5), Math.min(1, Math.max(0, 0.5 - V.ph / Math.PI))), c: mul3(col, shade), bw: W2(B.jaw, B.head, V.jw), s: SURF.hair };
    });
    // facial hair shells
    if (app.facialHair && app.facialHair !== 'stubble' && q >= 1) {
      const fh = []; const mY = f.mouthY, mw = f.mouthW; const kind = app.facialHair;
      for (const V of verts) {
        const [x, y, z] = V.p; const ax = Math.abs(x); const front = sm((0.02 - z) / 0.02);
        const hole = 1 - (1 - sm((ax - mw * 1.02) / 0.004)) * (1 - sm((Math.abs(y - mY) - 0.0065) / 0.003));
        const must = sm((mw * 1.3 - ax) / 0.005) * sm((y - (mY + 0.003)) / 0.003) * sm((mY + 0.019 - y) / 0.003) * front;
        const chin = sm((0.026 - ax) / 0.006) * sm((mY - 0.006 - y) / 0.004) * sm((y + 0.135) / 0.01) * front;
        const beard = sm((-0.016 - ax * 0.3 - y) / 0.012) * sm((y + 0.142) / 0.01) * sm((0.012 - z) / 0.02);
        fh.push(Math.min(1, (kind === 'mustache' ? must : kind === 'goatee' ? Math.max(must, chin) : Math.max(must, beard)) * hole));
      }
      const t = kind === 'beard' ? 0.0045 : 0.0038; const W = nu + 1;
      g.maskedGrid(W, nv + 1, (i, j) => fh[j * W + i] > 0.12, (i, j) => { const V = verts[j * W + i]; const w = fh[j * W + i]; return { p: add(C, add(V.p, mul3(V.n, 0.0008 + t * w))), n: V.n, uv: regionUV('hair', V.th / Math.PI * 0.5 + 0.5, 0.5 - V.ph / Math.PI), c: mul3(hair, 0.85 + 0.25 * hm.noise(V.th * 6, V.ph * 6)), bw: W2(B.jaw, B.head, V.jw), s: SURF.hair }; });
    }
    buildHairExtras(g, app, head, C, q, R, hm);
  }
  if (q === 0) return;
  // ---- ears
  for (const s of [-1, 1]) {
    const mb = new MeshBuilder(); const segs = q === 2 ? 12 : 6, rings = q === 2 ? 9 : 5; mb.sphere(0, 0, 0, 1, segs, rings);
    const gg = mb.build(); const es = f.ear;
    for (let v = 0; v < gg.positions.length / 3; v++) {
      let x = gg.positions[v * 3], y = gg.positions[v * 3 + 1], z = gg.positions[v * 3 + 2];
      const r2 = y * y + z * z; if (x > 0) x -= 0.55 * Math.max(0, 1 - r2 * 1.4); // cupped outer face
      y = y * 0.031 * es * (y > 0 ? 1.05 : 0.95); z = z * 0.019 * es; x = x * 0.009;
      gg.positions[v * 3] = x; gg.positions[v * 3 + 1] = y; gg.positions[v * 3 + 2] = z;
    }
    // recompute normals for the squashed ear
    gg.normals = earNormals(gg);
    const o = add(C, [s * (head.hw * 0.965), -0.006, 0.007]); const yaw = s * 0.32, tilt = 0.14;
    const X = [Math.cos(yaw) * s, 0, -Math.sin(yaw) * s]; const Y = norm([0, Math.cos(tilt), Math.sin(tilt)]); const Z = norm(cross(X, Y));
    const earC = mix3(skin, [skin[0] * 1.03, skin[1] * 0.86, skin[2] * 0.84], 0.5);
    g.addMB(gg, o, X, Y, Z.map((v) => v * s), { color: earC, region: 'skin', bw: W1(B.head), s: SURF.skin, colorFn: (p, c) => mix3(c, mul3(c, 0.7), Math.max(0, 1 - Math.hypot(p[1] - o[1], p[2] - o[2]) / 0.016) * (Math.abs(p[0]) < Math.abs(o[0]) + 0.004 ? 0.6 : 0)) });
  }
  // ---- eyes
  for (const s of [-1, 1]) buildEye(g, app, head, C, s, q);
  // ---- brows
  for (const s of [-1, 1]) {
    const bone = s < 0 ? B.browL : B.browR; const ns = q === 2 ? 10 : 5;
    const bc = mix3(app.gray > 0.6 ? mix3(app.hair, [0.22, 0.2, 0.18], 0.5) : app.hair, [0.02, 0.016, 0.012], app.gray > 0.6 ? 0.2 : 0.45);
    const rows = [];
    for (let i = 0; i <= ns; i++) {
      const t = i / ns; const x = s * (f.eyeX - 0.018 + t * 0.039); const yc = f.browY + 0.0045 * Math.sin(Math.PI * Math.pow(t, 0.75)) - 0.0015 * t;
      const h = (0.0078 - 0.0036 * t) * f.brows;
      const row = [];
      for (const [dy, off] of [[-h / 2, 0.0008], [0, 0.0022 * f.brows], [h / 2, 0.0008]]) { const sp = head.at(x, yc + dy); row.push({ p: add(C, add(sp.p, mul3(sp.n, off))), n: sp.n }); }
      rows.push(row);
    }
    const b0 = g.n;
    for (const row of rows) for (const v of row) g.v(v.p, v.n, regionUV('hair', 0.5, 0.5), bc, W1(bone), SURF.brow);
    for (let i = 0; i < ns; i++) for (let r = 0; r < 2; r++) g.quad(b0 + i * 3 + r, b0 + (i + 1) * 3 + r, b0 + (i + 1) * 3 + r + 1, b0 + i * 3 + r + 1);
  }
  // ---- lips, mouth, teeth
  buildMouth(g, app, head, C, q);
}

function earNormals(gg) {
  const P = gg.positions, I = gg.indices; const N = new Float32Array(P.length);
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
    const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]; const n = cross(u, v);
    for (const o of [a, b, c]) { N[o] += n[0]; N[o + 1] += n[1]; N[o + 2] += n[2]; }
  }
  for (let v = 0; v < N.length; v += 3) { const n = norm([N[v], N[v + 1], N[v + 2]]); const out = [P[v], P[v + 1], P[v + 2]]; const d = dot(n, out) < 0 ? -1 : 1; N[v] = n[0] * d; N[v + 1] = n[1] * d; N[v + 2] = n[2] * d; }
  return N;
}

function buildEye(g, app, head, C, s, q) {
  const f = app.body.face; const r = f.eyeR; const E = add(C, [s * f.eyeX, f.eyeY, f.eyeZ]); const bone = s < 0 ? B.eyeL : B.eyeR;
  const iris = f.eye; const sclera = [0.74, 0.7, 0.66];
  // rows by angle from the front axis, duplicated at colour edges for crisp pupil/iris boundaries
  const rows = q === 2
    ? [[0, 'p'], [0.17, 'p'], [0.19, 'i'], [0.3, 'i'], [0.42, 'i'], [0.49, 'l'], [0.52, 's'], [0.75, 's'], [1.1, 's'], [1.6, 's'], [Math.PI, 's']]
    : [[0, 'p'], [0.18, 'p'], [0.18, 'i'], [0.51, 'l'], [0.51, 's'], [1.2, 's'], [Math.PI, 's']];
  const nb = q === 2 ? 16 : 8; const base = g.n;
  rows.forEach(([a, kind], j) => {
    for (let i = 0; i <= nb; i++) {
      const b = (i / nb) * Math.PI * 2; const d = [Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), -Math.cos(a)];
      // a slightly bulged cornea over the iris
      const rr = r * (a < 0.52 ? 1 + 0.06 * Math.cos(a / 0.52 * Math.PI / 2) : 1);
      const streak = 0.85 + 0.3 * Math.abs(Math.sin(b * 7 + j));
      const col = kind === 'p' ? [0.012, 0.01, 0.01] : kind === 'i' ? mul3(iris, (0.7 + a * 1.1) * streak) : kind === 'l' ? mul3(iris, 0.35) : mix3(sclera, [0.82, 0.62, 0.58], sm((a - 1.0) / 0.9) * 0.5);
      g.v(add(E, mul3(d, rr)), d, regionUV('white', 0.5, 0.5), col, W1(bone), SURF.eye);
    }
  });
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nb; i++) { const a = base + j * (nb + 1) + i; g.quad(a, a + 1, a + nb + 2, a + nb + 1); }
  if (q < 2) return;
  // eyelids: spherical shells around the eyeball; the upper one rotates to blink
  const lidC = mix3(app.skin, [app.skin[0] * 0.95, app.skin[1] * 0.82, app.skin[2] * 0.8], 0.45);
  const lash = mix3(app.hair, [0.02, 0.015, 0.012], 0.7);
  const tilt = f.eyeTilt * s; const nh = 12;
  for (const upper of [true, false]) {
    const Rr = r * (upper ? 1.1 : 1.13); const rowsE = upper ? [0, 0.12, 0.35, 0.7, 1.15, 1.45] : [0, 0.12, 0.35, 0.75, 1.15];
    const lb = g.n;
    for (let j = 0; j <= rowsE.length; j++) for (let i = 0; i <= nh; i++) {
      const h = (i / nh - 0.5) * 2.6; const hn = h / 1.3;
      const edge = upper ? 0.33 - 0.3 * hn * hn + tilt * hn : -0.43 + 0.38 * hn * hn + tilt * hn;
      let p, n, col;
      if (j === 0) { // lash flap at the lid edge
        const e = edge; const d = [Math.sin(h) * Math.cos(e), Math.sin(e), -Math.cos(h) * Math.cos(e)];
        p = add(E, mul3(d, Rr + (upper ? 0.0032 : 0.0018) * f.lashes)); p[1] += upper ? 0.0012 * f.lashes : -0.0008; n = d; col = lash;
      } else {
        const e = upper ? edge + rowsE[j - 1] : edge - rowsE[j - 1]; const d = [Math.sin(h) * Math.cos(e), Math.sin(e), -Math.cos(h) * Math.cos(e)];
        p = add(E, mul3(d, Rr)); n = d; col = j === 1 ? mix3(lidC, lash, upper ? 0.75 : 0.4) : j === 3 && upper ? mul3(lidC, 0.86) : lidC;
      }
      g.v(p, n, regionUV('skin', 0.5, 0.5), col, W1(upper ? (s < 0 ? B.lidL : B.lidR) : B.head), SURF.skin);
    }
    for (let j = 0; j < rowsE.length; j++) for (let i = 0; i < nh; i++) { const a = lb + j * (nh + 1) + i; g.quad(a, a + 1, a + nh + 2, a + nh + 1); }
  }
}

function buildMouth(g, app, head, C, q) {
  const f = app.body.face; const mw = f.mouthW, mY = f.mouthY; const ns = q === 2 ? 14 : 6; const nr = q === 2 ? 8 : 5;
  const lipC = f.lipColor;
  for (const upper of [true, false]) {
    const base = g.n;
    for (let i = 0; i <= ns; i++) {
      const x = (i / ns * 2 - 1) * mw * 1.04; const u = Math.min(1, Math.abs(x) / mw); const env = Math.pow(Math.max(0, 1 - u * u), 0.55);
      const bow = upper ? 0.0011 * G(Math.abs(x) - 0.0055, 0.0035) - 0.0005 * G(x, 0.003) : 0;
      const ry = (upper ? 0.0027 : 0.0034) * f.lips * env + 0.0004, rz = ry * 1.25;
      const yc = mY + (upper ? 1 : -1) * (ry * 0.95) + bow;
      const sp = head.at(x * 0.98, yc); const zc = sp.p[2] - 0.0012 - ry * 0.25;
      const side = x < 0 ? -1 : 1; const wc = 1 - sm((u - 0.45) / 0.55);
      const bw = W2(upper ? B.head : B.jaw, side < 0 ? B.mouthL : B.mouthR, wc);
      for (let k = 0; k <= nr; k++) {
        const c = (k / nr) * Math.PI * 2; // around the lip axis
        const d = [0, Math.sin(c), -Math.cos(c)];
        const p = [x, yc + ry * d[1], zc + rz * d[2]];
        const inner = upper ? d[1] < -0.3 : d[1] > 0.3; const hl = !upper && d[1] > -0.2 && d[2] < -0.5 ? 1.08 : 1;
        g.v(add(C, p), norm([0, d[1], d[2] * 0.9 + 0.1 * (-1)]), regionUV('white', 0.5, 0.5), inner ? mul3(lipC, 0.55) : mul3(lipC, hl), bw, SURF.lips);
      }
    }
    for (let i = 0; i < ns; i++) for (let k = 0; k < nr; k++) { const a = base + i * (nr + 1) + k; g.quad(a, a + nr + 1, a + nr + 2, a + 1); }
  }
  if (q < 2) return;
  // mouth interior (dark) and teeth, upper on the skull, lower on the jaw
  const mz = head.at(0, mY).p[2];
  { const mb = new MeshBuilder().sphere(0, 0, 0, 1, 12, 8); const gg = mb.build();
    for (let v = 0; v < gg.positions.length / 3; v++) { gg.positions[v * 3] *= mw * 0.92; gg.positions[v * 3 + 1] *= 0.01; gg.positions[v * 3 + 2] *= 0.011; }
    g.addMB(gg, add(C, [0, mY, mz + 0.011]), [1, 0, 0], [0, 1, 0], [0, 0, 1], { color: [0.16, 0.05, 0.05], region: 'white', s: SURF.mouth, bw: (p) => (p[1] < C[1] + mY ? W1(B.jaw) : W1(B.head)) }); }
  for (const upper of [true, false]) { // curved tooth rows with darker gaps between teeth
    const n = 14; const b0 = g.n;
    for (let i = 0; i <= n; i++) {
      const x = (i / n * 2 - 1) * 0.0175; const z = mz + 0.0042 + 0.07 * x * x / 0.0175; const gap = i % 2 === 0 && i > 0 && i < n ? 0.75 : 1;
      for (const yy of upper ? [0.0005, 0.0072] : [-0.0005, -0.006]) g.v(add(C, [x, mY + yy, z]), [0, 0, -1], regionUV('white', 0.5, 0.5), mul3([0.86, 0.84, 0.77], gap * (Math.abs(yy) > 0.004 ? 0.85 : 1)), W1(upper ? B.head : B.jaw), SURF.teeth);
    }
    for (let i = 0; i < n; i++) g.quad(b0 + i * 2, b0 + i * 2 + 1, b0 + i * 2 + 3, b0 + i * 2 + 2);
  }
}

function buildHairExtras(g, app, head, C, q, R, hm) {
  const st = app.hairStyle; const hair = app.hair; const hw = head.hw, hd = head.hd;
  const bwHC = (t) => W2(B.head, B.chest, 1 - sm((t - 0.3) / 0.45));
  if (['long', 'shoulder', 'curlyShoulder', 'bob'].includes(st)) {
    // curtain: from ear level down, open at the face, two-sided
    const len = st === 'bob' ? 0.1 : st === 'shoulder' || st === 'curlyShoulder' ? 0.19 : 0.27;
    const th0 = st === 'bob' ? 1.05 : 1.15; const nu = q === 2 ? R(22) : q === 1 ? 10 : 6, nv = q === 2 ? 8 : q === 1 ? 4 : 2;
    const yTop = 0.01; const curly = st === 'curlyShoulder'; const hh = head.hh;
    const memo = new Map(); const topRing = (th) => { let r = memo.get(th); if (r == null) { const t = head.atY(th, yTop); r = Math.hypot(t.p[0], t.p[2]) + Math.max(0.004, hm.thick(th, t.ph, t.p)) + 0.003; memo.set(th, r); } return r; };
    for (const inner of [false, true]) {
      g.grid(nu + 1, nv + 1, (i, j) => {
        const s = i / nu; let th = th0 + s * (2 * Math.PI - 2 * th0); if (th > Math.PI) th -= 2 * Math.PI;
        const f = j / nv; const L = len * (0.82 + 0.18 * Math.abs(Math.sin(th * 0.5))) * (1 + 0.06 * Math.sin(th * 13));
        // long hair migrates behind the shoulders as it falls
        let thE = th; if (len > 0.2) { const toBack = sm((f - 0.45) / 0.4); thE = th + Math.sign(th) * (Math.PI - Math.abs(th)) * toBack * 0.85; }
        const top = topRing(th); const r0 = top + (curly ? 0.012 : 0);
        const y = yTop - f * L;
        const ey = Math.max(-0.1, y) / hh; const rHead = Math.sqrt(Math.max(0.05, 1 - ey * ey)) * Math.hypot(Math.sin(thE) * hw, Math.cos(thE) * hd * (Math.cos(thE) > 0 ? 1 : 1.04)) + 0.008;
        let r = Math.max(r0 * (1 - 0.12 * sm(f * 2)), rHead) + 0.014 * f * f + (curly ? 0.012 * f : 0);
        if (y < -0.11) r = Math.max(r, 0.075);
        let x = Math.sin(thE) * r, z = -Math.cos(thE) * r;
        if (Math.abs(thE) > Math.PI / 2 && y < -0.1) z = Math.max(z, 0.085);
        const n = norm([Math.sin(thE), 0.15, -Math.cos(thE)]);
        const off = inner ? -0.004 : 0;
        return { p: add(C, [x + n[0] * off, y, z + n[2] * off]), n: inner ? mul3(n, -1) : n, uv: regionUV('hair', s, f), c: mul3(hair, inner ? 0.6 : 0.85 + 0.15 * (1 - f)), bw: bwHC(f), s: SURF.hair };
      });
    }
  }
  if (st === 'bun') {
    const mb = new MeshBuilder().sphere(0, 0, 0, 1, q === 2 ? 12 : 6, q === 2 ? 8 : 4); const gg = mb.build();
    for (let v = 0; v < gg.positions.length / 3; v++) { gg.positions[v * 3] *= 0.034; gg.positions[v * 3 + 1] *= 0.03; gg.positions[v * 3 + 2] *= 0.026; }
    g.addMB(gg, add(C, [0, -0.006, hd * 1.04 + 0.024]), [1, 0, 0], [0, 1, 0], [0, 0, 1], { color: mul3(hair, 0.9), region: 'hair', s: SURF.hair, bw: W1(B.head) });
  }
  if (st === 'ponytail') {
    const n = q === 2 ? 9 : 4, sides = q === 2 ? 8 : 5; const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([0, -0.004 - t * 0.2, hd * 1.04 + 0.016 + 0.035 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) - t * 0.01]); }
    tubeAlong(g, pts.map((p) => add(C, p)), (t) => 0.022 * (1 - t * 0.6) + 0.004, sides, (t) => mul3(hair, 0.88), SURF.hair, (t) => bwHC(t), 'hair');
    const mb = new MeshBuilder().cylinder(0, 0, 0, 0.012, 0.01, 8); g.addMB(mb, add(C, [0, -0.004, hd * 1.04 + 0.012]), [1, 0, 0], [0, 0, 1], [0, -1, 0], { color: [0.05, 0.05, 0.06], s: SURF.rubber, bw: W1(B.head) });
  }
}

// ---------------------------------------------------------------- torso & clothing on the torso
function garmentAt(app, body, y, a) {
  const cl = app.clothes; const H = body.H;
  if (y < body.beltY) return { col: cl.pants, region: cl.pantsRegion || 'pants', s: cl.pantsRegion === 'jeans' ? SURF.denim : SURF.poly, cloth: true };
  const neckTop = H * (cl.collar === 'crew' || cl.hood ? 0.862 : 0.853);
  if (y > neckTop) return { col: app.skin, region: 'skin', s: SURF.skin, cloth: false };
  // open uniform collar shows the dark crew-neck undershirt
  if (cl.collar === 'uniform' && !cl.tie && y > H * 0.832 && Math.abs(a) < 0.3 - (y / H - 0.832) * 3) return { col: [0.04, 0.045, 0.06], region: 'tee', s: SURF.cotton, cloth: true };
  if ((cl.collar === 'polo' || (cl.collar === 'dress' && !cl.tie)) && y > H * 0.83 && Math.abs(a) < 0.25 - (y / H - 0.83) * 2) return { col: app.skin, region: 'skin', s: SURF.skin, cloth: false };
  const plaid = /plaid/.test(cl.topRegion);
  return { col: cl.shirt, region: cl.topRegion, s: plaid || cl.top === 'tee' || cl.top === 'knit' ? SURF.cotton : SURF.poly, cloth: true };
}

function buildTorso(g, app, body, q, R, anchors) {
  const H = body.H; const nA = q === 2 ? R(24) : q === 1 ? 12 : 8;
  const ys = []; const base = TORSO.map((t) => t[0]);
  if (q === 2) { for (let i = 0; i < base.length - 1; i++) { ys.push(base[i]); ys.push((base[i] + base[i + 1]) / 2); } ys.push(base[base.length - 1]); }
  else if (q === 1) ys.push(...base); else ys.push(...base.filter((_, i) => i % 2 === 0 || i === base.length - 1));
  let Y = ys.map((v) => v * H);
  const splits = [body.beltY, H * (app.clothes.collar === 'crew' || app.clothes.hood ? 0.862 : 0.853)];
  for (const s of splits) { Y = Y.filter((y) => Math.abs(y - s) > 0.004); Y.push(s - 0.0001, s + 0.0001); }
  Y.sort((a, b) => a - b);
  const rows = Y.map((y) => {
    const out = [];
    for (let i = 0; i <= nA; i++) {
      const a = -Math.PI + (i / nA) * Math.PI * 2; const ga = garmentAt(app, body, y, a);
      const { p, n } = body.torsoN(a, y, ga.cloth ? 0.002 : 0);
      const u = 0.5 + a / (2 * Math.PI);
      const v = ga.region === 'skin' ? 0.5 : y < body.beltY ? Math.min(1, (body.beltY - y) / (H * 0.4)) * 0.3 : Math.min(1, Math.max(0, (H * 0.86 - y) / (H * 0.39)));
      let col = ga.col; if (y < H * 0.5) col = mul3(col, 0.82 + 0.18 * sm((y / H - 0.455) / 0.045)); // crotch AO
      out.push({ p, n, uv: regionUV(ga.region, u, v), c: col, bw: body.wT(y), s: ga.s });
    }
    return out;
  });
  const b0 = g.n; for (const row of rows) for (const v of row) g.v(v.p, v.n, v.uv, v.c, v.bw, v.s);
  const W = nA + 1;
  for (let j = 0; j < rows.length - 1; j++) { if (Math.abs(Y[j + 1] - Y[j]) < 0.001) continue; for (let i = 0; i < nA; i++) g.quad(b0 + j * W + i, b0 + j * W + i + 1, b0 + (j + 1) * W + i + 1, b0 + (j + 1) * W + i); }
  // bottom cap between the legs
  const cB = g.v([0, Y[0] - 0.005, 0], [0, -1, 0], regionUV('pants', 0.5, 0.5), mul3(app.clothes.pants, 0.6), W1(B.pelvis), SURF.poly);
  for (let i = 0; i < nA; i++) g.tri(cB, b0 + i + 1, b0 + i);
  void anchors;
}

/** Thin tube along a polyline (cords, lanyards, ponytails, glasses frames). */
function tubeAlong(g, pts, radiusFn, sides, colFn, surf, bwFn, region = 'white') {
  const n = pts.length; const base = g.n;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); const pPrev = pts[Math.max(0, i - 1)], pNext = pts[Math.min(n - 1, i + 1)];
    const T = norm(sub(pNext, pPrev)); let U = Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const S = norm(cross(T, U)); U = cross(S, T);
    const r = radiusFn(t);
    for (let k = 0; k <= sides; k++) { const a = (k / sides) * Math.PI * 2; const d = add(mul3(S, Math.cos(a)), mul3(U, Math.sin(a))); g.v(add(pts[i], mul3(d, r)), d, regionUV(region, k / sides, t), colFn(t), bwFn(t, pts[i]), surf); }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) { const a = base + i * (sides + 1) + k; g.quad(a, a + 1, a + sides + 2, a + sides + 1); }
}

/** A patch of the torso surface (a ∈ [a0,a1], y ∈ [y0,y1]) lifted by `off`: epaulets, pockets, panels. */
function torsoPatch(g, body, a0, a1, y0, y1, off, nA, nY, { color, region, uvRect, s, flipU }) {
  g.grid(nA + 1, nY + 1, (i, j) => {
    const a = lerp(a0, a1, i / nA), y = lerp(y1, y0, j / nY); const { p, n } = body.torsoN(a, y, off);
    const u = flipU ? 1 - i / nA : i / nA; const uv = uvRect ? [lerp(uvRect[0], uvRect[2], u), lerp(uvRect[1], uvRect[3], j / nY)] : regionUV(region || 'white', u, j / nY);
    return { p, n, uv, c: typeof color === 'function' ? color(i / nA, j / nY) : color, bw: body.wT(y), s };
  });
}
const RG = (name) => { const r = REGION_CACHE[name] || (REGION_CACHE[name] = [regionUV(name, 0, 0), regionUV(name, 1, 1)]); return [r[0][0], r[0][1], r[1][0], r[1][1]]; };
const REGION_CACHE = {};

/** Frame on the torso surface: origin, X (tangent, toward +a), Y (up), Z (outward normal). */
function torsoFrame(body, a, y, off) {
  const { p, n } = body.torsoN(a, y, off); const Z = n; let Y = [0, 1, 0]; Y = norm(sub(Y, mul3(Z, dot(Y, Z)))); const X = cross(Y, Z);
  return { o: p, X, Y, Z };
}

/** A flat polygon plate (badge) with a front face mapped to an atlas region. */
function plate(g, fr, poly, w, h, depth, region, color, surf, bw) {
  const base = g.n; const cx = 0, cy = 0;
  const P = (x, y, z) => add(fr.o, add(add(mul3(fr.X, x), mul3(fr.Y, y)), mul3(fr.Z, z)));
  const uvOf = (x, y) => regionUV(region, 0.5 + x / w, 0.5 - y / h);
  const c0 = g.v(P(cx, cy, depth), fr.Z, uvOf(0, 0), color, bw, surf);
  const ring = poly.map(([x, y]) => g.v(P(x, y, depth), fr.Z, uvOf(x, y), color, bw, surf));
  for (let i = 0; i < ring.length; i++) g.tri(c0, ring[i], ring[(i + 1) % ring.length]);
  // side walls
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; const nrm = norm(add(mul3(fr.X, y1 - y0), mul3(fr.Y, -(x1 - x0))));
    const a = g.v(P(x0, y0, depth), nrm, uvOf(x0, y0), mul3(color, 0.8), bw, surf), b = g.v(P(x1, y1, depth), nrm, uvOf(x1, y1), mul3(color, 0.8), bw, surf);
    const c = g.v(P(x1, y1, 0), nrm, uvOf(x1, y1), mul3(color, 0.6), bw, surf), d = g.v(P(x0, y0, 0), nrm, uvOf(x0, y0), mul3(color, 0.6), bw, surf);
    g.quad(a, b, c, d);
  }
  void base;
}
function shieldPoly(w, h) { const pts = []; const n = 18; for (let i = 0; i < n; i++) { const t = i / n; const a = t * Math.PI * 2; let x = Math.sin(a) * w / 2, y = Math.cos(a) * h / 2; if (y > 0) { y = h / 2 * (0.82 + 0.18 * Math.cos(x / (w / 2) * Math.PI)); x *= 1.0; } else { x *= 1 - 0.35 * Math.pow(-y / (h / 2), 2); } pts.push([x, y]); } return pts; }
function starPoly(n, R1, r1) { const pts = []; for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * Math.PI * 2; const rr = k % 2 ? r1 : R1; pts.push([Math.sin(a) * rr, Math.cos(a) * rr]); } return pts; }
function rectPoly(w, h) { return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]; }

function partAt(g, fr, mb, opts) { g.addMB(mb, fr.o, fr.X, fr.Y, fr.Z, opts); }

function buildClothingDetails(g, app, body, sk, q, R, anchors, gear) {
  const cl = app.clothes; const H = body.H;
  const metal = cl.badge ? METAL[cl.badge.metal] : METAL.silver;
  // ---- collar
  if (q >= 1 && (cl.collar === 'uniform' || cl.collar === 'dress' || cl.collar === 'polo')) {
    const y0 = H * 0.849; const nA = q === 2 ? 22 : 10; const open = cl.tie ? 0.06 : cl.collar === 'polo' ? 0.2 : 0.3; const col = cl.shirt;
    const surf = cl.collar === 'polo' ? SURF.cotton : SURF.poly; const hgt = cl.collar === 'polo' ? 0.024 : 0.03;
    for (const inner of [false, true]) g.grid(nA + 1, 3, (i, j) => {
      const a = open + (i / nA) * (2 * Math.PI - 2 * open); const aa = a > Math.PI ? a - 2 * Math.PI : a;
      const frontness = Math.max(0, Math.cos(aa)); const y = y0 + [0, 0.55, 1][j] * hgt * (1 - 0.45 * frontness);
      const { p, n } = body.torsoN(aa, y, 0.0035 + [0, 0.0015, 0.004][j] + (inner ? -0.0015 : 0));
      return { p, n: inner ? mul3(n, -1) : n, uv: regionUV('tee', i / nA, j / 2), c: mul3(col, inner ? 0.7 : j === 2 ? 1 : 0.94), bw: body.wT(y), s: surf };
    });
    // small collar points lying on the chest
    if (cl.collar !== 'polo') for (const s of [-1, 1]) {
      const pts = [[s * (open + 0.01), H * 0.851], [s * (open + 0.2), H * 0.85], [s * (open + 0.05), H * 0.828]].map(([a, y]) => body.torsoN(a, y, 0.0055));
      const c = mul3(col, 0.97); const bw = body.wT(H * 0.84);
      g.tri(g.v(pts[0].p, pts[0].n, regionUV('tee', 0.5, 0.5), c, bw, surf), g.v(pts[1].p, pts[1].n, regionUV('tee', 0.6, 0.5), c, bw, surf), g.v(pts[2].p, pts[2].n, regionUV('tee', 0.5, 0.6), c, bw, surf));
    }
  } else if (q >= 1 && cl.collar === 'crew') {
    const y0 = H * 0.86; const nA = q === 2 ? 22 : 10;
    g.grid(nA + 1, 2, (i, j) => { const a = -Math.PI + (i / nA) * Math.PI * 2; const { p, n } = body.torsoN(a, y0 - j * 0.008, 0.004); return { p, n, uv: regionUV('knit', i / nA, j), c: mul3(cl.shirt, 0.9), bw: body.wT(y0), s: SURF.cotton }; }, { wrapU: false });
  }
  if (q >= 1 && cl.hood) { // bunched hood behind the neck
    const mb = new MeshBuilder().sphere(0, 0, 0, 1, q === 2 ? 14 : 8, 6); const gg = mb.build();
    for (let v = 0; v < gg.positions.length / 3; v++) { gg.positions[v * 3] *= 0.1; gg.positions[v * 3 + 1] *= 0.04; gg.positions[v * 3 + 2] *= 0.05; }
    const fr = torsoFrame(body, Math.PI, H * 0.85, 0.02); partAt(g, fr, gg, { color: cl.shirt, region: 'hoodie', s: SURF.cotton, bw: body.wT(H * 0.85) });
    for (const s of [-1, 1]) { const top = body.torsoN(s * 0.22, H * 0.845, 0.006).p, bot = body.torsoN(s * 0.2, H * 0.74, 0.006).p; tubeAlong(g, [top, mix3(top, bot, 0.5), bot], () => 0.003, 4, () => [0.85, 0.85, 0.85], SURF.cotton, () => body.wT(H * 0.8)); }
  }
  // ---- tie
  if (cl.tie && q >= 1) {
    const n = q === 2 ? 10 : 4; const rows = [];
    for (let i = 0; i <= n; i++) { const t = i / n; const y = lerp(H * 0.838, H * 0.6, t); const wdt = lerp(0.032, 0.078, t) / 2; const off = 0.006 + 0.004 * Math.sin(t * Math.PI);
      const row = [-1, 0, 1].map((u) => { const a = (u * wdt) / (body.torsoN(0, y).p[2] * -1 || 0.1); const { p, n: nn } = body.torsoN(a, y, off + (u === 0 ? 0.002 : 0)); return { p, n: nn }; });
      if (i === n) { row[0] = row[1]; row[2] = row[1]; row[1] = { ...row[1], p: add(row[1].p, [0, -0.025, 0]) }; }
      rows.push({ row, y }); }
    const b0 = g.n;
    for (const { row, y } of rows) for (const v of row) g.v(v.p, v.n, regionUV('knit', 0.5, 0.5), cl.tie, body.wT(y), SURF.poly);
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) g.quad(b0 + i * 3 + k, b0 + i * 3 + k + 1, b0 + (i + 1) * 3 + k + 1, b0 + (i + 1) * 3 + k);
    const kn = torsoFrame(body, 0, H * 0.845, 0.012); partAt(g, kn, RB(0, 0, 0, 0.034, 0.03, 0.016, { r: 0.007, seg: 1, uv: 0 }), { color: mul3(cl.tie, 0.9), s: SURF.poly, bw: body.wT(H * 0.845) });
  }
  // ---- jacket shell (open front) over the torso
  if (cl.jacket && q >= 0) {
    const nA = q === 2 ? R(26) : q === 1 ? 12 : 8; const ys = [0.47, 0.5, 0.55, 0.6, 0.66, 0.72, 0.77, 0.8, 0.825, 0.845, 0.86].map((v) => v * H);
    const open = (y) => lerp(0.42, 0.16, sm((y / H - 0.5) / 0.32)) * (cl.jacketKnit ? 0.8 : 1);
    const reg = cl.jacketRegion || 'tee'; const surf = reg === 'canvasWork' ? SURF.cotton : SURF.poly;
    for (const inner of [false, true]) {
      g.grid(nA + 1, ys.length, (i, j) => {
        const y = ys[ys.length - 1 - j]; const o = open(y); const a = o + (i / nA) * (2 * Math.PI - 2 * o); const aa = a > Math.PI ? a - 2 * Math.PI : a;
        const lift = 0.011 + 0.006 * sm((0.55 - y / H) / 0.06) - 0.003 * sm((y / H - 0.78) / 0.04) + (y > H * 0.845 ? 0.004 : 0);
        const { p, n } = body.torsoN(aa, y, lift + (inner ? -0.003 : 0));
        return { p, n: inner ? mul3(n, -1) : n, uv: regionUV(reg, i / nA, j / (ys.length - 1)), c: inner ? mul3(cl.jacket, 0.5) : cl.jacket, bw: body.wT(y), s: surf };
      });
    }
    // lapels
    if (q >= 1 && !cl.jacketKnit) for (const s of [-1, 1]) {
      const pts = [[s * open(H * 0.84), H * 0.84], [s * (open(H * 0.84) + 0.38), H * 0.835], [s * open(H * 0.68), H * 0.68]].map(([a, y]) => body.torsoN(a, y, 0.019));
      const bw = body.wT(H * 0.76); const c = mul3(cl.jacket, 1.05);
      g.tri(g.v(pts[0].p, pts[0].n, regionUV(reg, 0.5, 0.5), c, bw, surf), g.v(pts[1].p, pts[1].n, regionUV(reg, 0.6, 0.5), c, bw, surf), g.v(pts[2].p, pts[2].n, regionUV(reg, 0.5, 0.6), c, bw, surf));
    }
  }
  if (q === 0) return;
  // ---- epaulets
  if (cl.epaulets) for (const s of [-1, 1]) {
    torsoPatch(g, body, s * Math.PI / 2 - 0.22, s * Math.PI / 2 + 0.22, H * 0.812, H * 0.849, 0.006, 3, q === 2 ? 4 : 2, { color: mul3(cl.shirt, 0.95), region: 'shirtUniform', s: SURF.poly });
    if (q === 2) { const fr = torsoFrame(body, s * Math.PI / 2, H * 0.846, 0.009); partAt(g, fr, new MeshBuilder().cylinder(0, 0, 0, 0.0055, 0.003, 8), { color: cl.badge ? metal : mul3(cl.shirt, 0.8), s: SURF.metal, bw: body.wT(H * 0.846) }); }
  }
  // ---- badge, nameplate, flag pin, body camera, shoulder mic, logo, lanyard, stethoscope
  const chestY = H * 0.786; const aPocket = 0.7;
  if (cl.badge && !cl.badgeOnBelt) {
    const fr = torsoFrame(body, -aPocket, chestY + 0.012, 0.004); const bw = body.wT(chestY + 0.012);
    const sh = cl.badge.shape; const region = sh === 'star' ? 'badgeSO' : sh === 'maltese' ? 'badgeFire' : sh === 'ems' ? 'badgeEMS' : sh === 'flat' ? 'badgeFlat' : 'badgePD';
    const poly = sh === 'star' ? starPoly(7, 0.034, 0.018) : sh === 'shield' ? shieldPoly(0.052, 0.064) : sh === 'maltese' ? starPoly(4, 0.03, 0.014) : sh === 'ems' ? starPoly(6, 0.03, 0.019) : rectPoly(0.05, 0.036);
    const w = sh === 'star' ? 0.072 : sh === 'shield' ? 0.06 : sh === 'flat' ? 0.05 : 0.064, hgt = sh === 'star' ? 0.072 : sh === 'shield' ? 0.068 : sh === 'flat' ? 0.036 : 0.064;
    plate(g, fr, poly, w, hgt, 0.004, region, metal, SURF.metal, bw);
    anchors.push({ name: 'badge', p: add(fr.o, mul3(fr.Z, 0.004)), bw, surf: body.torsoN(-aPocket, chestY + 0.012, 0).p, sbw: bw });
    gear.push('badge');
  }
  if (cl.nameplate) {
    const fr = torsoFrame(body, aPocket, chestY + 0.016, 0.004); plate(g, fr, rectPoly(0.066, 0.015), 0.066, 0.015, 0.003, 'nameplate', metal, SURF.metal, body.wT(chestY));
    gear.push('nameplate');
    if (cl.flagPin) { const fp = torsoFrame(body, aPocket, chestY + 0.036, 0.004); plate(g, fp, rectPoly(0.026, 0.015), 0.026, 0.015, 0.002, 'flag', [1, 1, 1], SURF.patch, body.wT(chestY)); }
  }
  if (cl.bodyCam) {
    const y = H * 0.752; const fr = torsoFrame(body, 0, y, 0.004); const bw = body.wT(y);
    const mb = new MeshBuilder(); mb.rbox(0, 0, 0.013, 0.056, 0.084, 0.026, { r: 0.006, seg: 1, uv: 0 });
    partAt(g, fr, mb, { color: [0.11, 0.11, 0.12], region: 'leather', s: SURF.plastic, bw });
    const face = { o: add(fr.o, mul3(fr.Z, 0.0262)), X: fr.X, Y: fr.Y, Z: fr.Z }; plate(g, face, rectPoly(0.05, 0.078), 0.05, 0.078, 0.0012, 'bodycam', [1, 1, 1], SURF.lens, bw);
    partAt(g, fr, new MeshBuilder().box(0, 0.038, 0.004, 0.03, 0.02, 0.006), { color: [0.07, 0.07, 0.08], s: SURF.plastic, bw }); // mount clip
    anchors.push({ name: 'bodyCam', p: add(fr.o, mul3(fr.Z, 0.026)), bw, surf: body.torsoN(0, y, 0).p, sbw: bw });
    gear.push('bodyCam');
  }
  if (cl.shoulderMic) {
    const a = -0.95, y = H * 0.812; const fr = torsoFrame(body, a, y, 0.006); const bw = body.wT(y);
    partAt(g, fr, RB(0, 0, 0.012, 0.036, 0.058, 0.024, { r: 0.006, seg: 1, uv: 0 }), { color: [0.06, 0.06, 0.07], region: 'leather', s: SURF.plastic, bw });
    if (q === 2) { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; const aa = lerp(a - 0.05, -1.45, t), yy = lerp(y - 0.035, body.beltY + 0.04, t); const off = 0.008 + 0.0025 * Math.sin(t * 40); pts.push({ p: body.torsoN(aa, yy, off).p, y: yy }); }
      tubeAlong(g, pts.map((x) => x.p), () => 0.0028, 5, () => [0.03, 0.03, 0.035], SURF.rubber, (t) => body.wT(lerp(y, body.beltY, t))); }
    gear.push('shoulderMic');
  }
  if (cl.logo) { const fr = torsoFrame(body, -0.62, H * 0.79, 0.003); plate(g, fr, rectPoly(0.05, 0.026), 0.05, 0.026, 0.001, 'patch911', [1, 1, 1], SURF.patch, body.wT(H * 0.79)); }
  if (cl.collarBrass && q === 2) for (const s of [-1, 1]) {
    const fr = torsoFrame(body, s * 0.42, H * 0.846, 0.012); const gold = METAL.gold; const bw = body.wT(H * 0.846);
    if (cl.collarBrass === 'stars') for (let k = 0; k < (app.id === 'pdchief' || app.id === 'sheriff' ? 3 : 2); k++) { const f2 = { ...fr, o: add(fr.o, mul3(fr.X, (k - 0.5) * 0.012 * s)) }; plate(g, f2, starPoly(5, 0.006, 0.0026), 0.012, 0.012, 0.0015, 'metal', gold, SURF.metal, bw); }
    else plate(g, fr, rectPoly(cl.collarBrass === 'bars' ? 0.018 : 0.012, 0.006), 0.02, 0.02, 0.0015, 'metal', cl.collarBrass.startsWith('bugles') ? gold : METAL.silver, SURF.metal, bw);
  }
  if (cl.lanyard && !cl.jacket) {
    const strap = []; const col = [0.08, 0.16, 0.38];
    const pathPts = [[-0.32, 0.705], [-0.55, 0.75], [-0.85, 0.81], [-1.25, 0.852], [-1.9, 0.862], [-2.6, 0.862], [Math.PI, 0.862], [2.6, 0.862], [1.9, 0.862], [1.25, 0.852], [0.85, 0.81], [0.55, 0.75], [0.32, 0.705]];
    for (const [a, yy] of pathPts) strap.push(body.torsoN(a, H * yy, 0.006).p);
    tubeAlong(g, strap, () => 0.0035, 4, () => col, SURF.cotton, (t) => body.wT(H * pathPts[Math.round(t * (pathPts.length - 1))][1]));
    const fr = torsoFrame(body, 0, H * 0.672, 0.008); plate(g, fr, rectPoly(0.052, 0.082), 0.052, 0.082, 0.002, 'idCard', [1, 1, 1], SURF.plastic, body.wT(H * 0.672));
    gear.push('lanyard');
  }
  if (cl.stethoscope && q === 2) {
    const pathPts = [[-0.5, 0.7], [-0.65, 0.76], [-0.95, 0.83], [-1.4, 0.856], [-2.2, 0.866], [Math.PI, 0.868], [2.2, 0.866], [1.4, 0.856], [0.95, 0.83], [0.6, 0.76], [0.45, 0.71]];
    tubeAlong(g, pathPts.map(([a, yy]) => body.torsoN(a, H * yy, 0.008).p), () => 0.0042, 6, () => [0.05, 0.05, 0.06], SURF.rubber, (t) => body.wT(H * pathPts[Math.round(t * (pathPts.length - 1))][1]));
    const fr = torsoFrame(body, -0.5, H * 0.695, 0.014); partAt(g, fr, new MeshBuilder().cylinder(0, 0, 0, 0.016, 0.008, 12), { color: METAL.silver, s: SURF.metal, bw: body.wT(H * 0.7) });
    gear.push('stethoscope');
  }
  // ---- sleeve patches and chevrons (on the upper arm surface)
  if (cl.patches || cl.chevrons) for (const s of [-1, 1]) {
    const lat = s * Math.PI / 2; const arm = body.arm;
    const patchAt = (a0, a1, t0, t1, rect, color, surf) => g.grid(5, 6, (i, j) => {
      const a = lerp(a0, a1, i / 4), t = lerp(t0, t1, j / 5); const { p, n } = body.limbN(arm, s, a, t, 0.0055);
      const u = s > 0 ? i / 4 : 1 - i / 4; return { p, n, uv: [lerp(rect[0], rect[2], u), lerp(rect[1], rect[3], j / 5)], c: color, bw: body.wArm(s, t), s: surf };
    });
    if (cl.patches) { patchAt(lat - s * 0.75, lat + s * 0.75, body.H * 0.035, body.H * 0.092, RG(cl.patches), [1, 1, 1], SURF.patch); gear.push('patches'); }
    if (cl.chevrons) {
      for (let c = 0; c < 3; c++) {
        const t0 = body.H * (0.108 + c * 0.012);
        for (const side of [-1, 1]) {
          const pts = []; for (let i = 0; i <= 4; i++) { const u = i / 4; const a = lat + side * u * 0.8; const t = t0 + u * body.H * 0.018; pts.push(body.limbN(arm, s, a, t, 0.006).p); }
          tubeAlong(g, pts, () => 0.0028, 4, () => METAL.gold, SURF.patch, (t) => body.wArm(s, t0 + t * body.H * 0.018));
        }
      }
      gear.push('chevrons');
    }
  }
  if (cl.injured) { // bandaged forearm
    const s = -1; const t0 = body.H * 0.235, t1 = body.H * 0.29;
    g.grid(11, 4, (i, j) => { const a = (i / 10) * Math.PI * 2; const t = lerp(t0, t1, j / 3); const { p, n } = body.limbN(body.arm, s, a, t, 0.007); return { p, n, uv: regionUV('knit', i / 10, j / 3), c: [0.9, 0.9, 0.88], bw: body.wArm(s, t), s: SURF.cotton }; });
  }
  if (cl.watch && q === 2) {
    const s = -1; const t = body.H * 0.312;
    g.grid(13, 2, (i, j) => { const a = (i / 12) * Math.PI * 2; const tt = t + j * 0.014; const { p, n } = body.limbN(body.arm, s, a, tt, 0.004); return { p, n, uv: regionUV('leather', i / 12, j), c: app.clothes.dutyBelt ? [0.05, 0.05, 0.05] : [0.22, 0.14, 0.08], bw: body.wArm(s, tt), s: SURF.leather }; });
    const { p, n } = body.limbN(body.arm, s, s * Math.PI / 2, t + 0.007, 0.007); let Y = [0, -1, 0]; Y = norm(sub(Y, mul3(n, dot(Y, n)))); const X = cross(Y, n);
    partAt(g, { o: p, X, Y, Z: n }, new MeshBuilder().cylinder(0, 0, 0, 0.016, 0.006, 12), { color: METAL.silver, s: SURF.metal, bw: body.wArm(s, t) });
  }
}

// ---------------------------------------------------------------- limbs
function buildArm(g, app, body, sk, s, q, R) {
  const H = body.H; const cl = app.clothes; const nA = q === 2 ? R(16) : q === 1 ? 8 : 6;
  const sleeveEnd = cl.jacket ? H * 0.315 : cl.sleeves === 'short' ? H * 0.115 : H * 0.322;
  let ts = (q === 2 ? ARM.map((r) => r[0]).concat([0.0, 0.04, 0.08, 0.12, 0.165, 0.195, 0.222, 0.265, 0.31]) : q === 1 ? ARM.map((r) => r[0]) : [ARM[0][0], 0.02, 0.1, 0.186, 0.25, 0.334]).map((v) => v * H);
  ts = ts.filter((t) => Math.abs(t - sleeveEnd) > 0.006); ts.push(sleeveEnd - 0.0001, sleeveEnd + 0.0001); ts.sort((a, b) => a - b);
  const sleeveCol = cl.jacket || cl.shirt; const sleeveReg = cl.jacket ? (cl.jacketRegion || 'tee') : cl.topRegion;
  const rect = RG(sleeveReg); const sr = [lerp(rect[0], rect[2], 0.02), lerp(rect[1], rect[3], 0.15), lerp(rect[0], rect[2], 0.22), lerp(rect[1], rect[3], 0.95)];
  const top = body.limbN(body.arm, s, 0, ts[0]).p; const piv = sk.P[s < 0 ? B.armL : B.armR];
  const capI = g.v([piv[0], top[1] + 0.012, piv[2]], [0, 1, 0], regionUV(cl.topRegion, 0.1, 0.2), cl.jacket || cl.shirt, body.wArm(s, ts[0]), SURF.poly);
  const armBase = g.n;
  g.grid(nA + 1, ts.length, (i, j) => {
    const t = ts[j]; const a = -Math.PI + (i / nA) * Math.PI * 2; const clothed = t < sleeveEnd;
    const extra = clothed ? 0.003 + (cl.jacket ? 0.006 : 0) + (t > sleeveEnd - 0.012 && t < sleeveEnd ? 0.002 : 0) : 0;
    const { p, n } = body.limbN(body.arm, s, a, t, extra);
    const u = i / nA; const uv = clothed ? [lerp(sr[0], sr[2], u), lerp(sr[1], sr[3], Math.min(1, t / (H * 0.33)))] : regionUV('skin', u, t / (H * 0.33));
    let c = clothed ? sleeveCol : app.skin; if (clothed && cl.jacket && t > sleeveEnd - 0.006) c = cl.shirt;
    return { p, n, uv, c, bw: body.wArm(s, t), s: clothed ? (/plaid|tee|knit|hoodie/.test(sleeveReg) ? SURF.cotton : SURF.poly) : SURF.skin };
  });
  for (let i = 0; i < nA; i++) g.tri(capI, armBase + i, armBase + i + 1);
}

function buildHand(g, app, sk, s, q, R) {
  const hb = s < 0 ? B.handL : B.handR; const W = sk.P[hb]; const k = app.body.H / 1.78 * (app.sex === 'f' ? 0.84 : 0.92); const skin = app.skin; const bw = W1(hb);
  const inward = -s; // palm faces the body
  // hand frame: X = inward (palm normal), Y = up along the arm, Z = back (thumb points -Z)
  const X = [inward, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const o = W;
  if (q === 0) { g.addMB(RB(0, -0.07 * k, 0, 0.03 * k, 0.15 * k, 0.07 * k, { r: 0.012, seg: 1, uv: 0 }), o, X, Y, Z, { color: skin, region: 'skin', s: SURF.skin, bw }); return; }
  const palm = new MeshBuilder().rbox(0.0, -0.046 * k, 0, 0.027 * k, 0.088 * k, 0.078 * k, { r: 0.011 * k, seg: 1, uv: 0 });
  g.addMB(palm, o, X, Y, Z, { color: skin, region: 'skin', s: SURF.skin, bw });
  if (q === 1) { g.addMB(RB(0.006 * k, -0.115 * k, 0.002, 0.022 * k, 0.07 * k, 0.074 * k, { r: 0.01 * k, seg: 1, uv: 0 }), o, X, Y, Z, { color: skin, region: 'skin', s: SURF.skin, bw }); return; }
  const fingers = [[-0.027, 0.95], [-0.009, 1.0], [0.009, 0.96], [0.026, 0.78]];
  for (const [fz, fl] of fingers) {
    const segs = [0.04, 0.025, 0.021].map((l) => l * fl * k); const curl = [0.32, 0.5, 0.36];
    let p = [0.0, -0.088 * k, fz * k]; let ang = 0; const pts = [p];
    segs.forEach((l, i) => { ang += curl[i]; p = [p[0] + Math.sin(ang) * l, p[1] - Math.cos(ang) * l, p[2]]; pts.push(p); });
    const wp = pts.map((pp) => add(o, [X[0] * pp[0], pp[1], pp[2]]));
    const last = wp[wp.length - 1], prev = wp[wp.length - 2]; wp.push(add(last, mul3(norm(sub(last, prev)), 0.005 * k)));
    tubeAlong(g, wp, (t) => (t > 0.99 ? 0.0025 : 0.0088 - 0.002 * t) * k, 5, () => skin, SURF.skin, () => bw, 'skin');
  }
  // thumb: from the palm's front edge, angled forward and toward the palm side
  const tp = [[0.006 * k, -0.028 * k, -0.034 * k], [0.016 * k, -0.06 * k, -0.05 * k], [0.022 * k, -0.084 * k, -0.054 * k]];
  const tw = tp.map((pp) => add(o, [X[0] * pp[0], pp[1], pp[2]]));
  tw.push(add(tw[2], mul3(norm(sub(tw[2], tw[1])), 0.006 * k)));
  tubeAlong(g, tw, (t) => (t > 0.99 ? 0.003 : 0.011 - 0.003 * t) * k, 5, () => skin, SURF.skin, () => bw, 'skin');
}

function buildLeg(g, app, body, sk, s, q, R) {
  const H = body.H; const cl = app.clothes; const nA = q === 2 ? R(16) : q === 1 ? 10 : 6;
  const ts = (q === 2 ? LEG.map((r) => r[0]).concat([0.065, 0.135, 0.2, 0.285, 0.335, 0.39, 0.445]).sort((a, b) => a - b) : q === 1 ? LEG.map((r) => r[0]) : [LEG[0][0], 0.03, 0.17, 0.245, 0.36, 0.492]).map((v) => v * H);
  const reg = cl.pantsRegion || 'pants'; const surf = reg === 'jeans' ? SURF.denim : SURF.poly; const loose = reg === 'cargo' ? 0.012 : reg === 'jeans' ? 0.005 : 0.008;
  g.grid(nA + 1, ts.length, (i, j) => {
    const t = ts[j]; const a = -Math.PI + (i / nA) * Math.PI * 2; const hem = sm((t / H - 0.44) / 0.05);
    const { p, n } = body.limbN(body.leg, s, a, t, 0.003 + loose * (0.4 + 0.6 * sm((t / H - 0.15) / 0.2)) + hem * 0.008);
    const inner = Math.max(0, -Math.sin(a) * s); let c = mul3(cl.pants, 1 - inner * 0.12 * (1 - sm(t / H / 0.12)));
    return { p, n, uv: regionUV(reg, 0.5 + (a * s) / (2 * Math.PI), Math.min(1, t / (H * 0.5))), c, bw: body.wLeg(s, t), s: surf };
  });
}

function buildShoe(g, app, sk, s, q, R) {
  const fb = s < 0 ? B.footL : B.footR; const A = sk.P[fb]; const H = app.body.H; const k = H / 1.78 * (app.sex === 'f' ? 0.92 : 1);
  const kind = app.clothes.shoes; const col = app.clothes.shoeColor || BLACKISH; const bw = W1(fb);
  const boots = kind === 'boots' || kind === 'workboots';
  const surf = kind === 'sneaker' ? SURF.cotton : kind === 'workboots' ? SURF.leather : SURF.boot;
  const solCol = kind === 'sneaker' ? [0.88, 0.88, 0.86] : kind === 'workboots' ? [0.2, 0.13, 0.07] : [0.03, 0.03, 0.03];
  const floor = -A[1]; const L = 0.27 * k, heel = 0.05 * k;
  const st = [[0, 0.03], [0.08, 0.04], [0.25, 0.043], [0.45, 0.044], [0.65, 0.05], [0.82, 0.048], [0.93, 0.04], [1, 0.016]];
  const ht = boots ? [0.2, 0.2, 0.16, 0.095, 0.068, 0.055, 0.045, 0.03] : [0.105, 0.115, 0.1, 0.078, 0.062, 0.052, 0.042, 0.026];
  const nS = q === 2 ? R(14) : q === 1 ? 8 : 5; const stations = q === 0 ? [0, 2, 4, 6, 7] : st.map((_, i) => i);
  if (q >= 0) g.grid(nS + 1, stations.length, (i, j) => {
    const si = stations[j]; const [u, w0] = st[si]; const w = w0 * k; const top = ht[si] * k;
    const z = heel - u * L; const a = (i / nS) * Math.PI; // 0..π across the top arc from one side to the other
    const x = Math.cos(a) * w * (1 + 0.1 * Math.sin(a)); const y = floor + 0.022 * k + Math.sin(a) * (top - 0.022 * k);
    const n = norm([Math.cos(a), Math.sin(a) * 0.8 + (u > 0.9 ? 0.2 : 0), u > 0.9 ? -0.6 : u < 0.05 ? 0.6 : 0]);
    return { p: [A[0] + x, A[1] + y, A[2] + z], n, uv: regionUV('leather', i / nS, u), c: (kind === 'sneaker' && u > 0.25 && u < 0.7 && i > nS * 0.3 && i < nS * 0.7) ? mix3(col, [1, 1, 1], 0.25) : col, bw, s: surf };
  });
  // toe cap / heel closing fans
  const sole = RB(0, 0, 0, 0.1 * k, 0.024 * k, L + 0.01, { r: 0.01, seg: 1, uv: 0 });
  g.addMB(sole, [A[0], A[1] + floor + 0.012 * k, A[2] + heel - L / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1], { color: solCol, region: 'leather', s: SURF.rubber, bw });
  const toe = new MeshBuilder().sphere(0, 0, 0, 1, q === 2 ? 10 : 6, 5); const tg = toe.build();
  for (let v = 0; v < tg.positions.length / 3; v++) { tg.positions[v * 3] *= 0.047 * k; tg.positions[v * 3 + 1] *= 0.03 * k * (tg.positions[v * 3 + 1] > 0 ? 1 : 0.2); tg.positions[v * 3 + 2] *= 0.05 * k; }
  g.addMB(tg, [A[0], A[1] + floor + 0.024 * k, A[2] + heel - L * 0.84], [1, 0, 0], [0, 1, 0], [0, 0, 1], { color: col, region: 'leather', s: surf, bw });
  const hc = new MeshBuilder().sphere(0, 0, 0, 1, q === 2 ? 10 : 6, 5).build();
  for (let v = 0; v < hc.positions.length / 3; v++) { hc.positions[v * 3] *= 0.034 * k; hc.positions[v * 3 + 1] *= (boots ? 0.1 : 0.05) * k; hc.positions[v * 3 + 2] *= 0.03 * k; }
  g.addMB(hc, [A[0], A[1] + floor + (boots ? 0.1 : 0.06) * k, A[2] + heel - 0.01], [1, 0, 0], [0, 1, 0], [0, 0, 1], { color: col, region: 'leather', s: surf, bw });
}

// ---------------------------------------------------------------- belts and duty gear
function buildBelt(g, app, body, q, R, anchors, gear) {
  const cl = app.clothes; const y = body.beltY; const duty = cl.dutyBelt; const bh = duty ? 0.05 : 0.034; const off = duty ? 0.012 : 0.006;
  const col = duty ? [0.025, 0.025, 0.028] : cl.beltColor || [0.08, 0.06, 0.05]; const nA = q === 2 ? R(32) : q === 1 ? 14 : 8;
  const bw = body.wT(y);
  if (cl.belt !== 'none' || duty) {
    g.grid(nA + 1, 4, (i, j) => {
      const a = -Math.PI + (i / nA) * Math.PI * 2; const yy = y + [bh / 2, bh / 2, -bh / 2, -bh / 2][j]; const o = [off * 0.4, off, off, off * 0.4][j];
      const { p, n } = body.torsoN(a, yy, o + 0.002); const nn = j === 0 ? norm(add(n, [0, 1.2, 0])) : j === 3 ? norm(add(n, [0, -1.2, 0])) : n;
      return { p, n: nn, uv: regionUV('leather', (i / nA) * 4 % 1, [0, 0.1, 0.9, 1][j]), c: col, bw: body.wT(yy), s: SURF.leather };
    });
    const fr = torsoFrame(body, 0, y, off + 0.003);
    partAt(g, fr, RB(0, 0, 0.003, duty ? 0.06 : 0.05, bh * 0.92, 0.008, { r: 0.003, seg: 1, uv: 0 }), { color: duty ? [0.04, 0.04, 0.045] : METAL.silver, region: 'metal', s: duty ? SURF.plastic : SURF.metal, bw });
    anchors.push({ name: duty ? 'dutyBelt' : 'belt', p: add(fr.o, mul3(fr.Z, 0.003)), bw, surf: body.torsoN(0, y, 0).p, sbw: bw });
    gear.push(duty ? 'dutyBelt' : 'belt');
  }
  const item = (a, mb, opts = {}, yOff = 0) => { const fr = torsoFrame(body, a, y + yOff, off + 0.004); partAt(g, fr, mb, { color: [0.03, 0.03, 0.035], region: 'leather', s: SURF.leather, bw, ...opts }); return fr; };
  const radio = (a) => {
    item(a, RB(0, -0.035, 0.02, 0.058, 0.115, 0.036, { r: 0.006, seg: 1, uv: 0 }), { s: SURF.plastic, color: [0.05, 0.05, 0.055] });
    if (q === 2) item(a, new MeshBuilder().cylinder(0.015, 0.06, 0.022, 0.0045, 0.075, 6), { s: SURF.rubber });
    gear.push('radio');
  };
  if (duty && q >= 1) {
    const holsterA = 1.42;
    // holster with sidearm grip, magazine pouch, cuff case, radio, TASER, flashlight, glove pouch, baton, belt keepers
    item(holsterA, RB(0, -0.07, 0.03, 0.06, 0.17, 0.05, { r: 0.012, seg: 1, uv: 0 }));
    item(holsterA, RB(0, 0.032, 0.035, 0.03, 0.052, 0.036, { r: 0.009, seg: 1, uv: 0 }), { color: [0.06, 0.06, 0.065], s: SURF.plastic });
    item(holsterA, RB(0, 0.018, 0.034, 0.064, 0.024, 0.058, { r: 0.008, seg: 1, uv: 0 })); // hood
    item(-0.62, RB(0, -0.022, 0.016, 0.07, 0.08, 0.026, { r: 0.006, seg: 1, uv: 0 }));
    if (q === 2) item(-0.62, new MeshBuilder().box(0, 0.0, 0.03, 0.002, 0.07, 0.004), { color: [0.12, 0.12, 0.12] });
    item(2.45, RB(0, -0.016, 0.02, 0.07, 0.066, 0.036, { r: 0.008, seg: 1, uv: 0 }));
    radio(-1.5);
    item(-0.98, RB(0, -0.05, 0.022, 0.05, 0.13, 0.04, { r: 0.01, seg: 1, uv: 0 }));
    item(-0.98, RB(0, 0.028, 0.026, 0.03, 0.045, 0.032, { r: 0.006, seg: 1, uv: 0 }), { color: [0.78, 0.66, 0.08], s: SURF.plastic }); // TASER grip
    item(-2.1, new MeshBuilder().cylinder(0, -0.05, 0.02, 0.014, 0.15, q === 2 ? 10 : 6), { color: [0.08, 0.08, 0.09], s: SURF.metal });
    item(3.0, RB(0, -0.01, 0.014, 0.07, 0.05, 0.026, { r: 0.006, seg: 1, uv: 0 }));
    item(-1.8, new MeshBuilder().cylinder(0, -0.08, 0.018, 0.011, 0.2, q === 2 ? 8 : 5), { s: SURF.plastic });
    if (q === 2) for (const a of [-0.3, 0.3, 2.0, -2.5]) item(a, RB(0, 0, 0.004, 0.022, bh * 1.04, 0.007, { r: 0.002, seg: 1, uv: 0 }));
    const hf = torsoFrame(body, holsterA, y, off + 0.004);
    anchors.push({ name: 'holster', p: add(hf.o, mul3(hf.Z, 0.03)), bw, surf: body.torsoN(holsterA, y, 0).p, sbw: bw });
    gear.push('holster', 'magPouch', 'cuffCase', 'taser', 'flashlight', 'baton');
  } else if (q >= 1) {
    if (cl.radioOnBelt) radio(-1.4);
    if (cl.badgeOnBelt) { const fr = torsoFrame(body, -0.42, y + 0.004, off + 0.003); plate(g, fr, shieldPoly(0.046, 0.056), 0.054, 0.06, 0.004, 'badgePD', METAL.gold, SURF.metal, bw); gear.push('badge'); anchors.push({ name: 'badge', p: add(fr.o, mul3(fr.Z, 0.004)), bw, surf: body.torsoN(-0.42, y + 0.004, 0).p, sbw: bw }); }
    if (cl.holsterOnly) { item(1.45, RB(0, -0.05, 0.025, 0.05, 0.13, 0.04, { r: 0.01, seg: 1, uv: 0 })); item(1.45, RB(0, 0.03, 0.028, 0.026, 0.045, 0.032, { r: 0.008, seg: 1, uv: 0 }), { color: [0.06, 0.06, 0.065], s: SURF.plastic }); gear.push('holster'); }
  }
}

// ---------------------------------------------------------------- hats, headset, glasses
function headRing(head, hm, y, extra) { // outer radius of head+hair at height y for each azimuth (memoised)
  const memo = new Map();
  return (th) => { let r = memo.get(th); if (r) return r; const s = head.atY(th, y); const t = Math.max(0, hm.thick(th, s.ph, s.p)) * (y > 0.06 ? hm.hatTop : 1); r = add(s.p, mul3(s.n, t + extra)); memo.set(th, r); return r; };
}
function buildHat(g, app, head, C, q, R, hm, gear) {
  const kind = app.clothes.hat; const col = app.clothes.hatColor || [0.05, 0.06, 0.1]; const bw = W1(B.hat); const nA = q === 2 ? R(28) : q === 1 ? 14 : 8;
  const tilt = kind === 'campaign' ? 0.04 : 0.1; // pitch forward
  const ct = Math.cos(tilt), stt = Math.sin(tilt);
  const lowerFront = (p) => [p[0], p[1] - Math.max(0, -p[2]) * stt * 1.2 + Math.max(0, p[2]) * stt * 0.4, p[2]];
  const ring = (y, extra) => headRing(head, hm, y, extra);
  const yb = kind === 'campaign' ? 0.045 : 0.046;
  const band0 = ring(yb, 0.004), band1 = ring(yb + 0.035, 0.005);
  const thA = (i) => -Math.PI + (i / nA) * Math.PI * 2;
  const surf = kind === 'campaign' ? SURF.felt : SURF.poly;
  void ct;
  if (kind === 'service') {
    const bandC = [0.02, 0.02, 0.025];
    // band
    g.grid(nA + 1, 2, (i, j) => { const th = thA(i); const p = lowerFront(j ? band1(th) : band0(th)); const n = norm([Math.sin(th), 0, -Math.cos(th)]); return { p: add(C, p), n, uv: regionUV('leather', i / nA, j), c: app.clothes.hatGold ? mix3(bandC, METAL.gold, 0.0) : bandC, bw, s: SURF.leather }; });
    // crown: rises from the band and flares out to a wide, front-raised top (two-sided so it reads from below)
    const rows = q === 2 ? 4 : 2; const flare = (th) => 1.24 + 0.1 * Math.max(0, -Math.cos(th)); const rise = (th) => 0.034 + 0.016 * Math.max(0, -Math.cos(th));
    const crownPt = (th, t) => { const b = band1(th); const r = Math.hypot(b[0], b[2]) * lerp(1, flare(th), sm(t * 1.1)); return lowerFront([Math.sin(th) * r, b[1] + rise(th) * Math.sin(t * Math.PI / 2), -Math.cos(th) * r]); };
    for (const inner of [false, true]) g.grid(nA + 1, rows + 1, (i, j) => {
      const th = thA(i); const t = j / rows; const n = norm([Math.sin(th) * (1 - t * 0.7), 0.3 + t, -Math.cos(th) * (1 - t * 0.7)]);
      return { p: add(C, crownPt(th, t)), n: inner ? mul3(n, -1) : n, uv: regionUV('tee', i / nA, t), c: inner ? mul3(col, 0.5) : col, bw, s: surf };
    });
    // top: slightly domed, two-sided
    for (const inner of [false, true]) {
      const cTop = lowerFront([0, band1(0)[1] + 0.044, 0.004]); const ci = g.v(add(C, cTop), inner ? [0, -1, 0] : [0, 1, 0], regionUV('tee', 0.5, 0.5), mul3(col, inner ? 0.5 : 1.04), bw, surf); const tb = g.n;
      for (let i = 0; i <= nA; i++) g.v(add(C, crownPt(thA(i), 1)), inner ? [0, -1, 0] : [0, 1, 0], regionUV('tee', 0.5, 0.5), mul3(col, inner ? 0.5 : 1.04), bw, surf);
      for (let i = 0; i < nA; i++) g.tri(ci, tb + i, tb + i + 1);
    }
    // visor (two-sided, glossy black)
    const nv = q === 2 ? 12 : 6;
    for (const under of [false, true]) g.grid(nv + 1, 2, (i, j) => {
      const th = lerp(-1.15, 1.15, i / nv); const b = band0(th); const out = j * (0.05 - 0.022 * Math.pow(Math.abs(th) / 1.15, 2)); const dn = j * 0.03;
      const p = lowerFront([b[0] + Math.sin(th) * out, b[1] - dn - (under ? 0.003 : 0) + 0.002, b[2] - Math.cos(th) * out]);
      const n = under ? [0, -1, 0] : norm([0, 1, -0.4]);
      return { p: add(C, p), n, uv: regionUV('metal', i / nv, j), c: [0.015, 0.015, 0.018], bw, s: SURF.visor };
    });
    // chin strap and cap badge
    if (q >= 1) {
      const pts = []; for (let i = 0; i <= 8; i++) { const th = lerp(-1.3, 1.3, i / 8); pts.push(add(C, lowerFront(add(band0(th), [Math.sin(th) * 0.003, 0.006, -Math.cos(th) * 0.003])))); }
      tubeAlong(g, pts, () => 0.0022, 4, () => app.clothes.hatGold ? METAL.gold : [0.02, 0.02, 0.02], SURF.metal, () => bw);
      const b = lowerFront(band1(0)); const o = add(C, add(b, [0, 0.008, -0.006])); const fr = { o, X: [1, 0, 0], Y: norm([0, 1, -0.25]), Z: norm([0, 0.25, -1]) };
      plate(g, fr, app.clothes.badge?.shape === 'star' ? starPoly(7, 0.02, 0.011) : shieldPoly(0.03, 0.036), 0.036, 0.04, 0.003, app.clothes.badge?.shape === 'star' ? 'badgeSO' : 'badgePD', app.clothes.hatGold || app.clothes.badge?.metal === 'gold' ? METAL.gold : METAL.silver, SURF.metal, bw);
    }
  } else if (kind === 'campaign') {
    // Montana-peak crown with four pinches, leather band, wide flat brim
    const rows = q === 2 ? 6 : 3; const hgt = 0.1;
    g.grid(nA + 1, rows + 1, (i, j) => {
      const th = thA(i); const t = j / rows; const b = band0(th); const r0 = Math.hypot(b[0], b[2]) + 0.002;
      const pinch = 1 - 0.18 * sm((t - 0.35) / 0.65) * Math.pow(Math.abs(Math.cos(2 * th)), 2) ;
      const r = r0 * (1 - 0.62 * Math.pow(t, 1.6)) * pinch; const y = b[1] + t * hgt;
      const p = lowerFront([Math.sin(th) * r, y, -Math.cos(th) * r]); const n = norm([Math.sin(th), 0.4 + t, -Math.cos(th)]);
      return { p: add(C, p), n, uv: regionUV('canvasWork', i / nA, t), c: j === 0 ? [0.14, 0.09, 0.05] : col, bw, s: j === 0 ? SURF.leather : surf };
    });
    const tip = g.v(add(C, lowerFront([0, band0(0)[1] + hgt + 0.006, 0])), [0, 1, 0], regionUV('canvasWork', 0.5, 1), col, bw, surf);
    const last = g.n - (nA + 1); for (let i = 0; i < nA; i++) g.tri(tip, last + i, last + i + 1);
    for (const under of [false, true]) g.grid(nA + 1, 2, (i, j) => {
      const th = thA(i); const b = band0(th); const r = j ? 0.175 : Math.hypot(b[0], b[2]) + 0.002;
      const p = lowerFront([Math.sin(th) * r, b[1] + (under ? -0.002 : 0) + j * 0.004, -Math.cos(th) * r]);
      return { p: add(C, p), n: under ? [0, -1, 0] : [0, 1, 0], uv: regionUV('canvasWork', i / nA, j), c: under ? mul3(col, 0.6) : col, bw, s: surf };
    });
    if (q >= 1) { const b = lowerFront(band0(0)); const o = add(C, add(b, [0, 0.03, -0.007])); plate(g, { o, X: [1, 0, 0], Y: norm([0, 1, -0.3]), Z: norm([0, 0.3, -1]) }, starPoly(7, 0.018, 0.0095), 0.036, 0.036, 0.003, 'badgeSO', METAL.gold, SURF.metal, bw); }
  } else { // ball cap / seed cap: dome following the head + curved brim
    const rows = q === 2 ? 5 : 3; const cap = kind === 'seedcap';
    g.grid(nA + 1, rows + 1, (i, j) => {
      const th = thA(i); const t = j / rows; const ph = lerp(0.36, 1.5, t);
      const s = head.ptN(th, ph); const hT = Math.max(0, hm.thick(th, ph, s.p)) * hm.hatTop;
      const p = lowerFront(add(s.p, mul3(s.n, hT + 0.006)));
      return { p: add(C, p), n: s.n, uv: regionUV('canvasWork', i / nA, t), c: cap && -Math.cos(th) > 0.3 && t < 0.85 ? mix3(col, [0.9, 0.9, 0.88], 0.0) : col, bw, s: SURF.cotton };
    });
    const top = head.ptN(0, 1.5707); g.addMB(new MeshBuilder().sphere(0, 0, 0, 0.007, 6, 4), add(C, lowerFront(add(top.p, [0, 0.016, 0]))), [1, 0, 0], [0, 1, 0], [0, 0, 1], { color: col, s: SURF.cotton, bw });
    const nv = q === 2 ? 12 : 6;
    for (const under of [false, true]) g.grid(nv + 1, 3, (i, j) => {
      const th = lerp(-0.85, 0.85, i / nv); const s0 = head.ptN(th, 0.36); const base = add(s0.p, mul3(s0.n, 0.007));
      const out = j / 2 * 0.075 * (1 - 0.45 * Math.pow(Math.abs(th) / 0.85, 2)); const curve = Math.pow(Math.abs(Math.sin(th)), 1.5) * j / 2 * 0.016;
      const p = lowerFront([base[0] + Math.sin(th) * out * 0.35, base[1] - j / 2 * 0.01 - curve - (under ? 0.003 : 0), base[2] - Math.cos(th) * out]);
      return { p: add(C, p), n: under ? [0, -1, 0] : norm([0, 1, -0.2]), uv: regionUV('canvasWork', i / nv, j / 2), c: under ? mul3(col, 0.55) : col, bw, s: SURF.cotton };
    });
    if (!cap && q >= 1 && app.clothes.patches) { const s0 = head.ptN(0, 0.75); const o = add(C, lowerFront(add(s0.p, mul3(s0.n, 0.0145)))); plate(g, { o, X: [1, 0, 0], Y: norm(cross(s0.n, [1, 0, 0]).map((v) => -v)), Z: s0.n }, rectPoly(0.05, 0.03), 0.05, 0.03, 0.001, app.clothes.patches, [1, 1, 1], SURF.patch, bw); }
  }
  gear.push('hat');
}

function buildHeadset(g, app, head, C, q, hm) {
  const bw = W1(B.head); const col = [0.06, 0.06, 0.07]; const pts = [];
  for (let i = 0; i <= 12; i++) { const psi = lerp(-1.42, 1.42, i / 12); const th = Math.sign(psi || 1) * Math.PI / 2; const ph = Math.PI / 2 - Math.abs(psi); const s = head.ptN(th, ph); const t = Math.max(0, hm.thick(th, ph, s.p)); pts.push(add(C, add(s.p, mul3(s.n, t + 0.005)))); }
  tubeAlong(g, pts, () => 0.004, 5, () => col, SURF.plastic, () => bw);
  const ear = add(C, [head.hw + 0.014, -0.006, 0.007]);
  g.addMB(new MeshBuilder().cylinder(0, 0, 0, 0.026, 0.016, q === 2 ? 14 : 8), ear, [0, -1, 0], [1, 0, 0], [0, 0, 1], { color: col, s: SURF.plastic, bw });
  g.addMB(RB(0, 0, 0, 0.012, 0.034, 0.024, { r: 0.004, seg: 1, uv: 0 }), add(C, [-head.hw - 0.008, 0.02, 0.006]), [1, 0, 0], [0, 1, 0], [0, 0, 1], { color: col, s: SURF.plastic, bw });
  const f = app.body.face; const mic = []; for (let i = 0; i <= 8; i++) { const t = i / 8; mic.push(add(C, [lerp(head.hw + 0.016, f.mouthW + 0.012, t), lerp(-0.012, f.mouthY - 0.004, t), lerp(-0.004, f.mouthZ - 0.022, Math.pow(t, 0.8))])); }
  tubeAlong(g, mic, () => 0.0022, 4, () => col, SURF.plastic, () => bw);
  g.addMB(new MeshBuilder().sphere(0, 0, 0, 0.0055, 8, 6), mic[8], [1, 0, 0], [0, 1, 0], [0, 0, 1], { color: [0.02, 0.02, 0.02], s: SURF.rubber, bw });
}

function buildGlasses(g, app, head, C, q, hm) {
  const f = app.body.face; const bw = W1(B.head); const col = app.age > 50 ? [0.55, 0.52, 0.48] : [0.04, 0.035, 0.035]; const surf = app.age > 50 ? SURF.metal : SURF.plastic;
  const zf = f.eyeZ - f.eyeR * 1.12 - 0.0085; const rx = 0.0185, ry = 0.0135; const sides = q === 2 ? 4 : 3;
  for (const s of [-1, 1]) {
    const cx = s * f.eyeX; const ring = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; ring.push(add(C, [cx + Math.cos(a) * rx, f.eyeY + Math.sin(a) * ry * (Math.sin(a) < 0 ? 0.95 : 1), zf + 0.002 * Math.pow(Math.cos(a), 2) * Math.sign(Math.cos(a) * s)])); }
    tubeAlong(g, ring, () => 0.0013, sides, () => col, surf, () => bw);
    const temple = []; const sx = cx + s * rx; for (let i = 0; i <= 6; i++) { const t = i / 6; const z = lerp(zf, 0.008, t); const x = s * (head.hw + 0.004 + (app.hairStyle === 'bald' ? 0 : 0.005)) * sm(t * 3) + sx * (1 - sm(t * 3)); temple.push(add(C, [x, f.eyeY + 0.004 - t * 0.006, z])); }
    tubeAlong(g, temple, () => 0.0012, sides, () => col, surf, () => bw);
  }
  tubeAlong(g, [add(C, [-f.eyeX + rx * 0.9, f.eyeY + 0.004, zf - 0.001]), add(C, [0, f.eyeY + 0.007, zf - 0.003]), add(C, [f.eyeX - rx * 0.9, f.eyeY + 0.004, zf - 0.001])], () => 0.0013, sides, () => col, surf, () => bw);
}
