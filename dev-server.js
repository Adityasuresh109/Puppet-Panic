/** No-dependency local LAN room server. Production hosting needs a durable public relay. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {RoomStore} from './src/server/rooms.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const store=new RoomStore();
const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
const readBody=async req=>{let s='';for await(const chunk of req){s+=chunk;if(s.length>8192)throw Error('Request too large');}return s?JSON.parse(s):{};};
export function createApp(){return http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');const route=url.pathname;
  if(route==='/health')return send(res,200,{ok:true,version:1,service:'puppet-panic-lan'});
  if(route.startsWith('/api/')){
   try{
    if(route==='/api/create'&&req.method==='POST'){const room=store.create();return send(res,200,{code:room.code,token:room.hostToken});}
    const body=req.method==='POST'?await readBody(req):{};
    const room=store.find(body.code||url.searchParams.get('code'));
    if(!room) return send(res,404,{error:'Room not found. Ask the host for the new code.'});
    if(route==='/api/join'&&req.method==='POST'){
      const p=store.join(room,body.name,body.token);return send(res,200,{code:room.code,token:p.token,id:p.id});
    }
    const key=body.token||url.searchParams.get('token');const person=store.auth(room,key);
    if(!person) return send(res,401,{error:'Invalid or expired room session'});
    if(route==='/api/state'&&['GET','POST'].includes(req.method))return send(res,200,store.snapshot(room,person));
    if(route==='/api/events'&&req.method==='GET'){
      res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform',connection:'keep-alive','x-accel-buffering':'no'});
      if(!room.connections.has(key))room.connections.set(key,new Set());room.connections.get(key).add(res);
      if(!person.host)person.online=true;store.notify(room);
      store.emit(room,key,store.snapshot(room,person));
      const keep=setInterval(()=>{if(!res.destroyed)res.write(': ping\n\n');},12000);
      res.on('close',()=>{clearInterval(keep);room.connections.get(key)?.delete(res);if(!room.connections.get(key)?.size){room.connections.delete(key);if(!person.host)store.disconnect(room,person);else store.notify(room);}});
      return;
    }
    if(route==='/api/input'&&req.method==='POST'){
      if(person.host)return send(res,403,{error:'Host cannot send player controls'});
      store.input(room,person,body.seq,body.controls);return send(res,200,{ok:true});
    }
    if(!person.host)return send(res,403,{error:'Host access required'});
    if(route==='/api/mode'&&req.method==='POST'){store.mode(room,body.mode);return send(res,200,{ok:true});}
    if(route==='/api/start'&&req.method==='POST'){store.start(room,body.format);return send(res,200,{ok:true});}
    if(route==='/api/reset'&&req.method==='POST'){store.reset(room,body.finishTournament);return send(res,200,{ok:true});}
    if(route==='/api/end'&&req.method==='POST'){store.end(room);return send(res,200,{ok:true});}
    if(route==='/api/telemetry'&&req.method==='POST'){
      // The host owns simulation/score. Publish only bounded, non-sensitive status to phones.
      if(room.phase==='playing'&&Array.isArray(body.teams)) for(const [key] of room.connections){const who=store.auth(room,key);if(!who||who.host)continue;
        const t=body.teams.find(x=>x.id===who.teamId);if(t)store.emit(room,key,{type:'telemetry',teamId:t.id,expectedSide:t.expectedSide,unsteady:t.unsteady,phase:t.phase,progress:t.progress,mode:room.mode});}
      return send(res,200,{ok:true});
    }
    return send(res,404,{error:'Unknown API route'});
   }catch(e){return send(res,400,{error:e.message||'Invalid request'});}
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  let relative;try{relative=decodeURIComponent(route==='/'?'/index.html':route);}catch{return send(res,400,{error:'Invalid path'});}
  const target=path.resolve(root,`.${relative}`);if(relative.split('/').some(part=>part.startsWith('.'))||!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{const data=await fs.readFile(target);res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}
  catch{res.writeHead(404);res.end('Not found');}
 });}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT)||4173;createApp().listen(port,'0.0.0.0',()=>console.log(`Puppet Panic LAN game on http://localhost:${port}`));
}