// Department leadership and the daily schedule: roll calls, shift changes, training, meetings
// and announcements happen at set game times. The Captain and Watch Commander actually talk
// to the department (PA chime, spoken lines, radio log), and you can walk to the briefing room
// – or click the notice – to attend roll call in person. All characters are fictional.
import { TOWNS } from '../data/city.js';
import { WEATHER_TYPES } from './weather.js';

export const LEADERS = {
  captain: { id: 'captain', name: 'Captain Nolan Drone', short: 'Captain Drone', title: 'Captain', sex: 'm', pitch: 0.88, rate: 0.95 },
  watch: { id: 'watch', name: 'Watch Commander John Nolan', short: 'Watch Commander Nolan', title: 'Watch Commander', sex: 'm', pitch: 0.92, rate: 1.0 },
  fireChief: { id: 'chief', name: 'Fire Chief Bentley Allen', short: 'Chief Allen', title: 'Fire Chief', sex: 'm', pitch: 0.84, rate: 0.95 },
  supervisor: { id: 'karen', name: 'Karen Whitfield', short: 'Supervisor Whitfield', title: 'Shift Supervisor', sex: 'f', pitch: 0.95, rate: 1.0 },
  range: { id: 'hale', name: 'Sgt. Mike Hale', short: 'Sgt. Hale', title: 'Range Master', sex: 'm', pitch: 0.86, rate: 0.96 },
};

// [id, minute of day, kind, title]
export const SCHEDULE = [
  ['rollcall_am', 6 * 60 + 45, 'rollcall', 'Day-shift roll call'],
  ['shift_am', 7 * 60, 'shift', 'Shift change'],
  ['training', 10 * 60, 'training', 'Range training & qualification'],
  ['fire_meeting', 11 * 60 + 30, 'meeting', 'Fire/EMS coordination meeting'],
  ['sup_update', 14 * 60, 'supervisor', 'Supervisor update'],
  ['announce', 16 * 60, 'announcement', 'Department announcement'],
  ['rollcall_pm', 18 * 60 + 45, 'rollcall', 'Night-shift roll call'],
  ['shift_pm', 19 * 60, 'shift', 'Shift change'],
  ['night_brief', 22 * 60, 'briefing', 'Night watch briefing'],
  ['midwatch', 2 * 60, 'briefing', 'Mid-watch check-in'],
];

