import type { ParamSpec } from "../patches/types";

export class ParamSet {
  readonly specs: readonly ParamSpec[];
  private readonly values: Record<string, number> = {};

  constructor(specs: readonly ParamSpec[], overrides?: Record<string, number>) {
    this.specs = specs;
    for (const spec of specs) this.values[spec.id] = spec.default;
    if (overrides) {
      for (const [id, value] of Object.entries(overrides)) this.set(id, value);
    }
  }

  has(id: string) {
    return id in this.values;
  }

  get(id: string) {
    return this.values[id] ?? 0;
  }

  set(id: string, value: number) {
    const spec = this.specs.find((candidate) => candidate.id === id);
    if (!spec || !Number.isFinite(value)) return false;
    this.values[id] = Math.min(spec.max, Math.max(spec.min, value));
    return true;
  }

  snapshot() {
    return { ...this.values };
  }
}
