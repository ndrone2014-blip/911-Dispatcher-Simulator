// Guided training mode.
import { el, bindActions, toast } from './dom.js';
import { esc } from '../core/util.js';

export class Tutorial {
  constructor(game) {
    this.game = game; this.i = 0; this.box = null; this.timer = null; this.flags = {};
    const g = game;
    const call = () => g.sim.calls.byId(this.flags.callId);
    const inc = () => (call()?.incidentId ? g.sim.incidents.byId(call().incidentId) : null);
    this.steps = [
      { title: 'Welcome to Regional 911', text: 'This is your dispatch center. Your workstation is the desk with the glowing blue monitors right in front of you. Walk to it and press <b>E</b> (or tap <b>Desk</b> on mobile). You can also press <b>Tab</b> to go straight there.', check: () => g.cad.open },
      { title: 'A call is coming in', text: 'This is the CAD – your dispatch computer. A training call is ringing on Line 1. Click <b>Answer</b> (or press <b>A</b>).', enter: () => { const c = g.sim.calls.spawnCall({ templateId: 'training_basic' }); this.flags.callId = c.id; g.cad.showScreen('calls'); }, highlight: '[data-screen="calls"] [data-act="answer"]', check: () => call()?.status === 'active' },
      { title: 'Find out where', text: 'The most important question is always <b>where</b>. Ask the caller for the address – type it, use the 🎤 microphone, or click the suggested question <i>"What is the address of your emergency?"</i>', highlight: '[data-screen="calls"] .suggest', check: () => call()?.convo.revealed.location },
      { title: 'Confirm the address', text: 'Read the address back to make sure you heard it right – click <b>✔ Read back address</b> or type it back. Verified addresses mean units go to the right place.', highlight: '[data-screen="calls"] .chip.verify', check: () => call()?.verified, skippable: true },
      { title: 'Ask about injuries', text: 'Now ask <b>"Is anyone hurt?"</b> Notice how the answers fill the Call Information panel on the right automatically.', check: () => call()?.convo.asked.injuries, skippable: true },
      { title: 'Create the incident', text: 'The caller reported a crash with an injury. The incident type is pre-selected from what they said, but you can change it. Press <b>➕ Create incident</b> (or Ctrl+Enter).', highlight: '[data-screen="calls"] [data-act="create"]', check: () => !!call()?.incidentId },
      { title: 'Send help', text: 'Click <b>Assign units</b>. Starred units are recommended – a patrol car, an engine and an ambulance. Recommendations are just suggestions: you can send <i>any</i> unit. Select a few and press <b>Assign selected</b>.', highlight: '[data-act="assign"]', check: () => (inc()?.units.length || 0) >= 2 || (inc()?.unitHistory.length || 0) >= 2 },
      { title: 'Reassure the caller', text: 'Tell the caller <b>"Help is on the way."</b> Reassurance and instructions calm callers down – watch the mood meter at the top of the call.', check: () => call()?.convo.instructions.includes('reassure'), skippable: true },
      { title: 'Listen to the radio', text: 'Open the <b>📻 Radio</b> screen. Units acknowledge the assignment, report en route, and give a size-up when they arrive. Wait for the first unit to arrive on scene.', check: () => !!inc()?.sim.firstArrival, enter: () => {} },
      { title: 'Talk to a unit', text: 'Pick a unit in the transmit box and press <b>Status?</b>, or type a question like <i>"do you need anything?"</i>. Units answer based on what\'s really happening.', highlight: '[data-screen="radio"] .tx-box', check: () => g.sim.radio.log.some((m) => m.kind === 'player'), skippable: true },
      { title: 'Let them work', text: 'Units work the scene. The progress bar on the incident fills as they do – the right units work faster. Use the <b>2×</b> / <b>4×</b> buttons on the top bar to speed up time if you like.', check: () => ['completed', 'closed'].includes(inc()?.status) },
      { title: 'Close it out', text: 'The incident is resolved. Open it in <b>🚨 Incidents</b> and press <b>Close incident</b> to file it. You\'ll see a short evaluation – there are never penalties, only bonuses.', check: () => inc()?.status === 'closed', enter: () => { const i = inc(); if (i) g.cad.selectIncident(i.id); } },
      { title: 'Juggling calls', text: 'Real shifts overlap. Two calls are ringing now. Answer one – answering another puts the first <b>on hold</b> automatically. Create an incident for each (or end the call if none is needed).', enter: () => { const a = g.sim.calls.spawnCall({ templateId: 'noise_party' }); const b = g.sim.calls.spawnCall({ templateId: 'parking_driveway' }); this.flags.multi = [a.id, b.id]; g.cad.showScreen('calls'); }, check: () => (this.flags.multi || []).length === 2 && this.flags.multi.every((id) => { const c = g.sim.calls.byId(id); return c && (c.incidentId || c.status === 'ended'); }), skippable: true },
      { title: 'You\'re ready!', text: 'That\'s the job: answer, ask, verify, create, assign, monitor, close. Explore the <b>Map</b>, <b>Units</b> and <b>Supervisor</b> screens, walk around and talk to your coworkers, and take breaks whenever you want. Have fun!', final: true },
    ];
  }

