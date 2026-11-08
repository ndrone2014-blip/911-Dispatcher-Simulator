// Furniture & fixture library for the Police Department (and anything else that wants it).
// Every piece is built from real dimensions with rounded edges, merged into the shared
// material batches, and registers its own colliders, seats and interactables, so a room is
// simply a list of calls. All functions take a context:
//   f = { mb(matKey) → MeshBuilder, col(x0,z0,x1,z1,y0,y1), seat(def), interact(def), D (detail 0..2) }
// and a floor height `y` so the same piece works on either story.

const rot2 = (x, z, r) => { const c = Math.cos(r), s = Math.sin(r); return (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c]; };
/** Collider for a w×d footprint rotated by r (axis-aligned bound). */
function colRot(f, x, z, w, d, r, y, h) {
  const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r)); const hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2;
  f.col(x - hx, z - hz, x + hx, z + hz, y, y + h);
}

// ---------------------------------------------------------------- seating
/** Task chair on casters (5-star base, mesh back, arms). Faces -z rotated by r. */
export function officeChair(f, x, z, r, y = 0, { hi = false, seat = true, color = 'fabric', label } = {}) {
  const { mb, D } = f; const P = rot2(x, z, r);
  mb(color).rbox(x, y + 0.49, z, 0.5, 0.09, 0.48, { rotY: r, r: 0.04, uv: 0.5, ao: 0.25 });
  const bh = hi ? 0.72 : 0.54; const [bx, bz] = P(0, 0.26);
  mb('mesh').rbox(bx, y + 0.6 + bh / 2, bz, 0.46, bh, 0.05, { rotY: r, rotX: 0.12, r: 0.03, uv: 0.5 });
  const [fx, fz] = P(0, 0.285); mb('dark').rbox(fx, y + 0.6 + bh / 2, fz, 0.49, bh + 0.03, 0.025, { rotY: r, rotX: 0.12, r: 0.012, uv: 0 });
  { const [sx, sz] = P(0, 0.245); mb('dark').box(sx, y + 0.6, sz, 0.08, 0.2, 0.04, { rotY: r, uv: 0 }); } // back support spine
  if (hi) { const [hx, hz] = P(0, 0.3); mb(color).rbox(hx, y + 0.6 + bh + 0.055, hz, 0.3, 0.13, 0.06, { rotY: r, r: 0.03, uv: 0.5 }); }
  for (const s of [-1, 1]) { const [ax, az] = P(s * 0.255, 0.03); mb('dark').box(ax, y + 0.6, az, 0.03, 0.18, 0.03, { rotY: r }); const [px, pz] = P(s * 0.255, -0.01); mb('rubber').rbox(px, y + 0.7, pz, 0.07, 0.03, 0.25, { rotY: r, r: 0.012, uv: 0 }); }
  mb('chrome').cylinder(x, y + 0.27, z, 0.024, 0.36, 10); mb('dark').cylinder(x, y + 0.1, z, 0.045, 0.08, 10);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + r; mb('dark').rbox(x + Math.cos(a) * 0.17, y + 0.075, z + Math.sin(a) * 0.17, 0.34, 0.04, 0.05, { rotY: -a, r: 0.015, uv: 0 }); if (D >= 2) mb('rubber').sphere(x + Math.cos(a) * 0.32, y + 0.03, z + Math.sin(a) * 0.32, 0.03, 8, 5); }
  if (seat) f.seat({ x, y: y + 0.5, z, yaw: r, label: label || 'Sit down' });
}

/** Four-leg side / guest chair with an upholstered seat. */
export function guestChair(f, x, z, r, y = 0, { seat = true, color = 'fabricWarm', frame = 'chrome' } = {}) {
  const { mb } = f; const P = rot2(x, z, r);
  mb(color).rbox(x, y + 0.47, z, 0.46, 0.07, 0.44, { rotY: r, r: 0.025, uv: 0.5, ao: 0.2 });
  const [bx, bz] = P(0, 0.21); mb(color).rbox(bx, y + 0.76, bz, 0.44, 0.4, 0.05, { rotY: r, rotX: 0.1, r: 0.025, uv: 0.5 });
  for (const [dx, dz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.2], [0.19, 0.2]]) { const [lx, lz] = P(dx, dz); const lh = dz > 0 ? 0.9 : 0.44; mb(frame).box(lx, y + lh / 2, lz, 0.024, lh, 0.024); }
  const [ax, az] = P(0, 0.2); mb(frame).box(ax, y + 0.56, az, 0.4, 0.02, 0.02, { rotY: r });
  if (seat) f.seat({ x, y: y + 0.47, z, yaw: r });
}

/** Molded stacking chair (training / break room). */
export function stackChair(f, x, z, r, y = 0, { seat = true, color = 'chairShell' } = {}) {
  const { mb } = f; const P = rot2(x, z, r);
  mb(color).rbox(x, y + 0.46, z, 0.45, 0.04, 0.43, { rotY: r, r: 0.02, uv: 0 });
  const [bx, bz] = P(0, 0.22); mb(color).rbox(bx, y + 0.72, bz, 0.43, 0.32, 0.03, { rotY: r, rotX: 0.14, r: 0.02, uv: 0 });
  for (const [dx, dz] of [[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.215], [0.19, 0.215]]) { const [lx, lz] = P(dx, dz); const lh = dz > 0 ? 0.84 : 0.44; mb('chrome').box(lx, y + lh / 2, lz, 0.02, lh, 0.02); }
  if (seat) f.seat({ x, y: y + 0.46, z, yaw: r });
}

