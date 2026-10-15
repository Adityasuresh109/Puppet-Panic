import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createApp} from '../dev-server.js';

// The only test-only modification is to accelerate the timeout threshold in
// the downloaded host JS. Real gameplay, server, DOM handlers and relay are
// unchanged. This permits a results -> End Party E2E check in seconds.
const hostSource=readFileSync(new URL('../src/host.js',import.meta.url),'utf8');
assert.ok(hostSource.includes('elapsed>=current.seconds'),'Expected host event end condition');
const acceleratedHost=hostSource.replace('elapsed>=current.seconds','elapsed>=1.3');

const server=createApp();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser;
const errors=[];
const track=(page,label)=>{
 page.on('pageerror',e=>errors.push(label+': '+e.message));
};

try{
 browser=await chromium.launch({headless:true});
 const mobile=()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});

 // Regression 2: a demo controller must remain in preview while holding
 // a control longer than the 650 ms network heartbeat.
 const demoContext=await mobile(),demo=await demoContext.newPage();
 track(demo,'preview');
 let leakedInputRequests=0;
 demo.on('request',request=>{if(request.url().includes('/api/input'))leakedInputRequests++;});
 await demo.goto(base+'/controller.html?preview=LEFT_LEG');
 assert.equal((await demo.locator('#connection').textContent()).trim(),'● UI DEMO');
 const demoPad=demo.locator('.pad-button').first();
 await demoPad.focus();
 await demo.keyboard.down('Space');
 await demo.waitForTimeout(1250);
 assert.equal((await demo.locator('#connection').textContent()).trim(),'● UI DEMO','preview must never enter reconnecting state');
 assert.equal(leakedInputRequests,0,'preview must never send HTTP inputs');
 await demo.keyboard.up('Space');
 await demoContext.close();
 console.log('PASS #2: preview control hold never sends and UI DEMO remains stable');

 const hostContext=await browser.newContext({viewport:{width:1280,height:840}});
 const host=await hostContext.newPage();
 track(host,'host');
 await host.route('**/src/host.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:acceleratedHost}));
 await host.goto(base+'/host.html');
 await host.locator('#create-room').click();
 await host.waitForFunction(()=>/^[A-F0-9]{6}$/.test(document.querySelector('#room-code')?.textContent?.trim()||''),null,{timeout:12000});
 const code=(await host.locator('#room-code').textContent()).trim();
 await host.waitForFunction(()=>document.querySelector('#host-status')?.textContent==='ROOM CONNECTED',null,{timeout:10000});

 // Regression 4: host's selected quick challenge and mode survive reclaim.
 await host.locator('#host-format').selectOption('quick');
 await host.locator('#host-mode').selectOption('swing');
 await host.waitForFunction(()=>JSON.parse(localStorage.getItem('puppet-host'))?.selectedMode==='swing');
 assert.equal(await host.locator('#host-format').inputValue(),'quick');
 await host.reload();
 await host.waitForFunction(()=>document.querySelector('#room-code')?.textContent?.trim()==='${code}',null,{timeout:10000});
 await host.waitForFunction(()=>document.querySelector('#host-status')?.textContent==='ROOM CONNECTED',null,{timeout:10000});
 assert.equal(await host.locator('#host-format').inputValue(),'quick');
 assert.equal(await host.locator('#host-mode').inputValue(),'swing');
 console.log('PASS #4: selected QUICK / SWING restored after host refresh');

 // Regression 3: snapshot notifications must not overwrite connection status.
 const aliceContext=await mobile(),alice=await aliceContext.newPage();
 track(alice,'player 1');
 await alice.goto(base+'/controller.html?room='+code);
 assert.equal(await alice.locator('#join-form button[type="submit"]').isDisabled(),true);
 const clickedDisabled=await alice.evaluate(()=>{
  const input=document.querySelector('#join-name');
  input.value='Alex';
  input.dispatchEvent(new Event('input',{bubbles:true}));
  const submit=document.querySelector('#join-form button[type="submit"]');
  const disabled=submit.disabled;
  if(!disabled)submit.click();
  return disabled;
 });
 assert.equal(clickedDisabled,false,'button enables synchronously within the input event');
 await alice.locator('#role-screen').waitFor({state:'visible',timeout:12000});

 await host.waitForFunction(()=>document.querySelector('#player-count')?.textContent?.includes('1 / 25'),null,{timeout:10000});
 assert.equal((await host.locator('#host-status').textContent()).trim(),'ROOM CONNECTED');
 assert.match(await host.locator('#room-phase').textContent(),/LOBBY · JOINING/);
 console.log('PASS #3: host connection stays CONNECTED after room snapshot');
 console.log('PASS #5: immediate click following name input successfully joins');

 // Regression 6: narrow count box never splits "1 / 25" into two lines.
 const countStyle=await host.locator('#player-count').evaluate(el=>getComputedStyle(el).whiteSpace);
 assert.equal(countStyle,'nowrap');
 const countWidth=await host.locator('#player-count').evaluate(el=>el.getBoundingClientRect().width);
 assert.ok(countWidth>0);
 console.log('PASS #6: count has nowrap computed style');

 const samContext=await mobile(),sam=await samContext.newPage();
 track(sam,'player 2');
 await sam.goto(base+'/controller.html?room='+code);
 await sam.locator('#join-name').fill('Sam');
 await sam.locator('#join-form button[type="submit"]').click();
 await sam.locator('#role-screen').waitFor({state:'visible',timeout:12000});
 await host.waitForFunction(()=>document.querySelector('#player-count')?.textContent?.includes('2 / 25'),null,{timeout:10000});
 await host.locator('#start-match').click();
 await host.locator('#host-game').waitFor({state:'visible',timeout:10000});
 await host.locator('#round-results').waitFor({state:'visible',timeout:15000});
 assert.equal((await host.locator('#finish-session').textContent()).trim(),'END PARTY');
 assert.equal((await host.locator('#return-lobby').textContent()).trim(),'BACK TO LOBBY');

 let confirmation='';
 host.once('dialog',async dialog=>{confirmation=dialog.message();await dialog.accept();});
 await host.locator('#finish-session').click();
 await alice.locator('#join-screen').waitFor({state:'visible',timeout:10000});
 await sam.locator('#join-screen').waitFor({state:'visible',timeout:10000});
 assert.match(confirmation,/permanently closes the room/i);
 assert.match(confirmation,/new room code/i);
 assert.match((await alice.locator('#join-error').textContent()),/host ended this party/i);
 assert.match((await sam.locator('#join-error').textContent()),/host ended this party/i);
 const old=await fetch(base+'/api/state?code='+code+'&token=unused');
 assert.equal(old.status,404,'closed room cannot be reused');
 console.log('PASS #1: results END PARTY closes room, confirms irreversibility and tells both phones');
 assert.deepEqual(errors,[],errors.join('\n'));
 console.log('PASS: all 6 rc.2 independent Chromium regressions');
}finally{
 if(browser)await browser.close();
 await new Promise((ok,reject)=>server.close(e=>e?reject(e):ok()));
}
