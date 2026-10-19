import test from 'node:test';
import assert from 'node:assert/strict';
import {GrandPrixPuppet,GP_DT,GP_TRACK} from '../src/v2/physics.js';
const tick=(p,n)=>{for(let i=0;i<n;i++)p.update(GP_DT);};
function run(seed,{mistakes=true,solo=false}={}){
 const p=new GrandPrixPuppet();let rng=seed>>>0;
 const random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
 while(p.elapsed<90&&p.finishedAt===null){
  const intended=p.expected==='left'?'leftLeg':'rightLeg';
  const other=intended==='leftLeg'?'rightLeg':'leftLeg';
  const wrong=mistakes&&random()<.13;
  const leg=wrong?other:intended;
  const arm=leg==='leftLeg'?'rightArm':'leftArm';
  const hold=Math.floor((.20+random()*.42)*60);
  const combo={...p.input,[leg]:true,[arm]:true};
  if(mistakes&&random()<.045)combo[other]=true;
  p.setInput(combo);tick(p,hold);
  p.setInput({...combo,[leg]:false,[other]:false,[arm]:false});tick(p,Math.floor((.30+random()*.18)*60));
 }
 return p;
}
test('four realistic first-timer bots complete 90-second walk with fewer than six faceplants',()=>{
 for(let seed=1;seed<=4;seed++){
  const p=run(seed*997);
  assert.ok(p.finishedAt!==null&&p.finishedAt<=90,`bot ${seed} stopped at ${Math.round(p.progress*100)}%, ${p.falls} falls in ${p.elapsed.toFixed(1)}s`);
  assert.ok(p.falls<6,`bot ${seed} fell ${p.falls} times`);
 }
});
test('solo four-button player completes the track without external controls',()=>{
 const p=run(21,{mistakes:false,solo:true});
 assert.ok(p.finishedAt&&p.finishedAt<90,`solo ${p.progress}`);
});
test('six coordinated puppets can all finish with a winner',()=>{
 const racers=Array.from({length:6},(_,i)=>run(17+i*13,{mistakes:i%2===0}));
 assert.ok(racers.every(p=>p.finishedAt!==null));
 const standings=[...racers].sort((a,b)=>a.finishedAt-b.finishedAt);
 assert.ok(standings[0].finishedAt<standings.at(-1).finishedAt);
});