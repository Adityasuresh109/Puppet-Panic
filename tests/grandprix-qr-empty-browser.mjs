import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createApp } from '../dev-server.js';

const live=Boolean(process.env.GRAND_PRIX_BASE_URL);
const server=live?null:createApp();
if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=(process.env.GRAND_PRIX_BASE_URL||'http://127.0.0.1:'+server.address().port).replace(/\/$/,'');
let browser,code='',token='';
const pageErrors=[];
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:900}});
 const host=await context.newPage();
 host.on('pageerror',err=>pageErrors.push(err.message));
 await host.goto(base+(live?'/':'/grand-prix.html'));
 assert.equal(await host.locator('#create').isVisible(),true);
 await host.locator('#create').click();
 await host.waitForFunction(()=>/^[A-F0-9]{6}$/.test(document.querySelector('#room-code')?.textContent?.trim()||''),null,{timeout:12000});
 code=(await host.locator('#room-code').textContent()).trim();
 token=await host.evaluate(()=>JSON.parse(localStorage.getItem('gp-host-v2')).token);
 await host.waitForFunction(()=>document.querySelector('#player-count')?.textContent?.trim()==='0 / 24',null,{timeout:12000});
 assert.equal(await host.locator('#room-info').isVisible(),true,'QR lobby must be visible before any guest joins');
 assert.equal((await host.locator('#room-code').textContent()).trim(),code);
 const joinLink=(await host.locator('#join-link').textContent()).trim();
 assert.ok(joinLink.includes('room='+code),'shareable join link contains the newly created room code');
 const pixels=await host.locator('#join-qr').evaluate(canvas=>{
   const {width,height}=canvas;
   const data=canvas.getContext('2d').getImageData(0,0,width,height).data;
   let dark=0,light=0,transparent=0;
   for(let i=0;i<data.length;i+=4){
     const a=data[i+3],r=data[i],g=data[i+1],b=data[i+2];
     if(a<250)transparent++;
     else if(r<90&&g<90&&b<90)dark++;
     else if(r>220&&g>220&&b>220)light++;
   }
   return {width,height,dark,light,transparent};
 });
 assert.ok(pixels.dark>500,'fresh QR canvas must contain dark QR modules, not an empty canvas: '+JSON.stringify(pixels));
 assert.ok(pixels.light>500,'fresh QR canvas must contain a white background and quiet zone');
 assert.equal(pixels.transparent,0,'the full QR canvas should be painted');
 const state=await fetch(base+'/api/state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,token})}).then(r=>r.json());
 assert.equal(state.players.length,0,'no player joined before the QR was painted');
 console.log('PASS'+(live?' LIVE':' LOCAL')+': 0/24 fresh room shows actual QR modules, visible room code and working join URL');

 await host.reload();
 await host.waitForFunction(expected=>document.querySelector('#room-code')?.textContent?.trim()===expected,code,{timeout:12000});
 await host.waitForFunction(()=>document.querySelector('#player-count')?.textContent?.trim()==='0 / 24',null,{timeout:12000});
 const refreshDark=await host.locator('#join-qr').evaluate(canvas=>{
   const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   let dark=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>250&&d[i]<90&&d[i+1]<90&&d[i+2]<90)dark++;
   return dark;
 });
 assert.ok(refreshDark>500,'QR survives normal host reclaim without guests');
 assert.deepEqual(pageErrors,[],'no JavaScript errors on fresh create or host refresh');
 console.log('PASS'+(live?' LIVE':' LOCAL')+': zero-player QR remains drawn after host refresh');
}finally{
 if(code&&token){
  try{await fetch(base+'/api/end',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,token})});}
  catch(e){console.warn('Could not close temporary QR test room:',e.message);}
 }
 await browser?.close();
 if(server)await new Promise((ok,reject)=>server.close(e=>e?reject(e):ok()));
}
