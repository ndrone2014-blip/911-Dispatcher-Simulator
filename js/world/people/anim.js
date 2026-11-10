// Procedural animation for characters. Three body "families" are computed and cross-faded
// with smoothed weights so changes never pop: STAND (breathing, weight shifts, idle styles
// and gestures), WALK (a foot-planted gait: heel strike, toe-off, pelvis bob, sway and
// rotation, counter-rotating shoulders, arm swing) and SIT (hips on the seat, feet on the
// floor, hands on thighs/keyboard/table). Hands and feet are placed with two-bone IK.
// A face layer on top drives head and eye look, blinking, moods and text-driven lip sync.
import { B, NB, POSE_STRIDE, forward, rootOf, solveLimb, invPoint } from './rig.js';

const S = POSE_STRIDE;
const IDENT = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
const tmpW = new Float32Array(NB * 12);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const rot = (buf, b, x, y, z) => { buf[b * S] = x; buf[b * S + 1] = y; buf[b * S + 2] = z; };
const addRot = (buf, b, x, y, z) => { buf[b * S] += x; buf[b * S + 1] += y; buf[b * S + 2] += z; };
const off = (buf, b, x, y, z) => { buf[b * S + 3] = x; buf[b * S + 4] = y; buf[b * S + 5] = z; };

export const MOODS = {
  neutral: { smile: 0.08 }, calm: { smile: 0.15 }, happy: { smile: 0.75, squint: 0.25, browUp: 0.1 }, laugh: { smile: 1, squint: 0.45, jaw: 0.35, browUp: 0.15 },
  worried: { innerUp: 0.85, frown: 0.3, wide: 0.25 }, frightened: { innerUp: 1, wide: 0.6, jaw: 0.15, frown: 0.25 }, upset: { browDown: 0.8, frown: 0.55, squint: 0.35 },
  angry: { browDown: 1, frown: 0.6, squint: 0.4 }, confused: { asym: 0.8, frown: 0.15, squint: 0.1 }, sad: { innerUp: 0.7, frown: 0.65, squint: 0.1 },
  pain: { browDown: 0.5, innerUp: 0.5, squint: 0.6, jaw: 0.1, frown: 0.3 }, focused: { browDown: 0.3, squint: 0.15 }, surprised: { browUp: 0.9, wide: 0.6, jaw: 0.3 },
};
const FACE_KEYS = ['smile', 'frown', 'innerUp', 'browDown', 'browUp', 'squint', 'wide', 'jaw', 'asym'];

// mouth shapes per letter: [jaw open, wide, round]
const VIS = {};
for (const c of 'a') VIS[c] = [0.75, 0.3, 0]; for (const c of 'e') VIS[c] = [0.45, 0.6, 0]; for (const c of 'iy') VIS[c] = [0.28, 0.75, 0];
for (const c of 'o') VIS[c] = [0.55, 0, 0.75]; for (const c of 'uw') VIS[c] = [0.25, 0, 1]; for (const c of 'mbp') VIS[c] = [0, 0, 0]; for (const c of 'fv') VIS[c] = [0.12, 0.1, 0];
for (const c of 'lntd') VIS[c] = [0.3, 0.2, 0]; for (const c of 'szcx') VIS[c] = [0.15, 0.5, 0]; for (const c of 'kgh') VIS[c] = [0.35, 0.1, 0]; for (const c of 'r') VIS[c] = [0.3, 0, 0.3]; for (const c of 'jq') VIS[c] = [0.22, 0, 0.5];

