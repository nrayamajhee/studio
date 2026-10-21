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
import { INITIAL_MODULES } from "./modules";
import { METERS, type Timing } from "./noteRecorder";
import { DEFAULT_PLAY_STYLE } from "./playStyles";
import { PROGRESSIONS, progressionTake } from "./progressions";
import type { Tape } from "./sessionStore";
import { makeTrack, type Track } from "./tracks";

// The song a first visit opens on, and the one the Make a song guide builds,
// at 96 BPM: the Suspended progression (Isus4 I Isus2 I) with D as home in a
// folk strum on the oscillator, three times round; the New jack swing beat
// from the second bar to the end; and over the middle round, once, the same
// strum on the oscillator with a saw under its sine.
const TIMING: Timing = { bpm: 96, meter: METERS[2], perBeat: 0 };
// D above middle C, the key the guide has you press for the home note.
const HOME = 62;
// How many times the progression goes round.
const ROUNDS = 3;
// How many bars the beat waits before it comes in.
const DRUMS_IN = 1;
// The second oscillator's Synth settings: Wave 2 on Saw (Wave 1 stays a
// Sine), 216° behind it.
const SINE_AND_SAW = { "exciter.wave2": 4, "exciter.phase": 216 };

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

// The starter song as a tape with `id`.
export function starterTape(id: string): Tape {
  const beats = TIMING.meter.beats;
  const suspended =
    PROGRESSIONS.find((progression) => progression.id === "suspended") ??
    PROGRESSIONS[0];
  const strum = progressionTake(suspended, HOME, TIMING, {
    ...DEFAULT_PLAY_STYLE,
    id: "folkStrum",
    perBeat: 2,
  });
  const roundBars = suspended.chords.length;
  const oscillator = findPreset("oscillator");
  const strummed = (
    count: number,
    trackId: string,
    sound: DeviceSound,
  ): Track => ({
    ...makeTrack(
      count,
      oscillator.name,
      strum,
      oscillator.id,
      sound,
      INITIAL_MODULES,
      TIMING,
      "roll",
    ),
    id: trackId,
  });

  const newJackSwing =
    DRUM_BEATS.find((beat) => beat.id === "newJackSwing") ?? DRUM_BEATS[0];
  const pattern = beatPattern(newJackSwing);
  const kit =
    DEVICE_PRESETS.find(({ target }) => target === newJackSwing.kit) ??
    DEVICE_PRESETS[0];
  const songBars = ROUNDS * roundBars;
  const drums: Track = {
    ...makeTrack(
      1,
      kit.name,
      patternTake(pattern, newJackSwing.kit, TIMING.meter, TIMING.bpm),
      kit.id,
      soundOf(kit),
      INITIAL_MODULES,
      { ...TIMING, perBeat: pattern.perBeat, swing: newJackSwing.swing },
      "drumGrid",
    ),
    id: "starter-drums",
    start: DRUMS_IN * beats,
    repeats: Math.ceil((songBars - DRUMS_IN) / pattern.bars),
  };

  return {
    id,
    name: "Starter song",
    bpm: TIMING.bpm,
    meter: TIMING.meter,
    // The beat's, as loading it into the drum grid leaves it.
    swing: newJackSwing.swing,
    tracks: [
      {
        ...strummed(0, "starter-oscillator", soundOf(oscillator)),
        repeats: ROUNDS,
      },
      drums,
      {
        ...strummed(
          2,
          "starter-sine-and-saw",
          soundOf(oscillator, SINE_AND_SAW),
        ),
        // Saved after the beat, with its swing.
        timing: { ...TIMING, swing: newJackSwing.swing },
        start: roundBars * beats,
      },
    ],
  };
}
