import { INITIAL_LEVEL_STEP } from "../../providers/OutputProvider";
import {
  DEVICE_PRESETS,
  KNOB_STEPS,
  findPreset,
  presetValues,
  type DevicePreset,
  type DeviceSound,
} from "./deviceEngine";
import { DRUM_BEATS, beatPattern } from "./drumBeats";
import { patternTake } from "./drumPattern";
import { INITIAL_MODULES, type ModuleSettings } from "./modules";
import { METERS, type Take, type Timing } from "./noteRecorder";
import { DEFAULT_PLAY_STYLE, type PlayStyleId } from "./playStyles";
import { PROGRESSIONS, progressionTake } from "./progressions";
import type { Tape } from "./sessionStore";
import { makeTrack, type TrackSource } from "./tracks";

// Starter 1, the song a first visit opens on and the one the Make a song
// guide builds, at 96 BPM: the Suspended progression (Isus4 I Isus2 I) with D
// as home in a folk strum on the oscillator's plain sine, three times round;
// the New jack swing beat from the third bar to a bar past the end; and over
// the middle round, once, the same strum with a saw under the sine.
const TIMING: Timing = { bpm: 96, meter: METERS[2], perBeat: 0 };
// D above middle C, the key the guide has you press for the home note.
const HOME = 62;
// How many times the progression goes round.
const ROUNDS = 3;
// How many bars the beat waits before it comes in, and plays on after the
// chords end.
const DRUMS_IN = 2;
const DRUMS_OUT = 1;
// The second oscillator's Synth settings: a saw at half level under the sine,
// 216° behind it.
const SINE_AND_SAW = { "exciter.wave2": 4, "exciter.phase": 216 };

// Starter 2, at 92 BPM: Homecoming (I IV I IV V IV Isus4 Isus2) with A as
// home, folk-strummed three times round on the oscillator as a triangle over
// a square; the beat from the third bar to the end; the bass guitar's up-down
// arpeggio four times round from bar 9; and the fingerstyle electric's
// Alberti twice from bar 17, through drive, chorus and a little delay. Every
// track follows the tape's tempo.
const TIMING_2: Timing = { bpm: 92, meter: METERS[2], perBeat: 0 };
// A below middle C.
const HOME_2 = 57;
// Wave 1 a triangle, Wave 2 a square at 40%, 252° behind it.
const TRIANGLE_AND_SQUARE = {
  "exciter.wave": 1,
  "exciter.wave2": 3,
  "exciter.level2": 0.4,
  "exciter.phase": 252,
};
// FX on, its knobs on drive 4, chorus 10, delay 1 and reverb 6 (of 10).
const ELECTRIC_FX: ModuleSettings = {
  on: { ...INITIAL_MODULES.on, fx: true },
  steps: { ...INITIAL_MODULES.steps, fx: [4, 10, 1, 6] },
};

// A preset's sound as the Device plays it at first: its own values at the
// synth's starting level, the ADSR, LFO and FX off (makeTrack adds those).
const soundOf = (
  preset: DevicePreset,
  edits: Readonly<Record<string, number>> = {},
): DeviceSound => ({
  target: preset.target,
  octave: preset.octave,
  overrides: {
    [preset.target]: { ...presetValues(preset), ...edits },
    master: { "master.volume": INITIAL_LEVEL_STEP / (KNOB_STEPS - 1) },
  },
});

// A take kept as a track on `preset`, coloured as the `count`th, at the top
// of the timeline.
const kept = (
  count: number,
  preset: DevicePreset,
  take: Take,
  sound: DeviceSound,
  timing: Timing,
  source: TrackSource = "roll",
  modules: ModuleSettings = INITIAL_MODULES,
) =>
  makeTrack(
    count,
    preset.name,
    take,
    preset.id,
    sound,
    modules,
    timing,
    source,
  );

const progression = (id: string) =>
  PROGRESSIONS.find((candidate) => candidate.id === id) ?? PROGRESSIONS[0];

