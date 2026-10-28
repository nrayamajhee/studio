---
order = 1
---

# Sound pipeline

How a note gets from a key press to the speakers: the audio thread the engine runs on, its render loop, and the signal flow from each voice to the output. What each voice models is in [Physical modeling](physical-modeling/overview.md). All the code lives in `web-react/app/lib/physical/`.

- [Voices and modules](voices-and-modules.md): the voice lifecycle, and the filter and vibrato every voice carries.
- [Master effects](master-effects.md): the ADSR, LFO and FX over every instrument.
- [Parameters and calibration](parameters-and-calibration.md): the params, tuning and loudness, the checks, and adding a patch or a Device preset.

## The audio thread

The audio is computed on the browser's audio thread, inside one `AudioWorkletProcessor`. The UI only sends small messages.

![The main thread (SynthDevice, deviceEngine, physicalSynth) posts events to the audio thread, where PhysicalSynthProcessor runs the Engine every 128 frames and posts stats back every 0.25 s; its output goes through the browser limiter, the analyser and the volume to the speakers](../../web-react/public/docs/synth-engine/diagram-threads.svg)

- **Lazy boot.** `physicalSynth.start()` runs on the first user gesture (browsers need that to allow audio). It creates the `AudioContext`, loads `processor.worklet.ts` and waits for a `ready` message. Nothing touches Web Audio at import time, so prerendering the page is safe.
- **Nothing is lost while booting.** Events sent before `ready` are queued and replayed immediately, so the very first key press still sounds, just late. For `param` events only the latest value per target/id is kept.
- **Timing.** Events carry an optional `time` in AudioContext seconds. With no time, they play at the start of the next block (at most ~2.7 ms at 48 kHz).
- **API.** `physicalSynth` (from `web-react/app/lib/physical`): `start()` from a user gesture, `noteOn`/`noteOff` (reference-counted per note), `hit`, `setSustain`, `metronomeTick`, `setParam`, `allNotesOff`, `getAnalyser`, `onStats`, `render` (events offline through the worklet) and `scrubber` (plays a rendered buffer at a drag's speed, tape-style). Events sent before the worklet is ready are queued.

## The render loop

`Engine.render()` never allocates memory: every buffer, voice and delay line is preallocated. Events are applied at their **exact sample**, because the block is cut into segments at each event:

![A 128-frame block is cut into segments at a noteOn at frame 37 and a cutoff change at frame 90; then once per block each bus finishes, the reverb runs, the LFO and FX process the master, and the level, limiter and clipper run](../../web-react/public/docs/synth-engine/diagram-render-loop.svg)

`EventQueue` is a preallocated array kept sorted by frame. Events at the same frame keep their arrival order, so a chord's notes and a param change sent together land in order.

## Signal flow

Each instrument owns one **bus**. Its voices add their panned output into the bus buffers, and the bus stage then finishes the sound:

![Voices pan into their instrument bus, then body, drive and output gain and level; a mono send feeds the shared FDN reverb; the master runs through the LFO and FX, adds the reverb return and the dry metronome, then the level, peak limiter and safety clipper](../../web-react/public/docs/synth-engine/diagram-signal-flow.svg)

- **Output.** The Output page draws the bus's drive curve, a wave through it, and how much goes to the mix and to the reverb.

  ![The picked electric guitar's Output page: the drive curve at 35%, a sine squared off by it, level 50% to the mix and 15% to the reverb](../../web-react/public/docs/synth-engine/screen-output-electric.webp)

- **Idle buses cost nothing.** After its last voice ends, a bus keeps running for 0.5 s so the body can ring out, then it is skipped entirely.
- **Master effects.** Every voice goes through the master ADSR, and the dry mix through the master LFO and FX before the reverb return is added: see [Master effects](master-effects.md).
- **No zipper noise.** Gain, send, drive, volume, reverb return and the LFO and FX amounts glide through `Smoother`s (~10 ms one-pole).
- **Why two limiters?** A chord's hammers or plucks land on the same sample, so their transients stack almost fully: a piano triad at the default level peaks about 6 dB over −3 dBFS. Those sub-millisecond peaks are too fast for the browser's compressor. The engine's look-ahead limiter (`dsp/PeakLimiter.ts`) sees each peak 1.5 ms early and ramps the gain down to meet it, so the chord is turned down for a moment instead of squashed; below the ceiling it only delays. It delays everything by those 1.5 ms. The tanh clipper behind it only catches what rounding lets through, and the browser's compressor still guards the track mixer and scrubber, which sum rendered buffers outside the engine.
- **Level and volume.** The master level (`master.volume`) is applied before the limiter, so it sets how hard chords push into it. The Device's white knob is a system volume after the browser limiter and analyser, so turning it up never clips.

## Reverb (`dsp/Fdn.ts`)

One shared 8-line **feedback delay network**. Each instrument feeds it through its own Reverb send.

![The mono send goes through a 0–60 ms predelay and four allpass diffusers (3.1, 5.3, 8.9 and 12.7 ms) into eight damped delay lines, each scaled by its g, mixed by a lossless Householder matrix back into every line; even lines make the left output and odd lines the right](../../web-react/public/docs/synth-engine/diagram-reverb.svg)

- Every line loses exactly 60 dB in the Reverb decay time, whatever its length.
- The Householder matrix mixes every line into every other one at O(N) cost, so echoes smear into a dense tail.
- **Sleep.** After 0.5 s below −100 dBFS the reverb clears itself and stops computing, and it wakes on the next input.

## From key press to sound

![Pressing Z: SynthDevice.pressKey expands a chord, deviceEngine.noteOn adds the octave or maps a kit piece, physicalSynth.noteOn posts the event; on the audio thread Engine.schedule places it, StringInstrument.noteOn picks a voice, tunes and excites it, and the voice renders through the bus to the master](../../web-react/public/docs/synth-engine/diagram-key-to-sound.svg)
