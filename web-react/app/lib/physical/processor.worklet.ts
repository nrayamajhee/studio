import { Engine } from "./engine/Engine";
import type { EngineEvent, ProcessorOptions, WorkletMessage } from "./messages";

// Worklet-scope globals are not in lib.dom; these module-scoped declarations
// resolve to the real globals at runtime without leaking into main-thread types.
declare const sampleRate: number;
declare const currentFrame: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
}
declare function registerProcessor(
  name: string,
  ctor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;

const STATS_SECONDS = 0.25;

class PhysicalSynthProcessor extends AudioWorkletProcessor {
  private readonly engine: Engine;
  private readonly statsEvery: number;
  private readonly clock: (() => number) | null;
  private blocks = 0;
  private busy = 0;
  private rendered = 0;

  constructor(options?: AudioWorkletNodeOptions) {
    super(options);
    const initial = (options?.processorOptions ?? {}) as ProcessorOptions;
    this.engine = new Engine(sampleRate, initial.overrides);
    initial.events?.forEach((event) => this.engine.schedule(event));
    this.port.onmessage = (message: MessageEvent<EngineEvent[]>) => {
      for (const event of message.data) this.engine.schedule(event);
    };
    this.statsEvery = Math.max(
      1,
      Math.round((STATS_SECONDS * sampleRate) / 128),
    );
    const perf = (globalThis as { performance?: { now(): number } })
      .performance;
    this.clock = perf ? () => perf.now() : null;
    this.post({ type: "ready", sampleRate });
  }

  private post(message: WorkletMessage) {
    this.port.postMessage(message);
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] ?? output[0];
    const started = this.clock ? this.clock() : 0;
    // Event times are AudioContext seconds, so keep the engine's frame counter
    // on the context clock even if the node was created mid-stream.
    this.engine.frame = currentFrame;
    this.engine.render(left, right);
    if (this.clock) {
      this.busy += this.clock() - started;
      this.rendered += left.length;
    }
    if (++this.blocks % this.statsEvery === 0) {
      const { activeVoices, reverbAwake } = this.engine.stats();
      const load = this.clock
        ? this.busy / ((this.rendered / sampleRate) * 1000)
        : undefined;
      this.busy = 0;
      this.rendered = 0;
      this.post({ type: "stats", activeVoices, reverbAwake, load });
      for (const message of this.engine.drainWarnings()) {
        this.post({ type: "warning", message });
      }
    }
    return true;
  }
}

registerProcessor("physical-synth", PhysicalSynthProcessor);
