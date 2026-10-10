import { foldNote, keyTable, lerp, midiToHz, panGains } from "../dsp/math";
import { ModalBank } from "../dsp/modal";
import { Instrument } from "../engine/Instrument";
import type { ModuleSettings } from "../engine/Modules";
import {
  ACTIVE,
  IDLE,
  STOLEN,
  RELEASED,
  Voice,
  pickVictim,
} from "../engine/Voice";
import type { BarPatch } from "../patches/types";
import { stick } from "./exciters";

const MAX_MODES = 8;
// A hard hit stays on for less time than a soft one at the same hardness.
const VELOCITY_CONTACT = 0.3;

class BarVoice extends Voice {
  readonly modes: ModalBank;
  readonly excitation: Float32Array;
  excitationLength = 0;
  excitationPos = 0;

  constructor(fs: number, mods: ModuleSettings, longestContact: number) {
    super(fs, mods);
    this.modes = new ModalBank(MAX_MODES, fs);
    this.excitation = new Float32Array(Math.ceil(longestContact * fs) + 1);
  }

  start(note: number, clock: number) {
    this.begin(note, clock);
  }

  reset() {
    this.modes.clear();
    this.clearModules();
    this.excitationLength = 0;
    this.excitationPos = 0;
  }

  render(left: Float32Array, right: Float32Array, start: number, end: number) {
    const { modes, excitation } = this;
    for (let i = start; i < end; i++) {
      const e =
        this.excitationPos < this.excitationLength
          ? excitation[this.excitationPos++]
          : 0;
      this.emit(modes.process(e), 1, i, left, right);
    }
    this.endBlock(end - start);
  }
}

// Xylophone, steel pan and kalimba: each key a bank of modes at the patch's
// ratios to the note (a bar's, a pan dome's, a tine's), struck by a mallet or
// plucked by a thumb. The strike is a half-sine pulse; the shorter it is (a
// harder mallet, a harder hit), the higher the modes it reaches. Tuning is
// exact, since each mode is a resonator at its own frequency. There are no
// dampers: a note rings until it fades, and striking it again while it rings
// adds to what is already sounding.
export class BarInstrument extends Instrument {
  readonly patch: BarPatch;
  private readonly voices: BarVoice[] = [];
  private readonly byNote = new Int16Array(128).fill(-1);
  private hardness = 0.5;
  private strength = 0.8;
  private decay = 1;
  private brightness = 0;

  constructor(patch: BarPatch, fs: number, overrides?: Record<string, number>) {
    super(patch, fs, overrides);
    this.patch = patch;
    const longest = (patch.contact[0] / 1000) * (1 + VELOCITY_CONTACT);
    for (let v = 0; v < patch.polyphony + 2; v++)
      this.voices.push(new BarVoice(fs, this.mods, longest));
    this.applyParams();
  }

  override applyParams() {
    super.applyParams();
    const p = this.params;
    this.hardness = p.get("exciter.hardness");
    this.strength = p.get("exciter.strength");
    this.decay = p.get("resonator.decay");
    this.brightness = p.get("resonator.brightness");
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
      voice.quietSamples = 0;
      this.strike(voice, velocity);
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
    const [low, high] = this.patch.range;
    panGains(
      this.patch.pan.center +
        this.patch.pan.spread * ((2 * (n - low)) / (high - low) - 1),
      voice.gains,
    );
    this.strike(voice, velocity);
  }

  // Nothing damps the note; it rings on, under the master ADSR's release.
  noteOff(note: number) {
    const n = foldNote(note, this.patch.range[0], this.patch.range[1]);
    const index = this.byNote[n];
    if (index < 0) return;
    const voice = this.voices[index];
    if (voice.holds === 0) return;
    voice.holds--;
    if (voice.holds > 0) return;
    voice.state = RELEASED;
    voice.shape.noteOff();
  }

  allNotesOff() {
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      if (voice.busy && voice.state !== STOLEN) {
        voice.holds = 0;
        voice.state = RELEASED;
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

  // Sets the note's modes: each at its ratio, its level tilted by the
  // Brightness param (±6 dB an octave of ratio), and its T60 scaled for the
  // key. Modes above 0.45·fs are left silent by the bank.
  private tune(voice: BarVoice, n: number) {
    const { modes, decay } = this.patch;
    const f0 = midiToHz(n);
    const scale = keyTable(decay, n) * this.decay;
    const count = Math.min(MAX_MODES, modes.length);
    voice.modes.count = count;
    for (let m = 0; m < count; m++) {
      const [ratio, level, t60] = modes[m];
      voice.modes.setMode(
        m,
        f0 * ratio,
        t60 * scale,
        level * ratio ** this.brightness,
      );
    }
  }

  private strike(voice: BarVoice, velocity: number) {
    const [soft, hard] = this.patch.contact;
    const contact =
      (lerp(soft, hard, this.hardness) / 1000) *
      (1 + VELOCITY_CONTACT * (0.5 - velocity));
    const gain = velocity ** (1.5 * this.strength);
    voice.excitationLength = stick(voice.excitation, contact, gain, this.fs);
    voice.excitationPos = 0;
    voice.retrigger();
    voice.shape.noteOn();
  }
}
