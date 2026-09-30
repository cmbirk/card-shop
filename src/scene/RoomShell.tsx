import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ROOM, ANNEX_DOOR, BACK_OFFICE_DOOR, STOREFRONT } from '@shared/data/shopLayout';
import { MAT, dropCeilingMat } from './materials';
import { LOOK } from './look';

// Modern-shop room details: recessed can lights + troffers in the black drop ceiling, and white
// baseboards. All decor: raycast off, emitters only (the cans bloom but are not lights — see look.ts).

const TILE = 1.22; // one ceiling-texture repeat = 2 x 2 ft tiles
dropCeilingMat.map!.repeat.set(ROOM.width / TILE, ROOM.depth / TILE);

const canGeo = new THREE.CircleGeometry(0.075, 20).rotateX(Math.PI / 2); // faces down
const canRimGeo = new THREE.RingGeometry(0.075, 0.1, 24).rotateX(Math.PI / 2);
const canMat = new THREE.MeshBasicMaterial({ color: LOOK.canGlow });
const rimMat = new THREE.MeshStandardMaterial({ color: '#d9dadc', roughness: 0.4, metalness: 0.3 });
const panelMat = new THREE.MeshBasicMaterial({ color: LOOK.panelGlow });

/** Recessed cans on a grid across the main room, plus two 2x4 troffer panels. */
export function CeilingCans() {
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = ROOM.xMin + 0.9; x <= ROOM.xMax - 0.5; x += LOOK.canSpacing)
      for (let z = ROOM.zMin + 0.8; z <= ROOM.zMax - 0.5; z += LOOK.canSpacing) out.push([x, z]);
    return out;
  }, []);
  const { cans, rims } = useMemo(() => {
    const cans = new THREE.InstancedMesh(canGeo, canMat, spots.length);
    const rims = new THREE.InstancedMesh(canRimGeo, rimMat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(([x, z], i) => {
      m.makeTranslation(x, ROOM.height - 0.004, z);
      cans.setMatrixAt(i, m);
      rims.setMatrixAt(i, m);
    });
    cans.raycast = rims.raycast = () => {};
    return { cans, rims };
  }, [spots]);
  useEffect(() => () => { cans.dispose(); rims.dispose(); }, [cans, rims]);
  return (
    <group>
      <primitive object={cans} />
      <primitive object={rims} />
      {LOOK.troffers.map(([x, z]) => (
        <mesh key={`${x},${z}`} material={panelMat} position={[x, ROOM.height - 0.004, z]} rotation-x={Math.PI / 2} raycast={() => null}>
          <planeGeometry args={[1.22, 0.61]} />
        </mesh>
      ))}
    </group>
  );
}

const BB_H = 0.1;
const BB_T = 0.015;

/** White baseboards around the main room, broken at the doors. */
export function Baseboards() {
  const runs = useMemo(() => {
    const { xMin, xMax, zMin, zMax, depth: D } = ROOM;
    const d0 = STOREFRONT.doorX - STOREFRONT.doorWidth / 2;
    const d1 = STOREFRONT.doorX + STOREFRONT.doorWidth / 2;
    const ox0 = BACK_OFFICE_DOOR.position[0] - BACK_OFFICE_DOOR.width / 2;
    const ox1 = BACK_OFFICE_DOOR.position[0] + BACK_OFFICE_DOOR.width / 2;
    const az0 = ANNEX_DOOR.z - ANNEX_DOOR.width / 2;
    const az1 = ANNEX_DOOR.z + ANNEX_DOOR.width / 2;
    // [x, z, length, rotationY]
    const r: [number, number, number, number][] = [
      // north wall (z = -D/2), split around the office door
      [(xMin + ox0) / 2, zMin + BB_T / 2, ox0 - xMin, 0],
      [(ox1 + xMax) / 2, zMin + BB_T / 2, xMax - ox1, 0],
      // west wall, split around the Collection doorway
      [xMin + BB_T / 2, (zMin + az0) / 2, az0 - zMin, Math.PI / 2],
      [xMin + BB_T / 2, (az1 + zMax) / 2, zMax - az1, Math.PI / 2],
      // east wall
      [xMax - BB_T / 2, ROOM.cz, D, Math.PI / 2],
      // south wall, split around the front door
      [(xMin + d0) / 2, zMax - BB_T / 2, d0 - xMin, 0],
      [(d1 + xMax) / 2, zMax - BB_T / 2, xMax - d1, 0],
    ];
    return r;
  }, []);
  return (
    <group>
      {runs.map(([x, z, len, ry], i) => (
        <mesh key={i} material={MAT.trim} position={[x, BB_H / 2, z]} rotation-y={ry} raycast={() => null}>
          <boxGeometry args={[len, BB_H, BB_T]} />
        </mesh>
      ))}
    </group>
  );
}
