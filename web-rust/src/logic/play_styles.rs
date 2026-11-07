//! How a held chord sounds, as web-react's `playStyles.ts`: all at once,
//! strummed, or as a pattern of its notes in time with the tempo. Playing
//! one live is the performance store's; this is the data and laying a
//! chord out ahead.

use serde::{Deserialize, Serialize};

use super::timing::PlayedNote;

/// What holding a chord does: sustain it, repeat it in a rhythm, strum it
/// as a guitarist would, or loop through its notes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PlayStyleGroup {
  /// Held: the chord sustains, at once or spread.
  Held,
  /// Repeated in a rhythm.
  Rhythm,
  /// Strummed as a guitarist would.
  Strum,
  /// Looping through its notes.
  Arpeggio,
}

impl PlayStyleGroup {
  /// The group's name, as the picker's pages show it.
  pub fn name(self) -> &'static str {
    match self {
      Self::Held => "Held",
      Self::Rhythm => "Rhythm",
      Self::Strum => "Strum",
      Self::Arpeggio => "Arpeggio",
    }
  }
}

/// The settings a play style listens to: the rate of its steps, the gap of
/// its strums, both or neither.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Setting {
  /// The rate of its steps.
  Rate,
  /// The gap of its strums.
  Strum,
}

/// A built-in play style: its id, name and description, the group it's listed
/// in, and the settings it listens to.
pub struct PlayStyleSpec {
  pub id: &'static str,
  pub name: &'static str,
  /// What it does, in web-react's words; nothing shows it yet.
  #[allow(dead_code)]
  pub detail: &'static str,
  pub group: PlayStyleGroup,
  pub settings: &'static [Setting],
}

/// A play style, for the table.
const fn style(
  id: &'static str,
  name: &'static str,
  detail: &'static str,
  group: PlayStyleGroup,
  settings: &'static [Setting],
) -> PlayStyleSpec {
  PlayStyleSpec {
    id,
    name,
    detail,
    group,
    settings,
  }
}

/// Listens to its rate.
const RATE: &[Setting] = &[Setting::Rate];
/// Listens to its strum's gap.
const STRUM: &[Setting] = &[Setting::Strum];
/// Listens to both.
const BOTH: &[Setting] = &[Setting::Rate, Setting::Strum];

