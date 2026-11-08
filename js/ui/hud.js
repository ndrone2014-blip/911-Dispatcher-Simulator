// Walking-mode HUD and mobile controls.
import { esc, isTouchDevice } from '../core/util.js';
import { bindActions } from './dom.js';
import { clock } from './fmt.js';
import { WEATHER_TYPES } from '../sim/weather.js';

export class HUD {
  constructor(game) {
    this.game = game; this.root = document.getElementById('hud'); this.mobile = document.getElementById('mobile-controls');
    this.touch = isTouchDevice(); this.fpsAcc = 0; this.fpsFrames = 0; this.fps = 0;
  }

  build() {
    this.root.innerHTML = `<div id="crosshair"></div><div id="interact-prompt" hidden></div>
      <div id="topbar"></div><div id="break-banner" hidden>☕ On break – new calls are covered by coworkers. Talk to Karen or sit at your desk to return.</div>
      <div id="hint-box"></div>
      <div id="click-to-play" hidden><b>Click to look around</b><div class="dim" style="font-size:.85em;margin-top:4px">WASD to move · E to interact · Tab for your console · Esc to pause</div></div>
      <div id="fps" hidden></div><div id="captions" aria-live="polite"></div>`;
    this.$ = (id) => this.root.querySelector(`#${id}`);
    bindActions(this.root, { cad: () => this.game.goToDesk(), pause: () => this.game.togglePauseMenu(), answer: () => { this.game.goToDesk(); setTimeout(() => this.game.cad.answerNext(), 600); } });
    this.$('click-to-play').addEventListener('click', () => this.game.lockPointer());
    if (this.touch) {
      this.mobile.innerHTML = `<div id="look-zone"></div><div id="joy"><i></i></div>
        <div class="m-btns"><button class="m-btn" data-act="pause">☰</button><button class="m-btn" data-act="use">USE</button><button class="m-btn big" data-act="desk">DESK</button></div>`;
      bindActions(this.mobile, { use: () => this.game.interact(), desk: () => this.game.goToDesk(), pause: () => this.game.togglePauseMenu() });
      this.game.world?.player.setupTouch(this.mobile.querySelector('#joy'), this.mobile.querySelector('#look-zone'));
    }
    this.setVisible(false);
  }

  /** Subtitle line for something said nearby (roll call, overheard coworkers). */
  caption(who, text, dur = 4.5) {
    const box = this.$?.('captions'); if (!box || this.game.settings.data.ui.captions === false) return;
    const el = document.createElement('div'); el.className = 'cap'; el.innerHTML = `<b>${esc(who)}:</b> ${esc(text)}`;
    box.appendChild(el); while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, Math.max(2000, dur * 1000));
  }

  setVisible(v) {
    this.visible = v; this.root.hidden = !v; this.mobile.hidden = !v || !this.touch;
  }

  update(dt) {
    if (!this.visible) return;
    const g = this.game; const sim = g.sim; const w = g.world;
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsFrames / this.fpsAcc); this.fpsAcc = 0; this.fpsFrames = 0; this.refreshSlow(); }
    const t = w?.target;
    const p = this.$('interact-prompt');
    if (t && !g.cad.open) { p.hidden = false; p.innerHTML = `${this.touch ? '<b>USE</b>' : '<span class="kbd">E</span>'} ${esc(t.label)}`; }
    else p.hidden = true;
    this.$('crosshair').hidden = g.cad.open || this.touch && !t;
  }

  refreshSlow() {
    const g = this.game; const sim = g.sim; if (!sim) return;
    const ringing = sim.calls.ringing().length;
    const open = sim.incidents.open().filter((i) => i.status !== 'completed').length;
    const wx = WEATHER_TYPES[sim.weather.current()];
    this.$('topbar').innerHTML = `<span class="tb-item mono">🕒 ${clock(sim.clock(), g)}</span><span class="tb-item">${wx.icon} ${wx.label}</span>
      ${ringing ? `<span class="tb-item ring" data-act="answer" style="cursor:pointer">📞 ${ringing} ringing – answer</span>` : '<span class="tb-item">📞 0</span>'}
      <span class="tb-item">🚨 ${open}</span><button class="btn sm" data-act="cad">🖥 Console${this.touch ? '' : ' (Tab)'}</button><button class="btn sm" data-act="pause">⏸</button>`;
    this.$('break-banner').hidden = !sim.onBreak;
    const fps = this.$('fps'); fps.hidden = !g.settings.data.graphics.fpsCounter; if (!fps.hidden) { const st = g.world?.status?.() || {}; fps.textContent = `${this.fps} FPS · ${st.draws || 0} draws · ${st.preset || ''}${st.scale < 1 ? ` ${Math.round(st.scale * 100)}%` : ''}`; }
    const hint = this.$('hint-box');
    hint.hidden = !g.settings.data.ui.showHints || this.touch;
    hint.innerHTML = `<b>Walking</b><br><span class="kbd">W A S D</span> move · <span class="kbd">Shift</span> walk faster<br><span class="kbd">E</span> interact · <span class="kbd">Tab</span> go to your console<br><span class="kbd">Esc</span> pause menu`;
    const ctp = this.$('click-to-play');
    ctp.hidden = this.touch || g.cad.open || document.pointerLockElement === g.world?.canvas || g.anyOverlay() || !!g.world?.player.transition || g.world?.failed;
  }
}
