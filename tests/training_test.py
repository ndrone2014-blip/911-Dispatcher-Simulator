"""Plays the full training tutorial in headless Chrome. Usage: python3 tests/training_test.py"""
import http.server, socketserver, threading, os, sys, time, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', 8766), functools.partial(Q, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1600, 'height': 900})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://127.0.0.1:8766/index.html'); pg.wait_for_selector('#menu:not([hidden]) .menu-btn'); time.sleep(1)
    pg.click('text=Training'); time.sleep(1.5)
    step = lambda: pg.evaluate('() => window.__game.tutorial ? window.__game.tutorial.i : -1')
    def say(t):
        pg.fill('[data-r="say"]', t); pg.keyboard.press('Enter'); time.sleep(2.5)
    pg.keyboard.press('Tab'); time.sleep(1.5); print('after desk step', step())
    pg.click('[data-screen="calls"] [data-act="answer"]'); time.sleep(2); print('answered step', step())
    say('What is the address of your emergency?'); print('location step', step())
    pg.click('.chip.verify'); time.sleep(2.5); print('verify step', step())
    say('Is anyone hurt?'); print('injury step', step())
    pg.click('[data-act="create"]'); time.sleep(1); print('create step', step())
    pg.click('.rec-box [data-act="assign"]'); time.sleep(1); pg.click('[data-act="selrec"]'); pg.click('.modal-foot [data-act="assign"]'); time.sleep(1); print('assign step', step())
    say('Help is on the way'); print('reassure step', step())
    pg.evaluate('() => window.__game.sim.setConfig({ timeScale: 4 })')
    pg.evaluate('() => window.__game.cad.showScreen("radio")')
    for _ in range(60):
        if step() > 8: break
        time.sleep(1)
    print('arrival step', step())
    pg.click('[data-screen="radio"] [data-act="q"][data-i="status"]'); time.sleep(1.5); print('radio step', step())
    for _ in range(120):
        if step() > 10: break
        time.sleep(1)
    print('completed step', step())
    time.sleep(1)
    pg.click('[data-act="close"]'); time.sleep(1.5); print('close step', step())
    pg.evaluate('''() => { const s = window.__game.sim; for (const c of s.calls.ringing()) { s.calls.answer(c.id); } }'''); time.sleep(2)
    pg.evaluate('''() => { const s = window.__game.sim; for (const c of s.calls.list.filter(c => ['active','hold'].includes(c.status))) { if (c.status==='hold') s.calls.answer(c.id); s.calls.createIncident(c.id, {}); } }'''); time.sleep(1.5)
    print('final step', step(), '/ 13')
    pg.screenshot(path=sys.argv[1] if len(sys.argv) > 1 else '/tmp/train.png')
    ok = step() == 13
    b.close()
httpd.shutdown()
print('errors:', errs[:10])
sys.exit(0 if ok and not errs else 1)
