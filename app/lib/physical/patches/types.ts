import type { KeyTable } from "../dsp/math";
import type { BusId, DrumPieceId, InstrumentId, KitId } from "../messages";

export type { KeyTable };

// Measured pitch corrections (cents) keyed by sample rate; the nonlinear wind
// and bow loops settle slightly differently at 44.1 and 48 kHz.
export type TuningTables = Readonly<Record<string, KeyTable>>;

export function pickTuning(tables: TuningTables, fs: number): KeyTable {
  let best: KeyTable = [[0, 0]];
  let distance = Infinity;
  for (const [rate, table] of Object.entries(tables)) {
    const d = Math.abs(Number(rate) - fs);
    if (d < distance) {
      distance = d;
      best = table;
    }
  }
  return best;
}

export type SectionId =
  "exciter" | "resonator" | "body" | "filter" | "envelope" | "space";

export interface ParamSpec {
  id: string;
  label: string;
  section: SectionId;
  min: number;
  max: number;
  default: number;
  unit?: "Hz" | "s" | "%" | "cents" | "dB" | "st" | "×" | "ms";
  scale?: "linear" | "log";
  primary?: boolean;
  // Named choices for an index param, e.g. the oscillator's wave.
  options?: readonly string[];
}

export type BodySpec =
  | { type: "none" }
  | {
      type: "modal";
      modes: readonly (readonly [freq: number, t60: number, amp: number])[];
    }
  | {
      type: "radiation";
      highpass: number;
      presence?: { freq: number; q: number; gainDb: number };
    };

export interface BasePatch {
  id: BusId;
  name: string;
  range: readonly [low: number, high: number];
  outputGain: number;
  pan: { center: number; spread: number };
  body: BodySpec;
  params: readonly ParamSpec[];
}

export interface StringPatch extends BasePatch {
  id: InstrumentId;
  family: "string";
  exciter: "hammer" | "pick" | "finger";
  allocation: "key" | "string";
  polyphony: number;
  openStrings?: readonly number[];
  maxFret?: number;
  unison: KeyTable;
  unisonDetune: KeyTable;
  unisonDecay: readonly number[];
  polarization?: { detuneCents: number; decay: number; split: number };
  t60: KeyTable;
  brightness: KeyTable;
  dispersionStages: KeyTable;
  dispersionCoef: KeyTable;
  damperT60: KeyTable;
  noDamperAbove?: number;
  pickup?: number;
  hammerMass?: KeyTable;
}

export interface BorePatch extends BasePatch {
  id: InstrumentId;
  family: "bore";
  model: "flute" | "saxophone" | "brass";
  pressure: readonly [low: number, high: number];
  tuningCents: TuningTables;
}

export interface BowedPatch extends BasePatch {
  id: InstrumentId;
  family: "bowed";
  polyphony: number;
  tuningCents: TuningTables;
}

export type DrumPieceSpec =
  | {
      model: "membrane";
      f0: number;
      ratios: number;
      t60: readonly number[];
      pitchDrop: number;
      pitchTau: number;
      stick: readonly [soft: number, hard: number];
      click?: { highpass: number; length: number; level: number };
      wires?: { level: number; highpass: number; release: number };
      shell?: readonly [freq: number, t60: number, amp: number];
      level: number;
      pan: number;
    }
  | {
      model: "metal";
      modes:
        | {
            kind: "seeded";
            seed: number;
            count: number;
            low: number;
            high: number;
          }
        | { kind: "table"; freqs: readonly number[]; amps: readonly number[] };
      t60: number;
      noise?: { highpass: number; decay: number; level: number };
      stick: readonly [soft: number, hard: number];
      chokes?: readonly DrumPieceId[];
      level: number;
      pan: number;
    }
  | {
      // A membrane loaded with paste (tabla syahi, madal kharee), whose modes
      // sit near whole-number ratios; each stroke sets its own partials.
      model: "loaded";
      f0: number;
      partials: readonly (readonly [ratio: number, t60: number, amp: number])[];
      pitchDrop?: number;
      pitchTau?: number;
      stick: readonly [soft: number, hard: number];
      click?: { highpass: number; length: number; level: number };
      level: number;
      pan: number;
    }
  | {
      // Two or more strokes played together, e.g. Dha = Na + Ge, each scaled
      // by level so the sum peaks like a single stroke.
      model: "combo";
      pieces: readonly DrumPieceId[];
      level: number;
    }
  | {
      model: "noise";
      bursts: readonly number[];
      burstLength: number;
      tailStart: number;
      tailDecay: number;
      bandpass: readonly [freq: number, q: number];
      level: number;
      pan: number;
    };

export interface DrumKitPatch extends BasePatch {
  id: KitId;
  family: "drums";
  pieces: Readonly<Partial<Record<DrumPieceId, DrumPieceSpec>>>;
  // The piece each keybed pitch class plays, from C.
  keys: readonly DrumPieceId[];
}

// Not a physical model: band-limited oscillators through a lowpass and a gate.
export interface OscillatorPatch extends BasePatch {
  id: InstrumentId;
  family: "oscillator";
  polyphony: number;
}

export type Patch =
  StringPatch | BorePatch | BowedPatch | DrumKitPatch | OscillatorPatch;
