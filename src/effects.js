import * as THREE from 'three';

// A fixed pool keeps scoring bursts and footstep dust to one particle draw call.
export function createEffects(scene) {
  const capacity=160,position=new Float32Array(capacity*3),colors=new Float32Array(capacity*3),alpha=new Float32Array(capacity);
  const life=new Float32Array(capacity),duration=new Float32Array(capacity),velocity=new Float32Array(capacity*3);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha',new THREE.BufferAttribute(alpha,1).setUsage(THREE.DynamicDrawUsage));
  const points=new THREE.Points(geometry,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,vertexColors:true,
    vertexShader:'attribute float alpha; varying float vAlpha; varying vec3 vColor; void main(){vAlpha=alpha;vColor=color;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(95.0/max(1.0,-p.z),2.0,20.0);}',
    fragmentShader:'varying float vAlpha; varying vec3 vColor; void main(){float d=length(gl_PointCoord-.5)*2.0;gl_FragColor=vec4(vColor,vAlpha*(1.0-smoothstep(.15,1.0,d)));}',
  }));
  points.frustumCulled=false;scene.add(points);
  let cursor=0;
  const color=new THREE.Color();
  const waves=Array.from({length:6},()=>{
    const mesh=new THREE.Mesh(new THREE.RingGeometry(.8,1,40),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    mesh.rotation.x=-Math.PI/2;mesh.visible=false;mesh.userData.life=0;scene.add(mesh);return mesh;
  });
  let waveCursor=0;
  function burst(origin,tint=0xffc878,count=18,dust=false) {
    color.setHex(tint);
    for(let n=0;n<count;n++) {
      const i=cursor++%capacity,j=i*3;
      origin.toArray(position,j);color.toArray(colors,j);
      duration[i]=life[i]=dust?.35+Math.random()*.15:.45+Math.random()*.3;
      velocity[j]=(Math.random()-.5)*(dust?1.2:5);
      velocity[j+1]=Math.random()*(dust?.8:4.5);
      velocity[j+2]=(Math.random()-.5)*(dust?1.2:5);
    }
    if(!dust) {
      const wave=waves[waveCursor++%waves.length];wave.position.set(origin.x,.045,origin.z);
      wave.material.color.copy(color);wave.userData.life=.4;wave.visible=true;
    }
  }
  function update(dt) {
    for(let i=0;i<capacity;i++) {
      life[i]=Math.max(0,life[i]-dt);alpha[i]=duration[i]?life[i]/duration[i]*.8:0;
      if(!life[i])continue;
      const j=i*3;velocity[j+1]-=6*dt;
      for(let axis=0;axis<3;axis++)position[j+axis]+=velocity[j+axis]*dt;
      position[j+1]=Math.max(.04,position[j+1]);
    }
    for(const name of ['position','color','alpha'])geometry.attributes[name].needsUpdate=true;
    for(const wave of waves) {
      wave.userData.life=Math.max(0,wave.userData.life-dt);wave.visible=wave.userData.life>0;
      wave.scale.setScalar(.25+(1-wave.userData.life/.4)*2.2);wave.material.opacity=wave.userData.life*.9;
    }
  }
  return {burst,update};
}
