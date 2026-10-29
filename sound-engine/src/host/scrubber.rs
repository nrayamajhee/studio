//! Plays a rendered take at the speed it is dragged, as web-react's
//! `Scrubber`: like tape across a head or a record under a hand, pitch
//! follows the speed and dragging back plays it backwards. Left alone it
//! spins down like a released record.

use std::cell::RefCell;
use std::rc::{Rc, Weak};

use gloo_timers::callback::Timeout;
use wasm_bindgen::JsCast;
use wasm_bindgen::closure::Closure;
use web_sys::{
  AudioBuffer, AudioBufferOptions, AudioBufferSourceNode, AudioBufferSourceOptions, AudioContext,
  AudioNode, AudioScheduledSourceNode, GainNode,
};

/// Fastest playback, ×.
const MAX_RATE: f64 = 4.;
/// How quickly the speed follows the drag, and how long it spins down for
/// (s).
const GLIDE: f64 = 0.03;
/// How long (s) a let-go take takes to spin down.
const SPIN_DOWN: f64 = 0.15;
/// No move for this long (ms) lets it spin down.
const IDLE_MS: f64 = 90.;
/// Fades that keep a restart from clicking (s).
const FADE: f64 = 0.008;
/// How far (s) the playhead may drift from the drag before it jumps.
const DRIFT: f64 = 0.12;

/// The playing source: the take forwards or reversed, through its own fade.
struct Head {
  source: AudioBufferSourceNode,
  gain: GainNode,
  direction: f64,
}

/// What every clone of a [`Scrubber`] shares: the take both ways round, the
/// head playing it, and where the playhead is estimated to be.
struct State {
  context: AudioContext,
  output: AudioNode,
  forward: AudioBuffer,
  backward: AudioBuffer,
  head: Option<Rc<Head>>,
  /// Where the playhead is estimated to be on the take (s), as of `at`.
  position: f64,
  rate: f64,
  at: f64,
  idle: Option<Timeout>,
}

/// The scrubber: cheap to clone, every clone the same one.
///
/// Each drag calls [`move_to`](Self::move_to), which plays the stretch
/// dragged across at the drag's speed and direction; left alone it spins
/// down. [`stop`](Self::stop) silences it at once.
#[derive(Clone)]
pub struct Scrubber(Rc<RefCell<State>>);

impl Scrubber {
  /// A scrubber for `buffer` playing into `output`, with the take reversed for
  /// dragging back; `None` if the context can't make the buffer.
  pub fn new(context: &AudioContext, output: &AudioNode, buffer: &AudioBuffer) -> Option<Self> {
    let channels = buffer.number_of_channels();
    let options = AudioBufferOptions::new(buffer.length(), buffer.sample_rate());
    options.set_number_of_channels(channels);
    let backward = AudioBuffer::new(&options).ok()?;
    for channel in 0..channels {
      let mut samples = buffer.get_channel_data(channel).ok()?;
      samples.reverse();
      backward.copy_to_channel(&samples, channel as i32).ok()?;
    }
    Some(Self(Rc::new(RefCell::new(State {
      context: context.clone(),
      output: output.clone(),
      forward: buffer.clone(),
      backward,
      head: None,
      position: 0.,
      rate: 0.,
      at: 0.,
      idle: None,
    }))))
  }

  /// The drag moved from `from` to `to` (s on the take) at `speed` (take
  /// seconds per second; negative is backwards). It keeps playing until it
  /// gets there, so a jump, like a knob detent, plays its whole stretch.
  pub fn move_to(&self, from: f64, to: f64, speed: f64) {
    let mut state = self.0.borrow_mut();
    let now = state.context.current_time();
    let direction = state.head.as_ref().map_or(1., |head| head.direction);
    state.position += direction * state.rate * (now - state.at);
    state.at = now;
    let direction = if speed < 0. { -1. } else { 1. };
    let rate = speed.abs().min(MAX_RATE);
    let restart = match &state.head {
      None => true,
      Some(head) => head.direction != direction || (state.position - from).abs() > DRIFT,
    };
    if restart {
      start(&mut state, &self.0, from, direction, now);
    }
    let Some(head) = state.head.clone() else {
      return;
    };
    if rate == 0. {
      return;
    }
    let playback = head.source.playback_rate();
    let _ = playback.cancel_scheduled_values(now);
    let _ = playback.set_target_at_time(rate as f32, now, GLIDE);
    state.rate = rate;
    let travel = (to - state.position).abs() / rate * 1000.;
    let weak = Rc::downgrade(&self.0);
    state.idle = Some(Timeout::new(IDLE_MS.max(travel) as u32, move || {
      if let Some(shared) = weak.upgrade() {
        release(&mut shared.borrow_mut());
      }
    }));
  }

