// Bowed string ported from STK (The Synthesis ToolKit, Perry Cook & Gary
// Scavone, MIT-style license): src/Bowed.cpp, include/BowTable.h, with the
// violin body filter by Esteban Maestre.

import { Adsr, type AdsrStages } from "../dsp/Adsr";
import { Biquad, OnePoleLowpass, rescaleQuadratic } from "../dsp/filters";
import { Lfo } from "../dsp/generators";
import { foldNote, keyTable, midiToHz, panGains, TWO_PI } from "../dsp/math";
import { bowTable } from "../dsp/nonlinear";
import { onePolePhaseDelay } from "../dsp/phaseDelay";
import { Svf } from "../dsp/Svf";
import { Instrument } from "../engine/Instrument";
import {
  ACTIVE,
  IDLE,
  RELEASED,
  STOLEN,
  Voice,
  legatoNote,
  pickVictim,
} from "../engine/Voice";
import { pickTuning, type KeyTable, type BowedPatch } from "../patches/types";
import { Waveguide } from "./Waveguide";

const STK_RATE = 44100;
// Body sections as (b0, b1, b2, a1, a2), designed at 44.1 kHz.
const BODY_SECTIONS = [
  [1.0, 1.5667, 0.3133, -0.5509, -0.3925],
  [1.0, -1.9537, 0.9542, -1.6357, 0.8697],
  [1.0, -1.6683, 0.8852, -1.7674, 0.8735],
  [1.0, -1.8585, 0.9653, -1.8498, 0.9516],
  [1.0, -1.9299, 0.9621, -1.9354, 0.959],
  [1.0, -1.98, 0.9888, -1.9867, 0.9923],
] as const;
const BODY_GAIN = 0.1248;
const BOW_OFFSET = 0.001;
const STRING_FILTER_GAIN = 0.95;
const FILTER_UPDATE = 16;

class BowedVoice extends Voice {
  readonly neck: Waveguide;
  readonly bridge: Waveguide;
  readonly stringFilter = new OnePoleLowpass();
  readonly body: Biquad[] = [];
  readonly bow: Adsr;
  readonly vibrato: Lfo;
  readonly svf = new Svf("lowpass");
  readonly gains = new Float64Array(2);
  baseDelay = 100;
  // The loop length a legato note glides to, at `glide` per sample.
  delayTarget = 100;
  glide = 1;
  beta = 0.127236;
  maxVelocity = 0.2;
  slope = 3;
  vibratoGain = 0;
  cutoff = 12000;
  q = Math.SQRT1_2;
  bodyMix = 1;
  private ticks = 0;

  constructor(fs: number, lowestHz: number) {
    super(fs);
    const longest = fs / lowestHz + 8;
    this.neck = new Waveguide(longest);
    this.bridge = new Waveguide(longest);
    this.stringFilter.setPole(0.75 - (0.2 * 22050) / fs);
    for (const [b0, b1, b2, a1, a2] of BODY_SECTIONS) {
      const section = new Biquad();
      const [zb1, zb2] = rescaleQuadratic(b1 / b0, b2 / b0, STK_RATE, fs);
      const [pa1, pa2] = rescaleQuadratic(a1, a2, STK_RATE, fs);
      section.set(b0, zb1 * b0, zb2 * b0, pa1, pa2);
      this.body.push(section);
    }
    this.bow = new Adsr(fs);
    this.vibrato = new Lfo(fs);
  }

  reset() {
    this.neck.clear();
    this.bridge.clear();
    this.stringFilter.clear();
    for (let i = 0; i < this.body.length; i++) this.body[i].clear();
    this.svf.clear();
    this.bow.reset();
  }

  start(note: number, clock: number) {
    this.begin(note, clock);
  }

