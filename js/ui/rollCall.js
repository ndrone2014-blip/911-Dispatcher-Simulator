// Roll call / briefing window: the Captain, Watch Commander and others speak in turn
// (text + voice). Opened when you attend a scheduled event or read the briefing board.
import { modal, toast } from './dom.js';
import { esc } from '../core/util.js';
import { LEADERS } from '../sim/department.js';
import { bus } from '../core/events.js';
import { STAFF } from '../ai/staffDialogue.js';
import { PD_ROOMS } from '../world/policeDept.js';

const WHO = { captain: LEADERS.captain, watch: LEADERS.watch, chief: LEADERS.fireChief, karen: LEADERS.supervisor, hale: LEADERS.range };
for (const s of STAFF) if (!WHO[s.id]) WHO[s.id] = { id: s.id, name: s.name, short: s.name.split(' ').slice(-1)[0], sex: s.sex, pitch: s.pitch, rate: s.rate };
export const SPEAKERS = WHO;
const ICON = { rollcall: '📋', shift: '🔄', training: '🎯', meeting: '🤝', supervisor: '🧭', announcement: '📢', briefing: '🌙' };

export function openBriefing(game, ev, { live = true } = {}) {
  if (!ev) { toast('No briefing has been given yet this shift. Check the schedule on the shift board.', { level: 'info' }); return null; }
  const sim = game.sim; const wasPaused = sim?.paused;
  if (live && sim && !wasPaused) sim.setPaused(true);
  const body = document.createElement('div');
  body.innerHTML = `<div class="dim" style="margin-bottom:8px">${esc(ev.at)} · ${live ? 'You\'re in the briefing room. The floor is covered while you listen.' : 'Briefing notes'}</div>
    <div class="rollcall-log" data-r="log"></div>`;
  const log = body.querySelector('[data-r="log"]');
  let i = 0; let timer = null; let closed = false; let waitingFor = null;
  const m = modal({ title: `${ICON[ev.kind] || '📋'} ${esc(ev.title)}`, body, wide: true, foot: [{ act: 'all', label: 'Show all' }, { act: 'close', label: 'Back to work', cls: 'primary' }],
    onAction: (a) => { if (a === 'all') { while (i < ev.lines.length) show(ev.lines[i++], false); game.speech.stopAll(); } else if (a === 'close') m.close(); },
    onClose: () => { closed = true; clearTimeout(timer); game.speech.stopAll(); off(); if (live && sim && !wasPaused) sim.setPaused(false); } });
  const off = bus.on ? bus.on('speech:end', (item) => { if (item === waitingFor) { waitingFor = null; clearTimeout(timer); timer = setTimeout(step, 500); } }) : () => {};
  function show(line, speak = true) {
    const w = WHO[line.who] || { name: line.who, title: '' };
    log.insertAdjacentHTML('beforeend', `<div class="rc-line"><div class="rc-who">${esc(w.name)}</div><div class="rc-text">${esc(line.text)}</div></div>`);
    log.scrollTop = log.scrollHeight;
    if (speak && live) {
      game.speech.speak(line.text, { key: w.id || line.who, sex: w.sex, pitch: w.pitch, rate: w.rate, category: 'staff' });
      waitingFor = game.speech.queue?.find((q) => q.text && line.text && q.opts?.key === (w.id || line.who)) || game.speech.speaking;
    }
  }
  function step() {
    if (closed || i >= ev.lines.length) return;
    show(ev.lines[i++]);
    // fallback pacing if speech is off or unavailable
    clearTimeout(timer); timer = setTimeout(step, Math.min(9000, 1600 + ev.lines[i - 1].text.length * 55));
  }
  if (live) step(); else for (const l of ev.lines) show(l, false);
  return m;
}

export function openSchedule(game) {
  const d = game.department; const items = d ? d.fullSchedule() : [];
  const next = d?.next();
  const last = game.sim?.state.lastBriefing;
  const body = `<div class="dim" style="margin-bottom:8px">Daily schedule (game time). ${next ? `Next: <b>${esc(next.title)}</b> in ${next.inMin} min.` : ''}</div>
    <table class="tbl"><tbody>${items.map((e) => `<tr><td class="mono">${esc(e.at)}</td><td>${ICON[e.kind] || ''} ${esc(e.title)}</td></tr>`).join('')}</tbody></table>
    <div class="dim" style="margin-top:10px;font-size:.88em">Leadership: ${esc(LEADERS.captain.name)} · ${esc(LEADERS.watch.name)} · ${esc(LEADERS.fireChief.name)}</div>`;
  const m = modal({ title: '🗓 Department schedule', body, foot: [...(last ? [{ act: 'last', label: 'Read last briefing' }] : []), { act: 'close', label: 'Close', cls: 'primary' }],
    onAction: (a) => { if (a === 'last') { m.close(); openBriefing(game, last, { live: false }); } else m.close(); } });
  return m;
}


