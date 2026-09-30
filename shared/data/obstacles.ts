import { shopLayout, OFFICE, ROOM, ANNEX, ANNEX_DOOR } from './shopLayout';

// Floor footprints of everything you can't walk through, as axis-aligned boxes (world x/z).
// One source for walk collision, Chris's route checks and camera-glide detours.

export interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The L-bar (visuals in fixtures/Counter.tsx): a long leg down the east side + a short return at its
 *  north end running toward the east wall. Chris works in the aisle between the bar and the wax wall. */
export const BAR = {
  x: 6.3, // centre line of the long leg
  depth: 0.7,
  z0: -3.25,
  z1: 2.45,
  returnX1: 7.6, // the return runs east from the leg to here (staff get in from the south end)
  returnDepth: 0.6,
} as const;

/** Bar stools along the customer (west) face of the bar. */
export const STOOLS = { x: 5.62, zs: [-2.5, -1.55, -0.6, 0.35, 1.3, 2.25] as const, radius: 0.22 } as const;

/** Folding table under the dime boxes (bins), under the front-left window. */
export const DIME_TABLE: Box = { x0: -2.5, x1: -0.5, z0: 6.0, z1: 6.7 };

/** Glass memorabilia towers in the front-right corner. */
export const TOWERS: Box = { x0: 8.3, x1: 8.95, z0: 6.0, z1: 6.95 };

/** Decorative glass cases extending the showcase run either side of case-premium: x offsets from the
 *  room's centre line (drawn in Shop.tsx; each case is 1.6 m wide like DisplayCase). */
export const SHOWCASE_RUN_X = [-3.3, -1.65, 1.65] as const;
const CASE_W = 1.6;
export const SHOWCASE_RUN: Box = {
  x0: ROOM.cx + Math.min(0, ...SHOWCASE_RUN_X) - CASE_W / 2 - 0.05,
  x1: ROOM.cx + Math.max(0, ...SHOWCASE_RUN_X) + CASE_W / 2 + 0.05,
  z0: -3.9,
  z1: -3.2,
};

/** Fixture footprints by kind (axis-aligned; 90° rotations swap extents). The counter is the L-bar. */
const FOOT: Record<string, [number, number]> = { displayCase: [1.75, 0.75], bin: [0.8, 0.8], shelf: [2.3, 0.55] };

export const OBSTACLES: Box[] = shopLayout.fixtures
  .filter((f) => f.kind in FOOT)
  .map((f) => {
    let [w, d] = FOOT[f.kind];
    if (Math.abs(Math.abs(f.rotationY) - Math.PI / 2) < 0.3) [w, d] = [d, w];
    return { x0: f.position[0] - w / 2, x1: f.position[0] + w / 2, z0: f.position[2] - d / 2, z1: f.position[2] + d / 2 };
  })
  .concat([
    { x0: BAR.x - BAR.depth / 2, x1: BAR.x + BAR.depth / 2, z0: BAR.z0, z1: BAR.z1 }, // bar, long leg
    { x0: BAR.x - BAR.depth / 2, x1: BAR.returnX1, z0: BAR.z0, z1: BAR.z0 + BAR.returnDepth }, // bar, return
    { x0: STOOLS.x - STOOLS.radius, x1: STOOLS.x + STOOLS.radius, z0: STOOLS.zs[0] - STOOLS.radius, z1: STOOLS.zs[STOOLS.zs.length - 1] + STOOLS.radius },
    DIME_TABLE,
    TOWERS,
    SHOWCASE_RUN,
    { x0: -3.8, x1: -2.2, z0: OFFICE.zMin, z1: OFFICE.zMin + 1.0 }, // office desk + chair
    { x0: OFFICE.xMin, x1: OFFICE.xMin + 0.65, z0: OFFICE.zMin, z1: OFFICE.zMin + 0.75 }, // filing cabinet
    { x0: -8.85, x1: -8.15, z0: -5.1, z1: -4.4 }, // trophy plinth (annex)
  ]);

