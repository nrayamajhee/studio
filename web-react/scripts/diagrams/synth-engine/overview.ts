import type { Diagram } from "../draw";

// Exciter → resonator → body → out, with the push back that keeps blown and
// bowed sounds coupled.
export default {
  name: "overview",
  width: 860,
  height: 232,
  draw({ text, box, arrow }) {
    text(24, 30, "Every note is a small physics simulation", { tone: "muted" });
    box({
      x: 24,
      y: 56,
      w: 180,
      h: 110,
      title: "Exciter",
      lines: ["hammer · pick", "finger · breath", "bow · stick"],
      tone: "green",
      filled: true,
    });
    box({
      x: 290,
      y: 56,
      w: 190,
      h: 110,
      title: "Resonator",
      lines: ["string loop", "air column · reed", "membrane · bar"],
    });
    box({
      x: 566,
      y: 56,
      w: 150,
      h: 110,
      title: "Body",
      lines: ["soundboard", "guitar top · bell"],
      tone: "blue",
    });
    box({ x: 766, y: 91, w: 70, h: 40, title: "Out", center: true });
    arrow(
      [
        [204, 92],
        [290, 92],
      ],
      { tone: "ink" },
    );
    text(247, 82, "energy", { tone: "muted", size: 13, anchor: "middle" });
    arrow(
      [
        [290, 136],
        [204, 136],
      ],
      { tone: "red", dashed: true },
    );
    text(247, 158, "push back", { tone: "red", size: 13, anchor: "middle" });
    arrow(
      [
        [480, 111],
        [566, 111],
      ],
      { tone: "ink" },
    );
    text(523, 101, "vibration", { tone: "muted", size: 13, anchor: "middle" });
    arrow(
      [
        [716, 111],
        [766, 111],
      ],
      { tone: "ink" },
    );
    text(24, 210, "Struck, plucked: the exciter lets go after the attack", {
      tone: "green",
    });
    text(836, 210, "Blown, bowed: it stays coupled", {
      tone: "red",
      anchor: "end",
    });
  },
} satisfies Diagram;
