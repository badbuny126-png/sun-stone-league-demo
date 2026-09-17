import * as THREE from 'three';

export const keys = {};
export let mouseAimAngle = 0;
let resetStick=()=>{};
export function resetInput() {
  for(const key of Object.keys(keys))delete keys[key];
  touchMove.x=touchMove.z=0;mouseAimAngle=0;resetStick();
}
const touchMove = { x: 0, z: 0 };
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);

export function isMoveKeyDown() {
  return getMoveVector().moving;
}

export function getMoveVector() {
  let mx = touchMove.x;
  let mz = touchMove.z;
  if (keys.KeyW || keys.ArrowUp) mz -= 1;
  if (keys.KeyS || keys.ArrowDown) mz += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  return { mx, mz, moving: len > 0.08 };
}

function updateAim(clientX, clientY, camera, canvas, playerPos) {
  if (!playerPos) return;
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(aimPlane, hit)) mouseAimAngle = Math.atan2(hit.x - playerPos.x, hit.z - playerPos.z);
}

export function setupInput(canvas, camera, getPlayerPos, onHit) {
  window.addEventListener('keydown', (event) => {
    if(event.target.closest?.('button,input,textarea'))return;
    keys[event.code] = true;
    if(event.code.startsWith('Arrow'))event.preventDefault();
    if (event.code === 'Space') { event.preventDefault(); onHit(); }
  });
  window.addEventListener('keyup', (event) => { keys[event.code] = false; });
  let aimId=null;
  window.addEventListener('blur',resetInput);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInput();});
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch' || event.pointerId===aimId) updateAim(event.clientX, event.clientY, camera, canvas, getPlayerPos());
  });
  canvas.addEventListener('pointerdown', (event) => {
    updateAim(event.clientX,event.clientY,camera,canvas,getPlayerPos());
    if (event.pointerType !== 'touch') onHit();
    else{aimId=event.pointerId;canvas.setPointerCapture(aimId);}
  });

  const releaseAim=event=>{if(event.pointerId===aimId)aimId=null;};
  canvas.addEventListener('pointerup',releaseAim);canvas.addEventListener('pointercancel',releaseAim);canvas.addEventListener('lostpointercapture',releaseAim);
  const joystick = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  const hitButton = document.getElementById('hit-btn');
  let stickId = null;
  const updateStick = (event) => {
    const rect = joystick.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const max = rect.width * 0.32;
    const distance = Math.hypot(dx, dy);
    if (distance > max) { dx *= max / distance; dy *= max / distance; }
    touchMove.x = dx / max;
    touchMove.z = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // Movement does not overwrite the independently chosen aim.
  };
  joystick.addEventListener('pointerdown', (event) => { if(stickId!==null)return;stickId = event.pointerId; joystick.setPointerCapture(stickId); updateStick(event); });
  joystick.addEventListener('pointermove', (event) => { if (event.pointerId === stickId) updateStick(event); });
  const releaseStick = (event) => {
    if (event.pointerId !== stickId) return;
    stickId = null; touchMove.x = 0; touchMove.z = 0; knob.style.transform = 'translate(0, 0)';
  };
  resetStick=()=>{
    const captured=stickId;stickId=null;aimId=null;
    if(captured!==null&&joystick.hasPointerCapture(captured))joystick.releasePointerCapture(captured);
    knob.style.transform='translate(0, 0)';
  };
  joystick.addEventListener('lostpointercapture',releaseStick);
  joystick.addEventListener('pointerup', releaseStick);
  joystick.addEventListener('pointercancel', releaseStick);
  hitButton.addEventListener('pointerdown', (event) => { event.preventDefault(); onHit(); });
}
