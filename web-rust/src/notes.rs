//! Keybed geometry and note names. Plain Rust, so `cargo test` runs it natively.

/// The MIDI note of the keybed's first key at octave 0.
pub const F3_MIDI: u8 = 53;
/// Keys on the keybed, F3 to E5.
pub const KEYS: u8 = 24;
pub const WHITE_KEYS: [u8; 14] = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23];
pub const BLACK_KEYS: [u8; 10] = [1, 3, 5, 8, 10, 13, 15, 17, 20, 22];

const NOTE_NAMES: [&str; 12] = [
  "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B",
];

/// The note keybed `semitone` plays with the keybed shifted by `octave`.
pub fn midi(semitone: u8, octave: i8) -> u8 {
  (F3_MIDI as i16 + semitone as i16 + 12 * octave as i16) as u8
}

/// Scientific pitch octave, C4 = 60.
pub fn octave_of(midi: u8) -> i16 {
  midi as i16 / 12 - 1
}

/// The note's full name, as the screen shows it: `F♯3`.
pub fn note_name(midi: u8) -> String {
  format!("{}{}", NOTE_NAMES[midi as usize % 12], octave_of(midi))
}

/// The name engraved on a key: every C carries its octave, the rest only
/// their letter.
pub fn engraved(midi: u8) -> String {
  match NOTE_NAMES[midi as usize % 12] {
    "C" => note_name(midi),
    name => name.to_string(),
  }
}

/// The name a screen reader says: `F sharp 3`.
pub fn spoken(midi: u8) -> String {
  format!(
    "{} {}",
    NOTE_NAMES[midi as usize % 12].replace('♯', " sharp"),
    octave_of(midi)
  )
}

/// The white key a key sits on or, for a black key, the white key after it.
pub fn slot(semitone: u8) -> usize {
  WHITE_KEYS
    .iter()
    .take_while(|&&white| white < semitone)
    .count()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn keybed_spans_f3_to_e5() {
    assert_eq!(note_name(midi(0, 0)), "F3");
    assert_eq!(note_name(midi(KEYS - 1, 0)), "E5");
    assert_eq!(note_name(midi(7, 1)), "C5");
    assert_eq!(WHITE_KEYS.len() + BLACK_KEYS.len(), KEYS as usize);
  }

  #[test]
  fn names() {
    assert_eq!(engraved(60), "C4");
    assert_eq!(engraved(61), "C♯");
    assert_eq!(spoken(66), "F sharp 4");
  }

  #[test]
  fn black_keys_sit_before_the_next_white_key() {
    assert_eq!(slot(0), 0);
    assert_eq!(slot(1), 1);
    assert_eq!(slot(8), 5);
    assert_eq!(slot(23), 13);
  }
}
