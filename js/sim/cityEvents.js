// Dynamic city events: road closures, power outages, public events, congestion,
// infrastructure problems. They affect routing, call mix and the news ticker.
import { city, TOWNS, addressFor } from '../data/city.js';
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
    kind = kind || r.weighted(Object.keys(EVENT_KINDS), (k) => ({ road_closure: 3, power_outage: 1.2, public_event: 1.4, traffic_congestion: 1.2, infrastructure: 1 }[k]));
    const town = r.weighted(TOWNS, (t) => (t.id === 'carmi' ? 0.55 : t.weight + 0.02));
    const district = town.name;
    let x = town.x + r.float(-0.6, 0.6) * (town.x1 - town.x0), y = town.y + r.float(-0.6, 0.6) * (town.y1 - town.y0);
    const e = { id: `ev_${Math.floor(sim.t)}_${r.int(100, 999)}`, kind, district, x, y, radius: Math.max(260, (town.x1 - town.x0) * 0.8), edges: [], startedAt: sim.t, endsAt: sim.t + r.float(360, 900) };
    switch (kind) {
      case 'road_closure': {
        // sometimes a rural highway, sometimes a town street
        let edges;
        if (r.chance(0.4)) { const rural = city.edges.filter((ed) => !ed.town && !ed.outside && ['state', 'county', 'us', 'township'].includes(ed.kind)); const ed = r.pick(rural); edges = [ed]; const A = city.nodes[ed.a], Bn = city.nodes[ed.b]; e.x = (A.x + Bn.x) / 2; e.y = (A.y + Bn.y) / 2; e.district = 'Rural White County'; }
        else edges = sim.router.edgesNear(x, y, 70).filter((ed) => ed.town === town.id).slice(0, 2);
        if (!edges.length) edges = sim.router.edgesNear(x, y, 200).slice(0, 1);
        e.edges = edges.map((ed) => ed.id); e.radius = 120;
        const a = addressFor(e.x, e.y); e.street = edges[0]?.name || a.street;
        e.title = `${e.street} closed${e.district === 'Rural White County' ? ` (${a.rel || 'rural'})` : ` in ${district}`}`;
        e.desc = r.pick(['Emergency utility work', 'Road construction', 'Bridge repair', 'Downed tree removal', 'Crash cleanup', 'Flooded low spot', 'Oil field equipment move']) + ` – ${e.street} closed${a.rel ? `, ${a.rel}` : ''}.`;
        for (const id of e.edges) sim.router.closed.add(id);
        break;
      }
      case 'power_outage':
        e.title = `Power outage – ${district}`; e.desc = `The electric co-op reports about ${r.int(150, district === 'Carmi' ? 2400 : 600)} customers without power in and around ${district}.`; break;
      case 'public_event': {
        const opts = [['White County Fairgrounds', 'Carmi'], ['the courthouse square', 'Carmi'], ['Bicentennial Park', 'Carmi'], ['Grayville Riverfront Park', 'Grayville'], ['Southern Prairie High School', 'Norris City'], ['Crossville Community Park', 'Crossville']];
        const [venue, at] = r.pick(opts);
        const what = r.pick(['a Friday night football game', 'the Thanksgiving parade', 'a tractor pull', 'a holiday craft fair', 'a charity 5K run', 'a fall festival', 'a community Thanksgiving dinner']);
        e.district = at; e.title = `${what.replace(/^(a|the) /, '').replace(/^\w/, (c) => c.toUpperCase())} – ${venue}`; e.desc = `Large crowds expected for ${what} at ${venue} in ${at}.`; e.venue = venue;
        const vt = TOWNS.find((t) => t.name === at); e.x = vt.x; e.y = vt.y;
        sim.router.slow.set(at, 0.75);
        break;
      }
      case 'traffic_congestion':
        e.title = `Heavy traffic in ${district}`; e.desc = r.pick(['Harvest equipment and grain trucks', 'A slow-moving wide load', 'Holiday travelers', 'A train blocking crossings']) + ` causing delays in ${district}.`;
        sim.router.slow.set(district, 0.6); break;
      case 'infrastructure': {
        const edges = sim.router.edgesNear(x, y, 90).filter((ed) => ed.town === town.id).slice(0, 1);
        e.edges = edges.map((ed) => ed.id); e.radius = 140;
        for (const id of e.edges) sim.router.closed.add(id);
        e.title = r.pick(['Water main break', 'Gas line repair', 'Culvert collapse', 'Railroad crossing failure']) + ` – ${district}`;
        e.desc = `${e.title}. Crews on scene${edges[0] ? ` on ${edges[0].name}` : ''}.`; break;
      }
      default: break;
    }
    this.list.push(e);
    sim.notify(`County event: ${e.title}`, 'info', { event: e.id });
    sim.radio.push({ channel: kind === 'public_event' ? 'police' : 'services', from: kind === 'public_event' ? 'Dispatch' : kind === 'power_outage' ? 'Electric Co-op' : 'County Highway', text: `Be advised: ${e.desc}`, kind: 'event' });
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


