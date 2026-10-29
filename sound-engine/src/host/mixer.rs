//! Plays rendered tracks together on the audio clock, as web-react's
//! `TrackMixer`: each track's buffer at each of its pass starts, through its
//! own gain, the whole arrangement looping (or once through). Notes ringing
//! past a pass or the loop's end overlap what follows, as they would live.

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::{Rc, Weak};

use gloo_timers::callback::Timeout;
use wasm_bindgen::JsCast;
use wasm_bindgen::closure::Closure;
use web_sys::{
  AudioBuffer, AudioBufferSourceNode, AudioBufferSourceOptions, AudioContext, AudioNode,
  AudioScheduledSourceNode, GainNode,
};

/// From `play` to the first sound (s).
pub const MIX_LEAD: f64 = 0.05;
/// How far ahead (s) passes are scheduled, and how often (s) the schedule
/// is topped up, so an hour of repeats costs no more than a bar of them.
const AHEAD: f64 = 1.;
/// How often (s) the schedule is topped up.
const TOP_UP: f64 = 0.25;
/// How long (s) stopping fades out.
const FADE: f64 = 0.01;
/// How long (s) a track's gain glides to a new level.
const GLIDE: f64 = 0.02;

/// A rendered track in the arrangement.
#[derive(Clone)]
pub struct MixTrack {
  pub id: String,
  pub buffer: AudioBuffer,
  /// Where each pass starts in the arrangement (s).
  pub starts: Vec<f64>,
  pub gain: f64,
}

/// One pass of a track: which track, and where in the arrangement it starts
/// (s).
struct Pass {
  track: usize,
  start: f64,
}

/// What a playing arrangement schedules from.
struct Plan {
  tracks: Vec<MixTrack>,
  passes: Vec<Pass>,
  /// When it was started on the audio clock, after the lead.
  now: f64,
  repeat: bool,
  /// Everything starting before it is scheduled.
  horizon: f64,
  first: bool,
}

/// What every clone of a [`TrackMixer`] shares: the graph, each track's gain,
/// the sources scheduled, the plan they come from and where the arrangement
/// started.
struct State {
  context: AudioContext,
  output: GainNode,
  gains: HashMap<String, GainNode>,
  sources: Vec<AudioBufferSourceNode>,
  timer: Option<Timeout>,
  plan: Option<Plan>,
  /// The audio time of the arrangement's top on the first loop.
  origin: f64,
  span: f64,
  running: bool,
  loops: bool,
}

impl State {
  /// The gain node of the track `id`, made and wired to the output the first
  /// time it's asked for.
  fn gain_of(&mut self, id: &str) -> GainNode {
    if let Some(gain) = self.gains.get(id) {
      return gain.clone();
    }
    let gain = self.context.create_gain().expect("a gain node");
    let _ = gain.connect_with_audio_node(&self.output);
    self.gains.insert(id.to_owned(), gain.clone());
    gain
  }
}

/// The mixer: cheap to clone, every clone the same one.
///
/// [`play`](Self::play) schedules an arrangement of rendered tracks a little
/// ahead at a time, [`stop`](Self::stop) fades it out and says where it was,
/// [`position`](Self::position) says where it is, and
/// [`set_gain`](Self::set_gain) turns a track up or down as it plays.
#[derive(Clone)]
pub struct TrackMixer(Rc<RefCell<State>>);

impl TrackMixer {
  /// A stopped mixer playing into `destination` through its own gain, or `None`
  /// if the context can't make one.
  pub fn new(context: &AudioContext, destination: &AudioNode) -> Option<Self> {
    let output = context.create_gain().ok()?;
    output.connect_with_audio_node(destination).ok()?;
    Some(Self(Rc::new(RefCell::new(State {
      context: context.clone(),
      output,
      gains: HashMap::new(),
      sources: Vec::new(),
      timer: None,
      plan: None,
      origin: 0.,
      span: 0.,
      running: false,
      loops: true,
    }))))
  }

  /// Plays an arrangement `span` seconds long from `from` seconds into it,
  /// looping unless `repeat` is false.
  pub fn play(&self, tracks: Vec<MixTrack>, span: f64, from: f64, repeat: bool) {
    self.stop();
    if span <= 0. {
      return;
    }
    {
      let mut state = self.0.borrow_mut();
      let now = state.context.current_time() + MIX_LEAD;
      state.span = span;
      state.loops = repeat;
      state.origin = now - from;
      state.running = true;
      let gain = state.output.gain();
      let _ = gain.cancel_scheduled_values(now);
      let _ = gain.set_value_at_time(1., now);
      for track in &tracks {
        state.gain_of(&track.id).gain().set_value(track.gain as f32);
      }
      let mut passes: Vec<Pass> = tracks
        .iter()
        .enumerate()
        .flat_map(|(track, mixed)| mixed.starts.iter().map(move |&start| Pass { track, start }))
        .collect();
      // Stable, as JavaScript's sort is.
      passes.sort_by(|a, b| a.start.total_cmp(&b.start));
      state.plan = Some(Plan {
        tracks,
        passes,
        now,
        repeat,
        horizon: now,
        first: true,
      });
    }
    top_up(&self.0);
  }

