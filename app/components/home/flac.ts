// A small FLAC encoder: lossless, so the export is exactly the mix. Each
// block takes the best of FLAC's fixed predictors (orders 0–4) per channel
// and the best stereo coding (left/right, left/side, side/right or mid/side),
// and Rice-codes what the prediction leaves over in partitions. No browser
// encodes FLAC (WebCodecs offers it nowhere), so it runs here, in chunks.

const BLOCK = 4096;
const MAX_ORDER = 4;
const MAX_PARTITION_ORDER = 6;
// Residuals use FLAC's five-bit Rice parameters (coding method 1), since a
// loud mix's residuals outgrow the four-bit ones; 31 is the escape code.
const MAX_RICE = 30;
const RICE_BITS = 5;

class BitWriter {
  private bytes = new Uint8Array(1 << 16);
  private length = 0;
  private bits = 0;
  private count = 0;

  // Writes the low `n` bits of `value` (n ≤ 32), most significant first.
  write(value: number, n: number) {
    if (n > 24) {
      this.write(Math.floor(value / 0x1000000) & ((1 << (n - 24)) - 1), n - 24);
      this.write(value & 0xffffff, 24);
      return;
    }
    this.bits = (this.bits << n) | (value & ((1 << n) - 1));
    this.count += n;
    while (this.count >= 8) {
      this.count -= 8;
      this.push((this.bits >>> this.count) & 0xff);
    }
    this.bits &= (1 << this.count) - 1;
  }

  // `q` zeros then a one.
  unary(q: number) {
    while (q >= 24) {
      this.write(0, 24);
      q -= 24;
    }
    this.write(1, q + 1);
  }

  align() {
    if (this.count > 0) this.write(0, 8 - this.count);
  }

  get byteLength() {
    return this.length;
  }

  bytesFrom(start: number) {
    return this.bytes.subarray(start, this.length);
  }

  take() {
    const out = this.bytes.slice(0, this.length);
    this.length = 0;
    return out;
  }

  private push(byte: number) {
    if (this.length === this.bytes.length) {
      const grown = new Uint8Array(this.bytes.length * 2);
      grown.set(this.bytes);
      this.bytes = grown;
    }
    this.bytes[this.length++] = byte;
  }
}

const CRC8 = (() => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++)
      c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : c << 1;
    table[i] = c;
  }
  return table;
})();

const CRC16 = (() => {
  const table = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 8;
    for (let j = 0; j < 8; j++)
      c = c & 0x8000 ? ((c << 1) ^ 0x8005) & 0xffff : (c << 1) & 0xffff;
    table[i] = c;
  }
  return table;
})();

const crc8 = (bytes: Uint8Array) => {
  let c = 0;
  for (let i = 0; i < bytes.length; i++) c = CRC8[c ^ bytes[i]];
  return c;
};

const crc16 = (bytes: Uint8Array) => {
  let c = 0;
  for (let i = 0; i < bytes.length; i++)
    c = ((c << 8) ^ CRC16[((c >> 8) ^ bytes[i]) & 0xff]) & 0xffff;
  return c;
};

// Fixed predictor `order` (FLAC's polynomials): what it leaves of sample i.
const predicted = (x: Int32Array, i: number, order: number) =>
  order === 0
    ? x[i]
    : order === 1
      ? x[i] - x[i - 1]
      : order === 2
        ? x[i] - 2 * x[i - 1] + x[i - 2]
        : order === 3
          ? x[i] - 3 * x[i - 1] + 3 * x[i - 2] - x[i - 3]
          : x[i] - 4 * x[i - 1] + 6 * x[i - 2] - 4 * x[i - 3] + x[i - 4];

function residual(x: Int32Array, n: number, order: number, out: Int32Array) {
  for (let i = order; i < n; i++) out[i - order] = predicted(x, i, order);
}

// Zigzag: signed residuals to the unsigned values Rice codes.
const fold = (r: number) => (r >= 0 ? 2 * r : -2 * r - 1);

