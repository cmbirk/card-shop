import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CARD_SIZE } from '@shared/data/shopLayout';
import { useBasketStore } from '../stores/basketStore';
import { useUIStore } from '../stores/uiStore';
import { inventoryById } from '../systems/inventory';
import { getCardVisual } from './cards/atlas';
import { mulberry32, spread } from '../systems/rng';
import { FEEL } from '../feel';

const wireMat = new THREE.MeshStandardMaterial({ color: '#7a5a3f', roughness: 0.6, metalness: 0.3 });
const rimMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.7 });

const _target = new THREE.Vector3();
const _quat = new THREE.Quaternion();

/** The hand basket — follows the camera with a lag so it swings on glides. */
export function Basket3D() {
  const group = useRef<THREE.Group>(null!);
  const items = useBasketStore((s) => s.items);
  const tantrumCount = useUIStore((s) => s.tantrumCount);
  const throwState = useRef({ seen: 0, active: false, t: 0, start: new THREE.Vector3(), floor: new THREE.Vector3() });
  const visible = items.slice(0, 6);
  const overflow = items.length - visible.length;

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const cam = state.camera;
    const ts = throwState.current;

    // customer stormed off — basket gets hurled to the floor
    if (tantrumCount !== ts.seen) {
      ts.seen = tantrumCount;
      ts.active = true;
      ts.t = 0;
      ts.start.copy(g.position);
      cam.getWorldDirection(_target);
      ts.floor.set(cam.position.x + _target.x * 0.9, 0.06, cam.position.z + _target.z * 0.9);
    }
    if (ts.active) {
      ts.t += dt / 0.55;
      const k = Math.min(ts.t, 1);
      g.position.lerpVectors(ts.start, ts.floor, k * k); // accelerating throw-down
      g.rotation.set(0, g.rotation.y, k * 1.9); // tips over on impact
      if (useBasketStore.getState().items.length === 0) {
        // Mel restocked — basket back in hand on the way out
        ts.active = false;
        g.rotation.set(0, 0, 0);
      }
      return;
    }

    _target
      .set(FEEL.basketAnchor[0], FEEL.basketAnchor[1], FEEL.basketAnchor[2])
      .applyQuaternion(cam.quaternion)
      .add(cam.position);
    // damped follow — the lag IS the charm
    g.position.x = THREE.MathUtils.damp(g.position.x, _target.x, FEEL.basketLambda, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, _target.y, FEEL.basketLambda, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, _target.z, FEEL.basketLambda, dt);
    _quat.copy(cam.quaternion);
    g.quaternion.slerp(_quat, 1 - Math.exp(-FEEL.basketLambda * dt));
  });

  const minis = useMemo(
    () =>
      visible.map((id, i) => {
        const rand = mulberry32(inventoryById.get(id)!.seed + 3);
        return {
          id,
          x: (i - (visible.length - 1) / 2) * 0.02,
          z: -0.02 + i * 0.008,
          rot: [-1.15 + spread(rand) * 0.1, spread(rand) * 0.15, spread(rand) * 0.2] as [number, number, number],
        };
      }),
    [visible],
  );

  return (
    <group ref={group} scale={FEEL.basketScale}>
      {/* basket body */}
      <mesh material={wireMat}>
        <cylinderGeometry args={[0.085, 0.065, 0.09, 12, 1, true]} />
      </mesh>
      <mesh material={wireMat} position-y={-0.045}>
        <circleGeometry args={[0.065, 12]} />
      </mesh>
      <mesh material={rimMat} position-y={0.045} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.085, 0.007, 8, 20]} />
      </mesh>
      {/* handle */}
      <mesh material={rimMat} position-y={0.06} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.07, 0.005, 6, 16, Math.PI]} />
      </mesh>
      {/* your haul, visibly in the basket */}
      {minis.map((m) => {
        const visual = getCardVisual(m.id);
        return (
          <group key={m.id} position={[m.x, 0.03, m.z]} rotation={m.rot} scale={0.85}>
            <mesh geometry={visual.frontGeometry} material={visual.frontMaterial} position-z={CARD_SIZE.t / 2} />
            <mesh geometry={visual.backGeometry} material={visual.backMaterial} position-z={-CARD_SIZE.t / 2} rotation-y={Math.PI} />
          </group>
        );
      })}
      {overflow > 0 && (
        <Html position={[0, 0.12, 0]} center distanceFactor={1.2} style={{ pointerEvents: 'none' }}>
          <div className="basket-overflow">+{overflow}</div>
        </Html>
      )}
    </group>
  );
}
