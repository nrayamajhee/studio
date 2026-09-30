export const TWO_PI = 2 * Math.PI;

// ln(1000): an exponential decays by 60 dB after T60 when r^n = e^(-6.9078 n / (T60·fs)).
export const LN_1000 = 6.907755278982137;

// Piecewise-linear table over MIDI note number, clamped at both ends.
export type KeyTable = readonly (readonly [note: number, value: number])[];

export const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

export const dbToGain = (db: number) => 10 ** (db / 20);

export const gainToDb = (gain: number) =>
  20 * Math.log10(Math.max(Math.abs(gain), 1e-12));

export const cents = (measured: number, target: number) =>
  1200 * Math.log2(measured / target);

export const clamp = (x: number, lo: number, hi: number) =>
  x < lo ? lo : x > hi ? hi : x;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function nextPow2(n: number) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function isPrime(n: number) {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false;
  return true;
}

export function nextPrime(n: number) {
  let candidate = Math.max(2, Math.ceil(n));
  while (!isPrime(candidate)) candidate++;
  return candidate;
}

export function keyTable(table: KeyTable, note: number) {
  if (note <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (note >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [n1, v1] = table[i];
    if (note <= n1) {
      const [n0, v0] = table[i - 1];
      return v0 + ((v1 - v0) * (note - n0)) / (n1 - n0);
    }
  }
  return last[1];
}

// Folds a note into [low, high] by whole octaves.
export function foldNote(note: number, low: number, high: number) {
  let folded = note;
  while (folded < low) folded += 12;
  while (folded > high) folded -= 12;
  return folded < low ? low : folded;
}

// Equal-power pan law for pan ∈ [-1, 1].
export function panGains(pan: number, out: Float64Array) {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  out[0] = Math.cos(angle);
  out[1] = Math.sin(angle);
}
