import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoomStore} from '../src/server/rooms.js';

const source=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('results action says END PARTY, while BACK TO LOBBY remains a distinct action',()=>{
 const markup=source('host.html');
 assert.match(markup,/<button id="finish-session"[^>]*>END PARTY<\/button>/);
 assert.match(markup,/<button[^>]*id="return-lobby"[^>]*>BACK TO LOBBY<\/button>/);
 assert.doesNotMatch(markup,/END SESSION \/ NEW LOBBY/);
});

test('BACK TO LOBBY retains the same room, while END PARTY notifies phones and revokes the room',()=>{
 const rooms=new RoomStore(),room=rooms.create();
 const first=rooms.join(room,'First'),second=rooms.join(room,'Second');
 let firstEvents=[],secondEvents=[];
 const sink=out=>({write(s){out.push(s);},end(){}});
 room.connections.set(first.token,new Set([sink(firstEvents)]));
 room.connections.set(second.token,new Set([sink(secondEvents)]));
 rooms.start(room,'olympics');
 rooms.reset(room,true);
 assert.equal(rooms.find(room.code),room,'lobby reset must retain original room code');
 assert.equal(room.phase,'lobby');
 rooms.end(room);
 assert.equal(rooms.find(room.code),undefined,'party end must destroy room');
 for(const received of [firstEvents,secondEvents]){
  assert.ok(received.some(line=>line.includes('"type":"ended"')),'phone receives ended notification');
 }
});

test('public host displays connection and lobby phase separately, and lobby count does not wrap',()=>{
 const markup=source('host.html'),css=source('room.css'),host=source('src/host.js');
 assert.match(markup,/id="host-status"/);
 assert.match(markup,/id="room-phase"/);
 assert.match(host,/\$\('room-phase'\)\.textContent=/);
 assert.match(css,/#player-count\s*\{\s*white-space:\s*nowrap/);
});
