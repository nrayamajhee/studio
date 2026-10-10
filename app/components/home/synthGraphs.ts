import { Noise } from "../../lib/physical/dsp/generators";
import {
  clamp,
  foldNote,
  keyTable,
  lerp,
  midiToHz,
} from "../../lib/physical/dsp/math";
import {
  bowTable,
  drive as saturate,
  jetTable,
  reedTable,
} from "../../lib/physical/dsp/nonlinear";
import {
  BODY_SECTIONS,
  STK_RATE,
} from "../../lib/physical/models/BowedInstrument";
import { hammer, pluck, stick } from "../../lib/physical/models/exciters";
import { StringLoop } from "../../lib/physical/models/StringLoop";
import type {
  DrumPieceSpec,
  Patch,
  SectionId,
} from "../../lib/physical/patches/types";
import {
  CHAIN_STOPS,
  synthPages,
  type SynthPage,
  type SynthPageId,
} from "./synthPages";

// A graph is drawn in a 100 × 100 box stretched over the screen: lines keep
// their pixel width however it stretches, and labels are laid over it in
// screen type at the same coordinates (0 left/top, 100 right/bottom).
export type Tone = "ink" | "dim" | "faint" | "green" | "red" | "blue";

export type ScenePath = {
  d: string;
  tone: Tone;
  width?: number;
  dashed?: boolean;
  // Filled instead of stroked: a light wash, or `solid`.
  fill?: boolean;
  solid?: boolean;
};

export type SceneLabel = {
  x: number;
  y: number;
  text: string;
  tone?: Tone;
  align?: "start" | "middle" | "end";
  // Which edge sits at y: the text's top, its middle or its baseline.
  anchor?: "top" | "middle" | "bottom";
};

export type GraphScene = { paths: ScenePath[]; labels: SceneLabel[] };

// The knobs' colours in knob order, as the readouts draw them.
export const KNOB_TONES: readonly Tone[] = ["ink", "green", "red", "blue"];

type Values = Readonly<Record<string, number>>;

export type GraphInput = {
  patch: Patch;
  values: Values;
  // The note the graphs are drawn for.
  note: number;
  // The colour of the knob that sets a param on its page, so what a knob moves
  // is drawn in its colour.
  toneOf: (id: string) => Tone;
};

const FS = 48000;
// The velocity the graphs play at: mezzo-forte.
const VELOCITY = 0.8;

const n2 = (v: number) => v.toFixed(2);
const polyline = (points: readonly (readonly [number, number])[]) =>
  points.length === 0
    ? ""
    : "M" + points.map(([x, y]) => `${n2(x)} ${n2(y)}`).join(" L");
const sample = (
  count: number,
  point: (t: number) => readonly [number, number],
) => polyline(Array.from({ length: count + 1 }, (_, i) => point(i / count)));
const box = (x0: number, y0: number, x1: number, y1: number) =>
  `M${n2(x0)} ${n2(y0)} H${n2(x1)} V${n2(y1)} H${n2(x0)} Z`;
const vline = (x: number, y0: number, y1: number) =>
  `M${n2(x)} ${n2(y0)} V${n2(y1)}`;
const hline = (y: number, x0: number, x1: number) =>
  `M${n2(x0)} ${n2(y)} H${n2(x1)}`;

class Scene {
  readonly paths: ScenePath[] = [];
  readonly labels: SceneLabel[] = [];

  path(d: string, tone: Tone, extra: Partial<ScenePath> = {}) {
    if (d) this.paths.push({ d, tone, ...extra });
    return this;
  }

  label(
    x: number,
    y: number,
    text: string,
    tone: Tone = "dim",
    align: SceneLabel["align"] = "start",
    anchor: SceneLabel["anchor"] = "top",
  ) {
    if (text) this.labels.push({ x, y, text, tone, align, anchor });
    return this;
  }

  done(): GraphScene {
    return { paths: this.paths, labels: this.labels };
  }
}

const get = (values: Values, id: string, fallback = 0) =>
  values[id] ?? fallback;
const has = (values: Values, id: string) => id in values;
const db = (gain: number) => 20 * Math.log10(Math.max(gain, 1e-9));
const percent = (v: number) => `${Math.round(v * 100)}%`;
const ms = (seconds: number) =>
  seconds < 0.01
    ? `${(seconds * 1000).toFixed(1)} ms`
    : seconds < 1
      ? `${Math.round(seconds * 1000)} ms`
      : `${seconds.toFixed(2)} s`;