/** Beam seating (airport style) – n seats on one steel beam, used in the lobby. */
export function beamSeating(f, x, z, r, y = 0, n = 4) {
  const { mb } = f; const P = rot2(x, z, r); const pitch = 0.62; const L = n * pitch;
  { const [cx, cz] = P(0, 0.05); mb('metal').box(cx, y + 0.3, cz, L, 0.06, 0.08, { rotY: r, uv: 0.5 }); }
  for (const s of [-1, 1]) { const [lx, lz] = P(s * (L / 2 - 0.2), 0.05); mb('metal').box(lx, y + 0.15, lz, 0.06, 0.3, 0.45, { rotY: r, uv: 0.5 }); }
  for (let i = 0; i < n; i++) {
    const dx = -L / 2 + pitch * (i + 0.5); const [sx, sz] = P(dx, 0); const [bx, bz] = P(dx, 0.24);
    mb('fabricBlue').rbox(sx, y + 0.44, sz, 0.52, 0.07, 0.46, { rotY: r, r: 0.03, uv: 0.5, ao: 0.2 });
    mb('fabricBlue').rbox(bx, y + 0.73, bz, 0.52, 0.44, 0.06, { rotY: r, rotX: 0.12, r: 0.03, uv: 0.5 });
    { const [kx, kz] = P(dx, 0.05); mb('metal').box(kx, y + 0.37, kz, 0.1, 0.08, 0.3, { rotY: r, uv: 0 }); const [qx, qz] = P(dx, 0.22); mb('metal').box(qx, y + 0.49, qz, 0.08, 0.1, 0.05, { rotY: r, uv: 0 }); }
    if (i < n - 1) { const [ax, az] = P(dx + pitch / 2, 0.02); mb('metal').rbox(ax, y + 0.62, az, 0.05, 0.03, 0.4, { rotY: r, r: 0.01, uv: 0 }); const [ux, uz] = P(dx + pitch / 2, 0.05); mb('metal').box(ux, y + 0.465, uz, 0.04, 0.3, 0.04, { rotY: r, uv: 0 }); }
    f.seat({ x: sx, y: y + 0.45, z: sz, yaw: r });
  }
  colRot(f, ...P(0, 0.05), L, 0.55, r, y, 0.9);
}

/** Three-seat sofa. Faces -z rotated by r. */
export function sofa(f, x, z, r, y = 0, { w = 2.1, color = 'fabricWarm', seats = 3 } = {}) {
  const { mb } = f; const P = rot2(x, z, r);
  mb(color).rbox(x, y + 0.2, z, w, 0.24, 0.85, { rotY: r, r: 0.04, uv: 0.5, ao: 0.3 });
  for (let i = 0; i < seats; i++) { const dx = -w / 2 + 0.12 + (w - 0.24) * (i + 0.5) / seats; const [cx, cz] = P(dx, -0.04); mb(color).rbox(cx, y + 0.39, cz, (w - 0.3) / seats - 0.02, 0.14, 0.68, { rotY: r, r: 0.05, uv: 0.5 }); f.seat({ x: cx, y: y + 0.42, z: cz, yaw: r }); }
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [fx, fz] = P(dx * (w / 2 - 0.1), dz * 0.32); mb('woodDark').cylinder(fx, y + 0.04, fz, 0.025, 0.08, 8); }
  { const [bx, bz] = P(0, 0.33); mb(color).rbox(bx, y + 0.64, bz, w - 0.04, 0.52, 0.22, { rotY: r, rotX: 0.1, r: 0.07, uv: 0.5 }); }
  for (const s of [-1, 1]) { const [ax, az] = P(s * (w / 2 - 0.09), 0); mb(color).rbox(ax, y + 0.48, az, 0.18, 0.42, 0.85, { rotY: r, r: 0.06, uv: 0.5 }); }
  colRot(f, x, z, w, 0.85, r, y, 0.9);
}

export function bench(f, x, z, r, y = 0, w = 1.8, { seats = 3, wood = 'wood' } = {}) {
  const { mb } = f; const P = rot2(x, z, r);
  mb(wood).rbox(x, y + 0.44, z, w, 0.05, 0.38, { rotY: r, r: 0.01, uv: 1 });
  for (const s of [-1, 1]) { const [lx, lz] = P(s * (w / 2 - 0.15), 0); mb('metal').box(lx, y + 0.21, lz, 0.05, 0.42, 0.34, { rotY: r, uv: 0.5 }); }
  for (let i = 0; i < seats; i++) { const [sx, sz] = P(-w / 2 + w * (i + 0.5) / seats, 0); f.seat({ x: sx, y: y + 0.46, z: sz, yaw: r }); }
  colRot(f, x, z, w, 0.4, r, y, 0.5);
}

