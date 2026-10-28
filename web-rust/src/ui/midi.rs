//! The MIDI panel, as web-react's `MidiPanel`: a dark see-through panel
//! over the page, as the debug overlay is, setting up MIDI. It turns MIDI
//! on, picks the input and channel the keys play from, their octave,
//! velocity, sustain pedal and drums, and maps a controller's knobs and
//! pads to the Device's, by clicking one and moving the control. The Device
//! still plays under it, so a mapping can be tried at once.

use fluid_macro::html;
use web_sys::{Element, Event, HtmlSelectElement};

use super::{icon, markup};
use crate::chrome::chrome;
use crate::icons::{Icon, X};
use crate::midi::{
  MIDI_KNOBS, MIDI_PADS, MidiConnection, MidiSettings, MidiStatus, MidiTarget, OCTAVE_RANGE, midi,
  target_name,
};
use crate::modes::Knob;

const BASE: &str = "fixed inset-x-3 top-20 z-60 mx-auto flex max-h-[calc(100dvh-12rem)] max-w-[76rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/65 text-white/80 shadow-high backdrop-blur-xl [color-scheme:dark] sm:inset-x-8 sm:max-h-[calc(100dvh-10rem)]";
const HEADER: &str =
  "flex min-w-0 items-center gap-3 border-b border-white/10 py-2 pr-2 pl-4 text-sm";
const BODY: &str =
  "min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:overflow-hidden";
const SETTINGS: &str =
  "flex flex-col gap-5 border-b border-white/10 p-4 md:overflow-y-auto md:border-r md:border-b-0";
const MAPPING: &str = "flex min-w-0 flex-col gap-3 p-4 md:overflow-y-auto";
const HEADING: &str = "font-mono text-[11px] tracking-wider text-white/45 uppercase";
const ROW: &str = "flex min-h-7 items-center justify-between gap-3 text-xs";
const NOTE: &str = "text-xs leading-relaxed text-white/55";
const CHOICE: &str =
  "flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs";
const SMALL: &str = "rounded-md px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white";
const CELL: &str = "flex min-h-12 flex-col items-start justify-between gap-1 rounded-lg border px-1.5 py-1 text-left hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40";
/// web-react's ghost Button at its small size, an icon alone.
const CLOSE: &str = "relative inline-flex items-center font-medium border-2 transition-colors duration-150 ease-in-out cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none bg-transparent border-transparent focus-visible:ring-primary text-xs rounded-lg gap-2 w-auto justify-center text-center hover:bg-primary/10 active:bg-primary/20 p-2 aspect-square text-white/60 hover:text-white";

fn status_name(status: MidiStatus) -> &'static str {
  match status {
    MidiStatus::Unsupported => "Not in this browser",
    MidiStatus::Off => "Off",
    MidiStatus::Asking => "Asking the browser…",
    MidiStatus::Blocked => "Blocked by the browser",
    MidiStatus::On => "On",
  }
}

fn help(status: MidiStatus) -> Option<&'static str> {
  Some(match status {
    MidiStatus::Unsupported => {
      "This browser has no Web MIDI. Chrome, Edge and Firefox have it; Safari doesn't."
    }
    MidiStatus::Off => {
      "Turn MIDI on and a controller plays the Device: its keys play the keybed, and the knobs and pads mapped here turn and press the Device's own. The browser asks first."
    }
    MidiStatus::Asking => "Allow MIDI in the browser's prompt.",
    MidiStatus::Blocked => {
      "Allow MIDI for this site in the browser's site settings, then turn it on again."
    }
    MidiStatus::On => return None,
  })
}