// The best Rice parameter for `count` folded values summing to `sum`, and
// about how many bits it codes them in.
function bestRice(sum: number, count: number) {
  if (count === 0) return { k: 0, bits: 0 };
  const mean = sum / count;
  let k = mean > 1 ? Math.min(MAX_RICE, Math.floor(Math.log2(mean))) : 0;
  let bits = count * (k + 1) + Math.floor(sum / 2 ** k);
  for (const candidate of [k - 1, k + 1]) {
    if (candidate < 0 || candidate > MAX_RICE) continue;
    const cost = count * (candidate + 1) + Math.floor(sum / 2 ** candidate);
    if (cost < bits) {
      bits = cost;
      k = candidate;
    }
  }
  return { k, bits };
}

// `order` -1 is a constant block (all samples equal, e.g. silence), written
// as its one value.
type Plan = {
  order: number;
  partitionOrder: number;
  params: number[];
  bits: number;
};

// One channel's block: the fixed order that leaves the least, then the Rice
// partitioning that codes it in the fewest bits. The finest partitions are
// summed once and merged pairwise for the coarser ones.
function plan(
  x: Int32Array,
  n: number,
  bps: number,
  scratch: Int32Array,
): Plan {
  let constant = true;
  for (let i = 1; i < n && constant; i++) constant = x[i] === x[0];
  if (constant) return { order: -1, partitionOrder: 0, params: [], bits: bps };
  let order = 0;
  let least = Infinity;
  for (let o = 0; o <= Math.min(MAX_ORDER, n - 1); o++) {
    let sum = 0;
    for (let i = o; i < n; i++) {
      const r = predicted(x, i, o);
      sum += r < 0 ? -r : r;
    }
    if (sum < least) {
      least = sum;
      order = o;
    }
  }
  residual(x, n, order, scratch);
  let finest = 0;
  while (
    finest < MAX_PARTITION_ORDER &&
    n % (1 << (finest + 1)) === 0 &&
    n >> (finest + 1) > order
  )
    finest++;
  const size = n >> finest;
  let sums: number[] = [];
  let counts: number[] = [];
  for (let part = 0, at = 0; part < 1 << finest; part++) {
    const length = part === 0 ? size - order : size;
    let sum = 0;
    for (let i = 0; i < length; i++) sum += fold(scratch[at + i]);
    sums.push(sum);
    counts.push(length);
    at += length;
  }
  let best: Plan | null = null;
  for (let p = finest; p >= 0; p--) {
    const params: number[] = [];
    let bits = 0;
    for (let i = 0; i < sums.length; i++) {
      const rice = bestRice(sums[i], counts[i]);
      params.push(rice.k);
      bits += RICE_BITS + rice.bits;
    }
    if (!best || bits < best.bits)
      best = { order, partitionOrder: p, params, bits };
    sums = sums
      .filter((_, i) => i % 2 === 0)
      .map((sum, i) => sum + sums[2 * i + 1]);
    counts = counts
      .filter((_, i) => i % 2 === 0)
      .map((count, i) => count + counts[2 * i + 1]);
  }
  return best!;
}

function writeSubframe(
  out: BitWriter,
  x: Int32Array,
  n: number,
  bps: number,
  { order, partitionOrder, params }: Plan,
  scratch: Int32Array,
) {
  if (order < 0) {
    out.write(0, 8);
    out.write(x[0], bps);
    return;
  }
  out.write(0, 1);
  out.write(0b001000 | order, 6);
  out.write(0, 1);
  for (let i = 0; i < order; i++) out.write(x[i], bps);
  residual(x, n, order, scratch);
  out.write(1, 2);
  out.write(partitionOrder, 4);
  const parts = 1 << partitionOrder;
  const size = n / parts;
  for (let part = 0, at = 0; part < parts; part++) {
    const k = params[part];
    out.write(k, RICE_BITS);
    const length = part === 0 ? size - order : size;
    for (let i = 0; i < length; i++) {
      const u = fold(scratch[at + i]);
      out.unary(Math.floor(u / 2 ** k));
      if (k > 0) out.write(u & ((1 << k) - 1), k);
    }
    at += length;
  }
}

// Frame numbers are written like UTF-8: a lead byte whose run of ones counts
// the bytes, then six bits a continuation byte.
function utf8Number(out: BitWriter, value: number) {
  if (value < 0x80) {
    out.write(value, 8);
    return;
  }
  const tail: number[] = [];
  let v = value;
  let room = 0x1f;
  let lead = 0xc0;
  for (;;) {
    tail.unshift(0x80 | (v & 0x3f));
    v = Math.floor(v / 64);
    if (v <= room) break;
    room >>= 1;
    lead = (lead >> 1) | 0x80;
  }
  out.write(lead | v, 8);
  for (const byte of tail) out.write(byte, 8);
}

