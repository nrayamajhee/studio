import type { Diagram } from "../draw";

// A block is cut into segments at each event's frame; then the buses, the
// reverb, the master LFO and FX, and the limiter run once.
export default {
  name: "render-loop",
  width: 860,
  height: 318,
  draw({ text, box, arrow }) {
    text(24, 30, "One block: 128 frames", { tone: "muted" });
    box({
      x: 24,
      y: 50,
      w: 232,
      h: 48,
      title: "Voices render 0–37",
      center: true,
    });
    box({
      x: 260,
      y: 50,
      w: 334,
      h: 48,
      title: "Voices render 37–90",
      center: true,
      filled: true,
    });
    box({
      x: 598,
      y: 50,
      w: 238,
      h: 48,
      title: "Voices render 90–128",
      center: true,
    });
    arrow(
      [
        [258, 140],
        [258, 102],
      ],
      { tone: "green" },
    );
    text(258, 160, "noteOn C4 @ 37", {
      tone: "green",
      size: 13,
      anchor: "middle",
      mono: true,
    });
    arrow(
      [
        [596, 140],
        [596, 102],
      ],
      { tone: "red" },
    );
    text(596, 160, "cutoff @ 90", {
      tone: "red",
      size: 13,
      anchor: "middle",
      mono: true,
    });

    text(24, 205, "Then, once per block:", { tone: "muted" });
    box({
      x: 24,
      y: 222,
      w: 176,
      h: 72,
      title: "Each bus",
      lines: ["body, drive, gain"],
    });
    box({
      x: 236,
      y: 222,
      w: 176,
      h: 72,
      title: "Reverb",
      lines: ["from the sends"],
      tone: "blue",
    });
    box({
      x: 448,
      y: 222,
      w: 176,
      h: 72,
      title: "LFO, FX",
      lines: ["on the master"],
    });
    box({
      x: 660,
      y: 222,
      w: 176,
      h: 72,
      title: "Limit, clip",
      lines: ["level, look-ahead"],
      tone: "red",
    });
    arrow([
      [200, 258],
      [236, 258],
    ]);
    arrow([
      [412, 258],
      [448, 258],
    ]);
    arrow([
      [624, 258],
      [660, 258],
    ]);
  },
} satisfies Diagram;
