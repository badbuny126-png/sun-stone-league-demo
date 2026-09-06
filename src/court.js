import * as THREE from 'three';

export const COURT_LENGTH = 32;
export const COURT_WIDTH = 14;
export const WALL_HEIGHT = 6;
export const RING_HEIGHT = 4.8;
export const RING_RADIUS = 1.12;
export const RING_TUBE = 0.22;

const palette = {
  sandstone: 0x9b6538,
  lightStone: 0xc58b4c,
  darkStone: 0x50301f,
  jade: 0x167566,
  turquoise: 0x20a98f,
  gold: 0xf1a532,
};

function stoneMaterial(color, roughness = 0.92) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function box(parent, size, position, material, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#a8703d');
  gradient.addColorStop(0.5, '#c48b4d');
  gradient.addColorStop(1, '#8d572f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(60,31,18,.48)';
  ctx.lineWidth = 4;
  const tileW = 128;
  const tileH = 128;
  for (let y = 0; y <= canvas.height; y += tileH) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    const offset = (y / tileH) % 2 ? tileW / 2 : 0;
    for (let x = offset; x <= canvas.width; x += tileW) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + tileH); ctx.stroke();
    }
  }
  let seed = 41;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  ctx.strokeStyle = 'rgba(74,40,22,.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 46; i += 1) {
    let x = random() * canvas.width;
    let y = random() * canvas.height;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 3; j += 1) { x += (random() - .5) * 55; y += 12 + random() * 28; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addCourtMarkings(group) {
  const jade = new THREE.MeshBasicMaterial({ color: palette.turquoise, transparent: true, opacity: .78 });
  const gold = new THREE.MeshBasicMaterial({ color: palette.gold, transparent: true, opacity: .7 });
  const center = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.28, 64), jade);
  center.rotation.x = -Math.PI / 2;
  center.position.y = .025;
  group.add(center);
  for (const z of [-9, 0, 9]) box(group, [COURT_WIDTH - .8, .025, .08], [0, .02, z], z === 0 ? gold : jade, false);
  for (let i = 0; i < 12; i += 1) {
    const a = i / 12 * Math.PI * 2;
    const glyph = box(group, [.38, .025, .72], [Math.cos(a) * 1.35, .03, Math.sin(a) * 1.35], gold, false);
    glyph.rotation.y = -a;
  }
}

function addSteppedSide(group, sign, materials) {
  const x0 = sign * (COURT_WIDTH / 2 + .55);
  const widths = [1.1, 1.35, 1.55, 1.8];
  for (let tier = 0; tier < 4; tier += 1) {
    const height = 1.05;
    const outward = sign * (tier * 1.1 + widths[tier] / 2);
    box(group, [widths[tier], height, COURT_LENGTH + 2], [x0 + outward, tier * height + height / 2, 0], materials[tier % materials.length]);
  }
  const bandX = sign * (COURT_WIDTH / 2 + .15);
  box(group, [.28, .75, COURT_LENGTH + 1], [bandX, 2.1, 0], materials[2]);
  const glyphMat = stoneMaterial(palette.jade, .72);
  for (let z = -14; z <= 14; z += 2) box(group, [.34, .32, 1.05], [bandX - sign * .18, 2.1, z], glyphMat, false);
}

function addTemple(group, z, scale, materials) {
  const temple = new THREE.Group();
  temple.position.set(-9, 0, z);
  for (let tier = 0; tier < 5; tier += 1) {
    box(temple, [(10 - tier * 1.25) * scale, .9 * scale, (7 - tier * .8) * scale], [0, tier * .82 * scale, 0], materials[tier % 2]);
  }
  box(temple, [3.4 * scale, 2.3 * scale, 2.5 * scale], [0, 5 * .82 * scale + 1.05 * scale, 0], materials[1]);
  box(temple, [1.1 * scale, 1.65 * scale, .2], [0, 5 * .82 * scale + .85 * scale, signOf(z) * -1.26 * scale], new THREE.MeshBasicMaterial({ color: 0x1a0d09 }), false);
  group.add(temple);
}

function signOf(value) { return value < 0 ? -1 : 1; }

function addTorch(group, x, z) {
  const dark = stoneMaterial(0x382017);
  box(group, [.34, 1.4, .34], [x, .7, z], dark);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.48, .28, .22, 12), stoneMaterial(0x332018, .65));
  bowl.position.set(x, 1.45, z); group.add(bowl);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb128, transparent: true, opacity: .92 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.23, .75, 10), flameMat);
  flame.position.set(x, 1.95, z); flame.userData.flame = true; group.add(flame);
  const light = new THREE.PointLight(0xff7b22, 10, 8, 2);
  light.position.set(x, 1.9, z); group.add(light);
}

