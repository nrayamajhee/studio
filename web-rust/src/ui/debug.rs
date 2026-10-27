//! The Debug panel, as web-react's DebugOverlay: a dark see-through panel
//! over the page with the app's state, its parts down the side and the
//! picked one as pretty-printed JSON. web-react keeps all of its state in
//! `localStorage`; web-rust keeps the Device and the engine in memory, so
//! those two show live, the engine's how it started (or why it didn't), its
//! voices, load and warnings. A part's dot flashes when it changes, and the
//! keys still play the Device under it. ⌘D (Ctrl D) opens and closes it.

use std::cell::RefCell;
use std::rc::Rc;

use fluid::Signal;
use fluid_macro::html;
use gloo_timers::callback::{Interval, Timeout};
use gloo_utils::window;
use serde_json::{Value, json};
use sound_engine::host::Phase;
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::Element;

use super::{icon, is_mac};
use crate::device::{Device, device};
use crate::docs::store::{DOCS_COLLAPSED_KEY, collapsed};
use crate::icons::{CHECK, COPY, X};
use crate::notes::note_name;
use crate::pads::CHORDS;
use crate::presets::PRESETS;

pub const TOGGLE_CODE: &str = "KeyD";

const PARTS: [&str; 4] = [
  "studio.device",
  "studio.engine",
  DOCS_COLLAPSED_KEY,
  "theme",
];
/// How often the engine's part refreshes while the panel is open.
const ENGINE_MS: u32 = 250;

const BASE: &str = "fixed inset-x-3 top-20 bottom-28 z-60 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/65 text-white/80 shadow-high backdrop-blur-xl sm:inset-x-8 sm:bottom-20 sm:grid sm:grid-cols-[16rem_minmax(0,1fr)] sm:grid-rows-[auto_minmax(0,1fr)]";
const HEADER: &str = "flex min-w-0 items-center gap-3 border-b border-white/10 py-2 pr-2 pl-4 text-sm sm:col-start-2 sm:row-start-1";
const SIDEBAR: &str = "flex max-h-48 shrink-0 flex-col gap-0.5 overflow-y-auto border-b border-white/10 p-2 sm:col-start-1 sm:row-span-2 sm:row-start-1 sm:max-h-none sm:border-r sm:border-b-0";
const ITEM: &str =
  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono text-xs";
const WRITTEN: &str =
  "ml-auto size-1.5 shrink-0 animate-[fade-out_2s_ease-in_forwards] rounded-full bg-emerald-400";
const CODE: &str = "min-h-0 min-w-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre text-white/80 sm:col-start-2 sm:row-start-2";
/// web-react's ghost Button at its small size.
const GHOST: &str = "relative inline-flex items-center font-medium border-2 transition-colors duration-150 ease-in-out cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none bg-transparent border-transparent focus-visible:ring-primary px-3.5 py-2 text-xs rounded-lg gap-2 w-auto justify-center text-center hover:bg-primary/10 active:bg-primary/20 text-white/60 hover:text-white";
const GHOST_ICON: &str = "flex-shrink-0 inline-flex items-center justify-center";
const GHOST_LABEL: &str = "text-base transition-colors font-semibold leading-snug tracking-tight text-inherit dark:text-inherit truncate !text-xs";

/// ⌘ on a Mac, Ctrl elsewhere.
fn command() -> &'static str {
  if is_mac() { "⌘" } else { "Ctrl " }
}

