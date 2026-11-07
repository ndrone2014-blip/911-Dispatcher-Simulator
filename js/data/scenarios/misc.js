// Non-emergency, misdial, and training scenarios. These need no incident; the
// player can simply give info and end the call.
import { S } from './helpers.js';

export default [
  S({ id: 'misdial_pocket', kind: 'misdial', typeId: 'OTHER', weight: 3, personas: ['calm', 'upset', 'helpful'],
    opening: ['...hello? Oh! Oh no, I\'m so sorry, my phone must have called in my pocket.', '*muffled rustling* ...wait, is this 911? Sorry! Butt dial!'],
    nature: 'Sorry, it was an accident. There\'s no emergency.', note: 'Accidental dial – no emergency',
    facts: { safe: 'Yes, I\'m totally fine, sorry!' }, callerAtScene: true }),
  S({ id: 'misdial_child', kind: 'misdial', typeId: 'OTHER', weight: 1.2, personas: ['calm'], callerSex: 'f',
    opening: ['Hi! *giggling* ...Mommy! I talked to the police! — Oh my gosh, I\'m so sorry, my four-year-old grabbed my phone.'],
    nature: 'My kid was playing with my phone. Everything\'s fine here.', note: 'Child playing with phone – no emergency', facts: { safe: 'Yes, everyone is fine.' } }),
  S({ id: 'nonemerg_question', kind: 'nonemergency', typeId: 'ASSIST', weight: 2.5, personas: ['calm', 'talkative', 'elderly', 'confused'],
    vars: (r) => ({ q: r.pick(['what time the fireworks start at Central Park', 'if the roads are closed for the parade', 'how to get a copy of a police report', 'why there are so many police cars on my street', 'if I can burn leaves in my backyard', 'when trash pickup is this week with the holiday']) }),
    opening: ['Hi, sorry, I know this isn\'t really an emergency, but I wanted to ask {q}.'],
    nature: 'I just wanted to ask {q}.', note: 'Non-emergency inquiry: {q}' }),
  S({ id: 'nonemerg_power', kind: 'nonemergency', typeId: 'UTIL_OUT', weight: 1, weather: { thunderstorm: 3, severe: 3, snow: 2, clear: 0.3 }, personas: ['upset', 'calm', 'elderly'],
    opening: ['Yeah, my power is out. Do you know when it\'s coming back on?', 'Is there a power outage? All my lights went out.'],
    nature: 'My power\'s out and I want to know when it\'s coming back.', note: 'Power outage inquiry – refer to utility' }),
  S({ id: 'prank', kind: 'prank', typeId: 'OTHER', weight: 0.8, personas: ['calm'], callerSex: 'm',
    opening: ['Uh yeah, I\'d like to report that my refrigerator is running! *laughter in the background*', 'Hello, is this the pizza place? *giggling*'],
    nature: '*laughing* Nothing, man. *click*', note: 'Prank call', facts: { name: 'Uh... Mike Hunt. *laughing*' } }),
  S({ id: 'lonely_elderly', kind: 'nonemergency', typeId: 'WELFARE', weight: 0.7, personas: ['elderly'],
    opening: ['Hello dear, I\'m sorry to bother you. I fell earlier but I\'m okay now, I just wanted to hear a voice.'],
    nature: 'I\'m alright, I just feel a little lonely tonight. My daughter lives far away.', note: 'Elderly caller, lonely, minor fall earlier – consider welfare check',
    facts: { injuries: 'No, I\'m not hurt, just a little bruise.', age: 'I\'m eighty-seven.' }, needs: { patrol: 0.5, bls: 0.5 } }),
  S({ id: 'training_basic', trainingOnly: true, typeId: 'MVA_INJ', severity: 'medium', personas: ['worried'],
    vars: () => ({ rel: 'the other driver', he: 'he', him: 'him', his: 'his', He: 'He', His: 'His' }),
    nature: ['There\'s been a car accident in front of my house! Two cars hit each other and one driver is hurt.'],
    note: 'Training – 2 car collision w/ injury',
    facts: { injuries: { say: 'The other driver is holding his arm, he says it really hurts.', note: '1 injured, arm' }, conscious: 'Yes, he\'s awake.', breathing: 'Yes.', count: 'Two cars.', blocking: 'Yes, it\'s blocking the road.', hazards: 'No, nothing leaking.' },
    patients: 1, needs: { patrol: 1, bls: 1, suppression: 1 }, workload: 70 }),
];