  render(left: Float32Array, right: Float32Array, start: number, end: number) {
    const neck = this.neck;
    const bridge = this.bridge;
    const body = this.body;
    const gains = this.gains;
    let peak = 0;
    for (let i = start; i < end; i++) {
      if (this.baseDelay !== this.delayTarget) {
        this.baseDelay += (this.delayTarget - this.baseDelay) * this.glide;
        if (Math.abs(this.delayTarget - this.baseDelay) < 1e-6)
          this.baseDelay = this.delayTarget;
      }
      const bowVelocity = this.maxVelocity * this.bow.process();
      const bridgeReflection =
        -STRING_FILTER_GAIN * this.stringFilter.process(bridge.last);
      const nutReflection = -neck.last;
      const deltaV = bowVelocity - (bridgeReflection + nutReflection);
      const newVelocity = deltaV * bowTable(deltaV, BOW_OFFSET, this.slope);
      const vib = this.vibrato.process();
      neck.tick(
        bridgeReflection + newVelocity,
        this.baseDelay * (1 - this.beta) +
          this.baseDelay * this.vibratoGain * vib,
      );
      bridge.tick(nutReflection + newVelocity, this.baseDelay * this.beta);

      let x = bridge.last;
      let wet = x;
      for (let s = 0; s < body.length; s++) wet = body[s].process(wet);
      x = BODY_GAIN * (x + this.bodyMix * (wet - x));

      if (this.ticks++ % FILTER_UPDATE === 0)
        this.svf.set(this.cutoff, this.q, this.fs);
      let y = this.svf.process(x) * this.shape.process();
      if (this.fadeStep > 0) {
        this.fade = Math.max(0, this.fade - this.fadeStep);
        y *= this.fade;
      }
      left[i] += y * gains[0];
      right[i] += y * gains[1];
      const level = y < 0 ? -y : y;
      if (level > peak) peak = level;
    }
    this.track(peak, end - start);
  }
}

// Violin: up to four bowed strings at once (double stops and chords).
export class BowedInstrument extends Instrument {
  readonly patch: BowedPatch;
  // Replaced by calibration tools; otherwise fixed at construction.
  tuning: KeyTable;
  private readonly voices: BowedVoice[] = [];
  private readonly byNote = new Int16Array(128).fill(-1);
  private pressure = 0.5;
  private position = 0.127;
  private speed = 1;
  private vibratoDepth = 0.006;
  private vibratoRate = 5.5;
  private glide = 1;
  private envelope: AdsrStages = {
    attack: 0.05,
    decay: 0.1,
    sustain: 0.9,
    release: 0.1,
  };
  private cutoff = 12000;
  private q = Math.SQRT1_2;
  private bodyMix = 1;

  constructor(
    patch: BowedPatch,
    fs: number,
    overrides?: Record<string, number>,
  ) {
    super(patch, fs, overrides);
    this.patch = patch;
    this.tuning = pickTuning(patch.tuningCents, fs);
    const lowestHz = midiToHz(patch.range[0]);
    for (let i = 0; i < patch.polyphony + 2; i++) {
      this.voices.push(new BowedVoice(fs, lowestHz));
    }
    this.applyParams();
  }

