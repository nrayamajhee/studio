//! The Device's state, as web-react's providers hold it: one store per
//! provider, each a struct of fluid signals with the provider's methods.
//! They live as long as the page, in one [`App`] reached from anywhere with
//! [`app`], timers and animation frames included, as web-react's providers
//! are reached from any component.

pub mod browse;
pub mod clock;
pub mod drum_grid;
pub mod engine;
pub mod feedback;
pub mod hotkeys;
pub mod keymap;
pub mod lanes;
pub mod mix;
pub mod output;
pub mod performance;
pub mod preview;
pub mod scrub;
pub mod shift;
pub mod sound;
pub mod take;
pub mod tracks;
pub mod transport;
pub mod view;

use std::cell::OnceCell;

use browse::Browse;
use drum_grid::DrumGrid;
use engine::Engine;
use feedback::Feedback;
use hotkeys::{HotkeyEvent, Hotkeys};
use lanes::Lanes;
use mix::Mix;
use output::Output;
use performance::Performance;
use preview::Preview;
use shift::Shift;
use sound::SoundStore;
use take::TakeStore;
use tracks::Tracks;
use transport::Transport;
use view::{ScreenView, ViewStore};

use crate::store::chords::ChordStore;
use crate::store::favorites::FavoritesStore;
use crate::store::library::LibraryStore;
use crate::store::session::SessionStore;

/// The whole Device's state: every store, one per web-react provider, and the
/// sound engine they play through, built once by [`App::install`] and reached
/// from anywhere with [`app`].
///
/// Each field is a store named after its provider: the saved stores (`session`,
/// `library`, `favorites`, `chords`), the keys held (`hotkeys`), what the
/// screen says (`feedback`), Shift, the open view (`views`), the transport and
/// tempo, the output level, the sound being played, the keybed and chords
/// (`performance`), the piano roll's lanes, the drum grid, the tracks and their
/// mix, the take, the pickers' preview and the instruments browser. The methods
/// route what touches more than one of them: [`App::view_changed`] tells each
/// store a new view opened, and [`App::hotkey`] hands a key to whichever store
/// hears it.
pub struct App {
  pub engine: Engine,
  pub session: SessionStore,
  pub library: LibraryStore,
  pub favorites: FavoritesStore,
  pub chords: ChordStore,
  pub hotkeys: Hotkeys,
  pub feedback: Feedback,
  pub shift: Shift,
  pub views: ViewStore,
  pub transport: Transport,
  pub output: Output,
  pub sound: SoundStore,
  pub performance: Performance,
  pub lanes: Lanes,
  pub grid: DrumGrid,
  pub tracks: Tracks,
  pub mix: Mix,
  pub take: TakeStore,
  pub preview: Preview,
  pub browse: Browse,
}

thread_local! {
  static APP: OnceCell<&'static App> = const { OnceCell::new() };
}

/// The Device's state, for the page's lifetime.
pub fn app() -> &'static App {
  APP.with(|app| *app.get().expect("the App is installed first"))
}

impl App {
  /// Builds the Device's state, reading what was kept, and starts the
  /// effects that keep it in step. The effects belong to the current
  /// scope, so call it inside the root `Context::run`.
  pub fn install() -> &'static App {
    let app: &'static App = Box::leak(Box::new(App {
      engine: Engine::new(),
      session: SessionStore::load(),
      library: LibraryStore::load(),
      favorites: FavoritesStore::load(),
      chords: ChordStore::load(),
      hotkeys: Hotkeys::new(),
      feedback: Feedback::new(),
      shift: Shift::new(),
      views: ViewStore::new(ScreenView::Scope),
      transport: Transport::new(),
      output: Output::new(),
      sound: SoundStore::new(),
      performance: Performance::new(),
      lanes: Lanes::new(),
      grid: DrumGrid::new(),
      tracks: Tracks::new(),
      mix: Mix::new(),
      take: TakeStore::new(),
      preview: Preview::new(),
      browse: Browse::new(),
    }));
    APP.with(|cell| {
      let _ = cell.set(app);
    });
    app.transport.install();
    app.output.install();
    app.sound.install();
    app.lanes.install();
    app.grid.install();
    app.tracks.install();
    app.mix.install();
    app.take.install();
    app.preview.install();
    crate::modes::install(app);
    app
  }

  /// The view changed from `old` to `view`: what web-react's providers set
  /// as they see the new view.
  pub fn view_changed(&self, _old: ScreenView, view: ScreenView) {
    self.lanes.view_changed(view);
    self.take.view_changed(view);
    self.grid.view_changed(view);
    if view != ScreenView::Progressions {
      self.performance.home_for.set_if_changed(None);
    }
    self.preview.view_changed();
  }

  /// A key pressed or let go, as each of web-react's hotkey listeners hears
  /// it: the pads its key presses, a chord key, the keybed, and Shift's
  /// latch. While the mix saves no key counts, so none is left held.
  pub fn hotkey(&self, event: &HotkeyEvent) {
    use keymap::Control;
    if self.feedback.is_busy() {
      event.ignore();
      return;
    }
    match event.control {
      Control::Tool(_) | Control::Instrument(_) | Control::Step(_) | Control::Pick(_) => {
        if event.down {
          crate::modes::press(event.control, None);
        }
      }
      // Holding any chord key drops a latched chord, so it doesn't come
      // back when the key is let go; the key for the latched chord just
      // stops it rather than playing it.
      Control::Chord(index) => {
        if event.down {
          self.views.leave_revert();
          let latched = *self.performance.chord.get_untracked();
          if latched.is_some() {
            self.performance.drop_chord();
          }
          if latched == Some(index) {
            event.ignore();
          }
        }
      }
      Control::Note(semitone) => crate::ui::keybed::note_key(semitone, event.down, &event.held),
      // On a Shift a click latched, the key releases the latch instead of
      // holding it.
      Control::Shift => {
        if event.down && *self.shift.latched.get_untracked() {
          self.shift.release();
          event.ignore();
        }
      }
    }
  }
}
