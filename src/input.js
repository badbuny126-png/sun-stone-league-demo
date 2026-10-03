import * as THREE from 'three';
export const keys={};
export let mouseAimAngle=0;
const touchMove={x:0,z:0};let resetControls=()=>{};
export function resetInput(){for(const key of Object.keys(keys))delete keys[key];touchMove.x=touchMove.z=0;resetControls();}
export function getMoveVector() {
  let mx=touchMove.x,mz=touchMove.z;
  if(keys.KeyW||keys.ArrowUp)mz--;if(keys.KeyS||keys.ArrowDown)mz++;
  if(keys.KeyA||keys.ArrowLeft)mx--;if(keys.KeyD||keys.ArrowRight)mx++;
  const length=Math.hypot(mx,mz);if(length>1){mx/=length;mz/=length;}
  return {mx,mz,moving:length>.08};
}
export function isMoveKeyDown(){return getMoveVector().moving;}
export function setupInput(canvas,camera,getPlayerPos,actions) {
  const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.95);
  let aimId=null,stickId=null,strikeId=null,mouseHeld=false,keyHeld=false,strikeOrigin=null;
  const stick=document.getElementById('joystick'),knob=document.getElementById('joystick-knob'),hit=document.getElementById('hit-btn');
  function aim(event){const position=getPlayerPos();if(!position)return;const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);const point=new THREE.Vector3();if(raycaster.ray.intersectPlane(plane,point))mouseAimAngle=Math.atan2(point.x-position.x,point.z-position.z);}
  window.addEventListener('keydown',event=>{
    if(event.target.closest?.('button,input,textarea,select'))return;
    keys[event.code]=true;if(event.code.startsWith('Arrow')||event.code==='Space')event.preventDefault();if(event.repeat)return;
    if(event.code==='Space'){keyHeld=true;actions.begin();}
    if(['Digit1','Digit2','Digit3'].includes(event.code))actions.select(['hip','elbow','knee'][Number(event.code.slice(-1))-1]);
    if(event.code==='KeyQ')actions.pass();if(event.code==='KeyE')actions.deflect();if(event.code==='ShiftLeft'||event.code==='ShiftRight')actions.bump();
  });
  window.addEventListener('keyup',event=>{keys[event.code]=false;if(event.code==='Space'&&keyHeld){keyHeld=false;actions.release();}});
  canvas.addEventListener('pointerdown',event=>{aim(event);canvas.setPointerCapture(event.pointerId);if(event.pointerType==='touch')aimId=event.pointerId;else{mouseHeld=true;actions.begin();}});
  canvas.addEventListener('pointermove',event=>{if(event.pointerType!=='touch'||event.pointerId===aimId)aim(event);});
  canvas.addEventListener('pointerup',event=>{if(event.pointerId===aimId)aimId=null;if(mouseHeld){mouseHeld=false;actions.release();}});
  canvas.addEventListener('pointercancel',()=>{mouseHeld=false;aimId=null;actions.cancel();});
  canvas.addEventListener('lostpointercapture',()=>{if(mouseHeld){mouseHeld=false;actions.cancel();}aimId=null;});
  const updateStick=event=>{const rect=stick.getBoundingClientRect();let x=event.clientX-rect.left-rect.width/2,z=event.clientY-rect.top-rect.height/2;const limit=rect.width*.32,length=Math.hypot(x,z);if(length>limit){x*=limit/length;z*=limit/length;}touchMove.x=x/limit;touchMove.z=z/limit;knob.style.transform=`translate(${x}px,${z}px)`;};
  stick.addEventListener('pointerdown',event=>{if(stickId!==null)return;stickId=event.pointerId;stick.setPointerCapture(stickId);updateStick(event);});
  stick.addEventListener('pointermove',event=>{if(event.pointerId===stickId)updateStick(event);});
  const releaseStick=event=>{if(event.pointerId!==stickId)return;stickId=null;touchMove.x=touchMove.z=0;knob.style.transform='';};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,releaseStick);
  hit.addEventListener('pointerdown',event=>{event.preventDefault();if(strikeId!==null)return;strikeId=event.pointerId;strikeOrigin={x:event.clientX,y:event.clientY};hit.setPointerCapture(strikeId);actions.begin();});
  function padAim(event){if(event.pointerId!==strikeId||!strikeOrigin)return;const dx=event.clientX-strikeOrigin.x,dy=event.clientY-strikeOrigin.y;if(Math.hypot(dx,dy)>12)mouseAimAngle=Math.atan2(dx,dy);}
  hit.addEventListener('pointermove',padAim);
  hit.addEventListener('pointerup',event=>{if(event.pointerId===strikeId){padAim(event);strikeId=null;strikeOrigin=null;actions.release();}});
  const cancelStrike=()=>{if(strikeId!==null){strikeId=null;strikeOrigin=null;actions.cancel();}};
  hit.addEventListener('pointercancel',cancelStrike);hit.addEventListener('lostpointercapture',cancelStrike);
  resetControls=()=>{stickId=aimId=strikeId=null;strikeOrigin=null;mouseHeld=keyHeld=false;touchMove.x=touchMove.z=0;knob.style.transform='';actions.cancel();};
  document.querySelectorAll('[data-strike]').forEach(button=>button.addEventListener('click',()=>{actions.select(button.dataset.strike);canvas.focus();}));
  for(const [id,action] of [['pass-btn','pass'],['deflect-btn','deflect'],['bump-btn','bump']])document.getElementById(id).addEventListener('click',()=>{actions[action]();canvas.focus();});
  window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInput();});
}