/// Every built-in play style, by group.
pub const PLAY_STYLES: [PlayStyleSpec; 33] = {
  use PlayStyleGroup::*;
  [
    style("block", "Block", "Every note at once", Held, &[]),
    style("strum", "Strum", "Low to high, a sweep apart", Held, STRUM),
    style(
      "roll",
      "Roll",
      "Rolled up a step apart, then held",
      Held,
      RATE,
    ),
    style("pulse", "Pulse", "Short strikes, a gap apart", Rhythm, RATE),
    style(
      "accentPulse",
      "Accent pulse",
      "Four to a bar, the third struck bright",
      Rhythm,
      RATE,
    ),
    style(
      "rollPulse",
      "Roll pulse",
      "Rolled up a step apart, again and again",
      Rhythm,
      RATE,
    ),
    style(
      "offbeat",
      "Offbeat",
      "Short hits on every other step",
      Rhythm,
      RATE,
    ),
    style(
      "tresillo",
      "Tresillo",
      "Three hits, 3 + 3 + 2",
      Rhythm,
      RATE,
    ),
    style("gallop", "Gallop", "Long, short, short", Rhythm, RATE),
    style(
      "strumPulse",
      "Strum pulse",
      "A strum on every strike",
      Strum,
      BOTH,
    ),
    style(
      "downUp",
      "Down-up strum",
      "Down on the step, up on the next",
      Strum,
      BOTH,
    ),
    style(
      "accentDownUp",
      "Accent down-up",
      "Light ups, every other down leaned on",
      Strum,
      BOTH,
    ),
    style(
      "folkStrum",
      "Folk strum",
      "Down, down-up, up-down-up",
      Strum,
      BOTH,
    ),
    style(
      "rockEighths",
      "Rock eighths",
      "A down strum every step",
      Strum,
      BOTH,
    ),
    style(
      "skank",
      "Reggae skank",
      "Short up-strums off the beat",
      Strum,
      BOTH,
    ),
    style(
      "waltzStrum",
      "Waltz strum",
      "Down, down-up, down-up in three",
      Strum,
      BOTH,
    ),
    style(
      "boomChuck",
      "Boom-chuck",
      "The root on the beat, the top strings chucked between",
      Strum,
      BOTH,
    ),
    style(
      "backbeatStrum",
      "Backbeat strum",
      "A down on every beat, two and four hit hardest",
      Strum,
      BOTH,
    ),
    style(
      "popPush",
      "Pop push",
      "Down, down-up, a pushed up ringing over three",
      Strum,
      BOTH,
    ),
    style(
      "rumbaStrum",
      "Rumba strum",
      "Down-ups with a slapped chuck on two and four",
      Strum,
      BOTH,
    ),
    style(
      "funkSixteenths",
      "Funk sixteenths",
      "Ghosted sixteenths, the one and the backbeat struck",
      Strum,
      BOTH,
    ),
    style(
      "chopStrum",
      "Chop",
      "Sharp, short top strings on two and four",
      Strum,
      BOTH,
    ),
    style(
      "shuffleStrum",
      "Shuffle strum",
      "Long downs and light ups, in triplets",
      Strum,
      BOTH,
    ),
    style(
      "sixEightStrum",
      "Six-eight strum",
      "Two lilting threes, the first leaned on",
      Strum,
      BOTH,
    ),
    style(
      "bossaStrum",
      "Bossa strum",
      "The thumb on the root, the fingers off the beat",
      Strum,
      RATE,
    ),
    style(
      "swellStrum",
      "Swell strum",
      "Four downs, each harder than the last",
      Strum,
      BOTH,
    ),
    style(
      "fadeStrum",
      "Fade strum",
      "Four downs, each softer than the last",
      Strum,
      BOTH,
    ),
    style(
      "tremoloStrum",
      "Tremolo strum",
      "Fast down-ups that swell and fall back",
      Strum,
      BOTH,
    ),
    style("up", "Arp up", "One at a time, low to high", Arpeggio, RATE),
    style(
      "down",
      "Arp down",
      "One at a time, high to low",
      Arpeggio,
      RATE,
    ),
    style("upDown", "Up-down", "Up, then back down", Arpeggio, RATE),
    style(
      "broken",
      "Broken",
      "The root, then the rest",
      Arpeggio,
      RATE,
    ),
    style(
      "alberti",
      "Alberti",
      "Low, high, middle, high",
      Arpeggio,
      RATE,
    ),
  ]
};

/// The play style `id` (block, if there's none).
pub fn play_style_spec(id: &str) -> &'static PlayStyleSpec {
  PLAY_STYLES
    .iter()
    .find(|style| style.id == id)
    .unwrap_or(&PLAY_STYLES[0])
}

/// A pattern's steps a beat, 1/4 to 1/32 with triplets (the red knob), and
/// a strum's gap between strings in ms (the blue knob).
pub const CHORD_RATES: [u32; 6] = [1, 2, 3, 4, 6, 8];
/// The gaps a strum's strings can be apart (ms).
pub const STRUM_GAPS: [u32; 8] = [5, 10, 15, 20, 30, 40, 60, 80];

/// Which way a strike sweeps the chord: rising (a down strum) or falling (an
/// up strum).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Sweep {
  /// Rising: a down strum.
  Rising,
  /// Falling: an up strum.
  Falling,
}

/// Which of a chord's notes a strike catches, when not all of them.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Strings {
  /// Only the root: a thumb on the bass string.
  Root,
  /// All but the root: an up strum or a chuck on the top strings.
  High,
}

/// A rhythm's strike: the step it lands on, how many steps it holds (a
/// little short of the next, so that one speaks), its sweep, how hard it
/// plays against the key's velocity, the strings it catches, and how much
/// it fades across its sweep, the first string it meets the loudest.
#[derive(Clone, Copy, Debug)]
pub struct Strike {
  pub at: u32,
  pub hold: f64,
  pub sweep: Option<Sweep>,
  pub level: f64,
  pub strings: Option<Strings>,
  pub taper: f64,
}

impl Strike {
  /// The strike catching only `strings`.
  const fn on(mut self, strings: Strings) -> Self {
    self.strings = Some(strings);
    self
  }

  /// The strike fading by `TAPER` across its sweep.
  const fn tapered(mut self) -> Self {
    self.taper = TAPER;
    self
  }
}

