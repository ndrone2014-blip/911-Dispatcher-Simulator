// Builds the White County Emergency Communications Center (Carmi, IL): geometry batches,
// colliders, interactables, light positions, screens and the NPC path graph.
//
// opts.detail controls how much small-prop geometry is generated:
//   0 (Low)    – the essential furniture with simple boxes (fastest).
//   1 (Medium) – rounded furniture, ergonomic chairs, monitor arms, phones, headsets,
//                baseboards, troffer frames, HVAC diffusers, blinds, doors, exit signs.
//   2 (High+)  – everything above plus casters, sprinklers, smoke detectors, desk mics,
//                desk clutter, cable trays, plant leaves and glass partition toppers.
// All geometry is merged into one batch per material, so extra detail costs vertices,
// not draw calls. Colliders, interactables and screens are identical at every level.
import { MeshBuilder } from '../engine/geometry.js';

export const H = 3.6; // ceiling height
export const CONSOLE_XS = [-8.4, -2.8, 2.8, 8.4];
export const ROW_ZS = [-3.2, 1.8];
export const PLAYER_CONSOLE = 1;
export const BUILDING_BOUNDS = [-12.2, 0, -8.2, 12.2, H, 18.2];

// material key -> [shared batch, vertex colour]
const SOLID = {
  dark: ['satin', [0.075, 0.08, 0.09]], plastic: ['satin', [0.11, 0.115, 0.125]], edge: ['satin', [0.2, 0.21, 0.22]], cabinetDark: ['satin', [0.16, 0.17, 0.19]],
  frame: ['satin', [0.23, 0.25, 0.28]], white: ['satin', [0.86, 0.87, 0.87]], red: ['satin', [0.7, 0.07, 0.07]], blue: ['satin', [0.1, 0.3, 0.75]],
  aed: ['satin', [0.75, 0.82, 0.1]], flag: ['satin', [0.62, 0.1, 0.12]], chairShell: ['satin', [0.16, 0.2, 0.26]], pen: ['satin', [0.1, 0.2, 0.6]],
  recycle: ['satin', [0.1, 0.32, 0.62]], cableBlue: ['satin', [0.12, 0.35, 0.8]], cableYellow: ['satin', [0.85, 0.7, 0.1]], print1: ['satin', [0.22, 0.38, 0.42]],
  print2: ['satin', [0.55, 0.36, 0.2]], doorWood: ['satin', [0.52, 0.36, 0.22]],
  rubber: ['matte', [0.05, 0.05, 0.055]], soil: ['matte', [0.12, 0.08, 0.05]], coffee: ['matte', [0.12, 0.06, 0.03]], grille: ['matte', [0.03, 0.03, 0.035]],
  blackgloss: ['gloss', [0.02, 0.02, 0.025]], bezel: ['gloss', [0.015, 0.015, 0.018]], mug: ['gloss', [0.92, 0.92, 0.9]], fridge: ['gloss', [0.9, 0.9, 0.9]], pot: ['gloss', [0.85, 0.85, 0.82]],
  whiteCeil: ['ceilParts', [0.9, 0.9, 0.9]], ceilMetal: ['ceilParts', [0.7, 0.72, 0.75]],
  plant: ['foliage', [0.16, 0.42, 0.16]], plant2: ['foliage', [0.1, 0.32, 0.12]],
};

export function consoleList() {
  const list = [];
  ROW_ZS.forEach((z, r) => CONSOLE_XS.forEach((x, c) => list.push({ index: r * 4 + c, x, z, row: r })));
  return list;
}

