import {GP_ACTIONS,GP_ROLE_NAMES,gpJob,gpStage,GP_EVENTS} from './rules.js';
import {request,snapshot,watchRoom} from './transport.js';
const $=id=>document.getElementById(id),params=new URL(location.href).searchParams;
const previewRole=(params.get('preview')||'').toUpperCase();
const preview=Boolean(GP_ACTIONS[previewRole]);
let code='',token='',room=null,stream=null,controls={},seq=0,joining=false,stage='',lastMode='',jobTimeout=null,activePointers=new Map(),offline=true;
const api=(path,data={})=>request(path,{code,token,...data});
function btnEnable(){const name=$('name').value.trim(),roomCode=$('code').value.trim().toUpperCase();$('join-button').disabled=joining||!name||!/^[A-F0-9]{6}$/.test(roomCode);}
$('join-form').addEventListener('input',btnEnable);
function send(){if(preview||!room||!['warmup','playing'].includes(room.phase)||room.hostOnline===false)return;
 const packet={type:'input',seq:++seq,controls:{...controls}};
 if(stream?.send(packet))return;
 void api('input',packet).catch(()=>{$('connect-status').textContent='● RECONNECTING';});
}
function releaseAll(){const touched=Object.values(controls).some(Boolean);controls={};activePointers.clear();document.querySelectorAll('.gp-pad-buttons button').forEach(btn=>{btn.classList.remove('holding');btn.setAttribute('aria-pressed','false');});for(const k of Object.keys(GP_ACTIONS).flatMap(r=>GP_ACTIONS[r]))$('limb-'+k)?.classList.remove('pressed');if(touched)send();}
window.addEventListener('blur',releaseAll);window.addEventListener('pagehide',releaseAll);
setInterval(()=>{if(!preview&&Object.values(controls).some(Boolean))send();},650);
function setControl(limb,value){if(controls[limb]===value)return;controls[limb]=value;const mark=$('limb-'+limb);mark?.classList.toggle('pressed',value);for(const btn of document.querySelectorAll('[data-limb]'))if(btn.dataset.limb===limb){btn.classList.toggle('holding',value);btn.setAttribute('aria-pressed',String(value));}send();}
function makeControls(role){const limbs=GP_ACTIONS[role]||[],target=$('buttons');target.replaceChildren();target.className='gp-pad-buttons'+(limbs.length===1?' single':'')+(limbs.length===3?' three':'');
 for(const limb of ['leftLeg','rightLeg','leftArm','rightArm'])$('limb-'+limb).classList.toggle('owned',limbs.includes(limb));
 for(const limb of limbs){const button=document.createElement('button');button.type='button';button.dataset.limb=limb;button.setAttribute('aria-pressed','false');const label=limb.startsWith('left')?'LEFT':'RIGHT',foot=limb.endsWith('Leg');
  const emoji=document.createElement('span');emoji.textContent=foot?'🦵':'💪';const title=document.createElement('strong');title.textContent=label+' '+(foot?'LEG':'ARM');const hint=document.createElement('small');hint.textContent='HOLD · RELEASE';button.append(emoji,title,hint);
  button.addEventListener('pointerdown',e=>{if(offline||!['playing','warmup'].includes(room?.phase))return;e.preventDefault();button.setPointerCapture(e.pointerId);activePointers.set(e.pointerId,limb);setControl(limb,true);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{if(activePointers.get(e.pointerId)!==limb)return;activePointers.delete(e.pointerId);setControl(limb,false);});
  button.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat&&!offline){e.preventDefault();setControl(limb,true);}});
  button.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();setControl(limb,false);}});
  button.addEventListener('blur',()=>{if(controls[limb])setControl(limb,false);});
  target.append(button);
 }
}
function selectedPlayer(){return room?.players?.find(p=>p.id===room.you?.id);}
function banner(text){clearTimeout(jobTimeout);$('new-job').textContent='NEW JOB: '+text;$('new-job').hidden=false;jobTimeout=setTimeout(()=>$('new-job').hidden=true,3000);}
function updateJob(nextStage,notify=false){const player=selectedPlayer();if(!player)return;
 stage=nextStage;const sentences=(GP_ACTIONS[player.role]||[]).map(limb=>gpJob(limb,stage));const job=sentences.join(' · ');
 $('job').textContent=job||'LOOK AT THE TV';if(notify)banner(job);
 const footnotes={climb:'THREE HOLD · ONE REACHES',walk:'STEP LEFT / RIGHT · KEEP THE BEAT',cake:'ARMS UP · WALK SMOOTHLY',swing:'GRIP BOTH ARMS · PUMP LEGS'};
 $('cue').textContent=room.phase==='warmup'?'PRACTICE YOUR BUTTONS · TELL HOST WHEN READY':footnotes[stage]||'LOOK AT THE TV';
}
function render(){const p=selectedPlayer();if(!p)return;
 $('join').hidden=true;$('pad').hidden=false;$('team').textContent=p.teamName||'TEAM';$('role').textContent=GP_ROLE_NAMES[p.role]||'YOUR ROLE';$('room-tag').textContent=code;
 const canInput=['playing','warmup'].includes(room.phase)&&room.hostOnline!==false&&!offline;$('pad').classList.toggle('gp-offline',!canInput);
 $('event-name').textContent=(room.phase==='warmup'?'🎓 WARM UP · ':'')+(GP_EVENTS.find(e=>e.id===room.mode)?.name||'GRAND PRIX');
 if($('buttons').dataset.role!==p.role){releaseAll();$('buttons').dataset.role=p.role;makeControls(p.role);}
 const next=room.phase==='warmup'?room.mode:stage||room.mode;
 if(lastMode!==room.mode||next!==stage){lastMode=room.mode;updateJob(next,room.phase==='playing');}
 if(!canInput)$('cue').textContent=room.hostOnline===false?'HOST IS OFFLINE · YOUR PLACE IS SAVED':room.phase==='lobby'?'WAIT FOR THE HOST TO START':'RECONNECTING';
}
function openStream(){stream?.close();stream=watchRoom(code,token,{onConnection(x){offline=x!=='connected';$('connect-status').textContent=x==='connected'?'● CONNECTED':x==='connecting'?'● CONNECTING':'● RECONNECTING';if(offline)releaseAll();if(room)render();},onMessage(m){
 if(m.type==='room'){const previous=selectedPlayer()?.role,mode=room?.mode;room=m;if(previous&&previous!==selectedPlayer()?.role)releaseAll();if(mode!==room.mode)stage='';if(room.hostOnline===false)releaseAll();render();}
 if(m.type==='telemetry'){const next=m.stage||gpStage(m.mode||room?.mode,m.progress||0);if(next&&next!==stage){updateJob(next,room?.phase==='playing');}if(m.phase==='fallen')$('cue').textContent='WHOOPS! BACK UP IN A SECOND';}
 if(m.type==='ended'||m.type==='kicked'){releaseAll();stream?.close();stream=null;room=null;token='';$('join').hidden=false;$('pad').hidden=true;$('join-error').textContent=m.type==='ended'?'HOST ENDED THE PARTY. ASK FOR A NEW CODE.':'HOST REMOVED THIS PLAYER.';}
 }});}
$('join-form').addEventListener('submit',async e=>{e.preventDefault();if(joining)return;joining=true;btnEnable();code=$('code').value.trim().toUpperCase();const name=$('name').value.trim();try{
 const savedKey='gp-phone-'+code;const saved=JSON.parse(localStorage.getItem(savedKey)||'null');const previous=saved&&Date.now()-saved.savedAt<14400000?saved.token:null;
 const response=await api('join',{name,token:previous});token=response.token;localStorage.setItem(savedKey,JSON.stringify({token,name,savedAt:Date.now()}));
 room=await snapshot(code,token);render();openStream();
 }catch(e){$('join-error').textContent=e.message;}finally{joining=false;btnEnable();}});
if(params.get('room'))$('code').value=params.get('room').toUpperCase();
if(preview){code='DEMO00';token='';offline=false;room={phase:'warmup',variant:'grandprix',hostOnline:true,mode:GP_EVENTS.some(e=>e.id===params.get('mode'))?params.get('mode'):'walk',players:[{id:'preview',role:previewRole,teamName:'BLUE BLUNDERS'}],you:{id:'preview'}};render();$('connect-status').textContent='● UI DEMO';}
btnEnable();