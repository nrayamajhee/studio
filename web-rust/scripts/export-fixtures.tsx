// Writes web-rust/tests/fixtures.json: what web-react's own functions give
// for a spread of inputs, which `cargo test` checks the Rust port against
// (src/logic/parity.rs). Run from web-react after changing either:
//   npx tsx ../web-rust/scripts/export-fixtures.tsx
import { writeFileSync } from "node:fs";
import { PATCH_BY_ID } from "../../web-react/app/lib/physical/patches";
import {
  formatParam,
  stepToValue,
  valueToStep,
} from "../../web-react/app/lib/physical/patches/format";
import {
  DEVICE_PRESETS,
  KNOB_STEPS,
  presetPages,
} from "../../web-react/app/components/home/deviceEngine";
import {
  DRUM_BEATS,
  beatPattern,
  beatPreview,
} from "../../web-react/app/components/home/drumBeats";
import {
  carryNote,
  carryPattern,
  patternTake,
  takePattern,
} from "../../web-react/app/components/home/drumPattern";
import { mixToMidi } from "../../web-react/app/components/home/exportMix";
import { FlacEncoder } from "../../web-react/app/components/home/flac";
import {
  INITIAL_MODULES,
  moduleValues,
  modulesOf,
} from "../../web-react/app/components/home/modules";
import {
  METERS,
  timeline,
  type Take,
} from "../../web-react/app/components/home/noteRecorder";
import {
  PLAY_STYLES,
  chordNotes,
} from "../../web-react/app/components/home/playStyles";
import {
  PROGRESSIONS,
  progressionTake,
} from "../../web-react/app/components/home/progressions";
import { starterTapes } from "../../web-react/app/components/home/starterSong";
import {
  clipOf,
  cutToLoop,
  passOf,
  startsOf,
} from "../../web-react/app/components/home/tracks";
import { isKit } from "../../web-react/app/components/home/deviceEngine";
import { allPresets } from "../../web-react/app/components/home/presetStore";

const params = Object.values(PATCH_BY_ID).flatMap((patch) =>
  patch.params.map((spec) => {
    const steps = spec.options?.length ?? KNOB_STEPS;
    return {
      patch: patch.id,
      id: spec.id,
      steps: Array.from({ length: steps }, (_, step) => {
        const value = stepToValue(spec, step, steps);
        return [value, formatParam(spec, value)];
      }),
      defaultStep: valueToStep(spec, spec.default, steps),
      defaultText: formatParam(spec, spec.default),
    };
  }),
);

const take: Take = {
  notes: [
    { note: 60, start: 0, duration: 400, velocity: 0.8 },
    { note: 64, start: 333, duration: 250, velocity: 0.6 },
    { note: 67, start: 1250, duration: 900, velocity: 1 },
    { note: 72, start: 2450, duration: 700, velocity: 0.45 },
  ],
  length: 2600,
  bpm: 110,
};
const timings = [
  { bpm: 110, meter: METERS[2], perBeat: 0 },
  { bpm: 73, meter: METERS[1], perBeat: 0, swing: { amount: 66, perBeat: 2 } },
  { bpm: 140, meter: METERS[4], perBeat: 4, swing: { amount: 58, perBeat: 4 } },
  { bpm: 96, meter: METERS[6], perBeat: 3, swing: { amount: 70, perBeat: 2 } },
] as const;

const chords = [
  [60, 64, 67],
  [57, 60, 64, 67, 71],
  [48, 55],
];
const styles = PLAY_STYLES.flatMap(({ id }) =>
  [
    { id, perBeat: 2, strum: 20 },
    { id, perBeat: 3, strum: 60 },
  ].map((style) => ({
    style,
    notes: chords.map((midis) => chordNotes(midis, style, 187.5, 2000, 0.8)),
  })),
);

