import * as THREE from 'three';
import { createCourt, loadArenaModel, updateCourt, addLighting, COURT_WIDTH, COURT_LENGTH } from './court.js';
import { loadCharacters, animateCharacter } from './characters.js';
import { createBall, updateBallVisual, BallState } from './ball.js';
import { setupInput, getMoveVector } from './input.js';
import * as Input from './input.js';
import { shotVelocity } from './shot.js';

const $ = (id) => document.getElementById(id);
function hasWebGL() {
  try { const c = document.createElement('canvas'); return Boolean(window.WebGLRenderingContext && c.getContext('webgl')); } catch { return false; }
}
if (!hasWebGL()) { $('webgl-error').style.display = 'flex'; throw new Error('WebGL unavailable'); }

const canvas = $('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 900 ? 1.35 : 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xaab3ac, .004);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .1, 400);
camera.position.set(0, 4.5, 8);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.35:1.8));
  renderer.setSize(innerWidth, innerHeight);
});

addLighting(scene);
const { ringMesh, ringWorldPos, arena, fallbackDecor } = createCourt(scene);
const ballMesh = createBall(scene);
const ballState = new BallState();

const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => { $('loadbar').style.width = `${Math.round(loaded / total * 100)}%`; };
manager.onLoad = () => {};
manager.onError = () => { $('loading-note').textContent = 'Using optimized arena warrior'; };

const arenaReady = loadArenaModel(arena, fallbackDecor, manager).catch(() => {
  fallbackDecor.visible = true;
  $('loading-note').textContent = 'Arena fallback active';
});

let playerChar = null, aiChar = null, playerRig = null, aiRig = null;
const STRIKER_MODEL = './assets/characters/player.glb';
const charactersReady = loadCharacters(scene, manager, STRIKER_MODEL).then((result) => {
  playerChar = result.playerChar; aiChar = result.aiChar;
  playerRig = result.playerBones; aiRig = result.aiBones;
  aiChar.visible = mode !== 'solo';
});
Promise.all([arenaReady,charactersReady]).then(()=>{
  $('loading').classList.add('depart');
  setTimeout(()=>{$('loading').style.display='none';},450);
});

const aimGroup = new THREE.Group();
const aimRing = new THREE.Mesh(new THREE.RingGeometry(.6, .69, 32), new THREE.MeshBasicMaterial({ color: 0x43d5bb, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false }));
aimRing.rotation.x = -Math.PI / 2;
const aimArrow = new THREE.Mesh(new THREE.ConeGeometry(.16, .55, 8), new THREE.MeshBasicMaterial({ color: 0xffbc45 }));
aimArrow.rotation.x = Math.PI / 2; aimArrow.position.z = .82; aimArrow.position.y = .08;
aimGroup.add(aimRing, aimArrow); scene.add(aimGroup);

const particleGeometry = new THREE.SphereGeometry(.055, 5, 4);
const particles = [];
function burst(position, color = 0xffa52b, count = 16) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  material.userData.remaining=count;
  for (let i = 0; i < count; i += 1) {
    const particle = new THREE.Mesh(particleGeometry, material);
    particle.position.copy(position);
    particle.userData.velocity = new THREE.Vector3((Math.random()-.5)*5, Math.random()*4.5, (Math.random()-.5)*5);
    particle.userData.life = .45 + Math.random() * .35;
    scene.add(particle); particles.push(particle);
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.userData.life -= dt;
    particle.userData.velocity.y -= 8 * dt;
    particle.position.addScaledVector(particle.userData.velocity, dt);
    particle.material.opacity = Math.max(0, particle.userData.life * 1.8);
    if (particle.userData.life <= 0) { scene.remove(particle); particles.splice(i,1); if(--particle.material.userData.remaining===0)particle.material.dispose(); }
  }
}

let audioContext = null;
function tone(frequency, duration, type = 'sine', volume = .06) {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional. */ }
}

