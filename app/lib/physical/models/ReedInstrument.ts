import { Adsr, type AdsrStages } from "../dsp/Adsr";
import { DcBlocker, OnePoleHighpass } from "../dsp/filters";
import { Noise } from "../dsp/generators";
import {
  foldNote,
  keyTable,
  lerp,
  midiToHz,
  panGains,
  TWO_PI,
} from "../dsp/math";
import { Instrument } from "../engine/Instrument";
import type { ModuleSettings } from "../engine/Modules";
import {
  ACTIVE,
  IDLE,
  RELEASED,
  STOLEN,
  Voice,
  pickVictim,
} from "../engine/Voice";
import { pickTuning, type KeyTable, type ReedPatch } from "../patches/types";

const MAX_REEDS = 2;
// The reed swings through its slot freely while it is within this much of
// rest; past it the air rushes round the tip. The Brightness param moves it.
const SLOT = 0.25;
const SLOT_RANGE = 0.15;
// The gap around the tongue inside the slot, and how rounded the slot's edges
// are (sharp edges alias on high notes).
const CLEARANCE = 0.02;
const EDGE = 0.05;
// The pressure step bends the reed before it starts to swing.
const PUSH = 0.15;
const C4_HZ = 261.63;
// Radiated sound is the flow's slope, which rises 6 dB an octave; most of that
// is taken back so the range sits level.
const LEVEL_TILT = 0.85;
// That slope is small next to the other models' outputs; this brings a reed
// near them so patch gains sit around 1.
const RADIATION_GAIN = 15;
const NOISE_HIGHPASS = 1500;
// Turbulence rides on the flow itself, not on its much smaller slope, so it is
// scaled down to sit under the tone (the Air noise param scales it again).
const NOISE_LEVEL = 0.4;

// A rounded max(0, z).
const opening = (z: number) => 0.5 * (z + Math.sqrt(z * z + EDGE * EDGE));

class ReedVoice extends Voice {
  // Each reed: resonator coefficients, swing feedback, level and state.
  readonly c1 = new Float64Array(MAX_REEDS);
  readonly c2 = new Float64Array(MAX_REEDS);
  readonly feed = new Float64Array(MAX_REEDS);
  readonly level = new Float64Array(MAX_REEDS);
  readonly y1 = new Float64Array(MAX_REEDS);
  readonly y2 = new Float64Array(MAX_REEDS);
  readonly breath: Adsr;
  readonly noise: Noise;
  readonly noiseFilter = new OnePoleHighpass();
  readonly dc: DcBlocker;
  reeds = 1;
  drive = 2;
  slot = SLOT;
  asymmetry = 0;
  noiseGain = 0;
  outputScale = 1;
  private flow = 0;

  constructor(fs: number, mods: ModuleSettings, seed: number) {
    super(fs, mods);
    this.breath = new Adsr(fs);
    this.noise = new Noise(seed);
    this.noiseFilter.setCutoff(NOISE_HIGHPASS, fs);
    this.dc = new DcBlocker(fs);
  }

  reset() {
    this.y1.fill(0);
    this.y2.fill(0);
    this.breath.reset();
    this.dc.clear();
    this.clearModules();
    this.flow = 0;
  }

  // Tunes reed `r` to `hz`. Its swing dies away over `settle` seconds unless
  // the drive feeds it: a van der Pol oscillator, x'' − (2/τ)(D − 1 − 4Dx²)x'
  // + ω²x = 0, which grows once D > 1 and settles at an amplitude of
  // √((D − 1)/D).
  tuneReed(r: number, hz: number, settle: number) {
    const fs = this.fs;
    const radius = Math.exp(-1 / (settle * fs));
    this.c1[r] = 2 * radius * Math.cos((TWO_PI * hz) / fs);
    this.c2[r] = radius * radius;
    this.feed[r] = 2 / (settle * fs);
  }

  start(note: number, clock: number) {
    this.begin(note, clock);
  }

  push() {
    for (let r = 0; r < this.reeds; r++) {
      this.y1[r] = PUSH;
      this.y2[r] = PUSH;
    }
  }

  render(left: Float32Array, right: Float32Array, start: number, end: number) {
    const { c1, c2, feed, level, y1, y2 } = this;
    const swell = this.mods.level;
    for (let i = start; i < end; i++) {
      // The LFO is the swell: bellows or a hand moving the pressure.
      const pressure = this.breath.process() * (1 + swell * this.modulate());
      const drive = this.drive * pressure;
      // Air through the slot follows the opening and √pressure (Bernoulli).
      let open = 0;
      for (let r = 0; r < this.reeds; r++) {
        const x1 = y1[r];
        const x =
          c1[r] * x1 -
          c2[r] * y2[r] +
          feed[r] * drive * (1 - 4 * x1 * x1) * (x1 - y2[r]);
        y2[r] = x1;
        y1[r] = x;
        open +=
          level[r] *
          (CLEARANCE +
            opening(x - this.slot) +
            (1 - this.asymmetry) * opening(-x - this.slot));
      }
      const flow = open * Math.sqrt(pressure > 0 ? pressure : 0);
      let out = RADIATION_GAIN * (flow - this.flow);
      this.flow = flow;
      out +=
        NOISE_LEVEL *
        this.noiseGain *
        flow *
        this.noiseFilter.process(this.noise.next());

      this.emit(this.dc.process(out), this.outputScale, i, left, right);
    }
    this.endBlock(end - start);
  }
}