/** Per-character animation state. */
export function makeAnimState(app, sk, seed) {
  return {
    app, sk, seed: (seed % 1000) / 160, t: Math.random() * 10,
    stand: new Float32Array(NB * S), sit: new Float32Array(NB * S), walk: new Float32Array(NB * S), pose: new Float32Array(NB * S), tgt: new Float32Array(NB * S),
    w: { stand: 1, walk: 0, sit: 0 }, phase: Math.random(), spd: 0, lx: null, lz: null, lastT: -1,
    face: Object.fromEntries(FACE_KEYS.map((k) => [k, 0])), vis: [0, 0, 0], blink: 0, nextBlink: 1 + Math.random() * 3, blinkT: -1,
    look: { yaw: 0, pitch: 0, eyeYaw: 0, eyePitch: 0, idleYaw: 0, idlePitch: 0, next: 0 }, idleStyle: app.motion.idleStyles[0], nextIdle: 10 + Math.random() * 20,
    hat: 1, speech: null, laughUntil: 0, nextMoodBeat: 0, beat: 0, faceBuf: new Float32Array(NB * S), ctx: {},
    world: new Float32Array(NB * 12), skin: new Float32Array(NB * 16), root: new Float32Array(12), snap: true,
  };
}

// ---------------------------------------------------------------- helpers
function solveArm(st, buf, side, target, pole, foreTwist = 0, wrist = 0) {
  const sk = st.sk; const a = side < 0 ? B.armL : B.armR, f = side < 0 ? B.foreL : B.foreR, h = side < 0 ? B.handL : B.handR;
  forward(sk, buf, IDENT, tmpW, null, 0, B.chest);
  const chest = tmpW.subarray(B.chest * 12, B.chest * 12 + 12);
  const T = invPoint(chest, target[0], target[1], target[2]);
  const sp = sk.P[a], cp = sk.P[B.chest]; const Sj = [sp[0] - cp[0], sp[1] - cp[1], sp[2] - cp[2]];
  const r = solveLimb(Sj, T, sk.L.upper, sk.L.fore + sk.L.hand * 0.42, pole, 1);
  rot(buf, a, r.flex, r.twist, r.abd); rot(buf, f, r.hinge, foreTwist, 0); rot(buf, h, wrist, 0, 0);
}
function solveLeg(st, buf, side, target, pitch = 0) {
  const sk = st.sk; const th = side < 0 ? B.thighL : B.thighR, sh = side < 0 ? B.shinL : B.shinR, ft = side < 0 ? B.footL : B.footR;
  forward(sk, buf, IDENT, tmpW, null, 0, B.pelvis);
  const pel = tmpW.subarray(B.pelvis * 12, B.pelvis * 12 + 12);
  const T = invPoint(pel, target[0], target[1], target[2]);
  const hp = sk.P[th], pp = sk.P[B.pelvis]; const Sj = [hp[0] - pp[0], hp[1] - pp[1], hp[2] - pp[2]];
  const r = solveLimb(Sj, T, sk.L.thigh, sk.L.shin, [side * 0.08, 0, -1], -1);
  rot(buf, th, r.flex, r.twist, r.abd); rot(buf, sh, r.hinge, 0, 0);
  // keep the sole level with the floor (cancel the pitch of everything above), then apply the requested pitch
  const pelvisPitch = buf[B.pelvis * S];
  rot(buf, ft, pitch - pelvisPitch - r.flex - r.hinge, 0, -r.abd * 0.8);
}
function hangArm(buf, side, abd, flex, elbow, foreTwist = 0) {
  const a = side < 0 ? B.armL : B.armR, f = side < 0 ? B.foreL : B.foreR, h = side < 0 ? B.handL : B.handR;
  rot(buf, a, flex, 0, side * abd); rot(buf, f, elbow, foreTwist, 0); rot(buf, h, 0.05, 0, 0);
}
const pole = (side, x = 0.4, y = -0.25, z = 1) => [side * x, y, z];

