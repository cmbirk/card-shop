import { useMemo, useState } from 'react';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { MAT, makeLabelMaterial } from '../materials';
import { SHOP_NAME } from '@shared/launch';
import { useAuthStore } from '../../stores/authStore';
import { useNavStore } from '../../stores/navStore';
import { useUIStore } from '../../stores/uiStore';

/** The monitor's screen: a canvas with a login prompt and faint scanlines. Emissive so it glows. */
function screenMaterial(): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0b1d16';
  ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = '#9fdca8';
  ctx.font = 'bold 30px ui-monospace, Menlo, monospace';
  ctx.fillText(`${SHOP_NAME} BACK OFFICE v2.0`, 40, 80);
  ctx.font = '22px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#7fc38a';
  ctx.fillText('inventory · import · users', 40, 130);
  ctx.fillText('> click to log in_', 40, 220);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < 384; y += 4) ctx.fillRect(0, y, 512, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, emissive: '#3a5f47', emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.4 });
}

/**
 * The back-office desk: an old beige computer on a walnut desk. Clicking the monitor opens the
 * admin panel — only for admins standing in the office (the door gate already keeps others out).
 */
export function Desk({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const mats = useMemo(
    () => ({
      screen: screenMaterial(),
      beige: new THREE.MeshStandardMaterial({ color: '#d9cfb4', roughness: 0.7 }),
      mug: new THREE.MeshStandardMaterial({ color: '#2e5e4e', roughness: 0.5 }),
    }),
    [],
  );
  const canUse = () => {
    const nav = useNavStore.getState();
    return useAuthStore.getState().isAdmin && nav.mode === 'station' && nav.currentStation === 'office';
  };

  return (
    <group position={position} rotation-y={rotationY}>
      {/* desk: top + two pedestals */}
      <mesh material={MAT.walnut} position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[1.5, 0.05, 0.7]} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} material={MAT.walnut} position={[x, 0.36, 0]} castShadow>
          <boxGeometry args={[0.28, 0.72, 0.64]} />
        </mesh>
      ))}
      {/* chair */}
      <group position={[0, 0, 0.7]}>
        <mesh material={MAT.dark} position={[0, 0.45, 0]}>
          <boxGeometry args={[0.48, 0.06, 0.48]} />
        </mesh>
        <mesh material={MAT.dark} position={[0, 0.75, 0.22]}>
          <boxGeometry args={[0.46, 0.55, 0.05]} />
        </mesh>
        <mesh material={MAT.dark} position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.44, 8]} />
        </mesh>
        <mesh material={MAT.dark} position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.03, 12]} />
        </mesh>
      </group>
      {/* the computer: a chunky CRT + keyboard */}
      <group position={[0, 0.765, -0.12]}>
        <mesh material={mats.beige} position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.46, 0.4, 0.42]} />
        </mesh>
        <mesh material={MAT.dark} position={[0, 0.2, 0.211]}>
          <boxGeometry args={[0.4, 0.32, 0.01]} />
        </mesh>
        <mesh
          material={mats.screen}
          position={[0, 0.2, 0.218]}
          onClick={(e) => {
            if (!canUse()) return;
            e.stopPropagation();
            setHovered(false);
            useUIStore.getState().setAdminOpen(true);
          }}
          onPointerOver={(e) => {
            if (!canUse()) return;
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          <planeGeometry args={[0.36, 0.27]} />
        </mesh>
        {hovered && (
          <mesh position={[0, 0.2, 0.222]} raycast={() => null}>
            <planeGeometry args={[0.4, 0.31]} />
            <meshBasicMaterial color="#ffd97a" transparent opacity={0.18} depthWrite={false} />
          </mesh>
        )}
        <mesh material={mats.beige} position={[0, 0.012, 0.34]}>
          <boxGeometry args={[0.42, 0.025, 0.15]} />
        </mesh>
      </group>
      {/* coffee mug + a slab waiting to be listed */}
      <mesh material={mats.mug} position={[0.55, 0.81, 0.15]}>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 16]} />
      </mesh>
      <mesh material={MAT.cream} position={[-0.5, 0.775, 0.1]} rotation-y={0.3}>
        <boxGeometry args={[0.09, 0.008, 0.13]} />
      </mesh>
      <mesh material={makeLabelMaterial('TO LIST', { bg: '#efe6c8', fg: '#3b2a1a', size: 60 })} position={[-0.5, 0.78, 0.1]} rotation-x={-Math.PI / 2} rotation-z={0.3}>
        <planeGeometry args={[0.08, 0.03]} />
      </mesh>
    </group>
  );
}