const progressions = PROGRESSIONS.map((progression, i) => {
  const timing = timings[i % timings.length];
  const style = {
    id: PLAY_STYLES[i % PLAY_STYLES.length].id,
    perBeat: 2,
    strum: 20,
  };
  return {
    id: progression.id,
    note: 50 + (i % 20),
    timing,
    style,
    take: progressionTake(progression, 50 + (i % 20), timing, style),
  };
});

const kits = ["drums", "madal", "tabla", "drums808"] as const;
const beats = DRUM_BEATS.map((beat, i) => {
  const pattern = beatPattern(beat);
  const kit = kits[i % kits.length];
  const carried = carryPattern(pattern, kit);
  return {
    id: beat.id,
    pattern,
    preview: beatPreview(beat, 100 + i),
    carried: { kit, pattern: carried },
    take: patternTake(carried, kit, beat.meter, 120),
    back: takePattern(
      patternTake(pattern, beat.kit, beat.meter, 97),
      beat.kit,
      { bpm: 97, meter: beat.meter, perBeat: beat.perBeat },
    ),
  };
});

const buses = ["piano", "drums", "madal", "tabla", "jazzDrums", "bass"];
const carries = buses.flatMap((from) =>
  buses.map((to) => ({
    from,
    to,
    notes: Array.from({ length: 128 }, (_, note) =>
      carryNote(note, from as never, to as never),
    ),
  })),
);

const tapes = starterTapes();
const tracks = tapes.flatMap((tape) =>
  tape.tracks.map((track, i) => {
    const looped = {
      ...track,
      loop: { start: 1 + i * 0.5, end: 3 + i, on: true },
    };
    const bpm = tape.bpm + i * 7;
    const pass = passOf(looped, bpm);
    return {
      id: track.id,
      bpm,
      pass,
      starts: startsOf(looped, pass, bpm, 64),
      clip: clipOf(looped, bpm),
      cut: cutToLoop(looped, bpm),
      whole: passOf(track, bpm),
    };
  }),
);

const modules = {
  ...INITIAL_MODULES,
  on: { adsr: true, lfo: false, fx: true },
  steps: { ...INITIAL_MODULES.steps, adsr: [0, 3, 7, 0], fx: [2, 4, 6, 8] },
};

const flac = new FlacEncoder(44100);
const length = 9000;
const left = new Float32Array(length);
const right = new Float32Array(length);
for (let i = 0; i < length; i++) {
  left[i] = 0.6 * Math.sin(i * 0.031) + 0.2 * Math.sin(i * 0.47);
  right[i] = i < 4096 ? left[i] : 0.25;
}
flac.push(left, right);
const flacBytes = new Uint8Array(await flac.finish().arrayBuffer());

const midi = new Uint8Array(
  await mixToMidi(
    [
      {
        name: "Piano",
        target: "piano",
        volume: 0.8,
        notes: take.notes,
      },
      {
        name: "Drums",
        target: "drums",
        volume: 1,
        notes: [
          { note: 36, start: 0, duration: 100, velocity: 1, piece: "kick" },
          {
            note: 38,
            start: 500,
            duration: 100,
            velocity: 0.5,
            piece: "snare",
          },
        ],
      },
    ],
    123,
    METERS[4],
    isKit,
  ).arrayBuffer(),
);

writeFileSync(
  new URL("../tests/fixtures.json", import.meta.url),
  JSON.stringify({
    params,
    take,
    timelines: timings.map((timing) => ({
      timing,
      timeline: timeline(take, timing),
    })),
    styles,
    chords,
    progressions,
    beats,
    carries,
    starterTapes: tapes,
    tracks,
    modules: {
      modules,
      values: moduleValues(modules),
      back: modulesOf({
        target: "piano",
        octave: 0,
        overrides: { master: moduleValues(modules) },
      }),
    },
    bands: presetPages(DEVICE_PRESETS, "band").items.map(({ id }) => id),
    allPresets: allPresets({
      instruments: [],
      buttons: [],
      shiftButtons: [],
      edits: {},
    }).map(({ id }) => id),
    flac: Array.from(flacBytes),
    flacInput: { length },
    midi: Array.from(midi),
  }),
);
