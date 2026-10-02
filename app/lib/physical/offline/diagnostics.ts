import { foldNote, gainToDb, keyTable, midiToHz } from "../dsp/math";
import { limiterLatency } from "../dsp/PeakLimiter";
import type { Overrides } from "../engine/Engine";
import type {
  BusId,
  DrumPieceId,
  EngineEvent,
  InstrumentId,
  KitId,
} from "../messages";
import { kitPieces } from "../models/DrumKit";
import { PATCH_BY_ID } from "../patches";
import type { DrumKitPatch, StringPatch } from "../patches/types";
import {
  bandpass,
  energyT60,
  findOnset,
  measurePitch,
  measureT60,
  signalStats,
  windowRms,
} from "./analysis";
import { renderEngine } from "./renderEngine";

export interface Rendered {
  left: Float32Array;
  right: Float32Array;
  activeVoices: number;
  reverbAwake: boolean;
}

// A renderer: the pure-TS engine in Node, or the real worklet through an
// OfflineAudioContext in the browser.
export type Renderer = (
  events: EngineEvent[],
  sampleRate: number,
  duration: number,
  overrides?: Overrides,
) => Promise<Rendered>;

export const engineRenderer: Renderer = async (
  events,
  sampleRate,
  duration,
  overrides,
) => {
  const { left, right, engine } = renderEngine(events, {
    sampleRate,
    duration,
    overrides,
  });
  const stats = engine.stats();
  return { left, right, ...stats };
};

export interface DiagnosticRow {
  check: string;
  subject: string;
  measured: string;
  expected: string;
  pass: boolean;
}

const mono = ({ left, right }: Rendered) => {
  const out = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) out[i] = 0.5 * (left[i] + right[i]);
  return out;
};

const fmt = (x: number, digits = 1) =>
  Number.isFinite(x) ? x.toFixed(digits) : String(x);

// Isolate the instrument itself: no reverb, no body modes near the fundamental.
const dry = (id: BusId, extra: Record<string, number> = {}): Overrides => ({
  [id]: { "space.send": 0, ...extra },
  master: { "reverb.return": 0, "master.volume": 1 },
});

export function notesInRange(id: InstrumentId, step = 1) {
  const [low, high] = PATCH_BY_ID[id].range;
  const notes: number[] = [];
  for (let n = low; n <= high; n += step) notes.push(n);
  if (notes[notes.length - 1] !== high) notes.push(high);
  return notes;
}

export async function tuningSweep(
  render: Renderer,
  id: InstrumentId,
  sampleRate: number,
  notes = notesInRange(id),
  tolerance = 3,
): Promise<DiagnosticRow[]> {
  const rows: DiagnosticRow[] = [];
  for (const note of notes) {
    const events: EngineEvent[] = [
      { type: "noteOn", instrument: id, note, velocity: 0.7, time: 0 },
    ];
    const out = mono(
      await render(
        events,
        sampleRate,
        2,
        dry(id, { "body.mix": 0, "exciter.vibrato": 0 }),
      ),
    );
    const onset = Math.max(0, findOnset(out));
    const { cents } = measurePitch(out, sampleRate, midiToHz(note), onset);
    rows.push({
      check: `Tuning @ ${sampleRate / 1000} kHz`,
      subject: `${id} ${note}`,
      measured: `${fmt(cents)} ¢`,
      expected: `±${tolerance} ¢`,
      pass: Math.abs(cents) <= tolerance,
    });
  }
  return rows;
}

// The fundamental of a note whose strings (piano unison, guitar polarizations)
// decay at different rates: coherent sum of Σ w_k·10^(−3t/(T·m_k)), measured the
// same way over the same window as the render.
export function expectedStringT60(
  patch: StringPatch,
  note: number,
  duration: number,
) {
  const base = keyTable(patch.t60, note);
  let parts: [weight: number, multiplier: number][] = [[1, 1]];
  if (patch.allocation === "key") {
    const count = Math.max(
      1,
      Math.min(3, Math.round(keyTable(patch.unison, note))),
    );
    parts = Array.from({ length: count }, (_, k) => [
      1 / count,
      patch.unisonDecay[k] ?? 1,
    ]);
  } else if (patch.polarization) {
    const { split, decay } = patch.polarization;
    parts = [
      [split, 1],
      [1 - split, decay],
    ];
  }
  const rate = 1000;
  const energy = new Float64Array(Math.round(duration * rate));
  for (let i = 0; i < energy.length; i++) {
    const t = i / rate;
    let amplitude = 0;
    for (const [weight, multiplier] of parts) {
      amplitude += weight * 10 ** ((-3 * t) / (base * multiplier));
    }
    energy[i] = amplitude * amplitude;
  }
  return energyT60(energy, rate);
}

