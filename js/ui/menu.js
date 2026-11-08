// Main menu and game-mode setup screens.
import { bindActions, toast, confirmBox, downloadText, pickFile, modal } from './dom.js';
import { esc, deepClone } from '../core/util.js';
import { DEPARTMENTS } from '../data/departments.js';
import { INCIDENT_CATEGORIES } from '../data/incidentTypes.js';
import { WEATHER_TYPES } from '../sim/weather.js';
import { FREQUENCY_LABELS } from '../sim/calls.js';
import { RANKS, UPGRADES } from '../sim/career.js';
import { DEFAULT_CONFIG } from '../sim/sim.js';
import { thanksgivingOn } from '../core/season.js';

const CREDIT = 'Developed by Drone Hive Studios | Developer @ndrone40';
export const DISCLAIMER = 'This is an independently developed fictional emergency dispatch simulator inspired by White County, Illinois. It is not affiliated with, endorsed by, or operated by White County or any real emergency services agency.';

export class Menu {
  constructor(game) { this.game = game; this.root = document.getElementById('menu'); this.bound = false; }

  show(view = 'main') { this.root.hidden = false; this.view = view; this.render(); }
  hide() { this.root.hidden = true; }

  render() {
    const fn = { main: () => this.main(), free: () => this.setup('free'), custom: () => this.setup('custom'), career: () => this.career(), data: () => this.data(), about: () => this.about() }[this.view];
    this.root.innerHTML = `<div class="menu-inner">${fn()}</div>`;
    if (this.bound) return;
    this.bound = true;
    bindActions(this.root, {
      go: (t) => { this.game.audio.init(); this.show(t.dataset.v); },
      back: () => this.show('main'),
      continue: () => { this.game.audio.init(); this.game.continueShift(); },
      training: () => { this.game.audio.init(); this.game.startTraining(); },
      start: (t) => { this.game.audio.init(); this.startFromForm(t.dataset.mode); },
      settings: () => this.game.openSettings(),
      export: () => { downloadText(`911-dispatch-save-${new Date().toISOString().slice(0, 10)}.json`, this.game.save.exportString()); toast('Save file downloaded.', { level: 'good' }); },
      import: async () => { const text = await pickFile(); if (!text) return; try { this.game.save.importString(text); this.game.reloadProfile(); toast('Save imported!', { level: 'good' }); this.render(); } catch (e) { toast(e.message, { level: 'warn' }); } },
      copy: async () => { try { await navigator.clipboard.writeText(this.game.save.exportString()); toast('Save data copied to clipboard.', { level: 'good' }); } catch { toast('Clipboard not available – use Download instead.', { level: 'warn' }); } },
      paste: () => this.pasteImport(),
      reset: async () => { if (await confirmBox('Delete ALL progress, settings and saved shifts? This cannot be undone.', { ok: 'Delete everything', danger: true })) { this.game.save.reset(); this.game.reloadProfile(); toast('Progress reset.', { level: 'info' }); this.render(); } },
      careerstart: () => { this.game.audio.init(); this.startCareer(); },
    });
  }

