// Conversation window for dispatch-center staff and visitors.
import { modal, toast } from './dom.js';
import { esc } from '../core/util.js';

const QUICK = ['How are you?', 'Tell me a story', 'Tell me another one', 'Any tips for me?', 'How busy are we?', 'When is roll call?', 'Can I take a break?', 'How do I get promoted?', 'Tell me a joke', 'Can you take a call for me?'];

export function openStaffChat(game, npc) {
  const sd = game.staffDialogue;
  const body = document.createElement('div');
  body.innerHTML = `<div class="chat-log scroll" data-r="log"></div>
    <div class="row wrap" style="gap:4px;margin:10px 0 8px" data-r="quick">${QUICK.map((q) => `<button class="chip" data-act="q" data-t="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <div class="row"><button class="btn mic" data-act="mic" title="Talk with your microphone">🎤</button><input class="input grow" data-r="in" placeholder="Say something to ${esc(npc.name.split(' ')[0])}…" autofocus><button class="btn primary" data-act="send">Send</button></div>`;
  const m = modal({ title: `${esc(npc.name)} <span class="dim" style="font-weight:400;font-size:.85em">· ${esc(npc.role)}</span>`, body, onAction: (a, t) => {
    if (a === 'send') send(input.value); else if (a === 'q') send(t.dataset.t); else if (a === 'mic') mic(t);
  }, onClose: () => { game.world?.setTalking(null); } });
  const log = body.querySelector('[data-r="log"]'); const input = body.querySelector('[data-r="in"]');
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(input.value); } });
  game.world?.setTalking(npc.id);

  function add(who, text) {
    log.insertAdjacentHTML('beforeend', `<div class="bubble ${who === 'me' ? 'me' : 'them'}">${who === 'me' ? '' : `<span class="who">${esc(npc.name)}</span>`}${esc(text)}</div>`);
    log.scrollTop = log.scrollHeight;
  }
  function speak(text) { game.speech.speak(text, { key: npc.id, sex: npc.sex, pitch: npc.pitch, rate: npc.rate, category: 'staff' }); }

  async function send(text) {
    text = String(text || '').trim(); if (!text) return;
    input.value = ''; add('me', text);
    let res = sd.reply(npc, text);
    if (game.llm.enabled && !res.action) { const t = await game.llm.staffReply(npc, text, res.text); res = { ...res, text: t }; }
    setTimeout(() => {
      add('them', res.text); speak(res.text);
      if (res.action === 'break') game.setBreak(true);
      if (res.action === 'endbreak') game.setBreak(false);
      if (res.action === 'delegated') toast(`${npc.name} dispatched one of your incidents.`, { level: 'good' });
      if (res.action === 'end') setTimeout(() => m.close(), 1400);
    }, 450 + Math.random() * 400);
  }

  async function mic(btn) {
    if (game.speech.listening) { game.speech.stopListening(); return; }
    btn.classList.add('listening');
    const okStart = await game.speech.listen({ onInterim: (t) => { input.value = t; }, onFinal: (t) => send(t), onEnd: () => btn.classList.remove('listening'), onError: (msg) => { btn.classList.remove('listening'); toast(msg, { level: 'warn' }); } });
    if (!okStart) btn.classList.remove('listening');
  }

  const open = sd.opener(npc); add('them', open); speak(open);
  return m;
}
