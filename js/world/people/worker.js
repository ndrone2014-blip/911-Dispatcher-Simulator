// Builds character meshes off the main thread so walking into a crowded room never hitches.
import { buildCharacter } from './charGen.js';

self.onmessage = (e) => {
  const { id, app, q, dscale } = e.data;
  try {
    const r = buildCharacter(app, q, dscale);
    self.postMessage({ id, ok: true, geo: r.geo, anchors: r.anchors, gear: r.gear }, [r.geo.data, r.geo.indices.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
