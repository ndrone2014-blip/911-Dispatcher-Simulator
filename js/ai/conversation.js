// Caller conversation engine with memory, persona, panic dynamics, address
// verification and pre-arrival instructions. Operates on plain call objects so
// conversations survive save/load.
import { understand, extractAddress, normalize } from './nlu.js';
import { SLOT_LINES, TALKATIVE_TANGENTS, PERSONAS, styled, line } from './dialogue.js';
import { fill, clamp } from '../core/util.js';

export const INTENT_SLOT = {
  ask_location: 'location', ask_cross: 'cross', ask_apt: 'apt', ask_what: 'nature', ask_injuries: 'injuries', ask_breathing: 'breathing',
  ask_conscious: 'conscious', ask_age: 'age', ask_history: 'history', ask_bleeding: 'bleeding', ask_weapons: 'weapons', ask_suspect: 'suspect',
  ask_vehicle: 'vehicle', ask_direction: 'direction', ask_when: 'when', ask_still: 'still', ask_name: 'name', ask_phone: 'phone', ask_safe: 'safe',
  ask_count: 'count', ask_fire: 'fire', ask_inside: 'inside', ask_hazards: 'hazards', ask_animal: 'animal', ask_blocking: 'blocking',
  ask_relation: 'relation', ask_drugs: 'drugs', ask_access: 'access', ask_lastseen: 'lastseen',
};

const INSTRUCTIONS = {
  instr_stayline: 'stayline', instr_away: 'away', instr_evac: 'evac', instr_cpr: 'cpr', instr_pressure: 'pressure',
  instr_position: 'position', instr_watch: 'watch', instr_light: 'light',
};

// Labels for the CAD info panel.
export const SLOT_LABELS = {
  location: 'Location', cross: 'Cross street', apt: 'Apt/Unit', nature: 'Nature', injuries: 'Injuries', breathing: 'Breathing', conscious: 'Conscious',
  age: 'Age', history: 'Medical history', bleeding: 'Bleeding', weapons: 'Weapons', suspect: 'Suspect', vehicle: 'Vehicle', direction: 'Direction',
  when: 'When', still: 'Still on scene', name: 'Caller name', phone: 'Callback', safe: 'Caller safe', count: 'Number involved', fire: 'Fire',
  inside: 'Persons inside', hazards: 'Hazards', animal: 'Animal', blocking: 'Roadway', relation: 'Relationship', drugs: 'Drugs/alcohol',
  access: 'Access', lastseen: 'Last seen',
};

export const QUESTION_TEXT = {
  location: 'What is the address of your emergency?', cross: 'What is the nearest cross street?', apt: 'Is there an apartment or unit number?',
  nature: 'Tell me exactly what happened.', injuries: 'Is anyone hurt?', breathing: 'Is the patient breathing?', conscious: 'Is the patient awake and responding to you?',
  age: 'How old is the patient?', history: 'Any medical history or medications?', bleeding: 'Is there any bleeding?', weapons: 'Are there any weapons involved?',
  suspect: 'Can you describe the person?', vehicle: 'Can you describe the vehicle?', direction: 'Which way did they go?', when: 'When did this happen?',
  still: 'Are they still there?', name: 'What is your name?', phone: 'What is a good callback number?', safe: 'Are you somewhere safe?',
  count: 'How many people are involved?', fire: 'What exactly is on fire?', inside: 'Is anyone still inside?', hazards: 'Are there any hazards, like gas or downed wires?',
  animal: 'Can you describe the animal?', blocking: 'Is it blocking traffic?', relation: 'How do you know the person?', drugs: 'Has there been any drinking or drug use?',
  access: 'How will responders get in?', lastseen: 'When and where were they last seen?',
};
export const INSTRUCTION_TEXT = {
  reassure: 'Help is on the way.', calm: 'Take a deep breath for me. You\'re doing great.', stayline: 'Stay on the line with me.',
  away: 'Stay away from them and keep yourself safe.', evac: 'Get everyone out of the building now.',
  cpr: 'I\'ll help you do CPR. Push hard and fast in the center of the chest.', pressure: 'Press firmly on the wound with a clean cloth.',
  position: 'Don\'t move them unless they\'re in danger.', watch: 'Keep watching and tell me if anything changes.',
  light: 'Turn on the porch light and unlock the door for responders.', else: 'Is there anything else I should know?', bye: 'Help is there now. I\'m going to let you go.',
};

