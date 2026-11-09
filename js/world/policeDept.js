// City Police Department – a two-story building on the north side of the 911 center.
//
// GROUND FLOOR (y 0 – 3.6)                                SECOND FLOOR (y 4.0 – 7.6)
//   x: -12      -4.5 -1.5    3   5.5        12            x: -12      -4.5 -1.5   3.5  5      12
// z-60 ┌────────┬──┬──────────────────────────┐           z-60 ┌────────┬──┬──────┬───────────┐
//      │ MEN'S  │  │                          │                │TRAINING│  │EXEC. │  CHIEF OF │
//  -54 │LOCKERS ├  │  ROLL CALL / BRIEFING    │                │  ROOM  │  │ASST. │  POLICE   │
//      │WOMEN'S │S │                          │            -52 │        │S ├──────┴───────────┤
//  -52 │LOCKERS │P ├──────────┬───────────────┤                │        │P │  COMMAND HALL  ═ │
//  -48 ├────────┤I │ PATROL   │ WATCH         │            -50 ├────────┤I ├─────────┬────────┤
//      │ REPORT │N │SERGEANTS │ COMMANDER     │            -46 │RESTROOM│N │ ASST.   │CAPTAIN │
//  -42 ├────────┤E ├──────┬───┴───────────────┤                │MAJOR   │E │ CHIEF   │        │
//      │EVIDENCE│  │RECORDS│     PUBLIC       │            -41 │CASE /  │  ├──────┬──┴────────┤
//  -37 │ INTAKE │  │ FRONT │     LOBBY        ═ entrance        │ IR 2   │  │ADMIN │ COMMAND   │
//      │EVIDENCE│  │ DESK  │                  │            -38 ├────────┤  │OFFICE│ CONFERENCE│
//      │STORAGE │  │       │                  │                │ADMIN / │  │      │ ROOM      │
//  -29 ├────────┴──┴───────┴──────────────┬─┬─┤            -29 ├────────┴──┴──────┴───────────┤
//      │   main corridor M                │ C │                │   corridor M2                │
//  -26 ├────┬──────┬─────┬──────┬─────────┤   │            -26 ├────┬───────────────┬───────┬─┤
//      │STR │INTER-│OBSER│INTER-│INVESTI- │   │                │STR │ DETECTIVE     │DET.   │ │
//      │ B  │VIEW 1│VAT. │VIEW 2│GATION   │   │                │ B  │ BULLPEN (CID) │SGT.   │ │
// -19.8├────┴──────┴─────┴──────┴─────────┤   │           -19.8├────┴───────────────┴───────┤C│
//      │   corridor S                     │   │                │   corridor S2               │2│
// -16.8├──────┬────────────┬────┬─────────┤   │           -16.8├─────┬─────┬───────┬───┬─────┤ │
//      │ GUN  │ BREAK ROOM │JAN.│ STAIR A │   │                │DET. │DET. │INVEST.│SUP│STAIR│ │
//      │ ROOM │            │    │         │   │                │OFF 1│OFF 2│ROOM 1 │   │  A  │ │
//   -8 └──────┴────────────┴────┴─────────┴─D─┘ ← door into the dispatch floor (x 9.2 – 10.6)
//
// The gun room opens onto the joint training range (Sheriff's wing) behind the firing line.
// Everything is merged into per-floor material batches ('@pd1' / '@pd2') so a whole floor
// can be culled when you can't see it. Every wall, opening, door leaf and wall-mounted item
// is recorded in a layout registry (returned as `layout`) so tests can prove that nothing
// floats off a wall, hangs over a doorway or blocks a door (tests/pd-layout-test.js).
import { officeChair, guestChair, stackChair, beamSeating, sofa, bench, desk, table, cubicles, bookcase, fileCabinet, shelving, lockerBank, credenza, plantPot, flagStand, trashCan, waterCooler, copier, wallBoard, urinal, vanity, kitchenette, fridge, vendingMachine, gunRack, vestRack, radioCharger, interviewSet, podium } from './furniture.js';
import { DECOR_CELLS } from '../engine/textures.js';

export const PD = { x0: -12, z0: -60, x1: 12, z1: -8, F2: 4.0, CEIL: 3.6, ROOF: 8.2 };
export const DISPATCH_DOOR = [9.2, 10.6]; // opening in the dispatch floor's north wall (z = -8)
export const RANGE_DOOR = [-10.6, -9.4];  // gun room → range (x = -12)
export const ENTRANCE = [-35, -33];       // automatic doors on the east face (x = 12)

// Stairs: two U-shaped stairs, 11 risers per flight (rise 0.182 m, going 0.282 m).
export const STAIRS = [
  { id: 'A', box: [5, -15, 8.6, -8], flight1: { x0: 6.85, x1: 8.5, at: -9.6, to: -12.7 }, landing: [5.1, -15, 8.5, -12.7], flight2: { x0: 5.1, x1: 6.75, at: -12.7, to: -9.6 }, hole: [5, -15, 8.6, -9.6], guard: [6.85, -9.66, 8.6, -9.54], core: [6.75, -12.7, 6.85, -9.6] },
  { id: 'B', box: [-12, -26, -8.6, -19.8], flight1: { x0: -11.9, x1: -10.35, at: -24.4, to: -21.3 }, landing: [-11.9, -21.3, -8.7, -19.8], flight2: { x0: -10.25, x1: -8.7, at: -21.3, to: -24.4 }, hole: [-12, -24.4, -8.6, -19.8], guard: [-12, -24.46, -10.35, -24.34], core: [-10.35, -24.4, -10.25, -21.3] },
];

/** Rooms other systems need to know about (live briefings, meeting teleports). */
export const PD_ROOMS = {
  rollcall: { c: [5.4, -56], y: 0, r: 8.6, stand: [0.4, -56, -Math.PI / 2] },
  conference: { c: [7.8, -35.4], y: 4, r: 7.2, stand: [5.2, -31.0, Math.PI * 0.85] },
};

// Exterior openings, shared with the brick facade (shell.js) so glass and brick always line up.
// face: N (z = z0), E (x = x1), W (x = x0), S (z = z1) · lv 0 / 1 · [a0, a1, sill, head, kind]
const W_ = (a, b, sill = 0.85, head = 2.75) => [a, b, sill, head, 'win'];
export const PD_FACADE = {
  N: [[0, W_(-9.4, -6.2, 1.9, 2.75)], [0, W_(-4.0, -2.0)], [0, W_(0.4, 3.4)], [0, W_(4.6, 7.6)], [0, W_(8.8, 11.4)],
    [1, W_(-11.0, -8.6)], [1, W_(-7.6, -5.2)], [1, W_(-4.0, -2.0)], [1, W_(-0.6, 2.4)], [1, W_(5.0, 7.8)], [1, W_(8.8, 11.4)]],
  E: [[0, W_(-50.2, -47.2)], [0, W_(-42.8, -36.6, 0.3, 3.1)], [0, [ENTRANCE[0], ENTRANCE[1], 0, 2.45, 'door']], [0, W_(-31.8, -29.6, 0.3, 3.1)], [0, W_(-25.0, -22.4)], [0, W_(-20.0, -17.4)], [0, W_(-13.6, -11.0)],
    [1, W_(-58.6, -53.8)], [1, W_(-51.2, -49.8)], [1, W_(-47.4, -42.6)], [1, W_(-39.2, -35.8)], [1, W_(-33.2, -29.8)], [1, W_(-25.0, -22.4)], [1, W_(-20.0, -17.4)], [1, W_(-13.6, -11.0)]],
  W: [[0, W_(-46.6, -43.4)], [0, W_(-28.4, -26.6)],
    [1, W_(-58.6, -56.2)], [1, W_(-53.8, -51.4)], [1, W_(-44.4, -40.0)], [1, W_(-36.6, -34.2)], [1, W_(-32.6, -30.2)], [1, W_(-28.4, -26.6)], [1, W_(-14.2, -11.8)], [1, W_(-10.6, -8.6)]],
  S: [[1, W_(-11.2, -9.0)], [1, W_(-6.6, -4.0)], [1, W_(-1.4, 1.8)], [1, W_(9.4, 11.4)]],
};

/** Walkable surfaces for the player and NPCs (everything else is ground at y = 0). */
export function pdWalk() {
  const slabs = []; const stairs = [];
  // second-floor slab = footprint minus the two stair holes
  for (const r of subtract([PD.x0, PD.z0, PD.x1, PD.z1], STAIRS.map((s) => s.hole))) slabs.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], y: PD.F2 });
  for (const s of STAIRS) {
    slabs.push({ x0: s.landing[0], z0: s.landing[1], x1: s.landing[2], z1: s.landing[3], y: PD.F2 / 2 });
    const a = s.flight1, b = s.flight2;
    stairs.push({ x0: a.x0, x1: a.x1, z0: Math.min(a.at, a.to), z1: Math.max(a.at, a.to), at: a.at, to: a.to, y0: 0, y1: PD.F2 / 2 });
    stairs.push({ x0: b.x0, x1: b.x1, z0: Math.min(b.at, b.to), z1: Math.max(b.at, b.to), at: b.at, to: b.to, y0: PD.F2 / 2, y1: PD.F2 });
  }
  return { slabs, stairs };
}

/** Is a point inside (or within m of) one of the stairwells? */
export function inStairBox(x, z, m = 0) { return STAIRS.some(({ box: [x0, z0, x1, z1] }) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m); }

/** Rectangle minus a list of rectangles (axis aligned) → list of rectangles. */
function subtract(rect, holes) {
  let parts = [rect];
  for (const h of holes) {
    const next = [];
    for (const [x0, z0, x1, z1] of parts) {
      if (h[2] <= x0 || h[0] >= x1 || h[3] <= z0 || h[1] >= z1) { next.push([x0, z0, x1, z1]); continue; }
      const hx0 = Math.max(x0, h[0]), hx1 = Math.min(x1, h[2]), hz0 = Math.max(z0, h[1]), hz1 = Math.min(z1, h[3]);
      if (z0 < hz0) next.push([x0, z0, x1, hz0]); if (hz1 < z1) next.push([x0, hz1, x1, z1]);
      if (x0 < hx0) next.push([x0, hz0, hx0, hz1]); if (hx1 < x1) next.push([hx1, hz0, x1, hz1]);
    }
    parts = next;
  }
  return parts;
}

const faceTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z)); // NPC / player yaw that looks from (x, z) toward (tx, tz)

