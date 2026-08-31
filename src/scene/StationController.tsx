import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { shopLayout, ANNEX, ANNEX_DOOR, OFFICE, BACK_OFFICE_DOOR } from '@shared/data/shopLayout';
import type { Station, Vec3 } from '@shared/types';
import { useNavStore } from '../stores/navStore';
import { useShopkeeperStore } from '../stores/shopkeeperStore';
import { useInspectStore } from '../stores/inspectStore';
import { binUnderPointer } from './fixtures/Bin';
import { FEEL } from '../feel';
import { sfx } from '../systems/sfx';

const stations = new Map<string, Station>(shopLayout.stations.map((s) => [s.id, s]));
const MIDPOINT: Vec3 = [0, 1.6, 1.2];
const ANNEX_DOORWAY: Vec3 = [ANNEX.xMax, 1.6, ANNEX_DOOR.z];
const OFFICE_DOORWAY: Vec3 = [BACK_OFFICE_DOOR.position[0], 1.6, OFFICE.zMax];

type Room = 'main' | 'annex' | 'office';
/** Which room a station is in (the side rooms are never adjacent to each other). */
export function roomOf(pos: readonly [number, number, number]): Room {
  if (pos[0] < ANNEX.xMax) return 'annex';
  if (pos[2] < OFFICE.zMax) return 'office';
  return 'main';
}
const DOORWAY: Record<Exclude<Room, 'main'>, Vec3> = { annex: ANNEX_DOORWAY, office: OFFICE_DOORWAY };

/** Intermediate camera positions so a glide never cuts through a wall. */
function waypoints(from: Station | undefined, to: Station): Vec3[] {
  if (!from) return [];
  const rf = roomOf(from.position);
  const rt = roomOf(to.position);
  const wps: Vec3[] = [];
  if (rf !== 'main') wps.push(DOORWAY[rf]); // leave the side room through its door
  // wall-to-wall hops swing through the open center aisle (a doorway counts as its wall)
  const fx = rf === 'main' ? from.position[0] : DOORWAY[rf][0];
  const tx = rt === 'main' ? to.position[0] : DOORWAY[rt][0];
  const crossing = Math.abs(fx) >= 3 && Math.abs(tx) >= 3 && Math.sign(fx) !== Math.sign(tx);
  if (crossing) wps.push(MIDPOINT);
  if (rt !== 'main' && rf !== rt) wps.push(DOORWAY[rt]); // enter the side room through its door
  return wps;
}

const _sph = new THREE.Spherical();
const _off = new THREE.Vector3();

/**
 * Point-and-click glide navigation between stations, via drei CameraControls.
 * The WASD-future seam: this whole component swaps for a WalkController when
 * navStore.mode === 'freewalk' — everything else reads camera state per frame.
 */
