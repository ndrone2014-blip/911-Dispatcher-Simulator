// Local natural-language understanding for dispatcher speech.
// Approach: normalization → concept canonicalization (synonyms) → fuzzy token
// matching → similarity against example phrasings + regex cues → ranked intents.
// It recognizes MANY ways of asking the same thing, but it is not a full language
// model: unusual phrasings can still be misunderstood (the UI always offers
// suggested questions as a fallback).
import { levenshtein } from '../core/util.js';
import { STREET_WORDS, NS_STREETS, EW_STREETS } from '../data/city.js';

const CONTRACTIONS = {
  "what's": 'what is', "where's": 'where is', "who's": 'who is', "how's": 'how is', "it's": 'it is', "he's": 'he is', "she's": 'she is',
  "that's": 'that is', "there's": 'there is', "they're": 'they are', "you're": 'you are', "we're": 'we are', "i'm": 'i am', "i've": 'i have',
  "you've": 'you have', "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not',
  "can't": 'can not', "cannot": 'can not', "won't": 'will not', "couldn't": 'could not', "shouldn't": 'should not', "i'll": 'i will', "you'll": 'you will',
  "we'll": 'we will', "they'll": 'they will', "let's": 'let us', "y'all": 'you all', 'gonna': 'going to', 'wanna': 'want to', 'gotta': 'got to',
  "ya": 'you', 'u': 'you', 'r': 'are', 'ur': 'your', 'pls': 'please', 'plz': 'please', 'addy': 'address', 'ppl': 'people', 'ok': 'okay', 'k': 'okay',
};

