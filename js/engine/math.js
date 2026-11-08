// Minimal 3D math (column-major mat4 compatible with WebGL).
export function mat4() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }

export function perspective(out, fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  out.fill(0); out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
  return out;
}

export function multiply(out, a, b) {
  const r = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    r[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
  }
  out.set(r); return out;
}

/** View matrix from position + yaw (around Y) + pitch (around X). Yaw 0 looks toward -Z. */
export function viewFromYawPitch(out, pos, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  // camera basis
  const fx = -sy * cp, fy = sp, fz = -cy * cp; // forward
  const rx = cy, ry = 0, rz = -sy; // right
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx; // up = right x forward
  out[0] = rx; out[1] = ux; out[2] = -fx; out[3] = 0;
  out[4] = ry; out[5] = uy; out[6] = -fy; out[7] = 0;
  out[8] = rz; out[9] = uz; out[10] = -fz; out[11] = 0;
  out[12] = -(rx * pos[0] + ry * pos[1] + rz * pos[2]);
  out[13] = -(ux * pos[0] + uy * pos[1] + uz * pos[2]);
  out[14] = (fx * pos[0] + fy * pos[1] + fz * pos[2]);
  out[15] = 1;
  return out;
}

/** Model matrix from translation, Y rotation, X rotation (applied first) and uniform/vec scale. */
export function trs(out, x, y, z, rotY = 0, rotX = 0, sx = 1, sy = sx, sz = sx, rotZ = 0) {
  const cy = Math.cos(rotY), syn = Math.sin(rotY), cx = Math.cos(rotX), sxn = Math.sin(rotX), cz = Math.cos(rotZ), szn = Math.sin(rotZ);
  // R = Ry * Rx * Rz
  const m00 = cy * cz + syn * sxn * szn, m01 = -cy * szn + syn * sxn * cz, m02 = syn * cx;
  const m10 = cx * szn, m11 = cx * cz, m12 = -sxn;
  const m20 = -syn * cz + cy * sxn * szn, m21 = syn * szn + cy * sxn * cz, m22 = cy * cx;
  out[0] = m00 * sx; out[1] = m10 * sx; out[2] = m20 * sx; out[3] = 0;
  out[4] = m01 * sy; out[5] = m11 * sy; out[6] = m21 * sy; out[7] = 0;
  out[8] = m02 * sz; out[9] = m12 * sz; out[10] = m22 * sz; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}

export function forwardOf(yaw, pitch) { return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]; }

/** Ray vs axis-aligned box. Returns distance or -1. */
export function rayAABB(o, d, min, max) {
  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) { if (o[i] < min[i] || o[i] > max[i]) return -1; continue; }
    let t1 = (min[i] - o[i]) / d[i], t2 = (max[i] - o[i]) / d[i];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmax < 0 ? -1 : Math.max(0, tmin);
}

export function hexToRgb(hex) { const n = parseInt(hex.replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
export function srgbToLinear(c) { return c.map((v) => v ** 2.2); }
