// docs/guides: the Device from the first note to a finished song, in the
// order the guides press it.
import { C4, INSTRUMENT_PADS, PAD, type Device } from "./device";

export default async function userManual(d: Device) {
  const { key, knob, pad, page, press, settle, shot, turn } = d;
  const hold = async (keyName: string, ms = 700) => {
    await page.keyboard.down(keyName);
    await settle(ms);
  };
  const release = async (keyName: string) => {
    await page.keyboard.up(keyName);
    await settle(600);
  };

  // Play notes and chords.
  await shot("device");
  await hold("g");
  await shot("play-a-note", { rings: [key(C4)] });
  await release("g");
  await press(PAD.up);
  await shot("octave-up", { rings: [pad(PAD.up)] });
  await press(PAD.down);

  // Shape the sound: pick an instrument.
  await press(INSTRUMENT_PADS[1]);
  await shot("instrument-pads", { rings: INSTRUMENT_PADS.map(pad) });
  await press(INSTRUMENT_PADS[0]);
  await press(PAD.instruments);
  await shot("instruments", { rings: [pad(PAD.instruments)] });
  const blown = await d.arrowUntil("ArrowRight", /Clarinet/);
  await shot("instruments-blown", { rings: [pad(PAD.right)] });
  await d.taps("ArrowLeft", blown);
  await press(PAD.instruments);

  // Shape the sound: change how it's made.
  await press(PAD.synth);
  await shot("synth-chain", { rings: [pad(PAD.synth)] });
  await press(PAD.right);
  await shot("synth-exciter", { rings: [pad(PAD.right)] });
  await turn("green", /32%/);
  await shot("synth-turn-a-knob", { rings: [knob("green")] });
  await turn("green", /12%/, -1);
  await press(PAD.save);
  await shot("save-instrument", { rings: [pad(PAD.save)] });
  await d.reload();

  // Shape the sound: the master effects.
  await press(PAD.adsr);
  await shot("adsr", { rings: [pad(PAD.adsr)] });
  await press(PAD.adsr, { shift: true });
  await shot("adsr-on", { rings: [pad(PAD.shift), pad(PAD.adsr)] });
  await press(PAD.adsr, { shift: true });
  await press(PAD.lfo);
  await shot("lfo", { rings: [pad(PAD.lfo)] });
  await press(PAD.fx);
  await shot("fx", { rings: [pad(PAD.fx)] });
  await press(PAD.fx);

  // Play notes and chords: chords and play styles.
  const major = pad(35);
  await press(35);
  await hold("g");
  await shot("chord-pad", { rings: [major, key(C4)] });
  await release("g");
  await press(35);
  await press(PAD.chordPalette);
  await shot("chords", { rings: [pad(PAD.chordPalette)] });
  await press(PAD.chordPalette);
  await press(PAD.playStyle);
  await shot("play-style", { rings: [pad(PAD.playStyle)] });
  const rhythm = await d.arrowUntil("ArrowRight", /Strum pulse/);
  await shot("play-style-rhythm", { rings: [pad(PAD.right)] });
  await d.taps("ArrowLeft", rhythm);
  await press(PAD.playStyle);

  // Set the tempo.
  await press(PAD.tempo);
  await d.arrowUntil("ArrowLeft", /\b72\b/, 200);
  await shot("tempo", { rings: [pad(PAD.tempo)] });
  await press(PAD.tempo);

  // Make a song: chords on the piano roll.
  await press(PAD.roll, { shift: true });
  await shot("progressions", { rings: [pad(PAD.shift), pad(PAD.roll)] });
  await press(PAD.save);
  await shot("progression-home-note", { rings: [pad(PAD.save)] });
  await key(C4).click();
  await settle();
  await shot("progression-on-the-take", { rings: [key(C4)] });
  await press(PAD.play);
  await settle(1500);
  await shot("take-playing", { rings: [pad(PAD.play)] });
  await press(PAD.stop);
  await press(PAD.save);
  await shot("progression-saved-as-track", { rings: [pad(PAD.save)] });

  // Make a song: a beat in the drum grid.
  await press(PAD.drumGrid, { shift: true });
  await shot("beats", { rings: [pad(PAD.shift), pad(PAD.drumGrid)] });
  await d.arrowUntil("ArrowRight", /Punk/);
  await shot("beats-rock", { rings: [pad(PAD.right)] });
  await press(PAD.save);
  await shot("drum-grid", { rings: [pad(PAD.save)] });
  await press(PAD.play);
  await settle(1200);
  await shot("drum-grid-playing", { rings: [pad(PAD.play)] });
  await press(PAD.stop);
  await press(PAD.save);
  await shot("beat-saved-as-track", { rings: [pad(PAD.save)] });

  // Make a song: arrange the tracks.
  await press(PAD.play);
  await settle(1500);
  await shot("tracks-playing", { rings: [pad(PAD.play)] });
  await press(PAD.stop);
  await press(PAD.up);
  await shot("pick-a-track", { rings: [pad(PAD.up)] });
  await press(PAD.down);
  await press(PAD.right);
  await shot("slide", { rings: [pad(PAD.right)] });
  await press(PAD.right, { shift: true });
  await shot("repeat", { rings: [pad(PAD.shift), pad(PAD.right)] });
  await press(PAD.mute);
  await shot("mute", { rings: [pad(PAD.mute)] });
  await press(PAD.mute);
  await press(PAD.mute, { shift: true });
  await shot("solo", { rings: [pad(PAD.shift), pad(PAD.mute)] });
  await press(PAD.mute, { shift: true });
  await press(PAD.clip);
  await shot("clip", { rings: [pad(PAD.clip)] });
  await hold("Shift", 300);
  await shot("clip-shift", { rings: [pad(PAD.shift)] });
  await release("Shift");
  await press(PAD.delete);
  await shot("delete", { rings: [pad(PAD.delete)] });
  await d.reload();

  // Make a song: start a new tape.
  await press(PAD.albums);
  await shot("tapes", { rings: [pad(PAD.albums)] });
  await press(PAD.save);
  await shot("new-tape", { rings: [pad(PAD.save)] });
  await press(PAD.tracks);
  await shot("new-tape-tracks", { rings: [pad(PAD.tracks)] });
  await press(INSTRUMENT_PADS[2]);
  await press(PAD.roll);
  await press(PAD.record);
  await shot("record-armed", { rings: [pad(PAD.record)] });
  await press(PAD.play);
  for (const note of ["g", "h", "j", "g", "k", "j"]) {
    await page.keyboard.down(note);
    await settle(220);
    await page.keyboard.up(note);
    await settle(90);
  }
  await shot("recording", { rings: [pad(PAD.play)] });
  await press(PAD.record);
  await shot("take", { rings: [pad(PAD.record)] });
  await press(PAD.save);
  await shot("take-saved", { rings: [pad(PAD.save)] });

  // Undo and start over.
  await press(PAD.delete, { shift: true });
  await shot("revert", { rings: [pad(PAD.shift), pad(PAD.delete)] });
}
