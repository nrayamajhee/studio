// Drives the Device in a headless browser for the docs' screenshots: presses
// its pads and keys, turns its knobs, and shoots it, its screen, its pads or
// its keys with an even margin around them. Rings and badges are drawn on an
// overlay above the page, so the controls under them keep their own look.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "playwright";

export type Theme = "light" | "dark";

export type Box = { x: number; y: number; width: number; height: number };

// What a shot frames.
export type Frame = "device" | "screen" | "pads" | "keys";

export type Target = Locator | Box;

export type ShotOptions = {
  frame?: Frame;
  // The controls a step presses, ringed in orange.
  rings?: Target[];
  // Numbered or lettered badges: on a target's top-left corner, just inside
  // it (for a shot cropped to its edges), or in its middle.
  badges?: [
    target: Target,
    label: string,
    at?: "corner" | "inside" | "center",
  ][];
};

export type KnobSlot = "chalk" | "green" | "red" | "blue";

// The pads by their place in reading order, three rows of twelve.
export const PAD = {
  play: 0,
  stop: 1,
  record: 2,
  save: 3,
  albums: 4,
  synth: 5,
  adsr: 6,
  lfo: 7,
  fx: 8,
  chordPalette: 9,
  playStyle: 10,
  tempo: 11,
  clip: 12,
  mute: 13,
  up: 14,
  delete: 15,
  tracks: 16,
  roll: 17,
  shift: 24,
  left: 25,
  down: 26,
  right: 27,
  instruments: 28,
  drumGrid: 29,
} as const;

export const INSTRUMENT_PADS = [18, 19, 20, 30, 31, 32];
export const CHORD_PADS = [21, 22, 23, 33, 34, 35];

// Keys F3 to E5: the fourteen white keys come first, then the ten black.
export const C4 = 4;

// Around the Device, its sky; around the screen, the Device's face as far as
// its grilles. The pads and keys are cropped to their edges.
const MARGIN: Record<Frame, number> = {
  device: 40,
  screen: 40,
  pads: 0,
  keys: 0,
};

const RING = "#f5a524";

const isBox = (target: Target): target is Box => "width" in target;

export const union = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
};

export type Device = ReturnType<typeof driveDevice>;

