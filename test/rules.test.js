import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Match } from '../src/match.js';
import { createRNG } from '../src/rng.js';
import { BallState } from '../src/ball.js';
import { STRIKES, DIFFICULTIES, chargeQuality, strikeVelocity, strikeContact, chooseContest, resolvePlayerCollisions } from '../src/strike.js';
import { decideAI } from '../src/ai.js';
import { readProfile, saveProfile } from '../src/profile.js';
const ring=new THREE.Vector3(5.75,4.8,0);
const actor=(id,team,z=0)=>({id,team,position:new THREE.Vector3(0,0,z),velocity:new THREE.Vector3(),cooldown:0,swingTimer:0,role:'striker'});
function playing(mode='versus'){const m=new Match(42);m.start(mode);m.phase='playing';return m;}

test('charge rewards timing; strike types change trajectory and hard removes aim assist',()=>{
  const pos=new THREE.Vector3(0,.8,0),zero=new THREE.Vector3();
  for(const type of Object.keys(STRIKES)){
    assert.equal(chargeQuality(type,STRIKES[type].ideal),1);
    assert.ok(chargeQuality(type,0)<.1);
    assert.ok(chargeQuality(type,STRIKES[type].max)<.5);
    const tap=strikeVelocity(pos,zero,0,ring,{type,seconds:0});
    const timed=strikeVelocity(pos,zero,0,ring,{type,seconds:STRIKES[type].ideal});
    assert.ok(timed.length()>tap.length()*2);
  }
  const elbow=strikeVelocity(pos,zero,0,ring,{type:'elbow',seconds:.35});
  const knee=strikeVelocity(pos,zero,0,ring,{type:'knee',seconds:.6});
  assert.ok(knee.y>elbow.y*4);
  const angle=Math.PI/2-.2;
  const hard=strikeVelocity(pos,zero,angle,ring,{seconds:.75,assist:DIFFICULTIES.hard.assist});
  const easy=strikeVelocity(pos,zero,angle,ring,{seconds:.75,assist:DIFFICULTIES.easy.assist});
  assert.ok(Math.abs(Math.atan2(hard.x,hard.z)-angle)<1e-8);
  assert.ok(Math.abs(Math.atan2(easy.x,easy.z)-Math.PI/2)<.2);
});
test('momentum and incoming ball contact change outgoing velocity; rear and remote swings miss',()=>{
  const pos=new THREE.Vector3(0,.8,.9),zero=new THREE.Vector3(),a=actor('p','sun');
  assert.equal(strikeContact(a,{pos},'hip',0).legal,true);
  assert.equal(strikeContact(a,{pos},'hip',Math.PI).legal,false);
  assert.equal(strikeContact(a,{pos:new THREE.Vector3(0,4,.9)},'hip',0).legal,false);
  const options={seconds:.75,normal:new THREE.Vector3(0,0,1)};
  const still=strikeVelocity(pos,zero,0,ring,options);
  const moving=strikeVelocity(pos,zero,0,ring,{...options,momentum:new THREE.Vector3(0,0,5)});
  const incoming=strikeVelocity(pos,new THREE.Vector3(0,0,-10),0,ring,{...options,deflect:true});
  assert.ok(moving.z>still.z+2);
  assert.ok(incoming.z>0,'incoming ball is reflected away from contact');
  assert.notEqual(incoming.z,still.z);
});
test('simultaneous contact is independent of candidate order and even opposing positions clash',()=>{
  const ball={pos:new THREE.Vector3(0,.95,0)};
  const a={actor:actor('a','sun',-.8),type:'hip',seconds:.75,angle:0};
  const b={actor:actor('b','rival',.8),type:'hip',seconds:.75,angle:Math.PI};
  assert.ok(chooseContest([a,b],ball).clash);
  b.actor.position.z=1.35;
  assert.equal(chooseContest([a,b],ball).winner.actor.id,'a');
  assert.equal(chooseContest([b,a],ball).winner.actor.id,'a');
  const overlapping=[actor('a','sun'),actor('b','rival')];
  overlapping[0].bumpTime=.2;resolvePlayerCollisions(overlapping,1/60);
  assert.ok(overlapping[0].position.distanceTo(overlapping[1].position)>=.96);
  assert.ok(overlapping[1].stunTime>0);
});
test('zones, distinct wall combos and rings award 1 / 3 / 10 once',()=>{
  const a=actor('p','sun');
  for(const [events,points] of [
    [[{kind:'zone',end:'rival'}],1],
    [[{kind:'wall',surface:'x1'},{kind:'wall',surface:'x1'},{kind:'rim'}],0],
    [[{kind:'wall',surface:'x1'},{kind:'wall',surface:'z1'},{kind:'rim'}],3],
    [[{kind:'ring'}],10],
  ]){
    const m=playing();m.legalStrike(a,1);for(const event of events)m.ballEvent(event);
    assert.equal(m.scores.sun,points);
    if(points){assert.equal(m.ballEvent({kind:'ring'}),null);assert.equal(m.scores.sun,points);}
  }
  const own=playing();own.legalStrike(a);own.ballEvent({kind:'zone',end:'sun'});assert.equal(own.scores.rival,1);
});
test('only armed rallies count floor bounces; a legal strike renews the allowance',()=>{
  const m=playing(),a=actor('p','sun');
  assert.equal(m.ballEvent({kind:'floor'}),null);assert.equal(m.groundBounces,0);
  m.legalStrike(a);m.ballEvent({kind:'floor'});assert.equal(m.scores.rival,0);
  m.legalStrike(a);assert.equal(m.groundBounces,0);
  m.ballEvent({kind:'floor'});const point=m.ballEvent({kind:'floor'});
  assert.equal(point.kind,'bounce');assert.equal(m.scores.rival,1);
  const b=new BallState(createRNG(5));b.pos.set(0,.43,0);b.vel.set(0,0,0);b.airborne=false;
  for(let i=0;i<120;i++){b.update(1/60,ring);assert.equal(b.events.filter(e=>e.kind==='floor').length,0);}
});
test('passing builds team kinetic and chains; turnover protects the opposing free strike',()=>{
  const m=playing(),a=actor('p','sun'),b=actor('support','sun'),r=actor('r','rival');
  m.legalStrike(a,1);const before=m.kinetic.sun;m.legalStrike(b,1);
  assert.equal(m.stats.passes,1);assert.equal(m.passChain,1);assert.ok(m.kinetic.sun>before+13);
  assert.equal(m.foul('sun'),'rival');assert.equal(m.legalStrike(a),false);
  assert.equal(m.legalStrike(r),true);assert.equal(m.freeStrike,null);assert.equal(m.passChain,0);
});
test('timer, first to 20 and tied sudden death have distinct finish conditions',()=>{
  const m=playing();m.paused=true;m.tick(181);assert.equal(m.timeLeft,180);
  m.paused=false;m.tick(180);assert.equal(m.suddenDeath,true);assert.equal(m.phase,'playing');
  m.award('sun',1,'zone');assert.notEqual(m.phase,'ended');
  m.phase='playing';m.award('rival',10,'ring');assert.equal(m.winner,'rival');assert.equal(m.phase,'ended');
  const normal=playing();normal.award('sun',10,'ring');normal.phase='playing';normal.award('sun',10,'ring');assert.equal(normal.phase,'ended');
  const timed=playing();timed.scores.rival=4;timed.tick(180);assert.equal(timed.winner,'rival');
});
test('seeded serves and AI decisions reproduce; difficulty adds reaction delay and defensive states',()=>{
  const first=new BallState(createRNG(18)),second=new BallState(createRNG(18));
  for(let i=0;i<8;i++){first.reset();second.reset();assert.deepEqual(first.vel.toArray(),second.vel.toArray());}
  function decisions(difficulty){
    const m=playing();m.difficulty=difficulty;const a=actor('a','sun',-.8),b=actor('b','sun',4);
    a.role='support';const ball={pos:new THREE.Vector3(0,.95,0),vel:new THREE.Vector3()};
    let action=null,frame=0;
    while(!action&&frame<120){action=decideAI(a,[a,b],ball,m,ring,1/60).action;frame++;}
    assert.equal(action.pass,true,'support passes to an advanced teammate');return {frame,action};
  }
  assert.deepEqual(decisions('normal'),decisions('normal'));
  assert.ok(decisions('easy').frame>decisions('hard').frame);
  const m=playing(),a=actor('a','sun',-12),ball={pos:new THREE.Vector3(0,.95,-14),vel:new THREE.Vector3()};
  decideAI(a,[a],ball,m,ring,1/60);assert.equal(a.aiState,'defend');
});
test('practice finishes on the first attacking point and solo ring chains multiply points',()=>{
  const drill=playing('practice');drill.legalStrike(actor('p','sun'));drill.ballEvent({kind:'zone',end:'rival'});assert.equal(drill.phase,'ended');
  const solo=playing('solo');solo.award('sun',10,'ring');solo.phase='playing';solo.award('sun',10,'ring');assert.equal(solo.scores.sun,30);
  solo.phase='playing';solo.award('rival',1,'bounce');assert.equal(solo.soloCombo,0);
});
test('saved progression survives malformed or blocked browser storage',()=>{
  assert.equal(readProfile({getItem:()=>'{bad'}).best,0);
  assert.equal(readProfile({getItem:()=>{throw Error('blocked');}}).wins,0);
  assert.equal(saveProfile({setItem:()=>{throw Error('full');}},{best:3}),false);
  let saved;const storage={setItem:(key,value)=>{saved=value;},getItem:()=>saved};
  saveProfile(storage,{best:50,wins:3,games:5,style:'amber'});assert.deepEqual(readProfile(storage),{best:50,wins:3,games:5,style:'amber'});
});