export function buildCenter(opts = {}) {
  const D = opts.detail ?? 1;
  const B = {}; // material key -> MeshBuilder
  // Solid-colour parts share a handful of batches (colour lives in the vertices) so the
  // extra detail adds almost no draw calls.
  const mb = (k) => {
    const a = SOLID[k]; const key = a ? a[0] : k;
    const m = (B[key] ||= new MeshBuilder()); m.tint = a ? a[1] : null; m.seg = opts.rseg || (D >= 2 ? 3 : 2);
    return m;
  };
  const colliders = []; const interactables = []; const screens = []; const lights = [];
  const col = (x0, z0, x1, z1) => colliders.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  const wallSeg = (x0, z0, x1, z1, mat = 'wall', y0 = 0, y1 = H, collide = true) => {
    mb(mat).wall(x0, z0, x1, z1, y0, y1, 0.16, { uv: 2 });
    if (D >= 1 && y0 === 0) mb('rubber').wall(x0, z0, x1, z1, 0, 0.1, 0.19, { uv: 0 }); // rubber cove base both sides
    if (D >= 1 && y1 === H && mat !== 'accent') mb('whiteCeil').wall(x0, z0, x1, z1, H - 0.05, H, 0.18, { uv: 0 }); // wall angle trim
    if (collide && y0 < 1.5) { const t = 0.12; if (x0 === x1) col(x0 - t, z0, x0 + t, z1); else col(x0, z0 - t, x1, z1 + t); }
  };
  const floor = (x0, z0, x1, z1, mat, uv = 1) => { mb(mat).box((x0 + x1) / 2, -0.05, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0, { faces: 'Y', uv }); };
  const ceiling = (x0, z0, x1, z1, y = H) => { mb('ceiling').box((x0 + x1) / 2, y + 0.05, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0, { faces: 'y', uv: 1.2 }); };
  const light = (x, z, room, y = H - 0.05, w = 1.2, d = 0.6) => {
    if (D >= 1) {
      mb('troffer').box(x, y - 0.012, z, w, 0.03, d, { faces: 'y', uv: 0 });
      mb('whiteCeil').box(x, y - 0.018, z, w + 0.06, 0.036, d + 0.06, { faces: 'xXzZ', uv: 0 });
    } else mb('lightpanel').box(x, y, z, w, 0.04, d, { faces: 'y', uv: 0 });
    lights.push({ pos: [x, y - 0.35, z], room, base: 1 });
  };
  const vent = (x, z, s = 0.6) => { if (D >= 1) mb('vent').box(x, H - 0.008, z, s, 0.016, s, { faces: 'y', uv: 0 }); };
  const ceilDetail = (x, z) => {
    if (D < 2) return;
    mb('ceilMetal').cylinder(x, H - 0.03, z, 0.012, 0.06, 6); mb('ceilMetal').disc(x, H - 0.061, z, 0.03, 8);
  };
  const smoke = (x, z) => { if (D >= 2) mb('whiteCeil').cylinder(x, H - 0.02, z, 0.07, 0.04, 14); };
  const plant = (x, z, s = 1) => {
    if (D >= 1) {
      mb('pot').cylinder(x, 0.24 * s, z, 0.19 * s, 0.48 * s, 16, { r2: 0.25 * s });
      mb('soil').disc(x, 0.47 * s, z, 0.235 * s, 14);
      const clumps = [[0, 0.78, 0, 0.32, 1.2], [0.14, 1.02, -0.06, 0.22, 1], [-0.12, 1.0, 0.08, 0.2, 1.1], [0.05, 1.22, 0.05, 0.16, 1]];
      clumps.forEach(([dx, dy, dz, r, sy], i) => mb(i % 2 ? 'plant2' : 'plant').sphere(x + dx * s, dy * s, z + dz * s, r * s, 12, 8, { sy }));
      if (D >= 2) for (let i = 0; i < 14; i++) { const a = i * 2.39, rr = (0.22 + (i % 3) * 0.06) * s; mb('plant2').box(x + Math.cos(a) * rr, (0.7 + (i % 4) * 0.13) * s, z + Math.sin(a) * rr, 0.16 * s, 0.012, 0.06 * s, { rotY: -a, uv: 0 }); }
    } else {
      mb('pot').cylinder(x, 0.22 * s, z, 0.2 * s, 0.44 * s, 12, { color: [0.85, 0.85, 0.85], r2: 0.24 * s });
      mb('plant').sphere(x, 0.75 * s, z, 0.34 * s, 10, 7, { sy: 1.25 });
      mb('plant').sphere(x + 0.12 * s, 1.05 * s, z - 0.05, 0.22 * s, 8, 6);
    }
    col(x - 0.25, z - 0.25, x + 0.25, z + 0.25);
  };
  const chair = (x, z, rot = 0, hi = false) => {
    const cr = Math.cos(rot), sr = Math.sin(rot); const P = (dx, dz) => [x + dx * cr + dz * sr, z - dx * sr + dz * cr];
    if (D === 0) {
      mb('fabric').box(x, 0.5, z, 0.52, 0.09, 0.5, { rotY: rot, uv: 0.5, ao: 0.2 });
      const [bx, bz] = P(0, 0.26); mb('fabric').box(bx, hi ? 1.0 : 0.88, bz, 0.5, hi ? 0.78 : 0.56, 0.07, { rotY: rot, uv: 0.5 });
      mb('dark').cylinder(x, 0.27, z, 0.03, 0.42, 8);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + rot; mb('dark').box(x + Math.cos(a) * 0.17, 0.05, z + Math.sin(a) * 0.17, 0.34, 0.04, 0.05, { rotY: -a }); }
      for (const s of [-1, 1]) { const [ax, az] = P(s * 0.28, 0.02); mb('dark').box(ax, 0.66, az, 0.04, 0.04, 0.34, { rotY: rot }); }
      return;
    }
    // ergonomic 24/7 dispatch chair
    mb('fabric').rbox(x, 0.5, z, 0.52, 0.1, 0.5, { rotY: rot, r: 0.04, uv: 0.5, ao: 0.25 });
    mb('dark').rbox(x, 0.44, z, 0.44, 0.04, 0.42, { rotY: rot, r: 0.015, uv: 0 });
    const backH = hi ? 0.74 : 0.56; const [bx, bz] = P(0, 0.27);
    mb('mesh').rbox(bx, 0.6 + backH / 2, bz, 0.47, backH, 0.045, { rotY: rot, rotX: 0.12, r: 0.03, uv: 0.5 });
    const [fx, fz] = P(0, 0.295); mb('dark').rbox(fx, 0.6 + backH / 2, fz, 0.5, backH + 0.03, 0.025, { rotY: rot, rotX: 0.12, r: 0.012, uv: 0 });
    const [sx2, sz2] = P(0, 0.24); mb('dark').box(sx2, 0.55, sz2, 0.06, 0.12, 0.05, { rotY: rot });
    if (D >= 2) { const [lx, lz] = P(0, 0.255); mb('dark').rbox(lx, 0.82, lz, 0.38, 0.07, 0.03, { rotY: rot, rotX: 0.12, r: 0.012 }); }
    if (hi) { const [hx, hz] = P(0, 0.335); mb('fabric').rbox(hx, 0.6 + backH + 0.12, hz, 0.3, 0.14, 0.06, { rotY: rot, r: 0.03, uv: 0.5 }); }
    for (const s of [-1, 1]) {
      const [ax, az] = P(s * 0.29, 0.04); mb('dark').box(ax, 0.6, az, 0.035, 0.18, 0.035, { rotY: rot });
      const [px, pz] = P(s * 0.29, 0.0); mb('rubber').rbox(px, 0.7, pz, 0.075, 0.03, 0.26, { rotY: rot, r: 0.012, uv: 0 });
    }
    mb('chrome').cylinder(x, 0.27, z, 0.025, 0.36, 10);
    mb('dark').cylinder(x, 0.1, z, 0.045, 0.08, 10);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rot;
      mb('dark').rbox(x + Math.cos(a) * 0.17, 0.075, z + Math.sin(a) * 0.17, 0.34, 0.04, 0.05, { rotY: -a, r: 0.015, uv: 0 });
      if (D >= 2) mb('rubber').sphere(x + Math.cos(a) * 0.32, 0.03, z + Math.sin(a) * 0.32, 0.03, 8, 5);
    }
  };
  const tableChair = (x, z, rot) => {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    if (D >= 1) {
      mb('fabricWarm').rbox(x, 0.47, z, 0.44, 0.06, 0.42, { rotY: rot, r: 0.025, uv: 0.5, ao: 0.2 });
      mb('chairShell').rbox(x + 0.21 * sr, 0.76, z + 0.21 * cr, 0.44, 0.44, 0.035, { rotY: rot, rotX: 0.1, r: 0.03, uv: 0.5 });
    } else {
      mb('metal').box(x, 0.46, z, 0.44, 0.05, 0.42, { rotY: rot, uv: 0.5 });
      mb('metal').box(x + 0.21 * sr, 0.74, z + 0.21 * cr, 0.44, 0.5, 0.04, { rotY: rot, uv: 0.5 });
    }
    for (const [dx, dz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) (D >= 1 ? mb('chrome') : mb('dark')).box(x + dx * cr + dz * sr, 0.22, z - dx * sr + dz * cr, 0.025, 0.44, 0.025);
  };
  const screen = (id, kind, x, y, z, w, h, axis, sign, rotY = 0, extra = {}) => {
    const key = extra.shared || `scr_${id}`;
    mb(key).panel(x, y, z, w, h, axis, sign, { rotY });
    if (!screens.find((s) => s.key === key)) screens.push({ id, key, kind, w, h, ...extra });
  };
  const exitSign = (x, z, facing) => { // facing: +1 / -1 along z
    if (D < 1) return;
    mb('white').box(x, 2.56, z + facing * 0.06, 0.4, 0.2, 0.05, { uv: 0 });
    mb('exit').panel(x, 2.56, z + facing * 0.087, 0.36, 0.15, 'z', facing);
  };
  const door = (x0, x1, z, side) => { // leaf swung fully open against the wall
    if (D < 1) return;
    const w = x1 - x0 - 0.08; const zz = z + side * 0.13;
    mb('doorWood').rbox(x0 - w / 2 - 0.02, 1.12, zz, w, 2.22, 0.045, { r: 0.008, uv: 1 });
    mb('chrome').box(x0 - w + 0.1, 1.02, zz + side * 0.045, 0.14, 0.022, 0.03);
    mb('metal').box((x0 + x1) / 2, 0.006, z, x1 - x0, 0.012, 0.24, { uv: 0.5 }); // threshold strip
  };

  // ---------------- Floors & ceilings ----------------
  floor(-12, -8, 12, 8, 'carpet', 1.2); ceiling(-12, -8, 12, 8);
  floor(-12, 8, 12, 10.6, 'carpetDark', 1.2); ceiling(-12, 8, 12, 10.6);
  floor(-12, 10.6, -3, 18, 'tile', 1.2); ceiling(-12, 10.6, -3, 18);
  floor(-3, 10.6, 12, 16, 'carpetDark', 1.2); ceiling(-3, 10.6, 12, 16);

  // ---------------- Main floor walls ----------------
  wallSeg(-12, -8, 12, -8, 'accent');
  wallSeg(-12, -8, -12, 8, 'wall');
  // east wall with 3 windows
  const winZ = [[-6.6, -3.0], [-1.8, 1.8], [3.0, 6.6]];
  let zc = -8;
  for (const [a, b] of winZ) {
    wallSeg(12, zc, 12, a, 'wall'); wallSeg(12, a, 12, b, 'wall', 0, 0.9); wallSeg(12, a, 12, b, 'wall', 2.8, H, false);
    col(11.88, a, 12.12, b);
    mb('glass').panel(12, 1.85, (a + b) / 2, b - a, 1.9, 'x', -1);
    mb(D >= 1 ? 'counter' : 'metal').box(11.9, 0.92, (a + b) / 2, 0.34, 0.05, b - a + 0.1, { uv: 0.5 }); // sill
    for (const zz of [a, b, (a + b) / 2]) mb('frame').box(11.98, 1.85, zz, 0.07, 1.9, 0.07);
    if (D >= 1) {
      mb('frame').box(11.98, 2.79, (a + b) / 2, 0.08, 0.05, b - a); mb('frame').box(11.98, 0.92, (a + b) / 2, 0.08, 0.04, b - a);
      mb('blinds').box(11.86, 2.6, (a + b) / 2, 0.03, 0.34, b - a - 0.04, { faces: 'x', uv: 0 }); // raised blinds stack
      mb('white').box(11.86, 2.78, (a + b) / 2, 0.06, 0.04, b - a - 0.02, { uv: 0 });
    }
    zc = b;
  }
  wallSeg(12, zc, 12, 8, 'wall');
  // south wall with two doorways to the corridor
  wallSeg(-12, 8, -8.4, 8); wallSeg(-6.8, 8, 4.2, 8); wallSeg(5.8, 8, 12, 8);
  wallSeg(-8.4, 8, -6.8, 8, 'wall', 2.3, H, false); wallSeg(4.2, 8, 5.8, 8, 'wall', 2.3, H, false);
  // baseboard along the accent wall (low detail keeps the original single strip)
  if (D === 0) mb('dark').box(0, 0.05, -7.9, 24, 0.1, 0.03, { faces: 'Z' });

  // ---------------- Corridor & rooms ----------------
  wallSeg(-12, 8, -12, 18); wallSeg(12, 8, 12, 10.6);
  wallSeg(-12, 10.6, -6, 10.6); wallSeg(-4.4, 10.6, -3, 10.6);
  wallSeg(-6, 10.6, -4.4, 10.6, 'wall', 2.3, H, false);
  // supervisor office glass front
  mb('glass').panel(-0.8, 1.35, 10.6, 3.6, 2.7, 'z', 1); mb('glass').panel(-0.8, 1.35, 10.6, 3.6, 2.7, 'z', -1);
  col(-2.8, 10.5, 1.0, 10.7);
  wallSeg(-3, 10.6, -2.6, 10.6); wallSeg(-2.6, 10.6, 1.0, 10.6, 'wall', 2.7, H, false); mb('dark').box(-0.8, 0.05, 10.6, 3.6, 0.1, 0.18);
  if (D >= 1) { for (const x of [-2.6, -0.8, 1.0]) mb('frame').box(x, 1.35, 10.6, 0.05, 2.7, 0.08); mb('frame').box(-0.8, 2.68, 10.6, 3.6, 0.04, 0.08); }
  wallSeg(1.0, 10.6, 1.0, 10.6); wallSeg(2.4, 10.6, 3.4, 10.6); wallSeg(1.0, 10.6, 2.4, 10.6, 'wall', 2.3, H, false);
  wallSeg(4.6, 10.6, 7.0, 10.6); wallSeg(3.4, 10.6, 4.6, 10.6, 'wall', 2.3, H, false);
  wallSeg(8.4, 10.6, 12, 10.6); wallSeg(7.0, 10.6, 8.4, 10.6, 'wall', 2.3, H, false);
  // room dividers
  wallSeg(-3, 10.6, -3, 18); wallSeg(3, 10.6, 3, 16); wallSeg(6.6, 10.6, 6.6, 16);
  wallSeg(-3, 16, 12, 16);
  // break room south wall with window
  wallSeg(-12, 18, -10, 18); wallSeg(-5, 18, -3, 18);
  wallSeg(-10, 18, -5, 18, 'wall', 0, 0.9); wallSeg(-10, 18, -5, 18, 'wall', 2.6, H, false); col(-10, 17.9, -5, 18.1);
  mb('glass').panel(-7.5, 1.75, 18, 5, 1.7, 'z', -1);
  if (D >= 1) { for (const x of [-10, -7.5, -5]) mb('frame').box(x, 1.75, 17.98, 0.07, 1.7, 0.07); mb('counter').box(-7.5, 0.92, 17.9, 5.1, 0.05, 0.3, { uv: 0.5 }); mb('blinds').box(-7.5, 2.42, 17.86, 4.96, 0.34, 0.03, { faces: 'z', uv: 0 }); }
  // director office east window (x=12, z 10.6..16)
  wallSeg(12, 10.6, 12, 11.4); wallSeg(12, 15.2, 12, 16); wallSeg(12, 11.4, 12, 15.2, 'wall', 0, 0.9); wallSeg(12, 11.4, 12, 15.2, 'wall', 2.8, H, false); col(11.9, 11.4, 12.1, 15.2);
  mb('glass').panel(12, 1.85, 13.3, 3.8, 1.9, 'x', -1);
  if (D >= 1) { for (const zz of [11.4, 13.3, 15.2]) mb('frame').box(11.98, 1.85, zz, 0.07, 1.9, 0.07); mb('counter').box(11.9, 0.92, 13.3, 0.34, 0.05, 3.9, { uv: 0.5 }); }
  // door frames + open door leaves
  for (const [x0, x1, z, side] of [[-8.4, -6.8, 8, 1], [4.2, 5.8, 8, 1], [-6, -4.4, 10.6, 1], [1.0, 2.4, 10.6, 1], [3.4, 4.6, 10.6, 1], [7.0, 8.4, 10.6, 1]]) {
    const fm = D >= 1 ? 'frame' : 'wood';
    mb(fm).box(x0, 1.15, z, 0.08, 2.3, 0.22, { uv: 1 }); mb(fm).box(x1, 1.15, z, 0.08, 2.3, 0.22, { uv: 1 }); mb(fm).box((x0 + x1) / 2, 2.32, z, x1 - x0 + 0.08, 0.06, 0.22, { uv: 1 });
    door(x0, x1, z, side);
  }
  exitSign(-7.6, 8, -1); exitSign(5.0, 8, -1);
  // exterior views (sky/skyline) behind the windows
  screen('ext_east', 'exterior', 13.6, 2.2, -0.2, 20, 9, 'x', -1, 0, { shared: 'scr_ext', unlit: true });
  screen('ext_east2', 'exterior', 13.0, 2.2, 13.3, 7, 6, 'x', -1, 0, { shared: 'scr_ext', unlit: true });
  screen('ext_south', 'exterior', -7.5, 2.0, 19.0, 9, 6, 'z', -1, 0, { shared: 'scr_ext', unlit: true });

  // ---------------- Lights & ceiling services ----------------
  for (const x of [-7, 0, 7]) for (const z of [-5, -0.4, 4.4]) light(x, z, 'floor', H - 0.05, 1.6, 0.6);
  light(-7, 9.3, 'corridor', H - 0.05, 1.0, 0.5); light(5, 9.3, 'corridor', H - 0.05, 1.0, 0.5);
  light(-9.5, 13, 'break'); light(-6, 15.6, 'break'); light(0, 13.3, 'super'); light(4.8, 13.3, 'radio'); light(9.3, 13.3, 'director');
  // task downlights over consoles
  for (const x of CONSOLE_XS) for (const z of ROW_ZS) {
    if (D >= 1) { mb('lightpanel').disc(x, H - 0.022, z + 0.4, 0.13, 18, { down: true }); mb('whiteCeil').cylinder(x, H - 0.01, z + 0.4, 0.16, 0.02, 18); }
    else mb('lightpanel').box(x, H - 0.04, z + 0.4, 0.5, 0.03, 0.5, { faces: 'y', uv: 0 });
  }
  for (const x of [-10.2, -3.5, 3.5, 10.2]) for (const z of [-2.7, 2.2, 6.6]) vent(x, z);
  vent(-1.5, 9.3, 0.5); vent(-9, 15, 0.5); vent(0, 15.2, 0.5); vent(9.3, 15.2, 0.5);
  for (let x = -10.5; x <= 10.5; x += 3.5) for (const z of [-6.5, -2.4, 1.0, 5.6]) ceilDetail(x + 0.6, z);
  for (const [x, z] of [[-3.5, -5], [3.5, -5], [-3.5, 4.4], [3.5, 4.4], [-1, 9.3], [-8, 13.5], [0, 12.2], [9.3, 12.2]]) smoke(x, z);

  // ---------------- Front: video wall, TVs, logo ----------------
  mb('blackgloss').box(0, 2.15, -7.86, 9.0, 2.8, 0.12, { uv: 0 });
  screen('videowall', 'videowall', 0, 2.15, -7.79, 8.6, 2.5, 'z', 1);
  if (D >= 1) {
    // 4x2 LCD matrix seams + cove light washing the wall above
    for (const x of [-2.15, 0, 2.15]) mb('bezel').box(x, 2.15, -7.783, 0.014, 2.5, 0.006);
    mb('bezel').box(0, 2.15, -7.783, 8.6, 0.014, 0.006);
    mb('coveCool').box(0, 3.58, -7.86, 9.2, 0.02, 0.06, { faces: 'y', uv: 0 });
    mb('frame').box(0, 0.62, -7.75, 9.2, 0.06, 0.12);
  }
  for (const sx of [-1, 1]) {
    mb('blackgloss').box(sx * 7.4, 2.45, -7.87, 2.0, 1.18, 0.08, { uv: 0 });
    screen(`tv${sx > 0 ? 'R' : 'L'}`, 'tv', sx * 7.4, 2.45, -7.82, 1.86, 1.05, 'z', 1, 0, { shared: 'scr_tv' });
  }
  screen('logo', 'sign', 0, 3.38, -7.9, 6.2, 0.36, 'z', 1, 0, { text: 'WHITE COUNTY EMERGENCY COMMUNICATIONS · CARMI, ILLINOIS' });
  // department boards on the west wall
  for (const [i, z] of [[0, -4.2], [1, 0.4], [2, 4.6]]) {
    mb('blackgloss').box(-11.9, 1.95, z, 0.08, 1.62, 2.72, { uv: 0 });
    screen(`board${i}`, 'board', -11.85, 1.95, z, 2.6, 1.5, 'x', 1, 0, { boardIndex: i });
  }
  screen('clock', 'clock', 10.0, 2.95, -7.9, 0.6, 0.6, 'z', 1);
  if (D >= 1) mb('dark').tube(10.0, 2.95, -7.935, 0.33, 0.05, 'z', 28);
  // printers, file cabinets, water cooler on the floor
  if (D >= 1) {
    mb('metal').rbox(-11.5, 0.6, 6.8, 0.6, 1.2, 1.0, { r: 0.015, uv: 0.6, ao: 0.2 });
    for (let i = 0; i < 4; i++) { mb('dark').box(-11.19, 0.2 + i * 0.29, 6.8, 0.01, 0.01, 0.8); mb('chrome').box(-11.18, 0.32 + i * 0.29, 6.8, 0.02, 0.025, 0.16); }
    mb('white').rbox(11.4, 0.45, -7.2, 1.0, 0.9, 0.6, { r: 0.02, uv: 0 }); mb('dark').rbox(11.4, 1.03, -7.2, 0.62, 0.26, 0.46, { r: 0.03 });
    mb('paper').box(11.4, 1.165, -7.25, 0.3, 0.01, 0.22, { uv: 0 }); mb('led').box(11.62, 1.1, -6.97, 0.03, 0.02, 0.01);
  } else {
    mb('metal').box(-11.5, 0.6, 6.8, 0.6, 1.2, 1.0, { uv: 0.6, ao: 0.2 });
    mb('laminate').box(11.4, 0.45, -7.2, 1.0, 0.9, 0.6, { uv: 0.6 }); mb('dark').box(11.4, 1.05, -7.2, 0.6, 0.3, 0.45);
  }
  col(-11.8, 6.3, -11.2, 7.3); col(10.9, -7.5, 11.9, -6.9);
  plant(-11.3, -7.3); plant(11.3, 7.3); plant(-11.3, 9.9, 0.9); plant(11.3, 9.9, 0.9);
  // life-safety equipment by the doors
  if (D >= 1) {
    mb('white').box(-11.9, 1.25, 7.3, 0.1, 0.6, 0.32); mb('red').cylinder(-11.86, 1.15, 7.3, 0.07, 0.42, 12); mb('dark').box(-11.86, 1.4, 7.3, 0.04, 0.06, 0.05);
    mb('red').box(-11.93, 1.3, -6.6, 0.05, 0.16, 0.1); mb('white').box(-11.9, 1.32, -6.6, 0.02, 0.05, 0.06);
    mb('aed').rbox(11.9, 1.3, 7.6, 0.1, 0.42, 0.36, { r: 0.015 }); mb('glassFrost').box(11.84, 1.3, 7.6, 0.01, 0.34, 0.28);
    mb('white').box(-11.92, 1.45, 3.0, 0.03, 0.12, 0.08); // thermostat
  }

  // ---------------- Consoles ----------------
  const consoles = consoleList();
  for (const c of consoles) {
    const { x, z } = c; const isPlayer = c.index === PLAYER_CONSOLE; const seed = c.index * 7 + 3;
    if (D >= 1) {
      mb('laminate').rbox(x, 0.74, z, 2.2, 0.045, 0.86, { r: 0.012, uv: 1 });
      mb('edge').rbox(x, 0.74, z + 0.43, 2.18, 0.05, 0.03, { r: 0.015, uv: 0 });
      for (const s of [-1, 1]) {
        mb('laminate').rbox(x + s * 1.38, 0.74, z + 0.2, 0.75, 0.045, 0.7, { rotY: -s * 0.45, r: 0.012, uv: 1 });
        const ex = x + s * 1.38 + Math.sin(-s * 0.45) * 0.35, ez = z + 0.2 + Math.cos(-s * 0.45) * 0.35;
        mb('edge').rbox(ex, 0.74, ez, 0.73, 0.05, 0.03, { rotY: -s * 0.45, r: 0.015, uv: 0 });
        // height-adjust column under each wing
        mb('frame').box(x + s * 1.45, 0.36, z + 0.25, 0.08, 0.7, 0.08, { rotY: -s * 0.45 }); mb('frame').box(x + s * 1.45, 0.02, z + 0.25, 0.08, 0.04, 0.6, { rotY: -s * 0.45 });
      }
    } else {
      mb('laminate').box(x, 0.74, z, 2.2, 0.045, 0.86, { uv: 1 });
      for (const s of [-1, 1]) mb('laminate').box(x + s * 1.38, 0.74, z + 0.2, 0.75, 0.045, 0.7, { rotY: -s * 0.45, uv: 1 });
    }
    mb('dark').box(x, 0.38, z - 0.41, 2.2, 0.7, 0.04, { uv: 0 });
    for (const s of [-1, 1]) {
      if (D >= 1) {
        mb('cabinetDark').rbox(x + s * 0.82, 0.36, z - 0.05, 0.42, 0.72, 0.68, { r: 0.01, ao: 0.25, uv: 0 });
        for (const yy of [0.24, 0.46, 0.64]) { mb('dark').box(x + s * 0.82, yy, z + 0.29, 0.4, 0.006, 0.006); mb('chrome').box(x + s * 0.82, yy + 0.06, z + 0.295, 0.14, 0.014, 0.012); }
      } else { mb('dark').box(x + s * 0.82, 0.36, z - 0.05, 0.42, 0.72, 0.68, { ao: 0.25 }); mb('metal').box(x + s * 0.82, 0.55, z + 0.29, 0.36, 0.02, 0.01, { uv: 0 }); }
    }
    if (D >= 1) { mb('led').box(x + 0.82, 0.68, z + 0.291, 0.012, 0.012, 0.004); mb('frame').box(x, 0.62, z - 0.3, 1.2, 0.04, 0.16); } // PC power LED, cable tray
    // privacy partition
    if (D >= 1) {
      mb('fabricBlue').rbox(x, 0.98, z - 0.5, 2.5, 0.5, 0.06, { r: 0.01, uv: 0.6 });
      mb('metal').rbox(x, 1.245, z - 0.5, 2.54, 0.03, 0.08, { r: 0.01, uv: 0 });
      for (const s of [-1, 1]) mb('metal').rbox(x + s * 1.265, 0.98, z - 0.5, 0.04, 0.56, 0.08, { r: 0.01, uv: 0 });
      if (D >= 2) mb('glassFrost').box(x, 1.39, z - 0.5, 2.36, 0.26, 0.012);
      // console "status" beacon (green = staffed / available)
      mb('dark').cylinder(x + 1.265, 1.29, z - 0.5, 0.035, 0.06, 12);
      mb(isPlayer ? 'beaconGreen' : (seed % 3 === 0 ? 'beaconAmber' : 'beaconGreen')).cylinder(x + 1.265, 1.35, z - 0.5, 0.03, 0.06, 12);
    } else {
      mb('fabricBlue').box(x, 0.98, z - 0.5, 2.5, 0.5, 0.06, { uv: 0.6 });
      mb('metal').box(x, 1.24, z - 0.5, 2.52, 0.03, 0.08, { uv: 0 });
    }
    // monitors
    const mons = [[0, 0, 0], [-1, 0.66, 0.5], [1, 0.66, -0.5]];
    if (D >= 1) mb('metal').cylinder(x, 1.08, z - 0.4, 0.025, 0.66, 10); // monitor arm pole
    mons.forEach(([s, dx, rot], k) => {
      const mx = x + s * dx, mz = z - 0.22 + Math.abs(s) * 0.12;
      if (!isPlayer || k < 2 || opts.thirdMonitor !== false) {
        if (D >= 1) {
          mb('bezel').rbox(mx, 1.12, mz, 0.635, 0.395, 0.03, { rotY: rot, r: 0.008, uv: 0 });
          const bx = mx - Math.sin(rot) * 0.03, bz = mz - Math.cos(rot) * 0.03;
          mb('plastic').rbox(bx, 1.11, bz, 0.4, 0.26, 0.04, { rotY: rot, r: 0.015, uv: 0 });
          const ax = mx - Math.sin(rot) * 0.06, az = mz - Math.cos(rot) * 0.06;
          mb('metal').wall(x, z - 0.4, ax, az, 1.1, 1.13, 0.03, { uv: 0 });
          mb('led').box(mx + Math.cos(rot) * 0.28 + Math.sin(rot) * 0.016, 0.931, mz - Math.sin(rot) * 0.28 + Math.cos(rot) * 0.016, 0.01, 0.005, 0.004, { rotY: rot });
        } else {
          mb('blackgloss').box(mx, 1.12, mz, 0.64, 0.4, 0.035, { rotY: rot, uv: 0 });
          mb('dark').box(mx, 0.86, mz + 0.04, 0.05, 0.22, 0.05, { rotY: rot }); mb('dark').box(mx, 0.765, mz + 0.03, 0.22, 0.015, 0.16, { rotY: rot });
        }
        const sx = mx + Math.sin(rot) * 0.019, sz = mz + Math.cos(rot) * 0.019;
        if (isPlayer) screen(`mon${k}`, 'monitor', sx, 1.12, sz, 0.6, 0.36, 'z', 1, rot, { monitorIndex: k });
        else screen(`cmon_${c.index}_${k}`, 'coworker', sx, 1.12, sz, 0.6, 0.36, 'z', 1, rot, { shared: `scr_cw${(c.index + k) % 3}` });
      }
    });
    // keyboard, mouse, radio console, phone, headset
    mb('keyboard').box(x, 0.773, z + 0.12, 0.46, 0.018, 0.15, { faces: 'Y', uv: 0 });
    if (D >= 1) {
      mb('dark').rbox(x, 0.766, z + 0.12, 0.47, 0.016, 0.155, { r: 0.006, uv: 0 });
      mb('rubber').rbox(x + 0.36, 0.764, z + 0.13, 0.24, 0.004, 0.2, { r: 0.01, uv: 0 }); // mouse pad
      mb('plastic').sphere(x + 0.36, 0.772, z + 0.13, 0.034, 12, 8, { sy: 0.45 });
      // radio console: tilted touchscreen housing with twin speakers
      mb('radiopanel').box(x - 0.78, 0.83, z - 0.12, 0.42, 0.14, 0.26, { faces: 'YZ', uv: 0 }); mb('dark').box(x - 0.78, 0.83, z - 0.12, 0.42, 0.14, 0.26, { faces: 'xXzy' });
      for (const s of [-1, 1]) { mb('plastic').rbox(x - 0.78 + s * 0.29, 0.83, z - 0.16, 0.13, 0.17, 0.14, { r: 0.015, uv: 0 }); mb('grille').box(x - 0.78 + s * 0.29, 0.835, z - 0.089, 0.1, 0.13, 0.004, { uv: 0 }); }
      // desk phone + handset
      mb('phone').box(x + 0.78, 0.8115, z - 0.08, 0.22, 0.004, 0.2, { faces: 'Y', rotY: -0.3, uv: 0 });
      mb('plastic').rbox(x + 0.78, 0.785, z - 0.08, 0.23, 0.05, 0.21, { rotY: -0.3, r: 0.012, uv: 0 });
      mb('plastic').rbox(x + 0.66, 0.825, z - 0.12, 0.05, 0.04, 0.2, { rotY: -0.3, r: 0.02, uv: 0 });
      // headset on its hook
      const hx = x + 1.05, hz = z + 0.05;
      mb('chrome').cylinder(hx, 0.88, hz, 0.008, 0.25, 8); mb('dark').cylinder(hx, 0.765, hz, 0.05, 0.012, 14);
      for (let i = 0; i <= 6; i++) { const a = Math.PI * (i / 6); mb('dark').box(hx + Math.cos(a) * 0.08, 1.0 + Math.sin(a) * 0.04 - 0.04, hz, 0.03, 0.012, 0.02, { rotY: 0, uv: 0 }); }
      for (const s of [-1, 1]) mb('rubber').tube(hx + s * 0.085, 0.94, hz, 0.035, 0.03, 'x', 14);
      mb('dark').box(hx - 0.06, 0.9, hz + 0.05, 0.012, 0.012, 0.12, { rotY: 0.6 });
      // paperwork + mug (varies by console)
      mb('paper').box(x - 0.7 + (seed % 3) * 0.05, 0.766, z + 0.27, 0.22, 0.008, 0.3, { rotY: 0.15 - (seed % 5) * 0.06, uv: 0 });
      if (seed % 2 === 0 || isPlayer) { const mx = x + 0.58, mz = z + 0.28; mb('mug').cylinder(mx, 0.81, mz, 0.04, 0.095, 14); mb('mug').tube(mx + 0.045, 0.81, mz, 0.018, 0.012, 'x', 8); mb('coffee').disc(mx, 0.85, mz, 0.035, 12); }
      if (D >= 2) {
        // gooseneck desk mic + footswitch + bin
        const gx = x - 1.25, gz = z + 0.08;
        mb('dark').cylinder(gx, 0.775, gz, 0.05, 0.02, 14);
        for (let i = 0; i < 6; i++) mb('chrome').cylinder(gx + i * 0.008, 0.81 + i * 0.05, gz + i * 0.012, 0.008, 0.052, 6);
        mb('rubber').sphere(gx + 0.05, 1.12, gz + 0.08, 0.02, 8, 6, { sy: 1.6 });
        mb('dark').rbox(x - 0.2, 0.025, z + 0.25, 0.18, 0.05, 0.14, { r: 0.02, uv: 0 });
        mb('dark').cylinder(x + 1.15, 0.17, z - 0.15, 0.13, 0.34, 14, { r2: 0.15 });
        mb('pen').tube(x - 0.52, 0.775, z + 0.3, 0.005, 0.14, 'x', 6, { rotY: 0.4 });
      }
    } else {
      mb('dark').box(x, 0.765, z + 0.12, 0.46, 0.012, 0.15, { faces: 'xXzZ' });
      mb('dark').box(x + 0.34, 0.772, z + 0.14, 0.06, 0.025, 0.1);
      mb('radiopanel').box(x - 0.78, 0.83, z - 0.12, 0.42, 0.14, 0.26, { faces: 'YZ', uv: 0 }); mb('dark').box(x - 0.78, 0.83, z - 0.12, 0.42, 0.14, 0.26, { faces: 'xXzy' });
      mb('dark').box(x + 0.78, 0.8, z - 0.08, 0.24, 0.08, 0.22, { rotY: -0.3 });
      mb('dark').cylinder(x - 0.4, 0.8, z + 0.2, 0.07, 0.03, 10, { r2: 0.07 });
    }
    chair(x, z + 0.78, 0, isPlayer && opts.ergoChair);
    col(x - 1.62, z - 0.56, x + 1.62, z + 0.42);
    if (isPlayer) {
      screen('nameplate', 'sign', x + 0.9, 1.33, z - 0.47, 0.5, 0.12, 'z', 1, 0, { text: 'CONSOLE 2 · YOU', small: true });
      interactables.push({ id: 'workstation', kind: 'workstation', label: 'Sit down at your workstation', min: [x - 1.5, 0, z - 0.6], max: [x + 1.5, 1.6, z + 1.3], pri: 2 });
    } else {
      interactables.push({ id: `console_${c.index}`, kind: 'console', consoleIndex: c.index, label: `Dispatch console ${c.index + 1}`, min: [x - 1.5, 0, z - 0.6], max: [x + 1.5, 1.4, z + 0.5], pri: 0 });
    }
  }

  // ---------------- Break room ----------------
  if (D >= 1) {
    mb('cabinet').box(-11.55, 0.45, 13.3, 0.7, 0.9, 3.6, { uv: 0.9, ao: 0.2 }); mb('rubber').box(-11.55, 0.05, 13.3, 0.72, 0.1, 3.6, { faces: 'X' });
    mb('counterTop').rbox(-11.55, 0.93, 13.3, 0.76, 0.04, 3.64, { r: 0.01, uv: 1 });
    mb('cabinet').box(-11.78, 2.1, 13.3, 0.36, 0.7, 3.6, { uv: 0.9 });
    mb('white').box(-11.78, 1.73, 13.3, 0.36, 0.03, 3.6); // light rail
    mb('lightpanel').box(-11.7, 1.71, 13.3, 0.06, 0.005, 3.4, { faces: 'y', uv: 0 });
    // microwave
    mb('plastic').rbox(-11.65, 1.1, 14.9, 0.4, 0.28, 0.5, { r: 0.012 }); mb('blackgloss').box(-11.44, 1.1, 14.83, 0.01, 0.2, 0.33);
  } else {
    mb('laminate').box(-11.55, 0.46, 13.3, 0.7, 0.92, 3.6, { uv: 1, ao: 0.2 }); mb('wood').box(-11.55, 0.94, 13.3, 0.74, 0.04, 3.64, { uv: 1 });
    mb('wood').box(-11.75, 2.1, 13.3, 0.36, 0.7, 3.6, { uv: 1 });
  }
  col(-12, 11.5, -11.15, 15.1);
  // coffee machine
  mb('dark').box(-11.55, 1.17, 12.2, 0.4, 0.42, 0.36); mb('metal').box(-11.38, 1.05, 12.2, 0.05, 0.12, 0.2); mb('red').box(-11.35, 1.3, 12.1, 0.02, 0.03, 0.03);
  if (D >= 1) { mb('glass').cylinder(-11.42, 1.05, 12.32, 0.06, 0.14, 12); mb('coffee').cylinder(-11.42, 1.01, 12.32, 0.055, 0.06, 12); mb('led').box(-11.34, 1.32, 12.25, 0.01, 0.02, 0.02); }
  if (opts.espresso) { mb('metal').box(-11.55, 1.13, 13.0, 0.42, 0.34, 0.42, { uv: 0.4 }); mb('blackgloss').box(-11.55, 1.33, 13.0, 0.38, 0.04, 0.3); }
  interactables.push({ id: 'coffee', kind: 'coffee', label: opts.espresso ? 'Make an espresso' : 'Grab a coffee', min: [-12, 0.8, 11.8], max: [-11.1, 1.6, 13.4], pri: 1 });
  mb('metal').box(-11.55, 0.97, 14.3, 0.32, 0.02, 0.5); // sink
  if (D >= 1) { mb('chrome').cylinder(-11.78, 1.08, 14.3, 0.015, 0.22, 8); mb('chrome').tube(-11.7, 1.18, 14.3, 0.012, 0.18, 'x', 8); }
  // fridge
  if (D >= 1) { mb('fridge').rbox(-11.5, 0.92, 16.6, 0.8, 1.84, 0.76, { r: 0.03, uv: 0, ao: 0.1 }); mb('dark').box(-11.09, 1.3, 16.6, 0.005, 0.01, 0.74); }
  else mb('fridge').box(-11.5, 0.92, 16.6, 0.8, 1.84, 0.76, { uv: 0, ao: 0.1 });
  mb('metal').box(-11.08, 1.2, 16.35, 0.03, 0.5, 0.03); col(-11.95, 16.2, -11.05, 17.0);
  interactables.push({ id: 'fridge', kind: 'fridge', label: 'Open the fridge', min: [-12, 0, 16.2], max: [-11, 1.9, 17], pri: 1 });
  // vending machine
  if (D >= 1) mb('red').rbox(-3.55, 0.95, 17.3, 0.9, 1.9, 0.75, { r: 0.02, uv: 0, ao: 0.15 }); else mb('red').box(-3.55, 0.95, 17.3, 0.9, 1.9, 0.75, { uv: 0, ao: 0.15 });
  mb('vendfront').panel(-3.55, 1.15, 16.92, 0.7, 1.3, 'z', -1); col(-4.05, 16.9, -3.05, 17.7);
  if (D >= 1) { mb('dark').box(-3.55, 0.3, 16.92, 0.6, 0.18, 0.02); mb('glass').panel(-3.55, 1.15, 16.91, 0.7, 1.3, 'z', -1); }
  interactables.push({ id: 'vending', kind: 'vending', label: 'Buy a snack', min: [-4.1, 0, 16.8], max: [-3, 1.9, 17.7], pri: 1 });
  // table and chairs
  if (D >= 1) mb('wood').rbox(-7.5, 0.74, 13.8, 1.7, 0.05, 1.0, { r: 0.02, uv: 1 }); else mb('wood').box(-7.5, 0.74, 13.8, 1.7, 0.05, 1.0, { uv: 1 });
  mb('dark').cylinder(-7.5, 0.37, 13.8, 0.06, 0.72, 10); mb('dark').cylinder(-7.5, 0.02, 13.8, 0.35, 0.04, 14);
  col(-8.4, 13.25, -6.6, 14.35);
  for (const [dx, dz, r] of [[-0.5, -0.75, Math.PI], [0.5, -0.75, Math.PI], [-0.5, 0.75, 0], [0.5, 0.75, 0]]) tableChair(-7.5 + dx, 13.8 + dz, r);
  // couch
  if (D >= 1) {
    mb('fabricWarm').rbox(-8, 0.2, 17.45, 2.4, 0.24, 0.8, { r: 0.04, uv: 0.5, ao: 0.3 });
    for (const dx of [-0.75, 0, 0.75]) mb('fabricWarm').rbox(-8 + dx, 0.38, 17.4, 0.72, 0.14, 0.66, { r: 0.05, uv: 0.5 });
    mb('fabricWarm').rbox(-8, 0.64, 17.78, 2.36, 0.5, 0.22, { r: 0.07, uv: 0.5, rotX: 0.1 });
    for (const s of [-1, 1]) mb('fabricWarm').rbox(-8 + s * 1.13, 0.48, 17.45, 0.18, 0.4, 0.8, { r: 0.06, uv: 0.5 });
    for (const [dx, dz] of [[-1.1, -0.32], [1.1, -0.32], [-1.1, 0.32], [1.1, 0.32]]) mb('dark').cylinder(-8 + dx, 0.04, 17.45 + dz, 0.025, 0.08, 6);
    mb('fabricBlue').rbox(-8.85, 0.56, 17.55, 0.36, 0.34, 0.12, { r: 0.05, rotY: 0.3, rotX: 0.2, uv: 0.5 }); // throw pillow
  } else {
    mb('fabricWarm').box(-8, 0.24, 17.45, 2.4, 0.32, 0.8, { uv: 0.5, ao: 0.3 }); mb('fabricWarm').box(-8, 0.62, 17.78, 2.4, 0.52, 0.2, { uv: 0.5 });
    for (const s of [-1, 1]) mb('fabricWarm').box(-8 + s * 1.15, 0.5, 17.45, 0.16, 0.36, 0.8, { uv: 0.5 });
  }
  col(-9.3, 17.0, -6.7, 17.9);
  interactables.push({ id: 'couch', kind: 'couch', label: 'Sit on the couch for a minute', min: [-9.2, 0, 17], max: [-6.8, 1, 17.9], pri: 0 });
  // break room TV
  mb('blackgloss').box(-3.1, 2.0, 13.8, 0.06, 0.95, 1.6, { uv: 0 });
  screen('tvBreak', 'tv', -3.16, 2.0, 13.8, 1.5, 0.86, 'x', -1, 0, { shared: 'scr_tv' });
  interactables.push({ id: 'tv_break', kind: 'tv', label: 'Watch the news', min: [-3.3, 1.4, 12.9], max: [-3.0, 2.6, 14.7], pri: 0 });
  screen('breaksign', 'sign', -5.2, 2.55, 10.48, 1.4, 0.24, 'z', -1, 0, { text: 'BREAK ROOM' });
  plant(-3.5, 11.2, 0.9);
  if (D >= 1) { mb('dark').cylinder(-4.2, 0.22, 11.15, 0.17, 0.44, 14, { r2: 0.19 }); mb('recycle').cylinder(-4.65, 0.22, 11.15, 0.17, 0.44, 14, { r2: 0.19 }); }

  // ---------------- Supervisor office ----------------
  if (D >= 1) {
    mb('wood').rbox(0, 0.74, 13.9, 2.0, 0.05, 0.9, { r: 0.015, uv: 1 }); mb('wood').box(0, 0.37, 13.5, 2.0, 0.7, 0.05, { uv: 1 });
    for (const s of [-1, 1]) mb('wood').box(s * 0.95, 0.37, 13.9, 0.06, 0.72, 0.86, { uv: 1 });
    mb('paper').box(0.55, 0.77, 13.75, 0.22, 0.01, 0.3, { rotY: 0.2, uv: 0 }); mb('phone').box(-0.7, 0.79, 13.75, 0.2, 0.004, 0.18, { faces: 'Y', rotY: 0.2, uv: 0 }); mb('plastic').rbox(-0.7, 0.77, 13.75, 0.21, 0.04, 0.19, { rotY: 0.2, r: 0.01 });
  } else {
    mb('wood').box(0, 0.74, 13.9, 2.0, 0.05, 0.9, { uv: 1 }); mb('wood').box(0, 0.37, 13.5, 2.0, 0.7, 0.05, { uv: 1 });
    for (const s of [-1, 1]) mb('wood').box(s * 0.95, 0.37, 13.9, 0.06, 0.72, 0.86, { uv: 1 });
  }
  col(-1.05, 13.4, 1.05, 14.4);
  for (const s of [-1, 1]) { mb('blackgloss').box(s * 0.36, 1.06, 14.15, 0.56, 0.34, 0.03, { rotY: Math.PI + s * -0.2, uv: 0 }); mb('dark').box(s * 0.36, 0.86, 14.2, 0.04, 0.2, 0.04); screen(`supmon${s}`, 'coworker', s * 0.36 - 0.0, 1.06, 14.13, 0.52, 0.3, 'z', -1, s * -0.2, { shared: 'scr_cw1' }); }
  chair(0, 14.75, Math.PI);
  mb('metal').box(2.6, 0.65, 15.6, 0.5, 1.3, 0.6, { uv: 0.6, ao: 0.2 }); col(2.3, 15.25, 2.9, 15.95);
  plant(-2.6, 15.6, 0.9);
  interactables.push({ id: 'supervisor_desk', kind: 'supervisor_desk', label: 'Use the supervisor console', min: [-1.1, 0, 13.3], max: [1.1, 1.4, 14.5], pri: 1 });
  screen('supsign', 'sign', 1.7, 2.55, 10.48, 1.4, 0.24, 'z', -1, 0, { text: 'SHIFT SUPERVISOR' });

  // ---------------- Radio equipment room ----------------
  for (let i = 0; i < 3; i++) { mb('dark').box(3.45, 1.0, 11.6 + i * 1.3, 0.6, 2.0, 1.1, { ao: 0.2 }); mb('rack').panel(3.76, 1.1, 11.6 + i * 1.3, 1.0, 1.7, 'x', 1); }
  col(3.1, 11.0, 3.8, 15.3);
  for (let i = 0; i < 2; i++) { mb('dark').box(6.15, 1.0, 12.4 + i * 1.6, 0.6, 2.0, 1.1, { ao: 0.2 }); mb('rack').panel(5.84, 1.1, 12.4 + i * 1.6, 1.0, 1.7, 'x', -1); }
  col(5.8, 11.8, 6.5, 14.6);
  if (D >= 1) {
    for (const zz of [11.0, 12.25, 12.95, 14.2, 14.9]) mb('frame').box(3.78, 1.0, zz, 0.04, 2.0, 0.04);
    for (const zz of [12.86, 13.14]) mb('frame').box(4.8, 2.3, zz, 3.4, 0.05, 0.02); // cable ladder
    for (let i = 0; i < 10; i++) mb('frame').box(3.3 + i * 0.33, 2.3, 13.0, 0.02, 0.02, 0.28);
    if (D >= 2) for (let i = 0; i < 12; i++) mb(['cableBlue', 'cableYellow', 'dark'][i % 3]).box(4.8, 2.32 + (i % 2) * 0.018, 12.9 + i * 0.019, 3.3, 0.018, 0.018);
  }
  interactables.push({ id: 'radio_room', kind: 'radio_room', label: 'Check the radio system racks', min: [3.1, 0, 11], max: [6.5, 2.2, 15.4], pri: 0 });
  screen('radiosign', 'sign', 4.0, 2.55, 10.48, 1.2, 0.24, 'z', -1, 0, { text: 'RADIO ROOM' });

  // ---------------- Director office ----------------
  mb('wood').box(9.3, 0.74, 14.0, 2.0, 0.05, 0.95, { uv: 1 }); mb('wood').box(9.3, 0.37, 13.55, 2.0, 0.7, 0.05, { uv: 1 });
  for (const s of [-1, 1]) mb('wood').box(9.3 + s * 0.95, 0.37, 14.0, 0.06, 0.72, 0.9, { uv: 1 });
  col(8.25, 13.45, 10.35, 14.5);
  mb('blackgloss').box(9.3, 1.06, 14.25, 0.6, 0.36, 0.03, { rotY: Math.PI, uv: 0 }); screen('dirmon', 'coworker', 9.3, 1.06, 14.23, 0.56, 0.32, 'z', -1, 0, { shared: 'scr_cw2' });
  chair(9.3, 14.85, Math.PI, true); tableChair(8.8, 12.6, 0); tableChair(9.8, 12.6, 0);
  mb('wood').box(11.75, 1.1, 14.8, 0.4, 2.2, 1.8, { uv: 1, ao: 0.2 }); col(11.5, 13.85, 12, 15.75);
  for (let i = 0; i < 4; i++) mb('books').box(11.55, 0.5 + i * 0.5, 14.8, 0.02, 0.3, 1.6, { faces: 'x', uv: 0 });
  if (D >= 1) { for (let i = 0; i < 5; i++) mb('wood').box(11.6, 0.33 + i * 0.5, 14.8, 0.32, 0.03, 1.7, { uv: 1 }); mb('flag').box(7.15, 1.2, 15.6, 0.01, 0.8, 0.5); mb('chrome').cylinder(6.95, 1.1, 15.6, 0.012, 2.2, 6); }
  plant(7.0, 15.6, 1.0);
  interactables.push({ id: 'director_desk', kind: 'director_desk', label: 'Look at the director\'s desk', min: [8.2, 0, 13.4], max: [10.4, 1.4, 14.6], pri: 0 });
  screen('dirsign', 'sign', 7.7, 2.55, 10.48, 1.6, 0.24, 'z', -1, 0, { text: 'COMMUNICATIONS DIRECTOR' });

  // ---------------- Corridor details ----------------
  screen('shiftboard', 'shiftboard', -1.5, 1.6, 8.09, 2.4, 1.2, 'z', 1);
  mb(D >= 1 ? 'frame' : 'wood').box(-1.5, 1.6, 8.05, 2.5, 1.3, 0.04, { uv: 1 });
  interactables.push({ id: 'shiftboard', kind: 'shiftboard', label: 'Read the shift board', min: [-2.8, 0.9, 7.9], max: [-0.2, 2.3, 8.4], pri: 0 });
  mb('fridge').box(10.9, 0.55, 10.2, 0.4, 1.1, 0.4); mb('waterjug').cylinder(10.9, 1.3, 10.2, 0.15, 0.4, 12, { color: [0.6, 0.8, 1] }); col(10.65, 9.95, 11.15, 10.45);
  if (D >= 1) { mb('blue').box(10.86, 0.85, 9.995, 0.04, 0.04, 0.02); mb('red').box(10.94, 0.85, 9.995, 0.04, 0.04, 0.02); mb('dark').box(10.9, 0.62, 10.0, 0.24, 0.02, 0.06); }
  interactables.push({ id: 'water', kind: 'water', label: 'Get a cup of water', min: [10.6, 0, 9.9], max: [11.2, 1.6, 10.5], pri: 0 });
  for (const [x, t] of [[-11.95, 'RESTROOMS →']]) screen('restsign', 'sign', x + 0.05, 2.3, 9.3, 1.4, 0.24, 'x', 1, 0, { text: t });
  if (D >= 1) { // framed prints in the corridor
    for (const x of [-9.5, 6.4, 10.3]) { mb('frame').box(x, 1.65, 10.49, 0.9, 0.65, 0.025); mb(x > 0 ? 'print2' : 'print1').box(x, 1.65, 10.475, 0.8, 0.55, 0.01, { uv: 0 }); }
  }

  if (D >= 1) buildLawEnforcement({ mb, col, D });

  if (opts.thanksgiving) buildThanksgiving({ mb, col, screen, consoles });

  return { batches: B, colliders, interactables, screens, lights, consoles };
}


