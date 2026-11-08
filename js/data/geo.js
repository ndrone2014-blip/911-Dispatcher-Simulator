// Real geography of White County, Illinois, and the warp that moves the game's original
// (box-shaped) map into it.
//
// The county outline below follows the real boundary: the straight Hamilton County line on
// the west, the straight Wayne/Edwards line on the north (it runs right through Grayville),
// the Wabash River (the Indiana state line) down the whole east side, the straight Gallatin
// County line on the south as far as New Haven, and then the Little Wabash River to its mouth
// on the Wabash (37°53′27″N 88°05′40″W), which is the county's southern tip.
// River courses are simplified to a few hundred metres – close enough for a dispatch map,
// but not a survey.
//
// Game coordinates are a plain projection of latitude/longitude (see GEO in city.js):
// x = east of 88.375°W, y = south of 38.270°N, 1 unit = 3.2 m.
export const GEO = { lon0: -88.375, lat0: 38.270, xPerDeg: 27400, yPerDeg: 34690 };
export const g2 = (lat, lon) => [Math.round((lon - GEO.lon0) * GEO.xPerDeg), Math.round((GEO.lat0 - lat) * GEO.yPerDeg)];

// Lines of the county (lat, lon).
const WEST_LON = -88.3715, NORTH_LAT = 38.2575, SOUTH_LAT = 37.9072;
export const NEW_HAVEN = [37.9067, -88.1286];
export const LW_MOUTH = [37.8909, -88.0945];
// The Wabash along the Illinois shore, north (Grayville) to south (mouth of the Little Wabash).
export const WABASH_GEO = [
  [NORTH_LAT, -87.9890], [38.2450, -87.9790], [38.2320, -87.9670], [38.2180, -87.9560], [38.2030, -87.9470],
  [38.1880, -87.9380], [38.1740, -87.9220], [38.1600, -87.9100], [38.1470, -87.9180], [38.1360, -87.9380],
  [38.1250, -87.9470], [38.1130, -87.9540], [38.1000, -87.9670], [38.0880, -87.9840], [38.0760, -88.0010],
  [38.0640, -88.0170], [38.0500, -88.0320], [38.0356, -88.0456], [38.0220, -88.0420], [38.0100, -88.0330],
  [38.0003, -88.0281], [37.9870, -88.0200], [37.9740, -88.0170], [37.9610, -88.0230], [37.9480, -88.0350],
  [37.9350, -88.0480], [37.9220, -88.0620], [37.9090, -88.0780], [37.8990, -88.0880], LW_MOUTH,
];
// Little Wabash from New Haven to its mouth (this stretch is the Gallatin County line).
export const LOWER_LITTLE_WABASH_GEO = [[37.9420, -88.1330], [37.9230, -88.1310], NEW_HAVEN, [37.9000, -88.1150], [37.8950, -88.1040], LW_MOUTH];