// ---------------------------------------------------------------------------------------
export function buildPoliceDept(k) {
  const { col: colRaw, interactables, lights, seats, doors, nav, D } = k;
  const screenDefs = k.screens || [];
  const L = { walls: [], mounts: [], wallCols: [], furnCols: [], rooms: [], hangs: [] }; // layout registry (for tests)
  // furniture here is numerous: one bevel step on rounded edges keeps the triangle count sane
  const mbZone = (z) => { const f0 = k.mbZone(z); return (key) => { const m = f0(key); m.seg = 1; return m; }; };
  const F2 = PD.F2, CH = PD.CEIL;
  let mb = mbZone('pd1'); let Y = 0; let LV = 0;
  const level = (l) => { mb = mbZone(l ? 'pd2' : 'pd1'); Y = l ? F2 : 0; LV = l; };
  const colWall = (x0, z0, x1, z1, y0, y1) => { colRaw(x0, z0, x1, z1, y0, y1); L.wallCols.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y0, y1]); };
  const colFurn = (x0, z0, x1, z1, y0, y1) => { const c = [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y0, y1]; colRaw(...c); L.furnCols.push(c); };
  const F = { col: colFurn, seat: (s) => seats.push({ ...s, zone: LV ? 'pd2' : 'pd1' }), interact: (it) => interactables.push({ id: it.id || `pd_${it.kind}_${interactables.length}`, ...it }), D };
  Object.defineProperty(F, 'mb', { get: () => mb });
  const node = (id, x, z, extra = {}) => nav.nodes.push({ id, x, z, y: extra.y ?? Y, ...extra });
  const link = (...ids) => { for (let i = 0; i < ids.length - 1; i++) nav.links.push([ids[i], ids[i + 1]]); };
  const sitNode = (id, pose, extra = {}) => node(id, pose[0], pose[1], { sit: pose[2], ...extra });

  // ------------------------------------------------ walls
  // Axis-aligned wall with openings: [a, b, type, opts]. type: door | pass | window | ext | glass | mirror | counter
  // Door leaves stand open flat against the wall on face `side`, toward lower coordinates (hinge -1) or higher (hinge +1).
  const wall = (x0, z0, x1, z1, open = [], { mat = 'wall', h = CH, thick = 0.16, mirrorSide = 1, collide: wallCollide = true } = {}) => {
    const alongX = z0 === z1; const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1); const c = alongX ? z0 : x0;
    const reg = { axis: alongX ? 'z' : 'x', c, a0, a1, Y, lv: LV, thick, ops: [] }; L.walls.push(reg);
    const seg = (a, b, y0, y1, collide = true, m = mat) => {
      if (b - a < 0.005 || y1 - y0 < 0.005) return;
      if (alongX) mb(m).wall(a, c, b, c, Y + y0, Y + y1, thick, { uv: 2 }); else mb(m).wall(c, a, c, b, Y + y0, Y + y1, thick, { uv: 2 });
      if (D >= 1 && y0 === 0 && m !== 'glass') { if (alongX) mb('rubber').wall(a, c, b, c, Y, Y + 0.1, thick + 0.03, { uv: 0 }); else mb('rubber').wall(c, a, c, b, Y, Y + 0.1, thick + 0.03, { uv: 0 }); }
      if (collide && wallCollide) { const t = thick / 2 + 0.02; if (alongX) colWall(a, c - t, b, c + t, Y + y0, Y + y1); else colWall(c - t, a, c + t, b, Y + y0, Y + y1); }
    };
    const P = (a, y, o = 0) => (alongX ? [a, Y + y, c + o] : [c + o, Y + y, a]);
    const ops = open.slice().sort((p, q) => p[0] - q[0]); let cur = a0;
    for (const [a, b, type, o = {}] of ops) {
      seg(cur, a, 0, h); cur = b; const mid = (a + b) / 2, w = b - a;
      if (type === 'door' || type === 'pass') {
        const head = type === 'pass' ? 2.45 : 2.25; seg(a, b, head, h, false);
        const op = { a, b, type, sill: 0, head: head + 0.06 }; reg.ops.push(op);
        if (type === 'door') { // frame + a leaf swung open against the wall
          const side = o.side || 1, hinge = o.hinge || -1; const lw = w - 0.06;
          op.side = side; op.leaf = o.leaf === false ? null : (hinge < 0 ? [a - lw - 0.03, a] : [b, b + lw + 0.03]);
          if (D >= 1) {
            for (const e of [a, b]) { const [px, py, pz] = P(e, 1.125); mb('frame').box(px, py, pz, alongX ? 0.06 : thick + 0.06, 2.25, alongX ? thick + 0.06 : 0.06); }
            { const [px, py, pz] = P(mid, 2.25); mb('frame').box(px, py, pz, alongX ? w + 0.06 : thick + 0.06, 0.06, alongX ? thick + 0.06 : w + 0.06); }
            if (op.leaf) { const lc = hinge < 0 ? a - lw / 2 - 0.03 : b + lw / 2 + 0.03; const [px, , pz] = P(lc, 0, side * (thick / 2 + 0.03));
              mb(o.leafMat || 'doorWood').rbox(px, Y + 1.11, pz, alongX ? lw : 0.045, 2.2, alongX ? 0.045 : lw, { r: 0.008, uv: 1 });
              const hx0 = hinge < 0 ? a - lw + 0.1 : b + lw - 0.1; const [hx, , hz] = P(hx0, 0, side * (thick / 2 + 0.07)); mb('chrome').box(hx, Y + 1.02, hz, alongX ? 0.14 : 0.03, 0.022, alongX ? 0.03 : 0.14);
              if (o.leafMat !== 'glassDoor' && o.leafMat !== 'metal') { const [vx, , vz] = P(lc + (hinge < 0 ? 1 : -1) * lw * 0.28, 0, side * (thick / 2 + 0.055)); mb('glassDark').box(vx, Y + 1.45, vz, alongX ? 0.14 : 0.004, 0.62, alongX ? 0.004 : 0.14, { uv: 0 }); } }
            const [tx, , tz] = P(mid, 0); mb('metal').box(tx, Y + 0.006, tz, alongX ? w : thick + 0.08, 0.012, alongX ? thick + 0.08 : w, { uv: 0.5 });
          }
        }
        continue;
      }
      // glazed openings
      const sill = o.sill ?? (type === 'ext' ? 0.85 : type === 'counter' ? 1.05 : 0.9), head = o.head ?? (type === 'ext' ? 2.75 : 2.35);
      reg.ops.push({ a, b, type, sill, head });
      seg(a, b, 0, sill); seg(a, b, head, h, false);
      const t = thick / 2 + 0.02; if (alongX) colWall(a, c - t, b, c + t, Y + sill, Y + head); else colWall(c - t, a, c + t, b, Y + sill, Y + head);
      const [gx, gy, gz] = P(mid, (sill + head) / 2);
      if (type === 'mirror') { // one-way glass: mirror toward mirrorSide, dark glass on the other side
        mb('mirror').panel(gx + (alongX ? 0 : mirrorSide * 0.01), gy, gz + (alongX ? mirrorSide * 0.01 : 0), w, head - sill, alongX ? 'z' : 'x', mirrorSide);
        mb('glassDark').panel(gx - (alongX ? 0 : mirrorSide * 0.01), gy, gz - (alongX ? mirrorSide * 0.01 : 0), w, head - sill, alongX ? 'z' : 'x', -mirrorSide);
      } else mb('glass').panel(gx, gy, gz, w, head - sill, alongX ? 'z' : 'x', 1);
      const n = Math.max(1, Math.round(w / 1.6));
      for (let i = 0; i <= n; i++) { const [mx, my, mz] = P(a + (w * i) / n, (sill + head) / 2); mb('frame').box(mx, my, mz, alongX ? 0.05 : thick + 0.04, head - sill, alongX ? thick + 0.04 : 0.05); }
      for (const yy of [sill, head]) { const [mx, my, mz] = P(mid, yy); mb('frame').box(mx, my, mz, alongX ? w : thick + 0.04, 0.05, alongX ? thick + 0.04 : w); }
      if (type === 'ext' || type === 'window') { const [sx, sy, sz] = P(mid, sill - 0.02, 0); mb('counter').box(sx, sy, sz, alongX ? w + 0.1 : thick + 0.22, 0.04, alongX ? thick + 0.22 : w + 0.1, { uv: 0.5 }); }
      if (type === 'ext' && D >= 1 && o.inSide) { const [bx, by, bz] = P(mid, head - 0.2, o.inSide * (thick / 2 + 0.04)); mb('blinds').box(bx, by, bz, alongX ? w - 0.05 : 0.03, 0.3, alongX ? 0.03 : w - 0.05, { faces: alongX ? 'zZ' : 'xX', uv: 0 }); }
      if (type === 'counter') { const [sx, sy, sz] = P(mid, sill - 0.02, 0); mb('counterTop').rbox(sx, sy, sz, alongX ? w + 0.1 : 0.7, 0.05, alongX ? 0.7 : w + 0.1, { r: 0.01, uv: 1 }); const [px, py, pz] = P(mid, sill + 0.05, 0); mb('metal').box(px, py, pz, alongX ? 0.4 : 0.3, 0.08, alongX ? 0.3 : 0.4, { uv: 0.5 }); }
    }
    seg(cur, a1, 0, h);
    return reg;
  };
  // exterior wall of the current level from the shared facade list
  const extWall = (face) => {
    const isZ = face === 'N' || face === 'S'; const c = { N: PD.z0, S: PD.z1, E: PD.x1, W: PD.x0 }[face]; const inSide = { N: 1, S: -1, E: -1, W: 1 }[face];
    const ops = PD_FACADE[face].filter(([lv]) => lv === LV).map(([, [a, b, sill, head, kind]]) => (kind === 'door' ? [a, b, 'pass'] : [a, b, 'ext', { sill, head, inSide }]));
    return ops;
  };
  const floorAt = (x0, z0, x1, z1, mat, uv = 1.2) => mb(mat).box((x0 + x1) / 2, Y - 0.05, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0, { faces: 'Y', uv });
  const ceiling = (x0, z0, x1, z1) => mb('ceiling').box((x0 + x1) / 2, Y + CH + 0.05, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0, { faces: 'y', uv: 1.2 });
  const lamp = (x, z, roomName = 'pd', w = 1.2, d = 0.6) => {
    if (D >= 1) { mb('troffer').box(x, Y + CH - 0.012, z, w, 0.03, d, { faces: 'y', uv: 0 }); mb('whiteCeil').box(x, Y + CH - 0.018, z, w + 0.06, 0.036, d + 0.06, { faces: 'xXzZ', uv: 0 }); }
    else mb('lightpanel').box(x, Y + CH - 0.02, z, w, 0.04, d, { faces: 'y', uv: 0 });
    lights.push({ pos: [x, Y + CH - 0.4, z], room: roomName, base: 1, range: 5.6, dim: 0.86 });
  };
  const vent = (x, z) => { if (D >= 1) mb('vent').box(x, Y + CH - 0.003, z, 0.6, 0.006, 0.6, { faces: 'y', uv: 0 }); };
  const smoke = (x, z) => { if (D >= 2) mb('whiteCeil').cylinder(x, Y + CH - 0.02, z, 0.07, 0.04, 14); };
  /** A room: floor, ceiling, an even grid of lights and a vent; recorded for the layout tests. */
  const room = (name, x0, z0, x1, z1, mat, { uv = 1.2, light = 'super', nx, nz, lights: lit = true, ceil = true } = {}) => {
    floorAt(x0, z0, x1, z1, mat, uv); if (ceil) ceiling(x0, z0, x1, z1);
    const cx = nx ?? Math.max(1, Math.round((x1 - x0) / 3.4)), cz = nz ?? Math.max(1, Math.round((z1 - z0) / 3.4));
    if (lit) for (let i = 0; i < cx; i++) for (let j = 0; j < cz; j++) { const x = x0 + (x1 - x0) * (i + 0.5) / cx, z = z0 + (z1 - z0) * (j + 0.5) / cz; const along = (z1 - z0) > (x1 - x0) * 1.6; lamp(x, z, light, along ? 0.6 : 1.2, along ? 1.2 : 0.6); }
    if (lit && (x1 - x0) * (z1 - z0) > 14) { vent(x0 + (x1 - x0) * 0.5 + (cx % 2 ? 0.9 : 0), z0 + (z1 - z0) * 0.5 + (cz % 2 ? 0.9 : 0)); smoke(x0 + (x1 - x0) * 0.3, z0 + (z1 - z0) * 0.3); }
    L.rooms.push({ name, lv: LV, Y, r: [x0, z0, x1, z1] });
  };

  // ------------------------------------------------ wall-mounted things
  // A wall face: axis 'z' = wall running along x at z = c, facing ±z; axis 'x' = wall along z at x = c, facing ±x.
  const face = (axis, c, s, thick = 0.16) => ({ axis, c, s, surf: c + s * thick / 2 });
  const at = (fc, a, o = 0) => (fc.axis === 'z' ? [a, fc.surf + fc.s * o] : [fc.surf + fc.s * o, a]);
  const mount = (fc, a, y, w, h, depth, what) => { L.mounts.push({ axis: fc.axis, c: fc.c, s: fc.s, surf: fc.surf, a0: a - w / 2, a1: a + w / 2, y0: Y + y - h / 2, y1: Y + y + h / 2, Y, lv: LV, depth, what }); };
  const decorUV = (name) => { const i = DECOR_CELLS.indexOf(name); if (i < 0) throw new Error(`no decor cell ${name}`); const u = (i % 8) / 8, v = Math.floor(i / 8) / 4; return [u + 0.002, v + 0.004, u + 1 / 8 - 0.002, v + 1 / 4 - 0.004]; };
  /** Framed picture / plaque / poster, built from the wall surface outward so it can never float or sink in. */
  const pic = (fc, a, y, w, h, cell, { frameMat = 'frame', border = 0.035, what = cell } = {}) => {
    const fw = w + border * 2, fh = h + border * 2; const [fx, fz] = at(fc, a, 0.012);
    if (fc.axis === 'z') mb(frameMat).box(fx, Y + y, fz, fw, fh, 0.03); else mb(frameMat).box(fx, Y + y, fz, 0.03, fh, fw);
    const [px, pz] = at(fc, a, 0.0285); mb('pdDecor').panel(px, Y + y, pz, w, h, fc.axis, fc.s, { uvRect: decorUV(cell) });
    mount(fc, a, y, fw, fh, 0.03, what);
  };
  const board = (fc, a, y, w, h, mat = 'whiteboard', what = mat) => { const [x, z] = at(fc, a, 0); wallBoard(F, x, Y + y, z, fc.axis, fc.s, w, h, mat); mount(fc, a, y, w + 0.06, h + 0.06, 0.06, what); };
  const tvOn = (fc, a, y, w, h, what = 'tv') => { const [bx, bz] = at(fc, a, 0.03); if (fc.axis === 'z') mb('blackgloss').box(bx, Y + y, bz, w + 0.1, h + 0.1, 0.06, { uv: 0 }); else mb('blackgloss').box(bx, Y + y, bz, 0.06, h + 0.1, w + 0.1, { uv: 0 });
    const [sx, sz] = at(fc, a, 0.0615); mb('scr_tv').panel(sx, Y + y, sz, w, h, fc.axis, fc.s); mount(fc, a, y, w + 0.1, h + 0.1, 0.06, what); };
  const SIGNS = []; // every sign lives in one texture atlas (see the end of the builder)
  const signPanel = (x, y, z, w, h, axis, s, text, style) => { const item = { text, style, w, h }; SIGNS.push(item); mb('scr_pd_signs').panel(x, y, z, w, h, axis, s, { uvRect: item.uv = [0, 0, 1, 1] }); item.ref = mb('scr_pd_signs'); item.vi = item.ref.p.length / 3 - 4; };
  /** Room plaque / directional sign on a wall. */
  const sign = (fc, a, y, w, text, { h = 0.26, style = 'room' } = {}) => {
    const [bx, bz] = at(fc, a, 0.012); if (fc.axis === 'z') mb('dark').box(bx, Y + y, bz, w + 0.04, h + 0.04, 0.024, { uv: 0 }); else mb('dark').box(bx, Y + y, bz, 0.024, h + 0.04, w + 0.04, { uv: 0 });
    const [px, pz] = at(fc, a, 0.0255); signPanel(px, Y + y, pz, w, h, fc.axis, fc.s, text, style); mount(fc, a, y, w + 0.04, h + 0.04, 0.025, `sign:${text.split('\n')[0]}`);
  };
  /** Double-sided sign hung from the ceiling on two rods (axis = which way its faces look). */
  const hangSign = (x, z, axis, w, text, { y = 2.78, h = 0.3, style = 'hang' } = {}) => {
    if (axis === 'z') { mb('dark').box(x, Y + y, z, w + 0.06, h + 0.06, 0.04, { uv: 0 }); signPanel(x, Y + y, z + 0.0205, w, h, 'z', 1, text, style); signPanel(x, Y + y, z - 0.0205, w, h, 'z', -1, text, style); }
    else { mb('dark').box(x, Y + y, z, 0.04, h + 0.06, w + 0.06); signPanel(x + 0.0205, Y + y, z, w, h, 'x', 1, text, style); signPanel(x - 0.0205, Y + y, z, w, h, 'x', -1, text, style); }
    const top = y + h / 2 + 0.03, len = CH - top; for (const o of [-w * 0.38, w * 0.38]) { const [rx, rz] = axis === 'z' ? [x + o, z] : [x, z + o]; mb('chrome').cylinder(rx, Y + top + len / 2, rz, 0.008, len, 6); }
    L.hangs.push({ x, z, axis, w, y0: Y + y - h / 2 - 0.03, y1: Y + CH, lv: LV, text });
  };
  const extinguisher = (fc, a, y = 1.62) => { const [bx, bz] = at(fc, a, 0.06); if (fc.axis === 'z') mb('white').box(bx, Y + y, bz, 0.34, 0.66, 0.12, { uv: 0 }); else mb('white').box(bx, Y + y, bz, 0.12, 0.66, 0.34, { uv: 0 });
    const [cx, cz] = at(fc, a, 0.07); mb('red').cylinder(cx, Y + y - 0.04, cz, 0.075, 0.46, 12); const [gx, gz] = at(fc, a, 0.121); if (fc.axis === 'z') mb('glassFrost').box(gx, Y + y, gz, 0.28, 0.58, 0.004, { uv: 0 }); else mb('glassFrost').box(gx, Y + y, gz, 0.004, 0.58, 0.28, { uv: 0 });
    mount(fc, a, y, 0.34, 0.66, 0.12, 'extinguisher'); };
  const aed = (fc, a, y = 1.55) => { const [bx, bz] = at(fc, a, 0.055); if (fc.axis === 'z') mb('aed').rbox(bx, Y + y, bz, 0.42, 0.4, 0.11, { r: 0.015 }); else mb('aed').rbox(bx, Y + y, bz, 0.11, 0.4, 0.42, { r: 0.015 }); mount(fc, a, y, 0.42, 0.4, 0.11, 'aed'); };
  const charger = (fc, a, y = 1.3, n = 8) => { const [x, z] = at(fc, a, 0); radioCharger(F, x, Y + y, z, fc.axis, fc.s, n); mount(fc, a, y + 0.06, n * 0.13 + 0.08, 0.36, 0.11, 'radio charger'); };
  const clock = (fc, a, y = 2.62) => { const [x, z] = at(fc, a, 0.02); mb('white').tube(x, Y + y, z, 0.15, 0.04, fc.axis, 20); const [hx, hz] = at(fc, a, 0.041); mb('dark').box(hx, Y + y + 0.04, hz, fc.axis === 'z' ? 0.012 : 0.004, 0.09, fc.axis === 'z' ? 0.004 : 0.012, { uv: 0 }); mb('dark').box(hx + (fc.axis === 'z' ? 0.03 : 0), Y + y, hz + (fc.axis === 'z' ? 0 : 0.03), fc.axis === 'z' ? 0.07 : 0.004, 0.01, fc.axis === 'z' ? 0.004 : 0.07, { uv: 0 }); mount(fc, a, y, 0.3, 0.3, 0.04, 'clock'); };

  // Spans of a wall face that are solid between y0 and y1: openings and the door leaves resting on that face are cut out.
  const solidSpans = (fc, a0, a1, y0, y1, pad = 0.04) => {
    const ws = L.walls.filter((w) => w.axis === fc.axis && Math.abs(w.c - fc.c) < 1e-6 && w.lv === LV);
    let spans = []; for (const w of ws) { const s0 = Math.max(a0, w.a0), s1 = Math.min(a1, w.a1); if (s1 - s0 > 0.05) spans.push([s0, s1]); }
    const cuts = [];
    for (const w of ws) for (const o of w.ops) { if (o.head > y0 && o.sill < y1) cuts.push([o.a - pad - 0.03, o.b + pad + 0.03]); if (o.leaf && o.side === fc.s && y0 < 2.25) cuts.push([o.leaf[0] - pad, o.leaf[1] + pad]); }
    for (const w of L.walls) if (w.lv === LV && w.axis !== fc.axis && w.a0 - 0.01 <= fc.c && w.a1 + 0.01 >= fc.c && (fc.s > 0 ? w.a1 > fc.c + 0.02 : w.a0 < fc.c - 0.02)) cuts.push([w.c - w.thick / 2 - 0.005, w.c + w.thick / 2 + 0.005]);
    for (const m of L.mounts) if (m.lv === LV && m.axis === fc.axis && Math.abs(m.c - fc.c) < 1e-6 && m.s === fc.s && m.y1 - Y > y0 && m.y0 - Y < y1 && m.what !== 'wainscot') cuts.push([m.a0 - 0.02, m.a1 + 0.02]);
    for (const [c0, c1] of cuts) spans = spans.flatMap(([s0, s1]) => (c1 <= s0 || c0 >= s1 ? [[s0, s1]] : [[s0, c0], [c1, s1]].filter(([p, q]) => q - p > 0.05)));
    return spans;
  };
  /** Lower-wall panelling + a capping chair rail along a face, stopping at every opening. */
  const deferred = [];
  const wainscot = (fc, a0, a1, o = {}) => deferred.push(() => wainscotNow(fc, a0, a1, o));
  const wainscotNow = (fc, a0, a1, { h = 1.0, mat = 'woodDark', rail = 'woodDark', railH = 0.07 } = {}) => {
    for (const [s0, s1] of solidSpans(fc, a0, a1, 0, h + railH)) { L.mounts.push({ axis: fc.axis, c: fc.c, s: fc.s, surf: fc.surf, a0: s0, a1: s1, y0: Y, y1: Y + h + railH, Y, lv: LV, depth: rail ? 0.044 : 0.016, what: 'wainscot' });
      const m = (s0 + s1) / 2, w = s1 - s0;
      if (mat) { const [px, pz] = at(fc, m, 0.008); if (fc.axis === 'z') mb(mat).box(px, Y + h / 2 + 0.05, pz, w, h - 0.1, 0.016, { uv: 0.8 }); else mb(mat).box(px, Y + h / 2 + 0.05, pz, 0.016, h - 0.1, w, { uv: 0.8 }); }
      if (rail) { const [rx, rz] = at(fc, m, 0.022); if (fc.axis === 'z') mb(rail).rbox(rx, Y + h + railH / 2 - 0.02, rz, w, railH, 0.044, { r: 0.012, uv: 1 }); else mb(rail).rbox(rx, Y + h + railH / 2 - 0.02, rz, 0.044, railH, w, { r: 0.012, uv: 1 }); }
    }
  };
  /** A painted accent stripe along a face (department colours), stopping at openings. */
  const stripe = (fc, a0, a1, y, h, color) => deferred.push(() => {
    for (const [s0, s1] of solidSpans(fc, a0, a1, y - h / 2, y + h / 2)) { const m = (s0 + s1) / 2, w = s1 - s0; const [px, pz] = at(fc, m, 0.003); if (fc.axis === 'z') mb('satin').box(px, Y + y, pz, w, h, 0.006, { color, uv: 0 }); else mb('satin').box(px, Y + y, pz, 0.006, h, w, { color, uv: 0 }); }
  });
  const flushDeferred = () => { while (deferred.length) deferred.shift()(); };
  /** Floor inlay border just inside a corridor (terrazzo divider strips). */
  const inlay = (x0, z0, x1, z1, inset = 0.25, color = [0.16, 0.2, 0.28]) => {
    const t = 0.08; const yy = Y + 0.003;
    mb('satin').box((x0 + x1) / 2, yy, z0 + inset, x1 - x0 - inset * 2, 0.006, t, { color, uv: 0 }); mb('satin').box((x0 + x1) / 2, yy, z1 - inset, x1 - x0 - inset * 2, 0.006, t, { color, uv: 0 });
    mb('satin').box(x0 + inset, yy, (z0 + z1) / 2, t, 0.006, z1 - z0 - inset * 2, { color, uv: 0 }); mb('satin').box(x1 - inset, yy, (z0 + z1) / 2, t, 0.006, z1 - z0 - inset * 2, { color, uv: 0 });
  };
  const exitSign = (x, z, axis, s, thick = 0.16) => { if (D < 1) return; const fc = face(axis, axis === 'z' ? z : x, s, thick); const [bx, bz] = at(fc, axis === 'z' ? x : z, 0.025); if (axis === 'z') { mb('white').box(bx, Y + 2.56, bz, 0.4, 0.2, 0.05, { uv: 0 }); mb('exit').panel(bx, Y + 2.56, bz + s * 0.026, 0.36, 0.15, 'z', s); } else { mb('white').box(bx, Y + 2.56, bz, 0.05, 0.2, 0.4, { uv: 0 }); mb('exit').panel(bx + s * 0.026, Y + 2.56, bz, 0.36, 0.15, 'x', s); } mount(fc, axis === 'z' ? x : z, 2.56, 0.4, 0.2, 0.05, 'exit sign'); };
  const recLight = (fc, a, y = 2.82) => { const [x, z] = at(fc, a, 0.02); if (fc.axis === 'z') mb('lightRed').box(x, Y + y, z, 0.22, 0.08, 0.04); else mb('lightRed').box(x, Y + y, z, 0.04, 0.08, 0.22); mount(fc, a, y, 0.22, 0.08, 0.04, 'recording light'); };
  /** Wall-hung display case (trophies / badges) standing on the floor against a wall. */
  const displayCase = (fc, a, w) => {
    const [cx, cz] = at(fc, a, 0.25); const d = 0.48; const W2 = fc.axis === 'z' ? [w, d] : [d, w];
    mb('woodDark').rbox(cx, Y + 0.45, cz, W2[0], 0.9, W2[1], { r: 0.01, uv: 1, ao: 0.2 }); mb('woodDark').box(cx, Y + 2.0, cz, W2[0], 0.08, W2[1], { uv: 1 });
    mb('glass').box(cx, Y + 1.47, cz, W2[0] - 0.04, 1.02, W2[1] - 0.04, { uv: 0 }); mb('glassFrost').box(cx, Y + 1.25, cz, W2[0] - 0.08, 0.012, W2[1] - 0.08, { uv: 0 });
    for (let i = 0; i < Math.floor(w / 0.32); i++) { const o = -w / 2 + 0.2 + i * 0.32; const [tx, tz] = fc.axis === 'z' ? [cx + o, cz] : [cx, cz + o]; const tall = 0.18 + (i % 3) * 0.07; mb('gold').cylinder(tx, Y + 0.92 + tall / 2, tz, 0.035, tall, 10); mb('gold').sphere(tx, Y + 0.95 + tall, tz, 0.05, 10, 6, { sy: 0.7 }); mb('gold').cylinder(tx, Y + 1.27 + 0.06, tz, 0.04, 0.12, 10); }
    { const [bx, bz] = at(fc, a, 0.012); if (fc.axis === 'z') mb('pdDecor').panel(bx, Y + 1.65, bz + fc.s * 0.006, Math.min(1.2, w - 0.2), 0.5, 'z', fc.s, { uvRect: decorUV('patches') }); else mb('pdDecor').panel(bx + fc.s * 0.006, Y + 1.65, bz, Math.min(1.2, w - 0.2), 0.5, 'x', fc.s, { uvRect: decorUV('patches') }); }
    const hw = fc.axis === 'z' ? w / 2 : d / 2, hd = fc.axis === 'z' ? d / 2 : w / 2; colFurn(cx - hw, cz - hd, cx + hw, cz + hd, Y, Y + 2.04);
    mount(fc, a, 1.65, Math.min(1.2, w - 0.2), 0.5, 0.01, 'case backboard');
  };

  // ======================================================================= GROUND FLOOR
  level(0);
  // ---- rooms (floors, ceilings, lights)
  room("Men's locker room", -12, -60, -4.5, -54, 'tile', { light: 'break' }); room("Women's locker room", -12, -54, -4.5, -48, 'tile', { light: 'break' });
  room('Report writing', -12, -48, -4.5, -42, 'officeCarpet'); room('Evidence intake', -12, -42, -4.5, -37, 'tile', { light: 'radio' }); room('Evidence storage', -12, -37, -4.5, -29, 'concrete', { uv: 2.5, light: 'radio' });
  room('Roll call', -1.5, -60, 12, -52, 'officeCarpet', { nx: 4, nz: 2 }); room('Patrol sergeants', -1.5, -52, 5.5, -44, 'officeCarpet'); room('Watch commander', 5.5, -52, 12, -44, 'officeCarpet', { light: 'director' });
  room('Records', -1.5, -44, 3, -29, 'officeCarpet'); room('Lobby', 3, -44, 12, -29, 'terrazzo', { uv: 2.4, light: 'floor', nx: 3, nz: 4 });
  room('Interview 1', -8.6, -26, -4.4, -19.8, 'tile', { light: 'radio', nx: 1, nz: 2 }); room('Observation', -4.4, -26, -0.8, -19.8, 'officeCarpet', { light: 'radio', nx: 1, nz: 2 }); room('Interview 2', -0.8, -26, 3.4, -19.8, 'tile', { light: 'radio', nx: 1, nz: 2 });
  room('Investigation room', 3.4, -26, 8.6, -19.8, 'officeCarpet');
  room('Gun room', -12, -16.8, -6, -8, 'concrete', { uv: 2.5, light: 'armory' }); room('Break room', -6, -16.8, 2.6, -8, 'plank', { light: 'break' }); room('Janitor & supply', 2.6, -16.8, 5, -8, 'concrete', { uv: 2.5, light: 'radio', nx: 1, nz: 2 });
  // corridors
  room('Corridor spine', -4.5, -60, -1.5, -29, 'terrazzo', { uv: 2.4, light: 'corridor', nx: 1, nz: 9 });
  room('Corridor M', -12, -29, 12, -26, 'terrazzo', { uv: 2.4, light: 'corridor', nx: 7, nz: 1 });
  room('Corridor C', 8.6, -26, 12, -8, 'terrazzo', { uv: 2.4, light: 'corridor', nx: 1, nz: 5 });
  room('Corridor S', -12, -19.8, 8.6, -16.8, 'terrazzo', { uv: 2.4, light: 'corridor', nx: 6, nz: 1 }); room('Corridor S alcove', 5, -16.8, 8.6, -15, 'terrazzo', { uv: 2.4, lights: false });
  for (const s of STAIRS) floorAt(s.box[0], s.box[1], s.box[2], s.box[3], 'terrazzo', 2.4);
  if (D >= 1) { inlay(-4.5, -60, -1.5, -29); inlay(-12, -29, 8.6, -26); inlay(8.6, -26, 12, -8, 0.25, [0.12, 0.24, 0.42]); }

  // ---- exterior walls
  wall(-12, -60, 12, -60, extWall('N'));
  wall(12, -60, 12, -8, extWall('E'));
  wall(-12, -60, -12, -26, extWall('W'));
  // the PD side of the dispatch north wall (painted skin) and of the range wall – registered as walls for the mount checks
  L.walls.push({ axis: 'z', c: -8, a0: -12, a1: 12, Y: 0, lv: 0, thick: 0.2, ops: [{ a: DISPATCH_DOOR[0], b: DISPATCH_DOOR[1], type: 'door', sill: 0, head: 2.36 }], skin: true });
  L.walls.push({ axis: 'x', c: -12, a0: -26, a1: -8, Y: 0, lv: 0, thick: 0.2, ops: [{ a: RANGE_DOOR[0], b: RANGE_DOOR[1], type: 'door', sill: 0, head: 2.36 }], skin: true });
  if (D >= 0) { for (const [a, b] of [[-12, -6], [-6, 2.6], [2.6, 5], [5, 8.6], [8.6, DISPATCH_DOOR[0]], [DISPATCH_DOOR[1], 12]]) mb('wall').box((a + b) / 2, CH / 2, -8.09, b - a, CH, 0.02, { faces: 'z', uv: 2 }); mb('wall').box((DISPATCH_DOOR[0] + DISPATCH_DOOR[1]) / 2, (2.3 + CH) / 2, -8.09, DISPATCH_DOOR[1] - DISPATCH_DOOR[0], CH - 2.3, 0.02, { faces: 'z', uv: 2 });
    for (const [a, b] of [[-26, -19.8], [-19.8, -16.8], [-16.8, RANGE_DOOR[0]], [RANGE_DOOR[1], -8]]) mb('wall').box(-11.91, CH / 2, (a + b) / 2, 0.02, CH, b - a, { faces: 'X', uv: 2 }); mb('wall').box(-11.91, (2.3 + CH) / 2, (RANGE_DOOR[0] + RANGE_DOOR[1]) / 2, 0.02, CH - 2.3, RANGE_DOOR[1] - RANGE_DOOR[0], { faces: 'X', uv: 2 });
    if (D >= 1) for (const [a, b] of [[-12, -6], [-6, 2.6], [2.6, 5], [8.6, DISPATCH_DOOR[0]], [DISPATCH_DOOR[1], 12]]) mb('rubber').box((a + b) / 2, 0.05, -8.105, b - a, 0.1, 0.02, { uv: 0 }); }
  for (const [x0, x1] of [DISPATCH_DOOR]) { mb('frame').box(x0, 1.15, -8, 0.08, 2.3, 0.26); mb('frame').box(x1, 1.15, -8, 0.08, 2.3, 0.26); mb('frame').box((x0 + x1) / 2, 2.32, -8, x1 - x0 + 0.08, 0.06, 0.26); }
  for (const [z0, z1] of [RANGE_DOOR]) { mb('frame').box(-12, 1.15, z0, 0.26, 2.3, 0.08); mb('frame').box(-12, 1.15, z1, 0.26, 2.3, 0.08); mb('frame').box(-12, 2.32, (z0 + z1) / 2, 0.26, 0.06, z1 - z0 + 0.08); mb('metal').box(-12.18, 1.12, z0 - 0.62, 0.05, 2.2, 1.14); }

  // ---- interior walls
  // spine
  wall(-4.5, -60, -4.5, -29, [[-55.4, -54.4, 'door', { side: -1 }], [-49.4, -48.4, 'door', { side: -1 }], [-45.4, -44.2, 'door', { side: -1 }], [-41.6, -40.4, 'door', { side: -1, hinge: 1, leafMat: 'metal' }]]);
  wall(-1.5, -60, -1.5, -29, [[-58.4, -57.2, 'door', { side: 1 }], [-54.0, -52.8, 'door', { side: 1 }], [-50.8, -48.4, 'window', { sill: 0.9, head: 2.25 }], [-46.2, -45.0, 'door', { side: 1 }], [-31.4, -30.2, 'door', { side: 1 }]]);
  // west wing
  wall(-12, -54, -4.5, -54); wall(-12, -48, -4.5, -48); wall(-12, -42, -4.5, -42); wall(-12, -37, -4.5, -37, [[-10.2, -9.2, 'door', { side: 1, leafMat: 'metal' }]]);
  // east wing
  wall(-1.5, -52, 12, -52); wall(-1.5, -44, 12, -44);
  wall(5.5, -52, 5.5, -44, [[-49.6, -47.7, 'window', { sill: 0.9, head: 2.25 }], [-46.2, -45.0, 'door', { side: 1 }]]);
  wall(3, -44, 3, -29, [[-38.5, -32.5, 'counter', { sill: 1.05, head: 2.3 }]]);
  // main corridor M
  wall(-12, -29, -4.5, -29); wall(-1.5, -29, 3, -29); wall(3, -29, 12, -29, [[9.4, 11.2, 'door', { side: -1, leafMat: 'glassDoor' }]]);
  wall(-12, -26, 8.6, -26, [[-11.6, -10.4, 'door', { side: 1, hinge: 1 }], [-8.2, -7.2, 'door', { side: 1, hinge: 1 }], [-3.2, -2.2, 'door', { side: 1, hinge: 1 }], [2.0, 3.0, 'door', { side: 1 }], [3.8, 4.8, 'door', { side: 1, hinge: 1 }]]);
  // band 3: stair B, interview suite, investigation
  wall(-8.6, -26, -8.6, -19.8); wall(-4.4, -26, -4.4, -19.8, [[-24.2, -21.6, 'mirror', { sill: 1.0, head: 2.0 }]], { mirrorSide: -1 }); wall(-0.8, -26, -0.8, -19.8, [[-24.2, -21.6, 'mirror', { sill: 1.0, head: 2.0 }]], { mirrorSide: 1 });
  wall(3.4, -26, 3.4, -19.8); wall(8.6, -26, 8.6, -19.8);
  // corridor S
  wall(-12, -19.8, 8.6, -19.8);
  wall(-12, -16.8, 5, -16.8, [[-9.3, -8.2, 'door', { side: 1, hinge: 1, leafMat: 'metal' }], [-2.6, -1.2, 'pass'], [0.6, 2.0, 'pass'], [3.0, 3.9, 'door', { side: 1, hinge: 1 }]]);
  // band 4
  wall(-6, -16.8, -6, -8); wall(2.6, -16.8, 2.6, -8); wall(5, -16.8, 5, -8); wall(5, -15, 8.6, -15);
  wall(8.6, -15, 8.6, -8, [[-9.5, -8.3, 'door', { side: 1 }]]);

  // ------------------------------------------------ lobby
  for (const z of [-40.5, -33.5]) vent(7.5, z);
  doors.push({ id: 'pd_entrance', kind: 'slide', x: 12, z0: ENTRANCE[0], z1: ENTRANCE[1], y: 0, h: 2.4, axis: 'z', mat: 'glassDoor' });
  mb('dark').box(11.82, 2.52, (ENTRANCE[0] + ENTRANCE[1]) / 2, 0.16, 0.14, ENTRANCE[1] - ENTRANCE[0] + 0.3);
  for (const e of ENTRANCE) mb('frame').box(12, 1.22, e, 0.26, 2.45, 0.1);
  mb('rubber').box(10.8, 0.008, -34, 2.0, 0.016, 2.4, { uv: 0 });
  // front desk counter (public side) under the bullet-resistant window
  mb('woodDark').rbox(3.43, 0.55, -35.5, 0.7, 1.1, 6.6, { r: 0.02, uv: 1, ao: 0.2 }); mb('counterTop').rbox(3.53, 1.12, -35.5, 0.9, 0.05, 6.7, { r: 0.01, uv: 1 }); colFurn(3.08, -38.85, 3.98, -32.15, 0, 1.15);
  mb('seal').panel(3.785, 0.6, -35.5, 0.5, 0.5, 'x', 1);
  const lobW = face('x', 3, 1), lobN = face('z', -44, 1), lobS = face('z', -29, -1), lobE = face('x', 12, -1);
  sign(lobW, -35.5, 2.62, 3.4, 'FRONT DESK · RECORDS · REPORTS', { h: 0.3 });
  f_interact('pd_frontdesk', 'frontdesk', 'Front desk – speak to the desk officer', [3.1, 0.8, -38.5], [4.3, 2.0, -32.5], 2);
  // waiting area: two facing rows of beam seating with a low table, TV on the north wall
  beamSeating(F, 7.6, -43.15, Math.PI, 0, 4); beamSeating(F, 7.6, -39.85, 0, 0, 4);
  table(F, 7.6, -41.5, 0, 0, { w: 1.2, d: 0.55, h: 0.42, top: 'woodDark' }); if (D >= 1) { mb('paper').box(7.35, 0.45, -41.5, 0.3, 0.01, 0.22, { rotY: 0.3, uv: 0 }); mb('print2').box(7.85, 0.45, -41.45, 0.24, 0.012, 0.3, { rotY: -0.2, uv: 0 }); }
  tvOn(lobN, 7.6, 2.1, 1.6, 0.9);
  sign(lobN, 7.6, 3.15, 4.4, 'CITY POLICE DEPARTMENT · WELCOME', { h: 0.34, style: 'big' });
  // report kiosk + brochure rack by the front desk
  mb('satin').rbox(4.2, 0.55, -43.6, 0.9, 1.1, 0.5, { r: 0.03, color: [0.2, 0.24, 0.3] }); mb('satin').rbox(4.2, 1.35, -43.72, 0.7, 0.55, 0.12, { r: 0.02, color: [0.1, 0.1, 0.12], rotX: -0.2 });
  screenSign('pd_kiosk', 4.2, 1.36, -43.645, 0.6, 0.42, 'FILE A REPORT · TOUCH TO START');
  colFurn(3.7, -43.92, 4.7, -43.3, 0, 1.6);
  f_interact('pd_kiosk', 'report_kiosk', 'Report kiosk – file a police report', [3.7, 0.6, -43.9], [4.7, 1.8, -43.2], 1);
  { const [bx, bz] = at(lobN, 5.35, 0.06); mb('satin').box(bx, 1.1, bz, 0.6, 1.1, 0.12, { color: [0.6, 0.56, 0.5] }); for (let i = 0; i < 6; i++) mb(['print1', 'print2', 'paper'][i % 3]).box(bx - 0.15 + (i % 2) * 0.3, 0.75 + Math.floor(i / 2) * 0.32, bz + 0.07, 0.22, 0.28, 0.02, { uv: 0 }); mount(lobN, 5.35, 1.1, 0.6, 1.1, 0.12, 'brochure rack'); }
  // wall of honor (south wall, west of the secure door) + memorial plaque, flags flank the front desk
  pic(lobS, 4.1, 1.7, 0.62, 0.62, 'memorial', { frameMat: 'woodDark' }); pic(lobS, 5.2, 1.75, 0.6, 0.74, 'portrait1'); pic(lobS, 6.15, 1.75, 0.6, 0.74, 'portrait3'); pic(lobS, 7.2, 1.7, 0.66, 0.66, 'flagCase', { frameMat: 'woodDark' });
  sign(lobS, 5.65, 2.55, 3.0, 'HONOR WALL · END OF WATCH', { h: 0.24, style: 'brass' });
  sign(lobS, 10.3, 2.56, 1.9, 'SECURE AREA · STAFF ONLY', { h: 0.24, style: 'warn' });
  flagStand(F, 3.6, -39.6, 0, 'flagUS', Math.PI / 2); flagStand(F, 3.6, -31.4, 0, 'flagIL', Math.PI / 2);
  // windows side: a bench by the glass, plants and the water cooler
  bench(F, 11.6, -39.7, Math.PI / 2, 0, 1.8, { seats: 3 });
  plantPot(F, 11.45, -43.45, 0, 1.1); plantPot(F, 11.45, -31.0, 0, 0.9); plantPot(F, 7.95, -29.55, 0, 0.9);
  waterCooler(F, 11.65, -29.6, 0); trashCan(F, 11.6, -36.3);
 // (keeps atlas warm; nothing visible)
  pic(lobN, 10.15, 1.75, 0.9, 0.62, 'stationPhoto'); pic(lobN, 11.15, 1.75, 0.5, 0.62, 'accreditation');
  pic(lobW, -43.2 + 0.0, 1.75, 0.9, 0.62, 'courthouse'); pic(lobW, -41.0, 1.75, 0.8, 0.62, 'community');
  pic(lobW, -30.6, 1.75, 0.8, 0.6, 'mission', { frameMat: 'woodDark' });
  exitSign(12, -36.15, 'x', -1);
  // lobby nav
  node('p_lob_in', 11.0, -34); node('p_lob_out', 13.6, -34, { outside: true }); node('p_lob_mid', 7.6, -35.2); node('p_lob_desk', 4.55, -35.5, { face: faceTo(4.55, -35.5, 3.0, -35.5) });
  node('p_lob_kiosk', 4.2, -42.9, { face: 0 }); node('p_lob_door', 10.3, -30.0); node('p_lob_wait', 9.6, -41.5);
  link('p_lob_out', 'p_lob_in', 'p_lob_mid', 'p_lob_desk'); link('p_lob_mid', 'p_lob_kiosk'); link('p_lob_mid', 'p_lob_door'); link('p_lob_mid', 'p_lob_wait');
  node('p_lot1', 17.0, -32, { outside: true }); node('p_lot2', 17.5, -8, { outside: true }); link('p_lob_out', 'p_lot1', 'p_lot2');
  for (let i = 0; i < 4; i++) { const x = 7.6 - 0.93 + i * 0.62; node(`p_wait${i}`, x, -43.15, { sit: Math.PI }); node(`p_wait${i}_a`, x, -42.3); link(`p_wait${i}`, `p_wait${i}_a`, 'p_lob_wait'); }

  // ------------------------------------------------ records & front desk (inside)
  const recW = face('x', -1.5, 1), recN = face('z', -44, 1), recS = face('z', -29, -1), recE = face('x', 3, -1);
  const dRec = desk(F, 2.3, -36.7, -Math.PI / 2, 0, { w: 1.5, d: 0.6, monitors: 2, screenKey: 'scr_cw0', wood: 'laminate' }); // desk officers face the window
  const dRecB = desk(F, 2.3, -34.3, -Math.PI / 2, 0, { w: 1.5, d: 0.6, monitors: 1, screenKey: 'scr_cw1', wood: 'laminate' });
  const dRec2 = desk(F, 1.0, -42.4, Math.PI, 0, { w: 1.5, d: 0.7, monitors: 2, screenKey: 'scr_cw2', wood: 'laminate', lamp: true });
  for (const z of [-41.2, -39.3]) shelving(F, -1.08, z, Math.PI / 2, 0, { w: 1.8, d: 0.6, h: 2.2 });
  fileCabinet(F, -1.17, -37.6, -Math.PI / 2, 0, { drawers: 4, w: 0.9 }); fileCabinet(F, -1.17, -36.6, -Math.PI / 2, 0, { drawers: 4, w: 0.9 });
  copier(F, -1.1, -34.2, -Math.PI / 2); trashCan(F, 1.0, -30.0);
  table(F, 0.9, -29.75, 0, 0, { w: 1.6, d: 0.6, top: 'laminate' }); if (D >= 1) { mb('paper').box(0.6, 0.77, -29.75, 0.22, 0.04, 0.3, { uv: 0 }); mb('print1').box(1.2, 0.79, -29.75, 0.3, 0.08, 0.24, { uv: 0 }); }
  board(recN, 1.0, 1.75, 1.8, 0.8, 'cork', 'records board'); pic(recS, -0.2, 1.75, 0.7, 0.5, 'certificate'); pic(recE, -42.0, 1.7, 0.8, 0.56, 'countyMap'); pic(recE, -30.6, 1.75, 0.6, 0.6, 'awardPlaque', { frameMat: 'woodDark' });
  clock(recE, -40.4);
  f_interact('pd_records', 'records', 'Records – look through the case files', [-1.4, 0, -42.2], [-0.7, 2.2, -38.3], 0);
  node('p_rec_door', -0.75, -30.8); node('p_rec_mid', 0.6, -35.6); sitNode('p_rec_desk', dRec.chair); sitNode('p_rec_deskB', dRecB.chair); sitNode('p_rec_desk2', dRec2.chair);
  node('p_rec_files', -0.4, -40.25, { face: faceTo(0, -40.25, -1.5, -40.25) }); node('p_rec_copier', -0.35, -34.2, { face: faceTo(0, -34.2, -1.5, -34.2) }); node('p_rec_n', 0.6, -39.5); node('p_rec_e', 2.4, -41.4); node('p_rec_sup', 2.3, -43.3);
  link('p_rec_door', 'p_rec_mid', 'p_rec_desk'); link('p_rec_mid', 'p_rec_deskB'); link('p_rec_mid', 'p_rec_copier'); link('p_rec_mid', 'p_rec_n', 'p_rec_files'); link('p_rec_n', 'p_rec_e', 'p_rec_sup');
  link('p_rec_sup', 'p_rec_desk2');

  // ------------------------------------------------ roll call / briefing room
  const rcN = face('z', -60, 1), rcS = face('z', -52, -1), rcE = face('x', 12, -1), rcW = face('x', -1.5, 1);
  podium(F, 10.7, -56.0, -Math.PI / 2, 0);
  { const [bx, bz] = at(rcE, -56, 0.03); mb('blackgloss').box(bx, 1.95, bz, 0.06, 1.66, 3.1, { uv: 0 }); mb('pdBriefing').panel(bx - 0.032, 1.95, bz, 2.9, 1.56, 'x', -1); mount(rcE, -56, 1.95, 3.1, 1.66, 0.06, 'briefing screen'); }
  const rcSeats = []; const rcRows = [2.4, 4.5, 6.6, 8.7];
  rcRows.forEach((tx) => { table(F, tx, -56, Math.PI / 2, 0, { w: 4.8, d: 0.6, top: 'laminate', chairs: 0 }); for (let i = 0; i < 5; i++) { const x = tx - 0.75, z = -57.8 + i * 0.9; stackChair(F, x, z, -Math.PI / 2, 0); rcSeats.push([x, z]); } });
  flagStand(F, 11.45, -58.6, 0, 'flagUS', -Math.PI / 2); flagStand(F, 11.45, -53.4, 0, 'flagIL', -Math.PI / 2);
  board(rcS, 3.0, 1.6, 3.2, 1.2, 'whiteboard', 'roll call whiteboard'); board(rcS, 7.4, 1.6, 2.4, 1.1, 'cork', 'BOLO board'); pic(rcS, 10.3, 1.75, 0.7, 0.9, 'bolo');
  pic(rcW, -56.45, 1.75, 1.0, 0.7, 'countyMap'); clock(rcE, -59.0, 2.55); pic(rcN, -0.6, 1.7, 0.6, 0.7, 'safety');
  f_interact('pd_rollcall', 'briefing', 'Read the roll-call briefing', [11.45, 1.0, -57.5], [11.9, 2.8, -54.5], 1);
  node('p_rc_door', -0.75, -57.8); node('p_rc_door2', -0.75, -53.4); node('p_rc_back', 0.4, -56.0); node('p_rc_aisleN', 0.4, -59.1); node('p_rc_aisleS', 0.4, -52.9);
  node('p_rc_frontN', 10.0, -59.1); node('p_rc_frontS', 10.0, -52.9); node('p_rc_front', 9.8, -54.6); node('p_rc_podium', 10.2, -56.0, { face: -Math.PI / 2 });
  link('p_rc_door', 'p_rc_back', 'p_rc_door2'); link('p_rc_door', 'p_rc_aisleN'); link('p_rc_door2', 'p_rc_aisleS'); link('p_rc_aisleN', 'p_rc_frontN', 'p_rc_podium'); link('p_rc_aisleS', 'p_rc_frontS', 'p_rc_front', 'p_rc_podium');
  rcRows.forEach((tx, r) => { const ax = tx - 1.36; const ids = []; for (let i = 0; i < 5; i++) { const id = `p_rc_a${r}_${i}`; node(id, ax, -57.8 + i * 0.9); ids.push(id); }
    node(`p_rc_a${r}_n`, ax, -59.1); node(`p_rc_a${r}_s`, ax, -52.9); link(`p_rc_a${r}_n`, ...ids, `p_rc_a${r}_s`); link('p_rc_aisleN', `p_rc_a${r}_n`); link('p_rc_aisleS', `p_rc_a${r}_s`);
    for (let i = 0; i < 5; i++) { const sid = `p_rc_seat${r * 5 + i}`; node(sid, tx - 0.75, -57.8 + i * 0.9, { sit: -Math.PI / 2 }); link(sid, ids[i]); } });
  nav.rollcall = { seats: rcSeats.map((_, i) => `p_rc_seat${i}`), podium: 'p_rc_podium', screen: [11.85, 1.95, -56] };

  // ------------------------------------------------ patrol sergeants + watch commander
  const sgN = face('z', -52, 1), sgS = face('z', -44, -1), sgE = face('x', 5.5, -1);
  const dS1 = desk(F, 0.9, -51.45, 0, 0, { w: 1.4, d: 0.65, monitors: 2, screenKey: 'scr_cw0', lamp: true }); const dS2 = desk(F, 3.3, -51.45, 0, 0, { w: 1.4, d: 0.65, monitors: 2, screenKey: 'scr_cw2' });
  const dS3 = desk(F, 2.2, -44.45, Math.PI, 0, { w: 1.4, d: 0.65, monitors: 1, screenKey: 'scr_cw1' });
  fileCabinet(F, 5.17, -51.0, Math.PI / 2, 0, { drawers: 3 });
  table(F, 2.2, -47.9, 0, 0, { w: 1.4, d: 0.8, top: 'laminate', chairs: 2, chairType: 'guest' });
  board(sgS, 0.2, 1.75, 1.3, 0.8, 'whiteboard', 'patrol schedule'); charger(sgS, 4.2, 1.35, 6);

  sign(face('x', -1.5, -1), -45.6, 2.55, 1.6, 'PATROL SERGEANTS'); sign(face('x', -1.5, -1), -49.6, 2.62, 2.2, 'WATCH COMMAND', { style: 'brass', h: 0.24 });
  sign(face('x', 5.5, -1), -45.6, 2.55, 1.7, 'WATCH COMMANDER');
  node('p_sgt_door', -0.75, -45.6); node('p_sgt_mid', 1.2, -46.6); sitNode('p_sgt_d1', dS1.chair); sitNode('p_sgt_d2', dS2.chair); sitNode('p_sgt_d3', dS3.chair);
  node('p_sgt_n', 2.1, -50.3); node('p_sgt_w', 0.4, -48.0); node('p_wc_door0', 4.75, -45.6);
  link('p_sgt_door', 'p_sgt_mid', 'p_wc_door0'); link('p_sgt_mid', 'p_sgt_w', 'p_sgt_n', 'p_sgt_d1'); link('p_sgt_n', 'p_sgt_d2'); link('p_sgt_mid', 'p_sgt_d3');
  // watch commander's office: faces the door and the glass onto the sergeants' room
  const wcN = face('z', -52, 1), wcS = face('z', -44, -1), wcE = face('x', 12, -1);
  const dWC = desk(F, 9.2, -48.2, Math.PI / 2, 0, { w: 1.6, d: 0.8, monitors: 2, screenKey: 'scr_cw1', exec: true, guest: 2, lamp: true, wood: 'woodDark' });
  bookcase(F, 9.6, -51.74, Math.PI, 0, { w: 1.6, h: 1.9, wood: 'woodDark' }); fileCabinet(F, 11.67, -45.0, Math.PI / 2, 0, { drawers: 3 });
  table(F, 7.0, -50.3, 0, 0, { w: 0.9, round: true, top: 'woodDark', chairs: 3, chairType: 'guest' });
  board(wcS, 8.6, 1.65, 2.4, 1.1, 'cork', 'beat map'); pic(wcS, 6.4, 1.75, 0.6, 0.6, 'awardPlaque', { frameMat: 'woodDark' }); tvOn(wcN, 7.0, 2.0, 1.2, 0.68);
  flagStand(F, 11.5, -51.5, 0, 'flagUS', -Math.PI / 2); plantPot(F, 6.0, -44.5, 0, 0.8);
  f_interact('pd_wc_desk', 'pd_desk', "Look at the Watch Commander's desk", [8.7, 0, -49.1], [9.7, 1.3, -47.3], 0, { who: 'Watch Commander' });
  node('p_wc_door', 6.3, -45.6); sitNode('p_wc_desk', dWC.chair); node('p_wc_visit', 7.4, -46.3, { face: faceTo(7.4, -46.3, 9.2, -48.2) }); node('p_wc_behind', 10.6, -46.0);
  sitNode('p_wc_guest', dWC.guests[0]); sitNode('p_wc_guest2', dWC.guests[1]);
  link('p_wc_door0', 'p_wc_door', 'p_wc_visit', 'p_wc_behind', 'p_wc_desk'); link('p_wc_visit', 'p_wc_guest'); link('p_wc_visit', 'p_wc_guest2');

  // ------------------------------------------------ locker rooms + restrooms
  for (const [z0, z1, men] of [[-60, -54, true], [-54, -48, false]]) {
    const tag = men ? 'm' : 'w'; const n0 = `p_rr${tag}`;
    const wW = face('x', -12, 1), wE = face('x', -4.5, -1), wN = face('z', z0, 1), wS = face('z', z1, -1);
    wainscot(wW, z0 + 0.08, z1 - 0.08, { h: 1.5, mat: 'ceramic', rail: null }); wainscot(men ? wN : wS, -11.92, -4.58, { h: 1.5, mat: 'ceramic', rail: null });
    // stalls along the west wall (doors face the room), the last one accessible
    const stalls = men ? 2 : 3; const sw = men ? [0.95, 1.25] : [0.95, 0.95, 1.2]; let zs = z0 + 0.12;
    for (let i = 0; i < stalls; i++) {
      const d = stallX(F, -11.92, zs, 1.5, sw[i], 0, { id: `pd_stall_${tag}${i}`, accessible: i === stalls - 1, shared: i > 0 });
      doors.push(d); nav.stalls.push({ id: d.id, gender: tag, x: -11.92 + 0.75, z: zs + sw[i] / 2, door: [-11.92 + 1.9, zs + sw[i] / 2] });
      node(`p_st${tag}${i}_out`, -9.75, zs + sw[i] / 2); node(`p_st${tag}${i}`, -11.3, zs + sw[i] / 2, { face: -Math.PI / 2, stall: `pd_stall_${tag}${i}` }); link(`${n0}_mid`, `p_st${tag}${i}_out`, `p_st${tag}${i}`);
      zs += sw[i];
    }
    const stallEnd = zs;
    vanity(F, -11.92, men ? stallEnd + 1.15 : stallEnd + 1.0, 1, 0, 2, 'x'); mount(wW, men ? stallEnd + 1.15 : stallEnd + 1.0, 1.55, 1.74, 0.94, 0.02, 'vanity mirror');
    if (men) { urinal(F, -9.0, z0 + 0.08, 1, 0); urinal(F, -8.1, z0 + 0.08, 1, 0); }
    // lockers along the shared wall between the two rooms, bench in front
    const lz = men ? z1 - 0.08 - 0.24 : z0 + 0.08 + 0.24; lockerBank(F, -7.4, lz, men ? 0 : Math.PI, 0, { n: 9, bench: true });
    mount(men ? wS : wN, -7.4, 1.05, 3.42, 1.9, 0.48, 'lockers');
    if (D >= 1) { const dz = men ? z0 + 0.9 : z0 + 1.4; const [hx, hz] = at(wE, dz, 0.06); mb('satin').rbox(hx, 1.35, hz, 0.12, 0.3, 0.26, { r: 0.03, color: [0.82, 0.82, 0.82] }); mount(wE, dz, 1.35, 0.26, 0.3, 0.12, 'hand dryer'); }
    { const mz0 = men ? z0 + 2.4 : z0 + 2.5; const [mx, mz] = at(wE, mz0, 0.006); mb('mirror').panel(mx, 1.3, mz, 0.6, 1.5, 'x', -1); mount(wE, mz0, 1.3, 0.6, 1.5, 0.01, 'mirror'); }
    trashCan(F, -5.1, men ? z0 + 0.4 : z1 - 0.45);
    sign(face('x', -4.5, 1), men ? -54.9 : -48.9, 2.55, 1.9, men ? "MEN'S LOCKER ROOM" : "WOMEN'S LOCKER ROOM");
    f_interact(`pd_restroom_${tag}`, 'restroom', 'Wash up at the sink', [-11.92, 0.8, (men ? stallEnd + 1.15 : stallEnd + 1.0) - 0.85], [-11.3, 1.3, (men ? stallEnd + 1.15 : stallEnd + 1.0) + 0.85], 0);
    f_interact(`pd_lockers_${tag}`, 'pd_lockers', men ? "Officer lockers (men's)" : "Officer lockers (women's)", [-9.1, 0, Math.min(lz, lz + (men ? -0.25 : 0.25))], [-5.7, 2.0, Math.max(lz, lz + (men ? -0.25 : 0.25))], 0);
    const doorZ = men ? -54.9 : -48.9; const vz = men ? stallEnd + 1.15 : stallEnd + 1.0;
    node(`${n0}_door`, -5.25, doorZ); node(`${n0}_mid`, -8.0, men ? -57.3 : -50.7); node(`${n0}_sink`, -10.85, vz, { face: Math.PI / 2 }); node(`${n0}_lock`, -6.0, men ? -55.0 : -53.0, { face: men ? Math.PI : 0 }); node(`${n0}_bench`, -7.4, men ? lz - 0.84 : lz + 0.84, { sit: men ? 0 : Math.PI });
    link(`${n0}_door`, `${n0}_mid`, `${n0}_sink`); link(`${n0}_door`, `${n0}_lock`); link(`${n0}_mid`, `${n0}_bench`);
    if (men) { node('p_rrm_uri0', -9.0, z0 + 0.75, { face: 0 }); node('p_rrm_uri1', -8.1, z0 + 0.75, { face: 0 }); link('p_rrm_mid', 'p_rrm_uri0'); link('p_rrm_mid', 'p_rrm_uri1'); }
  }

  // ------------------------------------------------ report writing room
  { const rwN = face('z', -48, 1), rwS = face('z', -42, -1);
    const rw = []; for (const x of [-10.95, -9.4, -7.85]) rw.push(desk(F, x, -47.62, 0, 0, { w: 1.4, d: 0.6, monitors: 1, screenKey: 'scr_cw0', wood: 'laminate', papers: true }));
    for (const x of [-10.95, -9.4, -7.85]) rw.push(desk(F, x, -42.38, Math.PI, 0, { w: 1.4, d: 0.6, monitors: 1, screenKey: 'scr_cw2', wood: 'laminate' }));
    copier(F, -5.35, -47.6, Math.PI); trashCan(F, -6.2, -47.7);
    board(rwN, -9.4, 1.85, 3.0, 0.7, 'whiteboard', 'report writing board'); pic(rwS, -9.4, 1.85, 0.8, 0.56, 'bolo'); pic(rwS, -6.2, 1.75, 0.7, 0.5, 'certificate');
    sign(face('x', -4.5, 1), -44.8, 2.55, 1.6, 'REPORT WRITING');
    node('p_rw_door', -5.3, -44.8); node('p_rw_mid', -8.6, -44.9); link('p_rw_door', 'p_rw_mid');
    rw.forEach((d, i) => { sitNode(`p_rw_d${i}`, d.chair); link('p_rw_mid', `p_rw_d${i}`); });
  }

  // ------------------------------------------------ evidence & property
  { const ivN = face('z', -42, 1), ivW = face('x', -12, 1), spW = face('x', -4.5, -1), spE = face('x', -4.5, 1);
    mb('satin').rbox(-8.4, 0.48, -39.4, 3.0, 0.96, 0.7, { r: 0.01, color: [0.36, 0.4, 0.46] }); mb('counterTop').rbox(-8.4, 0.98, -39.4, 3.1, 0.05, 0.8, { r: 0.01, uv: 1 }); colFurn(-9.95, -39.8, -6.85, -39.0, 0, 1.05);
    mb('paper').box(-8.6, 1.015, -39.4, 0.32, 0.012, 0.25, { uv: 0 }); mb('paper').rbox(-8.0, 1.06, -39.35, 0.25, 0.1, 0.2, { r: 0.02, uv: 0 });
    // packaging bench + drying cabinet on the west wall
    mb('satin').rbox(-11.6, 0.46, -40.6, 0.64, 0.92, 2.0, { r: 0.01, color: [0.42, 0.45, 0.5] }); mb('counterTop').rbox(-11.6, 0.94, -40.6, 0.68, 0.04, 2.04, { r: 0.01, uv: 1 }); colFurn(-11.92, -41.62, -11.26, -39.58, 0, 0.96);
    mb('satin').rbox(-11.62, 1.0, -38.0, 0.6, 2.0, 0.9, { r: 0.01, color: [0.86, 0.87, 0.87] }); colFurn(-11.92, -38.45, -11.32, -37.55, 0, 2.0);
    // pass-through temporary lockers in the spine wall (fill from the corridor, empty from the room)
    for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) for (const fc of [spW, spE]) { const [px, pz] = at(fc, -38.8 + q * 0.5, 0.01); mb('satin').box(px, 0.6 + r * 0.55, pz, 0.02, 0.5, 0.46, { color: [0.42, 0.45, 0.5] }); const [lx, lz] = at(fc, -38.7 + q * 0.5, 0.022); mb('beaconGreen').box(lx, 0.75 + r * 0.55, lz, 0.005, 0.02, 0.02); }
    for (const fc of [spW, spE]) mount(fc, -38.3, 1.15, 1.5, 1.65, 0.02, 'pass-through lockers');
    sign(spE, -40.4 + 0.0, 2.62, 2.6, 'EVIDENCE & PROPERTY · AUTHORIZED ONLY', { h: 0.24, style: 'warn' }); sign(spE, -38.3, 2.15, 1.5, 'EVIDENCE DROP LOCKERS', { h: 0.2, style: 'light' });
    pic(ivN, -8.4, 1.8, 0.7, 0.9, 'safety');
    f_interact('pd_evidence', 'evidence', 'Evidence intake – log an item', [-10, 0.8, -40.0], [-6.8, 1.6, -38.8], 1);
    // storage cage: shelving rows, drug & gun safes
    for (const z of [-34.9, -32.9, -30.9]) { shelving(F, -11.62, z, Math.PI / 2, 0, { w: 1.8, d: 0.6, items: 'boxes' }); shelving(F, -9.0, z, Math.PI / 2, 0, { w: 1.8, d: 0.6, items: 'bags' }); shelving(F, -6.6, z, Math.PI / 2, 0, { w: 1.8, d: 0.6, items: z < -33 ? 'bags' : 'boxes' }); }
    mb('satin').rbox(-5.05, 0.8, -30.0, 0.7, 1.6, 0.9, { r: 0.02, color: [0.2, 0.22, 0.2] }); mb('chrome').cylinder(-5.42, 0.95, -30.0, 0.06, 0.03, 12); colFurn(-5.4, -30.45, -4.58, -29.55, 0, 1.6);
    mb('satin').rbox(-5.0, 0.6, -35.6, 0.6, 1.2, 1.2, { r: 0.02, color: [0.25, 0.3, 0.35] }); colFurn(-5.3, -36.2, -4.58, -35.0, 0, 1.2);
    sign(face('z', -37, -1), -9.7, 2.55, 1.4, 'PROPERTY ROOM', { h: 0.22, style: 'warn' });
    node('p_ev_door', -5.3, -41.0); node('p_ev_counter', -8.4, -40.25, { face: 0 + Math.PI }); node('p_ev_by', -6.3, -38.4); node('p_ev_mid', -8.4, -38.2); node('p_ev_gate', -9.7, -37.6); node('p_ev_cage', -9.7, -36.2);
    node('p_ev_rows', -10.3, -33.4, { face: Math.PI / 2 }); node('p_ev_rows2', -7.8, -31.9, { face: -Math.PI / 2 }); node('p_ev_aisle', -7.8, -36.3); node('p_ev_inv', -5.85, -36.5, {});
    link('p_ev_door', 'p_ev_counter'); link('p_ev_door', 'p_ev_by', 'p_ev_mid', 'p_ev_gate', 'p_ev_cage', 'p_ev_rows'); link('p_ev_cage', 'p_ev_aisle', 'p_ev_rows2'); link('p_ev_aisle', 'p_ev_inv');
  }

  // ------------------------------------------------ interview suite (two rooms + observation)
  { for (const [x0, x1, n] of [[-8.6, -4.4, 1], [-0.8, 3.4, 2]]) {
      const cx = (x0 + x1) / 2; interviewSet(F, cx, -21.75, 0, 0);
      const back = face('z', -19.8, -1); const side = face('x', n === 1 ? x0 : x1, n === 1 ? 1 : -1);
      wainscot(back, x0 + 0.08, x1 - 0.08, { h: 2.4, mat: 'acoustic', rail: null }); wainscot(side, -25.92, -19.88, { h: 2.4, mat: 'acoustic', rail: null });
      const [dx, dz] = [n === 1 ? x0 + 0.2 : x1 - 0.2, -19.98]; mb('dark').sphere(dx, CH - 0.05, dz, 0.07, 10, 6, { sy: 0.6 });
    }
    // observation: counters with monitors along both mirrors
    for (const [sx, s] of [[-4.4, 1], [-0.8, -1]]) { const x = sx + s * (0.08 + 0.28); mb('laminate').rbox(x, 0.74, -22.6, 0.56, 0.04, 3.8, { r: 0.01, uv: 1 }); mb('satin').box(x, 0.36, -22.6, 0.5, 0.72, 3.7, { color: [0.3, 0.32, 0.36] }); colFurn(Math.min(sx + s * 0.08, x + s * 0.28), -24.5, Math.max(sx + s * 0.08, x + s * 0.28), -20.7, 0, 0.8);
      const mx = x - s * 0.05; mb('bezel').rbox(mx, 1.02, -21.0, 0.025, 0.3, 0.5, { r: 0.006, uv: 0 }); mb('scr_cw1').panel(mx + s * 0.014, 1.02, -21.0, 0.46, 0.26, 'x', s); mb('dark').box(mx - s * 0.06, 0.765, -21.0, 0.16, 0.012, 0.22, { uv: 0 }); }
    officeChair(F, -3.45, -22.0, Math.PI / 2, 0); officeChair(F, -1.75, -22.0, -Math.PI / 2, 0);
    pic(face('z', -19.8, -1), -2.6, 1.8, 0.7, 0.5, 'certificate', { what: 'interview protocol' });
    const mS = face('z', -26, -1);
    sign(mS, -7.7, 2.55, 1.3, 'INTERVIEW 1'); recLight(mS, -6.6); sign(mS, -2.7, 2.55, 1.4, 'OBSERVATION'); sign(mS, 2.5, 2.55, 1.2, 'INTERVIEW 2'); recLight(mS, 1.4);
    f_interact('pd_interview', 'interview', 'Observation room – watch the interview monitors', [-4.32, 0.7, -21.6], [-3.9, 1.4, -20.4], 1);
    node('p_obs_door', -2.7, -25.2); node('p_obs', -2.6, -23.6); node('p_obs_seat', -3.45, -22.0, { sit: Math.PI / 2 }); node('p_obs_seat2', -1.75, -22.0, { sit: -Math.PI / 2 });
    node('p_iv1', -7.7, -25.2); node('p_iv1_m', -5.0, -23.0); node('p_iv1_seat', -6.5, -21.07, { sit: 0 }); node('p_iv1_s', -5.0, -21.07);
    node('p_iv2', 2.5, -25.2); node('p_iv2_m', 2.9, -23.0); node('p_iv2_seat', 1.3, -21.07, { sit: 0 }); node('p_iv2_s', 2.9, -21.07);
    link('p_obs_door', 'p_obs', 'p_obs_seat'); link('p_obs', 'p_obs_seat2'); link('p_iv1', 'p_iv1_m', 'p_iv1_s', 'p_iv1_seat'); link('p_iv2', 'p_iv2_m', 'p_iv2_s', 'p_iv2_seat');
  }

  // ------------------------------------------------ investigation / case-processing room (ground)
  { const inS = face('z', -19.8, -1), inE = face('x', 8.6, -1), inW = face('x', 3.4, 1);
    table(F, 6.0, -22.6, Math.PI / 2, 0, { w: 2.6, d: 1.1, top: 'laminate', chairs: 4, chairType: 'office' });
    board(inS, 6.0, 1.6, 3.2, 1.2, 'cork', 'case board'); board(inE, -23.3, 1.6, 2.2, 1.1, 'whiteboard', 'investigation whiteboard');
    for (let i = 0; i < 7; i++) { const [px, pz] = at(inS, 4.75 + i * 0.42, 0.04); mb(['paper', 'print1', 'print2'][i % 3]).box(px, 1.45 + (i % 3) * 0.26, pz, 0.28, 0.2, 0.008, { uv: 0 }); }
    fileCabinet(F, 3.73, -20.6, -Math.PI / 2, 0, { drawers: 4 }); pic(inW, -23.6, 1.75, 0.8, 0.56, 'countyMap');
    sign(face('z', -26, -1), 4.6, 2.55, 1.9, 'INVESTIGATION ROOM');
    f_interact('pd_invest1', 'investigation', 'Investigation room – study the case board', [4.4, 0.9, -20.3], [7.6, 2.3, -19.92], 1);
    node('p_inv_door', 4.3, -25.2); node('p_inv', 4.4, -23.0, { face: faceTo(4.4, -23.0, 6, -22.6) }); node('p_inv_board', 6.0, -20.6, { face: 0 + Math.PI }); node('p_inv_w', 4.2, -20.6);
    link('p_inv_door', 'p_inv', 'p_inv_w', 'p_inv_board');
  }

  // ------------------------------------------------ gun room
  { const gW = face('x', -12, 1, 0.2), gE = face('x', -6, -1), gS = face('z', -8, -1, 0.2), gN = face('z', -16.8, 1);
    gunRack(F, -11.71, -15.4, -Math.PI / 2, 0, { n: 7 }); gunRack(F, -11.71, -13.4, -Math.PI / 2, 0, { n: 6 });
    vestRack(F, -6.23, -12.2, Math.PI / 2, 0, 6);
    mb('satin').rbox(-9.0, 0.9, -11.9, 2.2, 0.05, 0.8, { r: 0.01, color: [0.4, 0.42, 0.44] }); mb('satin').box(-9.0, 0.45, -11.9, 2.1, 0.86, 0.75, { faces: 'zZxX', color: [0.2, 0.24, 0.28] }); colFurn(-10.15, -12.35, -7.85, -11.45, 0, 0.95);
    mb('rubber').box(-9.0, 0.93, -11.9, 1.6, 0.01, 0.5); mb('satin').box(-9.3, 0.97, -11.8, 0.22, 0.06, 0.12, { color: [0.05, 0.05, 0.05] });
    mb('satin').cylinder(-7.0, 0.45, -8.75, 0.25, 0.9, 16, { color: [0.15, 0.18, 0.2] }); mb('safety').cylinder(-7.0, 0.91, -8.75, 0.26, 0.02, 16); colFurn(-7.3, -9.05, -6.7, -8.45, 0, 0.9); // clearing barrel
    charger(gS, -9.0, 1.3, 8); pic(gE, -15.2, 1.7, 0.7, 0.9, 'firearms'); pic(gN, -10.8, 1.7, 0.7, 0.9, 'safety');
    sign(gW, -10.0, 2.62, 1.2, 'RANGE · EYES & EARS', { h: 0.22, style: 'warn' });
    sign(face('z', -16.8, -1), -8.75, 2.55, 2.0, 'EQUIPMENT & GUN ROOM', { style: 'warn' });
    f_interact('pd_armory', 'armory', 'Gun room – check out training equipment', [-11.95, 0, -16.2], [-11.4, 2.1, -12.6], 1);
    f_interact('pd_rangedoor', 'range', 'Go out onto the range (training)', [-12.3, 0, RANGE_DOOR[0]], [-11.6, 2.3, RANGE_DOOR[1]], 2);
    node('p_gun_door', -8.75, -16.0); node('p_gun_mid', -9.4, -14.3); node('p_gun_rack', -10.9, -14.4, { face: Math.PI / 2 }); node('p_gun_bench', -9.0, -11.05, { face: 0 }); node('p_gun_range', -11.3, -10.0, {}); node('p_range_in', -12.8, -10, {});
    link('p_gun_door', 'p_gun_mid', 'p_gun_rack'); link('p_gun_mid', 'p_gun_w', 'p_gun_range', 'p_range_in'); node('p_gun_w', -11.0, -11.3); link('p_gun_w', 'p_gun_bench');
    nav.rangeLink = ['p_range_in', 'range_line'];
  }

  // ------------------------------------------------ break room
  { const bW = face('x', -6, 1), bE = face('x', 2.6, -1), bN = face('z', -16.8, 1);
    kitchenette(F, -5.85, -1.6, -8.1, -1, 0, {});
    doors.push(fridge(F, -1.05, -8.12, -1, 0, { id: 'pd_fridge' }));
    vendingMachine(F, 0.0, -8.5, -1, 0, { id: 'pd_vending' }); vendingMachine(F, 1.0, -8.5, -1, 0, { id: 'pd_vending2', drinks: true });
    trashCan(F, 2.1, -8.5, 0, 'recycle'); trashCan(F, 2.1, -9.0);
    const brSeats = table(F, -3.4, -11.0, 0, 0, { w: 2.0, d: 0.9, top: 'wood', chairs: 6, chairType: 'stack' });
    const brRound = table(F, 0.5, -11.7, 0, 0, { w: 1.0, round: true, top: 'wood', chairs: 4, chairType: 'stack' });
    // lounge corner: sofa facing the TV on the west wall
    sofa(F, -3.55, -14.6, Math.PI / 2, 0, { w: 2.1 }); table(F, -4.85, -14.6, 0, 0, { w: 0.5, d: 1.0, h: 0.42, top: 'woodDark' });
    tvOn(bW, -14.6, 1.85, 1.5, 0.86);
    board(bE, -13.2, 1.6, 1.6, 1.0, 'cork', 'break room board'); pic(bE, -10.9, 1.75, 0.7, 0.9, 'wellness'); pic(bN, -0.6, 1.75, 0.8, 0.56, 'community'); clock(bN, 2.3);
    plantPot(F, 2.15, -14.8, 0, 0.9);
    sign(face('z', -16.8, -1), -0.3, 2.62, 1.5, 'BREAK ROOM');
    f_interact('pd_break_tv', 'tv', 'Watch the news', [-5.95, 1.4, -15.4], [-5.7, 2.4, -13.8], 0);
    node('p_br_door1', -1.9, -16.1); node('p_br_door2', 1.3, -16.1); node('p_br_mid', -1.2, -12.9); node('p_br_coffee', -2.9, -9.1, { face: 0 + Math.PI }); node('p_br_micro', -5.45, -9.1, { face: Math.PI });
    node('p_br_fridge', -1.05, -9.3, { face: Math.PI, fridge: 'pd_fridge' }); node('p_br_vend', -0.08, -9.3, { face: Math.PI }); node('p_br_vend2', 0.92, -9.3, { face: Math.PI }); node('p_br_k', -2.0, -9.6);
    link('p_br_door1', 'p_br_mid', 'p_br_door2'); link('p_br_mid', 'p_br_k', 'p_br_coffee', 'p_br_micro'); link('p_br_k', 'p_br_fridge', 'p_br_vend', 'p_br_vend2');
    node('p_br_tn', -3.4, -12.55); node('p_br_ts', -3.4, -9.55); link('p_br_mid', 'p_br_tn'); link('p_br_k', 'p_br_ts');
    brSeats.forEach((pose, i) => { sitNode(`p_br_t${i}`, pose); link(pose[1] < -11.0 ? 'p_br_tn' : 'p_br_ts', `p_br_t${i}`); });
    node('p_br_rn', 0.5, -13.3); node('p_br_rs', 0.5, -10.1); link('p_br_mid', 'p_br_rn'); link('p_br_k', 'p_br_rs');
    brRound.forEach((pose, i) => { sitNode(`p_br_r${i}`, pose); link(pose[1] < -12.0 ? 'p_br_rn' : pose[1] > -11.4 ? 'p_br_rs' : pose[0] < 0.5 ? 'p_br_mid' : 'p_br_chat', `p_br_r${i}`); });
    node('p_br_sofa', -3.6, -14.6, { sit: Math.PI / 2 }); node('p_br_sofa_a', -2.6, -14.6); link('p_br_mid', 'p_br_sofa_a', 'p_br_sofa'); node('p_br_chat', 1.6, -13.4, { face: Math.PI / 2 }); link('p_br_mid', 'p_br_chat');
  }

  // ------------------------------------------------ janitor & supply
  { for (const z of [-15.6, -13.6, -11.6]) shelving(F, 4.67, z, Math.PI / 2, 0, { w: 1.8, d: 0.5, h: 2.0 });
    mb('satin').cylinder(3.2, 0.35, -9.0, 0.25, 0.6, 14, { color: [0.85, 0.7, 0.1] }); mb('metal').box(3.4, 0.45, -10.0, 0.5, 0.9, 0.7); colFurn(2.68, -10.4, 3.7, -8.68, 0, 0.9);
    sign(face('z', -16.8, -1), 3.45, 2.55, 0.9, 'JANITOR', { h: 0.22 });
  }

  // ------------------------------------------------ corridors (ground): each with its own character
  { // SPINE – "patrol hall": navy acoustic lower walls, a wood chair rail, patrol photos and bulletins
    const sW = face('x', -4.5, 1), sE = face('x', -1.5, -1), sN = face('z', -60, 1);
    wainscot(sW, -59.92, -29.08, { h: 1.05, mat: 'accent' }); wainscot(sE, -59.92, -29.08, { h: 1.05, mat: 'accent' });

    pic(sW, -57.6, 1.75, 1.0, 0.68, 'patrolCar'); pic(sW, -52.0, 1.75, 1.2, 0.8, 'groupPhoto'); board(sW, -46.9, 1.6, 1.4, 0.9, 'cork', 'patrol bulletin');
    pic(sW, -43.0, 1.75, 0.8, 0.6, 'k9'); pic(sW, -34.6, 1.75, 0.9, 0.64, 'motorUnit'); pic(sW, -32.0, 1.75, 0.66, 0.66, 'badgeCase', { frameMat: 'woodDark' });
    pic(sE, -59.2, 1.75, 0.6, 0.6, 'awardPlaque', { frameMat: 'woodDark' }); pic(sE, -55.6, 1.75, 0.62, 0.8, 'officerMonth'); pic(sE, -47.3, 1.75, 0.7, 0.5, 'certificate');
    // department history timeline along the records wall
    sign(sE, -39.0, 2.42, 3.8, 'OUR HISTORY · SERVING CARMI SINCE 1903', { h: 0.22, style: 'brass' });
    [['oldStation', -42.8], ['oldOfficers', -40.9], ['newspaper', -39.0], ['portrait2', -37.1], ['stationPhoto', -35.2]].forEach(([c, z]) => pic(sE, z, 1.72, 0.7, 0.7, c, { frameMat: 'woodDark' }));
    extinguisher(sW, -36.2); aed(sE, -33.3); clock(sE, -51.2, 2.62);
    sign(sE, -57.8, 2.55, 2.0, 'ROLL CALL · BRIEFING'); sign(sE, -53.4, 2.55, 1.5, 'ROLL CALL'); sign(sE, -30.8, 2.55, 1.4, 'RECORDS');
    hangSign(-3.0, -31.0, 'z', 2.6, '↑ ROLL CALL · WATCH CMD · LOCKERS · EVIDENCE');
    hangSign(-3.0, -50.6, 'z', 2.6, '↑ ROLL CALL · LOCKERS     ↓ LOBBY · RECORDS');
    // MAIN CORRIDOR M – "history & honor": dark wood wainscot, framed department history, awards
    const mN = face('z', -29, 1), mS = face('z', -26, -1), mW = face('x', -12, 1);
    wainscot(mN, -11.92, 11.92, { h: 1.1, mat: 'woodDark' }); wainscot(mS, -11.92, 8.6, { h: 1.1, mat: 'woodDark' });
    pic(mN, -10.4, 1.78, 0.9, 0.62, 'oldStation', { frameMat: 'woodDark' }); pic(mN, -8.6, 1.78, 0.9, 0.62, 'oldOfficers', { frameMat: 'woodDark' }); pic(mN, -6.8, 1.78, 0.62, 0.62, 'ribbons', { frameMat: 'woodDark' });
    pic(mN, -0.6, 1.75, 0.62, 0.62, 'coins', { frameMat: 'woodDark' }); pic(mN, 1.6, 1.75, 0.66, 0.66, 'accreditation');
    pic(mN, 4.3, 1.75, 0.7, 0.5, 'certificate'); pic(mN, 5.5, 1.75, 0.7, 0.5, 'certificate'); pic(mN, 6.7, 1.75, 0.6, 0.6, 'awardPlaque', { frameMat: 'woodDark' }); pic(mN, 7.9, 1.75, 0.6, 0.6, 'awardPlaque', { frameMat: 'woodDark' });
    sign(mN, 6.1, 2.45, 3.2, 'DEPARTMENT AWARDS & COMMENDATIONS', { h: 0.2, style: 'brass' });

    pic(mS, -5.3, 1.75, 0.66, 0.5, 'certificate', { what: 'interview rules' }); pic(mS, 6.6, 1.75, 0.9, 0.62, 'courthouse'); extinguisher(mS, 8.1);
    sign(mS, -11.0, 2.55, 1.6, 'STAIR B · FLOORS 1–2'); clock(mN, -1.0, 2.62);
    hangSign(-6.0, -27.5, 'x', 2.6, 'INTERVIEW · STAIR B ←   → LOBBY · DISPATCH');
    // CORRIDOR C – "dispatch link": blue stripe, radios on their chargers, 911 photos, bench by the windows
    const cW = face('x', 8.6, 1), cE = face('x', 12, -1);
    stripe(cW, -25.92, -8.1, 1.05, 0.12, [0.12, 0.3, 0.6]); stripe(cE, -25.92, -8.1, 1.05, 0.12, [0.12, 0.3, 0.6]);
    charger(cW, -13.4, 1.35, 8); pic(cW, -24.0, 1.75, 1.0, 0.68, 'dispatchPhoto'); pic(cW, -21.2, 1.75, 0.8, 0.6, 'stationPhoto');

    pic(cE, -15.5, 1.75, 0.9, 0.62, 'patrolCar'); bench(F, 11.6, -21.3, Math.PI / 2, 0, 1.6, { seats: 2 }); waterCooler(F, 11.65, -14.3, 0);
    sign(face('z', -8, -1, 0.2), 9.9, 2.95, 2.4, 'DISPATCH · 911 CENTER', { style: 'room' });
    sign(cW, -8.9, 2.55, 1.6, 'STAIR A · FLOORS 1–2');
    directory(cE, -9.45, 1.62, 0);
    exitSign(9.9, -8, 'z', -1, 0.2); aed(cE, -16.9 + 0.0);
    // CORRIDOR S – "training & wellness": ceramic lower walls (it sees boots from the range), qualifications, trophy case
    const ssN = face('z', -19.8, 1), ssS = face('z', -16.8, -1), alcN = face('z', -15, -1);
    wainscot(ssN, -11.92, 8.6, { h: 1.2, mat: 'ceramic', rail: 'metal', railH: 0.05 }); wainscot(ssS, -11.92, 5.0, { h: 1.2, mat: 'ceramic', rail: 'metal', railH: 0.05 });
    pic(ssN, -10.4, 1.75, 0.8, 0.56, 'certificate'); pic(ssN, -7.6, 1.75, 0.8, 0.56, 'certificate'); board(ssN, -4.6, 1.65, 1.6, 0.9, 'whiteboard', 'range qualifications');
    pic(ssN, -1.4, 1.75, 0.7, 0.9, 'wellness'); pic(ssN, 1.6, 1.75, 0.9, 0.62, 'community'); pic(ssN, 4.6, 1.78, 0.7, 0.9, 'firearms'); pic(ssN, 7.2, 1.75, 0.8, 0.6, 'fields');

    pic(ssS, -5.0, 1.75, 0.7, 0.9, 'safety'); extinguisher(ssS, -10.9);
    displayCase(alcN, 6.8, 2.6);
  }
  // ground corridor nav: spine, M, C, S
  const corridor = (prefix, fixed, axis, pts) => { // axis 'z': runs along z at x = fixed
    const list = [...new Set(pts.map((v) => +v.toFixed(2)))].sort((p, q) => p - q); const ids = list.map((v) => { const id = `${prefix}${v}`; node(id, axis === 'z' ? fixed : v, axis === 'z' ? v : fixed); return id; });
    link(...ids); return (v) => `${prefix}${+v.toFixed(2)}`;
  };
  const sp = corridor('p_sp', -3.0, 'z', [-59.0, -57.8, -54.9, -53.4, -48.9, -45.6, -44.8, -41.0, -30.8, -27.5]);
  const mc = corridor('p_m', -27.5, 'x', [-11.0, -7.7, -6.0, -3.0, -2.7, 2.5, 4.3, 10.3]);
  const sc = corridor('p_s', -18.3, 'x', [-11.0, -8.75, -1.9, 1.3, 3.45, 6.8]);
  node('p_c1', 10.3, -10.0); node('p_c2', 10.3, -13.4); node('p_c3', 10.3, -18.3); node('p_c4', 10.3, -22.0); node('p_c5', 10.3, -27.5);
  link('p_c1', 'p_c2', 'p_c3', 'p_c4', 'p_c5'); link(mc(4.3), 'p_c5'); link(mc(10.3), 'p_c5'); link(sc(6.8), 'p_c3');
  link(sp(-27.5), mc(-3.0)); link(mc(-2.7), sp(-27.5));
  node('p_disp', 9.9, -8.8); link('p_disp', 'p_c1');
  link('p_c5', 'p_lob_door'); // secure lobby door
  link(sp(-57.8), 'p_rc_door'); link(sp(-53.4), 'p_rc_door2'); link(sp(-54.9), 'p_rrm_door'); link(sp(-48.9), 'p_rrw_door'); link(sp(-45.6), 'p_sgt_door'); link(sp(-44.8), 'p_rw_door');
  link(sp(-41.0), 'p_ev_door'); link(sp(-30.8), 'p_rec_door');
  link(mc(-7.7), 'p_iv1'); link(mc(-2.7), 'p_obs_door'); link(mc(2.5), 'p_iv2'); link(mc(4.3), 'p_inv_door');
  link(sc(-8.75), 'p_gun_door'); link(sc(-1.9), 'p_br_door1'); link(sc(1.3), 'p_br_door2');
  node('p_jan', 3.45, -15.6); link(sc(3.45), 'p_jan');

  flushDeferred();
  // ======================================================================= STAIRS
  for (const s of STAIRS) buildStair(s);
  function buildStair(s) {
    mb = mbZone('pd1'); Y = 0; LV = 0;
    const [bx0, bz0, bx1, bz1] = s.box; const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
    const flight = (fl, y0, y1) => {
      const n = 11; const dir = Math.sign(fl.to - fl.at); const run = Math.abs(fl.to - fl.at) / n; const rise = (y1 - y0) / n; const w = fl.x1 - fl.x0; const xm = (fl.x0 + fl.x1) / 2;
      for (let i = 0; i < n; i++) {
        const z = fl.at + dir * run * (i + 0.5); const top = y0 + rise * (i + 1);
        mb('terrazzo').box(xm, top - rise / 2, z, w, rise, run, { uv: 1.2 });
        if (D >= 1) mb('rubber').box(xm, top + 0.004, fl.at + dir * run * (i + 1) - dir * 0.03, w, 0.01, 0.06, { uv: 0 });
      }
      const L2 = Math.hypot(fl.to - fl.at, y1 - y0); const ang = Math.atan2(y1 - y0, Math.abs(fl.to - fl.at)); const zm = (fl.at + fl.to) / 2, ym = (y0 + y1) / 2;
      mb('wall').rbox(xm, ym - 0.18, zm, w, 0.12, L2, { rotX: dir > 0 ? -ang : ang, r: 0.01, uv: 2 });
      for (const sx of [fl.x0, fl.x1]) { mb('frame').rbox(sx, ym + 0.95, zm, 0.04, 0.04, L2, { rotX: dir > 0 ? -ang : ang, r: 0.015, uv: 0 }); for (let i = 0; i <= 4; i++) { const t = i / 4; mb('frame').box(sx, y0 + (y1 - y0) * t + 0.48, fl.at + (fl.to - fl.at) * t, 0.025, 0.95, 0.025); } }
    };
    flight(s.flight1, 0, F2 / 2); flight(s.flight2, F2 / 2, F2);
    const [lx0, lz0, lx1, lz1] = s.landing; mb('terrazzo').box((lx0 + lx1) / 2, F2 / 2 - 0.1, (lz0 + lz1) / 2, lx1 - lx0, 0.2, lz1 - lz0, { uv: 1.2 }); mb('ceiling').box((lx0 + lx1) / 2, F2 / 2 - 0.21, (lz0 + lz1) / 2, lx1 - lx0, 0.02, lz1 - lz0, { faces: 'y', uv: 1.2 });
    const [cx0, cz0, cx1, cz1] = s.core; mb('wall').box((cx0 + cx1) / 2, F2 / 2 + 1.0, (cz0 + cz1) / 2, cx1 - cx0, F2 + 2.0, cz1 - cz0, { uv: 2 }); colRaw(cx0 - 0.02, cz0, cx1 + 0.02, cz1, 0, F2 + 3);
    { const fl = s.flight2; mb('wall').box((fl.x0 + fl.x1) / 2, F2 / 4, (fl.at + fl.to) / 2, fl.x1 - fl.x0, F2 / 2, Math.abs(fl.to - fl.at), { faces: 'xXzZ', uv: 2 }); colRaw(fl.x0, Math.min(fl.at, fl.to), fl.x1, Math.max(fl.at, fl.to), 0, F2 / 2 - 0.05); }
    const [gx0, gz0, gx1, gz1] = s.guard; mb('frame').box((gx0 + gx1) / 2, F2 + 1.0, (gz0 + gz1) / 2, gx1 - gx0, 0.05, 0.05); mb('glass').panel((gx0 + gx1) / 2, F2 + 0.55, (gz0 + gz1) / 2, gx1 - gx0, 0.9, 'z', 1);
    for (const gx of [gx0 + 0.05, gx1 - 0.05]) mb('frame').box(gx, F2 + 0.5, (gz0 + gz1) / 2, 0.04, 1.0, 0.04);
    colRaw(gx0, gz0 - 0.03, gx1, gz1 + 0.03, F2, F2 + 1.1);
    const [hx0, hz0, hx1, hz1] = s.hole; mb = mbZone('pd2'); mb('ceiling').box(cx, F2 + CH + 0.05, cz, bx1 - bx0, 0.1, bz1 - bz0, { faces: 'y', uv: 1.2 }); mb = mbZone('pd1');
    for (const [x0, z0, x1, z1] of [[bx0, bz0, bx1, bz0], [bx0, bz1, bx1, bz1], [bx0, bz0, bx0, bz1], [bx1, bz0, bx1, bz1]]) mb('wall').wall(x0, z0, x1, z1, CH, F2, 0.18, { uv: 2 });
    { const ez = Math.abs(hz0 - bz0) < 0.01 ? hz1 : hz0; mb('wall').box((hx0 + hx1) / 2, (CH + F2) / 2, ez, hx1 - hx0, F2 - CH, 0.06, { uv: 2 }); }
    lights.push({ pos: [cx, F2 / 2 + 1.6, cz], room: 'corridor', base: 1, range: 5.6, dim: 0.7 }); lights.push({ pos: [cx, F2 + CH - 0.4, cz], room: 'corridor', base: 1, range: 5.6, dim: 0.7 });
    mb('lightpanel').box(cx, F2 + CH - 0.003, cz, 1.0, 0.006, 0.5, { faces: 'y', uv: 0 });
    { const wz = Math.abs(s.landing[1] - s.box[1]) < 0.2 ? s.box[1] + 0.11 : s.box[3] - 0.11; mb('lightpanel').box((s.landing[0] + s.landing[2]) / 2, F2 / 2 + 2.2, wz, 0.6, 0.14, 0.06, { uv: 0 }); }
    const f1 = s.flight1, f2 = s.flight2; const sid = `p_st${s.id}`;
    const xm1 = (f1.x0 + f1.x1) / 2, xm2 = (f2.x0 + f2.x1) / 2;
    node(`${sid}_b0`, xm1, f1.at + Math.sign(f1.at - f1.to) * 0.5, { y: 0 }); node(`${sid}_b1`, xm1, f1.to - Math.sign(f1.at - f1.to) * 0.15, { y: F2 / 2 });
    node(`${sid}_land`, (lx0 + lx1) / 2, (lz0 + lz1) / 2, { y: F2 / 2 }); node(`${sid}_c0`, xm2, f2.at - Math.sign(f2.at - f2.to) * 0.15, { y: F2 / 2 }); node(`${sid}_c1`, xm2, f2.to + Math.sign(f2.to - f2.at) * 0.5, { y: F2 });
    link(`${sid}_b0`, `${sid}_b1`, `${sid}_land`, `${sid}_c0`, `${sid}_c1`);
  }
  // stair entries: A from corridor C (both floors), B from corridor M (both floors)
  node('p_stA_door', 8.0, -8.9, { y: 0 }); link('p_c1', 'p_stA_door', 'p_stA_b0');
  node('p_stB_door', -11.0, -25.2, { y: 0 }); link(mc(-11.0), 'p_stB_door', 'p_stB_b0');

  // ======================================================================= SECOND FLOOR
  level(1);
  room('Training room', -12, -60, -4.5, -50, 'plank'); room('Restroom 2F', -12, -50, -4.5, -46, 'tile', { light: 'break', nx: 2, nz: 1 });
  room('Major case room', -12, -46, -4.5, -38, 'officeCarpet'); room('Administrative services', -12, -38, -4.5, -29, 'officeCarpet');
  room('Executive assistant', -1.5, -60, 3.5, -52, 'officeCarpet', { light: 'director' }); room("Chief's office", 3.5, -60, 12, -52, 'wood', { light: 'director' });
  room('Command hall', -1.5, -52, 12, -49, 'carpetDark', { light: 'corridor', nx: 4, nz: 1 });
  room("Assistant Chief's office", -1.5, -49, 5, -41, 'officeCarpet', { light: 'director' }); room("Captain's office", 5, -49, 12, -41, 'officeCarpet', { light: 'director' });
  room('Admin offices', -1.5, -41, 3.5, -29, 'officeCarpet'); room('Conference room', 3.5, -41, 12, -29, 'wood', { light: 'director', nx: 2, nz: 3 });
  room('Detective bullpen', -8.6, -26, 2, -19.8, 'officeCarpet'); room('Detective sergeant', 2, -26, 8.6, -19.8, 'officeCarpet');
  room('Detective office 1', -12, -16.8, -7.5, -8, 'officeCarpet'); room('Detective office 2', -7.5, -16.8, -3, -8, 'officeCarpet'); room('Investigation room 1', -3, -16.8, 2.6, -8, 'officeCarpet'); room('Supply & copy', 2.6, -16.8, 5, -8, 'concrete', { uv: 2.5, nx: 1, nz: 2 });
  room('Corridor spine 2F', -4.5, -60, -1.5, -29, 'officeCarpet', { light: 'corridor', nx: 1, nz: 9 });
  room('Corridor M2', -12, -29, 12, -26, 'officeCarpet', { light: 'corridor', nx: 7, nz: 1 }); room('Corridor C2', 8.6, -26, 12, -8, 'terrazzo', { uv: 2.4, light: 'corridor', nx: 1, nz: 5 });
  room('Corridor S2', -12, -19.8, 8.6, -16.8, 'officeCarpet', { light: 'corridor', nx: 6, nz: 1 }); room('Corridor S2 alcove', 5, -16.8, 8.6, -15, 'officeCarpet', { lights: false });
  for (const s of STAIRS) { const [x0, z0, x1, z1] = s.box; for (const r of subtract([x0, z0, x1, z1], [s.hole])) floorAt(r[0], r[1], r[2], r[3], 'terrazzo', 2.4); }
  // exterior walls (windows all round)
  wall(-12, -60, 12, -60, extWall('N')); wall(12, -60, 12, -8, extWall('E')); wall(-12, -60, -12, -8, extWall('W')); wall(-12, -8, 12, -8, extWall('S'));
  // interior
  wall(-4.5, -60, -4.5, -29, [[-58.4, -57.2, 'door', { side: -1 }], [-52.0, -50.8, 'door', { side: -1 }], [-48.6, -47.6, 'door', { side: -1 }], [-45.0, -43.8, 'door', { side: -1, hinge: 1 }], [-37.0, -35.8, 'door', { side: -1, hinge: 1 }]]);
  wall(-1.5, -60, -1.5, -29, [[-52, -49, 'pass'], [-36.4, -35.2, 'door', { side: 1 }]]);
  wall(-12, -50, -4.5, -50); wall(-12, -46, -4.5, -46); wall(-12, -38, -4.5, -38);
  wall(-1.5, -52, 12, -52, [[1.4, 2.6, 'door', { side: -1 }]]); wall(3.5, -60, 3.5, -52, [[-55.2, -54.0, 'door', { side: 1, hinge: 1 }]]);
  wall(-1.5, -49, 12, -49, [[0.2, 1.4, 'door', { side: 1 }], [8.0, 9.2, 'door', { side: 1 }]]); wall(5, -49, 5, -41);
  wall(-1.5, -41, 12, -41); wall(3.5, -41, 3.5, -29);
  wall(-12, -29, -4.5, -29); wall(-1.5, -29, 12, -29, [[5.0, 6.2, 'door', { side: -1 }], [9.6, 10.8, 'door', { side: -1 }]]);
  wall(-12, -26, 8.6, -26, [[-11.6, -10.4, 'door', { side: 1, hinge: 1 }], [-7.8, -6.8, 'door', { side: 1, hinge: 1 }], [-0.4, 0.6, 'door', { side: 1 }], [3.0, 4.0, 'door', { side: 1, hinge: 1 }]]);
  wall(-8.6, -26, -8.6, -19.8); wall(2, -26, 2, -19.8); wall(8.6, -26, 8.6, -19.8);
  wall(-12, -19.8, 8.6, -19.8);
  wall(-12, -16.8, 5, -16.8, [[-9.6, -8.6, 'door', { side: 1 }], [-5.0, -4.0, 'door', { side: 1 }], [-0.6, 0.6, 'door', { side: 1 }], [3.0, 3.9, 'door', { side: 1, hinge: 1 }]]);
  wall(-7.5, -16.8, -7.5, -8); wall(-3, -16.8, -3, -8); wall(2.6, -16.8, 2.6, -8); wall(5, -16.8, 5, -8); wall(5, -15, 8.6, -15);
  wall(8.6, -15, 8.6, -8, [[-9.5, -8.3, 'door', { side: 1 }]]);

  // ------------------------------------------------ training room
  { const tS = face('z', -50, -1), tW = face('x', -12, 1), tN = face('z', -60, 1);
    const trSeats = []; const trRows = [-58.0, -56.0, -54.0];
    trRows.forEach((tz) => { table(F, -8.5, tz, 0, F2, { w: 4.5, d: 0.6, top: 'laminate', chairs: 0 }); for (let i = 0; i < 5; i++) { const x = -10.3 + i * 0.9, z = tz - 0.75; stackChair(F, x, z, Math.PI, F2); trSeats.push([x, z]); } });
    { const [bx, bz] = at(tS, -7.4, 0.015); mb('white').box(bx, F2 + 1.85, bz, 3.0, 1.7, 0.03, { uv: 0 }); mb('pdTraining').panel(bx, F2 + 1.85, bz - 0.0165, 2.8, 1.58, 'z', -1); mount(tS, -7.4, 1.85, 3.0, 1.7, 0.03, 'projection screen'); }
    mb('white').rbox(-7.4, F2 + 3.3, -54.6, 0.36, 0.12, 0.3, { r: 0.03, uv: 0 }); mb('chrome').cylinder(-7.4, F2 + 3.45, -54.6, 0.015, 0.28, 6); mb('chrome').box(-7.4, F2 + CH - 0.005, -54.6, 0.12, 0.01, 0.12);
    const dTr = desk(F, -10.6, -51.4, 0, F2, { w: 1.3, d: 0.65, monitors: 1, screenKey: 'scr_cw0', wood: 'laminate' });
    board(tW, -55.0, 1.6, 1.8, 1.1, 'whiteboard', 'training whiteboard'); pic(tS, -10.6, 2.3, 0.6, 0.42, 'certificate'); pic(tS, -5.2, 1.75, 0.6, 0.8, 'wellness');
    for (let i = 0; i < 3; i++) { const x = -11.45, z = -59.3 + i * 0.6; mb('matte').rbox(x, F2 + 0.09, z, 0.35, 0.18, 0.55, { r: 0.08, color: [0.85, 0.7, 0.55] }); mb('matte').sphere(x, F2 + 0.11, z - 0.36, 0.11, 10, 8, { color: [0.85, 0.7, 0.55] }); } // CPR mannequins
    colFurn(-11.65, -59.75, -11.25, -57.85, F2, F2 + 0.25);
    sign(face('x', -4.5, 1), -57.8, 2.55, 1.6, 'TRAINING ROOM');
    f_interact('pd_training', 'training', "Training room – look at today's course", [-8.9, F2 + 1.0, -50.4], [-5.9, F2 + 2.8, -50.1], 1);
    node('p2_tr_door', -5.25, -57.8); node('p2_tr_door2', -5.25, -51.4); node('p2_tr_front', -7.4, -51.5, { face: Math.PI }); node('p2_tr_e', -5.6, -55.0); sitNode('p2_tr_desk', dTr.chair);
    link('p2_tr_door', 'p2_tr_e', 'p2_tr_door2'); link('p2_tr_door2', 'p2_tr_front', 'p2_tr_desk');
    trRows.forEach((tz, r) => { const az = tz - 1.36; const ids = []; for (let i = 0; i < 5; i++) { const id = `p2_tr_a${r}_${i}`; node(id, -10.3 + i * 0.9, az); ids.push(id); } node(`p2_tr_a${r}_e`, -5.6, az); link(...ids, `p2_tr_a${r}_e`); link(`p2_tr_a${r}_e`, 'p2_tr_e');
      for (let i = 0; i < 5; i++) { const sid = `p2_tr_seat${r * 5 + i}`; node(sid, -10.3 + i * 0.9, tz - 0.75, { sit: Math.PI }); link(sid, ids[i]); } });
  }

  // ------------------------------------------------ restroom (2nd floor)
  { const rW = face('x', -12, 1), rS = face('z', -46, -1), rN = face('z', -50, 1);
    wainscot(rW, -49.92, -46.08, { h: 1.5, mat: 'ceramic', rail: null }); wainscot(rN, -11.92, -4.58, { h: 1.5, mat: 'ceramic', rail: null }); wainscot(rS, -11.92, -4.58, { h: 1.5, mat: 'ceramic', rail: null });
    let zs = -49.88; for (const [i, w] of [[0, 0.95], [1, 1.25]]) { doors.push(stallX(F, -11.92, zs, 1.5, w, F2, { id: `pd2_stall_${i}`, accessible: i === 1, shared: i > 0 })); zs += w; }
    vanity(F, -8.0, -46.08, -1, F2, 2, 'z'); mount(rS, -8.0, 1.55, 1.74, 0.94, 0.02, 'vanity mirror');
    if (D >= 1) { const [hx, hz] = at(rS, -6.2, 0.06); mb('satin').rbox(hx, F2 + 1.35, hz, 0.26, 0.3, 0.12, { r: 0.03, color: [0.82, 0.82, 0.82] }); mount(rS, -6.2, 1.35, 0.26, 0.3, 0.12, 'hand dryer'); }
    trashCan(F, -5.3, -46.5, F2);
    sign(face('x', -4.5, 1), -48.1, 2.55, 1.3, 'RESTROOMS');
    node('p2_ws_door', -5.25, -48.1); node('p2_ws_in', -8.0, -47.2, { face: 0 + Math.PI }); link('p2_ws_door', 'p2_ws_in');
    f_interact('pd_restroom_2', 'restroom', 'Wash up at the sink', [-8.9, F2 + 0.8, -46.7], [-7.1, F2 + 1.3, -46.08], 0);
  }

  // ------------------------------------------------ major case room (investigation room 2)
  { const mcN = face('z', -46, 1), mcS = face('z', -38, -1), mcE = face('x', -4.5, -1);
    const mcSeats = table(F, -8.6, -42.2, Math.PI / 2, F2, { w: 2.8, d: 1.2, top: 'laminate', chairs: 6, chairType: 'office' });
    board(mcN, -8.25, 1.6, 4.0, 1.2, 'cork', 'major case wall'); board(mcS, -8.6, 1.65, 3.0, 1.1, 'whiteboard', 'major case whiteboard');
    for (let i = 0; i < 9; i++) { const [px, pz] = at(mcN, -10.0 + i * 0.4, 0.04); mb(['paper', 'print1', 'print2'][i % 3]).box(px, F2 + 1.3 + (i % 3) * 0.3, pz, 0.28, 0.22, 0.008, { uv: 0 }); }
    tvOn(mcE, -40.3, 1.8, 1.5, 0.86); fileCabinet(F, -11.67, -38.9, -Math.PI / 2, F2, { drawers: 4 });
    sign(face('x', -4.5, 1), -44.4, 2.55, 2.6, 'INVESTIGATION ROOM 2 · MAJOR CASE');
    f_interact('pd_invest3', 'investigation', 'Major case room – look at the case wall', [-10.3, F2 + 0.9, -45.9], [-6.2, F2 + 2.3, -45.55], 1);
    node('p2_mc_door', -5.25, -44.4); node('p2_mc_mid', -6.4, -42.2); node('p2_mc_wall', -8.25, -44.9, { face: 0 }); node('p2_mc_n', -8.6, -44.4); node('p2_mc_ne', -6.4, -44.4); node('p2_mc_se', -6.4, -39.6); node('p2_mc_s', -8.6, -39.6); node('p2_mc_w', -10.7, -42.2);
    link('p2_mc_door', 'p2_mc_ne', 'p2_mc_n', 'p2_mc_wall'); link('p2_mc_ne', 'p2_mc_mid', 'p2_mc_se', 'p2_mc_s', 'p2_mc_w', 'p2_mc_n');
    mcSeats.forEach((pose, i) => { sitNode(`p2_mc_s${i}`, pose); link(`p2_mc_s${i}`, pose[0] < -8.6 ? 'p2_mc_w' : 'p2_mc_mid'); });
  }

  // ------------------------------------------------ administrative services / payroll
  { const hN = face('z', -38, 1), hS = face('z', -29, -1);
    const dHR = [-10.0, -7.4].map((x) => desk(F, x, -37.57, 0, F2, { w: 1.4, d: 0.7, wood: 'laminate', monitors: 2, screenKey: 'scr_cw0' }));
    for (const x of [-11.3, -10.35]) fileCabinet(F, x, -29.33, 0, F2, { drawers: 4 });
    table(F, -8.6, -32.8, 0, F2, { w: 0.9, round: true, top: 'laminate', chairs: 2, chairType: 'guest' }); copier(F, -5.9, -29.4, 0, F2); plantPot(F, -5.2, -33.0, F2, 0.9);
    pic(hN, -8.7, 2.3, 0.6, 0.42, 'certificate'); pic(hS, -8.1, 1.75, 0.7, 0.9, 'wellness');
    sign(face('x', -4.5, 1), -36.4, 2.55, 2.8, 'ADMINISTRATIVE SERVICES · PAYROLL');
    node('p2_hr_door', -5.25, -36.4); node('p2_hr_mid', -7.0, -35.3); sitNode('p2_hr_d0', dHR[0].chair); sitNode('p2_hr_d1', dHR[1].chair);
    link('p2_hr_door', 'p2_hr_mid', 'p2_hr_d0'); link('p2_hr_mid', 'p2_hr_d1');
  }

  // ------------------------------------------------ chief's suite: executive assistant + chief
  { const eN = face('z', -60, 1), eW = face('x', -1.5, 1), eS = face('z', -52, -1);
    const dEA = desk(F, 0.4, -55.2, Math.PI, F2, { w: 1.6, d: 0.75, monitors: 2, screenKey: 'scr_cw1' });
    credenza(F, 0.4, -59.68, Math.PI, F2, { w: 1.8 }); beamSeating(F, -1.07, -53.5, -Math.PI / 2, F2, 2); fileCabinet(F, 3.17, -59.3, Math.PI / 2, F2, { drawers: 4 });
    pic(eW, -56.8, 1.75, 0.8, 0.56, 'courthouse'); plantPot(F, 3.0, -52.6, F2, 0.9);
    f_interact('pd_ea_desk', 'pd_desk', "Look at the executive assistant's desk", [-0.4, F2, -55.6], [1.2, F2 + 1.3, -54.8], 0, { who: 'Executive Assistant' });
    // chief
    const cN = face('z', -60, 1), cS = face('z', -52, -1), cE = face('x', 12, -1), cW = face('x', 3.5, 1);
    const dChief = desk(F, 8.4, -57.6, Math.PI, F2, { w: 2.0, d: 0.95, wood: 'woodDark', monitors: 1, screenKey: 'scr_cw2', exec: true, guest: 2, lamp: true });
    credenza(F, 8.4, -59.68, Math.PI, F2, { w: 2.0 }); flagStand(F, 4.3, -59.4, F2, 'flagUS'); flagStand(F, 11.45, -55.2, F2, 'flagIL', -Math.PI / 2);
    { const [sx, sz] = at(cN, 8.3, 0.01); mb('seal').panel(sx, F2 + 2.25, sz, 0.66, 0.66, 'z', 1); mount(cN, 8.3, 2.25, 0.66, 0.66, 0.01, 'seal'); }
    bookcase(F, 3.76, -58.4, -Math.PI / 2, F2, { w: 1.6, h: 2.1, wood: 'woodDark' }); sofa(F, 9.0, -52.5, 0, F2, { w: 2.0, seats: 2, color: 'fabricBlue' });
    table(F, 9.0, -53.85, 0, F2, { w: 1.0, d: 0.5, h: 0.42, top: 'woodDark' });
    for (const [x, c] of [[7.7, 'portrait4'], [9.0, 'coins'], [10.3, 'ribbons']]) pic(cS, x, 1.75, 0.6, 0.6, c, { frameMat: 'woodDark' });
 pic(cE, -52.85, 1.8, 0.5, 0.6, 'accreditation');
    sign(face('z', -52, 1), 2.0, 2.55, 2.4, 'OFFICE OF THE CHIEF OF POLICE', { style: 'brass', h: 0.24 });
    f_interact('pd_chief_desk', 'pd_desk', "Look at the Chief's desk", [7.4, F2, -58.1], [9.4, F2 + 1.3, -57.1], 0, { who: 'Chief of Police' });
    node('p2_ea_door', 2.0, -52.8); sitNode('p2_ea_desk', dEA.chair); node('p2_ea_front', 1.6, -54.0); node('p2_ea_n', 2.0, -56.2); node('p2_chief_door', 2.75, -54.6); node('p2_chief_door2', 4.3, -54.6);
    link('p2_ea_door', 'p2_ea_front', 'p2_chief_door', 'p2_chief_door2'); link('p2_ea_front', 'p2_ea_n', 'p2_ea_desk');
    node('p2_ea_wait', -0.1, -53.5); link('p2_ea_front', 'p2_ea_wait'); sitNode('p2_ea_w0', [-1.07 + 0.0, -53.81, -Math.PI / 2]); sitNode('p2_ea_w1', [-1.07, -53.19, -Math.PI / 2]); link('p2_ea_wait', 'p2_ea_w0'); link('p2_ea_wait', 'p2_ea_w1');
    sitNode('p2_chief_desk', dChief.chair); node('p2_chief_mid', 6.4, -55.6); node('p2_chief_gs', 8.4, -55.4); sitNode('p2_chief_g0', dChief.guests[0]); sitNode('p2_chief_g1', dChief.guests[1]); node('p2_chief_behind', 10.6, -58.4); node('p2_chief_e', 10.6, -55.8);
    node('p2_chief_sofa', 9.0, -52.55, { sit: 0 }); node('p2_chief_lounge', 7.6, -53.6);
    link('p2_chief_door2', 'p2_chief_mid', 'p2_chief_e', 'p2_chief_behind', 'p2_chief_desk'); link('p2_chief_mid', 'p2_chief_gs'); link('p2_chief_gs', 'p2_chief_g0'); link('p2_chief_gs', 'p2_chief_g1'); link('p2_chief_mid', 'p2_chief_lounge', 'p2_chief_sofa');
  }

  // ------------------------------------------------ command hall: assistant chief + captain open off it
  { const hN = face('z', -52, 1), hS = face('z', -49, -1);
    wainscot(hN, -1.42, 11.92, { h: 1.25, mat: 'woodDark' }); wainscot(hS, -1.42, 11.92, { h: 1.25, mat: 'woodDark' });
    // former chiefs' portraits along the chief's wall
    sign(hN, 7.6, 2.62, 3.4, 'CHIEFS OF POLICE · 1903 – PRESENT', { h: 0.2, style: 'brass' });
    [[4.6, 'portrait1'], [6.1, 'portrait2'], [7.6, 'portrait3'], [9.1, 'portrait4'], [10.6, 'portrait1']].forEach(([x, c]) => pic(hN, x, 1.85, 0.6, 0.78, c, { frameMat: 'gold', border: 0.045 }));
    pic(hS, 3.3, 1.85, 0.8, 0.8, 'mission', { frameMat: 'woodDark' }); pic(hS, 4.9, 1.85, 0.7, 0.7, 'accreditation'); pic(hS, 6.4, 1.85, 0.7, 0.7, 'flagCase', { frameMat: 'woodDark' });
    sign(hS, 0.8, 2.55, 1.9, 'ASSISTANT CHIEF'); sign(hS, 8.6, 2.55, 1.6, 'CAPTAIN');
    hangSign(-0.9, -50.5, 'x', 2.6, 'COMMAND STAFF · CHIEF · CAPTAIN', { style: 'big' });
    flagStand(F, 11.5, -51.5, F2, 'flagUS', -Math.PI / 2); flagStand(F, 11.5, -49.5, F2, 'flagIL', -Math.PI / 2);
  }
  // assistant chief
  { const aW = face('x', -1.5, 1), aE = face('x', 5, -1), aS = face('z', -41, -1);
    const dAC = desk(F, 2.0, -43.2, 0, F2, { w: 1.7, d: 0.85, wood: 'woodDark', monitors: 1, screenKey: 'scr_cw0', exec: true, guest: 2, lamp: true });
    credenza(F, 2.0, -41.32, 0, F2, { w: 1.8 }); bookcase(F, -1.24, -45.4, -Math.PI / 2, F2, { w: 1.2, wood: 'woodDark' }); plantPot(F, 4.45, -48.4, F2, 0.9);
    pic(aE, -45.0, 1.75, 1.0, 0.68, 'countyMap'); pic(aS, 0.0, 1.85, 0.6, 0.6, 'awardPlaque', { frameMat: 'woodDark' }); pic(aW, -42.6, 1.8, 0.6, 0.6, 'portrait2');
    f_interact('pd_ac_desk', 'pd_desk', "Look at the Assistant Chief's desk", [1.15, F2, -43.65], [2.85, F2 + 1.3, -42.75], 0, { who: 'Assistant Chief' });
    node('p2_ac_door', 0.8, -48.2); node('p2_ac_mid', 0.2, -45.4); sitNode('p2_ac_desk', dAC.chair); sitNode('p2_ac_g', dAC.guests[0]); sitNode('p2_ac_g2', dAC.guests[1]); node('p2_ac_behind', 3.9, -42.4); node('p2_ac_e', 3.9, -45.4);
    link('p2_ac_door', 'p2_ac_mid', 'p2_ac_e', 'p2_ac_behind', 'p2_ac_desk'); link('p2_ac_mid', 'p2_ac_g'); link('p2_ac_mid', 'p2_ac_g2');
  }
  // captain
  { const kW = face('x', 5, 1), kS = face('z', -41, -1), kE = face('x', 12, -1);
    const dCap = desk(F, 8.2, -43.4, 0, F2, { w: 1.7, d: 0.85, wood: 'woodDark', monitors: 2, screenKey: 'scr_cw1', exec: true, guest: 2, lamp: true });
    credenza(F, 8.2, -41.32, 0, F2, { w: 1.8 }); bookcase(F, 5.26, -45.5, -Math.PI / 2, F2, { w: 1.2, wood: 'woodDark' }); flagStand(F, 11.45, -41.6, F2, 'flagUS', -Math.PI / 2);
    table(F, 10.6, -47.1, 0, F2, { w: 0.9, round: true, top: 'woodDark', chairs: 2, chairType: 'guest' });
    pic(kW, -43.0, 1.8, 0.8, 0.56, 'groupPhoto'); pic(kS, 6.4, 1.85, 0.6, 0.6, 'awardPlaque', { frameMat: 'woodDark' }); pic(kS, 10.2, 1.85, 0.7, 0.5, 'certificate');
    f_interact('pd_captain_desk', 'pd_desk', "Look at the Captain's desk", [7.35, F2, -43.85], [9.05, F2 + 1.3, -42.95], 0, { who: 'Captain' });
    node('p2_cap_door', 8.6, -48.2); node('p2_cap_mid', 7.6, -45.6); sitNode('p2_cap_desk', dCap.chair); sitNode('p2_cap_g', dCap.guests[0]); sitNode('p2_cap_g2', dCap.guests[1]); node('p2_cap_behind', 10.4, -42.4); node('p2_cap_e', 10.4, -45.4);
    link('p2_cap_door', 'p2_cap_mid', 'p2_cap_e', 'p2_cap_behind', 'p2_cap_desk'); link('p2_cap_mid', 'p2_cap_g'); link('p2_cap_mid', 'p2_cap_g2');
  }

  // ------------------------------------------------ admin offices
  { const dW = face('x', -1.5, 1), dN = face('z', -41, 1);
    const dAdm = [-39.4, -36.4, -33.4].map((z) => desk(F, 3.07, z, -Math.PI / 2, F2, { w: 1.4, d: 0.7, wood: 'laminate', monitors: 2, screenKey: 'scr_cw2' }));
    copier(F, -1.1, -30.0, -Math.PI / 2, F2); fileCabinet(F, -1.17, -40.3, -Math.PI / 2, F2, { drawers: 4 }); plantPot(F, 3.0, -29.6, F2, 0.8);
    pic(dW, -33.0, 1.75, 0.8, 0.56, 'stationPhoto'); board(dN, 0.9, 1.65, 1.8, 0.9, 'cork', 'admin board');
    sign(face('x', -1.5, -1), -35.8, 2.55, 1.6, 'ADMINISTRATION');
    node('p2_adm_door', -0.75, -35.8); node('p2_adm_mid', 1.2, -35.8); dAdm.forEach((d, i) => { sitNode(`p2_adm_d${i}`, d.chair); link('p2_adm_mid', `p2_adm_d${i}`); });
    node('p2_adm_copier', -0.35, -30.0, { face: Math.PI / 2 }); node('p2_adm_s', 1.2, -31.2);
    link('p2_adm_door', 'p2_adm_mid', 'p2_adm_s', 'p2_adm_copier');
  }

  // ------------------------------------------------ command conference room
  { const qN = face('z', -41, 1), qW = face('x', 3.5, 1), qE = face('x', 12, -1);
    const confSeats = table(F, 7.8, -35.4, Math.PI / 2, F2, { w: 5.0, d: 1.4, top: 'woodDark', chairs: 10, chairType: 'office' });
    tvOn(qN, 7.8, 1.8, 2.3, 1.28); credenza(F, 3.82, -35.4, -Math.PI / 2, F2, { w: 2.4 }); plantPot(F, 11.45, -40.45, F2, 1.0); plantPot(F, 4.1, -40.45, F2, 1.0); plantPot(F, 11.45, -29.6, F2, 0.9);
    pic(qW, -37.6, 1.8, 0.9, 0.62, 'courthouse'); pic(qW, -33.2, 1.8, 0.9, 0.62, 'fields'); pic(qE, -34.5, 1.85, 0.5, 0.66, 'mission', { frameMat: 'woodDark' });
    sign(face('z', -29, 1), 7.9, 2.55, 2.6, 'COMMAND CONFERENCE ROOM');
    node('p2_conf_door', 10.2, -29.8); node('p2_conf_door2', 5.6, -29.8); node('p2_conf_mid', 10.0, -31.6); node('p2_conf_w', 5.6, -31.6); node('p2_conf_e', 10.0, -39.6); node('p2_conf_wn', 5.6, -39.6);
    link('p2_conf_door', 'p2_conf_mid', 'p2_conf_e', 'p2_conf_wn', 'p2_conf_w', 'p2_conf_door2'); link('p2_conf_mid', 'p2_conf_w');
    const wa = [], ea = []; confSeats.forEach((pose, i) => { sitNode(`p2_conf_s${i}`, pose); const west = pose[0] < 7.8; const aid = `p2_conf_${west ? 'wa' : 'ea'}${i}`; node(aid, west ? 5.7 : 9.9, pose[1]); link(`p2_conf_s${i}`, aid); (west ? wa : ea).push([pose[1], aid]); });
    link('p2_conf_w', ...wa.sort((p, q) => q[0] - p[0]).map((x) => x[1]), 'p2_conf_wn'); link('p2_conf_mid', ...ea.sort((p, q) => q[0] - p[0]).map((x) => x[1]), 'p2_conf_e');
  }

  // ------------------------------------------------ detective bullpen, detective sergeant
  { const bE = face('x', 2, -1), bW = face('x', -8.6, 1), bS = face('z', -19.8, -1);
    const cid = cubicles(F, -3.4, -22.9, 0, F2, { n: 3, screenKey: 'scr_cw0' });
    board(bE, -22.9, 1.6, 2.6, 1.1, 'cork', 'CID case board'); copier(F, -8.2, -20.6, -Math.PI / 2, F2); fileCabinet(F, -8.27, -24.6, -Math.PI / 2, F2, { drawers: 4 }); fileCabinet(F, -8.27, -23.6, -Math.PI / 2, F2, { drawers: 4 });
    pic(bS, -6.6, 1.8, 0.8, 0.56, 'bolo'); pic(bS, -0.4, 1.8, 0.8, 0.56, 'newspaper'); clock(bS, -3.4);
    sign(face('z', -26, -1), -4.0, 2.55, 3.4, 'CRIMINAL INVESTIGATIONS · DETECTIVES');
    node('p2_cid_door', -7.3, -25.2); node('p2_cid_door2', 0.1, -25.2); node('p2_cid_w', -7.3, -22.9); node('p2_cid_e', 0.3, -22.9); node('p2_cid_n', -3.4, -24.9); node('p2_cid_s', -3.4, -20.75);
    node('p2_cid_nw', -6.6, -24.9); node('p2_cid_ne', -0.2, -24.9); node('p2_cid_sw', -6.6, -20.75); node('p2_cid_se', -0.2, -20.75);
    link('p2_cid_door', 'p2_cid_nw', 'p2_cid_n', 'p2_cid_ne', 'p2_cid_door2'); link('p2_cid_ne', 'p2_cid_e', 'p2_cid_se', 'p2_cid_s', 'p2_cid_sw', 'p2_cid_w', 'p2_cid_nw');
    cid.forEach((pose, i) => { sitNode(`p2_cid_d${i}`, pose); link(`p2_cid_d${i}`, pose[1] < -22.9 ? 'p2_cid_n' : 'p2_cid_s'); });
    node('p2_cid_board', 1.3, -22.9, { face: -Math.PI / 2 }); link('p2_cid_e', 'p2_cid_board');
    // detective sergeant
    const gW = face('x', 2, 1), gE = face('x', 8.6, -1);
    const dDS = desk(F, 5.6, -21.4, 0, F2, { w: 1.5, d: 0.75, monitors: 2, screenKey: 'scr_cw2', guest: 1, lamp: true });
    fileCabinet(F, 8.27, -24.4, Math.PI / 2, F2, { drawers: 3 }); bookcase(F, 2.26, -21.2, -Math.PI / 2, F2, { w: 1.2, h: 1.8 });
    board(gW, -24.2, 1.65, 1.6, 0.9, 'whiteboard', 'detective sergeant whiteboard'); pic(gE, -21.6, 1.8, 0.8, 0.56, 'certificate');
    sign(face('z', -26, -1), 4.6, 2.55, 2.2, 'DETECTIVE SERGEANT');
    node('p2_ds_door', 3.5, -25.2); sitNode('p2_ds_desk', dDS.chair); node('p2_ds_visit', 4.0, -23.2, { face: faceTo(4.0, -23.2, 5.6, -21.4) }); sitNode('p2_ds_guest', dDS.guests[0]); node('p2_ds_e', 7.6, -22.4); node('p2_ds_b', 7.2, -20.5);
    link('p2_ds_door', 'p2_ds_visit', 'p2_ds_e', 'p2_ds_b', 'p2_ds_desk'); link('p2_ds_visit', 'p2_ds_guest');
  }

  // ------------------------------------------------ detective offices, investigation room 1, supply
  { for (const [x0, x1, n] of [[-12, -7.5, 1], [-7.5, -3, 2]]) {
      const cx = (x0 + x1) / 2; const fW = face('x', x0, 1, x0 === -12 ? 0.16 : 0.16), fE = face('x', x1, -1);
      const d = desk(F, cx, -12.6, 0, F2, { w: 1.4, d: 0.7, monitors: 2, screenKey: n === 1 ? 'scr_cw1' : 'scr_cw2', lamp: true }); guestChair(F, cx - 0.35, -13.85, Math.PI, F2); guestChair(F, cx + 0.35, -13.85, Math.PI, F2);
      fileCabinet(F, x1 - 0.33, -9.6, Math.PI / 2, F2, { drawers: 3 }); bookcase(F, x0 + 0.26, -15.2, -Math.PI / 2, F2, { w: 1.0, h: 1.8 });
      pic(n === 1 ? fE : fW, -12.6, 1.8, 0.8, 0.56, n === 1 ? 'certificate' : 'k9'); plantPot(F, x1 - 0.5, -16.2, F2, 0.8);
      sign(face('z', -16.8, -1), n === 1 ? -9.1 : -4.5, 2.55, 1.3, `DETECTIVE ${n}`);
      const pfx = `p2_det${n}`; node(`${pfx}_door`, n === 1 ? -9.1 : -4.5, -16.0); sitNode(`${pfx}_desk`, d.chair); node(`${pfx}_mid`, cx - 1.4, -13.0); node(`${pfx}_b`, cx - 1.4, -11.4);
      link(`${pfx}_door`, `${pfx}_mid`, `${pfx}_b`, `${pfx}_desk`);
    }
    // investigation room 1
    const iW = face('x', -3, 1), iE = face('x', 2.6, -1);
    table(F, -0.2, -12.4, Math.PI / 2, F2, { w: 2.2, d: 1.0, top: 'laminate', chairs: 3, chairType: 'office' });
    board(iW, -12.4, 1.6, 2.6, 1.1, 'cork', 'investigation room 1 board'); board(iE, -12.4, 1.65, 2.0, 1.0, 'whiteboard', 'investigation room 1 whiteboard');
    for (let i = 0; i < 6; i++) { const [px, pz] = at(iW, -13.4 + i * 0.38, 0.04); mb(['paper', 'print1', 'print2'][i % 3]).box(px, F2 + 1.45 + (i % 2) * 0.32, pz, 0.008, 0.22, 0.28, { uv: 0 }); }
    sign(face('z', -16.8, -1), 0.0, 2.55, 2.2, 'INVESTIGATION ROOM 1');
    f_interact('pd_invest2', 'investigation', 'Investigation room – review the case board', [-2.9, F2 + 0.9, -13.7], [-2.55, F2 + 2.3, -11.1], 1);
    node('p2_ir1_door', 0.0, -16.0); node('p2_ir1_mid', 1.6, -14.3); node('p2_ir1_board', -2.3, -12.4, { face: Math.PI / 2 }); node('p2_ir1_s', 1.6, -10.0);
    link('p2_ir1_door', 'p2_ir1_mid', 'p2_ir1_s'); link('p2_ir1_door', 'p2_ir1_board');
    // supply & copy
    for (const z of [-15.6, -13.6]) shelving(F, 4.67, z, Math.PI / 2, F2, { w: 1.8, d: 0.5, h: 2.0 }); copier(F, 4.6, -9.6, Math.PI / 2, F2);
    sign(face('z', -16.8, -1), 3.45, 2.55, 0.9, 'SUPPLY', { h: 0.22 });
  }

  // ------------------------------------------------ corridors (2nd floor)
  { // SPINE 2F – "administration": carpet, cherry wainscot, community & accreditation
    const sW = face('x', -4.5, 1), sE = face('x', -1.5, -1), sN = face('z', -60, 1);
    wainscot(sW, -59.92, -29.08, { h: 0.95, mat: 'woodDark' }); wainscot(sE, -59.92, -29.08, { h: 0.95, mat: 'woodDark' });
    pic(sW, -54.4, 1.75, 1.0, 0.68, 'community'); pic(sW, -40.8, 1.75, 0.9, 0.62, 'courthouse'); pic(sW, -32.4, 1.75, 0.7, 0.5, 'certificate');
    pic(sE, -58.2, 1.75, 0.9, 0.62, 'fields'); pic(sE, -55.0, 1.75, 0.7, 0.7, 'accreditation'); pic(sE, -46.5, 1.8, 0.9, 0.9, 'mission', { frameMat: 'woodDark' });
    pic(sE, -43.4, 1.75, 0.9, 0.62, 'groupPhoto'); pic(sE, -39.0, 1.75, 0.66, 0.66, 'coins', { frameMat: 'woodDark' }); pic(sE, -31.6, 1.75, 0.9, 0.62, 'stationPhoto');
    extinguisher(sW, -49.4); aed(sE, -33.9);
    sign(sE, -50.5, 2.66, 2.6, 'COMMAND STAFF →', { h: 0.2, style: 'brass' });
    hangSign(-3.0, -31.0, 'z', 2.6, '↑ CHIEF · CAPTAIN · ASST CHIEF · TRAINING');
    hangSign(-3.0, -47.0, 'z', 2.6, '→ CHIEF · CAPTAIN · ASSISTANT CHIEF');
    // M2 – detectives' side and conference: carpet, a slim navy band
    const mN = face('z', -29, 1), mS = face('z', -26, -1);
    stripe(mN, -11.92, 11.92, 1.0, 0.1, [0.12, 0.2, 0.36]); stripe(mS, -11.92, 8.6, 1.0, 0.1, [0.12, 0.2, 0.36]);
    pic(mN, -10.0, 1.75, 0.9, 0.62, 'dispatchPhoto'); pic(mN, -7.6, 1.75, 0.9, 0.62, 'motorUnit'); pic(mN, 0.8, 1.75, 0.8, 0.56, 'countyMap'); pic(mN, 8.0, 1.75, 0.66, 0.66, 'badgeCase', { frameMat: 'woodDark' });
 pic(mS, -2.2, 1.75, 0.8, 0.56, 'certificate'); pic(mS, 6.6, 1.75, 0.8, 0.56, 'patrolCar'); extinguisher(mS, 8.1);
    sign(mS, -11.0, 2.55, 1.6, 'STAIR B · FLOORS 1–2');
    hangSign(-6.0, -27.5, 'x', 2.6, 'DETECTIVES · STAIR B ←   → CONFERENCE · STAIR A');
    // C2 – stair landing & directory, bench, plant
    const cW = face('x', 8.6, 1), cE = face('x', 12, -1);
    stripe(cW, -25.92, -8.1, 1.0, 0.1, [0.12, 0.2, 0.36]); stripe(cE, -25.92, -8.1, 1.0, 0.1, [0.12, 0.2, 0.36]);
    directory(cE, -9.45, 1.62, 1); bench(F, 11.6, -21.3, Math.PI / 2, F2, 1.6, { seats: 2 }); plantPot(F, 11.45, -16.0, F2, 0.9); waterCooler(F, 11.65, -26.4 + 0.0, F2);
    pic(cW, -23.0, 1.75, 0.9, 0.62, 'oldStation', { frameMat: 'woodDark' }); pic(cE, -15.3, 1.75, 0.9, 0.62, 'courthouse'); sign(cW, -8.9, 2.55, 1.6, 'STAIR A · FLOORS 1–2');
    clock(cW, -12.8);
    // S2 – detectives' corridor
    const ssN = face('z', -19.8, 1), ssS = face('z', -16.8, -1), alcN = face('z', -15, -1);
    wainscot(ssN, -11.92, 8.6, { h: 0.95, mat: null }); wainscot(ssS, -11.92, 5.0, { h: 0.95, mat: null });
    pic(ssN, -10.2, 1.75, 0.8, 0.56, 'certificate'); pic(ssN, -6.8, 1.75, 0.9, 0.62, 'oldOfficers', { frameMat: 'woodDark' }); pic(ssN, -2.4, 1.75, 0.9, 0.62, 'newspaper'); pic(ssN, 2.6, 1.75, 0.8, 0.56, 'accreditation'); pic(ssN, 6.6, 1.75, 0.66, 0.66, 'ribbons', { frameMat: 'woodDark' });
 pic(ssS, -6.4, 1.75, 0.7, 0.5, 'certificate'); pic(ssS, -2.0, 1.75, 0.6, 0.8, 'wellness'); extinguisher(ssS, 1.6);
    pic(alcN, 6.8, 1.8, 1.2, 0.8, 'groupPhoto', { frameMat: 'woodDark' }); bench(F, 6.8, -15.38, 0, F2, 1.8, { seats: 3 });
  }
  // 2nd-floor corridor nav
  const sp2 = corridor('p2_sp', -3.0, 'z', [-59.0, -57.8, -51.4, -50.5, -48.1, -44.4, -36.4, -35.8, -27.5]);
  const mc2 = corridor('p2_m', -27.5, 'x', [-11.0, -7.3, -3.0, 0.1, 3.5, 5.6, 10.2, 10.3]);
  const sc2 = corridor('p2_s', -18.3, 'x', [-11.0, -9.1, -4.5, 0.0, 3.45, 6.8]);
  node('p2_c1', 10.3, -10.0); node('p2_c2', 10.3, -13.4); node('p2_c3', 10.3, -18.3); node('p2_c4', 10.3, -22.0); node('p2_c5', 10.3, -27.5);
  link('p2_c1', 'p2_c2', 'p2_c3', 'p2_c4', 'p2_c5'); link(mc2(10.3), 'p2_c5'); link(sc2(6.8), 'p2_c3');
  link(sp2(-27.5), mc2(-3.0));
  node('p2_hall_w', -0.6, -50.5); node('p2_hall_ac', 0.8, -50.5); node('p2_hall_ea', 2.0, -50.5); node('p2_hall_cap', 8.6, -50.5); node('p2_hall_e', 11.0, -50.5);
  link(sp2(-50.5), 'p2_hall_w', 'p2_hall_ac', 'p2_hall_ea', 'p2_hall_cap', 'p2_hall_e'); link('p2_hall_ac', 'p2_ac_door'); link('p2_hall_ea', 'p2_ea_door'); link('p2_hall_cap', 'p2_cap_door');
  link(sp2(-57.8), 'p2_tr_door'); link(sp2(-51.4), 'p2_tr_door2'); link(sp2(-48.1), 'p2_ws_door'); link(sp2(-44.4), 'p2_mc_door'); link(sp2(-36.4), 'p2_hr_door'); link(sp2(-35.8), 'p2_adm_door');
  link(mc2(-7.3), 'p2_cid_door'); link(mc2(0.1), 'p2_cid_door2'); link(mc2(3.5), 'p2_ds_door'); link(mc2(5.6), 'p2_conf_door2'); link(mc2(10.2), 'p2_conf_door');
  link(sc2(-9.1), 'p2_det1_door'); link(sc2(-4.5), 'p2_det2_door'); link(sc2(0.0), 'p2_ir1_door'); node('p2_sup', 3.45, -15.6); link(sc2(3.45), 'p2_sup');
  node('p_stA_door2', 8.0, -8.9, { y: F2 }); link('p2_c1', 'p_stA_door2', 'p_stA_c1');
  node('p_stB_door2', -11.0, -25.2, { y: F2 }); link(mc2(-11.0), 'p_stB_door2', 'p_stB_c1');

  flushDeferred();
  level(0);
  // where the PD meets the dispatch floor
  nav.dispatchLink = ['p_disp', 'front_11'];

  // ---------------------------------------------------------------- sign atlas
  // Each sign gets a cell whose pixel aspect matches its real size, packed into one texture.
  { const PPM = 190; const AW = 2048; let x = 0, y = 0, rowH = 0;
    const items = SIGNS.map((s) => { const k2 = s.style === 'dir' ? 1.45 : 1; return { s, pw: Math.min(AW, Math.max(32, Math.round(s.w * PPM * k2))), ph: Math.max(28, Math.round(s.h * PPM * k2)) }; });
    const order = items.map((_, i) => i).sort((a, b) => items[b].ph - items[a].ph);
    const keyOf = (s) => `${s.text}|${s.style}|${s.w.toFixed(2)}|${s.h.toFixed(2)}`; const placed = new Map();
    for (const i of order) { const it = items[i]; const kk = keyOf(it.s); if (placed.has(kk)) { Object.assign(it, placed.get(kk)); continue; }
      if (x + it.pw > AW) { x = 0; y += rowH + 2; rowH = 0; } it.px = x; it.py = y; x += it.pw + 2; rowH = Math.max(rowH, it.ph); placed.set(kk, { px: it.px, py: it.py }); }
    const AH = 2 ** Math.ceil(Math.log2(Math.max(64, y + rowH + 2)));
    const uniq = new Map(); for (const it of items) { const kk = keyOf(it.s); if (!uniq.has(kk)) uniq.set(kk, { text: it.s.text, style: it.s.style, x: it.px, y: it.py, w: it.pw, h: it.ph }); }
    for (const it of items) { // rewrite the 4 UVs of the sign's quad
      const u0 = (it.px + 0.5) / AW, u1 = (it.px + it.pw - 0.5) / AW, v0 = (it.py + 0.5) / AH, v1 = (it.py + it.ph - 0.5) / AH; const m = it.s.ref; const b = it.s.vi * 2;
      const uv = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]]; for (let q = 0; q < 4; q++) { m.uv[b + q * 2] = uv[q][0]; m.uv[b + q * 2 + 1] = uv[q][1]; }
    }
    if (!screenDefs.find((d) => d.key === 'scr_pd_signs')) screenDefs.push({ id: 'pd_signs', key: 'scr_pd_signs', kind: 'signAtlas', w: 1, h: 1, atlasW: AW, atlasH: AH, items: [...uniq.values()] });
  }

  return L;

  // ---- small helpers that need the builder's scope
  function f_interact(id, kind, label, min, max, pri, extra = {}) { interactables.push({ id, kind, label, min, max, pri, ...extra }); }
  /** A small lit screen with fixed text (the report kiosk's touch screen). */
  function screenSign(id, x, y, z, w, h, text) { k.screen(id, 'sign', x, y, z, w, h, 'z', 1, 0, { text, small: true }); }
  /** Floor directory at a stair landing: lists where everything is on both floors. */
  function directory(fc, a, y, lv) {
    const txt = lv === 0
      ? 'FLOOR 1 DIRECTORY\nSpine corridor: Roll Call · Watch Command\nSpine corridor: Lockers · Report Writing\nSpine corridor: Evidence & Property\nMain corridor: Lobby · Records · Interview\nCorridor S: Gun Room · Break Room\nUpstairs: CHIEF · CAPTAIN · DETECTIVES'
      : 'FLOOR 2 DIRECTORY\nCAPTAIN · ASST. CHIEF · CHIEF\n   spine corridor → Command Hall\nConference Room · Administration\nTraining · Major Case · Payroll\nDetectives · Detective Sergeant\nDetective Offices · Investigation 1';
    sign(fc, a, y, 1.75, txt, { h: 1.05, style: 'dir' });
    f_interact(`pd_directory_${lv}`, 'directory', 'Read the building directory', [fc.axis === 'x' ? Math.min(fc.surf, fc.surf + fc.s * 0.3) : a - 0.88, Y + y - 0.55, fc.axis === 'x' ? a - 0.88 : Math.min(fc.surf, fc.surf + fc.s * 0.3)], [fc.axis === 'x' ? Math.max(fc.surf, fc.surf + fc.s * 0.3) : a + 0.88, Y + y + 0.55, fc.axis === 'x' ? a + 0.88 : Math.max(fc.surf, fc.surf + fc.s * 0.3)], 1, { floor: lv });
  }
}

