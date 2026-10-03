import * as THREE from 'three';

import { createCourt, loadArenaModel, updateCourt, addLighting, COURT_WIDTH, COURT_LENGTH } from './court.js';

import { loadCharacters, animateCharacter } from './characters.js';

import { createBall, updateBallVisual, BallState } from './ball.js';

import { setupInput, getMoveVector } from './input.js';

import * as Input from './input.js';

import { predictShot } from './shot.js';

import { Match, opposite } from './match.js';

import { STRIKES, DIFFICULTIES, chargeQuality, strikeContact, passiveBodyContact, strikeVelocity, chooseContest, resolvePlayerCollisions } from './strike.js';

import { decideAI } from './ai.js';

import { createRNG } from './rng.js';

import { readProfile, saveProfile } from './profile.js';

import { STRIKE_DURATION, STRIKE_CONTACT } from './motion.js';

import { createEffects } from './effects.js';

import { framePlay } from './framing.js';



const $ = (id) => document.getElementById(id);
const viewSize=()=>{const {width,height}=$('app').getBoundingClientRect();return {width:Math.max(1,width),height:Math.max(1,height)};};

const touchLayout=()=>matchMedia('(pointer: coarse)').matches||innerWidth<600;
let safePlayFrame={top:.10,bottom:.13};
function measurePlayFrame(){
  if(!touchLayout()){safePlayFrame={top:.10,bottom:.13};return;}
  const {width,height}=viewSize();
  const status=$('ball-status').getBoundingClientRect(),hint=$('hint').getBoundingClientRect();
  const top=(Math.max(status.bottom,hint.height?hint.bottom:0)+12)/height;
  const actions=$('action-controls').getBoundingClientRect(),types=document.querySelector('.strike-types').getBoundingClientRect();
  const stick=$('joystick').getBoundingClientRect();
  safePlayFrame=width>height?{top,left:(stick.right+12)/width,right:(width-actions.left+12)/width,bottom:.06}
    :{top,bottom:(height-types.top+12)/height};
}
const syncLayout=()=>{document.documentElement.classList.toggle('touch-layout',touchLayout());requestAnimationFrame(measurePlayFrame);};
syncLayout();

const match=new Match(new URLSearchParams(location.search).has('e2e')?17:Date.now());

let storage;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{}};}

const profile=readProfile(storage);

const visual={elapsed:0,shake:0,hitStop:0,dustTime:0,nextServe:'sun',resultSaved:false};

const cosmeticRng=createRNG(23);

function hasWebGL() {

  try { const c = document.createElement('canvas'); return Boolean(window.WebGLRenderingContext && c.getContext('webgl')); } catch { return false; }

}

if (!hasWebGL()) { $('webgl-error').style.display = 'flex'; throw new Error('WebGL unavailable'); }



const canvas = $('game-canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });

renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 900 ? 1.35 : 1.8));

renderer.setSize(viewSize().width, viewSize().height, false);

renderer.shadowMap.enabled = true;

renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.toneMapping = THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1.12;



const scene = new THREE.Scene();

scene.fog = new THREE.FogExp2(0xc49a7a, .009);

const camera = new THREE.PerspectiveCamera(52, viewSize().width / viewSize().height, .1, 400);

camera.position.set(0, 4.5, 8);

function resizeViewport() {

  const {width,height}=viewSize();camera.aspect = width / height;

  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.35:1.8));

  renderer.setSize(width, height, false);syncLayout();

}
addEventListener('resize',resizeViewport);window.visualViewport?.addEventListener('resize',resizeViewport);



addLighting(scene);

const { ringMesh, ringWorldPos, arena, fallbackDecor } = createCourt(scene);

const ballMesh = createBall(scene);

const ballState = new BallState(()=>match.rng());

const ballMarker=new THREE.Mesh(new THREE.RingGeometry(.46,.54,32),new THREE.MeshBasicMaterial({color:0xffdc91,transparent:true,opacity:.5,depthWrite:false}));

ballMarker.rotation.x=-Math.PI/2;scene.add(ballMarker);



const manager = new THREE.LoadingManager();

manager.onProgress = (_url, loaded, total) => { $('loadbar').style.width = `${Math.round(loaded / total * 100)}%`; };

manager.onLoad = () => {};

manager.onError = () => { $('loading-note').textContent = 'Using optimized arena warrior'; };



const arenaReady = loadArenaModel(arena, fallbackDecor, manager).catch(() => {

  fallbackDecor.visible = true;

  $('loading-note').textContent = 'Arena fallback active';

});



let playerChar=null,playerRig=null,playerActor=null,aiFighters=[];

const STRIKER_MODEL = './assets/characters/player.glb';