// ---------------------------------------------------------------- families
function standTarget(st, n, buf, ctx) {
  buf.fill(0);
  const sk = st.sk, H = sk.H, M = sk.meas, t = st.t, app = st.app; const age = app.age;
  const sw = Math.sin(t * 0.5 + st.seed * 3) * 0.8 + Math.sin(t * 0.21 + st.seed) * 0.2; const br = Math.sin(t * Math.PI * 2 / 4.2 + st.seed);
  const stoop = app.motion.stoop;
  off(buf, B.pelvis, 0.013 * sw, -0.012 - 0.004 * Math.abs(sw), 0);
  rot(buf, B.pelvis, 0.0, 0.03 * sw, -0.03 * sw);
  rot(buf, B.spine, 0.02 + stoop * 0.4, -0.02 * sw, 0.025 * sw); rot(buf, B.chest, 0.012 * br + stoop * 0.6, -0.01 * sw, 0.012 * sw);
  rot(buf, B.neck, -stoop * 0.5 + 0.03, 0, -0.01 * sw);
  const fw = sk.hipW + 0.015;
  solveLeg(st, buf, -1, [-fw, sk.L.ankle, -0.03 + 0.03 * Math.sin(st.seed * 5)]); solveLeg(st, buf, 1, [fw, sk.L.ankle, 0.02]);
  // arms
  const a = n.anim; const front = M.beltFrontZ;
  const gest = ctx.gesture;
  if (a === 'talk' || ctx.speaking) {
    const e = 0.5 + 0.5 * gest; const b = st.beat;
    hangArm(buf, -1, 0.1, 0.05, 0.25);
    solveArm(st, buf, 1, [0.17 + 0.03 * Math.sin(t * 1.7), M.beltY + 0.12 + 0.07 * e * Math.max(0, Math.sin(t * 2.3 + b)), front - 0.2 - 0.06 * e * Math.sin(t * 1.3)], pole(1), -0.9, 0.2);
    if (gest > 0.4) solveArm(st, buf, -1, [-0.18 - 0.02 * Math.sin(t * 1.9), M.beltY + 0.08 + 0.05 * Math.max(0, Math.sin(t * 2.1 + 1)), front - 0.16], pole(-1), 0.9, 0.2);
  } else if (a === 'point') {
    hangArm(buf, -1, 0.1, 0.05, 0.25); hangArm(buf, 1, 0.12, 1.3 + Math.sin(t * 0.7) * 0.12, 0.08, -0.6);
  } else if (a === 'reach' || a === 'wash' || a === 'pour') {
    const y = a === 'wash' ? 0.9 : 1.02; const k = Math.sin(t * (a === 'wash' ? 6 : 1.6));
    solveArm(st, buf, 1, [0.12 + (a === 'wash' ? 0.02 * k : 0), y + 0.02 * k, -0.42], pole(1), 1.1, a === 'pour' ? 0.3 + 0.2 * k : 0.15);
    if (a !== 'reach' || Math.sin(t * 0.4) > 0) solveArm(st, buf, -1, [-0.1 - (a === 'wash' ? 0.02 * k : 0), y - 0.03, -0.38], pole(-1), -1.1, 0.15); else hangArm(buf, -1, 0.1, 0.05, 0.25);
  } else if (a === 'drink' || a === 'eat') {
    const sip = sm((Math.sin(t * 0.9 + st.seed) - 0.55) / 0.3);
    const cup = [0.14, M.chestY - 0.13, M.chestFrontZ - 0.16]; const mouth = [0.04, M.mouth[1] - 0.012, M.mouth[2] - 0.08];
    solveArm(st, buf, 1, [lerp(cup[0], mouth[0], sip), lerp(cup[1], mouth[1], sip), lerp(cup[2], mouth[2], sip)], pole(1, 0.7, -0.4, 0.6), -1.25, 0.1);
    hangArm(buf, -1, 0.1, 0.05, 0.25); ctx.headTilt = sip * 0.18;
  } else if (a === 'aim') {
    rot(buf, B.chest, 0.06, 0, 0); solveArm(st, buf, 1, [0.04, sk.shY + 0.02, -0.56], pole(1, 0.6, -0.6, 0.4), 1.4, 0); solveArm(st, buf, -1, [0.0, sk.shY - 0.0, -0.5], pole(-1, 0.6, -0.6, 0.4), -1.3, 0);
  } else if (a === 'type' || a === 'write') {
    const k = Math.sin(t * (a === 'type' ? 11 : 5));
    solveArm(st, buf, 1, [0.12 + 0.01 * k, 0.99, -0.36], pole(1), 1.35, -0.1); solveArm(st, buf, -1, [-0.14, a === 'type' ? 0.99 + 0.01 * Math.sin(t * 9) : 0.97, -0.34], pole(-1), -1.35, -0.1);
    ctx.lookDown = 0.35;
  } else {
    idleArms(st, buf, ctx);
  }
  if (app.clothes.injured && a !== 'talk') { // cradle the bandaged arm
    solveArm(st, buf, -1, [0.02, M.beltY + 0.12, front - 0.12], pole(-1, 0.6, -0.5, 0.6), 1.4, 0.2); solveArm(st, buf, 1, [-0.04, M.beltY + 0.1, front - 0.15], pole(1), -1.0, 0.2);
  }
  void age;
}

