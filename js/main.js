// Entry point.
import { Game } from './game.js';

const game = new Game();
window.__game = game; // handy for debugging in the browser console
game.boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.innerHTML = `<div class="logo">911 Dispatch Simulator</div><div style="color:#ff8a80;max-width:520px;text-align:center;padding:0 20px">Something went wrong while starting the game:<br><code>${String(e.message || e).replace(/</g, '&lt;')}</code><br><br>Try a current version of Chrome, Edge, Firefox or Safari.</div>`;
});
