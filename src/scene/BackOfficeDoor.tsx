import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCursor } from '@react-three/drei';
import { BACK_OFFICE_DOOR } from '@shared/data/shopLayout';
import { MAT, makeLabelMaterial } from './materials';
import { useAuthStore } from '../stores/authStore';
import { useNavStore } from '../stores/navStore';
import { useDialogueStore } from '../stores/dialogueStore';
import { FEEL } from '../feel';

const STAFF_SIGN = makeLabelMaterial('STAFF ONLY', { bg: '#efe6c8', fg: '#3b2a1a', size: 56 });

/**
 * The door to the back office, on the north wall beside the counter. Admins walk up to it and
 * through (it swings open); everyone else gets waved off by Chris. The room behind it has the desk
 * computer that opens the admin panel.
 */
export function BackOfficeDoor() {
  const [hovered, setHovered] = useState(false);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  useCursor(hovered);
  const { width: w, height: h } = BACK_OFFICE_DOOR;
  const [x, , z] = BACK_OFFICE_DOOR.position;
  const hinge = useRef<THREE.Group>(null!);

  // swings open whenever the customer is heading into / standing in the office
  useFrame((_, dt) => {
    if (!hinge.current) return;
    const nav = useNavStore.getState();
    const open = nav.currentStation === 'office' || nav.targetStation === 'office';
    hinge.current.rotation.y = THREE.MathUtils.damp(hinge.current.rotation.y, open ? FEEL.doorOpenAngle : 0, FEEL.doorSwingLambda, dt);
  });

  return (
    <group
      position={[x, h / 2, z + 0.03]}
      onClick={(e) => {
        const nav = useNavStore.getState();
        if (nav.currentStation === 'outside') return;
        e.stopPropagation();
        setHovered(false);
        if (useAuthStore.getState().isAdmin) {
          // walk up to it, then through; from inside, back out
          nav.goTo(nav.currentStation === 'office' ? 'office-door' : nav.currentStation === 'office-door' ? 'office' : 'office-door');
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
      {/* frame: two jambs + a header around the opening (never a plate — the door swings open) */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={MAT.dark} position={[sx * (w / 2 + 0.03), 0, -0.01]}>
          <boxGeometry args={[0.06, h + 0.08, 0.1]} />
        </mesh>
      ))}
      <mesh material={MAT.dark} position={[0, h / 2 + 0.04, -0.01]}>
        <boxGeometry args={[w + 0.12, 0.08, 0.1]} />
      </mesh>
      {/* everything below the frame hangs on a hinge at the left jamb */}
      <group ref={hinge} position={[-w / 2, 0, 0]}>
      <group position={[w / 2, 0, 0]}>
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
      </group>
    </group>
  );
}
