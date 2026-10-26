//! The computer keyboard's keys on the Device, by `KeyboardEvent.code`.
//!
//! The same layout as web-react's `keymap.ts`: the piano takes the home row,
//! white keys F3–B4 along A S D F G H J K L ; ' and each black key on the row
//! above between its neighbours (W E R, Y U, O P [). Held with Shift, the
//! row's last five keys carry on past B4 to E5.

use crate::notes::KEYS;

const NOTE_KEYS: [(&str, &str); 19] = [
  ("KeyA", "A"),
  ("KeyW", "W"),
  ("KeyS", "S"),
  ("KeyE", "E"),
  ("KeyD", "D"),
  ("KeyR", "R"),
  ("KeyF", "F"),
  ("KeyG", "G"),
  ("KeyY", "Y"),
  ("KeyH", "H"),
  ("KeyU", "U"),
  ("KeyJ", "J"),
  ("KeyK", "K"),
  ("KeyO", "O"),
  ("KeyL", "L"),
  ("KeyP", "P"),
  ("Semicolon", ";"),
  ("BracketLeft", "["),
  ("Quote", "'"),
];

/// The notes Shift adds past the home row's last key.
pub const SHIFT_NOTES: u8 = 5;
const SHIFTED_FROM: u8 = NOTE_KEYS.len() as u8 - SHIFT_NOTES;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Control {
  /// A piano key, by its unshifted keybed semitone.
  Note(u8),
  /// ↑ and ↓ shift the keybed an octave.
  Octave(i8),
  Shift,
}

/// The control a key presses, if any.
pub fn control(code: &str) -> Option<Control> {
  match code {
    "ArrowUp" => Some(Control::Octave(1)),
    "ArrowDown" => Some(Control::Octave(-1)),
    "ShiftLeft" | "ShiftRight" => Some(Control::Shift),
    _ => NOTE_KEYS
      .iter()
      .position(|&(key, _)| key == code)
      .map(|semitone| Control::Note(semitone as u8)),
  }
}

/// The note a piano key plays with Shift held: the last five move up past B4.
pub fn shifted(semitone: u8) -> u8 {
  if (SHIFTED_FROM..NOTE_KEYS.len() as u8).contains(&semitone) {
    semitone + SHIFT_NOTES
  } else {
    semitone
  }
}

/// The legend on a keybed key: its letter, or ⇧ and the letter for the keys
/// only Shift reaches.
pub fn legend(semitone: u8) -> String {
  match NOTE_KEYS.get(semitone as usize) {
    Some((_, label)) => label.to_string(),
    None if semitone < KEYS => format!("⇧{}", NOTE_KEYS[(semitone - SHIFT_NOTES) as usize].1),
    None => String::new(),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn home_row_plays_the_keybed() {
    assert_eq!(control("KeyA"), Some(Control::Note(0)));
    assert_eq!(control("Quote"), Some(Control::Note(18)));
    assert_eq!(control("ArrowDown"), Some(Control::Octave(-1)));
    assert_eq!(control("KeyQ"), None);
  }

  #[test]
  fn shift_reaches_the_top_five_keys() {
    assert_eq!(shifted(13), 13);
    assert_eq!(shifted(14), 19);
    assert_eq!(shifted(18), 23);
    assert_eq!(legend(19), "⇧L");
    assert_eq!(legend(23), "⇧'");
  }

  #[test]
  fn every_key_has_one_legend() {
    let legends: Vec<_> = (0..KEYS).map(legend).collect();
    assert!(legends.iter().all(|legend| !legend.is_empty()));
    let mut unique = legends.clone();
    unique.sort();
    unique.dedup();
    assert_eq!(unique.len(), legends.len());
  }
}
