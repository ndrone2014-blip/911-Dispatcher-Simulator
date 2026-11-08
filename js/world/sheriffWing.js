// White County Sheriff's Office wing (west of the 911 center).
//
//            x: -42 ........ -30 ........ -22 ........ -12 | 911 center
//   z -8  ┌──────────────┬──────────────┬──────────────┐
//         │   (outside)  │  EVIDENCE /  │   ARMORY     │
//   z -2  ├──────────────┤  PROPERTY    │  (cage door) │
//         │              │              ├──────────────┤ z 0
//         │  SALLY PORT  ├──────────────┤  BRIEFING /  │
//         │  (garage,    │  SHERIFF'S   │  ROLL CALL   │
//         │   squad cars)│  OFFICE      │              │
//   z 8   │              ├──────────────┴──────────────┤ ← hallway door from the 911 corridor
//         │      ◄───────┤        HALLWAY              │
//   z10.6 │              ├────────────┬───────┬───────┤
//         │              │ LOCKER /   │WOMEN'S│ MEN'S │ z 14.6
//         │              │ DUTY ROOM  ├───────┴───────┤
//   z 18  └──────────────┴────────────┴───────────────┘
//
// Everything is merged into the shared material batches, so the wing adds vertices
// and a handful of draw calls, never per-object draws.
import { MeshBuilder } from '../engine/geometry.js';

