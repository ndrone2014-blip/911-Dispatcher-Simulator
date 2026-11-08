// Conversations with dispatch-center staff and visiting personnel.
import { classifyWith } from './nlu.js';
import { RANKS } from '../sim/career.js';
import { WEATHER_TYPES } from '../sim/weather.js';
import { rng, fill } from '../core/util.js';

export const STAFF = [
  { id: 'maria', name: 'Maria Delgado', role: 'Senior Dispatcher', sex: 'f', pitch: 1.02, rate: 1.0, personality: 'warm, patient mentor with 14 years on the floor', desk: 1, kind: 'dispatcher' },
  { id: 'tyler', name: 'Tyler Brooks', role: 'Junior Dispatcher', sex: 'm', pitch: 1.05, rate: 1.1, personality: 'nervous but funny, plays video games, drinks too much energy drink', desk: 3, kind: 'dispatcher' },
  { id: 'denise', name: 'Denise Okafor', role: 'Fire/EMS Dispatcher', sex: 'f', pitch: 0.98, rate: 0.98, personality: 'calm, precise, former paramedic', desk: 4, kind: 'dispatcher' },
  { id: 'ray', name: 'Ray Kowalski', role: 'Veteran Dispatcher', sex: 'm', pitch: 0.85, rate: 0.95, personality: 'gruff 28-year veteran with dry humor and a soft heart', desk: 5, kind: 'dispatcher', extra: true },
  { id: 'priya', name: 'Priya Natarajan', role: 'Dispatcher', sex: 'f', pitch: 1.05, rate: 1.05, personality: 'upbeat, organized, color-codes everything', desk: 6, kind: 'dispatcher', extra: true },
  { id: 'karen', name: 'Karen Whitfield', role: 'Shift Supervisor', sex: 'f', pitch: 0.95, rate: 1.0, personality: 'no-nonsense but fair supervisor who protects her people', kind: 'supervisor' },
  { id: 'marcus', name: 'Marcus Reyes', role: 'Training Officer', sex: 'm', pitch: 0.95, rate: 0.98, personality: 'enthusiastic teacher who loves explaining things', kind: 'trainer' },
  { id: 'helen', name: 'Helen Park', role: 'Communications Director', sex: 'f', pitch: 0.97, rate: 0.95, personality: 'thoughtful leader focused on her team\'s growth', kind: 'director' },
  { id: 'jake', name: 'Officer Jake Morrison', role: 'Carmi PD (visiting)', sex: 'm', pitch: 0.9, rate: 1.0, personality: 'friendly patrol cop grabbing coffee between calls', kind: 'visitor', dept: 'police' },
  { id: 'lou', name: 'Captain Lou Bennett', role: 'Carmi FD (visiting)', sex: 'm', pitch: 0.82, rate: 0.92, personality: 'big-hearted fire captain who tells long stories', kind: 'visitor', dept: 'fire' },
  { id: 'sam', name: 'Paramedic Sam Ortiz', role: 'White County Ambulance (visiting)', sex: 'f', pitch: 1.0, rate: 1.05, personality: 'quick-witted medic, dark humor, loves the dispatchers', kind: 'visitor', dept: 'ems' },
];

