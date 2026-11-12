import * as THREE from 'three';

const WORLD_SIZE = 120;
const RESOURCE_TYPES = [
  { id: 'wood', color: 0xb8783e },
  { id: 'stone', color: 0xaab2a5 },
  { id: 'fiber', color: 0x8fcb55 }
];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

function smoothHill(x, z, cx, cz, radius, height) {
  const distance = Math.hypot(x - cx, z - cz) / radius;
  return distance >= 1 ? 0 : height * (1 - distance * distance) ** 2;
}

function terrainHeight(x, z) {
  if (Math.abs(x - 25) < 5 && Math.abs(z) < 2.7) return 0.42;
  const hills = smoothHill(x, z, -34, -31, 25, 1.5)
    + smoothHill(x, z, -38, 30, 24, 1.05)
    + smoothHill(x, z, 4, 45, 22, 0.85);
  const riverValley = Math.exp(-(((x - 25) / 8) ** 2)) * 0.62;
  const rolling = (Math.sin(x * 0.105) * Math.cos(z * 0.082) + Math.sin((x + z) * 0.052) * 0.45) * 0.16;
  const spawnClearing = Math.min(1, Math.hypot(x, z) / 13);
  return Math.max(-0.05, (hills + rolling - riverValley) * spawnClearing);
}