export function driveDevice(
  page: Page,
  options: {
    url: string;
    out: string;
    theme: Theme;
    encode: (png: Buffer) => Promise<Buffer>;
  },
) {
  const frame = page.locator('[aria-label="Synthesizer"]');
  const screen = frame.locator('[class*="aspect-[var(--screen-aspect"]');
  const padGroup = frame.locator('[aria-label="Pads"]');
  const keyGroup = frame.locator('[aria-label="Piano keys"]');

  // Pads in reading order, 0–35; keys F3 to E5, the fourteen white ones
  // first, then the ten black.
  const pad = (index: number) => padGroup.locator("button").nth(index);
  const key = (index: number) => keyGroup.locator("button").nth(index);
  const knob = (slot: KnobSlot) =>
    frame.locator(`button[style*="--knob-color:var(--color-synth-${slot})"]`);
  const tile = (label: string) =>
    screen.locator(`button[aria-label="${label}"]`).first();

  const settle = (ms = 250) => page.waitForTimeout(ms);
  const park = () => page.mouse.move(1, 1);

  // The page without its theme toggle, which would sit in a shot's margin.
  const ready = async () => {
    await page.addStyleTag({
      content:
        'div:has(> button[aria-label^="Theme:"]) { display: none !important; }',
    });
    await settle(600);
  };
  const open = async () => {
    await page.goto(options.url, { waitUntil: "networkidle" });
    await ready();
  };
  // Back to the main screen, keeping what was saved.
  const reload = async () => {
    await page.reload({ waitUntil: "networkidle" });
    await ready();
  };

  const box = async (target: Target): Promise<Box> => {
    if (isBox(target)) return target;
    const found = await target.boundingBox();
    if (!found) throw new Error(`Nothing on screen for ${target}`);
    return found;
  };

  const press = async (index: number, { shift = false } = {}) => {
    if (shift) await page.keyboard.down("Shift");
    await pad(index).click();
    if (shift) await page.keyboard.up("Shift");
    await park();
    await settle();
  };

  const tap = async (keyName: string, { shift = false } = {}) => {
    await page.keyboard.press(shift ? `Shift+${keyName}` : keyName);
    await settle();
  };

  // Turns a knob a notch at a time until its label matches, or by a number
  // of notches (up is positive).
  const turn = async (
    slot: KnobSlot,
    until: number | RegExp,
    direction = 1,
  ) => {
    const target = knob(slot);
    const { x, y, width, height } = await box(target);
    await page.mouse.move(x + width / 2, y + height / 2);
    for (let i = 0; i < 200; i++) {
      if (
        typeof until === "number"
          ? i >= Math.abs(until)
          : until.test((await target.getAttribute("aria-label")) ?? "")
      )
        break;
      const up = typeof until === "number" ? Math.sign(until) : direction;
      await page.mouse.wheel(0, -50 * up);
      await page.waitForTimeout(40);
    }
    await park();
    await settle();
  };

  const screenText = async () =>
    (await screen.innerText()).replace(/\s+/g, " ");

  // Presses an arrow until the screen reads `text`, for pagers and tempo,
  // and says how many presses it took. A pager shows the pages either side,
  // so match a tile only the wanted page has.
  const arrowUntil = async (keyName: string, text: RegExp, limit = 80) => {
    let presses = 0;
    while (presses < limit && !text.test(await screenText())) {
      await tap(keyName);
      presses++;
    }
    if (!text.test(await screenText()))
      throw new Error(`The screen never read ${text}: ${await screenText()}`);
    return presses;
  };
  // The page a pager is on.
  const currentPage = async () =>
    (
      await screen.locator('span[aria-live="polite"]').first().innerText()
    ).trim();

  // Steps the playing instrument with Shift + → until the main screen names
  // it (the library only previews a sound until it's bound to a pad).
  const pickInstrument = async (name: string) => {
    const playing = new RegExp(`\\b${name} ·`);
    for (let i = 0; i < 60 && !playing.test(await screenText()); i++)
      await tap("ArrowRight", { shift: true });
    if (!playing.test(await screenText()))
      throw new Error(`Never reached ${name}: ${await screenText()}`);
  };

  // Steps the Synth parameters view to a page by name, from its first: the
  // view opens on the page it was left on, and its pager doesn't wrap.
  const synthPage = async (name: string) => {
    for (let i = 0; i < 16 && (await currentPage()) !== "Chain"; i++)
      await tap("ArrowLeft");
    for (let i = 0; i < 16; i++) {
      if ((await currentPage()).toLowerCase() === name.toLowerCase()) return;
      await tap("ArrowRight");
    }
    throw new Error(`No ${name} page: ${await screenText()}`);
  };

  const taps = async (keyName: string, count: number) => {
    for (let i = 0; i < count; i++) await tap(keyName);
  };

  const frameBox = async (kind: Frame) => {
    const target = { device: frame, screen, pads: padGroup, keys: keyGroup }[
      kind
    ];
    const found = await box(target);
    const margin = MARGIN[kind];
    return {
      x: found.x - margin,
      y: found.y - margin,
      width: found.width + 2 * margin,
      height: found.height + 2 * margin,
    };
  };

  const overlay = async (rings: Box[], badges: [Box, string, string][]) =>
    page.evaluate(
      ({ rings, badges, color }) => {
        const layer = document.createElement("div");
        layer.id = "docs-shot-overlay";
        layer.style.cssText =
          "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
        for (const r of rings) {
          const ring = document.createElement("div");
          ring.style.cssText = `position:absolute;left:${r.x - 5}px;top:${r.y - 5}px;width:${r.width + 10}px;height:${r.height + 10}px;border:3px solid ${color};border-radius:14px;box-sizing:border-box`;
          layer.append(ring);
        }
        for (const [b, label, at] of badges) {
          const badge = document.createElement("div");
          const offset = at === "inside" ? 17 : 4;
          const cx = at === "center" ? b.x + b.width / 2 : b.x + offset;
          const cy = at === "center" ? b.y + b.height / 2 : b.y + offset;
          badge.textContent = label;
          badge.style.cssText = `position:absolute;left:${cx - 13}px;top:${cy - 13}px;min-width:26px;height:26px;padding:0 6px;box-sizing:border-box;border-radius:13px;background:${color};color:#1a1a1a;font:700 14px/26px ui-sans-serif,system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff8`;
          layer.append(badge);
        }
        document.body.append(layer);
      },
      { rings, badges, color: RING },
    );

  const shot = async (name: string, shotOptions: ShotOptions = {}) => {
    const { frame: kind = "device", rings = [], badges = [] } = shotOptions;
    await park();
    const ringBoxes = await Promise.all(rings.map(box));
    const badgeBoxes = await Promise.all(
      badges.map(
        async ([target, label, at = "corner"]) =>
          [await box(target), label, at] as [Box, string, string],
      ),
    );
    if (ringBoxes.length || badgeBoxes.length)
      await overlay(ringBoxes, badgeBoxes);
    const clip = await frameBox(kind);
    const png = await page.screenshot({ clip, animations: "allow" });
    await page.evaluate(() =>
      document.getElementById("docs-shot-overlay")?.remove(),
    );
    mkdirSync(options.out, { recursive: true });
    const file = join(
      options.out,
      `${name}${options.theme === "dark" ? ".dark" : ""}.webp`,
    );
    writeFileSync(file, await options.encode(png));
    console.log(`${name}: ${await screenText()}`);
  };

  return {
    open,
    reload,
    page,
    frame,
    screen,
    pad,
    key,
    knob,
    tile,
    box,
    press,
    tap,
    turn,
    screenText,
    arrowUntil,
    taps,
    pickInstrument,
    synthPage,
    shot,
    settle,
  };
}
