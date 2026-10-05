# SynthDevice refactor plan

## Goal

Break up `app/components/home/SynthDevice.tsx` (3,434 lines). Today it holds
every provider-worthy state machine, all cross-domain command handlers, and the
entire render tree. After this refactor it should be a composition root: a stack
of providers wrapping a handful of small subcomponents.

Two moves are required, and both are in scope:

1. **Extract providers** — pull the state, refs, effects and domain actions out
   of `SynthDevice` into React context providers, mirroring `HotkeyProvider`.
2. **Decompose the JSX** — split the render tree into subcomponents, and turn
   the per-view `view === …` ternaries for the knobs and the screen into
   per-view descriptor tables.

Providers alone remove ~2,190 lines of logic but leave the ~870-line render tree
untouched. Both together get `SynthDevice.tsx` down to roughly 15 lines.

## Current state

| Area | Location | Notes |
| --- | --- | --- |
| Component body | `SynthDevice.tsx:373–2560` | State, refs, effects, all handlers |
| Render tree | `SynthDevice.tsx:2562–3433` | ~870 lines |
| `screen` config | `SynthDevice.tsx:2117–2560` | ~440 lines of per-view conditionals |
| `seek` / `badge` | `SynthDevice.tsx:2194–2283` | More per-view conditionals |
| DeviceScreen prop block | `SynthDevice.tsx:2639–2802` | ~164 lines, ~40 props |
| Knob columns | `SynthDevice.tsx:2574–2635`, `2806–2984` | ~240 lines of nested ternaries |
| Pad banks | `SynthDevice.tsx:2987–3413` | ~427 lines across three rows |
| Keybed | `SynthDevice.tsx:3414–3429` | ~16 lines |

Existing shared state, for reference:

- `HotkeyProvider` (`app/providers/HotkeyProvider.tsx`) — the one React context;
  owns held keys, publishes state for render, exposes `subscribe` for listeners.
- `presetStore`, `chordStore`, `sessionStore` — module singletons consumed via
  `useSyncExternalStore`, persisted in `localStorage`. **Leave as-is.**
- `useTransport`, `useStepPlayer`, `useTrackMix`, `useMixScrub`, `useScrub` —
  hooks. `useTransport` becomes a provider; the rest stay hooks used inside
  providers.

## Architecture rules

1. **Domain providers expose state + primitives; one controller orchestrates
   cross-domain flows.** Handlers such as `pressPlay`, `pressSave`,
   `toggleSteps` and `saveTrack` touch 3–5 domains and cannot live inside any
   single provider. They move to `DeviceProvider`. This is what keeps the
   dependency graph acyclic.
2. **Keep per-frame data on refs / imperative getters.** `roll`, `mix.position`,
   `stepPlayer.position` and the analyser stay getters, exactly as
   `HotkeyProvider` splits `held` (state) from `subscribe` (stable API).
3. **Split each provider into a state context and a stable actions context**
   where it re-renders often (Transport's `beat`, Tracks' playhead). Read state
   from the state context; call actions from the actions context.

### Dependency order

```
HotkeyProvider (exists)
└ FeedbackProvider        notices, overlays, saving, confirm-to-arm
└ ViewProvider            view, moduleReturn, toggleView, leaveRevert
└ MasterLevelProvider     volume, level, idleSeek
└ TransportProvider       useTransport() + take/record/play
└ SoundProvider           preset, values, params, save/delete/revert
└ PerformanceProvider     keys, chords, octave, shift, lit notes
└ TracksProvider          selection, zoom/pan, clips, mix, scrub, export
└ SequencerProvider       step pattern, player, taps
└ ModuleProvider          ADSR/LFO/FX
└ DeviceProvider          controller: cross-domain commands + screen config
```

## Step 0 — Extract shared bits out of `SynthDevice.tsx`

Providers cannot import `SynthDevice` without a cycle. Move these first:

