import type { ShopLayout, Vec3 } from '../types';

const D90 = Math.PI / 2;

// 1 unit = 1m. Y up. +Z = entrance (south). Modern hobby-shop plan: every display is a glass cabinet
// against a wall so the middle of the floor stays open — sport cabinets down the west wall, the Good
// Stuff showcase on the north wall under the jersey wall, an L-bar down the east side (Chris works
// behind it, wax wall on the east wall) with the TCG cabinet south of it, dime boxes under the
// front-left window. Eye height 1.6m.
// Main room: 14m wide (X -5…9) x 11m deep (Z -4…7), 3m ceiling. It is NOT centred on the origin — it grew
// east and south so the west wall (Collection annex) and north wall (back office) stayed put. Use the
// bounds / cx / cz, never ±width/2.
export const ROOM = { xMin: -5, xMax: 9, zMin: -4, zMax: 7, width: 14, depth: 11, height: 3, cx: 2, cz: 1.5 } as const;

/** Storefront (south wall, z = ROOM.zMax): front door centred on the room, a big window either side. */
export const STOREFRONT = {
  doorX: ROOM.cx,
  doorWidth: 1.1,
  doorHeight: 2.2,
  windowXs: [ROOM.cx - 3.5, ROOM.cx + 3.5] as const,
  windowWidth: 2,
  windowY0: 1.1,
  windowY1: 2.5,
} as const;

// The Collection: a small annex off the west wall (Chris's personal collection + memorabilia).
// Reached through an open doorway beside the football shelf, next to the back-office door.
export const ANNEX = { xMin: -9, xMax: -5, zMin: -5.2, zMax: -1.2, height: 3 } as const;
export const ANNEX_DOOR = { z: -3.2, width: 1.0, height: 2.2 } as const; // on the west wall (x = -5)

