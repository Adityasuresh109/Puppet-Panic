import test from 'node:test';
import assert from 'node:assert/strict';
import {Puppet,STEP} from '../src/physics.js';
import {EVENTS,eventStandings,tallyTournament,eventById} from '../src/events.js';
import {RoomStore} from '../src/server/rooms.js';

function ticks(p,n){for(let i=0;i<n;i++)p.update(STEP)}
function step(p,side,withArms=true){
 const opposite=side==='left'?'right':'left';
 const c={leftLeg:false,rightLeg:false,leftArm:false,rightArm:false,lean:side==='left'?1:-1,brace:false};
 c[`${side}Leg`]=true;
 if(withArms){ if(['cake','swing'].includes(p.activeMode)){c.leftArm=true;c.rightArm=true;}else c[`${opposite}Arm`]=true; }
 p.setInput(c);ticks(p,24);p.setInput({[`${side}Leg`]:false});ticks(p,7);
}
test('five distinct playable Olympics events have documented rules and time limits',()=>{
 assert.deepEqual(EVENTS.map(e=>e.id),['walk','cake','climb','swing','finale']);
 for(const e of EVENTS){assert.ok(eventById(e.id));assert.ok(e.seconds>=100&&e.seconds<=180);const p=new Puppet({mode:e.id});assert.equal(p.mode,e.id);}
});
test('one-button spam cannot make progress in any event',()=>{
 for(const e of EVENTS){const p=new Puppet({mode:e.id});for(let i=0;i<32;i++){p.setInput({leftLeg:true});ticks(p,18);p.setInput({leftLeg:false});ticks(p,16);}assert.equal(p.steps,0,e.id);assert.equal(p.progress,0,e.id);assert.ok(p.falls>0,e.id);}
});
test('climbing and rope-swinging need torso, legs, and supporting arms',()=>{
 for(const mode of ['climb','swing']){
  const good=new Puppet({mode});for(let i=0;i<18;i++)step(good,good.expectedSide);
  assert.ok(good.steps>=6,`${mode} should allow coordinated progress: steps=${good.steps}, falls=${good.falls}`);
  const bad=new Puppet({mode});for(let i=0;i<18;i++)step(bad,bad.expectedSide,false);
  assert.equal(bad.steps,0,`${mode} missing arms must not progress`);
 }
});
test('finale sections switch between sprint, cake and climb based on progress',()=>{
 const p=new Puppet({mode:'finale'});assert.equal(p.activeMode,'walk');
 p.best=765;assert.equal(p.activeMode,'cake');
 p.best=1450;assert.equal(p.activeMode,'climb');
});
test('standings reward finishers, quality and cumulative winners; no button-spam score exploit',()=>{
 const p=EVENTS.slice(0,3).map((e,i)=>new Puppet({lane:i,name:`TEAM ${i}`,mode:'walk'}));
 p[0].best=1900;p[1].best=1800;p[2].best=1850;p[1].finishedAt=80;
 const scores=eventStandings(p,100,120);
 assert.equal(scores[0].teamId,1);assert.ok(scores[0].points>scores[1].points);
 const total=tallyTournament([{event:'walk',standings:scores},{event:'cake',standings:scores}]);
 assert.equal(total[0].teamId,1);assert.equal(total[0].events,2);
 assert.equal(tallyTournament([]).length,0);
});
test('round reset rotates roles and clears old held inputs',()=>{
 const store=new RoomStore(),room=store.create();
 const people=Array.from({length:5},(_,i)=>store.join(room,`P${i}`));
 const roles1=room.players.map(p=>p.role);
 store.start(room);store.reset(room);
 const roles2=room.players.map(p=>p.role);
 assert.notDeepEqual(roles1,roles2);
 assert.deepEqual([...roles1].sort(),[...roles2].sort());
 assert.ok(room.players.every(p=>Object.keys(p.controls).length===0));
 store.mode(room,'climb');store.start(room);
 assert.equal(room.mode,'climb');
});
test('two-player finale can use the same coordinated control pathway in each stage', async()=>{
 const {puppetInputs,assignPlayers}=await import('../src/teams.js');
 const p=new Puppet({mode:'finale'});
 const players=assignPlayers([{id:1},{id:2}]);
 players[0].controls={leftLeg:true};players[1].controls={leanRight:true};
 assert.deepEqual(puppetInputs(players,p.activeMode),{leftLeg:true,rightLeg:false,leftArm:false,rightArm:true,lean:1,brace:false});
 p.best=770;players[1].controls={leanRight:true,grip:true};
 assert.deepEqual(puppetInputs(players,p.activeMode),{leftLeg:true,rightLeg:false,leftArm:true,rightArm:true,lean:1,brace:false});
});