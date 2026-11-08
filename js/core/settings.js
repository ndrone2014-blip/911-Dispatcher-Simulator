// Player settings with sensible defaults; persisted inside the save profile.
import { bus } from './events.js';
import { deepMerge, deepClone, isTouchDevice } from './util.js';

export const DEFAULT_SETTINGS = {
  graphics: { preset: 'auto', adaptive: true, fpsCounter: false, fov: 72, monitorRefresh: 1 },
  audio: {
    master: 0.85, game: 0.7, caller: 1, radio: 0.75, ambience: 0.45, notifications: 0.7,
    muted: { game: false, caller: false, radio: false, ambience: false, notifications: false },
  },
  speech: { tts: true, radioTTS: true, staffTTS: true, recognition: true, lang: 'en-US', autoSend: true, handsFree: false, naturalPacing: true, rate: 1 },
  controls: { mouseSensitivity: 1, invertY: false, touchSensitivity: 1, headBob: true },
  map: { theme: 'day' },
  ui: { textScale: 1, toasts: true, toastCalls: true, toastRadio: true, toastIncidents: true, compactCad: false, showHints: true, clock24: true, seasonal: 'auto' },
  radio: { muted: {}, monitored: { police: true, sheriff: true, specops: true, investigations: true, federal: true, fire: true, ems: true, em: true, services: true }, speakChannels: { police: true, fire: true, ems: true, sheriff: true, specops: true, investigations: false, federal: false, em: true, services: false } },
  llm: { enabled: false, kind: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3.2' },
};

export class Settings {
  constructor(saved) {
    this.data = deepMerge(deepClone(DEFAULT_SETTINGS), saved || {});
    if (this.data.graphics.preset === 'auto') this.data.graphics.resolved = Settings.detectPreset();
  }
  get(path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this.data); }
  set(path, value) {
    const keys = path.split('.'); let o = this.data;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] ??= {};
    o[keys[keys.length - 1]] = value;
    if (path === 'graphics.preset') this.data.graphics.resolved = value === 'auto' ? Settings.detectPreset() : value;
    bus.emit('settings:changed', { path, value, settings: this });
  }
  graphicsPreset() { return this.data.graphics.preset === 'auto' ? (this.data.graphics.resolved || Settings.detectPreset()) : this.data.graphics.preset; }
  volume(cat) {
    const a = this.data.audio; if (a.muted[cat]) return 0;
    return (a.master ?? 1) * (a[cat] ?? 1);
  }

  static detectPreset() {
    if (typeof window === 'undefined') return 'medium';
    const mem = navigator.deviceMemory || 4; const cores = navigator.hardwareConcurrency || 4;
    const mobile = isTouchDevice() && Math.min(screen.width, screen.height) < 820;
    let gpu = '';
    try {
      const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase() : '';
    } catch { /* ignore */ }
    if (/swiftshader|llvmpipe|software/.test(gpu)) return 'low';
    if (mobile) return mem >= 6 && cores >= 6 ? 'medium' : 'low';
    if (/rtx|radeon rx|geforce gtx 1[0-9]|apple m[1-9]|arc/.test(gpu) && mem >= 8) return 'high';
    return cores >= 8 && mem >= 8 ? 'high' : 'medium';
  }
}
