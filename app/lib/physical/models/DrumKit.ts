import { OnePoleHighpass } from "../dsp/filters";
import { Follower, Noise } from "../dsp/generators";
import { lerp, panGains } from "../dsp/math";
import { ModalBank } from "../dsp/modal";
import { Svf } from "../dsp/Svf";
import { Instrument } from "../engine/Instrument";
import { RELEASED, Voice } from "../engine/Voice";
import type { DrumPieceId } from "../messages";
import type { DrumBrush, DrumKitPatch, DrumPieceSpec } from "../patches/types";
import { stick, velocityGain } from "./exciters";

// Every piece in a fixed order: it sets each voice's noise seed and the order
// voices sum in, so a kit sounds the same whichever pieces it defines.
const PIECE_ORDER: readonly DrumPieceId[] = [
  "kick",
  "snare",
  "closedHat",
  "openHat",
  "clap",
  "lowTom",
  "highTom",
  "cowbell",
  "crash",
  "na",
  "ta",
  "tin",
  "tun",
  "te",
  "ti",
  "ge",
  "ke",
  "ka",
  "dha",
  "dhin",
  "ride",
  "sweep",
  "stick",
  "bell",
  "tambourine",
];

// The pieces a kit can play, in a stable order.
export const kitPieces = (patch: DrumKitPatch) =>
  PIECE_ORDER.filter((piece) => patch.pieces[piece]);

type VoiceSpec = Exclude<DrumPieceSpec, { model: "combo" }>;

// Ideal circular membrane: (m, n) modes (0,1) (1,1) (2,1) (0,2) (3,1) (1,2)
// (4,1) (2,2) (0,3) (5,1) as ratios of the fundamental, with their m index.
const MEMBRANE_RATIOS = [
  1.0, 1.593, 2.136, 2.295, 2.653, 2.917, 3.155, 3.5, 3.598, 3.647,
];
const MEMBRANE_M = [0, 1, 2, 0, 3, 1, 4, 2, 0, 5];
const PITCH_UPDATE = 32;
const CHOKE_T60 = 0.03;
const LN_1000 = 6.907755278982137;
// A brush's bristles land within about a millisecond, and push the head with
// a fraction of a stick's weight.
const BRUSH_RISE = 0.0015;
const BRUSH_PUSH = 0.35;

class DrumVoice extends Voice {
  readonly spec: VoiceSpec;
  readonly bank: ModalBank;
  readonly pulse: Float32Array;
  readonly noise: Noise;
  readonly gains = new Float64Array(2);
  private readonly baseFreq: Float64Array;
  private readonly baseT60: Float64Array;
  private readonly weights: Float64Array;
  private readonly clickFilter = new OnePoleHighpass();
  private readonly noiseFilter = new OnePoleHighpass();
  private readonly wiresFilter = new OnePoleHighpass();
  private readonly hissFilter = new OnePoleHighpass();
  private readonly follower: Follower;
  private readonly bandpass = new Svf("bandpass");
  private readonly bursts: Float64Array;
  private pulseLength = 0;
  private pulsePos = 0;
  private elapsed = 0;
  private drop = 0;
  private dropTau = 1;
  private tuneRatio = 1;
  private decayScale = 1;
  private clickRemaining = 0;
  private clickLength = 1;
  private clickLevel = 0;
  private noiseEnv = 0;
  private noiseCoef = 0;
  private noiseLevel = 0;
  private wiresLevel = 0;
  private hitLevel = 1;
  private clapLevel = 0;
  private burstSamples = 1;
  private tailStart = 0;
  private tailCoef = 0;
  private swell = 0;
  private brushPos = 0;
  private brushLength = 0;
  private brushRise = 1;
  private brushEnv = 0;
  private brushCoef = 0;
  private brushScale = 0;
  private hissLevel = 0;