// concept -> words. Multi-word phrases are matched before single tokens.
const CONCEPTS = {
  LOC: ['address', 'location', 'located', 'whereabouts', 'where', 'place', 'spot', 'position', 'area', 'street', 'road', 'block'],
  CROSS: ['cross street', 'cross', 'intersection', 'corner', 'nearest street', 'closest street', 'near what', 'landmark', 'nearby'],
  APT: ['apartment', 'unit', 'apt', 'suite', 'floor', 'room number', 'building number'],
  HURT: ['hurt', 'injured', 'injury', 'injuries', 'wounded', 'harmed', 'pain', 'bleeding', 'blood', 'okay physically'],
  BREATH: ['breathe', 'breathing', 'breath', 'breaths', 'air', 'chest rising'],
  CONSC: ['conscious', 'awake', 'responsive', 'responding', 'unconscious', 'passed out', 'alert', 'talking', 'eyes open', 'wake up', 'respond to you'],
  WEAPON: ['weapon', 'weapons', 'gun', 'guns', 'knife', 'knives', 'armed', 'firearm', 'pistol', 'rifle', 'shotgun', 'blade', 'bat'],
  VEH: ['car', 'vehicle', 'truck', 'van', 'suv', 'automobile', 'motorcycle', 'plate', 'license plate', 'make and model', 'drive', 'driving', 'driven'],
  DESC: ['describe', 'description', 'look like', 'looks like', 'wearing', 'clothes', 'clothing', 'shirt', 'tall', 'height', 'hair', 'build', 'what did he look', 'what did she look'],
  NAME: ['name', 'called', 'who am i speaking', 'who am i talking', 'who is this', 'who is calling'],
  PHONE: ['phone number', 'callback', 'call back', 'phone', 'number to reach', 'reach you', 'cell number', 'contact number'],
  HAPPEN: ['happened', 'happening', 'going on', 'emergency', 'problem', 'situation', 'wrong', 'matter', 'the issue', 'what is up', 'tell me more', 'explain'],
  WHEN: ['when', 'how long ago', 'what time', 'how long has', 'minutes ago', 'start', 'started', 'begin'],
  DIR: ['direction', 'which way', 'where did they go', 'where did he go', 'where did she go', 'headed', 'heading', 'went', 'fled', 'run off', 'take off', 'took off', 'left toward'],
  STILL: ['still there', 'still here', 'still around', 'still on scene', 'still inside', 'still at', 'left yet', 'gone now'],
  SAFE: ['safe', 'somewhere safe', 'in danger', 'are you okay', 'you alright', 'you all right', 'are you hurt'],
  COUNT: ['how many', 'number of', 'how much', 'count'],
  PEOPLE: ['people', 'persons', 'person', 'individuals', 'guys', 'suspects', 'victims', 'patients', 'involved', 'anyone else', 'kids', 'children'],
  FIRE: ['fire', 'flames', 'burning', 'smoke', 'smoking', 'on fire', 'blaze', 'flame'],
  INSIDE: ['inside', 'in the house', 'in the building', 'trapped', 'still in', 'in there', 'everyone out', 'everybody out', 'anyone in'],
  HAZ: ['hazard', 'hazards', 'gas', 'chemical', 'chemicals', 'leak', 'leaking', 'fumes', 'smell', 'odor', 'power lines', 'wires', 'fuel', 'danger'],
  AGE: ['age', 'how old', 'years old', 'old is'],
  HIST: ['history', 'medical history', 'conditions', 'medical condition', 'medications', 'medication', 'meds', 'heart problems', 'diabetic', 'allergies', 'health problems'],
  BLEED: ['bleeding', 'blood', 'bleed'],
  ANIMAL: ['dog', 'cat', 'animal', 'breed', 'pet', 'raccoon', 'deer', 'snake', 'coyote', 'bird', 'horse'],
  BLOCK: ['blocking', 'blocked', 'in the road', 'lanes', 'traffic moving', 'in the lane', 'obstructing', 'lane'],
  RELATION: ['relationship', 'related', 'who is he to you', 'who is she to you', 'do you know him', 'do you know her', 'do you know them', 'know the person', 'husband', 'wife', 'boyfriend', 'girlfriend', 'neighbor'],
  DRUGS: ['drinking', 'drunk', 'alcohol', 'drugs', 'high', 'taken anything', 'take anything', 'intoxicated', 'pills', 'substances', 'using'],
  ACCESS: ['get in', 'gate code', 'door code', 'door unlocked', 'unlock', 'locked', 'access', 'way in', 'front door', 'buzz'],
  LASTSEEN: ['last seen', 'last saw', 'saw them last', 'see him last', 'see her last', 'when did you last'],
  HELP: ['help is on the way', 'on the way', 'on their way', 'coming', 'en route', 'sending', 'dispatched', 'units are', 'officers are', 'ambulance is', 'firefighters are', 'help is coming', 'be there', 'responding'],
  CALM: ['calm down', 'stay calm', 'deep breath', 'take a breath', 'relax', 'breathe for me', 'slow down', 'it will be okay', 'it is going to be okay', 'you are doing great', 'doing a good job', 'you are doing well'],
  STAYLINE: ['stay on the line', 'stay on the phone', 'do not hang up', 'stay with me', 'keep the line open', 'hold on the line'],
  AWAY: ['stay away', 'do not approach', 'do not go near', 'keep your distance', 'lock the door', 'lock your door', 'stay inside', 'stay in your', 'hide', 'get somewhere safe', 'go somewhere safe', 'do not confront', 'stay where you are', 'get to a safe'],
  EVAC: ['get out', 'leave the house', 'leave the building', 'evacuate', 'get everyone out', 'get outside', 'exit the', 'leave now', 'go outside', 'move away from'],
  CPR: ['cpr', 'compressions', 'push on the chest', 'push hard', 'pump the chest', 'chest compressions', 'center of the chest', 'push down'],
  PRESSURE: ['apply pressure', 'put pressure', 'press on', 'hold a towel', 'clean cloth', 'towel on', 'cover the wound', 'hold pressure'],
  POSITION: ['on his side', 'on her side', 'on their side', 'recovery position', 'do not move him', 'do not move her', 'do not move them', 'lay him', 'lay her', 'keep him still', 'keep her still', 'tilt the head', 'flat on'],
  WATCH: ['keep an eye', 'watch them', 'let me know if', 'tell me if', 'watch where', 'keep watching', 'tell me when', 'if anything changes'],
  LIGHT: ['porch light', 'turn on the lights', 'unlock the front', 'open the door', 'wave them down', 'flag them down', 'meet them', 'put the dog away', 'secure the dog', 'put away any pets'],
  REPEAT: ['say again', 'repeat', 'come again', 'did not catch', 'did not hear', 'say that again', 'pardon', 'one more time', 'what did you say', 'sorry what'],
  SPELL: ['spell', 'spelling', 'spelled'],
  ELSE: ['anything else', 'anything more', 'something else', 'else i should know', 'else going on', 'any other', 'what else'],
  BYE: ['goodbye', 'bye', 'hang up', 'let you go', 'end the call', 'disconnect', 'take care', 'have a good', 'we are done'],
  THANKS: ['thank you', 'thanks', 'appreciate'],
  GREET: ['911 what is your emergency', 'what is your emergency', 'nine one one', '911', 'emergency services', 'hello', 'hi', 'dispatch'],
  YES: ['yes', 'yeah', 'yep', 'correct', 'right', 'affirmative', 'sure', 'uh huh'],
  NO: ['no', 'nope', 'negative', 'nah', 'not'],
  SEE: ['see', 'look', 'seeing', 'watching', 'notice'],
  SMALLTALK: ['how are you', 'how is your day', 'nice weather', 'who are you', 'are you real', 'are you a robot'],
};

