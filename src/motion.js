import * as THREE from 'three';

export const STRIKE_DURATION = .55;
export const STRIKE_CONTACT = STRIKE_DURATION * .62;
const smooth = (v) => { const t = THREE.MathUtils.clamp(v, 0, 1); return t * t * (3 - 2 * t); };

export function strikePose(remaining) {
  if (remaining <= 0) return { windup: 0, drive: 0 };
  const progress = 1 - remaining / STRIKE_DURATION;
  return {
    windup: smooth(progress / .24) * (1 - smooth((progress - .24) / .16)),
    drive: smooth((progress - .24) / .16) * (1 - smooth((progress - .42) / .58)),
  };
}

export function footCycle(phase, stride, lift) {
  const cycle = ((phase % 1) + 1) % 1;
  // Stance covers 60% of the cycle. The foot travels backward at constant speed
  // while the actor moves forward; the return swing has a smooth landing arc.
  if (cycle < .6) return { z: stride * (.5 - cycle / .6), y: 0, planted: true };
  const swing = (cycle - .6) / .4;
  return { z: stride * (-.5 + smooth(swing)), y: Math.sin(Math.PI * swing) * lift, planted: false };
}

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const direction = new THREE.Vector3(), pole = new THREE.Vector3(), kneeGoal = new THREE.Vector3(), target = new THREE.Vector3();
const delta = new THREE.Quaternion(), parent = new THREE.Quaternion(), change = new THREE.Quaternion();
function aimBone(bone, child, goal) {
  a.setFromMatrixPosition(bone.matrixWorld);
  b.setFromMatrixPosition(child.matrixWorld).sub(a).normalize();
  c.copy(goal).sub(a).normalize();
  delta.setFromUnitVectors(b, c);
  bone.parent.getWorldQuaternion(parent);
  change.copy(parent).invert().multiply(delta).multiply(parent);
  bone.quaternion.premultiply(change);
  bone.updateMatrixWorld(true);
}

// Analytic two-bone IK uses measured limb lengths, so knees bend toward the
// character's forward direction instead of applying arbitrary Euler angles.
export function solveLeg(leg, goal, forward, rootQuaternion) {
  const { hip, knee, ankle, upper, lower } = leg;
  a.setFromMatrixPosition(hip.matrixWorld);
  direction.copy(goal).sub(a);
  const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(upper - lower) + .001, (upper + lower) * .999);
  direction.normalize();
  pole.copy(forward).addScaledVector(direction, -forward.dot(direction)).normalize();
  if (pole.lengthSq() < .01) pole.set(1, 0, 0).addScaledVector(direction,-direction.x).normalize();
  target.copy(a).addScaledVector(direction,distance);
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, upper * upper - along * along));
  kneeGoal.copy(a).addScaledVector(direction, along).addScaledVector(pole, bend);
  aimBone(hip, knee, kneeGoal);
  aimBone(knee, ankle, target);
  ankle.parent.getWorldQuaternion(parent);
  ankle.quaternion.copy(parent.invert()).multiply(rootQuaternion).multiply(leg.footRotation);
  ankle.updateMatrixWorld(true);
}
