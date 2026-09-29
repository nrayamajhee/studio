# Physical-Modeling Synth Engine for The Device — Implementation Plan

> Written 2026-09-29 for a Claude Code session that will implement it. Read the whole document before writing code. The decisions in §1 were made with the user; do not reopen them. Numbers in §8 are starting points to be tuned by ear with the user and checked with the diagnostics in §10.

## TL;DR

Move The Device (`app/components/home/SynthDevice.tsx` and `useTransport.ts`) off the legacy subtractive engine (`app/lib/synth.ts`) and onto a new physical-modeling engine that runs entirely inside one TypeScript `AudioWorklet`. Every instrument is an **exciter → resonator → body** chain built from shared DSP parts:

| Family                      | Instruments         | Exciter                     | Resonator                                                        |
| --------------------------- | ------------------- | --------------------------- | ---------------------------------------------------------------- |
| Struck and plucked strings  | piano, guitar, bass | hammer, pick, finger        | digital waveguide string (extended Karplus-Strong)               |
| Struck membranes and metals | 9-piece drum kit    | stick, beater, hands        | modal resonator bank                                             |
| Blown                       | saxophone, flute    | breath + reed, breath + jet | waveguide bore with a nonlinear reed or jet in the feedback loop |

Standard modules on top of that: ADSR, a state-variable filter, LFO, an FDN reverb, a voice manager, and a master limiter. The Instrument Lab in Storybook lets the user audition and tune instruments, and its diagnostics panel lets you (Claude) check tuning, decay and stability without hearing audio. The last phase points the Device at the new engine through a small adapter (`app/components/home/deviceEngine.ts`). Only audio calls change; layout and visuals stay exactly as they are. `/studio` keeps using `app/lib/synth.ts`.

---

## 0. How to work through this plan

- Go phase by phase (§11). Every phase ends with the checks in §12. Most phases also end with a **listening checkpoint**: ask the user to audition in the Instrument Lab and give feedback before you move on. You can't hear audio, so never claim an instrument "sounds right". Report the diagnostics and ask.
- Before Phase 0: read `README.md` (`AGENTS.md` is a symlink to it), this plan, and the files listed in §2.
- Ask the Phase 0 questions before writing code.
- Commit only when the user asks. Before the first commit, create a branch (for example `feat/physical-synth`).
- The user decides on tests (AGENTS.md rule). §12 lists the recommended unit tests to propose.

## 1. Settled decisions

1. **Scope: The Device only.** The new engine replaces the Device's use of `app/lib/synth.ts` (in `SynthDevice.tsx` and `useTransport.ts`). `app/lib/synth.ts` itself stays, unchanged, because `/studio` still uses it. Do not modify `/studio` or anything it depends on: `app/routes/studio.tsx`, `app/lib/synth.ts`, `app/components/piano-roll/*`, `app/components/mixer/*`, `app/lib/midi.ts`, `app/lib/studioStorage.ts`, `app/lib/customPresets.ts`.
2. **Engine first, UI later.** Make no layout, visual or control changes to `SynthDevice.tsx`, `SynthKnob.tsx` or `SynthPad.tsx`. Phase 7 may change only their audio wiring (imports, engine calls, preset data). New controls such as per-section knobs come in a later design pass. For now, build the **Instrument Lab** (Storybook) as the audition and tuning surface.
3. **Architecture:** exciter → resonator physical modeling, in three families (above).
4. **Runtime:** all per-voice DSP, the bodies and the reverb run in **one `AudioWorkletProcessor` written in TypeScript**. No native Web Audio node sits inside a feedback loop: a `DelayNode` in a cycle is clamped to at least one render quantum (128 frames), which breaks tuning above about 375 Hz. Consider WASM only if the performance targets in §12 fail after profiling.
5. **Required standard modules:** ADSR, filter, reverb. Also in scope: LFO, voice manager, master limiter and analyser.
6. **Instrument set:** grand piano, acoustic steel-string guitar, 4-string fingered electric bass, alto saxophone, concert flute, and a 9-piece drum kit (Kick, Snare, Closed hat, Open hat, Clap, Low tom, High tom, Cowbell, Crash). These match the Device's six instrument pads (Piano, Guitar, Bass, Drums, Flute, Sax). There's also a woodblock click for the Device's metronome.

## 2. Current repo state (as of this writing)

**Stack:** React Router 8 in SPA mode (`ssr: false`) with prerendering, React 19, Vite 8, Tailwind 4, Storybook 10, TypeScript 5.9 strict with `verbatimModuleSyntax`.

**The home page is being rebuilt right now, in uncommitted changes that aren't yours.** While this plan was being written it changed engines twice: first to a small local oscillator engine (`synthVoice.ts`, since deleted), then to the legacy `app/lib/synth.ts`. **Re-read the files below before Phase 0 and again before Phase 7.** If they differ from this description, adapt the Phase 7 mapping (§11.1), never the UI. Snapshot as of 2026-09-29 ~01:00:

| File                                  | Role                                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/components/home/SynthDevice.tsx` | The Device: 4 stepped knobs, transport and recorder pads, 6 instrument pads + octave ←/→ + Shift, a 2-octave keybed (F3–E5) with held notes, 9 chord-macro pads, screen with preset name |
| `app/components/home/useTransport.ts` | Play/stop/record of keybed takes (tape or 16th-note sequencer at 120 BPM) and a metronome                                                                                                |
| `app/components/home/SynthKnob.tsx`   | Gear-edged 4-detent knob (click to turn)                                                                                                                                                 |
| `app/components/home/SynthPad.tsx`    | Square pad with an icon or text face; `pressProps` fires on pointerdown or a keyboard click                                                                                              |

**Every audio call the Device makes today** (all through the `synth` singleton from `app/lib/synth.ts`). These are what Phase 7 replaces:

| Call site                       | Call                                                                                  | Purpose                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `SynthDevice` mount             | `synth.loadPreset("grand_piano")`                                                     | initial preset                                                                  |
| `pressKey(root)`                | `synth.playNote(noteName, undefined, undefined, 0.8, undefined, "key-<root>-<semi>")` | note-on for each note of the key or chord; also `transport.capture(note, true)` |
| `releaseKey(root)`, blur/hidden | `synth.stopNote("key-<root>-<semi>")`                                                 | note-off                                                                        |
| `selectPreset(key)`             | `synth.loadPreset(key)` + `synth.playNote("C4", undefined, 0.35)`                     | instrument pads and Shift+←/→ preset stepping (over all 22 `SYNTH_PRESETS`)     |
| `turn(param)`                   | `synth.updateParam("osc1Wave" / "masterVol" / "release" / "cutoff", detentValue)`     | the four knobs                                                                  |
| device `onPointerUp`            | `synth.ensureContext()`                                                               | unlock or resume audio                                                          |
| `useTransport` playback         | `synth.playNote(note, …, "take-<note>")` / `synth.stopNote("take-<note>")`            | take playback (note names like `"C#4"`)                                         |
| `useTransport` metronome        | `synth.playMetronomeTick(accent)`                                                     | click every beat                                                                |

**Other Device facts:**

- **State from presets:** the Device keeps a `SynthParams` copy for the screen (`params.name`) and for knob detents (`detentOf` finds the detent nearest the preset's value).
- **Keys sound while held:** there's real note-on and note-off, via pointer capture and keyboard Space/Enter.
- **Notes:** `midi = 53 + semitone + 12·octave`, turned into names with `noteName()`. Octave runs −2 to +2.
- **Chord macros:** one key press sends 3–4 note-ons (root first). Two held keys can share a MIDI note (for example with the Power chord), which is why the old API uses per-key voice ids.
- **Instrument pads:** Piano, Guitar, Bass, Drums, Flute, Sax. Each pad lights up for a "family" of old preset keys.
- **Drums:** there are no drum pads. With Drums selected, the **keybed** plays the old drum preset.

**The old engine `app/lib/synth.ts`** keeps serving `/studio`. **Do not use it as a reference.** Its "Karplus-Strong" is a comb filter on an oscillator, its exciter never feeds the resonator, and its native `DelayNode` feedback loop is clamped to 128 frames. Don't import `noteToFrequency` from `piano-roll/types` either; write your own `midiToHz`.

**Build facts that matter:**

- Prerendering evaluates route modules in Node at build time. Nothing may touch `window`, `AudioContext` or `AudioWorklet` at import time.
- GitHub Pages deploys with `BASE_PATH=/<repo>/`, so the worklet URL has to respect the Vite base. `npm run build` builds Storybook too and copies it into `build/client`.
- CI runs Node 20; the local machine has Node 26.
- ESLint forbids raw `<button>`/`<a>` (use the design-system `Button`/`Link`) and enables `jsx-a11y`. Prettier: 80 columns, double quotes, trailing commas.
- Vitest currently runs **only** the Storybook stories, in headless Chromium (`@storybook/addon-vitest`). Every story gets rendered as a smoke test, so **stories must render without starting audio**. There's no unit-test project.

## 3. AGENTS.md rules that apply here

- **Stories:** start with a `Default` story that binds cleanly to props, add the `autodocs` tag, keep variants minimal, and write no `play` functions.
- **Tests:** ask the user before adding unit or interaction tests.
- **Comments:** remove scratch and restating comments; keep TODO/FIXME and explanations of non-obvious logic or magic numbers. DSP formulas and constants count as non-obvious, so give each a short line. Keep an attribution comment in any file ported from STK.
- **Style:** match the surrounding code: relative imports, named exports, Prettier formatting.
- **Docs:** update `README.md` at the end (Phase 7).

## 4. Architecture

```
Main thread                                  Audio thread (AudioWorkletGlobalScope)
───────────                                  ──────────────────────────────────────
SynthDevice ─▶ deviceEngine.ts (adapter)     processor.worklet.ts
InstrumentLab ─┐                               └─ Engine
               ▼                                   ├─ EventQueue (sample-accurate)
      PhysicalSynth (facade)  ── port msgs ──▶     ├─ Allocator per instrument
        ├─ AudioContext (lazy)                     │    └─ Voice: Exciter → Resonator → SVF → Amp → pan
        ├─ AudioWorkletNode   ◀── stats ────       ├─ Bus per instrument: Body → drive → sum + reverb send
        └─ Limiter → Analyser → destination        ├─ FDN reverb (shared)
                                                   └─ master gain → outputs[0] (stereo)
