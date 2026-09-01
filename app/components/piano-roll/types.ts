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

export const BLACK_NOTES = new Set(["A#", "G#", "F#", "D#", "C#"]);

export const TOTAL_OCTAVES = 10;
export const ACTIVE_STEPS = 16;
export const GROUP_SIZE = 4;

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