export const COUNTY_GEO = [
  [NORTH_LAT, WEST_LON],
  ...WABASH_GEO,
  ...LOWER_LITTLE_WABASH_GEO.slice(2).reverse().slice(1), // mouth → New Haven (mouth already listed)
  [SOUTH_LAT, WEST_LON],
];
export const COUNTY_POLY = COUNTY_GEO.map(([la, lo]) => g2(la, lo));
export const WABASH_PTS = WABASH_GEO.map(([la, lo]) => g2(la, lo));
export const LOWER_LW_PTS = LOWER_LITTLE_WABASH_GEO.map(([la, lo]) => g2(la, lo));
export const COUNTY_BBOX = COUNTY_POLY.reduce((b, [x, y]) => ({ x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
export const COUNTY_EDGES = { west: g2(NORTH_LAT, WEST_LON)[0], north: g2(NORTH_LAT, WEST_LON)[1], south: g2(SOUTH_LAT, WEST_LON)[1] };

// ---------------------------------------------------------------- warp
// Anchor pairs: where a place sat on the original game map → where it really is.
// Places that were already at real coordinates (Brownsville, Stokes, Roland, Epworth and the
// towns outside the county) map onto themselves, so the warp leaves them – and everything
// already drawn around them – alone.
const OLD_WABASH = [[11320, 0], [11500, 1600], [11350, 3200], [11550, 4800], [11400, 6400], [11650, 8000], [11500, 9400], [11300, 10500]];
const NEW_WABASH = [[NORTH_LAT, -87.9890], [38.2150, -87.9540], [38.1650, -87.9150], [38.1180, -87.9510], [38.0700, -88.0090], [38.0300, -88.0440], [37.9760, -88.0170], LW_MOUTH].map(([a, b]) => g2(a, b));
export const TOWN_GEO = {
  carmi: [38.0909, -88.1587], norris: [37.9812, -88.3292], grayville: [38.2520, -87.9990], crossville: [38.1617, -88.0631],
  enfield: [38.0995, -88.3384], millshoals: [38.2440, -88.3445], burntprairie: [38.2500, -88.2556], 
  phillipstown: [38.1420, -88.0217], herald: [37.9664, -88.1814], emma: [37.9747, -88.1203], maunie: [38.0356, -88.0530],
  brownsville: [38.0414, -88.2447],
};
const OLD_TOWN = { carmi: [6000, 6200], norris: [2600, 9300], grayville: [10800, 1200], crossville: [9000, 4700], enfield: [2200, 5600], millshoals: [1800, 1300], burntprairie: [3900, 2050], springerton: [2900, 3300], phillipstown: [10600, 3200], herald: [5600, 9500], emma: [8800, 8700], maunie: [10900, 8500], brownsville: [3570, 7930] };

function anchors() {
  const A = [];
  const add = (from, to) => A.push([from[0], from[1], to[0], to[1]]);
  for (const k of Object.keys(OLD_TOWN)) if (k !== 'springerton') add(OLD_TOWN[k], g2(...TOWN_GEO[k]));
  // I-64 runs just south of Burnt Prairie (exit 117) and Grayville (exit 130)
  add([2000, 2370], g2(38.2360, -88.3300)); add([4500, 2350], g2(38.2400, -88.2450)); add([7600, 2150], g2(38.2330, -88.1100)); add([10500, 1750], g2(38.2400, -88.0060));
  OLD_WABASH.forEach((p, i) => add(p, NEW_WABASH[i]));
  // the other three edges of the old box land on the real straight county lines
  const W = COUNTY_EDGES.west, N = COUNTY_EDGES.north, S = COUNTY_EDGES.south;
  add([0, 0], [W, N]); add([0, 10500], [W, S]);
  for (const k of [0.25, 0.5, 0.75]) { add([0, 10500 * k], [W, N + (S - N) * k]); add([11320 * k, 0], [W + (NEW_WABASH[0][0] - W) * k, N]); }
  add([2800, 10500], g2(SOUTH_LAT, -88.270)); add([4900, 10500], g2(SOUTH_LAT, -88.195));
  add([7800, 10500], g2(37.9230, -88.1310)); add([9800, 10300], g2(37.9010, -88.1000));
  // already real (identity)
  for (const p of [[3120, 8380], [3500, 10250], [7900, 6950]]) add(p, p); // Stokes, Roland, Epworth
  // towns around the county (McLeansboro, Fairfield, Albion, Mount Carmel, Eldorado, Ridgway, Omaha,
  // New Harmony, Mount Vernon IN, Evansville, Wayne City) and the far corners of the region map
  const OUT = [[38.0934, -88.5356], [38.3789, -88.3598], [38.3770, -88.0562], [38.4109, -87.7614], [37.8137, -88.4381], [37.7992, -88.2606], [37.8903, -88.3034], [38.1298, -87.9353], [37.9323, -87.8950], [37.9716, -87.5711], [38.3456, -88.5878]];
  for (const g of OUT) { const p = g2(...g); add(p, p); }
  for (const p of [[-9500, -7500], [24500, -7500], [-9500, 21500], [24500, 21500], [9450, 16300], [4300, 20600], [15200, 12300], [17800, -7500], [-9500, 6300], [24500, 3000]]) add(p, p);
  return A;
}

/** Thin-plate spline through the anchor pairs (exact at every anchor, smooth in between). */
function buildTPS(A) {
  const n = A.length; const N = n + 3;
  const U = (r2) => (r2 < 1e-9 ? 0 : r2 * Math.log(r2) * 0.5);
  const M = Array.from({ length: N }, () => new Float64Array(N));
  const S = 1 / 1000; // work in thousands of units for conditioning
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) { const dx = (A[i][0] - A[j][0]) * S, dy = (A[i][1] - A[j][1]) * S; M[i][j] = U(dx * dx + dy * dy); }
    M[i][n] = 1; M[i][n + 1] = A[i][0] * S; M[i][n + 2] = A[i][1] * S;
    M[n][i] = 1; M[n + 1][i] = A[i][0] * S; M[n + 2][i] = A[i][1] * S;
  }
  const solve = (rhs) => {
    const a = M.map((r) => Float64Array.from(r)); const b = Float64Array.from(rhs);
    for (let c = 0; c < N; c++) {
      let p = c; for (let r = c + 1; r < N; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      [a[c], a[p]] = [a[p], a[c]]; [b[c], b[p]] = [b[p], b[c]];
      const d = a[c][c] || 1e-12;
      for (let r = c + 1; r < N; r++) { const f = a[r][c] / d; if (!f) continue; for (let k = c; k < N; k++) a[r][k] -= f * a[c][k]; b[r] -= f * b[c]; }
    }
    const x = new Float64Array(N);
    for (let r = N - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < N; k++) s -= a[r][k] * x[k]; x[r] = s / (a[r][r] || 1e-12); }
    return x;
  };
  const wx = solve([...A.map((p) => (p[2] - p[0]) * S), 0, 0, 0]);
  const wy = solve([...A.map((p) => (p[3] - p[1]) * S), 0, 0, 0]);
  return (x, y) => {
    const px = x * S, py = y * S; let dx = wx[n] + wx[n + 1] * px + wx[n + 2] * py, dy = wy[n] + wy[n + 1] * px + wy[n + 2] * py;
    for (let i = 0; i < n; i++) { const ex = px - A[i][0] * S, ey = py - A[i][1] * S; const u = U(ex * ex + ey * ey); dx += wx[i] * u; dy += wy[i] * u; }
    return [x + dx / S, y + dy / S];
  };
}

const tps = buildTPS(anchors());
/** Old game-map coordinate → real-geography game coordinate. */
export function warp(x, y) { const [a, b] = tps(x, y); return [Math.round(a), Math.round(b)]; }
export const OLD_TOWN_POS = OLD_TOWN;