export const shopLayout: ShopLayout = {
  entry: 'outside',
  fixtures: [
    {
      // the L-bar: long leg down the east side facing west (customers sit on stools on the west face)
      id: 'counter',
      kind: 'counter',
      position: [6.3, 0, -0.4],
      rotationY: -D90,
      accepts: {},
      slots: { rows: 0, cols: 0, spacing: [0, 0] },
      stationId: 'counter',
      label: 'Checkout Counter',
    },
    {
      // centre of the glass showcase run along the north wall, under the jersey wall
      id: 'case-premium',
      kind: 'displayCase',
      position: [ROOM.cx, 0, -3.55],
      rotationY: 0,
      accepts: { featured: true },
      slots: { rows: 2, cols: 5, spacing: [0.28, 0.25] },
      stationId: 'case',
      label: 'The Good Stuff — Graded & Premium',
    },
    {
      id: 'case-collection',
      kind: 'displayCase',
      position: [-8.5, 0, -3.2],
      rotationY: D90,
      accepts: { status: 'personal' },
      slots: { rows: 2, cols: 5, spacing: [0.28, 0.25] },
      stationId: 'collection-case',
      label: "Chris's Collection — Not for Sale",
    },
    // west wall: four tall glass cabinets, north → south
    ...(
      [
        ['shelf-football', 'football', 'Football', -1.5],
        ['shelf-basketball', 'basketball', 'Basketball', 0.8],
        ['shelf-hockey', 'hockey', 'Hockey', 3.1],
        ['shelf-baseball', 'baseball', 'Baseball', 5.4],
      ] as const
    ).map(([id, sport, label, z]) => ({
      id,
      kind: 'shelf' as const,
      position: [-4.6, 0, z] as Vec3,
      rotationY: D90,
      accepts: { sport },
      slots: { rows: 4, cols: 8, spacing: [0.22, 0.4] as [number, number] },
      stationId: id,
      label,
    })),
    {
      // east wall, south of the bar
      id: 'shelf-tcg',
      kind: 'shelf',
      position: [8.6, 0, 4.4],
      rotationY: -D90,
      accepts: { sport: 'tcg' },
      slots: { rows: 4, cols: 8, spacing: [0.22, 0.4] },
      stationId: 'shelf-tcg',
      label: 'Trading Card Games',
    },
    {
      // dime boxes on a table under the front-left window, fronts facing north toward the station
      id: 'bin-a',
      kind: 'bin',
      position: [-1.9, 0, 6.35],
      rotationY: Math.PI + (8 * Math.PI) / 180,
      accepts: { category: 'budget-box' },
      slots: { rows: 1, cols: 24, spacing: [0, 0.014] }, // a front-to-back stack; spacing[1] = card pitch
      stationId: 'bins',
      label: 'Dime Boxes',
    },
    {
      id: 'bin-b',
      kind: 'bin',
      position: [-1.1, 0, 6.35],
      rotationY: Math.PI - (6 * Math.PI) / 180,
      accepts: { category: 'budget-box-b' },
      slots: { rows: 1, cols: 24, spacing: [0, 0.014] }, // a front-to-back stack; spacing[1] = card pitch
      stationId: 'bins',
      label: 'Dime Boxes',
    },
  ],
  stations: [
    {
      id: 'outside',
      position: [ROOM.cx, 1.6, ROOM.zMax + 5.2],
      target: [ROOM.cx, 1.7, ROOM.zMax],
      yawRange: 0.8,
      pitchRange: 0.25,
      neighbors: ['entry'],
    },
    {
      id: 'entry',
      position: [ROOM.cx, 1.6, 6.4],
      target: [ROOM.cx, 1.4, 0],
      yawRange: 1.1,
      pitchRange: 0.4,
      neighbors: ['shelf-baseball', 'center', 'bins', 'shelf-tcg'],
    },
    ...(
      [
        ['shelf-football', -1.5, ['shelf-basketball', 'collection-door', 'office-door', 'center']],
        ['shelf-basketball', 0.8, ['shelf-football', 'shelf-hockey', 'center']],
        ['shelf-hockey', 3.1, ['shelf-basketball', 'shelf-baseball', 'center']],
        ['shelf-baseball', 5.4, ['shelf-hockey', 'bins', 'entry']],
      ] as const
    ).map(([id, z, neighbors]) => ({
      id,
      position: [-3.1, 1.5, z] as Vec3,
      target: [-4.6, 1.35, z] as Vec3,
      yawRange: 1.15,
      pitchRange: 0.4,
      neighbors: [...neighbors],
      greetSpot: [-3.7, z - 1.15] as [number, number], // just north of the camera, clear of the next cabinet
    })),
    {
      id: 'office-door',
      position: [-3, 1.6, -2.6],
      target: [-3, 1.4, -5],
      yawRange: 0.8,
      pitchRange: 0.35,
      neighbors: ['case', 'shelf-football', 'collection-door', 'office'],
      greetSpot: [-1.7, -2.75],
    },
    {
      id: 'office',
      position: [-3, 1.5, -4.9],
      target: [-3, 1.1, -6.6],
      yawRange: 1.3,
      pitchRange: 0.45,
      neighbors: ['office-door'],
    },
    {
      id: 'collection-door',
      position: [-3.9, 1.6, -3.2],
      target: [-7, 1.4, -3.2],
      yawRange: 0.9,
      pitchRange: 0.35,
      neighbors: ['shelf-football', 'office-door', 'collection-case'],
    },
    {
      id: 'collection-case',
      position: [-6.4, 1.5, -3.2],
      target: [-8.6, 1.0, -3.2],
      yawRange: 1.4,
      pitchRange: 0.45,
      neighbors: ['collection-door'],
    },
    {
      // TCG cabinet on the east wall, south of the bar
      id: 'shelf-tcg',
      position: [7.1, 1.5, 4.4],
      target: [8.6, 1.35, 4.4],
      yawRange: 1.15,
      pitchRange: 0.4,
      neighbors: ['counter', 'entry', 'center'],
      greetSpot: [6.2, 5.6],
    },
    {
      // the open middle of the floor
      id: 'center',
      position: [ROOM.cx, 1.6, 3.4],
      target: [ROOM.cx, 1.35, -1.0],
      yawRange: Math.PI,
      pitchRange: 0.4,
      neighbors: ['entry', 'shelf-basketball', 'shelf-hockey', 'counter', 'case', 'shelf-tcg', 'bins'],
    },
    {
      // dime-box table under the front-left window (camera looks south, toward the glass)
      id: 'bins',
      position: [-1.5, 1.5, 5.25],
      target: [-1.5, 0.85, 6.35],
      yawRange: 1.35,
      pitchRange: 0.45,
      neighbors: ['entry', 'center', 'shelf-baseball'],
      greetSpot: [0.4, 5.6],
    },
    {
      id: 'case',
      position: [ROOM.cx, 1.5, -2.2],
      target: [ROOM.cx, 0.88, -3.55],
      yawRange: 1.15,
      pitchRange: 0.45,
      neighbors: ['counter', 'office-door', 'center'],
      greetSpot: [3.5, -2.4],
    },
    {
      // customer side of the bar, looking over it at Chris and the wax wall
      id: 'counter',
      position: [4.5, 1.6, -1.3],
      target: [6.4, 1.25, -0.9],
      yawRange: 1.1,
      pitchRange: 0.35,
      neighbors: ['case', 'center', 'shelf-tcg'],
    },
  ],
};


// Standard trading card: 2.5" x 3.5" — chunkier fake thickness so edges catch light.
export const CARD_SIZE = { w: 0.064, h: 0.089, t: 0.002 } as const;
export const SLAB_SIZE = { w: 0.085, h: 0.135, t: 0.01 } as const;

// "Staff Only" door to the back office, on the north wall left of the counter.
export const BACK_OFFICE_DOOR = { position: [-3.0, 0, ROOM.zMin] as const, width: 1.0, height: 2.2 } as const;

// The back office itself: a small room behind the north wall, straight through the STAFF ONLY door.
// Admin-only (the door gate); the desk computer opens the admin panel.
export const OFFICE = { xMin: -4.6, xMax: -1.4, zMin: -7.2, zMax: ROOM.zMin, height: 3 } as const;
