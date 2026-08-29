import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { MAT } from './materials';
import { useDialogueStore } from '../stores/dialogueStore';
import { FEEL } from '../feel';

const apronMat = new THREE.MeshStandardMaterial({ color: '#2e5e4e', roughness: 0.95 });
const capMat = new THREE.MeshStandardMaterial({ color: '#1d3557', roughness: 0.9 });
const eyeMat = new THREE.MeshStandardMaterial({ color: '#191919', roughness: 0.4 });
const glassesMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.4, metalness: 0.5 });

/** Mel — primitives-based shopkeeper behind the counter. Head tracks the player, lazily. */
export function Shopkeeper() {
  const head = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const eyeL = useRef<THREE.Mesh>(null!);
  const eyeR = useRef<THREE.Mesh>(null!);
  const mouth = useRef<THREE.Mesh>(null!);
  const blink = useRef({ next: 3, until: 0 });
  const isStreaming = useDialogueStore((s) => s.isStreaming);
  const messages = useDialogueStore((s) => s.messages);
  const isOpen = useDialogueStore((s) => s.isOpen);
  const [bubble, setBubble] = useState<string | null>(null);

  // in-world speech bubble for Mel's lines while the chat panel is closed (e.g. the door greeting)
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && !isOpen) {
      setBubble(last.content);
      const t = setTimeout(() => setBubble(null), 7000);
      return () => clearTimeout(t);
    }
    setBubble(null);
  }, [messages, isOpen]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // idle: breathe + bob
    if (body.current) {
      body.current.position.y = Math.sin(t * 1.2) * 0.01;
      const b = 1 + Math.sin(t * 1.2 + 1) * 0.008;
      body.current.scale.x = b;
      body.current.scale.z = b;
    }
    // lazy head look-at, clamped — beyond that he loses interest
    if (head.current) {
      const cam = state.camera.position;
      const dx = cam.x - 0; // shopkeeper world pos (0, _, -3.7)
      const dz = cam.z - -3.7;
      let yaw = Math.atan2(dx, dz); // faces +Z at rest
      const dy = cam.y - 1.45;
      let pitch = -Math.atan2(dy, Math.hypot(dx, dz));
      const interested = Math.abs(yaw) < 1.05;
      if (!interested) {
        yaw = 0.3; // back to sorting cards
        pitch = 0.35;
      }
      head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, yaw, FEEL.headLookLambda, dt);
      head.current.rotation.x = THREE.MathUtils.damp(
        head.current.rotation.x,
        THREE.MathUtils.clamp(pitch, -0.35, 0.35),
        FEEL.headLookLambda,
        dt,
      );
    }
    // blink
    const bl = blink.current;
    if (t > bl.next) {
      bl.until = t + 0.12;
      bl.next = t + 3 + Math.random() * 3;
    }
    const closed = t < bl.until;
    if (eyeL.current) eyeL.current.scale.y = THREE.MathUtils.damp(eyeL.current.scale.y, closed ? 0.1 : 1, 30, dt);
    if (eyeR.current) eyeR.current.scale.y = eyeL.current.scale.y;
    // crude talking mouth while the reply streams
    if (mouth.current) {
      mouth.current.scale.y = isStreaming ? 0.6 + Math.abs(Math.sin(t * 14)) * 0.9 : 0.35;
    }
  });

  return (
    <group position={[0, 0, -3.7]}>
      {bubble && (
        <Html position={[0, 2.2, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="mel-bubble">{bubble}</div>
        </Html>
      )}
      <group ref={body}>
        {/* flannel body */}
        <mesh material={MAT.flannel} position={[0, 0.85, 0]} castShadow>
          <capsuleGeometry args={[0.3, 0.7, 8, 16]} />
        </mesh>
        {/* apron */}
        <mesh material={apronMat} position={[0, 0.75, 0.14]}>
          <cylinderGeometry args={[0.26, 0.3, 0.68, 16, 1, true, -Math.PI / 3, (Math.PI * 2) / 3]} />
        </mesh>
        {/* arms resting on the counter, hands and all */}
        <mesh material={MAT.flannel} position={[-0.36, 1, 0.12]} rotation={[0.5, 0, 0.6]}>
          <capsuleGeometry args={[0.07, 0.4, 6, 10]} />
        </mesh>
        <mesh material={MAT.flannel} position={[0.36, 1, 0.12]} rotation={[0.5, 0, -0.6]}>
          <capsuleGeometry args={[0.07, 0.4, 6, 10]} />
        </mesh>
        <mesh material={MAT.skin} position={[-0.46, 0.94, 0.28]}>
          <sphereGeometry args={[0.06, 12, 10]} />
        </mesh>
        <mesh material={MAT.skin} position={[0.46, 0.94, 0.28]}>
          <sphereGeometry args={[0.06, 12, 10]} />
        </mesh>
      </group>
      {/* head */}
      <group ref={head} position={[0, 1.45, 0]}>
        <mesh material={MAT.skin} castShadow>
          <sphereGeometry args={[0.22, 24, 20]} />
        </mesh>
        {/* eyes */}
        <mesh ref={eyeL} material={eyeMat} position={[-0.08, 0.03, 0.19]}>
          <sphereGeometry args={[0.025, 10, 10]} />
        </mesh>
        <mesh ref={eyeR} material={eyeMat} position={[0.08, 0.03, 0.19]}>
          <sphereGeometry args={[0.025, 10, 10]} />
        </mesh>
        {/* round glasses — knows the hobby (torus faces +Z by default) */}
        <mesh material={glassesMat} position={[-0.08, 0.03, 0.21]}>
          <torusGeometry args={[0.05, 0.006, 8, 20]} />
        </mesh>
        <mesh material={glassesMat} position={[0.08, 0.03, 0.21]}>
          <torusGeometry args={[0.05, 0.006, 8, 20]} />
        </mesh>
        {/* nose + mustache + ears */}
        <mesh material={MAT.skin} position={[0, -0.02, 0.215]}>
          <sphereGeometry args={[0.035, 12, 10]} />
        </mesh>
        <mesh material={eyeMat} position={[0, -0.065, 0.205]} rotation-x={0.1}>
          <boxGeometry args={[0.09, 0.018, 0.02]} />
        </mesh>
        <mesh material={MAT.skin} position={[-0.21, 0, 0.02]}>
          <sphereGeometry args={[0.04, 10, 8]} />
        </mesh>
        <mesh material={MAT.skin} position={[0.21, 0, 0.02]}>
          <sphereGeometry args={[0.04, 10, 8]} />
        </mesh>
        {/* mouth */}
        <mesh ref={mouth} material={eyeMat} position={[0, -0.1, 0.2]}>
          <boxGeometry args={[0.06, 0.018, 0.01]} />
        </mesh>
        {/* cap — brim up off the brow */}
        <mesh material={capMat} position={[0, 0.12, 0]}>
          <sphereGeometry args={[0.225, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
        </mesh>
        <mesh material={capMat} position={[0, 0.165, 0.21]} rotation-x={-0.45}>
          <cylinderGeometry args={[0.12, 0.15, 0.02, 16, 1, false, -Math.PI / 2, Math.PI]} />
        </mesh>
        {/* speech indicator while the reply streams */}
        {isStreaming && (
          <Html position={[0, 0.45, 0]} center distanceFactor={2.5} style={{ pointerEvents: 'none' }}>
            <div className="speech-dots">
              <span />
              <span />
              <span />
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}
