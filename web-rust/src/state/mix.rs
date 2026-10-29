//! The tracks played together: playing, scrubbing and saving the mix, as
//! web-react's `MixProvider` and `useTrackMix`. Every track renders offline
//! with the sound it was saved with, then plays on the audio clock through
//! the track mixer, looping over the timeline. A track renders again only
//! when its sound or tempo changes; volume, mute and solo just move its
//! gain.

use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;

use fluid::Signal;
use futures_util::FutureExt;
use futures_util::future::{LocalBoxFuture, Shared};
use gloo_timers::callback::Interval;
use sound_engine::host::{MIX_LEAD, MixTrack, TrackMixer};
use wasm_bindgen_futures::spawn_local;
use web_sys::AudioBuffer;

use super::app;
use super::clock::now;
use super::scrub::{Render, Scrub};
use super::view::{MainView, ScreenView};
use crate::logic::export::{MidiPart, MixChunks, MixPart, Rendered, mix_to_midi};
use crate::logic::flac::FlacEncoder;
use crate::logic::js::pad2;
use crate::logic::params::patch;
use crate::logic::pattern::note_piece;
use crate::logic::presets::is_kit;
use crate::logic::timing::PlayedNote;
use crate::logic::tracks::{Track, audible, loop_on, pass_of, starts_of, track_bpm};

/// How often (ms) the seek knob follows the playing mix, and how long after
/// a turn it holds where it was turned to.
const FOLLOW_MS: u32 = 100;
/// How long after a turn the seek knob holds where it was turned to (ms).
const TURN_MS: f64 = 250.;

/// A track's pass rendering offline, shared so every play waiting on it gets
/// the same buffer.
type Pass = Shared<LocalBoxFuture<'static, Option<AudioBuffer>>>;

/// What a track sounds like through the mix: its volume, or silent while
/// muted or left out of a solo.
fn level_of(track: &Track, tracks: &[Track]) -> f64 {
  if audible(track, tracks) {
    track.volume
  } else {
    0.
  }
}

/// What renders a track's pass: its sound, tempo, swing, take and loop.
fn render_key(track: &Track, bpm: f64) -> String {
  serde_json::to_string(&(
    &track.sound,
    track_bpm(track, bpm),
    &track.timing.swing,
    &track.take,
    loop_on(track),
  ))
  .unwrap_or_default()
}

/// A note folded by octaves into `[low, high]`, as web-react's `foldNote`.
fn fold_note(note: i32, low: i32, high: i32) -> i32 {
  let mut note = note;
  while note < low {
    note += 12;
  }
  while note > high {
    note -= 12;
  }
  note
}

/// The tracks played together, as web-react's `MixProvider` and `useTrackMix`:
/// each track's pass rendered offline once with the sound it was saved with
/// (again only when its sound, tempo or clip changes), then played on the audio
/// clock through sound-engine's [`TrackMixer`], looping over the timeline.
///
/// Volume, mute and solo just move a track's gain. The mix plays while the
/// tracks are the main view, and once through under a take being recorded
/// ([`Mix::follow`]). Its methods play, pause and rewind it, scrub it like a
/// take, say where it is for the seek knob and the playhead, and save it as
/// FLAC or MIDI ([`Mix::export_mix`]).
pub struct Mix {
  pub playing: Rc<Signal<bool>>,
  renders: RefCell<HashMap<String, (String, Pass)>>,
  mixer: RefCell<Option<TrackMixer>>,
  /// Where Play resumes (beats); a newer play or pause cancels a pending
  /// one.
  paused: Cell<f64>,
  run: Cell<u64>,
  beat_seconds: Cell<f64>,
  /// Whether the mix loops: on the tracks view, not under a recording.
  looping: Cell<bool>,
  scrub: Scrub,
  /// Where the mix was last scrubbed to (ms), and when.
  scrubbed: Rc<Signal<Option<(f64, f64)>>>,
  /// A tick that redraws the knob while the tracks play on screen.
  now: Rc<Signal<f64>>,
  follow_timer: RefCell<Option<Interval>>,
}

