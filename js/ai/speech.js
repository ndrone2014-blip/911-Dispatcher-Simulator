// Browser-native speech: SpeechRecognition (where supported) and speechSynthesis.
// Everything degrades gracefully – the game is fully playable by typing/clicking.
//
// Making browser voices sound less robotic, with no paid services:
//  • Voice ranking – the browser's best voices are preferred ("Natural"/neural voices in Edge,
//    Google voices in Chrome, Siri/Enhanced/Premium voices on Apple devices). Old robotic
//    engines (eSpeak, legacy "Desktop" voices) are only used when nothing else exists.
//  • Each character keeps the same voice, plus their own pitch/speed "fingerprint".
//  • Text is cleaned for speaking (St → Street, IL-14 → Illinois 14, 911 → nine-one-one …).
//  • Long lines are split into sentences with natural pauses, small rate changes per
//    sentence, and slightly longer pauses after hesitations ("um…", "uh,").
import { bus } from '../core/events.js';

const FEMALE = /(female|woman|samantha|victoria|karen|zira|susan|moira|tessa|fiona|veena|allison|ava|serena|kate|hazel|libby|sonia|aria|jenny|michelle|emma|olivia|nicky|joanna|salli|kimberly|ivy|kendra|catherine|ana\b|clara|natasha|nancy|sara|jane|elizabeth|ashley|cora|monica|amber|aubrey|nova|shimmer|google us english$|google uk english female|zoe|evelyn|grace)/i;
const MALE = /(male|\bman\b|daniel|alex\b|david|mark|fred|rishi|aaron|arthur|gordon|oliver|tom\b|james|guy|ryan|eric|christopher|roger|steffan|brian|matthew|joey|justin|andrew|brandon|davis|jason|tony|william|liam|noah|nathan|evan|google uk english male|reed|rocko|eddy|grandpa)/i;
// novelty voices that would wreck immersion
const SILLY = /(bells|bad news|bahh|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|albert|bubbles|junior|ralph|kathy|princess|fred)/i;

function hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** How natural a voice usually sounds (higher is better). */
export function voiceQuality(v) {
  const n = v.name || '';
  let q = 0;
  if (/natural|neural/i.test(n)) q += 6;               // Edge "Microsoft Aria Online (Natural)" etc.
  if (/online/i.test(n)) q += 2;
  if (/premium|enhanced|siri/i.test(n)) q += 5;        // Apple downloadable voices
  if (/^google/i.test(n)) q += 4;                      // Chrome network voices
  if (/samantha|ava|allison|tom|alex\b|daniel/i.test(n)) q += 2;
  if (!v.localService) q += 1;
  if (/desktop|espeak|mbrola|pico|festival/i.test(n)) q -= 4;
  if (SILLY.test(n)) q -= 20;
  if (/^en[-_]us/i.test(v.lang)) q += 1;
  return q;
}

const ABBR = [
  [/\bSt\b\.?/g, 'Street'], [/\bRd\b\.?/g, 'Road'], [/\bAve\b\.?/g, 'Avenue'], [/\bDr\b\.?(?=\s+[a-z]|$)/g, 'Drive'], [/\bBlvd\b\.?/g, 'Boulevard'], [/\bLn\b\.?/g, 'Lane'],
  [/\bHwy\b\.?/g, 'Highway'], [/\bApt\b\.?/g, 'apartment'], [/\bTwp\b\.?/g, 'Township'], [/\bCo\b\.(?=\s)/g, 'County'],
  [/\bCR (\d{3,4}) ([NSEW])\b/g, (m, a, d) => `County Road ${a} ${{ N: 'North', S: 'South', E: 'East', W: 'West' }[d]}`],
  [/\bCounty Road (\d{3,4}) ([NSEW])\b/g, (m, a, d) => `County Road ${a} ${{ N: 'North', S: 'South', E: 'East', W: 'West' }[d]}`],
  [/\bI-(\d+)/g, 'Interstate $1'], [/\bUS-(\d+)/g, 'U.S. $1'], [/\bIL-(\d+)/g, 'Illinois $1'], [/\bMM (\d+)/g, 'mile marker $1'],
  [/\b(\d+) ([NSEW]) ([A-Z])/g, (m, a, d, c) => `${a} ${{ N: 'North', S: 'South', E: 'East', W: 'West' }[d]} ${c}`],
  [/\b911\b/g, 'nine-one-one'], [/\bEMS\b/g, 'E M S'], [/\bETA\b/g, 'E T A'], [/\bCPR\b/g, 'C P R'], [/\bAED\b/g, 'A E D'], [/\bPD\b/g, 'P D'], [/\bFD\b/g, 'F D'],
  [/\bmph\b/gi, 'miles an hour'], [/&/g, ' and '], [/\bw\//g, 'with '], [/\s+[–—-]\s+/g, ', '], [/\.\.\.|…/g, '…'],
];
export function speakable(text) {
  let t = String(text).replace(/\*[^*]+\*/g, '').replace(/\([^)]*\)/g, (m) => (m.length > 40 ? '' : m.slice(1, -1)));
  for (const [re, rep] of ABBR) t = t.replace(re, rep);
  return t.replace(/\s{2,}/g, ' ').trim();
}

