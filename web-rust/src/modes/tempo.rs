//! The tempo, as web-react's `modes/tempo.tsx`: the green knob and the
//! arrows set it, a beat per minute at a time, as does dragging the number
//! on the screen, or clicking it to type one; ↓ (between Slower and Faster)
//! switches tap mode, where played notes tap the tempo. It is the take's,
//! and so the tape's: what records, the click, the drum grid and the
//! tracks' bar lines run at. With a track picked on the tracks it is that
//! track's own instead, which it plays at whatever the tape's, and ↑ links
//! it to the tape's or lets it go; without one, ↑ gives every track the
//! tape's tempo as its own. The red knob sets the swing and the blue one
//! what it swings, eighths or sixteenths: the tape's, which the take, the
//! drum grid and the play styles play through, or the picked track's own
//! (kept from the tape's when it was saved).

use std::rc::Rc;

use super::base::{arrow_pads, seek_knob, unused_pad};
use super::{Bindings, Callback, Knob, KnobBinding, PadBinding, PadSlot, Rich, ScreenBadge};
use crate::icons::Icon;
use crate::logic::js::number;
use crate::logic::swing::{MAX_SWING, MIN_SWING, STRAIGHT, SWING_UNITS, Swing};
use crate::logic::timing::Timing;
use crate::logic::tracks::{follows_tape, track_bpm};
use crate::state::App;
use crate::state::lanes::is_take;
use crate::state::transport::{MAX_BPM, MIN_BPM};

