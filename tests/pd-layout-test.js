// Police Department layout audit. Builds the station headlessly and checks, for every floor:
//   • every wall-mounted item (frames, boards, TVs, signs, chargers, mirrors…) sits flush on a real wall,
//     never over a doorway, window or a door leaf, never across a room corner, never under the ceiling line
//   • wall items don't overlap each other
//   • no furniture pokes into a wall, a doorway's swing/clearance zone or the open door leaf
//   • door leaves fit on their wall and never lie over glass
//   • NPC walking routes only pass through doors and never through furniture
//   • every room is reachable on foot and keeps plenty of open floor; every interactable can be reached
// Usage: node tests/pd-layout-test.js [--verbose]
import { buildCenter } from '../js/world/building.js';
import { PD } from '../js/world/policeDept.js';

const VERBOSE = process.argv.includes('--verbose');
const center = buildCenter({ detail: 1 });
const L = center.pdLayout;
const CH = PD.CEIL;
const fails = []; const warns = [];
const fail = (msg) => fails.push(msg); const warn = (msg) => warns.push(msg);
const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
const f2 = (v) => v.toFixed(2);

const wallsOn = (axis, c, lv) => L.walls.filter((w) => w.axis === axis && Math.abs(w.c - c) < 1e-6 && w.lv === lv);
const covered = (ws, a0, a1) => { let cur = a0; for (const w of ws.slice().sort((p, q) => p.a0 - q.a0)) { if (w.a0 <= cur + 1e-3 && w.a1 > cur) cur = w.a1; } return cur >= a1 - 1e-3; };
const perpTouching = (axis, c, s, lv, a0, a1) => L.walls.filter((w) => w.lv === lv && w.axis !== axis && w.c > a0 + 0.01 && w.c < a1 - 0.01 && w.a0 - 0.01 <= c && w.a1 + 0.01 >= c && (s > 0 ? w.a1 > c + 0.02 : w.a0 < c - 0.02));

// ------------------------------------------------------------------ 1. wall-mounted items
for (const m of L.mounts) {
  const tag = `[F${m.lv + 1}] ${m.what} @ ${m.axis === 'z' ? `x ${f2((m.a0 + m.a1) / 2)} z ${f2(m.c)}` : `z ${f2((m.a0 + m.a1) / 2)} x ${f2(m.c)}`}`;
  const ws = wallsOn(m.axis, m.c, m.lv);
  if (!ws.length) { fail(`${tag}: not on any wall (floating)`); continue; }
  if (!covered(ws, m.a0 + 0.005, m.a1 - 0.005)) fail(`${tag}: hangs past the end of its wall (${f2(m.a0)}..${f2(m.a1)})`);
  const flush = ws.some((w) => Math.abs(w.c + m.s * w.thick / 2 - m.surf) < 0.002);
  if (!flush) fail(`${tag}: not flush with the wall surface`);
  const ry0 = m.y0 - m.Y, ry1 = m.y1 - m.Y;
  if (ry1 > CH - 0.02) fail(`${tag}: runs into the ceiling (top ${f2(ry1)})`);
  if (ry0 < -0.001) fail(`${tag}: below the floor`);
  for (const w of ws) for (const o of w.ops) {
    if (ov(m.a0, m.a1, o.a - 0.03, o.b + 0.03) > 0.005 && ov(ry0, ry1, o.sill, o.head) > 0.005) fail(`${tag}: covers a ${o.type} (${f2(o.a)}..${f2(o.b)})`);
    if (o.leaf && o.side === m.s && ov(m.a0, m.a1, o.leaf[0], o.leaf[1]) > 0.005 && ry0 < 2.25) fail(`${tag}: behind an open door leaf (${f2(o.leaf[0])}..${f2(o.leaf[1])})`);
  }
  for (const w of perpTouching(m.axis, m.c, m.s, m.lv, m.a0, m.a1)) fail(`${tag}: runs through the corner wall at ${f2(w.c)}`);
}
// overlaps between wall items on the same face
for (let i = 0; i < L.mounts.length; i++) for (let j = i + 1; j < L.mounts.length; j++) {
  const a = L.mounts[i], b = L.mounts[j];
  if (a.lv !== b.lv || a.axis !== b.axis || Math.abs(a.c - b.c) > 1e-6 || a.s !== b.s) continue;
  if (a.what === 'wainscot' && b.what === 'wainscot') continue;
  if (ov(a.a0, a.a1, b.a0, b.a1) > 0.005 && ov(a.y0, a.y1, b.y0, b.y1) > 0.005) fail(`[F${a.lv + 1}] "${a.what}" overlaps "${b.what}" on wall ${a.axis}=${f2(a.c)} (${f2(Math.max(a.a0, b.a0))}..${f2(Math.min(a.a1, b.a1))})`);
}

