import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createApp} from '../dev-server.js';

const LIVE=Boolean(process.env.GRAND_PRIX_BASE_URL);
const server=LIVE?null:createApp();
if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=(process.env.GRAND_PRIX_BASE_URL||'http://127.0.0.1:'+server.address().port).replace(/\/$/,'');
const uiHost=base+(LIVE?'/':'/grand-prix.html');
const phoneUrl=base+'/grand-prix-controller.html';
let browser,roomCode='',hostToken='';
const errors=[];

try{
 browser=await chromium.launch({headless:true});
 const desktop=await browser.newContext({viewport:{width:1500,height:900}});
 const host=await desktop.newPage();
 host.on('pageerror',e=>errors.push('host: '+e.message));
 await host.addInitScript(()=>{
  const original=CanvasRenderingContext2D.prototype.fillText;
  window.__finishLabels=[];
  CanvasRenderingContext2D.prototype.fillText=function(word,x,y,...rest){
   if(word==='FINISH'){
    const labels=window.__finishLabels;
    labels.push({x,y,width:this.measureText(word).width,font:this.font,canvasWidth:this.canvas.width,canvasHeight:this.canvas.height});
    if(labels.length>12)labels.shift();
   }
   return original.call(this,word,x,y,...rest);
  };
 });
 await host.goto(uiHost);
 await host.locator('#create').click();
 await host.waitForFunction(()=>/^[A-F0-9]{6}$/.test(document.querySelector('#room-code')?.textContent?.trim()||''),null,{timeout:12000});
 roomCode=(await host.locator('#room-code').textContent()).trim();
 hostToken=await host.evaluate(()=>JSON.parse(localStorage.getItem('gp-host-v2')).token);

 // Six real lanes must all render the whole word, fully inside each lane
 // and left of the finish post, even on a densely packed 24-player race.
 for(let i=0;i<24;i++){
  const response=await fetch(base+'/api/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:roomCode,name:'Polish Guest '+(i+1)})});
  assert.equal(response.status,200,'join slot '+i+': '+await response.text());
 }
 await host.waitForFunction(()=>document.querySelector('#player-count')?.textContent?.trim()==='24 / 24',null,{timeout:12000});
 await host.locator('#warmup').click();
 await host.locator('#track').waitFor({state:'visible',timeout:12000});
 await host.waitForFunction(()=>window.__finishLabels?.length>=6,null,{timeout:10000});
 const labels=await host.evaluate(()=>window.__finishLabels.slice(-6));
 assert.equal(labels.length,6);
 const laneHeight=800/6;
 const seen=new Set();
 for(const l of labels){
  assert.equal(l.canvasWidth,1360);
  assert.ok(l.width>0,'FINISH must be measurable');
  assert.ok(l.x>=1230-168,'label starts inside finish marker area');
  assert.ok(l.x+l.width<=1230-12,'entire FINISH fits to the left of the post');
  assert.ok(l.y>=0&&l.y<=800,'label baseline within the canvas');
  const index=Math.floor(l.y/laneHeight);
  assert.ok(index>=0&&index<6,'finish word belongs to a visible lane');
  seen.add(index);
 }
 assert.equal(seen.size,6,'all six lanes draw their own full FINISH label');
 console.log('PASS #1'+(LIVE?' LIVE':' LOCAL')+': all 6 FINISH labels measured inside lane and finish-post bounds');

 // BEAT help is available on TV during warm-up, without changing physics.
 const hostHelp=(await host.locator('#instructions').textContent()).toLowerCase();
 assert.match(hostHelp,/pulsing beat/);
 assert.match(hostHelp,/faster/);
 assert.match(hostHelp,/off-beat steps still work/);
 console.log('PASS #2'+(LIVE?' LIVE':' LOCAL')+': TV explains beat speed bonus and off-beat progress');

 // Autofill: value assigned without input, change, or keydown. The load
 // handler must detect it before a visitor can click JOIN.
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const autofill=await mobile.newPage();
 autofill.on('pageerror',e=>errors.push('phone: '+e.message));
 await autofill.addInitScript(()=>{
  window.addEventListener('DOMContentLoaded',()=>{
   const field=document.getElementById('name');
   if(field)field.value='Saved Autofill Name';
  },{once:true});
 });
 await autofill.goto(phoneUrl+'?room='+roomCode);
 await autofill.waitForFunction(()=>document.querySelector('#join-button')?.disabled===false,null,{timeout:5000});
 assert.equal(await autofill.locator('#name').inputValue(),'Saved Autofill Name');

 // CHANGE event: a non-keyboard update must synchronously enable the button.
 await autofill.evaluate(()=>{
  const name=document.getElementById('name');name.value='';
  name.dispatchEvent(new Event('change',{bubbles:true}));
 });
 assert.equal(await autofill.locator('#join-button').isDisabled(),true);
 await autofill.evaluate(()=>{
  const name=document.getElementById('name');name.value='Changed Name';
  name.dispatchEvent(new Event('change',{bubbles:true}));
 });
 assert.equal(await autofill.locator('#join-button').isEnabled(),true);

 // PASTE: paste fires *before* insertion; the queued availability check
 // handles the updated value even if a browser doesn't fire a separate input.
 await autofill.evaluate(()=>{
  const name=document.getElementById('name');
  name.value='';
  name.dispatchEvent(new Event('change',{bubbles:true}));
  name.dispatchEvent(new Event('paste',{bubbles:true}));
  name.value='Pasted Name';
 });
 await autofill.waitForFunction(()=>document.querySelector('#join-button')?.disabled===false,null,{timeout:3000});
 assert.equal(await autofill.locator('#name').inputValue(),'Pasted Name');

 // INPUT: ordinary type/edit stays functional; no request is sent before JOIN.
 await autofill.locator('#name').fill('Input Name');
 assert.equal(await autofill.locator('#join-button').isEnabled(),true);
 console.log('PASS #3'+(LIVE?' LIVE':' LOCAL')+': JOIN enables via load/autofill, change, paste and input without keystroke');

 assert.deepEqual(errors,[],errors.join('\n'));
 console.log('PASS'+(LIVE?' LIVE':' LOCAL')+': Grand Prix three polish acceptance checks');
} finally{
 if(roomCode&&hostToken){
  try{await fetch(base+'/api/end',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:roomCode,token:hostToken})});}
  catch(e){console.warn('Test room cleanup delayed:',e.message);}
 }
 await browser?.close();
 if(server)await new Promise((ok,fail)=>server.close(e=>e?fail(e):ok()));
}
