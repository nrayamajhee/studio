import type { Diagram } from "../draw";

// IDLE → ACTIVE → RELEASED or STOLEN, and back to IDLE on free().
export default {
  name: "voice-lifecycle",
  width: 860,
  height: 322,
  draw({ text, box, arrow, line }) {
    text(
      24,
      30,
      "Drum hits start RELEASED (one-shots); any voice silent for 1 s is freed",
      { tone: "muted" },
    );
    box({
      x: 24,
      y: 70,
      w: 130,
      h: 50,
      title: "IDLE",
      center: true,
      dim: true,
      mono: true,
    });
    box({
      x: 330,
      y: 70,
      w: 140,
      h: 50,
      title: "ACTIVE",
      tone: "green",
      filled: true,
      center: true,
      mono: true,
    });
    box({
      x: 690,
      y: 70,
      w: 146,
      h: 50,
      title: "RELEASED",
      tone: "blue",
      center: true,
      mono: true,
    });
    box({
      x: 330,
      y: 210,
      w: 140,
      h: 50,
      title: "STOLEN",
      tone: "red",
      center: true,
      mono: true,
    });

    arrow(
      [
        [154, 95],
        [330, 95],
      ],
      { tone: "green" },
    );
    text(242, 86, "noteOn", {
      tone: "green",
      size: 13,
      anchor: "middle",
      mono: true,
    });
    arrow(
      [
        [470, 95],
        [690, 95],
      ],
      { tone: "blue" },
    );
    text(580, 64, ["noteOff, or the", "breath or bow ends"], {
      tone: "blue",
      size: 13,
      anchor: "middle",
      lineHeight: 17,
    });
    arrow(
      [
        [400, 120],
        [400, 210],
      ],
      { tone: "red" },
    );
    text(412, 158, ["Taken for a new note", "(5 ms fade-out)"], {
      tone: "red",
      size: 13,
      lineHeight: 18,
    });
    text(750, 158, ["Quiet for 50 ms", "(< −90 dBFS)"], {
      tone: "muted",
      size: 13,
      anchor: "end",
      lineHeight: 18,
    });

    line([
      [763, 120],
      [763, 300],
      [400, 300],
    ]);
    line([
      [400, 260],
      [400, 300],
    ]);
    arrow([
      [400, 300],
      [89, 300],
      [89, 120],
    ]);
    text(412, 292, "free()", { size: 13, mono: true });
  },
} satisfies Diagram;
