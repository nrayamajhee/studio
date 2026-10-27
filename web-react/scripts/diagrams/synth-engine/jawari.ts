import type { Diagram } from "../draw";

// The sitar's jawari bridge, one more stage in the string loop.
export default {
  name: "jawari",
  width: 860,
  height: 212,
  draw({ text, box, arrow, circle }) {
    text(24, 30, "The sitar's bridge: one more stage in the loop", {
      tone: "muted",
    });
    box({
      x: 24,
      y: 50,
      w: 170,
      h: 66,
      title: "Tuning",
      lines: ["allpass"],
      tone: "blue",
    });
    box({
      x: 260,
      y: 50,
      w: 220,
      h: 100,
      title: "Jawari",
      lines: [
        "past the gap: an",
        "allpass, a = contact;",
        "else a plain delay",
      ],
      tone: "red",
      filled: true,
    });
    circle(550, 83, 16, "+", "green");
    box({
      x: 616,
      y: 50,
      w: 180,
      h: 66,
      title: "Delay line",
      lines: ["back round the loop"],
    });
    arrow([
      [194, 83],
      [260, 83],
    ]);
    arrow([
      [480, 83],
      [534, 83],
    ]);
    arrow([
      [566, 83],
      [616, 83],
    ]);
    arrow(
      [
        [796, 83],
        [840, 83],
      ],
      { dashed: true },
    );
    arrow(
      [
        [550, 150],
        [550, 99],
      ],
      { tone: "green" },
    );
    text(562, 145, "excitation", { tone: "green", size: 13 });
    text(260, 190, "A rotation of (input, state): it never adds energy", {
      tone: "muted",
    });
  },
} satisfies Diagram;