/// A lucide icon from the exported set, with classes of its own.
fn lucide(name: &'static str, class: &str) -> web_sys::DocumentFragment {
  markup(
    &Icon::Lucide(name)
      .markup()
      .replacen(r#"class=""#, &format!(r#"class="{class} "#), 1),
  )
}

/// A switch, kept as it flips so its colour and thumb ease across.
fn toggle(
  on: impl Fn() -> bool + Clone + 'static,
  label: &str,
  disabled: impl Fn() -> bool + 'static,
  change: impl Fn(bool) + 'static,
) -> Element {
  let (track_on, thumb_on, flip) = (on.clone(), on.clone(), on.clone());
  html! {
    button
    type="button"
    role="switch"
    aria-checked={ move || on().to_string() }
    aria-label={ label }
    disabled={ move || disabled() }
    class={ move || if track_on() {
      "inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-emerald-500 transition-colors disabled:opacity-40"
    } else {
      "inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-white/15 transition-colors disabled:opacity-40"
    } }
    @click={ move |_| change(!flip()) }
    {
      span class={ move || if thumb_on() {
        "size-4 translate-x-4.5 rounded-full bg-white shadow-low transition-transform"
      } else {
        "size-4 translate-x-0.5 rounded-full bg-white shadow-low transition-transform"
      } } {}
    }
  }
}

fn setting(label: &str, control: Element) -> Element {
  html! {
    div class={ ROW } {
      span { { label.to_owned() } }
      { control }
    }
  }
}

fn small(label: &str, disabled: bool, press: impl Fn() + 'static) -> Element {
  html! {
    button type="button" class={ SMALL } disabled={ disabled } @click={ move |_| press() } {
      span { { label.to_owned() } }
    }
  }
}

fn inputs((connection, settings): (MidiConnection, MidiSettings)) -> Element {
  if let Some(help) = help(connection.status) {
    return html! { p class={ NOTE } { { help } } };
  }
  let names: Vec<&str> = connection
    .ports
    .iter()
    .map(|port| port.name.as_str())
    .collect();
  let missing = settings
    .input
    .clone()
    .filter(|input| !names.contains(&input.as_str()));
  let choice = |input: Option<String>, label: String, detail: Option<String>| {
    let picked = settings.input == input;
    let class = if picked {
      format!("{CHOICE} bg-white/10 text-white hover:bg-white/10")
    } else {
      format!("{CHOICE} hover:bg-white/5")
    };
    let detail = detail.map(|detail| html! { span class="shrink-0 text-white/40" { { detail } } });
    html! {
      button
      type="button"
      role="radio"
      aria-checked={ picked.to_string() }
      class={ class }
      @click={ move |_| {
        let input = input.clone();
        midi().set_settings(move |settings| settings.input = input)
      } }
      {
        span class="min-w-0 flex-1 truncate" { { label } }
        { detail }
      }
    }
  };
  let mut choices = vec![choice(
    None,
    "Every input".into(),
    connection
      .ports
      .is_empty()
      .then(|| "none plugged in".into()),
  )];
  for port in &connection.ports {
    choices.push(choice(
      Some(port.name.clone()),
      port.name.clone(),
      (!port.manufacturer.is_empty()).then(|| port.manufacturer.clone()),
    ));
  }
  if let Some(missing) = missing {
    choices.push(choice(
      Some(missing.clone()),
      missing,
      Some("not plugged in".into()),
    ));
  }
  html! {
    div role="radiogroup" aria-label="Input" class="-mx-2 flex flex-col" { { choices } }
  }
}

fn keys() -> Element {
  let settings = midi().settings.clone();
  let options: Vec<Element> = std::iter::once(("".to_owned(), "Any".to_owned()))
    .chain((1..=16).map(|channel: u8| (channel.to_string(), channel.to_string())))
    .map(|(value, label)| html! { option value={ value } { { label } } })
    .collect();
  let channel = html! {
    select
    aria-label="Channel the keys play from"
    class="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
    @change={ |event: Event| {
      let value = event
        .current_target()
        .and_then(|target| wasm_bindgen::JsCast::dyn_into::<HtmlSelectElement>(target).ok())
        .map(|select| select.value())
        .unwrap_or_default();
      midi().set_settings(move |settings| settings.channel = value.parse().ok());
    } }
    { { options } }
  };
  if let Some(select) = wasm_bindgen::JsCast::dyn_ref::<HtmlSelectElement>(&channel).cloned() {
    let settings = settings.clone();
    fluid::create_effect(move || {
      select.set_value(&settings.with(|settings| {
        settings
          .channel
          .map_or(String::new(), |channel| channel.to_string())
      }));
    });
  }
  let octave = {
    let settings = settings.clone();
    move || settings.with(|settings| settings.octave)
  };
  let step = {
    let octave = octave.clone();
    move |by: i32| {
      let to = octave() + by;
      midi().set_settings(move |settings| settings.octave = to)
    }
  };
  let (low, high, shown) = (octave.clone(), octave.clone(), octave);
  let down = step.clone();
  let octaves = html! {
    span class="flex items-center gap-1" {
      button
      type="button"
      aria-label="Octave down"
      class={ SMALL }
      disabled={ move || low() <= -OCTAVE_RANGE }
      @click={ move |_| down(-1) }
      { { lucide("Minus", "size-3.5") } }
      span class="w-6 text-center font-mono" {
        { move || {
          let octave = shown();
          if octave > 0 { format!("+{octave}") } else { octave.to_string() }
        } }
      }
      button
      type="button"
      aria-label="Octave up"
      class={ SMALL }
      disabled={ move || high() >= OCTAVE_RANGE }
      @click={ move |_| step(1) }
      { { lucide("Plus", "size-3.5") } }
    }
  };
  let velocities: Vec<Element> = [(false, "As played"), (true, "Fixed")]
    .into_iter()
    .map(|(fixed, label)| {
      let (checked, class) = (settings.clone(), settings.clone());
      html! {
        button
        type="button"
        role="radio"
        aria-checked={ move || checked.with(|settings| settings.fixed_velocity == fixed).to_string() }
        class={ move || if class.with(|settings| settings.fixed_velocity == fixed) {
          "rounded-md px-2 py-1 text-xs hover:bg-white/10 hover:text-white bg-white/15 text-white"
        } else {
          SMALL
        } }
        @click={ move |_| midi().set_settings(move |settings| settings.fixed_velocity = fixed) }
        { span { { label } } }
      }
    })
    .collect();
  let velocity = html! {
    span role="radiogroup" aria-label="Velocity" class="flex rounded-lg bg-white/5 p-0.5" { { velocities } }
  };
  let (sustain, drums) = (settings.clone(), settings);
  html! {
    div class="flex flex-col gap-1" {
      { setting("Channel", channel) }
      { setting("Octave", octaves) }
      { setting("Velocity", velocity) }
      { setting("Sustain pedal", toggle(move || sustain.with(|settings| settings.sustain), "Sustain pedal (CC 64) holds notes", || false, |on| {
        midi().set_settings(move |settings| settings.sustain = on)
      })) }
      { setting("Drums on channel 10", toggle(move || drums.with(|settings| settings.drums), "Channel 10 plays a kit by its General MIDI drum keys", || false, |on| {
        midi().set_settings(move |settings| settings.drums = on)
      })) }
    }
  }
}

fn monitor() -> Element {
  let body = fluid::show(
    || midi().log.cloned(),
    |log| {
      if log.is_empty() {
        return html! { p class={ NOTE } { "Play something on the controller." } };
      }
      let entries: Vec<Element> = log
        .into_iter()
        .map(|entry| {
          let use_class = if entry.use_.starts_with("Not") {
            "truncate text-white/35"
          } else {
            "truncate text-sky-300"
          };
          html! {
            li class="grid grid-cols-[3rem_10rem_minmax(0,1fr)_auto] gap-3" {
              span class="text-white/40" { { format!("ch {}", entry.channel) } }
              span class="truncate" { { entry.message } }
              span class={ use_class } { { entry.use_ } }
              span class="max-w-48 truncate text-white/35" { { entry.port } }
            }
          }
        })
        .collect();
      html! { ol class="flex flex-col gap-1 font-mono text-[11px]" { { entries } } }
    },
  );
  html! {
    section class="mt-3 flex flex-col gap-2" {
      h3 class={ HEADING } { "Monitor" }
      { body }
    }
  }
}

fn mapping((connection, settings): (MidiConnection, MidiSettings)) -> web_sys::DocumentFragment {
  let learning = connection.learning;
  let on = connection.status == MidiStatus::On;
  let source_of = |target: MidiTarget| {
    settings
      .mappings
      .iter()
      .find(|mapping| mapping.target == target)
      .map(|mapping| mapping.source)
  };
  let learnt = learning.and_then(source_of);
  let cell = |target: MidiTarget, name: &str, swatch: Option<&str>| {
    let source = source_of(target);
    let waiting = learning == Some(target);
    let (class, source_class) = match (waiting, source.is_some()) {
      (true, _) => (
        format!("{CELL} border-sky-400 bg-sky-400/15 text-white"),
        "font-mono text-[10px] animate-pulse text-sky-300",
      ),
      (false, true) => (
        format!("{CELL} border-transparent bg-white/10 text-white"),
        "font-mono text-[10px] text-sky-300",
      ),
      (false, false) => (
        format!("{CELL} border-transparent bg-white/[0.03] text-white/60"),
        "font-mono text-[10px] text-white/40",
      ),
    };
    let swatch = swatch.map(|swatch| {
      html! { span class={ format!("size-2.5 shrink-0 rounded-full {swatch}") } {} }
    });
    let reading = if waiting {
      "Waiting…".to_owned()
    } else {
      source.map_or("—".to_owned(), |source| source.name())
    };
    html! {
      button
      type="button"
      aria-pressed={ waiting.to_string() }
      aria-label={ format!("{name}: {}", source.map_or("not mapped".to_owned(), |source| source.name())) }
      title={ source.map(|source| format!("{} on channel {}", source.name(), source.channel)) }
      disabled={ !on }
      class={ class }
      @click={ move |_| midi().learn(Some(target)) }
      {
        span class="flex items-center gap-1.5 text-[11px] leading-tight" {
          { swatch }
          { name.to_owned() }
        }
        span class={ source_class } { { reading } }
      }
    }
  };
  let status: Vec<Element> = match learning {
    Some(target) => {
      let mut parts = vec![html! {
        span class="text-white" {
          { format!("Turn a knob or press a pad on the controller for {}.", target_name(target)) }
        }
      }];
      if let Some(learnt) = learnt {
        parts.push(small(
          &format!("Forget {}", learnt.name()),
          false,
          move || {
            midi().forget(Some(target));
            midi().learn(None);
          },
        ));
      }
      parts.push(small("Cancel", false, || midi().learn(None)));
      parts
    }
    None => vec![html! {
      span class="text-white/55" {
        "Click a knob or pad, then move a control on the controller to map it. A mapped key presses its pad instead of playing a note."
      }
    }],
  };
  let knobs: Vec<Element> = MIDI_KNOBS
    .iter()
    .map(|&(knob, name)| {
      let swatch = match knob {
        Knob::Chalk => "bg-synth-chalk",
        Knob::Green => "bg-synth-green",
        Knob::Red => "bg-synth-red",
        Knob::Blue => "bg-synth-blue",
      };
      cell(MidiTarget::Knob(knob), name, Some(swatch))
    })
    .collect();
  let pads: Vec<Element> = MIDI_PADS
    .iter()
    .flatten()
    .map(|&(control, name)| cell(MidiTarget::Pad(control), name, None))
    .collect();
  let fragment = gloo_utils::document().create_document_fragment();
  let parts = [
    html! {
      div class="flex items-center justify-between gap-3" {
        h3 class={ HEADING } { "Mapping" }
        { small("Forget all", settings.mappings.is_empty(), || midi().forget(None)) }
      }
    },
    html! {
      div role="status" class="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 text-xs" { { status } }
    },
    html! {
      div class="overflow-x-auto pb-1" {
        div class="flex min-w-[54rem] flex-col gap-3" {
          div class="grid grid-cols-4 gap-1" { { knobs } }
          div role="group" aria-label="Pads" class="grid grid-cols-[repeat(12,minmax(4.25rem,1fr))] gap-1" { { pads } }
        }
      }
    },
  ];
  for part in parts {
    let _ = fragment.append_child(&part);
  }
  fragment
}

pub fn panel() -> Element {
  let m = midi();
  // Closing stops waiting for a control to map.
  fluid::on_cleanup(|| midi().learn(None));
  let both = move || (m.connection.cloned(), m.settings.cloned());
  let summary = fluid::show(
    move || m.connection.cloned(),
    |connection| {
      let summary = if connection.status == MidiStatus::On {
        match connection.ports.len() {
          0 => "No controller plugged in".to_owned(),
          1 => "1 input".to_owned(),
          n => format!("{n} inputs"),
        }
      } else {
        status_name(connection.status).to_owned()
      };
      html! { span class="min-w-0 flex-1 truncate text-xs text-white/50" { { summary } } }
    },
  );
  let status = move || m.connection.with(|connection| connection.status);
  let switch = toggle(
    move || matches!(status(), MidiStatus::On | MidiStatus::Asking),
    "MIDI input",
    move || matches!(status(), MidiStatus::Unsupported | MidiStatus::Asking),
    |on| midi().set_enabled(on),
  );
  let monitored = fluid::show(
    move || {
      m.connection
        .with(|connection| connection.status == MidiStatus::On)
    },
    |on| on.then(monitor),
  );
  html! {
    aside aria-label="MIDI" class={ BASE } {
      div class={ HEADER } {
        span class="font-medium text-white" { "MIDI" }
        { summary }
        { switch }
        button
        type="button"
        aria-label="Close MIDI"
        class={ CLOSE }
        @click={ |_| chrome().set_midi(false) }
        {
          span class="flex-shrink-0 inline-flex items-center justify-center" { { icon(X, "size-4") } }
        }
      }
      div class={ BODY } {
        div class={ SETTINGS } {
          section class="flex flex-col gap-2" {
            h3 class={ HEADING } { "Input" }
            { fluid::show(both, inputs) }
          }
          section class="flex flex-col gap-2" {
            h3 class={ HEADING } { "Keys" }
            { keys() }
          }
        }
        div class={ MAPPING } {
          { fluid::show(both, mapping) }
          { monitored }
        }
      }
    }
  }
}