/// The notes a strike sounds, in the order it sweeps them, each at its
/// level.
pub fn strike_notes(notes: &[i32], strike: &Strike) -> Vec<(i32, f64)> {
  let caught = match strike.strings {
    Some(Strings::Root) => &notes[..notes.len().min(1)],
    Some(Strings::High) => &notes[notes.len().min(1)..],
    None => notes,
  };
  let order: Vec<i32> = match strike.sweep {
    Some(Sweep::Falling) => caught.iter().rev().copied().collect(),
    _ => caught.to_vec(),
  };
  let last = order.len().saturating_sub(1).max(1) as f64;
  order
    .into_iter()
    .enumerate()
    .map(|(i, note)| (note, strike.level * (1. - (strike.taper * i as f64) / last)))
    .collect()
}

/// A rhythm: how many steps it runs before it repeats, and its strikes.
pub struct Rhythm {
  pub cycle: u32,
  pub strikes: &'static [Strike],
}

/// Strike levels against the keys' velocity (0.8): a touch harder (0.9) or
/// a touch lighter (0.7), as a player leans into a beat or eases off an
/// upstroke.
const ACCENT: f64 = 0.9 / 0.8;
/// A touch lighter, against the keys' velocity.
const LIGHT: f64 = 0.7 / 0.8;
/// A piano player's four to the bar: the third struck full and let ring.
const FULL: f64 = 1. / 0.8;
/// Softer still (0.6), against the keys' velocity.
const SOFT: f64 = 0.6 / 0.8;
/// A ghost (0.35): a stroke the hand barely lets touch the strings.
const GHOST: f64 = 0.35 / 0.8;
/// How much a leaned-on strum fades from its first string to its last.
const TAPER: f64 = 0.25;

/// A strike, for the rhythms' tables.
const fn strike(at: u32, hold: f64, sweep: Option<Sweep>, level: f64) -> Strike {
  Strike {
    at,
    hold,
    sweep,
    level,
    strings: None,
    taper: 0.,
  }
}

/// A down strum: rising.
const UP: Option<Sweep> = Some(Sweep::Rising);
/// An up strum: falling.
const DOWN: Option<Sweep> = Some(Sweep::Falling);

