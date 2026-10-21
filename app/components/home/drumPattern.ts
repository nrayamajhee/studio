import type { BusId, DrumPieceId, KitId } from "../../lib/physical";
import { PATCH_BY_ID } from "../../lib/physical/patches";
import type { DrumKitPatch } from "../../lib/physical/patches/types";
import { F3_MIDI } from "./deviceMath";
import type { Meter, PlayedNote, Take, Timing } from "./noteRecorder";

// A hit on the drum grid: which piece, how hard (0–1), and where, in
// beats from the pattern's start. Kept in beats, so a change of resolution
// moves it to the nearest step without losing where it was.
export type DrumHit = {
  piece: DrumPieceId;
  beat: number;
  velocity: number;
};

// A drum pattern: `bars` bars of the meter, on a grid of `perBeat` steps a
// beat, its hits written for `kit` (see carryPattern). Hits past its end are
// kept for when it grows again.
export type DrumPattern = {
  perBeat: number;
  bars: number;
  hits: readonly DrumHit[];
  kit?: KitId;
};

// Steps a beat the blue knob picks from: eighths to 32nds, and triplets.
export const STEP_RESOLUTIONS: readonly number[] = [2, 3, 4, 6, 8];
export const MAX_STEP_BARS = 8;
export const INITIAL_PATTERN: DrumPattern = { perBeat: 4, bars: 1, hits: [] };

const kitKeys = (kit: KitId) => (PATCH_BY_ID[kit] as DrumKitPatch).keys;

// A kit's rows, top to bottom: its pieces as the keybed plays them from its
// lowest key (F) up, each once, turned over so the lowest key's piece (the
// kick) sits at the bottom, as on a piano roll.
export const kitRows = (kit: KitId): DrumPieceId[] => {
  const keys = kitKeys(kit);
  const fromLowest = keys.map((_, i) => keys[(F3_MIDI + i) % 12]);
  return [...new Set(fromLowest)].reverse();
};

// A drum hit's note in a take, fixed by the piece's name rather than the key
// a kit puts it on, so moving pieces between keys never changes what a
// recording plays: the General MIDI drum map for the kit pieces, and a run
// from middle C for the hand-drum bols.
export const PIECE_NOTES: Readonly<Record<DrumPieceId, number>> = {
  kick: 36,
  sticks: 31,
  stick: 37,
  snare: 38,
  clap: 39,
  sweep: 40,
  closedHat: 42,
  lowTom: 45,
  openHat: 46,
  crash: 49,
  highTom: 50,
  ride: 51,
  bell: 53,
  tambourine: 54,
  cowbell: 56,
  dha: 60,
  dhin: 61,
  na: 62,
  ta: 63,
  tin: 64,
  tun: 65,
  te: 66,
  ti: 67,
  ge: 68,
  ke: 69,
  ka: 70,
};

const NOTE_PIECES = new Map(
  Object.entries(PIECE_NOTES).map(([piece, note]) => [
    note,
    piece as DrumPieceId,
  ]),
);

// The piece a take's note strikes on a kit, if it is one.
export const notePiece = (note: number) => NOTE_PIECES.get(note);

// Where a stroke lands on a drum and how: the open bass, a slap on it, the
// open treble, its rim with the fundamental damped, a slap on it, or bass and
// treble at once.
type Stroke =
  "openBass" | "bassSlap" | "openTreble" | "trebleRim" | "trebleSlap" | "both";

// The hand drums' strokes by where they land; the first of each kind is the
// one a stroke from elsewhere becomes.
const HAND_STROKES: Partial<
  Record<KitId, Partial<Record<DrumPieceId, Stroke>>>
> = {
  madal: {
    dhin: "openBass",
    ka: "bassSlap",
    ta: "openTreble",
    tin: "trebleRim",
    ti: "trebleSlap",
    dha: "both",
  },
  tabla: {
    ge: "openBass",
    ke: "bassSlap",
    tin: "openTreble",
    tun: "openTreble",
    na: "trebleRim",
    te: "trebleSlap",
    dha: "both",
    dhin: "both",
  },
};

