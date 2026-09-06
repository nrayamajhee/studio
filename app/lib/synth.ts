import { noteToFrequency } from "../components/piano-roll/types";

export type ExciterMode = "thud" | "noise" | "click" | "drum" | "off";
export type LfoDestination = "pitch" | "filter" | "tremolo";

export interface SynthParams {
  name: string;
  exciterMode: ExciterMode;
  exciterVol: number;
  exciterFreq: number;
  exciterDecay: number;
  osc1Wave: OscillatorType;
  osc2Wave: OscillatorType | "off";
  detune: number;
  osc2Oct: number;
  filterType: BiquadFilterType;
  cutoff: number;
  envMod: number;
  keytrack: number;
  lfoDest: LfoDestination;
  lfoRate: number;
  lfoDepth: number;
  ksFeed: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  lowEq: number;
  drive: number;
  reverb: number;
  masterVol: number;
  octave: number;
}

export const SYNTH_PRESETS: Record<string, SynthParams> = {
  electric_guitar: {
    name: "Electric Guitar",
    exciterMode: "click",
    exciterVol: 0.55,
    exciterFreq: 2400,
    exciterDecay: 0.012,
    osc1Wave: "sawtooth",
    osc2Wave: "sawtooth",
    detune: 2.5,
    osc2Oct: 0,
    filterType: "lowpass",
    cutoff: 3200,
    envMod: 4000,
    keytrack: 0.3,
    lfoDest: "pitch",
    lfoRate: 5.5,
    lfoDepth: 0.4,
    ksFeed: 0.2,
    attack: 0.003,
    decay: 2.2,
    sustain: 0.15,
    release: 0.15,
    lowEq: 2.0,
    drive: 0.22,
    reverb: 0.25,
    masterVol: 0.72,
    octave: 0,
  },
  acoustic_guitar: {
    name: "Acoustic Guitar",
    exciterMode: "noise",
    exciterVol: 0.55,
    exciterFreq: 1800,
    exciterDecay: 0.015,
    osc1Wave: "sawtooth",
    osc2Wave: "triangle",
    detune: 2.0,
    osc2Oct: 0,
    filterType: "lowpass",
    cutoff: 2400,
    envMod: 3800,
    keytrack: 0.25,
    lfoDest: "pitch",
    lfoRate: 4.8,
    lfoDepth: 0.25,
    ksFeed: 0.38,
    attack: 0.002,
    decay: 2.1,
    sustain: 0.01,
    release: 0.12,
    lowEq: 1.0,
    drive: 0.04,
    reverb: 0.22,
    masterVol: 0.72,
    octave: 0,
  },
  classical_guitar: {
    name: "Classical Guitar",
    exciterMode: "thud",
    exciterVol: 0.45,
    exciterFreq: 1200,
    exciterDecay: 0.02,
    osc1Wave: "triangle",
    osc2Wave: "sine",
    detune: 1.2,
    osc2Oct: 0,
    filterType: "lowpass",
    cutoff: 1800,
    envMod: 2600,
    keytrack: 0.2,
    lfoDest: "pitch",
    lfoRate: 4.2,
    lfoDepth: 0.15,
    ksFeed: 0.42,
    attack: 0.004,
    decay: 2.6,
    sustain: 0.01,
    release: 0.14,
    lowEq: 1.5,
    drive: 0.0,
    reverb: 0.28,
    masterVol: 0.72,
    octave: 0,
  },
  ukelele: {
    name: "Ukulele",
    exciterMode: "noise",
    exciterVol: 0.6,
    exciterFreq: 2800,
    exciterDecay: 0.008,
    osc1Wave: "triangle",
    osc2Wave: "sawtooth",
    detune: 1.8,
    osc2Oct: 12,
    filterType: "lowpass",
    cutoff: 3600,
    envMod: 4200,
    keytrack: 0.35,
    lfoDest: "pitch",
    lfoRate: 6.0,
    lfoDepth: 0.2,
    ksFeed: 0.28,
    attack: 0.002,
    decay: 1.1,
    sustain: 0.01,
    release: 0.08,
    lowEq: -1.0,
    drive: 0.02,
    reverb: 0.18,
    masterVol: 0.72,
    octave: 1,
  },
  base_guitar: {
    name: "Bass Guitar",
    exciterMode: "click",
    exciterVol: 0.6,
    exciterFreq: 950,
    exciterDecay: 0.025,
    osc1Wave: "sawtooth",
    osc2Wave: "sine",
    detune: 0.8,
    osc2Oct: -12,
    filterType: "lowpass",
    cutoff: 450,
    envMod: 2200,
    keytrack: 0.12,
    lfoDest: "filter",
    lfoRate: 0.5,
    lfoDepth: 0.0,
    ksFeed: 0.15,
    attack: 0.004,
    decay: 1.5,
    sustain: 0.18,
    release: 0.1,
    lowEq: 3.5,
    drive: 0.14,
    reverb: 0.08,
    masterVol: 0.75,
    octave: -1,
  },
  electronic_pino: {
    name: "Electronic Piano",
    exciterMode: "click",
    exciterVol: 0.4,
    exciterFreq: 3200,
    exciterDecay: 0.018,
    osc1Wave: "sine",
    osc2Wave: "triangle",
    detune: 2.5,
    osc2Oct: 0,
    filterType: "bandpass",
    cutoff: 1600,
    envMod: 2800,
    keytrack: 0.2,
    lfoDest: "tremolo",
    lfoRate: 4.5,
    lfoDepth: 12.0,
    ksFeed: 0.0,
    attack: 0.003,
    decay: 3.0,
    sustain: 0.08,
    release: 0.25,
    lowEq: 1.5,
    drive: 0.06,
    reverb: 0.3,
    masterVol: 0.72,
    octave: 0,
  },
  grand_piano: {
    name: "Grand Piano",
    exciterMode: "thud",
    exciterVol: 0.45,
    exciterFreq: 65,
    exciterDecay: 0.038,
    osc1Wave: "triangle",
    osc2Wave: "triangle",
    detune: 1.2,
    osc2Oct: 0,
    filterType: "lowpass",
    cutoff: 900,
    envMod: 3200,
    keytrack: -0.18,
    lfoDest: "pitch",
    lfoRate: 1.5,
    lfoDepth: 0.0,
    ksFeed: 0.0,
    attack: 0.003,
    decay: 3.4,
    sustain: 0.02,
    release: 0.15,
    lowEq: 2.0,
    drive: 0.0,
    reverb: 0.22,
    masterVol: 0.72,
    octave: 0,
  },
  drum_set: {
    name: "Drum Set",
    exciterMode: "drum",
    exciterVol: 0.85,
    exciterFreq: 220,
    exciterDecay: 0.065,
    osc1Wave: "sine",
    osc2Wave: "square",
    detune: 5.0,
    osc2Oct: -12,
    filterType: "lowpass",
    cutoff: 650,
    envMod: 3800,
    keytrack: -0.45,
    lfoDest: "pitch",
    lfoRate: 10.0,
    lfoDepth: 0.0,
    ksFeed: 0.0,
    attack: 0.001,
    decay: 0.45,
    sustain: 0.0,
    release: 0.05,
    lowEq: 4.0,
    drive: 0.15,
    reverb: 0.15,
    masterVol: 0.75,
    octave: -2,
  },
  drum_808: {
    name: "808 Drum",
    exciterMode: "drum",
    exciterVol: 0.9,
    exciterFreq: 110,
    exciterDecay: 0.04,
    osc1Wave: "sine",
    osc2Wave: "sine",
    detune: 0.0,
    osc2Oct: -12,
    filterType: "lowpass",
    cutoff: 350,
    envMod: 1800,
    keytrack: -0.8,
    lfoDest: "pitch",
    lfoRate: 1.0,
    lfoDepth: 0.0,
    ksFeed: 0.0,
    attack: 0.002,
    decay: 1.2,
    sustain: 0.0,
    release: 0.15,
    lowEq: 6.0,
    drive: 0.22,
    reverb: 0.05,
    masterVol: 0.8,
    octave: -2,
  },
  flute: {
    name: "Flute",
    exciterMode: "noise",
    exciterVol: 0.12,
    exciterFreq: 1100,
    exciterDecay: 0.05,
    osc1Wave: "sine",
    osc2Wave: "triangle",
    detune: 0.8,
    osc2Oct: 0,
    filterType: "lowpass",
    cutoff: 1400,
    envMod: 600,
    keytrack: 0.2,
    lfoDest: "pitch",
    lfoRate: 5.0,
    lfoDepth: 0.15,
    ksFeed: 0.0,
    attack: 0.045,
    decay: 2.2,
    sustain: 0.75,
    release: 0.18,
    lowEq: 1.0,
    drive: 0.0,
    reverb: 0.32,
    masterVol: 0.75,
    octave: 0,
  },
  saxophone: {
    name: "Saxophone",
    exciterMode: "click",
    exciterVol: 0.35,
    exciterFreq: 1400,
    exciterDecay: 0.02,
    osc1Wave: "sawtooth",
    osc2Wave: "triangle",
    detune: 2.0,
    osc2Oct: 0,
    filterType: "lowpass",
    cutoff: 1800,
    envMod: 1800,
    keytrack: 0.25,
    lfoDest: "pitch",
    lfoRate: 4.8,
    lfoDepth: 0.35,
    ksFeed: 0.0,
    attack: 0.025,
    decay: 2.2,
    sustain: 0.55,
    release: 0.16,
    lowEq: 1.8,
    drive: 0.08,
    reverb: 0.22,
    masterVol: 0.72,
    octave: 0,
  },
  trap_kit: {
    name: "Trap 808 & Hats",
    exciterMode: "drum",
    exciterVol: 0.95,
    exciterFreq: 140,
    exciterDecay: 0.05,
    osc1Wave: "sine",
    osc2Wave: "sawtooth",
    detune: 1.0,
    osc2Oct: -12,
    filterType: "lowpass",
    cutoff: 420,
    envMod: 2200,
    keytrack: -0.7,
    lfoDest: "pitch",
    lfoRate: 1.0,
    lfoDepth: 0.0,
    ksFeed: 0.0,
    attack: 0.001,
    decay: 1.6,
    sustain: 0.0,
    release: 0.12,
    lowEq: 7.0,
    drive: 0.28,
    reverb: 0.08,
    masterVol: 0.8,
    octave: -2,
  },
  electronic_drums: {
    name: "Electronic Drums",
    exciterMode: "drum",
    exciterVol: 0.85,
    exciterFreq: 320,
    exciterDecay: 0.05,
    osc1Wave: "square",
    osc2Wave: "sine",
    detune: 8.0,
    osc2Oct: -12,
    filterType: "bandpass",
    cutoff: 1200,
    envMod: 4200,
    keytrack: -0.3,
    lfoDest: "pitch",
    lfoRate: 8.0,
    lfoDepth: 0.0,
    ksFeed: 0.0,
    attack: 0.001,
    decay: 0.6,
    sustain: 0.0,
    release: 0.08,
    lowEq: 3.5,
    drive: 0.2,
    reverb: 0.25,
    masterVol: 0.75,
    octave: -2,
  },
  acoustic_percussion: {
    name: "Acoustic Percussion",
    exciterMode: "click",
    exciterVol: 0.9,
    exciterFreq: 2600,
    exciterDecay: 0.012,
    osc1Wave: "triangle",
    osc2Wave: "sine",
    detune: 3.0,
    osc2Oct: 12,
    filterType: "bandpass",
    cutoff: 2400,
    envMod: 3000,
    keytrack: 0.4,
    lfoDest: "pitch",
    lfoRate: 6.0,
    lfoDepth: 0.0,
    ksFeed: 0.25,
    attack: 0.001,
    decay: 0.35,
    sustain: 0.0,
    release: 0.05,
    lowEq: 1.0,
    drive: 0.05,
    reverb: 0.22,
    masterVol: 0.74,
    octave: 0,
  },
  vintage_synth: {
    name: "Vintage Poly Synth",
    exciterMode: "click",
    exciterVol: 0.3,
    exciterFreq: 1800,
    exciterDecay: 0.02,
    osc1Wave: "sawtooth",
    osc2Wave: "sawtooth",
    detune: 12.0,
    osc2Oct: 0,
    filterType: "lowpass",
    cutoff: 1800,
    envMod: 3500,
    keytrack: 0.35,
    lfoDest: "pitch",
    lfoRate: 4.5,
    lfoDepth: 1.2,
    ksFeed: 0.0,
    attack: 0.025,
    decay: 2.8,
    sustain: 0.4,
    release: 0.35,
    lowEq: 2.0,
    drive: 0.12,
    reverb: 0.32,
    masterVol: 0.7,
    octave: 0,
  },
  acid_bass: {
    name: "Acid 303 Bass",
    exciterMode: "click",
    exciterVol: 0.65,
    exciterFreq: 1200,
    exciterDecay: 0.015,
    osc1Wave: "sawtooth",
    osc2Wave: "square",
    detune: 1.5,
    osc2Oct: -12,
    filterType: "lowpass",
    cutoff: 550,
    envMod: 4800,
    keytrack: 0.2,
    lfoDest: "filter",
    lfoRate: 1.2,
    lfoDepth: 0.5,
    ksFeed: 0.0,
    attack: 0.002,
    decay: 0.85,
    sustain: 0.08,
    release: 0.08,
    lowEq: 4.5,
    drive: 0.32,
    reverb: 0.12,
    masterVol: 0.74,
    octave: -1,
  },
  rhodes_piano: {
    name: "Rhodes Electric Tines",
    exciterMode: "click",
    exciterVol: 0.45,
    exciterFreq: 3400,
    exciterDecay: 0.015,
    osc1Wave: "sine",
    osc2Wave: "triangle",
    detune: 1.5,
    osc2Oct: 12,
    filterType: "lowpass",
    cutoff: 2100,
    envMod: 2200,
    keytrack: 0.25,
    lfoDest: "tremolo",
    lfoRate: 4.2,
    lfoDepth: 10.0,
    ksFeed: 0.0,
    attack: 0.002,
    decay: 3.2,
    sustain: 0.12,
    release: 0.28,
    lowEq: 2.5,
    drive: 0.08,
    reverb: 0.28,
    masterVol: 0.72,
    octave: 0,
  },
  lofi_keys: {
    name: "Lo-Fi Wobbly Keys",
    exciterMode: "noise",
    exciterVol: 0.4,
    exciterFreq: 1600,
    exciterDecay: 0.03,
    osc1Wave: "triangle",
    osc2Wave: "sine",
    detune: 6.5,
    osc2Oct: 0,
    filterType: "bandpass",
    cutoff: 1400,
    envMod: 1600,
    keytrack: 0.15,
    lfoDest: "pitch",
    lfoRate: 2.2,
    lfoDepth: 3.8,
    ksFeed: 0.0,
    attack: 0.015,
    decay: 2.6,
    sustain: 0.18,
    release: 0.3,
    lowEq: 1.5,
    drive: 0.18,
    reverb: 0.38,
    masterVol: 0.7,
    octave: 0,
  },
  pluck_synth: {
    name: "Digital Pluck",
    exciterMode: "click",
    exciterVol: 0.8,
    exciterFreq: 3600,
    exciterDecay: 0.008,
    osc1Wave: "sawtooth",
    osc2Wave: "triangle",
    detune: 4.0,
    osc2Oct: 12,
    filterType: "lowpass",
    cutoff: 2800,
    envMod: 4500,
    keytrack: 0.4,
    lfoDest: "pitch",
    lfoRate: 6.0,
    lfoDepth: 0.2,
    ksFeed: 0.45,
    attack: 0.001,
    decay: 0.9,
    sustain: 0.01,
    release: 0.1,
    lowEq: 0.5,
    drive: 0.05,
    reverb: 0.25,
    masterVol: 0.72,
    octave: 0,
  },
  strings_ensemble: {
    name: "Strings Ensemble",
    exciterMode: "off",
    exciterVol: 0.0,
    exciterFreq: 1000,
    exciterDecay: 0.02,
    osc1Wave: "sawtooth",
    osc2Wave: "sawtooth",
    detune: 7.0,
    osc2Oct: 0,
    filterType: "lowpass",
    cutoff: 2600,
    envMod: 1800,
    keytrack: 0.3,
    lfoDest: "pitch",
    lfoRate: 5.0,
    lfoDepth: 2.0,
    ksFeed: 0.0,
    attack: 0.18,
    decay: 3.5,
    sustain: 0.65,
    release: 0.45,
    lowEq: 2.0,
    drive: 0.04,
    reverb: 0.45,
    masterVol: 0.68,
    octave: 0,
  },
  marimba: {
    name: "Marimba / Mallet",
    exciterMode: "thud",
    exciterVol: 0.7,
    exciterFreq: 800,
    exciterDecay: 0.02,
    osc1Wave: "sine",
    osc2Wave: "triangle",
    detune: 0.5,
    osc2Oct: 12,
    filterType: "bandpass",
    cutoff: 1900,
    envMod: 2800,
    keytrack: 0.35,
    lfoDest: "pitch",
    lfoRate: 1.0,
    lfoDepth: 0.0,
    ksFeed: 0.15,
    attack: 0.001,
    decay: 1.1,
    sustain: 0.01,
    release: 0.08,
    lowEq: 1.5,
    drive: 0.02,
    reverb: 0.26,
    masterVol: 0.74,
    octave: 0,
  },
  organ: {
    name: "Drawbar Organ",
    exciterMode: "click",
    exciterVol: 0.35,
    exciterFreq: 2800,
    exciterDecay: 0.01,
    osc1Wave: "sine",
    osc2Wave: "square",
    detune: 2.0,
    osc2Oct: 12,
    filterType: "lowpass",
    cutoff: 3500,
    envMod: 1200,
    keytrack: 0.2,
    lfoDest: "tremolo",
    lfoRate: 6.2,
    lfoDepth: 8.0,
    ksFeed: 0.0,
    attack: 0.004,
    decay: 3.0,
    sustain: 0.6,
    release: 0.15,
    lowEq: 2.5,
    drive: 0.16,
    reverb: 0.28,
    masterVol: 0.7,
    octave: 0,
  },
};

