import type * as THREE from 'three';

// cardId → its mounted home Object3D (shelf/bin/case slot).
// Not reactive state — CardInHand reads world transforms from it at frame time.
const registry = new Map<string, THREE.Object3D>();

export function registerCard(id: string, obj: THREE.Object3D) {
  registry.set(id, obj);
}

export function unregisterCard(id: string) {
  registry.delete(id);
}

export function getCardHome(id: string): THREE.Object3D | undefined {
  return registry.get(id);
}
