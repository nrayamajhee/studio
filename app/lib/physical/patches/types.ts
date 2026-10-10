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

// The modules an instrument's params are grouped into (see MODULE_LABELS).
export type SectionId =
  | "exciter"
  | "resonator"
  | "filter"
  | "body"
  | "output"
  | "envelope"
  | "vibrato"
  // The engine's own stages over every instrument: master ADSR, LFO, FX,
  // reverb and volume, apart from any instrument's modules.
  | "master";

export type ParamSpec = {
  id: string;
  label: string;
  section: SectionId;
  min: number;
  max: number;
  default: number;
  unit?: "Hz" | "s" | "%" | "cents" | "dB" | "st" | "oct" | "×" | "ms" | "°";
  scale?: "linear" | "log";
  primary?: boolean;
  // Named choices for an index param, e.g. the oscillator's wave.
  options?: readonly string[];
};

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

export type BasePatch = {
  id: BusId;
  name: string;
  range: readonly [low: number, high: number];
  outputGain: number;
  pan: { center: number; spread: number };
  body: BodySpec;
  params: readonly ParamSpec[];
};

export type StringPatch = {
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
  // A sitar's jawari bridge: the allpass coefficient while the string touches
  // it (scaled by the Jawari param) and how far the string swings first.
  jawari?: { contact: number; gap: number };
} & BasePatch;

export type BorePatch = {
  id: InstrumentId;
  family: "bore";
  model: "flute" | "saxophone" | "brass" | "clarinet";
  pressure: readonly [low: number, high: number];
  tuningCents: TuningTables;
} & BasePatch;

export type BowedPatch = {
  id: InstrumentId;
  family: "bowed";
  polyphony: number;
  tuningCents: TuningTables;
} & BasePatch;

// Wire brushes instead of a stick: the bristles land as a burst of noise that
// dies away over `length` ms, driving the modes, and `level` of it, highpassed,
// is heard as the brush's hiss.
export type DrumBrush = { length: number; highpass: number; level: number };

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
      brush?: DrumBrush;
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
      brush?: DrumBrush;
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
      // The tail swells in from silence until tailStart instead of starting
      // there, as a brush stirred across a head does.
      swell?: boolean;
      bandpass: readonly [freq: number, q: number];
      level: number;
      pan: number;
    };

export type DrumKitPatch = {
  id: KitId;
  family: "drums";
  pieces: Readonly<Partial<Record<DrumPieceId, DrumPieceSpec>>>;
  // The piece each keybed pitch class plays, from C.
  keys: readonly DrumPieceId[];
} & BasePatch;

// Not a physical model: one or two band-limited oscillators summed through a
// lowpass and a gate.
export type OscillatorPatch = {
  id: InstrumentId;
  family: "oscillator";
  polyphony: number;
} & BasePatch;

// Free reeds (harmonium, harmonica): per key, one or more reed tongues that
// swing through a slot, driven by bellows or breath pressure.
export type ReedPatch = {
  id: InstrumentId;
  family: "reed";
  polyphony: number;
  // Each reed on a key: its tuning off the note (cents) and level. A second
  // reed a few cents sharp beats against the first.
  reeds: readonly (readonly [cents: number, level: number])[];
  // Steady drive at velocity 0 and 1; above 1 the reed speaks, and the
  // higher it is, the wider and brighter it swings.
  pressure: readonly [low: number, high: number];
  // How fast a reed's swing dies away on its own (s); it speaks faster the
  // further the drive is above 1.
  settle: KeyTable;
  // How much less the reed opens on its way back through the slot (0 the same
  // both ways, odd harmonics only; 1 one way only).
  asymmetry: number;
  tuningCents: TuningTables;
} & BasePatch;

// Tuned percussion (xylophone, steel pan, kalimba): each key a set of modes
// at fixed ratios to the note, struck by a mallet or plucked by a thumb.
// Nothing damps them; every note rings until it fades.
export type BarPatch = {
  id: InstrumentId;
  family: "bar";
  strike: "mallet" | "thumb";
  polyphony: number;
  // Each mode: its ratio to the note, its level and its T60 (s) at C4.
  modes: readonly (readonly [ratio: number, level: number, t60: number])[];
  // How every mode's T60 scales across the range.
  decay: KeyTable;
  // How long the mallet or thumb stays on (ms), soft to hard: a shorter
  // contact reaches higher modes.
  contact: readonly [soft: number, hard: number];
} & BasePatch;

export type Patch =
  | StringPatch
  | BorePatch
  | BowedPatch
  | DrumKitPatch
  | OscillatorPatch
  | ReedPatch
  | BarPatch;
