import { useMemo } from 'react';
import * as THREE from 'three';
import { MAT, makeImageMaterial } from './materials';
import { roundedBox } from './geo';
import { SHOP_NAME } from '@shared/launch';

const texLoader = new THREE.TextureLoader();
const matboard = new THREE.MeshStandardMaterial({ color: '#f5f0e4', roughness: 0.9 });

function scanMaterial(url: string): THREE.MeshStandardMaterial {
  const tex = texLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
}

/** Retro shop poster drawn to canvas — no assets, matches the card-art language. */
function posterMaterial(title: string, subtitle: string, hue: number): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 680;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 680);
  grad.addColorStop(0, `hsl(${hue}, 45%, 38%)`);
  grad.addColorStop(1, `hsl(${hue}, 55%, 20%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 680);
  // starburst
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#fff';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.lineWidth = 2 + (i % 3) * 2;
    ctx.beginPath();
    ctx.moveTo(256, 300);
    ctx.lineTo(256 + Math.cos(a) * 420, 300 + Math.sin(a) * 420);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#efe6c8';
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, 512 - 36, 680 - 36);
  ctx.fillStyle = '#efe6c8';
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px Georgia, serif';
  const words = title.split(' ');
  words.forEach((w, i) => ctx.fillText(w, 256, 220 + i * 78));
  ctx.font = 'italic 28px Georgia, serif';
  ctx.fillText(subtitle, 256, 560);
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText(`★ ${SHOP_NAME} · CARDS & COLLECTIBLES ★`, 256, 620);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
}

export function Framed({
  material,
  position,
  rotationY,
  w,
  h,
  frame = MAT.walnut,
}: {
  material: THREE.Material;
  /** frame material (walnut picture frame by default; black for jersey shadowboxes) */
  frame?: THREE.Material;
  position: [number, number, number];
  rotationY: number;
  w: number;
  h: number;
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh material={frame} geometry={roundedBox(w + 0.08, h + 0.08, 0.035, 0.008)} castShadow />
      <mesh material={matboard} position-z={0.019}>
        <planeGeometry args={[w + 0.03, h + 0.03]} />
      </mesh>
      <mesh material={material} position-z={0.021}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
}

const D90 = Math.PI / 2;

/** Framed vintage prints + retro posters on the walls — the shop's memorabilia. */
export function WallArt() {
  const art = useMemo(
    () => ({
      // Colts photos — CC BY-SA from Wikimedia Commons, attribution in public/wallart/CREDITS.md
      manning: scanMaterial('/wallart/peyton-manning.jpg'),
      harrison: scanMaterial('/wallart/marvin-harrison.jpg'),
      sanders: scanMaterial('/wallart/bob-sanders.jpg'),
      wayne: scanMaterial('/wallart/reggie-wayne.jpg'),
      freeney: scanMaterial('/wallart/dwight-freeney.jpg'),
      mathis: scanMaterial('/wallart/robert-mathis.jpg'),
      banner: makeImageMaterial('/tlc-logo-full-light.svg', { width: 1500, height: 600, bg: '#f2e8d5', pad: 48 }),
      grail: posterMaterial('CHASE THE GRAIL', 'every pack is a chance', 275),
      trade: posterMaterial('TRADE NIGHT FRIDAYS', 'bring your binder', 20),
    }),
    [],
  );

  return (
    <group>
      {/* west wall, above the gaps between the glass cabinets */}
      <Framed material={art.sanders} position={[-4.97, 2.5, -0.35]} rotationY={D90} w={0.5} h={0.67} />
      <Framed material={art.grail} position={[-4.97, 2.5, 1.95]} rotationY={D90} w={0.5} h={0.66} />
      <Framed material={art.manning} position={[-4.97, 2.45, 4.25]} rotationY={D90} w={0.5} h={0.7} />
      {/* north wall, west end (the jersey wall takes the rest) */}
      <Framed material={art.trade} position={[-4.3, 2.3, -3.97]} rotationY={0} w={0.5} h={0.66} />
      {/* east wall: the shop sign over the wax wall, behind Chris — seen from the entry */}
      <Framed material={art.banner} position={[8.97, 2.55, -0.4]} rotationY={-D90} w={1.5} h={0.6} />
      {/* south (barn-wood) wall, on the solid stretches between the windows and the door: Colts greats */}
      <Framed material={art.harrison} position={[-3.8, 1.7, 6.97]} rotationY={Math.PI} w={0.47} h={0.7} />
      <Framed material={art.wayne} position={[0.5, 1.7, 6.97]} rotationY={Math.PI} w={0.56} h={0.56} />
      <Framed material={art.mathis} position={[3.5, 1.7, 6.97]} rotationY={Math.PI} w={0.6} h={0.4} />
      <Framed material={art.freeney} position={[7.4, 1.7, 6.97]} rotationY={Math.PI} w={0.7} h={0.375} />
    </group>
  );
}
