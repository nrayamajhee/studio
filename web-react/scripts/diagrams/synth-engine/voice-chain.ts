import type { Diagram } from "../draw";

// The instrument's own voice, with the envelope and vibrato wired to what
// they move, then the engine's stages every voice runs through.
export default {
  name: "voice-chain",
  width: 860,
  height: 430,
  draw({ text, box, arrow, line }) {
    text(24, 30, "The instrument's voice", { tone: "muted" });
    const xs = [24, 190, 356, 522, 688];
    box({
      x: xs[0],
      y: 48,
      w: 148,
      h: 80,
      title: "Exciter",
      lines: ["hammer, pluck,", "bow, breath"],
      tone: "green",
    });
    box({
      x: xs[1],
      y: 48,
      w: 148,
      h: 80,
      title: "Resonator",
      lines: ["string, bore,", "modes"],
    });
    box({
      x: xs[2],
      y: 48,
      w: 148,
      h: 80,
      title: "× Gain",
      lines: ["attack, gate,", "level tilt"],
      dim: true,
    });
    box({
      x: xs[3],
      y: 48,
      w: 148,
      h: 80,
      title: "Filter",
      lines: ["SVF lowpass,", "keytracked"],
    });
    box({
      x: xs[4],
      y: 48,
      w: 148,
      h: 80,
      title: "Vibrato",
      lines: ["tremolo or a", "swept delay"],
      tone: "blue",
    });
    for (const x of xs.slice(1))
      arrow([
        [x - 18, 88],
        [x, 88],
      ]);

    box({
      x: 24,
      y: 240,
      w: 148,
      h: 44,
      title: "Envelope",
      tone: "green",
      center: true,
    });
    box({
      x: 522,
      y: 240,
      w: 314,
      h: 44,
      title: "Vibrato LFO",
      tone: "blue",
      center: true,
    });

    arrow(
      [
        [60, 240],
        [60, 128],
      ],
      { tone: "green" },
    );
    text(70, 214, "drives", { tone: "green", size: 12.5 });
    line(
      [
        [172, 262],
        [236, 262],
      ],
      { tone: "green", dashed: true },
    );
    arrow(
      [
        [236, 262],
        [236, 128],
      ],
      { tone: "green", dashed: true },
    );
    text(244, 230, "damper (strings)", { tone: "green", size: 12.5 });

    line(
      [
        [556, 240],
        [556, 150],
        [140, 150],
      ],
      { tone: "blue", dashed: true },
    );
    arrow(
      [
        [140, 150],
        [140, 128],
      ],
      { tone: "blue", dashed: true },
    );
    text(150, 168, "Level", { tone: "blue", size: 12.5 });
    line(
      [
        [590, 240],
        [590, 176],
        [300, 176],
      ],
      { tone: "blue", dashed: true },
    );
    arrow(
      [
        [300, 176],
        [300, 128],
      ],
      { tone: "blue", dashed: true },
    );
    text(310, 194, "Pitch", { tone: "blue", size: 12.5 });
    arrow(
      [
        [624, 240],
        [624, 128],
      ],
      { tone: "blue" },
    );
    text(632, 214, "Filter", { tone: "blue", size: 12.5 });
    arrow(
      [
        [780, 240],
        [780, 128],
      ],
      { tone: "blue", dashed: true },
    );
    text(788, 214, "else", { tone: "blue", size: 12.5 });

    line(
      [
        [24, 318],
        [836, 318],
      ],
      { tone: "faint", dashed: true },
    );
    text(24, 346, "Then the engine's stages", { tone: "muted" });
    const stages = [
      "Master ADSR",
      "Steal fade",
      "Pan",
      "Bus",
      "Master LFO, FX",
    ];
    stages.forEach((title, i) =>
      box({ x: xs[i], y: 362, w: 148, h: 44, title, center: true, dim: true }),
    );
    for (const x of xs.slice(1))
      arrow([
        [x - 18, 384],
        [x, 384],
      ]);
  },
} satisfies Diagram;
