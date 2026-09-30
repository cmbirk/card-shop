import { shopLayout, ROOM, ANNEX, OFFICE } from '@shared/data/shopLayout';

/** Where Chris stands to talk to a customer at `stationId`: the station's `greetSpot` if it has one
 *  (set where furniture would be in the way), else off to the viewer's right, ~2 m away (a full figure
 *  fits the 55° fov there). Facing the camera. The camera turns to him on arrival. */
export function greetSpot(stationId: string): { spot: [number, number]; facing: number } | null {
  const st = shopLayout.stations.find((s) => s.id === stationId);
  if (!st) return null;
  const [cx, , cz] = st.position;
  let spot: [number, number];
  if (st.greetSpot) {
    spot = [st.greetSpot[0], st.greetSpot[1]];
  } else {
    const [tx, , tz] = st.target;
    const len = Math.hypot(tx - cx, tz - cz) || 1;
    const fx = (tx - cx) / len;
    const fz = (tz - cz) / len;
    // viewer's right = forward rotated -90° about Y
    const rx = -fz;
    const rz = fx;
    spot = [cx + rx * 1.6 + fx * 1.0, cz + rz * 1.6 + fz * 1.0];
    // keep him inside whichever room the customer is standing in
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    if (cx < ANNEX.xMax) {
      spot[0] = clamp(spot[0], ANNEX.xMin + 0.5, ANNEX.xMax - 0.5);
      spot[1] = clamp(spot[1], ANNEX.zMin + 1.0, ANNEX.zMax - 0.5); // clear of the corner plinth
    } else if (cz < OFFICE.zMax) {
      spot[0] = clamp(spot[0], OFFICE.xMin + 0.5, OFFICE.xMax - 0.5);
      spot[1] = clamp(spot[1], OFFICE.zMin + 0.8, OFFICE.zMax - 0.5);
    } else {
      spot[0] = clamp(spot[0], ROOM.xMin + 0.5, ROOM.xMax - 0.5);
      spot[1] = clamp(spot[1], ROOM.zMin + 0.5, ROOM.zMax - 0.5);
    }
  }
  const facing = Math.atan2(cx - spot[0], cz - spot[1]); // model faces +Z at rest
  return { spot, facing };
}