function createReverbImpulse(
  ctx: AudioContext,
  duration = 1.2,
  decay = 2.0,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  let sumSquares = 0;
  for (let i = 0; i < length; i++) {
    const factor = Math.exp(-i / (sampleRate * (decay / 10)));
    const lVal = (Math.random() * 2 - 1) * factor;
    const rVal = (Math.random() * 2 - 1) * factor;
    left[i] = lVal;
    right[i] = rVal;
    sumSquares += lVal * lVal + rVal * rVal;
  }

  const rms = Math.sqrt(sumSquares / (length * 2)) || 1;
  const targetRms = 0.08;
  const scale = targetRms / rms;
  for (let i = 0; i < length; i++) {
    left[i] *= scale;
    right[i] *= scale;
  }

  return impulse;
}

function makeDistortionCurve(amount = 0): Float32Array {
  const n_samples = 4096;
  const curve = new Float32Array(n_samples);
  if (amount <= 0.005) {
    for (let i = 0; i < n_samples; ++i) {
      curve[i] = (i * 2) / (n_samples - 1) - 1;
    }
    return curve;
  }

  const k = amount * 10;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / (n_samples - 1) - 1;
    curve[i] = Math.tanh(x * (1 + k)) * 0.9;
  }
  return curve;
}

class HybridVoice {
  private osc1: OscillatorNode;
  private osc2?: OscillatorNode;
  private lfo?: OscillatorNode;
  private filter: BiquadFilterNode;
  private ampGain: GainNode;
  private voiceMixer: GainNode;
  private ctx: AudioContext;
  private params: SynthParams;
  private velocity: number;
  private isReleased = false;
  private autoReleaseTimer?: ReturnType<typeof setTimeout>;
  private baseFreq: number;
  private osc2Freq?: number;
  private baseCutoff: number;