function idleArms(st, buf, ctx) {
  const sk = st.sk, M = sk.meas, t = st.t; const front = M.beltFrontZ; void ctx;
  switch (st.idleStyle) {
    case 'belt': solveArm(st, buf, 1, [0.1, M.beltY + 0.025, front - 0.035], pole(1, 0.6, -0.3, 0.8), -1.2, 0.3); solveArm(st, buf, -1, [-0.1, M.beltY + 0.025, front - 0.035], pole(-1, 0.6, -0.3, 0.8), 1.2, 0.3); break;
    case 'clasp': solveArm(st, buf, 1, [0.03, sk.H * 0.5, front - 0.07], pole(1, 0.3, -0.4, 0.8), -1.1, 0.15); solveArm(st, buf, -1, [-0.03, sk.H * 0.5 + 0.01, front - 0.08], pole(-1, 0.3, -0.4, 0.8), 1.1, 0.15); break;
    case 'cross': solveArm(st, buf, 1, [-0.09, M.chestY - 0.05, M.chestFrontZ - 0.07], pole(1, 0.8, -0.5, 0.4), -1.3, 0); solveArm(st, buf, -1, [0.1, M.chestY - 0.08, M.chestFrontZ - 0.05], pole(-1, 0.8, -0.5, 0.4), 1.3, 0); break;
    case 'hips': solveArm(st, buf, 1, [M.waistSideX + 0.03, M.beltY + 0.03, -0.02], pole(1, 1, -0.1, 0.4), -1.4, 0.3); solveArm(st, buf, -1, [-M.waistSideX - 0.03, M.beltY + 0.03, -0.02], pole(-1, 1, -0.1, 0.4), 1.4, 0.3); break;
    case 'pockets': solveArm(st, buf, 1, [M.hipSideX - 0.02, sk.H * 0.5, -0.06], pole(1, 0.8, -0.2, 0.6), -0.4, 0); solveArm(st, buf, -1, [-M.hipSideX + 0.02, sk.H * 0.5, -0.06], pole(-1, 0.8, -0.2, 0.6), 0.4, 0); break;
    default: { const s1 = Math.sin(t * 0.6 + st.seed) * 0.03; hangArm(buf, -1, 0.11 + s1, 0.04, 0.2, 0.5); hangArm(buf, 1, 0.11 - s1, 0.04, 0.22, -0.5); }
  }
}

