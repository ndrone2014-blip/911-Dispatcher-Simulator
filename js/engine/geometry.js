// Geometry builder: accumulates primitives into one buffer (static batching).
export class MeshBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  get vcount() { return this.p.length / 3; }

  quad(v0, v1, v2, v3, normal, uvs, color = [1, 1, 1], colors) {
    const b = this.vcount;
    [v0, v1, v2, v3].forEach((v, k) => { this.p.push(...v); this.n.push(...normal); this.uv.push(...uvs[k]); this.c.push(...(colors ? colors[k] : color)); });
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  /**
   * Axis-aligned box (optionally rotated around Y about its center).
   * opts: color, uv (meters per texture repeat, 0 = stretch 0..1 per face), faces (string of included faces: +x -x +y -y +z -z), ao, rotY
   */
  box(cx, cy, cz, sx, sy, sz, opts = {}) {
    const { color = this.tint || [1, 1, 1], uv = 1, faces = 'xXyYzZ', ao = 0, rotY = 0, uvFront } = opts;
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const cr = Math.cos(rotY), sr = Math.sin(rotY);
    const P = (x, y, z) => [cx + x * cr + z * sr, cy + y, cz - x * sr + z * cr];
    const N = (x, y, z) => [x * cr + z * sr, y, -x * sr + z * cr];
    const U = (a, b) => (uv ? [a / uv, b / uv] : null);
    const bottomShade = (y) => (ao && y < 0 ? color.map((c) => c * (1 - ao)) : color);
    const face = (verts, nrm, uvs) => this.quad(verts[0], verts[1], verts[2], verts[3], nrm, uvs, color, verts.map((_, k) => bottomShade(verts[k].__y)));
    const mk = (x, y, z) => { const v = P(x, y, z); v.__y = y; return v; };
    const stretch = [[0, 0], [1, 0], [1, 1], [0, 1]];
    if (faces.includes('Z')) face([mk(-hx, -hy, hz), mk(hx, -hy, hz), mk(hx, hy, hz), mk(-hx, hy, hz)], N(0, 0, 1), uvFront || (uv ? [U(0, 0), U(sx, 0), U(sx, sy), U(0, sy)] : stretch));
    if (faces.includes('z')) face([mk(hx, -hy, -hz), mk(-hx, -hy, -hz), mk(-hx, hy, -hz), mk(hx, hy, -hz)], N(0, 0, -1), uv ? [U(0, 0), U(sx, 0), U(sx, sy), U(0, sy)] : stretch);
    if (faces.includes('X')) face([mk(hx, -hy, hz), mk(hx, -hy, -hz), mk(hx, hy, -hz), mk(hx, hy, hz)], N(1, 0, 0), uv ? [U(0, 0), U(sz, 0), U(sz, sy), U(0, sy)] : stretch);
    if (faces.includes('x')) face([mk(-hx, -hy, -hz), mk(-hx, -hy, hz), mk(-hx, hy, hz), mk(-hx, hy, -hz)], N(-1, 0, 0), uv ? [U(0, 0), U(sz, 0), U(sz, sy), U(0, sy)] : stretch);
    if (faces.includes('Y')) face([mk(-hx, hy, hz), mk(hx, hy, hz), mk(hx, hy, -hz), mk(-hx, hy, -hz)], N(0, 1, 0), uv ? [U(cx - hx, cz + hz), U(cx + hx, cz + hz), U(cx + hx, cz - hz), U(cx - hx, cz - hz)] : stretch);
    if (faces.includes('y')) face([mk(-hx, -hy, -hz), mk(hx, -hy, -hz), mk(hx, -hy, hz), mk(-hx, -hy, hz)], N(0, -1, 0), uv ? [U(cx - hx, cz - hz), U(cx + hx, cz - hz), U(cx + hx, cz + hz), U(cx - hx, cz + hz)] : stretch);
    return this;
  }

  /** Vertical wall segment from (x0,z0) to (x1,z1), both sides, with world UVs. */
  wall(x0, z0, x1, z1, y0, y1, thick = 0.15, opts = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0); const ang = Math.atan2(-(z1 - z0), x1 - x0);
    return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, len, y1 - y0, thick, { ...opts, rotY: ang });
  }

  cylinder(cx, cy, cz, r, h, segs = 16, opts = {}) {
    const { color = this.tint || [1, 1, 1], caps = true, r2 = r } = opts;
    const b = this.vcount;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
      this.p.push(cx + x * r, cy - h / 2, cz + z * r, cx + x * r2, cy + h / 2, cz + z * r2);
      this.n.push(x, 0, z, x, 0, z); this.uv.push(s / segs, 0, s / segs, 1); this.c.push(...color, ...color);
    }
    for (let s = 0; s < segs; s++) { const k = b + s * 2; this.i.push(k, k + 1, k + 3, k, k + 3, k + 2); }
    if (caps) for (const [yy, ny, rr] of [[cy + h / 2, 1, r2], [cy - h / 2, -1, r]]) {
      const c0 = this.vcount; this.p.push(cx, yy, cz); this.n.push(0, ny, 0); this.uv.push(0.5, 0.5); this.c.push(...color);
      for (let s = 0; s <= segs; s++) { const a = (s / segs) * Math.PI * 2; this.p.push(cx + Math.cos(a) * rr, yy, cz + Math.sin(a) * rr); this.n.push(0, ny, 0); this.uv.push(0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2); this.c.push(...color); }
      for (let s = 0; s < segs; s++) ny > 0 ? this.i.push(c0, c0 + s + 2, c0 + s + 1) : this.i.push(c0, c0 + s + 1, c0 + s + 2);
    }
    return this;
  }

  sphere(cx, cy, cz, r, segs = 12, rings = 8, opts = {}) {
    const { color = this.tint || [1, 1, 1], sy = 1 } = opts; const b = this.vcount;
    for (let y = 0; y <= rings; y++) {
      const v = y / rings, phi = v * Math.PI;
      for (let x = 0; x <= segs; x++) {
        const u = x / segs, th = u * Math.PI * 2;
        const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        this.p.push(cx + nx * r, cy + ny * r * sy, cz + nz * r); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(...color);
      }
    }
    for (let y = 0; y < rings; y++) for (let x = 0; x < segs; x++) { const a = b + y * (segs + 1) + x, c = a + segs + 1; this.i.push(a, a + 1, c, a + 1, c + 1, c); }
    return this;
  }

  /** Flat quad facing +normal axis; used for screens, signs, windows. */
  panel(cx, cy, cz, w, h, axis = 'z', sign = 1, opts = {}) {
    const { color = this.tint || [1, 1, 1], rotY = 0, uvRect = [0, 0, 1, 1] } = opts;
    const [u0, v0, u1, v1] = uvRect; const hw = w / 2, hh = h / 2;
    const cr = Math.cos(rotY), sr = Math.sin(rotY);
    const R = (x, y, z) => [cx + x * cr + z * sr, cy + y, cz - x * sr + z * cr];
    let verts, n;
    if (axis === 'z') { verts = sign > 0 ? [[-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0]] : [[hw, -hh, 0], [-hw, -hh, 0], [-hw, hh, 0], [hw, hh, 0]]; n = [0, 0, sign]; }
    else if (axis === 'x') { verts = sign > 0 ? [[0, -hh, hw], [0, -hh, -hw], [0, hh, -hw], [0, hh, hw]] : [[0, -hh, -hw], [0, -hh, hw], [0, hh, hw], [0, hh, -hw]]; n = [sign, 0, 0]; }
    else { verts = sign > 0 ? [[-hw, 0, hh], [hw, 0, hh], [hw, 0, -hh], [-hw, 0, -hh]] : [[-hw, 0, -hh], [hw, 0, -hh], [hw, 0, hh], [-hw, 0, hh]]; n = [0, sign, 0]; }
    const rn = [n[0] * cr + n[2] * sr, n[1], -n[0] * sr + n[2] * cr];
    this.quad(R(...verts[0]), R(...verts[1]), R(...verts[2]), R(...verts[3]), rn, [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], color);
    return this;
  }

  /**
   * Rounded box (smooth bevelled edges) – real dimensions, radius r in meters.
   * opts: color, r, seg (arc steps per edge), rotY, rotX (tilt about local X, applied first), uv (meters per repeat, 0 = per-face 0..1), ao
   */
  rbox(cx, cy, cz, sx, sy, sz, opts = {}) {
    const { color = this.tint || [1, 1, 1], seg = this.seg || 3, rotY = 0, rotX = 0, uv = 1, ao = 0 } = opts;
    const h = [sx / 2, sy / 2, sz / 2];
    const r = Math.max(0.0005, Math.min(opts.r ?? 0.02, h[0], h[1], h[2]));
    const inner = h.map((v) => v - r);
    const coords = (a) => { const L = []; for (let i = 0; i <= seg; i++) L.push(-inner[a] - r * Math.cos((i / seg) * Math.PI / 2)); for (let i = seg; i >= 0; i--) L.push(inner[a] + r * Math.cos((i / seg) * Math.PI / 2)); return L; };
    const C = [coords(0), coords(1), coords(2)];
    const cyw = Math.cos(rotY), syw = Math.sin(rotY), cxr = Math.cos(rotX), sxr = Math.sin(rotX);
    const xf = (x, y, z) => { const y1 = y * cxr - z * sxr, z1 = y * sxr + z * cxr; return [x * cyw + z1 * syw, y1, -x * syw + z1 * cyw]; };
    // faces: [normal axis, sign, u axis, v axis]
    const faces = [[2, 1, 0, 1], [2, -1, 0, 1], [0, 1, 2, 1], [0, -1, 2, 1], [1, 1, 0, 2], [1, -1, 0, 2]];
    for (const [na, sg, ua, va] of faces) {
      const U = C[ua], Vv = C[va]; const b = this.vcount; const nu = U.length, nv = Vv.length;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const p = [0, 0, 0]; p[na] = sg * h[na]; p[ua] = (na === 2 && sg < 0) || (na === 0 && sg > 0) || (na === 1 && sg > 0) ? -U[i] : U[i]; p[va] = Vv[j];
        const q = p.map((v, k) => Math.max(-inner[k], Math.min(inner[k], v)));
        let d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]]; const dl = Math.hypot(...d) || 1; d = d.map((v) => v / dl);
        const pos = [q[0] + d[0] * r, q[1] + d[1] * r, q[2] + d[2] * r];
        const w = xf(...pos), n = xf(...d);
        this.p.push(cx + w[0], cy + w[1], cz + w[2]); this.n.push(...n);
        this.uv.push(uv ? (p[ua] + h[ua]) / uv : i / (nu - 1), uv ? (p[va] + h[va]) / uv : j / (nv - 1));
        const shade = ao && pos[1] < -inner[1] * 0.6 ? 1 - ao : 1; this.c.push(color[0] * shade, color[1] * shade, color[2] * shade);
      }
      for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = b + j * nu + i; this.i.push(a, a + 1, a + nu + 1, a, a + nu + 1, a + nu); }
    }
    return this;
  }

  /** Cylinder along any axis ('x' | 'y' | 'z'). Same options as cylinder(), plus rotY for 'x'/'z'. */
  tube(cx, cy, cz, r, len, axis = 'x', segs = 12, opts = {}) {
    const start = this.vcount;
    this.cylinder(0, 0, 0, r, len, segs, opts);
    const rotY = opts.rotY || 0; const cr = Math.cos(rotY), sr = Math.sin(rotY);
    for (let v = start; v < this.vcount; v++) {
      for (const arr of [this.p, this.n]) {
        let x = arr[v * 3], y = arr[v * 3 + 1], z = arr[v * 3 + 2];
        if (axis === 'x') [x, y] = [y, -x]; else if (axis === 'z') [y, z] = [z, -y];
        const rx = x * cr + z * sr, rz = -x * sr + z * cr;
        arr[v * 3] = rx + (arr === this.p ? cx : 0); arr[v * 3 + 1] = y + (arr === this.p ? cy : 0); arr[v * 3 + 2] = rz + (arr === this.p ? cz : 0);
      }
    }
    return this;
  }

  /** Flat horizontal disc facing up (used for blob shadows, caps, plates). */
  disc(cx, cy, cz, r, segs = 20, opts = {}) {
    const { color = this.tint || [1, 1, 1], down = false } = opts; const c0 = this.vcount; const ny = down ? -1 : 1;
    this.p.push(cx, cy, cz); this.n.push(0, ny, 0); this.uv.push(0.5, 0.5); this.c.push(...color);
    for (let s = 0; s <= segs; s++) { const a = (s / segs) * Math.PI * 2; this.p.push(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r); this.n.push(0, ny, 0); this.uv.push(0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2); this.c.push(...color); }
    for (let s = 0; s < segs; s++) down ? this.i.push(c0, c0 + s + 1, c0 + s + 2) : this.i.push(c0, c0 + s + 2, c0 + s + 1);
    return this;
  }

  build() { return { positions: new Float32Array(this.p), normals: new Float32Array(this.n), uvs: new Float32Array(this.uv), colors: new Float32Array(this.c), indices: this.i }; }
}
