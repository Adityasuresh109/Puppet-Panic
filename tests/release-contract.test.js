import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {RoomStore} from '../src/server/rooms.js';
import {EVENTS} from '../src/events.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf-8');
test('phone-only controller and host do not show development lab shortcut',()=>{
 assert.doesNotMatch(read('host.html'),/OPEN SOLO LAB/i);
 assert.doesNotMatch(read('host.html'),/href=["']\.\/lab.html/);
 assert.match(read('controller.html'),/id="pad-area"/);
 assert.doesNotMatch(read('controller.html'),/tv-canvas|THE CONTROL DECK/i);
});
test('all five challenges can be selected and started in both local and cloud code',()=>{
 const store=new RoomStore();const r=store.create();store.join(r,'One');store.join(r,'Two');
 for(const e of EVENTS){store.mode(r,e.id);store.start(r);assert.equal(r.mode,e.id);store.reset(r);}
 assert.equal(r.roundNumber,5);
 const worker=read('worker/implementation.js');assert.match(worker,/EVENT_IDS\.includes\(body\.mode\)/);
});
test('public release contains the game tournament controls and auto stage switching',()=>{
 const html=read('host.html');const js=read('src/host.js');
 for(const e of EVENTS)assert.ok(html.includes(`value="${e.id}"`));
 for(const id of ['host-format','round-results','next-event','finish-session','result-standings'])assert.ok(html.includes(`id="${id}"`));
 assert.match(js,/eventStandings\(/);assert.match(js,/tallyTournament\(/);
 assert.match(js,/room\.phase==='playing'\)initGame\(\)/);
});