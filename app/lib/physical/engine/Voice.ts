export const IDLE = 0;
export const ACTIVE = 1;
export const RELEASED = 2;
export const STOLEN = 3;

const SILENCE = 3.1623e-5; // −90 dBFS

// Shared lifecycle: idle → active → released → idle, plus stolen (a 5 ms
// fade-out). Voices report each rendered segment's peak through track() and
// the owner frees them once they have stayed silent long enough.
export abstract class Voice {
  state = IDLE;
  note = -1;
  holds = 0;
  age = 0;
  quietSamples = 0;
  protected fade = 1;
  protected fadeStep = 0;
  protected readonly fs: number;

  constructor(fs: number) {
    this.fs = fs;
  }

  get busy() {
    return this.state !== IDLE;
  }

  get finished() {
    const released = this.state === RELEASED || this.state === STOLEN;
    return (
      (released && this.quietSamples > 0.05 * this.fs) ||
      this.quietSamples > 1.0 * this.fs
    );
  }

  // Keeps a decaying voice alive while it is still audible.
  protected track(peak: number, count: number) {
    if (peak < SILENCE) this.quietSamples += count;
    else this.quietSamples = 0;
  }

  protected begin(note: number, clock: number) {
    this.state = ACTIVE;
    this.note = note;
    this.holds = 1;
    this.age = clock;
    this.quietSamples = 0;
    this.fade = 1;
    this.fadeStep = 0;
  }

  steal() {
    this.state = STOLEN;
    this.holds = 0;
    this.fadeStep = 1 / (0.005 * this.fs);
  }

  free() {
    this.state = IDLE;
    this.note = -1;
    this.holds = 0;
    this.quietSamples = 0;
    this.fade = 1;
    this.fadeStep = 0;
    this.reset();
  }

  abstract reset(): void;
  abstract render(
    left: Float32Array,
    right: Float32Array,
    start: number,
    end: number,
  ): void;
}

// Picks the quietest released voice, else the oldest active one.
export function pickVictim<V extends Voice>(voices: readonly V[]) {
  let victim: V | null = null;
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    if (voice.state === RELEASED) {
      if (
        !victim ||
        victim.state !== RELEASED ||
        voice.quietSamples > victim.quietSamples
      ) {
        victim = voice;
      }
    } else if (voice.state === ACTIVE && (!victim || victim.state === ACTIVE)) {
      if (!victim || voice.age < victim.age) victim = voice;
    }
  }
  return victim;
}
