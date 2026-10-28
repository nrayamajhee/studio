//! The tracks, as web-react's `modes/tracks.tsx`: the mix plays them all,
//! and the blue knob picks one. The green knob seeks the mix and the red
//! one sets the picked track's volume; the arrows slide it by bars. With
//! Shift the knobs zoom and scroll the lanes, or trim a clipped track's
//! edges, the green one slides it by beats and ← → repeat it; ↓ picks the
//! next copy of the whole track further along, or past the last adds one,
//! and ↑ the copy before. The arrows, Shift + green and Delete act on the
//! picked copy. An instrument pad puts its sound on the picked track as
//! well as the keys, which play the track's notes on it from then on.

use std::rc::Rc;

use super::base::{DeleteJob, arrow_pads, delete_pad, mix_pads, pad_preset, save_pad, seek_knob};
use super::{Bindings, Callback, GAP, Knob, KnobBinding, PadBinding, PadSlot, Rich, ScreenTrack};
use crate::icons::Icon;
use crate::logic::js::{number, round};
use crate::logic::presets::KNOB_STEPS;
use crate::logic::tracks::{audible, follows_tape};
use crate::state::App;
use crate::state::keymap::Tool;
use crate::state::lanes::is_take;

pub fn mode(a: &'static App, b: &mut Bindings) {
  let shift = a.shift.shift();
  let lanes = &a.lanes;
  let tracks = &a.tracks;
  let rows = lanes.lanes();
  let focus_index = lanes.focus_index();
  let picked_lane = lanes.picked_lane();
  let track = lanes.picked_track();
  let track_loop = tracks.track_loop();
  let track_span = tracks.track_span();
  let track_from = tracks.track_from();
  let copies = tracks.copies();
  let copy_index = tracks.copy_index();
  let copy = tracks.copy();
  let copied = copies.len() > 1;
  // The picked copy, named in labels while the track has more than one.
  let copy_name = if copied {
    format!("copy {} of ", copy_index + 1)
  } else {
    String::new()
  };
  let bar_beats = a.transport.bar_beats();

  b.set_knob(
    Knob::Green,
    match (&track, copy) {
      (Some(_), Some(copy)) if shift => KnobBinding {
        label: "Slide".into(),
        value_label: Some(tracks.start_label(copy.start)),
        step: round(copy.start),
        steps: track_span as usize + 1,
        on_change: Callback::new(move |start: f64| a.tracks.slide_to(start)),
        fine: false,
      },
      _ => KnobBinding {
        fine: true,
        ..seek_knob(
          format!("Bar {} of {}", a.mix.mix_bar() + 1, a.mix.mix_bars()),
          a.mix.mix_step(),
          a.mix.mix_steps(),
          Callback::new(move |to: f64| a.mix.scrub_mix(to)),
        )
      },
    },
  );
  let loop_unit = tracks.loop_unit();
  b.set_knob(
    Knob::Red,
    match track_loop {
      Some(clip) if shift => KnobBinding {
        label: "Clip start".into(),
        value_label: Some(tracks.loop_label(clip.start)),
        step: round(clip.start / loop_unit),
        steps: tracks.loop_steps(),
        on_change: Callback::new(move |step: f64| a.tracks.set_loop_edge(true, step as usize)),
        fine: false,
      },
      _ if shift => {
        let zooms = tracks.track_zooms();
        let zoom = tracks.track_zoom();
        let count = zooms.len();
        KnobBinding {
          label: "Zoom".into(),
          value_label: Some(format!("×{}", number(zoom))),
          step: zooms
            .iter()
            .position(|candidate| *candidate == zoom)
            .map_or(-1., |at| at as f64),
          steps: count.max(2),
          on_change: Callback::new(move |step: f64| {
            a.tracks
              .zoom_tracks((step as usize).min(count.saturating_sub(1)))
          }),
          fine: false,
        }
      }
      _ => {
        let id = track.as_ref().map(|track| track.id.clone());
        KnobBinding {
          label: "Track volume".into(),
          value_label: track
            .as_ref()
            .map(|track| format!("{}%", number(round(track.volume * 100.)))),
          step: round(track.as_ref().map_or(1., |track| track.volume) * (KNOB_STEPS - 1) as f64),
          steps: KNOB_STEPS,
          on_change: Callback::new(move |step: f64| {
            if let Some(id) = &id {
              a.lanes
                .update_track(id, |track| track.volume = step / (KNOB_STEPS - 1) as f64);
            }
          }),
          fine: false,
        }
      }
    },
  );
  let row_count = rows.len();
  b.set_knob(
    Knob::Blue,
    match track_loop {
      Some(clip) if shift => KnobBinding {
        label: "Clip end".into(),
        value_label: Some(tracks.loop_label(clip.end)),
        step: round(clip.end / loop_unit),
        steps: tracks.loop_steps(),
        on_change: Callback::new(move |step: f64| a.tracks.set_loop_edge(false, step as usize)),
        fine: false,
      },
      _ if shift => KnobBinding {
        label: "Scroll".into(),
        value_label: Some(format!(
          "Bar {}.{}",
          number((track_from / f64::from(bar_beats)).floor() + 1.),
          number(round(track_from).rem_euclid(f64::from(bar_beats)) + 1.)
        )),
        step: round(track_from),
        steps: tracks.pan_steps(),
        on_change: Callback::new(move |step: f64| a.tracks.scroll_tracks(step)),
        fine: false,
      },
      _ => KnobBinding {
        label: "Track".into(),
        value_label: picked_lane.as_ref().map(|lane| lane.name.clone()),
        step: focus_index as f64,
        steps: row_count.max(2),
        on_change: Callback::new(move |index: f64| {
          a.lanes
            .set_focus_index((index as usize).min(row_count.saturating_sub(1)))
        }),
        fine: false,
      },
    },
  );

  mix_pads(b, a);
  b.set_pad(
    PadSlot::Tool(Tool::Save),
    save_pad(
      a,
      "Save the mix",
      None,
      Some(Rc::new(move || a.mix.export_mix(false))),
    ),
  );
  // Mutes the picked track (with Shift, solos it).
  {
    let switched = track.clone();
    b.set_pad(
      PadSlot::Tool(Tool::Mute),
      PadBinding::new(
        match &track {
          Some(track) if shift => format!(
            "{} {}",
            if track.soloed { "Unsolo" } else { "Solo" },
            track.name
          ),
          Some(track) => format!(
            "{} {}",
            if track.muted { "Unmute" } else { "Mute" },
            track.name
          ),
          None if shift => "Solo a track".into(),
          None => "Mute a track".into(),
        },
        Icon::Lucide(if shift { "Headphones" } else { "VolumeX" }),
        move |_| match &switched {
          Some(track) => a.tracks.toggle_switch(track, shift),
          None => a.feedback.show_prompt(format!(
            "Pick a track to {}",
            if shift { "solo" } else { "mute" }
          )),
        },
      )
      .lit(
        track
          .as_ref()
          .is_some_and(|track| if shift { track.soloed } else { track.muted }),
      )
      .shift_legend(shift),
    );
  }
  // Clips the picked track to its loop or lets it play whole; with Shift,
  // while it is clipped, trims it for good to its clip.
  {
    let clipped = track.clone();
    b.set_pad(
      PadSlot::Tool(Tool::Clip),
      PadBinding::new(
        match &track {
          _ if shift => "Trim track to its clip".to_owned(),
          Some(track) => format!(
            "{} {}",
            if track_loop.is_some() {
              "Unclip"
            } else {
              "Clip"
            },
            track.name
          ),
          None => "Clip a track".into(),
        },
        Icon::Lucide(if shift {
          "ScissorsLineDashed"
        } else {
          "Scissors"
        }),
        move |_| {
          let Some(track) = &clipped else {
            a.feedback.show_prompt(format!(
              "Pick a track to {}",
              if shift { "trim" } else { "clip" }
            ));
            return;
          };
          if !shift {
            a.tracks.toggle_clip(track);
          } else if track.loop_.is_some_and(|clip| clip.on) {
            a.tracks.trim_to_clip(track);
          } else {
            a.feedback.show_prompt(format!("Clip {} first", track.name));
          }
        },
      )
      .lit(track_loop.is_some())
      .shift_legend(shift),
    );
  }
  let own = if picked_lane.as_ref().is_some_and(is_take) {
    Some(DeleteJob::new(
      "Discard the take",
      "delete:take",
      "Press again to discard the take",
      move || {
        a.lanes.discard_take();
        a.feedback.show_notice("Discarded the take");
      },
    ))
  } else {
    track.as_ref().map(|track| {
      let name = track.name.clone();
      if copied {
        let label = format!("{copy_name}{name}");
        DeleteJob::new(
          format!("Delete {label}"),
          format!("delete:{}:{copy_index}", track.id),
          format!("Press again to delete {label}"),
          move || {
            a.tracks.delete_copy();
            a.feedback.show_notice(format!("Deleted {label}"));
          },
        )
      } else {
        let id = track.id.clone();
        DeleteJob::new(
          format!("Delete {name}"),
          format!("delete:{id}"),
          format!("Press again to delete {name}"),
          move || {
            a.lanes.delete_track(&id);
            a.feedback.show_notice(format!("Deleted {name}"));
          },
        )
      }
    })
  };
  b.set_pad(
    PadSlot::Tool(Tool::Delete),
    delete_pad(a, own.map(|job| (job, true)), None),
  );
  // With Shift, the copy before the picked one, and the next copy or past
  // the last a new one.
  match &track {
    Some(track) if shift => {
      let last = copy_index + 1 == copies.len();
      b.set_pad(
        PadSlot::Up,
        PadBinding::new(
          format!("Previous copy of {}", track.name),
          Icon::Lucide("ArrowUp"),
          move |_| a.tracks.step_copy(-1),
        )
        .shift_legend(true),
      );
      b.set_pad(
        PadSlot::Down,
        PadBinding::new(
          if last {
            format!("Add a copy of {}", track.name)
          } else {
            format!("Next copy of {}", track.name)
          },
          Icon::Lucide(if last { "CopyPlus" } else { "ArrowDown" }),
          move |_| a.tracks.step_copy(1),
        )
        .shift_legend(true),
      );
    }
    _ => {
      b.set_pad(
        PadSlot::Up,
        PadBinding::new("Previous track", Icon::Lucide("ArrowUp"), move |_| {
          a.lanes.step_focus(-1)
        }),
      );
      b.set_pad(
        PadSlot::Down,
        PadBinding::new("Next track", Icon::Lucide("ArrowDown"), move |_| {
          a.lanes.step_focus(1)
        }),
      );
    }
  }
  let what = if copy_name.is_empty() {
    "track ".to_owned()
  } else {
    copy_name.clone()
  };
  arrow_pads(
    b,
    a,
    if shift {
      [format!("Repeat {what}less"), format!("Repeat {what}more")]
    } else {
      [format!("Slide {what}earlier"), format!("Slide {what}later")]
    },
    move |direction| {
      if shift {
        a.tracks.repeat_track(direction);
      } else {
        a.tracks
          .slide_track(f64::from(direction) * f64::from(bar_beats));
      }
    },
  );
  if let Some(track) = &track {
    for (pad, binding) in b.instrument_pads.iter_mut().enumerate() {
      let Some(bound) = pad_preset(a, pad) else {
        continue;
      };
      if bound.id == track.preset_id {
        continue;
      }
      binding.label = format!("Play {} on {}", track.name, bound.name);
      let own = binding.on_press.clone();
      let track = track.clone();
      binding.on_press = Callback::new(move |shifted| {
        own.call(shifted);
        a.tracks.set_track_instrument(&track, &bound);
        a.feedback
          .show_notice(format!("{} → {}", track.name, bound.name));
      });
    }
  }

  let screen = &mut b.screen;
  screen.title = format!(
    "Tracks · {}",
    lanes.current_tape().map_or(String::new(), |tape| tape.name)
  );
  screen.unsaved = false;
  // The picked track in blue, as the blue knob picks it.
  screen.status = Rich::new().value(format!("{}/{}", focus_index + 1, row_count));
  // Left, the picked track: where it starts (or the section it's clipped
  // to), its repeats and volume; with Shift, just what the knobs move, in
  // their colours. Right, what the knobs do now.
  let place = if copied {
    format!("{}/{}{GAP}", copy_index + 1, copies.len())
  } else {
    String::new()
  };
  let left = match (&track, copy) {
    (Some(_), Some(copy)) if shift => {
      let line = Rich::text(place).seek(format!("Starts {}", tracks.start_short(copy.start)));
      match track_loop {
        Some(clip) => line.plain(format!("{GAP}Clip ")).selection(
          format!("{} –", tracks.loop_label(clip.start)),
          tracks.loop_label(clip.end),
        ),
        None => line,
      }
    }
    (Some(track), Some(copy)) => Rich::text(format!(
      "{place}{}{GAP}×{}{GAP}{}{GAP}",
      match track_loop {
        Some(clip) => format!(
          "Clip {} – {}",
          tracks.loop_label(clip.start),
          tracks.loop_label(clip.end)
        ),
        None => format!("Starts {}", tracks.start_short(copy.start)),
      },
      copy.repeats,
      if follows_tape(track) {
        "Tape tempo".to_owned()
      } else {
        format!("{} BPM", number(track.timing.bpm))
      }
    ))
    .level(format!("Vol {}%", number(round(track.volume * 100.)))),
    _ => Rich::text(format!("Take{GAP}")).hint("record piano or drum, then save it"),
  };
  let mut right = Rich::new();
  if shift || track.is_some() {
    right = right
      .level(if shift {
        if track_loop.is_some() {
          "Clip start"
        } else {
          "Zoom"
        }
      } else {
        "Volume"
      })
      .hint(GAP);
  }
  right = right
    .seek(if shift && track.is_some() {
      "Slide"
    } else {
      "Seek"
    })
    .hint(GAP)
    .value(if shift {
      if track_loop.is_some() {
        "Clip end"
      } else {
        "Scroll"
      }
    } else {
      "Track"
    });
  screen.footer = (left, right);
  let clips = tracks.clips();
  let presets = a.sound.presets();
  let all_tracks = lanes.tracks();
  let pattern = a.grid.pattern_clip();
  screen.tracks = rows
    .iter()
    .enumerate()
    .map(|(i, lane)| {
      let take = is_take(lane);
      ScreenTrack {
        id: lane.id.clone(),
        name: lane.name.clone(),
        detail: presets
          .iter()
          .find(|preset| preset.id == lane.preset_id)
          .map_or(String::new(), |preset| preset.name.clone()),
        color: lane.color.clone(),
        clip: clips[i].clone(),
        copy: (i == focus_index).then_some(copy_index),
        volume: lane.volume,
        muted: lane.muted,
        soloed: lane.soloed,
        audible: take || audible(lane, &all_tracks),
        potential: take,
        pattern: if take { pattern.clone() } else { None },
      }
    })
    .collect();
  screen.track_span = track_span;
  screen.track_zoom = tracks.track_zoom();
  screen.track_from = track_from;
  screen.on_pan_tracks = Some(Callback::new(move |beats: f64| a.tracks.pan_tracks(beats)));
  screen.bar_beats = bar_beats;
  screen.selected = focus_index;
  screen.on_select = Some(Callback::new(move |index: usize| {
    a.lanes.set_focus_index(index)
  }));
  screen.on_loop_edge = Some(Callback::new(
    move |(index, start, beats): (usize, bool, f64)| a.tracks.drag_loop_edge(index, start, beats),
  ));
  screen.on_loop_edge_drag = Some(Callback::new(move |dragging: bool| {
    a.tracks.set_dragging(dragging)
  }));
  screen.on_select_copy = Some(Callback::new(move |(index, copy): (usize, usize)| {
    a.tracks.pick_copy(index, copy)
  }));
}