// ---------------------------------------------------------------- desks & tables
/** Office desk with drawers, monitor(s), keyboard, phone, papers. Desk faces the sitter at -z… i.e. the chair is on +z side. */
export function desk(f, x, z, r, y = 0, { w = 1.6, d = 0.8, wood = 'wood', monitors = 1, chair = true, exec = false, papers = true, screenKey = null, guest = 0, lamp = false } = {}) {
  const { mb, D } = f; const P = rot2(x, z, r);
  mb(wood).rbox(x, y + 0.74, z, w, 0.045, d, { rotY: r, r: 0.012, uv: 1 });
  { const [mx, mz] = P(0, -d / 2 + 0.04); mb(wood).box(mx, y + 0.4, mz, w - 0.04, 0.6, 0.025, { rotY: r, uv: 1 }); }
  for (const s of [-1, 1]) {
    if (s > 0 || exec) { const [px, pz] = P(s * (w / 2 - 0.22), 0); mb(wood).box(px, y + 0.36, pz, 0.42, 0.72, d - 0.06, { rotY: r, uv: 1, ao: 0.2 });
      for (let i = 0; i < 3; i++) { const [hx, hz] = P(s * (w / 2 - 0.22), d / 2 - 0.02); mb('chrome').box(hx, y + 0.18 + i * 0.22, hz, 0.14, 0.014, 0.012, { rotY: r }); mb('dark').box(hx, y + 0.07 + i * 0.22, hz, 0.4, 0.004, 0.004, { rotY: r }); } }
    else { const [px, pz] = P(s * (w / 2 - 0.03), 0); mb(wood).box(px, y + 0.36, pz, 0.04, 0.72, d - 0.06, { rotY: r, uv: 1 }); }
  }
  if (monitors) for (let i = 0; i < monitors; i++) {
    const off = monitors === 1 ? 0 : (i - (monitors - 1) / 2) * 0.58; const tilt = monitors === 1 ? 0 : (i === 0 ? 0.18 : -0.18);
    const [mx, mz] = P(off, -d / 2 + 0.2); const rr = r + tilt;
    mb('bezel').rbox(mx, y + 1.06, mz, 0.56, 0.34, 0.025, { rotY: rr, r: 0.006, uv: 0 });
    if (screenKey) { const c = Math.cos(rr), s2 = Math.sin(rr); mb(screenKey).panel(mx + s2 * 0.014, y + 1.06, mz + c * 0.014, 0.52, 0.3, 'z', 1, { rotY: rr }); }
    const [sx, sz] = P(off, -d / 2 + 0.185); mb('dark').box(sx, y + 0.88, sz, 0.04, 0.22, 0.03, { rotY: rr }); mb('dark').rbox(sx, y + 0.768, sz, 0.22, 0.012, 0.16, { rotY: rr, r: 0.01, uv: 0 });
  }
  { const [kx, kz] = P(0, 0.08); mb('keyboard').box(kx, y + 0.772, kz, 0.44, 0.016, 0.14, { rotY: r, faces: 'Y', uv: 0 }); mb('dark').box(kx, y + 0.766, kz, 0.45, 0.028, 0.145, { rotY: r, faces: 'xXzZ' }); }
  if (D >= 1) {
    const [mx, mz] = P(0.34, 0.1); mb('plastic').sphere(mx, y + 0.772, mz, 0.032, 10, 6, { sy: 0.45 });
    const [px, pz] = P(-w / 2 + 0.3, -0.1); mb('plastic').rbox(px, y + 0.785, pz, 0.21, 0.05, 0.19, { rotY: r - 0.3, r: 0.012, uv: 0 }); mb('phone').box(px, y + 0.812, pz, 0.2, 0.004, 0.18, { rotY: r - 0.3, faces: 'Y', uv: 0 });
    if (papers) { const [qx, qz] = P(w / 2 - 0.35, 0.05); mb('paper').box(qx, y + 0.768, qz, 0.22, 0.012, 0.3, { rotY: r + 0.2, uv: 0 }); mb('paper').box(qx + 0.01, y + 0.778, qz, 0.21, 0.006, 0.29, { rotY: r + 0.32, uv: 0 }); }
    if (D >= 2) { const [cx, cz] = P(w / 2 - 0.18, -0.22); mb('mug').cylinder(cx, y + 0.81, cz, 0.04, 0.095, 12); mb('coffee').disc(cx, y + 0.855, cz, 0.034, 10); }
    if (exec) { const [nx, nz] = P(0, d / 2 - 0.05); mb('gold').box(nx, y + 0.79, nz, 0.3, 0.06, 0.02, { rotY: r }); }
    if (lamp) { const [lx, lz] = P(-w / 2 + 0.15, -d / 2 + 0.2); mb('dark').cylinder(lx, y + 0.775, lz, 0.07, 0.02, 12); mb('chrome').cylinder(lx, y + 0.98, lz, 0.008, 0.4, 6); mb('lightpanel').cylinder(lx, y + 1.18, lz, 0.09, 0.08, 12, { r2: 0.05 }); }
  }
  colRot(f, x, z, w, d, r, y, 0.8);
  const [cx, cz] = P(0, d / 2 + 0.38);
  if (chair) officeChair(f, cx, cz, r, y, { hi: exec });
  const guests = [];
  for (let i = 0; i < guest; i++) { const [gx, gz] = P((i - (guest - 1) / 2) * 0.62, -d / 2 - 0.55); guestChair(f, gx, gz, r + Math.PI, y); guests.push([gx, gz, r + Math.PI]); }
  return { chair: [cx, cz, r], guests, front: P(0, -d / 2 - 0.9), side: P(w / 2 + 0.55, d / 2 + 0.3) };
}

/** Rectangular table with optional chairs around it. */
export function table(f, x, z, r, y = 0, { w = 1.8, d = 0.9, top = 'wood', chairs = 0, chairType = 'stack', round = false, h = 0.74 } = {}) {
  const { mb } = f; const P = rot2(x, z, r);
  if (round) { mb(top).cylinder(x, y + h, z, w / 2, 0.04, 28); mb('dark').cylinder(x, y + h / 2, z, 0.05, h, 10); mb('dark').cylinder(x, y + 0.02, z, 0.32, 0.04, 16); f.col(x - w / 2, z - w / 2, x + w / 2, z + w / 2, y, y + h + 0.05); }
  else {
    mb(top).rbox(x, y + h, z, w, 0.045, d, { rotY: r, r: 0.012, uv: 1 });
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [lx, lz] = P(dx * (w / 2 - 0.07), dz * (d / 2 - 0.07)); mb('metal').box(lx, y + h / 2, lz, 0.05, h, 0.05, { uv: 0 }); }
    colRot(f, x, z, w, d, r, y, h + 0.05);
  }
  const mk = chairType === 'guest' ? guestChair : chairType === 'office' ? officeChair : stackChair;
  const out = [];
  if (round) { for (let i = 0; i < chairs; i++) { const a = (i / chairs) * Math.PI * 2; const cx = x + Math.sin(a) * (w / 2 + 0.38), cz = z + Math.cos(a) * (w / 2 + 0.38); mk(f, cx, cz, a, y); out.push([cx, cz, a]); } return out; }
  const per = chairs ? Math.max(1, Math.floor(chairs / 2)) : 0; const ends = chairs - per * 2;
  for (const side of [-1, 1]) for (let i = 0; i < per; i++) { const dx = -w / 2 + w * (i + 0.5) / per; const [cx, cz] = P(dx, side * (d / 2 + 0.36)); mk(f, cx, cz, r + (side < 0 ? Math.PI : 0), y); out.push([cx, cz, r + (side < 0 ? Math.PI : 0)]); }
  for (let i = 0; i < ends; i++) { const s = i === 0 ? 1 : -1; const [cx, cz] = P(s * (w / 2 + 0.38), 0); mk(f, cx, cz, r + s * Math.PI / 2, y); out.push([cx, cz, r + s * Math.PI / 2]); }
  return out;
}

/** Open-office cubicle pod: 2×n workstations with fabric panels. */
export function cubicles(f, x, z, r, y = 0, { n = 2, screenKey = null } = {}) {
  const { mb } = f; const P = rot2(x, z, r); const cw = 1.7, cd = 1.5; const chairs = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) {
    const cx = -cw * n / 2 + cw * (i + 0.5), cz = row === 0 ? -cd / 2 : cd / 2; const face = row === 0 ? Math.PI : 0;
    const [dx, dz] = P(cx, cz + (row === 0 ? 0.25 : -0.25));
    chairs.push(desk(f, dx, dz, r + face, y, { w: 1.5, d: 0.7, wood: 'laminate', monitors: 2, screenKey, guest: 0 }).chair);
  }
  // spine panel + side panels
  { const [sx, sz] = P(0, 0); mb('fabricBlue').rbox(sx, y + 0.65, sz, cw * n, 1.3, 0.06, { rotY: r, r: 0.01, uv: 0.6 }); mb('metal').box(sx, y + 1.31, sz, cw * n + 0.02, 0.03, 0.08, { rotY: r, uv: 0 }); }
  for (let i = 0; i <= n; i++) { const [px, pz] = P(-cw * n / 2 + cw * i, 0); mb('fabricBlue').rbox(px, y + 0.6, pz, 0.06, 1.2, cd * 2 - 0.4, { rotY: r, r: 0.01, uv: 0.6 }); mb('metal').box(px, y + 1.21, pz, 0.08, 0.03, cd * 2 - 0.38, { rotY: r, uv: 0 }); colRot(f, px, pz, 0.08, cd * 2 - 0.4, r, y, 1.2); }
  return chairs;
}