// A drum kit's pieces by the stroke that stands in for each on a hand drum,
// and the piece each stroke comes back as: the kick for the open bass, the
// snare for a slap on it, the hats for the treble's ring and rim.
const KIT_STROKES: Partial<Record<DrumPieceId, Stroke>> = {
  kick: "openBass",
  lowTom: "openBass",
  snare: "bassSlap",
  clap: "bassSlap",
  openHat: "openTreble",
  highTom: "openTreble",
  closedHat: "trebleRim",
  ride: "trebleRim",
  bell: "trebleRim",
  cowbell: "trebleRim",
  stick: "trebleSlap",
  sticks: "trebleSlap",
  tambourine: "trebleSlap",
  crash: "both",
};
const KIT_PIECES: Readonly<Record<Stroke, DrumPieceId>> = {
  openBass: "kick",
  bassSlap: "snare",
  openTreble: "openHat",
  trebleRim: "closedHat",
  trebleSlap: "stick",
  both: "kick",
};

// What `piece`, played on `from`, becomes on `to`: the same piece between
// drum kits (each keeps its own), and to or from a hand drum the piece or
// stroke landing the same way, where the kit has one.
function carryPiece(piece: DrumPieceId, from: KitId, to: KitId) {
  const fromHand = HAND_STROKES[from];
  const toHand = HAND_STROKES[to];
  if (!fromHand && !toHand) return piece;
  const stroke = fromHand ? fromHand[piece] : KIT_STROKES[piece];
  if (!stroke) return piece;
  const carried = toHand
    ? (Object.keys(toHand) as DrumPieceId[]).find(
        (other) => toHand[other] === stroke,
      )
    : KIT_PIECES[stroke];
  return carried && kitRows(to).includes(carried) ? carried : piece;
}

// The pattern written for `kit`: each hit moved to the piece or stroke that
// plays it there (a kick to the madal's dhin, the madal's dhin to the
// tabla's ge, and back), the louder kept where two land together.
export function carryPattern(pattern: DrumPattern, kit: KitId): DrumPattern {
  const from = pattern.kit;
  if (from === kit) return pattern;
  if (!from) return { ...pattern, kit };
  const hits = new Map<string, DrumHit>();
  for (const hit of pattern.hits) {
    const piece = carryPiece(hit.piece, from, kit);
    const key = `${piece}@${hit.beat}`;
    const there = hits.get(key);
    if (!there || there.velocity < hit.velocity)
      hits.set(key, { ...hit, piece });
  }
  return { ...pattern, kit, hits: [...hits.values()] };
}

const isKitBus = (bus: BusId): bus is KitId =>
  PATCH_BY_ID[bus]?.family === "drums";

// A take's note played on `from`, as `to` plays it: between kits the piece or
// stroke that plays it there (see carryPiece); an instrument's note on a kit
// the piece its key strikes; a kit's note on an instrument the key on the
// keybed (from F3) its piece sits on. Null where nothing plays it.
export function carryNote(note: number, from: BusId, to: BusId) {
  if (!isKitBus(from))
    return isKitBus(to) ? PIECE_NOTES[kitKeys(to)[note % 12]] : note;
  const piece = notePiece(note);
  if (!piece) return null;
  if (isKitBus(to)) return PIECE_NOTES[carryPiece(piece, from, to)];
  const key = kitKeys(from).indexOf(piece);
  return key < 0 ? null : F3_MIDI + ((((key - F3_MIDI) % 12) + 12) % 12);
}

export const patternSteps = (pattern: DrumPattern, meter: Meter) =>
  pattern.bars * meter.beats * pattern.perBeat;

export const hitStep = (hit: DrumHit, perBeat: number) =>
  Math.round(hit.beat * perBeat);