  /// Stops with a short fade; returns where in the arrangement it was (s).
  pub fn stop(&self) -> f64 {
    let position = self.position().unwrap_or(0.);
    let mut state = self.0.borrow_mut();
    state.timer = None;
    state.plan = None;
    let now = state.context.current_time();
    let gain = state.output.gain();
    let _ = gain.cancel_scheduled_values(now);
    let _ = gain.set_target_at_time(0., now, FADE / 3.);
    for source in state.sources.drain(..) {
      let _ = AsRef::<AudioScheduledSourceNode>::as_ref(&source).stop_with_when(now + FADE);
    }
    state.running = false;
    position
  }

  /// Where the arrangement is (s), or `None` while stopped or once through.
  pub fn position(&self) -> Option<f64> {
    let state = self.0.borrow();
    if !state.running {
      return None;
    }
    let elapsed = state.context.current_time() - state.origin;
    if !state.loops && elapsed >= state.span {
      return None;
    }
    Some(if elapsed < 0. {
      0.
    } else {
      elapsed % state.span
    })
  }

  /// Glides the track `id`'s gain to `gain`, while playing or not.
  pub fn set_gain(&self, id: &str, gain: f64) {
    let mut state = self.0.borrow_mut();
    let now = state.context.current_time();
    let _ = state
      .gain_of(id)
      .gain()
      .set_target_at_time(gain as f32, now, GLIDE);
  }
}

/// Schedules every pass starting before the next horizon, and comes back
/// to schedule more until the arrangement is done.
fn top_up(shared: &Rc<RefCell<State>>) {
  let mut guard = shared.borrow_mut();
  let state = &mut *guard;
  let Some(mut plan) = state.plan.take() else {
    return;
  };
  let current = state.context.current_time();
  let until = current.max(plan.now) + AHEAD;
  let span = state.span;
  let first_loop = ((plan.horizon - state.origin) / span).floor().max(0.) as i64;
  let last_loop = if plan.repeat {
    ((until - state.origin) / span).floor() as i64
  } else {
    first_loop
  };
  // Sources that finished are let go.
  state.sources.retain(|source| !ended(source));
  for repeat in first_loop..=last_loop {
    let top = state.origin + repeat as f64 * span;
    for pass in &plan.passes {
      let at = top + pass.start;
      if at >= until {
        break;
      }
      let track = &plan.tracks[pass.track];
      // At first, a pass already under way picks up mid-buffer.
      let skip = if plan.first {
        at + track.buffer.duration() <= plan.now
      } else {
        at < plan.horizon
      };
      if skip {
        continue;
      }
      let options = AudioBufferSourceOptions::new();
      options.set_buffer(Some(&track.buffer));
      let Ok(source) = AudioBufferSourceNode::new_with_options(&state.context, &options) else {
        continue;
      };
      let gain = state.gain_of(&track.id);
      let _ = source.connect_with_audio_node(&gain);
      let ended = Closure::once_into_js({
        let source = source.clone();
        move || {
          let _ = js_sys::Reflect::set(&source, &"ended".into(), &true.into());
          let _ = source.disconnect();
        }
      });
      AsRef::<AudioScheduledSourceNode>::as_ref(&source).set_onended(Some(ended.unchecked_ref()));
      let _ = source.start_with_when_and_grain_offset(at.max(plan.now), (plan.now - at).max(0.));
      state.sources.push(source);
    }
  }
  plan.first = false;
  plan.horizon = until;
  let done = !plan.repeat && plan.horizon >= state.origin + span;
  state.plan = Some(plan);
  if done {
    return;
  }
  let weak: Weak<RefCell<State>> = Rc::downgrade(shared);
  state.timer = Some(Timeout::new((TOP_UP * 1000.) as u32, move || {
    if let Some(shared) = weak.upgrade() {
      top_up(&shared);
    }
  }));
}

/// Whether a source's `onended` has fired.
fn ended(source: &AudioBufferSourceNode) -> bool {
  js_sys::Reflect::get(source, &"ended".into()).is_ok_and(|ended| ended.is_truthy())
}
