// Story library for station personnel. Every character has their own stories that fit their
// background, plus a shared pool of dispatch-floor legends. Stories are dealt like a shuffled
// deck per character and remembered between sessions, so you won't hear the same one twice in
// a row (and not again until that character has told you the rest). All fictional.

export const STORIES = {
  maria: [
    'My first cardiac arrest call, I talked a teenage girl through CPR on her grandfather for nine minutes. He walked out of the hospital two weeks later. She sends me a card every year.',
    'Years ago a little boy called because his mom wouldn\'t wake up. He was five and he knew his address because she\'d made him practice it. Diabetic low. He saved her life. Teach your kids their address.',
    'I once spent forty minutes on the phone with a farmer whose wife went into labor during an ice storm. The ambulance was stuck behind a jackknifed semi. She delivered on the kitchen floor with me counting. Healthy girl. They named her Grace.',
    'There was a night the whole county lost power and we ran everything off the generator and paper cards. I learned that night that the CAD is a tool, not the job. The job is listening.',
    'An older gentleman used to call every Sunday night just to tell us the weather at his house. When the calls stopped, I asked for a welfare check. He\'d fallen. They got to him in time. I still think about him on Sundays.',
    'I trained a dispatcher who froze on her first big call. I put my hand on her shoulder and said, "Address first." She took a breath and nailed it. She runs her own center in Indiana now.',
    'A caller once read me his license plate in the NATO alphabet perfectly, and then I found out he was the guy who\'d just stolen the car. He wanted to report that it was making a weird noise.',
    'The best compliment I ever got was from a deputy who said, "When you\'re on the radio I stop worrying." That\'s what we\'re here for.',
  ],
  tyler: [
    'My second week, a guy called to report a "suspicious UFO." It was the Walmart parking lot light flickering. I still sent a unit. I\'m thorough.',
    'I had a call from a kid who dialed 911 to ask if dinosaurs were real. I said yes, but they live in museums now. His mom took the phone and apologized like six times.',
    'One night a lady called because a possum was in her kitchen eating her cat\'s food and staring at her. Animal control was off, so the deputy went. He said the possum won the staring contest.',
    'I took my first structure fire call on Thanksgiving. I was so nervous I said "Engine One, respond to the turkey—" instead of the address. Ray still brings it up.',
    'A trucker called about a "giant cat" on I-64. Everyone laughed. Then three more people called. It was a bobcat. A real one. I felt very validated.',
    'I once got a pocket dial where I could hear a guy singing karaoke in his truck for like four minutes. Honestly? He was pretty good.',
    'I talked a guy through changing a flat on the interstate shoulder at two a.m. because he was scared to be out there alone. Not every call is an emergency, but every caller matters.',
  ],
  denise: [
    'When I was a medic, we had a man who\'d been down for twelve minutes before we got there. A dispatcher had his wife doing compressions the whole time. He lived. That\'s why I\'m on this side of the radio now.',
    'I once had a caller describe her husband\'s symptoms so clearly — slurred words, face drooping, the exact minute it started — that the hospital had the stroke team waiting at the door. Ask when it started. Always.',
    'Grain bin entrapments still scare me most. Once, the farmer\'s son kept talking to his dad through the wall the whole time we were cutting the bin. He kept him calm for an hour. Brave kid.',
    'We ran a bus crash a few years back. Thirty kids. Every single one was tagged, treated and reunited with their parents in under two hours. I\'ve never been prouder of this county.',
    'On the ambulance, the best dispatchers were the ones who gave us the gate code before we asked. Little details save minutes.',
    'A woman once called for her neighbor and then calmly walked us through the house layout from memory — which bedroom, which hallway. Firefighters found him in the exact room she said.',
  ],
  ray: [
    'Blizzard of \'09. Forty-one calls in an hour, half the roads closed, and the power went out in the building. We dispatched by flashlight. Nobody died that night. That\'s the job.',
    'In the old days we had one radio channel for everybody. Fire, police, the county highway truck. You learned to talk fast and say it once.',
    'A guy called me once and said, "I need to report myself." I asked for what. He said, "I just ate my roommate\'s birthday cake." I told him that was between him and God.',
    'We had a flood in \'02 where the Little Wabash came up so fast that the fire department had to rescue a deputy who was out rescuing a farmer. Everybody came home. I bought the donuts for a month.',
    'You know what I remember? Not the big ones. The little old lady who called because her furnace was out and she was scared. We got her warm. She sent us a pie every Christmas for ten years.',
    'First year on the job, I sent an engine to the wrong Elm Street — there were two at the time, one in Carmi, one in Crossville. Never again. Read the address back, kid. Every time.',
    'I once took a call from a parrot. I\'m serious. It learned to dial and say "help." The owner was at work. The deputy went anyway. Said the bird wanted crackers.',
    'Night shift during harvest, a combine caught fire in a field off Burnt Prairie Road and the farmer drove it away from his grain bins while it was burning. Crazy, brave, or both.',
  ],
  priya: [
    'I color-code the call board because once, during an ice storm, I had twelve incidents open and I could still see at a glance who was waiting the longest. Organized means faster.',
    'A man called because his smart speaker kept saying it heard glass breaking. It was his dog\'s squeaky toy. I sent a deputy anyway. Better safe.',
    'I helped a non-English-speaking caller through a kitchen fire using the language line and a lot of patience. She kept saying thank you in three languages at the end.',
    'There was a week I took three calls from the same goat. Same goat, same fence, three different neighbors. We know him by name now. His name is Gerald.',
    'My favorite call ever: a kid called to say he\'d found a wallet with eighty dollars in it and wanted to give it back. Deputy met him and returned it to the owner. Restored my faith in people.',
    'I once tracked down a lost hiker using nothing but the sound of a train horn in the background and the railroad schedule. Sometimes it\'s detective work.',
  ],
  karen: [
    'The hardest thing I ever did as a supervisor was send a dispatcher home after a bad call — she didn\'t want to go. But taking care of my people is part of taking care of callers.',
    'We had a tornado warning come in during a shift change once. Both shifts stayed. Sixteen dispatchers on eight consoles, sharing headsets. Nobody went home until it was over.',
    'A new hire once asked me what makes a great dispatcher. I said: calm voice, fast fingers, and a big heart. In that order on a bad night.',
    'I remember a night when the radio system failed and we relayed traffic through the Sheriff\'s car radios parked in the sally port. Ugly, but it worked.',
    'Somebody once called to complain about how long we took to answer. It was three seconds. I thanked him for his feedback and meant it — every second matters.',
  ],
  marcus: [
    'I tell every trainee the same story: the first call I ever took, I forgot to ask the address. The caller had to tell me. Mistakes are how you learn — just don\'t make that one.',
    'Best training moment I ever saw — a trainee got a panicked caller, and instead of rushing, she lowered her voice and slowed down. The caller matched her. That\'s the secret.',
    'We do a scenario where the caller only speaks in partial sentences. Trainees hate it. Then they get a real call like that, and they thank me.',
    'A trainee once caught a wrong address because the caller said "by the water tower" and the house number didn\'t match that side of town. Listening beats typing every time.',
    'I keep a jar on my desk. Every time a trainee reads an address back correctly, they drop a penny in. When it\'s full, I buy pizza. It fills up fast.',
  ],
  helen: [
    'When I started, this center had four consoles and a fax machine. I pushed for every upgrade you see today because the people on these phones deserve the best tools.',
    'The proudest day of my career was when a family came to the center to meet the dispatcher who\'d coached them through CPR. Their dad came too. Alive.',
    'I always tell the county board: dispatchers are first responders. They\'re the first voice in the worst moment of someone\'s life.',
    'Years ago, we had a caller who couldn\'t speak — just tapping. The dispatcher figured out it was a woman hiding from an intruder and used yes-or-no taps to get the address. Brilliant work.',
    'I once covered a console during a mass casualty incident because everyone was slammed. I\'m the director, but that day I was a dispatcher. Never forget where you came from.',
  ],
  jake: [
    'I chased a guy on foot for six blocks and dispatch had K-9 waiting at the end before I even asked. That\'s when I realized you guys are basically wizards.',
    'Stopped a car for a taillight once and the driver handed me a cheeseburger instead of his license. He said he panicked. I let him keep the burger.',
    'I had a call for a "man with a gun" that turned out to be a guy carrying a leaf blower. Still glad dispatch gave me all the details — I went in careful.',
    'One winter I found an elderly man walking down IL-14 in his slippers, trying to get to his old house. Dispatch figured out where he lived from a missing-person call twenty minutes earlier. Got him home warm.',
    'The scariest moment of my career was a domestic where the radio cut out. When it came back, the dispatcher was already sending backup. She\'d heard the yelling through my open mic. I owe her one.',
  ],
  lou: [
    'We had a barn fire out on Herald Road with forty head of cattle inside. Dispatch got the neighbors calling each other, and half the township showed up with trailers. Saved every cow.',
    'Dispatch kept every company coordinated through a three-alarm warehouse fire. Never once lost track of a crew. You guys don\'t get enough credit.',
    'Ever pulled a horse out of a swimming pool? I have. Took a tractor, two straps and a very patient horse.',
    'Our engine broke down on the way to a car fire once. The next engine was already rolling before I keyed the mic. Dispatcher saw our AVL stop and moved on it.',
    'Old Station 1 had a cat that would ride on the engine bumper to the end of the driveway every call. We named her Siren. She retired to the fire chief\'s farm.',
  ],
  sam: [
    'Delivered a baby in the back of the ambulance on the IL-14 shoulder outside Enfield. The parents named him after the dispatcher. True story.',
    'Got a call for a "man not breathing." Turned out he was a deep sleeper with a CPAP that came unplugged. He was very confused to wake up to six people in his bedroom.',
    'We once responded to a bee swarm in a minivan. The driver was fine; the bees were less fine. I still have the photos.',
    'A dispatcher once told me the patient\'s dog was aggressive and to wait at the door. Saved my ankles. Literally.',
    'Worst night ever, best ending: three-car pileup in fog, five patients, two of us. Dispatch had mutual aid from Wayne County rolling before we finished our size-up. Everybody lived.',
  ],
  captain: [
    'When I was a young deputy, I got lost on a county road at night during a pursuit. The dispatcher talked me through every turn from memory. That night I promised myself I\'d always back my dispatchers.',
    'The best roll call I ever gave was thirty seconds long: "Be safe, be kind, come home." Some days that\'s all that needs saying.',
    'We once found a missing child asleep in a neighbor\'s hay barn because a dispatcher noticed the family\'s barn cat followed the kid everywhere. Ask the odd questions.',
    'During the big flood, I watched dispatch coordinate boats, deputies, fire crews and the Red Cross for thirty hours straight. I\'ve been in this job a long time and I\'ve never seen a better team.',
    'I keep a radio log page framed in my office from the night a deputy was in a crash. Every line is the dispatcher staying calm. That\'s what professionalism looks like.',
    'First week as Captain, I tried to run roll call without coffee. The Watch Commander slid a cup across the podium without saying a word. That\'s partnership.',
  ],
  watch: [
    'My first night as Watch Commander, the power went out, the radio tower went down and it started to snow. Welcome to the job, they said.',
    'I tell every new deputy: the dispatcher is your partner. They can see the whole county; you can see one street. Trust them.',
    'Had a call once where a caller described a getaway car as "the color of a ripe banana." Dispatch put out "yellow sedan" and we had it stopped in four minutes.',
    'We ran a search for a lost hunter in the Wabash bottoms with nothing but a phone ping and a description of a "big fallen sycamore." The dispatcher found it on aerial maps. We walked right to him.',
    'Night shift during harvest is its own world. Combines on the road at midnight, deer everywhere, and somebody always calls about a "strange light" that turns out to be a grain dryer.',
    'I once broke up a fight between two neighbors over whose rooster was louder. Both roosters were present. Both roosters were very loud.',
  ],
  chief: [
    'We fought a grain elevator fire that burned for two days. Dispatch kept the water tenders cycling like clockwork the entire time. Without them, we\'d have lost half the town\'s grain.',
    'My first fire as a volunteer, I forgot my helmet and the dispatcher reminded my captain over the radio to check me. Embarrassing. Probably saved my head.',
    'We train for the big ones, but the call I remember most was a little girl reporting smoke from her toaster. She did everything right. We gave her a junior firefighter helmet.',
    'Tornado season a few years back, dispatch gave us the warning seven minutes before the siren sounded. We had every engine out of the bay before it hit the station. That\'s seven minutes I\'ll never forget.',
    'Fire Chief tip: when a caller says "it\'s just a little smoke," ask what\'s burning. "A little smoke" has turned into a working fire more times than I can count.',
    'We once pulled a calf out of a frozen pond. The farmer cried. The calf didn\'t care at all. Some rescues are just pure joy.',
  ],
  deputy: [
    'Pulled over a tractor once for having no lights at night. The farmer said, "Son, I was plowing before you were born." He was right. I gave him a warning and a flashlight.',
    'Had a call about a "body in the ditch." It was a mannequin wearing a Cardinals jersey. Somebody\'s prank. We still checked carefully.',
    'Best thing about this county? Everybody waves. Even the people you just gave a ticket to.',
    'I helped a family push their car out of a snowbank on Christmas Eve, and they gave me a whole plate of cookies. I shared them with dispatch. Mostly.',
    'Got called to a loose bull on IL-1. Spent forty minutes with three neighbors and a bucket of feed getting him home. Bull didn\'t even say thank you.',
  ],
};

