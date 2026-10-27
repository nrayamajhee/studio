//! The main thread's side, with the `web` feature: starts the worklet and
//! wires it into the same Web Audio graph as web-react's `PhysicalSynth`
//! (the engine, then a limiter, the analyser the scope reads, and the
//! system volume), and sends it events as JSON.

use std::cell::RefCell;
use std::rc::Rc;

use js_sys::{Array, ArrayBuffer, Function, Object, Promise, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{
  AnalyserNode, AudioContext, AudioContextState, AudioWorkletNode, AudioWorkletNodeOptions,
  GainNode, MessageEvent, Response, console,
};

use crate::messages::{EngineEvent, EngineStats};

/// The processor's name, as `worklet/processor.js` registers it.
const PROCESSOR: &str = "sound-worklet";

#[derive(Default)]
struct State {
  /// Where `sound-worklet.js` and `sound-worklet.wasm` are served, ending in
  /// `/` (or empty, next to the page).
  base: String,
  context: Option<AudioContext>,
  node: Option<AudioWorkletNode>,
  analyser: Option<AnalyserNode>,
  /// The system volume, after the limiter, so turning it up never clips.
  volume: Option<GainNode>,
  volume_level: f64,
  booting: bool,
  ready: bool,
  /// Events sent before the worklet was ready.
  pending: Vec<EngineEvent>,
  stats: Option<EngineStats>,
  load: Option<f64>,
  on_message: Option<Closure<dyn FnMut(MessageEvent)>>,
}

/// The synth: cheap to clone, every clone the same engine.
#[derive(Clone)]
pub struct Synth(Rc<RefCell<State>>);

impl Synth {
  /// A synth whose worklet files are served under `base` (ending in `/`,
  /// or empty for next to the page). Nothing starts until `start`.
  pub fn new(base: &str) -> Self {
    Self(Rc::new(RefCell::new(State {
      base: base.to_owned(),
      volume_level: 1.,
      ..State::default()
    })))
  }

  pub fn ready(&self) -> bool {
    self.0.borrow().ready
  }

  /// Starts the engine, from a user gesture (browsers keep audio off until
  /// one), or resumes it.
  pub fn start(&self) {
    self.resume();
    let context = {
      let mut state = self.0.borrow_mut();
      if state.booting || state.ready {
        return;
      }
      let Ok(context) = AudioContext::new() else {
        console::warn_1(&"Audio engine failed to start: no AudioContext".into());
        return;
      };
      state.booting = true;
      state.context = Some(context.clone());
      context
    };
    let synth = self.clone();
    spawn_local(async move {
      if let Err(error) = synth.boot(&context).await {
        synth.0.borrow_mut().booting = false;
        console::warn_2(&"Audio engine failed to start:".into(), &error);
      }
    });
  }

  pub fn resume(&self) {
    if let Some(context) = &self.0.borrow().context
      && context.state() == AudioContextState::Suspended
    {
      let _ = context.resume();
    }
  }

  /// The audio clock, in seconds; timed events are on it.
  pub fn now(&self) -> f64 {
    self
      .0
      .borrow()
      .context
      .as_ref()
      .map_or(0., |context| context.current_time())
  }

  /// The output before the system volume, for the scope.
  pub fn analyser(&self) -> Option<AnalyserNode> {
    self.0.borrow().analyser.clone()
  }

  /// The engine's latest report, and the share of the audio thread's time
  /// it took.
  pub fn stats(&self) -> (Option<EngineStats>, Option<f64>) {
    let state = self.0.borrow();
    (state.stats, state.load)
  }

  /// The system volume (0–1), after the engine's master level and clipper
  /// and the limiter.
  pub fn set_volume(&self, value: f64) {
    let mut state = self.0.borrow_mut();
    state.volume_level = value;
    if let (Some(context), Some(volume)) = (&state.context, &state.volume) {
      let _ = volume
        .gain()
        .set_target_at_time(value as f32, context.current_time(), 0.015);
    }
  }

  pub fn note_on(&self, instrument: &str, note: i32, velocity: f64) {
    self.send(EngineEvent::NoteOn {
      instrument: instrument.into(),
      note: note.into(),
      velocity,
      time: None,
    });
  }

  pub fn note_off(&self, instrument: &str, note: i32) {
    self.send(EngineEvent::NoteOff {
      instrument: instrument.into(),
      note: note.into(),
      time: None,
    });
  }

  pub fn hit(&self, kit: &str, piece: &str, velocity: f64) {
    self.send(EngineEvent::Hit {
      kit: kit.into(),
      piece: piece.into(),
      velocity,
      time: None,
    });
  }

  pub fn set_param(&self, target: &str, id: &str, value: f64) {
    self.send(EngineEvent::Param {
      target: target.into(),
      id: id.into(),
      value,
      time: None,
    });
  }

  pub fn all_notes_off(&self) {
    self.send(EngineEvent::AllNotesOff);
  }

  pub fn panic(&self) {
    self.send(EngineEvent::Panic);
  }

  pub fn send(&self, event: EngineEvent) {
    let mut state = self.0.borrow_mut();
    if state.ready {
      if let Some(node) = &state.node {
        post(node, &[event]);
      }
      return;
    }
    // Queued events play as soon as the worklet is ready, so a first tap
    // that boots the engine still sounds, just late. Params are re-sent by
    // their owners, so only the latest value of each matters.
    match event {
      EngineEvent::Param {
        ref target, ref id, ..
      } => {
        state
          .pending
          .retain(|queued| !matches!(queued, EngineEvent::Param { target: t, id: i, .. } if t == target && i == id));
        state.pending.push(event);
      }
      event => state.pending.push(untimed(event)),
    }
  }

  async fn boot(&self, context: &AudioContext) -> Result<(), JsValue> {
    let base = self.0.borrow().base.clone();
    JsFuture::from(
      context
        .audio_worklet()?
        .add_module(&format!("{base}sound-worklet.js"))?,
    )
    .await?;
    let window = web_sys::window().ok_or("no window")?;
    let response: Response =
      JsFuture::from(window.fetch_with_str(&format!("{base}sound-worklet.wasm")))
        .await?
        .dyn_into()?;
    if !response.ok() {
      return Err(format!("sound-worklet.wasm: {}", response.status()).into());
    }
    let bytes: ArrayBuffer = JsFuture::from(response.array_buffer()?).await?.dyn_into()?;

    let processor_options = Object::new();
    Reflect::set(&processor_options, &"bytes".into(), &bytes)?;
    let options = AudioWorkletNodeOptions::new();
    options.set_number_of_inputs(0);
    options.set_number_of_outputs(1);
    options.set_output_channel_count(&Array::of1(&2.into()));
    options.set_processor_options(Some(&processor_options));
    let node = AudioWorkletNode::new_with_options(context, PROCESSOR, &options)?;
    let limiter = context.create_dynamics_compressor()?;
    limiter.threshold().set_value(-3.);
    limiter.knee().set_value(0.);
    limiter.ratio().set_value(20.);
    limiter.attack().set_value(0.002);
    limiter.release().set_value(0.1);
    let analyser = context.create_analyser()?;
    analyser.set_fft_size(2048);
    let volume = context.create_gain()?;
    volume.gain().set_value(self.0.borrow().volume_level as f32);
    node
      .connect_with_audio_node(&limiter)?
      .connect_with_audio_node(&analyser)?
      .connect_with_audio_node(&volume)?
      .connect_with_audio_node(&context.destination())?;

    let port = node.port()?;
    let resolve: Rc<RefCell<Option<Function>>> = Rc::default();
    let ready = Promise::new(&mut |done, _| *resolve.borrow_mut() = Some(done));
    let state = Rc::downgrade(&self.0);
    let on_message = Closure::<dyn FnMut(MessageEvent)>::new(move |message: MessageEvent| {
      let data = message.data();
      let kind = Reflect::get(&data, &"type".into())
        .ok()
        .and_then(|kind| kind.as_string());
      let number = |key: &str| {
        Reflect::get(&data, &key.into())
          .ok()
          .and_then(|value| value.as_f64())
      };
      match kind.as_deref() {
        Some("ready") => {
          if let Some(done) = resolve.borrow_mut().take() {
            let _ = done.call0(&JsValue::NULL);
          }
        }
        Some("stats") => {
          if let Some(state) = state.upgrade() {
            let mut state = state.borrow_mut();
            state.stats = Some(EngineStats {
              active_voices: number("activeVoices").unwrap_or(0.) as usize,
              reverb_awake: Reflect::get(&data, &"reverbAwake".into())
                .is_ok_and(|awake| awake.is_truthy()),
            });
            state.load = number("load");
          }
        }
        _ => {
          let warning = Reflect::get(&data, &"message".into()).unwrap_or(data);
          console::warn_1(&warning);
        }
      }
    });
    port.set_onmessage(Some(on_message.as_ref().unchecked_ref()));
    JsFuture::from(ready).await?;

    let mut state = self.0.borrow_mut();
    if !state.pending.is_empty() {
      post(&node, &state.pending);
      state.pending.clear();
    }
    state.on_message = Some(on_message);
    state.node = Some(node);
    state.analyser = Some(analyser);
    state.volume = Some(volume);
    state.booting = false;
    state.ready = true;
    drop(state);
    self.resume();
    Ok(())
  }
}

fn post(node: &AudioWorkletNode, events: &[EngineEvent]) {
  let (Ok(port), Ok(json)) = (node.port(), serde_json::to_string(events)) else {
    return;
  };
  let _ = port.post_message(&json.into());
}

/// The event as soon as possible, for one held until the worklet is ready.
fn untimed(event: EngineEvent) -> EngineEvent {
  match event {
    EngineEvent::NoteOn {
      instrument,
      note,
      velocity,
      ..
    } => EngineEvent::NoteOn {
      instrument,
      note,
      velocity,
      time: None,
    },
    EngineEvent::NoteOff {
      instrument, note, ..
    } => EngineEvent::NoteOff {
      instrument,
      note,
      time: None,
    },
    EngineEvent::Hit {
      kit,
      piece,
      velocity,
      ..
    } => EngineEvent::Hit {
      kit,
      piece,
      velocity,
      time: None,
    },
    EngineEvent::Sustain {
      instrument, down, ..
    } => EngineEvent::Sustain {
      instrument,
      down,
      time: None,
    },
    EngineEvent::Tick { accent, .. } => EngineEvent::Tick { accent, time: None },
    event => event,
  }
}
