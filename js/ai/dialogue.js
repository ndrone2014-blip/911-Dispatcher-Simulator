// Dialogue library: caller personas, description generators and the generic,
// varied phrasing used to answer every kind of dispatcher question.
import { fill, capitalize } from '../core/util.js';

export const PERSONAS = {
  calm: { label: 'Calm', panic: 0.12, verbose: 0.45, accuracy: 1, rate: 1.0, pitch: 1.0,
    pre: ['', '', 'Yes,', 'Okay,', 'Sure,'], post: ['', '', ''] },
  helpful: { label: 'Helpful', panic: 0.2, verbose: 0.7, accuracy: 1, rate: 1.03, pitch: 1.02,
    pre: ['Okay,', 'Sure,', 'Yes, so', 'Alright,'], post: ['', 'Is there anything else you need from me?', 'I can stay on the line if that helps.', ''] },
  worried: { label: 'Worried', panic: 0.5, verbose: 0.55, accuracy: 0.92, rate: 1.08, pitch: 1.08,
    pre: ['Oh, um,', 'Okay, um,', 'Um,', '', 'Oh gosh,'], post: ['Please hurry.', '', 'Is someone coming?', ''] },
  panicked: { label: 'Panicked', panic: 0.88, verbose: 0.4, accuracy: 0.65, rate: 1.22, pitch: 1.16,
    pre: ['Oh my god,', 'Please,', 'Oh god, oh god,', '', 'I— I—'], post: ['Please hurry!', 'Hurry, please!', 'Please send someone!', ''] },
  upset: { label: 'Upset', panic: 0.35, verbose: 0.6, accuracy: 0.95, rate: 1.1, pitch: 0.98,
    pre: ['Look,', 'Okay, look,', 'Ugh,', '', 'Honestly,'], post: ['This is ridiculous.', 'I\'m so sick of this.', '', 'Every single time.'] },
  confused: { label: 'Confused', panic: 0.35, verbose: 0.5, accuracy: 0.75, rate: 0.95, pitch: 1.02,
    pre: ['Um...', 'I\'m not sure, um,', 'Hold on,', 'Uh,', 'Wait, um,'], post: ['I think?', '', 'Does that make sense?', ''] },
  unsure: { label: 'Unsure', panic: 0.25, verbose: 0.45, accuracy: 0.85, rate: 0.98, pitch: 1.0,
    pre: ['I don\'t know, maybe', 'I guess', 'Well,', 'I\'m not totally sure, but'], post: ['Maybe it\'s nothing.', 'I don\'t want to waste your time.', '', ''] },
  quiet: { label: 'Quiet', panic: 0.3, verbose: 0.1, accuracy: 0.95, rate: 0.92, pitch: 0.96,
    pre: ['', '', 'Um.'], post: ['', ''] },
  talkative: { label: 'Talkative', panic: 0.25, verbose: 1, accuracy: 0.95, rate: 1.12, pitch: 1.04,
    pre: ['Well,', 'So,', 'Okay so', 'Oh, well,'], post: ['', ''] },
  elderly: { label: 'Elderly', panic: 0.3, verbose: 0.7, accuracy: 0.85, rate: 0.84, pitch: 0.9,
    pre: ['Oh dear,', 'Well, now,', 'Oh, my,', 'Yes, dear,'], post: ['', 'My eyes aren\'t what they used to be.', '', 'Thank you, dear.'] },
};

export const TALKATIVE_TANGENTS = [
  'My daughter always tells me I should just mind my own business, but I can\'t help it.',
  'I\'ve lived here eleven years and nothing like this has ever happened.',
  'Sorry, I talk a lot when I\'m nervous.',
  'I was just making dinner when this all started.',
  'My husband\'s at work, of course, he\'s never here when stuff happens.',
  'I almost didn\'t call, I didn\'t want to bother anybody.',
  'I\'ve got the TV on mute so I can hear better.',
  'This neighborhood used to be so quiet.',
  'I\'m standing at the window right now.',
];

