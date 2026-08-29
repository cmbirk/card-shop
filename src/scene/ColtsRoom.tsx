import { useMemo } from 'react';
import * as THREE from 'three';
import { ANNEX, ANNEX_DOOR } from '@shared/data/shopLayout';
import { showcase, type ShowcaseItem } from '@shared/data/showcase';
import { MAT, makeLabelMaterial } from './materials';
import { Framed } from './WallArt';

// The Colts Room's memorabilia: all primitives + canvas textures, no assets, no logos
// (team colours, numbers and a plain horseshoe shape only — the marks are the NFL's).

const BLUE = '#002C5F';
const WHITE = '#f4f4f2';

function canvasMaterial(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, cutout = false): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // cutouts (pennants) use alphaTest, not blending — transparent decor steals clicks and sorts badly
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, ...(cutout ? { alphaTest: 0.5, side: THREE.DoubleSide } : {}) });
}

/** A jersey laid flat in a shadowbox: body, sleeves, collar, big number. */
function jerseyMaterial(num: string, home: boolean): THREE.MeshStandardMaterial {
  return canvasMaterial(512, 640, (ctx) => {
    const body = home ? BLUE : WHITE;
    const trim = home ? WHITE : BLUE;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 512, 640); // black felt backing
    ctx.fillStyle = body;
    // sleeves
    ctx.beginPath();
    ctx.moveTo(60, 110);
    ctx.lineTo(160, 60);
    ctx.lineTo(352, 60);
    ctx.lineTo(452, 110);
    ctx.lineTo(500, 230);
    ctx.lineTo(400, 260);
    ctx.lineTo(400, 600);
    ctx.lineTo(112, 600);
    ctx.lineTo(112, 260);
    ctx.lineTo(12, 230);
    ctx.closePath();
    ctx.fill();
    // sleeve stripes
    ctx.fillStyle = trim;
    ctx.fillRect(14, 170, 100, 14);
    ctx.fillRect(398, 170, 100, 14);
    // collar
    ctx.beginPath();
    ctx.ellipse(256, 70, 70, 26, 0, 0, Math.PI, false);
    ctx.fillStyle = trim;
    ctx.fill();
    // number
    ctx.fillStyle = trim;
    ctx.font = 'bold 260px Impact, "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(num, 256, 400);
    ctx.lineWidth = 8;
    ctx.strokeStyle = home ? '#8fb4ff' : '#123a6b';
    ctx.strokeText(num, 256, 400);
  });
}

