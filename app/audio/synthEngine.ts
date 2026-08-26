export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square';
export type SoundModel = 'piano-physical' | 'guitar-acoustic' | 'guitar-nylon' | 'guitar-electric' | 'flute' | 'synth-oscillator';

export interface SynthSettings {
  soundModel: SoundModel;
  waveform: WaveformType;
  baseOctave: number; // e.g. 4 for C4
  pitchShiftSemi: number; // -12 to +12 semitones
  fineTuneCents: number; // -100 to +100 cents
  pitchBend: number; // -1 to +1 (pitch bend wheel, +/- 2 semitones)
  attack: number; // seconds (0.005 to 1.0)
  decay: number; // seconds (0.01 to 1.0)
  sustain: number; // level (0.0 to 1.0)
  release: number; // seconds (0.01 to 2.0)
  volume: number; // 0.0 to 1.0
  filterCutoff: number; // Hz (100 to 20000)
  sustainPedal: boolean; // hold notes when released
  reverbLevel: number; // 0.0 to 1.0 (reverb wet mix)
  reverbDecay: number; // seconds (0.5 to 5.0)
  echoLevel: number; // 0.0 to 1.0 (delay wet mix)
  echoTime: number; // seconds (0.05 to 1.0)
  echoFeedback: number; // 0.0 to 0.85
  strumSpeedMs: number; // milliseconds between notes in chords (0 to 50ms)
  activePresetId?: string;
}

export interface InstrumentPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  iconSymbol: string;
  settings: Partial<SynthSettings>;
}

