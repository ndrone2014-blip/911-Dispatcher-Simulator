# 911 Dispatch Simulator

A first-person 3D emergency communications center simulator that runs entirely in your web browser — on PC, Mac, iPhone, Android and tablets. Sit at your console in the **White County Emergency Communications center in Carmi, Illinois**, answer calls from Carmi and every town and back road of White County, talk to callers (with your microphone or keyboard), create incidents, and send **any unit you want to any incident**.

**No API keys. No accounts. No servers. No paid services.** It's a static website.

*Developed by Drone Hive Studios | Developer @ndrone40*

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
- Hospitals: Carmi Township Hospital locally, with transfers to Evansville, Eldorado and Fairfield. Mutual aid from Hamilton, Wayne, Gallatin and Edwards counties.

### Thanksgiving
Every November the center is decorated: harvest banners, leaf garlands around the video wall, hay bales and pumpkins, a pumpkin on every console, and a potluck table in the break room with a turkey and pies. Holiday calls (turkey fryer fires, family disputes, holiday travel crashes) show up more often. Settings → Interface → *Holiday decorations* lets you force it on or off.

## Features

### The dispatch center (3D, first person)
- Main floor with 8 three-monitor dispatch consoles, privacy partitions, radio consoles, phones and chairs
- Live **video wall** (operations stats, city map, active incidents), **news TVs** whose ticker reports your actual incidents, **department status boards**, working wall clock
- Windows looking out on Carmi — water tower, church steeple, grain elevators, autumn trees — that follows the **time of day** and **weather** (rain, snow, fog, thunderstorms with lightning and thunder)
- Corridor, **break room** (coffee, fridge, vending machine, TV, couch), **supervisor office**, **radio equipment room**, **director's office**
- Coworkers who work their consoles, take coffee breaks and walk the floor; visiting police, fire and EMS personnel drop by the break room
- Your three desk monitors show your real CAD, map and radio log

### Computer-Aided Dispatch (CAD)
- **Calls:** phone line queue with ANI/ALI (caller ID and phone location — landline addresses, wireless Phase II estimates), live transcript, mic/text input, context-aware suggested questions, caller mood meter, auto-filling call information, incident creation, linking duplicate callers, hold, callback for abandoned calls
- **Incidents:** list with filters, full detail (edit type/priority/status/location, notes, timeline, transcript, assignment history), resource requests from units on scene, BOLO broadcasts, delegate to coworkers
- **Unit assignment:** every department, every unit, live status and ETA, search, filters, multi-select, *optional* recommendations, reassign, remove, availability override (sandbox) — nothing is ever silently ignored
- **Map:** zoom, pan, pinch, click incidents/units/facilities, live unit movement along real roads, routes, city events, wireless caller location circles
- **Radio:** 9 channels, monitor/mute per channel, volume, transcript, talk to units (status, ETA, update, "need anything?", return, cancel — or free text / microphone)
- Units, Departments, Status board & notifications, History, Reports, Supervisor tools, Settings
- Adapts from **three side-by-side monitors** on wide screens to **two**, to a **tabbed single screen** on phones

### Departments & units (~125 units, configurable up to ~200)
Police (Patrol, Traffic, Supervisors, Detectives, CID, K-9, SWAT, Gang, Cybercrime, CSI, Bomb Squad, Aviation, Marine, Special Investigations), Sheriff, Federal (FBI, DEA, Federal Investigators, Task Force), Fire (Engines, Ladders, Heavy Rescue, Investigation, HazMat, Technical Rescue, Wildland, Fire Marshal, Battalion Chiefs, Safety Officers), EMS (BLS, ALS, Paramedics, Ambulances, Supervisor, Critical Care, LifeFlight), Emergency Management, Search & Rescue, Public Works, Animal Control, DOT, Utilities, Coast Guard, Disaster Response, Mobile Command.

Units have statuses (Available, Assigned, Responding, On Scene, Transporting, Busy, Out of Service, Returning to Station, Clearing), drive along the road network from their home stations, transport patients to hospitals, self-initiate traffic stops, and have their own radio personalities.

### Calls & scenarios
- **120 scenario templates** with procedural variation (locations, callers, personalities, details, vehicles, suspects, developments) — thousands of distinct calls
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

## Honest notes about the technology

- **3D renderer:** Three.js was recommended, but this project was built in an environment with no internet access, so it ships with a small purpose-built **WebGL2 renderer** instead (per-pixel lighting with the nearest 3–8 point lights, emissive live screens, fog, ACES tone mapping, transparency, static batching). It has no external dependencies, so the site works offline and on any static host. The renderer is isolated in `js/engine/`, so it could be swapped for Three.js later. If WebGL2 is unavailable, the game falls back to console-only mode — every dispatch feature still works.
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
js/world/             3D building, NPCs, player controller, screen textures
js/ui/                CAD screens, menus, HUD, tutorial, settings
js/audio/             procedural audio
tests/                logic tests (Node) and browser tests (Playwright)
```

### Extending
- **New department or unit type:** add entries to `js/data/departments.js` — the CAD, map, radio, recommendations and setup screens pick them up automatically.
- **New scenarios:** add a template to any file in `js/data/scenarios/` (see existing ones for facts, developments, size-ups and caller instructions).
- **New incident types:** `js/data/incidentTypes.js`.

## Tests

```bash
npm test                         # 3,000+ headless logic checks (Node 18+)
python3 tests/browser_test.py    # desktop/mobile/tablet playthrough in headless Chrome (needs Playwright)
python3 tests/training_test.py   # plays the full tutorial
```
