import { NOTE_NAMES } from './synthEngine';

export type ChordQuality = 'Major' | 'Minor';

export interface ProgressionStep {
  roman: string;
  offset: number; // semitones from tonic pitch class (0-11)
  quality: ChordQuality;
  degreeLabel: string; // e.g. "I", "vi", "♭VII"
}

export interface ProgressionDefinition {
  id: string;
  name: string;
  subtitle: string;
  pattern: string; // e.g. "I – V – vi – IV"
  steps: ProgressionStep[];
  description: string;
  exampleInC: string; // display example in C
  songs: string[];
  color: string; // tailwind accent hint
  category: 'Major' | 'Minor' | 'Modal';
  bpmDefault: number;
}

// 7 progressions from David Bennett video
export const PROGRESSION_DEFINITIONS: ProgressionDefinition[] = [
  {
    id: 'axis',
    name: 'Axis Progression',
    subtitle: 'Famous 4 Chords of Pop',
    pattern: 'I – V – vi – IV',
    steps: [
      { roman: 'I', offset: 0, quality: 'Major', degreeLabel: 'I' },
      { roman: 'V', offset: 7, quality: 'Major', degreeLabel: 'V' },
      { roman: 'vi', offset: 9, quality: 'Minor', degreeLabel: 'vi' },
      { roman: 'IV', offset: 5, quality: 'Major', degreeLabel: 'IV' },
    ],
    description: 'Looping endless pop tension/resolution. The most recognizable progression.',
    exampleInC: 'C – G – Am – F',
    songs: ['Let It Be', 'Someone Like You', "Don't Stop Believin'"],
    color: 'cyan',
    category: 'Major',
    bpmDefault: 96,
  },
  {
    id: 'minor-4chord',
    name: 'Minor 4-Chord',
    subtitle: 'Rotated Axis',
    pattern: 'vi – IV – I – V',
    steps: [
      { roman: 'vi', offset: 9, quality: 'Minor', degreeLabel: 'vi' },
      { roman: 'IV', offset: 5, quality: 'Major', degreeLabel: 'IV' },
      { roman: 'I', offset: 0, quality: 'Major', degreeLabel: 'I' },
      { roman: 'V', offset: 7, quality: 'Major', degreeLabel: 'V' },
    ],
    description: 'Same chords as Axis starting on vi — darker, dramatic minor feel.',
    exampleInC: 'Am – F – C – G',
    songs: ['Africa (Toto)'],
    color: 'purple',
    category: 'Minor',
    bpmDefault: 92,
  },
  {
    id: 'andalusian',
    name: 'Andalusian Cadence',
    subtitle: 'Flamenco Descending',
    pattern: 'i – ♭VII – ♭VI – V',
    steps: [
      { roman: 'i', offset: 0, quality: 'Minor', degreeLabel: 'i' },
      { roman: '♭VII', offset: 10, quality: 'Major', degreeLabel: '♭VII' },
      { roman: '♭VI', offset: 8, quality: 'Major', degreeLabel: '♭VI' },
      { roman: 'V', offset: 7, quality: 'Major', degreeLabel: 'V' },
    ],
    description: 'Spanish flamenco descending bassline with dramatic pull home via major V.',
    exampleInC: 'Cm – B♭ – A♭ – G',
    songs: ['Hit the Road Jack', 'Happy Together', 'Runaway'],
    color: 'rose',
    category: 'Minor',
    bpmDefault: 100,
  },
  {
    id: 'aeolian-vamp',
    name: 'Aeolian Vamp',
    subtitle: 'Floatier Andalusian',
    pattern: 'i – ♭VII – ♭VI – ♭VII',
    steps: [
      { roman: 'i', offset: 0, quality: 'Minor', degreeLabel: 'i' },
      { roman: '♭VII', offset: 10, quality: 'Major', degreeLabel: '♭VII' },
      { roman: '♭VI', offset: 8, quality: 'Major', degreeLabel: '♭VI' },
      { roman: '♭VII', offset: 10, quality: 'Major', degreeLabel: '♭VII' },
    ],
    description: 'Like Andalusian but avoids dominant V — floatier, no hard pull home.',
    exampleInC: 'Cm – B♭ – A♭ – B♭',
    songs: ['Rolling in the Deep', 'In the Air Tonight'],
    color: 'indigo',
    category: 'Minor',
    bpmDefault: 88,
  },
  {
    id: 'doowop',
    name: 'Doo-Wop Changes',
    subtitle: '50s Progression',
    pattern: 'I – vi – IV – V',
    steps: [
      { roman: 'I', offset: 0, quality: 'Major', degreeLabel: 'I' },
      { roman: 'vi', offset: 9, quality: 'Minor', degreeLabel: 'vi' },
      { roman: 'IV', offset: 5, quality: 'Major', degreeLabel: 'IV' },
      { roman: 'V', offset: 7, quality: 'Major', degreeLabel: 'V' },
    ],
    description: 'Simple journey away and back. Staple of 50s doo-wop, still everywhere.',
    exampleInC: 'C – Am – F – G',
    songs: ['I Will Always Love You', 'Earth Angel', 'Baby'],
    color: 'amber',
    category: 'Major',
    bpmDefault: 96,
  },
  {
    id: 'major-1-5-4-5',
    name: 'I–V–IV–V',
    subtitle: 'Upbeat Major',
    pattern: 'I – V – IV – V',
    steps: [
      { roman: 'I', offset: 0, quality: 'Major', degreeLabel: 'I' },
      { roman: 'V', offset: 7, quality: 'Major', degreeLabel: 'V' },
      { roman: 'IV', offset: 5, quality: 'Major', degreeLabel: 'IV' },
      { roman: 'V', offset: 7, quality: 'Major', degreeLabel: 'V' },
    ],
    description: 'All major I/V/IV — happy, upbeat rock & pop bed.',
    exampleInC: 'C – G – F – G',
    songs: ['Walking on Sunshine', 'Brown Eyed Girl'],
    color: 'emerald',
    category: 'Major',
    bpmDefault: 112,
  },
  {
    id: 'mixolydian-vamp',
    name: 'Mixolydian Vamp',
    subtitle: '♭VII Epic Open',
    pattern: 'I – ♭VII – IV – I',
    steps: [
      { roman: 'I', offset: 0, quality: 'Major', degreeLabel: 'I' },
      { roman: '♭VII', offset: 10, quality: 'Major', degreeLabel: '♭VII' },
      { roman: 'IV', offset: 5, quality: 'Major', degreeLabel: 'IV' },
      { roman: 'I', offset: 0, quality: 'Major', degreeLabel: 'I' },
    ],
    description: 'Flattened 7th gives Mixolydian epic open circle-of-fifths feel.',
    exampleInC: 'C – B♭ – F – C',
    songs: ['Royals', "Freedom! '90"],
    color: 'teal',
    category: 'Modal',
    bpmDefault: 90,
  },
];

