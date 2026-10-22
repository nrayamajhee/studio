---
order = 4
---

# MIDI

Plug in a MIDI keyboard or controller and it plays the Device: its keys play the keybed, its sustain pedal holds notes, and its knobs and pads, once mapped, turn and press the Device's own. The **MIDI** button beside the light/dark switch, at the top right of the page, opens the panel that sets it up; a green dot on the button means a controller is plugged in. The Device still plays under the panel, so a mapping can be tried at once.

Web MIDI works in Chrome, Edge and Firefox, not in Safari.

## Turn it on

The switch in the panel's header turns MIDI on. The browser asks first; once it's allowed, MIDI comes back on by itself on the next visit. If the browser blocked it, allow MIDI for the site in the browser's site settings and turn it on again.

The browser keeps the page silent until it's clicked once, so a controller played first shows "Click the page to hear MIDI" on the screen instead.

## Input

Every input plays, unless one is picked. A picked input that isn't plugged in stays listed, so it plays again when it comes back.

## Keys

| Setting             | What it does                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel             | the channel the keys play from, or any                                                                                                                                            |
| Octave              | moves every key up to three octaves either way                                                                                                                                    |
| Velocity            | as played, or fixed at the keybed's own mezzo-forte                                                                                                                               |
| Sustain pedal       | CC 64 holds each note after its key lets go, until the pedal comes up                                                                                                             |
| Drums on channel 10 | with a kit, notes on channel 10 strike its pieces by their General MIDI keys (36 kick, 38 snare, 42 closed hat…); a piece the kit doesn't have plays the note as the keybed would |

A key plays its own note, whatever octave the keybed shows, past either end of it too; the keybed lights the ones it shows. Everything else is as for the keybed: a held or latched chord pad turns each key into its chord in the play style, a kit plays a drum on each key, and a view that takes a key for a job of its own (a progression waiting for its home note) takes MIDI keys too. A recorded take keeps each note's velocity, and a note the pedal held keeps its length.

## Mapping

Click a knob or pad in the panel, then turn a knob or press a pad or key on the controller: from then on that control does what the Device's does, in every view.

- A **knob** takes a CC, and sets the Device's knob across its whole range: 0 turns it fully left, 127 fully right. Set the controller's knobs to absolute; endless encoders sending relative steps aren't read.
- A **pad** takes a CC or a note. It's held while the control is (a CC from 64 up), so a mapped chord pad holds its chord and a mapped Shift holds Shift. A mapped key presses its pad instead of playing a note. Save, which has no key of its own, can be mapped too.

Mapping a control again moves it to the new knob or pad. Click the waiting knob or pad again, or Cancel, to stop; Forget drops the waiting one's mapping, and Forget all every mapping.

The **Monitor**, under the mapping, lists the last eight messages: the channel, the message, what the Device did with it and the input it came from. Pitch bend, program changes and pressure show there but do nothing.

The settings and mappings are kept in `localStorage` under `studio.midi`, which the Debug overlay shows.