// ------------------------------------------------------------------ 2. doors, leaves, furniture vs walls / doorways
const lvOf = (y) => (y >= PD.F2 - 0.3 ? 1 : 0);
const furn = L.furnCols.map((c) => ({ c, lv: lvOf(c[4]) }));
const boxHit = (b, x0, z0, x1, z1, m = 0) => ov(b[0], b[2], x0 + m, x1 - m) > 0.001 && ov(b[1], b[3], z0 + m, z1 - m) > 0.001;
for (const w of L.walls) {
  for (const o of w.ops) {
    if (o.type !== 'door' && o.type !== 'pass') continue;
    const tag = `[F${w.lv + 1}] ${o.type} ${w.axis}=${f2(w.c)} @ ${f2(o.a)}..${f2(o.b)}`;
    for (const s of [-1, 1]) { // clearance in front of the doorway on both sides
      const surf = w.c + s * w.thick / 2; const d0 = Math.min(surf, surf + s * 0.9), d1 = Math.max(surf, surf + s * 0.9);
      const [x0, z0, x1, z1] = w.axis === 'z' ? [o.a, d0, o.b, d1] : [d0, o.a, d1, o.b];
      for (const f of furn) if (f.lv === w.lv && f.c[4] < w.Y + 2.0 && boxHit(f.c, x0, z0, x1, z1, 0.02)) fail(`${tag}: furniture in the doorway (${f.c.map(f2).join(', ')})`);
    }
    if (o.leaf) {
      const [l0, l1] = o.leaf;
      if (l0 < w.a0 - 0.01 || l1 > w.a1 + 0.01) fail(`${tag}: door leaf runs off the end of its wall`);
      for (const pw of perpTouching(w.axis, w.c, o.side, w.lv, l0, l1)) fail(`${tag}: door leaf swings through the wall at ${f2(pw.c)}`);
      for (const g of w.ops) if (g !== o && g.type !== 'door' && g.type !== 'pass' && ov(l0, l1, g.a, g.b) > 0) fail(`${tag}: door leaf lies over a ${g.type}`);
      for (const g of w.ops) if (g !== o && (g.type === 'door' || g.type === 'pass') && ov(l0, l1, g.a - 0.03, g.b + 0.03) > 0) fail(`${tag}: door leaf blocks the next doorway`);
      const surf = w.c + o.side * w.thick / 2; const d0 = Math.min(surf, surf + o.side * 0.12), d1 = Math.max(surf, surf + o.side * 0.12);
      const [x0, z0, x1, z1] = w.axis === 'z' ? [l0, d0, l1, d1] : [d0, l0, d1, l1];
      for (const f of furn) if (f.lv === w.lv && boxHit(f.c, x0, z0, x1, z1, 0.005)) fail(`${tag}: furniture behind the open door leaf (${f.c.map(f2).join(', ')})`);
    }
  }
}
// furniture pushing into walls (more than 3 cm)
const wallCols = L.wallCols.map((c) => ({ c, lv: lvOf(c[4]) }));
for (const f of furn) for (const w of wallCols) {
  if (f.lv !== w.lv || ov(f.c[4], f.c[5], w.c[4], w.c[5]) <= 0.01) continue;
  const dx = ov(f.c[0], f.c[2], w.c[0], w.c[2]), dz = ov(f.c[1], f.c[3], w.c[1], w.c[3]);
  if (dx > 0 && dz > 0 && Math.min(dx, dz) > 0.03) fail(`[F${f.lv + 1}] furniture clips into a wall by ${f2(Math.min(dx, dz))} m (${f.c.map(f2).join(', ')})`);
}
// furniture overlapping other furniture (more than 5 cm both ways) – a sign of things placed on top of each other
for (let i = 0; i < furn.length; i++) for (let j = i + 1; j < furn.length; j++) {
  const a = furn[i], b = furn[j]; if (a.lv !== b.lv || ov(a.c[4], a.c[5], b.c[4], b.c[5]) <= 0.01) continue;
  const dx = ov(a.c[0], a.c[2], b.c[0], b.c[2]), dz = ov(a.c[1], a.c[3], b.c[1], b.c[3]);
  if (dx > 0.05 && dz > 0.05) warn(`[F${a.lv + 1}] furniture overlap ${f2(dx)}×${f2(dz)} m: (${a.c.slice(0, 4).map(f2).join(', ')}) / (${b.c.slice(0, 4).map(f2).join(', ')})`);
}

