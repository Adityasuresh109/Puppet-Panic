/** Shared, deterministic rules for Puppet Panic's Olympics events. */
export const EVENTS=Object.freeze([
  {id:'walk',name:'WALK, YOU IDIOTS!',icon:'🚶',seconds:120,instruction:'Alternate feet, counter-swing the opposite arm and lean onto the planted leg.',accent:'#ffd06d'},
  {id:'cake',name:"DON'T DROP THE CAKE!",icon:'🎂',seconds:150,instruction:'Both arms support the tray while legs step and balance holds steady. Save the three layers.',accent:'#ff98c4'},
  {id:'climb',name:'THE IMPOSSIBLE CLIMB',icon:'🧗',seconds:150,instruction:'Climb rung by rung. Alternate feet, secure the opposite hand, and shift weight carefully.',accent:'#76e4c3'},
  {id:'swing',name:'SWING FOR YOUR LIFE',icon:'🪢',seconds:150,instruction:'Both hands grip the ropes. Tuck the alternating leg and lean in time to pump forward.',accent:'#c1a0ff'},
  {id:'finale',name:'PUPPET OLYMPICS FINALE',icon:'🏆',seconds:180,instruction:'Three sections: sprint, protect the cake, and climb the final tower. Every role matters!',accent:'#ffba66'}
]);
export const EVENT_IDS=EVENTS.map(e=>e.id);
export const eventById=(id)=>EVENTS.find(x=>x.id===id) || null;
export const clamp01=(n)=>Math.max(0,Math.min(1,Number(n)||0));
export const secondsText=(n)=>`${String(Math.floor(Math.max(0,n)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,n)%60)).padStart(2,'0')}`;
export function eventStandings(puppets,elapsed,limit){
  const sorted=[...puppets].sort((a,b)=>{
    const aFinish=a.finishedAt!==null,bFinish=b.finishedAt!==null;
    if(aFinish!==bFinish)return aFinish?-1:1;
    if(aFinish)return a.finishedAt-b.finishedAt;
    return b.progress-a.progress || a.falls-b.falls;
  });
  const base=[100,80,65,50,40];
  return sorted.map((p,i)=>{
    const completed=p.finishedAt!==null,progress=clamp01(p.progress);
    const quality=progress===0&&!completed?0:Math.max(0,20-(p.falls*4)-(p.mode==='cake'||p.mode==='finale'?(3-p.layers)*5:0));
    const previous=sorted.slice(0,i).findIndex(other=>{
      if((other.finishedAt!==null)!==completed)return false;
      return completed?Math.abs(other.finishedAt-p.finishedAt)<.25:Math.abs(other.progress-progress)<.001&&other.falls===p.falls;
    });
    const rank=previous>=0?previous+1:i+1;
    const multiplier=p.mode==='finale'?1.5:1;
    const points=progress===0&&!completed?0:Math.round(((base[rank-1]??0)+Math.min(quality,rank===1?20:Math.max(0,(base[rank-2]??0)-(base[rank-1]??0)-1)))*multiplier);
    return {teamId:p.lane,name:p.name,rank,points,quality,completed,progress,falls:p.falls,layers:p.layers,seconds:completed?p.finishedAt:Math.min(elapsed,limit)};
  });
}
export function tallyTournament(rounds){
  const table=new Map();
  for(const r of rounds){for(const s of r.standings||[]){
    const cur=table.get(s.teamId)||{teamId:s.teamId,name:s.name,points:0,wins:0,events:0,falls:0};
    cur.points+=s.points;cur.wins+=Number(s.rank===1);cur.events++;cur.falls+=s.falls;
    table.set(s.teamId,cur);
  }}
  return [...table.values()].sort((a,b)=>b.points-a.points || b.wins-a.wins || a.falls-b.falls || a.teamId-b.teamId);
}