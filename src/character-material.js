import * as THREE from 'three';

const palette = {
  sun: { cloth: 0x078c88, trim: 0xf4c364, feather: 0x27c9bf },
  rival: { cloth: 0xb52f46, trim: 0xe6ae65, feather: 0xf15e52 },
};
const geometryCache = new WeakMap();
const point = new THREE.Vector3();
const color = new THREE.Color();

// The supplied warrior is a single skinned mesh. Bone weights let us color skin,
// clothing and accessories without painting team colors over the face and hands.
export function dressWarrior(model, team, bones) {
  const colors = palette[team] || palette.sun;
  const headY = bones.Head?.getWorldPosition(new THREE.Vector3()).y ?? 1.65;
  const hipY = bones.Hips?.getWorldPosition(new THREE.Vector3()).y ?? .95;
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const original = mesh.geometry;
    let variants = geometryCache.get(original);
    if (!variants) { variants = new Map(); geometryCache.set(original, variants); }
    if (!variants.has(team)) {
      const geometry = original.clone();
      const position = geometry.attributes.position;
      const joints = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
      const vertexColors = new Float32Array(position.count * 3);
      const finish = new Float32Array(position.count * 2);
      for (let i = 0; i < position.count; i += 1) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
        let bone = '';
        if (joints && weights && mesh.skeleton) {
          let strongest = 0, influence = -1;
          for (let j = 0; j < 4; j += 1) {
            const weight = weights.getComponent(i, j);
            if (weight > influence) { influence = weight; strongest = joints.getComponent(i, j); }
          }
          bone = mesh.skeleton.bones[strongest]?.name ?? '';
        }
        let pigment = colors.cloth, roughness = .8, metalness = .02;
        if (/Head|Neck|Arm|Hand|Finger|Leg/.test(bone)) pigment = 0xbf8058;
        if (/UpLeg|Hips|Spine/.test(bone)) pigment = colors.cloth;
        if (/Foot|Toe/.test(bone)) { pigment = 0x273b43; roughness = .68; }
        // Gold collar, belt and wrist guards give the silhouette readable breaks.
        const collar = /Spine|Neck/.test(bone) && point.y > headY - .15;
        const belt = /Hips|Spine/.test(bone) && Math.abs(point.y - hipY) < .075;
        const bracer = /ForeArm/.test(bone);
        if (collar || belt || bracer) { pigment = colors.trim; roughness = .4; metalness = .38; }
        if (/Head/.test(bone) && point.y > headY + .18) {
          pigment = Math.sin(point.x * 45) > .25 ? colors.trim : colors.feather;
          roughness = .65; metalness = .12;
        }
        color.setHex(pigment);
        const grain = Math.sin(point.x * 97 + point.y * 131 + point.z * 71) * .025;
        color.multiplyScalar(1 + grain);
        color.toArray(vertexColors, i * 3);
        finish[i * 2] = roughness; finish[i * 2 + 1] = metalness;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
      geometry.setAttribute('warriorFinish', new THREE.BufferAttribute(finish, 2));
      variants.set(team, geometry);
    }
    mesh.geometry = variants.get(team);
    const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: source?.map ?? null, vertexColors: true,
      roughness: 1, metalness: 1, emissive: 0x15222a, emissiveIntensity: .08,
    });
    material.name = `${team}-painted-warrior`;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 warriorFinish; varying vec2 vWarriorFinish;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWarriorFinish = warriorFinish;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vWarriorFinish;')
        .replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 sourceColor = texture2D(map, vMapUv);
            float sourceDetail = dot(sourceColor.rgb, vec3(.2126,.7152,.0722));
            diffuseColor.rgb *= .82 + .18 * sourceDetail;
          #endif
        `)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vWarriorFinish.x;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vWarriorFinish.y;');
    };
    material.customProgramCacheKey = () => 'painted-warrior-v1';
    mesh.material = material;
    mesh.castShadow = true; mesh.receiveShadow = false;
  });
}