// ---------------- Police / sheriff details ----------------
function buildLawEnforcement({ mb, col, D }) {
  // US and Illinois flags on floor stands flanking the video wall
  for (const [x, mat] of [[-5.15, 'flagUS'], [5.15, 'flagIL']]) {
    const z = -7.5;
    mb('gold').cylinder(x, 0.03, z, 0.2, 0.06, 18); mb('chrome').cylinder(x, 1.25, z, 0.018, 2.5, 8); mb('gold').sphere(x, 2.55, z, 0.05, 10, 8);
    // draped flag: four slightly angled panels read as folds
    const folds = [[-0.32, 0.18], [-0.1, -0.2], [0.12, 0.2], [0.33, -0.15]];
    folds.forEach(([dx, a], i) => mb(mat).panel(x + (x < 0 ? -0.36 : 0.36) + dx * 0.55, 2.05, z + 0.02 + (i % 2) * 0.03, 0.27, 0.8, 'z', 1, { rotY: a, uvRect: [i / 4, 0, (i + 1) / 4, 1] }));
    col(x - 0.22, z - 0.22, x + 0.22, z + 0.22);
  }
  // Sheriff's star seal + award plaques on the main-floor south wall (facing the consoles)
  mb('seal').panel(-1.3, 2.25, 7.905, 1.15, 1.15, 'z', -1);
  mb('gold').tube(-1.3, 2.25, 7.925, 0.6, 0.02, 'z', 32);
  for (const [i, x] of [[0, -3.1], [1, -2.55], [2, -0.05], [3, 0.5]]) {
    mb('wood').rbox(x, 2.25 + (i % 2 ? 0.0 : 0.1), 7.93, 0.36, 0.46, 0.025, { r: 0.006, uv: 1 });
    mb('gold').box(x, 2.22 + (i % 2 ? 0.0 : 0.1), 7.915, 0.26, 0.2, 0.006);
  }
  // Officer lockers along the corridor (north wall, facing the corridor)
  mb('lockers').box(7.9, 0.95, 8.33, 3.2, 1.9, 0.44, { faces: 'Z', uv: 0, uvFront: [[0, 0], [2, 0], [2, 1], [0, 1]] });
  mb('satin').box(7.9, 0.95, 8.33, 3.2, 1.9, 0.44, { faces: 'xXy', color: [0.3, 0.34, 0.4] });
  mb('satin').box(7.9, 1.92, 8.31, 3.24, 0.04, 0.48, { color: [0.26, 0.29, 0.34] });
  col(6.25, 8.0, 9.55, 8.6);
  // duty bag and boots in front of the lockers
  mb('matte').rbox(6.9, 0.14, 8.78, 0.6, 0.28, 0.3, { r: 0.06, color: [0.07, 0.07, 0.08] });
  for (const dx of [0, 0.14]) mb('matte').rbox(8.7 + dx, 0.07, 8.75, 0.11, 0.14, 0.28, { r: 0.04, color: [0.05, 0.05, 0.05] });
  // Portable-radio charging rack (8 bays with charge LEDs) on the corridor wall
  mb('satin').rbox(1.6, 1.32, 8.13, 1.1, 0.16, 0.14, { r: 0.015, color: [0.1, 0.11, 0.12] });
  for (let i = 0; i < 8; i++) {
    const x = 1.15 + i * 0.13;
    mb('satin').rbox(x, 1.47, 8.13, 0.07, 0.16, 0.05, { r: 0.01, color: [0.06, 0.06, 0.07] });
    mb('satin').cylinder(x + 0.02, 1.62, 8.13, 0.006, 0.14, 6, { color: [0.05, 0.05, 0.05] });
    mb(i === 3 || i === 6 ? 'beaconAmber' : 'beaconGreen').box(x, 1.37, 8.205, 0.025, 0.012, 0.004);
  }
  // Key cabinet next to it
  mb('satin').rbox(0.55, 1.45, 8.11, 0.4, 0.5, 0.08, { r: 0.01, color: [0.55, 0.57, 0.6] });
  mb('glassFrost').box(0.55, 1.45, 8.152, 0.34, 0.42, 0.004);
  // BOLO / attempt-to-locate board
  mb('cork').panel(-4.8, 1.6, 8.09, 1.5, 0.94, 'z', 1);
  mb('satin').box(-4.8, 1.6, 8.07, 1.56, 1.0, 0.03, { color: [0.36, 0.25, 0.14] });
  // Jacket rack with duty jackets (one high-vis)
  mb('chrome').cylinder(10.3, 0.85, 8.4, 0.02, 1.7, 8); mb('satin').cylinder(10.3, 0.02, 8.4, 0.22, 0.04, 16, { color: [0.1, 0.1, 0.11] });
  for (const [a, c] of [[0, [0.09, 0.12, 0.2]], [2.1, [0.75, 0.82, 0.12]], [4.2, [0.12, 0.12, 0.13]]]) {
    mb('matte').rbox(10.3 + Math.cos(a) * 0.17, 1.28, 8.4 + Math.sin(a) * 0.17, 0.3, 0.62, 0.14, { r: 0.05, rotY: -a, color: c });
  }
  col(10.05, 8.15, 10.55, 8.65);
}

