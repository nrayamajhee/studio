//! MIDI input, as web-react's `input/midi.ts`: a controller's keys play the
//! keybed, and the knobs and pads mapped to the Device's turn and press
//! them, as their own knobs and keys do. Settings and mappings are kept
//! under `studio.midi`; turning MIDI on asks the browser for it, and on a
//! later visit it connects again if the browser still allows it without
//! asking. A known controller maps itself the first time it's plugged in.

use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::rc::Rc;

use fluid::Signal;
use serde_json::{Value, json};
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{MidiAccess, MidiConnectionEvent, MidiInput, MidiMessageEvent, MidiPortDeviceState};

use crate::logic::export::gm_drum;
use crate::logic::js::round;
use crate::logic::modules::ModuleId;
use crate::logic::presets::{is_kit, key_piece};
use crate::logic::progressions::KEY_VELOCITY;
use crate::modes::{self, Knob};
use crate::state::app;
use crate::state::keymap::{Control, Tool};
use crate::state::performance::F3_MIDI;
use crate::store::storage;

pub const MIDI_KEY: &str = "studio.midi";
pub const DRUM_CHANNEL: u8 = 10;
pub const OCTAVE_RANGE: i32 = 3;
const SUSTAIN_CC: u8 = 64;
const ALL_SOUND_OFF_CC: u8 = 120;
const ALL_NOTES_OFF_CC: u8 = 123;
const LOG_LENGTH: usize = 8;

/// A control on a MIDI device: a knob or button sending a CC, or a key or
/// pad sending a note, on its channel (1–16).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct MidiSource {
  pub cc: bool,
  pub channel: u8,
  pub number: u8,
}

impl MidiSource {
  fn id(&self) -> String {
    format!(
      "{}:{}:{}",
      if self.cc { "cc" } else { "note" },
      self.channel,
      self.number
    )
  }

  pub fn name(&self) -> String {
    if self.cc {
      format!("CC {}", self.number)
    } else {
      note_name(self.number)
    }
  }
}

