// Character texture atlas: one shared canvas texture for every person in the building, so
// each person is a single draw call. Fabric regions are near-white detail maps (weave,
// seams, stitching, pockets, creases, folds) that are multiplied by each person's own
// vertex colours; emblems (badges, shoulder patches, flag, ID cards) are painted in full
// colour or as grey relief for metal. The renderer's bump pass turns the brightness of
// this texture into surface relief, so seams and stitching catch the light.
//
// All coordinates are authored on a 1024² grid and scaled to the chosen size (512 on phones).

/** Named regions in normalized texture space [u0, v0, u1, v1] (v grows downward, canvas-style). */
export const REGION = {};
const R = (name, x, y, w, h) => { REGION[name] = [x / 1024, y / 1024, (x + w) / 1024, (y + h) / 1024]; };
R('shirtUniform', 0, 0, 256, 256); R('tee', 256, 0, 256, 256); R('polo', 512, 0, 256, 256); R('plaidRed', 768, 0, 256, 256);
R('pants', 0, 256, 256, 256); R('jeans', 256, 256, 256, 256); R('cargo', 512, 256, 256, 256); R('plaidBlue', 768, 256, 256, 256);
R('face', 0, 512, 256, 256); R('faceOld', 256, 512, 256, 256); R('hair', 512, 512, 128, 256);
R('skin', 640, 512, 128, 128); R('leather', 640, 640, 128, 128); R('metal', 768, 512, 128, 128); R('white', 896, 512, 128, 128);
R('knit', 768, 640, 256, 128);
R('badgePD', 0, 768, 128, 128); R('badgeSO', 128, 768, 128, 128); R('badgeFire', 256, 768, 128, 128);
R('patchPD', 384, 768, 128, 128); R('patchSO', 512, 768, 128, 128); R('patchFire', 640, 768, 128, 128); R('patchEMS', 768, 768, 128, 128);
R('flag', 896, 768, 128, 64); R('patch911', 896, 832, 128, 64);
R('chevrons', 384, 896, 128, 128); R('idCard', 512, 896, 64, 128); R('bodycam', 576, 896, 64, 64); R('nameplate', 576, 960, 64, 32);
R('canvasWork', 640, 896, 128, 128); R('plaidBrown', 768, 896, 128, 128); R('denimJacket', 896, 896, 128, 128);
R('badgeEMS', 0, 896, 128, 128); R('badgeFlat', 128, 896, 128, 128); R('hoodie', 256, 896, 128, 128);

/** Remap a local 0..1 UV into a named region. */
export function regionUV(name, u, v) { const r = REGION[name] || REGION.white; return [r[0] + (r[2] - r[0]) * u, r[1] + (r[3] - r[1]) * v]; }