function addInstanced(root, geometry, material, positions, makeTransform) {
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach((position, index) => {
    makeTransform(dummy, position, index);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

export function createAdventureWorld(scene, seed = 2407) {
  const random = seededRandom(seed);
  const root = new THREE.Group();
  root.name = 'lost-courts-jungle';
  const groundGeometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 64, 64);
  const vertices = groundGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i += 1) vertices.setZ(i, terrainHeight(vertices.getX(i), -vertices.getY(i)));
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ color: 0x657b43, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  root.add(ground);

  const water = new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 0.2, WORLD_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x258b91, roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.88 })
  );
  water.position.set(25, 0.04, 0);
  root.add(water);
  const bridge = new THREE.Group();
  const bridgeStone = new THREE.MeshStandardMaterial({ color: 0x887d62, roughness: 0.94 });
  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.22, 5.6), bridgeStone);
  bridgeDeck.position.set(25, 0.23, 0);
  bridge.add(bridgeDeck);
  const bridgeTimber = new THREE.MeshStandardMaterial({ color: 0x765039, roughness: 1 });
  for (let plank = 0; plank < 7; plank += 1) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.62), bridgeTimber);
    board.position.set(25, 0.38, -2.25 + plank * 0.75);
    bridge.add(board);
  }
  root.add(bridge);
  const bankMaterial = new THREE.MeshStandardMaterial({ color: 0x87734e, roughness: 1 });
  for (const side of [-1, 1]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.48, WORLD_SIZE), bankMaterial);
    bank.position.set(25 + side * 4.4, 0.05, 0);
    root.add(bank);
  }

  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.34, 3.2, 7);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x765039, roughness: 1 });
  const canopyGeometry = new THREE.IcosahedronGeometry(1.65, 1);
  const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const treePositions = [];
  for (let i = 0; i < 112; i += 1) {
    const x = (random() - 0.5) * 108, z = (random() - 0.5) * 108;
    if (Math.hypot(x, z) < 13 || Math.abs(x - 25) < 7.5) continue;
    treePositions.push({ x, z, y: terrainHeight(x, z), scale: 0.78 + random() * 0.62, color: [0x285d35, 0x397346, 0x477d3c][Math.floor(random() * 3)] });
  }
  addInstanced(root, trunkGeometry, trunkMaterial, treePositions, (dummy, p) => {
    dummy.position.set(p.x, p.y + 1.6 * p.scale, p.z);
    dummy.rotation.y = random() * Math.PI;
    dummy.scale.setScalar(p.scale);
  });
  const canopies = addInstanced(root, canopyGeometry, canopyMaterial, treePositions, (dummy, p, i) => {
    dummy.position.set(p.x, p.y + 3.55 * p.scale, p.z);
    dummy.scale.set(1.05 * p.scale, (0.88 + random() * 0.32) * p.scale, 1.05 * p.scale);
    dummy.rotation.y = i * 0.71;
  });
  treePositions.forEach((p, i) => canopies.setColorAt(i, new THREE.Color(p.color)));
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;

  const rockPositions = [];
  for (let i = 0; i < 54; i += 1) {
    const x = (random() - 0.5) * 106, z = (random() - 0.5) * 106;
    if (Math.hypot(x, z) < 9 || Math.abs(x - 25) < 5 || (Math.abs(x - 25) < 6 && Math.abs(z) < 4)) continue;
    rockPositions.push({ x, z, y: terrainHeight(x, z), scale: 0.55 + random() * 0.8 });
  }
  addInstanced(root, new THREE.DodecahedronGeometry(0.72, 0), new THREE.MeshStandardMaterial({ color: 0x777b6b, roughness: 1 }), rockPositions, (dummy, p) => {
    dummy.position.set(p.x, p.y + 0.32 * p.scale, p.z);
    dummy.rotation.set(random(), random() * 3, random());
    dummy.scale.set(0.8 * p.scale, 0.55 * p.scale, p.scale);
  });

  const shrubPositions = [];
  for (let i = 0; i < 230; i += 1) {
    const x = (random() - 0.5) * 108, z = (random() - 0.5) * 108;
    if (Math.hypot(x, z) < 10 || Math.abs(x - 25) < 6.5) continue;
    shrubPositions.push({ x, z, y: terrainHeight(x, z), scale: 0.45 + random() * 0.6 });
  }
  addInstanced(root, new THREE.IcosahedronGeometry(0.48, 0), new THREE.MeshStandardMaterial({ color: 0x47743c, roughness: 1 }), shrubPositions, (dummy, p) => {
    dummy.position.set(p.x, p.y + 0.28 * p.scale, p.z);
    dummy.scale.set(1.2 * p.scale, 0.72 * p.scale, p.scale);
  });

  const resources = [];
  const resourceGeometry = new THREE.OctahedronGeometry(0.43, 1);
  const glowGeometry = new THREE.TorusGeometry(0.62, 0.045, 5, 20);
  for (let i = 0; i < 36; i += 1) {
    const type = RESOURCE_TYPES[i % RESOURCE_TYPES.length];
    const x = (random() - 0.5) * 82, z = (random() - 0.5) * 82;
    if (Math.hypot(x, z) < 8 || Math.abs(x - 25) < 5.5) continue;
    const y = terrainHeight(x, z);
    const node = new THREE.Group();
    const crystal = new THREE.Mesh(resourceGeometry, new THREE.MeshStandardMaterial({ color: type.color, emissive: type.color, emissiveIntensity: 0.34, roughness: 0.42 }));
    crystal.position.y = 0.65;
    node.add(crystal);
    const halo = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({ color: type.color, transparent: true, opacity: 0.62 }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.08;
    node.add(halo);
    node.position.set(x, y, z);
    root.add(node);
    resources.push({ mesh: node, type, collected: false, phase: random() * Math.PI * 2 });
  }

  const ruin = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a8c6e, roughness: 0.94 });
  const ruinX = -25, ruinZ = -30, ruinY = terrainHeight(ruinX, ruinZ);
  for (let i = 0; i < 5; i += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(7.5 - i * 1.15, 0.62, 5.6 - i * 0.76), stone);
    step.position.set(ruinX, ruinY + 0.31 + i * 0.62, ruinZ - i * 0.2);
    ruin.add(step);
  }
  const altar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 1), stone);
  altar.position.set(ruinX, ruinY + 2.75, ruinZ);
  ruin.add(altar);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.42, 1.2), stone);
  lintel.position.set(ruinX, ruinY + 4.05, ruinZ);
  ruin.add(lintel);
  const glyphMaterial = new THREE.MeshStandardMaterial({ color: 0xd1a64f, emissive: 0x69451b, emissiveIntensity: 0.5 });
  const glyph = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.08, 8, 24), glyphMaterial);
  glyph.position.set(ruinX, ruinY + 2.85, ruinZ + 0.57);
  ruin.add(glyph);
  root.add(ruin);

  const waterfall = new THREE.Group();
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.2, 1, 12), new THREE.MeshStandardMaterial({ color: 0x55c6c2, transparent: true, opacity: 0.76, roughness: 0.18, side: THREE.DoubleSide }));
  fall.position.set(25, 1.65, -54);
  waterfall.add(fall);
  const cliff = new THREE.Mesh(new THREE.BoxGeometry(12, 3.4, 2.5), new THREE.MeshStandardMaterial({ color: 0x696b4e, roughness: 1 }));
  cliff.position.set(25, 1.3, -56);
  waterfall.add(cliff);
  root.add(waterfall);

  const ruinLight = new THREE.PointLight(0xffbd70, 10, 24);
  ruinLight.position.set(ruinX, ruinY + 5, ruinZ);
  root.add(ruinLight);
  scene.add(root);

  return {
    root,
    resources,
    heightAt: terrainHeight,
    canMoveTo(x, z) {
      if (Math.abs(x - 25) < 4.8 && Math.abs(z) > 2.7) return false;
      if (treePositions.some((tree) => Math.hypot(x - tree.x, z - tree.z) < 1.25)) return false;
      if (rockPositions.some((rock) => Math.hypot(x - rock.x, z - rock.z) < 0.95)) return false;
      return true;
    },
    update(time) {
      for (const item of resources) {
        if (!item.collected) {
          item.mesh.children[0].rotation.y = time * 0.8 + item.phase;
          item.mesh.children[0].position.y = 0.65 + Math.sin(time * 2.1 + item.phase) * 0.09;
          item.mesh.children[1].rotation.z = time * 0.35;
        }
      }
      water.position.z = Math.sin(time * 0.18) * 0.35;
      fall.material.opacity = 0.65 + Math.sin(time * 3.2) * 0.1;
    },
    harvest(position, radius = 2.6) {
      const item = resources.find((entry) => !entry.collected && entry.mesh.position.distanceTo(position) <= radius);
      if (!item) return null;
      item.collected = true;
      root.remove(item.mesh);
      return item.type.id;
    },
    dispose() {
      scene.remove(root);
      root.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material.dispose();
      });
    }
  };
}

export const ADVENTURE_WORLD_SIZE = WORLD_SIZE;
