import * as THREE from 'three';

/**
 * Re-project a geometry's UVs into metres by each vertex's dominant normal axis (box/triplanar style),
 * so a texture keeps one real-world scale across differently-sized pieces. Pass the mesh's world
 * `offset` so adjacent pieces (e.g. wall segments around a window) line up seamlessly.
 * Materials using this want `repeat = [1, 1]`; `tile` is how many metres one texture repeat spans.
 */
export function metreUVs(g: THREE.BufferGeometry, tile = 1, offset: readonly [number, number, number] = [0, 0, 0]) {
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + offset[0];
    const y = pos.getY(i) + offset[1];
    const z = pos.getZ(i) + offset[2];
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      u = z;
      v = y;
    } else if (ay >= az) {
      u = x;
      v = z;
    } else {
      u = x;
      v = y;
    }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** A box with metre-scale UVs (see metreUVs). */
export function metreBox(w: number, h: number, d: number, tile = 1, offset: readonly [number, number, number] = [0, 0, 0]) {
  return metreUVs(new THREE.BoxGeometry(w, h, d), tile, offset);
}
