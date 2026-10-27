//! Plays every patch at several sample rates with each param at its
//! extremes, in a debug build so any overflow or bad index panics.
use sound_engine::engine::Engine;
use sound_engine::patches::{Patch, data};

fn main() {
  for fs in [22050., 44100., 48000., 96000.] {
    let mut engine = Engine::new(fs);
    for patch in &data().patches {
      for extreme in [0., 1.] {
        let mut events = Vec::new();
        for spec in &patch.base().params {
          let value = spec.min + extreme * (spec.max - spec.min);
          events.push(format!(
            r#"{{"type":"param","target":"{}","id":"{}","value":{value}}}"#,
            patch.id(),
            spec.id
          ));
        }
        match patch {
          Patch::Drums(kit) => {
            for piece in kit.pieces.keys() {
              events.push(format!(
                r#"{{"type":"hit","kit":"{}","piece":"{piece}","velocity":1}}"#,
                kit.base.id
              ));
            }
          }
          _ => {
            let (low, high) = patch.base().range;
            for note in [low - 13, low, (low + high) / 2, high, high + 13] {
              events.push(format!(
                r#"{{"type":"noteOn","instrument":"{}","note":{note},"velocity":1}}"#,
                patch.id()
              ));
            }
          }
        }
        engine.schedule_json(&format!("[{}]", events.join(",")));
        let (mut l, mut r) = (vec![0f32; 128], vec![0f32; 128]);
        for _ in 0..(0.3 * fs / 128.) as usize {
          engine.render(&mut l, &mut r);
          assert!(
            l.iter().chain(&r).all(|x| x.is_finite()),
            "{} at {fs}",
            patch.id()
          );
        }
        engine.schedule_json(r#"{"type":"allNotesOff"}"#);
      }
    }
    for spec in &data().master {
      for value in [spec.min, spec.max] {
        engine.schedule_json(&format!(
          r#"{{"type":"param","target":"master","id":"{}","value":{value}}}"#,
          spec.id
        ));
        let (mut l, mut r) = (vec![0f32; 128], vec![0f32; 128]);
        engine.schedule_json(r#"{"type":"noteOn","instrument":"piano","note":60,"velocity":1}"#);
        for _ in 0..50 {
          engine.render(&mut l, &mut r);
        }
      }
    }
    println!("{fs} ok, warnings: {:?}", engine.drain_warnings());
  }
}
