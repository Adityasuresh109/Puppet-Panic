import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../src/server/rooms.js';
import {createApp} from '../dev-server.js';

test('room resets, joins, rebalances and enforces 25-player cap',()=>{
 const s=new RoomStore(),r=s.create();assert.throws(()=>s.start(r),/At least 2/);
 for(let n=1;n<=25;n++){
  s.join(r,`Friend ${n}`);
  if(n>=2){assert.equal(r.players.length,n);assert.equal(new Set(r.players.map(x=>x.id)).size,n);
   assert.equal(new Set(r.players.map(x=>x.teamId)).size,Math.ceil(n/5));}
 }
 assert.throws(()=>s.join(r,'Friend 26'),/Room full/);
 assert.deepEqual([...new Set(r.players.map(x=>x.teamId))],[0,1,2,3,4]);
 s.start(r);assert.equal(r.phase,'playing');assert.throws(()=>s.join(r,'late guest'),/Match already/);
 s.reset(r);assert.equal(r.phase,'lobby');
});
test('wrong-role input, invalid sequence and guest host actions are denied',()=>{
 const s=new RoomStore(),r=s.create();const first=s.join(r,'A'),second=s.join(r,'B');s.start(r);
 assert.equal(first.role,'DUAL_LEGS');assert.equal(second.role,'UPPER_BODY');
 assert.throws(()=>s.input(r,first,1,{leftArm:true}),/Invalid controls/);
 assert.equal(s.input(r,first,1,{leftLeg:true}),true);
 assert.equal(s.input(r,first,1,{leftLeg:false}),false);
 assert.equal(first.controls.leftLeg,true);
 assert.equal(s.input(r,second,1,{leanRight:true,grip:true}),true);
 s.disconnect(r,first);assert.deepEqual(first.controls,{});
});
test('HTTP room creation, join, start, reconnect and input',async()=>{
 const server=createApp();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(p,d)=>{const r=await fetch(base+'/api/'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)});return {status:r.status,data:await r.json()};};
 try{
  const a=await post('create',{});assert.equal(a.status,200);const {code,token:host}=a.data;
  const p1=(await post('join',{code,name:'Alex'})).data;const p2=(await post('join',{code,name:'Sam'})).data;
  let state=await (await fetch(`${base}/api/state?code=${code}&token=${host}`)).json();
  assert.equal(state.players.length,2);assert.deepEqual(state.teams.map(t=>t.size),[2]);
  assert.equal((await post('start',{code,token:p1.token})).status,403);
  assert.equal((await post('start',{code,token:host})).status,200);
  assert.equal((await post('input',{code,token:p1.token,seq:1,controls:{leftArm:true}})).status,400);
  assert.equal((await post('input',{code,token:p1.token,seq:1,controls:{leftLeg:true}})).status,200);
  const reclaimed=(await post('join',{code,token:p1.token,name:'Alex'})).data;assert.equal(reclaimed.id,p1.id);assert.notEqual(reclaimed.token,p1.token);
  assert.equal((await post('input',{code,token:p1.token,seq:2,controls:{leftLeg:true}})).status,401);
  assert.equal((await post('input',{code,token:reclaimed.token,seq:1,controls:{leftLeg:true}})).status,200);
  assert.equal((await post('join',{code,name:'Late Player'})).status,400);
  state=await (await fetch(`${base}/api/state?code=${code}&token=${p2.token}`)).json();
  assert.equal(state.phase,'playing');assert.equal(state.you.role,'UPPER_BODY');
 }finally{await new Promise((ok,fail)=>server.close(e=>e?fail(e):ok()));}
});