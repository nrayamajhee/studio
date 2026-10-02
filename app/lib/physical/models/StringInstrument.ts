import { Adsr } from "../dsp/Adsr";
import { DcBlocker } from "../dsp/filters";
import { Noise } from "../dsp/generators";
import { clamp, foldNote, keyTable, midiToHz, panGains } from "../dsp/math";
import { Svf } from "../dsp/Svf";
import { Instrument } from "../engine/Instrument";
import {
  ACTIVE,
  IDLE,
  RELEASED,
  STOLEN,
  Voice,
  pickVictim,
} from "../engine/Voice";
import type { StringPatch } from "../patches/types";
import {
  hammer,
  pluck,
  type HammerOptions,
  type PluckOptions,
} from "./exciters";
import { StringLoop } from "./StringLoop";

const FILTER_UPDATE = 16;
const REFRET_SECONDS = 0.008;
const STRUM_WINDOW = 0.015;
const MAX_UNISON = 3;

class StringVoice extends Voice {
  readonly loops: StringLoop[] = [];
  readonly split = new Float64Array(MAX_UNISON);
  readonly excitation: Float32Array;
  readonly noise: Noise;
  readonly gains = new Float64Array(2);
  readonly dc: DcBlocker;
  readonly svf = new Svf("lowpass");
  readonly amp: Adsr;
  loopCount = 1;
  excitationLength = 0;
  excitationPos = 0;
  pickupTap = 0;
  deferred = false;
  countdown = 0;
  pendingNote = -1;
  pendingVelocity = 0;
  cutoff = 16000;
  cutoffTarget = 16000;
  q = Math.SQRT1_2;
  filterEnv = 0;
  filterEnvDecay = 1;
  envAmount = 0;
  lastContactMs = 0;
  private ticks = 0;
  private readonly owner: StringInstrument;

  constructor(
    owner: StringInstrument,
    fs: number,
    lowestHz: number,
    loops: number,
    excitationSize: number,
    seed: number,
  ) {
    super(fs);
    this.owner = owner;
    for (let i = 0; i < loops; i++)
      this.loops.push(new StringLoop(fs, lowestHz));
    this.excitation = new Float32Array(excitationSize);
    this.noise = new Noise(seed);
    this.dc = new DcBlocker(fs);
    this.amp = new Adsr(fs);
  }

  reset() {
    for (let i = 0; i < this.loops.length; i++) this.loops[i].clear();
    this.dc.clear();
    this.svf.clear();
    this.amp.reset();
    this.excitationLength = 0;
    this.excitationPos = 0;
    this.deferred = false;
    this.countdown = 0;
    this.pendingNote = -1;
  }

