import type { Diagram } from "../draw";

// A string voice, from its loops to the bus; the greyed stages only run on
// some instruments.
export default {
  name: "string-voice",
  width: 860,
  height: 128,
  draw({ box, arrow }) {
    const xs = [24, 190, 356, 522, 688];
    box({
      x: xs[0],
      y: 24,
      w: 148,
      h: 80,
      title: "1–3 loops",
      lines: ["unison or", "2 polarizations"],
    });
    box({
      x: xs[1],
      y: 24,
      w: 148,
      h: 80,
      title: "Pickup comb",
      lines: ["electric guitar", "and bass only"],
      dim: true,
    });
    box({
      x: xs[2],
      y: 24,
      w: 148,
      h: 80,
      title: "DC block",
      center: true,
      dim: true,
    });
    box({
      x: xs[3],
      y: 24,
      w: 148,
      h: 80,
      title: "Filter, amp",
      lines: ["the voice's", "modules"],
    });
    box({
      x: xs[4],
      y: 24,
      w: 148,
      h: 80,
      title: "Pan → bus",
      lines: ["by key or", "by string"],
    });
    for (const x of xs.slice(1))
      arrow([
        [x - 18, 64],
        [x, 64],
      ]);
  },
} satisfies Diagram;
