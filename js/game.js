// Game controller: owns every system and the main loop.
import { bus } from './core/events.js';
import { Settings } from './core/settings.js';
import { SaveSystem } from './core/save.js';
import { rng, deepClone, isTouchDevice } from './core/util.js';
import { Sim } from './sim/sim.js';
import { Career, RANKS } from './sim/career.js';
import { Speech } from './ai/speech.js';
import { LocalLLM } from './ai/llm.js';
import { StaffDialogue, STAFF } from './ai/staffDialogue.js';
import { AudioSystem } from './audio/audio.js';
import { World } from './world/world.js';
import { PD_ROOMS } from './world/policeDept.js';
import { CAD } from './ui/cad/cad.js';
import { CallsScreen } from './ui/cad/callsScreen.js';
import { IncidentsScreen } from './ui/cad/incidentsScreen.js';
import { MapScreen } from './ui/cad/mapScreen.js';
import { UnitsScreen, DepartmentsScreen } from './ui/cad/unitsScreen.js';
import { RadioScreen } from './ui/cad/radioScreen.js';
import { BoardScreen, HistoryScreen, ReportsScreen, SupervisorScreen, SettingsScreen } from './ui/cad/otherScreens.js';
import { assignReportText } from './ui/cad/assignModal.js';
import { Menu } from './ui/menu.js';
import { HUD } from './ui/hud.js';
import { Tutorial } from './ui/tutorial.js';
import { openSettings } from './ui/settingsModal.js';
import { openStaffChat } from './ui/staffChat.js';
import { reportHTML } from './ui/report.js';
import { modal, toast, anyModalOpen, closeTopModal, setToastFilter, confirmBox } from './ui/dom.js';
import { WEATHER_TYPES } from './sim/weather.js';
import { DepartmentSchedule, LEADERS } from './sim/department.js';
import { openBriefing, openSchedule, LiveBriefing } from './ui/rollCall.js';
import { openArmory, openRange } from './ui/range.js';

const PA_LINES = [
  'Attention White County staff: shift briefing in the training room in fifteen minutes.',
  'Reminder: the quarterly radio system test is tomorrow at oh-nine-hundred.',
  'Attention: there is fresh coffee in the break room. Thank you, Priya.',
  'Staff reminder: please verify every address with your callers.',
  'Attention all personnel: the parking lot will be resurfaced this weekend.',
  'Reminder: CPR recertification sign-ups are on the shift board.',
];

export class Game {
  constructor() {
    this.save = new SaveSystem();
    this.settings = new Settings(this.save.profile.settings);
    this.career = new Career(this.save.profile);
    this.speech = new Speech(this.settings);
    this.audio = new AudioSystem(this.settings);
    this.llm = new LocalLLM(this.settings);
    this.staffDialogue = new StaffDialogue(this);
    this.sim = null; this.state = 'boot'; this.tutorial = null; this.pauseModal = null; this.last = performance.now();
    this.touch = isTouchDevice();
  }

  progress(p, text) { const bar = document.querySelector('#loading .bar i'); if (bar) bar.style.width = `${Math.round(p * 100)}%`; const t = document.querySelector('#loading .ltext'); if (t && text) t.textContent = text; }

