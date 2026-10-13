import {allocateTeams,assignPlayers,ACTIONS,MAX_PLAYERS} from '../src/teams.js';

const ORIGINS=new Set(['https://adityasuresh109.github.io','http://localhost:4173','http://127.0.0.1:4173']);
const ROOM_TTL=4*60*60*1000;
const gen=(n)=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');
const validateCode=c=>typeof c==='string'&&/^[A-F0-9]{6}$/.test(c.toUpperCase());
const cleanName=s=>String(s||'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,24)||'Mystery Player';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const parse=async request=>{if(Number(request.headers.get('content-length')||0)>4096)throw Error('Request too large');const data=await request.text();if(data.length>4096)throw Error('Request too large');return data?JSON.parse(data):{};};
const sameOrigin=request=>{const origin=request.headers.get('origin');return !origin||ORIGINS.has(origin);};
function externalCors(request,response){const origin=request.headers.get('origin');const headers=new Headers(response.headers);if(origin&&ORIGINS.has(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','content-type');}return new Response(response.body,{status:response.status,headers});}

export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='OPTIONS')return externalCors(request,new Response(null,{status:204}));
  if(!sameOrigin(request))return json({error:'This website is not authorized to use the game relay'},403);
  if(path==='/health')return externalCors(request,json({ok:true,version:1,service:'puppet-panic-relay'}));
  if(!path.startsWith('/api/'))return externalCors(request,json({error:'Unknown endpoint'},404));
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
    const body=request.method==='POST'?await parse(request):{};
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
 snapshot(p){const r=this.room;return {type:'room',code:r.code,phase:r.phase,mode:r.mode,players:r.players.map(({id,name,teamId,teamName,teamColor,role,seat,online})=>({id,name,teamId,teamName,teamColor,role,seat,online})),teams:r.players.length>=2?allocateTeams(r.players.length):[],you:p.host?{host:true}:{id:p.id,role:p.role,teamId:p.teamId},maxPlayers:MAX_PLAYERS};}
 forSockets(fn){for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a?.authenticated)fn(ws,a);}}
 send(ws,data){try{ws.send(JSON.stringify(data));}catch{}}
 broadcastState(){this.forSockets((ws,a)=>{const p=this.auth(a.token);if(p)this.send(ws,this.snapshot(p));});}
 broadcastHost(data){this.forSockets((ws,a)=>{if(a.host)this.send(ws,data);});}
 broadcastTelemetry(teams){this.forSockets((ws,a)=>{const p=this.auth(a.token);if(!p||p.host)return;const t=teams.find(x=>x.id===p.teamId);if(t)this.send(ws,{type:'telemetry',teamId:t.id,progress:t.progress,unsteady:t.unsteady,expectedSide:t.expectedSide,phase:t.phase,mode:this.room.mode});});}
 rebalance(){if(this.room.phase!=='lobby')return;const players=this.room.players,alloc=assignPlayers(players);for(let i=0;i<players.length;i++){const x=alloc[i],p=players[i];p.teamId=x?.teamId??null;p.teamName=x?.teamName??null;p.teamColor=x?.teamColor??null;p.seat=x?.seat??null;p.role=x?.role??null;p.seq=0;p.controls={};}}
 validatedInput(p,seq,controls){if(this.room.phase!=='playing')throw Error('Match not active');if(!Number.isSafeInteger(seq)||seq<=p.seq)return false;const keys=ACTIONS[p.role]||[];if(!controls||typeof controls!=='object'||Array.isArray(controls)||Object.entries(controls).some(([k,v])=>!keys.includes(k)||typeof v!=='boolean'))throw Error('Invalid controls for role');p.seq=seq;p.controls=Object.fromEntries(keys.map(k=>[k,controls[k]===true]));this.broadcastHost({type:'input',playerId:p.id,teamId:p.teamId,controls:p.controls,seq});return true;}
 async fetch(request){const url=new URL(request.url),path=url.pathname;
  try{
   await this.load();
   if(path==='/create'&&request.method==='POST'){
     if(this.alive())return json({error:'Room code collision'},409);
     const {code}=await parse(request);if(!validateCode(code))return json({error:'Invalid room'},400);
     this.room={code,hostToken:gen(24),createdAt:Date.now(),phase:'lobby',mode:'walk',players:[]};
     await this.save();await this.ctx.storage.setAlarm(Date.now()+ROOM_TTL);
     return json({code,token:this.room.hostToken});
   }
   if(!this.alive())return json({error:'Room expired. Please create another.'},404);
   if((path==='/events'||path==='/api/events')&&request.headers.get('Upgrade')?.toLowerCase()==='websocket'){
     if(this.ctx.getWebSockets().length>40)return json({error:'Room connection capacity exceeded'},429);
     const pair=new WebSocketPair(),[client,server]=Object.values(pair);
     this.ctx.acceptWebSocket(server);server.serializeAttachment({authenticated:false,connectedAt:Date.now()});return new Response(null,{status:101,webSocket:client});
   }
   const body=request.method==='POST'?await parse(request):{};
   if(path==='/join'&&request.method==='POST'){
     let p=body.token?this.room.players.find(p=>p.token===body.token):null;
     if(p){
       // Session rotation enables a refreshed phone to start at sequence 1, and revokes prior tabs.
       this.broadcastHost({type:'input',playerId:p.id,teamId:p.teamId,controls:{},seq:p.seq+1});
       for(const ws of this.ctx.getWebSockets())if(ws.deserializeAttachment()?.token===p.token)try{ws.close(1000,'Rejoined from another tab');}catch{}
       p.token=gen(24);p.seq=0;p.controls={};p.online=false;
     }else{
       if(this.room.phase!=='lobby')throw Error('Match already in progress');
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
     const accepted=this.validatedInput(p,body.seq,body.controls);return json({ok:true,accepted});
   }
   if(!p.host)return json({error:'Host access required'},403);
   if(path==='/mode'&&request.method==='POST'){
     if(this.room.phase!=='lobby'||!['walk','cake'].includes(body.mode))throw Error('Select the challenge in the lobby');
     this.room.mode=body.mode;await this.save();this.broadcastState();return json({ok:true});
   }
   if(path==='/start'&&request.method==='POST'){
     if(this.room.phase!=='lobby'||this.room.players.length<2)throw Error('At least two players required in lobby');
     this.rebalance();this.room.phase='playing';await this.save();this.broadcastState();return json({ok:true});
   }
   if(path==='/reset'&&request.method==='POST'){
     this.room.phase='lobby';this.rebalance();await this.save();this.broadcastState();return json({ok:true});
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
     ws.serializeAttachment(attachment);if(!p.host){p.online=true;await this.save();}
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
 async endSocket(ws){const a=ws.deserializeAttachment();if(!a?.authenticated||a.host)return;await this.load();const p=this.auth(a.token);if(!p)return;
  const stillActive=this.ctx.getWebSockets().some(other=>other!==ws&&other.deserializeAttachment()?.token===a.token&&other.readyState===1);
  if(stillActive)return;
  p.online=false;p.controls={};p.seq++;this.broadcastHost({type:'input',playerId:p.id,teamId:p.teamId,controls:{},seq:p.seq});await this.save();this.broadcastState();
 }
 async alarm(){await this.ctx.storage.deleteAll();this.room=null;this.loading=null;this.forSockets((ws)=>ws.close(1000,'Room expired'));}
}
;}