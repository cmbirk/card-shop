import * as THREE from 'three';

// Cozy hobby-shop palette — flat colors, one shared material per role.
export const MAT = {
  floor: new THREE.MeshStandardMaterial({ color: '#8b5e3c', roughness: 0.9 }),
  wall: new THREE.MeshStandardMaterial({ color: '#f2e8d5', roughness: 0.95 }),
  wainscot: new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 0.9 }),
  walnut: new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.85 }),
  wornTop: new THREE.MeshStandardMaterial({ color: '#7a5a3f', roughness: 0.75 }),
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

/** Plank-stripe canvas texture for the floor — cheap wood feel, no assets. */
export function makeFloorMaterial(): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8b5e3c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    const y = i * 32;
    ctx.fillStyle = i % 2 ? '#84573630' : '#93684530';
    ctx.fillRect(0, y, 256, 32);
    ctx.fillStyle = '#5c403366';
    ctx.fillRect(0, y, 256, 2);
    // plank end seams, offset per row
    ctx.fillRect(((i * 96) % 256) + 24, y, 2, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 4);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
}

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
