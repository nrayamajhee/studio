// The chord palette the macro pads can be set to, most used first. Intervals
// are semitones from the root, so a chord transposes to whatever key is played.
export interface Chord {
  id: string;
  // The full name, shown in the palette.
  name: string;
  // The short label, shown on the macro pad.
  label: string;
  intervals: readonly number[];
}

export const CHORD_PALETTE: readonly Chord[] = [
  { id: "maj", name: "Major", label: "Maj", intervals: [0, 4, 7] },
  { id: "min", name: "Minor", label: "Min", intervals: [0, 3, 7] },
  { id: "7", name: "Dominant 7", label: "7", intervals: [0, 4, 7, 10] },
  { id: "min7", name: "Minor 7", label: "Min7", intervals: [0, 3, 7, 10] },
  { id: "maj7", name: "Major 7", label: "Maj7", intervals: [0, 4, 7, 11] },
  { id: "sus4", name: "Suspended 4", label: "Sus4", intervals: [0, 5, 7] },
  { id: "sus2", name: "Suspended 2", label: "Sus2", intervals: [0, 2, 7] },
  { id: "add9", name: "Add 9", label: "Add9", intervals: [0, 4, 7, 14] },
  { id: "6", name: "Major 6", label: "6", intervals: [0, 4, 7, 9] },
  { id: "min6", name: "Minor 6", label: "Min6", intervals: [0, 3, 7, 9] },
  { id: "9", name: "Dominant 9", label: "9", intervals: [0, 4, 7, 10, 14] },
  { id: "min9", name: "Minor 9", label: "Min9", intervals: [0, 3, 7, 10, 14] },
  { id: "maj9", name: "Major 9", label: "Maj9", intervals: [0, 4, 7, 11, 14] },
  { id: "5", name: "Power", label: "5", intervals: [0, 7] },
  { id: "dim", name: "Diminished", label: "Dim", intervals: [0, 3, 6] },
  { id: "aug", name: "Augmented", label: "Aug", intervals: [0, 4, 8] },
  {
    id: "m7b5",
    name: "Half Diminished",
    label: "m7♭5",
    intervals: [0, 3, 6, 10],
  },
  { id: "dim7", name: "Diminished 7", label: "Dim7", intervals: [0, 3, 6, 9] },
  {
    id: "minMaj7",
    name: "Minor Major 7",
    label: "mMaj7",
    intervals: [0, 3, 7, 11],
  },
  {
    id: "7sus4",
    name: "Dominant 7 sus4",
    label: "7sus4",
    intervals: [0, 5, 7, 10],
  },
  { id: "7b5", name: "Dominant 7 ♭5", label: "7♭5", intervals: [0, 4, 6, 10] },
  { id: "7s5", name: "Dominant 7 ♯5", label: "7♯5", intervals: [0, 4, 8, 10] },
  {
    id: "7b9",
    name: "Dominant 7 ♭9",
    label: "7♭9",
    intervals: [0, 4, 7, 10, 13],
  },
  {
    id: "7s9",
    name: "Dominant 7 ♯9",
    label: "7♯9",
    intervals: [0, 4, 7, 10, 15],
  },
  { id: "69", name: "Six Nine", label: "6/9", intervals: [0, 4, 7, 9, 14] },
  {
    id: "min69",
    name: "Minor Six Nine",
    label: "m6/9",
    intervals: [0, 3, 7, 9, 14],
  },
  {
    id: "minAdd9",
    name: "Minor Add 9",
    label: "mAdd9",
    intervals: [0, 3, 7, 14],
  },
  {
    id: "11",
    name: "Dominant 11",
    label: "11",
    intervals: [0, 4, 7, 10, 14, 17],
  },
  {
    id: "min11",
    name: "Minor 11",
    label: "Min11",
    intervals: [0, 3, 7, 10, 14, 17],
  },
  {
    id: "maj11",
    name: "Major 11",
    label: "Maj11",
    intervals: [0, 4, 7, 11, 14, 17],
  },
  {
    id: "13",
    name: "Dominant 13",
    label: "13",
    intervals: [0, 4, 7, 10, 14, 21],
  },
  {
    id: "min13",
    name: "Minor 13",
    label: "Min13",
    intervals: [0, 3, 7, 10, 14, 21],
  },
  {
    id: "maj13",
    name: "Major 13",
    label: "Maj13",
    intervals: [0, 4, 7, 11, 14, 21],
  },
  {
    id: "maj7s11",
    name: "Major 7 ♯11",
    label: "Maj7♯11",
    intervals: [0, 4, 7, 11, 18],
  },
  {
    id: "7s11",
    name: "Dominant 7 ♯11",
    label: "7♯11",
    intervals: [0, 4, 7, 10, 18],
  },
  { id: "min7s5", name: "Minor 7 ♯5", label: "m7♯5", intervals: [0, 3, 8, 10] },
  {
    id: "maj7b5",
    name: "Major 7 ♭5",
    label: "Maj7♭5",
    intervals: [0, 4, 6, 11],
  },
  {
    id: "minMaj9",
    name: "Minor Major 9",
    label: "mMaj9",
    intervals: [0, 3, 7, 11, 14],
  },
  { id: "add11", name: "Add 11", label: "Add11", intervals: [0, 4, 7, 17] },
  {
    id: "9sus4",
    name: "Dominant 9 sus4",
    label: "9sus4",
    intervals: [0, 5, 7, 10, 14],
  },
  {
    id: "7b13",
    name: "Dominant 7 ♭13",
    label: "7♭13",
    intervals: [0, 4, 7, 10, 20],
  },
  {
    id: "sus4add9",
    name: "Suspended 4 Add 9",
    label: "Sus4♭9",
    intervals: [0, 5, 7, 14],
  },
  { id: "quartal", name: "Quartal", label: "Quart", intervals: [0, 5, 10] },
  {
    id: "dimMaj7",
    name: "Diminished Major 7",
    label: "DimMaj7",
    intervals: [0, 3, 6, 11],
  },
  { id: "majb5", name: "Major ♭5", label: "Maj♭5", intervals: [0, 4, 6] },
  { id: "minb6", name: "Minor ♭6", label: "Min♭6", intervals: [0, 3, 8] },
  {
    id: "min9b5",
    name: "Minor 9 ♭5",
    label: "m9♭5",
    intervals: [0, 3, 6, 10, 14],
  },
  {
    id: "7sus2",
    name: "Dominant 7 sus2",
    label: "7sus2",
    intervals: [0, 2, 7, 10],
  },
];

export const chordById = (id: string): Chord =>
  CHORD_PALETTE.find((chord) => chord.id === id) ?? CHORD_PALETTE[0];

// The four macros start on the most used chords, from the right: the right
// hand rests its pinky on major and ring finger on minor, while the left
// plays the keys.
export const DEFAULT_CHORD_MACROS: readonly string[] = [
  "min7",
  "7",
  "min",
  "maj",
];