impl Mix {
  /// Stopped at the top, nothing rendered yet.
  pub fn new() -> Self {
    Self {
      playing: Rc::new(Signal::new(false)),
      renders: RefCell::default(),
      mixer: RefCell::default(),
      paused: Cell::new(0.),
      run: Cell::new(0),
      beat_seconds: Cell::new(60. / 96.),
      looping: Cell::new(true),
      scrub: Scrub::windowed(),
      scrubbed: Rc::new(Signal::new(None)),
      now: Rc::new(Signal::new(0.)),
      follow_timer: RefCell::default(),
    }
  }

  /// Starts the effects: restart from the same place when the arrangement
  /// changes under the playing mix, move gains with volume, mute and solo,
  /// pause when the tracks stop being the main view, and tick the knob while
  /// the tracks play on screen.
  pub fn install(&'static self) {
    // Restarts from the same place when the arrangement changes under it.
    let arrangement = fluid::create_memo(move || self.arrangement());
    let mut first = true;
    fluid::create_effect(move || {
      arrangement.with(|_| ());
      if std::mem::take(&mut first) {
        return;
      }
      if !*self.playing.get_untracked() {
        return;
      }
      let at = self.mixer.borrow().as_ref().and_then(TrackMixer::position);
      if let Some(at) = at {
        let from = at / self.beat_seconds.get();
        let looping = self.looping.get();
        fluid::untrack(|| self.start(Start::At(from), looping, None));
      }
    });
    // Volume, mute and solo just move gains.
    let levels = fluid::create_memo(move || {
      let tracks = app().lanes.tracks();
      tracks
        .iter()
        .map(|track| (track.id.clone(), level_of(track, &tracks)))
        .collect::<Vec<_>>()
    });
    fluid::create_effect(move || {
      let levels = levels.cloned();
      if let Some(mixer) = self.mixer.borrow().as_ref() {
        for (id, level) in levels {
          mixer.set_gain(&id, level);
        }
      }
    });
    // The mix plays while the tracks (or the tapes) are the main view,
    // whatever shows over them, and under a take while it records.
    fluid::create_effect(move || {
      let mix_view = self.mix_view();
      let recording = app().transport.recording();
      if !mix_view && !recording {
        fluid::untrack(|| self.pause_mix());
      }
    });
    // A tick redraws the knob while the tracks play on screen.
    fluid::create_effect(move || {
      let following = self.playing.value() && app().views.view() == ScreenView::Tracks;
      *self.follow_timer.borrow_mut() =
        following.then(|| Interval::new(FOLLOW_MS, move || self.now.set(now())));
    });
  }

  /// Everything that places the tracks' passes: the tempo, the timeline and
  /// each track's start, sound, clip, repeats, copies and tempo.
  fn arrangement(&self) -> String {
    let a = app();
    let bpm = a.transport.bpm.value();
    let span = a.tracks.track_span();
    let tracks = a.lanes.tracks();
    let parts: Vec<_> = tracks
      .iter()
      .map(|track| {
        (
          &track.id,
          track.start,
          &track.sound,
          loop_on(track),
          track.repeats,
          &track.copies,
          track_bpm(track, bpm),
        )
      })
      .collect();
    serde_json::to_string(&(bpm, span, parts)).unwrap_or_default()
  }

  /// One pass of a track as the mix plays it, rendered once and cached.
  fn render(&self, track: &Track, bpm: f64) -> Pass {
    let key = render_key(track, bpm);
    if let Some((cached, pass)) = self.renders.borrow().get(&track.id)
      && *cached == key
    {
      return pass.clone();
    }
    let pass = pass_of(track, bpm);
    let sound = track.sound.clone();
    let future: LocalBoxFuture<'static, Option<AudioBuffer>> =
      async move { app().engine.render(&pass.notes, pass.length, &sound).await }.boxed_local();
    let shared = future.shared();
    self
      .renders
      .borrow_mut()
      .insert(track.id.clone(), (key, shared.clone()));
    shared
  }

