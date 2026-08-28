import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { shopLayout } from '@shared/data/shopLayout';
import type { Station } from '@shared/types';
import { useNavStore } from '../stores/navStore';
import { FEEL } from '../feel';
import { sfx } from '../systems/sfx';

const stations = new Map<string, Station>(shopLayout.stations.map((s) => [s.id, s]));
const MIDPOINT = { position: [0, 1.6, 1.2] as const };

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
      // wall-to-wall hops swing through the open center aisle
      const crossing = from && Math.abs(from.position[0]) > 3 && Math.abs(st.position[0]) > 3 && Math.sign(from.position[0]) !== Math.sign(st.position[0]);
      if (crossing) {
        c.smoothTime = FEEL.hopSmoothTime;
        await c.setLookAt(...MIDPOINT.position, ...st.target, true);
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

  // user look-around only while parked at a station
  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    c.enabled = useNavStore.getState().mode === 'station';
  });

  return <CameraControls ref={ref} makeDefault />;
}
