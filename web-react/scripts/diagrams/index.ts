// Draws every docs diagram to public/docs/<folder>/diagram-<name>.svg, with a
// .dark.svg twin for the dark theme. Run with `npm run diagrams`.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PALETTES, render, type Diagram } from "./draw";
import bowed from "./synth-engine/bowed";
import drums from "./synth-engine/drums";
import freeReed from "./synth-engine/free-reed";
import jawari from "./synth-engine/jawari";
import keyToSound from "./synth-engine/key-to-sound";
import overview from "./synth-engine/overview";
import renderLoop from "./synth-engine/render-loop";
import reverb from "./synth-engine/reverb";
import signalFlow from "./synth-engine/signal-flow";
import stringLoop from "./synth-engine/string-loop";
import stringVoice from "./synth-engine/string-voice";
import threads from "./synth-engine/threads";
import voiceChain from "./synth-engine/voice-chain";
import voiceLifecycle from "./synth-engine/voice-lifecycle";
import winds from "./synth-engine/winds";

const FOLDERS: Record<string, Diagram[]> = {
  "synth-engine": [
    overview,
    threads,
    renderLoop,
    signalFlow,
    voiceLifecycle,
    voiceChain,
    stringLoop,
    stringVoice,
    jawari,
    winds,
    bowed,
    drums,
    freeReed,
    reverb,
    keyToSound,
  ],
};

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

for (const [folder, diagrams] of Object.entries(FOLDERS)) {
  const out = join(root, "public/docs", folder);
  mkdirSync(out, { recursive: true });
  for (const diagram of diagrams) {
    const base = join(out, `diagram-${diagram.name}`);
    writeFileSync(`${base}.svg`, render(diagram, PALETTES.light));
    writeFileSync(`${base}.dark.svg`, render(diagram, PALETTES.dark));
    console.log(`public/docs/${folder}/diagram-${diagram.name}.svg`);
  }
}