// Intents with example phrasings (canonicalized at load) + regex cues.
const INTENTS = {
  greet: { ex: ['911 what is your emergency', 'what is your emergency', 'hello 911', 'nine one one what is the address of your emergency'], re: [/^(hello|hi|911|nine one one)\b/, /what is (the|your) emergency/] },
  ask_location: { ex: ['where are you', 'what is your location', 'what is the address', 'can you tell me where this happened', 'what address are you at', 'where is this', 'where is the emergency', 'where are you located', 'what is the address of your emergency', 'where did this happen', 'where is he', 'where are they', 'what street are you on', 'tell me the address'],
    re: [/\bwhere\b.*\b(you|this|it|happen|emergency|incident|located|at|they|he|she)\b/, /\baddress\b/, /\blocation\b/, /what street/] },
  ask_cross: { ex: ['what is the cross street', 'what is the nearest intersection', 'what are you near', 'what is the closest cross street', 'any landmarks nearby', 'what corner are you on', 'nearest cross street'], re: [/cross ?street/, /intersection/, /landmark/] },
  ask_apt: { ex: ['what apartment number', 'what unit are you in', 'which floor', 'is there an apartment number'], re: [/apartment|\bunit\b|\bapt\b|which floor/] },
  ask_what: { ex: ['what happened', 'tell me what happened', 'what is going on', 'what is the problem', 'what is happening', 'tell me exactly what happened', 'explain what is going on', 'what is wrong', 'what kind of emergency', 'what do you see', 'okay tell me more'],
    re: [/what('?s| is| was)? (happen|going on|the problem|wrong|the matter|the situation)/, /tell me (exactly )?what/] },
  ask_injuries: { ex: ['is anyone hurt', 'is anybody injured', 'are there any injuries', 'does anyone need an ambulance', 'is anyone bleeding', 'is anybody hurt', 'anyone injured', 'are they hurt', 'is he hurt', 'is she hurt', 'do you need medical'], re: [/(hurt|injur|wounded|ambulance|medical)/] },
  ask_breathing: { ex: ['is he breathing', 'is she breathing', 'are they breathing', 'is the patient breathing', 'can he breathe', 'is his chest rising', 'how is the breathing', 'is the baby breathing'], re: [/breath/] },
  ask_conscious: { ex: ['is he conscious', 'is she awake', 'is he awake', 'are they responsive', 'is the patient conscious', 'is he talking to you', 'can she talk', 'is he alert', 'does he respond to you', 'are their eyes open', 'is she responding'], re: [/conscious|awake|responsive|responding to you|talking to you|eyes open/] },
  ask_age: { ex: ['how old is he', 'how old is she', 'what is his age', 'what is the patient age', 'how old are they', 'about how old'], re: [/how old|\bage\b/] },
  ask_history: { ex: ['does he have any medical history', 'any medical conditions', 'is she on any medications', 'does he have heart problems', 'is he diabetic', 'any allergies', 'any health problems'], re: [/history|medication|\bmeds\b|condition|diabet|allerg/] },
  ask_bleeding: { ex: ['is he bleeding', 'is there a lot of blood', 'where is the bleeding', 'is she bleeding badly', 'how bad is the bleeding'], re: [/bleed|blood/] },
  ask_weapons: { ex: ['does he have a weapon', 'are there any weapons', 'is anyone armed', 'did you see a gun', 'does she have a knife', 'is he armed', 'any weapons involved', 'what kind of weapon'], re: [/weapon|\bgun\b|knife|armed|firearm|pistol|rifle/] },
  ask_suspect: { ex: ['what does he look like', 'can you describe him', 'can you describe the person', 'what is he wearing', 'what was she wearing', 'describe the suspect', 'what did they look like', 'give me a description', 'can you describe them'], re: [/describ|look(ed)? like|wearing|description/] },
  ask_vehicle: { ex: ['what kind of car', 'can you describe the vehicle', 'what color was the car', 'did you get a license plate', 'what are they driving', 'make and model', 'did they have a car', 'what kind of vehicle', 'what color is the truck'], re: [/\b(car|vehicle|truck|van|suv|plate|driving|motorcycle)\b/] },
  ask_direction: { ex: ['which way did they go', 'what direction did he go', 'where did they run', 'which direction were they heading', 'where did he go', 'did you see where she went', 'what direction'], re: [/which way|direction|where did (he|she|they) (go|run|head)|headed|heading/] },
  ask_when: { ex: ['when did this happen', 'how long ago', 'when did it start', 'what time did this happen', 'how long has this been going on', 'how long has he been like this'], re: [/\bwhen\b|how long|what time/] },
  ask_still: { ex: ['are they still there', 'is he still there', 'is the suspect still on scene', 'are they gone', 'did they leave', 'is he still around'], re: [/(he|she|they|suspect|subject|guy|car)\b.{0,12}still (there|here|on scene|around)|did (they|he|she) leave|are they gone/] },
  ask_name: { ex: ['what is your name', 'who am i speaking with', 'can i get your name', 'who is this', 'may i have your name', 'what is your first and last name', 'who am i talking to'], re: [/your name|who am i (speaking|talking)|who is this|who is calling/] },
  ask_phone: { ex: ['what is your phone number', 'what is your callback number', 'what number can i reach you at', 'is this a good number to call you back', 'what is the number you are calling from', 'can i get a callback number'], re: [/phone|call ?back|number (to reach|can i reach)|reach you/] },
  ask_safe: { ex: ['are you safe', 'are you somewhere safe', 'are you in danger', 'are you okay', 'are you hurt', 'are you alright', 'is everyone safe'], re: [/are you (safe|okay|ok|alright|all right|hurt|in danger)|somewhere safe/] },
  ask_count: { ex: ['how many people', 'how many people are involved', 'how many suspects', 'how many victims', 'how many cars are involved', 'how many vehicles', 'how many of them', 'is anyone else with you', 'how many patients'], re: [/how many/] },
  ask_fire: { ex: ['what is on fire', 'can you see flames', 'is there smoke', 'what is burning', 'how big is the fire', 'where is the fire', 'what color is the smoke', 'is the fire spreading'], re: [/\b(fire|flame|smoke|burning|blaze)\b/] },
  ask_inside: { ex: ['is anyone inside', 'is anyone still in the house', 'is anyone still inside', 'is everyone out', 'is anyone trapped', 'is anybody in the building', 'is there anyone in there', 'are there people inside'], re: [/(anyone|anybody|someone|people|everyone|everybody)\b.{0,10}(inside|in there|trapped|in the (house|building|car|home))|everyone out|everybody out|trapped/] },
  ask_hazards: { ex: ['are there any hazards', 'do you smell gas', 'are there wires down', 'is anything leaking', 'are there chemicals', 'is there fuel leaking', 'any dangers'], re: [/hazard|gas|chemical|leak|fumes|odor|smell|wires|power lines|fuel/] },
  ask_animal: { ex: ['what kind of animal', 'what kind of dog', 'what breed is it', 'describe the animal', 'is the dog aggressive', 'how big is the dog'], re: [/animal|\bdog\b|breed|\bcat\b|raccoon|coyote|snake|deer/] },
  ask_blocking: { ex: ['is it blocking traffic', 'are the cars in the road', 'is it blocking the lanes', 'is traffic getting by', 'is it in the roadway'], re: [/block|in the road|lanes?\b|traffic (getting|moving)/] },
  ask_relation: { ex: ['who is he to you', 'how do you know him', 'do you know the person', 'is he your husband', 'what is your relationship', 'are you related', 'do you know them'], re: [/relation|related|know (him|her|them|the person)|who is (he|she) to you/] },
  ask_drugs: { ex: ['has he been drinking', 'has she taken anything', 'is he on drugs', 'has he had any alcohol', 'did they take any pills', 'are they intoxicated'], re: [/drink|drunk|alcohol|drugs|high\b|taken anything|pills|intoxicated/] },
  ask_access: { ex: ['how do we get in', 'is the door unlocked', 'is there a gate code', 'is there a code to get in', 'can you unlock the door', 'how do officers get inside'], re: [/get in(side)?|gate code|door code|unlocked|access/] },
  ask_lastseen: { ex: ['when did you last see them', 'when was he last seen', 'where was she last seen', 'when did you see him last', 'what were they last wearing'], re: [/last (seen|saw)|see (him|her|them) last/] },
  ask_else: { ex: ['is there anything else', 'anything else i should know', 'is there anything else going on', 'what else can you tell me', 'any other information'], re: [/anything else|what else|any other/] },
  confirm_location: { ex: ['is that correct', 'did i get that right', 'let me confirm the address'], re: [/^(so|okay|ok)?\s*(that is|it is|you are at|you said|confirm(ing)?)\b.*\d/, /\bconfirm\b/] },
  reassure: { ex: ['help is on the way', 'units are on their way', 'officers are coming', 'an ambulance is on the way', 'firefighters are coming', 'i have help coming', 'they are on their way', 'police are en route', 'i am sending help'], re: [/(help|units?|officers?|police|ambulance|medics?|paramedics?|fire ?fighters?|fire department|deputies|someone) (is |are )?(on (the|their|its) way|coming|en route|responding|headed)/, /sending (help|someone|units|officers)/] },
  calm: { ex: ['i need you to stay calm', 'take a deep breath', 'calm down for me', 'you are doing great', 'slow down', 'it is going to be okay', 'relax'], re: [/calm|deep breath|slow down|doing (great|good|well)|going to be (okay|ok|alright)|relax/] },
  instr_stayline: { ex: ['stay on the line with me', 'do not hang up', 'stay on the phone', 'stay with me', 'keep the line open'], re: [/stay on the (line|phone)|do not hang up|stay with me/] },
  instr_away: { ex: ['stay away from him', 'do not approach them', 'lock your doors', 'stay inside', 'go somewhere safe', 'do not confront them', 'stay where you are', 'hide somewhere safe'], re: [/stay away|do not (approach|go near|confront)|lock (the|your) doors?|stay inside|somewhere safe|stay where you are|hide/] },
  instr_evac: { ex: ['get out of the house', 'leave the building now', 'get everyone outside', 'evacuate', 'get out now', 'go outside and wait', 'move away from the car'], re: [/get (out|outside|everyone out)|leave the (house|building|home)|evacuate|go outside|move away from/] },
  instr_cpr: { ex: ['i will help you do cpr', 'start chest compressions', 'push hard on the center of the chest', 'we are going to do cpr', 'put your hands on the chest and push', 'start cpr'], re: [/\bcpr\b|compressions|push (hard|down|on the chest)|center of the chest/] },
  instr_pressure: { ex: ['apply pressure to the wound', 'put a towel on it and press', 'hold pressure on the bleeding', 'press firmly with a clean cloth'], re: [/pressure|press (firmly|on|down)|towel|clean cloth/] },
  instr_position: { ex: ['roll him on his side', 'do not move him', 'keep her still', 'put him in the recovery position', 'lay her flat'], re: [/on (his|her|their) side|recovery position|do not move|keep (him|her|them) still|lay (him|her|them)/] },
  instr_watch: { ex: ['keep an eye on them', 'let me know if anything changes', 'watch which way they go', 'tell me if he stops breathing', 'keep watching and tell me'], re: [/keep an eye|let me know if|tell me (if|when)|watch (which|where|them|him|her)|anything changes/] },
  instr_light: { ex: ['turn on the porch light', 'unlock the front door', 'put the dog away', 'go out and wave them down', 'meet the officers outside', 'secure any pets'], re: [/porch light|unlock the|put (the dog|any pets|the pets) away|wave (them|the)|meet (the|them)|secure (the|any) (dog|pets)/] },
  ask_repeat: { ex: ['can you say that again', 'sorry what was that', 'i did not catch that', 'repeat that please', 'come again'], re: [/say (that )?again|repeat|did not (catch|hear)|come again|pardon/] },
  ask_spell: { ex: ['can you spell that', 'how do you spell the street', 'spell it for me'], re: [/spell/] },
  thanks: { ex: ['thank you', 'thanks for calling', 'thank you so much', 'i appreciate it'], re: [/^(thank|thanks)/] },
  bye: { ex: ['okay i am going to let you go', 'you can hang up now', 'goodbye', 'help should be there now you can hang up', 'i am going to disconnect'], re: [/let you go|hang up|goodbye|\bbye\b|disconnect/] },
  smalltalk: { ex: ['how are you', 'who are you', 'are you a robot', 'nice weather today'], re: [/how are you|who are you|robot|weather/] },
  yes: { ex: ['yes', 'yeah', 'correct', 'that is right', 'okay'], re: [/^(yes|yeah|yep|correct|right|okay|ok|sure|uh huh)\.?$/] },
  no: { ex: ['no', 'nope', 'that is not right'], re: [/^(no|nope|nah|negative)\.?$/] },
};

const NUMBER_WORDS = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };

export function normalize(text) {
  let t = ` ${String(text || '').toLowerCase()} `.replace(/[’‘`]/g, "'");
  t = t.replace(/[^a-z0-9'\s-]/g, ' ');
  t = t.split(/\s+/).map((w) => CONTRACTIONS[w] || w).join(' ');
  t = t.replace(/'s\b/g, '').replace(/'/g, '').replace(/-/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

function stem(w) {
  if (w.length <= 4) return w;
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ied')) return `${w.slice(0, -3)}y`;
  if (w.endsWith('ed') && w.length > 5) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 5) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

// Build phrase lookup sorted longest first.
const PHRASES = [];
for (const [concept, words] of Object.entries(CONCEPTS)) for (const w of words) PHRASES.push([normalize(w), concept]);
PHRASES.sort((a, b) => b[0].length - a[0].length);
const SINGLE = new Map(PHRASES.filter(([p]) => !p.includes(' ')).map(([p, c]) => [p, c]));
const VOCAB = [...SINGLE.keys()].filter((w) => w.length >= 5);
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'to', 'of', 'and', 'or', 'for', 'me', 'my', 'can', 'could',
  'would', 'please', 'okay', 'so', 'just', 'tell', 'know', 'i', 'it', 'that', 'this', 'with', 'on', 'at', 'in', 'be', 'have', 'has', 'need', 'you', 'your',
  'ma', 'am', 'sir', 'maam', 'um', 'uh', 'like', 'well', 'now', 'right', 'there']);

/** Text → bag of features (concept tokens + stemmed content words + bigrams). */
export function features(text) {
  let t = ` ${normalize(text)} `;
  const feats = [];
  for (const [p, c] of PHRASES) {
    if (!p.includes(' ')) continue;
    if (t.includes(` ${p} `)) { feats.push(c); t = t.split(` ${p} `).join(` ${c.toLowerCase()}_ `); }
  }
  const words = t.trim().split(/\s+/).filter(Boolean);
  const out = [];
  for (let w of words) {
    if (w.endsWith('_')) { out.push(w.slice(0, -1).toUpperCase()); continue; }
    let c = SINGLE.get(w);
    if (!c && w.length >= 5) { // fuzzy match for speech-recognition slips ("breating", "adress")
      for (const v of VOCAB) if (Math.abs(v.length - w.length) <= 1 && levenshtein(v, w) <= 1) { c = SINGLE.get(v); break; }
    }
    if (c) out.push(c);
    else if (!STOP.has(w)) out.push(stem(w));
    else if (['where', 'who', 'what', 'when', 'how', 'which', 'he', 'she', 'they', 'him', 'her', 'them'].includes(w)) out.push(w);
  }
  const bag = new Map();
  const add = (k, v = 1) => bag.set(k, (bag.get(k) || 0) + v);
  out.forEach((f, i) => { add(f, /^[A-Z]+$/.test(f) ? 1.6 : 1); if (i) add(`${out[i - 1]}+${f}`, 0.6); });
  feats.forEach((c) => add(c, 0.3));
  return bag;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; if (b.has(k)) dot += v * b.get(k); }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const COMPILED = Object.entries(INTENTS).map(([name, def]) => ({ name, ex: def.ex.map(features), re: def.re || [] }));

/** Score all intents for one clause. Returns sorted [{intent, score}] */
export function scoreIntents(text) {
  const norm = normalize(text);
  if (!norm) return [];
  const f = features(norm);
  const results = [];
  for (const it of COMPILED) {
    let best = 0;
    for (const e of it.ex) best = Math.max(best, cosine(f, e));
    let bonus = 0;
    for (const re of it.re) if (re.test(norm)) { bonus = 0.32; break; }
    results.push({ intent: it.name, score: best + bonus });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

/** Split compound utterances ("where are you and is anyone hurt?") into clauses. */
export function splitClauses(text) {
  const raw0 = String(text || '').split(/[?!.;]+|\b(?:and also|and then|also|plus)\b/i).map((s) => s.trim()).filter(Boolean);
  // commas separate clauses when both sides are real phrases ("help is coming, stay inside")
  const raw = [];
  for (const part of raw0) {
    const bits = part.split(',').map((s) => s.trim()).filter(Boolean);
    if (bits.length > 1 && bits.every((b) => b.split(/\s+/).length >= 3)) raw.push(...bits); else raw.push(part);
  }
  const out = [];
  for (const part of raw) {
    const pieces = part.split(/\band\b/i).map((s) => s.trim()).filter(Boolean);
    // only split on "and" when both sides look like questions/instructions
    if (pieces.length > 1 && pieces.every((p) => p.split(/\s+/).length >= 3)) out.push(...pieces); else out.push(part);
  }
  return out.length ? out : [String(text || '')];
}

/** Main entry: returns array of {intent, score, text} for each understood clause. */
export function understand(text, { threshold = 0.36 } = {}) {
  const clauses = splitClauses(text);
  const found = [];
  for (const c of clauses) {
    const ranked = scoreIntents(c);
    const top = ranked[0];
    if (top && top.score >= threshold) {
      // yes/no only if the clause is basically just that word
      if ((top.intent === 'yes' || top.intent === 'no') && normalize(c).split(' ').length > 3) {
        const alt = ranked.find((r) => r.intent !== 'yes' && r.intent !== 'no' && r.score >= threshold);
        if (alt) { found.push({ ...alt, text: c, alternatives: ranked.slice(1, 5) }); continue; }
      }
      found.push({ ...top, text: c, alternatives: ranked.slice(1, 5) });
    } else found.push({ intent: 'unknown', score: top?.score || 0, text: c, alternatives: ranked.slice(0, 3) });
  }
  // dedupe identical intents
  const seen = new Set();
  return found.filter((f) => { if (f.intent !== 'unknown' && seen.has(f.intent)) return false; seen.add(f.intent); return true; });
}

/** Extract a spoken/typed address: house number + street name (fuzzy). */
export function extractAddress(text) {
  const norm = normalize(text);
  const words = norm.split(' ');
  // numbers: digits or number words ("fourteen twenty three")
  let number = null;
  const digit = norm.match(/\b(\d{2,5})\b/);
  if (digit) number = parseInt(digit[1], 10);
  else {
    const ORD = new Set(['first', 'second', 'third', 'fourth', 'fifth']);
    const seq = []; for (const w of words) { if (w in NUMBER_WORDS && !ORD.has(w)) seq.push(NUMBER_WORDS[w]); else if (seq.length) break; }
    // combine "twenty three" -> 23, "four hundred" -> 400, then concatenate groups ("fourteen twenty three" -> 1423)
    const groups = [];
    for (let i = 0; i < seq.length; i++) {
      const n = seq[i];
      if (n === 100 && groups.length) { groups[groups.length - 1] *= 100; continue; }
      const last = groups[groups.length - 1];
      if (last >= 100 && last % 100 === 0 && n < 100) {
        if (n >= 20 && n % 10 === 0 && seq[i + 1] > 0 && seq[i + 1] < 10) { groups[groups.length - 1] += n + seq[i + 1]; i++; } else groups[groups.length - 1] += n;
        continue;
      }
      if (n >= 20 && n % 10 === 0 && seq[i + 1] > 0 && seq[i + 1] < 10) { groups.push(n + seq[i + 1]); i++; continue; }
      groups.push(n);
    }
    if (groups.length && (groups.length >= 2 || groups[0] >= 100)) {
      let s = '';
      for (const g of groups) s = (s && g >= 100 && s.length === 1) ? String(parseInt(s, 10) * 100 + g % 100) : s + String(g);
      number = parseInt(s, 10);
    }
  }
  const street = matchStreet(norm);
  return { number, street };
}

export function matchStreet(text) {
  const norm = ` ${normalize(text)} `;
  const all = [...NS_STREETS, ...EW_STREETS];
  let best = null, bestScore = 0;
  for (const s of all) {
    const parts = normalize(s).split(' ');
    const key = parts[0];
    const ordinal = { '2nd': 'second', '3rd': 'third', '4th': 'fourth', '5th': 'fifth', '6th': 'sixth', '8th': 'eighth', '9th': 'ninth', '10th': 'tenth', '11th': 'eleventh', '12th': 'twelfth' }[key];
    let score = 0;
    if (norm.includes(` ${key} `) || (ordinal && norm.includes(` ${ordinal} `))) score = 2;
    else {
      for (const w of norm.trim().split(' ')) if (w.length >= 4 && key.length >= 4 && levenshtein(w, key) <= 1) { score = 1.2; break; }
    }
    if (score && parts[1] && norm.includes(` ${parts[1]} `)) score += 0.5;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

export const INTENT_NAMES = Object.keys(INTENTS);
export { STREET_WORDS };