const DEFS = {
  greet: { ex: ['hello', 'hi there', 'hey', 'good morning', 'good evening', 'what is up', 'yo'], re: [/^(hi|hey|hello|yo|good (morning|afternoon|evening)|sup|howdy)\b/] },
  how: { ex: ['how are you', 'how is it going', 'how are you doing', 'how is your day', 'you doing okay', 'how is your shift'], re: [/how (are|is|have) (you|it|your)|how.s it going|you (doing )?ok/] },
  who: { ex: ['who are you', 'what is your name', 'introduce yourself', 'i do not think we have met', 'nice to meet you'], re: [/who are you|your name|nice to meet|introduce/] },
  job: { ex: ['what do you do', 'what is your job', 'what is your role', 'how long have you worked here', 'do you like your job', 'why did you become a dispatcher'], re: [/what do you do|your (job|role)|how long have you|like (your|this) job|become a dispatcher/] },
  tips: { ex: ['any tips', 'do you have any advice', 'how do i get better', 'teach me something', 'what should i know', 'any advice for a new dispatcher', 'help me out', 'how do i do this'], re: [/tips?\b|advice|get better|teach me|what should i know|how do i/] },
  status: { ex: ['how busy are we', 'what is going on', 'what is the status', 'how are we doing', 'anything i should know about', 'what is happening out there', 'how is the floor'], re: [/how busy|status|how are we doing|what.s happening|going on out there|how.s the floor|workload/] },
  breakreq: { ex: ['can i take a break', 'i need a break', 'can i go on break', 'cover me for a bit', 'i want to take five', 'can someone cover my calls'], re: [/break|take five|cover (me|my)|step away/] },
  endbreak: { ex: ['i am back from break', 'i am ready to work', 'end my break', 'back to work'], re: [/back from break|ready to work|end (my )?break|back to work/] },
  promotion: { ex: ['how is my career going', 'am i getting promoted', 'what is my rank', 'how do i get promoted', 'how am i doing', 'my performance', 'when is my next promotion'], re: [/promot|rank|career|how am i doing|performance|raise/] },
  joke: { ex: ['tell me a joke', 'say something funny', 'make me laugh', 'got any jokes'], re: [/joke|funny|make me laugh/] },
  weather: { ex: ['how is the weather', 'is it raining', 'what is it like outside', 'nice day today'], re: [/weather|raining|snowing|outside like/] },
  coffee: { ex: ['want some coffee', 'where is the coffee', 'is the coffee fresh', 'i need caffeine'], re: [/coffee|caffeine|espresso|energy drink/] },
  food: { ex: ['are you hungry', 'what is for lunch', 'did you eat', 'want to order food', 'any snacks'], re: [/hungry|lunch|dinner|eat|food|snack|pizza/] },
  story: { ex: ['tell me a story', 'what is the craziest call you ever had', 'any good stories', 'worst call you have had', 'tell me about a memorable call'], re: [/story|craziest|worst call|memorable|wildest/] },
  delegate: { ex: ['can you take a call for me', 'can you handle that incident', 'can you dispatch something for me', 'help me with my pending calls', 'take one of my incidents'], re: [/take (a|that|one of my|this) (call|incident)|handle (that|this|one)|dispatch (something|one) for me|pending calls/] },
  city: { ex: ['tell me about the city', 'what is carmi like', 'tell me about white county', 'where is the hospital', 'which neighborhoods are rough', 'tell me about the area'], re: [/city|carmi|white county|county|neighborhood|hospital|area|district/] },
  departments: { ex: ['who handles what', 'which units should i send', 'what departments do we have', 'what does swat do', 'when do i send hazmat', 'what units should go to a fire'], re: [/department|which units|what units|who handles|swat|hazmat|k-?9|send to a/] },
  thanks: { ex: ['thank you', 'thanks', 'appreciate it', 'thanks for the help'], re: [/^(thanks|thank you|appreciate|cheers)/] },
  compliment: { ex: ['you are great', 'nice job', 'you are awesome', 'good work today'], re: [/(you.re|you are) (great|awesome|the best)|nice job|good work/] },
  bye: { ex: ['bye', 'see you later', 'talk to you later', 'i have to get back to work', 'later', 'gotta go'], re: [/\b(bye|see you|talk (to you )?later|gotta go|get back to work|later)\b/] },
};

