/** Lightweight original comedy sound and readable one-liners; no paid media services. */
export const CALLS={
  fall:['GRAVITY WINS AGAIN!','THE FLOOR HAS CLAIMED ANOTHER VICTIM!','SOMEONE PLEASE EXPLAIN LEGS!'],
  recover:['AND SOMEHOW WE ARE BACK!','THAT WAS ALMOST ATHLETIC!'],
  cakeDrop:['THERE GOES THE WEDDING CAKE!','DESSERT HAS LEFT THE BUILDING!'],
  bonk:['THAT OBSTACLE WAS NOT IMPRESSED!'],
  finish:['UNBELIEVABLE! A PUPPET ACTUALLY FINISHED!','THE CROWD HAS LOST ITS MIND!'],
  checkpoint:['CHECKPOINT SAVED! THE DRAMA CONTINUES!'],
  stage:['NEW CHALLENGE! SAME QUESTIONABLE COORDINATION!']
};
export function callFor(event,teamName=''){const arr=CALLS[event.type];if(!arr)return '';
 const index=(event.id||0)%arr.length;
 return `${teamName}: ${arr[index]}`;
}
export function beep(kind='step',muted=false){
 if(muted||typeof window==='undefined')return;
 const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
 try{
  if(!beep.context)beep.context=new A();
  const ctx=beep.context;if(ctx.state==='suspended')ctx.resume().catch(()=>{});
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=kind==='fall'?'sawtooth':kind==='finish'?'triangle':'sine';
  const hz=kind==='fall'?180:kind==='finish'?740:kind==='cakeDrop'?260:kind==='checkpoint'?480:320;
  osc.frequency.setValueAtTime(hz,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(60,hz*(kind==='fall'?.38:1.35)),ctx.currentTime+.16);
  gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.06,ctx.currentTime+.012);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.22);
  osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.23);
 }catch{}
}