// ---------------- Thanksgiving decorations ----------------
function buildThanksgiving({ mb, col, screen, consoles }) {
  const pumpkin = (x, y, z, r = 0.16, mat = 'pumpkin') => {
    mb(mat).sphere(x, y + r * 0.78, z, r, 12, 8, { sy: 0.78 });
    if (r > 0.1) for (const a of [0, 1.05, 2.1]) mb(mat).sphere(x + Math.cos(a) * r * 0.42, y + r * 0.76, z + Math.sin(a) * r * 0.42, r * 0.72, 10, 7, { sy: 0.95 });
    mb('stem').cylinder(x, y + r * 1.62, z, r * 0.1, r * 0.4, 6, { r2: r * 0.07 });
  };
  const bale = (x, z, w = 1.0, d = 0.5, h = 0.42, rot = 0) => {
    mb('hay').box(x, h / 2, z, w, h, d, { rotY: rot, uv: 0.4, ao: 0.25 });
    const c = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot)); const hx = (w * c + d * sn) / 2 + 0.05, hz = (w * sn + d * c) / 2 + 0.05;
    col(x - hx, z - hz, x + hx, z + hz);
    return h;
  };
  const LEAVES = ['leafRed', 'leafOrange', 'leafGold'];
  // falling-leaf garland: a sagging string of leaves between two points on a wall
  const garland = (x0, x1, y, z, sag = 0.18, axis = 'z') => {
    const n = Math.max(6, Math.round(Math.abs(x1 - x0) / 0.16));
    for (let i = 0; i <= n; i++) {
      const k = i / n; const x = x0 + (x1 - x0) * k; const yy = y - Math.sin(k * Math.PI) * sag;
      const mat = LEAVES[i % 3]; const rot = (i % 5) * 0.6;
      if (axis === 'z') mb(mat).box(x, yy, z, 0.13, 0.1, 0.012, { rotY: rot * 0.25, uv: 0 });
      else mb(mat).box(z, yy, x, 0.012, 0.1, 0.13, { rotY: rot * 0.25, uv: 0 });
      if (i % 4 === 2) { if (axis === 'z') mb('stem').sphere(x, yy - 0.06, z, 0.025, 6, 4); else mb('stem').sphere(z, yy - 0.06, x, 0.025, 6, 4); }
    }
  };

  // Banners on the front wall above the side TVs
  screen('tg_banner_l', 'banner', -7.4, 3.31, -7.9, 2.7, 0.48, 'z', 1, 0, { text: 'HAPPY THANKSGIVING', unlit: true });
  screen('tg_banner_r', 'banner', 7.4, 3.31, -7.9, 2.7, 0.48, 'z', 1, 0, { text: 'THANK YOU, FIRST RESPONDERS', unlit: true });
  // leaf garland along the bottom of the video wall and over both side TVs
  garland(-4.4, 4.4, 0.76, -7.78, 0.08);
  garland(-8.4, -6.4, 3.02, -7.8, 0.12); garland(6.4, 8.4, 3.02, -7.8, 0.12);
  // hay bale displays in the front corners of the floor
  let h = bale(-9.9, -7.35, 1.1, 0.5); pumpkin(-10.15, h, -7.35, 0.17); pumpkin(-9.65, h, -7.3, 0.11, 'gourd'); pumpkin(-9.4, 0, -6.85, 0.2);
  h = bale(9.4, -7.4, 1.0, 0.5); pumpkin(9.2, h, -7.4, 0.15); pumpkin(9.65, h, -7.35, 0.1, 'gourd'); pumpkin(8.7, 0, -7.0, 0.18); col(8.45, -7.25, 8.95, -6.75);
  col(-9.65, -7.1, -9.15, -6.6);
  // a little pumpkin on every console desk wing
  for (const c of consoles) pumpkin(c.x - 1.45, 0.765, c.z + 0.25, 0.07);
  // corridor: pumpkins beside the shift board and at the door frames
  pumpkin(-3.15, 0, 8.32, 0.16); pumpkin(-3.55, 0, 8.3, 0.1, 'gourd'); col(-3.75, 8.1, -2.9, 8.55);
  pumpkin(3.85, 0, 8.32, 0.15); col(3.65, 8.1, 4.05, 8.55);
  garland(-2.7, -0.3, 2.42, 8.03, 0.1);
  // break room potluck: tablecloth, turkey, pies and gourds on the table
  const tx = -7.5, tz = 13.8, ty = 0.767;
  mb('tablecloth').box(tx, ty + 0.004, tz, 1.78, 0.008, 1.08, { uv: 0.6 });
  mb('tablecloth').box(tx, ty - 0.12, tz - 0.545, 1.78, 0.24, 0.006, { uv: 0.6 }); mb('tablecloth').box(tx, ty - 0.12, tz + 0.545, 1.78, 0.24, 0.006, { uv: 0.6 });
  mb('plate').cylinder(tx, ty + 0.015, tz, 0.26, 0.02, 18, { r2: 0.22 });
  mb('turkey').sphere(tx, ty + 0.1, tz, 0.17, 14, 10, { sy: 0.62 });
  for (const s of [-1, 1]) { mb('turkey').sphere(tx + 0.13, ty + 0.08, tz + s * 0.11, 0.06, 8, 6, { sy: 0.8 }); mb('plate').sphere(tx + 0.19, ty + 0.09, tz + s * 0.13, 0.022, 6, 4); }
  for (const [dx, dz] of [[-0.6, -0.25], [0.6, 0.28]]) { mb('pie').cylinder(tx + dx, ty + 0.025, tz + dz, 0.15, 0.045, 16, { r2: 0.13 }); mb('pieFill').cylinder(tx + dx, ty + 0.05, tz + dz, 0.12, 0.012, 16); }
  mb('stem').cylinder(tx - 0.55, ty + 0.05, tz + 0.3, 0.13, 0.1, 12, { r2: 0.16 }); // basket
  pumpkin(tx - 0.58, ty + 0.08, tz + 0.27, 0.06); pumpkin(tx - 0.5, ty + 0.08, tz + 0.34, 0.05, 'gourd'); pumpkin(tx - 0.49, ty + 0.08, tz + 0.24, 0.045, 'pie');
  mb('plate').cylinder(tx + 0.5, ty + 0.01, tz - 0.3, 0.1, 0.012, 12); mb('plate').cylinder(tx - 0.2, ty + 0.01, tz + 0.36, 0.1, 0.012, 12);
  screen('tg_potluck', 'banner', -9.0, 2.45, 10.72, 2.6, 0.46, 'z', 1, 0, { text: 'THANKSGIVING POTLUCK · THURSDAY', unlit: true });
  garland(-11.6, -6.4, 2.86, 10.73, 0.16);
  // hay bale + pumpkins in the break room corner by the window
  h = bale(-5.8, 17.55, 0.9, 0.45, 0.4); pumpkin(-6.0, h, 17.55, 0.14); pumpkin(-5.6, h, 17.5, 0.09, 'gourd');
}