  constructor(
    ctx: AudioContext,
    masterGain: GainNode,
    noiseBuffer: AudioBuffer,
    params: SynthParams,
    freq: number,
    duration?: number,
    velocity: number = 0.8,
    onEnded?: () => void,
  ) {
    this.ctx = ctx;
    this.params = params;
    this.velocity = Math.max(0.1, Math.min(1.0, velocity));
    this.baseFreq = freq;
    const now = ctx.currentTime;

    this.voiceMixer = ctx.createGain();
    this.voiceMixer.gain.setValueAtTime(1.0, now);
    this.voiceMixer.connect(masterGain);

    if (params.exciterMode !== "off" && params.exciterVol > 0.01) {
      this.triggerExciter(now, freq, this.voiceMixer, noiseBuffer, this.velocity);
    }

    this.filter = ctx.createBiquadFilter();
    this.filter.type = params.filterType;
    this.filter.Q.setValueAtTime(1.2, now);

    const semitoneRatio = Math.log2(freq / 261.63);
    const trackingMultiplier = 1.0 + semitoneRatio * params.keytrack;
    const trackedCutoff = Math.max(
      40,
      params.cutoff * Math.max(0.1, trackingMultiplier),
    );
    this.baseCutoff = trackedCutoff;

    const filterVelScale = 0.6 + 0.4 * this.velocity;
    const startSweep = Math.min(18000, trackedCutoff + params.envMod * filterVelScale);
    this.filter.frequency.setValueAtTime(startSweep, now);
    this.filter.frequency.exponentialRampToValueAtTime(
      trackedCutoff,
      now + Math.min(0.6, params.decay * 0.5),
    );

    this.osc1 = ctx.createOscillator();
    this.osc1.type = params.osc1Wave;
    this.osc1.frequency.setValueAtTime(freq, now);

    const hasOsc2 = params.osc2Wave !== "off";
    const osc1Gain = ctx.createGain();
    osc1Gain.gain.setValueAtTime(hasOsc2 ? 0.6 : 0.85, now);
    this.osc1.connect(osc1Gain);

    if (params.ksFeed > 0.05) {
      const delayNode = ctx.createDelay();
      const feedbackGain = ctx.createGain();
      const delayFilter = ctx.createBiquadFilter();

      const period = 1.0 / Math.max(40, freq);
      delayNode.delayTime.setValueAtTime(period, now);
      delayFilter.type = "lowpass";
      delayFilter.frequency.setValueAtTime(Math.min(8000, freq * 4), now);
      feedbackGain.gain.setValueAtTime(params.ksFeed, now);

      delayNode.connect(delayFilter);
      delayFilter.connect(feedbackGain);
      feedbackGain.connect(delayNode);

      osc1Gain.connect(delayNode);
      delayNode.connect(this.filter);
    } else {
      osc1Gain.connect(this.filter);
    }

    if (hasOsc2) {
      this.osc2 = ctx.createOscillator();
      this.osc2.type = params.osc2Wave as OscillatorType;
      const targetFreq = freq * Math.pow(2, params.osc2Oct / 12);
      this.osc2Freq = targetFreq;
      this.osc2.frequency.setValueAtTime(targetFreq, now);
      this.osc2.detune.setValueAtTime(params.detune, now);
      this.osc1.detune.setValueAtTime(-params.detune, now);

      const osc2Gain = ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.5, now);
      this.osc2.connect(osc2Gain);
      osc2Gain.connect(this.filter);
    }

