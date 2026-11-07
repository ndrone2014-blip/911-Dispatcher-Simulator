// Tiny publish/subscribe bus that every system uses to talk to each other.
export class EventBus {
  constructor() { this.handlers = new Map(); }
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.off(type, fn);
  }
  once(type, fn) { const off = this.on(type, (p) => { off(); fn(p); }); return off; }
  off(type, fn) { this.handlers.get(type)?.delete(fn); }
  emit(type, payload) {
    const set = this.handlers.get(type);
    if (set) for (const fn of [...set]) { try { fn(payload); } catch (e) { console.error(`[bus] ${type} handler failed`, e); } }
    const any = this.handlers.get('*');
    if (any) for (const fn of [...any]) { try { fn({ type, payload }); } catch (e) { console.error(e); } }
  }
  clear() { this.handlers.clear(); }
}

export const bus = new EventBus();
