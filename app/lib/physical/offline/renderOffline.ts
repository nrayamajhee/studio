import type {
  EngineStats,
  ProcessorOptions,
  WorkletMessage,
} from "../messages";
import type { Renderer } from "./diagnostics";

// Renders an event list through an OfflineAudioContext with the real worklet,
// so diagnostics exercise exactly what ships. Browser only.
export const workletRenderer: Renderer = async (
  events,
  sampleRate,
  duration,
  overrides,
) => {
  const length = Math.round(duration * sampleRate);
  const ctx = new OfflineAudioContext({
    numberOfChannels: 2,
    length,
    sampleRate,
  });
  const { default: url } = await import("../processor.worklet.ts?worker&url");
  await ctx.audioWorklet.addModule(url);
  const processorOptions: ProcessorOptions = { events, overrides };
  const node = new AudioWorkletNode(ctx, "physical-synth", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions,
  });
  let stats: EngineStats = { activeVoices: -1, reverbAwake: true };
  node.port.onmessage = (message: MessageEvent<WorkletMessage>) => {
    if (message.data.type === "stats") stats = message.data;
  };
  node.connect(ctx.destination);
  const buffer = await ctx.startRendering();
  // Let the last stats message posted during rendering arrive.
  await new Promise((resolve) => setTimeout(resolve, 20));
  node.port.close();
  return {
    left: buffer.getChannelData(0),
    right: buffer.getChannelData(1),
    activeVoices: stats.activeVoices,
    reverbAwake: stats.reverbAwake,
  };
};
