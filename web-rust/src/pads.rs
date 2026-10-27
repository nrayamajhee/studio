//! The 36 pads, three rows of twelve in reading order, as web-react's
//! `PadButtons` lays them out in its main view:
//!
//! ```text
//! Play  Stop  Record Save   Tapes  Synth  ADSR LFO FX Chords Style Tempo
//! Clip  Mute  ↑      Delete Tracks Roll   preset 1–3      chord 1–3
//! Shift ←     ↓      →      Instr. Grid   preset 4–6      chord 4–6
//! ```
//!
//! The arrows move the octave, the presets switch the instrument, the chord
//! pads play chords on the keys and Shift latches. The rest open views and run the transport, which come with
//! later steps of the port; until then they keep their icons and labels.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Job {
  None,
  Octave(i8),
  Preset(usize),
  /// Held while its key is down; clicked, it latches.
  Shift,
  /// A chord pad, an index into [`CHORDS`]: its key holds the chord on the
  /// keys, a click latches it.
  Chord(usize),
}

pub struct Chord {
  pub name: &'static str,
  /// Semitones from the root, so a chord transposes to the key played.
  pub intervals: &'static [u8],
}

/// The chords web-react's pads start with, in pad order.
pub const CHORDS: [Chord; 6] = [
  Chord {
    name: "Suspended 4",
    intervals: &[0, 5, 7],
  },
  Chord {
    name: "Major 7",
    intervals: &[0, 4, 7, 11],
  },
  Chord {
    name: "Minor 7",
    intervals: &[0, 3, 7, 10],
  },
  Chord {
    name: "Dominant 7",
    intervals: &[0, 4, 7, 10],
  },
  Chord {
    name: "Minor",
    intervals: &[0, 3, 7],
  },
  Chord {
    name: "Major",
    intervals: &[0, 4, 7],
  },
];

pub struct Pad {
  pub label: &'static str,
  /// The keycap legend; `None` for Save, whose ⌘ or Ctrl legend depends on
  /// the platform.
  pub legend: Option<&'static str>,
  /// `KeyboardEvent.code`s that hold it.
  pub codes: &'static [&'static str],
  pub accent: &'static str,
  /// Whether it has an LED for a state it shows without being pressed.
  pub led: bool,
  pub job: Job,
}

const RED: &str = "var(--color-synth-red)";
const GREEN: &str = "var(--color-synth-green)";
const BLUE: &str = "var(--color-synth-blue)";
const PLAIN: &str = "#4ba078";

const fn pad(
  label: &'static str,
  legend: &'static str,
  codes: &'static [&'static str],
  accent: &'static str,
) -> Pad {
  Pad {
    label,
    legend: Some(legend),
    codes,
    accent,
    led: false,
    job: Job::None,
  }
}

const fn led(pad: Pad) -> Pad {
  Pad { led: true, ..pad }
}

const fn job(pad: Pad, job: Job) -> Pad {
  Pad { job, ..pad }
}

const fn preset(legend: &'static str, codes: &'static [&'static str], index: usize) -> Pad {
  led(job(pad("", legend, codes, RED), Job::Preset(index)))
}

const fn chord(legend: &'static str, codes: &'static [&'static str], index: usize) -> Pad {
  job(pad("", legend, codes, BLUE), Job::Chord(index))
}

pub const PADS: [Pad; 36] = [
  pad("Play the take", "Space", &["Space"], PLAIN),
  pad("Stop (nothing is playing)", "`", &["Backquote"], RED),
  pad("Arm recording", ".", &["Period"], RED),
  Pad {
    label: "Save (not used here)",
    legend: None,
    codes: &[],
    accent: RED,
    led: false,
    job: Job::None,
  },
  pad("Open the tapes", "T", &["KeyT"], RED),
  pad("Open the synth parameters", "Z", &["KeyZ"], RED),
  led(pad("Open the ADSR (off)", "N", &["KeyN"], RED)),
  led(pad("Open the LFO (off)", "]", &["BracketRight"], RED)),
  led(pad("Open the FX (off)", "\\", &["Backslash"], RED)),
  pad("Open the chords", "C", &["KeyC"], RED),
  pad("Open the play style", "Q", &["KeyQ"], RED),
  led(pad("Open the tempo (metronome off)", "M", &["KeyM"], GREEN)),
  pad("Clip a track (not used here)", "X", &["KeyX"], RED),
  pad("Mute a track (not used here)", ",", &["Comma"], RED),
  job(pad("Octave up", "↑", &["ArrowUp"], RED), Job::Octave(1)),
  pad("Delete (nothing to delete here)", "⌫", &["Backspace"], RED),
  pad("Open the tracks", "Esc", &["Escape"], RED),
  pad("Open the piano roll", "V", &["KeyV"], RED),
  preset("1", &["Digit1"], 0),
  preset("2", &["Digit2"], 1),
  preset("3", &["Digit3"], 2),
  chord("7", &["Digit7"], 0),
  chord("8", &["Digit8"], 1),
  chord("9", &["Digit9"], 2),
  job(
    pad(
      "Latch Shift for the pads' Shift jobs",
      "⇧",
      &["ShiftLeft", "ShiftRight"],
      PLAIN,
    ),
    Job::Shift,
  ),
  job(
    pad("Octave down", "←", &["ArrowLeft"], RED),
    Job::Octave(-1),
  ),
  job(
    pad("Octave down", "↓", &["ArrowDown"], RED),
    Job::Octave(-1),
  ),
  job(pad("Octave up", "→", &["ArrowRight"], RED), Job::Octave(1)),
  pad("Open the instruments", "I", &["KeyI"], RED),
  pad("Open the drum grid", "B", &["KeyB"], RED),
  preset("4", &["Digit4"], 3),
  preset("5", &["Digit5"], 4),
  preset("6", &["Digit6"], 5),
  chord("0", &["Digit0"], 3),
  chord("-", &["Minus"], 4),
  chord("=", &["Equal"], 5),
];

/// The pad a key holds, if any.
pub fn pad_for(code: &str) -> Option<usize> {
  PADS.iter().position(|pad| pad.codes.contains(&code))
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::keymap;

  #[test]
  fn no_key_holds_two_controls() {
    let codes: Vec<_> = PADS.iter().flat_map(|pad| pad.codes.iter()).collect();
    for (at, code) in codes.iter().enumerate() {
      assert!(!codes[at + 1..].contains(code), "{code} holds two pads");
      assert!(
        keymap::note_for(code).is_none(),
        "{code} holds a pad and a key"
      );
    }
  }

  #[test]
  fn chords_fill_their_pads() {
    let chords: Vec<_> = PADS
      .iter()
      .filter_map(|pad| match pad.job {
        Job::Chord(index) => Some(index),
        _ => None,
      })
      .collect();
    assert_eq!(chords, [0, 1, 2, 3, 4, 5]);
  }

  #[test]
  fn presets_fill_their_pads() {
    let presets: Vec<_> = PADS
      .iter()
      .filter_map(|pad| match pad.job {
        Job::Preset(index) => Some(index),
        _ => None,
      })
      .collect();
    assert_eq!(presets, [0, 1, 2, 3, 4, 5]);
  }
}
