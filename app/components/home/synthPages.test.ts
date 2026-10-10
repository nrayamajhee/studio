import { describe, expect, it } from "vitest";
import { PATCHES } from "../../lib/physical/patches";
import { previewPage } from "./synthGraphs";
import { synthPages } from "./synthPages";

const SHARED = ["filter", "body", "output", "envelope", "lfo"];

describe("Synth pages", () => {
  it("put every param on one knob of its module's page", () => {
    for (const patch of PATCHES) {
      const pages = synthPages(patch.params);
      const placed = pages.flatMap((page) =>
        [...page.main, ...page.shift].flatMap((spec) => {
          if (spec)
            expect(spec.section, `${patch.id} ${spec.id}`).toBe(page.id);
          return spec ? [spec.id] : [];
        }),
      );
      expect(placed.sort(), patch.id).toEqual(
        patch.params.map(({ id }) => id).sort(),
      );
    }
  });

  it("keep a shared module's params on the same knob everywhere", () => {
    const slots = new Map<string, number>();
    for (const patch of PATCHES) {
      for (const page of synthPages(patch.params)) {
        if (!SHARED.includes(page.id)) continue;
        page.main.forEach((spec, slot) => {
          if (!spec) return;
          expect(slots.get(spec.id) ?? slot, `${patch.id} ${spec.id}`).toBe(
            slot,
          );
          slots.set(spec.id, slot);
        });
      }
    }
  });

  it("draw every page of every instrument", () => {
    for (const patch of PATCHES) {
      for (const page of synthPages(patch.params)) {
        const { scene } = previewPage(patch, page.id);
        const name = `${patch.id} ${page.id}`;
        expect(scene.paths.length, name).toBeGreaterThan(0);
        for (const path of scene.paths)
          expect(path.d, name).not.toMatch(/NaN|Infinity/);
        for (const label of scene.labels) {
          expect(Number.isFinite(label.x + label.y), name).toBe(true);
          expect(label.text, name).not.toMatch(/NaN|Infinity|undefined/);
        }
      }
    }
  });
});
