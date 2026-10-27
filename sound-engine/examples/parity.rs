//! Plays each case `scripts/parity.ts` wrote through the Rust engine and
//! compares it with the TypeScript engine's output, sample by sample.
//!   cargo run --release --example parity

use std::fs;
use std::path::Path;

use sound_engine::engine::Engine;

const SAMPLE_RATE: f64 = 48000.;
const BLOCK: usize = 128;

fn main() {
  let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("target/parity");
  let mut names: Vec<String> = fs::read_dir(&dir)
    .expect("run scripts/parity.ts first")
    .filter_map(|entry| {
      let path = entry.ok()?.path();
      (path.extension()? == "json")
        .then(|| path.file_stem().unwrap().to_string_lossy().into_owned())
    })
    .collect();
  names.sort();
  let mut worst: f64 = 0.;
  println!(
    "{:<16} {:>10} {:>10} {:>9}",
    "case", "peak", "max error", "SNR dB"
  );
  for name in &names {
    let events = fs::read_to_string(dir.join(format!("{name}.json"))).unwrap();
    let expected: Vec<f32> = fs::read(dir.join(format!("{name}.f32")))
      .unwrap()
      .chunks_exact(4)
      .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
      .collect();
    let frames = expected.len() / 2;
    let mut engine = Engine::new(SAMPLE_RATE);
    engine.schedule_json(&events);
    let mut left = vec![0f32; frames];
    let mut right = vec![0f32; frames];
    let mut pos = 0;
    while pos < frames {
      let end = frames.min(pos + BLOCK);
      engine.render(&mut left[pos..end], &mut right[pos..end]);
      pos = end;
    }
    for warning in engine.drain_warnings() {
      println!("  warning: {warning}");
    }
    let (mut peak, mut error, mut signal, mut noise) = (0f64, 0f64, 0f64, 0f64);
    for i in 0..frames {
      for (got, want) in [(left[i], expected[2 * i]), (right[i], expected[2 * i + 1])] {
        let (got, want) = (got as f64, want as f64);
        peak = peak.max(want.abs());
        error = error.max((got - want).abs());
        signal += want * want;
        noise += (got - want) * (got - want);
      }
    }
    let snr = if noise == 0. {
      f64::INFINITY
    } else {
      10. * (signal / noise).log10()
    };
    worst = worst.max(error);
    println!("{name:<16} {peak:>10.5} {error:>10.2e} {snr:>9.1}");
  }
  println!("worst max error {worst:.2e}");
}