  main() {
    const g = this.game; const shift = g.save.loadShift();
    const rank = g.career.rank();
    const tg = thanksgivingOn(g.settings);
    return `<div class="title-block"><img class="menu-logo" src="icon.svg" alt="911 Dispatch Simulator logo" width="96" height="96"><div class="eyebrow">A fictional simulator inspired by White County, Illinois</div><h1>911 Dispatch<br><span>Simulator</span></h1>
      ${tg ? '<div class="holiday-note">🦃 Happy Thanksgiving — thanks for working the holiday shift! 🍂</div>' : ''}
      <p>Sit at your console, answer calls, talk to callers, and run the whole emergency response for Carmi and all of White County, Illinois – at your own pace.</p></div>
      <div class="menu-list">
        ${shift ? `<button class="menu-btn" data-act="continue"><span class="ico">▶</span><span><b>Continue shift</b><small>${esc(shift.mode === 'career' ? 'Career' : shift.mode === 'custom' ? 'Custom shift' : 'Free play')} · saved ${esc(new Date(shift.savedAt).toLocaleString())}</small></span></button>` : ''}
        <button class="menu-btn" data-act="go" data-v="free"><span class="ico">🎧</span><span><b>Free Play</b><small>Start dispatching immediately. Configure everything.</small></span></button>
        <button class="menu-btn" data-act="go" data-v="career"><span class="ico">🎖</span><span><b>Career</b><small>${esc(rank.name)} · ${g.career.data.xp} XP · ${g.career.data.shifts} shifts completed</small></span></button>
        <button class="menu-btn" data-act="go" data-v="custom"><span class="ico">🛠</span><span><b>Custom Shift</b><small>Set the shift length, difficulty, weather and more.</small></span></button>
        <button class="menu-btn" data-act="training"><span class="ico">🎓</span><span><b>Training</b><small>Guided tutorial: calls, CAD, units, radio.${g.save.profile.tutorialDone ? ' (completed)' : ' Recommended first!'}</small></span></button>
        <div class="row" style="gap:8px">
          <button class="menu-btn grow" data-act="settings"><span class="ico">⚙</span><span><b>Settings</b></span></button>
          <button class="menu-btn grow" data-act="go" data-v="data"><span class="ico">💾</span><span><b>Saves</b></span></button>
          <button class="menu-btn grow" data-act="go" data-v="about"><span class="ico">ℹ</span><span><b>About</b></span></button>
        </div>
      </div>
      <div class="menu-foot">${CREDIT}<br>No API keys · No accounts · Runs entirely in your browser · Progress saves on this device.</div>
      <div class="disclaimer" role="note">${DISCLAIMER}</div>`;
  }

  defaults(mode) {
    const p = this.game.save.profile;
    const saved = mode === 'custom' ? p.customConfig : p.freeplayConfig;
    const base = deepClone(DEFAULT_CONFIG);
    if (mode === 'custom') Object.assign(base, { shiftLength: 30, callFrequency: 'normal', weather: 'random' });
    return { ...base, ...(saved || {}), mode };
  }

