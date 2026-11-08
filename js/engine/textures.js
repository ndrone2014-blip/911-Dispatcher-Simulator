// Procedural textures generated on canvases (no image files required).
// Everything is tileable and built from one shared fractal-noise field, so a full
// texture set takes only a few tens of milliseconds even at 512px.
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Tileable fractal value noise in [0,1], size x size. */
function noiseField(size, seed = 7) {
  const out = new Float32Array(size * size); const r = rng(seed);
  let amp = 0.5, total = 0;
  for (const cells of [4, 8, 16, 32, 64]) {
    if (cells > size) break;
    const grid = new Float32Array(cells * cells); for (let i = 0; i < grid.length; i++) grid[i] = r();
    const step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step, y0 = Math.floor(gy) % cells, y1 = (y0 + 1) % cells; let fy = gy - Math.floor(gy); fy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < size; x++) {
        const gx = x / step, x0 = Math.floor(gx) % cells, x1 = (x0 + 1) % cells; let fx = gx - Math.floor(gx); fx = fx * fx * (3 - 2 * fx);
        const a = grid[y0 * cells + x0], b = grid[y0 * cells + x1], c = grid[y1 * cells + x0], d = grid[y1 * cells + x1];
        out[y * size + x] += ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy) * amp;
      }
    }
    total += amp; amp *= 0.55;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const fieldCache = {};
function field(size) { return (fieldCache[size] ||= noiseField(size)); }