function sitTarget(st, n, buf, ctx) {
  buf.fill(0);
  const sk = st.sk, H = sk.H, M = sk.meas, t = st.t; const a = n.anim; const br = Math.sin(t * Math.PI * 2 / 4.4 + st.seed);
  const seatY = 0.585; const lean = a === 'type' ? 0.26 : a === 'write' || a === 'eat' ? 0.16 : 0.03;
  off(buf, B.pelvis, 0, seatY - H * 0.53, 0.035);
  rot(buf, B.pelvis, -0.1, 0, 0); rot(buf, B.spine, 0.06 + lean * 0.5, 0, 0); rot(buf, B.chest, 0.04 + lean * 0.5 + br * 0.01, 0, 0); rot(buf, B.neck, 0.02 - lean * 0.3, 0, 0);
  const fz = 0.035 - sk.L.thigh * 0.93; const spread = sk.hipW + 0.035;
  solveLeg(st, buf, -1, [-spread, sk.L.ankle, fz - 0.02 * Math.sin(st.seed * 7)]); solveLeg(st, buf, 1, [spread + 0.01, sk.L.ankle, fz + 0.03]);
  const lap = (s) => [s * 0.13, seatY + 0.11, -0.2];
  if (a === 'type') {
    const k = Math.sin(t * 12 + st.seed), k2 = Math.sin(t * 10.3 + 1);
    solveArm(st, buf, 1, [0.14, 0.79 + 0.006 * Math.max(0, k), -0.45], pole(1, 0.35, -1, 0.35), 1.45, -0.2); solveArm(st, buf, -1, [-0.14, 0.79 + 0.006 * Math.max(0, k2), -0.45], pole(-1, 0.35, -1, 0.35), -1.45, -0.2);
    ctx.lookDown = 0.12;
  } else if (a === 'write') {
    const k = Math.sin(t * 6); solveArm(st, buf, 1, [0.08 + 0.008 * k, 0.775, -0.42 + 0.006 * Math.cos(t * 6)], pole(1), 1.3, 0); solveArm(st, buf, -1, [-0.15, 0.77, -0.4], pole(-1), -1.4, 0);
    ctx.lookDown = 0.45;
  } else if (a === 'drink' || a === 'eat') {
    const sip = sm((Math.sin(t * 0.9 + st.seed) - 0.5) / 0.3); const cup = [0.15, 0.8, -0.32]; const mouth = [0.04, M.mouth[1] - 0.012 + (seatY - H * 0.53), M.mouth[2] - 0.12];
    solveArm(st, buf, 1, [lerp(cup[0], mouth[0], sip), lerp(cup[1], mouth[1], sip), lerp(cup[2], mouth[2], sip)], pole(1, 0.7, -0.4, 0.6), -1.25, 0.1);
    solveArm(st, buf, -1, a === 'eat' ? [-0.14, 0.78, -0.36] : lap(-1), pole(-1), 1.2, 0.1); ctx.headTilt = sip * 0.15;
  } else if (a === 'talk' || ctx.speaking) {
    const e = 0.5 + 0.5 * ctx.gesture;
    solveArm(st, buf, 1, [0.16, seatY + 0.2 + 0.06 * e * Math.max(0, Math.sin(t * 2.2 + st.beat)), -0.3 - 0.04 * Math.sin(t * 1.4)], pole(1), -0.9, 0.2);
    solveArm(st, buf, -1, lap(-1), pole(-1), 1.2, 0.1);
  } else {
    solveArm(st, buf, 1, lap(1), pole(1), -1.2, 0.1); solveArm(st, buf, -1, lap(-1), pole(-1), 1.2, 0.1);
  }
}

function walkPose(st, n, buf, ctx) {
  buf.fill(0);
  const sk = st.sk, H = sk.H, app = st.app; const ph = st.phase; const tau = Math.PI * 2;
  const limp = app.clothes.injured ? 0.35 : 0; const spd = clamp(st.spd / 1.2, 0.4, 1.6);
  const cycle = st.cycle; const stride = cycle * 0.62;
  const bob = -0.022 * Math.cos(ph * tau * 2) - 0.014; const sway = 0.02 * Math.sin(ph * tau);
  off(buf, B.pelvis, sway, bob - limp * 0.02 * Math.max(0, Math.sin(ph * tau)), 0);
  rot(buf, B.pelvis, 0.03, 0.075 * Math.sin(ph * tau) * spd, -0.035 * Math.sin(ph * tau));
  rot(buf, B.spine, 0.04 + app.motion.stoop * 0.4, -0.05 * Math.sin(ph * tau), 0.02 * Math.sin(ph * tau));
  rot(buf, B.chest, 0.02 + app.motion.stoop * 0.5, -0.06 * Math.sin(ph * tau) * spd, 0.01 * Math.sin(ph * tau));
  rot(buf, B.neck, -0.02, 0.04 * Math.sin(ph * tau), 0); rot(buf, B.head, -0.02 + 0.01 * Math.cos(ph * tau * 2), 0.05 * Math.sin(ph * tau), 0.01 * Math.sin(ph * tau));
  const stance = 0.62;
  for (const side of [-1, 1]) {
    let p = (ph + (side > 0 ? 0.5 : 0)) % 1; const lim = side < 0 ? limp : 0;
    let z, y = sk.L.ankle, pitch = 0;
    const st0 = stance - lim * 0.15;
    if (p < st0) { const u = p / st0; z = lerp(-stride / 2, stride / 2, u); pitch = u < 0.15 ? 0.28 * (1 - u / 0.15) : u > 0.7 ? -0.55 * sm((u - 0.7) / 0.3) : 0; if (pitch < 0) y += sk.L.foot * 0.62 * Math.sin(-pitch); }
    else { const u = (p - st0) / (1 - st0); z = lerp(stride / 2, -stride / 2, sm(u)); y += Math.sin(u * Math.PI) * (0.085 - lim * 0.04) * spd + (u < 0.3 ? sk.L.foot * 0.3 * (1 - u / 0.3) : 0); pitch = lerp(-0.5, 0.25, sm(u)); }
    solveLeg(st, buf, side, [side * (sk.hipW + 0.004), y, z + 0.01], pitch);
    // arm swing, opposite to the leg on the same side
    const swing = -Math.sin((ph + (side > 0 ? 0.5 : 0)) * tau) * 0.34 * app.motion.armSwing * spd;
    hangArm(buf, side, 0.1, swing, 0.28 + 0.2 * Math.max(0, swing), side * 0.45);
  }
  if (n.anim === 'drink') { solveArm(st, buf, 1, [0.14, sk.meas.chestY - 0.13, sk.meas.chestFrontZ - 0.16], pole(1), -1.2, 0.1); }
  if (app.clothes.injured) { solveArm(st, buf, -1, [0.02, sk.meas.beltY + 0.12, sk.meas.beltFrontZ - 0.12], pole(-1, 0.6, -0.5, 0.6), 1.4, 0.2); }
  void H; void ctx;
}

