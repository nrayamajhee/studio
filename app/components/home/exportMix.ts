import { PeakLimiter } from "../../lib/physical/dsp/PeakLimiter";
import { FlacEncoder } from "./flac";
import type { DrumPieceId, InstrumentId, KitId } from "../../lib/physical";
import type { Meter, PlayedNote } from "./noteRecorder";

// A rendered track in the mix: one pass of its audio, laid at each of its
// starts (ms on the timeline), at its level.
export type MixPart = {
  buffer: AudioBuffer;
  starts: readonly number[];
  level: number;
};

// Adds the parts' audio from `start` ms into `left` and `right`, as far as
// they reach, at `rate`.
export function mixInto(
  parts: readonly MixPart[],
  start: number,
  left: Float32Array,
  right: Float32Array,
  rate: number,
) {
  for (const { buffer, starts, level } of parts) {
    const l = buffer.getChannelData(0);
    const r = buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1));
    for (const at of starts) {
      const offset = Math.round(((at - start) * rate) / 1000);
      const from = Math.max(0, -offset);
      const to = Math.min(buffer.length, left.length - offset);
      for (let i = from; i < to; i++) {
        left[offset + i] += level * l[i];
        right[offset + i] += level * r[i];
      }
    }
  }
}

// The mix's length (ms): until the last pass's rendered tail ends.
export const mixLength = (parts: readonly MixPart[]) =>
  Math.max(
    0,
    ...parts.flatMap(({ buffer, starts }) =>
      starts.map((at) => at + buffer.duration * 1000),
    ),
  );

const CHUNK_SECONDS = 10;
// The tracks are summed outside the engine, so the export gets its own
// limiter, a touch under full scale.
const CEILING = 0.891;

