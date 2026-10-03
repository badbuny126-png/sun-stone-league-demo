import * as THREE from 'three';
import { BallState } from './ball.js';
import { strikeVelocity } from './strike.js';
export function shotVelocity(position,angle,ring,options={}) {return strikeVelocity(position,options.velocity||new THREE.Vector3(),angle,ring,options);}
export function predictShot(position,angle,ring,options={}) {
  const preview=new BallState(()=>.5);preview.pos.copy(position);preview.vel.copy(shotVelocity(position,angle,ring,options));
  preview.ringRadius=options.ringRadius??preview.ringRadius;preview.ringTube=options.ringTube??preview.ringTube;preview.obstacles=options.obstacles??[];
  const points=[position.clone()];
  let bounces=0;const walls=new Set();
  for(let i=0;i<48;i++){
    const scored=preview.update(.05,ring);points.push(preview.pos.clone());
    let terminal=scored;
    for(const event of preview.events){
      if(event.kind==='floor'&&++bounces>=2)terminal=true;
      if(event.kind==='wall')walls.add(event.surface);
      if(event.kind==='zone'||event.kind==='rim'&&walls.size>=2)terminal=true;
    }
    if(terminal)break;
  }
  return points;
}
