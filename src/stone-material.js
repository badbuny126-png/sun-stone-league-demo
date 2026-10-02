import * as THREE from 'three';

// Preserve the original UV atlas; add subtle world-scale relief to stone.
export function createArenaMaterial(albedo, normal, roughness) {
  const material = new THREE.MeshStandardMaterial({
    map: albedo, normalMap: normal, roughnessMap: roughness,
    normalScale: new THREE.Vector2(.8,.8), roughness: .96, metalness: 0,
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStonePosition; varying vec3 vStoneNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStonePosition = (modelMatrix * vec4(position,1.0)).xyz; vStoneNormal=normalize(mat3(modelMatrix)*normal);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec3 vStonePosition;
      varying vec3 vStoneNormal;
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
      // Keep painted jade bands, but soften the atlas saturation into weathered stone.
      float luminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=mix(vec3(luminance),diffuseColor.rgb,.68)*vec3(1.08,1.02,.94);
      float grain=stoneNoise(vStonePosition*18.0);
      float courtStone=(1.0-smoothstep(17.0,19.0,abs(vStonePosition.x)))*(1.0-smoothstep(18.0,20.0,abs(vStonePosition.z)));
      courtStone*=smoothstep(.12,.25,vStonePosition.y)*(1.0-smoothstep(8.0,10.0,vStonePosition.y));
      vec3 face=abs(normalize(vStoneNormal));
      vec2 masonry=face.x>face.z?vStonePosition.zy:vStonePosition.xy;
      if(face.y>.7)masonry=vStonePosition.xz;
      float row=floor(masonry.y/.65);
      vec2 blockUV=vec2(masonry.x/1.4+mod(row,2.0)*.5,masonry.y/.65);
      vec2 edge=min(fract(blockUV),1.0-fract(blockUV));
      float mortar=1.0-smoothstep(.012,.04,min(edge.x,edge.y));
      float blockVariation=stoneHash(vec3(floor(blockUV),2.0));
      vec3 carvedStone=mix(vec3(.23,.19,.14),vec3(.42,.34,.24),blockVariation*.5+grain*.3);
      carvedStone*=1.0-mortar*.34;
      float jadeBand=(1.0-smoothstep(.11,.16,abs(vStonePosition.y-2.1)))*(1.0-face.y);
      carvedStone=mix(carvedStone,vec3(.035,.19,.16),jadeBand*.75);
      diffuseColor.rgb=mix(diffuseColor.rgb,carvedStone,courtStone);
      stoneMask=max(stoneMask,courtStone);
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
  material.customProgramCacheKey = () => 'arena-stone-detail-v3';
  return material;
}
