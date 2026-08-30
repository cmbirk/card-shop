import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { shopLayout } from '@shared/data/shopLayout';
import type { Station } from '@shared/types';
import { useNavStore } from '../stores/navStore';
import { useDialogueStore } from '../stores/dialogueStore';

function WaypointDisc({ station }: { station: Station }) {
  const ref = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const current = useNavStore((s) => s.currentStation);
  const mode = useNavStore((s) => s.mode);
  const dialogueOpen = useDialogueStore((s) => s.isOpen);

  const visible = (mode === 'station' || mode === 'freewalk') && !dialogueOpen && station.id !== current && current !== 'outside';

  useFrame((state, dt) => {
    if (!ref.current) return;
    const pulse = hovered ? 1.15 + Math.sin(state.clock.elapsedTime * 6) * 0.05 : 1;
    ref.current.scale.x = THREE.MathUtils.damp(ref.current.scale.x, pulse, 12, dt);
    ref.current.scale.y = ref.current.scale.x;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, visible ? (hovered ? 0.85 : 0.45) : 0, 10, dt);
  });

  return (
    <group position={[station.position[0], 0.015, station.position[2]]} rotation-x={-Math.PI / 2}>
      {/* generous invisible hit target — the visual disc is nearly edge-on from eye height */}
      <mesh
        onClick={(e) => {
          if (!visible) return;
          e.stopPropagation();
          setHovered(false);
          useNavStore.getState().goTo(station.id);
        }}
        onPointerOver={(e) => {
          if (!visible) return;
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh ref={ref}>
        <ringGeometry args={[0.14, 0.22, 32]} />
        <meshBasicMaterial color="#7fd8a8" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Waypoints() {
  return (
    <group>
      {shopLayout.stations
        .filter((s) => s.id !== 'outside')
        .map((s) => (
          <WaypointDisc key={s.id} station={s} />
        ))}
    </group>
  );
}