export async function decaySweep(
  render: Renderer,
  id: InstrumentId,
  sampleRate: number,
  notes: number[],
): Promise<DiagnosticRow[]> {
  const patch = PATCH_BY_ID[id] as StringPatch;
  const rows: DiagnosticRow[] = [];
  for (const note of notes) {
    const duration = Math.min(12, keyTable(patch.t60, note) * 0.6 + 1);
    const expected = expectedStringT60(patch, note, duration);
    const events: EngineEvent[] = [
      { type: "noteOn", instrument: id, note, velocity: 0.7, time: 0 },
    ];
    const out = mono(
      await render(
        events,
        sampleRate,
        duration,
        // Unison detune beats inside the band; the check isolates the resonator.
        dry(id, { "body.mix": 0, "resonator.detune": 0 }),
      ),
    );
    const onset = Math.max(0, findOnset(out));
    const fundamental = bandpass(out, sampleRate, midiToHz(note));
    const t60 = measureT60(fundamental, sampleRate, onset);
    const ratio = t60 / expected;
    rows.push({
      check: "Decay T60",
      subject: `${id} ${note}`,
      measured: `${fmt(t60, 2)} s`,
      expected: `${fmt(expected, 2)} s ±25%`,
      pass: ratio > 0.75 && ratio < 1.25,
    });
  }
  return rows;
}

export async function stabilitySweep(
  render: Renderer,
  id: BusId,
  sampleRate: number,
  subjects: (number | DrumPieceId)[],
  velocities = [0.1, 0.5, 1],
): Promise<DiagnosticRow[]> {
  const rows: DiagnosticRow[] = [];
  for (const subject of subjects) {
    for (const velocity of velocities) {
      const events: EngineEvent[] =
        typeof subject === "number"
          ? [
              {
                type: "noteOn",
                instrument: id as InstrumentId,
                note: subject,
                velocity,
                time: 0,
              },
              {
                type: "noteOff",
                instrument: id as InstrumentId,
                note: subject,
                time: 1.2,
              },
            ]
          : [
              {
                type: "hit",
                kit: id as "drums",
                piece: subject,
                velocity,
                time: 0,
              },
            ];
      const out = mono(await render(events, sampleRate, 1.6, dry(id)));
      const period =
        typeof subject === "number" ? sampleRate / midiToHz(subject) : 0;
      const stats = signalStats(out, sampleRate, 0, period);
      const peakDb = gainToDb(stats.peak);
      const speaks = stats.peak > 1e-3;
      // Output is after the master limiter (−3 dBFS) and safety clipper, so a
      // peak above −1 dBFS means the note got past them.
      const ok =
        stats.finite &&
        speaks &&
        (velocity < 1 || peakDb <= -1) &&
        Math.abs(stats.dc) < 0.005;
      rows.push({
        check: "Stability",
        subject: `${id} ${subject} v${velocity}`,
        measured: `${stats.finite ? "" : "NaN "}peak ${fmt(peakDb)} dB, dc ${fmt(stats.dc, 4)}`,
        expected: "finite, speaks, ff peak ≤ −1 dB, |dc| < 0.005",
        pass: ok,
      });
    }
  }
  return rows;
}

// Mezzo-forte C4 (or the nearest in-range note) should sit near −18 dBFS RMS
// over its first second so switching instruments keeps the level.
export async function loudness(
  render: Renderer,
  id: InstrumentId,
  sampleRate: number,
): Promise<DiagnosticRow> {
  const [low, high] = PATCH_BY_ID[id].range;
  const note = foldNote(60, low, high);
  const events: EngineEvent[] = [
    { type: "noteOn", instrument: id, note, velocity: 0.7, time: 0 },
  ];
  const out = mono(await render(events, sampleRate, 1.2, dry(id)));
  const onset = Math.max(0, findOnset(out));
  const db = gainToDb(windowRms(out, sampleRate, onset, 0, 1));
  return {
    check: "Loudness",
    subject: id,
    measured: `${fmt(db)} dBFS RMS`,
    expected: "−18 ± 2",
    pass: Math.abs(db + 18) <= 2,
  };
}

// Drums are peak-normalized: every fortissimo hit should land near −3 dBFS.
export async function drumLevels(
  render: Renderer,
  kit: KitId,
  sampleRate: number,
): Promise<DiagnosticRow[]> {
  const rows: DiagnosticRow[] = [];
  for (const piece of kitPieces(PATCH_BY_ID[kit] as DrumKitPatch)) {
    const events: EngineEvent[] = [
      { type: "hit", kit, piece, velocity: 1, time: 0 },
    ];
    const out = mono(await render(events, sampleRate, 1, dry(kit)));
    const db = gainToDb(signalStats(out, sampleRate).peak);
    rows.push({
      check: "Drum level",
      subject: `${kit} ${piece}`,
      measured: `${fmt(db)} dBFS peak`,
      expected: "−3 ± 2",
      pass: Math.abs(db + 3) <= 2,
    });
  }
  return rows;
}

