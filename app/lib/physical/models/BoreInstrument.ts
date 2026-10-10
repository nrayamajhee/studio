// Flute, saxophone, brass and clarinet loops ported from STK (The Synthesis
// ToolKit, Perry Cook & Gary Scavone, MIT-style license): src/Flute.cpp,
// src/Saxofony.cpp, src/Brass.cpp and src/Clarinet.cpp.

import { Adsr, type AdsrStages } from "../dsp/Adsr";
import { DcBlocker, OnePoleLowpass } from "../dsp/filters";
import { Noise } from "../dsp/generators";
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
import { Instrument } from "../engine/Instrument";
import type { ModuleSettings } from "../engine/Modules";
import { ACTIVE, IDLE, RELEASED, Voice } from "../engine/Voice";
import { pickTuning, type KeyTable, type BorePatch } from "../patches/types";
import { Waveguide } from "./Waveguide";

const BURST_WINDOW = 0.015;
const MAX_HELD = 16;
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
// STK Clarinet: the reed table and the cylinder's inverting end reflection,
// whose loss is a two-point average (half a sample of delay).
const CLARINET_REED_OFFSET = 0.7;
const CLARINET_REFLECTION = 0.95;
const CLARINET_FILTER_DELAY = 0.5;
// STK Brass: the bore holds two periods, so its modes sit at f0/2 multiples and
// the lips, a resonance at f0, lock onto the second; +3 samples is STK's.
const BRASS_BORE_PERIODS = 2;
const BRASS_BORE_OFFSET = 3;
// STK's lip resonance (radius 0.997, input gain 0.03) has a DC gain of ~0.03/ω²,
// so low notes hold the lips wide open and never oscillate. Keeping its Q fixed
// (r = 1 − k·ω) and its input gain at G·ω² makes the lips behave the same at
// every pitch; k and G reproduce STK's values at 880 Hz, where it speaks well.
const BRASS_LIP_K = 0.026;
const BRASS_LIP_G = 2.26;
const BRASS_MOUTH = 0.3;
const BRASS_BORE_REFLECTION = 0.85;
// Lip tension 0–1 moves the lip resonance ±0.05 octave around the note,
// brightening and bending the pitch as tightening real lips does.
const BRASS_LIP_RANGE = 0.1;

export type BoreModel = BorePatch["model"];

class BoreVoice extends Voice {
  readonly model: BoreModel;
  readonly bore: Waveguide;
  readonly jet: Waveguide;
  readonly reflection = new OnePoleLowpass();
  readonly dc: DcBlocker;
  readonly breath: Adsr;
  readonly gate: Adsr;
  readonly noise = new Noise(4242);
  boreLength = 100;
  jetLength = 30;
  boreTarget = 100;
  jetTarget = 30;
  glide = 1;
  maxPressure = 1;
  outputGain = 0.5;
  noiseGain = 0.15;
  reedSlope = 0.3;
  watchdog = false;
  // Lip resonance: input gain, a1, a2 and state.
  private lipGain = 0;
  private lipA1 = 0;
  private lipA2 = 0;
  private lipY1 = 0;
  private lipY2 = 0;
  private zero1 = 0;

  constructor(
    fs: number,
    mods: ModuleSettings,
    lowestHz: number,
    model: BoreModel,
  ) {
    super(fs, mods);
    this.model = model;
    const longest =
      model === "brass"
        ? (BRASS_BORE_PERIODS * fs) / lowestHz + BRASS_BORE_OFFSET + 8
        : fs / (lowestHz * FLUTE_OVERBLOW) + 8;
    this.bore = new Waveguide(longest);
    this.jet = new Waveguide(longest);
    this.dc = new DcBlocker(fs);
    this.breath = new Adsr(fs);
    this.gate = new Adsr(fs);
  }

  reset() {
    this.bore.clear();
    this.jet.clear();
    this.reflection.clear();
    this.dc.clear();
    this.clearModules();
    this.breath.reset();
    this.gate.reset();
    this.lipY1 = this.lipY2 = 0;
    this.zero1 = 0;
  }

  setLip(freq: number) {
    const w = (TWO_PI * freq) / this.fs;
    const r = 1 - BRASS_LIP_K * w;
    this.lipGain = BRASS_LIP_G * w * w;
    this.lipA2 = r * r;
    this.lipA1 = -2 * r * Math.cos(w);
  }

  private lip(x: number) {
    const y =
      this.lipGain * x - this.lipA1 * this.lipY1 - this.lipA2 * this.lipY2;
    this.lipY2 = this.lipY1;
    this.lipY1 = y;
    return y;
  }

