// Dynamic weather: transitions, alerts, and effects on travel and call volume.
import { bus } from '../core/events.js';

export const WEATHER_TYPES = {
  clear: { label: 'Clear', icon: '☀', travel: 1, air: 1, calls: 1 },
  rain: { label: 'Rain', icon: '🌧', travel: 0.9, air: 0.85, calls: 1.1 },
  thunderstorm: { label: 'Thunderstorms', icon: '⛈', travel: 0.85, air: 0.5, calls: 1.25 },
  snow: { label: 'Snow', icon: '❄', travel: 0.7, air: 0.6, calls: 1.2 },
  fog: { label: 'Fog', icon: '🌫', travel: 0.82, air: 0.4, calls: 1.05 },
  severe: { label: 'Severe Weather', icon: '🌪', travel: 0.72, air: 0.3, calls: 1.45 },
};

// Rain and storms pass through; clear weather is the norm. Precipitation rarely "repeats"
// itself, and each type has its own typical length (sim-seconds; ×6 at the default clock
// rate gives game minutes – rain ≈ 20–45 game minutes, storms shorter, clear spells longer).
const TRANSITIONS = {
  clear: [['clear', 5], ['rain', 1.6], ['fog', 0.8], ['thunderstorm', 0.45], ['snow', 0.4]],
  rain: [['clear', 5], ['rain', 0.7], ['fog', 1], ['thunderstorm', 0.8]],
  thunderstorm: [['rain', 2.5], ['clear', 2.5], ['thunderstorm', 0.4], ['severe', 0.5]],
  snow: [['clear', 4], ['snow', 1.2], ['fog', 1]],
  fog: [['clear', 5], ['fog', 0.8], ['rain', 0.6]],
  severe: [['thunderstorm', 3], ['rain', 1.5], ['severe', 0.2]],
};
export const DURATIONS = { clear: [700, 1500], rain: [200, 450], thunderstorm: [150, 330], severe: [90, 220], fog: [260, 600], snow: [300, 700] };
const WET = new Set(['rain', 'thunderstorm', 'severe', 'snow']);
const MAX_WET = 900; // a wet spell never runs past ~90 game minutes before it clears

const CLEARING = {
  rain: 'The rain has moved out of White County.', thunderstorm: 'The storms have moved east of the county. All warnings have expired.',
  severe: 'The Tornado Warning for White County has expired.', fog: 'The fog is lifting across the county.', snow: 'The snow has tapered off.',
};

const ALERTS = {
  thunderstorm: 'The National Weather Service has issued a Severe Thunderstorm Warning for White County.',
  severe: 'The National Weather Service has issued a Tornado Warning for White County. Take shelter now.',
  snow: 'A Winter Weather Advisory is in effect for White County. Expect slick roads.',
  fog: 'A Dense Fog Advisory is in effect. Visibility under a quarter mile.',
};

export class WeatherSystem {
  constructor(sim) { this.sim = sim; }
  get w() { return this.sim.state.weather; }
  current() { return this.w.current; }
  info() { return WEATHER_TYPES[this.w.current] || WEATHER_TYPES.clear; }
  airFactor() { return this.info().air; }
  callBoost() { return this.info().calls; }

  init() {
    const cfg = this.sim.config;
    let start = cfg.weather || 'clear';
    if (start === 'random') start = this.sim.rng.weighted(Object.keys(WEATHER_TYPES), (k) => ({ clear: 5, rain: 2, fog: 1, snow: 1, thunderstorm: 1, severe: 0.2 }[k]));
    this.sim.state.weather = { current: start, since: 0, nextChangeAt: this.duration(start), intensity: 1, wetSince: WET.has(start) ? 0 : null };
    this.apply();
  }

  apply() { this.sim.router.weatherFactor = this.info().travel; }
  duration(type) { const [a, b] = DURATIONS[type] || DURATIONS.clear; return this.sim.t + this.sim.rng.float(a, b); }

  set(type, announce = true) {
    if (!WEATHER_TYPES[type] || type === this.w.current) return;
    const prev = this.w.current; this.w.current = type; this.w.since = this.sim.t;
    if (WET.has(type)) { if (this.w.wetSince == null) this.w.wetSince = this.sim.t; } else this.w.wetSince = null;
    this.apply();
    bus.emit('weather:changed', { prev, current: type });
    if (announce) {
      this.sim.notify(`Weather update: ${WEATHER_TYPES[type].label}`, 'info');
      if (!WET.has(type) && CLEARING[prev] && type === 'clear') this.sim.radio.push({ channel: 'em', from: 'EOC', text: CLEARING[prev], kind: 'info' });
      if (ALERTS[type]) {
        this.sim.radio.push({ channel: 'em', from: 'EOC', text: ALERTS[type], kind: 'alert', urgent: type === 'severe' });
        this.sim.notify(ALERTS[type], type === 'severe' ? 'alert' : 'warn');
      }
    }
  }

  update() {
    const sim = this.sim;
    if (!sim.config.dynamicWeather) return;
    if (sim.t >= this.w.nextChangeAt) {
      let opts = TRANSITIONS[this.w.current] || TRANSITIONS.clear;
      // a long wet spell always breaks toward clear skies
      if (this.w.wetSince != null && sim.t - this.w.wetSince > MAX_WET) opts = [['clear', 1]];
      const next = sim.rng.weighted(opts, (o) => o[1])[0];
      this.set(next);
      this.w.nextChangeAt = this.duration(next);
      if ((next === 'thunderstorm' || next === 'severe') && sim.rng.chance(0.4)) sim.cityEvents?.start('power_outage');
    }
  }
}
