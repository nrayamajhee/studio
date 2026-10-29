//! The synth and module views, as web-react's `DeviceScreen` and
//! `SynthGraph` draw them: a graph over four readouts in the colours of the
//! knobs that set them. The synth view's graph is its page's scene; the
//! ADSR's an envelope, the LFO's its wave scrolling at its rate, the FX's a
//! meter per stage, arrows joining drive, chorus and delay, which run in
//! series (the reverb is fed separately by each instrument's send).

use fluid_macro::html;
use web_sys::Element;

use crate::icons::escape;
use crate::logic::js::{number, round, to_fixed};
use crate::logic::synth_graphs::{Align, Anchor, GraphScene, Tone};
use crate::modes::{self, ScreenReadout};
use crate::state::view::ScreenView;
use crate::ui::markup;

/// Module readouts in the colours of the knobs that set them.
const KNOB_COLORS: [&str; 4] = [
  "var(--color-screen-ink)",
  "var(--color-synth-green)",
  "var(--color-synth-red)",
  "var(--color-synth-blue)",
];

/// A graph tone's colour, as CSS.
fn tone_color(tone: Tone) -> &'static str {
  match tone {
    Tone::Ink => "var(--color-screen-ink)",
    Tone::Dim => "color-mix(in srgb, var(--color-screen-ink) 55%, transparent)",
    Tone::Faint => "color-mix(in srgb, var(--color-screen-ink) 18%, transparent)",
    Tone::Green => "var(--color-synth-green)",
    Tone::Red => "var(--color-synth-red)",
    Tone::Blue => "var(--color-synth-blue)",
  }
}

/// What the view draws.
#[derive(Clone, PartialEq)]
struct Look {
  paged: bool,
  readouts: Vec<ScreenReadout>,
  scene: Option<(GraphScene, String)>,
  lfo_shape: usize,
  lfo_rate: f64,
}

/// A Synth page's graph: its lines stretched over the space they're given,
/// keeping their pixel widths, with labels in screen type laid over them.
fn synth_graph(scene: &GraphScene, label: &str) -> Element {
  let mut svg = String::from(
    r#"<svg class="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">"#,
  );
  for path in &scene.paths {
    let color = tone_color(path.tone);
    let style = if path.stroke.fill {
      format!(
        "fill: {color}; fill-opacity: {}; stroke: none;",
        if path.stroke.solid { "1" } else { "0.16" }
      )
    } else {
      format!(
        "fill: none; stroke: {color}; stroke-width: {};",
        number(path.stroke.width.unwrap_or(1.))
      )
    };
    svg += &format!(
      r#"<path d="{}" vector-effect="non-scaling-stroke" stroke-linejoin="round"{} style="{style}"></path>"#,
      path.d,
      if path.stroke.dashed {
        r#" stroke-dasharray="3 3""#
      } else {
        ""
      }
    );
  }
  svg += "</svg>";
  for entry in &scene.labels {
    let shift_x = match entry.align {
      Align::Start => "0",
      Align::Middle => "-50%",
      Align::End => "-100%",
    };
    let shift_y = match entry.anchor {
      Anchor::Top => "0",
      Anchor::Middle => "-50%",
      Anchor::Bottom => "-100%",
    };
    svg += &format!(
      r#"<span class="pointer-events-none absolute font-screen text-[11px] leading-[13px] tracking-[0.02em] whitespace-nowrap" style="left: {}%; top: {}%; color: {}; transform: translate({shift_x}, {shift_y});" aria-hidden="true">{}</span>"#,
      number(entry.x),
      number(entry.y),
      tone_color(entry.tone),
      escape(&entry.text)
    );
  }
  html! {
    div class="relative min-h-0 w-full flex-1" role="img" aria-label={ label } {
      { markup(&svg) }
    }
  }
}

