// Call-taking screen: lines, transcript, speech/text input, suggestions, info form.
import { aniDetail, latLon } from './cadDetail.js';
import { Screen } from './cad.js';
import { bus } from '../../core/events.js';
import { el, bindActions, toast } from '../dom.js';
import { esc } from '../../core/util.js';
import { pri, gameAge, clock } from '../fmt.js';
import { INCIDENT_TYPES, INCIDENT_CATEGORIES, TYPE, guessTypeFromText } from '../../data/incidentTypes.js';
import { suggestions, SLOT_LABELS } from '../../ai/conversation.js';
import { PERSONAS } from '../../ai/dialogue.js';

function typeOptions(selected) {
  const groups = {};
  for (const t of INCIDENT_TYPES) (groups[t.category] ||= []).push(t);
  return Object.entries(groups).map(([cat, list]) => `<optgroup label="${INCIDENT_CATEGORIES[cat]?.label || cat}">${list.map((t) => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${t.label} (${t.code})</option>`).join('')}</optgroup>`).join('');
}

export class CallsScreen extends Screen {
  constructor(cad) { super(cad, 'calls', 'Calls', '📞'); this.callId = null; this.forms = {}; this.renderedLines = 0; this.renderedCall = null; this.seenInfo = {}; }

  badge() { return this.sim ? this.sim.calls.ringing().length : 0; }

  build() {
    this.root.innerHTML = `<div class="calls-layout">
      <div class="pane lines-pane"><div class="pane-head">Lines <span class="grow"></span><button class="btn sm" data-act="answer" title="Answer next (A)">Answer</button></div><div class="pane-body scroll" data-r="lines"></div></div>
      <div class="pane convo-pane" data-r="convo"></div>
      <div class="pane form-pane"><div class="pane-head">Call information</div><div class="pane-body scroll" data-r="form"></div></div>
    </div>`;
    this.r = (k) => this.root.querySelector(`[data-r="${k}"]`);
    bindActions(this.root, {
      answer: () => this.cad.answerNext(),
      line: (t) => this.selectLine(t.dataset.id),
      hold: () => { this.sim.calls.hold(this.callId); },
      resume: () => { this.sim.calls.answer(this.callId); },
      end: () => this.endCall(),
      callback: () => { const c = this.sim.calls.callback(this.callId); if (c) { this.callId = c.id; this.renderedCall = null; this.invalidate(); } },
      send: () => this.send(),
      mic: () => this.toggleMic(),
      suggest: (t) => this.say(t.dataset.text),
      useali: () => { const f = this.form(); f.useALI = !f.useALI; if (f.useALI) { f.location = this.call().sc.ani.address; f.locationEdited = true; } this.renderForm(true); },
      create: () => this.createIncident(),
      link: () => this.linkIncident(),
      linkdup: (t) => this.linkIncident(t.dataset.id),
      openinc: () => { const c = this.call(); if (c?.incidentId) this.cad.selectIncident(c.incidentId); },
      assign: () => { const c = this.call(); if (c?.incidentId) this.cad.screens.incidents.openAssign(c.incidentId); },
    });
    this.root.addEventListener('input', (e) => {
      const f = this.form(); if (!f) return;
      const n = e.target.dataset.f; if (!n) return;
      f[n] = e.target.value; if (n === 'location') { f.locationEdited = true; f.useALI = false; }
    });
    this.root.addEventListener('change', (e) => { const f = this.form(); const n = e.target.dataset.f; if (f && n) { f[n] = e.target.value; if (n === 'typeId') { f.priority = String(TYPE[f.typeId]?.priority || 3); f.typeEdited = true; this.renderForm(true); } } });
    this.root.addEventListener('keydown', (e) => { if (e.target.dataset.r === 'say' && e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); this.send(); } });
    const inv = () => this.invalidate();
    for (const ev of ['call:incoming', 'call:answered', 'call:updated', 'call:ended', 'incident:created', 'incident:updated']) bus.on(ev, inv);
    bus.on('call:message', ({ call }) => { if (call.id === this.callId) this.invalidate(); else this.invalidate(); });
    bus.on('call:answered', ({ call }) => { this.callId = call.id; this.renderedCall = null; });
  }

  call() { return this.callId ? this.sim.calls.byId(this.callId) : null; }
  form() {
    const c = this.call(); if (!c) return null;
    if (!this.forms[c.id]) {
      const guess = guessTypeFromText(c.sc.natureNote || c.sc.nature) || 'OTHER';
      this.forms[c.id] = { typeId: guess, priority: String(TYPE[guess]?.priority || 3), location: '', notes: '', useALI: false, locationEdited: false };
    }
    return this.forms[c.id];
  }

  selectLine(id) { this.callId = id; this.renderedCall = null; const c = this.call(); if (c?.status === 'ringing') this.sim.calls.answer(id); this.invalidate(); }

  onShow() { if (!this.callId) { const a = this.sim?.calls.active(); if (a) this.callId = a.id; } }
  tick() { this.renderLines(); }

  render() {
    const sim = this.sim; if (!sim) return;
    if (!this.callId || !this.call()) { const a = sim.calls.active() || sim.calls.held()[0]; this.callId = a?.id || null; }
    this.renderLines(); this.renderConvo(); this.renderForm();
  }

  renderLines() {
    const sim = this.sim; const box = this.r('lines'); if (!box) return;
    const live = sim.calls.list.filter((c) => ['ringing', 'active', 'hold'].includes(c.status)).sort((a, b) => a.line - b.line);
    const recent = sim.calls.list.filter((c) => ['ended', 'abandoned'].includes(c.status)).slice(0, 6);
    const card = (c) => {
      const stat = c.status === 'ringing' ? `<span class="bad">RINGING ${gameAge(sim, c.receivedAt)}</span>` : c.status === 'active' ? '<span class="good">● CONNECTED</span>' : c.status === 'hold' ? '<span class="warn">ON HOLD</span>' : c.status === 'abandoned' ? `<span class="warn">ABANDONED${c.calledBack ? ' (called back)' : ''}</span>` : '<span class="dim">ENDED</span>';
      const sub = c.status === 'ringing' ? `${c.sc.ani.kind === 'wireless' ? '📱' : '☎'} ${esc(c.sc.ani.phone)}` : esc((c.info.nature || c.sc.ani.address || '').slice(0, 60));
      return `<div class="line-card ${c.status} ${c.id === this.callId ? 'sel' : ''}" data-act="line" data-id="${c.id}" style="${c.id === this.callId ? 'outline:1px solid #3a8be6' : ''}">
        <div class="lc-top"><span>Line ${c.line}</span>${stat}</div><div class="lc-sub">${sub}</div>${c.incidentId ? `<div class="lc-sub good">↳ ${esc(sim.incidents.byId(c.incidentId)?.number || '')}</div>` : ''}</div>`;
    };
    box.innerHTML = (live.length ? live.map(card).join('') : '<div class="empty">No active lines.<br><span class="dim">Waiting for calls…</span></div>') + (recent.length ? `<div class="section-title" style="margin:10px 8px 2px">Recent</div>${recent.map(card).join('')}` : '');
  }

  moodHTML(c) {
    const p = c.convo.panic; const label = p < 0.3 ? 'Calm' : p < 0.55 ? 'Anxious' : p < 0.75 ? 'Upset' : 'Panicked';
    const color = p < 0.3 ? '#2fd08a' : p < 0.55 ? '#f2c94c' : p < 0.75 ? '#ff9f43' : '#ff5a4e';
    return `<span class="mood" title="Caller emotional state – reassurance and instructions calm callers down">${label}<span class="meter"><i style="width:${Math.round(p * 100)}%;background:${color}"></i></span></span>`;
  }

  renderConvo() {
    const box = this.r('convo'); const c = this.call(); const sim = this.sim;
    if (!c) {
      const n = sim.calls.ringing().length;
      box.innerHTML = `<div class="no-call"><div class="big">📞</div><div>${n ? `<b>${n}</b> call${n > 1 ? 's' : ''} ringing` : 'No call connected'}</div>
        <div class="dim" style="margin:6px 0 12px;font-size:.9em">${n ? 'Press <span class="kbd">A</span> or click Answer.' : 'Incoming calls ring here. Take your time.'}</div>
        ${n ? '<button class="btn primary lg" data-act="answer">Answer next call</button>' : ''}</div>`;
      this.renderedCall = null; return;
    }
    if (this.renderedCall !== c.id) {
      this.renderedCall = c.id; this.renderedLines = 0;
      box.innerHTML = `<div class="pane-head" data-r="chead"></div>
        <div class="ani-box" data-r="ani"></div>
        <div class="pane-body scroll" data-r="tscroll"><div class="transcript" data-r="transcript"></div></div>
        <div class="suggest" data-r="suggest"></div>
        <div class="say-row" data-r="sayrow">
          <button class="btn mic" data-act="mic" title="Talk with your microphone (F2)">🎤</button>
          <input class="input grow" data-r="say" placeholder="Type what you say to the caller… (Enter to send)" autocomplete="off">
          <button class="btn primary" data-act="send">Send</button>
        </div>`;
    }
    const persona = PERSONAS[c.sc.caller.persona]?.label || '';
    const live = ['active', 'hold'].includes(c.status);
    this.r('chead').innerHTML = `Line ${c.line} <span class="grow mono" style="color:var(--text)">${esc(c.info.name || 'Unknown caller')}</span>${live ? this.moodHTML(c) : ''}
      ${c.status === 'active' ? '<button class="btn sm warn" data-act="hold">Hold</button>' : ''}${c.status === 'hold' ? '<button class="btn sm good" data-act="resume">Resume</button>' : ''}
      ${live ? '<button class="btn sm danger" data-act="end" title="End call (F4)">End call</button>' : ''}${c.status === 'abandoned' || c.status === 'ended' ? '<button class="btn sm" data-act="callback">↩ Call back</button>' : ''}`;
    const a = c.sc.ani;
    const ad = aniDetail(a);
    this.r('ani').innerHTML = `<b>ANI</b><span>${esc(a.phone)} · ${esc(a.name)} · ${a.kind.toUpperCase()}</span><b>ALI</b><span>${esc(a.address)}${a.radius ? ` <span class="dim">(±${a.radius}m)</span>` : ''}</span>`
      + `<b>COS</b><span>${ad.cos} · ${esc(ad.carrier)}${ad.tower ? ` · ${esc(ad.tower)}` : ''}</span>`
      + (ad.j ? `<b>LOC</b><span>${latLon(ad.j)} <span class="dim">· ${esc(ad.confidence)}</span></span><b>ESN</b><span>${ad.j.esn} · ${esc(ad.j.law)} · ${esc(ad.j.fireShort)} · ${esc(ad.j.emsShort)} · grid ${esc(ad.j.grid)}</span>` : '')
      + `<b>PSAP</b><span class="dim">${esc(ad.psap)} · callback ${esc(ad.callback)}</span>`
      + (persona ? `<b>VOICE</b><span class="dim">${c.sc.caller.sex === 'f' ? 'Female' : 'Male'} · sounds ${persona.toLowerCase()}</span>` : '');
    // transcript – append incrementally
    const tbox = this.r('transcript'); const scroll = this.r('tscroll');
    const atBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 60;
    tbox.querySelector('.typing')?.remove();
    for (let i = this.renderedLines; i < c.transcript.length; i++) {
      const l = c.transcript[i];
      tbox.insertAdjacentHTML('beforeend', `<div class="tl ${l.who}">${l.who === 'system' ? '' : `<span class="tl-who">${l.who === 'caller' ? 'CALLER' : 'YOU'} · ${clock(l.clock, this.game)}</span>`}${esc(l.text)}</div>`);
    }
    this.renderedLines = c.transcript.length;
    if (c.pendingReply && c.status === 'active') tbox.insertAdjacentHTML('beforeend', '<div class="typing">Caller is speaking…</div>');
    if (atBottom || true) scroll.scrollTop = scroll.scrollHeight;
    // suggestions
    const sug = this.r('suggest');
    if (c.status === 'active') {
      sug.hidden = false;
      const list = suggestions(c).map((s) => {
        let text = s.text;
        if (s.key === 'verify') text = `Let me confirm, the address is ${c.info.location || c.sc.loc.full}?`;
        return `<button class="chip ${s.kind}" data-act="suggest" data-text="${esc(text)}" title="${esc(text)}">${esc(s.key === 'verify' ? '✔ Read back address' : text)}</button>`;
      }).join('');
      sug.innerHTML = list;
    } else sug.hidden = true;
    this.r('sayrow').style.display = c.status === 'active' ? '' : 'none';
  }

  renderForm(force = false) {
    const box = this.r('form'); const c = this.call(); const sim = this.sim;
    if (!c) { box.innerHTML = '<div class="empty">Answer a call to start gathering information.</div>'; this.formFor = null; return; }
    const f = this.form();
    if (!f.locationEdited && c.info.location) f.location = c.info.location;
    const inc = c.incidentId ? sim.incidents.byId(c.incidentId) : null;
    const seen = this.seenInfo[c.id] ||= {};
    const rows = Object.entries(c.info).filter(([k, v]) => v && k !== 'notes' && SLOT_LABELS[k]).map(([k, v]) => {
      const isNew = seen[k] !== v; seen[k] = v;
      return `<div class="${isNew ? 'new' : ''}"><b>${SLOT_LABELS[k]}</b><span>${esc(v)}</span></div>`;
    });
    for (const n of c.info.notes || []) rows.push(`<div><b>Note</b><span>${esc(n)}</span></div>`);
    const infoHTML = `<div class="info-list">${rows.length ? rows.join('') : '<div class="dim" style="border:none">Ask questions – answers fill in here automatically.</div>'}</div>`;
    const dups = c.status !== 'ended' && !inc ? sim.calls.possibleDuplicates(c) : [];
    const dupHTML = dups.length ? `<div class="dup-banner">⚠ Possible related incident${dups.length > 1 ? 's' : ''} nearby:${dups.slice(0, 3).map((d) => `<div class="row" style="margin-top:4px"><span class="grow">${pri(d.priority)} ${esc(d.number)} ${esc(d.typeLabel)} – ${esc(d.location.short || d.location.full)}</span><button class="btn sm" data-act="linkdup" data-id="${d.id}">Link</button></div>`).join('')}</div>` : '';
    // Only rebuild the editable form when the call changes (keeps typing intact)
    const key = `${c.id}:${!!inc}:${c.status}`;
    if (this.formFor !== key || force) {
      this.formFor = key;
      const openIncs = sim.incidents.open().filter((i) => i.status !== 'completed');
      box.innerHTML = `<div class="info-form">
        <div data-r="info"></div><div data-r="dups"></div>
        ${inc ? `<div class="rec-box"><b>Incident ${esc(inc.number)} created</b><div class="dim" style="margin:3px 0 8px">${esc(inc.typeLabel)} · ${esc(inc.location.full)}</div>
            <div class="row wrap"><button class="btn primary sm" data-act="assign">Assign units</button><button class="btn sm" data-act="openinc">Open incident</button></div></div>
            <div class="dim" style="font-size:.82em">Keep the caller on the line for updates and instructions, or end the call when you're done.</div>`
          : c.status === 'ringing' ? '' : `
        <div class="section-title">Create incident</div>
        <label class="field">Incident type<select class="input" data-f="typeId">${typeOptions(f.typeId)}</select></label>
        <div class="row"><label class="field grow">Priority<select class="input" data-f="priority">${[1, 2, 3, 4].map((p) => `<option value="${p}" ${String(p) === String(f.priority) ? 'selected' : ''}>P${p}</option>`).join('')}</select></label></div>
        <label class="field">Location <span data-r="verif"></span><input class="input" data-f="location" value="${esc(f.location)}" placeholder="Ask the caller for the address"></label>
        <div class="row wrap"><button class="btn sm ${f.useALI ? 'active' : ''}" data-act="useali" title="Use the phone company location (may not be where the emergency is!)">📍 Use ALI location</button></div>
        <label class="field">Notes<textarea class="input" rows="2" data-f="notes" placeholder="Optional dispatcher notes">${esc(f.notes)}</textarea></label>
        <button class="btn primary" data-act="create" title="Ctrl+Enter">➕ Create incident</button>
        ${openIncs.length ? `<div class="row"><select class="input grow" data-r="linksel">${openIncs.slice(0, 40).map((i) => `<option value="${i.id}">${esc(i.number)} – ${esc(i.typeLabel)}</option>`).join('')}</select><button class="btn sm" data-act="link">Link</button></div>
          <div class="dim" style="font-size:.78em">Link this call to an existing incident instead (duplicate caller).</div>` : ''}
        ${c.sc.kind !== 'emergency' && c.sc.kind !== 'duplicate' ? '<div class="dim" style="font-size:.82em">Not every call needs an incident – you can simply help the caller and end the call.</div>' : ''}`}
      </div>`;
    } else {
      const locInput = box.querySelector('[data-f="location"]');
      if (locInput && document.activeElement !== locInput && !f.locationEdited && locInput.value !== f.location) locInput.value = f.location;
    }
    const infoBox = box.querySelector('[data-r="info"]'); if (infoBox) infoBox.innerHTML = infoHTML;
    const dupBox = box.querySelector('[data-r="dups"]'); if (dupBox) dupBox.innerHTML = dupHTML;
    const verif = box.querySelector('[data-r="verif"]');
    if (verif) verif.innerHTML = c.verified ? '<span class="verified">✔ verified with caller</span>' : c.convo.revealed.location ? '<span class="unverified">not read back</span>' : '';
  }

  focusInput() { this.r('say')?.focus(); }

  say(text) {
    const c = this.call(); if (!c || c.status !== 'active') return;
    this.sim.calls.say(c.id, text);
    this.game.audio?.typing(4);
  }

  send() {
    const inp = this.r('say'); if (!inp) return;
    const text = inp.value.trim(); if (!text) return;
    inp.value = ''; this.say(text);
  }

  async toggleMic() {
    const sp = this.game.speech; const c = this.call();
    if (!c || c.status !== 'active') { toast('Answer a call first, then press the mic button to talk.', { level: 'info' }); return; }
    if (sp.listening) { sp.stopListening(); return; }
    const btn = this.root.querySelector('[data-act="mic"]'); const inp = this.r('say');
    btn?.classList.add('listening');
    const okStart = await sp.listen({
      onInterim: (t) => { if (inp) inp.value = t; },
      onFinal: (t) => { if (inp) inp.value = t; if (this.game.settings.data.speech.autoSend) this.send(); },
      onEnd: () => { btn?.classList.remove('listening'); },
      onError: (msg) => { btn?.classList.remove('listening'); toast(msg, { level: 'warn', title: 'Microphone' }); },
    });
    if (!okStart) btn?.classList.remove('listening');
  }

  createIncident() {
    const c = this.call(); if (!c || c.incidentId) return;
    if (c.status === 'ringing') { toast('Answer the call first.', { level: 'info' }); return; }
    const f = this.form();
    const inc = this.sim.calls.createIncident(c.id, { typeId: f.typeId, priority: f.priority, location: f.location, notes: f.notes, useALI: f.useALI });
    if (inc) {
      toast(`Incident ${inc.number} created – ${inc.typeLabel}`, { level: 'good', title: 'CAD' });
      this.game.audio?.typing(6);
      this.cad.selectedIncident = inc.id;
      this.formFor = null; this.invalidate();
      if (inc.location.approximate) toast('Location is approximate (based on the phone). Units may need to search.', { level: 'warn' });
      this.game.tutorial?.event('incidentCreated', inc);
    }
  }

  linkIncident(id) {
    const c = this.call(); if (!c) return;
    const sel = this.root.querySelector('[data-r="linksel"]');
    const target = id || sel?.value; if (!target) return;
    if (this.sim.calls.linkToIncident(c.id, target)) { toast(`Call linked to ${this.sim.incidents.byId(target).number}`, { level: 'good' }); this.formFor = null; this.invalidate(); }
  }

  endCall() {
    const c = this.call(); if (!c || !['active', 'hold'].includes(c.status)) return;
    this.sim.calls.end(c.id);
    this.game.speech?.stopAll();
    const next = this.sim.calls.active() || this.sim.calls.held()[0];
    if (next) { this.callId = next.id; this.renderedCall = null; }
    this.invalidate();
  }
}
