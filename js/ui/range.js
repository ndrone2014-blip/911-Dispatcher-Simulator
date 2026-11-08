// Armory equipment checkout and the indoor training range. A fictional, controlled in-game
// training feature: you sign out training gear (protective equipment is required), then
// shoot round paper bullseye targets in timed drills for a qualification score. No real
// firearm instruction – it's a reaction/aim mini-game with range-safety flavor.
import { modal, toast } from './dom.js';
import { esc } from '../core/util.js';
import { LEADERS } from '../sim/department.js';

export const EQUIPMENT = [
  { id: 'eyes', cat: 'Protective', name: 'Safety glasses', desc: 'Required on the range.', required: true },
  { id: 'ears', cat: 'Protective', name: 'Electronic ear protection', desc: 'Required on the range.', required: true },
  { id: 'vest', cat: 'Protective', name: 'Training body armor', desc: 'Worn for duty-gear drills.' },
  { id: 'pistol', cat: 'Training firearms', name: 'Training pistol (marked blue)', desc: 'Range-only training sidearm. Signed out to you, returned before you leave.', firearm: true },
  { id: 'carbine', cat: 'Training firearms', name: 'Training carbine (marked blue)', desc: 'Range-only training long gun for the rifle course.', firearm: true },
  { id: 'taser', cat: 'Less-lethal', name: 'Conducted-energy trainer', desc: 'Inert training cartridge – practice targets only.' },
  { id: 'radio', cat: 'Duty gear', name: 'Portable radio', desc: 'Charged, on the training talkgroup.' },
  { id: 'light', cat: 'Duty gear', name: 'Tactical flashlight', desc: 'For the low-light course.' },
  { id: 'ifak', cat: 'Duty gear', name: 'Individual first-aid kit', desc: 'Tourniquet and dressings – always on the range.' },
];

function profileArmory(game) { return (game.save.profile.armory ||= { out: {}, quals: [], best: {} }); }

export function openArmory(game) {
  const A = profileArmory(game);
  const cats = [...new Set(EQUIPMENT.map((e) => e.cat))];
  const body = document.createElement('div');
  const draw = () => {
    body.innerHTML = `<div class="dim" style="margin-bottom:8px">Armory cage · ${esc(LEADERS.range.name)} keeps the log. Everything you sign out is recorded; return it when you're done. Training gear is blue-marked and range-only.</div>
      ${cats.map((c) => `<div class="section-title" style="margin-top:8px">${esc(c)}</div>${EQUIPMENT.filter((e) => e.cat === c).map((e) => `
        <div class="row arm-row"><div class="grow"><b>${esc(e.name)}</b>${e.required ? ' <span class="pill">required for range</span>' : ''}<div class="dim" style="font-size:.85em">${esc(e.desc)}</div></div>
        <button class="btn sm ${A.out[e.id] ? '' : 'primary'}" data-act="tog" data-id="${e.id}">${A.out[e.id] ? 'Return' : 'Sign out'}</button></div>`).join('')}`).join('')}
      <div class="dim" style="margin-top:10px;font-size:.85em">Qualifications on record: ${A.quals.length ? A.quals.slice(-3).map((q) => `${esc(q.course)} ${q.score}% ${q.pass ? '✔' : '✖'}`).join(' · ') : 'none yet'}</div>`;
  };
  draw();
  const m = modal({ title: '🗄 Armory – equipment checkout', body, wide: true, foot: [{ act: 'kit', label: 'Sign out range kit' }, { act: 'retall', label: 'Return everything' }, { act: 'close', label: 'Done', cls: 'primary' }],
    onAction: (a, t) => {
      if (a === 'tog') { const id = t.dataset.id; if (A.out[id]) delete A.out[id]; else A.out[id] = Date.now(); game.audio?.click(); draw(); game.save.save(); }
      else if (a === 'kit') { for (const id of ['eyes', 'ears', 'pistol', 'ifak']) A.out[id] ||= Date.now(); draw(); game.save.save(); toast('Range kit signed out: glasses, ears, training pistol, IFAK.', { level: 'good' }); }
      else if (a === 'retall') { A.out = {}; draw(); game.save.save(); toast('All equipment returned and logged.', { level: 'info' }); }
      else if (a === 'close') m.close();
    } });
  return m;
}

