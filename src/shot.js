import * as THREE from 'three';
import { GRAVITY } from './ball.js';
export function shotVelocity(position,angle,ring) {
  const aim=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));
  const toward=new THREE.Vector3(ring.x-position.x,0,ring.z-position.z);
  const distance=toward.length();
  if(distance>.01 && aim.dot(toward.clone().normalize())>Math.cos(Math.PI/9)) {
    const flight=THREE.MathUtils.clamp(distance/10.5,.75,1.8);
    return new THREE.Vector3(toward.x/flight,(ring.y-position.y)/flight-.5*GRAVITY*flight,toward.z/flight);
  }
  return aim.multiplyScalar(10.5).setY(12.2);
}
