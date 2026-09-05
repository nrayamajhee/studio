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

export const TOTAL_OCTAVES = 10;
export const ACTIVE_STEPS = 16;
export const GROUP_SIZE = 4;
export const ROW_HEIGHT = 32;

export function generate10OctavesNotes(): NoteInfo[] {
  const notes: NoteInfo[] = [];

  for (let octave = TOTAL_OCTAVES; octave >= 1; octave--) {
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
  if (midi < 12 || midi > 127) return null;
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

export interface PatternPreset {
  id: string;
  name: string;
  category: "melodic" | "drum" | "chord" | "bass";
  notes: string[];
}

export const PATTERN_PRESETS: PatternPreset[] = [
  {
    id: "arpeggio_ascent",
    name: "Arpeggio Ascent",
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
  {
    id: "four_on_floor",
    name: "Four on the Floor",
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
    ],
  },
  {
    id: "trap_808_roll",
    name: "Trap 808 & Hats",
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
      "G1-14",
      "G1-15",
    ],
  },
  {
    id: "neo_soul_chords",
    name: "Neo-Soul Chords",
    category: "chord",
    notes: [
      "C4-0",
      "E4-0",
      "G4-0",
      "B4-0",
      "A3-4",
      "C4-4",
      "E4-4",
      "G4-4",
      "F3-8",
      "A3-8",
      "C4-8",
      "E4-8",
      "G3-12",
      "B3-12",
      "D4-12",
      "F4-12",
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
    id: "lofi_chill",
    name: "Lo-Fi Melody",
    category: "melodic",
    notes: ["E4-0", "G4-3", "B4-6", "D5-8", "B4-11", "G4-14"],
  },
  {
    id: "pentatonic_riff",
    name: "Pentatonic Riff",
    category: "melodic",
    notes: [
      "C4-0",
      "D4-2",
      "E4-4",
      "G4-6",
      "A4-8",
      "C5-10",
      "A4-12",
      "G4-14",
    ],
  },
];

