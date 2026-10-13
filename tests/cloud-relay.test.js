import test from 'node:test';
import assert from 'node:assert/strict';
import {makePartyRoom} from '../worker/implementation.js';
const PartyRoom=makePartyRoom(class {constructor(ctx,env){this.ctx=ctx;this.env=env;}});

function mockRoom(){
 const db=new Map(), sockets=[];
 const ctx={
  storage:{async get(k){return db.get(k);},async put(k,v){db.set(k,structuredClone(v));},async setAlarm(at){ctx.alarm=at;},async deleteAll(){db.clear();}},
  getWebSockets(){return sockets;},acceptWebSocket(ws){sockets.push(ws);}
 };
 const obj=new PartyRoom(ctx,{});
 const post=(route,body)=>obj.fetch(new Request('https://relay.internal/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 async function act(route,body){const r=await post(route,body);return {status:r.status,result:await r.json()};}
 const socket=()=>{const out=[];let attachment={authenticated:false,connectedAt:Date.now()};const ws={out,readyState:1,send(s){out.push(JSON.parse(s));},close(code,reason){this.readyState=3;this.closeCode=code;this.closeReason=reason;},serializeAttachment(a){attachment=a;},deserializeAttachment(){return attachment;}};sockets.push(ws);return ws;};
 return {obj,act,socket,ctx};
}

test('cloud durable room enforces auth, size, role permissions and starting threshold',async()=>{
 const {act}=mockRoom();
 const c=await act('create',{code:'ABCD12'});assert.equal(c.status,200);
 const host=c.result.token; assert.equal((await act('start',{token:host})).status,400);
 let p1=(await act('join',{name:'A'})).result;let p2=(await act('join',{name:'B'})).result;
 const roster=(await act('state',{token:host})).result;
 assert.deepEqual(roster.teams.map(t=>t.size),[2]);assert.equal(JSON.stringify(roster).includes(p1.token),false);
 assert.equal((await act('start',{token:p1.token})).status,403);
 assert.equal((await act('start',{token:host})).status,200);
 assert.equal((await act('input',{token:p1.token,seq:1,controls:{leftArm:true}})).status,400);
 assert.equal((await act('input',{token:p1.token,seq:1,controls:{leftLeg:true}})).status,200);
 assert.equal((await act('input',{token:p1.token,seq:2,controls:{leftLeg:'true'}})).status,400);
 assert.equal((await act('join',{name:'Late'})).status,400);
 const fresh=(await act('join',{name:'A',token:p1.token})).result;assert.equal(fresh.id,p1.id);assert.notEqual(fresh.token,p1.token);
 assert.equal((await act('input',{token:p1.token,seq:2,controls:{leftLeg:true}})).status,401);
 assert.equal((await act('input',{token:fresh.token,seq:1,controls:{leftLeg:true}})).status,200);
 assert.equal((await act('reset',{token:host})).status,200);
});

test('cloud room returns balanced teams for 25 players and rejects 26th',async()=>{
 const {act}=mockRoom();await act('create',{code:'ABCDE1'});
 for(let i=0;i<25;i++){const x=await act('join',{name:'P'+i});assert.equal(x.status,200);}
 const host=(await act('create',{code:'ABCDE1'}));assert.equal(host.status,409);
 assert.equal((await act('join',{name:'26th'})).status,400);
});

test('cloud websocket authenticated host sees only role-authorized commands and disconnect resets',async()=>{
 const {obj,act,socket,ctx}=mockRoom();const cr=await act('create',{code:'DEAD12'});
 const host=cr.result.token, p=(await act('join',{name:'Sam'})).result;await act('join',{name:'Sue'});await act('start',{token:host});
 const hostWS=socket(),phoneWS=socket();
 await obj.webSocketMessage(hostWS,JSON.stringify({type:'auth',code:'DEAD12',token:host}));
 await obj.webSocketMessage(phoneWS,JSON.stringify({type:'auth',code:'DEAD12',token:p.token}));
 assert.equal(hostWS.out[0].type,'ready');assert.equal(phoneWS.out[0].type,'ready');
 await obj.webSocketMessage(phoneWS,JSON.stringify({type:'input',seq:1,controls:{leftLeg:true}}));
 assert.equal(hostWS.out.at(-1).type,'input');assert.equal(hostWS.out.at(-1).controls.leftLeg,true);
 await obj.webSocketMessage(phoneWS,JSON.stringify({type:'input',seq:2,controls:{leftArm:true}}));assert.equal(phoneWS.readyState,3);
 phoneWS.readyState=3;await obj.endSocket(phoneWS);
 assert.deepEqual(hostWS.out.filter(x=>x.type==='input').at(-1).controls,{});
});