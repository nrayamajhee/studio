//! The synth's params a page at a time, as web-react's `modes/synth.tsx`:
//! an overview of the signal chain, then a page per module (exciter,
//! resonator, filter, body, output, then the envelope and LFO that move
//! them), each a graph of what its knobs do over their readings. The four
//! knobs set the page's params, in the colours the graph draws them in;
//! held Shift, its extras. ← → turn the pages (with Shift, they step the
//! instrument as anywhere else). Save picks an icon to save the sound as a
//! preset. Shift + Delete resets the sound to its instrument's: the picked
//! track's, or the take's, though not over the piano roll or drum grid.

use std::rc::Rc;

use sound_engine::patches::ParamSpec;

use super::base::{DeleteJob, arrow_pads, delete_pad, idle_knob, save_pad};
use super::save::preset_icon_index;
use super::{
  Bindings, Callback, GAP, Knob, KnobBinding, PadSlot, PagerColor, Rich, ScreenPager, ScreenReadout,
};
use crate::logic::params::{format_param, to_unit, value_to_step};
use crate::logic::presets::engine_name;
use crate::logic::synth_graphs::{GraphInput, KNOB_TONES, Tone, graph_note, page_scene};
use crate::logic::synth_pages::{CHAIN_STOPS, KnobSlots, note_name};
use crate::state::App;
use crate::state::keymap::Tool;
use crate::state::lanes::is_take;
use crate::state::sound::steps_of;
use crate::state::view::{BaseView, MainView, ScreenView};

const EMPTY: ScreenReadout = ScreenReadout {
  label: String::new(),
  display: String::new(),
  amount: 0.,
};

/// Whether the reset can run: not over the piano roll or the drum grid.
pub fn resettable(a: &'static App) -> bool {
  !matches!(
    a.views.opened_over.value(),
    BaseView::Main(MainView::Roll | MainView::DrumGrid)
  )
}