/// A knob, or a pad by the control its key presses.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MidiTarget {
  Knob(Knob),
  Pad(Control),
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MidiMapping {
  pub source: MidiSource,
  pub target: MidiTarget,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MidiSettings {
  /// Connect again on the next visit, if the browser still allows it.
  pub enabled: bool,
  /// The input listened to, by name, or every input.
  pub input: Option<String>,
  /// The channel the keys play from, or any.
  pub channel: Option<u8>,
  /// Octaves added to every key.
  pub octave: i32,
  /// As played, or every key at the keybed's own velocity.
  pub fixed_velocity: bool,
  /// CC 64 holds notes after their keys let go.
  pub sustain: bool,
  /// Channel 10 strikes a kit's pieces by their General MIDI keys.
  pub drums: bool,
  pub mappings: Vec<MidiMapping>,
  /// The presets already loaded, by name: each loads only the first time
  /// its controller is plugged in, so a mapping forgotten stays forgotten.
  pub presets: Vec<String>,
}

impl Default for MidiSettings {
  fn default() -> Self {
    Self {
      enabled: false,
      input: None,
      channel: None,
      octave: 0,
      fixed_velocity: false,
      sustain: true,
      drums: true,
      mappings: Vec::new(),
      presets: Vec::new(),
    }
  }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MidiStatus {
  Unsupported,
  Off,
  Asking,
  Blocked,
  On,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MidiPort {
  pub id: String,
  pub name: String,
  pub manufacturer: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MidiConnection {
  pub status: MidiStatus,
  pub ports: Vec<MidiPort>,
  /// The knob or pad waiting for a control to be moved, to map it.
  pub learning: Option<MidiTarget>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MidiLogEntry {
  pub id: u32,
  pub port: String,
  pub channel: u8,
  pub message: String,
  /// What the Device did with it.
  pub use_: String,
}

pub const MIDI_KNOBS: [(Knob, &str); 4] = [
  (Knob::Chalk, "White knob"),
  (Knob::Green, "Green knob"),
  (Knob::Red, "Red knob"),
  (Knob::Blue, "Blue knob"),
];

const fn tool(tool: Tool) -> Control {
  Control::Tool(tool)
}

/// The pads, three rows of twelve as the Device lays them out.
pub const MIDI_PADS: [[(Control, &str); 12]; 3] = [
  [
    (tool(Tool::Play), "Play"),
    (tool(Tool::Stop), "Stop"),
    (tool(Tool::Record), "Record"),
    (tool(Tool::Save), "Save"),
    (tool(Tool::Tapes), "Tapes"),
    (tool(Tool::Synth), "Synth"),
    (tool(Tool::Module(ModuleId::Adsr)), "ADSR"),
    (tool(Tool::Module(ModuleId::Lfo)), "LFO"),
    (tool(Tool::Module(ModuleId::Fx)), "FX"),
    (tool(Tool::Chords), "Chords"),
    (tool(Tool::PlayStyle), "Play style"),
    (tool(Tool::Metronome), "Tempo"),
  ],
  [
    (tool(Tool::Clip), "Clip"),
    (tool(Tool::Mute), "Mute"),
    (Control::Pick(-1), "↑"),
    (tool(Tool::Delete), "Delete"),
    (tool(Tool::Tracks), "Tracks"),
    (tool(Tool::Roll), "Piano roll"),
    (Control::Instrument(0), "Instrument 1"),
    (Control::Instrument(1), "Instrument 2"),
    (Control::Instrument(2), "Instrument 3"),
    (Control::Chord(0), "Chord 1"),
    (Control::Chord(1), "Chord 2"),
    (Control::Chord(2), "Chord 3"),
  ],
  [
    (Control::Shift, "Shift"),
    (Control::Step(-1), "←"),
    (Control::Pick(1), "↓"),
    (Control::Step(1), "→"),
    (tool(Tool::Instruments), "Instruments"),
    (tool(Tool::DrumGrid), "Drum grid"),
    (Control::Instrument(3), "Instrument 4"),
    (Control::Instrument(4), "Instrument 5"),
    (Control::Instrument(5), "Instrument 6"),
    (Control::Chord(3), "Chord 4"),
    (Control::Chord(4), "Chord 5"),
    (Control::Chord(5), "Chord 6"),
  ],
];

fn pad_name(control: Control) -> Option<&'static str> {
  MIDI_PADS
    .iter()
    .flatten()
    .find(|(candidate, _)| *candidate == control)
    .map(|(_, name)| *name)
}

pub fn target_name(target: MidiTarget) -> &'static str {
  match target {
    MidiTarget::Knob(knob) => MIDI_KNOBS
      .iter()
      .find(|(slot, _)| *slot == knob)
      .map_or("Knob", |(_, name)| name),
    MidiTarget::Pad(control) => pad_name(control).unwrap_or("Pad"),
  }
}

const NOTE_NAMES: [&str; 12] = [
  "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B",
];

pub fn note_name(note: u8) -> String {
  format!(
    "{}{}",
    NOTE_NAMES[usize::from(note % 12)],
    i32::from(note / 12) - 1
  )
}

/// A controller the Device maps on its own, by the name its input goes by.
struct MidiPreset {
  name: &'static str,
  port: &'static str,
  mappings: Vec<MidiMapping>,
}

fn presets() -> Vec<MidiPreset> {
  let cc = |number: u8, target: MidiTarget| MidiMapping {
    source: MidiSource {
      cc: true,
      channel: 1,
      number,
    },
    target,
  };
  let knob = |number, knob| cc(number, MidiTarget::Knob(knob));
  let pad = |number, control| cc(number, MidiTarget::Pad(control));
  let tool = |number, tool| pad(number, Control::Tool(tool));
  vec![MidiPreset {
    name: "OP-1",
    port: "OP-1 Midi Device",
    // The four encoders turn the knobs of their colour, orange the red
    // one, and the buttons press every pad but Chord 1 and Instrument 6.
    mappings: vec![
      knob(1, Knob::Blue),
      knob(2, Knob::Green),
      knob(3, Knob::Chalk),
      knob(4, Knob::Red),
      tool(5, Tool::Instruments),
      tool(6, Tool::Metronome),
      tool(7, Tool::Roll),
      tool(8, Tool::DrumGrid),
      tool(9, Tool::Tapes),
      tool(10, Tool::Tracks),
      tool(11, Tool::Synth),
      tool(12, Tool::Module(ModuleId::Adsr)),
      tool(13, Tool::Module(ModuleId::Lfo)),
      tool(14, Tool::Module(ModuleId::Fx)),
      pad(15, Control::Pick(-1)),
      pad(16, Control::Pick(1)),
      tool(17, Tool::Clip),
      pad(21, Control::Chord(1)),
      pad(22, Control::Chord(2)),
      pad(23, Control::Chord(3)),
      pad(24, Control::Chord(4)),
      pad(25, Control::Chord(5)),
      tool(26, Tool::PlayStyle),
      tool(38, Tool::Record),
      tool(39, Tool::Play),
      tool(40, Tool::Stop),
      pad(41, Control::Step(-1)),
      pad(42, Control::Step(1)),
      pad(43, Control::Shift),
      tool(48, Tool::Save),
      tool(49, Tool::Delete),
      pad(50, Control::Instrument(0)),
      pad(51, Control::Instrument(1)),
      pad(52, Control::Instrument(2)),
      // The sustain pedal's CC: mapped, it presses the pad instead.
      pad(64, Control::Instrument(3)),
      pad(65, Control::Instrument(4)),
      tool(66, Tool::Mute),
      tool(67, Tool::Chords),
    ],
  }]
}

// Settings in web-react's JSON, key for key.

fn tool_key(tool: Tool) -> &'static str {
  match tool {
    Tool::Record => "record",
    Tool::Play => "play",
    Tool::Stop => "stop",
    Tool::Tracks => "tracks",
    Tool::Tapes => "tapes",
    Tool::Roll => "roll",
    Tool::DrumGrid => "drumGrid",
    Tool::Metronome => "metronome",
    Tool::Instruments => "instruments",
    Tool::Synth => "synth",
    Tool::Chords => "chords",
    Tool::PlayStyle => "playStyle",
    Tool::Save => "save",
    Tool::Delete => "delete",
    Tool::Mute => "mute",
    Tool::Clip => "clip",
    Tool::Module(id) => id.key(),
  }
}

fn knob_key(knob: Knob) -> &'static str {
  match knob {
    Knob::Chalk => "chalk",
    Knob::Green => "green",
    Knob::Red => "red",
    Knob::Blue => "blue",
  }
}

fn control_json(control: Control) -> Value {
  match control {
    Control::Tool(tool) => json!({ "kind": "tool", "tool": tool_key(tool) }),
    Control::Instrument(index) => json!({ "kind": "instrument", "index": index }),
    Control::Chord(index) => json!({ "kind": "chord", "index": index }),
    Control::Step(direction) => json!({ "kind": "step", "direction": direction }),
    Control::Pick(direction) => json!({ "kind": "pick", "direction": direction }),
    Control::Shift => json!({ "kind": "shift" }),
    Control::Note(semitone) => json!({ "kind": "note", "semitone": semitone }),
  }
}

fn settings_json(settings: &MidiSettings) -> Value {
  let mappings: Vec<Value> = settings
    .mappings
    .iter()
    .map(|mapping| {
      let source = json!({
        "type": if mapping.source.cc { "cc" } else { "note" },
        "channel": mapping.source.channel,
        "number": mapping.source.number,
      });
      let target = match mapping.target {
        MidiTarget::Knob(knob) => json!({ "kind": "knob", "slot": knob_key(knob) }),
        MidiTarget::Pad(control) => json!({ "kind": "pad", "control": control_json(control) }),
      };
      json!({ "source": source, "target": target })
    })
    .collect();
  json!({
    "enabled": settings.enabled,
    "input": settings.input,
    "channel": settings.channel,
    "octave": settings.octave,
    "velocity": if settings.fixed_velocity { "fixed" } else { "played" },
    "sustain": settings.sustain,
    "drums": settings.drums,
    "mappings": mappings,
    "presets": settings.presets,
  })
}

fn midi_number(value: &Value, low: i64, high: i64) -> Option<i64> {
  value.as_i64().filter(|n| (low..=high).contains(n))
}

/// A pad the stored control names, if the Device has it.
fn read_control(stored: &Value) -> Option<Control> {
  MIDI_PADS
    .iter()
    .flatten()
    .map(|(control, _)| *control)
    .find(|control| {
      let expected = control_json(*control);
      expected.as_object().is_some_and(|fields| {
        fields
          .iter()
          .all(|(key, value)| stored.get(key) == Some(value))
      })
    })
}

fn read_mapping(stored: &Value) -> Option<MidiMapping> {
  let source = stored.get("source")?;
  let cc = match source.get("type")?.as_str()? {
    "cc" => true,
    "note" => false,
    _ => return None,
  };
  let channel = midi_number(source.get("channel")?, 1, 16)? as u8;
  let number = midi_number(source.get("number")?, 0, 127)? as u8;
  let target = stored.get("target")?;
  let knob = target
    .get("slot")
    .and_then(Value::as_str)
    .and_then(|slot| MIDI_KNOBS.iter().find(|(knob, _)| knob_key(*knob) == slot))
    .map(|(knob, _)| *knob);
  let mapped = match target.get("kind").and_then(Value::as_str) {
    Some("knob") if cc => MidiTarget::Knob(knob?),
    Some("pad") => MidiTarget::Pad(read_control(target.get("control")?)?),
    _ => return None,
  };
  Some(MidiMapping {
    source: MidiSource {
      cc,
      channel,
      number,
    },
    target: mapped,
  })
}

fn read_settings() -> MidiSettings {
  let Some(stored) = storage::load(MIDI_KEY).filter(Value::is_object) else {
    return MidiSettings::default();
  };
  MidiSettings {
    enabled: stored.get("enabled") == Some(&Value::Bool(true)),
    input: stored
      .get("input")
      .and_then(Value::as_str)
      .map(str::to_owned),
    channel: stored
      .get("channel")
      .and_then(|channel| midi_number(channel, 1, 16))
      .map(|channel| channel as u8),
    octave: stored
      .get("octave")
      .and_then(|octave| midi_number(octave, -i64::from(OCTAVE_RANGE), i64::from(OCTAVE_RANGE)))
      .unwrap_or(0) as i32,
    fixed_velocity: stored.get("velocity").and_then(Value::as_str) == Some("fixed"),
    sustain: stored.get("sustain") != Some(&Value::Bool(false)),
    drums: stored.get("drums") != Some(&Value::Bool(false)),
    mappings: stored
      .get("mappings")
      .and_then(Value::as_array)
      .map(|mappings| mappings.iter().filter_map(read_mapping).collect())
      .unwrap_or_default(),
    presets: stored
      .get("presets")
      .and_then(Value::as_array)
      .map(|names| {
        names
          .iter()
          .filter_map(Value::as_str)
          .map(str::to_owned)
          .collect()
      })
      .unwrap_or_default(),
  }
}

/// A handler an input or the access calls.
type Listener = Closure<dyn FnMut(JsValue)>;

#[derive(Clone, Copy)]
struct HeldNote {
  note: i32,
  drums: bool,
}

pub struct Midi {
  pub settings: Rc<Signal<MidiSettings>>,
  pub connection: Rc<Signal<MidiConnection>>,
  pub log: Rc<Signal<Vec<MidiLogEntry>>>,
  access: RefCell<Option<MidiAccess>>,
  /// The handlers the inputs and the access call, kept while they're set.
  listeners: RefCell<Vec<Listener>>,
  held_notes: RefCell<HashMap<String, HeldNote>>,
  /// Let go of while the pedal is down: they sound until it comes up.
  sustained: RefCell<HashMap<String, HeldNote>>,
  held_pads: RefCell<HashMap<String, Control>>,
  pedal: Cell<bool>,
  log_id: Cell<u32>,
  /// The keybed semitone each MIDI key started, by its source.
  device_notes: RefCell<HashMap<String, i32>>,
}

thread_local! {
  static MIDI: std::cell::OnceCell<&'static Midi> = const { std::cell::OnceCell::new() };
}

pub fn midi() -> &'static Midi {
  MIDI.with(|cell| *cell.get().expect("MIDI is installed"))
}