  /// Renders what isn't rendered yet and plays the mix from `from`, looping or
  /// once through; a newer start or a pause cancels it while it renders.
  fn start(&'static self, from: Start, looping: bool, playing: Option<Vec<Track>>) {
    self.run.set(self.run.get() + 1);
    let ticket = self.run.get();
    let a = app();
    a.engine.unlock();
    let (tracks, bpm, span) = fluid::untrack(|| {
      (
        playing.unwrap_or_else(|| a.lanes.tracks()),
        a.transport.bpm.value(),
        a.tracks.track_span(),
      )
    });
    let passes: Vec<Pass> = tracks.iter().map(|track| self.render(track, bpm)).collect();
    spawn_local(async move {
      let buffers = futures_util::future::join_all(passes).await;
      if ticket != self.run.get() {
        return;
      }
      if self.mixer.borrow().is_none() {
        *self.mixer.borrow_mut() = app().engine.mixer();
      }
      let Some(mixer) = self.mixer.borrow().clone() else {
        return;
      };
      let beat = 60. / bpm;
      self.beat_seconds.set(beat);
      let at = match from {
        Start::At(at) => at,
        Start::Following(origin) => ((now() + MIX_LEAD * 1000. - origin) / 1000. / beat).max(0.),
      };
      self.looping.set(looping);
      let mixed: Vec<MixTrack> = tracks
        .iter()
        .zip(buffers)
        .filter_map(|(track, buffer)| {
          let buffer = buffer?;
          let starts = starts_of(track, &pass_of(track, bpm), bpm, span);
          Some(MixTrack {
            id: track.id.clone(),
            buffer,
            starts: starts.iter().map(|ms| ms / 1000.).collect(),
            gain: level_of(track, &tracks),
          })
        })
        .collect();
      mixer.play(mixed, span * beat, at * beat, looping);
    });
  }

  /// Plays `tracks` from where the mix was paused, looping.
  fn play(&'static self, tracks: Vec<Track>) {
    self.playing.set(true);
    self.start(Start::At(self.paused.get()), true, Some(tracks));
  }

  /// Plays the timeline once through from the top at `origin`
  /// (`performance.now` ms), so a take recorded from then lines up with it.
  pub fn follow(&'static self, origin: f64) {
    fluid::batch(|| {
      self.scrubbed.set(None);
      self.paused.set(0.);
      self.playing.set(true);
    });
    self.start(Start::Following(origin), false, None);
  }

  /// Holds the mix where it is, so Play resumes there.
  fn pause_mix(&self) {
    self.run.set(self.run.get() + 1);
    if let Some(mixer) = self.mixer.borrow().as_ref() {
      let at = mixer.stop();
      self.paused.set(at / self.beat_seconds.get());
    }
    self.playing.set_if_changed(false);
  }

  /// Stops and rewinds to the top, so Play starts over.
  fn stop_mix(&self) {
    self.run.set(self.run.get() + 1);
    if let Some(mixer) = self.mixer.borrow().as_ref() {
      mixer.stop();
    }
    self.paused.set(0.);
    self.playing.set_if_changed(false);
  }

  /// Where the mix is (beats); read every frame. Stopped, it holds the
  /// paused position so the playhead stays put.
  pub fn position(&self) -> f64 {
    match self.mixer.borrow().as_ref().and_then(TrackMixer::position) {
      Some(at) => at / self.beat_seconds.get(),
      None => self.paused.get(),
    }
  }

  /// Moves the play position (beats) without starting, so Play begins
  /// there; while it plays, it carries on from the new place.
  fn seek(&'static self, beat: f64) {
    self.paused.set(beat.max(0.));
    if *self.playing.get_untracked() {
      self.start(Start::At(self.paused.get()), self.looping.get(), None);
    }
  }

  /// Whether the tracks are the main view, where the mix plays.
  pub fn mix_view(&self) -> bool {
    app().views.main_view() == MainView::Tracks
  }

  /// A beat's length at the tempo (ms).
  fn beat_ms(&self) -> f64 {
    app().transport.timing().beat_ms()
  }