export const SLOT_INTENT = Object.fromEntries(Object.entries(INTENT_SLOT).map(([k, v]) => [v, k]));

// Keyword understanding: a second opinion that catches plain-language questions the
// example-based classifier misses ("was the driver hurt?", "what color was it?").
const KEYWORDS = [
  ['location', /\b(address|where (are|is|was|were|did)|located|location|what street|which street|what road|you at|where exactly|what town|which town)\b/],
  ['cross', /\b(cross ?street|intersection|corner of|nearest street|between what|near what|landmark)\b/],
  ['apt', /\b(apartment|apt|unit|suite|floor|which door|room number)\b/],
  ['weapons', /\b(gun|guns|knife|knives|weapon|armed|shoot|shot|shots|firearm|rifle|pistol|bat|machete)\b/],
  ['bleeding', /\b(bleed|bleeding|blood|cut|wound)\b/],
  ['breathing', /\b(breath|breathing|breathe|airway|choking|chest rise|turning blue|blue lips)\b/],
  ['conscious', /\b(conscious|unconscious|awake|responsive|respond|responding|passed out|talking|alert|eyes open|wake)\b/],
  ['injuries', /\b(hurt|injur|injured|injuries|pain|wounded|okay|ok|alright|broken)\b/],
  ['age', /\b(how old|age|years old|elderly|child|baby|kid|adult)\b/],
  ['history', /\b(medical|history|medication|meds|diabet|heart|condition|seizure|allerg|pills|insulin|prescri)\b/],
  ['suspect', /\b(look like|looked like|describe (him|her|them|the person|the guy|the man|the woman)|wearing|clothes|clothing|tall|height|hair|race|build|male|female|suspect|guy|man|woman)\b/],
  ['vehicle', /\b(car|truck|van|vehicle|suv|plate|license|make|model|color|colour|motorcycle|tractor|semi)\b/],
  ['direction', /\b(which way|direction|heading|headed|went|go|gone|leave|left|flee|fled|took off|ran)\b/],
  ['when', /\b(when|how long ago|what time|how long has|how long have|started|start)\b/],
  ['still', /\b(still (there|here|around|on scene|at)|are they (there|still)|is (he|she|it) still|still going|still happening|can you (still )?see (him|her|them|it|the)|do you (still )?see (him|her|them)|in sight|watching (him|her|them))\b/],
  ['count', /\b(how many|number of (people|patients|cars|vehicles)|anyone else|more than one|other people)\b/],
  ['fire', /\b(fire|smoke|flames|burning|on fire|what.s burning|catching)\b/],
  ['inside', /\b(inside|in the (house|home|building|car|vehicle)|trapped|stuck|anyone in|people in|everyone out|left in)\b/],
  ['hazards', /\b(gas|wires|power lines|leak|leaking|fuel|chemical|hazard|danger|propane|smell)\b/],
  ['animal', /\b(dog|dogs|animal|cow|cows|cattle|horse|deer|pig|livestock|snake|bite|bit)\b/],
  ['blocking', /\b(blocking|blocked|in the road|lanes|traffic|lane|roadway|shoulder|ditch)\b/],
  ['relation', /\b(know (him|her|them)|related|relationship|husband|wife|boyfriend|girlfriend|neighbor|family|son|daughter|mother|father|friend)\b/],
  ['drugs', /\b(drink|drinking|drunk|alcohol|drugs|high|overdose|intoxicated|took something|substance)\b/],
  ['access', /\b(door|gate|locked|code|key|get in|unlock|entrance|access)\b/],
  ['lastseen', /\b(last seen|last saw|when did you see|missing since)\b/],
  ['name', /\b(your name|who am i speaking|who is this|who.?s calling|who are you|what.?s your name|who.?s this)\b/],
  ['phone', /\b(phone number|callback|call you back|reach you|number you.re)\b/],
  ['safe', /\b(are you safe|you okay|are you ok|you alright|somewhere safe|in danger)\b/],
  ['nature', /\b(what happened|what.s going on|what is going on|what.s wrong|what do you see|tell me (more|what)|explain|describe what|what.s the emergency|what is the emergency)\b/],
];
const STATUS_RE = /\b(how (is|are|'?s) (he|she|they|the patient|it|everyone|things|everything)( doing)?( now)?|is (he|she|it|everyone|everybody) (okay|ok|alright|still)|any (change|changes)|getting (worse|better)|what('?s| is) (happening|going on) now|right now|update me|status)\b/;
const QUESTION_RE = /^(what|where|when|who|whom|why|how|which|is|are|was|were|do|does|did|can|could|will|would|has|have|had|any|should|you)\b/;
const COMMAND_RE = /^(please |ok(ay)? |now |i need you to |i want you to |can you |could you )?(go|get|stay|don'?t|do not|keep|make|tell|check|look|lock|unlock|open|close|turn|put|move|hold|wait|try|grab|find|leave|stop|let|bring|step|walk|listen|watch|sit|lay|lie|roll|cover|shut|count|push|press|breathe|calm|answer|go ahead|head|send|ask|wave|flag)\b/;
// short follow-ups that only make sense with the previous question
const FOLLOWUP = [
  [/^(what )?(color|colour|make|model|kind of (car|truck|vehicle)|plate)\b/, 'vehicle'],
  [/^(how bad|how serious|how much blood|where (is|are) (he|she|they) (hurt|bleeding))/, 'injuries'],
  [/^(where (did|are) (they|he|she) go|which way)/, 'direction'],
  [/^(and )?(what about|how about) (him|her|them|the other|the driver|the kids|the other car)/, 'injuries'],
  [/^(is (he|she|it) still|still)/, 'still'],
];

export function newConvo(sc) {
  const p = PERSONAS[sc.caller.persona] || PERSONAS.calm;
  const panic = clamp(p.panic + (sc.severity === 'major' ? 0.15 : sc.severity === 'small' ? -0.08 : 0), 0, 1);
  return { panic, startPanic: panic, asked: {}, revealed: {}, said: [], turns: 0, lastCaller: '', instructions: [], verified: false,
    cpr: false, updatesDone: [], extraIdx: 0, lastSpontaneous: 0, ended: false, unitsArrivedSaid: false, calmed: false };
}

function ctxOf(call) {
  const sc = call.sc;
  return { ...sc.loc, address: sc.loc.full, ...sc.vars, name: sc.caller.name, first: sc.caller.first, phone: sc.caller.phone, nature: sc.nature };
}

function factOf(sc, slot) {
  const f = sc.facts?.[slot];
  if (f === undefined || f === null) return null;
  if (typeof f === 'string') return { say: f, note: f };
  return f;
}

/** Caller's first words after the dispatcher answers. */
export function openingLine(call, r) {
  const sc = call.sc; const c = call.convo;
  const text = fill(sc.opening || sc.nature, ctxOf(call), r);
  c.asked.nature = 1; c.revealed.nature = true;
  if (sc.revealOnOpen) for (const s of sc.revealOnOpen) c.revealed[s] = true;
  return styled(text, sc.caller.persona, r, { panic: c.panic, first: true });
}

/** Answer for one slot. Returns { text, note } */
function answerSlot(call, slot, r) {
  const sc = call.sc; const c = call.convo; const ctx = ctxOf(call); const loc = sc.loc;
  const accuracy = (PERSONAS[sc.caller.persona] || PERSONAS.calm).accuracy;
  switch (slot) {
    case 'location': {
      if (sc.kind === 'misdial' && !sc.facts?.location) return { text: 'Oh, I\'m at home, but there\'s no emergency, really.', note: null };
      const firstAsk = !c.asked.location;
      if (firstAsk && c.panic > 0.7 && r.chance(0.55 * (2 - accuracy)) && loc.kind === 'street') {
        c.revealed.location_partial = true;
        return { text: line('location_partial', ctx, r), note: `${loc.street} (number unknown)`, partial: true };
      }
      if (loc.kind === 'highway') return { text: line('location_highway', { ...ctx, dir: loc.dir || 'northbound' }, r), note: `${loc.full}${loc.dir && !loc.full.includes(loc.dir) ? ` (${loc.dir})` : ''}` };
      if (loc.kind === 'water') return { text: line('location_water', ctx, r), note: loc.full };
      if (sc.locVague) return { text: line('location_vague', ctx, r), note: `${loc.street} near ${loc.cross} (number unknown)` };
      if (loc.poi && r.chance(0.5)) return { text: line('location_poi', ctx, r), note: `${loc.full} (${loc.poi})` };
      return { text: line('location', ctx, r), note: loc.full };
    }
    case 'cross': return { text: line('cross', ctx, r), note: loc.cross };
    case 'apt': return loc.apt ? { text: line('apt', ctx, r), note: loc.apt } : { text: line('apt_none', ctx, r), note: 'None' };
    case 'name': return { text: line('name', ctx, r), note: sc.caller.name };
    case 'phone': return { text: line('phone', ctx, r), note: sc.caller.phone };
    case 'safe': {
      const f = factOf(sc, 'safe');
      if (f) return { text: fill(f.say, ctx, r), note: f.note };
      return { text: line('safe_yes', ctx, r), note: 'Caller safe' };
    }
    case 'nature': return { text: fill(sc.natureShort || sc.nature, ctx, r), note: fill(sc.natureNote || sc.nature, ctx, r) };
    default: {
      let f = factOf(sc, slot);
      // no fact for this exact question, but a closely related one answers it ("is he bleeding?" → the injuries fact)
      const RELATED = { bleeding: 'injuries', injuries: 'bleeding', count: 'inside', inside: 'count', direction: 'still', conscious: 'injuries', vehicle: 'suspect', suspect: 'vehicle' };
      if (!f && RELATED[slot] && factOf(sc, RELATED[slot]) && factOf(sc, RELATED[slot]).say !== 'unknown') {
        const rf = factOf(sc, RELATED[slot]); const rel = fill(rf.say, ctx, r);
        if (!(slot === 'bleeding' && !/blood|bleed|cut|lac/i.test(rel)) && !(slot === 'conscious' && !/awake|talk|conscious|respond|moving|moan/i.test(rel))) f = rf;
      }
      if (!f) {
        const medical = !!(sc.facts?.breathing || sc.facts?.conscious);
        const none = { weapons: 'none_weapons', injuries: 'none_injuries', suspect: medical ? 'none_suspect' : 'none_suspect_look', vehicle: 'none_vehicle', hazards: 'none_hazards', fire: 'none_fire',
          breathing: 'none_patient', conscious: 'none_patient', age: 'none_patient', history: 'none_patient', bleeding: 'none_injuries', direction: 'none_direction',
          when: 'none_when', still: 'none_still', count: 'none_count', inside: 'none_inside', animal: 'none_animal', blocking: 'none_blocking', relation: 'none_relation',
          drugs: 'none_drugs', access: 'none_access', lastseen: 'none_lastseen' }[slot] || 'none_generic';
        return { text: line(none, ctx, r), note: slot === 'weapons' ? 'None seen' : slot === 'injuries' ? 'None reported' : null };
      }
      if (f.say === 'unknown') return { text: line('unknown', ctx, r), note: 'Unknown' };
      return { text: fill(f.say, ctx, r), note: f.note ? fill(f.note, ctx, r) : null };
    }
  }
}

/** Which slot a sentence is really asking about, from keywords (relevant slots win). */
export function keywordSlot(text, sc, prev) {
  const t = ` ${normalize(text)} `;
  const relevant = new Set([...(sc.relevant || []), ...Object.keys(sc.facts || {})]);
  let best = null, bs = 0;
  for (const [slot, re] of KEYWORDS) {
    const m = t.match(re); if (!m) continue;
    let score = 1 + m[0].length / 40;
    if (relevant.has(slot)) score += 1.2;
    if (slot === 'injuries' && /\b(okay|ok|alright)\b/.test(m[0]) && !/hurt|injur/.test(t)) score -= 0.8; // "is he okay" leans on status
    if (slot === prev) score += 0.3;
    if (score > bs) { bs = score; best = slot; }
  }
  return best;
}
function followUpSlot(text, prev) {
  if (!prev) return null; const t = normalize(text);
  if (t.split(' ').length > 7) return null;
  for (const [re, slot] of FOLLOWUP) if (re.test(t)) return slot === 'still' || slot === 'direction' ? slot : prev === 'suspect' && slot === 'vehicle' ? 'vehicle' : slot;
  if (/^(and|what about|how about|anything|any) /.test(t) || /^(why|how come|really|are you sure|how do you know)\b/.test(t)) return prev;
  return null;
}

/** Answer to "how is he doing now?" from the most relevant current facts. */
function statusAnswer(call, r) {
  const sc = call.sc; const ctx = ctxOf(call);
  for (const slot of ['conscious', 'breathing', 'fire', 'bleeding', 'still', 'injuries', 'blocking']) {
    const f = factOf(sc, slot); if (!f || f.say === 'unknown') continue;
    const txt = fill(f.say, ctx, r); const pre = line('status_prefix', ctx, r);
    return { slot, text: pre ? pre + txt.charAt(0).toLowerCase() + txt.slice(1) : txt, note: f.note ? fill(f.note, ctx, r) : null };
  }
  return { slot: null, text: line('status_none', ctx, r) };
}

function gracefulReply(call, text, r) {
  const sc = call.sc; const c = call.convo; const t = normalize(text); const ctx = ctxOf(call);
  const isCmd = COMMAND_RE.test(t) && !/\?\s*$/.test(text);
  const isQ = !isCmd && (/\?\s*$/.test(text) || QUESTION_RE.test(t));
  if (isCmd) { c.panic = clamp(c.panic - 0.05, 0, 1); return line(r.chance(0.3) ? 'comply_done' : 'comply', ctx, r); }
  if (isQ) {
    if (c.panic > 0.7) return line('unknown_q_panicked', ctx, r);
    const natureLow = fill(sc.natureShort || sc.nature, ctx, r).replace(/[.!]+$/, '');
    return r.chance(0.35) ? line('unknown_q_nature', { ...ctx, natureLow: natureLow.charAt(0).toLowerCase() + natureLow.slice(1) }, r) : line('unknown_q', ctx, r);
  }
  return line('ack', ctx, r);
}

function recordInfo(call, slot, note) {
  if (!note) return;
  call.info[slot] = note;
}

/**
 * Process the dispatcher's words. Returns { lines: [callerText], intents, effects }
 */
export function respond(call, text, r) {
  const sc = call.sc; const c = call.convo; const ctx = ctxOf(call);
  const out = []; const effects = { revealed: [], instructions: [], verified: false, end: false };
  c.turns++;
  c.panic = clamp(c.panic - 0.01, 0, 1);
  const norm = normalize(text);

  // Address read-back ("so that's 1423 Main Street?")
  const addr = extractAddress(text);
  let intents = understand(text);
  const looksLikeReadback = (addr.street || (addr.number && addr.number >= 100)) && !intents.some((i) => ['ask_location', 'reassure', 'instr_evac', 'instr_away'].includes(i.intent) && i.score > 1.1);
  if (looksLikeReadback && sc.loc.kind === 'street') {
    const okStreet = !addr.street || addr.street === sc.loc.street;
    const okNum = !addr.number || addr.number === sc.loc.number || sc.locVague;
    if (okStreet && okNum && (addr.street || addr.number)) {
      out.push(styled(line('confirm_yes', ctx, r), sc.caller.persona, r, { panic: c.panic, allowPost: false }));
      if (addr.street && (addr.number || sc.locVague)) { c.verified = true; effects.verified = true; }
      c.revealed.location = true; recordInfo(call, 'location', sc.loc.full); effects.revealed.push('location');
    } else {
      out.push(styled(line('confirm_no', ctx, r), sc.caller.persona, r, { panic: c.panic }));
      c.revealed.location = true; recordInfo(call, 'location', sc.loc.full); effects.revealed.push('location');
    }
    c.asked.location = (c.asked.location || 0) + 1;
    intents = intents.filter((i) => !['confirm_location', 'unknown', 'yes', 'no', 'ask_location'].includes(i.intent));
  } else if (looksLikeReadback && addr.street) {
    out.push(styled(line('confirm_yes', ctx, r), sc.caller.persona, r, { panic: c.panic, allowPost: false }));
    c.verified = true; effects.verified = true; c.revealed.location = true; recordInfo(call, 'location', sc.loc.full);
    intents = intents.filter((i) => !['confirm_location', 'unknown', 'yes', 'no', 'ask_location'].includes(i.intent));
  }

  for (const it of intents) {
    let intent = it.intent;
    // "How is he doing now?" → current status from the scenario
    // weak or off-topic classifications defer to strong keyword evidence ("can you see him right now?")
    if (['confirm_location', 'yes', 'no', 'greet', 'smalltalk', 'thanks'].includes(intent) || (it.score < 0.55 && intent !== 'unknown')) {
      const hasAddr = addr.street || (addr.number && addr.number >= 100);
      const ks = !hasAddr && keywordSlot(it.text || text, sc, c.lastSlot);
      if (ks && SLOT_INTENT[ks] && normalize(it.text || text).split(' ').length >= 3) intent = SLOT_INTENT[ks];
    }
    if ((intent === 'unknown' || it.score < 0.6) && STATUS_RE.test(normalize(it.text || text)) && c.turns > 1) {
      const st = statusAnswer(call, r); if (st.slot) { recordInfo(call, st.slot, st.note); c.lastSlot = st.slot; }
      out.push(styled(st.text, sc.caller.persona, r, { panic: c.panic })); continue;
    }
    // Plain-language understanding: follow-ups that lean on the previous question, then keywords
    if (intent === 'unknown' || intent === 'yes' || intent === 'no') {
      const fs = followUpSlot(it.text || text, c.lastSlot) || ((intent === 'unknown') ? keywordSlot(it.text || text, sc, c.lastSlot) : null);
      if (fs && SLOT_INTENT[fs]) intent = SLOT_INTENT[fs];
    } else if (INTENT_SLOT[intent] && !factOf(sc, INTENT_SLOT[intent]) && !['location', 'cross', 'apt', 'name', 'phone', 'nature', 'safe'].includes(INTENT_SLOT[intent])) {
      // the classifier picked a slot this call has nothing for – do the words point at one it does?
      const ks = keywordSlot(it.text || text, sc, c.lastSlot);
      if (ks && ks !== INTENT_SLOT[intent] && (factOf(sc, ks) || ['location', 'cross', 'name', 'phone', 'safe', 'nature'].includes(ks))) intent = SLOT_INTENT[ks];
    }
    // context fallback: an inapplicable slot may really mean an alternative intent
    const slot0 = INTENT_SLOT[intent];
    if (slot0 && !['location', 'cross', 'apt', 'name', 'phone', 'nature', 'safe'].includes(slot0) && !factOf(sc, slot0)) {
      const alt = (it.alternatives || []).find((a) => a.score > 0.4 && a.score >= it.score * 0.85 && INTENT_SLOT[a.intent] && factOf(sc, INTENT_SLOT[a.intent]));
      if (alt) intent = alt.intent;
    }
    const slot = INTENT_SLOT[intent];
    if (slot) {
      const already = c.asked[slot] && c.revealed[slot];
      const ans = answerSlot(call, slot, r);
      let txt = ans.text;
      if (already && slot !== 'location' && c.asked[slot] >= 1) {
        const irritated = ['upset', 'panicked', 'worried'].includes(sc.caller.persona) || c.asked[slot] >= 2;
        txt = irritated ? fill(SLOT_LINES.repeat_irritated, { answer: /^(I\b|I'|[A-Z][a-z]+ [A-Z])/.test(txt) ? txt : txt.charAt(0).toLowerCase() + txt.slice(1) }, r) : txt;
        c.panic = clamp(c.panic + 0.03, 0, 1);
      } else if (already && slot === 'location' && c.asked.location >= 2 && !c.revealed.location_partial) {
        txt = fill(['Yes — {address}.', 'It\'s {address}, like I said.', 'Still {address}.'], ctx, r);
      }
      c.asked[slot] = (c.asked[slot] || 0) + 1;
      if (!ans.partial) { c.revealed[slot] = true; effects.revealed.push(slot); }
      if (slot === 'location' && !ans.partial) delete c.revealed.location_partial;
      recordInfo(call, slot, ans.note);
      c.lastSlot = slot;
      out.push(styled(txt, sc.caller.persona, r, { panic: c.panic }));
      continue;
    }
    if (INSTRUCTIONS[intent]) {
      const key = INSTRUCTIONS[intent];
      const custom = sc.instructions?.[key];
      let txt; let valid = true;
      if (key === 'cpr') {
        const needs = sc.facts?.breathing && /not breathing|isn.t breathing|no pulse|gasping/i.test(factOf(sc, 'breathing').say);
        if (needs || sc.cpr) { txt = custom ? fill(custom, ctx, r) : line('cpr_start', ctx, r); c.cpr = true; }
        else { txt = line('cpr_na', ctx, r); valid = false; }
      } else if (key === 'evac') {
        if (sc.instructions?.evac || sc.facts?.fire || sc.facts?.hazards) txt = custom ? fill(custom, ctx, r) : line('evac', ctx, r);
        else { txt = line('evac_na', ctx, r); valid = false; }
      } else if (key === 'pressure') {
        if (sc.facts?.bleeding || sc.instructions?.pressure) txt = custom ? fill(custom, ctx, r) : line('pressure', ctx, r);
        else { txt = line('pressure_na', ctx, r); valid = false; }
      } else txt = custom ? fill(custom, ctx, r) : line(key, ctx, r);
      if (valid && !c.instructions.includes(key)) { c.instructions.push(key); effects.instructions.push(key); }
      c.panic = clamp(c.panic - (valid ? 0.09 : 0.02), 0, 1);
      out.push(styled(txt, sc.caller.persona, r, { panic: c.panic, allowPost: false }));
      continue;
    }
    switch (intent) {
      case 'greet':
        out.push(styled(line('greet_again', { ...ctx, nature: fill(sc.natureShort || sc.nature, ctx, r) }, r), sc.caller.persona, r, { panic: c.panic })); break;
      case 'reassure':
        c.panic = clamp(c.panic - 0.18, 0, 1);
        out.push(styled(line(c.panic < 0.3 ? 'reassure_calm' : 'reassure', ctx, r), sc.caller.persona, r, { panic: c.panic, allowPost: false }));
        if (!c.instructions.includes('reassure')) c.instructions.push('reassure');
        break;
      case 'calm':
        c.panic = clamp(c.panic - 0.16, 0, 1);
        out.push(styled(line('calm', ctx, r), sc.caller.persona, r, { panic: c.panic, allowPost: false })); break;
      case 'ask_else': {
        const extra = (sc.extra || [])[c.extraIdx];
        if (extra) { c.extraIdx++; out.push(styled(fill(extra, ctx, r), sc.caller.persona, r, { panic: c.panic })); call.info.notes = call.info.notes || []; call.info.notes.push(fill(extra, ctx, r)); }
        else out.push(styled(line('else_none', ctx, r), sc.caller.persona, r, { panic: c.panic, allowPost: false }));
        break;
      }
      case 'ask_repeat': out.push(c.lastCaller || line('dont_understand', ctx, r)); break;
      case 'ask_spell': {
        const target = sc.loc.street || sc.caller.name;
        const word = target.split(' ')[0];
        out.push(line('spell', { spelled: word.toUpperCase().split('').join('-') }, r)); break;
      }
      case 'thanks': out.push(styled(line('thanks', ctx, r), sc.caller.persona, r, { panic: c.panic, allowPost: false })); break;
      case 'bye':
        out.push(styled(line(call.incidentId ? 'bye' : 'bye_waiting', ctx, r), sc.caller.persona, r, { panic: c.panic, allowPost: false }));
        effects.end = true; break;
      case 'smalltalk': out.push(styled(line('smalltalk', ctx, r), sc.caller.persona, r, { panic: c.panic })); break;
      case 'confirm_location':
        out.push(styled(line('confirm_yes', ctx, r) + ` ${sc.loc.full}.`, sc.caller.persona, r, { panic: c.panic }));
        c.revealed.location = true; recordInfo(call, 'location', sc.loc.full); break;
      case 'yes': out.push(line('yes_generic', ctx, r)); break;
      case 'no': out.push(line('no_generic', ctx, r)); break;
      case 'unknown':
      default: {
        // Respond like a person would: answer "I don't know" to questions, go along with
        // instructions, acknowledge statements. Only gibberish gets "what?".
        const words = normalize(it.text || text).split(' ').filter(Boolean);
        if (words.length >= 2 && !out.length) { out.push(styled(gracefulReply(call, it.text || text, r), sc.caller.persona, r, { panic: c.panic, allowPost: false })); break; }
        c.panic = clamp(c.panic + 0.03, 0, 1);
        if (!out.length) out.push(styled(line(c.panic > 0.65 ? 'dont_understand_panicked' : 'dont_understand', ctx, r), sc.caller.persona, r, { panic: c.panic, allowPost: false }));
        break;
      }
    }
  }
  if (!out.length) out.push(line('dont_understand', ctx, r));

  // Talkative callers volunteer extra details or tangents.
  const verbose = (PERSONAS[sc.caller.persona] || PERSONAS.calm).verbose;
  if (verbose >= 0.9 && r.chance(0.35)) {
    const extra = (sc.extra || [])[c.extraIdx];
    if (extra && r.chance(0.6)) { c.extraIdx++; out.push(fill(extra, ctx, r)); (call.info.notes ||= []).push(fill(extra, ctx, r)); }
    else out.push(r.pick(TALKATIVE_TANGENTS));
  }
  if (c.startPanic >= 0.5 && c.panic < 0.32 && !c.calmed) { c.calmed = true; effects.calmed = true; }
  const joined = out.join(' ');
  c.lastCaller = joined; c.said.push(joined); if (c.said.length > 12) c.said.shift();
  return { lines: [joined], intents: intents.map((i) => i.intent), effects };
}

/** Spontaneous caller speech (scenario updates, CPR counting, impatience). */
export function spontaneous(call, secondsSinceAnswer, r) {
  const sc = call.sc; const c = call.convo; const ctx = ctxOf(call);
  if (c.ended) return null;
  for (let i = 0; i < (sc.updates || []).length; i++) {
    const u = sc.updates[i];
    if (!c.updatesDone.includes(i) && secondsSinceAnswer >= u.after) {
      c.updatesDone.push(i);
      if (u.reveal) for (const [k, v] of Object.entries(u.reveal)) { sc.facts[k] = v; }
      if (u.panic) c.panic = clamp(c.panic + u.panic, 0, 1);
      const txt = styled(fill(u.line, ctx, r), sc.caller.persona, r, { panic: c.panic });
      c.lastCaller = txt; c.lastSpontaneous = secondsSinceAnswer;
      if (u.note) (call.info.notes ||= []).push(fill(u.note, ctx, r));
      return txt;
    }
  }
  if (c.cpr && secondsSinceAnswer - c.lastSpontaneous > 14) { c.lastSpontaneous = secondsSinceAnswer; return line('cpr_continue', ctx, r); }
  if (c.panic > 0.55 && secondsSinceAnswer - Math.max(c.lastSpontaneous, 20) > 38 && r.chance(0.5)) {
    c.lastSpontaneous = secondsSinceAnswer;
    return styled(line('wait_ask', ctx, r), sc.caller.persona, r, { panic: c.panic, allowPost: false });
  }
  return null;
}

/** Context-aware suggested questions/instructions for the fallback UI. */
export function suggestions(call) {
  const sc = call.sc; const c = call.convo; const out = [];
  const add = (key, text, kind = 'ask', priority = 5) => out.push({ key, text, kind, priority });
  if (!c.revealed.location) add('location', QUESTION_TEXT.location, 'ask', 0);
  else if (!c.verified && sc.loc.kind === 'street') add('verify', `Let me confirm: ${call.info.location || 'that address'}?`, 'verify', 1);
  if (!c.asked.cross && sc.loc.kind !== 'water') add('cross', QUESTION_TEXT.cross, 'ask', 3);
  if (!c.asked.nature) add('nature', QUESTION_TEXT.nature, 'ask', 1);
  const relevant = sc.relevant || Object.keys(sc.facts || {});
  const order = ['injuries', 'breathing', 'conscious', 'weapons', 'fire', 'inside', 'suspect', 'vehicle', 'direction', 'still', 'hazards', 'count', 'bleeding',
    'age', 'history', 'when', 'animal', 'blocking', 'relation', 'drugs', 'lastseen', 'access', 'safe'];
  let p = 2;
  for (const slot of order) if (relevant.includes(slot) && !c.asked[slot]) add(slot, QUESTION_TEXT[slot], 'ask', p++);
  if (!['injuries'].some((s) => c.asked[s]) && !relevant.includes('injuries') && sc.kind === 'emergency') add('injuries', QUESTION_TEXT.injuries, 'ask', 6);
  if (!c.asked.name) add('name', QUESTION_TEXT.name, 'ask', 8);
  if (!c.asked.phone) add('phone', QUESTION_TEXT.phone, 'ask', 9);
  if (!c.asked.apt && sc.loc.apt) add('apt', QUESTION_TEXT.apt, 'ask', 4);
  for (const key of Object.keys(sc.instructions || {})) if (!c.instructions.includes(key) && INSTRUCTION_TEXT[key]) add(key, INSTRUCTION_TEXT[key], 'instruct', 3);
  if (!c.instructions.includes('reassure')) add('reassure', INSTRUCTION_TEXT.reassure, 'instruct', call.incidentId ? 2 : 7);
  if (c.panic > 0.5) add('calm', INSTRUCTION_TEXT.calm, 'instruct', 3);
  if (!c.instructions.includes('stayline') && sc.severity !== 'small') add('stayline', INSTRUCTION_TEXT.stayline, 'instruct', 8);
  if ((sc.extra || []).length > c.extraIdx) add('else', INSTRUCTION_TEXT.else, 'ask', 10);
  if (call.incidentId) add('bye', INSTRUCTION_TEXT.bye, 'end', 12);
  return out.sort((a, b) => a.priority - b.priority).slice(0, 10);
}