// ---------------------------------------------------------------- storage
export function bookcase(f, x, z, r, y = 0, { w = 0.9, h = 2.0, d = 0.36, wood = 'wood' } = {}) {
  const { mb } = f; const P = rot2(x, z, r);
  { const [bx, bz] = P(0, d / 2 - 0.01); mb(wood).box(bx, y + h / 2, bz, w, h, 0.02, { rotY: r, uv: 1 }); }
  for (const s of [-1, 1]) { const [sx, sz] = P(s * (w / 2 - 0.01), 0); mb(wood).box(sx, y + h / 2, sz, 0.02, h, d, { rotY: r, uv: 1 }); }
  const shelves = Math.round(h / 0.38);
  for (let i = 0; i <= shelves; i++) { mb(wood).box(x, y + 0.04 + i * (h - 0.06) / shelves, z, w - 0.02, 0.02, d - 0.02, { rotY: r, uv: 1 }); if (i < shelves && f.D >= 1) { const [bx2, bz2] = P(-w * 0.08, 0.02); mb('books').box(bx2, y + 0.183 + i * (h - 0.06) / shelves, bz2, w * 0.78, 0.26, d * 0.7, { rotY: r, faces: 'zZ', uv: 0 }); } }
  colRot(f, x, z, w, d, r, y, h);
}

export function fileCabinet(f, x, z, r, y = 0, { drawers = 4, w = 0.9, color = 'metal' } = {}) {
  const { mb } = f; const P = rot2(x, z, r); const h = drawers * 0.33;
  mb(color).rbox(x, y + h / 2, z, w, h, 0.5, { rotY: r, r: 0.01, uv: 0.6, ao: 0.2 });
  for (let i = 0; i < drawers; i++) { const [hx, hz] = P(0, -0.255); mb('dark').box(hx, y + 0.33 * i + 0.01, hz, w - 0.04, 0.008, 0.006, { rotY: r }); mb('chrome').box(hx, y + 0.33 * i + 0.25, hz, 0.2, 0.025, 0.02, { rotY: r }); }
  colRot(f, x, z, w, 0.5, r, y, h);
}

/** Heavy-duty steel shelving with boxes (evidence, records, storage). */
export function shelving(f, x, z, r, y = 0, { w = 1.8, d = 0.6, h = 2.2, items = 'boxes' } = {}) {
  const { mb } = f; const P = rot2(x, z, r); let s = Math.abs(Math.round(x * 13 + z * 7)) + 3; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [px, pz] = P(dx * (w / 2 - 0.02), dz * (d / 2 - 0.02)); mb('frame').box(px, y + h / 2, pz, 0.035, h, 0.035); }
  for (let i = 0; i < 5; i++) {
    const yy = y + 0.08 + i * (h - 0.12) / 4; mb('metal').box(x, yy, z, w, 0.025, d, { rotY: r, uv: 0.5 });
    if (i < 4 && f.D >= 1) for (let b = 0; b < 4; b++) { if (rnd() < 0.2) continue; const bw = 0.32 + rnd() * 0.12; const [bx, bz] = P(-w / 2 + 0.25 + b * (w - 0.4) / 3.2, (rnd() - 0.5) * 0.08);
      if (items === 'bags') mb('paper').rbox(bx, yy + 0.13, bz, bw * 0.8, 0.24, d * 0.6, { rotY: r + (rnd() - 0.5) * 0.3, r: 0.03, uv: 0 });
      else mb('satin').box(bx, yy + 0.15, bz, bw, 0.28, d * 0.75, { rotY: r, color: [0.62 + rnd() * 0.1, 0.5 + rnd() * 0.08, 0.34], uv: 0 }); }
  }
  colRot(f, x, z, w, d, r, y, h);
}

/** Bank of full-height lockers (n doors) with the locker texture. */
export function lockerBank(f, x, z, r, y = 0, { n = 6, h = 1.9, d = 0.48, bench: withBench = true } = {}) {
  const { mb } = f; const P = rot2(x, z, r); const w = n * 0.38;
  { const c = Math.cos(r), s = Math.sin(r); mb('lockers').panel(x - s * (d / 2 + 0.002), y + h / 2 + 0.1, z - c * (d / 2 + 0.002), w, h, 'z', -1, { rotY: r, uvRect: [0, 0, w / 1.6, 1] }); }
  mb('satin').box(x, y + h / 2 + 0.1, z, w, h, d, { rotY: r, faces: 'xXyZ', color: [0.3, 0.34, 0.4] });
  mb('rubber').box(x, y + 0.05, z, w, 0.1, d - 0.04, { rotY: r });
  colRot(f, x, z, w, d, r, y, h + 0.1);
  if (withBench) { const [bx, bz] = P(0, -d / 2 - 0.6); bench(f, bx, bz, r, y, Math.min(w, 2.2), { seats: 3 }); }
}

export function credenza(f, x, z, r, y = 0, { w = 1.8, wood = 'woodDark' } = {}) {
  const { mb } = f; const P = rot2(x, z, r);
  mb(wood).rbox(x, y + 0.38, z, w, 0.76, 0.48, { rotY: r, r: 0.01, uv: 1, ao: 0.2 });
  for (let i = 0; i < 3; i++) { const [hx, hz] = P(-w / 3 + i * w / 3, -0.245); mb('chrome').box(hx, y + 0.55, hz, 0.12, 0.014, 0.012, { rotY: r }); }
  colRot(f, x, z, w, 0.48, r, y, 0.8);
}

// ---------------------------------------------------------------- decor
export function plantPot(f, x, z, y = 0, s = 1) {
  const { mb, D } = f;
  mb('pot').cylinder(x, y + 0.24 * s, z, 0.19 * s, 0.48 * s, 16, { r2: 0.25 * s }); mb('soil').disc(x, y + 0.47 * s, z, 0.235 * s, 14);
  [[0, 0.78, 0, 0.32, 1.2], [0.14, 1.02, -0.06, 0.22, 1], [-0.12, 1.0, 0.08, 0.2, 1.1], [0.05, 1.22, 0.05, 0.16, 1]].forEach(([dx, dy, dz, rr, sy], i) => mb(i % 2 ? 'plant2' : 'plant').sphere(x + dx * s, y + dy * s, z + dz * s, rr * s, 12, 8, { sy }));
  if (D >= 2) for (let i = 0; i < 12; i++) { const a = i * 2.39, rr = (0.22 + (i % 3) * 0.06) * s; mb('plant2').box(x + Math.cos(a) * rr, y + (0.7 + (i % 4) * 0.13) * s, z + Math.sin(a) * rr, 0.16 * s, 0.012, 0.06 * s, { rotY: -a, uv: 0 }); }
  f.col(x - 0.25 * s, z - 0.25 * s, x + 0.25 * s, z + 0.25 * s, y, y + 1.2 * s);
}

