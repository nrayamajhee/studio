// docs/synth: the screen's Synth parameters pages for each instrument model,
// and the master ADSR, LFO and FX.
import { PAD, type Device } from "./device";

// Each picture, the sound it shows and its page, a sound's pages together.
const PAGES: [name: string, instrument: string, page: string][] = [
  ["screen-chain-flute", "Flute", "Chain"],
  ["screen-exciter-flute", "Flute", "Exciter"],
  ["screen-exciter-piano", "Grand piano", "Exciter"],
  ["screen-resonator-piano", "Grand piano", "Resonator"],
  ["screen-damper-piano", "Grand piano", "Damper"],
  ["screen-filter-piano", "Grand piano", "Filter"],
  ["screen-vibrato-piano", "Grand piano", "Vibrato"],
  ["screen-body-piano", "Grand piano", "Body"],
  ["screen-output-electric", "Picked electric", "Output"],
  ["screen-exciter-violin", "Violin", "Exciter"],
  ["screen-exciter-drums", "Drum kit", "Exciter"],
  ["screen-resonator-kick", "Drum kit", "Resonator"],
  ["screen-exciter-harmonium", "Harmonium", "Exciter"],
  ["screen-resonator-harmonium", "Harmonium", "Resonator"],
  ["screen-resonator-xylophone", "Xylophone", "Resonator"],
  ["screen-exciter-oscillator", "Oscillator", "Exciter"],
];

export default async function synthEngine(d: Device) {
  const { press, shot } = d;

  for (const [view, name] of [
    [PAD.adsr, "screen-adsr"],
    [PAD.lfo, "screen-lfo"],
    [PAD.fx, "screen-fx"],
  ] as const) {
    await press(view);
    await shot(name, { frame: "screen" });
    await press(view);
  }

  let current = "Grand piano";
  for (const [name, instrument, synthPage] of PAGES) {
    if (instrument !== current) {
      await d.pickInstrument(instrument);
      current = instrument;
    }
    await press(PAD.synth);
    await d.synthPage(synthPage);
    await shot(name, { frame: "screen" });
    await press(PAD.synth);
  }
}
