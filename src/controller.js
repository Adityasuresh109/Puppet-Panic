import {ACTIONS,ROLE_NAMES} from './teams.js';
const $=id=>document.getElementById(id);
const params=new URL(location.href).searchParams;
const prefill=params.get('room');if(prefill)$('join-code').value=prefill.toUpperCase();
let code='',token='',room=null,source=null,seq=0,controls={},activePointers=new Map(),lastTelemetry=null;
const previewRole=(params.get('preview')||'').toUpperCase();
const isPreview=Boolean(ACTIONS[previewRole]);
const api=async(path,data={})=>{const res=await fetch('/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,token,...data})});let body;try{body=await res.json();}catch{throw Error('No multiplayer relay is running at this address yet. Host a local LAN session with npm run dev.');}if(!res.ok)throw Error(body.error||'Could not connect');return body;};
function message(s){$('join-error').textContent=s;}
function assigned(){return room?.players?.find(p=>p.id===room?.you?.id);}
function updateMode(){const p=assigned();if(!p)return;
 $('join-screen').hidden=true;$('role-screen').hidden=false;
 $('role-screen').classList.toggle('waiting',room.phase!=='playing');
 $('team-indicator').style.background=p.teamColor||'#7f90ab';$('team-name').textContent=p.teamName||'TEAM FORMING';$('role-label').textContent=ROLE_NAMES[p.role]||'WAITING FOR TEAM';
 $('room-footer').textContent=`ROOM ${code}`;
 $('scenario').textContent=room.phase==='lobby'?'LOBBY · TEAMS MAY CHANGE':room.mode==='cake'?'🎂 CAKE CARRY':'🚶 WALK CHALLENGE';
 $('cue').textContent=!p.role?'NEED 2 PLAYERS':room.phase!=='playing'?'WAIT FOR HOST':lastTelemetry?cueText(p,lastTelemetry):'WATCH THE TV';
 const wanted=ACTIONS[p.role]||[];
 if($('pad-area').dataset.role!==p.role||$('pad-area').dataset.mode!==room.mode){
  releaseAll();$('pad-area').dataset.role=p.role;$('pad-area').dataset.mode=room.mode;
  buildPad(wanted,p.role,room.mode);
 }
 $('phone-hint').textContent=room.phase==='playing'?'THUMBS ON BUTTONS · EYES ON TV':'YOUR ROLE LOCKS WHEN THE HOST STARTS';
}
function cueText(p,t){if(t.phase==='finished')return 'YOU FINISHED!';if(t.phase==='fallen')return 'FACEPLANT! RECOVER!';if(t.unsteady>.68)return 'DANGER! STEADY!';if(room.mode==='cake'&&(p.role.includes('ARM')||p.role==='UPPER_BODY'))return 'KEEP THE CAKE LEVEL!';return `${(t.expectedSide||'left').toUpperCase()} FOOT NEXT`;
}
function button(text,emoji,action,color,wide=false,hint='HOLD • RELEASE'){
 const b=document.createElement('button');b.type='button';b.className=`pad-button ${color}${wide?' wide':''}`;b.dataset.action=action;
 const ico=document.createElement('span');ico.textContent=emoji;const label=document.createElement('strong');label.textContent=text;const foot=document.createElement('small');foot.textContent=hint;b.append(ico,label,foot);
 b.addEventListener('pointerdown',e=>{if(room?.phase!=='playing')return;e.preventDefault();b.setPointerCapture(e.pointerId);activePointers.set(e.pointerId,action);setControl(action,true);b.classList.add('pressed');});
 const end=e=>{if(!activePointers.has(e.pointerId))return;e.preventDefault();activePointers.delete(e.pointerId);setControl(action,false);b.classList.remove('pressed');};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,end);
 b.addEventListener('contextmenu',e=>e.preventDefault());return b;
}
function buildPad(actions,role,mode){const pad=$('pad-area');pad.replaceChildren();pad.className='pad-area '+(actions.length===2?'grid-two':actions.length>=3?'grid-three':'');
 const configs={leftLeg:['LEFT STEP','🦵','amber'],rightLeg:['RIGHT STEP','🦵','orange'],leftArm:[mode==='cake'?'LEFT GRIP':'SWING LEFT','💪','blue'],rightArm:[mode==='cake'?'RIGHT GRIP':'SWING RIGHT','💪','purple'],leanLeft:['LEAN LEFT','⬅','green'],leanRight:['LEAN RIGHT','➡','green'],brace:['BRACE','⚡','red'],grip:['GRIP BOTH','🎂','purple']};
 for(const a of actions){const [label,emoji,color]=configs[a];const wide=actions.length===3&&a===actions[2];pad.append(button(label,emoji,a,color,wide,a==='brace'?'USE WHEN WOBBLY':a==='grip'?'HOLD BOTH HANDS':'HOLD • RELEASE'));}
}
function setControl(key,value){if(controls[key]===value)return;controls[key]=value;if(isPreview)return;sendInput();}
let inFlight=0;
async function sendInput(){if(!room||room.phase!=='playing')return;const current=++seq;const payload={seq:current,controls:{...controls}};
 try{await api('input',payload);}catch(e){$('connection').textContent='● RECONNECTING';$('connection').classList.add('offline');}}
function releaseAll(){const changed=Object.values(controls).some(Boolean);controls={};activePointers.clear();document.querySelectorAll('.pad-button.pressed').forEach(b=>b.classList.remove('pressed'));if(changed)sendInput();}
window.addEventListener('blur',releaseAll);window.addEventListener('pagehide',releaseAll);
// Keep long-held inputs alive and let server clear stale controls on disconnect.
setInterval(()=>{if(room?.phase==='playing'&&Object.values(controls).some(Boolean))sendInput();},650);
function openStream(){if(source)source.close();source=new EventSource(`/api/events?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);
 source.addEventListener('open',()=>{$('connection').textContent='● CONNECTED';$('connection').classList.remove('offline');});
 source.addEventListener('error',()=>{$('connection').textContent='● RECONNECTING';$('connection').classList.add('offline');releaseAll();});
 source.addEventListener('message',e=>{const data=JSON.parse(e.data);
  if(data.type==='room'){const prevRole=assigned()?.role;room=data;if(prevRole&&prevRole!==assigned()?.role)releaseAll();updateMode();}
  if(data.type==='telemetry'){lastTelemetry=data;const p=assigned();if(p)$('cue').textContent=cueText(p,data);}
 });
}
$('join-form').addEventListener('submit',async ev=>{
 ev.preventDefault();try{code=$('join-code').value.trim().toUpperCase();const name=$('join-name').value.trim();if(!/^[A-Z0-9]{6}$/.test(code))throw Error('Enter the six-character room code');
  const savedKey=`pp-player-${code}`;let previous;try{previous=JSON.parse(sessionStorage.getItem(savedKey)||'null');}catch{}
  const j=await api('join',{name,token:previous?.token});token=j.token;sessionStorage.setItem(savedKey,JSON.stringify({token,name}));
  const res=await fetch(`/api/state?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);room=await res.json();updateMode();openStream();
 }catch(e){message(e.message);}
});
if(isPreview){
 code='DEMO00';token='';room={phase:'playing',mode:params.get('mode')==='cake'?'cake':'walk',players:[{id:'preview',teamColor:'#58a7fa',teamName:'BLUE BONKERS',role:previewRole}],you:{id:'preview'},teams:[{id:0,size:5}]};
 updateMode();$('scenario').textContent='CONTROLLER PREVIEW · NOT CONNECTED';$('cue').textContent='LOOK AT THE TV';$('connection').textContent='● UI DEMO';$('connection').classList.add('offline');$('phone-hint').textContent='PREVIEW ONLY · NO LIVE ROOM';
}
if(prefill){const saved=sessionStorage.getItem(`pp-player-${prefill.toUpperCase()}`);if(saved){try{const p=JSON.parse(saved);$('join-name').value=p.name||'';}catch{}}}