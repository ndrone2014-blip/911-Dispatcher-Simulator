// Generates the game logo + home-screen icons. Run: node tools/make-icons.mjs
// (needs the "sharp" package available to Node). The SVGs are the source of truth.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch { sharp = require('/opt/npm-tools/node_modules/sharp'); }

const FONT = "Inter, 'Arial Black', 'Helvetica Neue', Arial, sans-serif";

/** Inner artwork drawn on a 512 canvas. `k` scales it about the centre (for maskable safe zones). */
function art({ k = 1, sub = true } = {}) {
  return `<g transform="translate(256 ${sub ? 244 : 256}) scale(${k}) translate(-256 -256)">
    <!-- radio waves -->
    <g fill="none" stroke="#5fc3ff" stroke-linecap="round" opacity="0.9">
      <path d="M392 92 a70 70 0 0 1 34 52" stroke-width="12"/>
      <path d="M404 58 a110 110 0 0 1 56 82" stroke-width="12" opacity="0.6"/>
    </g>
    <!-- headset band -->
    <path d="M118 236 C118 120 394 120 394 236" fill="none" stroke="url(#band)" stroke-width="30" stroke-linecap="round"/>
    <!-- ear cups -->
    <rect x="84" y="208" width="66" height="104" rx="26" fill="url(#cup)" stroke="#0b1424" stroke-width="6"/>
    <rect x="362" y="208" width="66" height="104" rx="26" fill="url(#cup)" stroke="#0b1424" stroke-width="6"/>
    <rect x="98" y="226" width="16" height="68" rx="8" fill="#5fc3ff" opacity="0.85"/>
    <rect x="398" y="226" width="16" height="68" rx="8" fill="#5fc3ff" opacity="0.85"/>
    <!-- mic boom -->
    <path d="M118 306 C120 372 168 392 214 392" fill="none" stroke="#c9d6e8" stroke-width="12" stroke-linecap="round"/>
    <circle cx="222" cy="392" r="15" fill="#ff4b3e" stroke="#0b1424" stroke-width="5"/>
    <!-- 911 -->
    <text x="262" y="318" font-family="${FONT}" font-weight="900" font-size="150" letter-spacing="-6" text-anchor="middle" fill="#0b1424" opacity="0.55" transform="translate(5 7)">911</text>
    <text x="262" y="318" font-family="${FONT}" font-weight="900" font-size="150" letter-spacing="-6" text-anchor="middle" fill="url(#red)" stroke="#fff" stroke-width="5" paint-order="stroke">911</text>
    <!-- banner -->
    <rect x="96" y="408" width="320" height="56" rx="12" fill="#f3f6fb"/>
    <text x="256" y="449" font-family="${FONT}" font-weight="900" font-size="38" letter-spacing="6" text-anchor="middle" fill="#0e1c33">DISPATCH</text>
    ${sub ? `<text x="256" y="494" font-family="${FONT}" font-weight="700" font-size="21" letter-spacing="5" text-anchor="middle" fill="#8fb4dd">WHITE COUNTY · IL</text>` : ''}
  </g>`;
}

const DEFS = `<defs>
  <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#1d3a66"/><stop offset="0.6" stop-color="#11223f"/><stop offset="1" stop-color="#070d1a"/></radialGradient>
  <linearGradient id="red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a52"/><stop offset="1" stop-color="#d4231a"/></linearGradient>
  <linearGradient id="band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9fb3cc"/><stop offset="0.5" stop-color="#eef3fa"/><stop offset="1" stop-color="#9fb3cc"/></linearGradient>
  <linearGradient id="cup" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4d68"/><stop offset="1" stop-color="#1a2638"/></linearGradient>
</defs>`;

const svg = ({ rounded = true, k = 1, sub = true } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${DEFS}
  <rect width="512" height="512" ${rounded ? 'rx="104"' : ''} fill="url(#bg)"/>
  <rect x="10" y="10" width="492" height="492" ${rounded ? 'rx="96"' : ''} fill="none" stroke="#ff4b3e" stroke-width="4" opacity="${rounded ? 0.5 : 0}"/>
  ${art({ k, sub })}
</svg>`;

const out = (p) => new URL(`../${p}`, import.meta.url);
const logo = svg();
writeFileSync(out('icon.svg'), logo);
writeFileSync(out('icons/logo.svg'), logo);
const square = svg({ rounded: false, k: 0.98 }); // iOS rounds corners itself
const mask = svg({ rounded: false, k: 0.74, sub: false }); // Android maskable safe zone
writeFileSync(out('icons/maskable.svg'), mask);

const jobs = [
  [logo, 'icons/icon-192.png', 192], [logo, 'icons/icon-512.png', 512],
  [square, 'icons/apple-touch-icon.png', 180], [mask, 'icons/maskable-512.png', 512], [mask, 'icons/maskable-192.png', 192],
  [svg({ sub: false }), 'icons/favicon-32.png', 32], [svg({ sub: false }), 'icons/favicon-64.png', 64],
];
for (const [s, file, size] of jobs) {
  await sharp(Buffer.from(s), { density: 72 * (size / 512) * 4 }).resize(size, size).png().toFile(out(file).pathname);
  console.log('wrote', file);
}
