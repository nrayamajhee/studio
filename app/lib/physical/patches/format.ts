import type { ParamSpec } from "./types";

const position = (spec: ParamSpec, value: number) =>
  spec.scale === "log" && spec.min > 0
    ? Math.log(value / spec.min) / Math.log(spec.max / spec.min)
    : (value - spec.min) / (spec.max - spec.min);

// Maps t ∈ [0, 1] across the param's range, geometrically for log params.
export function fromUnit(spec: ParamSpec, t: number) {
  return spec.scale === "log" && spec.min > 0
    ? spec.min * (spec.max / spec.min) ** t
    : spec.min + (spec.max - spec.min) * t;
}

export function toUnit(spec: ParamSpec, value: number) {
  return Math.min(1, Math.max(0, position(spec, value)));
}

export const stepToValue = (spec: ParamSpec, step: number, steps: number) =>
  fromUnit(spec, step / (steps - 1));

export const valueToStep = (spec: ParamSpec, value: number, steps: number) =>
  Math.round(toUnit(spec, value) * (steps - 1));

export function formatParam(spec: ParamSpec, value: number) {
  switch (spec.unit) {
    case "Hz":
      return value >= 1000
        ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} kHz`
        : `${Math.round(value)} Hz`;
    case "s":
      return value < 1
        ? `${Math.round(value * 1000)} ms`
        : `${value.toFixed(2)} s`;
    case "ms":
      return `${Math.round(value)} ms`;
    case "×":
      return `${value.toFixed(2)}×`;
    case "st":
      return `${value > 0 ? "+" : ""}${value.toFixed(1)} st`;
    case "cents":
      return `${value.toFixed(1)} ¢`;
    case "dB":
      return `${value.toFixed(1)} dB`;
    default:
      return `${Math.round(100 * toUnit(spec, value))}%`;
  }
}
