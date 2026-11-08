// Browser-native speech: SpeechRecognition (where supported) and speechSynthesis.
// Everything degrades gracefully – the game is fully playable by typing/clicking.
import { bus } from '../core/events.js';

const FEMALE = /(female|woman|samantha|victoria|karen|zira|susan|moira|tessa|fiona|veena|allison|ava|serena|kate|hazel|libby|sonia|aria|jenny|michelle|emma|olivia|nicky|joanna|salli|kimberly|ivy|kendra|catherine|google us english$|google uk english female)/i;
const MALE = /(male|\bman\b|daniel|alex|david|mark|fred|rishi|aaron|arthur|gordon|oliver|tom|james|guy|ryan|eric|christopher|roger|steffan|brian|matthew|joey|justin|google uk english male)/i;

function hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export class Speech {
  constructor(settings) {
    this.settings = settings;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.queue = []; this.speaking = null;
    this.Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    this.rec = null; this.listening = false; this.micState = 'unknown'; // unknown | available | denied | unavailable
    if (this.synth) {
      const load = () => { this.voices = this.synth.getVoices().filter((v) => /^en/i.test(v.lang)); if (!this.voices.length) this.voices = this.synth.getVoices(); };
      load(); this.synth.onvoiceschanged = load;
    }
  }

  get ttsSupported() { return !!this.synth; }
  get recognitionSupported() { return !!this.Recognition; }

  pickVoice(key, sex) {
    if (!this.voices.length) return null;
    const re = sex === 'f' ? FEMALE : sex === 'm' ? MALE : null;
    let pool = re ? this.voices.filter((v) => re.test(v.name) && !(sex === 'f' && MALE.test(v.name) && !FEMALE.test(v.name))) : this.voices;
    if (!pool.length) pool = this.voices;
    return pool[hash(key) % pool.length];
  }

  /**
   * Queue speech. opts: { key, sex, pitch, rate, category: 'caller'|'radio'|'staff', priority }
   * Caller and staff speech interrupt radio chatter.
   */
  speak(text, opts = {}) {
    if (!this.synth || !text) return;
    const cat = opts.category || 'caller';
    const s = this.settings.data.speech;
    if (!s.tts) return;
    if (cat === 'radio' && !s.radioTTS) return;
    if (cat === 'staff' && !s.staffTTS) return;
    const vol = this.settings.volume(cat === 'staff' ? 'caller' : cat);
    if (vol <= 0) return;
    const clean = String(text).replace(/\*[^*]+\*/g, '').replace(/—/g, ', ').trim();
    if (!clean) return;
    const item = { text: clean, opts: { ...opts, category: cat, volume: vol } };
    if (cat !== 'radio') {
      // drop pending radio lines and interrupt radio currently speaking
      this.queue = this.queue.filter((q) => q.opts.category !== 'radio');
      if (this.speaking?.opts.category === 'radio') this.synth.cancel();
      this.queue.unshift(item);
    } else {
      if (this.queue.filter((q) => q.opts.category === 'radio').length > 2) return; // don't let radio pile up
      this.queue.push(item);
    }
    this.pump();
  }

  pump() {
    if (!this.synth || this.speaking || !this.queue.length) return;
    const item = this.queue.shift();
    const u = new SpeechSynthesisUtterance(item.text);
    const v = this.pickVoice(item.opts.key || item.text, item.opts.sex);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = this.settings.data.speech.lang || 'en-US';
    u.pitch = Math.max(0.1, Math.min(2, item.opts.pitch ?? 1));
    u.rate = Math.max(0.5, Math.min(1.8, item.opts.rate ?? 1));
    u.volume = Math.max(0, Math.min(1, item.opts.volume ?? 1));
    this.speaking = item;
    const done = () => { if (this.speaking === item) { this.speaking = null; bus.emit('speech:end', item); setTimeout(() => this.pump(), 120); } };
    u.onend = done; u.onerror = done;
    // safety: some browsers never fire onend
    setTimeout(done, Math.min(20000, 1500 + item.text.length * 95));
    bus.emit('speech:start', item);
    try { this.synth.speak(u); } catch { done(); }
  }

  stopAll() { this.queue = []; this.speaking = null; try { this.synth?.cancel(); } catch { /* ignore */ } }

  // ---------- Microphone / recognition ----------
  async checkMicrophone() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) { this.micState = 'unavailable'; return this.micState; }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!devices.some((d) => d.kind === 'audioinput')) { this.micState = 'unavailable'; return this.micState; }
      if (navigator.permissions?.query) {
        try { const p = await navigator.permissions.query({ name: 'microphone' }); if (p.state === 'denied') { this.micState = 'denied'; return this.micState; } } catch { /* not supported */ }
      }
      this.micState = 'available';
    } catch { this.micState = 'unavailable'; }
    return this.micState;
  }

  async requestPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      this.micState = 'available'; return true;
    } catch { this.micState = 'denied'; return false; }
  }

  /** Start listening. handlers: { onInterim(text), onFinal(text), onEnd(), onError(msg) } */
  async listen(handlers = {}) {
    if (!this.Recognition) { handlers.onError?.('Speech recognition is not supported in this browser. Try Chrome or Edge, or type instead.'); return false; }
    if (this.listening) return true;
    if (this.micState !== 'available') { const okPerm = await this.requestPermission(); if (!okPerm) { handlers.onError?.('Microphone permission was denied. You can still type or use suggested questions.'); return false; } }
    const rec = new this.Recognition();
    rec.lang = this.settings.data.speech.lang || 'en-US';
    rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 3;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript; else interim += res[0].transcript;
      }
      if (interim) handlers.onInterim?.(finalText + interim);
    };
    rec.onerror = (e) => {
      const msg = { 'not-allowed': 'Microphone permission was denied.', 'no-speech': 'No speech heard – try again.', 'audio-capture': 'No microphone found.', network: 'Speech recognition needs a network connection in this browser.' }[e.error] || `Speech recognition error: ${e.error}`;
      if (e.error === 'not-allowed') this.micState = 'denied';
      handlers.onError?.(msg);
    };
    rec.onend = () => {
      this.listening = false; this.rec = null;
      if (finalText.trim()) handlers.onFinal?.(finalText.trim());
      handlers.onEnd?.();
      bus.emit('mic:state', { listening: false });
    };
    try { rec.start(); this.rec = rec; this.listening = true; bus.emit('mic:state', { listening: true }); return true; }
    catch (e) { handlers.onError?.(`Could not start the microphone: ${e.message}`); return false; }
  }

  stopListening() { try { this.rec?.stop(); } catch { /* ignore */ } }
}
