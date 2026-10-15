---
order = 1
---

# The Device

The home page (`app/routes/home.tsx`) is **The Device**: an all-in-one virtual synthesizer, a compact music box with four knobs, a screen, 36 pads and a keybed, that holds a whole studio: a physically modelled sound engine (see [Synth engine](../internals/synth-engine.md)), a chord machine, a drum machine, a piano roll, and tapes of tracks to keep your songs on.

This section is the reference: where everything is and what it does in each view. To learn it by making a song, start with the [User manual](../user-manual/introduction.md).

![The Device, numbered: 1–4 the knobs, 5 the screen, 6–9 the pads, 10 the keybed](../../public/docs/the-device/overview.webp)

1. **White knob**: the volume.
2. **Green knob**: picks: the setting to change, the position in a list, a tape.
3. **Red knob**: the synth's level, or a list's page.
4. **Blue knob**: sets the picked setting, or picks in a list.
5. **Screen**: what the current view shows.
6. **Top row**: transport, Save, and the views: tapes, synth parameters, ADSR, LFO, FX, chords, play style, tempo.
7. **Left block**: editing (clip, mute, delete), the octave and arrows, Shift, and the tracks, piano roll, instruments and drum grid.
8. **Instrument pads**: six sounds, six more with Shift.
9. **Chord pads**: six chords to play from a single key.
10. **Keybed**: two octaves from F3 to E5, played with the mouse or the computer keyboard.

The Device has a fixed size, scaled to fit the window, and a light and a dark finish (the moon button at the top right of the page). Every control has a keyboard shortcut, printed on its corner.

- [Knobs](knobs.md): what each knob does in each kind of view.
- [Screen](screen.md): how every view lays out the screen.
- [Pads](pads.md): all 36 pads, their keys and their Shift jobs.
- [Keybed](keybed.md): the keys and their letters.
- [Views](views.md): every view, and what opens it.
