import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore} from '../src/server/rooms.js';
import {makePartyRoom} from '../worker/implementation.js';
const Parent=class{constructor(ctx,env){this.ctx=ctx;this.env=env;}};
const PartyRoom=makePartyRoom(Parent);
function mock(){
 const data=new Map(),sockets=[];
 const ctx={storage:{get:async k=>data.get(k),put:async(k,v)=>data.set(k,structuredClone(v)),setAlarm:async()=>{},deleteAll:async()=>data.clear()},getWebSockets:()=>sockets,acceptWebSocket:s=>sockets.push(s)};
 const room=new PartyRoom(ctx,{});
 const call=async(path,body={})=>{const res=await room.fetch(new Request('https://example.test/'+path,{method:'POST',body:JSON.stringify(body)}));return {status:res.status,...await res.json()};};
 return {room,call};
}
test('LAN grand prix supports solo warm-up and role-limited inputs',()=>{
 const rs=new RoomStore(),r=rs.create('grandprix');const p=rs.join(r,'Solo');
 assert.equal(rs.snapshot(r,p).teams.length,1);
 assert.equal(p.role,'ALL_LIMBS');
 assert.throws(()=>rs.start(r),/Warm up/);
 rs.warmup(r);assert.equal(r.phase,'warmup');assert.equal(r.warmedUp,true);
 assert.ok(rs.input(r,p,1,{leftLeg:true,rightArm:true}));
 assert.throws(()=>rs.input(r,p,2,{leanLeft:true}),/Invalid controls/);
 rs.start(r);assert.equal(r.phase,'playing');
 rs.reset(r);assert.equal(r.phase,'lobby');assert.equal(r.rosterLocked,true);
 assert.throws(()=>rs.join(r,'Late player'),/locked/);
});
test('LAN v1 preserves existing threshold and roles',()=>{
 const rs=new RoomStore(),r=rs.create();rs.join(r,'One');
 assert.throws(()=>rs.start(r),/At least 2 players required/);
 assert.throws(()=>rs.warmup(r),/Cannot start/);
 assert.equal(r.variant,'olympics');
});
test('Cloudflare 24 controllers split into 6 four-person teams',async()=>{
 const {call}=mock();const created=await call('create',{code:'BADA55',variant:'grandprix'});
 assert.equal(created.status,200);
 for(let i=0;i<24;i++)assert.equal((await call('join',{name:'Player '+i})).status,200);
 const snapshot=await call('state',{token:created.token});
 assert.equal(snapshot.variant,'grandprix');assert.equal(snapshot.players.length,24);
 assert.deepEqual(snapshot.teams.map(t=>t.size),[4,4,4,4,4,4]);
 assert.equal(snapshot.maxPlayers,24);
 assert.equal((await call('join',{name:'25th'})).status,400);
});
test('Cloudflare warm-up accepts real controls, but locks new admissions',async()=>{
 const {call}=mock();const made=await call('create',{code:'FAD0A1',variant:'grandprix'});
 const player=await call('join',{name:'Solo'});
 assert.equal((await call('start',{token:made.token})).status,400);
 assert.equal((await call('warmup',{token:player.token})).status,403);
 assert.equal((await call('warmup',{token:made.token})).status,200);
 assert.equal((await call('join',{name:'Late'})).status,400);
 assert.equal((await call('input',{token:player.token,seq:1,controls:{leftLeg:true,rightArm:true}})).status,200);
 assert.equal((await call('input',{token:player.token,seq:2,controls:{balance:true}})).status,400);
 assert.equal((await call('start',{token:made.token,format:'olympics'})).status,200);
 const room=await call('state',{token:made.token});
 assert.equal(room.phase,'playing');assert.equal(room.warmedUp,true);
});