export const inBox = (b: Box, x: number, z: number, m = 0) => x > b.x0 + m && x < b.x1 - m && z > b.z0 + m && z < b.z1 - m;

/** Does the straight segment a→b pass through box `b` (grown by `grow` metres)? Sampled every 5 cm. */
export function segmentHitsBox(a: readonly [number, number], b2: readonly [number, number], box: Box, grow = 0): boolean {
  const n = Math.max(2, Math.ceil(Math.hypot(b2[0] - a[0], b2[1] - a[1]) / 0.05));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (inBox(box, a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, -grow)) return true;
  }
  return false;
}

/** The main room's west wall, minus the Collection doorway (for route planning between rooms). */
export const WEST_WALL: Box[] = [
  { x0: ROOM.xMin - 0.1, x1: ROOM.xMin + 0.1, z0: ROOM.zMin - 1, z1: ANNEX_DOOR.z - ANNEX_DOOR.width / 2 + 0.05 },
  { x0: ROOM.xMin - 0.1, x1: ROOM.xMin + 0.1, z0: ANNEX_DOOR.z + ANNEX_DOOR.width / 2 - 0.05, z1: ROOM.zMax + 1 },
];

/** Floor waypoints Chris can route through (world x, z): the gap at the bar's south end, the customer
 *  side past the stools, and either side of the Collection doorway. */
export const NAV_NODES: [number, number][] = [
  [BAR.x + 1.0, BAR.z1 + 0.65], // staff aisle, just past the bar's south end
  [STOOLS.x - 0.55, BAR.z1 + 0.9], // customer side, south of the stools
  [ANNEX.xMax + 0.6, ANNEX_DOOR.z], // Collection doorway, main-room side
  [ANNEX.xMax - 0.6, ANNEX_DOOR.z], // Collection doorway, annex side
];

/** Clear straight line for someone ~0.25 m wide? (fixtures + the west wall) */
export function clearLine(a: readonly [number, number], b: readonly [number, number]): boolean {
  return ![...OBSTACLES, ...WEST_WALL].some((o) => segmentHitsBox(a, b, o, 0.25));
}

/** Shortest route from `from` to `to` through NAV_NODES (Dijkstra on the visibility graph).
 *  Returns the waypoints after `from`, ending at `to`; falls back to a straight line if nothing connects. */
export function planRoute(from: readonly [number, number], to: readonly [number, number]): [number, number][] {
  const pts: [number, number][] = [[from[0], from[1]], ...NAV_NODES, [to[0], to[1]]];
  const n = pts.length;
  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === n - 1) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || !clearLine(pts[u], pts[v])) continue;
      const d = dist[u] + Math.hypot(pts[v][0] - pts[u][0], pts[v][1] - pts[u][1]);
      if (d < dist[v]) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  if (prev[n - 1] < 0) {
    // target unreachable (it sits in furniture): go to the reachable node nearest it, then one short leg
    let best = -1;
    for (let i = 1; i < n - 1; i++)
      if (dist[i] < Infinity && (best < 0 || Math.hypot(pts[i][0] - to[0], pts[i][1] - to[1]) < Math.hypot(pts[best][0] - to[0], pts[best][1] - to[1]))) best = i;
    if (best < 0) return [[to[0], to[1]]];
    prev[n - 1] = best;
  }
  const out: [number, number][] = [];
  for (let v = n - 1; v > 0; v = prev[v]) out.unshift(pts[v]);
  return out;
}

/** Nearest point to `p` that a ~0.25 m walker can stand on (searches outward in 10 cm rings). */
export function nudgeClear(p: readonly [number, number]): [number, number] {
  const free = (x: number, z: number) => !OBSTACLES.some((o) => inBox(o, x, z, -0.25));
  if (free(p[0], p[1])) return [p[0], p[1]];
  for (let r = 0.1; r <= 2; r += 0.1)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = p[0] + Math.cos(a) * r;
      const z = p[1] + Math.sin(a) * r;
      if (free(x, z)) return [x, z];
    }
  return [p[0], p[1]];
}