pub fn mode(a: &'static App, b: &mut Bindings) {
  let bpm = a.transport.bpm.value();
  let tap_mode = a.transport.tap_mode();
  let tap_count = a.transport.tap_count.value();
  let bar_beats = a.transport.bar_beats() as usize;
  let focused = a.lanes.focused_lane();
  let track = (!is_take(&focused)).then_some(focused);
  let linked = track.as_ref().is_some_and(follows_tape);
  let tempo = track.as_ref().map_or(bpm, |track| track_bpm(track, bpm));
  let set_tempo: Rc<dyn Fn(f64)> = {
    let track = track.clone();
    Rc::new(move |next: f64| match &track {
      Some(track) => a.tracks.set_track_tempo(track, next),
      None => a.transport.set_bpm(next),
    })
  };
  let swing = match &track {
    Some(track) => track.timing.swing,
    None => Some(a.transport.swing.value()),
  }
  .unwrap_or(STRAIGHT);
  let set_swing: Rc<dyn Fn(Swing)> = {
    let track = track.clone();
    Rc::new(move |next: Swing| match &track {
      Some(track) => a.tracks.set_track_swing(track, next),
      None => a.transport.set_swing(next),
    })
  };
  let timing = a.transport.timing();
  let meter = track
    .as_ref()
    .map_or(timing.meter, |track| track.timing.meter);
  let unit = format!("1/{}", meter.unit * swing.per_beat);
  // A drum-grid track on triplets is swung already, and plays straight.
  let triplets = track
    .as_ref()
    .is_some_and(|track| track.timing.per_beat % 3 == 0 && track.timing.per_beat > 0);

  b.set_knob(
    Knob::Green,
    seek_knob(
      format!("{} BPM", number(tempo)),
      tempo - MIN_BPM,
      (MAX_BPM - MIN_BPM + 1.) as usize,
      Callback::new({
        let set_tempo = set_tempo.clone();
        move |step: f64| set_tempo(MIN_BPM + step)
      }),
    ),
  );
  b.set_knob(
    Knob::Red,
    KnobBinding {
      label: "Swing".into(),
      value_label: Some(if swing.amount > MIN_SWING {
        format!(
          "{}%{}",
          number(swing.amount),
          if triplets {
            " (triplets play straight)"
          } else {
            ""
          }
        )
      } else {
        "Straight".into()
      }),
      step: swing.amount - MIN_SWING,
      steps: (MAX_SWING - MIN_SWING + 1.) as usize,
      on_change: Callback::new({
        let set_swing = set_swing.clone();
        move |step: f64| {
          set_swing(Swing {
            amount: MIN_SWING + step,
            ..swing
          })
        }
      }),
      fine: false,
    },
  );
  b.set_knob(
    Knob::Blue,
    KnobBinding {
      label: "Swing on".into(),
      value_label: Some(unit.clone()),
      step: SWING_UNITS
        .iter()
        .position(|&unit| unit == swing.per_beat)
        .map_or(-1., |at| at as f64),
      steps: SWING_UNITS.len(),
      on_change: Callback::new(move |step: f64| {
        set_swing(Swing {
          per_beat: SWING_UNITS
            .get(step as usize)
            .copied()
            .unwrap_or(swing.per_beat),
          ..swing
        })
      }),
      fine: false,
    },
  );
  {
    let set_tempo = set_tempo.clone();
    arrow_pads(b, a, ["Slower".into(), "Faster".into()], move |direction| {
      set_tempo(tempo + f64::from(direction))
    });
  }
  // ↓ has a job of its own here, so ↑ leaves the octave alone; with a track
  // picked, it links the track to the tape's tempo.
  b.set_pad(
    PadSlot::Up,
    match &track {
      Some(track) => {
        let linked_track = track.clone();
        PadBinding::new(
          if linked {
            format!("Give {} its own tempo", track.name)
          } else {
            format!("Link {} to the tape's tempo", track.name)
          },
          Icon::Lucide(if linked { "Link2" } else { "Link2Off" }),
          move |_| a.tracks.toggle_follow_tape(&linked_track),
        )
        .lit(linked)
      }
      None => PadBinding::new(
        format!("Set every track to {} BPM", number(tempo)),
        Icon::Lucide("ListMusic"),
        move |_| {
          if fluid::untrack(|| a.lanes.tracks().is_empty()) {
            a.feedback.show_prompt("No tracks on this tape");
            return;
          }
          a.tracks.set_all_track_tempo(tempo);
          a.feedback
            .show_notice(format!("Every track at {} BPM", number(tempo)));
        },
      ),
    },
  );
  // Tapping sets the tape's tempo, so not a track's.
  b.set_pad(
    PadSlot::Down,
    if track.is_some() {
      unused_pad("Tap tempo", Icon::Lucide("Pointer"))
    } else {
      PadBinding::new(
        if tap_mode {
          "Stop tap tempo"
        } else {
          "Tap tempo"
        },
        Icon::Lucide("Pointer"),
        move |_| {
          if a.transport.tapping.get_untracked().to_owned() {
            a.transport.stop_tapping();
          } else {
            a.transport.start_tapping();
          }
        },
      )
      .lit(tap_mode)
    },
  );

  let screen = &mut b.screen;
  screen.title = match &track {
    Some(track) => format!("Tempo · {}", track.name),
    None => "Tempo".into(),
  };
  screen.unsaved = false;
  // The swing in the colours of the knobs that set it: how much in red,
  // what it swings in blue, as the BPM is in green.
  let lead = match &track {
    Some(_) if linked => "Tape's tempo".to_owned(),
    Some(_) => "Own tempo".to_owned(),
    None => timing.meter.label(),
  };
  screen.status = if triplets {
    Rich::text(format!("{lead} · ")).hint("no swing on triplets")
  } else {
    Rich::text(format!("{lead} · Swing "))
      .level(format!("{}%", number(swing.amount)))
      .plain(" on ")
      .value(unit)
  };
  screen.timing = Some(Timing {
    bpm: tempo,
    ..timing
  });
  screen.on_bpm = Some(Callback::new(move |next: f64| set_tempo(next)));
  screen.beat = if tap_mode {
    (tap_count > 0).then(|| (tap_count - 1) % bar_beats)
  } else {
    a.transport.beat()
  };
  screen.badge = Some(if tap_mode {
    ScreenBadge {
      label: "Tap a note".into(),
      on: None,
    }
  } else {
    ScreenBadge {
      label: "Metronome".into(),
      on: Some(a.transport.metronome.value()),
    }
  });
}
