import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CARD_SIZE } from '@shared/data/shopLayout';
import { useBasketStore } from '../stores/basketStore';
import { useUIStore } from '../stores/uiStore';
import { inventoryById } from '../systems/inventory';
import { getCardVisual } from './cards/atlas';
import { mulberry32, spread } from '../systems/rng';

// A woven shopping basket rigidly pinned to the bottom-right of the view
// (no damped follow, so it never floats) and tilted toward the viewer so
// you can see what's inside. Lives in the main scene so it composes with
// postprocessing (a separate HUD pass would be painted over by the composer).

function makeWeaveTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(0, 0, 128, 128);
  const s = 16;
  for (let y = 0; y < 128; y += s) {
    for (let x = 0; x < 128; x += s) {
      const horiz = ((x / s + y / s) & 1) === 0;
      ctx.fillStyle = horiz ? '#9c6a3e' : '#79492a';
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.fillStyle = 'rgba(255,225,180,0.18)';
      if (horiz) ctx.fillRect(x + 1, y + 2, s - 2, 3);
      else ctx.fillRect(x + 2, y + 1, 3, s - 2);
      ctx.fillStyle = 'rgba(40,20,8,0.35)';
      ctx.fillRect(x, y, s, 1);
      ctx.fillRect(x, y, 1, s);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  tex.anisotropy = 4;
  return tex;
}

const rimMat = new THREE.MeshStandardMaterial({ color: '#5c3a20', roughness: 0.55, metalness: 0.05 });

function BasketMesh() {
  const items = useBasketStore((s) => s.items);
  const weave = useMemo(() => makeWeaveTexture(), []);
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: weave, roughness: 0.8, side: THREE.DoubleSide }),
    [weave],
  );

  const visible = items.slice(0, 7);
  const overflow = items.length - visible.length;

  // cards stand upright, fanned, faces toward the viewer
  const minis = useMemo(
    () =>
      visible.map((id, i) => {
        const rand = mulberry32((inventoryById.get(id)?.seed ?? i) + 3);
        const t = visible.length === 1 ? 0 : i / (visible.length - 1) - 0.5;
        return {
          id,
          x: t * 0.055,
          y: 0.04 - Math.abs(t) * 0.004, // stand up out of the basket
          z: -0.014 + i * 0.004,
          // lean back slightly in the tipped-toward-viewer basket so faces show, fanned
          rot: [-0.18 + spread(rand) * 0.04, t * 0.4 + spread(rand) * 0.05, spread(rand) * 0.02] as [number, number, number],
        };
      }),
    [visible],
  );

  return (
    <group>
      {/* tapered woven body (open top) */}
      <mesh material={bodyMat}>
        <cylinderGeometry args={[0.048, 0.034, 0.045, 24, 1, true]} />
      </mesh>
      <mesh material={bodyMat} position-y={-0.0225} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.034, 24]} />
      </mesh>
      {/* rolled rim */}
      <mesh material={rimMat} position-y={0.0225} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.048, 0.005, 10, 28]} />
      </mesh>
      {/* two folding side handles */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={rimMat} position={[s * 0.038, 0.038, 0]} rotation-y={Math.PI / 2}>
          <torusGeometry args={[0.019, 0.0028, 8, 18, Math.PI]} />
        </mesh>
      ))}

      {/* contents, standing up */}
      {minis.map((m) => {
        const visual = getCardVisual(m.id);
        return (
          <group key={m.id} position={[m.x, m.y, m.z]} rotation={m.rot} scale={0.5}>
            <mesh geometry={visual.frontGeometry} material={visual.frontMaterial} position-z={CARD_SIZE.t / 2} />
            <mesh geometry={visual.backGeometry} material={visual.backMaterial} position-z={-CARD_SIZE.t / 2} rotation-y={Math.PI} />
          </group>
        );
      })}
      {overflow > 0 && (
        <Html position={[0.045, 0.05, 0]} center distanceFactor={0.35} style={{ pointerEvents: 'none' }}>
          <div className="basket-overflow">+{overflow}</div>
        </Html>
      )}
    </group>
  );
}

const _local = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _rot = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scl = new THREE.Vector3();
const DIST = 0.5; // distance in front of the camera
const MARGIN_X = 0.13;
const MARGIN_Y = 0.17; // extra so it clears the basket pill

/** Rigidly pins the basket to the bottom-right of the camera frustum, tilted forward. */
export function Basket3D() {
  const group = useRef<THREE.Group>(null!);
  const { camera, size } = useThree();
  const tantrumCount = useUIStore((s) => s.tantrumCount);
  const anim = useRef({ seen: 0, drop: 0 });

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const cam = camera as THREE.PerspectiveCamera;
    // bottom-right corner of the frustum at DIST
    const halfH = DIST * Math.tan((cam.fov * Math.PI) / 360);
    const halfW = halfH * (size.width / size.height);

    const a = anim.current;
    if (tantrumCount !== a.seen) {
      a.seen = tantrumCount;
      a.drop = 1;
    }
    if (a.drop > 0 && useBasketStore.getState().items.length > 0) a.drop = Math.min(a.drop + dt * 1.5, 2);
    else if (a.drop > 0) a.drop = Math.max(a.drop - dt * 2, 0);
    const dropY = a.drop > 0 ? -Math.sin(Math.min(a.drop, 1) * Math.PI * 0.5) * (halfH * 2.4) : 0;
    const spin = a.drop * 3;

    _pos.set(halfW - MARGIN_X, -halfH + MARGIN_Y + dropY, -DIST);
    _euler.set(0.5, -0.32, spin); // +X tips the opening toward the viewer to show contents
    _rot.setFromEuler(_euler);
    _scl.setScalar(0.82);
    _local.compose(_pos, _rot, _scl);
    g.matrixAutoUpdate = false;
    g.matrix.multiplyMatrices(cam.matrixWorld, _local);
    g.matrixWorldNeedsUpdate = true;
  });

  return (
    <group ref={group}>
      <BasketMesh />
    </group>
  );
}
