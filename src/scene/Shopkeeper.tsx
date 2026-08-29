import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useDialogueStore, type MelGesture } from '../stores/dialogueStore';
import { useShopkeeperStore, SHOPKEEPER_HOME } from '../stores/shopkeeperStore';
import { FEEL, bubbleHoldSeconds } from '../feel';

const MODEL_URL = '/models/shopkeeper.glb';

/** Clip names as exported from Meshy (see public/models/shopkeeper.glb). */
const CLIP = {
  idle: 'Idle_02',
  talk: 'Talk_with_Hands_Open',
  wave: 'Wave_One_Hand',
  nod: 'Agree_Gesture',
  shrug: 'Shrug',
  checkout: 'Checkout_Gesture',
  walk: 'Walking',
} as const;

const GESTURE_CLIP: Record<MelGesture, string> = {
  wave: CLIP.wave,
  nod: CLIP.nod,
  shrug: CLIP.shrug,
  checkout: CLIP.checkout,
};

const FADE = 0.35;
const _euler = new THREE.Euler(0, 0, 0, 'YXZ'); // scratch — no per-frame allocation

/**
 * Chris — rigged GLB shopkeeper. Idles behind the counter, talks while a reply streams,
 * head-tracks the player, and walks out to a customer who holds a card up (shopkeeperStore).
 */
