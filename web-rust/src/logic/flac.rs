//! A small FLAC encoder, as web-react's `flac.ts`: lossless, so the export
//! is exactly the mix. Each block takes the best of FLAC's fixed predictors
//! (orders 0–4) per channel and the best stereo coding (left/right,
//! left/side, side/right or mid/side), and Rice-codes what the prediction
//! leaves over in partitions. It writes the same bytes as web-react's.

const BLOCK: usize = 4096;
const MAX_ORDER: usize = 4;
const MAX_PARTITION_ORDER: usize = 6;
/// Residuals use FLAC's five-bit Rice parameters (coding method 1), since a
/// loud mix's residuals outgrow the four-bit ones; 31 is the escape code.
const MAX_RICE: i64 = 30;
const RICE_BITS: u32 = 5;

#[derive(Default)]
struct BitWriter {
  bytes: Vec<u8>,
  bits: u64,
  count: u32,
}

impl BitWriter {
  /// Writes the low `n` bits of `value` (n ≤ 32), most significant first.
  fn write(&mut self, value: i64, n: u32) {
    if n > 24 {
      self.write((value >> 24) & ((1 << (n - 24)) - 1), n - 24);
      self.write(value & 0xff_ffff, 24);
      return;
    }
    self.bits = (self.bits << n) | (value as u64 & ((1 << n) - 1));
    self.count += n;
    while self.count >= 8 {
      self.count -= 8;
      self.bytes.push((self.bits >> self.count) as u8);
    }
    self.bits &= (1 << self.count) - 1;
  }

  /// `q` zeros then a one.
  fn unary(&mut self, mut q: u64) {
    while q >= 24 {
      self.write(0, 24);
      q -= 24;
    }
    self.write(1, q as u32 + 1);
  }

  fn align(&mut self) {
    if self.count > 0 {
      self.write(0, 8 - self.count);
    }
  }
}

fn crc8(bytes: &[u8]) -> u8 {
  let mut c = 0u8;
  for &byte in bytes {
    c ^= byte;
    for _ in 0..8 {
      c = if c & 0x80 != 0 {
        (c << 1) ^ 0x07
      } else {
        c << 1
      };
    }
  }
  c
}

fn crc16(bytes: &[u8]) -> u16 {
  let mut c = 0u16;
  for &byte in bytes {
    c ^= u16::from(byte) << 8;
    for _ in 0..8 {
      c = if c & 0x8000 != 0 {
        (c << 1) ^ 0x8005
      } else {
        c << 1
      };
    }
  }
  c
}

/// Fixed predictor `order` (FLAC's polynomials): what it leaves of sample
/// `i`.
fn predicted(x: &[i64], i: usize, order: usize) -> i64 {
  match order {
    0 => x[i],
    1 => x[i] - x[i - 1],
    2 => x[i] - 2 * x[i - 1] + x[i - 2],
    3 => x[i] - 3 * x[i - 1] + 3 * x[i - 2] - x[i - 3],
    _ => x[i] - 4 * x[i - 1] + 6 * x[i - 2] - 4 * x[i - 3] + x[i - 4],
  }
}

fn residual(x: &[i64], n: usize, order: usize, out: &mut [i64]) {
  for i in order..n {
    out[i - order] = predicted(x, i, order);
  }
}

/// Zigzag: signed residuals to the unsigned values Rice codes.
fn fold(r: i64) -> u64 {
  if r >= 0 {
    2 * r as u64
  } else {
    (-2 * r - 1) as u64
  }
}

/// The best Rice parameter for `count` folded values summing to `sum`, and
/// about how many bits it codes them in.
fn best_rice(sum: u64, count: usize) -> (u32, u64) {
  if count == 0 {
    return (0, 0);
  }
  let mean = sum as f64 / count as f64;
  let mut k = if mean > 1. {
    (mean.log2().floor() as i64).min(MAX_RICE)
  } else {
    0
  };
  let cost = |k: i64| count as u64 * (k as u64 + 1) + (sum >> k);
  let mut bits = cost(k);
  for candidate in [k - 1, k + 1] {
    if !(0..=MAX_RICE).contains(&candidate) {
      continue;
    }
    if cost(candidate) < bits {
      bits = cost(candidate);
      k = candidate;
    }
  }
  (k as u32, bits)
}

/// How one channel's block is coded: `order` `None` is a constant block,
/// written as its one value.
#[derive(Clone)]
struct Plan {
  order: Option<usize>,
  partition_order: usize,
  params: Vec<u32>,
  bits: u64,
}

