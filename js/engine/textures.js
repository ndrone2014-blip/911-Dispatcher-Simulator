// Procedural textures generated on canvases (no image files required).
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function noise(ctx, w, h, amt, alpha = 1, seed = 1) {
  const img = ctx.getImageData(0, 0, w, h); const d = img.data; let s = seed * 9301 + 49297;
  for (let i = 0; i < d.length; i += 4) { s = (s * 9301 + 49297) % 233280; const n = (s / 233280 - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; d[i + 3] = 255 * alpha; }
  ctx.putImageData(img, 0, 0);
}

export function makeTextures(size = 256) {
  const S = size; const T = {};
  // carpet tiles
  { const c = cv(S); const g = c.getContext('2d'); g.fillStyle = '#3a4352'; g.fillRect(0, 0, S, S); noise(g, S, S, 38, 1, 3);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2);
    g.fillStyle = 'rgba(80,110,150,.08)'; for (let i = 0; i < 40; i++) g.fillRect((i * 37) % S, (i * 71) % S, 18, 2); T.carpet = c; }
  // ceiling tiles
  { const c = cv(S); const g = c.getContext('2d'); g.fillStyle = '#e4e6e8'; g.fillRect(0, 0, S, S); noise(g, S, S, 14, 1, 5);
    g.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 260; i++) g.fillRect((i * 53) % S, (i * 97) % S, 2, 2);
    g.strokeStyle = '#b8bcc2'; g.lineWidth = 4; g.strokeRect(0, 0, S, S); T.ceiling = c; }
  // painted wall
  { const c = cv(S); const g = c.getContext('2d'); g.fillStyle = '#c9ccd1'; g.fillRect(0, 0, S, S); noise(g, S, S, 10, 1, 7); T.wall = c; }
  // accent wall (dark blue)
  { const c = cv(S); const g = c.getContext('2d'); g.fillStyle = '#1f3552'; g.fillRect(0, 0, S, S); noise(g, S, S, 12, 1, 8); T.accent = c; }
  // wood laminate
  { const c = cv(S); const g = c.getContext('2d'); g.fillStyle = '#8a6a4a'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 2) { g.fillStyle = `rgba(${60 + Math.sin(y * 0.11) * 20},${40 + Math.sin(y * 0.07) * 12},20,${0.08 + (Math.sin(y * 0.31) + 1) * 0.05})`; g.fillRect(0, y, S, 2); }
    noise(g, S, S, 12, 1, 11); T.wood = c; }
  // light desk laminate
  { const c = cv(S); const g = c.getContext('2d'); g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, S, S); noise(g, S, S, 10, 1, 12); T.laminate = c; }
  // fabric
  { const c = cv(128); const g = c.getContext('2d'); g.fillStyle = '#2d3138'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 2) { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(i, 0, 1, 128); g.fillRect(0, i, 128, 1); } noise(g, 128, 128, 18, 1, 13); T.fabric = c; }
  // brushed metal
  { const c = cv(128); const g = c.getContext('2d'); g.fillStyle = '#8c939c'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.fillRect(0, y, 128, 1); } T.metal = c; }
  // floor tile (break room)
  { const c = cv(S); const g = c.getContext('2d'); const h = S / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#bfc3c7' : '#d7dadd'; g.fillRect(i * h, j * h, h, h); }
    noise(g, S, S, 10, 1, 15); g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; for (let k = 0; k <= 2; k++) { g.beginPath(); g.moveTo(k * h, 0); g.lineTo(k * h, S); g.moveTo(0, k * h); g.lineTo(S, k * h); g.stroke(); } T.tile = c; }
  // keyboard
  { const c = cv(256, 96); const g = c.getContext('2d'); g.fillStyle = '#16181c'; g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#2a2e35'; for (let r = 0; r < 5; r++) for (let k = 0; k < 15; k++) g.fillRect(6 + k * 16.4, 6 + r * 17.5, 14, 15); T.keyboard = c; }
  // console radio panel
  { const c = cv(128, 64); const g = c.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, 128, 64);
    const cols = ['#2fd08a', '#ff5a4e', '#f2c94c', '#4f8cff'];
    for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.fillRect(8 + (i % 4) * 30, 10 + Math.floor(i / 4) * 24, 22, 14); }
    T.radioPanel = c; }
  return T;
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