/** Per-pixel painter: fn(x, y, n, rand) -> [r,g,b] (0..255). n = smooth noise sampled with offset. */
function paint(size, fn, { offset = 0, h = size } = {}) {
  const c = cv(size, h); const g = c.getContext('2d'); const img = g.createImageData(size, h); const d = img.data;
  const F = field(size); const r = rng(offset * 31 + 5); const ox = (offset * 97) % size, oy = (offset * 53) % size;
  for (let y = 0; y < h; y++) for (let x = 0; x < size; x++) {
    const n = F[((y + oy) % size) * size + ((x + ox) % size)];
    const col = fn(x, y, n, r); const i = (y * size + x) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function makeTextures(size = 256) {
  const S = size; const k = S / 256; const T = {};

  // Modular carpet tiles (0.6 m) laid quarter-turn, with fibre streaks and mottling.
  T.carpet = paint(S, (x, y, n, r) => {
    const half = S / 2; const tx = Math.floor(x / half), ty = Math.floor(y / half); const vert = (tx + ty) % 2 === 0;
    const u = vert ? x : y, v = vert ? y : x;
    const streak = Math.sin(u * 0.9 / k + Math.sin(v * 0.08 / k) * 2.0) * 0.5 + 0.5;
    const fleck = r(); const seam = (x % half < 1 || y % half < 1) ? -14 : 0;
    const base = 44 + (n - 0.5) * 20 + streak * 9 + (fleck - 0.5) * 22 + seam + (fleck > 0.985 ? 26 : 0);
    return [clamp(base * 0.78), clamp(base * 0.88), clamp(base * 1.12 + 6)];
  }, { offset: 1 });

  // 2'x2' fissured acoustic ceiling tiles with a white T-bar grid.
  T.ceiling = paint(S, (x, y, n, r) => {
    const half = S / 2; const lx = x % half, ly = y % half; const e = Math.min(lx, ly, half - 1 - lx, half - 1 - ly);
    if (e < 3 * k) { const v = e < 1.2 * k ? 250 : 236; return [v, v, v + 2]; }
    const bevel = e < 7 * k ? -10 * (1 - (e - 3 * k) / (4 * k)) : 0;
    const fiss = r() < 0.035 ? -30 - r() * 30 : 0; const pin = r() < 0.08 ? -9 : 0;
    const v = 228 + (n - 0.5) * 12 + bevel + fiss + pin;
    return [clamp(v), clamp(v + 1), clamp(v - 2)];
  }, { offset: 2 });

  // Eggshell paint: soft roller mottling + orange peel.
  T.wall = paint(S, (x, y, n, r) => { const v = 202 + (n - 0.5) * 14 + (r() - 0.5) * 6; return [clamp(v), clamp(v + 3), clamp(v + 6)]; }, { offset: 3 });

  // Navy fabric-wrapped acoustic panels (1 m wide) with reveals.
  T.accent = paint(S, (x, y, n, r) => {
    const half = S / 2; const lx = x % half; const reveal = lx < 2 * k ? -26 : lx < 4 * k ? -8 : lx > half - 3 * k ? 6 : 0;
    const weave = ((x + y) % 3 === 0 ? 4 : 0) + ((x - y) % 4 === 0 ? -3 : 0);
    const v = 50 + (n - 0.5) * 12 + (r() - 0.5) * 10 + weave + reveal;
    return [clamp(v * 0.45), clamp(v * 0.72), clamp(v * 1.25)];
  }, { offset: 4 });

  // Walnut veneer with warped grain.
  T.wood = paint(S, (x, y, n, r) => {
    const g = Math.sin((y / k) * 0.22 + n * 9 + Math.sin((x / k) * 0.012) * 3) * 0.5 + 0.5;
    const pores = r() < 0.06 ? -14 : 0; const plank = (Math.floor(y / (S / 4)) * 37) % 11 - 5;
    const v = 92 + g * 34 + (n - 0.5) * 30 + pores + plank;
    return [clamp(v * 1.18), clamp(v * 0.82), clamp(v * 0.55)];
  }, { offset: 5 });

  // Light grey high-pressure laminate work surface.
  T.laminate = paint(S, (x, y, n, r) => { const v = 196 + (n - 0.5) * 10 + (r() - 0.5) * 10 + (r() > 0.992 ? -24 : 0); return [clamp(v + 2), clamp(v), clamp(v - 5)]; }, { offset: 6 });

  // Woven charcoal upholstery.
  T.fabric = paint(S, (x, y, n, r) => {
    const wv = ((Math.floor(x / (2 * k)) + Math.floor(y / (2 * k))) % 2 ? 7 : -5) + (r() - 0.5) * 16;
    const v = 46 + (n - 0.5) * 14 + wv; return [clamp(v * 0.96), clamp(v), clamp(v * 1.08)];
  }, { offset: 7 });

  // Ergonomic chair mesh: dark polymer weave with light gaps.
  T.mesh = paint(S, (x, y, n, r) => {
    const p = 6 * k; const a = (x + y) % p, b = (x - y + S * 4) % p;
    const strand = Math.min(a, b) < 1.6 * k ? 1 : 0; const v = strand ? 34 + (r() - 0.5) * 10 : 14 + n * 10;
    return [clamp(v), clamp(v + 2), clamp(v + 6)];
  }, { offset: 8 });

  // Brushed aluminium.
  T.metal = paint(S, (x, y, n, r) => { const row = Math.sin(y * 1.7 + n * 40) * 0.5 + 0.5; const v = 150 + row * 22 + (r() - 0.5) * 12 + (n - 0.5) * 18; return [clamp(v), clamp(v + 4), clamp(v + 10)]; }, { offset: 9 });

  // Large-format porcelain tile with grout and faint veining (break room).
  T.tile = paint(S, (x, y, n, r) => {
    const half = S / 2; const lx = x % half, ly = y % half;
    if (lx < 2 * k || ly < 2 * k) return [150, 148, 144];
    const vein = Math.abs(Math.sin((x + y) * 0.03 / k + n * 12)) < 0.04 ? -16 : 0;
    const v = 214 + (n - 0.5) * 16 + (r() - 0.5) * 5 + vein + ((Math.floor(x / half) + Math.floor(y / half)) % 2 ? 4 : -2);
    return [clamp(v), clamp(v - 1), clamp(v - 5)];
  }, { offset: 10 });

  // Concrete (stairs, service areas, exterior pads).
  T.concrete = paint(S, (x, y, n, r) => { const v = 132 + (n - 0.5) * 40 + (r() - 0.5) * 22 + (r() > 0.995 ? -40 : 0); return [clamp(v), clamp(v), clamp(v - 3)]; }, { offset: 11 });

  // Full-size keyboard with numpad.
  { const c = cv(512, 160); const g = c.getContext('2d');
    g.fillStyle = '#121418'; g.fillRect(0, 0, 512, 160);
    const key = (x, y, w, h) => { const grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, '#3a3f48'); grd.addColorStop(1, '#23272e'); g.fillStyle = '#08090b'; g.fillRect(x, y + 1.5, w, h); g.fillStyle = grd; g.fillRect(x, y, w, h - 1.5); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + w * 0.3, y + h * 0.35, Math.max(2, w * 0.18), 2); };
    const u = 22.5; let y = 10;
    for (let i = 0; i < 13; i++) key(10 + i * u * (i > 0 ? 1.03 : 1) + (i > 0 ? 8 : 0), y, u - 3, 17);
    y += 24; const rows = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5], [1.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.2], [2.3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.7], [1.3, 1.3, 1.3, 6.2, 1.3, 1.3, 1.3, 1.3]];
    for (const row of rows) { let x = 10; for (const w of row) { key(x, y, w * u - 3, 22); x += w * u; } y += 25; }
    for (let r = 0; r < 5; r++) for (let q = 0; q < 4; q++) key(392 + q * 26, 34 + r * 25, 23, 22);
    for (let q = 0; q < 3; q++) key(392 + q * 26, 10, 23, 17);
    g.fillStyle = '#2fd08a'; g.fillRect(470, 12, 4, 3); T.keyboard = c; }

  // Radio console touchscreen (channel tiles, PTT state, meters) – also used as its emissive map.
  { const c = cv(512, 256); const g = c.getContext('2d');
    g.fillStyle = '#0a1220'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#13233d'; g.fillRect(0, 0, 512, 26); g.fillStyle = '#9fc3ff'; g.font = 'bold 15px system-ui'; g.textBaseline = 'middle'; g.fillText('RADIO · WHITE CO 911', 10, 13);
    const ch = [['POLICE', '#4f8cff'], ['SHERIFF', '#d9a441'], ['FIRE', '#ff5a4e'], ['EMS', '#2fd08a'], ['ISP', '#9aa5b1'], ['MUTUAL', '#b47cff'], ['EMA', '#f2c94c'], ['HWY', '#ffb84d']];
    ch.forEach(([name, col], i) => {
      const x = 8 + (i % 4) * 126, y = 34 + Math.floor(i / 4) * 106;
      g.fillStyle = '#16243a'; g.fillRect(x, y, 118, 98); g.fillStyle = col; g.fillRect(x, y, 118, 6);
      g.fillStyle = '#dfe8f5'; g.font = 'bold 17px system-ui'; g.fillText(name, x + 8, y + 26);
      g.fillStyle = i === 0 ? '#2fd08a' : '#2a3a55'; g.fillRect(x + 8, y + 46, 46, 18); g.fillStyle = '#081018'; g.font = 'bold 11px system-ui'; g.fillText('SEL', x + 18, y + 55);
      g.fillStyle = '#2a3a55'; g.fillRect(x + 62, y + 46, 46, 18); g.fillStyle = '#9fb2cc'; g.fillText('MUTE', x + 68, y + 55);
      for (let b = 0; b < 10; b++) { g.fillStyle = b < 3 + (i * 3) % 6 ? (b > 7 ? '#ff5a4e' : '#2fd08a') : '#1f2c42'; g.fillRect(x + 8 + b * 10.5, y + 76, 8, 12); }
    });
    T.radioPanel = c; }

  // Square HVAC supply diffuser.
  { const n = 128; const c = cv(n); const g = c.getContext('2d'); g.fillStyle = '#e9eaea'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 5; i++) { const m = 8 + i * 11; g.strokeStyle = i % 2 ? '#c4c7ca' : '#9da2a8'; g.lineWidth = 4; g.strokeRect(m, m, n - m * 2, n - m * 2); }
    g.fillStyle = '#6d737a'; g.fillRect(56, 56, 16, 16); T.vent = c; }

  // Prismatic troffer lens (emissive): bright core, cool edges, two lamp bands.
  { const c = cv(128, 64); const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, '#c8ccd2'); grd.addColorStop(0.25, '#fbfcff'); grd.addColorStop(0.5, '#eef2f8'); grd.addColorStop(0.75, '#fbfcff'); grd.addColorStop(1, '#c8ccd2');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(0,0,0,.05)'; for (let x = 0; x < 128; x += 4) for (let y = 0; y < 64; y += 4) if ((x + y) % 8 === 0) g.fillRect(x, y, 2, 2);
    g.strokeStyle = '#9aa0a8'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 64); T.troffer = c; }

  // Horizontal mini-blinds.
  { const c = cv(64, 128); const g = c.getContext('2d');
    for (let y = 0; y < 128; y += 8) { const grd = g.createLinearGradient(0, y, 0, y + 8); grd.addColorStop(0, '#f2f2ee'); grd.addColorStop(0.7, '#cfd1cf'); grd.addColorStop(1, '#8e9192'); g.fillStyle = grd; g.fillRect(0, y, 64, 8); }
    g.fillStyle = 'rgba(80,80,80,.5)'; g.fillRect(14, 0, 1, 128); g.fillRect(48, 0, 1, 128); T.blinds = c; }

  // Illuminated EXIT sign face.
  { const c = cv(256, 96); const g = c.getContext('2d'); g.fillStyle = '#0b0c0d'; g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#ff2a1f'; g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', 128, 52);
    g.fillStyle = '#ff2a1f'; g.beginPath(); g.moveTo(232, 48); g.lineTo(218, 36); g.lineTo(218, 60); g.closePath(); g.fill(); T.exit = c; }

  // Desk phone: display + keypad + line buttons.
  { const c = cv(128); const g = c.getContext('2d'); g.fillStyle = '#17191d'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#7fb7e6'; g.fillRect(10, 8, 74, 26); g.fillStyle = '#0a1a2a'; g.font = 'bold 9px system-ui'; g.fillText('LINE 1  911', 14, 24);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) { g.fillStyle = '#3a3f48'; g.fillRect(14 + q * 22, 44 + r * 20, 18, 15); }
    for (let i = 0; i < 6; i++) { g.fillStyle = i < 2 ? '#2fd08a' : '#3a3f48'; g.fillRect(96, 10 + i * 18, 22, 12); } T.phone = c; }

  // Lined legal pad / paperwork.
  { const c = cv(128); const g = c.getContext('2d'); g.fillStyle = '#fbf7d8'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(70,120,190,.45)'; g.lineWidth = 1; for (let y = 18; y < 128; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    g.strokeStyle = 'rgba(200,60,60,.5)'; g.beginPath(); g.moveTo(18, 0); g.lineTo(18, 128); g.stroke();
    g.fillStyle = 'rgba(30,40,70,.6)'; for (let y = 24; y < 100; y += 9) g.fillRect(24, y, 30 + ((y * 37) % 60), 1.4); T.paper = c; }

  // Kitchen cabinet doors (break room) – flat slab doors with pulls.
  T.cabinet = paint(S, (x, y, n, r) => {
    const q = S / 2; const lx = x % q, ly = y % q; const gap = lx < 2 * k || ly < 2 * k ? -60 : 0;
    const pull = lx > q * 0.42 && lx < q * 0.58 && ly > q * 0.1 && ly < q * 0.14 ? 60 : 0;
    const v = 214 + (n - 0.5) * 8 + gap + pull; return [clamp(v - 2), clamp(v), clamp(v + 2)];
  }, { offset: 12 });

  return T;
}