const charactersReady = loadCharacters(scene, manager, STRIKER_MODEL).then((result) => {

  playerChar = result.player.character; playerRig = result.player.rig;

  aiFighters = result.ai;match.actors=result.fighters;playerActor=result.player;

  for(const fighter of match.actors){fighter.spawn=[...fighter.position];fighter.position=fighter.character.position;fighter.velocity=new THREE.Vector3();fighter.cooldown=0;fighter.swingTimer=0;fighter.pendingStrike=null;fighter.charging=false;fighter.charge=0;fighter.bumpTime=0;fighter.bumpCooldown=0;fighter.stunTime=0;fighter.type='hip';fighter.bodyCooldown=0;}

  setAccent();

  for (const fighter of result.fighters) {

    const marker = new THREE.Mesh(

      new THREE.CircleGeometry(.48, 24),

      new THREE.MeshBasicMaterial({ color: fighter.team === 'sun' ? 0x12c9b5 : 0xed4050, transparent: true, opacity: .22, depthWrite: false })

    );

    marker.rotation.x = -Math.PI / 2;

    marker.position.y = .035;

    fighter.character.add(marker);

    fighter.marker = marker;

  }

  setAIVisibility(match.mode==='versus');

});

Promise.all([arenaReady,charactersReady]).then(()=>{

  // The menu must become usable as soon as assets are ready. A delayed timer can

  // leave the full-screen overlay visible indefinitely in throttled WebKit tabs.

  $('loading').style.display='none';

});



const aimGroup = new THREE.Group();

const aimRing = new THREE.Mesh(new THREE.RingGeometry(.6, .69, 32), new THREE.MeshBasicMaterial({ color: 0x43d5bb, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false }));

aimRing.rotation.x = -Math.PI / 2;

const aimArrow = new THREE.Mesh(new THREE.ConeGeometry(.16, .55, 8), new THREE.MeshBasicMaterial({ color: 0xffbc45 }));

aimArrow.rotation.x = Math.PI / 2; aimArrow.position.z = .82; aimArrow.position.y = .08;

aimGroup.add(aimRing, aimArrow); scene.add(aimGroup);

const shotGuidePositions=new Float32Array(49*3),shotGuideDistances=new Float32Array(49),shotGuideGeometry=new THREE.BufferGeometry();

shotGuideGeometry.setAttribute('position',new THREE.BufferAttribute(shotGuidePositions,3).setUsage(THREE.DynamicDrawUsage));

shotGuideGeometry.setAttribute('lineDistance',new THREE.BufferAttribute(shotGuideDistances,1).setUsage(THREE.DynamicDrawUsage));

const shotGuide=new THREE.Line(shotGuideGeometry,new THREE.LineDashedMaterial({color:0xffe3a0,transparent:true,opacity:.85,dashSize:.24,gapSize:.12,depthWrite:false}));

shotGuide.frustumCulled=false;shotGuide.visible=false;scene.add(shotGuide);

let guideTime=0;





const effects=createEffects(scene);

const clock=new THREE.Clock();

const goalBase=ringMesh.position.clone();

const zones=[];

for(const [z,color] of [[-14.7,0x21c6b2],[14.7,0xed4050]]) {

  const zone=new THREE.Mesh(new THREE.PlaneGeometry(13,2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.25,depthWrite:false}));

  zone.rotation.x=-Math.PI/2;zone.position.set(0,.045,z);scene.add(zone);zones.push(zone);

}

const obstacles=[{id:'a',x:-2.5,z:5,radius:.6,height:1.8},{id:'b',x:2.5,z:-5,radius:.6,height:1.8}];

for(const obstacle of obstacles){obstacle.mesh=new THREE.Mesh(new THREE.CylinderGeometry(.6,.7,1.8,12),new THREE.MeshStandardMaterial({color:0x94754b,roughness:.9}));obstacle.mesh.position.set(obstacle.x,.9,obstacle.z);obstacle.mesh.castShadow=true;obstacle.mesh.visible=false;scene.add(obstacle.mesh);}

let audioContext=null;

function unlockAudio(){try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();}catch{}}

function impact(power=8) {

  if(!audioContext)return;

  try {

    const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();

    osc.frequency.setValueAtTime(100+power*3,now);osc.frequency.exponentialRampToValueAtTime(40,now+.16);

    gain.gain.setValueAtTime(.06+power*.003,now);gain.gain.exponentialRampToValueAtTime(.001,now+.18);

    osc.connect(gain).connect(audioContext.destination);osc.start(now);osc.stop(now+.19);

    const count=Math.floor(audioContext.sampleRate*.1),buffer=audioContext.createBuffer(1,count,audioContext.sampleRate),data=buffer.getChannelData(0);

    for(let i=0;i<count;i++)data[i]=(cosmeticRng()*2-1)*(1-i/count);

    const noise=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),ng=audioContext.createGain();

    noise.buffer=buffer;filter.type='bandpass';filter.frequency.value=650+power*35;ng.gain.value=.07;

    noise.connect(filter).connect(ng).connect(audioContext.destination);noise.start();

  }catch{}

}