  setup(mode) {
    const c = this.defaults(mode);
    this.formMode = mode;
    const opt = (name, opts, val) => `<select class="input" name="${name}">${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${String(val) === String(k) ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    const chk = (name, label, val) => `<label class="toggle"><input type="checkbox" name="${name}" ${val !== false ? 'checked' : ''}> ${label}</label>`;
    return `<div class="menu-panel" data-r="form">
      <div class="row"><button class="btn ghost sm" data-act="back">← Back</button><h2 class="grow">${mode === 'custom' ? 'Custom Shift' : 'Free Play'}</h2></div>
      <p class="muted" style="margin:6px 0 0">${mode === 'custom' ? 'Design your own shift. When the shift ends you get a full report.' : 'Endless dispatching. Change call frequency any time from the CAD top bar.'}</p>
      <h3>Shift</h3><div class="setup-grid">
        ${mode === 'custom' ? `<label class="field">Shift length (real time)${opt('shiftLength', { 15: '15 minutes', 20: '20 minutes', 30: '30 minutes', 45: '45 minutes', 60: '1 hour', 90: '90 minutes' }, c.shiftLength)}</label>` : ''}
        <label class="field">Call frequency${opt('callFrequency', Object.fromEntries(Object.entries(FREQUENCY_LABELS).filter(([k]) => k !== 'off')), c.callFrequency)}</label>
        <label class="field">Major incidents${opt('majorFrequency', { rare: 'Rare', occasional: 'Occasional', frequent: 'Frequent' }, c.majorFrequency)}</label>
        <label class="field">Time of day${opt('startTime', { morning: 'Morning (07:00)', afternoon: 'Afternoon (13:00)', evening: 'Evening (17:30)', night: 'Night (22:00)' }, c.startTime)}</label>
        <label class="field">Weather${opt('weather', { random: 'Random', ...Object.fromEntries(Object.entries(WEATHER_TYPES).map(([k, w]) => [k, `${w.icon} ${w.label}`])) }, c.weather)}</label>
        <label class="field">Difficulty${opt('difficulty', { easy: 'Easy', normal: 'Normal', hard: 'Hard' }, c.difficulty)}</label>
      </div>
      <h3>Units</h3><div class="setup-grid">
        <label class="field">Fleet size${opt('unitCount', { small: 'Small (~75 units)', standard: 'Standard (~125 units)', large: 'Large (~200 units)' }, c.unitCount)}</label>
        <label class="field">Unit availability${opt('availabilityOverride', { false: 'Realism – availability matters', true: 'Sandbox – assign busy units too' }, c.availabilityOverride)}</label>
        <label class="field">Travel speed${opt('travelSpeed', { 0.6: 'Realistic', 1: 'Normal', 1.8: 'Fast' }, c.travelSpeed)}</label>
        <label class="field">Background activity${opt('backgroundActivity', { off: 'Off', low: 'Low', normal: 'Normal', high: 'High' }, c.backgroundActivity)}</label>
      </div>
      <h3>Departments</h3><div class="check-grid">${DEPARTMENTS.map((d) => chk(`dept_${d.id}`, `<span class="dot" style="background:${d.color}"></span> ${esc(d.name)}`, c.departments?.[d.id])).join('')}</div>
      <h3>Incident types</h3><div class="check-grid">${Object.entries(INCIDENT_CATEGORIES).map(([k, v]) => chk(`cat_${k}`, v.label, c.categories?.[k])).join('')}
        ${chk('sev_small', 'Small incidents', c.severities?.small)}${chk('sev_medium', 'Medium incidents', c.severities?.medium)}${chk('sev_major', 'Major incidents', c.severities?.major)}${chk('nonEmergency', 'Misdials & non-emergency calls', c.nonEmergency)}</div>
      <h3>Realism</h3><div class="check-grid">
        ${chk('relaxed', 'Relaxed incidents (always progress)', c.relaxed)}${chk('callerHangups', 'Callers may hang up', c.callerHangups ? true : false)}
        ${chk('autoClearUnits', 'Auto-clear units', c.autoClearUnits)}${chk('autoClose', 'Auto-close incidents', c.autoClose ? true : false)}
        ${chk('selfInitiated', 'Units self-initiate', c.selfInitiated)}${chk('dynamicWeather', 'Dynamic weather', c.dynamicWeather)}
        ${chk('cityEvents', 'City events', c.cityEvents)}${chk('tenCodes', 'Police 10-codes', c.tenCodes ? true : false)}</div>
      <div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn primary lg" data-act="start" data-mode="${mode}">Start shift ▶</button></div></div>`;
  }

  readForm() {
    const f = this.root.querySelector('[data-r="form"]'); const c = this.defaults(this.formMode);
    const val = (n) => f.querySelector(`[name="${n}"]`);
    for (const k of ['callFrequency', 'majorFrequency', 'startTime', 'weather', 'difficulty', 'unitCount', 'backgroundActivity']) if (val(k)) c[k] = val(k).value;
    if (val('shiftLength')) c.shiftLength = parseInt(val('shiftLength').value, 10);
    c.travelSpeed = parseFloat(val('travelSpeed').value); c.availabilityOverride = val('availabilityOverride').value === 'true';
    c.departments = {}; for (const d of DEPARTMENTS) c.departments[d.id] = val(`dept_${d.id}`).checked;
    c.categories = {}; for (const k of Object.keys(INCIDENT_CATEGORIES)) c.categories[k] = val(`cat_${k}`).checked;
    c.severities = { small: val('sev_small').checked, medium: val('sev_medium').checked, major: val('sev_major').checked };
    for (const k of ['relaxed', 'callerHangups', 'autoClearUnits', 'autoClose', 'selfInitiated', 'dynamicWeather', 'cityEvents', 'tenCodes', 'nonEmergency']) c[k] = val(k).checked;
    return c;
  }

  startFromForm(mode) {
    const c = this.readForm();
    if (!Object.values(c.departments).some(Boolean)) { toast('Enable at least one department.', { level: 'warn' }); return; }
    if (!Object.values(c.categories).some(Boolean) || !Object.values(c.severities).some(Boolean)) { toast('Enable at least one incident type and size.', { level: 'warn' }); return; }
    if (mode === 'custom') this.game.save.profile.customConfig = c; else this.game.save.profile.freeplayConfig = c;
    this.game.save.save();
    this.game.startShift(mode, c);
  }

