import * as THREE from 'three';

// CC0 PBR texture sets from ambientCG (1K JPG), served from /public/textures.
// Textures stream in async — three.js picks them up as they load.

const loader = new THREE.TextureLoader();

function tex(file: string, opts: { srgb?: boolean; repeat: [number, number] }): THREE.Texture {
  const t = loader.load(`/textures/${file}`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(opts.repeat[0], opts.repeat[1]);
  if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface PBROptions {
  repeat: [number, number];
  color?: string; // tint multiplied over the color map
  roughness?: number;
  normalScale?: number;
}

function pbr(base: string, maps: { nrm?: boolean; rgh?: boolean }, opts: PBROptions): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: tex(`${base}_col.jpg`, { srgb: true, repeat: opts.repeat }),
    normalMap: maps.nrm ? tex(`${base}_nrm.jpg`, { repeat: opts.repeat }) : null,
    roughnessMap: maps.rgh ? tex(`${base}_rgh.jpg`, { repeat: opts.repeat }) : null,
    roughness: opts.roughness ?? 1,
    color: opts.color ?? '#ffffff',
  });
  if (opts.normalScale !== undefined && mat.normalMap) {
    mat.normalScale.set(opts.normalScale, opts.normalScale);
  }
  return mat;
}

/** Shared realistic materials — one instance per role, reused everywhere. */
export const PBR = {
  floor: pbr('floor', { nrm: true, rgh: true }, { repeat: [4, 3.2], color: '#c9a988' }),
  /** shelving / counter / door wood — walnut-stained fine wood */
  wood: pbr('wood', { nrm: true, rgh: true }, { repeat: [1.6, 1.6], color: '#8a6647' }),
  /** worn counter/shelf tops — same wood, lighter and glossier */
  woodTop: pbr('wood', { nrm: true, rgh: true }, { repeat: [2.2, 0.8], color: '#a87f58', roughness: 0.7 }),
  wall: pbr('plaster', { nrm: true }, { repeat: [7, 2.2], color: '#ece1cb' }),
  wainscot: pbr('wood', { nrm: true, rgh: true }, { repeat: [6, 0.9], color: '#6b4a2f' }),
  brick: pbr('brick', { nrm: true }, { repeat: [4.5, 1.6], color: '#b07a62' }),
};
