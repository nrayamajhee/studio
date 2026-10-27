const IDLE = 0;
const ATTACK = 1;
const DECAY = 2;
const SUSTAIN = 3;
const RELEASE = 4;

// Exponential segments cover 99% of the distance in `time` seconds:
// coef = 1 − exp(−4.6/(time·fs)), since e^(−4.6) ≈ 0.01.
const approach = (time: number, fs: number) =>
  time > 0 ? 1 - Math.exp(-4.6 / (time * fs)) : 1;

// The four stages every ADSR in the engine is set from: the winds' breath, the
// violin's bow and the master envelope. Times in seconds, sustain 0–1.
export type AdsrStages = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
};

export class Adsr {
  value = 0;
  private stage = IDLE;
  private readonly fs: number;
  private attackStep = 1;
  private decayCoef = 1;
  private releaseCoef = 1;
  private sustain = 1;
  private gate = false;
  private oneShot = false;

  constructor(fs: number) {
    this.fs = fs;
  }

  get active() {
    return this.stage !== IDLE;
  }

  get releasing() {
    return this.stage === RELEASE;
  }

  set(
    attack: number,
    decay: number,
    sustain: number,
    release: number,
    gate = false,
    oneShot = false,
  ) {
    this.attackStep = attack > 0 ? 1 / (attack * this.fs) : 1;
    this.decayCoef = approach(decay, this.fs);
    this.releaseCoef = approach(release, this.fs);
    this.sustain = sustain;
    this.gate = gate;
    this.oneShot = oneShot;
  }

  setStages({ attack, decay, sustain, release }: AdsrStages) {
    this.set(attack, decay, sustain, release);
  }

  setRelease(release: number) {
    this.releaseCoef = approach(release, this.fs);
  }

  // Retriggers from the current value to avoid clicks.
  noteOn() {
    this.stage = ATTACK;
  }

  noteOff() {
    if (this.stage !== IDLE && !this.oneShot) this.stage = RELEASE;
  }

  reset() {
    this.stage = IDLE;
    this.value = 0;
  }

  process() {
    switch (this.stage) {
      case ATTACK:
        this.value += this.attackStep;
        if (this.value >= 1) {
          this.value = 1;
          this.stage = this.gate ? SUSTAIN : DECAY;
        }
        break;
      case DECAY: {
        const target = this.oneShot ? 0 : this.sustain;
        this.value += (target - this.value) * this.decayCoef;
        if (Math.abs(this.value - target) < 1e-4) {
          this.value = target;
          this.stage = this.oneShot ? IDLE : SUSTAIN;
        }
        break;
      }
      case SUSTAIN:
        this.value = this.gate ? 1 : this.sustain;
        break;
      case RELEASE:
        this.value -= this.value * this.releaseCoef;
        if (this.value < 1e-4) {
          this.value = 0;
          this.stage = IDLE;
        }
        break;
    }
    return this.value;
  }
}