fn supported() -> bool {
  js_sys::Reflect::has(
    &gloo_utils::window().navigator(),
    &"requestMIDIAccess".into(),
  )
  .unwrap_or(false)
}

impl Midi {
  /// Connects, if MIDI was on last visit and the browser lets it in
  /// without asking (asking needs a click in the panel).
  pub fn install() -> &'static Midi {
    let midi: &'static Midi = Box::leak(Box::new(Midi {
      settings: Rc::new(Signal::new(read_settings())),
      connection: Rc::new(Signal::new(MidiConnection {
        status: MidiStatus::Off,
        ports: Vec::new(),
        learning: None,
      })),
      log: Rc::new(Signal::new(Vec::new())),
      access: RefCell::default(),
      listeners: RefCell::default(),
      held_notes: RefCell::default(),
      sustained: RefCell::default(),
      held_pads: RefCell::default(),
      pedal: Cell::new(false),
      log_id: Cell::new(0),
      device_notes: RefCell::default(),
    }));
    MIDI.with(|cell| {
      let _ = cell.set(midi);
    });
    if !supported() {
      midi.set_status(MidiStatus::Unsupported);
      return midi;
    }
    if midi.settings.get_untracked().enabled {
      spawn_local(async move {
        if permitted().await {
          midi.connect().await;
        }
      });
    }
    midi
  }

  fn current(&self) -> MidiSettings {
    self.settings.get_untracked().clone()
  }

  fn save(&self, next: MidiSettings) {
    storage::save(MIDI_KEY, &settings_json(&next));
    self.settings.set(next);
  }

  fn set_status(&self, status: MidiStatus) {
    self
      .connection
      .update(|connection| connection.status = status);
  }

  async fn connect(&'static self) {
    if self.access.borrow().is_some()
      || self.connection.get_untracked().status == MidiStatus::Asking
    {
      return;
    }
    self.set_status(MidiStatus::Asking);
    let asked = gloo_utils::window()
      .navigator()
      .request_midi_access()
      .map(JsFuture::from);
    let access = match asked {
      Ok(asked) => asked
        .await
        .ok()
        .filter(JsValue::is_object)
        .map(JsCast::unchecked_into::<MidiAccess>),
      Err(_) => None,
    };
    let Some(access) = access else {
      self.save(MidiSettings {
        enabled: false,
        ..self.current()
      });
      self.set_status(MidiStatus::Blocked);
      return;
    };
    let changed = Closure::<dyn FnMut(JsValue)>::new(move |event: JsValue| {
      let disconnected = event
        .unchecked_ref::<MidiConnectionEvent>()
        .port()
        .is_some_and(|port| port.state() == MidiPortDeviceState::Disconnected);
      if disconnected {
        midi().release_all();
      }
      midi().refresh_ports();
    });
    access.set_onstatechange(Some(changed.as_ref().unchecked_ref()));
    *self.access.borrow_mut() = Some(access);
    self.listeners.borrow_mut().push(changed);
    self.refresh_ports();
    self.set_status(MidiStatus::On);
  }

  fn inputs(&self) -> Vec<MidiInput> {
    let access = self.access.borrow().clone();
    access.as_ref().map_or_else(Vec::new, inputs_of)
  }

  fn disconnect(&self) {
    self.release_all();
    let access = self.access.borrow_mut().take();
    if let Some(access) = access {
      access.set_onstatechange(None);
      for input in inputs_of(&access) {
        input.set_onmidimessage(None);
        let _ = input.close();
      }
    }
    self.listeners.borrow_mut().clear();
    self.connection.set(MidiConnection {
      status: MidiStatus::Off,
      ports: Vec::new(),
      learning: None,
    });
  }

  fn refresh_ports(&'static self) {
    let mut ports = Vec::new();
    let mut listeners = Vec::new();
    for input in self.inputs() {
      if input.state() != MidiPortDeviceState::Connected {
        continue;
      }
      let name = input.name().unwrap_or_else(|| "MIDI input".into());
      let heard = {
        let name = input.name().unwrap_or_default();
        Closure::<dyn FnMut(JsValue)>::new(move |event: JsValue| {
          if let Ok(data) = event.unchecked_ref::<MidiMessageEvent>().data() {
            midi().receive(&name, &data);
          }
        })
      };
      input.set_onmidimessage(Some(heard.as_ref().unchecked_ref()));
      listeners.push(heard);
      ports.push(MidiPort {
        id: input.id(),
        name,
        manufacturer: input.manufacturer().unwrap_or_default(),
      });
    }
    {
      // The access's own handler stays; the inputs' are replaced.
      let mut kept = self.listeners.borrow_mut();
      kept.truncate(1);
      kept.extend(listeners);
    }
    self.load_presets(&ports);
    self
      .connection
      .update(|connection| connection.ports = ports);
  }

  /// The first time a controller with a preset is plugged in, its mappings
  /// take every knob and pad, and every control, not already mapped.
  fn load_presets(&self, ports: &[MidiPort]) {
    let current = self.current();
    let fresh: Vec<MidiPreset> = presets()
      .into_iter()
      .filter(|preset| {
        !current.presets.iter().any(|name| name == preset.name)
          && ports.iter().any(|port| port.name.contains(preset.port))
      })
      .collect();
    if fresh.is_empty() {
      return;
    }
    let mut mappings = current.mappings.clone();
    for preset in &fresh {
      let taken = mappings.clone();
      mappings.extend(preset.mappings.iter().copied().filter(|mapping| {
        !taken
          .iter()
          .any(|held| held.source.id() == mapping.source.id() || held.target == mapping.target)
      }));
    }
    let mut names = current.presets.clone();
    names.extend(fresh.iter().map(|preset| preset.name.to_owned()));
    self.save(MidiSettings {
      mappings,
      presets: names,
      ..current
    });
  }

  fn note_off(&self, id: &str, held: HeldNote) {
    device_note(id, held.note, false, 0., held.drums);
  }

  fn press_pad(&self, id: &str, control: Control, down: bool) {
    if self.held_pads.borrow().contains_key(id) == down {
      return;
    }
    if down {
      self.held_pads.borrow_mut().insert(id.into(), control);
      app().hotkeys.press(&format!("midi:{id}"), control);
    } else {
      self.held_pads.borrow_mut().remove(id);
      app().hotkeys.release(&format!("midi:{id}"));
    }
  }

  fn set_pedal(&self, down: bool) {
    if self.pedal.get() == down {
      return;
    }
    self.pedal.set(down);
    if down {
      return;
    }
    let sustained: Vec<(String, HeldNote)> = self.sustained.borrow_mut().drain().collect();
    for (id, held) in sustained {
      self.note_off(&id, held);
    }
  }

  fn release_all(&self) {
    self.pedal.set(false);
    let held: Vec<(String, HeldNote)> = self
      .held_notes
      .borrow_mut()
      .drain()
      .chain(self.sustained.borrow_mut().drain())
      .collect();
    for (id, note) in held {
      self.note_off(&id, note);
    }
    let pads: Vec<(String, Control)> = self
      .held_pads
      .borrow()
      .iter()
      .map(|(id, control)| (id.clone(), *control))
      .collect();
    for (id, control) in pads {
      self.press_pad(&id, control, false);
    }
  }

  fn mapping_for(&self, source: MidiSource) -> Option<MidiMapping> {
    self
      .settings
      .get_untracked()
      .mappings
      .iter()
      .find(|mapping| mapping.source.id() == source.id())
      .copied()
  }

  /// Maps the control just moved to the knob or pad waiting for one (a
  /// knob takes only a CC), in place of whatever either was mapped to.
  fn learn_from(&self, source: MidiSource) -> Option<MidiTarget> {
    let target = self.connection.get_untracked().learning?;
    if matches!(target, MidiTarget::Knob(_)) && !source.cc {
      return None;
    }
    let current = self.current();
    let mut mappings: Vec<MidiMapping> = current
      .mappings
      .iter()
      .filter(|mapping| mapping.source.id() != source.id() && mapping.target != target)
      .copied()
      .collect();
    mappings.push(MidiMapping { source, target });
    self.save(MidiSettings {
      mappings,
      ..current
    });
    self
      .connection
      .update(|connection| connection.learning = None);
    Some(target)
  }

  fn receive_note(&self, channel: u8, number: u8, velocity: u8) -> String {
    let source = MidiSource {
      cc: false,
      channel,
      number,
    };
    let id = source.id();
    if velocity > 0
      && let Some(learned) = self.learn_from(source)
    {
      return format!("Mapped to {}", target_name(learned));
    }
    if let Some(MidiMapping {
      target: MidiTarget::Pad(control),
      ..
    }) = self.mapping_for(source)
    {
      self.press_pad(&id, control, velocity > 0);
      return target_name(MidiTarget::Pad(control)).into();
    }
    if velocity == 0 {
      let Some(held) = self.held_notes.borrow_mut().remove(&id) else {
        return "Keys".into();
      };
      if self.pedal.get() && !held.drums {
        self.sustained.borrow_mut().insert(id, held);
      } else {
        self.note_off(&id, held);
      }
      return "Keys".into();
    }
    let current = self.current();
    let drums = current.drums && channel == DRUM_CHANNEL;
    if !drums && current.channel.is_some_and(|only| only != channel) {
      return "Not this channel".into();
    }
    // A key struck again while it still sounds lets go of it first.
    let sounding = self
      .held_notes
      .borrow_mut()
      .remove(&id)
      .or_else(|| self.sustained.borrow_mut().remove(&id));
    if let Some(sounding) = sounding {
      self.note_off(&id, sounding);
    }
    let note = if drums {
      i32::from(number)
    } else {
      (i32::from(number) + 12 * current.octave).clamp(0, 127)
    };
    self
      .held_notes
      .borrow_mut()
      .insert(id.clone(), HeldNote { note, drums });
    device_note(
      &id,
      note,
      true,
      if current.fixed_velocity {
        KEY_VELOCITY
      } else {
        f64::from(velocity) / 127.
      },
      drums,
    );
    if drums { "Drums" } else { "Keys" }.into()
  }

  fn receive_control(&self, channel: u8, number: u8, value: u8) -> String {
    let source = MidiSource {
      cc: true,
      channel,
      number,
    };
    if let Some(learned) = self.learn_from(source) {
      return format!("Mapped to {}", target_name(learned));
    }
    if let Some(mapping) = self.mapping_for(source) {
      match mapping.target {
        MidiTarget::Knob(knob) => device_knob(knob, f64::from(value) / 127.),
        MidiTarget::Pad(control) => self.press_pad(&source.id(), control, value >= 64),
      }
      return target_name(mapping.target).into();
    }
    let current = self.current();
    if current.channel.is_some_and(|only| only != channel) {
      return "Not this channel".into();
    }
    if number == SUSTAIN_CC && current.sustain {
      self.set_pedal(value >= 64);
      return "Sustain".into();
    }
    if number == ALL_SOUND_OFF_CC || number == ALL_NOTES_OFF_CC {
      self.release_all();
      return "All notes off".into();
    }
    "Not mapped".into()
  }

  fn receive(&self, port: &str, data: &[u8]) {
    if self
      .settings
      .get_untracked()
      .input
      .as_ref()
      .is_some_and(|only| only != port)
    {
      return;
    }
    let status = data.first().copied().unwrap_or(0);
    let number = data.get(1).copied().unwrap_or(0);
    let value = data.get(2).copied().unwrap_or(0);
    let kind = status >> 4;
    // System messages (clock, active sensing…) carry no channel.
    if !(0x8..=0xe).contains(&kind) {
      return;
    }
    let channel = (status & 0x0f) + 1;
    let (message, use_) = match kind {
      0x9 if value > 0 => (
        format!("Note on {} · {value}", note_name(number)),
        self.receive_note(channel, number, value),
      ),
      0x8 | 0x9 => (
        format!("Note off {}", note_name(number)),
        self.receive_note(channel, number, 0),
      ),
      0xb => (
        format!("CC {number} · {value}"),
        self.receive_control(channel, number, value),
      ),
      0xe => ("Pitch bend".into(), "Not used".into()),
      0xc => (format!("Program {number}"), "Not used".into()),
      _ => ("Pressure".into(), "Not used".into()),
    };
    let id = self.log_id.get();
    self.log_id.set(id + 1);
    self.log.update(|log| {
      log.insert(
        0,
        MidiLogEntry {
          id,
          port: port.into(),
          channel,
          message,
          use_,
        },
      );
      log.truncate(LOG_LENGTH);
    });
  }

  /// Turning MIDI on asks the browser for it, so it runs from a click.
  pub fn set_enabled(&'static self, on: bool) {
    self.save(MidiSettings {
      enabled: on,
      ..self.current()
    });
    if on {
      spawn_local(self.connect());
    } else {
      self.disconnect();
    }
  }

  pub fn set_settings(&self, change: impl FnOnce(&mut MidiSettings)) {
    let current = self.current();
    let mut next = current.clone();
    change(&mut next);
    // A key held on the old input or channel would never hear its let-go.
    if next.input != current.input || next.channel != current.channel {
      self.release_all();
    }
    if !next.sustain {
      self.set_pedal(false);
    }
    self.save(next);
  }

  /// Waits for a control to be moved to map it to `target`; none, or the
  /// same target again, stops waiting.
  pub fn learn(&self, target: Option<MidiTarget>) {
    let waiting = self.connection.get_untracked().learning;
    let next = match target {
      Some(target) if waiting == Some(target) => None,
      target => target,
    };
    self
      .connection
      .update(|connection| connection.learning = next);
  }

  pub fn forget(&self, target: Option<MidiTarget>) {
    let current = self.current();
    self.release_all();
    self.save(MidiSettings {
      mappings: match target {
        Some(target) => current
          .mappings
          .iter()
          .filter(|mapping| mapping.target != target)
          .copied()
          .collect(),
        None => Vec::new(),
      },
      ..current
    });
  }

  /// The settings as web-react stores them, for the debug panel.
  pub fn stored(&self) -> Value {
    settings_json(&self.settings.get())
  }
}

