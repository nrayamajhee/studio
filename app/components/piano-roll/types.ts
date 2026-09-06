export interface NoteInfo {
  id: string;
  name: string;
  octave: number;
  fullName: string;
  isBlack: boolean;
  isC: boolean;
}

export const NOTE_NAMES = [
  "B",
  "A#",
  "A",
  "G#",
  "G",
  "F#",
  "F",
  "E",
  "D#",
  "D",
  "C#",
  "C",
] as const;

export const WHITE_KEY_NAMES = ["C", "D", "E", "F", "G", "A", "B"] as const;

export const BLACK_NOTES = new Set(["A#", "G#", "F#", "D#", "C#"]);

export const HORIZONTAL_BLACK_KEYS = [
  { name: "C#", seamIndex: 1 },
  { name: "D#", seamIndex: 2 },
  { name: "F#", seamIndex: 4 },
  { name: "G#", seamIndex: 5 },
  { name: "A#", seamIndex: 6 },
] as const;

export const VERTICAL_WHITE_KEYS = [
  { name: "B", group: "upper", indexInGroup: 0 },
  { name: "A", group: "upper", indexInGroup: 1 },
  { name: "G", group: "upper", indexInGroup: 2 },
  { name: "F", group: "upper", indexInGroup: 3 },
  { name: "E", group: "lower", indexInGroup: 0 },
  { name: "D", group: "lower", indexInGroup: 1 },
  { name: "C", group: "lower", indexInGroup: 2 },
] as const;

export const VERTICAL_BLACK_KEYS = [
  { name: "A#", rowIndex: 1 },
  { name: "G#", rowIndex: 3 },
  { name: "F#", rowIndex: 5 },
  { name: "D#", rowIndex: 8 },
  { name: "C#", rowIndex: 10 },
] as const;

export const MIN_OCTAVE = 0;
export const MAX_OCTAVE = 10;
export const TOTAL_OCTAVES = MAX_OCTAVE - MIN_OCTAVE + 1;
export const ACTIVE_STEPS = 16;
export const GROUP_SIZE = 4;
export const ROW_HEIGHT = 32;

export function generate10OctavesNotes(): NoteInfo[] {
  const notes: NoteInfo[] = [];

  for (let octave = MAX_OCTAVE; octave >= MIN_OCTAVE; octave--) {
    for (const name of NOTE_NAMES) {
      const isBlack = BLACK_NOTES.has(name);
      const isC = name === "C";
      const fullName = `${name}${octave}`;

      notes.push({
        id: `${octave}-${name}`,
        name,
        octave,
        fullName,
        isBlack,
        isC,
      });
    }
  }

  return notes;
}

const SEMITONE_MAP: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export function noteToMidi(noteName: string): number | null {
  const match = noteName.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return null;
  const name = match[1].toUpperCase();
  const octave = parseInt(match[2], 10);
  const semitone = SEMITONE_MAP[name];
  if (semitone === undefined) return null;
  return (octave + 1) * 12 + semitone;
}

export function noteToFrequency(noteName: string): number | null {
  const midi = noteToMidi(noteName);
  if (midi === null) return null;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

let audioContextInstance: AudioContext | null = null;

export function playNoteSound(noteName: string, duration = 0.35): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioContextInstance) {
      audioContextInstance = new AudioCtx();
    }
    if (audioContextInstance.state === "suspended") {
      audioContextInstance.resume();
    }
    const freq = noteToFrequency(noteName);
    if (!freq) return;

    const osc = audioContextInstance.createOscillator();
    const gain = audioContextInstance.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, audioContextInstance.currentTime);

    const now = audioContextInstance.currentTime;
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(audioContextInstance.destination);

    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Audio playback fallback
  }
}

