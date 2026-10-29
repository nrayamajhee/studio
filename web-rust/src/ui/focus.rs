//! Tab (and Shift + Tab) steps focus through the page's controls in the
//! Device's order, and Return presses the focused one (Space always plays),
//! as web-react's `focus.ts`. Esc or any press on the Device ends it.

use gloo_utils::document;
use wasm_bindgen::JsCast;
use web_sys::{Element, FocusOptions, HtmlElement};

/// What Tab can move the focus to.
const FOCUSABLE: &str =
  "a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]";

/// The focus group an element is in, if any.
fn group_of(element: &Element) -> Option<HtmlElement> {
  element
    .closest("[data-focus-group]")
    .ok()
    .flatten()
    .and_then(|group| group.dyn_into::<HtmlElement>().ok())
}

/// The name of the focus group an element is in.
fn group_name(element: &Element) -> Option<String> {
  group_of(element).and_then(|group| group.get_attribute("data-focus-group"))
}

/// Document order doesn't match the layout everywhere: the keybed lists
/// its white keys before its black ones. Controls inside a
/// `[data-focus-group]` are visited together, where the group's first one
/// is, in reading order: "rows" goes row by row, "columns" left to right.
fn reading_order(controls: Vec<HtmlElement>) -> Vec<HtmlElement> {
  let mut groups: Vec<(String, Vec<HtmlElement>)> = Vec::new();
  for element in &controls {
    if let Some(name) = group_name(element) {
      match groups.iter_mut().find(|(group, _)| *group == name) {
        Some((_, members)) => members.push(element.clone()),
        None => groups.push((name, vec![element.clone()])),
      }
    }
  }
  for (_, members) in &mut groups {
    let columns = group_of(&members[0])
      .and_then(|group| group.get_attribute("data-focus-order"))
      .as_deref()
      == Some("columns");
    members.sort_by(|a, b| {
      let (ra, rb) = (a.get_bounding_client_rect(), b.get_bounding_client_rect());
      let dx = ra.left() + ra.width() / 2. - (rb.left() + rb.width() / 2.);
      let dy = ra.top() - rb.top();
      let by = if columns || dy.abs() <= 4. { dx } else { dy };
      by.total_cmp(&0.)
    });
  }
  let mut order = Vec::new();
  let mut placed: Vec<String> = Vec::new();
  for element in controls {
    match group_name(&element) {
      None => order.push(element),
      Some(name) if !placed.contains(&name) => {
        if let Some((_, members)) = groups.iter().find(|(group, _)| *group == name) {
          order.extend(members.iter().cloned());
        }
        placed.push(name);
      }
      Some(_) => {}
    }
  }
  order
}

/// Moves the focus to the next control in reading order (or the one before,
/// with -1), round and round.
pub fn move_focus(direction: i32) {
  let Ok(all) = document().query_selector_all(FOCUSABLE) else {
    return;
  };
  let controls: Vec<HtmlElement> = (0..all.length())
    .filter_map(|i| all.item(i)?.dyn_into::<HtmlElement>().ok())
    .filter(|element| element.tab_index() >= 0 && element.get_client_rects().length() > 0)
    .collect();
  let controls = reading_order(controls);
  if controls.is_empty() {
    return;
  }
  let active = document().active_element();
  let current = controls.iter().position(|control| {
    active
      .as_ref()
      .is_some_and(|active| active == control.unchecked_ref::<Element>())
  });
  let count = controls.len() as i32;
  let next = match current {
    None if direction > 0 => 0,
    None => count - 1,
    Some(at) => (at as i32 + direction).rem_euclid(count),
  };
  let options = FocusOptions::new();
  let _ = js_sys::Reflect::set(&options, &"focusVisible".into(), &true.into());
  let _ = controls[next as usize].focus_with_options(&options);
}

/// A control focused from the keyboard (not the page itself).
pub fn keyboard_focus() -> bool {
  let Some(active) = document().active_element() else {
    return false;
  };
  active.dyn_ref::<HtmlElement>().is_some()
    && document()
      .body()
      .is_none_or(|body| active != *body.unchecked_ref::<Element>())
    && active.matches(FOCUSABLE).unwrap_or(false)
}