- `HeldKey` (`SynthDevice.tsx:366`) → `app/components/home/input/performance.ts`
- `useMomentary` (`SynthDevice.tsx:343`) → `app/providers/useMomentary.ts`
- `F3_MIDI`, `KEY_VELOCITY`, `NOTE_NAMES`, `WHITE_KEYS`, `BLACK_KEYS`,
  `spokenNote`, `engravedNote` (`SynthDevice.tsx:271–320`) →
  `app/components/home/input/keybed.ts`
- `octaveLimits`, `clampOctave` (`SynthDevice.tsx:297`) →
  `app/components/home/input/keybed.ts`
- `turnPage` (`SynthDevice.tsx:327`) → `app/components/home/input/paging.ts`
- `TRACK_ZOOMS` (`SynthDevice.tsx:269`) → `app/components/home/tracks.ts` or a
  small device constants module

## Step 1 — `FeedbackProvider`

`app/providers/FeedbackProvider.tsx`

- Owns `overlay`, `notice`, `prompt`, `saving`, the `exporting` ref
  (`SynthDevice.tsx:435–436`, `682`, `681`).
- Exposes `showOverlay`, `showNotice`, `showPrompt`, `hidePrompt`, `showSaving`,
  `setSaving`.
- Consolidates the four parallel confirm states — `pendingDelete` (`:446`),
  `pendingRevert` (`:449`), `pendingBind` (`:452`), `pendingChord` (`:453`) —
  into one mechanism: `confirm(id, run, message)` plus `pending: string | null`.
  First call arms and shows the prompt; a second call with the same `id` runs.
  This also removes the inline `pendingDelete === (trash?.id ?? track?.id ?? …)`
  at `:3217`.
- Exposes the DeviceScreen-ready
  `overlayForScreen = saving ?? overlay ?? (prompt ? { label: prompt } : undefined)`,
  replacing the assembly at `:2643`.

## Step 2 — `TransportProvider`

`app/providers/TransportProvider.tsx`

- Wraps `useTransport()` (`SynthDevice.tsx:457`) unchanged and re-exports its
  value.
- `tapMode` stays derived in the controller (`transport.tapping && view === "tempo"`,
  `:495`).
- Record arming (`armed`, `armedView`, `recordArmed`, `:1016–1023`) is **not**
  here: its reset effect touches `selectedIndex`, so it lives in `DeviceProvider`.

## Step 3 — `ViewProvider`

`app/providers/ViewProvider.tsx`

- Owns `view`, `moduleReturn` (`:381–383`), `setView`, `toggleView` (`:874`),
  `leaveRevert` (`:869`).
- No domain dependencies, so every domain may read `view` and call `setView`.

## Step 4 — `MasterLevelProvider`

`app/providers/MasterLevelProvider.tsx`

- Owns `volumeStep`, `levelStep` (`:378–379`), `idleSeek` (`:380`), `setVolume`
  (`:1859`), `setLevel` (`:1965`), and the corresponding `deviceEngine` calls.

## Step 5 — `SoundProvider` (fulfils `PresetEditingProvider`)

`app/providers/SoundProvider.tsx`

- Owns `preset` (`:376`), `edits` / `values` / `specs` / `selected` /
  `selectedValue` (`:824–830`), `paramIndex` / `paramPage` (`:377`, `:384`),
  `iconIndex` (`:385`), `presetIndex` (`:386`), `revertIndex` (`:448`).
- Owns `selectPreset` (`:923`), `selectParam` / `showParamPage` /
  `setSelectedValue` (`:1810–1829`), `saveToPad` / `finishSave` / the preset
  branch of `pressSave` (`:1775–1805`), `pressDelete` (`:1241`), `revertOptions`
  / `pressRevert` (`:1871–1962`), `soundName` (`:1728`), `params` / `pages` /
  `paging` (`:2123–2134`).
- Depends on: `presetStore`, `TransportProvider` (revert tempo tile),
  `FeedbackProvider`.

## Step 6 — `PerformanceProvider`

`app/providers/PerformanceProvider.tsx`

