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
