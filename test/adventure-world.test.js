import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAdventureWorld, ADVENTURE_WORLD_SIZE } from '../src/adventure-world.js';

test('jungle prototype creates a bounded world with deterministic resource placement', () => {
  const a = createAdventureWorld(new THREE.Scene(), 77);
  const b = createAdventureWorld(new THREE.Scene(), 77);
  assert.equal(a.resources.length, b.resources.length);
  assert.ok(a.resources.length >= 24);
  for (let i = 0; i < a.resources.length; i += 1) {
    assert.equal(a.resources[i].type.id, b.resources[i].type.id);
    assert.deepEqual(a.resources[i].mesh.position.toArray(), b.resources[i].mesh.position.toArray());
  }
  assert.equal(ADVENTURE_WORLD_SIZE, 120);
  a.dispose(); b.dispose();
});

test('nearby resources can be harvested once', () => {
  const world = createAdventureWorld(new THREE.Scene(), 123);
  const target = world.resources[0], position = target.mesh.position.clone();
  assert.equal(world.harvest(position), target.type.id);
  assert.equal(target.collected, true);
  assert.equal(world.harvest(position), null);
  world.dispose();
});


test('terrain height stays finite and the river corridor is lower than the ruin ridge', () => {
  const world = createAdventureWorld(new THREE.Scene(), 9);
  assert.ok(Number.isFinite(world.heightAt(0, 0)));
  assert.ok(world.heightAt(-25, -30) > world.heightAt(25, 0));
  assert.ok(world.root.children[0].geometry.attributes.position.count > 4000);
  assert.ok(world.resources.length >= 24);
  world.dispose();
});


test('river blocks walking except at the stone crossing', () => {
  const world = createAdventureWorld(new THREE.Scene(), 12);
  assert.equal(world.canMoveTo(25, 8), false);
  assert.equal(world.canMoveTo(25, 0), true);
  assert.equal(world.canMoveTo(0, 0), true);
  world.dispose();
});
