import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { shopLayout, ROOM, ANNEX, ANNEX_DOOR, OFFICE, BACK_OFFICE_DOOR } from '@shared/data/shopLayout';
import { useNavStore } from '../stores/navStore';
import { useInspectStore } from '../stores/inspectStore';
import { useUIStore } from '../stores/uiStore';
import { useDialogueStore } from '../stores/dialogueStore';
import { FEEL } from '../feel';

// First-person walking, the low-key way: press WASD/arrows anywhere inside and you detach
// from the station rig into freewalk (drag to look, keys to move, eye height locked).
// Clicking a glowing waypoint glides you back into station mode; Esc snaps to the nearest
// station. No pointer lock, no head-bob. Collision is 2D boxes: rooms with doorway gaps,
// plus fixture footprints — clamped with wall sliding.
//
// The pose is written THROUGH CameraControls (setLookAt, no transition), never straight to
// the camera: drei calls controls.update() every frame even while `enabled` is false, and
// update() rewrites camera.position from the controls' own state — writing the camera
// directly gets undone each frame (the walker crawled ~5cm and drifted back).

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

interface Box { x0: number; x1: number; z0: number; z1: number }
const inBox = (b: Box, x: number, z: number, m = 0) => x > b.x0 + m && x < b.x1 - m && z > b.z0 + m && z < b.z1 - m;

const M = 0.32; // wall margin
const ROOMS: Box[] = [
  { x0: -ROOM.width / 2, x1: ROOM.width / 2, z0: -ROOM.depth / 2, z1: ROOM.depth / 2 },
  { x0: ANNEX.xMin, x1: ANNEX.xMax, z0: ANNEX.zMin, z1: ANNEX.zMax },
  { x0: OFFICE.xMin, x1: OFFICE.xMax, z0: OFFICE.zMin, z1: OFFICE.zMax },
];
const DOORWAYS: Box[] = [
  { x0: ANNEX.xMax - 0.45, x1: ANNEX.xMax + 0.45, z0: ANNEX_DOOR.z - ANNEX_DOOR.width * 0.42, z1: ANNEX_DOOR.z + ANNEX_DOOR.width * 0.42 },
  { x0: BACK_OFFICE_DOOR.position[0] - BACK_OFFICE_DOOR.width * 0.42, x1: BACK_OFFICE_DOOR.position[0] + BACK_OFFICE_DOOR.width * 0.42, z0: -ROOM.depth / 2 - 0.45, z1: -ROOM.depth / 2 + 0.45 },
];

/** Fixture footprints (axis-aligned; 90° rotations swap extents; bins' slight angles use max extents). */
const FOOT: Record<string, [number, number]> = { displayCase: [1.75, 0.75], counter: [3.25, 0.85], bin: [0.8, 0.8], shelf: [2.3, 0.55] };
const OBSTACLES: Box[] = shopLayout.fixtures
  .filter((f) => f.kind in FOOT)
  .map((f) => {
    let [w, d] = FOOT[f.kind];
    if (Math.abs(Math.abs(f.rotationY) - Math.PI / 2) < 0.3) [w, d] = [d, w];
    return { x0: f.position[0] - w / 2, x1: f.position[0] + w / 2, z0: f.position[2] - d / 2, z1: f.position[2] + d / 2 };
  })
  .concat([
    { x0: -3.8, x1: -2.2, z0: OFFICE.zMin, z1: OFFICE.zMin + 1.0 }, // office desk + chair
    { x0: OFFICE.xMin, x1: OFFICE.xMin + 0.65, z0: OFFICE.zMin, z1: OFFICE.zMin + 0.75 }, // filing cabinet
    { x0: -8.85, x1: -8.15, z0: -5.1, z1: -4.4 }, // trophy plinth (annex)
  ]);

const walkable = (x: number, z: number) =>
  (ROOMS.some((r) => inBox(r, x, z, M)) || DOORWAYS.some((d) => inBox(d, x, z, 0))) && !OBSTACLES.some((o) => inBox(o, x, z, -0.05));

/** Live walker pose for anything that needs "where is the customer" during freewalk (Chris's visits). */
export const walkPose = { x: 0, z: 0, yaw: 0, active: false };

const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]');

const _fwd = new THREE.Vector3();

