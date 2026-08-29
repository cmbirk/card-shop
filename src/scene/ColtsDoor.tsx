import { useState } from 'react';
import { useCursor } from '@react-three/drei';
import { ANNEX, ANNEX_DOOR } from '@shared/data/shopLayout';
import { useNavStore } from '../stores/navStore';

/**
 * The open doorway into the Colts Room. Click it from the shop to walk up to it;
 * click again from the threshold to step inside. Invisible plane filling the opening.
 */
export function ColtsDoor() {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const ok = () => {
    const nav = useNavStore.getState();
    return nav.mode === 'station' && nav.currentStation !== 'outside';
  };
  return (
    <group position={[ANNEX.xMax, ANNEX_DOOR.height / 2, ANNEX_DOOR.z]} rotation-y={Math.PI / 2}>
      <mesh
        onClick={(e) => {
          if (!ok()) return;
          e.stopPropagation();
          setHovered(false);
          const nav = useNavStore.getState();
          nav.goTo(nav.currentStation === 'colts-door' ? 'colts-case' : nav.currentStation === 'colts-case' ? 'colts-door' : 'colts-door');
        }}
        onPointerOver={(e) => {
          if (!ok()) return;
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[ANNEX_DOOR.width, ANNEX_DOOR.height]} />
        <meshBasicMaterial visible={false} side={2} />
      </mesh>
      {hovered && (
        <mesh raycast={() => null}>
          <planeGeometry args={[ANNEX_DOOR.width + 0.04, ANNEX_DOOR.height + 0.04]} />
          <meshBasicMaterial color="#9fc1ff" transparent opacity={0.12} depthWrite={false} side={2} />
        </mesh>
      )}
    </group>
  );
}
