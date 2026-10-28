//! What the Device keeps between visits, as web-react's stores keep it:
//! each a fluid signal, written to `localStorage` under web-react's keys
//! and in its JSON shapes whenever it changes.

pub mod chords;
pub mod favorites;
pub mod library;
pub mod session;
pub mod storage;
