// Tables ported from STK (The Synthesis ToolKit, Perry Cook & Gary Scavone,
// MIT-style license): JetTable, ReedTable and BowTable.

export const jetTable = (x: number) => {
  const y = x * (x * x - 1);
  return y > 1 ? 1 : y < -1 ? -1 : y;
};

export const reedTable = (x: number, offset: number, slope: number) => {
  const y = offset + slope * x;
  return y > 1 ? 1 : y < -1 ? -1 : y;
};

// Friction curve of a bow against a string: (|slope·(x + offset)| + 0.75)^−4,
// clamped to [0.01, 0.98].
export const bowTable = (x: number, offset: number, slope: number) => {
  const y = (Math.abs((x + offset) * slope) + 0.75) ** -4;
  return y < 0.01 ? 0.01 : y > 0.98 ? 0.98 : y;
};

// Cubic soft clipper: x·(27 + x²)/(27 + 9x²) for |x| < 3, else ±1.
export const softClip = (x: number) => {
  if (x <= -3) return -1;
  if (x >= 3) return 1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
};