export const MIDI_NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export function midiToNote(midi: number): string | null {
  if (midi < 12 || midi > 143) return null;
  const semitone = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${MIDI_NOTE_NAMES[semitone]}${octave}`;
}

export function transposeNote(noteName: string, semitones: number): string {
  const midi = noteToMidi(noteName);
  if (midi === null) return noteName;
  const transposed = midiToNote(midi + semitones);
  return transposed || noteName;
}

export interface PresetJumpConfig {
  defaultOctave: number;
  octaves: number[];
}

export const PRESET_JUMP_CONFIGS: Record<string, PresetJumpConfig> = {
  grand_piano: { defaultOctave: 4, octaves: [3, 4, 5] },
  piano: { defaultOctave: 4, octaves: [3, 4, 5] },
  electronic_pino: { defaultOctave: 4, octaves: [3, 4, 5] },
  acoustic_guitar: { defaultOctave: 3, octaves: [2, 3, 4] },
  guitar: { defaultOctave: 3, octaves: [2, 3, 4] },
  electric_guitar: { defaultOctave: 3, octaves: [2, 3, 4] },
  classical_guitar: { defaultOctave: 3, octaves: [2, 3, 4] },
  ukelele: { defaultOctave: 4, octaves: [3, 4] },
  base_guitar: { defaultOctave: 1, octaves: [1, 2, 3] },
  bass: { defaultOctave: 1, octaves: [1, 2, 3] },
  drum_set: { defaultOctave: 1, octaves: [1, 2] },
  drums: { defaultOctave: 1, octaves: [1, 2] },
  drum_808: { defaultOctave: 1, octaves: [1, 2] },
  trap_kit: { defaultOctave: 1, octaves: [1, 2] },
  electronic_drums: { defaultOctave: 1, octaves: [1, 2] },
  acoustic_percussion: { defaultOctave: 1, octaves: [1, 2] },
  flute: { defaultOctave: 4, octaves: [3, 4, 5] },
  saxophone: { defaultOctave: 4, octaves: [3, 4, 5] },
};

export function getPresetJumpConfig(presetKey?: string): PresetJumpConfig {
  if (!presetKey) return { defaultOctave: 4, octaves: [3, 4, 5] };
  const normalized = presetKey.toLowerCase().trim();
  return PRESET_JUMP_CONFIGS[normalized] || { defaultOctave: 4, octaves: [3, 4, 5] };
}

export function getTargetNoteForPreset(presetKey?: string): string {
  const config = getPresetJumpConfig(presetKey);
  return `C${config.defaultOctave}`;
}

export type ScaleType =
  | "chromatic"
  | "major"
  | "minor"
  | "harmonic_minor"
  | "pentatonic_major"
  | "pentatonic_minor"
  | "blues"
  | "dorian";

export const SCALES: Record<ScaleType, { name: string; intervals: number[] }> = {
  chromatic: {
    name: "Chromatic (All)",
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  major: {
    name: "Major (Ionian)",
    intervals: [0, 2, 4, 5, 7, 9, 11],
  },
  minor: {
    name: "Natural Minor",
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  harmonic_minor: {
    name: "Harmonic Minor",
    intervals: [0, 2, 3, 5, 7, 8, 11],
  },
  pentatonic_major: {
    name: "Pentatonic Major",
    intervals: [0, 2, 4, 7, 9],
  },
  pentatonic_minor: {
    name: "Pentatonic Minor",
    intervals: [0, 3, 5, 7, 10],
  },
  blues: {
    name: "Blues",
    intervals: [0, 3, 5, 6, 7, 10],
  },
  dorian: {
    name: "Dorian",
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
};

export const ROOT_KEYS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export function isNoteInKey(
  notePitch: string,
  rootKey: string,
  scale: ScaleType,
): boolean {
  if (scale === "chromatic") return true;
  const rootIndex = ROOT_KEYS.indexOf(rootKey as (typeof ROOT_KEYS)[number]);
  const noteIndex = ROOT_KEYS.indexOf(notePitch as (typeof ROOT_KEYS)[number]);
  if (rootIndex === -1 || noteIndex === -1) return true;
  const interval = (noteIndex - rootIndex + 12) % 12;
  return SCALES[scale].intervals.includes(interval);
}

export type ChordQuality = "Major" | "Minor";

export interface ProgressionStep {
  roman: string;
  offset: number; // semitones from tonic pitch class (0-11)
  quality: ChordQuality;
  degreeLabel: string;
}

export interface ProgressionDefinition {
  id: string;
  name: string;
  subtitle: string;
  pattern: string;
  steps: ProgressionStep[];
  description: string;
  exampleInC: string;
  songs: string[];
  category: "Major" | "Minor" | "Modal";
  bpmDefault: number;
}

export const PROGRESSION_DEFINITIONS: ProgressionDefinition[] = [
  {
    id: "axis",
    name: "Axis Progression",
    subtitle: "Famous 4 Chords of Pop",
    pattern: "I – V – vi – IV",
    steps: [
      { roman: "I", offset: 0, quality: "Major", degreeLabel: "I" },
      { roman: "V", offset: 7, quality: "Major", degreeLabel: "V" },
      { roman: "vi", offset: 9, quality: "Minor", degreeLabel: "vi" },
      { roman: "IV", offset: 5, quality: "Major", degreeLabel: "IV" },
    ],
    description:
      "Looping endless pop tension/resolution. The most recognizable progression.",
    exampleInC: "C – G – Am – F",
    songs: ["Let It Be", "Someone Like You", "Don't Stop Believin'"],
    category: "Major",
    bpmDefault: 96,
  },
  {
    id: "minor-4chord",
    name: "Minor 4-Chord",
    subtitle: "Rotated Axis",
    pattern: "vi – IV – I – V",
    steps: [
      { roman: "vi", offset: 9, quality: "Minor", degreeLabel: "vi" },
      { roman: "IV", offset: 5, quality: "Major", degreeLabel: "IV" },
      { roman: "I", offset: 0, quality: "Major", degreeLabel: "I" },
      { roman: "V", offset: 7, quality: "Major", degreeLabel: "V" },
    ],
    description:
      "Same chords as Axis starting on vi — darker, dramatic minor feel.",
    exampleInC: "Am – F – C – G",
    songs: ["Africa (Toto)"],
    category: "Minor",
    bpmDefault: 92,
  },
  {
    id: "andalusian",
    name: "Andalusian Cadence",
    subtitle: "Flamenco Descending",
    pattern: "i – ♭VII – ♭VI – V",
    steps: [
      { roman: "i", offset: 0, quality: "Minor", degreeLabel: "i" },
      { roman: "♭VII", offset: 10, quality: "Major", degreeLabel: "♭VII" },
      { roman: "♭VI", offset: 8, quality: "Major", degreeLabel: "♭VI" },
      { roman: "V", offset: 7, quality: "Major", degreeLabel: "V" },
    ],
    description:
      "Spanish flamenco descending bassline with dramatic pull home via major V.",
    exampleInC: "Cm – B♭ – A♭ – G",
    songs: ["Hit the Road Jack", "Happy Together", "Runaway"],
    category: "Minor",
    bpmDefault: 100,
  },
  {
    id: "aeolian-vamp",
    name: "Aeolian Vamp",
    subtitle: "Floatier Andalusian",
    pattern: "i – ♭VII – ♭VI – ♭VII",
    steps: [
      { roman: "i", offset: 0, quality: "Minor", degreeLabel: "i" },
      { roman: "♭VII", offset: 10, quality: "Major", degreeLabel: "♭VII" },
      { roman: "♭VI", offset: 8, quality: "Major", degreeLabel: "♭VI" },
      { roman: "♭VII", offset: 10, quality: "Major", degreeLabel: "♭VII" },
    ],
    description:
      "Like Andalusian but avoids dominant V — floatier, no hard pull home.",
    exampleInC: "Cm – B♭ – A♭ – B♭",
    songs: ["Rolling in the Deep", "In the Air Tonight"],
    category: "Minor",
    bpmDefault: 88,
  },
  {
    id: "doowop",
    name: "Doo-Wop Changes",
    subtitle: "50s Progression",
    pattern: "I – vi – IV – V",
    steps: [
      { roman: "I", offset: 0, quality: "Major", degreeLabel: "I" },
      { roman: "vi", offset: 9, quality: "Minor", degreeLabel: "vi" },
      { roman: "IV", offset: 5, quality: "Major", degreeLabel: "IV" },
      { roman: "V", offset: 7, quality: "Major", degreeLabel: "V" },
    ],
    description:
      "Simple journey away and back. Staple of 50s doo-wop, still everywhere.",
    exampleInC: "C – Am – F – G",
    songs: ["I Will Always Love You", "Earth Angel", "Baby"],
    category: "Major",
    bpmDefault: 96,
  },
  {
    id: "major-1-5-4-5",
    name: "I–V–IV–V",
    subtitle: "Upbeat Major",
    pattern: "I – V – IV – V",
    steps: [
      { roman: "I", offset: 0, quality: "Major", degreeLabel: "I" },
      { roman: "V", offset: 7, quality: "Major", degreeLabel: "V" },
      { roman: "IV", offset: 5, quality: "Major", degreeLabel: "IV" },
      { roman: "V", offset: 7, quality: "Major", degreeLabel: "V" },
    ],
    description: "All major I/V/IV — happy, upbeat rock & pop bed.",
    exampleInC: "C – G – F – G",
    songs: ["Walking on Sunshine", "Brown Eyed Girl"],
    category: "Major",
    bpmDefault: 112,
  },
  {
    id: "mixolydian-vamp",
    name: "Mixolydian Vamp",
    subtitle: "♭VII Epic Open",
    pattern: "I – ♭VII – IV – I",
    steps: [
      { roman: "I", offset: 0, quality: "Major", degreeLabel: "I" },
      { roman: "♭VII", offset: 10, quality: "Major", degreeLabel: "♭VII" },
      { roman: "IV", offset: 5, quality: "Major", degreeLabel: "IV" },
      { roman: "I", offset: 0, quality: "Major", degreeLabel: "I" },
    ],
    description:
      "Flattened 7th gives Mixolydian epic open circle-of-fifths feel.",
    exampleInC: "C – B♭ – F – C",
    songs: ["Royals", "Freedom! '90"],
    category: "Modal",
    bpmDefault: 90,
  },
];

export interface PatternPreset {
  id: string;
  name: string;
  category: "chord" | "melodic" | "drum" | "bass";
  notes: string[];
}

export const PATTERN_PRESETS: PatternPreset[] = [
  {
    id: "axis",
    name: "Axis (I – V – vi – IV)",
    category: "chord",
    notes: [
      "C3-0",
      "C4-0",
      "E4-0",
      "G4-0",
      "C4-2",
      "E4-2",
      "G4-2",
      "G2-4",
      "G3-4",
      "B3-4",
      "D4-4",
      "G3-6",
      "B3-6",
      "D4-6",
      "A2-8",
      "A3-8",
      "C4-8",
      "E4-8",
      "A3-10",
      "C4-10",
      "E4-10",
      "F2-12",
      "F3-12",
      "A3-12",
      "C4-12",
      "F3-14",
      "A3-14",
      "C4-14",
    ],
  },
  {
    id: "minor-4chord",
    name: "Minor 4-Chord (vi – IV – I – V)",
    category: "chord",
    notes: [
      "A2-0",
      "A3-0",
      "C4-0",
      "E4-0",
      "A3-2",
      "C4-2",
      "E4-2",
      "F2-4",
      "F3-4",
      "A3-4",
      "C4-4",
      "F3-6",
      "A3-6",
      "C4-6",
      "C3-8",
      "C4-8",
      "E4-8",
      "G4-8",
      "C4-10",
      "E4-10",
      "G4-10",
      "G2-12",
      "G3-12",
      "B3-12",
      "D4-12",
      "G3-14",
      "B3-14",
      "D4-14",
    ],
  },
  {
    id: "andalusian",
    name: "Andalusian (i – ♭VII – ♭VI – V)",
    category: "chord",
    notes: [
      "C3-0",
      "C4-0",
      "D#4-0",
      "G4-0",
      "C4-2",
      "D#4-2",
      "G4-2",
      "A#2-4",
      "A#3-4",
      "D4-4",
      "F4-4",
      "A#3-6",
      "D4-6",
      "F4-6",
      "G#2-8",
      "G#3-8",
      "C4-8",
      "D#4-8",
      "G#3-10",
      "C4-10",
      "D#4-10",
      "G2-12",
      "G3-12",
      "B3-12",
      "D4-12",
      "G3-14",
      "B3-14",
      "D4-14",
    ],
  },
  {
    id: "aeolian-vamp",
    name: "Aeolian Vamp (i – ♭VII – ♭VI – ♭VII)",
    category: "chord",
    notes: [
      "C3-0",
      "C4-0",
      "D#4-0",
      "G4-0",
      "C4-2",
      "D#4-2",
      "G4-2",
      "A#2-4",
      "A#3-4",
      "D4-4",
      "F4-4",
      "A#3-6",
      "D4-6",
      "F4-6",
      "G#2-8",
      "G#3-8",
      "C4-8",
      "D#4-8",
      "G#3-10",
      "C4-10",
      "D#4-10",
      "A#2-12",
      "A#3-12",
      "D4-12",
      "F4-12",
      "A#3-14",
      "D4-14",
      "F4-14",
    ],
  },
  {
    id: "doowop",
    name: "Doo-Wop (I – vi – IV – V)",
    category: "chord",
    notes: [
      "C3-0",
      "C4-0",
      "E4-0",
      "G4-0",
      "C4-2",
      "E4-2",
      "G4-2",
      "A2-4",
      "A3-4",
      "C4-4",
      "E4-4",
      "A3-6",
      "C4-6",
      "E4-6",
      "F2-8",
      "F3-8",
      "A3-8",
      "C4-8",
      "F3-10",
      "A3-10",
      "C4-10",
      "G2-12",
      "G3-12",
      "B3-12",
      "D4-12",
      "G3-14",
      "B3-14",
      "D4-14",
    ],
  },
  {
    id: "major-1-5-4-5",
    name: "Upbeat Major (I – V – IV – V)",
    category: "chord",
    notes: [
      "C3-0",
      "C4-0",
      "E4-0",
      "G4-0",
      "C4-2",
      "E4-2",
      "G4-2",
      "G2-4",
      "G3-4",
      "B3-4",
      "D4-4",
      "G3-6",
      "B3-6",
      "D4-6",
      "F2-8",
      "F3-8",
      "A3-8",
      "C4-8",
      "F3-10",
      "A3-10",
      "C4-10",
      "G2-12",
      "G3-12",
      "B3-12",
      "D4-12",
      "G3-14",
      "B3-14",
      "D4-14",
    ],
  },
  {
    id: "mixolydian-vamp",
    name: "Mixolydian (I – ♭VII – IV – I)",
    category: "chord",
    notes: [
      "C3-0",
      "C4-0",
      "E4-0",
      "G4-0",
      "C4-2",
      "E4-2",
      "G4-2",
      "A#2-4",
      "A#3-4",
      "D4-4",
      "F4-4",
      "A#3-6",
      "D4-6",
      "F4-6",
      "F2-8",
      "F3-8",
      "A3-8",
      "C4-8",
      "F3-10",
      "A3-10",
      "C4-10",
      "C3-12",
      "C4-12",
      "E4-12",
      "G4-12",
      "C4-14",
      "E4-14",
      "G4-14",
    ],
  },
  {
    id: "jazz_251",
    name: "Jazz ii – V – I (Dm7 – G7 – Cmaj7)",
    category: "chord",
    notes: [
      "D3-0",
      "F3-0",
      "A3-0",
      "C4-0",
      "F3-2",
      "A3-2",
      "C4-2",
      "G2-4",
      "B3-4",
      "D4-4",
      "F4-4",
      "B3-6",
      "D4-6",
      "F4-6",
      "C3-8",
      "E3-8",
      "G3-8",
      "B3-8",
      "E3-10",
      "G3-10",
      "B3-10",
      "C3-12",
      "E3-12",
      "G3-12",
      "B3-12",
    ],
  },
  {
    id: "four_on_floor",
    name: "Four on the Floor (House / EDM)",
    category: "drum",
    notes: [
      "C1-0",
      "C1-4",
      "C1-8",
      "C1-12",
      "G1-2",
      "G1-6",
      "G1-10",
      "G1-14",
      "D1-4",
      "D1-12",
      "G#1-2",
      "G#1-6",
      "G#1-10",
      "G#1-14",
    ],
  },
  {
    id: "trap_808_roll",
    name: "Trap 808 & Rolling Hats",
    category: "drum",
    notes: [
      "C1-0",
      "C1-6",
      "C1-10",
      "D1-4",
      "D1-12",
      "G1-0",
      "G1-2",
      "G1-4",
      "G1-6",
      "G1-8",
      "G1-10",
      "G1-12",
      "G1-13",
      "G1-14",
      "G1-15",
    ],
  },
  {
    id: "boom_bap",
    name: "Boom Bap 90s Groove",
    category: "drum",
    notes: [
      "C1-0",
      "C1-3",
      "C1-10",
      "C1-11",
      "D1-4",
      "D1-12",
      "G1-0",
      "G1-2",
      "G1-4",
      "G1-6",
      "G1-8",
      "G1-10",
      "G1-12",
      "G1-14",
    ],
  },
  {
    id: "rock_beat",
    name: "Rock Driving Beat",
    category: "drum",
    notes: [
      "C1-0",
      "C1-8",
      "C1-10",
      "D1-4",
      "D1-12",
      "G1-0",
      "G1-2",
      "G1-4",
      "G1-6",
      "G1-8",
      "G1-10",
      "G1-12",
      "G1-14",
      "C#2-0",
    ],
  },
  {
    id: "reggaeton_dembow",
    name: "Reggaeton / Dembow",
    category: "drum",
    notes: [
      "C1-0",
      "C1-4",
      "C1-8",
      "C1-12",
      "D1-3",
      "D1-6",
      "D1-11",
      "D1-14",
      "G1-0",
      "G1-2",
      "G1-4",
      "G1-6",
      "G1-8",
      "G1-10",
      "G1-12",
      "G1-14",
    ],
  },
  {
    id: "cyberpunk_bass",
    name: "Cyberpunk Bassline",
    category: "bass",
    notes: [
      "C2-0",
      "C2-2",
      "C2-3",
      "D#2-6",
      "F2-8",
      "F2-10",
      "G2-12",
      "A#2-14",
    ],
  },
  {
    id: "arpeggio_ascent",
    name: "Arpeggio Ascent (Melody)",
    category: "melodic",
    notes: [
      "C4-0",
      "E4-2",
      "G4-4",
      "B4-6",
      "C5-8",
      "G4-10",
      "E4-12",
      "C4-14",
    ],
  },
];

export const PIANO_PATTERN_PRESETS = PATTERN_PRESETS.filter(
  (p) => p.category !== "drum",
);

export const DRUM_PATTERN_PRESETS = PATTERN_PRESETS.filter(
  (p) => p.category === "drum",
);