  constructor(spec: VoiceSpec, fs: number, seed: number) {
    super(fs);
    this.spec = spec;
    this.noise = new Noise(seed);
    this.pulse = new Float32Array(Math.ceil(0.006 * fs) + 2);
    this.follower = new Follower(0.001, 0.12, fs);

    let count = 0;
    if (spec.model === "membrane") count = spec.ratios + (spec.shell ? 1 : 0);
    else if (spec.model === "loaded") count = spec.partials.length;
    else if (spec.model === "metal") {
      count =
        spec.modes.kind === "seeded"
          ? spec.modes.count
          : spec.modes.freqs.length;
    }
    this.bank = new ModalBank(Math.max(1, count), fs);
    this.bank.count = count;
    this.baseFreq = new Float64Array(count);
    this.baseT60 = new Float64Array(count);
    this.weights = new Float64Array(count);

    if (spec.model === "membrane") {
      for (let i = 0; i < spec.ratios; i++) {
        this.baseFreq[i] = spec.f0 * MEMBRANE_RATIOS[i];
        this.baseT60[i] = spec.t60[Math.min(i, spec.t60.length - 1)];
      }
      if (spec.shell) {
        const [freq, t60, amp] = spec.shell;
        this.baseFreq[spec.ratios] = freq;
        this.baseT60[spec.ratios] = t60;
        this.weights[spec.ratios] = amp;
      }
      if (spec.click) this.clickFilter.setCutoff(spec.click.highpass, fs);
      if (spec.wires) this.wiresFilter.setCutoff(spec.wires.highpass, fs);
    } else if (spec.model === "loaded") {
      spec.partials.forEach(([ratio, t60, amp], i) => {
        this.baseFreq[i] = spec.f0 * ratio;
        this.baseT60[i] = t60;
        this.weights[i] = amp;
      });
      if (spec.click) this.clickFilter.setCutoff(spec.click.highpass, fs);
    } else if (spec.model === "metal") {
      const modes = spec.modes;
      if (modes.kind === "seeded") {
        // Log-uniform modes from a fixed seed, T60_i = T60·(f_lo/f_i)^0.3,
        // amp_i ∝ 1/√(i+1) with ±30% jitter.
        const table = new Noise(modes.seed);
        for (let i = 0; i < modes.count; i++) {
          const u = 0.5 * (table.next() + 1);
          const freq = modes.low * (modes.high / modes.low) ** u;
          this.baseFreq[i] = freq;
          this.baseT60[i] = spec.t60 * (modes.low / freq) ** 0.3;
          this.weights[i] = (1 / Math.sqrt(i + 1)) * (1 + 0.3 * table.next());
        }
      } else {
        for (let i = 0; i < modes.freqs.length; i++) {
          this.baseFreq[i] = modes.freqs[i];
          this.baseT60[i] = spec.t60;
          this.weights[i] = modes.amps[i];
        }
      }
      if (spec.noise) this.noiseFilter.setCutoff(spec.noise.highpass, fs);
    }
    if ((spec.model === "membrane" || spec.model === "metal") && spec.brush) {
      this.hissFilter.setCutoff(spec.brush.highpass, fs);
    }

    this.bursts = new Float64Array(
      spec.model === "noise" ? spec.bursts.length : 0,
    );
    if (spec.model === "noise") {
      const jitter = new Noise(seed + 17);
      for (let i = 0; i < spec.bursts.length; i++) {
        const ms = spec.bursts[i] + (i === 0 ? 0 : 2 * jitter.next());
        this.bursts[i] = Math.max(0, (ms / 1000) * fs);
      }
      this.burstSamples = (spec.burstLength / 1000) * fs;
      this.tailStart = (spec.tailStart / 1000) * fs;
      this.tailCoef = Math.exp(-LN_1000 / ((spec.tailDecay / 1000) * fs));
      if (spec.swell) this.swell = this.tailStart;
      this.bandpass.set(spec.bandpass[0], spec.bandpass[1], fs);
    }
  }

  reset() {
    this.bank.clear();
    this.pulsePos = this.pulseLength = 0;
    this.brushPos = this.brushLength = 0;
    this.clickRemaining = 0;
    this.noiseEnv = 0;
    this.clapLevel = 0;
    this.follower.clear();
    this.bandpass.clear();
  }

