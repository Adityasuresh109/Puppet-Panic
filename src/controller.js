import {ACTIONS,ROLE_NAMES} from './teams.js';
import {eventById} from './events.js';
import {request,snapshot,watchRoom,configured} from './transport.js';
const $=id=>document.getElementById(id);
const params=new URL(location.href).searchParams;
const prefill=params.get('room');if(prefill)$('join-code').value=prefill.toUpperCase();
let code='',token='',room=null,source=null,seq=0,controls={},activePointers=new Map(),lastTelemetry=null,joining=false;
const previewRole=(params.get('preview')||'').toUpperCase();
const isPreview=Boolean(ACTIONS[previewRole]);
const api=(path,data={})=>request(path,{code,token,...data});
function message(s){$('join-error').textContent=s;}
function assigned(){return room?.players?.find(p=>p.id===room?.you?.id);}
function updateMode(){const p=assigned();if(!p)return;
 $('join-screen').hidden=true;$('role-screen').hidden=false;
 $('role-screen').classList.toggle('waiting',room.phase!=='playing'||room.hostOnline===false);
 $('team-indicator').style.background=p.teamColor||'#7f90ab';$('team-name').textContent=p.teamName||'TEAM FORMING';$('role-label').textContent=ROLE_NAMES[p.role]||'WAITING FOR TEAM';
 $('room-footer').textContent=`ROOM ${code}`;
 $('scenario').textContent=room.phase==='lobby'?'LOBBY · TEAMS MAY CHANGE':`${eventById(room.mode)?.icon||'🎭'} ${eventById(room.mode)?.name||'PUPPET PANIC'}`;
 $('cue').textContent=!p.role?'NEED 2 PLAYERS':room.hostOnline===false?'HOST OFFLINE · WAITING':room.phase!=='playing'?'WAIT FOR HOST':lastTelemetry?cueText(p,lastTelemetry):'WATCH THE TV';
 const wanted=ACTIONS[p.role]||[];
 if($('pad-area').dataset.role!==p.role||$('pad-area').dataset.mode!==room.mode){
  releaseAll();$('pad-area').dataset.role=p.role;$('pad-area').dataset.mode=room.mode;
  buildPad(wanted,p.role,room.mode);
 }
 const tips={DUAL_LEGS:'ALTERNATE LEFT / RIGHT FEET · RELEASE TO STEP',LEFT_LEG:'HOLD TO LIFT · RELEASE AS TEAM LEANS RIGHT',RIGHT_LEG:'HOLD TO LIFT · RELEASE AS TEAM LEANS LEFT',LEFT_ARM:'COUNTER-SWING WHEN RIGHT LEG LIFTS',RIGHT_ARM:'COUNTER-SWING WHEN LEFT LEG LIFTS',BALANCE:'LEAN TOWARD THE FOOT STAYING ON THE GROUND',UPPER_BODY:'YOU CONTROL BOTH UPPER ARMS + WEIGHT SHIFT',DUAL_ARMS:'SWING OPPOSITE THE ACTIVE LEG'};
 $('phone-hint').textContent=room.hostOnline===false?'THE HOST DISCONNECTED · YOUR PLACE IS SAVED':room.phase==='playing'?'THUMBS ON BUTTONS · EYES ON TV':tips[p.role]||'WAIT FOR YOUR ROLE';
}
function cueText(p,t){if(t.phase==='paused')return 'HOST PAUSED · WAIT FOR TEAMMATE';if(t.phase==='finished')return 'YOU FINISHED!';if(t.phase==='fallen')return 'FACEPLANT! RECOVER!';if(t.unsteady>.68)return 'DANGER! STEADY!';if((room.mode==='cake'||room.mode==='finale'&&t.progress>.33&&t.progress<.67)&&(p.role.includes('ARM')||p.role==='UPPER_BODY'))return 'KEEP THE CAKE LEVEL!';if(room.mode==='swing')return 'GRIP ROPE + PUMP IN RHYTHM!';if(room.mode==='climb')return 'SECURE HANDHOLD + STEP!';return `${(t.expectedSide||'left').toUpperCase()} FOOT NEXT`;
}
function button(text,emoji,action,color,wide=false,hint='HOLD • RELEASE'){
 const b=document.createElement('button');b.type='button';b.className=`pad-button ${color}${wide?' wide':''}`;b.dataset.action=action;
 const ico=document.createElement('span');ico.textContent=emoji;const label=document.createElement('strong');label.textContent=text;const foot=document.createElement('small');foot.textContent=hint;b.append(ico,label,foot);
 b.addEventListener('pointerdown',e=>{if(room?.phase!=='playing'||room?.hostOnline===false)return;e.preventDefault();b.setPointerCapture(e.pointerId);activePointers.set(e.pointerId,action);setControl(action,true);b.classList.add('pressed');});
 const end=e=>{if(!activePointers.has(e.pointerId))return;e.preventDefault();activePointers.delete(e.pointerId);setControl(action,false);b.classList.remove('pressed');};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,end);
 b.setAttribute('aria-pressed','false');
 b.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat&&room?.phase==='playing'&&room.hostOnline!==false){e.preventDefault();setControl(action,true);b.classList.add('pressed');}});
 b.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();setControl(action,false);b.classList.remove('pressed');}});
 b.addEventListener('blur',()=>{if(controls[action]){setControl(action,false);b.classList.remove('pressed');}});
 b.addEventListener('contextmenu',e=>e.preventDefault());return b;
}
function buildPad(actions,role,mode){const pad=$('pad-area');pad.replaceChildren();pad.className='pad-area '+(actions.length===2?'grid-two':actions.length>=3?'grid-three':'');
 const configs={leftLeg:['LEFT STEP','🦵','amber'],rightLeg:['RIGHT STEP','🦵','orange'],leftArm:[['cake','swing','finale'].includes(mode)?'LEFT GRIP':'SWING LEFT','💪','blue'],rightArm:[['cake','swing','finale'].includes(mode)?'RIGHT GRIP':'SWING RIGHT','💪','purple'],leanLeft:['LEAN LEFT','⬅','green'],leanRight:['LEAN RIGHT','➡','green'],brace:['BRACE','⚡','red'],grip:['GRIP BOTH','🎂','purple']};
 for(const a of actions){const [label,emoji,color]=configs[a];const wide=actions.length===3&&a===actions[2];pad.append(button(label,emoji,a,color,wide,a==='brace'?'USE WHEN WOBBLY':a==='grip'?'HOLD BOTH HANDS':'HOLD • RELEASE'));}
}
function setControl(key,value){if(controls[key]===value)return;controls[key]=value;
  document.querySelectorAll('.pad-button').forEach(b=>{if(b.dataset.action===key)b.setAttribute('aria-pressed',String(value));});
  if(isPreview)return;sendInput();}