export const SHARED_STORIES = [
  'I once had a lady call because a squirrel was "staring at her aggressively." I sent animal control. The squirrel won.',
  'Had a guy call from inside a locked porta-potty that got knocked over at the county fair. Fire got him out. He was very polite about it.',
  'Somebody called to report a "dead body" in a field. It was a scarecrow somebody had dressed up very convincingly. Deputies checked it anyway, carefully.',
  'We once got six calls in ten minutes about a "huge fire" on the horizon. It was the harvest moon rising. Honestly, it did look like a fire.',
  'A caller asked if it was illegal to keep a raccoon as a pet because the raccoon had "moved in" and was refusing to leave. Animal control handled the eviction.',
  'A woman called because she accidentally locked herself in her own chicken coop. Her husband was asleep. She was very worried the chickens were judging her.',
  'There\'s a legend on this floor about a dispatcher who took a call, dispatched it, and coached CPR — all while eating a tenderloin sandwich and never dropping a crumb.',
  'Someone once called 911 to ask if it was too late to call 911 about something that happened in 1987. We gave him the non-emergency number.',
  'A guy called because his GPS told him to turn onto a field road and now his rental car was stuck in a bean field. Farmer pulled him out with a tractor and gave him directions on a napkin.',
  'We had a goat on the roof of a house once. Nobody knows how it got there. Fire got it down. The goat seemed proud of itself.',
  'A kid called to report that his little brother had stolen his Halloween candy. The deputy who called back gave him a very serious lecture about sharing — the brother, that is.',
  'Once, during a storm, a caller held the phone out the window so we could "hear the tornado." It was a train. A loud one. Still, good instinct to call.',
  'Somebody called because they found a turtle crossing the road and wanted traffic stopped. A deputy happened to be nearby and helped the turtle across. Took four minutes. Very slow turtle.',
  'A lady called because there was a deer in her living room. It came through the patio door, looked around, and left the way it came. Deputy took a report. The deer was not charged.',
  'We once had a caller who only spoke in rhymes because he was "too nervous to talk normally." The address rhymed too. We found him fine.',
  'An older farmer called because his cows were "acting strange." They were standing in a perfect circle. It turned out they were just staying warm. He felt silly. We didn\'t mind.',
];

