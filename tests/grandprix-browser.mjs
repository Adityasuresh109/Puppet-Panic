import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createApp} from '../dev-server.js';
const server=createApp();await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true});
 const hostContext=await browser.newContext({viewport:{width:1600,height:900}});
 const host=await hostContext.newPage();host.on('pageerror',e=>errors.push('host: '+e.message));
 // Only speed up the event timer inside browser integration: actual physics
 // and server transport are unchanged, and no preview mode auto-plays.
 await host.route('**/src/v2/rules.js',async route=>{
  const res=await route.fetch();let text=await res.text();text=text.replace(/seconds:(90|110|120|150)/g,'seconds:3');
  await route.fulfill({response:res,body:text});
 });
 await host.goto(base+'/grand-prix.html');
 await host.locator('#create').click();
 await host.waitForFunction(()=>/^[A-F0-9]{6}$/.test(document.querySelector('#room-code')?.textContent?.trim()||''));
 const code=(await host.locator('#room-code').textContent()).trim();
 assert.equal((await host.locator('#player-count').textContent()).trim(),'0 / 24');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push('phone: '+e.message));
 await phone.goto(base+'/grand-prix-controller.html?room='+code);
 await phone.locator('#name').fill('Racer 1');await phone.locator('#join-button').click();
 await phone.locator('#pad').waitFor({state:'visible',timeout:11000});
 assert.equal((await phone.locator('#role').textContent()).trim(),'ALL FOUR LIMBS');
 assert.equal(await phone.locator('#buttons button').count(),4);
 const playerCredentials=await phone.evaluate(room=>JSON.parse(localStorage.getItem('gp-phone-'+room)),code);
 assert.ok(playerCredentials?.token);
 // Fill the rest of the room through the *real* local room API so that the
 // host must manage six lanes without needing 24 independent browser UIs.
 for(let i=2;i<=24;i++){
  const result=await fetch(base+'/api/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,name:'Racer '+i})});
  assert.equal(result.status,200,'24 guest capacity');
 }
 await host.waitForFunction(()=>document.querySelector('#player-count')?.textContent==='24 / 24',null,{timeout:12000});
 assert.equal(await host.locator('.gp-team').count(),6);
 await host.locator('#warmup').click();
 await host.locator('#race').waitFor({state:'visible',timeout:12000});
 assert.equal((await host.locator('#host-phase').textContent()).trim(),'WARM UP');
 await phone.waitForFunction(()=>document.querySelector('#event-name')?.textContent?.includes('WARM UP'),null,{timeout:12000});
 assert.equal((await phone.locator('#role').textContent()).trim(),'LEFT LEG');
 assert.equal(await phone.locator('#buttons button').count(),1);
 await phone.locator('#buttons button').focus();await phone.keyboard.down('Space');
 await phone.waitForTimeout(300);
 assert.equal(await phone.locator('#limb-leftLeg').getAttribute('class'),'owned pressed');
 await phone.keyboard.up('Space');
 assert.equal(await phone.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+2),true);
 const canvas=host.locator('#track');assert.equal(await canvas.isVisible(),true);
 const png=await canvas.screenshot();assert.ok(png.byteLength>3500,'rendered scene should not be blank');
 // The real production experience must survive accidental host and phone
 // refreshes without changing the party code or reassigning the phone.
 await phone.reload();
 await phone.locator('#pad').waitFor({state:'visible',timeout:12000});
 assert.equal((await phone.locator('#role').textContent()).trim(),'LEFT LEG');
 assert.equal(await phone.locator('#buttons button').count(),1);
 await host.reload();
 await host.locator('#race').waitFor({state:'visible',timeout:12000});
 assert.equal((await host.locator('#host-phase').textContent()).trim(),'WARM UP');
 assert.equal((await host.locator('#room-code').textContent()).trim(),code);
 console.log('PASS: host refresh and phone auto-reclaim preserve room and assigned limb');
 console.log('PASS: 24 players -> 6 puppets, real warm-up, limb highlight and no phone scrolling');
 await host.locator('#start-race').click();
 await host.waitForFunction(()=>document.querySelector('#host-phase')?.textContent==='RACING',null,{timeout:12000});
 await host.locator('#results').waitFor({state:'visible',timeout:15000});
 assert.equal(await host.locator('.gp-podium-card').count(),6);
 assert.match(await host.locator('#results-title').textContent(),/RACE RESULTS/);
 await host.locator('#next').click();
 await host.waitForFunction(()=>document.querySelector('#event-title')?.textContent?.includes('CAKE'),null,{timeout:15000});
 await phone.waitForFunction(()=>document.querySelector('#event-name')?.textContent?.includes('CAKE'),null,{timeout:15000});
 await phone.locator('#new-job').waitFor({state:'visible',timeout:7000});
 console.log('PASS: complete race, six-team podium, next event and 3-second phone job banner');
 assert.deepEqual(errors,[],errors.join('\n'));
}finally{await browser?.close();await new Promise((ok,err)=>server.close(e=>e?err(e):ok()));}