export const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  {
    id: 'concert-flute',
    name: 'Concert Flute',
    category: 'Woodwind',
    description: 'Acoustic concert flute with embouchure breath chiff, warm cylindrical tube body and expressive vibrato',
    iconSymbol: '🪈',
    settings: {
      soundModel: 'flute',
      waveform: 'sine',
      attack: 0.045,
      decay: 0.2,
      sustain: 0.9,
      release: 0.18,
      filterCutoff: 5800,
      reverbLevel: 0.45,
      reverbDecay: 2.8,
      echoLevel: 0.12,
      echoTime: 0.32,
      echoFeedback: 0.25,
      strumSpeedMs: 0,
    },
  },
  {
    id: 'acoustic-guitar',
    name: 'Acoustic Guitar',
    category: 'Strings',
    description: 'Steel-string acoustic guitar with warm wooden body resonance and natural pluck decay',
    iconSymbol: '🎸',
    settings: {
      soundModel: 'guitar-acoustic',
      waveform: 'sawtooth',
      attack: 0.005,
      decay: 1.2,
      sustain: 0.1,
      release: 0.35,
      filterCutoff: 4500,
      reverbLevel: 0.25,
      reverbDecay: 1.8,
      echoLevel: 0.08,
      echoTime: 0.25,
      echoFeedback: 0.2,
      strumSpeedMs: 20,
    },
  },
  {
    id: 'nylon-guitar',
    name: 'Nylon Guitar',
    category: 'Strings',
    description: 'Spanish classical guitar with soft finger touch and mellow acoustic resonance',
    iconSymbol: '🪕',
    settings: {
      soundModel: 'guitar-nylon',
      waveform: 'triangle',
      attack: 0.008,
      decay: 1.0,
      sustain: 0.12,
      release: 0.3,
      filterCutoff: 3200,
      reverbLevel: 0.3,
      reverbDecay: 2.0,
      echoLevel: 0.06,
      echoTime: 0.28,
      echoFeedback: 0.15,
      strumSpeedMs: 18,
    },
  },
  {
    id: 'electric-guitar',
    name: 'Electric Guitar',
    category: 'Strings',
    description: 'Warm clean electric guitar with magnetic pickup tone, body warmth and subtle delay',
    iconSymbol: '⚡',
    settings: {
      soundModel: 'guitar-electric',
      waveform: 'sawtooth',
      attack: 0.004,
      decay: 1.4,
      sustain: 0.28,
      release: 0.38,
      filterCutoff: 5200,
      reverbLevel: 0.25,
      reverbDecay: 1.6,
      echoLevel: 0.22,
      echoTime: 0.3,
      echoFeedback: 0.3,
      strumSpeedMs: 16,
    },
  },
  {
    id: 'grand-piano',
    name: 'Grand Piano',
    category: 'Acoustic',
    description: 'Acoustic concert grand with felt hammer strike, dual-string unison and warm soundboard resonance',
    iconSymbol: '🎹',
    settings: {
      soundModel: 'piano-physical',
      waveform: 'triangle',
      attack: 0.005,
      decay: 0.9,
      sustain: 0.35,
      release: 0.45,
      filterCutoff: 4800,
      reverbLevel: 0.28,
      reverbDecay: 2.2,
      echoLevel: 0.04,
      echoTime: 0.25,
      echoFeedback: 0.15,
      strumSpeedMs: 0,
    },
  },
  {
    id: 'electric-piano',
    name: 'Rhodes E-Piano',
    category: 'Electric',
    description: 'Vintage tine electric piano with warm bell overtones & stereo delay',
    iconSymbol: '✨',
    settings: {
      soundModel: 'synth-oscillator',
      waveform: 'sine',
      attack: 0.006,
      decay: 0.6,
      sustain: 0.45,
      release: 0.35,
      filterCutoff: 3200,
      reverbLevel: 0.25,
      reverbDecay: 1.8,
      echoLevel: 0.22,
      echoTime: 0.32,
      echoFeedback: 0.3,
      strumSpeedMs: 0,
    },
  },
  {
    id: 'synth-piano-80s',
    name: '80s Synth Piano',
    category: 'Synth',
    description: 'Bright FM-style digital piano with gated hall reverb & rhythmic echo',
    iconSymbol: '🎹',
    settings: {
      soundModel: 'synth-oscillator',
      waveform: 'sawtooth',
      attack: 0.005,
      decay: 0.45,
      sustain: 0.5,
      release: 0.28,
      filterCutoff: 5500,
      reverbLevel: 0.35,
      reverbDecay: 2.0,
      echoLevel: 0.25,
      echoTime: 0.28,
      echoFeedback: 0.35,
      strumSpeedMs: 0,
    },
  },
  {
    id: 'dream-pad-piano',
    name: 'Dream Piano Pad',
    category: 'Ambient',
    description: 'Cinematic piano with slow swell, lush cathedral reverb & ethereal echo',
    iconSymbol: '🌌',
    settings: {
      soundModel: 'synth-oscillator',
      waveform: 'triangle',
      attack: 0.15,
      decay: 0.8,
      sustain: 0.8,
      release: 1.1,
      filterCutoff: 2600,
      reverbLevel: 0.65,
      reverbDecay: 3.5,
      echoLevel: 0.4,
      echoTime: 0.4,
      echoFeedback: 0.45,
      strumSpeedMs: 0,
    },
  },
  {
    id: 'pipe-organ',
    name: 'Pipe Organ',
    category: 'Vintage',
    description: 'Majestic cathedral organ with sustained resonant pipes & deep acoustic hall',
    iconSymbol: '🏛️',
    settings: {
      soundModel: 'synth-oscillator',
      waveform: 'square',
      attack: 0.035,
      decay: 0.08,
      sustain: 0.95,
      release: 0.25,
      filterCutoff: 3800,
      reverbLevel: 0.55,
      reverbDecay: 3.6,
      echoLevel: 0.12,
      echoTime: 0.3,
      echoFeedback: 0.2,
      strumSpeedMs: 0,
    },
  },
  {
    id: 'analog-lead',
    name: 'Analog Lead',
    category: 'Synth',
    description: 'Punchy saw lead with analog warmth, filter bite & ping-pong delay',
    iconSymbol: '🔥',
    settings: {
      soundModel: 'synth-oscillator',
      waveform: 'sawtooth',
      attack: 0.025,
      decay: 0.22,
      sustain: 0.7,
      release: 0.24,
      filterCutoff: 4800,
      reverbLevel: 0.25,
      reverbDecay: 1.6,
      echoLevel: 0.3,
      echoTime: 0.24,
      echoFeedback: 0.38,
      strumSpeedMs: 0,
    },
  },
  {
    id: 'chiptune-8bit',
    name: '8-Bit Chiptune',
    category: 'Retro',
    description: 'Classic retro arcade square wave synth sound with clean dry punch',
    iconSymbol: '👾',
    settings: {
      soundModel: 'synth-oscillator',
      waveform: 'square',
      attack: 0.005,
      decay: 0.1,
      sustain: 0.65,
      release: 0.06,
      filterCutoff: 8000,
      reverbLevel: 0.0,
      reverbDecay: 0.5,
      echoLevel: 0.06,
      echoTime: 0.15,
      echoFeedback: 0.15,
      strumSpeedMs: 0,
    },
  },
];

