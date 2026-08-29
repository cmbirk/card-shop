import { useMemo } from 'react';
import * as THREE from 'three';
import type { Card } from '@shared/types';
import { SLAB_SIZE, CARD_SIZE } from '@shared/data/shopLayout';
import { makeSlabLabelTexture } from './cardArt';

// A realistic graded-card holder: clear plastic shell, a company-colored
// grading label above the card window, and a subtle branded foot. The card
// faces render inside it (drawn by the parent). All meshes here are
// decorative — raycast is disabled so clicks pass through to the card.

const noRay = () => null;

const shellMat = new THREE.MeshPhysicalMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.08,
  roughness: 0.12,
  metalness: 0,
  transmission: 0.4,
  thickness: 0.01,
});
const edgeMat = new THREE.MeshPhysicalMaterial({ color: '#eef1f4', transparent: true, opacity: 0.32, roughness: 0.15 });
const footMat = new THREE.MeshStandardMaterial({ color: '#e8eaee', roughness: 0.5 });

/** The plastic holder + grading label. Sized SLAB_SIZE (or the wide horizontal holder), card window centered. */
export function Slab({ card }: { card: Card }) {
  const labelTex = useMemo(() => makeSlabLabelTexture(card), [card]);
  const labelMat = useMemo(() => new THREE.MeshBasicMaterial({ map: labelTex }), [labelTex]);

  // horizontal cards sit sideways in a wider holder; the label stays on top
  const cardW = card.landscape ? CARD_SIZE.h : CARD_SIZE.w;
  const cardH = card.landscape ? CARD_SIZE.w : CARD_SIZE.h;
  const labelH = (SLAB_SIZE.h - CARD_SIZE.h) / 2 - 0.004; // same label band either way
  const W = card.landscape ? cardW + (SLAB_SIZE.w - CARD_SIZE.w) : SLAB_SIZE.w;
  const H = card.landscape ? cardH + 2 * (labelH + 0.004) : SLAB_SIZE.h;
  const T = SLAB_SIZE.t;
  const labelY = cardH / 2 + 0.004 + labelH / 2;
  const zFront = T / 2;

  return (
    <group>
      {/* clear shell (front + back panes) */}
      <mesh material={shellMat} raycast={noRay} position-z={zFront - 0.0005}>
        <boxGeometry args={[W, H, 0.001]} />
      </mesh>
      <mesh material={shellMat} raycast={noRay} position-z={-zFront + 0.0005}>
        <boxGeometry args={[W, H, 0.001]} />
      </mesh>
      {/* holder edges */}
      {([[0, H / 2], [0, -H / 2]] as const).map(([x, y]) => (
        <mesh key={`h${y}`} material={edgeMat} raycast={noRay} position={[x, y, 0]}>
          <boxGeometry args={[W, 0.006, T]} />
        </mesh>
      ))}
      {([[-W / 2, 0], [W / 2, 0]] as const).map(([x, y]) => (
        <mesh key={`v${x}`} material={edgeMat} raycast={noRay} position={[x, y, 0]}>
          <boxGeometry args={[0.006, H, T]} />
        </mesh>
      ))}
      {/* grading label above the card */}
      <mesh material={labelMat} raycast={noRay} position={[0, labelY, zFront - 0.0004]}>
        <planeGeometry args={[W - 0.006, labelH]} />
      </mesh>
      {/* white foot below the card */}
      <mesh material={footMat} raycast={noRay} position={[0, -(cardH / 2 + 0.004 + labelH / 2), zFront - 0.0006]}>
        <planeGeometry args={[W - 0.006, labelH]} />
      </mesh>
    </group>
  );
}
