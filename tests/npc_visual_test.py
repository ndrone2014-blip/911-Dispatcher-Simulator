"""NPC visual + performance test.
Usage: python3 tests/npc_visual_test.py [outdir]

Starts a shift, then:
  * takes close-up portraits (front, three-quarter, back) of a set of NPCs covering every
    uniform type (dispatcher, officer, sergeant, deputy, sheriff, detective, command,
    records staff, fire, EMS, civilian) on the High preset;
  * walks several NPCs and screenshots mid-stride;
  * measures NPC CPU cost per frame (update + draw) and draw calls for a crowded view on
    every preset, with the whole roster on screen;
  * checks police equipment (badge, belt, body camera, hat) is present and stays attached
    to the chest/hip/head bones while animating;
  * checks the NPC system survives preset switches and a lost WebGL context without
    leaking GPU memory;
  * runs on an iPhone-sized viewport (Low/Medium) as well.
Fails on any uncaught console error or failed check."""
import http.server, socketserver, threading, sys, os, time, json, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tests', 'out_npc')
os.makedirs(OUT, exist_ok=True)
PORT = 8767

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errors, fails = [], []
def attach(page, tag):
    page.on('console', lambda m: errors.append(f'[{tag}] console.{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(f'[{tag}] pageerror: {e}'))
def check(cond, msg):
    print(('  ok   ' if cond else '  FAIL ') + msg)
    if not cond: fails.append(msg)

ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']

# Put an NPC in a clear spot (the dispatch floor aisle) standing, and point the camera at them.
STAGE = '''(args) => { const [id, dist, ang, pitch, anim, eyeH] = args; const g = window.__game, w = g.world, m = w.npcs;
  let n = m.npc(id);
  if (!n) { const s = (window.__STAFF || []).find((x) => x.id === id); if (!s) return null; n = m.spawn(s, 'mid_0'); }
  n.away = false; n.event = null; n.queue = [{ wait: 9999, anim }]; n.timer = 9999; n.path = []; n.chatWith = null;
  n.sitting = false; n.state = 'idle'; n.anim = anim; n.x = 0; n.z = 6.2; n.y = 0; n.yaw = 0; n.at = null;
  const a = n.yaw + ang; const p = w.player; p.pos = [n.x - Math.sin(a) * dist, eyeH, n.z - Math.cos(a) * dist]; p.yaw = a + Math.PI; p.pitch = pitch;
  // move everyone else out of the shot
  for (const o of m.npcs) if (o !== n && Math.hypot(o.x - n.x, o.z - n.z) < 4 && !o.sitting) { o.x += 6; }
  return { id: n.id, kind: n.kind }; }'''

PEOPLE = ['jake', 'vaughn', 'ruiz', 'sheriff', 'calloway', 'watch', 'pdchief', 'maria', 'ray', 'brenda', 'lou', 'sam', 'karen']

results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720})
    page = ctx.new_page(); attach(page, 'desktop')
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_selector('#menu:not([hidden]) .menu-btn', timeout=60000)
    page.click('text=Free Play'); time.sleep(0.3); page.click('text=Start shift'); time.sleep(2.5)
    page.evaluate('''async () => { const g = window.__game; g.settings.set("graphics.adaptive", false); g.sim.setConfig({ callFrequency: "off" });
        const mod = await import('./js/ai/staffDialogue.js'); window.__STAFF = mod.STAFF; }''')
    page.evaluate('() => window.__game.settings.set("graphics.preset", "high")'); time.sleep(1.5)
    newsys = page.evaluate('() => !!window.__game.world.npcs.people')
    print('  new character system:', newsys)

    # ---- portraits (sim paused so poses hold still) ----
    for who in PEOPLE:
        for tag, dist, ang, pitch, eye in [('front', 1.15, 0, -0.08, 1.62), ('face', 0.55, 0.25, -0.02, 1.68), ('3q', 1.9, 0.75, -0.18, 1.6), ('back', 1.6, 3.0, -0.15, 1.6)]:
            r = page.evaluate(STAGE, [who, dist, ang, pitch, 'idle', eye])
            if not r: print('  (no such npc)', who); break
            page.evaluate('() => window.__game.sim.setPaused(false)'); time.sleep(0.35)
            page.evaluate('() => window.__game.sim.setPaused(true)'); time.sleep(0.25)
            page.screenshot(path=os.path.join(OUT, f'p_{who}_{tag}.png'))
    page.evaluate('() => window.__game.sim.setPaused(false)')

    # ---- expressions / talking / gestures ----
    for anim in ['talk', 'point', 'drink', 'reach']:
        page.evaluate(STAGE, ['jake', 1.3, 0.35, -0.1, anim, 1.62]); time.sleep(0.9)
        page.screenshot(path=os.path.join(OUT, f'anim_jake_{anim}.png'))
    if newsys:
        for mood in ['worried', 'upset', 'confused', 'happy', 'sad']:
            page.evaluate(STAGE, ['brenda', 0.6, 0.15, -0.03, 'idle', 1.6])
            page.evaluate(f'() => {{ const n = window.__game.world.npcs.npc("brenda"); n.mood = "{mood}"; }}'); time.sleep(1.0)
            page.screenshot(path=os.path.join(OUT, f'mood_{mood}.png'))
        page.evaluate(STAGE, ['jake', 0.6, 0.1, -0.03, 'talk', 1.68])
        page.evaluate('() => window.__game.world.npcs.say("jake", "Hey, how are you doing? Coffee is fresh, by the way.")')
        for i in range(3):
            time.sleep(0.23); page.screenshot(path=os.path.join(OUT, f'lipsync_{i}.png'))

    # ---- walking ----
    page.evaluate('''() => { const m = window.__game.world.npcs; const n = m.npc('ramsey') || m.npc('jake'); n.away = false; n.event = null; n.x = 1.5; n.z = -3.2; n.y = 0; n.at = null;
        n.path = [{ x: 11, z: -3.2, y: 0 }]; n.state = 'walk'; n.anim = 'walk'; n.dest = null; n.queue = [{ wait: 9999 }];
        const p = window.__game.world.player; p.pos = [6, 1.6, -6.4]; p.yaw = Math.PI; p.pitch = -0.1; }''')
    for i in range(4):
        time.sleep(0.45); page.screenshot(path=os.path.join(OUT, f'walk_{i}.png'))

    # ---- equipment attachment while animating ----
    if newsys:
        eq = page.evaluate('''async () => { const m = window.__game.world.npcs; const out = {};
            for (const id of ['jake', 'ruiz', 'vaughn', 'sheriff']) { const n = m.npc(id); if (!n) continue; const look = m.people.describe(n);
              const errs = []; for (let k = 0; k < 40; k++) { n.anim = ['walk', 'talk', 'reach', 'point'][k % 4]; n.state = k % 8 < 4 ? 'walk' : 'idle'; n.phase += 0.137;
                const e = m.people.attachmentError(n); errs.push(e); }
              out[id] = { gear: look.gear, maxAttachErr: Math.max(...errs) }; }
            return out; }''')
        print('  equipment:', json.dumps(eq))
        for id, v in eq.items():
            need = ['badge', 'dutyBelt', 'hat'] + (['bodyCam', 'shoulderMic'] if id != 'sheriff' else [])  # the elected sheriff wears no body camera
            check(all(k in v['gear'] for k in need), f'{id} has {", ".join(need)}')
            check(v['maxAttachErr'] < 0.002, f'{id} equipment stays attached while animating (err {v["maxAttachErr"]:.5f} m)')
        uniq = page.evaluate('''() => { const m = window.__game.world.npcs; const keys = m.npcs.filter((n) => !n.away).map((n) => m.people.describe(n).signature); return { n: keys.length, unique: new Set(keys).size }; }''')
        print('  unique looks:', uniq); check(uniq['unique'] == uniq['n'], 'every NPC on shift has a unique appearance')

    # ---- performance on every preset: whole roster on the dispatch floor in view ----
    page.evaluate('''() => { const g = window.__game, m = g.world.npcs; let i = 0;
        for (const n of m.npcs) { n.away = false; n.event = null; n.sitting = false; n.queue = [{ wait: 9999, anim: i % 3 ? 'idle' : 'talk' }]; n.timer = 9999; n.path = [];
          n.x = 2 + (i % 10) * 0.95; n.z = -3.6 + Math.floor(i / 10) * 1.6; n.y = 0; n.yaw = Math.PI; n.state = i % 4 === 0 ? 'walk' : 'idle'; n.anim = n.state === 'walk' ? 'walk' : 'idle'; i++; }
        const p = g.world.player; p.pos = [6.3, 1.7, -7.6]; p.yaw = Math.PI; p.pitch = -0.12; return i; }''')
    for preset in ['low', 'medium', 'high', 'ultra']:
        page.evaluate(f'() => window.__game.settings.set("graphics.preset", "{preset}")'); time.sleep(1.2)
        page.evaluate('''() => { const g = window.__game, m = g.world.npcs; let i = 0;
            for (const n of m.npcs) { n.away = false; n.event = null; n.sitting = false; n.queue = [{ wait: 9999, anim: i % 3 ? 'idle' : 'talk' }]; n.timer = 9999; n.path = [];
              n.x = 2 + (i % 10) * 0.95; n.z = -3.6 + Math.floor(i / 10) * 1.6; n.y = 0; n.yaw = Math.PI; n.state = i % 4 === 0 ? 'walk' : 'idle'; n.anim = n.state === 'walk' ? 'walk' : 'idle';
              if (n.state === 'walk') n.path = [{ x: n.x, z: n.z - 0.0001, y: 0 }, { x: n.x, z: n.z, y: 0 }]; i++; } }''')
        time.sleep(0.6)
        st = page.evaluate('''() => new Promise((res) => { const w = window.__game.world, m = w.npcs; const items = []; const unit = w.unit;
            const mk = (color, spec = 0.12) => ({ color, specular: spec, shininess: 20 });
            // NPC CPU cost: update + draw, averaged
            const t0 = performance.now(); const N = 60;
            for (let k = 0; k < N; k++) { items.length = 0; m.update(1 / 60, w.player); m.draw(items, unit, mk, { pos: w.player.pos, yaw: w.player.yaw }); }
            const cpu = (performance.now() - t0) / N; const visible = m.npcs.filter((n) => n.drawn).length;
            let n = 0; const t1 = performance.now(); const step = () => { if (++n >= 20) res({ npcCpuMs: +cpu.toFixed(3), npcItems: items.length, visible, frameMs: +((performance.now() - t1) / 20).toFixed(1), ...w.status() }); else requestAnimationFrame(step); }; requestAnimationFrame(step); })''')
        results[preset] = st
        print(f'  {preset:6s}', json.dumps({k: st[k] for k in ['npcCpuMs', 'npcItems', 'visible', 'draws', 'tris', 'frameMs']}))
        page.screenshot(path=os.path.join(OUT, f'crowd_{preset}.png'))
        check(st['npcCpuMs'] < 4.0, f'{preset}: NPC update+draw under 4 ms/frame ({st["npcCpuMs"]} ms, {st["visible"]} visible)')

    # ---- normal shift view (natural behaviour) on medium ----
    page.evaluate('() => window.__game.settings.set("graphics.preset", "medium")'); time.sleep(1.5)
    page.evaluate('() => { const p = window.__game.world.player; p.pos=[6,1.65,-6]; p.yaw=Math.PI*0.95; p.pitch=-0.15; }'); time.sleep(1.0)
    page.screenshot(path=os.path.join(OUT, 'floor_medium.png'))

    # ---- GPU memory: preset switching and context loss ----
    if newsys:
        mem = page.evaluate('''async () => { const g = window.__game; const gl = g.world.renderer.gl; const counts = [];
            for (let i = 0; i < 8; i++) { g.settings.set('graphics.preset', ['low','ultra','medium','high'][i % 4]); await new Promise(r => setTimeout(r, 250)); counts.push(g.world.npcs.people.gpuStats().meshes); }
            return { ok: !gl.isContextLost(), err: gl.getError(), counts, live: g.world.npcs.people.gpuStats() }; }''')
        print('  preset switching:', json.dumps(mem))
        check(mem['ok'] and mem['err'] == 0, 'no GL errors after switching presets')
        check(max(mem['counts']) <= mem['live']['cap'] + 4, 'character meshes stay within the GPU budget')
    cl = page.evaluate('''async () => { const w = window.__game.world; const ext = w.renderer.gl.getExtension('WEBGL_lose_context'); if (!ext) return 'no-ext';
        ext.loseContext(); await new Promise(r => setTimeout(r, 400)); ext.restoreContext(); await new Promise(r => setTimeout(r, 1800));
        return { lostNow: w.lost, failed: w.failed, draws: w.renderer.stats.draws }; }''')
    print('  context loss/restore:', cl)
    if isinstance(cl, dict): check(not cl['lostNow'] and not cl['failed'], 'recovers from a lost WebGL context')
    page.screenshot(path=os.path.join(OUT, 'after_restore.png'))
    ctx.close()

    # ---- mobile ----
    m = p.devices['iPhone 13']
    ctx = browser.new_context(**{**m, 'viewport': {'width': 390, 'height': 844}})
    page = ctx.new_page(); attach(page, 'mobile')
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_selector('#menu:not([hidden]) .menu-btn', timeout=60000)
    page.click('text=Free Play'); time.sleep(0.3); page.click('text=Start shift'); time.sleep(2.5)
    page.evaluate('() => window.__game.settings.set("graphics.adaptive", false)')
    for preset in ['low', 'medium']:
        page.evaluate(f'() => window.__game.settings.set("graphics.preset", "{preset}")'); time.sleep(1.2)
        page.evaluate('() => { const p = window.__game.world.player; p.pos=[6,1.65,-6]; p.yaw=Math.PI*0.95; p.pitch=-0.15; }'); time.sleep(0.8)
        st = page.evaluate('''() => { const w = window.__game.world, m = w.npcs; const items = []; const t0 = performance.now();
            for (let k = 0; k < 60; k++) { items.length = 0; m.update(1 / 60, w.player); m.draw(items, w.unit, (c) => ({ color: c }), { pos: w.player.pos, yaw: w.player.yaw }); }
            return { npcCpuMs: +((performance.now() - t0) / 60).toFixed(3), ...w.status(), gpu: m.people ? m.people.gpuStats() : null }; }''')
        print(f'  mobile {preset}:', json.dumps(st))
        page.screenshot(path=os.path.join(OUT, f'mobile_{preset}.png'))
    page.evaluate('() => { const p = window.__game.world.player; const n = window.__game.world.npcs.npcs.find((x) => !x.away && !x.sitting) || window.__game.world.npcs.npcs[0]; p.pos=[n.x + 1.1 * Math.sin(n.yaw) * -1, (n.y||0) + 1.6, n.z - 1.1 * Math.cos(n.yaw)]; p.yaw = n.yaw + Math.PI; p.pitch = -0.1; }'); time.sleep(0.8)
    page.screenshot(path=os.path.join(OUT, 'mobile_closeup.png'))
    ctx.close()
    browser.close()

httpd.shutdown()
json.dump(results, open(os.path.join(OUT, 'stats.json'), 'w'), indent=1)
real = [e for e in errors if 'favicon' not in e]
print(f'\n{len(real)} console errors, {len(fails)} failed checks')
for e in real[:40]: print(' ', e)
for f in fails: print('  FAILED:', f)
sys.exit(1 if real or fails else 0)
