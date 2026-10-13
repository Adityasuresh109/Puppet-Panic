/**
 * Puppet Lab: self-contained, deterministic assisted ragdoll simulation.
 * No browser dependencies. Positions are world-space pixels, time is seconds.
 * Joints are damped spring particles around a simulated torso; torso tilt,
 * ground anchors, momentum, impact, and recovery are gameplay physics.
 * This is a playable physics LAB, not the final motorized rigid-body solver.
 */
export const TRACK_LENGTH = 1950;
export const CHECKPOINTS = [520, 1050, 1530];
export const STEP = 1 / 60;
export const MAX_SPEED = 190;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const point = (x, y) => ({ x, y, vx: 0, vy: 0 });
export const NEUTRAL = Object.freeze({ leftLeg: false, rightLeg: false, leftArm: false, rightArm: false, lean: 0, brace: false });

export class Puppet {
  constructor({ color = '#ffb638', name = 'BONGO', lane = 0 } = {}) {
    this.color = color;
    this.name = name;
    this.lane = lane;
    this.reset();
  }
  reset() {
    this.x = 115; this.y = 0; this.vx = 0; this.vy = 0;
    this.tilt = 0; this.angularVelocity = 0;
    this.time = 0; this.falls = 0; this.best = 0;
    this.checkpoint = 115; this.finishedAt = null;
    this.phase = 'running'; this.fallTimer = 0; this.unsteady = 0;
    this.cooldown = 0; this.braceTime = 0; this.panic = 0;
    this.events = []; this.lastEventAt = -1;
    this.input = { ...NEUTRAL };
    this.prev = { ...NEUTRAL };
    this.legs = {
      left: { foot: point(this.x - 17, 0), raised: false, push: 0 },
      right: { foot: point(this.x + 17, 0), raised: false, push: 0 }
    };
    this.hands = { left: point(this.x - 45, -84), right: point(this.x + 45, -84) };
    this.face = 'smile'; this.smileTimer = 0;
  }
  setInput(update) {
    this.input = { ...this.input, ...update };
    this.input.lean = clamp(Number(this.input.lean) || 0, -1, 1);
    for (const key of ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'brace']) this.input[key] = !!this.input[key];
  }
  emit(type, extra = {}) {
    this.events.push({ type, x: this.x, time: this.time, ...extra });
    if (this.events.length > 32) this.events.shift();
    this.lastEventAt = this.time;
  }
  fall(reason = 'stumble') {
    if (this.phase !== 'running') return;
    this.phase = 'fallen'; this.fallTimer = 1.9;
    this.falls++; this.face = 'shock'; this.smileTimer = 2;
    this.angularVelocity += (this.tilt >= 0 ? 1 : -1) * 2.5;
    this.vx *= 0.4;
    this.emit('fall', { reason });
  }
  recover() {
    if (this.phase !== 'fallen') return;
    this.phase = 'running'; this.tilt = 0; this.angularVelocity = 0;
    this.unsteady = 0; this.panic = 0; this.vx *= 0.25;
    this.face = 'dizzy'; this.smileTimer = 0.7;
    for (const side of ['left', 'right']) {
      const leg = this.legs[side]; leg.raised = false;
      leg.foot.x = this.x + (side === 'left' ? -16 : 16);
      leg.foot.y = 0; leg.foot.vx = 0; leg.foot.vy = 0;
    }
    this.emit('recover');
  }
  update(dt = STEP) {
    dt = clamp(dt, 0, 0.035);
    if (dt <= 0) return;
    this.time += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    this.braceTime = Math.max(0, this.braceTime - dt);
    this.smileTimer = Math.max(0, this.smileTimer - dt);
    if (!this.smileTimer) this.face = this.phase === 'finished' ? 'win' : 'smile';
    if (this.phase === 'finished') { this.updateLimbs(dt); return; }
    if (this.phase === 'fallen') {
      this.fallTimer -= dt;
      this.angularVelocity *= Math.pow(.95, dt * 60);
      this.tilt += this.angularVelocity * dt;
      this.vx *= Math.pow(.92, dt * 60); this.x += this.vx * dt;
      if (this.fallTimer <= 0) this.recover();
      this.updateLimbs(dt);
      this.prev = { ...this.input }; return;
    }
    const i = this.input; const p = this.prev;
    if (i.brace && !p.brace && this.cooldown <= 0) {
      this.braceTime = .65; this.cooldown = 3; this.emit('brace');
    }
    const braced = this.braceTime > 0;
    for (const side of ['left', 'right']) {
      const key = `${side}Leg`; const leg = this.legs[side];
      if (i[key] && !p[key]) { leg.raised = true; leg.push = 0; }
      if (!i[key] && p[key]) {
        leg.raised = false;
        const relative = leg.foot.x - this.x;
        const useful = clamp((relative + 19) / 75, .2, 1.1);
        const other = i[side === 'left' ? 'rightLeg' : 'leftLeg'];
        const rhythm = other ? .62 : 1;
        this.vx += 47 * useful * rhythm;
        this.vy -= 2.2;
        this.angularVelocity += (side === 'left' ? .43 : -.43) * (braced ? .3 : 1);
        this.face = 'grin'; this.smileTimer = .35;
        this.emit('step', { side, power: useful });
      }
    }
    // Arm swings supply counterbalance and a modest well-timed speed advantage.
    for (const side of ['left', 'right']) {
      const key = `${side}Arm`;
      if (i[key] && !p[key]) {
        const tiltDir = side === 'left' ? 1 : -1;
        this.angularVelocity += tiltDir * .16;
        this.vx += 5;
        this.emit('swing', { side });
      }
    }
    if (i.leftLeg && i.rightLeg) {
      this.unsteady += dt * (braced ? .38 : 1.4);
      this.angularVelocity += Math.sin(this.time * 13) * dt * (braced ? .4 : 1.7);
    } else this.unsteady = Math.max(0, this.unsteady - dt * .72);
    const desired = i.lean * .33;
    const correction = (desired - this.tilt) * (braced ? 17 : 8.5);
    this.angularVelocity += correction * dt;
    this.angularVelocity -= this.angularVelocity * (braced ? 5.6 : 2.6) * dt;
    // Unsupported legs tend to topple; arm motion can rescue a near fall.
    const support = Number(!i.leftLeg) + Number(!i.rightLeg);
    if (support === 0) this.angularVelocity += Math.sin(this.time * 8 + this.lane) * dt * 2.7;
    if (i.leftArm !== i.rightArm) this.angularVelocity -= this.tilt * 1.5 * dt;
    this.tilt = clamp(this.tilt + this.angularVelocity * dt, -2.5, 2.5);
    this.vx = clamp(this.vx * Math.pow(.986, dt * 60), -55, MAX_SPEED);
    this.x += this.vx * dt;
    this.x = Math.max(80, this.x);
    if (Math.abs(this.tilt) > (braced ? 1.38 : 1.08) || this.unsteady > 1.3) this.fall('balance');
    // Small floor hazards: timed leg lift or a brace avoids a topple.
    for (const ox of [680, 1230, 1660]) {
      if (this.x >= ox - 9 && this.x < ox + 9 && this.vx > 38 && !braced && !i.leftLeg && !i.rightLeg && this.time - this.lastEventAt > .25) {
        this.angularVelocity += (Math.sin(ox) > 0 ? 1 : -1) * .7;
        this.face = 'shock'; this.smileTimer = .6;
        this.emit('bonk', { obstacle: ox });
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
      this.emit('finish', { seconds: this.time, falls: this.falls });
    }
    this.updateLimbs(dt);
    this.prev = { ...i };
  }
  updateLimbs(dt) {
    const i = this.input;
    for (const side of ['left', 'right']) {
      const left = side === 'left'; const s = left ? -1 : 1;
      const foot = this.legs[side].foot;
      const airborne = i[`${side}Leg`] || this.phase === 'fallen';
      const targetX = this.x + s * 15 + (airborne ? 49 : -6);
      const targetY = airborne ? -45 : 0;
      // Spring-damper particles. Visually elastic but bounded, without teleporting.
      const frequency = airborne ? 17 : 11;
      foot.vx += (targetX - foot.x) * frequency * dt;
      foot.vy += (targetY - foot.y) * frequency * dt;
      foot.vx *= Math.pow(.75, dt * 60); foot.vy *= Math.pow(.74, dt * 60);
      foot.x += foot.vx * dt * 7;
      foot.y += foot.vy * dt * 7;
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
  get status() { return this.phase === 'finished' ? 'FINISHED' : this.phase === 'fallen' ? 'FLOORED!' : this.unsteady > .6 ? 'WOBBLY!' : 'RUNNING'; }
}

export function ranking(puppets) {
  return [...puppets].sort((a,b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
    if (a.finishedAt !== null) return -1;
    if (b.finishedAt !== null) return 1;
    return b.best - a.best;
  });
}
export function placePoints(index) { return [100,80,65,50,40][index] ?? 0; }