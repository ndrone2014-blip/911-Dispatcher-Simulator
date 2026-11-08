// City Police Department – a two-story building on the north side of the 911 center.
//
// Ground floor (y 0 – 3.6)                         Second floor (y 4.0 – 7.6)
//   x: -12      -5      1   4         12             x: -12      -5      -0.5   4        12
// z-40 ┌───────┬───────┬───┬──────────┐            z-40 ┌───────┬───────┬──────┬────────┐
//      │EVIDENCE│INVEST.│REC│  PUBLIC  │                 │ CHIEF │ ASST. │ CAPT │ CONFER-│
//      │STORAGE │ ROOM  │ORD│  LOBBY   │                 │ OFFICE│ CHIEF │      │ ENCE   │
//  -36 │        ├──┬────┤S &│ waiting, │             -33 ├───────┼───────┴──────┤ ROOM   │
//      ├───────┤IV│ IV │FRT│ kiosk,   │═ entrance       │EXEC.  │ ADMINISTRATIVE│        │
//  -32 │INTAKE │1 │ 2  │DSK│ front    │                 │ASSIST.│ OFFICES       │        │
//  -31 │       ├──┴────┤   │ desk     │             -28 ├───────┴───────────────┴──┬─────┤
//  -28 ├───────┤OBSERV.├───┴──────┬───┤ corridor C      │  corridor M2              │ C2  │
//      │  corridor M1             │   │             -25.6├────┬──────────┬────────┬─┤     │
// -25.6├────┬────┬────┬────────┬──┤   │                 │STR │ TRAINING │DETECTIVE│DS│     │
//      │STR │MEN │WOM.│ROLL    │WC│ C │                 │ B  │ ROOM     │BULLPEN  ├──┤     │
//      │ B  │RR +│RR +│CALL    ├──┤   │            -17.4├────┴──────────┴────────┤IR│     │
//      │    │LOCK│LOCK│ROOM    │SG│   │                 │  corridor S2            ├──┘     │
// -17.4├────┴────┴────┴────────┴──┤   │             -15 ├──────┬────┬────┬───────┬─┤       │
//      │  corridor S              │   │                 │MAJOR │DET │DET │ ADMIN │STAIR A │
//  -15 ├───────┬──────────────┬───┤   │                 │CASE  │OFF │OFF │ / HR  │        │
//      │GUN RM │ BREAK ROOM   │STR│   │              -8 └──────┴────┴────┴───────┴────────┘
//   -8 └───────┴──────────────┴─A─┴───┘ ← door into the dispatch floor (x 9.2 – 10.6)
//
// The gun room opens onto the joint training range (Sheriff's wing) behind the firing line.
// Everything is merged into per-floor material batches ('@pd1' / '@pd2') so a whole floor
// can be culled when you can't see it.
import { officeChair, guestChair, stackChair, beamSeating, sofa, bench, desk, table, cubicles, bookcase, fileCabinet, shelving, lockerBank, credenza, plantPot, frame, flagStand, trashCan, waterCooler, copier, wallBoard, toiletStall, urinal, vanity, kitchenette, fridge, vendingMachine, gunRack, vestRack, radioCharger, interviewSet, podium } from './furniture.js';

export const PD = { x0: -12, x1: 12, z0: -40, z1: -8, F2: 4.0, CEIL: 3.6, ROOF: 8.2 };
export const DISPATCH_DOOR = [9.2, 10.6]; // opening in the dispatch floor's north wall (z = -8)
export const RANGE_DOOR = [-10.6, -9.4];  // gun room → range (x = -12)
export const ENTRANCE = [-35, -33];       // automatic doors on the east face (x = 12)

// Stairs: two U-shaped stairs, 11 risers per flight (rise 0.182 m, going 0.282 m).
export const STAIRS = [
  { id: 'A', box: [5, -15, 8.6, -8], flight1: { x0: 6.85, x1: 8.5, at: -9.6, to: -12.7 }, landing: [5.1, -15, 8.5, -12.7], flight2: { x0: 5.1, x1: 6.75, at: -12.7, to: -9.6 }, hole: [5, -15, 8.6, -9.6], guard: [6.85, -9.66, 8.6, -9.54], core: [6.75, -12.7, 6.85, -9.6] },
  { id: 'B', box: [-12, -25.6, -8.6, -19.4], flight1: { x0: -11.9, x1: -10.35, at: -24, to: -20.9 }, landing: [-11.9, -20.9, -8.7, -19.4], flight2: { x0: -10.25, x1: -8.7, at: -20.9, to: -24 }, hole: [-12, -24, -8.6, -19.4], guard: [-12, -24.06, -10.35, -23.94], core: [-10.35, -24, -10.25, -20.9] },
];

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

