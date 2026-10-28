//! The drum grid, as web-react's `modes/drumGrid.tsx`: the green knob
//! moves the head, the red one sets the length and the blue one the
//! resolution. Stopped, keys set or clear their piece at the head; Play
//! loops the pattern, and Record loops it and lands each tap on the nearest
//! step.

use super::base::{DeleteJob, arrow_pads, delete_pad, drum_grid_pads, pad_preset, seek_knob};
use super::{Bindings, Callback, Knob, KnobBinding, PadBinding, PadSlot, Rich, StepRow};
use crate::icons::{Icon, piece_name};
use crate::logic::math::{plural, position_label};
use crate::logic::pattern::{MAX_STEP_BARS, STEP_RESOLUTIONS, pattern_take};
use crate::logic::presets::is_kit;
use crate::logic::timing::Timing;
use crate::logic::tracks::{NewTrack, TrackSource, make_track};
use crate::state::App;
use crate::state::keymap::Tool;
use crate::state::view::ScreenView;
use crate::store::session::now;

/// Save in the drum grid keeps the pattern as a new track on its grid, with
/// the take's effects, and shows it on the tracks.
fn keep_pattern(a: &'static App) {
  let Some(kit) = fluid::untrack(|| a.sound.step_kit()) else {
    return;
  };
  let (pattern, timing, modules) = fluid::untrack(|| {
    a.session.session.with(|session| {
      (
        session.pattern.clone(),
        a.transport.timing(),
        session.modules.clone(),
      )
    })
  });
  let kept = pattern_take(&pattern, &kit, timing.meter, timing.bpm);
  if kept.notes.is_empty() {
    a.feedback.show_prompt("Set some steps first");
    return;
  }
  a.grid.stop_pattern();
  let saved = fluid::untrack(|| {
    let preset = a.sound.preset();
    make_track(NewTrack {
      count: a.lanes.track_count(),
      name: &preset.name,
      take: &kept,
      preset_id: &preset.id,
      sound: &a.engine.sound(),
      modules: &modules,
      timing: Timing {
        per_beat: pattern.per_beat,
        ..timing
      },
      source: TrackSource::DrumGrid,
      now: now(),
    })
  });
  let name = saved.name.clone();
  fluid::batch(|| {
    a.lanes.add_track(saved);
    a.mix.rewind();
    a.views.set_view(ScreenView::Tracks);
    a.feedback.show_notice(format!("Saved {name}"));
  });
}

pub fn mode(a: &'static App, b: &mut Bindings) {
  let pattern = a.session.session.with(|session| session.pattern.clone());
  let grid = &a.grid;
  let step_head = grid.step_head();
  let step_count = grid.step_count();
  let running = grid.pattern_running();
  let recording = grid.recording_pattern();
  let timing = a.transport.timing();
  let resolution = Timing {
    per_beat: pattern.per_beat,
    ..timing
  }
  .grid_label();
  let length = plural(pattern.bars as usize, "bar");

  b.set_knob(
    Knob::Green,
    seek_knob(
      format!("Step {} of {step_count}", step_head + 1),
      f64::from(step_head),
      step_count.max(2) as usize,
      Callback::new(move |step: f64| a.grid.move_step_head(step as i64)),
    ),
  );
  b.set_knob(
    Knob::Red,
    KnobBinding {
      label: "Length".into(),
      value_label: Some(length.clone()),
      step: f64::from(pattern.bars - 1),
      steps: MAX_STEP_BARS as usize,
      on_change: Callback::new(move |index: f64| a.grid.set_step_bars(index as u32 + 1)),
      fine: false,
    },
  );
  b.set_knob(
    Knob::Blue,
    KnobBinding {
      label: "Resolution".into(),
      value_label: Some(resolution.clone()),
      step: STEP_RESOLUTIONS
        .iter()
        .position(|&per_beat| per_beat == pattern.per_beat)
        .map_or(-1., |at| at as f64),
      steps: STEP_RESOLUTIONS.len(),
      on_change: Callback::new(move |index: f64| a.grid.set_step_resolution(index as usize)),
      fine: false,
    },
  );
  drum_grid_pads(b, a);
  b.set_pad(
    PadSlot::Tool(Tool::Record),
    PadBinding::new(
      if recording {
        "Stop recording the pattern"
      } else {
        "Record the pattern"
      },
      Icon::Filled("Circle"),
      move |_| {
        a.engine.unlock();
        if fluid::untrack(|| a.grid.recording_pattern()) {
          a.grid.stop_pattern();
        } else {
          a.grid.play_pattern(true);
        }
      },
    )
    .lit(a.transport.recording() || recording),
  );
  b.set_pad(
    PadSlot::Tool(Tool::Save),
    PadBinding::new("Save pattern as a track", Icon::Lucide("Save"), move |_| {
      keep_pattern(a)
    }),
  );
  let clear = DeleteJob::new(
    "Clear the pattern",
    "delete:pattern",
    "Press again to clear the pattern",
    move || {
      a.grid.clear_pattern();
      a.feedback.show_notice("Cleared the pattern");
    },
  );
  b.set_pad(
    PadSlot::Tool(Tool::Delete),
    delete_pad(a, Some((clear, !pattern.hits.is_empty())), None),
  );
  arrow_pads(
    b,
    a,
    ["Previous step".into(), "Next step".into()],
    move |direction| a.grid.move_step_head_by(i64::from(direction)),
  );
  for (pad, binding) in b.instrument_pads.iter_mut().enumerate() {
    let own = binding.on_press.clone();
    binding.on_press = Callback::new(move |shifted| {
      let bound = fluid::untrack(|| pad_preset(a, pad));
      if bound.is_some_and(|bound| !is_kit(&bound.target)) {
        a.feedback.show_prompt("The drum grid plays drum kits");
        return;
      }
      own.call(shifted);
    });
  }

  // The length and resolution in the red and blue of the knobs that set
  // them; stopped, where the head is, in green.
  let screen = &mut b.screen;
  let lead = if recording {
    Rich::new().level("Rec")
  } else if running {
    Rich::text("Play")
  } else {
    Rich::new().seek(position_label(
      f64::from(step_head) / f64::from(pattern.per_beat),
      timing.meter.beats,
      pattern.per_beat,
    ))
  };
  screen.status = lead.plain(" · ").selection(length, resolution);
  let hint = if recording {
    Rich::new().hint("Tap keys in time")
  } else if running {
    Rich::new()
      .pad("Record", Icon::Filled("Circle"))
      .hint(" to tap hits in")
  } else {
    Rich::new().hint("Keys set hits at the head")
  };
  screen.footer = (
    if a.sound.step_kit().is_some() {
      Rich::new()
    } else {
      Rich::new().hint("Pick a drum kit")
    },
    hint,
  );
  screen.step_rows = grid
    .step_rows()
    .into_iter()
    .map(|piece| StepRow {
      id: piece.into(),
      label: piece_name(piece).into(),
      icon: Icon::Piece(piece.into()),
    })
    .collect();
  screen.step_count = step_count;
  screen.steps_per_beat = pattern.per_beat;
  screen.steps_per_bar = grid.steps_per_bar();
  screen.step_hits = grid.step_hits();
  screen.step_recording = recording;
  screen.on_toggle_step = Some(Callback::new(move |(row, at): (usize, u32)| {
    a.grid.toggle_step(row, at)
  }));
  screen.on_move_step = Some(Callback::new(move |steps: i64| {
    a.grid.move_step_head_by(steps)
  }));
}
