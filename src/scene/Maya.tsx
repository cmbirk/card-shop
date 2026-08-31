import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { FEEL } from '../feel';
import { useMayaStore } from '../stores/mayaStore';

const MODEL_URL = '/models/maya.glb';
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

// Maya — a second staffer standing behind the Good Stuff display case. Idle
// loop + lazy head-look toward the player. Same Meshy rig as Chris, so she
// gets the same material sanitize (BLEND→opaque, single-sided, mipmaps off to
// stop the UV-atlas seam bleed).
export function Maya() {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, group);
  const headBone = useRef<THREE.Bone | null>(null);
  const headBind = useRef(new THREE.Quaternion());
  const look = useRef({ yaw: 0, pitch: 0 });
  const rot = useRef(new THREE.Quaternion());
  const line = useMayaStore((s) => s.line);
  const lineId = useMayaStore((s) => s.lineId);

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const s = mat as THREE.MeshStandardMaterial;
          if (s.transparent) {
            s.transparent = false;
            s.alphaTest = 0.5;
          }
          s.depthWrite = true;
          s.side = THREE.FrontSide;
          if (s.roughness !== undefined) s.roughness = Math.max(s.roughness, 0.65);
          if (s.metalness !== undefined) s.metalness = Math.min(s.metalness, 0.05);
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
        headBind.current.copy(o.quaternion);
      }
    });
  }, [scene]);

  useEffect(() => {
    const idle = actions['Idle_02'];
    if (idle) idle.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }, [actions]);

  // a scripted line: talk pose + bubble for its hold time, then back to idle
  useEffect(() => {
    if (!line) return;
    const idle = actions['Idle_02'];
    const talk = actions['Talk_with_Hands_Open'];
    if (talk && idle) {
      talk.reset().setLoop(THREE.LoopRepeat, Infinity);
      talk.crossFadeFrom(idle, 0.35, true).play();
    }
    const t = setTimeout(() => {
      if (talk && idle) idle.reset().crossFadeFrom(talk, 0.35, true).play();
      useMayaStore.getState().clear();
    }, FEEL.mayaLineHold * 1000);
    return () => clearTimeout(t);
  }, [line, lineId, actions]);

  // head tracks the player, layered on the animation (world pos of Maya is set below)
  const MAYA = { x: 3.95, z: -2.2, faceY: -Math.PI / 2 };
  useFrame((state, dt) => {
    const head = headBone.current;
    if (!head) return;
    const cam = state.camera.position;
    const dx = cam.x - MAYA.x;
    const dz = cam.z - MAYA.z;
    // yaw relative to her facing (-X): atan2 of local-space direction
    let yaw = Math.atan2(dx, dz) - MAYA.faceY;
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); // wrap to [-π,π]
    const dy = cam.y - 1.5;
    let pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    const interested = Math.abs(yaw) < 1.1;
    if (!interested) {
      yaw = -0.3;
      pitch = 0.3;
    }
    const L = look.current;
    L.yaw = THREE.MathUtils.damp(L.yaw, THREE.MathUtils.clamp(yaw, -0.9, 0.9), FEEL.headLookLambda, dt);
    L.pitch = THREE.MathUtils.damp(L.pitch, THREE.MathUtils.clamp(pitch, -0.35, 0.35), FEEL.headLookLambda, dt);
    _euler.set(L.pitch, L.yaw, 0);
    rot.current.setFromEuler(_euler);
    head.quaternion.copy(headBind.current).multiply(rot.current); // replace the clip's head pose, don't add to it
  });

  return (
    <group position={[MAYA.x, 0, MAYA.z]} rotation-y={MAYA.faceY}>
      {line && (
        // her words live in the pinned speech card; the dots just say "that's me talking"
        <Html position={[0, 1.9, 0]} center distanceFactor={2.5} style={{ pointerEvents: 'none' }}>
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
