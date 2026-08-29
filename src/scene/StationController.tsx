import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { shopLayout, ANNEX, ANNEX_DOOR } from '@shared/data/shopLayout';
import type { Station, Vec3 } from '@shared/types';
import { useNavStore } from '../stores/navStore';
import { useShopkeeperStore } from '../stores/shopkeeperStore';
import { FEEL } from '../feel';
import { sfx } from '../systems/sfx';

const stations = new Map<string, Station>(shopLayout.stations.map((s) => [s.id, s]));
const MIDPOINT: Vec3 = [0, 1.6, 1.2];
const ANNEX_DOORWAY: Vec3 = [ANNEX.xMax, 1.6, ANNEX_DOOR.z];

/** Intermediate camera positions so a glide never cuts through a wall. */
function waypoints(from: Station | undefined, to: Station): Vec3[] {
  if (!from) return [];
  const inAnnex = (s: Station) => s.position[0] < ANNEX.xMax;
  const wps: Vec3[] = inAnnex(from) !== inAnnex(to) ? [ANNEX_DOORWAY] : [];
  // wall-to-wall hops swing through the open center aisle (the doorway counts as the west wall)
  const fx = inAnnex(from) ? ANNEX_DOORWAY[0] : from.position[0];
  const tx = inAnnex(to) ? ANNEX_DOORWAY[0] : to.position[0];
  const crossing = Math.abs(fx) > 3 && Math.abs(tx) > 3 && Math.sign(fx) !== Math.sign(tx);
  if (crossing) wps.push(MIDPOINT);
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
    c.maxDistance = _sph.radius;
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

  // user look-around only while parked at a station
  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    c.enabled = useNavStore.getState().mode === 'station';
  });

  return <CameraControls ref={ref} makeDefault />;
}
