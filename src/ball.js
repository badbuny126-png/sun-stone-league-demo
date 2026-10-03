import * as THREE from 'three';
import { COURT_WIDTH, COURT_LENGTH, RING_RADIUS, RING_TUBE } from './court.js';
import { createRNG } from './rng.js';

export const BALL_RADIUS = .43;
export const GRAVITY = -17;
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
  constructor(rng=createRNG(1)) {
    this.rng=rng;
    this.ringRadius=RING_RADIUS;this.ringTube=RING_TUBE;this.obstacles=[];
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heldCooldown = 0;
    this.previousX = 0;
    this.justBounced = false;
    this.reset();
  }

  reset() {
    this.pos.set(0, BALL_RADIUS + .35, 0);
    this.vel.set((this.rng() - .5) * 1.4, 1.6, (this.rng() - .5) * 1.4);
    this.events=[];this.airborne=true;
    this.previousX = this.pos.x;
    this.justBounced = false;
    this.heldCooldown=0; this.pendingPass=0; this.scored=false;
  }

  update(dt,ring) {
    this.events=[];
    if(this.scored)return false;
    const steps=Math.max(1,Math.ceil(dt/(1/120)));
    for(let i=0;i<steps;i++)if(this.step(dt/steps,ring))return true;
    return false;
  }
  step(dt,ring) {
    const previous=this.pos.clone();
    this.justBounced=false;
    this.pos.addScaledVector(this.vel,dt);
    this.pos.y+=.5*GRAVITY*dt*dt;this.vel.y+=GRAVITY*dt;
    if(this.pos.y>BALL_RADIUS+.01)this.airborne=true;
    this.heldCooldown=Math.max(0,this.heldCooldown-dt);
    if(this.pos.y<BALL_RADIUS) {
      this.pos.y=BALL_RADIUS;
      if(this.vel.y<0) {
        if(this.airborne && this.vel.y<-.25)this.events.push({kind:'floor'});
        this.airborne=false;
        this.justBounced=this.vel.y < -2.2;
        this.vel.y=Math.abs(this.vel.y)>.8?-this.vel.y*RESTITUTION:0;
      }
      const drag=Math.exp(-2.5*dt);this.vel.x*=drag;this.vel.z*=drag;
    }
    const radial=new THREE.Vector3(0,this.pos.y-ring.y,this.pos.z-ring.z);
    const radius=radial.length();
    // At the exact centre every point on the torus centreline is equally near.
    // Clamping the divisor would incorrectly create a solid obstacle in the hole.
    const closest=radius<1e-8
      ? new THREE.Vector3(0,this.ringRadius,0).add(ring)
      : radial.multiplyScalar(this.ringRadius/radius).add(ring);
    const normal=this.pos.clone().sub(closest),separation=normal.length();
    if(separation<BALL_RADIUS+this.ringTube) {
      if(separation<1e-8)normal.set(Math.sign(previous.x-ring.x)||-1,0,0);
      else normal.multiplyScalar(1/separation);
      this.pos.copy(closest).addScaledVector(normal,BALL_RADIUS+this.ringTube+.001);
      const speed=this.vel.dot(normal);
      if(speed<0){this.vel.addScaledVector(normal,-(1+RESTITUTION)*speed);this.events.push({kind:'rim'});}
      this.pendingPass=0;
    } else {
      const dx=this.pos.x-previous.x;
      if(dx && (previous.x-ring.x)*(this.pos.x-ring.x)<=0) {
        const t=(ring.x-previous.x)/dx;
        const y=THREE.MathUtils.lerp(previous.y,this.pos.y,t),z=THREE.MathUtils.lerp(previous.z,this.pos.z,t);
        if(Math.hypot(y-ring.y,z-ring.z)<this.ringRadius-this.ringTube-BALL_RADIUS)this.pendingPass=Math.sign(dx);
      }
      if(this.pendingPass && (this.pos.x-ring.x)*this.pendingPass>BALL_RADIUS+this.ringTube) {
        this.scored=true;this.events.push({kind:'ring'});return true;
      }
      if(this.pendingPass && this.vel.x*this.pendingPass<=0)this.pendingPass=0;
    }
    for(const [axis,half] of [['x',COURT_WIDTH/2-BALL_RADIUS],['z',COURT_LENGTH/2-BALL_RADIUS]]) {
      if(axis==='z' && Math.abs(previous.z)<14.7 && Math.abs(this.pos.z)>=14.7)this.events.push({kind:'zone',end:this.pos.z>0?'rival':'sun'});
      if(Math.abs(this.pos[axis])>half) {
        this.pos[axis]=Math.sign(this.pos[axis])*half;this.vel[axis]*=-RESTITUTION;
        this.justBounced=true;this.pendingPass=0;
        this.events.push({kind:'wall',surface:axis+Math.sign(this.pos[axis])});
      }
    }
    for(const obstacle of this.obstacles) {
      if(this.pos.y>obstacle.height+BALL_RADIUS)continue;
      const outward=new THREE.Vector3(this.pos.x-obstacle.x,0,this.pos.z-obstacle.z),distance=outward.length(),limit=obstacle.radius+BALL_RADIUS;
      if(distance>=limit)continue;
      if(distance<.0001)outward.set(1,0,0);else outward.divideScalar(distance);
      this.pos.x=obstacle.x+outward.x*(limit+.001);this.pos.z=obstacle.z+outward.z*(limit+.001);
      const incoming=this.vel.dot(outward);if(incoming<0){this.vel.addScaledVector(outward,-incoming*(1+RESTITUTION));this.events.push({kind:'wall',surface:'obstacle-'+obstacle.id});}
    }
    return false;
  }
}