/** Framed picture on a wall. axis/sign = which way the wall faces. */
export function frame(f, x, y, z, axis, sign, w = 0.8, h = 0.6, mat = 'print1') {
  const { mb } = f; const o = 0.012 * sign; const back = 0.06 * sign; // frame depth reaches back into the wall surface
  if (axis === 'z') { mb('frame').box(x, y, z + (o + 0.01 * sign - back) / 2, w + 0.06, h + 0.06, 0.02 + 0.06 - 0.002); mb(mat).box(x, y, z + o * 2, w, h, 0.004, { uv: 0 }); }
  else { mb('frame').box(x + (o + 0.01 * sign - back) / 2, y, z, 0.02 + 0.06 - 0.002, h + 0.06, w + 0.06); mb(mat).box(x + o * 2, y, z, 0.004, h, w, { uv: 0 }); }
}

export function flagStand(f, x, z, y = 0, mat = 'flagUS', face = 0) {
  // face = direction the flag's front looks (yaw, 0 = toward +z); it hangs off the pole to the viewer's left
  const { mb } = f; const c = Math.cos(face), s = Math.sin(face);
  mb('gold').cylinder(x, y + 0.03, z, 0.18, 0.06, 16); mb('chrome').cylinder(x, y + 1.2, z, 0.016, 2.4, 8); mb('gold').sphere(x, y + 2.43, z, 0.045, 10, 8);
  const fw = 1.0, fh = fw / (mat === 'flagUS' ? 1.9 : 1.667); const folds = [0.18, -0.16, 0.16, -0.12];
  folds.forEach((a, i) => { const lx = (i + 0.5) * fw / 4 * 0.93 + 0.03, lz = (i % 2) * 0.03; mb(mat).panel(x + lx * c + lz * s, y + 2.35 - fh / 2, z - lx * s + lz * c, fw / 4, fh, 'z', 1, { rotY: a + face, uvRect: [i / 4, 0, (i + 1) / 4, 1] }); });
  f.col(x - 0.2, z - 0.2, x + 0.2, z + 0.2, y, y + 2.4);
}

export function trashCan(f, x, z, y = 0, mat = 'dark') { f.mb(mat).cylinder(x, y + 0.22, z, 0.16, 0.44, 14, { r2: 0.18 }); }

export function waterCooler(f, x, z, r, y = 0) {
  const { mb } = f; mb('white').rbox(x, y + 0.5, z, 0.32, 1.0, 0.32, { rotY: r, r: 0.02, uv: 0 }); mb('waterjug').cylinder(x, y + 1.21, z, 0.13, 0.42, 14);
  f.col(x - 0.2, z - 0.2, x + 0.2, z + 0.2, y, y + 1.4);
}

export function copier(f, x, z, r, y = 0) {
  const { mb } = f; const P = rot2(x, z, r);
  mb('white').rbox(x, y + 0.45, z, 0.6, 0.9, 0.62, { rotY: r, r: 0.02, uv: 0, ao: 0.2 }); mb('dark').rbox(x, y + 0.99, z, 0.6, 0.18, 0.5, { rotY: r, r: 0.03, uv: 0 });
  const [px, pz] = P(0.18, -0.26); mb('led').box(px, y + 1.05, pz, 0.08, 0.04, 0.01, { rotY: r }); mb('paper').box(x, y + 1.084, z, 0.3, 0.008, 0.22, { rotY: r, uv: 0 });
  colRot(f, x, z, 0.62, 0.64, r, y, 1.1);
}

/** Wall-mounted whiteboard / cork board / TV. axis/sign = wall facing. */
export function wallBoard(f, x, y, z, axis, sign, w, h, mat = 'whiteboard', frameMat = 'frame') {
  const { mb } = f;
  // frame spans from 6 cm behind the given point (into the wall) to 3 cm in front of it
  if (axis === 'z') { mb(frameMat).box(x, y, z - 0.015 * sign, w + 0.06, h + 0.06, 0.09); mb(mat).panel(x, y, z + 0.032 * sign, w, h, 'z', sign); }
  else { mb(frameMat).box(x - 0.015 * sign, y, z, 0.09, h + 0.06, w + 0.06); mb(mat).panel(x + 0.032 * sign, y, z, w, h, 'x', sign); }
}

