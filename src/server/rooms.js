import crypto from 'node:crypto';
import {allocateTeams,assignPlayers,ACTIONS,MAX_PLAYERS} from '../teams.js';

const code=()=>crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();
const token=()=>crypto.randomBytes(24).toString('hex');
const sanitizeName=(v)=>String(v??'').trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,24)||'Mystery Player';
export class RoomStore{
 constructor(){this.rooms=new Map();}
 create(){let id;do{id=code()}while(this.rooms.has(id));const room={code:id,hostToken:token(),phase:'lobby',mode:'walk',players:[],connections:new Map(),createdAt:Date.now()};this.rooms.set(id,room);return room;}
 find(id){return this.rooms.get(String(id||'').trim().toUpperCase());}
 auth(room,key){if(!room||typeof key!=='string')return null;if(key===room.hostToken)return {host:true};return room.players.find(p=>p.token===key)||null;}
 roster(room){return room.players.map(({id,name,teamId,teamName,teamColor,role,seat,online})=>({id,name,teamId,teamName,teamColor,role,seat,online}));}
 snapshot(room,person){return {type:'room',code:room.code,phase:room.phase,mode:room.mode,players:this.roster(room),teams:room.players.length>=2?allocateTeams(room.players.length):[],you:person.host?{host:true}:{id:person.id,role:person.role,teamId:person.teamId},maxPlayers:MAX_PLAYERS};}
 emit(room,key,data){const sockets=room.connections.get(key);if(!sockets)return;for(const res of sockets){try{res.write(`data: ${JSON.stringify(data)}\n\n`);}catch{}}}
 notify(room){for(const [key] of room.connections){const who=this.auth(room,key);if(who)this.emit(room,key,this.snapshot(room,who));}}
 join(room,name,existingToken){if(room.phase!=='lobby'&&(!existingToken||!room.players.some(p=>p.token===existingToken)))throw Error('Match already in progress');
  if(existingToken){const existing=room.players.find(p=>p.token===existingToken);if(existing){
   this.emit(room,room.hostToken,{type:'input',playerId:existing.id,teamId:existing.teamId,controls:{},seq:existing.seq+1});
   for(const stream of room.connections.get(existingToken)||[])try{stream.end();}catch{}
   room.connections.delete(existingToken);
   existing.token=token();existing.seq=0;existing.controls={};existing.online=false;this.notify(room);return existing;
  }}
  if(room.players.length===MAX_PLAYERS)throw Error('Room full (25 players)');
  const p={id:crypto.randomUUID(),token:token(),name:sanitizeName(name),controls:{},seq:0,online:false,teamId:null,role:null};room.players.push(p);this.rebalance(room);this.notify(room);return p;}
 rebalance(room){if(room.phase!=='lobby')return;const allocation=assignPlayers(room.players);
  for(let i=0;i<room.players.length;i++){const a=allocation[i];const p=room.players[i];p.teamId=a?.teamId??null;p.teamName=a?.teamName??null;p.teamColor=a?.teamColor??null;p.role=a?.role??null;p.seat=a?.seat??null;p.controls={};p.seq=0;}
 }
 mode(room,next){if(room.phase!=='lobby'||!['walk','cake'].includes(next))throw Error('Select the challenge in the lobby');room.mode=next;this.notify(room);}
 start(room){if(room.phase!=='lobby')throw Error('Match already started');if(room.players.length<2)throw Error('At least 2 players required');this.rebalance(room);room.phase='playing';this.notify(room);}
 reset(room){room.phase='lobby';this.rebalance(room);this.notify(room);}
 input(room,p,seq,controls){if(room.phase!=='playing')throw Error('Match not active');if(!Number.isSafeInteger(seq)||seq<=p.seq)return false;
  const valid=ACTIONS[p.role]||[];if(!controls||typeof controls!=='object'||Array.isArray(controls)||Object.entries(controls).some(([k,v])=>!valid.includes(k)||typeof v!=='boolean'))throw Error('Invalid controls for role');
  p.controls=Object.fromEntries(valid.map(k=>[k,Boolean(controls[k])]));p.seq=seq;
  this.emit(room,room.hostToken,{type:'input',playerId:p.id,teamId:p.teamId,controls:p.controls,seq});return true;
 }
 disconnect(room,p){if(!p||p.host)return;p.controls={};p.online=false;this.emit(room,room.hostToken,{type:'input',playerId:p.id,teamId:p.teamId,controls:{},seq:p.seq+1});this.notify(room);}
}