export interface ActiveVoice {
  nodesToDisconnect: AudioNode[];
  gainNode: GainNode;
  midiNote: number;
  startTime: number;
  released: boolean;
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface PianoKeyData {
  midiNote: number;
  noteName: string;
  accidental: boolean;
  octave: number;
  fullName: string;
  shortcutKey: string;
  displayShortcut: string;
}

export function generatePianoKeys(baseOctave: number): PianoKeyData[] {
  const shortcuts: { [relIndex: number]: { key: string; display: string } } = {
    0: { key: 'a', display: 'A' },
    1: { key: 'w', display: 'W' },
    2: { key: 's', display: 'S' },
    3: { key: 'e', display: 'E' },
    4: { key: 'd', display: 'D' },
    5: { key: 'f', display: 'F' },
    6: { key: 't', display: 'T' },
    7: { key: 'g', display: 'G' },
    8: { key: 'y', display: 'Y' },
    9: { key: 'h', display: 'H' },
    10: { key: 'u', display: 'U' },
    11: { key: 'j', display: 'J' },
    12: { key: 'k', display: 'K' },
    13: { key: 'o', display: 'O' },
    14: { key: 'l', display: 'L' },
    15: { key: 'p', display: 'P' },
    16: { key: ';', display: ';' },
    17: { key: "'", display: "'" },
    18: { key: ']', display: ']' },
    19: { key: 'Enter', display: '↵' },
  };

  const keys: PianoKeyData[] = [];
  const startMidi = (baseOctave + 1) * 12;

  for (let i = 0; i < 20; i++) {
    const midiNote = startMidi + i;
    const noteIndex = i % 12;
    const currentOctave = Math.floor(midiNote / 12) - 1;
    const noteName = NOTE_NAMES[noteIndex];
    const accidental = noteName.includes('#');
    const shortcutInfo = shortcuts[i] || { key: '', display: '' };

    keys.push({
      midiNote,
      noteName,
      accidental,
      octave: currentOctave,
      fullName: `${noteName}${currentOctave}`,
      shortcutKey: shortcutInfo.key,
      displayShortcut: shortcutInfo.display,
    });
  }

  return keys;
}

export function midiToFrequency(
  midiNote: number,
  pitchShiftSemi: number = 0,
  fineTuneCents: number = 0,
  pitchBend: number = 0
): number {
  const totalSemiOffset = pitchShiftSemi + (fineTuneCents / 100) + (pitchBend * 2);
  const effectiveMidi = midiNote + totalSemiOffset;
  return 440 * Math.pow(2, (effectiveMidi - 69) / 12);
}

function createImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1024, Math.floor(sampleRate * Math.max(0.2, duration)));
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  const decayConstant = 5.0 / Math.max(0.1, decay);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * decayConstant);
    left[i] = (Math.random() * 2 - 1) * envelope * 0.7;
    right[i] = (Math.random() * 2 - 1) * envelope * 0.7;
  }
  return impulse;
}