// ---------------------------------------------------------------- face
function moodFor(st, n, ctx) {
  if (st.t < st.laughUntil) return 'laugh';
  if (n.mood) return n.mood;
  if (n.chatWith || ctx.talkingToPlayer) return Math.sin(st.t * 0.35 + st.seed) > 0.3 ? 'happy' : 'calm';
  if ((n.anim === 'type' || n.anim === 'write') && ctx.busy) return 'focused';
  return st.app.age > 50 ? 'neutral' : 'calm';
}

function facePose(st, n, buf, dt, ctx, lod) {
  const f = st.face; const t = st.t; const k = 1 - Math.exp(-dt * 6);
  // mood → expression targets
  const mood = MOODS[moodFor(st, n, ctx)] || MOODS.neutral;
  for (const key of FACE_KEYS) f[key] += ((mood[key] || 0) - f[key]) * k;
  // lip sync
  let jaw = f.jaw * 0.6, wide = 0, round = 0; ctx.gesture = 0;
  const sp = st.speech;
  if (sp) {
    const idx = Math.floor((t - sp.start) * sp.rate);
    if (idx >= sp.text.length + 2) st.speech = null;
    else {
      const c = (sp.text[idx] || ' ').toLowerCase(); const v = VIS[c] || (c === ' ' ? [0.05, 0, 0] : [0.04, 0, 0]);
      const kv = 1 - Math.exp(-dt * 22); st.vis[0] += (v[0] - st.vis[0]) * kv; st.vis[1] += (v[1] - st.vis[1]) * kv; st.vis[2] += (v[2] - st.vis[2]) * kv;
      ctx.speaking = true; ctx.gesture = /[!?.,]/.test(sp.text[idx - 1] || '') ? 1 : 0.4 + 0.3 * Math.sin(t * 2.7);
      if (c === ' ' && Math.random() < dt * 3) st.beat = Math.random() * 6;
    }
  }
  if (!st.speech) { const kv = 1 - Math.exp(-dt * 10); st.vis[0] *= 1 - kv; st.vis[1] *= 1 - kv; st.vis[2] *= 1 - kv; }
  jaw += st.vis[0]; wide += st.vis[1]; round += st.vis[2];
  if (lod < 2) { rot(buf, B.jaw, -jaw * 0.12, 0, 0); return; }
  // blink
  st.nextBlink -= dt;
  if (st.nextBlink <= 0) { st.blinkT = 0; st.nextBlink = (2 + Math.random() * 4.5) / st.app.motion.blinkRate; if (Math.random() < 0.12) st.nextBlink = 0.35; }
  if (st.blinkT >= 0) { st.blinkT += dt; const b = st.blinkT / 0.16; st.blink = b < 0.4 ? b / 0.4 : b < 1 ? 1 - (b - 0.4) / 0.6 : 0; if (b >= 1) st.blinkT = -1; } else st.blink = 0;
  const L = st.look;
  rot(buf, B.jaw, -jaw * 0.13, 0, 0);
  for (const side of [-1, 1]) {
    const eye = side < 0 ? B.eyeL : B.eyeR, lid = side < 0 ? B.lidL : B.lidR, brow = side < 0 ? B.browL : B.browR, mouth = side < 0 ? B.mouthL : B.mouthR;
    rot(buf, eye, L.eyePitch, L.eyeYaw, 0);
    const close = Math.max(st.blink, f.squint * 0.32 + (moodFor(st, n, ctx) === 'sad' ? 0.15 : 0));
    rot(buf, lid, -close * 0.92 + f.wide * 0.16 + L.eyePitch * 0.55, 0, 0);
    const asym = f.asym * (side < 0 ? 1 : -0.6);
    const inner = f.innerUp + asym * 0.5;
    rot(buf, brow, 0, 0, -side * 0.28 * inner + side * 0.16 * f.browDown);
    off(buf, brow, 0, 0.0016 * inner - 0.0026 * f.browDown + 0.0032 * f.browUp + 0.002 * Math.max(0, asym), 0);
    const sm2 = f.smile * (1 - st.vis[2] * 0.7);
    off(buf, mouth, side * (0.0032 * sm2 + 0.0034 * wide - 0.0045 * round), 0.0042 * sm2 - 0.0034 * f.frown + 0.001 * side * f.asym * 0.5, 0.0018 * sm2 - 0.003 * round);
  }
}