    let lfoGain: GainNode | undefined;
    if (params.lfoDepth > 0) {
      this.lfo = ctx.createOscillator();
      lfoGain = ctx.createGain();
      this.lfo.frequency.setValueAtTime(params.lfoRate, now);
      lfoGain.gain.setValueAtTime(params.lfoDepth, now);
      this.lfo.start(now);

      if (params.lfoDest === "pitch") {
        this.lfo.connect(this.osc1.detune);
        if (this.osc2) this.lfo.connect(this.osc2.detune);
      } else if (params.lfoDest === "filter") {
        lfoGain.gain.setValueAtTime(params.lfoDepth * 15, now);
        this.lfo.connect(this.filter.frequency);
      }
    }

    this.ampGain = ctx.createGain();
    this.ampGain.gain.setValueAtTime(0.0001, now);

    const peakAmp = 0.12 * Math.pow(this.velocity, 1.25);
    const attackTime = Math.max(0.002, params.attack);
    this.ampGain.gain.linearRampToValueAtTime(peakAmp, now + attackTime);

    const scaledDecay =
      params.decay *
      Math.pow(261.63 / Math.max(freq, 60), 0.25) *
      (0.75 + 0.5 * this.velocity);
    const effectiveSustain = Math.max(params.sustain, 0.16 * this.velocity);
    const susLevel = Math.max(0.0001, peakAmp * effectiveSustain);
    this.ampGain.gain.exponentialRampToValueAtTime(
      susLevel,
      now + attackTime + scaledDecay,
    );

