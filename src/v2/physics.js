import {GP_LIMBS,gpStage} from './rules.js';
export const GP_TRACK=1800;
export const GP_DT=1/60;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** Assisted rhythm physics: deterministic, forgiving and no idle failures. */
export class GrandPrixPuppet {
 constructor({mode='walk',lane=0,color='#ff6787',name='PUPPET'}={}){
  this.mode=mode;this.lane=lane;this.color=color;this.name=name;
  this.x=0;this.elapsed=0;this.finishedAt=null;this.falls=0;this.stumbles=0;this.steps=0;
  this.wobble=0;this.phase='upright';this.recovery=0;this.layers=3;this.events=[];
  this.input=Object.fromEntries(GP_LIMBS.map(k=>[k,false]));
  this.hold=Object.fromEntries(GP_LIMBS.map(k=>[k,0]));this.moving=Object.fromEntries(GP_LIMBS.map(k=>[k,0]));
  this.prev={...this.input};this.expected='left';this.lastStep=-10;this.lastAction=-10;
  this._badBoth=0;this._armDrop=0;this._invalidReach=false;this._actions=0;this.lastStage=gpStage(mode,0);
 }
 get progress(){return clamp(this.x/GP_TRACK,0,1);}
 get stage(){return gpStage(this.mode,this.progress);}
 get beat(){return this.elapsed%1;}
 setInput(values={}){for(const limb of GP_LIMBS)this.input[limb]=values[limb]===true;}
 emit(type){this.events.push({type,time:this.elapsed,id:this.events.length+1,position:this.x});if(this.events.length>90)this.events.shift();}
 stumble(){this.stumbles++;this.wobble=clamp(this.wobble+.13,0,2);this.emit('stumble');}
 fall(){if(this.phase==='fallen')return;this.falls++;this.phase='fallen';this.recovery=1;this.wobble=.5;this._badBoth=0;this._armDrop=0;this.emit('fall');}
 step(limb,hold,stage){
  if(this.elapsed-this.lastStep<.35){this.stumble();return;}
  if(limb!==this.expected){this.stumble();return;}
  if(hold<.15||hold>1.05){this.stumble();return;}
  this.expected=limb==='left'?'right':'left';this.steps++;this.lastStep=this.elapsed;
  const arm=limb==='left'?'rightArm':'leftArm';
  // The beat only rewards: even late or early steps still move.
  const distanceToBeat=Math.min(this.beat,1-this.beat);
  const rhythm=distanceToBeat<.22?1.10:.86;
  let distance=51*rhythm;
  if(stage==='walk'&&this.input[arm])distance*=1.4;
  if(stage==='cake'){
    distance*=.89;
    if(!this.input.leftArm||!this.input.rightArm)this.tipCake();
  }
  if(stage==='swing'){
    distance*=this.input.leftArm&&this.input.rightArm?1.30:.24;
    if(!this.input.leftArm||!this.input.rightArm)this.stumble();
  }
  // Speed comes from frequent correct stepping. Messy high-speed steps
  // accumulate visible instability, but do not arbitrarily slow movement.
  if(this.lastAction>0&&this.elapsed-this.lastAction<.58)this.wobble+=.065;
  this.lastAction=this.elapsed;
  this.advance(distance);
  this.emit('step');
 }
 tipCake(){
  if(this.layers>0){this.layers--;this.emit('cakeDrop');}
  this.wobble=clamp(this.wobble+.15,0,2);
 }
 advance(distance){this.x=clamp(this.x+distance,0,GP_TRACK);if(this.x>=GP_TRACK&&this.finishedAt===null){this.finishedAt=this.elapsed;this.phase='finished';this.emit('finish');}}
 update(dt=GP_DT){
  dt=clamp(dt,0,.05);if(this.phase==='finished')return;
  this.elapsed+=dt;
  if(this.phase==='fallen'){
    this.recovery-=dt;
    if(this.recovery<=0){this.phase='upright';this.wobble=.12;this.prev={...this.input};this.emit('recover');}
    return;
  }
  const stage=this.stage;
  if(stage!==this.lastStage){this.lastStage=stage;this._armDrop=0;this._badBoth=0;this.emit('stage');}
  this.wobble=Math.max(0,this.wobble-dt*.34); // standing still is safe
  for(const k of GP_LIMBS){
    if(this.input[k])this.hold[k]+=dt;
    else if(this.prev[k])this.moving[k]=0;
  }
  if(stage==='climb'){
    // All limbs are grips: RELEASE one limb to reach, then HOLD to re-grip.
    // A reach works only if the other three are gripping.
    const released=GP_LIMBS.filter(k=>!this.input[k]);
    if(released.length>=2)this._invalidReach=true;
    for(const limb of GP_LIMBS){
      if(!this.input[limb]&&this.prev[limb])this.moving[limb]=dt;
      else if(!this.input[limb]&&this.moving[limb]>0)this.moving[limb]+=dt;
      if(this.input[limb]&&!this.prev[limb]&&this.moving[limb]>0){
        const time=this.moving[limb];this.moving[limb]=0;
        if(released.length===0&&!this._invalidReach&&time>=.15&&time<=1.2&&this.elapsed-this.lastStep>=.35){
          this.lastStep=this.elapsed;this.steps++;this.advance(54);this.emit('climb');
        }else this.stumble();
      }
    }
    if(released.length>=2){this.wobble=clamp(this.wobble+dt*.65,0,2);this._badBoth+=dt;if(this._badBoth>.25){this.stumble();this._badBoth=0;}}
    else this._badBoth=0;
    if(released.length===0)this._invalidReach=false;
  }else{
    const left=this.input.leftLeg,right=this.input.rightLeg;
    if(left&&right){this._badBoth+=dt;this.wobble+=dt*.2;if(this._badBoth>1.05)this.fall();}
    else this._badBoth=0;
    for(const limb of ['leftLeg','rightLeg']){
      if(this.prev[limb]&&!this.input[limb]&&this.phase==='upright'&&!(left&&right)){
        const hold=this.hold[limb];this.hold[limb]=0;
        this.step(limb==='leftLeg'?'left':'right',hold,stage);
      }
    }
    if(stage==='cake'){
      if(this.x>0&&(!this.input.leftArm||!this.input.rightArm)){
        this._armDrop+=dt;if(this._armDrop>.55){this.tipCake();this._armDrop=0;}
      }else this._armDrop=0;
    }
    if(stage==='swing'&&this.x>0&&(!this.input.leftArm||!this.input.rightArm)){
      this._armDrop+=dt;if(this._armDrop>.6){this.fall();this._armDrop=0;}
    }else if(stage==='swing')this._armDrop=0;
  }
  // Wobble never punishes hesitation. Only sustained active mistakes can fall.
  if(this.wobble>1.65&&(this.input.leftLeg&&this.input.rightLeg||stage==='climb'&&GP_LIMBS.filter(k=>!this.input[k]).length>=3))this.fall();
  this.prev={...this.input};
 }
}