  /// Fades the head out at once, with no spin-down.
  pub fn stop(&self) {
    let mut state = self.0.borrow_mut();
    state.idle = None;
    if let Some(head) = state.head.take() {
      fade_out(&state.context, &head);
    }
    state.rate = 0.;
  }
}

/// Starts a new head at `position` on the take in `direction` (1 forwards, −1
/// backwards), fading in and fading out the old one; none past either end.
fn start(state: &mut State, shared: &Rc<RefCell<State>>, position: f64, direction: f64, now: f64) {
  if let Some(head) = state.head.take() {
    fade_out(&state.context, &head);
  }
  let duration = state.forward.duration();
  let offset = if direction > 0. {
    position
  } else {
    duration - position
  };
  if offset < 0. || offset >= duration {
    return;
  }
  let options = AudioBufferSourceOptions::new();
  options.set_buffer(Some(if direction > 0. {
    &state.forward
  } else {
    &state.backward
  }));
  options.set_playback_rate(if state.rate == 0. {
    1.
  } else {
    state.rate as f32
  });
  let Ok(source) = AudioBufferSourceNode::new_with_options(&state.context, &options) else {
    return;
  };
  let Ok(gain) = state.context.create_gain() else {
    return;
  };
  gain.gain().set_value(0.);
  let _ = gain.gain().set_target_at_time(1., now, FADE);
  let _ = source
    .connect_with_audio_node(&gain)
    .and_then(|gain| gain.connect_with_audio_node(&state.output));
  let _ = source.start_with_when_and_grain_offset(now, offset);
  let head = Rc::new(Head {
    source: source.clone(),
    gain: gain.clone(),
    direction,
  });
  let weak: Weak<RefCell<State>> = Rc::downgrade(shared);
  let mine = Rc::downgrade(&head);
  let ended = Closure::once_into_js(move || {
    let _ = gain.disconnect();
    if let (Some(shared), Some(head)) = (weak.upgrade(), mine.upgrade())
      && let Ok(mut state) = shared.try_borrow_mut()
      && state
        .head
        .as_ref()
        .is_some_and(|current| Rc::ptr_eq(current, &head))
    {
      state.head = None;
    }
  });
  AsRef::<AudioScheduledSourceNode>::as_ref(&source).set_onended(Some(ended.unchecked_ref()));
  state.head = Some(head);
  state.position = position;
}

/// Slows to a stop and fades, like a record let go.
fn release(state: &mut State) {
  let Some(head) = state.head.take() else {
    return;
  };
  let now = state.context.current_time();
  let playback = head.source.playback_rate();
  let _ = playback.cancel_scheduled_values(now);
  let _ = playback.set_target_at_time(0.01, now, SPIN_DOWN);
  let _ = head
    .gain
    .gain()
    .set_target_at_time(0., now + SPIN_DOWN, SPIN_DOWN / 2.);
  let _ =
    AsRef::<AudioScheduledSourceNode>::as_ref(&head.source).stop_with_when(now + 4. * SPIN_DOWN);
  state.rate = 0.;
}

/// Fades `head` out over a few ms and stops it, so it doesn't click.
fn fade_out(context: &AudioContext, head: &Head) {
  let now = context.current_time();
  let gain = head.gain.gain();
  let _ = gain.cancel_scheduled_values(now);
  let _ = gain.set_target_at_time(0., now, FADE);
  let _ = AsRef::<AudioScheduledSourceNode>::as_ref(&head.source).stop_with_when(now + 6. * FADE);
}