export function buildSheriffWing(k) {
  const { mb, col, wallSeg, floor, ceiling, light, door, screen, interactables, tableChair, chair, plant, D, H } = k;
  const R = (cx, cz, rot) => { const c = Math.cos(rot), s = Math.sin(rot); return (dx, dz) => [cx + dx * c + dz * s, cz - dx * s + dz * c]; };

  // ---------------- shell ----------------
  floor(-30, 8, -12, 10.6, 'carpetDark', 1.2); ceiling(-30, 8, -12, 10.6);           // hallway
  floor(-22, 0, -12, 8, 'carpet', 1.2); ceiling(-22, 0, -12, 8);                       // briefing
  floor(-22, -8, -12, 0, 'tile', 1.2); ceiling(-22, -8, -12, 0);                       // armory (sealed concrete-look tile)
  floor(-30, 2, -22, 8, 'carpetDark', 1.2); ceiling(-30, 2, -22, 8);                   // sheriff's office
  floor(-30, -8, -22, 2, 'tile', 1.2); ceiling(-30, -8, -22, 2);                       // evidence
  floor(-19, 10.6, -12, 14.6, 'tile', 1.2); ceiling(-19, 10.6, -12, 14.6);             // restrooms
  floor(-30, 10.6, -19, 18, 'tile', 1.2); ceiling(-30, 10.6, -19, 18);                 // locker room
  floor(-42, -2, -30, 18, 'concrete', 2.5); ceiling(-42, -2, -30, 18);                 // sally port

  // outer walls
  wallSeg(-42, -2, -42, 18, 'concrete'); wallSeg(-42, 18, -12, 18); wallSeg(-42, -2, -30, -2, 'concrete');
  // north wall with the door from the armory into the training range (x -13.9..-12.7)
  wallSeg(-30, -8, -13.9, -8); wallSeg(-12.7, -8, -12, -8); wallSeg(-13.9, -8, -12.7, -8, 'wall', 2.3, H, false);
  // hallway north side: doors to briefing (x -15.5..-14) and sheriff's office (x -27.4..-26.2)
  wallSeg(-22, 8, -15.5, 8); wallSeg(-14, 8, -12, 8); wallSeg(-15.5, 8, -14, 8, 'wall', 2.3, H, false);
  wallSeg(-30, 8, -27.4, 8); wallSeg(-26.2, 8, -22, 8); wallSeg(-27.4, 8, -26.2, 8, 'wall', 2.3, H, false);
  // hallway south side: men's (x -14.4..-13.4), women's (x -17.9..-16.9), locker room (x -24.6..-23.4)
  wallSeg(-15, 10.6, -14.4, 10.6); wallSeg(-13.4, 10.6, -12, 10.6); wallSeg(-14.4, 10.6, -13.4, 10.6, 'wall', 2.3, H, false);
  wallSeg(-19, 10.6, -17.9, 10.6); wallSeg(-16.9, 10.6, -15, 10.6); wallSeg(-17.9, 10.6, -16.9, 10.6, 'wall', 2.3, H, false);
  wallSeg(-30, 10.6, -24.6, 10.6); wallSeg(-23.4, 10.6, -19, 10.6); wallSeg(-24.6, 10.6, -23.4, 10.6, 'wall', 2.3, H, false);
  // hallway west end → sally port door (z 8.6..10.0)
  wallSeg(-30, 2, -30, 8, 'wall'); wallSeg(-30, 10.6, -30, 18);
  wallSeg(-30, 8, -30, 8.6); wallSeg(-30, 10.0, -30, 10.6); wallSeg(-30, 8.6, -30, 10.0, 'wall', 2.3, H, false);
  // evidence room west wall with intake door from the garage (z -1.6..-0.4)
  wallSeg(-30, -8, -30, -1.6); wallSeg(-30, -0.4, -30, 2); wallSeg(-30, -1.6, -30, -0.4, 'wall', 2.3, H, false);
  // interior partitions
  wallSeg(-22, -8, -22, 0); wallSeg(-22, 0, -22, 8);                                    // armory+briefing | evidence+office
  wallSeg(-30, 2, -22, 2);                                                              // office | evidence
  wallSeg(-22, 0, -14.6, 0); wallSeg(-13.2, 0, -12, 0); wallSeg(-14.6, 0, -13.2, 0, 'wall', 2.3, H, false); // armory door
  wallSeg(-19, 10.6, -19, 18); wallSeg(-15.5, 10.6, -15.5, 14.6); wallSeg(-19, 14.6, -12, 14.6);
  // the 911 center's west wall already exists from z -8..8; restroom/storage block behind it is closed

  for (const [x0, x1, z] of [[-15.5, -14, 8], [-27.4, -26.2, 8], [-14.4, -13.4, 10.6], [-17.9, -16.9, 10.6], [-24.6, -23.4, 10.6]]) {
    mb('frame').box(x0, 1.15, z, 0.08, 2.3, 0.22); mb('frame').box(x1, 1.15, z, 0.08, 2.3, 0.22); mb('frame').box((x0 + x1) / 2, 2.32, z, x1 - x0 + 0.08, 0.06, 0.22);
    door(x0, x1, z, -1);
  }
  for (const [z0, z1] of [[8.6, 10.0], [-1.6, -0.4]]) {
    mb('frame').box(-30, 1.15, z0, 0.22, 2.3, 0.08); mb('frame').box(-30, 1.15, z1, 0.22, 2.3, 0.08); mb('frame').box(-30, 2.32, (z0 + z1) / 2, 0.22, 0.06, z1 - z0 + 0.08);
  }
  // steel security door into the garage (solid, propped open) and barred armory gate
  mb('metal').box(-30.14, 1.12, 10.72, 0.05, 2.22, 1.32);

  // ---------------- lights ----------------
  for (const x of [-26, -20, -14.5]) light(x, 9.3, 'corridor', H - 0.05, 1.0, 0.5);
  light(-17, 2.4, 'brief'); light(-17, 5.8, 'brief');
  light(-17, -5.6, 'armory'); light(-17, -2.2, 'armory');
  light(-26, 5, 'super'); light(-26, -1.5, 'radio'); light(-26, -5.5, 'radio');
  light(-14, 12.6, 'break'); light(-17.3, 12.6, 'break'); light(-24.5, 14.3, 'break');
  for (const z of [1.5, 8, 14.5]) light(-36, z, 'garage', H - 0.05, 1.4, 0.5);

  // ---------------- signs ----------------
  screen('sign_brief', 'sign', -14.75, 2.55, 8.12, 1.5, 0.24, 'z', 1, 0, { text: 'BRIEFING / ROLL CALL' });
  screen('sign_sheriff', 'sign', -26.8, 2.55, 8.12, 1.6, 0.24, 'z', 1, 0, { text: 'SHERIFF' });
  screen('sign_men', 'sign', -13.9, 2.55, 10.48, 0.9, 0.24, 'z', -1, 0, { text: "MEN'S ♂" });
  screen('sign_women', 'sign', -17.4, 2.55, 10.48, 0.9, 0.24, 'z', -1, 0, { text: "WOMEN'S ♀" });
  screen('sign_locker', 'sign', -24.0, 2.55, 10.48, 1.4, 0.24, 'z', -1, 0, { text: 'DEPUTY LOCKER ROOM' });
  screen('sign_sally', 'sign', -29.88, 2.55, 9.3, 1.2, 0.24, 'x', 1, 0, { text: 'SALLY PORT' });
  screen('sign_armory', 'sign', -13.9, 2.55, 0.12, 1.9, 0.24, 'z', 1, 0, { text: 'ARMORY · AUTHORIZED ONLY' });
  screen('sign_evidence', 'sign', -30.12, 2.55, -1.0, 1.2, 0.24, 'x', -1, 0, { text: 'EVIDENCE INTAKE' });
  screen('sign_wing', 'sign', -12.1, 2.75, 9.3, 2.2, 0.24, 'x', -1, 0, { text: "WHITE COUNTY SHERIFF'S OFFICE" });

  // ---------------- briefing / roll call ----------------
  mb('blackgloss').box(-21.9, 1.75, 4, 0.06, 1.15, 2.0); mb('briefing').panel(-21.86, 1.75, 4, 1.9, 1.07, 'x', 1);  // wall display
  mb('satin').rbox(-20.9, 0.55, 4, 0.5, 1.1, 0.6, { r: 0.04, color: [0.32, 0.22, 0.14] }); // podium
  mb('satin').rbox(-20.9, 1.13, 4, 0.56, 0.05, 0.66, { r: 0.02, color: [0.26, 0.18, 0.11] });
  mb('whiteboard').panel(-17, 1.6, 0.09, 3.0, 1.2, 'z', 1); mb('frame').box(-17, 1.6, 0.07, 3.08, 1.28, 0.03);
  mb('cork').panel(-12.09, 1.6, 4.5, 1.5, 0.94, 'x', -1); mb('satin').box(-12.07, 1.6, 4.5, 0.03, 1.0, 1.56, { color: [0.36, 0.25, 0.14] });
  for (const x of [-19.0, -16.6, -14.2]) {
    mb('laminate').rbox(x, 0.74, 4, 0.7, 0.04, 4.2, { r: 0.01, uv: 1 });
    for (const dz of [-1.9, 1.9]) mb('frame').box(x, 0.37, 4 + dz, 0.6, 0.72, 0.05);
    for (const z of [2.6, 3.6, 4.6, 5.6]) tableChair(x + 0.55, z, Math.PI / 2);
    col(x - 0.38, 1.85, x + 0.38, 6.15);
  }
  mb('satin').rbox(-12.4, 0.45, 1.2, 0.5, 0.9, 1.2, { r: 0.015, color: [0.3, 0.3, 0.32] }); // coffee counter
  mb('satin').box(-12.4, 1.1, 1.0, 0.3, 0.4, 0.3, { color: [0.08, 0.08, 0.09] }); col(-12.7, 0.6, -12, 1.8);
  plant(-21.5, 7.5, 0.9);
  interactables.push({ id: 'briefing', kind: 'briefing', label: 'Read the roll-call briefing', min: [-22, 0.8, 2.8], max: [-20.4, 2.4, 5.2], pri: 1 });

  // ---------------- armory ----------------
  const DARK = [0.045, 0.047, 0.05], STEEL = [0.34, 0.37, 0.4], OD = [0.24, 0.28, 0.22];
  // barred cage gate swung open against the briefing-room wall
  for (let i = 0; i < 9; i++) mb('chrome').cylinder(-14.55 - 0.02 + i * 0.16 - 1.3, 1.1, -0.12, 0.012, 2.2, 6);
  mb('satin').box(-15.2, 2.2, -0.12, 1.4, 0.05, 0.05, { color: STEEL }); mb('satin').box(-15.2, 0.05, -0.12, 1.4, 0.05, 0.05, { color: STEEL }); mb('satin').box(-15.2, 1.1, -0.12, 1.4, 0.04, 0.04, { color: STEEL });
  // rifle rack cabinet along the north wall
  const rifle = (x, z) => {
    mb('satin').box(x, 1.02, z, 0.045, 0.24, 0.05, { color: DARK });                      // stock
    mb('satin').box(x, 1.27, z, 0.05, 0.26, 0.06, { color: DARK });                       // receiver
    mb('satin').box(x + 0.06, 1.22, z, 0.07, 0.14, 0.03, { rotY: 0, color: DARK });       // magazine
    mb('satin').box(x - 0.045, 1.33, z, 0.04, 0.12, 0.04, { color: [0.02, 0.02, 0.02] }); // optic
    mb('satin').box(x, 1.52, z, 0.04, 0.24, 0.045, { color: DARK });                      // handguard
    mb('satin').cylinder(x, 1.75, z, 0.009, 0.22, 6, { color: DARK });                    // barrel
  };
  const shotgun = (x, z) => {
    mb('wood').box(x, 1.03, z, 0.045, 0.26, 0.05, { uv: 0 });
    mb('satin').box(x, 1.25, z, 0.045, 0.2, 0.055, { color: DARK });
    mb('wood').box(x + 0.025, 1.45, z, 0.03, 0.18, 0.04, { uv: 0 });
    mb('satin').cylinder(x, 1.65, z, 0.011, 0.6, 6, { color: DARK }); mb('satin').cylinder(x + 0.025, 1.55, z, 0.009, 0.42, 6, { color: DARK });
  };
  mb('satin').rbox(-17.6, 1.2, -7.72, 6.6, 2.4, 0.5, { r: 0.01, color: [0.2, 0.22, 0.24] });     // back panel / cabinet body
  mb('satin').box(-17.6, 0.88, -7.44, 6.4, 0.04, 0.12, { color: [0.12, 0.13, 0.14] });            // butt shelf
  mb('satin').box(-17.6, 1.9, -7.44, 6.4, 0.06, 0.1, { color: [0.12, 0.13, 0.14] });              // barrel retainer bar
  for (let i = 0; i < 14; i++) rifle(-20.6 + i * 0.26, -7.4);
  for (let i = 0; i < 8; i++) shotgun(-16.8 + i * 0.26, -7.4);
  mb('satin').box(-17.6, 2.45, -7.5, 6.6, 0.1, 0.5, { color: [0.16, 0.17, 0.19] });
  col(-21, -8, -14.2, -7.1);
  // handgun pegboard on the west wall
  mb('satin').box(-21.9, 1.5, -4.2, 0.03, 1.1, 2.6, { color: [0.62, 0.6, 0.55] });
  for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) {
    const z = -5.3 + q * 0.42, y = 1.15 + r * 0.25;
    mb('satin').box(-21.86, y + 0.035, z, 0.03, 0.035, 0.19, { color: DARK });                  // slide
    mb('satin').box(-21.86, y - 0.025, z - 0.06, 0.03, 0.09, 0.04, { rotY: 0, color: DARK });    // grip
  }
  // ammunition cabinets on the east wall
  for (let i = 0; i < 3; i++) {
    mb('satin').rbox(-12.35, 0.95, -6.6 + i * 1.0, 0.5, 1.9, 0.9, { r: 0.01, color: OD });
    mb('satin').box(-12.6, 1.0, -6.6 + i * 1.0, 0.01, 1.7, 0.012, { color: [0.12, 0.14, 0.11] });
    mb('chrome').box(-12.61, 1.05, -6.48 + i * 1.0, 0.02, 0.14, 0.025);
    mb('paper').box(-12.605, 1.7, -6.6 + i * 1.0, 0.004, 0.12, 0.3, { uv: 0 });
  }
  col(-12.6, -7.1, -12, -3.9);
  // riot gear: shields, helmets and vests on the south wall
  for (let i = 0; i < 5; i++) {
    mb('glassFrost').rbox(-21.4 + i * 0.5, 1.0, -0.35, 0.46, 1.1, 0.03, { r: 0.04 });
    mb('satin').box(-21.4 + i * 0.5, 1.25, -0.37, 0.3, 0.08, 0.004, { color: [0.9, 0.9, 0.9] });
  }
  for (let i = 0; i < 6; i++) { mb('satin').sphere(-21.4 + i * 0.42, 2.0, -0.28, 0.14, 12, 8, { sy: 0.85, color: [0.06, 0.06, 0.07] }); mb('glassFrost').box(-21.4 + i * 0.42, 1.94, -0.17, 0.2, 0.1, 0.01); }
  mb('satin').box(-18.9, 2.12, -0.12, 3.2, 0.03, 0.3, { color: STEEL });
  for (let i = 0; i < 5; i++) { mb('matte').rbox(-18.0 + i * 0.5, 1.3, -0.22, 0.42, 0.6, 0.12, { r: 0.05, color: [0.04, 0.04, 0.05] }); mb('satin').box(-18.0 + i * 0.5, 1.4, -0.29, 0.26, 0.07, 0.004, { color: [0.75, 0.7, 0.5] }); }
  col(-21.8, -0.6, -15.6, 0);
  // cleaning bench, gun safe, clearing barrel
  mb('satin').rbox(-17.4, 0.88, -4.0, 2.4, 0.06, 0.9, { r: 0.01, color: [0.36, 0.38, 0.4] });
  for (const [dx, dz] of [[-1.1, -0.38], [1.1, -0.38], [-1.1, 0.38], [1.1, 0.38]]) mb('satin').box(-17.4 + dx, 0.43, -4.0 + dz, 0.06, 0.86, 0.06, { color: STEEL });
  mb('matte').box(-17.6, 0.915, -4.0, 1.4, 0.01, 0.6, { color: [0.12, 0.25, 0.14] });
  mb('satin').box(-17.8, 0.94, -4.0, 0.8, 0.05, 0.07, { rotY: 0.2, color: DARK }); mb('satin').cylinder(-17.0, 0.95, -3.85, 0.04, 0.08, 10, { color: [0.7, 0.15, 0.1] });
  col(-18.7, -4.5, -16.1, -3.5);
  mb('satin').rbox(-21.4, 0.95, -6.2, 0.9, 1.9, 0.8, { r: 0.03, color: [0.1, 0.1, 0.11] }); mb('chrome').tube(-20.93, 1.1, -6.2, 0.07, 0.03, 'x', 16);
  col(-21.9, -6.65, -20.9, -5.75);
  mb('satin').cylinder(-13.0, 0.42, -0.9, 0.24, 0.84, 18, { color: [0.85, 0.65, 0.08] }); mb('matte').disc(-13.0, 0.845, -0.9, 0.2, 14, { color: [0.6, 0.5, 0.3] });
  col(-13.3, -1.2, -12.7, -0.6);
  interactables.push({ id: 'armory', kind: 'armory', label: 'Armory – check out equipment', min: [-21, 0, -8], max: [-14.2, 2.5, -6.8], pri: 1 });
  interactables.push({ id: 'armory_bench', kind: 'armory', label: 'Armory – check out equipment', min: [-22, 0.6, -5.4], max: [-21.4, 2.1, -3.0], pri: 1 });

  // ---------------- indoor training range (north of the armory) ----------------
  //   six lanes, firing line at z ≈ -10.6, targets out to z -24, rubber-block backstop at z -25.6
  floor(-22, -26, -12, -8, 'concrete', 2.5); ceiling(-22, -26, -12, -8);
  wallSeg(-22, -26, -22, -8, 'concrete'); wallSeg(-12, -26, -12, -8, 'concrete'); wallSeg(-22, -26, -12, -26, 'concrete');
  for (const [x0, x1, z] of [[-13.9, -12.7, -8]]) { mb('frame').box(x0, 1.15, z, 0.08, 2.3, 0.22); mb('frame').box(x1, 1.15, z, 0.08, 2.3, 0.22); mb('frame').box((x0 + x1) / 2, 2.32, z, x1 - x0 + 0.08, 0.06, 0.22); }
  mb('metal').box(-13.3, 1.12, -8.16, 1.12, 2.22, 0.05); // heavy range door, held open
  for (const z of [-11.5, -17, -22.5]) light(-17, z, 'armory', H - 0.05, 1.4, 0.5);
  const lanes = 6; const lw = 10 / lanes;
  for (let i = 0; i <= lanes; i++) { // shooting booths
    const x = -22 + i * lw;
    if (i > 0 && i < lanes) { mb('satin').rbox(x, 0.95, -10.55, 0.06, 1.9, 1.5, { r: 0.01, color: [0.5, 0.52, 0.55] }); col(x - 0.05, -11.3, x + 0.05, -9.8); }
    if (i < lanes) {
      const cx = x + lw / 2;
      mb('satin').rbox(cx, 1.0, -11.2, lw - 0.12, 0.05, 0.42, { r: 0.01, color: [0.36, 0.38, 0.4] });        // bench / shelf
      mb('satin').box(cx, 0.5, -11.38, lw - 0.2, 1.0, 0.04, { color: [0.2, 0.21, 0.23] });
      mb('satin').box(cx, 2.95, -11.0, 0.05, 0.05, 13.6, { color: [0.3, 0.31, 0.33] });                       // target carrier rail
      for (const [z, s2] of [[-15.5, 1], [-19.5, 0.9], [-23.5, 0.85]]) {
        if ((i + Math.round(z)) % 2 && z !== -15.5) continue;
        mb('satin').box(cx, 2.4, z, 0.03, 1.1, 0.03, { color: [0.25, 0.25, 0.27] });                         // hanger
        mb('rangeTarget').panel(cx, 1.55, z, 0.55 * s2, 0.7 * s2, 'z', 1);                                       // paper bullseye
      }
      mb('led').box(cx, 2.2, -11.39, 0.06, 0.03, 0.01);                                                        // lane status light
    }
  }
  col(-22, -11.45, -12, -11.0); // bench line (stay behind it)
  for (const z of [-13, -16.5, -20]) mb('satin').box(-17, 3.2, z, 10, 0.5, 0.12, { color: [0.16, 0.17, 0.19] }); // safety baffles
  mb('rubber').box(-17, 1.4, -25.7, 10, 2.8, 0.5, { uv: 0 });                                                  // backstop face
  mb('satin').box(-17, 2.95, -25.4, 10, 0.12, 1.0, { color: [0.12, 0.12, 0.13] });
  mb('beaconAmber').box(-13.3, 2.42, -8.24, 0.3, 0.08, 0.04);                                                   // "line hot" lamp
  if (D >= 1) { mb('satin').rbox(-21.3, 0.9, -9.2, 1.0, 1.8, 0.5, { r: 0.015, color: [0.24, 0.28, 0.22] }); col(-21.85, -9.5, -20.8, -8.9); } // range locker
  screen('sign_range', 'sign', -13.3, 2.55, -7.88, 1.7, 0.24, 'z', 1, 0, { text: 'RANGE · EYES & EARS REQUIRED' });
  screen('sign_range_in', 'sign', -17, 2.75, -8.13, 3.2, 0.3, 'z', -1, 0, { text: 'TRAINING RANGE · LINE COMMANDS FROM RANGE MASTER ONLY' });
  interactables.push({ id: 'range', kind: 'range', label: 'Step up to the firing line (training)', min: [-22, 0, -11.6], max: [-12, 2.2, -9.4], pri: 2 });

  // ---------------- sheriff's office ----------------
  mb('wood').rbox(-26, 0.74, 4.6, 2.2, 0.05, 1.0, { r: 0.015, uv: 1 }); mb('wood').box(-26, 0.37, 5.05, 2.2, 0.7, 0.05, { uv: 1 });
  for (const s of [-1, 1]) mb('wood').box(-26 + s * 1.05, 0.37, 4.6, 0.06, 0.72, 0.96, { uv: 1 });
  col(-27.15, 4.05, -24.85, 5.15);
  chair(-26, 3.6, Math.PI, true); tableChair(-26.5, 5.9, 0); tableChair(-25.5, 5.9, 0);
  mb('blackgloss').box(-26.3, 1.02, 4.6, 0.6, 0.36, 0.03, { uv: 0 }); mb('radiopanel').panel(-26.3, 1.02, 4.58, 0.56, 0.32, 'z', -1); mb('satin').box(-26.3, 0.86, 4.62, 0.05, 0.2, 0.05, { color: [0.07, 0.07, 0.08] });
  mb('phone').box(-25.3, 0.78, 4.6, 0.2, 0.004, 0.18, { faces: 'Y', uv: 0 }); mb('paper').box(-25.7, 0.77, 4.85, 0.22, 0.008, 0.3, { uv: 0 });
  mb('seal').panel(-26, 2.0, 2.11, 0.9, 0.9, 'z', 1);
  for (const [x, mat, fw, ar] of [[-28.8, 'flagUS', 0.86, 1.9], [-27.5, 'flagIL', 0.78, 1.667]]) { mb('chrome').cylinder(x, 1.25, 2.5, 0.018, 2.5, 8); mb('gold').sphere(x, 2.55, 2.5, 0.05, 10, 8); mb('gold').cylinder(x, 0.03, 2.5, 0.2, 0.06, 16); mb(mat).panel(x + 0.02 + fw / 2, 2.46 - fw / ar / 2, 2.52, fw, fw / ar, 'z', 1); col(x - 0.2, 2.3, x + 0.2, 2.7); } // true flag proportions
  mb('wood').box(-29.75, 1.1, 5.5, 0.4, 2.2, 2.0, { uv: 1 }); for (let i = 0; i < 4; i++) mb('books').box(-29.54, 0.5 + i * 0.5, 5.5, 0.02, 0.3, 1.8, { faces: 'X', uv: 0 });
  col(-30, 4.45, -29.5, 6.55);
  for (const z of [3.2, 4.0]) { mb('frame').box(-22.09, 1.7, z, 0.02, 0.4, 0.55); mb('paper').box(-22.11, 1.7, z, 0.004, 0.32, 0.45, { uv: 0 }); }
  plant(-23, 7.4, 1.0);
  interactables.push({ id: 'sheriff_desk', kind: 'sheriff_desk', label: "Look at the Sheriff's desk", min: [-27.2, 0, 4], max: [-24.8, 1.4, 5.2], pri: 0 });

  // ---------------- evidence / property ----------------
  const CARD = [0.62, 0.47, 0.3];
  for (const x of [-28.6, -26.4, -24.2]) {
    for (const y of [0.15, 0.6, 1.05, 1.5, 1.95]) mb('satin').box(x, y, -4.5, 0.6, 0.03, 4.4, { color: STEEL });
    for (const dz of [-2.15, 2.15]) for (const dx of [-0.28, 0.28]) mb('satin').box(x + dx, 1.05, -4.5 + dz, 0.03, 2.1, 0.03, { color: STEEL });
    for (let i = 0; i < 18; i++) { const y = [0.15, 0.6, 1.05, 1.5][i % 4] + 0.16; const z = -6.4 + Math.floor(i / 4) * 0.9 + (i % 2) * 0.2; mb('satin').rbox(x + ((i * 7) % 3 - 1) * 0.08, y, z, 0.42, 0.28, 0.5, { r: 0.01, color: CARD.map((c) => c * (0.85 + (i % 3) * 0.08)) }); mb('paper').box(x + 0.22, y, z, 0.004, 0.08, 0.14, { uv: 0 }); }
    col(x - 0.32, -6.75, x + 0.32, -2.25);
  }
  // pass-through evidence lockers on the office wall and a packaging counter
  mb('lockers').box(-26, 0.95, 1.75, 3.0, 1.9, 0.42, { faces: 'z', uv: 0, uvFront: [[0, 0], [2, 0], [2, 1], [0, 1]] });
  mb('satin').box(-26, 0.95, 1.75, 3.0, 1.9, 0.42, { faces: 'xXy', color: [0.3, 0.34, 0.4] });
  col(-27.55, 1.5, -24.45, 2);
  mb('satin').rbox(-22.5, 0.46, -1.2, 0.8, 0.92, 2.2, { r: 0.01, color: [0.55, 0.57, 0.6] }); mb('laminate').rbox(-22.5, 0.94, -1.2, 0.84, 0.04, 2.24, { r: 0.01, uv: 1 });
  mb('paper').box(-22.5, 0.965, -1.5, 0.3, 0.01, 0.4, { uv: 0 }); mb('satin').rbox(-22.5, 1.0, -0.8, 0.3, 0.1, 0.25, { r: 0.01, color: CARD });
  col(-22.95, -2.35, -22, -0.05);
  mb('fridge').rbox(-29.5, 0.92, 1.3, 0.75, 1.84, 0.7, { r: 0.03 }); col(-29.95, 0.9, -29.05, 1.7);
  interactables.push({ id: 'evidence', kind: 'evidence', label: 'Look over the evidence room', min: [-29, 0, -6.8], max: [-23.8, 2.1, -2.2], pri: 0 });

  // ---------------- restrooms ----------------
  const PORC = [0.93, 0.93, 0.92], PART = [0.55, 0.58, 0.6];
  for (const [x0, x1, men] of [[-15.5, -12, true], [-19, -15.5, false]]) {
    // tiled wainscot
    mb('tile').box((x0 + x1) / 2, 0.7, 14.5, x1 - x0 - 0.1, 1.4, 0.04, { faces: 'z', uv: 0.6 });
    // sink counter + mirror on the west/east divider
    const sx = men ? x0 + 0.12 : x1 - 0.12; const face = men ? 1 : -1;
    mb('counterTop').box(sx + face * 0.25, 0.86, 11.8, 0.5, 0.05, 1.8, { uv: 1 }); mb('satin').box(sx + face * 0.25, 0.5, 11.8, 0.46, 0.7, 1.76, { color: [0.4, 0.42, 0.45] });
    for (const z of [11.3, 12.3]) { mb('gloss').cylinder(sx + face * 0.25, 0.86, z, 0.17, 0.02, 16, { color: [0.85, 0.86, 0.87] }); mb('chrome').cylinder(sx + face * 0.06, 0.96, z, 0.012, 0.18, 8); }
    mb('mirror').panel(sx + face * 0.012, 1.55, 11.8, 1.7, 0.9, 'x', face);
    mb('satin').rbox(sx + face * 0.06, 1.35, 13.2, 0.12, 0.28, 0.24, { r: 0.03, color: [0.8, 0.8, 0.8] }); // hand dryer
    col(Math.min(sx, sx + face * 0.5), 10.85, Math.max(sx, sx + face * 0.5), 12.75);
    // stalls along the back (z 14.6 wall)
    const stalls = men ? 2 : 3; const w = (x1 - x0 - 0.2) / (stalls + (men ? 1 : 0));
    for (let i = 0; i < stalls; i++) {
      const cx = x1 - 0.1 - w * (i + 0.5) * (men ? 1 : 1);
      mb('satin').box(cx - w / 2, 1.0, 13.9, 0.03, 1.7, 1.3, { color: PART });
      mb('gloss').rbox(cx, 0.22, 14.25, 0.38, 0.4, 0.5, { r: 0.08, color: PORC }); mb('gloss').rbox(cx, 0.55, 14.5, 0.4, 0.3, 0.16, { r: 0.04, color: PORC });
      mb('satin').box(cx, 1.0, 13.26, w * 0.4, 1.7, 0.03, { color: PART, rotY: 0 });
    }
    mb('satin').box(x1 - 0.1 - w * stalls, 1.0, 13.9, 0.03, 1.7, 1.3, { color: PART });
    if (men) for (let i = 0; i < 2; i++) mb('gloss').rbox(x0 + 0.5 + i * 0.45, 0.85, 14.48, 0.38, 0.6, 0.22, { r: 0.08, color: PORC });
    col(x0 + 0.1, 13.2, x1 - 0.1, 14.6);
    interactables.push({ id: men ? 'restroom_m' : 'restroom_w', kind: 'restroom', label: men ? "Use the men's restroom" : "Use the women's restroom", min: [x0, 0, 10.7], max: [x1, 2, 14.5], pri: 0 });
  }

  // ---------------- locker / duty room ----------------
  mb('lockers').box(-24.5, 0.95, 17.75, 9.8, 1.9, 0.44, { faces: 'z', uv: 0, uvFront: [[0, 0], [6, 0], [6, 1], [0, 1]] });
  mb('satin').box(-24.5, 0.95, 17.75, 9.8, 1.9, 0.44, { faces: 'xXy', color: [0.3, 0.34, 0.4] }); col(-29.5, 17.5, -19.5, 18);
  mb('lockers').box(-29.75, 0.95, 14.2, 0.44, 1.9, 5.6, { faces: 'X', uv: 0, uvFront: [[0, 0], [3.5, 0], [3.5, 1], [0, 1]] });
  mb('satin').box(-29.75, 0.95, 14.2, 0.44, 1.9, 5.6, { faces: 'zZy', color: [0.3, 0.34, 0.4] }); col(-30, 11.4, -29.5, 17);
  for (const [x, z, len, rot] of [[-24.5, 16.4, 4, 0], [-27.9, 13.8, 3.2, Math.PI / 2]]) {
    mb('wood').rbox(x, 0.45, z, rot ? 0.38 : len, 0.05, rot ? len : 0.38, { r: 0.012, uv: 1 });
    for (const d of [-len / 2 + 0.3, len / 2 - 0.3]) mb('chrome').box(rot ? x : x + d, 0.22, rot ? z + d : z, 0.04, 0.44, 0.3);
    col(rot ? x - 0.22 : x - len / 2, rot ? z - len / 2 : z - 0.22, rot ? x + 0.22 : x + len / 2, rot ? z + len / 2 : z + 0.22);
  }
  mb('matte').rbox(-23.4, 0.58, 16.4, 0.6, 0.22, 0.32, { r: 0.05, color: [0.05, 0.05, 0.06] }); // duty bag on bench
  mb('mirror').panel(-19.12, 1.5, 13.0, 1.2, 1.0, 'x', -1);
  interactables.push({ id: 'lockers', kind: 'lockers', label: 'Deputy lockers', min: [-29.5, 0, 17.2], max: [-19.5, 2, 18], pri: 0 });

  // ---------------- sally port ----------------
  // safety striping, bollards, roll-up doors
  for (const z of [6, 12]) mb('safety').box(-36, 0.003, z, 11.6, 0.006, 0.12);
  mb('safety').box(-31.2, 0.003, 8, 0.12, 0.006, 19.6);
  for (const z of [0, 6, 12]) { mb('rollup').panel(-41.91, 1.6, z + 3, 3.4, 3.1, 'x', 1); mb('satin').box(-41.88, 3.2, z + 3, 0.12, 0.12, 3.6, { color: [0.3, 0.31, 0.33] }); }
  for (const [x, z] of [[-31.2, -1.4], [-31.2, 17.4]]) { mb('safety').cylinder(x, 0.55, z, 0.1, 1.1, 12); col(x - 0.12, z - 0.12, x + 0.12, z + 0.12); }
  // officer weapon lockers before the detention door (no guns past this point)
  mb('satin').rbox(-30.23, 1.3, 4.6, 0.3, 0.9, 1.2, { r: 0.01, color: [0.36, 0.38, 0.4] });
  for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) { mb('satin').box(-30.385, 1.0 + r * 0.29, 4.15 + q * 0.3, 0.01, 0.25, 0.26, { color: [0.3, 0.32, 0.34] }); mb('beaconGreen').box(-30.392, 1.08 + r * 0.29, 4.26 + q * 0.3, 0.004, 0.02, 0.02); }
  col(-30.45, 3.95, -30, 5.25);
  screen('sign_detention', 'sign', -30.12, 2.45, 6.4, 1.9, 0.24, 'x', -1, 0, { text: 'PRISONER ENTRY · SECURE WEAPONS' });
  mb('metal').box(-30.11, 1.1, 6.4, 0.04, 2.2, 1.0); mb('glassFrost').box(-30.135, 1.6, 6.4, 0.01, 0.5, 0.3);
  // work bench, tire rack, cones, oil drum, spike strip case
  mb('satin').rbox(-40, 0.9, 17.4, 3.0, 0.06, 0.8, { r: 0.01, color: [0.4, 0.42, 0.44] }); mb('satin').box(-40, 0.45, 17.4, 2.9, 0.86, 0.76, { faces: 'zxX', color: [0.14, 0.3, 0.55] });
  mb('satin').box(-40, 1.6, 17.92, 3.0, 1.0, 0.03, { color: [0.62, 0.6, 0.55] }); col(-41.6, 16.95, -38.4, 18);
  for (let i = 0; i < 4; i++) mb('matte').tube(-41.6, 0.36, -1.5 + i * 0.32, 0.33, 0.24, 'x', 16, { color: [0.03, 0.03, 0.03] }); col(-41.9, -1.85, -41.3, -0.4);
  for (let i = 0; i < 4; i++) { mb('cone').cylinder(-33 + (i % 2) * 0.3, 0.3 + Math.floor(i / 2) * 0.06, 17.4, 0.03, 0.6, 12, { r2: 0.003 }); }
  mb('cone').cylinder(-33.15, 0.02, 17.4, 0.2, 0.04, 4);
  mb('satin').cylinder(-35, 0.45, 17.5, 0.3, 0.9, 16, { color: [0.12, 0.3, 0.6] }); col(-35.35, 17.15, -32.6, 17.85);
  // the fleet
  squadCar(k, -36.5, 3.0, Math.PI, 'sedan'); squadCar(k, -36.5, 9.0, Math.PI, 'suv'); squadCar(k, -36.5, 15.0, Math.PI, 'sedan');
  interactables.push({ id: 'squad', kind: 'squad', label: 'Check the patrol car', min: [-39.2, 0, 7.8], max: [-33.8, 1.9, 10.2], pri: 0 });

  // nav nodes for NPC visits are added in buildNavGraph()
  void R;
}