const L = {
  greet: { _: ['Hey there.', 'Hi! Good to see you.', 'Oh, hey!', 'Hey, how\'s it going?'], ray: ['Hey, kid.', 'Mm. Morning. Or whatever time it is.'], tyler: ['Oh hey! What\'s up?', 'Heyyy. You want an energy drink? I have like six.'], karen: ['Hello. Everything okay at your console?'], helen: ['Hello! Nice to see you on the floor.'] },
  how: { _: ['Doing alright, thanks for asking.', 'Hanging in there. You?', 'Not bad! Busy, but good.'], ray: ['I\'ve been doing this twenty-eight years. I\'m always "fine."', 'My back hurts and the coffee\'s burnt. So, normal.'], tyler: ['Honestly? My heart\'s still racing from that last call. But good!'], sam: ['Living the dream. Smells like diesel and hospital food, but living it.'], lou: ['Can\'t complain! Well, I can, but nobody listens.'] },
  who: { _: ['I\'m {name}, {role}.', '{name}. I\'m the {role} here.'], ray: ['Ray Kowalski. I\'ve been here since the radios were the size of refrigerators.'], helen: ['I\'m Helen Park, the Communications Director. My door\'s always open.'], jake: ['Jake Morrison, Carmi PD. I work nights mostly, west side of town.'], lou: ['Lou Bennett, Captain with Carmi Fire. Been on the job twenty-two years.'], sam: ['Sam Ortiz, paramedic on Medic 12. Your voice is the one that sends me places!'] },
  job: { _: ['I answer calls and keep everybody safe. Best job I\'ve ever had, and the hardest.', 'I love it. You\'re the first first responder, you know?'], ray: ['I came here for six months while I looked for something better. That was 1998.'], tyler: ['Six months in. Still learning. Maria says I\'m doing okay.'], denise: ['I was a paramedic for nine years. Now I send the paramedics. It\'s a different kind of pressure.'], karen: ['I keep the floor running, make sure everyone gets breaks, and catch what falls through the cracks.'], marcus: ['I train new dispatchers. Watching someone handle their first big call calmly? Best feeling.'], helen: ['I run the center – budgets, staffing, equipment, and making sure people like you grow.'] },
  bye: { _: ['Talk to you later.', 'Good luck out there.', 'See you around.', 'Go get \'em.'], ray: ['Don\'t let the phones bite.'], tyler: ['Later! Don\'t forget to hydrate!'], karen: ['Head back to your console when you\'re ready.'] },
  thanks: { _: ['Anytime.', 'No problem.', 'Of course!', 'You got it.'] },
  compliment: { _: ['Aw, thanks. You\'re doing great too.', 'That means a lot, seriously.'], ray: ['Don\'t tell anyone. I have a reputation.'] },
  joke: { _: ['Why did the dispatcher bring a ladder to work? To reach the higher-priority calls.', 'I asked a firefighter what his favorite day is. He said Fire-day.', 'What\'s a paramedic\'s favorite candy? Life Savers.', 'Our radio system is like my ex – loud, unreliable, and somehow still on my belt.'], tyler: ['Why do programmers mix up Halloween and Christmas? Because OCT 31 equals DEC 25. ...Nobody laughs at that one.'], ray: ['A guy once called 911 because his pizza delivery was late. That\'s not a joke. That\'s Tuesday.'] },
  coffee: { _: ['The coffee machine in the break room is... functional.', 'There\'s a fresh pot in the break room I think.'], tyler: ['Coffee is for amateurs. *cracks energy drink*'], ray: ['Whoever made that last pot owes me an apology.'], lou: ['Firehouse coffee is better. Don\'t tell your director.'] },
  food: { _: ['Somebody brought donuts earlier. They\'re probably gone.', 'I could go for a tenderloin from the Main Street Diner right now.'], sam: ['I ate a granola bar in the ambulance going sixty. That counts as lunch.'], lou: ['Station 1 is doing chili tonight. You\'re all invited.'] },
  story: {
    _: ['I once had a lady call because a squirrel was "staring at her aggressively." I sent animal control. The squirrel won.', 'Had a guy call from inside a locked porta-potty that got knocked over. Fire got him out. He was very polite about it.'],
    ray: ['Blizzard of \'09. Forty-one calls in an hour, half the roads closed, and the power went out in the building. We dispatched by flashlight. Nobody died that night. That\'s the job.'],
    maria: ['My first cardiac arrest call, I talked a teenage girl through CPR on her grandfather for nine minutes. He walked out of the hospital two weeks later. She sends me a card every year.'],
    lou: ['We had a warehouse fire on Irving Ave, three alarms. Dispatch kept every company coordinated through the whole thing. Never once lost track of a crew. You guys don\'t get enough credit.'],
    sam: ['Delivered a baby in the back of Medic 12 on the IL-14 shoulder outside Enfield. The parents named him after the dispatcher. True story.'],
    jake: ['I chased a guy on foot for six blocks and dispatch had K-9 and the helicopter waiting at the end before I even asked. That\'s when I realized you guys are basically wizards.'],
  },
  city: { _: ['Carmi is the county seat – the courthouse square, Main Street is IL-14 and IL-1 through town, and the Little Wabash runs right along the east side. Everything east of the river takes a minute longer.', 'White County is big and rural. Grayville up by I-64, Norris City and Enfield on US-45, Crossville out east on IL-14 and IL-1. A run from Carmi to Grayville is twenty minutes, so pick the closest units.', 'Carmi Township Hospital takes most of our patients. Real bad trauma goes to Deaconess in Evansville – that\'s a long drive, think about LifeFlight.', 'Watch out in harvest season: grain trucks, combines on the highway, and grain bin calls. And this is oil country – a tank battery fire or an H2S leak is no joke.'] },
  departments: { _: ['Rule of thumb: fires get engines, a ladder, a chief and an ambulance. Crashes with injuries get police, an engine and EMS. But it\'s your call – I\'ve seen people pull SWAT for a barricaded guy and it was the right move.', 'Look at the Recommended units in the assign window. They\'re just suggestions, though – you know the situation better than the computer.', 'Specialty units are precious. Don\'t burn your only HazMat truck on a gas odor unless it\'s bad.'] },
};