// ---------------------------------------------------------------------------------------
export function buildPoliceDept(k) {
  const { col: colRaw, screen, interactables, lights, seats, doors, nav, D } = k;
  // furniture here is numerous: one bevel step on rounded edges keeps the triangle count sane
  const mbZone = (z) => { const f0 = k.mbZone(z); return (key) => { const m = f0(key); m.seg = 1; return m; }; };
  const F2 = PD.F2, CH = PD.CEIL;
  let mb = mbZone('pd1'); let Y = 0;
  const level = (l) => { mb = mbZone(l ? 'pd2' : 'pd1'); Y = l ? F2 : 0; };
  const col = (x0, z0, x1, z1, y0 = Y, y1 = Y + CH) => colRaw(x0, z0, x1, z1, y0, y1);
  const f = { get mb() { return mb; }, col: (x0, z0, x1, z1, y0, y1) => colRaw(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y0, y1), seat: (s) => seats.push({ ...s, zone: Y ? 'pd2' : 'pd1' }), interact: (it) => interactables.push({ id: it.id || `pd_${it.kind}_${interactables.length}`, ...it }), D };
  // furniture functions read f.mb as a function
  const F = { ...f }; Object.defineProperty(F, 'mb', { get: () => mb });
  const node = (id, x, z, extra = {}) => nav.nodes.push({ id, x, z, y: extra.y ?? Y, ...extra });
  const link = (...ids) => { for (let i = 0; i < ids.length - 1; i++) nav.links.push([ids[i], ids[i + 1]]); };
  const sign = (id, text, x, y, z, axis, s, w = 1.4) => { // sign face on a 5 cm plaque that runs back to the wall
    if (axis === 'z') mb('dark').box(x, y, z - s * 0.026, w + 0.05, 0.3, 0.05, { uv: 0 }); else mb('dark').box(x - s * 0.026, y, z, 0.05, 0.3, w + 0.05, { uv: 0 });
    screen(id, 'sign', axis === 'x' ? x + s * 0.002 : x, y, axis === 'z' ? z + s * 0.002 : z, w, 0.24, axis, s, 0, { text, shared: undefined }); };
  const sitNode = (id, pose, extra = {}) => node(id, pose[0], pose[1], { sit: pose[2], ...extra });

  // ------------------------------------------------ walls
  // Axis-aligned wall with openings: [a, b, type, opts]. type: door | pass | window | ext | glass | mirror | counter
  const wall = (x0, z0, x1, z1, open = [], { mat = 'wall', h = CH, thick = 0.16, mirrorSide = 1 } = {}) => {
    const alongX = z0 === z1; const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1); const c = alongX ? z0 : x0;
    const seg = (a, b, y0, y1, collide = true, m = mat) => {
      if (b - a < 0.005 || y1 - y0 < 0.005) return;
      if (alongX) mb(m).wall(a, c, b, c, Y + y0, Y + y1, thick, { uv: 2 }); else mb(m).wall(c, a, c, b, Y + y0, Y + y1, thick, { uv: 2 });
      if (D >= 1 && y0 === 0 && m !== 'glass') { if (alongX) mb('rubber').wall(a, c, b, c, Y, Y + 0.1, thick + 0.03, { uv: 0 }); else mb('rubber').wall(c, a, c, b, Y, Y + 0.1, thick + 0.03, { uv: 0 }); }
      if (collide) { const t = thick / 2 + 0.02; if (alongX) col(a, c - t, b, c + t, Y + y0, Y + y1); else col(c - t, a, c + t, b, Y + y0, Y + y1); }
    };
    const P = (a, y, o = 0) => (alongX ? [a, Y + y, c + o] : [c + o, Y + y, a]);
    const ops = open.slice().sort((p, q) => p[0] - q[0]); let cur = a0;
    for (const [a, b, type, o = {}] of ops) {
      seg(cur, a, 0, h); cur = b; const mid = (a + b) / 2, w = b - a;
      if (type === 'door' || type === 'pass') {
        const head = type === 'pass' ? 2.45 : 2.25; seg(a, b, head, h, false);
        if (type === 'door' && D >= 1) { // frame + a leaf swung open against the wall
          for (const e of [a, b]) { const [px, py, pz] = P(e, 1.125); mb('frame').box(px, py, pz, alongX ? 0.06 : thick + 0.06, 2.25, alongX ? thick + 0.06 : 0.06); }
          { const [px, py, pz] = P(mid, 2.25); mb('frame').box(px, py, pz, alongX ? w + 0.06 : thick + 0.06, 0.06, alongX ? thick + 0.06 : w + 0.06); }
          if (o.leaf !== false) { const side = o.side || 1; const lw = w - 0.06; const [px, , pz] = P(a - lw / 2 - 0.03, 0, side * (thick / 2 + 0.03));
            mb(o.leafMat || 'doorWood').rbox(px, Y + 1.11, pz, alongX ? lw : 0.045, 2.2, alongX ? 0.045 : lw, { r: 0.008, uv: 1 });
            const [hx, , hz] = P(a - lw + 0.1, 0, side * (thick / 2 + 0.07)); mb('chrome').box(hx, Y + 1.02, hz, alongX ? 0.14 : 0.03, 0.022, alongX ? 0.03 : 0.14); }
          const [tx, , tz] = P(mid, 0); mb('metal').box(tx, Y + 0.006, tz, alongX ? w : thick + 0.08, 0.012, alongX ? thick + 0.08 : w, { uv: 0.5 });
        }
        continue;
      }
      // glazed openings
      const sill = o.sill ?? (type === 'ext' ? 0.85 : type === 'counter' ? 1.05 : 0.9), head = o.head ?? (type === 'ext' ? 2.75 : 2.35);
      seg(a, b, 0, sill); seg(a, b, head, h, false);
      const t = thick / 2 + 0.02; if (alongX) col(a, c - t, b, c + t, Y + sill, Y + head); else col(c - t, a, c + t, b, Y + sill, Y + head);
      const [gx, gy, gz] = P(mid, (sill + head) / 2);
      if (type === 'mirror') { // one-way glass: mirror toward mirrorSide, dark glass on the other side
        mb('mirror').panel(gx + (alongX ? 0 : mirrorSide * 0.01), gy, gz + (alongX ? mirrorSide * 0.01 : 0), w, head - sill, alongX ? 'z' : 'x', mirrorSide);
        mb('glassDark').panel(gx - (alongX ? 0 : mirrorSide * 0.01), gy, gz - (alongX ? mirrorSide * 0.01 : 0), w, head - sill, alongX ? 'z' : 'x', -mirrorSide);
      } else mb(type === 'counter' ? 'glass' : 'glass').panel(gx, gy, gz, w, head - sill, alongX ? 'z' : 'x', 1);
      // frame and mullions
      const n = Math.max(1, Math.round(w / 1.6));
      for (let i = 0; i <= n; i++) { const [mx, my, mz] = P(a + (w * i) / n, (sill + head) / 2); mb('frame').box(mx, my, mz, alongX ? 0.05 : thick + 0.04, head - sill, alongX ? thick + 0.04 : 0.05); }
      for (const yy of [sill, head]) { const [mx, my, mz] = P(mid, yy); mb('frame').box(mx, my, mz, alongX ? w : thick + 0.04, 0.05, alongX ? thick + 0.04 : w); }
      if (type === 'ext' || type === 'window') { const [sx, sy, sz] = P(mid, sill - 0.02, 0); mb('counter').box(sx, sy, sz, alongX ? w + 0.1 : thick + 0.22, 0.04, alongX ? thick + 0.22 : w + 0.1, { uv: 0.5 }); }
      if ((type === 'ext') && D >= 1) { const [bx, by, bz] = P(mid, head - 0.2, o.inSide ? o.inSide * (thick / 2 + 0.04) : 0); if (o.inSide) mb('blinds').box(bx, by, bz, alongX ? w - 0.05 : 0.03, 0.3, alongX ? 0.03 : w - 0.05, { faces: alongX ? 'zZ' : 'xX', uv: 0 }); }
      if (type === 'counter') { const [sx, sy, sz] = P(mid, sill - 0.02, 0); mb('counterTop').rbox(sx, sy, sz, alongX ? w + 0.1 : 0.7, 0.05, alongX ? 0.7 : w + 0.1, { r: 0.01, uv: 1 }); const [px, py, pz] = P(mid, sill + 0.05, 0); mb('metal').box(px, py, pz, alongX ? 0.4 : 0.3, 0.08, alongX ? 0.3 : 0.4, { uv: 0.5 }); }
    }
    seg(cur, a1, 0, h);
  };
  const floor = (x0, z0, x1, z1, mat, uv = 1.2) => mb(mat).box((x0 + x1) / 2, Y - 0.05, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0, { faces: 'Y', uv });
  const ceiling = (x0, z0, x1, z1) => mb('ceiling').box((x0 + x1) / 2, Y + CH + 0.05, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0, { faces: 'y', uv: 1.2 });
  const room = (x0, z0, x1, z1, mat, uv) => { floor(x0, z0, x1, z1, mat, uv); ceiling(x0, z0, x1, z1); };
  const lamp = (x, z, roomName = 'pd', w = 1.2, d = 0.6) => {
    if (D >= 1) { mb('troffer').box(x, Y + CH - 0.012, z, w, 0.03, d, { faces: 'y', uv: 0 }); mb('whiteCeil').box(x, Y + CH - 0.018, z, w + 0.06, 0.036, d + 0.06, { faces: 'xXzZ', uv: 0 }); }
    else mb('lightpanel').box(x, Y + CH - 0.02, z, w, 0.04, d, { faces: 'y', uv: 0 });
    lights.push({ pos: [x, Y + CH - 0.4, z], room: roomName, base: 1, range: 5.6, dim: 0.86 });
  };
  const lampsIn = (x0, z0, x1, z1, roomName, nx = 1, nz = 1) => { for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) lamp(x0 + (x1 - x0) * (i + 0.5) / nx, z0 + (z1 - z0) * (j + 0.5) / nz, roomName); };
  const vent = (x, z) => { if (D >= 1) mb('vent').box(x, Y + CH - 0.003, z, 0.6, 0.006, 0.6, { faces: 'y', uv: 0 }); };
  const exitSign = (x, z, axis, s) => { if (D < 1) return; if (axis === 'z') { mb('white').box(x, Y + 2.56, z + s * 0.045, 0.4, 0.2, 0.05, { uv: 0 }); mb('exit').panel(x, Y + 2.56, z + s * 0.072, 0.36, 0.15, 'z', s); } else { mb('white').box(x + s * 0.045, Y + 2.56, z, 0.05, 0.2, 0.4, { uv: 0 }); mb('exit').panel(x + s * 0.072, Y + 2.56, z, 0.36, 0.15, 'x', s); } };
  const wainscot = (x0, z0, x1, z1, mat = 'ceramic', h = 1.4, inward = 1) => { const alongX = z0 === z1; if (alongX) mb(mat).box((x0 + x1) / 2, Y + h / 2, z0 + inward * 0.09, Math.abs(x1 - x0), h, 0.02, { uv: 0.6 }); else mb(mat).box(x0 + inward * 0.09, Y + h / 2, (z0 + z1) / 2, 0.02, h, Math.abs(z1 - z0), { uv: 0.6 }); };

  // ======================================================================= GROUND FLOOR
  level(0);
  // floors & ceilings
  room(-12, -40, -5, -32, 'concrete', 2.5); room(-12, -32, -5, -28, 'tile');                  // evidence storage / intake
  room(-5, -40, 1, -36, 'officeCarpet'); room(-5, -36, 1, -31, 'tile'); room(-5, -31, 1, -28, 'officeCarpet'); // investigation / interview / observation
  room(1, -40, 4, -28, 'officeCarpet');                                                         // records & front desk
  room(4, -40, 12, -28, 'terrazzo', 2.4);                                                       // lobby
  room(-12, -28, 8.6, -25.6, 'terrazzo', 2.4); room(8.6, -28, 12, -8, 'terrazzo', 2.4);         // corridors M1 + C
  room(-12, -17.4, 8.6, -15, 'terrazzo', 2.4);                                                  // corridor S
  room(-8.6, -25.6, -1, -17.4, 'tile');                                                         // restrooms + lockers
  room(-1, -25.6, 5, -17.4, 'officeCarpet'); room(5, -25.6, 8.6, -17.4, 'officeCarpet');         // roll call, WC, Sgt
  room(-12, -19.4, -8.6, -17.4, 'concrete', 2.5);                                               // janitor closet
  room(-12, -15, -6.5, -8, 'concrete', 2.5); room(-6.5, -15, 5, -8, 'plank');                   // gun room, break room
  for (const s of STAIRS) floor(s.box[0], s.box[1], s.box[2], s.box[3], 'terrazzo', 2.4);
  // ceilings over the stairwells are the landings' undersides – stair cores are open to the top
  // exterior walls
  wall(-12, -40, 12, -40, [[2, 3.4, 'ext', { inSide: 1 }], [4.6, 6.6, 'ext', { sill: 0.45, head: 3.0 }], [9.6, 11.4, 'ext', { sill: 0.45, head: 3.0 }]]);
  wall(12, -40, 12, -8, [[-39.4, -36, 'ext', { sill: 0.3, head: 3.1 }], [ENTRANCE[0], ENTRANCE[1], 'pass'], [-32, -28.6, 'ext', { sill: 0.3, head: 3.1 }], [-26.4, -23.2, 'ext', { inSide: -1 }], [-20.4, -17.2, 'ext', { inSide: -1 }], [-13.6, -10.6, 'ext', { inSide: -1 }]]);
  wall(-12, -40, -12, -26);
  // interior: corridor M1 north side + lobby south wall
  wall(-12, -28, 4, -28, [[-7, -6, 'door', { side: -1 }], [-1.5, -0.5, 'door', { side: -1 }], [2, 3, 'door', { side: -1 }]]);
  wall(4, -28, 12, -28, [[9.4, 11.2, 'door', { side: 1, leafMat: 'glassDoor' }]]);
  wall(-12, -32, -5, -32, [[-10, -9, 'door', { side: 1, leafMat: 'metal' }]]);                   // intake | storage (cage door)
  wall(-5, -40, -5, -28, [[-38.6, -37.5, 'door', { side: -1, leafMat: 'metal' }]]);              // evidence | investigation
  wall(-5, -36, 1, -36);                                                                         // interview back wall
  wall(-5, -31, 1, -31, [[-4.7, -3.8, 'door', { side: 1 }], [-3.5, -2.3, 'mirror', { sill: 1.0, head: 2.0 }], [-1.6, -0.7, 'door', { side: 1 }], [-0.4, 0.8, 'mirror', { sill: 1.0, head: 2.0 }]], { mirrorSide: -1 });
  wall(-2, -36, -2, -31);
  wall(1, -40, 1, -28);
  wall(4, -40, 4, -28, [[-37.2, -31.6, 'counter', { sill: 1.05, head: 2.3 }]]);                  // records | lobby: front desk window
  // corridor M1 south side
  wall(-12, -25.6, 8.6, -25.6, [[-11.6, -10.4, 'door', { side: 1 }], [-7.6, -6.6, 'door', { side: 1 }], [-3.8, -2.8, 'door', { side: 1 }], [-0.2, 1.6, 'pass'], [6.2, 7.6, 'glass', { sill: 0.9 }]]);
  wall(-8.6, -25.6, -8.6, -17.4); wall(-4.8, -25.6, -4.8, -17.4); wall(-1, -25.6, -1, -17.4); wall(5, -25.6, 5, -17.4);
  wall(5, -21.4, 8.6, -21.4);
  wall(8.6, -25.6, 8.6, -17.4, [[-24.6, -23.6, 'door', { side: 1 }], [-23.2, -22, 'glass'], [-19.8, -18.8, 'door', { side: 1 }]]);
  wall(-12, -19.4, -8.6, -19.4);
  wall(-8.6, -21.2, -4.8, -21.2, [[-7.4, -6.2, 'pass']]); wall(-4.8, -21.2, -1, -21.2, [[-3.4, -2.2, 'pass']]);
  wall(-12, -17.4, 8.6, -17.4, [[-11.1, -10.2, 'door', { side: -1 }], [3.2, 4.4, 'door', { side: 1 }]]);
  wall(-12, -15, 8.6, -15, [[-9.3, -8.2, 'door', { side: 1, leafMat: 'metal' }], [-4.4, -3.0, 'pass'], [1.4, 2.8, 'pass']]);
  wall(-6.5, -15, -6.5, -8); wall(5, -15, 5, -8);
  wall(8.6, -15, 8.6, -8, [[-9.5, -8.3, 'door', { side: -1 }]]);
  // the PD side of the dispatch north wall (painted skin) and of the range wall
  if (D >= 0) { for (const [a, b] of [[-12, -6.5], [-6.5, 5], [5, 8.6], [8.6, DISPATCH_DOOR[0]], [DISPATCH_DOOR[1], 12]]) mb('wall').box((a + b) / 2, CH / 2, -8.09, b - a, CH, 0.02, { faces: 'z', uv: 2 }); mb('wall').box((DISPATCH_DOOR[0] + DISPATCH_DOOR[1]) / 2, (2.3 + CH) / 2, -8.09, DISPATCH_DOOR[1] - DISPATCH_DOOR[0], CH - 2.3, 0.02, { faces: 'z', uv: 2 });
    for (const [a, b] of [[-26, -15], [-15, RANGE_DOOR[0]], [RANGE_DOOR[1], -8]]) mb('wall').box(-11.91, CH / 2, (a + b) / 2, 0.02, CH, b - a, { faces: 'X', uv: 2 }); mb('wall').box(-11.91, (2.3 + CH) / 2, (RANGE_DOOR[0] + RANGE_DOOR[1]) / 2, 0.02, CH - 2.3, RANGE_DOOR[1] - RANGE_DOOR[0], { faces: 'X', uv: 2 }); }
  // door frames for the two cut-through doors
  for (const [x0, x1] of [DISPATCH_DOOR]) { mb('frame').box(x0, 1.15, -8, 0.08, 2.3, 0.26); mb('frame').box(x1, 1.15, -8, 0.08, 2.3, 0.26); mb('frame').box((x0 + x1) / 2, 2.32, -8, x1 - x0 + 0.08, 0.06, 0.26); }
  for (const [z0, z1] of [RANGE_DOOR]) { mb('frame').box(-12, 1.15, z0, 0.26, 2.3, 0.08); mb('frame').box(-12, 1.15, z1, 0.26, 2.3, 0.08); mb('frame').box(-12, 2.32, (z0 + z1) / 2, 0.26, 0.06, z1 - z0 + 0.08); mb('metal').box(-12.18, 1.12, z0 - 0.62, 0.05, 2.2, 1.14); }

  // ------------------------------------------------ lobby
  lampsIn(4.5, -39.5, 11.5, -28.5, 'floor', 3, 3);
  for (const z of [-36.5, -31]) vent(8, z);
  // automatic sliding doors + vestibule mats
  doors.push({ id: 'pd_entrance', kind: 'slide', x: 12, z0: ENTRANCE[0], z1: ENTRANCE[1], y: 0, h: 2.4, axis: 'z', mat: 'glassDoor' });
  mb('dark').box(11.82, 2.52, (ENTRANCE[0] + ENTRANCE[1]) / 2, 0.16, 0.14, ENTRANCE[1] - ENTRANCE[0] + 0.3); // door operator header
  for (const e of ENTRANCE) mb('frame').box(12, 1.22, e, 0.26, 2.45, 0.1);
  mb('rubber').box(10.8, 0.008, -34, 2.0, 0.016, 2.4, { uv: 0 });
  // front desk counter (public side) with bullet-resistant glass above
  mb('woodDark').rbox(4.5, 0.55, -34.4, 0.7, 1.1, 5.8, { r: 0.02, uv: 1, ao: 0.2 }); mb('counterTop').rbox(4.65, 1.12, -34.4, 0.9, 0.05, 5.9, { r: 0.01, uv: 1 }); col(4, -37.4, 4.95, -31.4, 0, 1.2);
  mb('seal').panel(4.857, 0.6, -34.4, 0.5, 0.5, 'x', 1);
  sign('pd_sign_frontdesk', 'FRONT DESK · RECORDS · REPORTS', 4.12, 2.75, -34.4, 'x', 1, 3.2);
  f.interact({ id: 'pd_frontdesk', kind: 'frontdesk', label: 'Front desk – speak to the desk officer', min: [4.4, 0.8, -37.2], max: [5.4, 2.0, -31.6], pri: 2 });
  // waiting room: beam seating, magazine table, plant, TV
  beamSeating(F, 7.4, -37.6, Math.PI, 0, 4); beamSeating(F, 7.4, -30.6, 0, 0, 4); beamSeating(F, 10.9, -37.7, Math.PI, 0, 2);
  table(F, 7.4, -34.1, 0, 0, { w: 1.1, d: 0.55, h: 0.42, top: 'woodDark' }); if (D >= 1) { mb('paper').box(7.2, 0.45, -34.1, 0.3, 0.01, 0.22, { rotY: 0.3, uv: 0 }); mb('print2').box(7.6, 0.45, -34, 0.24, 0.012, 0.3, { rotY: -0.2, uv: 0 }); }
  plantPot(F, 11.4, -39.4, 0, 1.1); plantPot(F, 4.9, -28.6, 0, 1.0); plantPot(F, 11.4, -28.6, 0, 0.9);
  mb('blackgloss').box(8, 2.3, -39.89, 1.7, 1.0, 0.06, { uv: 0 }); screen('pd_lobby_tv', 'tv', 8, 2.3, -39.858, 1.6, 0.9, 'z', 1, 0, { shared: 'scr_tv' });
  // report filing kiosk + brochure rack (north wall, west part)
  mb('satin').rbox(5.4, 0.55, -39.55, 0.9, 1.1, 0.5, { r: 0.03, color: [0.2, 0.24, 0.3] }); mb('satin').rbox(5.4, 1.35, -39.68, 0.7, 0.55, 0.12, { r: 0.02, color: [0.1, 0.1, 0.12], rotX: -0.2 });
  screen('pd_kiosk', 'sign', 5.4, 1.36, -39.6, 0.6, 0.42, 'z', 1, 0, { text: 'FILE A REPORT · TOUCH TO START', small: true });
  col(4.9, -39.85, 5.9, -39.25, 0, 1.6);
  f.interact({ id: 'pd_kiosk', kind: 'report_kiosk', label: 'Report kiosk – file a police report', min: [4.9, 0.6, -39.9], max: [5.9, 1.8, -39.2], pri: 1 });
  mb('satin').box(9.05, 1.1, -39.86, 0.6, 1.1, 0.12, { color: [0.6, 0.56, 0.5] }); for (let i = 0; i < 6; i++) mb(['print1', 'print2', 'paper'][i % 3]).box(8.9 + (i % 2) * 0.3, 0.75 + Math.floor(i / 2) * 0.32, -39.79, 0.22, 0.28, 0.02, { uv: 0 });
  // wall of honor: memorial plaques + framed photos on the south wall, flags by the desk
  for (let i = 0; i < 4; i++) frame(F, 5.0 + i * 1.1, 1.75, -28.08, 'z', -1, 0.55, 0.7, i % 2 ? 'print2' : 'print1');
  mb('gold').box(9.1, 2.45, -28.095, 2.6, 0.12, 0.03);
  flagStand(F, 5.2, -38.4, 0, 'flagUS', Math.PI / 2); flagStand(F, 5.2, -31.0, 0, 'flagIL', Math.PI / 2);
  sign('pd_sign_lobby', 'CITY POLICE DEPARTMENT · WELCOME', 8, 3.25, -39.89, 'z', 1, 4.2);
  waterCooler(F, 11.6, -32.4, 0);
  trashCan(F, 11.6, -36.2);
  exitSign(10.3, -28, 'z', 1);
  // lobby nav
  node('p_lob_in', 11.0, -34); node('p_lob_out', 13.6, -34, { outside: true }); node('p_lob_mid', 8.6, -34); node('p_lob_desk', 5.4, -34.4, { face: -Math.PI / 2 });
  node('p_lob_kiosk', 5.4, -38.9, { face: 0 }); node('p_lob_door', 10.3, -29.2);
  link('p_lob_out', 'p_lob_in', 'p_lob_mid', 'p_lob_desk'); link('p_lob_mid', 'p_lob_kiosk'); link('p_lob_mid', 'p_lob_door');
  node('p_lot1', 17.0, -32, { outside: true }); node('p_lot2', 17.5, -8, { outside: true }); link('p_lob_out', 'p_lot1', 'p_lot2');
  for (let i = 0; i < 4; i++) { node(`p_wait${i}`, 7.4 - 0.93 + i * 0.62, -37.6 + 0.05, { sit: Math.PI }); link(`p_wait${i}`, 'p_lob_mid'); }

  // ------------------------------------------------ records & front desk (inside)
  lampsIn(1, -40, 4, -28, 'super', 1, 3);
  const dRec = desk(F, 3.2, -34.4, -Math.PI / 2, 0, { w: 1.5, d: 0.6, monitors: 2, screenKey: 'scr_cw0', wood: 'laminate' }); // desk officer faces the window
  const dRec2 = desk(F, 2.4, -29.6, Math.PI, 0, { w: 1.4, d: 0.7, monitors: 1, screenKey: 'scr_cw2', wood: 'laminate' });
  for (let i = 0; i < 3; i++) shelving(F, 1.6, -39.3 + i * 0.0, 0, 0, { w: 1.0, d: 0.5, h: 2.2 });
  fileCabinet(F, 3.6, -39.6, 0); fileCabinet(F, 1.3, -32.0, Math.PI / 2, 0, { drawers: 4, w: 0.9 }); copier(F, 1.4, -36.4, -Math.PI / 2);
  sign('pd_sign_records', 'RECORDS', 2.5, 2.55, -27.9, 'z', 1, 1.2);
  node('p_rec_door', 2.5, -28.6); node('p_rec_mid', 2.5, -32.5); sitNode('p_rec_desk', dRec.chair); sitNode('p_rec_desk2', dRec2.chair);
  node('p_rec_files', 1.9, -38.4, { face: 0 }); node('p_rec_copier', 2.0, -36.4, { face: Math.PI / 2 });
  link('p_rec_door', 'p_rec_desk2'); link('p_rec_door', 'p_rec_mid', 'p_rec_desk'); link('p_rec_mid', 'p_rec_copier', 'p_rec_files');
  f.interact({ id: 'pd_records', kind: 'records', label: 'Records – look through the case files', min: [1.1, 0, -39.9], max: [2.2, 2.2, -38.7], pri: 0 });

  // ------------------------------------------------ evidence & property
  lampsIn(-12, -40, -5, -32, 'radio', 2, 2); lampsIn(-12, -32, -5, -28, 'radio', 2, 1);
  // intake: counter, pass-through temporary lockers on the corridor wall, packaging bench
  mb('satin').rbox(-8.5, 0.48, -30.0, 3.0, 0.96, 0.7, { r: 0.01, color: [0.36, 0.4, 0.46] }); mb('counterTop').rbox(-8.5, 0.98, -30.0, 3.1, 0.05, 0.8, { r: 0.01, uv: 1 }); col(-10.05, -30.4, -6.95, -29.6, 0, 1.05);
  for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) for (const [zz, ss] of [[-27.91, 1], [-28.59, -1]]) { mb('satin').box(-11.25 + q * 0.5, 0.6 + r * 0.55, zz, 0.46, 0.5, 0.02, { color: [0.42, 0.45, 0.5] }); mb('beaconGreen').box(-11.15 + q * 0.5, 0.75 + r * 0.55, zz + ss * 0.012, 0.02, 0.02, 0.005); mb('chrome').box(-11.42 + q * 0.5, 0.6 + r * 0.55, zz + ss * 0.015, 0.02, 0.1, 0.012); }
  mb('satin').box(-10.5, 1.01, -28.33, 2.1, 2.02, 0.5, { color: [0.36, 0.38, 0.42] }); mb('satin').box(-10.5, 1.01, -27.9, 2.14, 2.06, 0.03, { faces: 'zZ', color: [0.2, 0.21, 0.24] }); col(-11.6, -28.6, -9.4, -28.1, 0, 2);
  mb('paper').box(-8.7, 1.015, -30, 0.32, 0.012, 0.25, { uv: 0 }); mb('paper').rbox(-8.1, 1.06, -29.95, 0.25, 0.1, 0.2, { r: 0.02, uv: 0 });
  sign('pd_sign_evidence', 'EVIDENCE & PROPERTY · AUTHORIZED ONLY', -6.5, 2.7, -27.88, 'z', 1, 3.0);
  // storage cage: chain-link partition + shelving rows + drug/gun safes
  for (let i = 0; i < 6; i++) shelving(F, -11.1 + (i % 2) * 0.0, -38.8 + Math.floor(i / 2) * 2.2 + 0.0, Math.PI / 2, 0, { w: 1.8, d: 0.6, items: i % 2 ? 'bags' : 'boxes' });
  for (let i = 0; i < 3; i++) shelving(F, -8.0, -38.8 + i * 2.2, Math.PI / 2, 0, { w: 1.8, d: 0.6, items: 'bags' });
  mb('satin').rbox(-5.7, 0.8, -39.4, 0.9, 1.6, 0.7, { r: 0.02, color: [0.2, 0.22, 0.2] }); mb('chrome').cylinder(-5.7, 0.95, -39.03, 0.06, 0.03, 12); col(-6.2, -39.9, -5.2, -39, 0, 1.6);
  mb('satin').rbox(-6.0, 0.6, -33.0, 1.4, 1.2, 0.6, { r: 0.02, color: [0.25, 0.3, 0.35] }); col(-6.7, -33.4, -5.3, -32.6, 0, 1.2);
  f.interact({ id: 'pd_evidence', kind: 'evidence', label: 'Evidence intake – log an item', min: [-10, 0.8, -30.5], max: [-7, 1.6, -29.5], pri: 1 });
  node('p_ev_door', -6.5, -28.6); node('p_ev_counter', -8.5, -29.1, { face: Math.PI }); node('p_ev_cage', -9.5, -31.4); node('p_ev_rows', -9.5, -35.5, { face: Math.PI / 2 }); node('p_ev_rows2', -6.5, -37, { face: -Math.PI / 2 }); node('p_ev_inv', -5.5, -38, {});
  link('p_ev_door', 'p_ev_counter', 'p_ev_cage', 'p_ev_rows', 'p_ev_rows2', 'p_ev_inv');

  // ------------------------------------------------ interview suite + investigation room
  lampsIn(-5, -31, 1, -28, 'super', 2, 1); lamp(-3.5, -33.5, 'radio', 0.6, 0.6); lamp(-0.5, -33.5, 'radio', 0.6, 0.6); lampsIn(-5, -40, 1, -36, 'super', 2, 1);
  interviewSet(F, -3.5, -33.8, 0, 0); interviewSet(F, -0.5, -33.8, 0, 0);
  for (const x of [-4.8, -1.8]) { mb('dark').sphere(x + 0.12, CH - 0.04, -35.8, 0.07, 10, 6, { sy: 0.6 }); mb('acoustic').box(x + 1.4, 1.6, -35.9, 2.6, 2.4, 0.04, { uv: 0.6 }); }
  // observation: monitors on a counter facing the mirrors
  mb('laminate').rbox(-2, 0.74, -30.645, 5.6, 0.04, 0.55, { r: 0.01, uv: 1 }); mb('satin').box(-2, 0.36, -30.68, 5.5, 0.72, 0.46, { color: [0.3, 0.32, 0.36] }); col(-4.8, -30.9, 0.8, -30.3, 0, 0.8);
  for (const x of [-4.2, -1.3]) { mb('dark').box(x, 0.765, -30.72, 0.22, 0.012, 0.16, { uv: 0 }); mb('dark').box(x, 0.82, -30.76, 0.04, 0.12, 0.03, { uv: 0 }); mb('bezel').rbox(x, 1.0, -30.74, 0.5, 0.3, 0.025, { r: 0.006, uv: 0 }); mb('scr_cw1').panel(x, 1.0, -30.725, 0.46, 0.26, 'z', 1); }
  for (const x of [-3.4, -0.4]) officeChair(F, x, -29.9, 0, 0);
  sign('pd_sign_interview', 'INTERVIEW · RECORDING IN PROGRESS WHEN LIT', -1, 2.7, -27.88, 'z', 1, 3.2);
  mb('lightRed').box(-1, 2.95, -27.9, 0.2, 0.08, 0.04);
  // investigation / evidence processing room: big table, evidence board, lights
  table(F, -2, -38.2, 0, 0, { w: 2.8, d: 1.1, top: 'laminate', chairs: 4, chairType: 'office' });
  wallBoard(F, -2, 1.6, -39.88, 'z', 1, 3.6, 1.2, 'cork'); wallBoard(F, 0.88, 1.6, -38, 'x', -1, 2.4, 1.1, 'whiteboard');
  for (let i = 0; i < 7; i++) mb(['paper', 'print1', 'print2'][i % 3]).box(-3.4 + i * 0.45, 1.5 + (i % 3) * 0.25, -39.84, 0.28, 0.2, 0.01, { uv: 0 });
  f.interact({ id: 'pd_interview', kind: 'interview', label: 'Observation room – watch the interview monitors', min: [-4.8, 0.7, -31], max: [0.8, 1.4, -30.2], pri: 1 });
  f.interact({ id: 'pd_invest1', kind: 'investigation', label: 'Investigation room – study the case board', min: [-4, 0.9, -40], max: [0, 2.3, -39.6], pri: 1 });
  node('p_obs_door', -1, -28.6); node('p_obs', -2, -29.6, { face: 0 }); node('p_obs_seat', -3.4, -29.9, { sit: 0 });
  node('p_iv1', -4.25, -32.6); node('p_iv1_seat', -3.5, -33.12, { sit: 0 }); node('p_iv2', -1.15, -32.6); node('p_iv2_seat', -0.5, -33.12, { sit: 0 });
  node('p_inv', -2, -36.8, { face: Math.PI }); node('p_inv_board', -2, -39.2, { face: 0 });
  link('p_obs_door', 'p_obs', 'p_obs_seat'); link('p_obs', 'p_iv1', 'p_iv1_seat'); link('p_obs', 'p_iv2', 'p_iv2_seat'); link('p_ev_inv', 'p_inv', 'p_inv_board');

  // ------------------------------------------------ corridors (ground)
  lampsIn(-12, -28, 8.6, -25.6, 'corridor', 5, 1); lampsIn(8.6, -28, 12, -8, 'corridor', 1, 5); lampsIn(-12, -17.4, 8.6, -15, 'corridor', 5, 1);
  if (D >= 1) {
    for (const [a, b] of [[-12, -7], [-6, -1.5], [-0.5, 2], [3, 4]]) mb('woodDark').rbox((a + b) / 2, 0.92, -27.88, b - a, 0.14, 0.05, { r: 0.015, uv: 1 });
    frame(F, 11.88, 1.65, -15.5, 'x', -1, 1.0, 0.7, 'print1'); frame(F, 11.88, 1.65, -21.8, 'x', -1, 1.0, 0.7, 'print2');
    frame(F, -5.4, 1.65, -15.08, 'z', -1, 0.8, 0.55, 'print2');
  }
  bench(F, 11.55, -19.0, -Math.PI / 2, 0, 1.6, { seats: 2 }); radioCharger(F, 8.68, 1.35, -12.5, 'x', 1, 8); waterCooler(F, 11.65, -24.8, 0);
  wallBoard(F, 8.68, 1.6, -14.1, 'x', 1, 1.3, 0.9, 'cork');
  sign('pd_sign_c', 'POLICE · DISPATCH ↓ · LOBBY ↑', 10.3, 2.85, -8.1, 'z', -1, 2.6);
  sign('pd_sign_disp', 'POLICE DEPARTMENT', 9.9, 2.75, -7.86, 'z', 1, 2.2);
  exitSign(10.3, -8.1, 'z', 1); exitSign(-11.945, -26.8, 'x', 1);
  // corridor nav
  for (const [id, z] of [['p_c1', -10.3], ['p_c2', -16.2], ['p_c3', -19.3], ['p_c4', -24.1], ['p_c5', -26.8]]) node(id, 10.3, z);
  node('p_disp', 9.9, -8.8); link('p_disp', 'p_c1', 'p_c2', 'p_c3', 'p_c4', 'p_c5', 'p_lob_door');
  for (const [id, x] of [['p_m7', 7.0], ['p_m3', 2.5], ['p_m1', 0.7], ['p_m0', -1.0], ['p_m-3', -3.3], ['p_m-6', -6.5], ['p_m-7', -7.1], ['p_m-11', -11.0]]) node(id, x, -26.8);
  link('p_c5', 'p_m7', 'p_m3', 'p_m1', 'p_m0', 'p_m-3', 'p_m-6', 'p_m-7', 'p_m-11');
  link('p_m3', 'p_rec_door'); link('p_m0', 'p_obs_door'); link('p_m-6', 'p_ev_door');
  for (const [id, x] of [['p_s7', 7.2], ['p_s3', 3.8], ['p_s2', 2.1], ['p_s-3', -3.7], ['p_s-8', -8.7], ['p_s-10', -10.6]]) node(id, x, -16.2);
  link('p_c2', 'p_s7', 'p_s3', 'p_s2', 'p_s-3', 'p_s-8', 'p_s-10');

  // ------------------------------------------------ restrooms + locker rooms
  for (const [x0, x1, men] of [[-8.6, -4.8, true], [-4.8, -1, false]]) {
    const xm = (x0 + x1) / 2; const tag = men ? 'm' : 'w';
    lamp(xm, -23.4, 'break', 1.0, 0.5); lamp(xm, -19.3, 'break', 1.0, 0.5);
    wainscot(x0, -25.6, x1, -25.6, 'ceramic', 1.5, -1); for (const xx of [x0, x1]) wainscot(xx, -25.6, xx, -21.2, 'ceramic', 1.5, xx === x0 ? 1 : -1);
    // stalls along the west side of the room, opening east (doors face the room)
    const stalls = men ? 2 : 3; const sw = 0.95;
    for (let i = 0; i < stalls; i++) {
      const zs0 = -25.5 + i * sw; // stalls run north→south, each 0.95 wide, 1.5 deep from the side wall
      const d = stallX(F, x0 + 0.08, zs0, 1.5, sw, 0, { id: `pd_stall_${tag}${i}`, accessible: i === stalls - 1 });
      doors.push(d); nav.stalls.push({ id: d.id, gender: tag, x: x0 + 0.08 + 0.75, z: zs0 + sw / 2, door: [x0 + 1.9, zs0 + sw / 2] });
    }
    if (men) { urinal(F, x1 - 0.5, -25.5, 1, 0); urinal(F, x1 - 1.3, -25.5, 1, 0); }
    vanity(F, x1 - 0.08, -22.6, -1, 0, 2, 'x');
    if (D >= 1) { mb('satin').rbox(x1 - 0.12, 1.35, -21.6, 0.12, 0.3, 0.26, { r: 0.03, color: [0.82, 0.82, 0.82] }); mb('satin').rbox(x0 + 0.7, 1.3, -21.33, 0.3, 0.42, 0.1, { r: 0.02, color: [0.8, 0.8, 0.8] }); }
    trashCan(F, xm + 0.4, -21.6);
    // locker zone
    lockerBank(F, xm, -17.735, Math.PI, 0, { n: 9, bench: true });
    mb('mirror').panel(x0 + 0.085, 1.5, -19.5, 1.0, 1.4, 'x', 1);
    sign(`pd_sign_rr${tag}`, men ? "MEN'S ♂ · LOCKERS" : "WOMEN'S ♀ · LOCKERS", xm - (men ? 0 : 0.2), 2.55, -25.48, 'z', 1, 1.6);
    f.interact({ id: `pd_restroom_${tag}`, kind: 'restroom', label: men ? "Wash up at the sink" : "Wash up at the sink", min: [x1 - 0.7, 0.8, -23.6], max: [x1, 1.3, -21.6], pri: 0 });
    f.interact({ id: `pd_lockers_${tag}`, kind: 'pd_lockers', label: men ? "Officer lockers (men's)" : "Officer lockers (women's)", min: [x0 + 0.1, 0, -18.0], max: [x1 - 0.1, 2.0, -17.4], pri: 0 });
    const n0 = `p_rr${tag}`; node(`${n0}_door`, (men ? -7.1 : -3.3), -25.0); node(`${n0}_mid`, x0 + 2.4, -23.6); node(`${n0}_sink`, x1 - 0.85, -22.6, { face: Math.PI / 2 }); node(`${n0}_lock`, xm, -18.9, { face: Math.PI }); node(`${n0}_bench`, xm, -18.25, { sit: 0 });
    link(men ? 'p_m-7' : 'p_m-3', `${n0}_door`, `${n0}_mid`, `${n0}_sink`); link(`${n0}_mid`, `${n0}_lock`, `${n0}_bench`);
    if (men) { node('p_rrm_uri0', x1 - 0.5, -24.9, { face: 0 }); node('p_rrm_uri1', x1 - 1.3, -24.9, { face: 0 }); link('p_rrm_mid', 'p_rrm_uri0'); link('p_rrm_mid', 'p_rrm_uri1'); }
    for (let i = 0; i < stalls; i++) { const zs = -25.5 + i * sw + sw / 2; node(`p_st${tag}${i}_out`, x0 + 2.05, zs); node(`p_st${tag}${i}`, x0 + 0.62, zs, { face: -Math.PI / 2, stall: `pd_stall_${tag}${i}` }); link(`${n0}_mid`, `p_st${tag}${i}_out`, `p_st${tag}${i}`); }
  }

  // ------------------------------------------------ roll call room
  lampsIn(-1, -25.6, 5, -17.4, 'super', 2, 3); vent(2, -21.5);
  podium(F, 2.0, -24.7, Math.PI, 0);
  mb('blackgloss').box(2, 1.9, -25.49, 2.6, 1.5, 0.06, { uv: 0 }); mb('pdBriefing').panel(2, 1.9, -25.457, 2.5, 1.4, 'z', 1);
  for (let row = 0; row < 3; row++) table(F, 2.0, -22.8 + row * 1.75, 0, 0, { w: 4.4, d: 0.6, top: 'laminate', chairs: 0 });
  const rcSeats = [];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) { const x = 0.25 + i * 0.88, z = -22.15 + row * 1.75; stackChair(F, x, z, 0, 0); rcSeats.push([x, z]); }
  wallBoard(F, -0.88, 1.6, -21.5, 'x', 1, 2.4, 1.1, 'whiteboard'); wallBoard(F, 4.88, 1.6, -21.5, 'x', -1, 2.0, 1.0, 'cork');
  flagStand(F, 4.4, -25.0, 0, 'flagUS');
  sign('pd_sign_rollcall', 'ROLL CALL / BRIEFING', 0.7, 2.75, -25.48, 'z', -1, 1.8);
  f.interact({ id: 'pd_rollcall', kind: 'briefing', label: 'Read the roll-call briefing', min: [0.7, 1.0, -25.6], max: [3.3, 2.7, -25.2], pri: 1 });
  node('p_rc_door', 0.7, -25.0); node('p_rc_front', 0.2, -23.7); node('p_rc_podium', 2.0, -24.0, { face: Math.PI }); node('p_rc_back', 3.8, -18.2); node('p_rc_aisle', -0.55, -20.5);
  link('p_m1', 'p_rc_door', 'p_rc_front', 'p_rc_podium'); link('p_rc_front', 'p_rc_aisle', 'p_rc_back', 'p_s3');
  rcSeats.forEach(([x, z], i) => { node(`p_rc_seat${i}`, x, z, { sit: 0 }); link(`p_rc_seat${i}`, i % 5 < 2 || true ? 'p_rc_aisle' : 'p_rc_back'); });
  nav.rollcall = { seats: rcSeats.map((_, i) => `p_rc_seat${i}`), podium: 'p_rc_podium', screen: [2, 1.9, -25.43] };

  // ------------------------------------------------ watch commander + sergeants
  lamp(6.8, -23.5, 'super'); lamp(6.8, -19.4, 'super');
  const dWC = desk(F, 6.6, -24.6, Math.PI, 0, { w: 1.5, d: 0.75, monitors: 2, screenKey: 'scr_cw1', exec: true, guest: 0, lamp: true });
  guestChair(F, 6.2, -22.6, Math.PI, 0); bookcase(F, 5.3, -22.3, Math.PI / 2, 0, { w: 1.2, h: 1.9 });
  frame(F, 8.48, 1.65, -24.4, 'x', -1, 0.7, 0.5, 'print1');
  sign('pd_sign_wc', 'WATCH COMMANDER', 8.72, 2.55, -24.1, 'x', 1, 1.6);
  const dS1 = desk(F, 6.2, -18.9, 0, 0, { w: 1.4, d: 0.65, monitors: 2, screenKey: 'scr_cw0' }); const dS2 = desk(F, 7.6, -20.2, Math.PI, 0, { w: 1.4, d: 0.65, monitors: 1, screenKey: 'scr_cw2' });
  fileCabinet(F, 5.4, -21.0, Math.PI / 2, 0, { drawers: 3 });
  sign('pd_sign_sgt', 'PATROL SERGEANTS', 8.72, 2.55, -19.3, 'x', 1, 1.6);
  f.interact({ id: 'pd_wc_desk', kind: 'pd_desk', who: 'Watch Commander', label: "Look at the Watch Commander's desk", min: [5.8, 0, -25.1], max: [7.4, 1.3, -24.3], pri: 0 });
  node('p_wc_door', 8.0, -24.1); sitNode('p_wc_desk', dWC.chair); node('p_wc_guest', 6.2, -22.6, { sit: Math.PI }); node('p_wc_visit', 7.4, -23.0, { face: 0 });
  link('p_c4', 'p_wc_door', 'p_wc_visit', 'p_wc_desk'); link('p_wc_visit', 'p_wc_guest');
  node('p_sgt_door', 8.0, -19.3); sitNode('p_sgt_d1', dS1.chair); sitNode('p_sgt_d2', dS2.chair); node('p_sgt_mid', 8.0, -19.6);
  link('p_c3', 'p_sgt_door', 'p_sgt_mid', 'p_sgt_d1'); link('p_sgt_mid', 'p_sgt_d2');

  // ------------------------------------------------ janitor closet
  lamp(-10.3, -18.4, 'radio', 0.6, 0.6);
  shelving(F, -11.6, -18.4, Math.PI / 2, 0, { w: 1.6, d: 0.45, h: 1.8 }); mb('satin').cylinder(-9.4, 0.35, -18.6, 0.25, 0.6, 14, { color: [0.85, 0.7, 0.1] }); mb('metal').box(-9.2, 0.45, -19.0, 0.6, 0.9, 0.5);

  // ------------------------------------------------ equipment & gun room
  lampsIn(-12, -15, -6.5, -8, 'armory', 2, 2);
  gunRack(F, -10.4, -14.6, Math.PI, 0, { n: 7 }); gunRack(F, -7.7, -14.6, Math.PI, 0, { n: 4 });
  vestRack(F, -6.85, -11.6, -Math.PI / 2, 0, 6);
  mb('satin').rbox(-9.3, 0.9, -11.2, 2.2, 0.05, 0.8, { r: 0.01, color: [0.4, 0.42, 0.44] }); mb('satin').box(-9.3, 0.45, -11.2, 2.1, 0.86, 0.75, { faces: 'zZxX', color: [0.2, 0.24, 0.28] }); col(-10.45, -11.65, -8.15, -10.75, 0, 0.95);
  mb('rubber').box(-9.3, 0.93, -11.2, 1.6, 0.01, 0.5); mb('satin').box(-9.6, 0.97, -11.1, 0.22, 0.06, 0.12, { color: [0.05, 0.05, 0.05] });
  mb('satin').cylinder(-7.2, 0.45, -8.7, 0.25, 0.9, 16, { color: [0.15, 0.18, 0.2] }); mb('safety').cylinder(-7.2, 0.91, -8.7, 0.26, 0.02, 16); col(-7.5, -9, -6.9, -8.4, 0, 0.9); // clearing barrel
  radioCharger(F, -11.88, 1.3, -12.6, 'x', 1, 6);
  sign('pd_sign_gun', 'EQUIPMENT & GUN ROOM', -8.75, 2.55, -15.12, 'z', -1, 1.8); sign('pd_sign_gun2', 'RANGE ↵ · EYES & EARS', -11.88, 2.5, -10, 'x', 1, 1.6);
  f.interact({ id: 'pd_armory', kind: 'armory', label: 'Gun room – check out training equipment', min: [-11.5, 0, -15], max: [-6.5, 2.1, -14.1], pri: 1 });
  f.interact({ id: 'pd_rangedoor', kind: 'range', label: 'Go out onto the range (training)', min: [-12.3, 0, RANGE_DOOR[0]], max: [-11.6, 2.3, RANGE_DOOR[1]], pri: 2 });
  node('p_gun_door', -8.7, -14.4); node('p_gun_rack', -10.2, -13.8, { face: Math.PI }); node('p_gun_bench', -9.3, -10.4, { face: 0 }); node('p_gun_range', -11.4, -10, {}); node('p_range_in', -12.8, -10, {});
  link('p_s-8', 'p_gun_door', 'p_gun_rack'); link('p_gun_door', 'p_gun_bench', 'p_gun_range', 'p_range_in');
  nav.rangeLink = ['p_range_in', 'range_line'];

  // ------------------------------------------------ break room
  lampsIn(-6.5, -15, 5, -8, 'break', 3, 2);
  kitchenette(F, -6.3, -2.2, -8.1, -1, 0, {});
  doors.push(fridge(F, -1.6, -8.42, -1, 0, { id: 'pd_fridge' }));
  vendingMachine(F, -0.4, -8.5, -1, 0, { id: 'pd_vending' }); vendingMachine(F, 0.6, -8.5, -1, 0, { id: 'pd_vending2', drinks: true });
  const brSeats = table(F, -3.4, -11.6, 0, 0, { w: 1.8, d: 0.9, top: 'wood', chairs: 6, chairType: 'stack' });
  const brRound = table(F, 0.4, -11.8, 0, 0, { w: 1.0, round: true, top: 'wood', chairs: 4, chairType: 'stack' });
  sofa(F, 2.7, -11.6, -Math.PI / 2, 0, { w: 2.1 });
  mb('blackgloss').box(4.92, 2.0, -11.6, 0.06, 0.95, 1.6, { uv: 0 }); screen('pd_break_tv', 'tv', 4.885, 2.0, -11.6, 1.5, 0.86, 'x', -1, 0, { shared: 'scr_tv' });
  wallBoard(F, -6.38, 1.6, -11.8, 'x', 1, 1.6, 1.0, 'cork'); trashCan(F, 1.5, -8.5, 0, 'recycle'); trashCan(F, -6.1, -9.8); plantPot(F, 4.4, -14.4, 0, 0.9);
  sign('pd_sign_break', 'BREAK ROOM', -1.0, 2.55, -15.12, 'z', -1, 1.4);
  f.interact({ id: 'pd_break_tv', kind: 'tv', label: 'Watch the news', min: [4.7, 1.4, -12.5], max: [5.0, 2.6, -10.7], pri: 0 });
  node('p_br_door1', -3.7, -14.4); node('p_br_door2', 2.1, -14.4); node('p_br_mid', -1.0, -10.6); node('p_br_coffee', -3.1, -9.0, { face: 0 + Math.PI }); node('p_br_micro', -5.9, -9.0, { face: Math.PI });
  node('p_br_fridge', -1.6, -9.3, { face: Math.PI, fridge: 'pd_fridge' }); node('p_br_vend', -0.4, -9.4, { face: Math.PI }); node('p_br_vend2', 0.6, -9.4, { face: Math.PI });
  link('p_s-3', 'p_br_door1', 'p_br_mid'); link('p_s2', 'p_br_door2', 'p_br_mid'); link('p_br_mid', 'p_br_coffee', 'p_br_micro'); link('p_br_mid', 'p_br_fridge'); link('p_br_mid', 'p_br_vend'); link('p_br_mid', 'p_br_vend2');
  brSeats.forEach((pose, i) => { sitNode(`p_br_t${i}`, pose); link('p_br_mid', `p_br_t${i}`); });
  brRound.forEach((pose, i) => { sitNode(`p_br_r${i}`, pose); link('p_br_mid', `p_br_r${i}`); });
  node('p_br_sofa', 2.66, -11.6, { sit: -Math.PI / 2 }); link('p_br_mid', 'p_br_sofa'); node('p_br_chat', 1.8, -10.0, { face: Math.PI / 2 }); link('p_br_mid', 'p_br_chat');

  // ======================================================================= STAIRS
  for (const s of STAIRS) buildStair(s);
  function buildStair(s) {
    mb = mbZone('pd1'); Y = 0;
    const [bx0, bz0, bx1, bz1] = s.box; const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
    const flight = (fl, y0, y1) => {
      const n = 11; const dir = Math.sign(fl.to - fl.at); const run = Math.abs(fl.to - fl.at) / n; const rise = (y1 - y0) / n; const w = fl.x1 - fl.x0; const xm = (fl.x0 + fl.x1) / 2;
      for (let i = 0; i < n; i++) {
        const z = fl.at + dir * run * (i + 0.5); const top = y0 + rise * (i + 1);
        mb('terrazzo').box(xm, top - rise / 2, z, w, rise, run, { uv: 1.2 });
        if (D >= 1) mb('rubber').box(xm, top + 0.004, fl.at + dir * run * (i + 1) - dir * 0.03, w, 0.01, 0.06, { uv: 0 });
      }
      // soffit under the flight + stringers + handrail
      const L = Math.hypot(fl.to - fl.at, y1 - y0); const ang = Math.atan2(y1 - y0, Math.abs(fl.to - fl.at)); const zm = (fl.at + fl.to) / 2, ym = (y0 + y1) / 2;
      mb('wall').rbox(xm, ym - 0.18, zm, w, 0.12, L, { rotX: dir > 0 ? -ang : ang, r: 0.01, uv: 2 });
      for (const sx of [fl.x0, fl.x1]) { mb('frame').rbox(sx, ym + 0.95, zm, 0.04, 0.04, L, { rotX: dir > 0 ? -ang : ang, r: 0.015, uv: 0 }); for (let i = 0; i <= 4; i++) { const t = i / 4; mb('frame').box(sx, y0 + (y1 - y0) * t + 0.48, fl.at + (fl.to - fl.at) * t, 0.025, 0.95, 0.025); } }
    };
    flight(s.flight1, 0, F2 / 2); flight(s.flight2, F2 / 2, F2);
    // landing slab + its underside
    const [lx0, lz0, lx1, lz1] = s.landing; mb('terrazzo').box((lx0 + lx1) / 2, F2 / 2 - 0.1, (lz0 + lz1) / 2, lx1 - lx0, 0.2, lz1 - lz0, { uv: 1.2 }); mb('ceiling').box((lx0 + lx1) / 2, F2 / 2 - 0.21, (lz0 + lz1) / 2, lx1 - lx0, 0.02, lz1 - lz0, { faces: 'y', uv: 1.2 });
    // core wall between the flights (full height, both floors) and the enclosure under flight 2
    const [cx0, cz0, cx1, cz1] = s.core; mb('wall').box((cx0 + cx1) / 2, F2 / 2 + 1.0, (cz0 + cz1) / 2, cx1 - cx0, F2 + 2.0, cz1 - cz0, { uv: 2 }); colRaw(cx0 - 0.02, cz0, cx1 + 0.02, cz1, 0, F2 + 3);
    { const fl = s.flight2; mb('wall').box((fl.x0 + fl.x1) / 2, F2 / 4, (fl.at + fl.to) / 2, fl.x1 - fl.x0, F2 / 2, Math.abs(fl.to - fl.at), { faces: 'xXzZ', uv: 2 }); colRaw(fl.x0, Math.min(fl.at, fl.to), fl.x1, Math.max(fl.at, fl.to), 0, F2 / 2 - 0.05); }
    // stairwell walls up through both floors are the room walls; add the 2nd-floor guard rail over flight 1
    const [gx0, gz0, gx1, gz1] = s.guard; mb('frame').box((gx0 + gx1) / 2, F2 + 1.0, (gz0 + gz1) / 2, gx1 - gx0, 0.05, 0.05); mb('glass').panel((gx0 + gx1) / 2, F2 + 0.55, (gz0 + gz1) / 2, gx1 - gx0, 0.9, 'z', 1);
    for (const gx of [gx0 + 0.05, gx1 - 0.05]) mb('frame').box(gx, F2 + 0.5, (gz0 + gz1) / 2, 0.04, 1.0, 0.04);
    colRaw(gx0, gz0 - 0.03, gx1, gz1 + 0.03, F2, F2 + 1.1);
    // slab edge around the hole (visible from the stairwell) + lights on both levels and the landing
    const [hx0, hz0, hx1, hz1] = s.hole; mb = mbZone('pd2'); mb('ceiling').box(cx, F2 + CH + 0.05, cz, bx1 - bx0, 0.1, bz1 - bz0, { faces: 'y', uv: 1.2 }); mb = mbZone('pd1');
    // fill the slab thickness (3.6 – 4.0) around the stairwell walls and along the open edge of the hole
    for (const [x0, z0, x1, z1] of [[bx0, bz0, bx1, bz0], [bx0, bz1, bx1, bz1], [bx0, bz0, bx0, bz1], [bx1, bz0, bx1, bz1]]) mb('wall').wall(x0, z0, x1, z1, CH, F2, 0.18, { uv: 2 });
    { const ez = Math.abs(hz0 - bz0) < 0.01 ? hz1 : hz0; mb('wall').box((hx0 + hx1) / 2, (CH + F2) / 2, ez, hx1 - hx0, F2 - CH, 0.06, { uv: 2 }); }
    lights.push({ pos: [cx, F2 / 2 + 1.6, cz], room: 'corridor', base: 1, range: 5.6, dim: 0.7 }); lights.push({ pos: [cx, F2 + CH - 0.4, cz], room: 'corridor', base: 1, range: 5.6, dim: 0.7 });
    mb('lightpanel').box(cx, F2 + CH - 0.003, cz, 1.0, 0.006, 0.5, { faces: 'y', uv: 0 });
    { const wz = Math.abs(s.landing[1] - s.box[1]) < 0.2 ? s.box[1] + 0.11 : s.box[3] - 0.11; mb('lightpanel').box((s.landing[0] + s.landing[2]) / 2, F2 / 2 + 2.2, wz, 0.6, 0.14, 0.06, { uv: 0 }); }
    // stair signs + nav
    sign(`pd_sign_stair${s.id}`, `STAIR ${s.id} · FLOORS 1–2`, s.id === 'A' ? 8.68 : -10.9, 2.55, s.id === 'A' ? -10.5 : -25.68, s.id === 'A' ? 'x' : 'z', s.id === 'A' ? 1 : -1, 1.6);
    const f1 = s.flight1, f2 = s.flight2; const sid = `p_st${s.id}`;
    const xm1 = (f1.x0 + f1.x1) / 2, xm2 = (f2.x0 + f2.x1) / 2;
    node(`${sid}_b0`, xm1, f1.at + Math.sign(f1.at - f1.to) * 0.5, { y: 0 }); node(`${sid}_b1`, xm1, f1.to - Math.sign(f1.at - f1.to) * 0.15, { y: F2 / 2 });
    node(`${sid}_land`, (lx0 + lx1) / 2, (lz0 + lz1) / 2, { y: F2 / 2 }); node(`${sid}_c0`, xm2, f2.at - Math.sign(f2.at - f2.to) * 0.15, { y: F2 / 2 }); node(`${sid}_c1`, xm2, f2.to + Math.sign(f2.to - f2.at) * 0.5, { y: F2 });
    link(`${sid}_b0`, `${sid}_b1`, `${sid}_land`, `${sid}_c0`, `${sid}_c1`);
  }
  // stair entries: A from corridor C (both floors), B from the north corridors (both floors)
  node('p_stA_door', 8.2, -8.9, { y: 0 }); link('p_c1', 'p_stA_door', 'p_stA_b0');
  node('p_stB_door', -11.0, -25.0, { y: 0 }); link('p_m-11', 'p_stB_door', 'p_stB_b0');

  // ======================================================================= SECOND FLOOR
  level(1);
  // slab underside already = ground-floor ceilings; the floor-2 floor surfaces:
  room(-12, -40, -5, -33, 'officeCarpet'); room(-12, -33, -5, -28, 'officeCarpet');           // chief + executive assistant
  room(-5, -40, -0.5, -33, 'officeCarpet'); room(-0.5, -40, 4, -33, 'officeCarpet'); room(-5, -33, 4, -28, 'officeCarpet'); // asst chief, captain, admin
  room(4, -40, 12, -28, 'wood');                                                               // conference room (wood floor)
  room(-12, -28, 8.6, -25.6, 'terrazzo', 2.4); room(8.6, -28, 12, -8, 'terrazzo', 2.4); room(-12, -17.4, 8.6, -15, 'terrazzo', 2.4); // corridors
  room(-8.6, -25.6, -1, -17.4, 'plank'); room(-1, -25.6, 5, -17.4, 'officeCarpet'); room(5, -25.6, 8.6, -17.4, 'officeCarpet'); // training, bullpen, DS + IR1
  room(-12, -19.4, -8.6, -17.4, 'tile');                                                       // unisex restroom
  room(-12, -15, -6.5, -8, 'officeCarpet'); room(-6.5, -15, -1, -8, 'officeCarpet'); room(-1, -15, 5, -8, 'officeCarpet'); // major case, detectives, HR
  for (const s of STAIRS) { const [x0, z0, x1, z1] = s.box; const [hx0, hz0, hx1, hz1] = s.hole; // top landing floor = box minus hole
    for (const r of subtract([x0, z0, x1, z1], [[hx0, hz0, hx1, hz1]])) floor(r[0], r[1], r[2], r[3], 'terrazzo', 2.4); }
  // exterior walls (windows all round)
  wall(-12, -40, 12, -40, [[-11, -9, 'ext', { inSide: 1 }], [-8, -6, 'ext', { inSide: 1 }], [-4.2, -1.4, 'ext', { inSide: 1 }], [0.6, 3.2, 'ext', { inSide: 1 }], [5, 7.6, 'ext', { inSide: 1 }], [8.4, 11, 'ext', { inSide: 1 }]]);
  wall(12, -40, 12, -8, [[-38.6, -36, 'ext', { inSide: -1 }], [-32.6, -29.4, 'ext', { inSide: -1 }], [-26.4, -23.2, 'ext', { inSide: -1 }], [-20.4, -17.2, 'ext', { inSide: -1 }], [-13.6, -10.6, 'ext', { inSide: -1 }]]);
  wall(-12, -40, -12, -8, [[-39, -36.6, 'ext', { inSide: 1 }], [-31.6, -29.2, 'ext', { inSide: 1 }], [-14.2, -11.8, 'ext', { inSide: 1 }], [-10.6, -8.6, 'ext', { inSide: 1 }]]);
  wall(-12, -8, 12, -8, [[-11.2, -9, 'ext', { inSide: -1 }], [-5.8, -3.6, 'ext', { inSide: -1 }], [0, 3.4, 'ext', { inSide: -1 }], [9.4, 11.4, 'ext', { inSide: -1 }]]);
  // interior
  wall(-12, -28, 4, -28, [[-9, -8, 'door', { side: -1 }], [-2.2, -1, 'door', { side: -1 }], [2, 3, 'glass']]);
  wall(4, -28, 12, -28, [[9.6, 10.8, 'door', { side: 1 }]]);
  wall(-12, -33, -5, -33, [[-7.2, -6.2, 'door', { side: -1 }]]); wall(-5, -33, 4, -33, [[-3.4, -2.4, 'door', { side: -1 }], [1.0, 2.0, 'door', { side: -1 }]]);
  wall(-5, -40, -5, -28); wall(-0.5, -40, -0.5, -33); wall(4, -40, 4, -28, [[-31.4, -30.4, 'door', { side: 1 }], [-38, -34.5, 'glass']]);
  wall(-12, -25.6, 8.6, -25.6, [[-11.6, -10.4, 'door', { side: 1 }], [-7.6, -6.6, 'door', { side: 1 }], [-3.2, -2.2, 'door', { side: 1 }], [-0.6, 0.6, 'door', { side: 1 }], [1.6, 4.4, 'glass']]);
  wall(-8.6, -25.6, -8.6, -17.4); wall(-1, -25.6, -1, -17.4); wall(5, -25.6, 5, -17.4); wall(5, -21.4, 8.6, -21.4);
  wall(8.6, -25.6, 8.6, -17.4, [[-24.6, -23.6, 'door', { side: 1 }], [-19.8, -18.8, 'door', { side: 1 }]]);
  wall(-12, -19.4, -8.6, -19.4);
  wall(-12, -17.4, 8.6, -17.4, [[-11.1, -10.2, 'door', { side: -1 }], [3.6, 4.6, 'door', { side: 1 }]]);
  wall(-12, -15, 8.6, -15, [[-9.3, -8.3, 'door', { side: 1 }], [-5.6, -4.7, 'door', { side: 1 }], [-2.9, -2.0, 'door', { side: 1 }], [1.6, 2.6, 'door', { side: 1 }]]);
  wall(-6.5, -15, -6.5, -8); wall(-3.75, -15, -3.75, -8); wall(-1, -15, -1, -8); wall(5, -15, 5, -8);
  wall(8.6, -15, 8.6, -8, [[-9.5, -8.3, 'door', { side: -1 }]]);

  // ------------------------------------------------ chief's suite
  lampsIn(-12, -40, -5, -33, 'director', 2, 2); lampsIn(-12, -33, -5, -28, 'super', 2, 1);
  const dChief = desk(F, -8.5, -38.2, Math.PI, F2, { w: 2.0, d: 0.95, wood: 'woodDark', monitors: 1, screenKey: 'scr_cw2', exec: true, guest: 2, lamp: true });
  credenza(F, -8.5, -39.6, 0, F2, { w: 2.2 }); flagStand(F, -11.3, -39.4, F2, 'flagUS'); flagStand(F, -5.7, -39.4, F2, 'flagIL');
  bookcase(F, -11.75, -35.5, -Math.PI / 2, F2, { w: 1.6, h: 2.1, wood: 'woodDark' }); sofa(F, -6.1, -34.6, Math.PI / 2, F2, { w: 1.9, seats: 2, color: 'fabricBlue' });
  table(F, -7.4, -34.6, 0, F2, { w: 0.9, d: 0.5, h: 0.42, top: 'woodDark' }); mb('seal').panel(-8.5, F2 + 2.3, -39.915, 0.9, 0.9, 'z', 1);
  frame(F, -11.92, F2 + 1.6, -34.0, 'x', 1, 0.9, 0.6, 'print1'); plantPot(F, -5.4, -33.4, F2, 1.0);
  f.interact({ id: 'pd_chief_desk', kind: 'pd_desk', who: 'Chief of Police', label: "Look at the Chief's desk", min: [-9.5, F2, -38.5], max: [-7.5, F2 + 1.3, -37.5], pri: 0 });
  const dEA = desk(F, -9.5, -30.6, 0, F2, { w: 1.6, d: 0.75, monitors: 2, screenKey: 'scr_cw1' }); fileCabinet(F, -11.6, -29.0, Math.PI / 2, F2, { drawers: 4, w: 0.9 }); beamSeating(F, -6.2, -28.5, Math.PI, F2, 2);
  sign('pd_sign_chief', 'OFFICE OF THE CHIEF OF POLICE', -8.5, F2 + 2.55, -27.88, 'z', 1, 2.6);
  node('p2_chief_door', -8.5, -28.6); sitNode('p2_ea_desk', dEA.chair); node('p2_chief_front', -7.4, -31.4); node('p2_chief_door2', -6.7, -33.6);
  sitNode('p2_chief_desk', dChief.chair); node('p2_chief_mid', -7.0, -35.8); sitNode('p2_chief_g0', dChief.guests[0]); sitNode('p2_chief_g1', dChief.guests[1]); node('p2_chief_sofa', -6.12, -34.6, { sit: Math.PI / 2 }); node('p2_chief_behind', -6.9, -38.6);
  link('p2_chief_door', 'p2_chief_front', 'p2_ea_desk'); link('p2_chief_front', 'p2_chief_door2', 'p2_chief_mid', 'p2_chief_behind', 'p2_chief_desk'); link('p2_chief_mid', 'p2_chief_g0'); link('p2_chief_mid', 'p2_chief_g1'); link('p2_chief_mid', 'p2_chief_sofa');

  // ------------------------------------------------ assistant chief, captain, admin offices
  lampsIn(-5, -40, -0.5, -33, 'director', 1, 2); lampsIn(-0.5, -40, 4, -33, 'director', 1, 2); lampsIn(-5, -33, 4, -28, 'super', 3, 1);
  const dAC = desk(F, -2.75, -38.4, Math.PI, F2, { w: 1.7, d: 0.85, wood: 'woodDark', monitors: 1, screenKey: 'scr_cw0', exec: true, guest: 2, lamp: true }); bookcase(F, -4.75, -35.0, -Math.PI / 2, F2, { w: 1.2, wood: 'woodDark' }); plantPot(F, -1.0, -33.7, F2, 0.9);
  const dCap = desk(F, 1.75, -38.4, Math.PI, F2, { w: 1.7, d: 0.85, wood: 'woodDark', monitors: 2, screenKey: 'scr_cw1', exec: true, guest: 2, lamp: true }); bookcase(F, 3.75, -35.0, Math.PI / 2, F2, { w: 1.2, wood: 'woodDark' }); flagStand(F, 3.5, -39.5, F2, 'flagUS');
  frame(F, -2.75, F2 + 1.7, -39.88, 'z', 1, 1.0, 0.6, 'print2'); frame(F, 1.75, F2 + 1.7, -39.88, 'z', 1, 1.0, 0.6, 'print1');
  const dAdm = [[-3.6, 0], [-1.2, 0], [1.4, 0]].map(([x, r]) => desk(F, x, -31.0, r, F2, { w: 1.4, d: 0.7, wood: 'laminate', monitors: 2, screenKey: 'scr_cw2' }));
  copier(F, 3.4, -32.4, -Math.PI / 2, F2); fileCabinet(F, -4.6, -32.3, Math.PI / 2, F2, { drawers: 4 });
  sign('pd_sign_admin', 'ADMINISTRATION · ASSISTANT CHIEF · CAPTAIN', -0.5, F2 + 2.55, -27.88, 'z', 1, 3.6);
  f.interact({ id: 'pd_captain_desk', kind: 'pd_desk', who: 'Captain', label: "Look at the Captain's desk", min: [0.9, F2, -38.9], max: [2.6, F2 + 1.3, -37.9], pri: 0 });
  f.interact({ id: 'pd_ac_desk', kind: 'pd_desk', who: 'Assistant Chief', label: "Look at the Assistant Chief's desk", min: [-3.6, F2, -38.9], max: [-1.9, F2 + 1.3, -37.9], pri: 0 });
  node('p2_adm_door', -1.6, -28.6); node('p2_adm_door2', 2.5, -28.6); node('p2_adm_mid', 0.2, -29.0); dAdm.forEach((d, i) => sitNode(`p2_adm_d${i}`, d.chair)); node('p2_adm_copier', 2.8, -32.4, { face: Math.PI / 2 });
  link('p2_adm_door', 'p2_adm_mid', 'p2_adm_door2'); link('p2_adm_mid', 'p2_adm_d0'); link('p2_adm_mid', 'p2_adm_d1'); link('p2_adm_mid', 'p2_adm_d2'); link('p2_adm_mid', 'p2_adm_copier');
  node('p2_ac_door', -2.9, -33.6); node('p2_ac_mid', -2.0, -35.6); sitNode('p2_ac_desk', dAC.chair); sitNode('p2_ac_g', dAC.guests[0]); node('p2_ac_behind', -1.3, -39.2);
  link('p2_adm_mid', 'p2_ac_door', 'p2_ac_mid', 'p2_ac_behind', 'p2_ac_desk'); link('p2_ac_mid', 'p2_ac_g');
  node('p2_cap_door', 1.5, -33.6); node('p2_cap_mid', 1.0, -35.6); sitNode('p2_cap_desk', dCap.chair); sitNode('p2_cap_g', dCap.guests[0]); node('p2_cap_behind', 3.2, -39.2);
  link('p2_adm_mid', 'p2_cap_door', 'p2_cap_mid', 'p2_cap_behind', 'p2_cap_desk'); link('p2_cap_mid', 'p2_cap_g');

  // ------------------------------------------------ conference room
  lampsIn(4, -40, 12, -28, 'director', 2, 3);
  const confSeats = table(F, 8.2, -34.2, Math.PI / 2, F2, { w: 4.4, d: 1.4, top: 'woodDark', chairs: 10, chairType: 'office' });
  mb('blackgloss').box(8.2, F2 + 1.8, -39.89, 2.4, 1.36, 0.06, { uv: 0 }); screen('pd_conf_tv', 'tv', 8.2, F2 + 1.8, -39.858, 2.3, 1.28, 'z', 1, 0, { shared: 'scr_tv' });
  credenza(F, 11.65, -34.2, -Math.PI / 2, F2, { w: 2.4 }); plantPot(F, 4.6, -39.4, F2, 1.0); plantPot(F, 11.4, -28.6, F2, 0.9);
  sign('pd_sign_conf', 'COMMAND CONFERENCE ROOM', 10.2, F2 + 2.55, -27.88, 'z', 1, 2.4);
  node('p2_conf_door', 10.2, -28.6); node('p2_conf_mid', 10.6, -31.0); node('p2_conf_w', 6.0, -31.0);
  link('p2_conf_door', 'p2_conf_mid', 'p2_conf_w'); node('p2_conf_door2', 4.6, -30.9); link('p2_conf_w', 'p2_conf_door2', 'p2_adm_mid');
  confSeats.forEach((pose, i) => { sitNode(`p2_conf_s${i}`, pose); link(`p2_conf_s${i}`, pose[0] < 8.2 ? 'p2_conf_w' : 'p2_conf_mid'); });

  // ------------------------------------------------ corridors (2nd)
  lampsIn(-12, -28, 8.6, -25.6, 'corridor', 5, 1); lampsIn(8.6, -28, 12, -8, 'corridor', 1, 5); lampsIn(-12, -17.4, 8.6, -15, 'corridor', 5, 1);
  bench(F, 11.55, -21.0, -Math.PI / 2, F2, 1.6, { seats: 2 }); plantPot(F, 11.5, -16.0, F2, 0.9); waterCooler(F, 11.65, -26.6, F2);
  for (const z of [-21.8, -15.4]) frame(F, 11.9, F2 + 1.65, z, 'x', -1, 1.0, 0.7, z < -20 ? 'print2' : 'print1');
  exitSign(10.3, -8.1, 'z', 1); exitSign(-11.945, -26.8, 'x', 1);
  for (const [id, z] of [['p2_c1', -10.3], ['p2_c2', -16.2], ['p2_c3', -19.3], ['p2_c4', -24.1], ['p2_c5', -26.8], ['p2_c6', -28.0 + 0.0 - 0.0]]) node(id, 10.3, z);
  link('p2_c1', 'p2_c2', 'p2_c3', 'p2_c4', 'p2_c5'); link('p2_c5', 'p2_conf_door');
  for (const [id, x] of [['p2_m7', 7.0], ['p2_m2', 2.5], ['p2_m0', 0.0], ['p2_m-2', -1.6], ['p2_m-3', -2.7], ['p2_m-7', -7.1], ['p2_m-8', -8.5], ['p2_m-11', -11.0]]) node(id, x, -26.8);
  link('p2_c5', 'p2_m7', 'p2_m2', 'p2_m0', 'p2_m-2', 'p2_m-3', 'p2_m-7', 'p2_m-8', 'p2_m-11');
  link('p2_m-8', 'p2_chief_door'); link('p2_m-2', 'p2_adm_door'); link('p2_m2', 'p2_adm_door2');
  for (const [id, x] of [['p2_s7', 7.2], ['p2_s4', 4.1], ['p2_s2', 2.1], ['p2_s-2', -2.45], ['p2_s-5', -5.15], ['p2_s-8', -8.8], ['p2_s-10', -10.6]]) node(id, x, -16.2);
  link('p2_c2', 'p2_s7', 'p2_s4', 'p2_s2', 'p2_s-2', 'p2_s-5', 'p2_s-8', 'p2_s-10');
  node('p_stA_door2', 8.2, -8.9, { y: F2 }); link('p2_c1', 'p_stA_door2', 'p_stA_c1');
  node('p_stB_door2', -11.0, -25.0, { y: F2 }); link('p2_m-11', 'p_stB_door2', 'p_stB_c1');

  // ------------------------------------------------ training room
  lampsIn(-8.6, -25.6, -1, -17.4, 'super', 2, 3);
  for (let row = 0; row < 3; row++) table(F, -4.8, -22.6 + row * 1.8, 0, F2, { w: 3.6, d: 0.6, top: 'laminate', chairs: 0 });
  const trSeats = [];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) { const x = -6.15 + i * 0.9, z = -21.95 + row * 1.8; stackChair(F, x, z, 0, F2); trSeats.push([x, z]); }
  mb('white').box(-4.8, F2 + 1.9, -25.505, 3.0, 1.7, 0.03, { uv: 0 }); mb('pdTraining').panel(-4.8, F2 + 1.9, -25.487, 2.8, 1.58, 'z', 1);
  mb('white').rbox(-4.8, F2 + 3.3, -22.5, 0.36, 0.12, 0.3, { r: 0.03, uv: 0 }); mb('chrome').cylinder(-4.8, F2 + 3.45, -22.5, 0.015, 0.28, 6); mb('chrome').box(-4.8, F2 + CH - 0.005, -22.5, 0.12, 0.01, 0.12); // projector on a ceiling mount
  desk(F, -7.6, -24.5, Math.PI, F2, { w: 1.3, d: 0.65, monitors: 1, screenKey: 'scr_cw0', chair: false, wood: 'laminate' });
  for (let i = 0; i < 3; i++) { const x = -2.0, z = -24.8 + i * 0.75; mb('matte').rbox(x, F2 + 0.09, z, 0.6, 0.18, 0.35, { r: 0.08, color: [0.85, 0.7, 0.55] }); mb('matte').sphere(x - 0.36, F2 + 0.11, z, 0.11, 10, 8, { color: [0.85, 0.7, 0.55] }); } // CPR mannequins
  wallBoard(F, -8.48, F2 + 1.6, -21.5, 'x', 1, 2.6, 1.1, 'whiteboard');
  sign('pd_sign_training', 'TRAINING ROOM', -5.0, F2 + 2.55, -25.68, 'z', -1, 1.6);
  f.interact({ id: 'pd_training', kind: 'training', label: 'Training room – look at today\'s course', min: [-6.3, F2 + 1.0, -25.6], max: [-3.3, F2 + 2.8, -25.3], pri: 1 });
  node('p2_tr_door', -7.1, -25.0); node('p2_tr_door2', -2.7, -25.0); node('p2_tr_front', -4.8, -24.2, { face: Math.PI }); node('p2_tr_aisle', -7.8, -20.6);
  link('p2_m-7', 'p2_tr_door', 'p2_tr_front', 'p2_tr_door2', 'p2_m-3'); link('p2_tr_door', 'p2_tr_aisle');
  trSeats.forEach(([x, z], i) => { node(`p2_tr_seat${i}`, x, z, { sit: 0 }); link(`p2_tr_seat${i}`, 'p2_tr_aisle'); });

  // ------------------------------------------------ detective bullpen, detective sergeant, investigation room 1
  lampsIn(-1, -25.6, 5, -17.4, 'super', 2, 3);
  const cid = cubicles(F, 2.0, -21.3, 0, F2, { n: 2, screenKey: 'scr_cw0' });
  wallBoard(F, 4.88, F2 + 1.6, -21.4, 'x', -1, 2.6, 1.1, 'cork'); copier(F, -0.5, -18.2, Math.PI / 2, F2); fileCabinet(F, -0.6, -24.9, Math.PI / 2, F2, { drawers: 4 });
  sign('pd_sign_cid', 'CRIMINAL INVESTIGATIONS · DETECTIVES', 2.0, F2 + 2.55, -25.68, 'z', -1, 3.2);
  node('p2_cid_door', 0, -25.0); node('p2_cid_door2', 4.1, -17.9); node('p2_cid_aisle', -0.4, -21.3); node('p2_cid_aisle2', 4.4, -21.3);
  link('p2_m0', 'p2_cid_door', 'p2_cid_aisle'); link('p2_s4', 'p2_cid_door2', 'p2_cid_aisle2');
  node('p2_cid_n', 2.0, -23.6); node('p2_cid_s', 2.0, -19.0); link('p2_cid_aisle', 'p2_cid_n', 'p2_cid_aisle2', 'p2_cid_s', 'p2_cid_aisle');
  cid.forEach((pose, i) => { sitNode(`p2_cid_d${i}`, pose); link(`p2_cid_d${i}`, pose[1] < -21.3 ? 'p2_cid_n' : 'p2_cid_s'); });
  node('p2_cid_board', 4.3, -21.4 + 0.0, { face: -Math.PI / 2 }); link('p2_cid_aisle2', 'p2_cid_board');
  lamp(6.8, -23.5, 'super'); lamp(6.8, -19.4, 'super');
  const dDS = desk(F, 6.6, -24.2, Math.PI, F2, { w: 1.5, d: 0.75, monitors: 2, screenKey: 'scr_cw2', guest: 0, lamp: true }); guestChair(F, 6.4, -22.6, Math.PI, F2); fileCabinet(F, 5.4, -22.4, Math.PI / 2, F2, { drawers: 3 });
  sign('pd_sign_ds', 'DETECTIVE SERGEANT', 8.72, F2 + 2.55, -24.1, 'x', 1, 1.6);
  table(F, 6.8, -19.4, Math.PI / 2, F2, { w: 1.6, d: 0.9, top: 'laminate', chairs: 3, chairType: 'office' }); wallBoard(F, 5.12, F2 + 1.6, -19.4, 'x', 1, 2.6, 1.1, 'cork');
  for (let i = 0; i < 6; i++) mb(['paper', 'print1', 'print2'][i % 3]).box(5.16, F2 + 1.45 + (i % 2) * 0.32, -20.4 + i * 0.38, 0.01, 0.22, 0.28, { uv: 0 });
  sign('pd_sign_ir1', 'INVESTIGATION ROOM 1', 8.72, F2 + 2.55, -19.3, 'x', 1, 1.8);
  f.interact({ id: 'pd_invest2', kind: 'investigation', label: 'Investigation room – review the case board', min: [5.0, F2 + 0.9, -20.8], max: [5.4, F2 + 2.3, -18], pri: 1 });
  node('p2_ds_door', 8.0, -24.1); sitNode('p2_ds_desk', dDS.chair); node('p2_ds_visit', 7.4, -23.0, { face: 0 }); node('p2_ds_guest', 6.4, -22.6, { sit: Math.PI });
  link('p2_c4', 'p2_ds_door', 'p2_ds_visit', 'p2_ds_desk'); link('p2_ds_visit', 'p2_ds_guest');
  node('p2_ir1_door', 8.0, -19.3); node('p2_ir1_board', 5.8, -19.6, { face: -Math.PI / 2 }); node('p2_ir1_mid', 7.6, -18.1);
  link('p2_c3', 'p2_ir1_door', 'p2_ir1_mid', 'p2_ir1_board');

  // ------------------------------------------------ unisex restroom (2nd floor)
  lamp(-10.3, -18.4, 'break', 0.6, 0.6); wainscot(-12, -19.4, -8.6, -19.4, 'ceramic', 1.5, 1);
  mb('porcelain').rbox(-11.55, F2 + 0.2, -18.55, 0.24, 0.4, 0.34, { r: 0.08, uv: 0 }); mb('porcelain').rbox(-11.4, F2 + 0.38, -18.55, 0.5, 0.06, 0.38, { r: 0.12, uv: 0 }); mb('white').rbox(-11.4, F2 + 0.42, -18.55, 0.44, 0.025, 0.38, { r: 0.1, uv: 0 });
  colRaw(-11.9, -18.8, -11.0, -18.3, F2, F2 + 0.45); seats.push({ x: -11.3, y: F2 + 0.44, z: -18.55, yaw: -Math.PI / 2, label: 'Sit down', toilet: true, zone: 'pd2' });
  vanity(F, -8.68, -18.4, -1, F2, 1, 'x');
  sign('pd_sign_ws', 'RESTROOM', -10.65, F2 + 2.55, -17.28, 'z', 1, 1.2);
  node('p2_ws_door', -10.65, -16.8); node('p2_ws_in', -10.0, -18.4, { face: -Math.PI / 2 }); link('p2_s-10', 'p2_ws_door', 'p2_ws_in');

  // ------------------------------------------------ major case room, detective offices, admin/HR
  lampsIn(-12, -15, -6.5, -8, 'super', 2, 2); lampsIn(-6.5, -15, -1, -8, 'super', 2, 1); lampsIn(-1, -15, 5, -8, 'super', 2, 2);
  const mcSeats = table(F, -9.25, -11.5, 0, F2, { w: 2.6, d: 1.2, top: 'laminate', chairs: 6, chairType: 'office' });
  wallBoard(F, -11.88, F2 + 1.6, -11.5, 'x', 1, 4.0, 1.2, 'cork'); wallBoard(F, -9.25, F2 + 1.6, -14.88, 'z', -1, 3.0, 1.1, 'whiteboard');
  for (let i = 0; i < 9; i++) mb(['paper', 'print1', 'print2'][i % 3]).box(-11.84, F2 + 1.3 + (i % 3) * 0.3, -13.2 + i * 0.4, 0.01, 0.22, 0.28, { uv: 0 });
  mb('blackgloss').box(-6.6, F2 + 1.8, -11.5, 0.06, 0.95, 1.6, { uv: 0 }); screen('pd_case_tv', 'tv', -6.635, F2 + 1.8, -11.5, 1.5, 0.86, 'x', -1, 0, { shared: 'scr_tv' });
  sign('pd_sign_mcr', 'INVESTIGATION ROOM 2 · MAJOR CASE', -8.8, F2 + 2.55, -15.12, 'z', -1, 2.8);
  f.interact({ id: 'pd_invest3', kind: 'investigation', label: 'Major case room – look at the case wall', min: [-12, F2 + 0.7, -13.6], max: [-11.7, F2 + 2.3, -9.4], pri: 1 });
  const dDet1 = desk(F, -5.1, -10.0, 0, F2, { w: 1.4, d: 0.7, monitors: 2, screenKey: 'scr_cw1', lamp: true }); fileCabinet(F, -6.1, -13.9, Math.PI / 2, F2, { drawers: 3 }); guestChair(F, -5.1, -11.5, Math.PI, F2);
  const dDet2 = desk(F, -2.4, -10.0, 0, F2, { w: 1.4, d: 0.7, monitors: 2, screenKey: 'scr_cw2', lamp: true }); bookcase(F, -1.4, -13.6, Math.PI / 2, F2, { w: 1.0, h: 1.8 }); guestChair(F, -2.4, -11.5, Math.PI, F2);
  sign('pd_sign_det1', 'DETECTIVE', -5.15, F2 + 2.55, -15.12, 'z', -1, 1.2); sign('pd_sign_det2', 'DETECTIVE', -2.45, F2 + 2.55, -15.12, 'z', -1, 1.2);
  const dHR = [[0.6, 0], [3.2, 0]].map(([x, r]) => desk(F, x, -10.0, r, F2, { w: 1.4, d: 0.7, wood: 'laminate', monitors: 2, screenKey: 'scr_cw0' }));
  fileCabinet(F, 4.4, -14.4, -Math.PI / 2, F2, { drawers: 4 }); fileCabinet(F, -0.4, -14.4, Math.PI / 2, F2, { drawers: 4 }); plantPot(F, 4.4, -12.0, F2, 0.9);
  sign('pd_sign_hr', 'ADMINISTRATIVE SERVICES · PAYROLL', 2.1, F2 + 2.55, -15.12, 'z', -1, 2.6);
  node('p2_mc_door', -8.8, -14.4); node('p2_mc_mid', -9.25, -13.4, {}); node('p2_mc_wall', -11.3, -11.5, { face: -Math.PI / 2 }); link('p2_s-8', 'p2_mc_door', 'p2_mc_mid', 'p2_mc_wall');
  mcSeats.forEach((pose, i) => { sitNode(`p2_mc_s${i}`, pose); link(`p2_mc_s${i}`, 'p2_mc_mid'); });
  node('p2_det1_door', -5.15, -14.4); sitNode('p2_det1_desk', dDet1.chair); node('p2_det1_mid', -4.3, -12.4); link('p2_s-5', 'p2_det1_door', 'p2_det1_mid', 'p2_det1_desk');
  node('p2_det2_door', -2.45, -14.4); sitNode('p2_det2_desk', dDet2.chair); node('p2_det2_mid', -1.6, -12.4); link('p2_s-2', 'p2_det2_door', 'p2_det2_mid', 'p2_det2_desk');
  node('p2_hr_door', 2.1, -14.4); node('p2_hr_mid', 1.9, -12.2); sitNode('p2_hr_d0', dHR[0].chair); sitNode('p2_hr_d1', dHR[1].chair); link('p2_s2', 'p2_hr_door', 'p2_hr_mid', 'p2_hr_d0'); link('p2_hr_mid', 'p2_hr_d1');

  level(0);
  // where the PD meets the dispatch floor
  nav.dispatchLink = ['p_disp', 'front_11'];
}

