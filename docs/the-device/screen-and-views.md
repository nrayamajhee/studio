---
order = 2
---

# Screen and views

Every pad that opens something opens a **view**: the same knobs, pads and keys, given new jobs. The one underneath them all is the main screen.

## Layout

Every view lays the screen out the same way.

![The main screen: A the octave, B the level, C the wave, D the sound's name, E the setting the knobs change](../../public/docs/the-device/screen-scope.webp)

- **A, the status line's left**: the title or, on the main screen, the octave.
- **B, the status line's right**: a count or setting, in the colour of the knob that sets it.
- **C, the body**: the wave, a list of tiles, a page's graph, the roll, the drum grid or the tracks.
- **D, the footer's left**: what's picked, and messages: `Saved Grand piano`, `Press again to delete`.
- **E, the footer's right**: a hint, or what the knobs do now.

In a list, the status line is a **pager**: the page you're on in the middle, the ones either side, turned by the red knob or ← →. The tile picked by the blue knob is highlighted, and a badge marks a sound bound to an instrument pad (`1`, `⇧3`).

![The Instruments list: A the pager, C the tiles, D the picked sound, E the hint](../../public/docs/the-device/screen-list.webp)

A title with a dot, `Grand piano •`, has unsaved changes. Prompts (`Play the home note`) and levels appear over the middle.

## Views

### Main screen

![Main screen](../../public/docs/the-device/view-scope.webp)

**Opened by:** nothing; it's there whenever no other view is open. The wave of what's playing; green picks a setting, blue changes it, red sets the level.

### Instruments

![Instruments](../../public/docs/the-device/view-instruments.webp)

**Opened by:** Instruments. Red turns the families, blue picks, and while the library is open the keys and whatever is playing (the take, the tracks) sound on the picked instrument without it being chosen; closing the library brings back the one you had. An instrument pad twice binds the sound; Delete removes a saved one.

### Synth parameters

![Synth parameters](../../public/docs/the-device/view-synth.webp)

**Opened by:** Synth parameters. ← → turn the pages; the knobs set the page's four values; Shift its extras; Save opens the icon picker. With a track picked on the tracks, it opens on that track's instrument and settings, and every change is kept with the track; Shift + Delete, twice, resets the track's sound to its instrument's.

### Save

![Save](../../public/docs/the-device/view-save.webp)

**Opened by:** Save, from the synth parameters. Green picks an icon; Save keeps the sound, or an instrument pad saves it there.

### ADSR, LFO and FX

![The ADSR page](../../public/docs/the-device/view-module.webp)

**Opened by:** ADSR, LFO or FX. The knobs set its four values and switch it on; the badge shows on or off. With a track picked on the tracks they're the track's, and Shift + Delete, twice, puts that one back as it starts, off.

### Chords

![Chords](../../public/docs/the-device/view-chords.webp)

**Opened by:** Chords. Red turns the kinds, blue picks; a chord pad twice takes the chord.

### Play style

![Play style](../../public/docs/the-device/view-play-style.webp)

**Opened by:** Play style. Red turns the groups, blue picks; green sets the rate or strum; Save keeps it as a new style.

### Tempo

![Tempo](../../public/docs/the-device/view-tempo.webp)

**Opened by:** Tempo. Green and ← → set the tape's BPM (or drag or type the number); ↓ taps it in. With a track picked on the tracks they set that track's own tempo instead, and ↑ links it to the tape's tempo or gives it its own again. With no track picked, ↑ gives every track the tape's tempo as its own.

### Progressions

![Progressions](../../public/docs/the-device/view-progressions.webp)

**Opened by:** Shift + Piano roll. Red turns the kinds, blue picks; a tap or Play previews it in its own key, and a key previews it from that note, a little faster than the tape's tempo (by more the slower the tape is); Save, then a key, loads it as the take, at the tape's tempo.

### Beats

![Beats](../../public/docs/the-device/view-beats.webp)

**Opened by:** Shift + Drum grid. Red turns the styles, blue picks, and the keys play the picked beat's kit (the instrument pads keep their sounds); a tap or Play previews; Save loads it into the drum grid.

### Piano roll

![Piano roll](../../public/docs/the-device/view-roll.webp)

**Opened by:** Piano roll, or Record. The take: Record arms, Play records; green scrolls, red sets the time signature (Shift + red transposes the whole take, a semitone a step), blue the octave; Save keeps it as a track. A take keeps the timing it was played with and follows the tempo.

### Drum grid

![Drum grid](../../public/docs/the-device/view-drum-grid.webp)

**Opened by:** Drum grid. Green moves the head, keys set hits there; red sets the length, blue the resolution; Save keeps it as a track.

### Tracks

![Tracks](../../public/docs/the-device/view-tracks.webp)

**Opened by:** Tracks. See [the knob table](overview.md#knobs); ← → slide a track, Shift + ← → repeat it, Shift + ↓ picks the next copy of the whole track further along (past the last, adds one: ×2, ×3 on the row's right edge) and Shift + ↑ the one before; an instrument pad puts its sound on the picked track, which keeps every note it was played with (a tabla track's strokes carry over to the madal or a drum kit, and back); Mute, Clip, Delete; Save the mix.

### Tapes

![Tapes](../../public/docs/the-device/view-tapes.webp)

**Opened by:** Tapes. Green and ← → open a tape; Save starts a new one; Delete removes it.

### Revert

![Revert](../../public/docs/the-device/view-revert.webp)

**Opened by:** Shift + Delete on the main screen. In any other view Shift leaves Delete as it is, so close the view first. Green picks what to put back; Delete twice reverts it; any other pad closes.
