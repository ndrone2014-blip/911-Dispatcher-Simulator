// The outside of the public-safety complex: brick facades with real window and door
// openings (they line up with the interior glazing), cast-stone sills and lintels, flat
// roofs with parapets and coping, rooftop equipment and the radio mast, the entrance
// canopy and the site around the front door. Unlit with lighting baked into the vertex
// colours (like the rest of the outdoor scene) so it costs a few draw calls and no lights.
import { MeshBuilder } from '../engine/geometry.js';
import { PD, ENTRANCE } from './policeDept.js';

const STONE = [0.78, 0.75, 0.68], FRAME = [0.16, 0.15, 0.14], COPING = [0.72, 0.7, 0.66], ROOFTRIM = [0.3, 0.31, 0.33];

// Every exterior wall: line, outward normal, vertical range, openings [a0, a1, y0, y1, kind]
function segments() {
  const P = PD; const F2 = P.F2; const W1 = (a, b, y0 = 0.85, y1 = 2.75) => [a, b, y0, y1, 'win'];
  const W2 = (a, b) => [a, b, F2 + 0.85, F2 + 2.75, 'win'];
  return [
    // Police Department (two stories)
    { ax: 'z', c: P.z0, a: P.x0, b: P.x1, out: -1, y0: 0, y1: P.ROOF, open: [W1(2, 3.4), W1(5, 7.2, 0.45, 3.0), W1(8.2, 11, 0.45, 3.0), W2(-11, -9), W2(-8, -6), W2(-4.2, -1.4), W2(0.6, 3.2), W2(5, 7.6), W2(8.4, 11)] },
    { ax: 'x', c: P.x1, a: P.z0, b: P.z1, out: 1, y0: 0, y1: P.ROOF, open: [W1(-39.4, -36, 0.3, 3.1), [ENTRANCE[0], ENTRANCE[1], 0, 2.45, 'door'], W1(-32, -28.6, 0.3, 3.1), W1(-26.4, -23.2), W1(-20.4, -17.2), W1(-13.6, -10.6), W2(-38.6, -36), W2(-32.6, -29.4), W2(-26.4, -23.2), W2(-20.4, -17.2), W2(-13.6, -10.6)] },
    { ax: 'x', c: P.x0, a: P.z0, b: -26, out: -1, y0: 0, y1: P.ROOF, open: [W2(-39, -36.6), W2(-31.6, -29.2)] },
    { ax: 'x', c: P.x0, a: -26, b: P.z1, out: -1, y0: 4.2, y1: P.ROOF, open: [W2(-14.2, -11.8), W2(-10.6, -8.6)] },
    { ax: 'z', c: P.z1, a: P.x0, b: P.x1, out: 1, y0: 4.2, y1: P.ROOF, open: [W2(-11.2, -9), W2(-5.8, -3.6), W2(0, 3.4), W2(9.4, 11.4)] },
    // 911 center
    { ax: 'x', c: 12, a: -7.48, b: 16, out: 1, y0: 0, y1: 4.2, open: [W1(-6.6, -3.0, 0.9, 2.8), W1(-1.8, 1.8, 0.9, 2.8), W1(3.0, 6.6, 0.9, 2.8), W1(11.4, 15.2, 0.9, 2.8)] },
    { ax: 'z', c: 16, a: -3, b: 12, out: 1, y0: 0, y1: 4.2, open: [] },
    { ax: 'x', c: -3, a: 16, b: 18, out: 1, y0: 0, y1: 4.2, open: [] },
    { ax: 'z', c: 18, a: -42, b: -3, out: 1, y0: 0, y1: 4.2, open: [W1(-10, -5, 0.9, 2.6)] },
    // Sheriff's wing, sally port, evidence, range
    { ax: 'x', c: -42, a: -2, b: 18, out: -1, y0: 0, y1: 4.2, open: [[1.3, 4.7, 0, 3.15, 'rollup'], [7.3, 10.7, 0, 3.15, 'rollup'], [13.3, 16.7, 0, 3.15, 'rollup']] },
    { ax: 'z', c: -2, a: -42, b: -30, out: -1, y0: 0, y1: 4.2, open: [] },
    { ax: 'x', c: -30, a: -8, b: -2, out: -1, y0: 0, y1: 4.2, open: [] },
    { ax: 'z', c: -8, a: -30, b: -22, out: -1, y0: 0, y1: 4.2, open: [] },
    { ax: 'x', c: -22, a: -26, b: -8, out: -1, y0: 0, y1: 4.2, open: [] },
    { ax: 'z', c: -26, a: -22, b: -12, out: -1, y0: 0, y1: 4.2, open: [] },
  ];
}
const ROOFS = [
  { r: [PD.x0, PD.z0, PD.x1, PD.z1], y: PD.ROOF },
  { r: [-12, -8, 12, 16], y: 4.2 }, { r: [-12, 16, -3, 18], y: 4.2 }, { r: [-42, -2, -12, 18], y: 4.2 }, { r: [-30, -8, -12, -2], y: 4.2 }, { r: [-22, -26, -12, -8], y: 4.2 },
];

