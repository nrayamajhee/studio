import type { Diagram } from "../draw";

// The main thread posts events to the audio thread's Engine, which posts
// stats back; the Engine's output runs through the browser to the speakers.
export default {
  name: "threads",
  width: 860,
  height: 566,
  draw({ text, box, arrow, line }) {
    text(24, 30, "Main thread", { tone: "muted", weight: 600 });
    text(480, 30, "Audio thread (AudioWorklet)", {
      tone: "muted",
      weight: 600,
    });
    line(
      [
        [440, 16],
        [440, 262],
      ],
      { tone: "faint", dashed: true },
    );
    line(
      [
        [440, 360],
        [440, 550],
      ],
      { tone: "faint", dashed: true },
    );

    box({
      x: 24,
      y: 50,
      w: 320,
      h: 64,
      title: "SynthDevice",
      lines: ["keys, pads, knobs"],
      mono: true,
    });
    box({
      x: 24,
      y: 150,
      w: 320,
      h: 80,
      title: "deviceEngine",
      lines: ["octave offset, kit mapping,", "param de-duplication"],
      mono: true,
    });
    box({
      x: 24,
      y: 266,
      w: 320,
      h: 84,
      title: "physicalSynth",
      lines: ["boots the AudioContext lazily,", "queues events until ready"],
      tone: "green",
      filled: true,
      mono: true,
    });
    arrow([
      [184, 114],
      [184, 150],
    ]);
    arrow([
      [184, 230],
      [184, 266],
    ]);

    box({
      x: 480,
      y: 50,
      w: 356,
      h: 64,
      title: "PhysicalSynthProcessor",
      lines: ["process() every 128 frames"],
      mono: true,
    });
    box({
      x: 480,
      y: 150,
      w: 356,
      h: 200,
      title: "Engine",
      lines: [
        "EventQueue, sorted by frame",
        "32 instruments, one bus each",
        "FDN reverb, metronome",
        "master LFO, FX, level",
        "peak limiter, safety clip",
      ],
      tone: "green",
      filled: true,
      mono: true,
    });
    arrow([
      [658, 114],
      [658, 150],
    ]);

    arrow(
      [
        [344, 290],
        [480, 290],
      ],
      { tone: "ink" },
    );
    text(412, 280, "postMessage", { size: 13, anchor: "middle", mono: true });
    arrow(
      [
        [480, 326],
        [344, 326],
      ],
      { tone: "blue" },
    );
    text(412, 348, "stats every 0.25 s", {
      tone: "blue",
      size: 13,
      anchor: "middle",
    });

    box({
      x: 480,
      y: 386,
      w: 166,
      h: 62,
      title: "Browser limiter",
      lines: ["−3 dB, 20:1"],
      dim: true,
    });
    box({
      x: 670,
      y: 386,
      w: 166,
      h: 62,
      title: "Analyser",
      lines: ["the oscilloscope"],
      dim: true,
    });
    box({
      x: 480,
      y: 480,
      w: 166,
      h: 62,
      title: "Volume",
      lines: ["the white knob"],
      dim: true,
    });
    box({
      x: 670,
      y: 480,
      w: 166,
      h: 62,
      title: "Speakers",
      center: true,
      dim: true,
    });
    arrow([
      [563, 350],
      [563, 386],
    ]);
    arrow([
      [646, 417],
      [670, 417],
    ]);
    arrow([
      [753, 448],
      [753, 464],
      [563, 464],
      [563, 480],
    ]);
    arrow([
      [646, 511],
      [670, 511],
    ]);
  },
} satisfies Diagram;