function callout(text,kind=''){const element=$('callout');element.textContent=text;element.className=kind;requestAnimationFrame(()=>element.classList.add('show'));}

function setAIVisibility(visible){for(const fighter of aiFighters){fighter.enabled=visible;fighter.character.visible=visible;}}

function setAccent(){

  if(!playerChar)return;

  const pigment=new THREE.Color(profile.style==='amber'&&profile.wins>=3?0xd89928:0x078c88);

  playerChar.traverse(mesh=>{

    if(!mesh.isSkinnedMesh||!mesh.geometry.attributes.color)return;

    if(!mesh.userData.originalColors){mesh.geometry=mesh.geometry.clone();mesh.userData.originalColors=mesh.geometry.attributes.color.array.slice();}

    const source=mesh.userData.originalColors,target=mesh.geometry.attributes.color.array;

    for(let i=0;i<source.length;i+=3){if(source[i+1]>source[i]*1.5&&source[i+2]>source[i]*1.5){target[i]=pigment.r;target[i+1]=pigment.g;target[i+2]=pigment.b;}else{target[i]=source[i];target[i+1]=source[i+1];target[i+2]=source[i+2];}}

    mesh.geometry.attributes.color.needsUpdate=true;

  });

}

function updateProfile(){

  $('profile-summary').textContent=`Best solo: ${profile.best} · Matches: ${profile.games} · Wins: ${profile.wins}`;

  $('amber-style').disabled=profile.wins<3;$('style-select').value=profile.style;

}

updateProfile();

$('style-select').addEventListener('change',()=>{profile.style=$('style-select').value;saveProfile(storage,profile);setAccent();});

function resetPositions(serve='sun') {

  ballState.reset();match.clearRally();Input.resetInput();visual.hitStop=0;visual.shake=0;

  $('callout').textContent='';$('callout').className='';ballMesh.userData.history.length=0;

  for(const actor of match.actors||[]) {

    actor.position.set(...actor.spawn);actor.character.rotation.y=actor.team==='sun'?0:Math.PI;

    actor.velocity.set(0,0,0);actor.cooldown=actor.swingTimer=actor.charge=actor.bumpTime=actor.bumpCooldown=actor.stunTime=actor.bodyCooldown=0;

    actor.charging=false;actor.pendingStrike=null;actor.target=null;actor.thinkTime=0;actor.contactThink=0;

  }

  if(match.mode!=='versus'&&playerActor){playerActor.position.set(-.8,0,-1.5);}

  if(match.mode==='versus'){ballState.pos.z=serve==='sun'?-3.5:3.5;ballState.vel.z=serve==='sun'?1:-1;}

  ringMesh.position.copy(goalBase);ringMesh.scale.setScalar(1);ringMesh.getWorldPosition(ringWorldPos);

  ballState.ringRadius=1.12;ballState.ringTube=.22;ballState.obstacles=[];

  for(const obstacle of obstacles)obstacle.mesh.visible=false;

  shotGuide.visible=false;

}

function startGame(mode) {

  if(!playerActor)return;

  unlockAudio();match.start(mode,$('difficulty').value);visual.resultSaved=false;setAIVisibility(mode==='versus');resetPositions();

  $('menu').style.display=$('endscreen').style.display=$('pause-screen').style.display='none';

  for(const id of ['hud','energy','hint','action-controls','charge-meter','pause-btn'])$(id).classList.remove('hidden');

  $('touch-controls').classList.remove('hidden');

  $('rival-score').style.display=mode==='versus'?'':'none';$('player-label').textContent=mode==='versus'?'Sun Team':'Points';
  $('rival-label').textContent='Rival Team';

  $('hint').classList.toggle('practice-hint',mode==='practice');requestAnimationFrame(measurePlayFrame);
  $('center-label').textContent=mode==='practice'?'Drill':'Time';$('countdown').style.display='flex';$('countdown-value').textContent='3';canvas.focus();
  updateHUD();

}

for(const button of document.querySelectorAll('.mode-btn'))button.addEventListener('click',()=>startGame(button.dataset.mode));

$('restart-btn').addEventListener('click',()=>startGame(match.mode));

function cancelCharge(){if(playerActor){playerActor.charging=false;playerActor.charge=0;}}

function togglePause(force){

  if(!['playing','countdown','goal'].includes(match.phase))return;

  match.paused=typeof force==='boolean'?force:!match.paused;clock.getDelta();Input.resetInput();

  $('pause-screen').style.display=match.paused?'flex':'none';if(!match.paused)canvas.focus();

}

