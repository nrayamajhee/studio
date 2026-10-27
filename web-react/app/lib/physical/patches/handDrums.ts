import { drumParams } from "./params";
import type { DrumKitPatch } from "./types";

// Hand drums with pasted heads (tabla syahi, madal kharee): the paste tunes a
// head's modes near 1, 2, 3, 4, 5 × its fundamental, so strokes ring with a
// pitch. Each stroke is its own set of partials: open strokes ring, rim
// strokes damp the fundamental, closed strokes are short slaps.
// Piece levels put each fortissimo hit at about −3 dBFS peak.

// Tabla: dayan (treble, C♯4) on the right, bayan (bass, G2) on the left.
export const tabla: DrumKitPatch = {
  id: "tabla",
  name: "Tabla",
  family: "drums",
  range: [0, 127],
  outputGain: 1,
  pan: { center: 0, spread: 0 },
  body: { type: "none" },
  params: drumParams(0.15),
  keys: [
    "dha",
    "te",
    "dhin",
    "te",
    "ke",
    "ge",
    "te",
    "na",
    "ke",
    "tin",
    "te",
    "tun",
  ],
  pieces: {
    // Rim of the dayan with the ring finger damping the head: bright, ringing
    // overtones over a quiet fundamental.
    na: {
      model: "loaded",
      f0: 277,
      partials: [
        [1, 0.25, 0.2],
        [2, 1.2, 1.0],
        [2.98, 0.9, 0.75],
        [4.02, 0.6, 0.5],
        [5, 0.4, 0.3],
        [6.3, 0.15, 0.15],
      ],
      stick: [0.8, 0.3],
      click: { highpass: 4000, length: 3, level: 0.15 },
      level: 0.5,
      pan: 0.15,
    },
    // Open stroke between the syahi and the rim: fundamental and overtones.
    tin: {
      model: "loaded",
      f0: 277,
      partials: [
        [1, 1.0, 0.9],
        [2, 0.9, 0.8],
        [2.98, 0.6, 0.45],
        [4.02, 0.4, 0.25],
        [5, 0.25, 0.15],
      ],
      stick: [1, 0.5],
      level: 0.652,
      pan: 0.15,
    },
    // Open stroke on the syahi: a long, round fundamental.
    tun: {
      model: "loaded",
      f0: 277,
      partials: [
        [1, 1.6, 1.0],
        [2, 0.6, 0.3],
        [2.98, 0.35, 0.12],
        [4.02, 0.2, 0.06],
      ],
      stick: [1.6, 0.8],
      level: 1.045,
      pan: 0.15,
    },
    // Closed slap on the syahi.
    te: {
      model: "loaded",
      f0: 277,
      partials: [
        [1, 0.06, 1.0],
        [2, 0.05, 0.6],
        [2.98, 0.04, 0.4],
        [4.3, 0.03, 0.3],
      ],
      stick: [0.6, 0.3],
      click: { highpass: 2000, length: 6, level: 0.5 },
      level: 0.574,
      pan: 0.15,
    },
    // Open bayan: a deep boom whose pitch settles as the head relaxes.
    ge: {
      model: "loaded",
      f0: 98,
      partials: [
        [1, 0.9, 1.0],
        [1.58, 0.45, 0.35],
        [2.1, 0.3, 0.25],
        [2.65, 0.2, 0.12],
      ],
      pitchDrop: 0.15,
      pitchTau: 150,
      stick: [2.5, 1.2],
      level: 0.757,
      pan: -0.2,
    },
    // Flat-hand slap on the bayan.
    ke: {
      model: "loaded",
      f0: 98,
      partials: [
        [1, 0.05, 1.0],
        [1.58, 0.04, 0.6],
        [2.3, 0.03, 0.4],
      ],
      stick: [1, 0.5],
      click: { highpass: 800, length: 8, level: 0.6 },
      level: 0.594,
      pan: -0.2,
    },
    dha: { model: "combo", pieces: ["na", "ge"], level: 0.75 },
    dhin: { model: "combo", pieces: ["tin", "ge"], level: 0.75 },
  },
};

// Madal (Nepal): one barrel, a treble head (E4) and a bass head (A2) at
// either end, played with both hands.
export const madal: DrumKitPatch = {
  id: "madal",
  name: "Madal",
  family: "drums",
  range: [0, 127],
  outputGain: 1,
  pan: { center: 0, spread: 0 },
  body: { type: "none" },
  params: drumParams(0.15),
  keys: [
    "dha",
    "ti",
    "tin",
    "ti",
    "ka",
    "dhin",
    "ti",
    "ta",
    "ka",
    "tin",
    "ti",
    "ta",
  ],
  pieces: {
    // Open bass head: a round boom with a slight pitch settle.
    dhin: {
      model: "loaded",
      f0: 110,
      partials: [
        [1, 0.8, 1.0],
        [2, 0.5, 0.45],
        [3, 0.3, 0.2],
        [3.9, 0.2, 0.1],
      ],
      pitchDrop: 0.08,
      pitchTau: 60,
      stick: [2.5, 1.2],
      level: 0.879,
      pan: -0.25,
    },
    // Closed slap on the bass head.
    ka: {
      model: "loaded",
      f0: 110,
      partials: [
        [1, 0.06, 1.0],
        [2, 0.05, 0.5],
        [3.1, 0.04, 0.3],
      ],
      stick: [1.2, 0.6],
      click: { highpass: 1000, length: 7, level: 0.5 },
      level: 0.698,
      pan: -0.25,
    },
    // Open treble head: a bright ring.
    ta: {
      model: "loaded",
      f0: 330,
      partials: [
        [1, 0.6, 0.9],
        [2, 0.55, 0.8],
        [3, 0.4, 0.5],
        [4, 0.3, 0.3],
        [5, 0.2, 0.15],
      ],
      stick: [1, 0.4],
      level: 0.659,
      pan: 0.25,
    },
    // Treble rim with the fundamental damped: higher, glassier ring.
    tin: {
      model: "loaded",
      f0: 330,
      partials: [
        [1, 0.2, 0.25],
        [2, 0.7, 1.0],
        [3, 0.5, 0.7],
        [4, 0.35, 0.45],
        [5.1, 0.2, 0.2],
      ],
      stick: [0.7, 0.3],
      click: { highpass: 4000, length: 3, level: 0.12 },
      level: 0.561,
      pan: 0.25,
    },
    // Closed slap on the treble head.
    ti: {
      model: "loaded",
      f0: 330,
      partials: [
        [1, 0.05, 1.0],
        [2, 0.04, 0.6],
        [3, 0.03, 0.4],
      ],
      stick: [0.6, 0.3],
      click: { highpass: 2500, length: 5, level: 0.45 },
      level: 0.706,
      pan: 0.25,
    },
    dha: { model: "combo", pieces: ["ta", "dhin"], level: 0.733 },
  },
};
