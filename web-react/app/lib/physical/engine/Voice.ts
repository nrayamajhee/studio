import { Adsr } from "../dsp/Adsr";
import type { ModuleSettings } from "./Modules";
import { VoiceChain } from "./VoiceChain";

export const IDLE = 0;
export const ACTIVE = 1;
export const RELEASED = 2;
export const STOLEN = 3;

const SILENCE = 3.1623e-5; // −90 dBFS
// Notes starting this close together are a chord, and don't glide.
const CHORD_SECONDS = 0.03;
// How long after it is let go a voice can still carry a chord glide.
const CARRY_SECONDS = 0.25;

// Shared lifecycle: idle → active → released → idle, plus stolen (a 5 ms
// fade-out). Voices report each rendered segment's peak through endBlock()
// and the owner frees them once they have stayed silent long enough. Every
// voice runs its model's raw signal through its `chain`: the instrument's
// built-in modules, the master ADSR, the steal fade and the pan.
export abstract class Voice {
  state = IDLE;
  note = -1;
  holds = 0;
  age = 0;
  // When a note was last struck on it, and when it was let go (frames).
  struck = 0;
  releasedAt = 0;
  quietSamples = 0;
  protected readonly fs: number;
  // The master ADSR, applied on top of the model's own envelopes.
  readonly shape: Adsr;
  readonly gains = new Float64Array(2);
  // The instrument's module settings, which the chain runs and a model reads
  // for the vibrato it takes itself.
  readonly mods: ModuleSettings;
  readonly chain: VoiceChain;

  constructor(fs: number, mods: ModuleSettings) {
    this.fs = fs;
    this.mods = mods;
    this.shape = new Adsr(fs);
    this.chain = new VoiceChain(fs, mods, this.shape, this.gains);
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

  // Reports the peak of a segment rendered through the chain.
  protected endBlock(count: number) {
    this.track(this.chain.takePeak(), count);
  }

  protected begin(note: number, clock: number) {
    this.state = ACTIVE;
    this.note = note;
    this.holds = 1;
    this.age = clock;
    this.struck = clock;
    this.quietSamples = 0;
    this.chain.fade = 1;
    this.chain.fadeStep = 0;
  }

  // Let go at `clock`: rings out, and can still carry a chord glide.
  release(clock: number) {
    this.state = RELEASED;
    this.releasedAt = clock;
  }

  // Carried on to a new note by a chord glide: it sounds `note` from here,
  // as a voice just struck.
  carry(note: number, clock: number) {
    this.state = ACTIVE;
    this.note = note;
    this.holds = 1;
    this.age = clock;
    this.struck = clock;
    this.retarget(note);
  }

  steal() {
    this.state = STOLEN;
    this.holds = 0;
    this.chain.fadeStep = 1 / (0.005 * this.fs);
  }

  free() {
    this.state = IDLE;
    this.note = -1;
    this.holds = 0;
    this.quietSamples = 0;
    this.chain.fade = 1;
    this.chain.fadeStep = 0;
    this.shape.reset();
    this.reset();
  }

  // A new note: see VoiceChain.onset.
  onset(note: number, clock: number) {
    this.chain.onset(note, clock);
  }

  retrigger() {
    this.chain.retrigger();
  }

  retarget(note = this.note) {
    this.chain.retarget(note);
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

// The note a new one glides from when played legato: the latest one still
// held, unless it started with this one as part of a chord. −1 for none.
export function legatoNote(
  voices: readonly Voice[],
  clock: number,
  fs: number,
) {
  let latest: Voice | null = null;
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    if (voice.state === ACTIVE && (!latest || voice.age > latest.age))
      latest = voice;
  }
  return latest && clock - latest.age >= CHORD_SECONDS * fs ? latest.note : -1;
}

// The voice a chord glide carries on to `note`: the nearest in pitch of those
// let go in the last CARRY_SECONDS, else of those still held, leaving out any
// struck with this chord. −1 for none.
export function chordSource(
  voices: readonly Voice[],
  note: number,
  clock: number,
  fs: number,
) {
  let released = -1;
  let held = -1;
  const nearer = (i: number, best: number) => {
    if (best < 0) return true;
    const a = Math.abs(voices[i].note - note);
    const b = Math.abs(voices[best].note - note);
    return a < b || (a === b && voices[i].note < voices[best].note);
  };
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    if (clock - voice.struck < CHORD_SECONDS * fs) continue;
    if (voice.state === RELEASED) {
      if (clock - voice.releasedAt <= CARRY_SECONDS * fs && nearer(i, released))
        released = i;
    } else if (voice.state === ACTIVE && nearer(i, held)) {
      held = i;
    }
  }
  return released >= 0 ? released : held;
}