// Generate short breath / chiff noise burst for flutes and woodwinds
function createChiffBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(64, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let noiseMemory = 0;
  for (let i = 0; i < length; i++) {
    const raw = Math.random() * 2 - 1;
    const env = Math.sin((Math.PI * i) / (length - 1));
    noiseMemory = 0.5 * noiseMemory + 0.5 * raw;
    data[i] = noiseMemory * env * 0.5;
  }
  return buffer;
}

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;

  // Reverb
  private convolver: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;

  // Echo (Delay)
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;

  public analyser: AnalyserNode | null = null;
  private activeVoices: Map<number, ActiveVoice> = new Map();
  private sustainedNotes: Set<number> = new Set();
  private settings: SynthSettings = {
    soundModel: 'piano-physical',
    waveform: 'triangle',
    baseOctave: 4,
    pitchShiftSemi: 0,
    fineTuneCents: 0,
    pitchBend: 0,
    attack: 0.005,
    decay: 0.9,
    sustain: 0.35,
    release: 0.45,
    volume: 0.55,
    filterCutoff: 4800,
    sustainPedal: false,
    reverbLevel: 0.28,
    reverbDecay: 2.2,
    echoLevel: 0.04,
    echoTime: 0.25,
    echoFeedback: 0.15,
    strumSpeedMs: 0,
    activePresetId: 'grand-piano',
  };

  constructor() {}

  public initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Master Limiter (DynamicsCompressorNode) - Pre-output brickwall limiter to eliminate clipping
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(-2.5, this.ctx.currentTime);
      this.masterLimiter.knee.setValueAtTime(8.0, this.ctx.currentTime);
      this.masterLimiter.ratio.setValueAtTime(16.0, this.ctx.currentTime);
      this.masterLimiter.attack.setValueAtTime(0.002, this.ctx.currentTime);
      this.masterLimiter.release.setValueAtTime(0.1, this.ctx.currentTime);

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.settings.volume, this.ctx.currentTime);

      // Dry Gain & Effects Bus with proper headroom
      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.setValueAtTime(0.75, this.ctx.currentTime);

      this.effectsBus = this.ctx.createGain();
      this.effectsBus.gain.setValueAtTime(0.5, this.ctx.currentTime);

      // Reverb Convolver & Wet Gain
      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = createImpulseResponse(this.ctx, this.settings.reverbDecay, this.settings.reverbDecay);

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(this.settings.reverbLevel * 0.4, this.ctx.currentTime);

      // Echo Delay, Feedback & Wet Gain
      this.delayNode = this.ctx.createDelay(2.0);
      this.delayNode.delayTime.setValueAtTime(this.settings.echoTime, this.ctx.currentTime);

      this.delayFeedbackGain = this.ctx.createGain();
      const safeFeedback = Math.min(0.65, Math.max(0, this.settings.echoFeedback));
      this.delayFeedbackGain.gain.setValueAtTime(safeFeedback, this.ctx.currentTime);

      this.delayWetGain = this.ctx.createGain();
      this.delayWetGain.gain.setValueAtTime(this.settings.echoLevel * 0.4, this.ctx.currentTime);

      // Delay Feedback Loop
      this.delayNode.connect(this.delayFeedbackGain);
      this.delayFeedbackGain.connect(this.delayNode);

      // Connect Effects Bus
      this.effectsBus.connect(this.convolver);
      this.convolver.connect(this.reverbGain);

      this.effectsBus.connect(this.delayNode);
      this.delayNode.connect(this.delayWetGain);

      // Mix Dry + Reverb + Echo -> MasterGain
      this.dryGain.connect(this.masterGain);
      this.reverbGain.connect(this.masterGain);
      this.delayWetGain.connect(this.masterGain);

      // Analyser Node for visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;

      // MasterGain -> MasterLimiter -> Analyser -> Destination
      this.masterGain.connect(this.masterLimiter);
      this.masterLimiter.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    return this.ctx;
  }

  public updateSettings(newSettings: Partial<SynthSettings>) {
    const prevDecay = this.settings.reverbDecay;
    this.settings = { ...this.settings, ...newSettings };

    if (this.ctx) {
      const now = this.ctx.currentTime;

      if (this.masterGain && newSettings.volume !== undefined) {
        this.masterGain.gain.setTargetAtTime(this.settings.volume, now, 0.02);
      }

      if (this.reverbGain && newSettings.reverbLevel !== undefined) {
        this.reverbGain.gain.setTargetAtTime(this.settings.reverbLevel * 0.4, now, 0.02);
      }

      if (this.convolver && newSettings.reverbDecay !== undefined && Math.abs(newSettings.reverbDecay - prevDecay) > 0.2) {
        this.convolver.buffer = createImpulseResponse(this.ctx, this.settings.reverbDecay, this.settings.reverbDecay);
      }

      if (this.delayNode && newSettings.echoTime !== undefined) {
        this.delayNode.delayTime.setTargetAtTime(this.settings.echoTime, now, 0.02);
      }

      if (this.delayFeedbackGain && newSettings.echoFeedback !== undefined) {
        const safeFeedback = Math.min(0.65, Math.max(0, this.settings.echoFeedback));
        this.delayFeedbackGain.gain.setTargetAtTime(safeFeedback, now, 0.02);
      }

      if (this.delayWetGain && newSettings.echoLevel !== undefined) {
        this.delayWetGain.gain.setTargetAtTime(this.settings.echoLevel * 0.4, now, 0.02);
      }
    }

    if (newSettings.sustainPedal === false) {
      const notesToStop = Array.from(this.sustainedNotes);
      this.sustainedNotes.clear();
      notesToStop.forEach((midi) => {
        this.stopNote(midi, true);
      });
    }
  }

  public getSettings(): SynthSettings {
    return { ...this.settings };
  }

  public noteOn(midiNote: number): void {
    const ctx = this.initContext();
    const now = ctx.currentTime;

    // Terminate existing voice cleanly
    const existingVoice = this.activeVoices.get(midiNote);
    if (existingVoice) {
      this.activeVoices.delete(midiNote);
      try {
        existingVoice.gainNode.gain.cancelScheduledValues(now);
        existingVoice.gainNode.gain.setValueAtTime(0, now);
        existingVoice.nodesToDisconnect.forEach((n) => {
          if ('stop' in n && typeof (n as AudioScheduledSourceNode).stop === 'function') {
            (n as AudioScheduledSourceNode).stop(now);
          }
          n.disconnect();
        });
      } catch {}
    }

    const freq = midiToFrequency(
      midiNote,
      this.settings.pitchShiftSemi,
      this.settings.fineTuneCents,
      this.settings.pitchBend
    );

    const soundModel = this.settings.soundModel;

    if (soundModel === 'flute') {
      this.playPhysicalFlute(midiNote, freq, now);
    } else if (soundModel === 'guitar-acoustic' || soundModel === 'guitar-nylon' || soundModel === 'guitar-electric') {
      this.playPhysicalGuitar(midiNote, freq, soundModel, now);
    } else if (soundModel === 'piano-physical') {
      this.playPhysicalPiano(midiNote, freq, now);
    } else {
      this.playSynthOscillator(midiNote, freq, now);
    }
  }

  // 1. Physical Modeling Flute & Woodwind (Embouchure chiff breath + pure cylindrical tube + expressive LFO vibrato)
  private playPhysicalFlute(midiNote: number, freq: number, now: number) {
    const ctx = this.ctx!;

    // 1. Embouchure Breath "Chiff" Noise Attack
    const chiffBuffer = createChiffBuffer(ctx, 0.04);
    const chiffSource = ctx.createBufferSource();
    chiffSource.buffer = chiffBuffer;

    const chiffFilter = ctx.createBiquadFilter();
    chiffFilter.type = 'bandpass';
    chiffFilter.frequency.setValueAtTime(Math.min(4500, freq * 3.0), now);
    chiffFilter.Q.setValueAtTime(2.0, now);

    const chiffGain = ctx.createGain();
    chiffGain.gain.setValueAtTime(0.18, now);
    chiffGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    chiffSource.connect(chiffFilter);
    chiffFilter.connect(chiffGain);

    // 2. Pure Fundamental Pipe Oscillator (Sine)
    const pipeOsc = ctx.createOscillator();
    pipeOsc.type = 'sine';
    pipeOsc.frequency.setValueAtTime(freq, now);

    // 3. Warm Woodwind Overtone Oscillator (Triangle)
    const overtoneOsc = ctx.createOscillator();
    overtoneOsc.type = 'triangle';
    overtoneOsc.frequency.setValueAtTime(freq, now);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.12, now);

    // 4. Harmonic Second Octave Whistle (Air column 2nd mode)
    const octaveOsc = ctx.createOscillator();
    octaveOsc.type = 'sine';
    octaveOsc.frequency.setValueAtTime(freq * 2.0, now);

    const octaveGain = ctx.createGain();
    octaveGain.gain.setValueAtTime(0.06, now);

    // 5. Natural Flute Vibrato LFO (5.2 Hz gentle pitch modulation with 50ms smooth onset)
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(5.2, now);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.0001, now);
    lfoGain.gain.linearRampToValueAtTime(3.2, now + 0.12); // subtle +-3.2Hz vibrato

    lfo.connect(lfoGain);
    lfoGain.connect(pipeOsc.frequency);
    lfoGain.connect(overtoneOsc.frequency);
    lfoGain.connect(octaveOsc.frequency);

    // 6. Cylindrical Woodwind Tube Filter (Smooth acoustic body)
    const tubeFilter = ctx.createBiquadFilter();
    tubeFilter.type = 'lowpass';
    const tubeCutoff = Math.min(6500, freq * 4.5);
    tubeFilter.frequency.setValueAtTime(tubeCutoff, now);
    tubeFilter.Q.setValueAtTime(0.8, now);

    // 7. Flute Breath Envelope (Gentle air rise & long expressive sustain)
    const voiceGain = ctx.createGain();
    const { attack, decay, sustain } = this.settings;
    const peakGain = 0.28;

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(peakGain, now + Math.max(0.03, attack));
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain * peakGain), now + attack + Math.max(0.05, decay));

    // Connect Audio Pipeline
    pipeOsc.connect(tubeFilter);
    overtoneOsc.connect(overtoneGain);
    overtoneGain.connect(tubeFilter);
    octaveOsc.connect(octaveGain);
    octaveGain.connect(tubeFilter);
    chiffGain.connect(tubeFilter);

    tubeFilter.connect(voiceGain);

    if (this.dryGain && this.effectsBus) {
      voiceGain.connect(this.dryGain);
      voiceGain.connect(this.effectsBus);
    }

    chiffSource.start(now);
    pipeOsc.start(now);
    overtoneOsc.start(now);
    octaveOsc.start(now);
    lfo.start(now);

    const voice: ActiveVoice = {
      nodesToDisconnect: [
        chiffSource,
        chiffFilter,
        chiffGain,
        pipeOsc,
        overtoneOsc,
        overtoneGain,
        octaveOsc,
        octaveGain,
        lfo,
        lfoGain,
        tubeFilter,
        voiceGain,
      ],
      gainNode: voiceGain,
      midiNote,
      startTime: now,
      released: false,
    };

    this.activeVoices.set(midiNote, voice);
    this.sustainedNotes.delete(midiNote);
  }

  // 2. Acoustic / Nylon / Electric Guitar Model
  private playPhysicalGuitar(
    midiNote: number,
    freq: number,
    style: 'guitar-acoustic' | 'guitar-nylon' | 'guitar-electric',
    now: number
  ) {
    const ctx = this.ctx!;
    const isNylon = style === 'guitar-nylon';
    const isElectric = style === 'guitar-electric';

    // 1. Primary String Oscillator (Fundamental with warm acoustic body)
    const stringOsc1 = ctx.createOscillator();
    stringOsc1.type = isNylon ? 'triangle' : 'sawtooth';
    stringOsc1.frequency.setValueAtTime(freq, now);

    // 2. Secondary String Oscillator (Detuned for natural acoustic string shimmer)
    const stringOsc2 = ctx.createOscillator();
    stringOsc2.type = isNylon ? 'sine' : 'triangle';
    stringOsc2.frequency.setValueAtTime(freq * 1.0006, now); // +1.0 cents detune

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(isNylon ? 0.25 : 0.2, now);

    // 3. String Body Lowpass Filter
    const stringFilter = ctx.createBiquadFilter();
    stringFilter.type = 'lowpass';
    const initialCutoff = isNylon ? Math.min(3800, freq * 3.0) : isElectric ? Math.min(6500, freq * 5.0) : Math.min(4800, freq * 4.0);
    stringFilter.frequency.setValueAtTime(initialCutoff, now);
    stringFilter.Q.setValueAtTime(0.8, now);

    // 4. Guitar Body Formant
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'peaking';
    bodyFilter.frequency.setValueAtTime(isNylon ? 180 : isElectric ? 1800 : 220, now);
    bodyFilter.Q.setValueAtTime(1.5, now);
    bodyFilter.gain.setValueAtTime(isElectric ? 1.5 : 2.0, now);

    // 5. Voice Output Gain Envelope
    const voiceGain = ctx.createGain();
    const { attack, decay, sustain } = this.settings;
    const peakGain = 0.24;

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(peakGain, now + Math.max(0.004, attack));
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain * peakGain), now + attack + Math.max(0.02, decay));

    // Connect Nodes
    stringOsc1.connect(stringFilter);
    stringOsc2.connect(osc2Gain);
    osc2Gain.connect(stringFilter);

    stringFilter.connect(bodyFilter);
    bodyFilter.connect(voiceGain);

    if (this.dryGain && this.effectsBus) {
      voiceGain.connect(this.dryGain);
      voiceGain.connect(this.effectsBus);
    }

    stringOsc1.start(now);
    stringOsc2.start(now);

    const voice: ActiveVoice = {
      nodesToDisconnect: [
        stringOsc1,
        stringOsc2,
        osc2Gain,
        stringFilter,
        bodyFilter,
        voiceGain,
      ],
      gainNode: voiceGain,
      midiNote,
      startTime: now,
      released: false,
    };

    this.activeVoices.set(midiNote, voice);
    this.sustainedNotes.delete(midiNote);
  }

  // 3. Physical Modeling Grand Piano
  private playPhysicalPiano(midiNote: number, freq: number, now: number) {
    const ctx = this.ctx!;

    // 1. Dual-String Unison Oscillators
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 1.0007, now); // +1.2 cents detune

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.15, now);

    // 2. Acoustic Lowpass Filter
    const dynamicFilter = ctx.createBiquadFilter();
    dynamicFilter.type = 'lowpass';
    const pianoCutoff = Math.min(5000, freq * 4.0);
    dynamicFilter.frequency.setValueAtTime(pianoCutoff, now);
    dynamicFilter.Q.setValueAtTime(0.7, now);

    // 3. Soundboard Resonance Filter
    const soundboardFilter = ctx.createBiquadFilter();
    soundboardFilter.type = 'peaking';
    soundboardFilter.frequency.setValueAtTime(300, now);
    soundboardFilter.Q.setValueAtTime(1.5, now);
    soundboardFilter.gain.setValueAtTime(1.8, now);

    // 4. Piano Voice Output Envelope
    const voiceGain = ctx.createGain();
    const { attack, decay, sustain } = this.settings;
    const peakGain = 0.26;

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(peakGain, now + Math.max(0.004, attack));
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain * peakGain), now + attack + Math.max(0.02, decay));

    // Connect Piano Nodes
    osc1.connect(dynamicFilter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(dynamicFilter);

    dynamicFilter.connect(soundboardFilter);
    soundboardFilter.connect(voiceGain);

    if (this.dryGain && this.effectsBus) {
      voiceGain.connect(this.dryGain);
      voiceGain.connect(this.effectsBus);
    }

    osc1.start(now);
    osc2.start(now);

    const voice: ActiveVoice = {
      nodesToDisconnect: [
        osc1,
        osc2,
        osc2Gain,
        dynamicFilter,
        soundboardFilter,
        voiceGain,
      ],
      gainNode: voiceGain,
      midiNote,
      startTime: now,
      released: false,
    };

    this.activeVoices.set(midiNote, voice);
    this.sustainedNotes.delete(midiNote);
  }

  // 4. Electronic Synthesizer Oscillator Model
  private playSynthOscillator(midiNote: number, freq: number, now: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const voiceGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.settings.filterCutoff, now);
    filter.Q.setValueAtTime(1.0, now);

    osc.type = this.settings.waveform;
    osc.frequency.setValueAtTime(freq, now);

    const { attack, decay, sustain } = this.settings;
    const peakGain = 0.25;

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(peakGain, now + Math.max(0.004, attack));
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain * peakGain), now + attack + Math.max(0.01, decay));

    osc.connect(filter);
    filter.connect(voiceGain);

    if (this.dryGain && this.effectsBus) {
      voiceGain.connect(this.dryGain);
      voiceGain.connect(this.effectsBus);
    }

    osc.start(now);

    const voice: ActiveVoice = {
      nodesToDisconnect: [osc, filter, voiceGain],
      gainNode: voiceGain,
      midiNote,
      startTime: now,
      released: false,
    };

    this.activeVoices.set(midiNote, voice);
    this.sustainedNotes.delete(midiNote);
  }

  public noteOff(midiNote: number, force: boolean = false): void {
    if (!this.ctx) return;

    if (this.settings.sustainPedal && !force) {
      this.sustainedNotes.add(midiNote);
      return;
    }

    this.stopNote(midiNote, force);
  }

  private stopNote(midiNote: number, force: boolean): void {
    const voice = this.activeVoices.get(midiNote);
    if (!voice || !this.ctx) return;

    this.activeVoices.delete(midiNote);

    const now = this.ctx.currentTime;
    const releaseTime = force ? 0.015 : Math.max(0.015, this.settings.release);

    voice.released = true;
    try {
      voice.gainNode.gain.cancelScheduledValues(now);
      voice.gainNode.gain.setValueAtTime(Math.max(voice.gainNode.gain.value, 0.0001), now);
      voice.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

      setTimeout(() => {
        try {
          voice.nodesToDisconnect.forEach((node) => {
            if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
              (node as AudioScheduledSourceNode).stop();
            }
            node.disconnect();
          });
        } catch {}
      }, (releaseTime + 0.05) * 1000);
    } catch {}
  }

  public stopAllNotes(forceReset: boolean = false): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.activeVoices.forEach((voice) => {
      try {
        voice.gainNode.gain.cancelScheduledValues(now);
        voice.gainNode.gain.setValueAtTime(0, now);
        voice.nodesToDisconnect.forEach((node) => {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop(now);
          }
          node.disconnect();
        });
      } catch {}
    });

    this.activeVoices.clear();
    this.sustainedNotes.clear();

    if (this.delayFeedbackGain) {
      try {
        this.delayFeedbackGain.gain.cancelScheduledValues(now);
        this.delayFeedbackGain.gain.setValueAtTime(0, now);
        const safeFeedback = Math.min(0.65, Math.max(0, this.settings.echoFeedback));
        this.delayFeedbackGain.gain.setValueAtTime(safeFeedback, now + 0.08);
      } catch {}
    }

    if (this.masterGain && this.dryGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(now);
        this.dryGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(0, now);
        this.dryGain.gain.setValueAtTime(0, now);

        this.dryGain.gain.setValueAtTime(0.75, now + 0.04);
        this.masterGain.gain.setValueAtTime(this.settings.volume, now + 0.05);
      } catch {}
    }
  }
}

export const synth = new SynthEngine();
