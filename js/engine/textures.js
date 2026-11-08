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
  T.wall = paint(S, (x, y, n, r) => { const peel = (r() - 0.5) * 5 + (((x * 7 + y * 13) % 5) - 2) * 0.6; const v = 204 + (n - 0.5) * 9 + peel; return [clamp(v + 2), clamp(v + 2), clamp(v + 1)]; }, { offset: 3 });

  // Navy fabric-wrapped acoustic panels (1 m wide) with reveals.
  T.accent = paint(S, (x, y, n, r) => {
    const half = S / 2; const lx = x % half; const reveal = lx < 2 * k ? -26 : lx < 4 * k ? -8 : lx > half - 3 * k ? 6 : 0;
    const weave = ((x + y) % 3 === 0 ? 4 : 0) + ((x - y) % 4 === 0 ? -3 : 0);
    const v = 50 + (n - 0.5) * 12 + (r() - 0.5) * 10 + weave + reveal;
    return [clamp(v * 0.45), clamp(v * 0.72), clamp(v * 1.25)];
  }, { offset: 4 });

  // Walnut veneer: fine straight grain with gentle cathedral figure, pores and subtle plank changes.
  T.wood = paint(S, (x, y, n, r) => {
    const fig = Math.sin((y / k) * 0.045 + Math.sin((x / k) * 0.02) * 1.6 + n * 2.2) * 0.5 + 0.5;          // broad figure
    const lines = Math.sin((y / k) * 0.85 + n * 3.2 + Math.sin((x / k) * 0.006) * 2) * 0.5 + 0.5;       // fine grain
    const pores = r() < 0.05 ? -10 : 0; const plank = ((Math.floor(y / (S / 4)) * 37) % 9) - 4;
    const v = 96 + fig * 18 + lines * 12 + (n - 0.5) * 16 + pores + plank;
    return [clamp(v * 1.16), clamp(v * 0.8), clamp(v * 0.55)];
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

  // ---- law-enforcement set ----
  // US flag at its official 10:19 proportions: 13 stripes, canton 7 stripes tall and 0.76 × the hoist wide, 50 stars.
  { const W = 380, Hh = 200; const c = cv(W, Hh); const g = c.getContext('2d'); const st = Hh / 13;
    for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#f4f2ee' : '#b22234'; g.fillRect(0, Math.floor(i * st), W, Math.ceil(st) + 1); }
    const cw = Hh * 0.76, ch = st * 7; g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#f4f2ee';
    const starAt = (x, y, R) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? R * 0.4 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    for (let r = 0; r < 9; r++) for (let q = 0; q < (r % 2 ? 5 : 6); q++) starAt(cw / 12 * (1 + q * 2 + (r % 2)), ch / 10 * (1 + r), st * 0.31);
    T.flagUS = c; }
  // Illinois state flag (3:5): white field, eagle on a rock with the shield and banner, ILLINOIS beneath.
  { const W = 334, Hh = 200; const c = cv(W, Hh); const g = c.getContext('2d'); g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, W, Hh);
    const cx = W / 2;
    g.fillStyle = '#4d6b2a'; g.beginPath(); g.ellipse(cx, 132, 70, 12, 0, 0, 6.283); g.fill();                  // ground
    g.fillStyle = '#8a6a3a'; g.fillRect(cx - 26, 104, 52, 24);                                                      // rock
    g.fillStyle = '#6b4a24'; g.beginPath(); g.moveTo(cx - 52, 66); g.quadraticCurveTo(cx - 28, 40, cx, 58); g.quadraticCurveTo(cx + 28, 40, cx + 52, 66); g.quadraticCurveTo(cx + 20, 72, cx, 96); g.quadraticCurveTo(cx - 20, 72, cx - 52, 66); g.fill(); // eagle wings
    g.fillStyle = '#f4f2ee'; g.beginPath(); g.arc(cx + 4, 50, 7, 0, 6.283); g.fill(); g.fillStyle = '#d9a52a'; g.fillRect(cx + 9, 49, 6, 3); // head + beak
    g.fillStyle = '#3c3b6e'; g.fillRect(cx - 12, 66, 24, 8); g.fillStyle = '#f4f2ee'; g.fillRect(cx - 12, 74, 24, 18); g.fillStyle = '#b22234'; for (let i = 0; i < 4; i++) g.fillRect(cx - 10 + i * 6, 74, 3, 18); // shield
    g.strokeStyle = '#b22234'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 60, 40); g.quadraticCurveTo(cx, 22, cx + 60, 40); g.stroke();       // banner
    g.fillStyle = '#3c3b6e'; g.font = '800 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ILLINOIS', cx, 166);
    T.flagIL = c; }
  // Sheriff star seal
  { const n = 256; const c = cv(n); const g = c.getContext('2d'); g.fillStyle = '#1f3552'; g.fillRect(0, 0, n, n);
    g.fillStyle = '#c9a227'; g.beginPath(); g.arc(128, 128, 120, 0, 6.283); g.fill(); g.fillStyle = '#1f3552'; g.beginPath(); g.arc(128, 128, 108, 0, 6.283); g.fill();
    const star = (r1, r2, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + i * Math.PI / 7; const rr = i % 2 ? r2 : r1; g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    star(96, 52, '#d9b23a'); star(84, 46, '#f0cf5a');
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 7; g.fillStyle = '#d9b23a'; g.beginPath(); g.arc(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96, 7, 0, 6.283); g.fill(); }
    g.fillStyle = '#1f3552'; g.beginPath(); g.arc(128, 128, 34, 0, 6.283); g.fill();
    g.fillStyle = '#f0cf5a'; g.font = '900 22px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('911', 128, 129);
    g.save(); g.translate(128, 128); g.font = '800 15px system-ui'; const txt = 'EMERGENCY · COMMUNICATIONS · DISPATCH ·'; for (let i = 0; i < txt.length; i++) { g.save(); g.rotate(-Math.PI * 0.95 + (i / txt.length) * Math.PI * 1.9); g.fillText(txt[i], 0, -114 + 0); g.restore(); } g.restore();
    T.seal = c; }
  // Steel lockers: 4 louvered doors with name plates
  { const c = cv(256); const g = c.getContext('2d'); g.fillStyle = '#4e5866'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) { const x = i * 64; g.fillStyle = '#5b6676'; g.fillRect(x + 3, 3, 58, 250); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 61, 3, 2, 250);
      for (let k = 0; k < 6; k++) { g.fillStyle = '#2e343d'; g.fillRect(x + 14, 14 + k * 7, 36, 3); g.fillRect(x + 14, 206 + (k % 3) * 7, 36, 3); }
      g.fillStyle = '#e6e2d3'; g.fillRect(x + 20, 64, 24, 9); g.fillStyle = '#333'; g.fillRect(x + 23, 67, 18, 3);
      g.fillStyle = '#b8bec6'; g.fillRect(x + 50, 118, 6, 22); }
    T.lockers = c; }
  // BOLO / bulletin cork board with pinned flyers
  { const c = cv(256, 160); const g = c.getContext('2d'); const rr = rng(77);
    g.fillStyle = '#b38a5a'; g.fillRect(0, 0, 256, 160); for (let i = 0; i < 900; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(90,60,30,.25)' : 'rgba(230,200,150,.2)'; g.fillRect(rr() * 256, rr() * 160, 2, 2); }
    const flyer = (x, y, w, h, head, col, photo) => { g.save(); g.translate(x + w / 2, y + h / 2); g.rotate((rr() - 0.5) * 0.12); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-w / 2 + 2, -h / 2 + 2, w, h); g.fillStyle = '#f7f5ee'; g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = col; g.fillRect(-w / 2, -h / 2, w, 12); g.fillStyle = '#fff'; g.font = '900 9px system-ui'; g.textAlign = 'center'; g.fillText(head, 0, -h / 2 + 9);
      if (photo) { g.fillStyle = '#9aa3ad'; g.fillRect(-w / 2 + 6, -h / 2 + 16, 18, 22); g.fillStyle = '#6d757e'; g.beginPath(); g.arc(-w / 2 + 15, -h / 2 + 24, 5, 0, 6.283); g.fill(); g.fillRect(-w / 2 + 8, -h / 2 + 31, 14, 7); }
      g.fillStyle = 'rgba(40,40,40,.6)'; for (let l = 0; l < 6; l++) g.fillRect(-w / 2 + (photo ? 28 : 6), -h / 2 + 18 + l * 5, w - (photo ? 34 : 12) - (l % 3) * 4, 1.6);
      g.fillStyle = '#d63a2f'; g.beginPath(); g.arc(0, -h / 2 + 2, 2.5, 0, 6.283); g.fill(); g.restore(); };
    flyer(10, 10, 66, 64, 'BOLO', '#b22234', true); flyer(88, 8, 70, 66, 'ATTEMPT TO LOCATE', '#c26a12', true); flyer(170, 12, 74, 60, 'MISSING PERSON', '#1f4f8a', true);
    flyer(14, 86, 80, 62, 'SHIFT NOTES', '#2f6b3a', false); flyer(104, 90, 64, 58, 'ROAD CLOSED', '#7a5a12', false); flyer(178, 84, 66, 66, 'TRAINING', '#4b3a7a', false);
    g.strokeStyle = '#6b4a24'; g.lineWidth = 8; g.strokeRect(0, 0, 256, 160); T.cork = c; }

  // Sheriff car door: star badge + SHERIFF + county (white field so it multiplies onto the black door)
  { const c = cv(512, 128); const g = c.getContext('2d'); g.fillStyle = '#0a0a0b'; g.fillRect(0, 0, 512, 128);
    const cx = 64, cy = 64; g.fillStyle = '#d9b23a'; g.beginPath(); for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + i * Math.PI / 7; const rr = i % 2 ? 22 : 46; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill();
    g.fillStyle = '#0a0a0b'; g.beginPath(); g.arc(cx, cy, 14, 0, 6.283); g.fill();
    g.fillStyle = '#f4f4f2'; g.font = '900 58px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText('SHERIFF', 124, 52);
    g.fillStyle = '#d9b23a'; g.font = '800 22px system-ui, sans-serif'; g.fillText('COUNTY SHERIFF', 126, 100); T.sheriffDoor = c; }
  // Roll-up garage door
  T.rollup = paint(S, (x, y, n) => { const slat = (y % Math.round(S / 12)); const v = 168 + (n - 0.5) * 18 + (slat < 2 * k ? -40 : slat < 4 * k ? 18 : 0); return [clamp(v), clamp(v + 2), clamp(v + 6)]; }, { offset: 13 });
  // Whiteboard with marker notes
  { const c = cv(512, 200); const g = c.getContext('2d'); g.fillStyle = '#f6f7f8'; g.fillRect(0, 0, 512, 200);
    g.strokeStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.moveTo(Math.random() * 512, Math.random() * 200); g.lineTo(Math.random() * 512, Math.random() * 200); g.stroke(); }
    g.font = '700 26px "Comic Sans MS", system-ui'; g.fillStyle = '#1f4fbf'; g.fillText('DAY SHIFT – DISTRICTS', 18, 38);
    g.font = '600 15px "Comic Sans MS", system-ui'; g.fillStyle = '#222';
    ['D1 Carmi / Hawthorne – Unit 21', 'D2 Norris City / Herald – Unit 24', 'D3 Grayville / Phillipstown – 27', 'D4 Crossville / Emma – Unit 29'].forEach((l, i) => g.fillText(l, 20, 72 + i * 28));
    g.strokeStyle = '#1f4fbf'; g.lineWidth = 2; g.beginPath(); g.moveTo(300, 52); g.lineTo(300, 180); g.stroke();
    g.fillStyle = '#c4161c'; g.fillText('Warrants: 1400 hrs', 316, 72); g.fillText('Court: Rm 2 @ 0900', 316, 100);
    g.fillStyle = '#2f8a3a'; g.fillText('Range qual Fri ✓', 316, 128); g.fillStyle = '#222'; g.fillText('K-9 Bo: vet Tue', 316, 156); T.whiteboard = c; }
  // Roll-call slide on the briefing display
  { const c = cv(512, 288); const g = c.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, 288); grd.addColorStop(0, '#13223d'); grd.addColorStop(1, '#0a1222'); g.fillStyle = grd; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#d9b23a'; g.fillRect(0, 0, 512, 40); g.fillStyle = '#0a1222'; g.font = '900 24px system-ui'; g.fillText("ROLL CALL · COUNTY SHERIFF'S OFFICE", 14, 28);
    g.fillStyle = '#dfe8f5'; g.font = '700 18px system-ui';
    ['• BOLO: dark green pickup, dented tailgate (IL-14 thefts)', '• Deer activity high – river bottoms after dusk', '• Harvest traffic on IL-1 & IL-14', '• Grain bin safety checks – Enfield area', '• Courthouse security: 0800–1700'].forEach((l, i) => g.fillText(l, 18, 78 + i * 34));
    g.fillStyle = '#64d2ff'; g.font = '700 14px system-ui'; g.fillText('BE SAFE · WEAR YOUR VEST · CHECK YOUR RADIO', 18, 270); T.briefing = c; }

  // ---------------- Police Department + exterior materials ----------------
  // Face brick, running bond: 4 courses x 2 bricks per tile (tile = 0.6 m wide x 0.3 m tall when uv = 0.6).
  T.brick = paint(S, (x, y, n, r) => {
    const rows = 4, cols = 2; const ch = S / rows, cw = S / cols;
    const row = Math.floor(y / ch); const off = row % 2 ? cw / 2 : 0; const bx = Math.floor(((x + off) % S) / cw);
    const lx = (x + off) % cw, ly = y % ch; const mortar = lx < 3 * k || ly < 3 * k;
    const id = (row * 7 + bx * 13) % 11; const tone = [0, 10, -8, 16, -14, 6, -4, 20, -18, 3, 12][id];
    if (mortar) { const m = 168 + (n - 0.5) * 30; return [clamp(m), clamp(m - 4), clamp(m - 12)]; }
    const edge = Math.min(lx, cw - lx, ly, ch - ly) < 6 * k ? -10 : 0;
    const v = (n - 0.5) * 34 + (r() - 0.5) * 26 + tone + edge;
    return [clamp(146 + v), clamp(70 + v * 0.6), clamp(52 + v * 0.45)];
  }, { offset: 21 });
  // Asphalt: aggregate speckle over soft patches, a few dark patches and cracks.
  T.asphalt = paint(S, (x, y, n, r) => {
    const sp = r(); const crack = Math.abs(Math.sin(x * 0.045 / k + Math.sin(y * 0.03 / k) * 3) * 40 - y * 0.06 / k % 40) < 0.5 && n > 0.6 ? -28 : 0;
    const v = 64 + (n - 0.5) * 26 + (sp > 0.93 ? 30 : sp < 0.06 ? -20 : 0) + (sp - 0.5) * 12 + crack;
    return [clamp(v), clamp(v + 1), clamp(v + 4)];
  }, { offset: 22 });
  // Broom-finished concrete with tooled control joints every tile.
  T.sidewalk = paint(S, (x, y, n, r) => {
    const joint = x < 2 * k || y < 2 * k ? -42 : 0; const broom = Math.sin(y * 1.7 / k + n * 6) * 4;
    const v = 170 + (n - 0.5) * 36 + (r() - 0.5) * 14 + broom + joint;
    return [clamp(v), clamp(v - 2), clamp(v - 7)];
  }, { offset: 23 });
  // Lawn: blade streaks over mottled green.
  T.grass = paint(S, (x, y, n, r) => {
    const blade = Math.sin(x * 2.3 / k + Math.sin(y * 0.9 / k) * 2) * 0.5 + 0.5; const sp = r();
    const v = (n - 0.5) * 50 + blade * 14 + (sp - 0.5) * 30;
    return [clamp(92 + v * 0.7), clamp(128 + v), clamp(58 + v * 0.5)];
  }, { offset: 24 });
  // Ballasted / membrane flat roof.
  T.roof = paint(S, (x, y, n, r) => { const v = 120 + (n - 0.5) * 40 + (r() - 0.5) * 40 + (y % (S / 4) < 2 * k ? -18 : 0); return [clamp(v), clamp(v), clamp(v + 3)]; }, { offset: 25 });
  // Polished terrazzo for the lobby and corridors (reflective).
  T.terrazzo = paint(S, (x, y, n, r) => {
    const chip = r(); const c = chip > 0.92 ? [70, 66, 62] : chip > 0.84 ? [214, 206, 192] : chip > 0.8 ? [150, 110, 80] : null;
    const base = 186 + (n - 0.5) * 22; const strip = x % (S / 2) < 2 * k || y % (S / 2) < 2 * k;
    if (strip) return [176, 160, 120];
    return c ? c.map((v) => clamp(v + (n - 0.5) * 20)) : [clamp(base), clamp(base - 3), clamp(base - 9)];
  }, { offset: 26 });
  // Office carpet tile (charcoal blue with a fine loop pattern).
  T.officeCarpet = paint(S, (x, y, n, r) => {
    const loop = ((x >> 1) + (y >> 1)) % 4 === 0 ? 6 : 0; const seam = x % (S / 2) < 1 || y % (S / 2) < 1 ? -10 : 0;
    const v = 52 + (n - 0.5) * 18 + (r() - 0.5) * 16 + loop + seam;
    return [clamp(v * 0.82), clamp(v * 0.92), clamp(v * 1.12)];
  }, { offset: 27 });
  // Glazed ceramic wall tile for restrooms (0.3 m squares with grout).
  T.ceramic = paint(S, (x, y, n, r) => {
    const g = S / 2; const grout = x % g < 2 * k || y % g < 2 * k; if (grout) return [150, 150, 146];
    const v = 226 + (n - 0.5) * 10 + (r() - 0.5) * 4; return [clamp(v - 6), clamp(v), clamp(v + 2)];
  }, { offset: 28 });
  // Vinyl plank floor (break room / training room).
  T.plank = paint(S, (x, y, n, r) => {
    const pw = S / 4; const row = Math.floor(y / pw); const off = (row * 97) % S; const seam = y % pw < 2 * k || (x + off) % S < 2 * k;
    const grain = Math.sin((x + off) * 0.25 / k + n * 9 + row) * 8; const v = 150 + (n - 0.5) * 30 + grain + (row % 3) * 9 + (seam ? -40 : 0);
    return [clamp(v), clamp(v * 0.78), clamp(v * 0.56)];
  }, { offset: 29 });
  // Tree bark (vertical fissures).
  T.bark = paint(S, (x, y, n, r) => { const f = Math.abs(Math.sin(x * 0.22 / k + n * 5)) ; const v = 70 + f * 40 + (n - 0.5) * 30 + (r() - 0.5) * 10; return [clamp(v * 0.85), clamp(v * 0.7), clamp(v * 0.55)]; }, { offset: 30 });
  // City Police roll-call slide and the training-room projector slide
  const slide = (title, accent, lines, foot) => { const c = cv(512, 288); const g = c.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, 288); grd.addColorStop(0, '#102038'); grd.addColorStop(1, '#08101d'); g.fillStyle = grd; g.fillRect(0, 0, 512, 288);
    g.fillStyle = accent; g.fillRect(0, 0, 512, 40); g.fillStyle = '#08101d'; g.font = '900 22px system-ui'; g.fillText(title, 14, 28);
    g.fillStyle = '#dfe8f5'; g.font = '700 17px system-ui'; lines.forEach((l, i) => g.fillText(l, 18, 76 + i * 33));
    g.fillStyle = '#64d2ff'; g.font = '700 14px system-ui'; g.fillText(foot, 18, 272); return c; };
  T.pdBriefing = slide('CITY POLICE · ROLL CALL', '#3da5ff', ['• Patrol priorities: downtown, schools at dismissal', '• Catalytic converter thefts – check parked trucks', '• Harvest traffic: IL-1 / IL-14 after dark', '• BOLO board updated 0600 – read before patrol', '• Body cams ON every contact'], 'SAFE SHIFT · CHECK YOUR GEAR · BACK EACH OTHER UP');
  T.pdTraining = slide('IN-SERVICE TRAINING · DE-ESCALATION', '#2fd08a', ['1. Slow it down: time, distance, cover', '2. Listen first – one officer talks', '3. Crisis Intervention Team referral', '4. Use-of-force reporting refresher', '5. CPR / AED recertification at 1400'], 'STATE-MANDATED TRAINING HOURS · SIGN IN AT THE DOOR');
  // Foliage clumps (used with alpha-free shading on leaf masses).
  T.leaves = paint(S, (x, y, n, r) => { const sp = r(); const v = (n - 0.5) * 80 + (sp - 0.5) * 70; return [clamp(180 + v), clamp(190 + v), clamp(170 + v)]; }, { offset: 31 });

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
