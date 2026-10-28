import type { Diagram } from "../draw";

// The FDN reverb: predelay and diffusers into eight damped lines, mixed back
// into each other by a Householder matrix.
export default {
  name: "reverb",
  width: 860,
  height: 372,
  draw({ text, box, arrow }) {
    box({
      x: 24,
      y: 24,
      w: 150,
      h: 64,
      title: "Send",
      lines: ["mono"],
      tone: "blue",
    });
    box({
      x: 214,
      y: 24,
      w: 150,
      h: 64,
      title: "Predelay",
      lines: ["0–60 ms"],
    });
    box({
      x: 404,
      y: 24,
      w: 432,
      h: 64,
      title: "4 allpass diffusers",
      lines: ["3.1, 5.3, 8.9, 12.7 ms"],
    });
    arrow([
      [174, 56],
      [214, 56],
    ]);
    arrow([
      [364, 56],
      [404, 56],
    ]);
    arrow([
      [620, 88],
      [620, 124],
    ]);
    text(608, 112, "± 1/√8 into each line", {
      tone: "muted",
      size: 13,
      anchor: "end",
    });

    for (let i = 0; i < 8; i++) {
      const x = 40 + i * 99;
      box({
        x,
        y: 124,
        w: 86,
        h: 80,
        title: `Line ${i}`,
        lines: ["damp", `× g${i}`],
        tone: i % 2 ? "green" : "red",
      });
      arrow([
        [x + 43, 204],
        [x + 43, 236],
      ]);
    }
    box({
      x: 40,
      y: 236,
      w: 779,
      h: 48,
      title: "Householder mix I − (2/8)·1·1ᵀ (lossless) → back into every line",
      center: true,
    });
    text(24, 318, "Even lines (+ − + −) → wet L", { tone: "red" });
    text(836, 318, "Odd lines → wet R", { tone: "green", anchor: "end" });
    text(
      24,
      350,
      "29–71 ms, prime lengths × size; g = 10^(−3 L / (T60 fs)): every line loses 60 dB in T60",
      { tone: "muted", size: 13 },
    );
  },
} satisfies Diagram;
