// Character skeleton: 28 bones (body, face and hat), rest pivots from each person's own
// proportions, forward kinematics into GPU skinning matrices, and analytic two-bone IK
// for arms and legs (hands on keyboards, cups to mouths, feet planted on the floor).
//
// Model space: metres, origin between the feet, +y up, the character faces -z, and the
// character's right hand is on +x. A bone's pose is an Euler rotation plus a small
// translation offset (used for the pelvis, brows and mouth corners).

export const B = {
  root: 0, pelvis: 1, spine: 2, chest: 3, neck: 4, head: 5, jaw: 6, eyeL: 7, eyeR: 8, lidL: 9, lidR: 10, browL: 11, browR: 12, mouthL: 13, mouthR: 14,
  armL: 15, armR: 16, foreL: 17, foreR: 18, handL: 19, handR: 20, thighL: 21, thighR: 22, shinL: 23, shinR: 24, footL: 25, footR: 26, hat: 27,
};
export const NB = 28;
export const PARENT = [-1, 0, 1, 2, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 15, 16, 17, 18, 1, 1, 21, 22, 23, 24, 5];
// Limb bones use Z·X·Y Euler order (abduct · flex · twist) so a direction maps to angles analytically.
const LIMB = new Uint8Array(NB); for (const b of [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]) LIMB[b] = 1;
export const POSE_STRIDE = 6; // rx, ry, rz, tx, ty, tz

/** Rest-pose pivots for a body description (see appearance.js). */
export function makeSkeleton(body) {
  const H = body.H, f = body.sex === 'f';
  const P = Array.from({ length: NB }, () => [0, 0, 0]);
  const hh = body.head.hh;
  const C = [0, H - hh * 0.985, -0.004];            // head centre
  const shW = H * 0.097 * body.shoulders * (f ? 0.93 : 1) + (body.build - 1) * 0.03;
  const shY = H * 0.818, hipW = H * 0.05 * (f ? 1.07 : 1) * (0.9 + body.build * 0.1), hipY = H * 0.53;
  const L = { upper: H * 0.186, fore: H * 0.146, hand: H * 0.106, thigh: H * 0.245, shin: H * 0.244, ankle: H * 0.039, foot: H * 0.152 };
  P[B.pelvis] = [0, H * 0.548, 0.0]; P[B.spine] = [0, H * 0.615, 0.008]; P[B.chest] = [0, H * 0.712, 0.006];
  P[B.neck] = [0, H * 0.853, 0.012]; P[B.head] = [0, H * 0.903, 0.01]; P[B.hat] = P[B.head].slice();
  P[B.jaw] = [0, C[1] - 0.024, C[2] + 0.022];
  const fc = body.face;
  for (const [b, s] of [[B.eyeL, -1], [B.eyeR, 1]]) P[b] = [C[0] + s * fc.eyeX, C[1] + fc.eyeY, C[2] + fc.eyeZ];
  P[B.lidL] = P[B.eyeL].slice(); P[B.lidR] = P[B.eyeR].slice();
  for (const [b, s] of [[B.browL, -1], [B.browR, 1]]) P[b] = [s * fc.browX, C[1] + fc.browY, C[2] + fc.browZ];
  for (const [b, s] of [[B.mouthL, -1], [B.mouthR, 1]]) P[b] = [s * fc.mouthW, C[1] + fc.mouthY, C[2] + fc.mouthZ];
  for (const [s, a, fo, h] of [[-1, B.armL, B.foreL, B.handL], [1, B.armR, B.foreR, B.handR]]) {
    P[a] = [s * shW, shY, 0.012]; P[fo] = [s * shW, shY - L.upper, 0.012]; P[h] = [s * shW, shY - L.upper - L.fore, 0.012];
  }
  for (const [s, t, sh, ft] of [[-1, B.thighL, B.shinL, B.footL], [1, B.thighR, B.shinR, B.footR]]) {
    P[t] = [s * hipW, hipY, 0.0]; P[sh] = [s * hipW, hipY - L.thigh, 0.0]; P[ft] = [s * hipW, L.ankle, 0.004];
  }
  return { P, C, L, H, shW, shY, hipW, hipY };
}

