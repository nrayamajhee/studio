// Flute and saxophone loops ported from STK (The Synthesis ToolKit, Perry Cook
// & Gary Scavone, MIT-style license): src/Flute.cpp and src/Saxofony.cpp.

import { Adsr, type AdsrStages } from "../dsp/Adsr";
import { DcBlocker, OnePoleLowpass } from "../dsp/filters";
import { Lfo, Noise } from "../dsp/generators";
import {
  foldNote,
  keyTable,
  lerp,
  midiToHz,
  panGains,
  TWO_PI,
} from "../dsp/math";
import { jetTable, reedTable, softClip } from "../dsp/nonlinear";
import { onePolePhaseDelay } from "../dsp/phaseDelay";
import { Svf } from "../dsp/Svf";
import { Instrument } from "../engine/Instrument";
import { ACTIVE, IDLE, RELEASED, Voice } from "../engine/Voice";
import { pickTuning, type KeyTable, type BorePatch } from "../patches/types";
import { Waveguide } from "./Waveguide";

const BURST_WINDOW = 0.015;
const MAX_HELD = 16;
const FILTER_UPDATE = 16;
// STK Flute: the bore is tuned to 2/3 of the note and overblown.
const FLUTE_OVERBLOW = 0.66666;
const FLUTE_JET_REFLECTION = 0.5;
const FLUTE_END_REFLECTION = 0.5;
// STK Saxofony: reed table offset/slope and bell reflection.
const SAX_REED_OFFSET = 0.7;
const SAX_BELL_REFLECTION = -0.95;
// STK fixes the bell lowpass at pole 0.9 (~740 Hz at 44.1 kHz): too bright for
// low notes (they overblow) and too dark for high ones (they stop speaking).
// Open tone holes make the real reflection track the sounding note, so the
// cutoff follows f0 instead, which also makes it sample-rate independent.
const SAX_REFLECTION_RATIO = 14;
const SAX_REFLECTION_MIN = 500;

class BoreVoice extends Voice {
  readonly bore: Waveguide;
  readonly jet: Waveguide;
  readonly reflection = new OnePoleLowpass();
  readonly dc: DcBlocker;
  readonly breath: Adsr;
  readonly gate: Adsr;
  readonly noise = new Noise(4242);
  readonly vibrato: Lfo;
  readonly svf = new Svf("lowpass");
  readonly gains = new Float64Array(2);
  boreLength = 100;
  jetLength = 30;
  boreTarget = 100;
  jetTarget = 30;
  glide = 1;
  maxPressure = 1;
  outputGain = 0.5;
  noiseGain = 0.15;
  vibratoGain = 0.05;
  pitchVibrato = 0;
  cutoff = 12000;
  q = Math.SQRT1_2;
  saxophone = false;
  reedSlope = 0.3;
  watchdog = false;
  private ticks = 0;

  constructor(fs: number, lowestHz: number) {
    super(fs);
    const longest = fs / (lowestHz * FLUTE_OVERBLOW) + 8;
    this.bore = new Waveguide(longest);
    this.jet = new Waveguide(longest);
    this.dc = new DcBlocker(fs);
    this.breath = new Adsr(fs);
    this.gate = new Adsr(fs);
    this.vibrato = new Lfo(fs);
  }

  reset() {
    this.bore.clear();
    this.jet.clear();
    this.reflection.clear();
    this.dc.clear();
    this.svf.clear();
    this.breath.reset();
    this.gate.reset();
  }

