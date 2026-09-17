import * as THREE from 'three';

// Preserve the original UV atlas; add subtle world-scale relief to stone.
export function createArenaMaterial(albedo, normal, roughness) {
  const material = new THREE.MeshStandardMaterial({
    map: albedo, normalMap: normal, roughnessMap: roughness,
    normalScale: new THREE.Vector2(.8,.8), roughness: .96, metalness: 0,
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStonePosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStonePosition = (modelMatrix * vec4(position,1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec3 vStonePosition;
      float stoneHash(vec3 p) {
        p = fract(p*.1031); p += dot(p,p.yzx+33.33);
        return fract((p.x+p.y)*p.z);
      }
      float stoneNoise(vec3 p) {
        vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(stoneHash(i),stoneHash(i+vec3(1,0,0)),f.x),
          mix(stoneHash(i+vec3(0,1,0)),stoneHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(stoneHash(i+vec3(0,0,1)),stoneHash(i+vec3(1,0,1)),f.x),
          mix(stoneHash(i+vec3(0,1,1)),stoneHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
    `).replace('#include <map_fragment>', `
      #include <map_fragment>
      float stoneMask=1.0-smoothstep(.015,.12,diffuseColor.g-max(diffuseColor.r,diffuseColor.b));
      float grain=stoneNoise(vStonePosition*18.0);
      diffuseColor.rgb *= 1.0+stoneMask*((grain-.5)*.13+(stoneNoise(vStonePosition*.7)-.5)*.12);
    `).replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+stoneMask*.15,.65,1.0);
    `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      float relief=grain*.012*stoneMask;
      vec3 surfaceDx=dFdx(-vViewPosition),surfaceDy=dFdy(-vViewPosition);
      vec3 crossY=cross(surfaceDy,normal),crossX=cross(normal,surfaceDx);
      float determinant=dot(surfaceDx,crossY);
      vec3 gradient=sign(determinant)*(dFdx(relief)*crossY+dFdy(relief)*crossX);
      normal=normalize(max(abs(determinant),0.00000001)*normal-gradient);
    `);
  };
  material.customProgramCacheKey = () => 'arena-stone-detail-v1';
  return material;
}
