import crypto from 'node:crypto';
import {allocateTeams,assignPlayers,ACTIONS,MAX_PLAYERS} from '../teams.js';
import {EVENT_IDS} from '../events.js';
import {gpTeams,gpAssign,GP_ACTIONS,GP_MAX_PLAYERS} from '../v2/rules.js';

const code=()=>crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();
const token=()=>crypto.randomBytes(24).toString('hex');
const sanitizeName=(v)=>String(v??'').trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,24)||'Mystery Player';
export class RoomStore{
 constructor(){this.rooms=new Map();}
 create(variant='olympics'){if(!['olympics','grandprix'].includes(variant))throw Error('Invalid game variant');let id;do{id=code()}while(this.rooms.has(id));const room={variant,code:id,hostToken:token(),phase:'lobby',mode:'walk',roundNumber:0,rosterLocked:false,players:[],connections:new Map(),createdAt:Date.now()};this.rooms.set(id,room);return room;}
 find(id){return this.rooms.get(String(id||'').trim().toUpperCase());}
 auth(room,key){if(!room||typeof key!=='string')return null;if(key===room.hostToken)return {host:true};return room.players.find(p=>p.token===key)||null;}
 roster(room){return room.players.map(({id,name,teamId,teamName,teamColor,role,seat,online})=>({id,name,teamId,teamName,teamColor,role,seat,online}));}
 snapshot(room,person){return {type:'room',code:room.code,phase:room.phase,mode:room.mode,roundNumber:room.roundNumber,players:this.roster(room),variant:room.variant||'olympics',warmedUp:room.warmedUp===true,teams:room.players.length>=(room.variant==='grandprix'?1:2)?(room.variant==='grandprix'?gpTeams(room.players.length):allocateTeams(room.players.length)):[],...(person.host?{checkpoint:room.checkpoint||null}:{}),rosterLocked:!!room.rosterLocked,hostOnline:(room.connections.get(room.hostToken)?.size||0)>0,you:person.host?{host:true}:{id:person.id,role:person.role,teamId:person.teamId},maxPlayers:room.variant==='grandprix'?GP_MAX_PLAYERS:MAX_PLAYERS};}
 emit(room,key,data){const sockets=room.connections.get(key);if(!sockets)return;for(const res of sockets){try{res.write(`data: ${JSON.stringify(data)}\n\n`);}catch{}}}
 notify(room){for(const [key] of room.connections){const who=this.auth(room,key);if(who)this.emit(room,key,this.snapshot(room,who));}}
 join(room,name,existingToken){if((room.phase!=='lobby'||room.rosterLocked)&&(!existingToken||!room.players.some(p=>p.token===existingToken)))throw Error('Match already in progress or tournament roster locked');
  if(existingToken){const existing=room.players.find(p=>p.token===existingToken);if(existing){
   this.emit(room,room.hostToken,{type:'input',playerId:existing.id,teamId:existing.teamId,controls:{},seq:existing.seq+1});
   for(const stream of room.connections.get(existingToken)||[])try{stream.end();}catch{}
   room.connections.delete(existingToken);
   existing.token=token();existing.seq=0;existing.controls={};existing.online=false;this.notify(room);return existing;
  }}
  if(room.players.length===(room.variant==='grandprix'?GP_MAX_PLAYERS:MAX_PLAYERS))throw Error('Room full');
  const p={id:crypto.randomUUID(),token:token(),name:sanitizeName(name),controls:{},seq:0,online:false,teamId:null,role:null};room.players.push(p);this.rebalance(room);this.notify(room);return p;}
 rebalance(room){if(room.phase!=='lobby')return;const allocation=room.variant==='grandprix'?(room.players.length?gpAssign(room.players,room.roundNumber||0):[]):assignPlayers(room.players);
  for(let i=0;i<room.players.length;i++){const a=allocation[i];const p=room.players[i];p.teamId=a?.teamId??null;p.teamName=a?.teamName??null;p.teamColor=a?.teamColor??null;p.seat=a?.seat??null;
   const group=allocation.filter(x=>x.teamId===a?.teamId);p.role=room.variant==='grandprix'?a?.role??null:group.length?group[(a.seat+(room.roundNumber||0))%group.length].role:null;
   p.controls={};p.seq=0;}
 }
 mode(room,next){if(room.phase!=='lobby'||!EVENT_IDS.includes(next))throw Error('Select the challenge in the lobby');room.mode=next;this.notify(room);}
 warmup(room){if(room.variant!=='grandprix'||room.phase!=='lobby'||room.players.length<1)throw Error('Cannot start warm-up');this.rebalance(room);room.rosterLocked=true;room.phase='warmup';room.warmedUp=true;this.notify(room);}
 start(room,format){if(room.phase!=='lobby'&&!(room.variant==='grandprix'&&room.phase==='warmup'))throw Error('Match already started');if(room.players.length<(room.variant==='grandprix'?1:2))throw Error('Not enough players');if(room.variant==='grandprix'&&!room.warmedUp)throw Error('Warm up before the first race');this.rebalance(room);if(format==='olympics')room.rosterLocked=true;room.phase='playing';this.notify(room);}
 reset(room,finishTournament=false){room.roundNumber=finishTournament?0:(room.roundNumber||0)+1;room.phase='lobby';if(finishTournament)room.rosterLocked=false;this.rebalance(room);this.notify(room);}
 input(room,p,seq,controls){if(room.phase!=='playing'&&!(room.variant==='grandprix'&&room.phase==='warmup'))throw Error('Match not active');if(!Number.isSafeInteger(seq)||seq<=p.seq)return false;
  const valid=(room.variant==='grandprix'?GP_ACTIONS:ACTIONS)[p.role]||[];if(!controls||typeof controls!=='object'||Array.isArray(controls)||Object.entries(controls).some(([k,v])=>!valid.includes(k)||typeof v!=='boolean'))throw Error('Invalid controls for role');
  p.controls=Object.fromEntries(valid.map(k=>[k,Boolean(controls[k])]));p.seq=seq;
  this.emit(room,room.hostToken,{type:'input',playerId:p.id,teamId:p.teamId,controls:p.controls,seq});return true;
 }
 kick(room,playerId){if(room.phase!=='lobby'||room.rosterLocked)throw Error('Players can only be removed before starting a tournament');
  const index=room.players.findIndex(p=>p.id===playerId);if(index<0)throw Error('Unknown player');
  const p=room.players[index];this.emit(room,p.token,{type:'kicked'});
  for(const res of room.connections.get(p.token)||[])try{res.end();}catch{}
  room.connections.delete(p.token);room.players.splice(index,1);this.rebalance(room);this.notify(room);}
  end(room){for(const [key] of room.connections)this.emit(room,key,{type:'ended'});this.rooms.delete(room.code);for(const sockets of room.connections.values())for(const res of sockets)try{res.end();}catch{}}
 disconnect(room,p){if(!p||p.host)return;p.controls={};p.online=false;this.emit(room,room.hostToken,{type:'input',playerId:p.id,teamId:p.teamId,controls:{},seq:p.seq+1});this.notify(room);}
}