// ---------------------------------------------------------------- small matrix kit
// Affine transforms as Float32Array(12): rotation (column-major 3x3) then translation.
export function rotEuler(o, rx, ry, rz, limb) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  if (limb) { // R = Rz · Rx · Ry
    // Rx·Ry
    const a00 = cy, a01 = 0, a02 = sy, a10 = sx * sy, a11 = cx, a12 = -sx * cy, a20 = -cx * sy, a21 = sx, a22 = cx * cy;
    o[0] = cz * a00 - sz * a10; o[3] = cz * a01 - sz * a11; o[6] = cz * a02 - sz * a12;
    o[1] = sz * a00 + cz * a10; o[4] = sz * a01 + cz * a11; o[7] = sz * a02 + cz * a12;
    o[2] = a20; o[5] = a21; o[8] = a22;
  } else { // R = Ry · Rx · Rz
    o[0] = cy * cz + sy * sx * sz; o[3] = -cy * sz + sy * sx * cz; o[6] = sy * cx;
    o[1] = cx * sz; o[4] = cx * cz; o[7] = -sx;
    o[2] = -sy * cz + cy * sx * sz; o[5] = sy * sz + cy * sx * cz; o[8] = cy * cx;
  }
  return o;
}
const tmpR = new Float32Array(9);
/** out = A · (T(t) · R) where A is affine(12), R from tmpR. */
function compose(out, A, tx, ty, tz, R) {
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) out[c * 3 + r] = A[r] * R[c * 3] + A[3 + r] * R[c * 3 + 1] + A[6 + r] * R[c * 3 + 2];
  out[9] = A[0] * tx + A[3] * ty + A[6] * tz + A[9]; out[10] = A[1] * tx + A[4] * ty + A[7] * tz + A[10]; out[11] = A[2] * tx + A[5] * ty + A[8] * tz + A[11];
}
export function xformPoint(A, x, y, z) { return [A[0] * x + A[3] * y + A[6] * z + A[9], A[1] * x + A[4] * y + A[7] * z + A[10], A[2] * x + A[5] * y + A[8] * z + A[11]]; }
/** Inverse of a rigid affine applied to a point (into the bone's frame). */
export function invPoint(A, x, y, z) { const dx = x - A[9], dy = y - A[10], dz = z - A[11]; return [A[0] * dx + A[1] * dy + A[2] * dz, A[3] * dx + A[4] * dy + A[5] * dz, A[6] * dx + A[7] * dy + A[8] * dz]; }
export function invDir(A, x, y, z) { return [A[0] * x + A[1] * y + A[2] * z, A[3] * x + A[4] * y + A[5] * z, A[6] * x + A[7] * y + A[8] * z]; }

/**
 * Forward kinematics. pose: Float32Array(NB*6). Writes bone world transforms into `world`
 * (Float32Array NB*12) and GPU skin matrices (world · T(-pivot), column-major mat4) into `skin`.
 * `upto` lets IK evaluate the chain up to a bone without finishing the rest.
 */
const A = new Float32Array(12);
export function forward(sk, pose, root, world, skin, from = 0, upto = NB - 1, scaleHat = 1) {
  const P = sk.P;
  for (let b = from; b <= upto; b++) {
    const o = b * POSE_STRIDE; rotEuler(tmpR, pose[o], pose[o + 1], pose[o + 2], LIMB[b]);
    const p = PARENT[b];
    const W = world.subarray(b * 12, b * 12 + 12);
    if (p < 0) { compose(W, root, pose[o + 3], pose[o + 4], pose[o + 5], tmpR); }
    else {
      const pp = P[p], q = P[b]; A.set(world.subarray(p * 12, p * 12 + 12));
      compose(W, A, q[0] - pp[0] + pose[o + 3], q[1] - pp[1] + pose[o + 4], q[2] - pp[2] + pose[o + 5], tmpR);
    }
    if (b === B.hat && scaleHat !== 1) for (let k = 0; k < 9; k++) W[k] *= scaleHat;
    if (skin) {
      const S = skin.subarray(b * 16, b * 16 + 16); const q = P[b];
      S[0] = W[0]; S[1] = W[1]; S[2] = W[2]; S[3] = 0; S[4] = W[3]; S[5] = W[4]; S[6] = W[5]; S[7] = 0; S[8] = W[6]; S[9] = W[7]; S[10] = W[8]; S[11] = 0;
      S[12] = W[9] - (W[0] * q[0] + W[3] * q[1] + W[6] * q[2]); S[13] = W[10] - (W[1] * q[0] + W[4] * q[1] + W[7] * q[2]); S[14] = W[11] - (W[2] * q[0] + W[5] * q[1] + W[8] * q[2]); S[15] = 1;
    }
  }
}

