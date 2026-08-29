import { create } from 'zustand';
import { ANNEX, ANNEX_DOOR } from '@shared/data/shopLayout';

// Where Chris is. Pure state — <Shopkeeper/> does the actual locomotion and
// reports arrivals; dialogueStore.askAbout() drives the visit.

export type ShopkeeperPose = 'counter' | 'walkingOut' | 'visiting' | 'walkingBack';

/** Chris's rest position behind the counter (world x, z). */
export const SHOPKEEPER_HOME: readonly [number, number] = [0, -3.7];

interface ShopkeeperState {
  pose: ShopkeeperPose;
  /** Where he's heading / standing when out on the floor (world x, z). */
  spot: readonly [number, number] | null;
  /** World yaw to settle into once he's at the spot (faces the customer). */
  facing: number;
  visitId: number;
  /** Waypoints for the current walking leg (world x, z); planned synchronously with the pose change. */
  path: readonly (readonly [number, number])[];
  legId: number; // bumps per leg so the walker resets its waypoint index
  visit: (spot: readonly [number, number], facing: number) => void;
  arrivedAtSpot: () => void;
  leave: () => void;
  arrivedHome: () => void;
}

export const useShopkeeperStore = create<ShopkeeperState>((set, get) => ({
  pose: 'counter',
  spot: null,
  facing: 0,
  visitId: 0,
  path: [],
  legId: 0,
  visit: (spot, facing) => {
    if (get().pose !== 'counter') return;
    set((s) => ({ pose: 'walkingOut', spot, facing, visitId: s.visitId + 1, path: pathToSpot(spot), legId: s.legId + 1 }));
  },
  arrivedAtSpot: () => {
    if (get().pose === 'walkingOut') set({ pose: 'visiting' });
  },
  leave: () => {
    const { pose, spot } = get();
    if ((pose === 'visiting' || pose === 'walkingOut') && spot) {
      // retrace the outbound route (minus the spot itself) from wherever he currently is, then home
      const out = pathToSpot(spot);
      set((s) => ({ pose: 'walkingBack', path: [...out.slice(0, -1).reverse(), SHOPKEEPER_HOME], legId: s.legId + 1 }));
    }
  },
  arrivedHome: () => {
    if (get().pose === 'walkingBack') set({ pose: 'counter', spot: null, path: [] });
  },
}));

/**
 * Waypoints from the counter to `spot`, going around the near end of the counter
 * (counter spans x ±1.5, z −3.5…−2.9). Reverse for the walk home.
 */
export function pathToSpot(spot: readonly [number, number]): [number, number][] {
  const side = spot[0] < 0 ? -2.0 : 2.0;
  const path: [number, number][] = [
    [side, SHOPKEEPER_HOME[1]],
    [side, -2.4],
  ];
  // the Colts Room is through the doorway on the west wall
  if (spot[0] < ANNEX.xMax) path.push([ANNEX.xMax + 0.6, ANNEX_DOOR.z], [ANNEX.xMax - 0.6, ANNEX_DOOR.z]);
  path.push([spot[0], spot[1]]);
  return path;
}