```

Principles:

- **Pure-TS DSP core.** Everything under `dsp/`, `models/`, `engine/` and `patches/` avoids Web Audio, the DOM and React. It runs inside the worklet and in any JS context (unit tests, offline rendering).
- **The sample rate is injected.** Never hard-code 44100 or 48000, and never read the global `sampleRate` outside `processor.worklet.ts`.
- **No allocation in the render path.** Preallocate voices, delay buffers (sized for each instrument's lowest note at the actual sample rate), scratch buffers and the event queue. Inside `process()`, avoid closures, array literals, `map`/`forEach`, `for...of` and string building.
- **Don't assume 128-frame blocks.** Use `outputs[0][0].length`.
- **Render per voice per block segment**, not per sample across voices. It keeps state in registers and cuts down calls. Keep the voice classes monomorphic: loop over each family's voice array separately.
- **Voices render mono** and are panned into a stereo bus. A body processes the mono sum of its bus and adds the result to both channels, since a body is one physical object.

### 4.1 File layout

```
app/lib/physical/
  index.ts                  public API: physicalSynth singleton, types, INSTRUMENTS registry
  PhysicalSynth.ts          main-thread facade (AudioContext, worklet loading, messaging, master chain)
  messages.ts               EngineEvent / WorkletMessage types (shared by both threads)
  processor.worklet.ts      AudioWorkletProcessor entry; the only file that reads worklet globals
  engine/
    Engine.ts               render loop, event dispatch, buses, reverb, master
    EventQueue.ts           preallocated, time-sorted queue
    allocators.ts           per-key, per-string, mono-legato, per-piece allocation
    Bus.ts                  per-instrument bus: body, drive, pan sum, reverb send
  dsp/
    DelayLine.ts            circular buffer; integer, linear and Lagrange-3 reads
    ThiranAllpass.ts        first-order fractional-delay allpass
    OnePole.ts              lowpass, highpass, DC blocker
    Allpass1.ts             first-order allpass (dispersion stage)
    Resonator2.ts           two-pole mode
    ModalBank.ts            structure-of-arrays bank of modes
    Svf.ts                  zero-delay-feedback state-variable filter
    Adsr.ts                 envelope
    Lfo.ts                  sine/triangle with delay + fade-in
    Noise.ts                seeded xorshift32
    Smoother.ts             one-pole parameter smoothing
    SchroederAllpass.ts     diffuser for the reverb
    Fdn.ts                  8-line feedback delay network reverb
    nonlinear.ts            jetTable, reedTable, softClip
    phaseDelay.ts           phase-delay helpers used for tuning
    math.ts                 midiToHz, dbToGain, nextPrime, nextPow2, keyTable lookup
  models/
    StringLoop.ts           single-delay-loop string (delay + dispersion + loss + tuning)
    PluckExciter.ts
    HammerExciter.ts
    StringVoice.ts          piano/guitar/bass voice (unison or polarizations, damper, pickup)
    StickExciter.ts
    DrumVoice.ts            modal membrane/metal piece, noise layers, pitch drop, wires, choke
    BoreVoice.ts            flute (jet) and saxophone (reed), mono legato
    Body.ts                 modal body, radiation filters
  patches/
    types.ts                ParamSpec, KeyTable, patch interfaces
    piano.ts guitar.ts bass.ts saxophone.ts flute.ts drums.ts
    index.ts
  offline/
    renderEngine.ts         pure-TS render of an event list (Node/unit tests)
    renderOffline.ts        browser: OfflineAudioContext + the real worklet (diagnostics)
    analysis.ts             FFT, f0 estimate, T60 estimate, peak/RMS/DC/NaN checks
app/components/lab/
  InstrumentLab.tsx         audition and diagnostics harness (dev tool, not shipped in routes)
  InstrumentLab.stories.tsx title "Lab/Instrument Lab"
app/components/home/
  deviceEngine.ts           Phase 7: Device adapter (DEVICE_PRESETS, held-key voices, knob mapping, metronome)
```

### 4.2 Loading the worklet

- Inside `PhysicalSynth.start()`, use a **dynamic** import so the worklet URL never gets evaluated during prerendering:
  ```ts
  const { default: url } = await import("./processor.worklet.ts?worker&url");
  await ctx.audioWorklet.addModule(url);
  ```
  In builds, Vite bundles the worklet's imports into a single file and prefixes the URL with `base`. In dev, it serves an ES module, which AudioWorklet supports. `vite/client` types already declare `*?worker&url`.
- **Phase 0 must prove this works** in `npm run dev`, `npm run storybook`, `npm run build-storybook` and `BASE_PATH=/studio/ npm run build:app`. If dev loading fails (for example because Vite injects client code into worker modules), stop and report the error to the user. Candidate fixes are `worker: { format: "es" }` in `vite.config.ts` or serving a pre-bundled file through `?url`. Ask before changing `vite.config.ts`.
- Worklet-scope globals aren't in `lib.dom`. Declare them **inside `processor.worklet.ts`** (a module-scoped `declare` resolves to the real global at runtime without polluting main-thread types):
  ```ts
  declare const sampleRate: number;
  declare const currentFrame: number;
  declare const AudioWorkletProcessor: {
    prototype: { readonly port: MessagePort };
    new (options?: AudioWorkletNodeOptions): { readonly port: MessagePort };
  };
  declare function registerProcessor(
    name: string,
    ctor: new (options?: AudioWorkletNodeOptions) => unknown,
  ): void;
  ```
  Adjust as needed for `extends AudioWorkletProcessor` to typecheck. `npm run typecheck` must pass.
- Create the node with `new AudioWorkletNode(ctx, "physical-synth", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions })`.
- Create the context with `new AudioContext({ latencyHint: "interactive" })`. Don't force a sample rate.

### 4.3 Message protocol (`messages.ts`)

```ts
export type InstrumentId = "piano" | "guitar" | "bass" | "saxophone" | "flute";
export type DrumPieceId =
  | "kick"
  | "snare"
  | "closedHat"
  | "openHat"
  | "clap"
  | "lowTom"
  | "highTom"
  | "cowbell"
  | "crash";
export type BusId = InstrumentId | "drums";

export type EngineEvent =
  | {
      type: "noteOn";
      instrument: InstrumentId;
      note: number;
      velocity: number;
      time?: number;
    }
  | { type: "noteOff"; instrument: InstrumentId; note: number; time?: number }
  | { type: "hit"; piece: DrumPieceId; velocity: number; time?: number }
  | { type: "sustain"; instrument: InstrumentId; down: boolean; time?: number }
  | { type: "tick"; accent: boolean; time?: number }
  | {
      type: "param";
      target: BusId | "master";
      id: string;
      value: number;
      time?: number;
    }
  | { type: "allNotesOff" }
  | { type: "panic" };

export type WorkletMessage =
  | { type: "ready"; sampleRate: number }
  | { type: "stats"; activeVoices: number; load?: number }
  | { type: "warning"; message: string };

