import assert from 'node:assert/strict';
import {ACTIONS} from '../src/teams.js';

const RELAY = (process.env.PUPPET_RELAY_URL || 'https://puppet-panic-relay.adityasuresh2110.workers.dev').replace(/\/$/,'');
const ORIGIN = 'https://adityasuresh109.github.io';

async function request(path,data){
  const response=await fetch(RELAY+'/api/'+path,{method:'POST',headers:{'content-type':'application/json','origin':ORIGIN},body:JSON.stringify(data)});
  const payload=await response.json();
  return {status:response.status,payload};
}
async function ok(path,data){
  const r=await request(path,data);
  assert.equal(r.status,200,`${path} expected 200 but got ${r.status}: ${r.payload.error || ''}`);
  return r.payload;
}
function awaitMessage(socket,predicate,timeout=11000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(new Error('WebSocket message timeout'));},timeout);
    function cleanup(){clearTimeout(timer);socket.removeEventListener('message',listener);socket.removeEventListener('close',closed);}
    function listener(event){try{const item=JSON.parse(event.data);if(predicate(item)){cleanup();resolve(item);}}catch{}}
    function closed(){cleanup();reject(new Error('WebSocket closed before expected message'));}
    socket.addEventListener('message',listener);
    socket.addEventListener('close',closed);
  });
}
async function connect(code,token){
  const url=RELAY.replace(/^http/,'ws')+'/api/events?code='+encodeURIComponent(code);
  const socket=new WebSocket(url);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('WebSocket connection timed out')),10000);
    socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('WebSocket connection failed'));},{once:true});
  });
  const ready=awaitMessage(socket,m=>m.type==='ready');
  socket.send(JSON.stringify({type:'auth',code,token}));
  await ready;
  return socket;
}

const sockets=[];
try{
  const health=await fetch(RELAY+'/health',{headers:{origin:ORIGIN}});
  assert.equal(health.status,200,'Cloudflare health should be publicly reachable');
  const status=await health.json();
  assert.equal(status.ok,true);
  console.log('PASS: live public Worker health and GitHub Pages Origin');

  const room=await ok('create',{});
  assert.match(room.code,/^[A-F0-9]{6}$/);
  const first=await ok('join',{code:room.code,name:'Smoke Left'});
  const second=await ok('join',{code:room.code,name:'Smoke Right'});
  const state=await ok('state',{code:room.code,token:room.token});
  assert.equal(state.players.length,2);
  assert.equal(state.teams.length,1);
  assert.equal(state.teams[0].size,2);
  console.log('PASS: public room creation, two-player joins and automatic team assignment');

  const host=await connect(room.code,room.token);sockets.push(host);
  const phone=await connect(room.code,first.token);sockets.push(phone);
  await ok('start',{code:room.code,token:room.token});

  const role=state.players.find(p=>p.id===first.id)?.role;
  assert.ok(role && ACTIONS[role]?.length,'assigned role has valid controls');
  const key=ACTIONS[role][0];
  const inputMessage=awaitMessage(host,m=>m.type==='input'&&m.playerId===first.id&&m.controls?.[key]===true);
  phone.send(JSON.stringify({type:'input',seq:1,controls:{[key]:true}}));
  await inputMessage;
  console.log('PASS: authenticated WebSocket phone input delivered to TV host');

  const rejected=await request('input',{code:room.code,token:first.token,seq:2,controls:{totallyInvalidButton:true}});
  assert.notEqual(rejected.status,200,'invalid role controls cannot be accepted');
  console.log('PASS: unauthorized controller actions rejected');

  const telemetry=awaitMessage(phone,m=>m.type==='telemetry'&&m.teamId===0&&m.progress===0.25);
  host.send(JSON.stringify({type:'telemetry',teams:[{id:0,progress:0.25,expectedSide:'left',unsteady:0.1,phase:'upright'}]}));
  await telemetry;
  console.log('PASS: host progress telemetry reaches the phone controller');

  console.log('PASS: Puppet Panic live Cloudflare relay smoke test');
}finally{
  for(const ws of sockets)try{ws.close();}catch{}
}
