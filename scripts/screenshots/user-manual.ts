// docs/guides: the Device from the first note to a finished song, in the
// order the guides press it. A fresh browser opens on the starter song.
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
  const rhythm = await d.arrowUntil("ArrowRight", /Roll pulse/);
  await shot("play-style-rhythm", { rings: [pad(PAD.right)] });
  const strum = await d.arrowUntil("ArrowRight", /Folk strum/);
  await shot("play-style-strum", { rings: [pad(PAD.right)] });
  await d.taps("ArrowLeft", rhythm + strum);
  await press(PAD.playStyle);

  // Set the tempo.
  await press(PAD.tempo);
  await d.arrowUntil("ArrowLeft", /\b96\b/, 200);
  await shot("tempo", { rings: [pad(PAD.tempo)] });
  // Swing, set and then put back straight for the rest.
  await turn("red", /62%/);
  await shot("swing", { rings: [knob("red"), knob("blue")] });
  await turn("red", /Straight/, -1);
  await press(PAD.tempo);

  // Make a song: a new tape to build the starter song on.
  await press(PAD.albums);
  await shot("tapes", { rings: [pad(PAD.albums)] });
  await press(PAD.save);
  await shot("new-tape", { rings: [pad(PAD.save)] });
  await press(PAD.tracks);
  await shot("new-tape-tracks", { rings: [pad(PAD.tracks)] });

  // Make a song: Folk strum, the Suspended progression on D, then the
  // oscillator, three times round.
  const D4 = 5;
  await press(PAD.tracks);
  await press(PAD.playStyle);
  await d.arrowUntil("ArrowRight", /Folk strum/);
  await d.tile("Folk strum").click();
  await settle();
  await shot("folk-strum", { rings: [d.tile("Folk strum")] });
  await press(PAD.playStyle);
  await press(PAD.roll, { shift: true });
  await d.tile("Suspended").click();
  await settle();
  await shot("progressions", { rings: [d.tile("Suspended")] });
  await press(PAD.save);
  await shot("progression-home-note", { rings: [pad(PAD.save)] });
  await key(D4).click();
  await settle();
  await shot("progression-on-the-take", { rings: [key(D4)] });
  await press(INSTRUMENT_PADS[0], { shift: true });
  await shot("oscillator", {
    rings: [pad(PAD.shift), pad(INSTRUMENT_PADS[0])],
  });
  await press(PAD.play);
  await settle(1500);
  await shot("take-playing", { rings: [pad(PAD.play)] });
  await press(PAD.stop);
  await press(PAD.save);
  await shot("progression-saved-as-track", { rings: [pad(PAD.save)] });
  await press(PAD.right, { shift: true });
  await press(PAD.right, { shift: true });
  await shot("repeat", { rings: [pad(PAD.shift), pad(PAD.right)] });

  // Make a song: New jack swing, from bar 2 to the end.
  await press(PAD.drumGrid, { shift: true });
  await d.tile("New jack swing").click();
  await settle();
  await shot("beats", { rings: [d.tile("New jack swing")] });
  await press(PAD.save);
  await shot("drum-grid", { rings: [pad(PAD.save)] });
  await press(PAD.play);
  await settle(1200);
  await shot("drum-grid-playing", { rings: [pad(PAD.play)] });
  await press(PAD.stop);
  await press(PAD.save);
  await shot("beat-saved-as-track", { rings: [pad(PAD.save)] });
  await press(PAD.right);
  for (let i = 0; i < 10; i++) await press(PAD.right, { shift: true });
  await shot("drums-placed", { rings: [pad(PAD.shift), pad(PAD.right)] });

  // Make a song: the second oscillator, a saw under its sine, once over the
  // middle round.
  await press(PAD.tracks);
  await press(PAD.roll, { shift: true });
  await press(PAD.save);
  await key(D4).click();
  await settle();
  await press(INSTRUMENT_PADS[0]);
  await press(PAD.synth);
  await press(PAD.right);
  await turn("green", /Saw/);
  await turn("blue", /216°/);
  await shot("sine-and-saw", { rings: [knob("green"), knob("blue")] });
  await press(PAD.synth);
  await press(PAD.roll);
  await press(PAD.save);
  for (let i = 0; i < 4; i++) await press(PAD.right);
  await shot("second-oscillator", { rings: [pad(PAD.right)] });
  await press(PAD.stop);
  await press(PAD.play);
  await settle(6000);
  await shot("starter-song", { rings: [pad(PAD.play)] });
  await press(PAD.stop);
  await press(PAD.stop);
  await press(PAD.up);
  await press(PAD.up);

  // Make a song: managing the tracks.
  await press(PAD.down);
  await shot("pick-a-track", { rings: [pad(PAD.down)] });
  await press(PAD.down);
  await press(PAD.down, { shift: true });
  await press(PAD.right);
  await press(PAD.right);
  await shot("add-a-copy", { rings: [pad(PAD.shift), pad(PAD.down)] });
  // A copy's span in the picked lane, clicked to pick it.
  const copy = d.screen
    .locator(
      'button[aria-pressed="true"] span[class="absolute top-0 bottom-0 z-1"]',
    )
    .first();
  await copy.click();
  await d.page.mouse.move(1, 1);
  await settle();
  await shot("click-a-copy", { rings: [copy] });
  await press(PAD.up);
  await press(PAD.mute);
  await shot("mute", { rings: [pad(PAD.mute)] });
  await press(PAD.mute);
  await press(PAD.mute, { shift: true });
  await shot("solo", { rings: [pad(PAD.shift), pad(PAD.mute)] });
  await press(PAD.mute, { shift: true });
  await press(PAD.tempo);
  await shot("track-tempo", { rings: [pad(PAD.tempo)] });
  await press(PAD.tempo);
  await press(PAD.tracks);
  await press(INSTRUMENT_PADS[5]);
  await shot("track-instrument", { rings: [pad(INSTRUMENT_PADS[5])] });
  await press(INSTRUMENT_PADS[4]);
  await press(PAD.clip);
  await shot("clip", { rings: [pad(PAD.clip)] });
  await hold("Shift", 300);
  await shot("clip-shift", { rings: [pad(PAD.shift)] });
  await release("Shift");
  await press(PAD.delete);
  await shot("delete", { rings: [pad(PAD.delete)] });
  await d.reload();

  // Make a song: record your own playing, on the piano.
  await press(INSTRUMENT_PADS[0], { shift: true });
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

  // Undo and start over, from the main screen.
  await press(PAD.tracks);
  await press(PAD.delete, { shift: true });
  await shot("revert", { rings: [pad(PAD.shift), pad(PAD.delete)] });
}