  render(left: Float32Array, right: Float32Array, start: number, end: number) {
    const bore = this.bore;
    const jet = this.jet;
    const { pitch, level } = this.mods;
    for (let i = start; i < end; i++) {
      this.boreLength += (this.boreTarget - this.boreLength) * this.glide;
      this.jetLength += (this.jetTarget - this.jetLength) * this.glide;
      // The LFO sways the breath and bends the bore's length.
      const vib = this.modulate();
      let pressure = this.maxPressure * this.breath.process();
      pressure += pressure * (this.noiseGain * this.noise.next() + level * vib);
      const bend = 1 - pitch * vib;

      let out: number;
      if (this.model === "brass") {
        // The lips open with the pressure across them (squared, saturating),
        // mixing mouth and bore pressure into the bore.
        const mouth = BRASS_MOUTH * pressure;
        const back = BRASS_BORE_REFLECTION * bore.last;
        let area = this.lip(mouth - back);
        area *= area;
        if (area > 1) area = 1;
        out = bore.tick(
          this.dc.process(area * mouth + (1 - area) * back),
          this.boreLength * bend,
        );
      } else if (this.model === "clarinet") {
        const reflected = -CLARINET_REFLECTION * 0.5 * (bore.last + this.zero1);
        this.zero1 = bore.last;
        const diff = reflected - pressure;
        out = bore.tick(
          pressure +
            diff * reedTable(diff, CLARINET_REED_OFFSET, -this.reedSlope),
          this.boreLength * bend,
        );
      } else if (this.model === "saxophone") {
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
        this.lipY1 = this.lipY2 = 0;
        this.zero1 = 0;
        this.watchdog = true;
        out = 0;
      }

      this.emit(out, this.outputGain * this.gate.process(), i, left, right);
    }
    this.endBlock(end - start);
    if (!this.breath.active && this.state === ACTIVE) this.state = RELEASED;
  }

  start(note: number, clock: number) {
    this.begin(note, clock);
  }
}

// Monophonic flute, saxophone, brass or clarinet with last-note priority and
// legato.
export class BoreInstrument extends Instrument {
  readonly patch: BorePatch;
  // Replaced by calibration tools; otherwise fixed at construction.
  tuning: KeyTable;
  private readonly voice: BoreVoice;
  private readonly held = new Int16Array(MAX_HELD);
  private heldCount = 0;
  private current = -1;
  private currentHz = 0;
  private burstStart = -Infinity;
  private pressure = 1;
  private noiseLevel = 1;
  private portamento = 0.03;
  private envelope: AdsrStages = {
    attack: 0.05,
    decay: 0.1,
    sustain: 0.9,
    release: 0.1,
  };
  private lipRatio = 1;
  private watchdogReported = false;

  constructor(
    patch: BorePatch,
    fs: number,
    overrides?: Record<string, number>,
  ) {
    super(patch, fs, overrides, { pitch: "model", level: "model" });
    this.patch = patch;
    this.tuning = pickTuning(patch.tuningCents, fs);
    this.voice = new BoreVoice(
      fs,
      this.mods,
      midiToHz(patch.range[0]),
      patch.model,
    );
    this.voice.reflection.setPole(
      patch.model === "saxophone" ? 0.9 : 0.7 - (0.1 * 22050) / fs,
    );
    panGains(patch.pan.center, this.voice.gains);
    this.applyParams();
  }

  override applyParams() {
    super.applyParams();
    const p = this.params;
    this.pressure = p.get("exciter.pressure");
    this.noiseLevel = p.get("exciter.noise");
    this.portamento = p.get("resonator.portamento");
    this.envelope = p.envelope("envelope");
    const voice = this.voice;
    voice.noiseGain =
      (voice.model === "saxophone" || voice.model === "clarinet"
        ? 0.2
        : voice.model === "brass"
          ? 0.05
          : 0.15) * this.noiseLevel;
    voice.reedSlope = 0.1 + 0.4 * p.get("exciter.reed");
    this.lipRatio = p.has("exciter.lip")
      ? 2 ** ((p.get("exciter.lip") - 0.5) * BRASS_LIP_RANGE)
      : 1;
    if (voice.model === "brass" && this.current >= 0)
      voice.setLip(this.currentHz * this.lipRatio);
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
      voice.start(n, this.clock);
      voice.onset(n, this.clock);
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
    voice.retarget(n);
    const f0 = midiToHz(n) * 2 ** (keyTable(this.tuning, n) / 1200);
    const fs = this.fs;
    this.currentHz = f0;
    let delay: number;
    if (voice.model === "brass") {
      // DC blocker and lip phase are left to the measured tuning table.
      delay = (BRASS_BORE_PERIODS * fs) / f0 + BRASS_BORE_OFFSET;
      voice.boreTarget = delay;
      voice.setLip(f0 * this.lipRatio);
    } else if (voice.model === "clarinet") {
      // The inverting reflection makes the loop two passes of the bore.
      delay = (0.5 * fs) / f0 - CLARINET_FILTER_DELAY - 1;
      voice.boreTarget = delay;
    } else if (voice.model === "saxophone") {
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