    if (params.lfoDepth > 0 && params.lfoDest === "tremolo" && lfoGain) {
      lfoGain.gain.setValueAtTime(params.lfoDepth * 0.015, now);
      this.lfo?.connect(this.ampGain.gain);
    }

    this.filter.connect(this.ampGain);
    this.ampGain.connect(this.voiceMixer);

    this.osc1.start(now);
    if (this.osc2) this.osc2.start(now);

    if (duration !== undefined && duration > 0) {
      this.autoReleaseTimer = setTimeout(() => {
        this.triggerRelease(false, onEnded);
      }, duration * 1000);
    } else {
      const naturalDuration =
        (attackTime + scaledDecay + Math.max(0.6, params.release)) * 1000;
      this.autoReleaseTimer = setTimeout(() => {
        this.triggerRelease(false, onEnded);
      }, naturalDuration);
    }
  }

  private triggerExciter(
    now: number,
    freq: number,
    voiceMixer: GainNode,
    noiseBuffer: AudioBuffer,
    velocity: number = 0.8,
  ) {
    const velFactor = Math.max(0.2, Math.min(1.2, velocity));
    if (this.params.exciterMode === "thud") {
      const thudOsc = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      thudOsc.type = "sine";
      thudOsc.frequency.setValueAtTime(this.params.exciterFreq, now);

      thudGain.gain.setValueAtTime(0.0001, now);
      thudGain.gain.linearRampToValueAtTime(
        this.params.exciterVol * 0.12 * velFactor,
        now + 0.002,
      );
      thudGain.gain.exponentialRampToValueAtTime(
        0.00001,
        now + this.params.exciterDecay,
      );

      thudOsc.connect(thudGain);
      thudGain.connect(voiceMixer);
      thudOsc.start(now);
      thudOsc.stop(now + this.params.exciterDecay + 0.02);
    } else if (
      this.params.exciterMode === "noise" ||
      this.params.exciterMode === "click"
    ) {
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;

      const bpass = this.ctx.createBiquadFilter();
      bpass.type = "bandpass";
      bpass.frequency.setValueAtTime(this.params.exciterFreq, now);
      bpass.Q.setValueAtTime(3.0, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(
        this.params.exciterVol * 0.1,
        now + 0.002,
      );
      noiseGain.gain.exponentialRampToValueAtTime(
        0.00001,
        now + this.params.exciterDecay,
      );

      noiseSrc.connect(bpass);
      bpass.connect(noiseGain);
      noiseGain.connect(voiceMixer);
      noiseSrc.start(now);
      noiseSrc.stop(now + this.params.exciterDecay + 0.02);
    } else if (this.params.exciterMode === "drum") {
      const drumOsc = this.ctx.createOscillator();
      const drumGain = this.ctx.createGain();
      drumOsc.type = "sine";
      drumOsc.frequency.setValueAtTime(this.params.exciterFreq * 3.5, now);
      drumOsc.frequency.exponentialRampToValueAtTime(
        Math.max(30, freq),
        now + this.params.exciterDecay,
      );

      drumGain.gain.setValueAtTime(0.0001, now);
      drumGain.gain.linearRampToValueAtTime(
        this.params.exciterVol * 0.14,
        now + 0.002,
      );
      drumGain.gain.exponentialRampToValueAtTime(
        0.00001,
        now + this.params.exciterDecay * 1.5,
      );

      drumOsc.connect(drumGain);
      drumGain.connect(voiceMixer);
      drumOsc.start(now);
      drumOsc.stop(now + this.params.exciterDecay * 1.5 + 0.02);
    }
  }

  public triggerRelease(fast = false, onEnded?: () => void) {
    if (this.isReleased) return;
    this.isReleased = true;
    if (this.autoReleaseTimer) {
      clearTimeout(this.autoReleaseTimer);
    }

    const now = this.ctx.currentTime;
    this.ampGain.gain.cancelScheduledValues(now);

    const currentAmp = Math.max(0.0001, this.ampGain.gain.value);
    this.ampGain.gain.setValueAtTime(currentAmp, now);
    const minRelease = 0.35 + 0.45 * this.velocity;
    const releaseTime = fast ? 0.015 : Math.max(minRelease, this.params.release);
    this.ampGain.gain.exponentialRampToValueAtTime(0.00001, now + releaseTime);

    const stopAt = now + releaseTime + 0.02;
    this.osc1.stop(stopAt);
    if (this.osc2) this.osc2.stop(stopAt);
    if (this.lfo) this.lfo.stop(stopAt);

    setTimeout(
      () => {
        try {
          this.voiceMixer.disconnect();
        } catch {
          // Voice mixer already disconnected
        }
        if (onEnded) {
          onEnded();
        }
      },
      (releaseTime + 0.05) * 1000,
    );
  }

  public setPitchBend(ratio: number) {
    if (this.isReleased) return;
    const now = this.ctx.currentTime;
    this.osc1.frequency.cancelScheduledValues(now);
    this.osc1.frequency.setValueAtTime(this.baseFreq * ratio, now);
    if (this.osc2 && this.osc2Freq) {
      this.osc2.frequency.cancelScheduledValues(now);
      this.osc2.frequency.setValueAtTime(this.osc2Freq * ratio, now);
    }
  }

  public setFilterOffset(offset: number) {
    if (this.isReleased) return;
    const now = this.ctx.currentTime;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(
      Math.max(40, Math.min(18000, this.baseCutoff + offset)),
      now,
    );
  }
}

class HybridSynthEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lowShelfEQ: BiquadFilterNode | null = null;
  private distortionNode: WaveShaperNode | null = null;
  private convolver: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private finalCeilingGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private activeVoices = new Map<string, HybridVoice>();
  private readonly MAX_POLYPHONY = 16;

  public params: SynthParams = { ...SYNTH_PRESETS.grand_piano };
  public currentPresetKey = "grand_piano";
  public octaveShift = 0;

  public ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return null;
      this.audioCtx = new AudioContextClass();

      const nSize = this.audioCtx.sampleRate * 0.5;
      this.noiseBuffer = this.audioCtx.createBuffer(
        1,
        nSize,
        this.audioCtx.sampleRate,
      );
      const nData = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < nSize; i++) {
        nData[i] = Math.random() * 2 - 1;
      }

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.params.masterVol,
        this.audioCtx.currentTime,
      );

      this.lowShelfEQ = this.audioCtx.createBiquadFilter();
      this.lowShelfEQ.type = "lowshelf";
      this.lowShelfEQ.frequency.setValueAtTime(180, this.audioCtx.currentTime);
      this.lowShelfEQ.gain.setValueAtTime(
        this.params.lowEq,
        this.audioCtx.currentTime,
      );

      this.distortionNode = this.audioCtx.createWaveShaper();
      this.distortionNode.curve = makeDistortionCurve(
        this.params.drive,
      ) as unknown as Float32Array<ArrayBuffer>;
      this.distortionNode.oversample = "2x";

      this.convolver = this.audioCtx.createConvolver();
      this.convolver.buffer = createReverbImpulse(this.audioCtx, 1.2, 2.0);

      this.dryGain = this.audioCtx.createGain();
      this.wetGain = this.audioCtx.createGain();
      this.dryGain.gain.setValueAtTime(
        1.0 - this.params.reverb,
        this.audioCtx.currentTime,
      );
      this.wetGain.gain.setValueAtTime(
        this.params.reverb,
        this.audioCtx.currentTime,
      );

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterLimiter = this.audioCtx.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(
        -4.5,
        this.audioCtx.currentTime,
      );
      this.masterLimiter.knee.setValueAtTime(6.0, this.audioCtx.currentTime);
      this.masterLimiter.ratio.setValueAtTime(16.0, this.audioCtx.currentTime);
      this.masterLimiter.attack.setValueAtTime(
        0.002,
        this.audioCtx.currentTime,
      );
      this.masterLimiter.release.setValueAtTime(
        0.08,
        this.audioCtx.currentTime,
      );

      this.finalCeilingGain = this.audioCtx.createGain();
      this.finalCeilingGain.gain.setValueAtTime(
        0.85,
        this.audioCtx.currentTime,
      );

      this.masterGain.connect(this.lowShelfEQ);
      this.lowShelfEQ.connect(this.distortionNode);

      this.distortionNode.connect(this.dryGain);
      this.distortionNode.connect(this.convolver);
      this.convolver.connect(this.wetGain);

      this.dryGain.connect(this.analyser);
      this.wetGain.connect(this.analyser);

      this.analyser.connect(this.masterLimiter);
      this.masterLimiter.connect(this.finalCeilingGain);
      this.finalCeilingGain.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  public getAnalyser(): AnalyserNode | null {
    this.ensureContext();
    return this.analyser;
  }

  public playNote(
    noteName: string,
    customFreq?: number,
    duration?: number,
    velocity: number = 0.8,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    if (this.activeVoices.has(noteName)) {
      this.stopNote(noteName);
    }

    if (this.activeVoices.size >= this.MAX_POLYPHONY) {
      const oldestKey = this.activeVoices.keys().next().value;
      if (oldestKey) {
        const oldestVoice = this.activeVoices.get(oldestKey);
        if (oldestVoice) {
          oldestVoice.triggerRelease(true);
        }
        this.activeVoices.delete(oldestKey);
      }
    }

    let baseFreq = customFreq;
    if (!baseFreq) {
      const calculated = noteToFrequency(noteName);
      if (!calculated) return;
      baseFreq = calculated;
    }

    const shiftedFreq =
      baseFreq * Math.pow(2, this.octaveShift + this.params.octave);
    const voice = new HybridVoice(
      ctx,
      this.masterGain,
      this.noiseBuffer,
      this.params,
      shiftedFreq,
      duration,
      velocity,
      () => {
        if (this.activeVoices.get(noteName) === voice) {
          this.activeVoices.delete(noteName);
        }
      },
    );
    this.activeVoices.set(noteName, voice);
  }

  public stopNote(noteName: string): void {
    const voice = this.activeVoices.get(noteName);
    if (!voice) return;
    voice.triggerRelease();
    this.activeVoices.delete(noteName);
  }

  public playDrum(
    noteName: string,
    velocity: number = 0.8,
    kitName: string = "drum_set",
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const drumParams = SYNTH_PRESETS[kitName] || SYNTH_PRESETS["drum_set"];
    const baseFreq = noteToFrequency(noteName);
    if (!baseFreq) return;

    const shiftedFreq =
      baseFreq * Math.pow(2, drumParams.octave);

    const drumKey = `drum-${noteName}`;
    if (this.activeVoices.has(drumKey)) {
      const old = this.activeVoices.get(drumKey);
      if (old) old.triggerRelease(true);
      this.activeVoices.delete(drumKey);
    }

    const voice = new HybridVoice(
      ctx,
      this.masterGain,
      this.noiseBuffer,
      drumParams,
      shiftedFreq,
      0.45,
      velocity,
      () => {
        if (this.activeVoices.get(drumKey) === voice) {
          this.activeVoices.delete(drumKey);
        }
      },
    );
    this.activeVoices.set(drumKey, voice);
  }

  public setPitchBend(semitones: number): void {
    const ratio = Math.pow(2, semitones / 12);
    this.activeVoices.forEach((voice) => {
      voice.setPitchBend(ratio);
    });
  }

  public setModWheel(normalized: number): void {
    const offset = normalized * 4500;
    this.activeVoices.forEach((voice) => {
      voice.setFilterOffset(offset);
    });
  }

  public handleMidiCC(controller: number, value: number): void {
    const normalized = value / 127;
    if (controller === 1) {
      this.setModWheel(normalized);
    } else if (controller === 7) {
      this.setMasterVolume(normalized);
    } else if (controller === 74) {
      const minCutoff = 80;
      const maxCutoff = 12000;
      const newCutoff = Math.round(minCutoff + normalized * (maxCutoff - minCutoff));
      this.updateParam("cutoff", newCutoff);
    } else if (controller === 71) {
      const newDrive = Number((normalized * 0.5).toFixed(2));
      this.updateParam("drive", newDrive);
    } else if (controller === 91) {
      const newReverb = Number((normalized * 0.8).toFixed(2));
      this.updateParam("reverb", newReverb);
    }
  }

  public stopAllNotes(): void {
    this.activeVoices.forEach((voice) => voice.triggerRelease(true));
    this.activeVoices.clear();
  }

  public panic(): void {
    this.activeVoices.forEach((voice) => voice.triggerRelease(true));
    this.activeVoices.clear();

    if (this.audioCtx && this.masterGain) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(0.00001, now);
      this.masterGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, this.params.masterVol),
        now + 0.05,
      );
    }
  }

  public setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.params.masterVol = clamped;
    if (this.audioCtx && this.masterGain) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(clamped, now + 0.02);
    }
  }

  public getMasterVolume(): number {
    return this.params.masterVol;
  }

  public playMetronomeTick(isAccent = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const startFreq = isAccent ? 1500 : 900;
    const endFreq = isAccent ? 650 : 400;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.02);

    const peakVol = isAccent ? 0.35 : 0.2;
    gain.gain.setValueAtTime(peakVol, now);
    gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.035);

    osc.connect(gain);
    if (this.finalCeilingGain) {
      gain.connect(this.finalCeilingGain);
    } else {
      gain.connect(ctx.destination);
    }

    osc.start(now);
    osc.stop(now + 0.04);
  }

  public loadPreset(presetKey: string): void {
    const aliasMap: Record<string, string> = {
      piano: "grand_piano",
      guitar: "acoustic_guitar",
      bass: "base_guitar",
      drums: "drum_set",
      synth: "electronic_pino",
    };
    const resolvedKey = aliasMap[presetKey] || presetKey;
    const preset = SYNTH_PRESETS[resolvedKey];
    if (!preset) return;
    this.currentPresetKey = resolvedKey;
    this.params = { ...preset };
    this.octaveShift = preset.octave || 0;
    this.applyFxParams();
  }

  public registerPreset(presetKey: string, params: SynthParams): void {
    SYNTH_PRESETS[presetKey] = { ...params };
  }

  public unregisterPreset(presetKey: string): void {
    delete SYNTH_PRESETS[presetKey];
  }

  public getParams(): SynthParams {
    return { ...this.params };
  }

  public updateParam<K extends keyof SynthParams>(
    key: K,
    value: SynthParams[K],
  ): void {
    this.params[key] = value;
    this.applyFxParams();
  }

  private applyFxParams(): void {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    if (this.lowShelfEQ) {
      this.lowShelfEQ.gain.setValueAtTime(this.params.lowEq, now);
    }
    if (this.distortionNode) {
      this.distortionNode.curve = makeDistortionCurve(
        this.params.drive,
      ) as unknown as Float32Array<ArrayBuffer>;
    }
    if (this.dryGain && this.wetGain) {
      this.dryGain.gain.setValueAtTime(1.0 - this.params.reverb, now);
      this.wetGain.gain.setValueAtTime(this.params.reverb, now);
    }
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.params.masterVol, now);
    }
  }
}

export const synth = new HybridSynthEngine();