/** Blurry equirectangular reflection map of the dispatch floor (ceiling lights above, windows east, video wall north). */
export function makeEnvironment(w = 256) {
  const h = w / 2; const c = cv(w, h); const g = c.getContext('2d');
  // ceiling
  let grd = g.createLinearGradient(0, 0, 0, h * 0.5); grd.addColorStop(0, '#d9dcdf'); grd.addColorStop(1, '#8d939a'); g.fillStyle = grd; g.fillRect(0, 0, w, h * 0.5);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 16; i++) { const x = (i / 16) * w; g.fillRect(x, h * 0.05, w * 0.03, h * 0.05); g.fillRect(x + w * 0.02, h * 0.2, w * 0.04, h * 0.03); g.fillRect(x + w * 0.01, h * 0.33, w * 0.035, h * 0.02); }
  // walls band
  grd = g.createLinearGradient(0, h * 0.4, 0, h * 0.62); grd.addColorStop(0, '#9da3a9'); grd.addColorStop(1, '#5c636c'); g.fillStyle = grd; g.fillRect(0, h * 0.4, w, h * 0.22);
  // north (-Z → u≈0.25): navy accent wall with the bright video wall
  g.fillStyle = '#1f3552'; g.fillRect(w * 0.12, h * 0.4, w * 0.26, h * 0.22);
  g.fillStyle = '#4b7fbf'; g.fillRect(w * 0.2, h * 0.43, w * 0.1, h * 0.09);
  // east (+X → u≈0.5): windows with sky
  g.fillStyle = '#b9d4ee'; for (const x of [0.44, 0.5, 0.56]) g.fillRect(w * x - w * 0.02, h * 0.42, w * 0.04, h * 0.11);
  // floor
  grd = g.createLinearGradient(0, h * 0.62, 0, h); grd.addColorStop(0, '#2c3442'); grd.addColorStop(1, '#151a22'); g.fillStyle = grd; g.fillRect(0, h * 0.62, w, h * 0.38);
  return c;
}

