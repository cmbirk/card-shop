import { useState } from 'react';
import { useCursor } from '@react-three/drei';
import { BACK_OFFICE_DOOR } from '@shared/data/shopLayout';
import { MAT, makeLabelMaterial } from './materials';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useNavStore } from '../stores/navStore';
import { useDialogueStore } from '../stores/dialogueStore';

const STAFF_SIGN = makeLabelMaterial('STAFF ONLY', { bg: '#efe6c8', fg: '#3b2a1a', size: 56 });

/**
 * The door to the back office, on the north wall beside the counter.
 * Admins click it to open the back-office panel; everyone else gets waved off by Chris.
 */
export function BackOfficeDoor() {
  const [hovered, setHovered] = useState(false);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  useCursor(hovered);
  const { width: w, height: h } = BACK_OFFICE_DOOR;
  const [x, , z] = BACK_OFFICE_DOOR.position;

  return (
    <group
      position={[x, h / 2, z + 0.03]}
      onClick={(e) => {
        if (useNavStore.getState().currentStation === 'outside') return;
        e.stopPropagation();
        setHovered(false);
        if (useAuthStore.getState().isAdmin) {
          useUIStore.getState().setAdminOpen(true);
          return;
        }
        const dlg = useDialogueStore.getState();
        dlg.gesture$('shrug');
        dlg.say("Ah — that's the back office, staff only I'm afraid. Nothing but boxes and a very old computer back there anyway.");
      }}
      onPointerOver={(e) => {
        if (useNavStore.getState().currentStation === 'outside') return;
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* frame */}
      <mesh material={MAT.dark} position={[0, 0, -0.01]}>
        <boxGeometry args={[w + 0.12, h + 0.08, 0.04]} />
      </mesh>
      {/* door slab */}
      <mesh material={MAT.walnut}>
        <boxGeometry args={[w, h, 0.06]} />
      </mesh>
      {/* recessed panels */}
      {[0.55, -0.4].map((py) => (
        <mesh key={py} material={MAT.dark} position={[0, py, 0.031]}>
          <planeGeometry args={[w * 0.66, py > 0 ? 0.7 : 0.9]} />
        </mesh>
      ))}
      {/* sign */}
      <mesh material={STAFF_SIGN} position={[0, 0.55, 0.036]}>
        <planeGeometry args={[0.5, 0.14]} />
      </mesh>
      {/* handle */}
      <mesh material={MAT.dark} position={[w / 2 - 0.1, -0.05, 0.05]}>
        <sphereGeometry args={[0.03, 12, 12]} />
      </mesh>
      {/* hover highlight — gold for staff, faint for everyone else */}
      {hovered && (
        <mesh position={[0, 0, 0.04]} raycast={() => null}>
          <planeGeometry args={[w + 0.06, h + 0.06]} />
          <meshBasicMaterial color={isAdmin ? '#ffd97a' : '#ffffff'} transparent opacity={isAdmin ? 0.25 : 0.08} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
