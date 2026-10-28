import type { Diagram } from "../draw";

// The bowed string: the bow splits it into a neck delay and a bridge delay,
// and its friction force goes both ways.
export default {
  name: "bowed",
  width: 860,
  height: 296,
  draw({ text, line, arrow, rect }) {
    line(
      [
        [48, 100],
        [740, 100],
      ],
      { tone: "ink", width: 2 },
    );
    line(
      [
        [48, 72],
        [48, 128],
      ],
      { tone: "faint", width: 4 },
    );
    text(48, 60, "nut", { tone: "muted", size: 13, anchor: "middle" });
    line(
      [
        [740, 72],
        [740, 128],
      ],
      { tone: "faint", width: 4 },
    );
    text(740, 60, "bridge", { tone: "muted", size: 13, anchor: "middle" });
    rect(590, 60, 22, 80, "ink", true);
    text(601, 50, "bow", { size: 13, anchor: "middle", weight: 600 });

    arrow(
      [
        [56, 152],
        [586, 152],
      ],
      { tone: "blue", both: true },
    );
    text(321, 176, "neck delay (1 − β) × D", {
      tone: "blue",
      size: 13,
      anchor: "middle",
    });
    arrow(
      [
        [616, 152],
        [732, 152],
      ],
      { tone: "green", both: true },
    );
    text(674, 176, "β × D", { tone: "green", size: 13, anchor: "middle" });

    text(48, 214, "Reflects × −1", { tone: "muted", size: 13 });
    text(
      601,
      214,
      ["dv = v_bow − v_string", "f = dv × bowTable(dv)", "sent both ways"],
      {
        tone: "red",
        size: 13,
        anchor: "middle",
        mono: true,
      },
    );
    line(
      [
        [740, 128],
        [740, 250],
      ],
      { tone: "ink" },
    );
    arrow(
      [
        [740, 250],
        [800, 250],
      ],
      { tone: "ink" },
    );
    text(836, 282, "× −0.95, lowpass, body → out", { size: 13, anchor: "end" });
  },
} satisfies Diagram;
