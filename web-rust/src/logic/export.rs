//! Saving the mix, as web-react's `exportMix.ts`: the tracks' rendered
//! passes summed through a limiter into FLAC, or their notes as a Standard
//! MIDI File.

use std::rc::Rc;

use sound_engine::dsp::peak_limiter::PeakLimiter;

use super::js::round;
use super::timing::{Meter, PlayedNote};

/// A rendered pass of a track: its two channels at the mix's rate.
#[derive(Clone, Debug)]
pub struct Rendered {
  pub left: Rc<Vec<f32>>,
  pub right: Rc<Vec<f32>>,
  pub rate: f64,
}

impl Rendered {
  pub fn len(&self) -> usize {
    self.left.len()
  }

  /// How long it plays, in seconds.
  pub fn duration(&self) -> f64 {
    self.len() as f64 / self.rate
  }
}

/// A rendered track in the mix: one pass of its audio, laid at each of its
/// starts (ms on the timeline), at its level.
#[derive(Clone, Debug)]
pub struct MixPart {
  pub buffer: Rendered,
  pub starts: Vec<f64>,
  pub level: f64,
}

/// Adds the parts' audio from `start` ms into `left` and `right`, as far as
/// they reach, at `rate`.
pub fn mix_into(parts: &[MixPart], start: f64, left: &mut [f32], right: &mut [f32], rate: f64) {
  for part in parts {
    let (l, r) = (&part.buffer.left, &part.buffer.right);
    for &at in &part.starts {
      let offset = round((at - start) * rate / 1000.) as i64;
      let from = (-offset).max(0);
      let to = (part.buffer.len() as i64).min(left.len() as i64 - offset);
      for i in from..to {
        let (j, i) = ((offset + i) as usize, i as usize);
        left[j] = (f64::from(left[j]) + part.level * f64::from(l[i])) as f32;
        right[j] = (f64::from(right[j]) + part.level * f64::from(r[i])) as f32;
      }
    }
  }
}

/// The mix's length (ms): until the last pass's rendered tail ends.
pub fn mix_length(parts: &[MixPart]) -> f64 {
  parts
    .iter()
    .flat_map(|part| {
      part
        .starts
        .iter()
        .map(|at| at + part.buffer.duration() * 1000.)
    })
    .fold(0., f64::max)
}

const CHUNK_SECONDS: usize = 10;
/// The tracks are summed outside the engine, so the export gets its own
/// limiter, a touch under full scale.
const CEILING: f64 = 0.891;

/// Builds the whole mix a chunk at a time through the limiter, so an
/// hour-long mix never sits in memory whole.
pub struct MixChunks<'a> {
  parts: &'a [MixPart],
  rate: f64,
  limiter: PeakLimiter,
  done: usize,
  total: usize,
}

impl<'a> MixChunks<'a> {
  pub fn new(parts: &'a [MixPart], rate: f64) -> Self {
    let limiter = PeakLimiter::new(rate, CEILING);
    // Run on past the end by the limiter's delay, so the tail comes out.
    let total = (mix_length(parts) * rate / 1000.).ceil() as usize + limiter.latency();
    Self {
      parts,
      rate,
      limiter,
      done: 0,
      total,
    }
  }

  /// How much is done, 0–1.
  pub fn progress(&self) -> f64 {
    if self.total == 0 {
      1.
    } else {
      self.done as f64 / self.total as f64
    }
  }
}

impl Iterator for MixChunks<'_> {
  type Item = (Vec<f32>, Vec<f32>);

  fn next(&mut self) -> Option<Self::Item> {
    if self.done >= self.total {
      return None;
    }
    let size = CHUNK_SECONDS * self.rate as usize;
    let frames = size.min(self.total - self.done);
    let mut left = vec![0.; frames];
    let mut right = vec![0.; frames];
    mix_into(
      self.parts,
      self.done as f64 * 1000. / self.rate,
      &mut left,
      &mut right,
      self.rate,
    );
    for (l, r) in left.iter_mut().zip(right.iter_mut()) {
      self.limiter.process(f64::from(*l), f64::from(*r));
      *l = self.limiter.left as f32;
      *r = self.limiter.right as f32;
    }
    self.done += frames;
    Some((left, right))
  }
}