  /// Where the mix was scrubbed to (ms), while it holds: stopped, until Play;
  /// playing, for a moment after the turn.
  fn held(&self) -> Option<f64> {
    let playing = self.playing.value();
    let now = self.now.value();
    self
      .scrubbed
      .value()
      .filter(|(_, at)| !playing || now - at < TURN_MS)
      .map(|(to, _)| to)
  }

  /// How many bars the timeline has.
  pub fn mix_bars(&self) -> usize {
    let timing = app().transport.timing();
    ((app().tracks.track_span() * timing.beat_ms() / timing.bar_ms()).ceil() as usize).max(1)
  }

  /// Where the mix is (ms), or where the scrub holds it.
  fn mix_at(&self) -> f64 {
    self
      .held()
      .unwrap_or_else(|| fluid::untrack(|| self.position()) * self.beat_ms())
  }

  /// The bar the mix is in, from 0.
  pub fn mix_bar(&self) -> usize {
    let bar = app().transport.timing().bar_ms();
    ((self.mix_at() / bar).floor() as usize).min(self.mix_bars() - 1)
  }

  /// The seek knob is continuous in milliseconds, so scrubbing follows the
  /// drag rather than snapping to a grid.
  pub fn mix_steps(&self) -> usize {
    (crate::logic::js::round(app().tracks.track_span() * self.beat_ms()) as usize).max(2)
  }

  /// Where the seek knob rests (ms).
  pub fn mix_step(&self) -> f64 {
    self.mix_at().min(self.mix_steps() as f64 - 1.)
  }

  /// The tracks' rendered passes laid at their starts, at their levels:
  /// `progress` hears how many have rendered (0–1).
  async fn mix_parts(&self, progress: impl Fn(f64)) -> Vec<MixPart> {
    let (tracks, bpm, span) = fluid::untrack(|| {
      (
        app().lanes.tracks(),
        app().transport.bpm.value(),
        app().tracks.track_span(),
      )
    });
    let heard: Vec<&Track> = tracks
      .iter()
      .filter(|track| audible(track, &tracks))
      .collect();
    let mut parts = Vec::new();
    for (done, track) in heard.iter().enumerate() {
      let buffer = self.render(track, bpm).await;
      progress((done + 1) as f64 / heard.len() as f64);
      let Some(buffer) = buffer else {
        continue;
      };
      if track.volume == 0. {
        continue;
      }
      let channel = |index: u32| {
        Rc::new(
          buffer
            .get_channel_data(index.min(buffer.number_of_channels() - 1))
            .unwrap_or_default(),
        )
      };
      let pass = pass_of(track, bpm);
      parts.push(MixPart {
        buffer: Rendered {
          left: channel(0),
          right: channel(1),
          rate: f64::from(buffer.sample_rate()),
        },
        starts: starts_of(track, &pass, bpm, span),
        level: track.volume,
      });
    }
    parts
  }

  /// The mix from `start` to `end` (ms), for scrubbing like a take.
  fn render_mix(&'static self) -> Render {
    Box::new(
      move |start: f64, end: f64| -> Pin<Box<dyn Future<Output = Option<AudioBuffer>>>> {
        Box::pin(async move {
          let parts = self.mix_parts(|_| {}).await;
          let rate = parts.first()?.buffer.rate;
          let frames = ((end - start) * rate / 1000.).ceil() as usize;
          let mut left = vec![0f32; frames];
          let mut right = vec![0f32; frames];
          crate::logic::export::mix_into(&parts, start, &mut left, &mut right, rate);
          let options = web_sys::AudioBufferOptions::new(frames.max(1) as u32, rate as f32);
          options.set_number_of_channels(2);
          let out = AudioBuffer::new(&options).ok()?;
          out.copy_to_channel(&left, 0).ok()?;
          out.copy_to_channel(&right, 1).ok()?;
          Some(out)
        })
      },
    )
  }