const TARGET_SCORE = 3, SOLO_SECONDS = 60, HIT_RANGE = 2.05, PLAYER_SPEED = 7.2, AI_SPEED = 5.05;
let mode = null, phase = 'menu', scorePlayer = 0, scoreAI = 0, timeLeft = SOLO_SECONDS;
let playerHitCooldown = 0, aiHitCooldown = 0, playerSwingTimer = 0, aiSwingTimer = 0;
let lastTouch = 'player', currentAimAngle = 0, shake = 0;
let goalTime=0,countdownTime=0,paused=false,playerMoveSpeed=0,aiMoveSpeed=0;

function callout(text, kind = '') {
  const element = $('callout'); element.textContent = text; element.className = kind;
  element.classList.remove('show'); requestAnimationFrame(() => element.classList.add('show'));
}

function resetPositions() {
  ballState.reset(); Input.resetInput();
  playerHitCooldown=aiHitCooldown=playerSwingTimer=aiSwingTimer=0;
  lastTouch='player';playerMoveSpeed=aiMoveSpeed=0;
  ballMesh.userData.history.length=0;
  if (playerChar) { playerChar.position.set(-2.2, 0, -7); playerChar.rotation.y = 0; }
  if (aiChar) { aiChar.position.set(2.2, 0, 7); aiChar.rotation.y = Math.PI; }
}

function updateHUD() {
  $('score-player').textContent = scorePlayer; $('score-ai').textContent = scoreAI;
  $('center-value').textContent = mode === 'solo' ? Math.max(0, Math.ceil(timeLeft)) : TARGET_SCORE;
  const energy = Math.round(THREE.MathUtils.clamp(ballState.vel.length() / 15, 0, 1) * 100);
  $('energy-fill').style.width = `${energy}%`; $('energy-value').textContent = `${energy}%`;
}

function beginCountdown() {
  phase='countdown';countdownTime=3;
  $('countdown').style.display='flex';$('countdown-value').textContent='3';
  tone(480,.12);
}
function togglePause(force) {
  if(!['playing','countdown','goal'].includes(phase))return;
  paused=typeof force==='boolean'?force:!paused;
  clock.getDelta(); // Discard elapsed time while focus/visibility changes.
  Input.resetInput();$('pause-screen').style.display=paused?'flex':'none';if(!paused)canvas.focus();
}
$('pause-btn').addEventListener('click',()=>togglePause());
$('resume-btn').addEventListener('click',()=>togglePause(false));
addEventListener('blur',()=>togglePause(true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)togglePause(true);});

function startGame(selectedMode) {
  paused=false;$('pause-screen').style.display='none';$('pause-btn').classList.remove('hidden');$('hint').classList.remove('hidden');
  canvas.focus(); mode = selectedMode; scorePlayer = 0; scoreAI = 0; timeLeft = SOLO_SECONDS;
  $('menu').style.display = 'none'; $('endscreen').style.display = 'none';
  $('hud').classList.remove('hidden'); $('energy').classList.remove('hidden');
  if (matchMedia('(pointer: coarse)').matches) $('touch-controls').classList.remove('hidden');
  $('rival-score').style.display = mode === 'solo' ? 'none' : '';
  $('player-label').textContent = mode === 'solo' ? 'Rings' : 'Tikal';
  $('center-label').textContent = mode === 'solo' ? 'Time' : 'First to';
  if (aiChar) aiChar.visible = mode === 'versus';
  updateHUD(); resetPositions(); beginCountdown();
}

document.querySelectorAll('.mode-btn').forEach((button) => button.addEventListener('click', () => startGame(button.dataset.mode)));
$('restart-btn').addEventListener('click', () => startGame(mode));
$('menu-btn').addEventListener('click', () => {
  phase = 'menu'; mode = null; Input.resetInput();
  $('endscreen').style.display = 'none'; $('menu').style.display = 'flex';
  $('hud').classList.add('hidden'); $('energy').classList.add('hidden'); $('touch-controls').classList.add('hidden');
  if (aiChar) aiChar.visible = true;
});

function applyHit(fromPosition, angle, owner) {
  ballState.vel.copy(shotVelocity(ballState.pos,angle,ringWorldPos));
  ballState.heldCooldown=.2;lastTouch=owner;
  burst(ballState.pos, owner === 'player' ? 0xffb12b : 0xe6363e, 18); shake = .24;
  tone(owner === 'player' ? 150 : 115, .18, 'sawtooth', .08);
  callout(owner === 'player' ? 'KINETIC STRIKE!' : 'RIVAL STRIKE', owner);
}

