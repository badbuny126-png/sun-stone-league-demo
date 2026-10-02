import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { BallState, BALL_RADIUS } from '../src/ball.js';
import { shotVelocity, predictShot } from '../src/shot.js';
import { spawnPair, spawnRoster, animateCharacter, TARGET_HEIGHT } from '../src/characters.js';
import { TEAM_ROSTER, getAITarget, getAISteering, scoringTeam, shouldAIAttemptHit } from '../src/teams.js';
import { alignArena, ARENA_LAYOUT } from '../src/arena-layout.js';
import { RING_HEIGHT, COURT_WIDTH } from '../src/court.js';
import { footCycle, strikePose, STRIKE_DURATION, STRIKE_CONTACT } from '../src/motion.js';
import { framePlay } from '../src/framing.js';
const ring=new THREE.Vector3(COURT_WIDTH/2-1.25,RING_HEIGHT,0);

test('support yields the ball lane and AI separation resolves overlapping fighters',()=>{
  const ball=new THREE.Vector3(),player=new THREE.Vector3(0,0,.5);
  assert.ok(getAITarget(TEAM_ROSTER[1],ball,player).distanceTo(ball)>2.4);
  const actors=[{id:'a',position:ball.clone()},{id:'b',position:ball.clone()}];
  const a=getAISteering(actors[0],ball,actors),b=getAISteering(actors[1],ball,actors);
  assert.ok(a.x*b.x<0,'coincident fighters choose opposite escape directions');
  for(const fps of [20,60]) {
    const bodies=[{id:'player',team:'sun',position:player.clone()},...TEAM_ROSTER.slice(1).map(f=>({...f,position:new THREE.Vector3(.1,0,0)}))];
    for(let frame=0;frame<fps*4;frame++) {
      const snapshot=bodies.map(b=>({...b,position:b.position.clone()}));
      for(const actor of bodies.slice(1)) {
        const target=getAITarget(actor,ball,player,snapshot),steer=getAISteering(actor,target,snapshot);
        assert.ok(steer.length()<=1.00001,'steering respects movement speed');
        actor.position.addScaledVector(steer,5/fps);
      }
    }
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)
      assert.ok(bodies[i].position.distanceTo(bodies[j].position)>.75,'fighters separate at '+fps+' fps');
  }
});

test('manual shot preview follows the same ball integrator and leaves the origin intact',()=>{
  const origin=new THREE.Vector3(0,.8,0),options={type:'knee',seconds:.6,velocity:new THREE.Vector3(1,0,0)};
  const points=predictShot(origin,Math.PI/2,ring,options);
  const simulated=new BallState(()=>.5);simulated.pos.copy(origin);simulated.vel.copy(shotVelocity(origin,Math.PI/2,ring,options));
  for(let i=1;i<points.length;i++){simulated.update(.05,ring);assert.ok(simulated.pos.distanceTo(points[i])<1e-8);}
  assert.deepEqual(origin.toArray(),[0,.8,0]);
  const miss=predictShot(new THREE.Vector3(0,.8,13),0,ring,{seconds:.75});
  assert.ok(miss.every(point=>point.y>=BALL_RADIUS && Math.abs(point.z)<=16-BALL_RADIUS+.00001));
  assert.ok(miss.at(-1).z>=14.7,'guide ends when the opponent back zone is crossed');
});