/** Look direction: the player when close and in front, a conversation partner, else idle glances. */
function lookLayer(st, n, buf, dt, ctx) {
  const L = st.look; const t = st.t;
  let ty = L.idleYaw, tp = L.idlePitch + (ctx.lookDown ? -ctx.lookDown : 0);
  if (t > L.next) { L.next = t + 1.5 + Math.random() * 4; L.idleYaw = (Math.random() - 0.5) * (n.state === 'walk' ? 0.25 : 0.7); L.idlePitch = (Math.random() - 0.5) * 0.15 - 0.03; }
  if (ctx.target) {
    const dx = ctx.target[0] - n.x, dz = ctx.target[2] - n.z; const want = Math.atan2(-dx, -dz); const rel = wrap(want - n.yaw);
    if (Math.abs(rel) < 1.9) { ty = clamp(rel, -1.25, 1.25); const d = Math.hypot(dx, dz) || 1; tp = clamp(Math.atan2(ctx.target[1] - (n.y || 0) - st.sk.meas.eyeY + (n.sitting ? 0.45 : 0), d), -0.5, 0.45); }
  }
  if (n.headYaw) ty = n.headYaw;
  const k = 1 - Math.exp(-dt * 4), ke = 1 - Math.exp(-dt * 14);
  L.yaw += (ty - L.yaw) * k; L.pitch += (tp - L.pitch) * k;
  const headYaw = clamp(L.yaw, -1.05, 1.05), headPitch = clamp(L.pitch * 0.7, -0.4, 0.3);
  addRot(buf, B.neck, headPitch * 0.35, headYaw * 0.35, 0); addRot(buf, B.head, headPitch * 0.65 - (ctx.headTilt || 0), headYaw * 0.65, 0);
  // eyes lead the head; small saccades
  const sac = Math.sin(t * 0.7 + st.seed) * 0.04;
  L.eyeYaw += (clamp(ty - L.yaw + sac, -0.45, 0.45) - L.eyeYaw) * ke; L.eyePitch += (clamp(tp - L.pitch * 0.7, -0.3, 0.25) - L.eyePitch) * ke;
}

