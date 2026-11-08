// The world outside the windows: a real 3D small-town scene around the center instead of
// painted pictures. East windows look over the staff/patrol lot to the street and a block of
// downtown storefronts, with houses, a church, the water tower and a grain elevator beyond;
// the break-room window looks south across the lawn (flags) to a residential street.
//
// Performance: everything is merged into five batches (one draw call each). Outdoor
// lighting is baked into vertex colours once, and the whole scene is tinted per frame for
// time of day and weather (unlit material + outdoor fog), so it costs no lights and no
// shadows. Lower detail levels drop the far houses, trees and small props.
import { MeshBuilder } from '../engine/geometry.js';
import { makeCanvas } from '../engine/textures.js';

// Generic storefront signs (fictional businesses) + the town name for the water tower.
export const SIGNS = ['MAIN ST DINER', 'HARDWARE', 'PHARMACY', 'BARBER SHOP', 'COFFEE', 'FLORIST', 'FEED & SEED', 'ANTIQUES', 'INSURANCE', 'BAKERY', 'TAX & BOOKKEEPING', 'CARMI'];
const SIGN_COLS = [['#7a1717', '#f5e6c8'], ['#1d3557', '#f1faee'], ['#2a6f4f', '#ffffff'], ['#f1f1f1', '#b22234'], ['#3b2416', '#f2d6a2'], ['#efe3f0', '#6a2c70'], ['#2f4f1f', '#f0e2a0'], ['#1a1a1a', '#d4af37'], ['#0f3b6e', '#ffffff'], ['#f6efe2', '#8a3b12'], ['#24343f', '#e8eef2'], ['#c9d2da', '#1d3a66']];

/** Texture atlas with the sign faces (4 columns × 3 rows). */
// Cells are 512×96 (aspect 5.33) and every sign panel uses that same aspect, so text is never squashed.
export const SIGN_ASPECT = 512 / 96;
export function makeSignAtlas() {
  const c = makeCanvas(1024, 576); const g = c.getContext('2d');
  SIGNS.forEach((txt, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 96; const [bg, fg] = SIGN_COLS[i];
    g.fillStyle = bg; g.fillRect(x, y, 512, 96);
    if (txt !== 'CARMI') { g.strokeStyle = fg; g.globalAlpha = 0.55; g.lineWidth = 3; g.strokeRect(x + 7, y + 7, 498, 82); g.globalAlpha = 1; }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 62; g.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
    while (g.measureText(txt).width > 460 && size > 20) { size -= 2; g.font = `700 ${size}px Georgia, 'Times New Roman', serif`; }
    g.fillText(txt, x + 256, y + 50);
  });
  return c;
}
const signUV = (i) => { const u = (i % 2) / 2, v = Math.floor(i / 2) / 6; return [u, v, u + 0.5, v + 1 / 6]; };

function season() {
  const m = new Date().getMonth();
  if (m >= 8 && m <= 10) return 'autumn';
  if (m === 11 || m <= 1) return 'winter';
  return 'summer';
}