/// The access's inputs, plugged in or not.
fn inputs_of(access: &MidiAccess) -> Vec<MidiInput> {
  let inputs = access.inputs();
  let found = Rc::new(RefCell::new(Vec::new()));
  let collect = {
    let found = found.clone();
    Closure::<dyn FnMut(JsValue)>::new(move |input: JsValue| {
      if input.is_object() {
        found.borrow_mut().push(input.unchecked_into::<MidiInput>());
      }
    })
  };
  if let Ok(for_each) = js_sys::Reflect::get(&inputs, &"forEach".into())
    && let Ok(for_each) = for_each.dyn_into::<js_sys::Function>()
  {
    let _ = for_each.call1(&inputs, collect.as_ref());
  }
  found.take()
}

/// Whether the browser lets MIDI in without asking.
async fn permitted() -> bool {
  let navigator = gloo_utils::window().navigator();
  let Ok(permissions) = js_sys::Reflect::get(&navigator, &"permissions".into()) else {
    return true;
  };
  let query = js_sys::Reflect::get(&permissions, &"query".into())
    .ok()
    .and_then(|query| query.dyn_into::<js_sys::Function>().ok());
  let Some(query) = query else {
    return true;
  };
  let asked = js_sys::Object::new();
  let _ = js_sys::Reflect::set(&asked, &"name".into(), &"midi".into());
  let Ok(promise) = query.call1(&permissions, &asked) else {
    return true;
  };
  match JsFuture::from(js_sys::Promise::from(promise)).await {
    Ok(status) => js_sys::Reflect::get(&status, &"state".into())
      .ok()
      .and_then(|state| state.as_string())
      .is_some_and(|state| state == "granted"),
    Err(_) => true,
  }
}

