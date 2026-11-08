"""Headless browser smoke test.
Usage: python3 tests/browser_test.py [outdir]
Serves the repo, opens the game in Chrome (desktop + mobile), plays through key
flows and saves screenshots. Fails on any uncaught console error."""
import http.server, socketserver, threading, sys, os, time, json, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tests', 'out')
os.makedirs(OUT, exist_ok=True)
PORT = 8765

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errors = []
def attach(page, tag):
    page.on('console', lambda m: errors.append(f'[{tag}] console.{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(f'[{tag}] pageerror: {e}'))

def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f'{name}.png'))
    print('  screenshot', name)

ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)

    # ---------------- Desktop ----------------
    print('▶ Desktop')
    ctx = browser.new_context(viewport={'width': 1600, 'height': 900})
    page = ctx.new_page(); attach(page, 'desktop')
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_selector('#menu:not([hidden]) .menu-btn', timeout=30000)
    time.sleep(1.5)
    info = page.evaluate('() => ({ failed3d: window.__game.world.failed, draws: window.__game.world.renderer && window.__game.world.renderer.stats.draws })')
    print('  3D:', info)
    shot(page, '01_menu')
    page.click('text=Free Play'); time.sleep(0.4); shot(page, '02_freeplay_setup')
    page.click('text=Start shift'); time.sleep(2.5)
    shot(page, '03_world_start')
    # look at the video wall / walk a bit
    page.evaluate('() => { const p = window.__game.world.player; p.pos=[0,1.65,3.5]; p.yaw=0; p.pitch=0.08; }'); time.sleep(0.8); shot(page, '04_world_videowall')
    page.evaluate('() => { const p = window.__game.world.player; p.pos=[-7,1.65,12.5]; p.yaw=Math.PI*0.85; p.pitch=-0.1; }'); time.sleep(0.8); shot(page, '05_breakroom')
    page.evaluate('() => { const p = window.__game.world.player; p.pos=[6,1.65,-6]; p.yaw=Math.PI*0.95; p.pitch=-0.15; }'); time.sleep(0.8); shot(page, '06_floor_overview')
    # open the CAD and run a call
    page.evaluate('() => window.__game.goToDesk()'); time.sleep(1.2)
    page.evaluate('() => window.__game.sim.calls.spawnCall({ templateId: "fire_house" })'); time.sleep(0.6)
    shot(page, '07_cad_ringing')
    page.keyboard.press('a'); time.sleep(2.0)
    page.fill('[data-r="say"]', 'What is the address of your emergency?'); page.keyboard.press('Enter'); time.sleep(3)
    page.fill('[data-r="say"]', 'Is anyone still inside the house?'); page.keyboard.press('Enter'); time.sleep(3)
    page.click('.chip.verify') if page.query_selector('.chip.verify') else None; time.sleep(3)
    shot(page, '08_cad_call')
    page.click('[data-act="create"]'); time.sleep(0.8)
    page.click('[data-act="assign"]'); time.sleep(1.2)
    shot(page, '09_assign_modal')
    page.click('[data-act="selrec"]'); time.sleep(0.3)
    # also add SWAT to prove freedom
    page.fill('[data-r="search"]', 'SWAT'); time.sleep(0.4)
    cb = page.query_selector('.assign-row input[type=checkbox]:not([disabled])')
    if cb: cb.check()
    page.click('.modal-foot [data-act="assign"]'); time.sleep(1)
    st = page.evaluate('() => { const s = window.__game.sim; const i = s.incidents.list[0]; return { units: i.units.map(id => s.units.byId(id).callsign), status: i.status }; }')
    print('  incident after assign:', st)
    assert any('SWAT' in u for u in st['units']), 'SWAT should be assignable to a fire'
    page.evaluate('() => window.__game.sim.setConfig({ timeScale: 4 })'); time.sleep(6)
    page.evaluate('() => window.__game.cad.showScreen("radio")'); time.sleep(0.8); shot(page, '10_radio')
    page.evaluate('() => window.__game.cad.showScreen("map")'); time.sleep(1.0); shot(page, '11_map')
    page.evaluate('() => { const g = window.__game; g.cad.selectIncident(g.sim.incidents.list[0].id); }'); time.sleep(0.8); shot(page, '12_incident_detail')
    for name in ['units', 'departments', 'board', 'supervisor', 'history', 'reports', 'settings']:
        page.evaluate(f'() => window.__game.cad.showScreen("{name}")'); time.sleep(0.5)
    shot(page, '13_settings_screen')
    page.evaluate('() => window.__game.cad.showScreen("supervisor")'); time.sleep(0.5); shot(page, '14_supervisor')
    # run the sim forward hard to exercise everything
    page.evaluate('''() => { const s = window.__game.sim; s.setConfig({ callFrequency: 'very_busy', timeScale: 4 }); }''')
    for k in range(10):
        page.evaluate('''() => { const g = window.__game, s = g.sim; const r = s.calls.ringing()[0];
          if (r && !s.calls.active()) s.calls.answer(r.id);
          const a = s.calls.active(); if (a && !a.incidentId && s.t - a.answeredAt > 4) { s.calls.say(a.id, 'where are you and what happened'); if (a.sc.kind === 'emergency') { const i = s.calls.createIncident(a.id, {}); s.units.assign(s.incidents.recommendations(i).map(x => x.unit), i.id); } s.calls.end(a.id); }
          for (const i of s.incidents.list.filter(x => x.status === 'completed')) g.closeIncident(i); }''')
        time.sleep(1)
    shot(page, '15_busy_cad')
    rep = page.evaluate('() => window.__game.sim.report()')
    print('  report:', {k: rep[k] for k in ['callsReceived', 'incidentsCreated', 'incidentsCompleted', 'unitsDispatched']})
    # stand up, staff chat, pause menu, save/export
    page.evaluate('() => window.__game.closeCAD()'); time.sleep(1)
    page.evaluate('''() => { const g = window.__game; const { openStaffChat } = window; }''')
    page.evaluate('() => import("./js/ui/staffChat.js").then(m => m.openStaffChat(window.__game, { id: "karen", name: "Karen Whitfield", role: "Shift Supervisor", sex: "f", pitch: 1, rate: 1, kind: "supervisor", personality: "x" }))'); time.sleep(0.8)
    page.fill('.modal [data-r="in"]', 'how busy are we right now?'); page.keyboard.press('Enter'); time.sleep(1.2)
    shot(page, '16_staff_chat')
    page.keyboard.press('Escape'); time.sleep(0.4)
    page.evaluate('() => window.__game.togglePauseMenu()'); time.sleep(0.5); shot(page, '17_pause')
    page.click('.modal-back >> text=Save now'); time.sleep(0.5)
    saved = page.evaluate('() => !!window.__game.save.loadShift()')
    print('  shift saved:', saved); assert saved
    page.click('.modal-back >> text=Save & quit to menu'); time.sleep(1.5)
    shot(page, '18_menu_continue')
    page.click('text=Continue shift'); time.sleep(2)
    cont = page.evaluate('() => ({ inc: window.__game.sim.incidents.list.length, units: window.__game.sim.units.list.length, t: window.__game.sim.t })')
    print('  continued:', cont)
    # weather & night visuals
    page.evaluate('() => { const g = window.__game; g.sim.weather.set("thunderstorm"); g.sim.state.time.clockStart = 22*60; const p = g.world.player; p.pos=[9,1.65,0]; p.yaw=-Math.PI/2; p.pitch=0.05; g.world.flash = 0.0; }'); time.sleep(1.5)
    shot(page, '19_night_storm_window')
    page.evaluate('() => window.__game.endShift()'); time.sleep(0.8); shot(page, '20_shift_report')
    ctx.close()

    # ---------------- Mobile ----------------
    print('▶ Mobile')
    m = p.devices['iPhone 13']
    ctx = browser.new_context(**{**m, 'viewport': {'width': 390, 'height': 844}})
    page = ctx.new_page(); attach(page, 'mobile')
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_selector('#menu:not([hidden]) .menu-btn', timeout=30000); time.sleep(1)
    shot(page, 'm01_menu')
    page.click('text=Training'); time.sleep(2)
    shot(page, 'm02_training_world')
    page.click('.m-btn.big'); time.sleep(1.5)
    shot(page, 'm03_cad_calls')
    page.keyboard.press('a') if False else None
    page.click('[data-act="answer"]') if page.query_selector('[data-act="answer"]') else None; time.sleep(2)
    chip = page.query_selector('.suggest .chip')
    if chip: chip.click()
    time.sleep(3)
    shot(page, 'm04_cad_call_active')
    page.click('.cad-bottom-tabs [data-id="map"]'); time.sleep(1); shot(page, 'm05_map')
    page.click('.cad-bottom-tabs [data-id="radio"]'); time.sleep(0.6); shot(page, 'm06_radio')
    page.click('.cad-bottom-tabs [data-id="more"]'); time.sleep(0.6); shot(page, 'm07_more')
    ctx.close()

    # landscape tablet
    print('▶ Tablet')
    ctx = browser.new_context(viewport={'width': 1180, 'height': 820}, has_touch=True, is_mobile=True)
    page = ctx.new_page(); attach(page, 'tablet')
    page.goto(f'http://127.0.0.1:{PORT}/index.html')
    page.wait_for_selector('#menu:not([hidden]) .menu-btn', timeout=30000); time.sleep(1)
    page.click('text=Free Play'); time.sleep(0.3); page.click('text=Start shift'); time.sleep(2)
    page.evaluate('() => { window.__game.goToDesk(); window.__game.sim.calls.spawnCall({templateId:"cardiac_arrest"}); }'); time.sleep(1.5)
    page.evaluate('() => window.__game.cad.answerNext()'); time.sleep(2)
    shot(page, 't01_cad_two_monitors')
    ctx.close()
    browser.close()

httpd.shutdown()
real = [e for e in errors if 'favicon' not in e]
print(f'\n{len(real)} console errors')
for e in real[:40]: print(' ', e)
sys.exit(1 if real else 0)