  // position blends center strikes (m = 0 modes only) toward edge strikes
  // (all modes, 1/(1 + 0.25·i)).
  configure(tune: number, decay: number, position: number) {
    const spec = this.spec;
    this.tuneRatio = 2 ** (tune / 12);
    this.decayScale = decay;
    if (spec.model === "membrane") {
      for (let i = 0; i < spec.ratios; i++) {
        const center = MEMBRANE_M[i] === 0 ? 1 : 0.05;
        const edge = 1 / (1 + 0.25 * i);
        this.weights[i] = lerp(center, edge, position);
      }
    }
    for (let i = 0; i < this.bank.count; i++) {
      this.bank.setMode(i, this.baseFreq[i], this.baseT60[i], this.weights[i]);
    }
    this.bank.scaleDecay(decay);
    this.bank.scaleFrequencies(this.tuneRatio);
  }

  strike(
    velocity: number,
    hardness: number,
    strength: number,
    dropScale: number,
    click: number,
    wires: number,
    clock: number,
    gain: number,
  ) {
    const spec = this.spec;
    const fs = this.fs;
    this.begin(0, clock);
    this.state = RELEASED;
    this.shape.noteOn();
    this.hitLevel = spec.level * velocityGain(velocity, strength) * gain;
    this.elapsed = 0;
    if (spec.model !== "noise") {
      const [soft, hard] = spec.stick;
      const force = hardness * velocity;
      const seconds = lerp(soft, hard, force) / 1000;
      const brush = spec.model === "loaded" ? undefined : spec.brush;
      this.pulseLength = stick(this.pulse, seconds, brush ? BRUSH_PUSH : 1, fs);
      this.pulsePos = 0;
      this.bank.scaleDecay(this.decayScale);
      if (brush) this.startBrush(brush, force);
    }
    if (spec.model === "membrane") {
      this.drop = spec.pitchDrop * velocity * dropScale;
      this.dropTau = (spec.pitchTau / 1000) * fs;
      if (spec.click) {
        this.clickLength = Math.max(1, (spec.click.length / 1000) * fs);
        this.clickRemaining = this.clickLength;
        this.clickLevel = spec.click.level * click;
      }
      this.wiresLevel = spec.wires ? spec.wires.level * wires : 0;
    } else if (spec.model === "loaded") {
      this.drop = (spec.pitchDrop ?? 0) * velocity * dropScale;
      this.dropTau = ((spec.pitchTau ?? 50) / 1000) * fs;
      if (spec.click) {
        this.clickLength = Math.max(1, (spec.click.length / 1000) * fs);
        this.clickRemaining = this.clickLength;
        this.clickLevel = spec.click.level * click;
      }
      this.wiresLevel = 0;
    } else if (spec.model === "metal" && spec.noise) {
      this.noiseEnv = 1;
      this.noiseLevel = spec.noise.level;
      this.noiseCoef = Math.exp(
        -LN_1000 / (spec.noise.decay * this.decayScale * fs),
      );
    } else if (spec.model === "noise") {
      this.clapLevel = 1;
    }
  }

  // Harder strokes land the bristles closer together. The burst is scaled to
  // unit energy (its envelope's square integrates to 3/8 of the rise plus
  // half the decay's time constant), so its length changes the hiss, not how
  // hard the modes are driven.
  private startBrush(brush: DrumBrush, force: number) {
    const fs = this.fs;
    const length = (brush.length / 1000) * lerp(1.3, 0.75, force) * fs;
    this.brushRise = Math.max(1, Math.round(BRUSH_RISE * fs));
    this.brushLength = Math.max(this.brushRise + 1, Math.round(length));
    const tau = (this.brushLength - this.brushRise) / LN_1000;
    this.brushCoef = Math.exp(-1 / tau);
    this.brushScale = 1 / Math.sqrt(0.375 * this.brushRise + 0.5 * tau);
    this.brushEnv = 1;
    this.brushPos = 0;
    this.hissLevel = brush.level;
  }

  choke() {
    if (!this.busy) return;
    let longest = 0;
    for (let i = 0; i < this.bank.count; i++)
      longest = Math.max(longest, this.baseT60[i]);
    if (longest > 0) this.bank.scaleDecay(CHOKE_T60 / longest);
    this.noiseCoef = Math.exp(-LN_1000 / (CHOKE_T60 * this.fs));
  }

