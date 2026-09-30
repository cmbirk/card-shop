import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BAR } from '@shared/data/obstacles';
import { MAT, ledStripMat } from '../materials';
import { metreBox } from '../geo';
import { inventory } from '../../systems/inventory';
import { resinCardTexture } from '../decor/resinTop';
import { HoldPile } from './HoldPile';

// The L-bar, in counter-local space: the long leg runs along local X, customers are on local +Z (the
// fixture is rotated so +Z faces west into the shop). A short return at the north end (local -X) runs
// back toward the east wall (local -Z). Stacked-limestone base, dark kick, a countertop of cards under
// glossy resin with a dark wood edge, and a warm LED strip under the customer-side lip.
// Footprint must match BAR in shared/data/obstacles.ts (walk collision + Chris's routing use it).

const L = BAR.z1 - BAR.z0; // long-leg length (world z span)
const TOP_Y = 1.02;
const TOP_T = 0.045;
const BODY_D = 0.5; // stone body depth (customer face at z = 0.2)
const TOP_D = 0.72; // top depth (overhangs the customer side)
const RET_W = BAR.returnDepth; // return width along local x
const RET_LEN = BAR.returnX1 - (BAR.x - BAR.depth / 2); // return length along local -z
const noHit = () => null;

export function Counter() {
  const { topMat, retTopGeo, stoneGeo, retStoneGeo } = useMemo(() => {
    const map = resinCardTexture(inventory);
    const resin = new THREE.MeshPhysicalMaterial({ map, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.04 });
    // box faces: +x, -x, +y (resin), -y, +z, -z — the edges are dark wood
    const topMat = [MAT.barEdge, MAT.barEdge, resin, MAT.barEdge, MAT.barEdge, MAT.barEdge];
    const retTopGeo = new THREE.BoxGeometry(RET_W + 0.04, TOP_T, RET_LEN);
    // keep the collage at the same scale on the return: squeeze its UVs to the return's share of the leg
    const uv = retTopGeo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (RET_LEN / L), uv.getY(i) * ((RET_W + 0.04) / TOP_D));
    const stoneGeo = metreBox(L, 0.92, BODY_D, 0.9);
    const retStoneGeo = metreBox(RET_W - 0.1, 0.92, RET_LEN - 0.1, 0.9);
    return { topMat, retTopGeo, stoneGeo, retStoneGeo };
  }, []);
  useEffect(
    () => () => {
      retTopGeo.dispose();
      stoneGeo.dispose();
      retStoneGeo.dispose();
      (topMat[2] as THREE.Material).dispose();
    },
    [topMat, retTopGeo, stoneGeo, retStoneGeo],
  );

  const retX = -L / 2 + RET_W / 2; // return centre along the leg (its north end)
  const retZ = BAR.depth / 2 - RET_LEN / 2; // runs from the customer face back toward the wall
  return (
    <group>
      {/* long leg: dark kick, stone body, resin top */}
      <mesh material={MAT.dark} position={[0, 0.04, -0.05]}>
        <boxGeometry args={[L - 0.04, 0.08, BODY_D - 0.06]} />
      </mesh>
      <mesh material={MAT.stone} geometry={stoneGeo} position={[0, 0.54, -0.05]} castShadow />
      <mesh material={topMat} position={[0, TOP_Y, 0]} castShadow>
        <boxGeometry args={[L + 0.04, TOP_T, TOP_D]} />
      </mesh>
      {/* the return at the north end */}
      <mesh material={MAT.stone} geometry={retStoneGeo} position={[retX, 0.54, retZ - 0.05]} castShadow />
      {/* a hair higher than the leg's top where they overlap, so the two faces don't z-fight */}
      <mesh material={topMat} geometry={retTopGeo} position={[retX, TOP_Y + 0.002, retZ]} castShadow />
      {/* warm LED under the customer-side lip (emitter only) */}
      <mesh material={ledStripMat} position={[0, TOP_Y - TOP_T / 2 - 0.006, 0.26]} raycast={noHit}>
        <boxGeometry args={[L - 0.1, 0.008, 0.02]} />
      </mesh>
      {/* register */}
      <group position={[-1, TOP_Y + TOP_T / 2, -0.05]}>
        <mesh material={MAT.dark} position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.35, 0.24, 0.3]} />
        </mesh>
        <mesh position={[0, 0.2, 0.14]} rotation-x={-0.35}>
          <planeGeometry args={[0.26, 0.12]} />
          <meshBasicMaterial color="#9fdca8" />
        </mesh>
      </group>
      {/* the customer's picks, held up front */}
      <HoldPile />
      {/* supplies by the register: a stack of toploaders + a box of penny sleeves */}
      <mesh material={MAT.glass} position={[-1.45, TOP_Y + 0.05, 0.05]} raycast={noHit}>
        <boxGeometry args={[0.08, 0.08, 0.11]} />
      </mesh>
      <mesh material={MAT.cardboxWhite} position={[-1.6, TOP_Y + 0.045, 0.1]} rotation-y={0.2} castShadow>
        <boxGeometry args={[0.1, 0.07, 0.13]} />
      </mesh>
      {/* paper bag */}
      <mesh material={MAT.cardboard} position={[0.9, TOP_Y + 0.16, -0.1]} castShadow>
        <boxGeometry args={[0.22, 0.28, 0.14]} />
      </mesh>
    </group>
  );
}