/// The keybed note a kit strikes General MIDI drum key `note` on: the key
/// of the kit's piece for it, if the kit has one, else the note as played.
fn drum_key(kit: &str, note: i32) -> i32 {
  (0..12)
    .map(|step| F3_MIDI + step)
    .find(|&key| gm_drum(key_piece(kit, key)) == note)
    .unwrap_or(note)
}

/// A key on the controller, as the keybed plays it: the Device's notes as
/// they are, past either end as well.
fn device_note(id: &str, note: i32, down: bool, velocity: f64, drums: bool) {
  let a = app();
  let notes = &midi().device_notes;
  if !down {
    let semitone = notes.borrow_mut().remove(id);
    if let Some(semitone) = semitone {
      a.performance.release_key(semitone);
    }
    return;
  }
  if a.feedback.is_busy() {
    return;
  }
  // Until the page is clicked, the browser keeps the sound off, and the
  // notes would pile up to play all at once.
  let activation =
    js_sys::Reflect::get(&gloo_utils::window().navigator(), &"userActivation".into())
      .ok()
      .filter(|activation| !activation.is_undefined());
  if let Some(activation) = activation
    && js_sys::Reflect::get(&activation, &"hasBeenActive".into()).ok() == Some(JsValue::FALSE)
  {
    a.feedback.show_prompt("Click the page to hear MIDI");
    return;
  }
  let (target, octave) = fluid::untrack(|| {
    (
      a.sound.preset.with(|preset| preset.target.clone()),
      a.sound.octave.value(),
    )
  });
  let note = if drums && is_kit(&target) {
    drum_key(&target, note)
  } else {
    note
  };
  if modes::key_press(note) {
    return;
  }
  let semitone = note - (F3_MIDI + 12 * octave);
  notes.borrow_mut().insert(id.into(), semitone);
  let chord = fluid::untrack(|| a.performance.active_chord());
  a.performance.press_key(semitone, chord, velocity);
}

/// A mapped knob turned to `value` (0–1): it sets the Device's knob across
/// its whole range.
fn device_knob(knob: Knob, value: f64) {
  if app().feedback.is_busy() {
    return;
  }
  let bindings = modes::current();
  let binding = bindings.knob(knob);
  let next = value * (binding.steps as f64 - 1.);
  let to = if binding.fine { next } else { round(next) };
  if to != binding.step {
    binding.on_change.call(to);
  }
}
