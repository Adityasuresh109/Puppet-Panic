/** Shared rules for any 2–25 player lobby. No single-player teams. */
export const MAX_PLAYERS=25;
export const MAX_TEAMS=5;
export const COLORS=['#fb6476','#58a7fa','#ffca54','#61dcb1','#aa8bf5'];
export const NAMES=['RED RASCALS','BLUE BONKERS','YELLOW YIKES','GREEN GOBLINS','PURPLE PANIC'];
export const ROLES={
  2:['DUAL_LEGS','UPPER_BODY'],
  3:['DUAL_LEGS','DUAL_ARMS','BALANCE'],
  4:['DUAL_LEGS','LEFT_ARM','RIGHT_ARM','BALANCE'],
  5:['LEFT_LEG','RIGHT_LEG','LEFT_ARM','RIGHT_ARM','BALANCE']
};
export const ROLE_NAMES={DUAL_LEGS:'BOTH LEGS',UPPER_BODY:'UPPER BODY',DUAL_ARMS:'BOTH ARMS',BALANCE:'BODY BALANCE',LEFT_LEG:'LEFT LEG',RIGHT_LEG:'RIGHT LEG',LEFT_ARM:'LEFT ARM',RIGHT_ARM:'RIGHT ARM'};
export const ACTIONS={
  DUAL_LEGS:['leftLeg','rightLeg'],UPPER_BODY:['leanLeft','leanRight','grip','brace'],
  DUAL_ARMS:['leftArm','rightArm'], BALANCE:['leanLeft','leanRight','brace'],
  LEFT_LEG:['leftLeg'],RIGHT_LEG:['rightLeg'],LEFT_ARM:['leftArm'],RIGHT_ARM:['rightArm']
};
export function allocateTeams(total){
  if(!Number.isInteger(total)||total<2||total>MAX_PLAYERS) throw new RangeError('Team allocator requires 2–25 players');
  const n=Math.ceil(total/5),base=Math.floor(total/n),extra=total%n;
  return Array.from({length:n},(_,i)=>({id:i,color:COLORS[i],name:NAMES[i],size:base+Number(i<extra)}));
}
/** Role assignment is stable for the duration of a locked match. Lobby may rebalance. */
export function assignPlayers(players){
  if(players.length<2) return [];
  const teams=allocateTeams(players.length),out=[];let cursor=0;
  for(const team of teams){
    const roles=ROLES[team.size];
    for(let seat=0;seat<team.size;seat++){
      out.push({...players[cursor++],teamId:team.id,teamName:team.name,teamColor:team.color,role:roles[seat],seat});
    }
  }
  return out;
}
export const EMPTY_INPUT=()=>({leftLeg:false,rightLeg:false,leftArm:false,rightArm:false,lean:0,brace:false});
/** Aggregate only permitted per-role input into the five-channel puppet rig. */
export function puppetInputs(players,mode='walk'){
  const input=EMPTY_INPUT();
  for(const p of players){
    const c=p.controls||{};
    const v=key=>Boolean(c[key]);
    switch(p.role){
      case 'LEFT_LEG': input.leftLeg ||= v('leftLeg');break;
      case 'RIGHT_LEG': input.rightLeg ||= v('rightLeg');break;
      case 'DUAL_LEGS': input.leftLeg ||= v('leftLeg');input.rightLeg ||=v('rightLeg');break;
      case 'LEFT_ARM':input.leftArm ||=v('leftArm');break;
      case 'RIGHT_ARM':input.rightArm ||=v('rightArm');break;
      case 'DUAL_ARMS':input.leftArm ||=v('leftArm');input.rightArm ||=v('rightArm');break;
      case 'BALANCE':input.lean+=Number(v('leanRight'))-Number(v('leanLeft'));input.brace ||=v('brace');break;
      case 'UPPER_BODY':{
        const left=v('leanLeft'),right=v('leanRight'),grip=v('grip');
        input.lean+=Number(right)-Number(left);
        // Two-player mode merges swing into deliberate weight transfer, not passive autopilot.
        if(mode==='cake'||mode==='finale'||mode==='swing'){input.leftArm ||=grip;input.rightArm ||=grip;}
        else {input.leftArm ||=left;input.rightArm ||=right;}
        input.brace ||=v('brace');break;
      }
    }
  }
  input.lean=Math.max(-1,Math.min(1,input.lean));
  return input;
}