test('known ballistic ring shots score exactly once across frame rates',()=>{
  for(const fps of [20,30,60,120]) for(const x of [-4,0,3]){
    const b=new BallState();b.pos.set(x,BALL_RADIUS,0);
    const flight=.65;
    b.vel.set((ring.x-x)/flight,(ring.y-b.pos.y+8.5*flight*flight)/flight,0);
    let count=0;
    for(let i=0;i<fps*3;i++)count+=Number(b.update(1/fps,ring));
    assert.equal(count,1,'fps='+fps+', x='+x);
  }
});
test('rim overlap is rejected and reset clears all scoring state',()=>{
  const b=new BallState();b.pos.set(ring.x-.8,ring.y,.7);b.vel.set(10,0,0);
  let scored=false;for(let i=0;i<30;i++)scored=b.update(1/120,ring)||scored;
  assert.equal(scored,false);
  b.scored=true;b.heldCooldown=.3;b.pendingPass=1;b.reset();
  assert.equal(b.scored,false);assert.equal(b.heldCooldown,0);assert.equal(b.pendingPass,0);
});
test('2v2 roster has one human and three independent AI fighters split evenly by team',async()=>{
  const {fighters}=spawnRoster(new THREE.Scene(),await characterSource());
  assert.equal(fighters.length,4);
  assert.deepEqual(fighters.filter((fighter)=>fighter.team==='sun').map((fighter)=>fighter.id),['player','sun-support']);
  assert.deepEqual(fighters.filter((fighter)=>fighter.team==='rival').map((fighter)=>fighter.id),['rival-striker','rival-support']);
  assert.equal(fighters.filter((fighter)=>fighter.control==='human').length,1);
  assert.equal(fighters.filter((fighter)=>fighter.control==='ai').length,3);
  const firstBone=fighters[0].rig.rest.LeftArm.bone;
  for(const fighter of fighters.slice(1))assert.notEqual(fighter.rig.rest.LeftArm.bone,firstBone);
  assert.equal(TEAM_ROSTER.length,4);
});
test('AI support target stays reachable and scores follow the last striking team',()=>{
  const ball=new THREE.Vector3(0,0,0);
  const player=new THREE.Vector3(0,0,-6);
  const sunTarget=getAITarget(TEAM_ROSTER[1],ball,player);
  const rivalTarget=getAITarget(TEAM_ROSTER[3],ball,player);
  const rivalStrikerTarget=getAITarget(TEAM_ROSTER[2],ball,player);
  assert.ok(sunTarget.distanceTo(ball)<2.05);
  assert.ok(rivalTarget.distanceTo(ball)<2.05);
  assert.equal(rivalStrikerTarget.distanceTo(ball),0,'striker pursues the ball directly');
  for(const opponent of TEAM_ROSTER.filter((fighter)=>fighter.team==='rival'&&fighter.control==='ai')) {
    assert.equal(shouldAIAttemptHit(.9,0,0,2.05),true,opponent.id+' can strike when in range');
    assert.equal(shouldAIAttemptHit(.9,.2,0,2.05),false,opponent.id+' respects its hit cooldown');
  }
  assert.equal(scoringTeam('versus','sun'),'sun');
  assert.equal(scoringTeam('versus','rival'),'rival');
  assert.equal(scoringTeam('solo','rival'),'sun');
});
test('supplied arena inner court aligns with game coordinates',async()=>{
  const model=new OBJLoader().parse(await readFile('public/assets/arena/arena.obj','utf8'));
  alignArena(model);
  const {centerX,centerZ,floorY,scale}=ARENA_LAYOUT;
  assert.ok(new THREE.Vector3(centerX,floorY,centerZ).applyMatrix4(model.matrixWorld).length()<1e-6);
  const side=new THREE.Vector3(centerX,floorY,centerZ+7/scale).applyMatrix4(model.matrixWorld);
  assert.ok(Math.abs(side.x-7)<1e-6);
});
async function characterSource(){
  // Use the real mesh/skeleton; omit image decoding only for the Node test.
  const bytes=await readFile('public/assets/characters/player.glb');
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString());
  delete json.materials;delete json.textures;delete json.images;
  for(const mesh of json.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  const offset=20+length,size=bytes.readUInt32LE(offset);
  json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(offset+8,offset+8+size).toString('base64');
  globalThis.ProgressEvent ||= class ProgressEvent {constructor(type,init={}){Object.assign(this,{type},init);}};
  return (await new GLTFLoader().parseAsync(JSON.stringify(json),'')).scene;
}
test('real characters are equally scaled, animate independently, stay grounded and recover from strikes',async()=>{
  const pair=spawnPair(new THREE.Scene(),await characterSource());
  assert.equal(pair.playerBones.procedural,false);assert.equal(pair.aiBones.procedural,false);
  const heights=[];
  for(const root of [pair.playerChar,pair.aiChar]){
    root.position.set(0,0,0);root.updateMatrixWorld(true);
    const height=new THREE.Box3().setFromObject(root,true).getSize(new THREE.Vector3()).y;
    assert.ok(Math.abs(height-TARGET_HEIGHT)<.12,'height '+height);heights.push(height);
  }
  assert.ok(Math.abs(heights[0]-heights[1])<1e-5);
  const rig=pair.playerBones,rival=pair.aiBones.rest.LeftUpLeg.bone.quaternion.clone();
  let sunMesh,rivalMesh;
  pair.playerChar.traverse(o=>{if(o.isSkinnedMesh)sunMesh=o;});
  pair.aiChar.traverse(o=>{if(o.isSkinnedMesh)rivalMesh=o;});
  assert.equal(sunMesh.material.vertexColors,true);
  assert.notDeepEqual(sunMesh.geometry.attributes.color.array,rivalMesh.geometry.attributes.color.array,'team outfits use different pigments');
  animateCharacter(rig,7.2,0,1/60,1);
  assert.ok(rig.rest.LeftUpLeg.bone.quaternion.angleTo(rig.rest.LeftUpLeg.quaternion)>.001);
  assert.ok(pair.aiBones.rest.LeftUpLeg.bone.quaternion.angleTo(rival)<1e-6);
  for(let i=0;i<120;i++)animateCharacter(rig,7.2,0,1/60,i/60);
  rig.root.updateMatrixWorld(true);
  const low=Math.min(...rig.feet.map(b=>b.getWorldPosition(new THREE.Vector3()).y));
  assert.ok(Math.abs(low-rig.footHeight)<.01);
  animateCharacter(rig,0,.225,1/60,2);
  assert.ok(rig.rest.Hips.bone.quaternion.angleTo(rig.rest.Hips.quaternion)>.2);
  for(let i=0;i<120;i++)animateCharacter(rig,0,0,1/60,2+i/60);
  assert.ok(rig.rest.Hips.bone.quaternion.angleTo(rig.rest.Hips.quaternion)<.01);
  for(const heading of [0,Math.PI/2,Math.PI]) {
    rig.root.rotation.y=heading;
    for(let i=0;i<60;i++) {
      animateCharacter(rig,4,0,1/60,i/60);rig.root.updateMatrixWorld(true);
      for(let side=0;side<rig.legs.length;side++) {
        const leg=rig.legs[side],cycle=footCycle(rig.gait+side*.5,1,1);
        if(cycle.planted)assert.ok(Math.abs(leg.ankle.getWorldPosition(new THREE.Vector3()).y-leg.origin.y)<.035,'stance foot stays grounded at heading '+heading);
      }
    }
  }
  animateCharacter(rig,4,.35,1/60,3);
  assert.ok(rig.rest.RightHand.bone.quaternion.angleTo(rig.rest.RightHand.quaternion)>.02,'wrist participates in the strike');
});

test('foot swing clears the ground and strike pose anticipates contact then recovers',()=>{
  assert.equal(footCycle(.2,1,.2).y,0);
  assert.ok(footCycle(.8,1,.2).y>.19);
  assert.ok(Math.abs(footCycle(.99999,1,.2).z-footCycle(0,1,.2).z)<.001,'landing is continuous');
  assert.ok(strikePose(STRIKE_DURATION*.8).windup>.8);
  assert.ok(strikePose(STRIKE_CONTACT).drive>.9);
  assert.deepEqual(strikePose(0),{windup:0,drive:0});
});

test('portrait and landscape camera framing includes player, airborne ball and goal',()=>{
  for(const aspect of [390/844,844/390])for(const z of [-15,15]) {
    const player=new THREE.Vector3(-6,0,z),ball=new THREE.Vector3(6,7,-z);
    const frame=framePlay(player,ball,ring,aspect),camera=new THREE.PerspectiveCamera(52,aspect,.1,400);
    camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
    for(const point of [player,player.clone().setY(2.3),ball,ring]) {
      const projected=point.clone().project(camera);
      assert.ok(Math.abs(projected.x)<1 && Math.abs(projected.y)<1,'subject is inside view');
    }
  }
});
