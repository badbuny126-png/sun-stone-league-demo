import * as THREE from 'three';

const WORLD_SIZE = 120;
const RESOURCE_TYPES = [
  { id: 'wood', color: 0x9b5b2e },
  { id: 'stone', color: 0x8d9692 },
  { id: 'fiber', color: 0x70a94b }
];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

export function createAdventureWorld(scene, seed = 2407) {
  const random = seededRandom(seed);
  const root = new THREE.Group();
  root.name = 'lost-courts-jungle';
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE), new THREE.MeshStandardMaterial({ color: 0x526b3c, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08; root.add(ground);
  const water = new THREE.Mesh(new THREE.BoxGeometry(12, 0.18, WORLD_SIZE), new THREE.MeshStandardMaterial({ color: 0x287f83, roughness: 0.25, metalness: 0.12, transparent: true, opacity: 0.86 }));
  water.position.set(25, 0.02, 0); root.add(water);

  const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 7);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x765039, roughness: 1 });
  const canopyGeometry = new THREE.IcosahedronGeometry(1.7, 1);
  const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x32683d, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, 90);
  const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, 90);
  const dummy = new THREE.Object3D(); let treeCount = 0;
  for (let i = 0; i < 90; i += 1) {
    const x = (random() - 0.5) * 106, z = (random() - 0.5) * 106;
    if (Math.hypot(x, z) < 12 || Math.abs(x - 25) < 8) continue;
    dummy.position.set(x, 1.6, z); dummy.rotation.set(0, random() * Math.PI, 0); dummy.scale.setScalar(0.8 + random() * 0.6); dummy.updateMatrix(); trunks.setMatrixAt(treeCount, dummy.matrix);
    dummy.position.y = 3.65; dummy.scale.set(1.1, 0.9 + random() * 0.35, 1.1); dummy.updateMatrix(); canopies.setMatrixAt(treeCount, dummy.matrix); treeCount += 1;
  }
  trunks.count = treeCount; canopies.count = treeCount; root.add(trunks, canopies);

  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({ color: 0x777b6b, roughness: 1 }), 42);
  for (let i = 0; i < 42; i += 1) {
    const x = (random() - 0.5) * 100, z = (random() - 0.5) * 100;
    dummy.position.set(x, 0.35, z); dummy.rotation.set(random(), random() * 3, random()); dummy.scale.set(0.7 + random(), 0.5 + random() * 0.5, 0.7 + random()); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
  }
  root.add(rocks);

  const resources = [], resourceGeometry = new THREE.OctahedronGeometry(0.48, 0);
  for (let i = 0; i < 30; i += 1) {
    const type = RESOURCE_TYPES[i % RESOURCE_TYPES.length], x = (random() - 0.5) * 76, z = (random() - 0.5) * 76;
    if (Math.hypot(x, z) < 7) continue;
    const mesh = new THREE.Mesh(resourceGeometry, new THREE.MeshStandardMaterial({ color: type.color, emissive: type.color, emissiveIntensity: 0.12 }));
    mesh.position.set(x, 0.62, z); root.add(mesh); resources.push({ mesh, type, collected: false });
  }

  const stone = new THREE.MeshStandardMaterial({ color: 0x9a8c6e, roughness: 1 }), ruin = new THREE.Group();
  for (let i = 0; i < 5; i += 1) { const step = new THREE.Mesh(new THREE.BoxGeometry(7 - i * 1.1, 0.7, 5 - i * 0.7), stone); step.position.set(-25, 0.35 + i * 0.7, -30 - i * 0.2); ruin.add(step); }
  const altar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 1), stone); altar.position.set(-25, 3.1, -30); ruin.add(altar); root.add(ruin);
  const light = new THREE.PointLight(0xffbd70, 14, 24); light.position.set(-25, 5, -30); root.add(light);
  scene.add(root);
  return {
    root, resources,
    update(time) { for (const item of resources) if (!item.collected) item.mesh.rotation.y = time * 0.8; water.position.z = Math.sin(time * 0.18) * 0.35; },
    harvest(position, radius = 2.6) {
      const item = resources.find((entry) => !entry.collected && entry.mesh.position.distanceTo(position) <= radius);
      if (!item) return null; item.collected = true; root.remove(item.mesh); return item.type.id;
    },
    dispose() { scene.remove(root); root.traverse((object) => { if (object.isMesh) { object.geometry.dispose(); if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose()); else object.material.dispose(); } }); }
  };
}

export const ADVENTURE_WORLD_SIZE = WORLD_SIZE;
