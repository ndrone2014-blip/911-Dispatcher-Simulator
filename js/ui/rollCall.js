// Roll call / briefing window: the Captain, Watch Commander and others speak in turn
// (text + voice). Opened when you attend a scheduled event or read the briefing board.
import { modal, toast } from './dom.js';
import { esc } from '../core/util.js';
import { LEADERS } from '../sim/department.js';
import { bus } from '../core/events.js';

const WHO = { captain: LEADERS.captain, watch: LEADERS.watch, chief: LEADERS.fireChief, karen: LEADERS.supervisor, hale: LEADERS.range };
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