/// The fixed order that leaves the least, then the Rice partitioning that
/// codes it in the fewest bits. The finest partitions are summed once and
/// merged pairwise for the coarser ones.
fn plan(x: &[i64], n: usize, bps: u32, scratch: &mut [i64]) -> Plan {
  if x[..n].iter().all(|&sample| sample == x[0]) {
    return Plan {
      order: None,
      partition_order: 0,
      params: Vec::new(),
      bits: u64::from(bps),
    };
  }
  let mut order = 0;
  let mut least = u64::MAX;
  for o in 0..=MAX_ORDER.min(n - 1) {
    let sum: u64 = (o..n).map(|i| predicted(x, i, o).unsigned_abs()).sum();
    if sum < least {
      least = sum;
      order = o;
    }
  }
  residual(x, n, order, scratch);
  let mut finest = 0;
  while finest < MAX_PARTITION_ORDER
    && n.is_multiple_of(1 << (finest + 1))
    && n >> (finest + 1) > order
  {
    finest += 1;
  }
  let size = n >> finest;
  let mut sums = Vec::new();
  let mut counts = Vec::new();
  let mut at = 0;
  for part in 0..1 << finest {
    let length = if part == 0 { size - order } else { size };
    sums.push(
      scratch[at..at + length]
        .iter()
        .map(|&r| fold(r))
        .sum::<u64>(),
    );
    counts.push(length);
    at += length;
  }
  let mut best: Option<Plan> = None;
  for p in (0..=finest).rev() {
    let mut params = Vec::new();
    let mut bits = 0;
    for (&sum, &count) in sums.iter().zip(&counts) {
      let (k, cost) = best_rice(sum, count);
      params.push(k);
      bits += u64::from(RICE_BITS) + cost;
    }
    if best.as_ref().is_none_or(|best| bits < best.bits) {
      best = Some(Plan {
        order: Some(order),
        partition_order: p,
        params,
        bits,
      });
    }
    sums = sums.chunks(2).map(|pair| pair.iter().sum()).collect();
    counts = counts.chunks(2).map(|pair| pair.iter().sum()).collect();
  }
  best.expect("a partitioning")
}

fn write_subframe(
  out: &mut BitWriter,
  x: &[i64],
  n: usize,
  bps: u32,
  plan: &Plan,
  scratch: &mut [i64],
) {
  let Some(order) = plan.order else {
    out.write(0, 8);
    out.write(x[0], bps);
    return;
  };
  out.write(0, 1);
  out.write(0b001000 | order as i64, 6);
  out.write(0, 1);
  for &sample in &x[..order] {
    out.write(sample, bps);
  }
  residual(x, n, order, scratch);
  out.write(1, 2);
  out.write(plan.partition_order as i64, 4);
  let parts = 1 << plan.partition_order;
  let size = n / parts;
  let mut at = 0;
  for (part, &k) in plan.params.iter().enumerate() {
    out.write(i64::from(k), RICE_BITS);
    let length = if part == 0 { size - order } else { size };
    for &r in &scratch[at..at + length] {
      let u = fold(r);
      out.unary(u >> k);
      if k > 0 {
        out.write((u & ((1 << k) - 1)) as i64, k);
      }
    }
    at += length;
  }
}

/// Frame numbers are written like UTF-8: a lead byte whose run of ones
/// counts the bytes, then six bits a continuation byte.
fn utf8_number(out: &mut BitWriter, value: u64) {
  if value < 0x80 {
    out.write(value as i64, 8);
    return;
  }
  let mut tail = Vec::new();
  let mut v = value;
  let mut room = 0x1f;
  let mut lead = 0xc0;
  loop {
    tail.insert(0, 0x80 | (v & 0x3f));
    v /= 64;
    if v <= room {
      break;
    }
    room >>= 1;
    lead = (lead >> 1) | 0x80;
  }
  out.write((lead | v) as i64, 8);
  for byte in tail {
    out.write(byte as i64, 8);
  }
}

/// Encodes 24-bit stereo FLAC from float samples handed over in any chunks.
/// Frames are taken as they're made (`take_frames`), so an hour-long mix
/// never sits in memory whole; `header` comes last, once the sample count
/// is known, and goes first in the file.
pub struct FlacEncoder {
  rate: u32,
  bps: u32,
  frames: Vec<Vec<u8>>,
  left: Vec<i64>,
  right: Vec<i64>,
  mid: Vec<i64>,
  side: Vec<i64>,
  scratch: Vec<i64>,
  filled: usize,
  frame_number: u64,
  samples: u64,
}

impl FlacEncoder {
  pub fn new(rate: u32) -> Self {
    Self {
      rate,
      bps: 24,
      frames: Vec::new(),
      left: vec![0; BLOCK],
      right: vec![0; BLOCK],
      mid: vec![0; BLOCK],
      side: vec![0; BLOCK],
      scratch: vec![0; BLOCK],
      filled: 0,
      frame_number: 0,
      samples: 0,
    }
  }