export function buildShell({ D = 1 } = {}) {
  const brick = new MeshBuilder(), roof = new MeshBuilder(), ext = new MeshBuilder(), glow = new MeshBuilder(), signs = [];
  const T = 0.26; // facade depth outside the wall line
  // world-aligned quad on a facade plane so the brick bond runs continuously
  const fq = (s, a0, a1, y0, y1, o = T) => {
    if (a1 - a0 < 0.01 || y1 - y0 < 0.01) return;
    const c = s.c + s.out * o; const uvs = (a, y) => [a / 0.6, y / 0.6];
    if (s.ax === 'z') { const n = [0, 0, s.out]; const A = s.out > 0 ? [a0, a1] : [a1, a0]; brick.quad([A[0], y0, c], [A[1], y0, c], [A[1], y1, c], [A[0], y1, c], n, [uvs(A[0] * s.out, y0), uvs(A[1] * s.out, y0), uvs(A[1] * s.out, y1), uvs(A[0] * s.out, y1)], [1, 1, 1]); }
    else { const n = [s.out, 0, 0]; const A = s.out > 0 ? [a1, a0] : [a0, a1]; brick.quad([c, y0, A[0]], [c, y0, A[1]], [c, y1, A[1]], [c, y1, A[0]], n, [uvs(-A[0] * s.out, y0), uvs(-A[1] * s.out, y0), uvs(-A[1] * s.out, y1), uvs(-A[0] * s.out, y1)], [1, 1, 1]); }
  };
  const bx = (s, a, y, o, la, ly, lo, color, mb = ext) => { // box in facade-local coords: a along, y up, o outward
    const c = s.c + s.out * o; if (s.ax === 'z') mb.box(a, y, c, la, ly, lo, { color, uv: 0 }); else mb.box(c, y, a, lo, ly, la, { color, uv: 0 });
  };
  for (const s of segments()) {
    const a0 = s.a - T, a1 = s.b + T; // run past the corners so neighbouring facades meet
    const ops = s.open.slice().sort((p, q) => p[0] - q[0]);
    // split the wall at every opening edge; in each strip, brick fills everything the openings don't
    const bps = [...new Set([a0, a1, ...ops.flatMap((o) => [o[0], o[1]])])].filter((v) => v >= a0 && v <= a1).sort((p, q) => p - q);
    for (let i = 0; i < bps.length - 1; i++) {
      const xa = bps[i], xb = bps[i + 1], mid = (xa + xb) / 2;
      const cover = ops.filter((o) => o[0] <= mid && o[1] >= mid).sort((p, q) => p[2] - q[2]);
      let y = s.y0; for (const q of cover) { fq(s, xa, xb, y, q[2]); y = q[3]; } fq(s, xa, xb, y, s.y1);
    }
    for (const [oa, ob, oy0, oy1, kind] of ops) {
      // reveals (jambs, head, sill) and the frame
      const w = ob - oa, mid = (oa + ob) / 2, dep = T + 0.08;
      for (const e of [oa, ob]) bx(s, e + (e === oa ? 0.04 : -0.04), (oy0 + oy1) / 2, dep / 2, 0.08, oy1 - oy0, dep, STONE.map((v) => v * 0.9));
      bx(s, mid, oy1 + 0.12, T + 0.02, w + 0.3, 0.24, 0.06, STONE); // lintel
      bx(s, mid, oy1 - 0.02, dep / 2, w, 0.04, dep, STONE.map((v) => v * 0.85)); // head soffit
      if (kind === 'win') {
        bx(s, mid, oy0 - 0.04, T + 0.03, w + 0.16, 0.08, 0.14, STONE); // sill
        bx(s, mid, oy0 + 0.02, 0.1, w, 0.04, 0.08, FRAME); bx(s, mid, oy1 - 0.04, 0.1, w, 0.05, 0.08, FRAME);
        const n = Math.max(1, Math.round(w / 1.4)); for (let i = 0; i <= n; i++) bx(s, oa + w * i / n, (oy0 + oy1) / 2, 0.1, 0.05, oy1 - oy0, 0.08, FRAME);
        if (D >= 1 && oy1 - oy0 > 2.3) bx(s, mid, oy0 + 0.9, 0.1, w, 0.04, 0.06, FRAME); // transom bar on tall storefront glass
      } else if (kind === 'door') {
        bx(s, mid, oy1 + 0.05, 0.12, w + 0.1, 0.1, 0.1, FRAME);
      } else if (kind === 'rollup') {
        bx(s, mid, (oy0 + oy1) / 2, 0.06, w, oy1 - oy0, 0.04, [0.62, 0.64, 0.66]);
        for (let y = oy0 + 0.2; y < oy1; y += 0.18) bx(s, mid, y, 0.085, w, 0.012, 0.01, [0.45, 0.47, 0.5]);
        bx(s, mid, oy1 + 0.15, 0.2, w + 0.3, 0.3, 0.3, [0.4, 0.41, 0.43]);
      }
    }
    // base course (stone water table) and a soldier band at floor 2 on the PD
    fq2(s, a0, a1);
  }
  function fq2(s, a0, a1) {
    const L = a1 - a0, mid = (a0 + a1) / 2;
    if (s.y0 === 0) bx(s, mid, 0.25, T + 0.03, L + 0.06, 0.5, 0.08, STONE.map((v) => v * 0.92));
    if (s.y1 > 6) bx(s, mid, PD.F2 + 0.05, T + 0.03, L + 0.06, 0.18, 0.08, STONE);
  }
  // roofs, parapets and coping
  for (const { r: [x0, z0, x1, z1], y } of ROOFS) {
    roof.box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, 0.06, z1 - z0, { faces: 'Y', uv: 4 });
  }
  const parapet = (s, y) => {
    const a0 = s.a - T, a1 = s.b + T; const L = a1 - a0; const mid = (a0 + a1) / 2;
    fq(s, a0, a1, y, y + 0.7); // outer face (brick)
    bx(s, mid, y + 0.35, 0.02, L, 0.7, 0.04, [0.62, 0.6, 0.57]); // inner face
    bx(s, mid, y + 0.73, T / 2, L + 0.04, 0.06, T + 0.08, COPING);
  };
  for (const s of segments()) parapet(s, s.y1);
  // rooftop: HVAC units, exhausts, radio mast with antennas, satellite dishes, roof hatches
  const hvac = (x, z, w = 2.4, d = 1.6, y = 4.2) => { ext.box(x, y + 0.6, z, w, 1.2, d, { color: [0.66, 0.67, 0.68], uv: 0 }); ext.box(x, y + 1.22, z, w + 0.04, 0.04, d + 0.04, { color: [0.55, 0.56, 0.57], uv: 0 }); if (D >= 1) for (let i = 0; i < 2; i++) ext.cylinder(x - w / 4 + i * w / 2, y + 1.27, z, 0.42, 0.06, 14, { color: [0.2, 0.21, 0.22] }); };
  hvac(-5, -2); hvac(5, 4); hvac(-26, 6); hvac(-36, 10, 3.2, 2); hvac(-18, -18, 2.0, 1.4); hvac(-6, -28, 3.0, 2.0, PD.ROOF); hvac(4, -16, 3.0, 2.0, PD.ROOF); hvac(-4, -16, 2.0, 1.4, PD.ROOF);
  for (const [x, z, y] of [[0, 8, 4.2], [-20, 14, 4.2], [8, -34, PD.ROOF], [-10, -12, PD.ROOF]]) { ext.cylinder(x, y + 0.5, z, 0.18, 1.0, 10, { color: [0.6, 0.6, 0.62] }); ext.cylinder(x, y + 1.05, z, 0.26, 0.1, 10, { color: [0.5, 0.5, 0.52], r2: 0.1 }); }
  { // lattice radio mast on the PD roof (dispatch antennas)
    const mx = 9, mz = -12, y0 = PD.ROOF, H = 14; const leg = [0.32, 0.33, 0.35];
    for (const [dx, dz] of [[-0.45, -0.3], [0.45, -0.3], [0, 0.45]]) ext.cylinder(mx + dx, y0 + H / 2, mz + dz, 0.04, H, 5, { color: leg, caps: false });
    for (let y = 1; y < H; y += 1.2) for (const [a, b] of [[[-0.45, -0.3], [0.45, -0.3]], [[0.45, -0.3], [0, 0.45]], [[0, 0.45], [-0.45, -0.3]]]) ext.box(mx + (a[0] + b[0]) / 2, y0 + y, mz + (a[1] + b[1]) / 2, Math.hypot(b[0] - a[0], b[1] - a[1]), 0.03, 0.03, { color: leg, uv: 0, rotY: -Math.atan2(b[1] - a[1], b[0] - a[0]) });
    for (const [h, l] of [[H - 0.5, 3.2], [H - 3, 2.4], [H - 6, 1.8]]) { ext.cylinder(mx + 0.55, y0 + h + l / 2 - 0.4, mz, 0.03, l, 6, { color: [0.85, 0.86, 0.88] }); ext.cylinder(mx - 0.55, y0 + h + l / 2 - 0.6, mz + 0.2, 0.03, l * 0.8, 6, { color: [0.85, 0.86, 0.88] }); }
    ext.cylinder(mx, y0 + H + 1.0, mz, 0.025, 2.0, 6, { color: [0.85, 0.86, 0.88] });
    glow.sphere(mx, y0 + H + 2.05, mz, 0.12, 6, 4, { color: [1.4, 0.06, 0.04] }); glow.sphere(mx, y0 + H * 0.55, mz + 0.45, 0.08, 6, 4, { color: [1.4, 0.06, 0.04] });
    for (const [x, z, a] of [[6, -36, 0.6], [-9, -36, 2.2]]) { ext.cylinder(x, PD.ROOF + 0.5, z, 0.06, 1.0, 6, { color: leg }); ext.sphere(x, PD.ROOF + 1.2, z, 0.55, 12, 6, { color: [0.86, 0.86, 0.85], sy: 0.35 }); void a; }
  }
  for (const [x, z, y] of [[2, -24, PD.ROOF], [-30, 2, 4.2]]) ext.box(x, y + 0.25, z, 1.0, 0.5, 1.0, { color: ROOFTRIM, uv: 0 });
  // entrance canopy on two round columns, with downlights and the department sign above it
  { const z0 = ENTRANCE[0] - 1.4, z1 = ENTRANCE[1] + 1.4, x1 = 15.0;
    ext.box((12 + x1) / 2 + 0.13, 3.25, (z0 + z1) / 2, x1 - 12 + 0.26, 0.36, z1 - z0, { color: [0.82, 0.8, 0.76], uv: 0 });
    ext.box((12 + x1) / 2 + 0.13, 3.44, (z0 + z1) / 2, x1 - 12 + 0.3, 0.04, z1 - z0 + 0.04, { color: [0.4, 0.41, 0.43], uv: 0 });
    for (const z of [z0 + 0.35, z1 - 0.35]) { ext.cylinder(x1 - 0.35, 1.55, z, 0.17, 3.1, 14, { color: [0.85, 0.83, 0.79] }); ext.cylinder(x1 - 0.35, 0.06, z, 0.26, 0.12, 14, { color: STONE }); }
    for (const z of [-35.6, -34, -32.4]) glow.disc(13.6, 3.065, z, 0.12, 10, { color: [1.3, 1.2, 1.0], down: true });
    signs.push({ id: 'pd_ext_sign', text: 'CITY POLICE DEPARTMENT', x: 12.29, y: 4.15, z: -34, w: 5.4, h: 0.55, axis: 'x', sign: 1 });
    signs.push({ id: 'pd_ext_sign2', text: 'PUBLIC SAFETY BUILDING · 911 · POLICE · SHERIFF', x: 12.29, y: 3.55, z: 4, w: 7.6, h: 0.42, axis: 'x', sign: 1 });
    signs.push({ id: 'pd_ext_sign3', text: "COUNTY SHERIFF'S OFFICE", x: -27, y: 3.5, z: 18.29, w: 5.2, h: 0.5, axis: 'z', sign: 1 });
  }
  bakeShell(brick); bakeShell(roof); bakeShell(ext);
  return { brick, roof, ext, glow, signs };
}

