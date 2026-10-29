//! The engine: every instrument, the shared reverb and the master stage,
//! ported from `web-react/app/lib/physical/engine/Engine.ts`.

pub mod bus;
pub mod chain;
pub mod event_queue;
pub mod instrument;
pub mod master_fx;
pub mod master_lfo;
pub mod modules;
pub mod param_set;
pub mod voice;

use bus::MAX_BLOCK;
use event_queue::EventQueue;
use instrument::Instrument;
use master_fx::MasterFx;
use master_lfo::MasterLfo;
use param_set::{ParamSet, Values};

use crate::dsp::fdn::Fdn;
use crate::dsp::generators::Smoother;
use crate::dsp::math::js_round;
use crate::dsp::peak_limiter::PeakLimiter;
use crate::messages::{EngineEvent, EngineStats};
use crate::models::drums::Woodblock;
use crate::patches::{bus_index, data, piece_index};

/// Params to start from, by owner: an instrument's id, or "master".
pub type Overrides = std::collections::HashMap<String, Values>;

/// The master limiter turns coherent chord transients (sub-millisecond, too
/// fast for the browser's compressor) down to −3 dBFS. The tanh knee above
/// it is a last resort, unity below −3 dBFS.
const CLIP_KNEE: f64 = 0.7;
/// The master ADSR's shortest attack, which counts as none.
const MIN_ATTACK: f64 = 0.001;
/// The most warnings kept between drains; later ones are dropped.
const MAX_WARNINGS: usize = 32;

/// The last-resort clip: unity up to the knee, then a tanh curve that never
/// passes full scale.
fn safety_clip(x: f64) -> f64 {
  let level = x.abs();
  if level <= CLIP_KNEE {
    return x;
  }
  let y = CLIP_KNEE + (1. - CLIP_KNEE) * ((level - CLIP_KNEE) / (1. - CLIP_KNEE)).tanh();
  if x < 0. { -y } else { y }
}

/// An event resolved to the buses and params it names, so applying it at
/// its frame needs no lookups.
#[derive(Clone, Copy, Debug)]
pub enum Event {
  /// Plays a note on the instrument at `bus`.
  NoteOn {
    bus: usize,
    note: i32,
    velocity: f64,
  },
  /// Releases a note on the instrument at `bus`.
  NoteOff { bus: usize, note: i32 },
  /// Presses or lets go of the sustain pedal of the instrument at `bus`.
  Sustain { bus: usize, down: bool },
  /// Hits the piece at index `piece` of the kit at `bus`.
  Hit {
    bus: usize,
    piece: usize,
    velocity: f64,
  },
  /// A metronome tick, louder on the bar's first beat.
  Tick { accent: bool },
  /// `bus` None is the master.
  Param {
    bus: Option<usize>,
    index: usize,
    value: f64,
  },
  /// Releases every instrument's notes.
  AllNotesOff,
  /// Silences every voice and the reverb at once.
  Panic,
}

/// Owns every instrument, the shared reverb and the master stage. render()
/// allocates nothing; events apply at their exact frame by splitting the
/// block into segments.
///
/// The host builds one with [`new`](Self::new) (or
/// [`with_overrides`](Self::with_overrides) for an offline render), queues
/// what the Device plays with [`schedule`](Self::schedule) or
/// [`schedule_json`](Self::schedule_json) (notes, hits, ticks, params, each at
/// a time on the engine's clock or as soon as possible), and calls
/// [`render`](Self::render) for every block the audio thread asks for.
/// [`stats`](Self::stats) and [`drain_warnings`](Self::drain_warnings) say
/// how it's doing.
pub struct Engine {
  pub fs: f64,
  pub instruments: Vec<Instrument>,
  pub master: ParamSet,
  pub frame: f64,
  queue: EventQueue,
  reverb: Fdn,
  lfo: MasterLfo,
  fx: MasterFx,
  woodblock: Woodblock,
  reverb_in: Vec<f32>,
  master_l: Vec<f32>,
  master_r: Vec<f32>,
  wet_l: Vec<f32>,
  wet_r: Vec<f32>,
  /// The metronome joins after the LFO and FX, so its click stays steady.
  click_l: Vec<f32>,
  click_r: Vec<f32>,
  volume: Smoother,
  reverb_return: Smoother,
  limiter: PeakLimiter,
  warnings: Vec<String>,
}

impl Engine {
  /// An engine at `fs` with every instrument and the master at their defaults.
  pub fn new(fs: f64) -> Self {
    Self::with_overrides(fs, &Overrides::new())
  }