$('pause-btn').addEventListener('click',()=>togglePause());$('resume-btn').addEventListener('click',()=>togglePause(false));

addEventListener('blur',()=>togglePause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)togglePause(true);});

function returnToMenu(){

  match.phase='menu';match.mode=null;match.paused=false;resetPositions();setAIVisibility(false);clock.getDelta();

  for(const id of ['countdown','endscreen','pause-screen'])$(id).style.display='none';$('menu').style.display='flex';

  for(const id of ['hud','energy','hint','action-controls','charge-meter','pause-btn','touch-controls'])$(id).classList.add('hidden');updateProfile();

}

$('menu-btn').addEventListener('click',returnToMenu);$('pause-menu-btn').addEventListener('click',returnToMenu);

function canAct(){return playerActor&&match.phase==='playing'&&!match.paused&&playerActor.cooldown<=0&&playerActor.stunTime<=0&&(!match.freeStrike||match.freeStrike==='sun');}

function beginCharge(){if(!canAct())return;unlockAudio();playerActor.charging=true;playerActor.charge=0;}

function queueAction(actor,action){actor.pendingStrike={...action,actor,error:(match.rng()*2-1)};actor.animationType=action.type;actor.swingTimer=STRIKE_DURATION;actor.cooldown=Math.max(actor.cooldown,.65);actor.character.rotation.y=action.angle;}

function releaseCharge(){

  if(!playerActor?.charging)return;const seconds=playerActor.charge;playerActor.charging=false;playerActor.charge=0;

  if(!canAct())return;

  const angle=Input.mouseAimAngle,type=playerActor.type,contact=strikeContact(playerActor,ballState,type,angle);

  if(!contact.legal){callout(contact.distance>STRIKES[type].reach?'GET CLOSER':'BALL BEHIND YOU','muted');return;}

  queueAction(playerActor,{type,seconds,angle});

}

function passBall(){

  if(!canAct())return;const teammate=aiFighters.find(actor=>actor.team==='sun'&&actor.enabled);

  if(!teammate){callout('PASSES NEED A TEAMMATE','muted');return;}

  cancelCharge();const target=teammate.position.clone().addScaledVector(teammate.velocity,.25);

  queueAction(playerActor,{type:'elbow',seconds:.35,angle:Math.atan2(target.x-ballState.pos.x,target.z-ballState.pos.z),pass:true});

}

function deflectBall(){if(canAct()){cancelCharge();queueAction(playerActor,{type:'elbow',seconds:.35,angle:Math.atan2(ballState.pos.x-playerActor.position.x,ballState.pos.z-playerActor.position.z),deflect:true});}}

function bump(){if(!playerActor||match.paused||match.phase!=='playing'||playerActor.bumpCooldown>0)return;cancelCharge();playerActor.bumpTime=.22;playerActor.bumpCooldown=1.8;playerActor.character.rotation.y=Input.mouseAimAngle;}

setupInput(canvas,camera,()=>playerChar?.position,{begin:beginCharge,release:releaseCharge,cancel:cancelCharge,select:type=>{if(playerActor&&!playerActor.charging){playerActor.type=type;updateHUD();}},pass:passBall,deflect:deflectBall,bump});

function finishGame(){

  if(visual.resultSaved)return;visual.resultSaved=true;Input.resetInput();

  for(const id of ['touch-controls','pause-btn','hint','action-controls','charge-meter'])$(id).classList.add('hidden');

  $('endscreen').style.display='flex';

  if(match.mode==='practice'){$('end-mode').textContent='PRACTICE COMPLETE';$('end-title').textContent='FIRST POINT!';}

  else if(match.mode==='solo'){profile.best=Math.max(profile.best,match.scores.sun);$('end-mode').textContent='SOLO TRIAL COMPLETE';$('end-title').textContent=`${match.scores.sun} POINTS`;}

  else{profile.games++;if(match.winner==='sun')profile.wins++;$('end-mode').textContent=match.suddenDeath?'SUDDEN DEATH DECIDED':'MATCH COMPLETE';$('end-title').textContent=match.winner==='sun'?'TIKAL VICTORY':'RIVAL VICTORY';}

  saveProfile(storage,profile);updateProfile();

  $('end-sub').textContent=`${match.scores.sun} — ${match.scores.rival} · ${match.stats.strikes} contacts · ${match.stats.passes} passes · ${match.stats.perfect} perfect releases · ${match.stats.deflections} deflections · Best chain ${match.stats.maxChain}`;

}

