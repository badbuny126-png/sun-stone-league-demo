import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const TARGET_HEIGHT = 2.45;

function material(color, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .08, emissive, emissiveIntensity: .25 });
}

function mesh(geometry, mat, position, parent) {
  const part = new THREE.Mesh(geometry, mat);
  part.position.set(...position);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

function proceduralWarrior(team) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = material(0x9b5735);
  const primary = material(team === 'player' ? 0x087a70 : 0xa3292f, team === 'player' ? 0x063d38 : 0x3b080a);
  const gold = material(0xe0a23e, 0x4a2400);
  const dark = material(0x241b1a);

  mesh(new THREE.CapsuleGeometry(.34, .76, 5, 8), primary, [0, 1.42, 0], body);
  mesh(new THREE.SphereGeometry(.25, 14, 10), skin, [0, 2.23, 0], body);
  mesh(new THREE.CylinderGeometry(.44, .38, .18, 12), gold, [0, 2.05, 0], body);
  mesh(new THREE.BoxGeometry(.78, .16, .35), gold, [0, 1.76, 0], body);
  mesh(new THREE.CylinderGeometry(.36, .42, .34, 10), dark, [0, .9, 0], body);

  const leftArm = new THREE.Group(); leftArm.position.set(-.43, 1.72, 0); body.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(.43, 1.72, 0); body.add(rightArm);
  mesh(new THREE.CapsuleGeometry(.11, .58, 4, 7), skin, [0, -.31, 0], leftArm);
  mesh(new THREE.CapsuleGeometry(.11, .58, 4, 7), skin, [0, -.31, 0], rightArm);
  const leftLeg = new THREE.Group(); leftLeg.position.set(-.2, .86, 0); body.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(.2, .86, 0); body.add(rightLeg);
  mesh(new THREE.CapsuleGeometry(.14, .66, 4, 7), skin, [0, -.38, 0], leftLeg);
  mesh(new THREE.CapsuleGeometry(.14, .66, 4, 7), skin, [0, -.38, 0], rightLeg);
  mesh(new THREE.BoxGeometry(.25, .14, .48), dark, [0, -.77, .08], leftLeg);
  mesh(new THREE.BoxGeometry(.25, .14, .48), dark, [0, -.77, .08], rightLeg);

  const featherColors = team === 'player' ? [0x0ab7ae, 0x134e8c, 0xe2a437] : [0xd52e36, 0x75232d, 0xe2a437];
  for (let i = 0; i < 7; i += 1) {
    const feather = mesh(new THREE.ConeGeometry(.12, .84, 6), material(featherColors[i % 3]), [(i - 3) * .12, 2.72 + Math.abs(i - 3) * .05, .04], body);
    feather.rotation.z = -(i - 3) * .1;
  }
  root.userData.rig = { root, body, leftArm, rightArm, leftLeg, rightLeg, procedural: true, baseY: 0 };
  return root;
}

function collectBones(root) {
  const bones = {};
  root.traverse((object) => { if (object.isBone) bones[object.name] = object; });
  return bones;
}

function normalizeModel(model) {
  model.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < .001) throw new Error('Invalid model bounds');
  model.scale.multiplyScalar(TARGET_HEIGHT / size.y);
  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= bounds.min.y;
  model.rotation.y = Math.PI;
}

function tint(root, color) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const materials = source.map((oldMaterial) => {
      const next = oldMaterial.clone();
      if (next.color) next.color.lerp(new THREE.Color(color), .48);
      next.emissive = new THREE.Color(color).multiplyScalar(.06);
      return next;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });
}

function makeContainer(model, team) {
  const container = new THREE.Group();
  normalizeModel(model);
  model.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  if (team === 'rival') tint(model, 0xb51f2f);
  container.add(model);
  const bones = collectBones(model);
  container.userData.rig = { root: container, body: model, bones, procedural: false, baseY: 0 };
  return container;
}

function poseImportedRig(rig) {
  const bones = rig.bones;
  const leftArm = bones['mixamorig:LeftArm'] || bones.LeftArm;
  const rightArm = bones['mixamorig:RightArm'] || bones.RightArm;
  if (leftArm) leftArm.rotation.z = -1.15;
  if (rightArm) rightArm.rotation.z = 1.15;
}

function spawnPair(scene, sourceModel = null) {
  let playerChar;
  let aiChar;
  if (sourceModel) {
    try {
      playerChar = makeContainer(sourceModel, 'player');
      if (Object.keys(playerChar.userData.rig.bones).length < 5) throw new Error('Static T-pose model');
      aiChar = makeContainer(cloneSkeleton(sourceModel), 'rival');
      poseImportedRig(playerChar.userData.rig);
      poseImportedRig(aiChar.userData.rig);
    } catch {
      playerChar = proceduralWarrior('player');
      aiChar = proceduralWarrior('rival');
    }
  } else {
    playerChar = proceduralWarrior('player');
    aiChar = proceduralWarrior('rival');
  }
  playerChar.position.set(-2.2, 0, -7);
  aiChar.position.set(2.2, 0, 7);
  scene.add(playerChar, aiChar);
  return { playerChar, aiChar, playerBones: playerChar.userData.rig, aiBones: aiChar.userData.rig };
}

export function loadCharacters(scene, manager, modelUrl) {
  return new Promise((resolve) => {
    if (!modelUrl) { resolve(spawnPair(scene)); return; }
    new GLTFLoader(manager).load(modelUrl, (gltf) => resolve(spawnPair(scene, gltf.scene)), undefined, () => resolve(spawnPair(scene)));
  });
}

export function animateCharacter(rig, moving, swingTimer, _dt, time) {
  if (!rig?.root) return;
  const stride = moving ? Math.sin(time * 10) : 0;
  rig.root.position.y = rig.baseY + (moving ? Math.abs(Math.sin(time * 10)) * .055 : Math.sin(time * 2.4) * .012);
  rig.root.rotation.z = THREE.MathUtils.lerp(rig.root.rotation.z, moving ? Math.sin(time * 10) * .025 : 0, .16);
  if (rig.procedural) {
    rig.leftLeg.rotation.x = stride * .5;
    rig.rightLeg.rotation.x = -stride * .5;
    rig.leftArm.rotation.x = -stride * .42;
    rig.rightArm.rotation.x = stride * .42;
    if (swingTimer > 0) {
      const hit = Math.sin((1 - swingTimer / .3) * Math.PI);
      rig.body.rotation.z = -hit * .24;
      rig.rightArm.rotation.x = -1.4 * hit;
    } else rig.body.rotation.z *= .78;
    return;
  }
  const bones = rig.bones || {};
  const hips = bones['mixamorig:Hips'] || bones.Hips;
  const spine = bones['mixamorig:Spine1'] || bones.Spine1;
  const rightArm = bones['mixamorig:RightArm'] || bones.RightArm;
  if (hips && moving) hips.rotation.z = stride * .045;
  if (swingTimer > 0) {
    const hit = Math.sin((1 - swingTimer / .3) * Math.PI);
    if (spine) spine.rotation.x = -hit * .42;
    if (rightArm) rightArm.rotation.x = -hit * 1.15;
  } else if (spine) spine.rotation.x *= .82;
}