export function WalkController() {
  const { camera, gl } = useThree();
  const controls = useThree((s) => s.controls) as CameraControlsImpl | null;
  const keys = useRef(new Set<string>());
  const vel = useRef(new THREE.Vector2());
  const look = useRef({ yaw: 0, pitch: 0, dragging: false });
  const snapTick = useRef(0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!(e.code in KEYS) || typing(e.target)) return;
      const nav = useNavStore.getState();
      const ui = useUIStore.getState();
      if (nav.currentStation === 'outside' || ui.adminOpen || ui.consignOpen || useDialogueStore.getState().isOpen) return;
      if (useInspectStore.getState().mode !== 'idle') return;
      keys.current.add(e.code);
      e.preventDefault();
      if (nav.mode === 'station') {
        // detach into freewalk from the current camera pose
        const e2 = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        look.current.yaw = e2.y;
        look.current.pitch = e2.x;
        nav.setMode('freewalk');
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useNavStore.getState().mode !== 'freewalk') return;
      if (useInspectStore.getState().mode !== 'idle') return;
      // snap to the nearest station and let the rig take over
      const nearest = shopLayout.stations
        .filter((s) => s.id !== 'outside')
        .reduce((a, b) => (Math.hypot(a.position[0] - camera.position.x, a.position[2] - camera.position.z) < Math.hypot(b.position[0] - camera.position.x, b.position[2] - camera.position.z) ? a : b));
      useNavStore.getState().setMode('station');
      useNavStore.getState().goTo(nearest.id);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('keydown', esc);
    const blur = () => keys.current.clear();
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('keydown', esc);
      window.removeEventListener('blur', blur);
    };
  }, [camera]);

  // drag to look (CameraControls is disabled during freewalk)
  useEffect(() => {
    const el = gl.domElement;
    const l = look.current;
    const down = (e: PointerEvent) => {
      if (useNavStore.getState().mode !== 'freewalk') return;
      l.dragging = true;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!l.dragging || useNavStore.getState().mode !== 'freewalk') return;
      l.yaw -= e.movementX * FEEL.walkLookX;
      l.pitch = THREE.MathUtils.clamp(l.pitch - e.movementY * FEEL.walkLookY, -1.2, 1.2);
    };
    const up = () => (l.dragging = false);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  useFrame((_, dtRaw) => {
    const nav = useNavStore.getState();
    walkPose.active = nav.mode === 'freewalk';
    if (nav.mode !== 'freewalk') return;
    const dt = Math.min(dtRaw, 0.05);
    const l = look.current;

    // input → camera-relative target velocity
    let ix = 0;
    let iz = 0;
    for (const code of keys.current) {
      const [x, z] = KEYS[code];
      ix += x;
      iz += z;
    }
    const len = Math.hypot(ix, iz) || 1;
    const sin = Math.sin(l.yaw);
    const cos = Math.cos(l.yaw);
    // forward is -z in camera space
    const tx = ((ix * cos + iz * sin) / len) * FEEL.walkSpeed;
    const tz = ((-ix * sin + iz * cos) / len) * FEEL.walkSpeed;
    vel.current.x = THREE.MathUtils.damp(vel.current.x, ix || iz ? tx : 0, FEEL.walkAccelLambda, dt);
    vel.current.y = THREE.MathUtils.damp(vel.current.y, ix || iz ? tz : 0, FEEL.walkAccelLambda, dt);

    // move with wall sliding (try each axis on its own)
    let px = camera.position.x;
    let pz = camera.position.z;
    const nx = px + vel.current.x * dt;
    const nz = pz + vel.current.y * dt;
    if (walkable(nx, pz)) px = nx;
    if (walkable(px, nz)) pz = nz;
    const py = FEEL.walkEyeHeight;
    // look direction from yaw/pitch (camera forward is -Z): the controls' target sits 1m ahead
    _fwd.set(-Math.sin(l.yaw) * Math.cos(l.pitch), Math.sin(l.pitch), -Math.cos(l.yaw) * Math.cos(l.pitch));
    if (controls) void controls.setLookAt(px, py, pz, px + _fwd.x, py + _fwd.y, pz + _fwd.z, false);
    else {
      camera.position.set(px, py, pz);
      camera.quaternion.setFromEuler(new THREE.Euler(l.pitch, l.yaw, 0, 'YXZ'));
    }

    walkPose.x = px;
    walkPose.z = pz;
    walkPose.yaw = l.yaw;

    // keep currentStation honest (nearest, throttled) so context/doors stay sensible
    if ((snapTick.current = (snapTick.current + 1) % 30) === 0) {
      const nearest = shopLayout.stations
        .filter((s) => s.id !== 'outside')
        .reduce((a, b) => (Math.hypot(a.position[0] - camera.position.x, a.position[2] - camera.position.z) < Math.hypot(b.position[0] - camera.position.x, b.position[2] - camera.position.z) ? a : b));
      if (nearest.id !== nav.currentStation) nav.setCurrentSilently(nearest.id);
    }
  });

  return null;
}
