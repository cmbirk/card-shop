import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { FEEL } from '../feel';
import { LOKI_HOME, useLokiStore } from '../stores/lokiStore';
import { useNavStore } from '../stores/navStore';
import { LOOK } from './look';

const MODEL_URL = '/models/loki.glb';
const SCALE = 75; // the export is in centimetres (~1 cm long at scale 1); 75 ≈ a shepherd-sized dog
const HOME_YAW = -2.2; // by the bar's south end, looking out over the shop floor
const STAND_T = 0.1; // s into the walk clip where all four feet are planted (sampled) — his standing pose
const _q = new THREE.Quaternion();
const _p = new THREE.Quaternion();
const _pInv = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);

// Loki — Chris's dog. Trots out to greet the customer when they step inside, then goes
// back to hang out by the counter. Decor for clicks: every mesh opts out of raycasting.
// Meshy rig, so the same material sanitize as Chris/Maya, plus this export ships
// emissive = white over the base texture (flat, glowing fur) and a 2× specular.
// The export has a single clip (a walk), so standing = finish the stride into its planted frame and hold.
export function Loki() {
  const root = useRef<THREE.Group>(null!); // world position/yaw — moved per frame, never via React state
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, group);
  const pose = useLokiStore((s) => s.pose);
  const walk = useRef({ legId: 0, idx: 0 });
  const yaw = useRef(HOME_YAW);
  const gait = useRef<THREE.AnimationAction | null>(null);
  const headBone = useRef<THREE.Bone | null>(null);
  const look = useRef(0);
  const headClip = useRef(new THREE.Quaternion()); // the clip's head pose, before the look offset
  const headSet = useRef(new THREE.Quaternion()); // what we wrote last frame

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone && o.name === 'head') headBone.current = o as THREE.Bone;
      if (!(o as THREE.Mesh).isMesh) return;
      const m = o as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.raycast = () => null;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const s = mat as THREE.MeshPhysicalMaterial;
        s.transparent = false;
        s.depthWrite = true;
        s.side = THREE.FrontSide;
        s.emissive?.setRGB(0, 0, 0);
        s.emissiveMap = null;
        if (s.specularColor) s.specularColor.setRGB(1, 1, 1);
        s.roughness = Math.max(s.roughness ?? 1, 0.75);
        s.metalness = Math.min(s.metalness ?? 0, 0.05);
        // black fur: sheen + env boost so he never goes to a flat silhouette (look.ts)
        s.envMapIntensity = LOOK.lokiCoat.envBoost;
        if (s.isMeshPhysicalMaterial) {
          s.sheen = LOOK.lokiCoat.sheen;
          s.sheenColor.set(LOOK.lokiCoat.sheenColor);
          s.sheenRoughness = LOOK.lokiCoat.sheenRoughness;
        }
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap'] as const) {
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
    });
  }, [scene]);

  useEffect(() => {
    const clip = Object.values(actions)[0] ?? null;
    gait.current = clip;
    if (!clip) return;
    clip.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    clip.time = STAND_T; // standing until he has somewhere to go
    clip.timeScale = 0;
  }, [actions]);

  // the customer stepping inside (leaving the sidewalk) sends him to the door
  useEffect(() => {
    const check = (s: ReturnType<typeof useNavStore.getState>) => {
      if (s.currentStation !== 'outside' || (s.targetStation && s.targetStation !== 'outside')) useLokiStore.getState().greet();
    };
    check(useNavStore.getState());
    return useNavStore.subscribe(check);
  }, []);

  // a few seconds of saying hi, then back to the counter
  useEffect(() => {
    if (pose !== 'waiting') return;
    const t = setTimeout(() => useLokiStore.getState().goHome(), FEEL.lokiGreetHold * 1000);
    return () => clearTimeout(t);
  }, [pose]);

  useFrame((state, dt) => {
    const r = root.current;
    const { pose, path, legId } = useLokiStore.getState();
    const cam = state.camera.position;
    const moving = pose === 'greeting' || pose === 'returning';
    let targetYaw = pose === 'home' ? HOME_YAW : Math.atan2(cam.x - r.position.x, cam.z - r.position.z);

    if (moving) {
      const w = walk.current;
      if (w.legId !== legId) {
        w.legId = legId;
        w.idx = 0;
      }
      const wp = path[w.idx];
      if (wp) {
        const dx = wp[0] - r.position.x;
        const dz = wp[1] - r.position.z;
        const dist = Math.hypot(dx, dz);
        const step = FEEL.lokiWalkSpeed * dt;
        if (dist <= step) {
          r.position.x = wp[0];
          r.position.z = wp[1];
          w.idx += 1;
          if (w.idx >= path.length) useLokiStore.getState().arrived();
        } else {
          r.position.x += (dx / dist) * step;
          r.position.z += (dz / dist) * step;
        }
        if (dist > 1e-4) targetYaw = Math.atan2(dx, dz);
      }
    }

    let dyaw = targetYaw - yaw.current;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); // shortest way round
    yaw.current += dyaw * (1 - Math.exp(-FEEL.lokiTurnLambda * dt));
    r.rotation.y = yaw.current;

    const g = gait.current;
    if (g && moving) g.timeScale = THREE.MathUtils.damp(g.timeScale, 1, FEEL.lokiGaitLambda, dt);
    else if (g && g.timeScale > 0) {
      const t = g.time % g.getClip().duration;
      if (t <= STAND_T && t + dt * g.timeScale >= STAND_T) {
        g.time = STAND_T;
        g.timeScale = 0;
      }
    }

    // standing still: turn his head toward the customer, on top of the (frozen) clip pose
    const head = headBone.current;
    if (!head?.parent) return;
    let want = 0;
    if (!moving) {
      const rel = Math.atan2(cam.x - r.position.x, cam.z - r.position.z) - yaw.current;
      want = THREE.MathUtils.clamp(Math.atan2(Math.sin(rel), Math.cos(rel)), -0.8, 0.8);
    }
    look.current = THREE.MathUtils.damp(look.current, want, FEEL.headLookLambda, dt);
    // a world-Y yaw expressed in the head's parent frame: P⁻¹ · R · P · local
    head.parent.getWorldQuaternion(_p);
    _pInv.copy(_p).invert();
    _q.setFromAxisAngle(_y, look.current);
    // The mixer only writes a bone when the clip value changes, so while the gait is frozen
    // the head still holds last frame's offset pose — rebase on the clip pose, never stack.
    if (!head.quaternion.equals(headSet.current)) headClip.current.copy(head.quaternion);
    head.quaternion.copy(headClip.current).premultiply(_q.premultiply(_pInv).multiply(_p));
    headSet.current.copy(head.quaternion);
  });

  return (
    <group ref={root} name="loki" position={[LOKI_HOME[0], 0, LOKI_HOME[1]]} rotation-y={HOME_YAW}>
      <group ref={group} scale={SCALE}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
