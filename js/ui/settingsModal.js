// Full settings window.
import { modal, toast } from './dom.js';
import { esc } from '../core/util.js';

function gfxStatus(st) {
  const fx = [st.shadows && 'shadows', st.msaa ? `${st.msaa}× MSAA` : st.post && 'FXAA', st.bloom && 'glow'].filter(Boolean).join(', ') || 'basic lighting';
  return `${st.preset[0].toUpperCase()}${st.preset.slice(1)} · ${st.width}×${st.height}${st.scale < 1 ? ` (${Math.round(st.scale * 100)}%)` : ''} · ${fx} · ${st.fps} FPS${st.note ? ` · ${st.note}` : ''}`;
}

export function openSettings(game) {
  const s = game.settings; let tab = 'graphics';
  const body = document.createElement('div');
  const m = modal({ title: 'Settings', body, wide: true, foot: [{ label: 'Done', act: 'done', cls: 'primary' }], onAction: (a, t) => act(a, t), onClose: () => { game.save.snapshotSettings(s); game.save.save(); } });
  const tabs = { graphics: 'Graphics', audio: 'Audio', speech: 'Speech & AI', controls: 'Controls', ui: 'Interface' };

  function row(label, sub, control) { return `<div class="set"><div>${label}${sub ? `<small>${sub}</small>` : ''}</div>${control}</div>`; }
  const range = (path, min = 0, max = 1, step = 0.05) => `<input type="range" style="width:150px" min="${min}" max="${max}" step="${step}" data-path="${path}" value="${s.get(path)}">`;
  const tog = (path) => `<label class="toggle"><input type="checkbox" data-path="${path}" ${s.get(path) ? 'checked' : ''}></label>`;
  const sel = (path, opts) => `<select class="input" style="width:auto" data-path="${path}">${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${String(s.get(path)) === String(k) ? 'selected' : ''}>${v}</option>`).join('')}</select>`;

  function draw() {
    let html = `<div class="row wrap" style="gap:4px;margin-bottom:10px">${Object.entries(tabs).map(([k, v]) => `<button class="chip ${tab === k ? 'active' : ''}" data-act="tab" data-t="${k}">${v}</button>`).join('')}</div><div class="settings-list" style="padding:0">`;
    if (tab === 'graphics') {
      const st = game.world?.status?.() || {};
      const desc = { low: 'Fastest. Simple furniture, no shadows or post effects – best for older phones.', medium: 'Rounded furniture, soft shadows, reflections and anti-aliasing. Good for most phones and laptops.', high: 'Full detail, 4× MSAA, softer shadows and screen glow. For desktops and recent laptops.', ultra: 'Everything on: sharpest resolution, 12 lights, moving shadows for people.' };
      html += row('Quality preset', `Auto picks a preset for this device (currently <b>${esc(s.graphicsPreset())}</b>). Changes apply instantly.<br>${esc(desc[s.graphicsPreset()] || '')}`, sel('graphics.preset', { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' }))
        + row('Adaptive performance', 'Automatically lowers resolution, then effects, then the preset if the game starts to lag. Smooth gameplay always comes first.', tog('graphics.adaptive'))
        + (st.preset && st.preset !== 'off' ? row('Current rendering', `<span data-r="gfxstatus">${esc(gfxStatus(st))}</span>`, '') : '')
        + row('Field of view', 'Camera field of view in degrees.', range('graphics.fov', 55, 95, 1))
        + row('FPS counter', '', tog('graphics.fpsCounter'))
        + row('Monitor screen refresh', 'How often the 3D monitors redraw (lower = faster on slow devices).', sel('graphics.monitorRefresh', { 0.5: 'Every 2 seconds', 1: 'Every second', 2: 'Twice a second' }))
        + row('Full screen', '', '<button class="btn sm" data-act="fullscreen">Toggle full screen</button>');
    } else if (tab === 'audio') {
      html += row('Master volume', '', range('audio.master'));
      for (const [k, label] of [['game', 'Game sounds'], ['caller', 'Caller voices'], ['radio', 'Radio'], ['ambience', 'Background ambience'], ['notifications', 'Notifications & phone']]) {
        html += row(label, '', `<span class="row">${range(`audio.${k}`)}<label class="toggle" title="Mute"><input type="checkbox" data-path="audio.muted.${k}" data-invert="1" ${!s.get(`audio.muted.${k}`) ? 'checked' : ''}></label></span>`);
      }
    } else if (tab === 'speech') {
      const sp = game.speech;
      html += row('Caller voices', sp.ttsSupported ? 'Browser text-to-speech.' : '<span class="warn">Not supported in this browser.</span>', tog('speech.tts'))
        + row('Radio voices', 'Speak unit radio traffic aloud.', tog('speech.radioTTS'))
        + row('Staff voices', 'Coworkers speak aloud.', tog('speech.staffTTS'))
        + row('Speech recognition', sp.recognitionSupported ? `Supported. Microphone: <b>${esc(sp.micState)}</b>.` : '<span class="warn">Not supported in this browser – type or use suggested questions (Chrome, Edge and Safari support it).</span>', `<button class="btn sm" data-act="mictest" ${sp.recognitionSupported ? '' : 'disabled'}>Test microphone</button>`)
        + row('Auto-send speech', 'Send what you say as soon as you stop talking.', tog('speech.autoSend'))
        + row('Recognition language', '', sel('speech.lang', { 'en-US': 'English (US)', 'en-GB': 'English (UK)', 'en-AU': 'English (AU)', 'en-CA': 'English (CA)', 'en-IN': 'English (India)' }))
        + `<div class="set" style="flex-direction:column;align-items:stretch"><div><b>Optional local AI model</b><small>Make caller wording more natural with a language model running on <i>your own computer</i>. Free, no keys, never required. The game's engine still decides what callers know – the model only rephrases. Works with <b>Ollama</b> (set OLLAMA_ORIGINS="*" so the browser may connect) or any OpenAI-compatible local server like LM Studio.</small></div>
          <div class="row wrap" style="margin-top:8px">${tog('llm.enabled')}<span>Enabled</span>${sel('llm.kind', { ollama: 'Ollama', openai: 'OpenAI-compatible (LM Studio)' })}</div>
          <div class="row wrap" style="margin-top:6px"><input class="input grow" data-path="llm.endpoint" value="${esc(s.get('llm.endpoint'))}" placeholder="http://localhost:11434"><input class="input" style="width:150px" data-path="llm.model" value="${esc(s.get('llm.model'))}" placeholder="model name"><button class="btn sm" data-act="llmtest">Test connection</button></div>
          <div class="dim" data-r="llmstatus" style="font-size:.85em;margin-top:5px">Status: ${esc(game.llm.status)}${game.llm.lastError ? ` – ${esc(game.llm.lastError)}` : ''}</div></div>`;
    } else if (tab === 'controls') {
      html += row('Mouse sensitivity', '', range('controls.mouseSensitivity', 0.2, 3, 0.05))
        + row('Invert Y axis', '', tog('controls.invertY'))
        + row('Touch look sensitivity', '', range('controls.touchSensitivity', 0.3, 3, 0.05))
        + row('Head bob while walking', '', tog('controls.headBob'))
        + row('Keyboard shortcuts', 'WASD move · E interact · Tab go to console · Esc stand/pause · At console: A answer, T talk, F2 mic, Ctrl+Enter create incident, U assign, F4 end call, P pause.', '');
    } else {
      html += row('Text size', '', range('ui.textScale', 0.85, 1.35, 0.05))
        + row('Pop-up notifications', '', tog('ui.toasts'))
        + row('…for incoming calls', '', tog('ui.toastCalls'))
        + row('…for radio requests', '', tog('ui.toastRadio'))
        + row('…for incidents', '', tog('ui.toastIncidents'))
        + row('24-hour clock', '', tog('ui.clock24'))
        + row('Show control hints', '', tog('ui.showHints'))
        + row('Holiday decorations', 'Thanksgiving decorations in the dispatch center (automatic = all of November).', sel('ui.seasonal', { auto: 'Automatic', on: 'Always on', off: 'Off' }));
    }
    body.innerHTML = `${html}</div>`;
  }

  body.addEventListener('input', (e) => apply(e.target));
  body.addEventListener('change', (e) => apply(e.target));
  function apply(t) {
    const p = t.dataset.path; if (!p) return;
    let v = t.type === 'checkbox' ? t.checked : t.type === 'range' ? parseFloat(t.value) : t.value;
    if (t.dataset.invert) v = !v;
    if (p === 'graphics.monitorRefresh') v = parseFloat(v);
    s.set(p, v);
    if (p === 'graphics.preset') setTimeout(draw, 60);
  }
  async function act(a, t) {
    if (a === 'done') m.close();
    else if (a === 'tab') { tab = t.dataset.t; draw(); }
    else if (a === 'fullscreen') game.toggleFullscreen();
    else if (a === 'mictest') {
      toast('Say something…', { level: 'info', title: 'Microphone test' });
      await game.speech.listen({ onFinal: (txt) => toast(`Heard: "${txt}"`, { level: 'good', title: 'Microphone test' }), onError: (msg) => toast(msg, { level: 'warn' }) });
      setTimeout(draw, 300);
    } else if (a === 'llmtest') {
      const st = body.querySelector('[data-r="llmstatus"]'); st.textContent = 'Testing…';
      const r = await game.llm.test(); st.textContent = r.ok ? `Connected ✓ – model replied "${r.reply.slice(0, 40)}"` : `Could not connect: ${r.error}`;
    }
  }
  draw();
  return m;
}
