import {Puppet,STEP,TRACK_LENGTH,hazardsFor} from './physics.js';
import {puppetInputs,ROLE_NAMES,allocateTeams} from './teams.js';
import {request,snapshot,watchRoom,partyLink,configured,RELAY} from './transport.js';
import {renderQr} from './qr.js';
import {EVENTS,eventById,eventStandings,tallyTournament,secondsText} from './events.js';
import {callFor,beep} from './announcer.js';
const $=id=>document.getElementById(id);
let code='',token='',source=null,room=null,puppets=[],inputs=new Map(),inputSeen=new Map(),last=0,acc=0,lastTelemetry=0,elapsed=0,finished=false,sessionFormat='olympics',rounds=[],eventIndex=0,finalResults=[],pendingEventIndex=null,creating=false,starting=false,hostConnected=false;
const HOST_KEY='puppet-host', GAME_KEY='puppet-game-state';
const claim=/^#reclaim=([A-F0-9]{6}):([a-f0-9]{48})$/.exec(location.hash);
if(claim){
 try{localStorage.setItem(HOST_KEY,JSON.stringify({code:claim[1],token:claim[2],savedAt:Date.now()}));history.replaceState(null,'',location.pathname+location.search);}catch{}
}
function getSaved(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function clearSaved(){localStorage.removeItem(HOST_KEY);localStorage.removeItem(GAME_KEY);sessionStorage.removeItem(HOST_KEY);sessionStorage.removeItem(GAME_KEY);}
function checkpoint(){const s=getSaved(GAME_KEY);return s?.code===code&&Date.now()-s.savedAt<4*60*60*1000?s:null;}
if(!configured()){
 $('relay-setup').hidden=false;
 setTimeout(()=>setError('Connect the public room server to create an online multiplayer party. Local demo previews remain available.'),50);
}
$('connect-relay').addEventListener('click',()=>{
 try{const u=new URL($('relay-address').value.trim());if(u.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(u.hostname)&&u.protocol==='http:'))throw Error('Use an HTTPS server address');
 if(u.username||u.password||u.pathname!=='/'&&u.pathname!==''||u.search||u.hash)throw Error('Paste only the server origin (no path or secrets)');
 const url=new URL(location.href);url.searchParams.set('relay',u.origin);location.assign(url.toString());
 }catch(e){setError(e.message||'Invalid server URL');}
});
const canvas=$('tv-canvas'),ctx=canvas.getContext('2d');
let lastComedy=0,comedyText='',muted=false;
$('sound-toggle').addEventListener('click',()=>{muted=!muted;$('sound-toggle').textContent=muted?'🔇 SOUND OFF':'🔊 SOUND ON';});
const api=(path,body={})=>request(path,{code,token,...body});
function setError(message){$('host-error').textContent=message;}
async function checkRelayHealth(){
 const target=(RELAY||'')+'/health';
 try{
  const res=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(4500)});
  if(!res.ok||!(await res.json()).ok)throw Error('Unhealthy response');
  $('server-health').textContent='● PARTY SERVER ONLINE';$('server-health').style.color='#77e4bf';
 }catch{
  $('server-health').textContent='● PARTY SERVER UNAVAILABLE · Retry later, or run the local LAN host from npm run dev if Cloudflare is down.';
  $('server-health').style.color='#ffc18b';
  setError('The room server may be unavailable. Your party cannot start until it reconnects.');
 }
}
void checkRelayHealth();

