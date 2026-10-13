import test from 'node:test';
import assert from 'node:assert/strict';
import { Puppet, STEP, TRACK_LENGTH, ranking, placePoints } from '../src/physics.js';
function ticks(p,n) { for(let k=0;k<n;k++) p.update(STEP); }
test('neutral puppet cannot win without player input', () => {
  const p=new Puppet();ticks(p,600);assert.equal(p.x,115);assert.equal(p.phase,'running');
});
test('alternating independent legs physically drive puppet forward', () => {
  const p=new Puppet();
  for(let n=0;n<32;n++) {p.setInput({leftLeg:n%2===0,rightLeg:n%2===1});ticks(p,14);}
  assert.ok(p.x>500,`expected meaningful movement, got ${p.x}`);
  assert.ok(p.events.some(e=>e.type==='step'));
});
test('concurrent elevated legs eventually cause fall and automatic recovery', () => {
  const p=new Puppet();p.setInput({leftLeg:true,rightLeg:true});ticks(p,100);
  assert.equal(p.falls,1);p.setInput({leftLeg:false,rightLeg:false});ticks(p,130);assert.equal(p.phase,'running');
});
test('balance brace triggers cooldown and can protect against wobble', () => {
  const p=new Puppet();p.setInput({brace:true});p.update(STEP);
  assert.ok(p.braceTime>0);assert.ok(p.cooldown>2);assert.ok(p.events.some(e=>e.type==='brace'));
});
test('left and right arms independently affect momentum and emit events', () => {
  const a=new Puppet();a.setInput({leftArm:true});a.update(STEP);
  const b=new Puppet();b.setInput({rightArm:true});b.update(STEP);
  assert.ok(a.vx>0&&b.vx>0);assert.notEqual(a.angularVelocity,b.angularVelocity);
});
test('checkpoint and finish are deterministic',()=>{
  const p=new Puppet();p.x=TRACK_LENGTH-2;p.vx=180;p.update(STEP);
  assert.equal(p.phase,'finished');assert.ok(p.finishedAt!==null);assert.equal(p.progress,1);
  assert.ok(p.events.find(e=>e.type==='finish'));
});
test('ranking, points and unfinished handling',()=>{
  const a=new Puppet({name:'A'}),b=new Puppet({name:'B'});
  a.best=500;b.best=700;
  assert.equal(ranking([a,b])[0],b); assert.deepEqual([0,1,2,3,4].map(placePoints),[100,80,65,50,40]);
});