/// The rhythm `id` plays, if it's a rhythm.
pub fn rhythm(id: &str) -> Option<&'static Rhythm> {
  const PULSE: Rhythm = Rhythm {
    cycle: 1,
    strikes: &[strike(0, 0.5, None, 1.)],
  };
  const ACCENT_PULSE: Rhythm = Rhythm {
    cycle: 4,
    strikes: &[
      strike(0, 0.6, None, 1.),
      strike(1, 0.6, None, 1.),
      strike(2, 0.9, None, FULL),
      strike(3, 0.6, None, 1.),
    ],
  };
  const STRUM_PULSE: Rhythm = Rhythm {
    cycle: 1,
    strikes: &[strike(0, 0.5, UP, 1.)],
  };
  const DOWN_UP: Rhythm = Rhythm {
    cycle: 2,
    strikes: &[strike(0, 0.9, UP, 1.), strike(1, 0.9, DOWN, 1.)],
  };
  const ACCENT_DOWN_UP: Rhythm = Rhythm {
    cycle: 4,
    strikes: &[
      strike(0, 0.9, UP, 1.),
      strike(1, 0.9, DOWN, LIGHT),
      strike(2, 0.9, UP, ACCENT),
      strike(3, 0.9, DOWN, LIGHT),
    ],
  };
  // Down, down-up, up-down-up over a bar of eighths; where the hand misses
  // the strings, the strum before rings on.
  const FOLK: Rhythm = Rhythm {
    cycle: 8,
    strikes: &[
      strike(0, 1.9, UP, ACCENT),
      strike(2, 0.9, UP, 1.),
      strike(3, 1.9, DOWN, LIGHT),
      strike(5, 0.9, DOWN, LIGHT),
      strike(6, 0.9, UP, 1.),
      strike(7, 0.9, DOWN, LIGHT),
    ],
  };
  const ROCK: Rhythm = Rhythm {
    cycle: 2,
    strikes: &[strike(0, 0.8, UP, ACCENT), strike(1, 0.8, UP, 1.)],
  };
  // Short up-strums choked off on the offbeats.
  const SKANK: Rhythm = Rhythm {
    cycle: 2,
    strikes: &[strike(1, 0.4, DOWN, 1.)],
  };
  // A bar of 3/4 in eighths: the downbeat rings, then down-up, down-up.
  const WALTZ: Rhythm = Rhythm {
    cycle: 6,
    strikes: &[
      strike(0, 1.9, UP, ACCENT),
      strike(2, 0.9, UP, 1.),
      strike(3, 0.9, DOWN, LIGHT),
      strike(4, 0.9, UP, 1.),
      strike(5, 0.9, DOWN, LIGHT),
    ],
  };
  // Country's bass and chuck: the thumb on the root, then the top strings
  // brushed short and light.
  const BOOM_CHUCK: Rhythm = Rhythm {
    cycle: 4,
    strikes: &[
      strike(0, 1.9, None, ACCENT).on(Strings::Root),
      strike(2, 0.6, UP, LIGHT).on(Strings::High),
    ],
  };
  // A bar of downs on the beats, the backbeat hit hardest, and an up
  // brushing the top strings into the next bar.
  const BACKBEAT: Rhythm = Rhythm {
    cycle: 8,
    strikes: &[
      strike(0, 1.9, UP, LIGHT),
      strike(2, 1.9, UP, FULL).tapered(),
      strike(4, 1.9, UP, LIGHT),
      strike(6, 0.9, UP, FULL).tapered(),
      strike(7, 0.9, DOWN, SOFT).on(Strings::High),
    ],
  };
  // Down, down-up, then an up on the and of two pushed hard and let ring
  // over the third beat, and down-up to finish.
  const POP_PUSH: Rhythm = Rhythm {
    cycle: 8,
    strikes: &[
      strike(0, 1.9, UP, ACCENT).tapered(),
      strike(2, 0.9, UP, LIGHT),
      strike(3, 2.9, DOWN, ACCENT).tapered(),
      strike(6, 0.9, UP, 1.),
      strike(7, 0.9, DOWN, LIGHT).on(Strings::High),
    ],
  };
  // Eighths of down-ups, the downs on two and four slapped short and hard.
  const RUMBA: Rhythm = Rhythm {
    cycle: 8,
    strikes: &[
      strike(0, 0.9, UP, ACCENT).tapered(),
      strike(1, 0.9, DOWN, LIGHT).on(Strings::High),
      strike(2, 0.25, UP, FULL),
      strike(3, 0.9, DOWN, LIGHT).on(Strings::High),
      strike(4, 0.9, UP, 1.).tapered(),
      strike(5, 0.9, DOWN, LIGHT).on(Strings::High),
      strike(6, 0.25, UP, FULL),
      strike(7, 0.9, DOWN, SOFT).on(Strings::High),
    ],
  };
  // Two beats of sixteenths, the hand never stopping: ghosts between, the
  // one leaned on, a short hard chuck on the backbeat.
  const FUNK: Rhythm = Rhythm {
    cycle: 8,
    strikes: &[
      strike(0, 0.9, UP, ACCENT).tapered(),
      strike(1, 0.2, DOWN, GHOST).on(Strings::High),
      strike(2, 0.2, UP, GHOST),
      strike(3, 0.9, DOWN, LIGHT).on(Strings::High),
      strike(4, 0.3, UP, FULL).tapered(),
      strike(5, 0.2, DOWN, GHOST).on(Strings::High),
      strike(6, 0.9, UP, LIGHT),
      strike(7, 0.2, DOWN, GHOST).on(Strings::High),
    ],
  };
  // A mandolin's chop: the top strings struck and choked on the backbeat.
  const CHOP: Rhythm = Rhythm {
    cycle: 8,
    strikes: &[
      strike(2, 0.3, UP, ACCENT).on(Strings::High),
      strike(6, 0.3, UP, ACCENT).on(Strings::High),
    ],
  };
  // In triplets: a long down on the beat, a light up on its last third.
  const SHUFFLE: Rhythm = Rhythm {
    cycle: 6,
    strikes: &[
      strike(0, 1.9, UP, ACCENT).tapered(),
      strike(2, 0.9, DOWN, LIGHT).on(Strings::High),
      strike(3, 1.9, UP, 1.).tapered(),
      strike(5, 0.9, DOWN, SOFT).on(Strings::High),
    ],
  };
  // A bar of 6/8 in triplets: the first of each three leaned on, the first
  // of the bar hardest.
  const SIX_EIGHT: Rhythm = Rhythm {
    cycle: 6,
    strikes: &[
      strike(0, 1.9, UP, FULL).tapered(),
      strike(2, 0.9, DOWN, SOFT).on(Strings::High),
      strike(3, 0.9, UP, ACCENT).tapered(),
      strike(4, 0.9, DOWN, SOFT).on(Strings::High),
      strike(5, 0.9, UP, LIGHT),
    ],
  };
  // Two bars of eighths: the thumb on the root of each beat it doesn't
  // share with the fingers, which pluck the top strings at once, mostly off
  // it.
  const BOSSA: Rhythm = Rhythm {
    cycle: 16,
    strikes: &[
      strike(0, 2.9, None, ACCENT),
      strike(3, 0.9, None, LIGHT).on(Strings::High),
      strike(4, 1.9, None, 1.).on(Strings::Root),
      strike(6, 1.9, None, LIGHT).on(Strings::High),
      strike(8, 1.9, None, 1.).on(Strings::Root),
      strike(10, 1.9, None, 1.).on(Strings::High),
      strike(12, 0.9, None, 1.).on(Strings::Root),
      strike(13, 2.9, None, LIGHT).on(Strings::High),
    ],
  };
  // A bar of downs growing from soft to full, and one fading from full.
  const SWELL: Rhythm = Rhythm {
    cycle: 8,
    strikes: &[
      strike(0, 1.9, UP, SOFT),
      strike(2, 1.9, UP, LIGHT),
      strike(4, 1.9, UP, 1.),
      strike(6, 1.9, UP, FULL).tapered(),
    ],
  };
  const FADE: Rhythm = Rhythm {
    cycle: 8,
    strikes: &[
      strike(0, 1.9, UP, FULL).tapered(),
      strike(2, 1.9, UP, 1.),
      strike(4, 1.9, UP, LIGHT),
      strike(6, 1.9, UP, SOFT),
    ],
  };
  // Sixteenths of down-ups rising to a peak and falling back each two
  // beats.
  const TREMOLO: Rhythm = Rhythm {
    cycle: 8,
    strikes: &[
      strike(0, 0.9, UP, SOFT),
      strike(1, 0.9, DOWN, LIGHT),
      strike(2, 0.9, UP, 1.),
      strike(3, 0.9, DOWN, ACCENT),
      strike(4, 0.9, UP, FULL),
      strike(5, 0.9, DOWN, ACCENT),
      strike(6, 0.9, UP, 1.),
      strike(7, 0.9, DOWN, LIGHT),
    ],
  };
  const OFFBEAT: Rhythm = Rhythm {
    cycle: 2,
    strikes: &[strike(1, 0.5, None, 1.)],
  };
  const TRESILLO: Rhythm = Rhythm {
    cycle: 8,
    strikes: &[
      strike(0, 2.5, None, 1.),
      strike(3, 2.5, None, 1.),
      strike(6, 1.5, None, 1.),
    ],
  };
  const GALLOP: Rhythm = Rhythm {
    cycle: 4,
    strikes: &[
      strike(0, 1.5, None, 1.),
      strike(2, 0.75, None, 1.),
      strike(3, 0.75, None, 1.),
    ],
  };
  Some(match id {
    "pulse" => &PULSE,
    "accentPulse" => &ACCENT_PULSE,
    "strumPulse" => &STRUM_PULSE,
    "downUp" => &DOWN_UP,
    "accentDownUp" => &ACCENT_DOWN_UP,
    "folkStrum" => &FOLK,
    "rockEighths" => &ROCK,
    "skank" => &SKANK,
    "waltzStrum" => &WALTZ,
    "boomChuck" => &BOOM_CHUCK,
    "backbeatStrum" => &BACKBEAT,
    "popPush" => &POP_PUSH,
    "rumbaStrum" => &RUMBA,
    "funkSixteenths" => &FUNK,
    "chopStrum" => &CHOP,
    "shuffleStrum" => &SHUFFLE,
    "sixEightStrum" => &SIX_EIGHT,
    "bossaStrum" => &BOSSA,
    "swellStrum" => &SWELL,
    "fadeStrum" => &FADE,
    "tremoloStrum" => &TREMOLO,
    "offbeat" => &OFFBEAT,
    "tresillo" => &TRESILLO,
    "gallop" => &GALLOP,
    _ => return None,
  })
}