/// Drawn across a fixed 100 × 40 box: attack, decay and release widen with
/// their knobs, sustain fills the rest at its level, and decay and release
/// curve like the engine's exponential segments. A zero attack rises
/// straight up; decay and release never reach zero, so they always curve.
/// Both ends sit inside the box so their strokes aren't clipped.
fn envelope_graph(stages: &[ScreenReadout]) -> Element {
  let [attack, decay, sustain, release] = [0, 1, 2, 3].map(|i| stages[i].amount);
  let top = 2.;
  let bottom = 38.;
  let level = bottom - (bottom - top) * sustain;
  let x0 = 2.;
  let x1 = x0 + 23. * attack;
  let x2 = x1 + 2. + 23. * decay;
  let x4 = 98.;
  let x3 = x4 - (2. + 28. * release);
  let n = number;
  let decay_path = format!("Q{} {} {} {}", n(x1), n(level), n(x2), n(level));
  let release_path = format!("Q{} {} {} {}", n(x3), n(bottom), n(x4), n(bottom));
  let segments = [
    format!("M{} {} L{} {}", n(x0), n(bottom), n(x1), n(top)),
    format!("M{} {} {decay_path}", n(x1), n(top)),
    format!("M{} {} L{} {}", n(x2), n(level), n(x3), n(level)),
    format!("M{} {} {release_path}", n(x3), n(level)),
  ];
  let mut svg = format!(
    r#"<svg class="min-h-0 w-full flex-1 overflow-hidden" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M{} {} L{} {} {decay_path} L{} {} {release_path} Z" style="fill: color-mix(in srgb, var(--color-screen-ink) 8%, transparent);"></path>"#,
    n(x0),
    n(bottom),
    n(x1),
    n(top),
    n(x3),
    n(level)
  );
  for (d, color) in segments.iter().zip(KNOB_COLORS) {
    svg += &format!(
      r#"<path d="{d}" fill="none" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke" style="stroke: {color};"></path>"#
    );
  }
  svg += "</svg>";
  let fragment = markup(&svg);
  fragment.first_element_child().expect("the envelope's svg")
}

/// How wide (px) an LFO cycle draws.
const LFO_CYCLE: f64 = 50.;
/// The random LFO's steps, as the scrolling wave draws them.
const RANDOM_STEPS: [f64; 6] = [0.6, -0.35, 0.9, -0.8, 0.15, -0.55];

/// The LFO's wave at `x` for `shape`: sine, triangle, square, saw or random.
fn lfo_value(shape: usize, x: f64) -> f64 {
  let phase = (x / LFO_CYCLE) % 1.;
  match shape {
    0 => (2. * std::f64::consts::PI * phase).sin(),
    1 => 1. - 4. * (phase - 0.5).abs(),
    2 => {
      if phase < 0.5 {
        1.
      } else {
        -1.
      }
    }
    3 => 2. * phase - 1.,
    _ => RANDOM_STEPS[(x / LFO_CYCLE).floor() as usize % RANDOM_STEPS.len()],
  }
}

/// Two cycles of the LFO's shape across a 100 × 40 box, as tall as its
/// depth, scrolling one cycle per LFO period (no faster than 10 Hz on
/// screen).
fn lfo_graph(shape: usize, depth: f64, rate: f64) -> Element {
  let height = 17. * depth.max(0.08);
  let points: Vec<String> = (0..=300)
    .map(|i| {
      let x = i as f64 * 0.5;
      format!(
        "{} {}",
        number(x),
        to_fixed(20. - height * lfo_value(shape, x), 2)
      )
    })
    .collect();
  let svg = format!(
    r#"<svg class="min-h-0 w-full flex-1 overflow-hidden" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 20 H100" stroke-dasharray="2 3" vector-effect="non-scaling-stroke" style="stroke: color-mix(in srgb, var(--color-screen-ink) 15%, transparent);"></path><path class="animate-[lfo-scroll_var(--lfo-period)_linear_infinite] motion-reduce:animate-none" d="M{}" fill="none" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="--lfo-period: {}s; stroke: {};"></path></svg>"#,
    points.join(" L"),
    number((1. / rate).max(0.1)),
    KNOB_COLORS[1]
  );
  markup(&svg).first_element_child().expect("the LFO's svg")
}