/** Stall along a side wall: stall depth runs along +x from x0, stall width along +z from z0, door on the x0+depth line, opening toward +x. */
function stallX(f, x0, z0, depth, width, y = 0, { id, accessible = false, shared = false } = {}) {
  const { mb } = f; const xf = x0 + depth; const zc = z0 + width / 2;
  const ph = 1.75, pg = 0.22;
  const sides = shared ? [z0 + width] : [z0, z0 + width]; // `shared`: the previous stall already built the partition at z0
  for (const zz of sides) { mb('stall').box(x0 + depth / 2, y + pg + ph / 2, zz, depth - 0.02, ph, 0.025, { uv: 0.6 }); mb('chrome').box(xf - 0.15, y + pg / 2, zz, 0.04, pg, 0.04); }
  const doorW = Math.min(0.66, width - 0.22); const piW = (width - doorW) / 2;
  for (const [a, b] of [[z0, z0 + piW], [z0 + width - piW, z0 + width]]) mb('stall').box(xf, y + pg + ph / 2, (a + b) / 2, 0.025, ph, b - a, { uv: 0.6 });
  mb('chrome').box(xf, y + pg + ph + 0.02, zc, 0.04, 0.035, width);
  const tx = x0 + 0.3;
  mb('porcelain').rbox(tx + 0.1, y + 0.2, zc, 0.34, 0.4, 0.24, { r: 0.08, uv: 0 }); mb('porcelain').rbox(tx + 0.22, y + 0.38, zc, 0.5, 0.06, 0.38, { r: 0.12, uv: 0 }); mb('white').rbox(tx + 0.23, y + 0.42, zc, 0.44, 0.025, 0.38, { r: 0.1, uv: 0 });
  mb('chrome').tube(x0 + 0.08, y + 0.82, zc, 0.02, 0.3, 'x', 8); mb('chrome').cylinder(x0 + 0.03, y + 0.68, zc, 0.025, 0.28, 8);
  mb('chrome').rbox(tx + 0.3, y + 0.7, z0 + width - 0.042, 0.2, 0.12, 0.06, { r: 0.02, uv: 0 });
  if (accessible) { mb('chrome').tube(tx + 0.4, y + 0.85, z0 + width - 0.04, 0.018, 0.9, 'x', 8); for (const e of [-0.4, 0.4]) mb('chrome').box(tx + 0.4 + e, y + 0.85, z0 + width - 0.025, 0.03, 0.03, 0.05); }
  for (const zz of sides) f.col(x0, zz - 0.04, xf, zz + 0.04, y, y + 2);
  for (const [a, b] of [[z0, z0 + piW], [z0 + width - piW, z0 + width]]) f.col(xf - 0.04, a, xf + 0.04, b, y, y + 2);
  f.col(x0, zc - 0.2, tx + 0.45, zc + 0.2, y, y + 0.45);
  f.seat({ x: tx + 0.3, y: y + 0.44, z: zc, yaw: -Math.PI / 2, label: 'Sit down', toilet: true });
  return { id, kind: 'stall', hinge: [xf, y + pg + 0.02, z0 + piW], w: doorW, h: ph - 0.05, t: 0.025, base: -Math.PI / 2, openSign: -1, max: 1.55, mat: 'stallDoor', y, label: 'stall door' };
}
