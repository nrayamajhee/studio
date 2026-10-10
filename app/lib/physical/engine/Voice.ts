import { Adsr } from "../dsp/Adsr";
import { DelayLine } from "../dsp/DelayLine";
import { Lfo, Smoother } from "../dsp/generators";
import { Svf } from "../dsp/Svf";
import type { ModuleSettings } from "./Modules";

export const IDLE = 0;
export const ACTIVE = 1;
export const RELEASED = 2;
export const STOLEN = 3;

const SILENCE = 3.1623e-5; // −90 dBFS
// Notes starting this close together are a chord, and don't glide.
const CHORD_SECONDS = 0.03;
const FILTER_UPDATE = 16;
// The filter's cutoff moves this far toward its target each update.
const CUTOFF_GLIDE = 0.3;
// The output's pitch LFO is a delay swept by up to 8 ms around 1 ms.
const MAX_SWEEP = 0.008;
const SWEEP_CENTRE = 0.001;

// Shared lifecycle: idle → active → released → idle, plus stolen (a 5 ms
// fade-out). Voices report each rendered segment's peak through track() and
// the owner frees them once they have stayed silent long enough.
//
// Every voice also carries the instrument's built-in modules: a model renders
// its raw signal, reads the LFO through modulate() where it takes it itself,
// and hands each sample to emit(), which runs the filter, the LFO's output
// destinations, the master ADSR, the steal fade and the pan.
export abstract class Voice {
  state = IDLE;
  note = -1;
  holds = 0;
  age = 0;
  quietSamples = 0;
  protected fade = 1;
  protected fadeStep = 0;
  protected readonly fs: number;
  // The master ADSR, applied on top of the model's own envelopes.
  readonly shape: Adsr;
  readonly mods: ModuleSettings;
  readonly lfo: Lfo;
  readonly gains = new Float64Array(2);
  // The LFO's value this sample, from modulate().
  protected mod = 0;
  private readonly svf = new Svf("lowpass");
  private cutoff = 16000;
  private cutoffTarget = 16000;
  private filterEnv = 0;
  private ticks = 0;
  private peak = 0;
  // The output's pitch LFO, for models that don't bend their own loop.
  private readonly sweep: DelayLine | null;
  private readonly sweepMix: Smoother | null;

  constructor(fs: number, mods: ModuleSettings) {
    this.fs = fs;
    this.mods = mods;
    this.shape = new Adsr(fs);
    this.lfo = new Lfo(fs);
    const output = mods.routing.pitch === "output";
    this.sweep = output ? new DelayLine(2 * MAX_SWEEP * fs + 8) : null;
    this.sweepMix = output ? new Smoother(0, fs, 0.02) : null;
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
    this.shape.reset();
    this.reset();
  }

  // A new note: the filter jumps to the note's cutoff and its envelope and
  // the LFO start over (a free-running LFO picks up the shared cycle).
  onset(note: number, clock: number) {
    const mods = this.mods;
    this.retarget(note);
    this.cutoff = this.cutoffTarget;
    this.filterEnv = 1;
    this.lfo.shape = mods.lfoShape;
    this.lfo.setRate(mods.lfoRate);
    if (mods.routing.free) {
      this.lfo.setDelay(0, 0);
      const cycle = (clock * mods.lfoRate) / this.fs;
      this.lfo.restart(cycle - Math.floor(cycle));
    } else {
      this.lfo.setDelay(mods.lfoDelay, mods.fadeIn);
      this.lfo.restart();
    }
  }

  // Silences the filter and the pitch sweep, for a model's reset().
  protected clearModules() {
    this.svf.clear();
    this.sweep?.clear();
  }

  // Struck again while it sounds: the filter envelope starts over.
  retrigger() {
    this.filterEnv = 1;
  }

  // The settings changed: the cutoff glides to the new target.
  retarget(note = this.note) {
    const mods = this.mods;
    this.cutoffTarget = mods.cutoff * 2 ** ((mods.keytrack * (note - 60)) / 12);
    this.lfo.shape = mods.lfoShape;
    this.lfo.setRate(mods.lfoRate);
  }

  // Advances the LFO and returns its value; models that take pitch or level
  // themselves call it once a sample before emit().
  protected modulate() {
    this.mod = this.mods.lfoOn ? this.lfo.process() : 0;
    return this.mod;
  }

  // Filters one sample, scales it by `gain`, then applies the LFO's output
  // destinations, the master ADSR, the steal fade and the pan.
  protected emit(
    x: number,
    gain: number,
    i: number,
    left: Float32Array,
    right: Float32Array,
  ) {
    const mods = this.mods;
    if (mods.routing.pitch === "output" && mods.routing.level === "output")
      this.modulate();
    if (this.ticks++ % FILTER_UPDATE === 0) this.updateFilter();
    let y = this.svf.process(x) * gain;
    if (mods.routing.level === "output" && mods.level > 0)
      y *= 1 + mods.level * this.mod;
    if (this.sweep) y = this.bend(y);
    y *= this.shape.process();
    if (this.fadeStep > 0) {
      this.fade = Math.max(0, this.fade - this.fadeStep);
      y *= this.fade;
    }
    left[i] += y * this.gains[0];
    right[i] += y * this.gains[1];
    const level = y < 0 ? -y : y;
    if (level > this.peak) this.peak = level;
  }

  // Reports the rendered segment's peak.
  protected endBlock(count: number) {
    this.track(this.peak, count);
    this.peak = 0;
  }

  // Cutoff glides toward its target and the filter envelope decays, both
  // recomputed every 16 samples; the LFO sweeps it by octaves.
  private updateFilter() {
    const mods = this.mods;
    this.cutoff += (this.cutoffTarget - this.cutoff) * CUTOFF_GLIDE;
    this.filterEnv *= mods.envDecay;
    let cutoff = this.cutoff * (1 + mods.envAmount * this.filterEnv);
    if (mods.filter > 0) cutoff *= 2 ** (mods.filter * this.mod);
    this.svf.set(cutoff, mods.q, this.fs);
  }

  // Pitch from a delay swept at the LFO's rate: a delay moving at speed v
  // shifts pitch by 1 − v, so a swing of `pitch` needs pitch/(2π·rate) s.
  // It crossfades in and out so switching it never clicks.
  private bend(y: number) {
    const sweep = this.sweep!;
    const mix = this.sweepMix!;
    const mods = this.mods;
    mix.set(mods.pitch > 0 ? 1 : 0);
    sweep.write(y);
    if (mix.settled && mix.value === 0) return y;
    const depth = Math.min(
      MAX_SWEEP,
      mods.pitch / (2 * Math.PI * Math.max(0.1, mods.lfoRate)),
    );
    const at = (depth + SWEEP_CENTRE + depth * this.mod) * this.fs;
    const m = mix.process();
    return y + m * (sweep.readLagrange3(at) - y);
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
