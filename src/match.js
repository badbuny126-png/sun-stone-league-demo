import { createRNG } from './rng.js';

export const opposite=team=>team==='sun'?'rival':'sun';
export class Match {
  constructor(seed=1) {this.seed=seed;this.rng=createRNG(seed);this.mode=null;this.phase='menu';this.paused=false;this.difficulty='normal';this.reset();}
  reset() {
    this.scores={sun:0,rival:0};this.timeLeft=this.mode==='versus'?180:60;this.suddenDeath=false;
    this.lastTouch=null;this.lastStriker=null;this.groundBounces=0;this.wallContacts=new Set();this.passChain=0;this.rallyArmed=false;
    this.freeStrike=null;this.freeTime=0;this.goalTime=0;this.countdownTime=0;this.winner=null;this.practiceStep=0;this.soloCombo=0;
    this.stats={strikes:0,passes:0,deflections:0,fouls:0,perfect:0,rings:0,maxChain:0};this.kinetic={sun:0,rival:0};
  }
  start(mode,difficulty='normal') {this.mode=mode;this.difficulty=difficulty;this.rng=createRNG(this.seed);this.reset();this.paused=false;this.phase='countdown';this.countdownTime=3;}
  clearRally() {this.rallyArmed=false;this.lastTouch=null;this.lastStriker=null;this.groundBounces=0;this.wallContacts.clear();this.passChain=0;this.freeStrike=null;this.freeTime=0;}
  legalStrike(actor,quality=0,deflect=false) {
    if(this.freeStrike && this.freeStrike!==actor.team)return false;
    const completed=this.lastTouch===actor.team && this.lastStriker && this.lastStriker!==actor.id;
    this.passChain=completed?this.passChain+1:0;
    if(completed)this.stats.passes++;
    this.stats.maxChain=Math.max(this.stats.maxChain,this.passChain);
    this.stats.strikes++;if(deflect)this.stats.deflections++;if(quality>.85)this.stats.perfect++;
    this.kinetic[actor.team]=Math.min(100,this.kinetic[actor.team]+5+quality*8+(completed?12:0));
    this.lastTouch=actor.team;this.lastStriker=actor.id;this.groundBounces=0;this.wallContacts.clear();this.rallyArmed=true;this.freeStrike=null;this.freeTime=0;
    if(this.mode==='practice'&&this.practiceStep===1)this.practiceStep=2;
    return true;
  }
  award(team,points,kind) {
    if(this.phase!=='playing')return null;
    if(this.mode!=='versus') {
      if(team!=='sun'){this.soloCombo=0;this.phase='goal';this.goalTime=.65;return {team,points:0,kind};}
      if(kind==='ring'){this.soloCombo++;points*=Math.min(4,1+Math.floor(this.soloCombo/2));this.stats.rings++;}
      if(this.mode==='practice'&&['ring','zone','combo'].includes(kind)){this.practiceStep=3;this.winner='sun';this.phase='ended';}
    }
    this.scores[team]+=points;
    this.kinetic[team]=Math.min(100,this.kinetic[team]+points*2);
    if(this.mode==='versus' && ((this.suddenDeath&&kind==='ring')||(!this.suddenDeath&&this.scores[team]>=20))) {
      this.winner=team;this.phase='ended';
    } else if(this.phase!=='ended'){this.phase='goal';this.goalTime=.8;}
    return {team,points,kind};
  }
  ballEvent(event) {
    if(!this.rallyArmed || this.phase!=='playing')return null;
    if(event.kind==='ring')return this.award(this.lastTouch,10,'ring');
    if(event.kind==='wall')this.wallContacts.add(event.surface);
    if(event.kind==='rim'&&this.wallContacts.size>=2)return this.award(this.lastTouch,3,'combo');
    if(event.kind==='floor'&&++this.groundBounces>=2){this.soloCombo=0;return this.award(opposite(this.lastTouch),1,'bounce');}
    if(event.kind==='zone')return this.award(event.end==='rival'? 'sun':'rival',1,'zone');
    return null;
  }
  foul(team) {this.stats.fouls++;this.clearRally();this.freeStrike=opposite(team);this.freeTime=3;return this.freeStrike;}
  tick(seconds) {
    if(this.paused||this.phase!=='playing')return;
    this.freeTime=Math.max(0,this.freeTime-seconds);if(this.freeTime===0)this.freeStrike=null;
    if(this.mode==='practice'||this.suddenDeath)return;
    this.timeLeft=Math.max(0,this.timeLeft-seconds);
    if(this.timeLeft===0) {
      if(this.mode==='versus'&&this.scores.sun===this.scores.rival){this.suddenDeath=true;this.clearRally();}
      else{this.winner=this.scores.sun>=this.scores.rival?'sun':'rival';this.phase='ended';}
    }
  }
}