// simple deterministic random
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function buildExterior({ D = 1 } = {}) {
  const ext = new MeshBuilder(), glow = new MeshBuilder(), signs = new MeshBuilder(), flagUS = new MeshBuilder(), flagIL = new MeshBuilder();
  // textured ground surfaces (world-space UVs) + bark/leaf masses for trees
  const asphalt = new MeshBuilder(), walk = new MeshBuilder(), grass = new MeshBuilder(), bark = new MeshBuilder(), leaves = new MeshBuilder();
  const cols = []; const col = (x0, z0, x1, z1, h = 3) => cols.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 0, h]);
  const r = rng(6180911);
  const S = season();
  const C = {
    grass: S === 'summer' ? [0.33, 0.5, 0.22] : S === 'autumn' ? [0.42, 0.46, 0.24] : [0.47, 0.45, 0.33],
    grass2: S === 'summer' ? [0.29, 0.45, 0.2] : S === 'autumn' ? [0.46, 0.44, 0.24] : [0.5, 0.47, 0.36],
    asphalt: [0.2, 0.205, 0.215], asphalt2: [0.24, 0.245, 0.25], concrete: [0.66, 0.65, 0.62], curb: [0.75, 0.74, 0.71], mulch: [0.25, 0.16, 0.1],
    white: [0.92, 0.92, 0.9], yellow: [0.9, 0.72, 0.12], trunk: [0.27, 0.19, 0.12], pole: [0.45, 0.46, 0.48], wood: [0.36, 0.26, 0.17],
    leaves: S === 'summer' ? [[0.2, 0.38, 0.14], [0.25, 0.44, 0.16], [0.17, 0.33, 0.13]] : S === 'autumn' ? [[0.72, 0.3, 0.08], [0.82, 0.55, 0.12], [0.58, 0.18, 0.07], [0.62, 0.5, 0.18], [0.35, 0.4, 0.16]] : [[0.32, 0.26, 0.2], [0.36, 0.3, 0.22]],
    evergreen: [0.12, 0.26, 0.15],
    brick: [[0.55, 0.24, 0.17], [0.62, 0.32, 0.22], [0.5, 0.3, 0.22], [0.74, 0.62, 0.46], [0.68, 0.66, 0.6], [0.45, 0.2, 0.15]],
    siding: [[0.9, 0.89, 0.84], [0.72, 0.78, 0.82], [0.85, 0.8, 0.66], [0.62, 0.66, 0.58], [0.82, 0.74, 0.7], [0.95, 0.93, 0.88]],
    roof: [[0.25, 0.25, 0.27], [0.33, 0.28, 0.24], [0.4, 0.17, 0.13], [0.2, 0.22, 0.26], [0.42, 0.4, 0.36]],
    awning: [[0.55, 0.08, 0.08], [0.1, 0.25, 0.45], [0.12, 0.35, 0.2], [0.18, 0.18, 0.2], [0.6, 0.45, 0.1]],
    car: [[0.62, 0.08, 0.08], [0.85, 0.85, 0.86], [0.12, 0.2, 0.42], [0.1, 0.1, 0.11], [0.45, 0.47, 0.5], [0.3, 0.33, 0.25], [0.7, 0.68, 0.62]],
  };
  const pick = (a) => a[Math.floor(r() * a.length)];
  const box = (x, y, z, sx, sy, sz, color, o = {}) => ext.box(x, y, z, sx, sy, sz, { color, uv: 0, ...o });
  const flat = (x0, z0, x1, z1, y, color) => {
    // roads, sidewalks and lawns get real textures; everything else stays a flat colour
    const isA = color === C.asphalt || color === C.asphalt2, isW = color === C.concrete, isG = color === C.grass || color === C.grass2;
    if (isA || isW || isG) { const mb = isA ? asphalt : isW ? walk : grass; const tint = isA ? (color === C.asphalt2 ? [1.05, 1.05, 1.05] : [0.95, 0.95, 0.95]) : isG ? (color === C.grass2 ? C.grass2.map((v) => v / 0.4) : C.grass.map((v) => v / 0.4)) : [1, 1, 1];
      mb.box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, 0.02, z1 - z0, { color: tint.map((v) => Math.min(1.4, v)), faces: 'Y', uv: isA ? 3.2 : isW ? 1.5 : 4 }); return; }
    box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, 0.02, z1 - z0, color, { faces: 'Y' });
  };

  // Gable roof over a rectangle. Ridge runs along x when alongX, else along z.
  const roof = (cx, cz, w, d, y0, rise, color, alongX = true, over = 0.35) => {
    const hw = w / 2 + over, hd = d / 2 + over;
    if (alongX) {
      const L = Math.hypot(hd, rise); const n1 = [0, hd / L, -rise / L], n2 = [0, hd / L, rise / L];
      ext.quad([cx + hw, y0, cz - hd], [cx - hw, y0, cz - hd], [cx - hw, y0 + rise, cz], [cx + hw, y0 + rise, cz], n1, [[0, 0], [1, 0], [1, 1], [0, 1]], color);
      ext.quad([cx - hw, y0, cz + hd], [cx + hw, y0, cz + hd], [cx + hw, y0 + rise, cz], [cx - hw, y0 + rise, cz], n2, [[0, 0], [1, 0], [1, 1], [0, 1]], color);
      for (const s of [-1, 1]) { const x = cx + s * (w / 2); ext.quad([x, y0, cz - d / 2], [x, y0, cz + d / 2], [x, y0 + rise * (1 - over / hd), cz], [x, y0 + rise * (1 - over / hd), cz], [s, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], color.map((v) => v * 1.0)); }
    } else {
      const L = Math.hypot(hw, rise); const n1 = [-rise / L, hw / L, 0], n2 = [rise / L, hw / L, 0];
      ext.quad([cx - hw, y0, cz - hd], [cx - hw, y0, cz + hd], [cx, y0 + rise, cz + hd], [cx, y0 + rise, cz - hd], n1, [[0, 0], [1, 0], [1, 1], [0, 1]], color);
      ext.quad([cx + hw, y0, cz + hd], [cx + hw, y0, cz - hd], [cx, y0 + rise, cz - hd], [cx, y0 + rise, cz + hd], n2, [[0, 0], [1, 0], [1, 1], [0, 1]], color);
      for (const s of [-1, 1]) { const z = cz + s * (d / 2); ext.quad([cx + w / 2, y0, z], [cx - w / 2, y0, z], [cx, y0 + rise * (1 - over / hw), z], [cx, y0 + rise * (1 - over / hw), z], [0, 0, s], [[0, 0], [1, 0], [1, 1], [0, 1]], color); }
    }
  };
  const tree = (x, z, h = 7 + r() * 5, kind) => {
    const ever = kind === 'ever' || (kind == null && r() < 0.12);
    const tr = 0.16 + h * 0.012;
    bark.cylinder(x, h * 0.22, z, tr, h * 0.44, D >= 2 ? 8 : 6, { color: [1, 0.95, 0.9], caps: false, r2: tr * 0.7 });
    if (D >= 1 && !ever) for (let i = 0; i < 3; i++) { const a = r() * 6.28; bark.box(x + Math.cos(a) * h * 0.08, h * (0.42 + i * 0.07), z + Math.sin(a) * h * 0.08, 0.07, h * 0.22, 0.07, { color: [1, 0.95, 0.9], uv: 0, rotY: a }); }
    if (Math.abs(x) < 70 && Math.abs(z) < 70) col(x - tr - 0.05, z - tr - 0.05, x + tr + 0.05, z + tr + 0.05, h);
    if (ever) { for (let i = 0; i < 3; i++) ext.cylinder(x, h * (0.35 + i * 0.2), z, h * (0.28 - i * 0.07), h * 0.32, 8, { color: C.evergreen.map((v) => v * (0.9 + i * 0.08)), r2: 0.05 }); return; }
    if (S === 'winter' && r() < 0.7) { // bare branches
      for (let i = 0; i < 5; i++) { const a = i * 1.3; ext.box(x + Math.cos(a) * h * 0.12, h * 0.62, z + Math.sin(a) * h * 0.12, 0.08, h * 0.38, 0.08, { color: C.trunk, uv: 0, rotY: a }); }
      ext.sphere(x, h * 0.72, z, h * 0.3, 7, 5, { color: [0.3, 0.25, 0.2], sy: 0.9 }); return;
    }
    const base = pick(C.leaves); const R = h * (0.26 + r() * 0.08);
    const far = Math.hypot(x, z) > 85; // distant tree lines need far fewer triangles
    const seg = far ? 5 : D >= 2 ? 7 : 6, rings = far ? 3 : D >= 2 ? 5 : 4;
    // a canopy of several lumpy leaf masses (jittered spheres) instead of one ball
    const clump = (cx, cy, cz, rr, col2) => { const k0 = leaves.vcount; leaves.sphere(cx, cy, cz, rr, seg, rings, { color: col2, sy: 0.85 }); for (let v = k0; v < leaves.vcount; v++) { const j = 0.82 + 0.3 * Math.abs(Math.sin(v * 12.9898 + cx) * 43758.5453 % 1); leaves.p[v * 3] = cx + (leaves.p[v * 3] - cx) * j; leaves.p[v * 3 + 1] = cy + (leaves.p[v * 3 + 1] - cy) * j; leaves.p[v * 3 + 2] = cz + (leaves.p[v * 3 + 2] - cz) * j; } };
    const lc = base.map((v) => v * 2.2);
    clump(x, h * 0.66, z, R, lc);
    clump(x + R * 0.45, h * 0.58, z + R * 0.2, R * 0.7, lc.map((v) => v * 0.88));
    if (D >= 1 && !far) clump(x - R * 0.35, h * 0.78, z - R * 0.25, R * 0.62, lc.map((v) => Math.min(2.4, v * 1.1)));
    if (D >= 2 && !far) clump(x - R * 0.2, h * 0.55, z + R * 0.45, R * 0.55, lc.map((v) => v * 0.95));
  };
  const shrub = (x, z, s = 1) => ext.sphere(x, 0.35 * s, z, 0.55 * s, 6, 4, { color: S === 'winter' ? C.evergreen : [0.16, 0.32, 0.13], sy: 0.75 });
  // Sedan / pickup / patrol car with rounded body, sloped glasshouse, wheels and lamps. rot = 0 faces +x.
  const car = (x, z, rot, color, kind = 'sedan') => {
    const pickup = kind === 'pickup'; const L = pickup ? 5.5 : 4.85, W = 1.86; const cr = Math.cos(rot), sr = Math.sin(rot);
    { const hx = (Math.abs(cr) * L + Math.abs(sr) * W) / 2, hz = (Math.abs(sr) * L + Math.abs(cr) * W) / 2; col(x - hx, z - hz, x + hx, z + hz, 1.6); }
    const P = (dx, dz) => [x + dx * cr + dz * sr, z - dx * sr + dz * cr];
    const seg = D >= 2 ? 2 : 1;
    ext.rbox(x, 0.6, z, L, 0.56, W, { color, rotY: rot, r: 0.16, seg, uv: 0 });                                   // lower body
    const [hx0, hz0] = P(L * 0.33, 0); ext.rbox(hx0, 0.86, hz0, L * 0.3, 0.06, W * 0.96, { color, rotY: rot, r: 0.03, seg: 1, uv: 0 }); // hood
    const cabL = pickup ? 1.75 : 2.35; const [cx2, cz2] = P(pickup ? 0.55 : -0.25, 0);
    ext.rbox(cx2, 1.12, cz2, cabL, 0.5, W * 0.84, { color: [0.1, 0.13, 0.17], rotY: rot, r: 0.14, seg, uv: 0 });    // glasshouse
    ext.rbox(cx2, 1.38, cz2, cabL * 0.8, 0.05, W * 0.8, { color, rotY: rot, r: 0.02, seg: 1, uv: 0 });            // roof
    if (pickup) { const [bx0, bz0] = P(-1.45, 0); ext.box(bx0, 0.95, bz0, 2.0, 0.14, W * 0.98, { color: color.map((v) => v * 0.8), rotY: rot, uv: 0, faces: 'yY' }); }
    for (const [dx, dz] of [[1.5, 0.84], [1.5, -0.84], [-1.5, 0.84], [-1.5, -0.84]]) { const [wx, wz] = P(dx * (L / 4.85), dz); ext.cylinder(wx, 0.34, wz, 0.34, 0.26, 10, { color: [0.05, 0.05, 0.055] }); }
    if (kind === 'patrol' || kind === 'sheriff') {
      const [bx, bz] = P(-0.25, 0); ext.box(bx, 1.45, bz, 0.26, 0.09, 1.25, { color: [0.12, 0.12, 0.13], rotY: rot, uv: 0 });
      const [rx, rz] = P(-0.25, -0.33), [ux, uz] = P(-0.25, 0.33);
      glow.box(rx, 1.47, rz, 0.22, 0.07, 0.52, { color: [1.3, 0.1, 0.08], rotY: rot, uv: 0 }); glow.box(ux, 1.47, uz, 0.22, 0.07, 0.52, { color: [0.12, 0.28, 1.4], rotY: rot, uv: 0 });
      const [dx2, dz2] = P(-0.2, 0); ext.box(dx2, 0.66, dz2, 1.9, 0.3, W + 0.02, { color: kind === 'sheriff' ? [0.62, 0.48, 0.24] : [0.95, 0.95, 0.95], rotY: rot, uv: 0, faces: 'zZ' }); // door stripe
      const [px, pz] = P(L / 2 + 0.1, 0); ext.box(px, 0.55, pz, 0.12, 0.34, 1.1, { color: [0.08, 0.08, 0.09], rotY: rot, uv: 0 }); // push bumper
    }
    for (const s2 of [-0.62, 0.62]) {
      const [hx, hz] = P(L / 2 + 0.005, s2); glow.box(hx, 0.72, hz, 0.02, 0.12, 0.34, { color: [0.95, 0.92, 0.8], rotY: rot, uv: 0 });
      const [tx, tz] = P(-L / 2 - 0.005, s2); glow.box(tx, 0.76, tz, 0.02, 0.12, 0.3, { color: [0.95, 0.08, 0.05], rotY: rot, uv: 0 });
    }
  };
  const streetLight = (x, z, armDir, h = 8) => {
    col(x - 0.18, z - 0.18, x + 0.18, z + 0.18, h);
    ext.cylinder(x, h / 2, z, 0.1, h, 6, { color: C.pole, caps: false });
    box(x + armDir[0] * 1.1, h, z + armDir[1] * 1.1, armDir[0] ? 2.2 : 0.12, 0.12, armDir[1] ? 2.2 : 0.12, C.pole);
    glow.box(x + armDir[0] * 2.1, h - 0.1, z + armDir[1] * 2.1, 0.7, 0.14, 0.35, { color: [1.3, 1.05, 0.72], uv: 0, faces: 'yxXzZ' });
  };
  // A house facing the given side (face = 'x' means front faces -x toward the center, 'z' faces -z).
  const house = (x, z, w, d, face, two = false) => {
    const wall = pick(C.siding), rf = pick(C.roof); const h = two ? 5.6 : 3.1;
    box(x, 0.25, z, w + 0.2, 0.5, d + 0.2, [0.55, 0.53, 0.5]);                  // foundation
    box(x, 0.5 + h / 2, z, w, h, d, wall);
    roof(x, z, w, d, 0.5 + h, Math.min(w, d) * 0.32, rf, face === 'z' ? true : false);
    // windows (lit at night on some houses) + door on the front face
    const lit = r() < 0.55; const winCol = lit ? [1.0, 0.78, 0.45] : [0.25, 0.3, 0.38];
    const front = face === 'x' ? x - w / 2 - 0.02 : z - d / 2 - 0.02; const span = face === 'x' ? d : w;
    const rows = two ? [1.6, 4.4] : [1.7];
    for (const yy of rows) for (const k of [-0.32, 0.32]) {
      const o = k * span;
      if (face === 'x') glow.box(front, yy, z + o, 0.03, 1.1, 0.9, { color: winCol, uv: 0, faces: 'x' }); else glow.box(x + o, yy, front, 0.9, 1.1, 0.03, { color: winCol, uv: 0, faces: 'z' });
    }
    if (face === 'x') box(front - 0.01, 1.5, z, 0.04, 2.0, 0.95, [0.35, 0.18, 0.12], { faces: 'x' }); else box(x, 1.5, front - 0.01, 0.95, 2.0, 0.04, [0.35, 0.18, 0.12], { faces: 'z' });
    if (D >= 1) { // porch / stoop
      if (face === 'x') { box(x - w / 2 - 0.9, 0.3, z, 1.8, 0.12, 2.6, [0.6, 0.58, 0.55]); box(x - w / 2 - 1.6, 1.45, z, 0.12, 2.3, 0.12, C.white); } else { box(x, 0.3, z - d / 2 - 0.9, 2.6, 0.12, 1.8, [0.6, 0.58, 0.55]); box(x, 1.45, z - d / 2 - 1.6, 0.12, 2.3, 0.12, C.white); }
    }
    if (two && r() < 0.5) box(x + (face === 'x' ? 0 : w * 0.25), 0.5 + h + 1.4, z + (face === 'x' ? d * 0.25 : 0), 0.6, 1.4, 0.6, [0.5, 0.25, 0.18]); // chimney
  };

  // ================= ground =================
  flat(-90, -230, 270, 270, -0.14, C.grass);
  // subtle mowing / field variation patches
  for (let i = 0; i < (D >= 1 ? 40 : 14); i++) { const x = 60 + r() * 200, z = -200 + r() * 420; const s = 10 + r() * 30; flat(x, z, x + s, z + s * 0.6, -0.13, C.grass2); }

  // ================= east: walk, lot, street, downtown block =================
  flat(12.1, -34, 14.2, 36, -0.12, C.concrete);                        // walk along the building
  flat(14.2, -34, 15.3, 36, -0.12, C.mulch);                           // landscaping bed
  for (let z = -30; z < 34; z += 2.6) shrub(14.75, z + r() * 0.6, 0.8 + r() * 0.3);
  flat(15.3, -36, 27.5, 38, -0.115, C.asphalt);                        // staff & patrol lot
  box(15.3, -0.06, 1, 0.18, 0.14, 74, C.curb); box(27.5, -0.06, 1, 0.18, 0.14, 74, C.curb);
  // parking stalls: two rows, cars mostly parked nose-in
  for (const [x0, dir] of [[15.5, 1], [27.3, -1]]) {
    for (let k = 0; k < 26; k++) {
      const z = -33 + k * 2.75; box(x0 + dir * 2.7, -0.1, z, 5.4, 0.02, 0.1, C.white, { faces: 'Y' });
      if (k === 25) continue;
      const roll = r(); const zc = z + 1.375; const cx = x0 + dir * 2.6;
      if (x0 < 20 && k > 8 && k < 15) car(cx, zc, dir > 0 ? Math.PI : 0, k % 2 ? [0.94, 0.94, 0.94] : [0.08, 0.08, 0.09], k % 3 ? 'sheriff' : 'patrol');
      else if (roll < 0.62) car(cx, zc, dir > 0 ? Math.PI : 0, pick(C.car), r() < 0.25 ? 'pickup' : 'sedan');
    }
  }
  for (let z = -30; z < 36; z += 2.4) box(21.4, -0.1, z, 0.12, 0.02, 1.2, C.yellow, { faces: 'Y' });   // aisle dashes
  for (const z of [-24, 0, 24]) streetLight(21.4, z, [0, 1], 9);
  // grass strip with trees, sidewalk and curb
  flat(27.6, -240, 29, 260, -0.12, C.grass2);
  for (let z = -60; z < 80; z += 12 + r() * 4) tree(28.3, z, 8 + r() * 3);
  flat(29, -240, 30.8, 260, -0.11, C.concrete);
  box(30.9, -0.07, 10, 0.2, 0.15, 500, C.curb);
  // Main Cross St (north–south)
  flat(31, -240, 39, 260, -0.115, C.asphalt2);
  for (const dx of [-0.13, 0.13]) box(35 + dx, -0.1, 10, 0.12, 0.02, 500, C.yellow, { faces: 'Y' });
  for (const x of [31.4, 38.6]) box(x, -0.1, 10, 0.12, 0.02, 500, C.white, { faces: 'Y' });
  for (let i = 0; i < 8; i++) box(31.6 + i * 0.95, -0.095, 12, 0.5, 0.02, 3, C.white, { faces: 'Y' });                // crosswalk
  // cross street (east–west) at the north end of the block
  flat(39, -44, 270, -36, -0.115, C.asphalt2);
  box(150, -0.1, -40, 240, 0.02, 0.24, C.yellow, { faces: 'Y' });
  flat(39, -46, 270, -44, -0.11, C.concrete); flat(39, -36, 270, -34, -0.11, C.concrete);
  // traffic signal at the corner
  ext.cylinder(39.6, 3, -34.6, 0.12, 6, 6, { color: [0.2, 0.2, 0.22], caps: false }); box(37.4, 5.8, -34.6, 4.4, 0.14, 0.14, [0.2, 0.2, 0.22]); col(39.4, -34.8, 39.8, -34.4, 6);
  box(35.6, 5.3, -34.6, 0.36, 1.0, 0.36, [0.12, 0.12, 0.08]);
  glow.box(35.41, 5.6, -34.6, 0.02, 0.2, 0.2, { color: [0.9, 0.1, 0.05], uv: 0, faces: 'x' }); glow.box(35.41, 5.0, -34.6, 0.02, 0.2, 0.2, { color: [0.1, 0.9, 0.3], uv: 0, faces: 'x' });
  // utility poles with wires along the far side of the street
  const poles = []; for (let z = -120; z <= 140; z += 32) poles.push(z);
  for (const z of poles) { ext.cylinder(39.6, 5, z, 0.14, 10, 6, { color: C.wood, caps: false }); box(39.6, 9.4, z, 2.2, 0.16, 0.16, C.wood); col(39.4, z - 0.2, 39.8, z + 0.2, 10); }
  if (D >= 1) for (let i = 0; i < poles.length - 1; i++) for (const dx of [-0.9, 0.9]) {
    const z0 = poles[i], z1 = poles[i + 1]; const n = 6;
    for (let k = 0; k < n; k++) { const a = k / n, b = (k + 1) / n; const sag = (t) => 9.5 - Math.sin(t * Math.PI) * 0.6; box(39.6 + dx, (sag(a) + sag(b)) / 2, z0 + (z1 - z0) * (a + b) / 2, 0.03, 0.03, (z1 - z0) / n, [0.08, 0.08, 0.08]); }
  }
  for (const z of [-56, -8, 40, 88]) streetLight(30.2, z, [1, 0], 8.5);
  flat(39, -34, 41, 120, -0.11, C.concrete);                            // far sidewalk
  // downtown storefront block (two-story brick, awnings, signs, upper windows)
  let z = -33; let si = 0;
  while (z < 118) {
    const w = 7 + Math.floor(r() * 5); const h = 6.5 + r() * 4.5; const col = pick(C.brick); const x0 = 41.2;
    box(x0 + 8, h / 2, z + w / 2, 16, h, w - 0.08, col);
    box(x0 + 8, h + 0.35, z + w / 2, 16.3, 0.7, w + 0.1, col.map((v) => v * 0.8));            // cornice / parapet
    box(x0 - 0.02, 0.2, z + w / 2, 0.06, 0.4, w - 0.6, [0.35, 0.34, 0.33], { faces: 'x' });   // bulkhead
    glow.box(x0 - 0.03, 1.75, z + w / 2, 0.04, 2.4, w - 1.2, { color: [1.0, 0.78, 0.46], uv: 0, faces: 'x' }); // shop window
    box(x0 - 0.05, 1.75, z + 1.1, 0.06, 2.6, 0.12, [0.15, 0.13, 0.12], { faces: 'xzZ' }); box(x0 - 0.05, 1.75, z + w - 1.1, 0.06, 2.6, 0.12, [0.15, 0.13, 0.12], { faces: 'xzZ' });
    const aw = pick(C.awning); // sloped awning
    ext.quad([x0, 3.6, z + 0.4], [x0, 3.6, z + w - 0.4], [x0 - 1.4, 3.0, z + w - 0.4], [x0 - 1.4, 3.0, z + 0.4], [-0.39, 0.92, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], aw);
    box(x0 - 1.4, 2.82, z + w / 2, 0.04, 0.36, w - 0.8, aw.map((v) => v * 0.85));
    { const sw = Math.min(w - 1.6, 4.8); signs.panel(x0 - 0.06, 4.2, z + w / 2, sw, sw / SIGN_ASPECT, 'x', -1, { uvRect: signUV(si % 11) }); si++; }
    for (let k = 0; k < Math.floor((w - 1) / 2.2); k++) {                                         // upper windows
      const zz = z + 1.4 + k * 2.2; if (zz > z + w - 1) break;
      glow.box(x0 - 0.03, Math.min(h - 1.2, 5.6), zz, 0.04, 1.5, 0.9, { color: r() < 0.35 ? [1.0, 0.8, 0.5] : [0.22, 0.27, 0.34], uv: 0, faces: 'x' });
      box(x0 - 0.06, Math.min(h - 1.2, 5.6) - 0.82, zz, 0.1, 0.1, 1.1, [0.85, 0.83, 0.78]);
    }
    if (D >= 1 && r() < 0.6) box(x0 + 9, h + 1.0, z + w / 2, 2.2, 1.0, 1.6, [0.62, 0.63, 0.64]); // rooftop unit
    z += w;
  }
  // a few cars parked along the street + moving traffic is left to imagination (static scene)
  for (let zz = -26; zz < 110; zz += 6.5 + r() * 5) if (r() < 0.55) car(37.9, zz, Math.PI / 2, pick(C.car));

  // ================= east: houses, church, water tower, grain elevator =================
  const houseRows = D >= 1 ? [66, 82, 98, 114, 130] : [66, 90, 114];
  for (const hx of houseRows) for (let hz = -110; hz < 130; hz += 14 + r() * 6) {
    if (Math.abs(hz - 30) < 18 && hx < 100) continue; // church lot
    if (Math.abs(hz + 26) < 12 && hx > 96 && hx < 118) continue; // water tower lot
    house(hx + r() * 3, hz, 7 + r() * 3, 8 + r() * 3, 'x', r() < 0.35);
    if (r() < 0.75) tree(hx - 6 + r() * 2, hz + 6 + r() * 2);
  }
  // residential streets between the house rows (N–S) and yards
  for (const sx of [60, 106]) flat(sx - 3, -240, sx + 3, 260, -0.11, C.asphalt);
  // church: nave + steeple
  { const cx = 84, cz = 30; const wall = [0.82, 0.8, 0.74];
    box(cx, 3.5, cz, 18, 7, 9, wall); roof(cx, cz, 18, 9, 7, 4.2, [0.22, 0.23, 0.26], true, 0.4);
    box(cx - 10, 6, cz, 4, 12, 4, wall); box(cx - 10, 12.6, cz, 4.4, 1.2, 4.4, [0.7, 0.68, 0.62]);
    ext.cylinder(cx - 10, 17.5, cz, 2.6, 9, 4, { color: [0.24, 0.25, 0.28], r2: 0.02 });
    box(cx - 10, 22.6, cz, 0.12, 1.6, 0.12, [0.85, 0.75, 0.3]); box(cx - 10, 22.9, cz, 0.12, 0.12, 0.8, [0.85, 0.75, 0.3]);
    for (let k = 0; k < 4; k++) glow.box(cx - 9 + k * 4.2, 3.5, cz - 4.52, 1.1, 3.2, 0.03, { color: [0.95, 0.6, 0.3], uv: 0, faces: 'z' });
    glow.box(cx - 12.03, 7.5, cz, 0.03, 1.6, 1.0, { color: [0.95, 0.7, 0.35], uv: 0, faces: 'x' }); }
  // water tower with the town name
  { const tx = 108, tz = -26, top = 34;
    for (const [dx, dz] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) ext.cylinder(tx + dx, top / 2 - 2, tz + dz, 0.3, top - 4, 6, { color: [0.72, 0.75, 0.78], caps: false });
    for (const yy of [8, 16, 24]) { box(tx, yy, tz - 3.2, 6.4, 0.2, 0.2, [0.62, 0.65, 0.68]); box(tx, yy, tz + 3.2, 6.4, 0.2, 0.2, [0.62, 0.65, 0.68]); box(tx - 3.2, yy, tz, 0.2, 0.2, 6.4, [0.62, 0.65, 0.68]); box(tx + 3.2, yy, tz, 0.2, 0.2, 6.4, [0.62, 0.65, 0.68]); }
    ext.cylinder(tx, top / 2, tz, 0.9, top, 8, { color: [0.7, 0.73, 0.76], caps: false });
    ext.sphere(tx, top + 2.5, tz, 6.2, 16, 10, { color: [0.82, 0.85, 0.88], sy: 0.62 });
    ext.cylinder(tx, top + 6.2, tz, 1.4, 1.4, 10, { color: [0.78, 0.8, 0.83], r2: 0.2 });
    signs.panel(tx - 6.1, top + 2.6, tz, 8.4, 8.4 / SIGN_ASPECT, 'x', -1, { uvRect: signUV(11) });
    glow.sphere(tx, top + 7.1, tz, 0.3, 6, 4, { color: [1.4, 0.08, 0.05] }); }
  // grain elevator: silos, headhouse, leg and spouts
  { const ex = 152, ez = 40; const conc = [0.78, 0.77, 0.72];
    for (let k = 0; k < 4; k++) { ext.cylinder(ex, 14, ez - 12 + k * 7.6, 3.7, 28, 14, { color: conc }); ext.cylinder(ex, 28.4, ez - 12 + k * 7.6, 3.7, 0.8, 14, { color: conc.map((v) => v * 0.9), r2: 3.3 }); }
    box(ex, 21, ez + 19, 7, 42, 7, conc.map((v) => v * 0.95)); box(ex, 42.5, ez + 19, 8, 1.4, 8, [0.6, 0.6, 0.58]);
    for (let k = 0; k < 4; k++) box(ex, 30.5 + k * 0.2, ez - 12 + k * 7.6 + (19 - (-12 + k * 7.6)) / 2, 0.3, 0.3, 19 - (-12 + k * 7.6), [0.5, 0.5, 0.48]);
    box(ex - 8, 5, ez + 2, 10, 10, 14, [0.62, 0.64, 0.66]); roof(ex - 8, ez + 2, 10, 14, 10, 2, [0.5, 0.52, 0.55], false);
    glow.box(ex - 3.4, 40, ez + 19, 0.05, 0.5, 0.5, { color: [1.2, 0.9, 0.5], uv: 0, faces: 'x' }); }
  // far tree line hides the edge of the world against the sky
  const ring = D >= 1 ? 3.2 : 5;
  for (let zz = -230; zz < 260; zz += ring + r() * ring) tree(178 + r() * 14, zz, 11 + r() * 8, r() < 0.2 ? 'ever' : undefined);
  for (let xx = 60; xx < 180; xx += ring * 2 + r() * ring) tree(xx, -205 - r() * 10, 11 + r() * 6);
  if (D >= 1) for (let i = 0; i < 40; i++) { const xx = 60 + r() * 110, zz = -150 + r() * 260; tree(xx, zz, 7 + r() * 6); }

  // ================= south: lawn, flags, residential street =================
  flat(-60, 18.1, 12.1, 19.8, -0.12, C.concrete);
  flat(-60, 30.2, 270, 31.8, -0.11, C.concrete);
  flat(-90, 32, 270, 40, -0.115, C.asphalt2);
  box(90, -0.1, 36, 360, 0.02, 0.2, C.yellow, { faces: 'Y' });
  flat(-90, 40.2, 270, 41.8, -0.11, C.concrete);
  // flag poles on the lawn (properly proportioned flags; the texture maps 1:1 so nothing is squished)
  for (const [px, mb, h] of [[-9.5, flagUS, 10], [-6.5, flagIL, 8.8]]) {
    ext.cylinder(px, h / 2, 24.5, 0.07, h, 8, { color: [0.85, 0.86, 0.88], caps: false }); ext.sphere(px, h + 0.12, 24.5, 0.14, 8, 6, { color: [0.85, 0.7, 0.25] });
    box(px, 0.15, 24.5, 1.2, 0.3, 1.2, [0.6, 0.59, 0.56]); col(px - 0.6, 23.9, px + 0.6, 25.1, h);
    const fw = h > 9 ? 2.85 : 2.5, fh = fw / (h > 9 ? 1.9 : 1.667); const strips = D >= 1 ? 6 : 1;
    for (let k = 0; k < strips; k++) { // gentle wave: alternate slight yaw per strip
      const a = k / strips, b = (k + 1) / strips; const wv = (t) => Math.sin(t * Math.PI * 2.2) * 0.12;
      // the flag flies toward -x so that, seen from the building, the canton sits by the pole and text reads correctly
      const x0 = px - 0.07 - a * fw, x1 = px - 0.07 - b * fw; const z0 = 24.5 + wv(a), z1 = 24.5 + wv(b); const yT = h - 0.15, yB = h - 0.15 - fh;
      mb.quad([x0, yB, z0], [x1, yB, z1], [x1, yT, z1], [x0, yT, z0], [0, 0, -1], [[a, 1], [b, 1], [b, 0], [a, 0]], [1, 1, 1]);
    }
  }
  box(-8, 0.35, 21.2, 4.2, 0.7, 0.4, [0.62, 0.6, 0.56]); col(-10.1, 21.0, -5.9, 21.4, 0.7); // low sign wall (blank – the building isn't branded as an official agency)
  for (const [tx, tz] of [[-20, 26], [-1, 27], [6, 22]]) tree(tx, tz, 9 + r() * 2);
  if (D >= 1) { box(-14, 0.75, 26.5, 1.9, 0.06, 0.8, C.wood); box(-14, 0.45, 26.0, 1.9, 0.05, 0.3, C.wood); box(-14, 0.45, 27.0, 1.9, 0.05, 0.3, C.wood); } col(-15, 25.8, -13, 27.2, 0.8); // picnic table
  for (let hx = -80; hx < 150; hx += 15 + r() * 6) { house(hx, 50 + r() * 3, 9 + r() * 3, 7 + r() * 2, 'z', r() < 0.4); if (r() < 0.8) tree(hx + 7, 45 + r() * 2); }
  if (D >= 1) for (let hx = -70; hx < 150; hx += 17 + r() * 6) house(hx, 68 + r() * 3, 9, 8, 'z', r() < 0.3);
  for (const x of [-40, 0, 40, 80]) streetLight(x, 31.4, [0, 1], 8);
  for (let xx = -90; xx < 180; xx += ring * 2 + r() * ring) tree(xx, 178 + r() * 14, 11 + r() * 7);

  // ================= west & north of the building (walkable grounds) =================
  flat(-260, -230, -90, 270, -0.14, C.grass);
  // Police Department frontage: entrance plaza, staff lot north of the PD with a drive to the street
  flat(12.1, -38.6, 15.3, -29.4, -0.115, C.concrete);
  flat(-14, -60, 15.3, -44, -0.115, C.asphalt); box(0.6, -0.06, -44, 29.4, 0.14, 0.18, C.curb); box(0.6, -0.06, -60, 29.4, 0.14, 0.18, C.curb);
  flat(15.3, -60, 31, -52, -0.114, C.asphalt2);                                       // drive out to Main Cross St
  flat(-14, -44, 12.1, -40.3, -0.12, C.grass2); flat(-14, -40.3, 12.1, -40.1, -0.11, C.concrete);
  for (let k = 0; k < 11; k++) { const x = -12 + k * 2.6; box(x, -0.1, -52, 0.1, 0.02, 15.6, C.white, { faces: 'Y' }); if (k < 10 && r() < 0.7) car(x + 1.3, k % 2 ? -47.6 : -56.4, k % 2 ? Math.PI / 2 : -Math.PI / 2, k < 4 ? [0.08, 0.1, 0.18] : pick(C.car), k < 3 ? 'patrol' : r() < 0.3 ? 'pickup' : 'sedan'); }
  for (const z of [-46, -58]) streetLight(2, z, [1, 0], 8);
  for (let x = -12; x < 12; x += 3.2) shrub(x + 1.2, -42.2, 0.8);
  // bollards at the entrance plaza + a bike rack
  for (const z of [-38.2, -36.6, -31.4, -29.8]) { ext.cylinder(15.0, 0.45, z, 0.11, 0.9, 10, { color: [0.85, 0.83, 0.79] }); col(14.85, z - 0.15, 15.15, z + 0.15, 1); }
  for (let i = 0; i < 4; i++) ext.box(13.0, 0.45, -39.4 + i * 0.5, 0.04, 0.8, 0.5, { color: [0.3, 0.32, 0.35], uv: 0 }); col(12.8, -39.7, 13.2, -37.7, 1);
  // west: lawn and trees beyond the sally port and range, a farm field and tree line on the horizon
  for (let i = 0; i < (D >= 1 ? 26 : 10); i++) { const x = -48 - r() * 30, z = -60 + r() * 100; tree(x, z, 8 + r() * 5); }
  flat(-140, -150, -80, 150, -0.13, [0.42, 0.36, 0.22].map((v) => v * (S === 'summer' ? 0.8 : 1.1)));
  for (let zz = -220; zz < 240; zz += ring * 2 + r() * ring) tree(-170 - r() * 14, zz, 10 + r() * 7, r() < 0.2 ? 'ever' : undefined);
  for (let xx = -170; xx < 60; xx += ring * 2 + r() * ring) tree(xx, -200 - r() * 12, 10 + r() * 6);
  flat(-62, -46, -44, -40, -0.115, C.concrete); // walkway north of the range
  bake(ext); bakeTex(asphalt); bakeTex(walk); bakeTex(grass); bake(bark); bake(leaves);
  return { ext, glow, signs, flagUS, flagIL, asphalt, walk, grass, bark, leaves, colliders: cols };
}

/** Ground textures: lighting is uniform on flat ground, so just a gentle overall factor. */
function bakeTex(mb) { for (let i = 0; i < mb.c.length; i++) mb.c[i] *= 0.92; }

/** Bake simple sun + sky lighting into the vertex colours (lighting is static outside). */
function bake(mb) {
  const L = [-0.35, 0.8, 0.48]; const l = Math.hypot(...L); L[0] /= l; L[1] /= l; L[2] /= l;
  for (let i = 0; i < mb.n.length; i += 3) {
    const nx = mb.n[i], ny = mb.n[i + 1], nz = mb.n[i + 2];
    const d = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    const sky = 0.5 + 0.5 * ny;
    const k = 0.42 + 0.5 * d + 0.18 * sky;
    mb.c[i] *= k; mb.c[i + 1] *= k; mb.c[i + 2] *= k * 1.02;
  }
}