let cache = null;
export function makeCharacterAtlas(size = 1024) {
  if (cache && cache.width === size) return cache;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.scale(size / 1024, size / 1024);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const box = (name) => { const r = REGION[name]; return [r[0] * 1024, r[1] * 1024, (r[2] - r[0]) * 1024, (r[3] - r[1]) * 1024]; };
  const fill = (name, col) => { const [x, y, w, h] = box(name); g.fillStyle = col; g.fillRect(x, y, w, h); };
  const noise = (name, amt, cell = 1, alpha = 1) => { const [x, y, w, h] = box(name); for (let j = 0; j < h; j += cell) for (let i = 0; i < w; i += cell) { const v = (rnd() - 0.5) * amt; g.fillStyle = v > 0 ? `rgba(255,255,255,${v * alpha})` : `rgba(0,0,0,${-v * alpha})`; g.fillRect(x + i, y + j, cell, cell); } };
  const line = (x0, y0, x1, y1, col, wd = 1, dash) => { g.strokeStyle = col; g.lineWidth = wd; g.setLineDash(dash || []); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]); };
  const clip = (name, fn) => { const [x, y, w, h] = box(name); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); fn(x, y, w, h); g.restore(); };
  const seam = (x0, y0, x1, y1) => { line(x0, y0, x1, y1, 'rgba(0,0,0,.28)', 1.6); line(x0 + 1.5, y0, x1 + 1.5, y1, 'rgba(0,0,0,.22)', 0.8, [2, 2]); line(x0 - 1, y0, x1 - 1, y1, 'rgba(255,255,255,.18)', 0.8); };
  const fold = (x, y, w, h, n, dir = 'v', a = 0.1) => { for (let k = 0; k < n; k++) { const t = rnd(); const gr = dir === 'v' ? g.createLinearGradient(x + t * w - 6, 0, x + t * w + 6, 0) : g.createLinearGradient(0, y + t * h - 5, 0, y + t * h + 5); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, `rgba(0,0,0,${a})`); gr.addColorStop(0.62, `rgba(255,255,255,${a * 0.6})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; dir === 'v' ? g.fillRect(x + t * w - 6, y + rnd() * h * 0.4, 12, h * (0.3 + rnd() * 0.4)) : g.fillRect(x + rnd() * w * 0.5, y + t * h - 5, w * (0.3 + rnd() * 0.4), 10); } };
  const button = (x, y, r = 3) => { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + 0.6, y + 0.8, r, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x, y, r * 0.85, 0, 6.283); g.fill(); g.fillStyle = 'rgba(0,0,0,.4)'; for (const [dx, dy] of [[-0.8, -0.8], [0.8, 0.8]]) g.fillRect(x + dx - 0.4, y + dy - 0.4, 0.8, 0.8); };
  const weave = (name, base = '#ececec', amt = 0.18) => { fill(name, base); noise(name, amt, 1); clip(name, (x, y, w, h) => { for (let j = 0; j < h; j += 2) { g.fillStyle = `rgba(0,0,0,${0.025 + rnd() * 0.02})`; g.fillRect(x, y + j, w, 1); } for (let i = 0; i < w; i += 2) { g.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.02})`; g.fillRect(x + i, y, 1, h); } }); };

  // ---------------- uniform shirt (u = around the torso, front at u = .5; v = neck → hip)
  weave('shirtUniform', '#e9e9e9', 0.14);
  clip('shirtUniform', (x, y, w, h) => {
    seam(x + w * 0.25, y, x + w * 0.25, y + h); seam(x + w * 0.75, y, x + w * 0.75, y + h);   // side seams
    // front placket with buttons
    for (const s of [-1, 1]) line(x + w * 0.5 + s * 5, y + h * 0.06, x + w * 0.5 + s * 5, y + h * 0.95, 'rgba(0,0,0,.3)', 1.2);
    for (let k = 0; k < 6; k++) button(x + w * 0.5, y + h * (0.12 + k * 0.14), 2.6);
    // chest pockets with pleat and buttoned flaps
    for (const s of [-1, 1]) {
      const cx = x + w * (0.5 + s * 0.115), py = y + h * 0.2;
      g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(cx - 15, py, 30, 38);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2; g.strokeRect(cx - 15, py, 30, 38);
      line(cx, py + 10, cx, py + 38, 'rgba(0,0,0,.2)', 1);                              // box pleat
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(cx - 17, py - 2); g.lineTo(cx + 17, py - 2); g.lineTo(cx + 16, py + 10); g.lineTo(cx, py + 14); g.lineTo(cx - 16, py + 10); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.stroke(); line(cx - 15, py + 1, cx + 15, py + 1, 'rgba(0,0,0,.25)', 0.8, [2, 2]);
      button(cx, py + 9, 2.4);
      line(cx, py + 40, cx, y + h * 0.95, 'rgba(0,0,0,.12)', 1.4); line(cx + 1.5, py + 40, cx + 1.5, y + h * 0.95, 'rgba(255,255,255,.14)', 1); // pressed creases
    }
    // back yoke and creases
    for (const u of [0, 1]) { line(x + w * (u ? 0.75 : 0), y + h * 0.13, x + w * (u ? 1 : 0.25), y + h * 0.13, 'rgba(0,0,0,.25)', 1.2); }
    for (const u of [0.06, 0.94]) line(x + w * u, y + h * 0.13, x + w * u, y + h, 'rgba(0,0,0,.1)', 1.5);
    fold(x, y + h * 0.55, w, h * 0.45, 22, 'v', 0.09);
  });
  // ---------------- t-shirt / knit
  weave('tee', '#ededed', 0.2);
  clip('tee', (x, y, w, h) => { seam(x + w * 0.25, y, x + w * 0.25, y + h); seam(x + w * 0.75, y, x + w * 0.75, y + h); fold(x, y, w, h, 26, 'v', 0.08); fold(x, y + h * 0.3, w, h * 0.7, 10, 'h', 0.06); line(x, y + h * 0.97, x + w, y + h * 0.97, 'rgba(0,0,0,.25)', 1, [2, 2]); });
  // ---------------- polo (short placket, two buttons, small embroidered chest logo spot)
  weave('polo', '#ebebeb', 0.22);
  clip('polo', (x, y, w, h) => { seam(x + w * 0.25, y, x + w * 0.25, y + h); seam(x + w * 0.75, y, x + w * 0.75, y + h);
    for (const s of [-1, 1]) line(x + w * 0.5 + s * 5, y, x + w * 0.5 + s * 5, y + h * 0.22, 'rgba(0,0,0,.3)', 1.2); line(x + w * 0.5 - 5, y + h * 0.22, x + w * 0.5 + 5, y + h * 0.22, 'rgba(0,0,0,.3)', 1.2);
    button(x + w * 0.5, y + h * 0.08, 2.4); button(x + w * 0.5, y + h * 0.16, 2.4);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x + w * 0.39, y + h * 0.24, 5, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke();
    fold(x, y, w, h, 22, 'v', 0.08); });
  // ---------------- plaids (full colour; vertex colour is white for these garments)
  const plaid = (name, base, bands) => { fill(name, base); clip(name, (x, y, w, h) => { const step = w / 4;
    for (let k = 0; k < 8; k++) for (const [off, wd, col] of bands) { g.fillStyle = col; g.fillRect(x + k * step / 2 + off, y, wd, h); g.fillRect(x, y + k * step / 2 + off, w, wd); }
    noise(name, 0.16, 1); fold(x, y, w, h, 18, 'v', 0.1); seam(x + w * 0.25, y, x + w * 0.25, y + h); seam(x + w * 0.75, y, x + w * 0.75, y + h); }); };
  plaid('plaidRed', '#7d1b1b', [[0, 32, 'rgba(15,10,10,.85)'], [40, 3, 'rgba(220,200,150,.4)']]);
  plaid('plaidBlue', '#1e3a5a', [[0, 30, 'rgba(25,70,45,.8)'], [36, 4, 'rgba(240,240,240,.35)'], [48, 2, 'rgba(200,40,40,.4)']]);
  plaid('plaidBrown', '#6b4a2b', [[0, 16, 'rgba(40,30,20,.7)'], [20, 2, 'rgba(230,200,140,.4)']]);

  // ---------------- trousers (u around the leg, front crease at .5)
  weave('pants', '#e6e6e6', 0.16);
  clip('pants', (x, y, w, h) => { line(x + w * 0.5, y, x + w * 0.5, y + h, 'rgba(255,255,255,.35)', 1.4); line(x + w * 0.5 + 1.6, y, x + w * 0.5 + 1.6, y + h, 'rgba(0,0,0,.22)', 1.2);
    seam(x + w * 0.25, y, x + w * 0.25, y + h); seam(x + w * 0.75, y, x + w * 0.75, y + h); fold(x, y + h * 0.48, w, h * 0.14, 9, 'h', 0.1); fold(x, y + h * 0.86, w, h * 0.14, 9, 'h', 0.1);
    for (const s of [0.18, 0.82]) { line(x + w * s, y, x + w * (s + (s < 0.5 ? 0.05 : -0.05)), y + h * 0.12, 'rgba(0,0,0,.3)', 1.2); } });
  // ---------------- denim
  fill('jeans', '#e8e8e8'); clip('jeans', (x, y, w, h) => { for (let k = -h; k < w; k += 2.2) line(x + k, y + h, x + k + h, y, `rgba(0,0,0,${0.06 + rnd() * 0.06})`, 1);
    noise('jeans', 0.18, 1); const fade = (cx, cy) => { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 34); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(cx - 40, cy - 40, 80, 80); };
    fade(x + w * 0.5, y + h * 0.25); fade(x + w * 0.5, y + h * 0.56);
    for (const s of [0.25, 0.75]) { line(x + w * s, y, x + w * s, y + h, 'rgba(0,0,0,.3)', 2); line(x + w * s + 2, y, x + w * s + 2, y + h, 'rgba(255,240,200,.5)', 0.8, [2, 2]); }
    fold(x, y + h * 0.5, w, h * 0.12, 10, 'h', 0.12); fold(x, y + h * 0.88, w, h * 0.12, 12, 'h', 0.14); });
  // ---------------- cargo / EMS pants (thigh pockets)
  weave('cargo', '#e4e4e4', 0.2);
  clip('cargo', (x, y, w, h) => { seam(x + w * 0.25, y, x + w * 0.25, y + h); seam(x + w * 0.75, y, x + w * 0.75, y + h);
    for (const s of [0.25, 0.75]) { const px = x + w * s - 18, py = y + h * 0.3; g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(px, py, 36, 46); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.2; g.strokeRect(px, py, 36, 46);
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(px - 1, py - 2, 38, 12); g.strokeRect(px - 1, py - 2, 38, 12); line(px, py + 12, px + 36, py + 12, 'rgba(0,0,0,.2)', 0.8, [2, 2]); }
    fold(x, y + h * 0.5, w, h * 0.14, 10, 'h', 0.12); });

  // ---------------- faces (u = around the head with the face centred, v = crown → chin)
  // face maps use u = 0.5 + azimuth/π (eyes ≈ ±35 px from centre), v = 0.5 − elevation/π (eyes ≈ v .46, mouth ≈ .66)
  const face = (name, old) => { fill(name, '#f4f4f4'); noise(name, 0.05, 1); clip(name, (x, y, w, h) => {
    const cx = x + w * 0.5; const V = (v) => y + h * v;
    const blot = (px, py, r, col) => { const gr = g.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2); };
    for (const s of [-1, 1]) { blot(cx + s * 52, V(0.58), 26, 'rgba(255,160,150,.2)'); blot(cx + s * 34, V(0.5), 11, 'rgba(110,70,80,.12)'); }
    for (const s of [-1, 1]) { g.strokeStyle = old ? 'rgba(90,50,40,.3)' : 'rgba(90,50,40,.13)'; g.lineWidth = old ? 2.2 : 1.6; g.beginPath(); g.moveTo(cx + s * 15, V(0.58)); g.quadraticCurveTo(cx + s * 27, V(0.63), cx + s * 31, V(0.7)); g.stroke(); }
    blot(cx, V(0.8), 22, 'rgba(0,0,0,.04)');
    if (old) {
      for (let k = 0; k < 3; k++) { g.strokeStyle = 'rgba(90,50,40,.17)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(cx - 42, V(0.355 + k * 0.022)); g.quadraticCurveTo(cx, V(0.345 + k * 0.022), cx + 42, V(0.355 + k * 0.022)); g.stroke(); }
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) line(cx + s * 56, V(0.46), cx + s * (66 + k * 2), V(0.43 + k * 0.025), 'rgba(90,50,40,.24)', 0.9);
      for (const s of [-1, 1]) line(cx + s * 30, V(0.71), cx + s * 33, V(0.78), 'rgba(90,50,40,.18)', 1.2);
      line(cx - 3, V(0.42), cx - 2, V(0.445), 'rgba(90,50,40,.18)', 1); line(cx + 3, V(0.42), cx + 2, V(0.445), 'rgba(90,50,40,.18)', 1);
    }
  }); };
  face('face', false); face('faceOld', true);
  // ---------------- hair strands
  fill('hair', '#dcdcdc'); clip('hair', (x, y, w, h) => { for (let k = 0; k < 1400; k++) { const px = x + rnd() * w, py = y + rnd() * h; const l = 10 + rnd() * 40; const v = rnd(); line(px, py, px + (rnd() - 0.5) * 3, py + l, v > 0.5 ? `rgba(255,255,255,${0.06 + v * 0.14})` : `rgba(0,0,0,${0.06 + v * 0.16})`, 0.7 + rnd()); } });
  // ---------------- skin / leather / metal / white / knit
  fill('skin', '#f2f2f2'); noise('skin', 0.08, 1);
  fill('leather', '#d4d4d4'); noise('leather', 0.25, 1); clip('leather', (x, y, w, h) => { for (let k = 0; k < 160; k++) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x + rnd() * w, y + rnd() * h, 2 + rnd() * 3, 1); } for (const t of [0.14, 0.86]) line(x, y + h * t, x + w, y + h * t, 'rgba(255,255,255,.35)', 1, [3, 2]); line(x, y + 1, x + w, y + 1, 'rgba(0,0,0,.4)', 2); line(x, y + h - 1, x + w, y + h - 1, 'rgba(0,0,0,.4)', 2); });
  fill('metal', '#cfcfcf'); clip('metal', (x, y, w, h) => { for (let j = 0; j < h; j++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.25})`; g.fillRect(x, y + j, w, 1); } });
  fill('white', '#ffffff'); noise('white', 0.03, 2);
  fill('knit', '#e6e6e6'); clip('knit', (x, y, w, h) => { for (let i = 0; i < w; i += 6) { line(x + i, y, x + i, y + h, 'rgba(0,0,0,.18)', 1.5); line(x + i + 3, y, x + i + 3, y + h, 'rgba(255,255,255,.18)', 1.5); } noise('knit', 0.12, 1); });
  weave('canvasWork', '#e2e2e2', 0.3); clip('canvasWork', (x, y, w, h) => { fold(x, y, w, h, 14, 'v', 0.14); seam(x + w * 0.5, y, x + w * 0.5, y + h); });
  fill('denimJacket', '#e8e8e8'); clip('denimJacket', (x, y, w, h) => { for (let k = -h; k < w; k += 2.2) line(x + k, y + h, x + k + h, y, 'rgba(0,0,0,.08)', 1); noise('denimJacket', 0.14, 1); seam(x + w * 0.5, y, x + w * 0.5, y + h); });
  weave('hoodie', '#e9e9e9', 0.24); clip('hoodie', (x, y, w, h) => { const cx = x + w * 0.5; g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.4; g.strokeRect(cx - 22, y + h * 0.62, 44, 30); fold(x, y, w, h, 16, 'v', 0.1); line(x, y + h * 0.95, x + w, y + h * 0.95, 'rgba(0,0,0,.3)', 3); });

  // ---------------- badges (grey relief: lighter = raised; vertex colour makes them gold or silver)
  const star = (cx, cy, n, R1, r1, rot = -Math.PI / 2) => { g.beginPath(); for (let k = 0; k < n * 2; k++) { const a = rot + (k / (n * 2)) * Math.PI * 2; const rr = k % 2 ? r1 : R1; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); };
  const ringText = (cx, cy, rad, text, size, start = -Math.PI * 0.85, span = Math.PI * 0.7, col = 'rgba(40,40,40,.9)') => { g.save(); g.fillStyle = col; g.font = `bold ${size}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; const n = text.length; for (let i = 0; i < n; i++) { const a = start + (i + 0.5) / n * span; g.save(); g.translate(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); g.rotate(a + Math.PI / 2); g.fillText(text[i], 0, 0); g.restore(); } g.restore(); };
  const bevelFill = (path, hi = '#ffffff', lo = '#8a8a8a', mid = '#d0d0d0') => { const [x, y, w, h] = path; const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, hi); gr.addColorStop(0.45, mid); gr.addColorStop(1, lo); return gr; };
  { const [x, y, w, h] = box('badgePD'); fill('badgePD', '#6e6e6e'); const cx = x + w / 2, cy = y + h / 2 + 4;
    g.beginPath(); g.moveTo(cx, y + 6); g.quadraticCurveTo(cx + 30, y + 18, cx + 52, y + 14); g.lineTo(cx + 50, cy + 18); g.quadraticCurveTo(cx + 40, y + h - 12, cx, y + h - 4); g.quadraticCurveTo(cx - 40, y + h - 12, cx - 50, cy + 18); g.lineTo(cx - 52, y + 14); g.quadraticCurveTo(cx - 30, y + 18, cx, y + 6); g.closePath();
    g.fillStyle = bevelFill([x, y, w, h]); g.fill(); g.strokeStyle = '#555'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(cx, cy + 4, 26, 0, 6.283); g.fill(); g.fillStyle = '#efefef'; g.beginPath(); g.arc(cx, cy + 4, 17, 0, 6.283); g.fill();
    star(cx, cy + 4, 5, 13, 5.5); g.fillStyle = '#7a7a7a'; g.fill();
    g.fillStyle = '#e0e0e0'; g.fillRect(cx - 40, y + 26, 80, 14); g.fillStyle = '#3a3a3a'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('POLICE', cx, y + 33.5);
    g.fillStyle = '#e0e0e0'; g.fillRect(cx - 34, y + h - 36, 68, 13); g.fillStyle = '#3a3a3a'; g.font = 'bold 10px sans-serif'; g.fillText('CARMI', cx, y + h - 29.5);
    // eagle on top
    g.fillStyle = '#f2f2f2'; g.beginPath(); g.ellipse(cx, y + 9, 10, 5, 0, 0, 6.283); g.fill(); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, y + 9); g.quadraticCurveTo(cx + s * 22, y - 2, cx + s * 30, y + 10); g.quadraticCurveTo(cx + s * 16, y + 8, cx, y + 13); g.fill(); } }
  { const [x, y, w, h] = box('badgeSO'); fill('badgeSO', '#6a6a6a'); const cx = x + w / 2, cy = y + h / 2;
    star(cx, cy, 7, 60, 30); g.fillStyle = bevelFill([x, y, w, h]); g.fill(); g.strokeStyle = '#4c4c4c'; g.lineWidth = 2; g.stroke();
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + k / 7 * Math.PI * 2; g.fillStyle = '#f6f6f6'; g.beginPath(); g.arc(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58, 5, 0, 6.283); g.fill(); }
    g.fillStyle = '#8c8c8c'; g.beginPath(); g.arc(cx, cy, 28, 0, 6.283); g.fill(); g.fillStyle = '#e8e8e8'; g.beginPath(); g.arc(cx, cy, 20, 0, 6.283); g.fill();
    ringText(cx, cy, 24, 'SHERIFF', 9, -Math.PI * 0.82, Math.PI * 0.64, '#f0f0f0'); ringText(cx, cy, 24, 'WHITE CO', 8, Math.PI * 0.2, Math.PI * 0.6, '#f0f0f0');
    g.fillStyle = '#7d7d7d'; star(cx, cy, 5, 12, 5); g.fill(); }
  { const [x, y, w, h] = box('badgeFire'); fill('badgeFire', '#6a6a6a'); const cx = x + w / 2, cy = y + h / 2; // Maltese cross
    g.save(); g.translate(cx, cy); for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(-8, -8); g.lineTo(-30, -58); g.quadraticCurveTo(0, -46, 30, -58); g.lineTo(8, -8); g.closePath(); g.fillStyle = bevelFill([-60, -60, 120, 120]); g.fill(); g.strokeStyle = '#4c4c4c'; g.lineWidth = 2; g.stroke(); } g.restore();
    g.fillStyle = '#909090'; g.beginPath(); g.arc(cx, cy, 24, 0, 6.283); g.fill(); g.fillStyle = '#ececec'; g.beginPath(); g.arc(cx, cy, 17, 0, 6.283); g.fill();
    g.fillStyle = '#555'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FIRE', cx, cy - 4); g.fillText('DEPT', cx, cy + 6); }
  { const [x, y, w, h] = box('badgeEMS'); fill('badgeEMS', '#6a6a6a'); const cx = x + w / 2, cy = y + h / 2; // star of life shape
    g.save(); g.translate(cx, cy); for (let k = 0; k < 3; k++) { g.rotate(Math.PI / 3); g.fillStyle = bevelFill([-60, -60, 120, 120]); g.fillRect(-13, -54, 26, 108); } g.restore();
    g.fillStyle = '#4a4a4a'; g.fillRect(cx - 2, cy - 34, 4, 68); g.strokeStyle = '#4a4a4a'; g.lineWidth = 2.5; g.beginPath(); for (let t = 0; t < 1; t += 0.05) g.lineTo(cx + Math.sin(t * 14) * 7, cy - 28 + t * 56); g.stroke(); }
  { const [x, y, w, h] = box('badgeFlat'); fill('badgeFlat', '#bdbdbd'); noise('badgeFlat', 0.1, 1); g.strokeStyle = '#7a7a7a'; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, w - 12, h - 12); }

  // ---------------- shoulder patches (full colour)
  const patchShape = (name, bg, border, top, mid, bottom, emblem) => { const [x, y, w, h] = box(name); fill(name, border); const cx = x + w / 2;
    g.beginPath(); g.moveTo(x + 8, y + 22); g.quadraticCurveTo(cx, y - 2, x + w - 8, y + 22); g.lineTo(x + w - 10, y + h * 0.7); g.quadraticCurveTo(cx, y + h + 6, x + 10, y + h * 0.7); g.closePath(); g.fillStyle = bg; g.fill(); g.strokeStyle = border; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#f2f2f2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 15px sans-serif'; g.fillText(top, cx, y + 26); g.font = 'bold 11px sans-serif'; g.fillText(bottom, cx, y + h - 22);
    emblem(cx, y + h * 0.53); g.font = 'bold 10px sans-serif'; g.fillStyle = '#f2f2f2'; if (mid) g.fillText(mid, cx, y + h * 0.78); };
  patchShape('patchPD', '#16244a', '#c9a64a', 'CARMI', 'ILLINOIS', 'POLICE', (cx, cy) => { g.fillStyle = '#c9a64a'; star(cx, cy - 4, 5, 18, 7.5); g.fill(); g.fillStyle = '#16244a'; g.beginPath(); g.arc(cx, cy - 4, 5, 0, 6.283); g.fill(); });
  patchShape('patchSO', '#4a3a22', '#d4b45a', 'WHITE CO.', 'ILLINOIS', 'SHERIFF', (cx, cy) => { g.fillStyle = '#d4b45a'; star(cx, cy - 4, 7, 19, 9); g.fill(); g.fillStyle = '#4a3a22'; g.beginPath(); g.arc(cx, cy - 4, 6, 0, 6.283); g.fill(); });
  patchShape('patchFire', '#9a1414', '#e3c04a', 'CARMI', 'EST. 1888', 'FIRE DEPT', (cx, cy) => { g.fillStyle = '#e3c04a'; g.save(); g.translate(cx, cy - 4); for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(-3, -3); g.lineTo(-10, -18); g.lineTo(10, -18); g.lineTo(3, -3); g.fill(); } g.restore(); });
  patchShape('patchEMS', '#13305e', '#e8e8e8', 'WHITE CO.', 'PARAMEDIC', 'EMS', (cx, cy) => { g.fillStyle = '#2f6fd6'; g.save(); g.translate(cx, cy - 4); for (let k = 0; k < 3; k++) { g.rotate(Math.PI / 3); g.fillRect(-5, -19, 10, 38); } g.restore(); g.fillStyle = '#fff'; g.fillRect(cx - 1, cy - 18, 2, 28); });
  { const [x, y, w, h] = box('flag'); fill('flag', '#ffffff'); for (let k = 0; k < 13; k++) { g.fillStyle = k % 2 ? '#f4f4f4' : '#b3202c'; g.fillRect(x, y + k * h / 13, w, h / 13 + 0.5); } g.fillStyle = '#1d2a5c'; g.fillRect(x, y, w * 0.42, h * 7 / 13); g.fillStyle = '#fff'; for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) g.fillRect(x + 4 + i * 8.5, y + 3 + j * 8, 2, 2); }
  { const [x, y, w, h] = box('patch911'); fill('patch911', '#13305e'); g.strokeStyle = '#c9a64a'; g.lineWidth = 4; g.strokeRect(x + 3, y + 3, w - 6, h - 6); g.fillStyle = '#f0f0f0'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('911', x + w / 2, y + h * 0.42); g.font = 'bold 10px sans-serif'; g.fillText('WHITE CO. E-COMM', x + w / 2, y + h * 0.78); }
  { const [x, y, w, h] = box('chevrons'); fill('chevrons', '#ffffff'); g.strokeStyle = '#c9a64a'; g.lineWidth = 13; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 14, y + 52 + k * 24); g.lineTo(x + w / 2, y + 22 + k * 24); g.lineTo(x + w - 14, y + 52 + k * 24); g.stroke(); } g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 14, y + 58 + k * 24); g.lineTo(x + w / 2, y + 28 + k * 24); g.lineTo(x + w - 14, y + 58 + k * 24); g.stroke(); } }
  { const [x, y, w, h] = box('idCard'); fill('idCard', '#f7f7f7'); g.fillStyle = '#1d3f7a'; g.fillRect(x, y, w, 26); g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('WHITE CO.', x + w / 2, y + 12); g.fillText('STAFF', x + w / 2, y + 22);
    g.fillStyle = '#9fb3c9'; g.fillRect(x + 14, y + 34, 36, 42); g.fillStyle = '#6c7f95'; g.beginPath(); g.arc(x + 32, y + 50, 9, 0, 6.283); g.fill(); g.fillRect(x + 20, y + 62, 24, 14);
    g.fillStyle = '#444'; g.fillRect(x + 10, y + 86, 44, 4); g.fillRect(x + 14, y + 96, 36, 3); g.fillStyle = '#c33'; g.fillRect(x, y + h - 10, w, 10); }
  { const [x, y, w, h] = box('bodycam'); fill('bodycam', '#2a2a2a'); noise('bodycam', 0.1, 1); g.fillStyle = '#111'; g.beginPath(); g.arc(x + w / 2, y + h * 0.42, 15, 0, 6.283); g.fill(); g.strokeStyle = '#777'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = '#3b4f66'; g.beginPath(); g.arc(x + w / 2, y + h * 0.42, 8, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(x + w / 2 - 3, y + h * 0.42 - 3, 2.4, 0, 6.283); g.fill();
    g.fillStyle = '#d22'; g.beginPath(); g.arc(x + w - 9, y + 8, 3, 0, 6.283); g.fill(); g.fillStyle = '#9a9a9a'; g.fillRect(x + 12, y + h - 12, w - 24, 4); }
  { const [x, y, w, h] = box('nameplate'); fill('nameplate', '#cfcfcf'); g.fillStyle = '#3a3a3a'; for (let i = 0; i < 6; i++) g.fillRect(x + 10 + i * 8, y + 12, 6, 9); g.strokeStyle = '#8a8a8a'; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, w - 4, h - 4); }
  cache = c; return c;
}
