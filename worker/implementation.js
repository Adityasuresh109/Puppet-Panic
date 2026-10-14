import {allocateTeams,assignPlayers,ACTIONS,MAX_PLAYERS} from '../src/teams.js';
import {EVENT_IDS} from '../src/events.js';

const ORIGINS=new Set(['https://adityasuresh109.github.io','http://localhost:4173','http://127.0.0.1:4173']);
const ROOM_TTL=4*60*60*1000;
const gen=(n)=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');
const validateCode=c=>typeof c==='string'&&/^[A-F0-9]{6}$/.test(c.toUpperCase());
const cleanName=s=>String(s||'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,24)||'Mystery Player';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const parse=async (request,maxBytes=4096)=>{if(Number(request.headers.get('content-length')||0)>maxBytes)throw Error('Request too large');const data=await request.text();if(data.length>maxBytes)throw Error('Request too large');return data?JSON.parse(data):{};};
const sameOrigin=request=>{const origin=request.headers.get('origin');return !origin||ORIGINS.has(origin);};
function externalCors(request,response){const origin=request.headers.get('origin');const headers=new Headers(response.headers);if(origin&&ORIGINS.has(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','content-type');}return new Response(response.body,{status:response.status,headers});}

export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='OPTIONS')return externalCors(request,new Response(null,{status:204}));
  if(!sameOrigin(request))return json({error:'This website is not authorized to use the game relay'},403);
  if(path==='/health')return externalCors(request,json({ok:true,version:1,service:'puppet-panic-relay'}));
  if(!path.startsWith('/api/'))return externalCors(request,json({error:'Unknown endpoint'},404));
  if(request.method==='POST'&&(path==='/api/create'||path==='/api/join')){
    const ip=request.headers.get('cf-connecting-ip')||'unknown';
    const gate=env.PARTY_ROOM.getByName('LIMIT:'+ip);
    const result=await gate.fetch(new Request('https://relay.internal/rate',{method:'POST',body:JSON.stringify({kind:path==='/api/create'?'create':'join'})}));
    if(!result.ok)return externalCors(request,result);
  }
  // Handshake requires a real WebSocket, and must not be wrapped into a new Response.
  if(path==='/api/events'){
    const code=url.searchParams.get('code')?.toUpperCase();
    if(!validateCode(code)||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket upgrade and valid room required'},426);
    return env.PARTY_ROOM.getByName(code).fetch(request);
  }
  try{
    if(request.method==='POST'&&path==='/api/create'){
      for(let n=0;n<5;n++){
        const code=gen(3).toUpperCase();
        const stub=env.PARTY_ROOM.getByName(code);
        const response=await stub.fetch(new Request('https://relay.internal/create',{method:'POST',body:JSON.stringify({code})}));
        if(response.status===409)continue;
        return externalCors(request,response);
      }
      return externalCors(request,json({error:'Could not create unique room'},503));
    }
    const body=request.method==='POST'?await parse(request,path==='/api/checkpoint'?90000:4096):{};
    const code=(body.code||url.searchParams.get('code')||'').toUpperCase();
    if(!validateCode(code))return externalCors(request,json({error:'Invalid room code'},400));
    const forward=new Request(`https://relay.internal/${path.slice('/api/'.length)}`,{
      method:request.method,headers:{'content-type':'application/json'},body:request.method==='POST'?JSON.stringify(body):undefined
    });
    if(request.method==='GET')forward.headers.set('x-room-token',url.searchParams.get('token')||'');
    return externalCors(request,await env.PARTY_ROOM.getByName(code).fetch(forward));
  }catch(e){return externalCors(request,json({error:e.message||'Relay request error'},400));}
 }
};

/** Durable Object accepts hibernatable WebSockets and persists lobby state. */
export function makePartyRoom(Base){return class PartyRoom extends Base {
 constructor(ctx,env){super(ctx,env);this.room=null;this.loading=null;this.rate=new Map();}
 async load(){if(this.room)return this.room;if(!this.loading)this.loading=this.ctx.storage.get('room').then(r=>{this.room=r||null;return this.room;});return this.loading;}
 async save(){await this.ctx.storage.put('room',this.room);}
 alive(){return this.room&&this.room.createdAt+ROOM_TTL>Date.now();}
 auth(token){if(!this.room||typeof token!=='string')return null;if(token===this.room.hostToken)return {host:true};return this.room.players.find(p=>p.token===token)||null;}
 snapshot(p){const r=this.room;return {type:'room',code:r.code,phase:r.phase,mode:r.mode,roundNumber:r.roundNumber||0,players:r.players.map(({id,name,teamId,teamName,teamColor,role,seat,online})=>({id,name,teamId,teamName,teamColor,role,seat,online})),teams:r.players.length>=2?allocateTeams(r.players.length):[],...(p.host?{checkpoint:r.checkpoint||null}:{}),hostOnline:this.ctx.getWebSockets().some(ws=>ws.readyState===1&&ws.deserializeAttachment()?.host&&ws.deserializeAttachment()?.authenticated),rosterLocked:!!r.rosterLocked,you:p.host?{host:true}:{id:p.id,role:p.role,teamId:p.teamId},maxPlayers:MAX_PLAYERS};}
 forSockets(fn){for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a?.authenticated)fn(ws,a);}}
 send(ws,data){try{ws.send(JSON.stringify(data));}catch{}}
 broadcastState(){this.forSockets((ws,a)=>{const p=this.auth(a.token);if(p)this.send(ws,this.snapshot(p));});}
 broadcastHost(data){this.forSockets((ws,a)=>{if(a.host)this.send(ws,data);});}
 broadcastTelemetry(teams){this.forSockets((ws,a)=>{const p=this.auth(a.token);if(!p||p.host)return;const t=teams.find(x=>x.id===p.teamId);if(t)this.send(ws,{type:'telemetry',teamId:t.id,progress:t.progress,unsteady:t.unsteady,expectedSide:t.expectedSide,phase:t.phase,mode:this.room.mode});});}
 rebalance(){if(this.room.phase!=='lobby')return;const players=this.room.players,alloc=assignPlayers(players);for(let i=0;i<players.length;i++){const x=alloc[i],p=players[i];p.teamId=x?.teamId??null;p.teamName=x?.teamName??null;p.teamColor=x?.teamColor??null;p.seat=x?.seat??null;p.role=alloc.filter(t=>t.teamId===x?.teamId)[((x?.seat||0)+(this.room.roundNumber||0))%alloc.filter(t=>t.teamId===x?.teamId).length]?.role??null;p.seq=0;p.controls={};}}
 validatedInput(p,seq,controls){if(this.room.phase!=='playing')throw Error('Match not active');if(!Number.isSafeInteger(seq)||seq<=p.seq)return false;const keys=ACTIONS[p.role]||[];if(!controls||typeof controls!=='object'||Array.isArray(controls)||Object.entries(controls).some(([k,v])=>!keys.includes(k)||typeof v!=='boolean'))throw Error('Invalid controls for role');p.seq=seq;p.controls=Object.fromEntries(keys.map(k=>[k,controls[k]===true]));this.broadcastHost({type:'input',playerId:p.id,teamId:p.teamId,controls:p.controls,seq});return true;}
 async fetch(request){const url=new URL(request.url),path=url.pathname;
  try{
   if(path==='/rate'&&request.method==='POST'){
     const {kind}=await parse(request);
     if(!['create','join'].includes(kind))return json({error:'Invalid request'},400);
     const now=Date.now(),limit=kind==='create'?8:100,windowMs=60000;
     const limits=(await this.ctx.storage.get('limits'))||{};
     const prev=limits[kind]||{start:now,count:0};
     const next=now-prev.start>=windowMs?{start:now,count:0}:prev;
     next.count++;limits[kind]=next;await this.ctx.storage.put('limits',limits);
     if(next.count>limit)return json({error:'Too many requests. Wait a minute.'},429);
     return json({ok:true});
   }
   await this.load();
   if(path==='/create'&&request.method==='POST'){
     if(this.alive())return json({error:'Room code collision'},409);
     const {code}=await parse(request);if(!validateCode(code))return json({error:'Invalid room'},400);
     this.room={code,hostToken:gen(24),createdAt:Date.now(),phase:'lobby',mode:'walk',roundNumber:0,rosterLocked:false,players:[]};
     await this.save();await this.ctx.storage.setAlarm(Date.now()+ROOM_TTL);
     return json({code,token:this.room.hostToken});
   }
   if(!this.alive())return json({error:'Room expired. Please create another.'},404);
   if((path==='/events'||path==='/api/events')&&request.headers.get('Upgrade')?.toLowerCase()==='websocket'){
     if(this.ctx.getWebSockets().filter(ws=>ws.readyState===1).length>75)return json({error:'Room connection capacity exceeded'},429);
     const pair=new WebSocketPair(),[client,server]=Object.values(pair);
     this.ctx.acceptWebSocket(server);server.serializeAttachment({authenticated:false,connectedAt:Date.now()});return new Response(null,{status:101,webSocket:client});
   }
   const body=request.method==='POST'?await parse(request,path==='/checkpoint'?90000:4096):{};
   if(path==='/join'&&request.method==='POST'){
     let p=body.token?this.room.players.find(p=>p.token===body.token):null;
     if(p){
       // Session rotation enables a refreshed phone to start at sequence 1, and revokes prior tabs.
       this.broadcastHost({type:'input',playerId:p.id,teamId:p.teamId,controls:{},seq:p.seq+1});
       for(const ws of this.ctx.getWebSockets())if(ws.deserializeAttachment()?.token===p.token)try{ws.close(1000,'Rejoined from another tab');}catch{}
       p.token=gen(24);p.seq=0;p.controls={};p.online=false;
     }else{
       if(this.room.phase!=='lobby'||this.room.rosterLocked)throw Error('Tournament roster is locked. Rejoin on your existing phone or wait for a new party.');
       if(this.room.players.length>=25)throw Error('Room full (25 players)');
       p={id:crypto.randomUUID(),token:gen(24),name:cleanName(body.name),teamId:null,role:null,online:false,controls:{},seq:0};
       this.room.players.push(p);this.rebalance();
     }
     await this.save();this.broadcastState();return json({code:this.room.code,token:p.token,id:p.id});
   }
   const token=request.headers.get('x-room-token')||body.token;const p=this.auth(token);
   if(!p)return json({error:'Invalid session'},401);
   if(path==='/state'&&['GET','POST'].includes(request.method))return json(this.snapshot(p));
   if(path==='/input'&&request.method==='POST'){
     if(p.host)return json({error:'Players only'},403);
     const now=Date.now(),key='http:'+p.token;let rate=this.rate.get(key)||{start:now,n:0};if(now-rate.start>1000)rate={start:now,n:0};if(++rate.n>12)throw Error('Input rate limit exceeded');this.rate.set(key,rate);
     const accepted=this.validatedInput(p,body.seq,body.controls);return json({ok:true,accepted});
   }
   if(!p.host)return json({error:'Host access required'},403);
   if(path==='/mode'&&request.method==='POST'){
     if(this.room.phase!=='lobby'||!EVENT_IDS.includes(body.mode))throw Error('Select the challenge in the lobby');
     this.room.mode=body.mode;await this.save();this.broadcastState();return json({ok:true});
   }
   if(path==='/start'&&request.method==='POST'){
     if(this.room.phase!=='lobby'||this.room.players.length<2)throw Error('At least two players required in lobby');
     this.rebalance();if(body.format==='olympics')this.room.rosterLocked=true;this.room.phase='playing';await this.save();this.broadcastState();return json({ok:true});
   }
   if(path==='/reset'&&request.method==='POST'){
     this.room.roundNumber=body.finishTournament?0:(this.room.roundNumber||0)+1;this.room.phase='lobby';if(body.finishTournament)this.room.rosterLocked=false;this.rebalance();await this.save();this.broadcastState();return json({ok:true});
   }
   if(path==='/checkpoint'&&request.method==='POST'){
     if(!body.state||typeof body.state!=='object'||Array.isArray(body.state)||body.state.code!==this.room.code||body.state.mode!==this.room.mode)throw Error('Invalid checkpoint');
     if(JSON.stringify(body.state).length>82000)throw Error('Checkpoint too large');
     this.room.checkpoint=body.state;await this.save();return json({ok:true});
   }
   if(path==='/kick'&&request.method==='POST'){
     if(this.room.phase!=='lobby'||this.room.rosterLocked)throw Error('Players can only be removed before starting a tournament');
     const index=this.room.players.findIndex(player=>player.id===body.playerId);
     if(index<0)throw Error('Unknown player');
     const removed=this.room.players[index];
     for(const ws of this.ctx.getWebSockets())if(ws.deserializeAttachment()?.token===removed.token){
       this.send(ws,{type:'kicked'});try{ws.close(1000,'Removed by host');}catch{}
     }
     this.room.players.splice(index,1);this.rebalance();await this.save();this.broadcastState();return json({ok:true});
   }
   if(path==='/end'&&request.method==='POST'){
     this.forSockets((ws)=>{this.send(ws,{type:'ended'});try{ws.close(1000,'Party ended by host');}catch{}});
     this.room=null;await this.ctx.storage.deleteAll();return json({ok:true});
   }
   if(path==='/telemetry'&&request.method==='POST'){
     if(this.room.phase==='playing'&&Array.isArray(body.teams))this.broadcastTelemetry(body.teams.slice(0,5).map(x=>({id:Number(x.id),progress:Math.max(0,Math.min(1,Number(x.progress)||0)),unsteady:Math.max(0,Math.min(1,Number(x.unsteady)||0)),expectedSide:String(x.expectedSide||'left').slice(0,8),phase:String(x.phase||'').slice(0,20)})));
     return json({ok:true});
   }
   return json({error:'Unknown API endpoint'},404);
  }catch(e){return json({error:e.message||'Invalid request'},400);}
 }
 async webSocketMessage(ws,data){
  try{
   if(typeof data!=='string'||data.length>2048){ws.close(1009,'Invalid message');return;}
   const msg=JSON.parse(data);await this.load();if(!this.alive()){ws.close(1008,'Expired room');return;}
   const attachment=ws.deserializeAttachment()||{};
   if(!attachment.authenticated){
     if(msg.type!=='auth'||Date.now()-attachment.connectedAt>10000){ws.close(1008,'Authentication required');return;}
     const p=this.auth(msg.token);if(!p||msg.code!==this.room.code){ws.close(1008,'Invalid session');return;}
     attachment.authenticated=true;attachment.token=msg.token;attachment.host=!!p.host;attachment.playerId=p.id||null;
     ws.serializeAttachment(attachment);
     if(p.host){
       for(const other of this.ctx.getWebSockets())if(other!==ws && other.readyState===1 && other.deserializeAttachment()?.host)try{other.close(1000,'Host reconnected in another tab');}catch{}
     }else{
       for(const other of this.ctx.getWebSockets())if(other!==ws&&other.readyState===1&&other.deserializeAttachment()?.token===msg.token)try{other.close(1000,'Same phone joined in another tab');}catch{}
       p.online=true;await this.save();}
     this.send(ws,{type:'ready'});this.send(ws,this.snapshot(p));this.broadcastState();return;
   }
   const p=this.auth(attachment.token);if(!p){ws.close(1008,'Expired credentials');return;}
   const now=Date.now();let rate=this.rate.get(attachment.token)||{start:now,n:0};if(now-rate.start>1000)rate={start:now,n:0};if(++rate.n>35){ws.close(1008,'Rate limited');return;}this.rate.set(attachment.token,rate);
   if(msg.type==='input'&&!p.host){this.validatedInput(p,msg.seq,msg.controls);return;}
   if(msg.type==='telemetry'&&p.host){if(Array.isArray(msg.teams))this.broadcastTelemetry(msg.teams.slice(0,5));return;}
   if(msg.type==='ping'){this.send(ws,{type:'pong'});return;}
   ws.close(1008,'Invalid event');
  }catch{ws.close(1008,'Malformed event');}
 }
 async webSocketClose(ws){await this.endSocket(ws);}
 async webSocketError(ws){await this.endSocket(ws);}
 async endSocket(ws){const a=ws.deserializeAttachment();if(!a?.authenticated)return;
  if(a.host){await this.load();const otherHost=this.ctx.getWebSockets().some(other=>other!==ws&&other.readyState===1&&other.deserializeAttachment()?.authenticated&&other.deserializeAttachment()?.host);if(!otherHost&&this.room)this.broadcastState();return;}
  await this.load();const p=this.auth(a.token);if(!p)return;
  const stillActive=this.ctx.getWebSockets().some(other=>other!==ws&&other.deserializeAttachment()?.token===a.token&&other.readyState===1);
  if(stillActive)return;
  p.online=false;p.controls={};p.seq++;this.broadcastHost({type:'input',playerId:p.id,teamId:p.teamId,controls:{},seq:p.seq});await this.save();this.broadcastState();
 }
 async alarm(){await this.ctx.storage.deleteAll();this.room=null;this.loading=null;this.forSockets((ws)=>ws.close(1000,'Room expired'));}
}
;}