  async boot() {
    this.progress(0.1, 'Loading settings…');
    document.documentElement.style.setProperty('--text-scale', this.settings.data.ui.textScale);
    bus.on('settings:changed', ({ path }) => {
      if (path === 'ui.textScale') document.documentElement.style.setProperty('--text-scale', this.settings.data.ui.textScale);
      this.save.snapshotSettings(this.settings); this.saveSoon();
    });
    setToastFilter((kind, level) => this.settings.data.ui.toasts && (kind !== 'call' || this.settings.data.ui.toastCalls) && (kind !== 'radio' || this.settings.data.ui.toastRadio) && (kind !== 'incident' || this.settings.data.ui.toastIncidents));
    await tick(); this.progress(0.25, 'Building the dispatch center…');
    this.world = new World(document.getElementById('world'), this);
    const ok3d = this.world.init();
    if (!ok3d) toast('3D graphics are unavailable on this device – the game runs in console-only mode. Everything still works!', { level: 'warn', duration: 9000 });
    await tick(); this.progress(0.6, 'Starting CAD…');
    this.cad = new CAD(this);
    for (const S of [CallsScreen, IncidentsScreen, MapScreen, UnitsScreen, DepartmentsScreen, RadioScreen, BoardScreen, HistoryScreen, ReportsScreen, SupervisorScreen, SettingsScreen]) this.cad.register(new S(this.cad));
    this.cad.build(); this.cad.hide();
    this.hud = new HUD(this); this.hud.build();
    this.menu = new Menu(this);
    this.bindInput(); this.bindBus();
    this.speech.checkMicrophone();
    await tick(); this.progress(1, 'Ready');
    // a gentle demo sim behind the menu so the center looks alive
    this.demoSim();
    setTimeout(() => { const l = document.getElementById('loading'); l.style.opacity = '0'; setTimeout(() => l.remove(), 500); }, 250);
    this.state = 'menu'; this.menu.show('main');
    setInterval(() => this.autosave(), 45000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autosave(); });
    window.addEventListener('beforeunload', () => this.autosave());
    requestAnimationFrame((t) => this.loop(t));
  }

  demoSim() {
    this.menuSim = new Sim({ seed: 42, callFrequency: 'off', backgroundActivity: 'normal', dynamicWeather: false, cityEvents: false });
    this.sim = this.menuSim; this.world.build?.();
    if (!this.world.failed) { this.world.player.pos = [9.8, 1.7, 6.4]; this.world.player.yaw = 0.75; this.world.player.pitch = -0.12; }
  }

  // ---------------- Modes ----------------
  startShift(mode, config) {
    this.speech.stopAll();
    const cfg = { ...deepClone(config), mode };
    this.sim = new Sim(cfg);
    this.attachSim();
    this.save.clearShift();
    this.enterWorld();
    const wx = WEATHER_TYPES[this.sim.weather.current()];
    toast(`${mode === 'career' ? `Career shift – ${this.career.rank().name}` : mode === 'custom' ? 'Custom shift started' : 'Free play'} · ${wx.icon} ${wx.label}. Walk to your console or press Tab.`, { level: 'good', title: 'Clocked in', duration: 7000 });
    this.save.saveShift(this.sim);
  }

  continueShift() {
    const saved = this.save.loadShift(); if (!saved) { toast('No saved shift found.', { level: 'warn' }); return; }
    try { this.sim = new Sim({}, saved.data); } catch (e) { console.error(e); toast('That saved shift could not be loaded.', { level: 'warn' }); return; }
    this.attachSim(); this.enterWorld();
    toast('Shift resumed. Welcome back.', { level: 'good' });
  }

  startTraining() {
    this.speech.stopAll();
    this.sim = new Sim({ mode: 'training', callFrequency: 'off', backgroundActivity: 'off', dynamicWeather: false, cityEvents: false, weather: 'clear', startTime: 'morning', relaxed: true, autoClearUnits: true });
    this.sim.state.mode = 'training';
    this.attachSim(); this.enterWorld();
    this.tutorial = new Tutorial(this); this.tutorial.start();
  }

  attachSim() {
    (this.department ||= new DepartmentSchedule(this)).reset();
    this.sim.career = this.career; this.sim.llm = this.llm; this.sim.audio = this.audio;
    this.cad.screens.calls.callId = null; this.cad.screens.calls.forms = {}; this.cad.screens.incidents.detailId = null; this.cad.selectedIncident = null;
    this.cad.screens.radio.feedKey = null; this.cad.screens.calls.renderedCall = null;
    this.world.build();
    this.audio.setWeather(this.sim.weather.current());
    this.nextPA = 180 + Math.random() * 240;
  }

  enterWorld() {
    this.menu.hide(); this.state = 'playing';
    this.audio.init(); this.audio.startAmbience();
    if (!this.world.failed) { this.world.teleportNearDesk(); this.world.player.seated = false; this.world.player.enabled = true; this.hud.setVisible(true); if (!this.touch) this.lockPointer(); }
    else this.openCAD();
  }

  quitToMenu() {
    if (this.sim && this.sim !== this.menuSim && this.sim.state.mode !== 'training') this.save.saveShift(this.sim);
    this.tutorial?.stop(); this.tutorial = null;
    while (closeTopModal());
    this.closeCAD(true); this.speech.stopAll(); this.audio.stopRing();
    this.hud.setVisible(false); this.world.player.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.demoSim(); this.state = 'menu'; this.menu.show('main');
  }

  endShift(auto = false) {
    const sim = this.sim; if (!sim || sim === this.menuSim) return;
    const report = sim.report();
    let careerRes = null;
    if (sim.state.mode === 'career') careerRes = this.career.finishShift(report);
    if (sim.state.mode !== 'training') this.save.recordShift(report);
    this.save.clearShift();
    const promo = careerRes?.promoted ? `<div class="rec-box" style="margin:0 0 12px"><b>🎖 Promoted to ${careerRes.rank.name}!</b>${careerRes.unlocks.length ? `<div class="dim" style="margin-top:4px">Unlocked: ${careerRes.unlocks.map((u) => u.name).join(', ')}</div>` : ''}</div>` : '';
    const xpLine = careerRes ? `<div class="good" style="margin-bottom:10px">+${careerRes.xp} career XP banked${report.completedShift ? ' (includes +100 shift completion bonus)' : ''}.</div>` : '';
    const m = modal({ title: `${auto ? 'Shift complete' : 'Shift report'} – ${new Date().toLocaleDateString()}`, wide: true, closable: false,
      body: `${promo}${xpLine}${reportHTML(report)}`,
      foot: [{ label: 'Keep dispatching', act: 'stay' }, { label: 'Back to main menu', act: 'menu', cls: 'primary' }],
      onAction: (a) => {
        m.close();
        if (a === 'menu') { this.sim = null; this.quitToMenu(); }
        else { sim.config.shiftLength = 0; sim.state.mode = sim.state.mode === 'career' ? 'free' : sim.state.mode; toast('Overtime! Keep going as long as you like.', { level: 'info' }); }
      } });
  }

  // ---------------- Seat / CAD ----------------
  goToDesk() {
    if (this.state !== 'playing') return;
    if (this.pauseModal) this.togglePauseMenu();
    if (this.world.failed) { this.openCAD(); return; }
    if (this.world.player.seated && !this.world.player.freeSeat) { this.openCAD(); return; }
    if (this.world.player.freeSeat) { this.world.player.seated = false; this.world.player.freeSeat = null; this.world.player.transition = null; }
    this.world.teleportNearDesk(); this.openCAD();
  }

  openCAD() {
    if (this.state !== 'playing') return;
    if (!this.world.failed) this.world.player.sitAt(this.world.seatPose());
    if (document.pointerLockElement) { this.intentionalUnlock = true; document.exitPointerLock(); }
    this.hud.setVisible(false);
    setTimeout(() => { this.cad.show(); this.audio.setRingLevel(1); }, this.world.failed ? 0 : 380);
    if (this.sim.onBreak) this.setBreak(false);
  }

  closeCAD(silent = false) {
    if (!this.cad.open) return;
    if (this.world.failed && !silent) { this.togglePauseMenu(); return; }
    this.cad.hide(); this.speech.stopListening();
    if (!this.world.failed) this.world.player.standUp();
    if (this.state === 'playing' && !silent) { this.hud.setVisible(true); if (!this.touch) setTimeout(() => this.lockPointer(), 50); }
  }

  lockPointer() {
    const c = this.world?.canvas; if (!c || this.touch || this.state !== 'playing' || this.cad.open || this.anyOverlay()) return;
    try { const p = c.requestPointerLock(); if (p?.catch) p.catch(() => {}); } catch { /* ignore */ }
  }

  anyOverlay() { return anyModalOpen() || !!this.pauseModal; }

  interact() {
    const t = this.world?.target; if (!t || this.state !== 'playing') return;
    const sim = this.sim;
    switch (t.kind) {
      case 'workstation': this.openCAD(); break;
      case 'supervisor_desk':
        if (this.career.has('supervisor_office', sim.state.mode)) { this.openCAD(); setTimeout(() => this.cad.showScreen('supervisor'), 450); }
        else toast('The supervisor console unlocks at the Dispatch Supervisor rank.', { level: 'info' });
        break;
      case 'npc': { const npc = STAFF.find((s) => s.id === t.npc); if (npc) { this.releasePointer(); openStaffChat(this, npc); } else if (t.civilian) toast(rng.pick(['"Hi – I\'m just waiting to talk to the front desk about a report."', '"Oh, sorry, I\'m here to pick up a copy of an accident report."', '"Is this where I file a report for a stolen bike?"']), { level: 'info' }); break; }
      case 'coffee': this.audio.coffee(); toast(this.career.has('espresso', sim.state.mode) ? 'A double espresso. The good stuff.' : rng.pick(['You pour a cup of coffee. It\'s… fine.', 'Coffee acquired. Burnt, but hot.', 'You top off your mug.']), { level: 'good' }); break;
      case 'fridge': this.audio.door(); toast(rng.pick(['Someone labeled every yogurt "TYLER – DO NOT EAT".', 'There\'s a birthday cake with three slices left.', 'Leftover pizza from the night shift. Tempting.']), { level: 'info' }); break;
      case 'vending': this.releasePointer(); this.openVending(t); break;
      case 'water': toast('Stay hydrated.', { level: 'info' }); break;
      case 'seat': this.sitDown(t); break;
      case 'stand': this.standFromSeat(); break;
      case 'door': { const open = this.world.doors?.toggle(t.door); toast(open ? 'You open the stall door.' : 'You close and latch the stall door.', { level: 'info', duration: 1600 }); break; }
      case 'fridge': this.useFridge(t); break;
      case 'microwave': this.audio.notify?.('request'); toast(rng.pick(['Two minutes on high. Everyone in the break room now smells your popcorn.', 'You warm up some leftover chili. Someone yells "who\'s microwaving fish?" It isn\'t you.', 'The microwave beeps three times. Lunch is served.']), { level: 'info' }); break;
      case 'frontdesk': { const n = this.world.npc('danny'); if (n && n.sitting && !n.away) { this.releasePointer(); openStaffChat(this, STAFF.find((x) => x.id === 'danny')); } else toast('The front desk window is unattended right now – the desk officer must be on a break. A sign says: "Ring for service."', { level: 'info', duration: 5000 }); break; }
      case 'report_kiosk': this.releasePointer(); this.openReportKiosk(); break;
      case 'records': toast('Records: rows of case files, warrant binders and a sign that says "ALL RECORDS REQUESTS IN WRITING – BRENDA".', { level: 'info', duration: 5000 }); break;
      case 'interview': toast('Observation room: two camera feeds of the interview rooms, the recorder is armed. Both rooms are empty right now.', { level: 'info', duration: 5000 }); break;
      case 'investigation': toast(rng.pick(['Case board: a map of Carmi with red pins for the catalytic converter thefts, photos of a dark pickup, and a timeline in three colors of marker.', 'Case board: bank statements, a flow chart of shell accounts and a note in big letters: "FOLLOW THE MONEY".', 'Case board: a stolen flatbed trailer, three possible routes south on IL-1 and a list of farm-supply stores to canvass.']), { level: 'info', duration: 7000 }); break;
      case 'training': toast('Today\'s in-service: de-escalation – time, distance, cover, and listening first. CPR/AED recertification at 1400.', { level: 'info', duration: 6000 }); break;
      case 'pd_desk': toast(`${t.who}'s desk: ${rng.pick(['a stack of reports to sign, a coffee mug and a framed photo from academy graduation.', 'budget printouts, a city map with patrol beats and a sticky note that says "CALL THE COUNCIL BACK".', 'a neat inbox, a challenge-coin collection and a radio scanner turned low.'])}`, { level: 'info', duration: 6000 }); break;
      case 'pd_lockers': toast('Officer lockers – names on every door, duty bags on the bench, and somebody\'s spare boots by the door.', { level: 'info' }); break;
      case 'tv': toast(`Channel 8: ${this.world.painter.headline(sim)}`, { level: 'info', duration: 6000 }); break;
      case 'radio_room': toast('Radio racks: P25 trunked system, 9 talkgroups, all repeaters online. Backup generator tested Tuesday.', { level: 'info', duration: 6000 }); break;
      case 'director_desk': toast(`Helen's desk: budget reports, a framed photo of the 2019 dispatch team, and your file – "${this.career.rank().name}".`, { level: 'info', duration: 6000 }); break;
      case 'shiftboard': this.releasePointer(); openSchedule(this); break;
      case 'console': toast(t.label, { level: 'info' }); break;
      case 'restroom': this.audio.door?.(); toast(rng.pick(['You wash up and splash some water on your face. Back to the console.', 'Quick restroom break. The hand dryer is louder than a siren.', 'You check yourself in the mirror – headset hair, as usual.']), { level: 'info' }); break;
      case 'armory': this.releasePointer(); openArmory(this); break;
      case 'range': this.releasePointer(); openRange(this); break;
      case 'briefing': this.releasePointer(); if (sim?.state.lastBriefing) openBriefing(this, sim.state.lastBriefing, { live: false }); else openSchedule(this); break;
      case 'sheriff_desk': toast("The Sheriff's desk: a county map with patrol districts, a stack of warrants to serve, and a coffee mug that says WORLD'S OKAYEST SHERIFF.", { level: 'info', duration: 7000 }); break;
      case 'evidence': toast('Evidence room: every bag sealed, labeled and logged. Chain of custody is everything.', { level: 'info', duration: 6000 }); break;
      case 'directory': toast(t.floor ? 'Floor 2: the CAPTAIN, Assistant Chief and Chief are off the Command Hall (spine corridor, then right). Conference room and Administration are along corridor M2; Training, Major Case and Payroll are up the spine; the Detectives are across corridor M2.' : 'Floor 1: Lobby, Front Desk and Records are on the main corridor. Roll Call, Watch Command, the Sergeants, locker rooms, Report Writing and Evidence are up the spine corridor. Interview and Investigation rooms open off the main corridor; the Gun Room and Break Room are on corridor S. Command staff (Chief, Captain) are upstairs.', { level: 'info', title: '🧭 Building directory', duration: 9000 }); break;
      case 'lockers': toast('Deputy lockers – names on every door, duty bags on the bench. Day shift is gearing up.', { level: 'info' }); break;
      case 'squad': toast('County Sheriff patrol SUV – lights checked, radio checked, rifle locked in the rack. Ready for patrol.', { level: 'info', duration: 6000 }); break;
      default: break;
    }
  }

  releasePointer() { if (document.pointerLockElement) { this.intentionalUnlock = true; document.exitPointerLock(); } }

  // ---------------- furniture & fixtures ----------------
  sitDown(t) {
    const w = this.world; const seat = w.seats?.[t.seat]; if (!seat) return;
    if (seat.consoleIndex != null && w.npcs.npcs.some((n) => n.consoleIndex === seat.consoleIndex && n.sitting)) { toast('Someone is working at that console.', { level: 'info' }); return; }
    w.player.sitInSeat(seat, w.allColliders());
    if (!this.seatHinted) { this.seatHinted = true; toast(`${seat.toilet ? 'Taking a seat.' : 'You sit down.'} Look around freely – press ${this.touch ? 'USE' : 'E'} or start walking to get up.`, { level: 'info', duration: 4500 }); }
  }

  standFromSeat() { const p = this.world.player; if (p.seated && p.freeSeat) p.standUp(); }

  useFridge(t) {
    const d = this.world.doors?.byId[t.id];
    if (!d) { this.audio.door(); toast(rng.pick(['Someone labeled every yogurt "TYLER – DO NOT EAT".', 'There\'s a birthday cake with three slices left.', 'Leftover pizza from the night shift. Tempting.']), { level: 'info' }); return; }
    if (d.target < 0.5) { this.world.doors.set(t.id, true); this.audio.door(); toast(rng.pick(['Inside: lunch bags with names on them, a pie with one slice left, sodas and a suspicious tupperware from last week.', 'Inside: energy drinks (Tyler\'s), a veggie tray, coffee creamer and somebody\'s birthday cake.', 'Inside: bottled water, a gallon of milk, leftover pizza and a sticky note: "LABEL YOUR FOOD – MGMT".']), { level: 'info', duration: 5500 }); }
    else { this.world.doors.set(t.id, false); this.audio.door(); toast(rng.pick(['You grab a cold soda and close the fridge.', 'You take your lunch and shut the door.', 'You grab a bottle of water.']), { level: 'good' }); }
  }

  openVending(t) {
    const items = t.label?.includes('drink') ? [['🥤', 'Cola', 1.75], ['💧', 'Bottled water', 1.5], ['🧃', 'Iced tea', 1.75], ['⚡', 'Energy drink', 2.5], ['☕', 'Cold brew', 2.75]] : [['🥨', 'Pretzels', 1.25], ['🍫', 'Chocolate bar', 1.5], ['🍪', 'Cookies', 1.5], ['🥜', 'Trail mix', 1.75], ['🌾', 'Granola bar', 1.25], ['🍿', 'Popcorn', 1.5]];
    const body = `<div class="dim" style="margin-bottom:8px">Pick something (exact change appreciated).</div><div class="grid2" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${items.map(([e, n, p], i) => `<button class="btn" data-act="buy${i}">${e} ${n} <span class="dim">$${p.toFixed(2)}</span></button>`).join('')}</div>`;
    const m = modal({ title: t.label?.includes('drink') ? '🥤 Drink machine' : '🍫 Snack machine', body, foot: [{ act: 'close', label: 'Never mind' }],
      onAction: (a) => {
        if (a.startsWith('buy')) { const [e, n] = items[+a.slice(3)]; this.audio.vend(); m.close(); toast(Math.random() < 0.08 ? `The ${n.toLowerCase()} gets stuck. You give the machine a gentle nudge… it drops. Victory.` : `${e} ${n} – thunk. Enjoy.`, { level: 'good' }); }
        else m.close();
      } });
  }

  openReportKiosk() {
    const types = ['Theft from a vehicle', 'Lost or found property', 'Vandalism / criminal damage', 'Stolen bicycle', 'Fraud or scam', 'Traffic complaint (non-emergency)'];
    const body = `<div class="dim" style="margin-bottom:8px">Self-service report kiosk · non-emergency only. For emergencies, call 911.</div>
      <div class="col">${types.map((ty, i) => `<button class="btn" data-act="t${i}">${ty}</button>`).join('')}</div>`;
    const m = modal({ title: '🗂 File a police report', body, foot: [{ act: 'close', label: 'Cancel' }],
      onAction: (a) => {
        if (!a.startsWith('t')) { m.close(); return; }
        const ty = types[+a.slice(1)]; const num = `RPT-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 8999))}`; m.close();
        (this.sim.state.walkinReports ||= []).push({ number: num, type: ty, time: this.sim.clock() });
        toast(`Report ${num} (${ty.toLowerCase()}) filed. The front desk will review it and an officer will follow up if needed.`, { level: 'good', title: 'Report filed', duration: 7000 });
      } });
  }

  // ---------------- Pause / break / save ----------------
  togglePause() { if (!this.sim) return; this.sim.setPaused(!this.sim.paused); toast(this.sim.paused ? 'Paused' : 'Resumed', { level: 'info', duration: 1200 }); }

  togglePauseMenu() {
    if (this.state !== 'playing') return;
    if (this.pauseModal) { this.pauseModal.close(); return; }
    this.releasePointer();
    const wasPaused = this.sim.paused; this.sim.setPaused(true);
    const mode = this.sim.state.mode;
    this.pauseModal = modal({ title: '⏸ Paused', body: `<div class="col">
        <button class="btn lg" data-act="resume">▶ Resume</button>
        <button class="btn" data-act="desk">🖥 Go to my console</button>
        <button class="btn" data-act="settings">⚙ Settings</button>
        <button class="btn" data-act="save">💾 Save now</button>
        ${mode !== 'training' ? '<button class="btn" data-act="report">📊 End shift & file report</button>' : ''}
        <button class="btn" data-act="fullscreen">⛶ Toggle full screen</button>
        <button class="btn danger" data-act="quit">⏏ ${mode === 'training' ? 'Exit training' : 'Save & quit to menu'}</button>
        <div class="dim" style="font-size:.82em;text-align:center">Game time is paused while this menu is open.</div></div>`,
      onAction: (a) => {
        if (a === 'resume') this.pauseModal.close();
        else if (a === 'desk') { this.pauseModal.close(); this.goToDesk(); }
        else if (a === 'settings') openSettings(this);
        else if (a === 'save') this.manualSave();
        else if (a === 'report') { this.pauseModal.close(); this.endShift(); }
        else if (a === 'fullscreen') this.toggleFullscreen();
        else if (a === 'quit') { this.pauseModal.close(); this.quitToMenu(); }
      },
      onClose: () => { this.pauseModal = null; if (this.sim && !wasPaused) this.sim.setPaused(false); if (this.state === 'playing' && !this.cad.open) setTimeout(() => this.lockPointer(), 30); } });
  }

  setBreak(b) {
    if (!this.sim) return; this.sim.setBreak(b);
    toast(b ? 'You\'re on break. Coworkers will cover new calls – go grab a coffee.' : 'Break over – new calls will ring at your console again.', { level: 'good' });
  }
  toggleBreak() { this.setBreak(!this.sim.onBreak); }

  manualSave() {
    if (!this.sim || this.sim === this.menuSim || this.sim.state.mode === 'training') { this.save.save(); toast('Settings saved.', { level: 'good' }); return; }
    const ok = this.save.saveShift(this.sim); toast(ok ? 'Game saved.' : 'Save failed – storage may be full or blocked.', { level: ok ? 'good' : 'warn' });
  }
  autosave() { if (this.sim && this.sim !== this.menuSim && this.state === 'playing' && this.sim.state.mode !== 'training') this.save.saveShift(this.sim); else this.save.save(); }
  saveSoon() { clearTimeout(this._saveT); this._saveT = setTimeout(() => this.save.save(), 800); }
  reloadProfile() { this.settings = new Settings(this.save.profile.settings); this.career = new Career(this.save.profile); this.speech.settings = this.settings; this.audio.settings = this.settings; this.llm.settings = this.settings; this.audio.applyVolumes(); }
  openSettings() { openSettings(this); }

  toggleFullscreen() {
    const d = document; try { if (!d.fullscreenElement) d.documentElement.requestFullscreen?.(); else d.exitFullscreen?.(); } catch { toast('Full screen is not available here.', { level: 'info' }); }
  }

  // ---------------- Helpers used by the CAD ----------------
  closeIncident(inc) {
    if (inc.status === 'closed') return;
    this.sim.incidents.close(inc);
    if (this.sim.state.mode !== 'training') this.save.recordIncident(inc);
    this.tutorial?.event('closed');
  }

  reportAssignment(rep, inc) {
    if (!rep) return;
    const text = assignReportText(rep);
    const level = rep.error ? 'warn' : rep.skipped.length && !rep.assigned.length ? 'warn' : rep.skipped.length ? 'request' : 'good';
    toast(text || 'Nothing assigned.', { level, title: inc ? `Assignment – ${inc.number}` : 'Assignment', duration: rep.skipped.length ? 8000 : 4500 });
    if (rep.assigned.length) this.audio.typing(6);
  }

  // ---------------- Input ----------------
  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'playing') { if (e.key === 'Escape') closeTopModal(); return; }
      if (e.key === 'Escape' && anyModalOpen() && !this.cad.open) { closeTopModal(); e.preventDefault(); return; }
      if (this.cad.open) { if (this.cad.handleKey(e)) e.preventDefault(); return; }
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
      if (e.key === 'Tab') { e.preventDefault(); this.goToDesk(); return; }
      if (e.code === 'KeyE') { this.interact(); return; }
      if (e.code === 'KeyP') { this.togglePause(); return; }
      if (e.key === 'Escape') { if (!this.pauseModal) this.togglePauseMenu(); return; }
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) return;
      if (this.intentionalUnlock) { this.intentionalUnlock = false; return; }
      if (this.state === 'playing' && !this.cad.open && !this.anyOverlay() && !this.world.player.transition) this.togglePauseMenu();
    });
    this.world.canvas.addEventListener('click', () => { this.audio.init(); if (this.state === 'playing' && !this.cad.open) this.lockPointer(); });
    document.addEventListener('pointerdown', () => this.audio.init(), { once: true });
  }

  bindBus() {
    const ringCheck = () => {
      const n = this.sim?.calls.ringing().length || 0;
      if (n && this.state === 'playing' && !this.sim.paused) this.audio.startRing(); else this.audio.stopRing();
    };
    for (const ev of ['call:incoming', 'call:answered', 'call:ended', 'call:updated', 'game:paused']) bus.on(ev, ringCheck);
    bus.on('call:incoming', ({ call }) => {
      if (this.sim === this.menuSim) return;
      if (!this.cad.open || this.cad.monitors.every((m) => m.current !== 'calls')) toast(`Incoming 911 call on line ${call.line}${call.sc.ani.kind === 'wireless' ? ' (wireless)' : ''}`, { level: 'alert', title: '911', kind: 'call', onClick: () => { this.goToDesk(); } });
      this.tutorial?.event('call');
    });
    bus.on('call:message', ({ call, entry }) => {
      if (entry.who !== 'caller' || call.status !== 'active' || this.sim === this.menuSim) return;
      const p = call.sc.caller; const persona = { panicked: [1.18, 1.14], worried: [1.06, 1.08], elderly: [0.86, 0.9], quiet: [0.94, 0.96], talkative: [1.1, 1.03], upset: [1.08, 0.97] }[p.persona] || [1, 1];
      this.speech.speak(entry.text, { key: call.id, sex: p.sex, rate: persona[0] * (0.95 + (p.age < 30 ? 0.06 : 0)), pitch: persona[1] * (p.sex === 'f' ? 1.06 : 0.94), category: 'caller' });
    });
    bus.on('radio:message', (m) => {
      if (this.sim === this.menuSim || this.state !== 'playing') return;
      const r = this.settings.data.radio;
      if (r.monitored[m.channel] === false) return;
      if (!m.dispatcher) {
        this.audio.radioIn(m.urgent);
        if (r.speakChannels[m.channel] && this.speech.speaking?.opts.category !== 'caller' && !this.sim.calls.active()?.pendingReply) {
          const sex = m.unit ? (m.unit.charCodeAt(m.unit.length - 1) % 4 === 0 ? 'f' : 'm') : 'm';
          this.speech.speak(m.text, { key: m.unit || m.from, sex, rate: 1.12, pitch: sex === 'f' ? 1.02 : 0.88, category: 'radio' });
        }
        if ((m.kind === 'request' || m.kind === 'development' || m.kind === 'wrong_address') && !(this.cad.open && this.cad.screens.radio.visible)) toast(`${m.from}: ${m.text}`, { level: 'radio', title: 'Radio', kind: 'radio', duration: 7000, onClick: () => { if (m.incident) { this.goToDesk(); setTimeout(() => this.cad.selectIncident(m.incident), 450); } } });
      }
    });
    bus.on('radio:tone', ({ priority }) => { if (this.state === 'playing' && this.sim !== this.menuSim) this.audio.alertTones(priority); });
    bus.on('notify', (n) => {
      if (this.sim === this.menuSim || this.state !== 'playing') return;
      if (['alert', 'warn'].includes(n.level)) { this.audio.notify(n.level); if (!n.text.startsWith('New P1')) toast(n.text, { level: n.level, kind: 'incident', onClick: () => { if (n.incident) { this.goToDesk(); setTimeout(() => this.cad.selectIncident(n.incident), 450); } } }); }
      else if (n.level === 'request') this.audio.notify('request');
    });
    bus.on('weather:changed', ({ current }) => this.audio.setWeather(current));
    bus.on('shift:ended', () => { if (this.state === 'playing') { toast('Your shift is over!', { level: 'good' }); setTimeout(() => this.endShift(true), 800); } });
    bus.on('career:rankup', ({ rank, unlocks }) => {
      toast(`Promoted to ${rank.name}!`, { level: 'good', title: 'Career', duration: 9000 });
      if (unlocks.length) setTimeout(() => this.world.build(), 500);
    });
  }

  // ---------------- Loop ----------------
  loop(t) {
    const dt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
    try {
      if (this.sim) this.sim.update(this.state === 'playing' && !this.pauseModal ? dt : (this.state === 'menu' ? dt : 0));
      if (this.state === 'menu' && !this.world.failed) { this.world.player.yaw += dt * 0.03; }
      this.world.update(dt);
      this.hud.update(dt);
      // ring volume falls off with distance from the desk
      if (this.state === 'playing' && !this.world.failed && !this.cad.open) {
        const p = this.world.player.pos; const d = Math.hypot(p[0] + 2.8, p[2] + 2.4);
        this.audio.setRingLevel(Math.max(0.15, Math.min(1, 1.6 - d / 12)));
      }
      this.updatePA(dt);
      this.department?.update();
      if (this.liveEvent && this.sim && !this.sim.paused && this.state === 'playing') { this.liveEvent.update(dt); if (this.liveEvent.done) this.liveEvent = null; }
    } catch (e) { console.error(e); }
    requestAnimationFrame((tt) => this.loop(tt));
  }

  /** A scheduled department event just happened (roll call, shift change, training…). */
  onDepartmentEvent(ev) {
    if (this.sim === this.menuSim || this.state !== 'playing') return;
    const lead = { rollcall: LEADERS.watch, shift: LEADERS.watch, training: LEADERS.range, meeting: LEADERS.fireChief, supervisor: LEADERS.supervisor, announcement: LEADERS.captain, briefing: LEADERS.watch }[ev.kind] || LEADERS.watch;
    this.audio.pa?.();
    // the department hears it on the radio too, so it's part of the shift log
    for (const l of ev.lines.slice(0, 3)) { const w = { captain: LEADERS.captain, watch: LEADERS.watch, chief: LEADERS.fireChief, karen: LEADERS.supervisor, hale: LEADERS.range }[l.who] || lead; this.sim.radio.push({ channel: l.who === 'chief' ? 'fire' : 'sheriff', from: w.short, text: l.text, kind: 'info' }); }
    const attendable = ['rollcall', 'training', 'briefing', 'meeting'].includes(ev.kind);
    if (attendable && !this.world.failed) this.liveEvent = new LiveBriefing(this, ev); // people walk over and it plays out in the building
    if (attendable) {
      const where = ev.kind === 'training' ? 'at the range' : ev.kind === 'meeting' ? 'in the Police Department conference room (2nd floor)' : 'in the Police Department roll call room';
      setTimeout(() => this.speech.speak(`Attention all personnel. ${ev.title} ${where}${ev.kind === 'rollcall' ? ' in five minutes' : ''}.`, { key: lead.id, sex: lead.sex, pitch: lead.pitch, rate: lead.rate, category: 'staff' }), 1200);
      toast(`${ev.title} ${where}. Click to attend.`, { level: 'info', title: `📢 ${lead.short}`, duration: 15000, onClick: () => this.attendEvent(ev) });
    } else {
      // short announcements are simply spoken over the PA
      if (!this.sim.calls.active()) ev.lines.forEach((l, i) => { const w = { captain: LEADERS.captain, watch: LEADERS.watch, chief: LEADERS.fireChief, karen: LEADERS.supervisor, hale: LEADERS.range }[l.who] || lead; setTimeout(() => this.speech.speak(l.text, { key: w.id, sex: w.sex, pitch: w.pitch, rate: w.rate, category: 'staff' }), 1200 + i * 200); });
      toast(ev.lines.map((l) => l.text).join(' '), { level: 'info', title: `📢 ${ev.title}`, duration: 12000, onClick: () => openBriefing(this, ev, { live: false }) });
    }
  }

  attendEvent(ev) {
    if (this.state !== 'playing') return;
    if (this.cad.open) this.closeCAD?.(true);
    if (this.world.failed) { this.releasePointer(); openBriefing(this, ev, { live: true }); return; }
    const w = this.world; const p = w.player; p.seated = false; p.freeSeat = null; p.transition = null;
    // take a free chair in the room (or stand at the back of the range)
    const near = (x, z, y, r) => w.seats.map((s, i) => ({ s, i })).filter(({ s }) => Math.hypot(s.x - x, s.z - z) < r && Math.abs(s.y - y - 0.47) < 0.3 && !w.npcs.npcs.some((n) => n.sitting && Math.hypot(n.x - s.x, n.z - s.z) < 0.4) && !w.npcs.reserved.has(w.npcs.nearestNode(s.x, s.z, y).id));
    let pick = null;
    if (ev.kind === 'training') { p.pos = [-15.5, 1.65, -9.6]; p.feet = 0; p.yaw = 0; }
    else if (ev.kind === 'meeting') { const R = PD_ROOMS.conference; pick = near(R.c[0], R.c[1], R.y, 3.6).sort((a, b) => b.s.z - a.s.z)[0]; p.pos = [R.stand[0], R.y + 1.65, R.stand[1]]; p.feet = R.y; p.yaw = R.stand[2]; }
    else { const R = PD_ROOMS.rollcall; pick = near(R.c[0], R.c[1], R.y, 5.2).sort((a, b) => a.s.x - b.s.x)[0]; p.pos = [R.stand[0], R.y + 1.65, R.stand[1]]; p.feet = R.y; p.yaw = R.stand[2]; }
    p.pitch = 0.02;
    if (pick) p.sitInSeat(pick.s, w.allColliders());
    this.lockPointer();
    toast(`${ev.title}: take a seat and listen in – the shift keeps running. Walk away any time.`, { level: 'info', duration: 5000 });
  }

  updatePA(dt) {
    if (this.state !== 'playing' || !this.sim || this.sim.paused || this.sim.state.mode === 'training') return;
    this.nextPA -= dt;
    if (this.nextPA <= 0) {
      this.nextPA = 300 + Math.random() * 300;
      if (this.sim.calls.active()) return;
      this.audio.pa();
      const line = rng.pick(PA_LINES);
      setTimeout(() => this.speech.speak(line, { key: 'pa', sex: 'f', rate: 0.98, pitch: 1.0, category: 'staff' }), 1300);
      toast(line, { level: 'info', title: 'PA announcement' });
    }
  }
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }

export { RANKS, confirmBox };
