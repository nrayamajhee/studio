//! The page's clocks: `performance.now()` for timing what is played, and
//! timers that end with the scope that made them.

/// Milliseconds since the page loaded, as `performance.now()` reads them.
pub fn now() -> f64 {
  #[cfg(target_arch = "wasm32")]
  {
    web_sys::window()
      .and_then(|window| window.performance())
      .map_or(0., |performance| performance.now())
  }
  #[cfg(not(target_arch = "wasm32"))]
  {
    use std::sync::OnceLock;
    use std::time::Instant;
    static START: OnceLock<Instant> = OnceLock::new();
    START.get_or_init(Instant::now).elapsed().as_secs_f64() * 1000.
  }
}

/// A `setTimeout` delay as the browser takes it: whole, and never negative.
pub fn delay(ms: f64) -> u32 {
  ms.max(0.).round() as u32
}
