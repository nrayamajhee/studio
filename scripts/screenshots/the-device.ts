// docs/the-device: the numbered overview, the screen's parts, the pads, the
// keybed and every view.
import {
  C4,
  CHORD_PADS,
  INSTRUMENT_PADS,
  PAD,
  union,
  type Box,
  type Device,
} from "./device";

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const point = (x: number, y: number): Box => ({ x, y, width: 0, height: 0 });

export default async function theDevice(d: Device) {
  const { box, frame, key, knob, pad, page, press, screen, shot, tap } = d;
  const pads = async (indices: number[]) =>
    union(await Promise.all(indices.map((i) => box(pad(i)))));
  const keybed = frame.locator('[aria-label="Piano keys"]');

  const regions: Box[] = [
    await box(knob("chalk")),
    await box(knob("green")),
    await box(knob("red")),
    await box(knob("blue")),
    await box(screen),
    await pads(range(0, 11)),
    await pads([...range(12, 17), ...range(24, 29)]),
    await pads(INSTRUMENT_PADS),
    await pads(CHORD_PADS),
    await box(keybed),
  ];
  await shot("overview", {
    rings: regions,
    badges: regions.map((region, i) => [region, String(i + 1)]),
  });

  // The screen's parts, lettered where they sit.
  const s = await box(screen);
  const right = s.x + s.width;
  const bottom = s.y + s.height;
  await shot("screen-scope", {
    frame: "screen",
    badges: [
      [point(s.x + 14, s.y + 28), "A", "center"],
      [point(right - 14, s.y + 28), "B", "center"],
      [point(s.x + s.width / 2, s.y + s.height / 2 - 26), "C", "center"],
      [point(s.x + 14, bottom - 28), "D", "center"],
      [point(right - 14, bottom - 28), "E", "center"],
    ],
  });
  await press(PAD.instruments);
  await shot("screen-list", {
    frame: "screen",
    badges: [
      [point(s.x + 14, s.y + 28), "A", "center"],
      [point(s.x + s.width / 2, s.y + s.height / 2), "C", "center"],
      [point(s.x + 14, bottom - 28), "D", "center"],
      [point(right - 14, bottom - 28), "E", "center"],
    ],
  });
  await press(PAD.instruments);

  await shot("pads", {
    frame: "pads",
    badges: range(0, 35).map((i) => [pad(i), String(i + 1), "inside"]),
  });
  await page.keyboard.down("Shift");
  await d.settle();
  await shot("pads-shift", { frame: "pads" });
  await page.keyboard.up("Shift");
  await shot("keybed", { frame: "keys" });

  // Every view, on the screen.
  await page.keyboard.down("g");
  await d.settle(700);
  await shot("view-scope", { frame: "screen" });
  await page.keyboard.up("g");
  await d.settle(600);

  await press(PAD.instruments);
  await shot("view-instruments", { frame: "screen" });
  await press(PAD.instruments);

  await press(PAD.synth);
  await shot("view-synth", { frame: "screen" });
  await press(PAD.save);
  await shot("view-save", { frame: "screen" });
  await d.reload();

  await press(PAD.adsr);
  await shot("view-module", { frame: "screen" });
  await press(PAD.adsr);

  await press(PAD.chordPalette);
  await shot("view-chords", { frame: "screen" });
  await press(PAD.chordPalette);

  await press(PAD.playStyle);
  await shot("view-play-style", { frame: "screen" });
  await press(PAD.playStyle);

  await press(PAD.tempo);
  await shot("view-tempo", { frame: "screen" });
  await press(PAD.tempo);

  await press(PAD.roll, { shift: true });
  await shot("view-progressions", { frame: "screen" });
  await press(PAD.save);
  await key(C4).click();
  await d.settle();
  await shot("view-roll", { frame: "screen" });
  await press(PAD.save);

  await press(PAD.drumGrid, { shift: true });
  await shot("view-beats", { frame: "screen" });
  await tap("ArrowRight");
  await press(PAD.save);
  await shot("view-drum-grid", { frame: "screen" });
  await press(PAD.save);
  await shot("view-tracks", { frame: "screen" });

  await press(PAD.albums);
  await shot("view-tapes", { frame: "screen" });

  // Revert opens from the main screen only.
  await press(PAD.albums);
  await press(PAD.delete, { shift: true });
  await shot("view-revert", { frame: "screen" });
}