function tryPlayerHit() {
  if (paused || phase !== 'playing' || !playerChar || playerHitCooldown > 0 || ballState.heldCooldown > 0) return;
  if (ballState.pos.distanceTo(playerChar.position.clone().setY(1.05)) > HIT_RANGE) { callout('GET CLOSER', 'muted'); tone(90,.08,'square',.025); return; }
  currentAimAngle=Input.mouseAimAngle;playerChar.rotation.y=currentAimAngle;
  applyHit(playerChar.position,currentAimAngle,'player');playerHitCooldown=.45;playerSwingTimer=.45;
}
setupInput(canvas, camera, () => playerChar?.position, tryPlayerHit);
$('hint').textContent=matchMedia('(pointer: coarse)').matches?'Left stick: move · Drag court: aim · Strike near ball':'WASD: move · Mouse: aim · Space: hip strike';

function registerScore() {
  if(phase!=='playing'||paused)return;
  const playerScored = mode === 'solo' || lastTouch === 'player';
  if (playerScored) scorePlayer += 1; else scoreAI += 1;
  updateHUD(); burst(ringWorldPos, 0xffd34e, 44);
  tone(520,.18,'triangle',.09); setTimeout(() => tone(760,.34,'triangle',.07), 110);
  callout(playerScored ? 'SUN RING!' : 'RIVAL SCORES', playerScored ? 'score' : 'rival');
  phase = 'goal';
  goalTime=.85;
}

function finishGame() {
  Input.resetInput();$('pause-btn').classList.add('hidden');$('hint').classList.add('hidden');$('touch-controls').classList.add('hidden');
  phase = 'ended'; $('endscreen').style.display = 'flex';
  if (mode === 'solo') {
    $('end-mode').textContent = 'SOLO TRIAL COMPLETE'; $('end-title').textContent = `${scorePlayer} RINGS`;
    $('end-sub').textContent = scorePlayer ? 'Your name is carved into the sun-stone.' : 'The sacred ring awaits your return.';
  } else {
    const won = scorePlayer > scoreAI;
    $('end-mode').textContent = 'THE MATCH IS DECIDED'; $('end-title').textContent = won ? 'TIKAL VICTORY' : 'RIVAL VICTORY';
    $('end-sub').textContent = `${scorePlayer} — ${scoreAI}`;
  }
}

function updatePlayer(dt) {
  if (!playerChar || phase !== 'playing') return;
  const { mx, mz, moving } = getMoveVector();
  const previous=playerChar.position.clone();
  if (moving) {
    playerChar.position.x = THREE.MathUtils.clamp(playerChar.position.x + mx * PLAYER_SPEED * dt, -COURT_WIDTH / 2 + .75, COURT_WIDTH / 2 - .75);
    playerChar.position.z = THREE.MathUtils.clamp(playerChar.position.z + mz * PLAYER_SPEED * dt, -COURT_LENGTH / 2 + 1, COURT_LENGTH / 2 - 1);
    const target=Math.atan2(mx,mz),turn=Math.atan2(Math.sin(target-playerChar.rotation.y),Math.cos(target-playerChar.rotation.y));
    if(playerSwingTimer<=0)playerChar.rotation.y+=turn*(1-Math.exp(-14*dt));
  }
  playerMoveSpeed=playerChar.position.distanceTo(previous)/dt;
  playerHitCooldown = Math.max(0, playerHitCooldown - dt);
}