  /// An engine whose instruments and master start at `overrides` (params by
  /// owner: an instrument's id, or "master"), as web-react's renders set one
  /// up.
  pub fn with_overrides(fs: f64, overrides: &Overrides) -> Self {
    let data = data();
    let master = ParamSet::with(&data.master, overrides.get("master"));
    let mut engine = Self {
      fs,
      instruments: data
        .patches
        .iter()
        .map(|patch| Instrument::with(patch, fs, overrides.get(patch.id())))
        .collect(),
      volume: Smoother::new(master.get("master.volume"), fs),
      reverb_return: Smoother::new(master.get("reverb.return"), fs),
      master,
      frame: 0.,
      queue: EventQueue::new(4096),
      reverb: Fdn::new(fs),
      lfo: MasterLfo::new(fs),
      fx: MasterFx::new(fs),
      woodblock: Woodblock::new(fs),
      reverb_in: vec![0.; MAX_BLOCK],
      master_l: vec![0.; MAX_BLOCK],
      master_r: vec![0.; MAX_BLOCK],
      wet_l: vec![0.; MAX_BLOCK],
      wet_r: vec![0.; MAX_BLOCK],
      click_l: vec![0.; MAX_BLOCK],
      click_r: vec![0.; MAX_BLOCK],
      limiter: PeakLimiter::new(fs, CLIP_KNEE),
      warnings: Vec::with_capacity(MAX_WARNINGS),
    };
    engine.apply_master();
    engine
  }

  /// Queues an event. Its time is in seconds on the engine's clock; none
  /// means as soon as possible, which the render loop clamps to the start
  /// of the next block.
  pub fn schedule(&mut self, event: &EngineEvent) {
    let frame = event.time().map_or(-1., |time| js_round(time * self.fs));
    let Some(event) = self.resolve(event) else {
      return;
    };
    if !self.queue.push(event, frame) {
      self.warn("Event queue full".into());
    }
  }

  /// Queues the events in a JSON array (or a single event).
  pub fn schedule_json(&mut self, json: &str) {
    match serde_json::from_str::<Events>(json) {
      Ok(Events::Many(events)) => {
        for event in &events {
          self.schedule(event);
        }
      }
      Ok(Events::One(event)) => self.schedule(&event),
      Err(error) => self.warn(format!("Bad event: {error}")),
    }
  }

  /// The warnings since the last drain (bad events, unknown params, a full
  /// queue, a model's own), clearing them.
  pub fn drain_warnings(&mut self) -> Vec<String> {
    std::mem::take(&mut self.warnings)
  }

  /// What the Debug panel shows of the engine: the sounding voices and whether
  /// the reverb is awake.
  pub fn stats(&self) -> EngineStats {
    EngineStats {
      active_voices: self.active_voices(),
      reverb_awake: !self.reverb.sleeping,
    }
  }

  /// How many voices are sounding, the metronome's included.
  pub fn active_voices(&self) -> usize {
    let voices: usize = self.instruments.iter().map(Instrument::active_voices).sum();
    voices + usize::from(self.woodblock.active())
  }

  /// Renders `left.len()` frames.
  pub fn render(&mut self, left: &mut [f32], right: &mut [f32]) {
    let total = left.len();
    let mut offset = 0;
    while offset < total {
      let n = MAX_BLOCK.min(total - offset);
      self.render_block(
        &mut left[offset..offset + n],
        &mut right[offset..offset + n],
      );
      offset += n;
    }
  }