/** Split into phrases with the pause (ms) to leave after each. */
export function phrases(text) {
  const out = [];
  const parts = text.split(/(?<=[.!?…])\s+/);
  for (const p of parts) {
    if (!p.trim()) continue;
    const hes = /^(um+|uh+|er+|oh|okay|ok|well|hello\?*)[,.…]?\s/i.test(p);
    const end = p.trim().slice(-1);
    const pause = end === '?' ? 260 : end === '!' ? 200 : end === '…' ? 420 : 170;
    out.push({ text: p.trim(), pause: pause + (hes ? 120 : 0) });
  }
  return out.length ? out : [{ text, pause: 150 }];
}

export class Speech {
  constructor(settings) {
    this.settings = settings;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = []; this.ranked = [];
    this.queue = []; this.speaking = null; this.paused = false;
    this.Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    this.rec = null; this.listening = false; this.micState = 'unknown'; // unknown | available | denied | unavailable
    if (this.synth) {
      const load = () => {
        const all = this.synth.getVoices();
        this.voices = all.filter((v) => /^en/i.test(v.lang) && !SILLY.test(v.name)); if (!this.voices.length) this.voices = all;
        this.ranked = this.voices.map((v) => ({ v, q: voiceQuality(v) })).sort((a, b) => b.q - a.q);
      };
      load(); this.synth.onvoiceschanged = load;
      // Chrome stops long utterances after ~15 s unless nudged; keep it alive while speaking.
      this.keepAlive = setInterval(() => { try { if (this.synth.speaking && !this.synth.paused && /chrome/i.test(navigator.userAgent) && !/edg/i.test(navigator.userAgent)) { this.synth.pause(); this.synth.resume(); } } catch { /* ignore */ } }, 10000);
    }
  }

  get ttsSupported() { return !!this.synth; }
  get recognitionSupported() { return !!this.Recognition; }

  /** The best voices this browser offers (for the settings screen). */
  bestVoices(n = 4) { return this.ranked.slice(0, n).map((r) => r.v.name); }
  naturalAvailable() { return this.ranked.some((r) => r.q >= 4); }

  pickVoice(key, sex) {
    if (!this.voices.length) return null;
    const pref = this.settings.data.speech.voice;
    if (pref && pref !== 'auto' && key === 'pa') { const v = this.voices.find((x) => x.name === pref); if (v) return v; }
    const re = sex === 'f' ? FEMALE : sex === 'm' ? MALE : null;
    const fits = (v) => !re || (re.test(v.name) && !(sex === 'f' && MALE.test(v.name) && !FEMALE.test(v.name)) && !(sex === 'm' && FEMALE.test(v.name) && !MALE.test(v.name)));
    let pool = this.ranked.filter((r) => fits(r.v));
    if (!pool.length) pool = this.ranked;
    // use the best quality tier available (within 2 points of the top), so callers vary between good voices only
    const top = pool[0].q; const tier = pool.filter((r) => r.q >= top - 2);
    return tier[hash(key) % tier.length].v;
  }

  /** Per-character fingerprint so two callers sharing a voice still sound different. */
  fingerprint(key) {
    const h = hash(`fp:${key}`);
    return { pitch: 0.94 + ((h % 1000) / 1000) * 0.12, rate: 0.96 + (((h >> 10) % 1000) / 1000) * 0.08 };
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
    const clean = speakable(text);
    if (!clean) return;
    const fp = this.fingerprint(opts.key || clean);
    const item = { text: clean, parts: s.naturalPacing === false ? [{ text: clean, pause: 120 }] : phrases(clean), opts: { ...opts, category: cat, volume: vol, pitch: (opts.pitch ?? 1) * fp.pitch, rate: (opts.rate ?? 1) * fp.rate * (s.rate || 1) } };
    if (cat !== 'radio') {
      // drop pending radio lines and interrupt radio currently speaking
      this.queue = this.queue.filter((q) => q.opts.category !== 'radio');
      if (this.speaking?.opts.category === 'radio') { this.cancelCurrent(); }
      this.queue.unshift(item);
    } else {
      if (this.queue.filter((q) => q.opts.category === 'radio').length > 2) return; // don't let radio pile up
      this.queue.push(item);
    }
    this.pump();
  }

  cancelCurrent() { const it = this.speaking; this.speaking = null; if (it) it.cancelled = true; try { this.synth.cancel(); } catch { /* ignore */ } }

