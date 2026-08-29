import { useMemo } from 'react';
import * as THREE from 'three';
import { SHOP_NAME } from '@shared/launch';
import type { Sport } from '@shared/types';
import { mulberry32, spread } from '../../systems/rng';

// Sealed-product props (wax boxes, blasters, a tin) that dress the empty
// lower shelf rows — called for in the original scene spec.

const SPORT_HUES: Record<Sport, number> = { baseball: 215, basketball: 20, football: 140, hockey: 200, tcg: 275 };

const boxMatCache = new Map<string, THREE.Material[]>();

function productMaterials(sport: Sport, variant: number): THREE.Material[] {
  const key = `${sport}-${variant}`;
  const cached = boxMatCache.get(key);
  if (cached) return cached;
  const hue = SPORT_HUES[sport];
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 196;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 196);
  grad.addColorStop(0, `hsl(${hue}, 55%, ${40 + variant * 8}%)`);
  grad.addColorStop(1, `hsl(${hue}, 60%, 22%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 196);
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = '#fff';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = 2 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(128, 108);
    ctx.lineTo(128 + Math.cos(a) * 200, 108 + Math.sin(a) * 200);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#ffd97a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText(SHOP_NAME, 128, 58);
  ctx.fillStyle = '#efe6c8';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(variant === 0 ? 'WAX PACKS' : 'BLASTER BOX', 128, 96);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`${sport.toUpperCase()} · SERIES ${variant + 1}`, 128, 128);
  ctx.strokeStyle = '#efe6c8';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 240, 180);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  const side = new THREE.MeshStandardMaterial({ color: `hsl(${hue}, 45%, 26%)`, roughness: 0.8 });
  // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z
  const mats = [side, side, side, side, front, side];
  boxMatCache.set(key, mats);
  return mats;
}

const tinMat = new THREE.MeshStandardMaterial({ color: '#b8bcc4', metalness: 0.85, roughness: 0.35 });

/** A row of sealed product on one shelf board (local shelf space, board at `y`). */
export function ProductRow({ sport, y, seed }: { sport: Sport; y: number; seed: number }) {
  const items = useMemo(() => {
    const rand = mulberry32(seed);
    const out: { x: number; rotY: number; variant: number; lying: boolean }[] = [];
    const count = 4 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      out.push({
        x: (i - (count - 1) / 2) * 0.34 + spread(rand) * 0.03,
        rotY: spread(rand) * 0.18,
        variant: Math.floor(rand() * 2),
        lying: rand() < 0.25,
      });
    }
    return out;
  }, [sport, seed]);

  return (
    <group position-y={y}>
      {items.map((it, i) => (
        <group key={i} position={[it.x, 0, 0.06]} rotation-y={it.rotY}>
          {it.lying ? (
            <mesh material={productMaterials(sport, it.variant)} position-y={0.048} rotation-x={-Math.PI / 2} castShadow>
              <boxGeometry args={[0.2, 0.155, 0.095]} />
            </mesh>
          ) : (
            <mesh material={productMaterials(sport, it.variant)} position-y={0.093} castShadow>
              <boxGeometry args={[0.2, 0.155, 0.095]} />
            </mesh>
          )}
        </group>
      ))}
      {/* one collector tin per row for variety */}
      <mesh material={tinMat} position={[items.length * 0.17 + 0.12, 0.075, 0.06]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.12, 20]} />
      </mesh>
    </group>
  );
}