function addCrowd(group) {
  const geometry = new THREE.CapsuleGeometry(.12, .36, 2, 5);
  const colors = [0x6f3023, 0xa7532f, 0x1c756c, 0xd49842];
  colors.forEach((color, colorIndex) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: .9 });
    const crowd = new THREE.InstancedMesh(geometry, material, 28);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 28; i += 1) {
      const side = i % 2 ? 1 : -1;
      const row = (i + colorIndex) % 3;
      dummy.position.set(side * (8.3 + row * 1.05), 2.9 + row * 1.05, -14 + ((i * 3.7 + colorIndex * 2.1) % 28));
      dummy.rotation.y = side * -Math.PI / 2;
      dummy.scale.setScalar(.85 + ((i * 17) % 5) * .05);
      dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix);
    }
    crowd.castShadow = false; group.add(crowd);
  });
}

function addSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(95, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { topColor: { value: new THREE.Color(0x193854) }, horizonColor: { value: new THREE.Color(0xf09b4b) }, groundColor: { value: new THREE.Color(0x35170f) } },
    vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vPos;uniform vec3 topColor;uniform vec3 horizonColor;uniform vec3 groundColor;void main(){float h=normalize(vPos).y;vec3 c=h>0.0?mix(horizonColor,topColor,smoothstep(0.0,.72,h)):mix(horizonColor,groundColor,smoothstep(0.0,-.42,h));gl_FragColor=vec4(c,1.0);}',
  }));
  scene.add(sky);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd27a, transparent: true, opacity: .9, depthWrite: false }));
  sun.scale.set(8, 8, 1); sun.position.set(-32, 24, -54); scene.add(sun);
}

export function createCourt(scene) {
  addSky(scene);
  const group = new THREE.Group();
  group.name = 'SunStoneArena';
  scene.add(group);
  const mats = [stoneMaterial(palette.sandstone), stoneMaterial(palette.lightStone), stoneMaterial(palette.darkStone)];

  const floorMat = new THREE.MeshStandardMaterial({ map: createFloorTexture(), color: 0xffffff, roughness: .88, metalness: 0 });
  box(group, [COURT_WIDTH, .45, COURT_LENGTH], [0, -.23, 0], floorMat);
  addCourtMarkings(group);
  addSteppedSide(group, 1, mats);
  addSteppedSide(group, -1, mats);
  box(group, [COURT_WIDTH + 6, 3.8, 1.3], [0, 1.9, -COURT_LENGTH / 2 - .65], mats[0]);
  box(group, [COURT_WIDTH + 6, 3.8, 1.3], [0, 1.9, COURT_LENGTH / 2 + .65], mats[0]);

  addTemple(group, -25, .9, mats);
  const rightTemple = new THREE.Group();
  rightTemple.position.x = 18;
  group.add(rightTemple);
  addCrowd(group);
  [[-5.4,-11],[-5.4,11],[5.4,-11],[5.4,11]].forEach(([x,z]) => addTorch(group,x,z));

  const ringGroup = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({ color: palette.gold, roughness: .28, metalness: .55, emissive: 0x7d2d00, emissiveIntensity: .55 });
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 18, 56), ringMat);
  ringMesh.rotation.y = Math.PI / 2;
  ringMesh.position.set(COURT_WIDTH / 2 - .58, RING_HEIGHT, 0);
  ringMesh.castShadow = true;
  ringGroup.add(ringMesh);
  const mount = box(ringGroup, [.4, 3.1, 3.6], [COURT_WIDTH / 2 + .18, RING_HEIGHT, 0], mats[2]);
  mount.rotation.x = 0;
  for (let i = 0; i < 12; i += 1) {
    const a = i / 12 * Math.PI * 2;
    const gem = new THREE.Mesh(new THREE.BoxGeometry(.18,.24,.24), new THREE.MeshStandardMaterial({ color: i % 2 ? palette.jade : palette.gold, emissive: i % 2 ? 0x06352e : 0x542000, emissiveIntensity: .35 }));
    gem.position.set(COURT_WIDTH / 2 - .62, RING_HEIGHT + Math.sin(a) * 1.55, Math.cos(a) * 1.55);
    ringGroup.add(gem);
  }
  group.add(ringGroup);

  const ringWorldPos = new THREE.Vector3();
  ringMesh.getWorldPosition(ringWorldPos);
  return { ringMesh, ringWorldPos, arena: group };
}

export function updateCourt(arena, time) {
  arena.traverse((object) => {
    if (object.userData.flame) {
      const pulse = 1 + Math.sin(time * 11 + object.position.x) * .12;
      object.scale.set(pulse, .9 + Math.sin(time * 8) * .15, pulse);
      object.rotation.y = time * 2;
    }
  });
}

export function addLighting(scene) {
  scene.add(new THREE.HemisphereLight(0xffcf8b, 0x172b31, 1.5));
  const sun = new THREE.DirectionalLight(0xffb767, 3.4);
  sun.position.set(-18, 24, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 65;
  sun.shadow.bias = -.0004;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x42b8aa, 1.25);
  rim.position.set(10, 8, -15); scene.add(rim);
}