  render(left: Float32Array, right: Float32Array, start: number, end: number) {
    const bore = this.bore;
    const jet = this.jet;
    const gains = this.gains;
    let peak = 0;
    for (let i = start; i < end; i++) {
      this.boreLength += (this.boreTarget - this.boreLength) * this.glide;
      this.jetLength += (this.jetTarget - this.jetLength) * this.glide;
      const vib = this.vibrato.process();
      let pressure = this.maxPressure * this.breath.process();
      pressure +=
        pressure *
        (this.noiseGain * this.noise.next() + this.vibratoGain * vib);
      const bend = 1 - this.pitchVibrato * vib;

      let out: number;
      if (this.saxophone) {
        // delayA ≡ bore (bell side), delayB ≡ jet (reed side).
        const t = SAX_BELL_REFLECTION * this.reflection.process(bore.last);
        out = t - jet.last;
        const diff = pressure - out;
        jet.tick(t, this.jetLength * bend);
        const reed = diff * reedTable(diff, SAX_REED_OFFSET, this.reedSlope);
        bore.tick(
          4 * softClip(0.25 * (pressure - reed - t)),
          this.boreLength * bend,
        );
      } else {
        let temp = -this.reflection.process(bore.last);
        temp = this.dc.process(temp);
        let diff = pressure - FLUTE_JET_REFLECTION * temp;
        diff = jet.tick(diff, this.jetLength * bend);
        diff = jetTable(diff) + FLUTE_END_REFLECTION * temp;
        out =
          0.3 * bore.tick(4 * softClip(0.25 * diff), this.boreLength * bend);
      }

      if (!(out > -4 && out < 4)) {
        // Blown up (or NaN): silence the loops and restart the note quietly.
        this.bore.clear();
        this.jet.clear();
        this.reflection.clear();
        this.dc.clear();
        this.watchdog = true;
        out = 0;
      }

      if (this.ticks++ % FILTER_UPDATE === 0)
        this.svf.set(this.cutoff, this.q, this.fs);
      let y =
        this.svf.process(out) *
        this.outputGain *
        this.gate.process() *
        this.shape.process();
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
    if (!this.breath.active && this.state === ACTIVE) this.state = RELEASED;
  }

  start(note: number, clock: number) {
    this.begin(note, clock);
  }
}

// Monophonic flute or saxophone with last-note priority and legato.
export class BoreInstrument extends Instrument {
  readonly patch: BorePatch;
  // Replaced by calibration tools; otherwise fixed at construction.
  tuning: KeyTable;
  private readonly voice: BoreVoice;
  private readonly held = new Int16Array(MAX_HELD);
  private heldCount = 0;
  private current = -1;
  private burstStart = -Infinity;
  private pressure = 1;
  private noiseLevel = 1;
  private vibratoDepth = 0.04;
  private vibratoRate = 5;
  private portamento = 0.03;
  private envelope: AdsrStages = {
    attack: 0.05,
    decay: 0.1,
    sustain: 0.9,
    release: 0.1,
  };
  private cutoff = 12000;
  private q = Math.SQRT1_2;
  private pitchDepth = 0;
  private watchdogReported = false;

  constructor(
    patch: BorePatch,
    fs: number,
    overrides?: Record<string, number>,
  ) {
    super(patch, fs, overrides);
    this.patch = patch;
    this.tuning = pickTuning(patch.tuningCents, fs);
    this.voice = new BoreVoice(fs, midiToHz(patch.range[0]));
    this.voice.saxophone = patch.model === "saxophone";
    this.voice.reflection.setPole(
      this.voice.saxophone ? 0.9 : 0.7 - (0.1 * 22050) / fs,
    );
    panGains(patch.pan.center, this.voice.gains);
    this.applyParams();
  }

  override applyParams() {
    super.applyParams();
    const p = this.params;
    this.pressure = p.get("exciter.pressure");
    this.noiseLevel = p.get("exciter.noise");
    this.vibratoDepth = p.get("exciter.vibrato");
    this.vibratoRate = p.get("resonator.vibratoRate");
    this.portamento = p.get("resonator.portamento");
    this.pitchDepth = p.get("resonator.pitchVibrato");
    this.envelope = p.envelope("envelope");
    this.cutoff = p.get("filter.cutoff");
    this.q = p.get("filter.resonance");
    const voice = this.voice;
    voice.noiseGain = (voice.saxophone ? 0.2 : 0.15) * this.noiseLevel;
    voice.vibratoGain = this.vibratoDepth;
    voice.pitchVibrato = this.pitchDepth;
    voice.vibrato.setRate(this.vibratoRate);
    voice.reedSlope = 0.1 + 0.4 * p.get("exciter.reed");
    voice.cutoff = this.cutoff;
    voice.q = this.q;
    voice.breath.setRelease(this.envelope.release);
    voice.glide =
      1 - Math.exp(-3 / (Math.max(0.001, this.portamento) * this.fs));
  }

  activeVoices() {
    return this.voice.busy ? 1 : 0;
  }

  protected allVoices() {
    return [this.voice];
  }