const TIPS = [
  'Always get the address first, then read it back to the caller. If you dispatch to the wrong address, units lose time finding the real scene.',
  'The ANI/ALI line on a call shows the phone\'s location. Landlines give a registered address – but the caller might be reporting something down the street!',
  'Callers panic. Tell them help is on the way and give them something to do – it calms them down and they give better information.',
  'You don\'t have to finish the conversation before dispatching. Create the incident, send units, then keep gathering info.',
  'Watch the radio. When a unit requests more resources, the request shows up on the incident – assign what they ask for.',
  'Multiple calls about the same thing? Use "Link to incident" instead of making duplicates.',
  'Big incidents: assign a supervisor or battalion chief. Command units make everyone on scene more effective.',
  'If a unit is busy and you really need it, the availability override in Settings lets you pull it anyway.',
  'Use the BOLO button on incidents with a suspect or vehicle description – patrol units might spot them.',
  'For medical calls, ask if the patient is awake and breathing. If they\'re not breathing, coach CPR – it matters.',
  'You can talk to units on the radio – ask for status, ETA, or if they need anything else.',
  'Take breaks. Talk to your supervisor and someone will cover the phones while you get coffee.',
];

export class StaffDialogue {
  constructor(game) { this.game = game; this.memory = {}; }

  npc(id) { return STAFF.find((s) => s.id === id); }

  opener(npc) {
    const sim = this.game.sim; const m = this.mem(npc);
    m.talks = (m.talks || 0) + 1;
    if (m.talks > 1) return rng.pick([`Back again? What's up?`, 'Hey, what do you need?', 'Yeah?']);
    if (npc.kind === 'supervisor' && sim) return `Hey. ${this.statusLine(npc)} Need anything?`;
    if (npc.kind === 'visitor') return rng.pick(['Hey! Just grabbing a coffee before I head back out.', 'Oh, hey! You\'re the one who sends us all over town, huh?']);
    return fill(rng.pick(L.greet[npc.id] || L.greet._), npc);
  }

  mem(npc) { return (this.memory[npc.id] ||= { asked: {} }); }

  statusLine() {
    const sim = this.game.sim; if (!sim) return 'It\'s quiet right now.';
    const open = sim.incidents.open().filter((i) => i.status !== 'completed');
    const awaiting = open.filter((i) => !i.units.length);
    const ringing = sim.calls.ringing().length;
    const c = sim.units.counts();
    const parts = [];
    parts.push(open.length ? `We've got ${open.length} open incident${open.length > 1 ? 's' : ''}` : 'No open incidents right now');
    if (awaiting.length) parts.push(`${awaiting.length} still need units`);
    if (ringing) parts.push(`${ringing} line${ringing > 1 ? 's' : ''} ringing`);
    parts.push(`${c.available} of ${c.total} units available`);
    return `${parts.join(', ')}.`;
  }