export const FIRST_NAMES = {
  m: ['James', 'Michael', 'Robert', 'David', 'Carlos', 'Andre', 'Kevin', 'Brian', 'Luis', 'Tyler', 'Marcus', 'Daniel', 'Frank', 'Hector', 'Wei', 'Darnell',
    'Steve', 'Raj', 'Tom', 'Greg', 'Omar', 'Ethan', 'Walter', 'Gary', 'Jamal', 'Nick', 'Paul', 'Victor', 'Sam', 'Harold', 'Mateo', 'Connor'],
  f: ['Maria', 'Jennifer', 'Linda', 'Sarah', 'Aisha', 'Emily', 'Patricia', 'Keisha', 'Rosa', 'Megan', 'Laura', 'Grace', 'Priya', 'Tanya', 'Donna', 'Mei',
    'Ashley', 'Brenda', 'Fatima', 'Carol', 'Nicole', 'Dorothy', 'Jasmine', 'Kim', 'Elena', 'Rachel', 'Sofia', 'Monica', 'Beth', 'Gloria', 'Hannah', 'Zoe'],
};
export const LAST_NAMES = ['Johnson', 'Martinez', 'Williams', 'Kim', 'Brown', 'Garcia', 'Davis', 'Rodriguez', 'Miller', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Lee', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Perez', 'Hall', 'Young', 'Allen', 'Sanchez', 'Wright', 'King',
  'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Ramirez', 'Campbell', 'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans', 'Turner', 'Torres',
  'Parker', 'Collins', 'Edwards', 'Stewart', 'Flores', 'Morris', 'Nguyen', 'Murphy', 'Rivera', 'Cook', 'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed'];

export function makePhone(r) { return `(555) ${r.int(201, 989)}-${String(r.int(0, 9999)).padStart(4, '0')}`; }

export const COLORS = ['black', 'white', 'silver', 'gray', 'dark blue', 'red', 'maroon', 'green', 'tan', 'gold', 'light blue', 'dark gray'];
const MAKES = ['Honda Civic', 'Toyota Camry', 'Ford F-150', 'Chevy Silverado', 'Nissan Altima', 'Jeep Grand Cherokee', 'Dodge Charger', 'Hyundai Sonata',
  'Toyota Corolla', 'Ford Explorer', 'Chevy Impala', 'Subaru Outback', 'Kia Optima', 'GMC Sierra', 'Honda Accord', 'Chrysler minivan', 'Dodge Ram', 'Mazda 3'];
const TOPS = ['a black hoodie', 'a gray hoodie', 'a red jacket', 'a white t-shirt', 'a dark green jacket', 'a blue windbreaker', 'a black leather jacket',
  'a yellow rain jacket', 'a camo jacket', 'a striped shirt', 'a sports jersey', 'a puffy black coat', 'a tan work shirt', 'a plaid flannel'];
const BOTTOMS = ['jeans', 'dark jeans', 'gray sweatpants', 'black pants', 'khaki shorts', 'basketball shorts', 'cargo pants', 'track pants'];
const EXTRAS = ['a baseball cap', 'a beanie', 'a backpack', 'sunglasses', 'a face mask', 'a ponytail', 'a beard', 'glasses', 'a tattoo on his neck', 'white sneakers'];

export function personDesc(r, sex = r.pick(['m', 'f']), opts = {}) {
  const age = opts.age || r.pick(['teens', 'early twenties', 'twenties', 'thirties', 'forties', 'fifties']);
  const height = r.pick(['short', 'average height', 'tall', 'around six feet', 'maybe five-eight', 'pretty tall']);
  const build = r.pick(['skinny', 'heavyset', 'thin', 'medium build', 'stocky', 'athletic']);
  const top = r.pick(TOPS), bottom = r.pick(BOTTOMS); const extra = r.chance(0.6) ? r.pick(EXTRAS).replace('his', sex === 'm' ? 'his' : 'her') : null;
  const who = sex === 'm' ? 'a guy' : 'a woman';
  const say = `${who}, ${age === 'teens' ? 'a teenager' : `maybe in ${sex === 'm' ? 'his' : 'her'} ${age}`}, ${height}, ${build}, wearing ${top} and ${bottom}${extra ? `, with ${extra}` : ''}`;
  const note = `${sex === 'm' ? 'Male' : 'Female'}, ${age}, ${height}, ${build}, ${top.replace(/^an? /, '')}, ${bottom}${extra ? `, ${extra.replace(/^an? /, '')}` : ''}`;
  return { sex, age, say, note };
}

export function vehicleDesc(r) {
  const color = r.pick(COLORS), make = r.pick(MAKES);
  const plateKnown = r.chance(0.45);
  const plate = `${r.pick('ABCDEFGHJKLMNPRSTVWXYZ'.split(''))}${r.pick('ABCDEFGHJKLMNPRSTVWXYZ'.split(''))}${r.pick('ABCDEFGHJKLMNPRSTVWXYZ'.split(''))}-${r.int(1000, 9999)}`;
  const partial = plate.slice(0, 3).split('').join('-');
  const extra = r.pick(['', ', older model', ', newer looking', ', with a dented bumper', ', tinted windows', ', with a loud muffler', ', with a roof rack']);
  const say = `a ${color} ${make}${extra}${plateKnown ? `. I got the plate, it was ${plate.split('').join(' ').replace(' - ', ' dash ')}` : r.chance(0.5) ? `. Plate started with ${partial}, I think` : ''}`;
  const note = `${capitalize(color)} ${make}${extra}${plateKnown ? `, plate ${plate}` : ''}`;
  return { color, make, plate: plateKnown ? plate : null, say, note };
}

