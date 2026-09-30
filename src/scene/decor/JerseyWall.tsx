import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ROOM } from '@shared/data/shopLayout';
import { SHOWCASE_RUN } from '@shared/data/obstacles';
import { Framed } from '../WallArt';
import { jerseyArt } from '../ShowcaseRoom';

// The jersey wall: framed jerseys in black shadowboxes on white slatwall, over the glass showcase run on
// the north wall. Generic colour combos and numbers only — no names, marks or logos. Decor only.

const JERSEYS: [num: string, body: string, trim: string, stroke: string][] = [
  ['23', '#c8102e', '#ffffff', '#111111'],
  ['12', '#0b2265', '#ffffff', '#a71930'],
  ['8', '#ffb612', '#101820', '#101820'],
  ['34', '#006847', '#ffffff', '#fdb927'],
  ['3', '#4b2a7b', '#fdb927', '#ffffff'],
  ['15', '#f4f4f2', '#c8102e', '#101820'],
  ['7', '#101820', '#fb4f14', '#ffffff'],
];
const Y0 = 1.42;
const Y1 = 2.95;
const noHit = () => null;

function slatwallMaterial(width: number, height: number): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64; // one repeat = one 3-inch slat
  const g = c.getContext('2d')!;
  g.fillStyle = '#eef0f0';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#b9bdc1'; // the groove
  g.fillRect(0, 54, 64, 7);
  g.fillStyle = '#ffffff'; // lit lip above the groove
  g.fillRect(0, 51, 64, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(width / 0.3, height / 0.076);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
}

const blackFrame = new THREE.MeshStandardMaterial({ color: '#121316', roughness: 0.5 });

export function JerseyWall() {
  const x0 = SHOWCASE_RUN.x0;
  const x1 = SHOWCASE_RUN.x1;
  const w = x1 - x0;
  const { slat, jerseys } = useMemo(
    () => ({ slat: slatwallMaterial(w, Y1 - Y0), jerseys: JERSEYS.map(([n, b, t, s]) => jerseyArt(n, b, t, s)) }),
    [w],
  );
  useEffect(
    () => () => {
      slat.map?.dispose();
      slat.dispose();
      jerseys.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    },
    [slat, jerseys],
  );
  const z = ROOM.zMin + 0.012;
  const step = w / JERSEYS.length;
  return (
    <group>
      <mesh material={slat} position={[(x0 + x1) / 2, (Y0 + Y1) / 2, z]} raycast={noHit}>
        <planeGeometry args={[w, Y1 - Y0]} />
      </mesh>
      {jerseys.map((m, i) => (
        <Framed key={i} material={m} frame={blackFrame} position={[x0 + step * (i + 0.5), 2.18, z + 0.02]} rotationY={0} w={0.62} h={0.78} />
      ))}
    </group>
  );
}