// ---------------------------------------------------------------- restrooms
/** One toilet stall: partitions, toilet, paper holder. Returns the dynamic door def (swing-in). */
export function toiletStall(f, x0, z0, depth, width, facing, y = 0, { id, accessible = false } = {}) {
  // facing: direction of the stall opening (+1 = opening toward +z, the door is on the z0+depth*facing line)
  const { mb } = f; const zf = z0 + depth * facing; const xc = x0 + width / 2;
  const ph = 1.75, pg = 0.25; // partition height and floor gap
  // side partitions (laminate panels on chrome feet), the front pilasters and head rail
  for (const xx of [x0, x0 + width]) {
    mb('stall').box(xx, y + pg + ph / 2, z0 + depth * facing / 2, 0.025, ph, depth - 0.02, { uv: 0.6 });
    mb('chrome').box(xx, y + pg / 2, zf - facing * 0.15, 0.04, pg, 0.04);
  }
  const doorW = Math.min(0.82, width - 0.2);
  const piW = (width - doorW) / 2;
  for (const [a, b] of [[x0, x0 + piW], [x0 + width - piW, x0 + width]]) mb('stall').box((a + b) / 2, y + pg + ph / 2, zf, b - a, ph, 0.025, { uv: 0.6 });
  mb('chrome').box(xc, y + pg + ph + 0.02, zf, width, 0.035, 0.04); // head rail
  // toilet: pedestal, bowl, seat, tank (wall-hung flush valve)
  const tz = z0 + facing * 0.32;
  mb('porcelain').rbox(xc, y + 0.2, tz + facing * 0.1, 0.24, 0.4, 0.34, { r: 0.08, uv: 0 });
  mb('porcelain').rbox(xc, y + 0.38, tz + facing * 0.22, 0.38, 0.06, 0.5, { r: 0.12, uv: 0 });
  mb('white').rbox(xc, y + 0.42, tz + facing * 0.23, 0.38, 0.025, 0.44, { r: 0.1, uv: 0 });
  mb('chrome').tube(xc, y + 0.82, z0 + facing * 0.08, 0.02, 0.3, 'z', 8); mb('chrome').cylinder(xc, y + 0.68, z0 + facing * 0.03, 0.025, 0.28, 8);
  // tissue holder + grab bar (accessible stall)
  mb('chrome').rbox(x0 + width - 0.042, y + 0.7, tz + facing * 0.3, 0.06, 0.12, 0.2, { r: 0.02, uv: 0 });
  if (accessible) { mb('chrome').tube(x0 + width - 0.04, y + 0.85, tz + facing * 0.35, 0.018, 0.9, 'z', 8); for (const e of [-0.4, 0.4]) mb('chrome').box(x0 + width - 0.025, y + 0.85, tz + facing * 0.35 + e, 0.05, 0.03, 0.03); }
  // colliders: side panels (full height) and the pilasters; the door collider is dynamic
  for (const xx of [x0, x0 + width]) f.col(xx - 0.04, Math.min(z0, zf), xx + 0.04, Math.max(z0, zf), y, y + 2);
  for (const [a, b] of [[x0, x0 + piW], [x0 + width - piW, x0 + width]]) f.col(a, zf - 0.04, b, zf + 0.04, y, y + 2);
  f.col(xc - 0.22, tz - 0.05, xc + 0.22, tz + facing * 0.45, y, y + 0.45);
  f.seat({ x: xc, y: y + 0.44, z: tz + facing * 0.32, yaw: facing > 0 ? Math.PI : 0, label: 'Sit down', toilet: true });
  // door: hinge on the left pilaster edge, swings into the stall
  const hx = x0 + piW; return { id, kind: 'stall', hinge: [hx, y + pg + 0.02, zf], w: doorW, h: ph - 0.05, t: 0.025, closedYaw: facing > 0 ? 0 : 0, base: 0, openSign: facing > 0 ? 1 : -1, max: 1.55, mat: 'stallDoor', y, label: 'stall door', stall: { x: xc, z: z0 + facing * depth * 0.55, y } };
}

export function urinal(f, x, z, sign, y = 0) {
  const { mb } = f;
  mb('porcelain').rbox(x, y + 0.75, z + sign * 0.15, 0.36, 0.62, 0.34, { r: 0.1, uv: 0 });
  mb('chrome').cylinder(x, y + 1.2, z + sign * 0.03, 0.025, 0.4, 8);
  mb('stall').box(x + 0.42, y + 1.0, z + sign * 0.25, 0.02, 1.1, 0.56, { uv: 0.6 }); // privacy screen, fixed to the wall
  for (const yy of [0.6, 1.4]) mb('chrome').box(x + 0.42, y + yy, z + sign * 0.0, 0.05, 0.06, 0.06);
  f.col(x - 0.2, Math.min(z, z + sign * 0.35), x + 0.2, Math.max(z, z + sign * 0.35), y, y + 1.2);
}

/** Vanity counter with n sinks and a mirror; sign = direction the counter faces (+1 toward +z). */
export function vanity(f, x, z, sign, y = 0, n = 2, axis = 'z') {
  const { mb } = f; const w = n * 0.75 + 0.2;
  if (axis === 'z') {
    mb('counterTop').rbox(x, y + 0.86, z + sign * 0.28, w, 0.05, 0.56, { r: 0.01, uv: 1 });
    mb('satin').box(x, y + 0.72, z + sign * 0.5, w, 0.24, 0.02, { color: [0.75, 0.75, 0.73] });
    for (let i = 0; i < n; i++) { const sx = x - w / 2 + 0.475 + i * 0.75; mb('porcelain').cylinder(sx, y + 0.84, z + sign * 0.3, 0.18, 0.06, 18, { r2: 0.2 }); mb('chrome').tube(sx, y + 0.98, z + sign * 0.12, 0.012, 0.16, 'z', 8); mb('chrome').cylinder(sx, y + 0.94, z + sign * 0.06, 0.02, 0.12, 8); }
    mb('mirror').box(x, y + 1.55, z + sign * 0.012, w, 0.9, 0.01, { uv: 0 }); mb('chrome').box(x, y + 1.55, z + sign * 0.006, w + 0.04, 0.94, 0.006);
    f.col(x - w / 2, Math.min(z, z + sign * 0.56), x + w / 2, Math.max(z, z + sign * 0.56), y, y + 0.9);
  } else {
    mb('counterTop').rbox(x + sign * 0.28, y + 0.86, z, 0.56, 0.05, w, { r: 0.01, uv: 1 });
    mb('satin').box(x + sign * 0.5, y + 0.72, z, 0.02, 0.24, w, { color: [0.75, 0.75, 0.73] });
    for (let i = 0; i < n; i++) { const sz = z - w / 2 + 0.475 + i * 0.75; mb('porcelain').cylinder(x + sign * 0.3, y + 0.84, sz, 0.18, 0.06, 18, { r2: 0.2 }); mb('chrome').tube(x + sign * 0.12, y + 0.98, sz, 0.012, 0.16, 'x', 8); mb('chrome').cylinder(x + sign * 0.06, y + 0.94, sz, 0.02, 0.12, 8); }
    mb('mirror').box(x + sign * 0.012, y + 1.55, z, 0.01, 0.9, w, { uv: 0 }); mb('chrome').box(x + sign * 0.006, y + 1.55, z, 0.006, 0.94, w + 0.04);
    f.col(Math.min(x, x + sign * 0.56), z - w / 2, Math.max(x, x + sign * 0.56), z + w / 2, y, y + 0.9);
  }
}

