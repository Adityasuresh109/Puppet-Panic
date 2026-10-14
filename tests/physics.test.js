import test from 'node:test';
import assert from 'node:assert/strict';
import { Puppet, STEP, TRACK_LENGTH, ranking, placePoints } from '../src/physics.js';
const ticks=(p,n)=>{for(let k=0;k<n;k++)p.update(STEP);};
function coordinatedCycle(p, side, {arm=true,lean=true,hold=22}={}) {
  const other=side==='left'?'right':'left';
  const press={leftLeg:false,rightLeg:false,leftArm:false,rightArm:false,lean:0,brace:false};
  press[`${side}Leg`]=true;
  if(arm) press[`${other}Arm`]=true;
  if(lean) press.lean=side==='left'?1:-1;
  if(p.mode==='cake'){press.leftArm=arm;press.rightArm=arm;}
  p.setInput(press);ticks(p,hold);
  p.setInput({[`${side}Leg`]:false});ticks(p,6);
}
function coordinate(p,n=30,options={}) {
 for(let k=0;k<n;k++){const side=p.expectedSide;coordinatedCycle(p,side,options);}
}
test('no input: stays put',()=>{const p=new Puppet();ticks(p,1800);assert.equal(p.x,115);assert.equal(p.steps,0);});
test('single leg spam cannot propel puppet or finish and causes slips/falls',()=>{
 const p=new Puppet();for(let k=0;k<55;k++){p.setInput({leftLeg:true});ticks(p,19);p.setInput({leftLeg:false});ticks(p,16);}
 assert.equal(p.steps,0);assert.ok(p.x<180,`one-button exploit: x=${p.x}`);assert.ok(p.falls>0,`no faceplants: ${p.falls}`);
});
test('arms-only spam cannot move puppet',()=>{
 const p=new Puppet();for(let k=0;k<55;k++){p.setInput({leftArm:true,rightArm:false});ticks(p,7);p.setInput({leftArm:false,rightArm:true});ticks(p,7);}
 assert.equal(p.x,115);assert.equal(p.steps,0);
});
test('legs alone without torso or arms cannot succeed',()=>{
 const p=new Puppet();for(let k=0;k<60;k++){coordinatedCycle(p,p.expectedSide,{arm:false,lean:false});}
 assert.equal(p.steps,0);assert.ok(p.x<180);assert.ok(p.falls>0);
});
test('legs + torso but missing arm counter-swing cannot succeed',()=>{
 const p=new Puppet();for(let k=0;k<45;k++){coordinatedCycle(p,p.expectedSide,{arm:false});}
 assert.equal(p.steps,0);assert.ok(p.falls>0);
});
test('legs + arms but missing weight transfer cannot succeed',()=>{
 const p=new Puppet();for(let k=0;k<45;k++){coordinatedCycle(p,p.expectedSide,{lean:false});}
 assert.equal(p.steps,0);assert.ok(p.falls>0);
});
test('properly timed sequence involving all roles advances and alternates',()=>{
 const p=new Puppet();coordinate(p,32);assert.ok(p.x>650,`team coordination should progress: x=${p.x} steps=${p.steps}, falls=${p.falls}`);
 assert.ok(p.steps>15);assert.ok(p.events.some(e=>e.type==='step'));
});
test('both legs held removes support and causes fall',()=>{const p=new Puppet();p.setInput({leftLeg:true,rightLeg:true});ticks(p,120);assert.ok(p.falls>0);p.setInput({leftLeg:false,rightLeg:false});ticks(p,145);assert.equal(p.phase,'running');});
test('holding one leg too long causes instability; releasing late produces a slip',()=>{const p=new Puppet();p.setInput({leftLeg:true,rightArm:true,lean:1});ticks(p,100);p.setInput({leftLeg:false});ticks(p,1);assert.equal(p.steps,0);assert.ok(p.events.some(e=>e.type==='slip')||p.falls>0);});
test('cake mode: requires both grips, not merely coordinated feet',()=>{
 const p=new Puppet({mode:'cake'});coordinatedCycle(p,'left',{arm:false});assert.equal(p.steps,0);
  coordinatedCycle(p,'left');assert.equal(p.steps,1);p.setInput({leftArm:false,rightArm:false});ticks(p,80);assert.ok(p.layers<3); });
test('cake mode: coordinated arms, legs, torso can make progress',()=>{const p=new Puppet({mode:'cake'});coordinate(p,20);assert.ok(p.steps>8,`coordinated cake progress: ${p.steps}, falls ${p.falls}`);});
test('brace cannot substitute for team coordination',()=>{const p=new Puppet();p.setInput({brace:true,leftLeg:true});ticks(p,20);p.setInput({leftLeg:false});ticks(p,20);assert.equal(p.steps,0);assert.ok(p.cooldown>0);});
test('checkpoint and finish are deterministic once legitimately reached',()=>{const p=new Puppet();coordinate(p,60);assert.ok(p.checkpoint>115,`checkpoint not reached x=${p.x}`);p.x=TRACK_LENGTH-2;p.vx=150;ticks(p,3);assert.equal(p.phase,'finished');assert.equal(p.progress,1);});
test('ranking and points',()=>{const a=new Puppet(),b=new Puppet();a.best=500;b.best=700;assert.equal(ranking([a,b])[0],b);assert.deepEqual([0,1,2,3,4].map(placePoints),[100,80,65,50,40]);});
test('last-moment 80 ms arm and torso correction does not pass sustained coordination gate',()=>{
 const p=new Puppet();
 p.setInput({leftLeg:true,leftArm:false,rightArm:false,lean:0});ticks(p,17);
 p.setInput({rightArm:true,lean:1});ticks(p,5);
 p.setInput({leftLeg:false});ticks(p,1);
 assert.equal(p.steps,0,'a short final input correction cannot fake sustained team coordination');
 assert.ok(p.events.some(e=>e.type==='slip'));
});
