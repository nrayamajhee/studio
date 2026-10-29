//! Small helpers from web-react's `deviceMath.ts`.

use super::js::round;

/// Moves an item index to the same slot on the next or previous page,
/// stopping at the first and last page as the knob does.
pub fn turn_page(index: usize, direction: i32, per_page: usize, count: usize) -> usize {
  let pages = count.div_ceil(per_page).max(1);
  let page = (index / per_page) as i64 + i64::from(direction);
  let page = page.clamp(0, pages as i64 - 1) as usize;
  (page * per_page + index % per_page).min(count.saturating_sub(1))
}

/// A place in a take as bar.beat.step, counting from 1, to the nearest
/// step.
pub fn position_label(beats: f64, bar_beats: u32, per_beat: u32) -> String {
  let steps = round(beats * f64::from(per_beat)) as i64;
  let per_beat = i64::from(per_beat);
  let bar = steps.div_euclid(i64::from(bar_beats) * per_beat);
  let beat = steps.div_euclid(per_beat).rem_euclid(i64::from(bar_beats));
  format!(
    "{}.{}.{}",
    bar + 1,
    beat + 1,
    steps.rem_euclid(per_beat) + 1
  )
}

/// `count` and `noun`, plural unless it's one: `1 track`, `3 tracks`.
pub fn plural(count: usize, noun: &str) -> String {
  format!("{count} {noun}{}", if count == 1 { "" } else { "s" })
}

/// A preset icon's key as a label: its first letter capitalized.
pub fn icon_label(icon: &str) -> String {
  let mut chars = icon.chars();
  match chars.next() {
    Some(first) => first.to_uppercase().chain(chars).collect(),
    None => String::new(),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn pages_turn_to_the_same_slot() {
    assert_eq!(turn_page(2, 1, 12, 30), 14);
    assert_eq!(turn_page(26, 1, 12, 30), 26);
    assert_eq!(turn_page(10, 1, 12, 20), 19);
    assert_eq!(turn_page(3, -1, 12, 30), 3);
  }

  #[test]
  fn positions_count_from_one() {
    assert_eq!(position_label(0., 4, 4), "1.1.1");
    assert_eq!(position_label(5.25, 4, 4), "2.2.2");
    assert_eq!(plural(1, "track"), "1 track");
    assert_eq!(plural(2, "track"), "2 tracks");
    assert_eq!(icon_label("steelPan"), "SteelPan");
  }
}
