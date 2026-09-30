import { describe, it, expect } from 'vitest';
import { shopLayout, ROOM, OFFICE } from '@shared/data/shopLayout';
import { OBSTACLES, clearLine, inBox } from '@shared/data/obstacles';
import { greetSpot } from './greet';
import { pathToSpot, SHOPKEEPER_HOME } from '../stores/shopkeeperStore';
import { LOKI_HOME, LOKI_GREET } from '../stores/lokiStore';
import { planRoute, nudgeClear, BAR } from '@shared/data/obstacles';

// Guards the floor plan: nobody stands inside furniture, Chris can actually walk to every customer,
// and the station rings don't pile on top of each other.

const mainRoom = (x: number, z: number) => x > ROOM.xMin && x < ROOM.xMax && z > ROOM.zMin && z < ROOM.zMax;
const blocked = (x: number, z: number, grow = 0) => OBSTACLES.some((o) => inBox(o, x, z, -grow));
const floorStations = shopLayout.stations.filter((s) => s.id !== 'outside');

describe('shop floor plan', () => {
  it('no station camera stands inside furniture', () => {
    for (const st of floorStations) expect(blocked(st.position[0], st.position[2], 0.15), st.id).toBe(false);
  });

  it('main-room station rings are at least 0.9 m apart', () => {
    const main = floorStations.filter((s) => mainRoom(s.position[0], s.position[2]));
    for (const a of main)
      for (const b of main) {
        if (a.id >= b.id) continue;
        const d = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
        expect(d, `${a.id} ↔ ${b.id}`).toBeGreaterThanOrEqual(0.9);
      }
  });

  // Chris walks out from behind the bar to every station except the counter (he's already there)
  // and the back office (staff only — he never visits).
  const visited = floorStations.filter((s) => s.id !== 'counter' && s.position[2] > OFFICE.zMax);

  it("Chris's talk spots are clear of furniture", () => {
    for (const st of visited) {
      const g = greetSpot(st.id)!;
      expect(blocked(g.spot[0], g.spot[1], 0.25), `${st.id} → ${g.spot}`).toBe(false);
    }
  });

  it('Chris can walk from behind the bar to every talk spot without clipping anything', () => {
    for (const st of visited) {
      const { spot } = greetSpot(st.id)!;
      const pts = [SHOPKEEPER_HOME, ...pathToSpot(spot)];
      expect(pts[pts.length - 1], st.id).toEqual(spot);
      for (let i = 0; i < pts.length - 1; i++) expect(clearLine(pts[i], pts[i + 1]), `${st.id} leg ${i}: ${pts[i]} → ${pts[i + 1]}`).toBe(true);
    }
  });

  it('the counter fixture sits exactly on the bar footprint the obstacle map uses', () => {
    const c = shopLayout.fixtures.find((f) => f.kind === 'counter')!;
    expect(c.position[0]).toBeCloseTo(BAR.x);
    expect(c.position[2]).toBeCloseTo((BAR.z0 + BAR.z1) / 2);
  });

  it('a spot inside furniture is nudged clear, and Chris still routes around the bar to it', () => {
    const spot = nudgeClear([-4.5, 0.8]); // inside the basketball cabinet
    expect(blocked(spot[0], spot[1], 0.25)).toBe(false);
    const pts = [SHOPKEEPER_HOME, ...pathToSpot(spot)];
    for (let i = 0; i < pts.length - 1; i++) expect(clearLine(pts[i], pts[i + 1]), `leg ${i}`).toBe(true);
  });

  it("Loki's home is on open floor and his greeting walk is clear", () => {
    expect(blocked(LOKI_HOME[0], LOKI_HOME[1], 0.2)).toBe(false);
    const pts = [LOKI_HOME, ...planRoute(LOKI_HOME, LOKI_GREET)];
    for (let i = 0; i < pts.length - 1; i++) expect(clearLine(pts[i], pts[i + 1]), `leg ${i}`).toBe(true);
  });
});
