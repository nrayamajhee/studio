import type { Diagram } from "../draw";

// Pressing Z, from the key handler on the main thread to the voice on the
// audio thread.
export default {
  name: "key-to-sound",
  width: 860,
  height: 476,
  draw({ text, box, arrow, line }) {
    const steps = [
      {
        y: 24,
        title: "Press Z",
        note: "",
        tone: "ink",
        filled: true,
        mono: false,
      },
      { y: 84, title: "SynthDevice.pressKey", note: "a chord? expand it" },
      {
        y: 144,
        title: "deviceEngine.noteOn",
        note: "+ octave; a kit maps it to a piece",
      },
      {
        y: 204,
        title: "physicalSynth.noteOn",
        note: "postMessage, queued until booted",
        tone: "green",
      },
      {
        y: 288,
        title: "Engine.schedule",
        note: "no time: the next block",
        tone: "blue",
      },
      {
        y: 348,
        title: "StringInstrument.noteOn",
        note: "pick a voice, tune, excite",
        tone: "blue",
      },
      {
        y: 408,
        title: "voice → bus → master",
        note: "body, drive, limiter, speakers",
        tone: "blue",
        mono: false,
      },
    ] as const;
    steps.forEach((step, i) => {
      box({
        x: 24,
        y: step.y,
        w: 300,
        h: 44,
        title: step.title,
        tone: "tone" in step ? step.tone : "ink",
        filled: "filled" in step && step.filled,
        mono: "mono" in step ? step.mono : true,
      });
      if (step.note) text(350, step.y + 27, step.note, { tone: "muted" });
      const next = steps[i + 1];
      if (next)
        arrow([
          [174, step.y + 44],
          [174, next.y],
        ]);
    });
    line(
      [
        [24, 268],
        [836, 268],
      ],
      { tone: "faint", dashed: true },
    );
    text(836, 260, "main thread", { tone: "muted", size: 13, anchor: "end" });
    text(836, 286, "audio thread", { tone: "muted", size: 13, anchor: "end" });
  },
} satisfies Diagram;
