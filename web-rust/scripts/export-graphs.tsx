// Writes web-rust/tests/graphs.json: the synth view's graph of every page of
// every instrument, as web-react's `synthGraphs.ts` draws it at the params'
// defaults and at two other knob steps, which `cargo test` checks the Rust
// port against (src/logic/synth_graphs.rs). Run from web-react after
// changing either:
//   npx tsx ../web-rust/scripts/export-graphs.tsx
import { writeFileSync } from "node:fs";
import { PATCH_BY_ID } from "../../web-react/app/lib/physical/patches";
import { stepToValue } from "../../web-react/app/lib/physical/patches/format";
import { KNOB_STEPS } from "../../web-react/app/components/home/deviceEngine";
import {
  KNOB_TONES,
  graphNote,
  pageScene,
  type Tone,
} from "../../web-react/app/components/home/synthGraphs";
import { synthPages } from "../../web-react/app/components/home/synthPages";

// Each variant sets every param to a knob step (none: its default).
const VARIANTS = [null, 7, 2] as const;

const graphs = Object.values(PATCH_BY_ID).flatMap((patch) => {
  const pages = synthPages(patch.params, patch.family);
  return VARIANTS.flatMap((step, variant) => {
    const values = Object.fromEntries(
      patch.params.map((spec) => {
        const steps = spec.options?.length ?? KNOB_STEPS;
        return [
          spec.id,
          step === null
            ? spec.default
            : stepToValue(spec, Math.min(step, steps - 1), steps),
        ];
      }),
    );
    return pages.map((page) => {
      const toneOf = (id: string): Tone => {
        const main = page.main.findIndex((spec) => spec?.id === id);
        if (main >= 0) return KNOB_TONES[main];
        const extra = page.shift.findIndex((spec) => spec?.id === id);
        return extra >= 0 ? KNOB_TONES[extra] : "dim";
      };
      const picked = pages[1 + (variant % (pages.length - 1))].id;
      const scene = pageScene(
        page,
        { patch, values, note: graphNote(patch), toneOf },
        pages,
        picked,
        "Exciter",
      );
      return {
        patch: patch.id,
        page: page.id,
        variant,
        paths: scene.paths.map(({ d, tone, width, dashed, fill, solid }) => [
          d,
          tone,
          width ?? null,
          dashed ?? false,
          fill ?? false,
          solid ?? false,
        ]),
        labels: scene.labels.map(({ x, y, text, tone, align, anchor }) => [
          x,
          y,
          text,
          tone,
          align,
          anchor,
        ]),
      };
    });
  });
});

writeFileSync(
  new URL("../tests/graphs.json", import.meta.url),
  JSON.stringify(graphs),
);