// Encodes 24-bit stereo FLAC from float samples handed over in any chunks.
export class FlacEncoder {
  private readonly rate: number;
  private readonly bps = 24;
  private readonly out = new BitWriter();
  private readonly frames: Uint8Array<ArrayBuffer>[] = [];
  private readonly left = new Int32Array(BLOCK);
  private readonly right = new Int32Array(BLOCK);
  private readonly mid = new Int32Array(BLOCK);
  private readonly side = new Int32Array(BLOCK);
  private readonly scratch = new Int32Array(BLOCK);
  private filled = 0;
  private frameNumber = 0;
  private samples = 0;

  constructor(rate: number) {
    this.rate = rate;
  }

  push(left: Float32Array, right: Float32Array) {
    const scale = 2 ** (this.bps - 1) - 1;
    for (let i = 0; i < left.length; i++) {
      this.left[this.filled] = Math.round(
        Math.max(-1, Math.min(1, left[i])) * scale,
      );
      this.right[this.filled] = Math.round(
        Math.max(-1, Math.min(1, right[i])) * scale,
      );
      if (++this.filled === BLOCK) this.flush();
    }
  }

  // The finished file: the stream header, then every frame.
  finish() {
    if (this.filled > 0) this.flush();
    const header = new BitWriter();
    for (const c of "fLaC") header.write(c.charCodeAt(0), 8);
    header.write(1, 1);
    header.write(0, 7);
    header.write(34, 24);
    header.write(BLOCK, 16);
    header.write(BLOCK, 16);
    header.write(0, 24);
    header.write(0, 24);
    header.write(this.rate, 20);
    header.write(1, 3);
    header.write(this.bps - 1, 5);
    header.write(Math.floor(this.samples / 2 ** 32), 4);
    header.write(this.samples % 2 ** 32, 32);
    for (let i = 0; i < 4; i++) header.write(0, 32);
    return new Blob([header.take(), ...this.frames], { type: "audio/flac" });
  }

  private flush() {
    const n = this.filled;
    const { left, right, mid, side, scratch, out, bps } = this;
    for (let i = 0; i < n; i++) {
      mid[i] = (left[i] + right[i]) >> 1;
      side[i] = left[i] - right[i];
    }
    const l = plan(left, n, bps, scratch);
    const r = plan(right, n, bps, scratch);
    const m = plan(mid, n, bps, scratch);
    const s = plan(side, n, bps + 1, scratch);
    // Channel assignments: 1 independent, 8 left/side, 9 side/right, 10 mid/side.
    const options = [
      { code: 1, bits: l.bits + r.bits },
      { code: 8, bits: l.bits + s.bits },
      { code: 9, bits: s.bits + r.bits },
      { code: 10, bits: m.bits + s.bits },
    ];
    const { code } = options.reduce((a, b) => (b.bits < a.bits ? b : a));

    const start = out.byteLength;
    out.write(0b11111111111110, 14);
    out.write(0, 1);
    out.write(0, 1);
    out.write(n === BLOCK ? 0b1100 : 0b0111, 4);
    out.write(0, 4);
    out.write(code, 4);
    out.write(0b110, 3);
    out.write(0, 1);
    utf8Number(out, this.frameNumber++);
    if (n !== BLOCK) out.write(n - 1, 16);
    out.write(crc8(out.bytesFrom(start)), 8);

    const [first, second] =
      code === 1
        ? [
            [left, l, bps],
            [right, r, bps],
          ]
        : code === 8
          ? [
              [left, l, bps],
              [side, s, bps + 1],
            ]
          : code === 9
            ? [
                [side, s, bps + 1],
                [right, r, bps],
              ]
            : [
                [mid, m, bps],
                [side, s, bps + 1],
              ];
    for (const [x, chosen, depth] of [first, second] as [
      Int32Array,
      Plan,
      number,
    ][])
      writeSubframe(out, x, n, depth, chosen, scratch);
    out.align();
    const crc = crc16(out.bytesFrom(start));
    out.write(crc, 16);
    this.frames.push(out.take());
    this.samples += n;
    this.filled = 0;
  }
}
