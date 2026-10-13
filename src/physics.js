/**
 * Puppet Lab v0.2: coordination-first cooperative physics model.
 * Lightweight assisted springs are deliberate and NOT a rigid body solver.
 * One-sided button spam must never locomote a puppet to the finish.
 */
export const TRACK_LENGTH = 1950;
export const CHECKPOINTS = [520, 1050, 1530];
export const STEP = 1 / 60;
export const MAX_SPEED = 150;
export const NEUTRAL = Object.freeze({ leftLeg: false, rightLeg: false, leftArm: false, rightArm: false, lean: 0, brace: false });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const point = (x, y) => ({ x, y, vx: 0, vy: 0 });
const sideKey = s => `${s}Leg`;
const oppose = s => s === 'left' ? 'right' : 'left';

export class Puppet {
  constructor({ color = '#ffb638', name = 'BONGO', lane = 0, mode = 'walk' } = {}) {
    this.color = color; this.name = name; this.lane = lane;
    this.mode = mode;
    this.reset();
  }
  reset() {
    this.x = 115; this.y = 0; this.vx = 0; this.vy = 0;
    this.tilt = 0; this.angularVelocity = 0;
    this.time = 0; this.falls = 0; this.best = 115; this.steps = 0;
    this.checkpoint = 115; this.finishedAt = null;
    this.phase = 'running'; this.fallTimer = 0; this.unsteady = 0;
    this.cooldown = 0; this.braceTime = 0; this.panic = 0;
    this.expectedSide = 'left'; this.missteps = 0; this.combo = 0;
    this.holdTime = { left: 0, right: 0 };
    this.supportQuality = { left: 0, right: 0 };
    this.weightQuality = { left: 0, right: 0 };
    this.events = []; this.lastEventAt = -100; this.eventSerial = 0;
    this.input = { ...NEUTRAL }; this.prev = { ...NEUTRAL };
    this.legs = {
      left: { foot: point(this.x - 17, 0), raised: false, push: 0 },
      right: { foot: point(this.x + 17, 0), raised: false, push: 0 }
    };
    this.hands = { left: point(this.x - 45, -84), right: point(this.x + 45, -84) };
    this.face = 'smile'; this.smileTimer = 0;
    this.layers = 3; this.cakeAngle = 0; this.cakeWobble = 0; this.gripLoss = 0;
  }
  setMode(mode) {
    if (!['walk', 'cake'].includes(mode)) throw new Error('Unknown challenge');
    this.mode = mode; this.reset();
  }
  setInput(update) {
    const i = { ...this.input, ...update };
    i.lean = clamp(Number(i.lean) || 0, -1, 1);
    for (const key of ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'brace']) i[key] = !!i[key];
    this.input = i;
  }
  emit(type, extra = {}) {
    this.events.push({ id: ++this.eventSerial, type, x: this.x, time: this.time, ...extra });
    if (this.events.length > 36) this.events.shift();
    this.lastEventAt = this.time;
  }
  fall(reason = 'balance') {
    if (this.phase !== 'running') return;
    this.phase = 'fallen'; this.fallTimer = 2.05;
    this.falls++; this.face = 'shock'; this.smileTimer = 2;
    this.angularVelocity = this.tilt >= 0 ? 2.3 : -2.3;
    this.vx *= 0.12; this.combo = 0; this.missteps = 0;
    this.emit('fall', { reason });
  }
  recover() {
    if (this.phase !== 'fallen') return;
    this.phase = 'running'; this.tilt = 0; this.angularVelocity = 0;
    this.unsteady = 0.08; this.vx = 0; this.panic = 0;
    this.face = 'dizzy'; this.smileTimer = .7;
    this.holdTime = { left: 0, right: 0 };
    this.supportQuality = { left: 0, right: 0 };
    this.weightQuality = { left: 0, right: 0 };
    this.expectedSide = 'left'; this.missteps = 0;
    for (const side of ['left', 'right']) {
      const leg = this.legs[side]; leg.raised = false;
      leg.foot.x = this.x + (side === 'left' ? -16 : 16);
      leg.foot.y = 0; leg.foot.vx = 0; leg.foot.vy = 0;
    }
    // Inputs must be released and pressed again to prevent held buttons giving steps after recovery.
    this.prev = { ...this.input };
    this.emit('recover');
  }
  slip(reason, side) {
    this.combo = 0; this.missteps++;
    this.unsteady += 0.24 + (reason === 'wrong-foot' ? .12 : 0);
    this.angularVelocity += side === 'left' ? -.75 : .75;
    this.vx *= .52;
    this.face = 'shock'; this.smileTimer = .65;
    this.emit('slip', { reason, side });
    if (this.missteps >= 3 || this.unsteady > 1.05) this.fall('misstep');
  }
  plant(side) {
    const i = this.input, elapsed = this.holdTime[side];
    const other = oppose(side);
    const correctTurn = this.expectedSide === side;
    const timed = elapsed >= .22 && elapsed <= .78;
    const plantedSupport = !i[sideKey(other)];
    // Weight goes towards the supporting leg; the opposite arm counters angular momentum.
    const weightSign = side === 'left' ? 1 : -1;
    const correctWeight = this.weightQuality[side] >= .68 && i.lean * weightSign > .6;
    const correctArms = this.supportQuality[side] >= .68 &&
      (this.mode === 'cake'
        ? (i.leftArm && i.rightArm)
        : (i[`${other}Arm`] && !i[`${side}Arm`]));
    this.holdTime[side] = 0; this.supportQuality[side] = 0; this.weightQuality[side] = 0;
    if (!correctTurn) { this.slip('wrong-foot', side); return; }
    if (!timed) { this.slip('bad-timing', side); return; }
    if (!plantedSupport) { this.slip('no-support', side); return; }
    if (!correctWeight) { this.slip('weight-transfer', side); return; }
    if (!correctArms) { this.slip(this.mode === 'cake' ? 'cake-grip' : 'arm-sync', side); return; }
    this.expectedSide = other;
    this.steps++; this.combo++; this.missteps = 0;
    this.unsteady = Math.max(.03, this.unsteady - .2);
    this.vx = clamp(this.vx + (this.mode === 'cake' ? 54 : 65) + Math.min(this.combo, 4) * 3, 0, MAX_SPEED);
    this.angularVelocity += (side === 'left' ? .33 : -.33);
    this.face = 'grin'; this.smileTimer = .3;
    this.emit('step', { side, combo: this.combo, mode: this.mode });
  }
  update(dt = STEP) {
    dt = clamp(dt, 0, .035);
    if (!dt) return;
    this.time += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    this.braceTime = Math.max(0, this.braceTime - dt);
    this.smileTimer = Math.max(0, this.smileTimer - dt);
    if (!this.smileTimer) this.face = this.phase === 'finished' ? 'win' : 'smile';
    if (this.phase === 'finished') { this.updateLimbs(dt); return; }
    if (this.phase === 'fallen') {
      this.fallTimer -= dt;
      this.angularVelocity *= Math.pow(.93, dt * 60);
      this.tilt += this.angularVelocity * dt;
      this.vx *= Math.pow(.86, dt * 60);
      this.x += this.vx * dt;
      if (this.fallTimer <= 0) this.recover();
      this.updateLimbs(dt); this.prev = { ...this.input }; return;
    }
    const i = this.input, p = this.prev;
    if (i.brace && !p.brace && this.cooldown <= 0) {
      this.braceTime = .55; this.cooldown = 3.2; this.emit('brace');
    }
    const braced = this.braceTime > 0;
    for (const side of ['left', 'right']) {
      const key = sideKey(side), other = oppose(side);
      const leg = this.legs[side];
      if (i[key] && !p[key]) {
        this.holdTime[side] = 0; this.supportQuality[side] = 0; this.weightQuality[side] = 0;
        leg.raised = true;
      }
      if (i[key]) {
        this.holdTime[side] += dt;
        const weightSign = side === 'left' ? 1 : -1;
        const armsOK = this.mode === 'cake'
          ? (i.leftArm && i.rightArm)
          : (i[`${other}Arm`] && !i[`${side}Arm`]);
        const weightOK = i.lean * weightSign > .6;
        const t = this.holdTime[side];
        this.supportQuality[side] += (Number(armsOK) - this.supportQuality[side]) * Math.min(1, dt * 24);
        this.weightQuality[side] += (Number(weightOK) - this.weightQuality[side]) * Math.min(1, dt * 24);
        if (t > .82) this.unsteady += dt * (braced ? .65 : 1.8);
        if (!weightOK) this.unsteady += dt * (braced ? .35 : .75);
        if (!armsOK) this.unsteady += dt * (braced ? .3 : .65);
      }
      if (!i[key] && p[key]) { leg.raised = false; this.plant(side); }
    }
    // Two raised feet remove the planted support; brace buys time but not a free step.
    if (i.leftLeg && i.rightLeg) this.unsteady += dt * (braced ? 1.15 : 2.4);
    else if (!i.leftLeg && !i.rightLeg) this.unsteady = Math.max(0, this.unsteady - dt * .08);
    // Angular movement uses actual player input. Without counterweight, unsupported swings topple.
    const raisedSide = i.leftLeg !== i.rightLeg ? (i.leftLeg ? 'left' : 'right') : null;
    const armTorque = (Number(i.leftArm) - Number(i.rightArm)) * (this.mode === 'cake' ? .08 : .6);
    const legTorque = raisedSide === 'left' ? -.95 : raisedSide === 'right' ? .95 : 0;
    const torsoTorque = -i.lean * 1.25;
    this.angularVelocity += (legTorque + armTorque + torsoTorque - this.tilt * 1.25) * dt;
    this.angularVelocity *= Math.pow(braced ? .87 : .958, dt * 60);
    this.tilt = clamp(this.tilt + this.angularVelocity * dt, -2.7, 2.7);
    this.unsteady += Math.max(0, Math.abs(this.tilt) - .24) * dt * .65;
    // Crashes bleed speed; maintaining forward momentum needs new synchronized steps.
    this.vx *= Math.pow(this.mode === 'cake' ? .965 : .970, dt * 60);
    this.x = Math.max(80, this.x + this.vx * dt);
    if (Math.abs(this.tilt) > (braced ? .83 : .68) || this.unsteady > 1.05) this.fall('balance');
    if (this.mode === 'cake' && this.phase === 'running') this.updateCake(dt);
    if (this.phase === 'running') {
      // Ground hazards require a properly prepared step; slamming the cone is not harmless.
      for (const ox of [680, 1230, 1660]) {
        if (this.x > ox - 10 && this.x < ox + 10 && this.vx > 20 && !raisedSide && !braced && this.time - this.lastEventAt > .4) {
          this.unsteady += .36; this.vx *= .3;
          this.emit('bonk', { obstacle: ox });
          if (this.mode === 'cake') this.damageCake('collision');
          else this.fall('obstacle');
          break;
        }
      }
      for (const cx of CHECKPOINTS) {
        if (this.x >= cx && this.checkpoint < cx) {
          this.checkpoint = cx; this.emit('checkpoint', { checkpoint: cx });
        }
      }
      this.best = Math.max(this.best, this.x);
      if (this.x >= TRACK_LENGTH) {
        this.x = TRACK_LENGTH; this.vx = 0;
        this.phase = 'finished'; this.finishedAt = this.time; this.face = 'win';
        this.emit('finish', { seconds: this.time, falls: this.falls, layers: this.layers });
      }
    }
    this.updateLimbs(dt); this.prev = { ...i };
  }
  damageCake(reason) {
    if (this.layers > 0) this.layers--;
    this.gripLoss = 0; this.cakeAngle = 0; this.cakeWobble = 0;
    this.vx = 0; this.combo = 0;
    this.emit('cakeDrop', { reason, layers: this.layers });
    if (this.layers === 0) this.fall('cake-disaster');
  }
  updateCake(dt) {
    if (this.steps === 0) { this.gripLoss = 0; return; }
    if (!(this.input.leftArm && this.input.rightArm)) this.gripLoss += dt;
    else this.gripLoss = Math.max(0, this.gripLoss - dt * 3);
    const armImbalance = Number(this.input.leftArm) - Number(this.input.rightArm);
    const goal = this.tilt * 1.2 + armImbalance * .65 + this.angularVelocity * .3;
    this.cakeAngle += (goal - this.cakeAngle) * Math.min(1, dt * 3.5);
    this.cakeWobble += Math.abs(this.cakeAngle) * dt;
    if (this.gripLoss > .32 || Math.abs(this.cakeAngle) > .55 || this.cakeWobble > 1.4) {
      this.damageCake(this.gripLoss > .32 ? 'dropped-grip' : 'tilted-tray');
      // Remaining layers continue at the last checkpoint, making mistakes costly.
      this.x = Math.max(115, this.checkpoint);
    }
  }
  updateLimbs(dt) {
    const i = this.input;
    for (const side of ['left', 'right']) {
      const s = side === 'left' ? -1 : 1, foot = this.legs[side].foot;
      const airborne = i[`${side}Leg`] || this.phase === 'fallen';
      const targetX = this.x + s * 15 + (airborne ? 49 : -6);
      const targetY = airborne ? -45 : 0;
      const frequency = airborne ? 17 : 11;
      foot.vx += (targetX - foot.x) * frequency * dt;
      foot.vy += (targetY - foot.y) * frequency * dt;
      foot.vx *= Math.pow(.75, dt * 60); foot.vy *= Math.pow(.74, dt * 60);
      foot.x += foot.vx * dt * 7; foot.y += foot.vy * dt * 7;
      foot.y = clamp(foot.y, -68, 0);
      const hand = this.hands[side];
      const active = i[`${side}Arm`];
      const htargetX = this.x + s * (active ? 58 : 36) + (active ? 20 : 0);
      const htargetY = active ? -113 : -63;
      hand.vx += (htargetX - hand.x) * 14 * dt;
      hand.vy += (htargetY - hand.y) * 14 * dt;
      hand.vx *= Math.pow(.76, dt * 60); hand.vy *= Math.pow(.76, dt * 60);
      hand.x += hand.vx * dt * 7; hand.y += hand.vy * dt * 7;
    }
  }
  get progress() { return clamp((this.best - 115) / (TRACK_LENGTH - 115), 0, 1); }
  get status() {
    if (this.phase === 'finished') return 'FINISHED!';
    if (this.phase === 'fallen') return 'FACEPLANT!';
    if (this.unsteady > .65) return 'LOSING BALANCE!';
    return this.mode === 'cake' ? `CAKE: ${this.layers} LAYERS` : `NEXT: ${this.expectedSide.toUpperCase()} FOOT`;
  }
}
export function ranking(puppets) {
  return [...puppets].sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
    if (a.finishedAt !== null) return -1;
    if (b.finishedAt !== null) return 1;
    return b.best - a.best;
  });
}
export function placePoints(index) { return [100, 80, 65, 50, 40][index] ?? 0; }