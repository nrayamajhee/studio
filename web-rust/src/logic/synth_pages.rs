//! The Synth screen's pages, as web-react's `synthPages.ts`: the overview,
//! then a page per module the instrument has, each with what its four knobs
//! set, and with Shift held.

use sound_engine::patches::ParamSpec;

use super::params::{Family, param_modules};

/// Four knob slots, in knob order (chalk, green, red, blue); `None` where
/// the page has nothing for that knob.
pub type KnobSlots = [Option<&'static ParamSpec>; 4];

/// A page of the Synth screen: the overview (`chain`) or a module, with the
/// param each knob sets on it, and with Shift held.
#[derive(Clone, Debug)]
pub struct SynthPage {
  /// "chain", or the module's section id.
  pub id: &'static str,
  pub label: &'static str,
  pub main: KnobSlots,
  pub shift: KnobSlots,
}

/// The shared modules' params keep their knob on every instrument, so a
/// knob's colour means the same thing whichever instrument is playing. A
/// slot lists the ids that may fill it. A shared module's other params go
/// to Shift; the model's own modules fill the knobs in order, then Shift.
fn slots(module: &str) -> Option<&'static [&'static [&'static str]]> {
  Some(match module {
    "body" => &[
      &["body.size", "body.width"],
      &["body.resonance"],
      &["body.tone"],
      &["body.mix", "body.violin"],
    ],
    "filter" => &[
      &["filter.cutoff"],
      &["filter.resonance"],
      &["filter.envAmount"],
      &["filter.envDecay"],
    ],
    "envelope" => &[
      &["envelope.attack"],
      &["envelope.decay"],
      &["envelope.sustain"],
      &["envelope.release"],
    ],
    "vibrato" => &[
      &["vibrato.rate"],
      &["vibrato.pitch"],
      &["vibrato.level"],
      &["vibrato.filter"],
    ],
    "output" => &[&["output.drive"], &["output.level"], &["space.send"]],
    _ => return None,
  })
}

/// The first four of `specs` in knob order, the rest of the knobs empty.
fn fill(specs: &[&'static ParamSpec]) -> KnobSlots {
  std::array::from_fn(|i| specs.get(i).copied())
}

/// A module's params on the four knobs and, with Shift, its extras: the shared
/// modules' params keep their knob on every instrument; anything else fills the
/// knobs in order.
pub fn knob_slots(module: &str, specs: &[&'static ParamSpec]) -> (KnobSlots, KnobSlots) {
  let Some(slots) = slots(module) else {
    return (fill(specs), fill(specs.get(4..).unwrap_or_default()));
  };
  let mut main = [None; 4];
  let mut rest = Vec::new();
  for &spec in specs {
    match slots.iter().position(|ids| ids.contains(&spec.id.as_str())) {
      Some(slot) => main[slot] = Some(spec),
      None => rest.push(spec),
    }
  }
  (main, fill(&rest))
}

/// The overview, then a page per module the instrument has, in the order
/// they act on a note.
pub fn synth_pages(params: &'static [ParamSpec], family: Family) -> Vec<SynthPage> {
  let chain = SynthPage {
    id: "chain",
    label: "Chain",
    main: [None; 4],
    shift: [None; 4],
  };
  std::iter::once(chain)
    .chain(param_modules(params, family).into_iter().map(|module| {
      let (main, shift) = knob_slots(module.id, &module.specs);
      SynthPage {
        id: module.id,
        label: module.label,
        main,
        shift,
      }
    }))
    .collect()
}

/// The chain's stages in signal order; the envelope and vibrato move them.
pub const CHAIN_STOPS: [&str; 5] = ["exciter", "resonator", "filter", "body", "output"];

/// The notes' names, from C.
const NOTE_NAMES: [&str; 12] = [
  "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B",
];

/// A note's name with its octave: `C4`.
pub fn note_name(midi: i32) -> String {
  format!(
    "{}{}",
    NOTE_NAMES[midi.rem_euclid(12) as usize],
    midi.div_euclid(12) - 1
  )
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::logic::params::{family, patch};

  #[test]
  fn shared_modules_keep_their_knobs() {
    let piano = patch("piano");
    let pages = synth_pages(&piano.base().params, family(piano));
    assert_eq!(pages[0].id, "chain");
    let body = pages.iter().find(|page| page.id == "body");
    if let Some(body) = body {
      assert!(body.main[0].is_some_and(|spec| spec.id == "body.size" || spec.id == "body.width"));
    }
    let output = pages.iter().find(|page| page.id == "output").unwrap();
    assert_eq!(
      output.main[2].map(|spec| spec.id.as_str()),
      Some("space.send")
    );
    assert_eq!(note_name(60), "C4");
    assert_eq!(note_name(61), "C♯4");
  }
}