// ---------------------------------------------------------------- main
/**
 * Advance a character's animation and compute its skin matrices.
 * ctx: { target:[x,y,z]|null, busy, talkingToPlayer } (filled with gesture/speaking flags internally)
 */
export function animate(st, n, dt, ctx, lod) {
  dt = clamp(dt, 0, 0.1); st.t += dt;
  if (st.lx == null || Math.hypot(n.x - st.lx, n.z - st.lz) > 1.2) { st.lx = n.x; st.lz = n.z; st.snap = true; }
  const moved = Math.hypot(n.x - st.lx, n.z - st.lz); st.lx = n.x; st.lz = n.z;
  const v = dt > 0 ? moved / dt : 0; st.spd += (v - st.spd) * (1 - Math.exp(-dt * 8));
  const walking = n.state === 'walk' && !n.sitting;
  const tw = { walk: walking ? 1 : 0, sit: n.sitting ? 1 : 0 }; tw.stand = 1 - tw.walk - tw.sit;
  const W = st.w;
  if (st.snap) { W.walk = tw.walk; W.sit = tw.sit; W.stand = tw.stand; }
  else { const kw = 1 - Math.exp(-dt * 7), ks = 1 - Math.exp(-dt * 4.5); W.walk += (tw.walk - W.walk) * kw; W.sit += (tw.sit - W.sit) * ks; W.stand = Math.max(0, 1 - W.walk - W.sit); }
  st.cycle = 1.36 * (st.sk.H / 1.78) * st.app.motion.walkStyle * clamp(Math.sqrt(Math.max(st.spd, 0.5) / 1.2), 0.75, 1.25);
  st.phase = (st.phase + Math.max(st.spd, walking ? 0.5 : 0) * dt / st.cycle) % 1;
  // idle style changes now and then
  if ((st.nextIdle -= dt) <= 0) { st.nextIdle = 15 + Math.random() * 25; const L = st.app.motion.idleStyles; st.idleStyle = L[Math.floor(Math.random() * L.length)]; }
  if (n.laugh) { st.laughUntil = st.t + 1.2; n.laugh = false; }
  const fctx = st.ctx; fctx.target = ctx.target; fctx.busy = ctx.busy; fctx.talkingToPlayer = ctx.talkingToPlayer; fctx.gesture = 0; fctx.speaking = false; fctx.lookDown = 0; fctx.headTilt = 0;
  // face first (it sets the speaking/gesture flags the body uses)
  const face = st.faceBuf; face.fill(0); facePose(st, n, face, dt, fctx, lod);
  const out = st.pose; out.fill(0);
  const kSm = st.snap ? 1 : 1 - Math.exp(-dt * 7);
  if (W.stand > 0.002) { standTarget(st, n, st.tgt, fctx); for (let i = 0; i < st.stand.length; i++) st.stand[i] += (st.tgt[i] - st.stand[i]) * kSm; for (let i = 0; i < out.length; i++) out[i] += st.stand[i] * W.stand; }
  if (W.sit > 0.002) { sitTarget(st, n, st.tgt, fctx); for (let i = 0; i < st.sit.length; i++) st.sit[i] += (st.tgt[i] - st.sit[i]) * kSm; for (let i = 0; i < out.length; i++) out[i] += st.sit[i] * W.sit; }
  if (W.walk > 0.002) { walkPose(st, n, st.walk, fctx); for (let i = 0; i < out.length; i++) out[i] += st.walk[i] * W.walk; }
  for (let i = 0; i < out.length; i++) out[i] += face[i];
  lookLayer(st, n, out, dt, fctx);
  // hats come off while seated
  const hatT = n.sitting ? 0 : 1; st.hat += (hatT - st.hat) * (st.snap ? 1 : 1 - Math.exp(-dt * 8));
  rootOf(st.root, n.x, n.y || 0, n.z, n.yaw);
  forward(st.sk, out, st.root, st.world, st.skin, 0, NB - 1, st.hat < 0.02 ? 0 : st.hat);
  st.snap = false;
}

/** Start lip sync for a line of text (characters per second derived from speech rate). */
export function speak(st, text, rate = 1) { st.speech = { text: String(text || ''), start: st.t, rate: 13.5 * rate }; }
