import * as THREE from 'three';
import { createCourt, addLighting, COURT_WIDTH, COURT_LENGTH } from './court.js';
import { loadCharacters, animateCharacter } from './characters.js';
import { createBall, BallState } from './ball.js';
import { setupInput, isMoveKeyDown, getMoveVector } from './input.js';
import * as Input from './input.js';

const $ = (id) => document.getElementById(id);
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && c.getContext('webgl')); } catch { return false; }
}
if (!hasWebGL()) { $('webgl-error').style.display = 'flex'; throw new Error('WebGL unavailable'); }

const canvas = $('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 800 ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1006);
scene.fog = new THREE.Fog(0x1a1006, 30, 90);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

addLighting(scene);
const { ringMesh, ringWorldPos } = createCourt(scene);
const ballMesh = createBall(scene);
const ballState = new BallState();
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => { $('loadbar').style.width = `${Math.round(loaded / total * 100)}%`; };
manager.onLoad = () => { $('loading').style.display = 'none'; };

let playerChar = null, aiChar = null, playerBones = {}, aiBones = {};
const STRIKER_MODEL = 'https://raw.githubusercontent.com/badbuny126-png/-poca-tok-2026/main/public/models/player.glb';
loadCharacters(scene, manager, STRIKER_MODEL).then((result) => {
  ({ playerChar, aiChar, playerBones, aiBones } = result);
  aiChar.visible = mode !== 'solo';
}).catch(() => {
  $('loading').innerHTML = '<div>CHARACTER COULD NOT LOAD</div><small>Refresh to try again.</small>';
});

const aimIndicator = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xe8a33d, emissive: 0x552200, emissiveIntensity: 0.5 }));
aimIndicator.rotation.x = Math.PI / 2;
scene.add(aimIndicator);

const TARGET_SCORE = 3;
const SOLO_SECONDS = 60;
const HIT_RANGE = 1.7;
const PLAYER_SPEED = 6.5;
const AI_SPEED = 4.2;
let mode = null, phase = 'menu', scorePlayer = 0, scoreAI = 0, timeLeft = SOLO_SECONDS;
let playerHitCooldown = 0, aiHitCooldown = 0, playerSwingTimer = 0, aiSwingTimer = 0;
let lastTouch = 'player', currentAimAngle = 0, countdownToken = 0;

function resetPositions() {
  ballState.reset();
  if (playerChar) playerChar.position.set(-3, 0, -8);
  if (aiChar) aiChar.position.set(3, 0, 8);
}

function updateHUD() {
  $('score-player').textContent = scorePlayer;
  $('score-ai').textContent = scoreAI;
  $('center-value').textContent = mode === 'solo' ? Math.max(0, Math.ceil(timeLeft)) : TARGET_SCORE;
}

function beginCountdown() {
  const token = ++countdownToken;
  phase = 'countdown';
  $('countdown').style.display = 'flex';
  let number = 3;
  $('countdown-value').textContent = number;
  const step = () => {
    if (token !== countdownToken) return;
    number -= 1;
    if (number > 0) { $('countdown-value').textContent = number; setTimeout(step, 700); }
    else if (number === 0) { $('countdown-value').textContent = 'PLAY'; setTimeout(step, 600); }
    else { $('countdown').style.display = 'none'; phase = 'playing'; }
  };
  setTimeout(step, 700);
}

function startGame(selectedMode) {
  mode = selectedMode;
  scorePlayer = 0; scoreAI = 0; timeLeft = SOLO_SECONDS;
  $('menu').style.display = 'none'; $('endscreen').style.display = 'none';
  $('hud').classList.remove('hidden'); $('hint').classList.remove('hidden');
  if (matchMedia('(pointer: coarse)').matches) $('touch-controls').classList.remove('hidden');
  $('rival-score').style.display = mode === 'solo' ? 'none' : '';
  $('player-label').textContent = mode === 'solo' ? 'Rings' : 'You';
  $('center-label').textContent = mode === 'solo' ? 'Time' : 'First to';
  if (aiChar) aiChar.visible = mode === 'versus';
  updateHUD(); resetPositions(); beginCountdown();
}

document.querySelectorAll('.mode-btn').forEach((button) => button.addEventListener('click', () => startGame(button.dataset.mode)));
$('restart-btn').addEventListener('click', () => startGame(mode));
$('menu-btn').addEventListener('click', () => {
  ++countdownToken; phase = 'menu'; mode = null;
  $('endscreen').style.display = 'none'; $('menu').style.display = 'flex'; $('hud').classList.add('hidden');
  $('hint').classList.add('hidden'); $('touch-controls').classList.add('hidden');
  if (aiChar) aiChar.visible = true;
});

function applyHit(fromPos, angle, owner) {
  const aimed = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  const towardRing = new THREE.Vector3().subVectors(ringWorldPos, fromPos).normalize();
  const direction = aimed.multiplyScalar(0.68).add(towardRing.multiplyScalar(0.32)).normalize();
  ballState.vel.set(direction.x * 7.8, 7.2 + Math.random() * 2.5, direction.z * 7.8);
  ballState.heldCooldown = 0.3;
  lastTouch = owner;
}