  /// Everything that shapes the scrubbed mix's sound.
  fn scrub_key(&self) -> String {
    let a = app();
    let bpm = a.transport.bpm.value();
    let tracks = a.lanes.tracks();
    let parts: Vec<_> = tracks
      .iter()
      .map(|track| {
        (
          &track.id,
          track.start,
          &track.sound,
          &track.take,
          loop_on(track),
          track.repeats,
          &track.copies,
          track_bpm(track, bpm),
          level_of(track, &tracks),
        )
      })
      .collect();
    serde_json::to_string(&(bpm, a.tracks.track_span(), parts)).unwrap_or_default()
  }

  /// Scrubs the mix to `to` (ms), moving where Play resumes too.
  pub fn scrub_mix(&'static self, to: f64) {
    let (key, at, beat_ms) = fluid::untrack(|| (self.scrub_key(), self.mix_at(), self.beat_ms()));
    self.scrub.scroll_to(&key, to, at, &self.render_mix());
    self.scrubbed.set(Some((to, now())));
    // Move the play position too, so Play resumes from where it was
    // scrubbed, or the playing mix carries on from there.
    self.seek(to / beat_ms);
  }

  /// Where the playhead is (beats); read every frame. A scrub holds it
  /// while the mix is stopped; otherwise it is where the mix is, or was
  /// paused (so it stays put while a mix renders before it plays).
  pub fn track_position(&self) -> Option<f64> {
    let playing = *self.playing.get_untracked();
    let scrubbed = *self.scrubbed.get_untracked();
    match scrubbed {
      Some((to, _)) if !playing => Some(to / fluid::untrack(|| self.beat_ms())),
      _ => Some(self.position()),
    }
  }

  /// The take only shows on the tracks, so with nothing kept there is
  /// nothing to play.
  pub fn toggle_play(&'static self) {
    let a = app();
    self.scrubbed.set(None);
    if *self.playing.get_untracked() {
      self.pause_mix();
      return;
    }
    let tracks = fluid::untrack(|| a.lanes.tracks());
    if tracks.is_empty() {
      let taped = fluid::untrack(|| {
        a.lanes.take().is_some_and(|take| !take.notes.is_empty())
          || a
            .session
            .session
            .with(|session| !session.pattern.hits.is_empty())
      });
      a.feedback.show_prompt(if taped {
        "Save the take as a track first"
      } else {
        "No tracks to play"
      });
      return;
    }
    // Playing leaves clip mode: every track plays whole again, its clip kept
    // for when it's turned back on.
    let whole: Vec<Track> = tracks
      .into_iter()
      .map(|mut track| {
        if let Some(clip) = track.loop_.as_mut()
          && clip.on
        {
          clip.on = false;
        }
        track
      })
      .collect();
    fluid::batch(|| {
      a.session.set_tracks(|tracks| {
        for track in tracks.iter_mut() {
          if let Some(clip) = track.loop_.as_mut() {
            clip.on = false;
          }
        }
      });
      a.transport.pause_take();
    });
    self.play(whole);
  }

  /// Holds the mix where it is, if it is playing, so Play resumes there.
  pub fn pause(&self) {
    if *self.playing.get_untracked() {
      self.pause_mix();
    }
  }

  /// Stops the mix and rewinds it to the very start.
  pub fn rewind(&self) {
    self.scrubbed.set(None);
    self.stop_mix();
  }

  /// The notes the tracks play, for MIDI.
  fn midi_parts(&self) -> Vec<MidiPart> {
    let (tracks, bpm, span) = fluid::untrack(|| {
      (
        app().lanes.tracks(),
        app().transport.bpm.value(),
        app().tracks.track_span(),
      )
    });
    tracks
      .iter()
      .filter(|track| audible(track, &tracks))
      .map(|track| {
        let pass = pass_of(track, bpm);
        let starts = starts_of(track, &pass, bpm, span);
        let target = track.sound.target.clone();
        let kit = is_kit(&target);
        let (low, high) = patch(&target).base().range;
        let notes = starts
          .iter()
          .flat_map(|at| {
            pass.notes.iter().map(move |note| {
              let pitch = if kit {
                note.note
              } else {
                fold_note(note.note + track.sound.octave, low, high)
              };
              (
                PlayedNote {
                  note: pitch,
                  start: note.start + at,
                  ..*note
                },
                if kit { note_piece(note.note) } else { None },
              )
            })
          })
          .collect();
        MidiPart {
          name: track.name.clone(),
          target,
          kit,
          volume: track.volume,
          notes,
        }
      })
      .collect()
  }