  /** Returns { text, action } */
  reply(npc, text) {
    const g = this.game; const sim = g.sim; const m = this.mem(npc);
    const { intent } = classifyWith(DEFS, text);
    m.asked[intent] = (m.asked[intent] || 0) + 1;
    const pick = (key) => fill(rng.pick((L[key] && (L[key][npc.id] || L[key]._)) || ['Hm.']), npc);
    switch (intent) {
      case 'greet': return { text: pick('greet') };
      case 'how': return { text: pick('how') };
      case 'who': return { text: pick('who') };
      case 'job': return { text: pick('job') };
      case 'bye': return { text: pick('bye'), action: 'end' };
      case 'thanks': return { text: pick('thanks') };
      case 'compliment': return { text: pick('compliment') };
      case 'joke': return { text: pick('joke') };
      case 'coffee': return { text: pick('coffee') };
      case 'food': return { text: pick('food') };
      case 'story': return { text: pick('story') };
      case 'city': return { text: pick('city') };
      case 'departments': return { text: pick('departments') };
      case 'weather': {
        const w = sim ? WEATHER_TYPES[sim.weather.current()].label.toLowerCase() : 'clear';
        return { text: rng.pick([`Looks like ${w} out there. ${w.includes('snow') || w.includes('storm') || w.includes('severe') ? 'Expect the phones to light up.' : 'Could be worse.'}`, `It's ${w}. Weather changes everything in this job.`]) };
      }
      case 'tips': {
        const i = (m.tipIdx = ((m.tipIdx ?? rng.int(0, TIPS.length - 1)) + 1) % TIPS.length);
        const lead = npc.kind === 'trainer' ? 'Great question! ' : npc.id === 'ray' ? 'Here\'s one for free. ' : '';
        return { text: lead + TIPS[i] };
      }
      case 'status': {
        if (!sim) return { text: 'Nothing going on yet.' };
        let t = this.statusLine();
        const req = sim.incidents.open().find((i) => i.requests.length);
        if (req) t += ` ${req.number} has an open resource request.`;
        return { text: npc.kind === 'supervisor' ? t : `Last I checked: ${t}` };
      }
      case 'breakreq': {
        if (npc.kind !== 'supervisor') return { text: 'You\'d have to ask Karen, she approves breaks. Her office is off the main floor.' };
        if (sim?.onBreak) return { text: 'You\'re already on break. Enjoy it.' };
        const open = sim ? sim.incidents.open().filter((i) => i.priority === 1 && i.status !== 'completed').length : 0;
        if (open >= 3) return { text: 'Things are a little hot right now with three priority ones. Give it a few minutes, then ask me again.' };
        return { text: 'Go ahead, take a break. I\'ll have the others cover new calls. Just come back to your console when you\'re ready.', action: 'break' };
      }
      case 'endbreak': return sim?.onBreak ? { text: 'Welcome back. Phones are yours again.', action: 'endbreak' } : { text: 'You\'re not on break – but thanks for the enthusiasm.' };
      case 'promotion': {
        const car = g.career; const r = car.rank(); const nx = car.nextRank(); const d = car.data;
        if (npc.kind !== 'director' && npc.kind !== 'supervisor') return { text: `You'd want to talk to Helen about that. But between us, you're doing fine.` };
        if (!nx) return { text: `You're the Communications Director. There's nowhere up from here – except maybe my parking spot.` };
        const needXP = Math.max(0, nx.xp - d.xp), needShifts = Math.max(0, nx.shifts - d.shifts);
        return { text: `You're a ${r.name} with ${d.xp} experience and ${d.shifts} completed shift${d.shifts === 1 ? '' : 's'}. For ${nx.name} you need ${needXP ? `${needXP} more experience` : 'no more experience'}${needShifts ? ` and ${needShifts} more completed career shift${needShifts > 1 ? 's' : ''}` : ''}. Careful questioning, verified addresses and good resource matches all count.` };
      }
      case 'delegate': {
        if (npc.kind !== 'dispatcher' && npc.kind !== 'supervisor') return { text: 'Ha, I don\'t think I\'m allowed on your console.' };
        if (!g.career.has('delegation', sim?.state.mode)) return { text: 'Once you\'re a Senior Dispatcher you can hand calls off to us. Keep at it!' };
        const res = delegate(sim, npc);
        return res ? { text: `Sure, I'll take ${res.number}. I've got units going on it.`, action: 'delegated' } : { text: 'You don\'t have anything waiting for units right now. Nice work.' };
      }
      default:
        return { text: rng.pick(['Hm, not sure what you mean.', 'Sorry, say that again?', 'Ha, okay.', 'I\'m not sure about that one. Ask me for tips, the status, or a story.']) };
    }
  }
}

/** A coworker dispatches one pending incident using the recommendations. */
export function delegate(sim, npc) {
  if (!sim) return null;
  const pending = sim.incidents.open().filter((i) => !i.units.length && i.status !== 'completed').sort((a, b) => b.priority - a.priority);
  const inc = pending[0]; if (!inc) return null;
  const units = sim.incidents.recommendations(inc).map((r) => r.unit);
  if (!units.length) return null;
  sim.units.assign(units, inc.id);
  inc.delegatedTo = npc.name;
  sim.incidents.addHistory(inc, `Dispatched by ${npc.name} (delegated)`);
  return inc;
}

export { RANKS };
