# 911 Dispatch Simulator

A first-person 3D emergency communications center simulator that runs entirely in your web browser — on PC, Mac, iPhone, Android and tablets. Sit at your console in the **fictional regional 911 center in Carmi, Illinois**, answer calls from Carmi and every town and back road of White County, talk to callers (with your microphone or keyboard), create incidents, and send **any unit you want to any incident**.

**No API keys. No accounts. No servers. No paid services.** It's a static website.

*Developed by Drone Hive Studios | Developer @ndrone40*

> **This is an independently developed fictional emergency dispatch simulator inspired by White County, Illinois. It is not affiliated with, endorsed by, or operated by White County or any real emergency services agency.** All characters, calls, units and storylines are made up.

## What's new in this update
- **Carmi Police Department, rebuilt:** a larger two-story PD (24 × 52 m) next to dispatch, laid out like a working station. Ground floor: a spacious public lobby with the front desk window, waiting area, report kiosk and honor wall; records; a patrol wing up the spine corridor with roll call/briefing (20 seats), Patrol Sergeants and the Watch Commander's office, men's and women's locker rooms, report writing and evidence & property (intake with pass-through drop lockers, caged storage); two interview rooms with an observation room between them; an investigation room; the gun room leading to the range; the break room and janitor's closet. Upstairs: the Command Hall with the Captain's, Assistant Chief's and Chief's offices (plus the executive assistant), administration, a command conference room, training, major case and payroll, and the detective division (bullpen, detective sergeant, detective offices, investigation room). Every hallway has its own look (patrol hall, history & honor corridor, dispatch link, training corridor, administration and command halls) with framed photos, awards, bulletin boards and clear signage – room plaques over every door, hanging direction signs and a building directory at each stair. The Sheriff's wing keeps its own rooms (sally port, deputy briefing, armory, Sheriff's office), so the two agencies feel different rather than copied.
- **Everything works:** sit in any chair, sofa or bench (E to sit / stand), use the vending machine, open and close the fridge, sit at the break-room tables, open and latch bathroom stall doors (each stall has a real toilet, paper holder and partitions), walk both floors by the stairs, and walk out the automatic front doors to explore the lot and street.
- **Living NPCs:** officers, deputies, detectives, records clerks, supervisors and dispatchers follow daily routines — office work, breaks, restroom trips, range time, supervisor check-ins, investigations, conversations you can overhear (captions) — and head back to their posts afterwards. Seats and stalls are reserved so nobody sits on top of anyone.
- **Watch Commander roll call:** the WC waits for the shift to gather, then runs a real briefing — welcome, attendance, staffing and assignments, recent incidents, open problems, priorities and BOLOs, shift notes — with officers answering and asking questions before dismissal.
- **Graphics:** new materials with surface relief (brick, tile, carpet, wood), wet-pavement darkening in rain, a painted sky dome with sun, clouds and stars, falling rain/snow outdoors, better lighting, furniture, characters, roads, sidewalks and trees, plus level-of-detail and room-based culling so phones stay smooth.
- **Real White County shape:** the CAD map now uses the actual county outline (Wabash River on the east, the real river bends and Little Wabash), with towns, roads and townships warped onto true geography. Address numbering, the grid and dispatch functions all still work.

### Earlier update
- **Live map:** every section-line county road across White County (named on the county grid, e.g. *County Road 1200 E*), Brownsville at its real location (plus Stokes, Roland and Epworth), realistic roads with casings, lane and center-line markings, divided interstate, gabled roofs and building shadows, a **Day (aerial)** and **Night (CAD)** style, a place picker, and a 🌐 **region view** that zooms out to the surrounding counties, towns, the Wabash and Ohio rivers – clearly shaded as *outside the jurisdiction* (calls and incidents are only ever generated inside White County).
- **Station:** a real 3D town outside the windows (patrol lot, Main Cross St, downtown storefronts, houses, church, water tower, grain elevator) under a live sky with rain on the glass, a ceiling coffer with LED cove lighting, wainscoting, pilasters, door details, under-desk lighting, better wood and wall textures, properly proportioned flags, and fixed supervisor/director desks (monitors, chairs and seated characters now face the right way).
- **Armory & training range:** sign out training gear at the armory cage (eye/ear protection required), then shoot timed bullseye drills on a six-lane indoor range for a qualification score. Deputies use the range too.
- **Department schedule:** roll calls, shift changes, range training, a Fire/EMS coordination meeting, supervisor updates, announcements and night briefings at set game times. **Captain Nolan Drone**, **Watch Commander John Nolan** and **Fire Chief Bentley Allen** speak to the department (voice, PA, radio log) – click the notice to attend roll call in the briefing room.
- **Voices & speech-to-text:** the browser's most natural voices are chosen automatically, lines are spoken sentence by sentence with natural pauses, every character has their own voice fingerprint, and the mic picks the recognizer guess the caller engine understands best. Optional hands-free mode re-opens the mic after each caller reply.
- **Callers understand more:** plain-language questions, follow-ups ("what color?", "how bad?"), "how is he doing now?" status questions, related facts, and natural replies ("I don't know", "Okay, doing it now") instead of "I don't understand".
- **111 new call scenarios** (231 total) and a stronger anti-repeat that remembers recent calls across shifts.
- **Stories:** ~90 character-specific stories plus shared floor legends, dealt without repeats.
- **Weather:** rain and storms pass through (typically 20–45 game minutes), wet spells never run past ~90 minutes, and the sky eases between weather states.

---

## Play it

The game is plain HTML/CSS/JavaScript with no build step. Any static web server works:

```bash
# from the repository folder
python3 -m http.server 8080
# then open http://localhost:8080
```

**Netlify (recommended):** Add new site → Import from Git → pick this repository. There is no build command; `netlify.toml` already sets the publish directory to the repo root and the right headers. Every push to `main` redeploys automatically. (Or drag the folder onto app.netlify.com/drop.)

**Add to Home Screen:** the site is an installable web app. On iPhone/iPad open it in Safari → Share → *Add to Home Screen*; on Android open it in Chrome → ⋮ → *Add to Home screen / Install app*. It gets the game's logo as its icon (`icons/`), opens full screen, and keeps working offline after the first visit (`sw.js`). The logo source is `icons/logo.svg`; regenerate the PNG sizes with `node tools/make-icons.mjs` (needs the `sharp` package).

**GitHub Pages** also works: Settings → Pages → Deploy from branch → `main` / root.

> Opening `index.html` directly from disk (`file://`) won't work because browsers block ES modules there — use a local server or Netlify.

## The setting: Carmi & White County, Illinois

You're stationed at the 911 center in **Carmi**, the county seat, but you dispatch for **all of White County**: Carmi, Norris City, Grayville, Crossville, Enfield, Mill Shoals, Burnt Prairie, plus the villages of Springerton, Phillipstown, Herald, Emma and Maunie and every rural road in between.

- **Real highway layout:** I-64 (mile markers 117–130), US-45, IL-1, IL-14 (and the IL-14 / IL-1 run between Carmi and Crossville), IL-141, plus county roads like Burnt Prairie Rd, Springerton Rd, Maunie Rd, Herald Rd and Wabash River Rd.
- **Rivers:** the Little Wabash through Carmi, the Skillet Fork, and the Wabash River along the Indiana line.
- **Carmi streets** (Main St, Main Cross St, Robinson, Fair, Oak, Walnut, Church, Jessup, Slocumb, Kerney, Locust, College Blvd, Stewart, Rice and more). Town street grids and exact positions are a simplified, game-friendly approximation — not a survey-accurate map. Distances are compressed about 3× so drives take minutes instead of half an hour, while staying in proportion (Carmi → Grayville is still the long run).
- **Rural addresses** ("2145 Burnt Prairie Rd"), interstate mile markers, and town addresses ("412 W Main St, Carmi") all work in the CAD and when callers give them.
- **Rural White County calls:** grain bin entrapments, tractor rollovers, combine/field fires, oil-field tank battery fires and H2S releases, barn fires, livestock on the road, deer strikes, hunters hurt in the river bottoms, boats on the Wabash.
- Hospitals: Riverbend Medical Center locally, with transfers to Evansville, Eldorado and Fairfield. Mutual aid from Hamilton, Wayne, Gallatin and Edwards counties.

### Thanksgiving
Every November the center is decorated: harvest banners, leaf garlands around the video wall, hay bales and pumpkins, a pumpkin on every console, and a potluck table in the break room with a turkey and pies. Holiday calls (turkey fryer fires, family disputes, holiday travel crashes) show up more often. Settings → Interface → *Holiday decorations* lets you force it on or off.

## Features

### The dispatch center (3D, first person)
- Main floor with 8 three-monitor dispatch consoles, privacy partitions, radio consoles, phones and chairs
- Live **video wall** (operations stats, city map, active incidents), **news TVs** whose ticker reports your actual incidents, **department status boards**, working wall clock
- Windows looking out on a real 3D small town — patrol lot, street, storefronts, houses, water tower, church steeple, grain elevator, seasonal trees — lit for the **time of day** and **weather** (rain on the glass, snow, fog that swallows the distance, lightning)
- Corridor, **break room** (coffee, fridge, vending machine, TV, couch), **supervisor office**, **radio equipment room**, **director's office**
- **County Sheriff's Office wing** through the west end of the corridor: men's and women's restrooms, deputy locker room, briefing / roll-call room, **armory** (rifle and shotgun racks, handgun wall, ammo cabinets, riot shields, helmets and vests, cleaning bench, clearing barrel), evidence/property room, the Sheriff's office and a **sally port** garage with marked Sheriff patrol cars
- Coworkers who work their consoles, take coffee breaks and walk the floor; visiting police, fire and EMS personnel drop by; the Captain works from his office and the Watch Commander runs the briefing room
- **Indoor training range** north of the armory, with an equipment checkout system
- Your three desk monitors show your real CAD, map and radio log

### Computer-Aided Dispatch (CAD)
- **Calls:** phone line queue with ANI/ALI (caller ID and phone location — landline addresses, wireless Phase II estimates), live transcript, mic/text input, context-aware suggested questions, caller mood meter, auto-filling call information, incident creation, linking duplicate callers, hold, callback for abandoned calls
- **Incidents:** list with filters (beat and assigned units at a glance), full detail with elapsed / time-to-dispatch / time-to-scene timers, jurisdiction (municipality, township, law agency, beat, fire district, EMS zone, ESN, map grid, coordinates), response plan with distances, premise hazard notes, prior calls at the address, a unit time-stamp table, and (edit type/priority/status/location, notes, timeline, transcript, assignment history), resource requests from units on scene, BOLO broadcasts, delegate to coworkers
- **Unit assignment:** every department, every unit, live status and ETA, search, filters, multi-select, *optional* recommendations, reassign, remove, availability override (sandbox) — nothing is ever silently ignored
- **Map:** zoom, pan, pinch, click incidents/units/facilities, live unit movement along real roads, routes, city events, wireless caller location circles. Detailed White County terrain – crop fields with row direction, woodlots and hedgerows, farm ponds and oxbow lakes, farmsteads with barns and grain bins, oil lease roads, the rail line, bridges, township names, street trees, driveways, pools and parking lots – plus detailed station sites (police and sheriff lots with marked squad cars, sally ports and radio towers; fire apparatus bays; ambulance bays; the hospital with ER and helipad). Scale bar and north arrow.
- **Radio:** 9 channels, monitor/mute per channel, volume, transcript, talk to units (status, ETA, update, "need anything?", return, cancel — or free text / microphone)
- Units, Departments, Status board & notifications, History, Reports, Supervisor tools, Settings
- Adapts from **three side-by-side monitors** on wide screens to **two**, to a **tabbed single screen** on phones

### Departments & units (~125 units, configurable up to ~200)
Police (Patrol, Traffic, Supervisors, Detectives, CID, K-9, SWAT, Gang, Cybercrime, CSI, Bomb Squad, Aviation, Marine, Special Investigations), Sheriff, Federal (FBI, DEA, Federal Investigators, Task Force), Fire (Engines, Ladders, Heavy Rescue, Investigation, HazMat, Technical Rescue, Wildland, Fire Marshal, Battalion Chiefs, Safety Officers), EMS (BLS, ALS, Paramedics, Ambulances, Supervisor, Critical Care, Air Medical), Emergency Management, Search & Rescue, Public Works, Animal Control, DOT, Utilities, Coast Guard, Disaster Response, Mobile Command.

Units have statuses (Available, Assigned, Responding, On Scene, Transporting, Busy, Out of Service, Returning to Station, Clearing), drive along the road network from their home stations, transport patients to hospitals, self-initiate traffic stops, and have their own radio personalities.

### Calls & scenarios
- **231 scenario templates** with procedural variation (locations, callers, personalities, details, vehicles, suspects, developments) — thousands of distinct calls
- Mostly everyday calls (noise, parking, alarms, fender benders, welfare checks…), regular medium incidents, and occasional major ones (structure fires, pileups, shootings, hazmat, severe weather…)
- Misdials, pocket-dials, prank calls and non-emergency questions
- Incidents evolve: fires spread, suspects flee, patients deteriorate — and units radio for what they need
- Weather and city events (road closures, outages, public events) change what kinds of calls come in

### Talking to callers
- Browser speech recognition (Chrome, Edge, Safari) and text-to-speech; every caller gets a consistent voice matched to their sex, age and personality
- Local intent recognition understands many phrasings ("Where are you?", "What's your location?", "Can you tell me where this happened?"…), splits compound questions, tolerates recognition typos, and recognizes address read-backs ("fourteen twenty-three Elm")
- Callers remember what they've said, get irritated when asked the same thing repeatedly, calm down when reassured or given instructions (CPR, pressure on wounds, evacuate, stay away…), and calmer callers give better information
- Fully playable without a microphone — type or tap suggested questions
- Talk to coworkers, the supervisor (workload reports, break approval), the training officer (tips), the director (career progress), and visiting responders

### Modes & progression
- **Free Play** — configure frequency, departments, unit counts, incident types, weather, time of day and realism
- **Career** — Dispatcher Trainee → Junior → Senior → Dispatch Supervisor → Communications Director, with unlocks (AVL route overlay, third monitor, call delegation, supervisor tools, mutual aid, 4K video wall, espresso machine…)
- **Custom Shift** — set shift length, difficulty, weather and more, then get a shift report
- **Training** — a 14-step guided tutorial
- Relaxed by design: no countdowns, no game over, no penalties — only bonuses. Pause anytime, take breaks, 1×/2×/4× time speed.

### Department life
- Daily schedule (on the corridor shift board): roll call 06:45 / 18:45, shift change 07:00 / 19:00, range training 10:00, Fire/EMS meeting 11:30, supervisor update 14:00, announcement 16:00, night briefing 22:00, mid-watch check-in 02:00
- Leadership: Captain Nolan Drone, Watch Commander John Nolan, Fire Chief Bentley Allen (all fictional)

### Saving
Automatic and manual saves in browser storage, resume an in-progress shift, and **export/import** a save file (or copy/paste text) to move progress between devices. There is no cloud sync.

## Controls

| PC | |
|---|---|
| W A S D / arrows | Move / turn |
| Mouse | Look |
| E | Interact / sit |
| Tab | Go to your console |
| Esc | Stand up / pause menu |
| At the console | **A** answer · **T** type · **F2** microphone · **Ctrl+Enter** create incident · **U** assign units · **F4** end call · **C I M R N D H B** switch screens · **P** pause |

**Mobile:** left joystick to walk, drag the right side to look, **USE** to interact, **DESK** to jump to your console. The CAD uses tabs along the bottom.

## Graphics settings

*Settings → Graphics* (or the CAD's ⚙ Settings screen, mid-shift) has four presets that apply instantly — no reload:

| Preset | What you get | Good for |
|---|---|---|
| **Low** | Rounded furniture, new textures, contact shadows, 4 lights, 70% resolution, no post effects | Older phones, Chromebooks |
| **Medium** | + full prop detail, baked soft shadows, reflections, FXAA anti-aliasing, vignette | Most phones and laptops |
| **High** | + extra detail (casters, sprinklers, desk mics, plant leaves), 4× MSAA, softer shadows, screen glow (bloom) | Desktops, recent laptops |
| **Ultra** | + 12 lights, 9-tap shadows, moving shadows for people, up to 2× device resolution | Gaming PCs |

**Auto** picks a preset for your device. **Adaptive performance** (on by default) watches the frame rate and, if the game starts to lag, lowers resolution first, then effects, then the preset — smooth gameplay always wins over looks. Everything is procedural (no texture downloads), the static scene is merged into ~60 draw calls, shadows are baked once instead of every frame, and the game recovers automatically if the browser resets the GPU.

## Honest notes about the technology

- **3D renderer:** Three.js was recommended, but this project was built in an environment with no internet access, so it ships with a small purpose-built **WebGL2 renderer** instead (per-pixel lighting with up to 12 point lights, baked shadow maps, environment reflections, MSAA/FXAA, bloom, emissive live screens, fog, ACES tone mapping, static batching). It has no external dependencies, so the site works offline and on any static host. The renderer is isolated in `js/engine/`, so it could be swapped for Three.js later. If WebGL2 is unavailable, the game falls back to console-only mode — every dispatch feature still works.
- **Conversations:** the caller engine is a local, rule-based system with intent recognition, memory and personality. It understands a wide range of phrasings, but it is **not** a large language model and can misunderstand unusual sentences — suggested questions always work.
- **Optional local AI:** in *Settings → Speech & AI* you can connect a free model running on your own computer via [Ollama](https://ollama.com) or LM Studio. It only rephrases caller lines in character; the game's engine still decides what callers know, and any failure falls back instantly. Never required, no keys. (For Ollama, start it with `OLLAMA_ORIGINS="*"` so the browser may connect.)
- **Speech recognition** availability depends on the browser (Chrome, Edge and Safari support it; Firefox doesn't yet).
- **Audio** is synthesized with Web Audio — no sound files.

## Project structure

```
index.html            entry page
manifest.webmanifest  home-screen app manifest · sw.js offline cache · netlify.toml hosting config
icons/                game logo (logo.svg) and home-screen icons · tools/make-icons.mjs regenerates them
css/                  global + CAD styles
js/core/              event bus, utilities, settings, save system
js/data/              departments & units, incident types, White County map (city.js), scenario library
js/sim/               headless simulation: units, incidents, calls, radio, weather, events, career
js/ai/                NLU, caller conversation engine, dialogue, staff dialogue, speech, optional LLM
js/engine/            WebGL renderer, geometry, procedural textures
js/world/             3D building, police department (policeDept.js, furniture.js, shell.js),
                      doors, NPC routines, player controller, weather, screen textures
js/ui/                CAD screens, menus, HUD, tutorial, settings
js/audio/             procedural audio
tests/                logic tests (Node) and browser tests (Playwright)
```

### Extending
- **New department or unit type:** add entries to `js/data/departments.js` — the CAD, map, radio, recommendations and setup screens pick them up automatically.
- **New scenarios:** add a template to any file in `js/data/scenarios/` (see existing ones for facts, developments, size-ups and caller instructions).
- **New incident types:** `js/data/incidentTypes.js`.

## Map data note
Highway corridors, rivers, towns and the communities on the map are placed from real coordinates (see `GEO` / `geoToGame` in `js/data/city.js`). The section-line county roads follow Illinois' one-mile survey grid with realistic gaps (river bottoms, fields, only some bridges); they reproduce the *pattern* of White County's road network rather than a survey of every real road, and town street grids are simplified.

## Tests

```bash
npm test                         # 5,700+ headless logic checks + the police station layout audit (Node 18+)
node tests/pd-layout-test.js     # PD audit only: wall items flush with walls and clear of doors/windows, furniture out of doorways and walls, NPC routes through doors only, every room reachable (--verbose lists room sizes)
python3 tests/browser_test.py    # desktop/mobile/tablet playthrough in headless Chrome (needs Playwright)
python3 tests/training_test.py   # plays the full tutorial
python3 tests/graphics_test.py   # every preset: stats, screenshots, leak/adaptive/context-loss checks
```

## Legal, privacy & license

- **Fictional:** This is an independently developed fictional emergency dispatch simulator inspired by White County, Illinois. It is not affiliated with, endorsed by, or operated by White County or any real emergency services agency.
- **Names:** All agencies, hospitals, businesses, schools, units, people and calls in the game are fictional or generic. Real town, county and road names are used only to describe the setting.
- **Privacy:** No accounts, ads, analytics or tracking. Saves stay in your browser. Microphone speech recognition is handled by your browser (some browsers send the audio to their own speech service); typing always works instead.
- **License:** © 2026 Drone Hive Studios. All rights reserved. See [LICENSE](LICENSE).
