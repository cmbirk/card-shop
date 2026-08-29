import type { ShopLayout } from '../types';

const D90 = Math.PI / 2;

// 1 unit = 1m. Y up. +Z = entrance (south). Counter at the back (-Z).
// Room: 10m wide (X) x 8m deep (Z), 3m ceiling. Eye height 1.6m.
export const ROOM = { width: 10, depth: 8, height: 3 } as const;

// The Collection: a small annex off the west wall (Chris's personal collection + memorabilia).
// Reached through an open doorway beside the hockey shelf, next to the back-office door.
export const ANNEX = { xMin: -9, xMax: -5, zMin: -5.2, zMax: -1.2, height: 3 } as const;
export const ANNEX_DOOR = { z: -3.2, width: 1.0, height: 2.2 } as const; // on the west wall (x = -5)

export const shopLayout: ShopLayout = {
  entry: 'outside',
  fixtures: [
    {
      id: 'counter',
      kind: 'counter',
      position: [0, 0, -3.2],
      rotationY: 0,
      accepts: {},
      slots: { rows: 0, cols: 0, spacing: [0, 0] },
      stationId: 'counter',
      label: 'Checkout Counter',
    },
    {
      id: 'case-premium',
      kind: 'displayCase',
      position: [3.2, 0, -2.2],
      rotationY: -D90,
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
    {
      id: 'shelf-hockey',
      kind: 'shelf',
      position: [-4.6, 0, -1.5],
      rotationY: D90,
      accepts: { sport: 'hockey' },
      slots: { rows: 4, cols: 8, spacing: [0.22, 0.4] },
      stationId: 'shelf-hockey',
      label: 'Hockey',
    },
    {
      id: 'shelf-football',
      kind: 'shelf',
      position: [-4.6, 0, 0.8],
      rotationY: D90,
      accepts: { sport: 'football' },
      slots: { rows: 4, cols: 8, spacing: [0.22, 0.4] },
      stationId: 'shelf-football',
      label: 'Football',
    },
    {
      id: 'shelf-basketball',
      kind: 'shelf',
      position: [-4.6, 0, 2.9],
      rotationY: D90,
      accepts: { sport: 'basketball' },
      slots: { rows: 4, cols: 8, spacing: [0.22, 0.4] },
      stationId: 'shelf-basketball',
      label: 'Basketball',
    },
    {
      id: 'shelf-tcg',
      kind: 'shelf',
      position: [4.6, 0, 0.8],
      rotationY: -D90,
      accepts: { sport: 'tcg' },
      slots: { rows: 4, cols: 8, spacing: [0.22, 0.4] },
      stationId: 'shelf-tcg',
      label: 'Trading Card Games',
    },
    {
      id: 'shelf-baseball',
      kind: 'shelf',
      position: [4.6, 0, 2.9],
      rotationY: -D90,
      accepts: { sport: 'baseball' },
      slots: { rows: 4, cols: 8, spacing: [0.22, 0.4] },
      stationId: 'shelf-baseball',
      label: 'Baseball',
    },
    {
      id: 'bin-a',
      kind: 'bin',
      position: [-0.6, 0, -0.5],
      rotationY: (15 * Math.PI) / 180,
      accepts: { category: 'budget-box' },
      slots: { rows: 1, cols: 24, spacing: [0, 0.014] }, // a front-to-back stack; spacing[1] = card pitch
      stationId: 'bins',
      label: 'Discount Bin',
    },
    {
      id: 'bin-b',
      kind: 'bin',
      position: [0.7, 0, -0.6],
      rotationY: (-10 * Math.PI) / 180,
      accepts: { category: 'budget-box-b' },
      slots: { rows: 1, cols: 24, spacing: [0, 0.014] }, // a front-to-back stack; spacing[1] = card pitch
      stationId: 'bins',
      label: 'Discount Bin',
    },
  ],
  stations: [
    {
      id: 'outside',
      position: [0, 1.6, 9.2],
      target: [0, 1.7, 4],
      yawRange: 0.8,
      pitchRange: 0.25,
      neighbors: ['entry'],
    },
    {
      id: 'entry',
      position: [0, 1.6, 3.4],
      target: [0, 1.4, -1],
      yawRange: 1.1,
      pitchRange: 0.4,
      neighbors: ['shelf-basketball', 'shelf-baseball', 'bins'],
    },
    {
      id: 'shelf-hockey',
      position: [-3.1, 1.5, -1.5],
      target: [-4.6, 1.35, -1.5],
      yawRange: 1.15,
      pitchRange: 0.4,
      neighbors: ['shelf-football', 'bins', 'counter', 'collection-door'],
    },
    {
      id: 'office-door',
      position: [-3, 1.6, -2.6],
      target: [-3, 1.4, -5],
      yawRange: 0.8,
      pitchRange: 0.35,
      neighbors: ['counter', 'shelf-hockey', 'collection-door', 'office'],
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
      neighbors: ['shelf-hockey', 'counter', 'collection-case'],
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
      id: 'shelf-football',
      position: [-3.1, 1.5, 0.8],
      target: [-4.6, 1.35, 0.8],
      yawRange: 1.15,
      pitchRange: 0.4,
      neighbors: ['shelf-hockey', 'shelf-basketball', 'bins'],
    },
    {
      id: 'shelf-basketball',
      position: [-3.1, 1.5, 2.9],
      target: [-4.6, 1.35, 2.9],
      yawRange: 1.15,
      pitchRange: 0.4,
      neighbors: ['shelf-football', 'entry', 'bins'],
    },
    {
      id: 'shelf-tcg',
      position: [3.1, 1.5, 0.8],
      target: [4.6, 1.35, 0.8],
      yawRange: 1.15,
      pitchRange: 0.4,
      neighbors: ['shelf-baseball', 'case', 'bins'],
    },
    {
      id: 'shelf-baseball',
      position: [3.1, 1.5, 2.9],
      target: [4.6, 1.35, 2.9],
      yawRange: 1.15,
      pitchRange: 0.4,
      neighbors: ['shelf-tcg', 'entry', 'bins'],
    },
    {
      id: 'center',
      position: [0, 1.6, 1.6],
      target: [0, 1.35, -1.5],
      yawRange: Math.PI,
      pitchRange: 0.4,
      neighbors: ['entry', 'bins', 'counter', 'case'],
    },
    {
      id: 'bins',
      position: [0.05, 1.5, 0.7],
      target: [0.05, 0.85, -0.55],
      yawRange: 1.35,
      pitchRange: 0.45,
      neighbors: ['entry', 'counter', 'case', 'shelf-hockey', 'shelf-tcg'],
    },
    {
      id: 'case',
      position: [2.05, 1.5, -2.2],
      target: [3.2, 0.88, -2.2],
      yawRange: 1.15,
      pitchRange: 0.45,
      neighbors: ['shelf-tcg', 'counter', 'bins'],
    },
    {
      id: 'counter',
      position: [0, 1.6, -1.9],
      target: [0, 1.3, -3.6],
      yawRange: 1.1,
      pitchRange: 0.35,
      neighbors: ['bins', 'case', 'shelf-hockey', 'collection-door', 'office-door'],
    },
  ],
};

// Standard trading card: 2.5" x 3.5" — chunkier fake thickness so edges catch light.
export const CARD_SIZE = { w: 0.064, h: 0.089, t: 0.002 } as const;
export const SLAB_SIZE = { w: 0.085, h: 0.135, t: 0.01 } as const;

// "Staff Only" door to the back office, on the north wall left of the counter.
export const BACK_OFFICE_DOOR = { position: [-3.0, 0, -ROOM.depth / 2] as const, width: 1.0, height: 2.2 } as const;

// The back office itself: a small room behind the north wall, straight through the STAFF ONLY door.
// Admin-only (the door gate); the desk computer opens the admin panel.
export const OFFICE = { xMin: -4.6, xMax: -1.4, zMin: -7.2, zMax: -ROOM.depth / 2, height: 3 } as const;
