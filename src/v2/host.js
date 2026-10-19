import {GP_EVENTS,gpInputs} from './rules.js';
import {GrandPrixPuppet,GP_DT} from './physics.js';
import {request,snapshot,watchRoom,invite} from './transport.js';
import {renderQr} from '../qr.js';
const $=id=>document.getElementById(id),canvas=$('track'),ctx=canvas.getContext('2d');
const HOST_KEY='gp-host-v2',STATE_KEY='gp-checkpoint-v2';
let room=null,code='',token='',connection=null,connected=false,racers=[],input=new Map(),inputTime=new Map(),acc=0,clock=0,last=0,lastSave=0,lastSend=0,paused=false,ended=false,rounds=[],raceIndex=0,creating=false,starting=false;
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
const api=(path,data={})=>request(path,{code,token,...data});
const alertHost=message=>$('error').textContent=message;
function clearClaim(){localStorage.removeItem(HOST_KEY);localStorage.removeItem(STATE_KEY);}
const stagesForRace=['walk','cake','swing','climb','finale'];
function raceMode(){return GP_EVENTS.find(e=>e.id===room?.mode)||GP_EVENTS[0];}
function prepareRace(){
 const snap=read(STATE_KEY)||room?.checkpoint;
 const usable=snap&&snap.code===code&&snap.mode===room?.mode&&snap.phase===room?.phase&&Date.now()-snap.savedAt<14400000;
 racers=room.teams.map(t=>new GrandPrixPuppet({lane:t.id,color:t.color,name:t.name,mode:room.mode}));
 clock=0;acc=0;ended=false;paused=false;input.clear();inputTime.clear();
 if(usable){clock=snap.clock||0;raceIndex=snap.raceIndex||0;rounds=snap.rounds||[];paused=!!snap.paused;ended=!!snap.ended;
  if(Array.isArray(snap.racers)&&snap.racers.length===racers.length)racers.forEach((p,i)=>{Object.assign(p,snap.racers[i]);p.setInput({});p.prev={...p.input};});
 }
 $('results').hidden=!ended;$('next').hidden=!ended||raceIndex>=4;$('pause').textContent=paused?'▶ RESUME':'⏸ PAUSE';
 $('event-title').textContent=raceMode().icon+' '+raceMode().name;
 $('instructions').textContent=room?.phase==='warmup'?'Press your phone controls and watch the matching puppet limbs light up. Tell the host when your team is ready!':raceMode().instruction;
 if(ended)showResults(false);
}
function saveState(force=false){if(!code||!['warmup','playing'].includes(room?.phase))return;
 const state={code,mode:room.mode,phase:room.phase,clock,raceIndex,rounds,paused,ended,savedAt:Date.now(),racers:racers.map(p=>({x:p.x,elapsed:p.elapsed,finishedAt:p.finishedAt,falls:p.falls,stumbles:p.stumbles,steps:p.steps,wobble:p.wobble,phase:p.phase,recovery:p.recovery,layers:p.layers,hold:p.hold,moving:p.moving,expected:p.expected,lastStep:p.lastStep,lastAction:p.lastAction,_badBoth:p._badBoth,_armDrop:p._armDrop,_invalidReach:p._invalidReach,lastStage:p.lastStage}))};
 localStorage.setItem(STATE_KEY,JSON.stringify(state));
 if(force||Date.now()-lastSave>4000){lastSave=Date.now();void api('checkpoint',{state}).catch(e=>console.warn('Recovery backup delayed',e.message));}
}
function lobby(){
 $('lobby').hidden=['playing','warmup'].includes(room?.phase);$('race').hidden=!['playing','warmup'].includes(room?.phase);
 $('create').hidden=Boolean(code);$('room-info').hidden=!code;$('room-code').textContent=code;
 $('host-phase').textContent=room?.phase==='warmup'?'WARM UP':room?.phase==='playing'?'RACING':room?.phase==='lobby'?'LOBBY':'NO ROOM';
 if(!room)return;
 $('player-count').textContent=room.players.length+' / 24';$('join-link').textContent=invite(code);
 if(room.players.length){try{renderQr($('join-qr'),invite(code));}catch(e){console.warn('QR error',e);}}
 const teams=$('teams');teams.replaceChildren();for(const t of room.teams||[]){const el=document.createElement('div');el.className='gp-team';el.style.setProperty('--team',t.color);
  const label=document.createElement('strong');label.textContent=t.name+' · '+t.size+' PLAYER'+(t.size===1?'':'S');const names=document.createElement('small');names.textContent=room.players.filter(p=>p.teamId===t.id).map(p=>p.name).join(' · ');el.append(label,names);teams.append(el);}
 $('event').value=room.mode||'walk';$('event').disabled=room.phase!=='lobby';
 $('warmup').disabled=room.phase!=='lobby'||room.players.length<1||Boolean(room.warmedUp);
 $('start').disabled=starting||!room.warmedUp&&room.phase!=='warmup';$('start-race').hidden=room.phase!=='warmup';
}
function connect(){connection?.close();connection=watchRoom(code,token,{onConnection(x){connected=x==='connected';$('host-connection').textContent=connected?'● ROOM CONNECTED':'● RECONNECTING · PAUSED';if(!connected){input.clear();inputTime.clear();acc=0;}},onMessage(message){
 if(message.type==='room'){
  const before=room?.phase,oldMode=room?.mode,oldTeam=(room?.teams||[]).map(t=>t.id).join(',');room=message;
  if(['warmup','playing'].includes(room.phase)&&(before!==room.phase||oldMode!==room.mode||!racers.length||oldTeam!==room.teams.map(t=>t.id).join(',')))prepareRace();
  lobby();
 }else if(message.type==='input'){input.set(message.playerId,message.controls||{});inputTime.set(message.playerId,performance.now());}
 }});}