  render(left: Float32Array, right: Float32Array, start: number, end: number) {
    const loops = this.loops;
    const split = this.split;
    const excitation = this.excitation;
    const gains = this.gains;
    let peak = 0;
    for (let i = start; i < end; i++) {
      if (this.countdown > 0 && --this.countdown === 0) this.owner.launch(this);
      let e = 0;
      if (this.excitationPos < this.excitationLength) {
        e = excitation[this.excitationPos++];
      }
      let y = 0;
      for (let s = 0; s < this.loopCount; s++) y += loops[s].tick(e * split[s]);
      if (this.pickupTap > 0) y -= loops[0].delay.readInt(this.pickupTap);
      y = this.dc.process(y);
      if (this.ticks++ % FILTER_UPDATE === 0) this.updateFilter();
      y = this.svf.process(y) * this.amp.process() * this.shape.process();
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

  // Cutoff glides toward its target and the filter envelope decays, both
  // recomputed every 16 samples.
  private updateFilter() {
    this.cutoff += (this.cutoffTarget - this.cutoff) * 0.3;
    this.filterEnv *= this.filterEnvDecay;
    const cutoff = this.cutoff * (1 + this.envAmount * this.filterEnv);
    this.svf.set(cutoff, this.q, this.fs);
  }
}

// Piano, guitar and basses: struck or plucked single-delay-loop strings with
// per-key or per-string allocation, dampers, a sustain pedal and re-strikes.
export class StringInstrument extends Instrument {
  readonly patch: StringPatch;
  private readonly voices: StringVoice[] = [];
  private readonly byNote = new Int16Array(128).fill(-1);
  private sustainDown = false;
  private lastNoteOn = -Infinity;
  private strumIndex = 0;
  private decay = 1;
  private brightness = 0;
  private inharmonicity = 1;
  private detune = 1;
  private hardness = 0.5;
  private position = 0.15;
  private strength = 1;
  private cutoff = 16000;
  private q = Math.SQRT1_2;
  private envAmount = 0;
  private envDecay = 0.3;
  private keytrack = 0;
  private attack = 0.001;
  private release = 1;
  private strum = 0;
  private jawari = 0;
  private readonly pluckOptions: PluckOptions = {
    period: 100,
    velocity: 0.8,
    hardness: 0.5,
    position: 0.15,
    strength: 1,
    finger: false,
  };
  private readonly hammerOptions: HammerOptions = {
    period: 100,
    velocity: 0.8,
    hardness: 0.5,
    position: 0.12,
    strength: 1,
    mass: 1,
    fs: 48000,
    contactMs: 0,
  };

  constructor(
    patch: StringPatch,
    fs: number,
    overrides?: Record<string, number>,
  ) {
    super(patch, fs, overrides);
    this.patch = patch;
    this.hammerOptions.fs = fs;
    this.pluckOptions.finger = patch.exciter === "finger";
    const loops =
      patch.allocation === "key" ? MAX_UNISON : patch.polarization ? 2 : 1;
    const hammerSize = Math.ceil(0.014 * fs);
    if (patch.allocation === "string" && patch.openStrings) {
      patch.openStrings.forEach((open, s) => {
        const lowestHz = midiToHz(open);
        const size = Math.ceil(fs / lowestHz) + 8;
        this.voices.push(
          new StringVoice(this, fs, lowestHz, loops, size, 1000 + s * 77),
        );
      });
    } else {
      const lowestHz = midiToHz(patch.range[0]);
      const size = Math.ceil(fs / lowestHz) + hammerSize + 8;
      for (let v = 0; v < patch.polyphony + 4; v++) {
        this.voices.push(
          new StringVoice(this, fs, lowestHz, loops, size, 2000 + v * 131),
        );
      }
    }
    this.applyParams();
  }

  override applyParams() {
    super.applyParams();
    const p = this.params;
    this.decay = p.get("resonator.decay");
    this.brightness = p.get("resonator.brightness");
    this.inharmonicity = p.get("resonator.inharmonicity");
    this.detune = p.get("resonator.detune");
    this.hardness = p.get("exciter.hardness");
    this.position = p.get("exciter.position");
    this.strength = p.get("exciter.strength");
    this.cutoff = p.get("filter.cutoff");
    this.q = p.get("filter.resonance");
    this.envAmount = p.get("filter.envAmount");
    this.envDecay = p.get("filter.envDecay");
    this.keytrack = p.get("filter.keytrack");
    this.attack = p.get("envelope.attack");
    this.release = p.get("envelope.release");
    this.strum = p.has("exciter.strum") ? p.get("exciter.strum") : 0;
    this.jawari = p.has("resonator.jawari") ? p.get("resonator.jawari") : 0;
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.busy) this.configureFilter(voice, voice.note);
    }
  }

  activeVoices() {
    let count = 0;
    for (let i = 0; i < this.voices.length; i++) {
      if (this.voices[i].busy) count++;
    }
    return count;
  }

  protected allVoices() {
    return this.voices;
  }

