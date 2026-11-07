// Shared helpers: seeded RNG, math, string templating, HTML escaping.

/** Mulberry32 seeded PRNG. State is a plain number so it can be saved. */
export class RNG {
  constructor(seed = Date.now() >>> 0) { this.state = seed >>> 0; }
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.float(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  pickN(arr, n) {
    const copy = arr.slice(); const out = [];
    while (copy.length && out.length < n) out.push(copy.splice(Math.floor(this.next() * copy.length), 1)[0]);
    return out;
  }
  weighted(items, weightFn) {
    let total = 0; const ws = items.map((it) => { const w = Math.max(0, weightFn(it)); total += w; return w; });
    if (total <= 0) return items[0];
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}

/** Global non-deterministic RNG for cosmetic stuff. */
export const rng = new RNG((Math.random() * 2 ** 32) >>> 0);

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const uid = (() => { let n = 0; return (p = 'id') => `${p}_${Date.now().toString(36)}_${(n++).toString(36)}`; })();

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Fill {placeholders} from an object; supports dotted paths and {a|b|c} inline random choices. */
export function fill(template, ctx, r = rng) {
  if (Array.isArray(template)) template = r.pick(template);
  if (typeof template === 'function') template = template(ctx, r);
  return String(template).replace(/\{([^{}]+)\}/g, (m, key) => {
    if (key.includes('|')) {
      // {var|fallback|fallback}: use the variable when present, otherwise a random fallback.
      const opts = key.split('|');
      if (/^[a-zA-Z_][\w.]*$/.test(opts[0]) && ctx && opts[0] in ctx) {
        const v = ctx[opts[0]];
        return v != null && v !== '' ? String(v) : r.pick(opts.slice(1));
      }
      return r.pick(opts);
    }
    const val = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
    return val == null ? '' : String(val);
  }).replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
}

export function capitalize(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

export function fmtClock(minutesOfDay, withSeconds = false) {
  const total = ((minutesOfDay % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60); const m = Math.floor(total % 60);
  const s = Math.floor((total * 60) % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
}

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export function deepClone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

export function deepMerge(target, src) {
  for (const k of Object.keys(src || {})) {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) deepMerge(target[k], v);
    else target[k] = v;
  }
  return target;
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = new Array(b.length + 1); let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

export function throttleRAF(fn) {
  let queued = false;
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(f, 16);
  return (...args) => { if (queued) return; queued = true; raf(() => { queued = false; fn(...args); }); };
}

export function oxford(list) {
  if (list.length <= 1) return list.join('');
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
}
