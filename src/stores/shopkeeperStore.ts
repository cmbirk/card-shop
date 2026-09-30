import { create } from 'zustand';
import { planRoute } from '@shared/data/obstacles';

// Where Chris is. Pure state — <Shopkeeper/> does the actual locomotion and
// reports arrivals; dialogueStore.askAbout() drives the visit.

export type ShopkeeperPose = 'counter' | 'walkingOut' | 'visiting' | 'walkingBack';

/** Chris's rest position behind the bar (world x, z), facing west across it at the customers. */
export const SHOPKEEPER_HOME: readonly [number, number] = [7.3, -0.4];
export const SHOPKEEPER_HOME_YAW = -Math.PI / 2;

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

/** Waypoints from behind the bar to `spot`: out the bar's south end, and through the Collection
 *  doorway as needed (planned on the shared obstacle map). Reverse for the walk home. */
export function pathToSpot(spot: readonly [number, number]): [number, number][] {
  return planRoute(SHOPKEEPER_HOME, spot);
}
