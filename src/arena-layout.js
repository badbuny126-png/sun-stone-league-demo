import * as THREE from 'three';

// Measured court in the supplied OBJ, excluding the surrounding landscape.
export const ARENA_LAYOUT = Object.freeze({ scale: 84, centerX: -.165, centerZ: .115, floorY: .0042 });
export function alignArena(model) {
  const { scale, centerX, centerZ, floorY } = ARENA_LAYOUT;
  model.rotation.set(0, Math.PI/2, 0);
  model.scale.setScalar(scale);
  model.position.set(-centerZ*scale, -floorY*scale, centerX*scale);
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
}
