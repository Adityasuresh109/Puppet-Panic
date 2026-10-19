import assert from 'node:assert/strict';
import {GP_ACTIONS} from '../src/v2/rules.js';
const BASE='https://puppet-panic-grand-prix.adityasuresh2110.workers.dev';
const ORIGIN=BASE;
const sockets=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,body={}){
 const r=await fetch(BASE+'/api/'+path,{method:'POST',headers:{'content-type':'application/json',origin:ORIGIN},body:JSON.stringify(body)});
 const payload=await r.json();if(!r.ok)throw Error(path+': '+r.status+' '+JSON.stringify(payload));return payload;
}
async function connect(code,token,receive){
 const ws=new WebSocket(BASE.replace(/^http/,'ws')+'/api/events?code='+code);
 sockets.push(ws);
 await new Promise((ok,fail)=>{const timeout=setTimeout(()=>fail(Error('Socket timeout')),9000);ws.addEventListener('open',()=>{clearTimeout(timeout);ok();},{once:true});ws.addEventListener('error',()=>{clearTimeout(timeout);fail(Error('WebSocket error'));},{once:true});});
 const ready=new Promise((ok,fail)=>{const timeout=setTimeout(()=>fail(Error('Authorization timeout')),9000);const listener=e=>{const msg=JSON.parse(e.data);if(msg.type==='ready'){clearTimeout(timeout);ws.removeEventListener('message',listener);ok();}else receive?.(msg);};ws.addEventListener('message',listener);});
 ws.send(JSON.stringify({type:'auth',code,token}));await ready;
 ws.addEventListener('message',e=>{try{receive?.(JSON.parse(e.data));}catch{}});
 return ws;
}
const health=await fetch(BASE+'/health');assert.equal(health.status,200);
const page=await fetch(BASE+'/');assert.equal(page.status,200);assert.match(await page.text(),/GRAND PRIX/);
console.log('PASS: separate public v2 Worker and actual HTML served');
let code='',hostToken='';
try{
 const created=await api('create',{variant:'grandprix'});code=created.code;hostToken=created.token;
 const players=[];
 for(let i=0;i<24;i++)players.push(await api('join',{code,name:'Bot '+i}));
 const roster=await api('state',{code,token:hostToken});
 assert.equal(roster.variant,'grandprix');assert.deepEqual(roster.teams.map(t=>t.size),[4,4,4,4,4,4]);
 assert.equal(roster.maxPlayers,24);
 const received=new Set();let stageReceived=0;
 const host=await connect(code,hostToken,m=>{if(m.type==='input'&&Object.values(m.controls||{}).some(Boolean))received.add(m.playerId);});
 const controllers=[];
 for(const p of players)controllers.push(await connect(code,p.token,m=>{if(m.type==='telemetry'&&m.stage==='cake')stageReceived++;}));
 await api('warmup',{code,token:hostToken});
 const warm=await api('state',{code,token:hostToken});assert.equal(warm.phase,'warmup');
 for(let i=0;i<players.length;i++){
  const role=warm.players.find(p=>p.id===players[i].id)?.role;
  const action=GP_ACTIONS[role]?.[0];assert.ok(action,'v2 role has valid actions: '+role);
  controllers[i].send(JSON.stringify({type:'input',seq:1,controls:{[action]:true}}));
 }
 const started=Date.now();while(received.size<24&&Date.now()-started<10000)await wait(60);
 assert.equal(received.size,24,'all 24 independent phone controls reached host during warm-up');
 console.log('PASS: 24 phone controllers, 6 puppets, authenticated live warm-up inputs');
 await api('start',{code,token:hostToken,format:'olympics'});
 const six=Array.from({length:6},(_,id)=>({id,progress:.20,stage:'cake',phase:'upright',beat:.3,unsteady:.12,expectedSide:'left'}));
 host.send(JSON.stringify({type:'telemetry',teams:six}));
 const since=Date.now();while(stageReceived<24&&Date.now()-since<10000)await wait(80);
 assert.equal(stageReceived,24,'all controllers must see event job stage telemetry');
 console.log('PASS: full six-team stage telemetry delivered to 24 controllers');
 await api('end',{code,token:hostToken});
 console.log('PASS: live isolated Grand Prix protocol smoke test');
}catch(e){console.error(e);throw e;}
finally{for(const ws of sockets){try{ws.close();}catch{}}}