  /// Saves what the tracks play: the mix as lossless FLAC, or its notes as
  /// MIDI. The Device freezes while the mix renders.
  pub fn export_mix(&'static self, midi: bool) {
    let a = app();
    let any = fluid::untrack(|| {
      let tracks = a.lanes.tracks();
      tracks.iter().any(|track| audible(track, &tracks))
    });
    if !any {
      a.feedback.show_prompt("No tracks to save");
      return;
    }
    if a.feedback.is_busy() {
      return;
    }
    let name = file_name();
    a.feedback.set_busy(true);
    if midi {
      let timing = fluid::untrack(|| a.transport.timing());
      let file = mix_to_midi(&self.midi_parts(), timing.bpm, timing.meter);
      download(&[file], "audio/midi", &format!("{name}.mid"));
      a.feedback.set_busy(false);
      a.feedback.show_notice(format!("Saved {name}.mid"));
      return;
    }
    self.pause();
    a.performance.release_all();
    a.feedback.show_progress(0.);
    a.engine.unlock();
    spawn_local(async move {
      let a = app();
      let parts = self
        .mix_parts(|done| a.feedback.show_progress(done / 2.))
        .await;
      let Some(rate) = parts.first().map(|part| part.buffer.rate) else {
        a.feedback.set_busy(false);
        a.feedback.show_prompt("Couldn't render the mix");
        return;
      };
      let mut encoder = FlacEncoder::new(rate as u32);
      let mut file: Vec<Vec<u8>> = Vec::new();
      let mut chunks = MixChunks::new(&parts, rate);
      while let Some((left, right)) = chunks.next() {
        encoder.push(&left, &right);
        file.extend(encoder.take_frames());
        a.feedback.show_progress(0.5 + chunks.progress() / 2.);
        // Let the page breathe between chunks.
        gloo_timers::future::TimeoutFuture::new(0).await;
      }
      let header = encoder.finish();
      file.extend(encoder.take_frames());
      file.insert(0, header);
      download(&file, "audio/flac", &format!("{name}.flac"));
      a.feedback.set_busy(false);
      a.feedback.show_notice(format!("Saved {name}.flac"));
    });
  }
}

/// Where a play starts: a beat, or in step with a take that started
/// recording at a `performance.now` time.
#[derive(Clone, Copy)]
enum Start {
  /// From this beat.
  At(f64),
  /// Lined up with a take that started recording at this `performance.now` time
  /// (ms).
  Following(f64),
}

/// The file's name: `studio-2026-10-28-1405`.
fn file_name() -> String {
  let date = js_sys::Date::new_0();
  format!(
    "studio-{}-{}-{}-{}{}",
    date.get_full_year(),
    pad2(date.get_month() + 1),
    pad2(date.get_date()),
    pad2(date.get_hours()),
    pad2(date.get_minutes())
  )
}

/// Hands the browser a file to save.
pub fn download(parts: &[Vec<u8>], kind: &str, name: &str) {
  use wasm_bindgen::JsCast;
  let array = js_sys::Array::new();
  for part in parts {
    array.push(&js_sys::Uint8Array::from(part.as_slice()));
  }
  let options = web_sys::BlobPropertyBag::new();
  options.set_type(kind);
  let Ok(blob) = web_sys::Blob::new_with_u8_array_sequence_and_options(&array, &options) else {
    return;
  };
  let Ok(url) = web_sys::Url::create_object_url_with_blob(&blob) else {
    return;
  };
  let document = gloo_utils::document();
  if let Ok(link) = document.create_element("a")
    && let Ok(link) = link.dyn_into::<web_sys::HtmlAnchorElement>()
  {
    link.set_href(&url);
    link.set_download(name);
    link.click();
  }
  gloo_timers::callback::Timeout::new(10_000, move || {
    let _ = web_sys::Url::revoke_object_url(&url);
  })
  .forget();
}
