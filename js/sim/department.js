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
    const who = n.kind === 'rollcall' ? `${LEADERS.watch.short} runs it in the Police Department roll call room, with ${LEADERS.captain.short}` : n.kind === 'training' ? `${LEADERS.range.short} runs it at the range` : n.kind === 'meeting' ? `${LEADERS.fireChief.short} comes over for it in the PD conference room upstairs` : n.kind === 'briefing' ? `${LEADERS.watch.short} handles that one in the roll call room` : 'it comes over the PA';
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
      const am = ev.id ? ev.id.endsWith('am') : true;
      const officers = [['jake', 'Morrison'], ['ramsey', 'Ramsey'], ['tate', 'Tate'], ['lin', 'Lin']];
      // 1. welcome
      say(W, pick([`Alright, good ${am ? 'morning' : 'evening'}, everybody. Grab a seat. Welcome to ${am ? 'day' : 'night'} shift.`, `Okay, phones down, coffee up. Good ${am ? 'morning' : 'evening'} – let's get started.`, `Let's go, folks, have a seat. Good ${am ? 'morning' : 'evening'}.`]));
      // 2. attendance
      say(W, 'Roll call. Sergeant Vaughn.'); say('vaughn', pick(['Here.', 'Present.']));
      for (const [id, last] of officers) { say(W, `${last}.`); say(id, pick(['Here.', 'Here, sir.', 'Present.', 'Yep.'])); }
      // 3. department updates (Captain)
      say(C, pick([`Good ${am ? 'morning' : 'evening'}. Couple of department updates from upstairs.`, `Thanks, Lieutenant. Quick updates from the Chief's office.`, 'Morning, everyone. I\'ll keep this short.']));
      say(C, pick([
        'The new body-camera policy takes effect Monday. Cameras on before you arrive on scene, not when you get out of the car. Read the memo in your box.',
        'De-escalation in-service is upstairs in the training room this week. Everybody gets their eight hours by the end of the month – Nadia has the sign-up sheet.',
        'The Chief wants to thank everybody for the work at the fall festival. Zero incidents and a lot of happy kids. Good job.',
        'We have a new officer starting field training next week. Be patient, answer questions, and remember your first week.',
        nov ? 'Thanksgiving potluck is Thursday in the break room. The Watch Commander is bringing his chili. That is not optional.' : 'The new radio batteries came in – swap your old ones in the charger by the gun room.',
      ]));
      // 4. ongoing problems
      say(W, `Ongoing problems. ${pick(['Catalytic converter thefts are still hitting Carmi and Norris City – check parked trucks behind businesses after midnight.', 'We\'re getting speeding complaints on College Boulevard by the high school. I want a car sitting there at dismissal.', 'Mailbox thefts on the north side – the post office asked us for extra patrols on Robinson and Fair Street.', 'Somebody\'s been breaking into vehicles at the Supercenter lot. Walk it at least once a shift.'])}`);
      // 5. important incidents
      say(W, `${open.length ? `Dispatch has ${open.length} open incident${open.length > 1 ? 's' : ''} on the board right now.` : 'The board is clear right now – let\'s keep it that way.'}${major ? ` And good work on ${major.number}, the ${major.typeLabel.toLowerCase()} – dispatch had everybody coordinated.` : ''}${bolo ? ` BOLO tied to ${bolo.number}: read the CAD notes for the description before you head out.` : ''}`);
      // 6. questions from the room
      const q = pick([
        [['jake', 'Sarge, anything new on that stolen trailer out of Crossville?'], [W, 'Detectives think it went south on IL-1. Calloway has the case – if you see a flatbed with a fresh paint job, call it in.']],
        [['ramsey', 'Are we still doing the traffic detail on IL-14 this week?'], [W, 'Tuesday and Thursday, oh-seven-hundred to nine. Lin is lead on that.']],
        [['tate', 'Who has the evidence room key tonight? I\'ve got property to book.'], [W, 'Garrity\'s in until four. After that, the temp lockers by the evidence window.']],
        [['lin', 'Any word on the new radar units?'], [W, 'Two came in, they\'re being certified. Next week.']],
      ]); for (const [who, text] of q) say(who, text);
      // 7. patrol priorities
      say(W, `Patrol priorities: ${pick(['school zones at drop-off and dismissal', 'the courthouse square on foot at least twice', 'the bars on Main Street at closing'])}, ${pick(['traffic enforcement on IL-14 west of town', 'business checks in the industrial park', 'the river access by the boat ramp after dark'])}, and ${am ? 'be visible downtown around lunch' : 'watch for impaired drivers on IL-1 after midnight'}.`);
      // 8. assignments
      say(W, 'Assignments. Morrison, Beat 1, downtown and the square. Ramsey, Beat 2, north side and the high school. Tate, Beat 3, east of the river. Lin, traffic car. Sergeant Vaughn has the street.');
      // 9. staffing
      say(W, pick(['Staffing: we\'re down two on nights this week – the overtime sign-up is on my door.', 'Staffing: Pruitt is on vacation, so Vaughn is the only sergeant on days. Back her up.', 'Staffing: we\'re at minimums today. Nobody gets tied up on a report call for two hours – write it up and get back out.']));
      // 10. shift briefing
      say(W, `Shift briefing: weather is ${wx}.${['rain', 'thunderstorms', 'snow', 'fog', 'severe weather'].includes(wx) ? ' Slow down and leave room on the county roads.' : ''}${events.length ? ` Road issues: ${events.slice(0, 2).map((e) => e.title || e.label || e.kind.replace(/_/g, ' ')).join(', ')}.` : ''} ${nov ? 'Harvest is going – combines and grain trucks on IL-1 and IL-14 after dark.' : 'Watch for farm equipment on the state routes.'}`);
      say('vaughn', pick(['And reports are due before end of shift. I will find you.', 'One more thing – body cams on, every contact. No exceptions.', 'Range is open at ten if you still need to qualify. See Sergeant Hale.']));
      // 11. closing + dismissal
      say(C, pick(['To our dispatchers on the floor – thank you. You\'re the first voice people hear. Be safe out there.', 'Look out for each other. Be safe, be kind, come home.', 'That\'s all I have. Be safe.']));
      say(W, pick(['Alright, that\'s it. Hit the street.', 'That\'s it – go to work. Stay safe.', 'Dismissed. Let\'s have a good shift.']));
      L.assign = { jake: 'patrol', ramsey: 'patrol', tate: 'patrol', lin: 'patrol', vaughn: 'patrol', okafor_sgt: 'reports' };
      void deputies; void DISTRICTS;
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