// Real-time factor: seconds rendered per second of wall-clock time for a
// worst-case event list (plan §12: piano ≥ 8×, guitar ≥ 20×).
export async function stressCheck(
  render: Renderer,
  id: "piano" | "guitar",
  sampleRate: number,
): Promise<DiagnosticRow> {
  const events: EngineEvent[] = [];
  if (id === "piano") {
    events.push({ type: "sustain", instrument: "piano", down: true, time: 0 });
    for (let i = 0; i < 16; i++) {
      events.push({
        type: "noteOn",
        instrument: "piano",
        note: 36 + i * 3,
        velocity: 0.8,
        time: i * 0.05,
      });
    }
  } else {
    for (let strum = 0; strum < 8; strum++) {
      for (const note of [40, 47, 52, 56, 59, 64]) {
        events.push({
          type: "noteOn",
          instrument: "guitar",
          note,
          velocity: 0.8,
          time: strum * 0.5,
        });
        events.push({
          type: "noteOff",
          instrument: "guitar",
          note,
          time: strum * 0.5 + 0.45,
        });
      }
    }
  }
  const seconds = 4;
  const started = performance.now();
  await render(events, sampleRate, seconds);
  const factor = seconds / ((performance.now() - started) / 1000);
  const target = id === "piano" ? 8 : 20;
  return {
    check: "Real-time factor",
    subject:
      id === "piano"
        ? "piano: 16 notes + pedal + reverb"
        : "guitar: 6-string strums + reverb",
    measured: `${fmt(factor)}×`,
    expected: `≥ ${target}×`,
    pass: factor >= target,
  };
}

export async function onsetCheck(
  render: Renderer,
  sampleRate: number,
): Promise<DiagnosticRow> {
  const time = 0.25 + 37 / sampleRate;
  const events: EngineEvent[] = [
    { type: "hit", kit: "drums", piece: "closedHat", velocity: 1, time },
  ];
  const out = mono(await render(events, sampleRate, 0.4, dry("drums")));
  const onset = findOnset(out, 1e-6);
  // Everything leaves the master limiter its look-ahead late.
  const expected = Math.round(time * sampleRate) + limiterLatency(sampleRate);
  return {
    check: "Onset",
    subject: "hit @ 0.25 s + 37 samples",
    measured: `${onset - expected} samples`,
    expected: "±1",
    pass: Math.abs(onset - expected) <= 1,
  };
}

export async function lifecycleCheck(
  render: Renderer,
  sampleRate: number,
): Promise<DiagnosticRow[]> {
  const events: EngineEvent[] = [];
  const instruments: InstrumentId[] = [
    "piano",
    "guitar",
    "bass",
    "uprightBass",
    "sitar",
    "ukulele",
    "banjo",
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
  ];
  instruments.forEach((instrument, i) => {
    const [low, high] = PATCH_BY_ID[instrument].range;
    const root = foldNote(60, low, high);
    for (const offset of [0, 4, 7]) {
      const note = foldNote(root + offset, low, high);
      events.push({
        type: "noteOn",
        instrument,
        note,
        velocity: 0.8,
        time: i * 0.1,
      });
      events.push({ type: "noteOff", instrument, note, time: i * 0.1 + 0.5 });
    }
  });
  kitPieces(PATCH_BY_ID.drums as DrumKitPatch).forEach((piece, i) => {
    events.push({
      type: "hit",
      kit: "drums",
      piece,
      velocity: 0.8,
      time: i * 0.05,
    });
    events.push({
      type: "hit",
      kit: "drums808",
      piece,
      velocity: 0.8,
      time: i * 0.05,
    });
  });
  events.push({ type: "tick", accent: true, time: 0 });
  // Damped notes and drums settle quickly; the 8 s reverb bound covers the tail.
  const rendered = await render(events, sampleRate, 12);
  return [
    {
      check: "Lifecycle",
      subject: "active voices after 12 s",
      measured: String(rendered.activeVoices),
      expected: "0",
      pass: rendered.activeVoices === 0,
    },
    {
      check: "Lifecycle",
      subject: "reverb asleep",
      measured: rendered.reverbAwake ? "awake" : "asleep",
      expected: "asleep",
      pass: !rendered.reverbAwake,
    },
  ];
}
