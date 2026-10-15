import type { Diagram } from "../draw";

// The single-delay-loop string: delay, dispersion, loss and tuning, with the
// excitation added and the output tapped on the way round.
export default {
  name: "string-loop",
  width: 860,
  height: 278,
  draw({ text, box, arrow, line, circle }) {
    text(24, 30, "One trip around the loop is exactly one period of the note", {
      tone: "muted",
    });
    box({
      x: 64,
      y: 50,
      w: 170,
      h: 80,
      title: "Delay line",
      lines: ["N_int samples"],
    });
    box({
      x: 252,
      y: 50,
      w: 170,
      h: 80,
      title: "Dispersion",
      lines: ["M allpasses:", "highs travel faster"],
      tone: "red",
    });
    box({
      x: 440,
      y: 50,
      w: 170,
      h: 80,
      title: "Loss",
      lines: ["lowpass × g:", "highs die faster"],
      tone: "green",
    });
    box({
      x: 628,
      y: 50,
      w: 170,
      h: 80,
      title: "Tuning",
      lines: ["allpass for the", "leftover fraction"],
      tone: "blue",
    });
    arrow([
      [234, 90],
      [252, 90],
    ]);
    arrow([
      [422, 90],
      [440, 90],
    ]);
    arrow([
      [610, 90],
      [628, 90],
    ]);

    line(
      [
        [798, 90],
        [830, 90],
        [830, 200],
        [452, 200],
      ],
      { tone: "ink" },
    );
    circle(436, 200, 16, "+", "green");
    line(
      [
        [420, 200],
        [36, 200],
        [36, 90],
      ],
      { tone: "ink" },
    );
    arrow(
      [
        [36, 90],
        [64, 90],
      ],
      { tone: "ink" },
    );
    arrow(
      [
        [436, 256],
        [436, 216],
      ],
      { tone: "green" },
    );
    text(448, 250, "excitation", { tone: "green", size: 13 });
    arrow(
      [
        [640, 200],
        [640, 250],
      ],
      { tone: "ink" },
    );
    text(652, 248, "string output", { size: 13 });
  },
} satisfies Diagram;