  start() { this.i = 0; this.show(); this.timer = setInterval(() => this.poll(), 500); }
  stop() { clearInterval(this.timer); this.box?.remove(); this.clearHighlight(); this.game.tutorial = null; }
  event() { this.poll(); }

  poll() {
    const s = this.steps[this.i]; if (!s || s.final) return;
    try { if (s.check && s.check()) this.next(); } catch (e) { console.warn(e); }
    this.applyHighlight();
  }

  next() {
    this.i++;
    if (this.i >= this.steps.length) { this.finish(); return; }
    this.game.audio?.notify('info'); this.show();
  }

  show() {
    const s = this.steps[this.i];
    this.box?.remove();
    this.box = el(`<div id="tutorial" class="${this.minimized ? 'min' : ''}"><button class="btn ghost sm t-min" data-act="min" title="Minimize">${this.minimized ? '▢' : '–'}</button><div class="t-step">Training · Step ${this.i + 1} of ${this.steps.length}</div><h4>${esc(s.title)}</h4><p>${s.text}</p>
      <div class="row t-actions" style="margin-top:10px;justify-content:flex-end">${s.final ? '<button class="btn" data-act="exit">Back to menu</button><button class="btn primary" data-act="freeplay">Keep playing</button>' : `${s.skippable ? '<button class="btn sm ghost" data-act="skip">Skip step</button>' : ''}<button class="btn sm ghost" data-act="exit">Exit training</button>`}</div></div>`);
    document.body.appendChild(this.box);
    bindActions(this.box, { min: () => { this.minimized = !this.minimized; this.box.classList.toggle('min', this.minimized); this.box.querySelector('.t-min').textContent = this.minimized ? '▢' : '–'; }, skip: () => this.next(), exit: () => { this.finish(true); this.game.quitToMenu(); }, freeplay: () => this.finish() });
    try { s.enter?.(); } catch (e) { console.warn(e); }
    this.applyHighlight();
  }

  applyHighlight() {
    this.clearHighlight();
    const s = this.steps[this.i]; if (!s?.highlight) return;
    const t = document.querySelector(s.highlight); if (t && t.offsetParent) { t.classList.add('tut-highlight'); this.hl = t; }
  }
  clearHighlight() { this.hl?.classList.remove('tut-highlight'); this.hl = null; document.querySelectorAll('.tut-highlight').forEach((x) => x.classList.remove('tut-highlight')); }

  finish(quiet = false) {
    this.game.save.profile.tutorialDone = true; this.game.save.save();
    if (!quiet) { toast('Training complete! New calls will now come in at a relaxed pace.', { level: 'good', title: 'Training' }); this.game.sim.setConfig({ callFrequency: 'relaxed' }); this.game.sim.state.mode = 'free'; }
    this.stop();
  }
}