  /// Renders one block of at most [`MAX_BLOCK`] frames: the instruments in
  /// segments between the events due in it, then the buses into the master
  /// and the reverb, the master LFO and FX, the metronome, the volume, the
  /// limiter and the clip.
  fn render_block(&mut self, left: &mut [f32], right: &mut [f32]) {
    let n = left.len();
    let start = self.frame;
    let end = start + n as f64;
    let mut segment = 0;
    while self.queue.peek_frame() < end {
      let at = (self.queue.peek_frame() - start).max(0.) as usize;
      if at > segment {
        self.render_segment(segment, at);
        segment = at;
      }
      if let Some(event) = self.queue.pop() {
        self.apply(event, start + at as f64);
      }
    }
    self.render_segment(segment, n);

    for instrument in &mut self.instruments {
      instrument.finish(
        n,
        &mut self.master_l,
        &mut self.master_r,
        &mut self.reverb_in,
      );
      if let Some(warning) = instrument.bus.warning.take()
        && self.warnings.len() < MAX_WARNINGS
      {
        self.warnings.push(warning);
      }
    }
    self
      .reverb
      .process(&self.reverb_in, &mut self.wet_l, &mut self.wet_r, n);
    self.lfo.process(&mut self.master_l, &mut self.master_r, n);
    self.fx.process(&mut self.master_l, &mut self.master_r, n);
    for i in 0..n {
      let g = self.volume.process();
      let wet = self.reverb_return.process();
      self.limiter.process(
        g * (self.master_l[i] as f64 + self.click_l[i] as f64 + wet * self.wet_l[i] as f64),
        g * (self.master_r[i] as f64 + self.click_r[i] as f64 + wet * self.wet_r[i] as f64),
      );
      left[i] = safety_clip(self.limiter.left) as f32;
      right[i] = safety_clip(self.limiter.right) as f32;
    }
    for buffer in [
      &mut self.master_l,
      &mut self.master_r,
      &mut self.click_l,
      &mut self.click_r,
      &mut self.reverb_in,
      &mut self.wet_l,
      &mut self.wet_r,
    ] {
      buffer[..n].fill(0.);
    }
    self.frame = end;
  }

  /// Renders the instruments and the metronome for the frames `from..to` of the
  /// block.
  fn render_segment(&mut self, from: usize, to: usize) {
    if to <= from {
      return;
    }
    for instrument in &mut self.instruments {
      instrument.render(from, to);
    }
    self
      .woodblock
      .render(&mut self.click_l, &mut self.click_r, from, to);
  }

  /// Resolves an event's names to indices (the instrument's bus, the kit's
  /// piece, the param), warning about and dropping one that names something
  /// unknown.
  fn resolve(&mut self, event: &EngineEvent) -> Option<Event> {
    Some(match event {
      EngineEvent::NoteOn {
        instrument,
        note,
        velocity,
        ..
      } => Event::NoteOn {
        bus: bus_index(instrument)?,
        note: *note as i32,
        velocity: *velocity,
      },
      EngineEvent::NoteOff {
        instrument, note, ..
      } => Event::NoteOff {
        bus: bus_index(instrument)?,
        note: *note as i32,
      },
      EngineEvent::Sustain {
        instrument, down, ..
      } => Event::Sustain {
        bus: bus_index(instrument)?,
        down: *down,
      },
      EngineEvent::Hit {
        kit,
        piece,
        velocity,
        ..
      } => Event::Hit {
        bus: bus_index(kit)?,
        piece: piece_index(piece)?,
        velocity: *velocity,
      },
      EngineEvent::Tick { accent, .. } => Event::Tick { accent: *accent },
      EngineEvent::Param {
        target, id, value, ..
      } => {
        if target == "master" {
          let Some(index) = self.master.index(id) else {
            self.warn(format!("Unknown master param \"{id}\""));
            return None;
          };
          Event::Param {
            bus: None,
            index,
            value: *value,
          }
        } else {
          let bus = bus_index(target);
          let Some((bus, index)) =
            bus.and_then(|bus| Some((bus, self.instruments[bus].bus.params.index(id)?)))
          else {
            self.warn(format!("Unknown param \"{id}\" for {target}"));
            return None;
          };
          Event::Param {
            bus: Some(bus),
            index,
            value: *value,
          }
        }
      }
      EngineEvent::AllNotesOff => Event::AllNotesOff,
      EngineEvent::Panic => Event::Panic,
    })
  }

  /// Applies an event at `frame`, which every bus takes as its clock.
  fn apply(&mut self, event: Event, frame: f64) {
    for instrument in &mut self.instruments {
      instrument.bus.clock = frame;
    }
    match event {
      Event::NoteOn {
        bus,
        note,
        velocity,
      } => self.instruments[bus].note_on(note, velocity),
      Event::NoteOff { bus, note } => self.instruments[bus].note_off(note),
      Event::Sustain { bus, down } => self.instruments[bus].sustain(down),
      Event::Hit {
        bus,
        piece,
        velocity,
      } => self.instruments[bus].hit(crate::patches::PIECE_ORDER[piece], velocity),
      Event::Tick { accent } => self.woodblock.hit(accent),
      Event::Param {
        bus: None,
        index,
        value,
      } => {
        if self.master.set_index(index, value) {
          self.apply_master();
        }
      }
      Event::Param {
        bus: Some(bus),
        index,
        value,
      } => {
        self.instruments[bus].set_param(index, value);
      }
      Event::AllNotesOff => {
        for instrument in &mut self.instruments {
          instrument.all_notes_off();
        }
      }
      Event::Panic => {
        for instrument in &mut self.instruments {
          instrument.panic();
        }
        self.reverb.clear();
      }
    }
  }