function bakeShell(mb) {
  const L = [-0.35, 0.8, 0.48]; const l = Math.hypot(...L); L[0] /= l; L[1] /= l; L[2] /= l;
  for (let i = 0; i < mb.n.length; i += 3) {
    const nx = mb.n[i], ny = mb.n[i + 1], nz = mb.n[i + 2];
    const d = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]); const k = 0.5 + 0.48 * d + 0.12 * (0.5 + 0.5 * ny);
    const y = mb.p[i + 1]; const ground = y < 0.6 ? 0.82 + 0.3 * y : 1; // a little grime/occlusion at the foot of the walls
    mb.c[i] *= k * ground; mb.c[i + 1] *= k * ground; mb.c[i + 2] *= k * ground * 1.02;
  }
}

/** Colliders for the outside of the building (thick walls so you can't clip into the facade). */
export function shellColliders() {
  const out = [];
  for (const s of segments()) {
    if (s.y0 > 0) continue;
    const t0 = 0.0, t1 = 0.4; const doors = s.open.filter((o) => o[4] === 'door');
    let cur = s.a - 0.3;
    for (const [a, b] of [...doors.map((d) => [d[0], d[1]]), [s.b + 0.3, s.b + 0.3]]) {
      if (a > cur) { if (s.ax === 'z') out.push([cur, Math.min(s.c, s.c + s.out * t1), a, Math.max(s.c, s.c + s.out * t1), 0, 4]); else out.push([Math.min(s.c, s.c + s.out * t1), cur, Math.max(s.c, s.c + s.out * t1), a, 0, 4]); }
      cur = b;
    }
    void t0;
  }
  // canopy columns
  for (const z of [ENTRANCE[0] - 1.05, ENTRANCE[1] + 1.05]) out.push([14.45, z - 0.2, 14.85, z + 0.2, 0, 3.2]);
  return out;
}
