// Renders the same events through web-react's TypeScript engine for the
// Rust engine to match: for every patch a few notes (or every piece of a
// kit) with a param change, and one run through the master stage. Writes
// each case's events (JSON) and the TypeScript output (interleaved f32) to
// sound-engine/target/parity; `cargo run --release --example parity` then
// renders the events in Rust and compares. Run from web-react:
//   npx tsx ../sound-engine/scripts/parity.ts
import { mkdirSync, writeFileSync } from "node:fs";
import type { EngineEvent } from "../../web-react/app/lib/physical/messages";
import { renderEngine } from "../../web-react/app/lib/physical/offline/renderEngine";
import {
  MASTER_PARAMS,
  PATCHES,
} from "../../web-react/app/lib/physical/patches";

const SAMPLE_RATE = 48000;
const DURATION = 2.5;
const dir = new URL("../target/parity/", import.meta.url);
mkdirSync(dir, { recursive: true });

type Case = { name: string; events: EngineEvent[] };
const cases: Case[] = [];

for (const patch of PATCHES) {
  const id = patch.id as never;
  const param = (name: string, value: number, time: number): EngineEvent => ({
    type: "param",
    target: id,
    id: name,
    value,
    time,
  });
  const has = (name: string) => patch.params.some((p) => p.id === name);
  const middle = (name: string) => {
    const spec = patch.params.find((p) => p.id === name)!;
    return spec.min + 0.3 * (spec.max - spec.min);
  };
  if (patch.family === "drums") {
    const events: EngineEvent[] = [];
    Object.keys(patch.pieces).forEach((piece, i) => {
      events.push({
        type: "hit",
        kit: id,
        piece: piece as never,
        velocity: 0.5 + 0.1 * (i % 5),
        time: 0.02 + 0.09 * i,
      });
    });
    events.push(param("resonator.tune", middle("resonator.tune"), 0.6));
    events.push(param("filter.cutoff", 3000, 1.1));
    cases.push({ name: patch.id, events });
    continue;
  }
  const [low, high] = patch.range;
  const n = Math.round((low + high) / 2);
  const note = (on: boolean, note: number, time: number, velocity = 0.8) =>
    on
      ? ({
          type: "noteOn",
          instrument: id,
          note,
          velocity,
          time,
        } as EngineEvent)
      : ({ type: "noteOff", instrument: id, note, time } as EngineEvent);
  const events: EngineEvent[] = [
    note(true, n, 0.05),
    // A chord, 1 ms apart, as the chord pads send it.
    note(true, n + 4, 0.5, 0.6),
    note(true, n + 7, 0.501, 0.7),
    note(false, n, 0.9),
    // Legato onto a held note, then a repeated one.
    note(true, n + 2, 1.0),
    note(false, n + 4, 1.3),
    note(false, n + 7, 1.3),
    note(true, n + 2, 1.4, 0.5),
    note(false, n + 2, 1.6),
    note(false, n + 2, 1.7),
  ];
  for (const name of [
    "filter.cutoff",
    "exciter.hardness",
    "exciter.pressure",
    "vibrato.pitch",
  ]) {
    if (has(name)) events.push(param(name, middle(name), 0.7));
  }
  if (has("vibrato.level")) events.push(param("vibrato.level", 0.3, 0.2));
  if (patch.family === "string") {
    events.push({ type: "sustain", instrument: id, down: true, time: 1.75 });
    events.push(note(true, n - 5, 1.8));
    events.push(note(false, n - 5, 1.9));
    events.push({ type: "sustain", instrument: id, down: false, time: 2.2 });
  }
  cases.push({ name: patch.id, events });
}

// The master stage: reverb, LFO, FX, the ADSR and the metronome.
const master = (id: string, value: number, time = 0): EngineEvent => ({
  type: "param",
  target: "master",
  id,
  value,
  time,
});
const mid = (id: string) => {
  const spec = MASTER_PARAMS.find((p) => p.id === id)!;
  return spec.min + 0.4 * (spec.max - spec.min);
};
cases.push({
  name: "master",
  events: [
    ...MASTER_PARAMS.filter((p) => p.id !== "master.volume").map((p) =>
      master(p.id, mid(p.id)),
    ),
    { type: "noteOn", instrument: "piano", note: 60, velocity: 0.8, time: 0.1 },
    { type: "noteOn", instrument: "flute", note: 72, velocity: 0.7, time: 0.3 },
    { type: "tick", accent: true, time: 0.5 },
    { type: "tick", accent: false, time: 1 },
    { type: "noteOff", instrument: "piano", note: 60, time: 1.2 },
    { type: "noteOff", instrument: "flute", note: 72, time: 1.4 },
    master("master.volume", 0.5, 1.5),
  ],
});

for (const { name, events } of cases) {
  const { left, right } = renderEngine(events, {
    sampleRate: SAMPLE_RATE,
    duration: DURATION,
  });
  const out = new Float32Array(left.length * 2);
  for (let i = 0; i < left.length; i++) {
    out[2 * i] = left[i];
    out[2 * i + 1] = right[i];
  }
  writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(events));
  writeFileSync(new URL(`${name}.f32`, dir), Buffer.from(out.buffer));
}
console.log(`wrote ${cases.length} cases at ${SAMPLE_RATE} Hz`);