function timeLabel(n){const sec=Math.floor(n);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
function standings(){return [...racers].sort((a,b)=>{
 const aa=a.finishedAt!==null,bb=b.finishedAt!==null;if(aa!==bb)return aa?-1:1;
 return aa?a.finishedAt-b.finishedAt:b.progress-a.progress||a.falls-b.falls;
 }).map((p,i)=>({teamId:p.lane,name:p.name,rank:i+1,points:p.progress<=0?0:[100,80,65,50,40,30][i]||0,finishedAt:p.finishedAt,falls:p.falls,progress:p.progress}));}
function showResults(addRound=true){if(addRound&&!ended){ended=true;const result=standings();if(!rounds.some(r=>r.index===raceIndex))rounds.push({index:raceIndex,mode:room.mode,rankings:result});saveState(true);}const ranked=standings();
 $('results').hidden=false;$('next').hidden=raceIndex>=4;$('results-title').textContent=raceIndex>=4?'🏆 GRAND PRIX CHAMPIONS':'🏁 RACE RESULTS';
 const board=$('podium');board.replaceChildren();for(const s of ranked){const card=document.createElement('div');card.className='gp-podium-card';card.style.setProperty('--team',room.teams.find(t=>t.id===s.teamId)?.color||'#fff');card.textContent=`#${s.rank} ${s.name} · ${s.points} PTS · ${s.finishedAt===null?Math.round(s.progress*100)+'%':s.finishedAt.toFixed(1)+'s'}`;board.append(card);}
 $('race-indicator').textContent='FINISHED';
}
function draw(){const W=canvas.width,H=canvas.height,n=Math.max(1,racers.length),laneHeight=H/n;ctx.clearRect(0,0,W,H);
 const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#72bbdf');bg.addColorStop(1,'#c7e9df');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 for(const [i,p] of racers.entries()){
  const y=i*laneHeight+laneHeight*.71;ctx.fillStyle=i%2?'#5687a120':'#ffffff34';ctx.fillRect(0,i*laneHeight,W,laneHeight);
  ctx.fillStyle='#456174';ctx.fillRect(0,y+5,W,laneHeight*.29);ctx.fillStyle='#9bdfb9';ctx.fillRect(0,y,W,6);
  const px=230+1000*p.progress;
  ctx.strokeStyle='#fff7';ctx.setLineDash([8,9]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(228,y+20);ctx.lineTo(1255,y+20);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#fff7';ctx.fillRect(1230,y-90,7,90);ctx.fillStyle='#283e63';ctx.font=`900 ${Math.max(13,laneHeight*.13)}px system-ui`;ctx.fillText('FINISH',1180,y-97);
  ctx.fillStyle='#192d4bdb';ctx.fillRect(7,i*laneHeight+6,205,Math.min(75,laneHeight*.51));ctx.fillStyle=p.color;ctx.font=`900 ${Math.min(19,laneHeight*.16)}px system-ui`;ctx.fillText(p.name,16,i*laneHeight+Math.min(26,laneHeight*.22));ctx.fillStyle='white';ctx.font=`850 ${Math.min(14,laneHeight*.12)}px system-ui`;ctx.fillText(Math.round(p.progress*100)+'% · '+p.falls+' FALLS',16,i*laneHeight+Math.min(50,laneHeight*.40));
  ctx.save();ctx.translate(px,y);const z=Math.min(.83,Math.max(.38,laneHeight/245));ctx.scale(z,z);ctx.rotate(p.phase==='fallen'?1.06:Math.sin(p.wobble*3)*.06);
  const limb=(a,b,c,d,held,color)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.lineWidth=held?18:14;ctx.lineCap='round';ctx.strokeStyle=held?'#ff666f':color;ctx.stroke();};
  limb(-17,-47,-23+(p.input.leftLeg?-18:0),-2,p.input.leftLeg,'#eeb782');limb(17,-47,23+(p.input.rightLeg?18:0),-2,p.input.rightLeg,'#eeb782');
  ctx.fillStyle=p.color;ctx.beginPath();ctx.roundRect(-28,-123,56,86,20);ctx.fill();
  limb(-23,-102,-53,p.input.leftArm?-118:-63,p.input.leftArm,'#ffd6a3');limb(23,-102,53,p.input.rightArm?-118:-63,p.input.rightArm,'#ffd6a3');
  ctx.beginPath();ctx.arc(0,-146,35,0,Math.PI*2);ctx.fillStyle='#ffe0ae';ctx.fill();
  for(const ex of [-12,12]){ctx.fillStyle='white';ctx.beginPath();ctx.arc(ex,-153,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#242e49';ctx.beginPath();ctx.arc(ex,-153,3,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#8a4054';ctx.beginPath();ctx.ellipse(0,-132,p.phase==='fallen'?9:6,p.phase==='fallen'?13:5,0,0,Math.PI*2);ctx.fill();
  if(p.stage==='cake'){ctx.fillStyle='#f8e3a8';ctx.fillRect(-42,-119,84,9);ctx.fillStyle='#ff94b9';for(let layer=0;layer<p.layers;layer++)ctx.fillRect(-24+layer*4,-130-layer*12,48-layer*8,11);}
  if(p.stage==='swing'){ctx.strokeStyle='#fff';ctx.lineWidth=3;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*53,-115);ctx.lineTo(side*60,-260);ctx.stroke();}}
  ctx.restore();
  ctx.fillStyle='#142d4c';ctx.fillRect(10,y+15,200,9);ctx.fillStyle=p.color;ctx.fillRect(10,y+15,200*p.progress,9);
  if(p.finishedAt!==null){ctx.fillStyle='#203850';ctx.font='900 17px system-ui';ctx.fillText('🏁 FINISHED!',1040,i*laneHeight+30);}
 }
 // A shared one-second pulse makes the rhythm visible without penalizing misses.
 const beat=(clock%1),pulse=1-Math.min(beat,1-beat)*1.8;ctx.fillStyle=`rgba(255,223,122,${Math.max(.2,pulse)})`;ctx.beginPath();ctx.arc(W-40,40,13+17*pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#142944';ctx.font='900 16px system-ui';ctx.fillText('BEAT',W-65,80);
}
async function sendTelemetry(){if(!['warmup','playing'].includes(room?.phase))return;
 const teams=racers.map(p=>({id:p.lane,progress:p.progress,stage:p.stage,beat:p.beat,unsteady:p.wobble,phase:paused?'paused':p.phase,expectedSide:p.expected}));
 if(connection?.send({type:'telemetry',teams}))return;try{await api('telemetry',{teams});}catch{}
}
function frame(now){if(!last)last=now;const dt=Math.min(.08,(now-last)/1000);last=now;
 if(['warmup','playing'].includes(room?.phase)&&connected&&!paused&&!ended){
  acc=Math.min(.12,acc+dt);let ticks=0;
  while(acc>=GP_DT&&ticks++<7){for(const p of racers){const players=room.players.filter(x=>x.teamId===p.lane).map(x=>({...x,controls:x.online&&now-(inputTime.get(x.id)||0)<1700?input.get(x.id)||{}:{}}));p.setInput(gpInputs(players));p.update(GP_DT);}if(room.phase==='playing')clock+=GP_DT;else clock+=GP_DT;acc-=GP_DT;}
  if(room.phase==='playing'&&(racers.every(p=>p.finishedAt!==null)||clock>=raceMode().seconds))showResults();
  if(now-lastSend>350){lastSend=now;void sendTelemetry();}
  if(now-lastSave>2000)saveState();
 }
 if(['warmup','playing'].includes(room?.phase)){draw();$('timer').textContent=timeLabel(clock);$('race-indicator').textContent=paused?'PAUSED':room.phase==='warmup'?'WARM UP':ended?'FINISHED':'RACING';}
 requestAnimationFrame(frame);
}
$('create').addEventListener('click',async()=>{if(creating||code)return;creating=true;$('create').disabled=true;
 try{const result=await request('create',{variant:'grandprix'});code=result.code;token=result.token;localStorage.setItem(HOST_KEY,JSON.stringify({code,token,savedAt:Date.now()}));room=await snapshot(code,token);lobby();connect();alertHost('');}catch(e){alertHost(e.message);}finally{creating=false;$('create').disabled=Boolean(code);}});
$('event').addEventListener('change',async()=>{try{await api('mode',{mode:$('event').value});}catch(e){alertHost(e.message);}});
$('warmup').addEventListener('click',async()=>{try{await api('warmup');}catch(e){alertHost(e.message);}});
async function startRace(){if(starting||!room)return;starting=true;try{if(room.phase!=='warmup'&&!room.warmedUp)throw Error('Warm up first');await api('start',{format:'olympics'});alertHost('');}catch(e){alertHost(e.message);}finally{starting=false;}}
$('start').addEventListener('click',startRace);
$('start-race').addEventListener('click',startRace);
$('next').addEventListener('click',async()=>{if(!ended||raceIndex>=4)return;$('next').disabled=true;try{
 const desired=stagesForRace[raceIndex+1];let state=await snapshot(code,token);if(state.phase==='playing'){await api('reset');state=await snapshot(code,token);}if(state.mode!==desired)await api('mode',{mode:desired});raceIndex++;localStorage.removeItem(STATE_KEY);await api('start',{format:'olympics'});
 }catch(e){alertHost(e.message);}finally{$('next').disabled=false;}});
$('pause').addEventListener('click',()=>{paused=!paused;acc=0;input.clear();inputTime.clear();$('pause').textContent=paused?'▶ RESUME':'⏸ PAUSE';saveState(true);});
$('recover-link').addEventListener('click',async()=>{const u=new URL('./grand-prix.html',location.href);u.hash='reclaim='+code+':'+token;try{await navigator.clipboard.writeText(u.toString());alertHost('Recovery link copied. Keep it private.');}catch{alertHost('Clipboard unavailable. Use the same host browser to recover.');}});
async function endParty(){if(!code||!confirm('END PARTY? This closes the room for all phones. Everyone will need a NEW code.'))return;
 try{await api('end');connection?.close();connection=null;code='';token='';room=null;racers=[];rounds=[];ended=false;clearClaim();lobby();alertHost('Party ended. Create another room to play again.');}catch(e){alertHost(e.message);}}
$('end-lobby').addEventListener('click',endParty);$('end-race').addEventListener('click',endParty);
$('back').addEventListener('click',async()=>{if(!confirm('Cancel this Grand Prix tournament and return everyone to the same lobby?'))return;try{await api('reset',{finishTournament:true});racers=[];rounds=[];raceIndex=0;localStorage.removeItem(STATE_KEY);}catch(e){alertHost(e.message);}});
const claim=/^#reclaim=([A-F0-9]{6}):([a-f0-9]{48})$/.exec(location.hash);
if(claim){localStorage.setItem(HOST_KEY,JSON.stringify({code:claim[1],token:claim[2],savedAt:Date.now()}));history.replaceState(null,'',location.pathname+location.search);}
const remembered=read(HOST_KEY);if(remembered?.code&&remembered?.token&&Date.now()-remembered.savedAt<14400000){
 code=remembered.code;token=remembered.token;snapshot(code,token).then(result=>{room=result;raceIndex=read(STATE_KEY)?.raceIndex||result.checkpoint?.raceIndex||0;rounds=read(STATE_KEY)?.rounds||result.checkpoint?.rounds||[];if(['warmup','playing'].includes(room.phase))prepareRace();lobby();connect();}).catch(()=>{code='';token='';clearClaim();lobby();});
}
requestAnimationFrame(frame);