  render(left: Float32Array, right: Float32Array, start: number, end: number) {
    const bank = this.bank;
    const gains = this.gains;
    const membrane =
      this.spec.model === "membrane" || this.spec.model === "loaded";
    const clap = this.spec.model === "noise";
    let peak = 0;
    for (let i = start; i < end; i++) {
      let x = 0;
      if (this.pulsePos < this.pulseLength) x = this.pulse[this.pulsePos++];
      const bristles = this.brushPos < this.brushLength ? this.bristle() : 0;
      x += bristles * this.brushScale;
      if (membrane && this.drop > 0 && this.elapsed % PITCH_UPDATE === 0) {
        // Tension modulation: pitch starts high and settles.
        bank.scaleFrequencies(
          this.tuneRatio *
            (1 + this.drop * Math.exp(-this.elapsed / this.dropTau)),
        );
      }
      let y = bank.count > 0 ? bank.process(x) : 0;
      if (bristles !== 0)
        y += this.hissFilter.process(bristles) * this.hissLevel;

      if (this.clickRemaining > 0) {
        y +=
          this.clickFilter.process(this.noise.next()) *
          this.clickLevel *
          (this.clickRemaining / this.clickLength);
        this.clickRemaining--;
      }
      if (this.wiresLevel > 0) {
        const env = this.follower.process(y);
        y +=
          this.wiresFilter.process(this.noise.next()) * this.wiresLevel * env;
      }
      if (this.noiseEnv > 1e-5) {
        y +=
          this.noiseFilter.process(this.noise.next()) *
          this.noiseEnv *
          this.noiseLevel;
        this.noiseEnv *= this.noiseCoef;
      }
      if (clap && this.clapLevel > 0) y += this.clapSample();

      this.elapsed++;
      y *= this.hitLevel * this.shape.process();
      left[i] += y * gains[0];
      right[i] += y * gains[1];
      const level = y < 0 ? -y : y;
      if (level > peak) peak = level;
    }
    this.track(peak, end - start);
  }

  private bristle() {
    const n = this.brushPos++;
    const env =
      n < this.brushRise
        ? 0.5 - 0.5 * Math.cos((Math.PI * n) / this.brushRise)
        : (this.brushEnv *= this.brushCoef);
    return this.noise.next() * env;
  }

  // Short noise bursts, then a decaying tail (or one swelling in to its
  // start), all through a bandpass.
  private clapSample() {
    const t = this.elapsed;
    let env = 0;
    for (let b = 0; b < this.bursts.length; b++) {
      const since = t - this.bursts[b];
      if (since >= 0 && since < this.burstSamples) {
        env += Math.exp((-3 * since) / this.burstSamples);
      }
    }
    if (t >= this.tailStart) {
      env += 0.6 * this.tailCoef ** (t - this.tailStart);
    } else if (this.swell > 0) {
      env += 0.3 - 0.3 * Math.cos((Math.PI * t) / this.swell);
    }
    if (t > this.tailStart && env < 1e-5) this.clapLevel = 0;
    return this.bandpass.process(this.noise.next()) * env * 2;
  }
}

export class DrumKit extends Instrument {
  readonly patch: DrumKitPatch;
  private readonly voices: DrumVoice[] = [];
  private readonly byPiece = new Map<DrumPieceId, DrumVoice>();
  private readonly filterL = new Svf("lowpass");
  private readonly filterR = new Svf("lowpass");
  private hardness = 0.6;
  private strength = 1;
  private dropScale = 1;
  private click = 1;
  private wires = 1;
  private filtered = false;

  constructor(
    patch: DrumKitPatch,
    fs: number,
    overrides?: Record<string, number>,
  ) {
    super(patch, fs, overrides);
    this.patch = patch;
    for (const piece of kitPieces(patch)) {
      const spec = patch.pieces[piece];
      if (!spec || spec.model === "combo") continue;
      const seed = 9000 + PIECE_ORDER.indexOf(piece) * 101;
      const voice = new DrumVoice(spec, fs, seed);
      this.voices.push(voice);
      this.byPiece.set(piece, voice);
    }
    this.applyParams();
  }