export function Shopkeeper() {
  const root = useRef<THREE.Group>(null!); // world position/yaw — moved per frame, never via React state
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions, mixer } = useAnimations(animations, group);
  const isStreaming = useDialogueStore((s) => s.isStreaming);
  const messages = useDialogueStore((s) => s.messages);
  const isOpen = useDialogueStore((s) => s.isOpen);
  const gesture = useDialogueStore((s) => s.gesture);
  const gestureId = useDialogueStore((s) => s.gestureId);
  const streamingText = useDialogueStore((s) => s.streamingText);
  const pose = useShopkeeperStore((s) => s.pose);
  const [bubble, setBubble] = useState<string | null>(null);
  const walk = useRef({ legId: 0, idx: 0 }); // waypoint cursor for the store's current leg
  const yaw = useRef(0);
  const current = useRef<THREE.AnimationAction | null>(null);
  const oneShot = useRef<THREE.AnimationAction | null>(null);
  const headBone = useRef<THREE.Bone | null>(null);
  const headBind = useRef(new THREE.Quaternion()); // the rig's neutral head pose (level, facing forward)
  const headRest = useRef(new THREE.Quaternion());
  const look = useRef({ yaw: 0, pitch: 0 });

  // shadows, no frustum-culling on the skinned mesh (its bounds don't follow the animation),
  // sanitize Meshy materials, find the head bone
  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        // Meshy exports parts (cap, hair, shirt seams) as alpha-BLEND, which
        // don't write depth → faces sort by draw order and tear from some
        // angles. Force opaque with depth-write; convert any real cutout
        // (hair) to alphaTest. Also tame the over-shiny PBR that blows out
        // under the shop's env lighting.
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const s = mat as THREE.MeshStandardMaterial;
          if (s.transparent) {
            s.transparent = false;
            s.alphaTest = 0.5; // blend → cutout, keeps hair edges
          }
          s.depthWrite = true;
          s.side = THREE.FrontSide;
          if (s.roughness !== undefined) s.roughness = Math.max(s.roughness, 0.65);
          if (s.metalness !== undefined) s.metalness = Math.min(s.metalness, 0.05);
          // Meshy packs skin/shirt/cap as tiny UV islands with no padding, so
          // mipmap + bilinear filtering bleeds neighbouring colours across the
          // seams (skin onto shirt, gray onto the arm). Disable mipmaps and
          // clamp so each texel samples the full-res atlas — kills most bleed.
          for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'] as const) {
            const tex = s[key] as THREE.Texture | null;
            if (tex) {
              tex.generateMipmaps = false;
              tex.minFilter = THREE.LinearFilter;
              tex.magFilter = THREE.LinearFilter;
              tex.anisotropy = 1;
              tex.needsUpdate = true;
            }
          }
          s.needsUpdate = true;
        }
      }
      if ((o as THREE.Bone).isBone && o.name === 'Head') {
        headBone.current = o as THREE.Bone;
        headBind.current.copy(o.quaternion); // captured before the mixer ever writes it
      }
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

  const walking = pose === 'walkingOut' || pose === 'walkingBack';

  // base state: walk while out on the floor, talk while a reply streams, otherwise idle
  // (unless a one-shot gesture is running)
  useEffect(() => {
    if (oneShot.current) return;
    play(walking ? CLIP.walk : isStreaming ? CLIP.talk : CLIP.idle);
  }, [isStreaming, walking, play]);



  // one-shot gestures from the dialogue store, then back to the base state (never mid-walk — the
  // walk cycle would stop while locomotion keeps sliding him along)
  useEffect(() => {
    if (!gesture || gestureId === 0 || walking) return;
    const name = GESTURE_CLIP[gesture];
    const action = play(name, false);
    if (!action) return;
    oneShot.current = action;
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action !== action) return;
      oneShot.current = null;
      const p = useShopkeeperStore.getState().pose;
      play(p === 'walkingOut' || p === 'walkingBack' ? CLIP.walk : useDialogueStore.getState().isStreaming ? CLIP.talk : CLIP.idle);
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [gesture, gestureId, play, mixer]);

  // in-world speech bubble while the chat panel is closed: streams live as Chris talks
  // (e.g. answering about a held card out on the floor), then holds for reading time
  useEffect(() => {
    if (isOpen) {
      setBubble(null);
      return;
    }
    if (isStreaming) {
      setBubble(streamingText || '…');
      return;
    }
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      setBubble(last.content);
      const t = setTimeout(() => setBubble(null), bubbleHoldSeconds(last.content) * 1000);
      return () => clearTimeout(t);
    }
    setBubble(null);
  }, [messages, isOpen, isStreaming, streamingText]);

  // locomotion: walk the planned waypoints, face the way we're going; at the spot, face the customer
  useFrame((_, dt) => {
    const r = root.current;
    if (!r) return;
    const st = useShopkeeperStore.getState();
    let targetYaw = 0; // rest: face +Z (the shop)
    if (st.pose === 'walkingOut' || st.pose === 'walkingBack') {
      const w = walk.current;
      if (w.legId !== st.legId) {
        w.legId = st.legId;
        w.idx = 0;
      }
      const wp = st.path[w.idx];
      if (!wp) {
        if (st.pose === 'walkingOut') st.arrivedAtSpot();
        else st.arrivedHome();
      } else {
        const dx = wp[0] - r.position.x;
        const dz = wp[1] - r.position.z;
        const dist = Math.hypot(dx, dz);
        const step = FEEL.shopkeeperWalkSpeed * dt;
        if (dist <= step) {
          r.position.x = wp[0];
          r.position.z = wp[1];
          w.idx += 1;
        } else {
          r.position.x += (dx / dist) * step;
          r.position.z += (dz / dist) * step;
        }
        targetYaw = Math.atan2(dx, dz);
      }
    } else if (st.pose === 'visiting') {
      targetYaw = st.facing;
    }
    // shortest-arc damp on yaw
    let d = targetYaw - yaw.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    yaw.current += d * (1 - Math.exp(-FEEL.shopkeeperTurnLambda * dt));
    r.rotation.y = yaw.current;
  });

  // lazy head look-at. The clips move the head too (the wave looks at the ceiling), so the look
  // REPLACES the animated head pose (bind pose + look) — except during the nod, which is head-driven.
  useFrame((state, dt) => {
    const head = headBone.current;
    if (!head) return;
    const nodding = oneShot.current !== null && useDialogueStore.getState().gesture === 'nod';
    const cam = state.camera.position;
    const r = root.current;
    const dx = cam.x - r.position.x;
    const dz = cam.z - r.position.z;
    // yaw relative to the body's current facing
    let lookYaw = Math.atan2(dx, dz) - yaw.current;
    lookYaw = Math.atan2(Math.sin(lookYaw), Math.cos(lookYaw));
    const dy = cam.y - 1.55;
    let pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    const interested = Math.abs(lookYaw) < 1.05;
    if (!interested) {
      lookYaw = 0.3; // back to sorting cards
      pitch = 0.35;
    }
    const L = look.current;
    L.yaw = THREE.MathUtils.damp(L.yaw, THREE.MathUtils.clamp(lookYaw, -0.9, 0.9), FEEL.headLookLambda, dt);
    L.pitch = THREE.MathUtils.damp(L.pitch, THREE.MathUtils.clamp(pitch, -0.35, 0.35), FEEL.headLookLambda, dt);
    // additive: the mixer has already written this frame's pose into head.quaternion
    _euler.set(L.pitch, L.yaw, 0);
    headRest.current.setFromEuler(_euler);
    if (!nodding) head.quaternion.copy(headBind.current);
    head.quaternion.multiply(headRest.current);
  });

  return (
    <group ref={root} position={[SHOPKEEPER_HOME[0], 0, SHOPKEEPER_HOME[1]]}>
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
