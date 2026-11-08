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

const TRANSITIONS = {
  clear: [['clear', 6], ['rain', 2], ['fog', 1], ['thunderstorm', 0.6], ['snow', 0.5]],
  rain: [['rain', 4], ['clear', 3], ['thunderstorm', 1.5], ['fog', 1]],
  thunderstorm: [['thunderstorm', 3], ['rain', 3], ['severe', 0.8], ['clear', 1]],
  snow: [['snow', 5], ['clear', 2], ['fog', 1]],
  fog: [['fog', 3], ['clear', 4], ['rain', 1]],
  severe: [['severe', 2], ['thunderstorm', 3], ['rain', 1.5]],
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
    this.sim.state.weather = { current: start, since: 0, nextChangeAt: this.sim.rng.float(420, 900), intensity: 1 };
    this.apply();
  }

  apply() { this.sim.router.weatherFactor = this.info().travel; }

  set(type, announce = true) {
    if (!WEATHER_TYPES[type] || type === this.w.current) return;
    const prev = this.w.current; this.w.current = type; this.w.since = this.sim.t;
    this.apply();
    bus.emit('weather:changed', { prev, current: type });
    if (announce) {
      this.sim.notify(`Weather update: ${WEATHER_TYPES[type].label}`, 'info');
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
      const opts = TRANSITIONS[this.w.current] || TRANSITIONS.clear;
      const next = sim.rng.weighted(opts, (o) => o[1])[0];
      // snow only when it makes sense (avoid snow↔thunder jumps)
      this.set(next);
      this.w.nextChangeAt = sim.t + sim.rng.float(480, 1100);
      if ((next === 'thunderstorm' || next === 'severe') && sim.rng.chance(0.4)) sim.cityEvents?.start('power_outage');
    }
  }
}
