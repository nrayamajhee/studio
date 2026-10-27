//! A cosmetic speaker grille either side of the screen: ten columns of holes
//! in 52 rows, with the four corner holes left undrilled so the field reads
//! as rounded.

use fluid_macro::html;
use wasm_bindgen::prelude::*;
use web_sys::Element;

const COLUMNS: usize = 10;
const ROWS: usize = 52;
const RADIUS: usize = 1;

/// A hole is drilled if it lies within a one-hole radius of the field's
/// inner rectangle.
fn drilled(hole: usize) -> bool {
  let (column, row) = (hole % COLUMNS, hole / COLUMNS);
  let past = |at: usize, count: usize| {
    RADIUS
      .saturating_sub(at)
      .max(at.saturating_sub(count - 1 - RADIUS))
  };
  let (x, y) = (past(column, COLUMNS), past(row, ROWS));
  x * x + y * y <= RADIUS * RADIUS
}

pub fn grille() -> Result<Element, JsValue> {
  // Whole-pixel gaps and a whole-pixel start keep the rows even on a 2×
  // display.
  let field = html! {
    span class="mt-[calc(var(--spacing-inset)_-_var(--spacing-bezel))] grid auto-rows-[2.5px] grid-cols-[repeat(10,2.5px)] content-start justify-center gap-[2px] overflow-hidden pt-[14px]" {}
  };
  field.set_attribute("aria-hidden", "true")?;
  let holes: String = (0..COLUMNS * ROWS)
    .map(|hole| {
      if drilled(hole) {
        r#"<span class="rounded-[50%] bg-grille-hole shadow-grille-hole"></span>"#
      } else {
        r#"<span class="invisible rounded-[50%] bg-grille-hole shadow-grille-hole"></span>"#
      }
    })
    .collect();
  field.set_inner_html(&holes);
  Ok(field)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn only_the_corners_are_left_undrilled() {
    let undrilled: Vec<_> = (0..COLUMNS * ROWS).filter(|&hole| !drilled(hole)).collect();
    assert_eq!(
      undrilled,
      [0, COLUMNS - 1, COLUMNS * (ROWS - 1), COLUMNS * ROWS - 1]
    );
  }
}