// A progression on `home` in a play style, a chord to each bar of eighths.
const played = (id: string, home: number, timing: Timing, style: PlayStyleId) =>
  progressionTake(progression(id), home, timing, {
    ...DEFAULT_PLAY_STYLE,
    id: style,
    perBeat: 2,
  });

// The New jack swing beat as a track, at `timing`'s tempo with its swing.
function beatTrack(count: number, timing: Timing) {
  const newJackSwing =
    DRUM_BEATS.find((beat) => beat.id === "newJackSwing") ?? DRUM_BEATS[0];
  const pattern = beatPattern(newJackSwing);
  const kit =
    DEVICE_PRESETS.find(({ target }) => target === newJackSwing.kit) ??
    DEVICE_PRESETS[0];
  return {
    swing: newJackSwing.swing,
    bars: pattern.bars,
    track: kept(
      count,
      kit,
      patternTake(pattern, newJackSwing.kit, timing.meter, timing.bpm),
      soundOf(kit),
      { ...timing, perBeat: pattern.perBeat, swing: newJackSwing.swing },
      "drumGrid",
    ),
  };
}

function starterOne(): Tape {
  const beats = TIMING.meter.beats;
  const strum = played("suspended", HOME, TIMING, "folkStrum");
  const roundBars = progression("suspended").chords.length;
  const oscillator = findPreset("oscillator");
  const beat = beatTrack(1, TIMING);
  const songBars = ROUNDS * roundBars;

  return {
    id: "tape-starter-1",
    name: "Starter 1",
    bpm: TIMING.bpm,
    meter: TIMING.meter,
    // The beat's, as loading it into the drum grid leaves it.
    swing: beat.swing,
    tracks: [
      {
        ...kept(0, oscillator, strum, soundOf(oscillator), TIMING),
        id: "starter-oscillator",
        repeats: ROUNDS,
      },
      {
        ...beat.track,
        id: "starter-drums",
        start: DRUMS_IN * beats,
        repeats: Math.ceil((songBars + DRUMS_OUT - DRUMS_IN) / beat.bars),
      },
      {
        // Saved after the beat, with its swing.
        ...kept(2, oscillator, strum, soundOf(oscillator, SINE_AND_SAW), {
          ...TIMING,
          swing: beat.swing,
        }),
        id: "starter-sine-and-saw",
        start: roundBars * beats,
      },
    ],
  };
}

function starterTwo(): Tape {
  const bar = (n: number) => (n - 1) * TIMING_2.meter.beats;
  const beat = beatTrack(0, TIMING_2);
  const timing = { ...TIMING_2, swing: beat.swing };
  const oscillator = findPreset("oscillator");
  const electric = findPreset("electricFinger");
  const bass = findPreset("bass");

  // Coloured as they were saved, the electric like the oscillator.
  return {
    id: "tape-starter-2",
    name: "Starter 2",
    bpm: TIMING_2.bpm,
    meter: TIMING_2.meter,
    swing: beat.swing,
    tracks: [
      {
        ...beat.track,
        id: "starter-2-drums",
        followTape: true,
        start: bar(3),
        // To the bass's last bar, 40.
        repeats: 38,
      },
      {
        ...kept(
          2,
          oscillator,
          played("homecoming", HOME_2, timing, "folkStrum"),
          soundOf(oscillator, TRIANGLE_AND_SQUARE),
          timing,
        ),
        id: "starter-2-oscillator",
        followTape: true,
        volume: 0.8,
        repeats: 3,
      },
      {
        ...kept(
          2,
          electric,
          played("homecoming", HOME_2, timing, "alberti"),
          soundOf(electric),
          timing,
          "roll",
          ELECTRIC_FX,
        ),
        id: "starter-2-electric",
        followTape: true,
        start: bar(17),
        volume: 0.7,
        repeats: 2,
      },
      {
        ...kept(
          3,
          bass,
          played("homecoming", HOME_2, timing, "upDown"),
          soundOf(bass),
          timing,
        ),
        id: "starter-2-bass",
        followTape: true,
        start: bar(9),
        repeats: 4,
      },
    ],
  };
}

// The tapes a first visit holds, Starter 1 open.
export const starterTapes = (): Tape[] => [starterOne(), starterTwo()];
