import test from 'node:test';
import assert from 'node:assert/strict';
import {GP_LIMBS,gpTeams,gpAssign,gpInputs,gpJob,GP_ACTIONS,gpStage} from '../src/v2/rules.js';
import {GrandPrixPuppet,GP_DT} from '../src/v2/physics.js';
const tick=(p,n=1)=>{for(let i=0;i<n;i++)p.update(GP_DT);};
const hold=(p,key,n=24)=>{p.setInput({...p.input,[key]:true});tick(p,n);p.setInput({...p.input,[key]:false});tick(p,2);};
test('1–24 player capacity and balanced teams',()=>{
 const examples=new Map([[1,[1]],[2,[2]],[3,[3]],[4,[4]],[5,[3,2]],[8,[4,4]],[24,[4,4,4,4,4,4]]]);
 for(let n=1;n<=24;n++){
  const teams=gpTeams(n);assert.equal(teams.length,Math.ceil(n/4));assert.equal(teams.reduce((a,b)=>a+b.size,0),n);
  assert.ok(teams.every(t=>t.size>=1&&t.size<=4));
  if(examples.has(n))assert.deepEqual(teams.map(t=>t.size),examples.get(n));
 }
 assert.throws(()=>gpTeams(25),RangeError);
});
test('diagonal pair and small team assignments each cover four limbs exactly once',()=>{
 for(const n of [1,2,3,4,5,8,24]){
  const ass=gpAssign(Array.from({length:n},(_,i)=>({id:String(i)})));
  for(const t of gpTeams(n)){
   const players=ass.filter(p=>p.teamId===t.id);
   assert.equal(players.length,t.size);
   assert.deepEqual(players.flatMap(p=>GP_ACTIONS[p.role]).sort(),[...GP_LIMBS].sort());
  }
 }
 const two=gpAssign([{id:'a'},{id:'b'}]);
 assert.deepEqual(two.map(p=>GP_ACTIONS[p.role]),[['leftLeg','rightArm'],['rightLeg','leftArm']]);
 const three=gpAssign([{id:'a'},{id:'b'},{id:'c'}]);
 assert.deepEqual(three.map(p=>GP_ACTIONS[p.role]),[['leftLeg','rightArm'],['rightLeg'],['leftArm']]);
});
test('aggregates only authorized player limbs',()=>{
 const players=gpAssign([{id:'a'},{id:'b'}]);
 players[0].controls={leftLeg:true,rightArm:true,rightLeg:true,leanRight:true};
 players[1].controls={rightLeg:false,leftArm:true};
 assert.deepEqual(gpInputs(players),{leftLeg:true,rightLeg:false,leftArm:true,rightArm:true});
});
test('leg alternation advances; same foot stumbles and does not progress',()=>{
 const p=new GrandPrixPuppet();
 hold(p,'leftLeg');const x=p.x; assert.ok(x>0);
 hold(p,'leftLeg');assert.equal(p.x,x);assert.ok(p.stumbles>0);
 hold(p,'rightLeg');assert.ok(p.x>x);
});
test('button spam and short holds cannot propel puppet',()=>{
 const p=new GrandPrixPuppet();
 for(let i=0;i<30;i++){hold(p,'leftLeg',3);tick(p,3);}
 assert.equal(p.x,0);
});
test('standing still is safe and falls auto-recover in one second',()=>{
 const p=new GrandPrixPuppet();tick(p,60*20);
 assert.equal(p.falls,0);assert.equal(p.wobble,0);
 p.setInput({leftLeg:true,rightLeg:true});tick(p,70);
 assert.equal(p.falls,1);let x=p.x;tick(p,75);assert.equal(p.phase,'upright');assert.equal(p.x,x);
});
test('opposite arm yields speed advantage but is not mandatory',()=>{
 const p=new GrandPrixPuppet(),bonus=new GrandPrixPuppet();
 bonus.setInput({rightArm:true});
 hold(p,'leftLeg');hold(bonus,'leftLeg');assert.ok(bonus.x>p.x*1.25);
});
test('cake drops when support arm is released during delivery',()=>{
 const p=new GrandPrixPuppet({mode:'cake'});
 p.setInput({leftArm:true,rightArm:true});hold(p,'leftLeg');
 assert.equal(p.layers,3);
 p.setInput({...p.input,leftArm:false});tick(p,45);
 assert.ok(p.layers<3);
});
test('rope requires arm grip during travel',()=>{
 const p=new GrandPrixPuppet({mode:'swing'});
 p.setInput({leftArm:true,rightArm:true});hold(p,'leftLeg');const x=p.x;
 p.setInput({...p.input,leftArm:false});tick(p,40);
 assert.equal(p.phase,'fallen');assert.equal(p.x,x);
});
test('climb moves one limb at a time while three hold',()=>{
 const p=new GrandPrixPuppet({mode:'climb'});
 p.setInput({leftLeg:true,rightLeg:true,leftArm:true,rightArm:true});tick(p,3);
 p.setInput({...p.input,leftArm:false});tick(p,24);
 p.setInput({...p.input,leftArm:true});tick(p,2);
 assert.ok(p.x>0);
 const before=p.x;
 p.setInput({...p.input,leftLeg:false,rightLeg:false});tick(p,25);
 p.setInput({...p.input,leftLeg:true,rightLeg:true});tick(p,2);
 assert.equal(p.x,before,'double reach must not move');
});
test('finale has three stages based on progress',()=>{
 const p=new GrandPrixPuppet({mode:'finale'});
 assert.equal(p.stage,'walk');p.x=650;assert.equal(p.stage,'cake');p.x=1400;assert.equal(p.stage,'climb');
});
test('plain-language jobs for all limbs in all event stages',()=>{
 for(const stage of ['walk','cake','swing','climb'])for(const limb of GP_LIMBS){
  const text=gpJob(limb,stage);assert.ok(text.length>10);assert.doesNotMatch(text,/counter.swing|weight transfer/i);
 }
});