/// General MIDI programs (0-based) for each instrument, near enough.
fn gm_program(target: &str) -> u8 {
  match target {
    "piano" => 0,
    "guitar" => 25,
    "electricGuitar" => 27,
    "nylonGuitar" | "ukulele" => 24,
    "banjo" => 105,
    "bass" => 33,
    "uprightBass" => 32,
    "harp" => 46,
    "sitar" => 104,
    "violin" => 40,
    "cello" => 42,
    "trumpet" => 56,
    "bassTrumpet" | "trombone" => 57,
    "saxophone" => 65,
    "clarinet" => 71,
    "flute" => 73,
    "harmonium" => 20,
    "harmonica" => 22,
    "accordion" => 21,
    "xylophone" => 13,
    "steelPan" => 114,
    "kalimba" => 108,
    "oscillator" => 80,
    _ => 0,
  }
}

/// General MIDI percussion keys for each drum piece; the hand-drum bols
/// take the conga and bongo keys nearest their sound, and the brush sweep
/// the brush kits' swirl.
pub fn gm_drum(piece: &str) -> i32 {
  match piece {
    "kick" => 36,
    "snare" => 38,
    "closedHat" => 42,
    "openHat" => 46,
    "clap" => 39,
    "lowTom" => 45,
    "highTom" => 50,
    "cowbell" => 56,
    "crash" => 49,
    "ride" => 51,
    "sweep" => 40,
    "stick" => 37,
    "sticks" => 31,
    "bell" => 53,
    "tambourine" => 54,
    "na" | "dha" => 63,
    "ta" => 62,
    "tin" | "dhin" => 60,
    "tun" | "ge" => 64,
    "te" | "ti" => 61,
    "ke" | "ka" => 75,
    _ => 36,
  }
}

