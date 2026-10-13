import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateTeams,assignPlayers,MAX_PLAYERS,ROLES,ACTIONS,puppetInputs} from '../src/teams.js';

test('all lobby sizes 2–25 allocate exactly, evenly, without solo teams or extra puppets',()=>{
 for(let n=2;n<=MAX_PLAYERS;n++){
  const groups=allocateTeams(n);const sizes=groups.map(g=>g.size);
  assert.equal(sizes.reduce((a,b)=>a+b,0),n);
  assert.equal(groups.length,Math.ceil(n/5));
  assert.ok(groups.length<=5&&sizes.every(x=>x>=2&&x<=5));
  assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);
  for(let i=1;i<sizes.length;i++)assert.ok(sizes[i-1]>=sizes[i]);
  for(let i=0;i<groups.length;i++)assert.equal(ROLES[sizes[i]].length,sizes[i]);
 }
});
test('user requested configurations match verbatim',()=>{
 const data={2:[2],5:[5],6:[3,3],7:[4,3],8:[4,4],9:[5,4],11:[4,4,3],15:[5,5,5],16:[4,4,4,4],19:[5,5,5,4],23:[5,5,5,4,4],25:[5,5,5,5,5]};
 for(const [n,sizes] of Object.entries(data))assert.deepEqual(allocateTeams(Number(n)).map(t=>t.size),sizes);
});
test('invalid lobby size rejected',()=>{
 for(const n of [0,1,26,-5,12.5,Infinity,NaN])assert.throws(()=>allocateTeams(n),RangeError);
});
test('assigns everyone exactly once, one role per person',()=>{
 for(let n=2;n<=25;n++){
  const players=Array.from({length:n},(_,i)=>({id:`p${i}`}));const a=assignPlayers(players);
  assert.equal(new Set(a.map(p=>p.id)).size,n);
  for(const p of a)assert.ok(ACTIONS[p.role].length>=1);
 }
});
test('two-player dual legs + upper body includes both essential control channels',()=>{
 const [legs,upper]=assignPlayers([{id:'a'},{id:'b'}]);
 legs.controls={leftLeg:true};upper.controls={leanRight:true};
 assert.deepEqual(puppetInputs([legs,upper]),{leftLeg:true,rightLeg:false,leftArm:false,rightArm:true,lean:1,brace:false});
 upper.controls={leanRight:true,grip:true};
 assert.deepEqual(puppetInputs([legs,upper],'cake'),{leftLeg:true,rightLeg:false,leftArm:true,rightArm:true,lean:1,brace:false});
});
test('five-player mode requires separate inputs and does not synthesize absent stations',()=>{
 const five=assignPlayers(Array.from({length:5},(_,i)=>({id:i})));
 five[0].controls={leftLeg:true};
 assert.deepEqual(puppetInputs(five),{leftLeg:true,rightLeg:false,leftArm:false,rightArm:false,lean:0,brace:false});
});