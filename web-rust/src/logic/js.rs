//! JavaScript's number formatting and rounding, so text and saved JSON read
//! as web-react's do.

/// `Math.round`: halves round up, towards +∞ (`-2.5` to `-2`), where
/// Rust's `round` rounds them away from zero.
pub fn round(x: f64) -> f64 {
  let floor = x.floor();
  if x - floor >= 0.5 { floor + 1. } else { floor }
}

/// `Number.prototype.toFixed`: `digits` decimals, a tie rounding up (away
/// from zero), where Rust's formatting rounds a tie to even.
pub fn to_fixed(x: f64, digits: usize) -> String {
  if !x.is_finite() {
    return number(x);
  }
  // The value's exact decimal digits, then rounded half up by hand.
  let exact = format!("{:.60}", x.abs());
  let (whole, fraction) = exact.split_once('.').unwrap_or((&exact, ""));
  let mut digits_kept: Vec<u8> = whole.bytes().chain(fraction.bytes().take(digits)).collect();
  let next = fraction.as_bytes().get(digits).copied().unwrap_or(b'0');
  if next >= b'5' {
    let mut at = digits_kept.len();
    loop {
      if at == 0 {
        digits_kept.insert(0, b'1');
        break;
      }
      at -= 1;
      if digits_kept[at] == b'9' {
        digits_kept[at] = b'0';
      } else {
        digits_kept[at] += 1;
        break;
      }
    }
  }
  let split = digits_kept.len() - digits;
  let mut text = String::from_utf8(digits_kept[..split].to_vec()).unwrap_or_default();
  if digits > 0 {
    text.push('.');
    text.push_str(std::str::from_utf8(&digits_kept[split..]).unwrap_or_default());
  }
  // As JavaScript does, anything below zero keeps its sign: `-0.0`.
  if x < 0. { format!("-{text}") } else { text }
}

/// A number as `String(x)` writes it: whole numbers without a decimal
/// point, others in their shortest form.
pub fn number(x: f64) -> String {
  if x.is_nan() {
    "NaN".into()
  } else if x.is_infinite() {
    if x > 0. {
      "Infinity".into()
    } else {
      "-Infinity".into()
    }
  } else if x == 0. {
    "0".into()
  } else {
    format!("{x}")
  }
}

/// `String.prototype.padStart` with zeros, for clock-like numbers.
pub fn pad2(n: impl std::fmt::Display) -> String {
  format!("{n:0>2}")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn rounds_halves_up() {
    assert_eq!(round(2.5), 3.);
    assert_eq!(round(-2.5), -2.);
    assert_eq!(round(0.49999999999999994), 0.);
    assert_eq!(round(-0.4), -0.);
  }

  #[test]
  fn fixed_like_javascript() {
    assert_eq!(to_fixed(0.25, 1), "0.3");
    assert_eq!(to_fixed(1.005, 2), "1.00");
    assert_eq!(to_fixed(9.96, 1), "10.0");
    assert_eq!(to_fixed(-1.25, 1), "-1.3");
    assert_eq!(to_fixed(-0.04, 1), "-0.0");
    assert_eq!(to_fixed(-0., 1), "0.0");
    assert_eq!(to_fixed(12.0, 0), "12");
    assert_eq!(to_fixed(0.5, 0), "1");
  }

  #[test]
  fn numbers_like_javascript() {
    assert_eq!(number(96.), "96");
    assert_eq!(number(0.1), "0.1");
    assert_eq!(number(-0.), "0");
    assert_eq!(pad2(7), "07");
  }
}