  override applyParams() {
    super.applyParams();
    const p = this.params;
    this.pressure = p.get("exciter.pressure");
    this.position = p.get("exciter.position");
    this.speed = p.get("exciter.speed");
    this.vibratoDepth = p.get("exciter.vibrato");
    this.vibratoRate = p.get("resonator.vibratoRate");
    this.glide = 1 - Math.exp(-3 / (p.get("resonator.portamento") * this.fs));
    this.envelope = p.envelope("envelope");
    this.cutoff = p.get("filter.cutoff");
    this.q = p.get("filter.resonance");
    this.bodyMix = p.has("body.violin") ? p.get("body.violin") : 0;
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      // STK controlChange: bow pressure maps to the friction slope 5 → 1.
      voice.slope = 5 - 4 * this.pressure;
      voice.beta = this.position;
      voice.vibratoGain = this.vibratoDepth;
      voice.glide = this.glide;
      voice.vibrato.setRate(this.vibratoRate);
      voice.cutoff = this.cutoff;
      voice.q = this.q;
      voice.bodyMix = this.bodyMix;
      voice.bow.setRelease(this.envelope.release);
    }
  }

  protected allVoices() {
    return this.voices;
  }

  activeVoices() {
    let count = 0;
    for (let i = 0; i < this.voices.length; i++) {
      if (this.voices[i].busy) count++;
    }
    return count;
  }

  noteOn(note: number, velocity: number) {
    const n = foldNote(note, this.patch.range[0], this.patch.range[1]);
    const existing = this.byNote[n];
    let voice = existing >= 0 ? this.voices[existing] : null;
    if (voice && voice.busy && voice.state !== STOLEN) {
      voice.holds++;
      voice.state = ACTIVE;
      this.bowOn(voice, velocity);
      return;
    }
    const from = legatoNote(this.voices, this.clock, this.fs);
    let sounding = 0;
    let idle = -1;
    for (let i = 0; i < this.voices.length; i++) {
      const candidate = this.voices[i];
      if (candidate.state === IDLE) {
        if (idle < 0) idle = i;
      } else if (candidate.state !== STOLEN) {
        sounding++;
      }
    }
    if (sounding >= this.patch.polyphony || idle < 0) {
      const victim = pickVictim(this.voices);
      if (victim) {
        if (this.byNote[victim.note] >= 0) this.byNote[victim.note] = -1;
        if (idle < 0) {
          victim.free();
          idle = this.voices.indexOf(victim);
        } else {
          victim.steal();
        }
      }
    }
    if (idle < 0) return;
    voice = this.voices[idle];
    voice.reset();
    voice.start(n, this.clock);
    this.byNote[n] = idle;
    this.tune(voice, n, from);
    this.bowOn(voice, velocity);
    voice.vibrato.set(this.vibratoRate, 0.3, 0.4);
    voice.vibrato.restart();
  }

  noteOff(note: number) {
    const n = foldNote(note, this.patch.range[0], this.patch.range[1]);
    const index = this.byNote[n];
    if (index < 0) return;
    const voice = this.voices[index];
    if (voice.holds === 0) return;
    voice.holds--;
    if (voice.holds > 0) return;
    voice.state = RELEASED;
    voice.bow.noteOff();
    voice.shape.noteOff();
  }

  allNotesOff() {
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.busy && voice.state !== STOLEN) {
        voice.holds = 0;
        voice.state = RELEASED;
        voice.bow.noteOff();
        voice.shape.noteOff();
      }
    }
  }

  panic() {
    for (let i = 0; i < this.voices.length; i++) this.voices[i].free();
    this.byNote.fill(-1);
  }

  protected renderVoices(start: number, end: number) {
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.busy) voice.render(this.left, this.right, start, end);
    }
  }

  protected freeFinished() {
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.busy && voice.finished) {
        if (this.byNote[voice.note] === i) this.byNote[voice.note] = -1;
        voice.free();
      }
    }
  }

  private bowOn(voice: BowedVoice, velocity: number) {
    // STK: maxVelocity = 0.03 + 0.2·amplitude.
    voice.maxVelocity = (0.03 + 0.2 * velocity) * this.speed;
    voice.bow.setStages(this.envelope);
    voice.bow.noteOn();
    voice.shape.noteOn();
  }

  // Round trip = neck + bridge + 2 ("lastOut" samples) + τ_string filter.
  private loopDelay(voice: BowedVoice, n: number) {
    const f0 = midiToHz(n) * 2 ** (keyTable(this.tuning, n) / 1200);
    const w = (TWO_PI * f0) / this.fs;
    return Math.max(
      2,
      this.fs / f0 - 2 - onePolePhaseDelay(voice.stringFilter.p, w),
    );
  }

  // A legato note starts at the length of the one it follows and glides.
  private tune(voice: BowedVoice, n: number, from: number) {
    voice.delayTarget = this.loopDelay(voice, n);
    voice.baseDelay =
      from >= 0 ? this.loopDelay(voice, from) : voice.delayTarget;
    const [low, high] = this.patch.range;
    const pan =
      this.patch.pan.center +
      this.patch.pan.spread * ((2 * (n - low)) / (high - low) - 1);
    panGains(pan, voice.gains);
  }
}