function scoreEvent(event){

  if(!event)return;

  visual.nextServe=opposite(event.team);effects.burst(ballState.pos,event.team==='sun'?0xffce68:0xed4050,28);

  impact(16);visual.shake=.35;

  const names={ring:'RING',zone:'BACK ZONE',combo:'WALL COMBO',bounce:'SECOND BOUNCE'};

  callout(`${event.team==='sun'?'SUN':'RIVAL'} +${event.points} · ${names[event.kind]}`,event.team==='sun'?'score':'rival');

  if(match.phase==='ended')finishGame();

}

function applyContact(candidate){

  const {actor,type,seconds,angle,pass=false,deflect=false,error=0,contact}=candidate;

  const quality=chargeQuality(type,seconds);

  const storedKinetic=match.kinetic[actor.team];
  if(!match.legalStrike(actor,quality,deflect))return;

  ballState.vel.copy(strikeVelocity(ballState.pos,ballState.vel,angle,ringWorldPos,{type,seconds,pass,deflect,error,normal:contact.normal,momentum:actor.velocity,kinetic:storedKinetic,assist:DIFFICULTIES[match.difficulty].assist}));

  if(!pass&&!deflect)match.kinetic[actor.team]=Math.max(0,match.kinetic[actor.team]-Math.min(storedKinetic,20*quality));
  ballState.heldCooldown=.12;actor.bodyCooldown=.25;

  visual.shake=Math.min(.5,.08+ballState.vel.length()*.014);visual.hitStop=.025+quality*.02;

  effects.burst(ballState.pos,actor.team==='sun'?0xffcd72:0xf15e52,14);impact(ballState.vel.length());

  callout(pass?'PASS!':deflect?'DEFLECT!':quality>.85?'PERFECT RELEASE!':STRIKES[type].name.toUpperCase(),actor.team==='sun'?'player':'ai');

}

function updateActors(dt,wallDt){

  const actors=(match.actors||[]).filter(actor=>actor===playerActor||actor.enabled);

  for(const actor of actors){actor.previous=actor.position.clone();actor.cooldown=Math.max(0,actor.cooldown-dt);actor.stunTime=Math.max(0,actor.stunTime-dt);actor.bumpTime=Math.max(0,actor.bumpTime-dt);actor.bumpCooldown=Math.max(0,actor.bumpCooldown-dt);actor.bodyCooldown=Math.max(0,actor.bodyCooldown-dt);}

  if(playerActor.charging)playerActor.charge=Math.min(1.8,playerActor.charge+wallDt);

  const {mx,mz,moving}=getMoveVector(),chargeSpeed=playerActor.charging?.65:1;

  playerActor.velocity.x=THREE.MathUtils.damp(playerActor.velocity.x,mx*7.2*chargeSpeed,moving?14:20,dt);

  playerActor.velocity.z=THREE.MathUtils.damp(playerActor.velocity.z,mz*7.2*chargeSpeed,moving?14:20,dt);

  if(playerActor.bumpTime>0)playerActor.velocity.set(Math.sin(playerChar.rotation.y)*11,0,Math.cos(playerChar.rotation.y)*11);

  if(playerActor.stunTime>0)playerActor.velocity.multiplyScalar(.15);

  playerActor.position.addScaledVector(playerActor.velocity,dt);

  if(moving&&!playerActor.charging&&playerActor.swingTimer<=0){const target=Math.atan2(mx,mz),turn=Math.atan2(Math.sin(target-playerChar.rotation.y),Math.cos(target-playerChar.rotation.y));playerChar.rotation.y+=turn*(1-Math.exp(-14*dt));}

  for(const actor of actors.filter(actor=>actor!==playerActor)){

    const decision=decideAI(actor,actors,ballState,match,ringWorldPos,dt);

    actor.velocity.copy(decision.direction).multiplyScalar(decision.speed);

    if(actor.swingTimer>0||actor.stunTime>0)actor.velocity.set(0,0,0);

    actor.position.addScaledVector(actor.velocity,dt);

    if(actor.velocity.lengthSq()>.01&&actor.swingTimer<=0){const target=Math.atan2(actor.velocity.x,actor.velocity.z),turn=Math.atan2(Math.sin(target-actor.character.rotation.y),Math.cos(target-actor.character.rotation.y));actor.character.rotation.y+=turn*(1-Math.exp(-12*dt));}

    if(decision.action)queueAction(actor,decision.action);

  }

  resolvePlayerCollisions(actors,dt);

  for(const actor of actors){

    actor.position.x=THREE.MathUtils.clamp(actor.position.x,-6.25,6.25);actor.position.z=THREE.MathUtils.clamp(actor.position.z,-15,15);

    for(const obstacle of ballState.obstacles||[]){const away=actor.position.clone().sub(new THREE.Vector3(obstacle.x,0,obstacle.z));const distance=away.length();if(distance<obstacle.radius+.48){if(distance<.001)away.set(1,0,0);actor.position.addScaledVector(away.normalize(),obstacle.radius+.48-distance);}}

    actor.moveSpeed=dt>0?actor.position.distanceTo(actor.previous)/dt:0;

  }

  if(match.mode==='practice'&&match.practiceStep===0&&playerActor.position.distanceTo(ballState.pos.clone().setY(0))<1.3)match.practiceStep=1;

  const candidates=[];

  for(const actor of actors){

    const before=actor.swingTimer;actor.swingTimer=Math.max(0,before-dt);

    if(actor.pendingStrike&&before>STRIKE_CONTACT&&actor.swingTimer<=STRIKE_CONTACT){if(!match.freeStrike||match.freeStrike===actor.team)candidates.push(actor.pendingStrike);actor.pendingStrike=null;}

  }

  if(candidates.length){

    const contest=chooseContest(candidates,ballState);

    if(contest.winner)applyContact(contest.winner);

    else if(contest.clash){ballState.vel.multiplyScalar(.6);ballState.vel.y+=3;ballState.heldCooldown=.18;callout('CONTESTED!');impact(12);}

    else callout('MISSED CONTACT','muted');

  }

  if(ballState.heldCooldown<=0 && ballState.vel.length()>2){

    const touching=actors.filter(actor=>actor.bodyCooldown<=0&&passiveBodyContact(actor,ballState)).sort((a,b)=>a.position.distanceTo(ballState.pos)-b.position.distanceTo(ballState.pos));

    const actor=touching[0];

    if(actor&&(!match.freeStrike||match.freeStrike===actor.team)){

      actor.bodyCooldown=.35;

      if(ballState.pos.y<.48||ballState.pos.y>1.85){

        const awarded=match.foul(actor.team),receiver=actors.filter(a=>a.team===awarded).sort((a,b)=>a.position.distanceTo(ballState.pos)-b.position.distanceTo(ballState.pos))[0];

        ballState.vel.set(0,0,0);ballState.scored=false;ballState.pendingPass=0;ballState.heldCooldown=.2;

        if(receiver)ballState.pos.copy(receiver.position).add(new THREE.Vector3(0,.8,receiver.team==='sun'? .9:-.9));

        callout(`ILLEGAL CONTACT · ${awarded.toUpperCase()} FREE STRIKE`,'muted');

      }else{

        const angle=Math.atan2(ballState.pos.x-actor.position.x,ballState.pos.z-actor.position.z);

        const contact=strikeContact(actor,ballState,'hip',angle);

        if(contact.legal)applyContact({actor,type:'hip',seconds:.1,angle,deflect:true,contact});

      }

    }

  }

}