  pub fn push(&mut self, left: &[f32], right: &[f32]) {
    let scale = f64::from((1 << (self.bps - 1)) - 1);
    let quantize = |x: f32| super::js::round(f64::from(x).clamp(-1., 1.) * scale) as i64;
    for (&l, &r) in left.iter().zip(right) {
      self.left[self.filled] = quantize(l);
      self.right[self.filled] = quantize(r);
      self.filled += 1;
      if self.filled == BLOCK {
        self.flush();
      }
    }
  }

  /// The frames made since the last call.
  pub fn take_frames(&mut self) -> Vec<Vec<u8>> {
    std::mem::take(&mut self.frames)
  }

  /// Codes what is left, and returns the stream header, which goes before
  /// every frame.
  pub fn finish(&mut self) -> Vec<u8> {
    if self.filled > 0 {
      self.flush();
    }
    let mut header = BitWriter::default();
    for byte in *b"fLaC" {
      header.write(i64::from(byte), 8);
    }
    header.write(1, 1);
    header.write(0, 7);
    header.write(34, 24);
    header.write(BLOCK as i64, 16);
    header.write(BLOCK as i64, 16);
    header.write(0, 24);
    header.write(0, 24);
    header.write(i64::from(self.rate), 20);
    header.write(1, 3);
    header.write(i64::from(self.bps - 1), 5);
    header.write((self.samples >> 32) as i64, 4);
    header.write((self.samples & 0xffff_ffff) as i64, 32);
    for _ in 0..4 {
      header.write(0, 32);
    }
    header.bytes
  }

  fn flush(&mut self) {
    let n = self.filled;
    let bps = self.bps;
    for i in 0..n {
      self.mid[i] = (self.left[i] + self.right[i]) >> 1;
      self.side[i] = self.left[i] - self.right[i];
    }
    let l = plan(&self.left, n, bps, &mut self.scratch);
    let r = plan(&self.right, n, bps, &mut self.scratch);
    let m = plan(&self.mid, n, bps, &mut self.scratch);
    let s = plan(&self.side, n, bps + 1, &mut self.scratch);
    // Channel assignments: 1 independent, 8 left/side, 9 side/right, 10
    // mid/side; the first of the cheapest wins.
    let options = [
      (1, l.bits + r.bits),
      (8, l.bits + s.bits),
      (9, s.bits + r.bits),
      (10, m.bits + s.bits),
    ];
    let mut code = options[0];
    for option in &options[1..] {
      if option.1 < code.1 {
        code = *option;
      }
    }
    let code = code.0;

    let mut out = BitWriter::default();
    out.write(0b11_1111_1111_1110, 14);
    out.write(0, 1);
    out.write(0, 1);
    out.write(if n == BLOCK { 0b1100 } else { 0b0111 }, 4);
    out.write(0, 4);
    out.write(code, 4);
    out.write(0b110, 3);
    out.write(0, 1);
    utf8_number(&mut out, self.frame_number);
    self.frame_number += 1;
    if n != BLOCK {
      out.write(n as i64 - 1, 16);
    }
    let crc = crc8(&out.bytes);
    out.write(i64::from(crc), 8);

    let channels: [(&[i64], &Plan, u32); 2] = match code {
      1 => [(&self.left, &l, bps), (&self.right, &r, bps)],
      8 => [(&self.left, &l, bps), (&self.side, &s, bps + 1)],
      9 => [(&self.side, &s, bps + 1), (&self.right, &r, bps)],
      _ => [(&self.mid, &m, bps), (&self.side, &s, bps + 1)],
    };
    for (x, chosen, depth) in channels {
      write_subframe(&mut out, x, n, depth, chosen, &mut self.scratch);
    }
    out.align();
    let crc = crc16(&out.bytes);
    out.write(i64::from(crc), 16);
    self.frames.push(out.bytes);
    self.samples += n as u64;
    self.filled = 0;
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn crcs_match_flacs() {
    // The check values of CRC-8 (poly 7) and CRC-16/UMTS over "123456789".
    assert_eq!(crc8(b"123456789"), 0xf4);
    assert_eq!(crc16(b"123456789"), 0xfee8);
  }

  #[test]
  fn encodes_a_stream() {
    let mut encoder = FlacEncoder::new(48000);
    let left: Vec<f32> = (0..5000).map(|i| (i as f32 * 0.01).sin() * 0.5).collect();
    let right: Vec<f32> = left.iter().map(|x| -x).collect();
    encoder.push(&left, &right);
    let mut frames = encoder.take_frames();
    let header = encoder.finish();
    frames.extend(encoder.take_frames());
    assert_eq!(&header[..4], b"fLaC");
    assert_eq!(header.len(), 42);
    assert_eq!(frames.len(), 2);
    for frame in &frames {
      assert_eq!(frame[0], 0xff);
      assert_eq!(frame[1] & 0xfe, 0xf8);
      // Each frame ends in the CRC-16 of everything before it.
      let (body, crc) = frame.split_at(frame.len() - 2);
      assert_eq!(crc16(body).to_be_bytes(), [crc[0], crc[1]]);
    }
  }
}