  /// Hands the master's params to the reverb, LFO, FX, volume and every
  /// instrument's master ADSR.
  fn apply_master(&mut self) {
    let m = &self.master;
    self.volume.set(m.get("master.volume"));
    self.reverb_return.set(m.get("reverb.return"));
    self.reverb.set_size(m.get("reverb.size"));
    self.reverb.set_decay(m.get("reverb.decay"));
    self.reverb.set_damping(m.get("reverb.damping"));
    self.reverb.set_predelay(m.get("reverb.predelay"));
    self.lfo.set(
      m.get("lfo.rate"),
      m.get("lfo.depth"),
      js_round(m.get("lfo.shape")) as i32,
      js_round(m.get("lfo.target")) as i32,
    );
    self
      .fx
      .set(m.get("fx.drive"), m.get("fx.chorus"), m.get("fx.delay"));
    // The shortest attack means none, so the default adds no fade-in.
    let mut shape = m.envelope("adsr");
    if shape.attack <= MIN_ATTACK {
      shape.attack = 0.;
    }
    for instrument in &mut self.instruments {
      instrument.set_shape(shape);
    }
  }

  /// Keeps a warning for the next drain, unless the list is full.
  fn warn(&mut self, message: String) {
    if self.warnings.len() < MAX_WARNINGS {
      self.warnings.push(message);
    }
  }
}

/// What `schedule_json` reads: an array of events, or one.
#[derive(serde::Deserialize)]
#[serde(untagged)]
enum Events {
  /// An array of events.
  Many(Vec<EngineEvent>),
  /// A single event.
  One(EngineEvent),
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::patches::Patch;

  const FS: f64 = 48000.;

  fn render(engine: &mut Engine, seconds: f64) -> f32 {
    let frames = (seconds * FS) as usize;
    let (mut left, mut right) = (vec![0.; frames], vec![0.; frames]);
    for start in (0..frames).step_by(128) {
      let end = frames.min(start + 128);
      engine.render(&mut left[start..end], &mut right[start..end]);
    }
    left.iter().chain(&right).fold(0f32, |peak, x| {
      assert!(x.is_finite());
      peak.max(x.abs())
    })
  }

  #[test]
  fn every_bus_sounds_and_lets_its_voices_go() {
    let mut engine = Engine::new(FS);
    for patch in &data().patches {
      let event = match patch {
        Patch::Drums(kit) => format!(
          r#"{{"type":"hit","kit":"{}","piece":"{}","velocity":0.8}}"#,
          kit.base.id, kit.keys[0]
        ),
        _ => format!(
          r#"{{"type":"noteOn","instrument":"{}","note":60,"velocity":0.8}}"#,
          patch.id()
        ),
      };
      engine.schedule_json(&event);
      let peak = render(&mut engine, 0.5);
      assert!(peak > 0.01, "{} is silent", patch.id());
      engine.schedule_json(r#"{"type":"allNotesOff"}"#);
      render(&mut engine, 12.);
      assert_eq!(engine.active_voices(), 0, "{} keeps sounding", patch.id());
    }
    assert!(engine.drain_warnings().is_empty());
  }

  #[test]
  fn events_land_on_their_frame() {
    // The limiter's lookahead delays both alike.
    let onset = |time: f64| {
      let mut engine = Engine::new(FS);
      engine.schedule_json(&format!(
        r#"{{"type":"noteOn","instrument":"oscillator","note":69,"velocity":1,"time":{time}}}"#
      ));
      let (mut left, mut right) = (vec![0.; 2048], vec![0.; 2048]);
      engine.render(&mut left, &mut right);
      left.iter().position(|x| *x != 0.).unwrap()
    };
    assert_eq!(onset(0.02) - onset(0.01), 480);
  }

  #[test]
  fn unknown_names_warn() {
    let mut engine = Engine::new(FS);
    engine.schedule_json(r#"[{"type":"param","target":"piano","id":"nope","value":1},{"type":"param","target":"master","id":"nope","value":1}]"#);
    engine.schedule_json("not json");
    assert_eq!(engine.drain_warnings().len(), 3);
  }
}