export interface ProcessorOptions {
  events?: EngineEvent[]; // pre-scheduled events, used by OfflineAudioContext diagnostics
  overrides?: Partial<Record<BusId | "master", Record<string, number>>>;
}
```

- `time` is in AudioContext seconds. If it's missing, the event runs at the start of the next block. The worklet converts with `frame = Math.round(time * sampleRate)` and clamps anything already past to "now".
- `note` is a MIDI note number and `velocity` is 0–1.
- **Note-ons and note-offs are reference-counted per (instrument, note).** A second `noteOn` for a note that's already held re-strikes it: new excitation goes into the same voice, as with a real piano key or string, and the hold count goes up. Each `noteOff` lowers the count, and the voice is released only when the count reaches 0. This covers the Device's chord macros, where two held keys can share a note, without voice ids in the engine.
- `tick` plays the metronome woodblock (§6.5) on a dry utility bus with no reverb send. `accent` raises its pitch and level.
- `param` ids are the dotted `ParamSpec.id`s from §8.1. Unknown ids produce a `warning` and are otherwise ignored.
- Send `stats` about every 250 ms. Include `load` only if `globalThis.performance?.now` exists in the worklet scope; otherwise leave it out and rely on the offline benchmark (§12).

### 4.4 Facade API (`PhysicalSynth.ts`, exported as a lazy singleton from `index.ts`)

```ts
export interface PhysicalSynth {
  start(): Promise<void>; // idempotent; create or resume the context and load the worklet. Call from a user gesture.
  resume(): void;
  readonly ready: boolean;
  noteOn(
    instrument: InstrumentId,
    note: number,
    velocity: number,
    time?: number,
  ): void;
  noteOff(instrument: InstrumentId, note: number, time?: number): void;
  hit(piece: DrumPieceId, velocity: number, time?: number): void;
  setSustain(instrument: InstrumentId, down: boolean, time?: number): void;
  metronomeTick(accent: boolean, time?: number): void;
  setParam(target: BusId | "master", id: string, value: number): void;
  allNotesOff(): void;
  panic(): void;
  now(): number; // ctx.currentTime, or 0 before start
  getAnalyser(): AnalyserNode | null;
  onStats(
    listener: (stats: { activeVoices: number; load?: number }) => void,
  ): () => void;
}
```

- Nothing runs at import time. The singleton is created on first access, and all browser APIs are guarded with `typeof window !== "undefined"`.
- **Events sent before the worklet is ready are queued** and flushed as immediate events once it's ready. The first tap on the Device calls `start()` and still plays, just a little late.
- Master chain after the worklet: `DynamicsCompressorNode` as a safety limiter (threshold −3 dB, knee 0, ratio 20, attack 0.002 s, release 0.1 s) → `AnalyserNode` (fftSize 2048) → destination.

### 4.5 Engine render loop (`Engine.ts`)

For each `render(left, right, blockStartFrame)` call:

1. Pop every queued event with `frame < blockEnd` and split the block into segments at those frames (sample-accurate onsets).
2. For each segment, apply that frame's events (allocate, release, set params), then call `voice.render(bus, segStart, segEnd)` on every active voice. The voice **adds** its panned output into its bus buffers.
3. After the whole block, each bus runs body → drive → adds to master L/R, and adds `bus × reverbSend` into the reverb input.
4. The reverb processes its input into wet L/R, which gets added to master scaled by `master.reverb.return`.
5. Apply smoothed master gain and write `outputs[0][0]` and `outputs[0][1]`.
6. Free finished voices (§4.6). Every N blocks, post `stats`.

### 4.6 Voice lifecycle

- **States:** `idle → active → released → idle`, plus `stolen` (a 5 ms fade-out, then idle).
- **Level tracking:** each voice runs a peak follower on its output (attack instant, release about 50 ms).
- **Freeing:** a voice is freed once it's released (or has decayed naturally) and its level has stayed below −90 dBFS for 50 ms. A bore voice is freed after its breath envelope ends and its level is below that threshold.
- **Stealing:** when an instrument's pool is full, steal the quietest released voice. If none is released, steal the oldest. Each pool keeps 4 spare voices so a stolen voice can fade while the new note starts.
- **Denormals:** decaying loops get freed long before float64 subnormals appear. The reverb, however, can ring indefinitely, so flush its state to zero and put it to sleep (skip processing) once its input has been silent and its output has stayed below −100 dBFS for 0.5 s.

## 5. DSP building blocks (`dsp/`)

All of these are small classes with a per-sample `process(x)` or `tick(x)` and preallocated state. Coefficients are recomputed only when parameters change.

**DelayLine**

- Backed by a `Float32Array` whose length is `nextPow2(maxDelay + 4)`, indexed with a mask.
- The contract: after `write(x)`, `readInt(n)` returns the sample written `n` writes ago.
- `readLinear(d)` and `readLagrange3(d)` handle fractional reads.
- Lagrange 3rd-order FIR interpolation for a fractional delay `D ∈ [1, 2)` on top of integer offset `M`: `y = Σ_{k=0..3} h_k · x[n − M − k]`, where `h_k = Π_{j≠k} (D − j)/(k − j)`.
- Use Lagrange for delays that are **modulated**: bore legato, vibrato, reverb modulation.

**ThiranAllpass (first order).** This handles fixed fractional tuning in string loops.

- For a fractional delay `d ∈ [0.5, 1.5)`, set `a = (1 − d)/(1 + d)` and compute `y = a·x + x₁ − a·y₁`.
- It has unity gain at all frequencies, so it doesn't change the timbre from note to note the way linear interpolation does.

**OnePole**

- Lowpass: `y = (1 − p)·x + p·y₁`, with `p ∈ [0, 1)` and DC gain 1.
  - Magnitude: `|H(ω)| = (1 − p)/√(1 − 2p·cos ω + p²)`.
  - Phase delay in samples: `τ(ω) = atan2(p·sin ω, 1 − p·cos ω)/ω`.
- DC blocker: `y = x − x₁ + R·y₁`, with `R = 1 − 2π·20/fs` (about a 20 Hz corner).

**Allpass1 (dispersion stage)**

- `A(z) = (a + z⁻¹)/(1 + a·z⁻¹)`, computed as `y = a·x + x₁ − a·y₁`.
- With `a ∈ (−1, 0)` it delays low frequencies more than high ones, so upper partials come out sharp, the way they do on a stiff string.
- Phase delay: `τ(ω) = −[atan2(−sin ω, a + cos ω) − atan2(−a·sin ω, 1 + a·cos ω)]/ω`. For a cascade, sum the per-stage values. `a = 0` gives `τ = 1`, which is a handy check.

**Resonator2 (one mode)**

- All-pole form: `y = g·x + c·y₁ − r²·y₂`.
- Coefficients: `θ = 2πf/fs`, `r = exp(−6.9078/(T60·fs))` (6.9078 = ln 1000, i.e. −60 dB), `c = 2r·cos θ`.
- Its impulse response is `rⁿ·sin((n+1)θ)/sin θ`, so setting `g = amp·sin θ` gives a decaying sinusoid with peak amplitude about equal to `amp`.
- Clamp `f < 0.45·fs`.

**ModalBank**

- Stores `c`, `r2`, `g`, `y1` and `y2` in structure-of-arrays form (`Float64Array`s).
- `setMode(i, f, t60, amp)`; `process(x)` returns the sum of all modes.
- `scaleFrequencies(k)` recomputes `c` for every mode. Call it at most once every 32 samples; it's used for the drum pitch drop.

**Svf (zero-delay-feedback state-variable filter, Andrew Simper / Cytomic)**

- Coefficients:
  ```
  g = tan(π·fc/fs); k = 1/Q
  a1 = 1/(1 + g·(g + k)); a2 = g·a1; a3 = g·a2
  ```
- Per sample:
  ```
  v3 = x − ic2; v1 = a1·ic1 + a2·v3; v2 = ic2 + a2·ic1 + a3·v3
  ic1 = 2·v1 − ic1; ic2 = 2·v2 − ic2
  low = v2; band = v1; high = x − k·v1 − v2
  ```
- Clamp `fc` to `[20, 0.45·fs]`. It stays stable under fast modulation. While the cutoff is moving, recompute `tan` every 16 samples.

**Adsr**

- A state machine: idle, attack, decay, sustain, release.
- Attack is linear over `attack` seconds. Decay and release approach their target exponentially with `coef = 1 − exp(−4.6/(time·fs))`, which covers 99% of the distance in `time` seconds.
- Retriggering starts from the current value, never from 0, to avoid clicks. Release ends when the value drops below 1e-4.
- Options: `gate` mode (attack and release only) and `oneShot`.

**Lfo.** A phase accumulator producing sine or triangle, with `delay` and `fadeIn` so vibrato starts late and grows, the way a player's does.

**Noise.** A xorshift32 generator with a seed per voice, so offline renders are deterministic. Output range: [−1, 1).

**Smoother.** A one-pole approach toward a target with τ ≈ 10 ms. Every continuous parameter that affects a running voice or bus goes through one.

**nonlinear.ts**

- `jetTable(x) = clamp(x·(x² − 1), −1, 1)` (from STK `JetTable`).
- `reedTable(x, offset, slope) = clamp(offset + slope·x, −1, 1)` (from STK `ReedTable`).
- `softClip(x)`: for `|x| < 3`, `x·(27 + x²)/(27 + 9x²)`; otherwise `sign(x)`.

**SchroederAllpass.** `y = −g·x + x[n−M] + g·y[n−M]`.

**Fdn.** See §7.4.

## 6. Instrument models (`models/`)

### 6.1 StringLoop (single-delay-loop string)

Per sample:

```
y = delay.readInt(Nint)
y = dispersion.process(y)      // M × Allpass1, all with the same coefficient a_d
y = loss.process(y) * g        // OnePole lowpass (brightness p), plus gain g for decay
y = tuner.process(y)           // ThiranAllpass for the fractional part
y += excitation                // pluck or hammer input; 0 once it has finished
delay.write(y)
return y
```

Tuning, recomputed on note-on and whenever decay or brightness changes:

```
ω0     = 2π·f0/fs
τloss  = atan2(p·sin ω0, 1 − p·cos ω0)/ω0
τdisp  = M · allpass1PhaseDelay(a_d, ω0)
D      = fs/f0 − τloss − τdisp
Nint   = floor(D − 0.5)                 // leaves d ∈ [0.5, 1.5) for the Thiran filter
d      = D − Nint;  a_T = (1 − d)/(1 + d)
Hmag   = (1 − p)/√(1 − 2p·cos ω0 + p²)
g      = min(0.99999, 10^(−3/(f0·T60)) / Hmag)
```

- **Nint** is the pure delay in the loop. If your read/write order adds an implicit sample, subtract it. The tuning sweep (§10) will catch this: an off-by-one shows up as a flat error that grows with pitch.
- **Guard `Nint ≥ 2`** by reducing M (the number of dispersion stages) for very high notes.
- **Damping** (`setDecay(t60, rampSeconds)`): ramp `g` toward the damped value over about 15 ms, and optionally raise `p` by up to 0.2 so the note also goes dull.

### 6.2 PluckExciter (guitar, bass)

- At note-on, fill a preallocated excitation buffer with `L = round(fs/f0)` samples:
  1. Seeded noise → one-pole lowpass with `p_ex = 0.9 − 0.85·hardness·(0.5 + 0.5·velocity)` (harder plucks are brighter).
  2. Scale by `velocity^1.2`.
  3. Apply a **pluck-position comb**: `e[n] − e[n − round(β·L)]`, with β = pluck position (0.05–0.5).
- Feed it into the loop additively over L samples.
- Styles:
  - `pick`: noise burst plus a short click.
  - `finger`: a raised-cosine pulse with lower brightness.
  - `slap` (bass, optional, Phase 8): a very short hard pulse plus fret buzz (softClip on the loop output above a threshold).

### 6.3 HammerExciter (piano)

At note-on, simulate the felt hammer against the string and write the resulting force pulse into a preallocated buffer. This is cheap: a few hundred samples of explicit Euler at 4× oversampling.

```
state: yh = 0, vh = v0 (from velocity), ys = 0
loop (dt = 1/(4·fs)):
  c  = yh − ys                          // felt compression
  F  = c > 0 ? K·c^p : 0                // nonlinear felt, p ≈ 2.2–3.0
  vh −= (F/m)·dt;  yh += vh·dt          // hammer slows down
  ys += (F/(2Z))·dt                     // the string acts as two semi-infinite halves
  record F (average every 4 steps into one output sample)
  stop once contact has begun and c ≤ 0, or after 12 ms
