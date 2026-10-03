import * as THREE from 'three';

// Fit the player, ball and goal with a fixed camera pitch. Account for horizontal
// FOV on a narrow phone rather than simply raising the camera in portrait.
export function framePlay(player,ball,ring,aspect,fov=52,fighters=[],safe={}) {
  const points=[player.clone().setY(.1),player.clone().setY(2.3),ball.clone(),ring.clone()];
  for(const fighter of fighters)points.push(fighter.clone().setY(.1),fighter.clone().setY(2.3));
  const bounds=new THREE.Box3().setFromPoints(points),center=bounds.getCenter(new THREE.Vector3());
  const tangent=Math.tan(THREE.MathUtils.degToRad(fov/2));
  const {left=0,right=0,top=0,bottom=0}=safe;
  const width=Math.max(.25,1-left-right),height=Math.max(.25,1-top-bottom);
  const minX=-1+2*left,maxX=1-2*right,minY=-1+2*bottom,maxY=1-2*top;
  let distance=9;
  for(const point of points) {
    const offset=point.clone().sub(center),depth=offset.y*.6+offset.z*.8,up=offset.y*.8-offset.z*.6;
    distance=Math.max(distance,(offset.x/(tangent*aspect)+maxX*depth)/width,
      (-offset.x/(tangent*aspect)-minX*depth)/width,
      (up/tangent+maxY*depth)/height,(-up/tangent-minY*depth)/height);
  }
  distance+=2.5;
  const target=center.clone().add(new THREE.Vector3(-(left-right)*distance*tangent*aspect,0,0))
    .addScaledVector(new THREE.Vector3(0,.8,-.6),-(bottom-top)*distance*tangent);
  return {target,position:target.clone().add(new THREE.Vector3(0,distance*.6,distance*.8))};
}