/// The FX stages left to right, each level as a bar in its knob colour.
fn fx_meters(stages: &[ScreenReadout]) -> Element {
  let columns: Vec<Element> = stages
    .iter()
    .enumerate()
    .map(|(i, stage)| {
      let class = if i < 2 {
        "relative flex justify-center after:absolute after:top-1/2 after:-right-[14px] after:-translate-y-1/2 after:font-screen after:text-[12px] after:text-screen-ink/30 after:content-['→']"
      } else {
        "relative flex justify-center"
      };
      html! {
        div class={ class } {
          div class="relative h-full w-[56px] overflow-hidden rounded-[6px] bg-screen-ink/8" {
            div
            class="absolute inset-x-0 bottom-0 rounded-[6px]"
            style={ format!("height: {}%; background: {};", number(round(stage.amount * 100.)), KNOB_COLORS[i]) }
            {}
          }
        }
      }
    })
    .collect();
  html! {
    div class="grid min-h-0 flex-1 grid-cols-4 gap-[18px]" aria-hidden="true" { { columns } }
  }
}

/// The four readouts under a module's graph, each knob's in its colour.
fn stages(readouts: &[ScreenReadout]) -> Element {
  let columns: Vec<Element> = readouts
    .iter()
    .enumerate()
    .map(|(i, stage)| {
      if stage.label.is_empty() {
        html! {
          span class="flex flex-col items-center whitespace-nowrap" aria-hidden="true" {
            span class="tracking-[0.02em] text-screen-ink/55 first-letter:uppercase" { "\u{a0}" }
            span class="font-semibold text-screen-ink/25" { "—" }
          }
        }
      } else {
        html! {
          span class="flex flex-col items-center whitespace-nowrap" {
            span class="tracking-[0.02em] text-screen-ink/55 first-letter:uppercase" { { stage.label.clone() } }
            span class="font-semibold" style={ format!("color: {};", KNOB_COLORS[i]) } { { stage.display.clone() } }
          }
        }
      }
    })
    .collect();
  html! {
    div class="grid grid-cols-4 gap-[18px] font-screen text-[14px] leading-[18px]" { { columns } }
  }
}

/// What a module view draws: the synth's graph, or the ADSR's envelope, the
/// LFO's scrolling wave or the FX chain, over the readouts.
fn draw(view: ScreenView, look: Look) -> Option<Element> {
  let graph = match view {
    ScreenView::Synth => {
      let (scene, label) = look.scene.as_ref()?;
      synth_graph(scene, label)
    }
    _ if look.readouts.len() != 4 => return None,
    ScreenView::Adsr => envelope_graph(&look.readouts),
    ScreenView::Lfo => lfo_graph(look.lfo_shape, look.readouts[1].amount, look.lfo_rate),
    _ => fx_meters(&look.readouts),
  };
  let class = format!(
    "absolute right-[20px] bottom-[30px] left-[20px] m-0 flex flex-col gap-[6px] {}",
    if look.paged {
      "top-[42px]"
    } else {
      "top-[30px]"
    }
  );
  Some(html! {
    div class={ class } {
      { graph }
      { stages(&look.readouts) }
    }
  })
}

/// The synth, ADSR, LFO or FX view.
pub fn module(view: ScreenView) -> Element {
  let look = fluid::create_memo(move || {
    modes::with(|bindings| {
      let screen = &bindings.screen;
      Look {
        paged: screen.pager.is_some(),
        readouts: screen.readouts.clone(),
        scene: screen
          .synth_scene
          .clone()
          .map(|scene| (scene, screen.synth_label.clone())),
        lfo_shape: screen.lfo_shape,
        lfo_rate: screen.lfo_rate,
      }
    })
  });
  let body = fluid::show(move || look.cloned(), move |look| draw(view, look));
  html! { div class="contents" { { body } } }
}