const DISTRICTS = [
  'District 1 – Carmi, Brownsville and Stokes', 'District 2 – Norris City, Herald and the south end', 'District 3 – Grayville, Mill Shoals and the I-64 corridor',
  'District 4 – Crossville, Phillipstown and the Wabash bottoms', 'District 5 – Enfield, Springerton and Burnt Prairie', 'District 6 – Emma, Maunie and Epworth',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export class DepartmentSchedule {
  constructor(game) { this.game = game; this.lastClock = null; this.history = []; }

  get sim() { return this.game.sim; }
  reset() { this.lastClock = null; }

  next() {
    const sim = this.sim; if (!sim) return null;
    const now = Math.floor(sim.clock());
    let best = null, bd = Infinity;
    for (const ev of SCHEDULE) { const d = (ev[1] - now + 1440) % 1440 || 1440; if (d < bd) { bd = d; best = ev; } }
    return best ? { id: best[0], at: best[1], kind: best[2], title: best[3], inMin: bd } : null;
  }

  describeNext(npc) {
    const n = this.next(); if (!n) return 'Nothing on the schedule right now.';
    const rest = SCHEDULE.filter((e) => e[0] !== n.id).slice(0, 0);
    const who = n.kind === 'rollcall' ? `${LEADERS.captain.short} and ${LEADERS.watch.short} run it in the briefing room` : n.kind === 'training' ? `${LEADERS.range.short} runs it at the range` : n.kind === 'meeting' ? `${LEADERS.fireChief.short} comes over for it` : n.kind === 'briefing' ? `${LEADERS.watch.short} handles that one` : 'it comes over the PA';
    const lead = npc?.id === 'captain' ? 'On my schedule: ' : npc?.id === 'watch' ? 'Next up on the watch: ' : 'Next on the schedule: ';
    return `${lead}${n.title} at ${hhmm(n.at)}, about ${n.inMin} minutes from now – ${who}. The full day is on the shift board in the corridor.${rest.length ? '' : ''}`;
  }

  fullSchedule() { return SCHEDULE.slice().sort((a, b) => a[1] - b[1]).map(([, at, kind, title]) => ({ at: hhmm(at), kind, title })); }

  update() {
    const sim = this.sim; const g = this.game;
    if (!sim || g.state !== 'playing' || sim.paused || sim.state.mode === 'training') { this.lastClock = sim && !sim.paused ? sim.clock() : this.lastClock; return; }
    const now = sim.clock();
    if (this.lastClock == null) { this.lastClock = now; return; }
    const prev = this.lastClock; this.lastClock = now;
    if (now === prev) return;
    const fwd = (now - prev + 1440) % 1440;
    if (fwd > 90) return; // a time jump (loaded save, debug, new day) – don't replay a day's worth of events
    const crossed = (t) => (prev <= now ? t > prev && t <= now : t > prev || t <= now);
    for (const ev of SCHEDULE) if (crossed(ev[1])) this.fire(ev);
  }

  fire([id, at, kind, title]) {
    const g = this.game; const sim = this.sim;
    const done = (sim.state.deptDone ||= {}); const dayKey = `${id}@${Math.floor((sim.state.time.sim * sim.state.time.clockRate) / 60 / 1440)}`;
    if (done[dayKey]) return; done[dayKey] = true;
    const lines = this.script(kind, { id, title });
    const ev = { id, kind, title, at: hhmm(at), lines, time: sim.clock() };
    this.history.unshift(ev); if (this.history.length > 12) this.history.length = 12;
    sim.state.lastBriefing = ev;
    g.onDepartmentEvent?.(ev);
  }

  // ---------------- scripts ----------------
  script(kind, ev) {
    const sim = this.sim; const C = 'captain', W = 'watch', F = 'chief', K = 'karen', H = 'hale';
    const open = sim.incidents.open().filter((i) => i.status !== 'completed');
    const wx = WEATHER_TYPES[sim.weather.current()]?.label.toLowerCase() || 'clear';
    const events = sim.state.events || [];
    const major = sim.incidents.list.filter((i) => i.severity === 'major').slice(-1)[0];
    const deputies = sim.units.list.filter((u) => u.dept === 'sheriff' || u.type === 'deputy').slice(0, 4);
    const bolo = open.find((i) => i.bolo || /vehicle|plate/i.test((i.details || []).join(' ')));
    const nov = new Date().getMonth() === 10;
    const L = [];
    const say = (who, text) => L.push({ who, text });
    if (kind === 'rollcall') {
      say(W, pick(['Alright, grab a seat, everybody. Let\'s get started.', 'Phones down, coffee up. Roll call.', 'Let\'s go, folks. Roll call.']));
      say(C, pick([`Good ${ev.id.endsWith('am') ? 'morning' : 'evening'}, everyone. Thanks for being here.`, `Evening, folks. ${LEADERS.captain.name}, for anybody new.`, 'Alright. Let\'s make this a good shift.']));
      say(C, `Here's where we stand: ${open.length ? `${open.length} open incident${open.length > 1 ? 's' : ''} on the board` : 'nothing open on the board right now'}, and the weather is ${wx}.${['rain', 'thunderstorms', 'snow', 'fog', 'severe weather'].includes(wx) ? ' Slow down out there and leave room on the county roads.' : ''}`);
      if (events.length) say(C, `Dispatch has ${events.length} active situation${events.length > 1 ? 's' : ''} affecting the roads: ${events.slice(0, 2).map((e) => e.title || e.label || e.kind.replace(/_/g, ' ')).join(', ')}. Plan your routes around it.`);
      if (major) say(C, `Good work on ${major.number} – the ${major.typeLabel.toLowerCase()}. ${pick(['That was a team effort from dispatch on up.', 'Dispatch kept everybody coordinated. Thank them when you see them.'])}`);
      if (deputies.length) say(C, `Assignments. ${deputies.map((u, i) => `${u.callsign}, ${DISTRICTS[i % DISTRICTS.length]}.`).join(' ')} Everybody else, float and back each other up.`);
      say(W, pick([
        `Updates from the watch: ${nov ? 'harvest\'s still going – watch for combines and grain trucks on IL-14 and IL-1 after dark' : 'watch for farm equipment on the state routes'}, and the deer are moving in the river bottoms.`,
        'Couple of updates: there\'s been catalytic converter thefts around Carmi and Norris City – check parked trucks on your patrol. And remember, county roads ice up first by the creeks.',
        `From the watch: ${bolo ? `be on the lookout tied to ${bolo.number} – check the CAD notes for the description.` : 'no BOLOs right now, but read the board before you head out.'} Keep your radios on the right talkgroup.`,
      ]));
      say(W, pick([`Range is open at 10:00 for anybody who still needs to qualify – see ${LEADERS.range.short}.`, 'Reports are due before end of shift. I mean it this time.', 'Body cams on, every contact. No exceptions.']));
      say(C, pick(['To our dispatchers on the floor – thank you. You\'re the first voice people hear. Alright, be safe, be kind, and come home.', 'That\'s it. Be safe, be kind, come home.', 'Look out for each other tonight. Let\'s go to work.']));
      return L;
    }
    if (kind === 'shift') {
      say(W, `Attention all personnel: shift change. ${open.length ? `Outgoing units, brief your relief on the ${open.length} open incident${open.length > 1 ? 's' : ''} before you go.` : 'The board is clear – good handoff.'}`);
      say(K, pick(['Dispatch, outgoing shift: finish your narratives and log out of the CAD. Incoming: welcome, the coffee is fresh.', 'Floor handoff is done. Thanks for a solid shift, everyone.']));
      return L;
    }
    if (kind === 'training') {
      say(H, 'Range is open for qualification. Eye and ear protection required, training firearms are signed out of the armory cage. Line is hot when I say it\'s hot.');
      say(W, 'Deputies who still need their annual qualification, get it done today. Dispatch, we\'ll keep you posted on who\'s out of service for training.');
      return L;
    }
    if (kind === 'meeting') {
      say(F, pick(['Bentley Allen here. Quick coordination with dispatch: mutual aid tenders from Wayne and Hamilton counties are on standby for the field fire season.', 'Fire and EMS coordination: we\'re short one ambulance crew this afternoon, so expect longer ETAs out of Grayville.']));
      say(F, pick([`Weather's ${wx} – ${wx === 'clear' ? 'dry fields mean fast-moving fires, so get us rolling early on smoke reports' : 'watch for wrecks and downed lines'}.`, 'And thank you for the great work on the radio this week. You make our job safer.']));
      say(C, 'Thanks, Chief. Dispatch, if Fire needs deputies for traffic control, send them – that\'s a standing order.');
      return L;
    }
    if (kind === 'supervisor') {
      say(K, `Supervisor update: ${open.length} open incident${open.length === 1 ? '' : 's'}, ${sim.calls.ringing().length} lines ringing, ${sim.units.counts().available} units available. ${open.length > 4 ? 'We\'re busy – prioritize your priority ones.' : 'Steady so far. Nice work.'}`);
      say(W, pick(['From the road side: units are reporting good radio traffic. Keep it up.', 'Reminder: when a unit asks for more resources, the request is on the incident – assign what they need.']));
      return L;
    }
    if (kind === 'announcement') {
      say(C, pick([
        'Department announcement: congratulations to the communications center on another month above the call-answering standard. That\'s all of you.',
        'Department announcement: the county fair is coming up and we\'ll need extra traffic coverage. The sign-up sheet is in the briefing room.',
        'Department announcement: please welcome our new trainees on the floor this week. Be patient, answer their questions, and remember your first week.',
        'Department announcement: the annual food drive is collecting at the front desk. Every can goes to the White County food pantry.',
        nov ? 'Department announcement: Thanksgiving potluck in the break room Thursday. The Watch Commander is bringing his famous chili, and that is not optional.' : 'Department announcement: new radio batteries arrived – swap your old ones in the charging rack.',
      ]));
      return L;
    }
    // briefing / mid-watch
    say(W, pick([
      `Night watch: ${open.length ? `${open.length} incident${open.length > 1 ? 's' : ''} still open` : 'board is clear'}, weather ${wx}. Bars let out at one – expect DUIs on IL-1 and IL-14.`,
      'Mid-watch check: everybody hydrate, swap seats if you need to stretch, and keep an eye on the river-bottom roads for deer.',
      `Watch update: ${deputies.length} deputies on the road. If anybody needs a break, tell your supervisor – we\'ll cover you.`,
    ]));
    return L;
  }
}

export { hhmm };
export const DEPARTMENT_TOWNS = TOWNS.map((t) => t.name);