export const DIRECTIONS = ['north', 'south', 'east', 'west'];

// ---- Generic slot phrasing. {x} placeholders are filled from the call context. ----
export const SLOT_LINES = {
  location: ['I\'m at {address}.', 'It\'s {address}.', 'The address is {address}.', '{address}.', 'We\'re at {address}.', 'It\'s happening at {address}.'],
  location_highway: ['I\'m on {street} {dir}, near the {cross} exit.', 'We\'re on {street}, {dir}, right around {cross}.', '{street} {dir}, just past {cross}.'],
  location_water: ['It\'s in {street}, near {cross}.', 'Out on {street}, you can see it from {cross}.', 'In the water, {street}, by {cross}.'],
  location_poi: ['I\'m at {poi}, that\'s {address}.', 'It\'s {poi}, at {address}.', 'We\'re at {poi} — {address}.'],
  location_vague: ['I don\'t know the exact number — it\'s on {street}, near {cross}.', 'Um, it\'s on {street}... near {cross}, I think. I don\'t know the number.', 'I\'m not sure of the address. It\'s on {street} close to {cross}.'],
  location_partial: ['{street}! It\'s on {street}, I— please just hurry!', 'It\'s on {street}! Near... I can\'t think!', 'On {street}, I don\'t— just come!'],
  cross: ['The cross street is {cross}.', 'It\'s near {cross}.', 'Closest cross street is {cross}.', 'Right by {cross}.', 'I think it\'s {cross}.'],
  apt: ['It\'s {apt}.', '{apt}.', 'We\'re in {apt}.'],
  apt_none: ['No, it\'s a house.', 'There\'s no apartment number.', 'No, it\'s not an apartment.'],
  name: ['My name is {name}.', 'It\'s {name}.', '{name}.', 'This is {name}.', 'I\'m {name}.'],
  phone: ['My number is {phone}.', 'This number, {phone}.', 'It\'s {phone}.', 'You can reach me at {phone}.'],
  safe_yes: ['Yes, I\'m okay.', 'Yeah, I\'m safe.', 'I\'m fine, I\'m inside.', 'Yeah, I\'m alright.', 'I\'m okay, I\'m at a distance.'],
  safe_no: ['No! I\'m scared!', 'I don\'t know, I don\'t think so!', 'No, I\'m hiding right now.'],
  unknown: ['I don\'t know.', 'I\'m not sure.', 'I couldn\'t tell you.', 'I didn\'t see that.', 'No idea, sorry.', 'I really don\'t know.'],
  none_weapons: ['No, I didn\'t see any weapons.', 'Not that I saw.', 'No, nothing like that.', 'No weapons, I don\'t think.'],
  none_injuries: ['No, I don\'t think anyone\'s hurt.', 'Nobody\'s hurt, no.', 'No injuries that I can see.', 'Everyone seems okay.'],
  none_suspect: ['There\'s no one like that, it\'s not that kind of thing.', 'Nobody did anything, it\'s not like that.', 'There isn\'t anybody to describe.'],
  none_vehicle: ['I didn\'t see a car.', 'No car that I saw.', 'They were on foot, I think.'],
  none_hazards: ['No, nothing like that.', 'Not that I can see.', 'I don\'t smell anything weird, no.'],
  none_fire: ['Fire? No, there\'s no fire.', 'No, nothing\'s on fire.'],
  none_patient: ['It\'s not a medical thing.', 'Nobody needs medical help, I don\'t think.'],
  none_generic: ['That doesn\'t really apply here.', 'No, nothing like that.', 'Not really, no.'],
  repeat_irritated: ['I already told you — {answer}', 'Like I said, {answer}', 'I just said, {answer}', 'Again, {answer}', 'Yes, {answer} I already told you that!'],
  dont_understand: ['I\'m sorry, what?', 'What do you mean?', 'I don\'t understand.', 'Sorry, I didn\'t get that.', 'Can you ask that a different way?', 'Huh?'],
  dont_understand_panicked: ['What? I don\'t— please just send someone!', 'I don\'t understand, please!', 'What?! Just hurry!'],
  reassure: ['Okay. Okay, thank you.', 'Thank you, thank you so much.', 'Okay... how long will they be?', 'Please tell them to hurry.', 'Okay, I\'ll wait.', 'Thank god.'],
  reassure_calm: ['Great, thank you.', 'Okay, sounds good.', 'Perfect, thanks.', 'Alright, I appreciate it.'],
  calm: ['Okay... okay. I\'m trying.', '*breathes* Okay.', 'Okay, I\'m calmer. Sorry.', 'Alright. I\'m okay.', 'Okay, okay. Thank you.'],
  stayline: ['Okay, I\'m not going anywhere.', 'Okay, I\'ll stay on.', 'I\'m here.', 'Okay, I\'m staying.'],
  away: ['Okay, I\'ll stay back.', 'Okay, I\'m locking the door now.', 'I\'m not going near them, don\'t worry.', 'Okay, I\'m staying inside.'],
  evac: ['Okay, we\'re getting out now!', 'Okay, okay, we\'re outside now.', 'I\'m out, I\'m across the street now.', 'Everyone\'s coming out.'],
  evac_na: ['We\'re already outside.', 'I\'m not inside, I\'m across the street.'],
  pressure: ['Okay, I\'m pressing on it.', 'I\'ve got a towel on it, I\'m pushing hard.', 'Okay, holding pressure.'],
  pressure_na: ['There\'s no bleeding though.', 'I don\'t see any blood.'],
  position: ['Okay, I won\'t move him.', 'Okay, I rolled her onto her side.', 'Okay, I\'m keeping them still.'],
  watch: ['Okay, I\'ll keep watching.', 'I\'ll tell you if anything changes.', 'Okay, I\'m watching.'],
  light: ['Okay, I turned the porch light on.', 'Okay, the door\'s unlocked.', 'Okay, I put the dog in the bedroom.', 'Okay, I\'ll go out front and wave them down.'],
  cpr_start: ['Okay! Okay, where do I— okay, I\'m pushing!', 'Okay, I\'m doing it, I\'m pushing on his chest!', 'Okay, hands in the middle... I\'m pushing. One, two, three, four...'],
  cpr_na: ['CPR? He\'s breathing though.', 'She\'s awake, she doesn\'t need that.', 'There\'s nobody who needs CPR.'],
  cpr_continue: ['...twenty-nine, thirty... I\'m still going!', 'I\'m still pushing, my arms are getting tired!', 'Still doing it... come on, come on...'],
  thanks: ['Thank you. Really.', 'No, thank you.', 'Thanks for your help.', 'Thank you so much.'],
  bye: ['Okay, thank you. Bye.', 'Thank you so much, bye.', 'Okay. Thanks. Bye-bye.', 'Alright, thank you.'],
  bye_waiting: ['Wait, are they here yet? ...okay. Thank you.', 'Okay, I\'ll wait for them. Thanks.'],
  smalltalk: ['I— can we talk about that later?', 'Um, I\'m not really in the mood to chat.', 'I just need help, please.'],
  else_none: ['No, I think that\'s everything.', 'That\'s all I know.', 'No, that\'s it.', 'I think I told you everything.'],
  greet_again: ['Yes, I\'m still here. Like I said, {nature}', 'I told you — {nature}'],
  wait_ask: ['Are they almost here?', 'How much longer?', 'Is anyone coming?', 'Hello? Are you still there?', 'I don\'t see anyone yet...'],
  units_here: ['Oh, I see them! They\'re here!', 'I hear sirens, I think they\'re here!', 'They\'re pulling up now!', 'Okay, the officers just got here.'],
  confirm_yes: ['Yes, that\'s right.', 'Yes, correct.', 'That\'s it, yes.', 'Yep.'],
  confirm_no: ['No, it\'s {address}.', 'No no, {address}!', 'That\'s not right, it\'s {address}.'],
  spell: ['{spelled}.', 'It\'s spelled {spelled}.'],
  yes_generic: ['Okay.', 'Yes.', 'Mm-hm.', 'Okay...'],
  no_generic: ['Okay.', 'Alright.', 'Okay, sorry.'],
};

export function styled(text, persona, r, { panic = 0, first = false, allowPost = true } = {}) {
  const p = PERSONAS[persona] || PERSONAS.calm;
  let out = text.trim();
  if (!out) return out;
  const pre = r.chance(0.55) ? r.pick(p.pre) : '';
  if (pre) out = `${pre} ${/^(I\b|I'|[A-Z]{2}|[A-Z][a-z]+ [A-Z])/.test(out) ? out : out.charAt(0).toLowerCase() + out.slice(1)}`;
  if (persona === 'panicked' && panic > 0.6 && r.chance(0.3)) out = out.replace(/^(\w)/, (m) => `${m}-${m}`);
  if (allowPost && r.chance(persona === 'panicked' ? Math.min(0.8, 0.3 + panic) : 0.3)) { const post = r.pick(p.post); if (post) out += ` ${post}`; }
  if (persona === 'quiet') out = out.replace(/!+/g, '.');
  if (panic < 0.25 && persona !== 'panicked') out = out.replace(/!+/g, '.');
  return out.replace(/\s+/g, ' ').trim();
}

export function line(key, ctx, r) { return fill(SLOT_LINES[key] || ['...'], ctx, r); }