pub fn overlay() -> Element {
  let device = device();
  let picked = Rc::new(Signal::new(PARTS[0]));
  // The engine isn't signals; while the panel is open it's read again.
  let tick = Rc::new(Signal::new(0u32));
  let interval = Interval::new(ENGINE_MS, {
    let tick = tick.clone();
    move || tick.update(|tick| *tick += 1)
  });
  fluid::on_cleanup(move || drop(interval));
  let part = move |key: &str| -> Value {
    match key {
      "studio.device" => device_state(device),
      "studio.engine" => engine_state(device),
      DOCS_COLLAPSED_KEY => json!(collapsed().cloned()),
      _ => json!(device.theme.value().name()),
    }
  };
  // How many times each part changed while the panel showed it.
  let changes: Rc<Vec<Rc<Signal<u32>>>> =
    Rc::new(PARTS.iter().map(|_| Rc::new(Signal::new(0))).collect());
  let last: RefCell<Vec<Option<String>>> = RefCell::new(vec![None; PARTS.len()]);
  fluid::create_effect({
    let (tick, changes) = (tick.clone(), changes.clone());
    move || {
      tick.value();
      let mut last = last.borrow_mut();
      for (i, key) in PARTS.iter().enumerate() {
        let now = part(key).to_string();
        if last[i].as_ref().is_some_and(|before| *before != now) {
          fluid::untrack(|| changes[i].update(|n| *n += 1));
        }
        last[i] = Some(now);
      }
    }
  });
  let copied: Rc<Signal<Option<bool>>> = Rc::new(Signal::new(None));
  let copy_all = {
    let copied = copied.clone();
    move |_| {
      let all: Vec<Value> = PARTS
        .iter()
        .map(|key| json!({ "key": key, "value": part(key) }))
        .collect();
      let json = serde_json::to_string_pretty(&all).unwrap_or_default();
      let copied = copied.clone();
      spawn_local(async move {
        // No clipboard outside a secure page.
        let clipboard = js_sys::Reflect::get(&window().navigator(), &"clipboard".into())
          .ok()
          .filter(|clipboard| !clipboard.is_undefined());
        let done = match clipboard {
          Some(_) => JsFuture::from(window().navigator().clipboard().write_text(&json))
            .await
            .is_ok(),
          None => false,
        };
        copied.set(Some(done));
        Timeout::new(1500, move || copied.set(None)).forget();
      });
    }
  };
  let close = format!("Close ({}D)", command());
  let copy_title = {
    let copied = copied.clone();
    move || match copied.value() {
      Some(true) => "Copied",
      Some(false) => "Couldn't copy",
      None => "Copy all",
    }
  };
  let copy_label = copy_title.clone();
  html! {
    aside aria-label="Saved state" class={ BASE } {
      div class={ HEADER } {
        span class="min-w-0 flex-1 truncate font-mono text-white" { #text{ |picked| picked.value() } }
        button
        title={ move || copy_title() }
        aria-label="Copy every key's state as one JSON array"
        class={ GHOST }
        @click={ copy_all }
        {
          span class={ GHOST_ICON } {
            if |copied| copied.value() == Some(true) { { icon(CHECK, "size-4") } } else { { icon(COPY, "size-4") } }
          }
          span class="flex flex-col min-w-0 items-center" {
            span class={ GHOST_LABEL } {
              #text{ |copy_label| copy_label() }
            }
          }
        }
        button title={ close.clone() } aria-label={ format!("Close the saved state ({}D)", command()) } class={ GHOST } @click={ move |_| device.debug.set(false) } {
          span class={ GHOST_ICON } { { icon(X, "size-4") } }
          span class="flex flex-col min-w-0 items-center" { span class={ GHOST_LABEL } { { close } } }
        }
      }
      nav class={ SIDEBAR } {
        { PARTS.iter().enumerate().map(|(i, &key)| item(key, picked.clone(), changes[i].clone())).collect::<Vec<_>>() }
      }
      pre class={ CODE } {
        #html{ |picked, tick| { tick.value(); highlight(&serde_json::to_string_pretty(&part(picked.value())).unwrap_or_default()) } }
      }
    }
  }
}

/// A part in the sidebar, with a dot that flashes each time it changes.
fn item(key: &'static str, picked: Rc<Signal<&'static str>>, changes: Rc<Signal<u32>>) -> Element {
  html! {
    button
    class={ ITEM }
    class:"bg-white/10 text-white hover:bg-white/10"=#{ |picked| picked.value() == key }
    class:"hover:bg-white/5"=#{ |picked| picked.value() != key }
    @click={ move |_| picked.set(key) }
    {
      span class="min-w-0 truncate" { { key } }
      // A new dot for each change, so its fade starts over.
      { move || (changes.value() > 0).then(|| html! { span class={ WRITTEN } {} }) }
    }
  }
}

fn device_state(device: &Device) -> Value {
  let preset = device.current();
  let (param, step) = device.param();
  let edits: serde_json::Map<String, Value> = device.values.with(|values| {
    PRESETS
      .iter()
      .zip(values)
      .filter_map(|(preset, steps)| {
        let changed: serde_json::Map<String, Value> = preset
          .params
          .iter()
          .zip(steps)
          .filter(|(param, step)| param.step != **step)
          .map(|(param, &step)| (param.id.to_owned(), json!(param.sends[step])))
          .collect();
        (!changed.is_empty()).then(|| (preset.name.to_owned(), Value::Object(changed)))
      })
      .collect()
  });
  let held: Vec<String> = device.held.with(|held| {
    held
      .values()
      .flatten()
      .map(|&(_, midi)| note_name(midi))
      .collect()
  });
  json!({
    "preset": preset.name,
    "instrument": preset.target,
    "octave": device.octave.value(),
    "volume": device.volume.value() * 10,
    "level": device.level.value() * 10,
    "parameter": { "name": param.name, "id": param.id, "value": param.sends[step], "shows": param.values[step] },
    "chord": device.active_chord.value().map(|chord| CHORDS[chord].name),
    "shift": device.shift(),
    "held": held,
    "edits": edits,
  })
}

fn engine_state(device: &Device) -> Value {
  let status = device.sound.status();
  let (phase, error) = match &status.phase {
    Phase::Off => ("off: waiting for a key, click or tap", None),
    Phase::Starting => ("starting", None),
    Phase::Ready => ("ready", None),
    Phase::Failed(reason) => ("failed", Some(reason.clone())),
  };
  json!({
    "phase": phase,
    "error": error,
    "context": status.context,
    "sampleRate": status.sample_rate.map(|rate| rate as u32),
    "activeVoices": status.stats.map(|stats| stats.active_voices),
    "reverbAwake": status.stats.map(|stats| stats.reverb_awake),
    "load": status.load,
    "pending": status.pending,
    "warnings": status.warnings,
  })
}

/// Pretty-printed JSON as HTML, its keys, strings, numbers and literals
/// coloured as web-react's are.
fn highlight(json: &str) -> String {
  let mut out = String::new();
  let chars: Vec<char> = json.chars().collect();
  let mut i = 0;
  let span = |out: &mut String, tone: &str, token: &str| {
    out.push_str(&format!(r#"<span class="{tone}">{}</span>"#, escape(token)));
  };
  while i < chars.len() {
    let c = chars[i];
    if c == '"' {
      let start = i;
      i += 1;
      while i < chars.len() && chars[i] != '"' {
        i += if chars[i] == '\\' { 2 } else { 1 };
      }
      i = (i + 1).min(chars.len());
      let token: String = chars[start..i].iter().collect();
      let mut j = i;
      while j < chars.len() && chars[j].is_whitespace() {
        j += 1;
      }
      if chars.get(j) == Some(&':') {
        span(&mut out, "text-sky-300", &token);
        out.extend(&chars[i..=j]);
        i = j + 1;
      } else {
        span(&mut out, "text-emerald-300", &token);
      }
    } else if c == '-' || c.is_ascii_digit() {
      let start = i;
      i += 1;
      while i < chars.len()
        && (chars[i].is_ascii_digit() || matches!(chars[i], '.' | 'e' | 'E' | '+' | '-'))
      {
        i += 1;
      }
      span(
        &mut out,
        "text-amber-300",
        &chars[start..i].iter().collect::<String>(),
      );
    } else if let Some(word) = ["true", "false", "null"]
      .into_iter()
      .find(|word| chars[i..].starts_with(&word.chars().collect::<Vec<_>>()))
    {
      span(&mut out, "text-violet-300", word);
      i += word.len();
    } else {
      out.push_str(&escape(&c.to_string()));
      i += 1;
    }
  }
  out
}

fn escape(text: &str) -> String {
  text
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
}

#[cfg(test)]
mod tests {
  use super::highlight;

  #[test]
  fn colours_json() {
    let html = highlight("{\n  \"a\": [1, -2.5e3, true, null, \"b<\"]\n}");
    assert_eq!(
      html,
      "{\n  <span class=\"text-sky-300\">\"a\"</span>: [<span class=\"text-amber-300\">1</span>, <span class=\"text-amber-300\">-2.5e3</span>, <span class=\"text-violet-300\">true</span>, <span class=\"text-violet-300\">null</span>, <span class=\"text-emerald-300\">\"b&lt;\"</span>]\n}"
    );
  }
}
