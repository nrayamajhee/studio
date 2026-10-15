> source available. all rights reserved.  
> AI was used and paid for.  
> no copyright infringement intended.

# Studio

Studio is a browser-based instrument. The home page hosts **The Device**: an all-in-one virtual synthesizer, a compact music box with its own sound engine, chord machine, drum machine and piano roll, played from the keyboard and recorded onto multitrack tapes.

<img alt="Screenshot" src="public/screenshot.png" />

## Docs

These docs, and this README, are also served in the app at `/docs` (`app/routes/docs.tsx`). The route reads every markdown file under `docs/` at build time and lists it in its sidebar. Each doc opens with a TOML config between two `---` lines giving its place in its folder (`order = 2`), and each folder has a `_meta.toml` giving its own `order` and the `title` the sidebar shows. A screenshot can have a dark twin beside it, `name.dark.webp` next to `name.webp`, which the route shows in the dark theme.

### [User manual](docs/user-manual/introduction.md)

A picture-by-picture walk through the Device, from the first note to a finished song. [Play notes and chords](docs/user-manual/play-notes-and-chords.md): a key plays a note, a chord pad turns it into several, the play style sets how they come out, and a progression strings chords together. [Shape the sound](docs/user-manual/shape-the-sound.md): pick an instrument, change how it's made on the Synth screen, and add the ADSR, LFO and FX. [Set the tempo](docs/user-manual/set-the-tempo.md). [Make a song](docs/user-manual/make-a-song.md): a chord progression on the piano roll, a drum beat in the drum grid, arranging the tracks (mute, solo, clip, slide, repeat, delete), and a new tape with your own playing recorded into it. Then [undo and start over](docs/user-manual/undo-and-start-over.md).

### [The Device](docs/the-device/overview.md)

The reference: where everything is on the Device and what it does. A numbered [overview](docs/the-device/overview.md) of the whole box, the [knobs](docs/the-device/knobs.md)' jobs in each kind of view, the [screen](docs/the-device/screen.md)'s layout, all 36 [pads](docs/the-device/pads.md) with their keys and Shift jobs, the [keybed](docs/the-device/keybed.md), and a picture of every [view](docs/the-device/views.md).

### Library

The music behind the Device's pickers.

- [Chord progressions](docs/library/chord-progressions.md): the source material behind the Device's chord progressions (Shift + Piano roll), compiled from all 51 videos of David Bennett's chord progressions playlist. Each entry gives the progression in Roman numerals, songs that use it and a short note on why it works, credited to him throughout.
- [Drum beats](docs/library/drum-beats.md): the 81 grooves behind the Device's drum beats (Shift + Drum grid), in ten styles from simple kick-and-hat starters through rock, funk, jazz, Latin, hip hop and electronic to classical and the tabla's taals. Each gives its kit, tempo and meter, the pattern as the drum grid plays it, what makes it feel the way it does, and the records and drummers to hear it from, from Hal Blaine's "Be My Baby" to the Amen break and Ravel's _Boléro_.

### Internals

How the Device is built.

- [Design rules](docs/internals/design-rules.md): fixed native size, two spacing tokens, theme colours that cross-fade, and hotkeys that never overlap.
- [Synth engine](docs/internals/synth-engine.md): the physical-modeling engine the Device plays through, explained with diagrams and screenshots of the Device's own Synth screen (in `public/docs/synth-engine/`): every voice is an exciter driving a resonator, rendered sample-accurately in one `AudioWorkletProcessor`. It starts with a table of each instrument family (strings, bowed, blown, free reeds, tuned percussion, drums and a plain oscillator) and the mix chain around them. Then it follows a note from the worklet and render loop through the signal flow and voice lifecycle, and goes through each instrument model in depth, along with bodies, the FDN reverb, the parameter system, the path from key press to sound, calibration, adding a patch or a Device preset, and a file map.

### Development

Working on Studio: setting it up, its stories and the rules agents follow.

- [Installation](docs/development/installation.md): install with `npm install`, then run the app on port `5173` and Storybook on `6006`. Build either one for production. Run the checks (typecheck, the DSP and engine unit tests, the headless story smoke tests, lint and format), and clean out build artifacts and dependencies when you want a fresh start.
- [Storybook](docs/development/storybook.md): how the component stories are organized: `Design System`, `Home`, `Page`, `Docs` and `Lab` titles, colocated with their components, each linked to its page in the app's `/storybook`. It also covers the conventions every story follows: a `Default` story bound to props, `autodocs`, a one-line description, the `withDevice` and `withDocs` decorators, and light and dark coverage through the theme addon.
- [Agent guidelines](docs/development/agent-guidelines.md): the rules for AI agents working in this repo. Stories start with a `Default` and add only focused variants. Styling is Tailwind only, with `tv` for variants and types instead of interfaces. Scratch and restating comments are stripped before handing work back, and no interaction tests are written without asking first.

## Credits

The Device's chord progressions are based on the chord progression analyses by **David Bennett** of [David Bennett Music Theory](https://www.youtube.com/channel/UCz2iUx-Imr6HgDC3zAFpjOw), compiled from his [chord progressions playlist](https://www.youtube.com/playlist?list=PLlx2eo2tD6KpfGmE-MXwcIRQh21neAKsK). All credit for the analyses, their names and the song examples goes to him; watch his videos for the full explanations.
