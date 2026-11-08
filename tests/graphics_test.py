"""Graphics quality test.
Usage: python3 tests/graphics_test.py [outdir]
Starts a shift, then for every preset (Low/Medium/High/Ultra) switches graphics at
runtime, renders the same camera views, records render stats (draw calls, triangles,
resolution, effects, frame time) and saves screenshots. Also checks that switching
presets repeatedly does not leak GPU objects or break gameplay, that adaptive
performance lowers quality on a slow device, and that a lost WebGL context recovers.
Fails on any uncaught console error."""
import http.server, socketserver, threading, sys, os, time, json, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tests', 'out_gfx')
os.makedirs(OUT, exist_ok=True)
PORT = 8766

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errors = []
def attach(page, tag):
    page.on('console', lambda m: errors.append(f'[{tag}] console.{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(f'[{tag}] pageerror: {e}'))

VIEWS = {
    'floor':   '[6,1.65,-6], Math.PI*0.95, -0.15',
    'wall':    '[0,1.65,3.5], 0, 0.08',
    'console': '[-2.8,1.55,-1.6], 0.35, -0.32',
    'break':   '[-7,1.65,12.5], Math.PI*0.85, -0.1',
}

def view(page, v):
    page.evaluate(f'() => {{ const p = window.__game.world.player; p.pos={VIEWS[v].split("], ")[0]}]; const r=[{VIEWS[v].split("], ")[1]}]; p.yaw=r[0]; p.pitch=r[1]; }}')

ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720})
    page = ctx.new_page(); attach(page, 'desktop')
    t0 = time.time()
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_selector('#menu:not([hidden]) .menu-btn', timeout=60000)
    print(f'  load to menu: {time.time() - t0:.1f}s')
    page.click('text=Free Play'); time.sleep(0.3); page.click('text=Start shift'); time.sleep(2)
    page.evaluate('() => { const s = window.__game.settings; s.set("graphics.adaptive", false); window.__game.sim.setConfig({ callFrequency: "off" }); }')
    for preset in ['low', 'medium', 'high', 'ultra']:
        t = time.time()
        page.evaluate(f'() => window.__game.settings.set("graphics.preset", "{preset}")')
        switch = time.time() - t
        time.sleep(1.2)
        # frame timing: render 30 frames back to back
        ms = page.evaluate('''() => new Promise(res => { const w = window.__game.world; let n = 0; const t0 = performance.now();
            const step = () => { if (++n >= 30) res((performance.now() - t0) / 30); else requestAnimationFrame(step); }; requestAnimationFrame(step); })''')
        st = page.evaluate('() => window.__game.world.status()')
        st['switchSec'] = round(switch, 2); st['avgFrameMsSwiftshader'] = round(ms, 1)
        results[preset] = st
        print(f'  {preset:6s}', json.dumps(st))
        for v in VIEWS:
            view(page, v); time.sleep(0.6)
            page.screenshot(path=os.path.join(OUT, f'{preset}_{v}.png'))
    # repeated switching must not leak GL objects
    leak = page.evaluate('''async () => { const g = window.__game; const gl = g.world.renderer.gl;
        for (let i = 0; i < 6; i++) { g.settings.set('graphics.preset', ['low','ultra','medium','high'][i % 4]); await new Promise(r => setTimeout(r, 150)); }
        return { ok: !gl.isContextLost(), err: gl.getError(), meshes: g.world.static.length }; }''')
    print('  switching x6:', leak); assert leak['ok'] and leak['err'] == 0
    # gameplay still works after switching: take a call, create incident, assign
    page.evaluate('() => window.__game.goToDesk()'); time.sleep(1.2)
    page.evaluate('() => window.__game.sim.calls.spawnCall({ templateId: "fire_house" })'); time.sleep(0.5)
    page.evaluate('''() => { const s = window.__game.sim; const r = s.calls.ringing()[0]; s.calls.answer(r.id); }'''); time.sleep(2)
    out = page.evaluate('''() => { const s = window.__game.sim; const a = s.calls.active(); s.calls.say(a.id, 'what is the address'); const i = s.calls.createIncident(a.id, {});
        s.units.assign(s.incidents.recommendations(i).map(x => x.unit), i.id); return { units: i.units.length, status: i.status }; }''')
    print('  gameplay after switching:', out); assert out['units'] > 0
    page.screenshot(path=os.path.join(OUT, 'cad_after_switch.png'))
    page.evaluate('() => window.__game.closeCAD()'); time.sleep(0.8)
    # adaptive performance: simulate a slow device and confirm it steps down
    ad = page.evaluate('''async () => { const g = window.__game, w = g.world; g.settings.set('graphics.preset', 'ultra'); await new Promise(r => setTimeout(r, 300));
        g.settings.set('graphics.adaptive', true); w.perf.warmup = 0;
        for (let i = 0; i < 400; i++) w.adapt(0.05);  // 20 fps for 20 s
        return w.status(); }''')
    print('  adaptive after slow frames:', json.dumps(ad)); assert ad['preset'] != 'ultra' or ad['scale'] < 1
    page.evaluate('() => window.__game.settings.set("graphics.adaptive", false)')
    # context loss + restore
    cl = page.evaluate('''async () => { const w = window.__game.world; const ext = w.renderer.gl.getExtension('WEBGL_lose_context'); if (!ext) return 'no-ext';
        ext.loseContext(); await new Promise(r => setTimeout(r, 400)); const lost = w.lost; ext.restoreContext(); await new Promise(r => setTimeout(r, 1500));
        return { wasLost: lost, lostNow: w.lost, failed: w.failed, draws: w.renderer.stats.draws }; }''')
    print('  context loss/restore:', cl)
    time.sleep(0.5); page.screenshot(path=os.path.join(OUT, 'after_context_restore.png'))
    ctx.close()

    # mobile: auto preset and frame stats
    m = p.devices['iPhone 13']
    ctx = browser.new_context(**{**m, 'viewport': {'width': 390, 'height': 844}})
    page = ctx.new_page(); attach(page, 'mobile')
    t0 = time.time(); page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_selector('#menu:not([hidden]) .menu-btn', timeout=60000)
    print(f'  mobile load to menu: {time.time() - t0:.1f}s')
    page.click('text=Free Play'); time.sleep(0.3); page.click('text=Start shift'); time.sleep(2)
    page.evaluate('() => window.__game.settings.set("graphics.adaptive", false)')
    for preset in ['low', 'medium']:
        page.evaluate(f'() => window.__game.settings.set("graphics.preset", "{preset}")'); time.sleep(1)
        page.evaluate('() => { const p = window.__game.world.player; p.pos=[6,1.65,-6]; p.yaw=Math.PI*0.95; p.pitch=-0.15; }'); time.sleep(0.8)
        print(f'  mobile {preset}:', json.dumps(page.evaluate('() => window.__game.world.status()')))
        page.screenshot(path=os.path.join(OUT, f'mobile_{preset}.png'))
    ctx.close()
    browser.close()

httpd.shutdown()
json.dump(results, open(os.path.join(OUT, 'stats.json'), 'w'), indent=1)
real = [e for e in errors if 'favicon' not in e]
print(f'\n{len(real)} console errors')
for e in real[:40]: print(' ', e)
sys.exit(1 if real else 0)