- Owns `held` / `keyNotes` (`:454–456`), `pressKey` / `releaseKey`
  (`:879–919`), `litNotes` / `syncLitNotes` (`:432`, `:862`), `octave` (`:418`),
  `shiftLatched` (`:420`), `chord` / `activeChord` / `toggleChord`
  (`:421`, `:431`, `:1401`), chord macros / style / `pickChordStyle`
  (`:423–429`, `:1439`), and the release-on-blur effect (`:841–860`).
- Subscribes to `HotkeyProvider` for note/chord/shift controls (`:2075–2106`) and
  calls `transport.capture`.
- Depends on: `HotkeyProvider`, `TransportProvider`, `ViewProvider` (steps
  special-case `:891`, `:908`), `SoundProvider` (octave limits, kit).
- Exposes `pressSemitone` / `releaseSemitone` so `renderKey` (`:2018`) and the
  hotkey listener stay thin.

## Step 7 — `TracksProvider`

`app/providers/TracksProvider.tsx`

- Owns `selectedIndex` (`:413`), `zoomStep` / `panFrom` (`:416–417`),
  `dragSpan` / `knobSpan` / `hadClipKnobs` (`:609–616`), `clips` / `fitSpan` /
  `trackSpan` / `trackZoom` / `trackFrom` / `panSteps` (`:568–636`),
  `panTracks` / `zoomTracks`, `mix` (`useTrackMix`, `:638`), `mixScrub`
  (`useMixScrub`, `:758`), `mixScrubPos` / `scrubMix` / `mixAt` / `mixBars` /
  `mixStep` (`:776–798`), `mixParts` / `renderMix` (`:643–674`).
- Owns track edits: `updateTrack` / `slideTrack` / `repeatTrack` / `setLoopEdge`
  / `dragLoopEdge` / `toggleClip` / `trimToClip` / `pressLoop` /
  `pressTrackSwitch` (`:1607–1724`), and `exportMix` (`:689`) plus its `saving`
  wiring.
- Derives `entries` / `takeTrack` / `picked` / `isTake` / `track`
  (`:499–517`) and `screenTracks` (`:2532`).
- Depends on: `sessionStore`, `TransportProvider`, `ViewProvider`,
  `SoundProvider`, `FeedbackProvider`.

## Step 8 — `SequencerProvider`

`app/providers/SequencerProvider.tsx`

- Owns `stepCursor` / `stepHead` / `stepHeadRef` (`:539–544`), `stepRecording`
  (`:545`), `stepPlayer` (`:546`), `getStepHead` (`:553`), `stepRows` /
  `stepCount` / `stepsPerBar` / `stepHits` (`:535–565`), `tapStep` /
  `toggleStep` / `moveStepHead` / `setStepResolution` / `stopSteps` /
  `playSteps` (`:1047–1104`), `beforeSteps` / `restoreAfterSteps`
  (`:822`, `:936`).
- Depends on: `sessionStore` (steps), `TransportProvider`, `ViewProvider`,
  `SoundProvider` (kit).
- `toggleSteps` (`:1109`) and `saveSteps` (`:1139`) are cross-domain → they live
  in `DeviceProvider`.

## Step 9 — `ModuleProvider`

`app/providers/ModuleProvider.tsx`

- Owns `modules` / `moduleOn` / `moduleSteps` / `modulesKey` / `modulesOwner` /
  `setModules` (`:521–529`), `setModuleStep` (`:1832`), `pressModule` (`:1844`),
  the `applyModules` effect (`:839`), `readouts` / `activeModule`
  (`:2135–2148`), `renderModuleKnob` / `renderModulePad` (`:1976–2015`).
- Depends on: `ViewProvider`, `sessionStore`, `TracksProvider` (picked entry).

## Step 10 — `DeviceProvider` (fulfils `ScreenProvider`)

`app/providers/DeviceProvider.tsx`

