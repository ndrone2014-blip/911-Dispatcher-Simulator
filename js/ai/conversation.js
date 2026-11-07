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
      if (loc.kind === 'highway') return { text: line('location_highway', { ...ctx, dir: loc.dir || 'northbound' }, r), note: `${loc.full}${loc.dir ? ` (${loc.dir})` : ''}` };
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
      const f = factOf(sc, slot);
      if (!f) {
        const none = { weapons: 'none_weapons', injuries: 'none_injuries', suspect: 'none_suspect', vehicle: 'none_vehicle', hazards: 'none_hazards', fire: 'none_fire',
          breathing: 'none_patient', conscious: 'none_patient', age: 'none_patient', history: 'none_patient', bleeding: 'none_injuries', direction: 'none_vehicle' }[slot] || 'none_generic';
        return { text: line(none, ctx, r), note: slot === 'weapons' ? 'None seen' : slot === 'injuries' ? 'None reported' : null };
      }
      if (f.say === 'unknown') return { text: line('unknown', ctx, r), note: 'Unknown' };
      return { text: fill(f.say, ctx, r), note: f.note ? fill(f.note, ctx, r) : null };
    }
  }
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
    // context fallback: an inapplicable slot may really mean an alternative intent
    const slot0 = INTENT_SLOT[intent];
    if (slot0 && !['location', 'cross', 'apt', 'name', 'phone', 'nature', 'safe'].includes(slot0) && !factOf(sc, slot0)) {
      const alt = (it.alternatives || []).find((a) => a.score > 0.4 && INTENT_SLOT[a.intent] && factOf(sc, INTENT_SLOT[a.intent]));
      if (alt) intent = alt.intent;
    }
    const slot = INTENT_SLOT[intent];
    if (slot) {
      const already = c.asked[slot] && c.revealed[slot];
      const ans = answerSlot(call, slot, r);
      let txt = ans.text;
      if (already && slot !== 'location' && c.asked[slot] >= 1) {
        const irritated = ['upset', 'panicked', 'worried'].includes(sc.caller.persona) || c.asked[slot] >= 2;
        txt = irritated ? fill(SLOT_LINES.repeat_irritated, { answer: txt.charAt(0).toLowerCase() + txt.slice(1) }, r) : txt;
        c.panic = clamp(c.panic + 0.03, 0, 1);
      } else if (already && slot === 'location' && c.asked.location >= 2 && !c.revealed.location_partial) {
        txt = fill(['Yes — {address}.', 'It\'s {address}, like I said.', 'Still {address}.'], ctx, r);
      }
      c.asked[slot] = (c.asked[slot] || 0) + 1;
      if (!ans.partial) { c.revealed[slot] = true; effects.revealed.push(slot); }
      if (slot === 'location' && !ans.partial) delete c.revealed.location_partial;
      recordInfo(call, slot, ans.note);
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
      default:
        c.panic = clamp(c.panic + 0.03, 0, 1);
        if (!out.length) out.push(styled(line(c.panic > 0.65 ? 'dont_understand_panicked' : 'dont_understand', ctx, r), sc.caller.persona, r, { panic: c.panic, allowPost: false }));
        break;
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