/** Felt pennant with block text. */
function pennantMaterial(text: string): THREE.MeshStandardMaterial {
  return canvasMaterial(640, 256, (ctx) => {
    ctx.clearRect(0, 0, 640, 256);
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(640, 128);
    ctx.lineTo(0, 256);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.fillStyle = WHITE;
    ctx.font = `bold ${text.length > 6 ? 60 : 96}px Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 40, 128);
  }, true);
}

/** Three ticket stubs on a matboard. */
function ticketsMaterial(lines: string[]): THREE.MeshStandardMaterial {
  return canvasMaterial(640, 400, (ctx) => {
    ctx.fillStyle = '#efe6c8';
    ctx.fillRect(0, 0, 640, 400);
    lines.forEach((line, i) => {
      const y = 40 + i * 115;
      ctx.save();
      ctx.translate(320, y + 45);
      ctx.rotate((i - 1) * 0.04);
      ctx.fillStyle = i % 2 ? '#dfe7f5' : '#f7f3e8';
      ctx.fillRect(-270, -42, 540, 84);
      ctx.strokeStyle = BLUE;
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 3;
      ctx.strokeRect(-270, -42, 540, 84);
      ctx.setLineDash([]);
      ctx.fillStyle = BLUE;
      ctx.fillRect(-270, -42, 60, 84);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 28px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(line, -190, 0);
      ctx.restore();
    });
  });
}

function SignedBall({ item }: { item: ShowcaseItem }) {
  const leather = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b3f22', roughness: 0.9 }), []);
  return (
    <group position={item.position} rotation-y={item.rotationY}>
      {/* plinth + walnut stand */}
      <mesh material={MAT.walnut} position={[0, -item.position[1] / 2 - 0.04, 0]} castShadow>
        <boxGeometry args={[0.24, item.position[1] - 0.08, 0.24]} />
      </mesh>
      <mesh material={MAT.walnut} position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.03, 24]} />
      </mesh>
      <mesh material={MAT.walnut} position={[0, -0.02, 0]}>
        <torusGeometry args={[0.05, 0.008, 8, 24]} />
      </mesh>
      {/* ball: a stretched sphere reads as a football */}
      <mesh material={leather} position={[0, 0.06, 0]} scale={[0.145, 0.085, 0.085]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      {/* laces */}
      {[-0.03, -0.015, 0, 0.015, 0.03].map((x) => (
        <mesh key={x} position={[x, 0.145, 0]}>
          <boxGeometry args={[0.006, 0.006, 0.022]} />
          <meshStandardMaterial color={WHITE} roughness={0.8} />
        </mesh>
      ))}
      {/* the signature — a silver scrawl on the panel */}
      <mesh position={[0, 0.09, 0.075]} rotation-x={-0.4}>
        <planeGeometry args={[0.07, 0.02]} />
        <meshStandardMaterial color="#c9ccd1" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

function StadiumSeat({ item }: { item: ShowcaseItem }) {
  const plastic = useMemo(() => new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.6 }), []);
  return (
    <group position={item.position} rotation-y={item.rotationY}>
      {/* seat pan */}
      <mesh material={plastic} position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.5, 0.06, 0.45]} />
      </mesh>
      {/* back */}
      <mesh material={plastic} position={[0, 0.72, -0.2]} rotation-x={-0.12} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.05]} />
      </mesh>
      {/* frame + seat number plate */}
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} material={MAT.dark} position={[x, 0.24, -0.05]}>
          <boxGeometry args={[0.04, 0.48, 0.3]} />
        </mesh>
      ))}
      <mesh material={makeLabelMaterial('SEC 3xx · ROW 12 · SEAT 7', { bg: '#efe6c8', fg: '#1a1a1a', size: 30 })} position={[0, 0.9, -0.19]}>
        <planeGeometry args={[0.24, 0.06]} />
      </mesh>
    </group>
  );
}

/** Sign over the doorway (main-room side) + the room's memorabilia. */
export function ColtsRoom() {
  const mats = useMemo(
    () => ({
      j18: jerseyMaterial('18', true),
      j88: jerseyMaterial('88', false),
      pennants: new Map(showcase.filter((i) => i.kind === 'pennant').map((i) => [i.id, pennantMaterial(i.detail ?? '')])),
      tickets: ticketsMaterial((showcase.find((i) => i.kind === 'tickets')?.detail ?? '').split('|')),
      doorSign: makeLabelMaterial('The Colts Room', { bg: BLUE, fg: WHITE, size: 44 }),
      insideSign: makeLabelMaterial('Not for sale — ask Chris', { bg: '#efe6c8', fg: '#1a1a1a', size: 30 }),
    }),
    [],
  );

  return (
    <group>
      {/* sign over the doorway, facing into the main shop */}
      <mesh material={mats.doorSign} position={[ANNEX.xMax + 0.05, ANNEX_DOOR.height + 0.32, ANNEX_DOOR.z]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.1, 0.26]} />
      </mesh>
      {/* small plaque inside, beside the case */}
      <mesh material={mats.insideSign} position={[ANNEX.xMin + 0.02, 1.35, -3.2 + 1.35]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.7, 0.12]} />
      </mesh>

      {showcase.map((item) => {
        switch (item.kind) {
          case 'jersey':
            return <Framed key={item.id} material={item.detail === '18' ? mats.j18 : mats.j88} position={item.position} rotationY={item.rotationY} w={0.7} h={0.88} />;
          case 'pennant':
            return (
              <mesh key={item.id} material={mats.pennants.get(item.id)} position={item.position} rotation-y={item.rotationY} raycast={() => null}>
                <planeGeometry args={[0.9, 0.36]} />
              </mesh>
            );
          case 'tickets':
            return <Framed key={item.id} material={mats.tickets} position={item.position} rotationY={item.rotationY} w={0.64} h={0.4} />;
          case 'football':
            return <SignedBall key={item.id} item={item} />;
          case 'seat':
            return <StadiumSeat key={item.id} item={item} />;
          default:
            return null;
        }
      })}
    </group>
  );
}