// ---------------- NPC navigation graph ----------------
export function buildNavGraph() {
  const nodes = []; const add = (id, x, z) => nodes.push({ id, x, z, links: [] });
  const link = (a, b) => { const A = nodes.find((n) => n.id === a), B2 = nodes.find((n) => n.id === b); if (A && B2) { A.links.push(b); B2.links.push(a); } };
  const xs = [-11, -5.6, 0, 5.6, 11];
  const lanes = { front: -6.2, mid: -0.75, back: 4.9, door: 7.2 };
  for (const [ln, z] of Object.entries(lanes)) for (const x of xs) add(`${ln}_${x}`, x, z);
  for (const [ln] of Object.entries(lanes)) for (let i = 0; i < xs.length - 1; i++) link(`${ln}_${xs[i]}`, `${ln}_${xs[i + 1]}`);
  const order = Object.keys(lanes);
  for (const x of xs) for (let i = 0; i < order.length - 1; i++) link(`${order[i]}_${x}`, `${order[i + 1]}_${x}`);
  // console seat approaches
  consoleList().forEach((c) => {
    const aisle = c.row === 0 ? 'mid' : 'back'; const az = c.row === 0 ? -1.7 : 3.55;
    add(`seat_${c.index}`, c.x, az);
    const nearest = xs.reduce((a, b) => (Math.abs(b - c.x) < Math.abs(a - c.x) ? b : a));
    add(`ap_${c.index}`, c.x, lanes[aisle]); link(`seat_${c.index}`, `ap_${c.index}`);
    // connect approach into lane neighbours
    const left = xs.filter((x) => x <= c.x).pop(), right = xs.find((x) => x >= c.x);
    link(`ap_${c.index}`, `${aisle}_${left}`); link(`ap_${c.index}`, `${aisle}_${right}`); void nearest;
  });
  // doors and corridor
  add('dW_in', -7.6, 7.2); add('dW_out', -7.6, 9.3); add('dE_in', 5.0, 7.2); add('dE_out', 5.0, 9.3);
  link('dW_in', 'door_-5.6'); link('dW_in', 'door_-11'); link('dW_in', 'dW_out'); link('dE_in', 'door_5.6'); link('dE_in', 'dE_out');
  const cxs = [-11, -7.6, -5.2, 0, 1.7, 4.0, 5.0, 7.7, 11];
  for (const x of cxs) if (!nodes.find((n) => n.id === `c_${x}`)) add(`c_${x}`, x, 9.3);
  for (let i = 0; i < cxs.length - 1; i++) link(`c_${cxs[i]}`, `c_${cxs[i + 1]}`);
  link('dW_out', 'c_-7.6'); link('dE_out', 'c_5');
  // break room
  add('br_door', -5.2, 11.4); link('br_door', 'c_-5.2');
  add('br_mid', -6.0, 12.4); add('coffee', -10.75, 12.5); add('br_table', -8.6, 12.4); add('fridge', -10.7, 16.3); add('vending', -4.1, 16.3);
  add('couch', -8.0, 16.75); add('br_chat1', -5.4, 13.6); add('br_chat2', -5.0, 15.0); add('seatT1', -8.0, 15.0); add('seatT2', -7.0, 15.0);
  link('br_door', 'br_mid'); link('br_mid', 'br_table'); link('br_table', 'coffee'); link('br_mid', 'br_chat1'); link('br_chat1', 'br_chat2'); link('br_chat2', 'vending');
  link('br_chat2', 'couch'); link('couch', 'fridge'); link('br_chat2', 'seatT2'); link('seatT2', 'seatT1'); link('seatT1', 'couch'); link('coffee', 'fridge');
  // supervisor office
  add('sup_door', 1.7, 11.4); add('sup_desk', 0, 15.0); add('sup_mid', 1.5, 12.8);
  link('sup_door', 'c_1.7'); link('sup_door', 'sup_mid'); link('sup_mid', 'sup_desk');
  // radio room
  add('rad_door', 4.0, 11.4); add('rad_mid', 4.8, 13.4); link('rad_door', 'c_4'); link('rad_door', 'rad_mid');
  // director office
  add('dir_door', 7.7, 11.4); add('dir_desk', 9.3, 15.1); add('dir_mid', 8.0, 12.9);
  link('dir_door', 'c_7.7'); link('dir_door', 'dir_mid'); link('dir_mid', 'dir_desk');
  return nodes;
}

export function findPath(nodes, from, to) {
  const q = [from]; const prev = { [from]: null };
  while (q.length) {
    const cur = q.shift(); if (cur === to) break;
    for (const nb of nodes.find((n) => n.id === cur)?.links || []) if (!(nb in prev)) { prev[nb] = cur; q.push(nb); }
  }
  if (!(to in prev)) return null;
  const path = []; for (let c = to; c != null; c = prev[c]) path.unshift(c);
  return path.map((id) => nodes.find((n) => n.id === id));
}
