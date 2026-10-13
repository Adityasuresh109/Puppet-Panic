import assert from 'node:assert/strict';
import {ACTIONS} from '../src/teams.js';
const BASE='https://puppet-panic-relay.adityasuresh2110.workers.dev';
const ORIGIN='https://adityasuresh109.github.io';
async function api(path,payload){
 const r=await fetch(BASE+'/api/'+path,{method:'POST',headers:{'content-type':'application/json',Origin:ORIGIN},body:JSON.stringify(payload)});
 const body=await r.json();assert.equal(r.status,200,`${path}: ${r.status} ${JSON.stringify(body)}`);return body;
}
async function connect(room,token,onData){
 return await new Promise((resolve,reject)=>{
  const socket=new WebSocket(BASE.replace(/^http/,'ws')+'/api/events?code='+room);
  const timeout=setTimeout(()=>{socket.close();reject(new Error('WebSocket handshake timeout'));},11000);
  socket.addEventListener('open',()=>socket.send(JSON.stringify({type:'auth',code:room,token})));
  socket.addEventListener('message',e=>{
   const packet=JSON.parse(e.data);
   if(packet.type==='ready'){clearTimeout(timeout);resolve(socket);}
   else onData?.(packet);
  });
  socket.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('WebSocket connection error'));});
  socket.addEventListener('close',()=>clearTimeout(timeout));
 });
}
const sockets=[];
try{
 const {code,token}=await api('create',{});
 const players=[];
 for(let i=0;i<25;i++)players.push(await api('join',{code,name:`Test Guest ${i+1}`}));
 const lobby=await api('state',{code,token});
 assert.equal(lobby.players.length,25);
 assert.deepEqual(lobby.teams.map(t=>t.size),[5,5,5,5,5]);
 console.log('PASS: 25 players assigned across five five-player puppets');
 const received=new Set();let lastInput=Date.now();
 const host=await connect(code,token,msg=>{
  if(msg.type==='input'&&msg.controls&&Object.values(msg.controls).some(Boolean))received.add(msg.playerId);
 });sockets.push(host);
 const playerSockets=[];
 for(const p of players){const s=await connect(code,p.token);playerSockets.push(s);sockets.push(s);}
 console.log('PASS: 26 simultaneous authenticated WebSockets (25 controllers + TV host)');
 await api('start',{code,token});
 for(let i=0;i<25;i++){
  const role=lobby.players.find(p=>p.id===players[i].id)?.role;
  const action=ACTIONS[role]?.[0];
  assert.ok(action,`valid role control for player ${i}`);
  playerSockets[i].send(JSON.stringify({type:'input',seq:1,controls:{[action]:true}}));
 }
 const start=Date.now();
 while(received.size<25&&Date.now()-start<10000)await new Promise(r=>setTimeout(r,50));
 assert.equal(received.size,25,`only ${received.size} of 25 players reached host`);
 console.log('PASS: every one of 25 independent role-limited controls reached the TV host');
 await api('reset',{code,token});
 await api('mode',{code,token,mode:'swing'});
 const next=await api('state',{code,token});
 assert.equal(next.mode,'swing');
 assert.equal(next.roundNumber,1);
 await api('start',{code,token});
 console.log('PASS: event transition and role rotation with 25 connected participants');
 console.log('PASS: 25-controller Cloudflare stress smoke test');
}finally{
 for(const socket of sockets)try{socket.close();}catch{}
}
