import { describe, expect, it } from "vitest";
import { gainToDb, midiToHz } from "./dsp/math";
import type { EngineEvent, InstrumentId } from "./messages";
import { StringLoop } from "./models/StringLoop";
import {
  bandpass,
  measurePitch,
  measureT60,
  momentaryLoudness,
  signalStats,
  windowRms,
} from "./offline/analysis";
import {
  decaySweep,
  engineRenderer,
  lifecycleCheck,
  loudness,
  notesInRange,
  onsetCheck,
  stabilitySweep,
  tuningSweep,
} from "./offline/diagnostics";
import { renderEngine } from "./offline/renderEngine";
import { PATCHES } from "./patches";
import { piano } from "./patches/piano";
import type { Patch } from "./patches/types";

const RATES = [44100, 48000];

const failures = (
  rows: { pass: boolean; subject: string; measured: string }[],
) =>
  rows
    .filter((row) => !row.pass)
    .map((row) => `${row.subject}: ${row.measured}`);

describe("StringLoop", () => {
  it.each(RATES)(
    "tunes within ±3 ¢ and decays at the set T60 (%i Hz)",
    (fs) => {
      for (const note of [28, 40, 60, 84, 100]) {
        const f0 = midiToHz(note);
        const loop = new StringLoop(fs, 20);
        loop.tune(f0, 2, 0.3, note < 60 ? 4 : 0, -0.4);
        const out = new Float32Array(3 * fs);
        for (let i = 0; i < out.length; i++)
          out[i] = loop.tick(i < 20 ? Math.sin(i) : 0);
        expect(Math.abs(measurePitch(out, fs, f0).cents)).toBeLessThan(3);
        // T60 is specified for the fundamental; upper partials decay faster.
        const t60 = measureT60(bandpass(out, fs, f0), fs);
        expect(t60 / 2).toBeGreaterThan(0.75);
        expect(t60 / 2).toBeLessThan(1.25);
      }
    },
  );
});

describe("Engine", () => {
  it("starts events on the scheduled sample", async () => {
    for (const fs of RATES)
      expect((await onsetCheck(engineRenderer, fs)).pass).toBe(true);
  });

  it("frees every voice and puts the reverb to sleep", async () => {
    expect(failures(await lifecycleCheck(engineRenderer, 48000))).toEqual([]);
  });

  it("re-strikes a held note in the same voice and releases it by count", () => {
    const events: EngineEvent[] = [
      { type: "noteOn", instrument: "piano", note: 60, velocity: 0.8, time: 0 },
      {
        type: "noteOn",
        instrument: "piano",
        note: 60,
        velocity: 0.8,
        time: 0.1,
      },
      { type: "noteOff", instrument: "piano", note: 60, time: 0.2 },
    ];
    const { engine } = renderEngine(events, {
      sampleRate: 48000,
      duration: 0.3,
    });
    expect(engine.instrument("piano")?.activeVoices()).toBe(1);
  });

  it("spreads a guitar chord across strings", () => {
    const chord = [52, 56, 59, 64];
    const events: EngineEvent[] = chord.map((note) => ({
      type: "noteOn",
      instrument: "guitar",
      note,
      velocity: 0.8,
      time: 0,
    }));
    const { engine } = renderEngine(events, {
      sampleRate: 48000,
      duration: 0.2,
    });
    expect(engine.instrument("guitar")?.activeVoices()).toBe(chord.length);
  });

  it("plays only the root of a chord burst on a monophonic wind", () => {
    const events: EngineEvent[] = [60, 64, 67].map((note) => ({
      type: "noteOn",
      instrument: "flute",
      note: note + 12,
      velocity: 0.8,
      time: 0,
    }));
    const { left } = renderEngine(events, {
      sampleRate: 48000,
      duration: 2,
      overrides: { flute: { "lfo.level": 0, "lfo.pitch": 0, "space.send": 0 } },
    });
    expect(
      Math.abs(measurePitch(left, 48000, midiToHz(72)).cents),
    ).toBeLessThan(10);
  });

  it("chokes the open hat with the closed hat", () => {
    const open: EngineEvent = {
      type: "hit",
      kit: "drums",
      piece: "openHat",
      velocity: 1,
      time: 0,
    };
    const closed: EngineEvent = {
      type: "hit",
      kit: "drums",
      piece: "closedHat",
      velocity: 0.01,
      time: 0.1,
    };
    const tail = (events: EngineEvent[]) => {
      const { left } = renderEngine(events, {
        sampleRate: 48000,
        duration: 0.6,
        overrides: {
          drums: { "space.send": 0 },
          master: { "reverb.return": 0 },
        },
      });
      return signalStats(left.subarray(Math.round(0.3 * 48000)), 48000).peak;
    };
    expect(tail([open, closed])).toBeLessThan(tail([open]) * 0.1);
  });
});