/** Root transform for an NPC (position + yaw). */
export function rootOf(out, x, y, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  out[0] = c; out[1] = 0; out[2] = -s; out[3] = 0; out[4] = 1; out[5] = 0; out[6] = s; out[7] = 0; out[8] = c; out[9] = x; out[10] = y; out[11] = z;
  return out;
}

/**
 * Two-bone IK for a limb whose rest direction is straight down (-y).
 * S = joint position, T = target, both in the parent bone's frame (relative to that frame's axes).
 * pole: direction the middle joint should point toward. bend: +1 elbow (forearm folds forward), -1 knee.
 * Returns Euler angles [abduct z, flex x, twist y] for the upper bone and the hinge flex for the lower bone.
 */
export function solveLimb(S, T, a, b, pole, bend = 1) {
  let dx = T[0] - S[0], dy = T[1] - S[1], dz = T[2] - S[2];
  let D = Math.hypot(dx, dy, dz) || 1e-6;
  const maxD = (a + b) * 0.9995, minD = Math.abs(a - b) + 1e-3;
  const Dc = Math.min(maxD, Math.max(minD, D));
  dx /= D; dy /= D; dz /= D;
  // angle at the root joint between target line and upper bone
  const cosA = Math.min(1, Math.max(-1, (a * a + Dc * Dc - b * b) / (2 * a * Dc)));
  const alpha = Math.acos(cosA);
  // bend plane: pole projected perpendicular to the target line
  let px = pole[0], py = pole[1], pz = pole[2]; const pd = px * dx + py * dy + pz * dz;
  px -= pd * dx; py -= pd * dy; pz -= pd * dz; let pl = Math.hypot(px, py, pz);
  if (pl < 1e-5) { px = 0; py = 0; pz = -1; pl = 1; } px /= pl; py /= pl; pz /= pl;
  // upper bone direction = rotate target dir toward pole by alpha
  const ux = dx * Math.cos(alpha) + px * Math.sin(alpha), uy = dy * Math.cos(alpha) + py * Math.sin(alpha), uz = dz * Math.cos(alpha) + pz * Math.sin(alpha);
  // elbow position and forearm direction
  const ex = S[0] + ux * a, ey = S[1] + uy * a, ez = S[2] + uz * a;
  const tx = S[0] + dx * Dc, ty = S[1] + dy * Dc, tz = S[2] + dz * Dc;
  let fx = tx - ex, fy = ty - ey, fz = tz - ez; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // upper bone Euler: d = (cos f sin z, -cos f cos z, -sin f)
  const flex = Math.asin(Math.max(-1, Math.min(1, -uz)));
  const abd = Math.atan2(ux, -uy);
  // lower hinge angle
  const cosE = Math.max(-1, Math.min(1, ux * fx + uy * fy + uz * fz));
  const hinge = Math.acos(cosE) * bend;
  // twist: express forearm dir in the upper frame before twist (inverse of Rz·Rx)
  const cz = Math.cos(abd), sz = Math.sin(abd), cx = Math.cos(flex), sx = Math.sin(flex);
  // (Rz Rx)^T · f
  const r1x = cz * fx + sz * fy, r1y = -sz * fx + cz * fy, r1z = fz;   // Rz^T
  const lx = r1x, ly = cx * r1y + sx * r1z, lz = -sx * r1y + cx * r1z;  // Rx^T
  // forearm local dir after twist tw and hinge e about x: (-sin e·sin tw, -cos e, -sin e·cos tw)  (for e>0)
  const se = Math.sin(hinge);
  const twist = Math.abs(se) < 1e-4 ? 0 : Math.atan2(-lx / se, -lz / se);
  return { abd, flex, twist, hinge, reach: D / (a + b) };
}

/** Skinned position of a model-space vertex given its bones/weight (for tests and checks). */
export function skinPoint(skin, p, b0, b1, w) {
  const o0 = b0 * 16, o1 = b1 * 16; const out = [0, 0, 0];
  for (let r = 0; r < 3; r++) {
    const v0 = skin[o0 + r] * p[0] + skin[o0 + 4 + r] * p[1] + skin[o0 + 8 + r] * p[2] + skin[o0 + 12 + r];
    const v1 = skin[o1 + r] * p[0] + skin[o1 + 4 + r] * p[1] + skin[o1 + 8 + r] * p[2] + skin[o1 + 12 + r];
    out[r] = v0 * w + v1 * (1 - w);
  }
  return out;
}
