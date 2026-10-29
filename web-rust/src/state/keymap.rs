//! The computer keyboard's keys on the Device, by `KeyboardEvent.code`, as
//! web-react's `keymap.ts`.
//!
//! The piano takes the home row, as in a DAW's musical typing: white keys
//! F3–B4 along A S D F G H J K L ; ', and each black key on the row above,
//! between its neighbours (W E R, Y U, O P [). Held with Shift, the row's
//! last five keys carry on past B4 to E5. The pads sit around the piano,
//! and a key always presses the same pad, whatever the view: the number row
//! picks sounds (the six instrument pads on 1–6 and the six chord pads on
//! 7 8 9 0 - =), and the letters the piano leaves free open views.

use crate::logic::modules::ModuleId;

/// A pad that opens a view or acts, rather than playing a sound: each has its
/// own key.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Tool {
  /// Arms recording a take (or the drum grid's pattern).
  Record,
  /// Plays or pauses what the view plays.
  Play,
  /// Stops and rewinds.
  Stop,
  /// The open tape's tracks.
  Tracks,
  /// The tapes.
  Tapes,
  /// The take as a piano roll (with Shift, the progressions).
  Roll,
  /// The drum grid (with Shift, the drum beats).
  DrumGrid,
  /// The tempo view (with Shift, the metronome on or off).
  Metronome,
  /// The instruments.
  Instruments,
  /// The synth's parameters.
  Synth,
  /// What the chord pads play.
  Chords,
  /// How chords come out.
  PlayStyle,
  /// Keeps what the view holds.
  Save,
  /// Deletes what the view has picked, on a second press.
  Delete,
  /// Mutes the picked track (with Shift, solos it).
  Mute,
  /// Loops the picked track's clip (with Shift, trims to it).
  Clip,
  /// The ADSR, LFO or FX view (with Shift, the module on or off).
  Module(ModuleId),
}

/// Every tool, in the order their keys are listed.
pub const TOOLS: [Tool; 19] = [
  Tool::Play,
  Tool::Stop,
  Tool::Record,
  Tool::Instruments,
  Tool::Synth,
  Tool::Chords,
  Tool::PlayStyle,
  Tool::Tracks,
  Tool::Tapes,
  Tool::Roll,
  Tool::DrumGrid,
  Tool::Module(ModuleId::Adsr),
  Tool::Module(ModuleId::Lfo),
  Tool::Module(ModuleId::Fx),
  Tool::Metronome,
  Tool::Mute,
  Tool::Clip,
  Tool::Save,
  Tool::Delete,
];

/// Everything the keyboard can press on the Device.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Control {
  /// A keybed key, by semitone from F3.
  Note(usize),
  /// A chord pad, by its place among the six.
  Chord(usize),
  /// An instrument pad, by its place among the six.
  Instrument(usize),
  /// A tool's pad.
  Tool(Tool),
  /// ← and →.
  Step(i32),
  /// ↑ and ↓: the previous or next row, as the blue knob picks a track.
  Pick(i32),
  /// Shift.
  Shift,
}

/// Indexed by keybed semitone (F3 = 0).
const NOTE_KEYS: [&str; 19] = [
  "A", "W", "S", "E", "D", "R", "F", "G", "Y", "H", "U", "J", "K", "O", "L", "P", ";", "[", "'",
];

/// The notes Shift adds past the home row's last key.
pub const SHIFT_NOTES: usize = 5;
/// The first home-row note Shift moves up.
const SHIFTED_FROM: usize = NOTE_KEYS.len() - SHIFT_NOTES;

/// The note a piano key plays with Shift held: the last five move up past
/// B4.
pub fn shifted_note(semitone: usize) -> usize {
  if (SHIFTED_FROM..NOTE_KEYS.len()).contains(&semitone) {
    semitone + SHIFT_NOTES
  } else {
    semitone
  }
}

/// The instrument pads' keys, in pad order.
const INSTRUMENT_KEYS: [&str; 6] = ["1", "2", "3", "4", "5", "6"];
/// The chord pads' keys, in pad order.
const CHORD_KEYS: [&str; 6] = ["7", "8", "9", "0", "-", "="];

/// A tool's key legend; Save has none of its own (⌘S or Ctrl S saves).
fn tool_key(tool: Tool) -> &'static str {
  match tool {
    Tool::Play => "Space",
    Tool::Stop => "`",
    Tool::Record => ".",
    Tool::Instruments => "I",
    Tool::Synth => "Z",
    Tool::Chords => "C",
    Tool::PlayStyle => "Q",
    Tool::Tracks => "Esc",
    Tool::Tapes => "T",
    Tool::Roll => "V",
    Tool::DrumGrid => "B",
    Tool::Module(ModuleId::Adsr) => "N",
    Tool::Module(ModuleId::Lfo) => "]",
    Tool::Module(ModuleId::Fx) => "\\",
    Tool::Metronome => "M",
    Tool::Mute => ",",
    Tool::Clip => "X",
    Tool::Save => "",
    Tool::Delete => "⌫",
  }
}

