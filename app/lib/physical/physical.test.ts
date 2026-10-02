import { describe, expect, it } from "vitest";
import { gainToDb, midiToHz } from "./dsp/math";
import type { EngineEvent, InstrumentId } from "./messages";
import { StringLoop } from "./models/StringLoop";
import {
  bandpass,
  measurePitch,
  measureT60,
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
      overrides: { flute: { "exciter.vibrato": 0, "space.send": 0 } },
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
  const strings: InstrumentId[] = ["piano", "guitar", "bass", "uprightBass"];
  const others: InstrumentId[] = ["violin", "saxophone", "flute", "oscillator"];

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

  it("play mezzo-forte C4 near −18 dBFS RMS", async () => {
    for (const id of [...strings, ...others]) {
      expect((await loudness(engineRenderer, id, 48000)).pass).toBe(true);
    }
  });

  it("play every oscillator wave in tune near −18 dBFS RMS", () => {
    for (let wave = 0; wave < 4; wave++) {
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
      const db = gainToDb(windowRms(left, 48000, 0, 0, 1));
      expect(Math.abs(db + 18)).toBeLessThan(1);
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