/** Equirectangular face for the NPC head sphere (multiplied by skin tone; face points along -Z → u = 0.75). */
export function makeFace() {
  const W = 256, Hh = 128; const c = cv(W, Hh); const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, Hh);
  const cx = W * 0.75;
  // soft cheek warmth and jaw shading
  for (const s of [-1, 1]) { const grd = g.createRadialGradient(cx + s * 22, 74, 0, cx + s * 22, 74, 14); grd.addColorStop(0, 'rgba(230,140,130,.35)'); grd.addColorStop(1, 'rgba(230,140,130,0)'); g.fillStyle = grd; g.fillRect(cx + s * 22 - 14, 60, 28, 28); }
  // brows
  g.fillStyle = 'rgba(60,40,30,.75)'; for (const s of [-1, 1]) { g.save(); g.translate(cx + s * 12, 50); g.rotate(s * -0.12); g.fillRect(-7, -1.5, 14, 3.2); g.restore(); }
  // eyes: white, iris, highlight
  for (const s of [-1, 1]) {
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(cx + s * 12, 59, 6, 3.6, 0, 0, 6.283); g.fill();
    g.fillStyle = '#3b2a1e'; g.beginPath(); g.arc(cx + s * 12, 59, 3, 0, 6.283); g.fill();
    g.fillStyle = '#0c0807'; g.beginPath(); g.arc(cx + s * 12, 59, 1.5, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(40,25,20,.55)'; g.fillRect(cx + s * 12 - 6.5, 55.2, 13, 1.4);
  }
  // nose shading and mouth
  g.fillStyle = 'rgba(150,90,70,.28)'; g.beginPath(); g.ellipse(cx, 69, 3.4, 5, 0, 0, 6.283); g.fill();
  g.fillStyle = 'rgba(120,60,50,.35)'; g.fillRect(cx - 3, 72, 6, 1.4);
  g.strokeStyle = 'rgba(140,60,55,.85)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx - 8, 81); g.quadraticCurveTo(cx, 85, cx + 8, 81); g.stroke();
  // ears (at the sides of the head: u = 0.5 and 1.0)
  g.fillStyle = 'rgba(170,100,85,.35)'; for (const ux of [W * 0.5, 0, W]) { g.beginPath(); g.ellipse(ux, 63, 5, 9, 0, 0, 6.283); g.fill(); }
  return c;
}

/** Soft radial blob used for contact shadows under people and furniture. */
export function makeBlob(size = 64) {
  const c = cv(size); const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.55, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, size, size); return c;
}

export function textTexture(lines, { w = 512, h = 128, bg = '#0b1830', fg = '#ffffff', font = 'bold 54px system-ui', align = 'center', accent } = {}) {
  const c = cv(w, h); const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (accent) { g.fillStyle = accent; g.fillRect(0, h - 10, w, 10); }
  g.fillStyle = fg; g.textAlign = align; g.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((l, i) => { g.font = i === 0 ? font : font.replace(/\d+px/, (m) => `${Math.round(parseInt(m, 10) * 0.55)}px`); g.fillText(l, align === 'center' ? w / 2 : 20, (h / (arr.length + 1)) * (i + 1)); });
  return c;
}

export function makeCanvas(w, h) { return cv(w, h); }
