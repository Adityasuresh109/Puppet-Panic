/** Grand Prix preview relay: cannot connect to a v1 production room accidentally. */
const previewWorker='puppet-panic-grand-prix.adityasuresh2110.workers.dev';
const onPreview=location.hostname===previewWorker;
const query=new URL(location.href).searchParams.get('relay');
const allowed=(value)=>{if(!value)return '';try{const u=new URL(value);if(u.username||u.password||u.search||u.hash||u.pathname!=='/')return '';if(u.protocol!=='https:'&&!(['127.0.0.1','localhost'].includes(u.hostname)&&u.protocol==='http:'))return '';return u.origin;}catch{return '';}};
export const RELAY=onPreview?location.origin:allowed(query);
export const CLOUD=Boolean(RELAY);
export const configured=()=>true;
export const invite=code=>{const u=new URL('./grand-prix-controller.html',location.href);u.searchParams.set('room',code);if(RELAY&&!onPreview)u.searchParams.set('relay',RELAY);return u.toString();};
export async function request(path,data={}){
 const res=await fetch((RELAY||'')+'/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
 const body=await res.json().catch(()=>({error:'Invalid server response'}));
 if(!res.ok)throw Error(body.error||'Room server unavailable');return body;
}
export const snapshot=(code,token)=>request('state',{code,token});
export function watchRoom(code,token,{onMessage,onConnection}){
 let stopped=false,ws=null,sse=null,retry=null,tries=0,ready=false;
 const notify=x=>onConnection?.(x);
 function open(){if(stopped)return;ready=false;notify('connecting');
  if(!CLOUD){
   sse=new EventSource('/api/events?code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token));
   sse.onopen=()=>{ready=true;tries=0;notify('connected');};
   sse.onmessage=e=>{try{onMessage(JSON.parse(e.data));}catch{}};
   sse.onerror=()=>notify('reconnecting');return;
  }
  ws=new WebSocket(RELAY.replace(/^http/,'ws')+'/api/events?code='+encodeURIComponent(code));
  ws.onopen=()=>ws.send(JSON.stringify({type:'auth',code,token}));
  ws.onmessage=e=>{try{const data=JSON.parse(e.data);if(data.type==='ready'){ready=true;tries=0;notify('connected');return;}if(data.type==='error'){ws.close();return;}onMessage(data);}catch{}};
  ws.onclose=()=>{if(stopped)return;ready=false;notify('reconnecting');retry=setTimeout(open,Math.min(6000,400*2**Math.min(5,tries++)));};
  ws.onerror=()=>notify('reconnecting');
 }
 open();return {send(msg){if(!ready||!CLOUD||ws?.readyState!==WebSocket.OPEN)return false;ws.send(JSON.stringify(msg));return true;},close(){stopped=true;clearTimeout(retry);ws?.close();sse?.close();},connected(){return ready;}};
}