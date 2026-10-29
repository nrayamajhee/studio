// Plays the same steps in web-react and web-rust, side by side, and compares
// what each shows after every step: the pads, knobs and keys (labels, state,
// colours), the screen's text, tiles, graph, drum grid and track rows (laid
// out, to the pixel), the MIDI panel, and localStorage. Each steps file
// starts on freshly loaded pages, and each step is taken in both at once.
// React's dev build is slower over a key, so what times out (a notice) may
// end in one a moment before the other: a step that differs is compared
// again, up to twice, 250 ms apart, and counts only if it still differs. A
// step's `skip` lists parts of the snapshot not to compare after it, for
// what keeps moving with time (a playing head, which React starts later).
//   node web-rust/scripts/parity/parity.cjs <steps.json>... [--verbose] [--fake-midi[=<name>]]
const { readFileSync } = require("node:fs");
const { APPS, act, fakeMidi, launch, open } = require("./common.cjs");

function snapshot(page) {
  return page.evaluate(async () => {
    // Colours read once their transitions end, which headless Chrome runs
    // late and unevenly.
    const transitions = document
      .getAnimations()
      .filter((animation) => animation instanceof CSSTransition);
    await Promise.race([
      Promise.allSettled(transitions.map((animation) => animation.finished)),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    const look = (el) => {
      const s = getComputedStyle(el);
      return `${s.backgroundColor} ${s.color}`;
    };
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}`;
    };
    const markup = (el) =>
      (el?.innerHTML ?? "")
        .replace(/ class="[^"]*"/g, "")
        .replace(/ aria-hidden="true"/g, "");
    const text = (el) => el.innerText.replace(/\s+/g, " ").trim();
    const device = document.querySelector("[aria-label=Synthesizer]");
    const glass = device.querySelector(".bg-screen > div");
    const pads = [...device.querySelectorAll("[aria-label=Pads] button")].map(
      (b) => ({
        label: b.getAttribute("aria-label"),
        title: b.getAttribute("title"),
        pressed: b.getAttribute("aria-pressed"),
        keys: b.getAttribute("aria-keyshortcuts"),
        look: look(b),
        led: (() => {
          const led = b.querySelector("span.absolute");
          return led ? look(led) : null;
        })(),
        face: markup(b.querySelector("span[aria-hidden=true]:last-child")),
      }),
    );
    const knobs = [...device.querySelectorAll("button.cursor-ew-resize")].map(
      (b) => ({
        label: b.getAttribute("aria-label"),
        transform: b.firstElementChild?.style.transform,
      }),
    );
    const keys = [
      ...device.querySelectorAll("[aria-label='Piano keys'] button"),
    ].map((b) => ({
      label: b.getAttribute("aria-label"),
      look: look(b),
      face: b.querySelector("span span")?.innerText,
    }));
    const group = glass.querySelector(":scope [role=group]");
    const grid = group
      ? `${group.getAttribute("aria-label")} ${box(group)}`
      : null;
    const tiles = [...glass.querySelectorAll(":scope [role=group] button")].map(
      (b) => ({
        label: b.getAttribute("aria-label"),
        pressed: b.getAttribute("aria-pressed"),
        look: `${look(b)} ${getComputedStyle(b).borderColor} ${box(b)}`,
        text: text(b),
        icon: markup(b.firstElementChild),
      }),
    );
    // A graph's paths and labels as drawn.
    const graph = [...glass.querySelectorAll(":scope svg path")].map((p) => {
      const s = getComputedStyle(p);
      return `${p.getAttribute("d")} ${s.stroke} ${s.fill} ${s.strokeWidth} ${s.strokeDasharray}`;
    });
    // Positioned by style (a graph's labels): compared where they're drawn,
    // since the two write the same style out differently.
    const labels = [
      ...glass.querySelectorAll(":scope span[style]:not([style=''])"),
    ].map((s) => `${s.innerText} ${box(s)} ${getComputedStyle(s).color}`);
    const cells = [
      ...glass.querySelectorAll(":scope [aria-label='Drum grid'] > div"),
    ].map(
      (row) =>
        [...row.children]
          .map(
            (c) =>
              getComputedStyle(c, "::before").backgroundColor +
              (getComputedStyle(c).boxShadow === "none" ? "" : "|"),
          )
          .join(" ") + ` ${row.firstElementChild.title}`,
    );
    const head =
      glass
        .querySelector(":scope [aria-label='Drum grid']")
        ?.style.getPropertyValue("--head") ?? null;
    const tracks = [
      ...glass.querySelectorAll(":scope [aria-label='Tracks'] > button"),
    ].map(
      (b) =>
        `${b.getAttribute("aria-label")} pressed=${b.getAttribute("aria-pressed")} ${text(b)} | ` +
        [...b.querySelectorAll("span")]
          .map(
            (s) =>
              `${box(s)} ${getComputedStyle(s).backgroundColor} ${getComputedStyle(s).opacity}`,
          )
          .join(";"),
    );
    const aside = document.querySelector("aside[aria-label=MIDI]");
    const midi = aside
      ? `${text(aside)} | ` +
        [...aside.querySelectorAll("button")]
          .map(
            (b) =>
              `${b.getAttribute("aria-label") ?? b.innerText}:${b.getAttribute("aria-pressed") ?? b.getAttribute("aria-checked") ?? ""}:${b.disabled}:${getComputedStyle(b).backgroundColor}`,
          )
          .join(";")
      : null;
    const corner = [...document.querySelectorAll("button[aria-expanded]")]
      .map(
        (b) =>
          `${b.getAttribute("aria-label")}=${b.getAttribute("aria-expanded")}`,
      )
      .join(";");
    const screen = text(glass);
    const storage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("studio.") || key === "theme")
        storage[key] = localStorage.getItem(key);
    }
    return {
      pads,
      knobs,
      keys,
      screen,
      grid,
      tiles,
      graph,
      labels,
      cells,
      head,
      tracks,
      midi,
      corner,
      storage,
    };
  });
}

// Where two snapshots differ, by path; stored JSON is compared parsed, so
// the order its keys are written in doesn't count.
function diff(a, b, path, out) {
  const json = (s) => typeof s === "string" && /^[[{]/.test(s);
  if (json(a) && json(b)) {
    try {
      return diff(JSON.parse(a), JSON.parse(b), path, out);
    } catch {
      // Not JSON after all: compared as text below.
    }
  }
  const leaf = (v) => v === null || typeof v !== "object";
  if (
    leaf(a) ||
    leaf(b) ||
    typeof a !== typeof b ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    if (JSON.stringify(a) !== JSON.stringify(b))
      out.push(
        `${path}: react ${JSON.stringify(a)} | rust ${JSON.stringify(b)}`,
      );
    return;
  }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
    diff(a[key], b[key], `${path}.${key}`, out);
}

// Ids made from the time something was made (`tape-mvt026a5`), numbered
// in the order each app makes them, the same in both when they match.
function numberIds() {
  const ids = new Map();
  return (text) =>
    text.replace(/\b(tape|track|user|style)-[0-9a-z]{8}\b/g, (id, kind) => {
      if (!ids.has(id)) ids.set(id, `${kind}-#${ids.size + 1}`);
      return ids.get(id);
    });
}

async function run(browser, file, { verbose, midi }) {
  const steps = JSON.parse(readFileSync(file, "utf8"));
  const apps = Object.entries(APPS);
  const pages = await Promise.all(
    apps.map(([, url]) => open(browser, url, { midi })),
  );
  const ids = apps.map(numberIds);
  const compare = async (step) => {
    const snaps = Object.fromEntries(
      await Promise.all(
        pages.map(async (page, n) => {
          const snap = await snapshot(page);
          for (const [key, value] of Object.entries(snap.storage))
            snap.storage[key] = ids[n](value);
          return [apps[n][0], snap];
        }),
      ),
    );
    for (const part of step.skip ?? [])
      for (const snap of Object.values(snaps)) delete snap[part];
    const out = [];
    diff(snaps.react, snaps.rust, "", out);
    return { snaps, out };
  };
  let failures = 0;
  for (const [i, step] of [{ note: "load" }, ...steps].entries()) {
    // Both at once, so what times out has run as long in each when they're
    // compared.
    await Promise.all(pages.map((page) => act(page, step)));
    let { snaps, out } = await compare(step);
    for (let again = 0; again < 2 && out.length > 0; again++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      ({ snaps, out } = await compare(step));
    }
    const name = step.note ?? JSON.stringify(step);
    if (out.length === 0) {
      if (verbose) console.log(`ok ${i} ${name}: ${snaps.rust.screen}`);
      continue;
    }
    failures++;
    console.log(`DIFF ${i} ${name}`);
    for (const line of out.slice(0, verbose ? 200 : 12))
      console.log("   ", verbose ? line : line.slice(0, 400));
  }
  for (const page of pages) await page.context().close();
  console.log(
    `${file}: ${failures === 0 ? "all steps match" : `${failures} steps differ`}`,
  );
  return failures;
}

(async () => {
  const args = process.argv.slice(2);
  const files = args.filter((arg) => !arg.startsWith("--"));
  const options = { verbose: args.includes("--verbose"), midi: fakeMidi(args) };
  const browser = await launch();
  let failures = 0;
  for (const file of files) failures += await run(browser, file, options);
  await browser.close();
  process.exitCode = failures === 0 ? 0 : 1;
})();