let inFlight=0;
async function sendInput(){if(!room||room.phase!=='playing'||room.hostOnline===false)return;const current=++seq;const payload={type:'input',seq:current,controls:{...controls}};
 if(source?.send(payload))return;try{await api('input',payload);}catch(e){$('connection').textContent='● RECONNECTING';$('connection').classList.add('offline');}}
function releaseAll(){const changed=Object.values(controls).some(Boolean);controls={};activePointers.clear();document.querySelectorAll('.pad-button.pressed').forEach(b=>b.classList.remove('pressed'));if(changed)sendInput();}
window.addEventListener('blur',releaseAll);window.addEventListener('pagehide',releaseAll);
// Keep long-held inputs alive and let server clear stale controls on disconnect.
setInterval(()=>{if(room?.phase==='playing'&&Object.values(controls).some(Boolean))sendInput();},650);
function openStream(){if(source)source.close();source=watchRoom(code,token,{
  onConnection(state){$('connection').textContent=state==='connected'?'● CONNECTED':state==='connecting'?'● CONNECTING':'● RECONNECTING';$('connection').classList.toggle('offline',state!=='connected');if(state!=='connected')releaseAll();},
  onMessage(data){
   if(data.type==='room'){const prevRole=assigned()?.role;const oldMode=room?.mode;room=data;if(oldMode!==room.mode)lastTelemetry=null;if(room.hostOnline===false)releaseAll();if(prevRole&&prevRole!==assigned()?.role)releaseAll();updateMode();}
   if(data.type==='kicked'){releaseAll();source?.close();source=null;room=null;token='';$('role-screen').hidden=true;$('join-screen').hidden=false;message('The host removed this player from the lobby.');return;}
   if(data.type==='ended'){releaseAll();source?.close();source=null;room=null;token='';$('role-screen').hidden=true;$('join-screen').hidden=false;message('The host ended this party. Ask for the new room code.');return;}
   if(data.type==='telemetry'){lastTelemetry=data;const p=assigned();if(p)$('cue').textContent=cueText(p,data);}
  }
 });}
$('join-form').addEventListener('submit',async ev=>{
 ev.preventDefault();if(joining)return;joining=true;const submit=$('join-form').querySelector('[type="submit"]');if(submit)submit.disabled=true;try{code=$('join-code').value.trim().toUpperCase();const name=$('join-name').value.trim();if(!/^[A-Z0-9]{6}$/.test(code))throw Error('Enter the six-character room code');
  const savedKey=`pp-player-${code}`;let previous;try{previous=JSON.parse(localStorage.getItem(savedKey)||'null');}catch{}
  const j=await api('join',{name,token:previous&&Date.now()-previous.savedAt<4*60*60*1000?previous.token:undefined});token=j.token;localStorage.setItem(savedKey,JSON.stringify({token,name,savedAt:Date.now()}));
  room=await snapshot(code,token);updateMode();openStream();
 }catch(e){message(e.message);}finally{joining=false;if(submit)submit.disabled=false;}
});
if(isPreview){
 code='DEMO00';token='';room={phase:'playing',mode:eventById(params.get('mode'))?params.get('mode'):'walk',players:[{id:'preview',teamColor:'#58a7fa',teamName:'BLUE BONKERS',role:previewRole}],you:{id:'preview'},teams:[{id:0,size:5}]};
 updateMode();$('scenario').textContent='CONTROLLER PREVIEW · NOT CONNECTED';$('cue').textContent='LOOK AT THE TV';$('connection').textContent='● UI DEMO';$('connection').classList.add('offline');$('phone-hint').textContent='PREVIEW ONLY · NO LIVE ROOM';
}
if(prefill){const saved=sessionStorage.getItem(`pp-player-${prefill.toUpperCase()}`);if(saved){try{const p=JSON.parse(saved);$('join-name').value=p.name||'';}catch{}}}