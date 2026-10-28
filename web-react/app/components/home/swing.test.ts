import { describe, expect, it } from "vitest";
import { timeline } from "./noteRecorder";
import {
  STRAIGHT,
  straightTime,
  swingOn,
  swingTime,
  type Swing,
} from "./swing";

const BEAT = 600;
const EIGHTHS: Swing = { amount: 66, perBeat: 2 };
const SIXTEENTHS: Swing = { amount: 60, perBeat: 4 };

describe("Swing", () => {
  it("pushes the second of each pair late and leaves the pairs' edges", () => {
    expect(swingTime(BEAT / 2, BEAT, EIGHTHS)).toBeCloseTo(0.66 * BEAT);
    expect(swingTime(BEAT, BEAT, EIGHTHS)).toBeCloseTo(BEAT);
    expect(swingTime(BEAT / 4, BEAT, SIXTEENTHS)).toBeCloseTo(0.6 * 300);
    expect(swingTime(3 * BEAT, BEAT, SIXTEENTHS)).toBeCloseTo(3 * BEAT);
  });

  it("puts what it swung back where it was", () => {
    for (const swing of [EIGHTHS, SIXTEENTHS])
      for (let t = 0; t < 4 * BEAT; t += 37)
        expect(
          straightTime(swingTime(t, BEAT, swing), BEAT, swing),
        ).toBeCloseTo(t);
  });

  it("leaves straight time and triplet grids alone", () => {
    expect(swingOn(STRAIGHT)).toBeNull();
    expect(swingOn(EIGHTHS, 6)).toBeNull();
    expect(swingOn(EIGHTHS, 3)).toBeNull();
    expect(swingOn(EIGHTHS, 4)).toBe(EIGHTHS);
    expect(swingOn(EIGHTHS)).toBe(EIGHTHS);
  });

  it("swings a take's eighths as it plays", () => {
    const take = {
      notes: [0, 1, 2, 3].map((i) => ({
        note: 60,
        start: (i * BEAT) / 2,
        duration: BEAT / 2,
        velocity: 0.8,
      })),
      length: 2 * BEAT,
      bpm: 100,
    };
    const meter = { beats: 4, unit: 4 } as const;
    const played = timeline(take, {
      bpm: 100,
      meter,
      perBeat: 0,
      swing: EIGHTHS,
    });
    expect(played.notes.map(({ start }) => Math.round(start))).toEqual([
      0, 396, 600, 996,
    ]);
    expect(Math.round(played.notes[0].duration)).toBe(396);
    expect(Math.round(played.notes[1].duration)).toBe(204);
  });
});
