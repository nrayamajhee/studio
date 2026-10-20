---
order = 4
---

# Parameters and calibration

## Parameters

Every instrument publishes a list of `ParamSpec`s (`patches/params.ts`). The Lab builds its panel from that list, the Device's Synth screen displays it, and saved presets store it. Each spec is an id (`module.name`, such as `exciter.hardness`), a label, its module (or `master` for the engine's own), a range and default, and how to show it: a unit, a linear or log knob, and whether it waits under Advanced.

- **Modules.** Every instrument's params come in the same modules (`paramModules`), in the order they act on a note: the signal chain (Exciter, Resonator, Filter, Body, Output), with each of the instrument's own modulators after the stage it acts on. The envelope follows the exciter it drives (named Breath, Bow or Bellows), a string's resonator it damps (Damper), or the oscillator's filter it gates (Gate); the vibrato follows the filter, since everything it moves happens by then. So a flute reads Exciter · Breath · Resonator · Filter · Vibrato · Body · Output, a piano Exciter · Resonator · Damper · Filter · Vibrato · Body · Output. The Synth screen gives each its own page after an overview of the chain (see [The Device › Synth parameters](../the-device/screen-and-views.md#synth-parameters)), and the Lab a heading. An instrument skips the modules it doesn't have: the bars have no envelope, the oscillator no Resonator or Body, the kits no envelope or vibrato. The Exciter and Resonator are each model's own. The rest are built by the same helpers, so they carry the same ids, labels and ranges everywhere:

  | Module   | Params                                                                                                                                                         |
  | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Filter   | Cutoff, Resonance, Env amount, Env decay, Keytrack (`filterParams`; the kits have only Cutoff and Resonance, on the bus)                                       |
  | Envelope | Attack, Decay, Sustain, Release of the exciter: breath, bow, bellows (`adsrParams`); strings: Attack and Damper; the oscillator: its gate's Attack and Release |
  | Vibrato  | Rate, Shape, Delay, Pitch, Level, Filter (`vibratoParams`)                                                                                                     |
  | Body     | Size, Resonance, Tone, Mix (`bodyParams`); the violin's measured body is one Body knob, a kit's body its stereo Width and Tone                                 |
  | Output   | Drive (where there is one), Level, Reverb send (`outputParams`)                                                                                                |

  Away from its page, a label two modules share is led by its module (Filter Resonance, Body Resonance).

- **Knob mapping.** `fromUnit(spec, t)` maps 0–1 across the range, geometrically for log params. The Device's knobs have 11 steps: step `k` means `t = k / 10`.
- **When changes take effect.** On strings and winds, settings that shape the attack or tune the loop (hardness, position, decay, brightness, inharmonicity, breath) apply from the next note. Everything else changes notes that are already sounding: filter, body, drive, level, send, reverb, volume, the vibrato's rate, shape and depths, bow pressure and the drum controls; the vibrato's Delay applies from the next note. Values that would click if they jumped are smoothed.
- **Presets.** `deviceEngine.loadPreset` resets _every_ param of the instrument to its default or the preset's override, so settings never leak between presets. It only sends values that actually changed. Saved presets are a full snapshot of those values.

## Calibration and checks

- **Pitch.** Strings are in tune by construction, because the loop filters' delay is compensated at the fundamental. The winds, brass, free reeds and bowed strings use measured `tuningCents` tables per sample rate. Re-measure those after changing their loops.
- **Loudness.** Each patch's `outputGain` puts a mezzo-forte C4 at −14 LUFS momentary: the loudest 400 ms, K-weighted as ITU-R BS.1770 and EBU R128 meter it (`momentaryLoudness` in `offline/analysis.ts`). Matching that rather than an average over a second makes instruments sound equally loud: a pluck that strikes and fades against a bow that swells and holds. Drum pieces peak at −3 dBFS on a hard hit, or at their own `peak` (the Jazz Kit's brushed snare and sweep at −9).
- **Offline rendering.** `offline/renderEngine.ts` runs the same `Engine` in plain TypeScript (Node or browser). `offline/renderOffline.ts` renders through the real worklet in an `OfflineAudioContext`.
- **Diagnostics** (`offline/diagnostics.ts`, runnable from Storybook > Lab / Instrument Lab > Diagnostics):

  | Sweep                 | Checks                                                                                               |
  | --------------------- | ---------------------------------------------------------------------------------------------------- |
  | tuning                | every note within tolerance of its target pitch                                                      |
  | decay                 | string T60 matches the patch's table                                                                 |
  | stability             | loops never blow up across velocities and params                                                     |
  | loudness, drum levels | the calibration targets above                                                                        |
  | stress                | how much faster than real time a dense passage renders (sustained piano cluster, fast guitar strums) |
  | onset, lifecycle      | notes start on time; voices free themselves                                                          |

- **Audition and tune.** Storybook › `Lab/Instrument Lab`: pick an instrument, play it, tweak the generated parameter panel, and use **Copy patch JSON** to move tuned values into `patches/*.ts`.
- **Unit tests.** The engine's are among the [checks](../development/installation.md#checks).

## Adding to it

- **A patch.** Add a `patches/<name>.ts` (a `StringPatch`, `BorePatch`, `BowedPatch`, `ReedPatch`, `BarPatch`, `DrumKitPatch` or `OscillatorPatch` with a `ParamSpec` list from `patches/params.ts`), add its id to `messages.ts` and `PATCHES`, then calibrate with the Lab.
- **A Device preset.** Add an entry to `DEVICE_PRESETS` in `deviceEngine.ts` (target instrument, octave offset, optional param overrides) and a matching icon in `PRESET_ICONS`.
