import * as THREE from 'three';

export const STRIKES={
  hip:{name:'Hip Smash',ideal:.75,max:1.25,force:13,lift:14,height:.95,reach:1.45,spread:.18},
  elbow:{name:'Elbow Ricochet',ideal:.35,max:.8,force:8,lift:3.2,height:1.25,reach:1.4,spread:.055},
  knee:{name:'Knee Volley',ideal:.6,max:1.1,force:9,lift:19,height:.65,reach:1.35,spread:.22},
};
export const DIFFICULTIES={
  easy:{assist:.45,reaction:.65,error:.18,speed:3.9,aggression:.45},
  normal:{assist:.14,reaction:.38,error:.10,speed:4.8,aggression:.7},
  hard:{assist:0,reaction:.18,error:.035,speed:5.4,aggression:.95},
};
export function chargeQuality(type,seconds) {
  const spec=STRIKES[type]||STRIKES.hip;
  return THREE.MathUtils.clamp(1-Math.abs(seconds-spec.ideal)/(spec.ideal*.85),0,1);
}
export function strikeContact(actor,ball,type='hip',angle=actor.angle||0) {
  const spec=STRIKES[type]||STRIKES.hip;
  const center=actor.position.clone();center.y=spec.height;
  const delta=ball.pos.clone().sub(center),distance=delta.length();
  const normal=new THREE.Vector3(delta.x,0,delta.z);
  if(normal.lengthSq()<.0001)normal.set(Math.sin(angle),0,Math.cos(angle));
  normal.normalize();
  const alignment=normal.dot(new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)));
  return {legal:distance<=spec.reach && alignment>-.1,distance,normal,alignment:Math.max(.15,alignment)};
}
export function strikeVelocity(position,velocity,angle,ring,options={}) {
  const {type='hip',seconds=.15,kinetic=0,momentum=new THREE.Vector3(),normal=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)),error=0,pass=false,deflect=false}=options;
  const spec=STRIKES[type]||STRIKES.hip,quality=chargeQuality(type,seconds);
  const charge=THREE.MathUtils.clamp(seconds/spec.max,0,1);
  let aim=angle+error*spec.spread*(1-quality);
  const toward=Math.atan2(ring.x-position.x,ring.z-position.z);
  const difference=Math.atan2(Math.sin(toward-aim),Math.cos(toward-aim));
  if(!pass && !deflect && Math.abs(difference)<.35)aim+=difference*(options.assist??0);
  const direction=new THREE.Vector3(Math.sin(aim),0,Math.cos(aim));
  const alignment=Math.max(.15,direction.dot(normal));
  const power=(.32+.68*charge)*(.65+.35*quality)*(1+kinetic/250)*alignment;
  const result=velocity.clone(),incoming=result.dot(normal);
  if(incoming<0)result.addScaledVector(normal,-incoming*(deflect?1.65:1.35));
  result.multiplyScalar(deflect?.9:.55);
  result.addScaledVector(direction,(pass?7:spec.force)*power+(deflect?3:0));
  result.addScaledVector(momentum,pass?.25:.55);
  result.y=Math.max(result.y*.4,0)+(pass?4:deflect?2:spec.lift)*power;
  if(result.length()>26)result.setLength(26);
  return result;
}
export function chooseContest(candidates,ball) {
  const ranked=candidates.map(candidate=>{
    const contact=strikeContact(candidate.actor,ball,candidate.type,candidate.angle);
    const quality=chargeQuality(candidate.type,candidate.seconds);
    return {...candidate,contact,control:contact.alignment*.45+(1-contact.distance/(STRIKES[candidate.type]?.reach||1.45))*.35+quality*.2};
  }).filter(candidate=>candidate.contact.legal).sort((a,b)=>b.control-a.control || a.actor.id.localeCompare(b.actor.id));
  if(ranked.length>1 && ranked[0].actor.team!==ranked[1].actor.team && Math.abs(ranked[0].control-ranked[1].control)<.07)
    return {clash:ranked.slice(0,2),winner:null};
  return {winner:ranked[0]??null,clash:null};
}
export function resolvePlayerCollisions(actors,dt) {
  const radius=.48;
  for(let pass=0;pass<3;pass++)for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++) {
    const a=actors[i],b=actors[j],away=b.position.clone().sub(a.position).setY(0);
    const distance=away.length();if(distance>=radius*2)continue;
    if(distance<.001)away.set(a.id<b.id?1:-1,0,0);else away.divideScalar(distance);
    const separation=(radius*2-distance)/2;
    a.position.addScaledVector(away,-separation);b.position.addScaledVector(away,separation);
    for(const actor of [a,b]){actor.position.x=THREE.MathUtils.clamp(actor.position.x,-6.25,6.25);actor.position.z=THREE.MathUtils.clamp(actor.position.z,-15,15);}
    if(dt>0) {
      const aPush=(a.bumpTime||0)>0,bPush=(b.bumpTime||0)>0;
      if(aPush!==bPush){const victim=aPush?b:a;victim.stunTime=Math.max(victim.stunTime||0,.25);victim.position.addScaledVector(away,aPush?.10:-.10);}
    }
  }
}
