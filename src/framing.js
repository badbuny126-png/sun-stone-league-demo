import * as THREE from 'three';

// Fit the player, ball and goal with a fixed camera pitch. Account for horizontal
// FOV on a narrow phone rather than simply raising the camera in portrait.
export function framePlay(player,ball,ring,aspect,fov=52) {
  const points=[player.clone().setY(.1),player.clone().setY(2.3),ball.clone(),ring.clone()];
  const bounds=new THREE.Box3().setFromPoints(points),target=bounds.getCenter(new THREE.Vector3());
  const tangent=Math.tan(THREE.MathUtils.degToRad(fov/2));
  let distance=9;
  for(const point of points) {
    const offset=point.clone().sub(target),depth=offset.y*.6+offset.z*.8;
    distance=Math.max(distance,depth+Math.abs(offset.x)/(tangent*aspect),depth+Math.abs(offset.y*.8-offset.z*.6)/tangent);
  }
  distance+=2.5;
  return {target,position:target.clone().add(new THREE.Vector3(0,distance*.6,distance*.8))};
}