// ------------------------------------------------------------------ 3. NPC routes
const N = center.nav; const byId = new Map(N.nodes.map((n) => [n.id, n]));
const inside = (b, x, z) => x > b[0] && x < b[2] && z > b[1] && z < b[3];
const segBox = (ax, az, bx, bz, b) => { // Liang–Barsky
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, q] of [[-dx, ax - b[0]], [dx, b[2] - ax], [-dz, az - b[1]], [dz, b[3] - az]]) { if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; } const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
  return t1 - t0 > 1e-6;
};
const pdNode = (n) => n.x > PD.x0 - 0.5 && n.x < PD.x1 + 0.5 && n.z > PD.z0 - 0.5 && n.z < PD.z1 + 0.3 && !n.outside;
for (const n of N.nodes) {
  if (!pdNode(n) || n.sit != null || n.stall) continue;
  const lv = (n.y || 0) > 2.5 ? 1 : 0; if ((n.y || 0) > 0.3 && (n.y || 0) < 3.7) continue; // on a stair
  for (const f of furn) if (f.lv === lv && f.c[4] < (lv ? PD.F2 : 0) + 1.5 && inside([f.c[0] + 0.02, f.c[1] + 0.02, f.c[2] - 0.02, f.c[3] - 0.02], n.x, n.z)) fail(`node ${n.id} stands inside furniture`);
}
for (const [ia, ib] of N.links) {
  const A = byId.get(ia), B = byId.get(ib); if (!A || !B) { if (ia.startsWith('p') && ib.startsWith('p')) fail(`link to a missing node: ${ia} – ${ib}`); continue; }
  if (!pdNode(A) && !pdNode(B)) continue;
  if (Math.abs((A.y || 0) - (B.y || 0)) > 0.3) continue; // stairs
  const y = A.y || 0; if (y > 0.3 && y < 3.7) continue;
  const lv = y > 2.5 ? 1 : 0;
  for (const w of L.walls) {
    if (w.lv !== lv) continue;
    // intersection with the wall line
    const [pa, pb, qa, qb] = w.axis === 'z' ? [A.z, B.z, A.x, B.x] : [A.x, B.x, A.z, B.z];
    if ((pa - w.c) * (pb - w.c) >= 0) continue;
    const t = (w.c - pa) / (pb - pa); const at = qa + (qb - qa) * t; if (at < w.a0 - 0.05 || at > w.a1 + 0.05) continue;
    const ok = w.ops.some((o) => (o.type === 'door' || o.type === 'pass') && at > o.a + 0.12 && at < o.b - 0.12);
    if (!ok) fail(`route ${ia} → ${ib} walks through the wall ${w.axis}=${f2(w.c)} at ${f2(at)}`);
  }
  for (const f of furn) {
    if (f.lv !== lv || f.c[4] > y + 1.5 || f.c[5] < y + 0.15) continue;
    const b = [f.c[0] + 0.03, f.c[1] + 0.03, f.c[2] - 0.03, f.c[3] - 0.03];
    if (inside(f.c, A.x, A.z) || inside(f.c, B.x, B.z)) continue;
    if (segBox(A.x, A.z, B.x, B.z, b)) fail(`route ${ia} → ${ib} walks through furniture (${f.c.slice(0, 4).map(f2).join(', ')})`);
  }
}
// every PD node must connect to the dispatch floor
{ const adj = new Map(N.nodes.map((n) => [n.id, []])); for (const [a, b] of N.links) { if (adj.has(a) && adj.has(b)) { adj.get(a).push(b); adj.get(b).push(a); } }
  const seen = new Set(['p_disp']); const q = ['p_disp']; while (q.length) for (const nb of adj.get(q.shift()) || []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
  for (const n of N.nodes) if (n.id.startsWith('p') && pdNode(n) && !seen.has(n.id)) fail(`node ${n.id} can't be reached from the dispatch floor`); }

// node ids other systems rely on (NPC routines, staff homes, events) must all exist
{ const fs = await import('node:fs'); const path = await import('node:path'); const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
  const files = []; const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js') && !p.endsWith('policeDept.js')) files.push(p); } }; walk(root);
  for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/'(p2?_[a-zA-Z0-9_]+)'/g)) { const id = m[1]; if (/^p2?_(rr[mw]|st[mw]\d?)$/.test(id) || id === 'pd_') continue; if (!byId.has(id) && !/[${}]/.test(id)) fail(`${path.basename(f)} uses route node '${id}', which no longer exists`); } }

