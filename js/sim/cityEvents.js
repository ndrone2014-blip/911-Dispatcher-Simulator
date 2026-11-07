// Dynamic city events: road closures, power outages, public events, congestion,
// infrastructure problems. They affect routing, call mix and the news ticker.
import { city, B, DISTRICTS, addressFor, EW_STREETS, NS_STREETS } from '../data/city.js';
import { bus } from '../core/events.js';

export const EVENT_KINDS = {
  road_closure: { label: 'Road Closure', icon: '⛔', color: '#ff5a4e' },
  power_outage: { label: 'Power Outage', icon: '⚡', color: '#f2c94c' },
  public_event: { label: 'Public Event', icon: '🎉', color: '#b47cff' },
  traffic_congestion: { label: 'Traffic Congestion', icon: '🚗', color: '#ffb84d' },
  infrastructure: { label: 'Infrastructure Problem', icon: '🛠', color: '#7fd1d9' },
};

// Templates boosted while an event is active.
export const EVENT_SCENARIO_BOOST = {
  power_outage: ['signal_out', 'elevator', 'alarm_com', 'alarm_res', 'power_outage', 'nonemerg_power', 'co_alarm'],
  public_event: ['crowd_arena', 'event_traffic', 'intox_person', 'disturbance_street', 'theft_bike', 'mva_fender', 'parking_hydrant'],
  traffic_congestion: ['mva_fender', 'dui_swerving', 'disabled_highway', 'mva_injury'],
  road_closure: ['mva_fender'],
  infrastructure: ['water_main', 'sinkhole'],
};

export class CityEvents {
  constructor(sim) { this.sim = sim; }
  get list() { return this.sim.state.events; }

  update() {
    const sim = this.sim;
    for (const e of this.list.slice()) if (sim.t >= e.endsAt) this.end(e);
    if (sim.config.cityEvents === false || sim.state.mode === 'training') return;
    if (sim.t >= (sim.state.nextEventAt || 0)) {
      sim.state.nextEventAt = sim.t + sim.rng.float(300, 700);
      if (this.list.length < 3 && sim.t > 60) this.start();
    }
  }

  start(kind) {
    const sim = this.sim; const r = sim.rng;
    kind = kind || r.weighted(Object.keys(EVENT_KINDS), (k) => ({ road_closure: 3, power_outage: 1.2, public_event: 1.4, traffic_congestion: 2, infrastructure: 1 }[k]));
    const district = r.pick(DISTRICTS.filter((d) => d !== 'Halston River'));
    const blocks = city.blocks.filter((b) => b.district === district);
    const blk = r.pick(blocks.length ? blocks : city.blocks);
    const x = (blk.bx + 0.5) * B, y = (blk.by + 0.5) * B;
    const e = { id: `ev_${Math.floor(sim.t)}_${r.int(100, 999)}`, kind, district, x, y, radius: B * 1.4, edges: [], startedAt: sim.t, endsAt: sim.t + r.float(360, 900) };
    const a = addressFor(x + B * 0.45, y);
    switch (kind) {
      case 'road_closure': {
        const edges = sim.router.edgesNear(x + B / 2, y, B * 0.55).slice(0, 2);
        e.edges = edges.map((ed) => ed.id); e.radius = B * 0.4;
        e.street = edges[0]?.name || a.street;
        e.title = `${e.street} closed in ${district}`;
        e.desc = r.pick(['Emergency utility work', 'Construction', 'Police activity', 'Downed tree removal', 'Crash cleanup']) + ` – ${e.street} closed near ${a.cross}.`;
        for (const id of e.edges) sim.router.closed.add(id);
        break;
      }
      case 'power_outage':
        e.title = `Power outage – ${district}`; e.desc = `Halston Power & Light reports roughly ${r.int(800, 6500)} customers without power in ${district}.`; break;
      case 'public_event': {
        const venue = r.pick(['Ridgeview Arena', 'Ridgeview Central Park', 'Lakeview Park', 'City Hall plaza']);
        const what = r.pick(['a sold-out hockey game', 'a downtown parade', 'a concert', 'a food truck festival', 'a charity 5K run']);
        e.title = `${what.replace(/^a /, '').replace(/^\w/, (c) => c.toUpperCase())} at ${venue}`; e.desc = `Large crowds expected for ${what} at ${venue}.`; e.venue = venue;
        sim.router.slow.set(district, 0.75);
        break;
      }
      case 'traffic_congestion':
        e.title = `Heavy traffic in ${district}`; e.desc = `Major congestion in ${district}; expect slower response times.`;
        sim.router.slow.set(district, 0.6); break;
      case 'infrastructure': {
        const edges = sim.router.edgesNear(x, y + B / 2, B * 0.55).slice(0, 1);
        e.edges = edges.map((ed) => ed.id); e.radius = B * 0.5;
        for (const id of e.edges) sim.router.closed.add(id);
        e.title = r.pick(['Water main break', 'Gas main repair', 'Bridge inspection', 'Signal system failure']) + ` – ${district}`;
        e.desc = `${e.title}. Crews on scene, lanes affected near ${a.street} and ${a.cross}.`; break;
      }
      default: break;
    }
    this.list.push(e);
    sim.notify(`City event: ${e.title}`, 'info', { event: e.id });
    sim.radio.push({ channel: kind === 'power_outage' ? 'services' : kind === 'public_event' ? 'police' : 'services', from: kind === 'public_event' ? 'Dispatch' : 'DOT Traffic Ops', text: `Be advised: ${e.desc}`, kind: 'event' });
    bus.emit('cityevent:started', { event: e });
    return e;
  }

  end(e) {
    const sim = this.sim;
    for (const id of e.edges || []) sim.router.closed.delete(id);
    if (e.kind === 'public_event' || e.kind === 'traffic_congestion') sim.router.slow.delete(e.district);
    this.list.splice(this.list.indexOf(e), 1);
    sim.notify(`Resolved: ${e.title}`, 'info');
    bus.emit('cityevent:ended', { event: e });
  }

  /** Re-apply routing effects after a load. */
  restore() {
    for (const e of this.list) {
      for (const id of e.edges || []) this.sim.router.closed.add(id);
      if (e.kind === 'public_event') this.sim.router.slow.set(e.district, 0.75);
      if (e.kind === 'traffic_congestion') this.sim.router.slow.set(e.district, 0.6);
    }
  }
}

export { EW_STREETS, NS_STREETS };
