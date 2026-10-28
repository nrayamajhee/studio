//! The synth view's graphs, as web-react's `synthGraphs.ts`: each module's
//! picture drawn in a 100 × 100 box stretched over the screen.

/// The colours a graph draws in: the screen's ink, dimmer and fainter, and
/// the knobs'.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tone {
  Ink,
  Dim,
  Faint,
  Green,
  Red,
  Blue,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ScenePath {
  pub d: String,
  pub tone: Tone,
  pub width: Option<f64>,
  pub dashed: bool,
  /// Filled instead of stroked: a light wash, or `solid`.
  pub fill: bool,
  pub solid: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Align {
  Start,
  Middle,
  End,
}

/// Which edge sits at y: the text's top, its middle or its baseline.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Anchor {
  Top,
  Middle,
  Bottom,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SceneLabel {
  pub x: f64,
  pub y: f64,
  pub text: String,
  pub tone: Option<Tone>,
  pub align: Option<Align>,
  pub anchor: Option<Anchor>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct GraphScene {
  pub paths: Vec<ScenePath>,
  pub labels: Vec<SceneLabel>,
}
