import type { Adsr } from "../dsp/Adsr";
import { DelayLine } from "../dsp/DelayLine";
import { Lfo, Smoother } from "../dsp/generators";
import { Svf } from "../dsp/Svf";
import type { ModuleSettings } from "./Modules";

const FILTER_UPDATE = 16;
// The vibrato is computed every 16 samples and drawn straight between.
const LFO_UPDATE = 16;
// The filter's cutoff moves this far toward its target each update.
const CUTOFF_GLIDE = 0.3;
// The output's pitch vibrato is a delay swept by up to 8 ms around 1 ms.
const MAX_SWEEP = 0.008;
const SWEEP_CENTRE = 0.001;

// The modules a voice runs its raw signal through: the filter, the vibrato's
// output destinations, the master ADSR, the steal fade and the pan. A model
// starts each segment with begin(), reads the vibrato through modulate()
// where it takes it itself, and hands each sample to emit(). One class for
// every model, so this per-sample path stays monomorphic however many
// models are playing.
export class VoiceChain {
  // The vibrato's value this sample, from modulate().
  mod = 0;
  // The steal fade: 1 until a stolen voice ramps it to 0.
  fade = 1;
  fadeStep = 0;
  private readonly fs: number;
  private readonly mods: ModuleSettings;
  private readonly shape: Adsr;
  private readonly gains: Float64Array;
  private readonly lfo: Lfo;
  private modStep = 0;
  private lfoLeft = 0;
  private readonly svf = new Svf("lowpass");
  private cutoff = 16000;
  private cutoffTarget = 16000;
  private filterEnv = 0;
  // The cutoff and Q last given to the filter, so it is only redesigned when
  // they move.
  private setCutoff = -1;
  private setQ = -1;
  private ticks = 0;
  private peak = 0;
  // What the segment has to do, settled by begin().
  private lfoOn = false;
  private ownLfo = false;
  private tremolo = 0;
  private bending = false;
  // The output's pitch vibrato, for models that don't bend their own loop.
  private readonly sweep: DelayLine | null;
  private readonly sweepMix: Smoother | null;
  private sweepCentre = 0;
  private sweepDepth = 0;

  constructor(
    fs: number,
    mods: ModuleSettings,
    shape: Adsr,
    gains: Float64Array,
  ) {
    this.fs = fs;
    this.mods = mods;
    this.shape = shape;
    this.gains = gains;
    this.lfo = new Lfo(fs);
    const output = mods.routing.pitch === "output";
    this.sweep = output ? new DelayLine(2 * MAX_SWEEP * fs + 8) : null;
    this.sweepMix = output ? new Smoother(0, fs, 0.02) : null;
  }

  // A new note: the filter jumps to the note's cutoff and its envelope and
  // the vibrato start over (a free-running one picks up the shared cycle).
  onset(note: number, clock: number) {
    const mods = this.mods;
    this.retarget(note);
    this.cutoff = this.cutoffTarget;
    this.filterEnv = 1;
    this.mod = 0;
    this.modStep = 0;
    this.lfoLeft = 0;
    if (mods.routing.free) {
      this.lfo.setDelay(0, 0);
      const cycle = (clock * mods.lfoRate) / this.fs;
      this.lfo.restart(cycle - Math.floor(cycle));
    } else {
      this.lfo.setDelay(mods.lfoDelay, mods.fadeIn);
      this.lfo.restart();
    }
  }

  // Struck again while it sounds: the filter envelope starts over.
  retrigger() {
    this.filterEnv = 1;
  }

  // The settings changed: the cutoff glides to the new target.
  retarget(note: number) {
    const mods = this.mods;
    this.cutoffTarget = mods.cutoff * 2 ** ((mods.keytrack * (note - 60)) / 12);
    this.lfo.shape = mods.lfoShape;
    this.lfo.setRate(mods.lfoRate);
  }

  // Silences the filter and the pitch sweep, for a model's reset().
  clear() {
    this.svf.clear();
    this.sweep?.clear();
  }

  // Settles once per rendered segment which modules have anything to do, so
  // the per-sample path skips the rest.
  begin() {
    const mods = this.mods;
    this.lfoOn = mods.lfoOn;
    if (!this.lfoOn) this.mod = this.modStep = 0;
    this.ownLfo =
      mods.routing.pitch === "output" && mods.routing.level === "output";
    this.tremolo = mods.routing.level === "output" ? mods.level : 0;
    const sweep = this.sweep;
    const mix = this.sweepMix;
    if (!sweep || !mix) return;
    mix.set(mods.pitch > 0 ? 1 : 0);
    const bending = !(mix.settled && mix.value === 0);
    // Starting to bend mid-note: what the delay holds is long stale.
    if (bending && !this.bending) sweep.clear();
    this.bending = bending;
    // A delay moving at speed v shifts pitch by 1 − v, so a swing of `pitch`
    // needs pitch/(2π·rate) s.
    const depth = Math.min(
      MAX_SWEEP,
      mods.pitch / (2 * Math.PI * Math.max(0.1, mods.lfoRate)),
    );
    this.sweepDepth = depth * this.fs;
    this.sweepCentre = (depth + SWEEP_CENTRE) * this.fs;
  }

  // Advances the vibrato and returns its value; models that take pitch or
  // level themselves call it once a sample before emit().
  modulate() {
    if (!this.lfoOn) return 0;
    if (this.lfoLeft === 0) {
      this.modStep = (this.lfo.advance(LFO_UPDATE) - this.mod) / LFO_UPDATE;
      this.lfoLeft = LFO_UPDATE;
    }
    this.lfoLeft--;
    this.mod += this.modStep;
    return this.mod;
  }

  // Filters one sample, scales it by `gain`, then applies the vibrato's output
  // destinations, the master ADSR, the steal fade and the pan.
  emit(
    x: number,
    gain: number,
    i: number,
    left: Float32Array,
    right: Float32Array,
  ) {
    if (this.ownLfo) this.modulate();
    if (this.ticks++ % FILTER_UPDATE === 0) this.updateFilter();
    let y = this.svf.process(x) * gain;
    if (this.tremolo > 0) y *= 1 + this.tremolo * this.mod;
    if (this.bending) y = this.bend(y);
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

  // The segment's peak, starting the next one over.
  takePeak() {
    const peak = this.peak;
    this.peak = 0;
    return peak;
  }

  // Cutoff glides toward its target and the filter envelope decays, both
  // recomputed every 16 samples; the vibrato sweeps it by octaves.
  private updateFilter() {
    const mods = this.mods;
    this.cutoff += (this.cutoffTarget - this.cutoff) * CUTOFF_GLIDE;
    this.filterEnv *= mods.envDecay;
    let cutoff = this.cutoff * (1 + mods.envAmount * this.filterEnv);
    if (mods.filter > 0) cutoff *= 2 ** (mods.filter * this.mod);
    if (cutoff === this.setCutoff && mods.q === this.setQ) return;
    this.setCutoff = cutoff;
    this.setQ = mods.q;
    this.svf.set(cutoff, mods.q, this.fs);
  }

  // Pitch from the delay swept at the vibrato's rate, crossfaded in and out
  // so switching it never clicks.
  private bend(y: number) {
    const sweep = this.sweep!;
    sweep.write(y);
    const m = this.sweepMix!.process();
    return (
      y +
      m *
        (sweep.readLagrange3(this.sweepCentre + this.sweepDepth * this.mod) - y)
    );
  }
}
