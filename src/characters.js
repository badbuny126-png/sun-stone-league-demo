import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CHAR_SCALE = 1.0;

function collectBones(root, target) {
  root.traverse((o) => {
    if (o.isBone) target[o.name] = o;
  });
}

function tintModel(root, color) {
  root.traverse((o) => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map((m) => {
        const c = m.clone();
        c.color = new THREE.Color(color);
        c.emissive = new THREE.Color(color).multiplyScalar(0.15);
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/**
 * Loads /models/player.glb once, spawns the player + a recolored AI clone.
 * Resolves with { playerChar, aiChar, playerBones, aiBones }.
 */
export function loadCharacters(scene, manager, modelUrl = '/models/player.glb') {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader(manager);
    loader.load(
      modelUrl,
      (gltf) => {
        const playerChar = gltf.scene;
        playerChar.scale.setScalar(CHAR_SCALE);
        playerChar.position.set(-3, 0, -8);
        playerChar.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        const playerBones = {};
        collectBones(playerChar, playerBones);
        scene.add(playerChar);

        const aiChar = gltf.scene.clone(true);
        aiChar.scale.setScalar(CHAR_SCALE);
        aiChar.position.set(3, 0, 8);
        tintModel(aiChar, 0xb33a3a);
        const aiBones = {};
        collectBones(aiChar, aiBones);
        scene.add(aiChar);

        resolve({ playerChar, aiChar, playerBones, aiBones });
      },
      undefined,
      reject
    );
  });
}

/**
 * Drives a simple procedural run-bob + hit-swing directly off the skeleton,
 * since the source model ships with no baked animations.
 */
export function animateCharacter(bones, moving, swingTimer, dt, animTime) {
  const hips = bones['mixamorig:Hips'];
  const spine = bones['mixamorig:Spine1'];
  const rArm = bones['mixamorig:RightArm'];
  const lArm = bones['mixamorig:LeftArm'];
  if (!hips) return;

  if (moving) {
    hips.position.y = 0.05 * Math.sin(animTime * 10);
  }
  if (swingTimer > 0) {
    const t = 1 - swingTimer / 0.3;
    const swing = Math.sin(t * Math.PI) * 0.9;
    if (spine) spine.rotation.x = -swing * 0.5;
    if (rArm) rArm.rotation.x = -swing;
    if (lArm) lArm.rotation.x = -swing * 0.6;
  } else {
    if (spine) spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, 0, 0.2);
    if (rArm) rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, 0, 0.2);
    if (lArm) lArm.rotation.x = THREE.MathUtils.lerp(lArm.rotation.x, 0, 0.2);
  }
}
