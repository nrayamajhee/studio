//! Which view the Device's screen shows, as web-react's `ViewProvider`.

use std::rc::Rc;

use fluid::Signal;

use crate::logic::modules::ModuleId;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ScreenView {
  Scope,
  Synth,
  Save,
  Instruments,
  Chords,
  PlayStyle,
  Progressions,
  Beats,
  Tapes,
  Revert,
  Adsr,
  Lfo,
  Fx,
  Tempo,
  Roll,
  DrumGrid,
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
  Tracks,
  Roll,
  DrumGrid,
}

/// The screens the other views open over.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BaseView {
  Scope,
  Main(MainView),
}

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
  pub fn new(initial: ScreenView) -> Self {
    Self {
      view: Rc::new(Signal::new(initial)),
      module_return: Signal::new(ScreenView::Scope),
      main_view: Rc::new(Signal::new(initial.main().unwrap_or(MainView::Roll))),
      opened_over: Rc::new(Signal::new(initial.base().unwrap_or(BaseView::Scope))),
    }
  }

  pub fn view(&self) -> ScreenView {
    self.view.value()
  }

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