const COURSES = {
  pistol: { name: 'Pistol qualification', gear: 'pistol', time: 30, targets: 24, size: 1, pass: 70 },
  carbine: { name: 'Carbine course', gear: 'carbine', time: 35, targets: 26, size: 0.8, pass: 75 },
  lowlight: { name: 'Low-light course', gear: 'pistol', time: 30, targets: 20, size: 0.95, pass: 70, dark: true, needs: 'light' },
  taser: { name: 'Less-lethal accuracy', gear: 'taser', time: 25, targets: 14, size: 1.15, pass: 65 },
};

export function openRange(game) {
  const A = profileArmory(game);
  const missing = ['eyes', 'ears'].filter((id) => !A.out[id]);
  if (missing.length) {
    toast(`${LEADERS.range.short}: "Nobody steps on my line without eyes and ears. Sign them out at the armory cage first."`, { level: 'warn', title: 'Range safety', duration: 7000 });
    game.speech?.speak('Nobody steps on my line without eyes and ears. Sign them out at the armory first.', { key: 'hale', sex: 'm', pitch: 0.86, rate: 0.96, category: 'staff' });
    return null;
  }
  const body = document.createElement('div');
  body.innerHTML = `<div class="dim">Choose a course. ${esc(LEADERS.range.short)} runs the line. Hit the bullseye targets as they appear – the center ring scores most. Misses and waiting cost points.</div>
    <div class="row wrap" style="gap:8px;margin:10px 0">${Object.entries(COURSES).map(([id, c]) => {
      const ok = A.out[c.gear] && (!c.needs || A.out[c.needs]); const best = A.best[id];
      return `<button class="btn ${ok ? 'primary' : ''}" data-act="course" data-id="${id}" ${ok ? '' : 'disabled'} title="${ok ? '' : `Requires: ${c.gear}${c.needs ? ` + ${c.needs}` : ''} from the armory`}">${esc(c.name)}${best ? ` · best ${best}%` : ''}</button>`;
    }).join('')}</div>
    <div class="range-stage" data-r="stage"><div class="range-msg">Select a course to step up to the line.</div></div>`;
  const m = modal({ title: '🎯 Training range', body, xwide: true, onClose: () => stop(), foot: [{ act: 'close', label: 'Leave range' }],
    onAction: (a, t) => { if (a === 'course') start(t.dataset.id); else if (a === 'close') m.close(); } });
  const stage = body.querySelector('[data-r="stage"]');
  let run = null;
  function stop() { if (run) { cancelAnimationFrame(run.raf); clearInterval(run.spawn); run = null; } }

  function start(id) {
    stop();
    const c = COURSES[id];
    stage.innerHTML = `<canvas data-r="cv"></canvas><div class="range-hud" data-r="hud"></div>`;
    const cv = stage.querySelector('canvas'); const hud = stage.querySelector('[data-r="hud"]'); const g = cv.getContext('2d');
    const size = () => { const r = stage.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = `${r.width}px`; cv.style.height = `${r.height}px`; g.setTransform(dpr, 0, 0, dpr, 0, 0); return r; };
    let R = size();
    run = { t: -3, score: 0, max: 0, hits: 0, shots: 0, targets: [], spawned: 0, holes: [], last: performance.now(), raf: 0 };
    const say = (txt) => game.speech?.speak(txt, { key: 'hale', sex: 'm', pitch: 0.86, rate: 0.96, category: 'staff' });
    say(pick(['Shooter, step up to the line. Eyes and ears on. The line is hot.', 'Line is ready. Watch your front sight. Begin on the first target.', 'Range is hot. Take your time, then take your shot.']));
    const lanes = 6;
    const spawn = () => {
      if (run.spawned >= c.targets) return;
      const lane = Math.floor(Math.random() * lanes);
      const dist = 0.55 + Math.random() * 0.45; // farther = smaller
      const r0 = Math.min(R.width / lanes, R.height) * 0.22 * c.size * (1.15 - dist * 0.55);
      run.targets.push({ x: (lane + 0.5) * (R.width / lanes), y: R.height * (0.3 + (1 - dist) * 0.35), r: r0, born: run.t, life: 2.6 - Math.min(1.1, run.spawned * 0.035), up: 0 });
      run.spawned++; run.max += 10;
    };
    cv.addEventListener('pointerdown', (e) => {
      if (!run || run.t < 0) return;
      const b = cv.getBoundingClientRect(); const x = e.clientX - b.left, y = e.clientY - b.top;
      run.shots++; game.audio?.noise?.(0, 0.06, { gain: 0.16, freq: 900, q: 0.7 });
      let hit = null;
      for (const tg of run.targets) { const d = Math.hypot(x - tg.x, y - tg.y); if (d < tg.r && (!hit || d < hit.d)) hit = { tg, d }; }
      if (hit) {
        const ring = hit.d / hit.tg.r; const pts = ring < 0.2 ? 10 : ring < 0.45 ? 8 : ring < 0.7 ? 6 : 4;
        run.score += pts; run.hits++; hit.tg.hitAt = run.t; hit.tg.pts = pts;
        run.holes.push({ x, y, t: run.t });
      } else { run.score = Math.max(0, run.score - 1); run.holes.push({ x, y, t: run.t, miss: true }); }
    });
    const frame = (now) => {
      if (!run) return;
      const dt = Math.min(0.25, (now - run.last) / 1000); run.last = now; run.t += dt;
      if (stage.clientWidth && Math.abs(stage.clientWidth - R.width) > 2) R = size();
      // spawn cadence
      if (run.t >= 0) { run.nextSpawn = (run.nextSpawn ?? 0) - dt; if (run.nextSpawn <= 0 && run.spawned < c.targets) { spawn(); run.nextSpawn = c.time / c.targets * (0.75 + Math.random() * 0.5); } }
      for (const tg of run.targets) tg.up = Math.min(1, tg.up + dt * 6);
      run.targets = run.targets.filter((tg) => (tg.hitAt == null ? run.t - tg.born < tg.life : run.t - tg.hitAt < 0.35));
      drawRange(g, R.width, R.height, run, c);
      const left = Math.max(0, Math.ceil(c.time - run.t));
      hud.innerHTML = run.t < 0 ? `<b>Stand by… ${Math.ceil(-run.t)}</b>` : `<b>${esc(c.name)}</b> · Score ${run.score} · Hits ${run.hits}/${run.spawned} · ${left}s`;
      if (run.t >= c.time + 1 || (run.spawned >= c.targets && !run.targets.length && run.t > 1)) { finish(id, c); return; }
      run.raf = requestAnimationFrame(frame);
    };
    run.raf = requestAnimationFrame(frame);
  }

  function finish(id, c) {
    const pct = run.max ? Math.round((run.score / run.max) * 100) : 0; const acc = run.shots ? Math.round((run.hits / run.shots) * 100) : 0;
    const pass = pct >= c.pass;
    A.quals.push({ course: c.name, score: pct, pass, at: Date.now() }); if (A.quals.length > 20) A.quals.shift();
    A.best[id] = Math.max(A.best[id] || 0, pct); game.save.save();
    stop();
    const line = pass ? pick(['Good shooting. That\'s a qualifying score – I\'ll log it.', 'Nice and steady. You qualified.', 'That\'ll do. Qualified – sign the sheet on your way out.']) : pick(['Not quite. Breathe, slow down, and run it again.', 'Close. Take a minute and give it another go.', 'Speed comes from smooth. Try it again.']);
    game.speech?.speak(`Cease fire. ${line}`, { key: 'hale', sex: 'm', pitch: 0.86, rate: 0.96, category: 'staff' });
    stage.innerHTML = `<div class="range-msg"><div style="font-size:1.6em;font-weight:800">${pct}% ${pass ? '✔ QUALIFIED' : '✖ Not qualified'}</div>
      <div class="dim">${esc(c.name)} · accuracy ${acc}% (hits ÷ shots) · passing score ${c.pass}%</div><div style="margin-top:8px">${esc(LEADERS.range.short)}: “${esc(line)}”</div></div>`;
    if (pass) toast(`${c.name}: ${pct}% – qualified.`, { level: 'good', title: 'Range' });
  }
  return m;
}

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

