import test from 'node:test';
import assert from 'node:assert/strict';
import {makePartyRoom} from '../worker/implementation.js';
import {RoomStore} from '../src/server/rooms.js';
import {Puppet,hazardsFor} from '../src/physics.js';
import {eventStandings} from '../src/events.js';
import {readFileSync} from 'node:fs';

const PartyRoom=makePartyRoom(class {constructor(ctx,env){this.ctx=ctx;this.env=env;}});
function mock(){
 const data=new Map(), sockets=[];
 const ctx={storage:{async get(k){return data.get(k);},async put(k,v){data.set(k,structuredClone(v));},async setAlarm(){},async deleteAll(){data.clear();}},getWebSockets:()=>sockets,acceptWebSocket:s=>sockets.push(s)};
 const room=new PartyRoom(ctx,{});
 const act=async(path,payload={})=>{const res=await room.fetch(new Request('https://relay.internal/'+path,{method:'POST',body:JSON.stringify(payload)}));return {status:res.status,data:await res.json()};};
 const socket=()=>{const out=[];let attach={authenticated:false,connectedAt:Date.now()};const ws={out,readyState:1,send(value){out.push(JSON.parse(value));},close(){this.readyState=3;},serializeAttachment(value){attach=value;},deserializeAttachment(){return attach;}};sockets.push(ws);return ws;};
 return {room,act,socket};
}
test('Cloudflare Olympics roster remains fixed between events and host can explicitly unlock',async()=>{
 const {act}=mock(),host=(await act('create',{code:'AAAA91'})).data.token;
 await act('join',{name:'one'});await act('join',{name:'two'});
 assert.equal((await act('start',{token:host,format:'olympics'})).status,200);
 assert.equal((await act('reset',{token:host})).status,200);
 assert.equal((await act('join',{name:'third'})).status,400);
 assert.equal((await act('state',{token:host})).data.rosterLocked,true);
 assert.equal((await act('reset',{token:host,finishTournament:true})).status,200);
 assert.equal((await act('join',{name:'third'})).status,200);
});
test('Cloudflare host presence notifies guest when host socket disappears and reconnects',async()=>{
 const {room,act,socket}=mock();
 const host=(await act('create',{code:'AAAA92'})).data.token;
 const first=(await act('join',{name:'one'})).data;
 await act('join',{name:'two'});
 const hs=socket(),ps=socket();
 await room.webSocketMessage(hs,JSON.stringify({type:'auth',code:'AAAA92',token:host}));
 await room.webSocketMessage(ps,JSON.stringify({type:'auth',code:'AAAA92',token:first.token}));
 assert.equal((await act('state',{token:first.token})).data.hostOnline,true);
 hs.close();await room.endSocket(hs);
 assert.equal(ps.out.filter(e=>e.type==='room').at(-1).hostOnline,false);
 const recovered=socket();
 await room.webSocketMessage(recovered,JSON.stringify({type:'auth',code:'AAAA92',token:host}));
 assert.equal(ps.out.filter(e=>e.type==='room').at(-1).hostOnline,true);
});
test('Explicit end of party revokes room for all guests',async()=>{
 const {act}=mock();
 const host=(await act('create',{code:'AAAA93'})).data.token;
 await act('join',{name:'one'});
 assert.equal((await act('end',{token:host})).status,200);
 assert.equal((await act('state',{token:host})).status,404);
});
test('Local room enforces same roster-lock and end-session policy',()=>{
 const store=new RoomStore(),room=store.create(),first=store.join(room,'first');
 store.join(room,'second');store.start(room,'olympics');store.reset(room);
 assert.throws(()=>store.join(room,'third'),/locked/);
 store.reset(room,true);store.join(room,'third');
 assert.equal(store.find(room.code),room);
 store.end(room);assert.equal(store.find(room.code),undefined);
});
test('TV visuals and physics use shared hazard positions for each event',()=>{
 assert.deepEqual(hazardsFor('climb'),[620,1140,1600]);
 assert.deepEqual(hazardsFor('swing'),[710,1310,1710]);
 const host=readFileSync(new URL('../src/host.js',import.meta.url),'utf8');
 assert.match(host,/hazardsFor\(mode\)/);
});
test('Ranking bonuses never let a lower rank outscore a higher rank',()=>{
 const puppets=Array.from({length:5},(_,i)=>({lane:i,name:'team'+i,finishedAt:null,progress:1-i*.11,falls:i===0?5:0,mode:'walk',layers:3}));
 const result=eventStandings(puppets,110,120);
 for(let i=1;i<result.length;i++)assert.ok(result[i-1].points>result[i].points,'rank '+i+' preserves order');
});

test('Cloudflare per-IP room creation cap rejects excess attempts within one minute',async()=>{
 const {act}=mock();
 for(let i=0;i<8;i++)assert.equal((await act('rate',{kind:'create'})).status,200);
 assert.equal((await act('rate',{kind:'create'})).status,429);
});
test('Cloudflare host can remove unwanted lobby player and invalidate that session',async()=>{
 const {act}=mock();const host=(await act('create',{code:'AAAA94'})).data.token;
 const rogue=(await act('join',{name:'Duplicate'})).data;
 await act('join',{name:'Friend'});
 assert.equal((await act('kick',{token:host,playerId:rogue.id})).status,200);
 const snapshot=(await act('state',{token:host})).data;
 assert.equal(snapshot.players.length,1);
 assert.equal((await act('state',{token:rogue.token})).status,401);
});

test('Durable host checkpoint is private to host and survives a new session snapshot',async()=>{
 const {act}=mock();const host=(await act('create',{code:'AAAA95'})).data.token;
 const player=(await act('join',{name:'Alex'})).data;
 await act('join',{name:'Sam'});
 await act('start',{token:host,format:'olympics'});
 const state={code:'AAAA95',mode:'walk',elapsed:12.5,rounds:[{event:'walk',standings:[]}],eventIndex:0,sessionFormat:'olympics',resultsShown:false,puppets:[],savedAt:Date.now()};
 assert.equal((await act('checkpoint',{token:player.token,state})).status,403);
 assert.equal((await act('checkpoint',{token:host,state})).status,200);
 const hostView=(await act('state',{token:host})).data;
 assert.deepEqual(hostView.checkpoint,state);
 const playerView=(await act('state',{token:player.token})).data;
 assert.equal(Object.hasOwn(playerView,'checkpoint'),false);
});