/// How the chord pads play their chords: a pattern, at a rate, with a
/// strum's gap; and the saved play style it was picked as, if it was.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayStyle {
  pub id: String,
  pub per_beat: u32,
  pub strum: u32,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub saved: Option<String>,
}

impl Default for PlayStyle {
  fn default() -> Self {
    Self {
      id: "block".into(),
      per_beat: 4,
      strum: 20,
      saved: None,
    }
  }
}

impl PlayStyle {
  /// Whether it is one web-react would keep (`isPlayStyle`).
  pub fn is_valid(&self) -> bool {
    PLAY_STYLES.iter().any(|style| style.id == self.id)
      && CHORD_RATES.contains(&self.per_beat)
      && STRUM_GAPS.contains(&self.strum)
  }
}

/// A play style saved from the Device: a built-in pattern at its own rate
/// and strum, under its own name.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedPlayStyle {
  pub id: String,
  pub name: String,
  pub pattern: String,
  pub per_beat: u32,
  pub strum: u32,
}

impl SavedPlayStyle {
  /// Whether it's a play style web-react would keep.
  pub fn is_valid(&self) -> bool {
    PlayStyle {
      id: self.pattern.clone(),
      per_beat: self.per_beat,
      strum: self.strum,
      saved: None,
    }
    .is_valid()
  }
}