function renderLobby(){
 $('host-setup').hidden=room?.phase==='playing';$('host-game').hidden=room?.phase!=='playing';$('create-room').hidden=Boolean(code);
 $('room-panel').hidden=!code; $('room-code').textContent=code;
 $('join-link').textContent=partyLink(code);
 if(code)try{renderQr($('join-qr'),partyLink(code));}catch(e){console.warn('QR unavailable',e);}$('player-count').textContent=`${room?.players?.length||0} / 25`;
 $('host-status').textContent=room?.phase==='playing'?'LIVE · GAME IN PROGRESS':'LOBBY · JOINING';
 $('host-mode').value=room?.mode||'walk';$('start-match').disabled=starting||(room?.players?.length||0)<2;
 $('host-format').value=sessionFormat;$('host-mode').disabled=sessionFormat==='olympics';
 const panel=$('team-preview');panel.replaceChildren();
 if(!room?.teams?.length){const placeholder=document.createElement('p');placeholder.textContent='Invite at least 2 players to create your first puppet.';panel.append(placeholder);}
 for(const team of room?.teams||[]){
  const box=document.createElement('div');box.className='team-box';box.style.setProperty('--team',team.color);
  const title=document.createElement('strong');title.textContent=team.name;
  const quantity=document.createElement('div');quantity.className='big';quantity.textContent=`${team.size} PLAYER${team.size===1?'':'S'}`;
  const list=document.createElement('div');list.className='team-players';
  for(const p of room.players.filter(x=>x.teamId===team.id)){const chip=document.createElement('span');chip.title=ROLE_NAMES[p.role];chip.textContent=p.name;list.append(chip);}
  box.append(title,quantity,list);panel.append(box);
 }
}
function initGame(){
 const event=eventById(room.mode)||EVENTS[0];
 puppets=(room.teams||[]).map(t=>new Puppet({color:t.color,name:t.name,mode:event.id,lane:t.id}));
 elapsed=0;acc=0;finished=false;inputs.clear();inputSeen.clear();
 const saved=checkpoint();
 if(saved){sessionFormat=saved.sessionFormat||'olympics';rounds=Array.isArray(saved.rounds)?saved.rounds:[];eventIndex=saved.eventIndex||0;pendingEventIndex=saved.pendingEventIndex??null;finalResults=saved.finalResults||[];}
 if(saved?.mode===room.mode&&saved.puppets?.length===puppets.length){
   elapsed=saved.elapsed;
   puppets.forEach((p,i)=>{Object.assign(p,saved.puppets[i]);p.setInput({leftLeg:false,rightLeg:false,leftArm:false,rightArm:false,lean:0,brace:false});p.prev={...p.input};});
 }
 $('round-results').hidden=true;$('next-event').hidden=false;$('tv-canvas').hidden=false;
 $('round-name').textContent=`${event.icon} ${event.name}`;
 $('event-counter').textContent=sessionFormat==='olympics'?`EVENT ${eventIndex+1} OF ${EVENTS.length}`:'QUICK CHALLENGE';
 $('game-summary').textContent=event.instruction;
 if(saved?.mode===room.mode&&saved.resultsShown){finished=true;renderResults();}
}
function saveHostState(){
 if(!code||room?.phase!=='playing')return;
 try{localStorage.setItem(GAME_KEY,JSON.stringify({code,mode:room.mode,elapsed,savedAt:Date.now(),puppets,rounds,eventIndex,sessionFormat,pendingEventIndex,resultsShown:finished,finalResults}));}
 catch(e){console.warn('Could not save match checkpoint',e);}
}
function renderResults(){
 const event=eventById(room.mode)||EVENTS[0];
 const total=tallyTournament(rounds),hasNext=sessionFormat==='olympics'&&eventIndex+1<EVENTS.length;
 const final=!hasNext&&sessionFormat==='olympics';
 $('result-title').textContent=final?'🏆 PUPPET OLYMPICS CHAMPIONS':`🏁 ${event.name} · RESULTS`;
 const cards=$('result-standings');cards.replaceChildren();
 for(const [index,s] of (final?total:finalResults).entries()){
  const item=document.createElement('div');item.className='result-team';item.style.setProperty('--team',room.teams.find(t=>t.id===s.teamId)?.color||'#fff');
  const a=document.createElement('b');a.textContent=`${final?index+1:s.rank} PLACE · ${s.name}`;
  const b=document.createElement('strong');b.textContent=`${s.points} PTS`;
  const c=document.createElement('small');c.textContent=final?`${s.wins} event wins · ${s.falls} falls`:`${Math.round(s.progress*100)}% completed · ${s.falls} falls · +${s.quality} bonus`;
  item.append(a,b,c);cards.append(item);
 }
 $('round-results').hidden=false;$('tv-canvas').hidden=true;$('next-event').hidden=!hasNext;
 $('game-summary').textContent=final?'THE PUPPET OLYMPICS HAVE A CHAMPION!':hasNext?'EVENT COMPLETE · NEXT EVENT READY':'CHALLENGE COMPLETE!';
}
function showResults(){
 if(finished)return;finished=true;
 const event=eventById(room.mode)||EVENTS[0];
 finalResults=eventStandings(puppets,elapsed,event.seconds);
 if(!rounds.some(r=>r.eventIndex===eventIndex && r.event===room.mode))rounds.push({event:room.mode,eventIndex,standings:finalResults});
 renderResults();saveHostState();
}