// Harmonium and harmonica: free reeds, each a tongue swinging through a slot.
// A reed is a self-oscillating resonator (van der Pol) tuned to the note and
// fed by the pressure; the air it lets past is a pulse each swing, and the
// sound is that flow's slope, so harder blowing swings the reed further out
// of the slot and brightens it. A key can sound two reeds, the second a few
// cents sharp. The LFO is a shared swell (bellows or hand tremolo): one
// free-running cycle moves the pressure of every voice.
export class ReedInstrument extends Instrument {
  readonly patch: ReedPatch;
  // Replaced by calibration tools; otherwise fixed at construction.
  tuning: KeyTable;
  private readonly voices: ReedVoice[] = [];
  private readonly byNote = new Int16Array(128).fill(-1);
  private pressure = 1;
  private celeste = 1;
  private noiseLevel = 1;
  private slot = SLOT;
  private envelope: AdsrStages = {
    attack: 0.05,
    decay: 0.1,
    sustain: 0.9,
    release: 0.08,
  };

  constructor(
    patch: ReedPatch,
    fs: number,
    overrides?: Record<string, number>,
  ) {
    super(patch, fs, overrides, {
      pitch: "output",
      level: "model",
      free: true,
    });
    this.patch = patch;
    this.tuning = pickTuning(patch.tuningCents, fs);
    for (let v = 0; v < patch.polyphony + 2; v++)
      this.voices.push(new ReedVoice(fs, this.mods, 3000 + v * 97));
    this.applyParams();
  }

  override applyParams() {
    super.applyParams();
    const p = this.params;
    this.pressure = p.get("exciter.pressure");
    this.noiseLevel = p.get("exciter.noise");
    this.celeste = p.get("resonator.detune");
    this.slot = SLOT + SLOT_RANGE * p.get("resonator.brightness");
    this.envelope = p.envelope("envelope");
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      voice.slot = this.slot;
      voice.noiseGain = this.noiseLevel;
      voice.breath.setRelease(this.envelope.release);
      if (voice.busy) this.tune(voice, voice.note);
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
      this.blow(voice, velocity);
      return;
    }
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
    this.tune(voice, n);
    voice.onset(n, this.clock);
    voice.push();
    const [low, high] = this.patch.range;
    panGains(
      this.patch.pan.center +
        this.patch.pan.spread * ((2 * (n - low)) / (high - low) - 1),
      voice.gains,
    );
    this.blow(voice, velocity);
  }

  noteOff(note: number) {
    const n = foldNote(note, this.patch.range[0], this.patch.range[1]);
    const index = this.byNote[n];
    if (index < 0) return;
    const voice = this.voices[index];
    if (voice.holds === 0) return;
    voice.holds--;
    if (voice.holds > 0) return;
    this.stopBlowing(voice);
  }

  allNotesOff() {
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.busy && voice.state !== STOLEN) {
        voice.holds = 0;
        this.stopBlowing(voice);
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

  private tune(voice: ReedVoice, n: number) {
    const patch = this.patch;
    const f0 = midiToHz(n) * 2 ** (keyTable(this.tuning, n) / 1200);
    const settle = keyTable(patch.settle, n);
    voice.reeds = Math.min(MAX_REEDS, patch.reeds.length);
    for (let r = 0; r < voice.reeds; r++) {
      const [cents, level] = patch.reeds[r];
      voice.tuneReed(r, f0 * 2 ** ((cents * this.celeste) / 1200), settle);
      voice.level[r] = level;
    }
    voice.asymmetry = patch.asymmetry;
    voice.outputScale = (C4_HZ / f0) ** LEVEL_TILT;
  }

  private blow(voice: ReedVoice, velocity: number) {
    const [low, high] = this.patch.pressure;
    voice.drive =
      (lerp(low, high, velocity) * this.pressure) /
      Math.max(0.05, this.envelope.sustain);
    voice.breath.setStages(this.envelope);
    voice.breath.noteOn();
    voice.shape.noteOn();
  }

  private stopBlowing(voice: ReedVoice) {
    voice.state = RELEASED;
    voice.breath.noteOff();
    voice.shape.noteOff();
  }
}