// ------------------------------------------------------------------ 4. walking: reachability and open floor
const STEP = 0.1, R = 0.3;
const reachFloor = (lv, start) => {
  const Y = lv ? PD.F2 : 0; const nx = Math.round((PD.x1 - PD.x0) / STEP), nz = Math.round((PD.z1 - PD.z0) / STEP);
  const blocked = new Uint8Array(nx * nz);
  const cols = center.colliders.filter((c) => c[5] > Y + 0.35 && c[4] < Y + 1.8);
  for (const c of cols) {
    const i0 = Math.max(0, Math.floor((c[0] - R - PD.x0) / STEP)), i1 = Math.min(nx - 1, Math.ceil((c[2] + R - PD.x0) / STEP));
    const j0 = Math.max(0, Math.floor((c[1] - R - PD.z0) / STEP)), j1 = Math.min(nz - 1, Math.ceil((c[3] + R - PD.z0) / STEP));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const x = PD.x0 + (i + 0.5) * STEP, z = PD.z0 + (j + 0.5) * STEP; if (x > c[0] - R && x < c[2] + R && z > c[1] - R && z < c[3] + R) blocked[i * nz + j] = 1; }
  }
  // the stair openings are not floor on the 2nd story
  if (lv) for (const s of [[5, -15, 8.6, -9.6], [-12, -24.4, -8.6, -19.8]]) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = PD.x0 + (i + 0.5) * STEP, z = PD.z0 + (j + 0.5) * STEP; if (x > s[0] && x < s[2] && z > s[1] && z < s[3]) blocked[i * nz + j] = 1; }
  const seen = new Uint8Array(nx * nz); const si = Math.floor((start[0] - PD.x0) / STEP), sj = Math.floor((start[1] - PD.z0) / STEP);
  const q = [si * nz + sj]; seen[q[0]] = 1;
  while (q.length) { const k = q.pop(); const i = Math.floor(k / nz), j = k % nz; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const kk = a * nz + b; if (!seen[kk] && !blocked[kk]) { seen[kk] = 1; q.push(kk); } } }
  return { reach: (x, z) => { const i = Math.floor((x - PD.x0) / STEP), j = Math.floor((z - PD.z0) / STEP); return i >= 0 && j >= 0 && i < nx && j < nz && !!seen[i * nz + j]; }, near: (x, z, r) => { for (let dx = -r; dx <= r; dx += STEP) for (let dz = -r; dz <= r; dz += STEP) if (dx * dx + dz * dz <= r * r) { const i = Math.floor((x + dx - PD.x0) / STEP), j = Math.floor((z + dz - PD.z0) / STEP); if (i >= 0 && j >= 0 && i < nx && j < nz && seen[i * nz + j]) return true; } return false; } };
};
const floors = [reachFloor(0, [7.6, -35.0]), reachFloor(1, [-3.0, -40.0])];
const roomStats = [];
for (const r of L.rooms) {
  const [x0, z0, x1, z1] = r.r; const F = floors[r.lv]; let tot = 0, ok = 0;
  for (let x = x0 + 0.05; x < x1; x += STEP) for (let z = z0 + 0.05; z < z1; z += STEP) { tot++; if (F.reach(x, z)) ok++; }
  const frac = ok / tot; const area = (x1 - x0) * (z1 - z0); roomStats.push({ name: r.name, lv: r.lv, area, frac });
  if (ok === 0) fail(`[F${r.lv + 1}] ${r.name}: can't be walked into`);
  else if (frac < 0.32 && !/closet|janitor|supply|alcove|restroom|storage/i.test(r.name)) fail(`[F${r.lv + 1}] ${r.name}: only ${(frac * 100).toFixed(0)}% of the floor is walkable – too cramped`);
}
for (const it of center.interactables) {
  if (!String(it.id).startsWith('pd_') || it.id === 'pd_rangedoor' || it.dynamic) continue;
  const lv = it.min[1] > 3 ? 1 : 0; const cx = (it.min[0] + it.max[0]) / 2, cz = (it.min[2] + it.max[2]) / 2;
  const R2 = Math.max(it.max[0] - it.min[0], it.max[2] - it.min[2]) / 2 + 1.3;
  if (!floors[lv].near(cx, cz, R2)) fail(`[F${lv + 1}] interactable ${it.id} can't be reached on foot`);
}