  pump() {
    if (!this.synth || this.speaking || this.paused || !this.queue.length) return;
    const item = this.queue.shift();
    this.speaking = item; item.i = 0;
    bus.emit('speech:start', item);
    this.sayPart(item);
  }

  sayPart(item) {
    if (this.speaking !== item || item.cancelled) return;
    if (item.i >= item.parts.length) { this.speaking = null; bus.emit('speech:end', item); setTimeout(() => this.pump(), 140); return; }
    const part = item.parts[item.i];
    const u = new SpeechSynthesisUtterance(part.text);
    const v = this.pickVoice(item.opts.key || item.text, item.opts.sex);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = this.settings.data.speech.lang || 'en-US';
    // a touch of variation per sentence: questions lift, exclamations speed up, hesitations slow down
    const end = part.text.slice(-1); const hes = /^(um|uh|er|oh|well)/i.test(part.text);
    const jitter = ((hash(part.text) % 100) / 100 - 0.5) * 0.04;
    u.pitch = Math.max(0.1, Math.min(2, (item.opts.pitch ?? 1) * (end === '?' ? 1.04 : 1)));
    u.rate = Math.max(0.5, Math.min(1.8, (item.opts.rate ?? 1) * (end === '!' ? 1.04 : 1) * (hes ? 0.93 : 1) + jitter));
    u.volume = Math.max(0, Math.min(1, item.opts.volume ?? 1));
    let finished = false;
    const next = () => { if (finished) return; finished = true; item.i++; setTimeout(() => this.sayPart(item), part.pause); };
    u.onend = next; u.onerror = next;
    setTimeout(next, Math.min(16000, 1400 + part.text.length * 90)); // safety: some browsers never fire onend
    try { this.synth.speak(u); } catch { next(); }
  }

  /** Stop talking while the player uses the microphone so the game never hears itself. */
  pause(on) {
    this.paused = on;
    if (on && this.speaking) { const it = this.speaking; this.cancelCurrent(); if (it.opts.category !== 'radio') { it.parts = it.parts.slice(it.i); it.cancelled = false; this.queue.unshift(it); } }
    if (!on) this.pump();
  }

  stopAll() { this.queue = []; this.cancelCurrent(); }

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

  /**
   * Start listening. handlers: { onInterim(text), onFinal(text, alternatives), onEnd(), onError(msg), choose(alts) }
   * The caller TTS pauses while the mic is open. Silence ends the phrase; "no speech" is not an error
   * worth shouting about, and network hiccups retry once automatically.
   */
  async listen(handlers = {}) {
    if (!this.Recognition) { handlers.onError?.('Speech recognition is not supported in this browser. Try Chrome, Edge or Safari, or type instead.'); return false; }
    if (this.listening) return true;
    if (this.micState !== 'available') { const okPerm = await this.requestPermission(); if (!okPerm) { handlers.onError?.('Microphone permission was denied. You can still type or use suggested questions.'); return false; } }
    const rec = new this.Recognition();
    rec.lang = this.settings.data.speech.lang || 'en-US';
    rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 4;
    let finalText = ''; let alts = []; let retried = false; let gotAny = false;
    this.pause(true);
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]; gotAny = true;
        if (res.isFinal) {
          const list = Array.from(res).map((a) => a.transcript.trim()).filter(Boolean);
          const pick = handlers.choose ? handlers.choose(list) : list[0];
          finalText += `${finalText ? ' ' : ''}${pick || ''}`; alts = list;
        } else interim += res[0].transcript;
      }
      if (interim || finalText) handlers.onInterim?.(`${finalText}${interim ? ` ${interim}` : ''}`.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return; // quietly end
      if (e.error === 'network' && !handlers._retried) { retried = true; return; }
      const msg = { 'not-allowed': 'Microphone permission was denied.', 'service-not-allowed': 'Speech recognition is blocked in this browser.', 'audio-capture': 'No microphone found.', network: 'Speech recognition needs a network connection in this browser (Chrome sends audio to its speech service).', 'language-not-supported': 'That recognition language is not supported here.' }[e.error] || `Speech recognition error: ${e.error}`;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.micState = 'denied';
      handlers.onError?.(msg);
    };
    rec.onend = () => {
      this.listening = false; this.rec = null;
      if (retried && !gotAny && !finalText) { handlers._retried = true; this.listen(handlers); return; }
      handlers._retried = false;
      this.pause(false);
      if (finalText.trim()) handlers.onFinal?.(finalText.trim(), alts);
      else if (!gotAny) handlers.onNothing?.();
      handlers.onEnd?.();
      bus.emit('mic:state', { listening: false });
    };
    try { rec.start(); this.rec = rec; this.listening = true; bus.emit('mic:state', { listening: true }); return true; }
    catch (e) { this.pause(false); handlers.onError?.(`Could not start the microphone: ${e.message}`); return false; }
  }

  stopListening() { try { this.rec?.stop(); } catch { /* ignore */ } }
}