// ------------------------------------------------------------------------------------------
// Live briefings in the 3D building: people walk to the room, the Watch Commander runs roll
// call from the podium line by line (voice + captions, gestures), officers answer roll and ask
// questions, and at the end everyone is dismissed to their assignments. The shift keeps
// running – you can sit in, stand at the back, or carry on working.
export class LiveBriefing {
  constructor(game, ev) {
    this.game = game; this.ev = ev; this.i = 0; this.wait = 0; this.done = false; this.started = false; this.t = 0;
    const rc = PD_ROOMS.rollcall, cf = PD_ROOMS.conference; const RC = [rc.c[0], rc.c[1], rc.y, rc.r];
    this.room = { rollcall: RC, briefing: RC, training: [-17, -10, 0, 10], meeting: [cf.c[0], cf.c[1], cf.y, cf.r] }[ev.kind] || RC;
    this.people = game.world?.npcs?.gather?.(ev.kind) || [];
    this.log = [];
  }

  npcFor(who) { return this.game.world?.npcs?.npc(who); }
  /** Is the player close enough to hear (in the same room)? */
  hearing() { const w = this.game.world; if (!w || w.failed) return true; const p = w.player.pos; const [x, z, y, r] = this.room; return Math.hypot(p[0] - x, p[2] - z) < r && Math.abs(w.player.feet - y) < 2; }

  ready() {
    if (this.t > 28) return true; // don't hold the meeting forever for a late arrival
    if (this.t < 3) return false;
    const lead = this.npcFor(this.ev.kind === 'training' ? 'hale' : this.ev.kind === 'meeting' ? 'chief' : 'watch');
    const there = (n) => n.at === n.eventDest && n.state !== 'walk';
    return (!lead || there(lead)) && this.people.filter((n) => !there(n)).length <= 1;
  }

  update(dt) {
    if (this.done) return; this.t += dt;
    if (!this.started) { if (!this.ready()) return; this.started = true; this.wait = 0.8; }
    this.wait -= dt; if (this.wait > 0) return;
    for (const n of this.people) if (n.event) n.anim = n.sitting ? 'idle' : 'idle';
    if (this.i >= this.ev.lines.length) return this.finish();
    let line = this.ev.lines[this.i++];
    // somebody who's out on a call can't answer roll – a coworker answers for them
    let npc = this.npcFor(line.who);
    const inRoom = (n) => n && !n.away && n.event === this.ev.kind && n.at === n.eventDest;
    if (/^(Here|Present|Yep)/.test(line.text) && !inRoom(npc)) {
      const sub = this.people.find((n) => inRoom(n) && n.kind === 'sergeant' && n.id !== line.who) || this.people.find((n) => inRoom(n) && n.id !== line.who && n.kind === 'officer');
      const last = (WHO[line.who]?.name || line.who).split(' ').slice(-1)[0];
      line = { who: sub?.id || 'watch', text: `${last} is out on a call.` }; npc = this.npcFor(line.who);
    } else if (!npc && !['captain', 'watch', 'chief', 'karen', 'hale'].includes(line.who)) { this.wait = 0.1; return; }
    const w = WHO[line.who] || { name: line.who };
    if (npc) { npc.anim = /screen|board|slide|Assignments|priorities/i.test(line.text) ? 'point' : 'talk'; const lead = this.npcFor('watch'); if (lead && lead !== npc && lead.event) lead.headYaw = 0.6; }
    this.log.push({ who: w.name, text: line.text });
    const near = this.hearing();
    if (near) {
      this.game.hud?.caption?.(w.name, line.text, Math.max(3, line.text.length * 0.06));
      this.game.speech.speak(line.text, { key: w.id || line.who, sex: w.sex, pitch: w.pitch, rate: w.rate, category: 'staff' });
    }
    this.wait = Math.min(11, 1.2 + line.text.split(/\s+/).length * 0.36);
  }

  finish() {
    this.done = true;
    this.game.world?.npcs?.release?.(this.ev.kind, this.ev.lines.assign || {});
    if (this.hearing()) toast(`${this.ev.title} dismissed.${this.ev.kind === 'rollcall' ? ' Officers are heading out to their beats.' : ''}`, { level: 'good', title: '📋 Briefing', duration: 5000, onClick: () => openBriefing(this.game, { ...this.ev, lines: this.log.map((l) => ({ who: Object.keys(WHO).find((k) => WHO[k].name === l.who) || l.who, text: l.text })) }, { live: false }) });
  }
}
