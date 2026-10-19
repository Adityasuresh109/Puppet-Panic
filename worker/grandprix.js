/** Dedicated v2 Worker: keeps the existing v1 production Worker untouched. */
import { DurableObject } from 'cloudflare:workers';
import relay,{makePartyRoom} from './implementation.js';
export class PartyRoom extends makePartyRoom(DurableObject) {}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/health'||url.pathname.startsWith('/api/'))return relay.fetch(request,env);
    if(url.pathname==='/')url.pathname='/grand-prix.html';
    const assetRequest=new Request(url.toString(),request);
    return env.ASSETS.fetch(assetRequest);
  }
};