// ------------------------------------------------------------------ 5. signs
for (const h of L.hangs) { if (h.y0 - (h.lv ? PD.F2 : 0) < 2.4) fail(`hanging sign "${h.text}" is below head height`); const inRoom = L.rooms.some((r) => r.lv === h.lv && h.x > r.r[0] && h.x < r.r[2] && h.z > r.r[1] && h.z < r.r[3]); if (!inRoom) fail(`hanging sign "${h.text}" is outside the building`); }
const atlas = center.screens.find((s) => s.key === 'scr_pd_signs');
if (!atlas) fail('sign atlas missing'); else if (atlas.atlasH > 4096) fail(`sign atlas too tall (${atlas.atlasH})`);

// ------------------------------------------------------------------ report
const fmtRooms = roomStats.filter((r) => !/Corridor/.test(r.name)).map((r) => `  F${r.lv + 1} ${r.name.padEnd(28)} ${r.area.toFixed(0).padStart(4)} m²  ${(r.frac * 100).toFixed(0).padStart(3)}% open`).join('\n');
if (VERBOSE) { console.log(fmtRooms); for (const w of warns) console.log('warn:', w); }
console.log(`PD layout: ${L.walls.length} walls, ${L.mounts.length} wall items, ${furn.length} furniture colliders, ${N.nodes.filter(pdNode).length} route nodes, ${L.rooms.length} rooms, atlas ${atlas?.atlasW}×${atlas?.atlasH} (${atlas?.items.length} signs)`);
if (warns.length) console.log(`${warns.length} warnings (run with --verbose)`);
if (fails.length) { console.log(`\n${fails.length} problems:`); for (const f of fails) console.log('  ✗', f); process.exit(1); }
console.log('✓ all police station layout checks passed');
