import * as THREE from 'three';
import { GRAVITY, BallState } from './ball.js';
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

// Reuse the match simulation so the guide includes floor/wall bounces and rim
// collisions. The origin is the ball now; its motion during windup may change it.
export function predictShot(position,angle,ring) {
  const preview=new BallState();preview.pos.copy(position);
  preview.vel.copy(shotVelocity(position,angle,ring));
  const points=[position.clone()];
  for(let i=0;i<48;i++) {
    const scored=preview.update(.05,ring);points.push(preview.pos.clone());
    if(scored)break;
  }
  return points;
}
