import type { Diagram } from "../draw";

// A stick or brush drives a modal bank; the click, wires, sizzle and hiss are
// added on top.
export default {
  name: "drums",
  width: 860,
  height: 298,
  draw({ text, box, arrow }) {
    text(24, 30, "A hit", { tone: "muted" });
    box({
      x: 24,
      y: 48,
      w: 220,
      h: 92,
      title: "Stick",
      lines: ["half-sine pulse: harder", "= shorter = brighter"],
      tone: "green",
      filled: true,
    });
    box({
      x: 24,
      y: 160,
      w: 220,
      h: 92,
      title: "Brush",
      lines: ["a light push and", "a bristle-noise burst"],
      tone: "green",
    });
    box({
      x: 320,
      y: 48,
      w: 240,
      h: 204,
      title: "Modal bank",
      lines: [
        "a decaying sine per mode:",
        "f, T60, weight",
        "",
        "membranes start sharp",
        "and settle (tension),",
        "every 32 samples",
      ],
    });
    arrow(
      [
        [244, 94],
        [320, 94],
      ],
      { tone: "green" },
    );
    arrow(
      [
        [244, 206],
        [320, 206],
      ],
      { tone: "green" },
    );
    arrow([
      [560, 150],
      [612, 150],
    ]);
    const extras = [
      ["+ click", "beater, a few ms"],
      ["+ wires", "snare, follows the drum"],
      ["+ sizzle", "hats, cymbals"],
      ["+ hiss", "the brush's bristles"],
    ];
    extras.forEach(([name, what], i) => {
      text(628, 72 + i * 52, name, { tone: "blue", weight: 600 });
      text(628, 91 + i * 52, what, { tone: "muted", size: 13.5 });
    });
    text(440, 282, "× level × velocity → pan → kit bus", { anchor: "middle" });
  },
} satisfies Diagram;