  career() {
    const car = this.game.career; const d = car.data; const ri = car.rankIndex(); const r = RANKS[ri]; const nx = RANKS[ri + 1];
    const pct = nx ? Math.min(100, ((d.xp - r.xp) / (nx.xp - r.xp)) * 100) : 100;
    return `<div class="menu-panel"><div class="row"><button class="btn ghost sm" data-act="back">← Back</button><h2 class="grow">Career</h2></div>
      <div class="rank-track">${RANKS.map((_, i) => `<div class="${i <= ri ? 'on' : ''}"></div>`).join('')}</div>
      <div style="font-size:1.4em;font-weight:800">${esc(r.name)}</div>
      <div class="muted">${d.xp} XP · ${d.shifts} career shift${d.shifts === 1 ? '' : 's'} completed${d.pendingXP ? ` · ${d.pendingXP} XP pending` : ''}</div>
      ${nx ? `<div class="progress" style="margin:10px 0 4px"><i style="width:${pct}%"></i></div><div class="dim" style="font-size:.85em">Next: <b>${esc(nx.name)}</b> at ${nx.xp} XP and ${nx.shifts} completed shifts.</div>` : '<div class="good" style="margin-top:8px">You\'ve reached the top. Congratulations, Director.</div>'}
      <h3>How you earn experience</h3><div class="muted" style="font-size:.9em;line-height:1.6">Close incidents (bigger incidents earn more). Bonuses for verifying addresses, good unit matches, giving callers instructions, keeping callers calm, notes, BOLOs and prompt dispatch. Finishing a career shift adds +100 XP. There are never penalties.</div>
      <h3>Unlocks</h3><div class="col">${UPGRADES.map((u) => `<div class="row" style="gap:10px;opacity:${ri >= u.rank ? 1 : 0.55}"><span>${ri >= u.rank ? '✅' : '🔒'}</span><span class="grow"><b>${esc(u.name)}</b> <span class="dim">– ${esc(RANKS[u.rank].name)}</span><br><small class="muted">${esc(u.desc)}</small></span></div>`).join('')}</div>
      <h3>Start a career shift</h3><div class="setup-grid" data-r="cform">
        <label class="field">Shift<select class="input" name="startTime"><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="night">Night</option></select></label>
        <label class="field">Length<select class="input" name="shiftLength"><option value="20">20 minutes</option><option value="30" selected>30 minutes</option><option value="45">45 minutes</option></select></label>
        <label class="field">Call volume<select class="input" name="callFrequency"><option value="auto">By rank (${esc(FREQUENCY_LABELS[r.freq])})</option>${Object.entries(FREQUENCY_LABELS).filter(([k]) => k !== 'off').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      </div>
      <div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn primary lg" data-act="careerstart">Clock in ▶</button></div></div>`;
  }

  startCareer() {
    const f = this.root.querySelector('[data-r="cform"]'); const r = this.game.career.rank();
    const v = (n) => f.querySelector(`[name="${n}"]`).value;
    const c = { ...deepClone(DEFAULT_CONFIG), mode: 'career', startTime: v('startTime'), shiftLength: parseInt(v('shiftLength'), 10), callFrequency: v('callFrequency') === 'auto' ? r.freq : v('callFrequency'), weather: 'random',
      majorFrequency: this.game.career.rankIndex() >= 2 ? 'occasional' : 'rare' };
    this.game.startShift('career', c);
  }