function updateHUD(){

  $('score-player').textContent=match.scores.sun;$('score-ai').textContent=match.scores.rival;

  $('center-value').textContent=match.suddenDeath?'SD':match.mode==='practice'?`${Math.min(3,match.practiceStep+1)}/3`:Math.ceil(match.timeLeft);

  const energy=Math.round(match.kinetic.sun);$('energy-fill').style.width=`${energy}%`;$('energy-value').textContent=`${energy}%`;

  $('ball-status').textContent=match.freeStrike?`${match.freeStrike.toUpperCase()} FREE STRIKE`: `${match.lastTouch?.toUpperCase()||'NEUTRAL'} · Bounces ${match.groundBounces}/1 · Walls ${match.wallContacts.size} · Chain ${match.passChain}`;

  const type=playerActor?.type||'hip',seconds=playerActor?.charge||0,quality=chargeQuality(type,seconds),charge=seconds/STRIKES[type].max;

  $('charge-fill').style.width=`${Math.min(1,charge)*100}%`;$('charge-fill').classList.toggle('perfect',quality>.85);
  $('release-window').style.left=`${STRIKES[type].ideal*.8725/STRIKES[type].max*100}%`;
  $('release-window').style.width=`${STRIKES[type].ideal*.255/STRIKES[type].max*100}%`;

  $('charge-label').textContent=playerActor?.charging?(quality>.85?'RELEASE NOW':charge>1?'OVERCHARGED':`CHARGING ${STRIKES[type].name.toUpperCase()}`):`${STRIKES[type].name.toUpperCase()} · HOLD / RELEASE`;

  const hit=$('hit-btn');hit.style.setProperty('--charge-angle',`${Math.min(1,charge)*360}deg`);
  hit.style.setProperty('--window-start',`${STRIKES[type].ideal*.8725/STRIKES[type].max*360}deg`);
  hit.style.setProperty('--window-end',`${STRIKES[type].ideal*1.1275/STRIKES[type].max*360}deg`);
  hit.classList.toggle('perfect',Boolean(playerActor?.charging&&quality>.85));
  $('touch-strike-name').textContent=type.toUpperCase();
  $('touch-strike-hint').textContent=playerActor?.charging?(quality>.85?'RELEASE NOW':charge>1?'TOO LONG':'DRAG TO AIM'):'HOLD · DRAG AIM';

  for(const button of document.querySelectorAll('[data-strike]'))button.setAttribute('aria-pressed',String(button.dataset.strike===type));

  $('bump-btn').disabled=Boolean(playerActor?.bumpCooldown>0);

  const contact=playerActor?strikeContact(playerActor,ballState,type,Input.mouseAimAngle):{legal:false};

  const ready=Boolean(match.phase==='playing'&&!match.paused&&canAct()&&contact.legal);

  $('hit-btn').classList.toggle('ready',ready);aimRing.material.color.setHex(ready?0xffd27a:0x43d5bb);

  const show=ready&&playerActor.swingTimer<=0;

  if(show && (!shotGuide.visible||guideTime<=0)){

    const points=predictShot(ballState.pos,Input.mouseAimAngle,ringWorldPos,{type,seconds:playerActor.charging?seconds:STRIKES[type].ideal,velocity:ballState.vel,normal:contact.normal,momentum:playerActor.velocity,kinetic:match.kinetic.sun,assist:DIFFICULTIES[match.difficulty].assist,ringRadius:ballState.ringRadius,ringTube:ballState.ringTube,obstacles:ballState.obstacles});

    let distance=0;points.forEach((point,i)=>{point.toArray(shotGuidePositions,i*3);if(i)distance+=point.distanceTo(points[i-1]);shotGuideDistances[i]=distance;});

    shotGuideGeometry.setDrawRange(0,points.length);shotGuideGeometry.attributes.position.needsUpdate=shotGuideGeometry.attributes.lineDistance.needsUpdate=true;guideTime=.1;

  }

  shotGuide.visible=show;

  const threat=ballState.pos.distanceTo(ringWorldPos)<4&&ballState.vel.length()>7&&ballState.vel.dot(ringWorldPos.clone().sub(ballState.pos))>0;

  $('ring-warning').classList.toggle('hidden',!threat||match.phase!=='playing');ringMesh.material.emissiveIntensity=threat?1:.55;

  ballMarker.material.color.setHex(match.lastTouch==='sun'?0x21c6b2:match.lastTouch==='rival'?0xed4050:0xffdc91);

  if(match.mode==='practice')$('hint').textContent=['Step 1: move near the ball','Step 2: hold STRIKE; release in the gold window','Step 3: aim for the crimson back zone or golden ring','Practice complete'][match.practiceStep];

  else $('hint').textContent=match.suddenDeath?'SUDDEN DEATH · Next ring wins':ready?'IN RANGE · Hold to charge · Release in gold · Pass / Deflect / Bump':'Sun attacks crimson end · Rival attacks teal end · Ring 10 · Zone 1 · Wall combo 3';

}