// Builds the whole mix a chunk at a time through the limiter, handing each
// chunk to `sink`, so an hour-long mix never sits in memory whole. `progress`
// hears how much is done (0–1) after each chunk.
async function renderChunks(
  parts: readonly MixPart[],
  rate: number,
  sink: (left: Float32Array, right: Float32Array) => void | Promise<void>,
  progress?: (done: number) => void,
) {
  const limiter = new PeakLimiter(rate, CEILING);
  // Run on past the end by the limiter's delay, so the tail comes out.
  const total = Math.ceil((mixLength(parts) * rate) / 1000) + limiter.latency;
  const size = CHUNK_SECONDS * rate;
  for (let done = 0; done < total; done += size) {
    const frames = Math.min(size, total - done);
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    mixInto(parts, (done * 1000) / rate, left, right, rate);
    for (let i = 0; i < frames; i++) {
      limiter.process(left[i], right[i]);
      left[i] = limiter.left;
      right[i] = limiter.right;
    }
    await sink(left, right);
    progress?.((done + frames) / total);
    // Let the page breathe between chunks.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// The mix as 24-bit stereo FLAC: lossless, about half the size of a WAV.
export async function mixToFlac(
  parts: readonly MixPart[],
  rate: number,
  progress?: (done: number) => void,
) {
  const encoder = new FlacEncoder(rate);
  await renderChunks(
    parts,
    rate,
    (left, right) => encoder.push(left, right),
    progress,
  );
  return encoder.finish();
}

const ascii = (text: string) => new TextEncoder().encode(text);

// General MIDI programs (0-based) for each instrument, near enough.
const GM_PROGRAMS: Readonly<Record<InstrumentId, number>> = {
  piano: 0,
  guitar: 25,
  electricGuitar: 27,
  nylonGuitar: 24,
  ukulele: 24,
  banjo: 105,
  bass: 33,
  uprightBass: 32,
  harp: 46,
  sitar: 104,
  violin: 40,
  cello: 42,
  trumpet: 56,
  bassTrumpet: 57,
  trombone: 57,
  saxophone: 65,
  clarinet: 71,
  flute: 73,
  harmonium: 20,
  harmonica: 22,
  accordion: 21,
  xylophone: 13,
  steelPan: 114,
  kalimba: 108,
  oscillator: 80,
};

// General MIDI percussion keys for each drum piece; the hand-drum bols take
// the conga and bongo keys nearest their sound, and the brush sweep the
// brush kits' swirl.
const GM_DRUMS: Readonly<Record<DrumPieceId, number>> = {
  kick: 36,
  snare: 38,
  closedHat: 42,
  openHat: 46,
  clap: 39,
  lowTom: 45,
  highTom: 50,
  cowbell: 56,
  crash: 49,
  ride: 51,
  sweep: 40,
  stick: 37,
  bell: 53,
  tambourine: 54,
  na: 63,
  ta: 62,
  tin: 60,
  tun: 64,
  te: 61,
  ti: 61,
  ge: 64,
  ke: 75,
  ka: 75,
  dha: 63,
  dhin: 60,
};

// A track for the MIDI file: its notes as they sound on the timeline (ms),
// already at their sounding pitch, or as drum pieces for a kit.
export type MidiPart = {
  name: string;
  target: InstrumentId | KitId;
  volume: number;
  notes: readonly (PlayedNote & { piece?: DrumPieceId })[];
};

const PPQ = 480;
const DRUM_CHANNEL = 9;

function vlq(value: number) {
  const bytes = [value & 0x7f];
  for (let v = value >> 7; v > 0; v >>= 7) bytes.unshift((v & 0x7f) | 0x80);
  return bytes;
}

function chunk(type: string, body: readonly number[]) {
  const size = body.length;
  return [
    ...ascii(type),
    (size >>> 24) & 0xff,
    (size >>> 16) & 0xff,
    (size >>> 8) & 0xff,
    size & 0xff,
    ...body,
  ];
}

// A track's events by absolute tick, as delta-timed bytes with its end.
function trackBytes(events: { tick: number; bytes: readonly number[] }[]) {
  const body: number[] = [];
  let last = 0;
  for (const { tick, bytes } of events) {
    body.push(...vlq(tick - last), ...bytes);
    last = tick;
  }
  body.push(0, 0xff, 0x2f, 0);
  return chunk("MTrk", body);
}

// A Standard MIDI File (type 1): a tempo and meter track, then a track per
// part on its own channel (kits on the drum channel) with its program and
// volume.
export function mixToMidi(
  parts: readonly MidiPart[],
  bpm: number,
  meter: Meter,
  isKit: (target: InstrumentId | KitId) => target is KitId,
) {
  const perBeat = (PPQ * 4) / meter.unit;
  const tick = (ms: number) => Math.round((ms * bpm * perBeat) / 60_000);
  const quarter = Math.round((60e6 / bpm) * (meter.unit / 4));
  const conductor = trackBytes([
    { tick: 0, bytes: [0xff, 0x03, ...vlq(6), ...ascii("Studio")] },
    {
      tick: 0,
      bytes: [
        0xff,
        0x51,
        3,
        (quarter >> 16) & 0xff,
        (quarter >> 8) & 0xff,
        quarter & 0xff,
      ],
    },
    {
      tick: 0,
      bytes: [0xff, 0x58, 4, meter.beats, Math.log2(meter.unit), 24, 8],
    },
  ]);
  let channel = 0;
  const tracks = parts.map((part) => {
    const kit = isKit(part.target);
    let ch = DRUM_CHANNEL;
    if (!kit) {
      if (channel === DRUM_CHANNEL) channel++;
      ch = channel++ % 16;
    }
    const name = ascii(part.name);
    const events: { tick: number; order: number; bytes: number[] }[] = [
      { tick: 0, order: 0, bytes: [0xff, 0x03, ...vlq(name.length), ...name] },
      {
        tick: 0,
        order: 0,
        bytes: [0xb0 | ch, 7, Math.round(Math.min(1, part.volume) * 127)],
      },
    ];
    if (!kit)
      events.push({
        tick: 0,
        order: 0,
        bytes: [0xc0 | ch, GM_PROGRAMS[part.target as InstrumentId]],
      });
    for (const { note, start, duration, velocity, piece } of part.notes) {
      const key = kit && piece ? GM_DRUMS[piece] : note;
      if (key < 0 || key > 127) continue;
      const on = tick(start);
      const off = Math.max(on + 1, tick(start + duration));
      const level = Math.max(1, Math.min(127, Math.round(velocity * 127)));
      // At one tick, note-offs come before note-ons, so repeats retrigger.
      events.push({ tick: on, order: 2, bytes: [0x90 | ch, key, level] });
      events.push({ tick: off, order: 1, bytes: [0x80 | ch, key, 0] });
    }
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    return trackBytes(events);
  });
  const header = chunk("MThd", [
    0,
    1,
    (tracks.length + 1) >> 8,
    (tracks.length + 1) & 0xff,
    PPQ >> 8,
    PPQ & 0xff,
  ]);
  return new Blob(
    [new Uint8Array([...header, ...conductor, ...tracks.flat()])],
    {
      type: "audio/midi",
    },
  );
}

// Hands the browser a file to save.
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