/// A track for the MIDI file: its notes as they sound on the timeline (ms),
/// already at their sounding pitch, or as drum pieces for a kit.
#[derive(Clone, Debug)]
pub struct MidiPart {
  pub name: String,
  pub target: String,
  pub kit: bool,
  pub volume: f64,
  pub notes: Vec<(PlayedNote, Option<&'static str>)>,
}

const PPQ: u32 = 480;
const DRUM_CHANNEL: u8 = 9;

fn vlq(value: u32) -> Vec<u8> {
  let mut bytes = vec![(value & 0x7f) as u8];
  let mut v = value >> 7;
  while v > 0 {
    bytes.insert(0, ((v & 0x7f) | 0x80) as u8);
    v >>= 7;
  }
  bytes
}

fn chunk(kind: &[u8; 4], body: &[u8]) -> Vec<u8> {
  let mut bytes = kind.to_vec();
  bytes.extend((body.len() as u32).to_be_bytes());
  bytes.extend_from_slice(body);
  bytes
}

/// A track's events by absolute tick, as delta-timed bytes with its end.
fn track_bytes(events: &[(u32, Vec<u8>)]) -> Vec<u8> {
  let mut body = Vec::new();
  let mut last = 0;
  for (tick, bytes) in events {
    body.extend(vlq(tick - last));
    body.extend(bytes);
    last = *tick;
  }
  body.extend([0, 0xff, 0x2f, 0]);
  chunk(b"MTrk", &body)
}

fn text_event(kind: u8, text: &str) -> Vec<u8> {
  let mut bytes = vec![0xff, kind];
  bytes.extend(vlq(text.len() as u32));
  bytes.extend(text.as_bytes());
  bytes
}

/// A Standard MIDI File (type 1): a tempo and meter track, then a track
/// per part on its own channel (kits on the drum channel) with its program
/// and volume.
pub fn mix_to_midi(parts: &[MidiPart], bpm: f64, meter: Meter) -> Vec<u8> {
  let per_beat = f64::from(PPQ * 4 / meter.unit);
  let tick = |ms: f64| round(ms * bpm * per_beat / 60_000.).max(0.) as u32;
  let quarter = round(60e6 / bpm * (f64::from(meter.unit) / 4.)) as u32;
  let conductor = track_bytes(&[
    (0, text_event(0x03, "Studio")),
    (
      0,
      vec![
        0xff,
        0x51,
        3,
        (quarter >> 16) as u8,
        (quarter >> 8) as u8,
        quarter as u8,
      ],
    ),
    (
      0,
      vec![
        0xff,
        0x58,
        4,
        meter.beats as u8,
        meter.unit.trailing_zeros() as u8,
        24,
        8,
      ],
    ),
  ]);
  let mut channel = 0u8;
  let tracks: Vec<Vec<u8>> = parts
    .iter()
    .map(|part| {
      let mut ch = DRUM_CHANNEL;
      if !part.kit {
        if channel == DRUM_CHANNEL {
          channel += 1;
        }
        ch = channel % 16;
        channel += 1;
      }
      // (tick, order, bytes): at one tick, note-offs come before note-ons,
      // so repeats retrigger.
      let mut events: Vec<(u32, u8, Vec<u8>)> = vec![
        (0, 0, text_event(0x03, &part.name)),
        (
          0,
          0,
          vec![0xb0 | ch, 7, round(part.volume.min(1.) * 127.) as u8],
        ),
      ];
      if !part.kit {
        events.push((0, 0, vec![0xc0 | ch, gm_program(&part.target)]));
      }
      for (note, piece) in &part.notes {
        let key = match piece {
          Some(piece) if part.kit => gm_drum(piece),
          _ => note.note,
        };
        if !(0..=127).contains(&key) {
          continue;
        }
        let on = tick(note.start);
        let off = (on + 1).max(tick(note.start + note.duration));
        let level = round(note.velocity * 127.).clamp(1., 127.) as u8;
        events.push((on, 2, vec![0x90 | ch, key as u8, level]));
        events.push((off, 1, vec![0x80 | ch, key as u8, 0]));
      }
      // Stable, as JavaScript's sort is.
      events.sort_by_key(|(tick, order, _)| (*tick, *order));
      let timed: Vec<(u32, Vec<u8>)> = events
        .into_iter()
        .map(|(tick, _, bytes)| (tick, bytes))
        .collect();
      track_bytes(&timed)
    })
    .collect();
  let count = tracks.len() as u32 + 1;
  let mut file = chunk(
    b"MThd",
    &[
      0,
      1,
      (count >> 8) as u8,
      count as u8,
      (PPQ >> 8) as u8,
      PPQ as u8,
    ],
  );
  file.extend(conductor);
  for track in tracks {
    file.extend(track);
  }
  file
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::logic::timing::FOUR_FOUR;

  fn rendered(samples: Vec<f32>) -> Rendered {
    Rendered {
      left: Rc::new(samples.clone()),
      right: Rc::new(samples),
      rate: 1000.,
    }
  }

  #[test]
  fn parts_mix_at_their_starts() {
    let parts = vec![MixPart {
      buffer: rendered(vec![1., 0.5]),
      starts: vec![0., 3.],
      level: 0.5,
    }];
    let mut left = vec![0.; 6];
    let mut right = vec![0.; 6];
    mix_into(&parts, 0., &mut left, &mut right, 1000.);
    assert_eq!(left, vec![0.5, 0.25, 0., 0.5, 0.25, 0.]);
    assert_eq!(mix_length(&parts), 5.);
  }

  #[test]
  fn variable_length_quantities() {
    assert_eq!(vlq(0), vec![0]);
    assert_eq!(vlq(0x7f), vec![0x7f]);
    assert_eq!(vlq(0x80), vec![0x81, 0]);
    assert_eq!(vlq(0x3fff), vec![0xff, 0x7f]);
  }

  #[test]
  fn midi_files_have_a_track_a_part() {
    let note = PlayedNote {
      note: 60,
      start: 0.,
      duration: 500.,
      velocity: 0.8,
    };
    let file = mix_to_midi(
      &[MidiPart {
        name: "Piano".into(),
        target: "piano".into(),
        kit: false,
        volume: 1.,
        notes: vec![(note, None)],
      }],
      120.,
      FOUR_FOUR,
    );
    assert_eq!(&file[..4], b"MThd");
    assert_eq!(file[11], 2);
    // 500 ms at 120 is a beat, 480 ticks.
    let off = [0x83, 0x60, 0x80, 60, 0];
    assert!(file.windows(5).any(|window| window == off));
  }
}