function updateSolo(){

  const level=Math.floor(match.scores.sun/10),solo=match.mode==='solo';

  ringMesh.position.copy(goalBase);ringMesh.scale.setScalar(solo?Math.max(.75,1-level*.035):1);

  if(solo&&level>0){ringMesh.position.z=Math.sin(visual.elapsed*.65)*Math.min(2.5,level*.55);ringMesh.position.y+=Math.sin(visual.elapsed*.4)*Math.min(.7,level*.15);}

  ringMesh.getWorldPosition(ringWorldPos);ballState.ringRadius=1.12*ringMesh.scale.x;ballState.ringTube=.22*ringMesh.scale.x;

  ballState.obstacles=solo&&level>=3?obstacles:[];for(const obstacle of obstacles)obstacle.mesh.visible=solo&&level>=3;

}

function tick(){

  requestAnimationFrame(tick);const raw=clock.getDelta(),wall=match.paused?0:raw;

  visual.hitStop=Math.max(0,visual.hitStop-wall);const dt=match.paused||visual.hitStop>0?0:Math.min(raw,.1);

  visual.elapsed+=dt;guideTime-=dt;

  if(match.phase==='countdown'&&!match.paused){match.countdownTime-=wall;$('countdown-value').textContent=match.countdownTime>.5?Math.ceil(match.countdownTime):'PLAY';if(match.countdownTime<=0){$('countdown').style.display='none';match.phase='playing';}}

  if(match.phase==='goal'&&!match.paused){match.goalTime-=wall;if(match.goalTime<=0){resetPositions(visual.nextServe);match.phase='playing';}}

  if(match.phase==='playing'&&!match.paused&&playerActor){

    const wasSudden=match.suddenDeath;match.tick(wall);if(!wasSudden&&match.suddenDeath){resetPositions();callout('SUDDEN DEATH · NEXT RING WINS');}

    if(match.phase==='ended')finishGame();

    else if(dt>0){updateSolo();updateActors(dt,wall);ballState.update(dt,ringWorldPos);for(const event of ballState.events){const score=match.ballEvent(event);if(score){scoreEvent(score);break;}}}

  }

  ballMesh.position.copy(ballState.pos);updateBallVisual(ballMesh,ballState.vel,dt);ballMarker.position.set(ballState.pos.x,.04,ballState.pos.z);

  updateCourt(arena,visual.elapsed);effects.update(dt);updateHUD();visual.dustTime-=dt;

  if(playerActor){

    aimGroup.visible=match.phase!=='menu';aimGroup.position.set(playerActor.position.x,.035,playerActor.position.z);aimGroup.rotation.y=Input.mouseAimAngle;

    if(match.phase==='playing'&&playerActor.moveSpeed>1&&visual.dustTime<=0){effects.burst(playerActor.position,0xcdb18a,3,true);visual.dustTime=.13;}

    for(const actor of match.actors){if(actor!==playerActor&&!actor.enabled)continue;animateCharacter(actor.rig,match.phase==='playing'?actor.moveSpeed||0:0,actor.swingTimer,dt,visual.elapsed,actor.animationType||actor.type,actor.charging?Math.min(1,actor.charge/STRIKES[actor.type].ideal):0);}

    const fighters=match.actors.filter(actor=>actor!==playerActor&&actor.enabled).map(actor=>actor.position);
    const frame=framePlay(playerActor.position,ballState.pos,ringWorldPos,camera.aspect,camera.fov,fighters,safePlayFrame),target=frame.target;

    if(visual.shake>0&&dt>0){frame.position.x+=(cosmeticRng()-.5)*visual.shake;frame.position.y+=(cosmeticRng()-.5)*visual.shake;visual.shake=Math.max(0,visual.shake-dt*2);}

    camera.position.lerp(frame.position,1-Math.exp(-5*dt));camera.lookAt(target);

  }

  renderer.render(scene,camera);

}

