// Who each person looks like: age, build, skin, face shape, hair, facial hair, glasses and
// what they wear. Named staff get a stable, hand-tuned look (so Ray always looks like a
// 28-year veteran); everyone else is generated from a seed. Clothing follows the job:
// City Police navy, Sheriff's tan and brown, fire officers' white shirts, EMS navy with
// cargo pants, dispatchers' polos and headsets, detectives' shirts and ties, and small-town
// civilian wear (jeans, flannel, work jackets, hoodies, seed caps) for walk-ins.

export const SKIN_TONES = [ // linear-light albedo (the renderer works in linear space)
  [0.86, 0.64, 0.52], [0.82, 0.58, 0.45], [0.77, 0.53, 0.4], [0.71, 0.47, 0.34], [0.64, 0.42, 0.29],
  [0.56, 0.37, 0.25], [0.48, 0.31, 0.21], [0.4, 0.26, 0.17], [0.32, 0.2, 0.13], [0.24, 0.15, 0.1],
];
export const HAIR_COLORS = {
  black: [0.035, 0.03, 0.03], darkBrown: [0.09, 0.06, 0.045], brown: [0.2, 0.13, 0.08], lightBrown: [0.36, 0.25, 0.15], auburn: [0.36, 0.14, 0.07],
  red: [0.52, 0.2, 0.08], dirtyBlond: [0.52, 0.42, 0.26], blond: [0.74, 0.62, 0.4], gray: [0.52, 0.51, 0.5], white: [0.82, 0.81, 0.79],
};
const EYE_COLORS = [[0.22, 0.12, 0.06], [0.14, 0.08, 0.04], [0.32, 0.24, 0.1], [0.2, 0.38, 0.22], [0.25, 0.42, 0.62], [0.42, 0.48, 0.52]];

// Named staff: [age, skin tone index, hair colour, hair style (m/f lists below), facial hair, build, glasses]
const NAMED = {
  maria: [42, 4, 'darkBrown', 'bun', null, 1.02, false], tyler: [24, 1, 'lightBrown', 'messy', 'stubble', 0.92, false], denise: [38, 8, 'black', 'bun', null, 1.0, false],
  ray: [57, 1, 'gray', 'receding', 'mustache', 1.18, true], priya: [31, 6, 'black', 'ponytail', null, 0.95, false], karen: [49, 2, 'auburn', 'bob', null, 1.04, true],
  marcus: [36, 5, 'black', 'crew', 'goatee', 1.06, false], helen: [52, 4, 'black', 'bob', null, 0.95, true], jake: [29, 2, 'brown', 'crew', null, 1.06, false],
  lou: [47, 3, 'brown', 'short', 'mustache', 1.24, false], captain: [54, 1, 'gray', 'side', null, 1.1, false], watch: [50, 2, 'darkBrown', 'crew', 'mustache', 1.08, false],
  chief: [58, 3, 'white', 'side', 'mustache', 1.2, true], ruiz: [30, 5, 'black', 'bun', null, 0.98, false], hensley: [26, 1, 'dirtyBlond', 'crew', 'stubble', 1.12, false],
  hale: [46, 3, 'brown', 'buzz', 'goatee', 1.2, false], sam: [33, 5, 'darkBrown', 'ponytail', null, 0.97, false], pdchief: [59, 2, 'gray', 'side', null, 1.12, true],
  asstchief: [48, 2, 'blond', 'bob', null, 1.0, false], vaughn: [41, 3, 'brown', 'bun', null, 1.04, false], okafor_sgt: [44, 1, 'brown', 'short', null, 1.0, true],
  ramsey: [25, 1, 'blond', 'ponytail', null, 0.92, false], tate: [32, 7, 'black', 'buzz', 'stubble', 1.12, false], lin: [28, 4, 'black', 'bun', null, 0.94, false],
  calloway: [45, 6, 'black', 'short', 'beard', 1.04, false], lindqvist: [39, 0, 'blond', 'ponytail', null, 0.97, false], detsgt: [55, 3, 'gray', 'receding', null, 1.14, true],
  brenda: [56, 2, 'gray', 'bob', null, 1.12, true], danny: [34, 3, 'brown', 'side', null, 1.02, false], joanne: [53, 1, 'lightBrown', 'long', null, 1.06, true],
  garrity: [50, 1, 'lightBrown', 'balding', 'beard', 1.08, true], nadia: [35, 5, 'darkBrown', 'long', null, 1.0, false], sheriff: [61, 2, 'white', 'side', 'mustache', 1.16, false],
};