function connect(){if(source)source.close();if(!code||!token)return;
 source=watchRoom(code,token,{
  onMessage(data){
   if(data.type==='room'){
    const wasPlaying=room?.phase==='playing';const originalIds=(room?.teams||[]).map(x=>x.id).join(',');room=data;
    if(room.phase==='playing'&&(!wasPlaying||!puppets.length||originalIds!==room.teams.map(x=>x.id).join(',')))initGame();
    renderLobby();
   }else if(data.type==='input'){inputs.set(data.playerId,data.controls||{});inputSeen.set(data.playerId,performance.now());}
  },
  onConnection(status){hostConnected=status==='connected';$('host-status').textContent=hostConnected?'ROOM CONNECTED':status==='connecting'?'CONNECTING TO ROOM...':'CONNECTION LOST · GAME PAUSED';if(!hostConnected){inputs.clear();inputSeen.clear();acc=0;}}
 });
}
$('create-room').addEventListener('click',async()=>{
 if(creating||code)return;creating=true;$('create-room').disabled=true;
 try{setError('');const result=await api('create');code=result.code;token=result.token;
  localStorage.setItem(HOST_KEY,JSON.stringify({code,token,savedAt:Date.now()}));
  room=await snapshot(code,token);renderLobby();connect();
 }catch(e){setError(e.message);}
 finally{creating=false;if(!code)$('create-room').disabled=false;}
});
$('copy-recovery').addEventListener('click',async()=>{
 if(!code||!token)return;
 const url=new URL('./play.html',location.href);
 url.hash='reclaim='+code+':'+token;
 try{await navigator.clipboard.writeText(url.toString());setError('Private recovery link copied. Save it somewhere safe; do not share it with guests.');}
 catch{setError('Copy unavailable. Use the same host browser to recover this party.');}
});
$('host-mode').addEventListener('change',async ev=>{try{await api('mode',{mode:ev.target.value});}catch(e){setError(e.message);}});
$('host-format').addEventListener('change',()=>{sessionFormat=$('host-format').value;$('host-mode').disabled=sessionFormat==='olympics';});
$('start-match').addEventListener('click',async()=>{
 if(starting||room?.phase!=='lobby')return;starting=true;$('start-match').disabled=true;
 try{
  sessionFormat=$('host-format').value;rounds=[];eventIndex=0;pendingEventIndex=null;finalResults=[];localStorage.removeItem(GAME_KEY);
  if(sessionFormat==='olympics'&&room.mode!==EVENTS[0].id)await api('mode',{mode:EVENTS[0].id});
  beep('checkpoint',muted);await api('start',{format:sessionFormat});
 }catch(e){setError(e.message);}
 finally{starting=false;renderLobby();}
});
$('next-event').addEventListener('click',async()=>{
 if(sessionFormat!=='olympics'||eventIndex>=EVENTS.length-1)return;
 $('next-event').disabled=true;pendingEventIndex??=eventIndex+1;saveHostState();
 try{
  const target=EVENTS[pendingEventIndex].id;
  let state=await snapshot(code,token);
  if(state.phase==='playing'&&state.mode!==target){await api('reset');state=await snapshot(code,token);}
  if(state.phase==='lobby'&&state.mode!==target)await api('mode',{mode:target});
  eventIndex=pendingEventIndex;
  if(state.phase!=='playing')await api('start',{format:sessionFormat});
  pendingEventIndex=null;localStorage.removeItem(GAME_KEY);
  $('next-event').disabled=false;
 }catch(e){$('next-event').disabled=false;setError('Event transition interrupted. Click Next Event to retry safely. '+e.message);}
});
async function endSession(){
 if(!code)return;if(!confirm('End the entire party? Everyone will need a new room code.'))return;
 try{await api('end');source?.close();source=null;hostConnected=false;clearSaved();code='';token='';room=null;puppets=[];rounds=[];eventIndex=0;finished=false;
  $('host-setup').hidden=false;$('host-game').hidden=true;renderLobby();setError('Party ended. Create a new room when ready.');
 }catch(e){setError('Unable to end party: '+e.message);}
}
$('finish-session').addEventListener('click',endSession);
$('end-party').addEventListener('click',endSession);
$('return-lobby').addEventListener('click',async()=>{
 if(confirm('Cancel this tournament and return to lobby?'))try{
  localStorage.removeItem(GAME_KEY);rounds=[];eventIndex=0;pendingEventIndex=null;finished=false;
  await api('reset',{finishTournament:true});
 }catch(e){alert(e.message);}
});
const remembered=getSaved(HOST_KEY)||(()=>{try{return JSON.parse(sessionStorage.getItem(HOST_KEY)||'null');}catch{return null;}})();
if(remembered?.code&&remembered?.token&&(!remembered.savedAt||Date.now()-remembered.savedAt<4*60*60*1000)){
 code=remembered.code;token=remembered.token;
 snapshot(code,token).then(r=>{
  room=r;localStorage.setItem(HOST_KEY,JSON.stringify({code,token,savedAt:Date.now()}));
  if(room.phase==='playing')initGame();
  else{const cp=checkpoint();if(cp){sessionFormat=cp.sessionFormat||'olympics';rounds=cp.rounds||[];eventIndex=cp.eventIndex||0;pendingEventIndex=cp.pendingEventIndex??null;}}
  renderLobby();connect();
 }).catch(()=>{clearSaved();code='';token='';room=null;renderLobby();});
}