/// The rate a built-in style starts at: the pulses a strike a beat, the
/// triplet strums in triplets and the sixteenth strums in sixteenths, the
/// other rhythms, strums and arpeggios in eighths, and a roll in sixteenths.
fn starting_rate(id: &str, group: PlayStyleGroup) -> u32 {
  match id {
    "pulse" | "accentPulse" => 1,
    "shuffleStrum" | "sixEightStrum" => 3,
    "funkSixteenths" | "tremoloStrum" => 4,
    _ if group == PlayStyleGroup::Held => PlayStyle::default().per_beat,
    _ => 2,
  }
}

/// A play style as the view lists it.
#[derive(Clone, Debug, PartialEq)]
pub struct PlayStyleOption {
  pub id: String,
  pub name: String,
  /// Its group's name, or "Saved".
  pub group: &'static str,
  pub settings: &'static [Setting],
  /// What picking it plays.
  pub style: PlayStyle,
}

/// The built-in ones at their starting rate and the default strum, then
/// the saved ones, each at its own, in a group of their own.
pub fn play_style_options(saved: &[SavedPlayStyle]) -> Vec<PlayStyleOption> {
  let built_in = PLAY_STYLES.iter().map(|spec| PlayStyleOption {
    id: spec.id.into(),
    name: spec.name.into(),
    group: spec.group.name(),
    settings: spec.settings,
    style: PlayStyle {
      id: spec.id.into(),
      per_beat: starting_rate(spec.id, spec.group),
      ..PlayStyle::default()
    },
  });
  let saved = saved.iter().map(|saved| PlayStyleOption {
    id: saved.id.clone(),
    name: saved.name.clone(),
    group: "Saved",
    settings: play_style_spec(&saved.pattern).settings,
    style: PlayStyle {
      id: saved.pattern.clone(),
      per_beat: saved.per_beat,
      strum: saved.strum,
      saved: Some(saved.id.clone()),
    },
  });
  built_in.chain(saved).collect()
}

/// Whether `current` has moved off what `option` plays, in a setting it
/// uses.
pub fn style_edited(current: &PlayStyle, option: &PlayStyleOption) -> bool {
  option.settings.iter().any(|setting| match setting {
    Setting::Rate => current.per_beat != option.style.per_beat,
    Setting::Strum => current.strum != option.style.strum,
  })
}

/// A pattern's steps, each the notes it sounds as indices from the lowest.
pub fn steps_of(id: &str, count: usize) -> Vec<Vec<usize>> {
  let all: Vec<usize> = (0..count).collect();
  let top = count.saturating_sub(1);
  match id {
    "up" => all.iter().map(|&i| vec![i]).collect(),
    "down" => all.iter().map(|&i| vec![top - i]).collect(),
    "upDown" => {
      let mut order = all.clone();
      if count > 2 {
        order.extend(all[1..count - 1].iter().rev());
      }
      order.into_iter().map(|i| vec![i]).collect()
    }
    "broken" => vec![vec![0], all[1..].to_vec()],
    "alberti" if count < 3 => all.iter().map(|&i| vec![i]).collect(),
    "alberti" => vec![vec![0], vec![top], vec![1], vec![top]],
    _ => vec![all],
  }
}

