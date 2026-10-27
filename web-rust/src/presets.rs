//! The six presets on the instrument pads, as web-react ships them: the
//! name, how the sound is made, the octave and how far it reaches, every
//! parameter the knobs pick and set with the display of each step, and
//! for a kit the piece on each key.

pub struct Param {
  pub name: &'static str,
  /// The step it starts on.
  pub step: usize,
  /// The display of each knob step.
  pub values: &'static [&'static str],
}

pub struct Piece {
  pub name: &'static str,
  /// An icon's SVG markup, or the bol's name.
  pub face: &'static str,
}

pub struct Preset {
  pub name: &'static str,
  /// How the sound is made: the model's exciter.
  pub engine: &'static str,
  /// The lowest and highest octave shift the arrows reach: the keybed may
  /// hang at most 11 notes past either end of the instrument's range. A kit
  /// plays pieces by key, so it never shifts.
  pub octaves: (i8, i8),
  pub params: &'static [Param],
  /// A kit's pieces, by keybed semitone.
  pub pieces: Option<&'static [Piece; 24]>,
}

pub const PRESETS: [Preset; 6] = [
  Preset {
    name: "Grand piano",
    engine: "Hammer",
    octaves: (-3, 3),
    params: &[
      Param {
        name: "Hardness",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Position",
        step: 2,
        values: &[
          "5%", "10%", "12%", "19%", "23%", "28%", "32%", "37%", "41%", "46%", "50%",
        ],
      },
      Param {
        name: "Strength",
        step: 8,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Decay",
        step: 5,
        values: &[
          "0.25×", "0.33×", "0.44×", "0.57×", "0.76×", "1.00×", "1.32×", "1.74×", "2.30×", "3.03×",
          "4.00×",
        ],
      },
      Param {
        name: "Brightness",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Inharmonicity",
        step: 3,
        values: &[
          "0.00×", "0.30×", "0.60×", "1.00×", "1.20×", "1.50×", "1.80×", "2.10×", "2.40×", "2.70×",
          "3.00×",
        ],
      },
      Param {
        name: "Detune",
        step: 3,
        values: &[
          "0.00×", "0.40×", "0.80×", "1.00×", "1.60×", "2.00×", "2.40×", "2.80×", "3.20×", "3.60×",
          "4.00×",
        ],
      },
      Param {
        name: "Attack",
        step: 0,
        values: &[
          "1 ms", "2 ms", "3 ms", "5 ms", "8 ms", "14 ms", "24 ms", "41 ms", "69 ms", "118 ms",
          "200 ms",
        ],
      },
      Param {
        name: "Damper",
        step: 5,
        values: &[
          "0.25×", "0.33×", "0.44×", "0.57×", "0.76×", "1.00×", "1.32×", "1.74×", "2.30×", "3.03×",
          "4.00×",
        ],
      },
      Param {
        name: "Cutoff",
        step: 10,
        values: &[
          "200 Hz", "310 Hz", "480 Hz", "745 Hz", "1.2 kHz", "1.8 kHz", "2.8 kHz", "4.3 kHz",
          "6.7 kHz", "10 kHz", "16 kHz",
        ],
      },
      Param {
        name: "Filter Resonance",
        step: 0,
        values: &[
          "3%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Env amount",
        step: 0,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Env decay",
        step: 6,
        values: &[
          "20 ms", "32 ms", "50 ms", "80 ms", "126 ms", "200 ms", "300 ms", "502 ms", "796 ms",
          "1.26 s", "2.00 s",
        ],
      },
      Param {
        name: "Keytrack",
        step: 0,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Rate",
        step: 8,
        values: &[
          "0.2 Hz", "0.3 Hz", "0.5 Hz", "0.7 Hz", "1.0 Hz", "1.5 Hz", "2.3 Hz", "3.5 Hz", "5.0 Hz",
          "8.0 Hz", "12 Hz",
        ],
      },
      Param {
        name: "Shape",
        step: 0,
        values: &["Sine", "Triangle", "Square", "Saw", "Random"],
      },
      Param {
        name: "Delay",
        step: 0,
        values: &[
          "0 ms", "200 ms", "400 ms", "600 ms", "800 ms", "1.00 s", "1.20 s", "1.40 s", "1.60 s",
          "1.80 s", "2.00 s",
        ],
      },
      Param {
        name: "Pitch",
        step: 0,
        values: &[
          "0.0 ¢", "5.0 ¢", "10.0 ¢", "15.0 ¢", "20.0 ¢", "25.0 ¢", "30.0 ¢", "35.0 ¢", "40.0 ¢",
          "45.0 ¢", "50.0 ¢",
        ],
      },
      Param {
        name: "Vibrato Level",
        step: 0,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Filter",
        step: 0,
        values: &[
          "0.0 oct", "0.3 oct", "0.6 oct", "0.9 oct", "1.2 oct", "1.5 oct", "1.8 oct", "2.1 oct",
          "2.4 oct", "2.7 oct", "3.0 oct",
        ],
      },
      Param {
        name: "Size",
        step: 4,
        values: &[
          "0.70×", "0.77×", "0.84×", "0.91×", "1.00×", "1.05×", "1.12×", "1.19×", "1.26×", "1.33×",
          "1.40×",
        ],
      },
      Param {
        name: "Body Resonance",
        step: 3,
        values: &[
          "0.50×", "0.65×", "0.80×", "1.00×", "1.10×", "1.25×", "1.40×", "1.55×", "1.70×", "1.85×",
          "2.00×",
        ],
      },
      Param {
        name: "Tone",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Mix",
        step: 4,
        values: &[
          "0%", "10%", "20%", "30%", "35%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Output Level",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Reverb send",
        step: 3,
        values: &[
          "0%", "10%", "20%", "25%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
    ],
    pieces: None,
  },
  Preset {
    name: "Fingerstyle electric",
    engine: "Pluck",
    octaves: (-2, 1),
    params: &[
      Param {
        name: "Hardness",
        step: 4,
        values: &[
          "0%", "10%", "20%", "30%", "35%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Position",
        step: 4,
        values: &[
          "5%", "10%", "14%", "19%", "22%", "28%", "32%", "37%", "41%", "46%", "50%",
        ],
      },
      Param {
        name: "Strength",
        step: 8,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Pluck",
        step: 1,
        values: &["Pick", "Finger"],
      },
      Param {
        name: "Decay",
        step: 5,
        values: &[
          "0.25×", "0.33×", "0.44×", "0.57×", "0.76×", "1.00×", "1.32×", "1.74×", "2.30×", "3.03×",
          "4.00×",
        ],
      },
      Param {
        name: "Brightness",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Inharmonicity",
        step: 3,
        values: &[
          "0.00×", "0.30×", "0.60×", "1.00×", "1.20×", "1.50×", "1.80×", "2.10×", "2.40×", "2.70×",
          "3.00×",
        ],
      },
      Param {
        name: "Detune",
        step: 3,
        values: &[
          "0.00×", "0.40×", "0.80×", "1.00×", "1.60×", "2.00×", "2.40×", "2.80×", "3.20×", "3.60×",
          "4.00×",
        ],
      },
      Param {
        name: "Attack",
        step: 0,
        values: &[
          "1 ms", "2 ms", "3 ms", "5 ms", "8 ms", "14 ms", "24 ms", "41 ms", "69 ms", "118 ms",
          "200 ms",
        ],
      },
      Param {
        name: "Damper",
        step: 5,
        values: &[
          "0.25×", "0.33×", "0.44×", "0.57×", "0.76×", "1.00×", "1.32×", "1.74×", "2.30×", "3.03×",
          "4.00×",
        ],
      },
      Param {
        name: "Cutoff",
        step: 8,
        values: &[
          "200 Hz", "310 Hz", "480 Hz", "745 Hz", "1.2 kHz", "1.8 kHz", "2.8 kHz", "4.3 kHz",
          "5.5 kHz", "10 kHz", "16 kHz",
        ],
      },
      Param {
        name: "Filter Resonance",
        step: 1,
        values: &[
          "0%", "7%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Env amount",
        step: 0,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Env decay",
        step: 6,
        values: &[
          "20 ms", "32 ms", "50 ms", "80 ms", "126 ms", "200 ms", "300 ms", "502 ms", "796 ms",
          "1.26 s", "2.00 s",
        ],
      },
      Param {
        name: "Keytrack",
        step: 0,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Rate",
        step: 8,
        values: &[
          "0.2 Hz", "0.3 Hz", "0.5 Hz", "0.7 Hz", "1.0 Hz", "1.5 Hz", "2.3 Hz", "3.5 Hz", "5.0 Hz",
          "8.0 Hz", "12 Hz",
        ],
      },
      Param {
        name: "Shape",
        step: 0,
        values: &["Sine", "Triangle", "Square", "Saw", "Random"],
      },
      Param {
        name: "Delay",
        step: 0,
        values: &[
          "0 ms", "200 ms", "400 ms", "600 ms", "800 ms", "1.00 s", "1.20 s", "1.40 s", "1.60 s",
          "1.80 s", "2.00 s",
        ],
      },
      Param {
        name: "Pitch",
        step: 0,
        values: &[
          "0.0 ¢", "5.0 ¢", "10.0 ¢", "15.0 ¢", "20.0 ¢", "25.0 ¢", "30.0 ¢", "35.0 ¢", "40.0 ¢",
          "45.0 ¢", "50.0 ¢",
        ],
      },
      Param {
        name: "Vibrato Level",
        step: 0,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Filter",
        step: 0,
        values: &[
          "0.0 oct", "0.3 oct", "0.6 oct", "0.9 oct", "1.2 oct", "1.5 oct", "1.8 oct", "2.1 oct",
          "2.4 oct", "2.7 oct", "3.0 oct",
        ],
      },
      Param {
        name: "Size",
        step: 4,
        values: &[
          "0.70×", "0.77×", "0.84×", "0.91×", "1.00×", "1.05×", "1.12×", "1.19×", "1.26×", "1.33×",
          "1.40×",
        ],
      },
      Param {
        name: "Body Resonance",
        step: 3,
        values: &[
          "0.50×", "0.65×", "0.80×", "1.00×", "1.10×", "1.25×", "1.40×", "1.55×", "1.70×", "1.85×",
          "2.00×",
        ],
      },
      Param {
        name: "Tone",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Mix",
        step: 0,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Drive",
        step: 4,
        values: &[
          "0%", "10%", "20%", "30%", "35%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Output Level",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Reverb send",
        step: 2,
        values: &[
          "0%", "10%", "15%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
    ],
    pieces: None,
  },
  Preset {
    name: "Violin",
    engine: "Bow",
    octaves: (0, 2),
    params: &[
      Param {
        name: "Bow pressure",
        step: 8,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "75%", "90%", "100%",
        ],
      },
      Param {
        name: "Bow position",
        step: 4,
        values: &[
          "5%", "9%", "12%", "16%", "18%", "23%", "26%", "30%", "33%", "37%", "40%",
        ],
      },
      Param {
        name: "Bow speed",
        step: 5,
        values: &[
          "0.50×", "0.60×", "0.70×", "0.80×", "0.90×", "1.00×", "1.10×", "1.20×", "1.30×", "1.40×",
          "1.50×",
        ],
      },
      Param {
        name: "Attack",
        step: 5,
        values: &[
          "5 ms", "8 ms", "13 ms", "20 ms", "32 ms", "60 ms", "79 ms", "126 ms", "199 ms",
          "315 ms", "500 ms",
        ],
      },
      Param {
        name: "Decay",
        step: 3,
        values: &[
          "10 ms", "16 ms", "25 ms", "50 ms", "63 ms", "100 ms", "158 ms", "251 ms", "398 ms",
          "631 ms", "1.00 s",
        ],
      },
      Param {
        name: "Sustain",
        step: 9,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "86%", "100%",
        ],
      },
      Param {
        name: "Release",
        step: 5,
        values: &[
          "20 ms", "30 ms", "44 ms", "65 ms", "96 ms", "150 ms", "209 ms", "309 ms", "457 ms",
          "676 ms", "1.00 s",
        ],
      },
      Param {
        name: "Glide",
        step: 8,
        values: &[
          "1 ms", "2 ms", "3 ms", "6 ms", "10 ms", "17 ms", "31 ms", "54 ms", "80 ms", "170 ms",
          "300 ms",
        ],
      },
      Param {
        name: "Cutoff",
        step: 9,
        values: &[
          "200 Hz", "310 Hz", "480 Hz", "745 Hz", "1.2 kHz", "1.8 kHz", "2.8 kHz", "4.3 kHz",
          "6.7 kHz", "12 kHz", "16 kHz",
        ],
      },
      Param {
        name: "Resonance",
        step: 0,
        values: &[
          "3%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Env amount",
        step: 0,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Env decay",
        step: 6,
        values: &[
          "20 ms", "32 ms", "50 ms", "80 ms", "126 ms", "200 ms", "300 ms", "502 ms", "796 ms",
          "1.26 s", "2.00 s",
        ],
      },
      Param {
        name: "Keytrack",
        step: 0,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Rate",
        step: 8,
        values: &[
          "0.2 Hz", "0.3 Hz", "0.5 Hz", "0.7 Hz", "1.0 Hz", "1.5 Hz", "2.3 Hz", "3.5 Hz", "5.6 Hz",
          "8.0 Hz", "12 Hz",
        ],
      },
      Param {
        name: "Shape",
        step: 0,
        values: &["Sine", "Triangle", "Square", "Saw", "Random"],
      },
      Param {
        name: "Delay",
        step: 2,
        values: &[
          "0 ms", "200 ms", "300 ms", "600 ms", "800 ms", "1.00 s", "1.20 s", "1.40 s", "1.60 s",
          "1.80 s", "2.00 s",
        ],
      },
      Param {
        name: "Pitch",
        step: 2,
        values: &[
          "0.0 ¢", "5.0 ¢", "10.4 ¢", "15.0 ¢", "20.0 ¢", "25.0 ¢", "30.0 ¢", "35.0 ¢", "40.0 ¢",
          "45.0 ¢", "50.0 ¢",
        ],
      },
      Param {
        name: "Vibrato Level",
        step: 0,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Filter",
        step: 0,
        values: &[
          "0.0 oct", "0.3 oct", "0.6 oct", "0.9 oct", "1.2 oct", "1.5 oct", "1.8 oct", "2.1 oct",
          "2.4 oct", "2.7 oct", "3.0 oct",
        ],
      },
      Param {
        name: "Body",
        step: 10,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Tone",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Output Level",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Reverb send",
        step: 3,
        values: &[
          "0%", "10%", "20%", "25%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
    ],
    pieces: None,
  },
  Preset {
    name: "Rock kit",
    engine: "Strike",
    octaves: (0, 0),
    params: &[
      Param {
        name: "Hardness",
        step: 6,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Position",
        step: 3,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Strength",
        step: 8,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Click",
        step: 5,
        values: &[
          "0.00×", "0.20×", "0.40×", "0.60×", "0.80×", "1.00×", "1.20×", "1.40×", "1.60×", "1.80×",
          "2.00×",
        ],
      },
      Param {
        name: "Tune",
        step: 5,
        values: &[
          "-12.0 st", "-9.6 st", "-7.2 st", "-4.8 st", "-2.4 st", "0.0 st", "+2.4 st", "+4.8 st",
          "+7.2 st", "+9.6 st", "+12.0 st",
        ],
      },
      Param {
        name: "Decay",
        step: 5,
        values: &[
          "0.25×", "0.33×", "0.44×", "0.57×", "0.76×", "1.00×", "1.32×", "1.74×", "2.30×", "3.03×",
          "4.00×",
        ],
      },
      Param {
        name: "Pitch drop",
        step: 5,
        values: &[
          "0.00×", "0.20×", "0.40×", "0.60×", "0.80×", "1.00×", "1.20×", "1.40×", "1.60×", "1.80×",
          "2.00×",
        ],
      },
      Param {
        name: "Snare wires",
        step: 7,
        values: &[
          "0.00×", "0.15×", "0.30×", "0.45×", "0.60×", "0.75×", "0.90×", "1.00×", "1.20×", "1.35×",
          "1.50×",
        ],
      },
      Param {
        name: "Cutoff",
        step: 10,
        values: &[
          "200 Hz", "317 Hz", "502 Hz", "796 Hz", "1.3 kHz", "2.0 kHz", "3.2 kHz", "5.0 kHz",
          "8.0 kHz", "13 kHz", "20 kHz",
        ],
      },
      Param {
        name: "Resonance",
        step: 0,
        values: &[
          "3%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Width",
        step: 7,
        values: &[
          "0.00×", "0.15×", "0.30×", "0.45×", "0.60×", "0.75×", "0.90×", "1.00×", "1.20×", "1.35×",
          "1.50×",
        ],
      },
      Param {
        name: "Tone",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Level",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Reverb send",
        step: 2,
        values: &[
          "0%", "10%", "18%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
    ],
    pieces: Some(&[
      Piece {
        name: "Kick",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="11" r="8"></circle><circle cx="12" cy="11" r="2.5"></circle><path d="m7 18-2 4"></path><path d="m17 18 2 4"></path></svg>"#,
      },
      Piece {
        name: "Closed hat",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10c3-3.5 15-3.5 18 0-3 3.5-15 3.5-18 0z"></path><path d="M12 13v8"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Snare",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 8 8"></path><path d="m22 2-8 8"></path><ellipse cx="12" cy="9" rx="10" ry="5"></ellipse><path d="M7 13.4v7.9"></path><path d="M12 14v8"></path><path d="M17 13.4v7.9"></path><path d="M2 9v8a10 5 0 0 0 20 0V9"></path></svg>"#,
      },
      Piece {
        name: "Open hat",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5c3-3 15-3 18 0"></path><path d="M3 12c3 3 15 3 18 0"></path><path d="M12 14.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Low tom",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6.5" rx="8" ry="3"></ellipse><path d="M4 6.5v10c0 1.7 3.6 3 8 3s8-1.3 8-3v-10"></path></svg>"#,
      },
      Piece {
        name: "Clap",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"></path><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>"#,
      },
      Piece {
        name: "High tom",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="5.5" ry="2.2"></ellipse><path d="M6.5 9v5.5c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V9"></path></svg>"#,
      },
      Piece {
        name: "Ride",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10.5c3-1.6 17-1.6 20 0"></path><path d="M9.5 9.3c0-1.6 5-1.6 5 0"></path><path d="M12 10.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Sticks",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21L16 5"></path><path d="M20 21L8 5"></path><path d="M10.5 3.5l1.5 1.5 1.5-1.5"></path></svg>"#,
      },
      Piece {
        name: "Crash",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="8" rx="9.5" ry="2.5" transform="rotate(-14 12 8)"></ellipse><path d="M12 10.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Ride bell",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12.5c3-1.6 17-1.6 20 0"></path><path d="M8.5 11.3c0-3.2 7-3.2 7 0"></path><path d="M12 12.5V21"></path><path d="M8 21h8"></path><path d="M17 4.5l2-2M19.5 7.5H22"></path></svg>"#,
      },
      Piece {
        name: "Cowbell",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>"#,
      },
      Piece {
        name: "Kick",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="11" r="8"></circle><circle cx="12" cy="11" r="2.5"></circle><path d="m7 18-2 4"></path><path d="m17 18 2 4"></path></svg>"#,
      },
      Piece {
        name: "Closed hat",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10c3-3.5 15-3.5 18 0-3 3.5-15 3.5-18 0z"></path><path d="M12 13v8"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Snare",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 8 8"></path><path d="m22 2-8 8"></path><ellipse cx="12" cy="9" rx="10" ry="5"></ellipse><path d="M7 13.4v7.9"></path><path d="M12 14v8"></path><path d="M17 13.4v7.9"></path><path d="M2 9v8a10 5 0 0 0 20 0V9"></path></svg>"#,
      },
      Piece {
        name: "Open hat",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5c3-3 15-3 18 0"></path><path d="M3 12c3 3 15 3 18 0"></path><path d="M12 14.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Low tom",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6.5" rx="8" ry="3"></ellipse><path d="M4 6.5v10c0 1.7 3.6 3 8 3s8-1.3 8-3v-10"></path></svg>"#,
      },
      Piece {
        name: "Clap",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"></path><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>"#,
      },
      Piece {
        name: "High tom",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="5.5" ry="2.2"></ellipse><path d="M6.5 9v5.5c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V9"></path></svg>"#,
      },
      Piece {
        name: "Ride",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10.5c3-1.6 17-1.6 20 0"></path><path d="M9.5 9.3c0-1.6 5-1.6 5 0"></path><path d="M12 10.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Sticks",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21L16 5"></path><path d="M20 21L8 5"></path><path d="M10.5 3.5l1.5 1.5 1.5-1.5"></path></svg>"#,
      },
      Piece {
        name: "Crash",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="8" rx="9.5" ry="2.5" transform="rotate(-14 12 8)"></ellipse><path d="M12 10.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Ride bell",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12.5c3-1.6 17-1.6 20 0"></path><path d="M8.5 11.3c0-3.2 7-3.2 7 0"></path><path d="M12 12.5V21"></path><path d="M8 21h8"></path><path d="M17 4.5l2-2M19.5 7.5H22"></path></svg>"#,
      },
      Piece {
        name: "Cowbell",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>"#,
      },
    ]),
  },
  Preset {
    name: "808 kit",
    engine: "Strike",
    octaves: (0, 0),
    params: &[
      Param {
        name: "Hardness",
        step: 6,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Position",
        step: 3,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Strength",
        step: 8,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Click",
        step: 5,
        values: &[
          "0.00×", "0.20×", "0.40×", "0.60×", "0.80×", "1.00×", "1.20×", "1.40×", "1.60×", "1.80×",
          "2.00×",
        ],
      },
      Param {
        name: "Tune",
        step: 5,
        values: &[
          "-12.0 st", "-9.6 st", "-7.2 st", "-4.8 st", "-2.4 st", "0.0 st", "+2.4 st", "+4.8 st",
          "+7.2 st", "+9.6 st", "+12.0 st",
        ],
      },
      Param {
        name: "Decay",
        step: 5,
        values: &[
          "0.25×", "0.33×", "0.44×", "0.57×", "0.76×", "1.00×", "1.32×", "1.74×", "2.30×", "3.03×",
          "4.00×",
        ],
      },
      Param {
        name: "Pitch drop",
        step: 5,
        values: &[
          "0.00×", "0.20×", "0.40×", "0.60×", "0.80×", "1.00×", "1.20×", "1.40×", "1.60×", "1.80×",
          "2.00×",
        ],
      },
      Param {
        name: "Snare wires",
        step: 7,
        values: &[
          "0.00×", "0.15×", "0.30×", "0.45×", "0.60×", "0.75×", "0.90×", "1.00×", "1.20×", "1.35×",
          "1.50×",
        ],
      },
      Param {
        name: "Cutoff",
        step: 10,
        values: &[
          "200 Hz", "317 Hz", "502 Hz", "796 Hz", "1.3 kHz", "2.0 kHz", "3.2 kHz", "5.0 kHz",
          "8.0 kHz", "13 kHz", "20 kHz",
        ],
      },
      Param {
        name: "Resonance",
        step: 0,
        values: &[
          "3%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Width",
        step: 7,
        values: &[
          "0.00×", "0.15×", "0.30×", "0.45×", "0.60×", "0.75×", "0.90×", "1.00×", "1.20×", "1.35×",
          "1.50×",
        ],
      },
      Param {
        name: "Tone",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Level",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Reverb send",
        step: 1,
        values: &[
          "0%", "8%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
    ],
    pieces: Some(&[
      Piece {
        name: "Kick",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="11" r="8"></circle><circle cx="12" cy="11" r="2.5"></circle><path d="m7 18-2 4"></path><path d="m17 18 2 4"></path></svg>"#,
      },
      Piece {
        name: "Closed hat",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10c3-3.5 15-3.5 18 0-3 3.5-15 3.5-18 0z"></path><path d="M12 13v8"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Snare",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 8 8"></path><path d="m22 2-8 8"></path><ellipse cx="12" cy="9" rx="10" ry="5"></ellipse><path d="M7 13.4v7.9"></path><path d="M12 14v8"></path><path d="M17 13.4v7.9"></path><path d="M2 9v8a10 5 0 0 0 20 0V9"></path></svg>"#,
      },
      Piece {
        name: "Open hat",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5c3-3 15-3 18 0"></path><path d="M3 12c3 3 15 3 18 0"></path><path d="M12 14.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Low tom",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6.5" rx="8" ry="3"></ellipse><path d="M4 6.5v10c0 1.7 3.6 3 8 3s8-1.3 8-3v-10"></path></svg>"#,
      },
      Piece {
        name: "Clap",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"></path><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>"#,
      },
      Piece {
        name: "High tom",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="5.5" ry="2.2"></ellipse><path d="M6.5 9v5.5c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V9"></path></svg>"#,
      },
      Piece {
        name: "Side stick",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="15" rx="9" ry="3.5"></ellipse><path d="M3 15v3a9 3.5 0 0 0 18 0v-3"></path><path d="M5 6l14 9"></path></svg>"#,
      },
      Piece {
        name: "Sticks",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21L16 5"></path><path d="M20 21L8 5"></path><path d="M10.5 3.5l1.5 1.5 1.5-1.5"></path></svg>"#,
      },
      Piece {
        name: "Crash",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="8" rx="9.5" ry="2.5" transform="rotate(-14 12 8)"></ellipse><path d="M12 10.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Open hat",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5c3-3 15-3 18 0"></path><path d="M3 12c3 3 15 3 18 0"></path><path d="M12 14.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Cowbell",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>"#,
      },
      Piece {
        name: "Kick",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="11" r="8"></circle><circle cx="12" cy="11" r="2.5"></circle><path d="m7 18-2 4"></path><path d="m17 18 2 4"></path></svg>"#,
      },
      Piece {
        name: "Closed hat",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10c3-3.5 15-3.5 18 0-3 3.5-15 3.5-18 0z"></path><path d="M12 13v8"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Snare",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 8 8"></path><path d="m22 2-8 8"></path><ellipse cx="12" cy="9" rx="10" ry="5"></ellipse><path d="M7 13.4v7.9"></path><path d="M12 14v8"></path><path d="M17 13.4v7.9"></path><path d="M2 9v8a10 5 0 0 0 20 0V9"></path></svg>"#,
      },
      Piece {
        name: "Open hat",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5c3-3 15-3 18 0"></path><path d="M3 12c3 3 15 3 18 0"></path><path d="M12 14.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Low tom",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6.5" rx="8" ry="3"></ellipse><path d="M4 6.5v10c0 1.7 3.6 3 8 3s8-1.3 8-3v-10"></path></svg>"#,
      },
      Piece {
        name: "Clap",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"></path><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>"#,
      },
      Piece {
        name: "High tom",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="5.5" ry="2.2"></ellipse><path d="M6.5 9v5.5c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V9"></path></svg>"#,
      },
      Piece {
        name: "Side stick",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="15" rx="9" ry="3.5"></ellipse><path d="M3 15v3a9 3.5 0 0 0 18 0v-3"></path><path d="M5 6l14 9"></path></svg>"#,
      },
      Piece {
        name: "Sticks",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21L16 5"></path><path d="M20 21L8 5"></path><path d="M10.5 3.5l1.5 1.5 1.5-1.5"></path></svg>"#,
      },
      Piece {
        name: "Crash",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="8" rx="9.5" ry="2.5" transform="rotate(-14 12 8)"></ellipse><path d="M12 10.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Open hat",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5c3-3 15-3 18 0"></path><path d="M3 12c3 3 15 3 18 0"></path><path d="M12 14.5V21"></path><path d="M8 21h8"></path></svg>"#,
      },
      Piece {
        name: "Cowbell",
        face: r#"<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>"#,
      },
    ]),
  },
  Preset {
    name: "Madal",
    engine: "Strike",
    octaves: (0, 0),
    params: &[
      Param {
        name: "Hardness",
        step: 6,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Position",
        step: 3,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Strength",
        step: 8,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Click",
        step: 5,
        values: &[
          "0.00×", "0.20×", "0.40×", "0.60×", "0.80×", "1.00×", "1.20×", "1.40×", "1.60×", "1.80×",
          "2.00×",
        ],
      },
      Param {
        name: "Tune",
        step: 5,
        values: &[
          "-12.0 st", "-9.6 st", "-7.2 st", "-4.8 st", "-2.4 st", "0.0 st", "+2.4 st", "+4.8 st",
          "+7.2 st", "+9.6 st", "+12.0 st",
        ],
      },
      Param {
        name: "Decay",
        step: 5,
        values: &[
          "0.25×", "0.33×", "0.44×", "0.57×", "0.76×", "1.00×", "1.32×", "1.74×", "2.30×", "3.03×",
          "4.00×",
        ],
      },
      Param {
        name: "Pitch drop",
        step: 5,
        values: &[
          "0.00×", "0.20×", "0.40×", "0.60×", "0.80×", "1.00×", "1.20×", "1.40×", "1.60×", "1.80×",
          "2.00×",
        ],
      },
      Param {
        name: "Snare wires",
        step: 7,
        values: &[
          "0.00×", "0.15×", "0.30×", "0.45×", "0.60×", "0.75×", "0.90×", "1.00×", "1.20×", "1.35×",
          "1.50×",
        ],
      },
      Param {
        name: "Cutoff",
        step: 10,
        values: &[
          "200 Hz", "317 Hz", "502 Hz", "796 Hz", "1.3 kHz", "2.0 kHz", "3.2 kHz", "5.0 kHz",
          "8.0 kHz", "13 kHz", "20 kHz",
        ],
      },
      Param {
        name: "Resonance",
        step: 0,
        values: &[
          "3%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Width",
        step: 7,
        values: &[
          "0.00×", "0.15×", "0.30×", "0.45×", "0.60×", "0.75×", "0.90×", "1.00×", "1.20×", "1.35×",
          "1.50×",
        ],
      },
      Param {
        name: "Tone",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Level",
        step: 5,
        values: &[
          "0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
      Param {
        name: "Reverb send",
        step: 2,
        values: &[
          "0%", "10%", "15%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%",
        ],
      },
    ],
    pieces: Some(&[
      Piece {
        name: "Dhin",
        face: r#"Dhin"#,
      },
      Piece {
        name: "Ti",
        face: r#"Ti"#,
      },
      Piece {
        name: "Ta",
        face: r#"Ta"#,
      },
      Piece {
        name: "Ka",
        face: r#"Ka"#,
      },
      Piece {
        name: "Tin",
        face: r#"Tin"#,
      },
      Piece {
        name: "Ti",
        face: r#"Ti"#,
      },
      Piece {
        name: "Ta",
        face: r#"Ta"#,
      },
      Piece {
        name: "Dha",
        face: r#"Dha"#,
      },
      Piece {
        name: "Ti",
        face: r#"Ti"#,
      },
      Piece {
        name: "Tin",
        face: r#"Tin"#,
      },
      Piece {
        name: "Ti",
        face: r#"Ti"#,
      },
      Piece {
        name: "Ka",
        face: r#"Ka"#,
      },
      Piece {
        name: "Dhin",
        face: r#"Dhin"#,
      },
      Piece {
        name: "Ti",
        face: r#"Ti"#,
      },
      Piece {
        name: "Ta",
        face: r#"Ta"#,
      },
      Piece {
        name: "Ka",
        face: r#"Ka"#,
      },
      Piece {
        name: "Tin",
        face: r#"Tin"#,
      },
      Piece {
        name: "Ti",
        face: r#"Ti"#,
      },
      Piece {
        name: "Ta",
        face: r#"Ta"#,
      },
      Piece {
        name: "Dha",
        face: r#"Dha"#,
      },
      Piece {
        name: "Ti",
        face: r#"Ti"#,
      },
      Piece {
        name: "Tin",
        face: r#"Tin"#,
      },
      Piece {
        name: "Ti",
        face: r#"Ti"#,
      },
      Piece {
        name: "Ka",
        face: r#"Ka"#,
      },
    ]),
  },
];