if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('e2e'))window.__sunStoneTest=Object.freeze({

  snapshot:()=>({mode:match.mode,phase:match.phase,paused:match.paused,scorePlayer:match.scores.sun,scoreAI:match.scores.rival,lastTouch:match.lastTouch,difficulty:match.difficulty,suddenDeath:match.suddenDeath,charging:playerActor?.charging,charge:playerActor?.charge,aim:Input.mouseAimAngle,kinetic:match.kinetic.sun,player:playerActor?.position.toArray(),ball:ballState.pos.toArray(),ballSpeed:ballState.vel.length(),shotGuideVisible:shotGuide.visible,ai:aiFighters.map(a=>({id:a.id,enabled:a.enabled,position:a.position.toArray(),state:a.aiState}))}),

  setupPlayerStrike:inRange=>{if(match.mode!=='solo'||match.phase!=='playing')throw Error('Solo must be playing');match.timeLeft=60;match.clearRally();ballState.reset();const reach=inRange?.9:10;ballState.pos.copy(playerActor.position).add(new THREE.Vector3(Math.sin(Input.mouseAimAngle)*reach,.8,Math.cos(Input.mouseAimAngle)*reach));if(!inRange)ballState.pos.z=playerActor.position.z>0?-12:12;ballState.vel.set(0,0,0);ballState.heldCooldown=0;playerActor.cooldown=playerActor.swingTimer=0;playerActor.pendingStrike=null;},

  prepareScoringFixture:()=>{if(match.mode!=='versus')throw Error('Versus must be started');match.phase='playing';match.scores={sun:0,rival:0};resetPositions();setAIVisibility(false);},
  queueRingShot:team=>{if(match.mode!=='versus'||match.phase!=='playing')throw Error('Versus must be playing');match.clearRally();match.lastTouch=team;match.lastStriker=team==='sun'?'player':'rival-striker';match.rallyArmed=true;ballState.reset();ballState.pos.set(ringWorldPos.x-3,ringWorldPos.y,ringWorldPos.z);ballState.vel.set(20,0,0);for(const a of aiFighters)a.cooldown=3;},

  queueZoneShot:()=>{if(match.mode!=='practice'||match.phase!=='playing')throw Error('Practice must be playing');match.clearRally();match.lastTouch='sun';match.lastStriker='player';match.rallyArmed=true;ballState.reset();ballState.pos.set(3,1,14);ballState.vel.set(0,0,10);},
  expireMatch:()=>{if(match.mode!=='versus'||match.phase!=='playing')throw Error('Versus must be playing');match.timeLeft=0;},

});

tick();
