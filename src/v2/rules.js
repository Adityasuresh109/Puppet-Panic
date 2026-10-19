/** Grand Prix contract. Side-by-side with v1; existing modules remain unmodified. */
export const GP_MIN_PLAYERS = 1;
export const GP_MAX_PLAYERS = 24;
export const GP_MAX_PUPPETS = 6;
export const GP_LIMBS = Object.freeze(['leftLeg','rightLeg','leftArm','rightArm']);
export const GP_COLORS = ['#ff677e','#6ab8ff','#ffd16c','#6ce4b0','#b49cff','#ff9f68'];
export const GP_NAMES = ['RED ROCKETS','BLUE BLUNDERS','GOLD GOOFBALLS','GREEN GREMLINS','PURPLE PANIC','ORANGE OOPS'];
export const GP_ROLES = Object.freeze({
  1: ['ALL_LIMBS'],
  2: ['LEFT_DIAGONAL','RIGHT_DIAGONAL'],
  3: ['LEFT_DIAGONAL','RIGHT_LEG','LEFT_ARM'],
  4: ['LEFT_LEG','RIGHT_LEG','LEFT_ARM','RIGHT_ARM']
});
export const GP_ACTIONS = Object.freeze({
  ALL_LIMBS:[...GP_LIMBS],LEFT_DIAGONAL:['leftLeg','rightArm'],RIGHT_DIAGONAL:['rightLeg','leftArm'],
  LEFT_LEG:['leftLeg'],RIGHT_LEG:['rightLeg'],LEFT_ARM:['leftArm'],RIGHT_ARM:['rightArm']
});
export const GP_ROLE_NAMES = Object.freeze({
  ALL_LIMBS:'ALL FOUR LIMBS',LEFT_DIAGONAL:'LEFT LEG + RIGHT ARM',RIGHT_DIAGONAL:'RIGHT LEG + LEFT ARM',
  LEFT_LEG:'LEFT LEG',RIGHT_LEG:'RIGHT LEG',LEFT_ARM:'LEFT ARM',RIGHT_ARM:'RIGHT ARM'
});
export const GP_EVENT_IDS = ['walk','cake','swing','climb','finale'];
export const GP_EVENTS = Object.freeze([
  {id:'walk',name:'WALK GRAND PRIX',icon:'🏁',seconds:90,instruction:'Left, right, left, right! Swing your arms to zoom ahead.'},
  {id:'cake',name:'CAKE DELIVERY DASH',icon:'🎂',seconds:110,instruction:'Arms hold the cake up. Legs take smooth, steady steps.'},
  {id:'swing',name:'ROPE ROCKETS',icon:'🪢',seconds:110,instruction:'Arms hold the rope. Legs pump left and right.'},
  {id:'climb',name:'THE CLIMB',icon:'🧗',seconds:120,instruction:'Hold on with three limbs. Move just one at a time.'},
  {id:'finale',name:'GRAND PRIX FINALE',icon:'🏆',seconds:150,instruction:'Race, save the cake, then climb to the finish!'}
]);
export function gpTeams(total){
  if(!Number.isInteger(total)||total<GP_MIN_PLAYERS||total>GP_MAX_PLAYERS)throw new RangeError('Grand Prix supports 1–24 players');
  const n=Math.ceil(total/4),base=Math.floor(total/n),extra=total%n;
  return Array.from({length:n},(_,i)=>({id:i,color:GP_COLORS[i],name:GP_NAMES[i],size:base+Number(i<extra)}));
}
export function gpAssign(players,round=0){
  const teams=gpTeams(players.length),assignments=[];let index=0;
  for(const team of teams){
    const roles=GP_ROLES[team.size];
    for(let seat=0;seat<team.size;seat++)assignments.push({...players[index++],teamId:team.id,teamName:team.name,teamColor:team.color,role:roles[(seat+round)%roles.length],seat});
  }
  return assignments;
}
export function gpInputs(players){
  const inputs=Object.fromEntries(GP_LIMBS.map(k=>[k,false]));
  for(const player of players){
    for(const key of GP_ACTIONS[player.role]||[])inputs[key] ||=player.controls?.[key]===true;
  }
  return inputs;
}
export function gpStage(mode,progress){
  if(mode!=='finale')return mode;
  return progress<1/3?'walk':progress<2/3?'cake':'climb';
}
export function gpJob(limb,stage){
  const isLeg=limb.endsWith('Leg'),side=limb.startsWith('left')?'LEFT':'RIGHT';
  if(stage==='walk')return isLeg?`${side} LEG 🦵 — Step on the beat!`:`${side} ARM 💪 — Swing to run faster!`;
  if(stage==='cake')return isLeg?`${side} LEG 🦵 — Step smoothly!`:`${side} ARM 🎂 — HOLD THE CAKE UP!`;
  if(stage==='swing')return isLeg?`${side} LEG 🦵 — Pump the swing!`:`${side} ARM 🪢 — GRIP! Don't let go!`;
  if(stage==='climb')return `${side} ${isLeg?'LEG':'ARM'} 🧗 — Hold on! Take turns reaching!`;
  return '';
}