```

- **Why bother:** a stiffening felt gives shorter, brighter pulses at higher velocity with no velocity→filter hack. Work in normalized units and tune `m`, `K`, `Z` per register so that:
  - C4 contact time goes from about 4 ms at velocity 0.1 to about 1 ms at velocity 1.0;
  - it's about 1.4× longer at A0 and about 0.4× at C8.
- Set `v0 = vMin + (vMax − vMin)·velocity^1.5`.
- Inject `F[n]/(2Z)` through a **strike-position comb** (β ≈ 0.12, since hammers strike at about 1/8 of the string length).
- **Known simplification:** reflections returning to the hammer during contact are ignored. That's acceptable. Treble notes, whose period is shorter than the contact time, will be less accurate.

### 6.4 StringVoice

**Structure**

- 1–3 `StringLoop`s:
  - Piano: 1–3 unison strings with a slight detune spread and **different decay multipliers**, e.g. `[1, 0.55, 0.4]`. That imitates the piano's fast-then-slow two-stage decay.
  - Guitar: 2 loops as the two polarizations (+0.3 cents, second T60 × 0.6, excitation split 0.7/0.3).
- An exciter.
- Optional **pickup comb** (bass): `out = y − delay.readInt(round(βp·N))`, reading the loop's own delay line.
- Then DC blocker → SVF → amp ADSR → pan.

**Re-strike.** A new note-on for a key that's still sounding feeds new excitation into the existing loops and raises its hold count (§4.3). Never kill the voice and start a new one.

**Dampers**

- A note-off without the sustain pedal damps the note with the patch's `damper` T60.
- Piano notes above MIDI 89 have no dampers and ignore note-off.
- With the sustain pedal down, note-offs are deferred; releasing the pedal damps every deferred voice.

**Allocation**

- **Per key** (piano): one voice per MIDI note.
- **Per string** (guitar, bass):
  - Among strings where `0 ≤ note − open ≤ 20`, pick the free one with the lowest fret.
  - If none is free, take the string with the lowest fret and re-fret it: damp it over 8 ms, then retune and re-excite.
  - Notes outside the range fold by octaves.
  - Optional `strum` parameter (ms): note-ons that arrive within 15 ms of each other get staggered from low to high.

### 6.5 DrumVoice (membranes and metals)

One voice per drum piece. Hitting a piece again while it rings adds excitation to the same voice. Piece types:

- **Membrane** (kick, snare, toms):
  - A `ModalBank` using the ideal circular-membrane ratios `(0,1) 1.000, (1,1) 1.593, (2,1) 2.136, (0,2) 2.295, (3,1) 2.653, (1,2) 2.917, (4,1) 3.155, (2,2) 3.500, (0,3) 3.598, (5,1) 3.647`.
  - Mode weights blend between two sets with `position`: **center** (m = 0 modes at 1, others at 0.05) and **edge** (mode i at `1/(1 + 0.25·i)`).
- **StickExciter:** a half-sine pulse lasting `τc = lerp(τsoft, τhard, hardness·velocity)`, about 0.3–4 ms, plus an optional noise click (highpass at 2–5 kHz, 3–8 ms).
- **Pitch drop** (tension modulation): every 32 samples, call `bank.scaleFrequencies(1 + δ·velocity·exp(−t/τ))`.
- **Snare wires:** noise → highpass at 1.8 kHz → scaled by `wireLevel × follower(|membrane|)`. The follower has 1 ms attack and about 120 ms release.
- **Metal** (hats, crash, cowbell):
  - Hats and crash use a mode table generated **once at init from a fixed seed**: N modes, log-uniform in `[fLo, fHi]`, with `T60_i = T60·(fLo/f_i)^0.3` and `amp_i ∝ 1/√(i+1)` with ±30% jitter. Add a highpassed noise layer.
  - Cowbell uses an explicit 4-mode table (§8.3).
- **Noise piece** (clap): short bursts plus a tail through a bandpass SVF (§8.3).
- **Choke:** a piece can list others it chokes (closed hat → open hat). A hit ramps the choked pieces' mode T60 down to 0.03 s.
- **Woodblock** (metronome only, not part of the kit): 2 modes at about 1.9 and 2.9 kHz (accent about 2.3 and 3.4 kHz), T60 0.04 s, hard stick, on the dry utility bus.

### 6.6 BoreVoice (flute and saxophone)

Port both loops from STK (`src/Flute.cpp`, `src/Saxofony.cpp`, plus `include/JetTable.h`, `include/ReedTable.h`, `DelayL`, `OnePole`, `PoleZero`), from https://github.com/thestk/stk. STK is MIT-style licensed, so keep a one-line attribution comment. **The STK source is authoritative for constants and delay-length formulas.** The outlines below are for orientation only.

Flute (jet drive, cylindrical bore):

```
breath = maxPressure·env·(1 + noiseGain·noise + vibGain·vibrato)
r  = −reflFilter(boreDelay.lastOut)      // open-end reflection: one-pole lowpass with sign inversion
r  = dcBlock(r)
pd = breath − jetReflection·r
pd = jetDelay.tick(pd)                   // jet length = jetRatio × bore length
pd = jetTable(pd) + endReflection·r
out = boreDelay.tick(pd)
```

Saxophone (reed, "faux conical" bore made of two delays split at the blow position):

```
breath = maxPressure·env·(1 + noiseGain·noise + vibGain·vibrato)
t   = −0.95·reflFilter(delayA.lastOut)
out = t − delayB.lastOut
pd  = breath − out
delayB.tick(t)
delayA.tick(breath − pd·reedTable(pd) − t)
```

Around the ported loops:

- **Breath.** The ADSR shapes **pressure**, not output volume. Velocity sets the target pressure (the range is in the patch). The amp stage is a gate with a 50 ms release.
- **Mono legato.**
  - Keep a last-note-priority stack.
  - A note-on while breath is still on retunes without retriggering the envelope: ramp the delay lengths over `portamento` seconds (default 0.03), reading with `readLagrange3`.
  - A note-off of the current note falls back to the previous held note if there is one; otherwise the breath releases.
- **Chords.** In a burst of note-ons within 15 ms, only the first note plays. That's the root on the Device, since chord macros send the root first. The other notes of the burst still count as held, so their note-offs don't cut the root.
- **Stability guards:**
  - Clamp pressure to the patch's safe range.
  - Run `softClip` inside the loop and a DC blocker on the reflection.
  - Watchdog: if output is NaN or Infinity, or `|out| > 4`, zero all buffers and restart the voice silently, then post a `warning`.
- **Pitch.** The nonlinear loop drifts with pressure. After a first pass, use the diagnostics to measure each note at nominal pressure and store a `tuningCents` KeyTable in the patch (Phase 6).

### 6.7 Body (`models/Body.ts`, one per instrument bus)

- **`modal`** (guitar, piano):
  - A `ModalBank` fed the mono bus sum, with `out = direct + mix·bank`.
  - Macros:
    - `size` scales mode frequencies by 0.7–1.4×.
    - `resonance` scales mode T60 by 0.5–2×.
    - `tone` is a tilt: a first-order shelf pair of ±6 dB.
- **`radiation`** (saxophone, flute): a first-order highpass (the open end or bell radiates like a highpass), plus an optional SVF peaking band for "presence".
- **`none`** (bass, drums): bass relies on pickup and tone; drum shells are modes inside each piece.

## 7. Standard modules

### 7.1 ADSR roles by family

| Family  | Amp ADSR                                                                                          | Other envelopes                                                                  |
| ------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Strings | Mostly a gate (A ≈ 1 ms, S = 1). The loop sets the natural decay; `release` also sets damper time | Filter AD (optional)                                                             |
| Bore    | Gate with a 50 ms release                                                                         | **Breath ADSR drives pressure**: A = tonguing, S = breath level, R = breath stop |
| Drums   | None (one-shot)                                                                                   | —                                                                                |

The Device's Release knob (Phase 7) maps to `envelope.release`: damper time for strings, breath release for winds.

### 7.2 Filter

- One `Svf` per voice, **after the resonator, before the body**, so filter envelopes and keytracking still act per note. Modes: LP, BP, HP.
- `cutoff = base · 2^(keytrack·(note − 60)/12) · (1 + envAmount·filterEnv)`, clamped.
- Defaults are nearly open (12–16 kHz, Q 0.707) so the model's own tone comes through. The loss, dispersion and body filters are part of the model, not this user filter.

### 7.3 LFO

- One per voice, with delay and fade-in.
- Destinations by family:
  - Bore: `pressure` (the main vibrato), `pitch` (small; modulates the delay length through Lagrange reads), `filter`.
  - Strings: `filter` or `amp` (tremolo). No pitch LFO on strings in v1, because modulating a Thiran-tuned loop causes artifacts.
  - Drums: none.

### 7.4 Reverb (FDN, shared, runs in the worklet)

- **Input:** bus sends summed to mono → predelay (0–60 ms) → 4 series `SchroederAllpass` diffusers (3–13 ms, lengths mutually prime in samples, g ≈ 0.6) → distributed into 8 lines with alternating-sign input gains `±1/√8`.
- **Lines:** base lengths `ms_i = 29·(71/29)^(i/7)` ms for i = 0..7. In samples, `L_i = nextPrime(round(ms_i·fs/1000·size))`, with `size ∈ [0.5, 1.5]`. Allocate buffers for `size = 1.5`.
- **Per sample:**
  ```
  s_i = line_i.readInt(L_i)
  s_i = damp_i.process(s_i) · g_i          // OnePole lowpass (damping), then decay gain
  sum = Σ s_i;  f_i = s_i − (2/8)·sum       // Householder feedback matrix, O(N)
  line_i.write(input_i + f_i)
  L = s0 − s2 + s4 − s6;  R = s1 − s3 + s5 − s7   (scale by 1/2)
  g_i = 10^(−3·L_i/(T60·fs))
  ```
- **Optional:** modulate two lines' read positions by ±1 sample at 0.1–0.7 Hz (Lagrange reads) to reduce metallic ringing.
- **Master params:** `reverb.size` (applied with a short crossfade or brief artifacts, not automatable), `reverb.decay` (T60 0.3–8 s), `reverb.damping` (p 0–0.7), `reverb.predelay`, `reverb.return`. Each bus has its own `space.send`.
- Sleeps when silent (§4.6).

### 7.5 Master and gain staging

- **Per-bus `drive`:** `softClip(x·(1 + 9·drive))/(1 + 2·drive)` (for bass or a later electric guitar). Master gain is smoothed.
- **Calibrating `outputGain` per patch:** a mezzo-forte (velocity 0.7) C4, or the nearest in-range note, should come out around −18 dBFS RMS on every instrument, so switching instruments doesn't change loudness. Peaks for a fortissimo 10-note chord must stay ≤ −1 dBFS before the limiter.

## 8. Patches (`patches/`)

### 8.1 Schema

```ts
export type SectionId =
  "exciter" | "resonator" | "body" | "filter" | "envelope" | "space";

