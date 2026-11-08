// Procedural audio via Web Audio – no sound files required.
// Categories: game, caller, radio, ambience, notifications (each with its own gain).
import { bus } from '../core/events.js';

export class AudioSystem {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.gains = {}; this.ambience = {}; this.ringTimer = null; this.ringLevel = 1;
    bus.on('settings:changed', ({ path }) => { if (path.startsWith('audio')) this.applyVolumes(); });
  }

  /** Must be called from a user gesture (browsers block autoplay). */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    for (const cat of ['game', 'caller', 'radio', 'ambience', 'notifications']) { const g = this.ctx.createGain(); g.connect(this.master); this.gains[cat] = g; }
    this.noiseBuf = this.makeNoise(2, 'white'); this.brownBuf = this.makeNoise(4, 'brown'); this.pinkBuf = this.makeNoise(4, 'pink');
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const a = this.settings.data.audio;
    this.master.gain.value = a.master;
    for (const cat of Object.keys(this.gains)) this.gains[cat].gain.value = a.muted[cat] ? 0 : (a[cat] ?? 1);
  }

  makeNoise(seconds, color) {
    const len = this.ctx.sampleRate * seconds; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (color === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.5; }
      else d[i] = w;
    }
    return buf;
  }

  tone(freq, start, dur, { type = 'sine', gain = 0.2, cat = 'game', attack = 0.005, release = 0.05, freqEnd } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + start;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); g.connect(this.gains[cat]); o.start(t0); o.stop(t0 + dur + 0.02);
  }

  noise(start, dur, { gain = 0.2, cat = 'game', type = 'bandpass', freq = 1500, q = 1, buf, attack = 0.005, release = 0.05 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + start;
    const src = this.ctx.createBufferSource(); src.buffer = buf || this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.gains[cat]);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.05);
  }

  // ---- Sounds ----
  click() { this.noise(0, 0.025, { gain: 0.12, freq: 3200, q: 2 }); }
  typing(n = 5) { for (let i = 0; i < n; i++) this.noise(i * (0.07 + Math.random() * 0.05), 0.02, { gain: 0.07 + Math.random() * 0.04, freq: 2400 + Math.random() * 1500, q: 3 }); }
  footstep() { this.noise(0, 0.09, { gain: 0.07, type: 'lowpass', freq: 380, buf: this.brownBuf }); }

  ringOnce() {
    const lv = this.ringLevel;
    for (let i = 0; i < 14; i++) this.tone(i % 2 ? 1160 : 950, i * 0.065, 0.06, { type: 'square', gain: 0.045 * lv, cat: 'notifications', release: 0.01 });
    for (let i = 0; i < 14; i++) this.tone(i % 2 ? 1160 : 950, 1.2 + i * 0.065, 0.06, { type: 'square', gain: 0.045 * lv, cat: 'notifications', release: 0.01 });
  }
  startRing() { if (this.ringTimer || !this.ctx) return; this.ringOnce(); this.ringTimer = setInterval(() => this.ringOnce(), 3200); }
  stopRing() { clearInterval(this.ringTimer); this.ringTimer = null; }
  setRingLevel(v) { this.ringLevel = v; }

  radioIn(urgent = false) {
    this.noise(0, 0.11, { gain: 0.12, freq: 1800, q: 0.7, cat: 'radio' });
    this.tone(urgent ? 1250 : 1000, 0.1, 0.07, { type: 'sine', gain: 0.08, cat: 'radio' });
  }
  radioOut() { this.noise(0, 0.16, { gain: 0.1, freq: 2200, q: 0.5, cat: 'radio', release: 0.12 }); }
  alertTones(priority = 2) {
    if (priority === 1) { for (let i = 0; i < 6; i++) this.tone(i % 2 ? 960 : 853, i * 0.22, 0.2, { type: 'sine', gain: 0.1, cat: 'radio' }); }
    else { this.tone(1050, 0, 0.25, { gain: 0.08, cat: 'radio' }); this.tone(1050, 0.32, 0.25, { gain: 0.08, cat: 'radio' }); }
  }
  notify(level = 'info') {
    if (level === 'alert') { this.tone(880, 0, 0.12, { gain: 0.1, cat: 'notifications' }); this.tone(1320, 0.12, 0.18, { gain: 0.1, cat: 'notifications' }); this.tone(880, 0.32, 0.12, { gain: 0.1, cat: 'notifications' }); }
    else if (level === 'request' || level === 'warn') { this.tone(740, 0, 0.12, { gain: 0.08, cat: 'notifications' }); this.tone(988, 0.13, 0.16, { gain: 0.08, cat: 'notifications' }); }
    else this.tone(1175, 0, 0.14, { gain: 0.05, cat: 'notifications', freqEnd: 1568 });
  }
  pa() { this.tone(784, 0, 0.5, { gain: 0.08, cat: 'game', release: 0.3 }); this.tone(622, 0.5, 0.8, { gain: 0.08, cat: 'game', release: 0.5 }); }
  thunder(delay = 0) {
    this.noise(delay, 2.8 + Math.random() * 1.5, { gain: 0.35, type: 'lowpass', freq: 160 + Math.random() * 120, buf: this.brownBuf, attack: 0.08, release: 2.2, cat: 'ambience' });
  }
  coffee() { this.noise(0, 2.2, { gain: 0.08, type: 'bandpass', freq: 900, q: 0.6, attack: 0.3, release: 0.6 }); this.tone(220, 0.1, 1.8, { type: 'sawtooth', gain: 0.01 }); }
  vend() { this.tone(180, 0, 0.4, { type: 'square', gain: 0.03 }); this.noise(0.5, 0.3, { gain: 0.15, type: 'lowpass', freq: 500, buf: this.brownBuf }); }
  door() { this.noise(0, 0.25, { gain: 0.08, type: 'lowpass', freq: 600, buf: this.brownBuf }); }

  // ---- Ambience loops ----
  loop(name, buf, { type = 'lowpass', freq = 400, q = 0.7, gain = 0.1, lfo = 0 } = {}) {
    if (!this.ctx || this.ambience[name]) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.gains.ambience); src.start();
    let osc = null;
    if (lfo) { osc = this.ctx.createOscillator(); const lg = this.ctx.createGain(); osc.frequency.value = lfo; lg.gain.value = gain * 0.5; osc.connect(lg); lg.connect(g.gain); osc.start(); }
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + 2);
    this.ambience[name] = { src, g, osc, target: gain };
  }
  setLoop(name, gain) { const a = this.ambience[name]; if (a && this.ctx) { a.g.gain.cancelScheduledValues(this.ctx.currentTime); a.g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + 1.5); a.target = gain; } }

  startAmbience() {
    if (!this.ctx) return;
    this.loop('hvac', this.brownBuf, { freq: 220, gain: 0.18 });
    this.loop('murmur', this.pinkBuf, { type: 'bandpass', freq: 520, q: 1.4, gain: 0.05, lfo: 0.13 });
    this.loop('rain', this.noiseBuf, { type: 'highpass', freq: 1400, gain: 0 });
    this.loop('wind', this.brownBuf, { type: 'bandpass', freq: 300, q: 0.8, gain: 0, lfo: 0.07 });
  }

  setWeather(type) {
    const rain = { rain: 0.06, thunderstorm: 0.1, severe: 0.13, snow: 0 }[type] || 0;
    const wind = { thunderstorm: 0.1, severe: 0.22, snow: 0.07, fog: 0.02 }[type] || 0;
    this.setLoop('rain', rain); this.setLoop('wind', wind);
  }
}
