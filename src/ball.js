import * as THREE from 'three';
import { COURT_WIDTH, COURT_LENGTH, RING_RADIUS } from './court.js';

export const BALL_RADIUS = .43;
const GRAVITY = -17;
const RESTITUTION = .67;

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64,64,4,64,64,62);
  g.addColorStop(0,'rgba(255,245,190,1)');
  g.addColorStop(.22,'rgba(255,174,38,.85)');
  g.addColorStop(1,'rgba(255,105,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(canvas);
}

export function createBall(scene) {
  const group = new THREE.Group();
  const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x31221b, roughness: .58, metalness: .18, emissive: 0xff6500, emissiveIntensity: .08 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_RADIUS, 3), coreMaterial);
  core.castShadow = true;
  group.add(core);
  const bands = new THREE.Mesh(new THREE.TorusGeometry(BALL_RADIUS * .82, .035, 7, 30), new THREE.MeshBasicMaterial({ color: 0xf6a52a }));
  bands.rotation.x = Math.PI / 2; group.add(bands);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff9b20, transparent: true, opacity: .18, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(2.2,2.2,1); group.add(glow);
  const light = new THREE.PointLight(0xff7b19, 0, 7, 2); group.add(light);

  const trailPositions = new Float32Array(24 * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0xffb12e, transparent: true, opacity: .62, blending: THREE.AdditiveBlending }));
  trail.frustumCulled = false;
  scene.add(trail);
  group.userData = { core, glow, light, trail, trailPositions, history: [] };
  scene.add(group);
  return group;
}

export function updateBallVisual(ball, velocity, dt) {
  const speed = velocity.length();
  const energy = THREE.MathUtils.smoothstep(speed, 3, 15);
  ball.userData.core.rotation.x += velocity.z * dt * 1.5;
  ball.userData.core.rotation.z -= velocity.x * dt * 1.5;
  ball.userData.core.material.emissiveIntensity = .08 + energy * 1.35;
  ball.userData.glow.material.opacity = .12 + energy * .6;
  ball.userData.glow.scale.setScalar(1.5 + energy * 2.1);
  ball.userData.light.intensity = energy * 22;
  const history = ball.userData.history;
  if (speed > 4) history.unshift(ball.position.clone()); else history.unshift(null);
  if (history.length > 24) history.pop();
  const points = ball.userData.trailPositions;
  let last = ball.position;
  for (let i = 0; i < 24; i += 1) {
    const point = history[i] || last;
    points[i*3] = point.x; points[i*3+1] = point.y; points[i*3+2] = point.z;
    last = point;
  }
  ball.userData.trail.geometry.attributes.position.needsUpdate = true;
  ball.userData.trail.material.opacity = energy * .72;
}

export class BallState {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heldCooldown = 0;
    this.previousX = 0;
    this.justBounced = false;
    this.reset();
  }

  reset() {
    this.pos.set(0, BALL_RADIUS + .35, 0);
    this.vel.set((Math.random() - .5) * 1.4, 1.6, (Math.random() - .5) * 1.4);
    this.previousX = this.pos.x;
    this.justBounced = false;
  }

  update(dt, ringWorldPos) {
    this.previousX = this.pos.x;
    this.justBounced = false;
    this.vel.y += GRAVITY * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.heldCooldown = Math.max(0, this.heldCooldown - dt);

    if (this.pos.y < BALL_RADIUS) {
      this.pos.y = BALL_RADIUS;
      if (this.vel.y < 0) {
        this.vel.y *= -RESTITUTION;
        this.vel.x *= .88; this.vel.z *= .88;
        this.justBounced = Math.abs(this.vel.y) > 2.2;
        if (Math.abs(this.vel.y) < .65) this.vel.y = 0;
      }
    }
    const halfW = COURT_WIDTH / 2 - BALL_RADIUS;
    if (this.pos.x > halfW) { this.pos.x = halfW; this.vel.x *= -RESTITUTION; this.justBounced = true; }
    if (this.pos.x < -halfW) { this.pos.x = -halfW; this.vel.x *= -RESTITUTION; this.justBounced = true; }
    const halfL = COURT_LENGTH / 2 - BALL_RADIUS;
    if (this.pos.z > halfL) { this.pos.z = halfL; this.vel.z *= -RESTITUTION; this.justBounced = true; }
    if (this.pos.z < -halfL) { this.pos.z = -halfL; this.vel.z *= -RESTITUTION; this.justBounced = true; }

    const crossed = (this.previousX < ringWorldPos.x && this.pos.x >= ringWorldPos.x) || (this.previousX > ringWorldPos.x && this.pos.x <= ringWorldPos.x);
    const apertureDistance = Math.hypot(this.pos.y - ringWorldPos.y, this.pos.z - ringWorldPos.z);
    return crossed && apertureDistance < RING_RADIUS - BALL_RADIUS * .55 && this.heldCooldown <= 0;
  }
}
