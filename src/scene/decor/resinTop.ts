import * as THREE from 'three';
import type { Card } from '@shared/types';
import { drawCardFront } from '../cards/cardArt';
import { mulberry32 } from '../../systems/rng';

// The bar's signature countertop: a collage of cards sealed under glossy resin. Drawn once from the
// shop's own (procedural) card art — a small sprite sheet of unique cards stamped many times at random
// angles, so it stays cheap. Real scans aren't used: the top is decor, not stock.

const SPRITE_W = 64;
const SPRITE_H = 89;

let cached: THREE.CanvasTexture | null = null;

/** One mosaic texture for every bar top (UVs span each top face once; aspect is roughly bar-shaped). */
export function resinCardTexture(cards: Card[]): THREE.CanvasTexture {
  if (cached) return cached;
  const rand = mulberry32(20260929);
  // sprite sheet of up to 48 unique cards
  const pool = cards.filter((c) => c.status !== 'personal').slice(0, 48);
  const cols = 8;
  const rows = Math.max(1, Math.ceil(pool.length / cols));
  const sheet = document.createElement('canvas');
  sheet.width = cols * SPRITE_W;
  sheet.height = rows * SPRITE_H;
  const sg = sheet.getContext('2d')!;
  pool.forEach((c, i) => drawCardFront(sg, c, (i % cols) * SPRITE_W, Math.floor(i / cols) * SPRITE_H, SPRITE_W, SPRITE_H));

  const W = 4096;
  const H = 512;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d')!;
  g.fillStyle = '#15161a';
  g.fillRect(0, 0, W, H);
  if (pool.length) {
    const n = 900;
    for (let k = 0; k < n; k++) {
      const i = Math.floor(rand() * pool.length);
      const sx = (i % cols) * SPRITE_W;
      const sy = Math.floor(i / cols) * SPRITE_H;
      g.save();
      g.translate(rand() * W, rand() * H);
      g.rotate((rand() - 0.5) * Math.PI * 0.9);
      g.drawImage(sheet, sx, sy, SPRITE_W, SPRITE_H, -SPRITE_W / 2, -SPRITE_H / 2, SPRITE_W, SPRITE_H);
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(out);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cached = t;
  return t;
}