/// A held chord in `style` as notes laid out ahead (ms from its start), as
/// the live player would play it held for `length` at a step of `step_ms`:
/// for writing a chord into the take rather than playing it live.
pub fn chord_notes(
  midis: &[i32],
  style: &PlayStyle,
  step_ms: f64,
  length: f64,
  velocity: f64,
) -> Vec<PlayedNote> {
  let mut notes = midis.to_vec();
  notes.sort_unstable();
  let mut out = Vec::new();
  let mut add = |note: i32, start: f64, end: f64, level: f64| {
    if start < length && end > start {
      out.push(PlayedNote {
        note,
        start,
        duration: end.min(length) - start,
        velocity: (velocity * level).min(1.),
      });
    }
  };
  let id = style.id.as_str();
  if id == "block" || notes.len() < 2 {
    for &note in &notes {
      add(note, 0., length, 1.);
    }
  } else if let Some(rhythm) = rhythm(id) {
    let mut count = 0u32;
    while f64::from(count) * step_ms < length {
      let at = count % rhythm.cycle;
      let start = f64::from(count) * step_ms;
      for strike in rhythm.strikes.iter().filter(|strike| strike.at == at) {
        let gap = if strike.sweep.is_some() {
          f64::from(style.strum)
        } else {
          0.
        };
        let end = start + strike.hold * step_ms;
        for (i, (note, level)) in strike_notes(&notes, strike).into_iter().enumerate() {
          add(note, start + i as f64 * gap, end, level);
        }
      }
      count += 1;
    }
  } else if id == "rollPulse" {
    let mut count = 0usize;
    while count as f64 * step_ms < length {
      let at = count % notes.len();
      let start = count as f64 * step_ms;
      add(
        notes[at],
        start,
        start + (notes.len() - at) as f64 * step_ms,
        1.,
      );
      count += 1;
    }
  } else if id == "strum" || id == "roll" {
    let gap = if id == "roll" {
      step_ms
    } else {
      f64::from(style.strum)
    };
    for (i, &note) in notes.iter().enumerate() {
      add(note, i as f64 * gap, length, 1.);
    }
  } else {
    let steps = steps_of(id, notes.len());
    let mut count = 0usize;
    while count as f64 * step_ms < length {
      let start = count as f64 * step_ms;
      for &index in &steps[count % steps.len()] {
        add(notes[index], start, start + step_ms, 1.);
      }
      count += 1;
    }
  }
  out
}

#[cfg(test)]
mod tests {
  use super::*;

  fn style(id: &str, per_beat: u32) -> PlayStyle {
    PlayStyle {
      id: id.into(),
      per_beat,
      ..PlayStyle::default()
    }
  }

  #[test]
  fn arpeggios_step_through_the_notes() {
    assert_eq!(
      steps_of("upDown", 4),
      vec![vec![0], vec![1], vec![2], vec![3], vec![2], vec![1]]
    );
    assert_eq!(
      steps_of("alberti", 3),
      vec![vec![0], vec![2], vec![1], vec![2]]
    );
    assert_eq!(steps_of("broken", 3), vec![vec![0], vec![1, 2]]);
  }

  #[test]
  fn chords_lay_out_ahead() {
    let block = chord_notes(&[64, 60, 67], &PlayStyle::default(), 125., 1000., 0.8);
    assert_eq!(
      block.iter().map(|note| note.note).collect::<Vec<_>>(),
      vec![60, 64, 67]
    );
    assert!(block.iter().all(|note| note.duration == 1000.));
    let up = chord_notes(&[60, 64, 67], &style("up", 4), 250., 1000., 0.8);
    assert_eq!(
      up.iter()
        .map(|note| (note.note, note.start))
        .collect::<Vec<_>>(),
      vec![(60, 0.), (64, 250.), (67, 500.), (60, 750.)]
    );
    let accent = chord_notes(&[60, 64], &style("accentPulse", 1), 250., 1000., 0.8);
    assert_eq!(accent.len(), 8);
    assert_eq!(accent[4].velocity, 1.);
  }

  #[test]
  fn options_list_built_ins_then_saved() {
    let saved = SavedPlayStyle {
      id: "style-1".into(),
      name: "Strum 2".into(),
      pattern: "strum".into(),
      per_beat: 4,
      strum: 40,
    };
    let options = play_style_options(&[saved]);
    assert_eq!(options.len(), PLAY_STYLES.len() + 1);
    assert_eq!(options[3].style.per_beat, 1);
    let last = options.len() - 1;
    assert_eq!(options[last].group, "Saved");
    assert!(style_edited(&style("strum", 4), &options[last]));
  }
}
