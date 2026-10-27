// Phase delay (samples) and magnitude helpers used to tune delay loops.

// One-pole lowpass y = (1 − p)·x + p·y₁.
export const onePolePhaseDelay = (p: number, w: number) =>
  Math.atan2(p * Math.sin(w), 1 - p * Math.cos(w)) / w;

export const onePoleMagnitude = (p: number, w: number) =>
  (1 - p) / Math.sqrt(1 - 2 * p * Math.cos(w) + p * p);

// First-order allpass A(z) = (a + z⁻¹)/(1 + a·z⁻¹); a = 0 gives exactly 1.
export const allpass1PhaseDelay = (a: number, w: number) =>
  -(
    Math.atan2(-Math.sin(w), a + Math.cos(w)) -
    Math.atan2(-a * Math.sin(w), 1 + a * Math.cos(w))
  ) / w;

// Coefficient of a first-order allpass whose phase delay at w equals `delay`
// (∈ [0.5, 1.5)). Solved by bisection because Thiran's closed form is only
// exact at DC, which detunes high notes by several cents.
export function allpass1ForDelay(delay: number, w: number) {
  let lo = -0.999;
  let hi = 0.999;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    // Phase delay falls as the coefficient rises.
    if (allpass1PhaseDelay(mid, w) > delay) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}
