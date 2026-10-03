import * as THREE from 'three';

export const TEAM_ROSTER = Object.freeze([
  { id: 'player', team: 'sun', control: 'human', role: 'striker', position: [-2.2, 0, -7] },
  { id: 'sun-support', team: 'sun', control: 'ai', role: 'support', position: [2.2, 0, -3.4] },
  { id: 'rival-striker', team: 'rival', control: 'ai', role: 'striker', position: [2.2, 0, 7] },
  { id: 'rival-support', team: 'rival', control: 'ai', role: 'support', position: [-2.2, 0, 3.4] },
]);

export function getSupportTarget(fighter, ballPosition, playerPosition) {
  if (fighter.team === 'sun') {
    const playerToBallZ = ballPosition.z - playerPosition.z;
    return ballPosition.clone().add(new THREE.Vector3(1.1, 0, -Math.sign(playerToBallZ || 1) * 1.2));
  }
  const lane = fighter.id === 'rival-support' ? -1.1 : 1.1;
  return ballPosition.clone().add(new THREE.Vector3(lane, 0, .9));
}

export function getAITarget(fighter, ballPosition, playerPosition, actors=[]) {
  const target=fighter.role === 'support'
    ? getSupportTarget(fighter, ballPosition, playerPosition)
    : ballPosition.clone();
  if(fighter.role==='support') {
    const teammate=actors.find(actor=>actor.team===fighter.team && actor.id!==fighter.id);
    const teammatePosition=teammate?.position ?? (fighter.team==='sun'?playerPosition:null);
    // Leave a clear lane for the teammate who is already contesting the ball.
    if(teammatePosition && teammatePosition.distanceTo(ballPosition)<3.2)
      target.sub(ballPosition).normalize().multiplyScalar(2.5).add(ballPosition);
  }
  return target;
}

export function getAISteering(fighter,target,actors) {
  const direction=target.clone().sub(fighter.position).setY(0);
  if(direction.length()>1)direction.normalize();
  for(const other of actors) {
    if(other.id===fighter.id)continue;
    const away=fighter.position.clone().sub(other.position).setY(0),distance=away.length();
    if(distance>=1.5)continue;
    if(distance<.001)away.set(fighter.id<other.id?-1:1,0,0);
    else away.divideScalar(distance);
    direction.addScaledVector(away,(1-distance/1.5)*2.8);
  }
  if(direction.length()>1)direction.normalize();
  return direction;
}

export function shouldAIAttemptHit(distance, hitCooldown, heldCooldown, hitRange) {
  return distance < hitRange && hitCooldown <= 0 && heldCooldown <= 0;
}

export function scoringTeam(mode, lastTouch) {
  return mode === 'solo' || lastTouch === 'sun' ? 'sun' : 'rival';
}
