import * as THREE from 'three';

export const COURT_LENGTH = 34;   // along Z
export const COURT_WIDTH = 12;    // along X
export const WALL_HEIGHT = 7;
export const RING_HEIGHT = 6.2;
export const RING_RADIUS = 1.15;
export const RING_TUBE = 0.16;

/**
 * Builds the ballcourt (floor, sloped side walls, end walls, ring) and
 * adds everything to the given scene.
 * Returns references needed by ball/game logic (ring mesh + its world position).
 */
export function createCourt(scene) {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a7357, roughness: 0.95, metalness: 0.02 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xb99a68, roughness: 0.9, metalness: 0.02 });
  const glyphMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(COURT_WIDTH, 0.4, COURT_LENGTH), floorMat);
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  scene.add(floor);

  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(COURT_WIDTH, 0.02, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x2f9e6f, roughness: 0.6 })
  );
  centerLine.position.set(0, 0.01, 0);
  scene.add(centerLine);

  function makeSlopedWall(sign) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(2.5, 0);
    shape.lineTo(1.0, WALL_HEIGHT);
    shape.lineTo(0, WALL_HEIGHT);
    shape.closePath();
    const extrude = new THREE.ExtrudeGeometry(shape, { depth: COURT_LENGTH, bevelEnabled: false });
    const mesh = new THREE.Mesh(extrude, stoneMat);
    mesh.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    mesh.position.set(sign * (COURT_WIDTH / 2), 0, -COURT_LENGTH / 2);
    if (sign > 0) mesh.position.z += COURT_LENGTH;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  scene.add(makeSlopedWall(1), makeSlopedWall(-1));

  for (let i = -1; i <= 1; i++) {
    for (const side of [-1, 1]) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), glyphMat);
      block.position.set(side * (COURT_WIDTH / 2 + 1.6), 3.6, i * 10);
      block.castShadow = true;
      scene.add(block);
    }
  }

  function makeEndWall(sign) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(COURT_WIDTH + 5, WALL_HEIGHT * 0.6, 1), stoneMat);
    wall.position.set(0, WALL_HEIGHT * 0.3, sign * (COURT_LENGTH / 2 + 0.5));
    wall.castShadow = true;
    wall.receiveShadow = true;
    return wall;
  }
  scene.add(makeEndWall(1), makeEndWall(-1));

  // Scoring ring, mounted on the +X wall, centered
  const ringGroup = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xe8a33d, roughness: 0.4, metalness: 0.3,
    emissive: 0x442200, emissiveIntensity: 0.15,
  });
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 16, 40), ringMat);
  ringMesh.rotation.y = Math.PI / 2;
  ringMesh.position.set(COURT_WIDTH / 2 - 0.05, RING_HEIGHT, 0);
  ringMesh.castShadow = true;
  ringGroup.add(ringMesh);

  const backing = new THREE.Mesh(new THREE.CylinderGeometry(RING_RADIUS + 0.5, RING_RADIUS + 0.5, 0.3, 32), stoneMat);
  backing.rotation.z = Math.PI / 2;
  backing.position.set(COURT_WIDTH / 2 + 0.2, RING_HEIGHT, 0);
  backing.castShadow = true;
  ringGroup.add(backing);
  scene.add(ringGroup);

  const ringWorldPos = new THREE.Vector3();
  ringMesh.getWorldPosition(ringWorldPos);

  return { ringMesh, ringWorldPos };
}

export function addLighting(scene) {
  const hemi = new THREE.HemisphereLight(0xfff2d0, 0x2a1c10, 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffdca0, 2.0);
  sun.position.set(18, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 80;
  scene.add(sun);
}
