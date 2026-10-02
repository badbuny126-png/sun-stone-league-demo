import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-output',{recursive:true});
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1'],{stdio:'inherit'});
try {
  let ready=false;
  for(let i=0;i<50;i++){
    try {ready=(await fetch('http://127.0.0.1:4173')).ok;}catch{}
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.ok(ready,'preview server starts');
  for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await engine.launch();
    try {
      for(const [orientation,viewport] of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]]){
        const context=await browser.newContext({viewport,hasTouch:true,isMobile:true});
        const page=await context.newPage(),errors=[];
        page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
        page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
        try {
          await page.goto('http://127.0.0.1:4173/?e2e=1');
          await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
          await page.getByRole('button',{name:/Solo Challenge/}).click();
          await page.locator('#countdown').waitFor({state:'hidden'});
          assert.equal((await page.evaluate(()=>window.__sunStoneTest.snapshot())).ai.filter(f=>f.enabled).length,0);
          await page.getByRole('button',{name:'Pause game'}).click();
          const before=await page.locator('#center-value').textContent();
          await page.waitForTimeout(1200);
          assert.equal(await page.locator('#center-value').textContent(),before,'timer freezes while paused');
          await page.getByRole('button',{name:'Resume game'}).click();
          await page.waitForFunction(value=>Number(document.getElementById('center-value').textContent)<Number(value),before,{timeout:10000});

          const start=(await page.evaluate(()=>window.__sunStoneTest.snapshot())).player;
          const stick=await page.locator('#joystick').boundingBox();
          assert.ok(stick,'joystick is visible');
          const x=stick.x+stick.width/2,y=stick.y+stick.height/2;
          await page.mouse.move(x,y);await page.mouse.down();
          await page.mouse.move(x,y+stick.height*.3,{steps:5});
          await page.waitForTimeout(400);await page.mouse.up();
          const moved=(await page.evaluate(()=>window.__sunStoneTest.snapshot())).player;
          assert.ok(moved[2]>start[2]+.2,'joystick moves the player');
          await page.evaluate(()=>window.__sunStoneTest.setupPlayerStrike(false));
          await page.getByRole('button',{name:'Strike the ball'}).tap();
          assert.equal(await page.locator('#callout').textContent(),'GET CLOSER','touch strike is handled');
          await page.evaluate(()=>window.__sunStoneTest.setupPlayerStrike(true));
          await page.waitForFunction(()=>window.__sunStoneTest.snapshot().shotGuideVisible,null,{timeout:5000});
          assert.equal(await page.locator('#hit-btn').evaluate(button=>button.classList.contains('ready')),true,'strike button highlights in range');
          await page.screenshot({path:'test-output/'+name+'-'+orientation+'-aim-guide.png'});
          await page.getByRole('button',{name:'Pause game'}).click();
          await page.waitForFunction(()=>!window.__sunStoneTest.snapshot().shotGuideVisible);
          await page.getByRole('button',{name:'Resume game'}).click();
          await page.getByRole('button',{name:'Strike the ball'}).tap();
          await page.waitForFunction(()=>document.getElementById('callout').textContent==='KINETIC STRIKE!',null,{timeout:10000});
          assert.ok((await page.evaluate(()=>window.__sunStoneTest.snapshot())).ballSpeed>4,'an in-range touch swing launches the ball at contact');
          await page.screenshot({path:'test-output/'+name+'-'+orientation+'-solo.png'});
          assert.deepEqual(errors,[],name+' solo runtime/shader errors');

          await page.getByRole('button',{name:'Pause game'}).click();
          await page.locator('#pause-menu-btn').click();
          assert.equal((await page.evaluate(()=>window.__sunStoneTest.snapshot())).mode,null,'pause returns to mode selection');
          assert.equal(await page.locator('#menu').isVisible(),true);
          await page.getByRole('button',{name:/2v2 Team Match/}).click();
          await page.locator('#countdown').waitFor({state:'hidden'});
          assert.equal(await page.locator('#player-label').textContent(),'Sun Team');
          assert.equal(await page.locator('#rival-label').textContent(),'Rival Team');
          assert.equal(await page.locator('#touch-controls').isVisible(),true,'touch controls stay available in 2v2');
          const team=(await page.evaluate(()=>window.__sunStoneTest.snapshot())).ai;
          assert.equal(team.filter(f=>f.enabled).length,3,'all three AI fighters are active');
          await page.waitForFunction(initial=>{
            const current=window.__sunStoneTest.snapshot().ai;
            return current.some((fighter,i)=>Math.hypot(...fighter.position.map((v,j)=>v-initial[i].position[j]))>.1);
          },team,{timeout:5000});
          for (const [owner,sunScore,rivalScore] of [['sun',1,0],['rival',1,1],['sun',2,1],['sun',3,1]]) {
            await page.evaluate(value=>window.__sunStoneTest.queueRingShot(value),owner);
            await page.waitForFunction(([sun,rival])=>{
              const state=window.__sunStoneTest.snapshot();
              return state.scorePlayer===sun && state.scoreAI===rival;
            },[sunScore,rivalScore],{timeout:5000});
            await page.waitForFunction(final=>{
              const phase=window.__sunStoneTest.snapshot().phase;
              return phase===(final?'ended':'playing');
            },sunScore===3,{timeout:5000});
          }
          assert.equal(await page.locator('#end-title').textContent(),'TIKAL VICTORY');
          await page.screenshot({path:'test-output/'+name+'-'+orientation+'-team.png'});
          assert.deepEqual(errors,[],name+' 2v2 runtime/shader errors');
          await page.getByRole('button',{name:'Play Again'}).click();
          const replay=await page.evaluate(()=>window.__sunStoneTest.snapshot());
          assert.equal(replay.scorePlayer,0,'replay clears Sun score');
          assert.equal(replay.scoreAI,0,'replay clears rival score');
          assert.equal(replay.ai.filter(f=>f.enabled).length,3,'replay keeps the full roster');
          console.log(name+' '+orientation+': solo touch, pause/menu, 2v2 AI, both team scores, win and replay passed');
        } catch (error) {
          await page.screenshot({path:'test-output/'+name+'-'+orientation+'-failure.png'}).catch(()=>{});
          await writeFile('test-output/'+name+'-'+orientation+'-failure.txt',String(error)+'\n'+errors.join('\n'));
          throw error;
        } finally {await context.close();}
      }
    } finally {await browser.close();}
  }
} finally {server.kill();}
