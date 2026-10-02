import * as THREE from 'three';
import { BallState } from './ball.js';
import { strikeVelocity } from './strike.js';
export function shotVelocity(position,angle,ring,options={}) {return strikeVelocity(position,options.velocity||new THREE.Vector3(),angle,ring,options);}
export function predictShot(position,angle,ring,options={}) {
  const preview=new BallState(()=>.5);preview.pos.copy(position);preview.vel.copy(shotVelocity(position,angle,ring,options));
  preview.ringRadius=options.ringRadius??preview.ringRadius;preview.ringTube=options.ringTube??preview.ringTube;preview.obstacles=options.obstacles??[];
  const points=[position.clone()];
  for(let i=0;i<48;i++){const scored=preview.update(.05,ring);points.push(preview.pos.clone());if(scored||preview.events.some(event=>event.kind==='zone'))break;}
  return points;
}
