import { Adsr } from "../dsp/Adsr";
import { Oscillator } from "../dsp/generators";
import { foldNote, midiToHz, panGains } from "../dsp/math";
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
import type { OscillatorPatch } from "../patches/types";

class OscillatorVoice extends Voice {
  readonly oscillator: Oscillator;
  readonly osc2: Oscillator;
  // Opens at full while the key is down; decay and sustain come from the
  // master ADSR.
  readonly gate: Adsr;
  readonly filter = new Svf("lowpass");
  readonly gains = new Float64Array(2);
  level = 0;
  level2 = 0;

  constructor(fs: number) {
    super(fs);
    this.oscillator = new Oscillator(fs);
    this.osc2 = new Oscillator(fs);
    this.gate = new Adsr(fs);
  }

  reset() {
    this.oscillator.reset();
    this.osc2.reset();
    this.gate.reset();
    this.filter.clear();
  }

  start(note: number, clock: number) {
    this.begin(note, clock);
  }

  render(left: Float32Array, right: Float32Array, start: number, end: number) {
    const gains = this.gains;
    let peak = 0;
    for (let i = start; i < end; i++) {
      let y =
        this.filter.process(
          this.level *
            (this.oscillator.process() + this.level2 * this.osc2.process()),
        ) *
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
  }
}

// One or two polyphonic oscillators (sine, triangle, square or saw) summed
// through a lowpass: a plain source for the master ADSR, LFO and FX to shape.
export class OscillatorInstrument extends Instrument {
  readonly patch: OscillatorPatch;
  private readonly voices: OscillatorVoice[] = [];
  private readonly byNote = new Int16Array(128).fill(-1);

  constructor(
    patch: OscillatorPatch,
    fs: number,
    overrides?: Record<string, number>,
  ) {
    super(patch, fs, overrides);
    this.patch = patch;
    for (let i = 0; i < patch.polyphony + 2; i++) {
      this.voices.push(new OscillatorVoice(fs));
    }
    this.applyParams();
  }

  override applyParams() {
    super.applyParams();
    const p = this.params;
    const wave = Math.round(p.get("exciter.wave"));
    const wave2 = Math.round(p.get("exciter.wave2"));
    const level2 = wave2 > 0 ? p.get("exciter.level2") : 0;
    const phase = p.get("exciter.phase") / 360;
    const attack = p.get("envelope.attack");
    const release = p.get("envelope.release");
    const cutoff = p.get("filter.cutoff");
    const q = p.get("filter.resonance");
    const glide = 1 - Math.exp(-3 / (p.get("exciter.glide") * this.fs));
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      voice.oscillator.wave = wave;
      voice.oscillator.glide = glide;
      voice.osc2.wave = Math.max(0, wave2 - 1);
      voice.osc2.glide = glide;
      voice.osc2.phaseOffset = phase;
      voice.level2 = level2;
      voice.gate.set(attack, 0, 1, release, true);
      voice.filter.set(cutoff, q, this.fs);
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
      this.gateOn(voice, velocity);
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
    voice.oscillator.setFrequency(
      midiToHz(n),
      from >= 0 ? midiToHz(from) : undefined,
    );
    voice.osc2.setFrequency(
      midiToHz(n),
      from >= 0 ? midiToHz(from) : undefined,
    );
    panGains(this.patch.pan.center, voice.gains);
    this.gateOn(voice, velocity);
  }

  noteOff(note: number) {
    const n = foldNote(note, this.patch.range[0], this.patch.range[1]);
    const index = this.byNote[n];
    if (index < 0) return;
    const voice = this.voices[index];
    if (voice.holds === 0) return;
    voice.holds--;
    if (voice.holds > 0) return;
    this.gateOff(voice);
  }

  allNotesOff() {
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.busy && voice.state !== STOLEN) {
        voice.holds = 0;
        this.gateOff(voice);
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

  private gateOn(voice: OscillatorVoice, velocity: number) {
    voice.level = velocity;
    voice.gate.noteOn();
    voice.shape.noteOn();
  }

  private gateOff(voice: OscillatorVoice) {
    voice.state = RELEASED;
    voice.gate.noteOff();
    voice.shape.noteOff();
  }
}
