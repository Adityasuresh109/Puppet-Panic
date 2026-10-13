/** Public cloud relay and localhost LAN share one browser transport. */
const KEY='puppet-panic-relay';
function validRelay(value){
  if(!value)return '';
  try{const u=new URL(value);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'&&u.pathname!=='')return '';if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))return '';return u.origin;}
  catch{return '';}
}
const chosen=new URL(location.href).searchParams.get('relay');
if(chosen&&validRelay(chosen))sessionStorage.setItem(KEY,validRelay(chosen));
/** Static GitHub Pages defaults to an unset relay until owner configures Worker URL. */
const DEFAULT_PUBLIC_RELAY = location.hostname==='adityasuresh109.github.io' ? 'https://puppet-panic-relay.adityasuresh2110.workers.dev' : '';
export const RELAY=validRelay(chosen)||validRelay(globalThis.PUPPET_RELAY_URL)||validRelay(sessionStorage.getItem(KEY))||DEFAULT_PUBLIC_RELAY;
export const CLOUD=Boolean(RELAY);
export function configured(){return Boolean(RELAY)||['localhost','127.0.0.1'].includes(location.hostname);}
export function partyLink(code){const u=new URL('./controller.html',location.href);u.searchParams.set('room',code);u.searchParams.delete('preview');if(RELAY)u.searchParams.set('relay',RELAY);return u.toString();}
export async function request(path,data={},method='POST'){
  if(!configured())throw Error('The public multiplayer server is not connected yet. Set up the Cloudflare relay before inviting guests.');
  const url=(RELAY||'')+'/api/'+path;
  const res=await fetch(url,{method,mode:'cors',cache:'no-store',headers:{'content-type':'application/json'},body:method==='POST'?JSON.stringify(data):undefined});
  let payload;try{payload=await res.json();}catch{throw Error('Room server did not return a valid response');}
  if(!res.ok)throw Error(payload.error||'Room server is unavailable');return payload;
}
export function snapshot(code,token){return request('state',{code,token});}
/** Returns a close() handle; auto reconnect and re-authenticate on network loss. */
export function watchRoom(code,token,{onMessage,onConnection}){
 let closed=false,stream=null,socket=null,retry=null,tries=0,authorized=false;
 const inform=(state)=>onConnection?.(state);
 function connect(){if(closed)return;authorized=false;inform('connecting');
  if(!CLOUD){
   stream=new EventSource(`/api/events?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);
   stream.onopen=()=>{tries=0;authorized=true;inform('connected');};
   stream.onmessage=e=>{try{onMessage(JSON.parse(e.data));}catch{}};
   stream.onerror=()=>{inform('reconnecting');};return;
  }
  const wsUrl=RELAY.replace(/^http/,'ws')+`/api/events?code=${encodeURIComponent(code)}`;
  socket=new WebSocket(wsUrl);
  socket.onopen=()=>socket.send(JSON.stringify({type:'auth',code,token}));
  socket.onmessage=e=>{try{const data=JSON.parse(e.data);
    if(data.type==='ready'){authorized=true;tries=0;inform('connected');return;}
    if(data.type==='error'){inform('reconnecting');socket?.close();return;}
    onMessage(data);
   }catch{}};
  socket.onclose=()=>{if(closed)return;authorized=false;inform('reconnecting');retry=setTimeout(connect,Math.min(7000,450*2**Math.min(5,tries++)));};
  socket.onerror=()=>inform('reconnecting');
 }
 connect();return {
  send:(data)=>{if(!CLOUD||!authorized||socket?.readyState!==WebSocket.OPEN)return false;socket.send(JSON.stringify(data));return true;},
  connected:()=>authorized,
  close:()=>{closed=true;if(retry)clearTimeout(retry);stream?.close();socket?.close();}
 };
}