// ---------------------------------------------------------------- kitchen
export function kitchenette(f, x0, x1, z, sign, y = 0, { sink = true, coffee = true, micro = true } = {}) {
  // counter run along a wall at z (cabinets face +sign z)
  const { mb } = f; const w = x1 - x0, cx = (x0 + x1) / 2, cz = z + sign * 0.31;
  mb('cabinet').box(cx, y + 0.45, cz, w, 0.9, 0.6, { uv: 0.9, ao: 0.2 }); mb('rubber').box(cx, y + 0.05, cz + sign * 0.02, w, 0.1, 0.58);
  mb('counterTop').rbox(cx, y + 0.93, cz, w + 0.02, 0.04, 0.64, { r: 0.01, uv: 1 });
  mb('cabinet').box(cx, y + 2.05, z + sign * 0.18, w, 0.72, 0.36, { uv: 0.9 }); mb('white').box(cx, y + 1.68, z + sign * 0.18, w, 0.03, 0.36);
  mb('lightpanel').box(cx, y + 1.665, z + sign * 0.25, w - 0.2, 0.005, 0.05, { faces: 'y', uv: 0 });
  mb('ceramic').box(cx, y + 1.3, z + sign * 0.01, w, 0.72, 0.01, { uv: 0.6 });
  for (let i = 0; i < Math.floor(w / 0.6); i++) { const hx = x0 + 0.3 + i * 0.6; mb('chrome').box(hx, y + 0.8, cz + sign * 0.305, 0.14, 0.014, 0.012); mb('dark').box(hx + 0.3, y + 0.45, cz + sign * 0.301, 0.004, 0.86, 0.004); }
  if (sink) { const sx = x0 + w * 0.35; mb('metal').box(sx, y + 0.95, cz, 0.55, 0.02, 0.42, { uv: 0.5 }); mb('chrome').cylinder(sx, y + 1.07, z + sign * 0.08, 0.015, 0.22, 8); mb('chrome').tube(sx, y + 1.17, z + sign * 0.16, 0.012, 0.18, 'z', 8); }
  if (coffee) { const kx = x0 + w * 0.7; mb('dark').rbox(kx, y + 1.15, cz - sign * 0.05, 0.32, 0.4, 0.34, { r: 0.02 }); mb('glass').cylinder(kx, y + 1.03, cz + sign * 0.08, 0.06, 0.14, 12); mb('coffee').cylinder(kx, y + 0.99, cz + sign * 0.08, 0.055, 0.06, 12); mb('led').box(kx + 0.1, y + 1.3, cz + sign * 0.12, 0.012, 0.02, 0.02);
    f.interact({ kind: 'coffee', label: 'Grab a coffee', min: [kx - 0.25, y + 0.9, Math.min(cz, cz + sign * 0.4)], max: [kx + 0.25, y + 1.5, Math.max(cz, cz + sign * 0.4)], pri: 1 }); }
  if (micro) { const mx = x0 + 0.4; mb('plastic').rbox(mx, y + 1.1, cz - sign * 0.04, 0.5, 0.3, 0.38, { r: 0.012 }); mb('blackgloss').box(mx - 0.05, y + 1.1, cz + sign * 0.16, 0.3, 0.2, 0.01);
    f.interact({ kind: 'microwave', label: 'Use the microwave', min: [mx - 0.3, y + 0.92, Math.min(cz, cz + sign * 0.4)], max: [mx + 0.3, y + 1.3, Math.max(cz, cz + sign * 0.4)], pri: 1 }); }
  f.col(x0, Math.min(z, z + sign * 0.62), x1, Math.max(z, z + sign * 0.62), y, y + 0.95);
}

/** Fridge body (the door is a dynamic object returned for the world to animate). sign = facing +z/-z. */
export function fridge(f, x, z, sign, y = 0, { id = 'pd_fridge' } = {}) {
  const { mb } = f; const fz = z + sign * 0.38;
  // cabinet shell (open front), interior liner, shelves and contents
  mb('fridge').rbox(x, y + 0.92, z, 0.8, 1.84, 0.04, { r: 0.01, uv: 0 }); // back
  for (const s of [-1, 1]) mb('fridge').box(x + s * 0.39, y + 0.92, z + sign * 0.19, 0.03, 1.84, 0.38, { uv: 0 });
  mb('fridge').box(x, y + 1.83, z + sign * 0.19, 0.8, 0.03, 0.38, { uv: 0 }); mb('fridge').box(x, y + 0.05, z + sign * 0.19, 0.8, 0.1, 0.38, { uv: 0 });
  mb('lightpanel').box(x, y + 1.812, z + sign * 0.15, 0.3, 0.006, 0.04, { faces: 'y', uv: 0 });
  for (const yy of [0.5, 0.9, 1.3]) mb('glassFrost').box(x, y + yy, z + sign * 0.2, 0.74, 0.012, 0.34);
  mb('fridge').box(x, y + 1.1, z + sign * 0.19, 0.76, 0.02, 0.36, { uv: 0 }); // freezer divider
  const items = [[-0.22, 0.56, 'red', 0.06, 0.2], [-0.1, 0.56, 'blue', 0.06, 0.2], [0.05, 0.6, 'white', 0.18, 0.12], [0.22, 0.58, 'aed', 0.1, 0.16], [-0.18, 0.95, 'pie', 0.22, 0.1], [0.15, 0.97, 'paper', 0.24, 0.14], [-0.2, 1.36, 'mug', 0.08, 0.12], [0.12, 1.38, 'cone', 0.16, 0.16]];
  for (const [dx, yy, mat, w, h] of items) { const shelf = yy < 0.75 ? 0.506 : yy < 1.15 ? 0.906 : 1.306; mb(mat).rbox(x + dx, y + shelf + h / 2, z + sign * 0.2, w, h, Math.min(0.2, w + 0.04), { r: Math.min(0.02, w / 4), uv: 0 }); }
  f.col(x - 0.42, Math.min(z, fz), x + 0.42, Math.max(z, fz), y, y + 1.9);
  f.interact({ kind: 'fridge', id, label: 'Open the fridge', min: [x - 0.45, y, Math.min(z, fz + sign * 0.1)], max: [x + 0.45, y + 1.9, Math.max(z, fz + sign * 0.1)], pri: 1 });
  return { id, kind: 'fridge', hinge: [x + 0.4, y + 0.06, fz + sign * 0.03], w: 0.8, h: 1.76, t: 0.06, base: Math.PI, openSign: sign > 0 ? 1 : -1, max: 1.85, mat: 'fridgeDoor', y, label: 'fridge' };
}

