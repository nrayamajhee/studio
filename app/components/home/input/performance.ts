export interface HeldKey {
  semitones: number[];
  midis: number[];
  // Releases the key's notes, and stops its chord's pattern.
  stop: () => void;
}
