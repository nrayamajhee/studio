import type { Diagram } from "../draw";

// A free reed: a van der Pol reed swings past the slot, and the sound is the
// slope of the air let through.
export default {
  name: "free-reed",
  width: 860,
  height: 286,
  draw({ text, box, arrow }) {
    text(24, 30, "pressure = ADSR × drive × (1 + swell)", {
      tone: "green",
      size: 13.5,
      mono: true,
    });
    arrow(
      [
        [120, 42],
        [120, 76],
      ],
      { tone: "green" },
    );
    box({
      x: 24,
      y: 76,
      w: 220,
      h: 100,
      title: "Reed",
      lines: [
        "van der Pol: a resonator",
        "at the note, fed by its",
        "own speed",
      ],
      tone: "green",
      filled: true,
    });
    box({
      x: 320,
      y: 76,
      w: 220,
      h: 100,
      title: "Slot",
      lines: ["air past once it", "swings past the gap,", "× √pressure"],
    });
    box({
      x: 616,
      y: 76,
      w: 220,
      h: 100,
      title: "d/dt",
      lines: ["the flow's slope:", "the radiated sound"],
      tone: "blue",
      mono: true,
    });
    arrow([
      [244, 120],
      [320, 120],
    ]);
    text(282, 111, "x", {
      tone: "muted",
      size: 13,
      anchor: "middle",
      mono: true,
    });
    arrow([
      [540, 120],
      [616, 120],
    ]);
    text(578, 111, "flow", { tone: "muted", size: 13, anchor: "middle" });
    text(430, 200, "+ air noise", {
      tone: "muted",
      size: 13,
      anchor: "middle",
    });
    arrow([
      [726, 176],
      [726, 226],
    ]);
    text(714, 222, "DC block → lowpass → bus", {
      tone: "muted",
      size: 13,
      anchor: "end",
    });
    text(
      24,
      266,
      "The swell: the vibrato's Level, as bellows or a hand tremolo",
      {
        tone: "muted",
      },
    );
  },
} satisfies Diagram;