export function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rngFrom(seed) { let a = seed >>> 0 || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; }

const PICK = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const RANGE = (r, a, b) => a + (b - a) * r();
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Which uniform/outfit a person wears, from their kind and department. */
export function outfitKind(npc) {
  const k = npc.kind === 'visitor' ? (npc.dept === 'fire' ? 'fireOfficer' : npc.dept === 'ems' ? 'ems' : 'officer') : npc.kind;
  return { dispatcher: 'dispatcher', supervisor: 'supervisor', trainer: 'trainer', director: 'director', officer: 'police', sergeant: 'police', command: 'pdcommand', pdcommand: 'pdcommand',
    detective: 'detective', pdstaff: npc.id === 'danny' ? 'cso' : 'office', deputy: 'deputy', sheriff: 'sheriff', fireOfficer: 'fireOfficer', ems: 'ems', civilian: 'civilian', police: 'police' }[k] || 'office';
}

/**
 * Build the full appearance for an NPC. `variant` re-rolls the random parts (used to avoid
 * two people on shift looking alike).
 */
export function makeAppearance(npc, variant = 0) {
  const seed = hashStr(`${npc.id || npc.name}#${variant}`);
  const r = rngFrom(seed);
  const sex = npc.sex === 'f' ? 'f' : 'm';
  const named = variant === 0 ? NAMED[npc.id] : null;
  const outfit = outfitKind(npc);
  const civilian = outfit === 'civilian';
  // ---- age, tone, build
  const age = named ? named[0] : civilian ? Math.round(RANGE(r, 19, 78)) : Math.round(RANGE(r, 24, 58));
  // small-town Illinois: mostly fair tones, with real variety
  const toneW = [10, 14, 14, 10, 7, 6, 5, 4, 4, 3];
  let toneIdx = named ? named[1] : (() => { let x = r() * toneW.reduce((a, b) => a + b, 0); for (let i = 0; i < toneW.length; i++) { x -= toneW[i]; if (x <= 0) return i; } return 2; })();
  const skin = SKIN_TONES[toneIdx].map((v, i) => v * (0.97 + r() * 0.05) * (i === 0 ? 1 : 1 - (age > 55 ? 0.02 : 0)));
  const build = named ? named[5] : RANGE(r, 0.9, civilian ? 1.32 : 1.2);
  const H = (sex === 'f' ? RANGE(r, 1.57, 1.74) : RANGE(r, 1.68, 1.9)) * (age > 65 ? 0.985 : 1);
  const belly = Math.max(0, (build - 1.04) * 2.4 + (age > 45 ? 0.15 : 0) + RANGE(r, -0.1, 0.1));
  // ---- hair
  const darkTone = toneIdx >= 6;
  let hairName = named ? named[2] : PICK(r, darkTone ? ['black', 'black', 'darkBrown'] : ['black', 'darkBrown', 'darkBrown', 'brown', 'brown', 'lightBrown', 'dirtyBlond', 'blond', 'auburn', 'red']);
  const gray = named ? 0 : Math.max(0, Math.min(1, (age - 42) / 28 + RANGE(r, -0.15, 0.15)));
  let hair = HAIR_COLORS[hairName].slice();
  if (gray > 0 && !named) hair = mix(hair, gray > 0.75 ? HAIR_COLORS.white : HAIR_COLORS.gray, Math.min(1, gray));
  const MALE_STYLES = ['crew', 'short', 'side', 'buzz', 'messy', 'curlyShort', 'side', 'crew'];
  const FEMALE_STYLES = ['long', 'ponytail', 'bob', 'bun', 'long', 'shoulder', 'ponytail'];
  let hairStyle = named ? named[3] : sex === 'f' ? PICK(r, FEMALE_STYLES) : PICK(r, age > 50 && r() < 0.45 ? ['receding', 'balding', 'bald'] : MALE_STYLES);
  if (darkTone && !named && r() < 0.5) hairStyle = sex === 'f' ? PICK(r, ['curlyShoulder', 'bun', 'ponytail']) : PICK(r, ['buzz', 'curlyShort', 'bald']);
  // uniformed women keep their hair up; uniformed men keep it short
  const uniformed = ['police', 'deputy', 'sheriff', 'pdcommand', 'ems', 'fireOfficer'].includes(outfit);
  if (uniformed && sex === 'f' && !['bun', 'ponytail', 'bob'].includes(hairStyle)) hairStyle = 'bun';
  if (uniformed && sex === 'm' && ['messy', 'long'].includes(hairStyle)) hairStyle = 'crew';
  const facialHair = named ? named[4] : sex === 'm' ? PICK(r, uniformed ? [null, null, null, 'mustache', 'stubble'] : [null, null, 'stubble', 'beard', 'goatee', 'mustache', null]) : null;
  const glasses = named ? named[6] : r() < (age > 45 ? 0.45 : 0.18);
  // ---- face shape (all small, continuous: no two faces are the same)
  const fem = sex === 'f';
  const head = { hw: (fem ? 0.071 : 0.075) * RANGE(r, 0.96, 1.05), hh: (fem ? 0.113 : 0.118) * RANGE(r, 0.97, 1.04), hd: (fem ? 0.093 : 0.097) * RANGE(r, 0.97, 1.03) };
  const face = {
    jawW: RANGE(r, fem ? 0.82 : 0.92, fem ? 0.98 : 1.1), chin: RANGE(r, 0, 1), cheek: RANGE(r, 0.2, 1), brow: fem ? RANGE(r, 0, 0.35) : RANGE(r, 0.35, 1),
    noseLen: RANGE(r, 0.9, 1.15), noseW: RANGE(r, 0.85, 1.25) * (darkTone ? 1.12 : 1), noseProj: RANGE(r, 0.85, 1.2), noseBump: RANGE(r, 0, 1),
    eyeSize: RANGE(r, 0.92, 1.08), eyeSpace: RANGE(r, 0.96, 1.05), eyeTilt: RANGE(r, -0.06, 0.1), lips: RANGE(r, 0.75, 1.3) * (fem ? 1.1 : 1), mouth: RANGE(r, 0.92, 1.1),
    ear: RANGE(r, 0.92, 1.1), fat: Math.max(0, (build - 1) * 1.6 + RANGE(r, -0.15, 0.2)), forehead: RANGE(r, 0.95, 1.06), faceLen: RANGE(r, 0.96, 1.05),
    eye: PICK(r, toneIdx >= 5 ? [EYE_COLORS[0], EYE_COLORS[1], EYE_COLORS[1], EYE_COLORS[2]] : EYE_COLORS),
    brows: RANGE(r, 0.8, 1.2) * (fem ? 0.8 : 1), lashes: fem ? 1 : 0.4,
  };
  // derived face landmarks (head-centre relative) used by both the rig and the mesh
  face.eyeX = 0.0312 * face.eyeSpace * head.hw / 0.075; face.eyeY = 0.012; face.eyeR = 0.0118 * face.eyeSize;
  face.browX = face.eyeX + 0.002; face.browY = 0.033 * face.forehead;
  face.mouthW = 0.0235 * face.mouth * head.hw / 0.075; face.mouthY = -0.057 * face.faceLen;
  const lipTint = toneIdx >= 6 ? [0.62, 0.42, 0.4] : [0.86, 0.5, 0.5];
  face.lipColor = mix(skin, skin.map((v, i) => v * lipTint[i]), fem ? 0.75 : 0.55);
  if (fem && !uniformed && r() < 0.4) face.lipColor = mix(face.lipColor, [0.6, 0.18, 0.22], 0.35);
  // ---- posture & movement
  const motion = { stoop: age > 60 ? 0.12 : age > 50 ? 0.05 : 0, walkStyle: RANGE(r, 0.85, 1.15), armSwing: RANGE(r, 0.75, 1.2) * (uniformed ? 0.9 : 1), idleStyles: idleStylesFor(outfit, r), blinkRate: RANGE(r, 0.8, 1.3) };
  const clothes = dress(outfit, npc, r, sex, age, build);
  const body = { H, sex, build, belly: Math.min(1, belly) * (fem ? 0.6 : 1), shoulders: RANGE(r, 0.96, 1.06), hips: fem ? RANGE(r, 1.0, 1.12) : 1, bust: fem ? RANGE(r, 0.5, 1) : 0, head, face, age };
  const app = { id: npc.id, seed, sex, age, toneIdx, skin, hair, hairName, hairStyle, facialHair, glasses, body, clothes, motion, outfit,
    gray: named ? (hairName === 'gray' || hairName === 'white' ? 1 : 0) : gray };
  app.signature = [sex, toneIdx >> 1, hairStyle, hairName, facialHair || '-', glasses ? 'g' : '-', Math.round(build * 5), Math.floor(age / 15), clothes.signature].join('|');
  return app;
}