/** Sheriff's patrol car (sedan or SUV) built from rounded boxes; front faces local +x. */
function squadCar(k, cx, cz, rot, kind) {
  const { mb, col } = k;
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (dx, dz) => [cx + dx * c + dz * s, cz - dx * s + dz * c];
  const suv = kind === 'suv'; const L = suv ? 5.0 : 5.0, W = suv ? 2.0 : 1.9, bodyH = suv ? 0.85 : 0.62, baseY = suv ? 0.72 : 0.62;
  const WHITE = [0.93, 0.93, 0.92], BLACK = [0.03, 0.03, 0.035];
  const put = (mat, dx, y, dz, sx, sy, sz, o = {}) => { const [x, z] = P(dx, dz); mb(mat).rbox(x, y, z, sx, sy, sz, { rotY: rot, ...o }); };
  put('gloss', 0, baseY, 0, L, bodyH, W, { r: 0.14, color: WHITE });                                     // body
  put('gloss', -0.1, baseY - 0.02, 0, 2.3, bodyH * 0.8, W + 0.02, { r: 0.1, color: BLACK });             // black doors (two-tone)
  // greenhouse: one rounded box tapered toward the roof (sloped windshield + rear glass)
  const top = baseY + bodyH / 2; const gh = suv ? 0.66 : 0.54;
  const [l0, l1, w0, w1] = suv ? [3.3, 2.95, W - 0.1, W - 0.26] : [2.8, 1.9, W - 0.1, W - 0.3];
  {
    const tmp = new MeshBuilder().rbox(0, 0, 0, l0, gh, w0, { r: 0.1, seg: 3 });
    const g = mb('glassDark'); const base = g.vcount;
    for (let i = 0; i < tmp.p.length; i += 3) {
      const t = tmp.p[i + 1] / gh + 0.5; const kx = 1 + (l1 / l0 - 1) * t, kz = 1 + (w1 / w0 - 1) * t;
      const lx = tmp.p[i] * kx - 0.3, ly = tmp.p[i + 1] + top + gh / 2, lz = tmp.p[i + 2] * kz;
      const [wx, wz] = P(lx, lz); g.p.push(wx, ly, wz);
      const nx = tmp.n[i], nz = tmp.n[i + 2]; g.n.push(nx * c + nz * s, tmp.n[i + 1], -nx * s + nz * c);
      g.uv.push(tmp.uv[(i / 3) * 2], tmp.uv[(i / 3) * 2 + 1]); g.c.push(1, 1, 1);
    }
    for (const ix of tmp.i) g.i.push(base + ix);
  }
  const tiers = [[l1, w1]]; const N = 1;
  put('satin', -0.3 + (suv ? 0 : 0.35), top + gh * 0.5, 0, 0.08, gh, W - 0.1, { r: 0.02, color: BLACK }); // B-pillar
  put('gloss', -0.3, top + gh + 0.02, 0, suv ? 3.0 : 1.95, 0.06, tiers[N - 1][1] + 0.02, { r: 0.03, color: WHITE });
  // green sheriff stripe + door lettering on both sides
  for (const sd of [1, -1]) {
    const [x, z] = P(-0.1, sd * (W / 2 + 0.012)); mb('sheriffDoor').panel(x, baseY + 0.02, z, 1.9, bodyH * 0.6, 'z', sd, { rotY: rot });
    const [x2, z2] = P(0, sd * (W / 2 + 0.006)); mb('satin').panel(x2, baseY + bodyH * 0.32, z2, L - 0.4, 0.06, 'z', sd, { rotY: rot, color: [0.1, 0.38, 0.2] });
  }
  // wheels with rims
  for (const [dx, dz] of [[1.55, 1], [1.55, -1], [-1.5, 1], [-1.5, -1]]) {
    const [x, z] = P(dx, dz * (W / 2 - 0.12));
    mb('matte').tube(x, 0.36, z, 0.36, 0.26, 'z', 16, { rotY: rot, color: [0.03, 0.03, 0.03] });
    const [rx, rz] = P(dx, dz * (W / 2 - 0.1)); mb('chrome').tube(rx, 0.36, rz, 0.2, 0.27, 'z', 12, { rotY: rot });
  }
  // light bar, push bumper, lights, spotlight, antenna
  const roofY = top + gh + 0.04;
  put('satin', -0.25, roofY + 0.04, 0, 0.32, 0.08, 1.3, { r: 0.03, color: BLACK });
  put('lightRed', -0.25, roofY + 0.1, -0.33, 0.28, 0.07, 0.6, { r: 0.03 });
  put('lightBlue', -0.25, roofY + 0.1, 0.33, 0.28, 0.07, 0.6, { r: 0.03 });
  put('satin', L / 2 + 0.08, baseY - 0.05, 0, 0.12, 0.55, 1.2, { r: 0.03, color: BLACK });
  for (const sd of [-1, 1]) {
    put('headlight', L / 2 - 0.02, baseY + 0.12, sd * 0.68, 0.06, 0.1, 0.32, { r: 0.02 });
    put('taillight', -L / 2 + 0.02, baseY + 0.14, sd * 0.7, 0.06, 0.12, 0.3, { r: 0.02 });
    put('satin', 0.75, baseY + bodyH / 2 + 0.18, sd * (W / 2 + 0.08), 0.12, 0.1, 0.06, { r: 0.02, color: BLACK }); // mirrors
  }
  put('chrome', 0.6, baseY + bodyH / 2 + 0.35, -(W / 2 - 0.05), 0.16, 0.12, 0.12, { r: 0.04 });          // A-pillar spotlight
  const [ax, az] = P(-1.6, 0); mb('satin').cylinder(ax, roofY + 0.35, az, 0.006, 0.7, 6, { color: BLACK });
  // footprint collider (axis-aligned; cars face ±x)
  col(cx - L / 2 - 0.1, cz - W / 2 - 0.1, cx + L / 2 + 0.1, cz + W / 2 + 0.1);
}