/** Stall along a side wall: stall depth runs along +x from x0, stall width along +z from z0, door on the x0+depth line, opening toward +x. */
function stallX(f, x0, z0, depth, width, _unused, { id, accessible = false } = {}) {
  const { mb } = f; const y = 0; const xf = x0 + depth; const zc = z0 + width / 2;
  const ph = 1.75, pg = 0.22;
  for (const zz of [z0, z0 + width]) { mb('stall').box(x0 + depth / 2, y + pg + ph / 2, zz, depth - 0.02, ph, 0.025, { uv: 0.6 }); mb('chrome').box(xf - 0.15, y + pg / 2, zz, 0.04, pg, 0.04); }
  const doorW = Math.min(0.66, width - 0.22); const piW = (width - doorW) / 2;
  for (const [a, b] of [[z0, z0 + piW], [z0 + width - piW, z0 + width]]) mb('stall').box(xf, y + pg + ph / 2, (a + b) / 2, 0.025, ph, b - a, { uv: 0.6 });
  mb('chrome').box(xf, y + pg + ph + 0.02, zc, 0.04, 0.035, width);
  const tx = x0 + 0.3;
  mb('porcelain').rbox(tx + 0.1, y + 0.2, zc, 0.34, 0.4, 0.24, { r: 0.08, uv: 0 }); mb('porcelain').rbox(tx + 0.22, y + 0.38, zc, 0.5, 0.06, 0.38, { r: 0.12, uv: 0 }); mb('white').rbox(tx + 0.23, y + 0.42, zc, 0.44, 0.025, 0.38, { r: 0.1, uv: 0 });
  mb('chrome').tube(x0 + 0.08, y + 0.82, zc, 0.02, 0.3, 'x', 8); mb('chrome').cylinder(x0 + 0.03, y + 0.68, zc, 0.025, 0.28, 8);
  mb('chrome').rbox(tx + 0.3, y + 0.7, z0 + width - 0.042, 0.2, 0.12, 0.06, { r: 0.02, uv: 0 });
  if (accessible) { mb('chrome').tube(tx + 0.4, y + 0.85, z0 + width - 0.04, 0.018, 0.9, 'x', 8); for (const e of [-0.4, 0.4]) mb('chrome').box(tx + 0.4 + e, y + 0.85, z0 + width - 0.025, 0.03, 0.03, 0.05); }
  for (const zz of [z0, z0 + width]) f.col(x0, zz - 0.04, xf, zz + 0.04, y, y + 2);
  for (const [a, b] of [[z0, z0 + piW], [z0 + width - piW, z0 + width]]) f.col(xf - 0.04, a, xf + 0.04, b, y, y + 2);
  f.col(x0, zc - 0.2, tx + 0.45, zc + 0.2, y, y + 0.45);
  f.seat({ x: tx + 0.3, y: y + 0.44, z: zc, yaw: -Math.PI / 2, label: 'Sit down', toilet: true });
  // door hinged on the north pilaster edge, closed it spans +z; opens inward (toward -x)
  return { id, kind: 'stall', hinge: [xf, y + pg + 0.02, z0 + piW], w: doorW, h: ph - 0.05, t: 0.025, base: -Math.PI / 2, openSign: -1, max: 1.55, mat: 'stallDoor', y, label: 'stall door' };
}