  override applyParams() {
    super.applyParams();
    const p = this.params;
    this.hardness = p.get("exciter.hardness");
    this.strength = p.get("exciter.strength");
    this.dropScale = p.get("resonator.pitchDrop");
    this.click = p.get("exciter.click");
    this.wires = p.get("resonator.wires");
    const width = p.get("body.width");
    const cutoff = p.get("filter.cutoff");
    const q = p.get("filter.resonance");
    this.filterL.set(cutoff, q, this.fs);
    this.filterR.set(cutoff, q, this.fs);
    this.filtered = cutoff < 0.45 * this.fs - 1;
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      voice.configure(
        p.get("resonator.tune"),
        p.get("resonator.decay"),
        p.get("exciter.position"),
      );
      panGains(voice.spec.pan * width, voice.gains);
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

  noteOn() {}

  noteOff() {}

  override hit(piece: DrumPieceId, velocity: number) {
    const spec = this.patch.pieces[piece];
    if (spec?.model === "combo") {
      for (const part of spec.pieces) this.strike(part, velocity, spec.level);
    } else {
      this.strike(piece, velocity, 1);
    }
  }

  private strike(piece: DrumPieceId, velocity: number, gain: number) {
    const voice = this.byPiece.get(piece);
    if (!voice) return;
    voice.strike(
      velocity,
      this.hardness,
      this.strength,
      this.dropScale,
      this.click,
      this.wires,
      this.clock,
      gain,
    );
    const spec = voice.spec;
    if (spec.model === "metal" && spec.chokes) {
      for (let c = 0; c < spec.chokes.length; c++) {
        this.byPiece.get(spec.chokes[c])?.choke();
      }
    }
  }

  allNotesOff() {}

  panic() {
    for (let i = 0; i < this.voices.length; i++) this.voices[i].free();
  }

  override finish(
    n: number,
    masterL: Float32Array,
    masterR: Float32Array,
    reverbIn: Float32Array,
  ) {
    if (this.filtered) {
      for (let i = 0; i < n; i++) {
        this.left[i] = this.filterL.process(this.left[i]);
        this.right[i] = this.filterR.process(this.right[i]);
      }
    }
    super.finish(n, masterL, masterR, reverbIn);
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
      if (voice.busy && voice.finished) voice.free();
    }
  }
}

// Metronome click: two modes around 1.9/2.9 kHz (2.3/3.4 kHz accented),
// T60 40 ms, on a dry utility path.
export class Woodblock {
  private readonly fs: number;
  private readonly bank: ModalBank;
  private readonly pulse: Float32Array;
  private pulseLength = 0;
  private pulsePos = 0;
  private remaining = 0;
  private level = 0;

  constructor(fs: number) {
    this.fs = fs;
    this.bank = new ModalBank(2, fs);
    this.bank.count = 2;
    this.pulse = new Float32Array(Math.ceil(0.001 * fs) + 2);
  }

  get active() {
    return this.remaining > 0;
  }

  hit(accent: boolean) {
    this.bank.setMode(0, accent ? 2300 : 1900, 0.04, 1);
    this.bank.setMode(1, accent ? 3400 : 2900, 0.04, 0.6);
    this.level = accent ? 0.5 : 0.3;
    this.pulseLength = stick(this.pulse, 0.0003, 1, this.fs);
    this.pulsePos = 0;
    this.remaining = Math.round(0.25 * this.fs);
  }

  render(left: Float32Array, right: Float32Array, start: number, end: number) {
    if (this.remaining <= 0) return;
    for (let i = start; i < end; i++) {
      let x = 0;
      if (this.pulsePos < this.pulseLength) x = this.pulse[this.pulsePos++];
      const y = this.bank.process(x) * this.level;
      left[i] += y;
      right[i] += y;
    }
    this.remaining -= end - start;
    if (this.remaining <= 0) this.bank.clear();
  }
}
