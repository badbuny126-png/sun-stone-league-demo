import * as THREE from 'three';
import { COURT_WIDTH, COURT_LENGTH, RING_HEIGHT, RING_RADIUS } from './court.js';

export const BALL_RADIUS = 0.35;
const GRAVITY = -18;
const RESTITUTION = 0.62;

export function createBall(scene) {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.1 })
  );
  ball.castShadow = true;
  scene.add(ball);
  return ball;
}

export class BallState {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heldCooldown = 0;
    this.reset();
  }

  reset() {
    this.pos.set(0, BALL_RADIUS + 0.6, 0);
    this.vel.set((Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2);
  }

  /**
   * Steps physics, applies bounces, and returns true if the ball scored
   * through the ring this frame.
   */
  update(dt, ringWorldPos) {
    this.vel.y += GRAVITY * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.heldCooldown = Math.max(0, this.heldCooldown - dt);

    if (this.pos.y - BALL_RADIUS < 0) {
      this.pos.y = BALL_RADIUS;
      if (this.vel.y < 0) {
        this.vel.y *= -RESTITUTION;
        this.vel.x *= 0.85;
        this.vel.z *= 0.85;
        if (Math.abs(this.vel.y) < 0.6) this.vel.y = 0;
      }
    }

    const halfW = COURT_WIDTH / 2 - BALL_RADIUS;
    if (this.pos.x > halfW) { this.pos.x = halfW; this.vel.x *= -RESTITUTION; }
    if (this.pos.x < -halfW) { this.pos.x = -halfW; this.vel.x *= -RESTITUTION; }

    const halfL = COURT_LENGTH / 2 - BALL_RADIUS;
    if (this.pos.z > halfL) { this.pos.z = halfL; this.vel.z *= -RESTITUTION; }
    if (this.pos.z < -halfL) { this.pos.z = -halfL; this.vel.z *= -RESTITUTION; }

    const withinHeight = Math.abs(this.pos.y - RING_HEIGHT) < RING_RADIUS - BALL_RADIUS * 0.5;
    const withinDepth = Math.abs(this.pos.z - ringWorldPos.z) < RING_RADIUS - BALL_RADIUS * 0.5;
    const crossingPlane = Math.abs(this.pos.x - ringWorldPos.x) < 0.25;

    if (withinHeight && withinDepth && crossingPlane && this.heldCooldown <= 0) {
      return true; // scored
    }
    return false;
  }
}