function updateAI(dt) {
  if (!aiChar || mode !== 'versus' || phase !== 'playing') return;
  const previous=aiChar.position.clone();
  aiHitCooldown = Math.max(0, aiHitCooldown - dt);
  const toBall = new THREE.Vector3(ballState.pos.x, 0, ballState.pos.z).sub(aiChar.position);
  const distance = toBall.length();
  if (distance > HIT_RANGE * .82) {
    toBall.normalize();
    aiChar.position.x = THREE.MathUtils.clamp(aiChar.position.x + toBall.x * AI_SPEED * dt, -COURT_WIDTH / 2 + .75, COURT_WIDTH / 2 - .75);
    aiChar.position.z = THREE.MathUtils.clamp(aiChar.position.z + toBall.z * AI_SPEED * dt, -COURT_LENGTH / 2 + 1, COURT_LENGTH / 2 - 1);
    aiChar.rotation.y = Math.atan2(toBall.x, toBall.z);
  } else if (aiHitCooldown <= 0 && ballState.heldCooldown <= 0 && ballState.pos.distanceTo(aiChar.position.clone().setY(1.05)) < HIT_RANGE) {
    const angle = Math.atan2(ringWorldPos.x - aiChar.position.x, ringWorldPos.z - aiChar.position.z) + (Math.random() - .5) * .38;
    applyHit(aiChar.position, angle, 'ai', .96); aiHitCooldown = .8 + Math.random() * .45; aiSwingTimer = .45;
  }
  aiMoveSpeed=aiChar.position.distanceTo(previous)/dt;
}

const desiredCamera = new THREE.Vector3(); const cameraTarget = new THREE.Vector3();
const clock = new THREE.Clock(); let elapsed = 0;
function updateCamera(dt) {
  if (!playerChar) return;
  cameraTarget.copy(playerChar.position).lerp(ballState.pos,.28);cameraTarget.y=1.5;
  const portrait=innerHeight>innerWidth;
  desiredCamera.set(playerChar.position.x*.4,portrait?8.8:6.8,Math.min(COURT_LENGTH/2-1,playerChar.position.z+(portrait?12:10)));
  if (shake > 0) { desiredCamera.x += (Math.random()-.5)*shake; desiredCamera.y += (Math.random()-.5)*shake; shake = Math.max(0, shake-dt*1.8); }
  camera.position.lerp(desiredCamera, 1 - Math.pow(.002, dt)); camera.lookAt(cameraTarget);
}

function tick() {
  requestAnimationFrame(tick);
  const rawDelta=clock.getDelta();
  const frameDt=Math.min(rawDelta,.1),dt=paused?0:frameDt,wallDt=paused?0:rawDelta;
  elapsed+=dt;
  if(phase==='countdown'&&!paused) {
    countdownTime-=wallDt;
    $('countdown-value').textContent=countdownTime>.5?Math.ceil(countdownTime):'PLAY';
    if(countdownTime<=0){$('countdown').style.display='none';phase='playing';}
  }
  if(phase==='goal'&&!paused) {
    goalTime-=wallDt;
    if(goalTime<=0) {
      if(mode==='versus'&&Math.max(scorePlayer,scoreAI)>=TARGET_SCORE)finishGame();
      else{resetPositions();phase='playing';}
    }
  }
  if(phase==='playing'&&!paused) {
    if(mode==='solo'){timeLeft=Math.max(0,timeLeft-wallDt);if(timeLeft===0)finishGame();}
    if(phase==='playing'){
      updatePlayer(dt);updateAI(dt);
      if(ballState.update(dt,ringWorldPos))registerScore();
    }
  }
  ballMesh.position.copy(ballState.pos); updateBallVisual(ballMesh, ballState.vel, dt);
  updateCourt(arena, elapsed); updateParticles(dt); updateHUD();
  if (playerChar) {
    currentAimAngle = Input.mouseAimAngle;
    aimGroup.position.set(playerChar.position.x, .035, playerChar.position.z); aimGroup.rotation.y = currentAimAngle;
    aimRing.material.opacity = .5 + Math.sin(elapsed * 5) * .18;
  }
  updateCamera(dt);
  playerSwingTimer = Math.max(0, playerSwingTimer - dt); aiSwingTimer = Math.max(0, aiSwingTimer - dt);
  animateCharacter(playerRig,phase==='playing'?playerMoveSpeed:0,playerSwingTimer,dt,elapsed);
  animateCharacter(aiRig,mode==='versus'&&phase==='playing'?aiMoveSpeed:0,aiSwingTimer,dt,elapsed);

  renderer.render(scene, camera);
}
tick();