describe("instruments", () => {
  const strings: InstrumentId[] = [
    "piano",
    "guitar",
    "bass",
    "uprightBass",
    "sitar",
    "ukulele",
    "banjo",
  ];
  const others: InstrumentId[] = [
    "violin",
    "saxophone",
    "clarinet",
    "trombone",
    "flute",
    "harmonium",
    "harmonica",
    "xylophone",
    "steelPan",
    "kalimba",
    "oscillator",
  ];

  it.each(RATES)("stay in tune across their ranges (%i Hz)", async (fs) => {
    for (const id of strings) {
      expect(
        failures(
          await tuningSweep(engineRenderer, id, fs, notesInRange(id, 5)),
        ),
      ).toEqual([]);
    }
    for (const id of others) {
      expect(
        failures(
          await tuningSweep(engineRenderer, id, fs, notesInRange(id, 3), 10),
        ),
      ).toEqual([]);
    }
  });

  it("decay at their tabled T60", async () => {
    expect(
      failures(
        await decaySweep(engineRenderer, "piano", 48000, [21, 48, 72, 96, 108]),
      ),
    ).toEqual([]);
    expect(
      failures(await decaySweep(engineRenderer, "guitar", 48000, [40, 64, 84])),
    ).toEqual([]);
  });

  it("speak cleanly at every velocity without NaN or DC", async () => {
    for (const id of [...strings, ...others]) {
      expect(
        failures(
          await stabilitySweep(engineRenderer, id, 48000, notesInRange(id, 12)),
        ),
      ).toEqual([]);
    }
  });

  it("play mezzo-forte C4 at −14 LUFS momentary", async () => {
    for (const id of [...strings, ...others]) {
      expect((await loudness(engineRenderer, id, 48000)).pass).toBe(true);
    }
  });

  it("play every oscillator wave in tune at −14 LUFS momentary", () => {
    for (let wave = 0; wave < 4; wave++) {
      const { left, right } = renderEngine(
        [
          {
            type: "noteOn",
            instrument: "oscillator",
            note: 60,
            velocity: 0.7,
            time: 0,
          },
        ],
        {
          sampleRate: 48000,
          duration: 1.2,
          overrides: {
            oscillator: { "exciter.wave": wave, "space.send": 0 },
            master: { "reverb.return": 0, "master.volume": 1 },
          },
        },
      );
      expect(
        Math.abs(measurePitch(left, 48000, midiToHz(60)).cents),
      ).toBeLessThan(1);
      expect(Math.abs(momentaryLoudness(left, right, 48000) + 14)).toBeLessThan(
        1,
      );
    }
  });

  it("cancel a matching second oscillator at 180° phase", () => {
    const { left } = renderEngine(
      [
        {
          type: "noteOn",
          instrument: "oscillator",
          note: 60,
          velocity: 0.7,
          time: 0,
        },
      ],
      {
        sampleRate: 48000,
        duration: 0.5,
        overrides: {
          oscillator: {
            "exciter.wave": 0,
            "exciter.wave2": 1,
            "exciter.level2": 1,
            "exciter.phase": 180,
            "space.send": 0,
          },
          master: { "reverb.return": 0, "master.volume": 1 },
        },
      },
    );
    const db = gainToDb(windowRms(left, 48000, 0, 0.1, 0.4));
    expect(db).toBeLessThan(-60);
  });
});

describe("modules", () => {
  const melodic = PATCHES.filter((patch) => patch.family !== "drums");
  const ids = (patch: Patch, section: string) =>
    patch.params.filter((spec) => spec.section === section).map(({ id }) => id);

  it("give every instrument the same filter, LFO and output params", () => {
    for (const section of ["filter", "lfo"]) {
      const expected = ids(piano, section);
      for (const patch of melodic) {
        expect(ids(patch, section), `${patch.id} ${section}`).toEqual(expected);
      }
    }
    for (const patch of PATCHES) {
      expect(ids(patch, "output"), patch.id).toEqual(
        expect.arrayContaining(["output.level", "space.send"]),
      );
    }
  });

  const play = (
    instrument: InstrumentId,
    overrides: Record<string, number>,
    duration = 2,
  ) =>
    renderEngine(
      [{ type: "noteOn", instrument, note: 69, velocity: 0.7, time: 0 }],
      {
        sampleRate: 48000,
        duration,
        overrides: {
          [instrument]: { "space.send": 0, ...overrides },
          master: { "reverb.return": 0 },
        },
      },
    ).left;

  it("bend the oscillator's own pitch with the LFO", () => {
    // A square LFO at 0.5 Hz holds the pitch up for a second, then down.
    const left = play("oscillator", {
      "lfo.rate": 0.5,
      "lfo.shape": 2,
      "lfo.pitch": 50,
    });
    const up = measurePitch(left, 48000, 440, 0, 0.2, 0.8).cents;
    const down = measurePitch(left, 48000, 440, 0, 1.2, 1.8).cents;
    expect(Math.abs(up - 50)).toBeLessThan(3);
    expect(Math.abs(down + 50)).toBeLessThan(3);
  });

  it("bend a model's output through the swept delay", () => {
    // A triangle sweeps the delay at a steady speed each half cycle: flat
    // while it lengthens, sharp while it shortens.
    const left = play("harmonium", {
      "lfo.rate": 0.5,
      "lfo.shape": 1,
      "lfo.pitch": 50,
      "lfo.level": 0,
    });
    const flat = measurePitch(left, 48000, 440, 0, 0.2, 0.8).cents;
    const sharp = measurePitch(left, 48000, 440, 0, 1.2, 1.8).cents;
    expect(sharp - flat).toBeGreaterThan(40);
  });

  it("open the filter with its envelope on every instrument", () => {
    for (const patch of melodic) {
      const id = patch.id as InstrumentId;
      const shut = { "filter.cutoff": 300, "lfo.level": 0, "lfo.pitch": 0 };
      const closed = play(id, shut, 0.3);
      const opened = play(id, { ...shut, "filter.envAmount": 4 }, 0.3);
      expect(
        windowRms(opened, 48000, 0, 0, 0.3) /
          windowRms(closed, 48000, 0, 0, 0.3),
        patch.id,
      ).toBeGreaterThan(1.2);
    }
  });
});