const hz = (f: number) =>
  f >= 1000
    ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} kHz`
    : `${Math.round(f)} Hz`;

// The note an instrument's graphs are drawn at: middle C, moved by octaves
// into its range.
export const graphNote = (patch: Patch) =>
  foldNote(60, patch.range[0], patch.range[1]);

// The magnitude of `signal` at `cycles` cycles per sample.
function dft(signal: Float32Array, length: number, cycles: number) {
  let re = 0;
  let im = 0;
  const w = 2 * Math.PI * cycles;
  for (let k = 0; k < length; k++) {
    re += signal[k] * Math.cos(w * k);
    im -= signal[k] * Math.sin(w * k);
  }
  return Math.hypot(re, im);
}

// Harmonic bars across the right of the box, in dB below the strongest
// (60 dB tall), with dashed gaps where a strike or pluck position silences
// harmonics.
function harmonicBars(
  scene: Scene,
  amps: readonly number[],
  title: string,
  gaps?: { beta: number; tone: Tone },
) {
  const x0 = 50;
  const width = 50;
  const peak = Math.max(...amps, 1e-9);
  const x = (n: number) => x0 + ((n - 0.5) / amps.length) * width;
  if (gaps) {
    let d = "";
    for (let k = 1; k / gaps.beta <= amps.length + 0.5; k++)
      d += vline(x(k / gaps.beta), 14, 92);
    scene.path(d, gaps.tone, { dashed: true, width: 1 });
    const every = 1 / gaps.beta;
    scene.label(
      100,
      2,
      `gaps every ${Number.isInteger(every) ? every : every.toFixed(1)}`,
      gaps.tone,
      "end",
    );
  }
  let bars = "";
  amps.forEach((a, i) => {
    const top = 92 - ((Math.max(-60, db(a / peak)) + 60) / 60) * 76;
    if (top < 91.5) bars += vline(x(i + 1), 92, top);
  });
  scene.path(hline(92, x0, 100), "faint");
  scene.path(bars, "ink", { width: 3 });
  scene.label(x0, 2, title);
  scene.label(x0, 100, "1", "dim", "start", "bottom");
  scene.label(100, 100, String(amps.length), "dim", "end", "bottom");
}

// A string from nut (x 2) to bridge (x 42) at y 58, and where along it a
// position (fraction from the bridge) falls, named along the bottom.
const STRING = { nut: 2, bridge: 42, y: 58 };
const stringAt = (beta: number) =>
  STRING.bridge - beta * (STRING.bridge - STRING.nut);

function stringDiagram(
  scene: Scene,
  title: string,
  titleTone: Tone,
  beta: number,
  positionTone: Tone,
) {
  scene.label(2, 2, title, titleTone);
  scene.path(vline(STRING.nut, 53, 63), "dim", { width: 2 });
  scene.path(vline(STRING.bridge, 50, 66), "dim", { width: 3 });
  const at = stringAt(beta);
  scene.path(vline(at, STRING.y - 4, STRING.y + 4), positionTone, { width: 3 });
  scene.label(
    2,
    100,
    `${percent(beta)} from the bridge`,
    positionTone,
    "start",
    "bottom",
  );
  scene.label(STRING.bridge, 100, "bridge", "dim", "end", "bottom");
}

function stringExciter(
  scene: Scene,
  { patch, values, note, toneOf }: GraphInput,
) {
  if (patch.family !== "string") return;
  const hardness = get(values, "exciter.hardness", 0.5);
  const beta = get(values, "exciter.position", 0.15);
  const strength = get(values, "exciter.strength", 0.8);
  const finger = has(values, "exciter.pluck")
    ? get(values, "exciter.pluck") >= 0.5
    : patch.exciter === "finger";
  const period = FS / midiToHz(note);
  const buffer = new Float32Array(Math.ceil(0.014 * FS + period) + 8);
  let length: number;
  if (patch.exciter === "hammer") {
    length = hammer(buffer, {
      period,
      velocity: VELOCITY,
      hardness,
      position: beta,
      strength,
      mass: patch.hammerMass ? keyTable(patch.hammerMass, note) : 1,
      fs: FS,
      contactMs: 0,
    });
  } else {
    length = pluck(buffer, new Noise(1000), {
      period,
      velocity: VELOCITY,
      hardness,
      position: beta,
      strength,
      finger,
    });
  }
  const at = stringAt(beta);
  const position = toneOf("exciter.position");
  if (patch.exciter === "hammer") {
    stringDiagram(
      scene,
      "a felt hammer strikes the string",
      "dim",
      beta,
      position,
    );
    scene.path(hline(STRING.y, STRING.nut, STRING.bridge), "ink", {
      width: 1.6,
    });
    scene.path(
      box(at - 1.4, STRING.y - 16, at + 1.4, STRING.y - 5),
      toneOf("exciter.hardness"),
      {
        fill: true,
        solid: true,
      },
    );
    scene.path(vline(at, STRING.y - 34, STRING.y - 16), "dim", { width: 2 });
  } else {
    stringDiagram(
      scene,
      finger
        ? "a fingertip lets go: a soft bump"
        : "a pick lets go: a sharp corner",
      toneOf("exciter.pluck"),
      beta,
      position,
    );
    scene.path(hline(STRING.y, STRING.nut, STRING.bridge), "faint", {
      dashed: true,
    });
    const half = Math.max(2, (0.5 - 0.35 * hardness) * 19);
    const shape = finger
      ? sample(80, (t) => {
          const x = STRING.nut + t * (STRING.bridge - STRING.nut);
          const d = Math.abs(x - at);
          const bump =
            d < half ? 0.5 + 0.5 * Math.cos((Math.PI * d) / half) : 0;
          return [x, STRING.y - 30 * bump];
        })
      : polyline([
          [STRING.nut, STRING.y],
          [at, STRING.y - 30],
          [STRING.bridge, STRING.y],
        ]);
    scene.path(shape, "ink", { width: 1.8 });
  }
  const amps = Array.from({ length: 32 }, (_, i) =>
    dft(buffer, length, (i + 1) / period),
  );
  harmonicBars(scene, amps, "harmonics it starts", {
    beta,
    tone: position,
  });
}

// A half-sine stick pulse over time (left), its spectrum over the note's
// modes (right).
function strikeExciter(
  scene: Scene,
  contact: { seconds: number; soft: number; hard: number },
  modes: readonly number[],
  f0: number,
  input: GraphInput,
) {
  const { toneOf } = input;
  const longest = contact.soft * 1.3;
  // Area-normalized, so the shortest (hardest) contact is the tallest.
  const pulse = (seconds: number, tone: Tone, extra: Partial<ScenePath>) => {
    const height = (contact.hard / seconds) * 40;
    scene.path(
      sample(40, (t) => [
        2 + ((t * seconds) / longest) * 38,
        50 - height * Math.sin(Math.PI * t),
      ]),
      tone,
      extra,
    );
  };
  scene.label(2, 2, "the strike: force over time");
  scene.path(hline(50, 2, 40), "faint");
  pulse(contact.soft, "faint", { dashed: true });
  pulse(contact.hard, "faint", { dashed: true });
  pulse(contact.seconds, toneOf("exciter.hardness"), { width: 2 });
  scene.label(
    40,
    54,
    `touches for ${ms(contact.seconds)}`,
    toneOf("exciter.hardness"),
    "end",
  );
  // Spectrum of the pulse from f0/2 to 24·f0, with the note's modes marked.
  const lo = Math.log10(f0 / 2);
  const hi = Math.log10(f0 * 24);
  const x = (f: number) => 50 + ((Math.log10(f) - lo) / (hi - lo)) * 50;
  const length = Math.max(1, Math.round(contact.seconds * FS));
  const buffer = new Float32Array(length);
  stick(buffer, contact.seconds, 1, FS);
  const dc = dft(buffer, length, 0);
  scene.path(hline(92, 50, 100), "faint");
  let ticks = "";
  modes.forEach((ratio) => (ticks += vline(x(f0 * ratio), 14, 92)));
  scene.path(ticks, "faint", { dashed: true });
  scene.path(
    sample(120, (t) => {
      const f = 10 ** (lo + (hi - lo) * t);
      const level = Math.max(-48, db(dft(buffer, length, f / FS) / dc));
      return [x(f), 16 - (level / 48) * 76];
    }),
    "ink",
    { width: 2 },
  );
  scene.label(50, 2, "how high it reaches (dashed: the modes)");
}

function barExciter(scene: Scene, input: GraphInput) {
  const { patch, values, note } = input;
  if (patch.family !== "bar") return;
  const [soft, hard] = patch.contact;
  const hardness = get(values, "exciter.hardness", 0.5);
  const seconds =
    (lerp(soft, hard, hardness) / 1000) * (1 + 0.3 * (0.5 - VELOCITY));
  strikeExciter(
    scene,
    { seconds, soft: soft / 1000, hard: hard / 1000 },
    patch.modes.map(([ratio]) => ratio),
    midiToHz(note),
    input,
  );
}

// The kit's lowest drum: the kick, or the first head that has a pitch.
function mainPiece(patch: Patch): DrumPieceSpec | undefined {
  if (patch.family !== "drums") return undefined;
  const pieces = Object.values(patch.pieces).filter(
    (piece): piece is DrumPieceSpec => piece !== undefined,
  );
  return (
    patch.pieces.kick ??
    pieces.find(
      (piece) => piece.model === "membrane" || piece.model === "loaded",
    ) ??
    pieces[0]
  );
}

function drumExciter(scene: Scene, input: GraphInput) {
  const { patch, values, toneOf } = input;
  const piece = mainPiece(patch);
  if (!piece || piece.model === "combo" || piece.model === "noise") return;
  const [soft, hard] = piece.stick;
  const hardness = get(values, "exciter.hardness", 0.6);
  const seconds = lerp(soft, hard, hardness * VELOCITY) / 1000;
  const f0 = piece.model === "metal" ? 400 : piece.f0;
  const ratios =
    piece.model === "membrane"
      ? [1, 1.593, 2.136, 2.295, 2.653, 2.917, 3.155, 3.5]
      : piece.model === "loaded"
        ? piece.partials.map(([ratio]) => ratio)
        : [1];
  strikeExciter(
    scene,
    { seconds, soft: soft / 1000, hard: hard / 1000 },
    ratios,
    f0,
    input,
  );
  const position = get(values, "exciter.position", 0.3);
  scene.label(
    100,
    100,
    `struck ${percent(position)} out from the centre · click ${get(values, "exciter.click", 1).toFixed(2)}×`,
    toneOf("exciter.position"),
    "end",
    "bottom",
  );
}

function bowExciter(scene: Scene, { values, toneOf }: GraphInput) {
  const pressure = get(values, "exciter.pressure", 0.75);
  const beta = get(values, "exciter.position", 0.18);
  const speed = get(values, "exciter.speed", 1);
  stringDiagram(
    scene,
    "the bow on the string",
    "dim",
    beta,
    toneOf("exciter.position"),
  );
  scene.path(hline(STRING.y, STRING.nut, STRING.bridge), "ink", { width: 1.6 });
  const at = stringAt(beta);
  const half = 0.8 + 1.8 * pressure;
  scene.path(box(at - half, 16, at + half, 84), toneOf("exciter.pressure"), {
    fill: true,
  });
  scene.path(box(at - half, 16, at + half, 84), toneOf("exciter.pressure"));
  const arrow = 10 + 16 * (speed - 0.5);
  const ax = at + half + 3;
  scene.path(
    `${vline(ax, STRING.y - arrow, STRING.y + arrow)} M${n2(ax - 1)} ${n2(STRING.y - arrow + 5)} L${n2(ax)} ${n2(STRING.y - arrow)} L${n2(ax + 1)} ${n2(STRING.y - arrow + 5)}`,
    toneOf("exciter.speed"),
    { width: 1.6 },
  );
  scene.label(ax + 1.5, STRING.y - arrow, "speed", toneOf("exciter.speed"));
  // STK's bow table: pressure maps the friction slope from 5 down to 1.
  const curve = (slope: number) =>
    sample(160, (t) => {
      const x = -1 + 2 * t;
      return [50 + t * 50, 92 - bowTable(x, 0.001, slope) * 76];
    });
  scene.path(`${hline(92, 50, 100)} ${vline(75, 14, 92)}`, "faint");
  scene.path(curve(5), "faint", { dashed: true });
  scene.path(curve(1), "faint", { dashed: true });
  scene.path(curve(5 - 4 * pressure), toneOf("exciter.pressure"), { width: 2 });
  scene.label(
    50,
    2,
    pressure > 0.6
      ? "a wide grip: it sticks, edgy"
      : pressure < 0.3
        ? "a narrow grip: it slips, airy"
        : "the hair's grip as it slips",
    toneOf("exciter.pressure"),
  );
  scene.label(75, 100, "slip speed", "dim", "middle", "bottom");
}

function boreExciter(scene: Scene, { patch, values, toneOf }: GraphInput) {
  if (patch.family !== "bore") return;
  const pressure = get(values, "exciter.pressure", 1);
  const noise = get(values, "exciter.noise", 1);
  const attack = get(values, "envelope.attack", 0.05);
  // Breath over a second: the envelope's attack, then the steady pressure
  // with its turbulence.
  scene.label(2, 2, "the breath");
  scene.path(hline(92, 2, 42), "faint");
  const steady =
    lerp(patch.pressure[0], patch.pressure[1], VELOCITY) * pressure;
  const scale = 60 / (patch.pressure[1] * 1.25);
  const jitter = new Noise(77);
  scene.path(
    sample(200, (t) => {
      const seconds = t * 0.6;
      const rise = Math.min(1, seconds / Math.max(attack, 0.005));
      const ripple = 1 + 0.12 * noise * jitter.next();
      return [2 + t * 40, 92 - steady * rise * ripple * scale];
    }),
    toneOf("exciter.pressure"),
    { width: 1.6 },
  );
  scene.label(
    42,
    92 - steady * scale - 4,
    `${pressure.toFixed(2)}× breath`,
    toneOf("exciter.pressure"),
    "end",
    "bottom",
  );
  scene.label(
    2,
    100,
    `noise ${noise.toFixed(2)}×`,
    toneOf("exciter.noise"),
    "start",
    "bottom",
  );
  scene.path(`${hline(92, 50, 100)} ${vline(75, 14, 92)}`, "faint");
  if (patch.model === "brass") {
    // The lips: a resonance near the note, which tension moves.
    const lip = get(values, "exciter.lip", 0.5);
    const ratio = 2 ** ((lip - 0.5) * 0.1);
    const x = (r: number) => 50 + ((Math.log2(r) + 0.25) / 0.5) * 50;
    const q = 20;
    scene.path(
      sample(160, (t) => {
        const r = 2 ** (-0.25 + 0.5 * t);
        const k = q * (r / ratio - ratio / r);
        return [x(r), 92 - (1 / Math.sqrt(1 + k * k)) * 76];
      }),
      toneOf("exciter.lip"),
      { width: 2 },
    );
    scene.path(vline(x(1), 14, 92), "dim", { dashed: true });
    scene.label(50, 2, "the lips ring near the note (dashed)");
    const cents = 1200 * Math.log2(ratio);
    scene.label(
      100,
      2,
      `${cents >= 0 ? "+" : ""}${Math.round(cents)} ¢`,
      toneOf("exciter.lip"),
      "end",
    );
    return;
  }
  const flute = patch.model === "flute";
  const slope =
    patch.model === "clarinet"
      ? -(0.1 + 0.4 * get(values, "exciter.reed", 0.5))
      : 0.1 + 0.4 * get(values, "exciter.reed", 0.5);
  scene.path(
    sample(160, (t) => {
      const x = (2 * t - 1) * (flute ? 1.6 : 1);
      const y = flute ? jetTable(x) : reedTable(x, 0.7, slope);
      return [50 + t * 50, 53 - y * 38];
    }),
    flute ? "ink" : toneOf("exciter.reed"),
    { width: 2 },
  );
  scene.label(
    50,
    2,
    flute ? "the jet: how the air sheet flips" : "the reed: how far it opens",
  );
  scene.label(75, 100, "pressure across it", "dim", "middle", "bottom");
}

// A free reed speaks once its drive passes 1, and swings wider the further
// past it: √((D − 1)/D).
function freeReedExciter(scene: Scene, { patch, values, toneOf }: GraphInput) {
  if (patch.family !== "reed") return;
  const pressure = get(values, "exciter.pressure", 1);
  const span = Math.max(3, patch.pressure[1] * pressure * 1.15);
  const x = (d: number) => 2 + (d / span) * 96;
  const y = (a: number) => 88 - a * 72;
  scene.label(2, 2, "how wide the reed swings for each drive");
  scene.path(`${hline(88, 2, 98)} ${vline(x(1), 14, 88)}`, "faint");
  scene.label(x(1) + 1, 88, "speaks", "dim", "start", "bottom");
  scene.path(
    sample(120, (t) => {
      const d = t * span;
      return [x(d), y(d > 1 ? Math.sqrt((d - 1) / d) : 0)];
    }),
    "ink",
    { width: 2 },
  );
  for (const [velocity, name] of [
    [0.2, "soft"],
    [1, "loud"],
  ] as const) {
    const d = lerp(patch.pressure[0], patch.pressure[1], velocity) * pressure;
    const a = d > 1 ? Math.sqrt((d - 1) / d) : 0;
    scene.path(vline(x(d), y(a), 88), toneOf("exciter.pressure"), { width: 2 });
    scene.label(
      x(d),
      y(a) - 2,
      name,
      toneOf("exciter.pressure"),
      "middle",
      "bottom",
    );
  }
  scene.label(
    98,
    100,
    `air noise ${get(values, "exciter.noise", 1).toFixed(2)}×`,
    toneOf("exciter.noise"),
    "end",
    "bottom",
  );
}

const WAVES = [
  (t: number) => Math.sin(2 * Math.PI * t),
  (t: number) => 1 - 4 * Math.abs(t - 0.5),
  (t: number) => (t < 0.5 ? 1 : -1),
  (t: number) => 2 * t - 1,
];

function oscillatorExciter(scene: Scene, { values, toneOf }: GraphInput) {
  const wave = Math.round(get(values, "exciter.wave"));
  const wave2 = Math.round(get(values, "exciter.wave2"));
  const level2 = wave2 > 0 ? get(values, "exciter.level2", 0.5) : 0;
  const phase = get(values, "exciter.phase") / 360;
  const at = (fn: (t: number) => number, t: number) => fn(((t % 1) + 1) % 1);
  const cycle = (fn: (t: number) => number, x0: number, scale: number) =>
    sample(160, (t) => [x0 + t * 28, 50 - at(fn, 2 * t) * scale]);
  scene.path(hline(50, 2, 98), "faint");
  scene.path(cycle(WAVES[wave], 2, 30), toneOf("exciter.wave"), { width: 2 });
  scene.label(16, 2, "wave 1", toneOf("exciter.wave"), "middle");
  if (wave2 > 0) {
    const second = (t: number) => WAVES[wave2 - 1]((t + phase) % 1);
    scene.path(cycle(second, 36, 30 * level2), toneOf("exciter.wave2"), {
      width: 2,
    });
    scene.label(
      50,
      2,
      `wave 2 · ${percent(level2)} · ${Math.round(phase * 360)}°`,
      toneOf("exciter.wave2"),
      "middle",
    );
  } else {
    scene.label(50, 50, "wave 2 off", "dim", "middle", "middle");
  }
  const sum = (t: number) =>
    (WAVES[wave](t) +
      (wave2 > 0 ? level2 * WAVES[wave2 - 1]((t + phase) % 1) : 0)) /
    (1 + level2);
  scene.path(cycle(sum, 70, 30), "ink", { width: 2 });
  scene.label(84, 2, "together", "dim", "middle");
}

export function exciterScene(input: GraphInput): GraphScene {
  const scene = new Scene();
  switch (input.patch.family) {
    case "string":
      stringExciter(scene, input);
      break;
    case "bar":
      barExciter(scene, input);
      break;
    case "drums":
      drumExciter(scene, input);
      break;
    case "bowed":
      bowExciter(scene, input);
      break;
    case "bore":
      boreExciter(scene, input);
      break;
    case "reed":
      freeReedExciter(scene, input);
      break;
    case "oscillator":
      oscillatorExciter(scene, input);
      break;
  }
  return scene.done();
}

// Partials or modes as bars against the harmonic series: outlined at the
// strike, solid `later` seconds on, a dashed line over what is left.
function partialBars(
  scene: Scene,
  partials: readonly { ratio: number; level: number; t60: number }[],
  maxRatio: number,
  later: number,
  decayTone: Tone,
) {
  const x = (r: number) => 2 + ((r - 0.5) / (maxRatio - 0.5)) * 96;
  const y = (level: number) => 92 - ((Math.max(-60, level) + 60) / 60) * 76;
  let ticks = "";
  for (let n = 1; n <= maxRatio; n++) ticks += vline(x(n), 92, 96);
  scene.path(`${hline(92, 2, 98)} ${ticks}`, "faint");
  let outline = "";
  let solid = "";
  const tops: [number, number][] = [];
  for (const { ratio, level, t60 } of partials) {
    if (ratio > maxRatio) break;
    const after = level - (60 * later) / t60;
    outline += vline(x(ratio), 92, y(level));
    if (after > -60) solid += vline(x(ratio), 92, y(after));
    tops.push([x(ratio), y(after)]);
  }
  scene.path(outline, "faint", { width: 5 });
  scene.path(solid, "ink", { width: 3 });
  scene.path(polyline(tops), decayTone, { dashed: true, width: 1.4 });
  scene.label(2, 2, `at the strike (outline) and ${ms(later)} later (solid)`);
  return x;
}

function stringResonator(
  scene: Scene,
  { patch, values, note, toneOf }: GraphInput,
) {
  if (patch.family !== "string") return;
  const f0 = midiToHz(note);
  const loop = new StringLoop(FS, f0);
  if (patch.jawari)
    loop.setJawari(
      patch.jawari.contact * get(values, "resonator.jawari"),
      patch.jawari.gap,
    );
  loop.tune(
    f0,
    keyTable(patch.t60, note) * get(values, "resonator.decay", 1),
    clamp(
      keyTable(patch.brightness, note) - get(values, "resonator.brightness"),
      0,
      0.95,
    ),
    keyTable(patch.dispersionStages, note),
    clamp(
      keyTable(patch.dispersionCoef, note) *
        get(values, "resonator.inharmonicity", 1),
      -0.95,
      0,
    ),
  );
  const partials = loop
    .partials(24)
    .map(({ hz, t60 }, i) => ({ ratio: hz / f0, level: db(1 / (i + 1)), t60 }));
  const x = partialBars(scene, partials, 26, 1, toneOf("resonator.brightness"));
  let stretch = "";
  partials.forEach(({ ratio }, i) => {
    if (Math.abs(x(ratio) - x(i + 1)) > 0.15)
      stretch += hline(94, x(i + 1), x(ratio));
  });
  scene.path(stretch, toneOf("resonator.inharmonicity"), { width: 2 });
  const last = partials[partials.length - 1];
  if (last) {
    const sharp = 1200 * Math.log2(last.ratio / partials.length);
    scene.label(
      98,
      2,
      `partial ${partials.length}: ${Math.round(sharp)} ¢ sharp`,
      toneOf("resonator.inharmonicity"),
      "end",
    );
  }
  const strings =
    patch.allocation === "key"
      ? Math.max(1, Math.min(3, Math.round(keyTable(patch.unison, note))))
      : patch.polarization
        ? 2
        : 1;
  const cents =
    patch.polarization?.detuneCents ??
    keyTable(patch.unisonDetune, note) * get(values, "resonator.detune", 1);
  if (strings > 1 && cents > 0) {
    const beat = f0 * (2 ** (cents / 1200) - 1);
    scene.label(
      98,
      12,
      `${strings === 2 && patch.polarization ? "2 planes" : `${strings} strings`} beat ${beat.toFixed(2)} Hz`,
      toneOf("resonator.detune"),
      "end",
    );
  }
}

function barResonator(
  scene: Scene,
  { patch, values, note, toneOf }: GraphInput,
) {
  if (patch.family !== "bar") return;
  const brightness = get(values, "resonator.brightness");
  const scale = keyTable(patch.decay, note) * get(values, "resonator.decay", 1);
  const x = partialBars(
    scene,
    patch.modes.map(([ratio, level, t60]) => ({
      ratio,
      level: db(level * ratio ** brightness),
      t60: t60 * scale,
    })),
    16,
    0.2,
    toneOf("resonator.brightness"),
  );
  for (const [ratio] of patch.modes)
    scene.label(x(ratio), 12, `×${ratio}`, "dim", "middle");
}

// A legato note sliding in: 1 − e^(−3t/glide), so it is 95% there at `glide`.
function glideResonator(scene: Scene, { values, toneOf }: GraphInput) {
  const glide = get(values, "resonator.portamento", 0.05);
  const span = Math.max(0.2, glide * 2);
  const x = (t: number) => 2 + (t / span) * 96;
  scene.label(2, 2, "a legato note slides from the one before");
  scene.path(`${hline(24, 2, 98)} ${hline(82, 2, 98)}`, "faint", {
    dashed: true,
  });
  scene.label(98, 22, "new note", "dim", "end", "bottom");
  scene.label(98, 84, "held note", "dim", "end");
  scene.path(
    sample(120, (t) => {
      const seconds = t * span;
      return [x(seconds), 82 - 58 * (1 - Math.exp((-3 * seconds) / glide))];
    }),
    toneOf("resonator.portamento"),
    { width: 2 },
  );
  scene.path(vline(x(glide), 20, 86), toneOf("resonator.portamento"), {
    dashed: true,
  });
  scene.label(
    x(glide) + 1,
    50,
    `there in ${ms(glide)}`,
    toneOf("resonator.portamento"),
  );
}

// The flow through the slot over two swings: narrower pulses as the slot
// widens (Brightness), and the beat of a second, sharper reed.
function freeReedResonator(
  scene: Scene,
  { patch, values, note, toneOf }: GraphInput,
) {
  if (patch.family !== "reed") return;
  const slot = 0.25 + 0.15 * get(values, "resonator.brightness");
  const d =
    lerp(patch.pressure[0], patch.pressure[1], VELOCITY) *
    get(values, "exciter.pressure", 1);
  const amplitude = d > 1 ? Math.sqrt((d - 1) / d) : 0;
  const opening = (z: number) => 0.5 * (z + Math.sqrt(z * z + 0.0025));
  const flow = (t: number) => {
    const x = amplitude * Math.sin(2 * Math.PI * t);
    return (
      0.02 + opening(x - slot) + (1 - patch.asymmetry) * opening(-x - slot)
    );
  };
  scene.label(2, 2, "air through the slot, two swings");
  scene.path(hline(88, 2, 98), "faint");
  scene.path(
    sample(240, (t) => [2 + t * 96, 88 - (flow(2 * t) / 0.8) * 72]),
    toneOf("resonator.brightness"),
    { width: 2 },
  );
  if (patch.reeds.length > 1) {
    const cents = patch.reeds[1][0] * get(values, "resonator.detune", 1);
    const beat = midiToHz(note) * (2 ** (cents / 1200) - 1);
    scene.label(
      98,
      2,
      `second reed beats ${beat.toFixed(1)} Hz`,
      toneOf("resonator.detune"),
      "end",
    );
  }
}

// The kit's main drum after a hit: its pitch dropping to rest, and its level.
function drumResonator(scene: Scene, { patch, values, toneOf }: GraphInput) {
  const piece = mainPiece(patch);
  if (!piece || (piece.model !== "membrane" && piece.model !== "loaded"))
    return;
  const tune = 2 ** (get(values, "resonator.tune") / 12);
  const decay = get(values, "resonator.decay", 1);
  const dropScale = get(values, "resonator.pitchDrop", 1);
  const f0 = piece.f0 * tune;
  const drop = (piece.pitchDrop ?? 0) * VELOCITY * dropScale;
  const tau = (piece.pitchTau ?? 50) / 1000;
  const t60 =
    (piece.model === "membrane" ? piece.t60[0] : piece.partials[0][1]) * decay;
  const span = 0.6;
  const x = (t: number) => 2 + (t / span) * 96;
  const kick = patch.family === "drums" && patch.pieces.kick !== undefined;
  scene.label(2, 2, `${kick ? "the kick" : "the main drum"} after a hit`);
  scene.path(hline(92, 2, 98), "faint");
  scene.path(
    sample(120, (t) => {
      const seconds = t * span;
      return [x(seconds), 92 - 76 * 10 ** ((-3 * seconds) / t60)];
    }) + ` L${n2(x(span))} 92 L2 92 Z`,
    toneOf("resonator.decay"),
    { fill: true },
  );
  scene.path(
    sample(120, (t) => {
      const seconds = t * span;
      return [
        x(seconds),
        60 - 40 * Math.min(1, drop * Math.exp(-seconds / tau)),
      ];
    }),
    toneOf("resonator.pitchDrop"),
    { width: 2 },
  );
  scene.label(98, 2, `settles at ${hz(f0)}`, toneOf("resonator.tune"), "end");
  scene.label(
    98,
    100,
    `snare wires ${get(values, "resonator.wires", 1).toFixed(2)}×`,
    toneOf("resonator.wires"),
    "end",
    "bottom",
  );
}

export function resonatorScene(input: GraphInput): GraphScene {
  const scene = new Scene();
  switch (input.patch.family) {
    case "string":
      stringResonator(scene, input);
      break;
    case "bar":
      barResonator(scene, input);
      break;
    case "bore":
    case "bowed":
      glideResonator(scene, input);
      break;
    case "reed":
      freeReedResonator(scene, input);
      break;
    case "drums":
      drumResonator(scene, input);
      break;
  }
  return scene.done();
}

const logAxis = (lo: number, hi: number) => {
  const a = Math.log10(lo);
  const b = Math.log10(hi);
  return (f: number) => 2 + ((Math.log10(f) - a) / (b - a)) * 96;
};

function frequencyGrid(
  scene: Scene,
  x: (f: number) => number,
  marks: readonly number[],
) {
  let grid = "";
  for (const f of marks) grid += vline(x(f), 12, 92);
  scene.path(grid, "faint");
  for (const f of marks)
    scene.label(
      x(f),
      100,
      f >= 1000 ? `${f / 1000}k` : String(f),
      "dim",
      "middle",
      "bottom",
    );
}

// The SVF lowpass's response over the note's partials, where the envelope
// opens it at each note, and where keytrack moves it for this note.
export function filterScene({
  patch,
  values,
  note,
  toneOf,
}: GraphInput): GraphScene {
  const scene = new Scene();
  const q = get(values, "filter.resonance", Math.SQRT1_2);
  const env = get(values, "filter.envAmount");
  const envDecay = get(values, "filter.envDecay", 0.3);
  const keytrack = get(values, "filter.keytrack");
  const cutoff = Math.min(
    0.45 * FS,
    get(values, "filter.cutoff", 16000) * 2 ** ((keytrack * (note - 60)) / 12),
  );
  const x = logAxis(40, 18000);
  const y = (level: number) =>
    92 - ((Math.max(-48, Math.min(18, level)) + 48) / 66) * 80;
  const lowpass = (f: number, c: number) => {
    const r = f / Math.min(c, 0.45 * FS);
    return -10 * Math.log10((1 - r * r) ** 2 + (r / q) ** 2);
  };
  frequencyGrid(scene, x, [100, 1000, 10000]);
  if (patch.family !== "drums") {
    const f0 = midiToHz(note);
    let before = "";
    let after = "";
    for (let n = 1; f0 * n <= 18000; n++) {
      const level = -20 * Math.log10(n) - 6;
      before += vline(x(f0 * n), 92, y(level));
      after += vline(x(f0 * n), 92, y(level + lowpass(f0 * n, cutoff)));
    }
    scene.path(before, "faint", { width: 2 });
    scene.path(after, "dim", { width: 2 });
  }
  const curve = (c: number) =>
    sample(200, (t) => {
      const f = 40 * (18000 / 40) ** t;
      return [x(f), y(lowpass(f, c))];
    });
  if (env > 0) {
    const opened = cutoff * (1 + env);
    scene.path(curve(opened), toneOf("filter.envAmount"), {
      dashed: true,
      width: 1.5,
    });
    const from = x(Math.min(opened, 18000));
    const to = x(cutoff);
    scene.path(
      `${hline(16, from, to + 1)} M${n2(to + 2)} 13 L${n2(to + 0.6)} 16 L${n2(to + 2)} 19`,
      toneOf("filter.envDecay"),
      { width: 1.5 },
    );
    scene.label(
      (from + to) / 2,
      13,
      `closes over ${ms(envDecay)}`,
      toneOf("filter.envDecay"),
      "middle",
      "bottom",
    );
  }
  scene.path(curve(cutoff), toneOf("filter.cutoff"), { width: 2 });
  if (q > 0.75) {
    const peak = cutoff * Math.sqrt(Math.max(0.05, 1 - 1 / (2 * q * q)));
    scene.path(
      vline(
        x(peak),
        y(lowpass(peak, cutoff)) - 3,
        y(lowpass(peak, cutoff)) + 3,
      ),
      toneOf("filter.resonance"),
      { width: 4 },
    );
  }
  scene.label(
    2,
    2,
    patch.family === "drums"
      ? "the kit's lowpass"
      : "the lowpass over the note's partials",
  );
  if (keytrack > 0)
    scene.label(
      98,
      2,
      `${hz(cutoff)} at this note`,
      toneOf("filter.keytrack"),
      "end",
    );
  return scene.done();
}

// Magnitude of the violin's measured body (STK's biquads, at 44.1 kHz).
function violinBody(f: number) {
  const w = (2 * Math.PI * f) / STK_RATE;
  let gain = 1;
  for (const [b0, b1, b2, a1, a2] of BODY_SECTIONS) {
    const num = Math.hypot(
      b0 + b1 * Math.cos(w) + b2 * Math.cos(2 * w),
      -b1 * Math.sin(w) - b2 * Math.sin(2 * w),
    );
    const den = Math.hypot(
      1 + a1 * Math.cos(w) + a2 * Math.cos(2 * w),
      -a1 * Math.sin(w) - a2 * Math.sin(2 * w),
    );
    gain *= num / den;
  }
  return gain;
}

// The body's response added to the bare string (0 dB, dashed), with the
// tone tilt; a kit's body is its stereo spread.
export function bodyScene({ patch, values, toneOf }: GraphInput): GraphScene {
  const scene = new Scene();
  const tone = get(values, "body.tone");
  if (patch.family === "drums") {
    const width = get(values, "body.width", 1);
    scene.label(2, 2, "where each piece sits, left to right");
    scene.path(`${hline(50, 2, 98)} ${vline(50, 40, 60)}`, "faint");
    let marks = "";
    for (const piece of Object.values(patch.pieces)) {
      if (!piece || piece.model === "combo") continue;
      const pan = clamp(piece.pan * width, -1, 1);
      marks += vline(50 + pan * 46, 38, 62);
    }
    scene.path(marks, toneOf("body.width"), { width: 3 });
    scene.label(2, 64, "left");
    scene.label(98, 64, "right", "dim", "end");
    if (tone !== 0)
      scene.label(
        98,
        100,
        tone > 0 ? "tilted bright" : "tilted dark",
        toneOf("body.tone"),
        "end",
        "bottom",
      );
    return scene.done();
  }
  const size = get(values, "body.size", 1);
  const resonance = get(values, "body.resonance", 1);
  const mix = has(values, "body.violin")
    ? get(values, "body.violin")
    : get(values, "body.mix");
  const high = 10 ** ((tone * 6) / 20);
  // The ±6 dB tilt: a one-pole split at 800 Hz, lows over `high`, highs times it.
  const tilt = (f: number): [number, number] => {
    const r = f / 800;
    const den = 1 + r * r;
    return [(1 / high + high * r * r) / den, (high * r - r / high) / den];
  };
  const body = patch.body;
  const response = (f: number) => {
    let re = 1;
    let im = 0;
    if (has(values, "body.violin")) {
      re = 1 + mix * (violinBody(f) / 4 - 1);
    } else if (body.type === "modal") {
      for (const [freq, t60, amp] of body.modes) {
        const fr = freq * size;
        const qm = (Math.PI * fr * t60 * resonance) / 6.9078;
        const k = qm * (f / fr - fr / f);
        re += (mix * amp) / (1 + k * k);
        im -= (mix * amp * k) / (1 + k * k);
      }
    } else if (body.type === "radiation") {
      const r = f / (body.highpass * size);
      let gain = r / Math.sqrt(1 + r * r);
      if (body.presence) {
        const fp = body.presence.freq * size;
        const k = body.presence.q * (f / fp - fp / f);
        gain *=
          1 +
          (10 ** ((body.presence.gainDb * resonance) / 20) - 1) / (1 + k * k);
      }
      re = 1 + mix * (gain - 1);
    }
    const [tr, ti] = tilt(f);
    return db(Math.hypot(re * tr - im * ti, re * ti + im * tr));
  };
  const x = logAxis(50, 6000);
  const y = (level: number) =>
    50 - (Math.max(-12, Math.min(12, level)) / 12) * 40;
  frequencyGrid(scene, x, [100, 1000]);
  scene.path(hline(y(0), 2, 98), "dim", { dashed: true });
  const curve = sample(300, (t) => {
    const f = 50 * (6000 / 50) ** t;
    return [x(f), y(response(f))];
  });
  scene.path(
    `${curve} L98 ${n2(y(0))} L2 ${n2(y(0))} Z`,
    toneOf(has(values, "body.violin") ? "body.violin" : "body.mix"),
    { fill: true },
  );
  if (tone !== 0) {
    scene.path(
      sample(100, (t) => {
        const f = 50 * (6000 / 50) ** t;
        const [tr, ti] = tilt(f);
        return [x(f), y(db(Math.hypot(tr, ti)))];
      }),
      toneOf("body.tone"),
      { dashed: true, width: 1.5 },
    );
  }
  scene.path(curve, "ink", { width: 2 });
  scene.label(
    2,
    2,
    has(values, "body.violin")
      ? "the violin's measured body"
      : body.type === "modal"
        ? `what the body adds: ${body.modes.length} resonances`
        : body.type === "radiation"
          ? "the bell: lows stay inside, highs radiate"
          : "the tone tilt",
  );
  if (body.type === "modal" && !has(values, "body.violin")) {
    const lowest = body.modes[0][0] * size;
    scene.label(
      x(lowest),
      y(response(lowest)) - 2,
      hz(lowest),
      toneOf("body.size"),
      "middle",
      "bottom",
    );
  }
  return scene.done();
}

const curveEase = (t: number) => 1 - 0.01 ** t;

// The ADSR the model's exciter follows; a string's attack and damper; the
// oscillator's gate.
export function envelopeScene({
  patch,
  values,
  note,
  toneOf,
}: GraphInput): GraphScene {
  const scene = new Scene();
  const y = (level: number) => 88 - level * 72;
  scene.path(hline(88, 2, 98), "faint");
  if (patch.family === "string") {
    const attack = get(values, "envelope.attack", 0.001);
    const t60 = keyTable(patch.t60, note) * get(values, "resonator.decay", 1);
    const damped =
      patch.noDamperAbove === undefined || note <= patch.noDamperAbove;
    const damper =
      keyTable(patch.damperT60, note) * get(values, "envelope.release", 1);
    const keyUp = 1;
    const span = 2;
    const x = (t: number) => 2 + (t / span) * 96;
    const level = (t: number) => {
      const rise = Math.min(1, t / Math.max(attack, 0.001));
      const held = 10 ** ((-3 * Math.min(t, keyUp)) / t60);
      const after =
        t > keyUp ? 10 ** ((-3 * (t - keyUp)) / (damped ? damper : t60)) : 1;
      return rise * held * after;
    };
    scene.path(
      sample(240, (t) => [x(t * span), y(level(t * span))]),
      "ink",
      { width: 2 },
    );
    scene.path(
      sample(20, (t) => [
        x(t * Math.min(attack * 3, 0.2)),
        y(level(t * Math.min(attack * 3, 0.2))),
      ]),
      toneOf("envelope.attack"),
      { width: 3 },
    );
    scene.path(vline(x(keyUp), 14, 88), "dim", { dashed: true });
    scene.label(x(keyUp) + 1, 14, "key up");
    scene.path(
      sample(60, (t) => [x(keyUp + t * 0.6), y(level(keyUp + t * 0.6))]),
      toneOf("envelope.release"),
      { width: 3 },
    );
    scene.label(2, 2, "the string's level: rings while held, damped at key up");
    scene.label(
      98,
      2,
      damped ? `damper ${ms(damper)}` : "no damper here",
      toneOf("envelope.release"),
      "end",
    );
    return scene.done();
  }
  const attack = get(values, "envelope.attack", 0.005);
  const release = get(values, "envelope.release", 0.1);
  const gate = !has(values, "envelope.decay");
  const decay = gate ? 0 : get(values, "envelope.decay", 0.1);
  const sustain = gate ? 1 : get(values, "envelope.sustain", 0.9);
  const span = (t: number, max: number) => 6 + 26 * Math.sqrt(t / max);
  const xa = 2 + span(attack, 0.5);
  const xd = gate ? xa : xa + span(decay, 1);
  const xr = 98 - span(release, gate ? 2 : 1);
  scene.path(
    sample(20, (t) => [2 + (xa - 2) * t, y(t)]),
    toneOf("envelope.attack"),
    { width: 2 },
  );
  if (!gate)
    scene.path(
      sample(30, (t) => [
        xa + (xd - xa) * t,
        y(1 + (sustain - 1) * curveEase(t)),
      ]),
      toneOf("envelope.decay"),
      { width: 2 },
    );
  scene.path(
    hline(y(sustain), xd, xr),
    gate ? "ink" : toneOf("envelope.sustain"),
    { width: 2 },
  );
  scene.path(
    sample(30, (t) => [xr + (98 - xr) * t, y(sustain * (1 - curveEase(t)))]),
    toneOf("envelope.release"),
    { width: 2 },
  );
  scene.path(`${vline(2, 12, 88)} ${vline(xr, 12, 88)}`, "faint", {
    dashed: true,
  });
  scene.label(3, 100, "key down", "dim", "start", "bottom");
  scene.label(xr + 1, 100, "key up", "dim", "start", "bottom");
  const drives =
    patch.family === "bore"
      ? "breath pressure → the exciter"
      : patch.family === "bowed"
        ? "bow speed → the exciter"
        : patch.family === "reed"
          ? "bellows → the exciter"
          : "the gate: full while the key is held";
  scene.label(98, 2, drives, "dim", "end");
  return scene.done();
}

const VIBRATO_SHAPES = [
  (t: number) => Math.sin(2 * Math.PI * t),
  (t: number) => 1 - 4 * Math.abs(t - 0.5),
  (t: number) => (t < 0.5 ? 1 : -1),
];
const RANDOM_STEPS = [0.6, -0.35, 0.9, -0.8, 0.15, -0.55, 0.4, -0.1];

// Where the vibrato's three depths go on each family: the model's own loop or
// exciter where it has one, else the voice's output right after the filter.
const VIBRATO_DESTINATIONS: Record<
  Patch["family"],
  { pitch: string; level: string }
> = {
  string: { pitch: "swept delay", level: "tremolo" },
  bar: { pitch: "swept delay", level: "tremolo" },
  reed: { pitch: "swept delay", level: "bellows" },
  bore: { pitch: "bore length", level: "breath" },
  bowed: { pitch: "string length", level: "bow" },
  oscillator: { pitch: "oscillators", level: "tremolo" },
  drums: { pitch: "", level: "" },
};

// The first 1.2 s of a note's vibrato: silent through its delay, fading in, and
// three gauges for how far it moves pitch, level and the cutoff.
export function vibratoScene({
  patch,
  values,
  toneOf,
}: GraphInput): GraphScene {
  const scene = new Scene();
  const rate = get(values, "vibrato.rate", 5);
  const shape = Math.round(get(values, "vibrato.shape"));
  const free = patch.family === "reed";
  const delay = free ? 0 : get(values, "vibrato.delay");
  const fade = free ? 0 : patch.family === "bowed" ? 0.4 : 0.3;
  const span = 1.2;
  const x = (t: number) => 2 + (t / span) * 96;
  const wave = (t: number) => {
    const after = t - delay;
    if (after <= 0) return 0;
    const cycles = after * rate;
    const phase = cycles - Math.floor(cycles);
    const value =
      shape < 3
        ? VIBRATO_SHAPES[shape](phase)
        : RANDOM_STEPS[Math.floor(cycles) % RANDOM_STEPS.length];
    return value * (fade > 0 ? Math.min(1, after / fade) : 1);
  };
  if (delay > 0) {
    scene.path(box(2, 10, x(delay), 56), "faint", { fill: true });
    scene.label(3, 12, `delay ${ms(delay)}`);
  }
  scene.path(hline(33, 2, 98), "faint", { dashed: true });
  scene.path(
    sample(600, (t) => [x(t * span), 33 - wave(t * span) * 20]),
    toneOf("vibrato.rate"),
    { width: 1.8 },
  );
  scene.label(
    98,
    2,
    free
      ? `${rate.toFixed(1)} Hz, one cycle for every voice`
      : `${rate.toFixed(1)} Hz`,
    toneOf("vibrato.rate"),
    "end",
  );
  const destinations = VIBRATO_DESTINATIONS[patch.family];
  const gauges = [
    [
      "Pitch",
      "vibrato.pitch",
      50,
      `±${get(values, "vibrato.pitch").toFixed(1)} ¢`,
      destinations.pitch,
    ],
    [
      "Level",
      "vibrato.level",
      0.3,
      `±${percent(get(values, "vibrato.level"))}`,
      destinations.level,
    ],
    [
      "Filter",
      "vibrato.filter",
      3,
      `±${get(values, "vibrato.filter").toFixed(1)} oct`,
      "cutoff",
    ],
  ] as const;
  gauges.forEach(([name, id, max, reading, destination], i) => {
    const left = 2 + i * 33;
    const centre = left + 15;
    const half = 15 * Math.min(1, get(values, id) / max);
    scene.path(hline(76, left, left + 30), "faint", { width: 6 });
    if (half > 0)
      scene.path(hline(76, centre - half, centre + half), toneOf(id), {
        width: 6,
      });
    scene.path(vline(centre, 71, 81), "dim");
    scene.label(left, 68, `${name} ${reading}`, toneOf(id), "start", "bottom");
    scene.label(left, 100, `→ ${destination}`, "dim", "start", "bottom");
  });
  return scene.done();
}

// The drive's curve and a wave through it, then how much goes to the mix
// and to the reverb.
export function outputScene({ values, toneOf }: GraphInput): GraphScene {
  const scene = new Scene();
  const level = get(values, "output.level", 1);
  const send = get(values, "space.send");
  let right = 2;
  if ("output.drive" in values) {
    const amount = get(values, "output.drive");
    const curve = (a: number) =>
      sample(80, (t) => {
        const input = -1 + 2 * t;
        return [2 + t * 26, 50 - saturate(input, a) * 36];
      });
    scene.label(2, 2, "drive: in → out");
    scene.path(`${box(2, 14, 28, 86)} M2 86 L28 14`, "faint");
    scene.path(curve(1), "faint", { dashed: true });
    scene.path(curve(amount), toneOf("output.drive"), { width: 2 });
    scene.label(32, 2, "a wave through it");
    scene.path(hline(50, 32, 60), "faint");
    scene.path(
      sample(120, (t) => [
        32 + t * 28,
        50 - 0.8 * Math.sin(4 * Math.PI * t) * 36,
      ]),
      "faint",
    );
    scene.path(
      sample(120, (t) => [
        32 + t * 28,
        50 - saturate(0.8 * Math.sin(4 * Math.PI * t), amount) * 36,
      ]),
      toneOf("output.drive"),
      { width: 2 },
    );
    right = 66;
  }
  const width = 98 - right;
  scene.label(right, 2, "where it goes");
  scene.label(right, 30, "to the mix", "dim", "start", "bottom");
  scene.label(
    98,
    30,
    `${level.toFixed(2)}×`,
    toneOf("output.level"),
    "end",
    "bottom",
  );
  scene.path(hline(36, right, 98), "faint", { width: 8 });
  scene.path(
    hline(36, right, right + (level / 2) * width),
    toneOf("output.level"),
    { width: 8 },
  );
  scene.path(vline(right + width / 2, 31, 41), "dim");
  scene.label(right, 66, "to the reverb", "dim", "start", "bottom");
  scene.label(98, 66, percent(send), toneOf("space.send"), "end", "bottom");
  scene.path(hline(72, right, 98), "faint", { width: 8 });
  if (send > 0)
    scene.path(hline(72, right, right + send * width), toneOf("space.send"), {
      width: 8,
    });
  return scene.done();
}

const STOP_NAMES: Record<SectionId, string> = {
  exciter: "EXCITER",
  resonator: "RESONATOR",
  filter: "FILTER",
  body: "BODY",
  output: "OUTPUT",
  envelope: "ENVELOPE",
  vibrato: "VIBRATO",
  master: "MASTER",
};

// What each stop is on this instrument.
function stopModel(
  patch: Patch,
  stop: SectionId,
  values: Values,
  exciter: string,
) {
  switch (stop) {
    case "exciter":
      return exciter;
    case "resonator":
      return patch.family === "string"
        ? "String loop"
        : patch.family === "bore"
          ? "Bore"
          : patch.family === "bowed"
            ? "String loop"
            : patch.family === "reed"
              ? "Reed tongue"
              : patch.family === "drums"
                ? "Heads"
                : "Modes";
    case "filter":
      return "Lowpass";
    case "body":
      return has(values, "body.violin")
        ? "Violin body"
        : patch.family === "drums"
          ? "Stereo"
          : patch.body.type === "modal"
            ? "Resonances"
            : patch.body.type === "radiation"
              ? "Bell"
              : "Tone";
    default:
      return `Reverb ${percent(get(values, "space.send"))}`;
  }
}

// A sketch of each stop for its block.
function stopSketch(
  stop: SectionId,
  x0: number,
  y0: number,
  w: number,
  h: number,
) {
  const at = (t: number, v: number): [number, number] => [
    x0 + t * w,
    y0 + (1 - v) * h,
  ];
  switch (stop) {
    case "exciter":
      return polyline([at(0, 0), at(0.25, 1), at(1, 0)]);
    case "resonator": {
      let d = "";
      for (let n = 1; n <= 7; n++)
        d += vline(
          x0 + ((n - 0.5) / 7) * w,
          y0 + h,
          y0 + h - (h * 0.9) / n ** 0.6,
        );
      return d;
    }
    case "filter":
      return sample(30, (t) =>
        at(
          t,
          t < 0.55
            ? 0.7 + 0.25 * Math.sin(t * 3)
            : Math.max(0, 0.9 - (t - 0.55) * 2.2),
        ),
      );
    case "body":
      return sample(40, (t) =>
        at(
          t,
          0.35 +
            0.3 * Math.exp(-((t - 0.25) ** 2) / 0.004) +
            0.2 * Math.exp(-((t - 0.5) ** 2) / 0.003),
        ),
      );
    default: {
      let d = "";
      [0.85, 0.6, 0.35].forEach(
        (v, i) =>
          (d += vline(x0 + ((i + 0.5) / 3) * w, y0 + h, y0 + h - v * h)),
      );
      return d;
    }
  }
}

// The overview: the chain's stops as blocks in signal order, the picked one
// green, and the instrument's envelope and vibrato wired to where they act.
export function chainScene(
  { patch, values }: GraphInput,
  pages: readonly SynthPage[],
  picked: SynthPageId,
  exciterName: string,
): GraphScene {
  const scene = new Scene();
  const stops = CHAIN_STOPS.filter((stop) =>
    pages.some((page) => page.id === stop),
  );
  const gap = 3.5;
  const width = (96 - gap * (stops.length - 1)) / stops.length;
  const left = (i: number) => 2 + i * (width + gap);
  const top = 6;
  const bottom = 50;
  const centre = (stop: SectionId) => {
    const i = stops.indexOf(stop);
    return i < 0 ? -1 : left(i) + width / 2;
  };
  stops.forEach((stop, i) => {
    const x0 = left(i);
    const pickedStop = picked === stop;
    if (pickedStop)
      scene.path(box(x0, top, x0 + width, bottom), "green", { fill: true });
    scene.path(
      box(x0, top, x0 + width, bottom),
      pickedStop ? "green" : "faint",
      { width: pickedStop ? 2 : 1 },
    );
    scene.label(x0 + 1.2, top + 3, STOP_NAMES[stop], "dim");
    scene.label(
      x0 + 1.2,
      top + 15,
      stopModel(patch, stop, values, exciterName),
      "ink",
    );
    scene.path(stopSketch(stop, x0 + 2, top + 28, width - 4, 13), "dim", {
      width: 1.4,
    });
    if (i < stops.length - 1) {
      const ax = x0 + width;
      scene.path(
        `${hline(28, ax + 0.4, ax + gap - 0.4)} M${n2(ax + gap - 1.4)} 25 L${n2(ax + gap - 0.4)} 28 L${n2(ax + gap - 1.4)} 31`,
        "dim",
      );
    }
  });
  const pill = (i: number, text: string, tone: Tone) => {
    const x0 = left(i);
    scene.path(box(x0, 78, x0 + width, 96), tone, { width: 1 });
    scene.label(x0 + width / 2, 87, text, tone, "middle", "middle");
    return x0 + width / 2;
  };
  // A wire from a pill along its lane and up to where it acts (`end`, a block's
  // bottom or the chain between two blocks), labelled beside its last climb.
  const wire = (
    from: number,
    to: number,
    lane: number,
    label: string,
    tone: Tone,
    labelY: number,
    end: number,
  ) => {
    if (to < 0) return;
    scene.path(
      `M${n2(from)} 78 V${n2(lane)} H${n2(to)} V${n2(end)} M${n2(to - 0.8)} ${n2(end + 4)} L${n2(to)} ${n2(end)} L${n2(to + 0.8)} ${n2(end + 4)}`,
      tone,
      { width: 1.2 },
    );
    scene.label(to + 1, labelY, label, tone, "start", "bottom");
  };
  const quarter = width / 4;
  // Where the voice's own output stage joins the chain: right after the
  // filter, before the body. The oscillator's gate and any vibrato the model
  // can't take itself (tremolo, the swept delay's pitch) act there.
  const filterAt = stops.indexOf("filter");
  const afterFilter = left(filterAt) + width + gap / 2;
  const join = (to: number) =>
    Math.abs(to - afterFilter) < 1 ? 31 : bottom + 1;
  const envelope = pages.find((page) => page.id === "envelope");
  if (envelope) {
    const from = pill(0, envelope.label.toUpperCase(), "green");
    const to =
      patch.family === "string"
        ? centre("resonator") - quarter
        : patch.family === "oscillator"
          ? afterFilter - 0.6
          : centre("exciter") - quarter;
    wire(
      from - quarter,
      to,
      70,
      envelope.label.toLowerCase(),
      "green",
      69,
      join(to),
    );
  }
  if (pages.some((page) => page.id === "vibrato")) {
    const ownsPitch = patch.family === "bore" || patch.family === "bowed";
    const ownsLevel = ownsPitch || patch.family === "reed";
    const routes: [id: string, to: number, label: string][] = [
      [
        "vibrato.pitch",
        patch.family === "oscillator"
          ? centre("exciter")
          : ownsPitch
            ? centre("resonator")
            : afterFilter,
        "pitch",
      ],
      [
        "vibrato.level",
        ownsLevel ? centre("exciter") + quarter : afterFilter,
        ownsLevel ? "level" : "tremolo",
      ],
      ["vibrato.filter", centre("filter"), "cutoff"],
    ];
    const on = routes.filter(([id]) => get(values, id) > 0);
    const from = pill(
      Math.min(1, stops.length - 1),
      on.length > 0
        ? `VIBRATO ${get(values, "vibrato.rate", 5).toFixed(1)} Hz`
        : "VIBRATO off",
      on.length > 0 ? "blue" : "dim",
    );
    // One wire to each place, naming all it moves there.
    const targets = new Map<number, string[]>();
    for (const [, to, label] of on)
      targets.set(to, [...(targets.get(to) ?? []), label]);
    for (const [to, labels] of targets)
      wire(from, to, 58, labels.join(" · "), "blue", bottom + 7, join(to));
  }
  return scene.done();
}

// The graph for a page of the Synth screen.
export function pageScene(
  page: SynthPage,
  input: GraphInput,
  pages: readonly SynthPage[],
  picked: SynthPageId,
  exciterName: string,
): GraphScene {
  switch (page.id) {
    case "chain":
      return chainScene(input, pages, picked, exciterName);
    case "exciter":
      return exciterScene(input);
    case "resonator":
      return resonatorScene(input);
    case "filter":
      return filterScene(input);
    case "body":
      return bodyScene(input);
    case "envelope":
      return envelopeScene(input);
    case "vibrato":
      return vibratoScene(input);
    case "master":
      return { paths: [], labels: [] };
    case "output":
      return outputScene(input);
  }
}

// A page drawn at the patch's defaults: for stories and checks.
export function previewPage(patch: Patch, pageId: SynthPageId) {
  const pages = synthPages(patch.params, patch.family);
  const page = pages.find(({ id }) => id === pageId) ?? pages[0];
  const values = Object.fromEntries(
    patch.params.map((spec) => [spec.id, spec.default]),
  );
  const toneOf = (id: string): Tone => {
    const slot = page.main.findIndex((spec) => spec?.id === id);
    return slot >= 0 ? KNOB_TONES[slot] : "dim";
  };
  const scene = pageScene(
    page,
    { patch, values, note: graphNote(patch), toneOf },
    pages,
    pages[1].id,
    "",
  );
  return { pages, page, values, scene };
}
