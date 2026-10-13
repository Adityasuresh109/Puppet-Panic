import { Puppet, STEP, TRACK_LENGTH, CHECKPOINTS } from './physics.js';
import { Sound } from './audio.js';

const $ = id => document.getElementById(id);
const canvas = $('game'); const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const puppet = new Puppet({ color:'#ffc24c',name:'BONGO' });
const sound = new Sound();
let started=false, demo=false, clock=0, lastFrame=0, acc=0, lastEventId=0;
let demoCycle=-1, demoSide='left';
let lastToastAt=-10, toastUntil=0, scoreShown=false;
const held = {leftLeg:false,rightLeg:false,leftArm:false,rightArm:false,brace:false,leanLeft:false,leanRight:false};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let bits=[];
const quotes={step:['NICE LEGS!','ONE FOOT AT A TIME!','GREAT. THAT WAS A STEP.'],fall:['ABSOLUTELY NOT!','BONGO HAS LEFT THE CHAT.','FACE FIRST. CLASSIC.','GRAVITY: 1 · BONGO: 0'],checkpoint:['YOU ACTUALLY DID IT!','A MIRACLE!','CHECKPOINT, BABY!'],bonk:['WATCH OUT!','THAT HAD TO HURT.'],recover:['BACK FROM THE DEAD!','BONGO LIVES!'],finish:['THE IMPOSSIBLE HAS HAPPENED!'],brace:['CORE STRENGTH!'],swing:['WAVE THOSE NOODLES!']};
const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function confetti(x,y,count=16){if(reducedMotion)return;for(let i=0;i<count;i++)bits.push({x,y,vx:rnd(-170,170),vy:rnd(-340,-100),life:rnd(.5,1.5),t:0,c:['#ffcc43','#fb7a94','#70e4db','#9ca7ff','#fff'][i%5],r:rnd(3,7)});}
function toast(str,sec=1.5){$('toast').textContent=str;$('toast').classList.add('show');toastUntil=clock+sec;}
function handleEvents(){
 for(const ev of puppet.events){if(ev.id<=lastEventId)continue;lastEventId=ev.id;
   if(['fall','checkpoint','bonk','finish','recover','cakeDrop','slip'].includes(ev.type)) sound.play(ev.type);
   else if(ev.type==='step'&&Math.random()<.3)sound.play('step');
   if(ev.type==='fall') {confetti(590,410,12);toast(quotes.fall[Math.floor(Math.random()*quotes.fall.length)]);}
   if(ev.type==='slip') {
     const reasons={'wrong-foot':'WRONG FOOT! SWITCH LEGS!','bad-timing':'BAD TIMING! HOLD FOR A BEAT!','no-support':'BOTH FEET UP?!','weight-transfer':'BODY DID NOT SHIFT WEIGHT!','arm-sync':'ARM TEAM OUT OF SYNC!','cake-grip':'HOLD THE CAKE WITH BOTH ARMS!'};
     toast(reasons[ev.reason]||'WRONG MOVE! TRY TO COORDINATE!',1.1);
   }
   if(ev.type==='cakeDrop'){confetti(620,320,16);toast(ev.layers?`CAKE LOST A LAYER! ${ev.layers} LEFT!`:'THE CAKE IS DESTROYED!',2);}
   if(ev.type==='checkpoint') {confetti(620,190,32);toast('CHECKPOINT SAVED!');}
   if(ev.type==='bonk') toast('BONK! YOU HIT THE OBSTACLE!',.8);
   if(ev.type==='finish') {confetti(720,200,100);toast('THE TEAM DID IT!',3);}
 }
}
function updateControls(){
 puppet.setInput({leftLeg:held.leftLeg,rightLeg:held.rightLeg,leftArm:held.leftArm,rightArm:held.rightArm,brace:held.brace,lean:Number(held.leanRight)-Number(held.leanLeft)});
}
function setHeld(action,down){
 if(!(action in held))return;
 if(demo){demo=false;$('demo').classList.remove('active');$('demo').textContent='▶ WATCH TEAMWORK DEMO';}
 held[action]=down;
 document.querySelectorAll(`[data-action="${action}"]`).forEach(el=>el.classList.toggle('pressed',down));
 updateControls();
}
const mappings={KeyA:'leftLeg',KeyD:'rightLeg',KeyJ:'leftArm',KeyK:'rightArm',ArrowLeft:'leanLeft',ArrowRight:'leanRight',Space:'brace'};
window.addEventListener('keydown',e=>{
 if(e.code==='KeyH'){if(!$('instructions').open)$('instructions').showModal();return;}
 if(e.code==='KeyR'){reset();return;}
 const action=mappings[e.code];if(!action || $('instructions').open)return;
 e.preventDefault();if(!held[action])setHeld(action,true);
});
window.addEventListener('keyup',e=>{const action=mappings[e.code];if(action){e.preventDefault();setHeld(action,false);}});
window.addEventListener('blur',()=>{for(const key of Object.keys(held))held[key]=false;updateControls();document.querySelectorAll('.pad-btn').forEach(el=>el.classList.remove('pressed'));});
for(const button of document.querySelectorAll('[data-action]')){
 const action=button.dataset.action;
 button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);setHeld(action,true);});
 for(const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name,e=>{e.preventDefault();setHeld(action,false);});
 button.addEventListener('contextmenu',e=>e.preventDefault());
}
$('start').addEventListener('click',start);
$('reset').addEventListener('click',reset);
for(const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click',()=>{
    puppet.setMode(button.dataset.mode);
    reset(false);
    document.querySelectorAll('[data-mode]').forEach(el=>el.classList.toggle('active',el.dataset.mode===puppet.mode));
    $('mode-description').textContent=puppet.mode==='cake'
      ? 'CAKE RUN · Both arm players must GRIP. Alternate legs with correct weight shifts. Drop your hands or tip the tray and lose layers.'
      : 'WALK · LEFT foot needs RIGHT arm + RIGHT lean; RIGHT foot needs LEFT arm + LEFT lean. Bad timing causes slips and faceplants.';
    $('intro-challenge').textContent=puppet.mode==='cake'?'DON\'T DROP THE CAKE!':'WALK, YOU IDIOTS!';
    document.querySelector('.left-arm p').textContent=puppet.mode==='cake'?'Hold to support the left side of the cake':'Counter-swing during the right-foot step';
    document.querySelector('.right-arm p').textContent=puppet.mode==='cake'?'Hold to support the right side of the cake':'Counter-swing during the left-foot step';
  });
}
$('help').addEventListener('click',()=>$('instructions').showModal());
$('close-help').addEventListener('click',()=>$('instructions').close());
$('instructions').addEventListener('click',e=>{if(e.target===$('instructions'))$('instructions').close();});
$('sound').addEventListener('click',()=>{sound.enabled=!sound.enabled;$('sound').textContent=sound.enabled?'♪ ON':'♪ OFF';});
$('demo').addEventListener('click',()=>{
 if(!started)start();
 if(puppet.phase==='finished')reset();
 demo=!demo; $('demo').classList.toggle('active',demo);$('demo').textContent=demo?'◼ STOP AI DEMO':'▶ WATCH TEAMWORK DEMO';
 if(!demo){Object.keys(held).forEach(key=>held[key]=false);updateControls();document.querySelectorAll('.pad-btn').forEach(el=>el.classList.remove('pressed'));}
});
function start(){started=true;scoreShown=false;$('overlay').hidden=true;}
function reset(wipePhysics=true){if(wipePhysics)puppet.reset();Object.keys(held).forEach(k=>held[k]=false);updateControls();started=true;scoreShown=false;demo=false;clock=0;lastEventId=0;demoCycle=-1;bits=[];$('overlay').hidden=true;$('demo').textContent='▶ WATCH TEAMWORK DEMO';$('demo').classList.remove('active');}
function demoInput(){
 const cycle=Math.floor(puppet.time/.57);
 if(cycle!==demoCycle){demoCycle=cycle;demoSide=puppet.expectedSide;}
 const within=puppet.time% .57;
 const isLeft=demoSide==='left';
 // Demonstrate a real coordinated team: support leg remains down, arm counter-swings,
 // torso shifts toward supporting foot, and moving foot plants after 0.35 seconds.
 puppet.setInput({
   leftLeg:isLeft&&within<.35,rightLeg:!isLeft&&within<.35,
   leftArm:puppet.mode==='cake'||!isLeft,rightArm:puppet.mode==='cake'||isLeft,
   lean:isLeft?1:-1,
   brace:false
 });
}
function drawBackground(cam){
 const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#6eabeb');sky.addColorStop(.7,'#b5e6fa');sky.addColorStop(1,'#e2f6ed');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.translate(-cam*.18,0);
 for(let i=-2;i<35;i++) {const bx=i*142+45;ctx.fillStyle=['#b2d9e6','#aed9d5','#bbdce6'][Math.abs(i)%3];const bh=100+Math.sin(i*3.43)*60;ctx.fillRect(bx,362-bh,91,bh+170);ctx.fillStyle='#e5f7f7';for(let w=0;w<3;w++)for(let h=0;h<3;h++)ctx.fillRect(bx+15+w*24,375-bh+h*28,11,12);}
 ctx.restore();
 ctx.save();ctx.translate(-cam*.34,0);
 for(let i=-1;i<29;i++){let x=i*180+55;ctx.fillStyle=i%2?'#76a78e':'#8eb69a';ctx.beginPath();ctx.arc(x,424,53,Math.PI,0);ctx.fill();ctx.fillRect(x-55,424,110,60);}
 ctx.restore();
 // Confetti bunting, fixed as part of track world.
 ctx.save();ctx.translate(-cam,0);
 for(let i=0;i<16;i++){
  const x=i*185-50;ctx.strokeStyle='#ffffffab';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,95);ctx.quadraticCurveTo(x+110,121,x+205,100);ctx.stroke();
  for(let j=0;j<5;j++){ctx.fillStyle=['#ffd458','#f27789','#70dfd8','#a091f6'][j%4];ctx.beginPath();const px=x+j*39+10;ctx.moveTo(px,100+Math.sin(j)*6);ctx.lineTo(px+25,100+Math.sin(j)*6);ctx.lineTo(px+12,126+Math.sin(j)*6);ctx.fill();}
 }
 ctx.restore();
}
function roundedRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function drawTrack(cam){
 const gy=510;
 ctx.fillStyle='#85c6a5';ctx.fillRect(0,gy-12,W,120);
 ctx.fillStyle='#3f506a';ctx.fillRect(0,gy+16,W,103);
 ctx.fillStyle='#556880';ctx.fillRect(0,gy+20,W,20);
 ctx.fillStyle='#f6fbdf';for(let i=-3;i<50;i++){const x=i*100-cam%100;ctx.fillRect(x,gy+62,51,5);}
 ctx.fillStyle='#fff';ctx.fillRect(0,gy-3,W,13);
 ctx.save();ctx.translate(-cam,0);
 for(let i=0;i<TRACK_LENGTH+200;i+=110){ctx.fillStyle='#cee6df';ctx.fillRect(i,gy-8,3,7);}
 for(const [k,cp] of CHECKPOINTS.entries()){
  ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cp,gy-4);ctx.lineTo(cp,gy-142);ctx.stroke();
  roundedRect(cp-46,gy-160,94,32,9,['#f897ad','#97d9fc','#aab2fa'][k]);
  ctx.textAlign='center';ctx.font='900 15px system-ui';ctx.fillStyle='#172c42';ctx.fillText(`SAVE ${k+1}`,cp,gy-139);
  ctx.fillStyle='#ffde64';ctx.beginPath();ctx.arc(cp,gy-3,10,0,Math.PI*2);ctx.fill();
 }
 for(const x of [680,1230,1660]){
  ctx.fillStyle='#fa694e';ctx.beginPath();ctx.moveTo(x,gy-44);ctx.lineTo(x-21,gy);ctx.lineTo(x+21,gy);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff1cf';ctx.fillRect(x-11,gy-17,22,7);ctx.fillStyle='#e05638';ctx.fillRect(x-23,gy-4,46,8);
 }
 const finishX=TRACK_LENGTH;
 ctx.fillStyle='#243654';ctx.fillRect(finishX-3,gy-218,9,226);
 for(let y=gy-218;y<gy;y+=18)for(let a=0;a<2;a++){ctx.fillStyle=((y/18+a)|0)%2===0?'#fff':'#283550';ctx.fillRect(finishX+a*16,y,16,18);}
 roundedRect(finishX-85,gy-247,167,38,8,'#ffbe41');ctx.textAlign='center';ctx.font='900 23px system-ui';ctx.fillStyle='#1b2942';ctx.fillText('FINISH!',finishX,gy-219);
 ctx.restore();
}
function jointLine(ax,ay,bx,by,thick,color,stroke='#35304c'){
 ctx.lineCap='round';ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.strokeStyle=stroke;ctx.lineWidth=thick+7;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=thick;ctx.stroke();
}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function drawPuppet(p,cam){
 const gy=510,scale=1.64;
 const x=p.x-cam, base=gy-6;
 const c=p.color, dark='#33415c';
 // Grounded shadow expands when Bongo collapses.
 ctx.save();ctx.globalAlpha=.19;ellipse(x,gy+7,p.phase==='fallen'?72:46,10,'#152840');ctx.restore();
 ctx.save();ctx.translate(x,base);ctx.scale(scale,scale);
 const collapsed=p.phase==='fallen';
 const angle=collapsed?p.tilt+(p.fallTimer<.6?.5:0):p.tilt*.65;
 // Rig transforms make hip, torso, shoulders and head share angular motion.
 const rot=(rx,ry)=>({x:rx*Math.cos(angle)-ry*Math.sin(angle),y:rx*Math.sin(angle)+ry*Math.cos(angle)});
 const hip=rot(0,-45), shoulders=rot(0,-93),head=rot(0,-126);
 const pelvis={x:hip.x,y:hip.y},sh={x:shoulders.x,y:shoulders.y};
 // Collapsed puppet's body drops towards ground but feet remain spring particles.
 const dip=collapsed?30:0;pelvis.y+=dip;sh.y+=dip;head.y+=dip;
 for (const side of ['left','right']) {
  const s=side==='left'?-1:1, leg=p.legs[side];const foot=leg.foot;
  const toe={x:foot.x-p.x,y:foot.y};
  const knee={x:(pelvis.x+s*16+toe.x)/2+s*7+Math.sin(p.time*7)*2,y:(pelvis.y+toe.y)/2-6-(leg.raised?7:0)};
  jointLine(pelvis.x+s*13,pelvis.y,knee.x,knee.y,12,side==='left'?'#f6a85e':'#ec8c54');
  jointLine(knee.x,knee.y,toe.x,toe.y-5,11,side==='left'?'#f8c27e':'#ffbc70');
  ellipse(knee.x,knee.y,7,7,'#49516d');
  ctx.save();ctx.translate(toe.x,toe.y-5);ctx.rotate(Math.sin(p.time*8)*(leg.raised?.16:0));roundedRect(-13,-6,32,14,6,side==='left'?'#ff5c78':'#765ef5');ctx.restore();
 }
 // Arms drawn behind torso.
 for(const side of ['left','right']) {
  const s=side==='left'?-1:1, hand=p.hands[side];
  const ax=sh.x+s*22,ay=sh.y+5,hx=hand.x-p.x,hy=hand.y+dip*.3;
  const elbow={x:(ax+hx)/2+s*9,y:(ay+hy)/2+11};
  jointLine(ax,ay,elbow.x,elbow.y,13,side==='left'?'#f7c27b':'#ffd78d');
  jointLine(elbow.x,elbow.y,hx,hy,11,side==='left'?'#f7c27b':'#ffd78d');
  ellipse(hx,hy,10,10,side==='left'?'#ffc793':'#ffe2a4');
 }
 // Overalls / torso. Roll with the balance angle.
 ctx.save();ctx.translate((pelvis.x+sh.x)/2,(pelvis.y+sh.y)/2);ctx.rotate(angle);
 roundedRect(-25,-33,50,71,20,dark);roundedRect(-22,-31,44,64,16,c);
 roundedRect(-18,8,36,24,6,'#f28f6e');
 ctx.strokeStyle='#fff4cd';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-18,-11);ctx.lineTo(-10,13);ctx.moveTo(18,-11);ctx.lineTo(10,13);ctx.stroke();
 ellipse(-11,23,3,3,'#ffe49e');ellipse(11,23,3,3,'#ffe49e');
 ctx.restore();
 if(p.mode==='cake') {
   ctx.save();ctx.translate(0,-76);ctx.rotate(p.cakeAngle);
   roundedRect(-57,-5,114,9,4,'#41466b');
   roundedRect(-51,-13,102,12,4,'#fde9a2');
   for(let tier=0;tier<p.layers;tier++){
     const wide=45-tier*11;
     roundedRect(-wide,-14-(tier+1)*19,wide*2,21,5,['#ffc7d0','#ffefb6','#b8f0e2'][tier]);
     roundedRect(-wide,-14-(tier+1)*19,wide*2,5,3,'#fff6d8');
   }
   ctx.restore();
 }
 // Huge expressive bobble-head.
 ellipse(head.x,head.y+1,37,38,dark);ellipse(head.x,head.y-3,34,36,'#ffdfa2');
 ellipse(head.x-13,head.y-10,10,13,'#fff');ellipse(head.x+13,head.y-10,10,13,'#fff');
 const offset=p.face==='shock'?0:Math.sin(p.time*1.4)*2;
 ellipse(head.x-12+offset,head.y-8,4.6,p.face==='shock'?6:5,'#253450');ellipse(head.x+14+offset,head.y-8,4.6,p.face==='shock'?6:5,'#253450');
 if(p.face==='shock'||p.face==='dizzy')ellipse(head.x+1,head.y+11,8,10,'#672b54');
 else {ctx.strokeStyle='#79384d';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.arc(head.x+1,head.y+4,p.face==='win'?17:12,.1,Math.PI-.1);ctx.stroke();}
 ctx.fillStyle='#e37c7b';ellipse(head.x-25,head.y+5,6,4,'#f69c8d');ellipse(head.x+25,head.y+5,6,4,'#f69c8d');
 // tuft
 ctx.strokeStyle=dark;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(head.x-5,head.y-38);ctx.lineTo(head.x+2,head.y-47);ctx.lineTo(head.x+7,head.y-38);ctx.stroke();
 ctx.restore();
 if(p.phase==='fallen') {
  ctx.font='900 18px system-ui';ctx.textAlign='center';ctx.fillStyle='#c63150';ctx.fillText('💫  BONK!',x,base-235);
 }
}
function drawScene(){
 const camera=clamp(puppet.x-355,0,TRACK_LENGTH-1000);
 ctx.clearRect(0,0,W,H);
 drawBackground(camera);drawTrack(camera);drawPuppet(puppet,camera);
 ctx.save();ctx.font='900 14px system-ui';ctx.textAlign='center';
 roundedRect(puppet.x-camera-72,201,146,35,14,'#273855');ctx.fillStyle='#fff';ctx.fillText(puppet.mode==='cake'?'BONGO + CAKE 🎂':'BONGO ✳',puppet.x-camera,224);
 ctx.restore();
 for(const p of bits){ctx.globalAlpha=clamp(1-p.t/p.life,0,1);ctx.fillStyle=p.c;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.t*6);ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*.6);ctx.restore();}
 ctx.globalAlpha=1;
}
function updateDom(){
 const sec=Math.floor(puppet.time),m=String(Math.floor(sec/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');
 $('timer').textContent=`${m}:${s}`;
 $('falls').textContent=String(puppet.falls);
 $('status').textContent=!started?'READY TO BONK':puppet.status;
 $('status').style.color=puppet.phase==='fallen'?'#ffb7a4':puppet.phase==='finished'?'#ffdf71':'#76e8b9';
 $('progress').style.width=`${(puppet.progress*100).toFixed(1)}%`;
 $('distance').textContent=`${Math.round(puppet.progress*100)}%`;
 $('cooldown').textContent=puppet.cooldown>0?`${Math.ceil(puppet.cooldown)}s`:'';
 $('next-foot').textContent=`${puppet.expectedSide.toUpperCase()} FOOT NEXT`;
 $('balance-value').textContent=`${Math.round(puppet.unsteady*100)}% DANGER`;
 $('balance-fill').style.width=`${Math.min(100,Math.round(puppet.unsteady*100))}%`;
 $('combo').textContent=String(puppet.combo);
 $('cakes').textContent=puppet.mode==='cake'?`🎂 ${puppet.layers} LAYERS`:'5 ROLES REQUIRED';

}
function finishCard(){
 if(scoreShown)return;scoreShown=true;demo=false;$('demo').textContent='▶ WATCH TEAMWORK DEMO';$('demo').classList.remove('active');
 const best=Math.round(puppet.finishedAt);const conf=puppet.falls===0?'LEGENDARY TEAMWORK':'A BEAUTIFUL DISASTER';
 $('overlay').innerHTML=`<div class="overlay-card"><span class="overlay-eyebrow">🏆 PUPPET LAB COMPLETE!</span><div class="puppet-preview">🏆</div><h2>${conf}</h2><p>Bongo somehow crossed the finish line in <b>${best} seconds</b> with <b>${puppet.falls} faceplants</b> and <b>${puppet.steps} coordinated steps</b>. That is teamwork!</p><div class="overlay-guide"><span>🏁 100% COMPLETE</span><span>💥 ${puppet.falls} FALLS</span></div><button id="play-again" class="big-button">DO IT AGAIN <span>↻</span></button><small>The full 23-player Olympics is in development.</small></div>`;
 $('overlay').hidden=false;$('play-again').addEventListener('click',reset);
}
function tick(){
 if(!started)return;
 if(demo) {
   demoInput();
   const i=puppet.input;
   const shown={leftLeg:i.leftLeg,rightLeg:i.rightLeg,leftArm:i.leftArm,rightArm:i.rightArm,leanLeft:i.lean<0,leanRight:i.lean>0,brace:i.brace};
   document.querySelectorAll('[data-action]').forEach(el=>el.classList.toggle('pressed',!!shown[el.dataset.action]));
 } else updateControls();
 puppet.update(STEP);
 handleEvents();
 if(puppet.phase==='finished')finishCard();
}
function loop(timestamp){
 if(!lastFrame)lastFrame=timestamp;
 const dt=Math.min((timestamp-lastFrame)/1000,.07);lastFrame=timestamp;
 clock+=dt; if(started){acc=Math.min(acc+dt,.12);let n=0;while(acc>=STEP&&n<7){tick();acc-=STEP;n++;}}
 if($('toast').classList.contains('show')&&clock>toastUntil)$('toast').classList.remove('show');
 for(const p of bits){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=410*dt;}bits=bits.filter(p=>p.t<p.life);
 drawScene();updateDom();requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// Test-only browser observable state; no externally writable score/physics authority.
Object.defineProperty(window,'__puppetLab',{get:()=>({x:puppet.x,phase:puppet.phase,progress:puppet.progress,falls:puppet.falls,steps:puppet.steps,combo:puppet.combo,mode:puppet.mode,layers:puppet.layers,started,events:puppet.events.length})});