/** Deals stories without repeats per character, persisted in browser storage. */
export class StoryTeller {
  constructor() {
    this.key = 'wc911_stories';
    try { this.state = JSON.parse(globalThis.localStorage?.getItem(this.key) || '{}'); } catch { this.state = {}; }
  }
  save() { try { globalThis.localStorage?.setItem(this.key, JSON.stringify(this.state)); } catch { /* ignore */ } }
  poolFor(id) {
    const own = STORIES[id] || [];
    // characters without their own list mostly tell shared floor legends; others mix a few in
    return own.length ? [...own.map((t, i) => `${id}:${i}`), ...SHARED_STORIES.slice(0, 6).map((t, i) => `shared:${(i + id.length) % SHARED_STORIES.length}`)] : SHARED_STORIES.map((t, i) => `shared:${i}`);
  }
  text(ref) { const [who, i] = ref.split(':'); return who === 'shared' ? SHARED_STORIES[+i] : STORIES[who][+i]; }
  next(id) {
    const st = (this.state[id] ||= { deck: [], last: [] });
    if (!st.deck.length) {
      const pool = this.poolFor(id).filter((r) => !st.last.includes(r));
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      st.deck = pool.length ? pool : this.poolFor(id);
    }
    const ref = st.deck.shift();
    st.last.push(ref); if (st.last.length > 3) st.last.shift();
    // never tell the same shared legend two characters in a row
    const g = (this.state._recentShared ||= []);
    if (ref.startsWith('shared:')) { g.push(ref); if (g.length > 5) g.shift(); }
    this.save();
    return this.text(ref);
  }
}
