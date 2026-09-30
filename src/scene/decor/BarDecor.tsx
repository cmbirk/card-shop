import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { STOOLS, DIME_TABLE, TOWERS } from '@shared/data/obstacles';
import { roundedBox } from '../geo';
import { MAT } from '../materials';

// Floor decor placed from the same constants the obstacle map uses (shared/data/obstacles.ts), so what
// you see is exactly what blocks you. Decor only: every mesh opts out of raycasting.
const noHit = () => null;

const seatGeo = new THREE.CylinderGeometry(0.2, 0.19, 0.08, 24);
// a half-round low back, open toward the bar (+X, east)
const backGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.18, 20, 1, true, Math.PI, Math.PI);
const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.66, 10);
const ringGeo = new THREE.TorusGeometry(0.16, 0.012, 8, 24).rotateX(Math.PI / 2);
const footGeo = new THREE.CylinderGeometry(0.21, 0.23, 0.025, 24);

/** Dark leather swivel stools along the customer face of the bar. */
export function BarStools() {
  return (
    <group>
      {STOOLS.zs.map((z) => (
        <group key={z} position={[STOOLS.x, 0, z]}>
          <mesh geometry={footGeo} material={MAT.blackMetal} position-y={0.0125} raycast={noHit} />
          <mesh geometry={postGeo} material={MAT.blackMetal} position-y={0.355} raycast={noHit} castShadow />
          <mesh geometry={ringGeo} material={MAT.blackMetal} position-y={0.3} raycast={noHit} />
          <mesh geometry={seatGeo} material={MAT.leather} position-y={0.73} raycast={noHit} castShadow />
          <mesh geometry={backGeo} material={MAT.leather} position-y={0.86} rotation-y={Math.PI / 2} raycast={noHit} castShadow />
        </group>
      ))}
    </group>
  );
}

/** White-top folding table the dime boxes sit on (its top surface is just under the bins' base). */
export function DimeTable() {
  const { x0, x1, z0, z1 } = DIME_TABLE;
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  return (
    <group position={[cx, 0, cz]}>
      <mesh material={MAT.trim} geometry={roundedBox(w, 0.03, d, 0.012)} position-y={0.74} raycast={noHit} castShadow />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} material={MAT.blackMetal} position={[sx * (w / 2 - 0.08), 0.365, sz * (d / 2 - 0.06)]} raycast={noHit}>
            <cylinderGeometry args={[0.014, 0.014, 0.73, 8]} />
          </mesh>
        )),
      )}
    </group>
  );
}

const ballMat = new THREE.MeshStandardMaterial({ color: '#f1ede4', roughness: 0.6 });
const footballMat = new THREE.MeshStandardMaterial({ color: '#6b3a22', roughness: 0.7 });
const helmetMat = new THREE.MeshPhysicalMaterial({ color: '#1d3f86', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
const helmet2Mat = new THREE.MeshPhysicalMaterial({ color: '#e8e9ec', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });

/** Tall glass towers of memorabilia in the front-right corner: glass shelves of balls and helmets
 *  (generic colours, no marks). */
export function MemorabiliaTowers() {
  const { x0, x1, z0, z1 } = TOWERS;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  const shelves = [0.45, 0.95, 1.45];
  const halfHelmet = useMemo(() => new THREE.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), []);
  const football = useMemo(() => new THREE.SphereGeometry(0.1, 16, 12).scale(1, 0.62, 0.62), []);
  useEffect(() => () => { halfHelmet.dispose(); football.dispose(); }, [halfHelmet, football]);
  return (
    <group position={[cx, 0, cz]}>
      {/* base + header */}
      <mesh material={MAT.laminate} geometry={roundedBox(w, 0.24, d, 0.012)} position-y={0.12} raycast={noHit} castShadow />
      <mesh material={MAT.laminate} geometry={roundedBox(w, 0.06, d, 0.012)} position-y={1.93} raycast={noHit} />
      {/* glass box */}
      <mesh material={MAT.glass} position-y={1.07} raycast={noHit}>
        <boxGeometry args={[w, 1.66, d]} />
      </mesh>
      {shelves.map((y, i) => (
        <group key={y} position-y={y}>
          <mesh material={MAT.glass} raycast={noHit}>
            <boxGeometry args={[w - 0.02, 0.01, d - 0.02]} />
          </mesh>
          {i === 1 ? (
            <>
              <mesh geometry={halfHelmet} material={helmetMat} position={[0, 0.02, -0.2]} raycast={noHit} />
              <mesh geometry={halfHelmet} material={helmet2Mat} position={[0, 0.02, 0.2]} raycast={noHit} />
            </>
          ) : (
            [-0.3, 0, 0.3].map((z, k) => (
              <mesh
                key={z}
                geometry={k === 1 && i === 0 ? football : undefined}
                material={k === 1 && i === 0 ? footballMat : ballMat}
                position={[0, 0.08, z]}
                raycast={noHit}
              >
                {!(k === 1 && i === 0) && <sphereGeometry args={[0.037, 16, 12]} />}
              </mesh>
            ))
          )}
        </group>
      ))}
    </group>
  );
}