export function StationController() {
  const ref = useRef<CameraControlsImpl>(null!);
  const travelToken = useRef(0);
  const targetStation = useNavStore((s) => s.targetStation);

  const clampToStation = (st: Station) => {
    const c = ref.current;
    _off.set(st.position[0] - st.target[0], st.position[1] - st.target[1], st.position[2] - st.target[2]);
    _sph.setFromVector3(_off);
    c.minAzimuthAngle = _sph.theta - st.yawRange;
    c.maxAzimuthAngle = _sph.theta + st.yawRange;
    c.minPolarAngle = Math.max(0.05, _sph.phi - st.pitchRange);
    c.maxPolarAngle = Math.min(Math.PI - 0.05, _sph.phi + st.pitchRange);
    c.minDistance = _sph.radius;
    // lean-back room: scroll dollies out along the view axis, but never through a wall/ceiling
    c.maxDistance = Math.max(_sph.radius, Math.min(_sph.radius + FEEL.zoomOutRange, backOffLimit(st)));
  };

  /** How far behind `st.position` the camera can go (from the target, along the view axis) before leaving the station's room. */
  const backOffLimit = (st: Station): number => {
    const room = roomOf(st.position);
    const b =
      room === 'annex'
        ? { x0: ANNEX.xMin, x1: ANNEX.xMax, z0: ANNEX.zMin, z1: ANNEX.zMax }
        : room === 'office'
          ? { x0: OFFICE.xMin, x1: OFFICE.xMax, z0: OFFICE.zMin, z1: OFFICE.zMax }
          : { x0: -5, x1: 5, z0: -4, z1: st.id === 'outside' ? 99 : 4 }; // outside has no back wall
    const m = 0.3; // wall margin
    const dir = _off.clone().normalize(); // target → camera
    let t = Infinity;
    const axes: [number, number, number, number][] = [
      [dir.x, st.target[0], b.x0 + m, b.x1 - m],
      [dir.z, st.target[2], b.z0 + m, b.z1 - m],
      [dir.y, st.target[1], 0.3, 2.8],
    ];
    for (const [d, o, lo, hi] of axes) {
      if (Math.abs(d) < 1e-6) continue;
      const lim = d > 0 ? (hi - o) / d : (lo - o) / d;
      t = Math.min(t, lim);
    }
    return t;
  };

  const releaseBounds = () => {
    const c = ref.current;
    c.minAzimuthAngle = -Infinity;
    c.maxAzimuthAngle = Infinity;
    c.minPolarAngle = 0.05;
    c.maxPolarAngle = Math.PI - 0.05;
    c.minDistance = 0.01;
    c.maxDistance = 100;
  };

  // initial pose + input config
  useEffect(() => {
    const c = ref.current;
    c.mouseButtons.wheel = CameraControlsImpl.ACTION.NONE;
    c.mouseButtons.right = CameraControlsImpl.ACTION.NONE;
    c.mouseButtons.middle = CameraControlsImpl.ACTION.NONE;
    c.touches.two = CameraControlsImpl.ACTION.NONE;
    c.touches.three = CameraControlsImpl.ACTION.NONE;
    c.draggingSmoothTime = 0.08;
    const entry = stations.get(shopLayout.entry)!;
    void c.setLookAt(...entry.position, ...entry.target, false);
    clampToStation(entry);
    if (import.meta.env.DEV) (window as unknown as { __cam?: CameraControlsImpl }).__cam = c; // verify.mjs `look`
  }, []);

  // glide on navigation intent
  useEffect(() => {
    if (!targetStation) return;
    const st = stations.get(targetStation);
    const c = ref.current;
    if (!st || !c) return;
    const token = ++travelToken.current;
    const from = stations.get(useNavStore.getState().currentStation);

    const run = async () => {
      sfx.glide();
      releaseBounds();
      for (const wp of waypoints(from, st)) {
        c.smoothTime = FEEL.hopSmoothTime;
        await c.setLookAt(...wp, ...st.target, true);
        if (travelToken.current !== token) return;
      }
      c.smoothTime = FEEL.glideSmoothTime;
      await c.setLookAt(...st.position, ...st.target, true);
      if (travelToken.current !== token) return;
      clampToStation(st);
      useNavStore.getState().arrived(st.id);
    };
    void run();
  }, [targetStation]);

  // turn to face Chris when he walks over to talk (bounds released — setLookAt doesn't clamp),
  // and back to the station's view + clamp when he heads home
  const keeperPose = useShopkeeperStore((s) => s.pose);
  useEffect(() => {
    const c = ref.current;
    const nav = useNavStore.getState();
    const st = stations.get(nav.currentStation);
    if (!c || !st || nav.mode === 'transit') return;
    const { spot } = useShopkeeperStore.getState();
    c.smoothTime = FEEL.glideSmoothTime;
    if (keeperPose === 'visiting' && spot) {
      // aim a touch to his right so the held card (screen centre) doesn't cover his face
      const dx = spot[0] - st.position[0];
      const dz = spot[1] - st.position[2];
      const len = Math.hypot(dx, dz) || 1;
      const rx = -dz / len;
      const rz = dx / len;
      releaseBounds();
      void c.setLookAt(...st.position, spot[0] + rx * 0.45, 1.45, spot[1] + rz * 0.45, true);
    } else if (keeperPose === 'walkingBack') {
      void c.setLookAt(...st.position, ...st.target, true).then(() => {
        if (useNavStore.getState().currentStation === st.id) clampToStation(st);
      });
    }
  }, [keeperPose]);

  // scroll = lean back for a wider look. Defers to the wheel's other owners: the held card
  // (inspect zoom) and the bins (riffle when the pointer is over one).
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      const nav = useNavStore.getState();
      if (nav.mode !== 'station' || nav.currentStation === 'outside') return;
      if (useInspectStore.getState().mode !== 'idle') return; // CardInHand owns the wheel
      if (binUnderPointer()) return; // the riffle owns it there
      if (useShopkeeperStore.getState().pose === 'visiting') return; // camera is looking at Chris
      e.preventDefault();
      ref.current?.dolly(-e.deltaY * FEEL.zoomOutSpeed, true);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [gl]);

  // user look-around only while parked at a station. Entering freewalk drops the station's
  // clamps so WalkController's setLookAt poses aren't bent back into the station's cone
  // (clampToStation runs again on the next glide arrival).
  const lastMode = useRef<string>('station');
  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    const mode = useNavStore.getState().mode;
    c.enabled = mode === 'station';
    if (mode === 'freewalk' && lastMode.current !== 'freewalk') releaseBounds();
    lastMode.current = mode;
  });

  return <CameraControls ref={ref} makeDefault />;
}