export const hitsAt = (pattern: DrumPattern, step: number) =>
  pattern.hits.filter((hit) => hitStep(hit, pattern.perBeat) === step);

const lands =
  (pattern: DrumPattern, piece: DrumPieceId, step: number) => (hit: DrumHit) =>
    hit.piece === piece && hitStep(hit, pattern.perBeat) === step;

// Adds `piece` at `step`, unless it already lands there.
export function addHit(
  pattern: DrumPattern,
  piece: DrumPieceId,
  step: number,
  velocity: number,
): DrumPattern {
  if (pattern.hits.some(lands(pattern, piece, step))) return pattern;
  return {
    ...pattern,
    hits: [...pattern.hits, { piece, beat: step / pattern.perBeat, velocity }],
  };
}

// Takes `piece` off `step` if it lands there, or else adds it.
export function toggleHit(
  pattern: DrumPattern,
  piece: DrumPieceId,
  step: number,
  velocity: number,
): DrumPattern {
  const there = lands(pattern, piece, step);
  if (!pattern.hits.some(there)) return addHit(pattern, piece, step, velocity);
  return { ...pattern, hits: pattern.hits.filter((hit) => !there(hit)) };
}

// The pattern as a take a track can keep, at `bpm`: each of the kit's hits
// on its step, played by its key, one step long.
export function patternTake(
  pattern: DrumPattern,
  kit: KitId,
  meter: Meter,
  bpm: number,
): Take {
  const steps = patternSteps(pattern, meter);
  const step = 60_000 / bpm / pattern.perBeat;
  const rows = new Set(kitRows(kit));
  const notes: PlayedNote[] = pattern.hits
    .filter(
      (hit) => rows.has(hit.piece) && hitStep(hit, pattern.perBeat) < steps,
    )
    .map((hit) => ({
      note: PIECE_NOTES[hit.piece],
      start: hitStep(hit, pattern.perBeat) * step,
      duration: step,
      velocity: hit.velocity,
    }))
    .sort((a, b) => a.start - b.start || a.note - b.note);
  return { notes, length: steps * step, bpm };
}

// A kit's take (a drum track) as a pattern on its grid, or 1/16 for a free
// one: each note becomes its piece's hit on the nearest step (the louder of
// two landing together), over as many bars as the take runs, up to the most
// a pattern has.
export function takePattern(
  take: Take,
  kit: KitId,
  timing: Timing,
): DrumPattern {
  const perBeat = STEP_RESOLUTIONS.includes(timing.perBeat)
    ? timing.perBeat
    : 4;
  const beat = 60_000 / take.bpm;
  const rows = new Set(kitRows(kit));
  const hits = new Map<string, DrumHit>();
  for (const { note, start, velocity } of take.notes) {
    const piece = notePiece(note);
    if (!piece || !rows.has(piece)) continue;
    const step = Math.round((start / beat) * perBeat);
    const key = `${piece}@${step}`;
    const there = hits.get(key);
    if (!there || there.velocity < velocity)
      hits.set(key, { piece, beat: step / perBeat, velocity });
  }
  const bars = Math.ceil(take.length / beat / timing.meter.beats - 1e-6);
  return {
    perBeat,
    bars: Math.max(1, Math.min(MAX_STEP_BARS, bars)),
    hits: [...hits.values()],
    kit,
  };
}

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isPattern = (value: unknown): value is DrumPattern => {
  const pattern = value as DrumPattern;
  return (
    STEP_RESOLUTIONS.includes(pattern?.perBeat) &&
    Number.isInteger(pattern.bars) &&
    pattern.bars >= 1 &&
    pattern.bars <= MAX_STEP_BARS &&
    (pattern.kit === undefined ||
      PATCH_BY_ID[pattern.kit]?.family === "drums") &&
    Array.isArray(pattern.hits) &&
    pattern.hits.every(
      (hit) =>
        typeof hit?.piece === "string" &&
        isNumber(hit.beat) &&
        isNumber(hit.velocity),
    )
  );
};
