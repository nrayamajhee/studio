import type { Diagram } from "../draw";

// Breath drives the mouth, whose wave runs down the tube and reflects back
// from the open end or bell.
export default {
  name: "winds",
  width: 860,
  height: 270,
  draw({ text, box, arrow }) {
    text(24, 30, "breath pressure = max × ADSR × (1 + noise + vibrato Level)", {
      tone: "green",
      size: 13.5,
      mono: true,
    });
    arrow(
      [
        [120, 42],
        [120, 82],
      ],
      { tone: "green" },
    );
    box({
      x: 24,
      y: 82,
      w: 190,
      h: 120,
      title: "Mouth",
      lines: [
        "nonlinear:",
        "flute: an air jet",
        "sax, clarinet: a reed",
        "brass: the lips",
      ],
      tone: "green",
      filled: true,
    });
    box({
      x: 300,
      y: 82,
      w: 300,
      h: 120,
      title: "Tube",
      lines: ["delay lines with a", "fractional length", "(Lagrange-3 reads)"],
    });
    box({
      x: 680,
      y: 82,
      w: 156,
      h: 120,
      title: "Open end, bell",
      lines: ["lowpass,", "inverted:", "reflects back in"],
      tone: "blue",
    });
    arrow(
      [
        [214, 118],
        [300, 118],
      ],
      { tone: "ink" },
    );
    text(257, 109, "wave", { tone: "muted", size: 13, anchor: "middle" });
    arrow(
      [
        [300, 170],
        [214, 170],
      ],
      { tone: "red" },
    );
    text(257, 192, "reflection", { tone: "red", size: 13, anchor: "middle" });
    arrow(
      [
        [600, 118],
        [680, 118],
      ],
      { tone: "ink" },
    );
    arrow(
      [
        [680, 170],
        [600, 170],
      ],
      { tone: "red" },
    );
    arrow(
      [
        [758, 202],
        [758, 252],
      ],
      { tone: "ink" },
    );
    text(770, 248, "output", { size: 13 });
  },
} satisfies Diagram;