  lastContactMs() {
    let latest = 0;
    let age = -Infinity;
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.busy && voice.age > age) {
        age = voice.age;
        latest = voice.lastContactMs;
      }
    }
    return latest;
  }

  noteOn(note: number, velocity: number) {
    const n = foldNote(note, this.patch.range[0], this.patch.range[1]);
    // Chord macros arrive as a burst; spread a burst like a strum if asked to.
    if (this.clock - this.lastNoteOn < STRUM_WINDOW * this.fs)
      this.strumIndex++;
    else this.strumIndex = 0;
    this.lastNoteOn = this.clock;
    const delay = Math.round((this.strumIndex * this.strum * this.fs) / 1000);

    if (this.patch.allocation === "key") this.noteOnKey(n, velocity, delay);
    else this.noteOnString(n, velocity, delay);
  }

  noteOff(note: number) {
    const n = foldNote(note, this.patch.range[0], this.patch.range[1]);
    const voice = this.findHeld(n);
    if (!voice) return;
    voice.holds--;
    if (voice.holds > 0) return;
    if (voice.countdown > 0 && voice.pendingNote === n) {
      voice.countdown = 0;
      voice.state = RELEASED;
      return;
    }
    if (this.sustainDown) {
      voice.deferred = true;
      voice.state = RELEASED;
      return;
    }
    this.damp(voice);
  }

  override sustain(down: boolean) {
    this.sustainDown = down;
    if (down) return;
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.deferred && voice.holds === 0) {
        voice.deferred = false;
        this.damp(voice);
      }
    }
  }

  allNotesOff() {
    this.sustainDown = false;
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.busy && voice.state !== STOLEN) {
        voice.holds = 0;
        voice.countdown = 0;
        this.damp(voice);
      }
    }
  }

  panic() {
    this.sustainDown = false;
    for (let i = 0; i < this.voices.length; i++) this.voices[i].free();
    this.byNote.fill(-1);
  }

  // Called by a voice whose re-fret or strum delay has elapsed.
  launch(voice: StringVoice) {
    if (voice.pendingNote < 0) return;
    this.start(voice, voice.pendingNote, voice.pendingVelocity);
    voice.pendingNote = -1;
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
      if (voice.busy && voice.finished && voice.countdown === 0) {
        if (voice.note >= 0 && this.byNote[voice.note] === i) {
          this.byNote[voice.note] = -1;
        }
        voice.free();
      }
    }
  }

  private noteOnKey(n: number, velocity: number, delay: number) {
    const existing = this.byNote[n];
    if (existing >= 0 && this.voices[existing].busy) {
      this.restrike(this.voices[existing], velocity);
      return;
    }
    let sounding = 0;
    let idle = -1;
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.state === IDLE) {
        if (idle < 0) idle = i;
      } else if (voice.state !== STOLEN) {
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
    this.byNote[n] = idle;
    this.schedule(this.voices[idle], n, velocity, delay);
  }

  private noteOnString(n: number, velocity: number, delay: number) {
    const open = this.patch.openStrings ?? [];
    const maxFret = this.patch.maxFret ?? 20;
    for (let s = 0; s < this.voices.length; s++) {
      const voice = this.voices[s];
      const target = voice.countdown > 0 ? voice.pendingNote : voice.note;
      if (voice.busy && target === n && voice.state !== STOLEN) {
        if (voice.countdown > 0) voice.holds++;
        else this.restrike(voice, velocity);
        return;
      }
    }
    let free = -1;
    let held = -1;
    for (let s = 0; s < open.length; s++) {
      const fret = n - open[s];
      if (fret < 0 || fret > maxFret) continue;
      const voice = this.voices[s];
      const available = voice.holds === 0 && voice.countdown === 0;
      if (available && (free < 0 || fret < n - open[free])) free = s;
      if (held < 0 || fret < n - open[held]) held = s;
    }
    const s = free >= 0 ? free : held;
    if (s < 0) return;
    const voice = this.voices[s];
    if (voice.busy) {
      // Re-fret: damp the string for 8 ms, then retune and pluck it.
      for (let i = 0; i < voice.loopCount; i++) {
        voice.loops[i].setDecay(0.02, 0.002);
      }
      voice.pendingNote = n;
      voice.pendingVelocity = velocity;
      voice.countdown = Math.max(Math.round(REFRET_SECONDS * this.fs), delay);
      voice.holds = 1;
      return;
    }
    this.schedule(voice, n, velocity, delay);
  }

  private schedule(
    voice: StringVoice,
    n: number,
    velocity: number,
    delay: number,
  ) {
    if (delay > 0) {
      voice.state = ACTIVE;
      voice.note = n;
      voice.holds = 1;
      voice.quietSamples = 0;
      voice.pendingNote = n;
      voice.pendingVelocity = velocity;
      voice.countdown = delay;
      return;
    }
    this.start(voice, n, velocity);
  }

  private start(voice: StringVoice, note: number, velocity: number) {
    const patch = this.patch;
    const holds = Math.max(1, voice.holds);
    voice.reset();
    voice.holds = holds;
    const f0 = midiToHz(note);
    const t60 = keyTable(patch.t60, note) * this.decay;
    const p = clamp(
      keyTable(patch.brightness, note) - this.brightness,
      0,
      0.95,
    );
    const stages = keyTable(patch.dispersionStages, note);
    const coef = clamp(
      keyTable(patch.dispersionCoef, note) * this.inharmonicity,
      -0.95,
      0,
    );

    let count = 1;
    if (patch.allocation === "key") {
      count = Math.max(
        1,
        Math.min(MAX_UNISON, Math.round(keyTable(patch.unison, note))),
      );
    } else if (patch.polarization) {
      count = 2;
    }
    voice.loopCount = count;
    const spread = keyTable(patch.unisonDetune, note) * this.detune;
    for (let s = 0; s < count; s++) {
      let cents = 0;
      let decayScale = 1;
      if (patch.polarization) {
        cents = s === 0 ? 0 : patch.polarization.detuneCents;
        decayScale = s === 0 ? 1 : patch.polarization.decay;
        voice.split[s] =
          s === 0 ? patch.polarization.split : 1 - patch.polarization.split;
      } else {
        // Unison strings sit at 0, +spread, −spread (or ±spread/2 for two).
        if (count === 2) cents = (s === 0 ? 0.5 : -0.5) * spread;
        else cents = s === 0 ? 0 : s === 1 ? spread : -spread;
        decayScale = patch.unisonDecay[s] ?? 1;
        voice.split[s] = 1 / count;
      }
      if (patch.jawari)
        voice.loops[s].setJawari(
          patch.jawari.contact * this.jawari,
          patch.jawari.gap,
        );
      voice.loops[s].tune(
        f0 * 2 ** (cents / 1200),
        t60 * decayScale,
        p,
        stages,
        coef,
      );
    }

    this.excite(voice, note, velocity);
    voice.pickupTap = patch.pickup
      ? Math.max(1, Math.round(patch.pickup * voice.loops[0].period))
      : 0;

    const [low, high] = patch.range;
    let pan: number;
    if (patch.allocation === "string" && patch.openStrings) {
      const strings = patch.openStrings.length;
      const index = this.voices.indexOf(voice);
      pan =
        patch.pan.center +
        patch.pan.spread * ((2 * index) / Math.max(1, strings - 1) - 1);
    } else {
      pan =
        patch.pan.center +
        patch.pan.spread * ((2 * (note - low)) / (high - low) - 1);
    }
    panGains(pan, voice.gains);

    this.configureFilter(voice, note);
    voice.cutoff = voice.cutoffTarget;
    voice.filterEnv = 1;
    voice.amp.set(this.attack, 0, 1, 0.05, true);
    voice.amp.noteOn();
    voice.shape.noteOn();
    voice.age = this.clock;
    voice.state = ACTIVE;
    voice.note = note;
    voice.quietSamples = 0;
  }

  private restrike(voice: StringVoice, velocity: number) {
    voice.holds++;
    voice.deferred = false;
    voice.state = ACTIVE;
    voice.quietSamples = 0;
    const note = voice.note;
    const t60 = keyTable(this.patch.t60, note) * this.decay;
    for (let s = 0; s < voice.loopCount; s++) {
      const scale = this.patch.polarization
        ? s === 0
          ? 1
          : this.patch.polarization.decay
        : (this.patch.unisonDecay[s] ?? 1);
      voice.loops[s].setDecay(t60 * scale, 0.005);
    }
    this.excite(voice, note, velocity);
    voice.filterEnv = 1;
    voice.shape.noteOn();
  }

  private excite(voice: StringVoice, note: number, velocity: number) {
    const period = voice.loops[0].period;
    if (this.patch.exciter === "hammer") {
      const options = this.hammerOptions;
      options.period = period;
      options.velocity = velocity;
      options.hardness = this.hardness;
      options.position = this.position;
      options.strength = this.strength;
      options.mass = this.patch.hammerMass
        ? keyTable(this.patch.hammerMass, note)
        : 1;
      voice.excitationLength = hammer(voice.excitation, options);
      voice.lastContactMs = options.contactMs;
    } else {
      const options = this.pluckOptions;
      options.period = period;
      options.velocity = velocity;
      options.hardness = this.hardness;
      options.position = this.position;
      options.strength = this.strength;
      voice.excitationLength = pluck(voice.excitation, voice.noise, options);
    }
    voice.excitationPos = 0;
  }

  private damp(voice: StringVoice) {
    voice.state = RELEASED;
    voice.deferred = false;
    voice.shape.noteOff();
    const limit = this.patch.noDamperAbove;
    if (limit !== undefined && voice.note > limit) return;
    const t60 = keyTable(this.patch.damperT60, voice.note) * this.release;
    for (let s = 0; s < voice.loopCount; s++)
      voice.loops[s].setDecay(t60, 0.015);
  }

  private configureFilter(voice: StringVoice, note: number) {
    voice.cutoffTarget =
      this.cutoff * 2 ** ((this.keytrack * (note - 60)) / 12);
    voice.q = this.q;
    voice.envAmount = this.envAmount;
    voice.filterEnvDecay = Math.exp(
      -16 / (Math.max(0.01, this.envDecay) * this.fs),
    );
  }

  private findHeld(n: number) {
    if (this.patch.allocation === "key") {
      const index = this.byNote[n];
      const voice = index >= 0 ? this.voices[index] : null;
      return voice && voice.holds > 0 ? voice : null;
    }
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      const target = voice.countdown > 0 ? voice.pendingNote : voice.note;
      if (voice.holds > 0 && target === n) return voice;
    }
    return null;
  }
}
