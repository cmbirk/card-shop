import * as THREE from 'three';
import { PBR } from './pbr';
import { LOOK } from './look';

// Cozy hobby-shop palette. Structural surfaces use CC0 PBR texture sets
// (see pbr.ts); accents stay flat-colored.
export const MAT = {
  floor: PBR.floor,
  carpet: PBR.carpet,
  barnwood: PBR.barnwood,
  stone: PBR.stone,
  trim: new THREE.MeshStandardMaterial({ color: '#f1f2f0', roughness: 0.55 }),
  /** brushed aluminium (cabinet frames) */
  alu: new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.85, roughness: 0.35 }),
  /** dark stained wood (bar-top edge band) */
  barEdge: new THREE.MeshStandardMaterial({ color: '#3a2a1f', roughness: 0.45 }),
  /** white card-storage cardboard (dime boxes, sleeve boxes) */
  cardboxWhite: new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.9 }),
  /** dark brown leather (bar-stool seats) */
  leather: new THREE.MeshStandardMaterial({ color: '#3b2b22', roughness: 0.55 }),
  /** black powder-coated metal (stool frames, table legs) */
  blackMetal: new THREE.MeshStandardMaterial({ color: '#1f2023', roughness: 0.4, metalness: 0.6 }),
  /** dark felt (showcase risers) */
  felt: new THREE.MeshStandardMaterial({ color: '#2a2c31', roughness: 1 }),
  wall: PBR.wall,
  wainscot: PBR.wainscot,
  walnut: PBR.wood,
  wornTop: PBR.woodTop,
  green: new THREE.MeshStandardMaterial({ color: '#2e5e4e', roughness: 0.9 }),
  cream: new THREE.MeshStandardMaterial({ color: '#efe6c8', roughness: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.6 }),
  cardboard: new THREE.MeshStandardMaterial({ color: '#b08d5f', roughness: 1 }),
  // cabinet glass: faint and front-face only, so cases read clear rather than milky
  glass: new THREE.MeshPhysicalMaterial({
    color: '#eef6f6',
    transparent: true,
    opacity: 0.08,
    roughness: 0.05,
    metalness: 0,
    envMapIntensity: 0.5,
  }),
  /** light-grey laminate for cabinet backs and bases (pure white blooms and washes the cards out) */
  laminate: new THREE.MeshStandardMaterial({ color: '#c9cdd2', roughness: 0.6 }),
  skin: new THREE.MeshStandardMaterial({ color: '#e0b08c', roughness: 0.8 }),
  flannel: new THREE.MeshStandardMaterial({ color: '#a63d40', roughness: 0.95 }),
};

/** Black acoustic drop ceiling: 2x2 ft tiles in a dark T-bar grid (procedural — no texture file). */
function dropCeilingTexture(): THREE.CanvasTexture {
  const n = 512; // one canvas = 2 x 2 tiles = 1.22 m
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1c1d20';
  g.fillRect(0, 0, n, n);
  // fissured-tile speckle
  for (let i = 0; i < 9000; i++) {
    const v = 22 + Math.random() * 16;
    g.fillStyle = `rgb(${v},${v},${v + 2})`;
    g.fillRect(Math.random() * n, Math.random() * n, 1 + Math.random() * 2, 1);
  }
  // T-bar grid, a touch lighter than the tiles
  g.fillStyle = '#34363b';
  for (const p of [0, n / 2]) {
    g.fillRect(p, 0, 6, n);
    g.fillRect(0, p, n, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
export const dropCeilingMat = new THREE.MeshStandardMaterial({ map: dropCeilingTexture(), roughness: 0.95 });

/** Shared LED-strip emitter (HDR colour > 1, so it blooms). Visual only — never a light. */
export const ledStripMat = new THREE.MeshBasicMaterial({ color: LOOK.ledStrip });

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

const imageCache = new Map<string, THREE.MeshBasicMaterial>();

/**
 * Sign painted from an image URL (SVG welcome — it's rasterised onto the canvas at the requested
 * pixel size, so it stays crisp on a big storefront board). The board colour paints immediately;
 * the artwork lands when the image loads.
 */
export function makeImageMaterial(
  url: string,
  opts: { width: number; height: number; bg?: string; pad?: number },
): THREE.MeshBasicMaterial {
  const key = `${url}|${opts.width}x${opts.height}|${opts.bg}|${opts.pad}`;
  const cached = imageCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = opts.width;
  c.height = opts.height;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const paint = (img?: HTMLImageElement) => {
    ctx.fillStyle = opts.bg ?? '#f2e8d5';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#00000033';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, c.width - 12, c.height - 12);
    if (img) {
      const pad = opts.pad ?? 0;
      const s = Math.min((c.width - pad * 2) / img.width, (c.height - pad * 2) / img.height);
      const dw = img.width * s;
      const dh = img.height * s;
      ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    }
    tex.needsUpdate = true;
  };
  paint();
  const img = new Image();
  img.onload = () => paint(img);
  img.src = url;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  imageCache.set(key, mat);
  return mat;
}