pub fn mode(a: &'static App, b: &mut Bindings) {
  let shift = a.shift.shift();
  let focused = a.lanes.focused_lane();
  let track = (!is_take(&focused)).then_some(focused);
  let preset = a.sound.preset();
  let owner = track
    .as_ref()
    .map_or(preset.name.clone(), |track| track.name.clone());
  let pages = a.sound.pages();
  let page_index = a.sound.page_index();
  let page = a.sound.page();
  let values = a.sound.values();
  let patch = a.sound.patch();
  let value_of = |spec: &ParamSpec| values.get(&spec.id).copied().unwrap_or(spec.default);
  let has_shift = page.shift.iter().any(Option::is_some);
  let layer: KnobSlots = if shift && has_shift {
    page.shift
  } else {
    page.main
  };
  let note = graph_note(patch);
  let chain = page.id == "chain";
  let stops: Vec<&'static str> = CHAIN_STOPS
    .iter()
    .copied()
    .filter(|stop| pages.iter().any(|page| page.id == *stop))
    .collect();
  let chain_pick = a.sound.chain_pick();
  let picked_page = pages.iter().find(|page| page.id == chain_pick);

  let readout = |spec: Option<&ParamSpec>| match spec {
    Some(spec) => ScreenReadout {
      label: spec.label.clone(),
      display: format_param(spec, value_of(spec)),
      amount: to_unit(spec, value_of(spec)),
    },
    None => EMPTY,
  };
  let knob = |slot: usize, base: &KnobBinding| -> KnobBinding {
    let Some(spec) = layer[slot] else {
      return idle_knob(base);
    };
    let steps = steps_of(spec);
    KnobBinding {
      label: spec.label.clone(),
      value_label: Some(format_param(spec, value_of(spec))),
      step: value_to_step(spec, value_of(spec), steps) as f64,
      steps,
      on_change: Callback::new(move |step: f64| a.sound.set_param_step(spec, step as usize)),
      fine: false,
    }
  };
  if chain {
    let pick_stops = stops.clone();
    let pick = KnobBinding {
      label: "Block".into(),
      value_label: picked_page.map(|page| page.label.into()),
      step: stops
        .iter()
        .position(|stop| *stop == chain_pick)
        .unwrap_or(0) as f64,
      steps: stops.len().max(2),
      on_change: Callback::new(move |step: f64| {
        a.sound
          .pick_block(pick_stops[(step as usize).min(pick_stops.len() - 1)])
      }),
      fine: false,
    };
    for slot in [Knob::Chalk, Knob::Red, Knob::Blue] {
      b.set_knob(slot, idle_knob(b.knob(slot)));
    }
    b.set_knob(Knob::Green, pick);
  } else {
    for (slot, which) in Knob::ALL.into_iter().enumerate() {
      let binding = knob(slot, b.knob(which));
      b.set_knob(which, binding);
    }
  }

  b.set_pad(
    PadSlot::Tool(Tool::Save),
    save_pad(
      a,
      "Save instrument",
      None,
      Some(Rc::new({
        let icon = preset.icon.clone();
        move || {
          a.browse.icon_index.set(preset_icon_index(&icon));
          a.views.set_view(ScreenView::Save);
        }
      })),
    ),
  );
  let reset = resettable(a).then(|| {
    let owner = owner.clone();
    DeleteJob::new(
      format!("Reset {owner}'s sound"),
      format!(
        "reset:{}",
        track.as_ref().map_or("take", |track| track.id.as_str())
      ),
      format!("Press again to reset {owner}'s sound"),
      move || {
        a.sound.revert_sound();
        a.feedback.show_notice(format!("Reset {owner}'s sound"));
      },
    )
  });
  b.set_pad(PadSlot::Tool(Tool::Delete), delete_pad(a, None, reset));
  if !shift {
    let open = move |index: i64| {
      let count = a.sound.pages().len() as i64;
      a.sound.show_page(index.clamp(0, count - 1) as usize)
    };
    let pick_index = pages
      .iter()
      .position(|page| page.id == chain_pick)
      .map_or(-1, |index| index as i64);
    arrow_pads(
      b,
      a,
      if chain {
        [
          "Previous page".into(),
          format!(
            "Open {}",
            picked_page.map_or("the block", |page| page.label)
          ),
        ]
      } else {
        ["Previous page".into(), "Next page".into()]
      },
      move |direction| {
        if chain && direction > 0 {
          open(pick_index);
        } else {
          open(page_index as i64 + i64::from(direction));
        }
      },
    );
  }

  let extras: Vec<&ParamSpec> = (if shift { page.main } else { page.shift })
    .iter()
    .flatten()
    .copied()
    .collect();
  let hint = if chain {
    format!("green picks{GAP}→ opens")
  } else if has_shift {
    format!(
      "{}{}",
      if shift { "" } else { "⇧ " },
      extras
        .iter()
        .map(|spec| format!("{} {}", spec.label, format_param(spec, value_of(spec))))
        .collect::<Vec<_>>()
        .join(GAP)
    )
  } else {
    String::new()
  };
  let tone_of = |id: &str| {
    let slot = |slots: &KnobSlots| {
      slots
        .iter()
        .position(|spec| spec.is_some_and(|spec| spec.id == id))
    };
    slot(&page.main)
      .or_else(|| slot(&page.shift))
      .map_or(Tone::Dim, |slot| KNOB_TONES[slot])
  };
  let scene = page_scene(
    &page,
    &GraphInput {
      patch,
      values: &values,
      note,
      tone_of: &tone_of,
    },
    &pages,
    chain_pick,
    engine_name(&preset.target),
  );

  let screen = &mut b.screen;
  screen.pager = Some(ScreenPager {
    pages: pages.iter().map(|page| page.label.into()).collect(),
    at: page_index,
    color: PagerColor::Ink,
    on_pick: Callback::new(move |index: usize| a.sound.show_page(index)),
  });
  screen.footer = (Rich::text(note_name(note)), Rich::text(hint));
  screen.readouts = if chain {
    picked_page.map_or(Vec::new(), |page| {
      page.main.iter().map(|spec| readout(*spec)).collect()
    })
  } else {
    layer.iter().map(|spec| readout(*spec)).collect()
  };
  screen.synth_scene = Some(scene);
  screen.synth_label = format!(
    "{}: {} on the {}",
    page.label,
    if chain {
      "the signal chain"
    } else {
      "what its knobs do"
    },
    patch.base().name
  );
}