export interface ParamSpec {
  id: string; // "exciter.hardness"
  label: string; // "Hardness"
  section: SectionId;
  min: number;
  max: number;
  default: number;
  unit?: "Hz" | "s" | "%" | "cents" | "dB" | "st" | "×";
  scale?: "linear" | "log";
  primary?: boolean; // one of the 4 knobs for this section in the future Device UI
}

export type KeyTable = readonly (readonly [note: number, value: number])[]; // piecewise-linear over MIDI note

export interface BasePatch {
  id: BusId;
  name: string;
  family: "string" | "bore" | "drums";
  range: readonly [low: number, high: number]; // notes outside fold by octaves
  outputGain: number;
  pan: { center: number; spread: number }; // spread by note or string, −1..1
  params: readonly ParamSpec[];
}
```

Then define `StringPatch`, `BorePatch` and `DrumKitPatch`, which extend `BasePatch` with the model constants and KeyTables from §8.3.

**User-facing params are macros over those constants.** For example, `resonator.decay` is a multiplier of 0.25–4× on the T60 KeyTable, and `resonator.inharmonicity` scales the dispersion coefficient. That keeps each patch's per-register detail intact while one knob moves the whole instrument.

### 8.2 Primary params: 4 per section, for the future Device UI

| Section   | Strings (piano, guitar, bass)                        | Bore (sax, flute)                                                 | Drums (kit-wide)                              |
| --------- | ---------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| Exciter   | hardness, position, strength (vel. sens.), noise     | pressure, reed stiffness / jet ratio, breath noise, vibrato depth | hardness, position, strength, click           |
| Resonator | decay ×, brightness, inharmonicity ×, detune (cents) | loss, brightness, portamento, vibrato rate                        | tune (st), decay ×, pitch drop ×, snare wires |
| Body      | size, resonance, tone, mix                           | bell cutoff, presence freq, presence gain, mix                    | shell, tone, width, mix                       |
| Filter    | cutoff, resonance, env amount, keytrack              | same                                                              | same (on the bus)                             |
| Envelope  | attack, decay, sustain, release (= damper time)      | attack, decay, sustain, release (on pressure)                     | — (use drum decay)                            |
| Space     | send; master: size, decay, damping                   | same                                                              | same                                          |

Non-primary params (per-register tables, filter env decay, etc.) still exist and appear in the Lab's "advanced" group.

### 8.3 Starting values (tune by ear; verify with diagnostics)

**Piano** (range 21–108, polyphony 24 + 4 spare, per-key allocation, re-strike)

- **Unison strings per note:** 1 for 21–31, 2 for 32–46, 3 for 47–108.
  - Detune spread: 0.4 cents (bass) to 0.9 cents (treble).
  - Unison T60 multipliers: `[1, 0.55, 0.4]`.
- **T60 (s):** `[[21,18],[36,14],[48,10],[60,7],[72,4.5],[84,2.5],[96,1.2],[108,0.5]]`
- **Brightness p:** `[[21,0.35],[48,0.25],[72,0.15],[96,0.08],[108,0.05]]`. p goes down toward the treble because loss per second scales with f0.
- **Dispersion:**
  - Number of stages M: `[[21,8],[40,6],[55,4],[70,2],[84,0]]`
  - Coefficient `a_d`: `[[21,−0.7],[55,−0.5],[84,−0.3]]`
- **Hammer:** strike position 0.12, contact-time targets as in §6.3. Optional knock: a noise burst through a 1 kHz bandpass, 10 ms, low level.
- **Damper T60 (s):** `[[21,0.6],[60,0.35],[89,0.25]]`; no dampers above 89.
- **Body (modal soundboard):** 20 modes log-spaced from 60 to 3000 Hz, T60 from 0.25 s at the low end to 0.04 s at the high end, `amp ∝ 1/√(i+1)` with ±30% seeded jitter, mix 0.35.
- **Filter and envelope:** filter LP 16 kHz, Q 0.707, keytrack 0, env 0. Amp ADSR 0.001 / 0 / 1 / 0.02.
- **Output:** pan spread 0.35 (low notes left); send 0.25.

**Guitar** (acoustic steel-string; open strings `[40,45,50,55,59,64]`, frets 0–20, range 40–84, per-string allocation, polyphony 6)

- **Polarizations:** as in §6.4.
- **T60 (s):** `[[40,7],[52,5.5],[64,4],[76,2.5],[88,1.5]]`
- **Brightness p:** `[[40,0.3],[64,0.2],[88,0.1]]`
- **Dispersion:** M = 1, `a_d = −0.15` below note 52; none above.
- **Pluck:** `pick`, hardness 0.6, position 0.18. Fret damper T60 0.12 s.
- **Body modes (Hz, T60 s, amp):** (100, 0.20, 1.0) air, (200, 0.15, 0.8) top plate, (280, 0.10, 0.4), (400, 0.08, 0.5), (550, 0.06, 0.3), (800, 0.05, 0.2), (1200, 0.04, 0.15), (2000, 0.03, 0.1). Mix 0.5.
- **Filter:** LP 14 kHz.
- **Output:** pan spread 0.2 by string; send 0.2; strum 0 ms.

**Bass** (4-string, fingered; open strings `[28,33,38,43]`, frets 0–20, range 28–67, per-string allocation, polyphony 4)

- **T60 (s):** `[[28,8],[43,6],[55,4.5],[67,3]]`
- **Brightness p:** `[[28,0.45],[67,0.3]]`
- **Dispersion:** M = 3 with `a_d = −0.35` below note 40; M = 2 with −0.25 up to 55; none above.
- **Pluck:** `finger`, hardness 0.35, position 0.2. Pickup βp 0.15. Damper T60 0.08 s.
- **Body:** none.
- **Filter:** LP 3 kHz, Q 0.8.
- **Output:** drive 0.1; send 0.05; pan center.

**Alto saxophone** (range 49–80, mono legato, portamento 0.03 s)

- **Loop constants:** STK Saxofony defaults for the reed table and bell filter. Blow position 0.25.
- **Breath:** pressure 0.55–0.95 of max, by velocity. Breath ADSR 0.04 / 0.1 / 0.85 / 0.08. Noise at the STK default (expose it as `exciter.noise`).
- **Vibrato:** 5.2 Hz, depth 0.03, delay 0.25 s, fade-in 0.3 s.
- **Body:** `radiation`, highpass 150 Hz + peak at 1.5 kHz (+3 dB, Q 1).
- **Filter:** LP 10 kHz.
- **Output:** send 0.2.

**Flute** (range 60–96, mono legato, portamento 0.03 s)

- **Loop constants:** STK Flute defaults; jet ratio 0.32.
- **Breath:** breath ADSR 0.06 / 0.1 / 0.9 / 0.1; noise a little above the STK default (flute is breathy).
- **Vibrato:** 5 Hz, depth 0.04, delay 0.3 s.
- **Body:** `radiation`, highpass 250 Hz.
- **Filter:** LP 12 kHz.
- **Output:** send 0.25.

**Drums** (one voice per piece; kit send 0.12)

| Piece     | Model    | Starting values                                                                                                                                        | Pan   |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| kick      | membrane | f0 55 Hz, first 4 ratios, T60 [0.35, 0.12, 0.08, 0.06] s, pitch drop δ 0.8 τ 35 ms, beater click (HP 3 kHz, 5 ms, 0.3), shell mode 90 Hz / 0.1 s / 0.2 | 0     |
| snare     | membrane | f0 190 Hz, 8 ratios, T60 0.18 s (upper modes 0.1), δ 0.05 τ 20 ms, wires 0.7 (HP 1.8 kHz, release 0.12 s), stick τc 0.4–1.5 ms                         | 0     |
| lowTom    | membrane | f0 95 Hz, 6 ratios, T60 0.5 s, δ 0.2 τ 60 ms                                                                                                           | −0.25 |
| highTom   | membrane | f0 150 Hz, 6 ratios, T60 0.4 s, δ 0.2 τ 60 ms                                                                                                          | +0.2  |
| cowbell   | metal    | modes 540, 800, 1180, 1650 Hz; amps 1, 0.9, 0.3, 0.15; T60 0.25 s; hard stick                                                                          | +0.15 |
| closedHat | metal    | 40 seeded modes 3–12 kHz, T60 0.05 s, noise HP 7 kHz 0.04 s at 0.5; **chokes openHat**                                                                 | +0.3  |
| openHat   | metal    | same seed and table, T60 0.6 s, noise HP 7 kHz 0.4 s                                                                                                   | +0.3  |
| crash     | metal    | 60 seeded modes 350 Hz–12 kHz, T60 1.6 s, noise HP 3.5 kHz 1.2 s at 0.3                                                                                | −0.35 |
| clap      | noise    | 8 ms bursts at 0, 11, 22 ms (±2 ms seeded jitter) + tail from 33 ms decaying over 180 ms, bandpass SVF 1.3 kHz Q 1.2                                   | 0     |

## 9. Instrument Lab (`app/components/lab/InstrumentLab.tsx`)

This is a dev-only harness in Storybook (title `Lab/Instrument Lab`, story id `lab-instrument-lab--default`). It is not mounted in any route.

- **Start audio** button: calls `physicalSynth.start()`. Nothing starts on mount, because Vitest renders every story headlessly.
- **Instrument selector:** the 5 instruments plus Drums. Use the design-system `Dropdown` or segmented `Button`s.
- **Keyboard:**
  - A 2-octave on-screen keyboard with real note-on and note-off (pointerdown and pointerup), plus computer keys `A W S E D F T G Y H U J K`.
  - `Z` / `X` shift octaves; hold `Space` for sustain.
  - A velocity slider.
- **Drum pads:** 9 pads matching the kit, plus a metronome toggle that fires `metronomeTick` at 120 BPM.
- **Parameter panel:** generated from the selected patch's `ParamSpec`s, grouped into the six sections, with primary params first and an "Advanced" disclosure for the rest. Use the design-system `Slider`. Changes call `setParam`.
- **Master panel:** volume, reverb size/decay/damping/predelay/return.
- **Scope and spectrum:** canvas views driven by `getAnalyser()`, plus a live stats line (active voices, load).
- **Copy patch JSON:** copies the current param values so tuned values can go into `patches/*.ts`. This is how listening sessions with the user turn into code.
- **Diagnostics tab:** see §10.
- **Stories:** `Default` (piano). Optionally one `Drums` story. No `play` functions. Follow the lint rules (design-system `Button`, jsx-a11y). Must render correctly in light and dark themes.

## 10. Diagnostics (how you verify without hearing)

`offline/renderOffline.ts` renders through an `OfflineAudioContext` with the **real worklet**. Events go in via `processorOptions.events`, so rendering is deterministic and runs off the main thread. `offline/analysis.ts` then measures the result:

- **f0:**
  - Hann window, zero-padded radix-2 FFT (2^16 points), peak search within ±100 cents of the target, quadratic interpolation.
  - Analyze from 0.3 s to about 1.7 s after onset, so render 2 s per note. That gives about 1–2 cents of resolution at 41 Hz.
  - Report `cents = 1200·log2(measured/target)`.
- **T60:** Schroeder backward-integrated energy decay curve; fit −5 to −25 dB, then extrapolate (T20 × 3).
- **Sanity:** peak, RMS, DC offset (mean over 0.5–1.0 s), and NaN/Infinity.
- **Onset accuracy:** the first sample above −60 dBFS versus the scheduled frame.
- **Real-time factor:** rendered seconds divided by wall-clock seconds for a stress event list.

The Diagnostics tab has one button per sweep and shows a results table with pass/fail per row. The results must be readable as page text (for example a plain `<table>`), so you can open Storybook in the built-in browser and read them with `get_page_text`.

1. **Tuning sweep:** every note in range, velocity 0.7, at 44100 and 48000 Hz.
2. **Decay sweep:** measured T60 versus expected (`KeyTable × decay macro`) for strings and drums.
3. **Stability sweep:** every note × velocity {0.1, 0.5, 1.0}; winds also across the pressure range. Checks NaN, peak and DC.
4. **Lifecycle:** after all events plus the maximum T60, active voices must return to 0 and the reverb must sleep.
5. **Stress:** worst-case polyphony per instrument, for the real-time factor.

## 11. Phases

Each phase lists its tasks and its **acceptance criteria**. Do not start a phase until the previous one is accepted.

### Phase 0: Decisions and worklet spike

- Ask the user:
  - Can you add a Node unit-test project to Vitest for the DSP code? Recommend yes; the list is in §12.
  - Branch and commit preferences.
- Check `git status`. If the home-page rewrite (§2) still isn't committed, tell the user and work around those files. Don't revert or commit them.
- Create the skeleton: `messages.ts`, `PhysicalSynth.ts` (start plus a test tone), `processor.worklet.ts` (a 220 Hz sine at −20 dBFS while a test note is held), `index.ts`, and a minimal `InstrumentLab` with Start audio and a test-tone button.
- Verify worklet loading everywhere listed in §4.2. For the app build, **temporarily** add `import { physicalSynth } from "../lib/physical"` plus a no-op reference such as `void physicalSynth;` to `app/routes/home.tsx`, run `BASE_PATH=/studio/ npm run build:app`, confirm prerendering succeeds and that the worklet asset is emitted and referenced with the `/studio/` prefix, then revert the temporary import.
- **Accept when:** all four environments load the worklet with no console errors (check the Lab in the built-in browser); `ready` arrives; the user confirms they hear the test tone; §12 checks pass.

### Phase 1: DSP building blocks and offline tooling

- Implement everything in `dsp/`, plus `offline/renderEngine.ts` (pure TS) and `offline/analysis.ts`.
- If tests were approved, add the §12 unit tests. If not, add a temporary "Building blocks" section to the Diagnostics tab that renders each block and checks it: Resonator2 T60 and frequency, Svf −3 dB point, Thiran/Lagrange delay accuracy, Allpass1 phase delay against the formula, FDN T60.
- **Accept when:** every block matches its formula within tolerance (T60 ±10%, frequency ±0.5%, fractional delay ±0.01 samples at low frequency); no allocation in the `process()` methods (code review).

### Phase 2: Engine host and standard modules

- Build `Engine`, `EventQueue`, `Bus`, the allocator base, the voice lifecycle, the master section, the FDN reverb, the full facade API with pre-ready queueing, and stats.
- Add a temporary `TestVoice` (sine → SVF → amp ADSR, LFO) to exercise the host. Delete it at the end of Phase 3.
- In the Lab, add the parameter panel generated from `ParamSpec`, the keyboard, scope/spectrum, stats, the master panel, and Copy patch JSON.
- **Accept when:**
  - onsets land within ±1 sample (offline);
  - voices free themselves and the reverb sleeps (lifecycle diagnostics);
  - parameter changes don't click (listening checkpoint);
  - a long sustained chord shows no GC sawtooth in a Chrome performance recording.

### Phase 3: Guitar and bass

- Build `StringLoop`, `PluckExciter`, `StringVoice` (polarizations, pickup comb, fret damping), per-string allocation, the modal `Body`, and the guitar and bass patches. Delete `TestVoice`.
- **Accept when:**
  - tuning sweep within ±3 cents over each full range at both sample rates;
  - T60 within ±25%;
  - stability sweep clean;
  - real-time factor ≥ 20× for a 6-string strum with reverb;
  - **listening checkpoint** (pluck position, body, damping, bass pickup), with the tuned values written into the patch files via Copy patch JSON.

### Phase 4: Piano

- Build `HammerExciter`, unison strings with detune and decay multipliers, per-register dispersion, dampers plus the sustain pedal (the Lab's Space key), re-strike, the soundboard body, and the piano patch.
- **Accept when:**
  - tuning sweep within ±3 cents on the fundamental (the partials are stretched on purpose);
  - hammer contact times within the §6.3 targets (show them in diagnostics);
  - T60 within ±25%;
  - real-time factor ≥ 8× for 16 held notes with the pedal down plus reverb;
  - **listening checkpoint** (velocity response, bass stiffness, pedal, re-strike).

### Phase 5: Drums

- Build `ModalBank`-based `DrumVoice`, `StickExciter`, pitch drop, snare wires, seeded metal tables, clap, choke groups, and the drum kit patch.
- **Accept when:** stability sweep clean; the closed hat audibly (and measurably) chokes the open hat; lifecycle clean; **listening checkpoint** for each piece.

### Phase 6: Flute and saxophone

- Port the STK Flute and Saxofony loops into `BoreVoice`. Add breath ADSR on pressure, vibrato with delay and fade-in, mono legato with portamento, the stability guards, radiation bodies, and the two patches. Then measure and bake `tuningCents` tables.
- **Accept when:**
  - every note in range speaks at velocities 0.3–1.0 (no silent or squealing notes in the stability sweep);
  - tuning within ±10 cents after calibration;
  - the watchdog never fires during the sweeps;
  - **listening checkpoint** (attack, vibrato, legato).

### Phase 7: Device integration and docs

- **Coordinate first.** Ask the user whether the home-page rewrite (§2) is committed or settled. This phase edits `SynthDevice.tsx` and `useTransport.ts`, so don't collide with someone else's work in progress. Re-read both files and refresh the §2 call table if anything moved. Ask the Waveform-knob question in §11.1.
- **Create `app/components/home/deviceEngine.ts`**, the only module the Device imports for audio. Suggested shape:

  ```ts
  export interface DevicePreset {
    id: string; // "piano"; later variants such as "electric_guitar"
    name: string; // shown on the screen
    instrument: InstrumentId | "drums";
    octave: number; // offset added to keybed notes (see §11.1)
    overrides?: Record<string, number>; // ParamSpec id → value
    knobs: { masterVol: number; release: number; cutoff: number }; // initial values, snapped to detents by the Device
  }

  export const DEVICE_PRESETS: DevicePreset[];

  export const deviceEngine: {
    unlock(): void; // physicalSynth.start() the first time, resume() after
    loadPreset(id: string): void; // apply overrides + knob values
    preview(): void; // C4 for 0.35 s (a kick for drums)
    noteOn(midi: number, velocity: number): void; // routed to the current preset's instrument; drums map keys to pieces
    noteOff(midi: number): void;
    setKnob(knob: KnobParam, value: number | string): void;
    metronomeTick(accent: boolean): void;
    allNotesOff(): void;
  };

  export function noteNameToMidi(name: string): number; // "C#4" → 61, for useTransport's recorded names
  ```

- **Edit only the audio wiring in `SynthDevice.tsx`.**
  - Replace the `synth` / `SYNTH_PRESETS` / `SynthParams` import with `deviceEngine` / `DEVICE_PRESETS` and a local `DeviceParams` type (`name`, `osc1Wave`, `masterVol`, `release`, `cutoff`) that keeps the screen and `detentOf` working.
  - `PRESET_KEYS` and the instrument pads' `family` arrays switch to `DEVICE_PRESETS` ids.
  - The `key-<root>-<semi>` voice keys become plain `noteOn`/`noteOff(midi)`; reference counting (§4.3) handles shared chord notes.
  - Leave JSX structure, class names, CSS, labels, icons and interaction model unchanged. If the change seems to need any of those, stop and ask.
- **Edit only the audio calls in `useTransport.ts`.** Playback uses `deviceEngine.noteOn/noteOff(noteNameToMidi(note), …)`, and the metronome uses `deviceEngine.metronomeTick`. On stop, send `noteOff` for every playback note still held.
- Leave `app/lib/synth.ts` and `/studio` untouched. They keep working as before.
- **Update `README.md`:**
  - the "Device architecture" table: the `app/lib/synth.ts` row changes to "`/studio` only", plus rows for `deviceEngine.ts`, `app/lib/physical/` and `app/components/lab/`;
  - a short "Synth engine" section (architecture, how to audition in the Lab, how to add a patch or a Device preset);
  - the Storybook section: add the `Lab/*` title.
- **Verify:** run `npm run build` (app + Storybook), then check the Device in `npm run dev` (http://localhost:5173) with the built-in browser:
  - no console errors;
  - each instrument pad loads the right patch and the screen shows its name;
  - keys and chord macros release cleanly: `activeVoices` goes back to 0 (expose it in dev through `physicalSynth.onStats` and a console log, or check it in the Lab);
  - recording and playback work in both tape and sequencer modes;
  - the metronome ticks.
- **Accept when:** all checks pass and the user has played the Device and signed off.

#### 11.1 Mapping from Device controls to the engine

| Device control                         | New behavior                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instrument pads                        | Piano → `piano`, Guitar → `guitar`, Bass → `bass`, Drums → `drums`, Flute → `flute`, Sax → `saxophone`. Then `loadPreset(id)` + `preview()`, as today.                                                                                                                       |
| Shift + ← / →                          | Step through `DEVICE_PRESETS`: 6 entries at first, one per instrument. Variants (electric guitar, nylon guitar, …) are Phase 8.                                                                                                                                              |
| ← / → (octave)                         | Unchanged; the octave is folded into `midi`.                                                                                                                                                                                                                                 |
| Keys (held)                            | `midi = 53 + semitone + 12·octave + preset.octave`. `noteOn(midi, 0.8)` on press, `noteOff(midi)` on release. Default `preset.octave`: piano 0, guitar 0, bass −24, saxophone 0, flute +12 (semitones). Out-of-range notes fold by octaves (§8.1).                           |
| Chord macros                           | One `noteOn`/`noteOff` per chord note. Strings play the whole chord (guitar spreads it across strings); winds play the root (§6.6).                                                                                                                                          |
| Keys with Drums selected               | Keys map to pieces regardless of octave. White keys F G A B C D E → kick, snare, lowTom, highTom, clap, crash, cowbell. Black keys F♯ G♯ A♯ C♯ D♯ → closedHat, openHat, closedHat, closedHat, openHat. Same in both octaves. `hit(piece, 0.8)` on press; release is ignored. |
| Volume knob (`masterVol`)              | Master gain 0.25 / 0.5 / 0.75 / 1.0. Velocity is unchanged, so timbre is too.                                                                                                                                                                                                |
| Release knob                           | `envelope.release` of the current instrument. Strings: damper time. Winds: breath release. Drums: ignored.                                                                                                                                                                   |
| Filter cutoff knob                     | `filter.cutoff` = 500 / 1400 / 4000 / 14000 Hz for the current instrument.                                                                                                                                                                                                   |
| Waveform knob (`osc1Wave`)             | No physical equivalent. **Ask the user at the start of Phase 7:** (a) leave it inert until the UI pass (default: it still turns and the screen still draws the wave), or (b) temporarily map its 4 detents to `exciter.hardness` 0.2 / 0.45 / 0.7 / 0.95.                    |
| Screen                                 | Shows `DevicePreset.name` and the unchanged octave label. The waveform drawing waits for the UI pass.                                                                                                                                                                        |
| Device `onPointerUp` (`ensureContext`) | `deviceEngine.unlock()`. Also call it at the start of `pressKey`. On touch devices, audio unlocks only on pointerup (browser user-activation rules), so the very first touch may sound late or as a short blip; that's acceptable.                                           |
| Transport playback                     | `noteNameToMidi(note)` → `noteOn`/`noteOff` on the current preset's instrument.                                                                                                                                                                                              |
| Metronome                              | `metronomeTick(accent)`.                                                                                                                                                                                                                                                     |
| Window blur / page hidden              | Release every held note, as today; `allNotesOff()` is fine.                                                                                                                                                                                                                  |

Send `param` messages only when a setting actually changes. Cache the last values you applied inside `deviceEngine.ts`.

### Phase 8: Optional polish (only if the user asks)

- **Piano:** sympathetic resonance (a shared bank of 12–24 low-level string loops fed by the piano bus while the pedal is down); dispersion matched to real inharmonicity coefficients (Rauhala & Välimäki's tunable dispersion filter).
- **Guitar and bass:** an electric guitar patch (pickup comb + drive), bass slap with fret buzz, strummed chord macros on guitar, and the matching `DEVICE_PRESETS` variants.
- **Other:** Web MIDI input for the Device, and moving the DSP core to WASM if profiling shows the JS worklet is the bottleneck.

## 12. Checks and tests

**After every phase:**

```bash
npm run typecheck
npm run lint
npx prettier --check <changed files>
```

- Format only the files you changed (`npx prettier --write <files>`). Don't run `npm run format`, which rewrites the whole repo.
- Phases 0 and 7 also run `npm run build` (app + Storybook).
- Storybook smoke tests: `npx vitest run --project storybook`.

**Global tolerances (diagnostics):**

| Check           | Target                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Tuning, strings | ±3 cents on the fundamental, full range, 44.1 and 48 kHz                                        |
| Tuning, winds   | ±10 cents after calibration (±25 before)                                                        |
| Decay           | T60 within ±25% of expected (strings, drums)                                                    |
| Stability       | no NaN/Infinity; single fortissimo note peak ≤ −3 dBFS; DC offset magnitude < 0.005 after 0.5 s |
| Loudness        | mezzo-forte C4 (or nearest note) at −18 ± 2 dBFS RMS per instrument                             |
| Timing          | onset within ±1 sample of the scheduled frame                                                   |
| Lifecycle       | active voices = 0 and reverb asleep within (max T60 × 1.2 + 0.5 s) after the last event         |
| Performance     | real-time factor ≥ 8× (piano: 16 notes + pedal + reverb), ≥ 20× (guitar strum)                  |

**Unit tests to propose in Phase 0** (Vitest `node` project over `app/lib/physical/**/*.test.ts`; add it only if the user agrees):

- `phaseDelay`: `Allpass1` and `OnePole` match numeric phase measured from a rendered sine.
- `StringLoop`: tuning within ±3 cents for notes 28, 40, 60, 84, 100 at 44.1 and 48 kHz; T60 within ±25%.
- `Resonator2` and `ModalBank`: frequency and T60.
- `Svf`: −3 dB at cutoff (LP, Q 0.707) within ±5%.
- `Adsr`: reaches its targets at the specified times; retrigger doesn't jump.
- `Fdn`: T60 within ±20%; silence after sleep.
- `BoreVoice`: no NaN across pressure × note grid; the watchdog resets cleanly.
- `Engine`: sample-accurate onset; voice freeing; allocator rules (re-strike, per-string, mono legato, choke).

## 13. Risks and open questions

| Risk                                                                  | Mitigation                                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `?worker&url` fails for AudioWorklet in dev or in the prerender build | Phase 0 spike before any DSP work; fallbacks in §4.2 (ask before changing `vite.config.ts`)                                        |
| Loop filters detune the strings                                       | Phase-delay compensation (§6.1), verified by the tuning sweep                                                                      |
| Wind models squeal, stay silent or drift in pitch                     | Port STK constants exactly first; clamp pressure; watchdog; bake `tuningCents`                                                     |
| CPU too high (piano)                                                  | Per-block rendering, monomorphic voices, M → 0 in the treble, polyphony caps; profile before any WASM work                         |
| Home page still changing (uncommitted rewrite)                        | Engine phases (0–6) don't touch the Device. Before Phase 7, confirm with the user, re-read the files, and change only audio wiring |
| Realism ceiling (piano, cymbals)                                      | Accept v1 quality; Phase 8 upgrades; tune by ear with the user                                                                     |

**Questions for the user during the later UI pass** (record them; don't resolve them in this project):

1. The Waveform knob and the screen's waveform drawing have no physical-model meaning. What replaces them: a brightness/hardness knob, a section selector for the §8.2 parameters, a live scope from `getAnalyser()`?
2. Is the keybed drum mapping (§11.1) right, or should the Device get dedicated drum pads again?
3. Should guitar chord macros strum? Is root-only right for chords on the monophonic winds?
4. Should the Device get the six-section × four-knob parameter UI from §8.2?
5. Which `DEVICE_PRESETS` variants should Shift + ← / → step through (electric or nylon guitar, upright bass, soprano sax, alternative kits)?

## 14. Non-goals

- No changes to `/studio`, `app/lib/synth.ts`, or their components and storage.
- No Device layout, visual or interaction changes (§1). Phase 7 changes only audio wiring.
- No samples or impulse-response assets; everything is synthesized.
- No preset persistence, MIDI, pitch bend or mod wheel in v1 (the engine API leaves room for them).
- No WASM unless the performance targets fail after profiling.

## 15. References

- STK, the Synthesis ToolKit (Perry Cook & Gary Scavone): https://github.com/thestk/stk. Relevant files: `Flute`, `Saxofony`, `StifKarp` (stiff string, pickup position), `Plucked`, `Modal` / `ModalBar`, `JetTable`, `ReedTable`, `DelayA`, `DelayL`, `OnePole`, `PoleZero`.
- Julius O. Smith III, _Physical Audio Signal Processing_: https://ccrma.stanford.edu/~jos/pasp/ (waveguides, extended Karplus-Strong, commuted synthesis, piano hammer, reed and jet models).
- V. Välimäki et al., "Discrete-time modelling of musical instruments," _Reports on Progress in Physics_, 2006. A survey of all three families.
- A. Chaigne & A. Askenfelt, "Numerical simulations of piano strings," _JASA_, 1994. Hammer–string interaction and felt nonlinearity.
- J. Rauhala & V. Välimäki, "Tunable dispersion filter design for piano synthesis," _IEEE Signal Processing Letters_, 2006.
- A. Simper, "Linear Trapezoidal Integrated SVF" (Cytomic technical papers).
- J.-M. Jot & A. Chaigne, "Digital delay networks for designing artificial reverberators," AES 1991. FDN reverb.
