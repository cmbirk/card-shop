import { useState } from 'react';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { ROOM } from '@shared/data/shopLayout';
import { MAT, makeLabelMaterial } from './materials';
import { PBR } from './pbr';
import { useNavStore } from '../stores/navStore';

const brickMat = PBR.brick;
const trimMat = new THREE.MeshStandardMaterial({ color: '#24483c', roughness: 0.9 });
const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#5a5a60', roughness: 1 });
const glassGlowMat = new THREE.MeshBasicMaterial({ color: '#ffdfae' });

function block(e: { stopPropagation: () => void }) {
  // facade must swallow raycasts so window clicks don't reach shelves inside
  e.stopPropagation();
}

/** Exterior storefront — what you see on page load. Click the door to come in. */
export function Facade() {
  const [doorHovered, setDoorHovered] = useState(false);
  useCursor(doorHovered);
  const D = ROOM.depth;

  return (
    <group position={[0, 0, D / 2 + 0.02]}>
      {/* brick face */}
      <mesh material={brickMat} position={[0, ROOM.height / 2 + 0.25, 0]} onClick={block}>
        <planeGeometry args={[ROOM.width + 0.6, ROOM.height + 0.5]} />
      </mesh>
      {/* storefront band */}
      <mesh material={trimMat} position={[0, 0.5, 0.01]} onClick={block}>
        <planeGeometry args={[ROOM.width + 0.6, 1]} />
      </mesh>
      {/* parapet cap */}
      <mesh material={MAT.walnut} position={[0, ROOM.height + 0.55, 0.05]}>
        <boxGeometry args={[ROOM.width + 0.8, 0.16, 0.2]} />
      </mesh>
      {/* GEM sign */}
      <mesh material={makeLabelMaterial('GEM', { bg: '#1f3d33', fg: '#ffd97a', size: 92 })} position={[0, 2.72, 0.06]}>
        <planeGeometry args={[2.6, 0.65]} />
      </mesh>
      <mesh material={makeLabelMaterial('Cards · Collectibles', { bg: '#1f3d33', fg: '#f2e8d5', size: 34 })} position={[0, 2.28, 0.06]}>
        <planeGeometry args={[2.2, 0.28]} />
      </mesh>

      {/* windows with warm glow + marketing posters */}
      {[-3, 3].map((x, i) => (
        <group key={x} position={[x, 1.8, 0.02]}>
          <mesh material={glassGlowMat} onClick={block}>
            <planeGeometry args={[2.1, 1.5]} />
          </mesh>
          <mesh material={MAT.walnut} position={[0, 0, -0.005]}>
            <planeGeometry args={[2.3, 1.7]} />
          </mesh>
          <mesh
            material={makeLabelMaterial(i === 0 ? 'Buy · Sell · Trade' : 'We Buy Collections', {
              bg: '#a63d40',
              fg: '#f2e8d5',
              size: 30,
            })}
            position={[i === 0 ? -0.25 : 0.25, 0.25, 0.02]}
            rotation-z={i === 0 ? 0.04 : -0.04}
          >
            <planeGeometry args={[1.3, 0.32]} />
          </mesh>
          <mesh
            material={makeLabelMaterial(i === 0 ? 'Graded Slabs Inside' : 'Rookie Cards Galore', {
              bg: '#efe6c8',
              fg: '#3b2a1a',
              size: 28,
            })}
            position={[i === 0 ? 0.35 : -0.35, -0.35, 0.02]}
            rotation-z={i === 0 ? -0.05 : 0.03}
          >
            <planeGeometry args={[1.15, 0.28]} />
          </mesh>
          {/* awning */}
          <mesh material={trimMat} position={[0, 0.95, 0.3]} rotation-x={0.5}>
            <boxGeometry args={[2.4, 0.06, 0.75]} />
          </mesh>
        </group>
      ))}

      {/* front door — the way in */}
      <group
        position={[0, 1.1, 0.03]}
        onClick={(e) => {
          e.stopPropagation();
          setDoorHovered(false);
          useNavStore.getState().goTo('entry');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (useNavStore.getState().currentStation === 'outside') setDoorHovered(true);
        }}
        onPointerOut={() => setDoorHovered(false)}
      >
        <mesh material={MAT.walnut}>
          <boxGeometry args={[1.1, 2.2, 0.08]} />
        </mesh>
        {/* door window */}
        <mesh material={glassGlowMat} position={[0, 0.45, 0.045]}>
          <planeGeometry args={[0.7, 0.8]} />
        </mesh>
        <mesh material={makeLabelMaterial('OPEN', { bg: '#a63d40', size: 72 })} position={[0, 0.42, 0.05]} rotation-z={-0.06}>
          <planeGeometry args={[0.42, 0.18]} />
        </mesh>
        <mesh material={makeLabelMaterial('Come on in!', { bg: '#efe6c8', fg: '#3b2a1a', size: 48 })} position={[0, -0.15, 0.05]}>
          <planeGeometry args={[0.6, 0.14]} />
        </mesh>
        {/* handle */}
        <mesh material={MAT.dark} position={[0.42, -0.05, 0.06]}>
          <sphereGeometry args={[0.035, 12, 12]} />
        </mesh>
        {/* hover highlight frame */}
        {doorHovered && (
          <mesh position={[0, 0, 0.046]}>
            <planeGeometry args={[1.16, 2.26]} />
            <meshBasicMaterial color="#ffd97a" transparent opacity={0.25} />
          </mesh>
        )}
      </group>

      {/* sidewalk + doormat */}
      <mesh material={sidewalkMat} position={[0, 0.002, 2.2]} rotation-x={-Math.PI / 2} onClick={block}>
        <planeGeometry args={[ROOM.width + 4, 4.5]} />
      </mesh>
      <mesh material={MAT.green} position={[0, 0.006, 0.45]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.3, 0.7]} />
      </mesh>

      {/* warm light over the door */}
      <pointLight position={[0, 2.6, 1]} intensity={1.6} distance={6} color="#ffd9a0" />
    </group>
  );
}