function idleStylesFor(outfit, r) {
  if (['police', 'deputy', 'sheriff', 'pdcommand'].includes(outfit)) return ['belt', 'belt', 'hang', 'clasp', r() < 0.5 ? 'cross' : 'hips'];
  if (outfit === 'civilian') return ['hang', 'pockets', 'cross', 'clasp'];
  return ['hang', 'clasp', r() < 0.5 ? 'cross' : 'hang'];
}

// ---------------------------------------------------------------- wardrobe
const NAVY = [0.07, 0.09, 0.17], NAVY_P = [0.055, 0.065, 0.12], BLACK = [0.035, 0.035, 0.04], TAN = [0.55, 0.47, 0.33], BROWN_P = [0.2, 0.15, 0.1];
const WHITE_SHIRT = [0.86, 0.87, 0.88], LIGHT_BLUE = [0.6, 0.68, 0.8];

function dress(outfit, npc, r, sex, age, build) {
  const c = { top: 'tee', topRegion: 'tee', shirt: [0.5, 0.5, 0.5], sleeves: 'long', pants: [0.2, 0.2, 0.22], pantsRegion: 'pants', shoes: 'dress', shoeColor: BLACK, belt: 'plain', beltColor: [0.08, 0.06, 0.05],
    badge: null, patches: null, nameplate: false, flagPin: false, bodyCam: false, dutyBelt: false, shoulderMic: false, hat: null, tie: null, jacket: null, collar: 'none',
    lanyard: false, headset: false, chevrons: false, collarBrass: null, stethoscope: false, watch: r() < 0.6, epaulets: false, badgeOnBelt: false, hood: false, injured: false };
  const tone = (base, j = 0.08) => base.map((v) => Math.max(0, Math.min(1, v * (1 - j / 2 + r() * j))));
  switch (outfit) {
    case 'police': {
      const sgt = npc.kind === 'sergeant';
      Object.assign(c, { top: 'uniform', topRegion: 'shirtUniform', shirt: tone(NAVY, 0.05), sleeves: r() < 0.75 ? 'long' : 'short', pants: NAVY_P, shoes: 'boots', badge: { shape: 'shield', metal: sgt ? 'gold' : 'silver' },
        patches: 'patchPD', nameplate: true, flagPin: true, bodyCam: true, dutyBelt: true, shoulderMic: true, collar: 'uniform', chevrons: sgt, epaulets: true, watch: true,
        hat: PICK(r, ['service', 'service', 'service', 'ballcap']), hatColor: NAVY_P });
      break;
    }
    case 'deputy': case 'sheriff': {
      const boss = outfit === 'sheriff';
      Object.assign(c, { top: 'uniform', topRegion: 'shirtUniform', shirt: tone(TAN, 0.04), sleeves: 'long', pants: BROWN_P, shoes: 'boots', badge: { shape: 'star', metal: 'gold' },
        patches: 'patchSO', nameplate: true, flagPin: true, bodyCam: !boss, dutyBelt: true, shoulderMic: !boss, collar: 'uniform', epaulets: true, watch: true,
        hat: npc.id === 'hale' ? 'ballcap' : 'campaign', hatColor: npc.id === 'hale' ? BROWN_P : [0.42, 0.33, 0.21], tie: boss ? [0.16, 0.12, 0.08] : null, collarBrass: boss ? 'stars' : null });
      break;
    }
    case 'pdcommand': {
      const chiefish = npc.id === 'pdchief' || npc.id === 'asstchief' || npc.id === 'captain';
      Object.assign(c, { top: 'uniform', topRegion: 'shirtUniform', shirt: WHITE_SHIRT, sleeves: 'long', pants: NAVY_P, shoes: 'dress', badge: { shape: 'shield', metal: 'gold' },
        patches: 'patchPD', nameplate: true, flagPin: true, dutyBelt: npc.id === 'watch' || npc.id === 'captain', bodyCam: npc.id === 'watch', shoulderMic: npc.id === 'watch', collar: 'uniform', epaulets: true,
        tie: chiefish ? NAVY_P : null, collarBrass: npc.id === 'pdchief' ? 'stars' : npc.id === 'asstchief' ? 'stars' : npc.id === 'captain' ? 'bars' : 'bar', watch: true,
        hat: 'service', hatColor: NAVY_P, hatGold: true });
      if (!c.dutyBelt) c.belt = 'plain';
      break;
    }
    case 'detective':
      Object.assign(c, { top: 'dress', topRegion: 'shirtUniform', shirt: tone(npc.id === 'lindqvist' ? [0.82, 0.8, 0.84] : LIGHT_BLUE, 0.1), sleeves: 'long', pants: tone([0.2, 0.2, 0.22]), shoes: 'dress',
        tie: npc.id === 'lindqvist' ? null : tone(PICK(r, [[0.38, 0.1, 0.1], [0.12, 0.18, 0.32], [0.25, 0.2, 0.12]])), jacket: tone(PICK(r, [[0.22, 0.22, 0.24], [0.28, 0.24, 0.2], [0.14, 0.16, 0.22]])),
        badgeOnBelt: true, collar: 'dress', lanyard: false, holsterOnly: true });
      break;
    case 'cso':
      Object.assign(c, { top: 'uniform', topRegion: 'shirtUniform', shirt: [0.55, 0.64, 0.76], sleeves: 'short', pants: NAVY_P, shoes: 'boots', badge: { shape: 'flat', metal: 'silver' }, patches: 'patchPD', nameplate: true, collar: 'uniform', epaulets: true, belt: 'plain', beltColor: BLACK, radioOnBelt: true });
      break;
    case 'fireOfficer':
      Object.assign(c, { top: 'uniform', topRegion: 'shirtUniform', shirt: WHITE_SHIRT, sleeves: npc.id === 'chief' ? 'long' : 'short', pants: NAVY_P, shoes: 'boots', badge: { shape: 'maltese', metal: npc.id === 'chief' ? 'gold' : 'silver' },
        patches: 'patchFire', nameplate: true, flagPin: true, collar: 'uniform', epaulets: true, collarBrass: npc.id === 'chief' ? 'bugles5' : 'bugles2', belt: 'plain', beltColor: BLACK, radioOnBelt: true });
      break;
    case 'ems':
      Object.assign(c, { top: 'uniform', topRegion: 'shirtUniform', shirt: tone([0.08, 0.11, 0.2], 0.05), sleeves: 'short', pants: [0.06, 0.07, 0.11], pantsRegion: 'cargo', shoes: 'boots', badge: { shape: 'ems', metal: 'silver' },
        patches: 'patchEMS', nameplate: true, collar: 'uniform', epaulets: true, stethoscope: true, belt: 'plain', beltColor: BLACK, radioOnBelt: true, hat: null });
      break;
    case 'dispatcher':
      Object.assign(c, { top: 'polo', topRegion: 'polo', shirt: tone([0.09, 0.14, 0.27], 0.1), sleeves: r() < 0.5 ? 'short' : 'long', pants: tone(PICK(r, [[0.12, 0.12, 0.13], [0.42, 0.36, 0.26], [0.16, 0.17, 0.2]])),
        pantsRegion: r() < 0.25 ? 'jeans' : 'pants', shoes: PICK(r, ['sneaker', 'dress', 'casual']), shoeColor: PICK(r, [BLACK, [0.85, 0.85, 0.85], [0.25, 0.17, 0.1]]), collar: 'polo', lanyard: true, headset: true, logo: true });
      if (c.pantsRegion === 'jeans') c.pants = tone([0.12, 0.17, 0.3]);
      break;
    case 'supervisor':
      Object.assign(c, { top: 'dress', topRegion: 'shirtUniform', shirt: tone(LIGHT_BLUE, 0.06), sleeves: 'long', pants: tone([0.16, 0.17, 0.2]), shoes: 'dress', collar: 'dress', lanyard: true, headset: true });
      break;
    case 'trainer':
      Object.assign(c, { top: 'polo', topRegion: 'polo', shirt: tone([0.38, 0.4, 0.43], 0.1), sleeves: 'short', pants: tone([0.42, 0.36, 0.26]), shoes: 'casual', shoeColor: [0.25, 0.17, 0.1], collar: 'polo', lanyard: true, logo: true });
      break;
    case 'director':
      Object.assign(c, { top: 'dress', topRegion: 'shirtUniform', shirt: [0.88, 0.88, 0.9], sleeves: 'long', pants: [0.16, 0.16, 0.18], shoes: 'dress', collar: 'dress', jacket: [0.16, 0.17, 0.2], lanyard: true, tie: sex === 'm' ? [0.45, 0.08, 0.1] : null });
      break;
    case 'office': {
      const top = PICK(r, sex === 'f' ? ['dress', 'knit', 'tee', 'cardigan'] : ['dress', 'polo', 'knit']);
      Object.assign(c, { top: top === 'cardigan' ? 'tee' : top, topRegion: top === 'knit' ? 'knit' : top === 'polo' ? 'polo' : top === 'dress' ? 'shirtUniform' : 'tee',
        shirt: tone(PICK(r, [[0.62, 0.66, 0.74], [0.5, 0.22, 0.25], [0.24, 0.36, 0.3], [0.72, 0.68, 0.6], [0.3, 0.32, 0.45], [0.82, 0.8, 0.78]])), sleeves: 'long',
        pants: tone(PICK(r, [[0.16, 0.16, 0.18], [0.36, 0.3, 0.22], [0.2, 0.22, 0.3]])), shoes: PICK(r, ['dress', 'casual']), shoeColor: PICK(r, [BLACK, [0.28, 0.18, 0.1]]), collar: top === 'dress' ? 'dress' : top === 'polo' ? 'polo' : 'crew', lanyard: true,
        jacket: top === 'cardigan' ? tone(PICK(r, [[0.5, 0.42, 0.36], [0.3, 0.3, 0.34], [0.55, 0.2, 0.25]])) : null, jacketKnit: top === 'cardigan' });
      break;
    }
    default: { // civilians: small-town Illinois, November
      const top = PICK(r, ['tee', 'flannel', 'flannel', 'hoodie', 'work', 'polo', 'knit', 'denim']);
      const plaid = PICK(r, ['plaidRed', 'plaidBlue', 'plaidBrown']);
      Object.assign(c, {
        top: top === 'flannel' ? 'dress' : top === 'work' || top === 'denim' ? 'tee' : top, topRegion: top === 'flannel' ? plaid : top === 'hoodie' ? 'hoodie' : top === 'knit' ? 'knit' : top === 'polo' ? 'polo' : 'tee',
        shirt: top === 'flannel' ? [0.95, 0.95, 0.95] : tone(PICK(r, [[0.5, 0.12, 0.12], [0.12, 0.2, 0.36], [0.2, 0.32, 0.2], [0.5, 0.5, 0.52], [0.1, 0.1, 0.11], [0.62, 0.55, 0.42], [0.35, 0.22, 0.42], [0.85, 0.85, 0.83]])),
        sleeves: r() < 0.85 ? 'long' : 'short', collar: top === 'flannel' ? 'dress' : top === 'polo' ? 'polo' : 'crew', hood: top === 'hoodie',
        jacket: top === 'work' ? tone([0.5, 0.38, 0.22]) : top === 'denim' ? tone([0.22, 0.3, 0.45]) : null, jacketRegion: top === 'work' ? 'canvasWork' : top === 'denim' ? 'denimJacket' : null,
        pantsRegion: r() < 0.7 ? 'jeans' : 'pants', shoes: PICK(r, ['sneaker', 'boots', 'casual', 'workboots']),
        hat: sex === 'm' && r() < 0.35 ? 'seedcap' : null, hatColor: tone(PICK(r, [[0.12, 0.25, 0.14], [0.5, 0.1, 0.1], [0.12, 0.14, 0.24], [0.45, 0.38, 0.25], [0.1, 0.1, 0.1]])),
      });
      c.pants = c.pantsRegion === 'jeans' ? tone(PICK(r, [[0.1, 0.15, 0.28], [0.16, 0.22, 0.38], [0.08, 0.09, 0.12], [0.25, 0.32, 0.45]])) : tone(PICK(r, [[0.4, 0.34, 0.24], [0.24, 0.22, 0.18], [0.16, 0.17, 0.2]]));
      c.shoeColor = c.shoes === 'sneaker' ? PICK(r, [[0.85, 0.85, 0.85], [0.15, 0.15, 0.16], [0.4, 0.42, 0.45]]) : c.shoes === 'workboots' ? [0.42, 0.28, 0.14] : PICK(r, [[0.25, 0.16, 0.09], BLACK]);
      c.belt = c.pantsRegion === 'jeans' && r() < 0.6 ? 'plain' : 'none';
      break;
    }
  }
  if (c.jacket && !c.jacketRegion) c.jacketRegion = c.jacketKnit ? 'knit' : 'tee';
  c.signature = [outfit, c.topRegion, c.hat || '-', c.jacket ? 'j' : '-', Math.round(c.shirt[0] * 4) + '' + Math.round(c.shirt[2] * 4)].join(':');
  return c;
}