function tryPlayerHit() {
  if (phase !== 'playing' || !playerChar || playerHitCooldown > 0 || ballState.pos.distanceTo(playerChar.position) > HIT_RANGE) return;
  applyHit(playerChar.position, currentAimAngle, 'player'); playerHitCooldown = 0.45; playerSwingTimer = 0.3;
}
setupInput(canvas, camera, () => playerChar?.position, tryPlayerHit);

function registerScore() {
  if (mode === 'solo' || lastTouch === 'player') scorePlayer += 1; else scoreAI += 1;
  updateHUD(); ballState.heldCooldown = 1.5; ballState.reset();
  if (mode === 'versus' && (scorePlayer >= TARGET_SCORE || scoreAI >= TARGET_SCORE)) finishGame();
}

function finishGame() {
  phase = 'ended';
  $('endscreen').style.display = 'flex';
  if (mode === 'solo') {
    $('end-mode').textContent = 'SOLO CHALLENGE COMPLETE'; $('end-title').textContent = `${scorePlayer} RINGS`;
    $('end-sub').textContent = scorePlayer ? 'Your name is carved into the sun-stone.' : 'The ring awaits your next challenge.';
  } else {
    const won = scorePlayer > scoreAI;
    $('end-mode').textContent = '1V1 MATCH COMPLETE'; $('end-title').textContent = won ? 'VICTORY' : 'THE RIVAL WINS';
    $('end-sub').textContent = `${scorePlayer} — ${scoreAI}`;
  }
}

function updatePlayer(dt) {
  if (!playerChar || phase !== 'playing') return;
  const { mx, mz, moving } = getMoveVector();
  if (moving) {
    playerChar.position.x = THREE.MathUtils.clamp(playerChar.position.x + mx * PLAYER_SPEED * dt, -COURT_WIDTH / 2 + 1.2, COURT_WIDTH / 2 - 1.2);
    playerChar.position.z = THREE.MathUtils.clamp(playerChar.position.z + mz * PLAYER_SPEED * dt, -COURT_LENGTH / 2 + 1.5, COURT_LENGTH / 2 - 1.5);
    playerChar.rotation.y = THREE.MathUtils.lerp(playerChar.rotation.y, Math.atan2(mx, mz), 0.25);
  }
  playerHitCooldown = Math.max(0, playerHitCooldown - dt);
}

function updateAI(dt) {
  if (!aiChar || mode !== 'versus' || phase !== 'playing') return;
  aiHitCooldown = Math.max(0, aiHitCooldown - dt);
  const toBall = new THREE.Vector3().subVectors(ballState.pos, aiChar.position); toBall.y = 0;
  if (toBall.length() > HIT_RANGE * 0.9) {
    toBall.normalize();
    aiChar.position.x = THREE.MathUtils.clamp(aiChar.position.x + toBall.x * AI_SPEED * dt, -COURT_WIDTH / 2 + 1.2, COURT_WIDTH / 2 - 1.2);
    aiChar.position.z = THREE.MathUtils.clamp(aiChar.position.z + toBall.z * AI_SPEED * dt, -COURT_LENGTH / 2 + 1.5, COURT_LENGTH / 2 - 1.5);
    aiChar.rotation.y = Math.atan2(toBall.x, toBall.z);
  } else if (aiHitCooldown <= 0 && ballState.pos.y < 3.2) {
    const angle = Math.atan2(ringWorldPos.x - aiChar.position.x, ringWorldPos.z - aiChar.position.z) + (Math.random() - 0.5) * 0.45;
    applyHit(aiChar.position, angle, 'ai'); aiHitCooldown = 0.8 + Math.random() * 0.5; aiSwingTimer = 0.3;
  }
}

const camOffset = new THREE.Vector3(0, 7, 11);
const clock = new THREE.Clock();
let animTime = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05); animTime += dt;
  if (phase === 'playing') {
    if (mode === 'solo') { timeLeft -= dt; updateHUD(); if (timeLeft <= 0) finishGame(); }
    updatePlayer(dt); updateAI(dt);
    if (ballState.update(dt, ringWorldPos)) registerScore();
  }
  ballMesh.position.copy(ballState.pos);
  if (playerChar) {
    currentAimAngle = Input.mouseAimAngle;
    aimIndicator.position.set(playerChar.position.x + Math.sin(currentAimAngle) * 1.3, 1.1, playerChar.position.z + Math.cos(currentAimAngle) * 1.3);
    aimIndicator.rotation.y = currentAimAngle;
    camera.position.lerp(new THREE.Vector3().copy(playerChar.position).add(camOffset), 1 - Math.pow(0.001, dt));
    camera.lookAt(new THREE.Vector3(playerChar.position.x, 1.4, playerChar.position.z));
  }
  playerSwingTimer = Math.max(0, playerSwingTimer - dt); aiSwingTimer = Math.max(0, aiSwingTimer - dt);
  animateCharacter(playerBones, isMoveKeyDown(), playerSwingTimer, dt, animTime);
  animateCharacter(aiBones, mode === 'versus', aiSwingTimer, dt, animTime);
  ringMesh.rotation.z += dt * 0.2;
  renderer.render(scene, camera);
}
tick();