/** Vending machine with a lit front and a delivery tray. */
export function vendingMachine(f, x, z, sign, y = 0, { id = 'pd_vending', drinks = false } = {}) {
  const { mb } = f; const fz = z + sign * 0.38;
  mb(drinks ? 'blue' : 'red').rbox(x, y + 0.95, z, 0.9, 1.9, 0.75, { r: 0.02, uv: 0, ao: 0.15 });
  mb('vendfront').panel(x - 0.08, y + 1.15, fz + sign * 0.003, 0.62, 1.3, 'z', sign);
  mb('glass').panel(x - 0.08, y + 1.15, fz + sign * 0.006, 0.62, 1.3, 'z', sign);
  mb('dark').box(x - 0.08, y + 0.32, fz, 0.6, 0.2, 0.03); mb('blackgloss').box(x + 0.32, y + 1.25, fz, 0.16, 0.5, 0.02); mb('led').box(x + 0.32, y + 1.42, fz + sign * 0.012, 0.1, 0.03, 0.005);
  f.col(x - 0.47, Math.min(z - sign * 0.38, fz), x + 0.47, Math.max(z - sign * 0.38, fz), y, y + 1.9);
  f.interact({ kind: 'vending', id, label: drinks ? 'Buy a drink' : 'Buy a snack', min: [x - 0.5, y, Math.min(fz, fz + sign * 0.15)], max: [x + 0.5, y + 1.9, Math.max(fz, fz + sign * 0.15)], pri: 1, tray: [x - 0.08, y + 0.32, fz - sign * 0.06], sign });
}

// ---------------------------------------------------------------- law enforcement
export function gunRack(f, x, z, r, y = 0, { n = 6 } = {}) {
  const { mb } = f; const P = rot2(x, z, r); const w = n * 0.2 + 0.2;
  mb('satin').rbox(x, y + 1.0, z, w, 2.0, 0.42, { rotY: r, r: 0.01, color: [0.18, 0.2, 0.22] });
  for (let i = 0; i < n; i++) { const [rx, rz] = P(-w / 2 + 0.2 + i * 0.2, -0.16); const DARK = [0.045, 0.047, 0.05];
    mb('satin').box(rx, y + 0.55, rz, 0.05, 0.24, 0.06, { rotY: r, color: DARK }); mb('satin').box(rx, y + 0.82, rz, 0.05, 0.3, 0.06, { rotY: r, color: DARK });
    mb('satin').box(rx, y + 1.12, rz, 0.04, 0.3, 0.05, { rotY: r, color: DARK }); mb('satin').cylinder(rx, y + 1.42, rz, 0.009, 0.3, 6, { color: DARK }); }
  const [gx, gz] = P(0, -0.215); mb('glassFrost').box(gx, y + 1.05, gz, w - 0.06, 1.8, 0.01, { rotY: r });
  colRot(f, x, z, w, 0.42, r, y, 2);
}

export function vestRack(f, x, z, r, y = 0, n = 6) {
  const { mb } = f; const P = rot2(x, z, r); const w = n * 0.32;
  mb('chrome').box(x, y + 1.7, z, w, 0.03, 0.03, { rotY: r }); for (const s of [-1, 1]) { const [px, pz] = P(s * w / 2, 0); mb('chrome').cylinder(px, y + 0.85, pz, 0.015, 1.7, 6); }
  for (let i = 0; i < n; i++) { const [vx, vz] = P(-w / 2 + 0.16 + i * 0.32, 0); mb('matte').rbox(vx, y + 1.37, vz, 0.28, 0.62, 0.1, { rotY: r, r: 0.04, color: i % 3 === 2 ? [0.1, 0.12, 0.18] : [0.07, 0.07, 0.08] }); }
  colRot(f, x, z, w + 0.1, 0.3, r, y, 1.8);
}

export function radioCharger(f, x, y, z, axis, sign, n = 8) {
  const { mb } = f;
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 0.13;
    const [px, pz] = axis === 'z' ? [x + o, z + sign * 0.06] : [x + sign * 0.06, z + o];
    if (axis === 'z') mb('satin').rbox(px, y, pz, 0.08, 0.12, 0.1, { r: 0.01, color: [0.1, 0.11, 0.12] }); else mb('satin').rbox(px, y, pz, 0.1, 0.12, 0.08, { r: 0.01, color: [0.1, 0.11, 0.12] });
    if (axis === 'z') mb('satin').rbox(px, y + 0.13, pz, 0.06, 0.16, 0.045, { r: 0.01, color: [0.06, 0.06, 0.07] }); else mb('satin').rbox(px, y + 0.13, pz, 0.045, 0.16, 0.06, { r: 0.01, color: [0.06, 0.06, 0.07] });
    const led = mb(i % 4 === 1 ? 'beaconAmber' : 'beaconGreen'); if (axis === 'z') led.box(px, y - 0.03, pz + sign * 0.051, 0.02, 0.01, 0.01); else led.box(px + sign * 0.051, y - 0.03, pz, 0.01, 0.01, 0.02);
  }
  { const L = n * 0.13 + 0.06; if (axis === 'z') mb('dark').box(x, y + 0.02, z - sign * 0.01, L, 0.2, 0.06, { uv: 0 }); else mb('dark').box(x - sign * 0.01, y + 0.02, z, 0.06, 0.2, L, { uv: 0 }); } // wall rail
}

/** Interview table bolted to the floor with chairs + a camera dome in the corner. */
export function interviewSet(f, x, z, r, y = 0) {
  table(f, x, z, r, y, { w: 1.2, d: 0.75, top: 'laminate', chairs: 0 });
  const P = rot2(x, z, r);
  const [a, b] = P(0, 0.68); guestChair(f, a, b, r, y, { color: 'fabricBlue' });
  const [c, d] = P(-0.3, -0.68); guestChair(f, c, d, r + Math.PI, y, { color: 'fabricBlue' });
  const [e, g] = P(0.32, -0.68); guestChair(f, e, g, r + Math.PI, y, { color: 'fabricBlue' });
  f.mb('chrome').tube(x, y + 0.77, z, 0.02, 0.12, 'x', 8);
}

export function podium(f, x, z, r, y = 0) {
  const { mb } = f; const P = rot2(x, z, r);
  mb('woodDark').rbox(x, y + 0.55, z, 0.6, 1.1, 0.5, { rotY: r, r: 0.03, uv: 1, ao: 0.2 });
  const [tx, tz] = P(0, 0.03); mb('woodDark').rbox(tx, y + 1.14, tz, 0.66, 0.05, 0.58, { rotY: r, rotX: -0.15, r: 0.02, uv: 1 });
  const [sx, sz] = P(0, -0.252); mb('seal').panel(sx, y + 0.7, sz, 0.34, 0.34, 'z', -1, { rotY: r });
  const [mx, mz] = P(0.18, 0.1); mb('chrome').cylinder(mx, y + 1.3, mz, 0.006, 0.26, 6); mb('dark').sphere(mx, y + 1.44, mz, 0.022, 8, 6);
  colRot(f, x, z, 0.62, 0.52, r, y, 1.2);
}

export { rot2, colRot };