- Cross-domain commands: `pressPlay` / `pressStop` / `pressRecord` /
  `pressMetronome` (`:1168–1361`), `pressTool` (`:1363`), `pressTrash`
  (`:1261`), `pressSave` (`:1740`), `pressSynth` / `pressTracks` / `pressTake`
  (`:1478–1577`), `step` / `pickRow` (`:961–1009`), `pressMute` / `pressClip`
  (`:1425–1437`), `pressPresetPad` / `pressChordPad` (`:1406–1475`),
  `toggleSteps` / `saveSteps` / `saveTrack` / `startSong` / `pickSong` /
  `leaveSong` (`:1109–1534`), `startRecording` / `pause` / `pauseTape`
  (`:1027–1043`).
- Record arming: `armed` / `armedView` / `recordArmed` (`:1016–1023`), because
  its reset effect touches both `view` and `selectedIndex`.
- The HotkeyProvider listener (`:2067`) and the ⌘S / ⌫ handler (`:2044–2065`).
- Derived screen config, via `useScreenConfig()` (Step 11): `screen` / `badge` /
  `seek` / `selection` (`:2117–2560`).

## Step 11 — JSX decomposition (aggressive)

### 11a. Knobs → descriptor table

- `app/components/home/synth-device/useKnobSpecs.ts` — returns four `KnobSpec`
  descriptors for the current view/state; resolves the module override and all
  Shift sub-branches internally. Replaces the ternaries at `:2574–2984`.
  `KnobSpec = { label, valueLabel, step, steps, color, markColor?, fine?, onChange }`.
- `LeftKnobs.tsx` (~15 lines) renders `specs[0]`, `specs[1]`.
- `RightKnobs.tsx` (~15 lines) renders `specs[2]`, `specs[3]`.

### 11b. DeviceScreen → per-view registry

- `useScreenProps.ts` (~120) — the ~30 props common to every view, from context.
- `screenViews.tsx` (~300) — `{ [view]: (ctx) => { title, status, footer, badge? } }`,
  replacing the `screen` object (`:2117–2560`).
- `screenTiles.tsx` (~150) — tile / selected / onSelect builders for save icons,
  presets, songs, chords, chord styles and revert (`:2698–2778`).
- `ScreenSlot.tsx` (~100) — merges common props + the current view config and
  renders `<DeviceScreen/>` (replacing `:2639–2802`).

### 11c. Pads → six banks

- `PadBanks.tsx` composes:
  - `TransportBank.tsx` (~70) — `:2992–3087`
  - `ViewsBank.tsx` (~60) — `:3088–3145`
  - `EditBank.tsx` (~110) — `:3146–3257`
  - `PresetBank.tsx` (~30) — `:3258–3287`
  - `ControlsBank.tsx` (~80) — `:3289–3389`
  - `ChordBank.tsx` (~25) — `:3390–3411`

### 11d. Remaining subcomponents

- `Keybed.tsx` (~40) — the white/black key maps and `renderKey` (`:3414–3429`).
- `Grille.tsx` — the memoized grille, relocated (`:257`).

### Resulting `SynthDevice.tsx`

`SynthDevice` provides the context stack, so the part that reads `saving` and
lays out the frame must be a **child component** — a component cannot consume
context it provides itself. `DeviceFrame` therefore has to be a distinct
function, but it does not need its own file: at ~20 lines it stays a local
component in `SynthDevice.tsx`, keeping the composition root self-contained.

```tsx
export function SynthDevice({ className }: SynthDeviceProps) {
  return (
    <DeviceProviders>
      <DeviceFrame className={className} />
    </DeviceProviders>
  );
}

function DeviceFrame({ className }: SynthDeviceProps) {
  const { saving } = useFeedback();
  return (
    <div className={cn(styles.stage, className)}>
      <div className={styles.frame}>
        <div
          className={styles.device}
          role="group"
          aria-label="Synthesizer"
          aria-busy={saving !== null}
          inert={saving !== null}
          onPointerUp={() => deviceEngine.unlock()}
        >
          <div className={styles.topRow}>
            <LeftKnobs />
            <Grille />
            <ScreenSlot />
            <Grille />
            <RightKnobs />
          </div>
          <PadBanks />
          <Keybed />
        </div>
      </div>
    </div>
  );
}
```

## Step 12 — `DeviceProviders` wrapper and wiring

