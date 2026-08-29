import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useDialogueStore, type MelGesture } from '../stores/dialogueStore';
import { FEEL } from '../feel';

const MODEL_URL = '/models/shopkeeper.glb';

/** Clip names as exported from Meshy (see public/models/shopkeeper.glb). */
const CLIP = {
  idle: 'Idle_02',
  talk: 'Talk_with_Hands_Open',
  wave: 'Wave_One_Hand',
  nod: 'Agree_Gesture',
  shrug: 'Shrug',
  checkout: 'Checkout_Gesture',
} as const;

const GESTURE_CLIP: Record<MelGesture, string> = {
  wave: CLIP.wave,
  nod: CLIP.nod,
  shrug: CLIP.shrug,
  checkout: CLIP.checkout,
};

const FADE = 0.35;

/** Mel — rigged GLB shopkeeper behind the counter. Idles, talks while a reply streams, head tracks the player. */
export function Shopkeeper() {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions, mixer } = useAnimations(animations, group);
  const isStreaming = useDialogueStore((s) => s.isStreaming);
  const messages = useDialogueStore((s) => s.messages);
  const isOpen = useDialogueStore((s) => s.isOpen);
  const gesture = useDialogueStore((s) => s.gesture);
  const gestureId = useDialogueStore((s) => s.gestureId);
  const [bubble, setBubble] = useState<string | null>(null);
  const current = useRef<THREE.AnimationAction | null>(null);
  const oneShot = useRef<THREE.AnimationAction | null>(null);
  const headBone = useRef<THREE.Bone | null>(null);
  const headRest = useRef(new THREE.Quaternion());
  const look = useRef({ yaw: 0, pitch: 0 });

  // shadows, no frustum-culling on the skinned mesh (its bounds don't follow the animation), find the head bone
  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
      }
      if ((o as THREE.Bone).isBone && o.name === 'Head') headBone.current = o as THREE.Bone;
    });
  }, [scene]);

  // crossfade helper — one looping "base" action at a time
  const play = useMemo(
    () => (name: string, loop = true) => {
      const next = actions[name];
      if (!next) return null;
      const prev = current.current;
      if (prev === next) return next;
      next.reset();
      next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      next.clampWhenFinished = !loop;
      next.enabled = true;
      if (prev) {
        next.crossFadeFrom(prev, FADE, true);
      }
      next.play();
      current.current = next;
      return next;
    },
    [actions],
  );

  // base state: talk while a reply streams, otherwise idle (unless a one-shot gesture is running)
  useEffect(() => {
    if (oneShot.current) return;
    play(isStreaming ? CLIP.talk : CLIP.idle);
  }, [isStreaming, play]);

  // one-shot gestures from the dialogue store, then back to the base state
  useEffect(() => {
    if (!gesture || gestureId === 0) return;
    const name = GESTURE_CLIP[gesture];
    const action = play(name, false);
    if (!action) return;
    oneShot.current = action;
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action !== action) return;
      oneShot.current = null;
      play(useDialogueStore.getState().isStreaming ? CLIP.talk : CLIP.idle);
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [gesture, gestureId, play, mixer]);

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

  // lazy head look-at, layered on top of the animation (runs after the mixer's frame update)
  useFrame((state, dt) => {
    const head = headBone.current;
    if (!head) return;
    const cam = state.camera.position;
    const dx = cam.x - 0; // shopkeeper world pos (0, _, -3.7)
    const dz = cam.z - -3.7;
    let yaw = Math.atan2(dx, dz); // faces +Z at rest
    const dy = cam.y - 1.55;
    let pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    const interested = Math.abs(yaw) < 1.05;
    if (!interested) {
      yaw = 0.3; // back to sorting cards
      pitch = 0.35;
    }
    const L = look.current;
    L.yaw = THREE.MathUtils.damp(L.yaw, THREE.MathUtils.clamp(yaw, -0.9, 0.9), FEEL.headLookLambda, dt);
    L.pitch = THREE.MathUtils.damp(L.pitch, THREE.MathUtils.clamp(pitch, -0.35, 0.35), FEEL.headLookLambda, dt);
    // additive: the mixer has already written this frame's pose into head.quaternion
    headRest.current.setFromEuler(new THREE.Euler(L.pitch, L.yaw, 0, 'YXZ'));
    head.quaternion.multiply(headRest.current);
  });

  return (
    <group position={[0, 0, -3.7]}>
      {bubble && (
        <Html position={[0, 2.1, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="mel-bubble">{bubble}</div>
        </Html>
      )}
      {isStreaming && (
        <Html position={[0, 1.95, 0]} center distanceFactor={2.5} style={{ pointerEvents: 'none' }}>
          <div className="speech-dots">
            <span />
            <span />
            <span />
          </div>
        </Html>
      )}
      <group ref={group}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
