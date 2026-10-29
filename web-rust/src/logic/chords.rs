//! The chords the chord pads can be set to, as web-react's `chords.ts`.
//! Intervals are semitones from the root, so a chord transposes to whatever
//! key is played.

/// A chord: its id, its name in the palette, its label on a pad, and its
/// intervals in semitones from the root.
pub struct Chord {
  pub id: &'static str,
  /// The full name, shown in the palette.
  pub name: &'static str,
  /// The short label, shown on the chord pad.
  pub label: &'static str,
  pub intervals: &'static [i32],
}

/// A chord, for the palette's table.
const fn chord(
  id: &'static str,
  name: &'static str,
  label: &'static str,
  intervals: &'static [i32],
) -> Chord {
  Chord {
    id,
    name,
    label,
    intervals,
  }
}

/// A kind of chord in the palette, with its chords most used first.
pub struct ChordGroup {
  pub name: &'static str,
  pub chords: &'static [Chord],
}

/// The palette by kind, most used first in each, so the blue knob steps
/// through the kinds and the red one through a kind's chords.
pub const CHORD_GROUPS: [ChordGroup; 5] = [
  ChordGroup {
    name: "Triads",
    chords: &[
      chord("maj", "Major", "Maj", &[0, 4, 7]),
      chord("min", "Minor", "Min", &[0, 3, 7]),
      chord("sus4", "Suspended 4", "Sus4", &[0, 5, 7]),
      chord("sus2", "Suspended 2", "Sus2", &[0, 2, 7]),
      chord("5", "Power", "5", &[0, 7]),
      chord("dim", "Diminished", "Dim", &[0, 3, 6]),
      chord("aug", "Augmented", "Aug", &[0, 4, 8]),
      chord("majb5", "Major ♭5", "Maj♭5", &[0, 4, 6]),
      chord("minb6", "Minor ♭6", "Min♭6", &[0, 3, 8]),
      chord("quartal", "Quartal", "Quart", &[0, 5, 10]),
    ],
  },
  ChordGroup {
    name: "Sevenths",
    chords: &[
      chord("7", "Dominant 7", "7", &[0, 4, 7, 10]),
      chord("min7", "Minor 7", "Min7", &[0, 3, 7, 10]),
      chord("maj7", "Major 7", "Maj7", &[0, 4, 7, 11]),
      chord("m7b5", "Half diminished", "m7♭5", &[0, 3, 6, 10]),
      chord("dim7", "Diminished 7", "Dim7", &[0, 3, 6, 9]),
      chord("minMaj7", "Minor major 7", "mMaj7", &[0, 3, 7, 11]),
      chord("7sus4", "Dominant 7 sus4", "7sus4", &[0, 5, 7, 10]),
      chord("7sus2", "Dominant 7 sus2", "7sus2", &[0, 2, 7, 10]),
      chord("dimMaj7", "Diminished major 7", "DimMaj7", &[0, 3, 6, 11]),
    ],
  },
  ChordGroup {
    name: "Sixths & adds",
    chords: &[
      chord("6", "Major 6", "6", &[0, 4, 7, 9]),
      chord("min6", "Minor 6", "Min6", &[0, 3, 7, 9]),
      chord("add9", "Add 9", "Add9", &[0, 4, 7, 14]),
      chord("minAdd9", "Minor add 9", "mAdd9", &[0, 3, 7, 14]),
      chord("69", "Six nine", "6/9", &[0, 4, 7, 9, 14]),
      chord("min69", "Minor six nine", "m6/9", &[0, 3, 7, 9, 14]),
      chord("add11", "Add 11", "Add11", &[0, 4, 7, 17]),
      chord("sus4add9", "Suspended 4 add 9", "Sus4♭9", &[0, 5, 7, 14]),
    ],
  },
  ChordGroup {
    name: "Extended",
    chords: &[
      chord("9", "Dominant 9", "9", &[0, 4, 7, 10, 14]),
      chord("min9", "Minor 9", "Min9", &[0, 3, 7, 10, 14]),
      chord("maj9", "Major 9", "Maj9", &[0, 4, 7, 11, 14]),
      chord("minMaj9", "Minor major 9", "mMaj9", &[0, 3, 7, 11, 14]),
      chord("9sus4", "Dominant 9 sus4", "9sus4", &[0, 5, 7, 10, 14]),
      chord("11", "Dominant 11", "11", &[0, 4, 7, 10, 14, 17]),
      chord("min11", "Minor 11", "Min11", &[0, 3, 7, 10, 14, 17]),
      chord("maj11", "Major 11", "Maj11", &[0, 4, 7, 11, 14, 17]),
      chord("13", "Dominant 13", "13", &[0, 4, 7, 10, 14, 21]),
      chord("min13", "Minor 13", "Min13", &[0, 3, 7, 10, 14, 21]),
      chord("maj13", "Major 13", "Maj13", &[0, 4, 7, 11, 14, 21]),
    ],
  },
  ChordGroup {
    name: "Altered",
    chords: &[
      chord("7b5", "Dominant 7 ♭5", "7♭5", &[0, 4, 6, 10]),
      chord("7s5", "Dominant 7 ♯5", "7♯5", &[0, 4, 8, 10]),
      chord("7b9", "Dominant 7 ♭9", "7♭9", &[0, 4, 7, 10, 13]),
      chord("7s9", "Dominant 7 ♯9", "7♯9", &[0, 4, 7, 10, 15]),
      chord("7s11", "Dominant 7 ♯11", "7♯11", &[0, 4, 7, 10, 18]),
      chord("maj7s11", "Major 7 ♯11", "Maj7♯11", &[0, 4, 7, 11, 18]),
      chord("7b13", "Dominant 7 ♭13", "7♭13", &[0, 4, 7, 10, 20]),
      chord("min7s5", "Minor 7 ♯5", "m7♯5", &[0, 3, 8, 10]),
      chord("maj7b5", "Major 7 ♭5", "Maj7♭5", &[0, 4, 6, 11]),
      chord("min9b5", "Minor 9 ♭5", "m9♭5", &[0, 3, 6, 10, 14]),
    ],
  },
];