  noteOn(note: number, velocity: number) {
    const n = foldNote(note, this.patch.range[0], this.patch.range[1]);
    if (this.heldCount < MAX_HELD) this.held[this.heldCount++] = n;
    const inBurst = this.clock - this.burstStart < BURST_WINDOW * this.fs;
    if (inBurst && this.current >= 0) return;
    this.burstStart = this.clock;
    this.play(n, velocity);
  }

  noteOff(note: number) {
    const n = foldNote(note, this.patch.range[0], this.patch.range[1]);
    for (let i = this.heldCount - 1; i >= 0; i--) {
      if (this.held[i] === n) {
        this.held.copyWithin(i, i + 1, this.heldCount);
        this.heldCount--;
        break;
      }
    }
    if (n !== this.current) return;
    if (this.heldCount > 0) {
      this.retune(this.held[this.heldCount - 1], false);
    } else {
      this.current = -1;
      this.voice.breath.noteOff();
      this.voice.gate.noteOff();
      this.voice.shape.noteOff();
    }
  }

  allNotesOff() {
    this.heldCount = 0;
    this.current = -1;
    this.voice.breath.noteOff();
    this.voice.gate.noteOff();
    this.voice.shape.noteOff();
  }

  panic() {
    this.heldCount = 0;
    this.current = -1;
    this.voice.free();
  }

  protected renderVoices(start: number, end: number) {
    this.voice.render(this.left, this.right, start, end);
    if (this.voice.watchdog) {
      this.voice.watchdog = false;
      if (!this.watchdogReported) {
        this.watchdogReported = true;
        this.warn(`${this.name}: loop blew up and was reset`);
      }
    }
  }

  protected freeFinished() {
    const voice = this.voice;
    if (voice.busy && voice.state !== ACTIVE && voice.finished) voice.free();
  }

  private play(n: number, velocity: number) {
    const voice = this.voice;
    const legato =
      voice.state === ACTIVE && voice.breath.active && !voice.breath.releasing;
    if (!legato) {
      if (voice.state === IDLE) voice.reset();
      const [low, high] = this.patch.pressure;
      const steady = lerp(low, high, velocity) * this.pressure;
      voice.maxPressure = steady / Math.max(0.05, this.envelope.sustain);
      voice.outputGain = velocity + 0.001;
      voice.breath.setStages(this.envelope);
      voice.breath.noteOn();
      voice.gate.set(0.005, 0, 1, 0.05, true);
      voice.gate.noteOn();
      voice.shape.noteOn();
      voice.vibrato.set(
        this.vibratoRate,
        this.patch.id === "flute" ? 0.3 : 0.25,
        0.3,
      );
      voice.vibrato.restart();
      voice.start(n, this.clock);
    }
    this.retune(n, !legato);
  }

  // Delay lengths from STK: fs/f − τ_reflection(f) − the loop's "lastOut"
  // samples (one for the flute bore, two for the sax's split bore), corrected by
  // the patch's measured tuning table.
  private retune(n: number, immediate: boolean) {
    const voice = this.voice;
    this.current = n;
    voice.note = n;
    voice.state = ACTIVE;
    const f0 = midiToHz(n) * 2 ** (keyTable(this.tuning, n) / 1200);
    const fs = this.fs;
    let delay: number;
    if (voice.saxophone) {
      const w = (TWO_PI * f0) / fs;
      const cutoff = Math.min(
        0.4 * fs,
        Math.max(SAX_REFLECTION_MIN, SAX_REFLECTION_RATIO * f0),
      );
      voice.reflection.setCutoff(cutoff, fs);
      delay = fs / f0 - onePolePhaseDelay(voice.reflection.p, w) - 2;
      const blow = this.params.get("exciter.blowPosition");
      voice.boreTarget = (1 - blow) * delay;
      voice.jetTarget = blow * delay;
    } else {
      const fBore = f0 * FLUTE_OVERBLOW;
      const w = (TWO_PI * fBore) / fs;
      delay = fs / fBore - onePolePhaseDelay(voice.reflection.p, w) - 1;
      voice.boreTarget = delay;
      voice.jetTarget = delay * this.params.get("exciter.jetRatio");
    }
    if (immediate) {
      voice.boreLength = voice.boreTarget;
      voice.jetLength = voice.jetTarget;
    }
    const [low, high] = this.patch.range;
    const pan =
      this.patch.pan.center +
      this.patch.pan.spread * ((2 * (n - low)) / (high - low) - 1);
    panGains(pan, voice.gains);
  }
}
