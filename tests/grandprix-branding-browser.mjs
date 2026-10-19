import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createApp } from '../dev-server.js';

const LIVE = Boolean(process.env.GRAND_PRIX_BASE_URL);
const server = LIVE ? null : createApp();
if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = (process.env.GRAND_PRIX_BASE_URL || 'http://127.0.0.1:'+server.address().port).replace(/\/$/,'');
const hostUrl = base + (LIVE ? '/' : '/grand-prix.html');
const phoneUrl = base + '/grand-prix-controller.html';
const banned = /\b(?:preview|experimental|demo|v1|v2|beta|test|debug)\b/i;
let browser, roomCode='',hostToken='';
const errors=[];

async function cleanUI(page, description){
 const text=await page.locator('body').innerText();
 const title=await page.title();
 assert.doesNotMatch(title,banned,description+' browser title');
 assert.doesNotMatch(text,banned,description+' visible copy');
 return text;
}
try{
 browser=await chromium.launch({headless:true});
 const hostCtx=await browser.newContext({viewport:{width:1440,height:900}});
 const host=await hostCtx.newPage();
 host.on('pageerror',e=>errors.push('host: '+e.message));
 if(!LIVE){
  // Accelerate the test's five-event rule in this browser only; this does
  // not modify the server, compiled build, or the deployed game.
  await host.route('**/src/v2/rules.js',async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:(await response.text()).replace(/seconds:(90|110|120|150)/g,'seconds:3')});
  });
 }
 await host.goto(hostUrl,{waitUntil:'domcontentloaded'});
 assert.equal(await host.title(),'Puppet Grand Prix — TV Host');
 const initial=await cleanUI(host,'host start screen');
 assert.match(initial,/PUPPET GRAND PRIX/);
 assert.match(initial,/FOUR LIMBS\. SIX LANES\. ONE CHAMPION/);
 assert.equal(await host.locator('.gp-version').count(),0,'no version badge remains');
 console.log('PASS'+(LIVE?' LIVE':' LOCAL')+': clean standalone host start screen and title');

 const emptyCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const badPhone=await emptyCtx.newPage();
 badPhone.on('pageerror',e=>errors.push('invalid room: '+e.message));
 await badPhone.goto(phoneUrl);
 await cleanUI(badPhone,'phone join/empty state');
 await badPhone.locator('#code').fill('000000');
 await badPhone.locator('#name').fill('Lost Racer');
 await badPhone.locator('#join-button').click();
 await badPhone.waitForFunction(()=>Boolean(document.querySelector('#join-error')?.textContent?.trim()),null,{timeout:12000});
 await cleanUI(badPhone,'phone invalid-room error');
 console.log('PASS'+(LIVE?' LIVE':' LOCAL')+': controller join and error states have no development labels');
 await emptyCtx.close();

 await host.locator('#create').click();
 await host.waitForFunction(()=>/^[A-F0-9]{6}$/.test(document.querySelector('#room-code')?.textContent?.trim()||''),null,{timeout:12000});
 roomCode=(await host.locator('#room-code').textContent()).trim();
 hostToken=await host.evaluate(()=>JSON.parse(localStorage.getItem('gp-host-v2')).token);
 await cleanUI(host,'host created lobby');

 const playerCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const phone=await playerCtx.newPage();
 phone.on('pageerror',e=>errors.push('joined player: '+e.message));
 await phone.goto(phoneUrl+'?room='+roomCode);
 await cleanUI(phone,'phone join screen');
 await phone.locator('#name').fill('Grand Racer');
 await phone.locator('#join-button').click();
 await phone.locator('#pad').waitFor({state:'visible',timeout:12000});
 await cleanUI(phone,'joined controller pad');
 await host.waitForFunction(()=>document.querySelector('#player-count')?.textContent?.includes('1 / 24'),null,{timeout:12000});
 await cleanUI(host,'populated lobby');
 assert.equal(await phone.locator('#buttons button').count(),4,'solo controller retains four limbs');
 console.log('PASS'+(LIVE?' LIVE':' LOCAL')+': created room, joined through phone and displayed four-limb pad');

 // Developer-only ?preview= controls remain usable, but the real joined
 // player above must never receive the isolated practice-state indicator.
 const devCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const devPhone=await devCtx.newPage();
 await devPhone.goto(phoneUrl+'?preview=LEFT_LEG');
 await devPhone.locator('#pad').waitFor({state:'visible',timeout:7000});
 assert.equal(await devPhone.locator('#buttons button').count(),1);
 await devPhone.locator('#buttons button').focus();
 await devPhone.keyboard.down('Space');
 assert.match((await devPhone.locator('#limb-leftLeg').getAttribute('class'))||'',/pressed/);
 await devPhone.keyboard.up('Space');
 assert.doesNotMatch(await phone.locator('#connect-status').innerText(),/demo|preview|practice/i);
 await devCtx.close();
 console.log('PASS'+(LIVE?' LIVE':' LOCAL')+': developer controller preview still responds, but real players see no dev status');

 await host.locator('#warmup').click();
 await host.locator('#race').waitFor({state:'visible',timeout:12000});
 await phone.waitForFunction(()=>document.querySelector('#event-name')?.textContent?.includes('WARM UP'),null,{timeout:12000});
 await cleanUI(host,'warm-up host');
 await cleanUI(phone,'warm-up controller');
 await host.locator('#start-race').click();
 await host.waitForFunction(()=>document.querySelector('#host-phase')?.textContent?.includes('RACING'),null,{timeout:12000});
 await cleanUI(host,'race host');
 await cleanUI(phone,'race controller');
 console.log('PASS'+(LIVE?' LIVE':' LOCAL')+': warm-up, start race, host and phone copy all clean');

 // Results are reached by the real timer in the deployed Worker. Only
 // localhost CI accelerates the duration through a browser-only route.
 await host.locator('#results').waitFor({state:'visible',timeout:LIVE?113000:12000});
 const results=await cleanUI(host,'results/podium');
 assert.match(results,/RACE RESULTS/);
 console.log('PASS'+(LIVE?' LIVE':' LOCAL')+': normal results and podium contain no development copy');
 assert.deepEqual(errors,[],errors.join('\n'));
 console.log('PASS'+(LIVE?' LIVE':' LOCAL')+': full Grand Prix host/controller branding acceptance');
}finally{
 if(roomCode&&hostToken){
  try{await fetch(base+'/api/end',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:roomCode,token:hostToken})});}
  catch(e){console.warn('Could not clean up brand test room:',e.message);}
 }
 await browser?.close();
 if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
}