- `app/components/home/synth-device/DeviceProviders.tsx` composes the full provider
  stack in dependency order.
- Decide whether `HotkeyProvider` moves inside `DeviceProviders` (single source
  of truth) or stays external. Recommended: move it in, then update
  `app/routes/home.tsx:59` and
  `app/components/home/SynthDevice.stories.tsx:13` to wrap once.
- `SynthDevice` becomes the composition root above.

## Tricky couplings (resolved)

| Coupling | Resolution |
| --- | --- |
| `view` read everywhere, set by orchestration | Low-level `ViewProvider` |
| `preset` needed by Performance/Sequencer/Sound | Current preset lives in `SoundProvider`, below Performance/Sequencer |
| `saveSteps` calls `mix.stop` + `setSelectedIndex` + `setTracks` | Flows stay in `DeviceProvider`; `SequencerProvider` exposes primitives only |
| `armed` touches `view` and `selectedIndex` | Lives in `DeviceProvider` |
| Context re-render cost on `beat` / playheads | Split state/actions contexts; keep playheads as getters |

## File map (target)

```
app/components/home/SynthDevice.tsx        ~40 lines   (providers + local DeviceFrame)
app/components/home/synth-device/
  DeviceProviders.tsx
  LeftKnobs.tsx  RightKnobs.tsx  useKnobSpecs.ts
  ScreenSlot.tsx useScreenProps.ts screenViews.tsx screenTiles.tsx
  PadBanks.tsx TransportBank.tsx ViewsBank.tsx EditBank.tsx
  PresetBank.tsx ControlsBank.tsx ChordBank.tsx
  Keybed.tsx Grille.tsx
app/providers/
  FeedbackProvider.tsx ViewProvider.tsx MasterLevelProvider.tsx
  TransportProvider.tsx SoundProvider.tsx PerformanceProvider.tsx
  TracksProvider.tsx SequencerProvider.tsx ModuleProvider.tsx
  DeviceProvider.tsx useMomentary.ts
app/components/home/input/
  performance.ts keybed.ts paging.ts
```

No file should exceed ~300 lines. `SynthDevice.tsx` is a pure composition root.

## Execution order (single pass)

1. Step 0 — shared module extraction.
2. Step 1 — `FeedbackProvider` (+ fold the four confirm states into `confirm`).
3. Step 2 — `TransportProvider`.
4. Step 3 — `ViewProvider`.
5. Step 4 — `MasterLevelProvider`.
6. Step 5 — `SoundProvider`.
7. Step 6 — `PerformanceProvider`.
8. Step 7 — `TracksProvider`.
9. Step 8 — `SequencerProvider`.
10. Step 9 — `ModuleProvider`.
11. Step 10 — `DeviceProvider` controller.
12. Step 11 — JSX decomposition (knobs, screen registry, six banks, keybed,
    grille; local `DeviceFrame`).
13. Step 12 — `DeviceProviders` wrapper; update `home.tsx` and the story; slim
    `SynthDevice`.
14. Run all checks.

## Risks

- **Descriptor translation.** Knob and screen descriptor tables must be a 1:1
  mapping of the current branches (labels, `fine`, `markColor`, `steps`,
  `onChange`, disabled states). A missed branch silently changes behavior.
- **Context re-renders.** Without state/actions splits, a knob turn re-renders
  every consumer. Currently the whole Device re-renders anyway, so this is
  neutral-to-better, but split where measured.
- **Ordering.** A provider used before its dependency is mounted throws at
  runtime; keep the dependency order above.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npx vitest run --project storybook`
- `npm run build`
- Manual matrix in Storybook `Home/Device` (both themes): record / play, drum
  sequencer, tracks / mix / scrub / export, chord palette and style, save /
  delete / revert, octave and Shift ranges.

## Out of scope

- No new automated tests (per repo testing guideline; ask before adding).
- `presetStore`, `chordStore`, `sessionStore` and the scrub/mix/step hooks stay
  as they are.
- No behavior changes; this is a structural refactor only.
