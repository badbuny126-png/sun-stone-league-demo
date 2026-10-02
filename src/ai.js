import * as THREE from 'three';
import { DIFFICULTIES } from './strike.js';
import { getAISteering } from './teams.js';

export function decideAI(actor,actors,ball,match,ring,dt) {
  const settings=DIFFICULTIES[match.difficulty]||DIFFICULTIES.normal;
  actor.thinkTime=Math.max(0,(actor.thinkTime??0)-dt);
  const toward=actor.team==='sun'?1:-1,ownEnd=-toward*15;
  const teammate=actors.find(other=>other.team===actor.team&&other.id!==actor.id);
  if(actor.thinkTime<=0 || !actor.target) {
    actor.thinkTime=settings.reaction;
    const ballXZ=ball.pos.clone().setY(0),ownThreat=(ball.pos.z-ownEnd)*toward<6;
    const nearest=actors.filter(other=>other.team===actor.team).sort((a,b)=>a.position.distanceTo(ballXZ)-b.position.distanceTo(ballXZ))[0];
    if(ownThreat){actor.aiState='defend';actor.target=ballXZ.clone().lerp(new THREE.Vector3(ball.pos.x*.6,0,ownEnd+2*toward),actor.role==='support'?.45:0);}
    else if(nearest.id===actor.id){
      actor.aiState='intercept';
      const passLane=actor.role==='support'&&teammate&&(teammate.position.z-actor.position.z)*toward>1.3;
      const aim=passLane?teammate.position:Math.abs(ball.pos.z)<5?ring:new THREE.Vector3(ball.pos.x*.35,0,toward*16);
      const approach=aim.clone().sub(ball.pos).setY(0).normalize();
      actor.target=ballXZ.addScaledVector(new THREE.Vector3(ball.vel.x,0,ball.vel.z),settings.reaction*.45).addScaledVector(approach,-.8);
    }
    else {actor.aiState='reposition';actor.target=new THREE.Vector3(actor.role==='support'? -toward*2.5:toward*2.5,0,ball.pos.z+toward*2.8);}
    actor.target.x=THREE.MathUtils.clamp(actor.target.x,-5.8,5.8);actor.target.z=THREE.MathUtils.clamp(actor.target.z,-14,14);
  }
  const direction=getAISteering(actor,actor.target,actors);
  let action=null;
  const near=ball.pos.distanceTo(actor.position.clone().setY(.95))<1.4;
  actor.contactThink=near?(actor.contactThink||0)+dt:0;
  if(near && actor.contactThink>=settings.reaction && actor.cooldown<=0 && actor.swingTimer<=0 && (!match.freeStrike || match.freeStrike===actor.team)) {
    const teammateAhead=teammate && (teammate.position.z-actor.position.z)*toward>1.3;
    const pass=teammateAhead && (actor.role==='support'||match.rng()>settings.aggression);
    const target=pass?teammate.position.clone().addScaledVector(teammate.velocity||new THREE.Vector3(),.3)
      : Math.abs(ball.pos.z)<5 && match.rng()<settings.aggression?ring:new THREE.Vector3(ball.pos.x*.35,0,toward*16);
    const angle=Math.atan2(target.x-ball.pos.x,target.z-ball.pos.z)+(match.rng()-.5)*settings.error*2;
    const type=pass?'elbow':target===ring?'knee':'hip';
    action={type,angle,seconds:(type==='hip'?.75:type==='knee'?.6:.35)*(1+(match.rng()-.5)*settings.error),pass};
    actor.contactThink=0;actor.aiState=pass?'pass':'attack';actor.cooldown=settings.reaction+1;
  }
  return {direction,speed:settings.speed,action};
}