function drawRange(g, w, h, run, c) {
  // backstop, lanes, floor
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, c.dark ? '#050608' : '#2a2d31'); sky.addColorStop(0.6, c.dark ? '#0b0c0f' : '#3a3d42'); sky.addColorStop(1, c.dark ? '#121316' : '#55585d');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = c.dark ? '#0d0e10' : '#1c1d20'; g.fillRect(0, h * 0.15, w, h * 0.12); // baffle
  const lanes = 6;
  for (let i = 1; i < lanes; i++) { g.strokeStyle = c.dark ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.beginPath(); g.moveTo((i / lanes) * w, h * 0.27); g.lineTo((i / lanes) * w, h); g.stroke(); }
  for (let i = 1; i <= lanes; i++) { g.fillStyle = c.dark ? '#333' : '#9aa0a6'; g.font = '700 12px system-ui'; g.textAlign = 'center'; g.fillText(`LANE ${i}`, ((i - 0.5) / lanes) * w, h - 10); }
  // targets
  for (const tg of run.targets) {
    const s = tg.up; const r = tg.r * s;
    g.fillStyle = '#7d6b4f'; g.fillRect(tg.x - 2, tg.y + r * 0.9, 4, h); // carrier rod
    g.fillStyle = '#efe9db'; g.fillRect(tg.x - r * 1.15, tg.y - r * 1.15, r * 2.3, r * 2.3);
    const rings = [[1, '#efe9db'], [0.85, '#1a1a1a'], [0.7, '#efe9db'], [0.45, '#1a1a1a'], [0.2, '#c62828']];
    for (const [k, col] of rings) { g.fillStyle = col; g.beginPath(); g.arc(tg.x, tg.y, r * k, 0, 6.283); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(tg.x, tg.y, r, 0, 6.283); g.stroke();
    if (tg.hitAt != null) { g.fillStyle = '#ffd54a'; g.font = '800 16px system-ui'; g.textAlign = 'center'; g.fillText(`+${tg.pts}`, tg.x, tg.y - r - 8); }
    // time remaining bar
    if (tg.hitAt == null) { const k = 1 - (run.t - tg.born) / tg.life; g.fillStyle = k > 0.35 ? '#2fd08a' : '#ff6b5a'; g.fillRect(tg.x - r, tg.y + r * 1.25, 2 * r * Math.max(0, k), 4); }
  }
  for (const hl of run.holes) { if (run.t - hl.t > 0.6) continue; g.fillStyle = hl.miss ? 'rgba(255,90,78,.8)' : 'rgba(20,20,20,.9)'; g.beginPath(); g.arc(hl.x, hl.y, 3, 0, 6.283); g.fill(); }
  if (c.dark) { // flashlight cone follows the newest target
    const tg = run.targets[run.targets.length - 1]; const grd = g.createRadialGradient(tg ? tg.x : w / 2, tg ? tg.y : h / 2, 10, tg ? tg.x : w / 2, tg ? tg.y : h / 2, Math.max(w, h) * 0.35);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,.82)'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }
}
