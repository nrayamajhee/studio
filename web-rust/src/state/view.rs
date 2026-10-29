//! Which view the Device's screen shows, as web-react's `ViewProvider`.

use std::rc::Rc;

use fluid::Signal;

use crate::logic::modules::ModuleId;

/// What the Device's screen can show: the main screen (the scope) and each view
/// a pad opens.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ScreenView {
  /// The main screen: the scope over the output.
  Scope,
  /// The synth's parameters: the chain overview and a page per module.
  Synth,
  /// Saving the sound: its name, icon and pad.
  Save,
  /// The instruments, by model or band.
  Instruments,
  /// The chord palette, for the chord pads.
  Chords,
  /// How chords come out: block, strum, arpeggio, rhythms.
  PlayStyle,
  /// The chord progressions, to load as the take.
  Progressions,
  /// The drum beats, to load into the drum grid.
  Beats,
  /// The tapes in the session.
  Tapes,
  /// What to revert, from this sound to everything.
  Revert,
  /// The ADSR, the volume envelope.
  Adsr,
  /// The LFO, the modulator over the mix.
  Lfo,
  /// The FX: drive, chorus, delay and reverb.
  Fx,
  /// The tempo, tap tempo, swing and time signature.
  Tempo,
  /// The take as a piano roll.
  Roll,
  /// The drum grid, for the kits.
  DrumGrid,
  /// The open tape's tracks.
  Tracks,
}

impl ScreenView {
  /// The module a module view shows.
  pub fn module(self) -> Option<ModuleId> {
    match self {
      Self::Adsr => Some(ModuleId::Adsr),
      Self::Lfo => Some(ModuleId::Lfo),
      Self::Fx => Some(ModuleId::Fx),
      _ => None,
    }
  }

  /// The module view that shows `id`.
  pub fn of_module(id: ModuleId) -> Self {
    match id {
      ModuleId::Adsr => Self::Adsr,
      ModuleId::Lfo => Self::Lfo,
      ModuleId::Fx => Self::Fx,
    }
  }

  /// The main view a view plays: the tracks (and the tapes), the piano
  /// roll and the drum grid.
  fn main(self) -> Option<MainView> {
    match self {
      Self::Tracks | Self::Tapes => Some(MainView::Tracks),
      Self::Roll => Some(MainView::Roll),
      Self::DrumGrid => Some(MainView::DrumGrid),
      _ => None,
    }
  }

  /// The screen it opens over: the main screen, or a main view.
  fn base(self) -> Option<BaseView> {
    match self {
      Self::Scope => Some(BaseView::Scope),
      _ => self.main().map(BaseView::Main),
    }
  }
}

/// The views that play something of their own: the tracks (and the tapes),
/// the piano roll and the drum grid.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MainView {
  /// The tracks (and the tapes).
  Tracks,
  /// The piano roll.
  Roll,
  /// The drum grid.
  DrumGrid,
}

/// The screens the other views open over.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BaseView {
  /// The main screen.
  Scope,
  /// A main view.
  Main(MainView),
}

/// Which view the screen shows, as web-react's `ViewProvider`, with what it
/// remembers about the views before it: the main view whose Play and Stop the
/// main screen keeps, the screen the open view was opened over, and where
/// closing a module view goes back to.
///
/// [`ViewStore::set_view`] shows a view and tells the rest of the Device;
/// [`ViewStore::toggle_view`] and [`ViewStore::toggle_module`] open a view from
/// its pad or close it again, and [`ViewStore::leave_revert`] closes Revert on
/// any other press.
pub struct ViewStore {
  pub view: Rc<Signal<ScreenView>>,
  /// Where closing a module view goes back to.
  module_return: Signal<ScreenView>,
  /// The main screen is only what shows between views, so what the last
  /// main view plays carries on there, and its Play and Stop act on it.
  pub main_view: Rc<Signal<MainView>>,
  /// The screen the view showing now was opened over.
  pub opened_over: Rc<Signal<BaseView>>,
}

impl ViewStore {
  /// Showing `initial`.
  pub fn new(initial: ScreenView) -> Self {
    Self {
      view: Rc::new(Signal::new(initial)),
      module_return: Signal::new(ScreenView::Scope),
      main_view: Rc::new(Signal::new(initial.main().unwrap_or(MainView::Roll))),
      opened_over: Rc::new(Signal::new(initial.base().unwrap_or(BaseView::Scope))),
    }
  }

  /// The view showing, tracked.
  pub fn view(&self) -> ScreenView {
    self.view.value()
  }

  /// The main view the main screen plays, tracked.
  pub fn main_view(&self) -> MainView {
    self.main_view.value()
  }

  /// Shows `view`, keeping the main view and the screen it opened over in
  /// step, and lets the rest of the Device follow the change.
  pub fn set_view(&self, view: ScreenView) {
    let old = self.view.get_untracked().to_owned();
    if old == view {
      return;
    }
    fluid::batch(|| {
      self.view.set(view);
      if let Some(main) = view.main() {
        self.main_view.set_if_changed(main);
      }
      if let Some(base) = view.base() {
        self.opened_over.set_if_changed(base);
      }
      super::app().view_changed(old, view);
    });
  }

  /// A view's own pad opens it, and pressed again goes back to the main
  /// screen.
  pub fn toggle_view(&self, opens: ScreenView) {
    let current = self.view.get_untracked().to_owned();
    self.set_view(if current == opens {
      ScreenView::Scope
    } else {
      opens
    });
  }

  /// Revert closes on any press but its own, so it never traps anyone; the
  /// press then does what it does.
  pub fn leave_revert(&self) {
    if *self.view.get_untracked() == ScreenView::Revert {
      self.set_view(ScreenView::Scope);
    }
  }

  /// A module pad opens its view, and pressed again goes back to the view
  /// it was opened from (moving between modules keeps that).
  pub fn toggle_module(&self, id: ModuleId) {
    let view = *self.view.get_untracked();
    let opens = ScreenView::of_module(id);
    if view == opens {
      self.set_view(*self.module_return.get_untracked());
      return;
    }
    if view.module().is_none() {
      self.module_return.set(if view == ScreenView::Revert {
        ScreenView::Scope
      } else {
        view
      });
    }
    self.set_view(opens);
  }
}
