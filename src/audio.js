/** Tiny license-free synthesized comedy audio (no external assets). */
export class Sound {
  constructor(){this.enabled=true;this.ctx=null;}
  play(name){
    if(!this.enabled) return;
    try {
      this.ctx ||=new(window.AudioContext||window.webkitAudioContext)();
      if(this.ctx.state==='suspended')this.ctx.resume();
      const now=this.ctx.currentTime,osc=this.ctx.createOscillator(),g=this.ctx.createGain();
      osc.connect(g);g.connect(this.ctx.destination);
      const sounds={step:[170,80,.08,'triangle'],fall:[410,68,.34,'sawtooth'],bonk:[510,90,.17,'square'],checkpoint:[540,940,.26,'triangle'],finish:[380,1060,.48,'triangle'],brace:[260,400,.12,'sine'],swing:[240,330,.09,'sine'],recover:[150,310,.22,'triangle']};
      const [start,end,duration,type]=sounds[name]||sounds.step;
      osc.type=type;osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(Math.max(end,20),now+duration);
      g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(name==='fall'?.065:.035,now+.016);
      g.gain.exponentialRampToValueAtTime(.0001,now+duration);
      osc.start(now);osc.stop(now+duration+.01);
    }catch{}
  }
}