  data() {
    const p = this.game.save.profile;
    return `<div class="menu-panel"><div class="row"><button class="btn ghost sm" data-act="back">← Back</button><h2 class="grow">Saves & data</h2></div>
      <p class="muted">Your progress is saved automatically in this browser. To move progress to another device, export a save file here and import it on the other device. There is no cloud sync.</p>
      <div class="stat-grid" style="margin:12px 0"><div class="stat"><span>Career XP</span><b>${p.career.xp}</b></div><div class="stat"><span>Shifts</span><b>${p.lifetime.shifts}</b></div><div class="stat"><span>Incidents</span><b>${p.lifetime.incidents}</b></div><div class="stat"><span>Calls</span><b>${p.lifetime.calls}</b></div></div>
      <div class="col"><button class="btn" data-act="export">⬇ Download save file</button><button class="btn" data-act="import">⬆ Import save file</button>
      <div class="row"><button class="btn grow" data-act="copy">Copy save to clipboard</button><button class="btn grow" data-act="paste">Paste save text</button></div>
      <button class="btn danger" data-act="reset">Delete all progress</button></div>
      <div class="dim" style="margin-top:10px;font-size:.82em">Last saved: ${p.updated ? esc(new Date(p.updated).toLocaleString()) : 'never'}</div></div>`;
  }

  pasteImport() {
    const m = modal({ title: 'Paste save data', body: '<textarea class="input" rows="8" data-r="t" placeholder="Paste exported save text here"></textarea>', foot: [{ label: 'Cancel', act: 'c' }, { label: 'Import', act: 'i', cls: 'primary' }],
      onAction: (a) => { if (a === 'i') { try { this.game.save.importString(m.body.querySelector('[data-r="t"]').value); this.game.reloadProfile(); toast('Save imported!', { level: 'good' }); this.render(); } catch (e) { toast(e.message, { level: 'warn' }); return; } } m.close(); } });
  }

  about() {
    return `<div class="menu-panel"><div class="row"><button class="btn ghost sm" data-act="back">← Back</button><h2 class="grow">About</h2></div>
      <h3>Independent &amp; fictional</h3><div class="disclaimer big" role="note">${DISCLAIMER}</div>
      <div class="muted" style="font-size:.9em;line-height:1.6;margin-top:6px">All characters, callers, calls, units, call signs and storylines are made up. Place names and road layouts are used only to make the setting feel familiar and are simplified. Nothing in this game reflects real policies, procedures, personnel or incidents of any agency, and it is not a training tool for real emergency work. In a real emergency, call 911.</div>
      <h3>Controls – PC</h3><div class="muted" style="line-height:1.8;font-size:.92em">
        <span class="kbd">W A S D</span> move · <span class="kbd">Mouse</span> look · <span class="kbd">E</span> interact / sit · <span class="kbd">Tab</span> go to your console · <span class="kbd">Esc</span> stand up / pause<br>
        At the console: <span class="kbd">A</span> answer · <span class="kbd">T</span> type to caller · <span class="kbd">F2</span> microphone · <span class="kbd">Ctrl+Enter</span> create incident · <span class="kbd">U</span> assign units · <span class="kbd">F4</span> end call · <span class="kbd">C I M R N D H B</span> switch screens · <span class="kbd">P</span> pause</div>
      <h3>Controls – Mobile</h3><div class="muted" style="font-size:.92em;line-height:1.6">Left joystick to walk, drag the right side to look, tap <b>Use</b> to interact and <b>Desk</b> to jump to your console. The CAD uses tabs along the bottom.</div>
      <h3>Talking to callers</h3><div class="muted" style="font-size:.92em;line-height:1.6">Use the microphone (Chrome, Edge and Safari support speech recognition), type naturally, or tap suggested questions. The conversation engine runs locally: it recognizes many different ways of asking the same thing, remembers what was said, and callers react to reassurance and instructions. It is a rule-based engine with intent recognition – not a full AI – so unusual phrasings can be misunderstood. Suggested questions always work.
        <br><br><b>Optional:</b> if you run a free local language model on your own computer (Ollama or LM Studio), you can enable it in Settings → Speech &amp; AI to make callers' wording more natural. It is never required and no keys or accounts are involved.</div>
      <h3>Technology</h3><div class="muted" style="font-size:.92em;line-height:1.6">HTML, CSS and JavaScript with a custom lightweight WebGL renderer, browser speech APIs, procedural Web Audio, and localStorage saves. Everything runs locally from a static website – no servers or keys.</div>
      <div class="menu-foot">${CREDIT}</div></div>`;
  }
}
