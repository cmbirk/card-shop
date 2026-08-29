import * as THREE from 'three';
import { PBR } from './pbr';

// Cozy hobby-shop palette. Structural surfaces use CC0 PBR texture sets
// (see pbr.ts); accents stay flat-colored.
export const MAT = {
  floor: PBR.floor,
  wall: PBR.wall,
  wainscot: PBR.wainscot,
  walnut: PBR.wood,
  wornTop: PBR.woodTop,
  green: new THREE.MeshStandardMaterial({ color: '#2e5e4e', roughness: 0.9 }),
  cream: new THREE.MeshStandardMaterial({ color: '#efe6c8', roughness: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.6 }),
  cardboard: new THREE.MeshStandardMaterial({ color: '#b08d5f', roughness: 1 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#cfe8e8',
    transparent: true,
    opacity: 0.14,
    roughness: 0.05,
    metalness: 0,
    side: THREE.DoubleSide,
  }),
  skin: new THREE.MeshStandardMaterial({ color: '#e0b08c', roughness: 0.8 }),
  flannel: new THREE.MeshStandardMaterial({ color: '#a63d40', roughness: 0.95 }),
};

const labelCache = new Map<string, THREE.MeshBasicMaterial>();

/** Canvas-texture sign label — no font assets, no network. */
export function makeLabelMaterial(text: string, opts?: { bg?: string; fg?: string; size?: number }): THREE.MeshBasicMaterial {
  const key = `${text}|${opts?.bg}|${opts?.fg}`;
  const cached = labelCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = opts?.bg ?? '#4a3423';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#00000033';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, c.width - 8, c.height - 8);
  ctx.fillStyle = opts?.fg ?? '#f2e8d5';
  ctx.font = `bold ${opts?.size ?? 64}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let label = text.toUpperCase();
  while (ctx.measureText(label).width > c.width - 48 && label.length > 3) label = label.slice(0, -2) + '…';
  ctx.fillText(label, c.width / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  labelCache.set(key, mat);
  return mat;
}