/// `KeyboardEvent.code`s for each label that isn't `Key<letter>` or
/// `Digit<n>`.
fn codes_of(label: &str) -> Vec<String> {
  let codes: &[&str] = match label {
    "," => &["Comma"],
    "-" => &["Minus"],
    "`" => &["Backquote"],
    "Esc" => &["Escape"],
    "." => &["Period"],
    "/" => &["Slash"],
    ";" => &["Semicolon"],
    "'" => &["Quote"],
    "=" => &["Equal"],
    "[" => &["BracketLeft"],
    "]" => &["BracketRight"],
    "\\" => &["Backslash"],
    "←" => &["ArrowLeft"],
    "⌫" => &["Backspace"],
    "→" => &["ArrowRight"],
    "↑" => &["ArrowUp"],
    "↓" => &["ArrowDown"],
    "⇧" => &["ShiftLeft", "ShiftRight"],
    "Tab" => &["Tab"],
    "Space" => &["Space"],
    _ if label.len() == 1 && label.as_bytes()[0].is_ascii_digit() => {
      return vec![format!("Digit{label}")];
    }
    _ => return vec![format!("Key{label}")],
  };
  codes.iter().map(|code| (*code).to_owned()).collect()
}

/// The badge each control shows: its key's legend, or "" for none.
pub fn hotkey_label(control: Control) -> String {
  match control {
    Control::Note(semitone) if semitone < NOTE_KEYS.len() => NOTE_KEYS[semitone].into(),
    Control::Note(semitone) => format!("⇧{}", NOTE_KEYS[semitone - SHIFT_NOTES]),
    Control::Chord(index) => CHORD_KEYS[index].into(),
    Control::Instrument(index) => INSTRUMENT_KEYS[index].into(),
    Control::Tool(tool) => tool_key(tool).into(),
    Control::Step(direction) => (if direction < 0 { "←" } else { "→" }).into(),
    Control::Pick(direction) => (if direction < 0 { "↑" } else { "↓" }).into(),
    Control::Shift => "⇧".into(),
  }
}

/// Every control the keyboard can press.
fn controls() -> Vec<Control> {
  (0..NOTE_KEYS.len())
    .map(Control::Note)
    .chain((0..CHORD_KEYS.len()).map(Control::Chord))
    .chain((0..INSTRUMENT_KEYS.len()).map(Control::Instrument))
    .chain(TOOLS.iter().map(|&tool| Control::Tool(tool)))
    .chain([
      Control::Step(-1),
      Control::Step(1),
      Control::Pick(-1),
      Control::Pick(1),
      Control::Shift,
    ])
    .collect()
}

/// The control a `KeyboardEvent.code` presses.
pub fn control_for(code: &str) -> Option<Control> {
  controls().into_iter().find(|&control| {
    let label = hotkey_label(control);
    !label.is_empty() && codes_of(&label).iter().any(|candidate| candidate == code)
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn keys_map_as_web_reacts() {
    assert_eq!(control_for("KeyA"), Some(Control::Note(0)));
    assert_eq!(control_for("Quote"), Some(Control::Note(18)));
    assert_eq!(control_for("Digit7"), Some(Control::Chord(0)));
    assert_eq!(control_for("Equal"), Some(Control::Chord(5)));
    assert_eq!(control_for("Digit1"), Some(Control::Instrument(0)));
    assert_eq!(control_for("Space"), Some(Control::Tool(Tool::Play)));
    assert_eq!(
      control_for("Backslash"),
      Some(Control::Tool(Tool::Module(ModuleId::Fx)))
    );
    assert_eq!(control_for("ShiftRight"), Some(Control::Shift));
    assert_eq!(control_for("ArrowUp"), Some(Control::Pick(-1)));
    assert_eq!(control_for("KeyS"), Some(Control::Note(2)));
    assert_eq!(control_for("Tab"), None);
    assert_eq!(hotkey_label(Control::Note(20)), "⇧P");
    assert_eq!(shifted_note(14), 19);
  }

  #[test]
  fn no_key_presses_two_controls() {
    let mut codes: Vec<String> = controls()
      .into_iter()
      .flat_map(|control| {
        let label = hotkey_label(control);
        if label.is_empty() {
          Vec::new()
        } else {
          codes_of(&label)
        }
      })
      .collect();
    let all = codes.len();
    codes.sort();
    codes.dedup();
    assert_eq!(codes.len(), all);
  }
}
