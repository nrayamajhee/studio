import { describe, expect, it } from "vitest";
import {
  PLAY_STYLES,
  chordNotes,
  rhythmOf,
  type PlayStyle,
} from "./playStyles";

const style = (id: PlayStyle["id"], perBeat = 2): PlayStyle => ({
  id,
  perBeat,
  strum: 20,
});
const chord = [60, 64, 67];

describe("strums", () => {
  it("catch the root alone, or the top strings alone", () => {
    const notes = chordNotes(chord, style("boomChuck"), 250, 1000, 0.8);
    expect(
      notes.filter(({ start }) => start === 0).map(({ note }) => note),
    ).toEqual([60]);
    const chuck = notes.filter(({ start }) => start >= 500 && start < 1000);
    expect(chuck.map(({ note }) => note)).toEqual([64, 67]);
  });

  it("fade a tapered strum from the first string it meets", () => {
    const notes = chordNotes(chord, style("popPush"), 250, 2000, 0.8);
    const first = notes.filter(({ start }) => start < 250);
    [0.9, 0.7875, 0.675].forEach((velocity, i) =>
      expect(first[i].velocity).toBeCloseTo(velocity),
    );
    // The pushed up strum starts on the top string, its loudest.
    const push = notes.filter(({ start }) => start >= 750 && start < 1000);
    expect(push.map(({ note }) => note)).toEqual([67, 64, 60]);
    expect(push[0].velocity).toBeGreaterThan(push[2].velocity);
  });

  it("mix ghosts, accents and chucks", () => {
    const notes = chordNotes(chord, style("funkSixteenths", 4), 125, 1000, 0.8);
    const velocities = new Set(notes.map(({ velocity }) => velocity));
    expect(Math.min(...velocities)).toBeCloseTo(0.35);
    expect(Math.max(...velocities)).toBe(1);
  });

  it("keep every strike inside its cycle and short of the next", () => {
    for (const { id } of PLAY_STYLES) {
      const rhythm = rhythmOf(id);
      if (!rhythm) continue;
      const ats = rhythm.strikes.map(({ at }) => at);
      expect(new Set(ats).size, id).toBe(ats.length);
      rhythm.strikes.forEach(({ at, hold }, i) => {
        expect(at, id).toBeLessThan(rhythm.cycle);
        const next = ats[i + 1] ?? ats[0] + rhythm.cycle;
        expect(at + hold, id).toBeLessThan(next);
      });
    }
  });
});
