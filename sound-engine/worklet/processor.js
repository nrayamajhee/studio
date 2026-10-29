// The Device's audio thread: the Rust engine (sound-engine, built by
// build.sh as sound-worklet.wasm) in an AudioWorkletProcessor, run as
// web-react runs its TypeScript engine in processor.worklet.ts. The host
// passes the module's bytes in processorOptions and sends events as JSON
// text; the processor posts "ready", then stats and warnings.

const STATS_SECONDS = 0.25;

// A worklet has no TextEncoder or TextDecoder; events and warnings are
// ASCII.
function writeText(wasm, engine, text) {
  const pointer = wasm.worklet_text(engine, text.length);
  const bytes = new Uint8Array(wasm.memory.buffer, pointer, text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
}

function readText(wasm, engine, length) {
  const pointer = wasm.worklet_text(engine, length);
  const bytes = new Uint8Array(wasm.memory.buffer, pointer, length);
  let text = "";
  for (let i = 0; i < length; i++) text += String.fromCharCode(bytes[i]);
  return text;
}

class SoundWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    const { bytes, overrides, events } = options.processorOptions;
    const module = new WebAssembly.Module(bytes);
    this.wasm = new WebAssembly.Instance(module, {}).exports;
    this.engine = this.wasm.worklet_new(sampleRate);
    // An offline render starts at a track's params, its events all queued.
    if (overrides) {
      writeText(this.wasm, this.engine, overrides);
      this.wasm.worklet_overrides(this.engine);
    }
    if (events) {
      writeText(this.wasm, this.engine, events);
      this.wasm.worklet_schedule(this.engine);
    }
    this.port.onmessage = (message) => {
      writeText(this.wasm, this.engine, message.data);
      this.wasm.worklet_schedule(this.engine);
    };
    this.statsEvery = Math.max(
      1,
      Math.round((STATS_SECONDS * sampleRate) / 128),
    );
    this.blocks = 0;
    this.busy = 0;
    this.rendered = 0;
    this.port.postMessage({ type: "ready", sampleRate });
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] ?? output[0];
    const frames = left.length;
    const started = globalThis.performance?.now() ?? 0;
    const { wasm, engine } = this;
    wasm.worklet_render(engine, currentFrame, frames);
    // Views are made each block: memory growth detaches the old buffer.
    const memory = wasm.memory.buffer;
    left.set(new Float32Array(memory, wasm.worklet_left(engine), frames));
    right.set(new Float32Array(memory, wasm.worklet_right(engine), frames));
    if (globalThis.performance) {
      this.busy += performance.now() - started;
      this.rendered += frames;
    }
    if (++this.blocks % this.statsEvery === 0) {
      const load = globalThis.performance
        ? this.busy / ((this.rendered / sampleRate) * 1000)
        : undefined;
      this.busy = 0;
      this.rendered = 0;
      this.port.postMessage({
        type: "stats",
        activeVoices: wasm.worklet_active_voices(engine),
        reverbAwake: wasm.worklet_reverb_awake(engine) === 1,
        load,
      });
      const length = wasm.worklet_warnings(engine);
      if (length > 0) {
        for (const message of readText(wasm, engine, length).split("\n")) {
          this.port.postMessage({ type: "warning", message });
        }
      }
    }
    return true;
  }
}

registerProcessor("sound-worklet", SoundWorklet);
