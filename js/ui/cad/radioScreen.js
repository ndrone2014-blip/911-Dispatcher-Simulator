// Radio console: channels, monitoring, per-channel mute, transcript, transmit.
import { Screen } from './cad.js';
import { bus } from '../../core/events.js';
import { bindActions, toast } from '../dom.js';
import { esc } from '../../core/util.js';
import { clock, chanTag } from '../fmt.js';
import { CHANNELS, CHANNEL_BY_ID } from '../../data/departments.js';

export class RadioScreen extends Screen {
  constructor(cad) { super(cad, 'radio', 'Radio', '📻'); this.channel = 'all'; this.lastSeen = {}; this.renderedUpTo = 0; this.feedKey = null; this.target = ''; }

  badge() {
    if (!this.sim) return 0;
    if (this.visible) return 0;
    const mon = this.game.settings.data.radio.monitored;
    return this.sim.radio.log.filter((m) => m.id > (this.lastSeen.all || 0) && mon[m.channel] !== false && !m.dispatcher).length;
  }

  build() {
    this.root.innerHTML = `<div class="radio-layout">
      <div class="pane"><div class="pane-head">Channels</div><div class="pane-body scroll chan-list" data-r="chans"></div>
        <div style="padding:8px;border-top:1px solid var(--line)" class="hide-narrow"><label class="field">Radio volume<input type="range" min="0" max="1" step="0.05" data-r="vol"></label></div></div>
      <div class="pane"><div class="pane-head"><span data-r="title" class="grow"></span><label class="toggle" style="text-transform:none;letter-spacing:0;font-weight:600"><input type="checkbox" data-r="tts"> Speak radio</label></div>
        <div class="pane-body scroll" data-r="feed"></div>
        <div class="tx-box">
          <div class="row wrap"><select class="input" data-r="target" style="width:auto;max-width:240px"></select>
            <button class="btn sm" data-act="q" data-i="status">Status?</button><button class="btn sm" data-act="q" data-i="eta">ETA?</button><button class="btn sm" data-act="q" data-i="update">Update?</button>
            <button class="btn sm" data-act="q" data-i="need">Need anything?</button><button class="btn sm" data-act="q" data-i="return">Return to quarters</button><button class="btn sm" data-act="q" data-i="cancel">Cancel</button></div>
          <div class="row"><button class="btn mic" data-act="mic" title="Talk on the radio with your microphone">🎤</button><input class="input grow" data-r="tx" placeholder="Transmit to the selected unit or channel…"><button class="btn primary" data-act="tx">Transmit</button></div>
        </div></div></div>`;
    const q = (k) => this.root.querySelector(`[data-r="${k}"]`);
    this.q = q;
    q('vol').value = this.game.settings.data.audio.radio;
    q('vol').addEventListener('input', (e) => this.game.settings.set('audio.radio', parseFloat(e.target.value)));
    q('tts').checked = this.game.settings.data.speech.radioTTS;
    q('tts').addEventListener('change', (e) => this.game.settings.set('speech.radioTTS', e.target.checked));
    q('target').addEventListener('change', (e) => { this.target = e.target.value; });
    q('tx').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.transmit(); } });
    bindActions(this.root, {
      chan: (t) => { this.channel = t.dataset.c; this.feedKey = null; this.renderTargets(); this.invalidate(); },
      mon: (t, e) => { e.stopPropagation(); const r = this.game.settings.data.radio; r.monitored[t.dataset.c] = r.monitored[t.dataset.c] === false; this.game.settings.set('radio.monitored', r.monitored); this.feedKey = null; this.invalidate(); },
      spk: (t, e) => { e.stopPropagation(); const r = this.game.settings.data.radio; r.speakChannels[t.dataset.c] = !r.speakChannels[t.dataset.c]; this.game.settings.set('radio.speakChannels', r.speakChannels); this.invalidate(); },
      q: (t) => this.transmit(t.dataset.i),
      tx: () => this.transmit(),
      mic: () => this.mic(),
      unit: (t) => this.cad.screens.units.openUnit(t.dataset.u),
      inc: (t) => this.cad.selectIncident(t.dataset.id),
    });
    bus.on('radio:message', () => this.invalidate());
    bus.on('unit:status', () => { if (this.visible) this.renderTargets(); });
  }

  onShow() { this.renderTargets(); }

  renderTargets() {
    if (!this.sim) return;
    const sel = this.q('target'); const cur = this.target || sel.value;
    const units = this.sim.units.list.filter((u) => (this.channel === 'all' || u.channel === this.channel) && u.status !== 'available');
    const idle = this.sim.units.list.filter((u) => (this.channel === 'all' || u.channel === this.channel) && u.status === 'available');
    const chans = this.channel === 'all' ? CHANNELS : [CHANNEL_BY_ID[this.channel]];
    sel.innerHTML = `<optgroup label="Channel (all units)">${chans.map((c) => `<option value="ch:${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>
      <optgroup label="Busy units">${units.map((u) => `<option value="u:${u.id}">${esc(u.callsign)}</option>`).join('')}</optgroup>
      <optgroup label="Available units">${idle.slice(0, 60).map((u) => `<option value="u:${u.id}">${esc(u.callsign)}</option>`).join('')}</optgroup>`;
    if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
    this.target = sel.value;
  }

  render() {
    const sim = this.sim; const r = this.game.settings.data.radio; const log = sim.radio.log;
    const unread = {};
    for (const m of log) if (m.id > (this.lastSeen[m.channel] || 0) && !m.dispatcher) unread[m.channel] = (unread[m.channel] || 0) + 1;
    this.q('chans').innerHTML = `<div class="chan ${this.channel === 'all' ? 'active' : ''}" data-act="chan" data-c="all"><span class="cn">All monitored</span></div>` +
      CHANNELS.map((c) => `<div class="chan ${this.channel === c.id ? 'active' : ''} ${r.monitored[c.id] === false ? 'muted' : ''}" data-act="chan" data-c="${c.id}">
        <span class="dot" style="background:${c.color}"></span><span class="cn" title="${esc(c.name)}">${esc(c.name)}</span>
        ${unread[c.id] && this.channel !== c.id ? `<span class="badge">${unread[c.id] > 99 ? '99+' : unread[c.id]}</span>` : ''}
        <button class="ico-btn" data-act="spk" data-c="${c.id}" title="${r.speakChannels[c.id] ? 'Mute voice for this channel' : 'Speak this channel aloud'}">${r.speakChannels[c.id] ? '🔊' : '🔇'}</button>
        <button class="ico-btn" data-act="mon" data-c="${c.id}" title="${r.monitored[c.id] === false ? 'Monitor channel' : 'Stop monitoring'}">${r.monitored[c.id] === false ? '◌' : '👁'}</button></div>`).join('');
    this.q('title').textContent = this.channel === 'all' ? 'All monitored channels' : CHANNEL_BY_ID[this.channel].name;
    const feed = this.q('feed');
    const msgs = log.filter((m) => (this.channel === 'all' ? r.monitored[m.channel] !== false : m.channel === this.channel));
    const key = `${this.channel}`;
    const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    const line = (m, isNew) => `<div class="rmsg ${m.dispatcher ? 'dispatch' : ''} ${m.urgent ? 'urgent' : ''} ${isNew ? 'new' : ''}"><span class="tm">${clock(m.clock, this.game)}</span>${chanTag(m.channel)}
      <span><span class="from" ${m.unit && !m.dispatcher ? `data-act="unit" data-u="${m.unit}" style="cursor:pointer"` : ''}>${esc(m.from)}</span>: ${esc(m.text)}${m.incident && sim.incidents.byId(m.incident) ? ` <a href="#" data-act="inc" data-id="${m.incident}" class="dim" style="font-size:.85em">${esc(sim.incidents.byId(m.incident).number)}</a>` : ''}</span></div>`;
    if (this.feedKey !== key) {
      this.feedKey = key;
      feed.innerHTML = msgs.slice(-200).map((m) => line(m, false)).join('') || '<div class="empty">No radio traffic yet.</div>';
      this.renderedUpTo = log.length ? log[log.length - 1].id : 0;
      feed.scrollTop = feed.scrollHeight;
    } else {
      const fresh = msgs.filter((m) => m.id > this.renderedUpTo);
      if (fresh.length) { feed.querySelector('.empty')?.remove(); feed.insertAdjacentHTML('beforeend', fresh.map((m) => line(m, true)).join('')); }
      this.renderedUpTo = log.length ? log[log.length - 1].id : 0;
      while (feed.children.length > 260) feed.firstElementChild.remove();
      if (atBottom || fresh.some((m) => m.dispatcher)) feed.scrollTop = feed.scrollHeight;
    }
    const last = log.length ? log[log.length - 1].id : 0;
    if (this.channel === 'all') { for (const c of CHANNELS) if (r.monitored[c.id] !== false) this.lastSeen[c.id] = last; } else this.lastSeen[this.channel] = last;
    this.lastSeen.all = last;
    this.cad.renderTabs();
  }

  transmit(intent) {
    const sim = this.sim; const val = this.q('target').value || 'ch:police';
    const text = intent ? '' : this.q('tx').value.trim();
    if (!intent && !text) return;
    const [kind, id] = val.split(':');
    const res = sim.radio.playerTransmit(kind === 'u' ? { unitId: id, intent, text } : { channel: id, intent, text });
    this.q('tx').value = '';
    this.game.audio?.radioOut();
    if (kind === 'ch' && !sim.units.list.some((u) => u.channel === id && u.incident)) toast('No units on that channel are assigned to incidents – pick a specific unit to get a reply.', { level: 'info' });
    return res;
  }

  async mic() {
    const sp = this.game.speech; const btn = this.root.querySelector('[data-act="mic"]'); const inp = this.q('tx');
    if (sp.listening) { sp.stopListening(); return; }
    btn.classList.add('listening');
    const okStart = await sp.listen({ onInterim: (t) => { inp.value = t; }, onFinal: (t) => { inp.value = t; this.transmit(); }, onEnd: () => btn.classList.remove('listening'), onError: (msg) => { btn.classList.remove('listening'); toast(msg, { level: 'warn' }); } });
    if (!okStart) btn.classList.remove('listening');
  }
}