/// Every chord, group by group.
pub fn palette() -> impl Iterator<Item = &'static Chord> {
  CHORD_GROUPS.iter().flat_map(|group| group.chords.iter())
}

/// The kind a chord is listed under.
pub fn chord_group(id: &str) -> &'static str {
  CHORD_GROUPS
    .iter()
    .find(|group| group.chords.iter().any(|chord| chord.id == id))
    .map_or("", |group| group.name)
}

/// The chord `id` (major, if there's none).
pub fn chord_by_id(id: &str) -> &'static Chord {
  palette()
    .find(|chord| chord.id == id)
    .unwrap_or(&CHORD_GROUPS[0].chords[0])
}

/// Whether `id` is a chord in the palette.
pub fn is_chord(id: &str) -> bool {
  palette().any(|chord| chord.id == id)
}

/// The six chord pads start on the most used chords, most used on the
/// right: the right hand rests its pinky on major (=) and ring finger on
/// minor (-), while the left plays the keys.
pub const DEFAULT_PAD_CHORDS: [&str; 6] = ["sus4", "maj7", "min7", "7", "min", "maj"];

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn palette_ids_are_unique() {
    let ids: Vec<_> = palette().map(|chord| chord.id).collect();
    for (at, id) in ids.iter().enumerate() {
      assert!(!ids[at + 1..].contains(id), "{id}");
    }
    assert_eq!(ids.len(), 48);
    for id in DEFAULT_PAD_CHORDS {
      assert!(is_chord(id));
    }
    assert_eq!(chord_group("m7b5"), "Sevenths");
    assert_eq!(chord_by_id("nope").id, "maj");
  }
}
