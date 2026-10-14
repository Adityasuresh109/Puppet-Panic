import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createApp} from '../dev-server.js';

const server=createApp();
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port;
let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:1280,height:840}});
 const host=await ctx.newPage();
 host.on('pageerror',err=>errors.push('host: '+err.message));
 await host.goto(base+'/host.html');
 await host.locator('#create-room').click();
 await host.locator('#room-code').waitFor({state:'visible',timeout:10000});
 const code=(await host.locator('#room-code').textContent()).trim();
 assert.match(code,/^[A-F0-9]{6}$/);
 assert.equal(await host.locator('#create-room').isVisible(),false,'existing room must hide Create');
 const phones=[];
 for(const [i,name] of ['Alex','Sam'].entries()){
  const p=await ctx.newPage();p.on('pageerror',err=>errors.push('phone'+i+': '+err.message));
  await p.goto(base+'/controller.html?room='+code);
  await p.locator('#join-name').fill(name);
  await p.locator('#join-form button[type="submit"]').click();
  await p.locator('#role-screen').waitFor({state:'visible',timeout:12000});
  phones.push(p);
 }
 await host.waitForFunction(()=>document.querySelector('#player-count')?.textContent?.includes('2 / 25'),null,{timeout:10000});
 assert.match(await phones[0].locator('#role-label').textContent(),/LEGS/i);
 assert.match(await phones[1].locator('#role-label').textContent(),/UPPER BODY/i);
 await host.locator('#start-match').click();
 await host.locator('#host-game').waitFor({state:'visible',timeout:12000});
 for(const phone of phones){
  await phone.waitForFunction(()=>document.querySelector('#role-screen')?.classList.contains('waiting')===false,null,{timeout:10000});
  const scroll=await phone.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  assert.ok(scroll<=2,'controller must not require scroll');
 }
 await host.reload();
 await host.locator('#host-game').waitFor({state:'visible',timeout:12000});
 assert.match(await host.locator('#event-counter').textContent(),/EVENT 1 OF 5/);
 await host.locator('#return-lobby').click();
 host.once('dialog',dlg=>dlg.accept());
 await host.locator('#host-setup').waitFor({state:'visible',timeout:12000});
 await host.locator('#end-party').click();
 host.once('dialog',dlg=>dlg.accept());
 await phones[0].locator('#join-screen').waitFor({state:'visible',timeout:12000});
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: live browser host+two controllers join, start, host reload, end party');
}finally{
 if(browser)await browser.close();
 await new Promise((ok,fail)=>server.close(e=>e?fail(e):ok()));
}