const pick=(n,d=1)=>Math.max(0,Math.min(d,n));
function rounded(x,y,w,h,r,col){ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function part(x1,y1,x2,y2,width,color){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineWidth=width+4;ctx.lineCap='round';ctx.strokeStyle='#26334c';ctx.stroke();ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
function drawPuppet(p,x,y,scale){
 const falling=p.phase==='fallen',roll=falling?Math.sin(p.time*12)*.9+.8:p.tilt*.75;
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.rotate(roll);
 ctx.fillStyle='#0002';ctx.beginPath();ctx.ellipse(0,9,52,10,0,0,Math.PI*2);ctx.fill();
 const legs=[[-14,-32,p.legs.left.raised?[-29,-4]:[-22,0],p.input.leftLeg],[14,-32,p.legs.right.raised?[35,-5]:[22,0],p.input.rightLeg]];
 for(const [hx,hy,[fx,fy],active] of legs){part(hx,hy,fx,fy-5,13,active?'#ffa359':'#f5c381');rounded(fx-12,fy-9,29,13,6,active?'#fd7187':'#8469f9');}
 for(const side of ['left','right']){
  const s=side==='left'?-1:1,active=p.input[side+'Arm'];const ex=s*(active?55:45),ey=active?-77:-42;
  part(s*20,-86,ex,ey,12,'#f7cc94');ctx.beginPath();ctx.fillStyle='#fff3bc';ctx.arc(ex,ey,11,0,Math.PI*2);ctx.fill();
 }
 rounded(-24,-105,48,75,18,p.color);
 ctx.beginPath();ctx.fillStyle='#272f4d';ctx.arc(0,-132,38,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.fillStyle='#ffe0a2';ctx.arc(0,-136,35,0,Math.PI*2);ctx.fill();
 for(const s of [-1,1]){ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(s*13,-143,9,11,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#25334e';ctx.beginPath();ctx.arc(s*13,-143,4,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='#7d3655';ctx.beginPath();ctx.ellipse(0,-121,falling?10:8,falling?12:5,0,0,Math.PI*2);ctx.fill();
 if(p.activeMode==='cake'){rounded(-45,-99,90,10,4,'#f5e9c7');for(let i=0;i<p.layers;i++)rounded(-30+i*6,-115-i*15,60-i*12,16,5,['#ff99bb','#fbdd93','#9cecd8'][i]);}
 ctx.restore();
}
function drawTV(){
 const W=1280,H=720;ctx.clearRect(0,0,W,H);
 const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#81c5f4');g.addColorStop(1,'#d8f5e7');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 const n=Math.max(1,puppets.length),laneHeight=H/n;
 for(const [i,p] of puppets.entries()){
  const y=i*laneHeight,trackY=y+laneHeight*.83;
  ctx.fillStyle=i%2===0?'#fff2':'#3c5e7e18';ctx.fillRect(0,y,W,laneHeight);
  rounded(0,y+8,245,Math.min(72,laneHeight*.48),9,'#173154d9');ctx.fillStyle=p.color;ctx.font=`900 ${Math.min(19,laneHeight*.20)}px system-ui`;ctx.fillText(p.name,18,y+Math.min(29,laneHeight*.23));
  ctx.fillStyle='#fff';ctx.font=`800 ${Math.min(15,laneHeight*.16)}px system-ui`;ctx.fillText(`${Math.round(p.progress*100)}% · ${p.falls} FALLS · ${p.steps} STEPS`,18,y+Math.min(53,laneHeight*.42));
  const mode=p.activeMode;
  if(mode==='climb'){
    ctx.strokeStyle='#5e85b2';ctx.lineWidth=7;
    for(const lx of [330,365,1100,1135]){ctx.beginPath();ctx.moveTo(lx,y+laneHeight*.18);ctx.lineTo(lx,trackY);ctx.stroke();}
    for(let rung=0;rung<5;rung++){ctx.fillStyle='#c9eaf2';ctx.fillRect(340,y+laneHeight*.23+rung*laneHeight*.11,750,4);}
  }else if(mode==='swing'){
    for(const rx of [600,930,1180]){ctx.strokeStyle='#a279df';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(rx,y);ctx.lineTo(rx,trackY-18);ctx.stroke();ctx.beginPath();ctx.fillStyle='#f3ca64';ctx.arc(rx,trackY-12,12,0,Math.PI*2);ctx.fill();}
  }else if(mode==='cake'){ctx.fillStyle='#fff0c9';ctx.font='900 15px system-ui';ctx.fillText(`🍰 ${p.layers} LAYERS`,Math.min(1200,850),y+26);}
  ctx.fillStyle='#93b9b0';ctx.fillRect(0,trackY,1280,7);ctx.fillStyle='#465a7c';ctx.fillRect(0,trackY+7,1280,laneHeight-(trackY-y)-7);
  for(const hazard of hazardsFor(mode){const hx=285+850*(hazard-115)/(TRACK_LENGTH-115);ctx.fillStyle='#ee644d';ctx.beginPath();ctx.moveTo(hx,trackY-21);ctx.lineTo(hx-15,trackY);ctx.lineTo(hx+15,trackY);ctx.fill();}
  const fx=1145;ctx.fillStyle='#ffe29e';ctx.fillRect(fx,trackY-80,7,81);ctx.fillStyle='#fff';ctx.font='800 13px system-ui';ctx.fillText('FINISH',fx-22,trackY-84);
  const px=285+850*p.progress;
  drawPuppet(p,px,trackY,Math.max(.34,Math.min(.79,laneHeight/230)));
  rounded(8,trackY+14,225,8,4,'#233d5e');rounded(8,trackY+14,225*p.progress,8,4,p.color);
  if(p.phase==='finished'){rounded(fx+15,trackY-70,98,26,8,'#e2b04a');ctx.font='900 15px system-ui';ctx.fillStyle='#192b49';ctx.fillText('FINISHED!',fx+20,trackY-52);}
 }
}
async function sendTelemetry(){if(!room||room.phase!=='playing')return;
 const teams=puppets.map((p,i)=>({id:room.teams[i].id,progress:p.progress,expectedSide:p.expectedSide,unsteady:p.unsteady,phase:p.phase}));
 if(source?.send({type:'telemetry',teams}))return;try{await api('telemetry',{teams});}catch{}
}
function frame(ts){if(!last)last=ts;const dt=Math.min(.07,(ts-last)/1000);last=ts;
 if(room?.phase==='playing'&&!finished&&hostConnected){acc=Math.min(.12,acc+dt);let ticks=0;
  while(acc>=STEP&&ticks<7){for(const [i,p] of puppets.entries()){
    const members=room.players.filter(q=>q.teamId===room.teams[i].id).map(q=>({...q,controls:q.online && performance.now()-(inputSeen.get(q.id)||0)<1600?inputs.get(q.id)||{}:{}}));
    p.setInput(puppetInputs(members,p.activeMode));p.update(STEP);
    const notable=p.events.at(-1);
    if(notable&&notable.id>(p.lastAnnounced||0)){p.lastAnnounced=notable.id;
      if(['fall','cakeDrop','finish','checkpoint','stage'].includes(notable.type)&&ts-lastComedy>1250){
        comedyText=callFor(notable,p.name);lastComedy=ts;beep(notable.type,muted);
      }
    }
   }elapsed+=STEP;acc-=STEP;ticks++;
  }
  const time=Math.floor(elapsed);$('clock').textContent=`${String(Math.floor(time/60)).padStart(2,'0')}:${String(time%60).padStart(2,'0')}`;
  if(ts-lastTelemetry>400){lastTelemetry=ts;sendTelemetry();}
  const current=eventById(room.mode)||EVENTS[0];if(puppets.every(p=>p.phase==='finished')||elapsed>=current.seconds)showResults();
 }
 if(room?.phase==='playing' && !finished && hostConnected && (Math.floor(ts/1000)!==Math.floor((ts-dt*1000)/1000)))saveHostState();
 if(!($('host-game').hidden)){drawTV();if(comedyText&&ts-lastComedy<2400){rounded(350,12,580,48,12,'#162b52ee');ctx.fillStyle='#ffe6a4';ctx.font='900 22px system-ui';ctx.textAlign='center';ctx.fillText(comedyText.slice(0,53),640,43);ctx.textAlign='start';}}requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Public UI-only TV previews: real join/control still needs the room relay.
const previewNumber=Number(new URL(location.href).searchParams.get('preview'));
if(Number.isInteger(previewNumber)&&previewNumber>=2&&previewNumber<=25){
 room={phase:'playing',mode:'walk',teams:allocateTeams(previewNumber),players:[]};
 initGame();renderLobby();$('host-status').textContent='TV PREVIEW · NO ROOM CONNECTED';
 $('game-summary').textContent=`TV PREVIEW: ${previewNumber} players → ${room.teams.map(t=>t.size).join(' + ')} controllers. Live multiplayer requires the room server.`;
}