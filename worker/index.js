import { DurableObject } from 'cloudflare:workers';
import handler,{makePartyRoom} from './implementation.js';
/** Explicit exported Durable Object class as required by Wrangler. */
export class PartyRoom extends makePartyRoom(DurableObject) {}
export default handler;