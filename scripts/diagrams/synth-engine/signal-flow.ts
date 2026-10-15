import type { Diagram } from "../draw";

// Voices into their bus, through body, drive and gain, a send to the shared
// reverb, the master LFO and FX, and out through the limiter.
export default {
  name: "signal-flow",
  width: 860,
  height: 712,
  draw({ text, box, arrow, line, circle }) {
    for (const x of [94, 174, 254]) circle(x, 40, 18, "v");
    line([
      [94, 58],
      [174, 86],
    ]);
    line([
      [254, 58],
      [174, 86],
    ]);
    arrow([
      [174, 58],
      [174, 86],
    ]);
    text(
      350,
      36,
      [
        "Each voice pans itself (equal power):",
        "the piano by key, guitars and basses by string",
      ],
      { tone: "muted" },
    );

    box({
      x: 24,
      y: 86,
      w: 300,
      h: 60,
      title: "Bus L/R",
      lines: ["one per instrument"],
    });
    text(350, 121, "Drum kits: their filter runs here", { tone: "muted" });
    arrow([
      [174, 146],
      [174, 176],
    ]);
    box({
      x: 24,
      y: 176,
      w: 300,
      h: 60,
      title: "Body",
      lines: ["modal, radiation or none; tilt"],
      tone: "blue",
    });
    text(
      350,
      202,
      ["Skipped when its bus is idle", "(0.5 s after the last voice)"],
      {
        tone: "muted",
      },
    );
    arrow([
      [174, 236],
      [174, 266],
    ]);
    box({
      x: 24,
      y: 266,
      w: 300,
      h: 60,
      title: "Drive",
      lines: ["if > 0, then a DC blocker"],
    });
    arrow([
      [174, 326],
      [174, 356],
    ]);
    box({
      x: 24,
      y: 356,
      w: 300,
      h: 48,
      title: "× output gain × level",
      center: true,
    });

    line(
      [
        [324, 380],
        [718, 380],
      ],
      { tone: "blue" },
    );
    arrow(
      [
        [718, 380],
        [718, 420],
      ],
      { tone: "blue" },
    );
    text(520, 370, "mono × send", { tone: "blue", size: 13, anchor: "middle" });
    box({
      x: 600,
      y: 420,
      w: 236,
      h: 64,
      title: "FDN reverb",
      lines: ["shared by every bus"],
      tone: "blue",
    });

    arrow([
      [174, 404],
      [174, 444],
    ]);
    text(184, 428, "master L/R", { tone: "muted", size: 12.5 });
    box({
      x: 24,
      y: 444,
      w: 300,
      h: 48,
      title: "LFO",
      tone: "green",
      center: true,
    });
    text(350, 473, "pitch · volume · filter · pan", { tone: "muted" });
    arrow([
      [174, 492],
      [174, 516],
    ]);
    box({
      x: 24,
      y: 516,
      w: 300,
      h: 48,
      title: "FX: drive · chorus · delay",
      tone: "green",
      center: true,
    });
    text(350, 545, "Each stage skipped at zero", { tone: "muted" });
    arrow([
      [174, 564],
      [174, 588],
    ]);
    circle(174, 604, 16, "+");
    text(40, 592, "metronome", { tone: "muted", size: 12.5 });
    arrow([
      [40, 604],
      [158, 604],
    ]);
    line(
      [
        [718, 484],
        [718, 604],
        [400, 604],
      ],
      { tone: "blue" },
    );
    arrow(
      [
        [400, 604],
        [190, 604],
      ],
      { tone: "blue" },
    );
    text(520, 596, "× return", { tone: "blue", size: 13, anchor: "middle" });

    arrow([
      [174, 620],
      [174, 648],
    ]);
    box({
      x: 24,
      y: 648,
      w: 812,
      h: 44,
      title:
        "× level → peak limiter, 1.5 ms look-ahead, −3 dBFS → safety clip → worklet out",
      tone: "red",
      center: true,
    });
  },
} satisfies Diagram;
