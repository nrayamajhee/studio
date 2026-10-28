//! The piano roll (record mode), as web-react's `modes/roll.tsx`: the take
//! on the roll. Record arms it and Play starts it; stopped, the green knob
//! scrolls it in time. The red knob sets the time signature (with Shift,
//! transposes the whole take a semitone a step) and the blue one the
//! roll's octave; ↑ and ↓ move the roll a semitone. The take keeps the
//! timing it was played with.

use super::base::seek_knob;
use super::{Bindings, Callback, Knob, KnobBinding, PadBinding, PadSlot, Rich, ScreenBadge};
use crate::icons::Icon;
use crate::logic::timing::METERS;
use crate::logic::tracks::{NewTrack, TrackSource, make_track};
use crate::state::App;
use crate::state::keymap::Tool;
use crate::state::view::ScreenView;
use crate::store::session::now;

/// Save in record mode keeps the take as a new track, with the preset and
/// timing it plays with now, and shows it on the tracks from the top.
/// Tracks are never changed in place: a track loaded as the take saves as a
/// new one.
fn save_take(a: &'static App) {
  let Some(recorded) = a.transport.keep_take() else {
    a.feedback.show_prompt("Record a take first");
    return;
  };
  let kept = fluid::untrack(|| {
    let preset = a.sound.preset();
    let modules = a.session.session.with(|session| session.modules.clone());
    make_track(NewTrack {
      count: a.lanes.track_count(),
      name: &preset.name,
      take: &recorded,
      preset_id: &preset.id,
      sound: &a.engine.sound(),
      modules: &modules,
      // The tempo it plays at now: the tape's.
      timing: a.transport.timing(),
      source: TrackSource::Roll,
      now: now(),
    })
  });
  let name = kept.name.clone();
  fluid::batch(|| {
    a.lanes.add_track(kept);
    a.session.set_take(None);
    a.mix.rewind();
    a.views.set_view(ScreenView::Tracks);
    a.feedback.show_notice(format!("Saved {name}"));
  });
}

pub fn mode(a: &'static App, b: &mut Bindings) {
  let shift = a.shift.shift();
  let timing = a.transport.timing();
  let take = &a.take;
  let scrolls = take.roll_scrolls();
  let bars = || (take.bar_of(take.roll_at()), take.bar_of(take.roll_end()));
  let status = if take.record_armed() {
    Rich::new().level("Armed")
  } else if scrolls {
    let (at, end) = bars();
    Rich::new().seek(format!("Bar {at}/{end}"))
  } else if a.transport.recording() {
    Rich::text("Rec")
  } else if a.transport.playing() {
    Rich::text("Play")
  } else {
    Rich::text("Take")
  };
  if scrolls {
    let (at, end) = bars();
    b.set_knob(
      Knob::Green,
      seek_knob(
        format!("Bar {at} of {end}"),
        take.roll_step() as f64,
        take.roll_steps(),
        Callback::new(move |step: f64| a.take.scrub_roll_to(step)),
      ),
    );
  }
  let notes = take.take_notes();
  b.set_knob(
    Knob::Red,
    if shift {
      KnobBinding {
        label: "Transpose".into(),
        value_label: Some(notes.clone().unwrap_or_else(|| "No notes".into())),
        step: take.transpose_step() as f64,
        steps: take.transpose_steps(),
        on_change: Callback::new(move |step: f64| a.take.transpose_take(step as usize)),
        fine: false,
      }
    } else {
      KnobBinding {
        label: "Time signature".into(),
        value_label: Some(timing.meter.label()),
        step: a.transport.meter_index.value() as f64,
        steps: METERS.len(),
        on_change: Callback::new(move |step: f64| a.transport.set_meter(step as usize)),
        fine: false,
      }
    },
  );
  let range = take.roll_range();
  b.set_knob(
    Knob::Blue,
    KnobBinding {
      label: "Pitch".into(),
      value_label: Some(range.clone()),
      step: take.roll_octave() as f64,
      steps: take.roll_octaves(),
      on_change: Callback::new(move |step: f64| a.take.set_roll_octave(step as usize)),
      fine: false,
    },
  );
  b.set_pad(
    PadSlot::Tool(Tool::Save),
    PadBinding::new("Save take as a track", Icon::Lucide("Save"), move |_| {
      save_take(a)
    }),
  );
  b.set_pad(
    PadSlot::Up,
    PadBinding::new("Up a semitone", Icon::Lucide("ArrowUp"), move |_| {
      a.take.scroll_roll_pitch(1)
    }),
  );
  b.set_pad(
    PadSlot::Down,
    PadBinding::new("Down a semitone", Icon::Lucide("ArrowDown"), move |_| {
      a.take.scroll_roll_pitch(-1)
    }),
  );

  // The meter and notes in view, in the colours of the knobs that set them
  // (Shift turns red over to the take's notes); when stopped, the bar the
  // green knob scrolled to, in green.
  let screen = &mut b.screen;
  screen.status = status
    .plain(" · ")
    .level(if shift {
      format!("Notes {}", notes.unwrap_or_else(|| "none".into()))
    } else {
      timing.meter.label()
    })
    .plain(" · ")
    .value(range);
  screen.timing = Some(timing);
  screen.roll_position = scrolls.then(|| take.roll_at());
  screen.roll_low = Some(take.roll_low());
  screen.on_roll_scroll = scrolls.then(|| Callback::new(move |ms: f64| a.take.scroll_roll(ms)));
  screen.on_roll_pitch = Some(Callback::new(move |semitones: i32| {
    a.take.scroll_roll_pitch(semitones)
  }));
  // Armed, a hint along the bottom until Play starts the take.
  screen.badge = take.record_armed().then(|| ScreenBadge {
    label: "Press Play to record".into(),
    on: None,
  });
}
