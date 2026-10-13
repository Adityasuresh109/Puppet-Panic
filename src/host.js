import {Puppet,STEP,TRACK_LENGTH} from './physics.js';
import {puppetInputs,ROLE_NAMES,allocateTeams} from './teams.js';
import {request,snapshot,watchRoom,partyLink,configured} from './transport.js';
import {renderQr} from './qr.js';
const $=id=>document.getElementById(id);
let code='',token='',source=null,room=null,puppets=[],inputs=new Map(),inputSeen=new Map(),last=0,acc=0,lastTelemetry=0,elapsed=0,finished=false;
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
const api=(path,body={})=>request(path,{code,token,...body});
function setError(message){$('host-error').textContent=message;}
function renderLobby(){
 $('host-setup').hidden=room?.phase==='playing';$('host-game').hidden=room?.phase!=='playing';
 $('room-panel').hidden=!code; $('room-code').textContent=code;
 $('join-link').textContent=partyLink(code);
 if(code)try{renderQr($('join-qr'),partyLink(code));}catch(e){console.warn('QR unavailable',e);}$('player-count').textContent=`${room?.players?.length||0} / 25`;
 $('host-status').textContent=room?.phase==='playing'?'LIVE · GAME IN PROGRESS':'LOBBY · JOINING';
 $('host-mode').value=room?.mode||'walk';$('start-match').disabled=(room?.players?.length||0)<2;
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
 puppets=(room.teams||[]).map(t=>new Puppet({color:t.color,name:t.name,mode:room.mode,lane:t.id}));
 elapsed=0;acc=0;finished=false;inputs.clear();inputSeen.clear();
 $('round-name').textContent=room.mode==='cake'?"DON'T DROP THE CAKE!":"WALK, YOU IDIOTS!";
 $('game-summary').textContent='Every player has a station. Lift, counter-swing and lean together!';
}
function connect(){if(source)source.close();if(!code||!token)return;
 source=watchRoom(code,token,{
  onMessage(data){
   if(data.type==='room'){
    const wasPlaying=room?.phase==='playing';const originalIds=(room?.teams||[]).map(x=>x.id).join(',');room=data;
    if(room.phase==='playing'&&(!wasPlaying||originalIds!==room.teams.map(x=>x.id).join(',')))initGame();
    renderLobby();
   }else if(data.type==='input'){inputs.set(data.playerId,data.controls||{});inputSeen.set(data.playerId,performance.now());}
  },
  onConnection(status){$('host-status').textContent=status==='connected'?'ROOM CONNECTED':status==='connecting'?'CONNECTING TO ROOM...':'RECONNECTING TO ROOM...';}
 });
}
$('create-room').addEventListener('click',async()=>{
 try{setError('');const result=await api('create');code=result.code;token=result.token;
  sessionStorage.setItem('puppet-host',JSON.stringify({code,token}));
  room=await snapshot(code,token);renderLobby();connect();
 }catch(e){setError(e.message);}
});
$('host-mode').addEventListener('change',async ev=>{try{await api('mode',{mode:ev.target.value});}catch(e){setError(e.message);}});
$('start-match').addEventListener('click',async()=>{try{await api('start');}catch(e){setError(e.message);}});
$('return-lobby').addEventListener('click',async()=>{if(confirm('Return everyone to lobby and reset this round?'))try{await api('reset');}catch(e){alert(e.message);}});
let remembered;try{remembered=JSON.parse(sessionStorage.getItem('puppet-host')||'null');}catch{}
if(remembered){code=remembered.code;token=remembered.token;snapshot(code,token).then(r=>{room=r;renderLobby();connect();}).catch(()=>{sessionStorage.removeItem('puppet-host');code='';token='';});}

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
 if(p.mode==='cake'){rounded(-45,-99,90,10,4,'#f5e9c7');for(let i=0;i<p.layers;i++)rounded(-30+i*6,-115-i*15,60-i*12,16,5,['#ff99bb','#fbdd93','#9cecd8'][i]);}
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
  ctx.fillStyle='#93b9b0';ctx.fillRect(0,trackY,1280,7);ctx.fillStyle='#465a7c';ctx.fillRect(0,trackY+7,1280,laneHeight-(trackY-y)-7);
  for(const hazard of [680,1230,1660]){const hx=285+850*(hazard-115)/(TRACK_LENGTH-115);ctx.fillStyle='#ee644d';ctx.beginPath();ctx.moveTo(hx,trackY-21);ctx.lineTo(hx-15,trackY);ctx.lineTo(hx+15,trackY);ctx.fill();}
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
 if(room?.phase==='playing'&&!finished){acc=Math.min(.12,acc+dt);let ticks=0;
  while(acc>=STEP&&ticks<7){for(const [i,p] of puppets.entries()){
    const members=room.players.filter(q=>q.teamId===room.teams[i].id).map(q=>({...q,controls:performance.now()-(inputSeen.get(q.id)||0)<1600?inputs.get(q.id)||{}:{}}));
    p.setInput(puppetInputs(members,room.mode));p.update(STEP);
   }elapsed+=STEP;acc-=STEP;ticks++;
  }
  const time=Math.floor(elapsed);$('clock').textContent=`${String(Math.floor(time/60)).padStart(2,'0')}:${String(time%60).padStart(2,'0')}`;
  if(ts-lastTelemetry>400){lastTelemetry=ts;sendTelemetry();}
  if(puppets.every(p=>p.phase==='finished')||elapsed>200){finished=true;$('game-summary').textContent='ROUND COMPLETE! '+puppets.slice().sort((a,b)=>b.progress-a.progress).map(p=>`${p.name}: ${Math.round(p.progress*100)}%`).join(' | ');}
 }
 if(!($('host-game').hidden))drawTV();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Public UI-only TV previews: real join/control still needs the room relay.
const previewNumber=Number(new URL(location.href).searchParams.get('preview'));
if(Number.isInteger(previewNumber)&&previewNumber>=2&&previewNumber<=25){
 room={phase:'playing',mode:'walk',teams:allocateTeams(previewNumber),players:[]};
 initGame();renderLobby();$('host-status').textContent='TV PREVIEW · NO ROOM CONNECTED';
 $('game-summary').textContent=`TV PREVIEW: ${previewNumber} players → ${room.teams.map(t=>t.size).join(' + ')} controllers. Live multiplayer requires the room server.`;
}