export const TONIC_PITCH_CLASSES: { pitchClass: number; name: string; nameFlat: string; isSharp: boolean }[] = [
  { pitchClass: 0, name: 'C', nameFlat: 'C', isSharp: false },
  { pitchClass: 1, name: 'C#', nameFlat: 'D♭', isSharp: true },
  { pitchClass: 2, name: 'D', nameFlat: 'D', isSharp: false },
  { pitchClass: 3, name: 'D#', nameFlat: 'E♭', isSharp: true },
  { pitchClass: 4, name: 'E', nameFlat: 'E', isSharp: false },
  { pitchClass: 5, name: 'F', nameFlat: 'F', isSharp: false },
  { pitchClass: 6, name: 'F#', nameFlat: 'G♭', isSharp: true },
  { pitchClass: 7, name: 'G', nameFlat: 'G', isSharp: false },
  { pitchClass: 8, name: 'G#', nameFlat: 'A♭', isSharp: true },
  { pitchClass: 9, name: 'A', nameFlat: 'A', isSharp: false },
  { pitchClass: 10, name: 'A#', nameFlat: 'B♭', isSharp: true },
  { pitchClass: 11, name: 'B', nameFlat: 'B', isSharp: false },
];

export interface ProgressionChord {
  id: string;
  roman: string;
  degreeLabel: string;
  rootName: string;
  rootPitchClass: number;
  quality: ChordQuality;
  notesLabel: string; // e.g. "C • E • G"
  midiNotes: number[];
  chordName: string; // e.g. "C Maj" or "Am"
}

export function getProgressionChords(
  progressionId: string,
  tonicPitchClass: number,
  baseOctave: number
): ProgressionChord[] {
  const prog = PROGRESSION_DEFINITIONS.find((p) => p.id === progressionId);
  if (!prog) return [];
  return prog.steps.map((step, idx) => {
    const rootPitchClass = (tonicPitchClass + step.offset) % 12;
    const rootName = NOTE_NAMES[rootPitchClass];
    // keep chord near baseOctave: use octave offset if tonic+offset wraps
    const octaveShift = Math.floor((tonicPitchClass + step.offset) / 12);
    const rootMidi = (baseOctave + 1) * 12 + tonicPitchClass + step.offset;
    // triad
    const thirdOffset = step.quality === 'Major' ? 4 : 3;
    const fifthMidi = rootMidi + 7;
    const thirdMidi = rootMidi + thirdOffset;
    const thirdName = NOTE_NAMES[(rootPitchClass + thirdOffset) % 12];
    const fifthName = NOTE_NAMES[(rootPitchClass + 7) % 12];
    const notesLabel = `${rootName} • ${thirdName} • ${fifthName}`;
    const chordName = step.quality === 'Major' ? `${rootName}` : `${rootName}m`;
    return {
      id: `${progressionId}-${idx}-${rootPitchClass}-${step.roman}`,
      roman: step.roman,
      degreeLabel: step.degreeLabel,
      rootName,
      rootPitchClass,
      quality: step.quality,
      notesLabel,
      midiNotes: [rootMidi, thirdMidi, fifthMidi],
      chordName,
    };
  });
}

export function getTonicName(pitchClass: number): string {
  const t = TONIC_PITCH_CLASSES.find((t) => t.pitchClass === pitchClass);
  return t ? t.name : NOTE_NAMES[pitchClass % 12];
}
