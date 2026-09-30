import { Engine, type Overrides } from "../engine/Engine";
import type { EngineEvent } from "../messages";

export interface RenderOptions {
  sampleRate: number;
  duration: number;
  overrides?: Overrides;
  blockSize?: number;
}

export interface RenderResult {
  left: Float32Array;
  right: Float32Array;
  engine: Engine;
}

// Renders an event list with the pure-TS engine (no Web Audio): the same code
// path the worklet runs, usable from Node and unit tests.
export function renderEngine(
  events: readonly EngineEvent[],
  { sampleRate, duration, overrides, blockSize = 128 }: RenderOptions,
): RenderResult {
  const engine = new Engine(sampleRate, overrides);
  for (const event of events) engine.schedule(event);
  const total = Math.round(duration * sampleRate);
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  for (let pos = 0; pos < total; pos += blockSize) {
    const end = Math.min(total, pos + blockSize);
    engine.render(left.subarray(pos, end), right.subarray(pos, end));
  }
  return { left, right, engine };
}
